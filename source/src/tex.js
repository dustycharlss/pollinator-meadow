// Polish 2: texture helpers — @1x art on 1x DPR screens, KTX2 (Basis) for grass + star with WebP fallback.
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const BASE = import.meta.env.BASE_URL;
export const DPR1 = (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) < 1.5;
// files that ship a half-size name@1x.webp next to the full-size drop-in (assets-incoming path-map, tc entries in use)
const HAS_1X = new Set(['img/grass.webp', 'img/logo.webp', 'ui/valley/valley-map-portrait.webp', 'ui/portraits/guide-happy-blocky.webp', 'ui/portraits/guide-cheering-blocky.webp', 'ui/portraits/guide-thinking-blocky.webp', 'ui/portraits/guide-happy.webp', 'ui/portraits/guide-cheering.webp', 'ui/portraits/guide-thinking.webp', 'ui/valley/heal/heal-meter-stages-strip.webp', 'textures/fx/packup/fx-packup-petal-burst-strip.webp']);
/** pick name@1x.webp on 1x DPR when one exists; works on BASE-prefixed, ./-prefixed or bare paths */
export function at1x(url) {
  if (!DPR1 || typeof url !== 'string') return url;
  const bare = url.replace(BASE, '').replace(/^\.\//, '');
  return HAS_1X.has(bare) ? url.replace(/\.webp$/, '@1x.webp') : url;
}

let ktx2 = null; const cache = new Map();
/** call once the renderer exists */
export function initKTX2(renderer) {
  try { ktx2 = new KTX2Loader().setTranscoderPath(BASE + 'libs/basis/').detectSupport(renderer); } catch (e) { console.warn('[tex] KTX2 unavailable', e); ktx2 = null; }
}
/** load img/<name>.ktx2 (Basis, sRGB); falls back to img/<name>.webp (or @1x) on any failure. Shared + cached. */
export function loadKtx(name) {
  if (cache.has(name)) return cache.get(name);
  const webp = () => new THREE.TextureLoader().loadAsync(at1x(BASE + 'img/' + name + '.webp')).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.userData.fmt = 'webp'; return t; });
  const p = (ktx2 ? ktx2.loadAsync(BASE + 'img/' + name + '.ktx2').then(t => { t.colorSpace = THREE.SRGBColorSpace; t.userData.fmt = 'ktx2'; return t; }) : Promise.reject(new Error('no ktx2')))
    .catch(e => { if (ktx2) console.warn('[tex] ktx2 fallback', name, e && e.message); return webp(); });
  cache.set(name, p); return p;
}
/** set mat.map once the shared texture is ready (sync call sites that used TextureLoader().load) */
export function mapWhenReady(mat, name) { loadKtx(name).then(t => { mat.map = t; mat.needsUpdate = true; }).catch(() => {}); return mat; }
if (typeof window !== 'undefined') window.__tex = { DPR1, fmt: async n => (await loadKtx(n)).userData.fmt };
