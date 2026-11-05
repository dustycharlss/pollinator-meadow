/**
 * perf.js: adaptive quality tiers (low | med | high | ultra) for Pollinator Meadow. No imports; works standalone.
 * Wire in: `import { initPerf } from './perf.js'; const perf = initPerf(renderer, scene, { mobile: isMobile, maxPixelRatio: PR });`
 * then `perf.register(grassMesh, 'foliage')` / `perf.register(points, 'particles')` for anything built at full count,
 * `perf.onTierChange(() => resize())`, and in per-object updates `const d = perf.lodDt(obj, camera.position, dt); if (d) obj.update(d)`.
 * Settings/Admin: `perf.setMode('auto'|'low'|'med'|'high'|'ultra')` (persisted in localStorage 'pm-perf'); read `perf.tier.*` or `perf.foliageMult()` etc.
 */

export const TIER_ORDER = ['low', 'med', 'high', 'ultra'];
export const MODES = ['auto', ...TIER_ORDER];
export const STORAGE_KEY = 'pm-perf';

/**
 * Per-tier settings.
 *  pixelRatio:   cap on renderer pixel ratio (also clamped by devicePixelRatio and opts.maxPixelRatio)
 *  shadows:      renderer.shadowMap.enabled (only touched if opts.manageShadows, see initPerf)
 *  shadowMapSize: mapSize for every castShadow light
 *  foliage:      instanced grass / prop density multiplier (applied to registered 'foliage' meshes)
 *  particles:    particle count multiplier (registered 'particles' meshes/points, or read particleMult())
 *  lod:          [nearDist, midDist, farDist] and steps [near, mid, far, beyond] = update every N frames
 */
export const TIERS = {
  low:   { name: 'low',   pixelRatio: 0.85, shadows: false, shadowMapSize: 512,  foliage: 0.35, particles: 0.35, lodDist: [18, 40, 80], lodSteps: [1, 3, 6, 12] },
  med:   { name: 'med',   pixelRatio: 1.25, shadows: false, shadowMapSize: 1024, foliage: 0.6,  particles: 0.6,  lodDist: [25, 55, 100], lodSteps: [1, 2, 4, 8] },
  high:  { name: 'high',  pixelRatio: 1.75, shadows: true,  shadowMapSize: 1024, foliage: 0.85, particles: 0.85, lodDist: [35, 70, 130], lodSteps: [1, 1, 2, 4] },
  ultra: { name: 'ultra', pixelRatio: 2.0,  shadows: true,  shadowMapSize: 2048, foliage: 1.0,  particles: 1.0,  lodDist: [50, 100, 180], lodSteps: [1, 1, 1, 2] },
};

/** Live view of the active tier (same object for the whole session; fields are overwritten on change). */
export const tier = { ...TIERS.high };

const DEFAULTS = {
  mobile: false,          // pass your isMobile; picks the first auto tier when nothing is saved
  maxPixelRatio: 2,       // hard cap (main.js uses PR = min(dpr, mobile ? 1.75 : 2))
  targetFps: 60,          // display target; thresholds derive from it unless given
  downFps: null,          // step down when rolling avg FPS stays below this (default 0.75 * target)
  upFps: null,            // step up when rolling avg FPS stays at/above this (default 0.93 * target)
  windowMs: 1500,         // rolling window length used for the average
  minFrames: 6,
  maxFrameMs: 1000,       // frames longer than this are clamped; a lone one is ignored as a hitch (raise only for test rigs that run <1 fps)           // ...but never fewer frames than this (so 2 fps devices still get a real average)
  downHoldMs: 2000,       // must be slow this long before stepping down
  upHoldMs: 6000,         // must be fast this long before stepping up (backs off after flaps)
  settleMs: 1200,         // ignore samples right after a tier change (shader warm-up, resize)
  flapWindowMs: 20000,    // a step down within this time after a step up counts as a flap
  maxUpHoldMs: 120000,
  minTier: 'low', maxTier: 'ultra',
  manageShadows: null,    // null = only if renderer.shadowMap.enabled was already true at init
  selfTick: true,         // run an own rAF sampler; set false and call perf.frame(now) from your loop instead
  storage: true,          // persist mode + last auto tier
  initialTier: null,      // force first tier (overrides saved/heuristic)
  paused: false,          // start with auto-detect paused (e.g. during asset loading); call perf.resume() when the game is running
  log: false,
};

