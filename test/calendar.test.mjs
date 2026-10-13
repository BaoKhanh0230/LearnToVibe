import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendarEvent, calendarEventId, GoogleCalendar, sessionRange, toDateTimeInput } from "../src/calendar.js";
import { calculateLearningInsights, calculateWeeklyProgress } from "../src/store.js";
import { groupWeekEvents, layoutDayEvents, weekRange } from "../src/calendar-week.js";

const session = { id: "b179a45b-3472-4d2d-b01b-dad8184556ef", title: "Học API", startedAt: "2026-10-12T23:45:00+07:00", minutes: 30, learning: "Fetch", tags: ["api"] };

test("giữ đúng khung giờ và offset khi học qua nửa đêm", () => {
  assert.deepEqual(sessionRange(session.startedAt, 30), { startedAt: "2026-10-12T16:45:00.000Z", endedAt: "2026-10-12T17:15:00.000Z" });
  const local = new Date(2026, 9, 12, 23, 45);
  assert.equal(toDateTimeInput(local), "2026-10-12T23:45");
});

test("không suy đoán giờ cho nhật ký cũ hoặc chấp nhận thời lượng sai", () => {
  for (const [time, minutes] of [[undefined, 30], ["invalid", 30], [session.startedAt, 0], [session.startedAt, 601], [session.startedAt, 5.5]]) {
    assert.throws(() => sessionRange(time, minutes));
  }
});

test("buổi tiếp theo có nhắc trước 10 phút, buổi đã học không có lời nhắc", () => {
  assert.deepEqual(buildCalendarEvent(session).reminders, { useDefault: false });
  assert.equal(buildCalendarEvent(session).description, "VibeLog\n\nFetch\n\n#api");
  assert.deepEqual(buildCalendarEvent(session, "planned").reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] });
});

test("ID ổn định, hợp lệ và phân biệt nhật ký với kế hoạch", async () => {
  const id = await calendarEventId(session.id);
  assert.match(id, /^[0-9a-v]{5,1024}$/);
  assert.equal(id, await calendarEventId(session.id));
  assert.notEqual(id, await calendarEventId(session.id, "planned"));
});

function mockCalendar(statuses) {
  const calls = [];
  const calendar = new GoogleCalendar({ fetcher: async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    const status = statuses.shift();
    return { ok: status === 200, status, json: async () => ({ id: "remote" }) };
  } });
  calendar.token = "test-token";
  calendar.expiresAt = Date.now() + 60000;
  return { calendar, calls };
}

test("gửi lại cập nhật cùng sự kiện, không tạo thêm", async () => {
  const { calendar, calls } = mockCalendar([200, 200]);
  await calendar.sync(session);
  await calendar.sync({ ...session, minutes: 45 });
  assert.deepEqual(calls.map((call) => call.method), ["PATCH", "PATCH"]);
  assert.equal(calls[0].url, calls[1].url);
  assert.equal(calls[1].body.end.dateTime, "2026-10-12T17:30:00.000Z");
});

test("sự kiện mới được tạo với ID ổn định sau 404", async () => {
  const { calendar, calls } = mockCalendar([404, 200]);
  await calendar.sync(session);
  assert.deepEqual(calls.map((call) => call.method), ["PATCH", "POST"]);
  assert.equal(calls[1].body.id, await calendarEventId(session.id));
  assert.equal(calls[0].headers.Authorization, "Bearer test-token");
});

test("xung đột tạo sự kiện chuyển sang cập nhật cùng ID", async () => {
  const { calendar, calls } = mockCalendar([404, 409, 200]);
  await calendar.sync(session);
  assert.deepEqual(calls.map((call) => call.method), ["PATCH", "POST", "PATCH"]);
  assert.equal(calls[0].url, calls[2].url);
});

test("hết hạn hoặc thiếu quyền không tạo sự kiện mới", async () => {
  for (const status of [401, 403, 429, 500]) {
    const { calendar, calls } = mockCalendar([status]);
    await assert.rejects(calendar.sync(session));
    assert.equal(calls.length, 1);
    if (status === 401) assert.equal(calendar.connected, false);
  }
  const { calendar, calls } = mockCalendar([]);
  calendar.expiresAt = 0;
  await assert.rejects(calendar.sync(session), /kết nối/);
  assert.equal(calls.length, 0);
});

test("thống kê dựa trên ngày học thực tế khi ghi nhật ký muộn", () => {
  const entry = { ...session, startedAt: new Date(2026, 9, 12, 10).toISOString(), createdAt: new Date(2026, 9, 20, 10).toISOString() };
  const now = new Date(2026, 9, 13);
  assert.equal(calculateWeeklyProgress([entry], 180, now).minutes, 30);
  assert.equal(calculateLearningInsights([entry], now).total, 30);
});

