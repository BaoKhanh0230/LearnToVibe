import assert from "node:assert/strict";

const origin = new URL(process.env.DEPLOYMENT_URL ?? process.argv[2]);
if (origin.protocol !== "https:") throw new Error("Kiểm thử deployment cần URL HTTPS.");
const request = (path, options = {}) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000), redirect: "manual", ...options });
const health = await request("/healthz");
assert.equal(health.status, 200);
assert.equal((await health.json()).status, "ok");
const page = await request("/");
assert.equal(page.status, 200);
assert.ok(Number(page.headers.get("strict-transport-security")?.match(/max-age=(\d+)/)?.[1]) >= 31536000);
assert.equal(page.headers.get("x-frame-options"), "DENY");
assert.equal(page.headers.get("x-content-type-options"), "nosniff");
const html = await page.text();
assert.equal(html.includes("calendar-oauth-client-id"), false);
assert.ok(html.includes('id="account-trigger"'));
assert.ok(html.includes('id="profile-dialog"'));
const status = await request("/api/auth/status");
assert.equal(status.status, 200);
assert.equal(status.headers.get("cache-control"), "no-store");
const data = await status.json();
assert.equal(data.configured, true);
assert.equal(data.connected, false);
assert.equal(data.user, null);
assert.equal(data.cloudAvailable, true);
assert.equal(data.loginConfig.redirectUri, `${origin.origin}/api/auth/callback`);
assert.equal("csrfToken" in data, false);
assert.equal("clientSecret" in data, false);
assert.equal("accessToken" in data, false);
assert.equal("refreshToken" in data, false);
assert.equal((await request("/api/calendar/events")).status, 401);
assert.equal((await request('/api/user/data')).status, 401);
assert.equal((await request('/api/user/profile', { method: 'PATCH', headers: { Origin: origin.origin, 'X-VibeLog-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'Smoke test', avatar: 'initials' }) })).status, 401);
for (const path of ['/src/account.js', '/src/account-menu.js', '/src/profile.js', '/src/profile-sync.js', '/src/account.css']) {
  assert.equal((await request(path)).status, 200);
}
for (const path of ["/.env", "/.git/config", "/.vibelog-data/encryption.key", "/scripts/server.mjs", "/package-lock.json"]) {
  assert.equal((await request(path)).status, 404);
}
assert.equal((await request("/api/auth/connect", { method: "POST", headers: { Origin: "https://attacker.example", "X-VibeLog-Request": "1" } })).status, 403);
const connect = await request("/api/auth/connect", { method: "POST", headers: { Origin: origin.origin, "X-VibeLog-Request": "1" } });
assert.equal(connect.status, 200);
const cookie = connect.headers.get("set-cookie");
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /SameSite=Lax/);
assert.match(cookie, /; Secure/);
const authUrl = new URL((await connect.json()).url);
assert.equal(authUrl.origin, "https://accounts.google.com");
assert.equal(authUrl.searchParams.get("redirect_uri"), `${origin.origin}/api/auth/callback`);
assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");
assert.equal(authUrl.searchParams.get("access_type"), "offline");
for (const scope of ['openid', 'email', 'profile']) assert.ok(authUrl.searchParams.get('scope').split(' ').includes(scope));
assert.equal(authUrl.searchParams.has("client_secret"), false);
// Exercise a complete, cancelled OAuth flow without accessing a Google account.
const callback = new URL("/api/auth/callback", origin);
callback.search = new URLSearchParams({ state: authUrl.searchParams.get("state"), error: "access_denied" }).toString();
const flowCookie = cookie.split(";")[0];
const cancelled = await request(callback, { headers: { Cookie: flowCookie } });
assert.equal(cancelled.status, 303);
assert.match(cancelled.headers.get("location"), /google=cancelled/);
const replay = await request(callback, { headers: { Cookie: flowCookie } });
assert.match(replay.headers.get("location"), /invalid-state/);
for (const [path, type] of [["/robots.txt", "text/plain"], ["/sitemap.xml", "application/xml"]]) {
  const response = await request(path);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("content-type").startsWith(type));
  assert.ok((await response.text()).includes(`${origin.origin}/`));
}
console.log("PASS: deployed HTTPS, health, JSON auth configuration, secure OAuth cookie, PKCE, unauthorized access, cross-origin rejection and private-file protection.");
console.log("PASS: sitemap/robots, persistent OAuth state cancellation and replay protection on the deployed database.");
console.log('PASS: account menu/profile assets, anonymous data/profile access denied, OpenID identity scopes and cloud data configuration.');
console.log("Google consent, calendar writes and signed-in browser refresh still require account-based acceptance testing.");
