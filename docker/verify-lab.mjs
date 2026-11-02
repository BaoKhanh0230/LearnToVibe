// Exercises only fake data in the isolated Docker lesson volumes.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { request } from 'node:http';
import pg from 'pg';
import { SessionStore } from '../scripts/session-store.mjs';
import { PostgresSessionStore } from '../scripts/postgres-session-store.mjs';
import { PostgresUserDataStore } from '../scripts/user-data.mjs';

const mode = process.argv[2];
assert.ok(['seed', 'check'].includes(mode), 'Use seed or check');
assert.equal(process.cwd(), '/app', 'Run inside the Docker lesson container');
for (const file of ['.env', '.env.local', '.git', '.vercel', 'node_modules/pg-mem']) {
  assert.equal(existsSync(file), false, `${file} must not be in image`);
}
const health = await fetch('http://127.0.0.1:4173/healthz');
assert.equal(health.status, 200);
assert.equal((await health.json()).status, 'ok');
const home = await fetch('http://127.0.0.1:4173/');
assert.equal(home.status, 200);
assert.match(await home.text(), /VibeLog/);
for (const path of ['/styles.css', '/src/app.js']) {
  const response = await fetch(`http://127.0.0.1:4173${path}`);
  assert.equal(response.status, 200, path);
}
for (const path of ['/.env', '/.vibelog-data/encryption.key', '/scripts/server.mjs']) {
  assert.equal((await fetch(`http://127.0.0.1:4173${path}`)).status, 404);
}
const auth = await new Promise((resolve, reject) => {
  const req = request('http://127.0.0.1:4173/api/auth/status', { headers: { Host: 'localhost:4174' } }, response => {
    let body = '';
    response.on('data', chunk => { body += chunk; });
    response.on('error', reject);
    response.on('end', () => {
      try { assert.equal(response.statusCode, 200); resolve(JSON.parse(body)); }
      catch (error) { reject(error); }
    });
  });
  req.on('error', reject);
  req.end();
});
assert.equal(auth.configured, false);

const local = new SessionStore('/app/.vibelog-data');
let pool;
try {
  const postgres = process.env.DOCKER_LAB_POSTGRES === '1';
  pool = postgres ? new pg.Pool({ host: 'db', user: 'vibelog_lab_app',
    password: 'local-learning-only', database: 'vibelog_lab', ssl: false,
    connectionTimeoutMillis: 10000 }) : null;
  const store = pool ? new PostgresSessionStore(pool, local.key.toString('base64')) : local;
  const id = 'docker-lesson-fake-record';
  if (mode === 'seed') await store.set(id, { message: 'Docker volume giu du lieu', expiresAt: Date.now() + 7 * 86400000 });
  assert.equal((await store.get(id))?.message, 'Docker volume giu du lieu');
  if (pool) {
    const role = (await pool.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user')).rows[0];
    assert.equal(role.rolsuper, false);
    assert.equal(role.rolbypassrls, false);
    const users = new PostgresUserDataStore(pool);
    const userId = 'd'.repeat(64);
    if (mode === 'seed') {
      const current = await users.get(userId);
      assert.ok(await users.put(userId, { version: current.version, values: { 'vibelog.weeklyGoal.v1': '180' } }));
    }
    assert.equal((await users.get(userId)).values['vibelog.weeklyGoal.v1'], '180');
    assert.deepEqual((await users.get('e'.repeat(64))).values, {});
  }
  console.log(`PASS ${mode}: HTTP, assets, private paths, image exclusions, ${postgres ? 'PostgreSQL + restricted role + account data' : 'file volume'} persistence.`);
} finally { if (pool) await pool.end(); }
