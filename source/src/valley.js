// Valley campaign (overhaul-123): 8 patches, save pm-valley-v1, heal → pack-up → wild.
import { SPECIES } from './data.js';

export const VALLEY_SAVE_KEY = 'pm-valley-v1';
export const HEAL_PACKUP = 0.85;
/** Beta: every valley level playable; set false to restore sequential unlock. */
export const UNLOCK_ALL_LEVELS = true;
export const PACKUP_REFUND = 0.5;

export const PATCHES = [
  { id: 'sunny_hollow', name: 'Sunny Hollow', emoji: '☀️', need: ['flyer', 'walker'], neighbor: 'bee', contest: null, blurb: 'Warm octagon clearing: deliver 20 Petals, hire 1, build 1 T1.' },
  { id: 'creek_bend', name: 'Creek Bend', emoji: '🌊', need: ['bridge', 'flyer'], neighbor: 'robin', contest: 'pollen_relay', blurb: 'U-creek, terraces, crossing + Honey Log; 10-Petal robin relay.' },
  { id: 'moon_meadow', name: 'Moon Meadow', emoji: '🌙', need: ['night'], neighbor: 'moth', contest: 'decorating', blurb: 'Hollow Oak climb; night every 3 min; collect 12 Dewdrops.' },
  { id: 'log_jam', name: 'Log Jam', emoji: '🪵', need: ['bear', 'pollinate'], neighbor: 'bear', contest: 'dance_off', blurb: 'Canyon jams: shove log ramps, 3 Honey Logs, Tower Dew Pond.' },
  { id: 'picnic_lawn', name: 'Picnic Lawn', emoji: '🧺', need: ['raccoon', 'robin'], neighbor: 'raccoon', contest: 'decorating', blurb: 'Picnic grid + lemonade stream; 2 Dew Ponds + Big Table bunch.' },
  { id: 'cliff_orchard', name: 'Cliff Orchard', emoji: '🍎', need: ['bat', 'hummingbird'], neighbor: 'bat', contest: 'pollen_relay', blurb: '4 ledge rings, Boulder Stair, waterfall Dew Pond, night Moonfruit.' },
  { id: 'windy_rise', name: 'Windy Rise', emoji: '💨', need: ['butterfly', 'bumblebee'], neighbor: 'butterfly', contest: 'dance_off', blurb: 'Terraces + canopy sky roads, night silk, Fork Tree Honey Log.' },
  { id: 'festival_glade', name: 'Festival Glade', emoji: '🎉', need: ['crew_all_roles'], neighbor: 'all', contest: 'festival', blurb: 'Full mix: Ribbon Creek, knoll Starheart, every earlier trick.' },
];

const STATES = ['wilted', 'in_progress', 'blooming', 'wild'];

function blankPatch(p) {
  return { id: p.id, state: 'wilted', heal: 0, contestDone: false, postcard: null };
}

export function defaultValley() {
  return {
    v: 1,
    patches: Object.fromEntries(PATCHES.map(p => [p.id, blankPatch(p)])),
    crew: ['bee', 'robin', 'bear'],
    unlocked: ['bee', 'robin', 'bear'],
    friendship: {}, // neighbor id → 0..3
    hireCount: {},
    festival: false,
    festivalSeen: false,
    activePatch: null,
  };
}

export function loadValley() {
  try {
    const raw = localStorage.getItem(VALLEY_SAVE_KEY);
    if (!raw) return defaultValley();
    const d = JSON.parse(raw);
    const base = defaultValley();
    if (!d || d.v !== 1) return base;
    for (const p of PATCHES) {
      const s = d.patches && d.patches[p.id];
      if (s && STATES.includes(s.state)) base.patches[p.id] = { ...blankPatch(p), ...s, id: p.id };
    }
    if (Array.isArray(d.crew) && d.crew.length === 3) base.crew = d.crew.slice(0, 3);
    if (Array.isArray(d.unlocked)) base.unlocked = [...new Set([...base.unlocked, ...d.unlocked.filter(id => SPECIES[id])])];
    if (d.friendship && typeof d.friendship === 'object') base.friendship = d.friendship;
    if (d.hireCount && typeof d.hireCount === 'object') base.hireCount = d.hireCount;
    base.festival = !!d.festival;
    base.festivalSeen = !!d.festivalSeen;
    base.activePatch = d.activePatch || null;
    return base;
  } catch (e) { return defaultValley(); }
}

export function saveValley(V) {
  try { localStorage.setItem(VALLEY_SAVE_KEY, JSON.stringify(V)); } catch (e) {}
}

export function patchDef(id) { return PATCHES.find(p => p.id === id) || null; }

