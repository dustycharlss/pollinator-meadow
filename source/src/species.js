// Species archetypes: one data table for every playable / hirable animal.
// Size class drives the trade-off: big ground haulers carry a lot but move slowly and must walk around water;
// small fliers are quick and ignore terrain but bring home tiny loads. Peaceful: everyone just gathers plentiful food.
import { SPECIES, SPECIES_ORDER } from './data.js';

// run = ground speed, fly = flight speed multiplier, carry = load, pick = units per flower, reach = pickup range,
// drain = flight stamina use per second, h* = hired-helper speed / load / gathering time (s),
// mix = how this species prices things when it is the round's lead, by = free by-product when it is the lead.
export const ARCH = {
  bee:         { size: 'S', run: 8.5, fly: 1.55, carry: 6,  pick: 1, reach: 3.0, drain: 0.27, hSpd: 8.5, hCap: 3, hEat: 0.8, mix: { n: 0.75, h: 0.25 }, by: { k: 'h', per: 4 },
    str: ['Quick nectar runs', 'Flies over everything', 'Makes a little 🍯 as it delivers'], weak: ['Tiny loads (6)', 'Stamina runs out'] },
  butterfly:   { size: 'S', run: 7.2, fly: 1.35, carry: 6,  pick: 1, reach: 3.8, drain: 0.17, hSpd: 7.0, hCap: 3, hEat: 1.0, mix: { n: 1 }, by: null,
    str: ['Longest glide', 'Wide pickup reach', 'Great for growing territory (tech)'], weak: ['Slow-ish, drifty', 'Small loads'] },
  hummingbird: { size: 'S', run: 10,  fly: 1.8,  carry: 4,  pick: 2, reach: 2.6, drain: 0.45, hSpd: 10.5, hCap: 2, hEat: 0.6, mix: { n: 1 }, by: null,
    str: ['Fastest animal', '2 nectar per flower', 'Quick sips'], weak: ['Smallest load (4)', 'Burns stamina fast', 'Must slow to sip'] },
  moth:        { size: 'S', run: 7.5, fly: 1.3,  carry: 6,  pick: 1, reach: 3.4, drain: 0.26, hSpd: 6.5, hCap: 3, hEat: 1.0, night: 1.25, mix: { n: 0.7, f: 0.3 }, by: { k: 'f', per: 4 },
    str: ['+25% speed at night', 'Good reach'], weak: ['Slow by day', 'Small loads'] },
  bat:         { size: 'M', run: 8,   fly: 2.1,  carry: 7,  pick: 2, reach: 4.2, drain: 0.24, hSpd: 9.0, hCap: 4, hEat: 1.0, night: 1.2, mix: { n: 0.65, f: 0.35 }, by: { k: 'f', per: 3 },
    str: ['Fast swooping flight', 'Huge reach', '+20% speed at night'], weak: ['Can never stop flying', 'Medium loads'] },
  bumblebee:   { size: 'M', run: 7.0, fly: 1.3,  carry: 10, pick: 1, reach: 3.2, drain: 0.30, hSpd: 6.0, hCap: 5, hEat: 1.0, mix: { n: 0.75, h: 0.25 }, by: { k: 'h', per: 4 },
    str: ['Biggest flier load (10)', 'Makes a little 🍯'], weak: ['Slow, clumsy flight'] },
  robin:       { size: 'M', run: 9.2,            carry: 10, pick: 1, reach: 1.8, drain: 0.5,  hSpd: 7.2, hCap: 4, hEat: 0.9, mix: { f: 0.75, w: 0.25 }, by: { k: 'w', per: 4 },
    str: ['All-rounder: quick and decent loads', 'Short flutter', 'Brings home twigs 🪵'], weak: ['Short reach', 'Walks around water'] },
  raccoon:     { size: 'L', run: 8.4,            carry: 14, pick: 1, reach: 2.0, hSpd: 6.0, hCap: 6, hEat: 1.0, mix: { f: 0.7, n: 0.3 }, by: { k: 'n', per: 4 },
    str: ['Big loads (14)', 'Mixed haul: berries give 🌼 too', 'Double jump'], weak: ['Slower', 'Walks around water'] },
  opossum:     { size: 'L', run: 7.9,            carry: 14, pick: 1, reach: 1.9, hSpd: 5.6, hCap: 7, hEat: 1.1, night: 1.15, mix: { w: 0.75, f: 0.25 }, by: { k: 'f', per: 4 },
    str: ['Wood specialist 🪵', 'Big loads (14)', '+15% speed at night'], weak: ['Slow', 'Walks around water'] },
  bear:        { size: 'L', run: 7.2,            carry: 20, pick: 1, reach: 2.4, hSpd: 4.8, hCap: 9, hEat: 1.2, mix: { h: 0.65, f: 0.35 }, by: { k: 'f', per: 3 },
    str: ['Huge loads (20)', 'Honey 🍯 + bugs', 'Strong jumps'], weak: ['Slowest animal', 'Slow to gather', 'Walks around water'] }
};
export const SIZE_NAME = { S: 'Small · fast', M: 'Medium', L: 'Big · slow hauler' };
for (const id of SPECIES_ORDER) { const a = ARCH[id]; a.econ = Math.max(1, Math.pow(a.carry / 7, 0.25)); } // Fern balance pass: big animals pay less extra

// apply to the species table (gear & tech multiply on top of these)
for (const id of SPECIES_ORDER) {
  const a = ARCH[id], s = SPECIES[id]; if (!s) continue;
  s.carry = a.carry; s.yield = a.pick; s.reach = a.reach; s.size_class = a.size;
  if (s.mv) { s.mv.run = a.run; if (s.mv.fly) { if (a.fly) s.mv.fly.speed = a.fly; if (a.drain) s.mv.fly.drain = a.drain; } }
}

/** price a total value in the lead species' own resources, scaled to its economy */
export function priceFor(lead, total) {
  const a = ARCH[lead] || ARCH.bee, o = {}; if (!total) return o;
  const v = total * a.econ; if (v <= 20) o.p = Math.max(1, Math.round(v)); else { o.p = Math.round(v * 0.75); o.d = Math.max(1, Math.round(v * 0.08)); }
  return o;
}

/** normalised 0..1 stat bars for UI */
const MAXV = { speed: 10.5, carry: 20, gather: 2, reach: 4.2 };
export function statBars(id) {
  const a = ARCH[id]; const flier = !!SPECIES[id]?.mv?.fly && !SPECIES[id].ground;
  return [
    ['Speed', a.run * (flier ? a.fly / 1.5 : 1) / MAXV.speed],
    ['Carry', a.carry / MAXV.carry],
    ['Gather', (a.pick / a.hEat) / 2.6],
    ['Reach', a.reach / MAXV.reach],
    ['Stamina', flier ? Math.min(1, 0.12 / a.drain * 1.6) : (SPECIES[id].mv?.fly ? 0.25 : 1)]
  ].map(([k, v]) => [k, Math.max(0.06, Math.min(1, v))]);
}
export const barsHtml = (id, cls = 'sb') => `<div class="${cls}">` + statBars(id).map(([k, v]) => `<div><span>${k}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`).join('') + '</div>';
