import * as THREE from 'three';
import { SPECIES, AMBIENT, WORLD_R, POND } from './data.js';
import { loadGLB, bakeParts, lambertFrom, makeFlapMaterial, updateFlaps } from './models.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { heightAt } from './world.js';
import { makeGroundRider } from './animals.js';
export { updateFlaps };

const PI = Math.PI;
// orientation fixes so every model's nose points +Z with wings spread along X
export const MODEL_ROT = {
  moth: { seq: [['y', PI / 2], ['x', PI / 2]] },
  butterflyB: [0, PI, 0],
  dragonfly: [0, PI, 0],
};
export const BAT_FLAP = { amp: 0.62, freq: 10, body: 0.12, style: 'leather' };
const TINT = { bat: new THREE.Color(1.2, 1.15, 1.35), batAmb: new THREE.Color(1.2, 1.15, 1.35) }; // softened for Squid's blocky bat (was 2.6,2.2,3.2)

function flapMat(base, flap, span, tint) {
  return makeFlapMaterial(base, { amp: flap.amp, body: flap.body, span, tint, style: flap.style || 'sine', freq: flap.freq });
}

/** Skinned bat honouring integration-map Flying clip (+ clip_alias time scales). */
function makeBatSkinned(gltf, size) {
  const inst = cloneSkinned(gltf.scene);
  const tint = TINT.bat;
  inst.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const m = lambertFrom(o.material).clone();
    if (tint) m.color.multiply(tint);
    o.material = m;
  });
  // Fit like bakeParts max-mode centred (not grounded).
  const box0 = new THREE.Box3().setFromObject(inst);
  const sz = box0.getSize(new THREE.Vector3()), c = box0.getCenter(new THREE.Vector3());
  const dim = Math.max(sz.x, sz.y, sz.z);
  const s = size / Math.max(dim, 1e-5);
  inst.scale.setScalar(s);
  inst.position.set(-c.x * s, -c.y * s, -c.z * s);
  const wrap = new THREE.Group(); wrap.add(inst);
  const box = new THREE.Box3().setFromObject(wrap);
  const mixer = new THREE.AnimationMixer(inst);
  const clip = gltf.animations.find(a => /Flying$/i.test(a.name) || a.name.endsWith('Flying'));
  let flyAct = null;
  if (clip) {
    flyAct = mixer.clipAction(clip);
    flyAct.play();
    flyAct.timeScale = 1.0; // idle/walk/run → Flying @ 1.0 (clips map)
  }
  return { wrap, box, mixer, flyAct };
}

/** Build the rideable creature (with a tiny rider on its back). */
export async function buildRiders(scene) {
  const riders = {};
  const skin = new THREE.MeshLambertMaterial({ color: 0xf2c9a0 }), tunic = new THREE.MeshLambertMaterial({ color: 0x2fb7a6 }), cap = new THREE.MeshLambertMaterial({ color: 0xe8553d });
  for (const id of Object.keys(SPECIES)) {
    const sp = SPECIES[id];
    if (sp.ground) { const gr = makeGroundRider(id, sp.size); gr.visible = false; scene.add(gr); riders[id] = gr; continue; }
    const gltf = await loadGLB(sp.model); const root = new THREE.Group(), body = new THREE.Group();
    root.rotation.order = 'YXZ'; root.add(body);
    const rot = MODEL_ROT[sp.model] || [0, 0, 0];
    if (gltf) {
      // Bat has a real Flying clip (integration-map clips + clip_alias) — keep skin + mixer.
      if (id === 'bat' && gltf.animations && gltf.animations.some(a => /Flying/i.test(a.name))) {
        const sk = makeBatSkinned(gltf, sp.size);
        body.add(sk.wrap); body.userData.box = sk.box; root.userData.box = sk.box;
        root.userData.mixer = sk.mixer; root.userData.flyAct = sk.flyAct;
      } else {
        const { parts, box } = bakeParts(gltf, { size: sp.size, mode: 'max', rot, ground: false });
        const flap = sp.flap || BAT_FLAP;
        for (const p of parts) {
          const span = Math.max(box.max.x, -box.min.x) * 2;
          const m = flapMat(p.material, flap, span, TINT[sp.model]);
          const mesh = new THREE.Mesh(p.geometry, m); mesh.frustumCulled = false; body.add(mesh); (root.userData.flapMats ||= []).push(m);
        }
        body.userData.box = box; root.userData.box = box;
      }
    }
    // tiny rider
    const top = body.userData.box ? body.userData.box.max.y : sp.size * 0.2, k = sp.size * 0.17;
    const person = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.35, 3, 8), tunic); torso.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin); head.position.y = 1.0;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 8), cap); hat.position.y = 1.35; hat.rotation.x = -0.25;
    person.add(torso, head, hat); person.scale.setScalar(k * 1.5); person.position.set(0, top * 0.55, -sp.size * 0.04);
    body.add(person); root.userData.person = person; root.visible = false; scene.add(root); riders[id] = root; root.userData.body = body;
  }
  return riders;
}

