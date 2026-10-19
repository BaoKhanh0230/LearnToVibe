import { USER_KEYS, setUserStorage, mergeLegacy } from './user-storage.js';
import { googleConfig } from './google-config.js';
import { confirmAction, notify } from './notifications.js';
import { initializeAccountMenu } from './account-menu.js';
import { PROFILE_KEY, resolveProfile, validateProfile } from './profile.js';
import { profilePendingKey, retryProfileUpdate, transientFailure } from './profile-sync.js';

export async function initializeAccount({ notify: notifyUser = notify, retryDelay } = {}) {
  const panel = document.querySelector('#account-panel');
  const status = document.querySelector('#account-status');
  const syncStatus = document.querySelector('#account-sync');
  const login = document.querySelector('#account-login');
  const logout = document.querySelector('#account-logout');
  const migrate = document.querySelector('#account-import');
  const retry = document.querySelector('#account-retry');
  const exportDraft = document.querySelector('#account-export');
  const reload = document.querySelector('#account-reload');
  const main = document.querySelector('main');
  const menu = initializeAccountMenu();
  const edit = document.querySelector('#account-edit');
  const backup = document.querySelector('#account-backup');
  const profileDialog = document.querySelector('#profile-dialog');
  const profileForm = document.querySelector('#profile-form');
  const profileFeedback = document.querySelector('#profile-feedback');
  const profileSave = document.querySelector('#profile-save');
  const notice = document.querySelector('#account-notice');
  panel.hidden = false;
  let auth, version = 0, values = {}, dirty = false, saving, changes = 0, conflict = false;
  let syncedValues = {}, pendingProfile, profileSaving, profileRetryTimer, pendingNoticeShown = false;
  let draftKey;
  function showSync(message, state = 'synced') {
    syncStatus.textContent = message;
    const dot = document.querySelector('#account-sync-dot');
    dot.dataset.state = state;
    document.querySelector('#account-trigger').title = message;
    notice.hidden = state !== 'error';
    document.querySelector('#account-notice-text').textContent = state === 'error' ? message : '';
  }
  function lockData(locked) { main.inert = locked; edit.disabled = locked; profileForm.inert = locked; }
  function renderProfile() {
    const profile = resolveProfile(auth?.user, pendingProfile ? JSON.stringify(pendingProfile) : values[PROFILE_KEY]);
    for (const selector of ['#account-avatar', '#profile-preview']) {
      const avatar = document.querySelector(selector);
      avatar.textContent = profile.symbol;
      avatar.dataset.tone = String(profile.tone);
    }
    document.querySelector('#account-trigger-name').textContent = profile.displayName;
    document.querySelector('#account-menu-name').textContent = profile.displayName;
    document.querySelector('#account-trigger').setAttribute('aria-label', `Mở menu tài khoản ${profile.displayName}`);
  }
  function download(data, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  document.querySelector('#account-notice-open').addEventListener('click', () => menu.show());
  edit.addEventListener('click', () => {
    if (!auth?.user || conflict || edit.disabled) return;
    const profile = resolveProfile(auth.user, pendingProfile ? JSON.stringify(pendingProfile) : values[PROFILE_KEY]);
    profileForm.elements.displayName.value = profile.displayName;
    profileForm.elements.avatar.value = profile.avatar;
    document.querySelector('#profile-email').textContent = auth.user.email || 'Tài khoản Google';
    profileFeedback.textContent = '';
    menu.close(); profileDialog.showModal();
    profileForm.elements.displayName.focus();
  });
  document.querySelector('#profile-close').addEventListener('click', () => profileDialog.close());
  document.querySelector('#profile-cancel').addEventListener('click', () => profileDialog.close());
  profileDialog.addEventListener('close', () => document.querySelector('#account-trigger').focus());
  profileForm.addEventListener('input', () => {
    const preview = resolveProfile(auth?.user, JSON.stringify({ displayName: profileForm.elements.displayName.value, avatar: profileForm.elements.avatar.value }));
    document.querySelector('#profile-preview').textContent = preview.symbol;
  });
  profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!auth?.user || conflict || profileSave.disabled) return;
    const displayName = profileForm.elements.displayName.value.trim();
    if (!displayName || displayName.length > 60) { profileFeedback.textContent = 'Tên hiển thị cần từ 1 đến 60 ký tự.'; profileForm.elements.displayName.focus(); return; }
    let profile;
    try { profile = validateProfile({ displayName, avatar: profileForm.elements.avatar.value }); }
    catch (error) { profileFeedback.textContent = error.message; return; }
    profileSave.disabled = true;
    profileSave.textContent = 'Đang lưu…';
    pendingProfile = profile;
    pendingNoticeShown = false;
    localStorage.setItem(profilePendingKey(auth.user.id), JSON.stringify(profile));
    try {
      const result = await savePendingProfile();
      if (result !== 'error') profileDialog.close();
    } finally { profileSave.disabled = false; profileSave.textContent = 'Lưu hồ sơ'; }
  });
  backup.addEventListener('click', () => {
    const data = { format: 'vibelog-account', schemaVersion: 1, exportedAt: new Date().toISOString(), userId: auth?.user?.id, version, values };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    backup.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const api = async (path, method = 'GET', body) => {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-VibeLog-Request': '1', 'X-VibeLog-CSRF': auth?.csrfToken ?? '', 'X-VibeLog-User': auth?.user?.id ?? '' },
      signal: AbortSignal.timeout(15000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Chưa đồng bộ được dữ liệu.'), { status: response.status });
    return data;
  };
  function savePendingProfile() {
    if (profileSaving) return profileSaving;
    if (!pendingProfile) return Promise.resolve('saved');
    clearTimeout(profileRetryTimer);
    const existingSave = saving;
    profileSaving = (async () => {
      let saved = false;
      try {
        await existingSave;
        while (pendingProfile) {
          const profile = pendingProfile;
          const result = await retryProfileUpdate(() => api('/api/user/profile', 'PATCH', profile), retryDelay);
          // Do not mark another device's diary changes as already loaded in this tab.
          const remoteDiaryChanged = USER_KEYS.some(key => key !== PROFILE_KEY && result.values[key] !== syncedValues[key]);
          const diaryAlreadySaved = USER_KEYS.every(key => key === PROFILE_KEY || result.values[key] === values[key]);
          if (!remoteDiaryChanged || diaryAlreadySaved) { version = result.version; syncedValues = { ...result.values }; }
          if (diaryAlreadySaved) dirty = false;
          values[PROFILE_KEY] = result.values[PROFILE_KEY];
          // A new edit can arrive while an older offline update is retrying.
          if (pendingProfile !== profile) continue;
          pendingProfile = null;
          localStorage.removeItem(profilePendingKey(auth.user.id));
          remember();
          renderProfile();
          if (!conflict) showSync(dirty ? 'Hồ sơ đã lưu. Nhật ký đang chờ đồng bộ.' : 'Hồ sơ đã được lưu.', dirty ? 'saving' : 'synced');
          if (!dirty && !conflict) retry.hidden = exportDraft.hidden = reload.hidden = true;
          notifyUser('Đã cập nhật hồ sơ thành công.', { kind: 'success' });
        }
        saved = true;
        return 'saved';
      } catch (error) {
        if (transientFailure(error)) {
          renderProfile();
          showSync('Hồ sơ sẽ tự lưu khi kết nối ổn định trở lại.', 'saving');
          if (!pendingNoticeShown) notifyUser('Đã giữ thay đổi trên thiết bị. Hồ sơ sẽ tự lưu khi có kết nối.', { kind: 'info' });
          pendingNoticeShown = true;
          profileRetryTimer = setTimeout(() => { void savePendingProfile(); }, 15000);
          profileRetryTimer.unref?.();
          return 'pending';
        }
        profileFeedback.textContent = error.status === 400 || error.status === 413 ? error.message : 'Chưa lưu được hồ sơ. Hãy tải lại ứng dụng rồi thử lại.';
        notifyUser(profileFeedback.textContent, { kind: 'error' });
        return 'error';
      } finally { profileSaving = null; if (saved && dirty && !conflict) void flush(); }
    })();
    return profileSaving;
  }
  function remember() {
    if (dirty) sessionStorage.setItem(draftKey, JSON.stringify({ version, values }));
    else sessionStorage.removeItem(draftKey);
  }
  function flush() {
    if (profileSaving) return profileSaving.then(() => flush());
    if (saving) return saving;
    if (!dirty || conflict) return Promise.resolve();
    saving = (async () => {
      try {
        while (dirty) {
          const revision = changes;
          const body = { version, values: { ...values } };
          showSync('Đang lưu vào tài khoản…', 'saving');
          const result = await api('/api/user/data', 'PUT', body);
          version = result.version;
          syncedValues = { ...result.values };
          dirty = changes !== revision;
          remember();
        }
        showSync('Đã đồng bộ với tài khoản.');
        retry.hidden = exportDraft.hidden = reload.hidden = true;
      } catch (error) {
        conflict = error.status === 409 || error.status === 401 || error.status === 403;
        if (conflict) lockData(true);
        showSync(`${error.message} Bản nháp còn trong tab này; hãy xuất trước khi đóng tab.`, 'error');
        retry.hidden = conflict;
        exportDraft.hidden = reload.hidden = false;
      } finally { saving = null; }
    })();
    return saving;
  }
  login.addEventListener('click', async () => {
    if (profileSaving) await profileSaving;
    clearTimeout(profileRetryTimer);
    if (dirty) { await flush(); if (dirty) { showSync('Hãy xuất bản nháp và xử lý lỗi đồng bộ trước khi đổi tài khoản.', 'error'); return; } }
    login.disabled = true;
    try {
      const result = await api('/api/auth/connect', 'POST');
      const url = new URL(result.url);
      if (url.origin !== 'https://accounts.google.com') throw new Error('Địa chỉ đăng nhập không hợp lệ.');
      location.assign(url.href);
    } catch (error) { showSync(error.message, 'error'); login.disabled = false; }
  });
  logout.addEventListener('click', async () => {
    if (profileSaving) await profileSaving;
    clearTimeout(profileRetryTimer);
    await flush();
    if (dirty) { showSync('Hãy xuất bản nháp và xử lý lỗi đồng bộ trước khi đăng xuất.', 'error'); return; }
    try { await api('/api/auth/logout', 'POST'); lockData(true); location.reload(); }
    catch (error) { showSync(error.message, 'error'); }
  });
  retry.addEventListener('click', flush);
  exportDraft.addEventListener('click', () => {
    download({ userId: auth?.user?.id, version, values }, 'vibelog-account-draft.json');
  });
  reload.addEventListener('click', async () => {
    if (dirty && !await confirmAction('Tải dữ liệu cloud và bỏ bản nháp trong tab này? Hãy xuất bản nháp trước nếu cần giữ.')) return;
    if (draftKey) sessionStorage.removeItem(draftKey);
    dirty = false; location.reload();
  });
  migrate.addEventListener('click', async () => {
    if (!await confirmAction(`Nhập nhật ký/kế hoạch cũ trên trình duyệt vào ${auth.user.email || auth.user.name}? Dữ liệu này có thể thuộc người từng dùng máy. Bản cloud cùng ID được giữ; bản local chỉ xóa sau khi đồng bộ thành công.`)) return;
    const legacy = Object.fromEntries(USER_KEYS.flatMap(key => localStorage.getItem(key) === null ? [] : [[key, localStorage.getItem(key)]]));
    try {
      values = mergeLegacy(values, legacy); changes++; dirty = true; remember();
      await flush();
      if (!dirty) {
        for (const [key, value] of Object.entries(legacy)) if (localStorage.getItem(key) === value) localStorage.removeItem(key);
        location.reload();
      }
    } catch { showSync('Dữ liệu local cũ không hợp lệ. Bản gốc vẫn được giữ.', 'error'); }
  });
  if (googleConfig.mode === 'browser') {
    status.textContent = 'Bản tĩnh: dữ liệu chỉ lưu trên trình duyệt. Dùng website chính thức để đăng nhập và đồng bộ.';
    showSync('Dữ liệu đang lưu trên thiết bị.', 'device');
    login.hidden = true; return;
  }
  lockData(true);
  try {
    auth = await api('/api/auth/status');
    login.disabled = !auth.configured;
    if (!auth.user) {
      status.textContent = auth.connected ? 'Kết nối cũ: đăng nhập Google lại để bật tài khoản và đồng bộ.' : 'Chế độ thiết bị. Đăng nhập Google để lưu và mở dữ liệu trên thiết bị khác.';
      showSync('Đăng nhập để đồng bộ nhật ký và kế hoạch.', 'device');
      main.inert = false; return;
    }
    status.textContent = `Tài khoản: ${auth.user.email || auth.user.name || auth.user.id}`;
    document.querySelector('#account-login-label').textContent = 'Đổi tài khoản Google'; logout.hidden = false;
    renderProfile();
    const result = await api('/api/user/data');
    version = result.version; values = { ...result.values }; syncedValues = { ...result.values };
    const savedProfileDraft = localStorage.getItem(profilePendingKey(auth.user.id));
    if (savedProfileDraft) {
      try { pendingProfile = validateProfile(JSON.parse(savedProfileDraft)); } catch { /* Leave an unrecognized draft untouched. */ }
    }
    draftKey = `vibelog.draft.${auth.user.id}`;
    const cached = sessionStorage.getItem(draftKey);
    if (cached) {
      const draft = JSON.parse(cached);
      // Migrate profile-only drafts from the old full-snapshot save, without making
      // the user export data or resolve a version change caused only by a profile.
      if (draft.values?.[PROFILE_KEY] && draft.values[PROFILE_KEY] !== values[PROFILE_KEY]) {
        try { pendingProfile ??= validateProfile(JSON.parse(draft.values[PROFILE_KEY])); } catch { /* Keep the original draft if malformed. */ }
        if (pendingProfile) localStorage.setItem(profilePendingKey(auth.user.id), JSON.stringify(pendingProfile));
      }
      const diaryChanged = USER_KEYS.some(key => key !== PROFILE_KEY && draft.values?.[key] !== values[key]);
      if (diaryChanged) { values = { ...draft.values, ...(values[PROFILE_KEY] ? { [PROFILE_KEY]: values[PROFILE_KEY] } : {}) }; dirty = true; }
      else sessionStorage.removeItem(draftKey);
      if (diaryChanged && draft.version !== version) {
        conflict = true; showSync('Cloud đã đổi trong lúc bản nháp chưa lưu. Xuất bản nháp rồi tải lại cloud.', 'error');
        exportDraft.hidden = reload.hidden = false;
      }
    }
    setUserStorage({
      getItem: key => values[key] ?? null,
      setItem(key, value) {
        if (!USER_KEYS.includes(key)) return;
        values[key] = String(value); changes++; dirty = true; remember(); void flush();
      },
    });
    renderProfile(); edit.hidden = backup.hidden = false;
    migrate.hidden = !USER_KEYS.some(key => localStorage.getItem(key) !== null);
    if (!conflict) showSync('Đã tải dữ liệu tài khoản. Thay đổi mới sẽ tự đồng bộ.');
    lockData(conflict);
    if (pendingProfile) await savePendingProfile();
    if (dirty && !conflict) await flush();
    // Focus/visibility catches an account change in another tab before editing resumes.
    const checkAccount = async () => {
      lockData(true);
      try {
        const current = await api('/api/auth/status');
        if (current.user?.id !== auth.user.id || current.csrfToken !== auth.csrfToken) {
          conflict = true;
          showSync('Phiên đăng nhập đã đổi ở tab khác. Xuất bản nháp nếu cần, rồi tải lại.', 'error');
          exportDraft.hidden = reload.hidden = false;
          if (!dirty) location.reload();
        } else lockData(conflict);
      } catch { showSync('Chưa kiểm tra được tài khoản. Kết nối mạng rồi tải lại.', 'error'); reload.hidden = false; }
    };
    window.addEventListener('focus', checkAccount);
    window.addEventListener('online', () => pendingProfile ? savePendingProfile() : dirty && !conflict ? flush() : undefined);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkAccount(); });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('vibelog:before-account-change', event => { if (dirty) { event.preventDefault(); showSync('Hãy đồng bộ hoặc xuất bản nháp trước khi đổi tài khoản.', 'error'); } });
  } catch (error) {
    // Never render legacy/local data as if it belonged to a logged-in account.
    setUserStorage({ getItem: () => null, setItem: () => {} });
    showSync(`${error.message} Tải lại để thử kết nối; dữ liệu local cũ vẫn được giữ.`, 'error');
    reload.hidden = false;
  }
}
