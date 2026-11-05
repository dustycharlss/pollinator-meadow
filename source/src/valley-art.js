// Squid P0 + Beans mapping (overhaul-123 §9). Paths under public/ui + textures/fx.
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
const U = (...p) => BASE + p.join('/');

/** rect = [x,y,w,h] art px; rect_norm = [x,y,w,h] / map size for letterboxed hit-test */
export const MAP = {
  portrait: {
    file: U('ui/valley/valley-map-portrait.png'), w: 1080, h: 1920,
    slots: [
      { patch: 'sunny_hollow', rect: [216, 1562, 216, 216], rect_norm: [0.2, 0.8135, 0.2, 0.1125] },
      { patch: 'creek_bend', rect: [648, 1370, 216, 216], rect_norm: [0.6, 0.7135, 0.2, 0.1125] },
      { patch: 'moon_meadow', rect: [205, 1169, 216, 216], rect_norm: [0.1898, 0.6089, 0.2, 0.1125] },
      { patch: 'log_jam', rect: [659, 967, 216, 216], rect_norm: [0.6102, 0.5036, 0.2, 0.1125] },
      { patch: 'picnic_lawn', rect: [216, 766, 216, 216], rect_norm: [0.2, 0.399, 0.2, 0.1125] },
      { patch: 'cliff_orchard', rect: [648, 564, 216, 216], rect_norm: [0.6, 0.2938, 0.2, 0.1125] },
      { patch: 'windy_rise', rect: [216, 362, 216, 216], rect_norm: [0.2, 0.1885, 0.2, 0.1125] },
      { patch: 'festival_glade', rect: [605, 151, 216, 216], rect_norm: [0.5602, 0.0786, 0.2, 0.1125] },
    ],
  },
  landscape: {
    file: U('ui/valley/valley-map-landscape.png'), w: 1920, h: 1080,
    slots: [
      { patch: 'sunny_hollow', rect: [65, 691, 216, 216], rect_norm: [0.0339, 0.6398, 0.1125, 0.2] },
      { patch: 'creek_bend', rect: [276, 302, 216, 216], rect_norm: [0.1437, 0.2796, 0.1125, 0.2] },
      { patch: 'moon_meadow', rect: [506, 691, 216, 216], rect_norm: [0.2635, 0.6398, 0.1125, 0.2] },
      { patch: 'log_jam', rect: [737, 302, 216, 216], rect_norm: [0.3839, 0.2796, 0.1125, 0.2] },
      { patch: 'picnic_lawn', rect: [967, 691, 216, 216], rect_norm: [0.5036, 0.6398, 0.1125, 0.2] },
      { patch: 'cliff_orchard', rect: [1198, 302, 216, 216], rect_norm: [0.624, 0.2796, 0.1125, 0.2] },
      { patch: 'windy_rise', rect: [1428, 691, 216, 216], rect_norm: [0.7438, 0.6398, 0.1125, 0.2] },
      { patch: 'festival_glade', rect: [1639, 302, 216, 216], rect_norm: [0.8536, 0.2796, 0.1125, 0.2] },
    ],
  },
};

export function thumbUrl(patchId, state) {
  // thumbs 256 art → ~128 CSS; in_progress → wilted + heal %
  const st = state === 'in_progress' ? 'wilted' : (state === 'blooming' || state === 'wild' ? state : 'wilted');
  return U('ui/valley/thumbs', `${patchId}-${st}.png`);
}

export function isLandscape() {
  return window.matchMedia('(orientation: landscape)').matches || window.innerWidth > window.innerHeight;
}

