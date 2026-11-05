// Build mode: spend gathered resources on little things that make your home meadow bloom and spread.
// Everything here is cosy and peaceful - beacons, gardens, larders, bridges, home upgrades. Nothing is taken from anyone.
import * as THREE from 'three';
import { WORLD_R, POND, WATER_Y, SPECIES_ORDER } from './data.js';
import { SITES, siteDist } from './sites.js';
import { FEATURES } from './features.js';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { patchSeason } from './seasons.js';
import { badge } from './coop.js';

export const RES_KEYS = ['n', 'f', 'w', 'h'];
export const RES_ICON = { n: '🌼', f: '🪱', w: '🪵', h: '🍯' };
export const RES_NAME = { n: 'Nectar', f: 'Forage', w: 'Wood', h: 'Honey' };
/** which resource each animal brings home */
export const RES_OF = { bee: 'n', bumblebee: 'n', butterfly: 'n', hummingbird: 'n', moth: 'n', bat: 'n', raccoon: 'f', robin: 'f', opossum: 'w', bear: 'h' };

export const CATALOG = {
  outpost: { id: 'outpost', icon: '🌻', name: 'Flower Beacon', blurb: 'Blooms the meadow around it, and keeps spreading while tended.', base: { n: 12, f: 6 }, scale: 0.12, pts: 40, max: 18, foot: 2.4, r0: 12, rMax: 44, rate: 0.16, ghostDist: 8, edge: true, reach: 36 },
  marker: { id: 'marker', icon: '🚩', name: 'Trail Marker', blurb: 'A cheap path stone. Blooms a little meadow and links far-off builds back to home.', base: { w: 3, f: 2 }, scale: 0.04, pts: 8, max: 30, foot: 1.2, r0: 5, rMax: 10, rate: 0.05, ghostDist: 7, edge: true, reach: 30 },
  garden: { id: 'garden', icon: '🌷', name: 'Garden Patch', blurb: 'Grows a little of something for you, all on its own.', base: { n: 6, f: 6, w: 4 }, scale: 0.15, pts: 25, max: 6, foot: 3.4, ghostDist: 7 },
  storage: { id: 'storage', icon: '🧺', name: 'Acorn Larder', blurb: 'Carry more, and every gathered thing scores a bit more.', base: { w: 10, h: 5 }, scale: 0.15, pts: 30, max: 5, foot: 2.4, ghostDist: 7 },
  bridge: { id: 'bridge', icon: '🌉', name: 'Plank Bridge', blurb: 'A raised walkway with steps: handy for reaching high ledges. Rotatable.', base: { w: 8, f: 4 }, scale: 0.12, pts: 15, max: 6, foot: 6.2, ghostDist: 9, rot: true },
  home: { id: 'home', icon: '🏡', name: 'Home Upgrade', blurb: 'Make your current animal\u2019s home bigger and prettier.', base: null, pts: 50, max: 3, foot: 0 },
  // tech-unlocked producers (each makes resources on its own; peaceful little workshops)
  apiary: { id: 'apiary', icon: '🏯', name: 'Apiary', tech: 'bee', blurb: 'Stacked hive boxes humming with bees.', base: { n: 16, w: 8 }, scale: 0.2, pts: 35, max: 3, foot: 2.6, ghostDist: 7, prod: [{ k: 'n', every: 8 }, { k: 'h', every: 20 }] },
  honeycave: { id: 'honeycave', icon: '⛰️', name: 'Honey Cave', tech: 'bear', blurb: 'A cool rocky den where wild honey drips from the comb.', base: { h: 14, f: 10 }, scale: 0.2, pts: 35, max: 3, foot: 3.0, ghostDist: 8, prod: [{ k: 'h', every: 10 }] },
  woodpile: { id: 'woodpile', icon: '🪵', name: 'Woodpile', tech: 'opossum', blurb: 'A tidy stack of fallen sticks the opossums keep sorted.', base: { w: 14, f: 8 }, scale: 0.2, pts: 35, max: 3, foot: 2.6, ghostDist: 7, prod: [{ k: 'w', every: 9 }] },
  wormfarm: { id: 'wormfarm', icon: '🪱', name: 'Worm Farm', tech: 'robin', blurb: 'Soft leafy soil where worms wriggle up after rain.', base: { f: 14, w: 8 }, scale: 0.2, pts: 35, max: 3, foot: 2.8, ghostDist: 7, prod: [{ k: 'f', every: 9 }] },
  roost: { id: 'roost', icon: '🦇', name: 'Bat Roost', tech: 'bat', blurb: 'A cosy hanging roost where night bats rest and scatter seeds.', base: { n: 14, f: 8 }, scale: 0.2, pts: 35, max: 3, foot: 2.6, ghostDist: 7, prod: [{ k: 'n', every: 8 }, { k: 'f', every: 22 }] },
  stashden: { id: 'stashden', icon: '🦝', name: 'Stash Den', tech: 'raccoon', blurb: 'A raccoon hidey-hole stuffed with tidy little snack stashes.', base: { f: 14, w: 8 }, scale: 0.2, pts: 35, max: 3, foot: 2.8, ghostDist: 7, prod: [{ k: 'f', every: 9 }, { k: 'n', every: 24 }] }
};
export const BUILD_ORDER = ['outpost', 'marker', 'garden', 'storage', 'bridge', 'home', 'apiary', 'honeycave', 'woodpile', 'wormfarm', 'roost', 'stashden'];
const per = e => (60 / e).toFixed(e > 12 ? 1 : 0);
/** functional description with real numbers (shown in the build tray info card + RTS building card) */
export function buildInfo(t, o = {}) {
  const C = CATALOG[t], L = [];
  if (t === 'outpost') L.push(`Blooms a ${C.r0} m circle of meadow that keeps spreading ${(C.rate * (o.terr || 1)).toFixed(2)} m/s up to ${C.rMax} m.`, `Tend it 💧 (every 40 s, walk close): +12 pts and 2.4× growth for 25 s.`, `Max ${C.max}.`);
  else if (t === 'marker') L.push(`Blooms ${C.r0} m, slowly to ${C.rMax} m.`, `A cheap way to stake out land far from home: you can build anywhere, and markers link the gap. Max ${C.max}.`);
  else if (t === 'garden') L.push(`Grows 1 resource every ${(15 / (o.garden || 1)).toFixed(1)} s on its own (≈${(4 * (o.garden || 1)).toFixed(1)}/min).`, `Kinds rotate 🌼 → 🪱 → 🪵 → 🍯 with each garden. Max ${C.max}.`);
  else if (t === 'storage') L.push(`Every animal carries +1, and each delivery scores +12% (stacks: max ${C.max} = +60%).`);
  else if (t === 'bridge') L.push(`An 8 m walkway, 2 m high, with steps at both ends: cross water and reach ledges. Rotate with ↻. Max ${C.max}.`);
  else if (t === 'home') L.push(`Bigger home for your current animal: home meadow radius +6 m per level.`, `+50 / 100 / 150 pts for levels 1-3.`);
  if (C.prod) L.push('Makes ' + C.prod.map(p => `1 ${RES_ICON[p.k]} every ${p.every} s (${per(p.every)}/min)`).join(' and ') + ` on its own. Max ${C.max}.`);
  if (C.pts && t !== 'home') L.push(`+${C.pts} pts when built.`);
  return L;
}
export const HOME_COST = [10, 18, 28];

