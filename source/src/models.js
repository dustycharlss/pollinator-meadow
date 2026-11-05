import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import URLS from './model-urls.json';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const BASE = import.meta.env.BASE_URL;
const cache = new Map(), ready = new Map();
export const getGLB = (key) => ready.get(key) || null;
export function loadGLB(key) {
  if (!cache.has(key)) {
    const raw = BASE + 'models/' + key + '.glb', url = URLS[key] ? BASE + URLS[key] : raw; // lod > blocky-opt > opt > raw (tools/lod-map.json)
    cache.set(key, loader.loadAsync(url).catch(e => url !== raw ? (console.warn('model fallback to raw', key), loader.loadAsync(raw)) : Promise.reject(e))
      .then(g => { ready.set(key, g); return g; }).catch(e => { console.warn('model failed', key, e); return null; }));
  }
  return cache.get(key);
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
const matCache = new Map();
export function lambertFrom(m, { emissive } = {}) {
  const key = m.uuid + (emissive || '');
  if (matCache.has(key)) return matCache.get(key);
  const n = new THREE.MeshLambertMaterial({
    color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, vertexColors: !!m.vertexColors,
    flatShading: true, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side === THREE.BackSide ? THREE.BackSide : (m.transparent || m.alphaTest ? THREE.DoubleSide : m.side)
  });
  if (n.map) n.map.colorSpace = THREE.SRGBColorSpace;
  if (m.emissive && m.emissive.getHex() > 0) { n.emissive = m.emissive.clone(); n.emissiveMap = m.emissiveMap; }
  n.name = m.name;
  matCache.set(key, n);
  return n;
}

/**
 * Bake a GLB into normalised parts: [{geometry, material}], rotated by rot, scaled so that
 * mode ('height'|'max'|'length'|'span') == size, grounded (min y = 0, centred xz) or centred.
 */
export function bakeParts(gltf, { size = 1, mode = 'height', rot = [0, 0, 0], ground = true } = {}) {
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
  const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const dim = mode === 'height' ? sz.y : mode === 'length' ? sz.z : mode === 'span' ? sz.x : Math.max(sz.x, sz.y, sz.z);
  const s = size / Math.max(dim, 1e-5);
  const T = new THREE.Matrix4().makeTranslation(-c.x * s, ground ? -box.min.y * s : -c.y * s, -c.z * s);
  const M = T.multiply(new THREE.Matrix4().makeScale(s, s, s));
  for (const p of parts) { p.geometry.applyMatrix4(M); p.geometry.computeBoundingSphere(); p.geometry.computeBoundingBox(); }
  const b2 = new THREE.Box3(); parts.forEach(p => b2.union(p.geometry.boundingBox));
  return { parts, box: b2 };
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