/** Map image client rect (letterbox-safe). */
export function mapScreenRect() {
  const img = document.getElementById('vMapImg');
  if (!img) return null;
  const r = img.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Hit-test screen point → patch id using rect_norm × map screen size. */
export function hitTestMap(sx, sy) {
  const box = mapScreenRect();
  if (!box || box.w <= 0 || box.h <= 0) return null;
  const layout = isLandscape() ? MAP.landscape : MAP.portrait;
  const u = (sx - box.x) / box.w;
  const v = (sy - box.y) / box.h;
  if (u < 0 || v < 0 || u > 1 || v > 1) return null;
  for (const s of layout.slots) {
    const [nx, ny, nw, nh] = s.rect_norm;
    if (u >= nx && u <= nx + nw && v >= ny && v <= ny + nh) return s.patch;
  }
  return null;
}

/** Paint Squid valley map + patch thumbs into #vMapStage / #vSlots */
export function paintValleyMap(opts) {
  const stage = document.getElementById('vMapStage');
  const img = document.getElementById('vMapImg');
  const slots = document.getElementById('vSlots');
  if (!stage || !img || !slots) return;
  const layout = isLandscape() ? MAP.landscape : MAP.portrait;
  if (img.dataset.file !== layout.file) {
    img.src = layout.file;
    img.dataset.file = layout.file;
    img.width = layout.w;
    img.height = layout.h;
  }
  slots.innerHTML = '';
  const { getState, selected, onSelect } = opts;
  for (const s of layout.slots) {
    const [nx, ny, nw, nh] = s.rect_norm;
    const st = getState(s.patch) || { state: 'wilted', heal: 0 };
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vSlot' + (selected === s.patch ? ' sel' : '') + (st.state === 'wild' ? ' wild' : '');
    // Beans: position via rect_norm (same as rect_px / map) so letterbox hit areas stay aligned
    b.style.left = (nx * 100) + '%';
    b.style.top = (ny * 100) + '%';
    b.style.width = (nw * 100) + '%';
    b.style.height = (nh * 100) + '%';
    b.dataset.patch = s.patch;
    const showHeal = st.state === 'in_progress' || (st.state === 'wilted' && st.heal > 0);
    const pct = Math.round((st.heal || 0) * 100);
    b.innerHTML = `<img alt="" draggable="false" src="${thumbUrl(s.patch, st.state)}"><span class="vHp"${showHeal || st.state === 'blooming' ? '' : ' hidden'}>${pct}%</span>`;
    b.onclick = (ev) => {
      ev.stopPropagation();
      onSelect?.(s.patch);
    };
    slots.appendChild(b);
  }
  // stage tap uses rect_norm × screen for letterboxed hit-test
  stage.onclick = (ev) => {
    if (ev.target.closest?.('.vSlot')) return;
    const id = hitTestMap(ev.clientX, ev.clientY);
    if (id) onSelect?.(id);
  };
}

/** Mount / refresh Squid heal flower. heal 0..1
 *  clip_top_y (art) = 270 - (270-22)*heal/100; or stages frame = round(heal/10)
 */
export function setHealArt(heal) {
  const stage = document.getElementById('healStage');
  const pill = document.getElementById('healPct');
  const fillWrap = document.getElementById('healFillWrap');
  const h = Math.max(0, Math.min(1, heal || 0));
  const pct = Math.round(h * 100);
  if (pill) pill.textContent = pct + '%';
  if (stage) {
    const frame = Math.max(0, Math.min(10, Math.round(pct / 10)));
    stage.style.backgroundPosition = `${-frame * 128}px 0`;
  }
  if (fillWrap) {
    const clipArt = 270 - (270 - 22) * (pct / 100);
    fillWrap.style.clipPath = `inset(${clipArt / 2}px 0 0 0)`; // 2x art → CSS
  }
  document.getElementById('healMeter')?.classList.toggle('packTick', pct >= 85);
}

/** Pack Up petal burst. Art frame 192, display 96 CSS; anchor art [96,150].
 *  hide building on frame 2; refund pop on frame 4; 10 frames @ 20 fps.
 */
export function playPackupBurst(sx, sy, cbs = {}) {
  const el = document.createElement('div');
  el.className = 'packFx';
  const AX = 96 / 2;   // art anchor x 96 → CSS
  const AY = 150 / 2;  // art anchor y 150 → CSS
  el.style.left = (sx - AX) + 'px';
  el.style.top = (sy - AY) + 'px';
  document.body.appendChild(el);
  let frame = 0;
  const tick = () => {
    el.style.backgroundPosition = `${-frame * 96}px 0`;
    if (frame === 2) cbs.onHide?.();
    if (frame === 4) cbs.onRefund?.();
    frame++;
    if (frame >= 10) { el.remove(); cbs.onDone?.(); return; }
    setTimeout(tick, 50); // 20 fps
  };
  tick();
  return el;
}

export const STAMPS = {
  dance_off: U('ui/contest/stamp-dance_off.png'),
  pollen_relay: U('ui/contest/stamp-pollen_relay.png'),
  decorating: U('ui/contest/stamp-decorating.png'),
  good_game: U('ui/contest/stamp-good_game.png'),
};

export function stampUrl(id) { return STAMPS[id] || STAMPS.good_game; }

/** Invite ring: 8 frames @ 10 fps, display 192 CSS; accept within trigger_radius_uv of center. */
export const INVITE_RING = {
  strip: U('ui/contest/contest-invite-ring-strip.png'),
  still: U('ui/contest/contest-invite-ring-still.png'),
  frameW: 192,
  frames: 8,
  fps: 10,
  triggerRadiusUv: 0.39,
};

/** True if (sx,sy) is inside the invite ring's accept radius (trigger_radius_uv × width). */
export function inviteRingAccepts(sx, sy, ringEl) {
  const el = ringEl || document.getElementById('cvInvRing');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const rad = INVITE_RING.triggerRadiusUv * r.width;
  return Math.hypot(sx - cx, sy - cy) <= rad;
}
