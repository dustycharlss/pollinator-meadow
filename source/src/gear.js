// Silly upgradable gear: 3 slots (Range / Speed / Capacity) x 3 tiers per animal.
// Everything is tiny flat-shaded procedural geometry hung on each rider's body group.
import * as THREE from 'three';

export const SLOTS = ['range', 'speed', 'cap'];
export const SLOT_LABEL = { range: 'Range', speed: 'Speed', cap: 'Capacity' };
export const RANGE_M = [1, 1.2, 1.45, 1.75];
export const SPEED_M = [1, 1.08, 1.17, 1.28];
export const DRAIN_M = [1, 0.92, 0.84, 0.75];
export const RECH_M = [1, 1.1, 1.2, 1.35];
const CAP_F = [0, 0.25, 0.5, 0.9], CAP_MIN = [0, 2, 4, 6];
export const capBonus = (carry, t) => (t ? Math.max(Math.round(carry * CAP_F[t]), CAP_MIN[t]) : 0);
export const COST_F = [0, 0.8, 1.8, 3.2];
export const costOf = (carry, t) => Math.max(3, Math.round(carry * COST_F[t]));
export const ringMult = (t) => 1 + (RANGE_M[t] - 1) * 0.9;

// [slot] -> {icon, names:[t1,t2,t3]}
export const GEAR = {
  raccoon: [{ icon: '🌀', names: ['Pocket Vac', 'Whirl Vac 2000', 'Golden Hoover'] }, { icon: '🛼', names: ['Rusty Skates', 'Roller Skates', 'Disco Skates'] }, { icon: '🎒', names: ['Mini Backpack', 'Trail Pack', 'Mega Rucksack'] }],
  bear: [{ icon: '🥄', names: ['Trusty Scooper', 'Super Scooper', 'Golden Scoop-o-Matic'] }, { icon: '👟', names: ['Plain Sneakers', 'Zoom Sneakers', 'Winged Sneakers'] }, { icon: '🧺', names: ['Berry Basket', 'Picnic Basket', 'Grand Hamper'] }],
  opossum: [{ icon: '🦞', names: ['Grabber Stick', 'Pro Grabber', 'Golden Claw'] }, { icon: '🛴', names: ['Kick Scooter', 'Turbo Scooter', 'Rainbow Scooter'] }, { icon: '🛒', names: ['Tiny Wagon', 'Stick Wagon', 'Grand Wagon'] }],
  robin: [{ icon: '🔭', names: ['Opera Glasses', 'Binoculars', 'Golden Spyglass'] }, { icon: '🥽', names: ['Pilot Goggles', 'Aviator Scarf', 'Ace Streamer'] }, { icon: '👜', names: ['Little Satchel', 'Seed Satchel', 'Grand Satchel'] }],
  bee: [{ icon: '🖌️', names: ['Pollen Brush', 'Fluffy Wand', 'Golden Duster Wand'] }, { icon: '🏁', names: ['Racing Stripe', 'Prop Cap', 'Turbo Prop Cap'] }, { icon: '🍯', names: ['Pollen Baskets', 'Roomy Baskets', 'Giant Baskets'] }],
  bumblebee: [{ icon: '🧽', names: ['Duster Mitts', 'Fluffy Mitts', 'Super Fluff Mitts'] }, { icon: '🌀', names: ['Turbo Fan', 'Twin Fan', 'Jet Fan'] }, { icon: '🪣', names: ['Little Bucket', 'Honey Bucket', 'Big Bucket'] }],
  butterfly: [{ icon: '🥤', names: ['Sipping Straw', 'Long Straw', 'Curly Mega Straw'] }, { icon: '🧣', names: ['Silk Scarf', 'Long Scarf', 'Rainbow Streamer'] }, { icon: '👜', names: ['Tiny Tote', 'Market Tote', 'Grand Tote'] }],
  moth: [{ icon: '🔦', names: ['Headlamp', 'Bright Lamp', 'Beacon Lamp'] }, { icon: '🦸', names: ['Glide Cape', 'Star Cape', 'Cosmic Cape'] }, { icon: '🫙', names: ['Firefly Jar', 'Big Jar', 'Grand Lantern Jar'] }],
  hummingbird: [{ icon: '📏', names: ['Long Beak Tip', 'Longer Tip', 'Golden Needle Tip'] }, { icon: '🚀', names: ['Tiny Jetpack', 'Twin Jets', 'Gold Rocket Pack'] }, { icon: '🍶', names: ['Nectar Canteen', 'Big Canteen', 'Grand Flask'] }],
  bat: [{ icon: '🎧', names: ['Sonar Headset', 'Echo Headset', 'Super Sonar Dish'] }, { icon: '🪖', names: ['Flight Helmet', 'Racing Suit', 'Rocket Suit'] }, { icon: '🍎', names: ['Fruit Sling', 'Roomy Sling', 'Big Sling'] }],
};

// ---------- tiny kit ----------
const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), sph: new THREE.IcosahedronGeometry(0.5, 1), cone: new THREE.ConeGeometry(0.5, 1, 8), tor: new THREE.TorusGeometry(0.5, 0.1, 5, 14), oct: new THREE.OctahedronGeometry(0.5), tri: new THREE.CylinderGeometry(0.5, 0.5, 1, 3) };
const MATS = new Map();
function mat(c, e = 0, glow = 0) {
  const k = c + '|' + e + '|' + glow; let m = MATS.get(k);
  if (!m) {
    m = glow ? new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: glow, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: c, emissiveIntensity: e, side: THREE.DoubleSide });
    MATS.set(k, m);
  }
  return m;
}
// P(parent, geo, color, [x,y,z], [sx,sy,sz], {e, g, r:[rx,ry,rz]})
function P(par, geo, col, pos = [0, 0, 0], s = [1, 1, 1], o = {}) {
  const m = new THREE.Mesh(typeof geo === 'string' ? GEO[geo] : geo, mat(col, o.e || 0, o.g || 0));
  m.position.set(pos[0], pos[1], pos[2]); m.scale.set(s[0], s[1], s[2]); if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]);
  m.matrixAutoUpdate = true; par.add(m); return m;
}
// a stick from a to b (thickness t)
function rod(par, col, a, b, t, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = P(par, 'cyl', col, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [t, L, t], o);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}
function tube(par, col, pts, r) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 14, r, 5, false);
  const m = new THREE.Mesh(g, mat(col)); par.add(m); return m;
}
const GOLD = 0xffc83a, pick = (T, a, b, c) => [a, b, c][T - 1];
const grp = (par, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };
const showN = (items, f) => { const n = Math.round(f * items.length + (f > 0.02 ? 0.4 : 0)); items.forEach((m, i) => (m.visible = i < n)); };
const R = (a, b) => a + Math.random() * (b - a);

// ---------- builders: (T, g) -> upd(t, dt, c) | undefined.  Body-local: nose +Z, up +Y ----------
const B = {};

