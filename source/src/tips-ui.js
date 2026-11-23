// Picture tips from ui/tips/index.json (built from the tips kit). Data-driven:
// level id → mechanic ids → strip files, alt text, and a voice_line_id.
import './tips-ui.css';

const DIR = './ui/tips/';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let spec = null, loading = null;
let voice = { speak() {}, stop() {}, enabled: () => false, preload() {} };
let tray = null, trayTimer = 0, shownLevel = null;

export function bindVoice(api) { voice = Object.assign(voice, api || {}); }

export function loadTips() {
  if (spec) return Promise.resolve(spec);
  if (loading) return loading;
  const url = new URL(DIR + 'index.json', document.baseURI).href;
  loading = fetch(url).then(r => r.ok ? r.json() : null).then(j => { spec = j || { levels: [], strips: {} }; return spec; })
    .catch(() => { loading = null; spec = { levels: [], strips: {} }; return spec; });
  return loading;
}

export function tipsLevel(id) {
  return spec?.levels?.find(L => L.id === id) || null;
}

export function tipsForLevel(id, { onlyNew } = {}) {
  const L = tipsLevel(id); if (!L) return null;
  let tips = (L.tips || []).map(t => {
    const s = spec.strips?.[t.mechanic_id]; if (!s) return null;
    const voice_ids = [...(s.voice_ids || [])];
      if (s.voice_line_id && !voice_ids.includes(s.voice_line_id)) voice_ids.unshift(s.voice_line_id);
      return { mechanic_id: t.mechanic_id, isNew: !!t.new, files: s.files, alt: s.alt || '', voice_line_id: s.voice_line_id || voice_ids[0] || null, voice_ids, name: L.name, number: L.number };
  }).filter(Boolean);
  if (onlyNew) {
    const neu = tips.filter(t => t.isNew);
    if (neu.length) tips = neu;
  }
  return tips.length ? { level: L, tips } : null;
}

function picture(files, alt) {
  const webpSet = [files.webp && `${DIR}${files.webp} 1x`, files['webp@2x'] && `${DIR}${files['webp@2x']} 2x`].filter(Boolean).join(', ');
  const pngSet = [files.png && `${DIR}${files.png} 1x`, files['png@2x'] && `${DIR}${files['png@2x']} 2x`].filter(Boolean).join(', ');
  const fallback = files.png || files.webp;
  return `<picture>${files.webp ? `<source type="image/webp" srcset="${webpSet}">` : ''}<img src="${DIR}${esc(fallback)}"${pngSet ? ` srcset="${pngSet}"` : ''} alt="${esc(alt)}" draggable="false"></picture>`;
}

