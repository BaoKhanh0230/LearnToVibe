export const STORAGE_KEY = "vibelog.entries.v1";
export const WEEKLY_GOAL_KEY = "vibelog.weeklyGoal.v1";
export const REMINDER_KEY = "vibelog.reminder.v1";

export function loadEntries(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function loadWeeklyGoal(storage = localStorage) {
  const value = Number(storage.getItem(WEEKLY_GOAL_KEY));
  return Number.isFinite(value) && value >= 30 && value <= 10080 ? value : 180;
}

export function saveWeeklyGoal(goal, storage = localStorage) {
  storage.setItem(WEEKLY_GOAL_KEY, String(goal));
}

export function loadReminder(storage = localStorage) {
  const fallback = { enabled: false, time: "20:00", days: [1, 2, 3, 4, 5] };
  try {
    const value = JSON.parse(storage.getItem(REMINDER_KEY) ?? "null");
    const validTime = typeof value?.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time);
    const validDays = Array.isArray(value?.days)
      && value.days.length > 0
      && value.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    if (!validTime || !validDays) return fallback;
    return { enabled: value.enabled === true, time: value.time, days: [...new Set(value.days)] };
  } catch {
    return fallback;
  }
}

export function saveReminder(reminder, storage = localStorage) {
  storage.setItem(REMINDER_KEY, JSON.stringify(reminder));
}

export function isReminderDue(reminder, now = new Date(), lastShownDate = null) {
  if (!reminder.enabled || !reminder.days.includes(now.getDay())) return false;
  const [hour, minute] = reminder.time.split(":").map(Number);
  const isPastReminderTime = now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);
  return isPastReminderTime && lastShownDate !== toLocalDateKey(now);
}

export function filterEntries(entries, query = "", mood = "all", topic = "all") {
  const normalizedQuery = normalizeText(query.trim());

  return entries.filter((entry) => {
    const matchesMood = mood === "all" || entry.mood === mood;
    const entryTopic = entry.topic ?? "other";
    const matchesTopic = topic === "all" || entryTopic === topic;
    const searchableText = normalizeText(
      `${entry.title ?? ""} ${entry.learning ?? ""} ${(entry.tags ?? []).join(" ")}`,
    );
    const matchesQuery = normalizedQuery === "" || searchableText.includes(normalizedQuery);
    return matchesMood && matchesTopic && matchesQuery;
  });
}

export function parseTags(value) {
  const uniqueTags = new Map();
  String(value)
    .split(",")
    .map((tag) => tag.trim().replace(/^#+/, "").slice(0, 30))
    .filter(Boolean)
    .forEach((tag) => {
      const key = normalizeText(tag);
      if (!uniqueTags.has(key) && uniqueTags.size < 8) uniqueTags.set(key, tag);
    });
  return [...uniqueTags.values()];
}

function normalizeText(value) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function calculateStats(entries, now = new Date()) {
  const uniqueDays = new Set(entries.map((entry) => entry.createdAt.slice(0, 10)));
  let streak = 0;
  const cursor = new Date(now);

  for (;;) {
    const day = toLocalDateKey(cursor);
    if (!uniqueDays.has(day)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    sessions: entries.length,
    minutes: entries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0),
    streak,
  };
}

export function calculateWeeklyProgress(entries, goal, now = new Date()) {
  const startOfWeek = new Date(now);
  const daysSinceMonday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfNextWeek = new Date(startOfWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

  const minutes = entries.reduce((total, entry) => {
    const createdAt = new Date(entry.createdAt);
    const isThisWeek = createdAt >= startOfWeek && createdAt < startOfNextWeek;
    return isThisWeek ? total + Number(entry.minutes || 0) : total;
  }, 0);

  return {
    minutes,
    percent: Math.min(100, Math.round((minutes / goal) * 100)),
    remaining: Math.max(0, goal - minutes),
  };
}

export function calculateLearningInsights(entries, now = new Date()) {
  const days = [];
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);

  const startOfWeek = new Date(cursor);
  const daysSinceMonday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + offset);
    days.push({ date: toLocalDateKey(date), minutes: 0 });
  }

  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const topicMinutes = new Map();

  entries.forEach((entry) => {
    const createdAt = new Date(entry.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const day = daysByDate.get(toLocalDateKey(createdAt));
    if (!day) return;

    const minutes = Number(entry.minutes || 0);
    day.minutes += minutes;
    const topic = entry.topic ?? "other";
    topicMinutes.set(topic, (topicMinutes.get(topic) ?? 0) + minutes);
  });

  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const bestDay = days.reduce((best, day) => (day.minutes > best.minutes ? day : best), days[0]);
  const topTopic = [...topicMinutes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    days,
    total,
    average: Math.round(total / 7),
    bestDay: bestDay.minutes > 0 ? bestDay : null,
    topTopic,
  };
}

export function createBackup(entries, exportedAt = new Date()) {
  return {
    app: "VibeLog",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    entries,
  };
}

export function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