// ===== RACCOON =====
B.raccoon = [
  (T, g) => { // handheld vacuum on a hose
    const s = pick(T, 0.85, 1, 1.2), col = pick(T, 0x8a9099, 0xe5485a, GOLD);
    const can = grp(g, 0.34, 0.8, -0.35); can.scale.setScalar(0.8); P(can, 'box', col, [0, 0, 0], [0.5 * s, 0.34 * s, 0.7 * s], { e: T === 3 ? 0.25 : 0 }); P(can, 'cyl', 0x2f3640, [0.27 * s, -0.08, 0.15], [0.16, 0.06, 0.16], { r: [0, 0, Math.PI / 2] }); P(can, 'cyl', 0x2f3640, [-0.27 * s, -0.08, 0.15], [0.16, 0.06, 0.16], { r: [0, 0, Math.PI / 2] });
    if (T >= 2) P(can, 'cyl', 0xdfe6ec, [0, 0.22 * s, 0], [0.18, 0.12, 0.18]);
    tube(g, 0x3a414c, [[0.3, 0.85, -0.1], [0.25, 1.0, 0.5], [-0.05, 1.0, 1.2], [0, 0.55, 1.75], [0, 0.32, 2.1]], 0.06);
    const noz = grp(g, 0, 0.26, 2.3); noz.rotation.x = 0.35;
    P(noz, 'cone', col, [0, 0, 0.05], [0.7 * s, 0.55 * s, 0.7 * s], { r: [-Math.PI / 2, 0, 0], e: T === 3 ? 0.3 : 0 });
    const ring = P(noz, 'tor', 0x9fe7ff, [0, 0, 0.36 * s], [0.9 * s, 0.9 * s, 0.9 * s], { g: T >= 2 ? 0.7 : 0.0001 }); ring.material = ring.material.clone(); ring.visible = T >= 2;
    let acc = 0;
    return (t, dt, c) => {
      const k = ((t * 1.6) % 1); ring.scale.setScalar((1.5 - k * 0.8) * s); ring.material.opacity = 0.8 * k;
      if (c.act && c.em) { acc += dt * (T * 4 + (c.speed > 0.1 ? 4 : 0)); while (acc > 1) { acc--; c.pull(noz, R(-0.7, 0.7) * s, R(-0.2, 0.5), 1.4 * s + R(0, 0.5), noz, T === 3 ? 0xffe27a : 0xfff4cf); } }
    };
  },
  (T, g) => { // roller skates
    const col = pick(T, 0x8a8f96, 0xff6fb0, GOLD), wheels = [];
    for (const [x, z] of [[-0.3, 0.75], [0.3, 0.75], [-0.3, -0.7], [0.3, -0.7]]) {
      P(g, 'box', col, [x, 0.14, z + 0.04], [0.26, 0.16, 0.5], { e: T === 3 ? 0.3 : 0 }); if (T >= 2) P(g, 'box', 0xffffff, [x, 0.23, z + 0.04], [0.28, 0.04, 0.52]);
      for (const dz of [-0.16, 0.18]) wheels.push(P(g, 'cyl', pick(T, 0x555, 0x3a3f48, 0xfff2b0), [x, 0.07, z + dz], [0.15, 0.3, 0.15], { r: [0, 0, Math.PI / 2], e: T === 3 ? 0.6 : 0 }));
    }
    let acc = 0, h = 0;
    return (t, dt, c) => {
      for (const w of wheels) w.rotation.x -= 0; wheels.forEach(w => (w.children.length || (w.rotation.y += c.speed * dt * 14)));
      if (T === 3 && c.act && c.speed > 0.15) { acc += dt * 20; while (acc > 1) { acc--; h = (h + 0.11) % 1; c.spark(g, R(-0.4, 0.4), 0.1, -0.9, new THREE.Color().setHSL(h, 1, 0.65).getHex(), 0.7, 0.18, 0, 0.2, -0.5); } }
    };
  },
  (T, g) => { // backpack
    const s = pick(T, 0.6, 0.75, 0.9), col = pick(T, 0x8a5a2c, 0x3f8f4b, 0x7b4bd8);
    const bp = grp(g, -0.12, 0.85 + 0.05 * s, -0.18);
    P(bp, 'box', col, [0, 0.1 * s, 0], [0.62 * s, 0.6 * s, 0.46 * s]); P(bp, 'box', pick(T, 0x6e4620, 0x2d6b37, 0x5a35b0), [0, 0.34 * s, 0.02], [0.66 * s, 0.14 * s, 0.5 * s]);
    if (T >= 2) { P(bp, 'box', 0xe8b04a, [0.36 * s, 0, 0], [0.12, 0.34, 0.3]); P(bp, 'box', 0xe8b04a, [-0.36 * s, 0, 0], [0.12, 0.34, 0.3]); P(bp, 'cyl', 0xd9c7a0, [0, 0.52 * s, 0], [0.18, 0.62 * s, 0.18], { r: [0, 0, Math.PI / 2] }); }
    if (T === 3) { P(bp, 'oct', GOLD, [0, 0.12, 0.27 * s], [0.3, 0.3, 0.1], { e: 0.6 }); P(bp, 'cyl', 0xc8ccd2, [0.34 * s, -0.3 * s, -0.1], [0.14, 0.14, 0.14]); P(bp, 'sph', 0xfff0a0, [0, 0.6 * s, -0.3 * s], [0.18, 0.18, 0.18], { e: 1 }); }
    P(bp, 'box', 0x3a2a1a, [0, 0, 0.26 * s], [0.5 * s, 0.05, 0.03]);
    return (t, dt, c) => { bp.scale.set(1, 1 + 0.07 * c.fill, 1 + 0.2 * c.fill); bp.position.y = 0.85 + 0.05 * s + 0.03 * Math.sin(t * 8) * c.speed; };
  },
];

