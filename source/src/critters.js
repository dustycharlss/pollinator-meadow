// Art pass (Nov 14, 2026): ambient background critters from Beans (assets-incoming/critters, CC0, palette B).
// Background props only: never interactable, kept out of the player's path, slow clips and slow wander (README motion rules).
// Per-tier caps follow the perf audit budgets: low 6, med 12, high 18, ultra 26 critters. Each type is baked once into one
// merged vertex-colour mesh per animated node (a butterfly is 3 draw calls, not 10), then cloned per instance.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLB } from './models.js';

// size = target longest extent in game metres (the player bee is 1.35 m); fly = [min,max] height; spd = m/s cap; r = wander leash
export const CRITTERS = {
  butterfly: { size: 0.7, fly: [0.6, 1.4], spd: 0.3, r: 5, day: 1 },
  'small-bird': { size: 0.7, fly: [1.0, 2.2], spd: 0.35, r: 8, day: 1, perch: true },
  ladybug: { size: 0.35, ground: true, spd: 0.07, r: 1.2, day: 1 },
  snail: { size: 0.55, ground: true, spd: 0.03, r: 0.8, day: 1 },
  frog: { size: 0.55, ground: true, spd: 0.08, r: 1.5, day: 1, hop: true },
  dragonfly: { size: 0.75, fly: [0.5, 1.5], spd: 0.3, r: 5, day: 1, hover: true },
  firefly: { size: 0.22, fly: [0.4, 1.2], spd: 0.15, r: 3, night: 1, glow: true },
  moth: { size: 0.6, fly: [0.5, 1.5], spd: 0.22, r: 4, night: 1 },
  bat: { size: 1.0, fly: [2.0, 4.0], spd: 0.33, r: 9, night: 1, cave: true },
  'ember-sprite': { size: 0.28, fly: [0.3, 1.0], spd: 0.12, r: 2.5, always: 1, glow: true },
  fish: { size: 0.5, swim: true, spd: 0.15, r: 2, always: 1 },
  'snow-hare': { size: 0.9, ground: true, spd: 0.18, r: 4, day: 1, hop: true },
};
const DAY = { butterfly: 3, 'small-bird': 2, ladybug: 2, snail: 1, firefly: 6, moth: 2 };
const BIOME = {
  meadow_hub: { butterfly: 4, 'small-bird': 2, ladybug: 2, snail: 1, frog: 1, firefly: 6, moth: 2 },
  mirror_caves: { bat: 4, firefly: 4 },
  ember_ridge: { 'ember-sprite': 5, moth: 2, 'small-bird': 1 },
  thaw_valley: { 'snow-hare': 2, 'small-bird': 2, butterfly: 1 },
  frost_hollow: { 'snow-hare': 2, 'small-bird': 1, butterfly: 2, firefly: 4 },
  flooded_mill: { fish: 4, frog: 2, dragonfly: 2, firefly: 4 },
  mill_pond: { fish: 4, frog: 2, dragonfly: 2, butterfly: 2, firefly: 4 },
  night_market: { firefly: 6, moth: 3 }, owl_wood: { firefly: 6, moth: 3, butterfly: 2 }, moon_meadow: { firefly: 6, moth: 3, butterfly: 2 },
  storm_orchard: { 'small-bird': 2, butterfly: 2, ladybug: 2 }, grand_garden: { butterfly: 4, snail: 2, ladybug: 3, 'small-bird': 2, frog: 1 },
};
export const CAPS = { low: 6, med: 12, high: 18, ultra: 26 };

