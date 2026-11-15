// Shared map screen (Act 1 · Act 2 · Act 3 · Meadow overview) — Squid ui-map kit, Golden Hour Pastel.
// One component, per-act tile data from map/grid.json. Game state comes in through the ctx callbacks,
// so this file never touches saves or rounds itself. Layout + art knobs are CSS variables in map-screen.css.
import './map-screen.css';
import GRID from './map/grid.json';
import LAYOUT from './map/layout.json';

const UI = './ui/map/';
const ACT_KEYS = ['world', 'act1', 'act2', 'act3'];
const TAB_LABEL = { act1: 'Valley', act2: 'Trail', act3: 'Friends' };
const abs = p => new URL(p, document.baseURI).href;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img2x = (p, cls = '', alt = '') => `<img class="${cls}" src="${UI}${p}.png" srcset="${UI}${p}.png 1x, ${UI}${p}@2x.png 2x" alt="${alt}" draggable="false">`;

// Squid's thumbnails, data-driven: ui/map/thumbs/index.json (built from thumbs/thumbs.json by tools/map-assets.mjs)
// is fetched when the map first opens, so redone thumbs ship by re-running the sync — no rebuild.
let THUMBS = null, thumbsReq = null;
function loadThumbs(onDone) {
  if (THUMBS || thumbsReq) return;
  thumbsReq = fetch(UI + 'thumbs/index.json').then(r => (r.ok ? r.json() : null)).then(j => { THUMBS = (j && j.thumbs) || {}; onDone(); }).catch(() => { THUMBS = {}; });
}
/** <picture>: WebP with PNG fallback, 1x/@2x srcset. kind = 'tile' (94² face) | 'panel' (236×133). null if no thumb. */
export function thumbPicture(id, kind, cls = '', lazy = true) {
  const e = THUMBS?.[id]?.[kind]; if (!e) return null;
  const T = UI + 'thumbs/';
  return `<picture class="${cls}">${e.webp ? `<source type="image/webp" srcset="${T}${e.webp} 1x${e.webp2x ? `, ${T}${e.webp2x} 2x` : ''}">` : ''}<img src="${T}${e.png}"${e.png2x ? ` srcset="${T}${e.png} 1x, ${T}${e.png2x} 2x"` : ''} alt=""${lazy ? ' loading="lazy"' : ''} draggable="false"></picture>`;
}
export const hasThumb = id => !!THUMBS?.[id];

/**
 * ctx: {
 *   def(id) → PATCHES entry · gate(id) → {ok, why} · built(id) → map exists · stars(id) → save {n, challenge, seed}
 *   visited(id) · beaten(id) · current() → id · petals() → number|null · starTotals() → {got, of}
 *   fallbackThumb(id) · timed() / setTimed(b) · inHub() · actCounts(actKey) → {done, of}
 *   onSelect(id) · onPlay(id, timed) · onEnterHub() · onBack(from) · blip()
 * }
 */
