// Game data: species, flower catalogue, world zones, nests.
export const WORLD_R = 165;

// Rideable pollinators. rot = pre-rotation (Euler XYZ, radians) so every model ends up facing +Z with wings along X.
export const SPECIES = {
  bee: {
    id: 'bee', name: 'Honeybee', emoji: '🐝', model: 'bee', size: 1.7, color: '#ffd23f', glow: [1.0, 0.82, 0.25],
    blurb: 'Steady, reliable flyer. Hovers anywhere. Loves daisies, clover, fruit blossoms and blue flowers.',
    carry: 8, yield: 1, reach: 3.0, maxSlow: 99, nocturnal: false,
    move: { turn: 2.4, max: 12, min: 0, accel: 2.6, grip: 3.6, vSpeed: 7, vAccel: 4, dash: 24, dashT: 0.9, dashCd: 3, bank: 0.5, cam: 8.5 },
    flap: { amp: 0.55, freq: 52, body: 0.07, style: 'buzz' },
    nest: { name: 'Honey Hive', emoji: '🍯', unit: 'pollen', x: -62, z: -44, color: 0xffc233, stages: ['Honey Stump', 'First Combs', 'Growing Skep', 'Grand Hive'] },
    dashName: 'Buzz Boost', pickName: 'pollen'
  },
  butterfly: {
    id: 'butterfly', name: 'Butterfly', emoji: '🦋', model: 'butterflyB', size: 2.7, color: '#6ec6ff', glow: [1.0, 0.45, 0.85],
    blurb: 'Fluttery and drifting. Glides on the breeze. Visits clustered, colourful, flat-topped flowers.',
    carry: 7, yield: 1, reach: 3.6, maxSlow: 99, nocturnal: false,
    move: { turn: 1.7, max: 8.5, min: 2.4, accel: 0.9, grip: 1.1, vSpeed: 5, vAccel: 1.8, dash: 15, dashT: 1.1, dashCd: 3, bank: 0.7, cam: 10, flutter: 2.6, flutterHz: 2.4 },
    flap: { amp: 0.78, freq: 12, body: 0.04, style: 'stroke' },
    nest: { name: 'Chrysalis Garden', emoji: '🪷', unit: 'nectar', x: 27, z: 22, color: 0x8be07a, stages: ['Leaf Nursery', 'First Chrysalis', 'Chrysalis Grove', 'Butterfly Arbor'] },
    dashName: 'Wing Lift', pickName: 'nectar'
  },
  hummingbird: {
    id: 'hummingbird', name: 'Hummingbird', emoji: '🐦', model: 'hummingbird', size: 2.1, color: '#ff4d8d', glow: [1.0, 0.25, 0.4],
    blurb: 'Fast and darting, with precise hover. Slow down to sip from red, tubular flowers. Rare!',
    carry: 6, yield: 2, reach: 2.1, maxSlow: 5.0, nocturnal: false,
    move: { turn: 4.2, max: 19, min: 0, accel: 9, grip: 12, vSpeed: 11, vAccel: 10, dash: 36, dashT: 0.28, dashCd: 1.6, bank: 0.35, cam: 7.5 },
    flap: { amp: 0.42, freq: 78, body: 0.06, style: 'blur' },
    nest: { name: 'Cup Nest', emoji: '🪺', unit: 'nectar', x: 88, z: -52, color: 0xff7aa8, stages: ['Twig Fork', 'Moss Cup', 'Cosy Nest', 'Lichen Hideaway'] },
    dashName: 'Dart', pickName: 'nectar'
  },
  moth: {
    id: 'moth', name: 'Luna Moth', emoji: '🌙', model: 'moth', size: 2.4, color: '#c9b8ff', glow: [0.75, 0.7, 1.0],
    blurb: 'Night flyer with a wobbly flutter. Follows pale, sweet-smelling blooms by moonlight.',
    carry: 7, yield: 1, reach: 3.4, maxSlow: 99, nocturnal: true,
    move: { turn: 2.6, max: 10, min: 1.2, accel: 1.8, grip: 2.0, vSpeed: 5.5, vAccel: 2.5, dash: 18, dashT: 0.8, dashCd: 3, bank: 0.6, cam: 9, wobble: 2.2 },
    flap: { amp: 0.7, freq: 18, body: 0.05, style: 'stroke' },
    nest: { name: 'Silk Cocoons', emoji: '🕸️', unit: 'nectar', x: -80, z: 80, color: 0xbfd0ff, stages: ['Mossy Log', 'First Cocoons', 'Silk Tangle', 'Moonlit Cocoon Tree'] },
    dashName: 'Flutter Dart', pickName: 'nectar'
  },
  bat: {
    id: 'bat', name: 'Fruit Bat', emoji: '🦇', model: 'bat', size: 3.4, color: '#a58cff', glow: [0.6, 1.0, 0.7],
    blurb: 'Big night swooper that can never stop. Dive for speed. Feeds on agave, cactus and heliconia.',
    carry: 5, yield: 2, reach: 4.2, maxSlow: 99, nocturnal: true,
    move: { turn: 1.6, max: 18, min: 6, accel: 1.6, grip: 2.4, vSpeed: 9, vAccel: 2.4, dash: 28, dashT: 0.9, dashCd: 3.5, bank: 0.85, cam: 12, dive: 0.7 },
    flap: { amp: 0.62, freq: 10, body: 0.12, style: 'leather' },
    nest: { name: 'Bat Roost', emoji: '🏠', unit: 'nectar', x: 84, z: 78, color: 0xb59cff, stages: ['Rocky Perch', 'Bat Box', 'Roost Tower', 'Grand Roost'] },
    dashName: 'Swoop', pickName: 'nectar'
  },
  bumblebee: {
    id: 'bumblebee', pol: 'bee', name: 'Bumblebee', emoji: '🐝', model: 'bumblebee', size: 2.3, color: '#f0b429', glow: [1.0, 0.82, 0.25],
    blurb: 'Big, fuzzy and gloriously clumsy. Bumbles along low and slow, wobbling and sagging between flaps. Shares the honeybee’s flowers.',
    carry: 9, yield: 1, reach: 3.2, maxSlow: 99, nocturnal: false,
    move: { turn: 1.9, max: 8, min: 0, accel: 1.4, grip: 1.6, vSpeed: 4, vAccel: 2, dash: 17, dashT: 0.8, dashCd: 3.2, bank: 0.55, cam: 9.5 },
    flap: { amp: 0.55, freq: 38, body: 0.07, style: 'buzz' },
    nest: { name: 'Bumble Burrow', emoji: '🕳️', unit: 'pollen', x: -40, z: 66, color: 0xffb347, stages: ['Mouse-hole Entrance', 'Pollen Pots', 'Wax Chambers', 'Grand Bumble Burrow'] },
    dashName: 'Bumble Boost', pickName: 'pollen'
  }
};
export const SPECIES_ORDER = ['bee', 'butterfly', 'hummingbird', 'moth', 'bat', 'raccoon', 'robin', 'opossum', 'bear', 'bumblebee'];

