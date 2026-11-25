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
/** ?cuts=0 previews every level with all budget cuts restored (see /workspace/boot-wip/l20p-decor-cuts.md). */
const NOCUTS = /[?&]cuts=0\b/.test(Q);
/** The CUTS entry for a level + tier ({} with ?cuts=0). zones.js reads noNooks from it. */
export const cutFor = (levelId, tn) => NOCUTS ? {} : (CUTS[levelId] && (CUTS[levelId][tn] || CUTS[levelId].all)) || {};
const OFF = k => new RegExp('[?&]fuller=(0|[^&]*no' + k + ')').test(Q);
// Per-level cuts made to stay inside the draw budget (filled in from the per-level census; see l20b-notes ## l20p).
// Keys: per tier ('low'/'med'/'high'/'ultra') or 'all'. { clutterSets: n (drop the last n sets), vignettes: true, decor: [keys], landmark: true, kit: true, shortKit: true, nooks: true (arch + vignettes only), noNooks: true (zones builds no nooks on that tier: closed hedges, l20n bounds), none: true }
// l20p census 10:20 AM America/Chicago (l20n baseline vs l20p, Low max): training_garden 154 -> 162, log_jam 160 -> 172 (fuller pushed them over).
// LITE = keep the wall kits + nooks (they replace boxes / colliders), drop all decor, clutter, vignettes and the landmark.
const LITE = { clutterSets: 99, vignettes: true, decor: '*', landmark: true };
export const CUTS = {
  training_garden: { low: { none: true } }, // l20n Low 154; l20p 162-163 with the lighter cut (2 clutter sets + vignettes) -> none
  log_jam: { low: { none: true } }, // l20n Low 160 (at budget)
  festival_glade: { low: { none: true } }, // l20n Low 193 (over budget already); l20p 201-210 with decor; ?fuller=0 = 193
  backyard_split: { low: { ...LITE, noNooks: true }, all: { ...LITE, keep: ['fruit-tree', 'bush-flowering'] } }, // l20q: non-Low restores fruit-tree + bush-flowering (Beans re-check)
  // l20n Low 203; l20p 218 (c8) with decor + nooks, 208 with LITE (c10), 230 with none (c11): Low builds no nooks (hedges stay closed, bounds unchanged); other tiers LITE (High 297 vs l20n 281 on c12)
  mill_pond: { low: LITE, high: { clutterSets: 99, vignettes: true } }, // l20n 317/241; l20p c8 318/244
  frost_hollow: { all: { ...LITE, noNooks: true, keep: ['snowy-tree', 'snow-tuft'] } }, // l20q: restores snowy-tree + snow-tuft (Beans re-check)
  // l20n 283/232; l20p c8 290/240; LITE 282-287 (c10, final): + noNooks
  grand_garden: { all: { noCritters: ['frog'] } }, // l20q: L23 landscape spawn 559 calls vs l20n 556 (pre-existing over 240); the fuller frog is 5 rig draws -> skip it (Low already uses the l20n mix)
  trailhead_trials: { low: { none: true }, all: { noFrog: true, trisCap: 30000 } }, // l20q H2 (Squid l20p re-check): High assist portrait 205.5k tris vs l20n 72.5k (budget 110k); fuller decor+clutter 131.6k -> trisCap 30k (thinned evenly, draws unchanged)
  // l20n Low 390; l20p c8 403. l20q: the shoreline frog fallback costs +4 draws (High mechanic-landscape 497 vs l20n 494) -> noFrog
};

