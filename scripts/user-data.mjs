import { PROFILE_KEY, validateProfile } from '../src/profile.js';
const keys = new Set(["vibelog.entries.v1", "vibelog.plans.v1", "vibelog.weeklyGoal.v1", "vibelog.reminder.v1", "vibelog.calendarAuto.v1", "vibelog.profile.v1"]);
const invalid = () => { throw Object.assign(new Error("Dữ liệu gửi lên chưa hợp lệ."), { status: 400 }); };

export function validateUserData(body) {
  if (!body || !Number.isSafeInteger(body.version) || body.version < 0 || !body.values || typeof body.values !== "object" || Array.isArray(body.values)) invalid();
  for (const [key, value] of Object.entries(body.values)) {
    if (!keys.has(key) || typeof value !== "string") invalid();
    let parsed;
    try { parsed = JSON.parse(value); } catch { invalid(); }
    if (key.includes("entries") || key.includes("plans")) {
      if (!Array.isArray(parsed) || parsed.length > 1000) invalid();
      const ids = new Set();
      for (const row of parsed) {
        if (!row || typeof row.id !== "string" || !/^[\w-]{1,128}$/.test(row.id) || ids.has(row.id) || typeof row.title !== "string" || !row.title.trim() || row.title.length > 500 || !Number.isFinite(row.minutes) || row.minutes <= 0 || row.minutes > 10080) invalid();
        ids.add(row.id);
        if (key.includes("entries") && (typeof row.learning !== "string" || !["flow", "curious", "stuck", "proud"].includes(row.mood) || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt)) || (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some(tag => typeof tag !== "string"))))) invalid();
        if ((key.includes("plans") || row.startedAt !== undefined) && (typeof row.startedAt !== "string" || !Number.isFinite(Date.parse(row.startedAt)))) invalid();
      }
    } else if (key === 'vibelog.profile.v1') {
      validateProfile(parsed);
    } else if (key.includes("weeklyGoal")) {
      if (!Number.isFinite(parsed) || parsed < 30 || parsed > 10080) invalid();
    } else if (key.includes("calendarAuto")) {
      if (typeof parsed !== "boolean") invalid();
    } else if (!parsed || typeof parsed.enabled !== "boolean" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.time) || !Array.isArray(parsed.days) || !parsed.days.length || parsed.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) invalid();
  }
  return { version: body.version, values: body.values };
}

export async function updateUserProfile(store, userId, input) {
  const profile = JSON.stringify(validateProfile(input));
  // Read/merge/CAS preserves diary and settings, even when another device writes.
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await store.get(userId);
    if (current.values[PROFILE_KEY] === profile) return current; // Safe retry after a lost response.
    const values = { ...current.values, [PROFILE_KEY]: profile };
    if (Buffer.byteLength(JSON.stringify(values)) > 65536) throw Object.assign(new Error('Tài khoản đã đạt giới hạn lưu trữ. Chưa thể lưu hồ sơ.'), { status: 413 });
    const result = await store.put(userId, { version: current.version, values });
    if (result) return result;
  }
  throw Object.assign(new Error('Hồ sơ đang được cập nhật. Vui lòng thử lại sau.'), { status: 503 });
}

export class LocalUserDataStore {
  constructor(store) { this.store = store; }
  async get(userId) {
    const row = await this.store.get(`user:${userId}`);
    return row ? { version: row.version, values: row.values } : { version: 0, values: {} };
  }
  async put(userId, body) {
    // Local file mode is single-process; no awaits between compare and write.
    const key = `user:${userId}`;
    const previous = this.store.get(key);
    if ((previous?.version ?? 0) !== body.version) return null;
    const next = { version: body.version + 1, values: body.values, expiresAt: 8640000000000000 };
    this.store.set(key, next);
    return { version: next.version, values: next.values };
  }
}

export class PostgresUserDataStore {
  constructor(pool) { this.pool = pool; }
  async transaction(userId, run) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Deliberately leave the database owner's privileges before touching user rows.
      await client.query("SET LOCAL ROLE vibelog_user");
      await client.query("SELECT set_config('vibelog.user_id', $1, true)", [userId]);
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  get(userId) {
    return this.transaction(userId, async client => {
      const result = await client.query('SELECT version, payload AS "values" FROM public.vibelog_user_data WHERE user_id = $1', [userId]);
      return result.rows[0] ?? { version: 0, values: {} };
    });
  }
  put(userId, body) {
    return this.transaction(userId, async client => {
      const result = body.version === 0
        ? await client.query(`INSERT INTO public.vibelog_user_data (user_id, version, payload) VALUES ($1, 1, $2::jsonb)
            ON CONFLICT (user_id) DO NOTHING RETURNING version, payload AS "values"`, [userId, JSON.stringify(body.values)])
        : await client.query(`UPDATE public.vibelog_user_data SET payload = $2::jsonb, version = version + 1
            WHERE user_id = $1 AND version = $3 RETURNING version, payload AS "values"`, [userId, JSON.stringify(body.values), body.version]);
      return result.rows[0] ?? null;
    });
  }
}
