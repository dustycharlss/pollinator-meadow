// Art pass (Nov 14, 2026): ambient background critters from Beans (assets-incoming/critters, CC0, palette B).
// Background props only: never interactable, kept out of the player's path, slow clips and slow wander (README motion rules).
// Per-tier caps follow the perf audit budgets: low 6, med 12, high 18, ultra 26 critters. Each type is baked once into one
// merged vertex-colour mesh per animated node (a butterfly is 3 draw calls, not 10), then cloned per instance. Step 6 instances same-kind atlas-rig parts (per bone) across those clones and copies matrixWorld each update, so a flock of 3 bats is 1 draw per part, not 3.
import * as THREE from 'three';
import { loadGLB } from './models.js';
import { mergeAtlasRig } from './act3-atlas.js';
import FULLER_MIX from './critter-mix.json';
import { cutFor } from './fuller-decor.js';

// size = target longest extent in game metres (the player bee is 1.35 m); fly = [min,max] height; spd = m/s cap; r = wander leash
export const CRITTERS = {
  butterfly: { size: 0.7, fly: [0.6, 1.4], spd: 0.3, r: 5, day: 1 },
  'small-bird': { size: 0.7, fly: [1.0, 2.2], spd: 0.35, r: 8, day: 1, perch: true },
  ladybug: { size: 0.35, ground: true, spd: 0.07, r: 1.2, day: 1 },
  snail: { size: 0.55, ground: true, spd: 0.03, r: 0.8, day: 1 },
  frog: { size: 0.55, ground: true, spd: 0.08, r: 1.5, day: 1, hop: true },
  dragonfly: { size: 0.75, fly: [0.5, 1.5], spd: 0.3, r: 5, day: 1, hover: true },
  firefly: { size: 0.22, fly: [0.4, 1.2], spd: 0.15, r: 3, night: 1, glow: true },
  moth: { size: 0.6, fly: [0.5, 1.5], spd: 0.22, r: 4, night: 1 },
  bat: { size: 1.0, fly: [2.0, 4.0], spd: 0.33, r: 9, night: 1, cave: true },
  'ember-sprite': { size: 0.28, fly: [0.3, 1.0], spd: 0.12, r: 2.5, always: 1, glow: true },
  fish: { size: 0.5, swim: true, spd: 0.15, r: 2, always: 1 },
  'snow-hare': { size: 0.9, ground: true, spd: 0.18, r: 4, day: 1, hop: true },
};
const DAY = { butterfly: 3, 'small-bird': 2, ladybug: 2, snail: 1, firefly: 6, moth: 2 };
const BIOME = {
  meadow_hub: { butterfly: 4, 'small-bird': 2, ladybug: 2, snail: 1, frog: 1, firefly: 6, moth: 2 },
  mirror_caves: { bat: 4, firefly: 4 },
  ember_ridge: { 'ember-sprite': 5, moth: 2, 'small-bird': 1 },
  thaw_valley: { 'snow-hare': 2, 'small-bird': 2, butterfly: 1 },
  frost_hollow: { 'snow-hare': 2, 'small-bird': 1, butterfly: 2, firefly: 4 },
  flooded_mill: { fish: 4, frog: 2, dragonfly: 2, firefly: 4 },
  mill_pond: { fish: 4, frog: 2, dragonfly: 2, butterfly: 2, firefly: 4 },
  night_market: { firefly: 6, moth: 3 }, owl_wood: { firefly: 6, moth: 3, butterfly: 2 }, moon_meadow: { firefly: 6, moth: 3, butterfly: 2 },
  storm_orchard: { 'small-bird': 2, butterfly: 2, ladybug: 2 }, grand_garden: { butterfly: 4, snail: 2, ladybug: 3, 'small-bird': 2, frog: 1 },
};
const BIOME_L20N = { ...BIOME };
Object.assign(BIOME, FULLER_MIX); // l20p: Beans's per-level critter mixes (14 levels; existing types only)
export const CAPS = { low: 6, med: 12, high: 18, ultra: 26 };

const tmpl = new Map();
const ready = new Map(); // kind -> resolved template (or null), so spawn can place without awaiting
async function template(kind) {
  if (tmpl.has(kind)) return tmpl.get(kind);
  const p = loadGLB('critters/' + kind).then(g => {
    if (!g) { ready.set(kind, null); return null; }
    const root = g.scene.clone(true), clip = g.animations[0] || null;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), k = CRITTERS[kind].size / Math.max(sz.x, sz.y, sz.z, 1e-3);
    // Step 4: atlas UVs + fold glow/eye Standard parts into the per-node merge (keep flap / maps).
    mergeAtlasRig(root, clip);
    root.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.getHex && o.material.emissive.getHex() > 0) o.material.userData.noPastel = true; });
    const T = { root, clip, scale: k }; ready.set(kind, T); return T;
  });
  tmpl.set(kind, p); return p;
}

