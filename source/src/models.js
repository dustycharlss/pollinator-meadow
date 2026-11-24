import * as THREE from 'three';
import { skipCustomShaders } from './l20-fallback.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import URLS from './model-urls.json';
const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
const BASE = import.meta.env.BASE_URL;
const cache = new Map(), ready = new Map();
/** Resolve a repo-relative asset against <base href> / document.baseURI so staging slugs do not fetch from /staging/l20x/. */
function assetURL(rel) {
  const path = String(rel || '');
  const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : (BASE || './');
  try { return new URL(path, base).href; } catch (e) { return path; }
}
function loadAsyncRetry(url, tries = 3) {
  return loader.loadAsync(url).catch(e => {
    const msg = String((e && e.message) || e);
    if (tries > 1 && /Failed to fetch|abort|AbortError|NetworkError|Load failed/i.test(msg)) {
      return new Promise(r => setTimeout(r, 180)).then(() => loadAsyncRetry(url, tries - 1));
    }
    return Promise.reject(e);
  });
}
export const getGLB = (key) => ready.get(key) || null;
export function loadGLB(key) {
  if (!cache.has(key)) {
    const raw = assetURL((BASE || './') + 'models/' + key + '.glb'), url = URLS[key] ? assetURL((BASE || './') + URLS[key]) : raw; // lod > blocky-opt > opt > raw (tools/lod-map.json)
    cache.set(key, loadAsyncRetry(url).catch(e => url !== raw ? (console.warn('model fallback to raw', key), loadAsyncRetry(raw)) : Promise.reject(e))
      .then(g => { ready.set(key, g); return g; }).catch(e => { console.warn('model failed', key, e); return null; }));
  }
  return cache.get(key);
}
const urlCache = new Map();
/** load a GLB by repo-relative path (phone LOD files); null on failure */
export function loadURL(path) {
  if (!urlCache.has(path)) urlCache.set(path, loadAsyncRetry(assetURL((BASE || './') + path)).catch(e => { console.warn('lod model failed', path, e); return null; }));
  return urlCache.get(path);
}
export async function loadMany(keys, onProgress) {
  let n = 0;
  await Promise.all(keys.map(k => loadGLB(k).then(() => onProgress && onProgress(++n / keys.length))));
}

export function toFloat(g) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return g;
}

// Lambert replacement keeps phones fast while preserving texture/vertex colour.
// Cache by look (color/map/opacity), not source uuid, so cave meshes can share and merge.
const matCache = new Map();
function lambertLookKey(m, extra = '') {
  const c = m.color ? m.color.getHexString() : 'ffffff';
  const e = m.emissive && m.emissive.getHex ? m.emissive.getHexString() : '000000';
  const ei = (m.emissiveIntensity || 0).toFixed(3);
  const map = m.map ? m.map.uuid : '';
  return [c, e, ei, map, +!!m.vertexColors, +!!m.transparent, (m.opacity ?? 1).toFixed(3), m.side || 0, m.blending || 1, m.depthWrite === false ? 0 : 1, m.alphaTest || 0, extra].join('|');
}
export function lambertFrom(m, { emissive, caveNight } = {}) {
  const key = lambertLookKey(m, (emissive || '') + (caveNight ? ':cn' : ''));
  if (matCache.has(key)) return matCache.get(key);
  const n = new THREE.MeshLambertMaterial({
    color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, vertexColors: !!m.vertexColors,
    flatShading: true, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side === THREE.BackSide ? THREE.BackSide : (m.transparent || m.alphaTest ? THREE.DoubleSide : m.side)
  });
  if (n.map) n.map.colorSpace = THREE.SRGBColorSpace;
  if (caveNight) { n.emissive = n.color.clone().multiplyScalar(0.18); n.emissiveIntensity = Math.max(n.emissiveIntensity || 0, 0.16); }
  else if (m.emissive && m.emissive.getHex() > 0) { n.emissive = m.emissive.clone(); n.emissiveMap = m.emissiveMap; }
  n.name = m.name;
  matCache.set(key, n);
  return n;
}

/**
 * Bake a GLB into normalised parts: [{geometry, material}], rotated by rot, scaled so that
 * mode ('height'|'max'|'length'|'span') == size, grounded (min y = 0, centred xz) or centred.
 */