function selectTip(root, i, { play } = {}) {
  const cards = [...root.querySelectorAll('.tipCard')];
  const dots = [...root.querySelectorAll('.tipsDots button')];
  cards.forEach((c, n) => c.classList.toggle('on', n === i));
  dots.forEach((d, n) => d.classList.toggle('on', n === i));
  const card = cards[i]; if (!card) return;
  card.scrollIntoView({ behavior: document.documentElement.classList.contains('reduceMotion') ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
  const ids = (card.dataset.voice || '').split(',').map(s => s.trim()).filter(Boolean);
  if (play && ids.length && voice.enabled()) voice.speak(ids);
}

export function mountTips(el, pack, opts = {}) {
  if (!el) return;
  const tips = pack?.tips || [];
  if (!tips.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const label = opts.label || (pack.level ? `Tips for ${pack.level.name}` : 'How to play tips');
  el.innerHTML = `<div class="tipsRail" role="region" aria-label="${esc(label)}"><div class="tipsTrack">${tips.map((t, i) =>
    `<button type="button" class="tipCard${i === 0 ? ' on' : ''}" data-i="${i}" data-voice="${esc((t.voice_ids && t.voice_ids.length ? t.voice_ids : [t.voice_line_id]).filter(Boolean).join(','))}" aria-label="${esc(t.alt || t.mechanic_id)}">${picture(t.files, t.alt || '')}${t.isNew ? '<span class="tipNew">New</span>' : ''}</button>`
  ).join('')}</div>${tips.length > 1 ? `<div class="tipsDots">${tips.map((_, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'on' : ''}" aria-label="Tip ${i + 1}"></button>`).join('')}</div>` : ''}</div>`;
  const rail = el.querySelector('.tipsRail');
  rail.addEventListener('click', ev => {
    ev.stopPropagation();
    const btn = ev.target.closest('[data-i]');
    if (!btn) return;
    selectTip(el, +btn.dataset.i, { play: true });
  });
  const ids = tips.flatMap(t => t.voice_ids || (t.voice_line_id ? [t.voice_line_id] : []));
  voice.preload?.(ids);
  if (opts.play !== false && voice.enabled() && ids.length) voice.speak(tips[0].voice_ids || tips[0].voice_line_id);
}

export function preloadTips(id) {
  loadTips().then(() => {
    const pack = tipsForLevel(id); if (!pack) return;
    const hi = typeof devicePixelRatio === 'number' && devicePixelRatio > 1.25;
    for (const t of pack.tips) {
      const f = (hi && t.files['webp@2x']) || t.files.webp || (hi && t.files['png@2x']) || t.files.png;
      if (f) { const img = new Image(); img.src = new URL(DIR + f, document.baseURI).href; }
    }
    voice.preload?.(pack.tips.flatMap(t => t.voice_ids || (t.voice_line_id ? [t.voice_line_id] : [])));
  });
}

function ensureTray() {
  if (tray) return tray;
  tray = document.createElement('div');
  tray.id = 'tipsTray';
  tray.hidden = true;
  tray.innerHTML = '<div class="tipsInner"><button type="button" class="tipsX" aria-label="Close tips">×</button><div class="tipsMount"></div></div>';
  const x = tray.querySelector('.tipsX');
  x.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); dismissLevelTips(); });
  for (const k of ['pointerdown', 'touchstart']) x.addEventListener(k, ev => ev.stopPropagation(), { passive: true });
  // Reading hold: no auto-hide while a finger or the mouse is on the tray; re-arm the full time after it leaves.
  const inner = tray.querySelector('.tipsInner');
  inner.addEventListener('pointerenter', () => { trayHold = true; if (trayTimer) { clearTimeout(trayTimer); trayTimer = 0; } });
  inner.addEventListener('pointerdown', () => { trayHold = true; if (trayTimer) { clearTimeout(trayTimer); trayTimer = 0; } });
  inner.addEventListener('pointerleave', () => { trayHold = false; if (!tray.hidden) armTrayHide(); });
  inner.addEventListener('pointerup', ev => { if (ev.pointerType !== 'mouse') { trayHold = false; if (!tray.hidden) armTrayHide(); } });
  document.body.appendChild(tray);
  return tray;
}

// New-move tips stay up twice as long as before (8 s → 16 s) and never hide while held (see ensureTray); the big X closes them.
export const TRAY_MS = 16000;
let trayHold = false;
function armTrayHide() {
  if (trayTimer) clearTimeout(trayTimer);
  trayTimer = 0; if (trayHold) return;
  trayTimer = setTimeout(() => dismissLevelTips(), TRAY_MS);
}

export function dismissLevelTips() {
  if (trayTimer) { clearTimeout(trayTimer); trayTimer = 0; }
  trayHold = false; shownLevel = null;
  if (tray) { tray.hidden = true; tray.classList.remove('on'); const m = tray.querySelector('.tipsMount'); if (m) m.innerHTML = ''; }
  const slot = document.querySelector('#introCard .icTips');
  if (slot) { slot.hidden = true; slot.innerHTML = ''; }
  voice.stop?.();
}

/** Mount tips under the intro card. Returns whether any tips were attached. */
export function attachIntroTips(root, id, opts = {}) {
  if (window.T && !opts.force) return false;
  const slot = root?.querySelector('.icTips'); if (!slot || !spec) return false;
  const pack = tipsForLevel(id, { onlyNew: true });
  if (!pack) { slot.hidden = true; slot.innerHTML = ''; root.classList.remove('icHasTips'); return false; }
  shownLevel = id;
  root.classList.add('icHasTips');
  mountTips(slot, pack, { play: opts.play !== false, label: pack.level.name + ' tips' });
  return true;
}

/** After the intro card times out, leave a non-blocking tray so a quick start isn't blocked. */
export function parkIntroTips() {
  const slot = document.querySelector('#introCard .icTips');
  if (!slot || slot.hidden || !slot.querySelector('.tipCard')) { dismissLevelTips(); return; }
  const html = slot.innerHTML;
  slot.hidden = true; slot.innerHTML = '';
  const t = ensureTray();
  t.querySelector('.tipsMount').innerHTML = html;
  const mount = t.querySelector('.tipsMount');
  mount.addEventListener('click', ev => {
    ev.stopPropagation();
    const btn = ev.target.closest('[data-i]');
    if (!btn) return;
    selectTip(mount, +btn.dataset.i, { play: true });
    armTrayHide();
  });
  t.hidden = false; t.classList.add('on');
  armTrayHide();
}

/** Show a non-blocking tray when a level has tips but no intro card. */
export function showTipsTray(id, opts = {}) {
  if (window.T && !opts.force) return false;
  const pack = tipsForLevel(id, { onlyNew: true }); if (!pack) return false;
  shownLevel = id;
  const t = ensureTray();
  mountTips(t.querySelector('.tipsMount'), pack, { play: opts.play !== false, label: pack.level.name + ' tips' });
  t.hidden = false; t.classList.add('on');
  armTrayHide();
  return true;
}

export async function presentLevelTips(id, opts = {}) {
  await loadTips();
  const root = document.getElementById('introCard');
  const cardOn = root && !root.hidden && root.classList.contains('on') && root.dataset.id === id;
  if (cardOn) return attachIntroTips(root, id, opts);
  return showTipsTray(id, opts);
}

export function fillHowTips(levelId) {
  const box = document.getElementById('howTips'); if (!box) return Promise.resolve(false);
  return loadTips().then(() => {
    const pack = levelId ? tipsForLevel(levelId) : null;
    if (!pack) { box.hidden = true; box.innerHTML = ''; return false; }
    mountTips(box, pack, { play: true, label: `How to play · ${pack.level.name}` });
    return true;
  });
}

export function howTipsLevel() { return shownLevel; }
