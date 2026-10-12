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
import { animateChartBars, initializeMotion } from "./animations.js";

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
const toast = document.querySelector("#toast");
const themeToggle = document.querySelector("#theme-toggle");
const motionToggle = document.querySelector("#motion-toggle");
const reminderEnabled = document.querySelector("#reminder-enabled");
const reminderTime = document.querySelector("#reminder-time");
const reminderDayButtons = [...document.querySelectorAll("[data-reminder-day]")];
let entries = loadEntries();
let weeklyGoal = loadWeeklyGoal();
let reminder = loadReminder();
let editingId = null;
let toastTimer;

goalInput.value = weeklyGoal;
renderThemeToggle();
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
  const updatedEntry = {
    id: editingId ?? crypto.randomUUID(),
    title: data.get("title").trim(),
    minutes: Number(data.get("minutes")),
    mood: data.get("mood"),
    topic: data.get("topic"),
    tags: parseTags(data.get("tags")),
    learning: data.get("learning").trim(),
    createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
  };

  entries = editingId
    ? entries.map((entry) => (entry.id === editingId ? updatedEntry : entry))
    : [updatedEntry, ...entries];
  saveEntries(entries);
  resetForm();
  render();
});

list.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    startEditing(editButton.dataset.editId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (!deleteButton) return;
  const entry = entries.find((item) => item.id === deleteButton.dataset.deleteId);
  if (!entry || !confirm(`Xóa phiên học “${entry.title}”? Thao tác này không thể hoàn tác.`)) return;

  entries = entries.filter((item) => item.id !== entry.id);
  if (editingId === entry.id) resetForm();
  saveEntries(entries);
  render();
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
    showToast("Mục tiêu cần nằm trong khoảng 30–10.080 phút.");
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

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.classList.add("theme-transition");
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("vibelog.theme.v1", nextTheme);
  renderThemeToggle();
  window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 450);
});

motionToggle.addEventListener("click", () => {
  const nextMotion = document.documentElement.dataset.motion === "full" ? "reduced" : "full";
  localStorage.setItem("vibelog.motion.v1", nextMotion);
  document.documentElement.dataset.motion = nextMotion;
  renderMotionToggle();
  window.location.reload();
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
  document.querySelector("#total-sessions").textContent = stats.sessions;
  document.querySelector("#total-minutes").textContent = stats.minutes;
  document.querySelector("#current-streak").textContent = stats.streak;
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

    const meta = document.createElement("div");
    meta.className = "entry-meta";
    meta.append(
      createElement("span", "topic-badge", topicLabels[entry.topic ?? "other"] ?? topicLabels.other),
      createElement("span", "mood", moodLabels[entry.mood] ?? "Một ngày mới"),
      createElement("span", "", `${entry.minutes} phút`),
      createElement("span", "", formatDate(entry.createdAt)),
    );

    const title = createElement("h3", "", entry.title);
    const learning = createElement("p", "", entry.learning);
    const tags = document.createElement("div");
    tags.className = "tag-list";
    (entry.tags ?? []).forEach((tag) => tags.append(createElement("span", "tag", `#${tag}`)));
    const actions = document.createElement("div");
    actions.className = "entry-actions";
    const editButton = createElement("button", "edit-button", "Sửa");
    editButton.type = "button";
    editButton.dataset.editId = entry.id;
    editButton.setAttribute("aria-label", `Sửa phiên học ${entry.title}`);
    const deleteButton = createElement("button", "delete-button", "Xóa");
    deleteButton.type = "button";
    deleteButton.dataset.deleteId = entry.id;
    deleteButton.setAttribute("aria-label", `Xóa phiên học ${entry.title}`);
    actions.append(editButton, deleteButton);

    card.append(meta, title, learning);
    if (tags.childElementCount > 0) card.append(tags);
    card.append(actions);
    list.append(card);
  });
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

function renderThemeToggle() {
  const isDark = document.documentElement.dataset.theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối");
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

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

render();
initializeMotion();
checkReminder();
window.setInterval(checkReminder, 30_000);

if (document.documentElement.dataset.motion === "reduced") {
  window.setTimeout(() => {
    showToast("Thiết bị đang giảm chuyển động. Nhấn nút 〰 trên thanh điều hướng để bật animation.");
  }, 700);
}

