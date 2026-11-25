// l20p: proximity outlines (Beans fuller spec §1). Inverted hulls with one shared ink ShaderMaterial.
// Only the crew you are NOT driving, NPC helpers and zones interactables get one; terrain/walls/decor/critters never do.
// Width grows (opaque, no blending): fade = smoothstep(9, 5, distXZ); width = 0.035 m * fade * clamp(r/0.6, 0.7, 1.6).
// Hulls under 0.002 m are hidden (no draw). Tier caps (nearest first): low 4, med 8, high 12, ultra 16, and never more
// than the draw budget leaves (Low 160 / other 240, measured from the previous frame's calls).
import * as THREE from 'three';
import { skipCustomShaders } from './l20-fallback.js';

export const OUTLINE_SELF = false;
const CAP = { low: 4, med: 8, high: 12, ultra: 16 };
const BUDGET = { low: 158 }; // l20p: hulls fill to 2 under the draw budget (Low 160 / other 240) so frame-to-frame drift (a critter or a
// pickup entering view after the base was measured) cannot tip a full view to 241
const BUDGET_OTHER = 238;
const INK = 0x3b2614;
const normCache = new Map(); // geometry uuid -> smoothed normal attribute

function smoothNormals(geo) {
  const hit = normCache.get(geo.uuid); if (hit) return hit;
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count, acc = new Map(), key = new Array(n);
  const q = 1e4, v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i); const k = Math.round(v.x * q) + ',' + Math.round(v.y * q) + ',' + Math.round(v.z * q); key[i] = k;
    if (nor) nn.fromBufferAttribute(nor, i); else nn.set(0, 1, 0);
    const a = acc.get(k); if (a) a.add(nn); else acc.set(k, nn.clone());
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = acc.get(key[i]); const l = a.length() || 1; out[i * 3] = a.x / l; out[i * 3 + 1] = a.y / l; out[i * 3 + 2] = a.z / l; }
  const attr = new THREE.BufferAttribute(out, 3); normCache.set(geo.uuid, attr); return attr;
}

