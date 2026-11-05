// Per-species tech trees (3 tiers x 2 branches). Researched with round resources; completes instantly on pay; resets every round.
// Peaceful only: every node is about gathering, travelling, building or teamwork.
import { SPECIES_ORDER, SPECIES } from './data.js';
import { priceFor } from './species.js';

const N = (id, tier, br, name, icon, desc, fx, req) => ({ id, tier, br, name, icon, desc, fx, req: req === undefined ? [] : req });
const T1 = { cost: 14, t: 20 }, T2 = { cost: 26, t: 35 }, T3 = { cost: 40, t: 50 };
export const TIER = [null, T1, T2, T3];
export const BRANCH = {};

export const TREES = {
  bee: { a: 'Hive Mind', b: 'Honeycraft', nodes: [
    N('waggle', 1, 'a', 'Waggle Dance', '💃', 'Bee helpers share where flowers are: no search pauses and they gather 35% faster.', { hEat: 0.65, hNoWait: 1 }),
    N('swarm', 2, 'a', 'Swarm', '🐝', '+3 crew size and bee helpers cost 25% less to hire.', { hireCap: 3, hireBee: 0.75 }, ['waggle']),
    N('queen', 3, 'a', "Queen's Call", '👑', 'Bee helpers fly 40% faster and carry +2.', { hSpd: 1.4, hCap: 2 }, ['swarm']),
    N('baskets', 1, 'b', "Basket Boost", '🧺', 'Carry +3 pollen.', { cap: 3 }),
    N('jelly', 2, 'b', 'Royal Jelly', '🍯', 'Every 3 🌼 bees bring home also makes 1 🍯 honey.', { conv: { k: 'h', per: 3 } }, ['baskets']),
    N('apiary', 3, 'b', 'Apiary', '🏯', 'Unlocks the Apiary building: makes 🌼 and 🍯 on its own.', { build: 'apiary' }, ['jelly'])
  ] },
  butterfly: { a: 'Migration', b: 'Bright Wings', nodes: [
    N('thermal', 1, 'a', 'Thermal Glide', '🌬️', 'Flight stamina lasts 40% longer.', { drain: 0.6 }),
    N('migrate', 2, 'a', "Long Journey", '🧭', 'Flight speed +25% and pickup reach +30%.', { spd: 1.25, reach: 1.3 }, ['thermal']),
    N('monarch', 3, 'a', 'Monarch Route', '🦋', 'Butterfly helpers drift 50% faster and look for flowers anywhere.', { hSpd: 1.5, hNoPen: 1 }, ['migrate']),
    N('bright', 1, 'b', "Colorful Wings", '✨', 'Your colours cheer the meadow: beacons spread 15% faster.', { terr: 0.15 }),
    N('dust', 2, 'b', 'Pollen Dust', '🌸', 'Butterfly deliveries score +25% points.', { pts: 1.25 }, ['bright']),
    N('parade', 3, 'b', 'Bloom Parade', '🎉', 'Beacons spread another 30% faster and gardens grow 30% faster.', { terr: 0.3, garden: 0.3 }, ['dust'])
  ] },
  hummingbird: { a: 'Hover', b: 'Metabolism', nodes: [
    N('hover', 1, 'a', 'Hover Feed', '🌺', 'Sip at full speed: no more slowing down at flowers.', { hover: 1 }),
    N('tongue', 2, 'a', 'Long Tongue', '👅', 'Pickup reach +50%.', { reach: 1.5 }, ['hover']),
    N('rush', 3, 'a', 'Sugar Rush', '⚡', 'Speed +20%, and flight burns 25% less stamina.', { spd: 1.2, drain: 0.75 }, ['tongue']),
    N('torpor', 1, 'b', "Power Nap", '😴', 'Stamina refills 60% faster.', { rech: 1.6 }),
    N('cache', 2, 'b', 'Nectar Cache', '🫙', 'Carry +3 nectar.', { cap: 3 }, ['torpor']),
    N('jewel', 3, 'b', 'Jewel Flock', '💎', 'Hummingbird helpers +60% speed and +2 carry.', { hSpd: 1.6, hCap: 2 }, ['cache'])
  ] },
  moth: { a: 'Moonlight', b: 'Pale Bloom Lore', nodes: [
    N('moonnav', 1, 'a', "Moon Map", '🌕', 'Night speed +30%.', { night: 1.3 }),
    N('antennae', 2, 'a', "Feather Feelers", '📡', 'Pickup reach +40%.', { reach: 1.4 }, ['moonnav']),
    N('silkroad', 3, 'a', 'Silk Road', '🧵', 'Moth helpers search the whole map and are 40% faster at night.', { hNoPen: 1, hNight: 1.4 }, ['antennae']),
    N('scent', 1, 'b', 'Sweet Scent', '🌼', '+1 nectar from every flower.', { pick: 1 }),
    N('moonsilk', 2, 'b', 'Moon Silk', '🕸️', 'Carry +3.', { cap: 3 }, ['scent']),
    N('lantern', 3, 'b', "Moonbeam Bonus", '🏮', 'Moth deliveries score +30% points.', { pts: 1.3 }, ['moonsilk'])
  ] },
  bat: { a: 'Echolocation', b: 'Fruit Feast', nodes: [
    N('echo', 1, 'a', "Echo Ping", '🔊', 'Reach +30%, and bat helpers find fruit anywhere on the map.', { reach: 1.3, hNoPen: 1 }),
    N('nightswarm', 2, 'a', 'Night Swarm', '🌌', '+2 crew size; bat helpers 30% faster at night.', { hireCap: 2, hNight: 1.3 }, ['echo']),
    N('sonar', 3, 'a', 'Sonar Map', '🗺️', 'Every helper gathers 15% faster.', { allEat: 0.85 }, ['nightswarm']),
    N('wings', 1, 'b', "Glide Wings", '🪽', 'Flight burns 30% less stamina.', { drain: 0.7 }),
    N('pouch', 2, 'b', 'Cheek Pouches', '😊', 'Carry +3.', { cap: 3 }, ['wings']),
    N('scatter', 3, 'b', 'Seed Scatter', '🌱', 'Bats spread seeds as they fly: beacons spread 20% faster. Unlocks the Bat Roost building (makes 🌼 and 🪱).', { terr: 0.2, build: 'roost' }, ['pouch'])
  ] },
  bumblebee: { a: 'Buzz', b: 'Burrow', nodes: [
    N('buzz', 1, 'a', "Big Buzz", '〰️', '+1 pollen from every flower.', { pick: 1 }),
    N('fuzzy', 2, 'a', "Extra Fluff", '🧸', 'Speed +15%.', { spd: 1.15 }, ['buzz']),
    N('brigade', 3, 'a', 'Bumble Brigade', '🐝', 'Bumblebee helpers +3 carry.', { hCap: 3 }, ['fuzzy']),
    N('bigbumble', 1, 'b', 'Big Bumble', '🎈', 'Carry +4.', { cap: 4 }),
    N('wax', 2, 'b', 'Wax Cells', '🍯', 'Every 4 🌼 bumblebees bring home also makes 1 🍯.', { conv: { k: 'h', per: 4 } }, ['bigbumble']),
    N('clover', 3, 'b', 'Clover Patch', '🍀', 'Gardens grow 40% faster.', { garden: 0.4 }, ['wax'])
  ] },
  robin: { a: 'Early Bird', b: 'Nest Building', nodes: [
    N('early', 1, 'a', "Rise and Shine", '🌅', 'For the first third of the round: +35% speed.', { early: 1.35 }),
    N('wormsense', 2, 'a', 'Worm Sense', '🪱', 'Reach +40% and buried worms are picked up without pecking.', { reach: 1.4, autodig: 1 }, ['early']),
    N('chorus', 3, 'a', "Morning Song", '🎶', 'Every helper moves 10% faster.', { allSpd: 1.1 }, ['wormsense']),
    N('weave', 1, 'b', 'Twig Weaving', '🪺', 'Every 3 items robins bring home also make 1 🪵.', { conv: { k: 'w', per: 3 } }),
    N('beak', 2, 'b', 'Big Beak', '🐦', 'Carry +3.', { cap: 3 }, ['weave']),
    N('wormfarm', 3, 'b', 'Worm Farm', '🪱', 'Unlocks the Worm Farm building: makes 🪱 on its own.', { build: 'wormfarm' }, ['beak'])
  ] },
  raccoon: { a: 'Clever Hands', b: 'Night Prowl', nodes: [
    N('hands', 1, 'a', "Handy Paws", '🖐️', 'Opens things instantly: buried snacks are picked up without digging; reach +20%.', { autodig: 1, reach: 1.2 }),
    N('haul', 2, 'a', "Mixed Bag Haul", '🎒', 'Mixed haul: every 3 items also bring 1 🌼 and every 4 bring 1 🪵.', { conv: [{ k: 'n', per: 3 }, { k: 'w', per: 4 }] }, ['hands']),
    N('masked', 3, 'a', 'Masked Crew', '🦝', 'Raccoon helpers +3 carry and gather 30% faster.', { hCap: 3, hEat: 0.7 }, ['haul']),
    N('prowl', 1, 'b', "Night Stroll", '🌙', 'Night speed +25%.', { night: 1.25 }),
    N('pockets', 2, 'b', 'Deep Pockets', '👖', 'Carry +5.', { cap: 5 }, ['prowl']),
    N('stash', 3, 'b', 'Stash Spot', '🧺', 'Each Acorn Larder gives raccoons +2 more carry. Unlocks the Stash Den building (makes 🪱 and 🌼).', { larder: 2, build: 'stashden' }, ['pockets'])
  ] },
  opossum: { a: 'Night Shift', b: 'Pouch', nodes: [
    N('nightshift', 1, 'a', "Late-Night Crew", '🌙', 'Night speed +35%; opossum helpers gather 40% faster at night.', { night: 1.35, hNightEat: 0.6 }),
    N('tailgrip', 2, 'a', 'Tail Grip', '🌳', 'Climbs trees for sticks: +1 wood from every pickup.', { pick: 1 }, ['nightshift']),
    N('woodpile', 3, 'a', 'Woodpile', '🪵', 'Unlocks the Woodpile building: makes 🪵 on its own.', { build: 'woodpile' }, ['tailgrip']),
    N('pouchb', 1, 'b', 'Roomy Pouch', '👜', 'Carry +4.', { cap: 4 }),
    N('paths', 2, 'b', 'Tidy Paths', '🛤️', 'Speed +15%.', { spd: 1.15 }, ['pouchb']),
    N('timber', 3, 'b', 'Timber Crew', '🪓', 'Opossum helpers +40% speed and +2 carry.', { hSpd: 1.4, hCap: 2 }, ['paths'])
  ] },
  bear: { a: 'Ambling', b: 'Hibernation', nodes: [
    N('amble', 1, 'a', 'Ambling Gait', '🐾', 'Speed +20%.', { spd: 1.2 }),
    N('paws', 2, 'a', "Paw Haul", '🪵', 'Carries wood and honey together: every 3 items also bring 1 🪵.', { conv: { k: 'w', per: 3 } }, ['amble']),
    N('cave', 3, 'a', 'Honey Cave', '⛰️', 'Unlocks the Honey Cave building: makes 🍯 on its own; bears carry +4.', { build: 'honeycave', cap: 4 }, ['paws']),
    N('den', 1, 'b', 'Hibernation Den', '🛌', 'A bigger den: carry +6.', { cap: 6 }),
    N('sweet', 2, 'b', 'Sweet Tooth', '🍯', 'Bear deliveries score +25% points.', { pts: 1.25 }, ['den']),
    N('giant', 3, 'b', 'Gentle Giant', '🐻', 'Bear helpers +5 carry and +25% speed.', { hCap: 5, hSpd: 1.25 }, ['sweet'])
  ] }
};
for (const sp in TREES) for (const n of TREES[sp].nodes) { n.sp = sp; n.key = sp + ':' + n.id; }
export const nodeOf = (sp, id) => TREES[sp]?.nodes.find(n => n.id === id);

