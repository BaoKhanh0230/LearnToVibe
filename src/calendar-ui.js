import { sessionRange } from "./calendar.js";
import { PersistentGoogleCalendar } from "./calendar-session.js";
import { initializeWeekCalendar } from "./calendar-week.js";
import { confirmAction } from "./notifications.js";

export function initializeCalendarUI(showToast) {
  const query = (selector) => document.querySelector(selector);
  const status = query("#calendar-status");
  const connect = query("#calendar-connect");
  const disconnect = query("#calendar-disconnect");
  const auto = query("#calendar-auto");
  const planForm = query("#plan-form");
  const planList = query("#planned-list");
  const plansKey = "vibelog.plans.v1";
  let plans;
  try { plans = JSON.parse(localStorage.getItem(plansKey) ?? "[]"); } catch { plans = []; }
  if (!Array.isArray(plans)) plans = [];
  plans = plans.filter((plan) => {
    if (!plan || typeof plan.id !== "string" || typeof plan.title !== "string") return false;
    try { sessionRange(plan.startedAt, plan.minutes); return true; } catch { return false; }
  });
  const calendar = new PersistentGoogleCalendar({ onChange: renderConnection });
  const weekCalendar = initializeWeekCalendar(calendar);
  auto.checked = localStorage.getItem("vibelog.calendarAuto.v1") === "true";
  query("#calendar-timezone").textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pending = new Set();

  function renderConnection() {
    disconnect.hidden = !calendar.connected;
    connect.textContent = calendar.connected ? "Đổi tài khoản Google" : "Kết nối Google Calendar";
    status.textContent = calendar.connected ? "Đã kết nối lâu dài. Lịch tự tải khi mở lại app." : calendar.configured ? "Chưa kết nối. Chỉ cần cấp quyền Google lần đầu." : "Cần thiết lập Google trong file .env rồi khởi động lại project.";
    query("#calendar-server-config").textContent = calendar.configured ? "Máy chủ đã có cấu hình Google." : "Máy chủ chưa có cấu hình Google. Xem hướng dẫn trong README.";
    query("#calendar-oauth-client-id").value = calendar.loginConfig?.clientId ?? "Chưa cấu hình";
    query("#calendar-oauth-redirect").value = calendar.loginConfig?.redirectUri ?? "Chưa cấu hình";
    weekCalendar.refresh();
  }

  connect.disabled = true;
  calendar.restore().then(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("google");
    const messages = {
      cancelled: "Bạn đã hủy cấp quyền Google. Có thể kết nối lại khi cần.",
      "invalid-state": "Phiên đăng nhập đã hết hạn hoặc không khớp. Nhấn Kết nối để thử lại.",
      "missing-permission": "Google chưa cấp quyền lịch hoặc quyền ghi nhớ kết nối. Hãy kết nối lại và cho phép quyền lịch.",
      failed: "Chưa hoàn tất kết nối Google. Kiểm tra Client Secret và địa chỉ callback, rồi thử lại.",
    };
    if (messages[result]) { status.textContent = messages[result]; showToast(messages[result], { kind: result === 'cancelled' ? 'info' : 'error' }); }
    if (result) { url.searchParams.delete("google"); window.history.replaceState(null, "", url); }
  }).catch((error) => {
    status.textContent = error.message;
    query("#calendar-server-config").textContent = error.message;
  }).finally(() => { connect.disabled = false; });
  connect.addEventListener("click", async () => {
    connect.disabled = true;
    try { await calendar.connect(); }
    catch (error) { status.textContent = error.message; showToast(error.message, { kind: 'error' }); }
    finally { connect.disabled = false; }
  });
  disconnect.addEventListener("click", async () => {
    disconnect.disabled = true;
    connect.disabled = true;
    try {
      const result = await calendar.disconnect();
      if (result.revoked === false) status.textContent = "Đã ngắt trên thiết bị. Chưa thu hồi được quyền ở Google; bạn có thể thu hồi trong tài khoản Google.";
    } catch (error) { status.textContent = error.message; showToast(error.message, { kind: 'error' }); }
    finally { disconnect.disabled = false; connect.disabled = false; }
  });
  auto.addEventListener("change", () => localStorage.setItem("vibelog.calendarAuto.v1", String(auto.checked)));

  async function sync(session, kind = "learned", button) {
    const key = `${kind}:${session.id}`;
    if (pending.has(key)) return;
    pending.add(key);
    connect.disabled = true;
    disconnect.disabled = true;
    if (button) button.disabled = true;
    status.textContent = `Đang gửi “${session.title}”…`;
    showToast('Đang gửi lên Google Calendar…', { kind: 'loading', duration: 0 });
    try {
      await calendar.sync(session, kind);
      status.textContent = `Đã gửi / cập nhật “${session.title}” trên Google Calendar.`;
      showToast("Đã cập nhật Google Calendar.", { kind: 'success' });
      weekCalendar.refresh();
    } catch (error) { status.textContent = error.message; showToast(error.message, { kind: 'error' }); }
    finally {
      pending.delete(key);
      if (pending.size > 0) showToast(`Đang gửi ${pending.size} phiên học…`, { kind: 'loading', duration: 0 });
      connect.disabled = pending.size > 0;
      disconnect.disabled = pending.size > 0;
      if (button) button.disabled = false;
    }
  }

  function renderPlans() {
    planList.replaceChildren();
    if (!plans.length) { planList.textContent = "Chưa có buổi học đã đặt lịch."; return; }
    const format = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
    [...plans].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)).forEach((plan) => {
      const card = document.createElement("article");
      card.className = "planned-card";
      const text = document.createElement("p");
      text.textContent = `${plan.title} · ${format.format(new Date(plan.startedAt))} · ${plan.minutes} phút`;
      const send = document.createElement("button");
      send.type = "button";
      send.className = "secondary-button";
      send.textContent = "Gửi / cập nhật lịch";
      send.addEventListener("click", () => sync(plan, "planned", send));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary-button";
      remove.textContent = "Xóa khỏi VibeLog";
      remove.addEventListener("click", async () => {
        if (!await confirmAction("Xóa lịch học khỏi VibeLog? Sự kiện trên Google Calendar vẫn được giữ; bạn có thể xóa ở Google Calendar.")) return;
        plans = plans.filter((item) => item.id !== plan.id);
        localStorage.setItem(plansKey, JSON.stringify(plans));
        renderPlans();
        showToast('Đã xóa kế hoạch khỏi VibeLog.', { kind: 'success' });
      });
      card.append(text, send, remove);
      planList.append(card);
    });
  }

  planForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(planForm);
    let range;
    try {
      range = sessionRange(data.get("startedAt"), data.get("minutes"));
      if (new Date(range.startedAt).getTime() <= Date.now()) throw new Error("Chọn giờ bắt đầu trong tương lai cho buổi học tiếp theo.");
    } catch (error) { showToast(error.message, { kind: 'error' }); return; }
    const plan = { id: crypto.randomUUID(), title: data.get("title").trim(), minutes: Number(data.get("minutes")), ...range };
    plans.push(plan);
    localStorage.setItem(plansKey, JSON.stringify(plans));
    planForm.reset();
    renderPlans();
    if (calendar.connected) sync(plan, "planned");
    else { status.textContent = "Đã lưu lịch học trên thiết bị. Kết nối Google rồi nhấn Gửi / cập nhật lịch."; showToast("Đã lưu lịch học trên thiết bị."); }
  });
  renderPlans();
  return {
    sync,
    syncAfterSave(entry) {
      if (!auto.checked) return;
      if (calendar.connected) sync(entry);
      else { status.textContent = "Nhật ký đã lưu trên thiết bị. Kết nối Google rồi gửi lại từ phiên học."; showToast("Nhật ký đã lưu. Kết nối Google để gửi lên lịch."); }
    },
  };
}
