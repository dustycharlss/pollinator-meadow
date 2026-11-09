// Valley campaign (overhaul-123): 8 patches, save pm-valley-v1, heal → pack-up → wild.
import { SPECIES, SPECIES_ORDER } from './data.js';
import { UNLOCK_ALL_SPECIES } from './crew.js';

export const VALLEY_SAVE_KEY = 'pm-valley-v1';
export const HEAL_PACKUP = 0.85;
/** Beta: every Act 1 valley level playable; set false to restore sequential unlock.
 *  Act 2 (Trailhead Trials + levels 9-16) always follows its story gate for players; UNLOCK_ALL_LEVELS only
 *  bypasses that gate in test mode (URL ?unlock=all, or localStorage pm_unlock_all = '1'). */
export const UNLOCK_ALL_LEVELS = true;
/** MASTER LEVEL GATE SWITCH. false = every level (Act 1, Training Garden, Trailhead Trials, 9-16 and any level
 *  added later) is open for every player, no URL flag needed, no locked tiles. Set true to bring back the story
 *  gates below (Act 1 sequence, Trailhead after 1-8, 9→16 in order) with ?unlock=all / pm_unlock_all as the test bypass. */
export const LEVEL_GATES_ENABLED = false;
export const gatesOff = () => !LEVEL_GATES_ENABLED;
export function testUnlock() {
  if (!LEVEL_GATES_ENABLED) return true;
  if (!UNLOCK_ALL_LEVELS) return false;
  try { if (/[?&]unlock=all\b/.test(location.search)) return true; return localStorage.getItem('pm_unlock_all') === '1'; } catch (e) { return false; }
}
/** Act 1 = the 8 story levels (Training Garden is the kids' practice path and doesn't count). */
export const ACT1_IDS = ['sunny_hollow', 'creek_bend', 'moon_meadow', 'log_jam', 'picnic_lawn', 'cliff_orchard', 'windy_rise', 'festival_glade'];
export const ACT2_IDS = ['trailhead_trials', 'sunbeam_grove', 'mill_pond', 'bramble_patch', 'weathervane_hill', 'hornet_hedge', 'owl_wood', 'frost_hollow', 'backyard_split'];
export const PACKUP_REFUND = 0.5;

