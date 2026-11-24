// Art pass (Nov 14, 2026): Squid's "Golden Hour Pastel" (preset B) applied to the live game, driven by the perf.js auto tiers.
// perf tier -> look (Act 3 art pass / phone-safe STYLE-GUIDE §5):
//   low  = no post, grade baked into lights/sky/fog, CSS vignette, 512 PCF shadows (crew casters only), 12 motes, fog 30–70
//   med  = grade pass only (no bloom), no shadows, 24 motes, fog 30–95
//   high = half-res bloom + grade, 1024 PCFSoft sun shadow, 24 motes, pixel ratio 1.75 (phones cap 1.5), fog 30–95
//   ultra (desktop only) = 2048 map (never 4096), full bloom, MSAA 4, 46 motes, fog 30–95
// Phones never go past 'high'. Day/night, seasons, weather and moody night still come from main.js updateNight();
// tune() blends the day share of that toward preset B every frame.
import * as THREE from 'three';
import { PRESET_B as B, pastelize, createComposerB, cssOverlayB, sunDirectionB, isSoftGl } from './preset-B.js';
import { skipCustomShaders, cullWorldFx, isCaveLevel } from './l20-fallback.js';
import { initPerf } from './perf.js';
import LOOK_L20 from './look-targets/L20-mirror-caves.json';
import LOOK_L21 from './look-targets/L21-storm-orchard.json';
import LOOK_L22 from './look-targets/L22-thaw-valley.json';
import LOOK_L23 from './look-targets/L23-grand-garden.json';
import LOOK_L24 from './look-targets/L24-starheart-summit.json';

const LOOK_BY_KEY = Object.fromEntries([LOOK_L20, LOOK_L21, LOOK_L22, LOOK_L23, LOOK_L24].map(v => [v.recipeKey, v]));
function deepMerge(a, b) {
  if (!b) return a;
  const o = Array.isArray(a) ? a.slice() : { ...a };
  for (const k of Object.keys(b)) {
    const v = b[k], cur = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)) o[k] = deepMerge(cur, v);
    else o[k] = v;
  }
  return o;
}
const STATE_KEY = { A: 'A_winter_night', B: 'B_spring_day', C: 'C_summer_dusk' };
function statePreset(look, letter) {
  const base = deepMerge(structuredClone(B), look.presetB_override || {});
  if (!letter || letter === 'A' || !look.extras?.states) return base;
  const d = look.extras.states[STATE_KEY[letter]];
  if (!d || typeof d !== 'object') return base;
  const over = {};
  if (d.sky) over.palette = { ...(base.palette || {}), sky: d.sky };
  if (d.sun) over.sun = { ...base.sun, ...d.sun };
  if (d.hemi) over.hemi = { ...base.hemi, ...d.hemi };
  if (d.fog) over.fog = { ...base.fog, ...d.fog };
  if (d.exposure != null) over.exposure = d.exposure;
  return deepMerge(base, over);
}
function lerpPreset(a, b, t) {
  const out = structuredClone(b), L = (x, y) => x + (y - x) * t, C = (x, y) => { const c = new THREE.Color(x).lerp(new THREE.Color(y), t); return '#' + c.getHexString(); };
  out.sun = { ...b.sun, color: C(a.sun.color, b.sun.color), intensity: L(a.sun.intensity, b.sun.intensity), elevationDeg: L(a.sun.elevationDeg ?? 17, b.sun.elevationDeg ?? 17), azimuthDeg: L(a.sun.azimuthDeg ?? 72, b.sun.azimuthDeg ?? 72) };
  out.hemi = { sky: C(a.hemi.sky, b.hemi.sky), ground: C(a.hemi.ground, b.hemi.ground), intensity: L(a.hemi.intensity, b.hemi.intensity) };
  out.fog = { color: C(a.fog.color, b.fog.color), near: L(a.fog.near, b.fog.near), far: L(a.fog.far, b.fog.far) };
  out.exposure = L(a.exposure, b.exposure);
  if (a.palette?.sky && b.palette?.sky) out.palette = { ...b.palette, sky: { zenith: C(a.palette.sky.zenith, b.palette.sky.zenith), mid: C(a.palette.sky.mid, b.palette.sky.mid), horizon: C(a.palette.sky.horizon, b.palette.sky.horizon) } };
  if (a.skyGlow && b.skyGlow) out.skyGlow = { ...b.skyGlow, wide: L(a.skyGlow.wide, b.skyGlow.wide), core: L(a.skyGlow.core, b.skyGlow.core), widePower: L(a.skyGlow.widePower, b.skyGlow.widePower), corePower: L(a.skyGlow.corePower, b.skyGlow.corePower) };
  if (a.grade && b.grade) out.grade = { ...b.grade, haze: L(a.grade.haze ?? 0, b.grade.haze ?? 0), hazeColor: C(a.grade.hazeColor, b.grade.hazeColor) };
  return out;
}

