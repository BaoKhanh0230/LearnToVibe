// Learning data is selected before app initialization. Motion remains device-specific.
export const USER_KEYS = ['vibelog.entries.v1', 'vibelog.plans.v1', 'vibelog.weeklyGoal.v1', 'vibelog.reminder.v1', 'vibelog.calendarAuto.v1', 'vibelog.profile.v1'];
let active;
export const userStorage = {
  getItem(key) { return (active ?? globalThis.localStorage).getItem(key); },
  setItem(key, value) { return (active ?? globalThis.localStorage).setItem(key, value); },
};
export function setUserStorage(storage) { active = storage; }

export function mergeLegacy(cloud, legacy) {
  const next = { ...cloud };
  for (const key of USER_KEYS) {
    if (legacy[key] === undefined) continue;
    if (key.includes('entries') || key.includes('plans')) {
      const rows = JSON.parse(cloud[key] ?? '[]');
      const ids = new Set(rows.map(row => row.id));
      next[key] = JSON.stringify([...rows, ...JSON.parse(legacy[key]).filter(row => !ids.has(row.id))]);
    } else if (next[key] === undefined) next[key] = legacy[key];
  }
  return next;
}