export async function createBuild(scene, ctx) {
  const { territory: T, heightAt, phys, nests, SPECIES, round, fx, toast } = ctx;
  const placed = []; // {id,type,x,z,yaw,t0,kind?,tendAt?,obj,solids}
  const homeLv = {}; for (const s of SPECIES_ORDER) homeLv[s] = 0;
  const homeObj = {};
  const B = { active: false, sel: 'outpost', rot: 0, placed, homeLv, valid: false, why: '', ghostPos: new THREE.Vector3(), gardenMul: 1 };
  let uid = 1;

  // ---------- shared materials & model helpers
  const L = (c, e = 0x000000, o = {}) => patchSeason(new THREE.MeshLambertMaterial({ color: c, emissive: e, ...o }), 'prop');
  const M = { wood: L(0xa0703c), wood2: L(0x7a5230), soil: L(0x4a3322), plank: L(0xc79a5e), gold: new THREE.MeshBasicMaterial({ color: 0xffd966, toneMapped: false }), pink: L(0xff9ac2, 0x40142a), stone: L(0x8d8a84), cream: L(0xf6e7c0, 0x3a2f10), moss: L(0x5f8f3a) };
  const ghostMat = { ok: new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.5, depthWrite: false }), bad: new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.5, depthWrite: false }) };
  const cache = new Map();
  async function pre(key, o) { const ck = key + JSON.stringify(o); if (cache.has(ck)) return cache.get(ck); const g = await loadGLB(key); const r = g ? bakeParts(g, o).parts.map(p => ({ geometry: p.geometry, material: patchSeason(lambertFrom(p.material), 'prop') })) : null; cache.set(ck, r); return r; }
  const pc = {};
  for (const [k, o] of Object.entries({ sunflowerG: { size: 5.2, mode: 'height' }, rockMedium: { size: 1.1, mode: 'height' }, daisyG: { size: 1.3, mode: 'height' }, tulip: { size: 1.4, mode: 'height' }, poppies: { size: 1.2, mode: 'height' }, flowerSingle: { size: 1.4, mode: 'height' }, acorn: { size: 0.9, mode: 'height' }, honeycomb: { size: 1.1, mode: 'max' }, stumpMoss: { size: 1.3, mode: 'height' }, mossPatch: { size: 2.4, mode: 'max' }, sunflowerJ: { size: 3.0, mode: 'height' }, bell: { size: 1.5, mode: 'height' } })) pc[k] = await pre(k, o);
  const put = (g, key, x, y, z, yaw = 0, s = 1) => { const ps = pc[key]; if (!ps) return null; const o = new THREE.Group(); for (const p of ps) o.add(new THREE.Mesh(p.geometry, p.material)); o.position.set(x, y, z); o.rotation.y = yaw; o.scale.setScalar(s); g.add(o); return o; };
  const bx = (g, mat, w, h, d, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(0.35, 'rgba(255,214,110,.45)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glow = (size, col = 0xffffff) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.scale.set(size, size, 1); s.renderOrder = 6; return s; };
  const ORB = new THREE.SphereGeometry(0.42, 14, 10), TORUS = new THREE.TorusGeometry(1.5, 0.08, 6, 28);

  // ---------- models (origin on the ground)
  function modelOutpost() {
    const g = new THREE.Group(); put(g, 'rockMedium', 0, -0.05, 0, 0.6, 1.4); put(g, 'sunflowerG', 0, 0.6, 0, 0.3, 1);
    for (let i = 0; i < 5; i++) { const a = i * 1.2566 + 0.3; put(g, ['daisyG', 'tulip', 'poppies', 'flowerSingle', 'bell'][i], Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7, a, 1); }
    const orb = new THREE.Mesh(ORB, M.gold); orb.position.y = 6.4; g.add(orb); const h = glow(5, 0xffe08a); h.position.y = 6.4; g.add(h);
    const ring = new THREE.Mesh(TORUS, M.gold.clone()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; ring.scale.setScalar(1.15); g.add(ring);
    const tend = badge('💧', 2.6); tend.position.y = 8.6; tend.visible = false; g.add(tend);
    g.userData.anim = (t, o) => { orb.position.y = 6.4 + Math.sin(t * 1.8 + o) * 0.22; h.position.y = orb.position.y; h.material.opacity = 0.75 + 0.25 * Math.sin(t * 2.2 + o); ring.scale.setScalar(1.15 + 0.12 * Math.sin(t * 1.4 + o)); tend.position.y = 8.6 + Math.sin(t * 3 + o) * 0.3; };
    g.userData.tend = tend; return g;
  }
  function modelGarden(kind) {
    const g = new THREE.Group(); bx(g, M.soil, 6.2, 0.35, 6.2, 0, 0.1, 0);
    for (const s of [-1, 1]) { bx(g, M.wood, 6.6, 0.55, 0.4, 0, 0.3, s * 3.2); bx(g, M.wood, 0.4, 0.55, 6.6, s * 3.2, 0.3, 0); }
    const fl = ['daisyG', 'tulip', 'poppies', 'flowerSingle', 'bell', 'daisyG', 'tulip', 'poppies', 'flowerSingle'];
    for (let i = 0; i < 9; i++) put(g, fl[i], ((i % 3) - 1) * 1.8, 0.2, (Math.floor(i / 3) - 1) * 1.8, i * 2.1, 0.9 + (i % 3) * 0.15);
    const b = badge(RES_ICON[kind], 2.4); b.position.y = 3.4; g.add(b); g.userData.anim = (t, o) => { b.position.y = 3.4 + Math.sin(t * 2 + o) * 0.18; }; return g;
  }
  function modelStorage() {
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 1.7, 14), M.wood); body.position.y = 0.85; g.add(body);
    for (const y of [0.45, 1.3]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(1.16 - (y < 1 ? 0 : 0.12), 1.16 - (y < 1 ? 0 : 0.12), 0.12, 14), M.wood2); r.position.y = y; g.add(r); }
    const lid = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 14), M.plank); lid.position.y = 2.1; g.add(lid);
    put(g, 'acorn', 1.7, 0, 0.6, 0.4, 1); put(g, 'acorn', 1.5, 0, -0.5, 2.2, 0.8); put(g, 'honeycomb', -1.7, 0, 0.5, 0.9, 1);
    const gl = glow(3.2, 0xffd27a); gl.position.set(0, 1.4, 0); g.add(gl); return g;
  }
  const BR = { len: 4.0, hz: 1.5, top: 2.0 };
  function modelBridge() {
    const g = new THREE.Group(); bx(g, M.plank, BR.len * 2, 0.35, BR.hz * 2, 0, BR.top - 0.18, 0);
    for (let i = -3; i <= 3; i++) bx(g, M.wood2, 0.12, 0.38, BR.hz * 2 + 0.06, i * 1.1, BR.top - 0.17, 0);
    for (const s of [-1, 1]) { bx(g, M.wood, BR.len * 2, 0.16, 0.16, 0, BR.top + 0.75, s * BR.hz); for (const a of [-3.8, -1.9, 0, 1.9, 3.8]) bx(g, M.wood2, 0.2, BR.top + 0.8, 0.2, a, (BR.top + 0.8) / 2 - 0.05, s * BR.hz); }
    for (let k = 0; k < 4; k++) for (const e of [-1, 1]) bx(g, M.plank, 0.62, 0.5 * (k + 1), BR.hz * 2, e * (BR.len + 0.3 + 0.6 * (3 - k)), 0.25 * (k + 1), 0);
    const lamp = new THREE.Mesh(ORB, M.gold); lamp.scale.setScalar(0.6); lamp.position.set(BR.len - 0.2, BR.top + 1.4, BR.hz); g.add(lamp.clone()); lamp.position.x = -BR.len + 0.2; g.add(lamp); return g;
  }
  function modelHome(id, lv) {
    const g = new THREE.Group(); const R = 10.5;
    if (lv >= 1) for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; put(g, ['daisyG', 'tulip', 'poppies'][i % 3], Math.cos(a) * R, 0, Math.sin(a) * R, a, 1.1); }
    if (lv >= 2) for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.78, x = Math.cos(a) * (R + 1.6), z = Math.sin(a) * (R + 1.6); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.8, 6), M.wood2); p.position.set(x, 1.4, z); g.add(p); const o = new THREE.Mesh(ORB, M.gold); o.position.set(x, 3.0, z); g.add(o); const gl = glow(3, 0xffd27a); gl.position.set(x, 3.0, z); g.add(gl); }
    if (lv >= 3) { const t = new THREE.Mesh(new THREE.TorusGeometry(R + 0.4, 0.12, 6, 64), M.gold); t.rotation.x = Math.PI / 2; t.position.y = 0.25; g.add(t); for (let i = 0; i < 4; i++) { const a = i * 1.5708; put(g, 'sunflowerJ', Math.cos(a) * (R - 1.5), 0, Math.sin(a) * (R - 1.5), a, 1.0); } }
    const n = nests[id]; g.position.set(n.x, n.y ?? heightAt(n.x, n.z), n.z); return g;
  }
  function modelMarker() {
    const g = new THREE.Group(); put(g, 'rockMedium', 0, -0.05, 0, 0.3, 0.8); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), M.wood2); pole.position.y = 1.3; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshLambertMaterial({ color: 0xff9ac2, emissive: 0x401020, side: THREE.DoubleSide })); flag.position.set(0.5, 2.25, 0); g.add(flag);
    put(g, 'daisyG', 0.8, 0, 0.5, 0.4, 0.8); put(g, 'tulip', -0.7, 0, -0.4, 1.4, 0.8);
    g.userData.anim = (t, o) => { flag.rotation.y = Math.sin(t * 2.4 + o) * 0.35; }; return g;
  }
  // blocky species building GLBs with lv1/lv2/lv3 top-level nodes; baked once per type at one common scale (lv3 ~4.6 m)
  const SPEC = {
    apiary: () => loadGLB('x/buildings/species/bee-apiary-lv-blocky'), honeycave: () => loadGLB('x/buildings/species/bear-honey-cave-blocky'),
    woodpile: () => loadGLB('x/buildings/species/opossum-woodpile-hollow-blocky'), wormfarm: () => loadGLB('x/buildings/species/robin-nest-grove-blocky'),
    roost: () => loadGLB('x/buildings/species/bat-roost-blocky'), stashden: () => loadGLB('x/buildings/species/raccoon-stash-den-blocky'),
  };
  const specCache = {};
  function specLevels(t) {
    if (!SPEC[t]) return Promise.resolve(null);
    return specCache[t] || (specCache[t] = SPEC[t]().then(gl => {
      if (!gl) return null; const sc = gl.scene; sc.updateMatrixWorld(true);
      const lv = [1, 2, 3].map(i => sc.getObjectByName('lv' + i)); if (!lv[2]) return null;
      const h3 = new THREE.Box3().setFromObject(lv[2]).getSize(new THREE.Vector3()).y || 1, k = 4.6 / h3;
      return lv.map(n => { if (!n) return null; const h = new THREE.Box3().setFromObject(n).getSize(new THREE.Vector3()).y || h3;
        return bakeParts({ scene: n }, { size: h * k, mode: 'height' }).parts.map(p => ({ geometry: p.geometry, material: patchSeason(lambertFrom(p.material), 'prop') })); });
    }).catch(e => { console.warn('species building', t, e); return null; }));
  }
  function modelProd(t) {
    const g = new THREE.Group(), C = CATALOG[t];
    if (SPEC[t]) {
      // procedural stand-in until the GLB is ready; then swap in the lv-toggling model
      const tmp = new THREE.Group(); g.add(tmp); let want = 1, lvG = null;
      bx(tmp, t === 'roost' ? M.wood2 : M.wood, 2.2, 2.2, 2.2, 0, 1.1, 0);
      g.userData.setLv = l => { want = Math.max(1, Math.min(3, l || 1)); if (lvG) lvG.forEach((o, i) => { if (o) o.visible = i === (lvG[want - 1] ? want - 1 : lvG.findLastIndex((x, j) => x && j < want)); }); };
      specLevels(t).then(L => { if (!L) return; lvG = L.map(ps => { if (!ps) return null; const o = new THREE.Group(); for (const p of ps) o.add(new THREE.Mesh(p.geometry, g.userData.ghost || p.material)); g.add(o); return o; }); g.remove(tmp); g.userData.setLv(want); });
    }
    else if (t === 'apiary') { for (let i = 0; i < 3; i++) { const b = bx(g, i % 2 ? M.cream : M.plank, 1.8, 0.8, 1.8, 0, 0.45 + i * 0.85, 0, i * 0.12); } bx(g, M.wood2, 2.2, 0.2, 2.2, 0, 2.95, 0); put(g, 'honeycomb', 1.6, 0, 0.4, 0.5, 1); }
    else if (t === 'honeycave') { put(g, 'rockMedium', 0, -0.1, 0, 0, 3.0); put(g, 'rockMedium', 1.8, -0.1, 0.8, 1.2, 1.8); put(g, 'honeycomb', -1.2, 0.2, 1.6, 0.4, 1.2); const gl = glow(3, 0xffc040); gl.position.set(-1.2, 1, 1.6); g.add(gl); }
    else if (t === 'woodpile') { for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3, 8), i % 2 ? M.wood : M.wood2); r.rotation.z = Math.PI / 2; const row = i < 4 ? 0 : i < 6 ? 1 : 2, k = i < 4 ? i : i < 6 ? i - 4 : 0; r.position.set(0, 0.3 + row * 0.5, (k - (row === 0 ? 1.5 : row === 1 ? 0.5 : 0)) * 0.58); g.add(r); } put(g, 'stumpMoss', 1.8, 0, 0.6, 0.3, 1); }
    else { bx(g, M.soil, 4.2, 0.4, 4.2, 0, 0.15, 0); for (const s of [-1, 1]) { bx(g, M.wood, 4.5, 0.5, 0.3, 0, 0.3, s * 2.2); bx(g, M.wood, 0.3, 0.5, 4.5, s * 2.2, 0.3, 0); } put(g, 'mossPatch', 0, 0.35, 0, 0, 1.2); }
    const by = SPEC[t] ? 5.6 : 4.2, b = badge(C.icon, 2.4); b.position.y = by; g.add(b); g.userData.anim = (tt, o) => { b.position.y = by + Math.sin(tt * 2 + o) * 0.18; }; return g;
  }
  function modelOf(t, kind) { if (CATALOG[t].prod) return modelProd(t); return t === 'marker' ? modelMarker() : t === 'outpost' ? modelOutpost() : t === 'garden' ? modelGarden(kind || 'n') : t === 'storage' ? modelStorage() : modelBridge(); }

  // ---------- costs
  const count = t => placed.filter(p => p.type === t).length;
  B.count = count;
  B.cost = (t, id) => {
    const C = CATALOG[t];
    if (t === 'home') { const lv = homeLv[id]; return lv >= C.max ? null : ctx.price(Math.round(HOME_COST[lv] * 1.3)); }
    const m = 1 + C.scale * count(t); let tot = 0; for (const k in C.base) tot += C.base[k]; return ctx.price(Math.ceil(tot * m));
  };
  B.free = false;
  B.can = (t, id) => { const c = B.cost(t, id); if (!c) return false; if (B.free) return true; return round.canPay(c); };
  B.unlocked = t => !CATALOG[t].tech || ctx.techBuilds().includes(t);
  B.atMax = (t, id) => t === 'home' ? homeLv[id] >= CATALOG.home.max : count(t) >= CATALOG[t].max;
  B.storageCount = () => count('storage');
  B.homeR = id => 13 + 2.5 * (nests[id]?.stage ?? 0) + 6 * homeLv[id];
  B.refreshHomes = () => { for (const id of SPECIES_ORDER) { const n = nests[id]; if (!n) continue; const r = B.homeR(id); const s = T.get('home:' + id); if (!s) T.setSource('home:' + id, 'home', n.x, n.z, r, r); else if (Math.abs(s.r - r) > 0.01) T.setR('home:' + id, r); } };

  // ---------- ghost
  const ghost = new THREE.Group(), ringOk = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), ringBad = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const gRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), ringOk), gClaim = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  for (const r of [gRing, gClaim]) { r.rotation.x = -Math.PI / 2; r.renderOrder = 7; r.position.y = 0.2; }
  const gModel = new THREE.Group(); ghost.add(gModel, gRing, gClaim); ghost.visible = false; scene.add(ghost);
  let gType = null;
  function setGhostType(t) {
    if (gType === t) return; gType = t; gModel.clear(); if (t === 'home') return;
    const m = modelOf(t, 'n'); m.userData.ghost = ghostMat.ok; m.traverse(o => { if (o.isMesh) o.material = ghostMat.ok; else if (o.isSprite) o.visible = false; }); gModel.add(m);
    const C = CATALOG[t]; gRing.scale.setScalar(t === 'bridge' ? 6.4 : C.foot + 0.8); gClaim.visible = t === 'outpost' || t === 'marker'; gClaim.scale.setScalar(C.r0 || 1);
  }
  function check(t, x, z, yaw) {
    const C = CATALOG[t];
    if (count(t) >= C.max) return 'Max built';
    if (!B.can(t)) return 'Need more resources';
    if (Math.hypot(x, z) > WORLD_R - 8) return 'Too close to the edge';
    const pts = t === 'bridge' ? [[0, 0], [3.5, 0], [-3.5, 0], [6.5, 0], [-6.5, 0]] : [[0, 0], [C.foot * 0.6, 0], [-C.foot * 0.6, 0], [0, C.foot * 0.6], [0, -C.foot * 0.6]];
    const c = Math.cos(yaw), s = Math.sin(yaw), g0 = heightAt(x, z);
    for (const [a, b] of pts) {
      const px = x + a * c + b * s, pz = z - a * s + b * c, h = heightAt(px, pz);
      if (h < WATER_Y + 0.5) return 'Too close to water';
      if (Math.abs(h - g0) > (t === 'bridge' ? 0.9 : 1.3)) return 'Ground is too steep';
      if (phys.blocked(px, pz, 0.8)) return 'Something is in the way';
      if (FEATURES.teamFoods) for (const S of SITES) if (siteDist(S, px, pz) < S.hw + 1.2) return 'Keep the puzzle paths clear';
    }
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + C.foot + 2) return 'Too close to the pond';
    for (const id of SPECIES_ORDER) { const n = nests[id]; if (n && Math.hypot(n.x - x, n.z - z) < 8 + C.foot * 0.6) return 'Too close to a home'; }
    for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < C.foot + CATALOG[p.type].foot * 0.9 + 0.5) return 'Too close to another build';
    // t27u: build anywhere - only physical validity matters. Far-off builds start their own little meadow patch.
    return '';
  }
  B.check = check;
  /** outposts & markers may go well past the meadow edge: within reach of any home, beacon or trail marker (chainable) */
  B.reachOf = p => CATALOG[p.type].reach || 0;
  B.inReach = (x, z) => {
    for (const id of SPECIES_ORDER) { const n = nests[id]; if (n && Math.hypot(n.x - x, n.z - z) < B.homeR(id) + 30) return true; }
    for (const p of placed) { const r = B.reachOf(p); if (r && Math.hypot(p.x - x, p.z - z) < r) return true; }
    return false;
  };

  // ---------- placing
  function addBuilt(rec, silent) {
    const C = CATALOG[rec.type], obj = modelOf(rec.type, rec.kind); obj.position.set(rec.x, heightAt(rec.x, rec.z), rec.z); obj.rotation.y = rec.yaw; scene.add(obj); rec.obj = obj; rec.solids = []; obj.userData.setLv?.(rec.lv || 1);
    if (rec.type === 'bridge') {
      const g0 = obj.position.y, c = Math.cos(rec.yaw), s = Math.sin(rec.yaw), W = (a, b) => [rec.x + a * c + b * s, rec.z - a * s + b * c];
      let [wx, wz] = W(0, 0); rec.solids.push({ type: 'box', x: wx, z: wz, hx: BR.len, hz: BR.hz, yaw: rec.yaw, y0: g0 - 1.5, top: g0 + BR.top - 0.02, kind: 'build' });
      for (let k = 0; k < 4; k++) for (const e of [-1, 1]) { const a = e * (BR.len + 0.3 + 0.6 * (3 - k)); [wx, wz] = W(a, 0); rec.solids.push({ type: 'box', x: wx, z: wz, hx: 0.31, hz: BR.hz, yaw: rec.yaw, y0: g0 - 1.5, top: g0 + 0.5 * (k + 1), kind: 'build' }); }
      for (const so of rec.solids) phys.add(so);
    }
    if (rec.type === 'outpost' || rec.type === 'marker') { T.setSource(rec.id, rec.type, rec.x, rec.z, rec.r ?? C.r0, C.rMax + (rec.type === 'outpost' ? 10 * ((rec.lv || 1) - 1) : 0), C.rate); }
    else if (rec.type !== 'bridge' && (rec.solo || (rec.solo = T.depth(rec.x, rec.z) < 0))) T.setSource(rec.id, 'solo', rec.x, rec.z, 5, 11, 0.03);
    if (!silent) { fx.burst(rec.x, obj.position.y + 1.5, rec.z, 26, 4); obj.scale.setScalar(0.01); rec.pop = 0; }
  }
  B.place = (x, z, yaw, free = false) => {
    const t = B.sel; if (t === 'home') return B.upgradeHome(ctx.cur()); if (!B.unlocked(t) && !free) { toast('🧬 Research ' + CATALOG[t].name + ' in the tech tree first'); return false; }
    const why = check(t, x, z, yaw); if (why && !free) { B.why = why; toast('✖ ' + why); return false; }
    const cost = B.cost(t); if (!B.free && !free) round.pay(cost);
    const rec = { id: t + (uid++), type: t, x, z, yaw, t0: round.elapsed, tendAt: round.elapsed };
    if (t === 'garden') rec.kind = RES_KEYS[count('garden') % 4], rec.acc = 0;
    rec.paid = cost ? { ...cost } : null; placed.push(rec); addBuilt(rec); round.add('building', CATALOG[t].pts); ctx.audio.sample ? ctx.audio.sample('build/place-thunk', 0.5) : ctx.audio.chime?.(); round.noteBuild(t);
    toast(`${CATALOG[t].icon} ${CATALOG[t].name} built! +${CATALOG[t].pts}${t === 'garden' ? ' · grows ' + RES_ICON[rec.kind] + ' ' + RES_NAME[rec.kind] : ''}`);
    return rec;
  };
  B.upgradeHome = id => {
    const lv = homeLv[id], C = CATALOG.home; if (lv >= C.max) { toast('🏡 Home is fully upgraded'); return false; }
    const cost = B.cost('home', id); if (!B.free && !round.canPay(cost)) { toast('Need more ' + Object.keys(cost).map(k => RES_ICON[k]).join(' ')); return false; }
    if (!B.free) round.pay(cost); homeLv[id] = lv + 1; B.rebuildHome(id); B.refreshHomes(); round.add('building', C.pts * (lv + 1));
    const n = nests[id]; fx.burst(n.x, (n.y ?? 0) + 3, n.z, 30, 5); ctx.audio.sample ? ctx.audio.sample('build/building-complete-chime', 0.5) : ctx.audio.chime?.(); round.noteBuild('home'); toast(`🏡 ${SPECIES[id].name} home level ${lv + 1}! +${C.pts * (lv + 1)}`); return true;
  };
  B.rebuildHome = id => { if (homeObj[id]) { scene.remove(homeObj[id]); homeObj[id] = null; } if (homeLv[id] > 0) { homeObj[id] = modelHome(id, homeLv[id]); scene.add(homeObj[id]); } };

  // ---------- mode + per-frame
  B.setSel = t => { B.sel = t; if (B.active) { setGhostType(t); B.rot = 0; } };
  B.enter = () => { B.active = true; setGhostType(B.sel === 'home' ? 'home' : B.sel); ghost.visible = B.sel !== 'home'; };
  B.exit = () => { B.active = false; ghost.visible = false; };
  B.rotate = () => { if (CATALOG[B.sel].rot) B.rot += Math.PI / 4; };
  B.aim = null; B.hiring = false;
  B.ghostAt = (p, camYaw) => { if (B.aim) return [B.aim.x, B.aim.z]; const C = CATALOG[B.sel]; const d = C.ghostDist || 7; return [p.x - Math.sin(camYaw) * d, p.z - Math.cos(camYaw) * d]; };
  /** called each frame in build mode. p = animal position, camYaw = camera yaw. */
  B.updateGhost = (p, camYaw, t) => {
    if (!B.active) return; if (B.hiring) { ghost.visible = false; B.valid = false; B.why = ''; return; } const home = B.sel === 'home'; ghost.visible = !home; if (home) { B.valid = B.can('home', ctx.cur()); B.why = B.atMax('home', ctx.cur()) ? 'Max level' : B.valid ? '' : 'Need more resources'; return; }
    setGhostType(B.sel); let [x, z] = B.ghostAt(p, camYaw); const wr = Math.hypot(x, z), lim = WORLD_R - 6; if (wr > lim) { x *= lim / wr; z *= lim / wr; }
    const yaw = B.rot + (CATALOG[B.sel].rot ? camYaw : 0);
    const why = check(B.sel, x, z, yaw); B.valid = !why; B.why = why; B.gx = x; B.gz = z; B.gyaw = yaw;
    ghost.position.set(x, heightAt(x, z), z); gModel.rotation.y = yaw; const m = B.valid ? ghostMat.ok : ghostMat.bad;
    gModel.traverse(o => { if (o.isMesh && o.material !== m) o.material = m; }); gRing.material = B.valid ? ringOk : ringBad; gRing.rotation.z = t * 0.5;
  };
  B.placeGhost = () => B.hiring ? false : B.sel === 'home' ? B.upgradeHome(ctx.cur()) : B.place(B.gx, B.gz, B.gyaw);

  const tmp = new THREE.Vector3();
  /** every frame: animate, upkeep (tending outposts), garden produce */
  // ---------- per-building upgrades (RTS building card): gardens/producers make more, beacons bloom wider
  const lvMul = p => 1 + 0.5 * ((p.lv || 1) - 1);
  B.canUpgrade = p => !!p && ['garden', 'outpost'].concat(Object.keys(CATALOG).filter(k => CATALOG[k].prod)).includes(p.type) && (p.lv || 1) < 3;
  B.upgradeCost = p => { if (!B.canUpgrade(p)) return null; const C = CATALOG[p.type]; return ctx.price(Math.round(Object.values(C.base).reduce((a, b) => a + b, 0) * 0.9 * (p.lv || 1))); };
  B.upgradeText = p => { const lv = p.lv || 1; if (p.type === 'outpost') return `Lv ${lv + 1}: blooms up to ${CATALOG.outpost.rMax + 10 * lv} m (now ${CATALOG.outpost.rMax + 10 * (lv - 1)} m)`; return `Lv ${lv + 1}: makes ${(1 + 0.5 * lv).toFixed(1)}× (now ${lvMul(p).toFixed(1)}×)`; };
  B.upgrade = p => {
    const c = B.upgradeCost(p); if (!c) return false;
    if (!B.free && !round.canPay(c)) { toast('Need ' + Object.keys(c).map(k => RES_ICON[k] + c[k]).join(' ')); return false; }
    if (!B.free) round.pay(c); p.lv = (p.lv || 1) + 1; round.add('building', 15 * p.lv); p.obj?.userData.setLv?.(p.lv);
    if (p.type === 'outpost') { const s = T.get(p.id); if (s) s.rMax = CATALOG.outpost.rMax + 10 * (p.lv - 1); }
    fx.burst(p.x, heightAt(p.x, p.z) + 2.5, p.z, 26, 4); ctx.audio?.sample ? ctx.audio.sample('build/upgrade-sparkle', 0.5) : ctx.audio?.blip?.(7); toast(`⬆ ${CATALOG[p.type].name} Lv ${p.lv}! +${15 * p.lv}`); return true;
  };
  B.nearest = (x, z, r = 4) => { let best = null, bd = r; for (const p of placed) { const d = Math.hypot(p.x - x, p.z - z) - (CATALOG[p.type].foot || 2) * 0.5; if (d < bd) { bd = d; best = p; } } return best; };
  B.update = (dt, t, curPos, simT) => {
    for (const p of placed) {
      const o = p.obj; if (o.userData.anim) o.userData.anim(t, p.t0);
      if (p.pop !== undefined && p.pop < 1) { p.pop = Math.min(1, p.pop + dt * 3); const k = p.pop, e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); o.scale.setScalar(Math.max(0.01, e)); if (k >= 1) o.scale.setScalar(1); }
      if (p.type === 'outpost') {
        const s = T.get(p.id); if (!s) continue; const need = round.elapsed - p.tendAt > 40; o.userData.tend.visible = need && s.r < s.rMax;
        if (s.tend > 0) s.tend -= dt;
        if (curPos && need && s.r < s.rMax + 0.1 && Math.hypot(curPos.x - p.x, curPos.z - p.z) < 6.5 && !round.over) {
          p.tendAt = round.elapsed; s.tend = 25; T.grow(p.id, 2); round.add('upkeep', 12); fx.burst(p.x, o.position.y + 3, p.z, 20, 4); ctx.audio.blip?.(); toast('💧 Tended the beacon: it\u2019s blooming wider! +12');
        }
      } else if (p.type === 'garden') {
        p.acc += dt * B.gardenMul * (ctx.gardenMul ? ctx.gardenMul() : 1) * lvMul(p); if (p.acc >= 15) { p.acc -= 15; round.addRes(p.kind, 1); fx.burst(p.x, o.position.y + 2, p.z, 8, 2); round.flash(p.kind); }
      } else if (CATALOG[p.type].prod && !round.over) {
        p.pa = p.pa || []; CATALOG[p.type].prod.forEach((q, i) => { p.pa[i] = (p.pa[i] || 0) + dt * B.gardenMul * lvMul(p); if (p.pa[i] >= q.every) { p.pa[i] -= q.every; round.addRes(q.k, 1); fx.burst(p.x, o.position.y + 3, p.z, 8, 2); round.flash(q.k); } });
      }
    }
  };
  B.tendPending = () => placed.filter(p => p.type === 'outpost' && round.elapsed - p.tendAt > 40).length;

  // ---------- state
  B.serialize = () => ({ homeLv: { ...homeLv }, placed: placed.map(p => ({ id: p.id, type: p.type, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: p.yaw, t0: p.t0, kind: p.kind, tendAt: p.tendAt, acc: p.acc, pa: p.pa, lv: p.lv, solo: p.solo || undefined, r: (p.type === 'outpost' || p.type === 'marker') ? +(T.get(p.id)?.r ?? 0).toFixed(2) : undefined })), uid });
  B.removeOne = (rec) => {
    const i = placed.indexOf(rec); if (i < 0) return false;
    scene.remove(rec.obj); for (const so of rec.solids || []) so.off = true;
    if (rec.type === 'outpost' || rec.type === 'marker' || rec.solo) T.remove(rec.id);
    placed.splice(i, 1); return true;
  };
  B.clear = () => { for (const p of placed) { scene.remove(p.obj); for (const so of p.solids || []) so.off = true; if (p.type === 'outpost' || p.type === 'marker' || p.solo) T.remove(p.id); } placed.length = 0; for (const id of SPECIES_ORDER) { homeLv[id] = 0; B.rebuildHome(id); } B.refreshHomes(); };
  B.restore = s => { B.clear(); if (!s) return; uid = s.uid || 1; for (const id in s.homeLv || {}) { homeLv[id] = s.homeLv[id]; B.rebuildHome(id); } for (const r of s.placed || []) { const rec = { ...r }; placed.push(rec); addBuilt(rec, true); } B.refreshHomes(); };
  /** admin: drop a free build right at a spot */
  B.free_place = (t, x, z, yaw = 0) => { const prev = B.sel; B.sel = t; const r = B.place(x, z, yaw, true); B.sel = prev; return r; };
  B.refreshHomes();
  return B;
}