const C = h => new THREE.Color(h);
const QMAP = { low: 'low', med: 'medium', high: 'medium', ultra: 'high' }; // phone High = Medium column (look-targets); LOOKS.high is still the phone-safe half-res / 1024 / 24-mote row
const LOOKS = {
  low:   { post: false, bloom: false, bloomScale: 0, grade: false, msaa: 0, shadow: 512, motes: 12, fogFar: 70, vignette: true, bake: true },
  med:   { post: true, bloom: false, bloomScale: 0, grade: true, msaa: 0, shadow: 0, motes: 24, fogFar: 95 },
  high:  { post: true, bloom: true, bloomScale: 0.5, grade: true, msaa: 0, shadow: 1024, motes: 24, fogFar: 95 },
  ultra: { post: true, bloom: true, bloomScale: 1, grade: true, msaa: 4, shadow: 2048, motes: 46, fogFar: 95 },
};
const SUN_B = new THREE.Vector3(...B.sun.worldDir).normalize();

/** Device classifier for the first tier (perf audit §7.2). Lowest matching rule wins. */
export function classifyDevice(renderer, isMobile) {
  const nav = typeof navigator !== 'undefined' ? navigator : {}, mem = nav.deviceMemory, cores = nav.hardwareConcurrency || 8, con = nav.connection || {};
  let gpu = '';
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''); } catch (e) {}
  if (/SwiftShader|llvmpipe|Mali-G(31|51|52)|Adreno \(TM\) (3|4|5)\d\d|Adreno (3|4|5)\d\d|Intel\(R\) HD/i.test(gpu)) return 'low';
  if (con.saveData || /2g/.test(con.effectiveType || '')) return 'low';
  if (isMobile && (mem === undefined ? false : mem <= 2)) return 'low';
  if (isMobile && cores <= 4) return 'low';
  if (isMobile) { if (/Apple GPU|Adreno.*7\d\d|Mali-G(7[89]|[89]\d|7\d\d)/i.test(gpu) && (mem === undefined || mem >= 6)) return 'high'; return 'med'; }
  return mem !== undefined && mem < 8 ? 'high' : 'high'; // desktop starts at high and may earn ultra
}