// ---- Platformer movement. run = ground speed, jump/jump2 = impulses, jumps = total jumps (ground jump included),
// grav, air = air control (0..1). fly = hold-jump flight limited by stamina (up = target climb speed, drain = stamina/s, speed = speed multiplier).
const MV = {
  bee:         { run: 8.5, accel: 36, jump: 10.5, jumps: 1, grav: 28, air: 0.9, fly: { up: 2.6, drain: 0.27, speed: 1.55, rech: 0.9 } },
  butterfly:   { run: 7.5, accel: 28, jump: 9.5, jumps: 1, grav: 22, air: 0.9, fly: { up: 0.9, drain: 0.19, speed: 1.35, rech: 0.8, sink: 2.2 } },
  hummingbird: { run: 9.5, accel: 50, jump: 10.5, jumps: 1, grav: 28, air: 1.0, fly: { up: 6.0, drain: 0.4, speed: 1.7, rech: 1.2 } },
  moth:        { run: 7.5, accel: 28, jump: 9.5, jumps: 1, grav: 22, air: 0.8, fly: { up: 1.8, drain: 0.26, speed: 1.3, rech: 0.8, sink: 2.4 } },
  bumblebee:   { run: 7.2, accel: 28, jump: 9.5, jumps: 1, grav: 30, air: 0.8, fly: { up: 1.5, drain: 0.3, speed: 1.3, rech: 0.8, sink: 3.2 } },
  bat:         { run: 8, accel: 30, jump: 10, jumps: 1, grav: 26, air: 0.9, fly: { up: -0.8, drain: 0.24, speed: 2.1, rech: 0.7, sink: 3.5 } },
  raccoon:     { run: 9.5, accel: 44, jump: 11, jump2: 9.5, jumps: 2, grav: 30, air: 0.85 },
  robin:       { run: 9, accel: 44, jump: 10.5, jump2: 9, jumps: 2, grav: 28, air: 0.95, fly: { up: 2.6, drain: 0.5, speed: 1.3, rech: 1.0 } },
  opossum:     { run: 8.5, accel: 40, jump: 11, jump2: 9.5, jumps: 2, grav: 30, air: 0.85 },
  bear:        { run: 7.8, accel: 30, jump: 11.2, jump2: 9.0, jumps: 2, grav: 32, air: 0.7 }
};
for (const id of Object.keys(MV)) if (SPECIES[id]) SPECIES[id].mv = MV[id];
for (const id of ['bee', 'butterfly', 'hummingbird', 'moth', 'bat', 'bumblebee']) { SPECIES[id].actName = SPECIES[id].dashName; SPECIES[id].actEmoji = '⚡'; SPECIES[id].coll = { h: 1.3, r: 0.8 }; }
SPECIES.hummingbird.reach = 2.6; SPECIES.hummingbird.maxSlow = 6.5;

