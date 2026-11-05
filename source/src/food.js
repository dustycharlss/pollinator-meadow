// Abundant ground food: worms, grubs, ants, honeycomb, sticks, bark, berries and nuts. Everything grows back.
import * as THREE from 'three';
import { WORLD_R, POND, FOODS, FOOD_KEYS } from './data.js';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function colored(geo, hex) { const g = geo.index ? geo.toNonIndexed() : geo; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; }
function piece(geo, hex, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz)); const g = geo.clone(); g.applyMatrix4(m); return colored(g, hex); }
const S = (r, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h);

// real models (Beans Bot's pack) for the small ground critters / bark; primitives remain as fallbacks
const FOOD_REAL = { worm: ['wormG', 1.5, 'length'], grub: ['grubG', 1.0, 'length'], ant: ['antJ', 0.75, 'length'], bark: ['plank', 1.3, 'max'] };
function primitive(kind) {
  const parts = [];
  if (kind === 'worm') {
    for (let i = 0; i < 6; i++) parts.push(piece(S(0.17 - i * 0.008, 5, 3), i % 2 ? 0xe58a93 : 0xf0a3a8, -0.55 + i * 0.22, 0.14 + 0.06 * Math.sin(i * 1.3), Math.sin(i * 0.9) * 0.16, 1.15, 0.9, 1));
    parts.push(piece(S(0.05), 0x2a1a1a, 0.62, 0.22, 0.1));
  } else if (kind === 'grub') {
    parts.push(piece(S(0.55), 0x5a3d28, 0, 0, 0, 1.2, 0.42, 1.2));
    parts.push(piece(S(0.2), 0xf6e8c0, 0.08, 0.28, 0.05, 1.9, 0.9, 1)); parts.push(piece(S(0.13), 0xe8d29a, 0.38, 0.3, 0.05));
  } else if (kind === 'ant') {
    parts.push(piece(new THREE.ConeGeometry(0.5, 0.5, 8), 0x7a5a3a, 0, 0.25, 0)); parts.push(piece(S(0.1), 0x1a1a1a, 0.5, 0.1, 0.2, 1.4, 1, 1)); parts.push(piece(S(0.1), 0x1a1a1a, -0.35, 0.1, 0.45, 1.4, 1, 1)); parts.push(piece(S(0.1), 0x8a1a10, 0.1, 0.45, -0.05, 1.4, 1, 1));
  } else if (kind === 'bark') {
    parts.push(piece(new THREE.BoxGeometry(1.1, 0.14, 0.62), 0x5a3b26, 0, 0.12, 0, 1, 1, 1, 0.08, 0.1)); parts.push(piece(new THREE.BoxGeometry(0.9, 0.07, 0.4), 0x7a553a, 0.05, 0.2, 0.02, 1, 1, 1, 0.08, 0.1));
  }
  return mergeGeometries(parts);
}

