// Adaptive, lazily-streamed music: one <audio> element per playing track routed through Web Audio gains (so fades also work on iOS),
// crossfaded between moods and from the end of a track into the next (so "loops with fade" tracks loop without a seam).
// Nothing is downloaded until its mood is first needed. g = per-track loudness trim (measured mean volume -> about -20 dB).
const BASE = import.meta.env.BASE_URL + 'audio/music/';
export const TRACKS = {
  // Beans' round set (CC-BY Matthew Pablo except results, CC0 KiluaBoy); loop:true = file wraps seamlessly, so no end crossfade
  title: [{ f: 'rounds/title-theme-loop', g: 0.95, loop: true }],
  final: [{ f: 'rounds/final-minute-loop', g: 0.95, loop: true }],
  results: [{ f: 'rounds/results-loop', g: 0.76, loop: true }],
  hush: [],
  day: [{ f: 'oga_blue-meadow-in-green-sky', g: 0.80 }, { f: 'matthewpablo_lively-meadow-song-loop', g: 0.89 }],
  // seasonal day moods (Beans' CC0 season set, plus one existing day track each for variety)
  spring: [{ f: 'season_spring-forget-me-not', g: 1.06 }, { f: 'matthewpablo_lively-meadow-song-loop', g: 0.89 }],
  summer: [{ f: 'season_summer-summertown', g: 0.92 }, { f: 'oga_blue-meadow-in-green-sky', g: 0.80 }],
  autumn: [{ f: 'season_autumn-apple-cider', g: 0.96 }, { f: 'oga_blue-meadow-in-green-sky', g: 0.80 }],
  winter: [{ f: 'season_winter-snowfall', g: 1.36 }, { f: 'season_winter-wintery-loop', g: 1.23 }],
  night: [{ f: 'fupi_bird-in-hand-night', g: 0.91 }, { f: 'macleod_moonstone', g: 1.11 }],
  morning: [{ f: 'sudocolon_sunrise', g: 1.03 }],
  dusk: [{ f: 'kiluaboy_sunset-walk', g: 0.81 }],
  puzzle: [{ f: 'mintodog_cozy-puzzle-in-game-1', g: 1.03 }],
};
// normalized (-18 LUFS) jingles from Beans' game_use column; gains kept conservative (not yet listened to)
export const JINGLES = { clear: { f: 'jingles/norm/mintodog_cozy-puzzle-clear-n18', g: 0.75, len: 5.7 }, stage: { f: 'jingles/norm/kenney_pizzi03-n18', g: 0.75, len: 1.2 },
  win: { f: 'rounds/win-theme', g: 0.85, len: 7.5 }, goal: { f: 'jingles/norm/kenney_pizzi07-n18', g: 0.7, len: 1.4 }, unlock: { f: 'jingles/norm/kenney_nes00-n18', g: 0.7, len: 1.8 } };
const EXT = (() => { try { return document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a'; } catch (e) { return 'ogg'; } })();
let LEVEL = 0.4;

export function createMusic() {
  let ctx = null, master = null, jbus = null, cur = null, mood = null, want = 'title', muted = false, hidden = false, started = false, duckTo = 0, timer = 0;
  const rot = {}, jcache = {};
  const pick = m => { const L = TRACKS[m]; if (!L || !L.length) return null; rot[m] = (rot[m] ?? -1) + 1; return L[rot[m] % L.length]; };
  function voice(tr, fadeS) {
    const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = BASE + tr.f + '.' + EXT;
    const g = ctx.createGain(); g.gain.value = 0; let src; try { src = ctx.createMediaElementSource(el); src.connect(g); g.connect(master); } catch (e) { return null; }
    if (tr.loop) el.loop = true; const v = { el, g, src, tr, dead: false, next: false };
    el.addEventListener('playing', () => { if (v.dead) return; const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(tr.g, t + fadeS); }, { once: true });
    el.play().catch(() => {}); return v;
  }
  function kill(v, fadeS) {
    v.dead = true; const t = ctx.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + fadeS);
    setTimeout(() => { try { v.el.pause(); v.el.removeAttribute('src'); v.el.load(); v.src.disconnect(); v.g.disconnect(); } catch (e) {} }, fadeS * 1000 + 400);
  }
  function go(tr, fadeS) { const old = cur; cur = tr ? voice(tr, fadeS) : null; if (old) kill(old, fadeS); }
  function tick() {
    if (!ctx || hidden) return;
    if (want !== mood) { mood = want; go(pick(mood), mood === 'title' ? 1.8 : mood === 'final' ? 2.5 : 3.5); return; }
    if (cur && !cur.tr.loop && !cur.next && isFinite(cur.el.duration) && cur.el.duration > 8 && cur.el.duration - cur.el.currentTime < 2.8) { cur.next = true; go(pick(mood), 2.6); }
  }
  const api = {
    start(c, out) { if (started) return; started = true; ctx = c; const dst = out || ctx.destination; master = ctx.createGain(); master.gain.value = muted ? 0 : LEVEL; master.connect(dst); jbus = ctx.createGain(); jbus.gain.value = 0.85; jbus.connect(dst); timer = setInterval(tick, 250); tick(); },
    mood(m) { want = m; }, get current() { return want; },
    volume(v) { LEVEL = 0.4 * Math.max(0, Math.min(1, v)) / 0.7; if (master && !muted) master.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.05); },
    mute(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, 0.05); },
    duck(sec) { if (!master || muted) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(LEVEL * 0.28, t, 0.1); master.gain.setTargetAtTime(LEVEL, t + sec, 0.6); },
    jingle(name) {
      const J = JINGLES[name]; if (!ctx || muted || !J) return; let o = jcache[name];
      if (!o) { const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = BASE + J.f + '.' + EXT; const g = ctx.createGain(); g.gain.value = J.g; try { ctx.createMediaElementSource(el).connect(g); g.connect(jbus); } catch (e) { return; } o = jcache[name] = { el }; }
      try { o.el.currentTime = 0; } catch (e) {} o.el.play().catch(() => {}); api.duck(J.len);
    },
    warm() { for (const k in JINGLES) fetch(BASE + JINGLES[k].f + '.' + EXT).catch(() => {}); },
    hide(h) { hidden = h; if (!cur) return; if (h) cur.el.pause(); else cur.el.play().catch(() => {}); },
    debug() { return { want, mood, ext: EXT, track: cur && cur.tr.f, t: cur && +cur.el.currentTime.toFixed(1), dur: cur && cur.el.duration, gain: cur && +cur.g.gain.value.toFixed(2), paused: cur && cur.el.paused, master: master && +master.gain.value.toFixed(2), muted }; },
  };
  return api;
}
