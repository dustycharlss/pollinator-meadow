// Platformer world: solid colliders (stumps, rocks, logs, mushrooms, branches), jump routes, golden dewdrops, collision queries.
import * as THREE from 'three';
import { WORLD_R, POND, WATER_Y, SPECIES } from './data.js';

const CELL = 8;
const TAU = Math.PI * 2;

/** Spatial hash of solids. solid = {type:'cyl'|'box', x,z, r | hx,hz,c,s, y0, top, wall?, bounce?, kind}. */
export function createPhys(solids, heightAt) {
  const grid = new Map();
  const add = (s) => {
    const rad = s.type === 'cyl' ? s.r : Math.hypot(s.hx, s.hz);
    s.rad = rad;
    if (s.type === 'box') { s.c = Math.cos(s.yaw || 0); s.s = Math.sin(s.yaw || 0); }
    const x0 = Math.floor((s.x - rad) / CELL), x1 = Math.floor((s.x + rad) / CELL), z0 = Math.floor((s.z - rad) / CELL), z1 = Math.floor((s.z + rad) / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = gx + ',' + gz; (grid.get(k) || grid.set(k, []).get(k)).push(s); }
  };
  solids.forEach(add);
  const dyn = []; // moving solids (pushable logs etc.) are checked against every query
  const addDyn = (s) => { s.rad = s.type === 'cyl' ? s.r : Math.hypot(s.hx, s.hz); if (s.type === 'box') { s.c = Math.cos(s.yaw || 0); s.s = Math.sin(s.yaw || 0); } s.dyn = true; dyn.push(s); };
  const near = (x, z, cb) => { const l = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (l) for (const s of l) if (!s.off) cb(s); for (const s of dyn) if (!s.off && Math.abs(s.x - x) < s.rad + 3 && Math.abs(s.z - z) < s.rad + 3) cb(s); };
  // signed-ish distance from a point to a solid footprint: >0 outside; also returns push direction
  const out = { d: 0, nx: 0, nz: 1 };
  function foot(s, x, z) {
    if (s.type === 'cyl') { const dx = x - s.x, dz = z - s.z, l = Math.hypot(dx, dz) || 1e-6; out.d = l - s.r; out.nx = dx / l; out.nz = dz / l; return out; }
    const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
    const qx = Math.max(-s.hx, Math.min(s.hx, lx)), qz = Math.max(-s.hz, Math.min(s.hz, lz));
    let ox = lx - qx, oz = lz - qz, l = Math.hypot(ox, oz);
    if (l > 1e-6) { out.d = l; ox /= l; oz /= l; }
    else { // inside: push along the shallowest axis
      const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz);
      if (px < pz) { ox = Math.sign(lx) || 1; oz = 0; out.d = -px; } else { ox = 0; oz = Math.sign(lz) || 1; out.d = -pz; }
    }
    out.nx = ox * s.c + oz * s.s; out.nz = -ox * s.s + oz * s.c; return out;
  }
  const phys = {
    solids, add, addDyn, near, foot,
    /** Highest standable surface under (x,z) whose top is at most `tol` above feetY. Returns {y, solid|null}. */
    floor(x, z, feetY, tol = 0.6, pad = 0.12) {
      let y = Math.max(heightAt(x, z), WATER_Y + 0.12), hit = null;
      near(x, z, s => {
        if (s.wall || s.top > feetY + tol || s.top <= y) return;
        if (foot(s, x, z).d < pad) { y = s.top; hit = s; }
      });
      return { y, solid: hit };
    },
    /** Push a body (circle r, height h, feet y) out of anything solid it would bump into. Returns true if pushed. */
    resolve(p, rad, h, step = 0.55) {
      let hit = false;
      for (let pass = 0; pass < 2; pass++) near(p.x, p.z, s => {
        if (p.y + step >= s.top || p.y + h <= s.y0) return;
        const f = foot(s, p.x, p.z);
        if (f.d < rad) { const m = rad - f.d; p.x += f.nx * m; p.z += f.nz * m; hit = true; }
      });
      return hit;
    },
    /** Is a ground-level point inside a solid footprint (for placing food)? */
    blocked(x, z, pad = 0.6) { let b = false; near(x, z, s => { if (!b && !s.wall && foot(s, x, z).d < pad) b = true; }); return b; }
  };
  return phys;
}