// Ground foragers: peaceful, nobody ever hunts anybody. Food is plentiful and grows back.
// foods = what sparkles for them. Eating is gently picking up worms, grubs, berries, seeds, sticks or honeycomb.
Object.assign(SPECIES, {
  raccoon: {
    id: 'raccoon', ground: true, name: 'Raccoon', emoji: '🦝', model: null, size: 1.9, color: '#9aa0b4', glow: [0.7, 0.9, 1.0],
    blurb: 'Nimble forager with clever paws. Digs up worms and grubs and snacks on berries. Double jump!',
    carry: 10, yield: 1, reach: 1.9, maxSlow: 99, nocturnal: false, pickName: 'snacks', actName: 'Dig', actEmoji: '⛏️', dig: 3.4,
    foods: ['worm', 'grub', 'berry', 'nut'], coll: { h: 1.2, r: 0.75 },
    nest: { name: 'Tree-Hollow Den', emoji: '🌳', unit: 'snacks', x: -112, z: -30, color: 0xb9c4ff, stages: ['Hollow Log', 'Leaf Bed', 'Tree Hollow', 'Cosy Raccoon Den'] }
  },
  robin: {
    id: 'robin', ground: true, name: 'Robin', emoji: '🐦', model: null, size: 1.3, color: '#ff8a4c', glow: [1.0, 0.65, 0.35],
    blurb: 'A ground-hopping songbird. Pecks worms, bugs and seeds. Hop twice, then hold jump for a short flutter.',
    carry: 8, yield: 1, reach: 1.7, maxSlow: 99, nocturnal: false, pickName: 'bites', actName: 'Peck', actEmoji: '🪱', dig: 3.0,
    foods: ['worm', 'ant', 'nut', 'berry'], coll: { h: 1.0, r: 0.6 },
    nest: { name: 'Shrub Nest', emoji: '🪺', unit: 'bites', x: -24, z: -44, color: 0xffa466, stages: ['Twig Fork', 'Mossy Cup', 'Shrub Nest', 'Robin Hedge Home'] }
  },
  opossum: {
    id: 'opossum', ground: true, name: 'Opossum', emoji: '🐀', model: null, size: 1.8, color: '#e4dccf', glow: [0.95, 0.8, 0.55],
    blurb: 'A tidy scavenger. Gathers sticks, twigs and bark from the ground and carries them home to build its den.',
    carry: 10, yield: 1, reach: 1.9, maxSlow: 99, nocturnal: false, pickName: 'sticks', actName: 'Scavenge', actEmoji: '🪵', dig: 3.4,
    foods: ['stick', 'bark', 'nut', 'berry'], coll: { h: 1.1, r: 0.7 },
    nest: { name: 'Stick Den', emoji: '🪵', unit: 'sticks', x: 42, z: -118, color: 0xe2b27a, stages: ['Stick Pile', 'Lean-to', 'Bark Lodge', 'Grand Wood Den'] }
  },
  bear: {
    id: 'bear', ground: true, name: 'Black Bear', emoji: '🐻', model: null, size: 3.0, color: '#6b4b34', glow: [1.0, 0.8, 0.3],
    blurb: 'Big and gentle. Digs bugs out of logs and stumps and laps up wild honeycomb. Slow, strong jumps.',
    carry: 12, yield: 1, reach: 2.4, maxSlow: 99, nocturnal: false, pickName: 'treats', actName: 'Dig & Lap', actEmoji: '🍯', dig: 4.0,
    foods: ['honey', 'ant', 'grub', 'berry'], coll: { h: 1.9, r: 1.1 },
    nest: { name: 'Cave Den', emoji: '⛰️', unit: 'treats', x: 136, z: 14, color: 0xffc766, stages: ['Rock Ledge', 'Cave Mouth', 'Mossy Cave', 'Grand Bear Cave'] }
  }
});
for (const id of ['raccoon', 'robin', 'opossum', 'bear']) SPECIES[id].mv = MV[id];

