// Build mode: spend gathered resources on little things that make your home meadow bloom and spread.
// Everything here is cosy and peaceful - beacons, gardens, larders, bridges, home upgrades. Nothing is taken from anyone.
import * as THREE from 'three';
import { WORLD_R, POND, WATER_Y, SPECIES_ORDER } from './data.js';
import { SITES, siteDist } from './sites.js';
import { FEATURES } from './features.js';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { patchSeason } from './seasons.js';
import { badge } from './coop.js';

export const RES_KEYS = ['p', 'd', 's'];
export const RES_ICON = { p: '🌼', d: '💧', s: '🌟' };
export const RES_NAME = { p: 'Petals', d: 'Dewdrops', s: 'Starseeds' };
/** tier look: glow colour + shape (shape for colour-blind players) */
export const TIER_LOOK = { p: { col: '#FFD54A', shape: '●', fx: 'steady' }, d: { col: '#4FE3E0', shape: '💧', fx: 'pulse' }, s: { col: '#C77DFF', shape: '★', fx: 'sparkle' } };
/** gathering is species-free: everyone brings home Petals (T1) */
export const RES_OF = new Proxy({}, { get: () => 'p' });
export const TIER_COST = { 1: { p: 10 }, 2: { p: 12, d: 6 }, 3: { p: 15, d: 8, s: 1 } };
export const UP_COST = { 2: { p: 10, d: 4 }, 3: { p: 14, d: 6, s: 1 } };
// 10 species x 3 type-locked buildings. m = model reused (old generic models / species GLBs / 'plot' stand-in).
const S = (sp, tier, id, icon, name, m, blurb, o = {}) => ({ id, sp, tier, icon, name, m, blurb, pts: 20 + 15 * tier, max: o.max || 2, foot: o.foot || 2.6, ghostDist: o.gd || 7, rot: !!o.rot, r: o.r || 7, ...o });
const LIST = [
  S('bee', 1, 'waggle_stage', '🌻', 'Waggle Stage', 'outpost', 'Dance here: every bee helper rushes to gather at this spot.'),
  S('bee', 2, 'apiary', '🏯', 'Apiary', 'apiary', 'Helpers following you pick flowers you pass: +1 petal per follower per pick.'),
  S('bee', 3, 'queens_hall', '👑', "Queen's Hall", 'apiary', 'Unlocks Swarm Call on the Command wheel: every helper gathers where you stand, faster.'),
  S('bumblebee', 1, 'clover_pad', '🍀', 'Clover Pad', 'plot', 'Land here to drop off what you carry and refill your wings.', { r: 6 }),
  S('bumblebee', 2, 'garden_patch', '🌷', 'Seed Garden', 'garden', 'While you fly as Bumblebee, seeds fall behind you and pay petals.', { foot: 3.4 }),
  S('bumblebee', 3, 'lift_hive', '🛗', 'Lift Hive', 'apiary', 'Bumblebee can fly a Starseed home: water no longer knocks it loose.'),
  S('butterfly', 1, 'wind_streamer', '🎏', 'Wind Streamer', 'marker', 'Glide between two streamers on a free, fast breeze.', { max: 4, foot: 1.2, r: 0 }),
  S('butterfly', 2, 'chrysalis', '🫘', 'Chrysalis', 'plot', 'Interact at one to hop to your other Chrysalis.', { max: 2 }),
  S('butterfly', 3, 'rainbow_arch', '🌈', 'Rainbow Arch', 'plot', 'Act under it: for 25 s, meadow blooms wherever you fly.'),
  S('hummingbird', 1, 'sip_ring', '⭕', 'Sip Ring', 'plot', 'Zip through it to refill all your stamina.', { r: 5 }),
  S('hummingbird', 2, 'dash_hoop', '💨', 'Dash Hoop', 'plot', 'Zip through it for a big speed burst.', { r: 5 }),
  S('hummingbird', 3, 'combo_garden', '🎯', 'Combo Garden', 'plot', 'Quick picks in its ring chain into ×2 / ×3 combos.', { r: 12 }),
  S('moth', 1, 'moon_lantern', '🏮', 'Moon Lantern', 'plot', 'Night-time speed inside its glow, even by day.', { max: 4, r: 10 }),
  S('moth', 2, 'silk_line', '🕸️', 'Silk Line', 'plot', 'Fly along the line between two Silk Lines for a speed boost.', { max: 4, r: 0 }),
  S('moth', 3, 'dusk_bell', '🔔', 'Dusk Bell', 'plot', 'Act at it to bring on dusk: night falls and fresh dewdrops appear.'),
  S('bat', 1, 'hang_roost', '🦇', 'Hang Roost', 'roost', 'Hang here to refill your wings in a moment.', { r: 6 }),
  S('bat', 2, 'echo_tower', '📡', 'Echo Tower', 'plot', 'Pings every Dewdrop and Starseed: their beams shine extra tall.'),
  S('bat', 3, 'swoop_loop', '🌀', 'Swoop Loop', 'plot', 'Act inside: sweep up every petal around you in one swoop.', { r: 14 }),
  S('robin', 1, 'worm_farm', '🪱', 'Worm Farm', 'wormfarm', 'Act (stomp) here: worms pop up as petals.'),
  S('robin', 2, 'nest_grove', '🪺', 'Nest Grove', 'wormfarm', 'A fledgling copies you: +1 petal per pick per level, +1 crew size.'),
  S('robin', 3, 'song_tree', '🎶', 'Song Tree', 'plot', 'Your helper orders ring out: helpers move 40% faster for 20 s after an order.'),
  S('raccoon', 1, 'stash_den', '🦝', 'Stash Den', 'stashden', 'Drop off here like it was home.', { r: 5 }),
  S('raccoon', 2, 'rummage_bin', '🧺', 'Rummage Bin', 'storage', 'Act to rummage: petals, a dewdrop, or a lucky starseed.'),
  S('raccoon', 3, 'trickster_hideout', '🎭', 'Trickster Hideout', 'stashden', 'Snack Swipes against rivals pay double.'),
  S('opossum', 1, 'woodpile', '🪵', 'Woodpile', 'woodpile', 'Act to grab 3 logs, then Act anywhere to set a log step.'),
  S('opossum', 2, 'plank_bridge', '🌉', 'Plank Bridge', 'bridge', 'A raised walkway with steps. Rotatable.', { foot: 6.2, gd: 9, rot: true, r: 0, max: 4 }),
  S('opossum', 3, 'hollow_log', '🕳️', 'Hollow Log', 'plot', 'Interact at one to tunnel to your other Hollow Log.', { max: 2 }),
  S('bear', 1, 'shove_stump', '🪨', 'Shove Stump', 'plot', 'Bear counts as two friends on team lifts nearby.', { r: 14 }),
  S('bear', 2, 'shake_tree', '🌳', 'Shake Tree', 'honeycave', 'Act to shake it: petals and a dewdrop tumble out.'),
  S('bear', 3, 'great_den', '⛰️', 'Great Den', 'honeycave', 'Every crew home grows bigger, and bear carries more.', { foot: 3.0, gd: 8 }),
];
export const CATALOG = Object.fromEntries(LIST.map(c => [c.id, c]));
export const BUILD_ORDER = LIST.map(c => c.id);
CATALOG.home = { id: 'home', sp: null, tier: 0, icon: '🏡', name: 'Home Upgrade', m: 'home', blurb: 'Kept for saved homes.', pts: 30, max: 3, foot: 3, r: 0 };
export const BUILDS_OF = sp => LIST.filter(c => c.sp === sp).map(c => c.id);
/** migration: old generic / producer buildings -> species building at the same spot */
export const MIGRATE = { outpost: 'waggle_stage', marker: 'wind_streamer', garden: 'garden_patch', storage: 'rummage_bin', bridge: 'plank_bridge', apiary: 'apiary', roost: 'hang_roost', wormfarm: 'worm_farm', stashden: 'stash_den', woodpile: 'woodpile', honeycave: 'great_den' };
const tierName = t => ['', 'T1 · Petals', 'T2 · Dewdrops', 'T3 · Starseeds'][t];
export function buildInfo(t) {
  const C = CATALOG[t]; if (!C) return [];
  return [C.blurb, `${tierName(C.tier)} building · levels 1–3 make it stronger. Max ${C.max}.`, `+${C.pts} pts when built.`];
}
export const HOME_COST = [10, 18, 28];