test("fetch mặc định nhận đúng ngữ cảnh toàn cục của trình duyệt", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = function () {
    assert.equal(this, globalThis, "fetch không được gọi với GoogleCalendar làm ngữ cảnh");
    calls++;
    return Promise.resolve({ ok: true, json: async () => ({ id: "remote" }) });
  };
  try {
    const calendar = new GoogleCalendar();
    calendar.token = "token";
    calendar.expiresAt = Date.now() + 60000;
    await calendar.sync(session);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("lịch tuần bắt đầu thứ Hai và chuyển tuần qua năm mới", () => {
  const range = weekRange(new Date(2026, 0, 4, 18));
  assert.equal(toDateTimeInput(range.start), "2025-12-29T00:00");
  assert.equal(toDateTimeInput(range.end), "2026-01-05T00:00");
  assert.equal(toDateTimeInput(weekRange(range.start, 1).start), "2026-01-05T00:00");
  assert.equal(toDateTimeInput(weekRange(range.start, -1).start), "2025-12-22T00:00");
});

test("lịch tuần tải mọi trang, mở rộng lịch lặp và GET không có body", async () => {
  const calls = [];
  const pages = [{ items: [{ id: "one" }], nextPageToken: "next page" }, { items: [{ id: "two" }, { id: "removed", status: "cancelled" }] }];
  const calendar = new GoogleCalendar({ fetcher: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return { ok: true, json: async () => pages.shift() };
  } });
  calendar.token = "token";
  calendar.expiresAt = Date.now() + 60000;
  const range = weekRange(new Date(2026, 9, 13));
  assert.deepEqual(await calendar.listWeek(range.start, range.end, "Asia/Bangkok"), [{ id: "one" }, { id: "two" }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, "GET");
  assert.equal("body" in calls[0].options, false);
  for (const call of calls) {
    assert.equal(call.url.searchParams.get("singleEvents"), "true");
    assert.equal(call.url.searchParams.get("timeMin"), range.start.toISOString());
    assert.equal(call.url.searchParams.get("timeMax"), range.end.toISOString());
    assert.equal(call.url.searchParams.get("timeZone"), "Asia/Bangkok");
  }
  assert.equal(calls[1].url.searchParams.get("pageToken"), "next page");
});

test("chia ngày đúng với sự kiện cả ngày, qua nửa đêm và kết thúc tại biên ngày", () => {
  const range = weekRange(new Date(2026, 9, 13));
  const local = (day, hour) => new Date(2026, 9, day, hour).toISOString();
  const events = [
    { id: "all", start: { date: "2026-10-12" }, end: { date: "2026-10-14" } },
    { id: "night", start: { dateTime: local(12, 23) }, end: { dateTime: local(13, 1) } },
    { id: "boundary", start: { dateTime: local(13, 23) }, end: { dateTime: local(14, 0) } },
    { id: "cancelled", status: "cancelled", start: { date: "2026-10-12" }, end: { date: "2026-10-19" } },
  ];
  const days = groupWeekEvents(events, range.start);
  assert.equal(days.length, 7);
  assert.deepEqual(days[0].events.map((event) => event.id), ["all", "night"]);
  assert.deepEqual(days[1].events.map((event) => event.id), ["all", "night", "boundary"]);
  assert.deepEqual(days[2].events, []);
});

test("không trả lịch cũ khi tài khoản bị thay đổi trong lúc tải", async () => {
  let resolveFetch;
  const calendar = new GoogleCalendar({ fetcher: () => new Promise((resolve) => { resolveFetch = resolve; }) });
  calendar.token = "old";
  calendar.expiresAt = Date.now() + 60000;
  const range = weekRange();
  const loading = calendar.listWeek(range.start, range.end);
  calendar.token = "new";
  resolveFetch({ ok: true, json: async () => ({ items: [{ id: "private-old" }] }) });
  await assert.rejects(loading, /đã thay đổi/);
});

test("lịch trùng giờ được chia cột, lịch liền nhau dùng lại cột", () => {
  const start = new Date(2026, 9, 12);
  const make = (id, hour, minute, duration) => {
    const from = new Date(2026, 9, 12, hour, minute);
    return { id, start: { dateTime: from.toISOString() }, end: { dateTime: new Date(from.getTime() + duration * 60000).toISOString() } };
  };
  const events = [make("a", 9, 0, 120), make("b", 9, 30, 30), make("c", 10, 0, 60), make("d", 11, 0, 30)];
  const layout = layoutDayEvents(groupWeekEvents(events, start)[0]);
  assert.deepEqual(layout.map(({ event, start, lane, lanes }) => [event.id, start, lane, lanes]), [["a", 540, 0, 2], ["b", 570, 1, 2], ["c", 600, 1, 2], ["d", 660, 0, 1]]);
});

test("lịch qua ngày được cắt tại biên, sự kiện rất ngắn vẫn nhìn thấy", () => {
  const start = new Date(2026, 9, 12);
  const events = [
    { id: "night", start: { dateTime: new Date(2026, 9, 11, 23).toISOString() }, end: { dateTime: new Date(2026, 9, 12, 1).toISOString() } },
    { id: "short", start: { dateTime: new Date(2026, 9, 12, 23, 55).toISOString() }, end: { dateTime: new Date(2026, 9, 13, 0).toISOString() } },
  ];
  const layout = layoutDayEvents(groupWeekEvents(events, start)[0]);
  assert.equal(layout[0].start, 0);
  assert.equal(layout[0].end, 60);
  assert.equal(layout[1].visualEnd, 1440);
  assert.equal(layout[1].start, 1435);
});
