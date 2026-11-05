// Crew of three + crew-mix pricing (overhaul-123).
import { SPECIES, SPECIES_ORDER } from './data.js';
import { ARCH, priceFor } from './species.js';

export const CREW_SIZE = 3;
export const STARTER_CREW = ['bee', 'robin', 'bear'];

/** Unique skill + role tags per species (json wins) */
export const SKILLS = {
  bee: { tag: 'pollinate', name: 'Busy Buzz', icon: '🐝' },
  bumblebee: { tag: 'pollinate', name: 'Heavy Pollen', icon: '🐝' },
  butterfly: { tag: 'scout', name: 'Far Flutter', icon: '🦋' },
  hummingbird: { tag: 'rush', name: 'Sip Dash', icon: '🐦' },
  moth: { tag: 'night', name: 'Moon Dust', icon: '🌙' },
  bat: { tag: 'night-high', name: 'Fruit Hang', icon: '🦇' },
  robin: { tag: 'all-round', name: 'Early Song', icon: '🐦' },
  raccoon: { tag: 'snack', name: 'Clever Paws', icon: '🦝' },
  opossum: { tag: 'wood-night', name: 'Tail Grip', icon: '🪵' },
  bear: { tag: 'power', name: 'Big Scoot', icon: '🐻' },
};

export function isFlyer(id) { return !!(SPECIES[id]?.mv?.fly); }
export function isWalker(id) { return !isFlyer(id) || id === 'robin'; } // robin bridges both

export function tagsOf(id) {
  const out = new Set([id]);
  const sk = SKILLS[id];
  if (sk) out.add(sk.tag);
  if (isFlyer(id)) out.add('flyer');
  if (!SPECIES[id]?.mv?.fly || id === 'robin') out.add('walker');
  if (id === 'bear' || id === 'opossum') out.add('bridge');
  if (SPECIES[id]?.nocturnal) out.add('night');
  if (id === 'bee' || id === 'bumblebee') out.add('pollinate');
  return [...out];
}

export function crewTags(crew) {
  const s = new Set();
  for (const id of crew || []) for (const t of tagsOf(id)) s.add(t);
  return [...s];
}

export function crewValid(crew) {
  if (!crew || crew.length !== CREW_SIZE) return { ok: false, why: 'Need 3 friends' };
  if (new Set(crew).size !== CREW_SIZE) return { ok: false, why: 'Pick three different friends' };
  for (const id of crew) if (!SPECIES[id]) return { ok: false, why: 'Unknown animal' };
  const tags = crewTags(crew);
  if (!tags.includes('flyer')) return { ok: false, why: 'Need at least one flyer' };
  if (!tags.includes('walker')) return { ok: false, why: 'Need at least one walker' };
  return { ok: true };
}

/**
 * priceForCrew(crew, total) — split catalog total across union of mixes,
 * weighted by w_i = (1/econ_i) / Σ(1/econ). Floor 1 per appearing resource.
 */
export function priceForCrew(crew, total) {
  const ids = (crew || []).filter(id => ARCH[id]);
  if (!ids.length) return priceFor('bee', total);
  if (ids.length === 1) return priceFor(ids[0], total);
  const inv = ids.map(id => 1 / (ARCH[id].econ || 1));
  const sum = inv.reduce((a, b) => a + b, 0) || 1;
  const o = {};
  for (let i = 0; i < ids.length; i++) {
    const a = ARCH[ids[i]], w = inv[i] / sum;
    for (const k in a.mix) {
      o[k] = (o[k] || 0) + total * w * a.mix[k];
    }
  }
  const out = {};
  for (const k in o) out[k] = Math.max(1, Math.round(o[k]));
  return out;
}

export function createCrew(ctx) {
  const C = {
    members: [...STARTER_CREW],
    active: 0, // index into members
    arcade: false, // solo lead-price mode on wild patches
    unlocked: () => (ctx.valley?.data.unlocked || STARTER_CREW).slice(),
  };
  C.get = () => C.members.slice();
  C.activeId = () => C.members[C.active] || C.members[0];
  C.tags = () => crewTags(C.members);
  C.valid = () => crewValid(C.members);
  C.set = (ids) => {
    const v = crewValid(ids);
    if (!v.ok) return v;
    // must be unlocked
    const un = new Set(C.unlocked());
    for (const id of ids) if (!un.has(id)) return { ok: false, why: `${SPECIES[id]?.emoji || ''} not unlocked yet` };
    C.members = ids.slice(0, 3);
    C.active = 0;
    if (ctx.valley) { ctx.valley.data.crew = C.members.slice(); ctx.valley.save(); }
    return { ok: true };
  };
  C.loadFromValley = () => {
    const v = ctx.valley?.data;
    if (v?.crew?.length === 3) C.members = v.crew.slice();
    else C.members = [...STARTER_CREW];
    C.active = Math.max(0, C.members.indexOf(C.activeId()));
    if (C.active < 0) C.active = 0;
  };
  C.swapTo = (i) => {
    if (i < 0 || i >= C.members.length) return false;
    if (i === C.active) return true;
    C.active = i;
    ctx.onSwap?.(C.members[i]);
    return true;
  };
  C.swapById = (id) => {
    const i = C.members.indexOf(id);
    return i >= 0 ? C.swapTo(i) : false;
  };
  C.next = (d = 1) => C.swapTo((C.active + d + C.members.length) % C.members.length);
  C.includes = (id) => C.members.includes(id);
  C.price = (total) => C.arcade ? priceFor(ctx.lead?.() || C.activeId(), total) : priceForCrew(C.members, total);
  return C;
}
