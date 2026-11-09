// Valley zones — ground-up maps: each level has its own heightfield + carved water
// + collision, not props on the shared meadow. Fern Nov 5 block-outs; multi-route.
import * as THREE from 'three';
import { WATER_RECTS, WATER_Y } from './data.js';
import { setZoneHeight } from './world.js';

export const SIZE = { bee: 'tiny', butterfly: 'tiny', hummingbird: 'tiny', moth: 'tiny', bat: 'tiny', bumblebee: 'medium', robin: 'medium', raccoon: 'medium', opossum: 'medium', bear: 'bear' };
export const FLYERS = new Set(['bee', 'butterfly', 'hummingbird', 'moth', 'bat', 'bumblebee', 'robin']);
const NEED = { team: { tiny: 3, medium: 2, bear: 1 }, heavy: { tiny: 5, medium: 3, bear: 1 }, heaviest: { tiny: 5, medium: 3, bear: 2 } };
const TIER = {
  petal: { name: 'Petal', em: '🌸', col: 0xff8fc8, heal: 0.012, geo: () => new THREE.OctahedronGeometry(0.55) },
  dew: { name: 'Dewdrop', em: '💧', col: 0x7fd8ff, heal: 0.025, geo: () => new THREE.SphereGeometry(0.5, 12, 10) },
  star: { name: 'Starseed', em: '⭐', col: 0xffe066, heal: 0.15, geo: () => new THREE.IcosahedronGeometry(0.7) },
};
const NODE = { team: { name: 'Honey Log', tier: 'petal', amt: 6 }, heavy: { name: 'Dew Pond', tier: 'dew', amt: 4 }, heaviest: { name: 'Starheart', tier: 'star', amt: 1 } };

// Page 800×500 → local units. Home ≈ (0,0); +z = page-north.
const S = 0.06;
const px = (x, homeX = 400) => (x - homeX) * S;
const pz = (y, homeY) => (homeY - y) * S;

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };
const insidePoly = (x, z, poly) => {
  let n = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-9) + xi)) n++;
  }
  return (n & 1) === 1;
};
const distPoly = (x, z, poly) => {
  let best = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const x1 = poly[j][0], z1 = poly[j][1], x2 = poly[i][0], z2 = poly[i][1];
    const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
    let t = ((x - x1) * dx + (z - z1) * dz) / l2; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t)));
  }
  return insidePoly(x, z, poly) ? -best : best;
};
const octagon = (cx, cz, rx, rz) => {
  const o = [];
  for (let i = 0; i < 8; i++) { const t = (Math.PI / 4) * i + Math.PI / 8; o.push([cx + rx * Math.cos(t), cz + rz * Math.sin(t)]); }
  return o;
};

// ---- shared map recipes (local lx,lz) ------------------------------------
function sunnyTerrain(lx, lz) {
  const poly = octagon(0, pz(280, 410), 22.0, 16.5);
  const d = distPoly(lx, lz, poly);
  if (d > 2.5) return null;
  let h = 0.35;
  if (d > 0) h = 0.35 - d * 1.8; // soft rim drop outside silhouette
  // three flower mounds
  const mounds = [[px(150), pz(220, 410), 2.6, 1.15], [px(560), pz(220, 410), 2.6, 1.15], [px(300), pz(300, 410), 2.2, 1.0]];
  for (const [mx, mz, r, mh] of mounds) {
    const dd = Math.hypot(lx - mx, lz - mz);
    if (dd < r) h += mh * (1 - dd / r) * (1 - dd / r);
  }
  // gentle sunbeam path dip
  const pathR = Math.hypot(lx / 13.2, (lz - pz(260, 410)) / 8.4);
  if (pathR < 1) h += 0.08;
  return Math.max(h, -0.2);
}

function creekTerrain(lx, lz) {
  // Playable rectangle around U creek
  if (Math.abs(lx) > 26 || lz < -16 || lz > 18) return null;
  let h = 0.4;
  // U creek polygon (faceted) in local space — carved below WATER_Y relative
  const U_outer = [[120, 0], [135, 180], [170, 320], [260, 420], [400, 460], [540, 420], [630, 320], [665, 180], [680, 0], [615, 0], [600, 170], [570, 290], [500, 370], [400, 400], [300, 370], [230, 290], [200, 170], [185, 0]].map(([x, y]) => [px(x), pz(y, 230)]);
  const dw = distPoly(lx, lz, U_outer);
  if (dw < 0) h = -2.4; // deep carved channel
  else if (dw < 1.2) h = -2.4 + (dw / 1.2) * 2.8; // bank slope
  // pebble point plateau
  if (Math.hypot(lx, lz) < 6) h = Math.max(h, 0.55);
  // east terraces (Banks 1–3)
  const banks = [
    [px(690), pz(340, 230), 5.8, 6.0, 1.2],
    [px(700), pz(230, 230), 5.2, 5.5, 2.5],
    [px(710), pz(110, 230), 4.7, 5.5, 4.0],
  ];
  for (const [bx, bz, hw, hd, bh] of banks) {
    if (Math.abs(lx - bx) < hw / 2 && Math.abs(lz - bz) < hd / 2) h = Math.max(h, bh);
  }
  return h;
}

function moonTerrain(lx, lz) {
  if (Math.abs(lx) > 24 || lz < -14 || lz > 20) return null;
  let h = 0.3;
  // slight bowl toward hollow oak center
  const cx = 0, cz = pz(280, 440);
  const d = Math.hypot(lx - cx, lz - cz);
  h += 0.15 * Math.cos(Math.min(d, 18) / 18 * Math.PI);
  // firefly spiral raised path (ring bumps)
  const spiral = [[620, 440], [520, 430], [250, 400], [220, 300], [260, 170], [400, 140], [540, 170], [560, 280], [500, 330]];
  spiral.forEach(([x, y], i) => {
    const sx = px(x), sz = pz(y, 440), sh = 0.35 + i * 0.85;
    const dd = Math.hypot(lx - sx, lz - sz);
    if (dd < 1.6) h = Math.max(h, sh * (1 - dd / 1.6));
  });
  // root tunnel depression (walker shortcut south of oak)
  const tx = 0, tz = pz(400, 440);
  if (Math.hypot(lx - tx, lz - tz) < 2.2) h = Math.min(h, -0.4);
  return h;
}

function logJamTerrain(lx, lz) {
  // narrow N-S canyon
  if (Math.abs(lx) > 18 || lz < -16 || lz > 20) return null;
  let h = 0.25;
  // high side walls
  if (lx < -8 || lx > 8) h = 5.5;
  else if (Math.abs(lx) > 6.5) h = 0.25 + (Math.abs(lx) - 6.5) * 3.5;
  // jam shelves as raised floor bands
  const jams = [[pz(370, 455), 1.0], [pz(250, 455), 2.2], [pz(120, 455), 3.6]];
  for (const [jz, jh] of jams) {
    if (Math.abs(lz - jz) < 2.2 && Math.abs(lx) < 7) h = Math.max(h, jh);
  }
  return h;
}

