import { FEATURES } from './features.js';
// The timed round: clock, score breakdown, round resources, best scores and the round save.
export const LENGTHS = [3, 5, 10, 15, 20];
const ROUND_KEY = 'pollinator-meadow-round-v1', BEST_KEY = 'pollinator-meadow-best-v1', SET_KEY = 'pollinator-meadow-settings-v1';
export const CATS = [['gather', '🌼', 'Gathering'], ['building', '🔨', 'Building'], ['territory', '🗺️', 'Territory'], FEATURES.teamFoods ? ['team', '🤝', 'Teamwork foods & journal'] : ['team', '📖', 'Journal pages'], ['upkeep', '💧', 'Upkeep bonuses'], ['explore', '✨', 'Dewdrops'], ['admin', '🛠️', 'Admin bonus']];
const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };

export function loadSettings() { return Object.assign({ len: 10, vol: 0.7, mute: false }, j(SET_KEY, {})); }
export function saveSettings(s) { try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch (e) {} }
export const bests = () => j(BEST_KEY, {});
export function setBest(len, score) { const b = bests(); if (score > (b[len] || 0)) { b[len] = score; try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) {} return true; } return false; }
export const savedRound = () => { const r = j(ROUND_KEY, null); return r && !r.over && r.left > 3 ? r : null; };
export const clearRound = () => { try { localStorage.removeItem(ROUND_KEY); } catch (e) {} };
export function wipeAll() { try { ['pollinator-meadow-v1', ROUND_KEY, BEST_KEY, SET_KEY].forEach(k => localStorage.removeItem(k)); } catch (e) {} }

export function createRound(onChange) {
  const R = {
    len: 10, total: 600, elapsed: 0, left: 600, running: false, over: false, timerPaused: false, tickT: 0, speed: 1,
    res: { p: 0, d: 0, s: 0 }, sc: {}, stats: { units: 0, builds: {}, pages: 0, dew: 0, maxPct: 0, helpers: 0, helperUnits: 0 }, onEnd: null, flashK: null, flashT: 0, free: false
  };
  for (const [k] of CATS) R.sc[k] = 0;
  R.score = () => Math.floor(CATS.reduce((a, [k]) => a + R.sc[k], 0));
  R.reset = len => { R.free = false; R.noTimer = false; R.mode = 'challenge'; R.len = len; R.total = len * 60; R.elapsed = 0; R.left = R.total; R.running = false; R.over = false; R.timerPaused = false; R.res = { p: 0, d: 0, s: 0 }; for (const [k] of CATS) R.sc[k] = 0; R.stats = { units: 0, builds: {}, pages: 0, dew: 0, maxPct: 0, helpers: 0, helperUnits: 0 }; onChange && onChange(); };
  R.add = (cat, pts) => { if (R.over) return; R.sc[cat] += pts; };
  R.addRes = (k, n) => { if (!(k in R.res)) k = 'p'; R.res[k] = Math.max(0, R.res[k] + n); R.stats.gained = R.stats.gained || {}; if (n > 0) R.stats.gained[k] = (R.stats.gained[k] || 0) + n; onChange && onChange(); };
  const nk = c => { const o = {}; for (const k in c) { const kk = k in R.res ? k : 'p'; o[kk] = (o[kk] || 0) + c[k]; } return o; };
  R.canPay = c => { c = nk(c); return Object.keys(c).every(k => R.res[k] >= c[k]); };
  R.pay = c => { c = nk(c); for (const k in c) R.res[k] -= c[k]; onChange && onChange(); };
  R.flash = k => { R.flashK = k; R.flashT = 1; };
  R.noteBuild = t => { R.stats.builds[t] = (R.stats.builds[t] || 0) + 1; };
  R.setLeft = s => { R.left = Math.max(0, s); R.elapsed = R.total - R.left; if (R.left <= 0) R.finish(); };
  R.finish = () => { if (R.over) return; R.over = true; R.running = false; R.left = 0; R.onEnd && R.onEnd(); };
  R.tick = dt => { if (!R.running || R.over || R.timerPaused || R.free || R.noTimer) return; R.elapsed += dt; R.left = Math.max(0, R.total - R.elapsed); if (R.left <= 0) R.finish(); };
  R.serialize = () => ({ mode: R.mode, len: R.len, elapsed: R.elapsed, left: R.left, over: R.over, res: R.res, sc: R.sc, stats: R.stats });
  R.restore = s => { R.mode = s.mode === 'relaxed' ? 'relaxed' : 'challenge'; R.len = s.len; R.total = s.len * 60; R.elapsed = s.elapsed; R.left = s.left; R.over = false; const o = s.res || {}; if ('n' in o || 'f' in o || 'w' in o || 'h' in o) { R.res = { p: (o.n || 0) + (o.f || 0) + (o.w || 0) + (o.h || 0) + (o.p || 0), d: (o.d || 0) + Math.floor((o.h || 0) / 10), s: o.s || 0 }; R.migrated = true; } else R.res = Object.assign({ p: 0, d: 0, s: 0 }, o); for (const [k] of CATS) R.sc[k] = s.sc?.[k] || 0; R.stats = Object.assign({ units: 0, builds: {}, pages: 0, dew: 0, maxPct: 0, helpers: 0, helperUnits: 0 }, s.stats); };
  R.save = extra => { try { localStorage.setItem(ROUND_KEY, JSON.stringify({ ...R.serialize(), ...extra })); } catch (e) {} };
  return R;
}
