import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { CALENDAR_SCOPE } from "../src/calendar.js";
import { sessionKey } from "./session-store.mjs";
import { normalizeCalendarEvent } from "./calendar-validation.mjs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SESSION_SECONDS = 180 * 24 * 60 * 60;
const random = () => randomBytes(32).toString("base64url");
const equal = (a, b) => typeof a === "string" && typeof b === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function cookieValue(request, name) {
  const value = (request.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  // Serverless runtimes can parse the body before invoking the Node handler.
  if (request.body !== undefined) {
    const text = Buffer.isBuffer(request.body) ? request.body.toString("utf8")
      : typeof request.body === "string" ? request.body : JSON.stringify(request.body);
    if (Buffer.byteLength(text) > 65536) throw Object.assign(new Error("Nội dung lịch quá lớn."), { status: 413 });
    try { return JSON.parse(text); }
    catch { throw Object.assign(new Error("Dữ liệu gửi lên không hợp lệ."), { status: 400 }); }
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw Object.assign(new Error("Nội dung lịch quá lớn."), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw Object.assign(new Error("Dữ liệu gửi lên không hợp lệ."), { status: 400 }); }
}

export function createGoogleAuth({ origin, clientId, clientSecret, store, fetcher = globalThis.fetch, now = Date.now }) {
  const configured = Boolean(clientId && clientSecret && !clientId.startsWith("your-") && !clientSecret.startsWith("your-"));
  const secure = new URL(origin).protocol === "https:";
  const pending = new Map();
  const refreshing = new Map();
  const redirectUri = `${origin}/api/auth/callback`;
  const cookie = (name, value, age, path = "/") => `${name}=${value}; HttpOnly; SameSite=Lax; Path=${path}; Max-Age=${age}${secure ? "; Secure" : ""}`;
  const redirect = (response, result) => {
    response.writeHead(303, { Location: `/?google=${result}#calendar-title`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    response.end();
  };
  const getSession = async (request) => {
    const value = cookieValue(request, "vibelog_session");
    const id = value ? sessionKey(value) : null;
    const record = id ? await store.get(id) : null;
    return { id, record: record?.clientId === clientId ? record : null };
  };

  async function tokenRequest(values) {
    const result = await fetcher(TOKEN_URL, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...values }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await result.json();
    if (!result.ok) throw Object.assign(new Error("Không thể gia hạn kết nối Google."), { invalidGrant: data.error === "invalid_grant", status: 502 });
    if (!data.access_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) throw new Error("Google chưa trả thông tin kết nối hợp lệ.");
    return data;
  }

  async function accessToken(id, force = false) {
    const record = await store.get(id);
    if (!record) throw Object.assign(new Error("Kết nối Google không còn hiệu lực. Hãy kết nối lại."), { status: 401 });
    if (!force && record.accessExpiresAt > now() + 60000) return record.accessToken;
    if (refreshing.has(id)) return refreshing.get(id);
    const refresh = (async () => {
      try {
        const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: record.refreshToken });
        const next = { ...record, accessToken: data.access_token, accessExpiresAt: now() + Number(data.expires_in) * 1000, refreshToken: data.refresh_token ?? record.refreshToken };
        if (!await store.replace(id, record, next)) throw Object.assign(new Error("Kết nối Google đã thay đổi."), { status: 401 });
        return next.accessToken;
      } catch (error) {
        if (error.invalidGrant) { await store.deleteIfCurrent(id, record); error.status = 401; error.message = "Google yêu cầu kết nối lại. Nhật ký và kế hoạch vẫn được giữ."; }
        throw error;
      }
    })();
    refreshing.set(id, refresh);
    try { return await refresh; } finally { refreshing.delete(id); }
  }

  async function handle(request, response, url) {
    const path = url.pathname;
    if (!path.startsWith("/api/")) return false;
    if (request.headers.host !== new URL(origin).host) { json(response, 403, { error: "Địa chỉ website không khớp APP_URL." }); return true; }
    try {
      const { id, record } = await getSession(request);
      if (!["GET", "HEAD"].includes(request.method)) {
        if (request.headers.origin !== origin || request.headers["x-vibelog-request"] !== "1") {
          json(response, 403, { error: "Yêu cầu không đến từ VibeLog." }); return true;
        }
      }
      if (path === "/api/auth/status" && request.method === "GET") {
        json(response, 200, {
          configured, connected: Boolean(configured && record),
          ...(configured ? { loginConfig: { clientId, redirectUri } } : {}),
          ...(configured && record ? { csrfToken: record.csrfToken } : {}),
        });
        return true;
      }
      if (!configured) { json(response, 503, { error: "Cần điền Google Client ID và Client Secret vào file .env rồi khởi động lại project." }); return true; }
      if (path === "/api/auth/connect" && request.method === "POST") {
        for (const [key, value] of pending) if (value.expiresAt <= now()) pending.delete(key);
        if (pending.size >= 100) { json(response, 429, { error: "Có quá nhiều yêu cầu kết nối. Thử lại sau." }); return true; }
        const state = random();
        const browser = random();
        const verifier = random();
        const flow = { browser, verifier, expiresAt: now() + 600000, oldId: id, clientId };
        await store.set(`oauth:${sessionKey(state)}`, flow);
        pending.set(state, { expiresAt: flow.expiresAt });
        response.setHeader("Set-Cookie", cookie("vibelog_oauth", browser, 600, "/api/auth"));
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.search = new URLSearchParams({
          client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: CALENDAR_SCOPE,
          access_type: "offline", prompt: "consent select_account", state,
          code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
        }).toString();
        json(response, 200, { url: authUrl.href });
        return true;
      }
      if (path === "/api/auth/callback" && request.method === "GET") {
        const state = url.searchParams.get("state");
        const flowId = typeof state === "string" && /^[A-Za-z0-9_-]{43}$/.test(state) ? `oauth:${sessionKey(state)}` : null;
        const flow = flowId ? await store.get(flowId) : null;
        if (!flow || flow.clientId !== clientId || flow.expiresAt <= now() || !equal(flow.browser, cookieValue(request, "vibelog_oauth"))) { redirect(response, "invalid-state"); return true; }
        if (!await store.deleteIfCurrent(flowId, flow)) { redirect(response, "invalid-state"); return true; }
        pending.delete(state);
        response.setHeader("Set-Cookie", cookie("vibelog_oauth", "", 0, "/api/auth"));
        if (url.searchParams.has("error")) { redirect(response, "cancelled"); return true; }
        const code = url.searchParams.get("code");
        if (!code) { redirect(response, "failed"); return true; }
        try {
          const data = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: flow.verifier });
          if (!data.refresh_token || !data.scope?.split(" ").includes(CALENDAR_SCOPE)) { redirect(response, "missing-permission"); return true; }
          const sessionCookie = random();
          const newId = sessionKey(sessionCookie);
          await store.set(newId, { clientId, csrfToken: random(), refreshToken: data.refresh_token, accessToken: data.access_token, accessExpiresAt: now() + Number(data.expires_in) * 1000, expiresAt: now() + SESSION_SECONDS * 1000 });
          if (flow.oldId) await store.delete(flow.oldId);
          response.setHeader("Set-Cookie", [cookie("vibelog_oauth", "", 0, "/api/auth"), cookie("vibelog_session", sessionCookie, SESSION_SECONDS)]);
          redirect(response, "connected");
        } catch { redirect(response, "failed"); }
        return true;
      }
      if (!record) { json(response, 401, { error: "Hãy kết nối Google Calendar để xem hoặc gửi lịch." }); return true; }
      if (request.method !== "GET" && !equal(request.headers["x-vibelog-csrf"], record.csrfToken)) { json(response, 403, { error: "Phiên thao tác đã thay đổi. Hãy tải lại trang." }); return true; }
      if (path === "/api/auth/disconnect" && request.method === "POST") {
        await store.delete(id);
        response.setHeader("Set-Cookie", cookie("vibelog_session", "", 0));
        let revoked = false;
        try {
          const result = await fetcher("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: record.refreshToken }), signal: AbortSignal.timeout(10000) });
          revoked = result.ok;
        } catch { /* Local disconnection remains effective when Google is offline. */ }
        json(response, 200, { connected: false, revoked });
        return true;
      }
      const match = /^\/api\/calendar\/events(?:\/([0-9a-v]{5,1024}))?$/.exec(path);
      if (!match || !(request.method === "GET" && !match[1] || request.method === "POST" && !match[1] || request.method === "PATCH" && match[1])) {
        json(response, 404, { error: "Không tìm thấy thao tác này." }); return true;
      }
      if (match[1] && !match[1].startsWith("vibelog")) { json(response, 403, { error: "Chỉ được cập nhật sự kiện do VibeLog tạo." }); return true; }
      let body;
      if (request.method !== "GET") {
        // Do not proxy attendees, attachments, arbitrary metadata or reminder fields.
        body = normalizeCalendarEvent(await readBody(request), request.method);
      }
      const target = new URL(`${CALENDAR_URL}${match[1] ? `/${match[1]}` : ""}`);
      for (const key of ["timeMin", "timeMax", "timeZone", "pageToken", "singleEvents", "orderBy", "showDeleted", "maxResults"]) if (url.searchParams.has(key)) target.searchParams.set(key, url.searchParams.get(key));
      const call = async (force) => fetcher(target.href, { method: request.method, headers: { Authorization: `Bearer ${await accessToken(id, force)}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
      let result = await call(false);
      if (result.status === 401) result = await call(true);
      if (!await store.get(id)) { json(response, 401, { error: "Kết nối Google đã bị ngắt." }); return true; }
      if (!result.ok) {
        if (result.status === 401) await store.delete(id);
        const messages = { 401: "Google yêu cầu kết nối lại.", 403: "Google từ chối quyền lịch. Kiểm tra Calendar API và quyền truy cập.", 404: "Chưa có sự kiện này.", 409: "Sự kiện đã tồn tại.", 410: "Sự kiện đã bị xóa trên Google.", 429: "Google đang giới hạn yêu cầu. Thử lại sau." };
        json(response, result.status, { error: messages[result.status] ?? "Google chưa xử lý được yêu cầu. Thử lại sau." });
      } else json(response, 200, await result.json());
      return true;
    } catch (error) {
      json(response, error.status ?? 502, { error: error.status === 401 || error.status === 400 || error.status === 413 ? error.message : "Chưa kết nối được với Google. Dữ liệu vẫn được giữ; thử lại sau." });
      return true;
    }
  }
  return { handle, configured };
}