function picnicTerrain(lx, lz) {
  if (lx < -28 || lx > 46 || lz < -30 || lz > 20) return null;
  let h = 0.3;
  // lemonade stream diagonal carve
  const stream = [[0, 470], [150, 430], [300, 400], [450, 330], [560, 250], [680, 140], [800, 60], [800, 110], [700, 180], [590, 285], [480, 370], [320, 445], [170, 480], [40, 500], [0, 500]].map(([x, y]) => [px(x, 70), pz(y, 60)]);
  // home is NW at page (70,60) — remap with home (70,60)
  // Wait: picnic home is NW. Our coords use home at 0,0 with homeX/Y of that map.
  // Using HY=60, HX=70 for picnic.
  const dw = distPoly(lx, lz, stream);
  if (dw < 0) h = -2.2;
  else if (dw < 1.0) h = -2.2 + dw * 2.5;
  // blanket flat pads
  const blankets = [[120, 120], [320, 120], [120, 280], [320, 280]];
  for (const [bx, by] of blankets) {
    const x0 = px(bx, 70), z0 = pz(by + 110, 60), x1 = px(bx + 160, 70), z1 = pz(by, 60);
    const minx = Math.min(x0, x1), maxx = Math.max(x0, x1), minz = Math.min(z0, z1), maxz = Math.max(z0, z1);
    if (lx >= minx && lx <= maxx && lz >= minz && lz <= maxz) h = Math.max(h, 0.45);
  }
  return h;
}

function cliffTerrain(lx, lz) {
  if (Math.abs(lx) > 26 || lz < -16 || lz > 20) return null;
  // largest → smallest so inner floors overwrite outer cliff shelves
  const rings = [
    [octagon(0, pz(270, 330), 24.0, 14.4), 6.2],
    [octagon(0, pz(285, 330), 19.2, 11.4), 4.6],
    [octagon(0, pz(300, 330), 14.4, 8.4), 3.0],
    [octagon(0, pz(315, 330), 9.6, 5.4), 1.6],
    [octagon(0, pz(325, 330), 5.4, 3.0), 0.4],
  ];
  let h = -0.5;
  for (const [poly, hh] of rings) {
    if (insidePoly(lx, lz, poly)) h = hh;
  }
  // waterfall channel north
  const fall = [[385, 30], [415, 30], [415, 180], [455, 200], [440, 225], [360, 225], [345, 200], [385, 180]].map(([x, y]) => [px(x), pz(y, 330)]);
  const dw = distPoly(lx, lz, fall);
  if (dw < 0) h = -2.3;
  else if (dw < 0.9) h = Math.min(h, -2.3 + dw * 3);
  return h;
}

function windyTerrain(lx, lz) {
  // home at (60,440)
  const HX = 60, HY = 440;
  const X = (x) => px(x, HX), Z = (y) => pz(y, HY);
  if (lx < -8 || lx > 52 || lz < -12 || lz > 26) return null;
  let h = 0.25;
  // three terraces stepping east
  const terrs = [
    [200, 330, 190, 170, 1.2],
    [410, 250, 190, 250, 2.6],
    [620, 160, 180, 340, 4.2],
  ];
  for (const [x, y, w, d, th] of terrs) {
    const x0 = X(x), z0 = Z(y + d), x1 = X(x + w), z1 = Z(y);
    const minx = Math.min(x0, x1), maxx = Math.max(x0, x1), minz = Math.min(z0, z1), maxz = Math.max(z0, z1);
    if (lx >= minx && lx <= maxx && lz >= minz && lz <= maxz) h = Math.max(h, th);
  }
  // gusty gullies (water)
  for (const [x0p, y0, x1p, y1] of [[185, 500, 205, 330], [395, 500, 415, 250]]) {
    const ax = X((x0p + x1p) / 2), az = Z((y0 + y1) / 2);
    const hw = Math.abs(X(x1p) - X(x0p)) / 2 + 0.4, hd = Math.abs(Z(y1) - Z(y0)) / 2 + 0.4;
    if (Math.abs(lx - ax) < hw && Math.abs(lz - az) < hd) h = -2.2;
  }
  return h;
}

function festivalTerrain(lx, lz) {
  if (Math.abs(lx) > 26 || lz < -16 || lz > 20) return null;
  let h = 0.35;
  // Ribbon Creek ring (donut)
  const outer = octagon(0, pz(260, 460), 20.4, 13.2);
  const inner = octagon(0, pz(260, 460), 18.0, 11.4);
  const dout = distPoly(lx, lz, outer), din = distPoly(lx, lz, inner);
  if (dout < 0 && din > 0) h = -2.3; // in the ring water
  else if (Math.abs(dout) < 0.9 || Math.abs(din) < 0.9) h = Math.min(h, -0.4);
  // lookout knoll caps (center spiral)
  const caps = [[7.2, 1.2, pz(280, 460)], [5.4, 2.6, pz(260, 460)], [3.6, 4.2, pz(240, 460)], [2.2, 5.8, pz(220, 460)]];
  for (const [r, ch, cz] of caps) {
    if (Math.hypot(lx, lz - cz) < r) h = Math.max(h, ch);
  }
  // district pads
  if (lx < -8 && lz > 4) h = Math.max(h, 1.5); // timber NW
  if (lx > 8 && lz > 6) h = Math.max(h, 2.2); // cliff seats NE
  if (lx < -6 && lz < -2) h = Math.max(h, 1.0); // picnic SW
  return h;
}