export async function createBuild(scene, ctx) {
  const { territory: T, heightAt, phys, nests, SPECIES, round, fx, toast } = ctx;
  const placed = []; // {id,type,x,z,yaw,t0,kind?,tendAt?,obj,solids}
  const homeLv = {}; for (const s of SPECIES_ORDER) homeLv[s] = 0;
  const homeObj = {};
  const B = { active: false, sel: 'waggle_stage', rot: 0, placed, homeLv, valid: false, why: '', ghostPos: new THREE.Vector3(), gardenMul: 1 };
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
    const b = badge('🌼', 2.4); b.position.y = 3.4; g.add(b); g.userData.anim = (t, o) => { b.position.y = 3.4 + Math.sin(t * 2 + o) * 0.18; }; return g;
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
    const g = new THREE.Group(), C = CATALOG[t], mk = C.m;
    if (SPEC[mk]) {
      // procedural stand-in until the GLB is ready; then swap in the lv-toggling model
      const tmp = new THREE.Group(); g.add(tmp); let want = 1, lvG = null;
      bx(tmp, mk === 'roost' ? M.wood2 : M.wood, 2.2, 2.2, 2.2, 0, 1.1, 0);
      g.userData.setLv = l => { want = Math.max(1, Math.min(3, l || 1)); if (lvG) lvG.forEach((o, i) => { if (o) o.visible = i === (lvG[want - 1] ? want - 1 : lvG.findLastIndex((x, j) => x && j < want)); }); };
      specLevels(mk).then(L => { if (!L) return; lvG = L.map(ps => { if (!ps) return null; const o = new THREE.Group(); for (const p of ps) o.add(new THREE.Mesh(p.geometry, g.userData.ghost || p.material)); g.add(o); return o; }); g.remove(tmp); g.userData.setLv(want); });
    }
    else if (mk === 'apiary') { for (let i = 0; i < 3; i++) { const b = bx(g, i % 2 ? M.cream : M.plank, 1.8, 0.8, 1.8, 0, 0.45 + i * 0.85, 0, i * 0.12); } bx(g, M.wood2, 2.2, 0.2, 2.2, 0, 2.95, 0); put(g, 'honeycomb', 1.6, 0, 0.4, 0.5, 1); }
    else if (mk === 'honeycave') { put(g, 'rockMedium', 0, -0.1, 0, 0, 3.0); put(g, 'rockMedium', 1.8, -0.1, 0.8, 1.2, 1.8); put(g, 'honeycomb', -1.2, 0.2, 1.6, 0.4, 1.2); const gl = glow(3, 0xffc040); gl.position.set(-1.2, 1, 1.6); g.add(gl); }
    else if (mk === 'woodpile') { for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3, 8), i % 2 ? M.wood : M.wood2); r.rotation.z = Math.PI / 2; const row = i < 4 ? 0 : i < 6 ? 1 : 2, k = i < 4 ? i : i < 6 ? i - 4 : 0; r.position.set(0, 0.3 + row * 0.5, (k - (row === 0 ? 1.5 : row === 1 ? 0.5 : 0)) * 0.58); g.add(r); } put(g, 'stumpMoss', 1.8, 0, 0.6, 0.3, 1); }
    else { bx(g, M.soil, 4.2, 0.4, 4.2, 0, 0.15, 0); for (const s of [-1, 1]) { bx(g, M.wood, 4.5, 0.5, 0.3, 0, 0.3, s * 2.2); bx(g, M.wood, 0.3, 0.5, 4.5, s * 2.2, 0.3, 0); } put(g, 'mossPatch', 0, 0.35, 0, 0, 1.2); }
    const by = SPEC[mk] ? 5.6 : 4.2, b = badge(C.icon, 2.4); b.position.y = by; g.add(b); g.userData.anim = (tt, o) => { b.position.y = by + Math.sin(tt * 2 + o) * 0.18; }; return g;
  }
  function modelOf(t) { const m = CATALOG[t].m; return m === 'marker' ? modelMarker() : m === 'outpost' ? modelOutpost() : m === 'garden' ? modelGarden('p') : m === 'storage' ? modelStorage() : m === 'bridge' ? modelBridge() : modelProd(t); }

  // ---------- costs
  const count = t => placed.filter(p => p.type === t).length;
  B.count = count;
  B.cost = (t, id) => {
    const C = CATALOG[t];
    if (t === 'home') { const lv = homeLv[id]; return lv >= C.max ? null : { p: Math.round(HOME_COST[lv] * 1.3) }; }
    const m = 1 + 0.25 * count(t), b = TIER_COST[C.tier], o = {}; for (const k in b) o[k] = k === 's' ? b[k] : Math.ceil(b[k] * m); return o;
  };
  B.free = false;
  B.can = (t, id) => { const c = B.cost(t, id); if (!c) return false; if (B.free) return true; return round.canPay(c); };
  B.unlocked = t => !!CATALOG[t];
  B.lvSum = t => placed.filter(p => p.type === t).reduce((a, p) => a + (p.lv || 1), 0);
  B.near = (t, x, z, pad = 0) => placed.find(p => p.type === t && Math.hypot(p.x - x, p.z - z) < (CATALOG[t].r || 4) * (1 + 0.25 * ((p.lv || 1) - 1)) + pad) || null;
  B.atMax = t => count(t) >= CATALOG[t].max;
  B.storageCount = () => 0;
  B.homeR = id => 13 + 2.5 * (nests[id]?.stage ?? 0) + 6 * homeLv[id] + 4 * B.lvSum('great_den');
  B.refreshHomes = () => { for (const id of SPECIES_ORDER) { const n = nests[id]; if (!n) continue; const r = B.homeR(id); const s = T.get('home:' + id); if (!s) T.setSource('home:' + id, 'home', n.x, n.z, r, r); else if (Math.abs(s.r - r) > 0.01) T.setR('home:' + id, r); } };

  // ---------- ghost
  const ghost = new THREE.Group(), ringOk = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), ringBad = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const gRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), ringOk), gClaim = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  for (const r of [gRing, gClaim]) { r.rotation.x = -Math.PI / 2; r.renderOrder = 7; r.position.y = 0.2; }
  const gModel = new THREE.Group(); ghost.add(gModel, gRing, gClaim); ghost.visible = false; scene.add(ghost);
  let gType = null;
  function setGhostType(t) {
    if (gType === t) return; gType = t; gModel.clear();
    const m = modelOf(t, 'n'); m.userData.ghost = ghostMat.ok; m.traverse(o => { if (o.isMesh) o.material = ghostMat.ok; else if (o.isSprite) o.visible = false; }); gModel.add(m);
    const C = CATALOG[t]; gRing.scale.setScalar(C.m === 'bridge' ? 6.4 : C.foot + 0.8); gClaim.visible = C.r > 0; gClaim.scale.setScalar(C.r || 1);
  }
  function check(t, x, z, yaw) {
    const C = CATALOG[t];
    if (count(t) >= C.max) return 'Max built';
    if (!B.can(t)) return 'Need more resources';
    if (Math.hypot(x, z) > WORLD_R - 8) return 'Too close to the edge';
    const pts = C.m === 'bridge' ? [[0, 0], [3.5, 0], [-3.5, 0], [6.5, 0], [-6.5, 0]] : [[0, 0], [C.foot * 0.6, 0], [-C.foot * 0.6, 0], [0, C.foot * 0.6], [0, -C.foot * 0.6]];
    const c = Math.cos(yaw), s = Math.sin(yaw), g0 = heightAt(x, z);
    for (const [a, b] of pts) {
      const px = x + a * c + b * s, pz = z - a * s + b * c, h = heightAt(px, pz);
      if (h < WATER_Y + 0.5) return 'Too close to water';
      if (Math.abs(h - g0) > (C.m === 'bridge' ? 0.9 : 1.3)) return 'Ground is too steep';
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
    if (C.m === 'bridge') {
      const g0 = obj.position.y, c = Math.cos(rec.yaw), s = Math.sin(rec.yaw), W = (a, b) => [rec.x + a * c + b * s, rec.z - a * s + b * c];
      let [wx, wz] = W(0, 0); rec.solids.push({ type: 'box', x: wx, z: wz, hx: BR.len, hz: BR.hz, yaw: rec.yaw, y0: g0 - 1.5, top: g0 + BR.top - 0.02, kind: 'build' });
      for (let k = 0; k < 4; k++) for (const e of [-1, 1]) { const a = e * (BR.len + 0.3 + 0.6 * (3 - k)); [wx, wz] = W(a, 0); rec.solids.push({ type: 'box', x: wx, z: wz, hx: 0.31, hz: BR.hz, yaw: rec.yaw, y0: g0 - 1.5, top: g0 + 0.5 * (k + 1), kind: 'build' }); }
      for (const so of rec.solids) phys.add(so);
    }
    if (C.m === 'outpost') { rec.solo = rec.solo || T.depth(rec.x, rec.z) < 0; rec.terr = 1; T.setSource(rec.id, 'outpost', rec.x, rec.z, rec.r ?? 12, 44 + 10 * ((rec.lv || 1) - 1), 0.16); }
    else if (C.m !== 'bridge') { rec.solo = rec.solo || T.depth(rec.x, rec.z) < 0; rec.terr = 1; T.setSource(rec.id, 'marker', rec.x, rec.z, rec.r ?? 5, 12 + 4 * ((rec.lv || 1) - 1), 0.05); }
    if (!silent) { fx.burst(rec.x, obj.position.y + 1.5, rec.z, 26, 4); obj.scale.setScalar(0.01); rec.pop = 0; }
  }
  B.place = (x, z, yaw, free = false) => {
    const t = B.sel; if (!CATALOG[t]) return false; if (ctx.allowed && !ctx.allowed(t) && !free) { toast('🔒 Only ' + ctx.spName(CATALOG[t].sp) + ' knows how to build this. Swap to ' + ctx.spName(CATALOG[t].sp) + '!'); return false; }
    const why = check(t, x, z, yaw); if (why && !free) { B.why = why; toast('✖ ' + why); return false; }
    const cost = B.cost(t); if (!B.free && !free) round.pay(cost);
    const rec = { id: t + (uid++), type: t, x, z, yaw, t0: round.elapsed, tendAt: round.elapsed };
    rec.paid = cost ? { ...cost } : null; placed.push(rec); addBuilt(rec); round.add('building', CATALOG[t].pts); ctx.audio.sample ? ctx.audio.sample('build/place-thunk', 0.5) : ctx.audio.chime?.(); round.noteBuild(t);
    rec.lv = 1; toast(`${CATALOG[t].icon} ${CATALOG[t].name} built! +${CATALOG[t].pts}`);
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
  B.enter = () => { B.active = true; setGhostType(B.sel); ghost.visible = true; };
  B.exit = () => { B.active = false; ghost.visible = false; };
  B.rotate = () => { if (CATALOG[B.sel].rot) B.rot += Math.PI / 4; };
  B.aim = null; B.hiring = false;
  B.ghostAt = (p, camYaw) => { if (B.aim) return [B.aim.x, B.aim.z]; const C = CATALOG[B.sel]; const d = C.ghostDist || 7; return [p.x - Math.sin(camYaw) * d, p.z - Math.cos(camYaw) * d]; };
  /** called each frame in build mode. p = animal position, camYaw = camera yaw. */
  B.updateGhost = (p, camYaw, t) => {
    if (!B.active) return; if (B.hiring || !CATALOG[B.sel]) { ghost.visible = false; B.valid = false; B.why = ''; return; } ghost.visible = true;
    setGhostType(B.sel); let [x, z] = B.ghostAt(p, camYaw); const wr = Math.hypot(x, z), lim = WORLD_R - 6; if (wr > lim) { x *= lim / wr; z *= lim / wr; }
    const yaw = B.rot + (CATALOG[B.sel].rot ? camYaw : 0);
    const why = check(B.sel, x, z, yaw); B.valid = !why; B.why = why; B.gx = x; B.gz = z; B.gyaw = yaw;
    ghost.position.set(x, heightAt(x, z), z); gModel.rotation.y = yaw; const m = B.valid ? ghostMat.ok : ghostMat.bad;
    gModel.traverse(o => { if (o.isMesh && o.material !== m) o.material = m; }); gRing.material = B.valid ? ringOk : ringBad; gRing.rotation.z = t * 0.5;
  };
  B.placeGhost = () => B.hiring ? false : B.place(B.gx, B.gz, B.gyaw);

  const tmp = new THREE.Vector3();
  /** every frame: animate, upkeep (tending outposts), garden produce */
  // ---------- per-building upgrades (RTS building card): gardens/producers make more, beacons bloom wider
  const lvMul = p => 1 + 0.5 * ((p.lv || 1) - 1);
  B.canUpgrade = p => !!p && !!CATALOG[p.type] && (p.lv || 1) < 3;
  B.upgradeCost = p => B.canUpgrade(p) ? { ...UP_COST[(p.lv || 1) + 1] } : null;
  B.upgradeText = p => { const lv = p.lv || 1; return `Lv ${lv + 1}: bigger ring, stronger effect, faster recharge`; };
  B.upgrade = p => {
    const c = B.upgradeCost(p); if (!c) return false;
    if (!B.free && !round.canPay(c)) { toast('Need ' + Object.keys(c).map(k => RES_ICON[k] + c[k]).join(' ')); return false; }
    if (!B.free) round.pay(c); p.lv = (p.lv || 1) + 1; round.add('building', 15 * p.lv); p.obj?.userData.setLv?.(p.lv);
    { const s = T.get(p.id); if (s) s.rMax = (CATALOG[p.type].m === 'outpost' ? 44 + 10 : 12 + 4) * 1 + (CATALOG[p.type].m === 'outpost' ? 10 : 4) * (p.lv - 2); } round.stats.upgrades = (round.stats.upgrades || 0) + 1;
    fx.burst(p.x, heightAt(p.x, p.z) + 2.5, p.z, 26, 4); ctx.audio?.sample ? ctx.audio.sample('build/upgrade-sparkle', 0.5) : ctx.audio?.blip?.(7); toast(`⬆ ${CATALOG[p.type].name} Lv ${p.lv}! +${15 * p.lv}`); return true;
  };
  B.nearest = (x, z, r = 4) => { let best = null, bd = r; for (const p of placed) { const d = Math.hypot(p.x - x, p.z - z) - (CATALOG[p.type].foot || 2) * 0.5; if (d < bd) { bd = d; best = p; } } return best; };
  B.update = (dt, t, curPos, simT) => {
    for (const p of placed) {
      const o = p.obj; if (o.userData.anim) o.userData.anim(t, p.t0);
      if (p.pop !== undefined && p.pop < 1) { p.pop = Math.min(1, p.pop + dt * 3); const k = p.pop, e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); o.scale.setScalar(Math.max(0.01, e)); if (k >= 1) o.scale.setScalar(1); }
      if (CATALOG[p.type].m === 'outpost') {
        const s = T.get(p.id); if (!s) continue; const need = round.elapsed - p.tendAt > 40; o.userData.tend.visible = need && s.r < s.rMax;
        if (s.tend > 0) s.tend -= dt;
        if (curPos && need && s.r < s.rMax + 0.1 && Math.hypot(curPos.x - p.x, curPos.z - p.z) < 6.5 && !round.over) {
          p.tendAt = round.elapsed; s.tend = 25; T.grow(p.id, 2); round.add('upkeep', 12); fx.burst(p.x, o.position.y + 3, p.z, 20, 4); ctx.audio.blip?.(); toast('💧 Tended the beacon: it\u2019s blooming wider! +12');
        }
      }
    }
  };
  B.tendPending = () => placed.filter(p => CATALOG[p.type].m === 'outpost' && round.elapsed - p.tendAt > 40).length;

  // ---------- state
  B.serialize = () => ({ homeLv: { ...homeLv }, placed: placed.map(p => ({ id: p.id, type: p.type, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: p.yaw, t0: p.t0, kind: p.kind, tendAt: p.tendAt, acc: p.acc, pa: p.pa, lv: p.lv, solo: p.solo || undefined, r: p.terr ? +(T.get(p.id)?.r ?? 0).toFixed(2) : undefined })), uid });
  B.removeOne = (rec) => {
    const i = placed.indexOf(rec); if (i < 0) return false;
    scene.remove(rec.obj); for (const so of rec.solids || []) so.off = true;
    if (rec.terr || rec.solo) T.remove(rec.id);
    placed.splice(i, 1); return true;
  };
  B.clear = () => { for (const p of placed) { scene.remove(p.obj); for (const so of p.solids || []) so.off = true; if (p.terr || p.solo) T.remove(p.id); } placed.length = 0; for (const id of SPECIES_ORDER) { homeLv[id] = 0; B.rebuildHome(id); } B.refreshHomes(); };
  B.restore = s => { B.clear(); if (!s) return; uid = s.uid || 1; for (const id in s.homeLv || {}) { homeLv[id] = s.homeLv[id]; B.rebuildHome(id); } let refund = 0; for (const r of s.placed || []) { const rec = { ...r }; if (!CATALOG[rec.type] && MIGRATE[rec.type]) { rec.type = MIGRATE[rec.type]; rec.migrated = 1; } if (!CATALOG[rec.type]) { refund += 10 * (rec.lv || 1); continue; } delete rec.kind; delete rec.pa; delete rec.acc; placed.push(rec); addBuilt(rec, true); } B.refreshHomes(); return refund; };
  /** admin: drop a free build right at a spot */
  B.free_place = (t, x, z, yaw = 0) => { const prev = B.sel; B.sel = t; const r = B.place(x, z, yaw, true); B.sel = prev; return r; };
  B.refreshHomes();
  return B;
}
