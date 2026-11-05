// Peaceful co-op puzzles (Lost Vikings style). Each guards a special food that can only be reached through teamwork,
// and collecting it fills a page of the Field Journal. Nothing here involves danger or failure: puzzles can't be broken.
import * as THREE from 'three';
import { SITES } from './sites.js';
import { SPECIAL } from './journal.js';

const TAU = Math.PI * 2;
const L = (c, e = 0, o = {}) => new THREE.MeshLambertMaterial({ color: c, emissive: e, flatShading: true, ...o });
const ADD = (c, o = 0.5) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
const rockM = L(0x8d8a82), mossM = L(0x5f9d44), barkM = L(0x7a5232), cutM = L(0xe3bf82), woodM = L(0x9a6c3e), twigM = L(0x6e4a2a), dirtM = L(0x6b4a2c);
const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const back = x => { x = Math.min(1, Math.max(0, x)); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const POLLINATORS = ['bee', 'bumblebee', 'butterfly', 'hummingbird', 'moth', 'bat'];

const texCache = {};
function emojiTex(text) {
  if (texCache[text]) return texCache[text];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(14,38,42,0.66)'; g.beginPath(); g.roundRect ? g.roundRect(6, 14, 244, 100, 40) : g.rect(6, 14, 244, 100); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4; g.stroke();
  g.font = '600 62px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return texCache[text] = t;
}
let _halo; function haloTex() {
  if (_halo) return _halo; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return _halo = new THREE.CanvasTexture(c);
}
export function badge(text, w = 6.4) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(text), transparent: true, depthWrite: false, fog: false })); s.scale.set(w, w / 2, 1); s.renderOrder = 9; return s; }
function halo(color, size = 4) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; }
function ring(r0, r1, color, o = 0.55) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40), ADD(color, o)); m.rotation.x = -Math.PI / 2; m.renderOrder = 4; return m; }
function column(color, h = 34) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, h, 12, 1, true), ADD(color, 0.2)); m.position.y = h / 2; m.renderOrder = 3; return m; }
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

/** a shiny little 3D model of each special food */
function prizeMesh(id) {
  const g = new THREE.Group();
  if (id === 'jelly') { g.add(mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.75, 14), L(0xfff3c8, 0x6a5a20, { transparent: true, opacity: 0.92 }), 0, 0.38, 0)); g.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 14), L(0xd9a63a, 0x4a3000), 0, 0.82, 0)); g.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), L(0xffe27a, 0xcc9a20), 0, 0.36, 0)); }
  else if (id === 'comb') { for (const [x, z, y] of [[0, 0, 0.3], [0.52, 0.3, 0.3], [-0.52, 0.3, 0.3], [0, 0.6, 0.3], [0.5, -0.3, 0.3], [-0.5, -0.3, 0.3]]) g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 6), L(0xffc531, 0x8a5a00), x, y, z)); }
  else if (id === 'truffle') { g.add(mesh(new THREE.IcosahedronGeometry(0.5, 1), L(0x3a2a22, 0x44ffd0), 0, 0.5, 0)); for (let i = 0; i < 5; i++) g.add(mesh(new THREE.SphereGeometry(0.12, 6, 5), L(0x7fffe0, 0x7fffe0), Math.cos(i * 1.3) * 0.5, 0.5 + Math.sin(i * 2.1) * 0.3, Math.sin(i * 1.3) * 0.5)); }
  else if (id === 'berries') { for (let i = 0; i < 9; i++) g.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), L(0x5a2a80, 0x1a0830), Math.cos(i * 2.4) * 0.3, 0.25 + (i % 3) * 0.28, Math.sin(i * 2.4) * 0.3)); g.add(mesh(new THREE.ConeGeometry(0.3, 0.5, 5), L(0x3f9a3a), 0, 1.0, 0)); }
  else if (id === 'strawberry') { for (const [x, z] of [[0, 0], [0.5, 0.2], [-0.4, 0.35]]) { const b = mesh(new THREE.SphereGeometry(0.3, 10, 8), L(0xff3a50, 0x500010), x, 0.35, z); b.scale.y = 1.2; g.add(b); g.add(mesh(new THREE.ConeGeometry(0.2, 0.18, 6), L(0x3fb040), x, 0.72, z)); } }
  else if (id === 'nectar') { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, pt = mesh(new THREE.ConeGeometry(0.28, 0.9, 5), L(0xf4f8ff, 0x8aa8ff), Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5); pt.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); g.add(pt); } g.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), L(0xffe9a0, 0xffd060), 0, 0.55, 0)); g.userData.petals = g.children.slice(0, 6); }
  else if (id === 'chestnut') { g.add(mesh(new THREE.IcosahedronGeometry(0.5, 1), L(0xa86a30, 0x2a1000), 0, 0.5, 0)); for (let i = 0; i < 14; i++) { const a = i * 2.4, y = Math.cos(i * 1.7) * 0.4, c = mesh(new THREE.ConeGeometry(0.07, 0.3, 4), L(0x7a8a3a), Math.cos(a) * 0.5, 0.5 + y, Math.sin(a) * 0.5); c.lookAt(Math.cos(a) * 2, 0.5 + y * 3, Math.sin(a) * 2); c.rotateX(Math.PI / 2); g.add(c); } }
  else if (id === 'apple') { for (const [x, z] of [[0, 0], [0.55, 0.15]]) { g.add(mesh(new THREE.SphereGeometry(0.4, 10, 8), L(0xe03030, 0x400000), x, 0.42, z)); g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5), twigM, x, 0.85, z)); } g.add(mesh(new THREE.ConeGeometry(0.16, 0.34, 4), L(0x3fb040), 0.2, 0.95, 0.08)); }
  g.scale.setScalar(1.35); return g;
}

