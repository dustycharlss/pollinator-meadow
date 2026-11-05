// Valley zones: 8 rising-complexity levels matching Fern's Nov 5 block-outs.
// Teach-then-combine; cube trees; G/M/H layers; team/heavy/star lifts.
import * as THREE from 'three';
import { WATER_RECTS } from './data.js';

export const SIZE = { bee: 'tiny', butterfly: 'tiny', hummingbird: 'tiny', moth: 'tiny', bat: 'tiny', bumblebee: 'medium', robin: 'medium', raccoon: 'medium', opossum: 'medium', bear: 'bear' };
export const FLYERS = new Set(['bee', 'butterfly', 'hummingbird', 'moth', 'bat', 'bumblebee', 'robin']);
const NEED = { team: { tiny: 3, medium: 2, bear: 1 }, heavy: { tiny: 5, medium: 3, bear: 1 }, heaviest: { tiny: 5, medium: 3, bear: 2 } };
const TIER = {
  petal: { name: 'Petal', em: '🌸', col: 0xff8fc8, heal: 0.012, geo: () => new THREE.OctahedronGeometry(0.55) },
  dew: { name: 'Dewdrop', em: '💧', col: 0x7fd8ff, heal: 0.025, geo: () => new THREE.SphereGeometry(0.5, 12, 10) },
  star: { name: 'Starseed', em: '⭐', col: 0xffe066, heal: 0.15, geo: () => new THREE.IcosahedronGeometry(0.7) },
};
const NODE = { team: { name: 'Honey Log', tier: 'petal', amt: 6 }, heavy: { name: 'Dew Pond', tier: 'dew', amt: 4 }, heaviest: { name: 'Starheart', tier: 'star', amt: 1 } };

// Page canvas 800×500 → local game units. Home of each map ≈ (0,0); +z = page-north.
const S = 0.055;
const px = (x, homeX = 400) => (x - homeX) * S;
const pz = (y, homeY) => (homeY - y) * S;