const clampI = (i, a, b) => Math.max(a, Math.min(b, i));

/**
 * Create the perf controller. Only one is expected per page; calling again disposes the previous one.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {object} [opts] see DEFAULTS above
 */
let ACTIVE = null;
export function initPerf(renderer, scene, opts = {}) {
  if (ACTIVE) ACTIVE.dispose();
  const o = { ...DEFAULTS, ...opts };
  const downFps = o.downFps ?? o.targetFps * 0.75, upFps = o.upFps ?? o.targetFps * 0.93;
  const minI = TIER_ORDER.indexOf(o.minTier), maxI = TIER_ORDER.indexOf(o.maxTier);
  const manageShadows = o.manageShadows ?? !!(renderer && renderer.shadowMap && renderer.shadowMap.enabled);
  const listeners = new Set();
  const registered = new Map(); // obj -> { kind, base, points }
  const lodState = new WeakMap();
  const history = []; // { t, from, to, reason, fps }

  // ---- persistence
  let saved = {};
  if (o.storage) { try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (e) { saved = {}; } }
  let mode = MODES.includes(saved.mode) ? saved.mode : 'auto';
  const persist = () => { if (!o.storage) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, auto: autoName, t: Date.now() })); } catch (e) {} };

  let autoName = o.initialTier && TIERS[o.initialTier] ? o.initialTier
    : TIERS[saved.auto] ? saved.auto : (o.mobile ? 'med' : 'high');
  autoName = TIER_ORDER[clampI(TIER_ORDER.indexOf(autoName), minI, maxI)];
  let curName = null;

  // ---- sampling state
  const ft = new Float32Array(600); let ftHead = 0, ftLen = 0; // frame times (ms) ring buffer
  let paused = !!o.paused, lastNow = 0, longRun = 0, clockT = 0, frame = 0, settleUntil = 0, slowSince = 0, fastSince = 0, lastUpAt = -1e9, upHold = o.upHoldMs, rafId = 0, fpsAvg = 0;
  const blockedUp = {}; // tierIndex -> earliest time we may step up into it again
  let phaseSeq = 0; const phases = new WeakMap();
  const phaseOf = obj => { let p = phases.get(obj); if (p === undefined) { p = Number.isInteger(obj.id) ? obj.id : phaseSeq++; phases.set(obj, p); } return p; };
  // works for Object3D (.position) or plain sim records with x/y/z (helpers, herd animals)
  const distTo = (obj, c) => { if (!c) return 0; const q = obj.position || obj; const dx = (q.x || 0) - c.x, dy = (q.y ?? c.y) - c.y, dz = (q.z || 0) - c.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); };
  const now = () => clockT || (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function resetSamples(t = now()) { ftHead = ftLen = 0; slowSince = fastSince = 0; settleUntil = t + o.settleMs; lastNow = 0; }

  function apply(name, reason) {
    const prev = curName; const T = TIERS[name]; if (!T) return;
    curName = name; Object.assign(tier, T);
    // pixel ratio
    if (renderer && renderer.setPixelRatio) {
      const dpr = (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1;
      const pr = Math.max(0.5, Math.min(T.pixelRatio, dpr, o.maxPixelRatio));
      tier.appliedPixelRatio = pr;
      if (Math.abs(renderer.getPixelRatio() - pr) > 1e-3) renderer.setPixelRatio(pr); // three re-calls setSize internally
    }
    // shadows
    if (manageShadows && renderer && renderer.shadowMap) {
      const was = renderer.shadowMap.enabled; renderer.shadowMap.enabled = T.shadows;
      scene && scene.traverse(ob => {
        if (ob.isLight && ob.castShadow && ob.shadow) {
          if (ob.shadow.mapSize.x !== T.shadowMapSize) { ob.shadow.mapSize.set(T.shadowMapSize, T.shadowMapSize); if (ob.shadow.map) { ob.shadow.map.dispose(); ob.shadow.map = null; } }
        }
        if (was !== T.shadows && ob.material) for (const m of (Array.isArray(ob.material) ? ob.material : [ob.material])) m.needsUpdate = true;
      });
    }
    for (const [obj, r] of registered) applyDensity(obj, r);
    if (mode === 'auto') autoName = name;
    persist();
    if (prev !== name) {
      const ev = { tier: name, prev, mode, reason, fps: Math.round(fpsAvg * 10) / 10, t: Math.round(now()) };
      history.push(ev); if (history.length > 50) history.shift();
      if (o.log) console.info('[perf]', prev, '->', name, reason, ev.fps + 'fps');
      for (const cb of [...listeners]) { try { cb(tier, ev); } catch (e) { console.warn('[perf] onTierChange listener threw', e); } }
      if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('pm-perf-tier', { detail: ev }));
    }
    resetSamples();
  }

  function multOf(kind) { return kind === 'particles' ? tier.particles : kind === 'foliage' ? tier.foliage : 1; }
  function applyDensity(obj, r) {
    const n = Math.max(r.min, Math.round(r.base * multOf(r.kind)));
    if (r.points) obj.geometry.setDrawRange(0, n); else obj.count = n;
  }

  function step(dir, reason, t) {
    const i = TIER_ORDER.indexOf(curName), j = clampI(i + dir, minI, maxI);
    if (j === i) return false;
    if (dir > 0) lastUpAt = t;
    else if (t - lastUpAt < o.flapWindowMs) { // flap: we just came up and it was too much. Back off.
      upHold = Math.min(o.maxUpHoldMs, upHold * 2); blockedUp[i] = t + upHold * 2;
    }
    apply(TIER_ORDER[j], reason);
    return true;
  }

  /** Feed one frame. Called automatically when selfTick; otherwise call from your loop with the rAF timestamp. */
  function frameFn(t = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    frame++; clockT = t;
    if (!lastNow) { lastNow = t; return; }
    const d = t - lastNow; lastNow = t;
    if (mode !== 'auto' || paused) return;
    if (typeof document !== 'undefined' && document.hidden) { resetSamples(t); return; }
    if (d <= 0) return;
    if (d > o.maxFrameMs) { if (++longRun < 3) return; } else longRun = 0; // a lone hitch (load, GC, alert) isn't representative; repeated ones are
    const dd = Math.min(d, o.maxFrameMs);
    if (t < settleUntil) return;
    ft[ftHead] = dd; ftHead = (ftHead + 1) % ft.length; ftLen = Math.min(ft.length, ftLen + 1);
    // rolling window: newest frames covering windowMs, but at least minFrames (slow devices get a longer window)
    let sum = 0, n = 0;
    while (n < ftLen && (sum < o.windowMs || n < o.minFrames)) { sum += ft[(ftHead - n - 1 + ft.length) % ft.length]; n++; }
    if (n < o.minFrames || sum < o.windowMs * 0.8) return; // not enough data yet
    fpsAvg = (n * 1000) / sum;
    const ci = TIER_ORDER.indexOf(curName);
    if (fpsAvg < downFps) { fastSince = 0; slowSince = slowSince || t; if (t - slowSince >= o.downHoldMs) step(-1, 'auto-down', t); }
    else if (fpsAvg >= upFps) {
      slowSince = 0; fastSince = fastSince || t;
      if (ci < maxI && t - fastSince >= upHold && t >= (blockedUp[ci + 1] || 0)) step(+1, 'auto-up', t);
    } else { slowSince = 0; fastSince = 0; }
  }

  function loop(t) { rafId = requestAnimationFrame(loop); frameFn(t); }
  if (o.selfTick && typeof requestAnimationFrame !== 'undefined') rafId = requestAnimationFrame(loop);
  const onVis = () => resetSamples();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

  const api = {
    tier, TIERS, TIER_ORDER,
    /** 'auto' | 'low' | 'med' | 'high' | 'ultra'. Persisted. Manual picks skip auto-detection. */
    setMode(m) {
      if (!MODES.includes(m)) throw new Error('perf.setMode: bad mode ' + m);
      mode = m; upHold = o.upHoldMs; for (const k in blockedUp) delete blockedUp[k];
      apply(m === 'auto' ? autoName : m, m === 'auto' ? 'mode-auto' : 'manual'); persist();
    },
    getMode: () => mode,
    getTier: () => curName,
    /** Subscribe; returns an unsubscribe fn. cb(tier, { tier, prev, mode, reason, fps, t }). Also fired as window 'pm-perf-tier'. */
    onTierChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    foliageMult: () => tier.foliage,
    particleMult: () => tier.particles,
    pixelRatio: () => (renderer && renderer.getPixelRatio ? renderer.getPixelRatio() : tier.pixelRatio),
    /**
     * Track an InstancedMesh (count) or Points (drawRange) built at full density; perf scales it per tier.
     * kind: 'foliage' | 'particles'. base defaults to the current count. Instances should be in random order (grass is).
     */
    register(obj, kind = 'foliage', { base, min = 1 } = {}) {
      const points = !!obj.isPoints || (!obj.isInstancedMesh && obj.geometry && obj.geometry.drawRange);
      const b = base ?? (obj.isInstancedMesh ? obj.count : points ? (Number.isFinite(obj.geometry.drawRange.count) ? obj.geometry.drawRange.count : (obj.geometry.attributes.position?.count || 0)) : 0);
      const r = { kind, base: b, min, points }; registered.set(obj, r); applyDensity(obj, r);
      return () => { registered.delete(obj); if (points) obj.geometry.setDrawRange(0, b); else obj.count = b; };
    },
    /** Update every N frames for something `distance` away (1 = every frame). */
    lodStep(distance) { const D = tier.lodDist, S = tier.lodSteps; return distance < D[0] ? S[0] : distance < D[1] ? S[1] : distance < D[2] ? S[2] : S[3]; },
    /** true on frames this object should update, given its distance to camPos. obj: Object3D or {x,y,z}. Objects are phase-staggered so they don't all update on the same frame. */
    shouldUpdate(obj, camPos) {
      const s = api.lodStep(distTo(obj, camPos));
      return s <= 1 || ((frame + phaseOf(obj)) % s) === 0;
    },
    /** Like shouldUpdate but accumulates dt: returns the dt to simulate now (sum of skipped frames), or 0 to skip. */
    lodDt(obj, camPos, dt) {
      const acc = (lodState.get(obj) || 0) + dt;
      if (!api.shouldUpdate(obj, camPos)) { lodState.set(obj, Math.min(acc, 0.5)); return 0; }
      lodState.set(obj, 0); return acc;
    },
    /** Suspend / resume auto-detection (loading screens, cutscenes, menus with a frozen scene). Tier stays as is. */
    pause() { paused = true; resetSamples(); },
    resume() { if (paused) { paused = false; resetSamples(); } },
    isPaused: () => paused,
    /** Manual frame feed (when opts.selfTick === false). */
    frame: frameFn,
    /** Debug / Admin readout. */
    stats() {
      let sum = 0; const arr = []; for (let k = 1; k <= Math.min(ftLen, 120); k++) { const v = ft[(ftHead - k + ft.length) % ft.length]; arr.push(v); sum += v; }
      arr.sort((a, b) => a - b);
      return { mode, paused, tier: curName, fps: Math.round(fpsAvg * 10) / 10, avgMs: arr.length ? +(sum / arr.length).toFixed(2) : 0, p90Ms: arr.length ? +arr[Math.floor(arr.length * 0.9)].toFixed(2) : 0,
        pixelRatio: api.pixelRatio(), downFps, upFps, upHoldMs: upHold, frame, registered: registered.size, history: history.slice() };
    },
    dispose() {
      if (rafId && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafId); rafId = 0;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
      listeners.clear(); if (ACTIVE === api) ACTIVE = null;
    },
  };
  apply(mode === 'auto' ? autoName : mode, 'init');
  ACTIVE = api;
  return api;
}

/** The controller made by the last initPerf() call (or null), for modules that can't receive it directly. */
export const getPerf = () => ACTIVE;
