import * as THREE from 'three';
import { SPECIES, STAGE_AT } from './data.js';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { heightAt } from './world.js';

const L = (c, e = 0, o = {}) => new THREE.MeshLambertMaterial({ color: c, emissive: e, ...o });
const wood = L(0x8a5a35), wax = L(0xf3b73a, 0x5a3a05), dark = L(0x2a2438), silk = L(0xf2f2ff, 0x5a5a88), leafM = L(0x4aa33a), egg = L(0xf8e8f0, 0x331122), mossM = L(0x5c8a3a);

async function glb(key, { h, w, rot = [0, 0, 0], x = 0, y = 0, z = 0, yaw = 0, tilt = 0 }) {
  const g = await loadGLB(key); const grp = new THREE.Group(); if (!g) return grp;
  const { parts } = bakeParts(g, { size: h || w, mode: h ? 'height' : 'max', rot });
  for (const p of parts) grp.add(new THREE.Mesh(p.geometry, lambertFrom(p.material)));
  grp.position.set(x, y, z); grp.rotation.set(tilt, yaw, 0); return grp;
}
/** blocky species-home centerpiece with lv1/lv2/lv3 nodes: one common scale (lv3 = h), shows lv by home stage (1..3) */
async function lvGLB(gl, { h, x = 0, z = 0, yaw = 0 }) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = yaw; grp.userData.lvs = [];
  if (!gl) return grp; const sc = gl.scene; sc.updateMatrixWorld(true);
  const lv = [1, 2, 3].map(i => sc.getObjectByName('lv' + i)); if (!lv[2]) return grp;
  const k = h / (new THREE.Box3().setFromObject(lv[2]).getSize(new THREE.Vector3()).y || 1);
  for (const n of lv) { const o = new THREE.Group(); o.visible = false; if (n) { const hh = new THREE.Box3().setFromObject(n).getSize(new THREE.Vector3()).y; for (const p of bakeParts({ scene: n }, { size: hh * k, mode: 'height' }).parts) o.add(new THREE.Mesh(p.geometry, lambertFrom(p.material))); } grp.add(o); grp.userData.lvs.push(o); }
  grp.userData.setLv = l => grp.userData.lvs.forEach((o, i) => { o.visible = i === Math.max(0, Math.min(2, l - 1)); });
  grp.userData.setLv(1); return grp;
}
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
function chrysalis(x, y, z, glow = 0x7aff9a, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9 * s), dark, 0, 0.45 * s, 0));
  const body = mesh(new THREE.SphereGeometry(0.34 * s, 10, 8), L(0x7bcf72, glow, { emissiveIntensity: 0.5 })); body.scale.set(1, 1.9, 1); body.position.y = -0.3 * s; g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.06 * s, 6, 6), L(0xffd34a, 0xffaa00), 0.2 * s, -0.2 * s, 0.26 * s));
  g.position.set(x, y, z); return g;
}
function cocoon(x, y, z, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4 * s), silk, 0, 0.7 * s, 0));
  const b = mesh(new THREE.SphereGeometry(0.42 * s, 10, 8), silk); b.scale.set(1, 1.7, 1); b.position.y = -0.4 * s; g.add(b);
  g.position.set(x, y, z); return g;
}
function batBox(h) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.15 * h, 0.2 * h, h * 1.2, 6), wood, 0, h * 0.6, 0));
  const box = mesh(new THREE.BoxGeometry(h * 0.9, h * 1.2, h * 0.55), wood, 0, h * 1.5, 0); g.add(box);
  g.add(mesh(new THREE.BoxGeometry(h * 1.0, h * 0.12, h * 0.7), L(0x5a3a22), 0, h * 2.15, 0));
  g.add(mesh(new THREE.BoxGeometry(h * 0.5, h * 0.12, h * 0.06), dark, 0, h * 1.0, h * 0.29));
  return g;
}
function hangingBat(x, y, z) {
  const g = new THREE.Group(); const m = L(0x4a3a6a, 0x180c30);
  const b = mesh(new THREE.SphereGeometry(0.28, 8, 6), m); b.scale.set(1, 1.6, 1); g.add(b);
  const w = mesh(new THREE.ConeGeometry(0.4, 0.8, 4), m, 0, -0.1, 0); w.scale.z = 0.3; g.add(w);
  g.position.set(x, y, z); return g;
}

