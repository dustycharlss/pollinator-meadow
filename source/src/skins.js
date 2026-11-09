// Class skins: each class (Scout / Trickster / Bruiser) has ONE ability + movement set (the default animal's).
// Every other animal in that class is purely cosmetic: model, wing animation and name. Physics, hitbox, abilities
// and puzzle checks always run on the class's base id (bee / raccoon / bear), so any skin plays identically.
import { SPECIES } from './data.js';

export const SKIN_BASE = { scout: 'bee', trickster: 'raccoon', bruiser: 'bear' };
export const SKINS = {
  scout: ['bee', 'bumblebee', 'hummingbird', 'butterfly', 'moth'],
  trickster: ['raccoon', 'opossum', 'robin', 'bat'],
  bruiser: ['bear', 'moose'],
};
// display info (non-species skins + short names that fit the dock / Pip lines)
export const SKIN_INFO = {
  bee: { name: 'Bee', em: '🐝' }, bumblebee: { name: 'Bumblebee', em: '🐝' }, hummingbird: { name: 'Hummingbird', em: '🐦' },
  butterfly: { name: 'Butterfly', em: '🦋' }, moth: { name: 'Moth', em: '🌙' },
  raccoon: { name: 'Raccoon', em: '🦝' }, opossum: { name: 'Opossum', em: '🐀' }, robin: { name: 'Robin', em: '🐦' }, bat: { name: 'Bat', em: '🦇' },
  bear: { name: 'Bear', em: '🐻' }, moose: { name: 'Moose', em: '🫎' },
};
const BASE_CLS = { bee: 'scout', raccoon: 'trickster', bear: 'bruiser' };
const KEY = 'pm_skins_v1';
let cur = { scout: 'bee', trickster: 'raccoon', bruiser: 'bear' };
try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const c in SKINS) if (SKINS[c].includes(s[c])) cur[c] = s[c]; } catch (e) {}
const subs = [];
export const getSkins = () => ({ ...cur });
export const skinOfCls = c => cur[c] || SKIN_BASE[c];
/** skin id shown for a crew (physics) id; non-crew ids map to themselves */
export const skinOf = id => BASE_CLS[id] ? skinOfCls(BASE_CLS[id]) : id;
export const skinName = id => { const s = skinOf(id); return SKIN_INFO[s]?.name || SPECIES[s]?.name || s; };
export const skinEm = id => { const s = skinOf(id); return SKIN_INFO[s]?.em || SPECIES[s]?.emoji || ''; };
export function setSkin(c, id) {
  if (!SKINS[c] || !SKINS[c].includes(id)) return false;
  cur[c] = id; try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
  for (const f of subs) try { f(c, id); } catch (e) { console.warn(e); }
  return true;
}
export const onSkin = f => subs.push(f);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Swap the default animal names/emoji in level text (Pip, banter, goal box) for the chosen skins. */
export function skinText(s) {
  if (!s || typeof s !== 'string') return s;
  for (const c in SKIN_BASE) {
    const b = SKIN_BASE[c], k = cur[c]; if (k === b) continue;
    const B = SKIN_INFO[b], K = SKIN_INFO[k];
    s = s.replace(new RegExp(esc(B.em) + '(\\s?)' + B.name + '\\b', 'g'), K.em + '$1' + K.name)
      .replace(new RegExp('\\b' + B.name + '\\b(?! Glade)', 'g'), K.name)
      .replace(new RegExp(esc(B.em), 'g'), K.em);
  }
  return s;
}
