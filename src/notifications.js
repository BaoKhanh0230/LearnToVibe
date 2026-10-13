import { createIcon } from './icons.js';

let timer;
let revision = 0;
let contentTween;
let shapeTween;

export function notify(message, { kind = 'info', duration = kind === 'loading' ? 0 : 6000 } = {}) {
  const toast = document.querySelector('#toast');
  const content = toast.querySelector('.toast-content');
  const text = toast.querySelector('#toast-message');
  const icon = toast.querySelector('#toast-icon');
  const current = ++revision;
  clearTimeout(timer);
  const previous = toast.hidden ? null : toast.getBoundingClientRect();
  shapeTween?.kill(); contentTween?.kill();
  toast.hidden = false;
  toast.dataset.kind = kind;
  icon.replaceChildren(createIcon({ loading: 'loader', success: 'check', error: 'alert', info: 'info' }[kind] ?? 'info'));
  text.textContent = message;
  toast.style.width = '';
  toast.style.height = '';
  const target = toast.getBoundingClientRect();
  const motion = document.documentElement.dataset.motion === 'full' && window.gsap;
  if (motion) {
    shapeTween = window.gsap.fromTo(toast, {
      width: previous?.width ?? Math.min(64, target.width), height: previous?.height ?? 48,
      borderRadius: previous ? parseFloat(getComputedStyle(toast).borderRadius) : 24,
    }, { width: target.width, height: target.height, borderRadius: 24, duration: 0.4, ease: 'power3.out', clearProps: 'width,height,borderRadius' });
    contentTween = window.gsap.fromTo(content, { opacity: 0, filter: 'blur(4px)', y: 3 }, {
      opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'filter,opacity,transform',
    });
  } else {
    window.gsap?.set([toast, content], { clearProps: 'width,height,borderRadius,filter,opacity,transform' });
  }
  if (duration > 0) timer = setTimeout(() => { if (current === revision) dismissNotification(); }, duration);
}

export function confirmAction(message) {
  const dialog = document.querySelector('#confirm-action');
  if (document.querySelector('dialog[open]')) return Promise.resolve(false);
  document.querySelector('#confirm-message').textContent = message;
  dialog.returnValue = '';
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
    if (document.documentElement.dataset.motion === 'full') window.gsap?.fromTo(dialog, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .22, ease: 'power3.out', clearProps: 'transform,opacity' });
  });
}

export function dismissNotification() {
  revision++;
  clearTimeout(timer);
  shapeTween?.kill(); contentTween?.kill();
  const toast = document.querySelector('#toast');
  toast.hidden = true;
  window.gsap?.set([toast, toast.querySelector('.toast-content')], { clearProps: 'width,height,borderRadius,filter,opacity,transform' });
}

export function initializeNotifications() {
  document.querySelector('#toast-dismiss').addEventListener('click', dismissNotification);
  // A mid-morph motion toggle should immediately settle on the readable state.
  const observer = new MutationObserver(() => {
    if (document.documentElement.dataset.motion !== 'reduced') return;
    shapeTween?.kill(); contentTween?.kill();
    const toast = document.querySelector('#toast');
    window.gsap?.set([toast, toast.querySelector('.toast-content')], { clearProps: 'width,height,borderRadius,filter,opacity,transform' });
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
}
