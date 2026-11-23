/** Query flags and Online settings helpers (§4.1, §6 N2). */

export function isOnlineDev(search = typeof location !== 'undefined' ? location.search : '') {
  return /(?:\?|&)online=dev(?:&|$)/.test(search || '');
}

export function isIceFail(search = typeof location !== 'undefined' ? location.search : '') {
  return /(?:\?|&)iceFail(?:=1)?(?:&|$)/.test(search || '');
}

export function fallbackRelayUrl(search = typeof location !== 'undefined' ? location.search : '') {
  const m = /(?:\?|&)fallbackRelay=([^&]+)/i.exec(search || '');
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

export function isDebugFlag(search = typeof location !== 'undefined' ? location.search : '') {
  return /(?:\?|&)debug(?:=|&|$)/.test(search || '');
}

export function onlineDefaults(raw) {
  const fallback = { allow: true, direct: false };
  const o = raw && raw.online;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ...fallback };
  if (typeof o.allow !== 'boolean' || typeof o.direct !== 'boolean') return { ...fallback };
  return { allow: o.allow, direct: o.direct };
}

/** Station + lobby entry: N2 is behind ?online=dev, and never when Allow is off. */
export function canShowFriendsStation(settings, search) {
  return isOnlineDev(search) && onlineDefaults(settings).allow;
}

export function parseJoinCode(search = typeof location !== 'undefined' ? location.search : '') {
  const m = /(?:\?|&)join=([^&]+)/i.exec(search || '');
  if (!m) return null;
  try { return decodeURIComponent(m[1]).trim().toLowerCase(); } catch (e) { return String(m[1] || '').toLowerCase(); }
}

/** Room-identity query keys. Keep feature flags such as online=dev / nettest / debug. */
const ROOM_PARAMS = ['join'];

/** Drop join (and any other room params) so a refresh cannot rejoin a room the player just left. */
export function stripRoomParamsFromUrl() {
  if (typeof location === 'undefined' || typeof history === 'undefined' || typeof URL === 'undefined') return;
  try {
    const u = new URL(location.href);
    let changed = false;
    for (const k of ROOM_PARAMS) {
      if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; }
    }
    if (!changed) return;
    const search = u.searchParams.toString();
    history.replaceState(history.state, '', u.pathname + (search ? '?' + search : '') + u.hash);
  } catch (e) {}
}
