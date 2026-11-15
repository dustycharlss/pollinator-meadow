// Art pass (Nov 14, 2026): Squid's "Golden Hour Pastel" (preset B) applied to the live game, driven by the perf.js auto tiers.
// perf tier -> look:   low  = preset 'low'  (no post, grade baked into lights/sky/fog, CSS vignette, no shadows, 12 motes)
//                      med  = preset 'medium' minus bloom (grade pass only), no shadows, 24 motes
//                      high = preset 'medium' (half-res bloom + grade), 1024 PCFSoft sun shadow, 24 motes (46 on desktop)
//                      ultra (desktop only) = preset 'high' but a 2048 map (never 4096), full bloom, MSAA 4, 46 motes
// Phones never go past 'high' (pixel ratio capped at 1.5, med 1.25, low 1.0). Day/night, seasons, weather and the moody
// Owl Wood night still come from main.js updateNight(); tune() blends the day share of that toward preset B every frame.
import * as THREE from 'three';
import { PRESET_B as B, pastelize, createComposerB, cssOverlayB, sunDirectionB } from './preset-B.js';
import { initPerf } from './perf.js';

const C = h => new THREE.Color(h);
const QMAP = { low: 'low', med: 'medium', high: 'medium', ultra: 'high' };
const LOOKS = {
  low:   { post: false, bloom: false, bloomScale: 0, grade: false, msaa: 0, shadow: 0, motes: 12, fogFar: 100, vignette: true, bake: true },
  med:   { post: true, bloom: false, bloomScale: 0, grade: true, msaa: 0, shadow: 0, motes: 24, fogFar: 110 },
  high:  { post: true, bloom: true, bloomScale: 0.5, grade: true, msaa: 0, shadow: 1024, motes: 24, fogFar: 120 },
  ultra: { post: true, bloom: true, bloomScale: 1, grade: true, msaa: 4, shadow: 2048, motes: 46, fogFar: 130 },
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
    nTop: { value: C('#070c26') }, nHor: { value: C('#1d2a58') }, night: { value: 0 }, grey: { value: 0 }, greyC: { value: C('#b9c2cc') }, tint: { value: C('#ffffff') }, hazeC: { value: C(B.grade.hazeColor) }, haze: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, mid, hor, sunDir, sunC, nTop, nHor, greyC, tint, hazeC; uniform float night, grey, haze; varying vec3 vW;
      void main(){ float y = clamp(vW.y, -0.2, 1.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.6, y));
        float s = max(dot(normalize(vW), sunDir), 0.0); c += sunC * (pow(s, ${g.widePower.toFixed(1)}) * ${g.wide} + pow(s, ${g.corePower.toFixed(1)}) * ${g.core}) * (1.0 - night);
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
  let L = LOOKS.med, tierName = null, composer = null, bloomPass = null;
  function buildComposer() {
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; }
    if (!L.post) return;
    const fx = { quality: { bloom: L.bloom, bloomScale: L.bloomScale || 0.5, grade: L.grade, msaa: L.msaa } };
    composer = createComposerB(renderer, scene, camera, fx);
    bloomPass = composer && composer.passes.find(p => p.name === 'presetB-bloom');
    if (bloomPass && L.bloomScale < 1) { const s0 = bloomPass.setSize.bind(bloomPass), k = L.bloomScale; bloomPass.setSize = (w, h) => s0(Math.max(64, w * k), Math.max(64, h * k)); }
    resize();
  }
  function applyTier(name) {
    tierName = name; L = LOOKS[name] || LOOKS.med;
    vig.style.display = L.vignette ? 'block' : 'none';
    motes.count = L.motes;
    const sh = L.shadow > 0; renderer.shadowMap.enabled = sh; renderer.shadowMap.type = THREE.PCFSoftShadowMap; sun.castShadow = sh;
    if (sh) { const S = B.shadow, sc = sun.shadow.camera; Object.assign(sc, S.camera); sc.updateProjectionMatrix(); sun.shadow.bias = S.bias; sun.shadow.normalBias = S.normalBias; sun.shadow.radius = S.radius;
      if (sun.shadow.mapSize.x !== L.shadow) { sun.shadow.mapSize.set(L.shadow, L.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } }
    scene.traverse(o => { if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) m.needsUpdate = true; });
    buildComposer();
  }
  function resize() {
    if (!composer) return; const sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr); composer.setSize(sz.x, sz.y);
  }
  perf.onTierChange(t => applyTier(t.name));
  applyTier(perf.getTier());

  // ---- per-material pastel lift (props 1, animals 0.5, level terrain 0.8; water / glow / UI sprites skipped) ----
  const OK = m => m && (m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshBasicMaterial) && !(m.transparent && m.opacity < 0.97) && m.blending === THREE.NormalBlending && !m.userData.noPastel;
  function styleMat(m, s) {
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
      if (shadows && !o.userData._sh) { o.userData._sh = 1; const solid = OK(Array.isArray(o.material) ? o.material[0] : o.material); o.receiveShadow = solid; o.castShadow = solid && !o.userData.terrain && !o.isInstancedMesh; } }
    for (const c of o.children) walk(c, s, shadows);
  }
  /** Style everything currently visible (call after a level or skin is built; cheap when nothing is new). */
  function styleScene(root = scene) { for (const c of root.children) if (c.visible && c.layers.isEnabled(0)) walk(c, 1, true); }

  // ---- per-frame: blend the day share of the live lighting toward preset B ----
  const tc = new THREE.Color(), dirB = SUN_B.clone(), dirO = new THREE.Vector3(), LT = C(B.quality.low.bakeGrade.lightTint), ST = C(B.quality.low.bakeGrade.skyTint), HZ = C(B.grade.hazeColor);
  const cHS = C(B.hemi.sky), cHG = C(B.hemi.ground), cSun = C(B.sun.color), cFog = C(B.fog.color);
  function tune({ n = 0, md = 0, grey = 0, mist = 0, t = 0, heightAt } = {}) {
    const k = Math.max(0, (1 - n) * (1 - md) * (1 - 0.6 * grey) * (1 - 0.5 * mist)), lerp = THREE.MathUtils.lerp;
    hemi.color.lerp(cHS, k); hemi.groundColor.lerp(cHG, k); hemi.intensity = lerp(hemi.intensity, B.hemi.intensity, k);
    sun.color.lerp(cSun, k); sun.intensity = lerp(sun.intensity, B.sun.intensity, k);
    scene.fog.color.lerp(cFog, k); scene.fog.near = lerp(scene.fog.near, B.fog.near + 8, k); scene.fog.far = lerp(scene.fog.far, L.fogFar, k);
    if (L.bake) { sun.color.lerp(tc.copy(sun.color).multiply(LT), k); hemi.color.lerp(tc.copy(hemi.color).multiply(LT), k); hemi.groundColor.lerp(tc.copy(hemi.groundColor).multiply(LT), k); scene.fog.color.lerp(HZ, B.quality.low.bakeGrade.hazeMix * k); }
    // sun: day direction from preset B (low, raking), night keeps the moon key from main.js
    // preset B's sun is camera-relative (az 72 deg = from screen-right, el 17 deg); eased so a camera swing doesn't snap the light
    dirB.lerp(sunDirectionB(camera), 0.06).normalize(); dirO.copy(sun.position).normalize().lerp(dirB, k).normalize();
    const p = getPlayer && getPlayer(), tg = sun.target.position; if (p) tg.set(p.x, p.y, p.z); else tg.set(0, 0, 0);
    sun.position.copy(tg).addScaledVector(dirO, B.sun.distance);
    skyU.sunDir.value.copy(dirO); skyU.night.value = Math.min(1, Math.max(n, md)); skyU.grey.value = Math.max(grey, mist * 0.8);
    skyU.tint.value.set(1, 1, 1).lerp(ST, L.bake ? 1 : 0); skyU.haze.value = L.bake ? B.quality.low.bakeGrade.hazeMix : 0;
    sky.position.copy(camera.position);
    motes.visible = k > 0.25 && motes.count > 0; moteMat.opacity = 0.9 * Math.min(1, k * 1.5); if (motes.visible) updateMotes(t, heightAt);
  }
  renderer.info.autoReset = false; // count every pass of a frame (composer + shadow), reset once per frame below
  function render() { renderer.info.reset(); if (composer) composer.render(); else renderer.render(scene, camera); }
  /** 3 s boot probe after load (audit §7.3): step down once at once if the start tier is clearly too heavy. */
  let probeT0 = 0;
  function frame(now) {
    perf.frame(now);
    if (probeT0 && now - probeT0 > 3000) { probeT0 = 0; const s = perf.stats(); if (perf.getMode() === 'auto' && s.avgMs && (s.avgMs > 25 || s.p90Ms > 33)) perf.stepDown('boot-probe'); }
  }
  function start() { perf.resume(); probeT0 = performance.now(); }
  function status() { const s = perf.stats(); return { ...s, look: tierName, preset: QMAP[tierName], post: !!composer, shadows: renderer.shadowMap.enabled, motes: motes.count }; }
  return { perf, tune, render, frame, start, resize, styleScene, status, sky, motes, get tier() { return tierName; }, get look() { return L; } };
}
