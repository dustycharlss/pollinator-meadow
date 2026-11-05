// Front-door art (Squid Job 14): splash / title / results backdrops with slot-placed UI.
// Backdrops are <img class="fdBg"> with object-fit: cover (centred). Slots come from front-door-manifest.json `norm`
// rects mapped through the same cover transform, then nudged/shrunk to stay inside the viewport's safe area.
const P = [1080, 1920], L = [1920, 1080];
const SL = {
  title: { p: { logo: [0.0833, 0.0938, 0.8333, 0.176], 'button-challenge': [0.2593, 0.5208, 0.4815, 0.0875], 'button-relaxed': [0.2593, 0.625, 0.4815, 0.0875] },
           l: { logo: [0.3047, 0.0556, 0.3906, 0.2602], 'button-challenge': [0.3646, 0.3889, 0.2708, 0.1556], 'button-relaxed': [0.3646, 0.5741, 0.2708, 0.1556] } },
  splash: { p: { logo: [0.1296, 0.2708, 0.7407, 0.1562], 'progress-bar': [0.1667, 0.651, 0.6667, 0.05], 'loading-text': [0.2222, 0.7135, 0.5556, 0.0365] },
            l: { logo: [0.3047, 0.1019, 0.3906, 0.2602], 'progress-bar': [0.3125, 0.7037, 0.375, 0.0889], 'loading-text': [0.3438, 0.8074, 0.3125, 0.0556] } },
  results: { p: { header: [0.1296, 0.0885, 0.7407, 0.1042], 'rank-1': [0.4259, 0.5901, 0.1481, 0.0833], 'rank-2': [0.2333, 0.637, 0.1481, 0.0833], 'rank-3': [0.6185, 0.6734, 0.1481, 0.0833], 'rank-4': [0.0407, 0.6964, 0.1481, 0.0833], panel: [0.0833, 0.8281, 0.8333, 0.1146], 'stand-1': [0.5, 0.5625, 0, 0] },
             l: { header: [0.2917, 0.037, 0.4167, 0.1574], 'rank-1': [0.4531, 0.5204, 0.0938, 0.1667], 'rank-2': [0.3229, 0.6037, 0.0938, 0.1667], 'rank-3': [0.5833, 0.6685, 0.0938, 0.1667], 'rank-4': [0.1927, 0.6991, 0.0938, 0.1667], panel: [0.7292, 0.2593, 0.2448, 0.4815], 'stand-1': [0.5, 0.463, 0, 0] } }
};
const BG = { title: 'title-bg', splash: 'splash-bg', results: 'results-bg' };
let probe = null;
function insets() {
  if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe); }
  const c = getComputedStyle(probe); return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
}
/** cover transform for the current viewport */
export function cover() {
  const vw = innerWidth, vh = innerHeight, o = vw > vh ? 'l' : 'p', [iw, ih] = o === 'l' ? L : P, s = Math.max(vw / iw, vh / ih);
  return { vw, vh, o, iw, ih, s, ox: (vw - iw * s) / 2, oy: (vh - ih * s) / 2 };
}
/** screen rect of a slot (clamped into the safe area unless raw) */
export function slotRect(name, slot, raw = false) {
  const C = cover(), n = SL[name][C.o][slot]; if (!n) return null;
  let w = n[2] * C.iw * C.s, h = n[3] * C.ih * C.s, x = C.ox + n[0] * C.iw * C.s, y = C.oy + n[1] * C.ih * C.s;
  if (raw) return { x, y, w, h };
  const I = insets(), lo = I.l + 4, to = I.t + 4, ro = C.vw - I.r - 4, bo = C.vh - I.b - 4;
  const k = Math.min(1, (ro - lo) / (w || 1), (bo - to) / (h || 1)); if (k < 1) { x += (w - w * k) / 2; y += (h - h * k) / 2; w *= k; h *= k; }
  x = Math.min(Math.max(x, lo), ro - w); y = Math.min(Math.max(y, to), bo - h); return { x, y, w, h };
}
const put = (el, r) => Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
/** place every [data-slot] in root, swap the backdrop for the orientation; returns the cover info */
export function layout(root, name) {
  if (!root || !root.isConnected) return null;
  const C = cover(), bg = root.querySelector(':scope > .fdBg');
  if (bg) { const src = `./ui/screens/${BG[name]}-${C.o === 'l' ? 'landscape' : 'portrait'}.webp`; if (bg.getAttribute('src') !== src) bg.setAttribute('src', src); }
  for (const el of root.querySelectorAll('[data-slot]')) { const r = slotRect(name, el.dataset.slot); if (r) put(el, r); }
  root.dataset.o = C.o; return C;
}
const live = new Map();
/** keep a screen laid out across resize / orientation change; extra(C) runs after the slots are placed */
export function track(root, name, extra) {
  const f = () => { const C = layout(root, name); if (C && extra) extra(C); };
  live.set(root, f); f(); return f;
}
let tmr = 0; const all = () => { for (const [r, f] of live) { if (!r.isConnected) live.delete(r); else f(); } };
addEventListener('resize', all); addEventListener('orientationchange', () => { clearTimeout(tmr); tmr = setTimeout(all, 120); });
/** splash progress: p in 0..1 */
export function setFill(p) {
  const f = document.getElementById('loadBar'); if (!f) return;
  f.style.width = `max(var(--fh, 10px), ${Math.max(0, Math.min(1, p)) * 100}%)`;
}
