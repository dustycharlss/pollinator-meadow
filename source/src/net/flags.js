/** Query flags and Online settings helpers (§4.1, §6 N2). */

export function isOnlineDev(search = typeof location !== 'undefined' ? location.search : '') {
  return /(?:\?|&)online=dev(?:&|$)/.test(search || '');
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
