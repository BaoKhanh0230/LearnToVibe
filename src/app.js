import {
  calculateStats,
  calculateLearningInsights,
  calculateWeeklyProgress,
  createBackup,
  filterEntries,
  loadEntries,
  loadReminder,
  loadWeeklyGoal,
  parseTags,
  isReminderDue,
  saveEntries,
  saveReminder,
  saveWeeklyGoal,
  toLocalDateKey,
} from "./store.js";
import { animateChartBars, animateContent, initializeMotion, resolveMotionPreference, scrollToTop } from "./animations.js";
import { sessionRange, toDateTimeInput } from "./calendar.js";
import { initializeCalendarUI } from "./calendar-ui.js";
import { updateMetric } from "./design-effects.js";
import { createIcon, initializeIcons } from "./icons.js";
import { initializeNotifications, notify, confirmAction } from "./notifications.js";
import { initializeCommandPalette } from "./command-palette.js";
import { initializeFormValidation } from "./form-validation.js";
import { initializeDropdowns, syncDropdowns } from "./dropdowns.js";
import { initializeAccount } from './account.js';

await initializeAccount();

const moodLabels = {
  flow: "✨ Vào guồng",
  curious: "🧭 Tò mò",
  stuck: "🧩 Hơi bí",
  proud: "🚀 Tự hào",
};

const topicLabels = {
  frontend: "Giao diện",
  backend: "Backend",
  data: "Dữ liệu",
  tools: "Git & Công cụ",
  design: "Thiết kế / UX",
  other: "Khác",
};

const form = document.querySelector("#entry-form");
const list = document.querySelector("#entry-list");
const searchInput = document.querySelector("#search-entry");
const moodFilter = document.querySelector("#mood-filter");
const topicFilter = document.querySelector("#topic-filter");
const cancelEditButton = document.querySelector("#cancel-edit");
const clearFiltersButton = document.querySelector("#clear-filters");
const goalInput = document.querySelector("#weekly-goal-input");
const backupButton = document.querySelector("#backup-data");
const motionToggle = document.querySelector("#motion-toggle");
const reminderEnabled = document.querySelector("#reminder-enabled");
const reminderTime = document.querySelector("#reminder-time");
const reminderDayButtons = [...document.querySelectorAll("[data-reminder-day]")];
let entries = loadEntries();
let weeklyGoal = loadWeeklyGoal();
let reminder = loadReminder();
let editingId = null;
initializeIcons();
initializeNotifications();
initializeFormValidation();
initializeDropdowns();
const calendarUI = initializeCalendarUI(showToast);
initializeCommandPalette({
  getEntries: () => entries,
  getCommands: () => [
    { id: 'new', title: 'Ghi nhật ký học', keywords: 'them moi phien', icon: 'plus', run: () => jumpTo('#new-entry', form.elements.title) },
    { id: 'calendar', title: 'Xem lịch tuần', keywords: 'google calendar', icon: 'calendar', run: () => jumpTo('#study-calendar', document.querySelector('#calendar-week-today')) },
    { id: 'plan', title: 'Hẹn buổi học tiếp theo', keywords: 'dat lich ke hoach', icon: 'calendar', run: () => jumpTo('#plan-form', document.querySelector('#plan-form').elements.title) },
    { id: 'search', title: 'Tìm trong nhật ký', keywords: 'tim kiem loc', icon: 'search', run: () => jumpTo('.journal-panel', searchInput) },
    { id: 'backup', title: 'Sao lưu nhật ký', keywords: 'tai json xuat du lieu', icon: 'download', disabled: entries.length === 0, run: () => backupButton.click() },
    { id: 'motion', title: document.documentElement.dataset.motion === 'full' ? 'Giảm chuyển động' : 'Bật chuyển động', keywords: 'animation hieu ung', icon: 'waves', run: () => motionToggle.click() },
  ],
  showEntry(id) {
    searchInput.value = '';
    moodFilter.value = 'all'; topicFilter.value = 'all'; renderEntries();
    const card = [...list.children].find(item => item.dataset.entryId === id);
    if (card) jumpTo(card, card);
  },
});

