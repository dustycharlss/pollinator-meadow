// First-time interaction tip popups (l20m). Text only the first time per kind, per save
// in localStorage. Afterwards the caller plays a sound and a small sparkle instead.
// The new-move unlock tray (tips-ui.js TRAY_MS = 16 s) is separate and stays unchanged.
export const INTERACT_TIPS_KEY = 'pm-interact-tips-v1';
export const TIP_MS = 10000;

function load() {
  try { return JSON.parse(localStorage.getItem(INTERACT_TIPS_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function save(v) {
  try { localStorage.setItem(INTERACT_TIPS_KEY, JSON.stringify(v)); } catch (e) {}
}

export function seenInteractTip(kind) { return !!load()[kind]; }
export function markInteractTip(kind) { const v = load(); if (v[kind]) return false; v[kind] = 1; save(v); return true; }
export function resetInteractTips() { try { localStorage.removeItem(INTERACT_TIPS_KEY); } catch (e) {} }

/** Returns true on the first use of this kind (and records it). */
export function noteInteractTip(kind) { return markInteractTip(kind); }

export function interactTipsState() { return { ...load() }; }