export function bakeParts(gltf, { size = 1, mode = 'height', rot = [0, 0, 0], ground = true, M: M0 = null } = {}) { // M0: reuse another bake's normalisation (phone LODs share LOD0's)
  const root = gltf.scene; root.updateMatrixWorld(true);
  const R = new THREE.Matrix4();
  if (rot && rot.seq) { for (const [ax, an] of rot.seq) R.premultiply(new THREE.Matrix4()['makeRotation' + ax.toUpperCase()](an)); }
  else R.makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  const parts = []; const box = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = toFloat(o.geometry.clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(R, o.matrixWorld));
    g.computeBoundingBox(); box.union(g.boundingBox);
    parts.push({ geometry: g, material: o.material });
  });
  let M = M0;
  if (!M) {
    const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const dim = mode === 'height' ? sz.y : mode === 'length' ? sz.z : mode === 'span' ? sz.x : Math.max(sz.x, sz.y, sz.z);
    const s = size / Math.max(dim, 1e-5);
    const T = new THREE.Matrix4().makeTranslation(-c.x * s, ground ? -box.min.y * s : -c.y * s, -c.z * s);
    M = T.multiply(new THREE.Matrix4().makeScale(s, s, s));
  }
  for (const p of parts) { p.geometry.applyMatrix4(M); p.geometry.computeBoundingSphere(); p.geometry.computeBoundingBox(); }
  const b2 = new THREE.Box3(); parts.forEach(p => b2.union(p.geometry.boundingBox));
  return { parts, box: b2, M };
}

// Wing-flap vertex shader: lateral verts beyond `body` beat. `style` picks a phone-readable flying look.
//   buzz     bee/bumblebee rapid shimmer
//   stroke   butterfly/moth slow asymmetric power-stroke
//   blur     hummingbird hover figure-8
//   paired   dragonfly fore/hind out of phase
//   leather  bat deep membrane flaps (fallback when no Flying clip)
//   beat     bird discrete wing beats
export const FLAP_STYLE = { sine: 0, buzz: 1, stroke: 2, blur: 3, paired: 4, leather: 5, beat: 6 };
const flapTimes = [];
export function updateFlaps(t) { for (const f of flapTimes) f.m.userData.uPh.value = t * f.freq; }
export function makeFlapMaterial(base, { amp = 0.5, body = 0.07, span = 1, tint, style = 'sine', freq = 20 } = {}) {
  const m = lambertFrom(base).clone();
  if (tint) m.color.multiply(tint);
  const uPh = { value: 0 }, uA = { value: amp };
  const styleId = FLAP_STYLE[style] ?? FLAP_STYLE.sine;
  m.userData.uPh = uPh; m.userData.uAmp = uA; m.userData.baseAmp = amp; m.userData.flapStyle = style;
  if (skipCustomShaders()) return m;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPh = uPh; sh.uniforms.uAmp = uA;
    sh.uniforms.uBody = { value: body * span }; sh.uniforms.uSpan = { value: span * 0.5 };
    sh.uniforms.uStyle = { value: styleId };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPhase;\nuniform float uPh,uAmp,uBody,uSpan,uStyle;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fax = abs(transformed.x);
        float fw = smoothstep(uBody, uSpan, fax);
        float ph = uPh + aPhase * 6.2831;
        float fs = sin(ph);
        float xFold = 0.14;
        if (uStyle > 0.5 && uStyle < 1.5) {
          fs = sin(ph) * 0.82 + sin(ph * 3.1) * 0.18;
          xFold = 0.10;
        } else if (uStyle > 1.5 && uStyle < 2.5) {
          float s = sin(ph);
          fs = s >= 0.0 ? pow(s, 0.45) : -pow(-s, 1.65);
          xFold = 0.22;
        } else if (uStyle > 2.5 && uStyle < 3.5) {
          fs = sin(ph);
          transformed.z += cos(ph * 2.0) * uAmp * fw * fax * 0.45;
          xFold = 0.08;
        } else if (uStyle > 3.5 && uStyle < 4.5) {
          float side = transformed.z >= 0.0 ? 0.0 : 3.14159;
          fs = sin(ph + side);
          xFold = 0.12;
        } else if (uStyle > 4.5 && uStyle < 5.5) {
          fs = sin(ph);
          xFold = 0.32;
          transformed.z += sin(ph) * uAmp * fw * fax * 0.12;
        } else if (uStyle > 5.5) {
          float s = sin(ph);
          fs = sign(s) * pow(abs(s) + 1e-4, 0.32);
          xFold = 0.18;
        }
        transformed.y += fs * uAmp * fw * fax;
        transformed.x *= 1.0 - xFold * abs(fs) * fw;`);
  };
  m.customProgramCacheKey = () => 'flap-' + styleId;
  flapTimes.push({ m, freq });
  return m;
}