const MUL = ['spd', 'reach', 'drain', 'rech', 'night', 'early', 'pts', 'hSpd', 'hEat', 'hNight', 'hNightEat'];
const ADD = ['cap', 'pick', 'hCap', 'larder'];
function blank() { const o = { conv: [], builds: [] }; for (const k of MUL) o[k] = 1; for (const k of ADD) o[k] = 0; return o; }

export function createTech(ctx) {
  const { round, toast, lead } = ctx;
  const X = { done: {}, active: {}, ver: 1, instant: true, free: false, onChange: null };
  X.reset = () => { X.done = {}; X.active = {}; X.ver++; X.cache = null; };
  X.isDone = (sp, id) => !!X.done[sp + ':' + id];
  X.cost = n => (ctx.price ? ctx.price(TIER[n.tier].cost) : priceFor(lead(), TIER[n.tier].cost));
  X.time = () => 0; // wait timers removed — research finishes the moment you pay
  X.state = (sp, n) => X.isDone(sp, n.id) ? 'done' : X.active[sp]?.id === n.id ? 'researching' : n.req.every(r => X.isDone(sp, r)) ? 'available' : 'locked';
  X.why = (sp, n) => { const s = X.state(sp, n); if (s === 'done') return 'Researched'; if (s === 'researching') return 'Researching…'; if (s === 'locked') return 'Needs ' + n.req.map(r => nodeOf(sp, r).name).join(', ');
    if (X.active[sp]) return 'Already researching ' + nodeOf(sp, X.active[sp].id).name; if (!X.free && !round.canPay(X.cost(n))) return 'Need more resources'; return ''; };
  X.start = (sp, id) => {
    const n = nodeOf(sp, id); if (!n) return false; const w = X.why(sp, n); if (w) { toast('🧬 ' + w); return false; }
    if (!X.free) round.pay(X.cost(n));
    finish(sp, n); return true;
  };
  X.cancel = sp => { const a = X.active[sp]; if (!a) return; const n = nodeOf(sp, a.id), c = X.cost(n); for (const k in c) round.addRes(k, c[k]); delete X.active[sp]; X.onChange?.(); };
  function finish(sp, n) { X.done[sp + ':' + n.id] = true; delete X.active[sp]; ctx.sfx?.('ui2/research-done'); X.ver++; X.cache = null; round.add('building', 10 * n.tier); toast(`🧬 ${SPECIES[sp].emoji} ${n.icon} ${n.name} researched! ${n.desc}`, 3600); X.onChange?.(n); }
  X.update = () => {}; // no wait timers
  X.unlockAll = () => { for (const sp in TREES) for (const n of TREES[sp].nodes) X.done[n.key] = true; X.active = {}; X.ver++; X.cache = null; X.onChange?.(); };
  /** aggregated effects: X.fx(sp) per species; X.g global */
  X.fx = sp => { if (!X.cache) build(); return X.cache[sp] || X.cache._blank; };
  X.g = () => { if (!X.cache) build(); return X.cache._g; };
  function build() {
    const c = { _blank: blank(), _g: { hireCap: 0, hireCost: {}, terr: 0, garden: 0, allSpd: 1, allEat: 1, builds: [] } }, g = c._g;
    for (const sp of SPECIES_ORDER) { const o = c[sp] = blank(); const T = TREES[sp]; if (!T) continue;
      for (const n of T.nodes) { if (!X.done[n.key]) continue; const f = n.fx;
        for (const k of MUL) if (f[k]) o[k] *= f[k]; for (const k of ADD) if (f[k]) o[k] += f[k];
        for (const k of ['autodig', 'hover', 'hNoPen', 'hNoWait']) if (f[k]) o[k] = 1;
        if (f.conv) o.conv.push(...[].concat(f.conv)); if (f.build) { o.builds.push(f.build); g.builds.push(f.build); }
        if (f.hireCap) g.hireCap += f.hireCap; if (f.hireBee) g.hireCost[sp] = f.hireBee; if (f.terr) g.terr += f.terr; if (f.garden) g.garden += f.garden; if (f.allSpd) g.allSpd *= f.allSpd; if (f.allEat) g.allEat *= f.allEat; } }
    X.cache = c;
  }
  X.serialize = () => ({ done: X.done, active: X.active });
  X.restore = s => {
    X.reset(); if (!s) return; X.done = { ...(s.done || {}) };
    // older saves may still have mid-timer research — complete them silently (costs already paid)
    for (const sp in (s.active || {})) { const a = s.active[sp]; if (a?.id) X.done[sp + ':' + a.id] = true; }
    X.active = {}; X.ver++;
  };
  X.count = () => Object.keys(X.done).length;
  return X;
}
