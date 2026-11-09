// Valley zones — eight hand-built three-class maps (Scout / Trickster / Bruiser).
// Lost Vikings loop: each level needs all three classes; idle crew keep holding plates while you swap.
// Fern Nov 9 beats (three-class-levels.md). Blocking walls are solids (terrain is cosmetic + water).
import * as THREE from 'three';
import { WATER_RECTS, WATER_Y } from './data.js';
import { setZoneHeight } from './world.js';
import { CLASSES, CLASS_OF, ACTS, classOf } from './classes.js';
import { loadGLB, lambertFrom } from './models.js';

// team-lift sizes follow the class (Fern): Scout = tiny, Trickster = medium, Bruiser = bear
export const SIZE = Object.fromEntries(Object.entries(CLASS_OF).map(([id, c]) => [id, CLASSES[c].size]));
export const FLYERS = new Set(['bee', 'butterfly', 'hummingbird', 'moth', 'bumblebee']);
const NEED = { team: { tiny: 3, medium: 2, bear: 1 }, heavy: { tiny: 5, medium: 3, bear: 1 }, heaviest: { tiny: 2, medium: 2, bear: 2 } };
const TIER = {
  petal: { name: 'Petal', em: '🌸', col: 0xff8fc8, heal: 0.012, geo: () => new THREE.OctahedronGeometry(0.55) },
  dew: { name: 'Dewdrop', em: '💧', col: 0x7fd8ff, heal: 0.02, geo: () => new THREE.SphereGeometry(0.5, 12, 10) },
  star: { name: 'Starseed', em: '⭐', col: 0xffe066, heal: 0.08, geo: () => new THREE.IcosahedronGeometry(0.7) },
};
const NODE = { team: { name: 'Honey Log', tier: 'petal', amt: 6 }, heavy: { name: 'Dew Pond', tier: 'dew', amt: 4 }, heaviest: { name: 'Starheart', tier: 'star', amt: 1 } };
// CC0 premade models (Kenney Nature / Fantasy Town kits), dressed over blocky colliders
const GLB = {
  boulder: 'three-class/boulder', log: 'three-class/log', fence: 'three-class/fence-broken', lantern: 'three-class/lantern',
  bridge: 'three-class/bridge', tree: 'three-class/tree', stump: 'three-class/stump', hedge: 'three-class/hedge', basket: 'three-class/basket', rock: 'three-class/rock', tent: 'three-class/tent', stall: 'three-class/stall',
};

const COL = { hedge: 0x4f9a3e, hedgeTop: 0x5fae4a, wood: 0x8b6a45, bark: 0x6b4a30, stone: 0x9a968c, cliff: 0x8a8578, dirt: 0x8a6a3e, cream: 0xf3eee0, gold: 0xffd23f };

// ---- cosmetic terrain spec → height fn (walls/ledges are solids, not terrain) ------------
function terrainFrom(spec) {
  const { x0, x1, z0, z1 } = spec.bounds;
  return (lx, lz) => {
    if (lx < x0 - 2 || lx > x1 + 2 || lz < z0 - 2 || lz > z1 + 2) return null;
    let h = spec.base ?? 0.3;
    h += 0.12 * Math.sin(lx * 0.31) * Math.cos(lz * 0.27);
    for (const m of spec.mounds || []) { const d = Math.hypot(lx - m[0], lz - m[1]); if (d < m[2]) h += m[3] * (1 - d / m[2]) ** 2; }
    for (const r of spec.deep || []) {
      const dx = Math.max(r[0] - lx, 0, lx - r[2]), dz = Math.max(r[1] - lz, 0, lz - r[3]), d = Math.hypot(dx, dz);
      if (d === 0) h = -1.6; else if (d < 1) h = Math.min(h, -1.6 + d * 1.9);
    }
    if (lx < x0 || lx > x1 || lz < z0 || lz > z1) h -= 0.6;
    return h;
  };
}

// ---- the eight hand-built maps -----------------------------------------------------------
// Heights: walkers reach ~4.1 (double jump + step), Bear ~3.8, Trickster flight capped at +3.4 above
// the floor, so 5.2+ ledges need a Bear boost; 7+ walls stop everyone but Scouts (who stop at `ceil`).
const ring = (n, rx, rz, cz, skip = []) => Array.from({ length: n }, (_, i) => (Math.PI * 2 / n) * i).filter((t, i) => !skip.includes(i)).map(t => [Math.cos(t) * rx, Math.sin(t) * rz + cz]);

// Levels that are playable right now; the rest show "coming soon" until their patch ships
export const READY_LEVELS = new Set(['sunny_hollow', 'creek_bend', 'moon_meadow', 'log_jam', 'picnic_lawn']);

