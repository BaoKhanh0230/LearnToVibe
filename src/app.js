import { calculateStats, filterEntries, loadEntries, saveEntries } from "./store.js";

const moodLabels = {
  flow: "✨ Vào guồng",
  curious: "🧭 Tò mò",
  stuck: "🧩 Hơi bí",
  proud: "🚀 Tự hào",
};

const form = document.querySelector("#entry-form");
const list = document.querySelector("#entry-list");
const searchInput = document.querySelector("#search-entry");
const moodFilter = document.querySelector("#mood-filter");
const cancelEditButton = document.querySelector("#cancel-edit");
const clearFiltersButton = document.querySelector("#clear-filters");
let entries = loadEntries();
let editingId = null;

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
cancelEditButton.addEventListener("click", resetForm);
clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  moodFilter.value = "all";
  searchInput.focus();
  renderEntries();
});

function render() {
  renderEntries();
  const stats = calculateStats(entries);
  document.querySelector("#total-sessions").textContent = stats.sessions;
  document.querySelector("#total-minutes").textContent = stats.minutes;
  document.querySelector("#current-streak").textContent = stats.streak;
}

function renderEntries() {
  list.replaceChildren();
  const visibleEntries = filterEntries(entries, searchInput.value, moodFilter.value);
  const hasFilters = searchInput.value.trim() !== "" || moodFilter.value !== "all";
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
      createElement("span", "mood", moodLabels[entry.mood] ?? "Một ngày mới"),
      createElement("span", "", `${entry.minutes} phút`),
      createElement("span", "", formatDate(entry.createdAt)),
    );

    const title = createElement("h3", "", entry.title);
    const learning = createElement("p", "", entry.learning);
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

    card.append(meta, title, learning, actions);
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

render();

