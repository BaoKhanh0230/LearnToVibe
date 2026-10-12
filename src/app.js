import { calculateStats, loadEntries, saveEntries } from "./store.js";

const moodLabels = {
  flow: "✨ Vào guồng",
  curious: "🧭 Tò mò",
  stuck: "🧩 Hơi bí",
  proud: "🚀 Tự hào",
};

const form = document.querySelector("#entry-form");
const list = document.querySelector("#entry-list");
let entries = loadEntries();

document.querySelector("#today").textContent = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const entry = {
    id: crypto.randomUUID(),
    title: data.get("title").trim(),
    minutes: Number(data.get("minutes")),
    mood: data.get("mood"),
    learning: data.get("learning").trim(),
    createdAt: new Date().toISOString(),
  };

  entries = [entry, ...entries];
  saveEntries(entries);
  form.reset();
  document.querySelector("#minutes").value = 30;
  render();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  entries = entries.filter((entry) => entry.id !== button.dataset.deleteId);
  saveEntries(entries);
  render();
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
  if (entries.length === 0) {
    const emptyState = document.querySelector("#empty-state-template").content.cloneNode(true);
    list.append(emptyState);
    return;
  }

  entries.forEach((entry) => {
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
    const deleteButton = createElement("button", "delete-button", "×");
    deleteButton.type = "button";
    deleteButton.dataset.deleteId = entry.id;
    deleteButton.setAttribute("aria-label", `Xóa phiên học ${entry.title}`);

    card.append(meta, title, learning, deleteButton);
    list.append(card);
  });
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

