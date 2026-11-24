// Act 3 shared palette atlas (Squid / Noodle plan, Nov 22 2026).
// One 256² nearest-filter albedo + emissive companion. Each colour lives in an 8 px
// cell; UVs sit at the cell centre so merged chunks stay one draw regardless of colour.
import * as THREE from 'three';
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