export function createFullerDecor({ group, L2W, rims = () => [], runs = () => [], walls = () => [], nooks = () => [], tier = () => 'high', anchor = () => ({ x: 0, z: 0 }) }) {
  let root = null, token = 0, info = null;
  function clear() { token++; if (root) { root.removeFromParent(); root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); root = null; } info = null; setRouteClip(null); }
  async function build(levelId) {
    clear(); const my = token;
    if (OFF('') && /[?&]fuller=0/.test(Q)) return null;
    const ld = LEVELS['./fuller-levels/' + levelId + '.json']; if (!ld) return null;
    const L = await ld(); if (my !== token) return null;
    const tn = tier(), cut = NOCUTS ? {} : (CUTS[levelId] && (CUTS[levelId][tn] || CUTS[levelId].all)) || {}, T = (SETS.tiers && SETS.tiers[tn === 'med' ? 'med' : tn]) || SETS.tiers.high;
    const A = anchor();
    if (cut.none) { info = { levelId, keys: 0, draws: 0, inst: 0, tier: tn, cut: 'none' }; if (typeof window !== 'undefined') window.__fullerDecor = info; return info; }
    // route corridor for declutter (level-local → world)
    const D = L.declutter || {};
    setRouteClip({ route: (D.route || []).map(([x, z]) => [A.x + x, A.z + z]), half: D.routeHalfWidth || 2.5, lane: D.lane ? [A.x + D.lane[0], A.x + D.lane[1], A.z + D.lane[2], A.z + D.lane[3]] : null, keep: (D.keepClear || []).map(k => ({ x: A.x + (k.x ?? k[0]), z: A.z + (k.z ?? k[1]), r: k.r ?? k[2] ?? 1.5 })) });
    // collect placements per key: [x, z, scale, yaw, yOff]
    const byKey = new Map(); const add = (key, x, z, s, yaw, yo = 0, sy = 1, sl = 1) => { if (!byKey.has(key)) byKey.set(key, []); const l = byKey.get(key); l.push([x, z, s, yaw, yo, sy, sl]); return l.length - 1; };
    if (!OFF('decor')) for (const d of L.decor || []) { if (cut.decor && (cut.decor === '*' || cut.decor.includes(d.key)) && !(cut.keep && cut.keep.some(k => d.key.endsWith(k)))) continue; add(d.key, d.x, d.z, d.s ?? 1, d.yaw || 0); }
    if (!OFF('vig') && !cut.vignettes) for (const v of L.vignettes || []) add(v.key, v.x, v.z, v.s ?? 1, v.yaw || 0);
    if (!OFF('clutter')) {
      const route = D.route && D.route.length ? D.route : [[0, 0]];
      const dRoute = (x, z) => { let b = 1e9; for (let i = 0; i < route.length; i++) { const a = route[i], c = route[Math.min(i + 1, route.length - 1)]; const vx = c[0] - a[0], vz = c[1] - a[1], l2 = vx * vx + vz * vz || 1; let t = ((x - a[0]) * vx + (z - a[1]) * vz) / l2; t = Math.max(0, Math.min(1, t)); b = Math.min(b, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t)); } return b; };
      const sets = Object.keys(L.clutter || {}); const dropN = cut.clutterSets || 0;
      const keptSets = sets.slice(0, Math.max(0, sets.length - dropN)).concat(cut.keep ? sets.slice(Math.max(0, sets.length - dropN)).filter(k => cut.keep.some(x => k.endsWith(x))) : []); // l20q: CUTS keep = restored keys
      for (const key of keptSets) {
        let n = 0; for (const c of L.clutter[key]) { n++; if ((n % (T.keepEvery || 1)) !== 0 && T.keepEvery > 1) continue; if (dRoute(c[0], c[1]) > (T.maxDistance || 60)) continue; add(key, c[0], c[1], c[2] ?? 1, c[3] || 0); }
      }
    }
    // wall kit for the level rim: low hedge 2 m runs + end posts (one InstancedMesh per piece part). Colliders unchanged.
    const R = OFF('kit') || cut.kit ? [] : rims();
    if (R.length) { for (const r of R) { const along = Math.max(r.ww, r.dd), xAxis = r.ww >= r.dd, n = Math.floor(along / 2), rem = along - n * 2, s0 = -along / 2;
      for (let i = 0; i < n; i++) { const c = s0 + 1 + i * 2; add('fuller/walls/hedge-2m-h1.6', xAxis ? r.x + c : r.x, xAxis ? r.z : r.z + c, 1, xAxis ? 0 : Math.PI / 2, -0.3); }
      for (const c of [s0, -s0]) add('fuller/walls/hedge-post-h1.6', xAxis ? r.x + c : r.x, xAxis ? r.z : r.z + c, 1, 0, -0.3);
      if (rem > 0.2) add('fuller/walls/hedge-post-h1.6', xAxis ? r.x + s0 + n * 2 + rem / 2 : r.x, xAxis ? r.z : r.z + s0 + n * 2 + rem / 2, 1, 0, -0.3); } }
    // Act 2 lane hedges (hedgeRun): 2 m kit runs every 2 m along z, nearest height variant scaled to h; window pieces where the
    // level asks for them (visual only; lane colliders unchanged). Fades keep working: each 0.5 m fade entry also hides its kit piece.
    const HV = [1.6, 2.2, 3.4], RU = OFF('kit') || cut.kit ? [] : runs(), runRecs = [];
    const wins = ((L.act2 && L.act2.windows) || []).filter(w => /hedge-window/.test(w.piece || '')), winUsed = new Set();
    for (const r of RU) { const hv = HV.reduce((a, b) => Math.abs(b - r.h) < Math.abs(a - r.h) ? b : a), sy = r.h / hv, pcs = [];
      for (let z = r.z0; z < r.z1 - 0.01; z += 2) { const L2 = Math.min(2, r.z1 - z), zc = z + L2 / 2;
        const gp = (r.gaps || []).filter(([g0, g1]) => g1 > z && g0 < z + L2);
        if (gp.length) { let segs = [[z, z + L2]]; for (const [g0, g1] of gp) segs = segs.flatMap(([a, b]) => (g1 <= a || g0 >= b) ? [[a, b]] : [[a, g0], [g1, b]].filter(([p, q]) => q - p > 0.05)); // l20p nook opening: partial pieces either side
          for (const [a, b] of segs) { const key = 'fuller/walls/hedge-2m-h' + hv; pcs.push({ key, z: (a + b) / 2, idx: add(key, r.x, (a + b) / 2, 1, Math.PI / 2, -0.1, sy, (b - a) / 2) }); }
          continue; }
        const win = hv === 2.2 && L2 > 1.9 && wins.find(w => !winUsed.has(w) && Math.abs(w.x - r.x) < 0.8 && Math.abs(w.z - zc) <= 1.0); if (win) winUsed.add(win); // l20q: a design window is used once (29 designed, was 38 instances)
        const key = win ? 'fuller/walls/hedge-window-h2.2' : L2 > 1.9 ? 'fuller/walls/hedge-2m-h' + hv : 'fuller/walls/hedge-post-h' + hv;
        pcs.push({ key, z: zc, idx: add(key, r.x, zc, 1, Math.PI / 2, -0.1, sy) }); }
      runRecs.push({ r, pcs }); }
    // long boundary walls (>= 14 m, no camera fade): hedge or cliff kit, 2 m runs along the long axis, height variant nearest T, stacked past 7 m
    const WALL = OFF('kit') || cut.kit ? [] : walls(), WL = WALL.filter(w => !w.short), SW = OFF('shortkit') || cut.shortKit ? [] : WALL.filter(w => w.short), wallRecs = [], shortRecs = [];
    for (const wv of WL) { const hed = wv.look === 'hedge', V3 = hed ? [1.6, 2.2, 3.4] : [2, 4, 7], along = Math.max(wv.w, wv.d), xAxis = wv.w >= wv.d, depth = Math.min(wv.w, wv.d);
      const stack = Math.max(1, Math.ceil(wv.T / (V3[2] * 1.25))), hs = wv.T / stack, hv = V3.reduce((a, b) => Math.abs(b - hs) < Math.abs(a - hs) ? b : a), sy = hs / hv;
      const run = (hed ? 'fuller/walls/hedge-2m-h' : 'fuller/walls/cliff-2m-h') + hv, post = (hed ? 'fuller/walls/hedge-post-h' : 'fuller/walls/cliff-post-h') + hv;
      const n = Math.floor(along / 2), rem = along - n * 2, c0 = -along / 2, cy = Math.cos(wv.yaw), sn = Math.sin(wv.yaw), keys0 = new Set();
      const at = c => { const lx = xAxis ? c : 0, lz = xAxis ? 0 : c; return [wv.x + lx * cy + lz * sn, wv.z - lx * sn + lz * cy]; };
      for (let k = 0; k < stack; k++) { const yo = wv.bot + k * hs;
        for (let i = 0; i < n; i++) { const [px, pz] = at(c0 + 1 + i * 2); add(run, px, pz, 1, wv.yaw + (xAxis ? 0 : Math.PI / 2), yo, sy); keys0.add(run); }
        if (rem > 0.2) { const [px, pz] = at(c0 + n * 2 + rem / 2); add(post, px, pz, 1, wv.yaw, yo, sy); keys0.add(post); } }
      wallRecs.push({ wv, keys: [...keys0] }); }
    // short faded walls: only kit keys already placed above (so 0 new draws); n pieces stretched to fit, stacked like long walls
    for (const wv of SW) { const hed = wv.look === 'hedge', V3 = hed ? [1.6, 2.2, 3.4] : [2, 4, 7], pre = hed ? 'fuller/walls/hedge-2m-h' : 'fuller/walls/cliff-2m-h';
      const have = V3.filter(h => byKey.has(pre + h)); if (!have.length) continue;
      const along = Math.max(wv.w, wv.d), xAxis = wv.w >= wv.d, stack = Math.max(1, Math.ceil(wv.T / (have[have.length - 1] * 1.25))), hs = wv.T / stack;
      const hv = have.reduce((a, b) => Math.abs(b - hs) < Math.abs(a - hs) ? b : a), sy = hs / hv, key = pre + hv, n = Math.max(1, Math.round(along / 2)), sc = along / (2 * n);
      const cy = Math.cos(wv.yaw), sn = Math.sin(wv.yaw), at = c => { const lx = xAxis ? c : 0, lz = xAxis ? 0 : c; return [wv.x + lx * cy + lz * sn, wv.z - lx * sn + lz * cy]; }, pcs = [];
      for (let k = 0; k < stack; k++) for (let i = 0; i < n; i++) { const [px, pz] = at(-along / 2 + sc * (1 + 2 * i)); pcs.push({ key, idx: add(key, px, pz, sc, wv.yaw + (xAxis ? 0 : Math.PI / 2), wv.bot + k * hs, sy) }); }
      shortRecs.push({ wv, pcs }); }
    // Act 2 nooks: arch over the opening + critter vignette in the pocket (visual only; zones owns colliders and the bloom reward)
    if (!OFF('nook') && !cut.nooks) for (const n of nooks()) { add(n.arch, n.hx, n.z, 1, Math.PI / 2, -0.1);
      if (n.reward !== 'bloom') add(n.reward === 'snail' ? 'fuller/vignettes/vignette-snail-stump' : 'fuller/vignettes/vignette-ladybird-picnic', n.px, n.pz, 0.8, n.e > 0 ? -Math.PI / 2 : Math.PI / 2); }
    const lm = !OFF('lm') && !cut.landmark && L.landmark && L.landmark.key ? L.landmark : null;
    const keys = [...byKey.keys()]; if (lm) keys.push(lm.key);
    const P = await Promise.all(keys.map(partsOf)); if (my !== token) return null;
    // l20q H2: CUTS trisCap = thin decor + clutter placements evenly (stride sampling, >= 1 per key, so draws are unchanged) until the
    // fuller decor/clutter tris fit the cap. Instanced meshes draw every instance whenever the bounding sphere is in view, so this is the only lever.
    let thinned = null;
    if (cut.trisCap) { const tpi = keys.map((k, ki) => P[ki].reduce((a, pt) => a + (pt.geo.index ? pt.geo.index.count : pt.geo.attributes.position.count) / 3, 0));
      const thin = k => /^fuller\/(clutter|decor)\//.test(k) && byKey.has(k);
      let tT = 0; keys.forEach((k, ki) => { if (thin(k)) tT += tpi[ki] * byKey.get(k).length; });
      if (tT > cut.trisCap) { const f = cut.trisCap / tT; thinned = { before: Math.round(tT), f: +f.toFixed(3) };
        keys.forEach(k => { if (!thin(k)) return; const pl = byKey.get(k), out = pl.filter((_, i) => Math.floor((i + 1) * f) > Math.floor(i * f)); byKey.set(k, out.length ? out : pl.slice(0, 1)); });
        let t2 = 0; keys.forEach((k, ki) => { if (thin(k)) t2 += tpi[ki] * byKey.get(k).length; }); thinned.after = Math.round(t2); } }
    root = new THREE.Group(); root.name = 'fullerDecor:' + levelId;
    const M = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    let draws = 0, inst = 0; const imsByKey = new Map();
    keys.forEach((key, ki) => {
      const pl = key === (lm && lm.key) && !byKey.has(key) ? [[lm.x, lm.z, lm.s ?? 1, lm.yaw || 0]] : byKey.get(key);
      for (const part of P[ki]) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, pl.length); im.name = 'fuller:' + key.split('/').pop();
        im.castShadow = false; im.receiveShadow = true; im.userData.fullerDecor = true; im.userData.noOutline = true;
        pl.forEach(([x, z, s, yaw, yo, sy, sl], i) => { const w = L2W(x, z, yo || 0); V.set(w.x, w.y, w.z); Q4.setFromAxisAngle(Y, yaw); S.set(s * (sl || 1), s * (sy || 1), s); M.compose(V, Q4, S).multiply(part.m4); im.setMatrixAt(i, M); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.computeBoundingBox?.(); im.frustumCulled = true;
        root.add(im); draws++; inst += pl.length; if (!imsByKey.has(key)) imsByKey.set(key, []); imsByKey.get(key).push(im);
      }
    });
    group.add(root);
    const A2 = anchor();
    for (const { r, pcs } of runRecs) { if (!pcs.every(p => (imsByKey.get(p.key) || []).length)) continue;
      for (const im of r.ims) im.visible = false;
      for (const e of r.fadeEs) { const zc = (e.z0 + e.z1) / 2 - A2.z; let best = pcs[0]; for (const p of pcs) if (Math.abs(p.z - zc) < Math.abs(best.z - zc)) best = p;
        e.kit = imsByKey.get(best.key).map(im => { const m = new THREE.Matrix4(); im.getMatrixAt(best.idx, m); return { im, i: best.idx, base: m }; }); } }
    for (const { wv, keys: ks } of wallRecs) if (ks.every(k => (imsByKey.get(k) || []).length)) wv.m.visible = false;
    for (const { wv, pcs } of shortRecs) { if (!pcs.every(p => (imsByKey.get(p.key) || []).length)) continue; wv.m.visible = false; if (wv.cap) wv.cap.visible = false;
      if (wv.fade) wv.fade.kit = pcs.flatMap(p => imsByKey.get(p.key).map(im => { const m = new THREE.Matrix4(); im.getMatrixAt(p.idx, m); return { im, i: p.idx, base: m }; })); }
    if (R.length && byKey.has('fuller/walls/hedge-2m-h1.6')) { const ok = P[keys.indexOf('fuller/walls/hedge-2m-h1.6')]; if (ok && ok.length) for (const r of R) r.m.visible = false; }
    info = { levelId, keys: keys.length, draws, inst, tier: tn, shortWalls: shortRecs.length, thinned };
    if (typeof window !== 'undefined') window.__fullerDecor = info;
    return info;
  }
  return { build, clear, get info() { return info; }, get root() { return root; } };
}
