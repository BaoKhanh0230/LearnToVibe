import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAuth } from '../scripts/google-auth.mjs';
import { LocalUserDataStore, PostgresUserDataStore, validateUserData } from '../scripts/user-data.mjs';
import { mergeLegacy, setUserStorage, userStorage } from '../src/user-storage.js';
import { loadEntries, saveEntries } from '../src/store.js';
import { CALENDAR_SCOPE } from '../src/calendar.js';

function setup() {
  const records = new Map();
  let loseNextReplace = false;
  const store = { get: key => records.get(key) ?? null, set: (key, value) => records.set(key, value),
    delete: key => records.delete(key), replace(key, old, next) {
      if (loseNextReplace) { loseNextReplace = false; records.set(key, { ...old, accessToken: 'refreshed-concurrently' }); return false; }
      if (records.get(key) !== old) return false; records.set(key, next); return true;
    },
    deleteIfCurrent(key, old) { if (records.get(key) !== old) return false; return records.delete(key); } };
  let subject = 'A', grantCalendar = true, identityError = false;
  const origin = 'https://vibelog.test';
  const auth = createGoogleAuth({ origin, clientId: 'client', clientSecret: 'secret', store,
    userDataStore: new LocalUserDataStore(store), fetcher: async url => {
      if (url.endsWith('/token')) return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: grantCalendar ? CALENDAR_SCOPE : 'openid email' });
      if (url.endsWith('/userinfo')) return Response.json(identityError ? {} : { sub: subject, email: `${subject}@example.test` }, { status: identityError ? 401 : 200 });
      return Response.json({});
    } });
  async function request(path, { method = 'GET', cookie, csrf, user, body, external = false } = {}) {
    const req = { method, body, headers: { host: 'vibelog.test', origin: external ? 'https://attacker.test' : origin,
      'x-vibelog-request': '1', 'x-vibelog-csrf': csrf, 'x-vibelog-user': user, cookie } };
    const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); }, end(text) { if (text) this.data = JSON.parse(text); } };
    await auth.handle(req, res, new URL(path, origin));
    return res;
  }
  async function login(who) {
    subject = who;
    const flow = await request('/api/auth/connect', { method: 'POST' });
    const state = new URL(flow.data.url).searchParams.get('state');
    assert.match(new URL(flow.data.url).searchParams.get('scope'), /openid email profile/);
    const callback = await request(`/api/auth/callback?state=${state}&code=test`, { cookie: flow.headers['Set-Cookie'].split(';')[0] });
    if (identityError) return callback;
    const cookie = callback.headers['Set-Cookie'].find(value => value.startsWith('vibelog_session=')).split(';')[0];
    const status = (await request('/api/auth/status', { cookie })).data;
    return { cookie, csrf: status.csrfToken, user: status.user.id, status };
  }
  return { request, login, setPermission: value => { grantCalendar = value; }, breakIdentity: () => { identityError = true; }, simulateRefreshRace: () => { loseNextReplace = true; } };
}

test('same Google account on two devices owns same data; B cannot read or write A; logout preserves data', async () => {
  const app = setup();
  const a = await app.login('A');
  const otherDevice = await app.login('A');
  const b = await app.login('B');
  assert.equal(a.user, otherDevice.user); assert.notEqual(a.user, b.user);
  const body = { version: 0, values: { 'vibelog.weeklyGoal.v1': '240' } };
  assert.equal((await app.request('/api/user/data', { ...a, method: 'PUT', body })).status, 200);
  assert.equal((await app.request('/api/user/data', otherDevice)).data.values['vibelog.weeklyGoal.v1'], '240');
  assert.deepEqual((await app.request('/api/user/data', b)).data.values, {});
  assert.equal((await app.request('/api/user/data', { ...b, user: a.user, method: 'PUT', body })).status, 409);
  assert.equal((await app.request('/api/user/data', { ...a, method: 'PUT', body })).status, 409, 'stale version must not overwrite');
  assert.equal((await app.request('/api/user/data', { ...a, method: 'PUT', body: { version: 1, values: {}, user_id: b.user } })).status, 200);
  assert.deepEqual((await app.request('/api/user/data', b)).data.values, {});
  assert.equal((await app.request('/api/auth/logout', { ...a, method: 'POST' })).status, 200);
  assert.equal((await app.request('/api/user/data', a)).status, 401);
  assert.equal((await app.request('/api/user/data', otherDevice)).data.version, 2);
});

test('identity works without Calendar permission; disconnect Calendar keeps account and journal', async () => {
  const app = setup(); app.setPermission(false);
  const a = await app.login('A');
  assert.equal(a.status.connected, false); assert.ok(a.status.user);
  assert.equal((await app.request('/api/calendar/events', a)).status, 401);
  assert.equal((await app.request('/api/user/data', a)).status, 200);
  app.setPermission(true);
  const connected = await app.login('A');
  app.simulateRefreshRace();
  await app.request('/api/auth/disconnect', { ...connected, method: 'POST' });
  const status = await app.request('/api/auth/status', connected);
  assert.equal(status.data.user.id, a.user); assert.equal(status.data.connected, false);
  assert.equal((await app.request('/api/user/data', connected)).status, 200);
});