// ===== BEAR =====
B.bear = [
  (T, g) => { // long-handled pooper scooper
    const col = pick(T, 0x8d949b, 0x4ec96a, GOLD), L = pick(T, 1.7, 2.1, 2.6), w = pick(T, 0.5, 0.65, 0.8);
    const arm = grp(g, 0.95, 1.25, 0.75);
    rod(arm, pick(T, 0x8a5a2c, 0x6b3f1c, 0xfff1c0), [0, 0.1, -0.3], [0, -0.95, L], 0.09, { e: T === 3 ? 0.4 : 0 });
    if (T >= 2) P(arm, 'cyl', 0x2f3640, [0, 0.0, -0.2], [0.14, 0.3, 0.14], { r: [Math.PI / 2 + 0.4, 0, 0] });
    const sc = grp(arm, 0, -1.0, L + 0.05); sc.rotation.x = 0.1;
    P(sc, 'box', col, [0, 0, 0], [w, 0.07, 0.8], { e: T === 3 ? 0.35 : 0 }); P(sc, 'box', col, [w / 2, 0.1, 0], [0.06, 0.2, 0.8]); P(sc, 'box', col, [-w / 2, 0.1, 0], [0.06, 0.2, 0.8]); P(sc, 'box', col, [0, 0.12, -0.4], [w, 0.28, 0.06]);
    if (T === 3) P(sc, 'box', 0x7fe3ff, [0, 0.07, 0], [w + 0.06, 0.03, 0.86], { g: 0.45 });
    let acc = 0;
    return (t, dt, c) => {
      arm.rotation.y = Math.sin(t * 5) * 0.12 * (0.3 + c.speed); arm.rotation.z = 0.05 + 0.04 * Math.sin(t * 2.3);
      if (T === 3 && c.act && c.em) { acc += dt * 8; while (acc > 1) { acc--; c.spark(sc, R(-0.3, 0.3), 0.2, R(-0.3, 0.3), 0xffe27a, 0.8, 0.14, 0, 0.9, 0); } }
      if (T >= 2 && c.act && c.em) { acc += dt * 3; while (acc > 1) { acc--; c.pull(sc, R(-0.6, 0.6), R(0.3, 0.9), 1.0 + R(0, 0.4), sc, 0xfff4cf); } }
    };
  },
  (T, g) => { // sneakers
    const top = pick(T, 0xdfe3e8, 0xe5485a, GOLD), parts = [];
    // playtest-01 M3: under the bearB feet (x ±0.40, z +0.53 / −1.03); each shoe steps with a trot gait
    for (const [x, z] of [[-0.40, 0.53], [0.40, 0.53], [-0.40, -1.03], [0.40, -1.03]]) {
      const sh = grp(g, x, 0, z); sh.userData.ph = (x < 0) === (z > 0) ? 0 : Math.PI; P(sh, 'box', 0xffffff, [0, 0.07, 0], [0.5, 0.14, 0.78], { e: T === 3 ? 0.6 : 0 }); P(sh, 'box', top, [0, 0.24, 0.0], [0.46, 0.22, 0.74], { e: T === 3 ? 0.3 : 0 }); P(sh, 'box', 0x2f3640, [0, 0.36, 0.2], [0.34, 0.04, 0.3]);
      if (T >= 2) P(sh, 'box', 0xffffff, [0.24, 0.26, 0], [0.04, 0.1, 0.5]);
      if (T === 3) { for (const sx of [-1, 1]) { const wg = P(sh, 'tri', 0xffffff, [0.3 * sx, 0.3, -0.35], [0.1, 0.5, 0.34], { r: [0, 0, sx * 1.2], e: 0.5 }); parts.push(wg); } }
      parts.push(sh);
    }
    let acc = 0;
    return (t, dt, c) => {
      if (c.act && c.speed > 0.3) { acc += dt * 6 * (T); while (acc > 1) { acc--; c.spark(g, R(-0.7, 0.7), 0.1, -1.4, T === 3 ? 0xffe27a : 0xe9e2d0, 0.6, 0.2, 0, 0.5, -1); } }
      const sp = Math.min(1, c.speed || 0); for (const p of parts) if (p.userData.ph !== undefined) { const ph = t * 11 + p.userData.ph, sw = Math.sin(ph); p.position.y = c.act ? Math.max(0, sw) * 0.18 * sp : 0; p.rotation.x = c.act ? -Math.cos(ph) * 0.25 * sp : 0; }
    };
  },
  (T, g) => { // picnic basket
    const s = pick(T, 0.8, 1.05, 1.35), bk = grp(g, 0, 1.78 + 0.1 * s, -0.25);
    P(bk, 'box', 0xc99a5b, [0, 0, 0], [1.0 * s, 0.55 * s, 0.75 * s]); P(bk, 'box', 0x9a6e34, [0, 0.0, 0.0], [1.04 * s, 0.1, 0.79 * s]);
    if (T >= 2) { P(bk, 'box', 0xe5485a, [0, 0.3 * s, 0], [1.04 * s, 0.05, 0.78 * s]); for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) if ((i + j) % 2 === 0) P(bk, 'box', 0xffffff, [i * 0.2 * s, 0.33 * s, j * 0.24 * s], [0.2 * s, 0.02, 0.24 * s]); }
    const hd = P(bk, 'tor', 0x8a5a2c, [0, 0.3 * s, 0], [0.9 * s, 0.9 * s, 0.9 * s], { r: [0, 0, 0] }); hd.scale.z = 0.3; hd.rotation.y = Math.PI / 2; hd.position.y = 0.28 * s;
    const items = [];
    const cols = [0xff5b5b, 0xffd23a, 0x7ed957, 0xff8f3a, 0xb36bff];
    for (let i = 0; i < pick(T, 3, 5, 7); i++) items.push(P(bk, 'sph', cols[i % 5], [(i % 4 - 1.5) * 0.22 * s, 0.38 * s + (i > 3 ? 0.12 : 0), ((i >> 1) % 2 - 0.5) * 0.3], [0.2, 0.2, 0.2]));
    if (T === 3) { P(bk, 'cyl', 0xf0d49a, [0.32 * s, 0.6 * s, 0], [0.12, 0.8, 0.12], { r: [0, 0, 1.2] }); P(bk, 'cone', 0xffd23a, [-0.3 * s, 0.5 * s, 0.1], [0.3, 0.2, 0.3], { r: [0, 0, 0.4] }); }
    return (t, dt, c) => { showN(items, c.fill); bk.rotation.z = 0.02 * Math.sin(t * 7) * c.speed; };
  },
];

// ===== OPOSSUM =====
B.opossum = [
  (T, g) => { // grabber on a stick
    const L = pick(T, 1.7, 2.1, 2.6), col = pick(T, 0x8d949b, 0xff7a3a, GOLD), arm = grp(g, 0.55, 0.65, 0.3);
    rod(arm, pick(T, 0x8a5a2c, 0x3a3f48, 0xfff1c0), [0, 0, 0], [0, -0.35, L], 0.07, { e: T === 3 ? 0.4 : 0 });
    P(arm, 'box', pick(T, 0x555, 0xff3a3a, 0x7fe3ff), [0, 0.0, 0.1], [0.14, 0.12, 0.4], { e: 0.2 });
    const claw = grp(arm, 0, -0.35, L), jaws = [];
    for (let i = 0; i < (T === 3 ? 3 : 2); i++) { const j = grp(claw); j.rotation.z = (i - (T === 3 ? 1 : 0.5)) * 0.9; const pr = P(j, 'cone', col, [0, 0, 0.22], [0.12, 0.5, 0.12], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.45 : 0 }); jaws.push(j); }
    let acc = 0;
    return (t, dt, c) => {
      const o = 0.35 + 0.25 * Math.sin(t * 3 + (c.speed > 0.1 ? t * 2 : 0)); jaws.forEach((j, i) => (j.rotation.z = (i - (jaws.length - 1) / 2) * (0.5 + o))); arm.rotation.y = 0.1 * Math.sin(t * 1.3);
      if (c.act && c.em) { acc += dt * T * 2.5; while (acc > 1) { acc--; c.pull(claw, R(-0.7, 0.7), R(-0.1, 0.5), 0.9 + R(0, 0.5), claw, T === 3 ? 0xffe27a : 0xfff4cf); } }
    };
  },
  (T, g) => { // kick scooter
    const col = pick(T, 0x8d949b, 0x2fc9b8, GOLD), sc = grp(g, 0, 0, 0), wheels = [];
    P(sc, 'box', col, [0, 0.18, -0.15], [0.5, 0.07, 1.6], { e: T === 3 ? 0.3 : 0 });
    for (const z of [-0.85, 0.95]) wheels.push(P(sc, 'cyl', pick(T, 0x333a44, 0x333a44, 0xfff2b0), [0, 0.16, z], [0.32, 0.12, 0.32], { r: [0, 0, Math.PI / 2], e: T === 3 ? 0.7 : 0 }));
    rod(sc, col, [0, 0.2, 1.1], [0, 1.05, 1.4], 0.08); P(sc, 'cyl', 0x2f3640, [0, 1.07, 1.42], [0.09, 0.9, 0.09], { r: [0, 0, Math.PI / 2] });
    const rib = [];
    if (T >= 2) for (const sx of [-1, 1]) rib.push(P(sc, 'box', T === 3 ? 0xff5bd0 : 0xffd23a, [0.45 * sx, 1.0, 1.4], [0.04, 0.04, 0.5]));
    let acc = 0, h = 0;
    return (t, dt, c) => {
      wheels.forEach(w => (w.rotation.x += c.speed * dt * 12)); rib.forEach((r, i) => { r.rotation.y = 0.4 * (i ? 1 : -1) + Math.sin(t * 10 + i) * 0.2 * (0.3 + c.speed); });
      if (T === 3 && c.act && c.speed > 0.15) { acc += dt * 20; while (acc > 1) { acc--; h = (h + 0.1) % 1; c.spark(sc, R(-0.2, 0.2), 0.15, -1, new THREE.Color().setHSL(h, 1, 0.65).getHex(), 0.7, 0.18, 0, 0.2, -0.5); } }
    };
  },
  (T, g) => { // tow wagon that fills with sticks
    const s = pick(T, 0.8, 1.0, 1.3), col = pick(T, 0x9a6e34, 0xe5485a, 0x2f7fd8), z0 = -2.1 * s - 0.2, wg = grp(g, 0, 0, z0), wheels = [];
    P(wg, 'box', col, [0, 0.4, 0], [0.9 * s, 0.1, 1.3 * s]);
    for (const [x, z, w, h] of [[0.45 * s, 0, 0.06, 0.28], [-0.45 * s, 0, 0.06, 0.28]]) P(wg, 'box', col, [x, 0.55, z], [w, h, 1.3 * s]);
    P(wg, 'box', col, [0, 0.55, -0.65 * s], [0.9 * s, 0.28, 0.06]); P(wg, 'box', col, [0, 0.55, 0.65 * s], [0.9 * s, 0.28, 0.06]);
    for (const x of [-1, 1]) for (const z of [-0.45, 0.45]) wheels.push(P(wg, 'cyl', 0x2f3640, [x * 0.5 * s, 0.24, z * s], [0.42, 0.1, 0.42], { r: [0, 0, Math.PI / 2] }));
    rod(g, 0x6e4620, [0, 0.45, -0.95], [0, 0.4, z0 + 0.7 * s], 0.06);
    if (T === 3) { P(wg, 'box', GOLD, [0, 0.72, -0.62 * s], [0.96 * s, 0.05, 0.08], { e: 0.5 }); rod(wg, 0xfff1c0, [0.45 * s, 0.5, -0.62 * s], [0.45 * s, 1.3, -0.62 * s], 0.05); P(wg, 'tri', 0xff5bd0, [0.6 * s, 1.15, -0.62 * s], [0.4, 0.04, 0.3], { r: [0, 0, Math.PI / 2], e: 0.5 }); }
    const sticks = []; for (let i = 0; i < pick(T, 4, 6, 9); i++) sticks.push(P(wg, 'cyl', i % 2 ? 0x8a5a2c : 0x6e4620, [(i % 3 - 1) * 0.22 * s, 0.55 + Math.floor(i / 3) * 0.1, (i * 0.37 % 1 - 0.5) * 0.5 * s], [0.07, 0.9 * s, 0.07], { r: [0.2 * (i % 3 - 1), (i % 2 ? 0.4 : -0.3), Math.PI / 2 * 0 + 0.15 * (i % 2)] }));
    return (t, dt, c) => { wheels.forEach(w => (w.rotation.x += 0)); showN(sticks, c.fill); wg.rotation.y = Math.sin(t * 1.2) * 0.04 + 0.03 * Math.sin(t * 6) * c.speed; };
  },
];