const BUILDERS = {
  async bee(S) {
    S[0].add(await glb('stump', { h: 2.2, x: -2, z: 1 }), mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 6), wax, 1, 0.1, 1.5), mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 6), wax, 2.3, 0.1, 0.4));
    S[1].add(await glb('beehive', { h: 3.4, x: 1, z: -1, yaw: 0.4 }), await glb('honeycomb', { w: 2.2, x: 3.3, z: 2, y: 0 }));
    S[2].add(await glb('beehive', { h: 4.8, x: -4, z: -3, yaw: 2 }), await glb('honeycomb2', { w: 2.4, x: 4, z: -2, yaw: 1 }), mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 6), wax, 0.5, 0.15, 4));
    const big = await glb('beehive', { h: 8.5, x: 0, z: -6, yaw: 0.2 });
    const halo = mesh(new THREE.SphereGeometry(5.5, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 4.5, -6);
    S[3].add(big, halo, await glb('beehive', { h: 3, x: 5.5, z: -5, yaw: 1 }), await glb('beehive', { h: 3, x: -5.5, z: -6, yaw: 3 }));
  },
  async butterfly(S) {
    for (let i = 0; i < 5; i++) S[0].add(await glb('leaf', { h: 1.8, x: Math.cos(i * 1.3) * 2.5, z: Math.sin(i * 1.3) * 2.5, yaw: i, tilt: 0.5 }));
    S[0].add(mesh(new THREE.TorusGeometry(2.5, 0.12, 6, 20), leafM, 0, 0.1, 0).rotateX(Math.PI / 2));
    S[1].add(await glb('branch', { h: 5, x: 0, z: -2, tilt: 0 }), chrysalis(0.4, 4.2, -2, 0x7aff9a));
    S[2].add(await glb('bushFlowers', { h: 4.5, x: -4, z: 2 }), chrysalis(-0.8, 4.4, -2.2), chrysalis(1.6, 3.9, -1.8, 0xffa0e0), chrysalis(-3, 3, 2, 0x9ad0ff), chrysalis(-4.8, 3.2, 2, 0x7aff9a));
    const arch = mesh(new THREE.TorusGeometry(5, 0.22, 6, 24, Math.PI), L(0x4a8a3a), 0, 0, 5); arch.rotation.set(0, 0, 0);
    S[3].add(arch, mesh(new THREE.TorusGeometry(5, 0.22, 6, 24, Math.PI), L(0x4a8a3a), 0, 0, 5.8), await glb('flowersBush', { h: 4, x: -5, z: 5 }), await glb('flowersBush', { h: 4, x: 5, z: 5 }), chrysalis(-2.5, 4.6, 5.4, 0xffe27a, 1.1), chrysalis(0, 5.4, 5.4, 0xff9ae0, 1.2), chrysalis(2.5, 4.6, 5.4, 0x9ad0ff, 1.1));
  },
  async hummingbird(S) {
    S[0].add(await glb('branch', { h: 4, x: 0, z: 0, yaw: 0.6 }), mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 5), wood, 1.5, 2.6, 0).rotateZ(1.0));
    S[1].add(await glb('birdsNest', { w: 3.0, x: 0.3, y: 3.2, z: 0 }), await glb('mossPatch', { w: 2.2, x: -2, z: 2 }));
    S[2].add(mesh(new THREE.SphereGeometry(0.28, 8, 6), egg, 0.2, 3.6, 0.2), mesh(new THREE.SphereGeometry(0.28, 8, 6), egg, 0.9, 3.55, -0.3), await glb('mossPatch', { w: 2.6, x: 3, z: -2, yaw: 1 }), await glb('bell', { h: 4, x: -3.5, z: -1 }));
    S[3].add(await glb('treeA', { h: 9, x: -2, z: -5 }), await glb('birdHouse', { h: 3.2, x: 3.5, z: 2.5, yaw: -0.6 }), await glb('redflower', { h: 3, x: 5, z: -1 }), await glb('hibiscus', { h: 4, x: -5, z: 3 }));
  },
  async moth(S) {
    S[0].add(await glb('logHollow', { h: 3, x: 0, z: 0, yaw: 0.5 }));
    S[1].add(await glb('branch', { h: 5, x: 3.5, z: -1.5, tilt: 0 }), cocoon(3.6, 4.6, -1.5), cocoon(4.4, 4.2, -1.2, 0.9));
    S[2].add(await glb('fallenLog', { h: 2, x: -4, z: 2, yaw: 1 }), cocoon(-4, 3.5, 2, 1.1), cocoon(-3.2, 3.2, 2.3), mesh(new THREE.IcosahedronGeometry(3, 1), L(0xf2f2ff, 0x4a4a88, { transparent: true, opacity: 0.22, wireframe: true }), 3.9, 3.5, -1.5));
    S[3].add(await glb('willow', { h: 13, x: 0, z: -6 }), cocoon(-3, 8, -6, 1.3), cocoon(0, 9.5, -4, 1.4), cocoon(3, 8, -5, 1.2), cocoon(-1.5, 6.5, -3), cocoon(2, 6, -3));
  },
  async bat(S) {
    S[0].add(await glb('rockMedium', { h: 2.8, x: -2.5, z: 1 }), await glb('rockMedium', { h: 2, x: 2.5, z: -1, yaw: 1 }), await glb('branch', { h: 4, x: 0, z: -2, yaw: 1.5 }));
    const roost = await lvGLB(await loadGLB('x/buildings/species/bat-roost'), { h: 5, x: -1, z: -4.6, yaw: 0.3 }); S.lv = roost; S[1].add(roost.userData.lvs.length ? roost : (() => { const b1 = batBox(1.6); b1.position.set(-1, 0, -4); return b1; })(), hangingBat(-1, 3.8, -3.6));
    S[2].add(await glb('caveEntrance', { h: 6, x: 5, z: -5, yaw: -0.5 }), hangingBat(-0.6, 3.6, -3.6));
    const b2 = batBox(2.2); b2.position.set(-6, 0, -1); S[3].add(await glb('caveEntrance', { h: 10, x: 6, z: -9, yaw: -0.6 }), b2, hangingBat(-6, 5, -0.5), hangingBat(-5.2, 5.2, -0.5), hangingBat(2, 2.5, -4));
  },
  async bumblebee(S) {
    const dirt = L(0x7a5a38), dirtD = L(0x5a4026), hole = L(0x120c08);
    const mound = (r, x, z) => { const m = mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dirt, x, 0, z); m.scale.y = 0.62; return m; };
    const hl = (r, x, y, z) => { const h = mesh(new THREE.CircleGeometry(r, 14), hole, x, y, z); return h; };
    S[0].add(mound(2.4, 0, 0), hl(0.55, 0, 0.8, 1.9), await glb('mossPatch', { w: 2.4, x: -2.5, z: 2 }));
    const pot = (x, z, h = 0.9, c = 0xf3b73a) => mesh(new THREE.CylinderGeometry(0.42, 0.34, h, 8), L(c, 0x4a3000), x, h / 2, z);
    const burrow = await lvGLB(await loadGLB('x/buildings/species/bumblebee-burrow'), { h: 4.2, x: -0.5, z: -5.2, yaw: 0.2 }); S.lv = burrow;
    S[1].add(burrow, pot(2.6, 1.6), pot(3.5, 0.5, 0.7, 0xffd36a), pot(2.4, -0.7, 0.8, 0xf0a030), await glb('mushroom2', { h: 1.4, x: -4, z: -0.5 }));
    S[2].add(mound(1.7, -3, -2.6), await glb('honeycomb', { w: 2, x: 0, z: 3.6 }), await glb('stumpMoss', { h: 1.5, x: 4.5, z: -2.2 }), pot(-2, 3.2, 1.1, 0xffc531));
    const big = mound(4.6, 0, -6.5); const halo = mesh(new THREE.SphereGeometry(4.6, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 2.5, -6.5);
    S[3].add(big, halo, hl(1.1, 0, 1.6, -3.6), await glb('oak', { h: 9, x: 5, z: -8 }), await glb('honeycomb2', { w: 2.2, x: -3.6, z: 1.2, yaw: 1 }), await glb('bushFlowers', { h: 3.2, x: 6, z: 2 }), await glb('mushroom1', { h: 1.5, x: -6, z: -1 }));
  },
  async raccoon(S) {
    S[0].add(await glb('logHollow', { h: 3, x: 0, z: 0, yaw: 0.8 }));
    S[1].add(await glb('mossPatch', { w: 3.4, x: -3, z: 2.5 }), await glb('fallenLog', { h: 2, x: 3.5, z: 3, yaw: 0.3 }), await glb('leaf', { h: 1.5, x: -1, z: 4, yaw: 1, tilt: 0.3 }));
    const hollow = mesh(new THREE.SphereGeometry(1.1, 10, 8), L(0x120e12), 0, 2.2, 3.6); hollow.scale.set(0.8, 1.2, 0.35);
    S[2].add(await glb('oak', { h: 11, x: 0, z: -3 }), hollow, mesh(new THREE.TorusGeometry(1.0, 0.18, 6, 14), wood, 0, 2.2, 3.55).rotateY(0));
    S[3].add(await glb('strawberry', { h: 0.8, x: -2, z: 5 }), await glb('strawberry', { h: 0.8, x: 2.2, z: 5.4 }), await glb('mushroom1', { h: 1.4, x: 5, z: 1 }), await glb('mushroom2', { h: 1.8, x: -5, z: 0 }), await glb('acorn', { h: 0.7, x: 0.8, z: 6 }), await glb('stumpMoss', { h: 1.4, x: 6, z: -3 }));
  },
  async robin(S) {
    S[0].add(await glb('branch', { h: 2.8, x: 0, z: 0, yaw: 0.6 }), await glb('twig', { w: 2.2, x: 1.5, z: 1.5, yaw: 0.9 }));
    S[1].add(await glb('birdsNest', { w: 2.6, x: 0, y: 0, z: 3.5 }), await glb('mossPatch', { w: 2.4, x: -2.5, z: 3 }));
    S[2].add(await glb('bushBerries', { h: 3, x: -4, z: -2 }), await glb('egg', { h: 0.45, x: -0.4, y: 0.25, z: 3.4 }), await glb('egg', { h: 0.45, x: 0.4, y: 0.25, z: 3.7 }), await glb('egg', { h: 0.45, x: 0.0, y: 0.25, z: 3.2 }));
    S[3].add(await glb('bushBerries', { h: 4, x: 4.5, z: -3 }), await glb('bushBerries', { h: 3.4, x: -5.5, z: 3 }), await glb('birdHouse', { h: 3.4, x: 5, z: 3, yaw: -0.6 }), await glb('treeB', { h: 8, x: 0, z: -7 }));
  },
  async opossum(S) {
    S[0].add(await glb('twig', { w: 2.4, x: 0, z: 0, yaw: 0.3 }), await glb('twig', { w: 2.2, x: 0.5, y: 0.1, z: 0.8, yaw: 1.9 }), await glb('twig', { w: 2, x: -0.8, y: 0.2, z: -0.5, yaw: 1 }));
    const lean = new THREE.Group(); for (let i = 0; i < 5; i++) lean.add(await glb('treeBranch', { h: 3.2, x: -2 + i * 1.0, y: 0, z: 0, yaw: 0.2 * i, tilt: -0.9 })); lean.position.set(0, 0, 3.5);
    S[1].add(lean);
    S[2].add(await glb('fallenLog', { h: 2.4, x: 0, z: -3, yaw: 0.2 }), await glb('logMoss', { h: 2, x: -5, z: 2, yaw: 1.2 }), await glb('treeBranch', { h: 4, x: 4, z: 3, yaw: 2, tilt: -0.5 }));
    S[3].add(await glb('logHollow', { h: 3.2, x: 0, z: 0, yaw: 3.6 }), await glb('stump', { h: 1.6, x: 5, z: -2 }), await glb('stumpMoss', { h: 1.2, x: -5, z: -3 }), await glb('acorn', { h: 0.7, x: 2, z: 4 }), await glb('acorn', { h: 0.7, x: 2.8, z: 4.5 }), await glb('twig', { w: 2.4, x: -3, z: 5, yaw: 0.5 }));
  },
  async bear(S) {
    S[0].add(await glb('rockLarge', { h: 3, x: -2, z: 1 }), await glb('rockMedium', { h: 2, x: 2.5, z: 1.5 }));
    S[1].add(await glb('caveEntrance', { h: 6, x: 0, z: -3, yaw: 0 }));
    S[2].add(await glb('mossPatch', { w: 3.4, x: 2, z: 4 }), await glb('logMoss', { h: 2, x: -5, z: 3, yaw: 0.8 }), await glb('mushroom1', { h: 1.5, x: 5.5, z: 2 }), await glb('mushroom2', { h: 1.6, x: -3.5, z: 5 }));
    S[3].add(await glb('caveEntrance', { h: 10, x: 0, z: -7, yaw: 0 }), await glb('honeycomb', { w: 1.7, x: -2, z: 4 }), await glb('honeycomb', { w: 1.7, x: 2.4, z: 4.8, yaw: 1 }), await glb('honeycomb2', { w: 1.9, x: 0.2, z: 6.4, yaw: 2 }), await glb('stumpMoss', { h: 2, x: 6, z: -1 }), await glb('rockLarge', { h: 4, x: -7, z: -3 }));
  }
};

