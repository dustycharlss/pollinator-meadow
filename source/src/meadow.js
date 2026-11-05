// The meadow responds to you: every unit deposited at a home grows flowers around it, solved puzzles leave a ring of
// blooms, drifting petals/leaves grow with the meadow's bloom level, and fireflies gather around grown-up homes at night.
import * as THREE from 'three';
import { SPECIES, SPECIES_ORDER } from './data.js';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { patchSeason } from './seasons.js';
import { heightAt } from './world.js';
import { SITES, siteDist } from './sites.js';

// [glb, height]  - shared instanced flowers; each home picks a theme of three
const TYPES = [['daisyG', 2.3], ['tulip', 3.0], ['poppies', 2.4], ['iris', 3.2], ['redflower', 2.7], ['purpleLong', 3.4], ['flowerSingle', 2.5], ['flower9d', 2.6], ['mushroom1', 1.5], ['sunflowerJ', 4.2], ['bell', 2.6]];
const THEME = { bee: [0, 2, 6], bumblebee: [3, 0, 7], butterfly: [7, 1, 6], hummingbird: [4, 1, 10], moth: [5, 3, 10], bat: [5, 10, 3], raccoon: [8, 2, 6], robin: [6, 0, 2], opossum: [8, 7, 3], bear: [9, 1, 0] };
const PUZ_THEME = [0, 1, 2, 3, 4, 6, 7];
const HOME_MAX = 110, CAP = 420;
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const back = x => { x = Math.min(1, Math.max(0, x)); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

function softTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  if (kind === 'soft') { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  else { g.translate(32, 32); g.rotate(-0.6); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 26, 12, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-26, -1, 52, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function buildMeadow(scene, nests, save) {
  const types = [];
  for (const [key, h] of TYPES) {
    const g = await loadGLB(key); const T = { key, n: 0, meshes: [], dirty: false };
    if (g) { const { parts } = bakeParts(g, { size: h, mode: 'height' }); for (const p of parts) { const im = new THREE.InstancedMesh(p.geometry, patchSeason(lambertFrom(p.material), 'prop'), CAP); im.count = 0; im.frustumCulled = false; scene.add(im); T.meshes.push(im); } }
    types.push(T);
  }
  const dummy = new THREE.Object3D(), anims = [];
  const homes = {}, gardens = {};
  const nestPts = SPECIES_ORDER.map(id => [nests[id].x, nests[id].z]);
  const placeOK = (x, z, own) => {
    if (heightAt(x, z) < -0.4) return false;
    for (const [nx, nz] of nestPts) if (nx !== own[0] && Math.hypot(x - nx, z - nz) < 12) return false;
    for (const S of SITES) if (siteDist(S, x, z) < S.hw + 0.5) return false;
    return true;
  };
  function makeGarden(id, count, gen, theme, seed) {
    const r = mulberry(seed), items = [];
    for (let i = 0; i < count; i++) for (let k = 0; k < 14; k++) { const q = gen(i, r); if (q && placeOK(q.x, q.z, q.own || [1e9, 1e9])) { q.type = theme[Math.floor(r() * theme.length)]; q.s = 0.8 + r() * 0.55; q.yaw = r() * 6.28; q.y = heightAt(q.x, q.z); items.push(q); break; } }
    return gardens[id] = { id, items, n: 0 };
  }
  function spawn(g, animate, delay = 0) {
    const it = g.items[g.n++]; if (!it) return false; const T = types[it.type]; if (T.n >= CAP) return false;
    it.slot = T.n++; for (const m of T.meshes) m.count = T.n;
    if (animate) anims.push({ it, t: -delay, dur: 0.7 }); else put(it, 1);
    return true;
  }
  function put(it, k) { const T = types[it.type]; dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(0, it.yaw, 0); dummy.scale.setScalar(Math.max(0.001, it.s * k)); dummy.updateMatrix(); for (const m of T.meshes) { m.setMatrixAt(it.slot, dummy.matrix); m.instanceMatrix.needsUpdate = true; } }
  // ---- home gardens
  for (const id of SPECIES_ORDER) {
    const n = nests[id], own = [n.x, n.z];
    homes[id] = { id, stage: 0, ff: [] };
    makeGarden('h:' + id, HOME_MAX, (i, r) => { const a = i * 2.39996 + r() * 0.5, rad = 9.8 + 9.5 * Math.sqrt((i + 1) / HOME_MAX) + r() * 1.6; return { x: n.x + Math.cos(a) * rad, z: n.z + Math.sin(a) * rad, own }; }, THEME[id], 1000 + id.length * 77 + id.charCodeAt(0));
  }
  const unitsToFlowers = u => Math.min(HOME_MAX, Math.round(u * 2.4));
  function setUnits(id, units, animate) {
    const g = gardens['h:' + id], want = unitsToFlowers(units); let k = 0;
    while (g.n < want) { if (!spawn(g, animate, animate ? 0.05 + k * 0.045 : 0)) break; k++; }
    return k;
  }
  function setStage(id, stage) { homes[id].stage = stage; }
  // ---- puzzle blooms: a ring of flowers around a solved puzzle
  function bloomPuzzle(id, animate) {
    const S = SITES.find(s => s.id === id); if (!S || gardens['p:' + id]) return;
    const g = makeGarden('p:' + id, 34, (i, r) => { const cx = S.x + Math.sin(S.ang) * (S.s0 + S.s1) / 2, cz = S.z + Math.cos(S.ang) * (S.s0 + S.s1) / 2, ext = (S.s1 - S.s0) / 2 + S.hw + 8; const x = cx + (r() * 2 - 1) * ext, z = cz + (r() * 2 - 1) * ext, d = siteDist(S, x, z); return d > S.hw + 1.3 && d < S.hw + 8 ? { x, z } : null; }, PUZ_THEME, 5000 + id.length * 31 + id.charCodeAt(1));
    for (let i = 0; i < g.items.length; i++) spawn(g, animate, animate ? i * 0.06 : 0);
  }
  // ---- fireflies around grown homes (night only)
  const FF = 14, ffN = SPECIES_ORDER.length * FF, ffPos = new Float32Array(ffN * 3).fill(-9999), ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3)); ffGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const ffTex = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'img/star.png');
  const ffMat = new THREE.PointsMaterial({ map: ffTex, size: 0.9, color: 0xd6ff7a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const ffPts = new THREE.Points(ffGeo, ffMat); ffPts.frustumCulled = false; scene.add(ffPts);
  // ---- drifting petals / leaves / snow (camera-anchored)
  const DN = 260, dPos = new Float32Array(DN * 3), dPh = new Float32Array(DN), R = 46;
  for (let i = 0; i < DN; i++) { dPos[i * 3] = (Math.random() * 2 - 1) * R; dPos[i * 3 + 1] = Math.random() * 26; dPos[i * 3 + 2] = (Math.random() * 2 - 1) * R; dPh[i] = Math.random() * 6.28; }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3)); dGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5); dGeo.setDrawRange(0, 0);
  const TEX = { petal: softTex('petal'), soft: softTex('soft') };
  const dMat = new THREE.PointsMaterial({ map: TEX.petal, size: 0.8, color: 0xffc0d8, transparent: true, opacity: 0.9, depthWrite: false, alphaTest: 0.05 });
  const dPts = new THREE.Points(dGeo, dMat); dPts.frustumCulled = false; dPts.renderOrder = 5; scene.add(dPts);
  const DM = { petal: { c: 0xffc0d8, tex: 'petal', size: 0.8, fall: 1.1, sway: 1.6 }, leaf: { c: 0xe0902a, tex: 'petal', size: 1.0, fall: 1.7, sway: 2.2 }, snow: { c: 0xffffff, tex: 'soft', size: 0.7, fall: 2.6, sway: 0.8 }, none: { c: 0xffffff, tex: 'soft', size: 0.5, fall: 1, sway: 1 } };
  let dMode = 'none', dAmt = 0, dCol = new THREE.Color();
  const drift = { set(mode, amt) { if (mode !== dMode) { dMode = mode; const m = DM[mode]; dMat.map = TEX[m.tex]; dMat.size = m.size; dMat.needsUpdate = true; } dAmt = amt; dGeo.setDrawRange(0, mode === 'none' ? 0 : Math.round(DN * Math.max(0, Math.min(1, amt)))); } };
  const level = () => SPECIES_ORDER.reduce((a, id) => a + nests[id].stage, 0), maxLevel = SPECIES_ORDER.length * 3;
  function update(dt, t, cam, night, wind = 1) {
    if (anims.length) {
      for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; a.t += dt; if (a.t < 0) { put(a.it, 0); continue; } const k = Math.min(1, a.t / a.dur); put(a.it, back(k)); if (k >= 1) { put(a.it, 1); anims.splice(i, 1); } }
    }
    // fireflies
    const on = night > 0.15; ffMat.opacity = Math.min(0.95, night * 1.2); ffPts.visible = on;
    if (on) SPECIES_ORDER.forEach((id, hi) => { const h = homes[id], n = nests[id], cnt = h.stage >= 3 ? FF : h.stage >= 2 ? 7 : 0; for (let k = 0; k < FF; k++) { const j = (hi * FF + k) * 3; if (k >= cnt) { ffPos[j + 1] = -9999; continue; } const a = k * 1.7 + t * (0.18 + (k % 4) * 0.05), r = 6 + (k % 5) * 2.2 + Math.sin(t * 0.7 + k) * 1.2; ffPos[j] = n.x + Math.cos(a) * r; ffPos[j + 2] = n.z + Math.sin(a) * r; ffPos[j + 1] = n.y + 1.4 + (k % 4) * 0.9 + Math.sin(t * 1.3 + k * 2.1) * 0.6; } }), ffGeo.attributes.position.needsUpdate = true;
    // drifting particles
    if (dMode !== 'none' && dAmt > 0) {
      const m = DM[dMode], n = dGeo.drawRange.count; const cx = cam.x, cy = cam.y, cz = cam.z;
      for (let i = 0; i < n; i++) {
        const j = i * 3, ph = dPh[i];
        dPos[j] += (Math.sin(t * 0.6 + ph) * m.sway + 1.2 * wind) * dt; dPos[j + 2] += (Math.cos(t * 0.5 + ph * 1.3) * m.sway * 0.7 + 0.5 * wind) * dt; dPos[j + 1] -= m.fall * (0.7 + 0.3 * Math.sin(ph * 3)) * dt;
        let ry = dPos[j + 1] - (cy - 10);
        if (dPos[j] - cx > R) dPos[j] -= 2 * R; else if (dPos[j] - cx < -R) dPos[j] += 2 * R;
        if (dPos[j + 2] - cz > R) dPos[j + 2] -= 2 * R; else if (dPos[j + 2] - cz < -R) dPos[j + 2] += 2 * R;
        if (ry < 0) dPos[j + 1] += 30; else if (ry > 30) dPos[j + 1] -= 30;
      }
      dGeo.attributes.position.needsUpdate = true;
      dCol.setHex(m.c).multiplyScalar(1 - 0.55 * night); dMat.color.copy(dCol); dMat.opacity = dMode === 'snow' ? 0.95 : 0.85;
    }
  }
  return { setUnits, setStage, bloomPuzzle, update, drift, level, maxLevel, homes, gardens, types, count: () => types.reduce((a, T) => a + T.n, 0) };
}