// ===== ROBIN =====
B.robin = [
  (T, g) => { // binoculars
    const s = pick(T, 0.8, 1.05, 1.35), col = pick(T, 0x2f3640, 0x2f9b5a, GOLD), b = grp(g, 0, 0.95, 0.55);
    for (const x of [-1, 1]) { P(b, 'cyl', col, [0.13 * s * x, 0, 0.1], [0.2 * s, 0.4 * s, 0.2 * s], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.35 : 0 }); P(b, 'cyl', 0x9fe7ff, [0.13 * s * x, 0, 0.32 * s], [0.16 * s, 0.04, 0.16 * s], { r: [Math.PI / 2, 0, 0], e: 0.6 + T * 0.2 }); }
    P(b, 'box', col, [0, 0, 0.02], [0.14 * s, 0.1, 0.3 * s]);
    return (t, dt, c) => { b.rotation.x = 0.04 * Math.sin(t * 2); };
  },
  (T, g) => { // goggles + scarf
    const gc = pick(T, 0xe5485a, 0x2f9bd8, GOLD), h = grp(g, 0, 0.95, 0.3);
    for (const x of [-1, 1]) { P(h, 'cyl', gc, [0.14 * x, 0.04, 0.2], [0.17, 0.08, 0.17], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.4 : 0 }); P(h, 'cyl', 0x9fe7ff, [0.14 * x, 0.04, 0.25], [0.12, 0.03, 0.12], { r: [Math.PI / 2, 0, 0], e: 0.5 }); }
    P(h, 'box', 0x2f3640, [0, 0.04, 0.02], [0.4, 0.04, 0.3]);
    const sc = grp(g, 0, 0.66, 0.24); P(sc, 'cyl', pick(T, 0xdddddd, 0xff7a3a, 0xff5bd0), [0, 0, 0.0], [0.5, 0.14, 0.5]);
    const segs = [], n = pick(T, 4, 6, 9); for (let i = 0; i < n; i++) segs.push(P(sc, 'box', T === 3 ? new THREE.Color().setHSL(i / n, 0.9, 0.6).getHex() : pick(T, 0xdddddd, 0xff7a3a), [0, 0, 0], [0.16, 0.03, 0.2]));
    return (t, dt, c) => { segs.forEach((m, i) => { const k = i + 1; m.position.set(0.0 + Math.sin(t * 6 - k * 0.8) * 0.06 * k, -0.02 * k + Math.sin(t * 5 - k) * 0.03 * k, -0.34 - 0.17 * k); m.rotation.y = Math.sin(t * 6 - k * 0.8) * 0.3; }); };
  },
  (T, g) => { // satchel
    const s = pick(T, 0.8, 1.0, 1.25), col = pick(T, 0x8a5a2c, 0x3f8f4b, 0x7b4bd8);
    const bg = grp(g, 0.34, 0.5, -0.05); P(bg, 'box', col, [0, 0, 0], [0.16 * s, 0.34 * s, 0.34 * s]); P(bg, 'box', pick(T, 0x6e4620, 0x2d6b37, 0x5a35b0), [0.02, 0.17 * s, 0], [0.18 * s, 0.07, 0.36 * s]);
    if (T >= 2) P(bg, 'sph', 0xffd23a, [0.1, 0, 0.0], [0.1, 0.1, 0.1], { e: 0.5 }); if (T === 3) P(bg, 'oct', GOLD, [0.1, -0.1, 0.0], [0.12, 0.12, 0.05], { e: 0.7 });
    rod(g, 0x3a2a1a, [-0.25, 0.85, 0.0], [0.34, 0.6, -0.05], 0.05);
    return (t, dt, c) => { bg.scale.setScalar(1 + 0.12 * c.fill); bg.rotation.z = 0.05 * Math.sin(t * 8) * c.speed; };
  },
];
B.robin[0] = (T, g) => {
  const s = pick(T, 0.65, 0.8, 0.95), col = pick(T, 0x2f3640, 0x2f9b5a, GOLD), b = grp(g, 0, 0.95, 0.52);
  for (const x of [-1, 1]) { P(b, 'cyl', col, [0.12 * s * x, 0, 0.1], [0.2 * s, 0.4 * s, 0.2 * s], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.35 : 0 }); P(b, 'cyl', 0x9fe7ff, [0.12 * s * x, 0, 0.32 * s], [0.16 * s, 0.04, 0.16 * s], { r: [Math.PI / 2, 0, 0], e: 0.6 + T * 0.2 }); }
  P(b, 'box', col, [0, 0, 0.02], [0.14 * s, 0.1, 0.3 * s]);
  let acc = 0;
  return (t, dt, c) => { b.rotation.x = 0.04 * Math.sin(t * 2); if (T >= 2 && c.act && c.em) { acc += dt * T * 2; while (acc > 1) { acc--; c.pull(b, R(-0.8, 0.8), R(-0.4, 0.3), 1.0 + R(0, 0.6), b, 0xfff4cf); } } };
};