export function createMapScreen(root, ctx) {
  const S = { view: 'act1', sel: { world: 'meadow_hub' }, fromWorld: false, unbuilt: 'hide' };
  root.innerHTML = `
<div id="mapScreen" class="ms" data-view="act1">
 <div class="msFrame">
  <div class="msHead">
   <button type="button" id="vBack" class="msBack" aria-label="Back">${img2x('chrome/btn-back')}</button>
   <h2 class="msTitle" id="msTitle">Valley</h2>
   <div class="msTabs" role="tablist">
    ${['act1', 'act2', 'act3'].map((k, i) => `<button type="button" role="tab" class="msTab vAct" id="vAct${i + 1}" data-view="${k}">${img2x('chrome/icon-' + k, 'msTabIc')}<span>${TAB_LABEL[k]}</span></button>`).join('')}
   </div>
   <div class="msChip" id="msPetals" title="Petals"><span class="msChipIc">🌸</span><b>0</b></div>
   <div class="msChip" id="msStars" title="Stars"><span class="msChipIc">⭐</span><b>0</b></div>
   <button type="button" class="msArrow" id="msPrev" aria-label="Previous act">${img2x('chrome/btn-arrow-prev')}</button>
   <button type="button" class="msArrow" id="msNext" aria-label="Next act">${img2x('chrome/btn-arrow-next')}</button>
  </div>
  <div class="msWell">
   <img class="msBackdrop" alt="" draggable="false">
   <div id="vGrid" class="msGrid" role="listbox" aria-label="Levels"></div>
   <div id="msWorld" class="msWorld" hidden></div>
   <div class="msWellRim" aria-hidden="true"></div>
  </div>
  <div class="msPanel" aria-live="polite">
   <div class="msThumb"><span id="msCard" class="msCard"></span><span class="msThumbEm" id="msCardEm"></span></div>
   <div class="msInfo"><div class="msName" id="msName"></div><div class="msSubline" id="msSubline"></div></div>
   <div class="msStarsRow" id="msStarsRow"></div>
   <button type="button" class="msTimed" id="vTimed" aria-pressed="false"><span>Timed</span></button>
   <button type="button" class="msPlay" id="vGo"><span id="msPlayTx">Play</span></button>
  </div>
  <p id="vSub" class="msSr"></p><p id="vA2Note" class="msSr"></p>
 </div>
</div>`;
  const $ = id => root.querySelector('#' + id);
  const el = $('mapScreen'), grid = $('vGrid'), world = $('msWorld');
  if (/[?&]mapart=css\b/.test(location.search)) el.classList.add('msCssTiles');
  // chrome art as inline custom properties with absolute URLs (keeps the PNGs out of the CSS bundle and
  // lets Squid's revised chrome drop into ui/map/ without a rebuild)
  for (const n of ['chrome/chip', 'chrome/tab', 'chrome/tab-selected', 'chrome/card-thumb-frame', 'chrome/toggle-timed-off', 'chrome/toggle-timed-on', 'chrome/btn-play-normal', 'chrome/btn-play-pressed', 'chrome/btn-play-disabled', 'chrome/map-well', 'chrome/select-panel']) {
    const a1 = abs(UI + n + '.png'), a2 = abs(UI + n + '@2x.png'), k = '--ms-' + n.split('/')[1];
    el.style.setProperty(k, `image-set(url("${a1}") 1x, url("${a2}") 2x)`);
    el.style.setProperty(k + '-1x', `url("${a1}")`);
  }

  const orient = () => (innerWidth > innerHeight ? (innerHeight <= 500 ? 'landscape_short' : 'landscape') : 'portrait');
  const backdrop = () => `${UI}backdrops/${S.view}-${orient() === 'portrait' ? 'portrait' : 'landscape'}${devicePixelRatio > 1.25 ? '@2x' : ''}.webp`;

  function tileState(t) {
    const st = ctx.stars(t.id) || null, built = ctx.built(t.id), g = ctx.gate(t.id);
    const locked = !built || !g.ok;
    const n = st?.n || 0;
    let face = locked ? 'locked' : n > 0 ? 'done' : ctx.visited(t.id) || ctx.beaten(t.id) ? 'played' : 'new';
    if (t.kind === 'tutorial' && !locked) face = ctx.beaten(t.id) || ctx.visited(t.id) ? 'played' : 'new';
    return { face, n, locked, built, why: g.why, challenge: !!st?.challenge, seed: !!st?.seed, scored: t.kind !== 'tutorial' && !locked && (n > 0 || ctx.beaten(t.id)) };
  }
  function tilesFor(key) {
    const a = GRID.acts[key];
    return a.tiles.filter(t => S.unbuilt !== 'hide' || ctx.built(t.id));
  }
  function defaultSel(key) {
    const ts = tilesFor(key), cur = ctx.current();
    if (ts.some(t => t.id === cur)) return cur;
    return (ts.find(t => ctx.built(t.id) && ctx.gate(t.id).ok && !ctx.beaten(t.id)) || ts.find(t => ctx.built(t.id)) || ts[0])?.id || null;
  }

  function renderGrid(key) {
    const cur = ctx.current(), sel = S.sel[key], list = tilesFor(key);
    if (!list.length) { grid.innerHTML = `<div class="msEmpty">${thumbPicture(key + '_region', 'panel', 'msEmptyPic', false) || ''}<b>${esc(GRID.acts[key].subtitle)} · ${esc(GRID.acts[key].title)}</b><span>New friends to rescue are on the way!</span></div>`; return; }
    grid.innerHTML = list.map(t => {
      const s = tileState(t), isSel = sel === t.id, isCur = cur === t.id;
      const face = isCur && !s.locked ? 'current' : isSel ? 'selected' : s.face;
      const d = ctx.def(t.id), pic = thumbPicture(t.id, 'tile', 'tPic'), fb = !pic && ctx.fallbackThumb?.(t.id);
      const label = `${t.n ? t.n + ' · ' : ''}${t.name}${s.locked ? ' · locked' : ''}${s.scored ? ` · ${s.n} of 3 stars` : ''}`;
      return `<button type="button" role="option" class="vt msTile${s.locked ? ' lock' : ''}${t.kind === 'tutorial' ? ' tut' : ''}${pic ? '' : ' fb'}" data-id="${t.id}" data-face="${face}" data-state="${s.face}"${isSel ? ' aria-selected="true"' : ''}${isCur ? ' data-current="1"' : ''} aria-label="${esc(label)}" title="${esc(t.name)}">
<span class="tSq"><span class="tFace" style="--face:url(${abs(UI + 'tiles/tile-' + face + '.png')});--face2x:url(${abs(UI + 'tiles/tile-' + face + '@2x.png')})"></span>
<span class="tThumb">${pic || (fb ? `<img src="${fb}" alt="" loading="lazy" draggable="false">` : '')}${pic ? '' : `<i class="tEm">${d?.emoji || ''}</i>`}</span>
${t.n ? `<span class="tNum">${t.n}</span>` : ''}
${t.kind === 'tutorial' ? img2x('nodes/badge-trail', 'tBadge') : s.challenge ? img2x('nodes/badge-challenge', 'tBadge') : ''}
${s.seed ? img2x('nodes/marker-starseed', 'tSeed') : ''}</span>
<span class="msSr">${esc(t.name)}</span><span class="tRow">${s.scored ? img2x('nodes/stars-' + Math.min(3, s.n), 'tStars') : ''}</span></button>`;
    }).join('');
  }

  function renderWorld() {
    const o = orient() === 'portrait' ? 'portrait' : 'landscape', sel = S.sel.world;
    // node u/v are fractions of the artboard's map_inner, so the overview keeps the backdrop's aspect (contain) and
    // centres it in the well; the cover-scaled backdrop underneath fills any letterbox.
    const L = LAYOUT[o].map_inner, ar = L[2] / L[3], wr = world.parentElement.getBoundingClientRect(), pad = 8;
    if (wr.width < 20) { requestAnimationFrame(() => { if (S.view === 'world' && world.parentElement.getBoundingClientRect().width >= 20) renderWorld(); }); }
    const W0 = wr.width - pad * 2, H0 = wr.height - pad * 2, w = Math.min(W0, H0 * ar), h = w / ar;
    Object.assign(world.style, { left: (pad + (W0 - w) / 2) + 'px', top: (pad + (H0 - h) / 2) + 'px', width: w + 'px', height: h + 'px', right: 'auto', bottom: 'auto' });
    world.innerHTML = `<img class="msWorldBg" src="${backdrop()}" alt="" draggable="false">` + GRID.overview.nodes.map(n => {
      const p = n[o], isSel = sel === n.id;
      const src = n.kind === 'hub' ? 'nodes/node-hub' : isSel ? 'nodes/node-current' : 'nodes/node-region';
      const c = n.opens ? ctx.actCounts(n.opens) : null;
      return `<button type="button" class="msNode vt${isSel ? ' sel' : ''}" data-id="${n.id}" data-kind="${n.kind}"${n.opens ? ` data-opens="${n.opens}"` : ''} style="left:${p.u * 100}%;top:${p.v * 100}%" aria-label="${esc(n.name)}${c ? ` · ${c.done} of ${c.of} cleared` : ''}">${img2x(src, 'msNodeImg')}${n.kind === 'hub' && isSel ? img2x('nodes/node-current', 'msNodeRing') : ''}<span class="msNodeTx">${esc(n.name)}</span></button>`;
    }).join('');
  }

  function renderPanel() {
    const key = S.view, id = S.sel[key];
    const playTx = $('msPlayTx'), go = $('vGo'), timed = $('vTimed'), card = $('msCard'), em = $('msCardEm');
    let name = '', sub = '', stars = '', ok = false, label = 'Play', emoji = '', thumbId = null;
    if (key === 'world') {
      const n = GRID.overview.nodes.find(q => q.id === id) || GRID.overview.nodes[0];
      name = n.name; thumbId = n.id;
      if (n.kind === 'hub') { sub = 'Home glade'; label = 'Enter'; ok = true; }
      else { const c = ctx.actCounts(n.opens); sub = `${GRID.acts[n.opens].subtitle} · ${c.done}/${c.of} cleared`; label = 'Open'; ok = true; }
      timed.hidden = true;
    } else {
      const t = GRID.acts[key].tiles.find(q => q.id === id);
      if (t) {
        const s = tileState(t), d = ctx.def(t.id);
        name = (t.n ? t.n + ' · ' : '') + t.name; thumbId = t.id; emoji = hasThumb(t.id) ? '' : d?.emoji || '';
        sub = !s.built ? 'Being built — opens in a new update' : !s.locked ? (d?.teach || d?.blurb || '') : '🔒 ' + (s.why || 'Locked');
        if (t.kind !== 'tutorial') stars = img2x('nodes/stars-' + Math.min(3, s.n), 'pStars', `${s.n} of 3 stars`) + (s.challenge ? img2x('nodes/badge-challenge', 'pBadge', 'Challenge star') : '') + (s.seed ? img2x('nodes/marker-starseed', 'pSeed', 'Starseed found') : '');
        else stars = (ctx.beaten(t.id) ? img2x('nodes/badge-trail', 'pBadge', 'Trail badge') + '<span class="pTx">Trail badge</span>' : '<span class="pTx">Practice · no stars</span>');
        ok = !s.locked; label = ctx.visited(t.id) && !ctx.beaten(t.id) && t.kind !== 'tutorial' ? 'Continue' : 'Play';
        timed.hidden = t.kind === 'tutorial';
      } else { name = 'Pick a level'; timed.hidden = false; }
    }
    $('msName').textContent = name; $('msSubline').textContent = sub; $('msStarsRow').innerHTML = stars;
    const pic = thumbId && thumbPicture(thumbId, 'panel', 'msCardPic', false), fb = !pic && thumbId && ctx.fallbackThumb?.(thumbId);
    card.innerHTML = pic || (fb ? `<img src="${fb}" alt="" draggable="false">` : ''); card.hidden = !pic && !fb;
    em.textContent = emoji;
    playTx.textContent = label; go.disabled = !ok; go.dataset.kind = key === 'world' ? (id === 'meadow_hub' ? 'hub' : 'region') : 'level';
    const on = !!ctx.timed(); timed.setAttribute('aria-pressed', String(on)); timed.classList.toggle('on', on);
  }

  function renderHead() {
    const key = S.view;
    el.dataset.view = key; el.dataset.orient = orient();
    $('msTitle').textContent = key === 'world' ? GRID.overview.title : GRID.acts[key].title;
    for (const b of root.querySelectorAll('.msTab')) { const on = b.dataset.view === key; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
    const p = ctx.petals(); $('msPetals').hidden = p == null; $('msPetals').querySelector('b').textContent = p ?? '';
    const st = ctx.starTotals(); $('msStars').querySelector('b').textContent = `${st.got}/${st.of}`;
    $('vBack').setAttribute('aria-label', key !== 'world' && S.fromWorld ? 'Back to Meadow map' : ctx.inHub() ? 'Back to Hub' : 'Back to title');
    const bd = root.querySelector('.msBackdrop'), u = backdrop(); if (bd.getAttribute('src') !== u) bd.src = u;
    // status lines kept for tests + screen readers
    const c = key === 'world' ? null : ctx.actCounts(key);
    $('vSub').textContent = key === 'world' ? 'Meadow · pick an act or enter the Hub' : `${GRID.acts[key].subtitle} · ${c.done}/${c.of} cleared · pick a level, then Play`;
    $('vA2Note').textContent = ctx.gatesOff?.() ? 'Every level is open — play in any order.' : '';
  }

  function render() {
    loadThumbs(() => { if (root.classList.contains('on')) render(); });
    if (S.view !== 'world' && !S.sel[S.view]) S.sel[S.view] = defaultSel(S.view);
    renderHead();
    const w = S.view === 'world'; grid.hidden = w; world.hidden = !w;
    if (w) renderWorld(); else renderGrid(S.view);
    renderPanel();
    const selEl = root.querySelector(`.msTile[aria-selected="true"]`);
    if (selEl && !w) { const g = grid.getBoundingClientRect(), r = selEl.getBoundingClientRect(); if (r.bottom > g.bottom || r.top < g.top) selEl.scrollIntoView({ block: 'nearest' }); }
    if (!w) ctx.onSelect?.(S.sel[S.view]);
  }

  function show(view, opts = {}) {
    if (!ACT_KEYS.includes(view)) view = 'act1';
    if (view === 'world') S.fromWorld = false;
    else if (opts.fromWorld != null) S.fromWorld = !!opts.fromWorld;
    S.view = view; if (opts.sel) S.sel[view] = opts.sel;
    render();
  }

  // ---- input ----
  grid.addEventListener('click', e => { const b = e.target.closest('.msTile'); if (!b) return; ctx.blip?.(); S.sel[S.view] = b.dataset.id; render(); });
  grid.addEventListener('dblclick', e => { const b = e.target.closest('.msTile'); if (b && !$('vGo').disabled) $('vGo').click(); });
  world.addEventListener('click', e => {
    const b = e.target.closest('.msNode'); if (!b) return; ctx.blip?.();
    if (b.dataset.opens) { S.sel.world = b.dataset.id; show(b.dataset.opens, { fromWorld: true }); }
    else { S.sel.world = b.dataset.id; render(); }
  });
  root.querySelector('.msTabs').addEventListener('click', e => { const b = e.target.closest('.msTab'); if (!b) return; ctx.blip?.(); show(b.dataset.view, { fromWorld: S.view === 'world' || S.fromWorld }); });
  const step = d => { const order = ['world', 'act1', 'act2', 'act3'], i = order.indexOf(S.view); ctx.blip?.(); show(order[(i + d + order.length) % order.length], { fromWorld: S.fromWorld || S.view === 'world' }); };
  $('msPrev').onclick = () => step(-1); $('msNext').onclick = () => step(1);
  $('vBack').onclick = () => { ctx.blip?.(); if (S.view !== 'world' && S.fromWorld) { show('world'); return; } ctx.onBack?.(S.view); };
  $('vTimed').onclick = () => { ctx.setTimed(!ctx.timed()); ctx.blip?.(); renderPanel(); };
  $('vGo').onclick = () => {
    if ($('vGo').disabled) return;
    if (S.view === 'world') { const id = S.sel.world, n = GRID.overview.nodes.find(q => q.id === id); if (!n || n.kind === 'hub') ctx.onEnterHub?.(); else show(n.opens, { fromWorld: true }); return; }
    const id = S.sel[S.view]; if (id) ctx.onPlay?.(id, !!ctx.timed() && GRID.acts[S.view].tiles.find(t => t.id === id)?.kind !== 'tutorial');
  };
  addEventListener('keydown', e => {
    if (!root.classList.contains('on')) return;
    if (e.key === 'Escape') { e.preventDefault(); $('vBack').click(); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target === document.body) { e.preventDefault(); $('vGo').click(); }
  });

  return {
    el, GRID,
    show, render,
    get view() { return S.view; },
    get selected() { return S.sel[S.view] || null; },
    select(id) { const k = actOf(id); if (k) { S.sel[k] = id; if (S.view !== k && S.view !== 'world') S.view = k; } },
    /** 'hide' (default, Fern GATE-03 / polish rule: no listed level may be unplayable): only built levels get tiles.
     *  'show': every level in grid.json gets a tile; unbuilt ones use the locked face and Play is off. */
    setUnbuilt(mode) { S.unbuilt = mode === 'hide' ? 'hide' : 'show'; },
  };
}
export function actOf(id) { for (const k of ['act1', 'act2', 'act3']) if (GRID.acts[k].tiles.some(t => t.id === id)) return k; return null; }
export const MAP_GRID = GRID;
