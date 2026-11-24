// Act 3 shared palette atlas (Squid / Noodle plan, Nov 22 2026).
// One 256² nearest-filter albedo + emissive companion. Each colour lives in an 8 px
// cell; UVs sit at the cell centre so merged chunks stay one draw regardless of colour.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import albedoUrl from './atlas/act3-palette-albedo-256.png';
import emissiveUrl from './atlas/act3-palette-emissive-256.png';
import SW from './atlas/swatches.json';

const loader = new THREE.TextureLoader();
function loadTex(url, srgb) {
  const t = loader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.flipY = true;
  return t;
}

const albedo = loadTex(albedoUrl, true);
const emissiveMap = loadTex(emissiveUrl, true);

const lit = new THREE.MeshLambertMaterial({
  map: albedo, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1,
  flatShading: false, vertexColors: false,
});
lit.userData.noPastel = true;
lit.name = 'act3-atlas';

const unlit = new THREE.MeshBasicMaterial({ map: albedo, vertexColors: false });
unlit.userData.noPastel = true;
unlit.name = 'act3-atlas-basic';

const litDS = lit.clone(); litDS.side = THREE.DoubleSide; litDS.userData.noPastel = true;
const unlitDS = unlit.clone(); unlitDS.side = THREE.DoubleSide; unlitDS.userData.noPastel = true;

const byKey = new Map();
function hexOf(c) {
  if (!c) return '000000';
  const h = String(c).replace('#', '').toLowerCase();
  return h.length === 6 ? h : ('000000' + h).slice(-6);
}
for (const s of SW.swatches) {
  const a = hexOf(s.a), e = s.e ? hexOf(s.e) : '';
  byKey.set(a + '|' + e, s);
  if (!byKey.has(a + '|')) byKey.set(a + '|', s);
}

function rgbToHex(col) {
  if (!col) return 'ffffff';
  if (col.getHexString) return col.getHexString();
  return ('000000' + (col.getHex ? col.getHex() : 0xffffff).toString(16)).slice(-6);
}

