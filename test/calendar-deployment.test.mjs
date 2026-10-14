import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeploymentGoogleCalendar } from "../src/calendar-deployment.js";
import { buildPages } from "../scripts/build-pages.mjs";
import { CALENDAR_SCOPE } from "../src/calendar.js";

const clientId = "public.apps.googleusercontent.com";
const config = { mode: "browser", clientId };
const json = data => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

test("Pages dưới đường dẫn repository không gọi API máy chủ; popup nhận đúng client và quyền", async t => {
  const original = globalThis.google;
  t.after(() => { globalThis.google = original; });
  let auth;
  let prompt;
  const calls = [];
  const oauth2 = {
    initTokenClient(options) {
      auth = options;
      return { requestAccessToken(options) {
        prompt = options.prompt;
        auth.callback({ access_token: "private-browser-token", expires_in: 3600 });
      } };
    },
    hasGrantedAllScopes: (_, scope) => scope === CALENDAR_SCOPE,
    revoke: () => {},
  };
  const calendar = new DeploymentGoogleCalendar({ config, browserOrigin: "https://example.github.io",
    identityLoader: async () => { globalThis.google = { accounts: { oauth2 } }; },
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return json(options.method === "GET" ? { items: [{ id: "own-event" }] } : { id: "saved" });
    } });
  await calendar.restore();
  assert.equal(calls.length, 0);
  assert.equal(calendar.loginConfig.javascriptOrigin, "https://example.github.io");
  const connecting = calendar.connect();
  assert.equal(prompt, "select_account", "popup mở ngay trong thao tác click");
  await connecting;
  assert.equal(auth.client_id, clientId);
  assert.equal(auth.scope, CALENDAR_SCOPE);
  assert.equal(calendar.connected, true);
  assert.deepEqual(await calendar.listWeek(new Date(), new Date(Date.now() + 86400000)), [{ id: "own-event" }]);
  const session = { id: "study", title: "Học", startedAt: new Date().toISOString(), minutes: 30 };
  await calendar.sync(session, "planned");
  await calendar.sync(session, "planned");
  assert.ok(calls.every(call => call.url.startsWith("https://www.googleapis.com/calendar/")));
  assert.ok(calls.every(call => call.options.headers.Authorization === "Bearer private-browser-token"));
  assert.equal(JSON.parse(calls[1].options.body).reminders.overrides[0].minutes, 10);
  assert.equal(JSON.parse(calls[1].options.body).id, JSON.parse(calls[2].options.body).id);
  // A new page instance starts disconnected: tokens are never persisted.
  const reloaded = new DeploymentGoogleCalendar({ config, identityLoader: async () => {} });
  await reloaded.restore();
  assert.equal(reloaded.connected, false);
  await calendar.disconnect();
  assert.equal(calendar.connected, false);
  assert.equal(calendar.token, null);
});

test("HTML thay cho API tự chọn browser; lỗi mạng/502 không bị che đi", async () => {
  const calendar = new DeploymentGoogleCalendar({ config: { mode: "auto", clientId },
    fetcher: async () => new Response("<html>Not found</html>", { status: 404 }), identityLoader: async () => {} });
  await calendar.restore();
  assert.equal(calendar.mode, "browser");
  assert.equal(calendar.configured, true);
  for (const fetcher of [async () => new Response("<html>Unavailable</html>", { status: 502 }), async () => { throw new Error("Network failed"); }]) {
    const broken = new DeploymentGoogleCalendar({ config: { mode: "auto", clientId }, fetcher });
    await assert.rejects(broken.restore());
    assert.equal(broken.mode, "server");
  }
});

test("Node vẫn khôi phục phiên HttpOnly và gửi lịch qua API máy chủ", async () => {
  const calls = [];
  const calendar = new DeploymentGoogleCalendar({ config: { mode: "auto", clientId }, fetcher: async (url, options) => {
    calls.push({ url, options });
    return json(url === "/api/auth/status" ? { configured: true, connected: true, csrfToken: "csrf" } : { items: [] });
  }, identityLoader: async () => { throw new Error("Không được tải GIS ở chế độ server"); } });
  await calendar.restore();
  assert.equal(calendar.connected, true);
  await calendar.listWeek(new Date(), new Date(Date.now() + 86400000));
  assert.match(calls[1].url, /^\/api\/calendar\/events/);
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test("chưa có Client ID báo cấu hình thiếu; không bắt đầu gọi API hay popup", async () => {
  const calendar = new DeploymentGoogleCalendar({ config: { mode: "browser", clientId: "" },
    fetcher: () => { throw new Error("Unexpected API request"); }, identityLoader: () => { throw new Error("Unexpected script"); } });
  await calendar.restore();
  assert.equal(calendar.configured, false);
  await assert.rejects(calendar.connect(), /chưa được cấu hình/);
});

test("mọi API máy chủ trả HTML đều báo lỗi rõ ràng thay cho Unexpected token", async () => {
  const calendar = new DeploymentGoogleCalendar({ fetcher: async () => new Response("<html>Error</html>"), config: { mode: "auto", clientId: "" } });
  calendar.authenticated = true;
  await assert.rejects(calendar.connect(), /chưa có API/);
  await assert.rejects(calendar.disconnect(), /chưa có API/);
  await assert.rejects(calendar.listWeek(new Date(), new Date(Date.now() + 86400000)), /chưa có API/);
});

test("artifact Pages dùng browser và chỉ chứa tài nguyên công khai", t => {
  const output = mkdtempSync(join(tmpdir(), "vibelog-pages-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  buildPages({ output, clientId });
  const text = readFileSync(join(output, "src/google-config.js"), "utf8");
  assert.match(text, /"mode":"browser"/);
  assert.match(text, /public.apps.googleusercontent.com/);
  for (const privatePath of [".env", "scripts", ".vibelog-data", ".git"]) assert.equal(existsSync(join(output, privatePath)), false);
  assert.throws(() => buildPages({ output, clientId: "" }), /GOOGLE_CLIENT_ID/);
  assert.throws(() => buildPages({ output, clientId: "your-client-id.apps.googleusercontent.com" }), /GOOGLE_CLIENT_ID/);
});

test("đổi tài khoản bị hủy giữ phiên cũ; tài khoản mới dùng token riêng và hết hạn báo kết nối lại", async t => {
  const original = globalThis.google;
  t.after(() => { globalThis.google = original; });
  let reply = { error: "access_denied" };
  globalThis.google = { accounts: { oauth2: {
    initTokenClient: options => ({ requestAccessToken: () => options.callback(reply) }),
    hasGrantedAllScopes: () => true, revoke: () => {},
  } } };
  const tokens = [];
  const calendar = new DeploymentGoogleCalendar({ config, identityLoader: async () => {}, fetcher: async (_, options) => {
    tokens.push(options.headers.Authorization);
    return json({ items: [] });
  } });
  await calendar.restore();
  calendar.token = "account-one";
  calendar.expiresAt = Date.now() + 60000;
  await assert.rejects(calendar.connect(), /chưa cấp quyền/);
  assert.equal(calendar.token, "account-one");
  reply = { access_token: "account-two", expires_in: 3600 };
  await calendar.connect();
  await calendar.listWeek(new Date(), new Date(Date.now() + 86400000));
  assert.deepEqual(tokens, ["Bearer account-two"]);
  calendar.expiresAt = Date.now() - 1;
  await assert.rejects(calendar.listWeek(new Date(), new Date(Date.now() + 86400000)), /kết nối/i);
  assert.equal(calendar.token, null);
  await calendar.disconnect();
});
