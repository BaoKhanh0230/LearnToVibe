import { GoogleCalendar } from "./calendar.js";

export class PersistentGoogleCalendar extends GoogleCalendar {
  constructor(options = {}) {
    super(options);
    this.authenticated = false;
    this.configured = false;
    this.csrfToken = null;
    this.loginConfig = null;
  }
  get connected() { return this.authenticated; }

  async restore() {
    const response = await this.fetcher("/api/auth/status", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Kết nối lâu dài cần chạy project bằng npm start với máy chủ mới.");
    const data = await response.json();
    this.configured = data.configured === true;
    this.loginConfig = data.loginConfig ?? null;
    this.authenticated = data.connected === true;
    this.csrfToken = data.csrfToken ?? null;
    // A session marker for inherited account-change guards, not a Google token.
    this.token = this.csrfToken;
    this.onChange();
    return data;
  }

  async connect() {
    const response = await this.fetcher("/api/auth/connect", { method: "POST", credentials: "same-origin", headers: { "X-VibeLog-Request": "1" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Chưa bắt đầu được kết nối Google.");
    const target = new URL(data.url);
    if (target.origin !== "https://accounts.google.com") throw new Error("Địa chỉ đăng nhập Google không hợp lệ.");
    window.location.assign(target.href);
  }

  async disconnect() {
    const response = await this.fetcher("/api/auth/disconnect", {
      method: "POST", credentials: "same-origin",
      headers: { "X-VibeLog-Request": "1", "X-VibeLog-CSRF": this.csrfToken ?? "" },
    });
    const data = await response.json();
    if (!response.ok && response.status !== 401) throw new Error(data.error || "Chưa ngắt được kết nối. Thử lại.");
    this.authenticated = false;
    this.csrfToken = null;
    this.token = null;
    this.onChange();
    return data;
  }

  async request(url, method, body) {
    if (!this.connected) throw new Error("Hãy kết nối Google Calendar để xem hoặc gửi lịch.");
    const marker = this.token;
    const googleUrl = new URL(url);
    const path = googleUrl.pathname.replace("/calendar/v3/calendars/primary/events", "/api/calendar/events");
    const response = await this.fetcher(`${path}${googleUrl.search}`, {
      method, credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-VibeLog-Request": "1", "X-VibeLog-CSRF": this.csrfToken ?? "" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (this.token !== marker) throw new Error("Tài khoản Google đã thay đổi. Hãy tải lại lịch.");
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) { this.authenticated = false; this.token = null; this.csrfToken = null; this.onChange(); }
      throw Object.assign(new Error(data.error || "Chưa xử lý được yêu cầu lịch. Thử lại sau."), { status: response.status });
    }
    return data;
  }
}
