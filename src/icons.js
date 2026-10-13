const paths = {
  chevron: ['M6 9l6 6 6-6'],
  search: ['M21 21l-4.5-4.5', 'M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0'],
  plus: ['M12 5v14M5 12h14'],
  calendar: ['M8 2v4m8-4v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3'],
  download: ['M12 3v12m-5-5 5 5 5-5M5 16v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4'],
  waves: ['M2 8c3-6 5 6 8 0s5 6 8 0M2 16c3-6 5 6 8 0s5 6 8 0'],
  check: ['M5 12l4 4L19 6'],
  loader: ['M12 3a9 9 0 1 1-9 9'],
  info: ['M12 11v6m0-10h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'],
  alert: ['M12 8v5m0 3h.01', 'M10.3 3.8 2.5 17.3A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.7L13.7 3.8a2 2 0 0 0-3.4 0'],
  arrowUp: ['M12 19V5m-6 6 6-6 6 6'],
  close: ['M6 6l12 12M6 18 18 6'],
  edit: ['M16 3l5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4'],
  trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'],
};

export function createIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'ui-icon' })) svg.setAttribute(key, value);
  for (const value of paths[name] ?? paths.info) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', value); svg.append(path);
  }
  return svg;
}

export function initializeIcons() {
  document.querySelectorAll('[data-icon]').forEach(element => element.replaceChildren(createIcon(element.dataset.icon)));
}
