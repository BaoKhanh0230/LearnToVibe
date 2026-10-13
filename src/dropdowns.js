import { createIcon } from './icons.js';

const dropdowns = [];
let opened;
export function syncDropdowns() { dropdowns.forEach(item => item.sync()); }

export function initializeDropdowns() {
  document.querySelectorAll('select').forEach(select => {
    const wrapper = document.createElement('div'); wrapper.className = 'animated-select';
    select.before(wrapper); wrapper.append(select); select.classList.add('select-native');
    select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'select-trigger';
    trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
    const value = document.createElement('span'); value.className = 'select-value';
    const chevron = createIcon('chevron'); trigger.append(value, chevron); wrapper.append(trigger);
    const menu = document.createElement('div'); menu.className = 'select-menu'; menu.id = `${select.id}-menu`; menu.setAttribute('role', 'listbox');
    trigger.setAttribute('aria-controls', menu.id);
    const label = select.labels[0]?.querySelector('.visually-hidden')?.textContent ?? ([...(select.labels[0]?.childNodes ?? [])].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(' ').trim() || 'Lựa chọn');
    const labelElement = select.labels[0];
    trigger.id = `${select.id}-trigger`;
    if (labelElement) labelElement.htmlFor = trigger.id;
    menu.setAttribute('aria-label', label); menu.setAttribute('data-lenis-prevent', '');
    const popover = typeof menu.showPopover === 'function';
    if (popover) menu.setAttribute('popover', 'manual'); else menu.hidden = true;
    document.body.append(menu);
    let rows = [];
    let index = 0;
    let tween;
    let sequence = 0;
    let isOpen = false;
    let typed = ''; let typedAt = 0;
    function sync() {
      const text = select.selectedOptions[0]?.textContent ?? '';
      value.textContent = text; trigger.setAttribute('aria-label', `${label}: ${text}`);
      trigger.disabled = select.disabled;
    }
    function position() {
      const rect = trigger.getBoundingClientRect();
      const natural = Math.min(menu.scrollHeight, 280);
      const below = innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const flipped = below < natural && above > below;
      const height = Math.min(natural, Math.max(80, flipped ? above : below));
      menu.style.width = `${Math.min(rect.width, innerWidth - 24)}px`;
      menu.style.maxHeight = `${height}px`;
      menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - rect.width - 12))}px`;
      menu.style.top = `${flipped ? Math.max(12, rect.top - height - 6) : rect.bottom + 6}px`;
      menu.style.transformOrigin = flipped ? 'bottom center' : 'top center';
    }
    function active(next) {
      if (!rows.length) return;
      index = (next + rows.length) % rows.length;
      rows.forEach((row, i) => row.classList.toggle('is-active', i === index));
      trigger.setAttribute('aria-activedescendant', rows[index].id);
      rows[index].scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    function close(focus = false, immediate = false) {
      if (!isOpen) return;
      isOpen = false; if (opened === api) opened = null;
      trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant');
      const current = ++sequence; tween?.kill(); menu.style.pointerEvents = 'none';
      const hide = () => { if (current !== sequence) return; if (popover && menu.matches(':popover-open')) menu.hidePopover(); else if (!popover) menu.hidden = true; window.gsap?.set(menu, { clearProps: 'transform,opacity' }); };
      if (!immediate && document.documentElement.dataset.motion === 'full' && window.gsap) tween = window.gsap.to(menu, { opacity: 0, y: -3, scale: .985, duration: .14, ease: 'power2.in', onComplete: hide });
      else hide();
      if (focus) trigger.focus({ preventScroll: true });
    }
    function choose() {
      if (!rows[index]) return;
      select.value = rows[index].dataset.value; sync();
      select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true }));
      close(true);
    }
    function open() {
      opened?.close(false, true); sequence++; tween?.kill(); menu.replaceChildren();
      rows = [...select.options].filter(option => !option.disabled).map((option, i) => {
        const row = document.createElement('div'); row.className = 'select-option'; row.id = `${menu.id}-${i}`;
        row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(option.selected)); row.dataset.value = option.value;
        const text = document.createElement('span'); text.textContent = option.textContent; row.append(text, createIcon('check'));
        row.addEventListener('pointermove', () => active(i)); row.addEventListener('pointerdown', event => event.preventDefault());
        row.addEventListener('click', () => { index = i; choose(); }); menu.append(row); return row;
      });
      menu.style.pointerEvents = ''; if (popover && !menu.matches(':popover-open')) menu.showPopover(); else if (!popover) menu.hidden = false;
      isOpen = true; opened = api; trigger.setAttribute('aria-expanded', 'true'); position();
      active(Math.max(0, rows.findIndex(row => row.dataset.value === select.value)));
      if (document.documentElement.dataset.motion === 'full' && window.gsap) tween = window.gsap.fromTo(menu, { opacity: 0, y: -5, scale: .985 }, { opacity: 1, y: 0, scale: 1, duration: .22, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
    const api = { sync, close, position, get isOpen() { return isOpen; }, trigger, menu };
    dropdowns.push(api); sync();
    trigger.addEventListener('click', () => isOpen ? close(true) : open());
    trigger.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (!isOpen) { open(); return; }
        if (event.key === 'ArrowDown') active(index + 1);
        if (event.key === 'ArrowUp') active(index - 1);
        if (event.key === 'Home') active(0);
        if (event.key === 'End') active(rows.length - 1);
        if (event.key === 'Enter' || event.key === ' ') choose();
      } else if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') close(false, true);
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        if (!isOpen) open();
        typed = (performance.now() - typedAt < 700 ? typed : '') + event.key.toLocaleLowerCase('vi'); typedAt = performance.now();
        const match = rows.findIndex(row => row.textContent.trim().toLocaleLowerCase('vi').startsWith(typed)); if (match >= 0) active(match);
      }
    });
    select.addEventListener('change', sync); select.form?.addEventListener('reset', () => requestAnimationFrame(sync));
  });
  document.addEventListener('pointerdown', event => { if (opened && !opened.trigger.contains(event.target) && !opened.menu.contains(event.target)) opened.close(); });
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') opened?.close(false, true); });
  document.addEventListener('scroll', () => opened?.position(), true);
  window.addEventListener('resize', () => opened?.close(false, true));
  new MutationObserver(() => { if (document.documentElement.dataset.motion === 'reduced') opened?.close(false, true); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
}