const tmpl = new Map();
async function template(kind) {
  if (tmpl.has(kind)) return tmpl.get(kind);
  const p = loadGLB('critters/' + kind).then(g => {
    if (!g) return null;
    const root = g.scene.clone(true), clip = g.animations[0] || null, anim = new Set((clip ? clip.tracks : []).map(t => t.name.split('.')[0]));
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), k = CRITTERS[kind].size / Math.max(sz.x, sz.y, sz.z, 1e-3);
    // merge plain-colour meshes per animated ancestor (keeps the node-TRS clip working)
    const groups = new Map(), inv = new THREE.Matrix4(), rel = new THREE.Matrix4(), keep = [];
    root.traverse(o => {
      if (!o.isMesh) return; const m = Array.isArray(o.material) ? null : o.material;
      if (!m || m.map || (m.emissive && m.emissive.getHex() && (m.emissiveIntensity || 1) > 0)) { keep.push(o); return; }
      let a = o.parent; while (a && a !== root && !anim.has(a.name)) a = a.parent; a = a || root;
      inv.copy(a.matrixWorld).invert(); rel.multiplyMatrices(inv, o.matrixWorld);
      const geo = o.geometry.clone(); for (const n of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(n)) geo.deleteAttribute(n);
      // dequantize to float so mergeGeometries accepts mixed sources
      for (const n of ['position', 'normal']) { const at = geo.attributes[n]; if (at && !(at.array instanceof Float32Array && !at.normalized)) { const f = new Float32Array(at.count * 3); for (let i = 0; i < at.count; i++) { f[i * 3] = at.getX(i); f[i * 3 + 1] = at.getY(i); f[i * 3 + 2] = at.getZ(i); } geo.setAttribute(n, new THREE.BufferAttribute(f, 3)); } }
      geo.applyMatrix4(rel); if (!geo.attributes.normal) geo.computeVertexNormals();
      const c = m.color || new THREE.Color(1, 1, 1), n = geo.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); const ng = geo.index ? geo.toNonIndexed() : geo;
      (groups.get(a) || groups.set(a, []).get(a)).push(ng); o.userData._drop = true;
    });
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const [a, list] of groups) { const g2 = mergeGeometries(list, false); if (!g2) continue; const mesh = new THREE.Mesh(g2, mat); mesh.name = 'critterMerged'; a.add(mesh); }
    const drop = []; root.traverse(o => { if (o.userData._drop) drop.push(o); }); for (const o of drop) o.removeFromParent();
    for (const o of keep) { const m = o.material; if (m && m.emissive) m.userData.noPastel = true; }
    const T = { root, clip, scale: k }; return T;
  });
  tmpl.set(kind, p); return p;
}

