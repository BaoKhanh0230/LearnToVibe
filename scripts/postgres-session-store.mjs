import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const revision = record => createHash("sha256").update(JSON.stringify(record)).digest("hex");

// Only encrypted Google credentials are stored. The encryption key stays on the server.
export class PostgresSessionStore {
  constructor(pool, encryptionKey, now = Date.now) {
    this.pool = pool;
    this.now = now;
    this.key = Buffer.from(encryptionKey ?? "", "base64");
    if (this.key.length !== 32) throw new Error("SESSION_ENCRYPTION_KEY phải là khóa 32 byte dạng base64; giữ nguyên qua các lần deploy.");
  }
  async initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS vibelog_sessions (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, revision TEXT NOT NULL, expires_at BIGINT NOT NULL
    )`);
    await this.pool.query("DELETE FROM vibelog_sessions WHERE expires_at <= $1", [this.now()]);
  }
  encrypt(id, record) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(id));
    const data = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
  }
  decrypt(id, data) {
    data = Buffer.from(data, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, data.subarray(0, 12));
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
  }
  async get(id) {
    const result = await this.pool.query("SELECT payload FROM vibelog_sessions WHERE id = $1 AND expires_at > $2", [id, this.now()]);
    return result.rows[0] ? this.decrypt(id, result.rows[0].payload) : null;
  }
  async set(id, record) {
    await this.pool.query(`INSERT INTO vibelog_sessions (id, payload, revision, expires_at) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, revision = EXCLUDED.revision, expires_at = EXCLUDED.expires_at`,
    [id, this.encrypt(id, record), revision(record), record.expiresAt]);
  }
  async delete(id) { await this.pool.query("DELETE FROM vibelog_sessions WHERE id = $1", [id]); }
  async replace(id, previous, next) {
    const result = await this.pool.query(`UPDATE vibelog_sessions SET payload = $2, revision = $3, expires_at = $4
      WHERE id = $1 AND revision = $5 AND expires_at > $6`,
    [id, this.encrypt(id, next), revision(next), next.expiresAt, revision(previous), this.now()]);
    return result.rowCount === 1;
  }
  async deleteIfCurrent(id, previous) {
    const result = await this.pool.query("DELETE FROM vibelog_sessions WHERE id = $1 AND revision = $2", [id, revision(previous)]);
    return result.rowCount === 1;
  }
}

export async function connectPostgresStore({ databaseUrl, encryptionKey }) {
  const { default: pg } = await import("pg");
  const url = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL phải là địa chỉ PostgreSQL.");
  url.searchParams.set("sslmode", "verify-full");
  const pool = new pg.Pool({ connectionString: url.href, max: 3, idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  pool.on("error", () => console.error("Kho phiên PostgreSQL tạm thời mất kết nối."));
  try {
    const store = new PostgresSessionStore(pool, encryptionKey);
    await store.initialize();
    return store;
  } catch (error) { await pool.end(); throw error; }
}