export function buildCoop(scene, E) {
  const { world, heightAt, P, SPECIES } = E, phys = world.phys;
  const puzzles = [];
  const frame = S => { const ux = Math.sin(S.ang), uz = Math.cos(S.ang), lx = uz, lz = -ux; return { ux, uz, lx, lz, at: (s, l = 0) => ({ x: S.x + ux * s + lx * l, z: S.z + uz * s + lz * l }) }; };
  const rockPillar = (grp, x, z, r, h, g0, solid = true) => {
    const m = mesh(new THREE.CylinderGeometry(r * 0.92, r * 1.12, h + 1, 8), rockM, x, g0 + (h - 1) / 2, z); m.rotation.y = x * 7.3; grp.add(m);
    grp.add(mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.92, 0.34, 8), mossM, x, g0 + h - 0.1, z));
    const s = { type: 'cyl', x, z, r: r * 0.92, y0: g0 - 1.5, top: g0 + h, kind: 'coop' }; if (solid) phys.add(s); return s;
  };
  const base = (S, def, extra) => {
    const grp = new THREE.Group(); scene.add(grp);
    const pz = Object.assign({ S, def, id: def.id, grp, done: !!(E.roundDone || E.save.journal)[def.id], stage: (E.save.coop.stage[def.id] | 0), team: [], beacons: [], prize: null, hintPos: { x: S.x, z: S.z }, msgT: 0 }, extra);
    pz.prizeG = prizeMesh(def.id); pz.prizeHalo = halo(def.color, 4.2); pz.prizeG.add(pz.prizeHalo); pz.prizeHalo.position.y = 0.5; pz.prizeG.visible = false; grp.add(pz.prizeG);
    pz.beam = column(def.id === 'nectar' ? 0xaec4ff : 0x7ff7e8); pz.grp.add(pz.beam);
    pz.badgeS = badge(pz.badgeText || '🤝'); grp.add(pz.badgeS);
    puzzles.push(pz); return pz;
  };
  const setStage = (pz, n) => { pz.stage = n; E.save.coop.stage[pz.id] = n; E.persist(); };
  const placePrize = (pz, x, y, z) => { pz.prize = { x, y, z }; pz.prizeG.position.set(x, y, z); pz.beam.position.set(x, y - 0.5 + 17, z); };

  // ================= LOG SHOVE: the bear moves a heavy log so another animal can climb the ledge =================
  function buildLogroll(S, def) {
    const F = frame(S), gh = S.base, sEnd = 11, half = 3.5, cliffR = 3.0, cliffTop = 4.4, logTop = 1.5;
    const pz = base(S, def, { badgeText: '🐻 ➜ 🐀', ben: ['opossum'] });
    const cl = F.at(sEnd + half + 0.3 + cliffR);
    rockPillar(pz.grp, cl.x, cl.z, cliffR, cliffTop, gh);
    // a wild comb nest on top
    placePrize(pz, cl.x, gh + cliffTop + 1.1, cl.z); pz.prizeG.visible = true;
    const yaw = S.ang - Math.PI / 2;
    const lg = new THREE.CylinderGeometry(0.76, 0.76, half * 2, 12); lg.rotateZ(Math.PI / 2);
    const log = new THREE.Mesh(lg, [barkM, cutM, cutM]); log.rotation.y = yaw; pz.grp.add(log);
    log.add(mesh(new THREE.SphereGeometry(0.5, 6, 5), mossM, -1, 0.65, 0.1));
    const sol = { type: 'box', x: 0, z: 0, hx: half, hz: 0.8, yaw, y0: gh - 0.5, top: gh + logTop, kind: 'coop' }; phys.addDyn(sol);
    pz.log = { s: pz.stage >= 1 ? sEnd : 0 };
    const place = () => { const q = F.at(pz.log.s), g = heightAt(q.x, q.z); log.position.set(q.x, g + 0.74, q.z); sol.x = q.x; sol.z = q.z; sol.y0 = g - 0.5; sol.top = g + logTop; pz.logPos = q; };
    place();
    pz.hintPos = F.at(2); pz.badgeS.position.set(pz.hintPos.x, gh + 6.5, pz.hintPos.z);
    pz.arrows = []; const ag = new THREE.ConeGeometry(0.6, 1.3, 3); ag.rotateX(Math.PI / 2);
    for (let k = 0; k < 6; k++) { const a = new THREE.Mesh(ag, ADD(0xffd23f, 0.6)); a.rotation.y = S.ang; const q = F.at(1.2 + k * 1.8, 2.4); a.position.set(q.x, gh + 0.12, q.z); pz.grp.add(a); pz.arrows.push(a); }
    pz.update = (dt, t, cur) => {
      const k = pz.stage >= 1; for (const a of pz.arrows) { a.visible = !k; a.material.opacity = 0.35 + 0.3 * Math.sin(t * 4 + a.position.x); }
    };
    pz.tryPush = (p, sp, dt, t) => {
      if (pz.stage >= 1 || sp.id !== 'bear') return false;
      const q = pz.logPos, dx = p.x - q.x, dz = p.z - q.z, a = dx * F.ux + dz * F.uz, b = -dx * F.uz + dz * F.ux, vf = p.vx * F.ux + p.vz * F.uz;
      if (Math.abs(b) < 1.5 && a < -half + 0.1 && a > -half - 2.4 && vf > 0.8) {
        pz.log.s = Math.min(sEnd, pz.log.s + vf * dt); place();
        if (t - (pz.dust || 0) > 0.3) { pz.dust = t; E.fx.burst(q.x - F.ux * half, gh + 0.4, q.z - F.uz * half, 4, 2); }
        if (pz.log.s >= sEnd) { setStage(pz, 1); const e = F.at(sEnd + half); E.fx.burst(e.x, gh + 1.5, e.z, 30, 6); E.audio.chime(); E.toast('🪵 The log is in place — a step up to the ledge!', 3200); pz.team[0] = 'bear'; }
        return true;
      } return false;
    };
    pz.nextStep = () => pz.stage < 1 ? { need: 'bear', text: '🐻 Only the bear can shove this heavy log — push it toward the rock ledge.' } : { need: 'opossum', text: '🐀 Climb the log, then jump to the ledge for the Royal Jelly!' };
    pz.canCollect = id => pz.stage < 1 ? { ok: false, msg: '✨ Something is up on that ledge… how can you reach it?' } : pz.ben.includes(id) ? { ok: true, team: ['bear', id] } : { ok: false, msg: '🐀 This ledge treat is for the opossum — tap ⇄ to switch!' };
    return pz;
  }

  // ================= VINE: a pollinator makes a bud grow into a leafy staircase =================
  function buildVine(S, def) {
    const night = !!def.night, nLeaves = 8, step = 1.35, R = 4.6, gh = S.base, H = gh + (nLeaves + 1) * step + 1.4;
    const pz = base(S, def, { badgeText: night ? '🐝 ➜ 🦇🌙' : '🐝 ➜ 🐻', ben: night ? ['moth', 'bat'] : ['bear'], pol: 0, fxT: 0, night });
    const cx = S.x, cz = S.z, budY = gh + 2.4, leafCol = night ? 0x6fc8a8 : 0x4fae3e;
    const stalk = new THREE.CylinderGeometry(0.5, 0.65, 1, 8); stalk.translate(0, 0.5, 0);
    pz.stalk = new THREE.Mesh(stalk, L(night ? 0x5fa890 : 0x3c8a30)); pz.stalk.position.set(cx, gh - 0.2, cz); pz.grp.add(pz.stalk);
    pz.bud = mesh(new THREE.SphereGeometry(0.7, 10, 8), L(night ? 0xdfe8ff : 0xff7ab8, night ? 0x334a88 : 0x661a40), cx, budY, cz); pz.bud.scale.y = 1.25; pz.grp.add(pz.bud);
    pz.budRing = ring(1.4, 1.75, night ? 0xaec4ff : 0xff9ad0, 0.7); pz.budRing.rotation.x = 0; pz.budRing.add(new THREE.Object3D()); pz.budRing.position.set(cx, budY, cz); pz.budRing.rotation.set(0, 0, 0); pz.grp.add(pz.budRing);
    pz.ground = ring(2.4, 2.9, night ? 0xaec4ff : 0xffd23f, 0.5); pz.ground.position.set(cx, gh + 0.1, cz); pz.grp.add(pz.ground);
    pz.leaves = [];
    for (let i = 0; i <= nLeaves; i++) {
      const top = i === nLeaves, th = i * 0.96 + 0.4, rr = top ? 0 : R, y = gh + step * (i + 1) + (top ? step * 0.0 : 0), lr = top ? 3.0 : 1.7;
      const g = new THREE.Group(); g.position.set(cx + Math.cos(th) * rr, y, cz + Math.sin(th) * rr);
      const lf = mesh(new THREE.CylinderGeometry(lr, lr * 0.9, 0.34, 9), L(leafCol, 0x0a2a06), 0, -0.17, 0); g.add(lf);
      g.add(mesh(new THREE.CylinderGeometry(lr * 0.9, lr * 0.9, 0.05, 9), L(night ? 0x9fe0c8 : 0x7ad04f), 0, 0.01, 0));
      const st2 = mesh(new THREE.CylinderGeometry(0.12, 0.16, rr || 0.1, 5), L(0x3c8a30)); st2.rotation.z = Math.PI / 2;
      const sg2 = new THREE.Group(); sg2.rotation.y = -th + Math.PI; sg2.position.y = -0.3; st2.position.x = (rr || 0.1) / 2; sg2.add(st2); g.add(sg2);
      g.scale.setScalar(0.001); g.visible = false; pz.grp.add(g);
      const s = { type: 'cyl', x: g.position.x, z: g.position.z, r: lr * 0.94, y0: y - 0.45, top: y, kind: 'coop', off: true }; phys.add(s);
      pz.leaves.push({ g, s, y, top, lr });
    }
    pz.topPos = { x: cx + 1.2, z: cz, y: gh + step * (nLeaves + 1) };
    placePrize(pz, pz.topPos.x, pz.topPos.y + 1.0, pz.topPos.z);
    pz.hintPos = { x: cx, z: cz }; pz.badgeS.position.set(cx, budY + 4.2, cz);
    pz.beam.position.set(cx, gh + 17, cz);
    pz.gt = pz.stage >= 1 ? 99 : 0; pz.growing = pz.stage >= 1;
    const T_ALL = nLeaves * 0.3 + 1.3;
    const applyGrow = () => {
      const g = pz.gt, k = ease(g / (T_ALL - 0.3)), h = (budY - gh + 0.2) + (H - budY) * k;
      pz.stalk.scale.set(1, h, 1); pz.bud.position.y = gh - 0.2 + h + 0.3; pz.budRing.visible = g < 0.5;
      pz.leaves.forEach((lf, i) => { const u = (g - 0.3 - i * 0.3) / 0.55, sc = u <= 0 ? 0.001 : back(u); lf.g.visible = u > 0; lf.g.scale.setScalar(Math.max(0.001, sc)); lf.s.off = !(u > 0.55); });
      pz.prizeG.visible = !pz.done && g > T_ALL - 0.6;
    };
    pz.update = (dt, t, cur) => {
      const p = P[cur];
      if (!pz.growing) {
        let inr = false; const sp = SPECIES[cur];
        if (POLLINATORS.includes(cur) && !p.grounded) { const dx = p.x - cx, dz = p.z - cz, dy = p.y + 0.5 - budY; inr = dx * dx + dy * dy + dz * dz < 3.8 * 3.8 && p.speed < 8; }
        else if (POLLINATORS.includes(cur)) { const dx = p.x - cx, dz = p.z - cz; inr = dx * dx + dz * dz < 2.4 * 2.4 && budY - p.y < 3.2; }
        if (inr) { pz.pol += dt; if (pz.pol > 0.05 && !pz.pollBy) pz.pollBy = cur; if (t - pz.fxT > 0.35) { pz.fxT = t; E.fx.burst(cx, budY, cz, 3, 1.5); } } else pz.pol = Math.max(0, pz.pol - dt * 0.6);
        const k = Math.min(1, pz.pol / 1.3); pz.bud.scale.setScalar(1 + 0.35 * k); pz.bud.scale.y *= 1.25; pz.budRing.scale.setScalar(1 + 0.4 * Math.sin(t * 5) * (0.3 + k)); pz.budRing.material.opacity = 0.5 + 0.4 * k;
        pz.budRing.lookAt(E.camera.position);
        if (pz.pol >= 1.3) { pz.growing = true; pz.gt = 0; setStage(pz, 1); pz.team[0] = pz.pollBy || cur; E.audio.chime(); E.toast('🌱 The vine is growing into a leafy staircase!', 3200); E.fx.burst(cx, budY, cz, 40, 7); }
      }
      if (pz.growing && pz.gt < 99) { pz.gt += dt; if (pz.gt > T_ALL + 0.5) pz.gt = 99; applyGrow(); }
      if (pz.growing && pz.gt >= 99 && !pz._set) { pz._set = true; applyGrow(); }
      if (night && pz.prizeG.userData.petals) { const open = E.night() > 0.6 ? 1 : 0.2; pz.open = (pz.open ?? 0.2) + (open - (pz.open ?? 0.2)) * Math.min(1, dt * 2); for (const pt of pz.prizeG.userData.petals) pt.scale.set(pz.open, 0.4 + 0.6 * pz.open, pz.open); pz.prizeHalo.material.opacity = 0.35 + 0.65 * pz.open; }
      pz.ground.visible = !pz.growing;
    };
    pz.nextStep = () => !pz.growing ? { need: 'bee', text: `🐝 A pollinator can wake this ${night ? 'moon' : ''}vine: hover at the glowing bud for a moment.` } :
      night ? { need: 'moth', text: E.night() > 0.6 ? '🦋 Climb the leaves and sip the moonflower nectar!' : '🌙 The moonflower only opens at night — tap 🌙, then climb up as a moth or bat.' } : { need: 'bear', text: '🐻 Climb the leaf staircase to the golden honeycomb!' };
    pz.canCollect = id => {
      if (!pz.growing || pz.gt < 99) return { ok: false, msg: '🌱 The vine is still growing…' };
      if (!pz.ben.includes(id)) return { ok: false, msg: night ? '🌙 This bloom is for a night pollinator — switch to the moth or bat!' : '🐻 This honeycomb is the bear’s — tap ⇄ to switch!' };
      if (night && E.night() < 0.6) return { ok: false, msg: '🌙 The moonflower is shut tight. It opens at night — tap 🌙!' };
      return { ok: true, team: [pz.team[0] || 'bee', id] };
    };
    if (pz.growing) { pz.gt = 99; pz._set = true; applyGrow(); }
    return pz;
  }

  // ================= SKY SCOUT: a flyer spots the glimmer under one leaf pile, then a digger digs it up =================
  function buildScout(S, def) {
    const gh = S.base, N = 5, ringR = 9, real = S.id === 'scout' ? 2 : 3;
    const pz = base(S, def, { badgeText: S.id === 'scout' ? '🐦 ➜ 🦝' : '🕊️ ➜ 🐻', ben: [S.id === 'scout' ? 'raccoon' : 'bear'], piles: [] });
    pz.revealed = pz.stage >= 1;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU + 0.3, x = S.x + Math.cos(a) * ringR, z = S.z + Math.sin(a) * ringR;
      const g = new THREE.Group(); g.position.set(x, gh, z); pz.grp.add(g);
      const mound = mesh(new THREE.SphereGeometry(1.7, 9, 6), L(0x5f9a3a), 0, 0, 0); mound.scale.set(1, 0.5, 1); g.add(mound);
      for (let k = 0; k < 6; k++) { const lf = mesh(new THREE.ConeGeometry(0.5, 0.15, 5), L([0x7cae44, 0xb8923a, 0x6a9a3a][k % 3]), Math.cos(k * 1.1) * 1.0, 0.7 - k * 0.02, Math.sin(k * 1.1) * 1.0); lf.rotation.y = k; g.add(lf); }
      const glow = halo(def.color, 5.5); glow.position.y = 1.2; glow.visible = false; g.add(glow);
      const rg = ring(1.6, 2.1, 0x7ff7e8, 0.8); rg.position.y = 0.1; rg.visible = false; g.add(rg);
      pz.piles.push({ x, z, g, mound, glow, rg, real: i === real, dug: false });
    }
    pz.badgeS.position.set(S.x, gh + 9, S.z); pz.beam.position.set(S.x, gh + 17, S.z); pz.beam.material.opacity = 0.12;
    const showReveal = () => { const r = pz.piles[real]; r.glow.visible = true; r.rg.visible = true; r.mound.material = L(0x6b4a2c, 0x1a8a70); r.g.children.forEach(c => { if (c !== r.mound && c !== r.glow && c !== r.rg) c.visible = false; }); pz.beam.position.set(r.x, gh + 17, r.z); pz.beam.material.opacity = 0.3; pz.hintPos = { x: r.x, z: r.z }; };
    if (pz.revealed) showReveal();
    pz.update = (dt, t, cur) => {
      const sp = SPECIES[cur], p = P[cur];
      if (!pz.revealed && sp.mv.fly && !p.grounded) {
        const dx = p.x - S.x, dz = p.z - S.z, ag = p.y - heightAt(p.x, p.z);
        if (dx * dx + dz * dz < 17 * 17 && ag > 3.8) { pz.revealed = true; pz.team[0] = cur; setStage(pz, 1); showReveal(); E.audio.chime(); E.fx.burst(pz.piles[real].x, gh + 1.5, pz.piles[real].z, 40, 6); E.toast('👀 You spotted a glimmer under one leaf pile!', 3200); }
      }
      if (pz.revealed && !pz.done) { const r = pz.piles[real]; r.glow.material.opacity = 0.6 + 0.4 * Math.sin(t * 4); r.rg.scale.setScalar(1 + 0.12 * Math.sin(t * 4)); }
    };
    pz.onAction = (p, sp, cur, t) => {
      if (pz.done || !sp.ground) return false;
      let hit = null; for (const pl of pz.piles) if (Math.hypot(p.x - pl.x, p.z - pl.z) < 3.4) hit = pl;
      if (!hit) return false;
      if (!hit.real) { E.toast('🍂 Just leaves and soil here — try another pile!', 1800); E.fx.burst(hit.x, gh + 0.8, hit.z, 6, 2); return true; }
      if (!pz.revealed) { E.toast('🤔 Something stirs under here… but you can’t pinpoint it. A flyer’s-eye view could help!', 3000); return true; }
      if (!pz.ben.includes(cur)) { E.toast(`${SPECIES[pz.ben[0]].emoji} This one needs the ${SPECIES[pz.ben[0]].name}’s claws — tap ⇄ to switch!`, 2600); return true; }
      E.collect(pz, cur, [pz.team[0] || 'robin', cur], hit.x, gh + 1.2, hit.z); return true;
    };
    pz.nextStep = () => !pz.revealed ? { need: S.id === 'scout' ? 'robin' : 'hummingbird', text: '🐦 Something is hidden under one of these piles. Fly high above them to spot it!' } : { need: pz.ben[0], text: `${SPECIES[pz.ben[0]].emoji} The glowing pile is it — press Dig on it!` };
    pz.canCollect = () => ({ ok: false, msg: '' });
    return pz;
  }

  // ================= STICK STEP: the opossum stacks sticks into steps =================
  function buildSticks(S, def) {
    const F = frame(S), gh = S.base, heights = [1.2, 2.4, 3.6], ss = [2.2, 4.8, 7.4], cliffTop = 6.0, cliffR = 2.9;
    const pz = base(S, def, { badgeText: '🐀 ➜ 🦝', ben: ['raccoon'] });
    const cl = F.at(ss[2] + 1.3 + 0.3 + cliffR); rockPillar(pz.grp, cl.x, cl.z, cliffR, cliffTop, gh);
    placePrize(pz, cl.x, gh + cliffTop + 1.1, cl.z); pz.prizeG.visible = true;
    pz.tiers = heights.map((h, i) => {
      const q = F.at(ss[i]), g = new THREE.Group(); g.position.set(q.x, gh, q.z); g.rotation.y = S.ang; pz.grp.add(g);
      g.add(mesh(new THREE.BoxGeometry(3.2, h, 2.6), woodM, 0, h / 2, 0));
      for (let k = 0; k < 5; k++) { const sc = mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 5), k % 2 ? twigM : barkM, 0, h * (0.12 + k * 0.18), 0); sc.rotation.z = Math.PI / 2; sc.rotation.y = 0.12 * (k - 2); g.add(sc); const sd = mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.0, 5), twigM, 0, h * (0.2 + k * 0.17), 0); sd.rotation.x = Math.PI / 2; sd.position.x = (k - 2) * 0.55; g.add(sd); }
      g.add(mesh(new THREE.TorusGeometry(1.45, 0.07, 5, 14), L(0xd8c090), 0, h * 0.5, 0)).rotation.x = Math.PI / 2;
      const s = { type: 'box', x: q.x, z: q.z, hx: 1.6, hz: 1.3, yaw: S.ang, y0: gh - 0.5, top: gh + h, kind: 'coop', off: true }; phys.add(s);
      return { g, s, h, built: 0 };
    });
    pz.tiers.forEach((t, i) => { const b = pz.stage > i; t.g.visible = b; t.s.off = !b; t.built = b ? 1 : 0; t.g.scale.y = 1; });
    pz.hintPos = F.at(ss[0] - 3); pz.spot = F.at(ss[0] - 3.4);
    pz.ring = ring(2.2, 2.9, 0xffd23f, 0.6); pz.ring.position.set(pz.spot.x, gh + 0.12, pz.spot.z); pz.grp.add(pz.ring);
    pz.badgeS.position.set(pz.spot.x, gh + 5.8, pz.spot.z);
    pz.update = (dt, t) => {
      pz.ring.visible = pz.stage < 3; pz.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 4));
      pz.tiers.forEach((tr, i) => { if (pz.stage > i && tr.built < 1) { tr.built = Math.min(1, tr.built + dt * 2.2); tr.g.visible = true; tr.g.scale.y = Math.max(0.01, back(tr.built)); if (tr.built > 0.9) tr.s.off = false; } });
    };
    pz.onAction = (p, sp, cur) => {
      if (cur !== 'opossum' || pz.stage >= 3) return false;
      if (Math.hypot(p.x - pz.spot.x, p.z - pz.spot.z) > 7) return false;
      const cost = E.stickCost ? E.stickCost() : 2;
      if (p.carried < cost) { E.toast(`🪵 Each step needs ${cost} stick${cost > 1 ? 's' : ''} — you have ${p.carried}. Gather ✨ sticks first!`, 2600); return false; }
      p.carried -= cost; const i = pz.stage; setStage(pz, i + 1); pz.team[0] = 'opossum'; const q = pz.tiers[i].s;
      E.audio.chime(); E.fx.burst(q.x, gh + 1.5, q.z, 24, 5); E.updateHud(); E.toast(`🪵 Step ${i + 1} of 3 built!` + (i === 2 ? ' The raccoon can climb now!' : ''), 2400); return true;
    };
    pz.nextStep = () => pz.stage < 3 ? { need: 'opossum', text: `🐀 Bring 2 sticks per step to the gold ring and press Scavenge (${pz.stage}/3 built).` } : { need: 'raccoon', text: '🦝 Climb the stick steps up to the wild blackberries!' };
    pz.canCollect = id => pz.stage < 3 ? { ok: false, msg: '✨ Berries! Too high to reach… for now.' } : pz.ben.includes(id) ? { ok: true, team: ['opossum', id] } : { ok: false, msg: '🦝 These berries are for the raccoon — tap ⇄ to switch!' };
    return pz;
  }

  // ================= PAD & GATE: park one animal on the pad, send another through the bramble gate =================
  function buildPad(S, def) {
    const F = frame(S), gh = S.base, nookS = 26, nr = 5.6, gateP = F.at(nookS - nr), nk = F.at(nookS);
    const pz = base(S, def, { badgeText: '🐾 ➜ 🚪', ben: [] });
    const padR = 1.8; pz.pad = F.at(0);
    const padM = mesh(new THREE.CylinderGeometry(padR, padR + 0.15, 0.22, 16), L(0xa7a49a), pz.pad.x, gh + 0.1, pz.pad.z); pz.grp.add(padM);
    pz.padGlow = ring(0.5, padR * 0.85, 0xffd23f, 0.7); pz.padGlow.position.set(pz.pad.x, gh + 0.25, pz.pad.z); pz.grp.add(pz.padGlow);
    // rocks around the nook with the gate gap facing the pad
    const nRocks = 7, gap = 0.74;
    for (let k = 0; k < nRocks; k++) { const a = Math.PI + gap + k * (TAU - 2 * gap) / (nRocks - 1), dirx = F.ux * Math.cos(a) + F.lx * Math.sin(a), dirz = F.uz * Math.cos(a) + F.lz * Math.sin(a); rockPillar(pz.grp, nk.x + dirx * nr, nk.z + dirz * nr, 1.95, 7 + (k % 2) * 1.2, gh); }
    // bramble gate
    pz.gate = new THREE.Group(); pz.gate.position.set(gateP.x, gh, gateP.z); pz.gate.rotation.y = S.ang; pz.grp.add(pz.gate);
    for (let k = 0; k < 6; k++) { const bx = -1.5 + k * 0.6, b = mesh(new THREE.IcosahedronGeometry(0.95, 0), L(0x2f6a30), bx, 0.9 + (k % 2) * 0.6, 0); b.scale.y = 1.5; pz.gate.add(b); for (let j = 0; j < 3; j++) { const th = mesh(new THREE.ConeGeometry(0.08, 0.5, 4), L(0xc8b070), bx + (j - 1) * 0.4, 1.2 + (k % 2) * 0.6 + j * 0.3, 0.8); th.rotation.x = Math.PI / 2; pz.gate.add(th); } pz.gate.add(mesh(new THREE.SphereGeometry(0.15, 5, 4), L(0xff7ab8, 0x661a40), bx + 0.2, 1.8, 0.6)); }
    pz.gateS = { type: 'box', x: gateP.x, z: gateP.z, hx: 1.95, hz: 0.9, yaw: S.ang, y0: gh - 1, top: gh + 4, kind: 'coop', wall: true }; phys.add(pz.gateS);
    placePrize(pz, nk.x, gh + 1.0, nk.z); pz.prizeG.visible = !pz.done; pz.nook = nk;
    pz.hintPos = F.at(0); pz.badgeS.position.set(pz.pad.x, gh + 5, pz.pad.z); pz.openK = pz.done ? 1 : 0;
    const sitter = (except) => { for (const k in P) { if (k === except) continue; const q = P[k]; if (q.grounded && Math.hypot(q.x - pz.pad.x, q.z - pz.pad.z) < padR) return k; } return null; };
    pz.sitter = sitter;
    pz.update = (dt, t, cur) => {
      const occ = !!sitter(null); let inNook = false; for (const k in P) { const q = P[k]; if (Math.hypot(q.x - nk.x, q.z - nk.z) < nr - 0.6 && q.y < gh + 4) inNook = true; }
      pz.open = occ || inNook || pz.done;
      pz.openK += ((pz.open ? 1 : 0) - pz.openK) * Math.min(1, dt * 3);
      pz.gate.position.y = gh - 3.4 * pz.openK; pz.gateS.off = pz.openK > 0.55;
      pz.padGlow.material.opacity = occ ? 0.95 : 0.45 + 0.25 * Math.sin(t * 3.5); pz.padGlow.scale.setScalar(occ ? 1.15 : 1);
      pz.beam.material.opacity = 0.2;
    };
    pz.nextStep = (cur) => { const s = sitter(null); return !s ? { need: null, text: '🐾 Park an animal on the glowing pad (leave them there), then tap ⇄ to switch to another.' } : cur === s ? { need: null, text: '✅ The gate is open! Tap ⇄ to switch to another animal and walk through the gate.' } : { need: null, text: `${SPECIES[s].emoji} ${SPECIES[s].name} is holding the gate open — head into the rock nook!` }; };
    pz.canCollect = id => { const s = sitter(id); return s ? { ok: true, team: [s, id] } : { ok: false, msg: '🔒 The treat is sealed! Park a friend on the glowing pad first — tap ⇄ to switch.' }; };
    return pz;
  }

  const builders = { logroll: buildLogroll, vine: buildVine, scout: buildScout, sticks: buildSticks, pad: buildPad };
  for (const def of SPECIAL) { const S = SITES.find(s => s.id === def.site); builders[S.kind](S, def); }

  function collect(pz, id, team, x, y, z) {
    if (pz.done) return; pz.done = true; const first = !E.save.journal[pz.id]; if (first) E.save.journal[pz.id] = { team, t: Date.now() }; if (E.roundDone) E.roundDone[pz.id] = true; E.persist();
    pz.prizeG.visible = false; pz.beam.visible = false; pz.badgeS.visible = false;
    E.fx.burst(x, y, z, 60, 9); E.reward(id, pz.def, first);
    E.toast(`📖 New journal page: ${pz.def.icon} ${pz.def.name}!`, 4200); E.onJournal && E.onJournal(pz);
  }
  E.collect = collect;
  for (const pz of puzzles) if (pz.done) { pz.prizeG.visible = false; pz.beam.visible = false; pz.badgeS.visible = false; }

  const api = {
    puzzles, total: puzzles.length, count: () => puzzles.filter(p => p.done).length,
    tryPush(p, sp, dt, t) { for (const pz of puzzles) if (pz.tryPush && !pz.done && pz.tryPush(p, sp, dt, t)) return true; return false; },
    onAction(p, sp, cur, t) { for (const pz of puzzles) if (pz.onAction && pz.onAction(p, sp, cur, t)) return true; return false; },
    update(dt, t, cur) {
      const p = P[cur], cp = E.camera.position;
      for (const pz of puzzles) {
        pz.update && pz.update(dt, t, cur);
        const far = Math.hypot(pz.hintPos.x - cp.x, pz.hintPos.z - cp.z);
        if (!pz.done) {
          pz.badgeS.visible = far < 70; const sc = 1 + Math.min(1.1, far / 60); pz.badgeS.scale.set(6.4 * sc * 0.8, 3.2 * sc * 0.8, 1); pz.badgeS.position.y += (Math.sin(t * 2 + pz.S.x) * 0.002);
          pz.beam.material.opacity = (pz.beam.material.opacity > 0.25 ? pz.beam.material.opacity : 0.14 + 0.06 * Math.sin(t * 2 + pz.S.z));
          if (pz.prizeG.visible) { pz.prizeG.rotation.y = t * 1.4; pz.prizeG.position.y = pz.prize.y + Math.sin(t * 2.2) * 0.15; pz.prizeHalo.material.opacity = pz.prizeHalo.material.opacity; }
          if (pz.prizeG.visible && pz.prize) {
            const dx = p.x - pz.prize.x, dz = p.z - pz.prize.z, dy = p.y + 0.6 - pz.prize.y;
            if (dx * dx + dz * dz < 2.0 * 2.0 && Math.abs(dy) < 2.6) {
              const r = pz.canCollect(cur);
              if (r.ok) collect(pz, cur, r.team, pz.prize.x, pz.prize.y, pz.prize.z);
              else if (r.msg && t - pz.msgT > 3.5) { pz.msgT = t; E.toast(r.msg, 2800); }
            }
          }
        }
      }
    },
    /** Which step is next for the nearest unsolved puzzle within reach of the current animal */
    suggestion(cur) {
      const p = P[cur]; let best = null, bd = 1e9;
      for (const pz of puzzles) { if (pz.done) continue; const d = Math.hypot(pz.hintPos.x - p.x, pz.hintPos.z - p.z); if (d < 38 && d < bd) { bd = d; best = pz; } }
      if (!best) return null; const st = best.nextStep(cur); return { puzzle: best, ...st };
    },
    apply() {},
  };
  return api;
}
