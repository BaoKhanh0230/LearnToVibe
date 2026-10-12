import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateStats,
  calculateWeeklyProgress,
  createBackup,
  filterEntries,
  loadEntries,
  loadWeeklyGoal,
  saveEntries,
  saveWeeklyGoal,
  STORAGE_KEY,
} from "../src/store.js";

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

test("tìm kiếm không phân biệt chữ hoa, chữ thường và dấu tiếng Việt", () => {
  const entries = [
    { title: "Học JavaScript", learning: "Biết cách lưu dữ liệu", mood: "curious" },
    { title: "Sửa giao diện", learning: "CSS Grid", mood: "flow" },
  ];
  assert.deepEqual(filterEntries(entries, "cach luu", "all"), [entries[0]]);
  assert.deepEqual(filterEntries(entries, "JAVASCRIPT", "all"), [entries[0]]);
});

test("lọc nhật ký theo cảm giác và kết hợp từ khóa", () => {
  const entries = [
    { title: "Học JavaScript", learning: "localStorage", mood: "curious" },
    { title: "Sửa JavaScript", learning: "event", mood: "flow" },
  ];
  assert.deepEqual(filterEntries(entries, "javascript", "flow"), [entries[1]]);
});

test("lưu mục tiêu tuần và dùng giá trị mặc định khi dữ liệu không hợp lệ", () => {
  const storage = memoryStorage();
  assert.equal(loadWeeklyGoal(storage), 180);
  saveWeeklyGoal(240, storage);
  assert.equal(loadWeeklyGoal(storage), 240);
});

test("tính số phút trong tuần bắt đầu từ thứ Hai", () => {
  const entries = [
    { minutes: 45, createdAt: "2026-10-12T03:00:00.000Z" },
    { minutes: 30, createdAt: "2026-10-11T03:00:00.000Z" },
    { minutes: 160, createdAt: "2026-10-15T03:00:00.000Z" },
  ];
  assert.deepEqual(calculateWeeklyProgress(entries, 180, new Date(2026, 9, 12, 12)), {
    minutes: 205,
    percent: 100,
    remaining: 0,
  });
});

test("tạo bản sao có metadata và giữ nguyên nhật ký", () => {
  const entries = [{ id: "1", title: "Học cách backup" }];
  const exportedAt = new Date("2026-10-12T08:00:00.000Z");
  assert.deepEqual(createBackup(entries, exportedAt), {
    app: "VibeLog",
    version: 1,
    exportedAt: "2026-10-12T08:00:00.000Z",
    entries,
  });
});