// ===== BEE =====
B.bee = [
  (T, g) => { // pollen brush wand
    const L = pick(T, 1.0, 1.3, 1.7), col = pick(T, 0xffd23a, 0xff9a3a, GOLD), arm = grp(g, 0.5, -0.15, 0.35);
    rod(arm, pick(T, 0x8a5a2c, 0x6b3f1c, 0xfff1c0), [0, 0, 0], [0, -0.15, L], 0.06, { e: T === 3 ? 0.4 : 0 });
    const br = grp(arm, 0, -0.15, L); P(br, 'sph', col, [0, 0, 0.12], [0.22 * (T + 1) * 0.6, 0.22 * (T + 1) * 0.6, 0.5], { e: T === 3 ? 0.5 : 0.15 }); if (T >= 2) P(br, 'sph', 0xfff0a0, [0, 0, 0.3], [0.2, 0.2, 0.3], { e: 0.5 });
    let acc = 0;
    return (t, dt, c) => { arm.rotation.y = Math.sin(t * 4) * 0.25; arm.rotation.x = Math.sin(t * 3) * 0.08; if (c.act && c.em) { acc += dt * T * 3; while (acc > 1) { acc--; c.spark(br, R(-0.2, 0.2), R(-0.1, 0.2), 0.3, T === 3 ? 0xffe27a : 0xffd23a, 0.8, 0.12, R(-0.3, 0.3), 0.4, R(-0.2, 0.4)); } } };
  },
  (T, g) => { // racing stripes + propeller cap
    const sc = pick(T, 0xffffff, 0xe5485a, GOLD);
    for (const x of [-0.1, 0.1]) P(g, 'box', sc, [x, 0.47, -0.1], [0.07, 0.04, 1.0], { e: T === 3 ? 0.5 : 0 });
    const cap = grp(g, 0, 0.12, 0.72); P(cap, 'cyl', pick(T, 0x2f9bd8, 0xe5485a, 0x7b4bd8), [0, 0, 0], [0.34, 0.14, 0.34]); P(cap, 'cyl', 0x2f3640, [0, 0.12, 0], [0.04, 0.12, 0.04]);
    const prop = grp(cap, 0, 0.2, 0); const pl = pick(T, 0.3, 0.38, 0.48);
    for (let i = 0; i < 2; i++) P(prop, 'box', pick(T, 0xffd23a, 0xff9a3a, GOLD), [0, 0, 0], [pl * 2, 0.025, 0.1], { r: [0, i * Math.PI / 2, 0], e: T === 3 ? 0.5 : 0 });
    let acc = 0, h = 0;
    return (t, dt, c) => { prop.rotation.y += dt * (14 + 12 * c.speed); if (T === 3 && c.act && c.em) { acc += dt * 14; while (acc > 1) { acc--; h = (h + 0.1) % 1; c.spark(g, R(-0.2, 0.2), 0.0, -0.9, new THREE.Color().setHSL(h, 1, 0.65).getHex(), 0.6, 0.14, 0, 0.1, -0.6); } } };
  },
  (T, g) => { // leg pollen baskets
    const s = pick(T, 0.9, 1.25, 1.65), ps = [];
    for (const x of [-1, 1]) { const b = P(g, 'sph', pick(T, 0xffd23a, 0xffb21e, 0xffa300), [0.42 * x, -0.3, -0.35], [0.22 * s, 0.26 * s, 0.3 * s], { e: T === 3 ? 0.5 : 0.1 }); ps.push(b); b.userData.s = [0.22 * s, 0.26 * s, 0.3 * s]; if (T === 3) P(g, 'sph', 0xfff0a0, [0.42 * x, -0.12, -0.35], [0.12, 0.12, 0.12], { e: 0.8 }); }
    return (t, dt, c) => { ps.forEach(b => b.scale.set(...b.userData.s.map(v => v * (0.75 + 0.35 * c.fill)))); };
  },
];

// ===== BUMBLEBEE =====
B.bumblebee = [
  (T, g) => { // fuzzy duster mitts
    const s = pick(T, 0.8, 1, 1.25), col = pick(T, 0xf2b8d0, 0xff6fb0, 0xff5bd0), mits = [];
    for (const x of [-1, 1]) { const m = grp(g, 0.6 * x, -0.15, 0.7); rod(m, 0x8a5a2c, [0, 0, 0], [0, 0, 0.7], 0.05); P(m, 'sph', col, [0, 0, 0.9], [0.4 * s, 0.4 * s, 0.6 * s], { e: T === 3 ? 0.45 : 0.1 }); if (T >= 2) { P(m, 'sph', 0xffffff, [0, 0.1, 1.05], [0.2, 0.2, 0.2], { e: 0.3 }); } mits.push(m); }
    let acc = 0;
    return (t, dt, c) => { mits.forEach((m, i) => { m.rotation.y = Math.sin(t * 5 + i * 3) * 0.3 * (i ? -1 : 1); m.rotation.x = Math.sin(t * 4 + i) * 0.1; }); if (T === 3 && c.act && c.em) { acc += dt * 6; while (acc > 1) { acc--; c.spark(mits[acc & 1 ? 0 : 1], 0, 0, 1, 0xffd2f0, 0.9, 0.14, R(-0.3, 0.3), 0.5, 0.2); } } };
  },
  (T, g) => { // turbo fan pack
    const col = pick(T, 0x8d949b, 0xe5485a, GOLD), s = pick(T, 0.55, 0.65, 0.78), fans = [];
    for (const x of T >= 2 ? [-0.26, 0.26] : [0]) { const hs = grp(g, x, 0.0, -0.85); P(hs, 'cyl', col, [0, 0, 0], [0.5 * s, 0.4, 0.5 * s], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.3 : 0 }); const f = grp(hs, 0, 0, -0.23); for (let i = 0; i < 3; i++) P(f, 'box', 0xdfe6ec, [0, 0, 0], [0.8 * s * 0.5, 0.03, 0.08], { r: [0, 0, i * 1.047], e: 0.1 }); fans.push(f); if (T === 3) P(hs, 'cone', 0x7fd8ff, [0, 0, -0.5], [0.22, 0.45, 0.22], { r: [-Math.PI / 2, 0, 0], g: 0.6 }); }
    let acc = 0;
    return (t, dt, c) => { fans.forEach(f => (f.rotation.z += dt * (12 + 25 * c.speed))); if (c.act && c.em && c.speed > 0.2) { acc += dt * 10 * T; while (acc > 1) { acc--; c.spark(g, R(-0.3, 0.3), R(-0.1, 0.1), -1.3, T === 3 ? 0x9fe7ff : 0xe9e2d0, 0.6, 0.16, 0, 0, -1.4); } } };
  },
  (T, g) => { // bucket
    const s = pick(T, 0.85, 1.1, 1.45), col = pick(T, 0x9aa3ad, 0xe5a43a, GOLD), bk = grp(g, 0, -0.62 - 0.1 * s, 0.0);
    P(bk, new THREE.CylinderGeometry(0.5, 0.36, 1, 8, 1, true), col, [0, 0, 0], [0.7 * s, 0.5 * s, 0.7 * s], { e: T === 3 ? 0.3 : 0 }); P(bk, 'cyl', col, [0, -0.25 * s, 0], [0.5 * s, 0.04, 0.5 * s]);
    const h = P(bk, 'tor', 0x6e4620, [0, 0.3 * s, 0], [0.7 * s, 0.7 * s, 0.7 * s]); h.scale.z = 0.2; h.rotation.y = Math.PI / 2;
    rod(g, 0x3a2a1a, [0.15, -0.3, 0.1], [0, -0.55 + 0.0, 0], 0.03); rod(g, 0x3a2a1a, [-0.15, -0.3, 0.1], [0, -0.55, 0], 0.03);
    const items = []; for (let i = 0; i < pick(T, 4, 6, 8); i++) items.push(P(bk, 'sph', i % 2 ? 0xffd23a : 0xffb21e, [(i % 3 - 1) * 0.18 * s, 0.22 * s + (i > 2 ? 0.1 : 0), ((i >> 1) % 2 - 0.5) * 0.25 * s], [0.2, 0.2, 0.2], { e: 0.3 }));
    return (t, dt, c) => { showN(items, c.fill); bk.rotation.z = Math.sin(t * 3) * 0.06 + Math.sin(t * 7) * 0.04 * c.speed; };
  },
];

