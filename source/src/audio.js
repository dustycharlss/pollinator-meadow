import { createMusic } from './music.js';
import { EXT, EXT_SFX, withFallback } from './audio-fmt.js';
import { loadVoiceLines, voiceUrl, firstVoiceId } from './voice.js';
const BASE = import.meta.env.BASE_URL;
// Mixer (t22u): master -> destination, with buses music / sfx (gameplay) / amb (ambience) / rain. Slider values 0..1 map linearly
// to bus gain. Master 70% (the old default) = unity gain.
export const RAIN_BASE = 0.065; // was 0.13 straight to the speakers (and it ignored the volume slider); halved, and it now has its own bus
export function createAudio() {
  let ctx = null, started = false, muted = false, rainN = null, master = null, night = 0, calm = 0;
  const samples = new Map();
  const lv = { master: 0.7, music: 1, sfx: 1, ui: 1, amb: 1, rain: 0.5, voice: 1 }, bus = {};
  const curve = v => Math.max(0, Math.min(1, v));
  const gainOf = k => k === 'master' ? (muted ? 0 : curve(lv.master) / 0.7) : curve(lv[k]);
  const music = createMusic();
  // Ambience (Beans, all -24 LUFS seamless loops): layered beds, each streamed lazily the first time it is needed.
  // gain = base * condition; levels kept conservative (not listened to yet). creek is driven by distance to water.
  const AMB = { wind: { f: 'wind-grass-loop', b: 0.3 }, birds: { f: 'daytime-birdsong-loop', b: 0.42 }, insects: { f: 'insect-hum-loop', b: 0.22 },
    creek: { f: 'creek-trickle-loop', b: 0.5 }, night: { f: 'night-crickets-frogs-loop', b: 0.4 } };
  const lvlAmb = { name: null, el: null, g: null, vol: 0.55 };
  let creek = 0, winter = false, hidden = false, rainEl = null, rainNoise = false, rainNoiseOn = false;
  let voiceEl = null, voiceWant = null, readAloud = false;
  const want = k => { const d = 1 - night, c = 1 - 0.75 * calm;
    return k === 'wind' ? 0.6 + 0.4 * calm : k === 'birds' ? d * c * (winter ? 0.4 : 1) : k === 'insects' ? d * c * (winter ? 0 : 1) : k === 'creek' ? creek : night * (winter ? 0.3 : 1) * (1 - 0.5 * calm); };
  const ambLevel = k => Math.max(0, AMB[k].b * want(k));
  function ambEl(k) {
    const A = AMB[k]; if (A.el) return A;
    const el = A.el = withFallback(new Audio(BASE + 'audio/ambient/' + A.f + '.' + EXT)); el.loop = true; el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.muted = muted;
    if (ctx) { try { const src = ctx.createMediaElementSource(el); A.g = ctx.createGain(); A.g.gain.value = 0; src.connect(A.g); A.g.connect(bus.amb); } catch (e) { A.g = null; } }
    if (!A.g) el.volume = 0;
    return A;
  }
  let ambT = 0;
  function applyAmb(force) {
    if (!started) return; const now = performance.now(); if (!force && now - ambT < 200) return; ambT = now;
    for (const k in AMB) {
      const v = ambLevel(k), A = AMB[k];
      if (!A.el && v < 0.01) continue; ambEl(k);
      if (A.g) A.g.gain.setTargetAtTime(v, ctx.currentTime, 0.8); else A.el.volume = Math.min(1, v * gainOf('amb') * gainOf('master'));
      const on = v >= 0.005 && !hidden && !muted;
      if (on && A.el.paused) A.el.play().catch(() => {}); else if (!on && !A.el.paused && (!A.g || A.g.gain.value < 0.004)) A.el.pause();
    }
  }
  function apply(k) {
    if (k === 'amb' || k === 'master') applyAmb(true);
    if (!ctx) return;
    for (const b of k === 'all' ? Object.keys(bus) : [k]) bus[b] && bus[b].gain.setTargetAtTime(gainOf(b), ctx.currentTime, 0.03);
  }
  const sfxOut = () => bus.sfx || ctx.destination;
  const sfxLoops = new Map();
  function startSfxLoop(name, vol = 0.45) {
    api.start();
    if (!ctx || muted) return;
    const cur = sfxLoops.get(name);
    if (cur && cur.el && !cur.el.paused) return;
    if (cur) stopSfxLoop(name);
    const ext0 = /^(act3|online)\//.test(name) ? EXT : EXT_SFX;
    const el = withFallback(new Audio(BASE + 'audio/sfx/' + name + '.' + ext0));
    el.loop = true; el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.muted = muted;
    const rec = { el, g: null, vol, name };
    try {
      const src = ctx.createMediaElementSource(el), g = ctx.createGain();
      g.gain.value = vol; src.connect(g); g.connect(sfxOut()); rec.g = g;
    } catch (e) { rec.g = null; }
    if (!rec.g) el.volume = Math.min(1, vol * gainOf('sfx') * gainOf('master'));
    sfxLoops.set(name, rec);
    if (!hidden && !muted) el.play().catch(() => {});
  }
  function stopSfxLoop(name) {
    const stopOne = r => {
      if (!r) return;
      try { r.el.pause(); r.el.removeAttribute('src'); r.el.load(); } catch (e) {}
      try { r.g && r.g.disconnect(); } catch (e) {}
    };
    if (name) { stopOne(sfxLoops.get(name)); sfxLoops.delete(name); }
    else { for (const r of sfxLoops.values()) stopOne(r); sfxLoops.clear(); }
  }
  const api = {
    music,
    start() {
      if (started) return; started = true;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch (e) { ctx = null; }
      if (ctx) {
        master = bus.master = ctx.createGain(); master.gain.value = gainOf('master'); master.connect(ctx.destination);
        for (const k of ['music', 'sfx', 'amb', 'rain', 'voice']) { bus[k] = ctx.createGain(); bus[k].gain.value = gainOf(k); bus[k].connect(master); }
        bus.ui = ctx.createGain(); bus.ui.gain.value = gainOf('ui'); bus.ui.connect(bus.sfx); // UI sounds: child of the Gameplay (sfx) slider
        music.start(ctx, bus.music);
        // iOS: a silent one-sample buffer inside the gesture fully unlocks output
        try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
      }
      applyAmb(true);
      if (lvlAmb.name && !lvlAmb.g) { const n = lvlAmb.name; lvlAmb.name = null; api.levelAmb(n, lvlAmb.vol); }
    },
    /** set one bus level 0..1: master | music | sfx | amb | rain | voice */
    set(k, v) { if (!(k in lv)) return; lv[k] = Math.max(0, Math.min(1, +v || 0)); apply(k); },
    levels: () => ({ ...lv }),
    volume(v) { api.set('master', v); },
    setMute(m) { muted = !!m; for (const k in AMB) if (AMB[k].el) AMB[k].el.muted = muted; for (const r of sfxLoops.values()) r.el.muted = muted; if (rainEl) rainEl.muted = muted; if (voiceEl) voiceEl.muted = muted; if (muted) api.stopVoice(); if (lvlAmb.el) { lvlAmb.el.muted = muted; if (!muted && !hidden) lvlAmb.el.play().catch(() => {}); } music.mute(muted); apply('master'); applyAmb(true); return !muted; },
    toggle() { return api.setMute(!muted); },
    night(v, c = 0) { night = v; calm = c; applyAmb(); },
    /** ambience context: w = 0..1 closeness to water (creek bed), win = winter (no insects) */
    ambCtx(w, win) { creek = Math.max(0, Math.min(1, w)); winter = !!win; applyAmb(); },
    /** rain: ambient/rain-light-loop on bus.rain at RAIN_BASE*v; the filtered noise bed is the fallback if the loop can't load. v 0..1 */
    rain(v) {
      if (!ctx) return;
      if (!rainN && !rainNoise) {
        if (v <= 0.001) return;
        rainN = ctx.createGain(); rainN.gain.value = 0; rainN.connect(bus.rain);
        try { rainEl = withFallback(new Audio(BASE + 'audio/ambient/rain-light-loop.' + EXT)); rainEl.loop = true; rainEl.crossOrigin = 'anonymous'; rainEl.preload = 'auto'; rainEl.muted = muted; ctx.createMediaElementSource(rainEl).connect(rainN); rainEl.addEventListener('error', () => { rainEl = null; rainNoise = true; }); }
        catch (e) { rainEl = null; rainNoise = true; }
      }
      if (rainNoise && !rainNoiseOn) { rainNoiseOn = true;
        const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = b * 0.82 + w * 0.18; d[i] = b * 3.2; }
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 0.35;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
        src.connect(bp); bp.connect(hp); hp.connect(rainN); src.start();
      }
      rainN.gain.setTargetAtTime(v * RAIN_BASE, ctx.currentTime, 0.6);
      if (rainEl) { if (v > 0.002 && !hidden && rainEl.paused) rainEl.play().catch(() => {}); else if (v <= 0.002 && rainN.gain.value < 0.002 && !rainEl.paused) rainEl.pause(); }
    },
    /** Act 3 per-level ambience bed: audio/ambient/act3/<name>.ogg looped on the SFX (gameplay) bus; null stops it. */
    levelAmb(name, vol = 0.55) {
      if (lvlAmb.name === name) return; lvlAmb.name = name || null;
      if (lvlAmb.el) { const el = lvlAmb.el, g = lvlAmb.g; lvlAmb.el = null; lvlAmb.g = null; if (g && ctx) { g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => { el.pause(); try { g.disconnect(); } catch (e) {} }, 1500); } else el.pause(); }
      if (!name) return;
      const el = withFallback(new Audio(BASE + 'audio/ambient/act3/' + name + '.' + EXT)); el.loop = true; el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.muted = muted; lvlAmb.el = el; lvlAmb.vol = vol;
      if (ctx) { try { const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(sfxOut()); lvlAmb.g = g; g.gain.setTargetAtTime(vol, ctx.currentTime, 0.8); } catch (e) { lvlAmb.g = null; } }
      if (!lvlAmb.g) el.volume = Math.min(1, vol * gainOf('sfx') * gainOf('master'));
      if (!hidden && !muted) el.play().catch(() => {});
    },
    levelAmbInfo: () => ({ name: lvlAmb.name, playing: !!lvlAmb.el && !lvlAmb.el.paused, src: lvlAmb.el ? lvlAmb.el.src : null, bus: lvlAmb.g ? 'sfx' : lvlAmb.el ? 'element' : null, gain: lvlAmb.g ? +lvlAmb.g.gain.value.toFixed(3) : null }),
    /** t31+: recorded one-shot from public/audio/sfx/<cat>/<name>.ogg (Beans, -18 LUFS). Missing file = silent. vol kept modest. */
    sample(name, vol = 0.5, rate = 1) {
      if (!ctx || muted) return;
      let e = samples.get(name);
      if (!e) {
        e = { buf: null }; samples.set(name, e);
        // Act 3 cues are Opus .ogg + AAC .m4a (Beans re-encode); older one-shots are Vorbis .ogg + .m4a. An .ogg that will not decode retries the .m4a once.
        const ext0 = /^(act3|online)\//.test(name) ? EXT : EXT_SFX, url = x => import.meta.env.BASE_URL + 'audio/sfx/' + name + '.' + x;
        const load = x => fetch(url(x)).then(r => r.ok ? r.arrayBuffer() : null).then(a => a && ctx.decodeAudioData(a));
        load(ext0).catch(() => ext0 === 'ogg' ? load('m4a') : null).then(b => { e.buf = b || null; if (b && e.want && ctx.currentTime - e.want < 0.25) api.sample(name, vol, rate); }).catch(() => {});
      }
      if (!e.buf) { e.want = ctx.currentTime; return; }
      const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = e.buf; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g); g.connect(/^ui2?\//.test(name) && bus.ui ? bus.ui : sfxOut()); s.start();
    },
    startLoop: startSfxLoop,
    stopLoop: stopSfxLoop,
    blip(n = 0) { if (!ctx || muted) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(520 * Math.pow(1.0595, (n * 2) % 14), t); o.frequency.exponentialRampToValueAtTime(1100 * Math.pow(1.0595, (n * 2) % 14), t + 0.12); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g).connect(sfxOut()); o.start(t); o.stop(t + 0.3); },
    chime() { if (!ctx || muted) return; [0, 4, 7, 12].forEach((s, i) => { const t = ctx.currentTime + i * 0.11, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 440 * Math.pow(1.0595, s); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(g).connect(sfxOut()); o.start(t); o.stop(t + 0.65); }); },
    sparkle() { if (!ctx || muted) return; [0, 7, 12, 16, 19, 24].forEach((s, i) => { const t = ctx.currentTime + i * 0.07, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 880 * Math.pow(1.0595, s); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g).connect(sfxOut()); o.start(t); o.stop(t + 0.55); }); },
    setReadAloud(on) { readAloud = !!on; if (!readAloud) api.stopVoice(); },
    readAloud: () => readAloud,
    stopVoice() {
      voiceWant = null;
      const el = voiceEl; voiceEl = null;
      if (el) { try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {} }
    },
    /** Play a lines.json id (or a fallback list) on the voice bus. A new line cancels the current one. No-op unless Read-aloud is on. */
    speak(idOrIds) {
      const want = Array.isArray(idOrIds) ? idOrIds.filter(Boolean) : (idOrIds ? [idOrIds] : []);
      if (!readAloud || muted || !want.length) return;
      api.start();
      const token = want[0] + ':' + Math.random().toString(36).slice(2);
      voiceWant = token;
      api.stopVoice();
      voiceWant = token;
      loadVoiceLines().then(() => {
        if (voiceWant !== token) return;
        const id = firstVoiceId(want); if (!id) return;
        const url = voiceUrl(id, EXT); if (!url) return;
        const el = withFallback(new Audio(url));
        el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.muted = muted;
        voiceEl = el;
        if (ctx && bus.voice) {
          try { const src = ctx.createMediaElementSource(el); src.connect(bus.voice); }
          catch (e) { el.volume = Math.min(1, gainOf('voice') * gainOf('master')); }
        } else el.volume = Math.min(1, gainOf('voice') * gainOf('master'));
        el.addEventListener('ended', () => { if (voiceEl === el) { voiceEl = null; if (voiceWant === token) voiceWant = null; } });
        el.play().catch(() => {});
      });
    },
    /** Play lines in order. A new speak() or speakSeq() cancels the chain. */
    speakSeq(steps) {
      const list = (steps || []).map(s => Array.isArray(s) ? s.filter(Boolean) : (s ? [s] : [])).filter(s => s.length);
      if (!readAloud || muted || !list.length) return;
      api.start();
      const token = 'seq:' + Math.random().toString(36).slice(2);
      voiceWant = token;
      api.stopVoice();
      voiceWant = token;
      const playAt = (i) => {
        if (voiceWant !== token) return;
        if (i >= list.length) { if (voiceWant === token) voiceWant = null; return; }
        loadVoiceLines().then(() => {
          if (voiceWant !== token) return;
          const id = firstVoiceId(list[i]);
          if (!id) { playAt(i + 1); return; }
          const url = voiceUrl(id, EXT); if (!url) { playAt(i + 1); return; }
          const el = withFallback(new Audio(url));
          el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.muted = muted;
          voiceEl = el;
          if (ctx && bus.voice) {
            try { const src = ctx.createMediaElementSource(el); src.connect(bus.voice); }
            catch (e) { el.volume = Math.min(1, gainOf('voice') * gainOf('master')); }
          } else el.volume = Math.min(1, gainOf('voice') * gainOf('master'));
          el.addEventListener('ended', () => { if (voiceEl === el) { voiceEl = null; playAt(i + 1); } });
          el.addEventListener('error', () => { if (voiceEl === el) { voiceEl = null; playAt(i + 1); } });
          el.play().catch(() => { if (voiceEl === el) { voiceEl = null; playAt(i + 1); } });
        });
      };
      playAt(0);
    },
    preloadVoice(ids) {
      if (!ids || !ids.length) return;
      loadVoiceLines().then(() => {
        for (const id of ids) {
          const url = voiceUrl(id, EXT); if (!url) continue;
          const el = new Audio(url); el.preload = 'auto';
        }
      });
    },
    debug() {
      const r = x => x == null ? null : +x.toFixed(4);
      return { rainSrc: rainEl ? (rainEl.paused ? 'loop-paused' : 'loop') : rainNoise ? 'noise' : 'none', started, ctxState: ctx && ctx.state, levels: { ...lv }, muted, bus: Object.fromEntries(Object.entries(bus).map(([k, b]) => [k, r(b.gain.value)])), busTarget: Object.fromEntries(Object.keys(bus).map(k => [k, r(gainOf(k))])), rainBase: RAIN_BASE, rainNode: rainN && r(rainN.gain.value), amb: Object.fromEntries(Object.entries(AMB).map(([k, A]) => [k, { loaded: !!A.el, playing: !!A.el && !A.el.paused, gain: A.g ? r(A.g.gain.value) : A.el ? r(A.el.volume) : 0, want: r(ambLevel(k)) }])) };
    },
  };
  document.addEventListener('visibilitychange', () => { if (!started) return; music.hide(document.hidden); hidden = document.hidden; if (hidden) { for (const k in AMB) AMB[k].el && AMB[k].el.pause(); for (const r of sfxLoops.values()) r.el.pause(); rainEl && rainEl.pause(); lvlAmb.el && lvlAmb.el.pause(); voiceEl && voiceEl.pause(); } else if (!muted) { ctx && ctx.resume && ctx.resume(); applyAmb(true); for (const r of sfxLoops.values()) r.el.play().catch(() => {}); lvlAmb.el && lvlAmb.el.play().catch(() => {}); if (voiceEl && voiceEl.paused && voiceWant) voiceEl.play().catch(() => {}); } });
  return api;
}
