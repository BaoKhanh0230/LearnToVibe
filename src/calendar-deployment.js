import { GoogleCalendar, loadGoogleIdentity } from "./calendar.js";
import { PersistentGoogleCalendar } from "./calendar-session.js";
import { googleConfig } from "./google-config.js";

// Node retains its server session; static hosting uses Google's browser token flow.
export class DeploymentGoogleCalendar extends PersistentGoogleCalendar {
  constructor({ config = googleConfig, identityLoader = loadGoogleIdentity,
    browserOrigin = globalThis.location?.origin ?? "", ...options } = {}) {
    super(options);
    this.config = config;
    this.identityLoader = identityLoader;
    this.browserOrigin = browserOrigin;
    this.mode = config.mode === "browser" ? "browser" : "server";
    this.expiryTimer = null;
  }

  get connected() {
    return this.mode === "browser" ? Boolean(this.token) && Date.now() < this.expiresAt : super.connected;
  }

  async restore() {
    if (this.config.mode !== "browser") {
      try { return await super.restore(); }
      catch (error) {
        // Only a missing API selects static mode. Network/server failures stay visible.
        if (!error.missingApi) throw error;
      }
    }
    this.mode = "browser";
    this.configured = /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(this.config.clientId) && !this.config.clientId.startsWith("your-");
    this.loginConfig = { clientId: this.config.clientId, javascriptOrigin: this.browserOrigin };
    this.onChange();
    if (this.configured) await this.identityLoader();
    return { configured: this.configured, connected: false };
  }

  connect() {
    if (this.mode !== "browser") return super.connect();
    if (!this.configured) return Promise.reject(new Error("Website chưa được cấu hình kết nối Google. Vui lòng liên hệ chủ website."));
    if (!globalThis.google?.accounts?.oauth2) {
      // Retry loading, then require a fresh click so popup keeps its user gesture.
      return this.identityLoader().then(() => { throw new Error("Đã tải đăng nhập Google. Nhấn Kết nối một lần nữa để mở cửa sổ đăng nhập."); });
    }
    // Invoke synchronously from the click handler; awaiting a loader here blocks mobile popups.
    return GoogleCalendar.prototype.connect.call(this, this.config.clientId).then(() => {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = setTimeout(() => {
        this.token = null;
        this.expiresAt = 0;
        this.onChange();
      }, Math.max(0, this.expiresAt - Date.now()));
      this.expiryTimer.unref?.();
    });
  }

  async disconnect() {
    if (this.mode !== "browser") return super.disconnect();
    clearTimeout(this.expiryTimer);
    GoogleCalendar.prototype.disconnect.call(this);
    return { connected: false };
  }

  request(url, method, body) {
    return this.mode === "browser"
      ? GoogleCalendar.prototype.request.call(this, url, method, body)
      : super.request(url, method, body);
  }
}
