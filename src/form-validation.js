import { notify } from './notifications.js';

const names = { title: 'tên hoạt động', startedAt: 'giờ bắt đầu', minutes: 'thời lượng học', learning: 'bài học rút ra' };
export function validationMessage(control) {
  const name = names[control.name] ?? 'thông tin này';
  if (control.validity.valueMissing || (control.required && ['text', 'textarea'].includes(control.type) && !control.value.trim())) return `Hãy nhập ${name} trước khi lưu.`;
  if (control.validity.badInput || control.validity.typeMismatch) return `Hãy nhập ${name} hợp lệ.`;
  if (control.validity.rangeUnderflow || control.validity.rangeOverflow) return `${name.charAt(0).toUpperCase() + name.slice(1)} cần nằm trong khoảng ${control.min}–${control.max}${control.name === 'minutes' ? ' phút' : ''}.`;
  if (control.validity.stepMismatch) return `Hãy nhập ${name} theo bước ${control.step || 1}${control.name === 'minutes' ? ' phút' : ''}.`;
  if (!control.validity.valid) return `Kiểm tra lại ${name} trước khi lưu.`;
  return null;
}

export function initializeFormValidation() {
  const forms = [...document.querySelectorAll('#entry-form, #plan-form')];
  forms.forEach(form => { form.noValidate = true; });
  document.addEventListener('submit', event => {
    if (!forms.includes(event.target)) return;
    const invalid = [...event.target.elements].find(control => control.willValidate && validationMessage(control));
    if (!invalid) return;
    event.preventDefault(); event.stopImmediatePropagation();
    invalid.setAttribute('aria-invalid', 'true');
    invalid.setAttribute('aria-errormessage', 'toast-message');
    invalid.scrollIntoView({ block: 'center', behavior: document.documentElement.dataset.motion === 'full' ? 'smooth' : 'instant' });
    invalid.focus({ preventScroll: true });
    notify(validationMessage(invalid), { kind: 'error', duration: 7000 });
  }, true);
  for (const eventName of ['input', 'change']) document.addEventListener(eventName, event => {
    if (event.target.matches?.('[aria-invalid="true"]') && !validationMessage(event.target)) {
      event.target.removeAttribute('aria-invalid'); event.target.removeAttribute('aria-errormessage');
    }
  });
  document.addEventListener('invalid', event => {
    if (forms.includes(event.target.form)) event.preventDefault();
  }, true);
  forms.forEach(form => form.addEventListener('reset', () => {
    form.querySelectorAll('[aria-invalid]').forEach(control => { control.removeAttribute('aria-invalid'); control.removeAttribute('aria-errormessage'); });
  }));
}
