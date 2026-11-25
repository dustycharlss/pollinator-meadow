// l20p: per-level fuller art (Beans fuller spec §5/§7): decor, vignettes, clutter, landmark. Level-local coords from
// fuller-levels/<level>.json. One InstancedMesh per key (per mesh part) per level; no shadows cast; static.
// Clutter is thinned per tier (clutter-sets.json). Route-corridor declutter data is handed to declutter.js.
import * as THREE from 'three';
import { loadGLB } from './models.js';
import SETS from './fuller-clutter-sets.json';
import { setRouteClip } from './declutter.js';

const LEVELS = import.meta.glob('./fuller-levels/*.json', { import: 'default' });
export const FULLER_LEVEL_IDS = Object.keys(LEVELS).map(k => k.replace(/^.*\//, '').replace(/\.json$/, ''));
const parts = new Map(); // key -> Promise<[{geo, mat, m4}]>
function partsOf(key) {
  if (parts.has(key)) return parts.get(key);
  const p = loadGLB(key).then(g => {
    if (!g) return [];
    const root = g.scene; root.updateMatrixWorld(true); const out = [];
    root.traverse(o => { if (o.isMesh && o.geometry) out.push({ geo: o.geometry, mat: o.material, m4: o.matrixWorld.clone(), emissive: !!(o.material && o.material.emissive && o.material.emissive.getHex()) }); });
    return out;
  }).catch(() => []);
  parts.set(key, p); return p;
}
// Off switch for A/B and for draw bisecting: ?fuller=0 (none), ?fuller=nodecor / noclutter / novig / nolm.
const Q = typeof location !== 'undefined' ? location.search : '';
const OFF = k => new RegExp('[?&]fuller=(0|[^&]*no' + k + ')').test(Q);
// Per-level cuts made to stay inside the draw budget (filled in from the per-level census; see l20b-notes ## l20p).
export const CUTS = {};

export function createFullerDecor({ group, L2W, rims = () => [], tier = () => 'high', anchor = () => ({ x: 0, z: 0 }) }) {
  let root = null, token = 0, info = null;
  function clear() { token++; if (root) { root.removeFromParent(); root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); root = null; } info = null; setRouteClip(null); }
  async function build(levelId) {
    clear(); const my = token;
    if (OFF('') && /[?&]fuller=0/.test(Q)) return null;
    const ld = LEVELS['./fuller-levels/' + levelId + '.json']; if (!ld) return null;
    const L = await ld(); if (my !== token) return null;
    const cut = CUTS[levelId] || {}, tn = tier(), T = (SETS.tiers && SETS.tiers[tn === 'med' ? 'med' : tn]) || SETS.tiers.high;
    const A = anchor();
    // route corridor for declutter (level-local → world)
    const D = L.declutter || {};
    setRouteClip({ route: (D.route || []).map(([x, z]) => [A.x + x, A.z + z]), half: D.routeHalfWidth || 2.5, lane: D.lane ? [A.x + D.lane[0], A.x + D.lane[1], A.z + D.lane[2], A.z + D.lane[3]] : null, keep: (D.keepClear || []).map(k => ({ x: A.x + (k.x ?? k[0]), z: A.z + (k.z ?? k[1]), r: k.r ?? k[2] ?? 1.5 })) });
    // collect placements per key: [x, z, scale, yaw, yOff]
    const byKey = new Map(); const add = (key, x, z, s, yaw, yo = 0) => { if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push([x, z, s, yaw, yo]); };
    if (!OFF('decor')) for (const d of L.decor || []) { if (cut.decor && cut.decor.includes(d.key)) continue; add(d.key, d.x, d.z, d.s ?? 1, d.yaw || 0); }
    if (!OFF('vig') && !cut.vignettes) for (const v of L.vignettes || []) add(v.key, v.x, v.z, v.s ?? 1, v.yaw || 0);
    if (!OFF('clutter')) {
      const route = D.route && D.route.length ? D.route : [[0, 0]];
      const dRoute = (x, z) => { let b = 1e9; for (let i = 0; i < route.length; i++) { const a = route[i], c = route[Math.min(i + 1, route.length - 1)]; const vx = c[0] - a[0], vz = c[1] - a[1], l2 = vx * vx + vz * vz || 1; let t = ((x - a[0]) * vx + (z - a[1]) * vz) / l2; t = Math.max(0, Math.min(1, t)); b = Math.min(b, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t)); } return b; };
      const sets = Object.keys(L.clutter || {}); const dropN = cut.clutterSets || 0;
      for (const key of sets.slice(0, Math.max(0, sets.length - dropN))) {
        let n = 0; for (const c of L.clutter[key]) { n++; if ((n % (T.keepEvery || 1)) !== 0 && T.keepEvery > 1) continue; if (dRoute(c[0], c[1]) > (T.maxDistance || 60)) continue; add(key, c[0], c[1], c[2] ?? 1, c[3] || 0); }
      }
    }
    // wall kit for the level rim: low hedge 2 m runs + end posts (one InstancedMesh per piece part). Colliders unchanged.
    const R = OFF('kit') || cut.kit ? [] : rims();
    if (R.length) { for (const r of R) { const along = Math.max(r.ww, r.dd), xAxis = r.ww >= r.dd, n = Math.floor(along / 2), rem = along - n * 2, s0 = -along / 2;
      for (let i = 0; i < n; i++) { const c = s0 + 1 + i * 2; add('fuller/walls/hedge-2m-h1.6', xAxis ? r.x + c : r.x, xAxis ? r.z : r.z + c, 1, xAxis ? 0 : Math.PI / 2, -0.3); }
      for (const c of [s0, -s0]) add('fuller/walls/hedge-post-h1.6', xAxis ? r.x + c : r.x, xAxis ? r.z : r.z + c, 1, 0, -0.3);
      if (rem > 0.2) add('fuller/walls/hedge-post-h1.6', xAxis ? r.x + s0 + n * 2 + rem / 2 : r.x, xAxis ? r.z : r.z + s0 + n * 2 + rem / 2, 1, 0, -0.3); } }
    const lm = !OFF('lm') && !cut.landmark && L.landmark && L.landmark.key ? L.landmark : null;
    const keys = [...byKey.keys()]; if (lm) keys.push(lm.key);
    const P = await Promise.all(keys.map(partsOf)); if (my !== token) return null;
    root = new THREE.Group(); root.name = 'fullerDecor:' + levelId;
    const M = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    let draws = 0, inst = 0;
    keys.forEach((key, ki) => {
      const pl = key === (lm && lm.key) && !byKey.has(key) ? [[lm.x, lm.z, lm.s ?? 1, lm.yaw || 0]] : byKey.get(key);
      for (const part of P[ki]) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, pl.length); im.name = 'fuller:' + key.split('/').pop();
        im.castShadow = false; im.receiveShadow = true; im.userData.fullerDecor = true; im.userData.noOutline = true;
        pl.forEach(([x, z, s, yaw, yo], i) => { const w = L2W(x, z, yo || 0); V.set(w.x, w.y, w.z); Q4.setFromAxisAngle(Y, yaw); S.setScalar(s); M.compose(V, Q4, S).multiply(part.m4); im.setMatrixAt(i, M); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.computeBoundingBox?.(); im.frustumCulled = true;
        root.add(im); draws++; inst += pl.length;
      }
    });
    group.add(root);
    if (R.length && byKey.has('fuller/walls/hedge-2m-h1.6')) { const ok = P[keys.indexOf('fuller/walls/hedge-2m-h1.6')]; if (ok && ok.length) for (const r of R) r.m.visible = false; }
    info = { levelId, keys: keys.length, draws, inst, tier: tn };
    if (typeof window !== 'undefined') window.__fullerDecor = info;
    return info;
  }
  return { build, clear, get info() { return info; }, get root() { return root; } };
}
