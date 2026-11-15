// Polish 3: phone LODs (assets-incoming/optimized/lod, lod-map.json). Phone-first distances per model
// (small 6/14, medium 10/22, large 16/36, huge 24/50; treeB has only LOD2, pushed out to 64).
// Motion-sickness guards: 20% hysteresis band, 250 ms hold before a switch, and no switch while the camera is easing / cutting.
import * as THREE from 'three';
import MAP from './lod-map.json';
import URLS from './model-urls.json';
import { loadURL, bakeParts } from './models.js';

export const HYST = 0.2, HOLD = 250;
const OFF = typeof location !== 'undefined' && /[?&]lod=0\b/.test(location.search);

// polish4: Beans delivers new phone LODs (characters, flyers, gardens, hazards, rivals) as assets-incoming/optimized/lod/ → repo
// models-lod/ with its lod-map.json. Any lod-map.json dropped there (Beans' raw {entries:[…]} format or the flat key map) is
// merged over the built-in map at build time — import.meta.glob of a missing file is just {}, so no runtime fetch / 404.
const DROPS = import.meta.glob(['../../models-lod/lod-map.json', '../../models-lod/**/lod-map.json'], { eager: true, import: 'default' });
function mergeDrop(j) {
  if (!j) return 0; let n = 0;
  const put = (k, r) => { if (k && r && (r.l1 || r.l2)) { MAP[k] = r; n++; } };
  if (Array.isArray(j.entries)) for (const e of j.entries) {
    if (e.skipped) continue; const D = e.distances || {};
    const r = { l1: e.lod1 || null, l2: e.lod2 || null, d1: D.lod1 ?? null, d2: D.lod2 ?? null, cls: e.size_class, skinned: !!e.skinned, src: 'drop' };
    for (const k of [...(e.keys || []), ...(e.short_keys || []), e.tc_path, e.lod0]) put(k, r);
  } else for (const [k, r] of Object.entries(j)) if (r && typeof r === 'object') put(k, { ...r, src: 'drop' });
  return n;
}
export const lodDrops = Object.entries(DROPS).map(([p, j]) => ({ path: p, entries: mergeDrop(j) }));

// polish4 (Chaz): campaign lite mode uses LODs with the closest switch distances (Beans' phone-first "small" preset for every model)
const CLOSEST = [6, 14];
let LITE = false;
export function setLodLite(v) { LITE = !!v; }
/** [d1, d2] switch distances for a record (lite → the closest preset; a model with no LOD2 keeps null) */
export function lodDists(r) { return LITE ? [r.l1 ? CLOSEST[0] : null, r.l2 ? (r.l1 ? CLOSEST[1] : CLOSEST[0]) : null] : [r.d1, r.d2]; }
/** lod record for a model key (or its resolved path), or null. Skinned records only when the caller can rebind skins (lodify). */
// drop: only entries from a Beans drop in models-lod/ (characters, flyers, gardens, hazards, rivals wait for those — Chaz, polish4)
export function lodFor(key, { skinned = false, drop = false } = {}) { if (OFF || !key) return null; const r = MAP[key] || MAP[URLS[key]]; return r && (!r.skinned || skinned) && (!drop || r.src === 'drop') && (r.l1 || r.l2) ? r : null; }

// ---- camera "busy" guard: fast pan / zoom ease / cut → hold all switches until it settles
const camP = new THREE.Vector3(), camQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
let lastT = 0, busyUntil = 0, inited = false;
export const lodStats = { switches: 0, deferred: 0, buckets: 0, objects: 0 };
function sampleCam(camera) {
  const now = performance.now(); if (now - lastT < 4) return now; // once per frame
  const dt = Math.max(1e-3, (now - (lastT || now - 16)) / 1000); lastT = now;
  camera.getWorldPosition(tmpV); const q = camera.getWorldQuaternion(new THREE.Quaternion());
  if (inited) {
    const v = tmpV.distanceTo(camP) / dt, w = 2 * Math.acos(Math.min(1, Math.abs(q.dot(camQ)))) / dt;
    if (v > 14 || w > 2.2 || (typeof window !== 'undefined' && window.__camEase)) busyUntil = now + 180;
  }
  camP.copy(tmpV); camQ.copy(q); inited = true; return now;
}
export const camBusy = () => performance.now() < busyUntil;