function nearest(aHex, eHex) {
  const exact = byKey.get(aHex + '|' + (eHex || '')) || byKey.get(aHex + '|');
  if (exact) return exact;
  // cheap RGB distance against unique albedos
  const ar = parseInt(aHex.slice(0, 2), 16), ag = parseInt(aHex.slice(2, 4), 16), ab = parseInt(aHex.slice(4, 6), 16);
  let best = null, bestD = 48; // ~ΔE-ish cutoff in 8-bit RGB
  for (const s of SW.swatches) {
    if (s.alias) continue;
    const h = hexOf(s.a);
    const d = Math.abs(ar - parseInt(h.slice(0, 2), 16)) + Math.abs(ag - parseInt(h.slice(2, 4), 16)) + Math.abs(ab - parseInt(h.slice(4, 6), 16));
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/** Return cell-centre UV for a material, or null if we should keep the mesh separate. */
// Authored cave stone / shadow stay on lavender cells (S148 / S149), never a gold neighbour like S147.
const PIN = {
  '9c8cc6': { u: 0.203125, v: 0.796875, id: 'S148' },
  'c0b9d6': { u: 0.203125, v: 0.796875, id: 'S148' },
  '5e5288': { u: 0.234375, v: 0.796875, id: 'S149' },
  '8a7cb8': { u: 0.234375, v: 0.796875, id: 'S149' },
  '8f82b8': { u: 0.234375, v: 0.796875, id: 'S149' },
};

export function swatchUV(mat) {
  if (!mat || mat.map || (mat.transparent && mat.opacity < 0.97)) return null;
  const a = rgbToHex(mat.color);
  const e = (mat.emissive && mat.emissive.getHex && mat.emissive.getHex() > 0) ? rgbToHex(mat.emissive) : '';
  if (PIN[a]) return PIN[a];
  if (e) {
    const exact = byKey.get(a + '|' + e);
    if (exact) return { u: exact.u, v: exact.v, id: exact.id };
    // Same albedo, closest emissive (firefly glow is #daaa6c / #ffeaaa, not an exact cell).
    const er = parseInt(e.slice(0, 2), 16), eg = parseInt(e.slice(2, 4), 16), eb = parseInt(e.slice(4, 6), 16);
    let best = null, bestD = 80;
    for (const s of SW.swatches) {
      if (s.alias || hexOf(s.a) !== a || !s.e) continue;
      const h = hexOf(s.e);
      const d = Math.abs(er - parseInt(h.slice(0, 2), 16)) + Math.abs(eg - parseInt(h.slice(2, 4), 16)) + Math.abs(eb - parseInt(h.slice(4, 6), 16));
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best) return { u: best.u, v: best.v, id: best.id };
  }
  const s = nearest(a, e);
  return s ? { u: s.u, v: s.v, id: s.id } : null;
}

export function atlasMaterial({ basic = false, doubleSide = false } = {}) {
  if (basic) return doubleSide ? unlitDS : unlit;
  return doubleSide ? litDS : lit;
}

export function writeAtlasUV(geo, uv) {
  if (!geo || !geo.attributes.position || !uv) return geo;
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { arr[i * 2] = uv.u; arr[i * 2 + 1] = uv.v; }
  geo.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
  return geo;
}

export { lit as ATLAS };

function decodeNormAttr(src) {
  const dst = new Float32Array(src.length);
  let max = 0, signed = false;
  if (src instanceof Int8Array) { max = 127; signed = true; }
  else if (src instanceof Int16Array) { max = 32767; signed = true; }
  else if (src instanceof Int32Array) { max = 2147483647; signed = true; }
  else if (src instanceof Uint8Array || src instanceof Uint8ClampedArray) { max = 255; }
  else if (src instanceof Uint16Array) { max = 65535; }
  else if (src instanceof Uint32Array) { max = 4294967295; }
  else { dst.set(src); return dst; }
  if (signed) { for (let i = 0; i < src.length; i++) dst[i] = Math.max(src[i] / max, -1); }
  else { for (let i = 0; i < src.length; i++) dst[i] = src[i] / max; }
  return dst;
}
function asFloat32Attr(g, name) {
  const attr = g.attributes[name];
  if (!attr || !attr.array) return;
  const src = attr.array;
  if (src instanceof Float32Array && !attr.normalized) return;
  const packed = attr.normalized && !(src instanceof Float32Array) && !(src instanceof Float64Array);
  const dst = packed ? decodeNormAttr(src) : (src instanceof Float32Array ? src : new Float32Array(src));
  g.setAttribute(name, new THREE.BufferAttribute(dst, attr.itemSize, false));
}
function normRigGeo(g) {
  if (g.index) g = g.toNonIndexed();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  if (!g.attributes.normal && g.attributes.position) g.computeVertexNormals();
  asFloat32Attr(g, 'position'); asFloat32Attr(g, 'normal'); asFloat32Attr(g, 'uv');
  if (g.morphAttributes) g.morphAttributes = {};
  if (g.clearGroups) g.clearGroups();
  return g;
}

function isFlapOrSeason(mat) {
  if (!mat) return false;
  const key = (typeof mat.customProgramCacheKey === 'function' && mat.customProgramCacheKey()) || '';
  if (/^flap-|^seas-/.test(key) || mat.userData?.flapStyle || mat.userData?.uPh) return true;
  const hook = mat.userData?.shaderHook || mat.userData?.hook || mat.name || '';
  return /flap-|seas-/.test(hook);
}

/** Step 4: merge plain-colour (and glow/eye) sub-meshes per animated node onto the shared atlas.
 *  Keeps textured maps and flap-/seas- shader parts as separate draws so clips still run on node TRS. */
export function mergeAtlasRig(root, clip) {
  if (!root) return root;
  const anim = new Set((clip ? clip.tracks : []).map(t => String(t.name).split('.')[0]));
  root.updateMatrixWorld(true);
  const groups = new Map(), drop = [];
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh || o.userData.noMerge) return;
    const m = Array.isArray(o.material) ? null : o.material;
    if (!m || m.map || isFlapOrSeason(m)) return;
    const uv = swatchUV(m);
    if (!uv) return;
    let a = o.parent;
    while (a && a !== root && !anim.has(a.name)) a = a.parent;
    a = a || root;
    inv.copy(a.matrixWorld).invert();
    rel.multiplyMatrices(inv, o.matrixWorld);
    let geo = normRigGeo(o.geometry.clone());
    geo.applyMatrix4(rel);
    writeAtlasUV(geo, uv);
    const list = groups.get(a) || [];
    list.push(geo); groups.set(a, list);
    drop.push(o);
  });
  const mat = atlasMaterial();
  for (const [a, list] of groups) {
    if (!list.length) continue;
    let merged = null;
    try { merged = list.length === 1 ? list[0] : (mergeGeometries(list, false) || null); } catch (e) { merged = null; }
    const parts = merged ? [merged] : list;
    for (const geo of parts) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'rigMerged';
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.atlasRig = true;
      a.add(mesh);
    }
  }
  for (const o of drop) o.removeFromParent();
  return root;
}