test('profile PATCH is independent of snapshots and enforces login, CSRF and owner', async () => {
  const app = setup(); const a = await app.login('A'), b = await app.login('B');
  const body = { displayName: 'My profile', avatar: 'rocket' };
  assert.equal((await app.request('/api/user/profile', { method: 'PATCH', body })).status, 401);
  assert.equal((await app.request('/api/user/profile', { ...a, csrf: 'bad', method: 'PATCH', body })).status, 403);
  assert.equal((await app.request('/api/user/profile', { ...a, user: b.user, method: 'PATCH', body })).status, 409);
  assert.equal((await app.request('/api/user/profile', { ...a, method: 'PATCH', body: { ...body, avatar: 'unknown' } })).status, 400);
  const saved = await app.request('/api/user/profile', { ...a, method: 'PATCH', body });
  assert.equal(saved.status, 200);
  const again = await app.request('/api/user/profile', { ...a, method: 'PATCH', body });
  assert.equal(again.data.version, saved.data.version);
  assert.deepEqual((await app.request('/api/user/data', b)).data.values, {});
});

test('reject anonymous, CSRF, origin, malformed data, oversized body and unverified Google identity', async () => {
  const app = setup(); const a = await app.login('A');
  const body = { version: 0, values: {} };
  assert.equal((await app.request('/api/user/data')).status, 401);
  assert.equal((await app.request('/api/user/data', { ...a, csrf: 'bad', method: 'PUT', body })).status, 403);
  assert.equal((await app.request('/api/user/data', { ...a, external: true, method: 'PUT', body })).status, 403);
  for (const invalid of [{ version: -1, values: {} }, { version: 0, values: { 'user_id': 'B' } }, { version: 0, values: { 'vibelog.entries.v1': '[{}]' } }]) {
    assert.equal((await app.request('/api/user/data', { ...a, method: 'PUT', body: invalid })).status, 400);
  }
  assert.equal((await app.request('/api/user/data', { ...a, method: 'PUT', body: { extra: 'x'.repeat(66000) } })).status, 413);
  app.breakIdentity();
  const rejected = await app.login('C');
  assert.match(rejected.headers.Location, /google=failed/);
});

test('legacy import preserves cloud IDs, is repeatable and account storage does not mix users', () => {
  const key = 'vibelog.entries.v1';
  const cloud = { [key]: JSON.stringify([{ id: 'a', title: 'Cloud' }]) };
  const legacy = { [key]: JSON.stringify([{ id: 'a', title: 'Old' }, { id: 'b', title: 'Legacy' }]) };
  const merged = mergeLegacy(cloud, legacy);
  assert.deepEqual(mergeLegacy(merged, legacy), merged);
  assert.equal(JSON.parse(merged[key])[0].title, 'Cloud');
  const values = new Map();
  setUserStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  saveEntries([{ id: 'A' }]); assert.equal(loadEntries()[0].id, 'A');
  setUserStorage({ getItem: () => null, setItem() {} });
  assert.deepEqual(loadEntries(), []); assert.equal(userStorage.getItem(key), null);
  setUserStorage(undefined);
});

test('Postgres queries run with restricted role and transaction-local identity; errors roll back and release', async () => {
  const calls = [];
  const client = { async query(sql, params) { calls.push({ sql, params }); if (sql.startsWith('SELECT version')) return { rows: [{ version: 3, values: {} }] }; return { rows: [] }; }, release() { calls.push({ sql: 'release' }); } };
  const store = new PostgresUserDataStore({ connect: async () => client });
  assert.equal((await store.get('A')).version, 3);
  assert.deepEqual(calls.slice(0, 3).map(call => call.sql), ['BEGIN', 'SET LOCAL ROLE vibelog_user', "SELECT set_config('vibelog.user_id', $1, true)"]);
  assert.equal(calls[2].params[0], 'A');
  calls.length = 0;
  await assert.rejects(store.transaction('B', () => { throw new Error('database down'); }), /database down/);
  assert.deepEqual(calls.slice(-2).map(call => call.sql), ['ROLLBACK', 'release']);
});

test('data validation accepts legacy journals without startedAt and checks preferences', () => {
  assert.doesNotThrow(() => validateUserData({ version: 0, values: { 'vibelog.entries.v1': JSON.stringify([{ id: 'legacy', title: 'Study', minutes: 30, learning: '', mood: 'curious', createdAt: '2026-10-19T10:00:00Z' }]) } }));
  assert.throws(() => validateUserData({ version: 0, values: { 'vibelog.weeklyGoal.v1': '0' } }));
  assert.throws(() => validateUserData({ version: 0, values: { 'vibelog.reminder.v1': '{}' } }));
});