function jumpTo(target, focus) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  element?.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'full' ? 'smooth' : 'instant', block: 'start' });
  focus?.focus({ preventScroll: true });
}
form.elements.startedAt.value = toDateTimeInput(new Date(Date.now() - 30 * 60000));

goalInput.value = weeklyGoal;
renderMotionToggle();
renderReminderSettings();

document.querySelector("#today").textContent = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const existingEntry = entries.find((entry) => entry.id === editingId);
  let range;
  try {
    range = sessionRange(data.get("startedAt"), data.get("minutes"));
    if (new Date(range.endedAt).getTime() > Date.now()) throw new Error("Phiên đã học không thể kết thúc trong tương lai. Dùng form hẹn buổi học để đặt lịch mới.");
  } catch (error) { showToast(error.message, { kind: 'error' }); return; }
  const updatedEntry = {
    id: editingId ?? crypto.randomUUID(),
    title: data.get("title").trim(),
    minutes: Number(data.get("minutes")),
    mood: data.get("mood"),
    topic: data.get("topic"),
    tags: parseTags(data.get("tags")),
    learning: data.get("learning").trim(),
    createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
    ...range,
  };

  entries = editingId
    ? entries.map((entry) => (entry.id === editingId ? updatedEntry : entry))
    : [updatedEntry, ...entries];
  saveEntries(entries);
  resetForm();
  render();
  showToast(existingEntry ? "Đã cập nhật nhật ký." : "Đã lưu phiên học vào nhật ký.", { kind: 'success' });
  calendarUI.syncAfterSave(updatedEntry);
});

list.addEventListener("click", async (event) => {
  const syncButton = event.target.closest("[data-calendar-id]");
  if (syncButton) {
    const entry = entries.find((item) => item.id === syncButton.dataset.calendarId);
    if (entry) calendarUI.sync(entry, "learned", syncButton);
    return;
  }
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    startEditing(editButton.dataset.editId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (!deleteButton) return;
  const entry = entries.find((item) => item.id === deleteButton.dataset.deleteId);
  if (!entry || !await confirmAction(`Xóa phiên học “${entry.title}” khỏi VibeLog? Thao tác này không thể hoàn tác. Sự kiện trên Google Calendar vẫn được giữ.`)) return;

  entries = entries.filter((item) => item.id !== entry.id);
  if (editingId === entry.id) resetForm();
  saveEntries(entries);
  render();
  showToast('Đã xóa phiên học khỏi VibeLog.', { kind: 'success' });
});

searchInput.addEventListener("input", renderEntries);
moodFilter.addEventListener("change", renderEntries);
topicFilter.addEventListener("change", renderEntries);
cancelEditButton.addEventListener("click", resetForm);
clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  moodFilter.value = "all";
  topicFilter.value = "all";
  searchInput.focus();
  renderEntries();
});

goalInput.addEventListener("change", () => {
  const nextGoal = Number(goalInput.value);
  if (!Number.isFinite(nextGoal) || nextGoal < 30 || nextGoal > 10080) {
    goalInput.value = weeklyGoal;
    showToast("Mục tiêu cần nằm trong khoảng 30–10.080 phút.", { kind: 'error' });
    return;
  }

  weeklyGoal = nextGoal;
  saveWeeklyGoal(weeklyGoal);
  renderWeeklyGoal();
  showToast("Đã cập nhật mục tiêu tuần.");
});

backupButton.addEventListener("click", () => {
  if (entries.length === 0) return;
  const backup = createBackup(entries);
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const download = document.createElement("a");
  download.href = url;
  download.download = `vibelog-backup-${toLocalDateKey(new Date())}.json`;
  download.click();
  URL.revokeObjectURL(url);
  showToast(`Đã sao lưu ${entries.length} phiên học.`);
});

document.querySelector("#back-to-top").addEventListener("click", scrollToTop);