// Ground foods (all instanced, all respawn). value = units you gain. buried = needs the action button (dig/peck) nearby.
export const FOODS = {
  worm:  { value: 1, buried: false, respawn: 28, count: 300, who: ['raccoon', 'robin'] },
  grub:  { value: 2, buried: true,  respawn: 34, count: 150, who: ['raccoon', 'bear'] },
  ant:   { value: 1, buried: true,  respawn: 30, count: 150, who: ['robin', 'bear'] },
  honey: { value: 3, buried: false, respawn: 60, count: 44,  who: ['bear'] },
  stick: { value: 1, buried: false, respawn: 26, count: 300, who: ['opossum'] },
  bark:  { value: 2, buried: false, respawn: 36, count: 90,  who: ['opossum'] },
  berry: { value: 1, buried: false, respawn: 28, count: 200, who: ['raccoon', 'robin', 'opossum', 'bear'] },
  nut:   { value: 1, buried: false, respawn: 28, count: 160, who: ['raccoon', 'robin', 'opossum'] }
};
export const FOOD_KEYS = Object.keys(FOODS);
export const STAGE_AT = [0, 6, 18, 40]; // deposited units needed for nest stage 0..3

// Ambient creature populations (daytime / night). Realistic ratios: bees dominate, hummingbirds & bats are rare.
export const AMBIENT = [
  { kind: 'honeybee', model: 'bee', count: 52, size: 1.15, speed: 5.2, likes: 'bee', night: false, flap: { amp: 0.55, freq: 52, body: 0.07, style: 'buzz' }, style: 'bee' },
  { kind: 'bumblebee', model: 'bumblebee', count: 14, size: 1.5, speed: 4.2, likes: 'bee', night: false, flap: { amp: 0.55, freq: 38, body: 0.07, style: 'buzz' }, style: 'bee', rot: [0, 0, 0] },
  { kind: 'butterflyA', model: 'butterflyA', count: 8, size: 2.0, speed: 2.8, likes: 'butterfly', night: false, flap: { amp: 0.72, freq: 12, body: 0.04, style: 'stroke' }, style: 'flutter' },
  { kind: 'butterflyB', model: 'butterflyB', count: 7, size: 2.0, speed: 2.8, likes: 'butterfly', night: false, flap: { amp: 0.72, freq: 13, body: 0.04, style: 'stroke' }, style: 'flutter' },
  { kind: 'hummingbird', model: 'hummingbird', count: 2, size: 1.8, speed: 9, likes: 'hummingbird', night: false, flap: { amp: 0.42, freq: 78, body: 0.06, style: 'blur' }, style: 'dart' },
  { kind: 'dragonfly', model: 'dragonfly', count: 4, size: 2.2, speed: 8, likes: null, night: false, flap: { amp: 0.5, freq: 36, body: 0.05, style: 'paired' }, style: 'patrol' },
  { kind: 'ladybug', model: 'ladybug', count: 9, size: 0.7, speed: 1.0, likes: 'bee', night: false, flap: null, style: 'crawl' },
  { kind: 'beetle', model: 'beetle', count: 5, size: 1.1, speed: 0.9, likes: 'bee', night: false, flap: null, style: 'crawl' },
  { kind: 'mothAmb', model: 'moth', count: 12, size: 1.8, speed: 3.2, likes: 'moth', night: true, flap: { amp: 0.68, freq: 18, body: 0.05, style: 'stroke' }, style: 'flutter' },
  { kind: 'batAmb', model: 'bat', count: 3, size: 2.9, speed: 11, likes: 'bat', night: true, flap: { amp: 0.62, freq: 10, body: 0.12, style: 'leather' }, style: 'swoop' },
  { kind: 'beetleN', model: 'beetle', count: 3, size: 1.1, speed: 0.9, likes: 'moth', night: true, flap: null, style: 'crawl' }
];

