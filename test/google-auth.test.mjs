import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { createVibeLogServer } from "../scripts/server.mjs";
import { SessionStore } from "../scripts/session-store.mjs";
import { CALENDAR_SCOPE } from "../src/calendar.js";

const origin = "http://localhost:4173";
const clientId = "test.apps.googleusercontent.com";
const secret = "private-client-secret";
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function setup(t, { configured = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "vibelog-auth-"));
  const directory = join(root, ".vibelog-data");
  writeFileSync(join(root, "index.html"), "VibeLog");
  writeFileSync(join(root, ".env"), "DO_NOT_SERVE_THIS");
  const calls = [];
  let refreshError;
  let refreshCount = 0;
  let api401 = false;
  let revoked = false;
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/token")) {
      const params = new URLSearchParams(options.body);
      assert.equal(params.get("client_secret"), secret);
      if (params.get("grant_type") === "refresh_token") {
        refreshCount++;
        if (refreshError) return jsonResponse({ error: refreshError }, refreshError === "invalid_grant" ? 400 : 503);
        return jsonResponse({ access_token: "refreshed-private-access", expires_in: 3600 });
      }
      assert.ok(params.get("code_verifier"));
      return jsonResponse({ access_token: "private-access", refresh_token: "private-refresh", scope: CALENDAR_SCOPE, expires_in: 3600 });
    }
    if (String(url).endsWith("/revoke")) { revoked = true; return jsonResponse({}); }
    if (api401) { api401 = false; return jsonResponse({ error: "expired" }, 401); }
    if (options.method === "POST" || options.method === "PATCH") return jsonResponse({ id: "saved", summary: JSON.parse(options.body).summary });
    return jsonResponse({ items: [{ id: "event", summary: "Buổi học", start: { dateTime: "2026-10-13T10:00:00+07:00" }, end: { dateTime: "2026-10-13T11:00:00+07:00" } }] });
  };
  let server;
  let port;
  const start = async () => {
    server = createVibeLogServer({ root, origin, clientId: configured ? clientId : undefined, clientSecret: configured ? secret : undefined, dataDirectory: directory, fetcher });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
  };
  await start();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });
  const request = (path, { method = "GET", cookie, csrf, body, external = false, marker = true } = {}) => new Promise((resolve, reject) => {
    const headers = { Host: "localhost:4173", ...(cookie ? { Cookie: cookie } : {}) };
    if (method !== "GET") { headers.Origin = external ? "https://other.example" : origin; if (marker) headers["X-VibeLog-Request"] = "1"; }
    if (csrf) headers["X-VibeLog-CSRF"] = csrf;
    if (body) headers["Content-Type"] = "application/json";
    const req = httpRequest({ hostname: "127.0.0.1", port, path, method, headers }, (res) => {
      let text = "";
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => { let data; try { data = JSON.parse(text); } catch {} resolve({ status: res.statusCode, headers: res.headers, text, data }); });
    });
    req.on("error", reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
  const connect = async () => {
    const response = await request("/api/auth/connect", { method: "POST" });
    assert.equal(response.status, 200);
    const authUrl = new URL(response.data.url);
    const flowCookie = response.headers["set-cookie"][0].split(";")[0];
    const callback = await request(`/api/auth/callback?state=${authUrl.searchParams.get("state")}&code=fake-code`, { cookie: flowCookie });
    assert.equal(callback.status, 303);
    assert.match(callback.headers.location, /google=connected/);
    const sessionHeader = callback.headers["set-cookie"].find(cookie => cookie.startsWith("vibelog_session="));
    const cookie = sessionHeader.split(";")[0];
    const status = await request("/api/auth/status", { cookie });
    return { cookie, csrf: status.data.csrfToken, authUrl, sessionHeader, status, flowCookie };
  };
  return {
    request, connect, calls, directory,
    setRefreshError: value => { refreshError = value; }, setApi401: () => { api401 = true; },
    get refreshCount() { return refreshCount; }, get revoked() { return revoked; },
    restart: async () => { await new Promise(resolve => server.close(resolve)); await start(); },
    expireAccess: () => { const store = new SessionStore(directory); for (const [id, record] of Object.entries(store.sessions)) store.set(id, { ...record, accessExpiresAt: 0 }); },
  };
}

test("đăng nhập offline, cookie HttpOnly và không lộ token ở giao diện hoặc file lưu", async t => {
  const app = await setup(t);
  const session = await app.connect();
  assert.equal(session.authUrl.searchParams.get("access_type"), "offline");
  assert.equal(session.authUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(session.status.data.loginConfig.clientId, session.authUrl.searchParams.get("client_id"));
  assert.equal(session.status.data.loginConfig.redirectUri, session.authUrl.searchParams.get("redirect_uri"));
  assert.match(session.sessionHeader, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=/);
  assert.equal(session.status.data.connected, true);
  assert.equal(session.status.headers["cache-control"], "no-store");
  for (const secretValue of ["private-access", "private-refresh", secret]) {
    assert.equal(session.status.text.includes(secretValue), false);
    assert.equal(readFileSync(join(app.directory, "sessions.enc")).includes(Buffer.from(secretValue)), false);
  }
});

test("reload và khởi động lại máy chủ khôi phục đúng kết nối, phiên khác không thấy lịch", async t => {
  const app = await setup(t);
  const session = await app.connect();
  await app.restart();
  const status = await app.request("/api/auth/status", { cookie: session.cookie });
  assert.equal(status.data.connected, true);
  const events = await app.request("/api/calendar/events?singleEvents=true", { cookie: session.cookie });
  assert.equal(events.status, 200);
  assert.equal(events.data.items.length, 1);
  assert.equal((await app.request("/api/auth/status")).data.connected, false);
  assert.equal((await app.request("/api/calendar/events")).status, 401);
});

test("tự gia hạn access token hết hạn, nhiều yêu cầu chỉ gia hạn một lần", async t => {
  const app = await setup(t);
  const session = await app.connect();
  app.expireAccess();
  await app.restart();
  const responses = await Promise.all(Array.from({ length: 3 }, () => app.request("/api/calendar/events", { cookie: session.cookie })));
  assert.ok(responses.every(result => result.status === 200));
  assert.equal(app.refreshCount, 1);
  assert.equal(app.calls.filter(call => call.url.includes("/calendar/")).at(-1).options.headers.Authorization, "Bearer refreshed-private-access");
});

test("API trả 401 thì gia hạn và thử lại một lần", async t => {
  const app = await setup(t);
  const session = await app.connect();
  app.setApi401();
  assert.equal((await app.request("/api/calendar/events", { cookie: session.cookie })).status, 200);
  assert.equal(app.refreshCount, 1);
});

test("quyền bị thu hồi yêu cầu kết nối lại; lỗi mạng giữ thông tin kết nối để thử lại", async t => {
  for (const error of ["temporarily_unavailable", "invalid_grant"]) {
    const app = await setup(t);
    const session = await app.connect();
    app.expireAccess(); await app.restart();
    app.setRefreshError(error);
    const response = await app.request("/api/calendar/events", { cookie: session.cookie });
    assert.equal(response.status, error === "invalid_grant" ? 401 : 502);
    assert.equal((await app.request("/api/auth/status", { cookie: session.cookie })).data.connected, error !== "invalid_grant");
  }
});

test("callback phải khớp state và cookie, không chấp nhận phát lại", async t => {
  const app = await setup(t);
  const response = await app.request("/api/auth/connect", { method: "POST" });
  const url = new URL(response.data.url);
  const path = `/api/auth/callback?state=${url.searchParams.get("state")}&code=code`;
  assert.match((await app.request(path)).headers.location, /invalid-state/);
  const cookie = response.headers["set-cookie"][0].split(";")[0];
  assert.match((await app.request(path, { cookie })).headers.location, /connected/);
  assert.match((await app.request(path, { cookie })).headers.location, /invalid-state/);
});

test("ghi lịch và ngắt kết nối cần Origin cùng CSRF, từ chối proxy tùy ý", async t => {
  const app = await setup(t);
  const session = await app.connect();
  assert.equal((await app.request("/api/auth/connect", { method: "POST", external: true })).status, 403);
  assert.equal((await app.request("/api/auth/connect", { method: "POST", marker: false })).status, 403);
  assert.equal((await app.request("/api/auth/disconnect", { method: "POST", cookie: session.cookie })).status, 403);
  assert.equal((await app.request("/api/calendar/other?url=https://example.com", { cookie: session.cookie })).status, 404);
  const body = { id: `vibelog${"a".repeat(64)}`, summary: "Buổi học", start: { dateTime: "2026-10-13T10:00:00+07:00" }, end: { dateTime: "2026-10-13T11:00:00+07:00" }, extendedProperties: { private: { vibelogId: "entry" } }, attendees: [{ email: "nobody@example.com" }] };
  const result = await app.request("/api/calendar/events", { method: "POST", cookie: session.cookie, csrf: session.csrf, body });
  assert.equal(result.status, 200);
  const forwarded = JSON.parse(app.calls.at(-1).options.body);
  assert.equal("attendees" in forwarded, false);
});

test("ngắt kết nối thu hồi quyền và không khôi phục sau khi khởi động lại", async t => {
  const app = await setup(t);
  const session = await app.connect();
  const result = await app.request("/api/auth/disconnect", { method: "POST", cookie: session.cookie, csrf: session.csrf });
  assert.equal(result.status, 200);
  assert.equal(app.revoked, true);
  assert.match(result.headers["set-cookie"][0], /Max-Age=0/);
  await app.restart();
  assert.equal((await app.request("/api/auth/status", { cookie: session.cookie })).data.connected, false);
});

test("máy chủ không phục vụ secrets, file phiên, Git hoặc source máy chủ", async t => {
  const app = await setup(t);
  for (const path of ["/.env", "/.vibelog-data/encryption.key", "/.vibelog-data/sessions.enc", "/.git/config", "/scripts/google-auth.mjs", "/src/%2e%2e/.env"]) assert.equal((await app.request(path)).status, 404, path);
  assert.equal((await app.request("/")).status, 200);
});

test("chưa cấu hình vẫn mở app và báo cách thiết lập", async t => {
  const app = await setup(t, { configured: false });
  assert.deepEqual((await app.request("/api/auth/status")).data, { configured: false, connected: false });
  assert.equal((await app.request("/api/auth/connect", { method: "POST" })).status, 503);
  assert.equal((await app.request("/")).status, 200);
});
