import test from "node:test";
import assert from "node:assert/strict";
import { calculateStats, loadEntries, saveEntries, STORAGE_KEY } from "../src/store.js";

function memoryStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(STORAGE_KEY, initialValue);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("lưu và đọc danh sách phiên học", () => {
  const storage = memoryStorage();
  const entries = [{ id: "1", title: "Học HTML" }];
  saveEntries(entries, storage);
  assert.deepEqual(loadEntries(storage), entries);
});

test("dữ liệu hỏng được coi là danh sách trống", () => {
  assert.deepEqual(loadEntries(memoryStorage("không-phải-json")), []);
});

test("tính tổng phiên, phút và chuỗi ngày", () => {
  const entries = [
    { minutes: 25, createdAt: "2026-10-12T02:00:00.000Z" },
    { minutes: 40, createdAt: "2026-10-11T02:00:00.000Z" },
    { minutes: 15, createdAt: "2026-10-11T08:00:00.000Z" },
  ];
  assert.deepEqual(calculateStats(entries, new Date(2026, 9, 12)), {
    sessions: 3,
    minutes: 80,
    streak: 2,
  });
});

