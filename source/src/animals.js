// Ground animals: friendly low-poly STAND-IN models built from primitives (swap point: GROUND_MODELS).
// Nothing here ever hunts, chases or harms anything: ambient animals just wander and nibble the plentiful ground food.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GROUND_AMBIENT, SPECIES, FOODS, POND, WORLD_R } from './data.js';
import { POLS } from './world.js';
import { getGLB, bakeParts, lambertFrom, toFloat } from './models.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// If real animal GLBs get added later, list them here (key in public/models + target size) and they replace the stand-ins.
// Real models (Beans Bot's pack). len = target length (nose to tail) in world units at SPECIES.size; skinned ones get animation clips.
//   raccoon: Quaternius (CC0, skinned: Idle/Walk/Run/Jump/Idle_Eating)   opossum: Squid's opossum.glb on the same raccoon rig
//   bear: bearB = Squid's bear-blocky.glb (raccoon rig)   robin: Jeremy (CC-BY 3.0, static). Falls back to the primitive stand-ins below if a file is missing.

/** Playable / helper / parked birds that get dedicated blocky wing meshes (not vertex-shader body flap). */
export const BIRD_IDS = new Set(['hummingbird', 'robin']);
export function isBird(id) { return BIRD_IDS.has(id); }

/**
 * Attach left/right blocky wing pivots to a bird body. Wings stay visible at rest (slightly folded)
 * and rotate while airborne / flapping. Cheap boxes — matches cute square animal style.
 */
export function attachBirdWings(root, body, sp) {
  if (!sp || !BIRD_IDS.has(sp.id) || root.userData.birdWings) return;
  const box = root.userData.box || body.userData?.box;
  const size = sp.size || 2;
  const isHum = sp.id === 'hummingbird';
  const base = new THREE.Color(sp.color || '#888888');
  const wingCol = isHum ? new THREE.Color(0x2a8f6a) : new THREE.Color(0x4a3426);
  wingCol.lerp(base, 0.25);
  const mat = new THREE.MeshLambertMaterial({ color: wingCol, flatShading: true });
  const span = isHum ? size * 0.62 : size * 0.55;
  const chord = isHum ? size * 0.28 : size * 0.42;
  const thick = isHum ? size * 0.07 : size * 0.1;
  const geo = new THREE.BoxGeometry(span, thick, chord);
  const halfX = box ? Math.max(Math.abs(box.max.x), Math.abs(box.min.x)) : size * 0.22;
  const midY = box ? (box.min.y + box.max.y) * 0.55 : size * 0.12;
  const midZ = box ? (box.min.z + box.max.z) * 0.15 : 0;
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(halfX * 0.55 * side, midY, midZ);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(side * span * 0.48, 0, 0);
    mesh.frustumCulled = false;
    pivot.add(mesh);
    pivot.userData.side = side;
    pivot.rotation.z = side * 0.35;
    pivot.rotation.x = 0.15;
    body.add(pivot);
    wings.push(pivot);
  }
  root.userData.birdWings = wings;
  root.userData.birdKind = sp.id;
  root.userData.isBird = true;
}

/** Animate bird wing pivots. Hummingbirds beat faster while flying / hovering; grounded wings settle. */
export function animateBirdWings(root, t, { air = false, flapping = false, grounded = true } = {}) {
  const wings = root.userData.birdWings;
  if (!wings || !wings.length) return;
  const isHum = root.userData.birdKind === 'hummingbird';
  let amp, freq, foldZ, foldX;
  if (flapping || (air && isHum && !grounded)) {
    freq = isHum ? 58 : 24;
    amp = isHum ? 1.05 : 0.9;
    foldZ = 0.08;
    foldX = -0.05;
  } else if (air && !grounded) {
    freq = isHum ? 28 : 11;
    amp = isHum ? 0.45 : 0.28;
    foldZ = 0.12;
    foldX = 0.05;
  } else {
    freq = 2.4;
    amp = 0.05;
    foldZ = 0.55;
    foldX = 0.35;
  }
  const beat = Math.sin(t * freq) * amp;
  for (const w of wings) {
    const s = w.userData.side || 1;
    w.rotation.z = (foldZ + beat) * s;
    w.rotation.x = foldX + Math.abs(beat) * 0.08;
  }
}