// ===== BUTTERFLY =====
B.butterfly = [
  (T, g) => { // extendable sipping straw
    const L = pick(T, 0.9, 1.4, 1.9), pts = [], n = 10; for (let i = 0; i <= n; i++) { const u = i / n; pts.push([0, 0.0 - Math.sin(u * Math.PI * (T === 3 ? 2.2 : 1.1)) * 0.1 * (T === 3 ? 1.6 : 1), 0.65 + L * u]); }
    const strawG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 20, 0.04, 5, false);
    const col = pick(T, 0xdfe6ec, 0xff6fb0, GOLD), st = new THREE.Mesh(strawG, mat(col, T === 3 ? 0.4 : 0)); g.add(st);
    const stripe = new THREE.Mesh(strawG, mat(0xffffff, 0.1)); stripe.scale.setScalar(1.001); // fall back to flat
    for (let i = 1; i < n; i += 2) P(g, 'cyl', 0xffffff, [pts[i][0], pts[i][1], pts[i][2]], [0.095, 0.1, 0.095], { r: [Math.PI / 2, 0, 0] });
    const tip = P(g, 'sph', pick(T, 0xdfe6ec, 0xff3a8a, 0xfff2b0), [0, pts[n][1], pts[n][2]], [0.14, 0.14, 0.14], { e: T === 3 ? 1 : 0.2 });
    let acc = 0;
    return (t, dt, c) => { g.rotation.x = Math.sin(t * 2) * 0.03; if (c.act && c.em) { acc += dt * T * 2.5; while (acc > 1) { acc--; c.pull(g, R(-0.6, 0.6), R(-0.3, 0.4), pts[n][2] + R(0.5, 1.0), g, 0xffe6f2); } } };
  },
  (T, g) => { // silk scarf streamer
    const n = pick(T, 6, 9, 12), segs = [];
    P(g, 'cyl', pick(T, 0xdfe6ec, 0xff6fb0, 0xff5bd0), [0, 0.05, 0.4], [0.3, 0.14, 0.3]);
    for (let i = 0; i < n; i++) segs.push(P(g, 'box', T === 3 ? new THREE.Color().setHSL(i / n, 0.85, 0.65).getHex() : pick(T, 0xdfe6ec, i % 2 ? 0xff6fb0 : 0xffb0d0, 0), [0, 0, 0], [0.34 - i * 0.012, 0.03, 0.2], { e: T === 3 ? 0.35 : 0.05 }));
    return (t, dt, c) => { segs.forEach((m, i) => { const k = i + 1, a = Math.sin(t * 5 - k * 0.7) * (0.05 + 0.04 * c.speed) * k; m.position.set(a, 0.05 + Math.sin(t * 4 - k * 0.9) * 0.04 * k, 0.25 - 0.19 * k); m.rotation.y = Math.cos(t * 5 - k * 0.7) * 0.4; }); };
  },
  (T, g) => { // tote bag
    const s = pick(T, 0.8, 1.05, 1.35), col = pick(T, 0xd9c7a0, 0x4ec9c0, 0xb36bff), bg = grp(g, 0, -0.45, -0.1);
    P(bg, 'box', col, [0, 0, 0], [0.5 * s, 0.4 * s, 0.22 * s]); P(bg, 'box', pick(T, 0xb09a6a, 0x2f9b94, 0x7b4bd8), [0, 0.12 * s, 0.12 * s], [0.3 * s, 0.14 * s, 0.03]);
    const h = P(bg, 'tor', 0x6e4620, [0, 0.22 * s, 0], [0.34 * s, 0.34 * s, 0.34 * s]); h.scale.z = 0.3; h.rotation.y = Math.PI / 2;
    if (T === 3) P(bg, 'oct', GOLD, [0, -0.02, 0.13 * s], [0.14, 0.14, 0.04], { e: 0.8 });
    rod(g, 0x3a2a1a, [0, -0.2, 0.0], [0, 0.0, 0.0], 0.03);
    const items = []; for (let i = 0; i < 4; i++) items.push(P(bg, 'sph', [0xff5bd0, 0xffd23a, 0x7fe3ff, 0xff8f3a][i], [(i - 1.5) * 0.12 * s, 0.24 * s + 0.04, 0], [0.12, 0.12, 0.12], { e: 0.4 }));
    return (t, dt, c) => { showN(items, c.fill); bg.rotation.z = Math.sin(t * 3) * 0.05 + Math.sin(t * 7) * 0.05 * c.speed; };
  },
];

// ===== LUNA MOTH =====
B.moth = [
  (T, g) => { // headlamp with beam
    const s = pick(T, 0.8, 1.0, 1.3), col = pick(T, 0x8d949b, 0xe5485a, GOLD), h = grp(g, 0, 0.2, 0.85);
    P(h, 'cyl', col, [0, 0, 0.05], [0.26 * s, 0.26 * s, 0.26 * s], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.3 : 0 }); P(h, 'cyl', 0xfff6c0, [0, 0, 0.2 * s], [0.2 * s, 0.03, 0.2 * s], { r: [Math.PI / 2, 0, 0], e: 1 });
    const L = pick(T, 1.4, 2.1, 3.0), bm = P(h, 'cone', 0xfff0a0, [0, 0, 0.2 * s + L / 2], [0.3 * s + L * 0.45, L, 0.3 * s + L * 0.45], { r: [-Math.PI / 2, 0, 0], g: pick(T, 0.12, 0.18, 0.26) });
    return (t, dt, c) => { bm.material = bm.material; h.rotation.x = Math.sin(t * 1.5) * 0.06; };
  },
  (T, g) => { // cape
    const w = pick(T, 0.36, 0.44, 0.52), L = pick(T, 0.7, 0.9, 1.05), col = pick(T, 0xdd5555, 0x3a4fd8, 0x6a2fb0);
    const cp = grp(g, 0, 0.3, 0.3), geo = new THREE.PlaneGeometry(1, 1, 3, 4); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -0.5);
    const pos = geo.attributes.position, base = Float32Array.from(pos.array);
    const m = new THREE.Mesh(geo, mat(col, T === 3 ? 0.35 : 0.05)); m.scale.set(w, 1, L); cp.add(m);
    if (T >= 2) for (let i = 0; i < T * 2; i++) { const st = P(cp, 'oct', T === 3 ? 0xfff2b0 : 0xffffff, [(i % 3 - 1) * 0.2 * w, 0.02, -0.25 - i * 0.12 * L / 2], [0.1, 0.02, 0.1], { e: 0.9 }); }
    P(cp, 'sph', GOLD, [0.0, 0.0, 0.0], [0.14, 0.14, 0.14], { e: 0.5 });
    let acc = 0;
    return (t, dt, c) => { for (let i = 0; i < pos.count; i++) { const z = -base[i * 3 + 2]; pos.setY(i, Math.sin(t * 6 - z * 6) * 0.12 * z * (0.5 + c.speed)); } pos.needsUpdate = true; geo.computeVertexNormals(); cp.rotation.x = 0.1 + 0.1 * c.speed; if (T === 3 && c.act && c.em) { acc += dt * 8; while (acc > 1) { acc--; c.spark(cp, R(-w / 2, w / 2), 0, -R(0.3, L), 0xfff2b0, 0.9, 0.12, 0, 0.1, -0.2); } } };
  },
  (T, g) => { // lantern jar of fireflies
    const s = pick(T, 0.8, 1.0, 1.3), jr = grp(g, 0, -0.62 - 0.15 * s, 0.0);
    P(jr, 'cyl', 0xcfeaff, [0, 0, 0], [0.5 * s, 0.6 * s, 0.5 * s], { g: 0.28 }); P(jr, 'cyl', pick(T, 0x8d949b, 0xe5a43a, GOLD), [0, 0.32 * s, 0], [0.4 * s, 0.08, 0.4 * s], { e: T === 3 ? 0.3 : 0 }); P(jr, 'cyl', pick(T, 0x8d949b, 0xe5a43a, GOLD), [0, -0.31 * s, 0], [0.5 * s, 0.05, 0.5 * s]);
    rod(g, 0x3a2a1a, [0.1, -0.3, 0.0], [0, -0.55, 0], 0.03); rod(g, 0x3a2a1a, [-0.1, -0.3, 0], [0, -0.55, 0], 0.03);
    const items = []; for (let i = 0; i < pick(T, 4, 6, 9); i++) items.push(P(jr, 'sph', 0xfff6a0, [(i % 3 - 1) * 0.13 * s, (((i * 0.37) % 1) - 0.5) * 0.4 * s, ((i >> 1) % 3 - 1) * 0.1 * s], [0.08, 0.08, 0.08], { e: 1 }));
    P(jr, 'sph', 0xfff6a0, [0, 0, 0], [0.7 * s, 0.7 * s, 0.7 * s], { g: 0.12 });
    return (t, dt, c) => { showN(items, c.fill); items.forEach((m, i) => { m.position.y = (((i * 0.37) % 1) - 0.5) * 0.4 * s + Math.sin(t * 2 + i) * 0.05; m.scale.setScalar(0.08 * (0.8 + 0.4 * Math.sin(t * 5 + i * 2))); m.scale.multiplyScalar(1); m.scale.set(m.scale.x * 2, m.scale.x * 2, m.scale.x * 2); }); jr.rotation.z = Math.sin(t * 2.5) * 0.06 + Math.sin(t * 7) * 0.04 * c.speed; };
  },
];

