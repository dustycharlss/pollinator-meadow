// Phone-safe fallback materials (Squid L20 kit). Armed on any shader compile/link
// error: skip pastelize / onBeforeCompile, swap shared Standard/Basic stand-ins,
// and cull meadow grass, season and rain shaders inside the cave.
import * as THREE from 'three';
import SPEC from './l20-fallback/materials.json';
import envUrl from './l20-fallback/textures/env-cave-gradient.png';
import beamUrl from './l20-fallback/textures/beam-falloff.png';
import glowUrl from './l20-fallback/textures/glow-soft.png';
import ringUrl from './l20-fallback/textures/hud-ring.png';

const TEX_URL = {
  'textures/env-cave-gradient.png': envUrl,
  'textures/beam-falloff.png': beamUrl,
  'textures/glow-soft.png': glowUrl,
  'textures/hud-ring.png': ringUrl,
};

const BLEND = {
  NormalBlending: THREE.NormalBlending,
  AdditiveBlending: THREE.AdditiveBlending,
  MultiplyBlending: THREE.MultiplyBlending,
};
const SIDE = { FrontSide: THREE.FrontSide, BackSide: THREE.BackSide, DoubleSide: THREE.DoubleSide };
const CS = { SRGBColorSpace: THREE.SRGBColorSpace, NoColorSpace: THREE.NoColorSpace, LinearSRGBColorSpace: THREE.LinearSRGBColorSpace };

let armed = false;
let cave = false;
const hooks = {};
const mats = Object.create(null);
let texes = null;
const loader = new THREE.TextureLoader();

export function isShaderFallback() { return armed; }
export function isCaveLevel() { return cave; }
/** Skip pastelize and any onBeforeCompile hook once a shader has failed. */
export function skipCustomShaders() { return armed; }
/** Hide meadow grass / season / rain shaders inside the cave, and whenever fallback is armed. */
export function cullWorldFx() { return cave || armed; }

export function installFallbackHooks(h) {
  Object.assign(hooks, h);
  if (armed || cave) applyWorldCull();
  if (armed) { replaceHudRings(); if (cave) applyCaveMaterials(); }
}

export function setCaveLevel(on) {
  cave = !!on;
  applyWorldCull();
  if (armed && cave) applyCaveMaterials();
}

export function armShaderFallback(reason) {
  if (armed) return;
  armed = true;
  try { window.__shaderFallback = true; } catch (e) {}
  console.warn('[l20] shader failed, using fallback', reason);
  applyWorldCull();
  hooks.look?.disablePost?.();
  stripCustomShaders(hooks.scene);
  replaceHudRings();
  if (cave) applyCaveMaterials();
  try { hooks.look?.styleScene?.(); } catch (e) {}
  // Do not re-enter renderer.render from inside onShaderError; pick it up next frame.
  try { queueMicrotask(() => { try { hooks.look?.render?.(); } catch (e) { console.warn('[l20] fallback re-render', e); } }); } catch (e) {}
}

export function fallbackMaterial(key) {
  ensureMats();
  return mats[key] || null;
}

export function refreshFallbackMaterials() {
  if (armed && cave) applyCaveMaterials();
}

export function applyGhostMaterial(mesh, lit) {
  if (!mesh || !armed) return false;
  const m = fallbackMaterial(lit ? 'ghostBridgeLit' : 'ghostBridgeUnlit');
  if (!m) return false;
  mesh.material = m;
  mesh.material.needsUpdate = true;
  return true;
}

function loadTex(specPath, info) {
  const url = TEX_URL[specPath] || specPath;
  const t = loader.load(url);
  const meta = info || Object.values(SPEC.textures || {}).find(x => x.path === specPath) || {};
  t.colorSpace = CS[meta.colorSpace] || THREE.NoColorSpace;
  if (meta.mapping === 'EquirectangularReflectionMapping') t.mapping = THREE.EquirectangularReflectionMapping;
  t.needsUpdate = true;
  return t;
}

function ensureTex() {
  if (texes) return texes;
  texes = {};
  for (const [k, info] of Object.entries(SPEC.textures || {})) texes[k] = loadTex(info.path, info);
  return texes;
}

