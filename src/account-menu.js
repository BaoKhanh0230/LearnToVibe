// Native popovers escape the navigation's backdrop-filter stacking context.
// A fixed-position fallback also supports browsers without the Popover API.
export function initializeAccountMenu() {
  const trigger = document.querySelector('#account-trigger');
  const menu = document.querySelector('#account-menu');
  const native = typeof menu.showPopover === 'function';
  let open = false;
  if (!native) { menu.removeAttribute('popover'); menu.hidden = true; }
  const items = () => [...menu.querySelectorAll('[role="menuitem"]')].filter(item => !item.hidden && !item.disabled);
  function position() {
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(336, window.innerWidth - 24);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`;
    menu.style.top = `${rect.bottom + 10}px`;
    menu.style.maxHeight = `${Math.max(100, window.innerHeight - rect.bottom - 24)}px`;
  }
  function close(restoreFocus = false) {
    if (!open) return;
    if (native) menu.hidePopover(); else menu.hidden = true;
    open = false; trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }
  function show(focusLast = false) {
    position();
    items().forEach(item => { item.tabIndex = -1; });
    if (!open) { if (native) menu.showPopover(); else menu.hidden = false; }
    open = true; trigger.setAttribute('aria-expanded', 'true');
    (focusLast ? items().at(-1) : items()[0])?.focus();
  }
  trigger.addEventListener('click', () => open ? close() : show());
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show(event.key === 'ArrowUp'); }
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const choices = items(); if (!choices.length) return;
    event.preventDefault();
    const index = choices.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
      : (index + (event.key === 'ArrowUp' ? -1 : 1) + choices.length) % choices.length;
    choices[next].focus();
  });
  menu.addEventListener('focusout', event => {
    // Focus can briefly be on body between pointerdown and click. Closing at a
    // microtask checkpoint would swallow clicks on a different menu item.
    if (event.relatedTarget) {
      if (!menu.contains(event.relatedTarget) && event.relatedTarget !== trigger) close();
    } else setTimeout(() => {
      if (!menu.contains(document.activeElement) && document.activeElement !== trigger) close();
    }, 0);
  });
  menu.addEventListener('click', event => { if (event.target.closest('[role="menuitem"]')) close(); });
  document.addEventListener('pointerdown', event => { if (!menu.contains(event.target) && !trigger.contains(event.target)) close(); });
  if (native) menu.addEventListener('toggle', event => {
    open = event.newState === 'open'; trigger.setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('resize', () => { if (open) position(); });
  window.addEventListener('scroll', () => { if (open) position(); }, { passive: true });
  return { close, show };
}
