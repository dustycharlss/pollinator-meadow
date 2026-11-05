// Asset lookup layer: teammate icons/GLBs are picked up from public/asset-manifest.json (written by tools/syncassets.mjs).
// Everything has an emoji / procedural fallback, so missing files never block the game.
import { loadGLB } from './models.js';
const BASE = import.meta.env.BASE_URL;
let icons = new Map(), glyphs = new Map(), models = {}; const subs = [];
export const assetsReady = fetch(BASE + 'asset-manifest.json').then(r => r.ok ? r.json() : null).catch(() => null).then(m => {
  if (m) { for (const f of m.icons || []) icons.set(f.replace(/\.\w+$/, ''), BASE + 'ui/icons/' + f); for (const f of m.glyphs || []) glyphs.set(f.replace(/\.\w+$/, ''), BASE + 'ui/icons/glyph/' + f); models = m.models || {}; }
  for (const f of subs) f();
});
export const onAssets = f => subs.push(f);
export const kebab = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** first existing icon among candidate names (string or array). */
export const iconUrl = (names, glyph) => { const M = glyph && glyphs.size ? glyphs : icons; for (const n of [].concat(names)) if (n && M.has(n)) return M.get(n); return null; };
/** <img> if an icon file exists for `name`, else the emoji. */
export const ico = (name, emoji, glyph) => { const u = iconUrl(name, glyph); return u ? `<img class="ico" src="${u}" alt="${emoji || ''}" draggable="false">` : (emoji || ''); };
export const hasModel = (cat, name) => !!(models[cat] && models[cat].includes(name));
/** Promise<gltf|null>; null when the file is not delivered yet (caller keeps its procedural mesh). */
export const loadModel = (cat, name) => hasModel(cat, name) ? loadGLB(`x/${cat}/${name}`) : Promise.resolve(null);
