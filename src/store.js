export const STORAGE_KEY = "vibelog.entries.v1";

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

export function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