// ===== HUMMINGBIRD =====
B.hummingbird = [
  (T, g) => { // longer beak tip
    const L = pick(T, 0.5, 0.9, 1.4), col = pick(T, 0x555a60, 0xff6fb0, GOLD);
    const tp = grp(g, 0, -0.02, 1.08); rod(tp, col, [0, 0, 0], [0, 0.0, L], 0.07, { e: T === 3 ? 0.5 : 0 }); P(tp, 'cone', col, [0, 0, L + 0.12], [0.07, 0.25, 0.07], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.9 : 0 });
    for (let i = 0; i < T * 2; i++) P(tp, 'cyl', 0xffffff, [0, 0, 0.1 + i * (L / (T * 2 + 1))], [0.1, 0.07, 0.1], { r: [Math.PI / 2, 0, 0] });
    let acc = 0;
    return (t, dt, c) => { if (c.act && c.em) { acc += dt * T * 2.5; while (acc > 1) { acc--; c.pull(tp, R(-0.5, 0.5), R(-0.3, 0.4), L + 0.4 + R(0, 0.6), tp, T === 3 ? 0xffe27a : 0xffe6f2); } } };
  },
  (T, g) => { // jetpack
    const col = pick(T, 0x8d949b, 0xe5485a, GOLD), s = pick(T, 0.7, 0.85, 1.0), fl = [];
    for (const x of T >= 2 ? [-0.2, 0.2] : [0]) { const j = grp(g, x, 0.1, -0.55); P(j, 'cyl', col, [0, 0, 0], [0.2 * s, 0.6 * s, 0.2 * s], { r: [Math.PI / 2, 0, 0], e: T === 3 ? 0.3 : 0 }); P(j, 'cone', 0xcfd6dd, [0, 0, 0.32 * s], [0.2 * s, 0.2, 0.2 * s], { r: [Math.PI / 2, 0, 0] }); const f = P(j, 'cone', T === 3 ? 0x7fd8ff : 0xffa23a, [0, 0, -0.5 * s], [0.18 * s, 0.4, 0.18 * s], { r: [-Math.PI / 2, 0, 0], g: 0.75 }); fl.push(f); }
    if (T === 1) P(g, 'box', 0x3a2a1a, [0, 0.26, -0.2], [0.04, 0.04, 0.6]);
    let acc = 0;
    return (t, dt, c) => { fl.forEach((f, i) => { const k = 0.7 + 0.5 * Math.sin(t * 40 + i) * 0.5 + 0.5 * c.speed; f.scale.set(f.scale.x, 0.35 * k + 0.12, f.scale.z); }); if (c.act && c.em) { acc += dt * (4 + 8 * c.speed) * T; while (acc > 1) { acc--; c.spark(g, R(-0.2, 0.2), 0.1, -1.0, T === 3 ? 0x9fe7ff : 0xffc27a, 0.6, 0.14, 0, -0.3, -1.0); } } };
  },
  (T, g) => { // nectar canteen
    const s = pick(T, 0.8, 1.05, 1.4), cn = grp(g, 0.4, -0.25, -0.1);
    P(cn, 'cyl', 0xcfeaff, [0, 0, 0], [0.26 * s, 0.4 * s, 0.26 * s], { g: 0.3 }); const liq = P(cn, 'cyl', pick(T, 0xff6fb0, 0xff9a3a, 0xff3a8a), [0, -0.03 * s, 0], [0.22 * s, 0.3 * s, 0.22 * s], { e: 0.4 });
    P(cn, 'cyl', pick(T, 0x8d949b, 0xe5a43a, GOLD), [0, 0.24 * s, 0], [0.14 * s, 0.1, 0.14 * s], { e: T === 3 ? 0.3 : 0 });
    rod(g, 0x3a2a1a, [-0.3, 0.3, -0.1], [0.4, -0.05, -0.1], 0.04); rod(g, 0x3a2a1a, [0.4, -0.05, -0.1], [0.4, -0.05 + 0.0, -0.1], 0.04);
    return (t, dt, c) => { liq.scale.y = 0.3 * s * (0.2 + 0.8 * c.fill) + 0.02; liq.position.y = -0.18 * s + liq.scale.y / 2; cn.rotation.z = Math.sin(t * 4) * 0.06; };
  },
];