// pick the level for distance d starting from cur, with the 20% band on the way back in
function pick(dists, cur, d) {
  let t = cur;
  while (t < dists.length - 1 && d >= dists[t + 1]) t++;
  while (t > 0 && d < dists[t] * (1 - HYST)) t--;
  return t;
}

/** THREE.LOD with hysteresis + hold + camera-ease guard (renderer calls update() each frame) */
export class HystLOD extends THREE.LOD {
  constructor() { super(); this.isHystLOD = true; this._cur = -1; this._want = 0; this._since = 0; lodStats.objects++; }
  getCurrentLevel() { return Math.max(0, this._cur); }
  update(camera) {
    const L = this.levels; if (!L.length) return;
    const now = sampleCam(camera);
    const d = camP.distanceTo(this.getWorldPosition(tmpV)) / (camera.zoom || 1);
    const dists = L.map(l => l.distance);
    if (this._cur < 0) { this._cur = pick(dists, 0, d); this._want = this._cur; L.forEach((l, i) => l.object.visible = i === this._cur); return; }
    const t = pick(dists, this._cur, d);
    if (t !== this._want) { this._want = t; this._since = now; }
    if (t === this._cur) return;
    if (now - this._since < HOLD) return;
    if (camBusy()) { lodStats.deferred++; return; }
    L[this._cur].object.visible = false; L[t].object.visible = true; this._cur = t; lodStats.switches++;
  }
}

/** load + bake LOD1/LOD2 with LOD0's normalisation. levels: [{d, parts}] (LOD0 first). */
export async function bakeLevels(key, parts0, M, rot, opt = {}) {
  const r = lodFor(key, opt); if (!r) return null;
  const out = [{ d: 0, parts: parts0 }], [d1, d2] = lodDists(r);
  for (const [p, d] of [[r.l1, d1], [r.l2, d2]]) {
    if (!p || d == null) continue;
    const g = await loadURL(p); if (!g) continue;
    out.push({ d, parts: bakeParts(g, { M, rot }).parts });
  }
  return out.length > 1 ? out : null;
}

/** HystLOD built from baked levels; mk(parts) → Object3D for one level */
export function makeLOD(levels, mk) { const lod = new HystLOD(); for (const l of levels) lod.addLevel(mk(l.parts), l.d); return lod; }