export const GROUND_MODELS = {
  raccoon: { key: 'raccoonQ', len: 2.3, skinned: true, tint: [1.6, 1.6, 1.7] },
  opossum: { key: 'opossum', len: 2.3, skinned: true }, // real opossum (Squid): same Quaternius raccoon rig + anim names
  bear: { key: 'bearB', len: 3.1, skinned: true }, // Squid's bear-blocky.glb (raccoon rig, 8 clips, baked colours); square style kept uniform, round bear.glb not used
  robin: { key: 'robinJ', len: 1.7, rot: [0, Math.PI / 2, 0] } // the GLB faces -X: turn it to +Z
};
const CLIPS = { idle: 'Idle', walk: 'Walk', run: 'Run', jump: 'Jump_Loop', eat: 'Idle_Eating' };
const modelOf = (kind) => { const m = GROUND_MODELS[kind]; return m && getGLB(m.key) ? m : null; };

/** Pose a (possibly skinned) glTF into plain static meshes (world space), ready for bakeParts / instancing. */
function posedScene(gltf, clipName) {
  const root = cloneSkinned(gltf.scene);
  if (clipName) { const clip = gltf.animations.find(a => a.name.endsWith(clipName)); if (clip) { const mx = new THREE.AnimationMixer(root); mx.clipAction(clip).play(); mx.update(0.01); } }
  root.updateMatrixWorld(true);
  const out = new THREE.Group(), v = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = toFloat(o.geometry.clone());
    if (o.isSkinnedMesh) {
      const pos = g.attributes.position, arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { o.getVertexPosition(i, v); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; }
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight'); g.deleteAttribute('normal');
    }
    g.applyMatrix4(o.matrixWorld);
    out.add(new THREE.Mesh(g, o.material));
  });
  return { scene: out };
}
const tintedMat = (m, tint) => { const n = lambertFrom(m).clone(); if (tint) n.color.setRGB(tint[0], tint[1], tint[2]); return n; };
/** Static baked parts [{geometry, material}] of a real ground model at its target length. */
function realParts(kind) {
  const m = modelOf(kind); if (!m) return null;
  const { parts } = bakeParts(posedScene(getGLB(m.key), m.skinned ? CLIPS.idle : null), { size: m.len, mode: 'length', rot: m.rot || [0, 0, 0] });
  return parts.map(p => ({ geometry: p.geometry, material: tintedMat(p.material, m.tint) }));
}

