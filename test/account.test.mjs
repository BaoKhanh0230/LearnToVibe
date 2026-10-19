import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeAccount } from '../src/account.js';
import { setUserStorage, userStorage } from '../src/user-storage.js';

function setup(t, { user = { id: 'A', email: 'a@example.test' }, draft, initialVersion = 1, initialValues = { 'vibelog.weeklyGoal.v1': '180' } } = {}) {
  const previous = Object.fromEntries(['window', 'document', 'fetch', 'location', 'localStorage', 'sessionStorage'].map(key => [key, globalThis[key]]));
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, { textContent: '', hidden: true, inert: false, disabled: false, dataset: {}, style: {}, attributes: {}, elements: { displayName: { value: '', focus() {} }, avatar: { value: 'initials' } }, listeners: {},
      setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; }, querySelectorAll() { return []; }, contains() { return false; }, focus() {},
      showModal() { this.open = true; }, close() { this.open = false; }, getBoundingClientRect() { return { right: 100, bottom: 60 }; },
      addEventListener(event, fn) { this.listeners[event] = fn; } });
    return elements.get(key);
  };
  const storage = () => {
    const map = new Map();
    return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  };
  globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
  localStorage.setItem('vibelog.entries.v1', '[{"id":"legacy"}]');
  if (draft) sessionStorage.setItem('vibelog.draft.A', JSON.stringify(draft));
  globalThis.document = { querySelector: element, addEventListener() {}, hidden: false };
  const listeners = {};
  globalThis.window = { addEventListener: (key, fn) => { listeners[key] = fn; } };
  let reloadCount = 0, fail = false, failuresLeft = 0, profileGate, currentUser = user, version = initialVersion, values = { ...initialValues };
  const writes = [], profileWrites = [], notices = [];
  globalThis.location = { reload: () => { reloadCount++; } };
  globalThis.fetch = async (path, options) => {
    if (path === '/api/auth/status') return Response.json({ configured: true, user: currentUser, csrfToken: 'csrf' });
    if (path === '/api/user/profile') {
      const profile = JSON.parse(options.body); profileWrites.push(profile);
      if (fail || failuresLeft-- > 0) throw new Error('Network offline');
      if (profileGate) await profileGate;
      values = { ...values, 'vibelog.profile.v1': JSON.stringify(profile) }; version++;
    }
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body); writes.push(body);
      if (fail) throw new Error('Network offline');
      if (body.version !== version) return Response.json({ error: 'Conflict' }, { status: 409 });
      values = body.values; version++;
    }
    return Response.json({ version, values });
  };
  t.after(() => { setUserStorage(undefined); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  return { element, writes, profileWrites, notices, listeners,
    initialize: () => initializeAccount({ notify: (message, options) => notices.push({ message, ...options }), retryDelay: () => Promise.resolve() }),
    holdProfile: () => { let release; profileGate = new Promise(resolve => { release = resolve; }); return () => { profileGate = null; release(); }; },
    get reloadCount() { return reloadCount; }, failNext: count => { failuresLeft = count; }, setOffline: value => { fail = value; }, switchUser: value => { currentUser = value; } };
}

test('account bootstrap loads cloud before stores render and never auto-imports legacy data', async t => {
  const app = setup(t);
  await app.initialize();
  assert.equal(userStorage.getItem('vibelog.entries.v1'), null);
  assert.equal(userStorage.getItem('vibelog.weeklyGoal.v1'), '180');
  assert.equal(app.element('#account-import').hidden, false);
  assert.equal(app.element('main').inert, false);
  assert.equal(app.writes.length, 0);
  assert.match(app.element('#account-status').textContent, /a@example.test/);
});

test('queued changes reach cloud; offline draft persists and retry saves it', async t => {
  const app = setup(t); await app.initialize();
  userStorage.setItem('vibelog.weeklyGoal.v1', '240');
  userStorage.setItem('vibelog.weeklyGoal.v1', '300');
  await app.element('#account-retry').listeners.click();
  assert.equal(app.writes.at(-1).values['vibelog.weeklyGoal.v1'], '300');
  assert.equal(sessionStorage.getItem('vibelog.draft.A'), null);
  app.setOffline(true);
  userStorage.setItem('vibelog.weeklyGoal.v1', '360');
  await app.element('#account-retry').listeners.click();
  assert.equal(JSON.parse(sessionStorage.getItem('vibelog.draft.A')).values['vibelog.weeklyGoal.v1'], '360');
  assert.match(app.element('#account-sync').textContent, /Network offline/);
  app.setOffline(false);
  await app.element('#account-retry').listeners.click();
  assert.equal(sessionStorage.getItem('vibelog.draft.A'), null);
  assert.match(app.element('#account-sync').textContent, /Đã đồng bộ/);
});

test('stale saved draft blocks editing and uploads until explicitly resolved', async t => {
  const app = setup(t, { initialVersion: 2, draft: { version: 1, values: { 'vibelog.weeklyGoal.v1': '600' } } });
  await app.initialize();
  assert.equal(app.element('main').inert, true);
  assert.equal(app.element('#account-export').hidden, false);
  assert.equal(app.writes.length, 0);
  await app.element('#account-retry').listeners.click();
  assert.equal(app.writes.length, 0);
});

test('another tab changing accounts triggers reload before editing resumes', async t => {
  const app = setup(t); await app.initialize();
  app.switchUser({ id: 'B' });
  await app.listeners.focus();
  assert.equal(app.reloadCount, 1); assert.equal(app.element('main').inert, true);
});

test('profile edits persist in the account snapshot and update the avatar after save', async t => {
  const app = setup(t); await app.initialize();
  await app.element('#account-edit').listeners.click();
  assert.equal(app.element('#profile-dialog').open, true);
  const form = app.element('#profile-form');
  form.elements.displayName.value = 'Khánh học code';
  form.elements.avatar.value = 'rocket';
  await form.listeners.submit({ preventDefault() {} });
  assert.deepEqual(app.profileWrites.at(-1), { displayName: 'Khánh học code', avatar: 'rocket' });
  assert.equal(app.writes.length, 0, 'a profile edit must not resubmit the diary');
  assert.equal(app.notices.at(-1).kind, 'success');
  assert.equal(app.element('#account-trigger-name').textContent, 'Khánh học code');
  assert.equal(app.element('#account-avatar').textContent, '🚀');
  assert.equal(app.element('#profile-dialog').open, false);
});

test('invalid name does not write; offline profile retries automatically without a manual sync workflow', async t => {
  const app = setup(t); await app.initialize();
  const form = app.element('#profile-form');
  form.elements.displayName.value = '   ';
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(app.writes.length, 0);
  app.setOffline(true); form.elements.displayName.value = 'Bản nháp';
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(app.element('#account-notice').hidden, true);
  assert.ok(localStorage.getItem('vibelog.profilePending.A'));
  assert.equal(app.element('#account-retry').hidden, true);
  assert.equal(app.notices.some(item => item.kind === 'success'), false, 'do not claim cloud success offline');
  app.setOffline(false);
  await app.listeners.online();
  assert.equal(localStorage.getItem('vibelog.profilePending.A'), null);
  assert.equal(app.notices.at(-1).kind, 'success');
});

test('temporary profile failures retry invisibly then show one success', async t => {
  const app = setup(t); await app.initialize(); app.failNext(1);
  const form = app.element('#profile-form');
  form.elements.displayName.value = 'Khánh'; form.elements.avatar.value = 'cat';
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(app.profileWrites.length, 2);
  assert.deepEqual(app.notices.map(item => item.kind), ['success']);
  assert.equal(app.element('#account-notice').hidden, true);
});

test('old profile-only draft is recovered automatically even if cloud version changed', async t => {
  const values = { 'vibelog.weeklyGoal.v1': '180' };
  const app = setup(t, { initialVersion: 3, initialValues: values, draft: { version: 1, values: { ...values, 'vibelog.profile.v1': JSON.stringify({ displayName: 'Recovered', avatar: 'cat' }) } } });
  await app.initialize();
  assert.equal(app.element('main').inert, false);
  assert.equal(app.element('#account-avatar').textContent, '🐱');
  assert.equal(sessionStorage.getItem('vibelog.draft.A'), null);
  assert.equal(app.element('#account-export').hidden, true);
  assert.equal(app.profileWrites.length, 1);
});

test('a new avatar edit while an offline retry is in flight is saved last rather than discarded', async t => {
  const app = setup(t); await app.initialize();
  const form = app.element('#profile-form');
  app.setOffline(true); form.elements.displayName.value = 'First'; form.elements.avatar.value = 'cat';
  await form.listeners.submit({ preventDefault() {} });
  app.setOffline(false);
  const release = app.holdProfile();
  const background = app.listeners.online();
  await Promise.resolve();
  assert.equal(app.profileWrites.at(-1).displayName, 'First');
  form.elements.displayName.value = 'Latest'; form.elements.avatar.value = 'rocket';
  const foreground = form.listeners.submit({ preventDefault() {} });
  release(); await Promise.all([background, foreground]);
  assert.deepEqual(app.profileWrites.at(-1), { displayName: 'Latest', avatar: 'rocket' });
  assert.equal(app.element('#account-avatar').textContent, '🚀');
  assert.equal(localStorage.getItem('vibelog.profilePending.A'), null);
});
