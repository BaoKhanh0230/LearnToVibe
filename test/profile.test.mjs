import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfile } from '../src/profile.js';
import { validateUserData, updateUserProfile } from '../scripts/user-data.mjs';

test('avatar defaults use Unicode initials and a stable account color; missing or corrupt profile falls back safely', () => {
  const user = { id: 'stable-user', name: 'Bảo Khánh', email: 'khanh@example.test' };
  assert.equal(resolveProfile(user).symbol, 'BK');
  assert.equal(resolveProfile(user, '{bad').symbol, 'BK');
  assert.equal(resolveProfile({ id: user.id, name: 'Changed' }).tone, resolveProfile(user).tone);
  assert.equal(resolveProfile({ email: 'student@example.test' }).displayName, 'student');
  assert.equal(resolveProfile(user, JSON.stringify({ displayName: 'Nguyễn An', avatar: 'cat' })).symbol, '🐱');
});

test('profile updates preserve unrelated legacy data, retry version races and are idempotent', async () => {
  let current = { version: 1, values: { 'vibelog.entries.v1': '[{"legacy":"untouched"}]' } };
  let attempts = 0;
  const store = {
    async get() { return structuredClone(current); },
    async put(userId, body) {
      assert.equal(userId, 'owner');
      if (++attempts === 1) { current = { version: 2, values: { ...current.values, 'vibelog.weeklyGoal.v1': '300' } }; return null; }
      assert.equal(body.version, current.version);
      current = { version: current.version + 1, values: body.values }; return current;
    },
  };
  const profile = { displayName: 'Khánh', avatar: 'cat' };
  const result = await updateUserProfile(store, 'owner', profile);
  assert.equal(result.values['vibelog.entries.v1'], '[{"legacy":"untouched"}]');
  assert.equal(result.values['vibelog.weeklyGoal.v1'], '300');
  assert.deepEqual(JSON.parse(result.values['vibelog.profile.v1']), profile);
  const again = await updateUserProfile(store, 'owner', profile);
  assert.equal(again.version, result.version); assert.equal(attempts, 2);
});

test('server accepts only supported profile fields and avatars; a profile cannot change account ownership', () => {
  const body = profile => ({ version: 0, values: { 'vibelog.profile.v1': JSON.stringify(profile) } });
  assert.doesNotThrow(() => validateUserData(body({ displayName: 'Khánh', avatar: 'initials' })));
  for (const profile of [null, [], { displayName: '', avatar: 'cat' }, { displayName: 'x'.repeat(61), avatar: 'cat' }, { displayName: 'A', avatar: '__proto__' }, { displayName: 'A', avatar: 'https://example.com/image' }, { displayName: 'A', avatar: 'cat', userId: 'B' }]) {
    assert.throws(() => validateUserData(body(profile)), { status: 400 });
  }
});
