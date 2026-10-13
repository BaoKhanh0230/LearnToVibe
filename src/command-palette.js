import { filterEntries } from './store.js';
import { animateContent } from './animations.js';
import { createIcon } from './icons.js';

const normalize = value => value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

export function commandResults(commands, entries, query) {
  const key = normalize(query.trim());
  const actions = commands.filter(command => !command.disabled && normalize(`${command.title} ${command.keywords ?? ''}`).includes(key));
  const journals = (key ? filterEntries(entries, query) : entries.slice(0, 3)).map(entry => ({ id: `entry:${entry.id}`, entryId: entry.id, title: entry.title, description: `${entry.minutes} phút · Nhật ký học`, icon: 'book' }));
  return [...actions, ...journals].slice(0, 10);
}

export function initializeCommandPalette({ getEntries, getCommands, showEntry }) {
  const dialog = document.querySelector('#command-palette');
  const input = document.querySelector('#command-input');
  const results = document.querySelector('#command-results');
  const count = document.querySelector('#command-count');
  let matches = [];
  let selected = 0;
  function select(index) {
    selected = index;
    for (const [i, row] of [...results.children].entries()) row.setAttribute('aria-selected', String(i === selected));
    const row = results.children[selected];
    if (row) { input.setAttribute('aria-activedescendant', row.id); row.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
    else input.removeAttribute('aria-activedescendant');
  }
  function choose(index) {
    const command = matches[index];
    if (!command) return;
    dialog.close();
    if (command.entryId) showEntry(command.entryId);
    else command.run();
  }
  function render() {
    matches = commandResults(getCommands(), getEntries(), input.value);
    results.replaceChildren();
    matches.forEach((command, index) => {
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'command-result'; row.id = `command-option-${index}`;
      row.setAttribute('role', 'option'); row.tabIndex = -1;
      const label = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = command.title;
      const description = document.createElement('small'); description.textContent = command.description ?? 'Thao tác nhanh';
      label.append(title, description);
      const enter = document.createElement('kbd'); enter.textContent = '↵';
      row.append(createIcon(command.icon), label, enter);
      row.addEventListener('click', () => choose(index));
      row.addEventListener('pointermove', () => select(index));
      results.append(row);
    });
    count.textContent = matches.length ? `${matches.length} kết quả` : 'Không tìm thấy. Thử tên phiên học, tag hoặc thao tác khác.';
    select(0);
  }
  function open() {
    if (dialog.open) { dialog.close(); return; }
    if (document.querySelector('dialog[open]')) return;
    input.value = '';
    dialog.showModal(); render(); input.focus();
    animateContent(dialog, { distance: 8, stagger: 0 });
  }
  document.querySelector('#open-command-palette').addEventListener('click', open);
  document.querySelector('#command-close').addEventListener('click', () => dialog.close());
  input.addEventListener('input', render);
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (matches.length) select((selected + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
    }
    if (event.key === 'Enter') { event.preventDefault(); choose(selected); }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.isComposing) { event.preventDefault(); open(); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}