/** Ambient creature populations as InstancedMeshes. */
/** season-driven share of ambient creatures that are out and about (winter: most nap). */
export const ACT = { v: 1 };
export async function buildAmbient(scene, world, quality = 1) {
  const B = world.blooms, kinds = [], dummy = new THREE.Object3D(); dummy.rotation.order = 'YXZ';
  for (const def of AMBIENT) {
    const gltf = await loadGLB(def.model); if (!gltf) continue;
    const count = Math.max(1, Math.round(def.count * (def.count > 10 ? quality : 1)));
    const rot = def.rot || MODEL_ROT[def.model] || [0, 0, 0];
    const { parts, box } = bakeParts(gltf, { size: def.size, mode: 'max', rot, ground: false });
    const flap = def.flap || (def.style === 'swoop' ? BAT_FLAP : null);
    const phase = new Float32Array(count).map(() => Math.random());
    const meshes = parts.map(p => {
      p.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
      const span = Math.max(box.max.x, -box.min.x) * 2;
      const mat = flap ? flapMat(p.material, flap, span, TINT[def.kind]) : lambertFrom(p.material);
      const im = new THREE.InstancedMesh(p.geometry, mat, count); im.frustumCulled = false; scene.add(im); return im;
    });
    const items = [];
    const arr = def.likes ? B.byPol[def.likes] : null;
    for (let i = 0; i < count; i++) {
      let x, z, y;
      if (arr && arr.length) { const b = arr[(Math.random() * arr.length) | 0]; x = B.x[b] + (Math.random() - 0.5) * 6; z = B.z[b] + (Math.random() - 0.5) * 6; y = B.y[b] + 1; }
      else { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 120; x = Math.cos(a) * d; z = Math.sin(a) * d; y = heightAt(x, z) + 6; }
      items.push({ x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, pitch: 0, roll: 0, st: 'seek', tm: Math.random() * 3, tgt: -1, wx: 0, wz: 0, wy: 8, ph: Math.random() * 10 });
    }
    kinds.push({ def, meshes, items, count, size: def.size });
  }
  const night = { v: 0 };

  function pick(it, def) {
    const arr = B.byPol[def.likes]; if (!arr || !arr.length) return -1;
    let best = -1, bd = 1e12;
    for (let k = 0; k < 10; k++) { const i = arr[(Math.random() * arr.length) | 0]; const d = (B.x[i] - it.x) ** 2 + (B.z[i] - it.z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function stepFlyer(it, def, dt, t, style) {
    if (it.st === 'seek') {
      if (it.tgt < 0) it.tgt = pick(it, def);
      if (it.tgt < 0) return;
      const tx = B.x[it.tgt], tz = B.z[it.tgt], ty = B.y[it.tgt] + (style === 'dart' ? 0.4 : 0.7);
      let dx = tx - it.x, dz = tz - it.z, dy = ty - it.y; const d = Math.hypot(dx, dz, dy) + 1e-4;
      const sp = def.speed * Math.min(1, 0.25 + d / 6);
      let ax = dx / d * sp, az = dz / d * sp, ay = dy / d * sp;
      if (style === 'flutter') { ay += Math.sin(t * 5 + it.ph) * 1.4; ax += Math.cos(t * 2.3 + it.ph) * 0.9; az += Math.sin(t * 2.7 + it.ph) * 0.9; }
      const k = 1 - Math.exp(-(style === 'dart' ? 7 : 2.5) * dt);
      it.vx += (ax - it.vx) * k; it.vy += (ay - it.vy) * k; it.vz += (az - it.vz) * k;
      if (d < 1.3) { it.st = 'hover'; it.tm = style === 'dart' ? 0.8 + Math.random() : 1.5 + Math.random() * 3; }
    } else { // hover on flower
      const k = 1 - Math.exp(-4 * dt); it.vx -= it.vx * k; it.vz -= it.vz * k; it.vy -= it.vy * k;
      it.vy += Math.sin(t * 4 + it.ph) * 0.25;
      it.tm -= dt; if (it.tm <= 0) { it.st = 'seek'; it.tgt = -1; }
    }
    it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
    const sp2 = Math.hypot(it.vx, it.vz);
    if (sp2 > 0.4) { const want = Math.atan2(it.vx, it.vz); let dy = want - it.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); it.yaw += dy * Math.min(1, dt * (style === 'dart' ? 12 : 4)); it.roll = THREE.MathUtils.lerp(it.roll, -dy * 0.6, 0.1); }
    it.pitch = THREE.MathUtils.lerp(it.pitch, -Math.atan2(it.vy, Math.max(sp2, 1.5)) * 0.6, 0.1);
  }
  function stepPatrol(it, def, dt, t) {
    it.tm -= dt;
    if (it.tm <= 0 || Math.hypot(it.wx - it.x, it.wz - it.z) < 4) { const a = Math.random() * 6.28, d = Math.random() * 90; it.wx = Math.cos(a) * d; it.wz = Math.sin(a) * d; it.wy = 4 + Math.random() * 8; it.tm = 6 + Math.random() * 6; }
    const want = Math.atan2(it.wx - it.x, it.wz - it.z); let dy = Math.atan2(Math.sin(want - it.yaw), Math.cos(want - it.yaw));
    it.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, dy)); it.roll = THREE.MathUtils.lerp(it.roll, -dy * 0.8, 0.08);
    it.x += Math.sin(it.yaw) * def.speed * dt; it.z += Math.cos(it.yaw) * def.speed * dt;
    const ty = heightAt(it.x, it.z) + it.wy; it.y += (ty - it.y) * dt * 0.8; it.pitch = 0;
  }
  function stepSwoop(it, def, dt, t) {
    it.tm -= dt;
    if (it.tm <= 0 || Math.hypot(it.wx - it.x, it.wz - it.z) < 10) { const a = Math.random() * 6.28, d = 30 + Math.random() * 100; it.wx = Math.cos(a) * d; it.wz = Math.sin(a) * d; it.wy = 8 + Math.random() * 20; it.tm = 8; }
    const want = Math.atan2(it.wx - it.x, it.wz - it.z); let dy = Math.atan2(Math.sin(want - it.yaw), Math.cos(want - it.yaw));
    it.yaw += Math.max(-0.9 * dt, Math.min(0.9 * dt, dy)); it.roll = THREE.MathUtils.lerp(it.roll, -dy * 1.2, 0.06);
    it.x += Math.sin(it.yaw) * def.speed * dt; it.z += Math.cos(it.yaw) * def.speed * dt;
    const ty = heightAt(it.x, it.z) + it.wy + Math.sin(t * 0.6 + it.ph) * 5; const oy = it.y; it.y += (ty - it.y) * dt * 0.6; it.pitch = -Math.atan2(it.y - oy, def.speed * dt) * 0.5;
  }
  function stepCrawl(it, def, dt, t) {
    const g = heightAt(it.x, it.z);
    if (it.st === 'seek' || it.st === 'walk') {
      if (it.tgt < 0) { it.tgt = pick(it, def); it.st = 'walk'; it.y = g + def.size * 0.25; }
      if (it.tgt < 0) return;
      const dx = B.x[it.tgt] - it.x, dz = B.z[it.tgt] - it.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { it.st = 'climb'; it.pitch = -1.4; }
      else { const want = Math.atan2(dx, dz); const df = Math.atan2(Math.sin(want - it.yaw), Math.cos(want - it.yaw)); it.yaw += df * Math.min(1, dt * 3); it.x += Math.sin(it.yaw) * def.speed * dt; it.z += Math.cos(it.yaw) * def.speed * dt; it.y = heightAt(it.x, it.z) + def.size * 0.25; it.pitch = 0; }
    } else if (it.st === 'climb') {
      it.y += 0.9 * dt; if (it.y >= B.y[it.tgt] * 0.9) { it.st = 'rest'; it.tm = 3 + Math.random() * 5; it.pitch = -0.3; }
    } else if (it.st === 'rest') { it.tm -= dt; if (it.tm <= 0) it.st = 'down'; }
    else if (it.st === 'down') { it.pitch = 1.3; it.y -= 1.1 * dt; if (it.y <= heightAt(it.x, it.z) + def.size * 0.25) { it.st = 'seek'; it.tgt = -1; it.yaw += 2; it.pitch = 0; } }
  }

  function update(dt, t, nightV) {
    night.v = nightV;
    for (const k of kinds) {
      const vis = k.def.night ? nightV > 0.5 : nightV < 0.5;
      const nAct = vis ? Math.max(1, Math.ceil(k.count * ACT.v)) : 0;
      for (const m of k.meshes) m.visible = vis;
      if (!vis) continue;
      const st = k.def.style;
      for (let i = 0; i < k.count; i++) {
        const it = k.items[i];
        if (i >= nAct) { dummy.position.set(it.x, -500, it.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); for (const m of k.meshes) m.setMatrixAt(i, dummy.matrix); continue; }
        if (st === 'bee' || st === 'flutter' || st === 'dart') stepFlyer(it, k.def, dt, t, st);
        else if (st === 'patrol') stepPatrol(it, k.def, dt, t);
        else if (st === 'swoop') stepSwoop(it, k.def, dt, t);
        else stepCrawl(it, k.def, dt, t);
        const r = Math.hypot(it.x, it.z); if (r > WORLD_R - 5) { it.x *= (WORLD_R - 5) / r; it.z *= (WORLD_R - 5) / r; }
        const gy = heightAt(it.x, it.z) + 0.4; if (it.y < gy && st !== 'crawl') it.y = gy;
        dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(it.pitch, it.yaw, it.roll); dummy.updateMatrix();
        for (const m of k.meshes) m.setMatrixAt(i, dummy.matrix);
      }
      for (const m of k.meshes) m.instanceMatrix.needsUpdate = true;
    }
  }
  return { update, kinds, total: kinds.reduce((a, k) => a + k.count, 0), counts: kinds.map(k => [k.def.kind, k.count]) };
}