const ROUTE_STARTS = [
  // meadow
  [-30, 28], [34, -32], [22, 62], [-48, -22], [58, 22],
  // orchard
  [-92, -64], [-122, -98], [-78, -102],
  // tropical garden
  [100, -58], [128, -92],
  // badlands
  [92, 92], [124, 74],
  // moon garden
  [-90, 80], [-126, 94],
  // woodland
  [64, -64], [-18, -108], [138, -34], [-60, 40]
];

/** Build jump routes and static platform visuals. Pushes solids onto `solids`. Returns {routes, dewdrops, update(t)}. */
export function buildPlatforms(scene, { solids, heightAt, R, nestPts, quality = 1 }) {
  const wood = new THREE.Color(0x7b5232), ring = new THREE.Color(0xd9b27a), moss = new THREE.Color(0x4f8a3a);
  const MAXN = 220;
  // --- instanced shapes (unit geometry; scaled per instance) ---
  const stumpG = new THREE.CylinderGeometry(0.86, 1, 1, 12); stumpG.translate(0, 0.5, 0);
  const stumpM = [new THREE.MeshLambertMaterial({ color: 0x8b5e3c, flatShading: true }), new THREE.MeshLambertMaterial({ color: 0xe8c48c }), new THREE.MeshLambertMaterial({ color: 0x6b4a30 })];
  const stumps = new THREE.InstancedMesh(stumpG, stumpM, MAXN);
  const rockG = new THREE.CylinderGeometry(0.78, 1, 1, 7, 2); rockG.translate(0, 0.5, 0);
  { const pa = rockG.attributes.position; for (let i = 0; i < pa.count; i++) { const k = Math.sin(i * 12.9898) * 43758.5453; const f = k - Math.floor(k); if (pa.getY(i) < 0.99 && pa.getY(i) > 0.01) { pa.setX(i, pa.getX(i) * (0.88 + f * 0.25)); pa.setZ(i, pa.getZ(i) * (0.88 + f * 0.25)); } } rockG.computeVertexNormals(); }
  const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshLambertMaterial({ color: 0x9a9a98, flatShading: true }), MAXN);
  const logG = new THREE.CylinderGeometry(0.5, 0.5, 1, 9); logG.rotateZ(Math.PI / 2); logG.translate(0, 0.5, 0);
  const logs = new THREE.InstancedMesh(logG, new THREE.MeshLambertMaterial({ color: 0x7a5636, flatShading: true }), MAXN);
  const stemG = new THREE.CylinderGeometry(0.8, 1, 1, 8); stemG.translate(0, 0.5, 0);
  const stems = new THREE.InstancedMesh(stemG, new THREE.MeshLambertMaterial({ color: 0xf1e7d0 }), MAXN);
  const capG = new THREE.SphereGeometry(1, 18, 8, 0, TAU, 0, Math.PI / 2); capG.scale(1, 0.38, 1);
  const caps = new THREE.InstancedMesh(capG, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), MAXN);
  const spotG = new THREE.SphereGeometry(1, 8, 6); // white dots on caps
  const spots = new THREE.InstancedMesh(spotG, new THREE.MeshLambertMaterial({ color: 0xfffbe8 }), MAXN * 6);
  const limbG = new THREE.BoxGeometry(1, 1, 1); limbG.translate(0, -0.5, 0);
  const limbs = new THREE.InstancedMesh(limbG, new THREE.MeshLambertMaterial({ color: 0x70492a, flatShading: true }), 60);
  const puffG = new THREE.IcosahedronGeometry(1, 1);
  const puffs = new THREE.InstancedMesh(puffG, new THREE.MeshLambertMaterial({ color: 0x5aa83e, flatShading: true }), 60);
  const cnt = { stump: 0, rock: 0, log: 0, mush: 0, spot: 0, limb: 0, puff: 0 };
  const D = new THREE.Object3D(), C = new THREE.Color();
  const put = (im, key, x, y, z, sx, sy, sz, yaw = 0, col) => { D.position.set(x, y, z); D.rotation.set(0, yaw, 0); D.scale.set(sx, sy, sz); D.updateMatrix(); im.setMatrixAt(cnt[key], D.matrix); if (col) im.setColorAt(cnt[key], col); cnt[key]++; };
  const capCols = [0xe0443a, 0xf08a2c, 0xb55bd6, 0x2fb7a6, 0xf2c230];

  const routes = [], dewdrops = [], tops = []; // tops: standable summits/centres for placing honey etc.
  const near = (x, z, m) => { for (const [nx, nz] of nestPts) if (Math.hypot(x - nx, z - nz) < m) return true; return Math.hypot(x - POND.x, z - POND.z) < POND.r * 2 || Math.hypot(x, z) > WORLD_R - 14; };

  function addPillar(type, x, z, top, rad, extra = {}) {
    const g = heightAt(x, z), base = g - 1.5, h = top - base;
    if (type === 'stump') { put(stumps, 'stump', x, base, z, rad, h, rad, R() * 6.28, C.setHSL(0.07 + R() * 0.03, 0.4, 0.8 + R() * 0.2)); solids.push({ type: 'cyl', x, z, r: rad * 0.94, y0: base, top, kind: 'stump' }); }
    else if (type === 'rock') { put(rocks, 'rock', x, base, z, rad * 1.02, h, rad * 1.02, R() * 6.28, C.setHSL(0.1, 0.05 + R() * 0.1, 0.78 + R() * 0.22)); solids.push({ type: 'cyl', x, z, r: rad * 0.88, y0: base, top, kind: 'rock' }); }
    else if (type === 'mush') {
      const capBase = top - 0.38 * rad, cc = C.setHex(capCols[(R() * capCols.length) | 0]);
      put(stems, 'mush', x, base, z, rad * 0.26, capBase + 0.1 - base, rad * 0.26, 0);
      put(caps, 'mush', x, capBase, z, rad, rad, rad, 0, cc);
      for (let k = 0; k < 5; k++) { const a = k * 1.26 + R(), d = rad * (0.2 + 0.5 * R()), hy = Math.sqrt(Math.max(0, 1 - (d / rad) ** 2)) * 0.38 * rad; put(spots, 'spot', x + Math.cos(a) * d, capBase + hy, z + Math.sin(a) * d, 0.3 * rad * 0.5, 0.08, 0.3 * rad * 0.5, 0); }
      solids.push({ type: 'cyl', x, z, r: rad * 0.9, y0: capBase - 0.3, top: top - 0.1, kind: 'mush', bounce: 15.5 });
    }
    else if (type === 'log') { const len = extra.len || 5.2, yaw = extra.yaw ?? R() * 3.14; const wz = Math.max(1.6, h * 0.95); put(logs, 'log', x, base, z, len, h, wz, yaw, C.setHSL(0.07, 0.35, 0.75 + R() * 0.25)); solids.push({ type: 'box', x, z, hx: len / 2, hz: wz * 0.5, yaw, y0: base, top: top - 0.05, kind: 'log' }); }
    else if (type === 'branch') {
      const len = extra.len || 5.5, yaw = extra.yaw ?? R() * 6.28, hx = len / 2;
      put(limbs, 'limb', x, top, z, len, 0.7, 0.85, yaw, C.setScalar(0.9 + R() * 0.15));
      // supporting trunk
      const tx = x + Math.cos(-yaw) * (hx - 0.4), tz = z + Math.sin(-yaw) * (hx - 0.4);
      put(stumps, 'stump', tx, heightAt(tx, tz) - 1.5, tz, 0.55, top - heightAt(tx, tz) + 1.0, 0.55, 0, C.setHSL(0.07, 0.3, 0.62));
      put(puffs, 'puff', x - Math.cos(-yaw) * (hx - 0.6), top + 0.6, z - Math.sin(-yaw) * (hx - 0.6), 1.4, 1.1, 1.4, 0, C.setHSL(0.27 + R() * 0.05, 0.5, 0.45 + R() * 0.1));
      solids.push({ type: 'box', x, z, hx, hz: 0.5, yaw, y0: top - 0.7, top, kind: 'branch' });
      solids.push({ type: 'cyl', x: tx, z: tz, r: 0.5, y0: base, top: top - 0.75, kind: 'trunk', wall: false });
    }
    return solids[solids.length - 1];
  }
  // puffs use instanced Icosahedron scaled - fix: cnt key lookups
  const types = ['stump', 'rock', 'mush', 'stump', 'rock', 'mush'];
  const STEP = 1.3;
  ROUTE_STARTS.forEach(([sx, sz], ri) => {
    if (near(sx, sz, 16)) return;
    let ang = R() * TAU, x = sx, z = sz, base = heightAt(sx, sz), prevTop = base, n = 5 + ((R() * 2) | 0);
    if (ri % 3 === 0) n = 6;
    const pts = [];
    for (let i = 0; i < n; i++) {
      let type = i === 0 ? 'log' : i === n - 1 ? (R() < 0.5 ? 'stump' : 'rock') : types[(ri + i) % types.length];
      if (i > 0) { ang += (R() - 0.5) * 0.9; x += Math.cos(ang) * (5.4 + R() * 0.8); z += Math.sin(ang) * (5.4 + R() * 0.8); }
      if (near(x, z, 14)) { ang += 2.4; x -= Math.cos(ang) * 4; z -= Math.sin(ang) * 4; }
      const g = heightAt(x, z);
      let top = Math.max(base + STEP * (i + 0.8), g + 0.8, prevTop + 0.9); if (top - prevTop > 1.55) top = prevTop + 1.55; prevTop = top;
      const rad = type === 'mush' ? 2.3 + R() * 0.5 : i === n - 1 ? 2.6 : 1.6 + R() * 0.6;
      const so = addPillar(type, x, z, top, rad, { len: 5.2, yaw: ang + 1.57 });
      pts.push({ x, z, top, type, rad });
      if (i === n - 1) tops.push({ x, z, top, summit: true });
      else if (i > 1 && R() < 0.45) tops.push({ x, z, top });
    }
    const last = pts[pts.length - 1];
    dewdrops.push({ id: dewdrops.length, x: last.x, y: last.top + 1.9, z: last.z, got: false, route: ri });
    routes.push(pts);
  });
  // a few extra single hops near each den so homes have something to climb
  for (const [nx, nz] of nestPts) for (let k = 0; k < 2; k++) {
    const a = R() * TAU, d = 17 + R() * 5, x = nx + Math.cos(a) * d, z = nz + Math.sin(a) * d; if (near(x, z, 14)) continue;
    const top = heightAt(x, z) + 1.0 + R() * 0.8; addPillar(R() < 0.5 ? 'stump' : 'rock', x, z, top, 1.7 + R() * 0.6); tops.push({ x, z, top });
  }
  for (const [im, key] of [[stumps, 'stump'], [rocks, 'rock'], [logs, 'log'], [stems, 'mush'], [caps, 'mush'], [spots, 'spot'], [limbs, 'limb'], [puffs, 'puff']]) {
    im.count = cnt[key]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; scene.add(im);
  }
  // --- golden dewdrops ---
  const dg = new THREE.OctahedronGeometry(0.55, 1); dg.scale(0.85, 1.35, 0.85);
  const dm = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const drops = new THREE.InstancedMesh(dg, dm, Math.max(1, dewdrops.length)); drops.frustumCulled = false; scene.add(drops);
  const haloT = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'img/star.png');
  const halos = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: haloT, size: 4.2, color: 0xffe07a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halos.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dewdrops.length * 3), 3)); halos.frustumCulled = false; scene.add(halos);
  const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const rays = new THREE.InstancedMesh(ray.geometry, ray.material, Math.max(1, dewdrops.length)); rays.frustumCulled = false; scene.add(rays);
  const out = {
    routes, dewdrops, tops, count: dewdrops.length,
    setCollected(ids) { for (const d of dewdrops) d.got = ids.includes(d.id); },
    update(t) {
      const hp = halos.geometry.attributes.position;
      dewdrops.forEach((d, i) => {
        if (d.got) { D.scale.setScalar(0); D.position.set(0, -999, 0); hp.setXYZ(i, 0, -999, 0); }
        else { D.position.set(d.x, d.y + Math.sin(t * 2 + i) * 0.25, d.z); D.rotation.set(0, t * 1.6 + i, 0); D.scale.setScalar(1); hp.setXYZ(i, d.x, D.position.y, d.z); }
        D.updateMatrix(); drops.setMatrixAt(i, D.matrix);
        if (d.got) { D.scale.setScalar(0); } else { D.position.set(d.x, d.y + 14, d.z); D.rotation.set(0, 0, 0); D.scale.setScalar(1); }
        D.updateMatrix(); rays.setMatrixAt(i, D.matrix);
      });
      drops.instanceMatrix.needsUpdate = true; rays.instanceMatrix.needsUpdate = true; hp.needsUpdate = true;
    }
  };
  out.update(0);
  return out;
}
