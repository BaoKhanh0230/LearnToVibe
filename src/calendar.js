export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export function toDateTimeInput(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function sessionRange(startedAt, minutes) {
  const start = new Date(startedAt ?? "");
  const duration = Number(minutes);
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(duration) || duration < 5 || duration > 600) {
    throw new Error("Hãy nhập giờ bắt đầu và thời lượng từ 5–600 phút.");
  }
  return { startedAt: start.toISOString(), endedAt: new Date(start.getTime() + duration * 60000).toISOString() };
}

export async function calendarEventId(id, kind = "learned") {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vibelog:${kind}:${id}`));
  return `vibelog${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function buildCalendarEvent(session, kind = "learned") {
  const range = sessionRange(session.startedAt, session.minutes);
  const planned = kind === "planned";
  return {
    summary: `${planned ? "Buổi học" : "Đã học"}: ${session.title}`,
    description: ["VibeLog", session.learning ?? "", (session.tags ?? []).map((tag) => `#${tag}`).join(" ")].filter(Boolean).join("\n\n"),
    start: { dateTime: range.startedAt },
    end: { dateTime: range.endedAt },
    extendedProperties: { private: { vibelogId: session.id, vibelogKind: kind } },
    reminders: planned ? { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] } : { useDefault: false },
  };
}

let scriptPromise;
export function loadGoogleIdentity() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    const timer = setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error("Không tải được đăng nhập Google. Kiểm tra mạng rồi thử lại."));
    }
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.append(script);
  });
  return scriptPromise;
}

export class GoogleCalendar {
  constructor({ fetcher = globalThis.fetch, onChange = () => {} } = {}) {
    // Browser fetch requires Window as its receiver when stored on another object.
    this.fetcher = fetcher.bind(globalThis);
    this.onChange = onChange;
    this.token = null;
    this.expiresAt = 0;
  }

  get connected() { return Boolean(this.token) && Date.now() < this.expiresAt; }

  connect(clientId) {
    this.token = null;
    this.expiresAt = 0;
    this.onChange();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CALENDAR_SCOPE,
        include_granted_scopes: false,
        callback: (response) => {
          if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, CALENDAR_SCOPE)) {
            reject(new Error("Google chưa cấp quyền truy cập lịch. Hãy kết nối lại và cho phép quyền lịch."));
            return;
          }
          this.token = response.access_token;
          this.expiresAt = Date.now() + Number(response.expires_in) * 1000 - 30000;
          this.onChange();
          resolve();
        },
        error_callback: () => reject(new Error("Cửa sổ đăng nhập bị đóng hoặc bị chặn. Hãy cho phép popup rồi thử lại.")),
      });
      client.requestAccessToken({ prompt: "select_account" });
    });
  }

  disconnect() {
    const token = this.token;
    this.token = null;
    this.expiresAt = 0;
    this.onChange();
    if (token && globalThis.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
  }

  async request(url, method, body) {
    if (!this.connected) {
      this.token = null;
      this.onChange();
      throw new Error("Hãy kết nối Google Calendar để gửi lịch (phiên đăng nhập có thể đã hết hạn).");
    }
    const token = this.token;
    const response = await this.fetcher(url, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (this.token !== token) throw new Error("Tài khoản Google đã thay đổi. Hãy tải lại lịch.");
    if (!response.ok) {
      if (response.status === 401) { this.token = null; this.onChange(); }
      const messages = {
        401: "Phiên Google đã hết hạn. Kết nối lại rồi gửi lại.",
        403: "Google từ chối truy cập. Kiểm tra quyền lịch và bật Calendar API trong Google Cloud.",
        429: "Google đang giới hạn yêu cầu. Hãy thử lại sau.",
        410: "Sự kiện đã bị xóa trên Google Calendar. Hãy tạo một phiên mới nếu muốn đưa lại lên lịch.",
      };
      const error = new Error(messages[response.status] ?? "Chưa gửi được lên Google Calendar. Dữ liệu vẫn được giữ; hãy thử lại.");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async listWeek(start, end, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    const token = this.token;
    const events = [];
    let pageToken;
    do {
      if (this.token !== token) throw new Error("Tài khoản Google đã thay đổi. Hãy tải lại lịch.");
      const params = new URLSearchParams({
        timeMin: start.toISOString(), timeMax: end.toISOString(), timeZone,
        singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const result = await this.request(`${API}?${params}`, "GET");
      events.push(...(result.items ?? []).filter((event) => event.status !== "cancelled"));
      pageToken = result.nextPageToken;
    } while (pageToken);
    return events;
  }

  async sync(session, kind = "learned") {
    const body = buildCalendarEvent(session, kind);
    const id = await calendarEventId(session.id, kind);
    try {
      return await this.request(`${API}/${id}`, "PATCH", body);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    try {
      return await this.request(API, "POST", { ...body, id });
    } catch (error) {
      if (error.status !== 409) throw error;
      return this.request(`${API}/${id}`, "PATCH", body);
    }
  }
}