export const PATCHES = [
  { id: 'training_garden', name: 'Training Garden', emoji: '🌱', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Start here! A tiny garden path that shows you every trick, one at a time.' },
  { id: 'sunny_hollow', name: 'Sunny Hollow', emoji: '☀️', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'bee', contest: null, blurb: 'Warm clearing by the Home Stump. Find Petals and a secret Starseed.' },
  { id: 'creek_bend', name: 'Creek Bend', emoji: '🌊', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'robin', contest: null, blurb: 'A U-shaped creek with stepped banks. Cross the water and grab Petals.' },
  { id: 'moon_meadow', name: 'Moon Meadow', emoji: '🌙', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'moth', contest: null, blurb: 'Climb the Hollow Oak. Night falls every 3 minutes.' },
  { id: 'log_jam', name: 'Log Jam', emoji: '🪵', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'bear', contest: null, blurb: 'Canyon log jams and a tall tower to climb.' },
  { id: 'picnic_lawn', name: 'Picnic Lawn', emoji: '🧺', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'raccoon', contest: null, blurb: 'A giant picnic blanket beside a lemonade stream.' },
  { id: 'cliff_orchard', name: 'Cliff Orchard', emoji: '🍎', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'bat', contest: null, blurb: 'Four cliff ledges, a boulder stair and a waterfall.' },
  { id: 'windy_rise', name: 'Windy Rise', emoji: '💨', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'butterfly', contest: null, blurb: 'Windy terraces and canopy sky roads.' },
  { id: 'festival_glade', name: 'Festival Glade', emoji: '🎉', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: 'all', contest: null, blurb: 'The big finale: Ribbon Creek, the knoll and every trick you know.' },
  // ---- Act 2 (Fern act2-mechanics-levels.md): one new mechanic + one sneak-only enemy per level ----
  { act: 2, n: 0, id: 'trailhead_trials', name: 'Trailhead Trials', emoji: '🥾', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'A trail of 8 tiny stops that peek at every new trick and critter. No fail!', teach: 'All 8 new tricks · all 8 critters (asleep)' },
  { act: 2, n: 9, id: 'sunbeam_grove', name: 'Sunbeam Grove', emoji: '☀️', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Aim the sunbeam to make ghost steps solid. Tiptoe past the Sleepy Badger.', teach: 'Light & Shadow · Sleepy Badger' },
  { act: 2, n: 10, id: 'mill_pond', name: 'Mill Pond', emoji: '🌊', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Raise and lower the pond with sluice gates. Mind the Snapping Turtle.', teach: 'Water Level · Snapping Turtle' },
  { act: 2, n: 11, id: 'bramble_patch', name: 'Bramble Patch', emoji: '🌱', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Plant and water seeds to grow vines and bouncy mushrooms. A Grumpy Spider guards the webs.', teach: 'Seed Growing · Grumpy Spider' },
  { act: 2, n: 12, id: 'weathervane_hill', name: 'Weathervane Hill', emoji: '🌬️', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Crank the vane to flip the wind. Hide from the Patrol Crow.', teach: 'Wind Vanes · Patrol Crow' },
  { act: 2, n: 13, id: 'hornet_hedge', name: 'Hornet Hedge', emoji: '🌰', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Hand the Golden Acorn down the hedge. Puff smoke past the Wasp Nests.', teach: 'Carry Chain · Wasp Nest' },
  { act: 2, n: 14, id: 'owl_wood', name: 'Owl Wood', emoji: '🦉', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Ring day and night. Find the Glow Lantern and Echo Whistle. Hide from the Night Owl.', teach: 'Day/Night + night gear · Night Owl' },
  { act: 2, n: 15, id: 'frost_hollow', name: 'Frost Hollow', emoji: '❄️', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'Ring summer, winter or spring. Freeze the creek, slide in the mud, sneak past the Fox.', teach: 'Seasons (ice + mud) · Prowling Fox' },
  { act: 2, n: 16, id: 'backyard_split', name: 'Backyard Split', emoji: '🏡', need: ['cls-scout', 'cls-trickster', 'cls-bruiser'], neighbor: null, contest: null, blurb: 'The Act 2 finale: the crew starts split up across a giant backyard. Dodge the sprinkler and mower!', teach: 'Two-Room Split · Garden Hazards' },
];
export const ACT1_PATCHES = PATCHES.filter(p => !p.act);
export const ACT2_PATCHES = PATCHES.filter(p => p.act === 2);

const STATES = ['wilted', 'in_progress', 'blooming', 'wild'];

function blankPatch(p) {
  return { id: p.id, state: 'wilted', heal: 0, contestDone: false, postcard: null };
}

export function defaultValley() {
  return {
    v: 1,
    patches: Object.fromEntries(PATCHES.map(p => [p.id, blankPatch(p)])),
    crew: ['bee', 'robin', 'bear'],
    // When UNLOCK_ALL_SPECIES, every animal starts unlocked (unlock-by-play later).
    unlocked: UNLOCK_ALL_SPECIES ? SPECIES_ORDER.slice() : ['bee', 'robin', 'bear'],
    friendship: {}, // neighbor id → 0..3
    hireCount: {},
    festival: false,
    festivalSeen: false,
    activePatch: null,
    stars: {},
    beaten: [],
    act2Seen: false,
    trailBadge: false,
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
    if (UNLOCK_ALL_SPECIES) base.unlocked = SPECIES_ORDER.slice();
    if (d.friendship && typeof d.friendship === 'object') base.friendship = d.friendship;
    if (d.hireCount && typeof d.hireCount === 'object') base.hireCount = d.hireCount;
    base.festival = !!d.festival;
    base.festivalSeen = !!d.festivalSeen;
    base.activePatch = d.activePatch || null;
    if (d.stars && typeof d.stars === 'object') base.stars = d.stars;
    if (Array.isArray(d.beaten)) base.beaten = d.beaten.filter(id => patchDef(id));
    base.act2Seen = !!d.act2Seen; base.trailBadge = !!d.trailBadge;
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
    allWild() { return ACT1_PATCHES.every(p => V.patches[p.id].state === 'wild'); },
    /** a level counts as beaten once it was finished (exit reached) at least once — replays don't undo it */
    beaten(id) { return (V.beaten || []).includes(id) || !!(V.stars && V.stars[id]) || V.patches[id]?.state === 'wild'; },
    markBeaten(id) { V.beaten = V.beaten || []; if (!V.beaten.includes(id)) { V.beaten.push(id); saveValley(V); return true; } return false; },
    act1Done() { return ACT1_IDS.every(id => api.beaten(id)); },
    /** Act 2 story gate: Trailhead Trials after levels 1-8; Trailhead unlocks 9; then 9→16 in order */
    act2Gate(id) {
      const k = ACT2_IDS.indexOf(id); if (k < 0) return { ok: true };
      if (!LEVEL_GATES_ENABLED) return { ok: true };
      if (testUnlock()) return { ok: true, test: true };
      if (!api.act1Done()) { const left = ACT1_IDS.filter(q => !api.beaten(q)).length; return { ok: false, why: `Beat levels 1–8 first (${left} to go)` }; }
      if (k === 0) return { ok: true };
      const prev = ACT2_IDS[k - 1];
      if (!api.beaten(prev)) return { ok: false, why: `Finish ${patchDef(prev).name} first` };
      return { ok: true };
    },
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
      return ACT1_PATCHES.filter(p => V.patches[p.id].state !== 'wild').length;
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
      if (def.act === 2) { const g = api.act2Gate(id); if (!g.ok) return g; }
      // When UNLOCK_ALL_LEVELS, wild patches are replayable (heal resets on start).
      if (st.state === 'wild' && !UNLOCK_ALL_LEVELS && LEVEL_GATES_ENABLED) return { ok: false, why: 'Already wild — postcard mode later' };
      if (!UNLOCK_ALL_LEVELS && LEVEL_GATES_ENABLED && !def.act) {
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
    else if (n.startsWith('cls-')) { if (!tags.has(n)) miss.push(n.slice(4)); }
    else if (n === 'crew_all_roles') {
      if (!tags.has('flyer')) miss.push('flyer');
      if (!tags.has('walker')) miss.push('walker');
      if (!(tags.has('night') || tags.has('night-high') || tags.has('wood-night') || tags.has('moth') || tags.has('bat') || tags.has('opossum'))) miss.push('night friend');
    }
    else if (['bee', 'robin', 'bear', 'raccoon', 'bat', 'hummingbird', 'butterfly', 'bumblebee', 'moth', 'opossum'].includes(n) && !tags.has(n)) miss.push(n);
  }
  return [...new Set(miss)];
}
