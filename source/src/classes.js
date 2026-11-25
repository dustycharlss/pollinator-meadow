// Three-class crew (Lost Vikings style): Scout (tiny), Trickster (medium), Bruiser (large).
// One of each on a valley crew; swap between them — each one alone can't finish a level.
// Fern Nov 9: class follows flight (bumblebee = Scout), bat = Trickster (short glide hops only).
export const CLASS_OF = {
  bee: 'scout', bumblebee: 'scout', hummingbird: 'scout', butterfly: 'scout', moth: 'scout',
  robin: 'trickster', raccoon: 'trickster', opossum: 'trickster', bat: 'trickster',
  bear: 'bruiser',
};
const ICON = k => import.meta.env.BASE_URL + 'ui/icons/class/' + k + '.webp';
export const CLASSES = {
  scout: {
    id: 'scout', size: 'tiny', name: 'Scout', short: 'Wing', color: '#4aa8ff', em: '🪽',
    badge: ICON('class-tiny-scout'), abIcon: ICON('ability-tiny-scout'),
    tag: 'Flies over gaps & water · slips through knotholes · rings high bells',
    can: ['Fly over gaps and water', 'Slip through tiny gaps and knotholes', 'Ring high bells, blossoms and lanterns', 'Carry 1 small item'],
    cant: ['Push anything heavy', 'Pull ground levers', 'Smash barriers'],
    acts: ['bell', 'slip'], carryMul: 1, flyCap: null,
  },
  trickster: {
    id: 'trickster', size: 'medium', name: 'Trickster', short: 'Paw', color: '#7dc85a', em: '🐾',
    badge: ICON('class-medium-trickster'), abIcon: ICON('ability-medium-trickster'),
    tag: 'Climbs vines · digs tunnels · pulls levers · throws acorns · builds plank bridges',
    can: ['Climb vines and bark', 'Dig soft dirt and use tunnels', 'Pull ground levers', 'Throw an acorn at a far switch', 'Build a Plank Bridge'],
    cant: ['Fly high or far (short hops only)', 'Move logs or boulders'],
    acts: ['lever', 'vine', 'dig', 'throw', 'plank'], carryMul: 1, flyCap: 3.6,
  },
  bruiser: {
    id: 'bruiser', size: 'bear', name: 'Bruiser', short: 'Big paw', color: '#ff8a1f', em: '🐻',
    badge: ICON('class-large-bruiser'), abIcon: ICON('ability-large-bruiser'),
    tag: 'Shoves logs & boulders · smashes cracked walls · holds heavy plates · is a step for friends',
    can: ['Shove logs and boulders into slots', 'Bump cracked barriers open', 'Hold heavy pressure plates', 'Be a step: friends stand on his back for a boost'],
    cant: ['Fit through small gaps', 'Climb vines', 'Reach high switches', 'Cross thin plank bridges'],
    acts: ['shove', 'smash'], carryMul: 1, flyCap: null,
  },
};
// POLISH accessibility §3: a second class cue for everyone (shape + Squid's badge), plus an opt-in colour-blind palette.
// Shapes ship always. With the colour-blind setting off, the badges are tinted to the live glow colours (so they match the world glows);
// on, every runtime class colour switches to Squid's shipped palette (Bruiser darkened to #bc5134 for grayscale separation).
const CB = { scout: '#9bb4ff', trickster: '#2aa894', bruiser: '#bc5134' };
// Cue colours for hint badges, plate glows, dock pulse and arrow assist.
// The default class colours fail gray-vs-gray (scout/bruiser ΔE 2.1); this palette passes (≥10).
export const CUE = { scout: '#9bb4ff', trickster: '#2aa894', bruiser: '#bc5134' };
export const cueColor = c => CUE[c] || '#ffd23f';
export const cueHex = c => parseInt((CUE[c] || '#ffd23f').slice(1), 16);
export const cueBadge = (c, kind = 'badge', sz = 64) => BADGE(c, true, kind, sz);
const SHAPE = { scout: 'circle', trickster: 'square', bruiser: 'hex' };
const BADGE = (c, cb, kind = 'badge', sz = 64) => import.meta.env.BASE_URL + `ui/icons/class-badges/${c}-${kind}-${sz}${cb ? '-cb' : ''}.png`;
for (const c of Object.keys(CLASSES)) { const C = CLASSES[c]; C.color0 = C.color; C.colorBlind = CB[c]; C.shape = SHAPE[c]; C.badge0 = C.badge; C.badge = BADGE(c, false); C.badge2x = BADGE(c, false, 'badge', '64@2x'); }
let cbOn = false;
export const colorBlindOn = () => cbOn;
/** swap every runtime class colour + badge (new world props, dock, objective, kid card pick it up; open levels refresh on next load) */
export function setColorBlind(on) {
  cbOn = !!on;
  for (const c of Object.keys(CLASSES)) { const C = CLASSES[c]; C.color = cbOn ? C.colorBlind : C.color0; C.badge = BADGE(c, cbOn); C.badge2x = BADGE(c, cbOn, 'badge', '64@2x'); }
  if (typeof document !== 'undefined') { const R = document.documentElement.style; for (const c of Object.keys(CLASSES)) R.setProperty('--c-' + c, CLASSES[c].color); document.documentElement.classList.toggle('cbOn', cbOn); }
}
export const CLASS_ORDER = ['scout', 'trickster', 'bruiser'];
export const classOf = id => CLASSES[CLASS_OF[id]] || CLASSES.trickster;
export const sizeOf = id => classOf(id).size; // team-lift sizes follow the class
/** What each prop is called + which class uses it (wheel labels, hints) */
export const ACTS = {
  bell: { cls: 'scout', verb: 'Ring Bell', icon: '🔔' },
  slip: { cls: 'scout', verb: 'Slip Through', icon: '🕳️' },
  lever: { cls: 'trickster', verb: 'Pull Lever', icon: '🎚️' },
  vine: { cls: 'trickster', verb: 'Climb', icon: '🌿' },
  dig: { cls: 'trickster', verb: 'Dig Tunnel', icon: '⛏️' },
  throw: { cls: 'trickster', verb: 'Throw Acorn', icon: '🌰' },
  plank: { cls: 'trickster', verb: 'Build Bridge', icon: '🪵' },
  shove: { cls: 'bruiser', verb: 'Shove', icon: '💪' },
  smash: { cls: 'bruiser', verb: 'Smash', icon: '💥' },
  sling: { cls: 'bruiser', verb: 'Sling', icon: '🪨' },
  // Act 2 kit
  aim: { cls: 'scout', verb: 'Turn Mirror', icon: '🪞' },
  sluice: { cls: 'trickster', verb: 'Turn Sluice', icon: '🚰' },
  plant: { cls: 'trickster', verb: 'Plant Seed', icon: '🌰' },
  cut: { cls: 'trickster', verb: 'Cut Web', icon: '✂️' },
  pluck: { cls: 'trickster', verb: 'Pluck Strand', icon: '🎸' },
  leaf: { cls: 'trickster', verb: 'Float Leaf', icon: '🍃' },
  crank: { cls: 'trickster', verb: 'Crank Vane', icon: '🌀' },
  slide: { cls: 'trickster', verb: 'Belly-slide', icon: '🛷' },
  stomp: { cls: 'bruiser', verb: 'Stomp Puff', icon: '🍄' },
  pick: { cls: null, verb: 'Pick Up', icon: '🌰' },
  master: { cls: null, verb: 'Ring Bell', icon: '🔔' }, // Act 3 S4 Master Bell (any class)
  gear: { cls: null, verb: 'Swap Gear', icon: '🧰' }, // Act 3 S2 gear stump (any class)
  drop: { cls: null, verb: 'Hand Off', icon: '⭕' },
};
/** valley crews need one of each class */
export function crewClassCheck(ids) {
  const have = new Set((ids || []).map(id => CLASS_OF[id]));
  const miss = CLASS_ORDER.filter(c => !have.has(c));
  const dup = (ids || []).length !== have.size;
  return { ok: !miss.length && !dup, miss, dup };
}
export const badgeImg = (id, cls = 'clsB') => { const c = classOf(id); return `<img class="${cls}" src="${c.badge}" srcset="${c.badge} 1x, ${c.badge2x} 2x" alt="${c.name}" title="${c.name}" data-shape="${c.shape}">`; };
