import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeAccountMenu } from '../src/account-menu.js';

test('menu keeps internal focus transitions clickable, supports keyboard selection and closes outside', t => {
  const previous = { document: globalThis.document, window: globalThis.window };
  const node = () => ({ listeners: {}, attributes: {}, style: {}, hidden: false,
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; },
    getBoundingClientRect() { return { right: 700, bottom: 70 }; },
    focus() { document.activeElement = this; } });
  const trigger = node(), menu = node(), first = node(), second = node(), outside = node();
  menu.querySelectorAll = () => [first, second];
  menu.contains = target => [menu, first, second].includes(target);
  trigger.contains = target => target === trigger;
  globalThis.document = { activeElement: trigger, querySelector: selector => selector === '#account-trigger' ? trigger : menu, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  globalThis.window = { innerWidth: 800, innerHeight: 600, addEventListener() {} };
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  initializeAccountMenu();
  trigger.listeners.click(); assert.equal(menu.hidden, false); assert.equal(document.activeElement, first);
  menu.listeners.focusout({ relatedTarget: second });
  assert.equal(menu.hidden, false, 'moving from one item to another must not swallow the next click');
  menu.listeners.keydown({ key: 'ArrowDown', preventDefault() {} }); assert.equal(document.activeElement, second);
  menu.listeners.keydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  assert.equal(menu.hidden, true); assert.equal(document.activeElement, trigger);
  trigger.listeners.keydown({ key: 'ArrowUp', preventDefault() {} });
  assert.equal(document.activeElement, second);
  menu.listeners.focusout({ relatedTarget: outside }); assert.equal(menu.hidden, true);
});