const G = { s: (r, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h), c: (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n), k: (r, h, n = 8) => new THREE.ConeGeometry(r, h, n), b: (x, y, z) => new THREE.BoxGeometry(x, y, z) };
// part: [geo, hex, x,y,z, sx,sy,sz, rx,ry,rz, tag, pivotY]
const SPEC = {
  raccoon: { scale: 1.55, parts: [
    [G.s(0.32), 0x8a8d98, 0, 0.45, 0, 0.85, 0.8, 1.35], [G.s(0.25), 0x9a9da8, 0, 0.62, 0.5, 1.1, 0.95, 1],
    [G.s(0.2), 0x23232a, 0, 0.64, 0.63, 1.1, 0.34, 0.5], [G.s(0.12), 0xf4f4f4, 0, 0.54, 0.74, 1, 0.8, 1], [G.s(0.045), 0x111111, 0, 0.56, 0.85],
    [G.s(0.04), 0xffffff, -0.1, 0.67, 0.72], [G.s(0.04), 0xffffff, 0.1, 0.67, 0.72], [G.s(0.02), 0x000000, -0.1, 0.67, 0.755], [G.s(0.02), 0x000000, 0.1, 0.67, 0.755],
    [G.k(0.09, 0.17), 0x3a3a42, -0.16, 0.86, 0.45], [G.k(0.09, 0.17), 0x3a3a42, 0.16, 0.86, 0.45],
    [G.c(0.065, 0.06, 0.32), 0x34343c, -0.17, 0.16, 0.32, 1, 1, 1, 0, 0, 0, 'FL', 0.32], [G.c(0.065, 0.06, 0.32), 0x34343c, 0.17, 0.16, 0.32, 1, 1, 1, 0, 0, 0, 'FR', 0.32],
    [G.c(0.07, 0.06, 0.32), 0x34343c, -0.17, 0.16, -0.32, 1, 1, 1, 0, 0, 0, 'BL', 0.32], [G.c(0.07, 0.06, 0.32), 0x34343c, 0.17, 0.16, -0.32, 1, 1, 1, 0, 0, 0, 'BR', 0.32],
    ...[0, 1, 2, 3, 4].map(i => [G.c(0.115 - i * 0.008, 0.115 - i * 0.008, 0.13, 8), i % 2 ? 0x25252b : 0x9a9ca6, 0, 0.5 + i * 0.03, -0.52 - i * 0.12, 1, 1, 1, Math.PI / 2 + 0.2, 0, 0, 'tail', 0.5])
  ] },
  robin: { scale: 1.45, parts: [
    [G.s(0.3), 0x7b5a46, 0, 0.45, 0, 1, 1, 1.2], [G.s(0.25), 0xe8632a, 0, 0.42, 0.13, 1, 1.02, 1.05], [G.s(0.2), 0x6d5040, 0, 0.72, 0.2],
    [G.k(0.055, 0.17, 6), 0xf2c23a, 0, 0.7, 0.42, 1, 1, 1, Math.PI / 2], [G.s(0.035), 0x111111, -0.1, 0.77, 0.32], [G.s(0.035), 0x111111, 0.1, 0.77, 0.32],
    [G.s(0.2), 0x5a4030, -0.28, 0.5, -0.04, 0.3, 0.75, 1.15, 0, 0, 0, 'WL', 0.5], [G.s(0.2), 0x5a4030, 0.28, 0.5, -0.04, 0.3, 0.75, 1.15, 0, 0, 0, 'WR', 0.5],
    [G.b(0.14, 0.04, 0.4), 0x4a3426, 0, 0.46, -0.48, 1, 1, 1, 0.25],
    [G.c(0.022, 0.02, 0.3, 5), 0xc0804a, -0.08, 0.15, 0.04, 1, 1, 1, 0, 0, 0, 'L', 0.3], [G.c(0.022, 0.02, 0.3, 5), 0xc0804a, 0.08, 0.15, 0.04, 1, 1, 1, 0, 0, 0, 'R', 0.3]
  ] },
  opossum: { scale: 1.5, parts: [
    [G.s(0.3), 0xcfc8bb, 0, 0.4, 0, 0.8, 0.8, 1.45], [G.s(0.17), 0xf0ece4, 0, 0.46, 0.58, 0.85, 0.85, 1.7], [G.s(0.05), 0xe89aa0, 0, 0.42, 0.84],
    [G.s(0.1), 0x3f3535, -0.12, 0.64, 0.5, 1, 1, 0.4], [G.s(0.1), 0x3f3535, 0.12, 0.64, 0.5, 1, 1, 0.4], [G.s(0.03), 0x000000, -0.07, 0.54, 0.72], [G.s(0.03), 0x000000, 0.07, 0.54, 0.72],
    [G.c(0.05, 0.045, 0.3, 6), 0x5a554e, -0.15, 0.15, 0.32, 1, 1, 1, 0, 0, 0, 'FL', 0.3], [G.c(0.05, 0.045, 0.3, 6), 0x5a554e, 0.15, 0.15, 0.32, 1, 1, 1, 0, 0, 0, 'FR', 0.3],
    [G.c(0.055, 0.045, 0.3, 6), 0x5a554e, -0.15, 0.15, -0.34, 1, 1, 1, 0, 0, 0, 'BL', 0.3], [G.c(0.055, 0.045, 0.3, 6), 0x5a554e, 0.15, 0.15, -0.34, 1, 1, 1, 0, 0, 0, 'BR', 0.3],
    ...[0, 1, 2, 3, 4, 5].map(i => [G.c(0.05 - i * 0.004, 0.05 - i * 0.004, 0.2, 6), 0xe8a8a8, 0, 0.45 - i * 0.025 + (i > 3 ? 0.07 * (i - 3) : 0), -0.55 - i * 0.17, 1, 1, 1, Math.PI / 2, 0, 0, 'tail', 0.45])
  ] },
  bear: { scale: 1.75, parts: [
    [G.s(0.5, 12, 9), 0x3b2e28, 0, 0.78, 0, 1, 0.95, 1.35], [G.s(0.3, 12, 9), 0x3b2e28, 0, 1.0, 0.72], [G.s(0.16), 0xb08a62, 0, 0.92, 0.97, 1, 0.8, 1.2], [G.s(0.06), 0x0a0a0a, 0, 0.97, 1.13],
    [G.s(0.1), 0x3b2e28, -0.2, 1.27, 0.64], [G.s(0.1), 0x3b2e28, 0.2, 1.27, 0.64], [G.s(0.04), 0x000000, -0.11, 1.06, 0.97], [G.s(0.04), 0x000000, 0.11, 1.06, 0.97],
    [G.s(0.22), 0x4a3a30, 0, 0.9, 0.4, 1.4, 1, 1],
    [G.c(0.15, 0.14, 0.58, 8), 0x2f2420, -0.3, 0.29, 0.5, 1, 1, 1, 0, 0, 0, 'FL', 0.58], [G.c(0.15, 0.14, 0.58, 8), 0x2f2420, 0.3, 0.29, 0.5, 1, 1, 1, 0, 0, 0, 'FR', 0.58],
    [G.c(0.17, 0.15, 0.58, 8), 0x2f2420, -0.3, 0.29, -0.5, 1, 1, 1, 0, 0, 0, 'BL', 0.58], [G.c(0.17, 0.15, 0.58, 8), 0x2f2420, 0.3, 0.29, -0.5, 1, 1, 1, 0, 0, 0, 'BR', 0.58],
    [G.s(0.09), 0x3b2e28, 0, 0.82, -0.74, 1, 1, 1, 0, 0, 0, 'tail', 0.82]
  ] }
};
const col = (hex) => new THREE.MeshLambertMaterial({ color: hex });