const Z = {
  // 1 — Sunny Hollow: octagon clearing, 3 mounds, Big Sunflower N, home S, bee glade NE. 8/0/0/0/0/3. Win: 20 Petals.
  sunny_hollow: {
    goal: 'Deliver 20 Petals, hire 1 helper, build 1 T1',
    pick: 20, key: 'pick', pickTier: 'petal',
    build() {
      const HY = 410;
      // octagon clearing rim (blocky trees)
      for (let i = 0; i < 16; i++) {
        if (i === 4 || i === 12) continue; // NE + W gaps
        const t = (Math.PI * 2 / 16) * i;
        this.tree(Math.cos(t) * 18, Math.sin(t) * 12.5 + pz(250, HY), 0.95 + (i % 3) * 0.08);
      }
      // 3 flower mounds
      this.mound(px(150, 400), pz(220, HY), 1.15, 2.6);
      this.mound(px(560, 400), pz(220, HY), 1.15, 2.6);
      this.mound(px(300, 400), pz(300, HY), 1.0, 2.2);
      // Big Sunflower north
      this.sunflower(0, pz(110, HY));
      // Home stump south + 3 Build Rings
      this.home(0, 0);
      this.buildRing(px(330), 0.6); this.buildRing(px(470), 0.6); this.buildRing(0, pz(360, HY));
      // Bee glade NE
      this.glade(px(650), pz(90, HY), 0xffe08a);
      // 8 petal patches → 20 pickups (richer near sunflower)
      const patches = [
        [195, 230, 2], [605, 230, 2], [340, 305, 2], [470, 330, 2],
        [260, 150, 3], [540, 150, 3], [370, 130, 3], [430, 130, 3],
      ];
      for (const [x, y, n] of patches) {
        for (let i = 0; i < n; i++) {
          const a = i / n * 6.28, r = 0.55 + i * 0.15;
          this.pickup('petal', px(x) + Math.cos(a) * r, pz(y, HY) + Math.sin(a) * r, 0.9 + (y < 200 ? 0.3 : 0));
        }
      }
      // mound-top petals
      this.pickup('petal', px(150), pz(220, HY), 2.2);
      this.pickup('petal', px(560), pz(220, HY), 2.2);
    },
  },

  // 2 — Creek Bend: U creek, terraces E, Honey Log + Willow on Bank 3. 7/0/1/0/0/2.
  creek_bend: {
    goal: 'Cross the creek, lift the Honey Log, relay 10 Petals',
    key: 'multi', needNodes: 1, needBuilds: 1,
    build() {
      const HY = 230;
      // U-shaped creek around Pebble Point (faceted strips)
      const U = [[120, 0], [135, 180], [170, 320], [260, 420], [400, 460], [540, 420], [630, 320], [665, 180], [680, 0]];
      for (let i = 0; i < U.length - 1; i++) {
        const [x1, y1] = U[i], [x2, y2] = U[i + 1];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) * S;
        const yaw = Math.atan2(-(y2 - y1), x2 - x1);
        this.waterPoly(px(mx), pz(my, HY), Math.max(len, 2.2), 2.4, yaw);
      }
      // 3 stepped banks east
      [[690, 340, 1.2, 5.8, 6.0], [700, 230, 2.5, 5.2, 5.5], [710, 110, 4.0, 4.7, 5.5]].forEach(([x, y, h, w, d], i) => {
        this.box(px(x), pz(y, HY), w, d, h, 0x6faa4a);
        this.pickup('petal', px(x) - 1.2, pz(y, HY), h + 0.8);
        this.pickup('petal', px(x) + 1.0, pz(y, HY) - 0.5, h + 0.8);
      });
      // Willow Lookout cube tree on Bank 3
      this.tree(px(755), pz(150, HY), 1.45);
      this.tree(px(30), pz(60, HY), 1.0);
      this.tree(px(70), pz(420, HY), 1.0);
      this.tree(px(300), pz(120, HY), 0.9);
      this.tree(px(500), pz(120, HY), 0.9);
      // Stepping-Log Ford (bear/opossum) + Plank Bridge spot south
      this.builder('Stepping-Log Ford', ['bear', 'opossum'], px(640), pz(360, HY), [
        [px(620), pz(370, HY), 0.7, 1.1], [px(645), pz(350, HY), 1.4, 1.0], [px(670), pz(335, HY), 2.0, 1.0],
      ]);
      this.builder('Plank Bridge', ['opossum', 'bear'], 0, pz(430, HY), [
        [px(370), pz(440, HY), 0.6, 1.0], [0, pz(450, HY), 0.6, 1.2], [px(430), pz(440, HY), 0.6, 1.0],
      ]);
      this.home(0, 0);
      this.buildRing(0, pz(430, HY)); this.buildRing(px(470), pz(280, HY));
      this.node('team', px(715), pz(180, HY), 4.0); // Honey Log Bank 3
      this.glade(px(70), pz(220, HY), 0xa8d88a); // Shrub Nest Robins W
      // 7 petal patches
      [[330, 260], [470, 200], [735, 400], [760, 280], [250, 480], [550, 480], [60, 330]].forEach(([x, y], i) => {
        this.pickup('petal', px(x), pz(y, HY), y < 200 ? 4.8 : 0.85);
        if (i < 3) this.pickup('petal', px(x) + 0.7, pz(y, HY) + 0.4, y < 200 ? 4.8 : 0.85);
      });
    },
  },

  // 3 — Moon Meadow: Hollow Oak, night every 3 min, dew clusters 8s. 5/4/0/1/0/2. Win: 12 Dewdrops.
  moon_meadow: {
    goal: 'Collect 12 Dewdrops, lift the Dew Pond, win the contest',
    night: true, nightCycle: 180, dewWindow: 8,
    key: 'pick', pick: 12, pickTier: 'dew',
    build() {
      const HY = 440, cx = 0, cz = pz(280, HY);
      // 3-segment Hollow Oak (square stacked trunks + windows)
      this.hollowOak(cx, cz);
      // Firefly Spiral path markers (low rings)
      const spiral = [[620, 440], [520, 430], [250, 400], [220, 300], [260, 170], [400, 140], [540, 170], [560, 280], [500, 330]];
      spiral.forEach(([x, y], i) => {
        const h = 0.4 + i * 0.85;
        this.box(px(x), pz(y, HY), 1.4, 1.4, h, 0x8fbf5a, 0.35);
      });
      // Root Tunnel Dew Pond south of oak
      this.node('heavy', cx, cz - 6.5, 0);
      this.builder('Root Tunnel', ['opossum'], px(300), pz(400, HY), [
        [px(340), pz(380, HY), 0.8, 1.3], [px(370), pz(350, HY), 1.6, 1.2], [cx - 2.5, cz - 4, 2.4, 1.2],
      ]);
      // Perimeter cube trees
      for (let i = 0; i < 14; i++) {
        if ([0, 1, 7, 13].includes(i)) continue;
        const t = (Math.PI * 2 / 14) * i;
        this.tree(Math.cos(t) * 19, cz + Math.sin(t) * 12, 0.9);
      }
      this.glade(px(90), pz(230, HY), 0xc9b6ff); // Silk Cocoon Moths W
      this.cocoon(px(60), pz(300, HY)); this.cocoon(px(120), pz(310, HY));
      this.home(px(640), 0);
      this.buildRing(px(560), pz(300, HY)); this.buildRing(px(250), pz(240, HY));
      // Night dew clusters at Mid/Crown windows (4 clusters × 3 = 12; managed in update)
      for (const [x, y, h] of [[470, 230, 7.2], [330, 230, 7.2], [400, 150, 13.5], [430, 150, 13.5]]) {
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * 6.28;
          this.nightDew(px(x) + Math.cos(a) * 0.7, pz(y, HY) + Math.sin(a) * 0.7, h);
        }
      }
      // Day petals in grass ring
      [[700, 300], [600, 200], [180, 420], [260, 460], [720, 380]].forEach(([x, y]) => {
        this.pickup('petal', px(x), pz(y, HY), 0.85);
        this.pickup('petal', px(x) + 0.6, pz(y, HY) - 0.4, 0.85);
      });
    },
  },

  // 4 — Log Jam: canyon, Low/Stacked/Tower jams, 3 Honey Logs, Dew Pond on Tower. 6/0/3/1/0/2
  log_jam: {
    goal: 'Clear 3 jams, lift 3 Honey Logs + Tower Dew Pond',
    key: 'multi', needNodes: 4, needBuilds: 1,
    build() {
      const HY = 455;
      // High canyon walls
      this.box(px(115), pz(250, HY), 12, 26, 5.5, 0x8a8a86);
      this.box(px(685), pz(250, HY), 12, 26, 5.5, 0x8a8a86);
      this.tree(px(60), pz(120, HY), 1); this.tree(px(150), pz(300, HY), 1);
      this.tree(px(650), pz(160, HY), 1); this.tree(px(720), pz(380, HY), 1);
      // Low Jam (2 logs), Stacked (3), Big Tower (4)
      this.logStack(0, pz(370, HY), 2, 0.9);
      this.logStack(0, pz(250, HY), 3, 1.8);
      this.logStack(0, pz(115, HY), 4, 3.2);
      // Shove ramps (bear) to wall shelves
      this.builder('Low Jam ramp', ['bear'], px(520), pz(380, HY), [
        [px(500), pz(370, HY), 1.2, 1.3], [px(540), pz(350, HY), 2.4, 1.3], [px(560), pz(330, HY), 3.6, 1.2],
      ]);
      this.builder('Stacked Jam ramp', ['bear'], px(230), pz(260, HY), [
        [px(250), pz(250, HY), 1.5, 1.3], [px(280), pz(230, HY), 2.8, 1.3], [px(230), pz(210, HY), 4.0, 1.2],
      ]);
      this.builder('Tower ramp', ['bear'], px(520), pz(140, HY), [
        [px(500), pz(130, HY), 2.0, 1.3], [px(540), pz(110, HY), 3.5, 1.3], [px(560), pz(90, HY), 5.0, 1.2],
      ]);
      this.home(0, 0);
      this.buildRing(px(330), pz(430, HY)); this.buildRing(px(470), pz(300, HY));
      // Honey Log per jam shelf + Dew Pond on Tower
      this.node('team', px(600), pz(330, HY), 3.6);
      this.node('team', px(190), pz(200, HY), 4.0);
      this.node('team', px(610), pz(80, HY), 5.0);
      this.node('heavy', 0, pz(60, HY), 3.5);
      this.cave(0, pz(10, HY)); // Cave Den Bears N
      [[340, 320], [460, 320], [330, 190], [480, 190], [80, 220], [690, 260]].forEach(([x, y]) => {
        this.pickup('petal', px(x), pz(y, HY), y < 220 ? 2.5 : 1.0);
      });
    },
  },

  // 5 — Picnic Lawn: 2×2 blankets, tables, lemonade stream, 2 Dew Ponds, bunch. 6/0/1/2/0/2
  picnic_lawn: {
    goal: 'Lift 2 Dew Ponds + Big Table bunch, win the contest',
    key: 'multi', needNodes: 3,
    build() {
      // Remap: home page (70,60) → (0,0)
      const HX = 70, HY2 = 60;
      const X = (x) => (x - HX) * S, Z = (y) => (HY2 - y) * S;
      // 2×2 checker blankets
      [[120, 120], [320, 120], [120, 280], [320, 280]].forEach(([x, y], i) => {
        this.blanket(X(x), Z(y), 8.8, 6.0, i % 2 ? 0xd94c4c : 0xf5f0e1);
      });
      // Lemonade stream diagonal
      const stream = [[0, 470], [150, 430], [300, 400], [450, 330], [560, 250], [680, 140], [800, 60]];
      for (let i = 0; i < stream.length - 1; i++) {
        const [x1, y1] = stream[i], [x2, y2] = stream[i + 1];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const len = Math.hypot(x2 - x1, y2 - y1) * S;
        this.waterPoly(X(mx), Z(my), Math.max(len, 2), 2.2, Math.atan2(-(y2 - y1), x2 - x1));
      }
      // Tables + baskets + napkin ramps
      this.table(X(160), Z(140), 4.4, 2.2, 2.8);
      this.table(X(360), Z(300), 4.4, 2.2, 2.8);
      this.table(X(560), Z(120), 8.2, 3.3, 3.4); // Big Table
      this.basket(X(340), Z(150), 1.8, 1.6);
      this.basket(X(150), Z(310), 1.8, 1.6);
      this.basket(X(640), Z(320), 4.5, 3.2); // Big Basket
      this.napkin(X(245), Z(190), X(280), Z(160), 1.2, 2.4);
      this.napkin(X(445), Z(345), X(480), Z(310), 1.2, 2.4);
      this.napkin(X(520), Z(200), X(560), Z(170), 1.4, 3.0);
      this.tree(X(30), Z(230), 1); this.tree(X(760), Z(470), 1); this.tree(X(520), Z(470), 0.8); this.tree(X(300), Z(40), 0.9);
      this.home(0, 0);
      this.buildRing(X(290), Z(255)); this.buildRing(X(500), Z(255));
      this.glade(X(690), Z(420), 0xc4a882); // Raccoon den SE
      this.node('heavy', X(330), Z(420), 0);
      this.node('heavy', X(600), Z(230), 0);
      this.node('team', X(640), Z(135), 3.4); // Big Table bunch
      [[200, 155], [400, 315], [360, 160], [170, 320], [580, 140], [680, 140]].forEach(([x, y]) => {
        const h = (x >= 560 ? 3.8 : (y <= 160 ? 3.2 : 1.5));
        this.pickup('petal', X(x), Z(y), h);
      });
    },
  },

  // 6 — Cliff Orchard: 4 nested ledge rings, Boulder Stair, waterfall Dew Pond, Moonfruit. 6/3/0/3/0/2
  cliff_orchard: {
    goal: 'Build the stair, night-harvest Moonfruit, finish 3 heavy picks',
    nightCycle: 180, dewWindow: 8,
    key: 'multi', needNodes: 3, needBuilds: 1,
    build() {
      const HY = 330, HX = 400;
      const X = (x) => (x - HX) * S, Z = (y) => (HY - y) * S;
      // 4 nested ledge rings (octagon plates), darker/higher
      [[400, 240, 4.8], [320, 190, 3.6], [240, 140, 2.4], [160, 90, 1.2]].forEach(([rx, ry, h], i) => {
        this.ringPlate(0, 0, rx * S, ry * S, h, [0x9a9a98, 0x8f8f8c, 0x858582, 0x7a7a78][i]);
      });
      // Orchard floor center soft
      this.mound(0, 0, 0.3, 4.5);
      // Waterfall N into pool
      this.waterPoly(0, Z(100), 2.2, 8.5, 0);
      this.node('heavy', 0, Z(205), 0); // waterfall pool Dew Pond
      this.builder('Boulder Stair', ['bear'], X(250), Z(310), [
        [X(250), Z(310), 1.4, 1.5], [X(230), Z(280), 2.6, 1.4], [X(210), Z(240), 3.6, 1.35],
        [X(190), Z(200), 4.5, 1.3], [X(170), Z(150), 5.4, 1.25], [X(150), Z(100), 6.2, 1.2],
      ]);
      this.tree(X(230), Z(380), 0.8); this.tree(X(580), Z(380), 0.8);
      this.tree(X(140), Z(230), 0.9); this.tree(X(660), Z(230), 0.9);
      this.tree(X(90), Z(120), 1); this.tree(X(700), Z(110), 1);
      this.cave(X(600), Z(30)); // Bat Roost NE
      this.home(0, 0);
      this.buildRing(X(470), Z(350)); this.buildRing(X(640), Z(160));
      // 2 heavy picks on Ledge 4 + pool already = 3 heavy
      this.node('heavy', X(120), Z(70), 4.8);
      this.node('heavy', X(660), Z(70), 4.8);
      // Moonfruit night dew on top shelf
      this.nightDew(X(250), Z(50), 5.6);
      this.nightDew(X(530), Z(55), 5.6);
      this.nightDew(X(300), Z(40), 5.6);
      [[300, 380], [510, 380], [200, 300], [600, 300], [170, 190], [630, 190]].forEach(([x, y], i) => {
        this.pickup('petal', X(x), Z(y), 1.2 + Math.min(i, 3) * 0.9);
      });
    },
  },

  // 7 — Windy Rise: 3 terraces E, gullies, 5 cube trees + 4 canopy bridges, Fork Honey Log. 6/0/1/1/0/2
  windy_rise: {
    goal: 'Chain streamers, lift Fork Log, win the dance-off',
    nightCycle: 180,
    key: 'multi', needNodes: 2, needBuilds: 1,
    build() {
      const HX = 60, HY = 440;
      const X = (x) => (x - HX) * S, Z = (y) => (HY - y) * S;
      // 3 terraces stepping east
      this.box(X(295), Z(415), 10.5, 9.4, 1.3, 0x6faa4a);
      this.box(X(505), Z(375), 10.5, 13.8, 2.6, 0x629a42);
      this.box(X(710), Z(330), 9.9, 18.7, 4.0, 0x568a38);
      // 2 water gullies
      this.waterPoly(X(195), Z(415), 1.2, 9.5, 0);
      this.waterPoly(X(405), Z(375), 1.2, 13.5, 0);
      // Log stairs for walkers
      this.builder('Gully stair 1', ['bear', 'opossum'], X(170), Z(420), [
        [X(175), Z(430), 0.8, 1.2], [X(185), Z(410), 1.6, 1.2], [X(200), Z(390), 2.2, 1.1],
      ]);
      this.builder('Gully stair 2', ['bear', 'opossum'], X(380), Z(340), [
        [X(385), Z(350), 1.5, 1.2], [X(400), Z(330), 2.6, 1.2], [X(415), Z(310), 3.4, 1.1],
      ]);
      // 5 cube trees + 4 canopy bridges + hoops
      const trees = [[90, 250], [230, 210], [380, 180], [540, 150], [700, 120]];
      trees.forEach(([x, y], i) => this.tree(X(x), Z(y), 1.55 + (i === 2 ? 0.15 : 0)));
      for (let i = 0; i < 4; i++) {
        const [x1, y1] = trees[i], [x2, y2] = trees[i + 1];
        this.bridge(X(x1), Z(y1), 12.2, X(x2), Z(y2), 12.2);
        this.hoop((X(x1) + X(x2)) / 2, (Z(y1) + Z(y2)) / 2, 13.0);
        // night silk shortcuts (stored for night toggle)
        this.silk(X(x1), Z(y1), 12.8, X(x2), Z(y2), 12.8);
      }
      // longer silk shortcuts
      this.silk(X(90), Z(250), 12.8, X(380), Z(180), 12.8);
      this.silk(X(380), Z(180), 12.8, X(700), Z(120), 12.8);
      this.home(0, 0);
      this.buildRing(X(300), Z(380)); this.buildRing(X(520), Z(300));
      this.node('team', X(380), Z(95), 12.4); // Fork Tree Honey Log
      this.node('heavy', X(300), Z(470), 0); // gully Dew Pond
      this.glade(X(720), Z(280), 0xe8b4ff); // Chrysalis summit E
      this.updraft(X(160), Z(200), 14); this.updraft(X(540), Z(150), 14);
      [[160, 200], [460, 140], [620, 110], [520, 400], [700, 420], [120, 350]].forEach(([x, y], i) => {
        this.pickup('petal', X(x), Z(y), i < 3 ? 13.0 : (y < 400 ? 3.2 : 0.9));
      });
    },
  },

  // 8 — Festival Glade: Ribbon Creek, 4-cap knoll + Starheart, districts. 5/2/1/2/1/2
  festival_glade: {
    goal: 'Bring the Starheart home and start the Festival',
    key: 'star', nightCycle: 180,
    build() {
      const HX = 400, HY = 460;
      const X = (x) => (x - HX) * S, Z = (y) => (HY - y) * S;
      // Octagonal Ribbon Creek ring
      for (let i = 0; i < 8; i++) {
        const t0 = Math.PI / 4 * i + Math.PI / 8, t1 = Math.PI / 4 * (i + 1) + Math.PI / 8;
        const r0 = 18.5, r1 = 16.5;
        const mx = (Math.cos(t0) + Math.cos(t1)) * 0.5 * ((r0 + r1) / 2);
        const mz = (Math.sin(t0) + Math.sin(t1)) * 0.5 * ((r0 + r1) / 2) * 0.65;
        this.waterPoly(mx, mz + Z(260), 5.5, 2.0, t0 + Math.PI / 2);
      }
      // 4-cap Lookout Knoll + Starheart
      const caps = [];
      [[11, 1.6], [8.2, 3.2], [5.5, 4.8], [3.3, 6.4]].forEach(([r, h], j) => {
        this.cyl(0, Z(280), r * 0.55, h, [0xe0443a, 0xf08a2c, 0xb55bd6, 0x2fb7a6][j], 0.45);
        this.cyl(0, Z(280), 0.45, h - 0.25, 0xf1e7d0);
        caps.push([0, Z(280), h]);
      });
      this.starheart(0, Z(170), 7.2, caps.concat([[0, 2, 0.5], [0, 0, 0]]));
      // Timber Stage NW
      this.logStack(X(150), Z(120), 2, 1.2);
      this.builder('Timber Stage ramp', ['bear', 'opossum'], X(270), Z(135), [
        [X(250), Z(140), 1.2, 1.2], [X(280), Z(120), 2.2, 1.2],
      ]);
      // Cliff Seats NE
      this.box(X(595), Z(110), 6.0, 2.2, 1.4, 0x8f8f8c);
      this.box(X(602), Z(75), 5.2, 1.7, 2.6, 0x858582);
      // Picnic Tiers SW
      this.table(X(140), Z(350), 3.8, 1.9, 2.4);
      this.basket(X(230), Z(380), 1.6, 1.4);
      // Lantern Lane SE
      this.lantern(X(560), Z(360)); this.lantern(X(600), Z(330)); this.lantern(X(640), Z(300));
      // Canopy ring bridges
      this.tree(X(120), Z(280), 1.3); this.tree(X(680), Z(280), 1.3);
      this.tree(X(260), Z(210), 1.0); this.tree(X(540), Z(210), 1.0);
      this.bridge(X(120), Z(280), 11.5, X(260), Z(210), 11.5);
      this.bridge(X(540), Z(210), 11.5, X(680), Z(280), 11.5);
      this.home(0, 0);
      this.buildRing(X(330), Z(440)); this.buildRing(X(470), Z(440));
      this.node('heavy', X(90), Z(400), 0);
      this.node('heavy', X(640), Z(400), 0);
      this.node('team', X(200), Z(90), 1.5);
      this.glade(X(60), Z(40), 0xffe08a); this.glade(X(740), Z(40), 0xffe08a);
      this.glade(X(30), Z(230), 0xc9b6ff); this.glade(X(770), Z(230), 0xa8d88a);
      this.nightDew(X(350), Z(250), 5.0); this.nightDew(X(450), Z(250), 5.0);
      [[180, 340], [600, 100], [350, 250], [450, 250], [220, 160]].forEach(([x, y]) => {
        this.pickup('petal', X(x), Z(y), y < 200 ? 2.0 : 0.9);
      });
    },
  },
};