motionToggle.addEventListener("click", () => {
  const nextMotion = document.documentElement.dataset.motion === "full" ? "reduced" : "full";
  localStorage.setItem("vibelog.motion.v1", nextMotion);
  document.documentElement.dataset.motion = nextMotion;
  renderMotionToggle();
  initializeMotion();
  showToast(nextMotion === "full" ? "Đã bật chuyển động." : "Đã giảm chuyển động.");
});

window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  if (localStorage.getItem("vibelog.motion.v1") !== null) return;
  document.documentElement.dataset.motion = resolveMotionPreference(null, event.matches);
  initializeMotion();
  renderMotionToggle();
});

reminderEnabled.addEventListener("change", async () => {
  reminder.enabled = reminderEnabled.checked;
  if (reminder.enabled && "Notification" in window && Notification.permission === "default") {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") showToast("Lịch vẫn được lưu, nhưng trình duyệt chưa cho phép thông báo hệ thống.");
    } catch {
      showToast("Không thể bật thông báo hệ thống; VibeLog vẫn sẽ nhắc khi trang đang mở.");
    }
  }
  saveReminder(reminder);
  renderReminderSettings();
  checkReminder();
});

reminderTime.addEventListener("change", () => {
  if (!reminderTime.value) return;
  reminder.time = reminderTime.value;
  saveReminder(reminder);
  renderReminderSettings();
  showToast("Đã cập nhật giờ nhắc học.");
});

reminderDayButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const day = Number(button.dataset.reminderDay);
    const nextDays = reminder.days.includes(day)
      ? reminder.days.filter((item) => item !== day)
      : [...reminder.days, day];
    if (nextDays.length === 0) {
      showToast("Hãy giữ lại ít nhất một ngày nhắc học.");
      return;
    }
    reminder.days = nextDays;
    saveReminder(reminder);
    renderReminderSettings();
  });
});

function render() {
  renderEntries();
  renderWeeklyGoal();
  renderLearningInsights();
  const stats = calculateStats(entries);
  updateMetric(document.querySelector("#total-sessions"), stats.sessions);
  updateMetric(document.querySelector("#total-minutes"), stats.minutes);
  updateMetric(document.querySelector("#current-streak"), stats.streak);
}

function renderLearningInsights() {
  const insights = calculateLearningInsights(entries);
  const maxMinutes = Math.max(...insights.days.map((day) => day.minutes), 0);
  const chart = document.querySelector("#learning-chart");
  chart.replaceChildren();

  insights.days.forEach((day) => {
    const date = new Date(`${day.date}T12:00:00`);
    const column = document.createElement("div");
    column.className = "chart-column";
    const value = createElement("span", "chart-value", day.minutes > 0 ? String(day.minutes) : "");
    const barSlot = document.createElement("div");
    barSlot.className = "chart-bar-slot";
    const bar = document.createElement("span");
    bar.className = "chart-bar";
    bar.style.height = day.minutes === 0 || maxMinutes === 0
      ? "0"
      : `${Math.max(7, (day.minutes / maxMinutes) * 100)}%`;
    bar.title = `${formatChartDate(date)}: ${day.minutes} phút`;
    barSlot.append(bar);
    const label = createElement("span", "chart-label", new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date));
    column.append(value, barSlot, label);
    chart.append(column);
  });

  document.querySelector("#insight-total").textContent = insights.total;
  document.querySelector("#insight-average").textContent = insights.average;
  document.querySelector("#insight-best-day").textContent = insights.bestDay
    ? `${formatChartDate(new Date(`${insights.bestDay.date}T12:00:00`))} · ${insights.bestDay.minutes} phút`
    : "Chưa có";
  document.querySelector("#insight-top-topic").textContent = insights.topTopic
    ? topicLabels[insights.topTopic] ?? topicLabels.other
    : "Chưa có";
  document.querySelector("#chart-description").textContent = insights.total > 0
    ? `${insights.days.filter((day) => day.minutes > 0).length} ngày có hoạt động trong tuần này.`
    : "Thêm phiên học để biểu đồ bắt đầu chuyển động.";
  animateChartBars();
}