// ---- instanced plants: one InstancedMesh per part per level; instances move between levels with the same guards
const buckets = [];
export class LodBuckets {
  /** levels [{d, parts:[{geometry, material}]}]; mats: per-instance Matrix4[]; cols: Color[] | null */
  constructor(scene, levels, mats, cols, matFor) {
    this.levels = levels; this.mats = mats; this.cols = cols; this.n = mats.length;
    this.dists = levels.map(l => l.d); this.pos = mats.map(m => new THREE.Vector3().setFromMatrixPosition(m));
    this.hide = new Uint8Array(this.n); this.r0 = Math.max(...levels[0].parts.map(p => (p.geometry.boundingSphere || (p.geometry.computeBoundingSphere(), p.geometry.boundingSphere)).radius), 1e-3);
    this.cur = new Int8Array(this.n).fill(-1); this.want = new Int8Array(this.n); this.since = new Float64Array(this.n);
    this.ims = levels.map(l => l.parts.map(p => { const im = new THREE.InstancedMesh(p.geometry, matFor(p.material), this.n); im.userData.lodBucket = this; scene.add(im); return im; }));
    // bounding spheres over every instance, so frustum culling still works per level
    for (const lv of this.ims) for (const im of lv) { mats.forEach((m, i) => { im.setMatrixAt(i, m); if (cols) im.setColorAt(i, cols[i]); }); im.computeBoundingSphere(); im.count = 0; }
    this.nextT = 0; buckets.push(this); lodStats.buckets++;
  }
  get meshes() { return this.ims.flat(); }
  tick(cp, now, busy) {
    if (now < this.nextT) return; this.nextT = now + 100;
    let dirty = false;
    for (let i = 0; i < this.n; i++) {
      const d = cp.distanceTo(this.pos[i]);
      if (this.cur[i] < 0) { this.cur[i] = this.want[i] = pick(this.dists, 0, d); dirty = true; continue; }
      const t = pick(this.dists, this.cur[i], d);
      if (t !== this.want[i]) { this.want[i] = t; this.since[i] = now; }
      if (t !== this.cur[i] && now - this.since[i] >= HOLD) { if (busy) { lodStats.deferred++; continue; } this.cur[i] = t; dirty = true; lodStats.switches++; }
    }
    if (dirty) this.flush();
  }
  /** declutter: hide instances where fn(x, z, radius) is true (instead of zeroing matrices, which flush() would undo) */
  hideWhere(fn) { const sc = new THREE.Vector3(); let n = 0; for (let i = 0; i < this.n; i++) { sc.setFromMatrixScale(this.mats[i]); if (fn(this.pos[i].x, this.pos[i].z, this.r0 * sc.x)) { this.hide[i] = 1; n++; } } if (n) this.flush(); return n; }
  unhide() { this.hide.fill(0); this.flush(); }
  flush() {
    this.ims.forEach((lv, L) => {
      for (const im of lv) {
        let k = 0;
        for (let i = 0; i < this.n; i++) if (this.cur[i] === L && !this.hide[i]) { im.setMatrixAt(k, this.mats[i]); if (this.cols) im.setColorAt(k, this.cols[i]); k++; }
        im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    });
  }
}
// ---- polish4: in-place LODs for scene-graph clones (decor, enemies, babies, rivals, skinned characters) ----
// Beans' LOD files keep node, mesh and joint names, so each LOD0 mesh gets a sibling per level with the level's geometry, the
// LOD0 mesh's material (tints / retints survive) and its local transform; skinned meshes are bound to LOD0's own skeleton
// (skinIndex remapped by joint name), so one mixer drives every level. Same hysteresis / hold / camera-ease guard as HystLOD.
const switches = new Set(); let FORCE = -1;
const nm = o => o.name || '';
function levelMeshes(g) { const by = new Map(), list = []; g.scene.traverse(o => { if (!o.isMesh) return; list.push(o); if (nm(o) && !by.has(nm(o))) by.set(nm(o), o); }); by.list = list; return by; }
function remapSkin(geo, srcJoints, dstBones) {
  const idx = srcJoints.map(n => dstBones.findIndex(b => b.name === n)); if (idx.some(i => i < 0)) return null;
  if (idx.every((v, i) => v === i)) return geo;
  const g = geo.clone(), a = g.attributes.skinIndex; for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) a.setComponent(i, c, idx[a.getComponent(i, c)] ?? 0);
  a.needsUpdate = true; return g;
}
class MeshLOD {
  constructor(root, dists, sets) { this.root = root; this.dists = dists; this.sets = sets; this._cur = -1; this._want = 0; this._since = 0; this.nextGC = 0; switches.add(this); lodStats.objects++; }
  show(t) { this.sets.forEach((set, i) => { for (const m of set) m.visible = i === t; }); }
  update(cp, now, busy) {
    if (FORCE >= 0) { const t = Math.min(FORCE, this.sets.length - 1); if (t !== this._cur) { this._cur = t; this.show(t); } return; } // debug: __lod.force(n)
    const d = cp.distanceTo(this.root.getWorldPosition(tmpV));
    if (this._cur < 0) { this._cur = this._want = pick(this.dists, 0, d); this.show(this._cur); return; }
    const t = pick(this.dists, this._cur, d);
    if (t !== this._want) { this._want = t; this._since = now; }
    if (t === this._cur || now - this._since < HOLD) return;
    if (busy) { lodStats.deferred++; return; }
    this._cur = t; this.show(t); lodStats.switches++;
  }
  dispose() { switches.delete(this); }
}
const inScene = o => { while (o.parent) o = o.parent; return !!o.isScene; };
/** add LOD levels in place under obj (a clone of `key`'s scene, already scaled / tinted). Resolves to the MeshLOD or null. */
export async function lodify(obj, key, { drop = false } = {}) {
  const r = lodFor(key, { skinned: true, drop }); if (!r || !obj) return null;
  const [d1, d2] = lodDists(r), lv = [[r.l1, d1], [r.l2, d2]].filter(([p, d]) => p && d != null);
  const G = await Promise.all(lv.map(([p]) => loadURL(p)));
  const base = []; obj.traverse(o => { if (o.isMesh && !o.userData.lodLevel) base.push(o); }); if (!base.length) return null;
  const dists = [0], sets = [base];
  G.forEach((g, li) => {
    if (!g) return; const by = levelMeshes(g), set = [];
    const jointsOf = new Map(); g.scene.traverse(o => { if (o.isSkinnedMesh) jointsOf.set(o, o.skeleton.bones.map(b => b.name)); });
    for (const m0 of base) {
      const src = nm(m0) ? by.get(nm(m0)) : by.list.length === base.length ? by.list[base.indexOf(m0)] : null; if (!src) continue; // part dropped at this level → LOD0 mesh simply hides
      let m;
      if (m0.isSkinnedMesh && src.isSkinnedMesh) {
        const geo = remapSkin(src.geometry, jointsOf.get(src), m0.skeleton.bones); if (!geo) continue;
        m = new THREE.SkinnedMesh(geo, m0.material); m.bind(m0.skeleton, m0.bindMatrix); m.bindMode = m0.bindMode;
      } else if (!m0.isSkinnedMesh && !src.isSkinnedMesh) m = new THREE.Mesh(src.geometry, m0.material);
      else continue;
      m.name = m0.name; m.position.copy(m0.position); m.quaternion.copy(m0.quaternion); m.scale.copy(m0.scale);
      m.castShadow = m0.castShadow; m.receiveShadow = m0.receiveShadow; m.frustumCulled = m0.frustumCulled; m.renderOrder = m0.renderOrder;
      m.userData.lodLevel = li + 1; m.visible = false; m0.parent.add(m); set.push(m);
    }
    if (set.length) { dists.push(lv[li][1]); sets.push(set); }
  });
  if (sets.length < 2) return null;
  const ml = new MeshLOD(obj, dists, sets); ml.key = key; obj.userData.meshLOD = ml; return ml;
}
/** baked parts already turned into meshes under one parent (riders, fliers, ground animals): add level meshes beside them, matched
 *  to LOD0 parts by material name (or order when the part counts agree), reusing each LOD0 mesh's material (flap shaders, tints). */