const MAPS = {
  sunny_hollow: {
    goal: 'Deliver 20 Petals, hire 1 helper, build 1 T1',
    pick: 20, key: 'pick', pickTier: 'petal',
    terrain: sunnyTerrain,
    waterFromTerrain: false,
    bounds: { x0: -24, x1: 24, z0: -16, z1: 18 },
    build(B) {
      const HY = 410;
      for (let i = 0; i < 16; i++) {
        if (i === 4 || i === 12) continue;
        const t = (Math.PI * 2 / 16) * i;
        B.tree(Math.cos(t) * 20, Math.sin(t) * 13.5 + pz(250, HY), 0.95 + (i % 3) * 0.08);
      }
      B.sunflower(0, pz(110, HY));
      B.home(0, 0);
      B.buildRing(px(330), 0.6); B.buildRing(px(470), 0.6); B.buildRing(0, pz(360, HY));
      B.glade(px(650), pz(90, HY), 0xffe08a);
      const patches = [[195, 230, 2], [605, 230, 2], [340, 305, 2], [470, 330, 2], [260, 150, 3], [540, 150, 3], [370, 130, 3], [430, 130, 3]];
      for (const [x, y, n] of patches) {
        for (let i = 0; i < n; i++) {
          const a = i / n * 6.28, r = 0.55 + i * 0.15;
          B.pickup('petal', px(x) + Math.cos(a) * r, pz(y, HY) + Math.sin(a) * r, 0.9 + (y < 200 ? 0.3 : 0));
        }
      }
      B.pickup('petal', px(150), pz(220, HY), 2.4);
      B.pickup('petal', px(560), pz(220, HY), 2.4);
    },
  },

  creek_bend: {
    goal: 'Cross the creek, lift the Honey Log, gather 10 Petals',
    key: 'multi', needNodes: 1, needBuilds: 1,
    terrain: creekTerrain,
    waterFromTerrain: true,
    bounds: { x0: -26, x1: 26, z0: -16, z1: 18 },
    build(B) {
      const HY = 230;
      // water visuals from carved channel + WATER_RECTS samples
      B.paintWaterFromTerrain();
      // east terrace props (visual lips)
      [[690, 340, 1.2], [700, 230, 2.5], [710, 110, 4.0]].forEach(([x, y, h]) => {
        B.pickup('petal', px(x) - 1.2, pz(y, HY), 0.8);
        B.pickup('petal', px(x) + 1.0, pz(y, HY) - 0.5, 0.8);
      });
      B.tree(px(755), pz(150, HY), 1.45);
      B.tree(px(30), pz(60, HY), 1.0); B.tree(px(70), pz(420, HY), 1.0);
      B.tree(px(300), pz(120, HY), 0.9); B.tree(px(500), pz(120, HY), 0.9);
      // Walker fords / bridge (buildable) — flyers go over water freely
      B.builder('Stepping-Log Ford', ['bear', 'opossum'], px(640), pz(360, HY), [
        [px(620), pz(370, HY), 0.7, 1.1], [px(645), pz(350, HY), 1.4, 1.0], [px(670), pz(335, HY), 2.0, 1.0],
      ]);
      B.builder('Plank Bridge', ['opossum', 'bear'], 0, pz(430, HY), [
        [px(370), pz(440, HY), 0.6, 1.0], [0, pz(450, HY), 0.6, 1.2], [px(430), pz(440, HY), 0.6, 1.0],
      ]);
      // Permanent stepping stones partial ford (tiny walker progress without build)
      B.box(px(600), pz(380, HY), 1.2, 1.0, 0.55, 0x8b6a45, 0.55);
      B.box(px(615), pz(365, HY), 1.2, 1.0, 0.55, 0x8b6a45, 0.55);
      B.home(0, 0);
      B.buildRing(0, pz(430, HY)); B.buildRing(px(470), pz(280, HY));
      B.node('team', px(715), pz(180, HY), 0.4);
      B.glade(px(70), pz(220, HY), 0xa8d88a);
      [[330, 260], [470, 200], [735, 400], [760, 280], [250, 480], [550, 480], [60, 330]].forEach(([x, y], i) => {
        B.pickup('petal', px(x), pz(y, HY), 0.85);
        if (i < 3) B.pickup('petal', px(x) + 0.7, pz(y, HY) + 0.4, 0.85);
      });
    },
  },

  moon_meadow: {
    goal: 'Collect 12 Dewdrops, lift the Dew Pond',
    night: true, nightCycle: 180, dewWindow: 8,
    key: 'pick', pick: 12, pickTier: 'dew',
    terrain: moonTerrain,
    waterFromTerrain: false,
    bounds: { x0: -24, x1: 24, z0: -14, z1: 20 },
    build(B) {
      const HY = 440, cx = 0, cz = pz(280, HY);
      B.hollowOak(cx, cz);
      // walker spiral platforms (explicit solids matching terrain bumps)
      const spiral = [[620, 440], [520, 430], [250, 400], [220, 300], [260, 170], [400, 140], [540, 170], [560, 280], [500, 330]];
      spiral.forEach(([x, y], i) => {
        const h = 0.4 + i * 0.85;
        B.box(px(x), pz(y, HY), 2.2, 2.2, h, 0x6b8f4e, 0.35);
      });
      // root tunnel: short covered walk for opossum / walkers
      B.box(0, pz(400, HY), 2.4, 4.5, 0.2, 0x4a3420, 1.6);
      B.home(px(640), pz(440, HY));
      B.buildRing(px(560), pz(300, HY)); B.buildRing(px(250), pz(240, HY));
      B.node('heavy', 0, pz(400, HY), 0.2);
      B.glade(px(90), pz(230, HY), 0xc9b6ff);
      B.cocoon(px(60), pz(300, HY)); B.cocoon(px(120), pz(310, HY));
      // night dew at windows + day petal alternative so level is finishable by day animals waiting / using petals for heal while waiting
      B.nightDew(px(470), pz(230, HY), 5.5); B.nightDew(px(330), pz(230, HY), 5.5);
      B.nightDew(px(400), pz(150, HY), 9.5); B.nightDew(px(430), pz(150, HY), 9.5);
      // day-safe dew near roots (always on) so non-night crews can progress without soft-lock
      B.pickup('dew', px(360), pz(380, HY), 0.9);
      B.pickup('dew', px(440), pz(380, HY), 0.9);
      B.pickup('dew', px(400), pz(360, HY), 0.9);
      B.pickup('dew', px(380), pz(420, HY), 0.9);
      [[700, 300], [600, 200], [180, 420], [260, 460], [720, 380]].forEach(([x, y]) => B.pickup('petal', px(x), pz(y, HY), 0.9));
    },
  },

  log_jam: {
    goal: 'Clear 3 jams, finish 3 team picks',
    key: 'multi', needNodes: 3, needBuilds: 0,
    terrain: logJamTerrain,
    waterFromTerrain: false,
    bounds: { x0: -18, x1: 18, z0: -16, z1: 20 },
    build(B) {
      const HY = 455;
      B.logStack(0, pz(370, HY), 2, 0.6);
      B.logStack(0, pz(250, HY), 3, 1.4);
      B.logStack(0, pz(120, HY), 4, 2.4);
      // walker ramps / bear shove ghosts
      B.builder('West Ramp', ['bear', 'raccoon'], px(230, 400), pz(260, HY), [
        [px(230, 400), pz(270, HY), 1.0, 1.0], [px(250, 400), pz(240, HY), 1.8, 1.0], [px(270, 400), pz(210, HY), 2.6, 1.0],
      ]);
      B.builder('East Ramp', ['bear'], px(520, 400), pz(140, HY), [
        [px(500, 400), pz(160, HY), 1.2, 1.0], [px(530, 400), pz(120, HY), 2.4, 1.0], [px(550, 400), pz(90, HY), 3.4, 1.0],
      ]);
      // always-walkable side ledge for tiny/medium without waiting on bear
      B.box(-7.2, pz(300, HY), 1.6, 18, 1.8, 0x7a8a5a, 0.4);
      B.box(7.2, pz(300, HY), 1.6, 18, 1.8, 0x7a8a5a, 0.4);
      B.home(0, pz(455, HY));
      B.buildRing(px(330, 400), pz(430, HY)); B.buildRing(px(470, 400), pz(300, HY));
      B.node('team', px(600, 400), pz(330, HY), 0.4);
      B.node('team', px(190, 400), pz(200, HY), 0.4);
      B.node('team', px(610, 400), pz(80, HY), 0.4);
      B.node('heavy', 0, pz(60, HY), 0.4);
      B.cave(0, pz(10, HY));
      [[340, 320], [460, 320], [330, 190], [480, 190], [80, 220], [690, 260]].forEach(([x, y]) => B.pickup('petal', px(x, 400), pz(y, HY), 0.9));
    },
  },

  picnic_lawn: {
    goal: 'Finish 2 Dew Ponds and the table bunch',
    key: 'multi', needNodes: 3, needBuilds: 0,
    terrain: picnicTerrain,
    waterFromTerrain: true,
    homePage: [70, 60],
    bounds: { x0: -28, x1: 46, z0: -30, z1: 20 },
    build(B) {
      const HX = 70, HY = 60;
      const X = (x) => px(x, HX), Z = (y) => pz(y, HY);
      B.paintWaterFromTerrain();
      [[120, 120, 0xff8a8a], [320, 120, 0x8ab4ff], [120, 280, 0xffe08a], [320, 280, 0xc9b6ff]].forEach(([x, y, c]) => B.blanket(X(x), Z(y + 110), 160 * S, 110 * S, c));
      B.table(X(200), Z(160), 4.8, 2.4, 1.9);
      B.table(X(400), Z(320), 4.8, 2.4, 1.9);
      B.table(X(635), Z(150), 9.0, 3.6, 2.4);
      B.basket(X(340), Z(167), 1.4, 1.4); B.basket(X(150), Z(327), 1.4, 1.4); B.basket(X(685), Z(355), 2.8, 2.2);
      B.napkin(X(245), Z(190), X(280), Z(160), 0.5, 1.9);
      B.napkin(X(445), Z(345), X(480), Z(310), 0.5, 1.9);
      B.napkin(X(520), Z(200), X(560), Z(170), 0.5, 2.4);
      // ford stones across lemonade for walkers
      B.box(X(400), Z(360), 1.3, 1.1, 0.5, 0xc8b48a, 0.5);
      B.box(X(480), Z(320), 1.3, 1.1, 0.5, 0xc8b48a, 0.5);
      B.box(X(560), Z(270), 1.3, 1.1, 0.5, 0xc8b48a, 0.5);
      B.home(0, 0);
      B.buildRing(X(290), Z(255)); B.buildRing(X(500), Z(255));
      B.glade(X(690), Z(420), 0xd4b896);
      B.node('heavy', X(330), Z(420), 0.2);
      B.node('heavy', X(600), Z(230), 0.2);
      B.node('team', X(640), Z(135), 2.5);
      [[200, 155], [400, 315], [360, 160], [170, 320], [580, 140], [680, 140]].forEach(([x, y]) => B.pickup('petal', X(x), Z(y), y < 200 ? 2.5 : 0.9));
      B.tree(X(30), Z(230), 1.0); B.tree(X(760), Z(470), 1.0); B.tree(X(520), Z(470), 0.8); B.tree(X(300), Z(40), 0.9);
    },
  },

  cliff_orchard: {
    goal: 'Build the stair, night harvest, finish heavy picks',
    nightCycle: 180, dewWindow: 8,
    key: 'multi', needNodes: 3, needBuilds: 1,
    terrain: cliffTerrain,
    waterFromTerrain: true,
    bounds: { x0: -26, x1: 26, z0: -16, z1: 20 },
    build(B) {
      const HY = 330;
      B.paintWaterFromTerrain();
      // boulder stair (walker) + always-on partial switchbacks
      B.builder('Boulder Stair', ['bear'], px(250), pz(310, HY), [
        [px(270), pz(320, HY), 1.2, 1.2], [px(250), pz(300, HY), 2.2, 1.2], [px(230), pz(280, HY), 3.2, 1.2], [px(210), pz(255, HY), 4.4, 1.2],
      ]);
      B.box(px(280), pz(340, HY), 2.0, 1.6, 1.0, 0x8f8f8c, 0.5);
      B.box(px(260), pz(310, HY), 2.0, 1.6, 2.0, 0x8f8f8c, 0.5);
      B.box(px(240), pz(280, HY), 2.0, 1.6, 3.2, 0x8f8f8c, 0.5);
      B.home(0, pz(330, HY));
      B.buildRing(px(470), pz(350, HY)); B.buildRing(px(640), pz(160, HY));
      B.node('heavy', 0, pz(205, HY), 0.2);
      B.node('heavy', px(120), pz(70, HY), 0.4);
      B.node('heavy', px(660), pz(70, HY), 0.4);
      B.cave(px(600), pz(30, HY));
      B.nightDew(px(250), pz(50, HY), 6.5); B.nightDew(px(530), pz(55, HY), 6.5); B.nightDew(px(300), pz(40, HY), 6.5);
      // day dew alternative on lower ledge
      B.pickup('dew', px(350), pz(300, HY), 1.8);
      B.pickup('dew', px(450), pz(300, HY), 1.8);
      [[300, 380], [510, 380], [200, 300], [600, 300], [170, 190], [630, 190]].forEach(([x, y]) => B.pickup('petal', px(x), pz(y, HY), 0.9));
      B.tree(px(230), pz(380, HY), 0.8); B.tree(px(580), pz(380, HY), 0.8);
      B.tree(px(140), pz(230, HY), 0.9); B.tree(px(660), pz(230, HY), 0.9);
    },
  },

  windy_rise: {
    goal: 'Streamer chain and Fork Log lift',
    nightCycle: 180, dewWindow: 8,
    key: 'multi', needNodes: 2, needBuilds: 0,
    terrain: windyTerrain,
    waterFromTerrain: true,
    homePage: [60, 440],
    bounds: { x0: -8, x1: 52, z0: -12, z1: 26 },
    build(B) {
      const HX = 60, HY = 440;
      const X = (x) => px(x, HX), Z = (y) => pz(y, HY);
      B.paintWaterFromTerrain();
      // log stairs for walkers over gullies
      B.box(X(190), Z(420), 2.4, 1.4, 1.0, 0x8b6a45, 0.5);
      B.box(X(195), Z(400), 2.4, 1.4, 1.4, 0x8b6a45, 0.5);
      B.box(X(400), Z(340), 2.4, 1.4, 2.2, 0x8b6a45, 0.5);
      B.box(X(405), Z(310), 2.4, 1.4, 2.8, 0x8b6a45, 0.5);
      const trees = [[90, 250, 1.6], [230, 210, 1.6], [380, 180, 1.7], [540, 150, 1.6], [700, 120, 1.6]];
      trees.forEach(([x, y, s]) => B.tree(X(x), Z(y), s));
      B.bridge(X(90), Z(200), 11.5, X(230), Z(160), 11.5);
      B.bridge(X(230), Z(160), 11.5, X(380), Z(130), 11.5);
      B.bridge(X(380), Z(130), 11.5, X(540), Z(100), 11.5);
      B.bridge(X(540), Z(100), 11.5, X(700), Z(70), 11.5);
      B.silk(X(90), Z(200), 12.2, X(380), Z(130), 12.2);
      B.silk(X(380), Z(130), 12.2, X(700), Z(70), 12.2);
      [[160, 170], [305, 140], [460, 110], [620, 80]].forEach(([x, y]) => B.hoop(X(x), Z(y), 12.0));
      B.home(0, 0);
      B.buildRing(X(300), Z(380)); B.buildRing(X(520), Z(300));
      B.node('team', X(380), Z(95), 0.5);
      B.node('heavy', X(300), Z(470), 0.2);
      B.glade(X(720), Z(280), 0xe8dff5);
      [[160, 200], [460, 140], [620, 110], [520, 400], [700, 420], [120, 350]].forEach(([x, y]) => B.pickup('petal', X(x), Z(y), y < 200 ? 4.5 : 0.9));
    },
  },

  festival_glade: {
    goal: 'Bring the Starheart home and Pack Up',
    nightCycle: 180, dewWindow: 8,
    key: 'star',
    terrain: festivalTerrain,
    waterFromTerrain: true,
    bounds: { x0: -26, x1: 26, z0: -16, z1: 20 },
    build(B) {
      const HY = 460;
      const X = (x) => px(x), Z = (y) => pz(y, HY);
      B.paintWaterFromTerrain();
      // bridges across ribbon creek (walker) — two permanent spans
      B.box(X(400), Z(420), 2.2, 3.5, 0.55, 0xc69c6d, 0.55);
      B.box(X(260), Z(300), 3.5, 2.0, 0.55, 0xc69c6d, 0.55);
      B.box(X(540), Z(300), 3.5, 2.0, 0.55, 0xc69c6d, 0.55);
      // timber stage + cliff seats + picnic + lanterns
      B.logStack(X(150), Z(120), 2, 0.8);
      B.box(X(595), Z(110), 6.0, 2.2, 1.4, 0x8f8f8c);
      B.box(X(602), Z(75), 5.2, 1.7, 2.6, 0x858582);
      B.table(X(140), Z(350), 3.8, 1.9, 2.4);
      B.basket(X(230), Z(380), 1.6, 1.4);
      B.lantern(X(560), Z(360)); B.lantern(X(600), Z(330)); B.lantern(X(640), Z(300));
      B.tree(X(120), Z(280), 1.3); B.tree(X(680), Z(280), 1.3);
      B.tree(X(260), Z(210), 1.0); B.tree(X(540), Z(210), 1.0);
      B.bridge(X(120), Z(280), 11.5, X(260), Z(210), 11.5);
      B.bridge(X(540), Z(210), 11.5, X(680), Z(280), 11.5);
      B.home(0, 0);
      B.buildRing(X(330), Z(440)); B.buildRing(X(470), Z(440));
      B.node('heavy', X(90), Z(400), 0);
      B.node('heavy', X(640), Z(400), 0);
      B.node('team', X(200), Z(90), 1.5);
      B.starheart(0, Z(200), 6.0, [[0, Z(230), 4.2], [0, Z(250), 2.6], [0, Z(270), 1.2], [0, 2, 0.4]]);
      B.glade(X(60), Z(40), 0xffe08a); B.glade(X(740), Z(40), 0xffe08a);
      B.glade(X(30), Z(230), 0xc9b6ff); B.glade(X(770), Z(230), 0xa8d88a);
      B.nightDew(X(350), Z(250), 5.0); B.nightDew(X(450), Z(250), 5.0);
      B.pickup('dew', X(380), Z(400), 0.9); B.pickup('dew', X(420), Z(400), 0.9);
      [[180, 340], [600, 100], [350, 250], [450, 250], [220, 160]].forEach(([x, y]) => B.pickup('petal', X(x), Z(y), y < 200 ? 2.0 : 0.9));
    },
  },
};

