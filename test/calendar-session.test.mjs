import test from "node:test";
import assert from "node:assert/strict";
import { PersistentGoogleCalendar } from "../src/calendar-session.js";

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("khôi phục phiên tự động và đọc lịch qua máy chủ, không gửi token Google từ trình duyệt", async () => {
  const calls = [];
  let changed = 0;
  const calendar = new PersistentGoogleCalendar({ onChange: () => changed++, fetcher: async (url, options) => {
    calls.push({ url, options });
    return response(url === "/api/auth/status" ? { configured: true, connected: true, csrfToken: "csrf" } : { items: [{ id: "event" }] });
  } });
  await calendar.restore();
  assert.equal(calendar.connected, true);
  assert.equal(changed, 1);
  assert.deepEqual(await calendar.listWeek(new Date("2026-10-12T00:00:00Z"), new Date("2026-10-19T00:00:00Z")), [{ id: "event" }]);
  assert.match(calls[1].url, /^\/api\/calendar\/events\?/);
  assert.equal(calls[1].options.credentials, "same-origin");
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test("refresh token không còn hợp lệ thì cập nhật trạng thái ngắt kết nối", async () => {
  const calendar = new PersistentGoogleCalendar({ fetcher: async url => url === "/api/auth/status" ? response({ configured: true, connected: true, csrfToken: "csrf" }) : response({ error: "Kết nối lại Google." }, 401) });
  await calendar.restore();
  await assert.rejects(calendar.listWeek(new Date(), new Date(Date.now() + 86400000)), /Kết nối lại/);
  assert.equal(calendar.connected, false);
  assert.equal(calendar.token, null);
});

test("ngắt kết nối lỗi mạng không đánh dấu đã ngắt khi máy chủ chưa xác nhận", async () => {
  const calendar = new PersistentGoogleCalendar({ fetcher: async url => url === "/api/auth/status" ? response({ configured: true, connected: true, csrfToken: "csrf" }) : response({ error: "Thử lại." }, 502) });
  await calendar.restore();
  await assert.rejects(calendar.disconnect(), /Thử lại/);
  assert.equal(calendar.connected, true);
});

test("trang tĩnh hoặc máy chủ cũ báo cần chạy máy chủ mới", async () => {
  const calendar = new PersistentGoogleCalendar({ fetcher: async () => new Response("Not found", { status: 404 }) });
  await assert.rejects(calendar.restore(), /npm start/);
});
