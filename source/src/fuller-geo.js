// l20p: Beans's blocky collectible shapes (models/fuller/collectibles). Geometry only: each slot keeps its own material,
// colour logic, bob/spin and value. Loaded once at boot; until a GLB is ready the old primitive is used.
import * as THREE from 'three';
import { loadGLB } from './models.js';

const KEYS = ['petal', 'bloom-bunch', 'dewdrop', 'starseed', 'glow-cube', 'bubble-cube', 'sling-gem', 'sunlamp-crystal'];
const geos = new Map();
function bake(root) {
  const pos = [], nor = [], idx = []; let base = 0; root.updateMatrixWorld(true);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const g = o.geometry, P = g.attributes.position, N = g.attributes.normal; nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos.push(v.x, v.y, v.z);
      if (N) { n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z); } else nor.push(0, 1, 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i)); else for (let i = 0; i < P.count; i++) idx.push(base + i);
    base += P.count;
  });
  if (!base) return null;
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
  out.computeBoundingBox(); const c = out.boundingBox.getCenter(new THREE.Vector3()); out.translate(-c.x, -c.y, -c.z); out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}
export function preloadFullerGeo() {
  for (const k of KEYS) if (!geos.has(k)) { geos.set(k, null); loadGLB('fuller/collectibles/' + k).then(g => { const b = g && bake(g.scene); if (b) geos.set(k, b); }).catch(() => {}); }
}
/** A blocky geometry scaled so its largest extent = size (m); falls back to fb() until loaded. */
const sized = new Map();
/** Shared per (key, size) so zones' pickup batching (keyed on geometry type + parameters) still merges same-kind pickups. */
export function fullerGeo(key, size, fb) {
  const g = geos.get(key); if (!g) return fb();
  const id = key + '@' + size; let c = sized.get(id); if (c) return c;
  const s = g.boundingBox.getSize(new THREE.Vector3()), k = size / Math.max(s.x, s.y, s.z, 1e-4);
  c = g.clone(); c.scale(k, k, k); c.computeBoundingSphere(); c.parameters = { fuller: key, size }; c.userData.fullerShared = true; sized.set(id, c); return c;
}
export const fullerReady = () => KEYS.filter(k => geos.get(k)).length;