export function createZones(scene, ctx) {
  const group = new THREE.Group(); scene.add(group);
  let solids = [], picks = [], nodes = [], builds = [], drafts = [], hoops = [], silks = [], nightDews = [], star = null;
  let homeAt = null, A = { x: 0, z: 0 }, baseY = 0, recipe = null, id = null, picked = 0, keyDone = false, msgT = 0, t = 0;
  let advNeed = 99, nightOn = false, dewPulseT = -99, nodesDone = 0, buildsDone = 0, keyDew = 0;
  let terrainMesh = null, sampleH = null, waterMeshes = [];
  const mats = new Map();
  const mat = (c, e = 0) => { const k = c + ':' + e; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e, flatShading: true })); return mats.get(k); };
  const gy = (x, z) => {
    if (sampleH) {
      const h = sampleH(x, z);
      if (h != null) return h;
    }
    return (ctx.meadowHeightAt || ctx.heightAt)(A.x + x, A.z + z);
  };

  function buildTerrainMesh(fn, bounds) {
    const { x0, x1, z0, z1 } = bounds;
    const W = x1 - x0, D = z1 - z0;
    const SEG = 72;
    const geo = new THREE.PlaneGeometry(W, D, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const waterPts = [];
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) + (x0 + x1) / 2;
      const lz = pos.getZ(i) + (z0 + z1) / 2;
      let rel = fn(lx, lz);
      if (rel == null) rel = -4; // outside silhouette = deep drop
      pos.setY(i, rel); // mesh local y; mesh sits at world baseY
      const wet = rel < -1.2;
      if (wet) { col[i * 3] = 0.25; col[i * 3 + 1] = 0.55; col[i * 3 + 2] = 0.75; waterPts.push([lx, lz]); }
      else if (rel < 0) { col[i * 3] = 0.75; col[i * 3 + 1] = 0.65; col[i * 3 + 2] = 0.4; }
      else { const g = 0.45 + Math.min(0.35, rel * 0.08); col[i * 3] = 0.35; col[i * 3 + 1] = g; col[i * 3 + 2] = 0.28; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.position.set(A.x + (x0 + x1) / 2, baseY, A.z + (z0 + z1) / 2);
    group.add(mesh);
    terrainMesh = mesh;
    // Inside the map AABB the zone owns height: silhouette uses fn, padding is a drop (not the shared meadow).
    sampleH = (lx, lz) => {
      if (lx < x0 - 0.5 || lx > x1 + 0.5 || lz < z0 - 0.5 || lz > z1 + 0.5) return null;
      let rel = fn(lx, lz);
      // Always keep a dry home pad around local (0,0) so every species can spawn/stand.
      const homeR = Math.hypot(lx, lz);
      if (homeR < 4.5) {
        const pad = 0.55;
        if (rel == null || rel < pad) rel = pad;
      }
      return baseY + (rel == null ? -3.5 : rel);
    };
    setZoneHeight((wx, wz) => sampleH(wx - A.x, wz - A.z));
    // WATER_RECTS from wet samples (grid approx)
    if (recipe.waterFromTerrain) {
      const step = 1.4;
      for (let lx = x0; lx <= x1; lx += step) for (let lz = z0; lz <= z1; lz += step) {
        const rel = fn(lx, lz);
        if (rel != null && rel < -1.2) WATER_RECTS.push({ x: A.x + lx, z: A.z + lz, hw: step * 0.55, hd: step * 0.55 });
      }
    }
    return waterPts;
  }

  const B = {
    paintWaterFromTerrain() {
      // translucent water plates over wet cells already in WATER_RECTS
      const seen = new Set();
      for (const r of WATER_RECTS) {
        const k = (r.x / 2 | 0) + ',' + (r.z / 2 | 0);
        if (seen.has(k)) continue; seen.add(k);
        const m = new THREE.Mesh(new THREE.BoxGeometry(r.hw * 2, 0.15, r.hd * 2), new THREE.MeshLambertMaterial({ color: 0x3aa0e8, emissive: 0x0b3a66, transparent: true, opacity: 0.72 }));
        m.position.set(r.x, Math.max(WATER_Y + 0.05, baseY - 1.6), r.z);
        group.add(m); waterMeshes.push(m);
      }
    },
    box(x, z, w, d, h, c, th, yaw = 0, hidden) {
      const g = gy(x, z), T = th || h + 1.5, m = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), mat(c));
      m.position.set(A.x + x, g + h - T / 2, A.z + z); m.rotation.y = yaw; group.add(m);
      const s = { type: 'box', x: A.x + x, z: A.z + z, hx: w / 2, hz: d / 2, yaw: -yaw, y0: g + h - T, top: g + h, kind: 'zone' };
      ctx.phys.addDyn(s); solids.push(s); if (hidden) { m.visible = false; s.off = true; } return { m, s };
    },
    cyl(x, z, r, h, c, th, hidden) {
      const g = gy(x, z), T = th || h + 1.5, m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, T, 12), mat(c));
      m.position.set(A.x + x, g + h - T / 2, A.z + z); group.add(m);
      const s = { type: 'cyl', x: A.x + x, z: A.z + z, r, y0: g + h - T, top: g + h, kind: 'zone' };
      ctx.phys.addDyn(s); solids.push(s); if (hidden) { m.visible = false; s.off = true; } return { m, s };
    },
    mound(x, z, h, r) { this.cyl(x, z, r, h, 0x7cc35a, h + 0.6); },
    tree(x, z, s = 1) {
      const g = gy(x, z), trunkH = 2.2 * s, canopy = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, trunkH, 0.55 * s), mat(0x6b4a30));
      trunk.position.set(0, trunkH / 2, 0); canopy.add(trunk);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(2.4 * s, 1.8 * s, 2.4 * s), mat(0x3f8a35));
      c1.position.set(0, trunkH + 0.7 * s, 0); canopy.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 1.2 * s, 1.5 * s), mat(0x4fa044));
      c2.position.set(0, trunkH + 1.9 * s, 0); canopy.add(c2);
      canopy.position.set(A.x + x, g, A.z + z); group.add(canopy);
      const sld = { type: 'cyl', x: A.x + x, z: A.z + z, r: 0.4 * s, y0: g, top: g + trunkH + 0.2, kind: 'zone' };
      ctx.phys.addDyn(sld); solids.push(sld);
    },
    sunflower(x, z) {
      const g = gy(x, z), G = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.5, 0.45), mat(0x3f8a35)); stem.position.y = 2.75; G.add(stem);
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.7), mat(0xffd23f, 0.35)); head.position.y = 5.8; G.add(head);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.5), mat(0x5a3b22)); eye.position.set(0, 5.8, 0.2); G.add(eye);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
    },
    home(x, z) {
      homeAt = { x: A.x + x, z: A.z + z }; if (1) return; // t148u: the crew nest is the single home (no extra stump)
      const g = gy(x, z), G = new THREE.Group();
      const stump = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), mat(0xb07a32)); stump.position.y = 0.8; G.add(stump);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.2), mat(0x5a3b22)); door.position.set(0, 0.7, 1.35); G.add(door);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
    },
    buildRing(x, z) {
      const g = gy(x, z);
      const m = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      m.position.set(A.x + x, g + 0.12, A.z + z); group.add(m);
    },
    glade(x, z, col = 0xa8d88a) {
      const g = gy(x, z);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.12, 10), mat(col)); m.position.set(A.x + x, g + 0.08, A.z + z); group.add(m);
    },
    cocoon(x, z) {
      const g = gy(x, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.7), mat(0xe8dff5)); m.position.set(A.x + x, g + 0.9, A.z + z); group.add(m);
    },
    cave(x, z) {
      const g = gy(x, z), G = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.8, 3.2), mat(0x6a6a68)); body.position.y = 1.4; G.add(body);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.4), mat(0x1a1a1c)); mouth.position.set(0, 1.0, 1.7); G.add(mouth);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
    },
    hollowOak(x, z) {
      const g = gy(x, z), segs = [[4.2, 4.0], [3.4, 3.6], [2.6, 3.2]]; let y = 0;
      segs.forEach(([w, h], j) => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat(0x5a3b22));
        body.position.set(A.x + x, g + y + h / 2, A.z + z); group.add(body);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.2), mat(0x1a1020, 0.4));
        win.position.set(A.x + x + w / 2 - 0.05, g + y + h / 2, A.z + z); group.add(win);
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.35, 1.4), mat(0x7a5636));
        ledge.position.set(A.x + x, g + y + h * 0.55, A.z + z + w * 0.35); group.add(ledge);
        const s = { type: 'box', x: A.x + x, z: A.z + z + w * 0.35, hx: w * 0.35, hz: 0.7, yaw: 0, y0: g + y + h * 0.55 - 0.2, top: g + y + h * 0.55 + 0.2, kind: 'zone' };
        ctx.phys.addDyn(s); solids.push(s);
        y += h;
      });
      const crown = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 7.2), mat(0x3f7a35));
      crown.position.set(A.x + x, g + y + 1.0, A.z + z); group.add(crown);
      const deck = { type: 'cyl', x: A.x + x, z: A.z + z, r: 3.4, y0: g + y, top: g + y + 2.0, kind: 'zone' };
      ctx.phys.addDyn(deck); solids.push(deck);
    },
    logStack(x, z, n, baseH) {
      for (let i = 0; i < n; i++) {
        const w = 14 - i * 1.8, h = baseH + i * 0.85;
        const log = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, 1.3), mat(0x8b6a45));
        const g = gy(x, z); log.position.set(A.x + x, g + h, A.z + z - i * 0.15); group.add(log);
        const s = { type: 'box', x: A.x + x, z: A.z + z, hx: w / 2, hz: 0.7, yaw: 0, y0: g + h - 0.45, top: g + h + 0.4, kind: 'zone' };
        ctx.phys.addDyn(s); solids.push(s);
      }
    },
    blanket(x, z, w, d, col) {
      const g = gy(x + w / 2, z + d / 2);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat(col)); m.position.set(A.x + x + w / 2, g + 0.06, A.z + z + d / 2); group.add(m);
    },
    table(x, z, w, d, h) {
      this.box(x, z, w, d, h, 0xc69c6d, 0.35);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, h, 0.28), mat(0x8b5e3c));
        const g = gy(x, z); leg.position.set(A.x + x + sx * (w / 2 - 0.3), g + h / 2, A.z + z + sz * (d / 2 - 0.3)); group.add(leg);
      });
    },
    basket(x, z, r, h) { this.cyl(x, z, r, h, 0xc8a060, h + 0.4); },
    napkin(x1, z1, x2, z2, h1, h2) {
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1) || 1;
      const yaw = Math.atan2(-(z2 - z1), x2 - x1), h = (h1 + h2) / 2;
      this.box(mx, mz, L, 1.2, h, 0xf3eee0, 0.25, yaw);
    },
    bridge(x1, z1, h1, x2, z2, h2) {
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1) || 1;
      const yaw = Math.atan2(-(z2 - z1), x2 - x1), h = (h1 + h2) / 2;
      this.box(mx, mz, L, 1.1, h, 0xf3eee0, 0.2, yaw);
    },
    silk(x1, z1, h1, x2, z2, h2) {
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1) || 1;
      const yaw = Math.atan2(-(z2 - z1), x2 - x1), h = (h1 + h2) / 2;
      const { m, s } = this.box(mx, mz, L, 0.45, h, 0xe8e0ff, 0.12, yaw, true);
      m.material = new THREE.MeshBasicMaterial({ color: 0xf2ecff, transparent: true, opacity: 0.55 });
      silks.push({ m, s });
    },
    lantern(x, z) {
      const g = gy(x, z);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), mat(0x6b4a30)); post.position.set(A.x + x, g + 1.1, A.z + z); group.add(post);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), mat(0xffd23f, 0.7)); lamp.position.set(A.x + x, g + 2.5, A.z + z); group.add(lamp);
    },
    pickup(tier, x, z, h) {
      if (tier === 'dew') tier = 'petal'; // adventure refocus: Petals are the score
      const T = TIER[tier], m = new THREE.Mesh(T.geo(), mat(T.col, 0.8));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
      picks.push({ tier, m, y: m.position.y, got: false, nightOnly: false });
    },
    nightDew(x, z, h) {
      return this.pickup('petal', x, z, h);
      const T = TIER.dew, m = new THREE.Mesh(T.geo(), mat(T.col, 0.9));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); m.visible = false; group.add(m);
      const rec = { tier: 'dew', m, y: m.position.y, got: false, nightOnly: true, alive: false };
      picks.push(rec); nightDews.push(rec);
    },
    node(kind, x, z, h) {
      return; // adventure refocus: team-gather nodes cut
      const N = NODE[kind], col = TIER[N.tier].col, m = new THREE.Group();
      const body = new THREE.Mesh(kind === 'team' ? new THREE.CylinderGeometry(0.9, 0.9, 3, 10).rotateZ(Math.PI / 2) : kind === 'heavy' ? new THREE.CylinderGeometry(1.6, 1.8, 0.6, 16) : new THREE.DodecahedronGeometry(1.1), mat(kind === 'team' ? 0xb07a32 : col, kind === 'team' ? 0.15 : 0.7));
      body.position.y = kind === 'heavy' ? 0.3 : 1; m.add(body);
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      ring.position.y = 0.08; m.add(ring);
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
      const label = document.createElement('div'); label.className = 'zoneNode'; document.body.appendChild(label);
      nodes.push({ kind, m, body, label, done: false, wob: 0 });
    },
    builder(name, who, x, z, steps) {
      steps.forEach(([sx, sz, h, r]) => this.cyl(sx, sz, r, h, 0x8b6a45, Math.min(h + 1, 1.6))); return; // built from the start
      const ghost = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 }));
      ghost.position.set(A.x + x, gy(x, z) + 0.3, A.z + z); group.add(ghost);
      const parts = steps.map(([sx, sz, h, r]) => this.cyl(sx, sz, r, h, 0x8b6a45, Math.min(h + 1, 1.6), true));
      builds.push({ name, who, x: A.x + x, z: A.z + z, ghost, parts, done: false });
    },
    updraft(x, z, h) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, h, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set(A.x + x, gy(x, z) + h / 2, A.z + z); group.add(m); drafts.push({ x: A.x + x, z: A.z + z, top: gy(x, z) + h, m });
    },
    hoop(x, z, h) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.15, 8, 24), mat(0xff6bd6, 0.6));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m); hoops.push({ m, got: false });
    },
    starheart(x, z, h, caps) {
      return;
      this.node('heaviest', x, z, h);
      star = { node: nodes[nodes.length - 1], caps: caps.map(([cx, cz, ch]) => ({ x: A.x + cx, z: A.z + cz, y: gy(cx, cz) + ch })), carry: false, safe: { x: A.x, z: A.z + 2 }, mesh: null, lastY: 0, dropped: 0 };
    },
  };

  const say = (s, d = 2200) => { if (t - msgT > 1.6) { msgT = t; ctx.toast(s, d); } };
  function clear() {
    WATER_RECTS.length = 0;
    setZoneHeight(null);
    sampleH = null; terrainMesh = null; waterMeshes = [];
    for (const s of solids) s.off = true;
    solids = []; picks = []; builds = []; drafts = []; hoops = []; silks = []; nightDews = []; star = null;
    for (const n of nodes) n.label.remove(); nodes = [];
    while (group.children.length) { const c = group.children.pop(); c.traverse?.(o => o.geometry?.dispose?.()); }
    id = null; recipe = null; nightOn = false; dewPulseT = -99; nodesDone = 0; buildsDone = 0; keyDew = 0;
  }
  function load(pid, anchor) {
    clear(); recipe = MAPS[pid]; if (!recipe) return; id = pid; picked = 0; keyDone = false; t = 0;
    A = { x: anchor.x, z: anchor.z };
    baseY = (ctx.meadowHeightAt || ctx.heightAt)(A.x, A.z);
    buildTerrainMesh(recipe.terrain, recipe.bounds);
    recipe.build(B);
    advNeed = Math.max(1, Math.ceil(picks.length * 0.7));
    if (recipe.night) { nightOn = true; ctx.setNight(true); }
    else if (recipe.nightCycle) { nightOn = false; ctx.setNight(false); }
    ctx.toast(`🎯 Gather ${advNeed} Petals to finish ${'this level'}`, 3600);
  }
  function crewAt(x, z, r) {
    const p = ctx.getP(); let n = Math.hypot(p.x - x, p.z - z) < r ? 1 : 0;
    for (const cid of ctx.crewIds()) { if (cid === ctx.cur()) continue; const q = ctx.parked(cid); if (q && Math.hypot(q.x - x, q.z - z) < r) n++; }
    for (const h of ctx.helpers()) if (Math.hypot(h.x - x, h.z - z) < r) n++;
    return n;
  }
  function pulseNightDews(want) {
    for (const d of nightDews) { if (d.got) continue; d.alive = want; d.m.visible = want; }
  }
  function checkKey() {
    if (!recipe || keyDone) return; if (1) return;
    if (recipe.key === 'node' && nodesDone >= 1) complete('Team lift done');
    else if (recipe.key === 'multi') {
      const nn = recipe.needNodes || 0, nb = recipe.needBuilds || 0;
      if (nodesDone >= nn && buildsDone >= nb) complete('Zone goals cleared');
    }
  }
  const keyGoalMet = () => !recipe || keyDone;
  function complete(why) { if (keyDone) return; keyDone = true; ctx.toast(`✅ ${why}!`, 2600); ctx.audio?.chime?.(); }
  function update(dt, cam) {
    if (!recipe) return; t += dt;
    const p = ctx.getP(), cur = ctx.cur(), size = SIZE[cur] || 'medium';
    if (recipe.nightCycle) {
      const phase = t % recipe.nightCycle;
      const wantNight = phase < 50;
      if (wantNight !== nightOn) {
        nightOn = wantNight; ctx.setNight(wantNight);
        if (wantNight) { dewPulseT = t; pulseNightDews(true); say('🌙 Night falls — Dewdrops sparkle for a few seconds!', 2400); }
        else pulseNightDews(false);
      }
      if (nightOn && dewPulseT >= 0 && t - dewPulseT > (recipe.dewWindow || 8)) pulseNightDews(false);
      for (const s of silks) { s.m.visible = nightOn; s.s.off = !nightOn; }
    } else if (recipe.night) {
      const phase = t % 180;
      if (phase < (recipe.dewWindow || 8)) {
        if (!nightDews.some(d => d.alive && !d.got)) { dewPulseT = t; pulseNightDews(true); if (phase < dt * 2) say('💧 Dewdrop clusters are up — grab them!', 2000); }
      } else if (nightDews.some(d => d.alive)) pulseNightDews(false);
    }
    for (const k of picks) {
      if (k.got) continue;
      if (k.nightOnly && !k.alive) continue;
      k.m.rotation.y += dt * 2; k.m.position.y = k.y + Math.sin(t * 2 + k.y) * 0.15;
      if (Math.hypot(p.x - k.m.position.x, p.z - k.m.position.z) < 1.5 && Math.abs(p.y + 0.6 - k.m.position.y) < 1.8) {
        k.got = true; k.m.visible = false; k.alive = false; ctx.addHeal(TIER[k.tier].heal); ctx.onPick?.(k.tier); ctx.audio?.sample?.('ui2/item-produced', 0.4); picked++;
        if (k.tier === 'dew') keyDew++;
        if (picked >= advNeed) complete(`${picked} Petals gathered`);
        if (0 && recipe.key === 'pick') {
          const need = recipe.pick || 1;
          const have = (recipe.pickTier === 'petal') ? picked : keyDew;
          if (have >= need) complete(recipe.pickTier === 'petal' ? 'Petals gathered' : 'Dewdrops gathered');
        }
      }
    }
    for (const b of builds) {
      if (b.done) continue;
      b.ghost.rotation.y += dt; const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < 2.6) {
        if (b.who.includes(cur)) {
          b.done = true; buildsDone++; b.ghost.visible = false;
          b.parts.forEach(q => { q.m.visible = true; q.s.off = false; });
          ctx.toast(`🪵 ${b.name} built! Walkers can climb it now.`, 2600); ctx.audio?.chime?.();
          checkKey();
        } else say(`🔨 ${b.name}: swap to ${b.who.map(w => w === 'bear' ? '🐻 Bear' : w === 'opossum' ? '🐾 Opossum' : w).join(' or ')} to build this`);
      }
    }
    for (const w of drafts) {
      if (FLYERS.has(cur) || cur === 'moth') { if (Math.hypot(p.x - w.x, p.z - w.z) < 1.6 && p.y < w.top) p.vy = Math.max(p.vy || 0, cur === 'butterfly' ? 12 : 8); }
      else if (Math.hypot(p.x - w.x, p.z - w.z) < 1.6 && p.y < w.top - 6) p.vy = Math.max(p.vy || 0, 7);
    }
    for (const h of hoops) if (!h.got && Math.hypot(p.x - h.m.position.x, p.z - h.m.position.z) < 1.6 && Math.abs(p.y - h.m.position.y) < 1.6) {
      h.got = true; h.m.material = mat(0x8be07a, 0.6); ctx.addHeal(0.01); ctx.toast('💫 Race hoop!', 1000);
    }
    for (const n of nodes) {
      if (n.done) { n.label.style.display = 'none'; continue; }
      n.body.rotation.y += dt * 0.4;
      const need = NEED[n.kind][size], have = crewAt(n.m.position.x, n.m.position.z, 4.2), pd = Math.hypot(p.x - n.m.position.x, p.z - n.m.position.z);
      const v = n.m.position.clone(); v.y += 3; v.project(cam);
      const on = v.z < 1 && pd < 30; n.label.style.display = on ? 'block' : 'none';
      if (on) { n.label.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; n.label.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; n.label.textContent = `${NODE[n.kind].name} ${'🐾'.repeat(Math.min(have, need))}${'◯'.repeat(Math.max(0, need - have))}`; }
      if (pd < 3.2 && Math.abs(p.y - n.m.position.y) < 3) {
        if (have >= need) {
          n.done = true; nodesDone++; const N = NODE[n.kind]; ctx.addHeal(TIER[N.tier].heal * N.amt);
          ctx.toast(`💪 Everyone lifts together! +${N.amt} ${TIER[N.tier].em} ${TIER[N.tier].name}${N.amt > 1 ? 's' : ''}`, 2600); ctx.audio?.chime?.();
          if (star && n === star.node) { star.carry = true; star.mesh = n.body; n.m.remove(n.body); group.add(n.body); ctx.toast('⭐ Carry the Starheart down to the start ring — gently!', 3200); }
          else { n.m.visible = false; if (recipe.key === 'node') complete(`${N.name} lifted`); else checkKey(); }
        } else { n.wob = 0.5; say(`😅 Too heavy! Bring more friends. (${have}/${need}) — use the Command wheel to send helpers`); }
      }
      if (n.wob > 0) { n.wob -= dt; n.body.rotation.z = Math.sin(t * 40) * 0.12 * n.wob; } else n.body.rotation.z = 0;
    }
    if (star && star.carry) {
      const s = star; s.mesh.position.set(p.x, p.y + 2.4, p.z); s.mesh.rotation.y += dt * 2;
      const vy = (p.y - s.lastY) / Math.max(dt, 1e-3); s.lastY = p.y;
      if (vy < -14 && t - s.dropped > 1.5) {
        s.dropped = t; s.carry = false; const low = s.caps.filter(c => c.y < p.y).sort((a, b) => b.y - a.y)[0] || s.caps[0];
        s.mesh.position.set(low.x, low.y + 1, low.z); const nn = star.node; nn.done = false; nn.m.position.set(low.x, low.y, low.z); nn.m.add(s.mesh); s.mesh.position.set(0, 1, 0); nn.m.visible = true;
        ctx.toast('💫 Whoops! The Starheart bounced onto a lower cap. Go get it!', 2800);
      } else if (Math.hypot(p.x - s.safe.x, p.z - s.safe.z) < 4 && p.y < gy(0, 2) + 2) {
        s.carry = false; s.mesh.visible = false; star = null; complete('Starheart carried home');
      }
    }
  }
  const status = () => ({ picks: picks.map(k => ({ tier: k.tier, x: k.m.position.x, y: k.y, z: k.m.position.z, got: k.got, night: k.nightOnly })), A: { ...A }, baseY, keyDone, picked, need: advNeed });
  return { status, homePos: () => homeAt || { x: A.x, z: A.z }, load: (a, b) => { keyDew = 0; homeAt = null; load(a, b); }, clear, update, keyGoalMet, goal: () => recipe ? `Gather ${advNeed} Petals` : '', active: () => !!recipe, NEED, SIZE, MAPS };
}
