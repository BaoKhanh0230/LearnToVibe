export const PROFILE_KEY = 'vibelog.profile.v1';
export const AVATARS = Object.freeze({ initials: 'Chữ cái tên', sprout: 'Mầm cây', rocket: 'Tên lửa', book: 'Sách', planet: 'Hành tinh', cat: 'Mèo' });
const symbols = { sprout: '🌱', rocket: '🚀', book: '📚', planet: '🪐', cat: '🐱' };

export function validateProfile(profile) {
  if (!profile || Array.isArray(profile) || typeof profile.displayName !== 'string' || !profile.displayName.trim() || profile.displayName.trim().length > 60) {
    throw Object.assign(new Error('Tên hiển thị cần từ 1 đến 60 ký tự.'), { status: 400 });
  }
  if (!Object.hasOwn(AVATARS, profile.avatar) || Object.keys(profile).some(key => !['displayName', 'avatar'].includes(key))) {
    throw Object.assign(new Error('Hãy chọn một avatar có sẵn.'), { status: 400 });
  }
  return { displayName: profile.displayName.trim(), avatar: profile.avatar };
}

export function resolveProfile(user, raw) {
  let saved;
  try { saved = JSON.parse(raw ?? 'null'); } catch { /* Use the account defaults. */ }
  const displayName = typeof saved?.displayName === 'string' && saved.displayName.trim()
    ? saved.displayName.trim().slice(0, 60) : user?.name || user?.email?.split('@')[0] || 'Tài khoản';
  const avatar = Object.hasOwn(AVATARS, saved?.avatar) ? saved.avatar : 'initials';
  const words = displayName.trim().split(/\s+/u);
  const initials = [words[0], ...(words.length > 1 ? [words.at(-1)] : [])].map(word => Array.from(word)[0]).join('').toLocaleUpperCase('vi');
  const hash = Array.from(user?.id ?? 'guest').reduce((value, char) => (value * 31 + char.codePointAt(0)) >>> 0, 0);
  return { displayName, avatar, symbol: symbols[avatar] ?? initials, tone: hash % 6 };
}
