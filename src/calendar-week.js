import { toLocalDateKey } from "./store.js";
import { toDateTimeInput } from "./calendar.js";
import { animateContent } from "./animations.js";

export function layoutDayEvents(day) {
  const segments = day.events.filter((event) => event.start?.dateTime).map((event) => {
    const from = new Date(event.start.dateTime);
    const to = new Date(event.end.dateTime);
    const start = from < day.date ? 0 : from.getHours() * 60 + from.getMinutes();
    const end = to >= day.next ? 1440 : to.getHours() * 60 + to.getMinutes();
    return { event, start, end, visualEnd: Math.min(1440, Math.max(end, start + 24)) };
  }).sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster = [];
  let clusterEnd = -1;
  function finish() {
    const lanes = [];
    for (const item of cluster) {
      let lane = lanes.findIndex((end) => end <= item.start);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = item.visualEnd;
      item.lane = lane;
    }
    for (const item of cluster) item.lanes = lanes.length;
  }
  for (const item of segments) {
    if (item.start >= clusterEnd) { finish(); cluster = []; clusterEnd = -1; }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.visualEnd);
  }
  finish();
  return segments;
}

export function weekRange(value = new Date(), offset = 0) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7 + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function groupWeekEvents(events, start) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const key = toLocalDateKey(date);
    const nextKey = toLocalDateKey(next);
    const items = events.filter((event) => {
      if (event.status === "cancelled") return false;
      if (event.start?.date) return event.start.date < nextKey && event.end?.date > key;
      const from = new Date(event.start?.dateTime);
      const to = new Date(event.end?.dateTime);
      return from < next && (to > date || (to.getTime() === from.getTime() && from >= date));
    }).sort((a, b) => {
      if (Boolean(a.start.date) !== Boolean(b.start.date)) return a.start.date ? -1 : 1;
      return a.start.date ? a.start.date.localeCompare(b.start.date) : new Date(a.start.dateTime) - new Date(b.start.dateTime);
    });
    return { date, next, key, events: items };
  });
}