export function createZones(scene, ctx) {
  const group = new THREE.Group(); scene.add(group);
  let solids = [], picks = [], nodes = [], builds = [], drafts = [], hoops = [], silks = [], nightDews = [], star = null;
  let A = { x: 0, z: 0 }, recipe = null, id = null, picked = 0, keyDone = false, msgT = 0, t = 0;
  let nightOn = false, dewPulseT = -99, nodesDone = 0, buildsDone = 0, keyDew = 0;
  const mats = new Map();
  const mat = (c, e = 0) => { const k = c + ':' + e; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e, flatShading: true })); return mats.get(k); };
  const gy = (x, z) => ctx.heightAt(A.x + x, A.z + z);
  const B = {
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
    water(x, z, w, d) {
      d = Math.min(d, 3.2); const g = gy(x, z);
      const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d + 2.2), mat(0xe6cf8f)); bank.position.set(A.x + x, g + 0.05, A.z + z); group.add(bank);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), new THREE.MeshLambertMaterial({ color: 0x2f8fe0, emissive: 0x0b3a66, transparent: true, opacity: 0.9 }));
      m.position.set(A.x + x, g + 0.12, A.z + z); group.add(m);
      WATER_RECTS.push({ x: A.x + x, z: A.z + z, hw: w / 2, hd: d / 2 });
    },
    waterPoly(x, z, w, d, yaw = 0) {
      d = Math.min(d, 3.4); const g = gy(x, z);
      const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d + 1.6), mat(0xe6cf8f)); bank.position.set(A.x + x, g + 0.04, A.z + z); bank.rotation.y = yaw; group.add(bank);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), new THREE.MeshLambertMaterial({ color: 0x3aa0e8, emissive: 0x0b3a66, transparent: true, opacity: 0.88 }));
      m.position.set(A.x + x, g + 0.1, A.z + z); m.rotation.y = yaw; group.add(m);
      // axis-aligned approx for water collision
      const ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw));
      WATER_RECTS.push({ x: A.x + x, z: A.z + z, hw: (w * ca + d * sa) / 2, hd: (w * sa + d * ca) / 2 });
    },
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
      const g = gy(x, z), G = new THREE.Group();
      const stump = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), mat(0xb07a32)); stump.position.y = 0.8; G.add(stump);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.2), mat(0x5a3b22)); door.position.set(0, 0.7, 1.35); G.add(door);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
    },
    buildRing(x, z) {
      const g = gy(x, z);
      const m = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      m.position.set(A.x + x, g + 0.12, A.z + z); group.add(m);
      const dash = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
      dash.position.copy(m.position); dash.position.y += 0.02; group.add(dash);
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
      const g = gy(x, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat(col)); m.position.set(A.x + x + w / 2, g + 0.06, A.z + z + d / 2); group.add(m);
    },
    table(x, z, w, d, h) {
      this.box(x, z, w, d, h, 0xc69c6d, 0.35);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, h, 0.28), mat(0x8b5e3c));
        const g = gy(x, z); leg.position.set(A.x + x + sx * (w / 2 - 0.3), g + h / 2, A.z + z + sz * (d / 2 - 0.3)); group.add(leg);
      });
    },
    basket(x, z, r, h) {
      this.cyl(x, z, r, h, 0xc8a060, h + 0.4);
    },
    napkin(x1, z1, x2, z2, h1, h2) {
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1) || 1;
      const yaw = Math.atan2(-(z2 - z1), x2 - x1);
      const h = (h1 + h2) / 2;
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
    ringPlate(x, z, rx, rz, h, c) {
      // approximate octagon with a box + flattened cylinder deck
      this.box(x, z, rx * 1.6, rz * 1.6, h, c, 0.55);
    },
    pickup(tier, x, z, h) {
      const T = TIER[tier], m = new THREE.Mesh(T.geo(), mat(T.col, 0.8));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
      picks.push({ tier, m, y: m.position.y, got: false, nightOnly: false });
    },
    nightDew(x, z, h) {
      const T = TIER.dew, m = new THREE.Mesh(T.geo(), mat(T.col, 0.9));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); m.visible = false; group.add(m);
      const rec = { tier: 'dew', m, y: m.position.y, got: false, nightOnly: true, alive: false };
      picks.push(rec); nightDews.push(rec);
    },
    node(kind, x, z, h) {
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
      this.node('heaviest', x, z, h);
      star = { node: nodes[nodes.length - 1], caps: caps.map(([cx, cz, ch]) => ({ x: A.x + cx, z: A.z + cz, y: gy(cx, cz) + ch })), carry: false, safe: { x: A.x, z: A.z + 2 }, mesh: null, lastY: 0, dropped: 0 };
    },
  };
  const say = (s, d = 2200) => { if (t - msgT > 1.6) { msgT = t; ctx.toast(s, d); } };
  function clear() {
    WATER_RECTS.length = 0;
    for (const s of solids) s.off = true;
    solids = []; picks = []; builds = []; drafts = []; hoops = []; silks = []; nightDews = []; star = null;
    for (const n of nodes) n.label.remove(); nodes = [];
    while (group.children.length) { const c = group.children.pop(); c.traverse?.(o => o.geometry?.dispose?.()); }
    id = null; recipe = null; nightOn = false; dewPulseT = -99; nodesDone = 0; buildsDone = 0; keyDew = 0;
  }
  function load(pid, anchor) {
    clear(); recipe = Z[pid]; if (!recipe) return; id = pid; picked = 0; keyDone = false; t = 0;
    A = { x: anchor.x, z: anchor.z };
    recipe.build.call(B);
    if (recipe.night) { nightOn = true; ctx.setNight(true); }
    else if (recipe.nightCycle) { nightOn = false; ctx.setNight(false); }
    ctx.toast(`🎯 ${recipe.goal}`, 3600);
  }
  function crewAt(x, z, r) {
    const p = ctx.getP(); let n = Math.hypot(p.x - x, p.z - z) < r ? 1 : 0;
    for (const cid of ctx.crewIds()) { if (cid === ctx.cur()) continue; const q = ctx.parked(cid); if (q && Math.hypot(q.x - x, q.z - z) < r) n++; }
    for (const h of ctx.helpers()) if (Math.hypot(h.x - x, h.z - z) < r) n++;
    return n;
  }
  function pulseNightDews(want) {
    for (const d of nightDews) {
      if (d.got) continue;
      d.alive = want; d.m.visible = want;
    }
  }
  function checkKey() {
    if (!recipe || keyDone) return;
    if (recipe.key === 'pick') {
      const tier = recipe.pickTier || 'dew';
      // counted via picked of that tier in update
    } else if (recipe.key === 'node' && nodesDone >= 1) complete('Team lift done');
    else if (recipe.key === 'multi') {
      const nn = recipe.needNodes || 0, nb = recipe.needBuilds || 0;
      if (nodesDone >= nn && buildsDone >= nb) complete('Zone goals cleared');
    } else if (recipe.key === 'star' && keyDone) { /* handled on star home */ }
  }
  const keyGoalMet = () => !recipe || keyDone;
  function complete(why) { if (keyDone) return; keyDone = true; ctx.toast(`✅ ${why} — this zone can heal fully now!`, 3200); ctx.audio?.chime?.(); }
  function update(dt, cam) {
    if (!recipe) return; t += dt;
    const p = ctx.getP(), cur = ctx.cur(), size = SIZE[cur] || 'medium';

    // Night cycle: every nightCycle seconds → night for ~50s; dew clusters visible dewWindow seconds at night start
    if (recipe.nightCycle) {
      const phase = t % recipe.nightCycle;
      const wantNight = phase < 50;
      if (wantNight !== nightOn) {
        nightOn = wantNight; ctx.setNight(wantNight);
        if (wantNight) { dewPulseT = t; pulseNightDews(true); say('🌙 Night falls — Dewdrops sparkle for a few seconds!', 2400); }
        else { pulseNightDews(false); }
      }
      if (nightOn && dewPulseT >= 0 && t - dewPulseT > (recipe.dewWindow || 8)) pulseNightDews(false);
      // silk lines walkable only at night
      for (const s of silks) { s.m.visible = nightOn; s.s.off = !nightOn; }
    } else if (recipe.night) {
      // always-night meadow still pulses dew windows every 3 min for 8s
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
        k.got = true; k.m.visible = false; k.alive = false; ctx.addHeal(TIER[k.tier].heal); ctx.audio?.sample?.('ui2/pickup', 0.4); picked++;
        if (k.tier === 'dew') keyDew++;
        if (recipe.key === 'pick') {
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
  return { load: (a, b) => { keyDew = 0; load(a, b); }, clear, update, keyGoalMet, goal: () => recipe?.goal || '', active: () => !!recipe, NEED, SIZE };
}