/** Animated rig for the playable animal (feet at y=0, nose +Z). */
export function makeGroundRider(kind, size) {
  const real = modelOf(kind);
  if (real) return makeRealRider(kind, size, real);
  const sp = SPEC[kind], root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const rig = { legs: {}, tails: [], kind };
  const mats = new Map();
  for (const p of sp.parts) {
    const [geo, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, tag, pv] = p;
    if (!mats.has(hex)) mats.set(hex, col(hex));
    const m = new THREE.Mesh(geo, mats.get(hex)); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
    if (tag) { const grp = new THREE.Group(); grp.position.set(x, pv, z); m.position.set(0, y - pv, 0); grp.add(m); body.add(grp); if (tag === 'tail') rig.tails.push(grp); else if (tag === 'WL' || tag === 'WR') { (rig.wings ||= []).push(grp); grp.userData.side = tag === 'WL' ? -1 : 1; } else rig.legs[tag] = grp; if (tag === 'tail') { grp.position.set(x, pv, z); m.position.set(0, y - pv, 0); } }
    else { m.position.set(x, y, z); body.add(m); }
  }
  const k = size / (kind === 'bear' ? 1.75 : 1) * 0; // (size handled via SPEC scale)
  body.scale.setScalar(sp.scale * (size / SPECIES[kind].size));
  root.userData = { body, rig, ground: true, phase: 0 };
  if (kind === 'robin' && rig.wings && rig.wings.length) {
    root.userData.birdWings = rig.wings;
    root.userData.birdKind = 'robin';
    root.userData.isBird = true;
  }
  return root;
}
function makeRealRider(kind, size, m) {
  const gltf = getGLB(m.key), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const k = size / SPECIES[kind].size; body.scale.setScalar(k);
  const u = { body, rig: { legs: {}, tails: [], kind }, ground: true, phase: 0 };
  if (m.skinned) {
    const inst = cloneSkinned(gltf.scene);
    inst.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = tintedMat(o.material, m.tint); } });
    // fit: measure the rest pose once, then scale/centre like bakeParts does
    const raw = new THREE.Box3().setFromObject(posedScene(gltf, CLIPS.idle).scene), sz = raw.getSize(new THREE.Vector3()), c = raw.getCenter(new THREE.Vector3());
    const s = m.len / Math.max(sz.z, 1e-5); inst.scale.setScalar(s); inst.position.set(-c.x * s, -raw.min.y * s, -c.z * s);
    if (m.wide) inst.scale.x *= m.wide;
    const wrap = new THREE.Group(); wrap.add(inst); body.add(wrap);
    const mixer = new THREE.AnimationMixer(inst), acts = {};
    for (const [key, name] of Object.entries(CLIPS)) { const clip = gltf.animations.find(a => a.name.endsWith(name)); if (clip) { acts[key] = mixer.clipAction(clip); acts[key].play(); acts[key].weight = key === 'idle' ? 1 : 0; } }
    u.mixer = mixer; u.acts = acts; u.cur = 'idle';
  } else {
    const parts = realParts(kind) || [];
    let box = null;
    if (parts.length) {
      box = new THREE.Box3();
      for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
    }
    for (const p of parts) {
      const mesh = new THREE.Mesh(p.geometry, p.material); mesh.frustumCulled = false; body.add(mesh);
    }
    if (box) { u.box = box; body.userData.box = box; }
    if (kind === 'robin') attachBirdWings(root, body, SPECIES.robin);
  }
  root.userData = u; return root;
}
/** Per-frame animation for the playable rig. speed 0..1, air = airborne, flap = fluttering, dig = 0..1 dip pulse. */
export function animateGround(root, dt, t, speed, air, flap, dig) {
  const u = root.userData, rig = u.rig, body = u.body;
  if (u.mixer) { // real skinned model: blend between the Quaternius clips
    const want = air ? 'jump' : dig > 0.05 ? 'eat' : speed > 0.62 ? 'run' : speed > 0.06 ? 'walk' : 'idle';
    for (const k in u.acts) { const a = u.acts[k], tw = k === want ? 1 : 0; a.weight += (tw - a.weight) * Math.min(1, dt * 10); }
    if (u.acts.walk) u.acts.walk.timeScale = 0.6 + speed * 1.0; if (u.acts.run) u.acts.run.timeScale = 0.7 + speed * 0.5;
    u.mixer.update(dt); u.phase += dt * (6 + speed * 8) * (speed > 0.05 ? 1 : 0);
    body.rotation.x = (air ? -0.1 : 0) + dig * 0.25; body.position.y = 0; return;
  }
  u.phase += dt * (6 + speed * 8) * (speed > 0.05 ? 1 : 0);
  const sw = Math.sin(u.phase) * 0.9 * Math.min(1, speed * 1.4), L = rig.legs, hop = rig.kind === 'robin';
  if (air) { const tuck = flap ? 0.2 : 0.7; for (const k in L) { L[k].rotation.x = (k[0] === 'F' || (hop && true) ? -tuck : tuck) * (flap ? 1 : 1); } }
  else if (hop && L.L) { L.L.rotation.x = L.R.rotation.x = sw * 0.8; }
  else { if (L.FL) { L.FL.rotation.x = sw; L.BR.rotation.x = sw; L.FR.rotation.x = -sw; L.BL.rotation.x = -sw; } }
  if (u.birdWings && u.birdWings.length) {
    animateBirdWings(root, t, { air, flapping: flap, grounded: !air });
  } else if (rig.wings && rig.wings.length) {
    const a = flap ? Math.sin(t * 26) * 0.95 : air ? Math.sin(t * 9) * 0.25 : Math.sin(t * 3) * 0.06;
    for (const w of rig.wings) w.rotation.z = a * (w.userData.side || 1);
  }
  const bob = air ? 0 : Math.abs(Math.sin(u.phase)) * 0.06 * Math.min(1, speed * 1.5) * (hop ? 2 : 1);
  body.position.y = bob;
  if (!rig.tails.length && !L.FL && !L.L) body.rotation.z = Math.sin(u.phase) * 0.06 * Math.min(1, speed * 1.4);
  // Birds: no body pitch-bob while flapping — wings do the work
  body.rotation.x = (air ? -0.12 : 0) + dig * 0.6 + (flap && !u.isBird ? -0.2 + Math.sin(t * 30) * 0.05 : 0);
  for (const tl of rig.tails) tl.rotation.z = Math.sin(t * 2.4 + u.phase * 0.5) * 0.25;
}