function renderWeeklyGoal() {
  const progress = calculateWeeklyProgress(entries, weeklyGoal);
  updateMetric(document.querySelector("#hero-week-minutes"), progress.minutes);
  document.querySelector("#hero-week-percent").textContent = `${progress.percent}%`;
  document.querySelector("#hero-focus-progress").style.width = `${progress.percent}%`;
  document.querySelector("#weekly-minutes").textContent = progress.minutes;
  document.querySelector("#weekly-goal-value").textContent = weeklyGoal;
  document.querySelector("#weekly-progress").style.width = `${progress.percent}%`;
  const progressTrack = document.querySelector(".progress-track");
  progressTrack.setAttribute("aria-valuenow", progress.percent);
  document.querySelector("#weekly-message").textContent = progress.remaining === 0
    ? "Hoàn thành mục tiêu — tuyệt lắm! Bạn có thể nghỉ ngơi không áy náy."
    : `Còn ${progress.remaining} phút để hoàn thành mục tiêu tuần.`;
  backupButton.disabled = entries.length === 0;
}

function renderEntries() {
  syncDropdowns();
  list.replaceChildren();
  const visibleEntries = filterEntries(entries, searchInput.value, moodFilter.value, topicFilter.value);
  const hasFilters = searchInput.value.trim() !== "" || moodFilter.value !== "all" || topicFilter.value !== "all";
  document.querySelector("#results-count").textContent = `${visibleEntries.length}/${entries.length} phiên học`;
  clearFiltersButton.hidden = !hasFilters;

  if (visibleEntries.length === 0) {
    const emptyState = document.querySelector("#empty-state-template").content.cloneNode(true);
    if (hasFilters) {
      emptyState.querySelector("h3").textContent = "Chưa tìm thấy phiên học phù hợp";
      emptyState.querySelector("p").textContent = "Thử một từ khóa khác hoặc xóa bộ lọc để xem toàn bộ nhật ký.";
    }
    list.append(emptyState);
    return;
  }

  visibleEntries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "entry-card";
    card.dataset.spotlight = "";
    card.dataset.entryId = entry.id;
    card.tabIndex = -1;

    const meta = document.createElement("div");
    meta.className = "entry-meta";
    meta.append(
      createElement("span", "topic-badge", topicLabels[entry.topic ?? "other"] ?? topicLabels.other),
      createElement("span", "mood", moodLabels[entry.mood] ?? "Một ngày mới"),
      createElement("span", "", `${entry.minutes} phút`),
      createElement("span", "", formatDate(entry.createdAt)),
    );

    const title = createElement("h3", "", entry.title);
    if (entry.startedAt) {
      const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
      const range = sessionRange(entry.startedAt, entry.minutes);
      meta.append(createElement("span", "", `${timeFormat.format(new Date(range.startedAt))} → ${timeFormat.format(new Date(range.endedAt))}`));
    }
    const learning = createElement("p", "", entry.learning);
    const tags = document.createElement("div");
    tags.className = "tag-list";
    (entry.tags ?? []).forEach((tag) => tags.append(createElement("span", "tag", `#${tag}`)));
    const actions = document.createElement("div");
    actions.className = "entry-actions";
    const syncButton = createElement("button", "edit-button", entry.startedAt ? "Gửi / cập nhật lịch" : "Bổ sung giờ học để gửi lịch");
    syncButton.type = "button";
    syncButton.prepend(createIcon('calendar'));
    if (entry.startedAt) syncButton.dataset.calendarId = entry.id;
    else syncButton.dataset.editId = entry.id;
    actions.append(syncButton);
    const editButton = createElement("button", "edit-button", "Sửa");
    editButton.type = "button";
    editButton.prepend(createIcon('edit'));
    editButton.dataset.editId = entry.id;
    editButton.setAttribute("aria-label", `Sửa phiên học ${entry.title}`);
    const deleteButton = createElement("button", "delete-button", "Xóa");
    deleteButton.type = "button";
    deleteButton.prepend(createIcon('trash'));
    deleteButton.dataset.deleteId = entry.id;
    deleteButton.setAttribute("aria-label", `Xóa phiên học ${entry.title}`);
    actions.append(editButton, deleteButton);

    card.append(meta, title, learning);
    if (tags.childElementCount > 0) card.append(tags);
    card.append(actions);
    list.append(card);
  });
  animateContent([...list.children].slice(0, 8));
}

