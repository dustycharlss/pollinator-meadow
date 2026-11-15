// Readable water (t159u): saturated blue, scrolling ripple texture + a shimmer layer, foam lines at the shore.
import * as THREE from 'three';
let tex = null, tex2 = null;
function rippleCanvas(seed) {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#e4ecff'; g.fillRect(0, 0, N, N);
  let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) { // soft wavy highlight strokes, drawn 9× so the tile wraps
    const x = R() * N, y = R() * N, w = 10 + R() * 22, a = 0.25 + R() * 0.45;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 2 + R() * 2.5;
      g.beginPath(); g.moveTo(x + ox - w / 2, y + oy); g.quadraticCurveTo(x + ox, y + oy - 4, x + ox + w / 2, y + oy); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texes() { if (!tex) { tex = rippleCanvas(7); tex2 = rippleCanvas(31); } return [tex, tex2]; }
function tick() { const t = performance.now() / 1000; tex.offset.set((t * 0.035) % 1, (t * 0.02) % 1); tex2.offset.set((-t * 0.025) % 1, (t * 0.04) % 1); }
/** a water surface mesh (top face only — no box sides to z-fight the banks) */
export function waterSurface(geo, { color = 0x1f8cff, repeat = [4, 4], lemonade = false } = {}) {
  const [a, b] = texes();
  const t1 = a.clone(), t2 = b.clone(); t1.needsUpdate = t2.needsUpdate = true; t1.repeat.set(...repeat); t2.repeat.set(repeat[0] * 0.7, repeat[1] * 0.7);
  const base = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, map: t1, emissive: lemonade ? 0x7a5200 : 0x0a62d8, emissiveIntensity: 0.45, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const shim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, map: t2, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  shim.position.y = 0.02; base.add(shim); base.renderOrder = 2; shim.renderOrder = 3;
  base.onBeforeRender = () => { const t = performance.now() / 1000; t1.offset.set((t * 0.035) % 1, (t * 0.02) % 1); t2.offset.set((-t * 0.025) % 1, (t * 0.04) % 1); };
  return base;
}
export const FOAM_MAT = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
export { tick as waterTick };