// ===== FRUIT BAT =====
B.bat = [
  (T, g) => { // sonar headset
    const s = pick(T, 0.7, 0.85, 1.0), col = pick(T, 0x8d949b, 0x2f9bd8, GOLD), h = grp(g, 0, 0.35, 0.9);
    const band = P(h, 'tor', col, [0, 0.0, 0], [1.0 * s, 1.0 * s, 1.0 * s], { r: [0, Math.PI / 2, 0], e: T === 3 ? 0.35 : 0 }); band.scale.set(1.0 * s, 1.0 * s, 0.25);
    for (const x of [-1, 1]) P(h, 'cyl', pick(T, 0x2f3640, 0xe5485a, 0x2f3640), [0.5 * s * x, -0.05, 0], [0.34 * s, 0.14, 0.34 * s], { r: [0, 0, Math.PI / 2], e: T >= 2 ? 0.3 : 0 });
    if (T >= 2) rod(h, col, [0.5 * s, -0.05, 0.1], [0.55 * s, -0.3, 0.55], 0.04);
    if (T === 3) { const dish = P(h, 'cone', GOLD, [0, 0.5 * s, 0.1], [0.34, 0.16, 0.34], { r: [0, 0, 0], e: 0.5 }); dish.rotation.x = 0.3; P(h, 'sph', 0x7fe3ff, [0, 0.58 * s, 0.14], [0.08, 0.08, 0.08], { e: 1 }); }
    const rings = []; for (let i = 0; i < 3; i++) { const r = P(h, 'tor', 0x9fe7ff, [0, 0, 0.7], [1, 1, 1], { g: 0.6 }); r.material = r.material.clone(); rings.push(r); }
    return (t, dt, c) => { rings.forEach((r, i) => { const k = (t * 0.9 + i / 3) % 1; r.visible = i < T; r.position.z = 0.7 + k * 1.8; r.scale.setScalar(0.25 + k * 1.1 * s); r.material.opacity = 0.55 * (1 - k); r.material = r.material; }); };
  },
  (T, g) => { // flight helmet + racing stripes
    const col = pick(T, 0xdfe3e8, 0xe5485a, GOLD), hm = grp(g, 0, 0.35, 0.8);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(col, T === 3 ? 0.35 : 0.05)); hm.add(dome); dome.position.y = -0.1;
    P(hm, 'box', 0x2f3640, [0, 0.1, 0.38], [0.54, 0.13, 0.16], { e: 0.2 }); if (T >= 2) P(hm, 'box', 0xffffff, [0, 0.38, 0.0], [0.08, 0.04, 0.76]);
    for (const x of [-0.14, 0.14]) P(g, 'box', col, [x, 0.55, -0.3], [0.06, 0.04, 1.1], { e: T === 3 ? 0.5 : 0 }); if (T >= 2) for (const x of [-0.38, 0.38]) P(g, 'box', 0xffffff, [x, 0.4, -0.3], [0.05, 0.04, 1.0]);
    const fins = []; if (T === 3) for (const x of [-1, 1]) fins.push(P(g, 'tri', 0x7fe3ff, [0.3 * x, 0.2, -0.8], [0.08, 0.45, 0.45], { r: [Math.PI / 2, 0, x * 0.5], g: 0.6 }));
    let acc = 0;
    return (t, dt, c) => { fins.forEach((f, i) => (f.scale.y = 0.6 + 0.2 * Math.sin(t * 20 + i))); if (T >= 2 && c.act && c.em && c.speed > 0.2) { acc += dt * 12; while (acc > 1) { acc--; c.spark(g, R(-0.3, 0.3), 0.1, -1.1, T === 3 ? 0x9fe7ff : 0xe9e2d0, 0.6, 0.18, 0, 0, -1.2); } } };
  },
  (T, g) => { // fruit sling bag
    const s = pick(T, 0.65, 0.85, 1.05), bg = grp(g, 0, -0.85, 0.3), col = pick(T, 0xc99a5b, 0x4ec96a, 0xb36bff);
    P(bg, 'sph', col, [0, 0, 0], [0.8 * s, 0.6 * s, 0.7 * s]); P(bg, 'box', pick(T, 0x8a5a2c, 0x2d6b37, 0x5a35b0), [0, 0.26 * s, 0.0], [0.8 * s, 0.08, 0.7 * s]);
    rod(g, 0x3a2a1a, [-0.6, 0.6, 0.0], [0.1, -0.7, 0.3], 0.07); rod(g, 0x3a2a1a, [0.6, 0.6, 0.0], [-0.1, -0.7, 0.3], 0.07);
    const items = [], cols = [0xff5b5b, 0xffd23a, 0x7ed957, 0xff8f3a, 0xb36bff]; for (let i = 0; i < pick(T, 3, 5, 8); i++) items.push(P(bg, 'sph', cols[i % 5], [(i % 3 - 1) * 0.22 * s, 0.34 * s + (i > 2 ? 0.14 : 0), ((i >> 1) % 2 - 0.5) * 0.3], [0.26, 0.26, 0.26]));
    return (t, dt, c) => { showN(items, c.fill); bg.rotation.z = Math.sin(t * 3) * 0.05 + Math.sin(t * 8) * 0.05 * c.speed; };
  },
];

// ---------- particles (shared pool) ----------
function makeFx(scene) {
  const N = 90, geo = new THREE.OctahedronGeometry(0.5), m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, m, N); mesh.frustumCulled = false; mesh.count = N; mesh.renderOrder = 5; scene.add(mesh);
  const ps = [], col = new THREE.Color(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
  for (let i = 0; i < N; i++) { ps.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0, col: 0, tgt: null, spd: 0 }); mesh.setColorAt(i, col.set(0)); M.makeScale(0, 0, 0); mesh.setMatrixAt(i, M); }
  let ix = 0;
  const get = () => { const p = ps[ix]; ix = (ix + 1) % N; return p; };
  const api = {
    spark(obj, lx, ly, lz, color, life, size, vx = 0, vy = 0, vz = 0) {
      const p = get(); p.pos.set(lx, ly, lz); obj.localToWorld(p.pos); p.vel.set(vx, vy, vz).applyQuaternion(obj.getWorldQuaternion(q)); p.life = p.max = life; p.size = size; p.col = color; p.tgt = null; p.dirty = true;
    },
    pull(obj, lx, ly, lz, target, color) {
      const p = get(); p.pos.set(lx, ly, lz); obj.localToWorld(p.pos); p.vel.set(0, 0, 0); p.life = p.max = 0.6; p.size = 0.16; p.col = color; p.tgt = target; p.spd = 6; p.dirty = true;
    },
    update(dt) {
      let any = false;
      for (let i = 0; i < N; i++) {
        const p = ps[i]; if (p.life <= 0) { if (p.dirty === false) continue; p.dirty = false; M.makeScale(0, 0, 0); mesh.setMatrixAt(i, M); any = true; continue; }
        p.life -= dt; const u = Math.max(0, p.life / p.max);
        if (p.tgt) { p.tgt.getWorldPosition(V); p.pos.lerp(V, Math.min(1, dt * p.spd)); if (p.pos.distanceTo(V) < 0.15) p.life = 0; } else { p.pos.addScaledVector(p.vel, dt); p.vel.y += 0.3 * dt; }
        S.setScalar(p.size * (0.4 + u * 0.8)); M.compose(p.pos, q.identity(), S); mesh.setMatrixAt(i, M); mesh.setColorAt(i, col.set(p.col)); any = true; p.dirty = true;
      }
      if (any) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    },
  };
  return api;
}

// ---------- controller ----------
export function createGear(scene, riders) {
  const fx = makeFx(scene), state = {}, cache = new Map(), ctxs = {};
  const bodyOf = id => riders[id].userData.body;
  function build(id, si, T) {
    const k = id + si + T; let e = cache.get(k);
    if (!e) { const g = new THREE.Group(); g.name = `gear-${id}-${SLOTS[si]}-${T}`; const upd = B[id][si](T, g); e = { g, upd }; cache.set(k, e); }
    return e;
  }
  function set(id, tiers) {
    const st = state[id] || (state[id] = { cur: [0, 0, 0], ents: [null, null, null] });
    for (let i = 0; i < 3; i++) {
      const T = tiers[i] | 0; if (st.cur[i] === T && st.ents[i] !== undefined && (T === 0) === !st.ents[i]) continue;
      if (st.ents[i]) bodyOf(id).remove(st.ents[i].g);
      st.cur[i] = T; st.ents[i] = T ? build(id, i, T) : null; if (st.ents[i]) bodyOf(id).add(st.ents[i].g);
    }
  }
  const c = { t: 0, speed: 0, fill: 0, act: false, em: true, spark: (...a) => fx.spark(...a), pull: (...a) => fx.pull(...a) };
  function update(dt, t, curId, speed01, fill) {
    fx.update(dt);
    for (const id in state) {
      const st = state[id], on = id === curId; if (!riders[id].visible && !on) continue;
      c.speed = on ? speed01 : 0; c.fill = on ? fill : 0.5; c.act = on; c.em = on;
      for (const e of st.ents) if (e && e.upd) e.upd(t, dt, c);
    }
  }
  function burst(id, color = 0xffe27a) {
    const b = bodyOf(id); for (let i = 0; i < 36; i++) fx.spark(b, R(-0.8, 0.8), R(0.1, 1.2), R(-0.8, 0.8), i % 3 ? color : 0xffffff, R(0.7, 1.3), R(0.15, 0.32), R(-1.5, 1.5), R(0.5, 2.6), R(-1.5, 1.5));
  }
  return { set, update, burst, fx };
}