/** Merged, vertex-coloured static geometry of one animal (for instancing ambient ones). */
function mergedGeometry(kind) {
  const sp = SPEC[kind], geos = [];
  for (const p of sp.parts) {
    const [geo, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, tag, pv] = p;
    const g = geo.clone(); const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m); const ng = g.index ? g.toNonIndexed() : g; ng.deleteAttribute('uv');
    const c = new THREE.Color(hex), n = ng.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    ng.setAttribute('color', new THREE.BufferAttribute(a, 3)); geos.push(ng);
  }
  const g = mergeGeometries(geos); g.scale(sp.scale, sp.scale, sp.scale); return g;
}

/** Calm ambient wildlife: wander, nibble the plentiful ground food, rest. Nobody chases or fights anybody. */
export function buildGroundAmbient(scene, world, quality = 1) {
  const B = world.blooms, heightAt = world.heightAt, phys = world.phys, D = new THREE.Object3D(), herds = [];
  let rs = 99; const R = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  for (const def of GROUND_AMBIENT) {
    const n = Math.max(1, Math.round(def.count * (def.count > 4 ? Math.max(0.6, quality) : 1)));
    const rp = realParts(def.kind) || [{ geometry: mergedGeometry(def.kind), material: new THREE.MeshLambertMaterial({ vertexColors: true }) }];
    const im = rp.map(p => { const x = new THREE.InstancedMesh(p.geometry, p.material, n); x.frustumCulled = false; scene.add(x); return x; });
    const bit = 1 << POLS.indexOf(def.kind);
    const list = [];
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0;
      if (def.kind === 'bear') { const nn = SPECIES.bear.nest; const a = R() * 6.28, d = 25 + R() * 50; x = nn.x + Math.cos(a) * d; z = nn.z + Math.sin(a) * d; }
      else { const a = R() * 6.28, d = Math.sqrt(R()) * (WORLD_R - 25); x = Math.cos(a) * d; z = Math.sin(a) * d; }
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r * 2.2) { x += 30; }
      list.push({ x, z, yaw: R() * 6.28, state: 'idle', t: R() * 3, tx: x, tz: z, target: -1, ph: R() * 6, s: 0.9 + R() * 0.2, eat: 0 });
    }
    herds.push({ def, im, list, bit });
  }
  return {
    update(dt, t) {
      for (const h of herds) {
        const { def, im, list, bit } = h;         list.forEach((a, i) => {
          a.t -= dt;
          if (a.state === 'idle' && a.t <= 0) {
            // choose something nearby to nibble, otherwise amble
            let best = -1, bd = 1e9; B.query(a.x, a.z, 26, j => { if (!(B.mask[j] & bit) || B.readyAt[j] > t) return; const d = (B.x[j] - a.x) ** 2 + (B.z[j] - a.z) ** 2; if (d < bd && d > 4 && Math.random() < 0.5) { bd = d; best = j; } });
            if (best >= 0) { a.target = best; a.tx = B.x[best]; a.tz = B.z[best]; } else { const an = Math.random() * 6.28, d = 8 + Math.random() * 18; a.tx = a.x + Math.cos(an) * d; a.tz = a.z + Math.sin(an) * d; a.target = -1; }
            if (Math.hypot(a.tx, a.tz) > WORLD_R - 18 || Math.hypot(a.tx - POND.x, a.tz - POND.z) < POND.r * 1.6) { a.tx = a.x * 0.8; a.tz = a.z * 0.8; a.target = -1; }
            a.state = 'walk';
          }
          if (a.state === 'walk') {
            const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
            if (d < 1.2) { a.state = a.target >= 0 ? 'eat' : 'idle'; a.t = a.target >= 0 ? 1.6 : 1 + Math.random() * 3; a.eat = 0; }
            else {
              const want = Math.atan2(dx, dz); let df = want - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 4);
              const sp = def.speed * (0.8 + 0.2 * a.s); a.x += Math.sin(a.yaw) * sp * dt; a.z += Math.cos(a.yaw) * sp * dt; a.ph += dt * sp * 2.2;
              const pp = { x: a.x, z: a.z, y: heightAt(a.x, a.z) }; if (phys.resolve(pp, 0.8, 1.2, 0.7)) { a.x = pp.x; a.z = pp.z; if (Math.random() < 0.05) a.state = 'idle'; }
            }
          } else if (a.state === 'eat') {
            a.eat = Math.min(1, a.eat + dt * 3);
            if (a.t <= 0) { if (a.target >= 0 && B.readyAt[a.target] <= t) world.food.take(a.target, t); a.target = -1; a.state = 'idle'; a.t = 1 + Math.random() * 2.5; a.eat = 0; }
          }
          const y = Math.max(heightAt(a.x, a.z), -1.5);
          const bob = a.state === 'walk' ? Math.abs(Math.sin(a.ph)) * (def.kind === 'robin' ? 0.28 : 0.06) : 0;
          D.position.set(a.x, y + bob, a.z); D.rotation.set(a.state === 'eat' ? 0.55 * Math.abs(Math.sin(t * 7 + i)) + 0.2 : 0, a.yaw, a.state === 'walk' ? Math.sin(a.ph) * 0.05 : 0); D.scale.setScalar(a.s * def.size / SPECIES[def.kind].size); D.updateMatrix(); for (const x of im) x.setMatrixAt(i, D.matrix);
        });
        for (const x of im) x.instanceMatrix.needsUpdate = true;
      }
    }
  };
}