export function initializeWeekCalendar(calendar) {
  const grid = document.querySelector("#calendar-week-grid");
  const status = document.querySelector("#calendar-week-status");
  const heading = document.querySelector("#calendar-week-range");
  const refreshButton = document.querySelector("#calendar-week-refresh");
  const viewport = document.querySelector(".calendar-week-scroll");
  const dialog = document.querySelector("#calendar-event-dialog");
  let selected = weekRange().start;
  let revision = 0;
  const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dayFormat = new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
  const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const create = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };

  function openEvent(event) {
    document.querySelector("#calendar-event-title").textContent = event.summary || "Không có tiêu đề";
    document.querySelector("#calendar-event-time").textContent = event.start.date
      ? `Cả ngày · ${event.start.date}`
      : `${dayFormat.format(new Date(event.start.dateTime))} · ${timeFormat.format(new Date(event.start.dateTime))} – ${dateFormat.format(new Date(event.end.dateTime))} ${timeFormat.format(new Date(event.end.dateTime))}`;
    document.querySelector("#calendar-event-location").textContent = event.location || "";
    const description = document.querySelector("#calendar-event-description");
    // Google descriptions may contain HTML. Extract text without inserting remote markup.
    description.textContent = event.description ? new DOMParser().parseFromString(event.description, "text/html").body.textContent : "Không có ghi chú.";
    dialog.showModal();
    animateContent(dialog, { distance: 8, stagger: 0 });
  }
  document.querySelector("#calendar-event-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });

  function eventButton(event, text, className) {
    const button = create("button", className, "");
    button.type = "button";
    button.append(create("strong", "", event.summary || "Không có tiêu đề"), create("span", "calendar-event-time", text));
    button.title = `${event.summary || "Không có tiêu đề"} · ${text}`;
    if (event.extendedProperties?.private?.vibelogId) button.classList.add("is-learning");
    if (/^([1-9]|1[01])$/.test(event.colorId ?? "")) button.dataset.color = event.colorId;
    button.addEventListener("click", () => openEvent(event));
    return button;
  }

  function updateNow() {
    grid.querySelectorAll(".calendar-now-line").forEach((line) => line.remove());
    const now = new Date();
    const column = grid.querySelector(`[data-date="${toLocalDateKey(now)}"]`);
    if (!column) return;
    const line = create("div", "calendar-now-line", "");
    line.style.top = `${(now.getHours() * 60 + now.getMinutes()) / 1440 * 100}%`;
    line.setAttribute("aria-label", `Bây giờ ${timeFormat.format(now)}`);
    column.append(line);
  }

  function render(events) {
    grid.replaceChildren();
    const days = groupWeekEvents(events, selected);
    const zone = new Intl.DateTimeFormat("en", { timeZoneName: "shortOffset" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value ?? "";
    grid.append(create("div", "calendar-grid-corner", zone));
    days.forEach((day) => {
      const header = create("div", "calendar-day-heading", "");
      if (day.key === toLocalDateKey(new Date())) header.classList.add("is-today");
      header.append(create("span", "", new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(day.date)), create("strong", "", String(day.date.getDate())));
      grid.append(header);
    });
    grid.append(create("div", "calendar-all-day-label", "Cả ngày"));
    days.forEach((day) => {
      const cell = create("div", "calendar-all-day", "");
      day.events.filter((event) => event.start.date).forEach((event) => cell.append(eventButton(event, "Cả ngày", "calendar-all-day-event")));
      grid.append(cell);
    });
    const ruler = create("div", "calendar-time-ruler", "");
    for (let hour = 0; hour < 24; hour++) {
      const label = create("span", "", `${String(hour).padStart(2, "0")}:00`);
      label.style.top = `${hour / 24 * 100}%`;
      ruler.append(label);
    }
    grid.append(ruler);
    days.forEach((day) => {
      const column = create("div", "calendar-time-column", "");
      column.dataset.date = day.key;
      column.setAttribute("aria-label", dayFormat.format(day.date));
      layoutDayEvents(day).forEach((item) => {
        const from = new Date(item.event.start.dateTime);
        const to = new Date(item.event.end.dateTime);
        const text = `${from < day.date ? "00:00" : timeFormat.format(from)} – ${to >= day.next ? "24:00" : timeFormat.format(to)}`;
        const button = eventButton(item.event, text, "calendar-timed-event");
        button.style.top = `${item.start / 1440 * 100}%`;
        button.style.height = `${(item.visualEnd - item.start) / 1440 * 100}%`;
        button.style.left = `calc(${item.lane / item.lanes * 100}% + 2px)`;
        button.style.width = `calc(${100 / item.lanes}% - 5px)`;
        if (item.visualEnd - item.start < 40) button.classList.add("is-short");
        column.append(button);
      });
      column.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const box = column.getBoundingClientRect();
        const minutes = Math.min(1425, Math.max(0, Math.floor((event.clientY - box.top) / box.height * 1440 / 15) * 15));
        const date = new Date(day.date); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        const form = document.querySelector("#plan-form");
        form.elements.startedAt.value = toDateTimeInput(date);
        form.elements.minutes.value = 30;
        form.scrollIntoView({ behavior: document.documentElement.dataset.motion === "reduced" ? "auto" : "smooth", block: "center" });
        form.elements.title.focus({ preventScroll: true });
      });
      grid.append(column);
    });
    updateNow();
    animateContent(grid.querySelectorAll(".calendar-timed-event, .calendar-all-day-event"), { distance: 6, stagger: 0.008 });
  }
  window.setInterval(updateNow, 60000);

  async function refresh() {
    const current = ++revision;
    const hadGrid = grid.querySelector(".calendar-time-column");
    const oldScroll = viewport.scrollTop;
    const range = weekRange(selected);
    const last = new Date(range.end);
    last.setDate(last.getDate() - 1);
    heading.textContent = `${dateFormat.format(range.start)} – ${dateFormat.format(last)}`;
    grid.replaceChildren();
    if (dialog.open) dialog.close();
    if (!calendar.connected) {
      grid.setAttribute("aria-busy", "false");
      status.textContent = "Kết nối Google Calendar để xem lịch chính của bạn trong tuần này.";
      return;
    }
    status.textContent = "Đang tải lịch tuần…";
    grid.setAttribute("aria-busy", "true");
    try {
      const events = await calendar.listWeek(range.start, range.end);
      if (current !== revision || !calendar.connected) return;
      render(events);
      viewport.scrollTop = hadGrid ? oldScroll : 7 * 60;
      status.textContent = events.length ? `${events.length} sự kiện trên lịch chính · Bấm sự kiện để xem ghi chú.` : "Tuần này chưa có sự kiện trên lịch chính.";
    } catch (error) {
      if (current !== revision) return;
      status.textContent = `Không tải được lịch: ${error.message} Nhấn Tải lại để thử lại.`;
    } finally {
      if (current === revision) grid.setAttribute("aria-busy", "false");
    }
  }
  document.querySelector("#calendar-week-prev").addEventListener("click", () => { selected = weekRange(selected, -1).start; refresh(); });
  document.querySelector("#calendar-week-next").addEventListener("click", () => { selected = weekRange(selected, 1).start; refresh(); });
  document.querySelector("#calendar-week-today").addEventListener("click", () => { selected = weekRange().start; refresh(); });
  refreshButton.addEventListener("click", refresh);
  refresh();
  return { refresh };
}