export function createLook({ renderer, scene, camera, hemi, sun, isMobile, getPlayer }) {
  // ---- perf tiers (perf.js was written but never wired; now it is) ----
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('pm-perf') || '{}') || {}; } catch (e) {}
  const urlQ = (() => { try { return new URLSearchParams(location.search).get('q'); } catch (e) { return null; } })();
  const perf = initPerf(renderer, scene, {
    mobile: isMobile, maxPixelRatio: isMobile ? 1.5 : 2, maxTier: isMobile ? 'high' : 'ultra', manageShadows: false, selfTick: false, paused: true,
    targetFps: 60, downFps: 42, upFps: 55, initialTier: saved.auto ? null : classifyDevice(renderer, isMobile),
  });
  if (urlQ && ['auto', 'low', 'med', 'high', 'ultra'].includes(urlQ)) try { perf.setMode(isMobile && urlQ === 'ultra' ? 'high' : urlQ); } catch (e) {}
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = B.exposure; renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.background = null;

  // ---- sky dome (preset B gradient + sun glow, blended to night) ----
  const g = B.skyGlow;
  const skyU = { top: { value: C(B.palette.sky.zenith) }, mid: { value: C(B.palette.sky.mid) }, hor: { value: C(B.palette.sky.horizon) }, sunDir: { value: SUN_B.clone() }, sunC: { value: C(B.sun.color) },
    nTop: { value: C('#070c26') }, nHor: { value: C('#1d2a58') }, night: { value: 0 }, grey: { value: 0 }, greyC: { value: C('#b9c2cc') }, tint: { value: C('#ffffff') }, hazeC: { value: C(B.grade.hazeColor) }, haze: { value: 0 },
    glowWide: { value: g.wide }, glowCore: { value: g.core }, glowWidePow: { value: g.widePower }, glowCorePow: { value: g.corePower } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, mid, hor, sunDir, sunC, nTop, nHor, greyC, tint, hazeC; uniform float night, grey, haze, glowWide, glowCore, glowWidePow, glowCorePow; varying vec3 vW;
      void main(){ float y = clamp(vW.y, -0.2, 1.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.6, y));
        float s = max(dot(normalize(vW), sunDir), 0.0); c += sunC * (pow(s, glowWidePow) * glowWide + pow(s, glowCorePow) * glowCore) * (1.0 - night);
        c = c * tint; c = mix(c, hazeC, haze);
        vec3 n = mix(nHor, nTop, smoothstep(0.0, 0.5, y)); c = mix(c, n, night); c = mix(c, greyC * (1.0 - 0.8 * night), grey * 0.6);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  sky.name = 'presetB-sky'; sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  scene.add(sun.target);

  // ---- pollen motes: one InstancedMesh, wrapped around the player so they are always nearby ----
  const MAXM = 46, pp = B.pollen, mo = pp.motion;
  const moteGeo = new THREE.SphereGeometry(pp.radius, 8, 6), moteMat = new THREE.MeshBasicMaterial({ color: C(pp.color).multiplyScalar(pp.hdrBoost), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  const motes = new THREE.InstancedMesh(moteGeo, moteMat, MAXM); motes.name = 'presetB-pollen'; motes.frustumCulled = false; motes.renderOrder = 6; scene.add(motes);
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const MB = []; for (let i = 0; i < MAXM; i++) MB.push({ x: (rnd() - 0.5) * 18, z: (rnd() - 0.5) * 18, y: pp.heightMin + rnd() * (pp.heightMax - pp.heightMin), ph: rnd() * 6.28, bob: mo.bobHz[0] + rnd() * (mo.bobHz[1] - mo.bobHz[0]), sw: mo.swirlHz[0] + rnd() * (mo.swirlHz[1] - mo.swirlHz[0]) });
  const ZERO3 = new THREE.Vector3(0, 0, 0), M4 = new THREE.Matrix4(), wrap = (v, c, h) => c + ((((v - c) % (2 * h)) + 3 * h) % (2 * h)) - h;
  function updateMotes(t, heightAt) {
    const p = getPlayer && getPlayer(); if (!p) return; let n = 0;
    for (let i = 0; i < motes.count; i++) { const b = MB[i];
      const x = wrap(b.x + Math.cos(t * b.sw * 6.283 + b.ph) * mo.swirlRadius, p.x, 9), z = wrap(b.z + Math.sin(t * b.sw * 6.283 + b.ph) * mo.swirlRadius, p.z, 9);
      const dx = x - p.x, dz = z - p.z, near = dx * dx + dz * dz < 2.6 * 2.6; // keep the glow off the animals' faces (STYLE-GUIDE §3)
      const h = pp.heightMin + ((b.y - pp.heightMin + mo.riseSpeed * t) % (mo.wrapHeight - pp.heightMin));
      const gy = heightAt ? heightAt(x, z) : p.y; M4.makeTranslation(x, gy + h + Math.sin(t * b.bob * 6.283 + b.ph) * mo.bobAmp, z); if (near) M4.scale(ZERO3);
      motes.setMatrixAt(i, M4); n++; }
    motes.instanceMatrix.needsUpdate = true;
  }

  // ---- CSS vignette (low tier: no GPU pass) ----
  const vig = document.createElement('div'); vig.id = 'vigB'; vig.style.cssText = cssOverlayB().replace('position:absolute', 'position:fixed') + ';z-index:0;display:none';
  const cv = renderer.domElement; cv.parentNode && cv.parentNode.insertBefore(vig, cv.nextSibling);

  // ---- composer + shadows per tier ----
  let L = LOOKS.med, tierName = null, composer = null, bloomPass = null, gradePass = null;
  let postLockedOff = false;
  function disablePost() {
    postLockedOff = true;
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; bloomPass = null; gradePass = null; }
  }
  function buildComposer() {
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; bloomPass = null; gradePass = null; }
    if (postLockedOff || !L.post) return;
    const fx = { quality: { bloom: L.bloom, bloomScale: L.bloomScale || 0.5, grade: L.grade, msaa: L.msaa }, softGl: isSoftGl(renderer) };
    composer = createComposerB(renderer, scene, camera, fx, Pnow || B);
    bloomPass = composer && composer.passes.find(p => p.name === 'presetB-bloom');
    gradePass = composer && composer.passes.find(p => p.name === 'presetB-grade');
    if (bloomPass && L.bloomScale < 1) { const s0 = bloomPass.setSize.bind(bloomPass), k = L.bloomScale; bloomPass.setSize = (w, h) => s0(Math.max(64, w * k), Math.max(64, h * k)); }
    applyLookGrade();
    resize();
  }
  function applyTier(name) {
    tierName = name; L = LOOKS[name] || LOOKS.med;
    vig.style.display = L.vignette ? 'block' : 'none';
    motes.count = L.motes;
    const sh = L.shadow > 0 && !(tierName === 'low' && isCaveLevel());
    renderer.shadowMap.enabled = sh; renderer.shadowMap.type = THREE.PCFShadowMap; sun.castShadow = sh;
    if (sh) { const S = B.shadow, sc = sun.shadow.camera; Object.assign(sc, S.camera); sc.updateProjectionMatrix(); sun.shadow.bias = S.bias; sun.shadow.normalBias = S.normalBias; sun.shadow.radius = S.radius;
      if (sun.shadow.mapSize.x !== L.shadow) { sun.shadow.mapSize.set(L.shadow, L.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } }
    scene.traverse(o => { if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) m.needsUpdate = true; });
    refreshShadowFlags(scene);
    buildComposer();
    applyLookBloom();
    applyLookGrade();
  }
  function resize() {
    if (!composer) return; const sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr); composer.setSize(sz.x, sz.y);
  }

  // ---- per-material pastel lift (props 1, animals 0.5, level terrain 0.8; water / glow / UI sprites skipped) ----
  const OK = m => m && (m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshBasicMaterial) && !(m.transparent && m.opacity < 0.97) && m.blending === THREE.NormalBlending && !m.userData.noPastel;
  function styleMat(m, s) {
    if (skipCustomShaders()) return;
    if (!OK(m) || m.userData.presetB) return;
    const pk = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; pastelize(m, s); const nk = m.customProgramCacheKey();
    m.customProgramCacheKey = () => pk + '|' + nk;
    if (m.isMeshStandardMaterial) { m.roughness = Math.max(m.roughness, B.materialAdjust.roughness); m.metalness = 0; }
  }
  function walk(o, s, shadows) {
    if (o.userData.noPastel || o.isSprite || o.isPoints || o.name === 'presetB-sky' || o.name === 'presetB-pollen') return;
    if (o.userData.isAnimal) s = Math.min(s, B.materialAdjust.animalStrength);
    if (o.userData.pastel != null) s = Math.min(s, o.userData.pastel); // playable crew: barely lifted so the bee keeps its stripes
    if (o.userData.terrain) s = 0; // STYLE-GUIDE: terrain and water get no lift (level terrain is authored in B grass tones)
    if (o.isMesh && o.material) { if (s > 0) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) styleMat(m, s);
      if (shadows) { const solid = OK(Array.isArray(o.material) ? o.material[0] : o.material); o.receiveShadow = solid; o.castShadow = solid && canCastShadow(o); } }
    for (const c of o.children) walk(c, s, shadows);
  }
  /** Style everything currently visible (call after a level or skin is built; cheap when nothing is new). */
  function styleScene(root = scene) { for (const c of root.children) if (c.visible && c.layers.isEnabled(0)) walk(c, 1, true); }

  // ---- per-level look targets (values/<id>.json). Global High/Low presets stay as written above. ----
  let patchLook = null, Pnow = B, masterLetter = null, lerpFromP = null, lerpToP = null, lerpU = 1, lastTuneT = 0;
  const fills = [];
  const tc = new THREE.Color(), dirB = SUN_B.clone(), dirO = new THREE.Vector3(), LT = C(B.quality.low.bakeGrade.lightTint), ST = C(B.quality.low.bakeGrade.skyTint), HZ = C(B.grade.hazeColor);
  const cHS = C(B.hemi.sky), cHG = C(B.hemi.ground), cSun = C(B.sun.color), cFog = C(B.fog.color);
  const qBucket = () => QMAP[tierName] || 'medium';
  function canCastShadow(o) {
    if (!o || o.userData.terrain || o.isInstancedMesh || o.userData.noCast) return false;
    // Low: no casters. High/med in a cave: only the playable crew / animals — static cave/prop meshes are merged and noCast.
    if (tierName === 'low') return false;
    if (isCaveLevel()) return !!o.userData.isAnimal;
    return true;
  }
  function refreshShadowFlags(root = scene) {
    root.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      const solid = OK(Array.isArray(o.material) ? o.material[0] : o.material);
      o.receiveShadow = !!solid;
      o.castShadow = !!solid && canCastShadow(o);
    });
  }
  function applyLookGrade() {
    if (!gradePass || !gradePass.uniforms) return;
    const g = (Pnow && Pnow.grade) || B.grade, u = gradePass.uniforms;
    if (u.sat && g.saturation != null) u.sat.value = g.saturation;
    if (u.contrast && g.contrast != null) u.contrast.value = g.contrast;
    if (u.bright) u.bright.value = g.brightness || 0;
    if (u.lift) u.lift.value.set(g.lift);
    if (u.gain) u.gain.value.set(g.gain);
    if (u.vignette && g.vignette != null) u.vignette.value = g.vignette;
    if (u.vigColor) u.vigColor.value.set(g.vignetteColor);
    if (u.haze && g.haze != null) u.haze.value = g.haze;
    if (u.hazeColor) u.hazeColor.value.set(g.hazeColor);
  }
  function applyLookBloom() {
    if (!bloomPass) return;
    const bq = patchLook && patchLook.bloom_per_quality && patchLook.bloom_per_quality[qBucket()];
    if (bq && bq.enabled !== false) { bloomPass.strength = bq.strength; bloomPass.radius = bq.radius; bloomPass.threshold = bq.threshold; }
    else { bloomPass.strength = B.bloom.strength; bloomPass.radius = B.bloom.radius; bloomPass.threshold = B.bloom.threshold; }
  }
  function adoptP(P) {
    Pnow = P;
    cHS.set(P.hemi.sky); cHG.set(P.hemi.ground); cSun.set(P.sun.color); cFog.set(P.fog.color);
    renderer.toneMappingExposure = P.exposure;
    skyU.top.value.set(P.palette.sky.zenith); skyU.mid.value.set(P.palette.sky.mid); skyU.hor.value.set(P.palette.sky.horizon);
    skyU.sunC.value.set(P.sun.color); skyU.hazeC.value.set(P.grade.hazeColor);
    const sg = P.skyGlow || B.skyGlow;
    skyU.glowWide.value = sg.wide; skyU.glowCore.value = sg.core; skyU.glowWidePow.value = sg.widePower; skyU.glowCorePow.value = sg.corePower;
    const bake = (P.quality && P.quality.low && P.quality.low.bakeGrade) || B.quality.low.bakeGrade;
    LT.set(bake.lightTint); ST.set(bake.skyTint); HZ.set(P.grade.hazeColor);
    applyLookBloom();
    applyLookGrade();
  }
  function clearFills() { for (const f of fills) { f.light.removeFromParent(); } fills.length = 0; }
  function setupFills(look, opts = {}) {
    clearFills();
    if (!look || !look.extras || !look.extras.fills) return;
    for (const spec of look.extras.fills) {
      // Skip note-only fills ({ name: 'none' } / shaftKey): no colour, no intensity. Making a light from them
      // gave a PointLight with intensity undefined → NaN in every lit shader → all lit geometry black.
      if (spec.type && !/PointLight/i.test(String(spec.type))) continue;
      if (spec.color == null || !Number.isFinite(spec.intensity)) continue;
      const l = new THREE.PointLight(spec.color, 0, spec.distance, spec.decay == null ? 2 : spec.decay);
      l.castShadow = false; l.name = 'look-fill-' + spec.name; scene.add(l);
      const at = opts.fills && opts.fills[spec.name]; if (at) l.position.set(at.x, at.y, at.z);
      fills.push({ spec, light: l, follow: /active crew/.test(spec.follow || '') });
    }
  }
  function fillOn(spec, letter) {
    const q = qBucket();
    if (spec.quality && !spec.quality.includes(q) && !(q === 'high' && spec.quality.includes('high'))) return false;
    if (spec.states && letter && !spec.states.includes(letter)) {
      // L22/L24: crewFill is listed for A; state C uses a dimmer fill described in extras.states
      if (spec.name === 'crewFill' && letter === 'C') return true;
      return false;
    }
    return true;
  }
  function fillIntensity(spec, letter) {
    if (!fillOn(spec, letter)) return 0;
    if (spec.name === 'crewFill' && letter === 'C') return 3;
    return Number.isFinite(spec.intensity) ? spec.intensity : 0;
  }
  /** Apply (or clear) a level look-target. id is the recipe key (thaw_valley, …). */
  function setPatch(id, opts = {}) {
    patchLook = (id && LOOK_BY_KEY[id]) || null;
    masterLetter = opts.state || null;
    lerpU = 1; lerpFromP = lerpToP = null;
    adoptP(patchLook ? statePreset(patchLook, masterLetter) : B);
    setupFills(patchLook, opts);
  }
  /** Lerp Master Bell A/B/C look over 1.2 s (snap on init). */
  function setMaster(letter, opts = {}) {
    if (!patchLook) return;
    const dest = statePreset(patchLook, letter);
    masterLetter = letter;
    if (opts.snap) { lerpU = 1; lerpFromP = lerpToP = null; adoptP(dest); return; }
    lerpFromP = Pnow; lerpToP = dest; lerpU = 0;
  }
  function tickLookLerp(t) {
    if (!lerpToP || lerpU >= 1) return;
    const dt = lastTuneT ? Math.max(0, Math.min(0.1, t - lastTuneT)) : 0;
    lerpU = Math.min(1, lerpU + dt / 1.2);
    adoptP(lerpPreset(lerpFromP, lerpToP, lerpU));
    if (lerpU >= 1) { lerpFromP = lerpToP = null; }
  }

  // ---- per-frame: blend the day share of the live lighting toward preset B (or the active look target) ----
  function tune({ n = 0, md = 0, grey = 0, mist = 0, t = 0, heightAt } = {}) {
    tickLookLerp(t); lastTuneT = t;
    const P = Pnow, owned = !!patchLook;
    const wantSh = L.shadow > 0 && !(tierName === 'low' && isCaveLevel());
    if (renderer.shadowMap.enabled !== wantSh) { renderer.shadowMap.enabled = wantSh; sun.castShadow = wantSh; refreshShadowFlags(scene); }
    const k = owned ? 1 : Math.max(0, (1 - n) * (1 - md) * (1 - 0.6 * grey) * (1 - 0.5 * mist)), lerp = THREE.MathUtils.lerp;
    hemi.color.lerp(cHS, k); hemi.groundColor.lerp(cHG, k); hemi.intensity = lerp(hemi.intensity, P.hemi.intensity, k);
    sun.color.lerp(cSun, k); sun.intensity = lerp(sun.intensity, P.sun.intensity, k);
    const fogFar = (tierName === 'low' && P.quality && P.quality.low && P.quality.low.fogFar) ? P.quality.low.fogFar : (owned && P.fog && P.fog.far) ? P.fog.far : L.fogFar;
    const fogNear = owned && P.fog ? P.fog.near : B.fog.near;
    scene.fog.color.lerp(cFog, k); scene.fog.near = lerp(scene.fog.near, fogNear, k); scene.fog.far = lerp(scene.fog.far, fogFar, k);
    if (L.bake && !owned) { sun.color.lerp(tc.copy(sun.color).multiply(LT), k); hemi.color.lerp(tc.copy(hemi.color).multiply(LT), k); hemi.groundColor.lerp(tc.copy(hemi.groundColor).multiply(LT), k); scene.fog.color.lerp(HZ, ((P.quality && P.quality.low && P.quality.low.bakeGrade && P.quality.low.bakeGrade.hazeMix) || B.quality.low.bakeGrade.hazeMix) * k); }
    // sun: day direction from preset B (low, raking), night keeps the moon key from main.js — unless a look target owns the key (L22 A moon, L24 dusk)
    dirB.lerp(sunDirectionB(camera, P), 0.06).normalize(); dirO.copy(sun.position).normalize().lerp(dirB, k).normalize();
    const p = getPlayer && getPlayer(), tg = sun.target.position; if (p) tg.set(p.x, p.y, p.z); else tg.set(0, 0, 0);
    sun.position.copy(tg).addScaledVector(dirO, P.sun.distance || B.sun.distance);
    skyU.sunDir.value.copy(dirO); skyU.sunC.value.copy(sun.color);
    skyU.night.value = owned ? 0 : Math.min(1, Math.max(n, md)); // look-target skies already encode night/dusk
    skyU.grey.value = owned ? 0 : Math.max(grey, mist * 0.8);
    skyU.tint.value.set(1, 1, 1).lerp(ST, L.bake ? 1 : 0); skyU.haze.value = L.bake ? ((P.quality && P.quality.low && P.quality.low.bakeGrade && P.quality.low.bakeGrade.hazeMix) || B.quality.low.bakeGrade.hazeMix) : (owned ? (P.grade.haze || 0) : 0);
    sky.position.copy(camera.position);
    for (const f of fills) {
      f.light.intensity = fillIntensity(f.spec, masterLetter);
      if (f.follow && p) f.light.position.set(p.x, p.y + 2.2, p.z + 1.6);
    }
    motes.visible = !cullWorldFx() && k > 0.25 && motes.count > 0; moteMat.opacity = 0.9 * Math.min(1, k * 1.5); if (motes.visible) updateMotes(t, heightAt);
    if (owned && P.exposure != null) renderer.toneMappingExposure = P.exposure;
  }
  renderer.info.autoReset = false; // count every pass of a frame (composer + shadow), reset once per frame below
  // Safety net: a light with a non-finite intensity/colour turns every lit pixel NaN (black on most GPUs). Check now and
  // then and zero it, with one console warning, instead of letting the whole level go black.
  let lightChk = 0; const warnedL = new Set();
  function guardLights() {
    scene.traverse(o => { if (!o.isLight) return; const c = o.color;
      if (!Number.isFinite(o.intensity) || (c && !(Number.isFinite(c.r) && Number.isFinite(c.g) && Number.isFinite(c.b)))) {
        if (!warnedL.has(o.uuid)) { warnedL.add(o.uuid); console.warn('look: non-finite light zeroed', o.type, o.name); }
        o.intensity = 0; if (c && !Number.isFinite(c.r + c.g + c.b)) c.setRGB(1, 1, 1);
      } });
  }
  function render() { if ((lightChk++ % 30) === 0) guardLights(); renderer.info.reset(); if (composer) composer.render(); else renderer.render(scene, camera); }
  /** 3 s boot probe after load (audit §7.3): step down once at once if the start tier is clearly too heavy. */
  let probeT0 = 0;
  function frame(now) {
    perf.frame(now);
    if (probeT0 && now - probeT0 > 3000) { probeT0 = 0; const s = perf.stats(); if (perf.getMode() === 'auto' && s.avgMs && (s.avgMs > 25 || s.p90Ms > 33)) perf.stepDown('boot-probe'); }
  }
  function start() { perf.resume(); probeT0 = performance.now(); }
  function status() { const s = perf.stats(); return { ...s, look: tierName, preset: QMAP[tierName], post: !!composer, shadows: renderer.shadowMap.enabled, motes: motes.count }; }
  // Tier is applied last: applyLookBloom reads patchLook/qBucket declared above (TDZ crash on High/Ultra otherwise).
  perf.onTierChange(t => applyTier(t.name));
  applyTier(perf.getTier());
  return { perf, tune, render, frame, start, resize, styleScene, status, setPatch, setMaster, disablePost, sky, motes, get tier() { return tierName; }, get look() { return L; }, get patch() { return patchLook && patchLook.recipeKey; } };
}