export function createCritters(scene, { heightAt, tier = () => 'med' } = {}) {
  const group = new THREE.Group(); group.name = 'critters'; scene.add(group);
  let list = [], token = 0;
  function clear() { token++; for (const c of list) { c.mixer.stopAllAction(); c.obj.removeFromParent(); } list = []; }
  /** Spawn for a level. rect = world {x0,x1,z0,z1}; deep = water rects; avoid(x,z) true near the start / paths; waterY for fish. */
  async function spawn(patchId, { rect, deep = [], waterY = null, start = null } = {}) {
    clear(); const my = token; if (!rect) return;
    const want = { ...(BIOME[patchId] || DAY) }; if (deep.length && !BIOME[patchId]) { want.frog = 2; want.dragonfly = 1; }
    if (!deep.length || waterY == null) delete want.fish;
    const cap = CAPS[tier()] || 12, tot = Object.values(want).reduce((a, b) => a + b, 0), f = Math.min(1, cap / Math.max(1, tot));
    const kinds = Object.entries(want).map(([k, n]) => [k, Math.max(f < 1 && n <= 1 ? 0 : 1, Math.round(n * f))]);
    let R = 1234 + patchId.length * 77; const rnd = () => (R = (R * 16807) % 2147483647) / 2147483647;
    const inW = (x, z, m = 0) => deep.some(r => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);
    let placed = 0;
    for (const [kind, n] of kinds) {
      const T = await template(kind); if (my !== token) return; if (!T) continue; const D = CRITTERS[kind];
      const flockX = rect.x0 + 3 + rnd() * (rect.x1 - rect.x0 - 6), flockZ = rect.z0 + 3 + rnd() * (rect.z1 - rect.z0 - 6);
      for (let i = 0; i < n && placed < cap; i++) {
        let x = 0, z = 0, ok = false;
        for (let tries = 0; tries < 30 && !ok; tries++) {
          if (D.swim) { const r = deep[(rnd() * deep.length) | 0]; x = r.x0 + 0.6 + rnd() * Math.max(0.1, r.x1 - r.x0 - 1.2); z = r.z0 + 0.6 + rnd() * Math.max(0.1, r.z1 - r.z0 - 1.2); ok = true; break; }
          x = flockX + (rnd() - 0.5) * 8; z = flockZ + (rnd() - 0.5) * 8;
          if (x < rect.x0 + 1 || x > rect.x1 - 1 || z < rect.z0 + 1 || z > rect.z1 - 1) continue;
          if ((D.ground || kind === 'frog') && inW(x, z)) continue;
          if (kind === 'frog' && deep.length && !inW(x, z, 2.5)) continue;
          if (start && Math.hypot(x - start.x, z - start.z) < 5) continue; // out of the player's path at the start
          ok = true;
        }
        if (!ok) continue;
        const obj = T.root.clone(true); obj.scale.setScalar(T.scale); obj.userData.critter = kind;
        const mixer = new THREE.AnimationMixer(obj); if (T.clip) { const a = mixer.clipAction(T.clip); a.time = rnd() * T.clip.duration; a.play(); }
        const c = { kind, D, obj, mixer, hx: x, hz: z, x, z, yaw: rnd() * 6.28, tx: x, tz: z, wait: rnd() * 2, h: D.fly ? D.fly[0] + rnd() * (D.fly[1] - D.fly[0]) : 0, ph: rnd() * 6.28 };
        if (D.swim) c.wy = waterY - 0.2 - rnd() * 0.4;
        place(c, 0); group.add(obj); list.push(c); placed++;
      }
    }
    return placed;
  }
  function place(c, t) {
    const D = c.D, gy = heightAt(c.x, c.z);
    let y = gy; if (D.fly) y = gy + c.h + Math.sin(t * 2.1 + c.ph) * 0.1; else if (D.swim) y = c.wy ?? gy;
    c.obj.position.set(c.x, y, c.z); c.obj.rotation.y = c.yaw;
  }
  let acc = 0;
  function update(dt, t, night, cam) {
    if (!list.length) return; acc += dt; if (acc < 1 / 30) return; const d = acc; acc = 0; // 30 Hz is plenty for slow background motion
    for (const c of list) {
      const D = c.D, on = D.always || (D.night ? night > 0.5 : night <= 0.5) || (D.cave && c.kind === 'bat'); c.obj.visible = !!on; if (!on) continue;
      if (cam && Math.hypot(c.x - cam.x, c.z - cam.z) > 60) continue; // far: freeze (fog hides it)
      c.mixer.update(d);
      if (c.wait > 0) { c.wait -= d; continue; }
      const dx = c.tx - c.x, dz = c.tz - c.z, dist = Math.hypot(dx, dz);
      if (dist < 0.2) { const a = Math.random() * 6.28, r = Math.random() * D.r; c.tx = c.hx + Math.cos(a) * r; c.tz = c.hz + Math.sin(a) * r; c.wait = D.perch || D.hop ? 1.5 + Math.random() * 3 : D.hover ? 1 + Math.random() : Math.random() * 0.6; continue; }
      const want = Math.atan2(dx, dz); let dy = want - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, d * 1.2); // slow yaw turns only
      const v = D.spd * Math.min(1, dist) * d; c.x += Math.sin(c.yaw) * v; c.z += Math.cos(c.yaw) * v;
      place(c, t);
    }
  }
  return { spawn, clear, update, get list() { return list; }, group };
}
