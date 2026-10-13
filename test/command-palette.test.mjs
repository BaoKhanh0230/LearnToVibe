import test from 'node:test';
import assert from 'node:assert/strict';
import { commandResults } from '../src/command-palette.js';

test('tìm thao tác và nhật ký bằng tiếng Việt không dấu, bỏ thao tác chưa dùng được', () => {
  const commands = [{ id: 'calendar', title: 'Xem lịch tuần' }, { id: 'backup', title: 'Sao lưu', disabled: true }];
  const entries = [{ id: 'one', title: 'Học dữ liệu', minutes: 30, tags: ['API'] }];
  assert.equal(commandResults(commands, entries, 'lich')[0].id, 'calendar');
  assert.equal(commandResults(commands, entries, 'du lieu')[0].entryId, 'one');
  assert.equal(commandResults(commands, entries, 'api')[0].entryId, 'one');
  assert.equal(commandResults(commands, entries, '').some(item => item.id === 'backup'), false);
  assert.deepEqual(commandResults(commands, entries, 'xyz'), []);
});
