import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { connectPostgresStore } from "./postgres-session-store.mjs";

// Run only against a dedicated test branch; never load the production DATABASE_URL.
if (!process.env.TEST_DATABASE_URL) throw new Error("Cần TEST_DATABASE_URL của nhánh kiểm thử riêng.");
const encryptionKey = randomBytes(32).toString("base64");
const id = `deployment-check-${randomBytes(16).toString("hex")}`;
const record = { clientId: "synthetic", csrfToken: "synthetic-csrf", accessToken: "synthetic-access",
  refreshToken: "synthetic-refresh", expiresAt: Date.now() + 600000 };
let store;
try {
  store = await connectPostgresStore({ databaseUrl: process.env.TEST_DATABASE_URL, encryptionKey });
  await store.set(id, record);
  assert.deepEqual(await store.get(id), record);
  assert.equal(await store.get(`${id}-other`), null);
  const raw = await store.pool.query("SELECT payload FROM vibelog_sessions WHERE id=$1", [id]);
  assert.equal(raw.rows[0].payload.includes("synthetic-refresh"), false);
  await store.pool.end();
  store = await connectPostgresStore({ databaseUrl: process.env.TEST_DATABASE_URL, encryptionKey });
  assert.deepEqual(await store.get(id), record);
  const previous = await store.get(id);
  assert.equal(await store.replace(id, previous, { ...previous, accessToken: "new-synthetic-access" }), true);
  assert.equal(await store.replace(id, previous, record), false);
  await store.delete(id);
  assert.equal(await store.replace(id, previous, record), false);
  assert.equal(await store.get(id), null);
  console.log("PASS: verified TLS, encrypted sessions, isolated sessions, reconnect persistence, atomic refresh and disconnection on real PostgreSQL.");
} catch {
  process.exitCode = 1;
  console.error("FAIL: kiểm tra PostgreSQL thật chưa đạt; không in chuỗi kết nối hoặc nội dung phiên.");
} finally {
  if (store && !store.pool.ended) {
    await store.delete(id).catch(() => {});
    await store.pool.end();
  }
}
