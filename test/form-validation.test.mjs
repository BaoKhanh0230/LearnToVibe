import test from 'node:test';
import assert from 'node:assert/strict';
import { validationMessage } from '../src/form-validation.js';

test('lỗi tên trống/khoảng trắng và thời lượng được báo bằng tiếng Việt', () => {
  const control = { name: 'title', required: true, type: 'text', value: '   ', validity: { valid: true } };
  assert.equal(validationMessage(control), 'Hãy nhập tên hoạt động trước khi lưu.');
  assert.equal(validationMessage({ ...control, value: 'Học API' }), null);
  assert.equal(validationMessage({ name: 'minutes', min: '5', max: '600', validity: { valid: false, rangeUnderflow: true } }), 'Thời lượng học cần nằm trong khoảng 5–600 phút.');
  assert.equal(validationMessage({ name: 'startedAt', validity: { valid: false, valueMissing: true } }), 'Hãy nhập giờ bắt đầu trước khi lưu.');
});