/** A fresh flier model (no rider) for hired helpers. Shares the GLB; own flap materials / bat mixer. */
export async function makeFlierModel(id) {
  const sp = SPECIES[id], gltf = await loadGLB(sp.model); const root = new THREE.Group(), body = new THREE.Group(); root.rotation.order = 'YXZ'; root.add(body);
  if (gltf) {
    if (id === 'bat' && gltf.animations && gltf.animations.some(a => /Flying/i.test(a.name))) {
      const sk = makeBatSkinned(gltf, sp.size);
      body.add(sk.wrap); body.position.y = -sk.box.min.y; root.userData.box = sk.box;
      root.userData.mixer = sk.mixer; root.userData.flyAct = sk.flyAct;
    } else {
      const { parts, box } = bakeParts(gltf, { size: sp.size, mode: 'max', rot: MODEL_ROT[sp.model] || [0, 0, 0], ground: false });
      const flap = sp.flap || BAT_FLAP;
      for (const p of parts) { const span = Math.max(box.max.x, -box.min.x) * 2; const m = flapMat(p.material, flap, span, TINT[sp.model]); const mesh = new THREE.Mesh(p.geometry, m); mesh.frustumCulled = false; body.add(mesh); (root.userData.flapMats ||= []).push(m); }
      body.position.y = -box.min.y; root.userData.box = box;
    }
  }
  root.userData.body = body; return root;
}
