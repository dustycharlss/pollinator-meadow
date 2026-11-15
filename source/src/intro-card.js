// Level intro cards: textless 16:9 art with the level title overlaid in the safe area.
// Paths, title colour and shadow are per-card fields in map/cards.json (built from the manifests
// by tools/map-assets.mjs), so redone art ships by re-running the sync.
import './intro-card.css';
import SPEC from './map/cards.json';

const DIR = './ui/map/cards/';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const INTRO_CARDS = SPEC;
export function cardFor(id) { return SPEC.cards?.[id] || null; }
export const hasIntroCard = id => !!cardFor(id);

function reduced() {
  return document.documentElement.classList.contains('reduceMotion')
    || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

let root = null, timer = 0, onDone = null, shownId = null;

function ensure() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'introCard';
  root.className = 'ic';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = '<button type="button" class="icHit" aria-label="Skip"><span class="icFrame"><span class="icPic"></span><span class="icTitle"></span></span></button>';
  root.querySelector('.icHit').addEventListener('click', () => dismissIntroCard());
  document.body.appendChild(root);
  return root;
}

export function introCardId() { return shownId; }

export function dismissIntroCard() {
  if (timer) { clearTimeout(timer); timer = 0; }
  const cb = onDone; onDone = null; shownId = null;
  if (root && !root.hidden) { root.hidden = true; root.classList.remove('on', 'icStill'); }
  cb?.();
}

export function preloadIntroCard(id) {
  const c = cardFor(id); if (!c) return;
  const hi = typeof devicePixelRatio === 'number' && devicePixelRatio > 1.25;
  const file = (hi && c.webp2x) || c.webp || (hi && c.png2x) || c.png;
  if (!file) return;
  const img = new Image();
  img.src = new URL(DIR + file, document.baseURI).href;
}

export function showIntroCard(id, opts = {}) {
  const c = cardFor(id);
  const done = opts.onDone;
  if (!c) { done?.(); return { shown: false, dismiss: dismissIntroCard }; }
  // Fern injects window.T and starts levels through T.start / #vGo. Skip the overlay so
  // tests can act immediately. Screenshots and manual checks pass { force: true }.
  if (window.T && !opts.force) { done?.(); return { shown: false, dismiss: dismissIntroCard }; }
  if (timer) { clearTimeout(timer); timer = 0; }
  if (shownId && onDone) { const prev = onDone; onDone = null; prev(); }
  onDone = done || null;
  shownId = id;
  const el = ensure();
  const label = (c.n ? c.n + ' · ' : '') + (c.title || '');
  const uv = c.safeArea?.uv || SPEC.safeArea?.uv || { x: 0.1, y: 0.0444, w: 0.8, h: 0.2667 };
  const webpSet = [c.webp && `${DIR}${c.webp} 1x`, c.webp2x && `${DIR}${c.webp2x} 2x`].filter(Boolean).join(', ');
  const pngSet = [c.png && `${DIR}${c.png} 1x`, c.png2x && `${DIR}${c.png2x} 2x`].filter(Boolean).join(', ');
  const fallback = c.png || c.webp;
  el.querySelector('.icPic').innerHTML = `<picture>${c.webp ? `<source type="image/webp" srcset="${webpSet}">` : ''}<img src="${DIR}${fallback}"${pngSet ? ` srcset="${pngSet}"` : ''} alt="${esc(label)}" draggable="false"></picture>`;
  const tx = el.querySelector('.icTitle');
  tx.textContent = label;
  tx.style.color = c.color || SPEC.defaultTitle?.color || '#3b2614';
  tx.style.textShadow = c.shadow || SPEC.defaultTitle?.shadow || '';
  tx.style.left = (uv.x * 100) + '%';
  tx.style.top = (uv.y * 100) + '%';
  tx.style.width = (uv.w * 100) + '%';
  tx.style.height = (uv.h * 100) + '%';
  el.dataset.id = id;
  el.dataset.theme = c.theme || '';
  el.setAttribute('aria-label', label);
  const still = !!(opts.reduceMotion || reduced());
  el.classList.toggle('icStill', still);
  el.hidden = false;
  el.classList.add('on');
  el.querySelector('.icHit').focus({ preventScroll: true });
  const hold = opts.holdMs != null ? opts.holdMs : (SPEC.holdMs ?? 2500);
  if (hold > 0) timer = setTimeout(() => dismissIntroCard(), hold);
  return { shown: true, dismiss: dismissIntroCard };
}