const MAPS = {
  sunny_hollow: {
    goal: 'Ring the Sunflower bell, pull the lever, shove the log · then all three to the 🏁 exit',
    key: 'puzzles', ceil: 12, exit: [0, -10],
    bounds: { x0: -24, x1: 24, z0: -14, z1: 22 }, mounds: [[-12, 12, 3, 1], [12, 14, 3, 1], [-4, 6, 2.2, 0.8]],
    crew: 'Bee · Raccoon · Bear',
    par: 240,
    banter: {
      start: ['🐝 Bee: Wow, Sunny Hollow! I can fly up high!', '🦝 Raccoon: I\'ll handle the levers and the tricky stuff.', '🐻 Bear: And I\'ll move anything heavy. Let\'s go!'],
      end: ['🐝 Bee: We did it — together!', '🦝 Raccoon: Teamwork makes the meadow work.', '🐻 Bear: Snack time? Snack time!'],
    },
    intro: ['Tap a portrait (or 1 · 2 · 3) to swap. Friends you leave behind stay put!'],
    tutor: [
      { until: 'sun', say: '🐦 Pip: Swap to 🐝 Bee (1). Only a flyer can reach the bell on the Big Sunflower — fly north and touch it!' },
      { until: 'patch', say: '🐦 Pip: Now swap to 🦝 Raccoon (2). Hop into the dirt dip (south-west) and tap 🤝 Interact to pull the lever.' },
      { until: 'glade', say: '🐦 Pip: Swap to 🐻 Bear (3). Walk to the fallen log by the east hedge and tap 🤝 Interact to shove it.' },
      { until: 'boostStar', optional: true, say: '🐦 Pip: Secret! Park 🐻 Bear by the tall rock, swap to 🦝 Raccoon, hop on his back and up the ledge. Bear makes a great step!' },
    ],
    build(B) {
      B.rim(12);
      ring(18, 21, 15.5, 4, [0, 9]).forEach(([x, z], i) => B.tree(x, z, 0.95 + (i % 3) * 0.1));
      B.home(0, 0);
      // 1 · Scout: Big Sunflower bell
      B.sunflower(0, 14);
      B.bell('sun', 0, 13.2, 6.7, { label: 'Big Sunflower bell' });
      [[-12, 12], [12, 14], [-4, 6]].forEach(([x, z], k) => { for (let i = 0; i < (k < 2 ? 3 : 2); i++) { const a = i * 2.1 + k; B.pickup('petal', x + Math.cos(a) * 1.4, z + Math.sin(a) * 1.4, 1.9, { show: 'sun' }); } });
      // 2 · Trickster: rabbit-hole lever opens the Petal Patch
      B.cage(-15, 3, 7, 7, 3.4, { gate: 'e', gateSig: 'patch', look: 'hedge' });
      B.dip(-8, -4); B.lever('patch', -8, -4, { label: 'Rabbit-hole lever' });
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; B.pickup('petal', -15 + Math.cos(a) * 1.8, 3 + Math.sin(a) * 1.8, 0.9); }
      // 3 · Bruiser: fallen log blocks the Bee Glade door
      B.cage(16, 6, 8, 8, 3.4, { gate: 'w', open: true, gateH: 1.8, look: 'hedge' });
      B.glade(16, 6, 0xffe08a);
      B.boulder('glade', 11.4, 6, 10.2, 10.6, { kind: 'log', w: 1.6, d: 3.2, h: 1.9, slotH: 1.0, label: 'Fallen log' });
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; B.pickup('petal', 16.5 + Math.cos(a) * 2, 6 + Math.sin(a) * 2, 0.9); }
      // 4 · First boost (bonus): Starseed on a ledge just too tall to hop
      B.wall(7, -9, 4, 4, 5.2, { look: 'stone' });
      B.marker('bruiser', 7, -6.2, 0.4, 'Boost spot: park Bear here');
      B.pickup('star', 7, -9, 6.0, { who: ['trickster'], whyNot: 'Only a Trickster can carry a Starseed down — boost one up on Bear!', set: 'boostStar' });
      [[-4, -6], [4, -4], [-9, 9], [8, 11], [-18, -6], [19, -5]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      B.puzzle('sun', 'Big Sunflower bell', ['scout'], ['sun'], { hint: '🪽 Swap to your Scout and fly up to the bell on the Big Sunflower (north).' });
      B.puzzle('patch', 'Rabbit-hole lever', ['trickster'], ['patch'], { hint: '🐾 Your Trickster can pull the lever in the dirt dip (south-west) to open the Petal Patch.' });
      B.puzzle('glade', 'Fallen-log gate', ['bruiser'], ['glade'], { hint: '🐻 Swap to Bear and shove the fallen log off the Bee Glade door (east).' });
      B.puzzle('boost', 'First boost', ['bruiser', 'trickster'], ['boostStar'], { req: false, hint: '🐻 Park Bear by the tall rock, then hop your Trickster onto his back and up!' });
    },
  },

  creek_bend: {
    goal: 'Bridge the creek, fix the ford, ring the willow bell · then all three to the 🏁 exit across the water',
    key: 'puzzles', ceil: 11, exit: [16, 19], par: 300,
    banter: {
      start: ['🦝 Raccoon: Uh-oh. That creek is way too deep to swim.', '🐝 Bee: Not for me! I\'ll just fly over.', '🐻 Bear: Then you two find me a path. I\'m not a fish.'],
      end: ['🐻 Bear: Dry paws! Best day ever.', '🐝 Bee: Great holding, Raccoon!', '🦝 Raccoon: Any time. Plates are my thing.'],
    },
    bounds: { x0: -26, x1: 26, z0: -12, z1: 24 }, deep: [[-26, 7, 26, 12]],
    crew: 'Bee · Raccoon · Bear',
    intro: ['🌊 Only the Scout can fly over deep water. 🐾 Tricksters cross thin planks. 🐻 Bear needs a stone ford.', 'Leave a friend on a plate and they keep holding it while you swap!'],
    build(B) {
      B.rim(11); B.water();
      B.home(0, 0);
      [[-22, -8], [22, -8], [-22, 20], [24, 14], [-18, -2]].forEach(([x, z]) => B.tree(x, z, 1.1));
      // 1 · Trickster plank bridge (too thin for Bear)
      B.plank('plank', -12, 5.4, -12, 13.6, { thin: true, label: 'Plank Bridge spot' });
      // 2 · Scout blossom lowers the water · Bear shoves a boulder into the ford
      B.reed(13, 18, 4.2); B.bell('low', 13, 18, 4.9, { label: 'Blossom switch' });
      B.boulder('ford', 8, 2.5, 13, 9.5, { kind: 'boulder', w: 3.2, d: 3.6, h: 1.8, slotH: 0.55, need: ['low'], needWhy: 'The water is too high — ring the blossom switch with a Scout first', cross: [11.2, 6.4, 14.8, 12.6], label: 'Ford boulder' });
      // 3 · Hold-and-go: Trickster holds the dam plate, Bear climbs, smashes the branch cage, Scout rings the willow bell
      B.wall(3, 19, 12, 7, 5.2, { look: 'cliff' });
      [[-6.4, 1.3], [-5.3, 2.6], [-4.2, 3.9]].forEach(([x, h]) => B.wall(x, 19, 1.1, 2.6, h, { look: 'wood' }));
      B.wall(-5.2, 17.45, 4.4, 0.5, 5.2, { look: 'cliff' }); B.wall(-5.2, 20.55, 4.4, 0.5, 5.2, { look: 'cliff' });
      B.gate('dam', -7.5, 19, 0.6, 3.6, 5.2, { label: 'Dam gate' });
      B.plate('dam', -9, 15.6, { label: 'dam plate' });
      B.cage(5, 19.5, 3.6, 3.6, 3, { base: 5.2, cracked: 'w', crackSig: 'branch', look: 'hedge', label: 'Willow branches' });
      B.bell('willow', 5.4, 19.5, 6.8, { label: 'Willow bell' });
      B.tree(7.5, 21.6, 1.2, 5.2);
      // 4 · Secret: a Starseed on the tall east rock (boost from Bear once he's across)
      B.wall(22, 23, 3, 3, 5.2, { look: 'stone' });
      B.pickup('star', 22, 23, 6.0, { who: ['trickster'], whyNot: 'Too far up to carry for a Scout — boost your Trickster off Bear!', set: 'creekStar' });
      [[-6, -4], [6, -5], [-14, 2], [18, 3], [-17, 17], [-10, 21], [16, 15], [12, 22], [10, 14]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      [[0, 17.5], [2, 21], [8.5, 17]].forEach(([x, z]) => B.pickup('petal', x, z, 6.0));
      B.puzzle('plank', 'Plank Bridge', ['trickster'], ['plank'], { hint: '🐾 Swap to your Trickster and build the Plank Bridge at the narrow creek (west).' });
      B.puzzle('ford', 'Ford stones', ['scout', 'bruiser'], ['ford'], { hint: '🪽 Ring the blossom switch across the creek, then 🐻 shove the boulder into the ford.' });
      B.puzzle('willow', 'Willow Lookout', ['trickster', 'bruiser', 'scout'], ['willow'], { hint: '🐾 Park your Trickster on the dam plate · 🐻 Bear climbs and smashes the branches · 🪽 Scout rings the willow bell.' });
      B.puzzle('creekStar', 'Secret Starseed', ['bruiser', 'trickster'], ['creekStar'], { req: false, hint: '🐻 Park Bear by the tall east rock, then boost your Trickster up.' });
    },
  },

  moon_meadow: {
    goal: 'Light the knotholes, open the roots, open the Crown · then all three into the Hollow Oak 🏁',
    key: 'puzzles', ceil: 16, nightCycle: 180, dewWindow: 20, exit: [0, 14.6, 2.4], par: 360,
    banter: {
      start: ['🐻 Bear: It\'s so dark. Is that tree... hollow?', '🐝 Bee: I see little knotholes. I can squeeze in!', '🦝 Raccoon: And I smell soft dirt. Time to dig!'],
      end: ['🐝 Bee: The whole oak is glowing!', '🐻 Bear: Cozy in here. Can we stay?', '🦝 Raccoon: Only if you share the snacks.'],
    },
    bounds: { x0: -22, x1: 22, z0: -12, z1: 26 },
    crew: 'Bee · Raccoon · Bear',
    intro: ['🌙 The exit is inside the Hollow Oak, behind tough roots.', '🪽 Scouts slip through knotholes · 🐾 Tricksters dig · 🐻 Bruisers smash roots', '🌙 At night, bonus Petals sparkle for a little while!'],
    build(B) {
      B.rim(16); B.home(0, 0);
      ring(14, 19, 15, 6, [3, 4, 10]).forEach(([x, z]) => B.tree(x, z, 1.0, 0, 0x2f5e3a));
      // Hollow Oak shell (8×8, 12 tall) + mid floor + crown deck
      const O = { look: 'bark' };
      B.wall(0, 18, 8, 1, 12, O); B.wall(4, 14, 1, 8, 12, O); B.wall(-4, 14, 1, 8, 12, O);
      B.wall(-2.65, 10, 2.7, 1, 12, O); B.wall(2.65, 10, 2.7, 1, 12, O); B.wall(0, 10, 2.6, 1, 12, { ...O, bot: 2.6 });
      B.wall(0, 14, 8, 8, 7.4, { ...O, bot: 7 }); B.wall(0, 14, 9.4, 9.4, 12.4, { look: 'leaf', bot: 12 });
      // 2 · Root Tunnel: Trickster digs into the root den, pulls the lever; Bear smashes the cracked root wall
      B.cracked('rootWall', 0, 10, 2.6, 1, 2.6, { need: ['root'], needWhy: 'Roots are too tough — a Trickster must pull the lever in the root den first', label: 'Cracked roots' });
      B.cage(-9, 7, 3.4, 3.4, 2.4, { closed: true, look: 'dirt' });
      B.dig('den', -9, 3.6, -9, 7, { label: 'Soft dirt' });
      B.lever('root', -9.6, 7.6, { label: 'Root lever' });
      // secret: a Starseed hidden on the oak's leafy crown corner — only a flyer gets up there
      B.pickup('star', 4.2, 18.2, 13.4, { who: ['scout'], whyNot: 'Only a Scout can carry this from way up here!', set: 'moonStar' });
      B.pickup('dew', -2.2, 16.4, 1); B.pickup('dew', 2.2, 16.4, 1);
      // 1 · Knothole lanterns (Scout slips in, rings the lantern)
      [[5.9, 14, 2.4, 1, 'lan1', 'e'], [-5.9, 14, 5.4, -1, 'lan2', 'w'], [0, 19.9, 8.4, 0, 'lan3', 'n']].forEach(([x, z, base, sx, sig]) => {
        const ns = sx === 0;
        B.cage(x, z, ns ? 2.8 : 2.8, 2.8, 2.4, { base, floor: true, closed: true, look: 'bark' });
        const ox = ns ? 0 : sx * 2.6, oz = ns ? 2.6 : 0;
        B.slip(x + ox, z + oz, base + 1.0, x, z, base + 0.3, { label: 'Knothole' });
        B.bell(sig, x - (ns ? 0 : sx * 0.7), z - (ns ? 0.7 : 0), base + 1.3, { label: 'Lantern', lantern: true });
        B.pickup('dew', x * 1.9 + (ns ? 6 : 0), z + (ns ? 2 : -6), 1, { show: sig });
      });
      // 3 · Mid Window boost: Bear under the window, Trickster climbs him, throws an acorn at the crown bell
      B.wall(0, 8.9, 3, 1.6, 5.2, { look: 'bark', bot: 4.6 });
      B.marker('bruiser', 0, 7.4, 0.3, 'Park Bear under the Mid Window');
      B.target('crown', 3.4, 9.4, 11.2, { from: { x: 0, z: 8.9, r: 1.9, minH: 4.8 }, range: 14, label: 'Crown bell', fromWhy: 'Throw from the Mid Window ledge — boost up on Bear!' });
      B.cage(0, 14, 5, 5, 2.6, { base: 12.4, gate: 's', gateSig: 'crown', look: 'leaf' });
      for (let i = 0; i < 5; i++) B.pickup('dew', -1.4 + (i % 3) * 1.4, 13.4 + (i > 2 ? 1.4 : 0), 13.4);
      [[-14, -2], [14, -4], [-16, 16], [16, 20]].forEach(([x, z]) => B.pickup('dew', x, z, 1));
      B.nightDew(-8, 20, 1.2); B.nightDew(8, 22, 1.2); B.nightDew(-12, 0, 1.2); B.nightDew(12, 4, 1.2);
      B.puzzle('lanterns', 'Knothole lanterns', ['scout'], ['lan1', 'lan2', 'lan3'], { hint: '🪽 Fly your Scout to the knotholes on the oak and slip inside to light each lantern.' });
      B.puzzle('roots', 'Root Tunnel', ['trickster', 'bruiser'], ['rootWall'], { hint: '🐾 Dig into the soft dirt west of the oak and pull the root lever, then 🐻 smash the cracked roots.' });
      B.puzzle('crown', 'Crown door', ['bruiser', 'trickster', 'scout'], ['crown'], { hint: '🐻 Park Bear under the Mid Window · 🐾 hop up and throw at the crown bell · 🪽 fly in for the Dewdrops.' });
      B.puzzle('moonStar', 'Secret Starseed', ['scout'], ['moonStar'], { req: false, hint: '🪽 Something sparkles on the very top corner of the oak…' });
    },
  },

  log_jam: {
    goal: 'Clear the three jams · then all three up the tower to the 🏁 exit',
    key: 'puzzles', ceil: 12, exit: [0, 30, 2.6, 9.4], par: 420,
    banter: {
      start: ['🐝 Bee: Whoa, logs everywhere! The canyon is all jammed up.', '🐻 Bear: Logs? Finally, a job for me!', '🦝 Raccoon: You push, I climb. Deal?'],
      end: ['🦝 Raccoon: Look how high we are!', '🐝 Bee: Bear built us a whole staircase!', '🐻 Bear: I\'m basically a builder now.'],
    },
    bounds: { x0: -9, x1: 9, z0: -10, z1: 34 },
    crew: 'Bee or Bumblebee · Raccoon · Bear',
    intro: ['🪵 Bear builds the way — shove logs into stair slots.', 'Heavy plates only hold while Bear sits on them.'],
    build(B) {
      const C = { look: 'cliff' };
      B.wall(-9.4, 12, 1, 46, 12, C); B.wall(9.4, 12, 1, 46, 12, C); B.wall(0, -10.4, 20, 1, 12, C); B.wall(0, 34.4, 20, 1, 12, C);
      B.home(0, 0);
      // Jam 1 (7 tall): two logs make a stair, Trickster pulls the drain lever on top
      B.wall(-5, 6, 8, 1.6, 7, { look: 'log' }); B.wall(5, 6, 8, 1.6, 7, { look: 'log' });
      B.gate('jam1', 0, 6, 2.2, 1.6, 7, { latch: true, label: 'Jam 1' });
      B.boulder('logA', -5, 0.5, 3.6, 4.4, { kind: 'log', w: 2.4, d: 1.4, h: 1.0, slotH: 2.4, label: 'Loose log' });
      B.boulder('logB', 5, -3, 6.4, 4.4, { kind: 'log', w: 2.4, d: 1.4, h: 1.0, slotH: 4.6, label: 'Loose log' });
      B.lever('jam1', 5.2, 6, { base: 7, label: 'Drain lever' });
      for (let i = 0; i < 4; i++) B.pickup('petal', -6.5 + i, 10.5, 0.9);
      // Jam 2 (12 tall): heavy plate opens a high gap; Scout flies through and rings the gate bell
      B.wall(-5.1, 15, 7.6, 1.6, 12, C); B.wall(0, 15, 2.4, 1.6, 12, { ...C, bot: 3.4 }); B.wall(1.9, 15, 1.4, 1.6, 12, C);
      B.wall(4, 15, 2.8, 1.6, 4.8, C); B.wall(4, 15, 2.8, 1.6, 12, { ...C, bot: 7.4 }); B.wall(7.1, 15, 3.4, 1.6, 12, C);
      B.gate('gap', 4, 15, 2.8, 1.6, 7.4, { bot: 4.8, label: 'High gap' });
      B.gate('jam2', 0, 15, 2.4, 1.6, 3.4, { latch: true, label: 'Jam 2' });
      B.plate('gap', 4, 12, { heavy: true, label: 'heavy plate' });
      B.bell('jam2', 0, 17.6, 3.0, { label: 'Gate bell' });
      for (let i = 0; i < 4; i++) B.pickup('petal', 3.5 + i, 20.5, 0.9);
      // Tower Jam: log ramp → vine → pebble throw drops the rope → Scout hooks it → stairs for all
      B.wall(0, 29, 10, 6, 9.4, { look: 'log' });
      B.boulder('logC', -5.5, 19.5, -3, 24.8, { kind: 'log', w: 2.2, d: 1.6, h: 1.0, slotH: 2.6, label: 'Ramp log' });
      B.wall(-3, 25.4, 2, 1.2, 7.2, { look: 'log', bot: 6.6 });
      B.vine(-3, 24.4, 2.6, -3, 25.4, 7.3, { need: ['logC'], needWhy: 'Shove the ramp log under the vine first (Bear)', label: 'Vine' });
      B.target('rope', 8.6, 23, 8.2, { from: { x: -3, z: 25.4, r: 1.7, minH: 6.8 }, range: 14, label: 'Rope target', fromWhy: 'Climb the vine to the ledge first, then throw' });
      B.bell('hook', 3, 25.4, 10.2, { need: ['rope'], needWhy: 'The rope is still tied up — a Trickster must knock it down first', label: 'Rope hook' });
      B.steps('hook', [[6.9, 32.4, 3, 1.6, 1.9], [6.9, 30.8, 3, 1.6, 3.8], [6.9, 29.2, 3, 1.6, 5.7], [6.9, 27.6, 3, 1.6, 7.6]]);
      // secret: Starseed on a high nook beside the tower — boost a Trickster off Bear
      B.wall(-7.2, 31.5, 3, 3, 5.2, { look: 'log' });
      B.pickup('star', -7.2, 31.5, 6.0, { who: ['trickster'], whyNot: 'Too heavy for a Scout — boost your Trickster off Bear!', set: 'jamStar' });
      B.cave(0, 33);
      [[-3, -5], [3, -6], [0, 11], [-6, 18], [3, 21], [0, 23]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      B.puzzle('jam1', 'Stair builder', ['bruiser', 'trickster'], ['jam1'], { hint: '🐻 Shove both loose logs into the stair slots · 🐾 climb up and pull the drain lever.' });
      B.puzzle('jam2', 'Heavy plate', ['bruiser', 'scout'], ['jam2'], { hint: '🐻 Park Bear on the heavy plate · 🪽 fly through the high gap and ring the gate bell.' });
      B.puzzle('tower', 'Tower climb', ['bruiser', 'trickster', 'scout'], ['hook'], { hint: '🐻 Shove the ramp log · 🐾 climb the vine and throw at the rope · 🪽 ring the rope hook.' });
      B.puzzle('jamStar', 'Secret Starseed', ['bruiser', 'trickster'], ['jamStar'], { req: false, hint: '🐻 Park Bear by the high nook west of the tower, then boost your Trickster.' });
    },
  },

  picnic_lawn: {
    goal: 'Pop the basket · two-plate table · dam the lemonade · then all three across to the 🏁 exit',
    key: 'puzzles', ceil: 12, exit: [14, 21], par: 360,
    banter: {
      start: ['🐻 Bear: A picnic! Is any of this for me?', '🦝 Raccoon: Focus, Bear. The lemonade river is in the way.', '🐝 Bee: Sticky river… I\'ll stay up high, thanks!'],
      end: ['🦝 Raccoon: Best. Picnic. Ever.', '🐻 Bear: I found a crumb! Mission complete.', '🐝 Bee: You two are the best team.'],
    },
    bounds: { x0: -24, x1: 26, z0: -12, z1: 26 }, deep: [[-24, 10, 26, 14]], lemonade: true,
    crew: 'Bee · Raccoon · Bear',
    intro: ['🧺 Tricksters can throw acorns at far switches.', 'Two plates? Park two friends — the third one goes!'],
    build(B) {
      B.rim(12); B.water(0xffd65a); B.home(0, 0);
      [[-16, -6, 0xff8a8a], [-4, -9, 0x8ab4ff], [16, 18, 0xffe08a], [-16, 18, 0xc9b6ff]].forEach(([x, z, c]) => B.blanket(x - 4, z - 3, 8, 6, c));
      // 1 · Basket lid across the stream (Trickster throw)
      B.cyl(-12, 19, 2.4, 2.4, 0xc8a060); B.target('lid', -12, 19, 3.1, { range: 14, label: 'Basket latch' });
      for (let i = 0; i < 6; i++) B.pickup('petal', -14 + (i % 3) * 2, 5 + (i > 2 ? 2 : 0), 0.9, { show: 'lid' });
      // 2 · Two-plate table: Bear + Trickster hold, Scout zips into the cloche
      B.table(10, 4, 6, 4, 3.4);
      B.cage(10, 4, 2.8, 2.8, 2.2, { base: 3.4, gate: 's', gateSig: ['pH', 'pL'], look: 'glass' });
      B.plate('pH', 5, -1.5, { heavy: true, label: 'heavy plate' }); B.plate('pL', 15, -1.5, { label: 'light plate' });
      B.pickup('petal', 10, 4.3, 4.4, { who: ['scout'], whyNot: 'Only a Scout fits inside the cloche', set: 'bunch' });
      for (let i = 0; i < 3; i++) B.pickup('petal', 9 + i, 3.2, 4.3, { show: 'bunch' });
      // 3 · Lemonade dam: Bear shoves a basket into the stream, Scout rings the cup bell
      B.boulder('dam', 2, 7, 2, 12, { kind: 'basket', w: 2.8, d: 3, h: 1.6, slotH: 0.6, cross: [0.4, 9.2, 3.6, 14.8], label: 'Picnic basket' });
      B.wall(8, 19, 1.6, 1.6, 4.2, { look: 'cream' }); B.bell('cup', 8, 19, 5.1, { label: 'Cup bell' });
      for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; B.pickup('petal', -6 + Math.cos(a) * 1.6, 3 + Math.sin(a) * 1.6, 0.9); }
      for (let i = 0; i < 4; i++) B.pickup('petal', 16 + (i % 2) * 2, 20 + (i > 1 ? 2 : 0), 0.9, { show: 'cup' });
      // secret: Starseed on top of the tall cooler (north-west) — boost a Trickster off Bear
      B.wall(-20, 21, 3, 3, 5.2, { look: 'cream' });
      B.pickup('star', -20, 21, 6.0, { who: ['trickster'], whyNot: 'Too heavy for a Scout — boost your Trickster off Bear!', set: 'picStar' });
      [[-2, -4], [4, -6], [20, -6], [-20, 0], [20, 6], [-6, 20]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      B.tree(-22, -10, 1); B.tree(24, -10, 1); B.tree(24, 24, 1); B.tree(-22, 24, 1);
      B.puzzle('lid', 'Basket lid', ['trickster'], ['lid'], { hint: '🐾 Swap to your Trickster and throw an acorn at the basket latch across the stream.' });
      B.puzzle('table', 'Two-plate table', ['bruiser', 'trickster', 'scout'], ['bunch'], { hint: '🐻 Bear on the heavy plate · 🐾 Trickster on the light plate · 🪽 Scout flies into the cloche.' });
      B.puzzle('dam', 'Lemonade dam', ['bruiser', 'scout'], ['dam', 'cup'], { hint: '🐻 Shove the basket into the stream · 🪽 ring the cup bell to switch the lemonade.' });
      B.puzzle('picStar', 'Secret Starseed', ['bruiser', 'trickster'], ['picStar'], { req: false, hint: '🐻 Park Bear by the tall cooler, then boost your Trickster up.' });
    },
  },

  cliff_orchard: {
    goal: 'Boulder Stair · waterfall switch · ring the Moonfruit bell, grab the Starseed',
    key: 'puzzles', ceil: 20, nightCycle: 180, dewWindow: 20,
    bounds: { x0: -20, x1: 20, z0: -12, z1: 26 },
    crew: 'Hummingbird · Bat · Bear',
    intro: ['🍎 Cliff Orchard: climb ledge by ledge as a team.', 'Boost chain: Bear is a step for your Trickster.'],
    build(B) {
      B.rim(20); B.home(0, 0);
      B.wall(0, 18, 40, 16, 7, { look: 'cliff' });           // ledge 1 (top 7)
      B.wall(0, 22, 40, 8, 11.6, { look: 'cliff', bot: 6.8 }); // ledge 2 (top 11.6)
      B.wall(-12, 24, 8, 4, 16.8, { look: 'cliff', bot: 11.4 }); // Moonfruit Shelf (top 16.8)
      [[-16, -6], [16, -6], [-6, -9], [6, -9]].forEach(([x, z]) => B.tree(x, z, 1, 0, 0x4f9a3e, true));
      [[-14, 13], [12, 13], [14, 21]].forEach(([x, z]) => B.tree(x, z, 0.9, z > 18 ? 11.6 : 7, 0x4f9a3e, true));
      // 1 · Boulder Stair (Bear): two boulders make the stair, a third weighs the ledge gate plate
      B.boulder('b1', -10, 2, -12, 9.1, { kind: 'boulder', w: 2.4, d: 1.8, h: 1.6, slotH: 2.4, label: 'Boulder' });
      B.boulder('b2', -5, 2, -14.6, 9.1, { kind: 'boulder', w: 2.4, d: 1.8, h: 1.6, slotH: 4.6, label: 'Boulder' });
      B.boulder('b3', -4, 12.5, 1.6, 12.5, { kind: 'boulder', w: 2, d: 2, h: 1.5, slotH: 1.0, base: 7, label: 'Plate boulder' });
      B.plateDecor(1.6, 12.5, 7);
      B.gate('b3', 4, 14, 0.8, 8, 3.6, { bot: 7, base: 7, latch: true, label: 'Ledge gate' });
      // 2 · Waterfall switch (Trickster throw from the lip) opens the cave stair
      B.waterfall(10, 18, 2.4, 7, 11.6); B.pool(10, 15, 3, 7);
      B.pickup('dew', 9, 14, 7.8); B.pickup('dew', 11, 15.5, 7.8);
      B.target('cave', 10, 18.1, 9.4, { from: { x: 10, z: 13, r: 2.6, minH: 6.6 }, range: 9, label: 'Switch behind the waterfall', fromWhy: 'Stand on the ledge lip in front of the waterfall to throw' });
      B.steps('cave', [[16, 17.1, 2.4, 1.8, 9.2]], 7);
      // 3 · Boost chain: Bear on ledge 2, Trickster hops to the shelf lever, Scout rings the Moonfruit bell
      B.marker('bruiser', -9, 21.2, 11.8, 'Park Bear here');
      B.lever('shelf', -14.5, 24.4, { base: 16.8, label: 'Shelf lever' });
      B.cage(-10, 24, 3, 3, 2.4, { base: 16.8, gate: 's', gateSig: 'shelf', look: 'leaf' });
      B.bell('moon', -10, 24.4, 18.1, { label: 'Moonfruit bell' });
      B.pickup('star', -10, 23.6, 17.6, { show: 'moon', who: ['scout'], whyNot: 'Only a Scout can reach inside', set: 'star' });
      B.node('heavy', 6, 22, 11.6, { sig: 'fruit' });
      B.nightDew(-14, 22, 12.6); B.nightDew(14, 23, 12.6); B.nightDew(0, 12, 7.8);
      [[-4, -4], [4, -4], [12, 2], [-12, 13], [6, 12], [-6, 21]].forEach(([x, z]) => B.pickup('petal', x, z, z > 18 ? 12.4 : z > 10 ? 7.8 : 0.9));
      B.puzzle('stair', 'Boulder Stair', ['bruiser'], ['b1', 'b2', 'b3'], { hint: '🐻 Shove both boulders into the stair slots by the cliff, then the third onto the ledge plate.' });
      B.puzzle('cave', 'Waterfall switch', ['trickster'], ['cave'], { hint: '🐾 From the ledge lip, throw an acorn at the switch behind the waterfall.' });
      B.puzzle('moon', 'Moonfruit Shelf', ['bruiser', 'trickster', 'scout'], ['star'], { hint: '🐻 Park Bear by the shelf · 🐾 hop up and pull the lever · 🪽 ring the Moonfruit bell and grab the Starseed.' });
      B.puzzle('fruit', 'Heavy fruit', ['bruiser'], ['fruit'], { req: false });
    },
  },

  windy_rise: {
    goal: 'Cross the gully · thread the wind hoops · haul the Fork Tree Honey Log',
    key: 'puzzles', ceil: 14,
    bounds: { x0: -10, x1: 40, z0: -14, z1: 20 }, deep: [[12, -14, 16, 20]],
    wind: { x0: 18, x1: 36, z0: 0, z1: 14, every: 4, dur: 1.3, push: 6 },
    crew: 'Butterfly · Opossum · Bear',
    intro: ['💨 Windy Rise: gusts blow on a rhythm — glide between them.', 'Bear + Trickster build the gully crossing together.'],
    build(B) {
      B.rim(14); B.water(); B.home(0, 0);
      [[-6, -10], [-6, 14], [6, 16], [38, 16], [38, -12]].forEach(([x, z]) => B.tree(x, z, 1.2));
      // 1 · Gully: Bear shoves a log in, Trickster lays planks on it
      B.boulder('logIn', 6, -3, 14, 0, { kind: 'log', w: 4.4, d: 2, h: 1.1, slotH: -0.4, label: 'Gully log' });
      B.plank('plank', 11.2, 0, 16.8, 0, { need: ['logIn'], needWhy: 'Planks need a log underneath — Bear shoves one in first', label: 'Plank spot' });
      // 2 · Wind gate: three streamer hoops, then the canopy bell
      B.hoops('w', [[20, 6, 5], [26, 10, 7], [32, 6, 9]]);
      B.tree(36, 2, 1.7); B.bell('canopy', 36, 2, 10.2, { need: ['w3'], needWhy: 'Fly through all three streamer hoops first', label: 'Canopy bell' });
      // 3 · Fork Tree: Trickster climbs + lever lowers the basket, Bear loads the log, Scout hauls it up
      B.wall(28, -7, 2.4, 2.4, 10.4, { look: 'bark' });
      B.wall(28, -7, 5, 5, 5.4, { look: 'leaf', bot: 4.8 });
      B.vine(28, -3.9, 0, 28, -5.6, 5.5, { label: 'Fork vine' });
      B.lever('basket', 26.4, -8.2, { base: 5.4, label: 'Basket lever' });
      B.boulder('loaded', 21, -10, 31.6, -9.6, { kind: 'log', w: 2.6, d: 1.4, h: 1.1, slotH: 1.2, need: ['basket'], needWhy: 'Lower the basket first — a Trickster pulls the lever up in the Fork Tree', label: 'Honey Log' });
      B.basketDecor('basket', 31.6, -9.6);
      B.bell('hauled', 28, -7, 11.6, { need: ['loaded'], needWhy: 'Load the Honey Log into the basket first (Bear)', label: 'Haul bell' });
      [[-4, -4], [4, 6], [22, -2], [30, 2], [34, 12], [24, 14]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      B.puzzle('gully', 'Gully crossing', ['bruiser', 'trickster'], ['plank'], { hint: '🐻 Shove the log into the gully · 🐾 then build the planks on top.' });
      B.puzzle('wind', 'Wind gate', ['scout'], ['canopy'], { hint: '🪽 Glide through the three pink hoops in order between gusts, then ring the canopy bell.' });
      B.puzzle('fork', 'Fork Tree Honey Log', ['trickster', 'bruiser', 'scout'], ['hauled'], { hint: '🐾 Climb the Fork Tree vine and pull the lever · 🐻 shove the Honey Log into the basket · 🪽 ring the bell on top.' });
    },
  },

  festival_glade: {
    goal: 'Timber Stage · Lantern Lane · Cliff Seats · carry the Starheart home',
    key: 'puzzles', star: true, ceil: 14, nightCycle: 180, dewWindow: 20,
    bounds: { x0: -26, x1: 26, z0: -12, z1: 30 }, deep: [[-26, 6, 26, 9.5]],
    crew: 'Any Scout · Trickster · Bruiser',
    intro: ['🎉 Festival Glade: every district needs a different combo.', 'Open all three to free the Starheart on the knoll!'],
    build(B) {
      B.rim(14); B.water(0x7fc0ff); B.home(0, 0);
      B.bridgeFixed(-20, 4.6, -20, 10.9, 4); // wide bridge (everyone) west
      B.plank('plank', 0, 4.6, 0, 10.9, { thin: true, label: 'Creek plank spot' });
      // Lookout Knoll + Starheart cage (opens when all three districts are done)
      [[7, 1.4], [5.2, 2.8], [3.8, 4.2]].forEach(([r, h]) => B.cyl(0, 20, r, h, 0x7cc35a));
      B.cage(0, 20, 3.2, 3.2, 2.6, { base: 4.2, gate: 's', gateSig: ['d1', 'd2', 'd3'], look: 'gold' });
      B.starheart(0, 20, 4.2, [[0, 20, 4.2], [0, 15.6, 2.8], [0, 14.2, 1.4], [0, 2, 0.4]]);
      // D1 Timber Stage: Bear builds the stair, Trickster pulls the curtain lever
      B.wall(-15, 21, 8, 5, 7, { look: 'log' });
      B.boulder('s1', -12, 13, -13.4, 17.6, { kind: 'log', w: 2.4, d: 1.4, h: 1.0, slotH: 2.4, label: 'Stage log' });
      B.boulder('s2', -18, 13, -16.4, 17.6, { kind: 'log', w: 2.4, d: 1.4, h: 1.0, slotH: 4.6, label: 'Stage log' });
      B.lever('d1', -15, 21.5, { base: 7, label: 'Curtain lever' });
      B.banner(-18.5, 23.4, 7); B.banner(-11.5, 23.4, 7);
      // D2 Lantern Lane: Trickster holds the shutter plate, Scout slips in and lights both lanterns
      B.cage(15, 21, 5, 4, 3, { closed: true, look: 'wood' });
      B.slip(15, 17.9, 1.4, 15, 20, 0.4, { needIn: ['shutter'], needWhy: 'The knothole shutter is closed — park a friend on the shutter plate', label: 'Knothole shutter' });
      B.plate('shutter', 10.5, 16.5, { label: 'shutter plate' });
      B.bell('l1', 14, 22, 1.8, { label: 'Lantern', lantern: true }); B.bell('l2', 16, 22, 1.8, { label: 'Lantern', lantern: true });
      // D3 Cliff Seats & Picnic Tiers: Bear plate + Trickster throw open the seat box, Scout rings the seat bell
      B.wall(20, -3, 6, 6, 1.2, { look: 'stone' }); B.wall(21, -3, 4, 6, 2.4, { look: 'stone' });
      B.cage(17, -3, 3, 3, 2.4, { gate: 'w', gateSig: ['seatP', 'tierT'], look: 'wood' });
      B.plate('seatP', 11, -7, { heavy: true, label: 'seat plate' });
      B.wall(23, -10, 0.6, 0.6, 4, { look: 'wood' }); B.target('tierT', 23, -10, 4.6, { range: 14, label: 'Picnic Tier flag' });
      B.bell('d3', 17, -3, 1.6, { label: 'Seat bell' });
      [[-22, 0], [22, 2], [-8, -6], [8, -8], [-20, 16], [22, 26]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      B.nightDew(-6, 26, 1.2); B.nightDew(6, 26, 1.2);
      B.tree(-24, -10, 1.1); B.tree(24, 28, 1.1); B.tree(-24, 28, 1.1);
      B.puzzle('d1', 'Timber Stage', ['bruiser', 'trickster'], ['d1'], { hint: '🐻 Shove both stage logs into the stair · 🐾 climb up and pull the curtain lever.' });
      B.puzzle('d2', 'Lantern Lane', ['trickster', 'scout'], ['l1', 'l2'], { hint: '🐾 Park your Trickster on the shutter plate · 🪽 slip through the knothole and light both lanterns.' });
      B.puzzle('d3', 'Cliff Seats', ['bruiser', 'trickster', 'scout'], ['d3'], { hint: '🐻 Bear on the seat plate · 🐾 throw at the Picnic Tier flag · 🪽 ring the seat bell.' });
      B.puzzle('star', 'Starheart relay', ['bruiser', 'trickster', 'scout'], ['starHome'], { hint: '⭐ Lift the Starheart with two friends close by, then carry it home — gently down the caps.' });
    },
  },
};

export function createZones(scene, ctx) {
  const group = new THREE.Group(); scene.add(group);
  let solids = [], picks = [], nodes = [], hoops = [], nightDews = [], star = null;
  let homeAt = null, A = { x: 0, z: 0 }, baseY = 0, recipe = null, id = null, picked = 0, keyDone = false, msgT = 0, t = 0;
  let tutorI = 0, tutorT = -99, endLines = [], result = null;
  let exitAt = null, exitOpen = false, exitMesh = null, exitLabel = null, starGot = false;
  let nightOn = false, dewPulseT = -99, nodesDone = 0, keyDew = 0;
  let sampleH = null, waterMeshes = [];
  // three-class puzzle state
  let sig = {}, props = [], gates = [], plates = [], puzzles = [], deep = [], crossings = [], steps = [], tw = null, lastProg = 0, hintT = 0, bearPad = null, windT = 0, introQ = [];
  const mats = new Map();
  const mat = (c, e = 0) => { const k = c + ':' + e; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e, flatShading: true })); return mats.get(k); };
  const gy = (x, z) => { if (sampleH) { const h = sampleH(x, z); if (h != null) return h; } return (ctx.meadowHeightAt || ctx.heightAt)(A.x + x, A.z + z); };
  const W = (x, z) => ({ x: A.x + x, z: A.z + z });
  const texL = new THREE.TextureLoader(), badgeMat = {};
  const badgeOf = c => badgeMat[c] || (badgeMat[c] = new THREE.SpriteMaterial({ map: texL.load(CLASSES[c].badge), depthTest: false, transparent: true }));
  const LOOK = { hedge: COL.hedge, stone: COL.stone, cliff: COL.cliff, wood: COL.wood, bark: 0x5a3b22, leaf: 0x3f7a35, dirt: COL.dirt, log: 0x8b6a45, cream: COL.cream, glass: 0xbfe8ff, gold: 0xffc94a };

  function buildTerrainMesh(fn, bounds) {
    const { x0, x1, z0, z1 } = bounds;
    const Wd = x1 - x0 + 8, D = z1 - z0 + 8, SEG = 64;
    const geo = new THREE.PlaneGeometry(Wd, D, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lem = !!recipe.lemonade;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) + cx, lz = pos.getZ(i) + cz;
      let rel = fn(lx, lz); if (rel == null) rel = -4;
      pos.setY(i, rel);
      if (rel < -1.2) { col[i * 3] = lem ? 0.9 : 0.25; col[i * 3 + 1] = lem ? 0.75 : 0.55; col[i * 3 + 2] = lem ? 0.3 : 0.75; }
      else if (rel < 0) { col[i * 3] = 0.75; col[i * 3 + 1] = 0.65; col[i * 3 + 2] = 0.4; }
      else { const g = 0.5 + 0.06 * Math.sin(lx * 0.7) * Math.cos(lz * 0.6); col[i * 3] = 0.36; col[i * 3 + 1] = g; col[i * 3 + 2] = 0.28; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.position.set(A.x + cx, baseY, A.z + cz); group.add(mesh);
    sampleH = (lx, lz) => {
      if (lx < x0 - 4 || lx > x1 + 4 || lz < z0 - 4 || lz > z1 + 4) return null;
      let rel = fn(lx, lz);
      if (Math.hypot(lx, lz) < 4.5 && (rel == null || rel < 0.55)) rel = 0.55; // dry home pad
      return baseY + (rel == null ? -3.5 : rel);
    };
    setZoneHeight((wx, wz) => sampleH(wx - A.x, wz - A.z));
    for (const r of recipe.deep || []) {
      const step = 1.4;
      for (let lx = r[0] + 0.7; lx < r[2]; lx += step) for (let lz = r[1] + 0.7; lz < r[3]; lz += step) WATER_RECTS.push({ x: A.x + lx, z: A.z + lz, hw: step * 0.55, hd: step * 0.55 });
      deep.push({ x0: A.x + r[0], z0: A.z + r[1], x1: A.x + r[2], z1: A.z + r[3] });
    }
  }
  // dress a blocky collider with a CC0 model once it loads (keeps the box if the model fails)
  function dress(holder, fallback, key, w, h, d, yaw = 0) {
    if (!key) return;
    loadGLB(key).then(g => {
      if (!g || !holder.parent) return;
      const o = g.scene.clone(true); o.rotation.y = yaw;
      o.traverse(m => { if (m.isMesh) { m.material = lambertFrom(m.material); m.castShadow = false; } });
      const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3());
      if (sz.x < 1e-3 || sz.y < 1e-3) return;
      o.scale.set(w / sz.x, h / sz.y, d / sz.z);
      const bb2 = new THREE.Box3().setFromObject(o), c = bb2.getCenter(new THREE.Vector3());
      o.position.set(-c.x, -bb2.min.y, -c.z);
      const wrap = new THREE.Group(); wrap.add(o); wrap.position.y = -h / 2; holder.add(wrap);
      if (fallback) fallback.visible = false;
    });
  }
  function addSolid(s) { ctx.phys.addDyn(s); solids.push(s); return s; }
  function badge(c, x, y, z, s = 1.15) { const sp = new THREE.Sprite(badgeOf(c)); sp.scale.set(s, s, 1); sp.position.set(x, y, z); sp.renderOrder = 8; group.add(sp); return sp; }
  const isOn = (need) => !need || [].concat(need).every(k => sig[k]);
  function setSig(k, v = true) { if (!k || !!sig[k] === !!v) return; sig[k] = !!v; if (v) lastProg = t; }
  function clearWaterIn(x0, z0, x1, z1) { for (let i = WATER_RECTS.length - 1; i >= 0; i--) { const r = WATER_RECTS[i]; if (r.x > x0 - 0.4 && r.x < x1 + 0.4 && r.z > z0 - 0.4 && r.z < z1 + 0.4) WATER_RECTS.splice(i, 1); } }
  const addHeal = () => {}; // adventure refocus: no heal meter
  const nameOf = id => ctx.speciesName ? ctx.speciesName(id) : id;

  const B = {
    water(c = 0x3aa0e8) {
      for (const r of recipe.deep || []) {
        const w = r[2] - r[0], d = r[3] - r[1];
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), new THREE.MeshLambertMaterial({ color: c, emissive: 0x0b3a66, emissiveIntensity: 0.25, transparent: true, opacity: 0.78 }));
        m.position.set(A.x + (r[0] + r[2]) / 2, baseY - 0.9, A.z + (r[1] + r[3]) / 2); group.add(m); waterMeshes.push(m);
      }
    },
    /** solid block: top/bot heights are relative to local ground at (x,z) */
    wall(x, z, w, d, top, o = {}) {
      const g = gy(x, z), bot = o.bot ?? -1.5, T = top - bot, col = o.c ?? LOOK[o.look] ?? COL.stone;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), mat(col));
      m.position.set(A.x + x, g + bot + T / 2, A.z + z); m.rotation.y = o.yaw || 0; group.add(m);
      if (o.look === 'hedge' || o.look === 'leaf') { const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.25, d + 0.12), mat(o.look === 'leaf' ? 0x4f9a3e : COL.hedgeTop)); cap.position.set(A.x + x, g + top + 0.08, A.z + z); group.add(cap); }
      if (o.look === 'glass') { m.material = new THREE.MeshLambertMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.35 }); }
      const s = addSolid({ type: 'box', x: A.x + x, z: A.z + z, hx: w / 2, hz: d / 2, yaw: -(o.yaw || 0), y0: g + bot, top: g + top, kind: 'zone' });
      if (o.hidden) { m.visible = false; s.off = true; }
      return { m, s, g };
    },
    cyl(x, z, r, h, c, base = 0) {
      const g = gy(x, z) + base, T = h + 1.5, m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, T, 12), mat(c));
      m.position.set(A.x + x, g + h - T / 2, A.z + z); group.add(m);
      addSolid({ type: 'cyl', x: A.x + x, z: A.z + z, r, y0: g + h - T, top: g + h, kind: 'zone' });
      return m;
    },
    rim(h) {
      const { x0, x1, z0, z1 } = recipe.bounds, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = h + 6;
      for (const [x, z, ww, dd] of [[x0 - 0.5, cz, 1, d + 2], [x1 + 0.5, cz, 1, d + 2], [cx, z0 - 0.5, w + 2, 1], [cx, z1 + 0.5, w + 2, 1]]) {
        const g = gy(x, z);
        addSolid({ type: 'box', x: A.x + x, z: A.z + z, hx: ww / 2, hz: dd / 2, yaw: 0, y0: g - 6, top: g + H, kind: 'zone' });
        // low visible hedge so the edge reads
        const m = new THREE.Mesh(new THREE.BoxGeometry(ww, 1.6, dd), mat(COL.hedge)); m.position.set(A.x + x, g + 0.5, A.z + z); group.add(m);
      }
    },
    tree(x, z, s = 1, base = 0, leaf = 0x3f8a35, glb) {
      const g = gy(x, z) + base, trunkH = 2.2 * s, G = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, trunkH, 0.55 * s), mat(0x6b4a30)); trunk.position.y = trunkH / 2; G.add(trunk);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(2.4 * s, 1.8 * s, 2.4 * s), mat(leaf)); c1.position.y = trunkH + 0.7 * s; G.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 1.2 * s, 1.5 * s), mat(0x4fa044)); c2.position.y = trunkH + 1.9 * s; G.add(c2);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
      addSolid({ type: 'cyl', x: A.x + x, z: A.z + z, r: 0.4 * s, y0: g - 1, top: g + trunkH + 0.2, kind: 'zone' });
      if (glb) { const H = new THREE.Group(); H.position.set(A.x + x, g + 2.4 * s, A.z + z); group.add(H); dress(H, G, GLB.tree, 3 * s, 4.8 * s, 3 * s); }
    },
    sunflower(x, z) {
      const g = gy(x, z), G = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.5, 0.45), mat(0x3f8a35)); stem.position.y = 2.75; G.add(stem);
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.7), mat(0xffd23f, 0.35)); head.position.set(0, 5.8, 0.3); G.add(head);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.5), mat(0x5a3b22)); eye.position.set(0, 5.8, 0.55); G.add(eye);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
      addSolid({ type: 'cyl', x: A.x + x, z: A.z + z, r: 0.4, y0: g - 1, top: g + 5.2, kind: 'zone' });
    },
    reed(x, z, h) { const g = gy(x, z), m = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), mat(0x5a9a3a)); m.position.set(A.x + x, g + h / 2, A.z + z); group.add(m); },
    home(x, z) { homeAt = { x: A.x + x, z: A.z + z }; }, // t148u: the crew nest is the single home
    // Level exit: all three friends must stand inside once every required puzzle is solved
    exit(x, z, r = 3, base = 0) {
      const y = gy(x, z) + base + 0.06, G = new THREE.Group(); G.position.set(A.x + x, y, A.z + z); group.add(G);
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 40), mat(0x9a8f7a, 0.95)); ringM.rotation.x = -Math.PI / 2; G.add(ringM);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r - 0.1, 32), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.12, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; G.add(disc);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), mat(0x8a5a2b, 0.9)); pole.position.set(r * 0.7, 1.7, 0); G.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.08), mat(0xb0b0b0, 0.9)); flag.position.set(r * 0.7 + 0.7, 3.0, 0); G.add(flag);
      exitAt = { x: A.x + x, z: A.z + z, y, r }; exitMesh = { G, ringM, disc, flag };
      exitLabel = document.createElement('div'); exitLabel.className = 'zoneNode'; document.body.appendChild(exitLabel);
    },
    glade(x, z, col = 0xa8d88a) { const m = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.12, 10), mat(col)); m.position.set(A.x + x, gy(x, z) + 0.08, A.z + z); group.add(m); },
    dip(x, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.1, 10), mat(0x7a5a30)); m.position.set(A.x + x, gy(x, z) + 0.05, A.z + z); group.add(m); },
    blanket(x, z, w, d, col) { const g = gy(x + w / 2, z + d / 2), m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat(col)); m.position.set(A.x + x + w / 2, g + 0.06, A.z + z + d / 2); group.add(m); },
    table(x, z, w, d, h) {
      this.wall(x, z, w, d, h, { bot: h - 0.35, c: 0xc69c6d });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const lx = x + sx * (w / 2 - 0.3), lz = z + sz * (d / 2 - 0.3); const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), mat(0x8b5e3c)); leg.position.set(A.x + lx, gy(x, z) + h / 2, A.z + lz); group.add(leg); addSolid({ type: 'cyl', x: A.x + lx, z: A.z + lz, r: 0.2, y0: gy(x, z) - 1, top: gy(x, z) + h - 0.4, kind: 'zone' }); });
    },
    cave(x, z) {
      const g = gy(x, z), G = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.8, 2.2), mat(0x6a6a68)); body.position.y = 1.4; G.add(body);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.4), mat(0x1a1a1c)); mouth.position.set(0, 1.0, -1.1); G.add(mouth);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
    },
    banner(x, z, base) { const g = gy(x, z) + base; const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), mat(0x6b4a30)); p.position.set(A.x + x, g + 1.3, A.z + z); group.add(p); const f = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.08), mat(0xff6bd6, 0.2)); f.position.set(A.x + x + 0.6, g + 2.2, A.z + z); group.add(f); },
    waterfall(x, z, w, bot, top) { const g = gy(x, z), m = new THREE.Mesh(new THREE.BoxGeometry(w, top - bot, 0.5), new THREE.MeshLambertMaterial({ color: 0x9fdcff, emissive: 0x2a6a9a, emissiveIntensity: 0.4, transparent: true, opacity: 0.7 })); m.position.set(A.x + x, g + (top + bot) / 2, A.z + z - 0.5); group.add(m); },
    pool(x, z, r, base) { const g = gy(x, z) + base, m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 14), new THREE.MeshLambertMaterial({ color: 0x3aa0e8, transparent: true, opacity: 0.8 })); m.position.set(A.x + x, g + 0.06, A.z + z); group.add(m); },
    plateDecor(x, z, base) { const g = gy(x, z) + base, m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), mat(0xb0b0a8)); m.position.set(A.x + x, g + 0.08, A.z + z); group.add(m); },
    marker(c, x, z, base, label) {
      const g = gy(x, z) + base, m = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(CLASSES[c].color), transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      m.position.set(A.x + x, g + 0.1, A.z + z); group.add(m);
      props.push({ kind: 'marker', cls: c, x: A.x + x, y: g, z: A.z + z, r: 1.6, label, done: false, icon: badge(c, A.x + x, g + 2.6, A.z + z, 0.9), ring: m });
    },
    bridgeFixed(x1, z1, x2, z2, w) {
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1), yaw = Math.atan2(x2 - x1, z2 - z1);
      const g = Math.max(gy(x1, z1), gy(x2, z2));
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, L), mat(0xc69c6d)); m.position.set(A.x + mx, g + 0.2, A.z + mz); m.rotation.y = yaw; group.add(m);
      addSolid({ type: 'box', x: A.x + mx, z: A.z + mz, hx: w / 2, hz: L / 2, yaw: -yaw, y0: g - 3, top: g + 0.38, kind: 'zone' });
      const c = { x0: A.x + Math.min(x1, x2) - w / 2, z0: A.z + Math.min(z1, z2), x1: A.x + Math.max(x1, x2) + w / 2, z1: A.z + Math.max(z1, z2), on: true, thin: false };
      crossings.push(c); clearWaterIn(c.x0, c.z0, c.x1, c.z1);
    },
    /** roofed hedge/box room. door: gate (sig), cracked (Bruiser), open, or closed (knothole/tunnel only) */
    cage(x, z, w, d, h, o = {}) {
      const base = o.base || 0, th = 0.5, gw = o.gateW || 2.4, gh = Math.min(h, o.gateH || 2.6), look = o.look || 'hedge';
      const bot = base > 0 ? base : -1.5, top = base + h;
      const side = o.gate || o.cracked || (o.open ? o.gate : null);
      const doorSide = o.gate || o.cracked || null;
      const mk = (sx, sz, sw, sd, tp, bt) => this.wall(x + sx, z + sz, sw, sd, tp, { bot: bt, look });
      // four walls (door side split around a door)
      const sides = { n: [0, d / 2, w, th], s: [0, -d / 2, w, th], e: [w / 2, 0, th, d], w: [-w / 2, 0, th, d] };
      for (const k of ['n', 's', 'e', 'w']) {
        const [sx, sz, sw, sd] = sides[k];
        if (k !== doorSide) { mk(sx, sz, sw, sd, top, bot); continue; }
        const along = (k === 'n' || k === 's') ? sw : sd, seg = (along - gw) / 2;
        if (k === 'n' || k === 's') { mk(sx - (gw / 2 + seg / 2), sz, seg, sd, top, bot); mk(sx + (gw / 2 + seg / 2), sz, seg, sd, top, bot); mk(sx, sz, gw, sd, top, base + gh); }
        else { mk(sx, sz - (gw / 2 + seg / 2), sw, seg, top, bot); mk(sx, sz + (gw / 2 + seg / 2), sw, seg, top, bot); mk(sx, sz, sw, gw, top, base + gh); }
        const dx = sx, dz = sz, dw = (k === 'n' || k === 's') ? gw : th + 0.1, dd = (k === 'n' || k === 's') ? th + 0.1 : gw;
        if (o.gate && o.gateSig) this.gate(o.gateSig, x + dx, z + dz, dw, dd, base + gh, { bot: base > 0 ? base : -1.5, latch: o.held ? false : 'auto', look: look === 'glass' ? 'glass' : 'wood', label: o.label || 'gate', fromCage: true });
        if (o.cracked) this.cracked(o.crackSig, x + dx, z + dz, dw, dd, base + gh, { base, label: o.label || 'Cracked wall', need: o.need });
      }
      this.wall(x, z, w + 0.2, d + 0.2, top + 0.4, { bot: top, look }); // roof
      if (o.floor) this.wall(x, z, w, d, base, { bot: base - 0.4, look });
    },
    gate(need, x, z, w, d, top, o = {}) {
      const r = this.wall(x, z, w, d, top, { bot: o.bot ?? -1.5, look: o.look || 'wood' });
      r.m.material = mat(o.look === 'glass' ? 0x9fd6f0 : 0xb5793a);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.3, d + 0.06), mat(COL.gold, 0.3)); stripe.position.copy(r.m.position); r.m.parent.add(stripe);
      const gt = { need: [].concat(need), m: r.m, s: r.s, stripe, y: r.m.position.y, h: top - (o.bot ?? -1.5), open: false, k: 0, latch: o.latch ?? 'auto', label: o.label || 'gate' };
      gates.push(gt); return gt;
    },
    bell(s, x, z, h, o = {}) {
      const g = gy(x, z), G = new THREE.Group();
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 0.8, 8), mat(o.lantern ? 0xffe08a : COL.gold, o.lantern ? 0.2 : 0.35)); G.add(bell);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(0x6b4a30)); cap.position.y = 0.5; G.add(cap);
      G.position.set(A.x + x, g + h, A.z + z); group.add(G);
      props.push({ kind: 'bell', act: 'bell', cls: 'scout', sig: s, x: A.x + x, y: g + h, z: A.z + z, r: 2.0, touch: 1.8, need: o.need, needWhy: o.needWhy, label: o.label || 'Bell', G, bell, lantern: o.lantern, icon: badge('scout', A.x + x, g + h + 1.3, A.z + z) });
    },
    lever(s, x, z, o = {}) {
      const g = gy(x, z) + (o.base || 0), G = new THREE.Group();
      const baseM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.6), mat(0x6a6a68)); baseM.position.y = 0.18; G.add(baseM);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), mat(0x8b6a45)); arm.position.y = 0.75; arm.rotation.z = 0.5; G.add(arm);
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), mat(0xe04040)); knob.position.set(-0.3, 1.3, 0); G.add(knob);
      G.position.set(A.x + x, g, A.z + z); group.add(G);
      props.push({ kind: 'lever', act: 'lever', cls: 'trickster', sig: s, x: A.x + x, y: g, z: A.z + z, r: 2.4, need: o.need, needWhy: o.needWhy, label: o.label || 'Lever', G, arm, knob, icon: badge('trickster', A.x + x, g + 2.4, A.z + z) });
    },
    plate(s, x, z, o = {}) {
      const g = gy(x, z) + (o.base || 0), heavy = !!o.heavy;
      const m = new THREE.Mesh(new THREE.BoxGeometry(heavy ? 2.6 : 2.0, 0.3, heavy ? 2.6 : 2.0), mat(heavy ? 0xff8a1f : 0x7dc85a, 0.15)); m.position.set(A.x + x, g + 0.12, A.z + z); group.add(m);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(heavy ? 3.0 : 2.4, 0.12, heavy ? 3.0 : 2.4), mat(0x6a6a68)); rim.position.set(A.x + x, g + 0.04, A.z + z); group.add(rim);
      const p = { sig: s, x: A.x + x, y: g, z: A.z + z, r: heavy ? 1.6 : 1.3, heavy, m, label: o.label || 'plate', holder: null, icon: badge(heavy ? 'bruiser' : 'trickster', A.x + x, g + 2.2, A.z + z, 0.9) };
      plates.push(p); props.push({ kind: 'plate', cls: heavy ? 'bruiser' : null, x: p.x, y: g, z: p.z, r: 1.8, label: p.label, plate: p });
    },
    /** shove: Bruiser pushes a log/boulder/basket into its slot (becomes stair, ford, or plate weight) */
    boulder(s, x, z, sx, sz, o = {}) {
      const base = o.base || 0, g0 = gy(x, z) + base, g1 = gy(sx, sz) + base, H = Math.max(o.h, o.slotH) + 2;
      const col = o.kind === 'log' ? 0x8b6a45 : o.kind === 'basket' ? 0xc8a060 : 0x9a968c;
      const holder = new THREE.Group(); holder.position.set(A.x + x, g0 + o.h - H / 2, A.z + z); group.add(holder);
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.w, H, o.d), mat(col)); holder.add(m);
      // the model only covers the visible top part
      const vis = new THREE.Group(); vis.position.y = H / 2 - o.h / 2; holder.add(vis);
      const key = o.kind === 'log' ? GLB.log : o.kind === 'basket' ? GLB.basket : GLB.boulder;
      dress(vis, null, key, o.w * 1.05, Math.max(o.h, 1), o.d * 1.05, o.kind === 'log' && o.d > o.w ? Math.PI / 2 : 0);
      const s0 = addSolid({ type: 'box', x: A.x + x, z: A.z + z, hx: o.w / 2, hz: o.d / 2, yaw: 0, y0: g0 + o.h - H, top: g0 + o.h, kind: 'zone' });
      props.push({ kind: 'boulder', act: 'shove', cls: 'bruiser', sig: s, x: A.x + x, y: g0, z: A.z + z, r: Math.max(o.w, o.d) / 2 + 1.9, need: o.need, needWhy: o.needWhy, label: o.label || 'Boulder',
        holder, s: s0, H, to: { x: A.x + sx, z: A.z + sz, top: g1 + o.slotH }, from: { x: A.x + x, z: A.z + z, top: g0 + o.h }, cross: o.cross, icon: badge('bruiser', A.x + x, g0 + o.h + 1.4, A.z + z) });
      // ghost slot marker
      const gm = new THREE.Mesh(new THREE.BoxGeometry(o.w, 0.12, o.d), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.45 }));
      gm.position.set(A.x + sx, Math.max(g1 + 0.1, g1 + o.slotH - (o.slotH > 0.8 ? o.slotH : 0) + 0.1), A.z + sz); group.add(gm); props[props.length - 1].ghost = gm;
    },
    cracked(s, x, z, w, d, top, o = {}) {
      const r = this.wall(x, z, w, d, top, { bot: o.base > 0 ? o.base : -1.5, c: 0xa07a50 });
      const G = new THREE.Group(); G.position.copy(r.m.position); group.add(G);
      dress(G, null, GLB.fence, w + 0.2, Math.min(2.2, top - (o.base || 0)), Math.max(d, 0.6), w < d ? Math.PI / 2 : 0);
      for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, d + 0.04), mat(0x3b2614)); c.position.set(A.x + x + (i - 1) * w * 0.25, r.m.position.y + (i - 1) * 0.3, A.z + z); c.rotation.z = 0.5 * (i - 1); if (w < d) { c.geometry = new THREE.BoxGeometry(w + 0.04, 0.9, 0.12); c.position.set(A.x + x, r.m.position.y + (i - 1) * 0.3, A.z + z + (i - 1) * d * 0.25); } group.add(c); G.add(c); c.position.sub(G.position); }
      props.push({ kind: 'cracked', act: 'smash', cls: 'bruiser', sig: s, x: A.x + x, y: r.g + (o.base || 0), z: A.z + z, r: Math.max(w, d) / 2 + 2.0, need: o.need, needWhy: o.needWhy, label: o.label || 'Cracked wall', m: r.m, s: r.s, G, icon: badge('bruiser', A.x + x, r.g + (o.base || 0) + 3.2, A.z + z) });
    },
    slip(ax, az, ha, bx, bz, hb, o = {}) {
      const a = { x: A.x + ax, z: A.z + az, y: gy(ax, az) + ha }, b = { x: A.x + bx, z: A.z + bz, y: gy(bx, bz) + hb };
      const hole = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat(0x1a1020, 0.3)); hole.position.set((a.x + b.x) / 2 + (a.x - b.x) * 0.25, a.y, (a.z + b.z) / 2 + (a.z - b.z) * 0.25); group.add(hole);
      props.push({ kind: 'slip', act: 'slip', cls: 'scout', x: a.x, y: a.y, z: a.z, r: 2.2, b, needIn: o.needIn, needWhy: o.needWhy, label: o.label || 'Knothole', two: true, icon: badge('scout', a.x, a.y + 1.3, a.z, 0.9) });
    },
    vine(ax, az, ha, bx, bz, hb, o = {}) {
      const a = { x: A.x + ax, z: A.z + az, y: gy(ax, az) + ha }, b = { x: A.x + bx, z: A.z + bz, y: gy(bx, bz) + hb };
      const L = b.y - a.y; for (let i = 0; i < Math.max(2, L / 0.9); i++) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2), mat(i % 2 ? 0x4f9a3e : 0x6fbf4a)); leaf.position.set(a.x + (b.x - a.x) * 0.5 + (i % 2 ? 0.2 : -0.2), a.y + 0.4 + i * 0.9, a.z + (b.z - a.z) * 0.6); group.add(leaf); }
      props.push({ kind: 'vine', act: 'vine', cls: 'trickster', x: a.x, y: a.y, z: a.z, r: 2.0, b, need: o.need, needWhy: o.needWhy, label: o.label || 'Vine', two: true, icon: badge('trickster', a.x, a.y + 2.2, a.z, 0.9) });
    },
    dig(s, ax, az, bx, bz, o = {}) {
      const a = { x: A.x + ax, z: A.z + az, y: gy(ax, az) + 0.2 }, b = { x: A.x + bx, z: A.z + bz, y: gy(bx, bz) + 0.3 };
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 0.35, 10), mat(0x7a5a30)); m.position.set(a.x, a.y, a.z); group.add(m);
      props.push({ kind: 'dig', act: 'dig', cls: 'trickster', sig: s, x: a.x, y: a.y, z: a.z, r: 2.0, b, label: o.label || 'Soft dirt', two: true, icon: badge('trickster', a.x, a.y + 2.0, a.z, 0.9) });
    },
    target(s, x, z, h, o = {}) {
      const g = gy(x, z), G = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 14).rotateX(Math.PI / 2), mat(0xffffff)); G.add(disc);
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 12).rotateX(Math.PI / 2), mat(0xe04040, 0.3)); G.add(eye);
      G.position.set(A.x + x, g + h, A.z + z); group.add(G);
      const fr = o.from ? { x: A.x + o.from.x, z: A.z + o.from.z, r: o.from.r, minY: gy(o.from.x, o.from.z) + o.from.minH } : null;
      props.push({ kind: 'target', act: 'throw', cls: 'trickster', sig: s, x: A.x + x, y: g + h, z: A.z + z, r: o.range || 14, flat: true, from: fr, fromWhy: o.fromWhy, need: o.need, needWhy: o.needWhy, label: o.label || 'Target', G, icon: badge('trickster', A.x + x, g + h + 1.3, A.z + z) });
    },
    plank(s, x1, z1, x2, z2, o = {}) {
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1), yaw = Math.atan2(x2 - x1, z2 - z1), w = o.thin ? 1.5 : 2.6;
      const g = Math.max(gy(x1, z1), gy(x2, z2), gy(mx, mz));
      const holder = new THREE.Group(); holder.position.set(A.x + mx, g + 0.25, A.z + mz); holder.rotation.y = yaw; holder.visible = false; group.add(holder);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, L), mat(0xc69c6d)); holder.add(m);
      dress(holder, m, GLB.bridge, w, 0.6, L, 0);
      const ghost = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, L), new THREE.MeshBasicMaterial({ color: 0x7dc85a, transparent: true, opacity: 0.4 })); ghost.position.set(A.x + mx, g + 0.15, A.z + mz); ghost.rotation.y = yaw; group.add(ghost);
      const sd = addSolid({ type: 'box', x: A.x + mx, z: A.z + mz, hx: w / 2, hz: L / 2, yaw: -yaw, y0: g - 3, top: g + 0.4, kind: 'zone', off: true });
      const c = { x0: A.x + Math.min(x1, x2) - w / 2, z0: A.z + Math.min(z1, z2) - 0.3, x1: A.x + Math.max(x1, x2) + w / 2, z1: A.z + Math.max(z1, z2) + 0.3, on: false, thin: !!o.thin };
      crossings.push(c);
      const ends = [[x1, z1], [x2, z2]].map(([ex, ez]) => ({ x: A.x + ex, z: A.z + ez }));
      for (const e of ends) props.push({ kind: 'plank', act: 'plank', cls: 'trickster', sig: s, x: e.x, y: gy(e.x - A.x, e.z - A.z), z: e.z, r: 2.6, need: o.need, needWhy: o.needWhy, label: o.label || 'Plank spot', holder, s: sd, cross: c, ghost, icon: badge('trickster', e.x, g + 2.0, e.z, 0.9) });
    },
    steps(s, list, base = 0) {
      for (const [x, z, w, d, top] of list) { const r = this.wall(x, z, w, d, base + (top - base), { bot: base > 0 ? base : -1.5, look: 'wood', hidden: true }); steps.push({ sig: s, r }); }
    },
    hoops(prefix, list) {
      list.forEach(([x, z, h], i) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24), mat(0xff6bd6, 0.6)); m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
        hoops.push({ m, got: false, sig: prefix + (i + 1), prev: i ? prefix + i : null });
      });
    },
    basketDecor(s, x, z) { const g = gy(x, z), m = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 1.8), mat(0xc8a060)); m.position.set(A.x + x, g + 6, A.z + z); group.add(m); steps.push({ sig: s, deco: m, down: g + 0.3, up: g + 6 }); },
    pickup(tier, x, z, h, o = {}) {
      if (tier === 'dew') tier = 'petal'; // adventure: Petals are the only score
      const T = TIER[tier], m = new THREE.Mesh(T.geo(), mat(T.col, 0.8));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
      const rec = { tier, m, y: m.position.y, got: false, nightOnly: false, show: o.show, set: o.set, who: o.who, whyNot: o.whyNot };
      if (o.show) m.visible = false;
      picks.push(rec);
    },
    nightDew(x, z, h) {
      const T = TIER.petal, m = new THREE.Mesh(T.geo(), mat(T.col, 0.9));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); m.visible = false; group.add(m);
      const rec = { tier: 'petal', m, y: m.position.y, got: false, nightOnly: true, alive: false };
      picks.push(rec); nightDews.push(rec);
    },
    node(kind, x, z, h, o = {}) {
      const N = NODE[kind], col = TIER[N.tier].col, m = new THREE.Group();
      const body = new THREE.Mesh(kind === 'team' ? new THREE.CylinderGeometry(0.9, 0.9, 3, 10).rotateZ(Math.PI / 2) : kind === 'heavy' ? new THREE.CylinderGeometry(1.6, 1.8, 0.6, 16) : new THREE.DodecahedronGeometry(1.1), mat(kind === 'team' ? 0xb07a32 : col, kind === 'team' ? 0.15 : 0.7));
      body.position.y = kind === 'heavy' ? 0.3 : 1; m.add(body);
      const rg = new THREE.Mesh(new THREE.RingGeometry(3.6, 4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      rg.position.y = 0.08; m.add(rg);
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
      const label = document.createElement('div'); label.className = 'zoneNode'; document.body.appendChild(label);
      const n = { kind, m, body, label, done: false, wob: 0, sig: o.sig, need: o.need };
      if (o.need) m.visible = false;
      nodes.push(n); return n;
    },
    starheart(x, z, h, caps) {
      const n = this.node('heaviest', x, z, h);
      star = { node: n, caps: caps.map(([cx, cz, ch]) => ({ x: A.x + cx, z: A.z + cz, y: gy(cx, cz) + ch })), carry: false, safe: { x: A.x, z: A.z + 2 }, mesh: null, lastY: 0, dropped: 0 };
    },
    puzzle(pid, label, cls, sigs, o = {}) { puzzles.push({ id: pid, label, cls, sigs, req: o.req !== false, hint: o.hint || '', done: false }); },
  };

  const say = (s, d = 2200) => { if (t - msgT > 1.6) { msgT = t; ctx.toast(s, d); } };
  function clear() {
    WATER_RECTS.length = 0; setZoneHeight(null);
    sampleH = null; waterMeshes = [];
    for (const s of solids) s.off = true;
    solids = []; picks = []; hoops = []; nightDews = []; star = null;
    sig = {}; props = []; gates = []; plates = []; puzzles = []; deep = []; crossings = []; steps = []; tw = null; bearPad = null; introQ = [];
    for (const n of nodes) n.label.remove(); nodes = [];
    while (group.children.length) { const c = group.children.pop(); c.traverse?.(o => o.geometry?.dispose?.()); }
    tutorI = 0; tutorT = -99; endLines = []; result = null;
    if (exitLabel) exitLabel.remove(); exitAt = null; exitOpen = false; exitMesh = null; exitLabel = null; starGot = false;
    id = null; recipe = null; nightOn = false; dewPulseT = -99; nodesDone = 0; keyDew = 0;
  }
  function load(pid, anchor) {
    clear(); recipe = MAPS[pid]; if (!recipe) return; id = pid; picked = 0; keyDone = false; t = 0; lastProg = 0; hintT = 0;
    A = { x: anchor.x, z: anchor.z };
    baseY = (ctx.meadowHeightAt || ctx.heightAt)(A.x, A.z);
    buildTerrainMesh(terrainFrom(recipe), recipe.bounds);
    recipe.build(B);
    { const e = recipe.exit || [0, 0]; B.exit(e[0], e[1], e[2] || 3, e[3] || 0); }
    // Bruiser "standing platform" (Olaf shield move): a solid on Bear's back while he's parked
    bearPad = addSolid({ type: 'cyl', x: 0, z: 0, r: 1.15, y0: -99, top: -98, kind: 'zone', off: true, pad: true });
    if (recipe.night) { nightOn = true; ctx.setNight(true); }
    else if (recipe.nightCycle) { nightOn = false; ctx.setNight(false); }
    introQ = [...(recipe.banter?.start || []), `🎯 ${recipe.goal}`, ...(recipe.intro || [])];
  }
  function crewAt(x, z, r) {
    const p = ctx.getP(); let n = Math.hypot(p.x - x, p.z - z) < r ? 1 : 0;
    for (const cid of ctx.crewIds()) { if (cid === ctx.cur()) continue; const q = ctx.parked(cid); if (q && Math.hypot(q.x - x, q.z - z) < r) n++; }
    for (const h of ctx.helpers()) if (Math.hypot(h.x - x, h.z - z) < r) n++;
    return n;
  }
  function pulseNightDews(want) { for (const d of nightDews) { if (d.got) continue; d.alive = want; d.m.visible = want; } }
  function reqLeft() { return puzzles.filter(p => p.req && !p.done); }
  function checkKey() {
    if (!recipe || keyDone) return;
    if (reqLeft().length) return;
    if (!exitOpen) { exitOpen = true; setExitLook(); ctx.toast('🏁 The exit is open! Bring all three friends to the flag.', 3400); ctx.audio?.chime?.(); }
    if (exitAt && crewAtExit() >= 3) complete('All three friends made it');
  }
  const keyGoalMet = () => !recipe || keyDone;
  function crewIn(q) { return q && Math.hypot(q.x - exitAt.x, q.z - exitAt.z) < exitAt.r + 0.3 && Math.abs(q.y - exitAt.y) < 3; }
  function crewAtExit() {
    if (!exitAt) return 0; const p = ctx.getP(); let n = crewIn(p) ? 1 : 0;
    for (const cid of ctx.crewIds()) { if (cid === ctx.cur()) continue; if (crewIn(ctx.parked(cid))) n++; }
    return n;
  }
  function setExitLook() {
    if (!exitMesh) return; const on = exitOpen;
    exitMesh.ringM.material = mat(on ? 0xffc93c : 0x9a8f7a, 0.6); exitMesh.flag.material = mat(on ? 0xff5a5a : 0xb0b0b0, 0.8); exitMesh.disc.material.opacity = on ? 0.35 : 0.12;
  }
  function updateExit(cam) {
    if (!exitAt || !exitLabel) return;
    exitMesh.flag.rotation.y = Math.sin(t * 2) * 0.25;
    const v = new THREE.Vector3(exitAt.x, exitAt.y + 4, exitAt.z); v.project(cam);
    const p = ctx.getP(), pd = Math.hypot(p.x - exitAt.x, p.z - exitAt.z), on = !keyDone && v.z < 1 && pd < 40;
    exitLabel.style.display = on ? 'block' : 'none';
    if (on) { const n = crewAtExit(), L = reqLeft().length; exitLabel.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; exitLabel.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; exitLabel.textContent = exitOpen ? `🏁 Exit ${'🐾'.repeat(n)}${'◯'.repeat(Math.max(0, 3 - n))}` : `🏁 Exit · 🔒 ${L} puzzle${L === 1 ? '' : 's'} left`; }
  }
  function complete(why) {
    if (keyDone) return; keyDone = true;
    if (exitLabel) exitLabel.style.display = 'none';
    const pets = picks.filter(k => k.tier === 'petal' && !k.nightOnly), got = pets.filter(k => k.got).length;
    const hasStar = picks.some(k => k.tier === 'star');
    result = { id, petals: got, petalsTotal: pets.length, star: starGot, hasStar, time: Math.round(t), par: recipe.par || 0,
      stars: { petals: got >= pets.length, star: !hasStar || starGot, par: !recipe.par || t <= recipe.par }, end: recipe.banter?.end || [] };
    result.n = Object.values(result.stars).filter(Boolean).length;
    ctx.toast(`🏆 ${why}! ${'⭐'.repeat(result.n)}${'☆'.repeat(3 - result.n)}`, 3400); ctx.audio?.chime?.(); ctx.onComplete?.(result);
  }
  const clsOfCur = () => CLASS_OF[ctx.cur()] || 'trickster';
  const d3 = (p, q) => Math.hypot(p.x - q.x, (p.y + 0.6) - q.y, p.z - q.z);
  const dFlat = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  function propNear(p, pr) {
    if (pr.done && !pr.two) return Infinity;
    if (pr.flat) return dFlat(p, pr);
    const dy = Math.abs(p.y - pr.y), da = dFlat(p, pr);
    let d = dy < 2.6 ? da : Infinity;
    if (pr.kind === 'bell') d = d3(p, pr);
    if (pr.two && pr.b) { const db = Math.abs(p.y - pr.b.y) < 2.6 ? dFlat(p, pr.b) : Infinity; if (db < d) { pr._atB = true; return db; } }
    pr._atB = false; return d;
  }
  /** nearest interactable prop (any class) */
  function nearest(p) {
    let best = null, bd = 1e9;
    // prefer: own-class puzzle props > own-class travel props (vine/knothole/dirt) > other classes; a throw only counts from its spot
    const c = clsOfCur();
    for (const pr of props) {
      if (!pr.act) continue; const d = propNear(p, pr); if (!(d < pr.r)) continue;
      let sc = d + (pr.two ? 50 : 0) + (pr.cls && pr.cls !== c ? 100 : 0);
      if (pr.act === 'throw' && pr.from && (dFlat(p, pr.from) > pr.from.r || p.y < pr.from.minY - 0.3)) sc += 200;
      if (sc < bd) { bd = sc; best = pr; }
    }
    return best;
  }
  function tween(p, to, dur, arc, done) { tw = { p, a: { x: p.x, y: p.y, z: p.z }, b: to, t: 0, d: dur, arc, done }; }
  function fx(x, y, z) { ctx.fx?.(x, y, z); }
  function doAct(pr, p) {
    const c = clsOfCur(), C = CLASSES[pr.cls];
    if (pr.cls !== c) { say(`${C.em} Only a ${C.name} can ${ACTS[pr.act].verb.toLowerCase()} this — swap to your ${C.name}!`, 2400); ctx.audio?.sample?.('ui/error-bonk', 0.35); return true; }
    if (pr.need && !isOn(pr.need)) { say('🔒 ' + (pr.needWhy || 'Not yet — something else has to happen first'), 2600); return true; }
    const atB = pr._atB;
    switch (pr.act) {
      case 'bell': ringBell(pr); break;
      case 'lever': pr.done = true; pr.arm.rotation.z = -0.5; pr.knob.position.x = 0.3; setSig(pr.sig); ctx.audio?.sample?.('ui2/lantern-click', 0.5); ctx.toast(`🎚️ ${pr.label} pulled!`, 1800); break;
      case 'slip': {
        if (!atB && pr.needIn && !isOn(pr.needIn)) { say('🔒 ' + (pr.needWhy || 'Closed'), 2400); return true; }
        const to = atB ? pr : pr.b; tween(p, { x: to.x, y: to.y, z: to.z }, 0.55, 0.3); ctx.toast('🕳️ Slipped through!', 1000); break;
      }
      case 'vine': { const to = atB ? pr : pr.b; tween(p, { x: to.x, y: to.y + 0.1, z: to.z }, 1.1, 0); ctx.toast(atB ? '🌿 Climbing down' : '🌿 Climbing up the vine!', 1200); break; }
      case 'dig': { const to = atB ? pr : pr.b; tween(p, { x: to.x, y: to.y, z: to.z }, 0.9, -1.6); if (!pr.done) { pr.done = true; setSig(pr.sig); } ctx.toast('⛏️ Dug through the tunnel!', 1200); break; }
      case 'throw': {
        if (pr.from && (dFlat(p, pr.from) > pr.from.r || p.y < pr.from.minY - 0.3)) { say('🌰 ' + (pr.fromWhy || 'Get to a better spot to throw from'), 2600); return true; }
        throwAcorn(p, pr); break;
      }
      case 'plank': {
        pr.cross.on = true; pr.holder.visible = true; pr.s.off = false; pr.ghost.visible = false; clearWaterIn(pr.cross.x0, pr.cross.z0, pr.cross.x1, pr.cross.z1);
        for (const q of props) if (q.act === 'plank' && q.holder === pr.holder) { q.done = true; if (q.icon) q.icon.visible = false; }
        setSig(pr.sig); ctx.toast(`🪵 ${pr.label}: Plank Bridge built!${pr.cross.thin ? ' (too thin for Bear)' : ''}`, 2400); ctx.audio?.chime?.(); break;
      }
      case 'shove': {
        pr.done = true; const s = pr.s, to = pr.to;
        pr.anim = { t: 0, a: { x: pr.from.x, z: pr.from.z, top: pr.from.top }, b: to };
        if (pr.ghost) pr.ghost.visible = false;
        ctx.toast(`💪 Shove! ${pr.label} slides into place`, 1800); ctx.audio?.sample?.('build/place-thunk', 0.5);
        break;
      }
      case 'smash': {
        pr.done = true; pr.s.off = true; pr.m.visible = false; pr.G.visible = false; setSig(pr.sig);
        fx(pr.x, pr.y + 1.2, pr.z); ctx.toast(`💥 Poof! ${pr.label} tumbles open in a puff of leaves`, 2000); ctx.audio?.sample?.('build/dismantle-pop-apart', 0.5); break;
      }
    }
    if (pr.icon && pr.done && !pr.two) pr.icon.visible = false;
    return true;
  }
  function ringBell(pr) {
    if (pr.done) return;
    if (pr.need && !isOn(pr.need)) { say('🔒 ' + (pr.needWhy || 'Not yet'), 2400); return; }
    pr.done = true; pr.ringT = t; setSig(pr.sig); if (pr.icon) pr.icon.visible = false;
    if (pr.lantern) { pr.bell.material = mat(0xffe08a, 1.0); const L = new THREE.PointLight(0xffd27a, 2, 9); L.position.copy(pr.G.position); group.add(L); }
    ctx.audio?.sample?.(pr.lantern ? 'ui2/lantern-click' : 'contest/win-jingle', 0.45); ctx.toast(pr.lantern ? `🏮 ${pr.label} lit!` : `🔔 Ding! ${pr.label} rang`, 1800);
  }
  function throwAcorn(p, pr) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), mat(0x8b5a2b)); a.position.set(p.x, p.y + 1.2, p.z); group.add(a);
    pr.done = true; pr.proj = { m: a, t: 0, a: a.position.clone(), b: new THREE.Vector3(pr.x, pr.y, pr.z) };
    ctx.toast('🌰 Throw!', 900); ctx.audio?.blip?.(3);
  }
  /** Interact / Act button: returns true if a puzzle prop handled it */
  function act() {
    if (!recipe || tw) return false;
    const p = ctx.getP(), pr = nearest(p);
    if (!pr) {
      const m = props.find(q => q.kind === 'plate' && dFlat(p, q) < 2.2);
      if (m) { say(`${m.plate.heavy ? '🐻 Heavy plate — only Bear is heavy enough' : '🟩 Stand here and it stays held'} · then swap to another friend`, 2400); return true; }
      return false;
    }
    return doAct(pr, p);
  }
  /** Interact wheel entries for the current class */
  function wheelOpts() {
    if (!recipe) return [];
    const p = ctx.getP(), c = clsOfCur(), C = CLASSES[c], pr = nearest(p), out = [];
    const img = (u) => `<img class="ico" src="${u}" alt="" draggable="false">`;
    if (pr) {
      const A2 = ACTS[pr.act], ok = pr.cls === c;
      out.push({ icon: img(CLASSES[pr.cls].abIcon), ik: 'class-act', label: `${A2.verb}`, dis: !ok, why: `Only a ${CLASSES[pr.cls].name} can do this — swap!`, on: () => doAct(pr, ctx.getP()) });
    }
    for (const k of C.acts) {
      if (pr && pr.act === k) continue;
      if (out.length >= 3) break;
      const A2 = ACTS[k];
      if (['bell', 'lever', 'shove', 'smash', 'throw', 'slip'].includes(k)) out.push({ icon: img(C.abIcon), ik: 'class-act', label: A2.verb, dis: true, why: `No ${k === 'throw' ? 'target' : k === 'slip' ? 'knothole' : k} in reach — look for the ${C.short} icon`, on: () => {} });
    }
    return out;
  }
  function inRect(x, z, r) { return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }
  function deepBlock(q, idd, isCur) {
    if (!deep.length || CLASS_OF[idd] === 'scout') return;
    const inD = deep.some(r => inRect(q.x, q.z, r));
    const cr = crossings.find(c => c.on && inRect(q.x, q.z, c));
    const thinBlock = cr && cr.thin && CLASS_OF[idd] === 'bruiser';
    if (inD && (!cr || thinBlock)) {
      if (q._safe) { q.x = q._safe.x; q.z = q._safe.z; q.vx = (q.vx || 0) * -0.3; q.vz = (q.vz || 0) * -0.3; }
      if (isCur) say(thinBlock ? '🐻 Too thin for Bear — he needs the ford or a sturdy crossing' : '💧 Too deep to swim! Only Scouts fly over — build a crossing', 2000);
    } else q._safe = { x: q.x, z: q.z };
  }
  function update(dt, cam) {
    if (!recipe) return; t += dt;
    const p = ctx.getP(), cur = ctx.cur(), c = clsOfCur(), size = SIZE[cur] || 'medium', ids = ctx.crewIds();
    if (introQ.length && t > 0.4 && t - msgT > 3.2) { msgT = t; ctx.toast(introQ.shift(), 3000); }
    // guided tutorial (Sunny Hollow): one Pip line per step, repeated every 25 s until that step is done
    else if (recipe.tutor && !keyDone) {
      while (tutorI < recipe.tutor.length && sig[recipe.tutor[tutorI].until]) { tutorI++; tutorT = -99; }
      const st = recipe.tutor[tutorI];
      if (st && !(st.optional && exitOpen && t - tutorT < 60) && t - tutorT > 25 && t - msgT > 3.2) { tutorT = t; msgT = t; lastProg = t; ctx.toast(st.say, 5200); }
    }
    // player tween (slip / climb / dig)
    if (tw) {
      if (tw.p !== p) { tw.p.x = tw.b.x; tw.p.y = tw.b.y; tw.p.z = tw.b.z; tw = null; }
      else {
        tw.t += dt; const k = Math.min(1, tw.t / tw.d), e = k * k * (3 - 2 * k);
        p.x = tw.a.x + (tw.b.x - tw.a.x) * e; p.z = tw.a.z + (tw.b.z - tw.a.z) * e; p.y = tw.a.y + (tw.b.y - tw.a.y) * e + Math.sin(k * Math.PI) * tw.arc;
        p.vx = p.vz = 0; p.vy = 0; p._safe = { x: p.x, z: p.z };
        if (k >= 1) { tw = null; p.grounded = false; p.vy = 0.5; }
      }
    }
    // class movement rules: Trickster flight is short hops only; everyone stays under the level's sky ceiling
    if (!tw) {
      if (c === 'trickster' && !p.grounded && p.floorY != null && p.y > p.floorY + CLASSES.trickster.flyCap) { p.y = p.floorY + CLASSES.trickster.flyCap; if (p.vy > 0) p.vy = 0; if (p.stam != null) p.stam = Math.min(p.stam, 0.35); }
      if (recipe.ceil && p.y > baseY + recipe.ceil) { p.y = baseY + recipe.ceil; if (p.vy > 0) p.vy = 0; say('🌬️ Too windy up there — stay lower', 1400); }
      deepBlock(p, cur, true);
    }
    for (const cid of ids) { if (cid === cur) continue; const q = ctx.parked(cid); if (q) deepBlock(q, cid, false); }
    // Bear's back is a step for friends while he's parked
    if (bearPad) {
      const bid = ids.find(i => CLASS_OF[i] === 'bruiser' && i !== cur), q = bid && ctx.parked(bid);
      if (q) { bearPad.off = false; bearPad.x = q.x; bearPad.z = q.z; bearPad.top = q.y + 1.85; bearPad.y0 = q.y + 0.35; bearPad.owner = q; } else bearPad.off = true;
    }
    // wind gusts (Windy Rise)
    const Wd = recipe.wind;
    if (Wd) {
      windT += dt; const gust = (windT % Wd.every) < Wd.dur;
      if (gust && !p.grounded && p.x > A.x + Wd.x0 && p.x < A.x + Wd.x1 && p.z > A.z + Wd.z0 - 6 && p.z < A.z + Wd.z1) { p.z += Wd.push * dt; p.x -= Wd.push * 0.4 * dt; }
      if (gust && (windT % Wd.every) < dt * 1.5) say('💨 Gust!', 700);
    }
    // night cycle + night dew
    if (recipe.nightCycle) {
      const phase = t % recipe.nightCycle, wantNight = phase > recipe.nightCycle - 50;
      if (wantNight !== nightOn) {
        nightOn = wantNight; ctx.setNight(wantNight);
        if (wantNight) { dewPulseT = t; pulseNightDews(true); say('🌙 Night falls — bonus Dewdrops sparkle for a little while!', 2400); }
        else pulseNightDews(false);
      }
      if (nightOn && dewPulseT >= 0 && t - dewPulseT > (recipe.dewWindow || 8)) pulseNightDews(false);
    }
    // plates: held by anyone standing on them (active or parked); heavy needs the Bruiser
    for (const pl of plates) {
      let holder = null;
      const chk = (q, idd) => { if (!q || holder) return; if (Math.hypot(q.x - pl.x, q.z - pl.z) < pl.r && Math.abs(q.y - pl.y) < 1.2 && (!pl.heavy || CLASS_OF[idd] === 'bruiser')) holder = idd; };
      chk(p, cur); for (const cid of ids) if (cid !== cur) chk(ctx.parked(cid), cid);
      if (holder !== pl.holder) {
        if (holder && holder !== cur) ctx.toast(`📌 ${nameOf(holder)} is holding the ${pl.label}!`, 2000);
        else if (holder) ctx.toast(`🟩 ${pl.label} held — swap to a friend, ${nameOf(holder)} will stay put`, 2200);
        pl.holder = holder;
      }
      setSig(pl.sig, !!holder);
      pl.m.position.y = pl.y + (holder ? 0.02 : 0.12);
      if (pl.icon) pl.icon.visible = !holder;
    }
    // gates follow their signals (latching gates stay open)
    for (const g of gates) {
      if (g.latch === 'auto') g.latch = !g.need.some(k => plates.some(pl => pl.sig === k));
      const want = g.open && g.latch ? true : isOn(g.need);
      if (want !== g.open) { g.open = want; g.s.off = want; if (want) { ctx.audio?.sample?.('ui2/gear-equip-clink', 0.35); say(`🚪 ${g.label} opened!`, 1400); } }
      g.k += ((g.open ? 1 : 0) - g.k) * Math.min(1, dt * 6);
      g.m.position.y = g.y - g.k * (g.h - 0.1); g.stripe.position.y = g.m.position.y; g.m.visible = g.k < 0.97; g.stripe.visible = g.m.visible;
    }
    for (const st of steps) {
      const on = isOn(st.sig);
      if (st.r && on && st.r.s.off) { st.r.s.off = false; st.r.m.visible = true; ctx.toast('🪜 A new way up appeared!', 1800); }
      if (st.deco) { const ty = on ? st.down : st.up; st.deco.position.y += (ty - st.deco.position.y) * Math.min(1, dt * 2); }
    }
    // shove anims + acorn projectiles + bell scouting by touch
    for (const pr of props) {
      if (pr.anim) {
        pr.anim.t += dt; const k = Math.min(1, pr.anim.t / 0.8), e = k * k * (3 - 2 * k), a = pr.anim.a, b = pr.anim.b;
        const x = a.x + (b.x - a.x) * e, z = a.z + (b.z - a.z) * e, top = a.top + (b.top - a.top) * e;
        pr.holder.position.set(x, top - pr.H / 2, z); pr.s.x = x; pr.s.z = z; pr.s.top = top; pr.s.y0 = top - pr.H;
        if (pr.icon) pr.icon.visible = false;
        if (k >= 1) { pr.anim = null; setSig(pr.sig); if (pr.cross) { const cr = { x0: A.x + pr.cross[0], z0: A.z + pr.cross[1], x1: A.x + pr.cross[2], z1: A.z + pr.cross[3], on: true, thin: false }; crossings.push(cr); clearWaterIn(cr.x0, cr.z0, cr.x1, cr.z1); ctx.toast('🪨 A sturdy crossing — Bear can walk across now!', 2200); } fx(x, top, z); }
      }
      if (pr.proj) {
        pr.proj.t += dt; const k = Math.min(1, pr.proj.t / 0.7); pr.proj.m.position.lerpVectors(pr.proj.a, pr.proj.b, k); pr.proj.m.position.y += Math.sin(k * Math.PI) * 2.5;
        if (k >= 1) { pr.proj.m.removeFromParent(); pr.proj = null; setSig(pr.sig); pr.G.rotation.z = 0.6; if (pr.icon) pr.icon.visible = false; ctx.toast(`🎯 Bonk! ${pr.label} hit`, 1800); ctx.audio?.chime?.(); }
      }
      if (pr.kind === 'bell') {
        if (pr.ringT != null && t - pr.ringT < 1.2) pr.G.rotation.z = Math.sin((t - pr.ringT) * 22) * 0.5 * (1 - (t - pr.ringT) / 1.2); else pr.G.rotation.z = 0;
        if (!pr.done && c === 'scout' && d3(p, pr) < pr.touch) ringBell(pr);
      }
      if (pr.icon && !pr.done) pr.icon.position.y += Math.sin(t * 3 + pr.x) * 0.004;
    }
    // proximity hint for the wrong class
    { const pr = nearest(p); if (pr && pr.cls !== c && !pr.done) say(`${CLASSES[pr.cls].em} ${pr.label}: needs a ${CLASSES[pr.cls].name}`, 1800); else if (pr && pr.cls === c && !pr.done) say(`🤝 Tap Interact: ${ACTS[pr.act].verb}`, 1500); }
    // hoops (sequence)
    for (const h of hoops) if (!h.got && Math.hypot(p.x - h.m.position.x, p.z - h.m.position.z) < 1.8 && Math.abs(p.y + 0.5 - h.m.position.y) < 1.8) {
      if (h.prev && !sig[h.prev]) { say('💫 Start with the first hoop!', 1200); continue; }
      h.got = true; h.m.material = mat(0x8be07a, 0.6); setSig(h.sig); ctx.toast('💫 Hoop!', 900);
    }
    // pickups
    for (const k of picks) {
      if (k.got) continue;
      if (k.nightOnly && !k.alive) continue;
      if (k.show && !isOn(k.show)) { k.m.visible = false; continue; } else if (k.show) k.m.visible = true;
      k.m.rotation.y += dt * 2; k.m.position.y = k.y + Math.sin(t * 2 + k.y) * 0.15;
      if (Math.hypot(p.x - k.m.position.x, p.z - k.m.position.z) < 1.5 && Math.abs(p.y + 0.6 - k.m.position.y) < 1.8) {
        if (k.who && !k.who.includes(c)) { say('🙅 ' + (k.whyNot || 'Another class has to grab this'), 2000); continue; }
        k.got = true; k.m.visible = false; k.alive = false; addHeal(TIER[k.tier].heal); ctx.audio?.sample?.('ui2/item-produced', 0.4); picked++;
        if (k.tier === 'dew') keyDew++;
        if (k.set) setSig(k.set);
        if (k.tier === 'star') { starGot = true; ctx.toast('⭐ Secret Starseed found!', 1800); ctx.onStar?.(); } else ctx.onPick?.();
        lastProg = t;
      }
    }
    // team lifts
    for (const n of nodes) {
      if (n.need && !isOn(n.need)) { n.label.style.display = 'none'; continue; } else if (n.need && !n.done && !n.m.visible) { n.m.visible = true; ctx.toast(`✨ ${NODE[n.kind].name} appeared!`, 1800); }
      if (n.done) { n.label.style.display = 'none'; continue; }
      n.body.rotation.y += dt * 0.4;
      const need = NEED[n.kind][size], have = crewAt(n.m.position.x, n.m.position.z, 4.2), pd = Math.hypot(p.x - n.m.position.x, p.z - n.m.position.z);
      const v = n.m.position.clone(); v.y += 3; v.project(cam);
      const on = v.z < 1 && pd < 30; n.label.style.display = on ? 'block' : 'none';
      if (on) { n.label.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; n.label.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; n.label.textContent = `${NODE[n.kind].name} ${'🐾'.repeat(Math.min(have, need))}${'◯'.repeat(Math.max(0, need - have))}`; }
      if (pd < 3.2 && Math.abs(p.y - n.m.position.y) < 3) {
        if (have >= need) {
          n.done = true; nodesDone++; const N = NODE[n.kind]; addHeal(TIER[N.tier].heal * N.amt); setSig(n.sig);
          ctx.toast(`💪 Lifted! +${N.amt} ${TIER[N.tier].em} ${TIER[N.tier].name}${N.amt > 1 ? 's' : ''}`, 2400); ctx.audio?.chime?.();
          if (star && n === star.node) { star.carry = true; star.mesh = n.body; n.m.remove(n.body); group.add(n.body); ctx.toast('⭐ Carry the Starheart home — gently down the caps!', 3200); }
          else n.m.visible = false;
        } else { n.wob = 0.5; say(`😅 Too heavy! ${need - have} more friend${need - have > 1 ? 's' : ''} close by (${have}/${need}) — 🐻 Bear lifts more`); }
      }
      if (n.wob > 0) { n.wob -= dt; n.body.rotation.z = Math.sin(t * 40) * 0.12 * n.wob; } else n.body.rotation.z = 0;
    }
    if (star && star.carry) {
      const s = star; s.mesh.position.set(p.x, p.y + 2.4, p.z); s.mesh.rotation.y += dt * 2;
      const vy = (p.y - s.lastY) / Math.max(dt, 1e-3); s.lastY = p.y;
      if (vy < -14 && t - s.dropped > 1.5) {
        s.dropped = t; s.carry = false; const low = s.caps.filter(cc => cc.y < p.y).sort((a, b) => b.y - a.y)[0] || s.caps[0];
        const nn = star.node; nn.done = false; nn.m.position.set(low.x, low.y, low.z); nn.m.add(s.mesh); s.mesh.position.set(0, 1, 0); nn.m.visible = true;
        ctx.toast('💫 Whoops! The Starheart bounced onto a lower cap. Go get it!', 2800);
      } else if (Math.hypot(p.x - s.safe.x, p.z - s.safe.z) < 4.5 && p.y < gy(0, 2) + 2.5) {
        s.carry = false; s.mesh.visible = false; star = null; setSig('starHome'); ctx.toast('⭐ The Starheart is home!', 2600);
      }
    }
    // puzzles
    for (const pz of puzzles) {
      if (pz.done || !pz.sigs.every(k => sig[k])) continue;
      pz.done = true; setSig(pz.id); addHeal(pz.req ? 0.1 : 0.04);
      const left = reqLeft().length;
      ctx.toast(`🧩 ${pz.label} solved! ${pz.cls.map(k => CLASSES[k].em).join('')}${left ? ` · ${left} to go` : ''}`, 2600); ctx.audio?.music?.jingle?.('stage') || ctx.audio?.chime?.();
    }
    // Pip hint after 45 s without progress
    if (t - lastProg > 45 && t - hintT > 45) { const nx = reqLeft()[0] || puzzles.find(q => !q.done); if (nx && nx.hint) { hintT = t; ctx.toast(`🐦 Pip: ${nx.hint}`, 5200); } }
    checkKey(); updateExit(cam);
  }
  function status() { return { id, exit: exitAt ? { x: exitAt.x - A.x, z: exitAt.z - A.z, open: exitOpen, n: crewAtExit() } : null, starGot, sig: { ...sig }, puzzles: puzzles.map(p => ({ id: p.id, done: p.done, req: p.req })), keyDone, picked, keyDew, props: props.filter(p => p.act).map(p => ({ act: p.act, cls: p.cls, sig: p.sig, label: p.label, x: p.x, y: p.y, z: p.z, done: !!p.done, b: p.b || null, from: p.from || null })), plates: plates.map(p => ({ sig: p.sig, x: p.x, y: p.y, z: p.z, heavy: p.heavy, holder: p.holder })), nodes: nodes.map(n => ({ kind: n.kind, x: n.m.position.x, y: n.m.position.y, z: n.m.position.z, done: n.done, sig: n.sig })), picks: picks.map(k => ({ tier: k.tier, x: k.m.position.x, y: k.y, z: k.m.position.z, got: k.got, show: k.show || null, who: k.who || null, night: k.nightOnly })), hoops: hoops.map(h => ({ x: h.m.position.x, y: h.m.position.y, z: h.m.position.z, got: h.got })), A: { ...A }, baseY }; }
  return {
    homePos: () => homeAt || { x: A.x, z: A.z }, load: (a, b) => { keyDew = 0; homeAt = null; load(a, b); }, clear, update, keyGoalMet, goal: () => recipe?.goal || '', active: () => !!recipe,
    act, wheelOpts, status, result: () => result, puzzleList: () => puzzles.map(p => ({ ...p })), NEED, SIZE, MAPS,
  };
}