function startEditing(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  form.elements.title.value = entry.title;
  form.elements.minutes.value = entry.minutes;
  form.elements.mood.value = entry.mood;
  form.elements.topic.value = entry.topic ?? "other";
  form.elements.tags.value = (entry.tags ?? []).join(", ");
  form.elements.learning.value = entry.learning;
  form.elements.startedAt.value = entry.startedAt ? toDateTimeInput(entry.startedAt) : "";
  syncDropdowns();
  document.querySelector("#form-eyebrow").textContent = "Đang chỉnh sửa";
  document.querySelector("#form-title").textContent = "Cập nhật phiên học";
  document.querySelector("#submit-label").textContent = "Lưu thay đổi";
  cancelEditButton.hidden = false;
  document.querySelector("#new-entry").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => form.elements.title.focus(), 450);
}

function resetForm() {
  editingId = null;
  form.reset();
  form.elements.minutes.value = 30;
  syncDropdowns();
  form.elements.startedAt.value = toDateTimeInput(new Date(Date.now() - 30 * 60000));
  document.querySelector("#form-eyebrow").textContent = "Check-in";
  document.querySelector("#form-title").textContent = "Thêm một phiên học";
  document.querySelector("#submit-label").textContent = "Lưu vào nhật ký";
  cancelEditButton.hidden = true;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date));
}

function formatChartDate(date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "numeric" }).format(date);
}

function renderMotionToggle() {
  const motionIsEnabled = document.documentElement.dataset.motion === "full";
  motionToggle.setAttribute("aria-pressed", String(motionIsEnabled));
  motionToggle.setAttribute(
    "aria-label",
    motionIsEnabled ? "Tắt chuyển động nâng cao" : "Bật chuyển động nâng cao",
  );
  motionToggle.title = motionIsEnabled
    ? "Chuyển động đang bật"
    : "Chuyển động đang tắt — nhấn để trải nghiệm animation";
}

function renderReminderSettings() {
  reminderEnabled.checked = reminder.enabled;
  reminderTime.value = reminder.time;
  reminderDayButtons.forEach((button) => {
    const selected = reminder.days.includes(Number(button.dataset.reminderDay));
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const orderedDays = [1, 2, 3, 4, 5, 6, 0].filter((day) => reminder.days.includes(day));
  document.querySelector("#reminder-status").textContent = reminder.enabled
    ? `${reminder.time} · ${orderedDays.map((day) => dayNames[day]).join(", ")}`
    : "Chưa bật lịch nhắc";
}

function checkReminder() {
  const now = new Date();
  const lastShownDate = localStorage.getItem("vibelog.reminderLastShown.v1");
  if (!isReminderDue(reminder, now, lastShownDate)) return;

  localStorage.setItem("vibelog.reminderLastShown.v1", toLocalDateKey(now));
  showToast("Đến giờ dành một chút thời gian cho phiên học hôm nay ✦");
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("VibeLog nhắc bạn", {
      body: "Đến giờ dành một chút thời gian cho phiên học hôm nay ✦",
      icon: "image/Doro.jpg",
    });
  }
}

function showToast(message, options) { notify(message, options); }

render();
initializeMotion();
checkReminder();
window.setInterval(checkReminder, 30_000);

if (document.documentElement.dataset.motion === "reduced") {
  window.setTimeout(() => {
    showToast("Thiết bị đang giảm chuyển động. Nhấn nút 〰 trên thanh điều hướng để bật animation.");
  }, 700);
}