export function createValley(ctx) {
  const V = loadValley();
  const api = {
    data: V,
    patches: PATCHES,
    healThreshold: HEAL_PACKUP,
    refund: PACKUP_REFUND,
    save() { saveValley(V); },
    resetAll() { Object.assign(V, defaultValley()); saveValley(V); },
    get(id) { return V.patches[id]; },
    def(id) { return patchDef(id); },
    setState(id, state) {
      const p = V.patches[id]; if (!p || !STATES.includes(state)) return;
      p.state = state; saveValley(V);
    },
    setHeal(id, h) {
      const p = V.patches[id]; if (!p) return;
      p.heal = Math.max(0, Math.min(1, h));
      if (p.state === 'wilted' && p.heal > 0) p.state = 'in_progress';
      if (p.heal >= 0.55 && p.state === 'in_progress') p.state = 'blooming';
      saveValley(V);
    },
    markContest(id) { const p = V.patches[id]; if (p) { p.contestDone = true; saveValley(V); } },
    markWild(id, postcard) {
      const p = V.patches[id]; if (!p) return;
      p.state = 'wild'; p.heal = 1; p.postcard = postcard || { at: Date.now() };
      V.activePatch = null;
      // unlock neighbor species
      const def = patchDef(id);
      if (def && def.neighbor && def.neighbor !== 'all' && SPECIES[def.neighbor] && !V.unlocked.includes(def.neighbor)) {
        V.unlocked.push(def.neighbor);
      }
      saveValley(V);
      api.checkFestival();
    },
    friendship(nid) { return Math.min(3, +(V.friendship[nid] || 0)); },
    addFriendship(nid, amt) {
      if (!nid || nid === 'all') return;
      V.friendship[nid] = Math.min(3, api.friendship(nid) + amt);
      saveValley(V);
    },
    noteHire(sp) {
      V.hireCount[sp] = (V.hireCount[sp] || 0) + 1;
      if ((V.hireCount[sp] || 0) >= 3 && SPECIES[sp] && !V.unlocked.includes(sp)) {
        V.unlocked.push(sp); ctx.toast?.(`${SPECIES[sp].emoji} ${SPECIES[sp].name} joined your Crew Tent!`, 2800);
      }
      saveValley(V);
    },
    allWild() { return PATCHES.every(p => V.patches[p.id].state === 'wild'); },
    friendsReady() {
      return PATCHES.every(p => {
        if (!p.neighbor || p.neighbor === 'all') return true;
        return api.friendship(p.neighbor) >= 1;
      });
    },
    checkFestival() {
      if (V.festival) return true;
      if (api.allWild() && api.friendsReady()) { V.festival = true; saveValley(V); return true; }
      return false;
    },
    openCount() {
      return PATCHES.filter(p => V.patches[p.id].state !== 'wild').length;
    },
    /** one open patch at a time for MVP — first non-wild, or continue in_progress/blooming */
    nextPlayable() {
      const mid = PATCHES.find(p => ['in_progress', 'blooming'].includes(V.patches[p.id].state));
      if (mid) return mid.id;
      const wilt = PATCHES.find(p => V.patches[p.id].state === 'wilted');
      return wilt ? wilt.id : null;
    },
    canStart(id, crewTags) {
      const def = patchDef(id), st = V.patches[id];
      if (!def || !st) return { ok: false, why: 'Unknown patch' };
      // When UNLOCK_ALL_LEVELS, wild patches are replayable (heal resets on start).
      if (st.state === 'wild' && !UNLOCK_ALL_LEVELS) return { ok: false, why: 'Already wild — postcard mode later' };
      if (!UNLOCK_ALL_LEVELS) {
        // one open at a time
        const busy = PATCHES.find(p => p.id !== id && ['in_progress', 'blooming'].includes(V.patches[p.id].state));
        if (busy && st.state === 'wilted') return { ok: false, why: `Finish ${busy.name} first` };
        // sequential unlock: prior patches must be wild (except continue)
        const idx = PATCHES.findIndex(p => p.id === id);
        if (st.state === 'wilted') {
          for (let i = 0; i < idx; i++) {
            if (V.patches[PATCHES[i].id].state !== 'wild') return { ok: false, why: `Heal ${PATCHES[i].name} first` };
          }
        }
      }
      const miss = missingNeeds(def.need, crewTags);
      if (miss.length) return { ok: false, why: 'Bring a ' + miss.join(' + ') + ' friend', miss };
      return { ok: true };
    },
  };
  return api;
}

/** Map need tags → human labels + check against crew skill tags */
export function missingNeeds(need, crewTags) {
  const tags = new Set(crewTags || []);
  const miss = [];
  for (const n of need || []) {
    if (n === 'flyer' && !tags.has('flyer')) miss.push('flyer');
    else if (n === 'walker' && !tags.has('walker')) miss.push('walker');
    else if (n === 'bridge' && !(tags.has('bridge') || tags.has('bear') || tags.has('opossum') || tags.has('wood-night'))) miss.push('bridge builder');
    else if (n === 'night' && !(tags.has('night') || tags.has('night-high') || tags.has('wood-night') || tags.has('moth') || tags.has('bat') || tags.has('opossum'))) miss.push('night animal');
    else if (n === 'pollinate' && !(tags.has('pollinate') || tags.has('bee') || tags.has('bumblebee'))) miss.push('pollinator');
    else if (n === 'crew_all_roles') {
      if (!tags.has('flyer')) miss.push('flyer');
      if (!tags.has('walker')) miss.push('walker');
      if (!(tags.has('night') || tags.has('night-high') || tags.has('wood-night') || tags.has('moth') || tags.has('bat') || tags.has('opossum'))) miss.push('night friend');
    }
    else if (['bee', 'robin', 'bear', 'raccoon', 'bat', 'hummingbird', 'butterfly', 'bumblebee', 'moth', 'opossum'].includes(n) && !tags.has(n)) miss.push(n);
  }
  return [...new Set(miss)];
}