// Flower / plant catalogue. h = target height in world units. pol = which pollinators it feeds (pollination syndromes).
// bloomY = height of the nectar point as a fraction of h. r = pickup radius bonus. tree=true => trunk collider.
export const FLOWERS = {
  daisyG:{h:2.3,pol:['bee','butterfly']}, daisyJ:{h:2.2,pol:['bee','butterfly']},
  dandelion:{h:2.2,pol:['bee','butterfly']}, dandelions:{h:1.8,pol:['bee','butterfly']},
  clover:{h:1.0,pol:['bee','butterfly']}, tulip:{h:3.0,pol:['bee','butterfly']}, tulip3:{h:2.8,pol:['bee']},
  sunflowerG:{h:5.0,pol:['bee','butterfly']}, sunflowerJ:{h:4.5,pol:['bee','butterfly']},
  poppies:{h:2.4,pol:['bee']}, redflower:{h:2.4,pol:['hummingbird','butterfly']},
  flowersQ:{h:2.2,pol:['butterfly','bee','moth']}, flowerGroupQ:{h:2.4,pol:['butterfly','bee']},
  flowerGroup:{h:2.6,pol:['butterfly','bee']}, flower4E:{h:2.4,pol:['butterfly']},
  flower9d:{h:2.6,pol:['butterfly','bee']}, flower0V:{h:3.2,pol:['butterfly','bee']},
  plume:{h:3.2,pol:['bee','hummingbird','butterfly']}, bell:{h:3.2,pol:['hummingbird','bee']},
  purpleLong:{h:3.4,pol:['hummingbird','moth']}, iris:{h:3.2,pol:['bee']}, rose:{h:2.6,pol:['bee']},
  roseBush:{h:3.4,pol:['bee','butterfly'],bloomY:0.8}, hibiscus:{h:4.2,pol:['hummingbird','butterfly']},
  heliconia:{h:5.5,pol:['hummingbird','bat']}, birdParadise:{h:5.2,pol:['hummingbird']},
  aloe:{h:3.2,pol:['hummingbird']}, agave:{h:4.2,pol:['bat','moth','hummingbird']},
  cactus1:{h:5.5,pol:['bat','moth'],bloomY:0.98}, cactus2:{h:3.8,pol:['bat','moth'],bloomY:0.98},
  cactusFlowers:{h:3.2,pol:['bat','hummingbird','bee']}, pricklyPear:{h:3.2,pol:['hummingbird','bee']},
  desertMarigold:{h:2.6,pol:['bee','butterfly']}, orchid1:{h:3.4,pol:['moth']}, orchid2:{h:3.2,pol:['moth']},
  lotus:{h:1.2,pol:['bee']}, waterLilies:{h:0.9,pol:['moth']}, flowerFg:{h:3.4,pol:['moth','bat']},
  littleFlowers:{h:2.2,pol:['butterfly','bee','moth']}, bulb:{h:3.2,pol:['butterfly','bee']},
  blueEyed:{h:1.8,pol:['bee']}, flowerSingle:{h:2.4,pol:['bee','butterfly','hummingbird']}
};
// Bushes and trees with nectar (bigger pickup radius)
export const BLOOMING = {
  apple1:{h:13,pol:['bee'],bloomY:0.62,r:5,tree:true}, apple2:{h:13,pol:['bee'],bloomY:0.62,r:5,tree:true},
  cherry:{h:15,pol:['bee','butterfly'],bloomY:0.62,r:5,tree:true}, blossom:{h:15,pol:['bee','butterfly'],bloomY:0.62,r:5,tree:true},
  pear:{h:14,pol:['bee'],bloomY:0.62,r:5,tree:true}, orange:{h:12,pol:['bee','butterfly','moth'],bloomY:0.62,r:5,tree:true},
  bloodwood:{h:16,pol:['bat','bee'],bloomY:0.65,r:5,tree:true},
  bushFlowers:{h:4.5,pol:['butterfly','moth','hummingbird','bee'],bloomY:0.75,r:2.5},
  flowersBush:{h:4.0,pol:['butterfly','hummingbird','moth','bee'],bloomY:0.75,r:2.5},
  raspberry:{h:3.2,pol:['bee'],bloomY:0.7,r:2}, blueberry:{h:3.0,pol:['bee'],bloomY:0.7,r:2}
};
// Decorative (not gatherable)
export const DECOR = {
  oak:{h:20,tree:true}, birch:{h:18,tree:true}, maple:{h:18,tree:true}, acacia:{h:16,tree:true}, willow:{h:17,tree:true},
  treeA:{h:12,tree:true}, treeB:{h:14,tree:true}, bushBerries:{h:3.4},
  logFungus:{h:2.2}, logMoss:{h:2.4}, stumpMoss:{h:2.2}, stump:{h:2.6}, mushroom1:{h:1.6}, mushroom2:{h:1.2},
  rockLarge:{h:4.5}, rockMedium:{h:2.8}
};

