// Territory: the meadow you have tended. A coarse field texture (distance to the nearest claimed disc) drives
//  - a soft glowing overlay on the ground (lush tint + gold border),
//  - flowers that bloom up inside the claim,
//  - the score tick and the territory %.
// Territory is only ever *wild meadow* that blooms around your homes and outposts - nobody loses anything.
import * as THREE from 'three';
import { WORLD_R, POND, WATER_Y } from './data.js';
import { SITES } from './sites.js';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { patchSeason } from './seasons.js';
import { timeU } from './world.js';

const RES = 128, HALF = 180, TEX = (HALF * 2) / RES; // texel size ~2.8 world units
const BLOOMS = [['daisyG', 2.1], ['tulip', 2.7], ['poppies', 2.1], ['iris', 2.9], ['flowerSingle', 2.3], ['redflower', 2.5], ['sunflowerJ', 3.6], ['purpleLong', 3.0]];
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const back = x => { x = Math.min(1, Math.max(0, x)); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export async function createTerritory(scene, { heightAt, nestPts, quality = 1 }) {
  const sources = []; // {id, kind:'home'|'outpost'|'all'|'rival', x, z, r, rMax, rate, owner:0}
  const field = new Uint8Array(RES * RES);
  const owners = new Uint8Array(RES * RES); // 0 = none/player claim, 1.. = rival owner id
  const tex = new THREE.DataTexture(field, RES, RES, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  const T = { sources, pct: 0, cells: 0, total: 0, dirty: true, growMul: 1, rev: 0, debug: false, all: false, rivalPct: 0 };
  // circle texels count
  let total = 0; for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) { const x = -HALF + (i + 0.5) * TEX, z = -HALF + (j + 0.5) * TEX; if (Math.hypot(x, z) < WORLD_R) total++; }
  T.total = total;

  // ---- overlay mesh
  const SEG = Math.round(120 * Math.max(0.75, quality)), SPAN = (WORLD_R + 14) * 2;
  const geo = new THREE.PlaneGeometry(SPAN, SPAN, SEG, SEG); geo.rotateX(-Math.PI / 2);
  { const pa = geo.attributes.position; const h = new Float32Array(pa.count); for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), y = heightAt(x, z); h[i] = y; pa.setY(i, Math.max(y, WATER_Y) + 0.16); } geo.setAttribute('aH', new THREE.BufferAttribute(h, 1)); }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: { uF: { value: tex }, uTime: timeU, uNight: { value: 0 }, uGrid: { value: 0 }, uHalf: { value: HALF }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `attribute float aH; varying vec3 vW; varying float vH; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vH = aH; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uF; uniform float uTime,uNight,uGrid,uHalf; uniform vec3 uCam; varying vec3 vW; varying float vH;
      void main(){
        if (vH < ${(WATER_Y + 0.15).toFixed(2)}) discard;
        vec2 uv = (vW.xz + uHalf) / (uHalf * 2.0); float v = texture2D(uF, uv).r;
        float fill = smoothstep(0.47, 0.53, v);
        float edge = 1.0 - smoothstep(0.0, 0.085, abs(v - 0.5));
        float dash = 0.7 + 0.3 * sin((vW.x + vW.z) * 0.9 - uTime * 1.6);
        float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + vW.x * 0.05);
        vec3 lush = vec3(0.42, 0.88, 0.32), gold = vec3(1.0, 0.86, 0.42);
        float fad = 1.0 - smoothstep(130.0, 260.0, distance(vW.xz, uCam.xz));
        vec3 col = mix(lush, gold, edge); float a = fill * 0.2 + edge * 0.85 * dash * pulse;
        if (uGrid > 0.5) { vec2 g = abs(fract(vW.xz / 5.0 - 0.5) - 0.5); float ln = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y)); col = mix(col, vec3(0.2, 1.0, 1.0), ln * 0.8); a = max(a, ln * (0.12 + 0.55 * fill)); a = max(a, 0.05 * (1.0 - fill)); }
        a *= fad; col *= mix(1.0, 0.55, uNight);
        if (a < 0.01) discard; gl_FragColor = vec4(col, a);
      }`
  });
  const overlay = new THREE.Mesh(geo, mat); overlay.renderOrder = 2; overlay.frustumCulled = false; scene.add(overlay);
  T.overlay = overlay; T.mat = mat;

  // ---- field build
  function rebuild() {
    field.fill(0); owners.fill(0); let cells = 0, rivalCells = 0;
    for (const s of sources) {
      const R = s.r + 8; if (R <= 8.001 && s.r <= 0) continue;
      const own = s.owner | 0;
      const i0 = Math.max(0, Math.floor((s.x - R + HALF) / TEX)), i1 = Math.min(RES - 1, Math.floor((s.x + R + HALF) / TEX));
      const j0 = Math.max(0, Math.floor((s.z - R + HALF) / TEX)), j1 = Math.min(RES - 1, Math.floor((s.z + R + HALF) / TEX));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = -HALF + (i + 0.5) * TEX, z = -HALF + (j + 0.5) * TEX, sd = s.r - Math.hypot(x - s.x, z - s.z);
        const v = Math.max(0, Math.min(255, Math.round((0.5 + sd / 16) * 255)));
        const idx = j * RES + i;
        if (v > field[idx]) { field[idx] = v; owners[idx] = own; }
      }
    }
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) if (field[j * RES + i] >= 128) {
      const x = -HALF + (i + 0.5) * TEX, z = -HALF + (j + 0.5) * TEX;
      if (Math.hypot(x, z) < WORLD_R) { cells++; if (owners[j * RES + i] > 0) rivalCells++; }
    }
    T.cells = cells; T.pct = 100 * Math.max(0, cells - rivalCells) / total; T.rivalPct = 100 * rivalCells / total;
    tex.needsUpdate = true; T.dirty = false; T.rev++; bloomCheck = true;
  }
  /** signed-ish coverage at a point: >0.5 inside. */
  T.valueAt = (x, z) => {
    const fx = (x + HALF) / TEX - 0.5, fz = (z + HALF) / TEX - 0.5, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= RES - 1 || j >= RES - 1) return 0;
    const u = fx - i, w = fz - j, a = field[j * RES + i], b = field[j * RES + i + 1], c = field[(j + 1) * RES + i], d = field[(j + 1) * RES + i + 1];
    return ((a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w) / 255;
  };
  /** distance (world units) the point lies inside the claim; negative = outside. */
  T.depth = (x, z) => (T.valueAt(x, z) - 0.5) * 16;
  T.inside = (x, z, slack = 0) => T.depth(x, z) > -slack;
  T.ownerAt = (x, z) => {
    const fx = (x + HALF) / TEX - 0.5, fz = (z + HALF) / TEX - 0.5, i = Math.floor(fx + 0.5), j = Math.floor(fz + 0.5);
    if (i < 0 || j < 0 || i >= RES || j >= RES) return 0;
    return owners[j * RES + i] | 0;
  };
  T.edgeDist = (x, z) => -T.depth(x, z); // positive = outside claim

  // ---- sources
  T.setSource = (id, kind, x, z, r, rMax, rate = 0, owner = 0) => { let s = sources.find(q => q.id === id); if (!s) { s = { id, kind, x, z, r, rMax: rMax ?? r, rate, owner: owner|0 }; sources.push(s); } else Object.assign(s, { kind, x, z, r, rMax: rMax ?? r, rate, owner: owner|0 }); T.dirty = true; return s; };
  T.get = id => sources.find(q => q.id === id);
  T.remove = id => { const i = sources.findIndex(q => q.id === id); if (i >= 0) { sources.splice(i, 1); T.dirty = true; } };
  T.removeKind = kind => { for (let i = sources.length - 1; i >= 0; i--) if (sources[i].kind === kind) sources.splice(i, 1); T.dirty = true; };
  T.claimAll = on => { T.all = on; if (on) T.setSource('all', 'all', 0, 0, WORLD_R + 20, WORLD_R + 20); else T.remove('all'); };
  T.grow = (id, dr) => { const s = T.get(id); if (s) { s.r = Math.min(s.rMax, s.r + dr); T.dirty = true; } };
  T.setRMax = (id, rMax) => { const s = T.get(id); if (s) { s.rMax = rMax; T.dirty = true; } };
  T.setR = (id, r) => { const s = T.get(id); if (s) { s.r = r; if (s.rMax < r) s.rMax = r; T.dirty = true; } };
  T.setDebug = on => { T.debug = on; mat.uniforms.uGrid.value = on ? 1 : 0; };

  // ---- bloom candidates + instanced flowers
  const types = [];
  for (const [key, h] of BLOOMS) {
    const g = await loadGLB(key); const ty = { key, n: 0, meshes: [] };
    if (g) { const { parts } = bakeParts(g, { size: h, mode: 'height' }); for (const p of parts) { const im = new THREE.InstancedMesh(p.geometry, patchSeason(lambertFrom(p.material), 'prop'), 520); im.count = 0; im.frustumCulled = false; scene.add(im); ty.meshes.push(im); } }
    types.push(ty);
  }
  const rnd = mulberry(7717), cands = [], NC = Math.round(2400 * Math.max(0.6, quality));
  for (let k = 0; k < NC * 3 && cands.length < NC; k++) {
    const a = rnd() * 6.2832, r = Math.sqrt(rnd()) * (WORLD_R - 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3) continue;
    if (nestPts.some(n => Math.hypot(n[0] - x, n[1] - z) < 5)) continue;
    let bad = false; for (const S of SITES) { const ux = Math.sin(S.ang), uz = Math.cos(S.ang), dx = x - S.x, dz = z - S.z, s = Math.max(S.s0, Math.min(S.s1, dx * ux + dz * uz)); if (Math.hypot(dx - ux * s, dz - uz * s) < S.hw + 1) { bad = true; break; } } if (bad) continue;
    const ty = Math.floor(rnd() * types.length); if (!types[ty].meshes.length) continue;
    cands.push({ x, z, y: heightAt(x, z), yaw: rnd() * 6.28, sc: 0.75 + rnd() * 0.6, ty, need: 0.6 + rnd() * 0.12, delay: rnd() * 1.4, slot: -1, t0: 0 });
  }
  const grow = [], dummy = new THREE.Object3D(); let bloomCheck = true, spawned = 0;
  function put(c, k) {
    const ty = types[c.ty]; dummy.position.set(c.x, c.y - 0.05, c.z); dummy.rotation.set(0, c.yaw, 0); dummy.scale.setScalar(Math.max(1e-3, c.sc * k)); dummy.updateMatrix();
    for (const m of ty.meshes) { m.setMatrixAt(c.slot, dummy.matrix); m.instanceMatrix.needsUpdate = true; }
  }
  function spawnCheck(now) {
    bloomCheck = false;
    for (const c of cands) {
      if (c.slot >= 0) continue; if (T.valueAt(c.x, c.z) < c.need) continue; if (T.ownerAt(c.x, c.z) > 0) continue;
      const ty = types[c.ty]; if (ty.n >= 520) continue; c.slot = ty.n++; for (const m of ty.meshes) m.count = ty.n; c.t0 = now + c.delay; put(c, 0); grow.push(c); spawned++;
    }
  }
  T.blooms = () => spawned;
  /** forget all blooms (clear territory) */
  T.resetBlooms = () => { for (const ty of types) { ty.n = 0; for (const m of ty.meshes) m.count = 0; } for (const c of cands) c.slot = -1; grow.length = 0; spawned = 0; bloomCheck = true; };

  let acc = 0, tClock = 0;
  T.update = (dt, camPos, night) => {
    tClock += dt; acc += dt;
    let any = false;
    for (const s of sources) if (s.rate > 0 && s.r < s.rMax) { s.r = Math.min(s.rMax, s.r + s.rate * T.growMul * dt * (s.tend > 0 ? 2.4 : 1)); any = true; }
    if (any) T.dirty = true;
    if (T.dirty && (acc > 0.2 || T.rev === 0)) { acc = 0; rebuild(); }
    if (bloomCheck && !T.dirty) spawnCheck(tClock);
    for (let i = grow.length - 1; i >= 0; i--) { const c = grow[i], k = (tClock - c.t0) / 1.1; if (k < 0) continue; if (k >= 1) { put(c, 1); grow.splice(i, 1); } else put(c, back(k)); }
    mat.uniforms.uNight.value = night; mat.uniforms.uCam.value.copy(camPos);
  };
  T.rebuild = rebuild; T.refresh = () => { rebuild(); spawnCheck(tClock); };
  T.fieldDebug = () => { let n = 0; for (let k = 0; k < field.length; k++) if (field[k] >= 128) n++; return n; };
  return T;
}
