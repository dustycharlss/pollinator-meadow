// Pollinator Meadow art direction B: "Golden Hour Pastel" (picked by the user, Nov 14 2026).
// Drop-in Three.js preset. Values are copied 1:1 from the style-frame builder (src/styles.js preset B + src/build.js),
// so applying them reproduces frame-B.png. Data lives in PRESET_B (also exported as preset-B.json).
//
//   import { applyPresetB, createComposerB, pastelize, makeSkyDomeB, makePollenMotesB } from './preset-B.js';
//   const fx = applyPresetB(scene, renderer, { quality: 'high', camera });   // lights, fog, tone mapping, shadows
//   const composer = createComposerB(renderer, scene, camera, fx);            // bloom + grade (null on 'low')
//   scene.traverse(o => o.isMesh && pastelize(o.material, o.userData.isAnimal ? 0.5 : 1));  // optional palette lift
//   each frame: fx.motes?.update(t); composer ? composer.render() : renderer.render(scene, camera);
//
// Needs three r170+ (NeutralToneMapping). Tested headless with three 0.170.
import * as THREE from 'three';
import { skipCustomShaders } from './l20-fallback.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const PRESET_B = {
  id: 'B', name: 'Golden Hour Pastel',
  palette: {
    sky: { zenith: '#a8b8f0', mid: '#f6c4d8', horizon: '#ffe1b4' },
    terrain: { grass: ['#a8e2a6', '#bfeab0', '#98d8a0', '#cdeeb8'], hill: ['#b8e0b4', '#f0d2c0'], bank: '#ffe2c8', mud: '#e8b8a0' },
    foliage: { leaves: '#6fd39a', trunk: '#a06a5a' },
    rock: { stone: '#c4b4d8', moss: '#9fdc8c' },
    water: { shallow: '#b8ecf4', deep: '#8fc8e8', foam: '#fff6ea', opacity: 0.88, roughness: 0.12 },
    clouds: '#ffe9ef', cloudEmissive: 0.55,
    pollen: '#fff0c8'
  },
  // GLB material-name overrides used in the frame (treeA leaves/trunks = mat9/mat20, mossy rock = Stone/Moss)
  recolor: { mat9: '#6fd39a', mat20: '#a06a5a', Stone: '#c4b4d8', Moss: '#9fdc8c' },
  // shader colour lift applied to model materials (animals at strength 0.5, props at 1, terrain/water at 0)
  materialAdjust: { saturation: 0.9, lighten: 0.12, pastel: 0.2, warm: 0.0, animalStrength: 0.5, roughness: 0.75, metalness: 0 },
  sun: { color: '#ffc39a', intensity: 3.0, azimuthDeg: 72, elevationDeg: 17,
         // azimuth is camera-relative: 0 = behind the camera, +90 = screen-right. World dir for the frame camera (looking down -Z):
         worldDir: [0.913, 0.292, 0.284], distance: 60 },
  hemi: { sky: '#cdbfff', ground: '#ffd2b4', intensity: 2.0 },
  fog: { color: '#ffd6c8', near: 30, far: 95 },
  toneMapping: 'Neutral', exposure: 1.0,
  shadow: { type: 'PCFSoft', mapSize: 4096, bias: -0.0008, normalBias: 0.02, radius: 6, intensity: 1.0,
            camera: { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 160 },
            lengthPerMetre: 3.27 },   // 1 / tan(17 deg): a 1 m tall block casts a ~3.3 m shadow
  bloom: { strength: 0.45, radius: 0.7, threshold: 0.78 },
  grade: { saturation: 1.0, contrast: 1.0, brightness: 0.0, lift: '#1a0e28', gain: '#fff0dc',
           vignette: 0.22, vignetteColor: '#c0708a', haze: 0.035, hazeColor: '#ffd9b0' },
  skyGlow: { wide: 0.25, widePower: 6, core: 0.4, corePower: 60 },
  pollen: { count: 46, radius: 0.035, color: '#fff0c8', hdrBoost: 1.6, heightMin: 0.6, heightMax: 3.4,
            motion: { bobAmp: 0.12, bobHz: [0.25, 0.5], swirlRadius: 0.25, swirlHz: [0.05, 0.12], riseSpeed: 0.04, wrapHeight: 3.4 } },
  camera: { fov: 33, position: [1.0, 3.5, 13.2], lookAt: [0.8, 2.55, -2.0] },
  quality: {
    high:   { pixelRatioMax: 2,   shadowMap: 4096, shadowType: 'PCFSoft', bloom: true,  bloomScale: 1.0, grade: true,  msaa: 4, pollen: 46, grassDensity: 1.0 },
    medium: { pixelRatioMax: 1.5, shadowMap: 2048, shadowType: 'PCFSoft', bloom: true,  bloomScale: 0.5, grade: true,  msaa: 0, pollen: 24, grassDensity: 0.6 },
    // low has no post: the grade's warm gain + peach haze are folded into the lights/sky/fog colours instead, and the vignette
    // can be a CSS overlay (see cssOverlayB) so it costs no GPU pass.
    low:    { pixelRatioMax: 1,   shadowMap: 1024, shadowType: 'PCF',     bloom: false, bloomScale: 0,   grade: false, msaa: 0, pollen: 12, grassDensity: 0.3, fogFar: 70,
              bakeGrade: { lightTint: '#ffe6c4', skyTint: '#ffd8b0', hazeMix: 0.2 } }
  }
};

