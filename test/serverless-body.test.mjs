import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleAuth } from "../scripts/google-auth.mjs";

test("body do serverless phân tích vẫn được kiểm tra kích thước và dữ liệu trước khi gửi Google", async () => {
  const origin = "https://vibelog.example";
  const record = { clientId: "client", csrfToken: "csrf", accessToken: "server-token", accessExpiresAt: Date.now() + 3600000 };
  const calls = [];
  const auth = createGoogleAuth({ origin, clientId: "client", clientSecret: "secret",
    store: { get: async () => record },
    fetcher: async (url, options) => { calls.push({ url, options }); return Response.json({ id: "saved" }); } });
  const valid = { id: `vibelog${"a".repeat(64)}`, summary: "Học", start: { dateTime: "2026-10-15T10:00:00+07:00" },
    end: { dateTime: "2026-10-15T10:30:00+07:00" }, extendedProperties: { private: { vibelogId: "study" } } };
  for (const [body, status] of [[valid, 200], [JSON.stringify(valid), 200], [Buffer.from(JSON.stringify(valid)), 200], ["{broken", 400], [{ summary: "x".repeat(65537) }, 413]]) {
    const request = { method: "POST", body, headers: { host: "vibelog.example", origin,
      "x-vibelog-request": "1", "x-vibelog-csrf": "csrf", cookie: `vibelog_session=${"a".repeat(43)}` } };
    const response = { writeHead(code) { this.status = code; }, end(text) { this.text = text; } };
    await auth.handle(request, response, new URL("/api/calendar/events", origin));
    assert.equal(response.status, status);
  }
  assert.equal(calls.length, 3);
});