export async function buildNests(scene) {
  const nests = {};
  for (const id of Object.keys(SPECIES)) {
    const sp = SPECIES[id], n = sp.nest, root = new THREE.Group(); const y = heightAt(n.x, n.z); root.position.set(n.x, y, n.z);
    const S = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
    try { await BUILDERS[id](S); } catch (e) { console.warn('nest build', id, e); }
    S.forEach(s => { s.visible = false; root.add(s); });
    const ring = new THREE.Mesh(new THREE.RingGeometry(7, 8.2, 40), new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; root.add(ring);
    const beaconMat = new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 70, 12, 1, true), beaconMat); beacon.position.y = 35; root.add(beacon);
    scene.add(root);
    const nest = { id, root, stages: S, stage: -1, units: 0, pop: [], x: n.x, z: n.z, y, ring, beaconMat,
      stageFor: (u) => STAGE_AT.reduce((a, v, i) => u >= v ? i : a, 0),
      set(units, animate) {
        this.units = units; const st = this.stageFor(units); const up = st > this.stage;
        for (let i = 0; i <= st; i++) if (!S[i].visible) { S[i].visible = true; if (animate) { S[i].scale.setScalar(0.01); this.pop.push({ g: S[i], t: 0 }); } else S[i].scale.setScalar(1); }
        const prev = this.stage; this.stage = st; S.lv?.userData.setLv?.(st); return up && prev >= 0 ? st : -1;
      },
      update(dt, t, carrying) {
        for (let i = this.pop.length - 1; i >= 0; i--) { const p = this.pop[i]; p.t += dt / 0.9; const k = Math.min(1, p.t); const e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); p.g.scale.setScalar(Math.max(0.01, e)); if (k >= 1) { p.g.scale.setScalar(1); this.pop.splice(i, 1); } }
        beaconMat.opacity = carrying ? 0.28 + 0.12 * Math.sin(t * 4) : 0.1; this.ring.material.opacity = carrying ? 0.55 + 0.2 * Math.sin(t * 4) : 0.3;
      }
    };
    nests[id] = nest;
  }
  return nests;
}