const col = (h) => new THREE.Color(h);

/** World-space unit vector toward the sun. Pass the gameplay camera to keep the frame's camera-relative angle. */
export function sunDirectionB(camera, P = PRESET_B) {
  if (!camera) return new THREE.Vector3(...P.sun.worldDir).normalize();
  const az = THREE.MathUtils.degToRad(P.sun.azimuthDeg), el = THREE.MathUtils.degToRad(P.sun.elevationDeg);
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); const r = new THREE.Vector3(-f.z, 0, f.x);
  return f.multiplyScalar(-Math.cos(az) * Math.cos(el)).addScaledVector(r, Math.sin(az) * Math.cos(el)).add(new THREE.Vector3(0, Math.sin(el), 0)).normalize();
}

/** Pastel colour lift on any built-in material (same GLSL as the frame builder). strength 1 = props, 0.5 = animals. */
export function pastelize(material, strength = 1, P = PRESET_B) {
  if (skipCustomShaders()) return material;
  const mats = Array.isArray(material) ? material : [material];
  const a = P.materialAdjust, sat = 1 + (a.saturation - 1) * strength, li = a.lighten * strength, pa = a.pastel * strength, wa = a.warm * strength;
  for (const m of mats) {
    if (!m || m.userData.presetB) continue; m.userData.presetB = true;
    if (P.recolor[m.name] && m.color) m.color.set(P.recolor[m.name]);
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, ${sat.toFixed(3)}); c += ${li.toFixed(3)} * (1.0 - c);
          c = mix(c, vec3(1.0), ${pa.toFixed(3)}); c = mix(c, c * vec3(1.12, 0.98, 0.78), ${wa.toFixed(3)} * 2.0);
          diffuseColor.rgb = clamp(c, 0.0, 1.0); }`); };
    const key = `presetB${sat}${li}${pa}${wa}`; m.customProgramCacheKey = () => key; m.needsUpdate = true;
  }
  return material;
}

/** Gradient sky sphere with the warm sun glow (cheap: one draw call, no texture). */
export function makeSkyDomeB(sunDir = sunDirectionB(), radius = 600, P = PRESET_B) {
  const g = P.skyGlow;
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: col(P.palette.sky.zenith) }, mid: { value: col(P.palette.sky.mid) }, hor: { value: col(P.palette.sky.horizon) }, sunDir: { value: sunDir.clone() }, sunC: { value: col(P.sun.color) } },
    vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, mid, hor, sunDir, sunC; varying vec3 vW;
      void main(){ float y = clamp(vW.y, -0.2, 1.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.6, y));
        float s = max(dot(normalize(vW), sunDir), 0.0); c += sunC * (pow(s, ${g.widePower.toFixed(1)}) * ${g.wide} + pow(s, ${g.corePower.toFixed(1)}) * ${g.core});
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), m); sky.name = 'presetB-sky'; sky.renderOrder = -1; sky.frustumCulled = false; return sky;
}

/** Floating pollen glow motes. getGroundY(x,z) places them over terrain. Call .update(seconds) every frame. */
export function makePollenMotesB({ count = PRESET_B.pollen.count, area = { x: [-6, 9], z: [-9, 7] }, getGroundY = () => 0, avoid = null, seed = 7 } = {}, P = PRESET_B) {
  const pp = P.pollen; let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const geo = count <= 12 ? new THREE.PlaneGeometry(pp.radius * 4, pp.radius * 4) : new THREE.SphereGeometry(pp.radius, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: col(pp.color).multiplyScalar(pp.hdrBoost), toneMapped: false, transparent: count <= 12, opacity: 0.9, depthWrite: false });
  const im = new THREE.InstancedMesh(geo, mat, count); im.name = 'presetB-pollen'; im.frustumCulled = false;
  const base = [];
  for (let i = 0; i < count; i++) {
    let x, z, n = 0; do { x = area.x[0] + rnd() * (area.x[1] - area.x[0]); z = area.z[0] + rnd() * (area.z[1] - area.z[0]); n++; } while (avoid && avoid(x, z) && n < 50);
    base.push({ x, z, y: pp.heightMin + rnd() * (pp.heightMax - pp.heightMin), g: getGroundY(x, z), ph: rnd() * 6.28,
      bob: pp.motion.bobHz[0] + rnd() * (pp.motion.bobHz[1] - pp.motion.bobHz[0]), sw: pp.motion.swirlHz[0] + rnd() * (pp.motion.swirlHz[1] - pp.motion.swirlHz[0]) });
  }
  const M = new THREE.Matrix4(), mo = pp.motion;
  im.update = (t = 0) => {
    for (let i = 0; i < count; i++) { const b = base[i];
      const h = pp.heightMin + ((b.y - pp.heightMin + mo.riseSpeed * t) % (mo.wrapHeight - pp.heightMin));
      M.makeTranslation(b.x + Math.cos(t * b.sw * 6.283 + b.ph) * mo.swirlRadius * (t ? 1 : 0), b.g + h + Math.sin(t * b.bob * 6.283 + b.ph) * mo.bobAmp * (t ? 1 : 0), b.z + Math.sin(t * b.sw * 6.283 + b.ph) * mo.swirlRadius * (t ? 1 : 0));
      im.setMatrixAt(i, M); }
    im.instanceMatrix.needsUpdate = true; };
  im.update(0); return im;
}

/**
 * Apply preset B: hemisphere + sun (with shadows), fog, tone mapping, shadow-map type, pixel ratio.
 * opts: { quality: 'high'|'medium'|'low', camera, target: Vector3 (shadow focus), sky: true, pollen: {...} | false, replace: true }
 * Returns { sun, hemi, sky, motes, quality, bloom, grade, preset }.
 */
export function applyPresetB(scene, renderer, opts = {}, P = PRESET_B) {
  const qn = opts.quality || 'high', Q = P.quality[qn]; if (!Q) throw new Error('quality must be high|medium|low');
  if (opts.replace !== false) for (const n of ['presetB-sun', 'presetB-hemi', 'presetB-sky', 'presetB-pollen']) { const o = scene.getObjectByName(n); if (o) { o.removeFromParent(); if (o.target) o.target.removeFromParent(); } }
  // renderer
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = P.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = Q.shadowType === 'PCF' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; renderer.shadowMap.needsUpdate = true;
  if (renderer.setPixelRatio && typeof window !== 'undefined') renderer.setPixelRatio(Math.min(opts.pixelRatio ?? (window.devicePixelRatio || 1), Q.pixelRatioMax));
  // fog + background fallback
  scene.fog = new THREE.Fog(col(P.fog.color), P.fog.near, Q.fogFar || P.fog.far);
  if (!opts.sky && opts.sky !== undefined) scene.background = col(P.palette.sky.horizon);
  // lights
  const hemi = new THREE.HemisphereLight(col(P.hemi.sky), col(P.hemi.ground), P.hemi.intensity); hemi.name = 'presetB-hemi'; scene.add(hemi);
  const dir = sunDirectionB(opts.camera, P), tgt = opts.target ? opts.target.clone() : new THREE.Vector3(1, 0, -2);
  const sun = new THREE.DirectionalLight(col(P.sun.color), P.sun.intensity); sun.name = 'presetB-sun';
  sun.position.copy(tgt).addScaledVector(dir, P.sun.distance); sun.target.position.copy(tgt); scene.add(sun, sun.target);
  const sh = P.shadow, sc = sun.shadow.camera; sun.castShadow = true;
  Object.assign(sc, sh.camera); sc.updateProjectionMatrix();
  sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap); sun.shadow.bias = sh.bias; sun.shadow.normalBias = sh.normalBias; sun.shadow.radius = sh.radius;
  if ('intensity' in sun.shadow) sun.shadow.intensity = sh.intensity;
  if (Q.bakeGrade) { const bg = Q.bakeGrade, t = col(bg.lightTint); sun.color.multiply(t); hemi.color.multiply(t); hemi.groundColor.multiply(t);
    scene.fog.color.lerp(col(P.grade.hazeColor), bg.hazeMix); }
  // sky + pollen
  let sky = null, motes = null;
  if (opts.sky !== false) { sky = makeSkyDomeB(dir, 600, P); scene.add(sky);
    if (Q.bakeGrade) for (const k of ['top', 'mid', 'hor']) sky.material.uniforms[k].value.multiply(col(Q.bakeGrade.skyTint)).lerp(col(P.grade.hazeColor), Q.bakeGrade.hazeMix); }
  if (opts.pollen !== false) { motes = makePollenMotesB({ count: Q.pollen, ...(opts.pollen || {}) }, P); scene.add(motes); }
  return { sun, hemi, sky, motes, sunDir: dir, quality: { name: qn, ...Q }, bloom: Q.bloom ? { ...P.bloom } : null, grade: Q.grade ? { ...P.grade } : null, preset: P };
}

/** Final colour grade (lift/gain/sat/contrast, peach haze, rose vignette) as a ShaderPass. Runs after OutputPass (sRGB). */
export function makeGradePassB(P = PRESET_B) {
  const g = P.grade;
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, sat: { value: g.saturation }, contrast: { value: g.contrast }, bright: { value: g.brightness }, lift: { value: col(g.lift) }, gain: { value: col(g.gain) },
      vignette: { value: g.vignette }, vigColor: { value: col(g.vignetteColor) }, haze: { value: g.haze }, hazeColor: { value: col(g.hazeColor) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, contrast, bright, vignette, haze; uniform vec3 lift, gain, vigColor, hazeColor; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
        c = c * gain + lift * (1.0 - c) * 0.5; c += bright;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat); c = (c - 0.5) * contrast + 0.5;
        float d = distance(vUv, vec2(0.5));
        c = mix(c, hazeColor, haze * (1.0 - smoothstep(0.0, 0.7, vUv.y)) * 0.6 + haze * 0.3);
        c = mix(c, c * vigColor * 1.2, smoothstep(0.38, 0.95, d) * vignette);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`
  });
  pass.name = 'presetB-grade'; return pass;
}