/** Keep clip tracks bound to named bones on a cloned rig (WingL / WingR quaternion, Glow scale, …). */
function retargetClip(root, clip) {
  if (!clip) return clip;
  const names = new Set();
  root.traverse(o => { if (o.name) names.add(o.name); });
  let changed = false;
  const tracks = clip.tracks.map(t => {
    const raw = String(t.name), parts = raw.split('.');
    if (parts.length < 2) return t;
    const prop = parts[parts.length - 1], node = parts[parts.length - 2];
    if (names.has(node)) {
      const want = node + '.' + prop;
      if (raw === want) return t;
      const c = t.clone(); c.name = want; changed = true; return c;
    }
    return t;
  });
  return changed ? new THREE.AnimationClip(clip.name, clip.duration, tracks) : clip;
}

/** prep(obj): optional hook run on each new critter before it joins the scene (main styles + compiles it there). */
const FLYER = new Set(['butterfly', 'small-bird', 'dragonfly', 'moth', 'bat']);
export function createCritters(scene, { heightAt, tier = () => 'med', prep = null, getPlayer = null, onSpot = null } = {}) {
  const group = new THREE.Group(); group.name = 'critters'; scene.add(group);
  let list = [], token = 0;
  const batches = []; // step 6: same-kind atlas-rig parts share one InstancedMesh; originals stay on the clip nodes (hidden) so flaps still drive matrices
  const _Z = new THREE.Matrix4().makeScale(0, 0, 0);
  function clearBatches() {
    for (const b of batches) { b.im.removeFromParent(); b.im.dispose(); }
    batches.length = 0;
  }
  function syncBatches() {
    for (const b of batches) {
      for (let i = 0; i < b.meshes.length; i++) {
        const m = b.meshes[i];
        let vis = true, p = m.parent;
        while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
        if (vis) { m.updateWorldMatrix(true, false); b.im.setMatrixAt(i, m.matrixWorld); }
        else b.im.setMatrixAt(i, _Z);
      }
      b.im.instanceMatrix.needsUpdate = true;
      b.im.computeBoundingSphere();
    }
  }
  function buildBatches() {
    clearBatches();
    const groups = new Map();
    for (const c of list) {
      c.obj.traverse(o => {
        if (!o.isMesh || !o.userData.atlasRig || !o.geometry) return;
        const bone = o.parent?.name || '';
        const verts = o.geometry.attributes?.position?.count || 0;
        const key = c.kind + '|' + bone + '|' + verts;
        let g = groups.get(key);
        if (!g) { g = { kind: c.kind, bone, meshes: [], geo: o.geometry, mat: o.material }; groups.set(key, g); }
        g.meshes.push(o);
      });
    }
    for (const g of groups.values()) {
      if (g.meshes.length < 2) continue;
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.meshes.length);
      im.name = 'rigInst:' + g.kind + ':' + g.bone;
      im.userData.atlasRigInst = true;
      im.castShadow = false;
      im.receiveShadow = true;
      im.frustumCulled = true;
      for (const m of g.meshes) m.visible = false;
      group.add(im);
      batches.push({ im, meshes: g.meshes });
    }
    syncBatches();
  }
  function clear() { statics = []; token++; clearBatches(); for (const c of list) { c.mixer.stopAllAction(); c.obj.removeFromParent(); } list = []; }
  /** Spawn for a level. rect = world {x0,x1,z0,z1}; deep = water rects; avoid(x,z) true near the start / paths; waterY for fish. */
  async function spawn(patchId, { rect, deep = [], waterY = null, start = null } = {}) {
    clear(); const my = token; if (!rect) return;
    // l20p: Low keeps l20n's critter mix (Beans's mixes change which rigs are drawn: +4..+11 draws on Low at the census spots).
    const B = tier() === 'low' ? BIOME_L20N : BIOME;
    const want = { ...(B[patchId] || DAY) }; if (deep.length && !B[patchId]) { want.frog = 2; want.dragonfly = 1; }
    if (!deep.length || waterY == null) delete want.fish;
    { const cc = cutFor(patchId, tier()); if (cc.noCritters) for (const k of cc.noCritters) delete want[k]; } // l20q: CUTS noCritters (budget-logged, reversible with ?cuts=0)
    const cap = CAPS[tier()] || 12, tot = Object.values(want).reduce((a, b) => a + b, 0), f = Math.min(1, cap / Math.max(1, tot));
    const kinds = Object.entries(want).map(([k, n]) => [k, Math.max(f < 1 && n <= 1 ? 0 : 1, Math.round(n * f))]);
    let R = 1234 + patchId.length * 77; const rnd = () => (R = (R * 16807) % 2147483647) / 2147483647;
    const inW = (x, z, m = 0) => deep.some(r => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);
    let placed = 0;
    for (const [kind, n] of kinds) {
      // Prefetched templates place synchronously, so the critters are in the level's warm-up draw.
      const T = ready.has(kind) ? ready.get(kind) : await template(kind); if (my !== token) return; if (!T) continue; const D = CRITTERS[kind];
      const flockX = rect.x0 + 3 + rnd() * (rect.x1 - rect.x0 - 6), flockZ = rect.z0 + 3 + rnd() * (rect.z1 - rect.z0 - 6);
      let fX = flockX, fZ = flockZ;
      for (let i = 0; i < n && placed < cap; i++) {
        if (i && i % 4 === 0) { fX = rect.x0 + 3 + rnd() * (rect.x1 - rect.x0 - 6); fZ = rect.z0 + 3 + rnd() * (rect.z1 - rect.z0 - 6); } // l20p: spread big flocks
        let x = 0, z = 0, ok = false;
        for (let tries = 0; tries < 30 && !ok; tries++) {
          if (D.swim) { const r = deep[(rnd() * deep.length) | 0]; x = r.x0 + 0.6 + rnd() * Math.max(0.1, r.x1 - r.x0 - 1.2); z = r.z0 + 0.6 + rnd() * Math.max(0.1, r.z1 - r.z0 - 1.2); ok = true; break; }
          x = fX + (rnd() - 0.5) * 8; z = fZ + (rnd() - 0.5) * 8;
          if (x < rect.x0 + 1 || x > rect.x1 - 1 || z < rect.z0 + 1 || z > rect.z1 - 1) continue;
          if ((D.ground || kind === 'frog') && inW(x, z)) continue;
          if (kind === 'frog' && deep.length && !inW(x, z, 2.5)) continue;
          if (start && Math.hypot(x - start.x, z - start.z) < 5) continue; // out of the player's path at the start
          ok = true;
        }
        if (!ok && kind === 'frog' && deep.length && tier() !== 'low' && !cutFor(patchId, tier()).noFrog) { // l20q: no spot in 30 tries (trailhead_trials) -> nearest shoreline spot (1 m outside a water rect); Low keeps l20n (no frog)
          let bd = 1e9;
          for (const r of deep) for (let k = 0; k < 64; k++) { const u = k / 64, e = k % 4, sx = e < 2 ? r.x0 + (r.x1 - r.x0) * u : (e === 2 ? r.x0 - 1 : r.x1 + 1), sz = e < 2 ? (e === 0 ? r.z0 - 1 : r.z1 + 1) : r.z0 + (r.z1 - r.z0) * u;
            if (sx < rect.x0 + 1 || sx > rect.x1 - 1 || sz < rect.z0 + 1 || sz > rect.z1 - 1 || inW(sx, sz)) continue;
            if (start && Math.hypot(sx - start.x, sz - start.z) < 5) continue;
            const d = Math.hypot(sx - fX, sz - fZ); if (d < bd) { bd = d; x = sx; z = sz; ok = true; } }
        }
        if (!ok) continue;
        const obj = T.root.clone(true); obj.scale.setScalar(T.scale); obj.userData.critter = kind;
        const mixer = new THREE.AnimationMixer(obj);
        if (T.clip) {
          const a = mixer.clipAction(retargetClip(obj, T.clip));
          a.time = rnd() * T.clip.duration; a.play();
        }
        const c = { kind, D, obj, mixer, hx: x, hz: z, x, z, yaw: rnd() * 6.28, tx: x, tz: z, wait: rnd() * 2, h: D.fly ? D.fly[0] + rnd() * (D.fly[1] - D.fly[0]) : 0, ph: rnd() * 6.28 };
        if (D.swim) c.wy = waterY - 0.2 - rnd() * 0.4;
        place(c, 0); if (prep) { try { prep(obj); } catch (e) {} } group.add(obj); list.push(c); placed++;
      }
    }
    for (const c of list) { try { c.mixer.update(0); c.obj.updateMatrixWorld(true); } catch (e) {} }
    buildBatches();
    return placed;
  }
  function place(c, t) {
    const D = c.D, gy = heightAt(c.x, c.z);
    let y = gy; if (D.fly) y = gy + c.h + Math.sin(t * 2.1 + c.ph) * 0.1; else if (D.swim) y = c.wy ?? gy;
    c.obj.position.set(c.x, y, c.z); c.obj.rotation.y = c.yaw;
  }
  let acc = 0;
  // l20p: Critter Spotting. Stay within 4 m (6 m for flyers) of a visible critter for 0.8 s, or tap it. No fail states.
  // l20p: static journal sightings (Act 2 nook vignettes: resting snail, ladybird picnic) — 0.8 s within 2.5 m
  let statics = [];
  function setStatic(l) { statics = (l || []).map(q => ({ ...q, dw: 0, spotted: false })); }
  function spot(c) { if (c.spotted) return; c.spotted = true; try { onSpot && onSpot(c.kind); } catch (e) {} }
  function update(dt, t, night, cam) {
    if (statics.length && onSpot && getPlayer) { const p0 = getPlayer(); if (p0) for (const q of statics) { if (q.spotted) continue; if (Math.hypot(q.x - p0.x, q.z - p0.z) < 2.5) { q.dw += dt; if (q.dw >= 0.8) { q.spotted = true; try { onSpot(q.kind); } catch (e) {} } } else q.dw = 0; } }
    if (!list.length) return; acc += dt; if (acc < 1 / 30) return; const d = acc; acc = 0; // 30 Hz is plenty for slow background motion
    const pl = onSpot && getPlayer ? getPlayer() : null;
    for (const c of list) {
      const D = c.D, on = D.always || (D.night ? night > 0.5 : night <= 0.5) || (D.cave && c.kind === 'bat'); c.obj.visible = !!on; if (!on) continue;
      if (pl && !c.spotted) { const rr = FLYER.has(c.kind) ? 6 : 4; if (Math.hypot(c.x - pl.x, c.z - pl.z) < rr) { c.dw = (c.dw || 0) + d; if (c.dw >= 0.8) spot(c); } else c.dw = 0; }
      const far = !!(cam && Math.hypot(c.x - cam.x, c.z - cam.z) > 60);
      c.mixer.update(d);
      c.obj.updateMatrixWorld(true);
      if (far) continue; // far: skip wander (fog hides it); keep mixer + matrixWorld so a follow-cam still sees flaps
      if (c.wait > 0) { c.wait -= d; continue; }
      const dx = c.tx - c.x, dz = c.tz - c.z, dist = Math.hypot(dx, dz);
      if (dist < 0.2) { const a = Math.random() * 6.28, r = Math.random() * D.r; c.tx = c.hx + Math.cos(a) * r; c.tz = c.hz + Math.sin(a) * r; c.wait = D.perch || D.hop ? 1.5 + Math.random() * 3 : D.hover ? 1 + Math.random() : Math.random() * 0.6; continue; }
      const want = Math.atan2(dx, dz); let dy = want - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, d * 1.2); // slow yaw turns only
      const v = D.spd * Math.min(1, dist) * d; c.x += Math.sin(c.yaw) * v; c.z += Math.cos(c.yaw) * v;
      place(c, t);
    }
    syncBatches();
  }
  /** Background-load every template (no scene, no compile) so later spawns are synchronous. */
  function prefetch() { for (const k of Object.keys(CRITTERS)) template(k).catch(() => {}); }
  const _v = new THREE.Vector3();
  /** l20p: tap/click spotting. sx/sy = client px; picks the nearest visible critter within 48 px. */
  function pick(sx, sy, camera, w, h) {
    if (!onSpot || !camera) return null; let best = null, bd = 48;
    for (const c of list) { if (!c.obj.visible) continue; _v.setFromMatrixPosition(c.obj.matrixWorld); _v.project(camera); if (_v.z > 1) continue;
      const px = (_v.x * 0.5 + 0.5) * w, py = (-_v.y * 0.5 + 0.5) * h, dd = Math.hypot(px - sx, py - sy); if (dd < bd) { bd = dd; best = c; } }
    if (best) spot(best); return best ? best.kind : null;
  }
  return { spawn, clear, update, setStatic, prefetch, pick, get list() { return list; }, group };
}
