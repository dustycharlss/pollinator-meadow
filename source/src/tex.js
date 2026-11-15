// Polish 2/4: texture helpers — @1x art on 1x DPR screens; WebP everywhere (KTX2 path kept, opt-in per texture).
import * as THREE from 'three';

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

// polish4 (Chaz): KTX2 only where it saves bytes *including* the 0.58 MB Basis transcoder. Measured: grass.ktx2 70 KB vs
// grass.webp 81 KB / grass@1x.webp 20 KB, star.ktx2 4.3 KB vs star.webp 2.7 KB — nothing clears the transcoder, so KTX_NAMES is
// empty and the transcoder is never fetched. Add a name here (with img/<name>.ktx2) only if its saving beats the transcoder;
// KTX2Loader is then pulled in lazily by dynamic import, so it never weighs on first load otherwise.
const KTX_NAMES = new Set([]);
let ktx2 = null, R = null; const cache = new Map();
/** call once the renderer exists (cheap: no loader or transcoder is touched unless KTX_NAMES has entries) */
export function initKTX2(renderer) { R = renderer; }
async function ktxLoader() {
  if (ktx2) return ktx2;
  const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
  ktx2 = new KTX2Loader().setTranscoderPath(BASE + 'libs/basis/').detectSupport(R); return ktx2;
}
/** load img/<name>.webp (or @1x on 1x screens); img/<name>.ktx2 only for KTX_NAMES. Shared + cached. */
export function loadKtx(name) {
  if (cache.has(name)) return cache.get(name);
  const webp = () => new THREE.TextureLoader().loadAsync(at1x(BASE + 'img/' + name + '.webp')).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.userData.fmt = 'webp'; return t; });
  const p = KTX_NAMES.has(name) && R
    ? ktxLoader().then(L => L.loadAsync(BASE + 'img/' + name + '.ktx2')).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.userData.fmt = 'ktx2'; return t; }).catch(e => { console.warn('[tex] ktx2 fallback', name, e && e.message); return webp(); })
    : webp();
  cache.set(name, p); return p;
}
/** set mat.map once the shared texture is ready (sync call sites that used TextureLoader().load) */
export function mapWhenReady(mat, name) { loadKtx(name).then(t => { mat.map = t; mat.needsUpdate = true; }).catch(() => {}); return mat; }
if (typeof window !== 'undefined') window.__tex = { DPR1, fmt: async n => (await loadKtx(n)).userData.fmt };
