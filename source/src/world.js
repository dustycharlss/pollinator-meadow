import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { WORLD_R, ZONES, FLOWERS, BLOOMING, DECOR, POND, WATER_Y, WATER_PLANTS, SPECIES, FOODS } from './data.js';
import { createPhys, buildPlatforms } from './platforms.js';
import { buildFood } from './food.js';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { patchSeason } from './seasons.js';
import { SITES, siteDist } from './sites.js';

const BASE = import.meta.env.BASE_URL;
export const POLS = ['bee', 'butterfly', 'hummingbird', 'moth', 'bat', 'raccoon', 'robin', 'opossum', 'bear'];
export const polOf = (id) => SPECIES[id].pol || id; // the bumblebee shares the honeybee's flowers
// solid scenery (ground animals can stand on these): top = fraction of model height
const SOLID_DECOR = { stump: { top: 0.96, shape: 'cyl' }, stumpMoss: { top: 0.96, shape: 'cyl' }, rockLarge: { top: 0.78, shape: 'cyl' }, rockMedium: { top: 0.8, shape: 'cyl' }, logMoss: { top: 0.85, shape: 'box' }, logFungus: { top: 0.85, shape: 'box' } };
export const timeU = { value: 0 };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rawH(x, z) {
  let h = 3.0 * Math.sin(x * 0.018 + 0.5) * Math.cos(z * 0.021) + 1.6 * Math.sin(x * 0.045 + z * 0.03 + 1.3) + 0.7 * Math.sin(x * 0.11) * Math.sin(z * 0.1);
  const d = Math.hypot(x - POND.x, z - POND.z);
  h *= 1 - smooth(0, 34, 34 - d) ; // flatten around pond
  // no dry basins below water level away from the real pond (bee hive basin was reading as a flooded, unbuildable area)
  const fl = WATER_Y + 0.9, k = smooth(POND.r * 1.6, POND.r * 3, d); if (h < fl + 1.5) { const s = fl + 1.5 * Math.exp((h - fl - 1.5) / 1.5); h += (Math.max(h, s) - h) * k; }
  h -= 4.0 * Math.exp(-(d * d) / (POND.r * POND.r));
  return h;
}
for (const S of SITES) { S.base = rawH(S.x + Math.sin(S.ang) * (S.s0 + S.s1) / 2, S.z + Math.cos(S.ang) * (S.s0 + S.s1) / 2); S.reach = (S.s1 - S.s0) / 2 + S.hw + 10; S.cx = S.x + Math.sin(S.ang) * (S.s0 + S.s1) / 2; S.cz = S.z + Math.cos(S.ang) * (S.s0 + S.s1) / 2; }
export function heightAt(x, z) {
  let h = rawH(x, z);
  for (const S of SITES) {
    if (Math.abs(x - S.cx) > S.reach || Math.abs(z - S.cz) > S.reach) continue;
    const d = siteDist(S, x, z); if (d > S.hw + 9) continue;
    const w = 1 - smooth(S.hw, S.hw + 9, d); h += (S.base - h) * w;
  }
  return h;
}
function zoneWeights(x, z, out) {
  let tot = 0.18; out.set(0.22, 0.5, 0.2).multiplyScalar(0.18); // woodland base colour
  for (const zn of ZONES) {
    const d = Math.hypot(x - zn.x, z - zn.z) / zn.r;
    const w = Math.max(0, 1 - d / 1.3); const ww = w * w * (3 - 2 * w);
    out.r += zn.color[0] * ww; out.g += zn.color[1] * ww; out.b += zn.color[2] * ww; tot += ww;
  }
  out.multiplyScalar(1 / tot);
}