// World zones: centre, radius, ground colour, and how many of each plant (before density scaling).
export const ZONES = [
  { id: 'meadow', name: 'Sunny Wildflower Meadow', x: 0, z: 0, r: 80, color: [0.46, 0.74, 0.28],
    plants: { daisyG:60, daisyJ:50, dandelion:36, dandelions:30, clover:70, sunflowerG:18, sunflowerJ:14, tulip:26, tulip3:18, poppies:40, redflower:16,
      flowersQ:28, flowerGroupQ:20, flowerGroup:14, flower4E:36, flower9d:36, flower0V:14, littleFlowers:28, flowerSingle:26, plume:28, blueEyed:30,
      iris:14, bulb:18, bell:8, roseBush:10, bushFlowers:14, flowersBush:8, raspberry:6, blueberry:6 },
    decor: { treeA:8, treeB:5, birch:4, rockMedium:8, stump:3, mushroom2:10, bushBerries:6 } },
  { id: 'orchard', name: 'Blossom Orchard', x: -105, z: -78, r: 52, color: [0.55, 0.8, 0.34],
    plants: { daisyJ:30, clover:50, dandelions:30, blueEyed:24, plume:20, poppies:20, rose:14, iris:10, raspberry:8, blueberry:8, flowerGroupQ:10,
      apple1:12, apple2:10, cherry:10, pear:8, orange:8, blossom:8 },
    decor: { oak:3, stumpMoss:3, mushroom1:5, logMoss:3, bushBerries:5 } },
  { id: 'tropical', name: 'Hummingbird Garden', x: 108, z: -74, r: 48, color: [0.24, 0.62, 0.3],
    plants: { hibiscus:28, heliconia:22, birdParadise:18, aloe:18, bell:30, purpleLong:24, plume:24, redflower:22, flower4E:12, flowersBush:10, bushFlowers:10, flowerSingle:12 },
    decor: { maple:6, treeA:4, mushroom1:5, logMoss:3, rockMedium:4 } },
  { id: 'desert', name: 'Agave Badlands', x: 104, z: 98, r: 48, color: [0.86, 0.72, 0.46],
    plants: { agave:20, cactus1:14, cactus2:14, pricklyPear:14, cactusFlowers:24, desertMarigold:26, aloe:8, flowerFg:14, bloodwood:5 },
    decor: { rockLarge:14, rockMedium:16, acacia:5 } },
  { id: 'moon', name: 'Moonlit Pond Garden', x: -98, z: 96, r: 48, color: [0.3, 0.62, 0.45],
    plants: { orchid1:10, orchid2:10, flowerFg:36, purpleLong:14, flowerSingle:14, littleFlowers:12, flowersQ:12, bushFlowers:8, flowersBush:6, daisyG:14, orange:5 },
    decor: { willow:6, logFungus:4, logMoss:3, mushroom1:10, mushroom2:10, stumpMoss:3, rockMedium:5 } }
];
export const POND = { x: -108, z: 108, r: 12 };
export const WATER_Y = -1.6;
export const WATER_PLANTS = { lotus: 14, waterLilies: 12 };

// Peaceful ambient ground animals: they wander and nibble ground food. Nothing chases, hunts or hurts anything.
export const GROUND_AMBIENT = [
  { kind: 'raccoon', count: 6, speed: 2.4, size: 1.9, foods: ['worm', 'grub', 'berry', 'nut'] },
  { kind: 'robin', count: 18, speed: 3.2, size: 1.3, foods: ['worm', 'ant', 'nut', 'berry'] },
  { kind: 'opossum', count: 5, speed: 2.0, size: 1.8, foods: ['stick', 'bark', 'nut', 'berry'] },
  { kind: 'bear', count: 2, speed: 1.9, size: 3.0, foods: ['honey', 'ant', 'grub', 'berry'] }
];
