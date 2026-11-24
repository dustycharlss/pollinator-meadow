import { at1x } from './tex.js';
// Valley zones — eight hand-built three-class maps (Scout / Trickster / Bruiser).
// Lost Vikings loop: each level needs all three classes; idle crew keep holding plates while you swap.
// Fern Nov 9 beats (three-class-levels.md). Blocking walls are solids (terrain is cosmetic + water).
import * as THREE from 'three';
import { WATER_RECTS, WATER_Y } from './data.js';
import { setZoneHeight } from './world.js';
import { CLASSES, CLASS_OF, ACTS, classOf } from './classes.js';
import { skinText } from './skins.js';
import { loadGLB, lambertFrom } from './models.js';
import { swatchUV, atlasMaterial, writeAtlasUV, mergeAtlasRig } from './act3-atlas.js';
import { createIconSheet } from './act3-icons.js';
import { setCaveLevel, installFallbackHooks, isShaderFallback, fallbackMaterial, applyGhostMaterial, refreshFallbackMaterials } from './l20-fallback.js';
import { lodify, lodFor } from './lod.js';
import { canShowFriendsStation } from './net/flags.js';
import { waterSurface, FOAM_MAT } from './water.js';
import { MAPS2 } from './act2-maps.js';
import { MAPS3 } from './act3-maps.js';
import { BANTER, HUB_BANTER } from './banter-data.js';
const banterOf = id => BANTER[id] || null; // POLISH: Fern's banter.md lines win over the old inline banter
import { mergeGeometries as mergeGeos } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// team-lift sizes follow the class (Fern): Scout = tiny, Trickster = medium, Bruiser = bear
export const SIZE = Object.fromEntries(Object.entries(CLASS_OF).map(([id, c]) => [id, CLASSES[c].size]));
export const FLYERS = new Set(['bee', 'butterfly', 'hummingbird', 'moth', 'bumblebee']);
const NEED = { team: { tiny: 3, medium: 2, bear: 1 }, heavy: { tiny: 5, medium: 3, bear: 1 }, heaviest: { tiny: 2, medium: 2, bear: 2 } };
const TIER = {
  petal: { name: 'Petal', em: '🌸', col: 0xffb7d6, heal: 0.012, geo: () => new THREE.OctahedronGeometry(0.55) },
  dew: { name: 'Dewdrop', em: '💧', col: 0x7fd8ff, heal: 0.02, geo: () => new THREE.SphereGeometry(0.5, 12, 10) },
  star: { name: 'Starseed', em: '⭐', col: 0xffe066, heal: 0.08, geo: () => new THREE.IcosahedronGeometry(0.7) },
};
const NODE = { team: { name: 'Honey Log', tier: 'petal', amt: 6 }, heavy: { name: 'Dew Pond', tier: 'dew', amt: 4 }, heaviest: { name: 'Starheart', tier: 'star', amt: 1 } };
// CC0 premade models (Kenney Nature / Fantasy Town kits), dressed over blocky colliders
const GLB = {
  boulder: 'three-class/boulder', log: 'three-class/log', fence: 'three-class/fence-broken', lantern: 'three-class/lantern',
  bridge: 'three-class/bridge', tree: 'three-class/tree', stump: 'three-class/stump', hedge: 'three-class/hedge', basket: 'three-class/basket', rock: 'three-class/rock', tent: 'three-class/tent', stall: 'three-class/stall',
};

// art pass (Golden Hour Pastel, STYLE-GUIDE §1): mint hedges, rose-brown wood, lavender stone, peach mud. was hedge 0x4f9a3e hedgeTop 0x5fae4a wood 0x8b6a45 bark 0x6b4a30 stone 0x9a968c cliff 0x8a8578 dirt 0x8a6a3e
const COL = { hedge: 0x58b878, hedgeTop: 0x79cf8c, snow: 0xb3b2cd, snowTop: 0xeef0fb, wood: 0xb07a5e, bark: 0xa06a5a, stone: 0xb4a4cc, cliff: 0xa898bc, dirt: 0xeec4a6, cream: 0xf3eee0, gold: 0xffd23f };

// ---- cosmetic terrain spec → height fn (walls/ledges are solids, not terrain) ------------
function terrainFrom(spec) {
  const { x0, x1, z0, z1 } = spec.bounds;
  return (lx, lz) => {
    if (lx < x0 - 2 || lx > x1 + 2 || lz < z0 - 2 || lz > z1 + 2) return null;
    let h = spec.base ?? 0.3;
    h += 0.12 * Math.sin(lx * 0.31) * Math.cos(lz * 0.27);
    for (const st of spec.terraces || []) h += st[2] * Math.min(1, Math.max(0, (lz - st[0]) / (st[1] - st[0]))); // terraces: [z0, z1, rise] full-width ramps
    for (const m of spec.mounds || []) { const d = Math.hypot(lx - m[0], lz - m[1]); if (d < m[2]) h += m[3] * (1 - d / m[2]) ** 2; }
    for (const r of spec.deep || []) {
      const dx = Math.max(r[0] - lx, 0, lx - r[2]), dz = Math.max(r[1] - lz, 0, lz - r[3]), d = Math.hypot(dx, dz);
      if (d === 0) h = -1.6; else if (d < 1) h = Math.min(h, -1.6 + d * 1.9);
    }
    // Soft leaf-net chasms (L20): dip the floor, not a water tile.
    for (const r of spec.pits || []) {
      const dx = Math.max(r[0] - lx, 0, lx - r[2]), dz = Math.max(r[1] - lz, 0, lz - r[3]), d = Math.hypot(dx, dz);
      if (d === 0) h = -2; else if (d < 1) h = Math.min(h, -2 + d * 2);
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
export const READY_LEVELS = new Set(['trailhead_trials', 'sunbeam_grove', 'mill_pond', 'bramble_patch', 'weathervane_hill', 'hornet_hedge', 'owl_wood', 'frost_hollow', 'backyard_split', 'training_garden', 'sunny_hollow', 'creek_bend', 'moon_meadow', 'log_jam', 'picnic_lawn', 'cliff_orchard', 'windy_rise', 'festival_glade']);
/** a level is playable as soon as its map exists (MAPS / MAPS2), so levels added later need no list edit */
export const hasLevel = id => !!MAPS[id] && !MAPS[id].hub && !String(id).startsWith('a2_');

const MAPS = {
  // Training Garden (t159u): a tiny fenced kids' tutorial — one thing per station, only the next thing glows.
  training_garden: {
    goal: 'Training Garden', kid: true, startCls: 'trickster',
    key: 'puzzles', ceil: 8, exit: [0, 62], par: 0,
    bounds: { x0: -10, x1: 10, z0: -10, z1: 66 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: [], end: [] },
    build(B) {
      B.home(-3, -7);
      B.fence(-5, -9.5, 5, 65.5);
      [[-8, -4], [8, 6], [-8, 18], [8, 30], [-8, 42], [8, 54], [-8, 62]].forEach(([x, z], i) => B.tree(x, z, 0.9 + (i % 3) * 0.1));
      // 1 · walk to the flower
      B.kidFlower('f1', 0, 5);
      B.kidGate('f1', 8);
      // 2 · jump onto the step
      B.wall(0, 12, 4, 3, 1.0, { look: 'wood' });
      B.kidFlower('f2', 0, 12, 1.0);
      B.kidGate('f2', 15.5);
      // 4 · bee flies over the low wall and rings the bell (the wall sinks)
      B.gate('bell4', 0, 19, 10, 1, 4.4, { label: 'Low wall', look: 'hedge', latch: true });
      B.bell('bell4', 0, 22.5, 2.2, { label: 'Bell' });
      // 5 · raccoon pulls the lever → gate
      B.lever('lever5', 3, 26.5, { label: 'Lever' });
      B.kidGate('lever5', 29.5);
      // 6 · bear shoves the block → a step up the ledge
      B.wall(0, 37.5, 10, 3, 2.6, { look: 'stone' });
      B.boulder('block6', -2.6, 32, 0, 35, { kind: 'boulder', w: 2.4, d: 2, h: 1.2, slotH: 1.2, label: 'Block' });
      // 7 · teamwork: bear holds the plate, bee flies through the door, rings the bell
      B.plate('p7', -2.6, 43, { heavy: true, label: 'plate' });
      B.kidGate('door7', 46.5, { held: true });
      B.bell('b7', 0, 49.5, 2.0, { label: 'Bell' });
      // 8 · bear boost: raccoon hops on bear's back to the high ledge lever
      B.wall(3.2, 54, 3.6, 3.4, 4.4, { look: 'stone' });
      B.marker('bruiser', 3.2, 51, 0.1, 'Bear spot'); B.tag('spot8');
      B.lever('lever8', 3.2, 54.2, { base: 4.4, label: 'Lever' });
      B.kidGate('lever8', 57.5);
      B.puzzle('kid', 'Training Garden', ['scout', 'trickster', 'bruiser'], ['lever8']);
    },
    // stations: [station#, icons, words (Pip ≤5 words), done(K), {point, glow, trail, herd, color}]
    steps: K => {
      const E = c => K.em(c);
      const bearSpot = () => K.at('bruiser', 3.2, 51, 1.5);
      return [
        { n: 1, icons: ['🌼'], say: 'Walk to the flower!', point: 'joy', glow: ['f1'], trail: [[1.5, -2], [0, 3.6]], tgt: [0, 0.6, 5], done: () => K.sig('f1') },
        { n: 2, icons: ['⬆️', '🌼'], say: 'Jump up!', point: 'jump', nearPt: [0, 12, 3.6], glow: ['f2'], trail: [[0, 7], [0, 10]], tgt: [0, 1.9, 12], done: () => K.sig('f2'), herd: { scout: [-3, 11], bruiser: [3, 11] } },
        { n: 3, icons: ['👆', E('scout')], say: `Tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => K.cls() === 'scout' || K.sig('bell4') },
        { n: 4, icons: [E('scout'), '⬆️', '🔔'], say: 'Fly up! Ring it!', point: 'jump', hold: true, glow: ['bell4'], color: 'scout', trail: [[-1, 14], [0, 18], [0, 21.5]], tgt: [0, 2.2, 22.5], done: () => K.sig('bell4'), herd: { trickster: [-3, 21], bruiser: [3, 20.5] } },
        { n: 5, icons: ['👆', E('trickster')], say: `Tap the ${E('trickster')}!`, point: 'dock:trickster', color: 'trickster', latch: false, done: () => K.cls() === 'trickster' || K.sig('lever5') },
        { n: 5, icons: [E('trickster'), '🎚️'], say: 'Pull the lever!', point: 'int', glow: ['lever5'], color: 'trickster', trail: [[-2, 22], [2.4, 25.4]], tgt: [3, 0.8, 26.5], done: () => K.sig('lever5'), herd: { scout: [-3, 27], bruiser: [0, 27.5] } },
        { n: 6, icons: ['👆', E('bruiser')], say: `Tap the ${E('bruiser')}!`, point: 'dock:bruiser', color: 'bruiser', latch: false, done: () => K.cls() === 'bruiser' || K.sig('block6') },
        { n: 6, icons: [E('bruiser'), '💪', '🧱'], say: 'Push the block!', point: 'int', glow: ['block6'], color: 'bruiser', trail: [[0, 28.5], [-2.6, 30]], tgt: [-2.6, 1.4, 32], done: () => K.sig('block6') },
        { n: 6, icons: [E('bruiser'), '⬆️'], say: 'Climb up!', point: 'jump', nearPt: [0, 35, 3.4], color: 'bruiser', trail: [[-1, 32.4], [0, 34]], tgt: [0, 3, 35], done: () => K.curY() > 2.4 || K.sig('b7'), herd: { scout: [-3, 37.5, 2.6], trickster: [3, 37.5, 2.6] } },
        { n: 7, icons: [E('bruiser'), '➡️', '🟧'], say: 'Sit on the plate!', glow: ['p7'], color: 'bruiser', trail: [[0, 39.6], [-2.6, 41.6]], tgt: [-2.6, 0.4, 43], latch: false, done: () => K.held('p7') || K.sig('b7') },
        { n: 7, icons: ['👆', E('scout')], say: `Now tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => (K.cls() === 'scout' && K.held('p7')) || K.sig('b7') },
        { n: 7, icons: [E('scout'), '🚪', '🔔'], say: 'Fly in! Ring it!', glow: ['b7'], color: 'scout', trail: [[0, 41], [0, 46.5], [0, 48.6]], tgt: [0, 2, 49.5], done: () => K.sig('b7'), herd: { trickster: [-2.5, 48.5], bruiser: [-1, 49.5] } },
        { n: 8, icons: ['👆', E('bruiser')], say: `Tap the ${E('bruiser')}!`, point: 'dock:bruiser', color: 'bruiser', latch: false, done: () => K.cls() === 'bruiser' || bearSpot() || K.sig('lever8') },
        { n: 8, icons: [E('bruiser'), '➡️', '⭕'], say: 'Stand in the circle!', glow: ['spot8'], color: 'bruiser', trail: [[0, 49.5], [2.6, 50.6]], tgt: [3.2, 0.3, 51], latch: false, done: () => bearSpot() || K.sig('lever8') },
        { n: 8, icons: ['👆', E('trickster')], say: `Tap the ${E('trickster')}!`, point: 'dock:trickster', color: 'trickster', latch: false, done: () => (K.cls() === 'trickster' && bearSpot()) || K.sig('lever8') },
        { n: 8, icons: [E('trickster'), '⬆️', E('bruiser')], say: `Jump on ${E('bruiser')}!`, point: 'jump', hold: true, nearPt: [3.2, 51, 2.6], trail: [[-2, 48.6], [2.4, 50.2]], color: 'trickster', glow: ['spot8'], tgt: [3.2, 2, 51], latch: false, done: () => (K.cls() === 'trickster' && K.curY() > 1.5) || K.sig('lever8') },
        { n: 8, icons: [E('trickster'), '⬆️', '⬆️'], say: 'Jump up high!', point: 'jump', hold: true, color: 'trickster', tgt: [3.2, 4.6, 53.4], latch: false, done: () => (K.cls() === 'trickster' && K.curY() > 4.1) || K.sig('lever8') },
        { n: 8, icons: [E('trickster'), '🎚️'], say: 'Pull the lever!', point: 'int', glow: ['lever8'], color: 'trickster', tgt: [3.2, 5.2, 54.2], done: () => K.sig('lever8'), herd: { scout: [-2.5, 56], bruiser: [-0.5, 56] } },
        { n: 9, icons: ['🏁', E('scout'), E('trickster'), E('bruiser')], say: 'Everyone to the flag!', point: 'exit', glow: ['exit'], trail: [[0, 57.5], [0, 60]], tgt: [0, 1, 62], done: () => false },
      ];
    },
  },

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
    intro: ['Tap a portrait to swap · friends stay put'],
    tutor: [
      { until: 'sun', say: '🐦 Swap to 🐝 Bee (1) and fly to the glowing bell up north.' },
      { until: 'patch', say: '🐦 Swap to 🦝 Raccoon (2) · pull the green-glow lever.' },
      { until: 'glade', say: '🐦 Swap to 🐻 Bear (3) · shove the orange-glow log.' },
      { until: 'boostStar', optional: true, say: '🐦 Secret: park Bear by the tall rock, hop Raccoon up his back!' },
    ],
    build(B) {
      B.rim(12);
      ring(18, 21, 15.5, 4, [0, 9]).filter((_, i) => i % 2 === 0).forEach(([x, z], i) => B.tree(x, z, 0.95 + (i % 3) * 0.1)); // thinned (t158u)
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
      // 3 · Hold-and-go: Trickster holds the dam plate, Bear hops the steps, smashes the branch cage, Scout rings the willow bell
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
      B.puzzle('willow', 'Willow Lookout', ['trickster', 'bruiser', 'scout'], ['willow'], { hint: '🐾 Park your Trickster on the dam plate · 🐻 Bear hops up the steps and smashes the branches · 🪽 Scout rings the willow bell.' });
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
      ring(14, 19, 15, 6, [3, 4, 10]).filter((_, i) => i % 2 === 0).forEach(([x, z]) => B.tree(x, z, 1.0, 0, 0x2f5e3a)); // thinned (t158u)
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
      B.lever('jam1', 5.2, 6, { base: 7, label: 'Drain lever', need: ['logA', 'logB'], needWhy: 'Build the log stair first — Bear shoves both loose logs' });
      for (let i = 0; i < 4; i++) B.pickup('petal', -6.5 + i, 10.5, 0.9);
      B.checkpoint(0, 8); // level-audit P1.3: mid flags
      // Jam 2 (12 tall): heavy plate opens a high gap; Scout flies through and rings the gate bell
      B.wall(-5.1, 15, 7.6, 1.6, 12, C); B.wall(0, 15, 2.4, 1.6, 12, { ...C, bot: 3.4 }); B.wall(1.9, 15, 1.4, 1.6, 12, C);
      B.wall(4, 15, 2.8, 1.6, 4.8, C); B.wall(4, 15, 2.8, 1.6, 12, { ...C, bot: 7.4 }); B.wall(7.1, 15, 3.4, 1.6, 12, C);
      B.gate('gap', 4, 15, 2.8, 1.6, 7.4, { bot: 4.8, label: 'High gap' });
      B.gate('jam2', 0, 15, 2.4, 1.6, 3.4, { latch: true, label: 'Jam 2' });
      B.plate('gap', 4, 12, { heavy: true, label: 'heavy plate' });
      B.bell('jam2', 0, 17.6, 3.0, { label: 'Gate bell' });
      for (let i = 0; i < 4; i++) B.pickup('petal', 3.5 + i, 20.5, 0.9);
      B.checkpoint(0, 17);
      // Tower Jam (level-audit P1.3: two ahas): log ramp → vine → the rope is already down → Scout hooks it → stairs for all
      B.wall(0, 29, 10, 6, 9.4, { look: 'log' });
      B.boulder('logC', -5.5, 19.5, -3, 24.8, { kind: 'log', w: 2.2, d: 1.6, h: 1.0, slotH: 2.6, label: 'Ramp log' });
      B.wall(-3, 25.4, 2, 1.2, 7.2, { look: 'log', bot: 6.6 });
      B.vine(-3, 24.4, 2.6, -3, 25.4, 7.3, { need: ['logC'], needWhy: 'Shove the ramp log under the vine first (Bear)', label: 'Vine' });
      B.checkpoint(-3, 25.4, 7.2); // on the vine ledge
      B.bell('hook', 3, 25.4, 10.2, { label: 'Rope hook' }); // rope pre-dropped (was a Trickster throw at a rope target)
      B.steps('hook', [[6.9, 32.4, 3, 1.6, 1.9], [6.9, 30.8, 3, 1.6, 3.8], [6.9, 29.2, 3, 1.6, 5.7], [6.9, 27.6, 3, 1.6, 7.6]]);
      // secret: Starseed on a high nook beside the tower — boost a Trickster off Bear
      B.wall(-7.2, 31.5, 3, 3, 5.2, { look: 'log' });
      B.pickup('star', -7.2, 31.5, 6.0, { who: ['trickster'], whyNot: 'Too heavy for a Scout — boost your Trickster off Bear!', set: 'jamStar' });
      B.cave(0, 33);
      [[-3, -5], [3, -6], [0, 11], [-6, 18], [3, 21], [0, 23]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      B.puzzle('jam1', 'Stair builder', ['bruiser', 'trickster'], ['jam1'], { hint: '🐻 Shove both loose logs into the stair slots · 🐾 climb up and pull the drain lever.' });
      B.puzzle('jam2', 'Heavy plate', ['bruiser', 'scout'], ['jam2'], { hint: '🐻 Park Bear on the heavy plate · 🪽 fly through the high gap and ring the gate bell.' });
      B.puzzle('tower', 'Tower climb', ['bruiser', 'trickster', 'scout'], ['hook'], { hint: '🐻 Shove the ramp log · 🐾 climb the vine to the ledge · 🪽 ring the rope hook.' });
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
    goal: 'Boulder Stair · waterfall switch · Moonfruit Shelf · then all three up to the 🏁 exit on the high ledge',
    key: 'puzzles', ceil: 20, nightCycle: 180, dewWindow: 20, exit: [4, 23.5, 2.6, 11.6], par: 420,
    banter: {
      start: ['🦝 Raccoon: That cliff goes up, and up, and UP.', '🐻 Bear: I can\'t climb. But I can make stairs!', '🐝 Bee: And I\'ll grab the Moonfruit at the very top!'],
      end: ['🐝 Bee: Look at the view from up here!', '🦝 Raccoon: Bear, you were a great step.', '🐻 Bear: I\'m a great everything.'],
    },
    bounds: { x0: -20, x1: 20, z0: -12, z1: 26 },
    crew: 'Bee · Raccoon · Bear',
    intro: ['🍎 Climb ledge by ledge as a team.', 'Boost chain: Bear is a step for your Trickster, and the Scout tops it off.'],
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
      B.checkpoint(-2, 10, 7); // level-audit P1.4: ledge 1 flag after the boulder stair
      // 2 · Waterfall switch (Trickster throw from the lip) opens the cave stair
      B.waterfall(10, 18, 2.4, 7, 11.6); B.pool(10, 15, 3, 7);
      B.pickup('dew', 9, 14, 7.8); B.pickup('dew', 11, 15.5, 7.8);
      B.target('cave', 10, 18.1, 9.4, { from: { x: 10, z: 13, r: 2.6, minH: 6.6 }, range: 9, label: 'Switch behind the waterfall', fromWhy: 'Stand on the ledge lip in front of the waterfall to throw' });
      B.steps('cave', [[16, 17.1, 2.4, 1.8, 9.2]], 7);
      B.checkpoint(16, 17.1, 9.2, { show: 'cave' }); // on the cave stair once it appears
      // 3 · Boost chain: Bear on ledge 2, Trickster hops to the shelf lever, Scout rings the Moonfruit bell
      B.marker('bruiser', -13.8, 21.2, 11.8, 'Park Bear here');
      B.checkpoint(-16.6, 20.4, 11.6); // ledge 2 flag beside the boost mark (not on it: the rings would overlap)
      // landmark: a glowing Moonfruit tree on the shelf, visible from home looking north
      B.tree(-15.6, 25.2, 1.5, 16.8, 0x9a5ad0); [[-15.2, 24.4, 20.6], [-16.4, 25.6, 21.2], [-14.8, 25.8, 21.6]].forEach(([x, z, h]) => B.orb(x, z, h, 0.42, 0xffe066));
      B.lever('shelf', -14.5, 24.4, { base: 16.8, label: 'Shelf lever' });
      B.cage(-10, 24, 3, 3, 2.4, { base: 16.8, gate: 's', gateSig: 'shelf', look: 'leaf' });
      B.bell('moon', -10, 24.4, 18.1, { label: 'Moonfruit bell' });
      B.pickup('petal', -10, 23.6, 17.6, { show: 'moon', who: ['scout'], whyNot: 'Only a Scout can reach inside', set: 'fruitGot' });
      // secret: a Starseed tucked on the far corner of the Moonfruit Shelf — only a flyer finds it
      B.pickup('star', -8.6, 25.6, 17.6, { who: ['scout'], whyNot: 'Only a Scout can carry this from up here!', set: 'cliffStar' });
      B.nightDew(-14, 22, 12.6); B.nightDew(14, 23, 12.6); B.nightDew(0, 12, 7.8);
      [[-4, -4], [4, -4], [12, 2], [-12, 13], [6, 12], [-6, 21]].forEach(([x, z]) => B.pickup('petal', x, z, z > 18 ? 12.4 : z > 10 ? 7.8 : 0.9));
      B.puzzle('stair', 'Boulder Stair', ['bruiser'], ['b1', 'b2', 'b3'], { hint: '🐻 Shove both boulders into the stair slots by the cliff, then the third onto the ledge plate.' });
      B.puzzle('cave', 'Waterfall switch', ['trickster'], ['cave'], { hint: '🐾 From the ledge lip, throw an acorn at the switch behind the waterfall.' });
      B.puzzle('moon', 'Moonfruit Shelf', ['bruiser', 'trickster', 'scout'], ['fruitGot'], { hint: '🐻 Park Bear by the shelf · 🐾 hop up and pull the lever · 🪽 ring the Moonfruit bell and grab the Moonfruit.' });
      B.puzzle('cliffStar', 'Secret Starseed', ['scout'], ['cliffStar'], { req: false, hint: '🪽 Something sparkles on the far corner of the Moonfruit Shelf…' });
    },
  },

  windy_rise: {
    goal: 'Cross the gully · thread the wind hoops · haul the Fork Tree Honey Log · then all three to the 🏁 exit',
    key: 'puzzles', ceil: 14, exit: [34, -3, 2.6], par: 420,
    banter: {
      start: ['🐝 Bee: Whoooa — this wind is strong!', '🐻 Bear: Wind doesn\'t bother me. I\'m big.', '🦝 Raccoon: Then hold still while I build us a bridge.'],
      end: ['🐝 Bee: I rode the wind like a kite!', '🦝 Raccoon: And the Honey Log made it to the top.', '🐻 Bear: …Can we eat it now?'],
    },
    bounds: { x0: -10, x1: 40, z0: -14, z1: 20 }, deep: [[12, -14, 16, 20]],
    wind: { x0: 18, x1: 36, z0: 0, z1: 14, every: 4, dur: 1.3, push: 6 },
    crew: 'Bee · Raccoon · Bear',
    intro: ['💨 Gusts blow on a rhythm — glide between them.', 'Bear + Trickster build the gully crossing together.'],
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
      [[20, 6, 6.2], [26, 10, 8.2], [32, 6, 10.2]].forEach(([x, z, h]) => B.pickup('petal', x, z, h, { show: 'canopy' }));
      // secret: Starseed on the tall east rock — boost a Trickster off Bear
      B.wall(38, -6, 3, 3, 5.2, { look: 'stone' });
      B.pickup('star', 38, -6, 6.0, { who: ['trickster'], whyNot: 'Too heavy for a Scout — boost your Trickster off Bear!', set: 'windStar' });
      B.puzzle('gully', 'Gully crossing', ['bruiser', 'trickster'], ['plank'], { hint: '🐻 Shove the log into the gully · 🐾 then build the planks on top.' });
      B.puzzle('wind', 'Wind gate', ['scout'], ['canopy'], { hint: '🪽 Glide through the three pink hoops in order between gusts, then ring the canopy bell.' });
      B.puzzle('fork', 'Fork Tree Honey Log', ['trickster', 'bruiser', 'scout'], ['hauled'], { hint: '🐾 Climb the Fork Tree vine and pull the lever · 🐻 shove the Honey Log into the basket · 🪽 ring the bell on top.' });
      B.puzzle('windStar', 'Secret Starseed', ['bruiser', 'trickster'], ['windStar'], { req: false, hint: '🐻 Park Bear by the tall east rock, then boost your Trickster.' });
    },
  },

  festival_glade: {
    goal: 'Timber Stage · Lantern Lane · Cliff Seats · carry the Starheart home · then all three to the 🏁 exit',
    key: 'puzzles', star: true, ceil: 14, nightCycle: 180, dewWindow: 20, exit: [0, -4.5, 2.8], par: 600,
    banter: {
      start: ['🐝 Bee: The Festival! Lights, music, everything!', '🦝 Raccoon: Three districts, three puzzles. We know every trick now.', '🐻 Bear: And then the Starheart. Let\'s bring it home together.'],
      end: ['🐝 Bee: The whole valley is celebrating!', '🦝 Raccoon: We did every level. Every single one!', '🐻 Bear: Best crew in the meadow. Group hug!'],
    },
    bounds: { x0: -26, x1: 26, z0: -12, z1: 30 }, deep: [[-26, 6, 26, 9.5]],
    crew: 'Bee · Raccoon · Bear',
    intro: ['🎉 Every district needs a different combo.', 'Open all three to free the Starheart on the knoll, then carry it home!'],
    build(B) {
      B.rim(14); B.water(0x7fc0ff); B.home(0, 0);
      B.bridgeFixed(-20, 4.6, -20, 10.9, 4); // wide bridge (everyone) west
      B.plank('plank', 0, 4.6, 0, 10.9, { thin: true, label: 'Creek plank spot' });
      // Lookout Knoll + Starheart cage (opens when all three districts are done)
      // level-audit P1.2: top cap dropped, the carry starts on the 2.8 m ledge (gentle-drop rule kept)
      [[7, 1.4], [5.2, 2.8]].forEach(([r, h]) => B.cyl(0, 20, r, h, 0x7cc35a));
      B.cage(0, 20, 3.2, 3.2, 2.6, { base: 2.8, gate: 's', gateSig: ['d1', 'd2', 'd3'], look: 'gold' });
      B.starheart(0, 20, 2.8, [[0, 20, 2.8], [0, 14.2, 1.4], [0, 2, 0.4]]);
      B.pipOn(['d1', 'd2', 'd3'], 'Stand close with two friends, then lift. Walk the caps slowly.');
      B.checkpoint(-20, 11); B.checkpoint(15, 16.5); B.checkpoint(0, 15.6, 2.8); B.checkpoint(7.5, -1);
      // north bank dress: banners + Petals so the stage→lantern walk isn't empty
      [[-10, 18.6], [10, 18.6]].forEach(([x, z]) => B.banner(x, z, 0)); B.banner(-0.6, 17.4, 2.8);
      B.pickup('petal', -10, 18, 0.9); B.pickup('petal', 0, 18, 3.7); B.pickup('petal', 10, 18, 0.9);
      [[5, 2.4], [6, 3.4], [7, 2.4]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
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
      // D3 Cliff Seats & Picnic Tiers (level-audit P1.2: moved ~8 m closer to home): Bear plate + Trickster throw open the seat box, Scout rings the seat bell
      B.wall(13, 0, 6, 6, 1.2, { look: 'stone' }); B.wall(14, 0, 4, 6, 2.4, { look: 'stone' });
      B.cage(10, 0, 3, 3, 2.4, { gate: 'w', gateSig: ['seatP', 'tierT'], look: 'wood' });
      B.plate('seatP', 6, -4, { heavy: true, label: 'seat plate' });
      B.wall(16, -6, 0.6, 0.6, 4, { look: 'wood' }); B.target('tierT', 16, -6, 4.6, { range: 14, label: 'Picnic Tier flag' });
      B.bell('d3', 10, 0, 1.6, { label: 'Seat bell' });
      [[-22, 0], [22, 2], [-8, -6], [8, -8], [-20, 16], [22, 26]].forEach(([x, z]) => B.pickup('petal', x, z, 0.9));
      B.nightDew(-6, 26, 1.2); B.nightDew(6, 26, 1.2);
      // secret: Starseed on the tall drum (north-west) — boost a Trickster off Bear
      B.wall(-20, 27, 3, 3, 5.2, { look: 'wood' });
      B.pickup('star', -20, 27, 6.0, { who: ['trickster'], whyNot: 'Too heavy for a Scout — boost your Trickster off Bear!', set: 'festStar' });
      B.tree(-24, -10, 1.1); B.tree(24, 28, 1.1); B.tree(-24, 28, 1.1);
      B.puzzle('d1', 'Timber Stage', ['bruiser', 'trickster'], ['d1'], { hint: '🐻 Shove both stage logs into the stair · 🐾 climb up and pull the curtain lever.' });
      B.puzzle('d2', 'Lantern Lane', ['trickster', 'scout'], ['l1', 'l2'], { hint: '🐾 Park your Trickster on the shutter plate · 🪽 slip through the knothole and light both lanterns.' });
      B.puzzle('d3', 'Cliff Seats', ['bruiser', 'trickster', 'scout'], ['d3'], { hint: '🐻 Bear on the seat plate · 🐾 throw at the Picnic Tier flag · 🪽 ring the seat bell.' });
      B.puzzle('star', 'Starheart relay', ['bruiser', 'trickster', 'scout'], ['starHome'], { hint: '⭐ Lift the Starheart with two friends close by, then carry it home — gently down the caps.' });
      B.puzzle('festStar', 'Secret Starseed', ['bruiser', 'trickster'], ['festStar'], { req: false, hint: '🐻 Park Bear by the tall drum, then boost your Trickster.' });
    },
  },
};

Object.assign(MAPS, MAPS2, MAPS3);
export function createZones(scene, host) {
  let focusId = null;
  const ctx = Object.assign(Object.create(host), {
    getP() {
      const id = focusId != null ? focusId : host.cur();
      if (id == null) return host.getP();
      return id === host.cur() ? host.getP() : (host.parked(id) || host.getP());
    },
    cur() { return focusId != null ? focusId : host.cur(); },
    driven() {
      const list = typeof host.driven === 'function' ? host.driven() : null;
      if (Array.isArray(list) && list.length) return list.filter(Boolean);
      const c = host.cur();
      return c ? [c] : [];
    },
  });
  const withFocus = (id, fn) => { const prev = focusId; focusId = id; try { return fn(); } finally { focusId = prev; } };
  const group = new THREE.Group(); scene.add(group);
  const icons = createIconSheet(scene);
  let solids = [], picks = [], nodes = [], hoops = [], nightDews = [], star = null;
  let petalV = 0, homeAt = null, A = { x: 0, z: 0 }, baseY = 0, recipe = null, id = null, picked = 0, keyDone = false, msgT = 0, t = 0;
  let tutorI = 0, tutorT = -99, endLines = [], result = null;
  let hubPads = [], hubFr = [], friendsSpec = null;
  let exitAt = null, exitOpen = false, exitMesh = null, exitLabel = null, starGot = false;
  let nightOn = false, dewPulseT = -99, nodesDone = 0, keyDew = 0;
  let sampleH = null, waterMeshes = [], terrMesh = null, instWalls = [], decoJobs = new Map(), decoBatching = false, camRooms = [], caveChunks = [], atlasInsts = [];
  // three-class puzzle state
  let kidObjs = [];
  let fades = [], hlT = 0, objCache = null, objEl = null, nearOwn = null;
  let sig = {}, props = [], gates = [], plates = [], puzzles = [], deep = [], crossings = [], steps = [], tw = null, lastProg = 0, hintT = 0, bearPad = null, windT = 0, introQ = [];
  const mats = new Map();
  // art pass: the few hard-coded forest greens / dark browns used by B.tree, hedges and logs map onto Golden Hour Pastel swatches
  const B_REMAP = { 0x3f8a35: 0x5cc48a, 0x4fa044: 0x6fd39a, 0x6b4a30: 0xa06a5a, 0x4f9a3e: 0x58b878, 0x5a3b22: 0x8a5a4a, 0x5fae4a: 0x79cf8c };
  const mat = (c, e = 0) => { if (typeof c === 'number' && B_REMAP[c] != null) c = B_REMAP[c]; const k = c + ':' + e; if (!mats.has(k)) { const m = new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e, flatShading: true }); mats.set(k, m); if (matLive) styleNew(new THREE.Mesh(STYLE_GEO, m)); } return mats.get(k); };
  let matLive = false, warmSpr = null, warmGlb = new Map(), warmTex = null, warmBox = null; const STYLE_GEO = new THREE.BufferGeometry();
  const gy = (x, z) => { if (sampleH) { const h = sampleH(x, z); if (h != null) return h; } return (ctx.meadowHeightAt || ctx.heightAt)(A.x + x, A.z + z); };
  const W = (x, z) => ({ x: A.x + x, z: A.z + z });
  const texL = new THREE.TextureLoader(), badgeMat = {};
  const badgeOf = c => {
    if (badgeMat[c]) return badgeMat[c];
    icons.packImage('badge:' + c, CLASSES[c].badge);
    return (badgeMat[c] = { opacity: 1, depthTest: false, transparent: true, color: new THREE.Color(0xffffff), userData: { iconKey: 'badge:' + c } });
  };
  // POLISH §3 second cue: class rings take the class shape (Scout circle · Trickster rounded square · Bruiser hex), not just its colour
  const SHAPE_SEG = { circle: 28, square: 4, hex: 6 };
  function shapeRingGeo(c, r0, r1) { const sh = CLASSES[c]?.shape || 'circle', g = new THREE.RingGeometry(sh === 'square' ? r0 * 1.2 : r0, sh === 'square' ? r1 * 1.2 : r1, SHAPE_SEG[sh] || 28); if (sh === 'square') g.rotateZ(Math.PI / 4); if (sh === 'hex') g.rotateZ(Math.PI / 6); return g.rotateX(-Math.PI / 2); }
  const LOOK = { hedge: COL.hedge, snow: COL.snow, stone: COL.stone, cliff: COL.cliff, wood: COL.wood, bark: 0x8a5a4a, leaf: 0x6fd39a, dirt: COL.dirt, log: 0xb08a6a, cream: COL.cream, glass: 0xbfe8ff, gold: 0xffc94a, cave: 0x9c8cc6 };
  // Cave-mouth GLBs (pixor entrance moss / light stone) otherwise leak khaki/olive into the spawn foreground.
  function cavePaletteMat(src) {
    if (!(recipe && recipe.caveFloor) || !src || !src.color) return src;
    const n = (src.name || '').toLowerCase();
    const { r, g, b } = src.color;
    const moss = /moss|grass|leaf|turf/.test(n) || (g > r * 1.2 && g > b * 1.2);
    const khaki = /light stone|dirt|sand|soil|bank/.test(n) || (r > 0.28 && g > 0.25 && Math.abs(r - g) < 0.12 && b < r * 0.95 && b < g * 0.95);
    if (moss || khaki) return mat(LOOK.cave);
    if (/^stone$|rock face|boulder/.test(n)) return mat(0x5e5288);
    return src;
  }
  // Mechanic framed-mirror pane (#ddedf9 glass). Keep it off the S148/S149 atlas
  // merge. Lambert lighting left a dark left half, so the official-box median
  // stayed at gray ΔE 9.1 (Y 46). Use unlit MeshBasic so the whole visible pane
  // lifts together and the official boxes can reach gray ΔE ≥ 12.
  const PANE_SRC = 0xddedf9, PANE_TINT = 0xe8eef8;
  function isFramedMirrorPane(mat, name) {
    const nm = name || '';
    const matName = (mat && mat.name) || '';
    // GLTFLoader splits the 9-prim mesh into built-framed-mirror / _0 (glass)
    // and _1+ (dark-wood / gold frame). Only the glass primitive is the pane.
    if (/framed-mirror_[1-9]\d*$/i.test(nm)) return false;
    if (/framed-mirror_0$/i.test(nm) || (/framed-mirror$/i.test(nm) && !/framed-mirror_/i.test(nm))) return true;
    if (/^mirror$/i.test(matName) && /framed-mirror/i.test(nm)) return true;
    if (!mat || !mat.color || mat.map) return false;
    const c = mat.color.getHex();
    const dr = Math.abs(((c >> 16) & 255) - ((PANE_SRC >> 16) & 255));
    const dg = Math.abs(((c >> 8) & 255) - ((PANE_SRC >> 8) & 255));
    const db = Math.abs((c & 255) - (PANE_SRC & 255));
    return (dr + dg + db) <= 24;
  }
  // Official mechanic pane box is mostly the shadowed left dark-wood frame, not the
  // glass, so the box median stays at gray ΔE 10.7 even with an unlit pane. Keep the
  // dark-wood posts off the cave atlas (noMerge), unlit, and slightly lifted so the
  // official boxes can reach gray ΔE ≥ 12. Do not retint the gold 'frame' trim.
  const FRAME_TINT = 0xc8b8c4;
  function isFramedMirrorWood(mat, name) {
    const nm = name || '';
    const matName = (mat && mat.name) || '';
    if (!/framed-mirror/i.test(nm)) return false;
    if (isFramedMirrorPane(mat, name)) return false;
    if (/^dark-wood$/i.test(matName)) return true;
    return false;
  }
  function tintMirrorPane(obj, mat, name) {
    if (!isFramedMirrorPane(mat, name || obj && obj.name)) return mat;
    const m = new THREE.MeshBasicMaterial({
      color: PANE_TINT,
      transparent: !!mat.transparent,
      opacity: mat.opacity,
      side: mat.side,
      fog: false,
      toneMapped: true,
    });
    m.name = mat.name;
    m.userData.noPastel = true;
    if (obj) { obj.userData.noMerge = true; obj.userData.noPastel = true; obj.receiveShadow = false; obj.material = m; }
    return m;
  }
  function tintMirrorWood(obj, mat, name) {
    if (!isFramedMirrorWood(mat, name || obj && obj.name)) return mat;
    const m = new THREE.MeshBasicMaterial({
      color: FRAME_TINT,
      transparent: !!mat.transparent,
      opacity: mat.opacity,
      side: mat.side,
      fog: false,
      toneMapped: true,
    });
    m.name = mat.name;
    m.userData.noPastel = true;
    if (obj) { obj.userData.noMerge = true; obj.userData.noPastel = true; obj.receiveShadow = false; obj.material = m; }
    return m;
  }


  function buildTerrainMesh(fn, bounds) {
    const { x0, x1, z0, z1 } = bounds;
    const Wd = x1 - x0 + 8, D = z1 - z0 + 8, SEG = 96;
    const geo = new THREE.PlaneGeometry(Wd, D, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lem = !!recipe.lemonade;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) + cx, lz = pos.getZ(i) + cz;
      let rel = fn(lx, lz); if (rel == null) rel = -4;
      // visual-only roll (~8 cm). sampleH / terrainFrom stay the walk-route source of truth
      pos.setY(i, rel + 0.08 * Math.sin(lx * 0.17 + 0.4) * Math.cos(lz * 0.13));
      if (rel < -1.2) {
        if (recipe.pits) { col[i * 3] = 0.725; col[i * 3 + 1] = 0.788; col[i * 3 + 2] = 0.541; } // leaf-net #b9c98a
        else { col[i * 3] = lem ? 0.9 : 0.08; col[i * 3 + 1] = lem ? 0.75 : 0.32; col[i * 3 + 2] = lem ? 0.3 : 0.72; }
      }
      else if (rel < 0.05) {
        if (recipe.caveFloor) { col[i * 3] = 0.369; col[i * 3 + 1] = 0.322; col[i * 3 + 2] = 0.533; } // caveShadow #5e5288
        else { col[i * 3] = 0.62; col[i * 3 + 1] = 0.36; col[i * 3 + 2] = 0.26; } // peach mud bank so the shore reads (art pass: B mud #e8b8a0, a touch darker)
      }
      else if (recipe.caveFloor) { const n = 0.5 + 0.5 * Math.sin(lx * 0.21 + 0.4) * Math.cos(lz * 0.17); // CVD caveStone #9c8cc6 -> caveShadow
        const k = 0.35 + 0.65 * n;
        col[i * 3] = 0.369 + (0.612 - 0.369) * k; col[i * 3 + 1] = 0.322 + (0.549 - 0.322) * k; col[i * 3 + 2] = 0.533 + (0.776 - 0.533) * k; }
      else { const n = 0.5 + 0.5 * Math.sin(lx * 0.23 + 1.7) * Math.cos(lz * 0.19), j = 1 + 0.025 * Math.sin(lx * 0.7) * Math.cos(lz * 0.6); // B grass tones #98d8a0..#cdeeb8 (linear), large-scale mix
        col[i * 3] = (0.31 + 0.3 * n * n) * j; col[i * 3 + 1] = (0.69 + 0.17 * n) * j; col[i * 3 + 2] = (0.35 + 0.12 * n) * j; }
    }
    const lookId = recipe && recipe.id, snowLook = lookId === 'thaw_valley';
    const hex = h => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
    const colA = snowLook ? new Float32Array(col.length) : null, colB = snowLook ? new Float32Array(col.length) : null, colC = snowLook ? new Float32Array(col.length) : null;
    if (snowLook) {
      const grasses = ['#eef0fb', '#e6e8f8', '#f4f2fc', '#dfe2f4'].map(hex), bank = hex('#d8d0e4'), hollow = hex('#b3b2cd');
      const melt = hex('#e8eef4'), grassB = hex('#a8e2a6'), grassC = hex('#98d8a0'), bankC = hex('#e8b8a0');
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i) + cx, lz = pos.getZ(i) + cz, rel = pos.getY(i);
        const n = 0.5 + 0.5 * Math.sin(lx * 0.23 + 1.7) * Math.cos(lz * 0.19), gi = (Math.abs(Math.floor(lx * 3 + lz * 2)) % 4);
        const snow = n < 0.35 ? hollow : grasses[gi], patch = n < 0.45 ? melt : grassB;
        const put = (buf, rgb) => { buf[i * 3] = rgb[0]; buf[i * 3 + 1] = rgb[1]; buf[i * 3 + 2] = rgb[2]; };
        if (rel < 0.05) { put(colA, bank); put(colB, bank); put(colC, bankC); }
        else { put(colA, snow); put(colB, patch); put(colC, [grassC[0] * (0.95 + 0.05 * n), grassC[1], grassC[2] * (0.9 + 0.1 * n)]); }
      }
      col.set(colA);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false }));
    mesh.userData.terrain = true; mesh.userData.lookTerrain = snowLook; mesh.userData.colA = colA; mesh.userData.colB = colB; mesh.userData.colC = colC; mesh.userData.colT = 1; mesh.userData.wantSeason = recipe && recipe.masterStart === 'A' ? 'winter' : 'summer';
    mesh.position.set(A.x + cx, baseY, A.z + cz); group.add(mesh); terrMesh = mesh;
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
  // GLB set-dressing joins the level after its load promise resolves (after the level-start warm-up). Pastel-style it
  // before it joins, so it links once with its final (|presetB) key instead of again when the periodic restyle reaches it.
  const styleNew = o => { try { ctx.look?.styleScene?.({ children: [o] }); } catch (e) {} };
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
      const wrap = new THREE.Group(); wrap.add(o); wrap.position.y = -h / 2; styleNew(wrap); holder.add(wrap); lodify(o, key); // polish4: lod-map.json levels
      if (fallback) fallback.visible = false;
    });
  }
  function addSolid(s) { ctx.phys.addDyn(s); solids.push(s); return s; }
  function badge(c, x, y, z, s = 1.15) { const sp = icons.make({ key: 'badge:' + c, size: s, material: badgeOf(c), layer: 'overlay' }); sp.scale.set(s, s, 1); sp.position.set(x, y, z); sp.renderOrder = 8; group.add(sp); return sp; }
  const isOn = (need) => !need || [].concat(need).every(k => sig[k]);
  let applyingNet = false;
  function emitNet(kind, payload) { if (applyingNet) return; ctx.onNetEvent?.({ kind, ...payload }); }
  function setSig(k, v = true) { if (!k || !!sig[k] === !!v) return; if (v) { sig[k] = true; lastProg = t; } else delete sig[k]; emitNet('sig', { sig: k, v: !!v }); }
  function clearWaterIn(x0, z0, x1, z1) { for (let i = WATER_RECTS.length - 1; i >= 0; i--) { const r = WATER_RECTS[i]; if (r.x > x0 - 0.4 && r.x < x1 + 0.4 && r.z > z0 - 0.4 && r.z < z1 + 0.4) WATER_RECTS.splice(i, 1); } }
  const addHeal = () => {}; // adventure refocus: no heal meter
  const nameOf = id => ctx.speciesName ? ctx.speciesName(id) : id;

  // POLISH: 5-value bloom bunch (Fern act2-petals.md): bigger (×1.4), fuller rose-gold flower so kids see it is worth more
  let bloomGeo = null;
  function bloomMesh() {
    if (!bloomGeo) { const parts = [new THREE.OctahedronGeometry(0.55 * 1.4)]; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, g = new THREE.OctahedronGeometry(0.3 * 1.4); g.translate(Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62); parts.push(g); } bloomGeo = mergeGeos(parts); }
    const petal = (recipe && recipe.petalCol) || 0xffb7d6, centre = (recipe && recipe.petalCenter) || 0xffe08a;
    const G = new THREE.Group(); G.add(new THREE.Mesh(bloomGeo, mat(petal, 0.22))); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), mat(centre, 0.28)); c.position.y = 0.28; G.add(c); return G;
  }
  const B = {
    water(c = 0x8fc8e8) {
      // t159u: saturated, rippling surface + white foam lines at the shore (top face only, so no z-fighting)
      const lem = c === 0xffd65a, foamM = FOAM_MAT();
      for (const r of recipe.deep || []) {
        const w = r[2] - r[0], d = r[3] - r[1];
        const m = waterSurface(new THREE.PlaneGeometry(w + 1.4, d + 1.4).rotateX(-Math.PI / 2), { color: lem ? c : (c || 0x8fc8e8), repeat: [(w + 1.4) / 6, (d + 1.4) / 6], lemonade: lem });
        m.position.set(A.x + (r[0] + r[2]) / 2, baseY - 0.9, A.z + (r[1] + r[3]) / 2); group.add(m); waterMeshes.push(m);
        // foam where the water meets the bank (~0.37 outside the rect, where the bank slope crosses the surface)
        for (const [fx, fz, fw, fd] of [[(r[0] + r[2]) / 2, r[1] - 0.37, w + 0.7, 0.32], [(r[0] + r[2]) / 2, r[3] + 0.37, w + 0.7, 0.32], [r[0] - 0.37, (r[1] + r[3]) / 2, 0.32, d + 0.7], [r[2] + 0.37, (r[1] + r[3]) / 2, 0.32, d + 0.7]]) {
          const f = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd).rotateX(-Math.PI / 2), foamM); f.position.set(A.x + fx, baseY - 0.86, A.z + fz); f.renderOrder = 4; group.add(f); waterMeshes.push(f);
        }
      }
    },
    /** solid block: top/bot heights are relative to local ground at (x,z) */
    wall(x, z, w, d, top, o = {}) {
      const g = gy(x, z), bot = o.bot ?? -1.5, T = top - bot, col = o.c ?? LOOK[o.look] ?? COL.stone;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), mat(col));
      m.position.set(A.x + x, g + bot + T / 2, A.z + z); m.rotation.y = o.yaw || 0; m.userData.noCast = true; m.castShadow = false;
      if (!o.hidden) {
        group.add(m);
        if (o.look === 'hedge' || o.look === 'leaf') { const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.25, d + 0.12), mat(o.look === 'leaf' ? 0x4f9a3e : COL.hedgeTop)); cap.position.set(A.x + x, g + top + 0.08, A.z + z); group.add(cap); }
        if (o.look === 'glass') { m.material = new THREE.MeshLambertMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.35 }); }
      } else m.visible = false;
      const s = addSolid({ type: 'box', x: A.x + x, z: A.z + z, hx: w / 2, hz: d / 2, yaw: -(o.yaw || 0), y0: g + bot, top: g + top, kind: 'zone' });
      if (o.hidden) { s.off = true; }
      { const ca = Math.abs(Math.cos(o.yaw || 0)), sa = Math.abs(Math.sin(o.yaw || 0)), hx = (w * ca + d * sa) / 2, hz = (w * sa + d * ca) / 2;
        if (Math.max(w, d) < 14 && !(recipe && recipe.caveFloor)) { const e = { roots: [m], x0: A.x + x - hx, x1: A.x + x + hx, z0: A.z + z - hz, z1: A.z + z + hz, y0: g + bot, y1: g + top + 0.3, a: 1 }; fades.push(e); s.fadeM = e; } } // long boundary cliffs keep the camera pull-in; cave walls are merged instead
      return { m, s, g };
    },
    /** one instanced hedge (or leaf) strip that follows the ground, plus 2 m collision segments and a fly cap.
     *  Use this for Act 3 corridor sides instead of a 2 m B.wall loop — same walk routes, far fewer draws. */
    hedgeRun(x, z0, z1, o = {}) {
      const look = o.look || 'hedge', h = o.h ?? 2.4, thick = o.w ?? 0.6, col = LOOK[look] ?? COL.hedge;
      const topC = look === 'leaf' ? 0x4f9a3e : look === 'snow' ? COL.snowTop : COL.hedgeTop;
      const boxes = [], caps = [], fadeEs = [];
      // collision stays on 2 m segments so walk routes do not change; visuals use 0.5 m instances so terrace steps disappear
      for (let z = z0; z < z1 - 0.01; z += 2) {
        const L = Math.min(2, z1 - z), zc = z + L / 2, g = gy(x, zc), ww = thick, dd = L + 0.05;
        const s = addSolid({ type: 'box', x: A.x + x, z: A.z + zc, hx: ww / 2, hz: dd / 2, yaw: 0, y0: g - 1.5, top: g + h, kind: 'zone' });
        const capS = addSolid({ type: 'box', x: A.x + x, z: A.z + zc, hx: ww / 2, hz: dd / 2, yaw: 0, y0: g + h - 0.1, top: g + 30, kind: 'zone' });
        capS.off = false;
        s.fadeM = true; // instanced visuals fade via the 0.5 m entries below; pull-in still skips this solid
      }
      const vis = 0.5;
      for (let z = z0; z < z1 - 0.01; z += vis) {
        const L = Math.min(vis, z1 - z), zc = z + L / 2, g = gy(x, zc), ww = thick, dd = L + 0.02, T = h + 1.5;
        const hx = ww / 2, hz = dd / 2;
        boxes.push({ x: A.x + x, y: g - 1.5 + T / 2, z: A.z + zc, w: ww, T, d: dd });
        caps.push({ x: A.x + x, y: g + h + 0.08, z: A.z + zc, w: ww + 0.12, T: 0.25, d: dd + 0.12 });
        const e = { inst: true, i: boxes.length - 1, x0: A.x + x - hx, x1: A.x + x + hx, z0: A.z + zc - hz, z1: A.z + zc + hz, y0: g - 1.5, y1: g + h + 0.3, a: 1, want: 1 };
        fades.push(e); fadeEs.push(e);
      }
      const mk = (list, c) => {
        const n = list.length; if (!n) return null;
        const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(c), n);
        im.userData.noCast = true; im.castShadow = false;
        const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
        list.forEach((b, i) => { P.set(b.x, b.y, b.z); S.set(b.w, b.T, b.d); M.compose(P, Q, S); im.setMatrixAt(i, M); b.base = M.clone(); });
        im.instanceMatrix.needsUpdate = true; group.add(im);
        instWalls.push({ im, list });
        return im;
      };
      const imB = mk(boxes, col), imC = mk(caps, topC);
      fadeEs.forEach((e, i) => { e.ims = [imB, imC].filter(Boolean); e.bases = [boxes[i] && boxes[i].base, caps[i] && caps[i].base]; });
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
      const ts = addSolid({ type: 'cyl', x: A.x + x, z: A.z + z, r: 0.4 * s, y0: g - 1, top: g + trunkH + 0.2, kind: 'zone' });
      const e = { roots: [G], x0: A.x + x - 1.5 * s, x1: A.x + x + 1.5 * s, z0: A.z + z - 1.5 * s, z1: A.z + z + 1.5 * s, y0: g + 0.6, y1: g + trunkH + 2.8 * s, a: 1 }; fades.push(e); ts.fadeM = e;
      if (glb) { const H = new THREE.Group(); H.position.set(A.x + x, g + 2.4 * s, A.z + z); group.add(H); e.roots.push(H); dress(H, G, GLB.tree, 3 * s, 4.8 * s, 3 * s); }
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
    /** S1 Meadow Hub station: step on the ring to open a feature. o.need = friend id that unlocks it */
    hubPad(key, x, z, o = {}) {
      if (o.gated) {
        friendsSpec = { key, x, z, o: { ...o } };
        if (!canShowFriendsStation(ctx.settings?.() || {})) return;
      }
      const g = gy(x, z), col = o.col || 0xffc93c;
      const wx = A.x + x, wz = A.z + z;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.65, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.position.set(wx, g + 0.09, wz); group.add(ring);
      let em, model = null;
      if (!o.noSign) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.22), mat(0x8b5e3c)); post.position.set(wx + 1.9, g + 1.1, wz); group.add(post);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.12), mat(0xd8b07a)); sign.position.set(wx + 1.9, g + 2.2, wz); group.add(sign);
        em = emojiSprite(o.emoji || '⭐', 1.5); em.position.set(wx, g + 2.6, wz); group.add(em);
      } else {
        em = emojiSprite(o.emoji || '🧺', 1.5); em.position.set(wx, g + 2.6, wz); group.add(em);
        const holder = new THREE.Group(); holder.position.set(wx, g, wz); holder.rotation.y = o.yaw ?? Math.PI / 2; group.add(holder);
        model = holder;
        loadGLB('act3/online/play-with-friends-station').then(gltf => {
          if (!gltf || !holder.parent) return;
          const o3 = gltf.scene.clone(true);
          o3.traverse(m => {
            if (m.isMesh) { m.material = lambertFrom(m.material); m.castShadow = false; }
            const n = (m.name || '').toLowerCase();
            if (n === 'highlight' || n === 'on') m.visible = false;
          });
          styleNew(o3); holder.add(o3);
          em.visible = false;
        });
      }
      const el = document.createElement('div'); el.className = 'zoneNode hubLbl'; el.style.display = 'none'; document.body.appendChild(el);
      hubPads.push({ key, x: wx, z: wz, y: g, r: 1.6, label: o.label || key, need: o.need || null, lockTx: o.lockTx || '', ring, em, el, inside: false, col, model });
    },
    /** S1 rescued friend living in the hub (decor + banter); hidden until rescued unless o.always */
    friend(kind, x, z, o = {}) {
      const G = (MODEL[kind] || MODEL.duckling)(), s = o.s || 1; G.scale.setScalar(s); G.rotation.y = o.yaw || 0;
      G.position.set(A.x + x, gy(x, z) + (o.base || 0), A.z + z); group.add(G);
      { const bk = { duckling: 'duckling', owlet: 'owlet', fawn: 'fawn' }[o.id === 'ducklings' ? 'duckling' : o.id]; if (bk) babyModel(G, bk); }
      hubFr.push({ id: o.id || kind, G, x: A.x + x, z: A.z + z, y0: G.position.y, ph: hubFr.length * 1.3, say: o.say || [], sayI: 0, near: false });
    },
    home(x, z) { homeAt = { x: A.x + x, z: A.z + z }; }, // t148u: the crew nest is the single home
    // Level exit: all three friends must stand inside once every required puzzle is solved
    exit(x, z, r = 3, base = 0) {
      const y = gy(x, z) + base + 0.06, G = new THREE.Group(); G.position.set(A.x + x, y, A.z + z); group.add(G);
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 40), mat(0x9a8f7a, 0.95)); ringM.rotation.x = -Math.PI / 2; G.add(ringM);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r - 0.1, 32), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.12, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; G.add(disc);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), mat(0x8a5a2b, 0.9)); pole.position.set(r * 0.7, 1.7, 0); G.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.08), mat(0xb0b0b0, 0.9)); flag.position.set(r * 0.7 + 0.7, 3.0, 0); G.add(flag);
      // soft sparkles around the flag (no tall sky beam) — brighter once the exit opens
      const spN = 14, spPos = new Float32Array(spN * 3);
      for (let i = 0; i < spN; i++) { const a = (i / spN) * Math.PI * 2, rr = 0.4 + (i % 3) * 0.35; spPos[i * 3] = r * 0.7 + Math.cos(a) * rr; spPos[i * 3 + 1] = 2.4 + (i % 4) * 0.35; spPos[i * 3 + 2] = Math.sin(a) * rr; }
      const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
      const spark = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0xffe07a, size: 0.55, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
      G.add(spark);
      exitAt = { x: A.x + x, z: A.z + z, y, r }; exitMesh = { G, ringM, disc, flag, pole, spark, flagY: 3.0 };
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
      const g = gy(x, z) + base, m = new THREE.Mesh(shapeRingGeo(c, 1.0, 1.35), new THREE.MeshBasicMaterial({ color: new THREE.Color(CLASSES[c].color), transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
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
      props.push({ kind: 'bell', act: 'bell', cls: 'scout', sig: s, x: A.x + x, y: g + h, z: A.z + z, r: 3.2, touch: 5.0, need: o.need, needWhy: o.needWhy, label: o.label || 'Bell', G, bell, lantern: o.lantern, icon: badge('scout', A.x + x, g + h + 1.3, A.z + z) });
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
      // t159u: ONE clean blocky mesh per block (the old box + dressed model overlapped and z-fought), tinted
      // top / ends, ground-snapped with gy(); the slot ghost is a flat decal with polygonOffset.
      const base = o.base || 0, g0 = gy(x, z) + base, g1 = gy(sx, sz) + base, H = Math.max(o.h, o.slotH) + 2;
      const K = o.kind === 'log' ? { side: 0x8b6a45, top: 0x9c7850, end: 0xd9b07a } : o.kind === 'basket' ? { side: 0xc8a060, top: 0xa07838, end: 0xc8a060 } : { side: 0x9a968c, top: 0xbab6aa, end: 0x9a968c };
      const longX = o.w >= o.d, sideM = mat(K.side), endM = mat(K.end), topM = mat(K.top), botM = mat(0x5a4a3a);
      const mats6 = o.kind === 'log' ? (longX ? [endM, endM, topM, botM, sideM, sideM] : [sideM, sideM, topM, botM, endM, endM]) : [sideM, sideM, topM, botM, sideM, sideM];
      const holder = new THREE.Group(); holder.position.set(A.x + x, g0 + o.h - H / 2, A.z + z); group.add(holder);
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.w, H, o.d), mats6); holder.add(m);
      if (o.kind === 'log') { // two end rings, set just proud of the end faces (no coplanar faces)
        for (const sgn of [-1, 1]) { const ring = new THREE.Mesh(new THREE.BoxGeometry(longX ? 0.04 : Math.min(o.w, o.h) * 0.55, Math.min(o.w, o.d, o.h) * 0.55, longX ? Math.min(o.d, o.h) * 0.55 : 0.04), mat(0xa8784a)); ring.position.set(longX ? sgn * (o.w / 2 + 0.03) : 0, H / 2 - o.h / 2, longX ? 0 : sgn * (o.d / 2 + 0.03)); holder.add(ring); }
      }
      const s0 = addSolid({ type: 'box', x: A.x + x, z: A.z + z, hx: o.w / 2, hz: o.d / 2, yaw: 0, y0: g0 + o.h - H, top: g0 + o.h, kind: 'zone' });
      props.push({ kind: 'boulder', act: 'shove', cls: 'bruiser', sig: s, x: A.x + x, y: g0, z: A.z + z, r: Math.max(o.w, o.d) / 2 + 1.9, need: o.need, needWhy: o.needWhy, label: o.label || 'Boulder',
        holder, s: s0, H, to: { x: A.x + sx, z: A.z + sz, top: g1 + o.slotH }, from: { x: A.x + x, z: A.z + z, top: g0 + o.h }, cross: o.cross, icon: badge('bruiser', A.x + x, g0 + o.h + 1.4, A.z + z) });
      // ghost slot marker: a flat decal on the ground (depthWrite off + polygonOffset → no flicker)
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      gm.position.set(A.x + sx, g1 + 0.16, A.z + sz); gm.renderOrder = 3; group.add(gm); props[props.length - 1].ghost = gm;
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
      props.push({ kind: 'dig', act: 'dig', cls: 'trickster', sig: s, x: a.x, y: a.y, z: a.z, r: 2.0, b, friend: o.friend || null, label: o.label || 'Soft dirt', two: true, icon: badge('trickster', a.x, a.y + 2.0, a.z, 0.9) });
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
      const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1), px = alongX ? 0.3 : w / 2, pz = alongX ? w / 2 : 0.3; // pad across the plank, not along it
      const c = { x0: A.x + Math.min(x1, x2) - px, z0: A.z + Math.min(z1, z2) - pz, x1: A.x + Math.max(x1, x2) + px, z1: A.z + Math.max(z1, z2) + pz, on: false, thin: !!o.thin };
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
      const T = TIER[tier], val = tier === 'petal' ? Math.max(1, o.value || 1) : 1, bloom = val > 1;
      const petalCol = (tier === 'petal' && recipe && recipe.petalCol) || T.col;
      const m = bloom ? bloomMesh() : new THREE.Mesh(T.geo(), mat(petalCol, petalCol === 0xffb7d6 || (recipe && recipe.petalCol) ? 0.22 : 0.8));
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
      const rec = { tier, m, y: m.position.y, got: false, nightOnly: false, show: o.show, set: o.set, who: o.who, whyNot: o.whyNot, value: val, bloom };
      if (o.show) m.visible = false;
      picks.push(rec);
    },
    nightDew(x, z, h) {
      const T = TIER.petal, m = new THREE.Mesh(T.geo(), mat(T.col, 0.22));
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
    puzzle(pid, label, cls, sigs, o = {}) { puzzles.push({ id: pid, label, cls, sigs, req: o.req !== false, hint: o.hint || '', done: false, track: o.track || null }); },
    // ---- Training Garden kit (t159u) ----
    /** white picket fence around a rect + tall invisible walls so nobody (not even a Scout) leaves the path */
    fence(x0, z0, x1, z1) {
      const g = gy((x0 + x1) / 2, (z0 + z1) / 2), pts = [];
      const run = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.1)); for (let i = 0; i <= n; i++) pts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]); };
      run(x0, z0, x1, z0); run(x1, z0, x1, z1); run(x1, z1, x0, z1); run(x0, z1, x0, z0);
      const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.3, 0.28), mat(0xfff6e6), pts.length), M = new THREE.Matrix4();
      pts.forEach(([x, z], i) => { M.makeTranslation(A.x + x, gy(x, z) + 0.55, A.z + z); post.setMatrixAt(i, M); }); group.add(post);
      for (const [x, z, w, d] of [[(x0 + x1) / 2, z0, x1 - x0, 0.14], [(x0 + x1) / 2, z1, x1 - x0, 0.14], [x0, (z0 + z1) / 2, 0.14, z1 - z0], [x1, (z0 + z1) / 2, 0.14, z1 - z0]]) {
        for (const hh of [0.45, 0.95]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), mat(0xfff6e6)); r.position.set(A.x + x, g + hh, A.z + z); group.add(r); }
        addSolid({ type: 'box', x: A.x + x, z: A.z + z, hx: Math.max(w, 0.6) / 2, hz: Math.max(d, 0.6) / 2, yaw: 0, y0: g - 6, top: g + 20, kind: 'zone', fadeM: true }); // fadeM: the camera may sit outside the fence
      }
    },
    /** a gate across the whole path: wooden door + a big lock + an invisible wall above it (no flying over) */
    kidGate(s, z, o = {}) {
      const W = o.w || 10, gt = this.gate(s, 0, z, W, 0.6, 2.8, { latch: o.held ? false : true, label: 'Gate' });
      const g = gy(0, z);
      gt.extra = addSolid({ type: 'box', x: A.x, z: A.z + z, hx: W / 2, hz: 0.3, yaw: 0, y0: g + 2.7, top: g + 20, kind: 'zone', fadeM: true });
      gt.lock = emojiSprite('🔒', 1.6, true); gt.lock.position.set(A.x, g + 3.8, A.z + z - 0.4); group.add(gt.lock);
      return gt;
    },
    kidFlower(key, x, z, base = 0) {
      const g = gy(x, z) + base, G = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), mat(0x3f8a35)); stem.position.y = 0.5; G.add(stem);
      const head = new THREE.Group(); head.position.y = 1.15; G.add(head);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat(0xffd23f, 0.5)); head.add(mid);
      for (let i = 0; i < 4; i++) { const pe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.3), mat(0xff7fbf, 0.45)); const a = i * Math.PI / 2; pe.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0); head.add(pe); }
      G.position.set(A.x + x, g, A.z + z); group.add(G);
      const col = new THREE.Color(0xffd23f);
      const halo = icons.make({ key: 'halo', size: 3, additive: true, material: { opacity: 0.7, depthTest: true, blending: THREE.AdditiveBlending, color: col, userData: { iconKey: 'halo' } } }); halo.scale.set(3, 3, 1); halo.position.set(A.x + x, g + 1.15, A.z + z); group.add(halo);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      ring.position.set(A.x + x, g + 0.08, A.z + z); group.add(ring);
      kidObjs.push({ key, x: A.x + x, y: g, z: A.z + z, G, head, halo, ring, got: false });
    },
    tag(k) { const pr = props[props.length - 1]; if (pr && !pr.sig) pr.sig = k; },
  };

  // =====================================================================================================
  // ---- Act 2 kit (Fern act2-mechanics-levels.md): checkpoints, sneak, readable sneak-only enemies, ----
  // ---- and the 8 new mechanics. No fighting: a catch is a gentle bonk back to the last checkpoint. ----
  // =====================================================================================================
  const GEAR_KEY = 'pm_gear_v1';
  const gearLoad = () => { try { return JSON.parse(localStorage.getItem(GEAR_KEY) || '{}') || {}; } catch (e) { return {}; } };
  let gear = gearLoad(); // { lantern, whistle (found) , eqL, eqW (equipped) }
  const gearSave = () => { try { localStorage.setItem(GEAR_KEY, JSON.stringify(gear)); } catch (e) {} };
  let sneak = false, a2 = null;
  const a2New = () => ({ en: [], cps: [], cp: null, hides: [], ghosts: [], mirrors: [], srcs: [], beamPool: [], shades: [], ponds: [], logs: [], seeds: [], drips: [], pads: [], winds: [], puffs: [], acorn: null, rings: [], smokes: [], glowSteps: [], hidden: [], gifts: [], season: 'summer', seasonal: [], creeks: [], slides: [], bonks: 0, burst: null, pingT: -99, pingNext: 0, pingAt: null, wind: -1, windFlipT: -99, night: false, lastCur: null, stuck: null, dew: null, borrow: null, movers: [], gravel: [], swoosh: 0, safeT: 0, cpEl: null, terr: null, light: null, outlines: [], escorts: [], shots: [], cups: [], tools: [], heldTool: null, stumps: [], embers: [], targets: [], pouch: { full: false }, slingT: -9, glide: 0, gviz: null, wheels: [], grates: [] });
  const AA = () => a2 || (a2 = a2New());
  // POLISH easy mode (Fern accessibility.md §7): per-item multipliers, read live (toggle mid-level works). ctx.easy() comes from settings.easyMode
  const EASY = { wind: 1.5, acorn: 2.0, gust: 1.5, path: 0.7, crow: 0.7, spin: 0.7, grace: 1.75, puff: 1.35, mower: 1.4, safe: 1.25 };
  const EZ = k => (ctx.easy?.() ? EASY[k] : 1);
  const ACORN_WINDOW = 8; // level-audit P1.5: default hand-off window when { timed: true } has no number (was a hard 5 s)
  const still = () => !!ctx.reduceMotion?.(); // reduce motion: freeze decorative bobbing
  const gearHas = k => !!(gear[k] || (a2 && a2.borrow && a2.borrow[k]));
  // ---- S2 gear (Act 3 P3): one gear slot per animal; swap at 🧰 gear stumps; G toggles the slotted piece on/off ----
  // save pm_gear_v1: { lantern, whistle, pouch, glider, sling (found) · eqL/eqW/eqP/eqG/eqS (on) · slot: { scout, trickster, bruiser } }
  const EQK = { lantern: 'eqL', whistle: 'eqW', pouch: 'eqP', glider: 'eqG', sling: 'eqS' };
  const eqK = k => EQK[k];
  const borrowed = k => !gear[k] && !!(a2 && a2.borrow && a2.borrow[k]); // loans (Trailhead, Practice Yard): equip flags live on the loan, never saved
  const GEAR_INFO = {
    lantern: { em: '🏮', name: 'Glow Lantern', cls: 'scout', where: 'Owl Wood' },
    whistle: { em: '🎶', name: 'Echo Whistle', cls: 'trickster', where: 'Owl Wood' },
    pouch: { em: '🫧', name: 'Bubble Pouch', cls: 'scout', where: 'Ember Ridge (level 17)', icon: 'ui/icons/act3/gear-bubble-pouch.webp', glb: 'act3/gear/bubble-pouch', size: 0.62 },
    glider: { em: '🍃', name: 'Leaf Glider', cls: 'trickster', where: 'Storm Orchard (level 21)', icon: 'ui/icons/act3/gear-leaf-glider.webp', glb: 'act3/gear/leaf-glider', size: 2.6 },
    sling: { em: '🪨', name: 'Pebble Sling', cls: 'bruiser', where: 'Mirror Caves (level 20)', icon: 'ui/icons/act3/gear-pebble-sling.webp', glb: 'act3/gear/pebble-sling', size: 0.85 },
  };
  const ICON_TX = new Map();
  function gearSprite(k, s) { // Squid's gear badge (falls back to the emoji)
    const I = GEAR_INFO[k]; if (!I.icon) return emojiSprite(I.em, s);
    const key = 'gear:' + k;
    icons.packImage(key, import.meta.env.BASE_URL + I.icon);
    const sp = icons.make({ key, size: s, layer: 'depth' }); sp.scale.set(s, s, 1); sp.renderOrder = 9; return sp;
  }
  /** Beans' CC0 gear model, scaled so its longest side = size; hides the blocky fallback once loaded */
  /** CC0 level decor model, dropped onto holder and scaled so its height (or longest side) = size */
  function decoInto(holder, key, size, o = {}) {
    loadGLB(key).then(g => {
      if (!g || !holder.parent) return;
      const night = !!(recipe && recipe.night); const m = g.scene.clone(true); m.traverse(n => { if (n.isMesh) { const nm = [n.name, n.parent && n.parent.name].filter(Boolean).join(' / '); const pane = isFramedMirrorPane(n.material, nm); const wood = isFramedMirrorWood(n.material, nm); const src = lambertFrom(n.material, night ? { caveNight: true } : {}); n.material = (pane || wood) ? src : cavePaletteMat(src); n.material = tintMirrorPane(n, n.material, nm); n.material = tintMirrorWood(n, n.material, nm); if (pane) n.visible = false; n.castShadow = false; } });
      const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()), L = o.byLong ? Math.max(sz.x, sz.y, sz.z) : sz.y; if (L < 1e-4) return;
      const k = size / L; m.scale.setScalar(k); const bb2 = new THREE.Box3().setFromObject(m), c = bb2.getCenter(new THREE.Vector3()); m.position.set(-c.x, -bb2.min.y + (o.sink || 0), -c.z);
      styleNew(m); holder.add(m); lodify(m, key); if (o.fallback) o.fallback.forEach(f => { f.visible = false; }); o.onLoad?.(m);
    });
  }
  /** Instance repeated static decos (dry-grass, trees, stalls). Unique or 1–2 copies still use decoInto. LOD1/2 stay with the polish lod-map loader — this only batches LOD0. */
  function flushDecos() {
    const jobs = decoJobs; decoJobs = new Map();
    const pending = [];
    for (const [key, list] of jobs) {
      const cave = !!(recipe && recipe.caveFloor);
      if ((!cave && list.length < 3) || (!cave && lodFor(key))) { list.forEach(j => decoInto(j.H, key, j.size, j.o)); continue; } // cave: instance even a single copy (LOD skipped; fog is tight)
      pending.push(loadGLB(key).then(g => {
        const live = list.filter(j => j.H.parent); if (!g || !live.length) { live.forEach(j => decoInto(j.H, key, j.size, j.o)); return; }
        const src = g.scene, night = !!(recipe && recipe.night);
        src.updateMatrixWorld(true);
        const bb0 = new THREE.Box3().setFromObject(src), sz0 = bb0.getSize(new THREE.Vector3()), mid = bb0.getCenter(new THREE.Vector3());
        const parts = [];
        src.traverse(n => {
          if (!n.isMesh || !n.geometry) return;
          const geo = n.geometry.clone(); geo.applyMatrix4(n.matrixWorld);
          const nm = [n.name, n.parent && n.parent.name].filter(Boolean).join(' / ');
          const pane = isFramedMirrorPane(n.material, nm);
          const wood = isFramedMirrorWood(n.material, nm);
          const srcMat = lambertFrom(n.material, night ? { caveNight: true } : {});
          const mat0 = (pane || wood) ? srcMat : cavePaletteMat(srcMat);
          parts.push({ geo, mat: mat0, name: nm, pane, wood });
        });
        if (!parts.length) { live.forEach(j => decoInto(j.H, key, j.size, j.o)); return; }
        const n = live.length;
        const mats = live.map(j => {
          const L = j.o.byLong ? Math.max(sz0.x, sz0.y, sz0.z) : sz0.y, k = L > 1e-4 ? j.size / L : 1;
          j.H.updateMatrixWorld(true);
          const off = new THREE.Matrix4().makeTranslation(-mid.x * k, -bb0.min.y * k + (j.o.sink || 0), -mid.z * k);
          return j.H.matrixWorld.clone().multiply(off).multiply(new THREE.Matrix4().makeScale(k, k, k));
        });
        for (const part of parts) {
          // Do not instance the GLB glass: a stray/unaligned pane was landing in front of
          // (or at world origin, away from) the gameplay #dff4ff crystal that Squid's official
          // boxes actually sample. Keep the crystal as the visible, rotatable face.
          if (part.pane) continue;
          const mat1 = part.wood ? tintMirrorWood(null, part.mat, part.name) : part.mat;
          const im = new THREE.InstancedMesh(part.geo, mat1, n);
          im.name = part.name || '';
          im.castShadow = false;
          if (part.pane || part.wood) { im.userData.noMerge = true; im.userData.noPastel = true; im.receiveShadow = false; }
          // Parent framed-mirror parts to the placed deco holder. Adding them to `group`
          // left the InstancedMesh object (and its untransformed geo bbox) at world origin,
          // which showed up as built-framed-mirror_2.._5 MeshBasic #c8b8c4 at (0,0,0).
          const framed = part.wood || /framed-mirror/i.test(part.name || '');
          const host = framed ? live[0] && live[0].H : null;
          if (host) {
            host.updateMatrixWorld(true);
            const inv = host.matrixWorld.clone().invert();
            mats.forEach((m, i) => im.setMatrixAt(i, inv.clone().multiply(m)));
            im.instanceMatrix.needsUpdate = true; styleNew(im); host.add(im);
          } else {
            mats.forEach((m, i) => im.setMatrixAt(i, m));
            im.instanceMatrix.needsUpdate = true; styleNew(im); group.add(im);
          }
        }
        live.forEach(j => { if (j.o.fallback) j.o.fallback.forEach(f => { f.visible = false; }); });
      }));
    }
    return Promise.all(pending);
  }
  function gearModel(k, holder, fallback, onLoad) {
    const I = GEAR_INFO[k]; if (!I.glb) return;
    loadGLB(I.glb).then(g => {
      if (!g || !holder.parent) return;
      const o = g.scene.clone(true); o.traverse(m => { if (m.isMesh) { const tr = m.material && m.material.transparent; m.material = lambertFrom(m.material); if (tr) { m.material.transparent = true; m.material.opacity = 0.7; m.material.depthWrite = false; } m.castShadow = false; } });
      const sz = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()), L = Math.max(sz.x, sz.y, sz.z); if (L < 1e-4) return;
      o.scale.setScalar(I.size / L); styleNew(o); holder.add(o); lodify(o, I.glb); if (fallback) fallback.visible = false; holder.userData.model = o; onLoad?.(o);
    });
  }
  // timed-window multiplier (default 1). A later easy mode sets it (e.g. 1.5 → the 6 s gusts last 9 s): zones.setTiming(k) or ctx.timing()
  let timingK = 1; const TK = () => { const k = ctx.timing ? ctx.timing() : timingK; return (k > 0 ? k : 1) * EZ('wind'); }; // POLISH: easy mode rides the global timing hook (wasp + ember blow-off ×1.5)
  const GIFT_ALIAS = { bubble: 'pouch', pebble: 'sling', leaf: 'glider' }, ALIAS_OF = { pouch: 'bubble' };
  const GEAR_BY_CLS = { scout: ['lantern', 'pouch'], trickster: ['whistle', 'glider'], bruiser: ['sling'] };
  function slotOf(c) {
    const L = GEAR_BY_CLS[c]; if (!L) return null;
    const bo = a2 && a2.borrow;
    if (bo) { const k = bo.slot && bo.slot[c]; if (k && gearHas(k)) return k; const b = L.find(q => bo[q]); if (b) return b; } // Trailhead loan: the loaned piece wins
    const k = gear.slot && gear.slot[c]; if (k && gearHas(k)) return k;
    return L.find(q => gearHas(q)) || L[0];
  }
  const gearOn = k => gearHas(k) && slotOf(GEAR_INFO[k].cls) === k && !!(borrowed(k) ? a2.borrow[eqK(k)] : gear[eqK(k)]);
  function setSlot(c, k) { const bo = a2 && a2.borrow; if (bo) (bo.slot ||= {})[c] = k; if (gear[k]) { (gear.slot ||= {})[c] = k; gearSave(); } emitNet('gear', { slot: c, k }); }
  function setGear(k, on, quiet) {
    if (!gearHas(k)) { tst(`🔒 Find the ${GEAR_INFO[k].name} in ${GEAR_INFO[k].where} first`, 2000); return false; }
    if (borrowed(k)) a2.borrow[eqK(k)] = !!on; else { gear[eqK(k)] = !!on; gearSave(); }
    if (!quiet) { tst(`${GEAR_INFO[k].em} ${GEAR_INFO[k].name} ${on ? 'on' : 'off'}`, 1400); ctx.audio?.sample?.('ui2/gear-equip-clink', 0.4); }
    if (k === 'whistle' && on && a2) a2.pingNext = t; // ping right away
    emitNet('gear', { equip: GEAR_INFO[k] && GEAR_INFO[k].cls, k, on: !!on });
    ctx.onGear?.(); return true;
  }
  const sprite = (e, s) => emojiSprite(e, s);
  const bx = (w, h, d, c, x, y, z, e = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, e)); m.position.set(x, y, z); return m; };
  const L2W = (x, z, base = 0) => ({ x: A.x + x, y: gy(x, z) + base, z: A.z + z });
  const posOfId = id => id === ctx.cur() ? ctx.getP() : ctx.parked(id);
  const idOfCls = c => ctx.crewIds().find(i => CLASS_OF[i] === c);
  function moveTween(q, to, dur, arc, done) { AA().movers.push({ q, a: { x: q.x, y: q.y, z: q.z }, b: to, t: 0, d: dur, arc, done }); }
  function a2Burst(x, z, r) { const S = AA(); S.burst = { x, z, r, t }; }
  // sector (cone) on the ground facing local +Z; ring = circle outline + faint disc
  function coneMesh(r, half, col = 0xfff27a) {
    const g = new THREE.CircleGeometry(r, 28, -Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.renderOrder = 4; return m;
  }
  function ringMesh(r, col = 0xfff27a, cls) {
    const G = new THREE.Group();
    const o = new THREE.Mesh(cls ? shapeRingGeo(cls, r - 0.18, r) : new THREE.RingGeometry(r - 0.18, r, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const d = new THREE.Mesh(new THREE.CircleGeometry(r - 0.18, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    o.renderOrder = 4; d.renderOrder = 3; G.add(o, d); G.userData.mats = [o.material, d.material]; return G;
  }
  const AWCOL = { idle: 0xfff27a, sus: 0xffa020, alert: 0xff3030, sleep: 0x9ad0ff, calm: 0xbfefff };
  // ---------- critter models (cute blocky, facing +Z) ----------
  const MODEL = {
    badger() { const G = new THREE.Group(); G.add(bx(1.5, 0.8, 2.1, 0x6b6b72, 0, 0.55, 0), bx(1.6, 0.25, 2.2, 0x55555c, 0, 0.98, 0), bx(0.95, 0.75, 0.85, 0xf2f2f2, 0, 0.62, 1.35), bx(0.25, 0.77, 0.87, 0x2a2a2e, -0.25, 0.62, 1.35), bx(0.25, 0.77, 0.87, 0x2a2a2e, 0.25, 0.62, 1.35), bx(0.3, 0.25, 0.25, 0x1a1a1a, 0, 0.55, 1.85));
      for (const [x, z] of [[-0.55, 0.7], [0.55, 0.7], [-0.55, -0.7], [0.55, -0.7]]) G.add(bx(0.35, 0.35, 0.4, 0x3a3a40, x, 0.18, z)); return G; },
    turtle() { const G = new THREE.Group(); G.add(bx(1.9, 0.7, 2.1, 0x4f8a3a, 0, 0.5, 0), bx(1.3, 0.45, 1.5, 0x6fae4a, 0, 1.0, 0), bx(0.7, 0.2, 0.8, 0x8bc65a, 0, 1.3, 0), bx(0.6, 0.5, 0.75, 0x9ac270, 0, 0.5, 1.35), bx(0.5, 0.12, 0.2, 0x3a2a1a, 0, 0.42, 1.73));
      for (const [x, z] of [[-0.9, 0.7], [0.9, 0.7], [-0.9, -0.7], [0.9, -0.7]]) G.add(bx(0.45, 0.3, 0.45, 0x8bb060, x, 0.18, z)); return G; },
    spider() { const G = new THREE.Group(); G.add(bx(1.1, 0.85, 1.3, 0x3a2a3a, 0, 0.9, -0.2), bx(0.7, 0.55, 0.6, 0x4a3448, 0, 0.85, 0.65), bx(0.14, 0.14, 0.06, 0xff3030, -0.15, 0.95, 0.96, 0.8), bx(0.14, 0.14, 0.06, 0xff3030, 0.15, 0.95, 0.96, 0.8), bx(0.3, 0.1, 0.06, 0x2a1a2a, 0, 1.12, 0.96));
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const l = bx(1.2, 0.12, 0.12, 0x2a1a2a, s * 0.9, 0.6, 0.45 - i * 0.35); l.rotation.z = s * 0.5; G.add(l); } mergeColorBoxes(G, 0x2a1a2a); return G; },
    crow() { const G = new THREE.Group(); G.add(bx(0.8, 0.7, 1.4, 0x222228, 0, 0, 0), bx(0.6, 0.55, 0.55, 0x2a2a30, 0, 0.2, 0.85), bx(0.2, 0.15, 0.4, 0xffc93c, 0, 0.15, 1.25), bx(0.6, 0.12, 0.7, 0x1a1a20, 0, 0.05, -0.95));
      const wl = bx(1.4, 0.1, 0.7, 0x1a1a20, -0.95, 0.1, 0), wr = bx(1.4, 0.1, 0.7, 0x1a1a20, 0.95, 0.1, 0); G.add(wl, wr); G.userData.wings = [wl, wr]; return G; },
    nest() { const G = new THREE.Group(); G.add(bx(1.5, 1.9, 1.5, 0xd8c49a, 0, 1.0, 0), bx(1.6, 0.2, 1.6, 0xb8a47a, 0, 0.6, 0), bx(1.6, 0.2, 1.6, 0xb8a47a, 0, 1.3, 0), bx(0.5, 0.5, 0.1, 0x3a2a1a, 0, 0.5, 0.76));
      const W = new THREE.Group(); for (let i = 0; i < 5; i++) { const w = new THREE.Group(); w.add(bx(0.3, 0.22, 0.4, 0xffd23f, 0, 0, 0, 0.3), bx(0.31, 0.08, 0.41, 0x1a1a1a, 0, 0, 0.05)); w.userData.a = i / 5 * 6.28; W.add(w); } G.add(W); G.userData.wasps = W; return G; },
    owl() { const G = new THREE.Group(); G.add(bx(1.2, 1.5, 1.0, 0x8a6440, 0, 0.75, 0), bx(0.9, 0.9, 0.2, 0xd8b98a, 0, 0.75, 0.48));
      const eL = bx(0.34, 0.34, 0.08, 0xffd23f, -0.25, 1.15, 0.55, 0.9), eR = bx(0.34, 0.34, 0.08, 0xffd23f, 0.25, 1.15, 0.55, 0.9); G.add(eL, eR, bx(0.16, 0.2, 0.18, 0xe0a030, 0, 0.95, 0.58), bx(0.2, 0.35, 0.2, 0x6a4a30, -0.45, 1.6, 0), bx(0.2, 0.35, 0.2, 0x6a4a30, 0.45, 1.6, 0)); G.userData.eyes = [eL, eR]; return G; },
    fox() { const G = new THREE.Group(); G.add(bx(0.9, 0.75, 1.9, 0xe8762a, 0, 0.65, 0), bx(0.75, 0.7, 0.75, 0xe8762a, 0, 0.9, 1.15), bx(0.5, 0.35, 0.45, 0xfff3e6, 0, 0.75, 1.55), bx(0.15, 0.15, 0.12, 0x1a1a1a, 0, 0.8, 1.8), bx(0.22, 0.35, 0.15, 0xe8762a, -0.25, 1.4, 1.1), bx(0.22, 0.35, 0.15, 0xe8762a, 0.25, 1.4, 1.1), bx(0.4, 0.4, 1.1, 0xe8762a, 0, 0.75, -1.4), bx(0.42, 0.42, 0.35, 0xfff3e6, 0, 0.75, -2.0));
      for (const [x, z] of [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]]) G.add(bx(0.22, 0.5, 0.22, 0x3a2414, x, 0.25, z)); return G; },
    sprinkler() { const G = new THREE.Group(); G.add(bx(0.3, 0.8, 0.3, 0x8a8a90, 0, 0.4, 0)); const H = new THREE.Group(); H.position.y = 0.9; H.add(bx(0.55, 0.3, 0.55, 0x3aa0e8, 0, 0, 0), bx(0.15, 0.15, 0.5, 0x2a6a9a, 0, 0.05, 0.4)); G.add(H); G.userData.head = H; return G; },
    // S1 hub friends (cute blocky, facing +Z)
    duckling() { const G = new THREE.Group(); G.add(bx(0.55, 0.45, 0.7, 0xffd23f, 0, 0.3, 0), bx(0.4, 0.4, 0.4, 0xffd23f, 0, 0.65, 0.3), bx(0.22, 0.1, 0.2, 0xff9a2a, 0, 0.6, 0.6), bx(0.08, 0.08, 0.05, 0x1a1a1a, -0.12, 0.72, 0.51), bx(0.08, 0.08, 0.05, 0x1a1a1a, 0.12, 0.72, 0.51)); return G; },
    fawn() { const G = new THREE.Group(); G.add(bx(0.8, 0.7, 1.5, 0xc68a4a, 0, 1.0, 0), bx(0.6, 0.65, 0.6, 0xc68a4a, 0, 1.55, 0.85), bx(0.35, 0.3, 0.3, 0xf2e0c8, 0, 1.4, 1.2), bx(0.12, 0.12, 0.1, 0x1a1a1a, 0, 1.45, 1.36), bx(0.18, 0.35, 0.1, 0xc68a4a, -0.3, 2.0, 0.8), bx(0.18, 0.35, 0.1, 0xc68a4a, 0.3, 2.0, 0.8));
      for (const [x, z] of [[-0.25, 0.25], [0.15, -0.35], [0.2, 0.45]]) G.add(bx(0.14, 0.05, 0.14, 0xfff3e6, x, 1.36, z));
      for (const [x, z] of [[-0.28, 0.55], [0.28, 0.55], [-0.28, -0.55], [0.28, -0.55]]) G.add(bx(0.18, 0.7, 0.18, 0x7a5030, x, 0.35, z)); return G; },
    cub() { const G = MODEL.badger(); G.scale.setScalar(0.55); return G; },
    owlet() { const G = MODEL.owl(); G.scale.setScalar(0.5); return G; },
    batpup() { const G = new THREE.Group(); G.add(bx(0.7, 0.45, 0.9, 0x4a3a5a, 0, 0.45, 0), bx(0.5, 0.4, 0.5, 0x5a4a6a, 0, 0.65, 0.4), bx(0.12, 0.12, 0.08, 0x1a1a1a, -0.12, 0.72, 0.62), bx(0.12, 0.12, 0.08, 0x1a1a1a, 0.12, 0.72, 0.62), bx(0.15, 0.08, 0.2, 0xffc93c, 0, 0.55, 0.72));
      const wl = bx(0.9, 0.08, 0.6, 0x3a2a4a, -0.7, 0.5, 0), wr = bx(0.9, 0.08, 0.6, 0x3a2a4a, 0.7, 0.5, 0); G.add(wl, wr); G.userData.wings = [wl, wr]; return G; },
    chick() { const G = new THREE.Group(); G.add(bx(0.45, 0.4, 0.55, 0xf2a03a, 0, 0.35, 0), bx(0.38, 0.35, 0.38, 0xf2a03a, 0, 0.65, 0.22), bx(0.16, 0.1, 0.18, 0xff8a1f, 0, 0.58, 0.46), bx(0.07, 0.07, 0.05, 0x1a1a1a, -0.1, 0.74, 0.38), bx(0.07, 0.07, 0.05, 0x1a1a1a, 0.1, 0.74, 0.38)); return G; },
    snail() { const G = new THREE.Group(); G.add(bx(0.7, 0.35, 1.1, 0xd8c49a, 0, 0.25, 0), bx(0.85, 0.75, 0.85, 0x8bbe6a, 0, 0.7, -0.1, 0.15), bx(0.5, 0.4, 0.5, 0xa8d47a, 0, 1.05, -0.1), bx(0.08, 0.45, 0.08, 0xf2e0c8, -0.12, 0.55, 0.6), bx(0.08, 0.45, 0.08, 0xf2e0c8, 0.12, 0.55, 0.6)); return G; },
    mower() { const G = new THREE.Group(); G.add(bx(2.2, 0.9, 1.8, 0xd83a3a, 0, 0.75, 0), bx(1.6, 0.35, 1.2, 0x2a2a2a, 0, 1.3, 0), bx(0.15, 1.4, 0.15, 0x6a6a70, -0.6, 1.7, -0.9), bx(0.15, 1.4, 0.15, 0x6a6a70, 0.6, 1.7, -0.9), bx(1.35, 0.15, 0.15, 0x6a6a70, 0, 2.4, -0.9));
      for (const [x, z] of [[-1.05, 0.7], [1.05, 0.7], [-1.05, -0.7], [1.05, -0.7]]) G.add(bx(0.3, 0.6, 0.6, 0x1a1a1a, x, 0.3, z)); return G; },
  };
  // ---------- enemies ----------
  // Beans' blocky baby GLBs (CC0, Y-up, origin at feet, facing +Z, `idle` clip). The primitive model stays as the fallback until the GLB loads.
  const EN_GLB = { turtle: 'act3/enemies/turtle', owl: 'act3/enemies/owl', crow: 'act3/enemies/crow', fox: 'act3/fox' };
  function enemyModel(G, kind) {
    const key = EN_GLB[kind]; if (!key) return;
    const old = G.children.filter(c => c.isMesh || c.type === 'Group');
    const bb = new THREE.Box3().setFromObject(G), H = Math.max(0.4, bb.max.y - bb.min.y);
    loadGLB(key).then(g => {
      if (!g || !G.parent) return;
      const m = g.scene.clone(true); m.traverse(n => { if (n.isMesh) { n.material = lambertFrom(n.material); n.castShadow = false; } });
      const b2 = new THREE.Box3().setFromObject(m), h2 = b2.max.y - b2.min.y; if (h2 < 1e-4) return;
      const k = H / h2; m.scale.setScalar(k); m.position.y = -b2.min.y * k;
      old.forEach(c => { if (!c.parent || c.parent === G) c.visible = false; }); styleNew(m); G.add(m); G.userData.enGlb = key; lodify(m, key, { drop: true });
      const clip = (g.animations || []).find(a => /idle/i.test(a.name)) || (g.animations || [])[0];
      if (clip) { const mx = new THREE.AnimationMixer(m); mx.clipAction(clip).play(); mx.setTime(Math.random() * 2); babyMixers.push(mx); }
    });
  }
  const BABY_GLB = { cub: 'badger-cub', duckling: 'duckling', owlet: 'owlet', batpup: 'bat-pup', chick: 'robin-chick', fawn: 'fawn', snail: 'snail' };
  const babyMixers = [];
  function babyModel(G, kind) {
    const key = BABY_GLB[kind]; if (!key) return;
    const old = G.children.slice(); G.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(G), sc = G.scale.y || 1, H = Math.max(0.3, (bb.max.y - bb.min.y) / sc);
    loadGLB('act3/babies/' + key).then(g => {
      if (!g || !G.parent) return;
      const m = g.scene.clone(true); m.traverse(n => { if (n.isMesh) { n.material = lambertFrom(n.material); n.castShadow = false; } });
      const clip = (g.animations || []).find(a => /idle/i.test(a.name)) || (g.animations || [])[0];
      mergeAtlasRig(m, clip);
      const b2 = new THREE.Box3().setFromObject(m), h2 = b2.max.y - b2.min.y; if (h2 < 1e-4) return;
      const k = H / h2; m.scale.setScalar(k); m.position.y = -b2.min.y * k;
      old.forEach(c => { c.visible = false; }); styleNew(m); G.add(m); G.userData.babyGlb = key; lodify(m, 'act3/babies/' + key, { drop: true });
      if (clip) { const mx = new THREE.AnimationMixer(m); mx.clipAction(clip).play(); mx.setTime(Math.random() * 2); babyMixers.push(mx); }
    });
  }
  const BABY_INFO = {
    cub: { em: '🦡', name: 'badger cub', speed: 2.2, scale: 1, model: 'cub' },
    duckling: { em: '🐥', name: 'duckling', speed: 2.4, scale: 1, model: 'duckling', float: true },
    owlet: { em: '🦉', name: 'owlet', speed: 2.2, scale: 1, model: 'owlet' },
    batpup: { em: '🦇', name: 'bat pup', speed: 2.0, scale: 1, model: 'batpup', darkOnly: true },
    chick: { em: '🐦', name: 'robin chick', speed: 2.3, scale: 1, model: 'chick', windblown: true },
    fawn: { em: '🦌', name: 'fawn', speed: 2.3, scale: 0.85, model: 'fawn', refuseIce: true, refuseHigh: true },
    snail: { em: '🐌', name: 'garden snail', speed: 0.7, scale: 1, model: 'snail' },
  };
  const EN_NAME = { badger: 'Sleepy Badger', turtle: 'Snapping Turtle', spider: 'Grumpy Spider', crow: 'Patrol Crow', nest: 'Wasp Nest', owl: 'Night Owl', fox: 'Prowling Fox', sprinkler: 'Sprinkler', mower: 'Lawnmower' };
  function enemy(kind, id, x, z, o = {}) {
    const S = AA(), w = L2W(x, z, o.base || 0), G = MODEL[kind](); G.position.set(w.x, w.y + (o.lift || 0), w.z); G.rotation.y = o.yaw || 0; group.add(G);
    const F = new THREE.Group(); F.position.set(w.x, w.y + 0.12, w.z); group.add(F); // awareness decals live on the ground
    const e = { kind, id, name: EN_NAME[kind], G, F, x: w.x, y: w.y, z: w.z, gy: w.y, yaw: o.yaw || 0, baseYaw: o.yaw || 0, home: { x: w.x, z: w.z }, st: 'idle', sus: 0, grace: o.grace ?? 1, alertT: -99, peek: !!(o.peek || recipe.peek), o, cone: null, ring: null, el: null };
    enemyModel(G, kind);
    if (o.cone) { e.cone = coneMesh(o.cone[0], o.cone[1]); F.add(e.cone); }
    if (o.ring) { e.ring = ringMesh(o.ring); F.add(e.ring); }
    const el = document.createElement('div'); el.className = 'a2Mark'; document.body.appendChild(el); e.el = el;
    S.en.push(e); return e;
  }
  const inCone = (e, q, r, half, yaw = e.yaw) => { const dx = q.x - e.x, dz = q.z - e.z, d = Math.hypot(dx, dz); if (d > r) return false; if (d < 0.6) return true; return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d >= Math.cos(half); };
  const flatD = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function bearAt(q, r) { const bid = idOfCls('bruiser'); if (!bid || ctx.driven().includes(bid)) return false; const b = ctx.parked(bid); return !!b && flatD(b, q) < r && Math.abs(b.y - q.y) < 2.8; }
  function hidden(q, kind) { const S = AA(); return S.hides.some(h => (!kind || h.kind === kind || (kind === 'canopy' && h.kind === 'canopy')) && flatD(h, q) < h.r && (h.kind !== 'canopy' || q.y < h.y)); }
  function losBlocked(e, q) { // trunks between the owl and the animal block its gaze
    for (const h of AA().hides) { if (h.kind !== 'trunk') continue; const ax = q.x - e.x, az = q.z - e.z, L = Math.hypot(ax, az); if (L < 0.1) continue; const u = ((h.x - e.x) * ax + (h.z - e.z) * az) / (L * L); if (u <= 0.05 || u >= 1) continue; const px = e.x + ax * u, pz = e.z + az * u; if (Math.hypot(h.x - px, h.z - pz) < h.r) return true; }
    return false;
  }
  function noiseOf(p, id) {
    const c = CLASS_OF[id]; if (c === 'scout' && !p.grounded && p.y - gy(p.x - A.x, p.z - A.z) > 0.5) return 0; // flying is silent
    const S = AA(), onGravel = S.gravel.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1);
    const spd = Math.hypot(p.vx || 0, p.vz || 0); if (spd < 0.6) return 0;
    if (c === 'bruiser' && S.night && recipe.quietBear) return 0; // the bear sleep-walks quietly at night
    if (onGravel) return 6;
    return (p.sneak || sneak) ? 1 : c === 'bruiser' ? 7 : 5.5;
  }
  // detection per kind → true when the active animal is noticed right now
  function sees(e, p, id) {
    const S = AA(), c = CLASS_OF[id], q = p;
    if (Math.abs(q.y - e.gy) > (e.kind === 'crow' || e.kind === 'owl' ? 9 : e.o.high || 3.2) && e.kind !== 'crow') return false;
    switch (e.kind) {
      case 'badger': {
        if (e.o.friendly || e.asleepAll) return false;
        const n = noiseOf(p, id), awake = t < (e.awakeT || -1), R = e.o.ring;
        if (inCone(e, q, e.o.cone[0], e.o.cone[1]) && (c !== 'scout' || p.grounded)) return true;
        if (awake && flatD(e, q) < R && (c !== 'scout' || p.grounded)) return true;
        return n > 1 && flatD(e, q) < R;
      }
      case 'turtle': if (t < (e.napT || -1)) return false; if (c === 'scout' && !p.grounded) return false; return inCone(e, q, e.o.cone[0], e.o.cone[1]);
      case 'spider': if (c === 'scout') return false; return inCone(e, q, e.o.cone[0], e.o.cone[1]);
      case 'crow': { const air = !p.grounded || c === 'scout'; if (!air) return false; if (hidden(q, 'canopy') || bearAt(q, 2.2)) return false; return inCone({ x: e.x, z: e.z }, q, e.o.cone[0], e.o.cone[1], e.yaw); }
      case 'nest': { if (e.calm) return false; if (S.smokes.some(s => t < s.until && flatD(s, q) < s.r)) return false; return flatD(e, q) < e.o.ring && q.y - e.gy < 4; }
      case 'owl': { if (!owlAwake(S)) return false; if (gearOn('lantern') && c === 'scout') return false; const k = S.time === 'dusk' ? 0.5 : 1; if (!inCone(e, q, (e.o.cone[0] || 11) * k, e.o.cone[1])) return false; return !losBlocked(e, q); }
      case 'fox': {
        const tiny = c === 'scout', hide = tiny && (hidden(q, 'log') || bearAt(q, 1.8));
        if (hide) return false;
        if (e.calm || (plates || []).some(pl => pl.holder === 'fox:' + e.id)) return false; // on a plate, the fox is busy holding it
        if (flatD(e, q) < 2.2) return true; // bumping a fox always counts (snow only hides scent, not a nose-to-nose bump)
        if (inCone(e, q, e.o.cone[0], e.o.cone[1])) return true;
        if (!tiny || p.sneak || sneak || S.season === 'winter') return false; // sneaking + winter snow hide scent
        return flatD(e, q) < e.o.ring;
      }
      case 'sprinkler': if (e.paused) return false; if (q.y - e.gy < (e.o.high || 3) && flatD(e, q) < 1.7) return true; return q.y - e.gy < (e.o.high || 3) && inCone(e, q, e.o.r, e.o.beam, e.sweepYaw);
      case 'mower': return e.live && Math.abs(q.x - e.x) < 1.5 && Math.abs(q.z - e.z) < 1.3 && q.y - e.gy < 1.6;
    }
    return false;
  }
  function cpOf(id) {
    const S = AA(), sAt = recipe.splitAt && recipe.splitAt[CLASS_OF[id || ctx.cur()]];
    return (recipe.splitAt && ((S.cpBy || {})[id || ctx.cur()] || (sAt && { x: A.x + sAt[0], y: gy(sAt[0], sAt[1]), z: A.z + sAt[1] }))) || S.cp || { x: homeAt ? homeAt.x : A.x, y: gy((homeAt ? homeAt.x : A.x) - A.x, (homeAt ? homeAt.z : A.z) - A.z), z: homeAt ? homeAt.z : A.z };
  }
  function warpTo(q, cp, ox, oz) { if (!q || !cp) return; q.x = cp.x + ox; q.y = cp.y + 0.8; q.z = cp.z + oz; q.vx = q.vy = q.vz = 0; q._safe = { x: q.x, z: q.z }; q.goto = null; }
  function resetEscorts(cp) {
    const S = a2; if (!S) return;
    (S.escorts || []).forEach((b, i) => { const c = cp || b.home; b.x = c.x + (i % 3) * 0.7 - 0.5; b.z = c.z + 0.8 + (i * 0.35); b.y = (c.y || gy(b.x - A.x, b.z - A.z)) + 0.2; b.hide = false; b.vx = b.vz = 0; b.stuckFor = 0; b.lagFor = 0; if (b.G) b.G.position.set(b.x, b.y, b.z); });
  }
  function bonk(e, src) {
    const S = AA(), p = ctx.getP(); if (tw) tw = null; const at = { x: +(p.x - A.x).toFixed(1), z: +(p.z - A.z).toFixed(1) };
    fx(p.x, p.y + 0.6, p.z);
    const cp = cpOf(ctx.cur());
    if (src === 'escort') {
      warpTo(p, cp, 0.6, -0.6);
      for (const cid of ctx.crewIds()) if (cid !== ctx.cur()) warpTo(ctx.parked(cid), cpOf(cid), (cid.length % 3) - 1, 0.5);
    } else {
      warpTo(p, cp, 0.6, -0.6);
    }
    S.stuck = null;
    S.bonks++; S.safeT = t + 1.6 * EZ('safe'); S.safeWho = ctx.cur(); (S.bonkLog ||= []).push({ t: +t.toFixed(1), src: src || (e && e.name) || '?', who: ctx.cur(), x: at.x, z: at.z }); e.alertT = t; e.sus = 0;
    resetEscorts(cp);
    if (S.master) S.master.coolUntil = 0; // S4 §1.6: bonk does not reset the Master Bell; cooldown clears so they can ring at once
    if ((S.acorns || []).some(a => a.by === ctx.cur())) acornBack();
    fx(p.x, p.y + 0.6, p.z); ctx.audio?.sample?.(src === 'ember' || (S.escorts || []).length ? 'act3/gentle-bonk-poof' : 'ui/error-bonk', 0.5); // Act 3: the gentle poof
    emitNet('bonk', { body: ctx.cur(), src: src || (e && e.name) || '?', warp: src === 'escort' ? ctx.crewIds().slice() : [ctx.cur()] });
    if (src === 'ember') { tst('💨 Puff! Soot on your nose — poof, back to the 🚩 flag. Douse embers with a 🫧 bubble, or ring 🌱 spring to dim them', 2600); return; }
    tst(src === 'escort' ? `💫 Bonk! The ${e.name} reached the little one — poof, back to the 🚩 flag` : `💫 Bonk! The ${e.name} spotted you — poof, back to the 🚩 flag`, 2400);
  }
  function updEnemies(dt, cam, p, cur) {
    const S = AA(), c = CLASS_OF[cur];
    for (const e of S.en) {
      // per-kind motion
      if (e.kind === 'badger') {
        if (e.lure) { const L = e.lure, d = flatD(e, L); if (L.phase === 'go') { if (d > 0.4) { const v = Math.min(d, 2.4 * dt); e.x += (L.x - e.x) / d * v; e.z += (L.z - e.z) / d * v; e.yaw = Math.atan2(L.x - e.x, L.z - e.z); } else { L.phase = 'sit'; L.until = t + (e.o.lureT || 12); } }
          else if (L.phase === 'sit' && t > L.until) L.phase = 'back';
          else if (L.phase === 'back') { const H = e.home, dh = flatD(e, H); if (dh > 0.4) { const v = Math.min(dh, 2 * dt); e.x += (H.x - e.x) / dh * v; e.z += (H.z - e.z) / dh * v; e.yaw = Math.atan2(H.x - e.x, H.z - e.z); } else { e.lure = null; e.yaw = e.baseYaw; if (e.lurePr) { e.lurePr.done = false; if (e.lurePr.icon) e.lurePr.icon.visible = true; } } } }
        if (S.burst && t - S.burst.t < 0.1 && flatD(e, S.burst) < e.o.ring + 3) { e.awakeT = t + 6; }
        if (e.o.friendly) {
          const sq = gearOn('lantern') && posOfId(idOfCls('scout'));
          if (sq && flatD(e, sq) < 5 && !e.roll) {
            const tgt = e.o.rollTo ? L2W(e.o.rollTo[0], e.o.rollTo[1]) : { x: e.x + Math.sin(e.baseYaw) * 2.2, z: e.z + Math.cos(e.baseYaw) * 2.2 };
            e.roll = { x: tgt.x, z: tgt.z, phase: 'go' }; tst('🏮 The sleepy badger rolls over…', 2000);
          }
          if (e.roll && e.roll.phase === 'go') {
            const L = e.roll, d = flatD(e, L);
            if (d > 0.3) { const v = Math.min(d, 1.8 * dt); e.x += (L.x - e.x) / d * v; e.z += (L.z - e.z) / d * v; e.yaw = Math.atan2(L.x - e.x, L.z - e.z); e.G.rotation.z = Math.sin(t * 8) * 0.4; }
            else { e.roll.phase = 'sit'; e.yaw = e.baseYaw; e.G.rotation.z = 0; }
          }
        }
        if (!e.roll || e.roll.phase !== 'go') e.G.rotation.z = Math.sin(t * 1.6) * 0.03;
      } else if (e.kind === 'turtle') {
        const pond = e.o.pond && S.ponds.find(q => q.id === e.o.pond);
        if (pond && pond.level === 'high') e.napT = t + (e.o.nap || 14);
        if (e.ride && pond) {
          if (pond.level === 'high' && flatD(e, e.ride.high) < 0.7) {
            e.stayedFar = true; e.napT = Math.max(e.napT || 0, t + (e.o.nap || 14));
            if (e.o.farSig && !sig[e.o.farSig]) { setSig(e.o.farSig); tst('🐢 The turtle naps on the far rock', 2000); }
          }
          const tgt = e.stayedFar ? e.ride.high : (pond.level === 'high' ? e.ride.high : pond.level === 'low' ? e.ride.low : e.ride.mid);
          const d = flatD(e, tgt);
          if (d > 0.35) { const v = Math.min(d, (e.o.rideSpeed || 1.8) * dt); e.x += (tgt.x - e.x) / d * v; e.z += (tgt.z - e.z) / d * v; e.yaw = Math.atan2(tgt.x - e.x, tgt.z - e.z); }
          const dryPark = e.stayedFar && pond.level !== 'high';
          const waterY = dryPark ? e.gy : pondSurf(pond) + (pond.heights ? 0 : -0.1);
          e.G.position.y += (waterY - e.G.position.y) * Math.min(1, dt * 3);
        }
        if (e.look && t > e.look.until) e.look = null;
        const want = e.look ? Math.atan2(e.look.x - e.x, e.look.z - e.z) : e.baseYaw; e.yaw += Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw)) * Math.min(1, dt * 3);
        const nap = t < (e.napT || -1); if (!e.ride) e.G.position.y += ((nap ? e.gy - 0.9 : e.gy) - e.G.position.y) * Math.min(1, dt * 3);
      } else if (e.kind === 'spider') {
        if (e.look && t > e.look.until) e.look = null;
        const L = e.look || e.watch, want = L ? Math.atan2(L.x - e.x, L.z - e.z) : e.baseYaw; e.yaw += Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw)) * Math.min(1, dt * 4);
      } else if (e.kind === 'crow') {
        const o = e.o, shiny = (S.shots || []).find(s => s.kind === 'shiny' && !s.dead && t - s.t0 < 8 && flatD(e, s) < 16);
        if (shiny) e.swoop = { x: shiny.x, z: shiny.z, until: t + 5 };
        if (e.swoop && t > e.swoop.until) e.swoop = null;
        if (e.swoop) {
          const L = e.swoop, d = flatD(e, L);
          if (d > 0.5) { const v = Math.min(d, 8 * dt); e.x += (L.x - e.x) / d * v; e.z += (L.z - e.z) / d * v; e.yaw = Math.atan2(L.x - e.x, L.z - e.z); }
          e.G.position.set(e.x, e.gy + Math.max(1.2, o.h * 0.45), e.z); e.F.position.set(e.x, e.gy + 0.12, e.z);
        } else {
          e.ang = (e.ang ?? 0) + dt * o.speed * EZ('crow') / o.R; e.x = A.x + o.cx + Math.cos(e.ang) * o.R; e.z = A.z + o.cz + Math.sin(e.ang) * o.R;
          e.yaw = Math.atan2(-Math.sin(e.ang), Math.cos(e.ang)); e.G.position.set(e.x, e.gy + o.h, e.z); e.F.position.set(e.x, e.gy + 0.12, e.z);
        }
        const wg = e.G.userData.wings; if (wg) { wg[0].rotation.z = Math.sin(t * 9) * 0.5; wg[1].rotation.z = -Math.sin(t * 9) * 0.5; }
      } else if (e.kind === 'nest') {
        const blown = S.windFlipT && t - S.windFlipT < 6 * TK();
        e.calm = blown || S.smokes.some(s => t < s.until && flatD(s, e) < s.r + 1.5);
        const W = e.G.userData.wasps, push = blown ? (S.wind > 0 ? 1 : -1) * 5 * Math.min(1, (t - S.windFlipT) / 1.1) : 0;
        if (recipe && recipe.waspBlow === 'east') { W.position.x = Math.abs(push); W.position.z = 0; } else W.position.z = push;
        W.children.forEach((w, i) => { const a = w.userData.a + t * (e.calm ? 0.4 : 2.2), rr = e.calm ? 1.1 : (e.st === 'alert' ? 2.6 : 1.7); w.position.set(Math.cos(a) * rr, 1.2 + Math.sin(t * 3 + i) * 0.4 - (e.calm ? 0.8 : 0), Math.sin(a) * rr); });
      } else if (e.kind === 'owl') {
        const awake = owlAwake(S), dusk = S.time === 'dusk', bait = awake && gearOn('lantern') && posOfId(idOfCls('scout'));
        if (bait && flatD(e, bait) < (e.o.baitR || Math.max(22, (e.o.cone[0] || 11) * 1.8 * (dusk ? 0.5 : 1)))) {
          const want = Math.atan2(bait.x - e.x, bait.z - e.z);
          e.yaw += Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw)) * Math.min(1, dt * 2.4 * (dusk ? 0.5 : 1));
          e.bait = true;
        } else { e.bait = false; e.yaw = e.baseYaw + Math.sin(t * (e.o.sweepV || 0.45) * (dusk ? 0.5 : 1)) * (e.o.sweep || 1.1); }
        if (e.o.baitSig && e.bait) setSig(e.o.baitSig, true);
        if (e.o.daySig && !S.night) setSig(e.o.daySig, true);
        if (e.o.friendSig && isOn(e.o.friendSig)) e.o.friendly = true;
        for (const m of e.G.userData.eyes) m.scale.y = owlAwake(S) ? (Math.sin(t * 0.9) > 0.97 ? 0.15 : 1) : 0.12;
      } else if (e.kind === 'fox') {
        if (!e.peek && S.pingAt && t - S.pingAt.t < 0.3 && flatD(e, S.pingAt) < 18) { let tx = S.pingAt.x, tz = S.pingAt.z; const pl = plates.find(q => !q.heavy && Math.hypot(q.x - tx, q.z - tz) < 3.2); if (pl) { tx = pl.x; tz = pl.z; } e.pingLure = { x: tx, z: tz, phase: 'go' }; }
        if (e.pingLure) {
          const L = e.pingLure, d = flatD(e, L);
          if (L.phase === 'go') { if (d > 0.4) { const v = Math.min(d, 2.6 * dt); e.x += (L.x - e.x) / d * v; e.z += (L.z - e.z) / d * v; e.yaw = Math.atan2(L.x - e.x, L.z - e.z); } else { L.phase = 'sit'; L.until = t + 8; } }
          else if (L.phase === 'sit' && t > L.until && !plates.some(pl => pl.holder === 'fox:' + e.id)) L.phase = 'back';
          else if (L.phase === 'back') { const H = e.home, dh = flatD(e, H); if (dh > 0.4) { const v = Math.min(dh, 2 * dt); e.x += (H.x - e.x) / dh * v; e.z += (H.z - e.z) / dh * v; e.yaw = Math.atan2(H.x - e.x, H.z - e.z); } else { e.pingLure = null; } }
        } else {
          const pts = e.o.path; if (pts && (!e.peek || e.o.roam)) { e.k = e.k ?? 0; const tg = L2W(pts[e.k][0], pts[e.k][1]), d = flatD(e, tg); if (d < 0.4) e.k = (e.k + 1) % pts.length; else { const v = Math.min(d, (e.o.speed || 1.6) * EZ('path') * dt); e.x += (tg.x - e.x) / d * v; e.z += (tg.z - e.z) / d * v; const wy = Math.atan2(tg.x - e.x, tg.z - e.z); e.yaw += Math.atan2(Math.sin(wy - e.yaw), Math.cos(wy - e.yaw)) * Math.min(1, dt * 4); } }
        }
        if (e.ring) e.ring.visible = S.season !== 'winter';
      } else if (e.kind === 'sprinkler') {
        e.paused = !!(e.o.pause && isOn(e.o.pause)); if (!e.paused) e.ph = (e.ph || 0) + dt * (e.o.speed || 0.8) * EZ('spin');
        e.sweepYaw = e.baseYaw + Math.sin(e.ph || 0) * (e.o.sweep || 1.2); e.G.userData.head.rotation.y = e.sweepYaw - e.baseYaw; if (e.cone) { e.cone.rotation.y = e.sweepYaw - e.baseYaw; e.cone.visible = !e.paused; }
      } else if (e.kind === 'mower') {
        const o = e.o, per = o.period * EZ('mower'), paused = !!(o.pause && isOn(o.pause));
        e.paused = paused;
        if (paused) { e.live = false; e.warn = false; }
        else {
          if (e._ph == null) e._ph = (o.off || 0);
          e._ph += dt;
          const ph = e._ph % per, run = per - o.dur, live = ph > run, warn = !live && ph > run - 1.6;
          if (warn && !e.warn) ctx.audio?.sample?.('act3/mower-warn', 0.55);
          if (live && !e.live) ctx.audio?.sample?.('act3/mower-pass', 0.55);
          e.live = live; e.warn = warn;
          const k = e.live ? (ph - run) / o.dur : 0;
          e.x = A.x + o.x0 + (o.x1 - o.x0) * k; e.G.position.x = e.x;
        }
      }
      if (e.kind !== 'crow' && e.kind !== 'mower') { e.G.position.x = e.x; e.G.position.z = e.z; e.F.position.x = e.x; e.F.position.z = e.z; }
      if (e.kind !== 'sprinkler') e.G.rotation.y = e.yaw; else e.G.rotation.y = e.baseYaw;
      if (e.cone && e.kind !== 'sprinkler') e.cone.rotation.y = e.yaw;
      // awareness: ? (grace) then ! (react)
      const asleep = (e.kind === 'owl' && !owlAwake(S)) || (e.kind === 'turtle' && t < (e.napT || -1)) || e.calm || e.paused;
      let see = false, seeId = null;
      if (!asleep && t > S.safeT && !tw) {
        const ids = ctx.driven();
        const check = ids.length ? ids : (cur ? [cur] : []);
        for (const idd of check) {
          const q = posOfId(idd);
          if (q && sees(e, q, idd)) { see = true; seeId = idd; break; }
        }
      }
      const seeCls = seeId ? CLASS_OF[seeId] : c;
      const grace0 = e.kind === 'owl' && gearOn('lantern') && seeCls === 'scout' ? 0.35 : e.grace, grace = ctx.easy?.() ? (e.kind === 'mower' ? Math.max(0.35, grace0 * EASY.grace) : grace0 * EASY.grace) : grace0;
      if (see) e.sus += dt; else e.sus = Math.max(0, e.sus - dt * 0.8);
      if (e.peek) e.sus = Math.min(e.sus, grace * 0.9); // Trailhead peeks never catch anyone
      let st = asleep ? 'sleep' : e.sus > 0.02 ? 'sus' : 'idle';
      const bump = see && e.kind === 'fox' && seeId && !e.calm && !e.pingLure && flatD(e, posOfId(seeId) || { x: e.x, z: e.z }) < 1.6;
      if (t - e.alertT < 1.3) st = 'alert';
      else if (bump || e.sus >= grace) { withFocus(seeId || cur, () => bonk(e)); st = 'alert'; }
      if (e.kind === 'mower' && e.warn) st = 'sus';
      if (e.kind === 'mower' && e.live) st = 'alert';
      if (st !== e.st && (st === 'sus' || st === 'alert') && e.st !== 'sus' && e.st !== 'alert' && t - (e.cueT || -9) > 3) { // polish4: Act 3 critter cues
        const cue = { fox: 'fox-sniff', owl: 'owl-hoot', nest: 'wasp-buzz' }[e.kind]; if (cue) { e.cueT = t; ctx.audio?.sample?.('act3/' + cue, e.kind === 'owl' ? 0.42 : 0.45); }
      }
      e.st = st;
      const col = AWCOL[st === 'sleep' ? 'sleep' : st], op = { idle: 0.26, sus: 0.42, alert: 0.55, sleep: 0.12 }[st];
      if (e.cone) { e.cone.material.color.setHex(col); e.cone.material.opacity = op; }
      if (e.ring) { e.ring.userData.mats[0].color.setHex(col); e.ring.userData.mats[1].color.setHex(col); e.ring.userData.mats[0].opacity = st === 'sleep' ? 0.35 : 0.8; e.ring.userData.mats[1].opacity = op * 0.45; const R = e.kind === 'badger' && t < (e.awakeT || -1) ? 1.15 : 1; e.ring.scale.set(R, 1, R); }
      // floating ? / ! / 💤 marker
      const mk = st === 'alert' ? '!' : st === 'sus' ? '?' : st === 'sleep' ? (e.kind === 'turtle' && e.napT ? `💤${Math.max(0, Math.ceil(e.napT - t))}` : '💤') : (e.peek && !e.o.roam ? '💤' : '');
      const hy = e.kind === 'crow' ? e.o.h + 1.6 : e.kind === 'owl' ? 2.6 + (e.o.lift || 0) : 2.4;
      _v.set(e.x, e.gy + hy, e.z).project(cam);
      const on = mk && _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && flatD(e, p) < 34;
      e.el.style.display = on ? 'block' : 'none';
      if (on) { e.el.textContent = mk; e.el.className = 'a2Mark ' + (mk === '!' ? 'x' : mk === '?' ? 'q' : 'z'); e.el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; e.el.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px'; }
    }
  }
  // ---------- builder kit ----------
  Object.assign(B, {
    /** checkpoint flag: touching it makes it your return spot after a bonk */
    checkpoint(x, z, base = 0, o = {}) {
      const S = AA(), w = L2W(x, z, base), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      G.add(bx(0.16, 2.4, 0.16, 0x8a5a2b, 0, 1.2, 0)); const f = bx(0.9, 0.55, 0.06, 0xb0b0b0, 0.5, 2.05, 0, 0.3); G.add(f);
      const rg = ringMesh(1.3, 0xffffff); rg.position.y = 0.06; G.add(rg);
      if (o.show) G.visible = false; // POLISH: o.show = sig that makes the flag appear (e.g. on a stair that rises later)
      S.cps.push({ x: w.x, y: w.y, z: w.z, G, f, rg, on: false, show: o.show || null });
    },
    /** POLISH: decor-only glowing orb (landmark fruit, lantern light) — no collider */
    orb(x, z, h, r = 0.4, col = 0xffe066) { const w = L2W(x, z, h), m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(col, 0.9)); m.position.set(w.x, w.y, w.z); group.add(m); return m; },
    /** POLISH: one Pip line the first time a signal (or all of a list) turns on */
    pipOn(s, line) { let said = false; steps.push({ sig: s, fn: on => { if (on && !said) { said = true; msgT = t; tst('🐦 Pip: ' + line, 4200); } } }); },
    camRoom(x0, z0, x1, z1, o = {}) {
      const a = o.anchor;
      camRooms.push({ x0: A.x + Math.min(x0, x1), z0: A.z + Math.min(z0, z1), x1: A.x + Math.max(x0, x1), z1: A.z + Math.max(z0, z1), mix: o.mix, anchor: a ? { x: A.x + a[0], z: A.z + a[1], y: a[2] } : null });
    },
    lane(x0, x1, z0, z1, o = {}) { // tall invisible walls with a low visible hedge: keeps everyone on the trail
      const h = o.h ?? 2.2, look = o.look || 'hedge';
      // long sides follow the ground as instanced runs so they do not step down terraces as one beige box
      this.hedgeRun(x0 - 0.5, z0, z1, { look, h, w: 1 });
      this.hedgeRun(x1 + 0.5, z0, z1, { look, h, w: 1 });
      for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 - 0.5, x1 - x0 + 2, 1], [(x0 + x1) / 2, z1 + 0.5, x1 - x0 + 2, 1]]) {
        const r = this.wall(x, z, w, d, h, { look }); const g = r.g;
        addSolid({ type: 'box', x: A.x + x, z: A.z + z, hx: w / 2, hz: d / 2, yaw: 0, y0: g + h - 0.1, top: g + 30, kind: 'zone', fadeM: true });
      }
    },
    /** a hedge wall across the lane with a door that opens on `sig`; invisible above so nobody flies over */
    door(s, z, x0, x1, o = {}) {
      const dw = o.w ?? 3.2, dx = o.x ?? 0, h = o.h ?? 3.4, look = o.look || 'hedge';
      const L = dx - dw / 2 - x0, R = x1 - (dx + dw / 2);
      if (L > 0.05) this.wall(x0 + L / 2, z, L, 1, h, { look }); if (R > 0.05) this.wall(x1 - R / 2, z, R, 1, h, { look });
      const g = gy(0, z);
      addSolid({ type: 'box', x: A.x + (x0 + x1) / 2, z: A.z + z, hx: (x1 - x0) / 2, hz: 0.5, yaw: 0, y0: g + h - 0.2, top: g + 30, kind: 'zone', fadeM: true });
      if (L > 0.05) addSolid({ type: 'box', x: A.x + x0 + L / 2, z: A.z + z, hx: L / 2, hz: 0.5, yaw: 0, y0: g - 1, top: g + 30, kind: 'zone', fadeM: true });
      if (R > 0.05) addSolid({ type: 'box', x: A.x + x1 - R / 2, z: A.z + z, hx: R / 2, hz: 0.5, yaw: 0, y0: g - 1, top: g + 30, kind: 'zone', fadeM: true });
      if (!s) return null;
      const gt = this.gate(s, dx, z, dw, 0.7, h - 0.2, { latch: o.held ? false : true, label: o.label || 'Gate' });
      gt.lock = emojiSprite('🔒', 1.3, true); gt.lock.position.set(A.x + dx, g + h + 0.6, A.z + z - 0.5); group.add(gt.lock);
      return gt;
    },
    hide(kind, x, z, r, h = 3) { // canopy (crow), trunk (owl), log (fox)
      const S = AA(), w = L2W(x, z);
      if (kind === 'canopy') { const G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.add(bx(0.25, h, 0.25, 0x6b4a30, sx * r * 0.6, h / 2, sz * r * 0.6)); G.add(bx(r * 1.9, 0.35, r * 1.9, 0x4f9a3e, 0, h + 0.1, 0), bx(r * 1.4, 0.3, r * 1.4, 0x6ab84f, 0, h + 0.4, 0)); fades.push({ roots: [G], x0: w.x - r, x1: w.x + r, z0: w.z - r, z1: w.z + r, y0: w.y + h - 0.5, y1: w.y + h + 1, a: 1 }); }
      if (kind === 'trunk') { this.tree(x, z, r * 1.6); }
      if (kind === 'log') { const G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(1.0, 1.1, 2.6, 0x8b6a45, -0.55, 0.55, 0), bx(1.0, 1.1, 2.6, 0x8b6a45, 0.55, 0.55, 0), bx(2.1, 0.3, 2.6, 0x9c7850, 0, 1.2, 0), bx(1.2, 0.85, 0.05, 0x2a1a10, 0, 0.5, 1.31)); }
      if (kind === 'reed') { const G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); for (let i = 0; i < 5; i++) G.add(bx(0.18, h * (0.7 + (i % 3) * 0.15), 0.18, 0x5a9a3a, (i - 2) * 0.28, h * 0.4, (i % 2) * 0.2)); }
      if (kind === 'rock') { const G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(r * 1.4, h * 0.7, r * 1.4, 0x9a968c, 0, h * 0.35, 0)); }
      S.hides.push({ kind: kind === 'reed' || kind === 'rock' ? 'log' : kind, x: w.x, z: w.z, y: w.y + h, r: kind === 'trunk' ? r * 0.7 : r });
    },
    badger(id, x, z, o = {}) { const e = enemy('badger', id, x, z, { cone: [3.2, 0.6], ring: o.ring || 5.5, ...o }); if (o.lure) { const [lx, lz, lh = 1.2] = o.lure; this.target('lure:' + id, lx, lz, lh, { range: o.lureRange || 14, label: o.lureLabel || 'Far bush' }); const pr = props[props.length - 1]; pr.lureOf = e; e.lurePr = pr; e.lureAt = L2W(o.lurePt ? o.lurePt[0] : lx, o.lurePt ? o.lurePt[1] : lz); } return e; },
    turtle(id, x, z, o = {}) { const e = enemy('turtle', id, x, z, { cone: [4.6, 0.95], ...o }); if (o.ride) e.ride = { high: o.ride.high ? L2W(o.ride.high[0], o.ride.high[1]) : e.home, low: o.ride.low ? L2W(o.ride.low[0], o.ride.low[1]) : e.home, mid: e.home }; if (o.leaf) { const [lx, lz] = o.leaf; this.lever('leaf:' + id, lx, lz, { label: 'Floating leaf' }); const pr = props[props.length - 1]; pr.act = 'leaf'; pr.re = true; pr.turtle = e; pr.leafAt = L2W(o.leafTo ? o.leafTo[0] : lx, o.leafTo ? o.leafTo[1] : lz); } return e; },
    spider(id, x, z, o = {}) { return enemy('spider', id, x, z, { cone: [4.8, 0.55], ...o }); },
    crow(id, cx, cz, R, h, o = {}) { const e = enemy('crow', id, cx + R, cz, { cone: [4.2, 0.6], cx, cz, R, h, speed: o.speed || 3.2, ...o }); e.ang = o.ang || 0; return e; },
    wasps(id, x, z, o = {}) { const e = enemy('nest', id, x, z, { ring: o.r || 5, grace: 0.9, lift: o.lift || 0, ...o });
      if (recipe && recipe.id === 'grand_garden' && e && e.G && e.G.userData.wasps) { const tint = new THREE.Color(0xff9a60); e.G.userData.wasps.traverse(o => { if (o.material && o.material.color) o.material.color.multiply(tint); }); }
      return e; },
    owl(id, x, z, o = {}) { const base = o.perch ?? 3.5; this.wall(x, z, 0.7, 0.7, base, { look: 'bark' }); return enemy('owl', id, x, z, { cone: [o.r || 11, o.half || 0.36], lift: base, ...o }); },
    fox(id, x, z, o = {}) { return enemy('fox', id, x, z, { cone: [3.6, 0.55], ring: o.ring || 5, ...o }); },
    // ---- S5 escort babies + S3 practice tools (Act 3 P2) ----
    escort(kind, x, z, o = {}) {
      const S = AA(), info = BABY_INFO[kind] || BABY_INFO.cub, n = o.count || 1;
      document.body.classList.add('hasEscort');
      for (let i = 0; i < n; i++) {
        const w = L2W(x + i * 0.85, z + i * 0.2), mk = info.model || kind, G = (MODEL[mk] || MODEL.cub)();
        G.scale.multiplyScalar(info.scale || 1); G.position.set(w.x, w.y, w.z); group.add(G); babyModel(G, mk);
        const el = document.createElement('div'); el.className = 'a2Mark'; document.body.appendChild(el);
        S.escorts.push({ kind, info, G, el, x: w.x, y: w.y, z: w.z, yaw: o.yaw || 0, home: { x: w.x, y: w.y, z: w.z }, called: false, following: false, hide: false, leadBody: null, ph: Math.random() * 6, i });
      }
    },
    cup(s, x, z, o = {}) {
      const S = AA(), w = L2W(x, z), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      G.add(bx(1.1, 0.18, 1.1, 0xc8b090, 0, 0.12, 0), bx(1.0, 0.08, 1.0, 0x8a7a60, 0, 0.22, 0));
      const water = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.82), mat(0x3aa0e8, 0.4)); water.position.y = 0.2; water.scale.y = 0.05; G.add(water);
      S.cups.push({ sig: s, x: w.x, y: w.y, z: w.z, fill: o.fill || 1.6, amt: 0, on: false, G, water });
    },
    tool(kind, x, z, o = {}) {
      const S = AA(), w = L2W(x, z, o.h || 0.2), em = kind === 'bubble' ? '🫧' : '✨', col = kind === 'bubble' ? 0x7fd8ff : 0xffe680;
      const G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      G.add(bx(0.9, 0.35, 0.9, kind === 'bubble' ? 0x5ab8ff : 0xb0b0a8, 0, 0.2, 0));
      const sp = emojiSprite(em, 1.0); sp.position.y = 1.0; G.add(sp);
      S.tools.push({ kind, x: w.x, y: w.y, z: w.z, G, got: false, cls: kind === 'bubble' ? 'scout' : 'bruiser' });
    },

    // ---- S2 gear (Act 3 P3) ----
    /** 🧰 gear stump: any animal swaps its one gear slot between the pieces it has found */
    gearStump(x, z, o = {}) {
      const S = AA(), w = L2W(x, z), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.9, 10), mat(0x8b6a45)); trunk.position.y = 0.45; G.add(trunk);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.06, 10), mat(0xe2c08a)); top.position.y = 0.92; G.add(top);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 4, 18), mat(0xa8824f)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.96; G.add(ring);
      for (const a of [0.4, 2.5, 4.4]) G.add(bx(0.35, 0.25, 0.55, 0x6b4a30, Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95));
      const box = new THREE.Group(); box.position.y = 1.0; G.add(box); box.add(bx(0.7, 0.32, 0.45, 0xd8463a, 0, 0.16, 0, 0.15), bx(0.74, 0.06, 0.49, 0xffd23f, 0, 0.33, 0, 0.3), bx(0.3, 0.1, 0.06, 0x3a3a40, 0, 0.42, 0));
      const icons = new THREE.Group(); icons.position.y = 2.2; G.add(icons);
      const ic = emojiSprite('🧰', 1.0); ic.position.y = 0.5; G.add(ic); ic.position.set(0, 2.0, 0);
      const st = { x: w.x, y: w.y, z: w.z, G, icons, ic, ph: Math.random() * 6, auto: !!o.auto, shown: '' };
      const pr = { kind: 'stump', act: 'gear', cls: null, sig: 'stump:' + S.stumps.length, x: w.x, y: w.y, z: w.z, re: true, label: o.label || 'Gear stump', G, stump: st, r: 2.1 };
      st.pr = pr; props.push(pr); S.stumps.push(st); return st;
    },
    /** smoldering grass patch (Ember Ridge): touch = soot-puff bonk; 🫧 bubble douses it; spring dims it (safe) */
    ember(id, x, z, r = 1.6, d, o = {}) {
      if (typeof d === 'object') { o = d; d = undefined; }
      const S = AA(), w = L2W(x, z), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      const rect = d != null, hw = rect ? r / 2 : r, hd = rect ? d / 2 : r;
      const geo = rect ? new THREE.PlaneGeometry(r, d).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2);
      const disc = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x6a3a1a, emissive: 0xff5a1a, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); disc.position.y = 0.07; G.add(disc);
      const sparks = [], n = Math.min(22, Math.max(7, Math.round(hw * hd * 0.8)));
      for (let i = 0; i < n; i++) { const fx0 = ((i * 0.618) % 1) * 2 - 1, fz0 = ((i * 0.377 + 0.21) % 1) * 2 - 1, m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb43a : 0xff6a2a, transparent: true, opacity: 0.95 })); m.position.set(fx0 * hw * 0.85, 0.2, fz0 * hd * 0.85); G.add(m); sparks.push(m); }
      if (o.model !== false) for (let i = 0; i < Math.max(1, Math.round(hw * hd / 6)); i++) { const H = new THREE.Group(); H.position.set((((i * 0.53) % 1) * 2 - 1) * hw * 0.6, 0, (((i * 0.31 + 0.4) % 1) * 2 - 1) * hd * 0.6); H.rotation.y = i * 1.3; G.add(H); decoInto(H, i % 2 ? 'act3/ember-ridge/ember-coals' : 'act3/ember-ridge/ember-patch', 1.4); }
      const em = { id, x: w.x, y: w.y, z: w.z, r: Math.max(hw, hd), hw, hd, rect, G, disc, sparks, st: 'hot', dimSpring: o.dimIn ? o.dimIn === 'spring' : o.dimSpring === true, /* opt-in: only dimIn:'spring' patches dim */ blow: o.blow || null, blownT: -99 };
      S.embers.push(em); setSig('ember:' + id + ':hot'); return em;
    },
    /** far switch only a 🪨 Pebble Sling shot can ring (crystal / gong up high) */
    slingTarget(s, x, z, h = 4, o = {}) {
      const S = AA(), w = L2W(x, z, h), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      G.add(bx(0.2, h, 0.2, 0x6a6a70, 0, -h / 2, 0));
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), mat(o.col || 0x9fe8ff, 0.45)); G.add(gem);
      const tg = emojiSprite('🎯', 0.9); tg.position.y = 1.4; G.add(tg);
      const q = { sig: s, x: w.x, y: w.y, z: w.z, G, gem, tg, done: false, label: o.label || 'Far crystal', onHit: o.onHit };
      S.targets.push(q);
      props.push({ kind: 'target', act: 'sling', cls: 'bruiser', sig: s, x: w.x, y: w.y, z: w.z, r: 2.8, label: q.label, target: q });
      return q;
    },
    /** ravine too wide to hop: a Trickster gliding with the 🍃 Leaf Glider crosses (about 4 tiles); Scouts fly it */
    glideGap(x0, z0, x1, z1, o = {}) {
      const w = L2W((x0 + x1) / 2, (z0 + z1) / 2), W2 = x1 - x0, D2 = z1 - z0;
      const pit = new THREE.Mesh(new THREE.BoxGeometry(W2, 0.12, D2), new THREE.MeshLambertMaterial({ color: 0x1d2b3a, emissive: 0x0d1a2a, emissiveIntensity: 0.4 })); pit.position.set(w.x, w.y + 0.06, w.z); group.add(pit);
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(W2, D2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.28, depthWrite: false })); mist.position.set(w.x, w.y + 0.5, w.z); group.add(mist);
      const along = W2 > D2;
      for (let i = 0; i < 8; i++) { const k = (i + 0.5) / 8; for (const side of [-1, 1]) { const rx = along ? x0 + k * W2 : (side < 0 ? x0 : x1), rz = along ? (side < 0 ? z0 : z1) : z0 + k * D2, rw = L2W(rx, rz); group.add(bx(0.7, 0.35 + (i % 3) * 0.12, 0.7, i % 2 ? 0x9a968c : 0x8a8578, rw.x, rw.y + 0.15, rw.z)); } }
      const rect = { x0: A.x + x0, z0: A.z + z0, x1: A.x + x1, z1: A.z + z1, off: false, glide: true, mist };
      deep.push(rect); return rect;
    },
    /** decor model on the ground (no collider) */
    deco(key, x, z, size = 1, o = {}) { const w = L2W(x, z, o.h || 0), H = new THREE.Group(); H.position.set(w.x, w.y, w.z); H.rotation.y = o.yaw || 0; group.add(H); if (!decoBatching) { decoInto(H, key, size, o); return H; } const job = { H, size, o }; const L = decoJobs.get(key) || []; L.push(job); decoJobs.set(key, L); return H; },
    fillLight(x, z, h, o = {}) { const w = L2W(x, z, h), L = new THREE.PointLight(o.color || 0xffe2c4, o.intensity ?? 1.55, o.dist ?? 14, o.decay ?? 2); L.position.set(w.x, w.y, w.z); group.add(L); return L; },
    scatterRocks(pts, o = {}) {
      if (!pts || !pts.length) return null;
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(o.c || 0x5e5288), pts.length), M = new THREE.Matrix4();
      const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
      pts.forEach((pt, i) => { const w = L2W(pt[0], pt[1]), sy = pt[3] || 1; P.set(w.x, w.y + sy / 2, w.z); Q.setFromAxisAngle(Y, pt[5] || 0); S.set(pt[2] || 1, sy, pt[4] || 1); M.compose(P, Q, S); im.setMatrixAt(i, M); });
      im.instanceMatrix.needsUpdate = true; im.castShadow = false; group.add(im); return im;
    },
    scatterStalactites(pts, o = {}) {
      if (!pts || !pts.length) return null;
      const im = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), mat(o.c || 0x8a7cb8), pts.length), M = new THREE.Matrix4();
      const P = new THREE.Vector3(), Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), S = new THREE.Vector3();
      const y0 = o.y != null ? o.y : 9.2;
      pts.forEach((pt, i) => { const w = L2W(pt[0], pt[1]), h = pt[3] || 1.4; P.set(w.x, baseY + y0 - h / 2, w.z); S.set(pt[2] || 0.45, h, pt[2] || 0.45); M.compose(P, Q, S); im.setMatrixAt(i, M); });
      im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; group.add(im); return im;
    },
    sprinkler(id, x, z, o = {}) { const e = enemy('sprinkler', id, x, z, { r: o.r || 7, beam: o.beam || 0.22, ...o }); e.cone = coneMesh(e.o.r, e.o.beam, 0x7fd8ff); e.F.add(e.cone); e.F.rotation.y = e.baseYaw; e.grace = o.grace ?? 0.45; if (o.high) { const H = Math.min(o.high, 8), cg = new THREE.PlaneGeometry(e.o.r, H).rotateY(Math.PI / 2); cg.translate(0, H / 2, e.o.r / 2); const cur = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide })); e.cone.add(cur); for (let i = 0; i < 9; i++) { const k = (i + 1) / 10, d = bx(0.34, 0.34, 0.34, 0xbfeeff, 0, 0.6 + H * 0.9 * Math.sin(Math.PI * k * 0.85), e.o.r * k); d.material = new THREE.MeshBasicMaterial({ color: 0xbfeeff, transparent: true, opacity: 0.8 }); e.cone.add(d); } } return e; },
    mower(id, x0, x1, z, o = {}) { const e = enemy('mower', id, x0, z, { x0, x1, period: o.period || 9, dur: o.dur || 3.2, yaw: Math.PI / 2, ...o }); e.grace = 0.05; const L = Math.abs(x1 - x0), m = new THREE.Mesh(new THREE.PlaneGeometry(L + 2, 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); const w = L2W((x0 + x1) / 2, z); m.position.set(w.x, w.y + 0.1, w.z); group.add(m); e.lane = m; return e; },
    gravel(x0, z0, x1, z1) { const S = AA(); S.gravel.push({ x0: A.x + x0, z0: A.z + z0, x1: A.x + x1, z1: A.z + z1 }); const w = L2W((x0 + x1) / 2, (z0 + z1) / 2); const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.08, z1 - z0), mat(0xb8b0a0)); m.position.set(w.x, w.y + 0.05, w.z); group.add(m); for (let i = 0; i < 14; i++) { const s = bx(0.3, 0.15, 0.3, 0x8a8478, w.x + (Math.sin(i * 7.1) * 0.5) * (x1 - x0), w.y + 0.1, w.z + (Math.cos(i * 3.3) * 0.5) * (z1 - z0)); group.add(s); } },
    // ---- M1 Light & Shadow ----
    sunlamp(id, x, z, h, o = {}) { const w = L2W(x, z, h); this.cyl(x, z, 0.9, h - 0.4, 0x8b6a45); const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), mat(0xffe680, 0.9)); cr.position.set(w.x, w.y + 0.2, w.z); group.add(cr); AA().srcs.push({ id, x: w.x, y: w.y + 0.2, z: w.z, need: o.need, to: o.to, cr, shade: o.shade }); },
    mirror(id, x, z, h, aims, o = {}) {
      const w = L2W(x, z, h), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      const post = bx(0.2, h, 0.2, 0x8b6a45, 0, -h / 2, 0); G.add(post); const F = new THREE.Group(); G.add(F);
      // Official mechanic boxes sample this placed crystal (not the GLB glass). Keep #dff4ff
      // and the F-group rotation, but draw it unlit so the shadowed left half lifts with the
      // rest of the face (gray ΔE ≥ 12 vs the wall) without changing its colour or aim behaviour.
      const crystal = bx(1.3, 1.3, 0.12, 0xdff4ff, 0, 0.3, 0, 0.5);
      const cmat = new THREE.MeshBasicMaterial({ color: 0xdff4ff, toneMapped: true, fog: true });
      cmat.name = 'sun-mirror-face';
      crystal.material = cmat; crystal.receiveShadow = false; crystal.castShadow = false;
      crystal.userData.noMerge = true; crystal.userData.noPastel = true;
      F.add(crystal, bx(1.5, 0.15, 0.2, 0xffd23f, 0, 1.0, 0), bx(1.5, 0.15, 0.2, 0xffd23f, 0, -0.4, 0));
      const m = { id, x: w.x, y: w.y + 0.3, z: w.z, aims: aims.map(a => ({ ...a, pt: Array.isArray(a.to) ? L2W(a.to[0], a.to[1], a.to[2] ?? 0.6) : null })), k: o.k || 0, F };
      AA().mirrors.push(m);
      props.push({ kind: 'mirror', act: 'aim', cls: 'scout', sig: 'mir:' + id, x: w.x, y: w.y, z: w.z, r: 2.8, re: true, label: o.label || 'Sun mirror', mir: m, G, icon: badge('scout', w.x, w.y + 1.9, w.z, 0.9) });
    },
    /** ghost platform: solid only while the sunbeam lands on it (shadow:true → while Bear's shadow covers it) */
    ghost(id, x, z, w, d, top, o = {}) {
      const r = this.wall(x, z, w, d, top, { bot: o.bot ?? top - 0.6, c: o.shadow ? 0x6a5a9a : 0xcfe8ff }); r.s.off = true;
      r.m.material = new THREE.MeshLambertMaterial({ color: o.shadow ? 0x8a7ad0 : 0xcfe8ff, transparent: true, opacity: 0.25, emissive: o.shadow ? 0x2a2050 : 0x8fc0f0, emissiveIntensity: 0.45, depthWrite: false });
      r.m.userData.noMerge = true;
      const gh = { id, r, shadow: !!o.shadow, on: false, sig: (o.shadow ? 'shade:' : 'lit:') + id };
      if (o.cross) { gh.cr = { x0: A.x + x - w / 2, z0: A.z + z - d / 2, x1: A.x + x + w / 2, z1: A.z + z + d / 2, on: false, thin: false }; crossings.push(gh.cr); }
      AA().ghosts.push(gh);
    },
    // ---- M2 Water Level ----
    pond(id, x0, z0, x1, z1, o = {}) {
      const S = AA(), w = L2W((x0 + x1) / 2, (z0 + z1) / 2);
      const holes = (o.holes || []).map(([hx0, hz0, hx1, hz1]) => ({ x0: A.x + hx0, z0: A.z + hz0, x1: A.x + hx1, z1: A.z + hz1 }));
      const parts = splitPondRects(x0, z0, x1, z1, o.holes || []);
      const wms = [], muds = [];
      const tint = (wm) => {
        if (!(recipe && (recipe.id === 'thaw_valley' || recipe.id === 'grand_garden'))) return;
        wm.material.emissive.setHex(0x000000); wm.material.emissiveIntensity = 0; wm.material.opacity = recipe.id === 'grand_garden' ? 0.6 : 0.8;
        if (wm.children[0] && wm.children[0].material) wm.children[0].material.opacity = 0.08;
      };
      for (const [px0, pz0, px1, pz1] of parts) {
        const W2 = px1 - px0, D2 = pz1 - pz0, cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2, g = gy(cx, cz);
        const mud = new THREE.Mesh(new THREE.PlaneGeometry(W2, D2).rotateX(-Math.PI / 2), mat(0x6a5030)); mud.position.set(A.x + cx, g + 0.04, A.z + cz); group.add(mud); muds.push(mud);
        const wm = waterSurface(new THREE.PlaneGeometry(W2 + 0.4, D2 + 0.4).rotateX(-Math.PI / 2), { color: o.color || 0x8fc8e8, repeat: [W2 / 6, D2 / 6], emissive: o.emissive, emissiveIntensity: o.emissiveIntensity, opacity: o.opacity });
        wm.position.set(A.x + cx, g + 0.2, A.z + cz); group.add(wm); waterMeshes.push(wm); wms.push(wm); tint(wm);
      }
      const rect = { x0: A.x + x0, z0: A.z + z0, x1: A.x + x1, z1: A.z + z1, off: false };
      deep.push(rect);
      const pd = { id, rect, wm: wms[0] || null, wms, mud: muds[0] || null, muds, holes, gy: w.y, level: o.level || 'mid', wr: [], heights: o.heights || null };
      S.ponds.push(pd); setPond(pd, pd.level, true); return pd;
    },
    sluice(pondId, x, z, level, o = {}) { this.lever(`${pondId}:${level}:lv`, x, z, { label: o.label || `Sluice · ${level} water` }); const pr = props[props.length - 1]; pr.act = 'sluice'; pr.re = true; pr.pond = pondId; pr.level = level; },
    floatLog(id, pondId, ax, az, bx2, bz, o = {}) { // Bear rides it across at high water
      const S = AA(), a = L2W(ax, az), b = L2W(bx2, bz), yaw = o.yaw || 0, wd = o.w || 2.6, dd = o.d || 2.2;
      const m = new THREE.Group(); m.add(bx(wd, 0.7, dd, 0x8b6a45, 0, 0, 0), bx(wd + 0.05, 0.35, 0.5, 0xd9b07a, 0, 0, 0)); group.add(m);
      const s = addSolid({ type: 'box', x: a.x, z: a.z, hx: wd / 2, hz: dd / 2, yaw: 0, y0: a.y - 1, top: a.y + 0.5, kind: 'zone', off: true });
      const cr = { x0: 0, z0: 0, x1: 0, z1: 0, on: false, thin: false }; crossings.push(cr);
      if (o.model) decoInto(m, o.model, o.modelSize || wd, { fallback: m.children.slice(), byLong: true });
      S.logs.push({ id, pond: pondId, a, b, m, s, cr, k: 0, dir: 1, wd, dd, x: a.x, z: a.z, season: o.season });
    },
    // ---- M3 Seed Growing ----
    seed(id, x, z, o = {}) {
      const S = AA(), w = L2W(x, z, o.base || 0), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      G.add(bx(1.4, 0.2, 1.4, 0x7a5a30, 0, 0.1, 0)); const sprout = bx(0.25, 0.5, 0.25, 0x6fbf4a, 0, 0.45, 0); sprout.visible = false; G.add(sprout);
      const sd = { id, x: w.x, y: w.y, z: w.z, G, sprout, planted: false, grown: false, grow: o.grow || 'vine', pad: null };
      props.push({ kind: 'seed', act: 'plant', cls: 'trickster', sig: 'planted:' + id, x: w.x, y: w.y, z: w.z, r: 2.2, label: o.label || 'Seed spot', need: o.need, needWhy: o.needWhy, seed: sd, icon: badge('trickster', w.x, w.y + 1.8, w.z, 0.9) });
      if (sd.grow === 'vine') { const [ax, az, ha, bxx, bz, hb] = o.vine; this.vine(ax, az, ha, bxx, bz, hb, { need: 'grown:' + id, needWhy: 'Grow the vine first: plant the seed (Trickster), then water it (Scout)', label: o.vineLabel || 'Vine ladder' }); const vp = props[props.length - 1]; vp.leaves = group.children.slice(-Math.max(2, Math.ceil((vp.b.y - vp.y) / 0.9))); vp.leaves.forEach(l => { l.visible = false; }); sd.vine = vp; }
      else { const pw = L2W(o.padAt ? o.padAt[0] : x, o.padAt ? o.padAt[1] : z, o.base || 0); const P = new THREE.Group(); P.position.set(pw.x, pw.y, pw.z); P.add(bx(0.5, 0.7, 0.5, 0xf3eee0, 0, 0.35, 0), bx(2.2, 0.5, 2.2, 0xe04848, 0, 0.85, 0, 0.15), bx(0.4, 0.12, 0.4, 0xffffff, 0.5, 1.12, 0.3), bx(0.35, 0.12, 0.35, 0xffffff, -0.5, 1.12, -0.4)); P.visible = false; group.add(P); sd.pad = { x: pw.x, y: pw.y + 1.1, z: pw.z, P, v: o.v || { bruiser: 22, trickster: 15, scout: 11 }, to: o.padTo ? L2W(o.padTo[0], o.padTo[1], o.padTo[2] || 0) : null }; sd.pad.s = addSolid({ type: 'cyl', x: pw.x, z: pw.z, r: 1.1, y0: pw.y - 1, top: pw.y + 1.1, kind: 'zone', off: true }); S.pads.push(sd); }
      S.seeds.push(sd); return sd;
    },
    drip(x, z, h = 2.4) { const w = L2W(x, z, h), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(1.6, 0.12, 0.9, 0x5fae4a, 0, 0, 0)); const d = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0x7fd8ff, 0.7)); d.position.y = -0.4; G.add(d); this.cyl(x, z, 0.12, h, 0x3f8a35); AA().drips.push({ x: w.x, y: w.y, z: w.z, G, d }); },
    // ---- M4 Wind Vanes ----
    vane(id, x, z, o = {}) { const w = L2W(x, z), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(0.25, 3.2, 0.25, 0x6a6a70, 0, 1.6, 0)); const V = new THREE.Group(); V.position.y = 3.3; V.add(bx(0.12, 0.12, 2.4, 0x3a3a40, 0, 0, 0), bx(0.1, 0.9, 0.9, 0xff6bd6, 0, 0, -1.1, 0.3), bx(0.3, 0.3, 0.4, 0xffd23f, 0, 0, 1.2)); G.add(V);
      props.push({ kind: 'vane', act: 'crank', cls: 'trickster', sig: 'vane:' + id, x: w.x, y: w.y, z: w.z, r: 2.4, re: true, label: o.label || 'Vane crank', V, icon: badge('trickster', w.x, w.y + 4.4, w.z, 0.9) }); AA().vanes = (AA().vanes || []).concat([V]);
      if (o.model) { const fb = G.children.slice(); const H = new THREE.Group(); H.position.y = -3.3; V.add(H); decoInto(H, o.model, 4.0, { fallback: fb }); }
      const WY = recipe && recipe.windYaw; if (WY) V.rotation.y = AA().wind > 0 ? WY.up : WY.down; },
    windZone(x0, z0, x1, z1, o = {}) { // gusts follow the vane; wind +1 = along (dx,dz)
      const S = AA(), dl = Math.hypot(o.dx ?? 0, o.dz ?? 1) || 1, n = 40, pos = new Float32Array(n * 3);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.8 })); pts.frustumCulled = false; group.add(pts);
      const seeds = Array.from({ length: n }, (_, i) => ({ u: Math.random(), v: Math.random(), h: 0.8 + Math.random() * (o.h || 6) }));
      S.winds.push({ x0: A.x + x0, z0: A.z + z0, x1: A.x + x1, z1: A.z + z1, dx: (o.dx ?? 0) / dl, dz: (o.dz ?? 1) / dl, push: o.push || 7, lift: o.lift || 0, pts, seeds, gy: gy((x0 + x1) / 2, (z0 + z1) / 2), alt: o.alt ? { down: o.alt.down, up: o.alt.up } : null }); // alt: separate {dx,dz} for wind down / up (e.g. north vs east)
    },
    puffRaft(id, x, z, top, o = {}) { const S = AA(), w = L2W(x, z), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(2.4, 0.4, 2.4, 0xf3f6ff, 0, 0.3, 0, 0.2), bx(1.6, 0.6, 1.6, 0xffffff, 0, 0.7, 0, 0.25), bx(0.2, 1.4, 0.2, 0x6fbf4a, 0, -0.4, 0));
      const s = addSolid({ type: 'box', x: w.x, z: w.z, hx: 1.2, hz: 1.2, yaw: 0, y0: w.y - 1, top: w.y + 0.5, kind: 'zone' }); S.puffs.push({ id, x: w.x, y: w.y, z: w.z, G, s, top: L2W(top[0], top[1], top[2]), used: false });
      props.push({ kind: 'marker', cls: 'bruiser', x: w.x, y: w.y, z: w.z, r: 1.6, label: 'Hold the raft', sig: 'raftHold:' + id, done: false, icon: badge('bruiser', w.x, w.y + 2.6, w.z, 0.9), ring: ringMesh(1.6, 0xff8a1f).children[0] }); group.add(props[props.length - 1].ring); props[props.length - 1].ring.position.set(w.x, w.y + 0.62, w.z);
    },
    // ---- M5 Carry Chain ----
    acornChain(id, rings, o = {}) {
      const S = AA(), m = new THREE.Group(); const fb = [bx(0.9, 0.8, 0.9, 0xffc93c, 0, 0, 0, 0.5), bx(1.0, 0.35, 1.0, 0x8b5a2b, 0, 0.45, 0), bx(0.15, 0.3, 0.15, 0x5a3b22, 0, 0.75, 0)]; fb.forEach(p => m.add(p)); group.add(m);
      if (o.model) decoInto(m, o.model, o.modelSize || 1.2, { fallback: fb });
      const noun = o.noun || 'Golden Acorn', em = o.em || '🌰', homeLb = o.homeLabel || (o.model ? 'Wheel slot' : 'Acorn home');
      const R = rings.map((r, i) => { const w = L2W(r.x, r.z, r.h || 0); const rg = ringMesh(1.2, CLASSES[r.who].color, r.who); rg.position.set(w.x, w.y + 0.08, w.z); group.add(rg); const pr = { kind: 'ring', act: 'pick', cls: r.who, sig: r.home ? `${id}:home` : `${id}:r${i}`, x: w.x, y: w.y, z: w.z, r: 2.2, re: true, label: r.home ? homeLb : 'Hand-off ring', icon: badge(r.who, w.x, w.y + 2.2, w.z, 0.85) }; props.push(pr); return { ...r, i, w, rg, pr }; });
      const ch = { id, m, rings: R, at: o.start || 0, last: o.start || 0, by: null, dropT: -99, home: false, timed: !!o.timed, win: typeof o.window === 'number' ? o.window : ACORN_WINDOW, noun, em };
      (S.acorns = S.acorns || []).push(ch); if (!S.acorn) S.acorn = ch;
    },
    // ---- M5 Wasp smoke ----
    puffShroom(id, x, z, o = {}) { const w = L2W(x, z), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(0.4, 0.6, 0.4, 0xf3eee0, 0, 0.3, 0), bx(1.4, 0.5, 1.4, 0xb08aff, 0, 0.75, 0, 0.2), bx(0.3, 0.1, 0.3, 0xffffff, 0.3, 1.02, 0.2));
      props.push({ kind: 'shroom', act: 'stomp', cls: 'bruiser', sig: 'smoke:' + id, x: w.x, y: w.y, z: w.z, r: 2.4, re: true, label: o.label || 'Puff-mushroom', smokeR: o.r || 6, dur: o.dur || 6, G, icon: badge('bruiser', w.x, w.y + 2.0, w.z, 0.9) }); },
    // ---- M6 Day/Night + gear ----
    toggleBell(id, x, z, h, onRing, o = {}) { const g = gy(x, z), G = new THREE.Group(); const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.7, 0.9, 8), mat(o.col || COL.gold, 0.4)); G.add(bl); G.add(bx(0.3, 0.3, 0.3, 0x6b4a30, 0, 0.55, 0)); if (o.em) { const sp = emojiSprite(o.em, 1.2); sp.position.y = 1.4; G.add(sp); } G.position.set(A.x + x, g + h, A.z + z); group.add(G);
      props.push({ kind: 'tbell', act: 'bell', cls: 'scout', sig: id, x: A.x + x, y: g + h, z: A.z + z, r: 3.2, re: true, label: o.label || 'Bell', G, bell: bl, onRing, icon: badge('scout', A.x + x, g + h + (o.em ? 2.2 : 1.3), A.z + z, 0.9) }); },
    dayNightBell(x, z, h, o = {}) { this.toggleBell('dnBell', x, z, h, () => setNightA2(!AA().night), { label: o.label || 'Day/Night bell', em: '🌗', col: 0xc9b6ff }); },
    glowStep(x, z, w, d, top, o = {}) { const r = this.wall(x, z, w, d, top, { bot: top - 0.5, c: 0x9fe8ff }); r.m.material = new THREE.MeshLambertMaterial({ color: 0x9fe8ff, emissive: 0x3aa0e8, emissiveIntensity: 0.9, transparent: true, opacity: 0.0, depthWrite: false }); r.s.off = true; AA().glowSteps.push({ r, x: A.x + x, z: A.z + z, on: false }); },
    hiddenStep(x, z, w, d, top) { const r = this.wall(x, z, w, d, top, { bot: top - 0.4, c: 0xc9b6ff }); r.m.material = new THREE.MeshBasicMaterial({ color: 0xd9c6ff, transparent: true, opacity: 0, depthWrite: false, wireframe: false }); AA().hidden.push({ r, x: A.x + x, z: A.z + z, kind: 'step' }); },
    hiddenLever(s, x, z, o = {}) { this.lever(s, x, z, o); const pr = props[props.length - 1]; pr.secret = true; pr.found = false; pr.G.visible = false; pr.icon.visible = false; const sv = pr.act; pr.act = null; pr._act = sv; AA().hidden.push({ pr, x: pr.x, z: pr.z, kind: 'switch', range: o.range || 16 }); },
    gift(kind, x, z, h = 0.6) { kind = GIFT_ALIAS[kind] || kind; const w = L2W(x, z, h), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(1.1, 0.8, 1.1, 0x5fae4a, 0, 0, 0, 0.3), bx(1.15, 0.18, 0.2, 0xff6bd6, 0, 0.1, 0, 0.4), bx(0.2, 0.18, 1.15, 0xff6bd6, 0, 0.1, 0, 0.4)); const sp = gearSprite(kind, 1.3); sp.position.y = 1.3; G.add(sp);
      const halo = icons.make({ key: 'halo', size: 3, additive: true, material: { opacity: 0.7, depthTest: true, blending: THREE.AdditiveBlending, color: new THREE.Color(0xffe680), userData: { iconKey: 'halo' } } }); halo.scale.set(3, 3, 1); G.add(halo);
      AA().gifts.push({ kind, x: w.x, y: w.y, z: w.z, G, got: false }); },
    // ---- M7 Seasons ----
    seasonBells(x, z, h) { [['summer', '☀️', 0xffd23f], ['winter', '❄️', 0xbfe8ff], ['spring', '🌱', 0x8be07a]].forEach(([s, em, col], i) => this.toggleBell('bell:' + s, x + (i - 1) * 2.6, z, h, () => setSeason(s), { label: `${s[0].toUpperCase() + s.slice(1)} bell`, em, col })); },

    // S4 Master Bell (act3-levels-22-24.md §1): one hill bell cycles A→B→C→A (season + time + wind). Any class. Never flips SEASONS_ENABLED.
    masterBell(x, z, h = 2, o = {}) {
      const start = (o.start === 'C' || o.start === 'B') ? o.start : 'A';
      const g = gy(x, z), G = new THREE.Group(); G.position.set(A.x + x, g, A.z + z); group.add(G);
      const plinth = bx(2.2, h, 2.2, 0x9a8f7a, 0, h / 2, 0); G.add(plinth);
      const bellG = new THREE.Group(); bellG.position.y = h; G.add(bellG);
      const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.9, 1.15, 12), mat(0xe8c44a, 0.45)); bl.position.y = 0.85; bellG.add(bl);
      const cap = bx(0.22, 0.22, 0.22, 0x6b4a30, 0, 1.5, 0); bellG.add(cap);
      const clap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat(0xc9a227)); clap.position.y = 0.28; bellG.add(clap);
      decoInto(bellG, 'act3/master-bell', 1.8, { byLong: true, fallback: [bl, cap, clap] });
      const nowG = new THREE.Group(); nowG.position.set(0, h * 0.55, 1.28); G.add(nowG);
      nowG.add(bx(1.7, 0.72, 0.12, 0x5a3b22, 0, 0, 0));
      decoInto(nowG, 'act3/teach-plaque', 1.1, { byLong: true });
      const nowLbl = masterTextSprite('Now', 0.42); nowLbl.position.set(0, 0.38, 0.1); nowG.add(nowLbl);
      const nowRow = masterIconRow(MASTER[start].em, 0.48); nowRow.position.set(0, -0.02, 0.1); nowG.add(nowRow);
      const nextG = new THREE.Group(); nextG.position.set(0, h + 2.5, 0); G.add(nextG);
      const nextRow = masterIconRow(MASTER[masterNext(start)].em, 0.85); nextG.add(nextRow);
      const pr = { kind: 'master', act: 'master', cls: null, sig: 'masterBell', x: A.x + x, y: g + h + 0.8, z: A.z + z, r: 3.5, re: true, label: o.label || 'Master Bell', G, bellG, clap, nowRow, nextRow, nowEms: MASTER[start].em.join(''), nextEms: MASTER[masterNext(start)].em.join('') };
      props.push(pr);
      const S = AA(); S.master = { state: start, next: masterNext(start), start, coolUntil: 0, pr, posts: (S.master && S.master.posts) || [] };
      return pr;
    },
    /** Trail post that mirrors the hill bell's current A/B/C icons (Thaw Valley teach plaque). */
    masterPost(x, z, o = {}) {
      const g = gy(x, z), G = new THREE.Group(); G.position.set(A.x + x, g, A.z + z); G.rotation.y = o.yaw || 0; group.add(G);
      G.add(bx(0.22, 1.4, 0.22, 0x6b4a30, 0, 0.7, 0));
      const nowG = new THREE.Group(); nowG.position.set(0, 1.55, 0.2); G.add(nowG);
      nowG.add(bx(1.5, 0.7, 0.1, 0x5a3b22, 0, 0, 0));
      decoInto(nowG, 'act3/teach-plaque', 1.0, { byLong: true });
      const nowLbl = masterTextSprite('Now', 0.36); nowLbl.position.set(0, 0.36, 0.1); nowG.add(nowLbl);
      const start = (AA().master && AA().master.state) || 'A';
      const nowRow = masterIconRow(MASTER[start].em, 0.42); nowRow.position.set(0, -0.02, 0.1); nowG.add(nowRow);
      const S = AA(); S.master = S.master || { state: start, next: masterNext(start), start, coolUntil: 0, posts: [] };
      (S.master.posts ||= []).push({ nowRow });
      return G;
    },
    creek(id, x0, z0, x1, z1, o = {}) { const pd = this.pond(id, x0, z0, x1, z1, { level: 'mid' }); const ice = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.2, z1 - z0), new THREE.MeshLambertMaterial({ color: 0xbbd0dd, emissive: 0x000000, emissiveIntensity: 0, transparent: true, opacity: 0.92 })); ice.position.set(A.x + (x0 + x1) / 2, pd.gy + 0.22, A.z + (z0 + z1) / 2); ice.visible = false; group.add(ice); pd.ice = ice; pd.creek = true; pd.melt = !!o.melt; AA().creeks.push(pd); return pd; },
    snowPile(s, x, z, w, d, h) { this.cracked(s, x, z, w, d, h, { label: 'Snow pile' }); const pr = props[props.length - 1]; pr.m.material = mat(0xf4f8ff); pr.G.visible = false; pr.s.off = true; pr.m.visible = false; pr.snow = true; pr.need = 'winter'; pr.needWhy = 'Only in winter'; AA().seasonal.push({ pr, when: 'winter' }); },
    mudSlide(s, ax, az, ha, bx2, bz, hb, o = {}) { const a = L2W(ax, az, ha), b = L2W(bx2, bz, hb), L = Math.hypot(b.x - a.x, b.z - a.z), m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, L), mat(0x6a4a28)); m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.05, (a.z + b.z) / 2); m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); m.rotation.x = Math.atan2(a.y - b.y, L); group.add(m);
      props.push({ kind: 'slide', act: 'slide', cls: 'trickster', sig: s, x: a.x, y: a.y, z: a.z, b, r: 2.2, need: 'spring', needWhy: 'The chute is frozen or dry — ring the 🌱 Spring bell for mud', label: o.label || 'Mud chute', two: true, icon: badge('trickster', a.x, a.y + 2, a.z, 0.9) }); },
    split(map) { recipe.splitAt = map; },
    /** run fn(on, api) when signal s flips; api: night(v), season(s) */
    /** 6 m waterwheel; starts stuck, spins when `spin` sig is on (axle at y = axle). */
    waterwheel(id, x, z, o = {}) {
      const S = AA(), axle = o.axle ?? 3, size = o.size || 6, w = L2W(x, z), G = new THREE.Group();
      G.position.set(w.x, w.y + axle, w.z); G.rotation.y = o.yaw ?? 0; group.add(G);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(size / 2, size / 2, 0.5, 14), mat(0x8b6a45)); disc.rotation.z = Math.PI / 2; G.add(disc);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, pad = bx(0.18, size * 0.46, 0.7, 0xc69c6d, 0, Math.cos(a) * size * 0.22, Math.sin(a) * size * 0.22); pad.rotation.x = a; G.add(pad); }
      decoInto(G, o.model || 'act3/flooded-mill/waterwheel', size, { fallback: G.children.slice(), byLong: true });
      S.wheels.push({ id, G, spin: o.spin || (id + ':spin') });
    },
    /** gap ducklings cannot float (drain grate). Solid decoration; hop stone fills it at low water. */
    grate(x0, z0, x1, z1, o = {}) {
      const S = AA(), w = L2W((x0 + x1) / 2, (z0 + z1) / 2), W2 = x1 - x0, D2 = z1 - z0;
      const G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G);
      G.add(bx(W2, 0.12, D2, 0x4a4a52, 0, 0.08, 0));
      for (let i = -2; i <= 2; i++) G.add(bx(0.12, 0.35, D2 * 0.9, 0x6a6a70, i * (W2 / 5), 0.22, 0));
      decoInto(G, o.model || 'act3/flooded-mill/drain-grate', Math.max(0.6, Math.min(W2, D2)), { byLong: true });
      S.grates.push({ x0: A.x + x0, z0: A.z + z0, x1: A.x + x1, z1: A.z + z1 });
    },
    /** disc that is solid and visible only while `sig` is on (hop stone at low water). */
    hopStone(sig, x, z, o = {}) {
      const r = o.r || 0.8, top = o.top ?? 0.15, w = L2W(x, z);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 12), mat(0x8a8578)); m.position.set(w.x, w.y + top, w.z); m.visible = false; group.add(m);
      const s = addSolid({ type: 'cyl', x: w.x, z: w.z, r, y0: w.y - 1, top: w.y + top + 0.15, kind: 'zone', off: true });
      const cr = { x0: w.x - r, z0: w.z - r, x1: w.x + r, z1: w.z + r, on: false, thin: false };
      crossings.push(cr);
      steps.push({ sig, fn: on => { m.visible = !!on; s.off = !on; cr.on = !!on; } });
    },
    /** stepped bear ramp from (x, z0, y0) to (x, z1, y1). Slope is a run of flat landings (solids have flat tops). */
    ramp(x, z0, y0, z1, y1, o = {}) {
      const W = o.w || 3, rise = y1 - y0, run = z1 - z0, n = Math.max(4, Math.ceil(Math.abs(run) / 1.25));
      for (let i = 0; i < n; i++) {
        const t1 = (i + 1) / n, zc = z0 + run * ((i + 0.5) / n), y = y0 + rise * t1, d = Math.abs(run) / n + 0.06;
        this.wall(x, zc, W, d, y, { bot: Math.max(0, y - 0.45), look: o.look || 'wood' });
      }
    },
    crossing(x0, z0, x1, z1) { crossings.push({ x0: A.x + Math.min(x0, x1), z0: A.z + Math.min(z0, z1), x1: A.x + Math.max(x0, x1), z1: A.z + Math.max(z0, z1), on: true, thin: false }); },
    onSig(s, fn) { let last = false; steps.push({ sig: s, fn: on => { if (on === last) return; last = on; fn(on, { set: setSig, isOn, night: v => setNightA2(v), season: v => setSeason(v), wind: v => applyWind(v), pond: (pid, lv) => { const pd = AA().ponds.find(q => q.id === pid); if (pd) setPond(pd, lv); } }); } }); },
    /** tick hook for map scripts (ford/reunion flags, etc.). */
    hook(fn) { steps.push({ fn: () => fn({ set: setSig, isOn, en: AA().en, escorts: AA().escorts, night: () => !!AA().night, loc: (x, z) => ({ x: x - A.x, z: z - A.z }) }) }); },
    /** the last boulder slides much farther in winter (ice): to (x,z) with slot height, sets iceSig */
    iceSlot(iceSig, x, z, slotH = 0.6) { const pr = props.filter(q => q.kind === 'boulder').pop(); if (!pr) return; pr.ice = { x: A.x + x, z: A.z + z, top: gy(x, z) + slotH }; pr.iceSig = iceSig; },
    bridgeOn(s, x1, z1, x2, z2, w = 3) { const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1), yaw = Math.atan2(x2 - x1, z2 - z1), g = Math.max(gy(x1, z1), gy(x2, z2));
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, L), mat(0xc69c6d)); m.position.set(A.x + mx, g + 0.2, A.z + mz); m.rotation.y = yaw; m.visible = false; group.add(m);
      const sd = addSolid({ type: 'box', x: A.x + mx, z: A.z + mz, hx: w / 2, hz: L / 2, yaw: -yaw, y0: g - 3, top: g + 0.38, kind: 'zone', off: true });
      const c = { x0: A.x + Math.min(x1, x2) - w / 2, z0: A.z + Math.min(z1, z2) - 0.4, x1: A.x + Math.max(x1, x2) + w / 2, z1: A.z + Math.max(z1, z2) + 0.4, on: false, thin: false }; crossings.push(c);
      steps.push({ sig: s, fn: on => { if (on && !c.on) { c.on = true; m.visible = true; sd.off = false; tst('🌉 A sturdy bridge rose up!', 2000); } } }); },
  });
  function windVec(w) { const S = AA(); if (w.alt) { const d = S.wind > 0 ? w.alt.up : w.alt.down; return { dx: d[0], dz: d[1] }; } return { dx: w.dx * S.wind, dz: w.dz * S.wind }; }
  function applyWind(v, quiet) {
    const prev = AA().wind;
    setMasterWind({ dz: v > 0 ? 1 : v < 0 ? -1 : 0, mag: v === 0 ? 0 : 6 }, true, { flip: true });
    if (prev === v) return;
    const WT = recipe && recipe.windText; if (!quiet) tst(WT ? (v > 0 ? WT.up : WT.down) : v > 0 ? '🌬️ The wind turns — it blows UP the hill now' : '🌬️ The wind turns — it blows DOWN the hill now', 2000);
  }
  function setMasterWind({ dz = 0, dx = 0, mag = 0 } = {}, quiet, o = {}) {
    const S = AA();
    const v = mag === 0 ? 0 : (dz > 0 ? 1 : dz < 0 ? -1 : (dx >= 0 ? 1 : -1));
    const flip = o.flip !== false;
    if (flip && S.wind !== v) { S.windFlipT = t; if (recipe && recipe.waspClearOnFlip) setSig('waspClear'); }
    S.wind = v; S.windMag = mag; S.windDx = dx; S.windDz = dz;
    setSig('wind:up', v > 0); setSig('wind:down', v < 0);
    setSig('wind:north', mag > 0 && v > 0); setSig('wind:south', mag > 0 && v < 0); setSig('wind:calm', mag === 0 || v === 0);
    const WY = recipe && recipe.windYaw; for (const V of S.vanes || []) V.rotation.y = WY ? (v > 0 ? WY.up : WY.down) : (v > 0 ? 0 : Math.PI);
  }
  function setNightA2(v, quiet) { setTimeA2(v ? 'night' : 'day', quiet); }
  function setTimeA2(mode, quiet) {
    const S = AA(), m = mode === 'dusk' ? 'dusk' : mode === 'night' ? 'night' : 'day';
    S.time = m; S.night = m === 'night';
    setSig('night', m === 'night'); setSig('day', m === 'day'); setSig('dusk', m === 'dusk');
    if (ctx.setTime) ctx.setTime(m, true); else ctx.setNight(S.night);
    if (!quiet && m === 'night' && (S.en || []).some(e => e.kind === 'owl')) ctx.audio?.sample?.('act3/owl-hoot', 0.4); // polish4
    if (!quiet) tst(m === 'night' ? '🌙 Night! The owl wakes up…' : m === 'dusk' ? '🌇 Dusk! The owl is drowsy…' : '☀️ Day! The owl dozes off.', 2000);
  }
  function setSeason(s, quiet) {
    const S = AA(); if (S.season === s) { if (!quiet) tst(`${s} already`, 900); return; } S.season = s;
    for (const k of ['summer', 'winter', 'spring']) setSig(k, k === s);
    for (const pd of S.creeks) { const lv = pd.melt ? (s === 'winter' ? 'ice' : s === 'spring' ? 'high' : 'mid') : (s === 'winter' ? 'ice' : 'mid'); setPond(pd, lv, true); }
    for (const it of S.seasonal) { const on = s === it.when && !it.pr.done; it.pr.s.off = !on; it.pr.m.visible = on; }
    if (terrMesh) {
      const m = terrMesh.material, look = !!(recipe && terrMesh.userData.lookTerrain);
      if (look) { m.emissive = new THREE.Color(0); m.emissiveIntensity = 0; m.color.set(0xffffff); m.needsUpdate = true; terrMesh.userData.wantSeason = s; terrMesh.userData.colT = 0; }
      else if (s === 'winter') { m.color.set(0xffffff); m.emissive = new THREE.Color(0x9ab0c8); m.emissiveIntensity = 0.75; m.needsUpdate = true; }
      else if (s === 'spring') { m.color.set(0xdfffd0); m.emissive = new THREE.Color(0x203010); m.emissiveIntensity = 0.3; m.needsUpdate = true; }
      else { m.color.set(0xffffff); m.emissive = new THREE.Color(0); m.emissiveIntensity = 0; m.needsUpdate = true; }
    }
    if (!quiet) tst({ summer: '☀️ Summer! The creek flows — logs can float.', winter: '❄️ Winter! The creek freezes, snow hides your scent.', spring: '🌱 Spring! Mud for sliding and vines can grow.' }[s], 2400);
  }
  // S4 Master Bell — shared A/B/C table (act3-integration.md, act3-levels-22-24.md §1.1). Writes only per-level S.season / S.time / S.wind.
  const MASTER = {
    A: { season: 'winter', time: 'night', wind: { dz: 1, dx: 0, mag: 6 }, em: ['❄️', '🌙', '⬆️'], line: '🔔 A · Winter, night, north wind' },
    B: { season: 'spring', time: 'day', wind: { dz: -1, dx: 0, mag: 6 }, em: ['🌱', '☀️', '⬇️'], line: '🔔 B · Spring, day, south wind' },
    C: { season: 'summer', time: 'dusk', wind: { dz: 0, dx: 0, mag: 0 }, em: ['☀️', '🌇', '▪️'], line: '🔔 C · Summer, dusk, calm' },
  };
  const MASTER_ORDER = ['A', 'B', 'C'];
  const masterNext = s => MASTER_ORDER[(MASTER_ORDER.indexOf(s) + 1) % 3];
  function masterIconRow(ems, s = 0.7) { const row = new THREE.Group(); ems.forEach((em, i) => { const sp = emojiSprite(em, s); sp.position.x = (i - 1) * (s * 0.9); row.add(sp); }); return row; }
  function masterTextSprite(text, s = 0.45) {
    const key = 'tx:' + text;
    icons.packText(text, text);
    const sp = icons.make({ key, material: { opacity: 1, depthTest: false, color: new THREE.Color(0xffffff), userData: { iconKey: key } }, layer: 'overlay' });
    sp.scale.set(s * 2.4, s * 0.6, 1); sp.renderOrder = 9; return sp;
  }
  function applyMaster(state, opts = {}) {
    const S = AA(), st = MASTER[state] ? state : 'A', M = MASTER[st];
    const prev = S.master && S.master.state;
    S.master = S.master || { start: st, coolUntil: 0 };
    S.master.state = st; S.master.next = masterNext(st);
    for (const k of MASTER_ORDER) setSig('master:' + k, k === st);
    setSeason(M.season, true);
    setTimeA2(M.time, true);
    setMasterWind(M.wind, true, { flip: st === 'B' && !opts.init }); // wasps blow 6 s only when B is entered, not on load
    if (S.master.pr) paintMaster(S.master.pr);
    if (!opts.init && prev && prev !== st) {
      if (st === 'A') ctx.audio?.sample?.('act3/ice-sheet', 0.55);
      if (st === 'B') ctx.audio?.sample?.('act3/ice-thaw', 0.55);
    }
    ctx.look?.setMaster?.(st, { snap: !!opts.init });
    if (!opts.quiet) tst(M.line, 2400);
  }
  function paintMaster(pr) {
    const S = AA(); if (!S.master) return;
    const now = MASTER[S.master.state].em, nxt = MASTER[S.master.next].em, cool = t < (S.master.coolUntil || 0);
    const paintRow = (row, ems, gap, key, size) => { if (!row) return; if (row[key] !== ems.join('')) { row.clear(); ems.forEach((em, i) => { const sp = emojiSprite(em, size); sp.position.x = (i - 1) * gap; row.add(sp); }); row[key] = ems.join(''); } };
    if (pr) {
      paintRow(pr.nowRow, now, 0.43, 'nowEms', 0.48); pr.nowEms = now.join('');
      paintRow(pr.nextRow, nxt, 0.76, 'nextEms', 0.85); pr.nextEms = nxt.join('');
      pr.nextRow && pr.nextRow.children.forEach(sp => { if (sp.material) sp.material.opacity = cool ? 0.28 : 1; });
    }
    for (const post of S.master.posts || []) paintRow(post.nowRow, now, 0.43, 'nowEms', 0.48);
  }
  function ringMaster(pr) {
    const S = AA(); if (!S.master) return true;
    if (t < (S.master.coolUntil || 0)) {
      S.master.queued = true; // apply as soon as the clapper settles (a ring during cool should not be lost)
      if (t - msgT > 1.6) ctx.audio?.speak?.('master_bell.pip.settle');
      say('🔔 Wait for the bell to settle.', 1600);
      return true;
    }
    S.master.queued = false;
    const to = S.master.next;
    applyMaster(to);
    S.master.coolUntil = t + 2;
    pr.ringT = t;
    paintMaster(pr);
    ctx.audio?.sample?.('act3/master-bell-chime-' + to.toLowerCase(), 0.62);
    return true;
  }
  function updateMasterViz(pr) {
    const S = AA(); if (!S.master) return;
    if (S.master.queued && t >= (S.master.coolUntil || 0)) ringMaster(pr);
    paintMaster(pr);
    const ringing = pr.ringT != null && t - pr.ringT < 1.0, cool = t < (S.master.coolUntil || 0);
    if (ringing) { const k = 1 - (t - pr.ringT) / 1.0; pr.bellG.rotation.z = Math.sin((t - pr.ringT) * 20) * 0.28 * k; if (pr.clap) pr.clap.position.x = Math.sin((t - pr.ringT) * 20) * 0.12 * k; }
    else { pr.bellG.rotation.z = 0; if (pr.clap) pr.clap.position.x = 0; } // cooldown: clapper visibly still; Interact is a no-op
    void cool;
  }
  const owlAwake = (S = AA()) => !!(S.night || S.time === 'dusk');
  function pondSurf(pd, level = pd.level) {
    const H = pd.heights || {};
    if (level === 'low' || level === 'ice') return pd.gy + (H.low || 0);
    if (level === 'high') return pd.gy + (H.high != null ? H.high : 0.55);
    return pd.gy + (H.mid != null ? H.mid : 0.2);
  }
  function inPondHole(pd, x, z) {
    return (pd.holes || []).some(h => x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1);
  }
  function splitPondRects(x0, z0, x1, z1, holes) {
    let parts = [[x0, z0, x1, z1]];
    for (const [hx0, hz0, hx1, hz1] of holes) {
      const next = [];
      for (const [px0, pz0, px1, pz1] of parts) {
        if (hx1 <= px0 || hx0 >= px1 || hz1 <= pz0 || hz0 >= pz1) { next.push([px0, pz0, px1, pz1]); continue; }
        const ix0 = Math.max(px0, hx0), iz0 = Math.max(pz0, hz0), ix1 = Math.min(px1, hx1), iz1 = Math.min(pz1, hz1);
        if (pz0 < iz0) next.push([px0, pz0, px1, iz0]);
        if (iz1 < pz1) next.push([px0, iz1, px1, pz1]);
        if (px0 < ix0) next.push([px0, iz0, ix0, iz1]);
        if (ix1 < px1) next.push([ix1, iz0, px1, iz1]);
      }
      parts = next.filter(r => r[2] - r[0] > 0.05 && r[3] - r[1] > 0.05);
    }
    return parts;
  }
  function setPond(pd, level, quiet) {
    pd.level = level; const dry = level === 'low' || level === 'ice';
    pd.rect.off = dry; pd.rect.y = dry ? null : pondSurf(pd);
    for (const r of pd.wr) { const i = WATER_RECTS.indexOf(r); if (i >= 0) WATER_RECTS.splice(i, 1); } pd.wr = [];
    if (!dry) { const R = pd.rect, st = 1.4, wy = pondSurf(pd); for (let x = R.x0 + 0.7; x < R.x1; x += st) for (let z = R.z0 + 0.7; z < R.z1; z += st) { if (inPondHole(pd, x, z)) continue; const r = { x, z, hw: st * 0.55, hd: st * 0.55, y: wy }; WATER_RECTS.push(r); pd.wr.push(r); } }
    const wy = pondSurf(pd);
    for (const wm of (pd.wms || (pd.wm ? [pd.wm] : []))) { wm.visible = !dry; wm.position.y = wy; }
    if (pd.ice) pd.ice.visible = level === 'ice';
    for (const k of ['low', 'mid', 'high']) setSig(`${pd.id}:${k}`, level === k);
    if (!quiet) tst({ low: '🚰 Water down — the pond bed is dry!', mid: '🚰 Water at the middle', high: pd.heights ? '🌊 Water up high — the mill floods!' : '🌊 Water up high — logs float!', ice: '❄️ The creek froze solid' }[level], 1800);
  }
  /** Act-2 Interact verbs */
  function a2Act(pr, p) {
    const S = AA();
    switch (pr.act) {
      case 'aim': { aimMirror(pr.mir); tst('🪞 Mirror turned', 900); return true; }
      case 'sluice': { const pd = S.ponds.find(q => q.id === pr.pond); if (pd) setPond(pd, pr.level); pr.arm.rotation.z = pr.arm.rotation.z > 0 ? -0.5 : 0.5; ctx.audio?.sample?.('act3/sluice-water', 0.55); return true; }
      case 'plant': { const sd = pr.seed; if (sd.planted) { say('🌱 Planted! Now a Scout brings a 💧 dewdrop from a drip leaf', 2200); return true; } sd.planted = true; sd.sprout.visible = true; pr.done = true; setSig(pr.sig); tst('🌰 Seed planted! A Scout must water it with a dewdrop 💧', 2400); return true; }
      case 'cut': { const sp = pr.spider; if (sp && !sp.look && !pr.web.free) { sp.alertT = t; bonk(sp); return true; } pr.done = true; pr.web.s.off = true; pr.web.G.visible = false; setSig(pr.sig); tst('✂️ Snip! The web is cut', 1600); return true; }
      case 'pluck': { const sp = pr.spider; if (sp) sp.look = { x: pr.x, z: pr.z, until: t + 8 }; tst('🎸 Twang! The spider turns to look…', 1600); return true; }
      case 'leaf': { const tu = pr.turtle; if (tu) tu.look = { x: pr.leafAt.x, z: pr.leafAt.z, until: t + 9 }; tst('🍃 The leaf floats by — the turtle watches it', 1800); return true; }
      case 'master': return ringMaster(pr);
      case 'crank': { applyWind(-S.wind); ctx.audio?.sample?.('act3/vane-crank', 0.5); return true; }
      case 'slide': { const to = pr._atB ? pr : pr.b; tween(p, { x: to.x, y: to.y + 0.3, z: to.z }, 0.7, 0.2); setSig(pr.sig); tst('🛷 Wheee! Belly-slide!', 1200); return true; }
      case 'stomp': { const until = t + pr.dur * EZ('puff'); S.smokes.push({ x: pr.x, z: pr.z, r: pr.smokeR, until, m: smokeCloud(pr.x, pr.y, pr.z, pr.smokeR) }); setSig(pr.sig); a2Burst(pr.x, pr.z, 6); tst('🍄 Poof! A calm smoke cloud — walk through it', 2000); return true; }
      case 'pick': { const ac = S.acorns.find(a => a.rings.some(r => r.pr === pr)); const R = ac && ac.rings.find(r => r.pr === pr); if (ac) S.acorn = ac; if (!R || ac.at !== R.i || ac.by) return true; ac.by = ctx.cur(); ac.at = -1; ac.last = R.i; tst(`${ac.em || '🌰'} Got the ${ac.noun || 'Golden Acorn'}! Carry it to the next ring`, 1600); return true; }
      case 'drop': { const ac = S.acorns.find(a => a.rings.some(r => r.pr === pr)); const R = ac && ac.rings.find(r => r.pr === pr); if (!R) return true;
        const fit = R.home && !ac.by && !ac.home && ac.at >= 0 && CLASS_OF[ctx.cur()] === (R.homeBy || 'bruiser');
        if (!fit && ac.by !== ctx.cur()) return true; ac.by = null; ac.at = R.i; ac.dropT = t; setSig(R.pr.sig); if (R.home) { ac.home = true; S.acorn = S.acorns.find(a => !a.home) || ac; setSig(ac.id + ':home'); tst(`${ac.em || '🌰'} The ${ac.noun || 'Golden Acorn'} is home!`, 2200); ctx.audio?.chime?.(); } else tst('⭕ Hand-off! The next friend picks it up', 1600); return true; }
    }
    return false;
  }
  function acornBack() { const ac = (AA().acorns || []).find(a => a.by === ctx.cur()); if (!ac) return; ac.by = null; ac.at = ac.last; tst(`${ac.em || '🌰'} The ${ac.noun || 'acorn'} floats back to its ring`, 1600); }
  function smokeCloud(x, y, z, r) { const G = new THREE.Group(); G.position.set(x, y, z); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, s = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf4f0ff, transparent: true, opacity: 0.45, depthWrite: false })); s.position.set(Math.cos(a) * r * 0.55, 0.8 + (i % 3) * 0.6, Math.sin(a) * r * 0.55); G.add(s); } group.add(G); return G; }
  function beamSeg(i, a, b) { const S = AA(); let m = S.beamPool[i]; if (!m) { m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 6; group.add(m); S.beamPool[i] = m; }
    const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), L = d.length(); m.visible = L > 0.05; m.scale.set(1, L, 1); m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); }

  // ===== S2 gear (Act 3 P3) runtime =====
  function autoStump() { // replays of older levels: a stump by the start whenever a class has 2+ pieces to choose from
    const S = AA(); if (S.stumps.length || recipe.kid || recipe.hub) return;
    if (!Object.keys(GEAR_BY_CLS).some(c => GEAR_BY_CLS[c].filter(k => gearHas(k)).length > 1)) return;
    const h = homeAt ? { x: homeAt.x - A.x, z: homeAt.z - A.z } : { x: 0, z: 0 };
    B.gearStump(h.x + 3.2, h.z - 2.2, { auto: true });
  }
  function stumpSwap(pr) {
    const c = clsOfCur(), C = CLASSES[c], L = GEAR_BY_CLS[c].filter(k => gearHas(k));
    if (!L.length) { const k = GEAR_BY_CLS[c][0]; say(`🧰 Your ${C.name} has no gear yet — the ${GEAR_INFO[k].em} ${GEAR_INFO[k].name} is found in ${GEAR_INFO[k].where}`, 2600); return true; }
    const cur = slotOf(c), on = gearOn(cur);
    const next = L.length > 1 ? L[(L.indexOf(cur) + 1) % L.length] : cur;
    if (next === cur && on) { say(`🧰 ${GEAR_INFO[cur].em} ${GEAR_INFO[cur].name} is already in your ${C.name}'s gear slot`, 2000); return true; }
    setSlot(c, next); setGear(next, true, true);
    pr.stump.swapT = t; fx(pr.x, pr.y + 1.4, pr.z); ctx.audio?.sample?.('ui2/gear-equip-clink', 0.5);
    tst(`🧰 ${C.name} gear slot: ${GEAR_INFO[next].em} ${GEAR_INFO[next].name}${L.length > 1 ? ` (tap again for ${GEAR_INFO[L[(L.indexOf(next) + 1) % L.length]].em})` : ''}`, 2200);
    return true;
  }
  function aimMirror(m) {
    if (!m || !m.aims || !m.aims.length) return;
    m.k = (m.k + 1) % m.aims.length;
    if (m.F) m.F.rotation.y = m.k * 0.9;
    setSig('mir:' + m.id);
    setSig(m.id);
    ctx.audio?.sample?.('act3/mirror-turn', 0.4);
  }
  /** Interact with nothing in reach: use the slotted gear (🫧 bubble shot, 🪨 sling pebble) */
  function useGear(p) {
    if (ctx.isNetClient?.()) { emitNet('intent', { intent: 'gear', body: ctx.cur() }); return true; }
    const S = a2, c = clsOfCur(); if (!S || tw) return false;
    if (c === 'scout' && gearOn('pouch')) {
      if (!S.pouch.full) { say('🫧 The Bubble Pouch is empty — fly low over a creek or pond to fill it', 2200); return true; }
      const near = S.seeds.find(q => q.planted && !q.grown && flatD(q, p) < 2.6 && Math.abs((p.y || 0) - q.y) < 3.5);
      if (near) { S.pouch.full = false; ctx.onGear?.(); ctx.audio?.sample?.('act3/bubble-pop', 0.5); tst('🫧 The bubble waters the seed!', 1600); growSeed(near); return true; }
      const nearCup = S.cups.find(q => !q.on && flatD(q, p) < 2.0 && Math.abs((p.y || 0) - q.y) < 3.5);
      if (nearCup) { S.pouch.full = false; ctx.onGear?.(); ctx.audio?.sample?.('act3/bubble-pop', 0.5); nearCup.amt = nearCup.fill; tst('🫧 Splash! The bubble fills the cup', 1600); return true; }
      const tg = gearTarget(p, 'pouch'); S.pouch.full = false; ctx.onGear?.(); ctx.audio?.sample?.('act3/bubble-pop', 0.5);
      const yaw = p.yaw || 0, to = tg || { x: p.x + Math.sin(yaw) * 9, z: p.z + Math.cos(yaw) * 9 };
      return throwTool('bubble', to.x, to.z, p, { src: 'pouch', ty: tg && tg.ty, msg: tg ? `🫧 Bubble shot at the ${tg.label}!` : '🫧 Bubble shot!' });
    }
    if (c === 'bruiser' && gearOn('sling')) {
      if (t - S.slingT < 0.9) return true; S.slingT = t; ctx.audio?.sample?.('act3/sling-twang', 0.5);
      const tg = gearTarget(p, 'sling'), yaw = p.yaw || 0, to = tg || { x: p.x + Math.sin(yaw) * 11, z: p.z + Math.cos(yaw) * 11 };
      if (tg && tg.kind === 'mirror' && tg.ref) aimMirror(tg.ref);
      return throwTool('pebble', to.x, to.z, p, { src: 'sling', ty: tg && tg.ty, hitMir: !!(tg && tg.kind === 'mirror'), dur: 0.25, msg: tg ? `🪨 Sling! A shiny pebble flies at the ${tg.label}` : '🪨 Sling! A shiny pebble flies' });
    }
    return false;
  }
  function gearTarget(p, kind) {
    const S = a2, yaw = p.yaw || 0, fx0 = Math.sin(yaw), fz0 = Math.cos(yaw), out = [];
    const add = (q, label, ty, R = 18) => { const d = flatD(q, p); if (d < 0.5 || d > R) return; const dot = ((q.x - p.x) * fx0 + (q.z - p.z) * fz0) / d; out.push({ x: q.x, z: q.z, ty, label, sc: dot > 0.5 ? d : d * 4 + 20 }); }; // what you face wins
    if (kind === 'pouch') {
      for (const e of S.embers) if (e.st !== 'out') add(e, 'ember patch', undefined, 16);
      for (const w of props) if (w.kind === 'web' && !w.done) add(w, 'spider web', undefined, 16);
      for (const q of S.cups) if (!q.on) add(q, 'cup-switch', undefined, 16);
      for (const sd of S.seeds) if (sd.planted && !sd.grown) add(sd, 'planted seed', undefined, 16);
    } else {
      for (const q of S.targets) if (!q.done) add(q, q.label.toLowerCase(), q.y, 20);
      for (const m of S.mirrors || []) { const q = { x: m.x, z: m.z }; const d = (typeof flatD === 'function') ? flatD(q, p) : Math.hypot(m.x - p.x, m.z - p.z); if (d >= 0.5 && d <= 20) { const dot = ((m.x - p.x) * fx0 + (m.z - p.z) * fz0) / d; out.push({ x: m.x, z: m.z, ty: m.y, label: 'crystal', kind: 'mirror', ref: m, sc: dot > 0.5 ? d : d * 4 + 20 }); } }
      for (const e of S.en) if (['crow', 'fox', 'spider', 'owl', 'turtle'].includes(e.kind)) add(e, e.name || e.kind, undefined, 16);
    }
    out.sort((a, b) => a.sc - b.sc); return out[0] || null;
  }
  function growSeed(sd) {
    if (sd.grown) return; sd.grown = true; setSig('grown:' + sd.id); fx(sd.x, sd.y + 1, sd.z); ctx.audio?.chime?.();
    if (sd.vine) { sd.vine.leaves.forEach(l => { l.visible = true; }); tst('🌿 A vine ladder grew! Tricksters can climb it', 2200); } if (sd.pad) { sd.pad.P.visible = true; sd.pad.s.off = false; tst('🍄 A bouncy mushroom grew! Bear bounces highest', 2200); }
  }
  const inEmber = (em, q, pad = 0) => em.rect ? Math.abs(q.x - em.x) < em.hw + pad && Math.abs(q.z - em.z) < em.hd + pad : Math.hypot(q.x - em.x, q.z - em.z) < em.r + pad;
  function emberOut(em) { em.st = 'out'; em.G.visible = false; setSig('ember:' + em.id + ':hot', false); setSig('ember:' + em.id + ':out'); setSig('out:' + em.id); setSig('safe:' + em.id); ctx.audio?.sample?.('act3/ember-sizzle', 0.5); fx(em.x, em.y + 0.6, em.z); tst('🫧 Fsssh! The ember patch is out', 1800); ctx.audio?.sample?.('ui2/lantern-click', 0.4); }
  /** a landed pouch bubble / sling pebble: returns true when it was used up */
  function shotLand(sh) {
    const S = a2; if (!S) return false;
    if (sh.kind === 'bubble' && sh.src === 'pouch') {
      const em = S.embers.find(e => e.st !== 'out' && inEmber(e, sh, 1.2)); if (em) { emberOut(em); return true; }
      const cup = S.cups.find(q => !q.on && Math.hypot(q.x - sh.x, q.z - sh.z) < 1.8); if (cup) { cup.amt = cup.fill; tst('🫧 Splash! The bubble fills the cup', 1600); return true; }
      const sd = S.seeds.find(q => q.planted && !q.grown && Math.hypot(q.x - sh.x, q.z - sh.z) < 2); if (sd) { tst('🫧 The bubble waters the seed from afar!', 1600); growSeed(sd); return true; }
      return true; // the bubble pops on the grass
    }
    if (sh.kind === 'shiny' && sh.src === 'sling') {
      const mir = (S.mirrors || []).find(m => Math.hypot(m.x - sh.x, m.z - sh.z) < 1.8 && Math.abs((m.y || sh.y) - sh.y) < 2.5);
      if (mir) { if (!sh.hitMir) { aimMirror(mir); fx(mir.x, mir.y, mir.z); tst('🪞 The pebble turned the crystal!', 1600); } return true; }
      ctx.audio?.sample?.('act3/pebble-hit', 0.5);
      const q = S.targets.find(g => !g.done && Math.hypot(g.x - sh.x, g.z - sh.z) < 1.8 && Math.abs(g.y - sh.y) < 2.5);
      if (q) { q.done = true; q.gem.material = mat(0xffd23f, 0.9); q.tg.visible = false; setSig(q.sig); q.onHit?.(); fx(q.x, q.y, q.z); ctx.audio?.sample?.('contest/win-jingle', 0.4); tst(`🎯 Ding! The pebble rang the ${q.label.toLowerCase()}`, 1800); return true; }
      for (const e of S.en) { const d = flatD(e, sh); if (d > 9) continue;
        if (e.kind === 'fox' && !e.pingLure) { e.pingLure = { x: sh.x, z: sh.z, phase: 'go' }; tst('🦊 The fox trots off to sniff the pebble…', 1600); ctx.audio?.sample?.('act3/fox-sniff', 0.45); }
        else if ((e.kind === 'spider' || e.kind === 'turtle') && !e.look) { e.look = { x: sh.x, z: sh.z, until: t + 6 }; tst(`👀 The ${e.name || e.kind} turns to look at the pebble`, 1600); } }
      return false; // stays a few seconds as a shiny lure (crows swoop at it)
    }
    return false;
  }
  function gearViz() {
    const S = a2; if (S.gviz) return S.gviz; const V = {};
    V.pouch = new THREE.Group(); V.pouch.add(bx(0.34, 0.36, 0.22, 0x5ab8ff, 0, 0, 0, 0.2), bx(0.36, 0.08, 0.24, 0x2f6aa8, 0, 0.18, 0)); V.bub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.75, emissive: 0x3aa0e8, emissiveIntensity: 0.5 })); V.bub.position.y = 0.38; V.pouch.add(V.bub);
    V.glider = new THREE.Group(); const lf = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.3), mat(0x6fbf4a, 0.15)); V.glider.add(lf, bx(0.08, 0.08, 1.4, 0x3f8a35, 0, 0.04, 0), bx(0.06, 0.9, 0.06, 0x8b6a45, 0, -0.45, 0)); for (const sx of [-1, 1]) V.glider.add(bx(0.7, 0.05, 0.9, 0x5fae4a, sx * 1.25, 0.08, -0.1));
    V.sling = new THREE.Group(); V.sling.add(bx(0.1, 0.5, 0.1, 0x8b5a2b, 0, 0, 0), bx(0.08, 0.36, 0.08, 0x8b5a2b, -0.12, 0.38, 0), bx(0.08, 0.36, 0.08, 0x8b5a2b, 0.12, 0.38, 0), bx(0.34, 0.04, 0.04, 0xe5485a, 0, 0.52, 0), bx(0.14, 0.14, 0.14, 0xffe680, 0, 0.52, -0.08, 0.6));
    for (const k of ['pouch', 'glider', 'sling']) {
      V[k].visible = false; group.add(V[k]);
      const H = new THREE.Group(); V[k].add(H); const fb = V[k].children.filter(c => c !== H);
      const box = { visible: true }; Object.defineProperty(box, 'visible', { set(v) { fb.forEach(c => { if (c !== V.bub) c.visible = v; }); } });
      gearModel(k, H, box, o => { if (k === 'pouch') { V.bubM = []; o.traverse(n => { if (/^bubble/.test(n.name)) V.bubM.push(n); }); V.bub.visible = false; V.bubOff = true; }
        if (k === 'glider') H.rotation.y = Math.PI; if (k === 'sling') H.position.y = -0.1; });
    }
    return (S.gviz = V);
  }
  function updGear(dt, p, cur, c) {
    const S = a2; if (!S) return; const V = gearViz();
    // stumps: bob the toolbox, show the current class's choices
    for (const st of S.stumps) {
      st.pr.cls = c; st.ic.position.y = 2.0 + Math.sin(t * 2 + st.ph) * 0.12; 
      const L = GEAR_BY_CLS[c].filter(k => gearHas(k)), key = c + L.join() + slotOf(c);
      if (key !== st.shown) { st.shown = key; while (st.icons.children.length) st.icons.children.pop(); L.forEach((k, i) => { const sp = gearSprite(k, k === slotOf(c) ? 1.05 : 0.75); sp.position.set((i - (L.length - 1) / 2) * 1.0, 0.6, 0); if (k !== slotOf(c)) sp.material.opacity = 0.55; st.icons.add(sp); }); }
      st.ic.material.opacity = flatD(st, p) < 6 ? 1 : 0.8;
    }
    // 🫧 Bubble Pouch: fills by flying low over water
    const sid = idOfCls('scout'), sq = sid && posOfId(sid), pouchOn = gearOn('pouch') && sq;
    if (pouchOn && !S.pouch.full) {
      const gyq = ctx.heightAt(sq.x, sq.z), low = sq.y - gyq < 3.2;
      const nearSurf = S.ponds.some(pd => pd.level !== 'low' && pd.level !== 'ice' && inRect(sq.x, sq.z, pd.rect) && Math.abs(sq.y - pondSurf(pd)) < 2.4);
      const wet = (low && WATER_RECTS.some(r => Math.abs(sq.x - r.x) < r.hw + 0.4 && Math.abs(sq.z - r.z) < r.hd + 0.4)) || nearSurf || S.cups.some(q => q.on && flatD(q, sq) < 1.6);
      if (wet) { S.pouch.full = true; ctx.onGear?.(); ctx.audio?.sample?.('act3/bubble-splash', 0.5); if (sid === cur) tst('🫧 Glug! The Bubble Pouch is full — tap Interact to shoot the bubble', 2200); setSig('pouch:full'); }
    }
    if (!pouchOn || !S.pouch.full) setSig('pouch:full', false);
    V.pouch.visible = !!pouchOn; if (pouchOn) { const yw = sq.yaw || 0; V.pouch.position.set(sq.x - Math.cos(yw) * 0.35, sq.y + 0.55, sq.z + Math.sin(yw) * 0.35); V.pouch.rotation.y = yw; if (V.bubOff) { for (const n of V.bubM) n.visible = S.pouch.full; } else V.bub.visible = S.pouch.full; V.bub.scale.setScalar(1 + Math.sin(t * 5) * 0.08); }
    // 🍃 Leaf Glider: slow fall + rides the wind (current Trickster only)
    const tid = idOfCls('trickster'), tq = tid && posOfId(tid), gOn = gearOn('glider') && tq;
    let gliding = false;
    if (gOn && tid === cur && !p.grounded && !tw) {
      const air = p.y - ctx.heightAt(p.x, p.z);
      if (p.vy < 0 && air > 0.4 && S.glide < 1.6) { if (S.glide === 0) ctx.audio?.sample?.('act3/glider-whoosh', 0.45); gliding = true; S.glide += dt; p.vy = Math.max(p.vy, -1.5); }
      for (const w of S.winds) if (p.x > w.x0 && p.x < w.x1 && p.z > w.z0 && p.z < w.z1 && S.wind) { gliding = true; const wv = windVec(w); p.x += wv.dx * w.push * 0.6 * dt; p.z += wv.dz * w.push * 0.6 * dt; if (S.wind > 0) { p.vy = Math.max(p.vy, Math.min(p.vy + 6 * dt, 2.2)); S.glide = Math.max(0, S.glide - dt * 2); } }
    }
    if (p.grounded) S.glide = 0;
    if (gliding && !S.wasGlide) setSig('glided'); S.wasGlide = gliding;
    V.glider.visible = !!gOn; if (gOn) { const yw = tq.yaw || 0, up = gliding ? 1.9 : 1.25; V.glider.position.set(tq.x, tq.y + up, tq.z); V.glider.rotation.set(gliding ? -0.12 : 0.25, yw, gliding ? Math.sin(t * 3) * 0.08 : 0); V.glider.scale.setScalar(gliding ? 1 : 0.55); }
    // 🪨 Pebble Sling on Bear's side
    const bid = idOfCls('bruiser'), bq = bid && posOfId(bid), sOn = gearOn('sling') && bq;
    V.sling.visible = !!sOn; if (sOn) { const yw = bq.yaw || 0, sw = t - S.slingT < 0.3 ? -1.2 : 0; V.sling.position.set(bq.x + Math.cos(yw) * 0.95, bq.y + 1.3, bq.z - Math.sin(yw) * 0.95); V.sling.rotation.set(sw, yw, 0.2); }
    // embers: spring dims them (safe to cross), touching a hot patch = gentle soot-puff bonk
    let gustEnd = false;
    for (const em of S.embers) {
      if (em.st === 'out') continue;
      const blown = em.blow && S.wind > 0 && t - S.windFlipT < 6 * TK();
      if (blown && em.blownT !== S.windFlipT) { em.blownT = S.windFlipT; setSig('blown:' + em.id); setSig('safe:' + em.id); tst(`🌬️ Whoosh! The sparks blow off the path — ${Math.round(6 * TK())} seconds, go!`, 2200); ctx.audio?.sample?.('act3/glider-whoosh', 0.45); }
      if (em.blow && S.wind > 0 && t - S.windFlipT >= 6 * TK() && em.blownT === S.windFlipT) gustEnd = true;
      const dim = em.dimSpring && S.season === 'spring'; const want = blown ? 'blown' : dim ? 'dim' : 'hot';
      if (want !== em.st) { em.st = want; setSig('ember:' + em.id + ':hot', want === 'hot'); setSig('ember:' + em.id + ':dim', want === 'dim'); if (want !== 'hot') setSig('safe:' + em.id); if (want === 'dim') setSig('dim:' + em.id); em.disc.material.emissiveIntensity = want === 'hot' ? 0.55 : 0.12; }
      const hot = em.st === 'hot';
      em.sparks.forEach((m, i) => { m.position.y = 0.2 + ((t * (hot ? 0.9 : 0.25) + i * 0.37) % 1) * (hot ? 1.1 : 0.3); m.material.opacity = hot ? 0.95 : 0.3; m.visible = em.st !== 'blown'; });
      if (hot && t > S.safeT && inEmber(em, p, -0.15) && p.y - em.y < 1.2) { bonk({ name: 'ember' }, 'ember'); break; }
    }
    if (gustEnd) { applyWind(-1, true); tst('🌬️ The gust dies down — the sparks drift back. Crank again for another 6 s', 2400); }
    for (const q of S.targets) if (!q.done) q.gem.rotation.y += dt * 1.2;
  }
  function throwTool(kind, tx, tz, from, o = {}) {
    const S = AA(), p = from || ctx.getP(); if (!p) return false;
    const k = kind === 'bubble' ? 'bubble' : 'shiny';
    const bx2 = tx, bz = tz; let by = (ctx.heightAt(tx, tz) || p.y) + 0.4;
    const m = k === 'bubble'
      ? new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.7, emissive: 0x3aa0e8, emissiveIntensity: 0.4 }))
      : new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), mat(0xffe680, 0.7));
    m.position.set(p.x, p.y + 1.1, p.z); group.add(m);
    if (o.ty != null) by = o.ty;
    S.shots.push({ kind: k, m, ax: p.x, ay: p.y + 1.1, az: p.z, bx: bx2, by, bz, x: p.x, y: p.y + 1.1, z: p.z, t: 0, t0: t, dur: o.dur || 0.55, landed: false, dead: false, src: o.src || 'tool' });
    if (!o.src) S.heldTool = null; tst(o.msg || (k === 'bubble' ? '🫧 Bubble shot!' : '✨ Shiny pebble thrown!'), 1200); ctx.audio?.blip?.(3);
    return true;
  }
  function cutWebAt(x, z) {
    const web = props.find(pr => pr.kind === 'web' && !pr.done && Math.hypot(pr.x - x, pr.z - z) < Math.max(2.8, (pr.ww || 2) / 2 + 1.6));
    if (!web) return false;
    web.done = true; if (web.web) { web.web.s.off = true; web.web.G.visible = false; } if (web.icon) web.icon.visible = false; setSig(web.sig);
    tst('🫧 Pop! The bubble cuts the web', 1800); return true;
  }
  function updShots(dt) {
    const S = a2; if (!S) return;
    for (const sh of S.shots) {
      sh.t += dt;
      if (!sh.landed) {
        const k = Math.min(1, sh.t / (sh.dur || 0.55));
        sh.x = sh.ax + (sh.bx - sh.ax) * k; sh.z = sh.az + (sh.bz - sh.az) * k;
        sh.y = sh.ay + (sh.by - sh.ay) * k + Math.sin(k * Math.PI) * 1.8;
        sh.m.position.set(sh.x, sh.y, sh.z);
        if (sh.kind === 'bubble' && cutWebAt(sh.x, sh.z)) { sh.dead = true; continue; }
        if (sh.kind === 'shiny' && sh.src === 'sling' && k > 0.45 && shotLand(sh)) { sh.dead = true; continue; }
        if (k >= 1) { sh.landed = true; sh.t = 0; sh.y = sh.by; sh.m.position.y = sh.y; if (sh.kind === 'bubble') cutWebAt(sh.x, sh.z); if (shotLand(sh)) { sh.dead = true; continue; } }
      } else if (sh.t > 7) sh.dead = true;
    }
    for (let i = S.shots.length - 1; i >= 0; i--) if (S.shots[i].dead) { S.shots[i].m.removeFromParent(); S.shots.splice(i, 1); }
  }
  function updCups(dt) {
    const S = a2; if (!S) return;
    for (const cup of S.cups) {
      let hit = false;
      for (const e of S.en) if (e.kind === 'sprinkler' && !e.paused && inCone(e, cup, e.o.r, e.o.beam, e.sweepYaw ?? e.baseYaw)) hit = true;
      if (hit) cup.amt = Math.min(cup.fill, cup.amt + dt);
      const on = cup.amt >= cup.fill - 0.001;
      if (on !== cup.on) { cup.on = on; setSig(cup.sig, on); if (on) { tst('💦 The cup is full!', 1800); ctx.audio?.chime?.(); } }
      if (cup.water) cup.water.scale.y = 0.08 + 0.92 * (cup.amt / cup.fill);
    }
  }
  function updTools(p, cur) {
    const S = a2; if (!S) return; const c = CLASS_OF[cur];
    for (const tl of S.tools) {
      if (tl.got) continue;
      tl.G.rotation.y += 0.03; tl.G.position.y = tl.y + Math.sin(t * 2) * 0.1;
      if (flatD(tl, p) < 1.7 && Math.abs(p.y - tl.y) < 2 && c === tl.cls) {
        tl.got = true; tl.G.visible = false; S.heldTool = tl.kind;
        setSig('tool:' + tl.kind); tst(tl.kind === 'bubble' ? '🫧 Scooped a practice bubble! Tap Interact to throw it' : '✨ Picked up a shiny pebble! Tap Interact to throw it', 2600);
      }
    }
  }
  function escortAtExit() {
    const S = a2; if (!S || !S.escorts.length || !exitAt) return true;
    return S.escorts.every(b => Math.hypot(b.x - exitAt.x, b.z - exitAt.z) < exitAt.r + 0.6 && Math.abs((b.y || exitAt.y) - exitAt.y) < 3);
  }
  function callEscort() {
    if (ctx.isNetClient?.()) { emitNet('intent', { intent: 'call', body: ctx.cur() }); return true; }
    const S = a2; if (!S || !S.escorts.length) return false;
    const multi = ctx.driven().filter(Boolean).length > 1; const leadBody = multi ? ctx.cur() : null;
    for (const b of S.escorts) { b.called = true; b.following = true; b.hide = false; b.leadBody = leadBody; }
    setSig('called'); tst('📣 Come on, little one! The baby follows you', 2200); ctx.audio?.sample?.('act3/baby-call-chirp', 0.5); setTimeout(() => ctx.audio?.sample?.('act3/baby-follow-happy', 0.45), 420);
    return true;
  }
  function babyInHazard(b, x, z) {
    if (a2 && a2.embers.some(em => em.st === 'hot' && inEmber(em, { x, z }, 0.4))) return 'ember';
    if (a2 && (a2.grates || []).some(g => inRect(x, z, g)) && a2.ponds.some(pd => pd.level === 'mid' || pd.level === 'high')) return 'grate';
    if (!b.info.float && deep.some(r => !r.off && inRect(x, z, r) && (r.y == null || (ctx.heightAt(x, z) ?? b.y ?? 0) < r.y - 0.25))) {
      if (!crossings.some(c => c.on && inRect(x, z, c))) return 'deep';
    }
    return null;
  }
  /** How far inside a hazard (0 = clear). Used so a cub already in water/embers can walk out, but not further in. */
  function babyEscapeDist(b, x, z) {
    let d = 0;
    if (a2) {
      for (const em of a2.embers) if (em.st === 'hot' && inEmber(em, { x, z }, 0.4)) {
        const hw = (em.rect ? em.hw : em.r) + 0.4, hd = (em.rect ? em.hd : em.r) + 0.4;
        d = Math.max(d, Math.min(hw - Math.abs(x - em.x), hd - Math.abs(z - em.z)));
      }
      if (a2.ponds.some(pd => pd.level === 'mid' || pd.level === 'high')) {
        for (const g of (a2.grates || [])) if (inRect(x, z, g)) d = Math.max(d, Math.min(x - g.x0, g.x1 - x, z - g.z0, g.z1 - z));
      }
    }
    if (!b.info.float) {
      for (const r of deep) if (!r.off && inRect(x, z, r) && (r.y == null || (ctx.heightAt(x, z) ?? b.y ?? 0) < r.y - 0.25) && !crossings.some(c => c.on && inRect(x, z, c))) {
        d = Math.max(d, Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z));
      }
    }
    return Math.max(0, d);
  }
  function babyCanStep(b, nx, nz) {
    if (a2) {
      const onCross = crossings.some(c => c.on && inRect(nx, nz, c));
      const pd = a2.ponds.find(q => inRect(nx, nz, q.rect));
      if (pd && !onCross && (b.info.refuseIce || b.kind === 'fawn') && pd.level === 'ice') { if (!sig.fawnRefuse) { setSig('fawnRefuse'); tst(`${b.info.em} The ${b.info.name} won't walk on ice — it needs a clear, unfrozen path`, 2200); } return false; }
      if (pd && !onCross && (b.info.refuseHigh || b.kind === 'fawn') && pd.level === 'high' && !b.info.float) { if (!sig.fawnRefuse) { setSig('fawnRefuse'); tst(`${b.info.em} The ${b.info.name} won't wade a flood — wait for the water to drop`, 2200); } return false; }
    }
    const y0 = ctx.heightAt(b.x, b.z), y1 = ctx.heightAt(nx, nz);
    if (y1 - y0 > 0.85) return false;
    if (y0 - y1 > 1.4) return false;
    const destD = babyEscapeDist(b, nx, nz), curD = babyEscapeDist(b, b.x, b.z);
    if (destD > 0 && destD >= curD - 1e-6) {
      if (curD === 0 && babyInHazard(b, nx, nz) === 'ember' && !sig.cubBlocked) { setSig('cubBlocked'); tst(`${b.info.em} The ${b.info.name} won't step on hot grass — damp it or blow the sparks away`, 2200); }
      return false;
    }
    return true;
  }
  /** A late unstuck snap may not skip hazards, land on the lead, or land on the exit. */
  function babyHazardAt(b, x, z) {
    if (a2 && a2.embers.some(em => em.st === 'hot' && inEmber(em, { x, z }, 0.4))) return true;
    if (a2 && (a2.grates || []).some(g => inRect(x, z, g)) && a2.ponds.some(pd => pd.level === 'mid' || pd.level === 'high')) return true;
    const y = ctx.heightAt(x, z);
    if (!b.info.float && deep.some(r => !r.off && inRect(x, z, r) && (r.y == null || (y == null || y < r.y - 0.25)))) {
      if (!crossings.some(c => c.on && inRect(x, z, c))) return true;
    }
    return false;
  }
  function babyPathClear(b, x1, z1, x2, z2) {
    const dist = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(dist / 0.4));
    for (let i = 1; i <= n; i++) {
      const k = i / n, x = x1 + (x2 - x1) * k, z = z1 + (z2 - z1) * k;
      if (babyHazardAt(b, x, z)) return false;
    }
    return true;
  }
  function babySnapOk(b, x, z, lead) {
    if (babyHazardAt(b, x, z) || !babyPathClear(b, b.x, b.z, x, z)) return false;
    const y0 = ctx.heightAt(b.x, b.z), y1 = ctx.heightAt(x, z);
    if (y1 == null || y1 < baseY - 2 || y1 - y0 > 0.85 || y0 - y1 > 1.4) return false;
    if (lead && Math.hypot(x - lead.x, z - lead.z) < 1.6) return false;
    if (exitAt && Math.hypot(x - exitAt.x, z - exitAt.z) < (exitAt.r || 3) + 0.6) return false;
    return true;
  }
  function babySafeNear(b, tx, tz, lead) {
    const d = Math.hypot(tx - b.x, tz - b.z) || 1, ux = (tx - b.x) / d, uz = (tz - b.z) / d, px = -uz, pz = ux;
    // Prefer the follow target itself (escortGoal may already sit 2.4 m ahead of the player).
    for (const back of [0, 0.8, 1.6, 2.4, 3.2]) for (const side of [0, 0.9, -0.9, 1.6, -1.6]) {
      const x = tx - ux * back + px * side, z = tz - uz * back + pz * side;
      if (babySnapOk(b, x, z, lead)) return { x, z };
    }
    return null;
  }
  function enemyNearBaby(b, r) {
    const S = a2; if (!S) return null;
    for (const e of S.en) {
      const asleep = (e.kind === 'owl' && !owlAwake(S)) || (e.kind === 'turtle' && t < (e.napT || -1)) || e.calm || e.paused || e.o.friendly;
      if (asleep) continue;
      // Baited owl is staring at the lantern. Hide radius (≈6) should not freeze a cub
      // on the far lane; contact range (~1.7) still bonks if they walk under it.
      if (e.kind === 'owl' && e.bait && r > 2) continue;
      if (e.kind === 'fox' && S.season === 'winter') continue; // snow hides scent: the fawn will not hide in Master Bell state A
      if (e.kind === 'fox' && r > 2 && (b.x - A.x) < 6.5) continue; // fox scent stays in the east den; the valley path does not make the fawn hide unprompted
      if (e.kind === 'mower') {
        if (e.paused) continue;
        const mo = e.o, x0 = A.x + Math.min(mo.x0, mo.x1) - 1, x1 = A.x + Math.max(mo.x0, mo.x1) + 1;
        // Lane scare is hide-only (r > 2), not a contact bonk. The parked body sits at x0.
        // Once the baby is north of the blades, the hazard has been passed (holders may leave).
        const past = b.z > e.z + 1.6;
        if (!past && r > 2 && b.x >= x0 && b.x <= x1 && Math.abs(b.z - e.z) < 3.2) return e;
        if (!e.live) continue;
      }
      if (flatD(e, b) < r) return e;
    }
    return null;
  }
  function updEscort(dt, cam, p, cur) {
    const S = a2; if (!S || !S.escorts.length) return;
    const lantern = gearOn('lantern');
    const goal = recipe && recipe.escortGoal;
    for (let i = 0; i < S.escorts.length; i++) {
      const b = S.escorts[i], leadP = (b.leadBody && posOfId(b.leadBody)) || p;
      const leadYg = ctx.heightAt(leadP.x, leadP.z), leadAir = (leadP.y - leadYg) > 1.4;
      const lead = (i > 0 && S.escorts[i - 1].kind === b.kind && S.escorts[i - 1].following) ? S.escorts[i - 1] : leadP;
      if (goal && goal.z != null && (b.z - A.z) >= goal.z) b.atGoal = true;
      const threat = enemyNearBaby(b, 6.2);
      const inCover = hidden(b, 'log') || hidden(b, 'trunk') || hidden(b, 'canopy');
      if (b.following && threat && !inCover) { if (!b.hide) a2.hidEver = true; if (!b.hide) tst(`${b.info.em} The ${b.info.name} hides!`, 1600); b.hide = true; }
      else if (b.hide && !threat) { b.hide = false; ctx.audio?.sample?.('act3/baby-follow-happy', 0.4); }
      const darkOk = !b.info.darkOnly || !lantern || flatD(b, (idOfCls('scout') && posOfId(idOfCls('scout'))) || leadP) > 5.5;
      let spd = 0;
      if (b.following && !b.hide && !leadAir && darkOk) {
        const mates = S.escorts.filter(q => q.kind === b.kind), slot = Math.max(0, mates.indexOf(b));
        const spread = (slot - (mates.length - 1) / 2) * 0.9;
        let tx = lead.x + (lead === leadP ? spread : 0), tz = lead.z;
        const wet = S.ponds.some(pd => pd.level === 'mid' || pd.level === 'high');
        if (goal && goal.z != null && wet && p.z < A.z + goal.z - 0.5) {
          const cap = (S.grates || []).reduce((m, gtr) => Math.min(m, gtr.z0 - 0.2), A.z + goal.z - 0.4);
          tz = Math.min(cap, p.z + 2.4);
        }
        // Once the baby has reached the escort goal, don't follow the lead back
        // through hazards behind it (holders may leave; collect-all teleports the crew).
        if (b.atGoal && goal && goal.z != null) tz = Math.max(tz, A.z + goal.z);
        const d = Math.hypot(tx - b.x, tz - b.z);
        if (d > 0.12) {
          // Walk each frame and honor hazards. Do not teleport onto the lead when d > 4
          // (that stacked cubs, skipped embers, and could warp a leftover cub onto the exit).
          // Far catch-up is a faster walk, never a one-shot teleport. Sub-steps
          // keep ember/grate/height checks honest even if dt or the burst is large.
          const burst = d > 4 ? Math.min(4, 1 + (d - 4) * 0.35) : 1;
          const ux = (tx - b.x) / d, uz = (tz - b.z) / d;
          let remain = Math.min(d, (b.info.speed || 3) * burst * dt);
          const tryStep = (nx, nz) => { if (!babyCanStep(b, nx, nz)) return false; b.x = nx; b.z = nz; b.yaw = Math.atan2(tx - b.x, tz - b.z); spd = b.info.speed; return true; };
          let stepped = false;
          while (remain > 1e-4) {
            const s = Math.min(remain, 0.4);
            if (!tryStep(b.x + ux * s, b.z + uz * s)) break;
            stepped = true; remain -= s;
          }
          if (!stepped) {
            // Walk-speed heading fan: slide around water/embers; never a 1 m sidestep hop.
            const s = Math.min(d, (b.info.speed || 3) * dt);
            for (const ang of [0.5, -0.5, 0.9, -0.9, 1.2, -1.2, 1.57, -1.57]) {
              const c = Math.cos(ang), sA = Math.sin(ang);
              if (tryStep(b.x + (ux * c - uz * sA) * s, b.z + (ux * sA + uz * c) * s)) { stepped = true; break; }
            }
          }
          if (stepped) b.stuckFor = 0;
          else b.stuckFor = (b.stuckFor || 0) + dt;
          if (d > 4) b.lagFor = (b.lagFor || 0) + dt; else b.lagFor = 0;
          // Catch up only after 3 s of lag or being stuck, and only onto a path-clear
          // tile near the follow target — never onto the lead or the exit, never over hazards.
          if ((b.stuckFor || 0) >= 3 || (b.lagFor || 0) >= 3) {
            const snap = babySafeNear(b, tx, tz, p);
            if (snap) { b.x = snap.x; b.z = snap.z; b.yaw = Math.atan2(tx - b.x, tz - b.z); b.stuckFor = 0; b.lagFor = 0; spd = b.info.speed; }
          }
        } else { b.stuckFor = 0; b.lagFor = 0; }
      } else { b.stuckFor = 0; b.lagFor = 0; }
      if (b.info.windblown && S.wind && !b.hide) { b.x += Math.sin(0) * S.wind * 0.4 * dt; b.z += S.wind * 0.5 * dt; }
      // reached by an enemy: contact bonk (cover keeps them safe)
      const hit = !inCover && t > S.safeT && enemyNearBaby(b, 1.7);
      if (hit) { bonk(hit, 'escort'); break; }
      const gyw = ctx.heightAt(b.x, b.z);
      const hop = spd ? Math.abs(Math.sin(t * 8 + b.ph)) * 0.16 : 0;
      const onPd = b.info.float && S.ponds.find(q => q.level !== 'low' && q.level !== 'ice' && inRect(b.x, b.z, q.rect) && !(S.grates || []).some(g => inRect(b.x, b.z, g)));
      b.y = (onPd ? pondSurf(onPd) : gyw) + hop + (b.hide ? -0.12 : 0);
      b.G.position.set(b.x, b.y, b.z); b.G.rotation.y = b.yaw;
      b.G.scale.setScalar((b.info.scale || 1) * (b.hide ? 0.85 : 1));
      const mk = !b.called ? '📣' : b.hide ? '🙈' : (b.following ? '' : '📣');
      _v.set(b.x, b.y + 1.7, b.z).project(cam);
      const on = mk && _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15 && flatD(b, p) < 34;
      b.el.style.display = on ? 'block' : 'none';
      if (on) { b.el.textContent = mk; b.el.className = 'a2Mark q'; b.el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; b.el.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px'; }
    }
    const g = goal || (recipe && recipe.escortGoal);
    if (g && S.escorts.every(b => g.z == null || b.atGoal || (b.z - A.z) >= g.z)) setSig(g.sig || 'escort:goal');
  }
  function a2UpdateBody(dt, cam, p, cur) {
    const S = a2; if (!S) return; const c = CLASS_OF[cur];
    if (recipe && recipe.bellLearnZ != null) {
      const zlim = A.z + recipe.bellLearnZ;
      if (p.z > zlim || ctx.crewIds().some(id => { const q = posOfId(id); return q && q.z > zlim; })) setSig('bellLearn');
    }
    const jump = S._lastP ? flatD(p, S._lastP) : 0;
    const spd = (S._lastDt > 1e-6) ? jump / S._lastDt : 0;
    if (jump > 3) { // a teleport near a flag (armCp) may adopt it; a run-past may not
      for (const cp of S.cps) { if (cp.show && !isOn(cp.show)) continue; if (flatD(cp, p) < 2.55 && Math.abs(p.y - cp.y) < 3.5) cp.armT = t + 2.2; }
    }
    S._lastP = { x: p.x, z: p.z }; S._lastDt = dt;
    for (const cp of S.cps) { if (cp.show) { const vis = isOn(cp.show); cp.G.visible = vis; if (!vis) continue; } if (recipe.splitAt && flatD(cp, p) < 2.2 && Math.abs(p.y - cp.y) < 3) (S.cpBy ||= {})[cur] = cp; const ad = flatD(cp, p); const onPad = ad < 2.2 && Math.abs(p.y - cp.y) < 3; const standOn = ad < 1.15 && Math.abs(p.y - cp.y) < 3; if (standOn && spd < 1.15) cp.stillT = (cp.stillT || 0) + dt; else cp.stillT = 0; const fwd = !S.cp || S.cps.indexOf(cp) > S.cps.indexOf(S.cp); const take = (onPad && !cp.on && fwd) || (onPad && cp.armT && t < cp.armT) || (standOn && cp.stillT > 0.3); if (take && S.cp !== cp) { S.cp = cp; for (const b of S.escorts || []) b.home = { x: cp.x, y: cp.y, z: cp.z }; } if (onPad && !cp.on) { cp.on = true; cp.f.material = mat(0xff5a5a, 0.5); emitNet('checkpoint', { x: +(cp.x - A.x).toFixed(2), z: +(cp.z - A.z).toFixed(2) }); tst('🚩 Checkpoint! A bonk brings you back here', 1600); ctx.audio?.sample?.('build/upgrade-sparkle', 0.35); } cp.rg.userData.mats[0].color.setHex(S.cp === cp ? 0xffd23f : cp.on ? 0xff8a8a : 0xffffff); cp.f.rotation.y = Math.sin(t * 2 + cp.x) * 0.3; }
    if (cur === host.cur()) flagBackUpd(S, p, cur);
    if (S.stuck) { if (t > S.stuck.until || !ctx.driven().includes(S.stuck.who)) S.stuck = null; else if (S.stuck.who === cur) { p.x = S.stuck.x; p.z = S.stuck.z; p.y = S.stuck.y; p.vx = p.vz = p.vy = 0; } }
    for (const d of S.drips) { if (c === 'scout' && !S.dew && flatD(d, p) < 1.8 && Math.abs(p.y - d.y) < 2.4) { S.dew = { who: cur, m: new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0x7fd8ff, 0.8)) }; group.add(S.dew.m); tst('💧 Got a dewdrop! Bring it to a planted seed', 1800); } }
    for (const sd of S.seeds) {
      if (sd.planted && !sd.grown && S.dew && S.dew.who === cur && flatD(sd, p) < 2.0 && Math.abs(p.y - sd.y) < 3) { S.dew.m.removeFromParent(); S.dew = null; growSeed(sd); }
    }
    for (const sd of S.pads) { if (!sd.grown) continue; const pd = sd.pad; if (flatD(pd, p) < 1.3 && Math.abs(p.y - pd.y) < 0.6 && p.vy <= 0.1 && !tw) { if (c === 'bruiser' && pd.to) { tween(p, { x: pd.to.x, y: pd.to.y + 0.4, z: pd.to.z }, 1.0, 3.2); tst('🍄 BOING! Bear bounces sky-high!', 1600); } p.vy = pd.v[c] || 14; p.grounded = false; p.y = pd.y + 0.1; p._gY = -1e9; fx(pd.x, pd.y, pd.z); ctx.audio?.blip?.(5); pd.P.scale.y = 0.6; if (c === 'bruiser') setSig('bounce:' + sd.id); } }
    for (const w of S.winds) {
      const inZ = p.x > w.x0 && p.x < w.x1 && p.z > w.z0 && p.z < w.z1;
      const wv = windVec(w);
      if (inZ && !p.grounded && c !== 'bruiser') { p.x += wv.dx * w.push * dt; p.z += wv.dz * w.push * dt; if (S.wind > 0 && w.lift) p.vy = Math.max(p.vy, Math.min(p.vy + w.lift * dt, 4)); }
      // thaw_valley (recipe.windWalk): a north wind also nudges grounded walkers up the valley
      if (inZ && p.grounded && recipe && recipe.windWalk && S.wind) { p.x += wv.dx * w.push * 0.28 * dt; p.z += wv.dz * w.push * 0.28 * dt; }
    }
    if (S.cp && S.safeT && t < S.safeT && cur === S.safeWho) { // settle on the flag after a poof; a held walk key must not run off it
      p.vx = p.vz = p.vy = 0; p.grounded = true;
      const pin = { x: S.cp.x + 0.6, z: S.cp.z - 0.6 };
      if (flatD(p, pin) < 4.5) { p.x = pin.x; p.z = pin.z; p.y = S.cp.y + 0.8; } // a teleport farther away must stick
    }
    for (const gf of S.gifts) { if (gf.got) continue; if (flatD(gf, p) < 1.8 && Math.abs(p.y - gf.y) < 2.2) { gf.got = true; gf.G.visible = false; const GI = GEAR_INFO[gf.kind], gc = GI.cls; gear[gf.kind] = true; gear[eqK(gf.kind)] = true; (gear.slot ||= {})[gc] = gf.kind; if (S.borrow && S.borrow.slot) S.borrow.slot[gc] = gf.kind; gearSave(); if (gf.kind === 'whistle') S.pingNext = t; setSig('gift:' + gf.kind); if (ALIAS_OF[gf.kind]) setSig('gift:' + ALIAS_OF[gf.kind]); ctx.onGear?.(); ctx.audio?.music?.jingle?.('stage') || ctx.audio?.chime?.(); tst(`${GI.em} You found the ${GI.name}! Tap ${GI.em} on the ${CLASSES[gc].name}'s picture (or G) to switch it on/off${GEAR_BY_CLS[gc].length > 1 ? ' · swap gear at a 🧰 gear stump' : ''}`, 4200); } }
    for (const pr of props) if (pr.kind === 'web' && !pr.done && c === 'scout' && !S.stuck && t > S.safeT && Math.abs(p.x - pr.x) < pr.ww / 2 + 0.6 && Math.abs(p.z - pr.z) < 1.3 && p.y - pr.y < pr.wh) { S.stuck = { who: cur, x: p.x, y: p.y, z: p.z, until: t + 3 }; if (pr.spider) pr.spider.look = { x: pr.x, z: pr.z, until: t + 3.5 }; tst('🕸️ Stuck in the web for 3 seconds!', 1800); }
  }
  function a2Update(dt, cam, p, cur) {

    const S = a2; if (!S) return; const c = CLASS_OF[cur], ids = ctx.crewIds();
    // split start: place the crew in their own areas
    if (recipe.splitAt && !S.splitDone && t > 0.05) { S.splitDone = true; for (const k of ['scout', 'trickster', 'bruiser']) { const id = idOfCls(k), q = id && posOfId(id), at = recipe.splitAt[k]; if (!q || !at) continue; q.x = A.x + at[0]; q.z = A.z + at[1]; q.y = gy(at[0], at[1]) + (at[2] || 0) + 0.6; q.vx = q.vy = q.vz = 0; q._safe = { x: q.x, z: q.z }; q.goto = null; } }
    if (S.lastCur !== cur) { if (S.lastCur && recipe.splitAt) { ctx.swoop?.(); tst('💨 Swoosh!', 700); ctx.audio?.sample?.('ui/select-pop', 0.3); } S.lastCur = cur; }
    // movers (parked-body tweens: raft launches)
    for (let i = S.movers.length - 1; i >= 0; i--) { const mv = S.movers[i]; mv.t += dt; const k = Math.min(1, mv.t / mv.d), e = k * k * (3 - 2 * k); const q = mv.q; q.x = mv.a.x + (mv.b.x - mv.a.x) * e; q.z = mv.a.z + (mv.b.z - mv.a.z) * e; q.y = mv.a.y + (mv.b.y - mv.a.y) * e + Math.sin(k * Math.PI) * mv.arc; q.vx = q.vz = q.vy = 0; q._safe = { x: q.x, z: q.z }; if (k >= 1) { S.movers.splice(i, 1); mv.done?.(); } }
    // checkpoints / stuck / body-local interactions run in a2UpdateBody
    // ---- light & shadow ----
    if (S.srcs.length) {
      let n = 0; const lit = new Set(), shade = new Set();
      const bear = idOfCls('bruiser'), bq = bear && posOfId(bear);
      const checkShade = (sh) => { if (sh && bq && Math.hypot(bq.x - A.x - sh[0], bq.z - A.z - sh[1]) < (sh[2] || 1.6)) shade.add(sh[3]); };
      for (const s of S.srcs) {
        const on = isOn(s.need); s.cr.material = mat(on ? 0xffe680 : 0x8a8060, on ? 0.95 : 0.1); if (!on) continue;
        let from = s, to = s.to, hops = 0; checkShade(s.shade);
        while (to && hops++ < 6) {
          const m = typeof to === 'string' ? S.mirrors.find(q => q.id === to) : null;
          if (m) { beamSeg(n++, from, m); const aim = m.aims[m.k]; if (!aim) break; if (aim.shade) checkShade(aim.shade); if (aim.lights) lit.add(aim.lights); from = m; if (typeof aim.to === 'string') { to = aim.to; continue; } if (aim.pt) beamSeg(n++, m, aim.pt); break; }
          else if (Array.isArray(to)) { beamSeg(n++, from, L2W(to[0], to[1], to[2] ?? 0.5)); if (s.lights) lit.add(s.lights); break; } else break;
        }
      }
      for (let i = n; i < S.beamPool.length; i++) S.beamPool[i].visible = false;
      for (const g of S.ghosts) { const want = g.shadow ? shade.has(g.id) : lit.has(g.id); if (want !== g.on) { g.on = want; g.r.s.off = !want; if (g.cr) g.cr.on = want; g.r.m.material.opacity = want ? (g.shadow ? 0.95 : 0.72) : 0.25; g.r.m.material.depthWrite = want; g.r.m.material.emissiveIntensity = g.shadow ? (want ? 0.6 : 0.3) : 0.45; if (want) { fx(g.r.m.position.x, g.r.m.position.y, g.r.m.position.z); tst(g.shadow ? '🌑 Bear\'s shadow made the bridge solid!' : '✨ The sunbeam made the ghost step solid!', 1500); } } setSig(g.sig, want); }
    }
    // ---- water level: logs + turtle naps handled in enemies ----
    for (const L of S.logs) {
      const pd = S.ponds.find(q => q.id === L.pond);
      const afloat = pd && pd.level !== 'low' && pd.level !== 'ice' && (!L.season || S.season === L.season);
      const rideOK = afloat && (L.season ? pd.level === 'mid' : pd.level === 'high');
      const y = pd ? (afloat ? pondSurf(pd) : pd.gy - 0.6) : L.a.y; const bid = idOfCls('bruiser'), bq = bid && posOfId(bid);
      const onIt = q => q && Math.abs(q.x - L.x) < L.wd / 2 + 0.2 && Math.abs(q.z - L.z) < L.dd / 2 + 0.2 && Math.abs(q.y - (y + 0.35)) < 0.8;
      if (rideOK && onIt(bq) && L.k < 1) { const old = { x: L.x, z: L.z }; L.k = Math.min(1, L.k + dt / (Math.hypot(L.b.x - L.a.x, L.b.z - L.a.z) / 2.2)); L.x = L.a.x + (L.b.x - L.a.x) * L.k; L.z = L.a.z + (L.b.z - L.a.z) * L.k; for (const id of ids) { const q = posOfId(id); if (onIt(q)) { q.x += L.x - old.x; q.z += L.z - old.z; q._safe = { x: q.x, z: q.z }; } } if (L.k >= 1 && !L.arrived) { L.arrived = true; setSig('log:' + L.id); tst('🪵 The log floated across!', 1600); } }
      L.m.position.set(L.x, y, L.z); L.s.x = L.x; L.s.z = L.z; L.s.top = y + 0.35; L.s.y0 = y - 1; L.s.off = !afloat;
      L.cr.on = afloat; L.cr.x0 = L.x - L.wd / 2 - 0.3; L.cr.x1 = L.x + L.wd / 2 + 0.3; L.cr.z0 = L.z - L.dd / 2 - 0.3; L.cr.z1 = L.z + L.dd / 2 + 0.3;
    }
    // ---- waterwheels ----
    for (const wh of S.wheels || []) { if (sig[wh.spin]) wh.G.rotation.z += dt * 0.7; }
    // ---- seeds: dew carry + growing + mushroom bounce ----
    for (const d of S.drips) { d.d.position.y = -0.4 - ((t * 0.6) % 1) * 0.3; }
    if (S.dew) { const q = posOfId(S.dew.who); if (q) S.dew.m.position.set(q.x, q.y + 1.4 + Math.sin(t * 4) * 0.1, q.z); }
    for (const sd of S.seeds) {
      if (sd.vine && sd.grown) sd.vine.leaves.forEach((l, i) => { l.scale.setScalar(Math.min(1, (l.userData.g = (l.userData.g || 0) + dt * 2) - i * 0.12) || 0.001); });
    }
    for (const sd of S.pads) { if (!sd.grown) continue; const pd = sd.pad; pd.P.scale.y += (1 - pd.P.scale.y) * Math.min(1, dt * 6); }
    // ---- wind ----
    for (const w of S.winds) {
      const wv = windVec(w);
      const pos = w.pts.geometry.attributes.position;
      if (w.alt) { w.seeds.forEach((s, i) => { s.u = (s.u + dt * 0.3 * wv.dx + 1) % 1; s.v = (s.v + dt * 0.3 * wv.dz * (w.x1 - w.x0) / Math.max(1, w.z1 - w.z0) + 1) % 1; pos.setXYZ(i, w.x0 + s.u * (w.x1 - w.x0), w.gy + s.h, w.z0 + s.v * (w.z1 - w.z0)); }); pos.needsUpdate = true; continue; }
      w.seeds.forEach((s, i) => { s.u = (s.u + dt * 0.3 * S.wind + 1) % 1; const along = w.dz !== 0, fz = along ? s.u : s.v, fxx = along ? s.v : s.u; pos.setXYZ(i, w.x0 + fxx * (w.x1 - w.x0), w.gy + s.h, w.z0 + fz * (w.z1 - w.z0)); }); pos.needsUpdate = true;
    }
    for (const pf of S.puffs) {
      const bid = idOfCls('bruiser'), tid = idOfCls('trickster'), bq = bid && posOfId(bid), tq = tid && posOfId(tid);
      const held = bq && flatD(bq, pf) < 1.7 && Math.abs(bq.y - pf.y) < 1.4, on = tq && flatD(tq, pf) < 1.5 && tq.y > pf.y + 0.2 && Math.abs(tq.y - pf.y) < 1.6;
      setSig('raftHold:' + pf.id, held);
      pf.G.position.y = pf.y + (held ? 0 : Math.sin(t * 3) * 0.12);
      if (!pf.used && on && !held && S.wind > 0) { pf.used = true; setSig('raft:' + pf.id); tst('🌬️ Whoosh! The dandelion raft floats up!', 2000); const to = { x: pf.top.x, y: pf.top.y + 0.6, z: pf.top.z }; if (tid === cur) tween(p, to, 1.6, 2.5); else moveTween(tq, to, 1.6, 2.5); }
      else if (!pf.used && on && !held && S.wind < 0 && t - (pf.hintT || -9) > 4) { pf.hintT = t; say('🌬️ The wind blows down the hill — crank the vane so it blows UP', 2200); }
    }
    // ---- carry chain ----
    for (const ac of S.acorns || []) {
      const carrier = ac.by && posOfId(ac.by);
      if (carrier) ac.m.position.set(carrier.x, carrier.y + 2.0 + Math.sin(t * 4) * 0.08, carrier.z); else { const R = ac.rings[ac.at]; if (R) ac.m.position.set(R.w.x, R.w.y + 0.8 + Math.sin(t * 2) * 0.12, R.w.z); }
      ac.m.rotation.y += dt * 1.5;
      if (ac.timed && !ac.by && !ac.home && ac.at !== ac.last && t - ac.dropT > ac.win * EZ('acorn') && ac.dropT > 0) { ac.at = ac.last; ac.dropT = -99; tst(`${ac.em || '🌰'} Too slow — the ${ac.noun || 'acorn'} floated back. Have the next friend waiting!`, 2200); }
      for (const R of ac.rings) {
        const pr = R.pr, here = ac.at === R.i && !ac.by;
        if (here && !ac.home && !R.home) { pr.act = 'pick'; pr.cls = R.who; }
        else if (ac.by && ac.at !== R.i && !(R.home && ac.home)) { pr.act = 'drop'; pr.cls = CLASS_OF[ac.by]; if (R.home && CLASS_OF[ac.by] !== (R.homeBy || 'bruiser')) pr.act = null; }
        else if (R.home && !ac.home && !ac.by && ac.at >= 0) { pr.act = 'drop'; pr.cls = R.homeBy || 'bruiser'; }
        else pr.act = null;
        const glow = here && ac.timed && t - ac.dropT < ac.win * EZ('acorn') ? 0.6 + 0.4 * Math.sin(t * 10) : here ? 0.9 : ac.by ? 0.55 : 0.25;
        R.rg.userData.mats[0].opacity = glow; R.rg.userData.mats[1].opacity = glow * 0.3; pr.icon.visible = !!pr.act;
      }
    }
    // ---- smoke ----
    for (let i = S.smokes.length - 1; i >= 0; i--) { const s = S.smokes[i], left = s.until - t; s.m.children.forEach((b, k) => { b.material.opacity = Math.max(0, Math.min(0.45, left * 0.2)); b.position.y = 0.8 + (k % 3) * 0.6 + Math.sin(t * 2 + k) * 0.15; }); if (left <= 0) { s.m.removeFromParent(); S.smokes.splice(i, 1); } }
    applyLoan();
    // ---- night gear ----
    const sid = idOfCls('scout'), sq = sid && posOfId(sid), lantern = gearOn('lantern') && sq;
    if (lantern) { if (!S.light) { S.light = new THREE.PointLight(0xffd27a, 3, 12); group.add(S.light); } S.light.intensity = 3; S.light.position.set(sq.x, sq.y + 1.6, sq.z); } else if (S.light) S.light.intensity = 0;
    for (const gs of S.glowSteps) { const want = !!lantern && flatD(gs, sq) < 6.5; if (want !== gs.on) { gs.on = want; gs.r.s.off = !want; } gs.r.m.material.opacity += ((gs.on ? 0.85 : 0) - gs.r.m.material.opacity) * Math.min(1, dt * 6); }
    const tid = idOfCls('trickster'), tq = tid && posOfId(tid);
    if (gearOn('whistle') && tq && ctx.driven().includes(tid) && t >= S.pingNext) { S.pingNext = t + 8; S.pingT = t; S.pingAt = { x: tq.x, z: tq.z, t }; a2Burst(tq.x, tq.z, 7); ctx.audio?.sample?.('ui2/item-produced', 0.4); const ring = ringMesh(1, 0xc9b6ff); ring.position.set(tq.x, tq.y + 0.2, tq.z); group.add(ring); S.outlines.push({ m: ring, t0: t });
      let found = 0; for (const h of S.hidden) { if (Math.hypot(h.x - tq.x, h.z - tq.z) > (h.range || 16)) continue; h.showT = t; if (h.kind === 'switch' && !h.pr.found) { h.pr.found = true; h.pr.act = h.pr._act; h.pr.G.visible = true; h.pr.icon.visible = true; found++; } }
      tst(found ? '🎶 Echo-ping! A hidden switch appeared' : '🎶 Echo-ping! Hidden paths glow for 5 s', 1600); setSig('ping'); }
    for (const h of S.hidden) if (h.kind === 'step') { const on = t - (h.showT ?? -99) < 5; h.r.m.material.opacity = on ? 0.55 + 0.25 * Math.sin(t * 6) : 0; }
    for (let i = S.outlines.length - 1; i >= 0; i--) { const o = S.outlines[i], k = (t - o.t0) / 1.2; o.m.scale.set(1 + k * 14, 1, 1 + k * 14); o.m.userData.mats[0].opacity = Math.max(0, 0.8 * (1 - k)); if (k >= 1) { o.m.removeFromParent(); S.outlines.splice(i, 1); } }
    for (const gf of S.gifts) { if (gf.got) continue; if (!still()) { gf.G.rotation.y += dt; gf.G.position.y = gf.y + Math.sin(t * 2) * 0.15; } }
    // webs: body stick is in a2UpdateBody
    updGear(dt, p, cur, c);
    updEnemies(dt, cam, p, cur);
    updShots(dt);
    updCups(dt);
    updTools(p, cur);
    updEscort(dt, cam, p, cur);
  }
  B.web = function (s, x, z, w, h, o = {}) { const r = this.wall(x, z, w, 0.4, h, { c: 0xffffff }); r.m.material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }); const G = new THREE.Group(); G.add(r.m); group.add(G);
    for (let i = 0; i < 6; i++) { const l = bx(w * 1.05, 0.06, 0.06, 0xffffff, A.x + x, r.g + 0.3 + i * h / 6, A.z + z, 0.3); G.add(l); const l2 = bx(0.06, h, 0.06, 0xffffff, A.x + x - w / 2 + i * w / 5, r.g + h / 2, A.z + z, 0.3); G.add(l2); }
    const pr = { kind: 'web', act: 'cut', cls: 'trickster', sig: s, x: A.x + x, y: r.g, z: A.z + z, r: 2.6, ww: w, wh: h, label: o.label || 'Spider web', web: { s: r.s, G }, spider: o.spider ? AA().en.find(e => e.id === o.spider) : null, icon: badge('trickster', A.x + x, r.g + h + 0.8, A.z + z, 0.9) };
    if (pr.spider) pr.spider.watch = { x: pr.x, z: pr.z }; props.push(pr); };
  B.strand = function (spiderId, x, z, o = {}) { const w = L2W(x, z), G = new THREE.Group(); G.position.set(w.x, w.y, w.z); group.add(G); G.add(bx(0.2, 2.6, 0.2, 0x8b6a45, 0, 1.3, 0), bx(0.05, 2.4, 0.05, 0xffffff, 0.3, 1.4, 0, 0.5));
    props.push({ kind: 'strand', act: 'pluck', cls: 'trickster', sig: 'pluck:' + spiderId, x: w.x, y: w.y, z: w.z, r: 2.2, re: true, label: o.label || 'Web strand', spider: AA().en.find(e => e.id === spiderId), G, icon: badge('trickster', w.x, w.y + 3.2, w.z, 0.9) }); };
  // POLISH (level-audit P1.3/P1.4): after a long fall below the active 🚩 flag (non-flyers), offer a one-tap hop back up so a kid
  // doesn't re-climb the whole ledge. Optional: it never moves anyone on its own.
  let flagBtn = null;
  function flagBackUpd(S, p, cur) {
    if (!S.cp || CLASS_OF[cur] === 'scout' || recipe.kid) { if (S.fallTop != null) S.fallTop = null; return; }
    if (!p.grounded) { S.fallTop = Math.max(S.fallTop ?? p.y, p.y); return; }
    if (S.fallTop != null && S.fallTop - p.y > 3 && S.cp.y - p.y > 2.5 && flatD(S.cp, p) < 30) showFlagBack(S);
    S.fallTop = null;
    if (flagBtn && flagBtn.style.display !== 'none' && (t > S.flagT || p.y > S.cp.y - 1)) flagBtn.style.display = 'none';
  }
  function showFlagBack(S) {
    if (!flagBtn) { flagBtn = document.createElement('button'); flagBtn.id = 'bFlag'; flagBtn.type = 'button'; flagBtn.textContent = '🚩 Back to flag'; document.body.appendChild(flagBtn);
      flagBtn.addEventListener('pointerup', e => { e.stopPropagation(); flagBack(); }); flagBtn.addEventListener('click', e => e.stopPropagation()); }
    S.flagT = t + 8; flagBtn.style.display = 'block';
  }
  function flagBack() { const S = a2; if (!S || !S.cp) return false; const p = ctx.getP(); warpTo(p, S.cp, 0.6, -0.6); fx(p.x, p.y + 0.6, p.z); if (flagBtn) flagBtn.style.display = 'none'; tst('🚩 Hop! Back up at your flag', 1400); return true; }
  function a2Clear() { const hadMaster = !!(a2 && a2.master); if (flagBtn) flagBtn.style.display = 'none'; if (a2) { for (const e of a2.en) e.el.remove(); for (const b of a2.escorts || []) b.el?.remove(); } a2 = null; sneak = false; document.body.classList.remove('a2', 'hasEscort'); ctx.onSneak?.(false); if (hadMaster) ctx.holdClock?.(false); }

  /** Lush leafy frame outside the play rect — instanced blocky trees/bushes (phone-cheap). */
  function buildLeafyBackdrop(bounds) {
    const { x0, x1, z0, z1 } = bounds, pad = 2.8, band = 22;
    const greens = [0x3f8a35, 0x4f9a3e, 0x5fae4a, 0x2f6a28, 0x6ab84f, 0x458a3a];
    const barkC = [0x6b4a30, 0x5a3b22, 0x8a5a2b];
    const flowerC = [0xffd23f, 0xff6bd6, 0xff8a1f, 0x4aa8ff, 0xff5a5a];
    const N = 110, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Col = new THREE.Color();
    const mk = (geo, n) => {
      const mat0 = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const im = new THREE.InstancedMesh(geo, mat0, n);
      im.frustumCulled = false;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      return im;
    };
    const trunk = mk(new THREE.BoxGeometry(1, 1, 1), N);
    const canopy = mk(new THREE.BoxGeometry(1, 1, 1), N * 2);
    const bush = mk(new THREE.BoxGeometry(1, 1, 1), N);
    const flower = mk(new THREE.BoxGeometry(1, 1, 1), Math.floor(N * 0.55));
    const setC = (im, i, hex) => { Col.setHex(hex); im.setColorAt(i, Col); };
    let ti = 0, ci = 0, bi = 0, fi = 0;
    const rng = (s) => { const x = Math.sin(s * 127.1 + A.x * 0.013 + A.z * 0.019) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < N; i++) {
      const side = i % 4, u = rng(i * 3.1), v = rng(i * 7.7), depth = pad + v * band;
      let lx, lz;
      if (side === 0) { lx = x0 - depth; lz = z0 + u * (z1 - z0); }
      else if (side === 1) { lx = x1 + depth; lz = z0 + u * (z1 - z0); }
      else if (side === 2) { lx = x0 + u * (x1 - x0); lz = z0 - depth; }
      else { lx = x0 + u * (x1 - x0); lz = z1 + depth; }
      lx += (rng(i * 11.3) - 0.5) * 2.2; lz += (rng(i * 13.7) - 0.5) * 2.2;
      const g = gy(lx, lz), s = 0.75 + rng(i * 19.1) * 1.15, kind = rng(i * 5.5);
      if (kind < 0.7 && ti < N) {
        const th = (2.2 + rng(i * 2.2) * 2.8) * s, tw = (0.35 + rng(i * 4.4) * 0.25) * s;
        P.set(A.x + lx, g + th / 2, A.z + lz); S.set(tw, th, tw); Q.identity(); M.compose(P, Q, S); trunk.setMatrixAt(ti, M); setC(trunk, ti, barkC[i % barkC.length]); ti++;
        const layers = 1 + (rng(i * 9.9) > 0.4 ? 1 : 0);
        for (let L = 0; L < layers && ci < canopy.count; L++) {
          const cw = (2.2 + rng(i * 6.6 + L) * 1.8) * s, ch = (1.4 + rng(i * 8.8 + L) * 1.2) * s;
          P.set(A.x + lx + (rng(i + L * 3) - 0.5) * 0.4 * s, g + th + ch * 0.35 + L * ch * 0.55, A.z + lz + (rng(i + L * 5) - 0.5) * 0.4 * s);
          S.set(cw, ch, cw); M.compose(P, Q, S); canopy.setMatrixAt(ci, M); setC(canopy, ci, greens[(i + L) % greens.length]); ci++;
        }
      } else if (bi < N) {
        const bw = (1.6 + rng(i * 3.3) * 1.8) * s, bh = (0.9 + rng(i * 4.1) * 1.1) * s, bd = (1.4 + rng(i * 5.2) * 1.4) * s;
        P.set(A.x + lx, g + bh / 2, A.z + lz); S.set(bw, bh, bd); M.compose(P, Q, S); bush.setMatrixAt(bi, M); setC(bush, bi, greens[i % greens.length]); bi++;
      }
      if (rng(i * 17.1) > 0.5 && fi < flower.count) {
        const fh = 0.28 + rng(i * 21) * 0.4;
        P.set(A.x + lx + (rng(i * 23) - 0.5) * 1.8, g + fh / 2 + 0.05, A.z + lz + (rng(i * 29) - 0.5) * 1.8);
        S.set(fh, fh, fh); M.compose(P, Q, S); flower.setMatrixAt(fi, M); setC(flower, fi, flowerC[i % flowerC.length]); fi++;
      }
    }
    trunk.count = ti; canopy.count = ci; bush.count = bi; flower.count = fi;
    for (const im of [trunk, canopy, bush, flower]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; group.add(im); }
  }
  function tst(s, d) { if (recipe && recipe.kid) return; ctx.toast(s, d); emitNet('toast', { text: s, ms: d }); }
  // ---- Pip kid tips (Fern act2-kid-tips.md / act3 sheets): recipe.pip = [[trigger | [triggers], line], …] ----
  // triggers: 'start' · 'z:N' (cross local z) · 'xlt:N' (go west of x) · 'sig:K' / 'sig:K+3' (3 s later) · 'near:KIND[:R]' (enemy or prop kind) · 'stuck:PUZZLE'
  let pipDone = new Set(), pipPend = null, pipSigT = {};
  function pipSay(line) { msgT = t; tst(`🐦 Pip: ${line}`, 3800); }
  function pipStuck(pid) { const L = recipe.pip || []; for (let i = 0; i < L.length; i++) { const tr = [].concat(L[i][0]); if (tr.includes('stuck:' + pid) && !pipDone.has(i)) { pipDone.add(i); return L[i][1]; } } return null; }
  function pipFires(tr, p) {
    if (tr === 'start') return t > 0.5;
    const [k, a, b] = tr.split(':');
    const lx = p.x - A.x, lz = p.z - A.z;
    if (k === 'z') return lz > +a; if (k === 'xlt') return lx < +a;
    if (k === 'sig') { const m = tr.slice(4).match(/^(.*?)(\+(\d+(?:\.\d+)?))?$/), key = m[1], dl = +(m[3] || 0); if (!sig[key]) return false; if (pipSigT[key] == null) pipSigT[key] = t; return t - pipSigT[key] >= dl; }
    if (k === 'carry') { const R = +(b || 6.5); return !!(a2 && a2.acorn && a2.acorn.by) && a2.en.some(e => e.kind === a && flatD(e, p) < R); }
    if (k === 'near') { const R = +(b || 10); if (a2 && a2.en.some(e => e.kind === a && flatD(e, p) < R)) return true; return props.some(q => q.kind === a && !q.done && flatD(q, p) < R); }
    return false;
  }
  function pipUpdate(p) {
    const L = recipe.pip; if (!L || recipe.kid || keyDone) return;
    for (let i = 0; i < L.length; i++) { if (pipDone.has(i)) continue; const tr = [].concat(L[i][0]); if (tr.every(x => x.startsWith('stuck:'))) continue; if (tr.some(x => !x.startsWith('stuck:') && pipFires(x, p))) { pipDone.add(i); pipPend = L[i][1]; } } // two at once: keep the later one
    if (pipPend && !introQ.length && t - msgT > 3.2) { pipSay(pipPend); pipPend = null; lastProg = Math.max(lastProg, t - 20); }
  }
  const say = (s, d = 2200) => { if (t - msgT > 1.6) { msgT = t; tst(s, d); } };
  function clear() {
    setCaveLevel(false);
    WATER_RECTS.length = 0; setZoneHeight(null);
    sampleH = null; waterMeshes = []; caveChunks = [];
    for (const s of solids) s.off = true;
    solids = []; picks = []; hoops = []; nightDews = []; star = null;
    fades = []; objCache = null; nearOwn = null; hlT = 0; if (objEl) { objEl.T.style.display = 'none'; objEl.Ar.style.display = 'none'; objEl.key = ''; } document.body.classList.remove('intReady'); syncObjH();
    sig = {}; props = []; gates = []; plates = []; puzzles = []; deep = []; crossings = []; steps = []; tw = null; bearPad = null; introQ = [];
    for (const n of nodes) n.label.remove(); nodes = [];
    instWalls = []; decoJobs = new Map(); camRooms = []; caveChunks = []; for (const rec of atlasInsts) { const im = rec.im || rec; if (im.parent) im.parent.remove(im); } atlasInsts = [];
    while (group.children.length) { const c = group.children.pop(); c.traverse?.(o => o.geometry?.dispose?.()); }
    icons.reset();
    tutorI = 0; tutorT = -99; endLines = []; result = null;
    for (const h of hubPads) h.el.remove(); hubPads = []; hubFr = []; document.body.classList.remove('inHub');
    if (exitLabel) exitLabel.remove(); exitAt = null; exitOpen = false; exitMesh = null; exitLabel = null; starGot = false;
    kidClear(); a2Clear(); terrMesh = null;
    ctx.audio?.levelAmb?.(null);
    ctx.look?.setPatch?.(null);
    id = null; recipe = null; nightOn = false; dewPulseT = -99; nodesDone = 0; keyDew = 0;
  }
  function decodeNormAttr(src) {
    const dst = new Float32Array(src.length);
    let max = 0, signed = false;
    if (src instanceof Int8Array) { max = 127; signed = true; }
    else if (src instanceof Int16Array) { max = 32767; signed = true; }
    else if (src instanceof Int32Array) { max = 2147483647; signed = true; }
    else if (src instanceof Uint8Array || src instanceof Uint8ClampedArray) { max = 255; }
    else if (src instanceof Uint16Array) { max = 65535; }
    else if (src instanceof Uint32Array) { max = 4294967295; }
    else { dst.set(src); return dst; }
    if (signed) { for (let i = 0; i < src.length; i++) dst[i] = Math.max(src[i] / max, -1); }
    else { for (let i = 0; i < src.length; i++) dst[i] = src[i] / max; }
    return dst;
  }
  function asFloat32Attr(g, name) {
    const attr = g.attributes[name];
    if (!attr || !attr.array) return;
    const src = attr.array;
    // Already a plain Float32 (normalized=false) — the merge target.
    if (src instanceof Float32Array && !attr.normalized) return;
    const packed = attr.normalized && !(src instanceof Float32Array) && !(src instanceof Float64Array);
    const dst = packed ? decodeNormAttr(src) : (src instanceof Float32Array ? src : new Float32Array(src));
    g.setAttribute(name, new THREE.BufferAttribute(dst, attr.itemSize, false));
  }
  function normCaveGeo(g) {
    // All step-1 band geos must share index presence, Float32 attrs, and the same
    // BufferAttribute.normalized flag so mergeGeometries / mergeAttributes stay quiet.
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.attributes.normal && g.attributes.position) g.computeVertexNormals();
    if (!g.attributes.uv && g.attributes.position) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    asFloat32Attr(g, 'position'); asFloat32Attr(g, 'normal'); asFloat32Attr(g, 'uv');
    if (g.morphAttributes) g.morphAttributes = {};
    if (g.clearGroups) g.clearGroups();
    return g;
  }
  function tryMergeCaveGeos(geos) {
    if (!geos.length) return null;
    if (geos.length === 1) return geos[0];
    try { return mergeGeos(geos, false) || null; } catch (e) { return null; }
  }
  function caveMatKey(mat) {
    const c = mat.color && mat.color.getHex ? mat.color.getHex() : 0;
    const e = mat.emissive && mat.emissive.getHex ? mat.emissive.getHex() : 0;
    const ei = (mat.emissiveIntensity || 0).toFixed(3);
    return [c, e, ei, mat.map ? mat.map.uuid : '', +!!mat.vertexColors, +!!mat.transparent, (mat.opacity ?? 1).toFixed(3), mat.side || 0, mat.blending || 1].join('|');
  }
  function mergeCaveStatics() {
    if (!(recipe && recipe.caveFloor)) return;
    const skip = new Set();
    const mark = (o) => { if (!o) return; skip.add(o); o.traverse?.(c => skip.add(c)); };
    // Keep live / animated bits out of the merge (rotating mirrors, levers, webs, pickups,
    // ghosts, creatures). Static prop shells (stumps, lamp posts, hide logs) do merge.
    for (const pr of props) {
      mark(pr.icon);
      if (pr.act === 'aim' && pr.mir && pr.mir.F) mark(pr.mir.F);
      else if (pr.act === 'lever' || pr.act === 'cut' || pr.act === 'throw' || pr.act === 'sling') mark(pr.G);
    }
    for (const k of picks) mark(k.m || k.mesh || k.G);
    for (const d of nightDews) mark(d.m);
    if (star) mark(star.m || star.G);
    if (exitMesh) { mark(exitMesh.ringM); mark(exitMesh.flag); mark(exitMesh.disc); mark(exitMesh.spark); }
    for (const gh of (a2 && a2.ghosts) || []) mark(gh.r && gh.r.m);
    if (a2) {
      for (const e of a2.en || []) { mark(e.F); mark(e.G); mark(e.cone); }
      for (const b of a2.escorts || []) mark(b.G);
      for (const tl of a2.tools || []) mark(tl.G);
      for (const s of a2.shots || []) mark(s.m || s.G);
      for (const src of a2.srcs || []) mark(src.cr);
    }
    group.updateMatrixWorld(true);
    const buckets = new Map();
    const doomed = [];
    const take = (geo, matrix, wx, wz, mat, src) => {
      if (!geo || !mat) return;
      if (mat.transparent && (mat.opacity < 0.2 || mat.blending !== THREE.NormalBlending)) return;
      const uv = swatchUV(mat);
      const g = normCaveGeo(geo.clone());
      g.applyMatrix4(matrix);
      if (uv) writeAtlasUV(g, uv);
      const cx = Math.floor(wx / 16), cz = Math.floor(wz / 16);
      const ds = mat.side === THREE.DoubleSide ? 'ds' : 'fs';
      const basic = !!(mat.isMeshBasicMaterial);
      const key = (uv ? 'atlas' : caveMatKey(mat)) + '@' + cx + ',' + cz + ':' + ds + (basic ? ':b' : '');
      const useMat = uv ? atlasMaterial({ basic, doubleSide: mat.side === THREE.DoubleSide }) : mat;
      const L = buckets.get(key) || { mat: useMat, cx, cz, geos: [] };
      L.geos.push(g); buckets.set(key, L); doomed.push(src);
    };
    const _pos = new THREE.Vector3(), _M = new THREE.Matrix4(), _MW = new THREE.Matrix4();
    group.traverse(m => {
      if (skip.has(m)) return;
      if (!(m.isMesh || m.isInstancedMesh) || !m.visible || !m.geometry) return;
      if (m.isSkinnedMesh || m.userData.caveChunk || m.userData.noMerge || m.userData.isAnimal || m.userData.terrain) return;
      const mat = Array.isArray(m.material) ? null : m.material; if (!mat) return;
      if (m.isInstancedMesh) {
        const W = m.matrixWorld;
        for (let i = 0; i < m.count; i++) {
          m.getMatrixAt(i, _M); _MW.multiplyMatrices(W, _M); _pos.setFromMatrixPosition(_MW);
          take(m.geometry, _MW, _pos.x, _pos.z, mat, m);
        }
      } else {
        _pos.setFromMatrixPosition(m.matrixWorld);
        take(m.geometry, m.matrixWorld, _pos.x, _pos.z, mat, m);
      }
    });
    const seen = new Set();
    for (const m of doomed) { if (seen.has(m)) continue; seen.add(m); if (m.parent) m.parent.remove(m); }
    caveChunks = caveChunks.filter(m => m.parent);
    for (const { mat, geos } of buckets.values()) {
      // If merge still fails, keep the already-baked clones so the band is not dropped
      // (sources were removed above).
      const merged = tryMergeCaveGeos(geos);
      const parts = merged ? [merged] : geos;
      for (const geo of parts) {
        const nm = new THREE.Mesh(geo, mat);
        geo.computeBoundingSphere();
        const sph = geo.boundingSphere;
        nm.userData.caveChunk = true; nm.userData.noCast = true; nm.userData.zoneWall = true;
        nm.userData.chunkPos = sph ? sph.center.clone() : new THREE.Vector3();
        nm.userData.chunkR = sph ? sph.radius : 12;
        nm.userData.fogCull = (nm.userData.chunkR || 0) < 22; // leave huge ceiling/long walls drawn
        nm.castShadow = false; nm.receiveShadow = true; nm.frustumCulled = true;
        group.add(nm); caveChunks.push(nm);
      }
    }
  }
  function cullCaveChunks(cam) {
    if (!caveChunks.length || !cam) return;
    const sc = group.parent;
    const farD = (sc && sc.fog && sc.fog.far) || 42;
    const x = cam.position.x, z = cam.position.z;
    const _cull = new THREE.Vector3();
    for (const m of caveChunks) {
      if (!m.userData.fogCull) { m.visible = true; continue; }
      const p = m.userData.chunkPos, r = m.userData.chunkR || 12;
      m.visible = Math.hypot(x - p.x, z - p.z) < farD + r + 6;
    }
    const fogR = farD + 4;
    group.traverse(o => {
      if (!o.isSprite || (o.userData && o.userData.noFogCull)) return;
      o.getWorldPosition(_cull);
      o.visible = Math.hypot(_cull.x - x, _cull.z - z) < fogR;
    });
  }

  function mergeColorBoxes(root, hex) {
    if (!root) return;
    const kids = [];
    root.traverse(m => {
      if (!m.isMesh || m.isInstancedMesh || !m.geometry || !m.material || m.userData.caveChunk) return;
      if (Array.isArray(m.material)) return;
      if (!m.material.color || m.material.color.getHex() !== hex) return;
      kids.push(m);
    });
    const byParent = new Map();
    for (const m of kids) {
      const p = m.parent || root;
      const L = byParent.get(p) || []; L.push(m); byParent.set(p, L);
    }
    for (const [parent, list] of byParent) {
      if (list.length < 2) continue;
      parent.updateMatrixWorld(true);
      const geos = [];
      for (const m of list) {
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry).clone();
        g.applyMatrix4(m.matrix);
        const uv = swatchUV(m.material);
        if (uv) writeAtlasUV(g, uv);
        geos.push(g);
      }
      let merged = null;
      try { merged = geos.length === 1 ? geos[0] : (mergeGeos(geos, false) || null); } catch (e) { merged = null; }
      if (!merged) continue;
      const uv0 = swatchUV(list[0].material);
      const useMat = uv0 ? atlasMaterial({ basic: !!list[0].material.isMeshBasicMaterial, doubleSide: list[0].material.side === THREE.DoubleSide }) : list[0].material;
      const nm = new THREE.Mesh(merged, useMat);
      nm.castShadow = false; nm.receiveShadow = true;
      nm.userData.noMerge = true; nm.userData.atlasMerged = true;
      parent.add(nm);
      for (const m of list) { if (m.parent) m.parent.remove(m); }
    }
  }

  const _imM = new THREE.Matrix4(), _imP = new THREE.Vector3(), _imQ = new THREE.Quaternion(), _imS = new THREE.Vector3();
  function hideAndTrack(src, im, i) {
    src.userData.atlasInst = { im, i };
    src.visible = false;
    src.userData.wasFrustum = src.frustumCulled;
    src.frustumCulled = false;
  }
  function composeFrom(src, visible) {
    src.updateMatrixWorld(true);
    if (!visible) { _imS.set(0, 0, 0); _imP.setFromMatrixPosition(src.matrixWorld); _imQ.setFromRotationMatrix(src.matrixWorld); }
    else { src.matrixWorld.decompose(_imP, _imQ, _imS); }
    _imM.compose(_imP, _imQ, _imS);
    return _imM;
  }
  function addInstanced(geo, srcMat, items, kind) {
    if (!items.length) return null;
    const uv = swatchUV(srcMat);
    const g = (geo.index ? geo.toNonIndexed() : geo).clone();
    if (uv) writeAtlasUV(g, uv);
    const useMat = uv ? atlasMaterial({ basic: !!srcMat.isMeshBasicMaterial, doubleSide: srcMat.side === THREE.DoubleSide }) : srcMat;
    const im = new THREE.InstancedMesh(g, useMat, items.length);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
    im.userData.noMerge = true; im.userData.atlasInstKind = kind;
    items.forEach((src, i) => { hideAndTrack(src, im, i); im.setMatrixAt(i, composeFrom(src, src.userData.atlasWantVis !== false)); });
    im.instanceMatrix.needsUpdate = true;
    group.add(im); atlasInsts.push({ im, items, kind });
    return im;
  }
  function instanceAtlasProps() {
    // Pickups: same-colour, same-geometry petals (and other non-bloom pick meshes) → 1 InstancedMesh per bucket.
    const pickBuckets = new Map();
    for (const k of picks) {
      const m = k.m;
      if (!m || !m.isMesh || k.bloom || m.userData.atlasInst) continue;
      if (!m.geometry || !m.material || Array.isArray(m.material)) continue;
      const hex = m.material.color ? m.material.color.getHex() : 0;
      const ei = +(m.material.emissiveIntensity || 0).toFixed(3);
      const key = 'pick|' + hex + '|' + ei + '|' + (m.geometry.type || '') + '|' + (m.geometry.parameters ? JSON.stringify(m.geometry.parameters) : (m.geometry.uuid || ''));
      const L = pickBuckets.get(key) || { mat: m.material, geo: m.geometry, items: [], recs: [] };
      L.items.push(m); L.recs.push(k); pickBuckets.set(key, L);
    }
    for (const b of pickBuckets.values()) {
      if (b.items.length < 2) continue;
      addInstanced(b.geo, b.mat, b.items, 'pickup');
    }
    // Leftover #2a1a2a boxes not already merged (spider legs etc.).
    mergeColorBoxes(group, 0x2a1a2a);
    // Beacons: MeshBasic #4fe3e0 (sphere + cone, or any leftover same-geo set).
    const beaconBuckets = new Map();
    group.traverse(m => {
      if (!m.isMesh || m.isInstancedMesh || !m.geometry || !m.material || Array.isArray(m.material)) return;
      if (m.userData.caveChunk || m.userData.atlasInst || m.userData.atlasMerged || m.userData.noMerge) return;
      if (m.isSkinnedMesh) return;
      const hex = m.material.color ? m.material.color.getHex() : 0;
      if (hex !== 0x4fe3e0 && hex !== 0x4FE3E0) return;
      const gkey = (m.geometry.type || 'g') + '|' + (m.geometry.parameters ? JSON.stringify(m.geometry.parameters) : m.geometry.uuid);
      const basic = !!m.material.isMeshBasicMaterial;
      const key = hex + '|' + gkey + '|' + (basic ? 'b' : 'l');
      const L = beaconBuckets.get(key) || { mat: m.material, geo: m.geometry, items: [] };
      L.items.push(m); beaconBuckets.set(key, L);
    });
    for (const b of beaconBuckets.values()) {
      if (b.items.length < 2) continue;
      addInstanced(b.geo, b.mat, b.items, 'beacon');
    }
    // Gameplay mirror gold trims + posts: same geo/mat, matrices follow F as the player aims.
    const gold = [], posts = [];
    for (const mir of (a2 && a2.mirrors) || []) {
      if (mir.F) mir.F.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh || o.userData.atlasInst || o.userData.noMerge) return;
        if (o.material && o.material.color && o.material.color.getHex() === 0xffd23f) gold.push(o);
      });
      const G = mir.F && mir.F.parent;
      if (G) G.children.forEach(o => {
        if (!o.isMesh || o.isInstancedMesh || o.userData.atlasInst) return;
        if (o.material && o.material.color && o.material.color.getHex() === 0x8b6a45) posts.push(o);
      });
    }
    if (gold.length >= 2) addInstanced(gold[0].geometry, gold[0].material, gold, 'mirror-gold');
    if (posts.length >= 2) addInstanced(posts[0].geometry, posts[0].material, posts, 'mirror-post');
    removeStrayFramedMirrors();
  }
  function isFramedMirrorObj(o) {
    const nm = [o.name, o.parent && o.parent.name].filter(Boolean).join(' ');
    const mats = [].concat(o.material || []);
    return /framed-mirror/i.test(nm) || mats.some(m => m && m.color && (m.color.getHex() === 0xe8eef8 || m.color.getHex() === FRAME_TINT || /^mirror$/i.test(m.name || '') || /^dark-wood$/i.test(m.name || '')));
  }
  function disposeFramedMirror(o) {
    if (o.parent) o.parent.remove(o);
    try { o.geometry && o.geometry.dispose && o.geometry.dispose(); } catch (e) {}
    try { if (o.isInstancedMesh && o.dispose) o.dispose(); } catch (e) {}
  }
  function removeStrayFramedMirrors() {
    // Drop leftover framed-mirror parts at world origin. Instanced copies belong on the
    // placed deco holder (around [6, 2.45, 14] in level space); never leave the object
    // itself at (0,0,0). Dispose origin leftovers rather than hiding them.
    const placed = [];
    const M = new THREE.Matrix4(), W = new THREE.Matrix4(), P = new THREE.Vector3();
    const root = group.parent || group;
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isInstancedMesh || !isFramedMirrorObj(o)) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); W.multiplyMatrices(o.matrixWorld, M); P.setFromMatrixPosition(W); if (Math.hypot(P.x, P.z) >= 2) placed.push(P.clone()); }
    });
    const doomed = [];
    root.traverse(o => {
      if (!o.isMesh || !isFramedMirrorObj(o)) return;
      if (o.isInstancedMesh) {
        o.getWorldPosition(P);
        const objAtOrigin = Math.hypot(P.x, P.z) < 2;
        let instAtCave = 0, instAtOrigin = 0;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M); W.multiplyMatrices(o.matrixWorld, M); P.setFromMatrixPosition(W);
          if (Math.hypot(P.x, P.z) < 2) instAtOrigin++; else instAtCave++;
        }
        // Relocate an IM whose object sits at origin but whose instances are in-cave:
        // parent it to the first placed deco (or keep it on group at the first instance).
        if (objAtOrigin && instAtCave && !instAtOrigin) {
          const first = placed[0];
          if (first) {
            const inv = new THREE.Matrix4().makeTranslation(-first.x, -first.y, -first.z);
            for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); o.setMatrixAt(i, W.copy(inv).multiply(M)); }
            o.instanceMatrix.needsUpdate = true;
            o.position.set(first.x, first.y, first.z);
            o.updateMatrix();
          }
          return;
        }
        if (objAtOrigin && !instAtCave) doomed.push(o);
        return;
      }
      o.getWorldPosition(P);
      const atOrigin = Math.hypot(P.x, P.z) < 2;
      const nearPlaced = placed.some(q => Math.hypot(P.x - q.x, P.z - q.z) < 2.5);
      if (atOrigin && !nearPlaced) doomed.push(o);
    });
    for (const o of doomed) disposeFramedMirror(o);
  }
  function updateAtlasInsts() {
    if (!atlasInsts.length) return;
    for (const rec of atlasInsts) {
      const { im, items } = rec;
      for (let i = 0; i < items.length; i++) {
        const src = items[i];
        // Pickups keep bob/spin on the hidden source mesh; visibility follows the mesh flag + scale.
        const vis = !!(src.visible || src.userData.atlasWantVis) && (src.scale.x !== 0);
        // Source is hidden after instancing; use pickup record visibility via a flag we keep in sync.
        const show = src.userData.atlasShow;
        const on = show == null ? true : !!show;
        im.setMatrixAt(i, composeFrom(src, on));
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }

  function load(pid, anchor) {
    clear(); matLive = false; recipe = MAPS[pid]; if (!recipe) return; id = pid;
    setCaveLevel(!!(recipe.caveFloor || recipe.id === 'mirror_caves' || pid === 'mirror_caves'));
    installFallbackHooks({ zoneGroup: group, scene }); babyMixers.length = 0; pipDone = new Set(); pipPend = null; pipSigT = {}; picked = 0; petalV = 0; keyDone = false; t = 0; lastProg = 0; hintT = 0;
    if (recipe.ambience) ctx.audio?.levelAmb?.(recipe.ambience);
    A = { x: anchor.x, z: anchor.z };
    baseY = (ctx.meadowHeightAt || ctx.heightAt)(A.x, A.z);
    buildTerrainMesh(terrainFrom(recipe), recipe.bounds);
    decoBatching = true; recipe.build(B); decoBatching = false;
    const decoReady = flushDecos();
    mergeCaveStatics();
    refreshFallbackMaterials();
    if (!recipe.hub) { const e = recipe.exit || [0, 0]; B.exit(e[0], e[1], e[2] || 3, e[3] || 0); } else hubInit();
    if (!(recipe.caveFloor || recipe.id === 'mirror_caves')) buildLeafyBackdrop(recipe.bounds);
    decorateProps();
    Promise.resolve(decoReady).then(() => { if (recipe && recipe.caveFloor) { mergeCaveStatics(); refreshFallbackMaterials(); } instanceAtlasProps(); });
    if (recipe.act2) a2Init();
    instanceAtlasProps();
    if (ctx.look?.setPatch) {
      const fills = {};
      if (pid === 'thaw_valley') fills.denGlow = { x: A.x + 11.2, y: gy(11.2, 20) + 1.2, z: A.z + 20 };
      ctx.look.setPatch(pid, { state: (a2 && a2.master && a2.master.state) || recipe.masterStart || null, fills });
    }
    // Bruiser "standing platform" (Olaf shield move): a solid on Bear's back while he's parked
    bearPad = addSolid({ type: 'cyl', x: 0, z: 0, r: 1.15, y0: -99, top: -98, kind: 'zone', off: true, pad: true });
    if (recipe.night) { nightOn = true; ctx.setNight(true); }
    else if (recipe.nightCycle) { nightOn = false; ctx.setNight(false); }
    const startBanter = (banterOf(pid) || recipe.banter)?.start || [];
    introQ = recipe.kid ? [] : [
      ...startBanter.map((s, i) => ({ say: s, voice: `${pid}.start.${String(i + 1).padStart(2, '0')}` })),
      ...(recipe.intro || []),
    ]; // the goal lives in the objective tracker now
    if (recipe.kid) kidInit();
  }
  function applyLoan() {
    const S = a2; if (!S || !recipe || S.borrow) return;
    const want = recipe.loanGear === 'all' || recipe.loanGear === true || (recipe.loanGear === 'test' && typeof window !== 'undefined' && window.T);
    if (!want) return;
    S.borrow = recipe.loanGear === 'all' ? { lantern: true, whistle: true, pouch: true, glider: true, sling: true, eqL: true, eqW: false, eqP: true, eqG: true, eqS: true, slot: { scout: 'lantern', trickster: 'whistle', bruiser: 'sling' } } : { lantern: true, whistle: true, eqL: false, eqW: false, slot: { scout: 'lantern', trickster: 'whistle' } };
    ctx.onGear?.();
  }
  function a2Init() {
    const S = AA();
    // Scout lantern light: exists (visible, intensity 0) from load, so turning the lantern on/off or a loan at GO
    // never changes the scene's light count (which would recompile every lit program mid-play).
    if (!S.light) { S.light = new THREE.PointLight(0xffd27a, 0, 12); group.add(S.light); }
    document.body.classList.add('a2'); sneak = false; ctx.onSneak?.(false);
    if (S.escorts.length) document.body.classList.add('hasEscort');
    for (const k of ['summer', 'winter', 'spring']) setSig(k, k === S.season);
    setSig('day', true); setSig('night', false); setSig('wind:down', S.wind < 0); setSig('wind:up', S.wind > 0);
    if (recipe && recipe.windStart != null) setMasterWind({ dz: recipe.windStart, mag: 6 }, true, { flip: false });
    for (const it of S.seasonal) { const on = S.season === it.when; it.pr.s.off = !on; it.pr.m.visible = on; }
    if (S.master) { ctx.holdClock?.(true); applyMaster(S.master.start || recipe.masterStart || S.master.state || 'A', { quiet: true, init: true }); }
    else if (recipe.night) setNightA2(true);
    applyLoan();
    autoStump();
    S.cp = null;
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
    if (!recipe || keyDone || recipe.hub) return;
    if (reqLeft().length) return;
    if (!exitOpen) { exitOpen = true; setExitLook(); tst(a2 && a2.escorts.length ? '🏁 The exit is open! Bring all three friends AND the baby to the flag.' : '🏁 The exit is open! Bring all three friends to the flag.', 3400); ctx.audio?.chime?.(); }
    if (exitAt && crewAtExit() >= 3 && escortAtExit()) complete(a2 && a2.escorts.length ? 'The whole crew and the baby made it' : 'All three friends made it');
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
    exitMesh.ringM.material = mat(on ? 0xffc93c : 0x9a8f7a, 0.6); exitMesh.flag.material = mat(on ? 0xff5a5a : 0xb0b0b0, 0.8); exitMesh.disc.material.opacity = on ? 0.45 : 0.12;
    if (exitMesh.disc.material.color) exitMesh.disc.material.color.set(on ? 0xffd23f : 0xffe07a);
    if (exitMesh.spark) { exitMesh.spark.material.opacity = on ? 0.85 : 0.28; exitMesh.spark.material.color.set(on ? 0xffd23f : 0xffe07a); exitMesh.spark.material.size = on ? 0.75 : 0.5; }
  }
  function updateExit(cam) {
    if (!exitAt || !exitLabel) return;
    // bobbing flag + soft sparkle orbit — no sky laser
    const bob = still() ? 0 : Math.sin(t * 2.4) * 0.18;
    exitMesh.flag.position.y = (exitMesh.flagY || 3) + bob;
    exitMesh.flag.rotation.y = still() ? 0 : Math.sin(t * 2) * 0.35;
    if (exitMesh.spark && !still()) { exitMesh.spark.rotation.y = t * 0.7; exitMesh.spark.position.y = bob * 0.4; }
    const v = new THREE.Vector3(exitAt.x, exitAt.y + 4, exitAt.z); v.project(cam);
    const p = ctx.getP(), pd = Math.hypot(p.x - exitAt.x, p.z - exitAt.z), on = exitOpen && !keyDone && v.z < 1 && pd < 40;
    exitLabel.style.display = on ? 'block' : 'none';
    if (on) { const n = crewAtExit(), L = reqLeft().length, needB = !!(a2 && a2.escorts.length), bOk = !needB || escortAtExit(); exitLabel.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; exitLabel.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; exitLabel.textContent = exitOpen ? `🏁 Exit ${'🐾'.repeat(n)}${'◯'.repeat(Math.max(0, 3 - n))}${needB ? (bOk ? '🐣' : '🥚') : ''}` : `🏁 Exit · 🔒 ${L} puzzle${L === 1 ? '' : 's'} left`; }
  }
  function complete(why) {
    if (keyDone) return; keyDone = true;
    if (exitLabel) exitLabel.style.display = 'none';
    // POLISH: result.petals / petalsTotal are the SUM of pickup values (blooms are 5); the all-Petals star still needs every pickup
    const pets = picks.filter(k => k.tier === 'petal' && !k.nightOnly), vsum = L => L.reduce((a, k) => a + (k.value || 1), 0), got = vsum(pets.filter(k => k.got));
    const hasStar = picks.some(k => k.tier === 'star'), easyOn = !!ctx.easy?.();
    result = { id, petals: got, petalsTotal: vsum(pets), petalPicks: pets.filter(k => k.got).length, petalPicksTotal: pets.length, star: starGot, hasStar, time: Math.round(t), par: recipe.par || 0,
      stars: { petals: pets.every(k => k.got), star: !hasStar || starGot, par: !recipe.par || (!easyOn && t <= recipe.par) },
      end: ((banterOf(id) || recipe.banter)?.end || []).filter((s, i, a) => !/\{if:\s*foxkit_rescued\}/.test(s) || sig['friend:foxkit']).map(s => s.replace(/\s*\{if:[^}]+\}\s*$/, '')),
      endVoice: ((banterOf(id) || recipe.banter)?.end || []).map((s, i) => ((/\{if:\s*foxkit_rescued\}/.test(s) && !sig['friend:foxkit']) ? null : `${id}.end.${String(i + 1).padStart(2, '0')}`)).filter(Boolean) };
    if (easyOn) { result.easy = true; if (recipe.par) result.easyPar = true; }
    if (recipe.noStars) result.noStars = true;
    if (a2) { result.bonks = a2.bonks; result.hidEver = !!a2.hidEver; if (a2.borrow) { a2.borrow = null; ctx.onGear?.(); } }
    if (recipe.kid) { result.kid = true; result.stars = { petals: true, star: true, par: true }; confetti(true); setTimeout(() => kid && confetti(true), 700); }
    result.n = +!!result.stars.petals + +!!result.stars.star + +!!result.stars.par;
    if (a2 && !recipe.kid) result.stars.challenge = !a2.hidEver;
    tst(`🏆 ${why}! ${'⭐'.repeat(result.n)}${'☆'.repeat(3 - result.n)}`, 3400); if (result.n && !result.noStars && ctx.audio?.sample) ctx.audio.sample('act3/star-earned-jingle', 0.5); else ctx.audio?.chime?.(); /* polish4 */ ctx.onComplete?.(result); emitNet('complete', { why, id, result });
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
    if (ctx.isNetClient?.()) { emitNet('intent', { intent: 'act', body: ctx.cur() }); return true; }
    if (pr.act === 'gear') return stumpSwap(pr);
    const c = clsOfCur(), C = CLASSES[pr.cls];
    if (pr.cls && pr.cls !== c) { say(`${C.em} Only a ${C.name} can ${(ACTS[pr.act] || { verb: 'Act' }).verb.toLowerCase()} this — swap to your ${C.name}!`, 2400); ctx.audio?.sample?.('ui/error-bonk', 0.35); return true; }
    if (pr.need && !isOn(pr.need)) { say('🔒 ' + (pr.needWhy || 'Not yet — something else has to happen first'), 2600); return true; }
    const atB = pr._atB;
    if (a2 && a2Act(pr, p)) { if (pr.icon && pr.done && !pr.two) pr.icon.visible = false; return true; }
    if (a2 && (pr.act === 'shove' || pr.act === 'smash')) a2Burst(pr.x, pr.z, 8);
    if (a2 && pr.act === 'shove' && pr.ice && a2.season === 'winter') { pr.to = pr.ice; if (pr.iceSig) pr.sig = pr.iceSig; tst('⛸️ On the ice it slides a looong way!', 1800); }
    switch (pr.act) {
      case 'bell': ringBell(pr); break;
      case 'lever': pr.done = true; pr.arm.rotation.z = -0.5; pr.knob.position.x = 0.3; setSig(pr.sig); ctx.audio?.sample?.('ui2/lantern-click', 0.5); tst(`🎚️ ${pr.label} pulled!`, 1800); break;
      case 'slip': {
        if (!atB && pr.needIn && !isOn(pr.needIn)) { say('🔒 ' + (pr.needWhy || 'Closed'), 2400); return true; }
        const to = atB ? pr : pr.b; tween(p, { x: to.x, y: to.y, z: to.z }, 0.55, 0.3); tst('🕳️ Slipped through!', 1000); break;
      }
      case 'vine': { const to = atB ? pr : pr.b; tween(p, { x: to.x, y: to.y + 0.1, z: to.z }, 1.1, 0); tst(atB ? '🌿 Climbing down' : '🌿 Climbing up the vine!', 1200); break; }
      case 'dig': { const to = atB ? pr : pr.b; tween(p, { x: to.x, y: to.y, z: to.z }, 0.9, -1.6); if (!pr.done) { pr.done = true; setSig(pr.sig); if (pr.friend) { setSig('friend:' + pr.friend); ctx.valley?.addFriend?.(pr.friend); tst(pr.friend === 'foxkit' ? '🦊 A fox kit wriggles out — you can call it if you like!' : '⛏️ Dug through the tunnel!', 1800); } else tst('⛏️ Dug through the tunnel!', 1200); } break; }
      case 'throw': {
        if (pr.from && (dFlat(p, pr.from) > pr.from.r || p.y < pr.from.minY - 0.3)) { say('🌰 ' + (pr.fromWhy || 'Get to a better spot to throw from'), 2600); return true; }
        throwAcorn(p, pr); break;
      }
      case 'plank': {
        pr.cross.on = true; pr.holder.visible = true; pr.s.off = false; pr.ghost.visible = false; clearWaterIn(pr.cross.x0, pr.cross.z0, pr.cross.x1, pr.cross.z1);
        for (const q of props) if (q.act === 'plank' && q.holder === pr.holder) { q.done = true; if (q.icon) q.icon.visible = false; }
        setSig(pr.sig); tst(`🪵 ${pr.label}: Plank Bridge built!${pr.cross.thin ? ' (too thin for Bear)' : ''}`, 2400); ctx.audio?.chime?.(); break;
      }
      case 'shove': {
        pr.done = true; const s = pr.s, to = pr.to;
        pr.anim = { t: 0, a: { x: pr.from.x, z: pr.from.z, top: pr.from.top }, b: to };
        if (pr.ghost) pr.ghost.visible = false;
        tst(`💪 Shove! ${pr.label} slides into place`, 1800); ctx.audio?.sample?.('build/place-thunk', 0.5);
        break;
      }
      case 'smash': {
        pr.done = true; pr.s.off = true; pr.m.visible = false; pr.G.visible = false; setSig(pr.sig);
        fx(pr.x, pr.y + 1.2, pr.z); tst(`💥 Poof! ${pr.label} tumbles open in a puff of leaves`, 2000); ctx.audio?.sample?.('build/dismantle-pop-apart', 0.5); break;
      }
    }
    if (pr.icon && pr.done && !pr.two) pr.icon.visible = false;
    return true;
  }
  function ringBell(pr) {
    if (pr.kind === 'tbell') { pr.ringT = t; pr.onRing?.(); ctx.audio?.sample?.('contest/win-jingle', 0.4); return; }
    if (pr.done) return;
    if (pr.need && !isOn(pr.need)) { say('🔒 ' + (pr.needWhy || 'Not yet'), 2400); return; }
    pr.done = true; pr.ringT = t; setSig(pr.sig); if (pr.icon) pr.icon.visible = false;
    if (pr.lantern) { pr.bell.material = mat(0xffe08a, 1.0); const L = new THREE.PointLight(0xffd27a, 2, 9); L.position.copy(pr.G.position); group.add(L); }
    ctx.audio?.sample?.(pr.lantern ? 'ui2/lantern-click' : 'contest/win-jingle', 0.45); tst(pr.lantern ? `🏮 ${pr.label} lit!` : `🔔 Ding! ${pr.label} rang`, 1800);
  }
  function throwAcorn(p, pr) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), mat(0x8b5a2b)); a.position.set(p.x, p.y + 1.2, p.z); group.add(a);
    pr.done = true; pr.proj = { m: a, t: 0, a: a.position.clone(), b: new THREE.Vector3(pr.x, pr.y, pr.z) };
    tst('🌰 Throw!', 900); ctx.audio?.blip?.(3);
  }
  /** Interact / Act button: returns true if a puzzle prop handled it */
  function act() {
    if (ctx.isNetClient?.()) { emitNet('intent', { intent: 'act', body: ctx.cur() }); return true; }
    if (!recipe || tw) return false;
    const p = ctx.getP(), pr = nearest(p);
    if (a2 && a2.escorts.some(b => !b.called && flatD(b, p) < 3.2) && !pr) return callEscort();
    if (!pr && a2 && a2.heldTool) {
      const kind = a2.heldTool;
      if (kind === 'bubble') {
        const web = props.find(q => q.kind === 'web' && !q.done);
        if (web && flatD(web, p) < 16) return throwTool('bubble', web.x, web.z, p);
        const yaw = p.yaw || 0; return throwTool('bubble', p.x + Math.sin(yaw) * 10, p.z + Math.cos(yaw) * 10, p);
      }
      if (kind === 'pebble') {
        const crow = a2.en.find(e => e.kind === 'crow');
        if (crow && flatD(crow, p) < 18) return throwTool('pebble', crow.x, crow.z, p);
        const yaw = p.yaw || 0; return throwTool('pebble', p.x + Math.sin(yaw) * 10, p.z + Math.cos(yaw) * 10, p);
      }
    }
    if (!pr && a2 && useGear(p)) return true;
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
      const A2 = ACTS[pr.act] || { verb: pr.label || 'Act' }, ok = !pr.cls || pr.cls === c;
      out.push({ icon: img((pr.cls ? CLASSES[pr.cls] : C).abIcon), ik: 'class-act', label: `${A2.verb}`, dis: !ok, why: pr.cls ? `Only a ${CLASSES[pr.cls].name} can do this — swap!` : 'Anyone can ring this', on: () => doAct(pr, ctx.getP()) });
    }
    if (!pr && a2) { const gk = slotOf(c); if ((gk === 'pouch' || gk === 'sling') && gearOn(gk)) out.push({ icon: img(import.meta.env.BASE_URL + GEAR_INFO[gk].icon), ik: 'gear-act', label: gk === 'pouch' ? (a2.pouch.full ? 'Shoot Bubble' : 'Pouch empty') : 'Sling Pebble', dis: gk === 'pouch' && !a2.pouch.full, why: '🫧 Fly low over a creek or pond to fill the pouch', on: () => useGear(ctx.getP()) }); }
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
    const gliding = CLASS_OF[idd] === 'trickster' && isCur && gearOn('glider') && !q.grounded;
    const inD = deep.some(r => !r.off && inRect(q.x, q.z, r) && !(gliding && r.glide) && (r.y == null || q.y < r.y - 0.25));
    const gapR = !inD && gliding && deep.find(r => !r.off && r.glide && inRect(q.x, q.z, r));
    if (gapR) return; // mid-glide over the gap: keep the last safe spot on the take-off edge
    const cr = crossings.find(c => c.on && inRect(q.x, q.z, c));
    const thinBlock = cr && cr.thin && CLASS_OF[idd] === 'bruiser';
    if (inD && (!cr || thinBlock)) {
      if (q._safe) { q.x = q._safe.x; q.z = q._safe.z; q.vx = (q.vx || 0) * -0.3; q.vz = (q.vz || 0) * -0.3; }
      const gr = deep.find(r => !r.off && r.glide && inRect(q.x, q.z, r));
      if (isCur) say(gr ? (CLASS_OF[idd] === 'trickster' ? (gearHas('glider') ? '🍃 Too wide to hop — switch on the Leaf Glider, then jump and glide across' : '🍃 Too wide to hop — a Trickster with the Leaf Glider could glide it') : '🐻 Too wide for Bear — find another way round') : thinBlock ? '🐻 Too thin for Bear — he needs the ford or a sturdy crossing' : '💧 Too deep to swim! Only Scouts fly over — build a crossing', 2000);
    } else q._safe = { x: q.x, z: q.z };
  }
  // POLISH hub banter (Fern banter.md): first_visit once per friend, idle_talk after that, after_new_rescue from residents when someone moves in
  const HUB_TALK = 'pm_hub_talk_v1';
  let hubTalkT = -9;
  const hubTalkLoad = () => { try { return JSON.parse(localStorage.getItem(HUB_TALK) || '{}') || {}; } catch (e) { return {}; } };
  const hubTalkSave = v => { try { localStorage.setItem(HUB_TALK, JSON.stringify(v)); } catch (e) {} };
  function hubLine(f) {
    const H = HUB_BANTER[f.id]; if (!H) return f.say.length ? f.say[f.sayI++ % f.say.length] : null;
    const T = hubTalkLoad(); T.seen ||= {}; T.news ||= {};
    let line;
    if (!T.seen[f.id]) { T.seen[f.id] = 1; line = H.first_visit?.[0]; }
    else if (T.news[f.id]) { delete T.news[f.id]; line = H.after_new_rescue?.[0]; }
    if (!line) { const L = H.idle_talk || []; line = L.length ? L[Math.floor(Math.random() * L.length)] : null; }
    hubTalkSave(T); return line;
  }
  function hubInit() {
    const fr = new Set(ctx.friends?.() || []); document.body.classList.add('inHub');
    { const T = hubTalkLoad(), known = new Set(T.known || []), fresh = [...fr].filter(k => !known.has(k) && HUB_BANTER[k]);
      if (fresh.length && known.size) { T.news ||= {}; for (const k of known) if (fr.has(k)) T.news[k] = 1; }
      if (fresh.length || !T.known) { T.known = [...new Set([...known, ...fr])]; hubTalkSave(T); } }
    for (const f of hubFr) f.G.visible = f.id === 'always' || fr.has(f.id);
    for (const h of hubPads) { h.open = !h.need || fr.has(h.need); if (h.ring?.material) { h.ring.material.color.set(h.open ? h.col : 0x9a8f7a); h.ring.material.opacity = h.open ? 0.85 : 0.4; } if (h.em?.material) h.em.material.opacity = h.open ? 1 : 0.45; }
  }
  function updateHub(dt, cam) {
    const p = ctx.getP(); if (!p) return;
    const cover = !!document.querySelector('.ov.on');
    for (const h of hubPads) {
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      if (h.ring) h.ring.rotation.y += dt * 0.4; if (h.em) h.em.position.y = h.y + 2.6 + Math.sin(t * 2 + h.x) * 0.12;
      if (h.model) h.model.traverse(m => { const n = (m.name || '').toLowerCase(); if (n === 'highlight' || n === 'on') m.visible = !!h.inside; });
      const v = new THREE.Vector3(h.x, h.y + 3.6, h.z); v.project(cam); const show = !cover && v.z < 1 && d < 30;
      h.el.style.display = show ? 'block' : 'none';
      if (show) {
        h.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
        h.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
        let tx = h.el.querySelector('.hubLblTx');
        if (!tx) { h.el.textContent = ''; tx = document.createElement('span'); tx.className = 'hubLblTx'; h.el.append(tx); }
        tx.textContent = (h.open ? '' : '🔒 ') + h.label;
        const startPad = /^(map|lab|bell|trail)$/.test(h.key) || /level|trail|garden|yard/i.test(h.label || '');
        let badge = h.el.querySelector('.olHostOnlyBadge');
        if (ctx.isNetClient?.() && startPad) {
          if (!badge) { badge = document.createElement('img'); badge.className = 'olHostOnlyBadge'; badge.alt = 'Only the host can start a level'; h.el.append(badge); }
          const src = (import.meta.env.BASE_URL || './') + 'ui/online/host/badge-host-only.png';
          if (badge.getAttribute('src') !== src) badge.src = src;
          h.el.classList.add('olHostOnlyCtrl');
        } else if (badge) { badge.remove(); h.el.classList.remove('olHostOnlyCtrl'); }
      }
      if (d < h.r && !h.inside) { h.inside = true; introQ = []; msgT = t; if (h.open) ctx.onHub?.(h.key); else tst(h.lockTx || '🔒 Not open yet', 3000); }
      else if (d > h.r + 1.2) h.inside = false;
    }
    for (const f of hubFr) {
      if (!f.G.visible) continue; f.G.position.y = f.y0 + Math.abs(Math.sin(t * 3 + f.ph)) * 0.12;
      const d = Math.hypot(p.x - f.x, p.z - f.z); f.G.rotation.y = Math.atan2(p.x - f.x, p.z - f.z) * (d < 7 ? 1 : 0) + (d < 7 ? 0 : f.G.rotation.y);
      if (d < 3 && !f.near && (f.say.length || HUB_BANTER[f.id])) { f.near = true; if (t - hubTalkT > 3.5) { hubTalkT = t; const ln = hubLine(f); if (ln) tst(ln, 3000); } } else if (d > 4.5) f.near = false;
    }
  }
  function updateBody(id, frame, cam, dt) {
    if (!recipe || recipe.hub || !id) return;
    withFocus(id, () => {
      const p = ctx.getP(), cur = ctx.cur(), c = clsOfCur();
      if (!p) return;
      if (frame && frame.sneakOn != null) p.sneak = !!frame.sneakOn;
      if (tw) {
        if (tw.p !== p) { tw.p.x = tw.b.x; tw.p.y = tw.b.y; tw.p.z = tw.b.z; tw = null; }
        else {
          tw.t += dt; const k = Math.min(1, tw.t / tw.d), e = k * k * (3 - 2 * k);
          p.x = tw.a.x + (tw.b.x - tw.a.x) * e; p.z = tw.a.z + (tw.b.z - tw.a.z) * e; p.y = tw.a.y + (tw.b.y - tw.a.y) * e + Math.sin(k * Math.PI) * tw.arc;
          p.vx = p.vz = 0; p.vy = 0; p._safe = { x: p.x, z: p.z };
          if (k >= 1) { tw = null; p.grounded = false; p.vy = 0.5; }
        }
      }
      if (!tw) {
        if (p.grounded) p._gY = p.y;
        const capBase = Math.max(p.floorY ?? -1e9, p._gY ?? -1e9);
        if (c === 'trickster' && !p.grounded && p.floorY != null && p.y > capBase + CLASSES.trickster.flyCap) { p.y = capBase + CLASSES.trickster.flyCap; if (p.vy > 0) p.vy = 0; if (p.stam != null) p.stam = Math.min(p.stam, 0.35); }
        if (recipe.ceil && p.y > baseY + recipe.ceil) { p.y = baseY + recipe.ceil; if (p.vy > 0) p.vy = 0; say('🌬️ Too windy up there — stay lower', 1400); }
        deepBlock(p, cur, true);
      }
      const Wd = recipe.wind;
      if (Wd) {
        const every = Wd.every * EZ('gust'), gust = (windT % every) < Wd.dur;
        if (gust && !p.grounded && p.x > A.x + Wd.x0 && p.x < A.x + Wd.x1 && p.z > A.z + Wd.z0 - 6 && p.z < A.z + Wd.z1) { p.z += Wd.push * dt; p.x -= Wd.push * 0.4 * dt; }
      }
      if (a2) a2UpdateBody(dt, cam, p, cur);
      for (const pr of props) {
        if (pr.kind === 'tbell') {
          const inside = c === 'scout' && dFlat(p, pr) < 1.4 && p.y > pr.y - 1.3 && p.y < pr.y + 1.6; if (inside && !pr.inside && t - (pr.ringT ?? -99) > 1.5) ringBell(pr); pr.inside = inside;
        }
        if (pr.kind === 'bell') {
          if (!pr.done && c === 'scout' && dFlat(p, pr) < 2.4 && p.y > pr.y - 1.2 && p.y < pr.y + 6.5) ringBell(pr);
        }
      }
      { const pr = nearest(p); if (pr && pr.cls && pr.cls !== c && !pr.done && t - (pr._hintT ?? -99) > 10) { pr._hintT = t; say(`${CLASSES[pr.cls].em} Needs a ${CLASSES[pr.cls].name}`, 1600); } if (id === host.cur()) nearOwn = pr && (!pr.cls || pr.cls === c) && !(pr.done && !pr.two) ? pr : null; }
      for (const h of hoops) if (!h.got && Math.hypot(p.x - h.m.position.x, p.z - h.m.position.z) < 1.8 && Math.abs(p.y + 0.5 - h.m.position.y) < 1.8) {
        if (h.prev && !sig[h.prev]) { say('💫 Start with the first hoop!', 1200); continue; }
        h.got = true; h.m.material = mat(0x8be07a, 0.6); setSig(h.sig); tst('💫 Hoop!', 900);
      }
      for (const k of picks) {
        if (k.got) continue;
        if (k.nightOnly && !k.alive) continue;
        if (k.show && !isOn(k.show)) continue;
        if (Math.hypot(p.x - k.m.position.x, p.z - k.m.position.z) < 1.5 && Math.abs(p.y + 0.6 - k.m.position.y) < 1.8) {
          if (k.who && !k.who.includes(c)) { say('🙅 ' + (k.whyNot || 'Another class has to grab this'), 2000); continue; }
          k.got = true; k.m.visible = false; k.m.userData.atlasShow = false; k.alive = false; addHeal(TIER[k.tier].heal); ctx.audio?.sample?.('ui2/item-produced', 0.4); picked++; if (k.tier === 'petal' && !k.nightOnly) petalV += k.value || 1; emitNet('pick', { idx: picks.indexOf(k), by: ctx.cur(), tier: k.tier });
          if (k.bloom) say(`🌸 Bloom bunch! +${k.value} Petals`, 1200);
          if (k.tier === 'dew') keyDew++;
          if (k.set) setSig(k.set);
          if (k.tier === 'star') { starGot = true; tst('⭐ Secret Starseed found!', 1800); ctx.onStar?.(); } else ctx.onPick?.();
          lastProg = t;
        }
      }
    });
  }
  function updateWorld(dt, cam) {
    for (const mx of babyMixers) mx.update(dt);
    if (!recipe) return; t += dt;
    if (recipe.hub) { if (introQ.length && t > 0.4 && t - msgT > 3.2) { msgT = t; const line = introQ.shift(); const say = typeof line === 'string' ? line : line.say; tst(say, 3000); const vid = typeof line === 'string' ? null : line.voice; if (vid) ctx.audio?.speak?.(vid); } updateHub(dt, cam); return; }
    // look-target: lerp L22 snow-pile scale and terrain vertex colours over 1.2 s with the Master Bell
    if (recipe.id === 'thaw_valley') {
      const S = AA(), winter = S.season === 'winter';
      S._snowK = Math.max(0, Math.min(1, (S._snowK == null ? (winter ? 1 : 0) : S._snowK) + (winter ? dt : -dt) / 1.2));
      group.children.forEach(o => { if (o.userData && o.userData.winterScale) { o.visible = S._snowK > 0.02; o.scale.setScalar(Math.max(0.01, S._snowK)); } });
      if (terrMesh && terrMesh.userData.lookTerrain && terrMesh.userData.colA) {
        const want = S.season === 'winter' ? 'A' : S.season === 'spring' ? 'B' : 'C';
        if (terrMesh.userData.colTo !== want) { terrMesh.userData.colFrom = terrMesh.userData.colTo || 'A'; terrMesh.userData.colTo = want; terrMesh.userData.colT = 0; }
        terrMesh.userData.colT = Math.min(1, (terrMesh.userData.colT || 0) + dt / 1.2);
        const a = terrMesh.userData['col' + (terrMesh.userData.colFrom || 'A')], b = terrMesh.userData['col' + want], u = terrMesh.userData.colT, attr = terrMesh.geometry.attributes.color;
        if (a && b && attr) { for (let i = 0; i < attr.count * 3; i++) attr.array[i] = a[i] + (b[i] - a[i]) * u; attr.needsUpdate = true; }
      }
    }
    const view = host.cur(), p = host.getP(), cur = view, c = clsOfCur(), size = SIZE[cur] || 'medium', ids = ctx.crewIds();
    if (introQ.length && t > 0.4 && t - msgT > 3.2) { msgT = t; const line = introQ.shift(); const say = typeof line === 'string' ? line : line.say; tst(say, 3000); const vid = typeof line === 'string' ? null : line.voice; if (vid) ctx.audio?.speak?.(vid); }
    else if (recipe.tutor && !keyDone) {
      while (tutorI < recipe.tutor.length && sig[recipe.tutor[tutorI].until]) { tutorI++; tutorT = -99; }
      const st = recipe.tutor[tutorI];
      if (st && !(st.optional && exitOpen && t - tutorT < 60) && t - tutorT > 25 && t - msgT > 3.2) { tutorT = t; msgT = t; lastProg = t; tst(st.say, 4200); }
    }
    // undriven deep-block + bear pad (driven bodies are blocked in updateBody)
    const driven = new Set(ctx.driven());
    for (const cid of ids) { if (driven.has(cid)) continue; const q = ctx.parked(cid); if (q) deepBlock(q, cid, false); }
    if (bearPad) {
      const bid = ids.find(i => CLASS_OF[i] === 'bruiser' && !driven.has(i)), q = bid && ctx.parked(bid);
      if (q) { bearPad.off = false; bearPad.x = q.x; bearPad.z = q.z; bearPad.top = q.y + 1.85; bearPad.y0 = q.y + 0.35; bearPad.owner = q; } else bearPad.off = true;
    }
    const Wd = recipe.wind;
    if (Wd) {
      windT += dt; const every = Wd.every * EZ('gust'), gust = (windT % every) < Wd.dur;
      if (gust && (windT % every) < dt * 1.5) say('💨 Gust!', 700);
    }
    if (recipe.nightCycle) {
      const phase = t % recipe.nightCycle, wantNight = phase > recipe.nightCycle - 50;
      if (wantNight !== nightOn) {
        nightOn = wantNight; ctx.setNight(wantNight);
        if (wantNight) { dewPulseT = t; pulseNightDews(true); say('🌙 Night falls — bonus Dewdrops sparkle for a little while!', 2400); }
        else pulseNightDews(false);
      }
      if (nightOn && dewPulseT >= 0 && t - dewPulseT > (recipe.dewWindow || 8)) pulseNightDews(false);
    }
    if (a2) a2Update(dt, cam, p, cur);
    for (const pl of plates) {
      let holder = null;
      const chk = (q, idd, heavyOk) => { if (!q || holder) return; const qy = q.y ?? q.gy ?? pl.y; if (Math.hypot(q.x - pl.x, q.z - pl.z) < pl.r && Math.abs(qy - pl.y) < 1.4 && (!pl.heavy || heavyOk || CLASS_OF[idd] === 'bruiser')) holder = idd; };
      if (p) chk(p, cur); for (const cid of ids) if (cid !== cur) chk(ctx.parked(cid), cid);
      if (a2) for (const e of a2.en) {
        if (e.kind === 'fox') chk(e, 'fox:' + e.id, false);
        if (e.kind === 'badger' && e.o.friendly) chk(e, 'badger:' + e.id, true);
      }
      if (holder !== pl.holder) {
        const labelOf = idd => { if (typeof idd === 'string' && idd.includes(':')) { const k = idd.split(':')[0]; return EN_NAME[k] || k; } return nameOf(idd); };
        if (holder && holder !== cur) tst(`📌 ${labelOf(holder)} is holding the ${pl.label}!`, 2000);
        else if (holder && !String(holder).includes(':')) tst(`🟩 ${pl.label} held — swap to a friend, ${nameOf(holder)} will stay put`, 2200);
        pl.holder = holder;
      }
      setSig(pl.sig, !!holder);
      if (pl.sig === 'foxPl') setSig('foxPlFox', !!(holder && String(holder).startsWith('fox:')));
      pl.m.position.y = pl.y + (holder ? 0.02 : 0.12);
      if (pl.icon) pl.icon.visible = !holder;
    }
    if (a2) for (const e of a2.en) if (e.kind === 'fox') e.calm = plates.some(pl => pl.holder === 'fox:' + e.id);
    for (const g of gates) {
      if (g.latch === 'auto') g.latch = !g.need.some(k => plates.some(pl => pl.sig === k));
      const want = g.open && g.latch ? true : isOn(g.need);
      if (want !== g.open) { g.open = want; g.s.off = want; if (g.extra) g.extra.off = want; if (g.lock) g.lock.visible = !want; if (want) { ctx.audio?.sample?.('ui2/gear-equip-clink', 0.35); say(`🚪 ${g.label} opened!`, 1400); } }
      g.k += ((g.open ? 1 : 0) - g.k) * Math.min(1, dt * 6);
      g.m.position.y = g.y - g.k * (g.h - 0.1); g.stripe.position.y = g.m.position.y; g.m.visible = g.k < 0.97; g.stripe.visible = g.m.visible;
    }
    for (const st of steps) {
      const on = isOn(st.sig);
      if (st.r && on && st.r.s.off) { st.r.s.off = false; st.r.m.visible = true; tst('🪜 A new way up appeared!', 1800); }
      if (st.fn) st.fn(on);
      if (st.deco) { const ty = on ? st.down : st.up; st.deco.position.y += (ty - st.deco.position.y) * Math.min(1, dt * 2); }
    }
    for (const pr of props) {
      if (pr.anim) {
        pr.anim.t += dt; const k = Math.min(1, pr.anim.t / 0.9), e = k * k * k * (k * (6 * k - 15) + 10), a = pr.anim.a, b = pr.anim.b;
        const x = a.x + (b.x - a.x) * e, z = a.z + (b.z - a.z) * e, top = a.top + (b.top - a.top) * e;
        pr.holder.position.set(x, top - pr.H / 2, z); pr.s.x = x; pr.s.z = z; pr.s.top = top; pr.s.y0 = top - pr.H;
        if (pr.icon) pr.icon.visible = false;
        if (k >= 1) { pr.anim = null; setSig(pr.sig); if (pr.cross) { const cr = { x0: A.x + pr.cross[0], z0: A.z + pr.cross[1], x1: A.x + pr.cross[2], z1: A.z + pr.cross[3], on: true, thin: false }; crossings.push(cr); clearWaterIn(cr.x0, cr.z0, cr.x1, cr.z1); tst('🪨 A sturdy crossing — Bear can walk across now!', 2200); } fx(x, top, z); }
      }
      if (pr.proj) {
        pr.proj.t += dt; const k = Math.min(1, pr.proj.t / 0.7); pr.proj.m.position.lerpVectors(pr.proj.a, pr.proj.b, k); pr.proj.m.position.y += Math.sin(k * Math.PI) * 2.5;
        if (k >= 1) { pr.proj.m.removeFromParent(); pr.proj = null; setSig(pr.sig); pr.G.rotation.z = 0.6; if (pr.icon) pr.icon.visible = false;
          if (pr.lureOf) { const e = pr.lureOf; e.lure = { x: e.lureAt.x, z: e.lureAt.z, phase: 'go' }; e.awakeT = 0; pr.G.rotation.z = 0; tst(`🌰 Thunk! The ${e.name} waddles off to check the noise…`, 2200); }
          else tst(`🎯 Bonk! ${pr.label} hit`, 1800); ctx.audio?.chime?.(); }
      }
      if (pr.kind === 'tbell') { if (pr.ringT != null && t - pr.ringT < 1.2) pr.G.rotation.z = Math.sin((t - pr.ringT) * 22) * 0.5 * (1 - (t - pr.ringT) / 1.2); else pr.G.rotation.z = 0; }
      if (pr.kind === 'bell') { if (pr.ringT != null && t - pr.ringT < 1.2) pr.G.rotation.z = Math.sin((t - pr.ringT) * 22) * 0.5 * (1 - (t - pr.ringT) / 1.2); else pr.G.rotation.z = 0; }
      if (pr.kind === 'master') updateMasterViz(pr);
      if (pr.icon && !pr.done) pr.icon.position.y += Math.sin(t * 3 + pr.x) * 0.004;
    }
    for (const k of picks) {
      if (k.got) { if (k.m) k.m.userData.atlasShow = false; continue; }
      if (k.nightOnly && !k.alive) { if (k.m) k.m.userData.atlasShow = false; continue; }
      if (k.show && !isOn(k.show)) { k.m.visible = false; k.m.userData.atlasShow = false; continue; }
      k.m.userData.atlasShow = true;
      if (k.m.userData.atlasInst) k.m.visible = false;
      else if (k.show) k.m.visible = true;
      if (!still()) { k.m.rotation.y += dt * 2; k.m.position.y = k.y + Math.sin(t * 2 + k.y) * 0.15; }
    }
    updateAtlasInsts();
    for (const n of nodes) {
      if (n.need && !isOn(n.need)) { n.label.style.display = 'none'; continue; } else if (n.need && !n.done && !n.m.visible) { n.m.visible = true; tst(`✨ ${NODE[n.kind].name} appeared!`, 1800); }
      if (n.done) { n.label.style.display = 'none'; continue; }
      n.body.rotation.y += dt * 0.4;
      const need = NEED[n.kind][size], have = crewAt(n.m.position.x, n.m.position.z, 4.2), pd = p ? Math.hypot(p.x - n.m.position.x, p.z - n.m.position.z) : 99;
      const v = n.m.position.clone(); v.y += 3; v.project(cam);
      const on = v.z < 1 && pd < 30; n.label.style.display = on ? 'block' : 'none';
      if (on) { n.label.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; n.label.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; n.label.textContent = `${NODE[n.kind].name} ${'🐾'.repeat(Math.min(have, need))}${'◯'.repeat(Math.max(0, need - have))}`; }
      // any driven body close enough can start a team lift
      let liftP = (p && pd < 3.2 && Math.abs(p.y - n.m.position.y) < 3) ? p : null;
      if (!liftP) {
        for (const idd of driven) {
          const q = posOfId(idd);
          if (q && Math.hypot(q.x - n.m.position.x, q.z - n.m.position.z) < 3.2 && Math.abs(q.y - n.m.position.y) < 3) { liftP = q; break; }
        }
      }
      if (liftP) {
        if (have >= need) {
          n.done = true; nodesDone++; const N = NODE[n.kind]; addHeal(TIER[N.tier].heal * N.amt); setSig(n.sig);
          tst(n.kind === 'heaviest' ? '💪 You lifted the Starheart together!' : `💪 Lifted the ${N.name}!`, 2400); ctx.audio?.chime?.();
          if (star && n === star.node) { star.carry = true; star.mesh = n.body; n.m.remove(n.body); group.add(n.body); tst('⭐ Carry the Starheart home — gently down the caps!', 3200); }
          else n.m.visible = false;
        } else { n.wob = 0.5; say(`😅 Too heavy! ${need - have} more friend${need - have > 1 ? 's' : ''} close by (${have}/${need}) — 🐻 Bear lifts more`); }
      }
      if (n.wob > 0) { n.wob -= dt; n.body.rotation.z = Math.sin(t * 40) * 0.12 * n.wob; } else n.body.rotation.z = 0;
    }
    if (star && star.carry) {
      const s = star; const cp = p || host.getP();
      s.mesh.position.set(cp.x, cp.y + 2.4, cp.z); s.mesh.rotation.y += dt * 2;
      const vy = (cp.y - s.lastY) / Math.max(dt, 1e-3); s.lastY = cp.y;
      if (vy < -14 && t - s.dropped > 1.5) {
        s.dropped = t; s.carry = false; const low = s.caps.filter(cc => cc.y < cp.y).sort((a, b) => b.y - a.y)[0] || s.caps[0];
        const nn = star.node; nn.done = false; nn.m.position.set(low.x, low.y, low.z); nn.m.add(s.mesh); s.mesh.position.set(0, 1, 0); nn.m.visible = true;
        tst('💫 Whoops! The Starheart bounced onto a lower cap. Go get it!', 2800);
      } else if (Math.hypot(cp.x - s.safe.x, cp.z - s.safe.z) < 4.5 && cp.y < gy(0, 2) + 2.5) {
        s.carry = false; s.mesh.visible = false; star = null; setSig('starHome'); tst('⭐ The Starheart is home!', 2600);
      }
    }
    for (const pz of puzzles) {
      if (pz.done || !pz.sigs.every(k => sig[k])) continue;
      pz.done = true; setSig(pz.id); addHeal(pz.req ? 0.1 : 0.04);
      const left = reqLeft().length;
      tst(`🧩 ${pz.label} solved! ${pz.cls.map(k => CLASSES[k].em).join('')}${left ? ` · ${left} to go` : ''}`, 2600); ctx.audio?.music?.jingle?.('stage') || ctx.audio?.chime?.();
    }
    if (t - lastProg > 45 && t - hintT > 45) { const nx = reqLeft()[0] || puzzles.find(q => !q.done); const pl = nx && pipStuck(nx.id); if (pl) { hintT = t; pipSay(pl); } else if (nx && nx.hint) { hintT = t; tst(`🐦 ${nx.hint}`, 4200); } }
  }
  function update(dt, cam) {
    if (ctx.isNetClient?.()) {
      // Host is authoritative for pickups, pads, sigs, carries, escorts, and complete.
      // Clients still tick mixers so babies and decorations don't freeze.
      for (const mx of babyMixers) try { mx.update(dt); } catch (e) {}
      cullCaveChunks(cam);
      icons.sync(cam);
      return;
    }
    updateWorld(dt, cam);
    cullCaveChunks(cam);
    if (!recipe || recipe.hub) { icons.sync(cam); return; }
    const ids = [...new Set((ctx.driven() || []).filter(Boolean))];
    const view = host.cur();
    if (!ids.length && view) ids.push(view);
    for (const id of ids) updateBody(id, null, cam, dt);
    const p = host.getP();
    if (p) {
      withFocus(view, () => {
        pipUpdate(ctx.getP());
        if (recipe.kid) updateKid(dt);
        checkKey(); updateExit(cam); updateHighlights(dt); updateTracker(cam);
      });
    }
    icons.sync(cam);
  }
  // ---- objective highlights (t158u): every live puzzle prop glows in the colour of the class that solves it ----
  let haloTex = null;
  function haloMap() {
    if (haloTex) return haloTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (haloTex = new THREE.CanvasTexture(c));
  }
  const badgeLock = {};
  const badgeLockOf = c => badgeLock[c] || (badgeLock[c] = { opacity: 0.4, depthTest: false, transparent: true, color: new THREE.Color(0xffffff), userData: { iconKey: 'badge:' + c } });
  function decorateProps() {
    for (const pr of props) {
      const cls = pr.kind === 'plate' ? (pr.plate.heavy ? 'bruiser' : 'trickster') : pr.cls;
      if (!cls || pr.kind === 'marker') continue;
      const col = new THREE.Color(CLASSES[cls].color);
      const air = pr.kind === 'bell' || pr.kind === 'target';
      const hy = { bell: 0, target: 0, lever: 0.9, boulder: pr.from ? pr.from.top - pr.y + 0.8 : 1, cracked: 1.4, slip: 0, vine: 1.2, dig: 0.4, plank: 0.4, plate: 0.4 }[pr.kind] ?? 0.6;
      const big = pr.kind === 'boulder' || pr.kind === 'cracked';
      const halo = icons.make({ key: 'halo', additive: true, material: { opacity: 0.6, depthTest: true, blending: THREE.AdditiveBlending, color: col, userData: { iconKey: 'halo' } } });
      const hs = big ? 4.4 : 2.6; halo.scale.set(hs, hs, 1); halo.position.set(pr.x, pr.y + hy, pr.z); halo.renderOrder = 5; group.add(halo);
      const gyw = air ? gy(pr.x - A.x, pr.z - A.z) : pr.y;
      const R = pr.kind === 'plate' ? (pr.plate.heavy ? 1.75 : 1.45) : pr.kind === 'boulder' ? Math.hypot(pr.s.hx, pr.s.hz) + 0.45 : big ? Math.max(1.4, pr.r - 1.4) : 1.15;
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.2, R, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      ring.position.set(pr.x, gyw + 0.14, pr.z); ring.renderOrder = 4; group.add(ring);
      pr.hl = { halo, ring, s: hs, cls };
    }
  }
  function updateHighlights(dt) {
    for (const pr of props) {
      if (pr.kind === 'marker') { pr.ring.material.opacity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3)); if (kid && kid.glow) { const on = kid.glow.has(pr.sig); pr.ring.visible = on; pr.icon.visible = on; } continue; }
      const h = pr.hl; if (!h) continue;
      let st;
      if (pr.kind === 'plate') { const pl = pr.plate, solved = puzzles.some(q => q.done && q.sigs.includes(pl.sig)); st = solved ? 'done' : pl.holder ? 'held' : 'active'; if (solved && pl.icon) pl.icon.visible = false; }
      else if (pr.two) st = (pr.needIn && !isOn(pr.needIn)) || (pr.need && !isOn(pr.need)) ? 'locked' : 'travel';
      else st = pr.done ? 'done' : (pr.need && !isOn(pr.need)) ? 'locked' : 'active';
      if (pr.secret && !pr.found) { h.halo.visible = false; h.ring.visible = false; continue; }
      if (pr.kind === 'ring') st = pr.act ? 'active' : 'locked';
      else if (pr.re && st === 'active' && !(objCache && objCache.pr === pr)) st = 'travel';
      const focus = objCache && objCache.pr === pr, pulse = 0.5 + 0.5 * Math.sin(t * 3.4 + pr.x);
      const ha = { active: 0.5 + 0.35 * pulse, travel: 0.28, locked: 0.14, held: 0.12, done: 0 }[st], ra = { active: 0.85, travel: 0.4, locked: 0.22, held: 0.35, done: 0 }[st];
      h.halo.visible = ha > 0; h.halo.material.opacity = ha; h.halo.material.depthTest = !(focus && st === 'active'); // the current goal shines through walls
      const sc = h.s * (focus ? 1.5 : 1) * (1 + (st === 'active' ? 0.14 * pulse : 0)); h.halo.scale.set(sc, sc, 1);
      h.ring.visible = ra > 0; h.ring.material.opacity = ra; const rs = 1 + (st === 'active' ? 0.1 * pulse : 0); h.ring.scale.set(rs, 1, rs);
      if (pr.icon && pr.kind !== 'plate' && pr.cls) { const want = st === 'locked' ? badgeLockOf(pr.cls) : badgeOf(pr.cls); if (pr.icon.material !== want) pr.icon.material = want; if (focus && st === 'active') pr.icon.position.y += Math.sin(t * 6) * 0.012; }
      if (kid && kid.glow) { const key = pr.kind === 'plate' ? pr.plate.sig : pr.sig, on = kid.glow.has(key); if (!on) { h.halo.visible = false; h.ring.visible = false; } if (pr.icon) pr.icon.visible = on && !(pr.done && !pr.two) && !(pr.plate && pr.plate.holder); if (pr.plate?.icon) pr.plate.icon.visible = on && !pr.plate.holder; if (pr.ghost) pr.ghost.visible = on && !pr.done; }
      if (st === 'done' && !h.dim) { // solved props dim so the eye skips them
        h.dim = true;
        if (pr.G && !pr.lantern) pr.G.traverse(m => { if (m.isMesh && m.material?.color) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.62); if (m.material.emissiveIntensity) m.material.emissiveIntensity *= 0.25; } });
      }
    }
  }
  // ---- objective tracker + off-screen arrow ----
  const VERB = { bell: 'ring', master: 'ring', lever: 'pull', shove: 'shove', smash: 'smash', throw: 'throw an acorn at', plank: 'lay a plank at', slip: 'slip through', vine: 'climb', dig: 'dig at' };
  const lc = s => /^[A-Z][a-z'-]+( [a-z]|$)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
  function objective() {
    if (!recipe || keyDone || !exitAt) return null;
    if (recipe.kid) return kidObjective();
    if (exitOpen) { const n = crewAtExit(), needB = !!(a2 && a2.escorts.length); return { text: needB ? `Everyone + the baby: walk to the 🏁 exit · ${n}/3${escortAtExit() ? ' + 🐣' : ' + 🥚'}` : `Everyone: walk to the 🏁 exit · ${n}/3`, cls: null, color: '#ffd23f', x: exitAt.x, y: exitAt.y + 1, z: exitAt.z }; }
    let fb = null;
    const seen = new Set();
    const findFor = (k, depth) => { // what produces signal k? follows "needs X first" chains back to the first doable step
      if (sig[k] || depth > 5 || seen.has(k)) return null; seen.add(k);
      const cands = props.filter(q => q.sig === k && q.act && !q.done);
      for (const pr of cands) if (isOn(pr.need)) { if (!pr.cls) return { text: `Anyone: ${VERB[pr.act] || 'use'} the ${lc(pr.label)}`, cls: null, color: '#ffd23f', x: pr.x, y: pr.y, z: pr.z, pr, verb: (ACTS[pr.act] || { verb: 'Act' }).verb }; const C = CLASSES[pr.cls]; return { text: `${C.name}: ${pr.act === 'bell' && pr.lantern ? 'light' : VERB[pr.act]} the ${lc(pr.label)}`, cls: pr.cls, color: C.color, x: pr.x, y: pr.y, z: pr.z, pr, verb: (ACTS[pr.act] || { verb: 'Act' }).verb }; }
      const pl = plates.find(q => q.sig === k && !q.holder);
      if (pl) { const c = pl.heavy ? 'bruiser' : 'trickster'; return { text: `${pl.heavy ? 'Bruiser' : 'A friend'}: stand on the ${lc(pl.label)}`, cls: c, color: CLASSES[c].color, x: pl.x, y: pl.y, z: pl.z, pr: props.find(q => q.plate === pl) }; }
      const h = hoops.find(q => q.sig === k && !q.got);
      if (h) { const first = hoops.find(q => !q.got) || h; return { text: 'Scout: fly through the hoops in order', cls: 'scout', color: CLASSES.scout.color, x: first.m.position.x, y: first.m.position.y, z: first.m.position.z }; }
      const n = nodes.find(q => q.sig === k && !q.done);
      if (n && isOn(n.need)) return { text: `Everyone: lift the ${NODE[n.kind].name} together`, cls: null, color: '#ffd23f', x: n.m.position.x, y: n.m.position.y, z: n.m.position.z };
      if (k === 'starHome' && star && star.carry) return { text: 'Carry the Starheart home, gently', cls: null, color: '#ffd23f', x: star.safe.x, y: baseY + 1, z: star.safe.z };
      for (const pr of cands) for (const nk of [].concat(pr.need || [])) { const r = findFor(nk, depth + 1); if (r) return r; }
      if (n) for (const nk of [].concat(n.need || [])) { const r = findFor(nk, depth + 1); if (r) return r; }
      return null;
    };
    for (const pz of reqLeft()) {
      if (pz.track) { const tk = pz.track.find(q => !sig[q[0]]); if (tk) { const [, c, text, x, z, h = 0.6] = tk, C = c ? CLASSES[c] : null, w = { x: A.x + x, y: gy(x, z) + h, z: A.z + z }; let best = null, bd = 2.2; for (const q of props) { if (!q.act) continue; const d = Math.hypot(q.x - w.x, q.z - w.z); if (d < bd) { bd = d; best = q; } } return { text: C ? `${C.name}: ${text}` : text, cls: c || null, color: C ? C.color : '#ffd23f', x: w.x, y: w.y, z: w.z, pr: best }; } }
      for (const k of pz.sigs) { const r = findFor(k, 0); if (r) return r; }
      if (!fb) fb = pz;
    }
    if (fb) return { text: `${fb.cls.map(c => CLASSES[c].name).join(' + ')}: ${fb.label}`, cls: fb.cls[0], color: CLASSES[fb.cls[0]].color, x: null };
    return null;
  }
  function syncObjH() {
    const el = (objEl && objEl.T) || document.getElementById('objT');
    const h = el && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect().height : 0;
    document.body.style.setProperty('--objH', Math.round(h) + 'px');
  }
  function ensureObjEl() {
    if (objEl) return objEl;
    const T = document.createElement('div'); T.id = 'objT'; T.innerHTML = '<i id="objDot"></i><div><b id="objTx"></b><small id="objSub"></small></div>'; document.body.appendChild(T);
    const Ar = document.createElement('div'); Ar.id = 'objA'; Ar.innerHTML = '<span>➤</span>'; document.body.appendChild(Ar);
    return (objEl = { T, Ar, tx: T.querySelector('#objTx'), sub: T.querySelector('#objSub'), key: '' });
  }
  const _v = new THREE.Vector3();
  function updateTracker(cam) {
    const E = ensureObjEl();
    if (t - hlT > 0.25 || !objCache) {
      hlT = t; objCache = objective();
      const pets = picks.filter(k => k.tier === 'petal' && !k.nightOnly), got = pets.reduce((a, k) => a + (k.got ? k.value || 1 : 0), 0), totV = pets.reduce((a, k) => a + (k.value || 1), 0);
      const sub = [nearOwn ? `🤝 Tap Interact: ${(ACTS[nearOwn.act] || { verb: 'Act' }).verb}` : '', pets.length ? `🌸 ${got}/${totV}` : '', starGot ? '⭐ found' : ''].filter(Boolean).join(' · ');
      const txt = objCache ? objCache.text : '', key = txt + '|' + sub + '|' + (objCache?.color || '');
      if (key !== E.key) { E.key = key; E.tx.textContent = skinText(txt); E.sub.textContent = sub; E.T.style.setProperty('--oc', objCache?.color || '#ffd23f'); E.Ar.style.setProperty('--oc', objCache?.color || '#ffd23f'); E.T.dataset.shape = CLASSES[objCache?.cls]?.shape || ''; }
      E.T.style.display = txt ? 'flex' : 'none'; E.T.classList.toggle('go', !!nearOwn);
      syncObjH();
      document.body.classList.toggle('intReady', !!nearOwn);
    }
    const o = objCache;
    if (!o || o.x == null || !cam) { E.Ar.style.display = 'none'; return; }
    _v.set(o.x, o.y + 0.8, o.z).project(cam);
    let sx = _v.x, sy = _v.y; const behind = _v.z > 1; if (behind) { sx = -sx; sy = -sy; if (Math.abs(sx) < 1e-3 && Math.abs(sy) < 1e-3) sy = -1; }
    const W = innerWidth, H = innerHeight;
    const on = !behind && Math.abs(sx) < 0.92 && sy < 0.75 && sy > -0.55;
    if (on) { E.Ar.style.display = 'none'; return; }
    const m = Math.max(Math.abs(sx) / 0.84, Math.abs(sy) / 0.7, 1e-3), ex = sx / m, ey = sy / m;
    const px = Math.min(W - 28, Math.max(28, (ex + 1) / 2 * W)), py = Math.min(H - 250, Math.max(170, (1 - ey) / 2 * H));
    E.Ar.style.display = 'flex'; E.Ar.style.left = px + 'px'; E.Ar.style.top = py + 'px';
    E.Ar.firstChild.style.transform = `rotate(${-Math.atan2(sy, sx)}rad)`;
  }
  // ---- see-through occluders: hedges / walls / canopies between the camera and the player fade out ----
  function fadeLine(cx, cy, cz, fx, fy, fz, dt) {
    for (const e of fades) e.want = 1;
    if (recipe) for (let i = 0; i <= 12; i++) {
      const u = i / 14, x = cx + (fx - cx) * u, y = cy + (fy - cy) * u, z = cz + (fz - cz) * u;
      for (const e of fades) if (x > e.x0 && x < e.x1 && z > e.z0 && z < e.z1 && y > e.y0 && y < e.y1) e.want = 0.2;
    }
    for (const e of fades) {
      if (!e.cl && e.want >= 1) continue;
      if (e.cl && Math.abs(e.a - e.want) < 0.005) continue;
      e.cl = true; e.a += (e.want - e.a) * Math.min(1, dt * 10); if (Math.abs(e.a - e.want) < 0.01) e.a = e.want;
      if (e.inst && e.ims) {
        const hide = e.a < 0.6, M = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0);
        e.ims.forEach((im, k) => { if (!im || !e.bases[k]) return; im.setMatrixAt(e.i, hide ? Z : e.bases[k]); im.instanceMatrix.needsUpdate = true; });
        continue;
      }
      if (!e.roots) continue;
      for (const r of e.roots) r.traverse(m => {
        if (!m.isMesh) return;
        if (!m.userData._fc) { m.userData._fc = 1; m.material = m.material.clone(); m.userData._fo = m.material.opacity ?? 1; m.material.transparent = true; }
        m.material.opacity = m.userData._fo * e.a; m.material.depthWrite = e.a > 0.9;
      });
    }
  }
  // ---- Training Garden runtime (t159u): one tiny step at a time, a big picture card, a pointing hand ----
  const _spPos = new THREE.Vector3();
  function emojiSprite(e, s = 1.4, clamp = false) {
    const key = 'em:' + e;
    icons.packEmoji(e);
    const sp = icons.make({ key, size: s, clamp, layer: 'depth' });
    sp.scale.set(s, s, 1); sp.renderOrder = 9;
    return sp;
  }
  let kid = null;
  const crewOfCls = c => ctx.crewIds().find(i => CLASS_OF[i] === c);
  const posOf = id => id === ctx.cur() ? ctx.getP() : ctx.parked(id);
  const K = {
    sig: k => !!sig[k], cls: () => clsOfCur(),
    em: c => { const id = crewOfCls(c); return id ? String(nameOf(id)).split(' ')[0] : CLASSES[c].em; },
    at: (c, x, z, r) => { const q = posOf(crewOfCls(c)); return !!q && Math.hypot(q.x - A.x - x, q.z - A.z - z) < r && q.y - gy(q.x - A.x, q.z - A.z) < 1.3; },
    held: s => plates.some(pl => pl.sig === s && pl.holder),
    season: () => a2 ? a2.season : 'summer', night: () => !!(a2 && a2.night), wind: () => a2 ? a2.wind : -1,
    carry: c => !!(a2 && a2.acorn && a2.acorn.by && CLASS_OF[a2.acorn.by] === c), borrow: () => { const S = AA(); if (!S.borrow) { S.borrow = { lantern: true, whistle: true, eqL: true, eqW: true }; S.pingNext = t; ctx.onGear?.(); } return true; },
    gearOn: k => gearOn(k), sneak: () => sneak, dew: () => !!(a2 && a2.dew), pinged: () => !!sig.ping, lit: id => !!sig['lit:' + id], called: () => !!(a2 && a2.escorts.some(b => b.called)), escortAt: () => escortAtExit(),
    curY: () => { const p = ctx.getP(); return p.y - gy(p.x - A.x, p.z - A.z); },
  };
  function kidDom() {
    if (kid.dom) return kid.dom;
    const C = document.createElement('div'); C.id = 'kidCard';
    C.innerHTML = '<img id="kidPip" alt="" src="' + at1x('./ui/portraits/guide-happy-blocky.webp') + '"><div class="kcB"><div id="kidIc"></div><div id="kidW"></div><div id="kidNudge" style="display:none"></div><div id="kidDots"></div></div>';
    const H = document.createElement('div'); H.id = 'kidHand'; H.innerHTML = '<i></i><b>Hold</b>';
    const F = document.createElement('div'); F.id = 'kidFx';
    document.body.append(C, H, F);
    return (kid.dom = { C, H, F, ic: C.querySelector('#kidIc'), w: C.querySelector('#kidW'), dots: C.querySelector('#kidDots'), nudge: C.querySelector('#kidNudge'), pulse: null });
  }
  function kidInit() {
    kid = { steps: recipe.steps(K), latch: [], herded: [], max: 0, i: -1, slip: -1, dom: null, trails: [], init: false, celebT: -9, safe: null };
    for (const st of kid.steps) {
      const G = new THREE.Group(); G.visible = false; group.add(G); kid.trails.push(G);
      if (!st.trail) continue;
      const col = new THREE.Color(st.color ? CLASSES[st.color].color : '#ffd23f');
      const shp = new THREE.Shape(); shp.moveTo(0, 0.55); shp.lineTo(0.6, -0.1); shp.lineTo(0.3, -0.1); shp.lineTo(0, 0.22); shp.lineTo(-0.3, -0.1); shp.lineTo(-0.6, -0.1); shp.closePath();
      const geo = new THREE.ShapeGeometry(shp).rotateX(-Math.PI / 2);
      for (let k = 0; k < st.trail.length - 1; k++) {
        const [ax, az] = st.trail[k], [bx, bz] = st.trail[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(L / 1.3)), yaw = Math.atan2(bx - ax, bz - az);
        for (let j = 0; j <= n; j++) {
          const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n;
          const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
          m.position.set(A.x + x, gy(x, z) + 0.1, A.z + z); m.rotation.y = yaw + Math.PI; m.userData.k = G.children.length; m.renderOrder = 3; G.add(m);
        }
      }
    }
    document.body.classList.add('kidTut');
  }
  function herd(h) {
    if (!h) return;
    for (const c of Object.keys(h)) {
      const id = crewOfCls(c); if (!id || id === ctx.cur()) continue; const q = ctx.parked(id); if (!q) continue;
      const v = h[c]; if (!Array.isArray(v)) continue;
      const [x, z, base] = v; q.x = A.x + x; q.z = A.z + z; q.y = gy(x, z) + (base || 0) + 0.6; q.vx = q.vy = q.vz = 0; q._safe = { x: q.x, z: q.z }; q.goto = null; q.yaw = 0;
      fx(q.x, q.y + 0.6, q.z);
    }
  }
  function confetti(big) {
    const F = kidDom().F, cols = ['#ff7fbf', '#ffd23f', '#4aa8ff', '#7dc85a', '#ff8a1f', '#b08aff'];
    for (let i = 0; i < (big ? 70 : 34); i++) {
      const e = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 90 + Math.random() * (big ? 220 : 140);
      e.style.cssText = `background:${cols[i % cols.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d * 0.8 + 160}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.12}s`;
      F.appendChild(e); setTimeout(() => e.remove(), 1700);
    }
    const s = document.createElement('b'); s.textContent = big ? '🎉' : '⭐'; F.appendChild(s); setTimeout(() => s.remove(), 1300);
  }
  function celebrate(st, stationDone) {
    kid.celebT = t; confetti(stationDone);
    ctx.audio?.sample?.(stationDone ? 'contest/win-jingle' : 'build/upgrade-sparkle', stationDone ? 0.5 : 0.45);
    const p = ctx.getP(); fx(p.x, p.y + 1, p.z);
  }
  function kidTargetRect(st) {
    if (Array.isArray(st.point)) { for (const q of st.point) { const r = kidTargetRect({ ...st, point: q }); if (r) return r; } return null; } // first pointer that applies (e.g. dock swap, then Interact)
    const pt = st.point; if (!pt) return null;
    const R = el => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { el, x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
    if (pt === 'joy') return { el: null, x: innerWidth * 0.26, y: innerHeight - 150, drag: true };
    if (st.nearPt) { const p = ctx.getP(); if (Math.hypot(p.x - A.x - st.nearPt[0], p.z - A.z - st.nearPt[1]) > st.nearPt[2]) return null; }
    if (pt === 'jump') return R(document.getElementById('bJump'));
    if (pt === 'sneak') return R(document.getElementById('bSneak'));
    if (pt === 'int') return nearOwn && st.glow && st.glow.includes(nearOwn.sig) ? R(document.getElementById('bInt')) : null;
    if (pt.startsWith('dock:')) { const c = pt.slice(5); return clsOfCur() === c ? null : R(document.querySelector('#crewDock button.cls-' + c)); }
    if (pt === 'exit' && exitAt && crewIn(ctx.getP())) { for (const c of ['scout', 'trickster', 'bruiser']) { const id = crewOfCls(c); if (id && id !== ctx.cur() && !crewIn(ctx.parked(id))) return R(document.querySelector('#crewDock button.cls-' + c)); } }
    return null;
  }
  // the step card: icons, words, dots, trail. Split out so the level-start warm can draw step 0 in the load hitch
  // (its first forced style/layout costs ~80 ms on phone-class CPUs if it lands in frame 1).
  function kidCard(i, D) {
    const st = kid.steps[i];
    kid.i = i; kid.kd = keyDone;
      const icons = keyDone ? ['⭐', '⭐', '⭐'] : st.icons, words = keyDone ? 'You did it!' : st.say;
      D.ic.innerHTML = icons.map(x => `<span>${x}</span>`).join('');
      D.w.textContent = skinText(words);
      const N = kid.steps[kid.steps.length - 1].n;
      D.dots.innerHTML = Array.from({ length: N }, (_, k) => `<i class="${k + 1 < st.n || keyDone ? 'ok' : k + 1 === st.n ? 'now' : ''}"></i>`).join('');
      D.C.style.setProperty('--kc', st.color ? CLASSES[st.color].color : '#ffd23f');
      D.C.classList.remove('pop'); void D.C.offsetWidth; D.C.classList.add('pop');
      kid.trails.forEach((G, k) => G.visible = k === i && !keyDone);
      kid.glow = new Set(keyDone ? [] : st.glow || []);
  }
  function updateKid(dt) {
    if (!kid) kidInit();
    const p = ctx.getP(), D = kidDom();
    if (clsOfCur() === 'scout') { p.stam = 1; p.tired = false; } // little wings never get tired here
    if (!kid.init && t > 0.05) {
      const KS = recipe.kidStart || { me: [0.5, -3], scout: [-2.5, -3.5], bruiser: [3, -5.5] };
      kid.init = true; herd({ scout: KS.scout, bruiser: KS.bruiser, trickster: KS.trickster });
      if (Array.isArray(KS.me)) { p.x = A.x + KS.me[0]; p.z = A.z + KS.me[1]; p.y = gy(KS.me[0], KS.me[1]) + 0.5; p.vx = p.vy = p.vz = 0; p._safe = { x: p.x, z: p.z }; p.yaw = 0; ctx.camYaw?.(0); }
    }
    // gentle safety net: anyone who ends up outside the path pops back to the last safe spot
    const lx = p.x - A.x, lz = p.z - A.z;
    const KB = recipe.kidBounds || { x0: -4.9, x1: 4.9, z0: -9.2, z1: 65.2 };
    if (lx > KB.x0 && lx < KB.x1 && lz > KB.z0 && lz < KB.z1 && p.y > baseY - 3) { if (p.grounded) kid.safe = { x: p.x, y: p.y, z: p.z }; }
    else if (kid.safe && !tw) { p.x = kid.safe.x; p.y = kid.safe.y + 0.5; p.z = kid.safe.z; p.vx = p.vy = p.vz = 0; p._safe = { x: p.x, z: p.z }; fx(p.x, p.y, p.z); }
    // flowers: touch to pick
    for (const f of kidObjs) {
      if (f.got) { f.head.rotation.z += dt * 2; continue; }
      f.head.rotation.y = Math.sin(t * 2) * 0.4; f.head.position.y = 1.15 + Math.sin(t * 3) * 0.08;
      if (Math.hypot(p.x - f.x, p.z - f.z) < 1.7 && Math.abs(p.y - f.y) < 1.3) { f.got = true; setSig(f.key); }
    }
    setSig('door7', K.held('p7') || K.sig('b7'));
    if (ctx.cur() !== kid.lastCur) { kid.lastCur = ctx.cur(); if (t > 0.2) ctx.camYaw?.(0); } // after a swap, look straight down the path again
    // which step are we on? (latched steps stay done; "hold" steps can slip back if Bear walks off his plate)
    let i = 0;
    for (; i < kid.steps.length; i++) { const st = kid.steps[i]; if (kid.latch[i]) continue; if (st.done()) { if (st.latch !== false) kid.latch[i] = true; continue; } break; }
    i = Math.min(i, kid.steps.length - 1);
    const raw = i; // where the hold logic says we are (a latch:false hold can slip back)
    if (i > kid.max) {
      for (let j = kid.max; j < i; j++) { if (!kid.herded[j]) { kid.herded[j] = true; herd(kid.steps[j].herd); } }
      // a new stop began: lock in every earlier stop's steps so a "Tap the …" card can never slip back to an old stop
      for (let j = 0; j < i; j++) if (kid.steps[j].n < kid.steps[i].n) kid.latch[j] = true;
      celebrate(kid.steps[i - 1], kid.steps[i - 1].n !== kid.steps[i].n); kid.max = i;
    }
    // POLISH (Fern regression KID-02/03/07): the card cursor is forward-only. A slipped latch:false hold (Bear off the plate,
    // swapped away from the class) no longer pops the card back; a small "↩" nudge + the pointing hand show the slipped step instead.
    i = Math.max(i, kid.max);
    const slip = raw < i && !keyDone ? raw : -1;
    if (slip !== kid.slip) { kid.slip = slip; if (D.nudge) { D.nudge.textContent = slip >= 0 ? '↩ ' + skinText(kid.steps[slip].say) : ''; D.nudge.style.display = slip >= 0 ? 'block' : 'none'; } }
    const st = kid.steps[i];
    if (i !== kid.i || keyDone !== kid.kd) kidCard(i, D);
    // ground arrows: a wave of light running toward the goal
    const G = kid.trails[i]; if (G && G.visible) G.children.forEach(m => { m.material.opacity = 0.35 + 0.55 * Math.max(0, Math.sin(t * 5 - m.userData.k * 0.7)); });
    for (const f of kidObjs) { const on = kid.glow.has(f.key) && !f.got; f.halo.visible = on; f.ring.visible = on; if (on) { const s = 2.6 + 0.5 * Math.sin(t * 4); f.halo.scale.set(s, s, 1); } }
    // the pointing hand
    const R = keyDone || t - kid.celebT < 0.7 ? null : kidTargetRect(kid.slip >= 0 ? kid.steps[kid.slip] : st);
    if (D.pulse && (!R || R.el !== D.pulse)) { D.pulse.classList.remove('kidPulse'); D.pulse = null; }
    if (R) {
      D.H.style.display = 'block'; D.H.style.left = (R.x - 52) + 'px'; D.H.style.top = (R.y - 24) + 'px';
      D.H.classList.toggle('drag', !!R.drag); D.H.classList.toggle('hold', !!st.hold);
      if (R.el && D.pulse !== R.el) { R.el.classList.add('kidPulse'); D.pulse = R.el; }
    } else D.H.style.display = 'none';
  }
  function kidObjective() {
    const st = kid && kid.steps[kid.slip >= 0 ? kid.slip : kid.i]; if (!st || !st.tgt) return null;
    const [x, y, z] = typeof st.tgt === 'function' ? st.tgt() : st.tgt, c = st.color;
    return { text: st.say, cls: c || null, color: c ? CLASSES[c].color : '#ffd23f', x: A.x + x, y: gy(x, z) + y, z: A.z + z, pr: props.find(q => st.glow && st.glow.includes(q.sig) && q.act) || null };
  }
  function kidClear() {
    if (kid && kid.dom) { kid.dom.C.remove(); kid.dom.H.remove(); kid.dom.F.remove(); kid.dom.pulse?.classList.remove('kidPulse'); }
    kid = null; kidObjs = []; document.body.classList.remove('kidTut');
  }
  function rect() { const b = recipe?.bounds || { x0: -20, x1: 20, z0: -20, z1: 20 }; return { x0: A.x + b.x0, x1: A.x + b.x1, z0: A.z + b.z0, z1: A.z + b.z1 }; }
  function forcePuzzles(ids) {
    // Test hook for Fern session C (fail-stars): mark required puzzles done and open the exit
    // without collecting petals or the Starseed. Does not finish the level; checkKey still
    // needs the crew (and baby) at the flag.
    const want = Array.isArray(ids) && ids.length ? new Set(ids) : null;
    const out = [];
    for (const pz of puzzles) {
      if (want && !want.has(pz.id)) continue;
      for (const k of pz.sigs) setSig(k);
      pz.done = true; setSig(pz.id); out.push(pz.id);
    }
    checkKey();
    return out;
  }

  function bodySnap(id) {
    const p = ctx.parked(id); if (!p) return null;
    return {
      x: p.x - A.x, y: p.y - baseY, z: p.z - A.z,
      yaw: p.yaw || 0, vx: p.vx || 0, vy: p.vy || 0, vz: p.vz || 0,
      grounded: !!p.grounded, flying: !!(p.flapping || p.flying), sneak: !!p.sneak,
      carried: p.carried || 0, anim: Math.round(((p.t || 0) % 1) * 255) & 255,
    };
  }
  function netState() {
    const ids = ctx.crewIds() || [];
    const bodies = {};
    for (const id of ids) { const b = bodySnap(id); if (b) bodies[id] = b; }
    const S = a2;
    const enemies = S ? S.en.map(e => ({ id: e.id, kind: e.kind, x: e.x - A.x, z: e.z - A.z, y: e.y - baseY, yaw: e.yaw || 0, st: e.st, sus: e.sus || 0 })) : [];
    const escorts = S ? S.escorts.map((b, i) => ({ i, kind: b.kind, x: b.x - A.x, y: b.y - baseY, z: b.z - A.z, yaw: b.yaw || 0, called: !!b.called, following: !!b.following, hide: !!b.hide, leadBody: b.leadBody || null })) : [];
    const movers = [];
    if (S) {
      (S.logs || []).forEach((l, i) => movers.push({ id: i, kind: 'log', x: l.x - A.x, y: (l.y || 0) - baseY, z: l.z - A.z, yaw: l.yaw || 0 }));
      (S.shots || []).forEach((s, i) => movers.push({ id: 16 + i, kind: 'shot', x: s.x - A.x, y: (s.y || 0) - baseY, z: s.z - A.z, yaw: s.yaw || 0 }));
      (S.movers || []).forEach((m, i) => { const q = m.q || m; movers.push({ id: 32 + i, kind: 'mover', x: (q.x || 0) - A.x, y: (q.y || 0) - baseY, z: (q.z || 0) - A.z, yaw: q.yaw || 0 }); });
    }
    const mill = S && (S.wheels.length || S.grates.length || S.ponds.length) ? {
      ponds: S.ponds.map(q => ({ id: q.id, level: q.level, wy: +pondSurf(q).toFixed(2) })),
      wheels: S.wheels.map(w => ({ id: w.id, spin: !!(w.spin && sig[w.spin]), rot: w.G ? w.G.rotation.z : 0 })),
      grates: S.grates.map(g => ({ x0: g.x0 - A.x, z0: g.z0 - A.z, x1: g.x1 - A.x, z1: g.z1 - A.z })),
    } : null;
    // S4 Master Bell (shipped): ride state/next/start/cool on the snapshot.
    const bell = S && S.master ? S.master.state : ((typeof ctx.masterBell === 'function' ? ctx.masterBell() : null) ?? (S && S.bell != null ? S.bell : null));
    const master = S && S.master ? { state: S.master.state, next: S.master.next, start: S.master.start, cool: +Math.max(0, (S.master.coolUntil || 0) - t).toFixed(2) } : null;
    return {
      id, t, keyDone, starGot, exitOpen, picked, keyDew,
      sig: { ...sig },
      bodies, bodyIds: ids.slice(),
      enemies, escorts, movers,
      props: props.map((pr, i) => ({ i, act: pr.act, sig: pr.sig, done: !!pr.done })),
      picks: picks.map((k, i) => ({ i, tier: k.tier, got: !!k.got })),
      hoops: hoops.map((h, i) => ({ i, got: !!h.got })),
      plates: plates.map(pl => ({ sig: pl.sig, holder: pl.holder })),
      cps: S ? S.cps.map((c, i) => ({ i, x: +(c.x - A.x).toFixed(2), z: +(c.z - A.z).toFixed(2), on: !!c.on, active: S.cp === c })) : [],
      world: S ? { night: !!S.night, season: S.season, wind: S.wind, time: S.time || (S.night ? 'night' : 'day'), windMag: S.windMag ?? (S.wind ? 6 : 0), pouch: !!(S.pouch && S.pouch.full), heldTool: S.heldTool || null } : null,
      gear: { ...gear },
      mill, bell, master,
      A: { ...A }, baseY,
    };
  }
  function applyBody(id, b) {
    if (!id || !b) return;
    const p = ctx.parked(id); if (!p) return;
    if (b.x != null) p.x = A.x + b.x;
    if (b.z != null) p.z = A.z + b.z;
    if (b.y != null) p.y = baseY + b.y;
    if (b.yaw != null) p.yaw = b.yaw;
    if (b.vx != null) p.vx = b.vx;
    if (b.vy != null) p.vy = b.vy;
    if (b.vz != null) p.vz = b.vz;
    if (b.grounded != null) p.grounded = !!b.grounded;
    if (b.sneak != null) p.sneak = !!b.sneak;
    if (b.carried != null) p.carried = b.carried;
  }
  function applyNetState(state) {
    if (!state) return false;
    applyingNet = true;
    try {
      if (state.sig) {
        for (const [k, v] of Object.entries(state.sig)) {
          if (!!sig[k] === !!v) continue;
          if (v) { sig[k] = true; lastProg = t; } else delete sig[k];
        }
        if (state.sigFull) {
          for (const k of Object.keys(sig)) if (!state.sig[k]) delete sig[k];
        }
      }
      if (state.bodies) {
        for (const id of Object.keys(state.bodies)) applyBody(id, state.bodies[id]);
      }
      if (state.poseOnly) return true;
      if (state.keyDone && !keyDone && state.result) result = state.result;
      if (state.keyDone) keyDone = true;
      if (state.starGot) starGot = true;
      if (state.exitOpen != null) exitOpen = !!state.exitOpen;
      if (state.picked != null) picked = state.picked;
      if (state.enemies && a2) {
        for (let i = 0; i < state.enemies.length && i < a2.en.length; i++) {
          const s = state.enemies[i], e = a2.en[i];
          if (s.x != null) e.x = A.x + s.x;
          if (s.z != null) e.z = A.z + s.z;
          if (s.y != null) e.y = baseY + s.y;
          if (s.yaw != null) e.yaw = s.yaw;
          if (s.st) e.st = s.st;
          if (s.sus != null) e.sus = s.sus;
          if (e.G) e.G.position.set(e.x, e.y, e.z);
        }
      }
      if (state.escorts && a2) {
        for (let i = 0; i < state.escorts.length && i < a2.escorts.length; i++) {
          const s = state.escorts[i], b = a2.escorts[i];
          if (s.x != null) b.x = A.x + s.x;
          if (s.z != null) b.z = A.z + s.z;
          if (s.y != null) b.y = baseY + s.y;
          if (s.yaw != null) b.yaw = s.yaw;
          if (s.called != null) b.called = !!s.called;
          if (s.following != null) b.following = !!s.following;
          if (s.leadBody !== undefined) b.leadBody = s.leadBody || null;
          if (s.hide != null) b.hide = !!s.hide;
          if (b.G) b.G.position.set(b.x, b.y, b.z);
        }
      }
      if (state.movers && a2) {
        for (const s of state.movers) {
          if (s.kind === 'log' && a2.logs[s.id]) {
            const l = a2.logs[s.id];
            if (s.x != null) l.x = A.x + s.x;
            if (s.z != null) l.z = A.z + s.z;
            if (s.y != null) l.y = baseY + s.y;
          }
        }
      }
      if (state.picks) {
        for (const s of state.picks) {
          const k = picks[s.i]; if (!k) continue;
          if (s.got && !k.got) { k.got = true; if (k.m) k.m.visible = false; k.alive = false; }
        }
      }
      if (state.props) {
        for (const s of state.props) {
          const pr = props[s.i]; if (!pr) continue;
          if (s.done) { pr.done = true; if (pr.icon) pr.icon.visible = false; }
        }
      }
      if (state.hoops) {
        for (const s of state.hoops) { const h = hoops[s.i]; if (h && s.got) h.got = true; }
      }
      if (state.cps && a2) {
        for (const s of state.cps) {
          const c = a2.cps[s.i]; if (!c) continue;
          if (s.on && !c.on) { c.on = true; if (c.f && c.f.material) c.f.material = mat(0xff5a5a, 0.5); }
          if (s.active) a2.cp = c;
        }
      }
      if (state.world && a2) {
        if (state.world.night != null && a2.night !== !!state.world.night) setNightA2(!!state.world.night);
        if (state.world.season && a2.season !== state.world.season) { a2.season = state.world.season; }
        if (state.world.wind != null && a2.wind !== state.world.wind) applyWind(state.world.wind, true);
        if (state.world.pouch != null && a2.pouch) a2.pouch.full = !!state.world.pouch;
        if (state.world.heldTool !== undefined) a2.heldTool = state.world.heldTool;
      }
      if (state.mill && a2) {
        if (state.mill.ponds) {
          for (const ps of state.mill.ponds) {
            const pd = a2.ponds.find(q => q.id === ps.id);
            if (pd && ps.level && pd.level !== ps.level) setPond(pd, ps.level, true);
          }
        }
        if (state.mill.wheels) {
          for (const ws of state.mill.wheels) {
            const w = a2.wheels.find(q => q.id === ws.id);
            if (w && w.G && ws.rot != null) w.G.rotation.z = ws.rot;
          }
        }
      }
      if (state.bell != null || (state.master && state.master.state)) {
        const st = state.bell || state.master.state;
        applyMaster(st, { quiet: true, net: true });
        if (a2.master && state.master && state.master.cool != null) a2.master.coolUntil = t + Math.max(0, +state.master.cool);
      }
      if (state.gear) Object.assign(gear, state.gear);
    } finally { applyingNet = false; }
    return true;
  }
  function applyNetEvent(ev) {
    if (!ev) return false;
    applyingNet = true;
    try {
      const kind = ev.kind || ev.type;
      if (kind === 'sig' && ev.sig) setSig(ev.sig, ev.v !== false);
      if (kind === 'pick' && ev.idx != null && picks[ev.idx] && !picks[ev.idx].got) {
        const k = picks[ev.idx]; k.got = true; if (k.m) k.m.visible = false; k.alive = false;
      }
      if (kind === 'checkpoint' && a2) {
        const c = a2.cps.find(q => Math.abs((q.x - A.x) - ev.x) < 0.2 && Math.abs((q.z - A.z) - ev.z) < 0.2) || a2.cps[ev.i];
        if (c && !c.on) { c.on = true; a2.cp = c; if (c.f) c.f.material = mat(0xff5a5a, 0.5); }
      }
      if (kind === 'gear') {
        if (ev.k && ev.equip && ev.on != null) setGear(ev.k, ev.on, true);
        if (ev.slot && ev.k) setSlot(ev.slot, ev.k);
      }
      if (kind === 'complete' && ev.result && !keyDone) { result = ev.result; keyDone = true; }
      if (kind === 'toast' && ev.text) ctx.toast(ev.text, ev.ms);
    } finally { applyingNet = false; }
    // Re-run setSig path without the applyingNet guard for visual steps? already set sig directly via setSig inside applyingNet (no emit). Good.
    return true;
  }


  /** Unhide kid trails / glow marks so their programs compile during ready-wait, not at GO. */
  function primeReadyVisuals() {
    if (!recipe) return null;
    matLive = true; // materials made by mat() from now on are styled at birth (no unstyled first draw mid-play)
    const hidden = [], temp = [];
    // exit open/closed + checkpoint flag materials: create (and so style) both looks before GO
    for (const [c, e] of [[0xffc93c, 0.6], [0x9a8f7a, 0.6], [0xff5a5a, 0.8], [0xb0b0b0, 0.8], [0xff5a5a, 0.5]]) mat(c, e);
    // Act 2 gear: the worn-gear models and the stump gear badges are built lazily by updGear (frozen until GO), so
    // build them now and show them for the warm draw
    if (a2) {
      try {
        const V = gearViz();
        for (const k of ['pouch', 'glider', 'sling']) if (V[k] && !V[k].visible) { V[k].visible = true; hidden.push(V[k]); }
      } catch (e) {}
    }
    // late sprites (gear / emoji / text badges, pops) that can first appear just after GO: warm the sprite program
    // variants. Built once and reused; their materials are never disposed (dispose would release the warmed programs).
    try {
      if (!warmSpr) { warmSpr = [];
        const ks = Object.keys(GEAR_INFO), ki = ks.find(k => GEAR_INFO[k].icon); if (ki) warmSpr.push(gearSprite(ki, 0.01));
        const cv = document.createElement('canvas'); cv.width = cv.height = 4; const tx = new THREE.CanvasTexture(cv), tx2 = new THREE.CanvasTexture(cv); tx2.colorSpace = THREE.SRGBColorSpace;
        for (const tt of [tx, tx2]) for (const fog of [true, false]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt, transparent: true, depthWrite: false, fog })); sp.scale.set(0.01, 0.01, 1); warmSpr.push(sp); }
      }
      for (const sp of warmSpr) { group.add(sp); temp.push(sp); }
    } catch (e) {}
    try { const un = icons.warm(); if (un) temp.push({ parent: { remove() {} }, _iconUnwarm: un }); } catch (e) {}
    // GLB set-dressing (lambertFrom materials: textured or plain, flat, Front/Double side, instanced decos) can finish
    // loading after the level starts on a slow device: warm those program variants with tiny stand-ins styled with
    // this level's look. One set per pastel style key, built once and kept (never disposed), so a level whose look
    // matches an earlier one links nothing new here.
    try {
      if (!warmTex) { warmTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); warmTex.needsUpdate = true; warmTex.colorSpace = THREE.SRGBColorSpace; warmBox = new THREE.BoxGeometry(0.01, 0.01, 0.01); }
      const probe = new THREE.MeshLambertMaterial({ flatShading: true }); styleNew(new THREE.Mesh(warmBox, probe));
      const sig = probe.customProgramCacheKey ? probe.customProgramCacheKey() : '';
      let set = warmGlb.get(sig);
      if (!set) {
        set = [];
        for (const [map, side, inst] of [[warmTex, THREE.FrontSide, false], [warmTex, THREE.DoubleSide, false], [warmTex, THREE.FrontSide, true], [warmTex, THREE.DoubleSide, true], [null, THREE.DoubleSide, false]]) {
          const m = new THREE.MeshLambertMaterial({ map, flatShading: true, side });
          const o = inst ? new THREE.InstancedMesh(warmBox, m, 1) : new THREE.Mesh(warmBox, m); if (inst) o.setMatrixAt(0, new THREE.Matrix4());
          styleNew(o); set.push(o);
        }
        warmGlb.set(sig, set);
      }
      for (const o of set) { group.add(o); temp.push(o); }
    } catch (e) {}
    const undo = () => { for (const o of hidden) o.visible = false; for (const o of temp) { if (o && o._iconUnwarm) o._iconUnwarm(); else o.parent?.remove(o); } };
    if (!recipe.kid) return undo;
    if (!kid) kidInit();
    for (const G of kid.trails) { if (!G.visible) { G.visible = true; hidden.push(G); } }
    for (const f of kidObjs) {
      if (f.halo && !f.halo.visible) { f.halo.visible = true; hidden.push(f.halo); }
      if (f.ring && !f.ring.visible) { f.ring.visible = true; hidden.push(f.ring); }
    }
    return undo;
  }
  function status() { return { id, t, exit: exitAt ? { x: exitAt.x - A.x, z: exitAt.z - A.z, open: exitOpen, n: crewAtExit() } : null, starGot, sig: { ...sig }, puzzles: puzzles.map(p => ({ id: p.id, done: p.done, req: p.req })), keyDone, picked, keyDew, props: props.filter(p => p.act).map(p => ({ act: p.act, cls: p.cls, sig: p.sig, label: p.label, x: p.x, y: p.y, z: p.z, done: !!p.done, b: p.b || null, from: p.from || null })), plates: plates.map(p => ({ sig: p.sig, x: p.x, y: p.y, z: p.z, heavy: p.heavy, holder: p.holder })), nodes: nodes.map(n => ({ kind: n.kind, x: n.m.position.x, y: n.m.position.y, z: n.m.position.z, done: n.done, sig: n.sig })), picks: picks.map(k => ({ tier: k.tier, x: k.m.position.x, y: k.y, z: k.m.position.z, got: k.got, show: k.show || null, who: k.who || null, night: k.nightOnly, value: k.value || 1, bloom: !!k.bloom })), hoops: hoops.map(h => ({ x: h.m.position.x, y: h.m.position.y, z: h.m.position.z, got: h.got })), A: { ...A }, baseY, petalValue: petalV, kid: kidState(), cps: a2 ? a2.cps.map(c => ({ x: +(c.x - A.x).toFixed(2), h: +(c.y - baseY).toFixed(2), z: +(c.z - A.z).toFixed(2), show: c.show, vis: c.G.visible, on: c.on })) : [], chains: (a2?.acorns || []).map(c => ({ id: c.id, timed: c.timed, win: c.win, ezWin: c.win * EZ('acorn') })), easy: !!ctx.easy?.() }; }
  /** kid-tutorial cursor (Fern regression §0.6): i = forward-only card index, max = high-water mark, n = station, slip = slipped hold step or -1 */
  function kidState() { if (!kid || !kid.steps) return null; const st = kid.steps[Math.max(0, kid.i)]; return { i: kid.i, max: kid.max, n: st ? st.n : 0, slip: kid.slip, latch: !!(st && st.latch !== false), safe: kid.safe ? { x: +(kid.safe.x - A.x).toFixed(2), z: +(kid.safe.z - A.z).toFixed(2) } : null, say: st ? st.say : '', slipSay: kid.slip >= 0 ? kid.steps[kid.slip].say : null }; }
  function removeFriendsStation() {
    hubPads = hubPads.filter(h => {
      if (h.key !== 'friends') return true;
      try { h.el?.remove(); } catch (e) {}
      for (const obj of [h.ring, h.em, h.model]) { if (obj && obj.parent) obj.parent.remove(obj); }
      return false;
    });
  }
  function refreshFriendsStation(show) {
    const on = show != null ? !!show : canShowFriendsStation(ctx.settings?.() || {});
    const has = hubPads.some(h => h.key === 'friends');
    if (!on && has) removeFriendsStation();
    else if (on && !has && friendsSpec && recipe && recipe.hub) {
      const { key, x, z, o } = friendsSpec;
      B.hubPad(key, x, z, { ...o, gated: false });
      if (recipe.hub) hubInit();
    }
  }
  return {
    homePos: () => homeAt || { x: A.x, z: A.z }, load: (a, b) => { keyDew = 0; homeAt = null; load(a, b); }, warmTick: cam => { try { if (recipe && recipe.kid) { if (!kid) kidInit(); if (kid.i < 0) kidCard(0, kidDom()); } /* tutorial: build trails + draw the step-0 card in the load hitch (UI only: no pickups, herding, signals or timers) */ /* build-only: hidden trail meshes + body class, no pickups/herding/timers */ if (a2 && a2.escorts.length) updEscort(0, cam, ctx.getP(), ctx.cur()); } catch (e) {} }, primeReadyVisuals, root: () => group, clear, update, updateWorld, updateBody, driven: () => ctx.driven(), netState, applyNetState, applyNetEvent, setSig, keyGoalMet, complete, tweening: () => !!tw, goal: () => recipe?.goal || '', active: () => !!recipe, refreshFriendsStation,
    crossAt: (x, z) => crossings.some(c => c.on && x > c.x0 - 0.6 && x < c.x1 + 0.6 && z > c.z0 - 0.6 && z < c.z1 + 0.6),
    camRoomAt: (x, z) => camRooms.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null,
    act, actAs: id => withFocus(id, () => act()), useGearAs: id => withFocus(id, () => useGear(ctx.getP())), callAs: id => withFocus(id, () => callEscort()),
    wheelOpts, deepRects: () => deep.filter(r => !r.off).map(r => ({ ...r })), status, kidState,
    /** test hook: finish the level as if the exit was reached (used by the POLISH result tests) */
    debugComplete(why = 'Test finish') { if (!recipe || keyDone) return null; complete(why); return result; },
    skipKid() { if (!recipe || !recipe.kid || !recipe.act2 || keyDone) return false; complete('Trail skipped'); return true; },
    toggleSneak(v) { if (!a2 || !recipe?.act2) return false; sneak = v == null ? !sneak : !!v; const bp = ctx.getP(); if (bp) bp.sneak = sneak; ctx.onSneak?.(sneak); tst(sneak ? '🐾 Sneaking: slow, quiet paws' : '🏃 Walking normally', 1200); return sneak; }, sneakOn: () => { const bp = ctx.getP(); return !!(a2 && (bp && bp.sneak || sneak)); }, isAct2: () => !!(a2 && recipe && recipe.act2),
    setAct2Night: v => { if (a2) setNightA2(!!v); },
    flagBack, callEscort, getA2: () => a2, aimMirror: (id) => { const m = a2 && a2.mirrors.find(q => q.id === id); if (!m) return null; aimMirror(m); return m.k; }, throwToolAt: (kind, lx, lz) => throwTool(kind, A.x + lx, A.z + lz),
    placeEscort(i, lx, lz) { const b = a2 && a2.escorts[i]; if (!b) return false; b.x = A.x + lx; b.z = A.z + lz; b.y = ctx.heightAt(b.x, b.z); b.hide = false; b.stuckFor = 0; b.lagFor = 0; if (b.G) b.G.position.set(b.x, b.y, b.z); return true; },
    escort: () => a2 ? a2.escorts.map(b => ({ kind: b.kind, glb: b.G.userData.babyGlb || null, x: +(b.x - A.x).toFixed(2), z: +(b.z - A.z).toFixed(2), y: +b.y.toFixed(2), called: !!b.called, following: !!b.following, hide: !!b.hide, leadBody: b.leadBody || null })) : [], escortLead: () => a2 ? a2.escorts.map(b => ({ x: b.x, y: b.y, z: b.z, called: !!b.called, following: !!b.following, hide: !!b.hide, leadBody: b.leadBody || null })) : [], heldTool: () => a2 ? a2.heldTool : null,
    moody() { return !!(a2 && recipe && recipe.moody) ? !!AA().night : null; },
    timeLocked: () => !!(a2 && a2.master), // S4: Master Bell owns clock.t (dusk/night/day) until clear()
    debugBonk(src = 'test') { if (a2) bonk({ name: 'Test' }, src); },
    // netState / applyNetState are the full §2.5 snapshot (including S4 Master Bell) defined above.
    gearInfo(c) { const k = slotOf(c); if (!k || !a2) return null; const own = GEAR_BY_CLS[c].filter(q => gearHas(q)); return { k, em: GEAR_INFO[k].em, icon: GEAR_INFO[k].icon ? import.meta.env.BASE_URL + GEAR_INFO[k].icon : null, name: GEAR_INFO[k].name, has: gearHas(k), on: gearOn(k), borrowed: !gear[k] && gearHas(k), own, full: k === 'pouch' ? !!a2.pouch.full : undefined }; },
    toggleGear(c) { const k = slotOf(c || CLASS_OF[ctx.cur()]); if (!k || !a2) return false; return setGear(k, !gearOn(k)); },
    swapGear(c, k) { if (!a2 || !GEAR_BY_CLS[c] || !GEAR_BY_CLS[c].includes(k) || !gearHas(k)) return false; setSlot(c, k); setGear(k, true, true); return true; },
    useGear: () => { const p = ctx.getP(); return !!(a2 && p && useGear(p)); },
    gearViz: () => { const V = a2 && a2.gviz; if (!V) return null; const o = {}; for (const k of ['pouch', 'glider', 'sling']) { const m = V[k].children.find(c => c.userData && c.userData.model); const sz = m && m.visible !== false && V[k].visible ? new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()) : null; o[k] = { shown: V[k].visible, model: !!m, size: sz ? [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)] : null }; } return o; },
    gearList: () => Object.keys(GEAR_INFO).map(k => ({ k, ...GEAR_INFO[k], has: !!gear[k] })),
    setT: v => { t = +v; }, forcePuzzles, setTiming: k => { timingK = +k > 0 ? +k : 1; }, timing: () => TK(),
    gearState: () => ({ ...gear }), a2: () => a2 ? { bonks: a2.bonks, season: a2.season, night: a2.night, wind: a2.wind, windFlipT: a2.windFlipT, pingAt: a2.pingAt ? { x: a2.pingAt.x - A.x, z: a2.pingAt.z - A.z, t: a2.pingAt.t } : null, cp: !!a2.cp, cpPos: a2.cp ? { x: +(a2.cp.x - A.x).toFixed(2), z: +(a2.cp.z - A.z).toFixed(2) } : null, cps: a2.cps.map(c => ({ x: c.x - A.x, z: c.z - A.z, on: !!c.on })), hidEver: !!a2.hidEver, bonkLog: (a2.bonkLog || []).slice(-20), dew: !!a2.dew, heldTool: a2.heldTool, pouch: !!a2.pouch.full, glide: +a2.glide.toFixed(2), slot: { scout: slotOf('scout'), trickster: slotOf('trickster'), bruiser: slotOf('bruiser') }, embers: a2.embers.map(e => ({ id: e.id, st: e.st, x: e.x - A.x, z: e.z - A.z })), targets: a2.targets.map(q => ({ sig: q.sig, done: !!q.done })), stumps: a2.stumps.map(q => ({ x: q.x - A.x, z: q.z - A.z, auto: !!q.auto })), cups: a2.cups.map(c => ({ sig: c.sig, amt: +c.amt.toFixed(2), on: c.on, x: c.x - A.x, z: c.z - A.z })), escorts: a2.escorts.map(b => ({ kind: b.kind, x: +(b.x - A.x).toFixed(2), z: +(b.z - A.z).toFixed(2), called: !!b.called, following: !!b.following, hide: !!b.hide, leadBody: b.leadBody || null })), shots: a2.shots.map(s => ({ kind: s.kind, x: s.x - A.x, z: s.z - A.z, landed: !!s.landed })), acorn: a2.acorn ? { at: a2.acorn.at, by: a2.acorn.by, home: a2.acorn.home } : null, ponds: a2.ponds.map(q => ({ id: q.id, level: q.level, wy: +pondSurf(q).toFixed(2) })), en: a2.en.map(e => ({ kind: e.kind, id: e.id, st: e.st, x: e.x - A.x, z: e.z - A.z, yaw: e.yaw, sus: e.sus, bait: !!e.bait, pingLure: e.pingLure ? e.pingLure.phase : null, swoop: !!e.swoop, calm: !!e.calm, roll: e.roll ? e.roll.phase : null, napT: e.napT || 0, stayedFar: !!e.stayedFar })), ghosts: a2.ghosts.map(g => ({ id: g.id, on: g.on })), logs: a2.logs.map(l => ({ id: l.id, k: l.k, x: l.x - A.x, z: l.z - A.z })), time: a2.time || (a2.night ? 'night' : 'day'), windMag: a2.windMag ?? 6, master: a2.master ? { state: a2.master.state, next: a2.master.next, start: a2.master.start, cool: +Math.max(0, (a2.master.coolUntil || 0) - t).toFixed(2) } : null } : null, result: () => result, objective: () => objCache || objective(), fadeLine, rect, puzzleList: () => puzzles.map(p => ({ ...p })), NEED, SIZE, MAPS,
  };
}