function makeMat() {
  return new THREE.ShaderMaterial({
    name: 'fullerOutline', side: THREE.BackSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uW: { value: 0 }, color: { value: new THREE.Color(INK) } }]),
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      #include <fog_pars_vertex>
      attribute vec3 outlineNormal; uniform float uW;
      void main() {
        vec3 transformed = position + normalize(outlineNormal) * uW;
        #include <skinbase_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 color;
      #include <common>
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

export function createOutlines(renderer) {
  const mat = makeMat();
  const byRoot = new Map(); // root -> { hulls: [], r }
  const S = new THREE.Vector3(), box = new THREE.Box3(), sph = new THREE.Sphere();
  let shown = 0, lastBudgetBase = 0, frameN = 0, lastCands = 0;
  function hullsFor(root) {
    let e = byRoot.get(root); if (e) return e;
    e = { hulls: [], r: 0.6 };
    const meshes = [];
    root.traverse(o => {
      if (!(o.isMesh || o.isSkinnedMesh) || o.isInstancedMesh || o.userData.outlineHull || o.userData.noOutline) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent || m.isSpriteMaterial || m.isShaderMaterial || m.isPointsMaterial || m.isLineBasicMaterial) return;
      const g = o.geometry; if (!g || !g.attributes.position || g.attributes.position.count > 20000) return;
      meshes.push(o);
    });
    try { box.setFromObject(root); if (!box.isEmpty()) { box.getBoundingSphere(sph); e.r = Math.max(0.2, Math.min(4, sph.radius)); } } catch (err) {}
    for (const o of meshes.slice(0, 6)) {
      const g = o.geometry; if (!g.attributes.outlineNormal) g.setAttribute('outlineNormal', smoothNormals(g));
      let h;
      if (o.isSkinnedMesh) { h = new THREE.SkinnedMesh(g, mat); h.bind(o.skeleton, o.bindMatrix); h.bindMode = o.bindMode; }
      else h = new THREE.Mesh(g, mat);
      h.userData.outlineHull = true; h.userData.noPastel = true; h.castShadow = false; h.receiveShadow = false; h.visible = false;
      h.renderOrder = (o.renderOrder || 0) + 1; h.frustumCulled = o.frustumCulled; h.matrixAutoUpdate = true;
      h.onBeforeRender = () => { mat.uniforms.uW.value = h.userData.w || 0; mat.uniformsNeedUpdate = true; };
      o.add(h); e.hulls.push({ h, o });
    }
    byRoot.set(root, e); return e;
  }
  const W = [];
  const measC = new THREE.Vector3(1e9, 0, 0), measF = new THREE.Vector3(), lastC = new THREE.Vector3(), lastF = new THREE.Vector3(); let measFov = 0, lastFov = 0;
  let measFrame = -1, shownAtRender = 0, measX = NaN, measZ = NaN, lastPX = NaN, lastPZ = NaN;
  /** cands: [{ root, x, z }] ; p: active player {x,z} */
  const _cf = new THREE.Vector3(), _wp = new THREE.Vector3();
  function update(p, tier, cands, cam) {
    frameN++; lastCands = cands ? cands.length : -1;
    if (skipCustomShaders() || !p) { if (shown) { for (const e of byRoot.values()) for (const k of e.hulls) k.h.visible = false; shown = 0; } return; }
    const cap = CAP[tier] ?? 8, budget = BUDGET[tier] ?? BUDGET_OTHER;
    // Budget base = last real frame's calls minus the hulls drawn in it. Only re-measured when a new frame was rendered
    // (sim steps without a render keep the old base), and after a jump of > 2 m since that frame (teleport / level
    // start / respawn) no hulls are shown until a fresh frame has been measured at the new spot, so a stale cheap
    // frame can never let hulls push a heavy view over budget.
    const info = renderer && renderer.info && renderer.info.render, calls = info ? info.calls : 0, fr = info ? info.frame : -1;
    if (fr !== measFrame) { measFrame = fr; if (calls) { lastBudgetBase = Math.max(0, calls - shownAtRender); measX = lastPX; measZ = lastPZ; measC.copy(lastC); measF.copy(lastF); measFov = lastFov; } }
    lastPX = p.x; lastPZ = p.z;
    // the camera view also changes the draw count (turning, zooming): treat a camera move / turn / zoom since the measured frame as a jump too
    if (cam) { cam.getWorldDirection(_cf); lastC.copy(cam.position); lastF.copy(_cf); lastFov = cam.fov; }
    const camMoved = cam && (lastC.distanceTo(measC) > 1.5 || lastF.dot(measF) < 0.995 || Math.abs(lastFov - measFov) > 2);
    const jumped = camMoved || !(Math.hypot(p.x - measX, p.z - measZ) <= 2);
    const room = jumped ? 0 : calls ? Math.max(0, budget - lastBudgetBase) : cap;
    W.length = 0;
    for (const c of cands) {
      if (!c || !c.root) continue; let vis = true; for (let o = c.root; o; o = o.parent) if (!o.visible) { vis = false; break; }
      const e = byRoot.get(c.root);
      if (!vis) { if (e) for (const k of e.hulls) k.h.visible = false; continue; }
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d >= 9) { if (e) for (const k of e.hulls) k.h.visible = false; continue; }
      W.push({ c, d });
    }
    W.sort((a, b) => a.d - b.d);
    let used = 0; const lim = Math.min(cap, room);
    const keep = new Set();
    for (const { c, d } of W) {
      const e = hullsFor(c.root); if (!e.hulls.length) continue;
      const t = Math.min(1, Math.max(0, (9 - d) / 4)), fade = t * t * (3 - 2 * t);
      // l20q: base width grows with the camera distance (~2-3 px on phones): max(0.035, 0.0045 * camDist); the 9 -> 5 m fade stays on player distance
      let camDist = 0; if (cam) { c.root.getWorldPosition(_wp); camDist = cam.position.distanceTo(_wp); }
      const w = Math.max(0.035, 0.0045 * camDist) * fade * Math.min(1.6, Math.max(0.7, e.r / 0.6));
      // l20q: the cap is per character: outline a root only if ALL its visible meshes fit under the cap (no partial outlines)
      const need = e.hulls.reduce((a, k) => a + (k.o.visible ? 1 : 0), 0), fits = w >= 0.002 && need > 0 && used + need <= lim;
      for (const k of e.hulls) {
        const ok = fits && k.o.visible;
        if (ok) { k.o.getWorldScale(S); k.h.userData.w = w / Math.max(1e-4, Math.max(Math.abs(S.x), Math.abs(S.y), Math.abs(S.z))); used++; }
        k.h.visible = ok;
      }
      keep.add(c.root);
    }
    if (shown || used) for (const [root, e] of byRoot) if (!keep.has(root)) for (const k of e.hulls) k.h.visible = false;
    shown = used; shownAtRender = used;
    if (byRoot.size > 400) { for (const [root, e] of byRoot) if (!root.parent) { for (const k of e.hulls) k.h.removeFromParent(); byRoot.delete(root); } }
  }
  function forget() { for (const [root, e] of byRoot) if (!root.parent || !root.visible) { for (const k of e.hulls) { k.h.visible = false; } } }
  return { update, forget, stats: () => ({ shown, roots: byRoot.size, frames: frameN, cands: lastCands }) };
}