/** EffectComposer for the chosen quality: Render -> Bloom -> Output -> Grade. Returns null on 'low' (render directly). */
export function isSoftGl(renderer) {
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    return /SwiftShader|llvmpipe|soft-?pipe|Microsoft Basic Render/i.test(s);
  } catch (e) { return false; }
}

export function createComposerB(renderer, scene, camera, fx, P = PRESET_B) {
  const Q = fx.quality; if (!Q.bloom && !Q.grade) return null;
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  const soft = !!(fx.softGl ?? isSoftGl(renderer));
  // Half-float composer/bloom targets often clear to black on SwiftShader; use 8-bit and skip bloom there.
  const rtType = soft || fx.byteTarget ? THREE.UnsignedByteType : THREE.HalfFloatType;
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: rtType, samples: soft ? 0 : (Q.msaa || 0) });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  if (Q.bloom && !soft) { const b = new UnrealBloomPass(new THREE.Vector2(size.x * Q.bloomScale, size.y * Q.bloomScale), P.bloom.strength, P.bloom.radius, P.bloom.threshold); b.name = 'presetB-bloom'; composer.addPass(b); }
  composer.addPass(new OutputPass());
  if (Q.grade) composer.addPass(makeGradePassB(P));
  return composer;
}

/** CSS for a zero-cost vignette + haze overlay (low quality, or any tier if you drop the grade pass). Put on a div over the canvas. */
export function cssOverlayB(P = PRESET_B) {
  return `pointer-events:none;position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 48%, ${P.grade.vignetteColor}38 100%), linear-gradient(to top, ${P.grade.hazeColor}1a, rgba(0,0,0,0) 70%);mix-blend-mode:multiply`;
}

export default PRESET_B;
