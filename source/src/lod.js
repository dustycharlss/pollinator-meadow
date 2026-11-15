// Polish 3: phone LODs (assets-incoming/optimized/lod, lod-map.json). Phone-first distances per model
// (small 6/14, medium 10/22, large 16/36, huge 24/50; treeB has only LOD2, pushed out to 64).
// Motion-sickness guards: 20% hysteresis band, 250 ms hold before a switch, and no switch while the camera is easing / cutting.
import * as THREE from 'three';
import MAP from './lod-map.json';
import URLS from './model-urls.json';
import { loadURL, bakeParts } from './models.js';

export const HYST = 0.2, HOLD = 250;
const OFF = typeof location !== 'undefined' && /[?&]lod=0\b/.test(location.search);
/** lod record for a model key (or its resolved path), or null */
export function lodFor(key) { if (OFF) return null; const r = MAP[key] || MAP[URLS[key]]; return r && !r.skinned && (r.l1 || r.l2) ? r : null; }

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
export async function bakeLevels(key, parts0, M, rot) {
  const r = lodFor(key); if (!r) return null;
  const out = [{ d: 0, parts: parts0 }];
  for (const [p, d] of [[r.l1, r.d1], [r.l2, r.d2]]) {
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
/** call once per frame before render */
export function lodTick(camera) {
  if (!buckets.length) return;
  const now = sampleCam(camera), busy = camBusy();
  for (const b of buckets) b.tick(camP, now, busy);
}
export function lodSummary() {
  const per = [0, 0, 0]; for (const b of buckets) for (let i = 0; i < b.n; i++) per[b.cur[i]] = (per[b.cur[i]] || 0) + 1;
  return { ...lodStats, instancesPerLevel: per };
}
if (typeof window !== 'undefined') window.__lod = { summary: lodSummary, stats: lodStats };