/** Builds all food. Returns entries for the bloom registry plus a runtime. */
export async function buildFood(scene, { R, heightAt, phys, solids, colliders, groupsLists, nestSpots, tops, quality, isGood }) {
  const D = new THREE.Object3D();
  const entries = []; // {x,y,z,mask(kind),kind,k,buried,val}
  const kinds = {};
  const q = Math.max(0.6, quality);
  const rnd = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[(R() * arr.length) | 0];
  const decor = solids.filter(s => (s.kind === 'stump' || s.kind === 'rock' || s.kind === 'log' || s.kind === 'decor') && !s.wall);
  const bushes = groupsLists.berryBushes;
  const anyPoint = () => { for (let g = 0; g < 40; g++) { const a = R() * 6.283, d = Math.sqrt(R()) * (WORLD_R - 12), x = Math.cos(a) * d, z = Math.sin(a) * d; if (isGood(x, z)) return [x, z]; } return [0, 30]; };
  const homePoint = (id) => { const n = nestSpots[id]; if (!n) return anyPoint(); for (let g = 0; g < 20; g++) { const a = R() * 6.283, d = 14 + R() * 38, x = n.x + Math.cos(a) * d, z = n.z + Math.sin(a) * d; if (isGood(x, z)) return [x, z]; } return anyPoint(); };
  const around = (cx, cz, r0, r1) => { for (let g = 0; g < 14; g++) { const a = R() * 6.283, d = rnd(r0, r1), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (isGood(x, z)) return [x, z]; } return null; };

  function place(kind, n) {
    const def = FOODS[kind], pts = [];
    for (let i = 0; i < n; i++) {
      let pt = null, y = null;
      if (kind === 'honey') { const t = pick(tops.length ? tops : [{ x: 0, z: 30, top: 1 }]); pt = [t.x, t.z]; y = t.top; if (i < tops.filter(a => a.summit).length) { const sm = tops.filter(a => a.summit)[i]; pt = [sm.x, sm.z]; y = sm.top; } }
      else if (kind === 'grub' || kind === 'ant') { const s = R() < 0.8 && decor.length ? pick(decor) : null; if (s) pt = around(s.x, s.z, (s.r || s.hx || 1.5) + 1.2, (s.r || s.hx || 1.5) + 3.2); }
      else if (kind === 'stick' || kind === 'bark' || kind === 'nut') { if (R() < 0.6 && colliders.length) { const c = pick(colliders); pt = around(c.x, c.z, c.r + 1.5, c.r + 7); } }
      else if (kind === 'berry') { if (R() < 0.55 && bushes.length) { const b = pick(bushes); pt = around(b.x, b.z, 1.6, 4.5); } }
      if (!pt && R() < 0.3) { const who = def.who; pt = homePoint(pick(who)); }
      if (!pt) pt = anyPoint();
      if (!isGood(pt[0], pt[1]) && kind !== 'honey') continue;
      if (kind !== 'honey' && phys.blocked(pt[0], pt[1], 0.7)) continue;
      pts.push([pt[0], y ?? heightAt(pt[0], pt[1]), pt[1], R() * 6.283]);
    }
    return pts;
  }

  const build = async (kind) => {
    const def = FOODS[kind]; const n = Math.round(def.count * (kind === 'honey' ? 1 : q));
    const pts = place(kind, n); if (!pts.length) return;
    let geos = [], mats = [], yOff = 0, scale = () => 0.9 + R() * 0.35;
    if (kind === 'honey') { const g = await loadGLB('honeycomb'); if (g) { const { parts } = bakeParts(g, { size: 0.62, mode: 'height' }); parts.forEach(p => { geos.push(p.geometry); mats.push(lambertFrom(p.material)); }); } }
    else if (kind === 'stick') { const g = await loadGLB('twig'); if (g) { const { parts } = bakeParts(g, { size: 2.3, mode: 'max' }); parts.forEach(p => { geos.push(p.geometry); mats.push(lambertFrom(p.material)); }); } }
    else if (kind === 'berry') { const g = await loadGLB('strawberry'); if (g) { const { parts } = bakeParts(g, { size: 0.85, mode: 'height' }); parts.forEach(p => { geos.push(p.geometry); mats.push(lambertFrom(p.material)); }); } }
    else if (kind === 'nut') { const g = await loadGLB('acorn'); if (g) { const { parts } = bakeParts(g, { size: 0.7, mode: 'height' }); parts.forEach(p => { geos.push(p.geometry); mats.push(lambertFrom(p.material)); }); } }
    else if (FOOD_REAL[kind]) { const [key, size, mode] = FOOD_REAL[kind]; const g = await loadGLB(key); if (g) { const { parts } = bakeParts(g, { size, mode }); parts.forEach(p => { geos.push(p.geometry); mats.push(lambertFrom(p.material)); }); } }
    if (!geos.length) { geos = [kind === 'berry' ? mergeGeometries([piece(S(0.2), 0xd8303a, 0, 0.2, 0), piece(S(0.2), 0xd8303a, 0.3, 0.2, 0.1), piece(S(0.2), 0xa8202e, 0.1, 0.2, 0.3)]) : kind === 'nut' ? mergeGeometries([piece(S(0.22), 0xb0793a, 0, 0.22, 0, 1, 1.2, 1), piece(S(0.2), 0x6a4a2a, 0, 0.4, 0, 1, 0.5, 1)]) : kind === 'stick' ? mergeGeometries([piece(new THREE.CylinderGeometry(0.06, 0.05, 2.0, 5), 0x7a5a3a, 0, 0.1, 0, 1, 1, 1, 0, Math.PI / 2), piece(new THREE.CylinderGeometry(0.04, 0.03, 0.8, 5), 0x7a5a3a, 0.3, 0.14, 0.15, 1, 1, 1, 0.5, Math.PI / 2)]) : kind === 'honey' ? mergeGeometries([piece(new THREE.CylinderGeometry(0.7, 0.7, 0.6, 6), 0xf3b73a, 0, 0.3, 0)]) : primitive(kind)]; mats = [new THREE.MeshLambertMaterial({ vertexColors: true })]; }
    const ims = geos.map((g, gi) => { const im = new THREE.InstancedMesh(g, mats[gi], pts.length); im.frustumCulled = false; return im; });
    const mat = new Float32Array(pts.length * 16), baseIdx = entries.length;
    const sc = kind === 'honey' ? () => 0.95 + R() * 0.3 : scale;
    pts.forEach(([x, y, z, yaw], k) => {
      const s = sc(); D.position.set(x, y + (kind === 'honey' ? 0.05 : 0.02), z); D.rotation.set(0, yaw, 0); D.scale.setScalar(s); D.updateMatrix();
      D.matrix.toArray(mat, k * 16); ims.forEach(im => im.setMatrixAt(k, D.matrix));
      const tint = new THREE.Color().setScalar(0.85 + R() * 0.2);
      if (kind === 'berry') tint.setHSL(R() < 0.7 ? 0.0 : 0.62 + R() * 0.2, 0.2, 0.9); // strawberry tint variety
      ims.forEach(im => im.setColorAt(k, tint));
      entries.push({ x, y: y + (kind === 'honey' ? 0.9 : 0.5), z, kind, k, buried: def.buried ? 1 : 0, val: def.value });
    });
    ims.forEach(im => { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; scene.add(im); });
    kinds[kind] = { ims, mat, base: baseIdx, n: pts.length };
  };
  for (const k of FOOD_KEYS) await build(k);

  const queue = [];
  const zero = new Float32Array(16);
  return {
    entries, kinds,
    install(B) { this.B = B; },
    take(i, t) {
      const e = entries[i - this.off]; const kd = kinds[e.kind], B = this.B;
      B.readyAt[i] = t + FOODS[e.kind].respawn * (0.85 + Math.random() * 0.3);
      kd.ims.forEach(im => { im.instanceMatrix.array.set(zero, e.k * 16); im.instanceMatrix.needsUpdate = true; });
      queue.push(i);
    },
    update(t) {
      const B = this.B;
      for (let q2 = queue.length - 1; q2 >= 0; q2--) { const i = queue[q2]; if (B.readyAt[i] > t) continue; const e = entries[i - this.off], kd = kinds[e.kind];
        kd.ims.forEach(im => { im.instanceMatrix.array.set(kd.mat.subarray(e.k * 16, e.k * 16 + 16), e.k * 16); im.instanceMatrix.needsUpdate = true; }); queue.splice(q2, 1); }
    },
    off: 0
  };
}