export async function lodBakedMeshes(root, key, parts0, meshes0, M, rot, opt = { drop: true }) {
  const lv = await bakeLevels(key, parts0, M, rot, opt); if (!lv || !meshes0.length) return null;
  const dists = [0], sets = [meshes0.slice()];
  lv.slice(1).forEach((L, li) => {
    const set = [];
    L.parts.forEach((p, j) => {
      const nmM = p.material && p.material.name;
      let i = nmM ? parts0.findIndex(q => q.material && q.material.name === nmM) : -1;
      if (i < 0 && L.parts.length === parts0.length) i = j; if (i < 0) return;
      const m0 = meshes0[i], m = new THREE.Mesh(p.geometry, m0.material);
      m.position.copy(m0.position); m.quaternion.copy(m0.quaternion); m.scale.copy(m0.scale); m.frustumCulled = m0.frustumCulled;
      m.userData.lodLevel = li + 1; m.visible = false; m0.parent.add(m); set.push(m);
    });
    if (set.length) { dists.push(L.d); sets.push(set); }
  });
  if (sets.length < 2) return null;
  const ml = new MeshLOD(root, dists, sets); ml.key = key; root.userData.meshLOD = ml; return ml;
}
/** baked parts (bakeParts with M) → HystLOD; mk(parts) builds one level. Falls back to mk(parts0) when there is no LOD. */
export async function lodBaked(key, parts0, M, rot, mk, opt = {}) {
  const lv = await bakeLevels(key, parts0, M, rot, opt); return lv ? makeLOD(lv, mk) : mk(parts0);
}

/** call once per frame before render */
export function lodTick(camera) {
  if (!buckets.length && !switches.size) return;
  const now = sampleCam(camera), busy = camBusy();
  for (const b of buckets) b.tick(camP, now, busy);
  for (const s of switches) { if (now > s.nextGC) { s.nextGC = now + 2000; if (!inScene(s.root)) { s.dispose(); continue; } } s.update(camP, now, busy); }
}
export function lodSummary() {
  const per = [0, 0, 0]; for (const b of buckets) for (let i = 0; i < b.n; i++) per[b.cur[i]] = (per[b.cur[i]] || 0) + 1;
  const sw = [0, 0, 0]; for (const s of switches) sw[Math.max(0, s._cur)]++;
  return { ...lodStats, instancesPerLevel: per, meshLODs: switches.size, meshLODKeys: [...new Set([...switches].map(s => s.key))], meshLODPerLevel: sw, lite: LITE, drops: lodDrops };
}
if (typeof window !== 'undefined') window.__lod = { summary: lodSummary, stats: lodStats, force: n => { FORCE = n == null ? -1 : n; } };