function ensureMats() {
  if (Object.keys(mats).length) return mats;
  ensureTex();
  const texByPath = {};
  for (const info of Object.values(SPEC.textures || {})) texByPath[info.path] = loadTex(info.path, info);
  // reuse the first load for each path
  for (const [k, info] of Object.entries(SPEC.textures || {})) texByPath[info.path] = texes[k];
  for (const [key, spec] of Object.entries(SPEC.materials || {})) {
    const Ctor = spec.type === 'MeshBasicMaterial' ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
    const opts = {
      color: new THREE.Color(spec.color || '#ffffff'),
      opacity: spec.opacity == null ? 1 : spec.opacity,
      transparent: !!spec.transparent,
      blending: BLEND[spec.blending] || THREE.NormalBlending,
      depthWrite: spec.depthWrite !== false,
      side: SIDE[spec.side] || THREE.FrontSide,
      flatShading: !!spec.flatShading,
      vertexColors: !!spec.vertexColors,
      fog: spec.fog !== false,
    };
    if (spec.toneMapped != null) opts.toneMapped = spec.toneMapped;
    if (Ctor === THREE.MeshStandardMaterial) {
      opts.emissive = new THREE.Color(spec.emissive || '#000000');
      opts.emissiveIntensity = spec.emissiveIntensity || 0;
      opts.metalness = spec.metalness || 0;
      opts.roughness = spec.roughness == null ? 1 : spec.roughness;
      if (spec.envMapIntensity != null) opts.envMapIntensity = spec.envMapIntensity;
    }
    if (spec.map) opts.map = texByPath[spec.map] || loadTex(spec.map);
    if (spec.alphaMap) opts.alphaMap = texByPath[spec.alphaMap] || loadTex(spec.alphaMap);
    if (spec.envMap) {
      opts.envMap = texByPath[spec.envMap] || loadTex(spec.envMap);
      if (spec.envMapIntensity != null) opts.envMapIntensity = spec.envMapIntensity;
    }
    if (spec.polygonOffset) {
      opts.polygonOffset = true;
      opts.polygonOffsetFactor = spec.polygonOffsetFactor || 0;
      opts.polygonOffsetUnits = spec.polygonOffsetUnits || 0;
    }
    const m = new Ctor(opts);
    m.name = key;
    m.userData.noPastel = true;
    m.userData.l20Fallback = key;
    if (spec.renderOrder != null) m.userData.renderOrder = spec.renderOrder;
    mats[key] = m;
  }
  return mats;
}

function applyWorldCull() {
  const hide = cullWorldFx();
  if (hooks.grass) hooks.grass.visible = !hide;
  const sky = hooks.sky || hooks.look?.sky;
  const scene = hooks.scene;
  if (hide) {
    if (sky) sky.visible = false;
    if (scene) {
      const c = new THREE.Color((SPEC.materials.skyFallback && SPEC.materials.skyFallback.color) || '#3c3466');
      scene.background = c;
      if (scene.fog) scene.fog.color.copy(c);
    }
    if (hooks.motes || hooks.look?.motes) (hooks.motes || hooks.look.motes).visible = false;
    hooks.weather?.cull?.();
  } else if (!armed) {
    if (sky) sky.visible = true;
    if (scene) scene.background = null;
  }
}

function stripCustomShaders(root) {
  if (!root || !root.traverse) return;
  root.traverse(o => {
    const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of list) {
      if (!m) continue;
      if (m.onBeforeCompile) { m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'l20fb'; m.needsUpdate = true; }
    }
  });
}

function replaceHudRings() {
  const ring = hooks.ringMesh, stam = hooks.stamMesh;
  const carry = fallbackMaterial('carryRing'), st = fallbackMaterial('stamRing');
  if (ring && carry && ring.material !== carry) { ring.material = carry; ring.material.needsUpdate = true; }
  if (stam && st && stam.material !== st) { stam.material = st; stam.material.needsUpdate = true; }
}

const NAME_KEY = {
  'crystal-cyan': 'crystal-cyan', 'crystal-pink': 'crystal-pink', 'crystal-gold': 'crystal-gold',
  stone: 'stone', mirror: 'mirror', 'dark-wood': 'dark-wood', frame: 'frame', panel: 'panel',
  web: 'web',
};

function applyCaveMaterials() {
  const root = hooks.zoneGroup || hooks.scene;
  if (!root) return;
  ensureMats();
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map(m => {
      if (!m || m.userData.l20Fallback) return m;
      const key = NAME_KEY[m.name] || (m.userData.l20Key);
      return (key && mats[key]) || m;
    });
    if (next.some((m, i) => m !== list[i])) {
      o.material = Array.isArray(o.material) ? next : next[0];
      if (o.material) o.material.needsUpdate = true;
    }
    const ro = o.material && o.material.userData && o.material.userData.renderOrder;
    if (ro != null) o.renderOrder = ro;
  });
}

export { SPEC as FALLBACK_SPEC };