export async function buildWorld(scene, { quality = 1, nests = [], renderer }) {
  const world = { heightAt, colliders: [], solids: [], canopies: [], blooms: null, update: null };
  const berryBushes = [];
  const R = rng(1337);

  // ---------- sky ----------
  const hdr = await new HDRLoader().loadAsync(BASE + 'kloofendal_48d_partly_cloudy_puresky_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  scene.backgroundIntensity = 1;

  // ---------- terrain ----------
  const SEG = 150, SIZE = (WORLD_R + 20) * 2;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
  const pa = tg.attributes.position, col = new Float32Array(pa.count * 3), tmp = new THREE.Color();
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i), y = heightAt(x, z); pa.setY(i, y);
    zoneWeights(x, z, tmp);
    const n = 0.92 + 0.08 * Math.sin(x * 0.3) * Math.cos(z * 0.27);
    { const dp = Math.hypot(x - POND.x, z - POND.z); if (dp < POND.r * 1.9) tmp.lerp(new THREE.Color(0.86, 0.76, 0.5), 0.75); } // sandy shore ring only at the real pond
    col[i * 3] = tmp.r * n; col[i * 3 + 1] = tmp.g * n; col[i * 3 + 2] = tmp.b * n;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pa.count * 2).map((_, k) => { const i = k >> 1; return (k & 1 ? pa.getZ(i) : pa.getX(i)) / 12; }), 2));
  tg.computeVertexNormals();
  const gtex = await new THREE.TextureLoader().loadAsync(BASE + 'img/grass.jpg');
  gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 4;
  const ground = new THREE.Mesh(tg, patchSeason(new THREE.MeshLambertMaterial({ map: gtex, vertexColors: true }), 'ground'));
  scene.add(ground);

  // water
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r * 1.9, 40), new THREE.MeshLambertMaterial({ color: 0x4fb0e0, transparent: true, opacity: 0.78, emissive: 0x0a2a44 }));
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, WATER_Y, POND.z); scene.add(water);
  world.water = water;
  { const rim = new THREE.Mesh(new THREE.RingGeometry(POND.r * 1.9, POND.r * 2.05, 48), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.85 })); rim.rotation.x = -Math.PI / 2; rim.position.set(POND.x, WATER_Y + 0.03, POND.z); scene.add(rim); }

  // ---------- placement ----------
  const nestPts = nests.map(n => [n.x, n.z]);
  const okSpot = (x, z, water = false) => {
    if (Math.hypot(x, z) > WORLD_R - 6) return false;
    for (const [nx, nz] of nestPts) if (Math.hypot(x - nx, z - nz) < 12) return false;
    for (const S of SITES) if (siteDist(S, x, z) < S.hw + 3) return false;
    const dp = Math.hypot(x - POND.x, z - POND.z);
    if (!water && dp < POND.r * 1.5) return false;
    return true;
  };
  const gauss = () => (R() + R() + R() - 1.5) * 1.6;
  function scatter(zn, count, sigma) {
    const out = []; const k = Math.max(1, Math.round(count / 7)); const centers = [];
    for (let i = 0; i < k; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * zn.r * 0.92; centers.push([zn.x + Math.cos(a) * d, zn.z + Math.sin(a) * d]); }
    let guard = 0;
    while (out.length < count && guard++ < count * 30) {
      const c = centers[(R() * k) | 0]; const x = c[0] + gauss() * sigma, z = c[1] + gauss() * sigma;
      if (Math.hypot(x - zn.x, z - zn.z) > zn.r * 1.02 || !okSpot(x, z)) continue;
      out.push([x, z]);
    }
    return out;
  }

  const groups = []; // {key, def, list:[{x,y,z,s,yaw}]}
  const plantDefs = { ...FLOWERS, ...BLOOMING, ...DECOR };
  for (const zn of ZONES) {
    for (const [key, n] of Object.entries(zn.plants)) {
      const def = plantDefs[key]; const cnt = Math.max(2, Math.round(n * quality));
      const sigma = def.tree ? 14 : 6;
      groups.push({ key, def, zone: zn.id, list: scatter(zn, cnt, sigma).map(([x, z]) => ({ x, z, y: heightAt(x, z), s: 0.8 + R() * 0.5, yaw: R() * 6.283 })) });
    }
    for (const [key, n] of Object.entries(zn.decor || {})) {
      const def = plantDefs[key]; const cnt = Math.max(1, Math.round(n * Math.max(0.6, quality)));
      groups.push({ key, def, zone: zn.id, list: scatter(zn, cnt, 16).map(([x, z]) => ({ x, z, y: heightAt(x, z), s: 0.8 + R() * 0.5, yaw: R() * 6.283 })) });
    }
  }
  // water plants around pond
  for (const [key, n] of Object.entries(WATER_PLANTS)) {
    const list = [];
    for (let i = 0; i < n; i++) { const a = R() * 6.283, d = 2 + Math.sqrt(R()) * POND.r * 0.85; list.push({ x: POND.x + Math.cos(a) * d, z: POND.z + Math.sin(a) * d, y: WATER_Y - 0.05, s: 0.9 + R() * 0.6, yaw: R() * 6.283 }); }
    groups.push({ key, def: FLOWERS[key], zone: 'moon', list });
  }
  // outer forest ring (decor) so the edge of the world is hidden by trees and fog
  const ringKeys = ['oak', 'birch', 'maple', 'treeA', 'treeB', 'acacia'];
  const ring = {}; ringKeys.forEach(k => ring[k] = []);
  const nRing = Math.round(140 * Math.max(0.6, quality));
  for (let i = 0; i < nRing; i++) {
    const a = (i / nRing) * 6.283 + R() * 0.05, d = WORLD_R - 4 + R() * 20, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const key = ringKeys[(R() * ringKeys.length) | 0];
    ring[key].push({ x, z, y: heightAt(x, z), s: 0.9 + R() * 0.6, yaw: R() * 6.283 });
  }
  for (const k of ringKeys) groups.push({ key: k, def: DECOR[k], zone: 'ring', list: ring[k] });

  // ---------- instancing ----------
  await Promise.all([...new Set(groups.map(g => g.key))].map(k => loadGLB(k)));
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  const bloomX = [], bloomY = [], bloomZ = [], bloomR = [], bloomMask = [], bloomKey = [];
  let drawCalls = 0, tris = 0;
  for (const g of groups) {
    const gltf = await loadGLB(g.key); if (!gltf || !g.list.length) continue;
    const { parts, box } = bakeParts(gltf, { size: g.def.h, mode: 'height' });
    const isPlant = !!(FLOWERS[g.key] || BLOOMING[g.key]);
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geometry, patchSeason(lambertFrom(p.material), 'prop'), g.list.length);
      g.list.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z); dummy.rotation.set((R() - 0.5) * 0.14, it.yaw, (R() - 0.5) * 0.14); dummy.scale.setScalar(it.s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (isPlant && !g.def.tree) c.setHSL(R(), 0.18 * R(), 0.9 + R() * 0.1); else c.setScalar(0.88 + R() * 0.12);
        im.setColorAt(i, c);
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      scene.add(im); drawCalls++; tris += (p.geometry.index ? p.geometry.index.count / 3 : p.geometry.attributes.position.count / 3) * g.list.length;
    }
    const sd = SOLID_DECOR[g.key], bw = box.max.x - box.min.x, bd = box.max.z - box.min.z;
    for (const it of g.list) {
      if (g.key === 'bushBerries' || g.key === 'raspberry' || g.key === 'blueberry') berryBushes.push({ x: it.x, z: it.z });
      if (sd) {
        const top = it.y + g.def.h * it.s * sd.top;
        if (sd.shape === 'cyl') world.solids.push({ type: 'cyl', x: it.x, z: it.z, r: Math.max(0.7, 0.5 * Math.min(bw, bd) * it.s * 0.82), y0: it.y - 1.5, top, kind: 'decor' });
        else world.solids.push({ type: 'box', x: it.x, z: it.z, hx: bw * 0.5 * it.s * 0.9, hz: Math.max(0.6, bd * 0.5 * it.s * 0.8), yaw: it.yaw, y0: it.y - 1.5, top, kind: 'decor' });
      }
      if (g.def.tree) { world.colliders.push({ x: it.x, z: it.z, r: Math.max(0.5, g.def.h * 0.03 * it.s), top: g.def.h * it.s * 0.5 });
        // playtest-01 H2: canopy volume for the camera occlusion pull-in (lower 30% is trunk)
        world.canopies.push({ x: it.x, z: it.z, y0: it.y + g.def.h * it.s * 0.3, y1: it.y + g.def.h * it.s * 1.02, r: Math.max(1, 0.5 * Math.max(bw, bd) * it.s * 0.85) }); }
      if (g.def.pol) {
        let m = 0; g.def.pol.forEach(p => m |= 1 << POLS.indexOf(p));
        const bh = g.def.h * it.s * (g.def.bloomY ?? 0.95);
        bloomX.push(it.x); bloomY.push(it.y + bh); bloomZ.push(it.z); bloomR.push(g.def.r || 0); bloomMask.push(m); bloomKey.push(g.key);
      }
    }
  }
  world.stats = { drawCalls, tris: Math.round(tris), blooms: bloomX.length };

  // ---------- platformer: solids, routes, food ----------
  for (const c of world.colliders) world.solids.push({ type: 'cyl', x: c.x, z: c.z, r: Math.max(0.5, c.r), y0: -99, top: heightAt(c.x, c.z) + c.top, wall: true, kind: 'tree' });
  world.solids.push({ type: 'cyl', x: POND.x, z: POND.z, r: POND.r * 0.96, y0: -99, top: 2.4, wall: true, kind: 'pond' });
  const nestSpots = {}; for (const [id, sp] of Object.entries(SPECIES)) nestSpots[id] = sp.nest;
  world.platforms = buildPlatforms(scene, { solids: world.solids, heightAt, R, nestPts, quality });
  world.phys = createPhys(world.solids, heightAt);
  const isGood = (x, z) => Math.hypot(x, z) < WORLD_R - 12 && Math.hypot(x - POND.x, z - POND.z) > POND.r * 1.5;
  world.food = await buildFood(scene, { R, heightAt, phys: world.phys, solids: world.solids, colliders: world.colliders, groupsLists: { berryBushes }, nestSpots, tops: world.platforms.tops, quality, isGood });
  const foodOff = bloomX.length;
  for (const e of world.food.entries) { bloomX.push(e.x); bloomY.push(e.y); bloomZ.push(e.z); bloomR.push(0); let m = 0; FOODS[e.kind].who.forEach(id => m |= 1 << POLS.indexOf(id)); bloomMask.push(m); bloomKey.push('food:' + e.kind); }
  world.food.off = foodOff;

  // ---------- grass tufts (instanced, swaying) ----------
  {
    const blades = 5, pos = [], colr = [], idx = [];
    for (let b = 0; b < blades; b++) {
      const a = b / blades * 3.14159 + R() * 0.4, ox = (R() - 0.5) * 0.5, oz = (R() - 0.5) * 0.5, lean = 0.25 + R() * 0.3;
      const dx = Math.cos(a) * 0.13, dz = Math.sin(a) * 0.13, h = 0.7 + R() * 0.5, v = pos.length / 3;
      pos.push(ox - dx, 0, oz - dz, ox + dx, 0, oz + dz, ox + Math.sin(a) * lean, h, oz - Math.cos(a) * lean);
      colr.push(0.45, 0.55, 0.4, 0.45, 0.55, 0.4, 1.05, 1.15, 0.8); idx.push(v, v + 1, v + 2);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); gg.setIndex(idx);
    gg.computeVertexNormals();
    const gm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = timeU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 ip = instanceMatrix[3];
          float sw = sin(uTime * 1.7 + ip.x * 0.21 + ip.z * 0.17);
          transformed.x += sw * 0.22 * position.y; transformed.z += cos(uTime * 1.3 + ip.x * 0.13) * 0.14 * position.y;`);
    };
    patchSeason(gm, 'grass');
    const N = Math.round(11000 * quality);
    const im = new THREE.InstancedMesh(gg, gm, N), cc = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < N && tries < N * 3; tries++) {
      const a = R() * 6.283, d = Math.sqrt(R()) * (WORLD_R + 5), x = Math.cos(a) * d, z = Math.sin(a) * d;
      const dp = Math.hypot(x - POND.x, z - POND.z); if (dp < POND.r * 1.4) continue;
      zoneWeights(x, z, cc);
      if (cc.r > 0.7 && R() < 0.85) continue; // sparse in desert
      dummy.position.set(x, heightAt(x, z) - 0.05, z); dummy.rotation.set(0, R() * 6.28, 0); dummy.scale.set(0.9 + R() * 0.6, 0.55 + R() * 0.8, 0.9 + R() * 0.6); dummy.updateMatrix();
      im.setMatrixAt(n, dummy.matrix); cc.multiplyScalar(0.95 + R() * 0.25).addScalar(0.05); im.setColorAt(n, cc); n++;
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.frustumCulled = false;
    scene.add(im);
  }

  // ---------- bloom registry, grid, sparkles ----------
  const nB = bloomX.length;
  const B = { n: nB, x: Float32Array.from(bloomX), y: Float32Array.from(bloomY), z: Float32Array.from(bloomZ), r: Float32Array.from(bloomR), mask: Uint16Array.from(bloomMask), key: bloomKey, readyAt: new Float32Array(nB) };
  const CELL = 12, grid = new Map();
  for (let i = 0; i < nB; i++) { const k = Math.floor(B.x[i] / CELL) + ',' + Math.floor(B.z[i] / CELL); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  B.query = (x, z, rad, cb) => {
    const x0 = Math.floor((x - rad) / CELL), x1 = Math.floor((x + rad) / CELL), z0 = Math.floor((z - rad) / CELL), z1 = Math.floor((z + rad) / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const l = grid.get(gx + ',' + gz); if (l) for (const i of l) cb(i); }
  };
  B.byPol = {}; POLS.forEach((p, bi) => { const a = []; for (let i = 0; i < nB; i++) if (B.mask[i] & (1 << bi)) a.push(i); B.byPol[p] = Int32Array.from(a); });
  world.blooms = B; world.food.install(B);
  B.isFood = (i) => i >= foodOff; B.foodAt = (i) => world.food.entries[i - foodOff];

  const sg = new THREE.BufferGeometry();
  const spos = new Float32Array(nB * 3), seed = new Float32Array(nB), on = new Float32Array(nB);
  for (let i = 0; i < nB; i++) { spos[i * 3] = B.x[i]; spos[i * 3 + 1] = B.y[i] + 0.35; spos[i * 3 + 2] = B.z[i]; seed[i] = R(); }
  sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const onAttr = new THREE.BufferAttribute(on, 1); onAttr.setUsage(THREE.DynamicDrawUsage); sg.setAttribute('aOn', onAttr);
  sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);
  const starTex = await new THREE.TextureLoader().loadAsync(BASE + 'img/star.png');
  const sm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: timeU, uMap: { value: starTex }, uColor: { value: new THREE.Color(1, 0.85, 0.3) }, uScale: { value: 600 }, uSize: { value: 2.2 }, uBoost: { value: 1 } },
    vertexShader: `attribute float aOn; attribute float aSeed; uniform float uTime,uScale,uSize,uBoost; varying float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position + vec3(0.,0.25*sin(uTime*2.0+aSeed*30.),0.),1.); gl_Position = projectionMatrix*mv;
        float tw = 0.72+0.28*sin(uTime*3.3+aSeed*50.);
        float d = -mv.z; gl_PointSize = aOn>0.5 ? clamp(uSize*uBoost*tw*uScale/d, 9.0, 120.0) : 0.0;
        vA = aOn * smoothstep(190.0,110.0,d) * (0.6+0.4*tw); }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
      void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor*(0.6+t.rgb*0.8), t.a*vA); if(gl_FragColor.a<0.01) discard; }`
  });
  const sparkles = new THREE.Points(sg, sm); sparkles.frustumCulled = false; sparkles.renderOrder = 5; scene.add(sparkles);
  const bit = {}; POLS.forEach((p, i) => bit[p] = 1 << i);
  world.sparkle = {
    species: 'bee',
    setSpecies(id, now) {
      this.species = id; const b = bit[polOf(id)], g = SPECIES[id].glow;
      sm.uniforms.uColor.value.setRGB(g[0], g[1], g[2]);
      for (let i = 0; i < nB; i++) on[i] = (B.mask[i] & b) && B.readyAt[i] <= now ? 1 : 0;
      onAttr.needsUpdate = true;
    },
    set(i, v) { on[i] = v ? 1 : 0; onAttr.needsUpdate = true; },
    isOn: (i) => on[i] > 0.5,
    mat: sm
  };

  world.resize = (h, fov) => { sm.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)); };
  return world;
}
