import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { newDb } from "pg-mem";
import { PostgresSessionStore } from "../scripts/postgres-session-store.mjs";

async function setup(t) {
  // pg-mem cannot track constraints on a repeated CREATE TABLE IF NOT EXISTS.
  const db = newDb({ noAstCoverageCheck: true });
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  t.after(() => pool.end());
  const key = randomBytes(32).toString("base64");
  const now = 1000;
  const store = new PostgresSessionStore(pool, key, () => now);
  await store.initialize();
  const record = { clientId: "client", csrfToken: "csrf", accessToken: "secret-access", refreshToken: "secret-refresh", expiresAt: 100000 };
  return { store, pool, key, record, now };
}

test("phiên mã hóa trong PostgreSQL khôi phục sau khi tạo lại máy chủ, giữ riêng từng người", async t => {
  const { store, pool, key, record, now } = await setup(t);
  await store.set("user-one", record);
  await store.set("user-two", { ...record, refreshToken: "user-two-refresh" });
  const rows = await pool.query("SELECT payload FROM vibelog_sessions");
  assert.equal(rows.rows.some(row => row.payload.includes("secret-refresh")), false);
  const restarted = new PostgresSessionStore(pool, key, () => now);
  await restarted.initialize();
  assert.deepEqual(await restarted.get("user-one"), record);
  assert.equal((await restarted.get("user-two")).refreshToken, "user-two-refresh");
  assert.equal(await restarted.get("unknown"), null);
  await restarted.delete("user-one");
  assert.equal(await store.get("user-one"), null);
  assert.ok(await store.get("user-two"));
});

test("gia hạn đang chạy không khôi phục phiên đã bị ngắt hoặc ghi đè token mới", async t => {
  const { store, record } = await setup(t);
  await store.set("user", record);
  const previous = await store.get("user");
  const next = { ...record, accessToken: "new-access" };
  assert.equal(await store.replace("user", previous, next), true);
  assert.equal(await store.replace("user", previous, record), false);
  assert.equal(await store.deleteIfCurrent("user", previous), false);
  await store.delete("user");
  assert.equal(await store.replace("user", next, record), false);
  assert.equal(await store.get("user"), null);
});

test("phiên hết hạn bị loại và đổi khóa/đổi ID làm dữ liệu mã hóa không thể đọc", async t => {
  const { store, pool, key, record } = await setup(t);
  await store.set("expired", { ...record, expiresAt: 500 });
  assert.equal(await store.get("expired"), null);
  await store.set("user", record);
  const wrongKey = new PostgresSessionStore(pool, randomBytes(32).toString("base64"));
  assert.throws(() => wrongKey.decrypt("user", store.encrypt("user", record)));
  assert.throws(() => store.decrypt("another-user", store.encrypt("user", record)));
  const tampered = Buffer.from(store.encrypt("user", record), "base64");
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => store.decrypt("user", tampered.toString("base64")));
  assert.throws(() => new PostgresSessionStore(pool, "bad-key"), /32 byte/);
  const restarted = new PostgresSessionStore(pool, key, () => 1000);
  await restarted.initialize();
  const rows = await pool.query("SELECT id FROM vibelog_sessions");
  assert.deepEqual(rows.rows.map(row => row.id), ["user"]);
});
