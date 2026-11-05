// Valley zones: 8 rising-complexity levels + 5 vertical set pieces (preview only).
// Each patch gets its own layout of solids, tiered pickups, team lifts and builder-gated stairs.
import * as THREE from 'three';
import { WATER_RECTS } from './data.js';

export const SIZE = { bee: 'tiny', butterfly: 'tiny', hummingbird: 'tiny', moth: 'tiny', bat: 'tiny', bumblebee: 'medium', robin: 'medium', raccoon: 'medium', opossum: 'medium', bear: 'bear' };
export const FLYERS = new Set(['bee', 'butterfly', 'hummingbird', 'moth', 'bat', 'bumblebee', 'robin']);
const NEED = { team: { tiny: 3, medium: 2, bear: 1 }, heavy: { tiny: 5, medium: 3, bear: 1 }, heaviest: { tiny: 5, medium: 3, bear: 2 } };
const TIER = {
  petal: { name: 'Petal', em: '🌸', col: 0xff8fc8, heal: 0.012, geo: () => new THREE.OctahedronGeometry(0.55) },
  dew: { name: 'Dewdrop', em: '💧', col: 0x7fd8ff, heal: 0.025, geo: () => new THREE.SphereGeometry(0.5, 12, 10) },
  star: { name: 'Starseed', em: '⭐', col: 0xffe066, heal: 0.15, geo: () => new THREE.IcosahedronGeometry(0.7) },
};
const NODE = { team: { name: 'Honey Log', tier: 'petal', amt: 6 }, heavy: { name: 'Dew Pond', tier: 'dew', amt: 4 }, heaviest: { name: 'Starheart', tier: 'star', amt: 1 } };

// ---- zone recipes (coordinates relative to anchor; y = height above ground at anchor) ----
const Z = {
  sunny_hollow: { goal: 'Collect 8 Petals', pick: 8, build() {
    this.mound(-6, 4, 1.2, 3); this.mound(5, 8, 1.0, 2.5); this.mound(0, 14, 1.4, 3.5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; this.pickup('petal', Math.cos(a) * 11, 8 + Math.sin(a) * 9, 0.8); }
    this.pickup('petal', -6, 4, 2.2); this.pickup('petal', 0, 14, 2.4);
  } },
  creek_bend: { goal: 'Lift the Honey Log on the top bank', key: 'node', build() {
    // creek strip + stepped creek banks (3 terraces)
    this.water(0, 10, 28, 5);
    [[1.2, 14.5], [2.6, 18], [4.0, 21.5]].forEach(([h, z], i) => { this.box(0, z, 12 - i * 2, 1.8, h, 0x6faa4a); this.pickup('petal', -3 + i * 3, z, h + 0.8); this.pickup('petal', 3 - i * 2, z, h + 0.8); });
    // log hops placed by bear/opossum
    this.builder('Log hops', ['bear', 'opossum'], 0, 13, [[-2, 12.6, 0.7, 1.3], [1, 14.5, 1.9, 1.0], [-1, 17, 3.3, 1.0], [2, 20, 4.6, 1.0]]);
    this.node('team', 0, 22, 4.0);
    for (let i = 0; i < 6; i++) this.pickup('petal', -10 + i * 4, 4, 0.8);
  } },
  moon_meadow: { goal: 'Bring down the crown Dewdrops', night: true, key: 'pick', pick: 5, build() {
    // Hollow tree climb: ring of trunk staves with inner ledges, mid window + crown
    const R = 4.2, cx = 0, cz = 14;
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; if (i === 3 || i === 10) continue; this.cyl(cx + Math.cos(a) * R, cz + Math.sin(a) * R, 0.9, 13, 0x5a3b22); }
    [[2, 0], [4.5, 2.1], [7, 4.2], [9.5, 0.9], [12, 3.1]].forEach(([h, a]) => this.cyl(cx + Math.cos(a) * 2.2, cz + Math.sin(a) * 2.2, 1.2, h, 0x7a5636, 0.4));
    this.cyl(cx, cz, 5.4, 13.6, 0x3f7a35, 0.5); // crown deck
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; this.pickup('dew', cx + Math.cos(a) * 3, cz + Math.sin(a) * 3, 14.4); }
    this.pickup('dew', cx + 5, cz, 7.5); // mid window
    // opossum root tunnel: low arch only opossum unlocks
    this.builder('Root tunnel', ['opossum'], -7, 14, [[-6, 12, 0.8, 1.6], [-4.8, 14, 1.8, 1.4], [-4, 16, 3.0, 1.2]]);
    for (let i = 0; i < 8; i++) this.pickup('petal', -12 + i * 3.4, 4, 0.8);
  } },
  log_jam: { goal: 'Shove timber into a ramp and clear the jam', key: 'node', build() {
    this.box(0, 18, 14, 3, 5, 0x7a5636); // timber wall
    this.box(0, 23, 14, 6, 5, 0x6faa4a); // upper floor
    this.builder('Timber ramp', ['bear'], 0, 13, [[-3, 13.5, 1.2, 1.4], [-1, 14.5, 2.4, 1.4], [1, 15.5, 3.6, 1.4], [3, 16.5, 4.8, 1.4]]);
    this.node('team', -4, 23, 5); this.node('team', 4, 23, 5); this.node('heavy', 0, 6, 0);
    for (let i = 0; i < 6; i++) this.pickup('petal', -5 + i * 2, 23, 5.8);
  } },
  picnic_lawn: { goal: 'Lift a Dew Pond on the picnic table', key: 'node', build() {
    this.box(-6, 12, 3, 3, 1.2, 0xd94c4c, 0.15); // blanket
    this.box(3, 14, 6, 3.5, 3.2, 0xc69c6d); // table top
    [[-2.5, -1.5], [2.5, -1.5], [-2.5, 1.5], [2.5, 1.5]].forEach(([x, z]) => this.cyl(3 + x, 14 + z, 0.3, 3, 0x8b5e3c));
    this.cyl(-6, 18, 1.8, 2, 0xc8a060); this.cyl(-2, 20, 1.4, 1.2, 0xb8904f); // baskets as steps
    this.node('heavy', 3, 14, 3.2); this.node('heavy', -8, 4, 0);
    for (let i = 0; i < 5; i++) this.pickup('dew', 1 + i, 14, 4); for (let i = 0; i < 5; i++) this.pickup('petal', -6 + i, 12, 2);
  } },
  cliff_orchard: { goal: 'Heavy pick on the top ledge', key: 'node', build() {
    // Cliff orchard ledges: 3 stacked rock shelves
    [[3, 14, 0x9a9a98], [6, 18, 0x8f8f8c], [9, 22, 0x858582]].forEach(([h, z, c]) => { this.box(0, z, 16, 4, h, c); this.pickup('petal', -5, z, h + 0.8); this.pickup('petal', 5, z - 2.2, h - 1.5); /* hanging under lip */ });
    this.builder('Boulder stair', ['bear'], -9, 12, [[-9, 11.5, 1.5, 1.6], [-9, 13.2, 3.0, 1.4], [-9, 16, 4.5, 1.4], [-9, 17.4, 6.0, 1.3], [-9, 20, 7.5, 1.3], [-9, 21.5, 9, 1.3]]);
    this.node('heavy', 0, 22, 9);
    for (let i = 0; i < 4; i++) this.pickup('dew', -4 + i * 2.6, 22, 10.8);
  } },
  windy_rise: { goal: 'Free the Honey Log in the canopy fork', key: 'node', build() {
    const towers = [[-10, 10], [0, 16], [10, 10], [0, 26]];
    towers.forEach(([x, z]) => { this.cyl(x, z, 1.8, 12, 0x6b4a30); this.cyl(x, z, 3.2, 12.4, 0x4f8a3a, 0.4); });
    // canopy bridges: silk lines as thin walkable boxes
    const bridge = (a, b) => { const [x1, z1] = towers[a], [x2, z2] = towers[b], mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1); this.box(mx, mz, L, 1.1, 12.3, 0xf3eee0, 0.15, Math.atan2(-(z2 - z1), x2 - x1)); for (let k = 1; k < 4; k++) this.pickup('petal', x1 + (x2 - x1) * k / 4, z1 + (z2 - z1) * k / 4, 13.2); };
    bridge(0, 1); bridge(1, 2); bridge(1, 3);
    // wind streamers: updrafts lift anyone; flyers more
    this.updraft(-10, 4, 14); this.updraft(10, 4, 14);
    this.builder('Vine ladder', ['bear', 'opossum'], -6, 6, [[-8, 7, 2, 1.3], [-9, 8, 4.5, 1.2], [-10, 7, 7, 1.2], [-9.5, 9, 9.5, 1.2]]);
    this.node('team', 0, 26, 12.4);
  } },
  festival_glade: { goal: 'Carry the Starheart down safely', key: 'star', build() {
    // mix: creek strip, log hops, table, ledge + Lookout knoll spiral of mushroom caps
    this.water(-14, 4, 8, 4); this.box(12, 6, 5, 3.5, 3, 0xc69c6d); this.node('team', 12, 6, 3);
    this.builder('Festival stair', ['bear', 'opossum'], 6, 10, [[5, 11, 1.2, 1.3], [4, 12.5, 2.4, 1.3]]);
    const caps = []; for (let i = 0; i < 9; i++) { const a = i * 0.9, h = 1.6 + i * 1.6, x = Math.cos(a) * 5, z = 18 + Math.sin(a) * 5; this.cyl(x, z, 0.5, h - 0.3, 0xf1e7d0); this.cyl(x, z, 2.0, h, [0xe0443a, 0xf08a2c, 0xb55bd6, 0x2fb7a6][i % 4], 0.3); caps.push([x, z, h]); if (i % 2) this.hoop(x, z, h + 2.2); this.pickup(i < 5 ? 'dew' : 'petal', x, z, h + 0.9); }
    this.cyl(0, 18, 2.6, 16.5, 0xf2c230, 0.4); this.cyl(0, 18, 0.7, 16.2, 0xf1e7d0);
    this.starheart(0, 18, 16.5, caps);
  } },
};

export function createZones(scene, ctx) {
  // ctx: { phys, heightAt, toast, audio, fx, getP(), cur(), crewIds(), parked(id), helpers(), addHeal(n), setNight(v) }
  const group = new THREE.Group(); scene.add(group);
  let solids = [], picks = [], nodes = [], builds = [], drafts = [], hoops = [], star = null, A = { x: 0, z: 0, y: 0 }, recipe = null, id = null, picked = 0, keyDone = false, msgT = 0, t = 0;
  const mats = new Map(); const mat = (c, e = 0) => { const k = c + ':' + e; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e, flatShading: true })); return mats.get(k); };
  const gy = (x, z) => ctx.heightAt(A.x + x, A.z + z);
  const B = {
    // solid box top at h above local ground (thickness th)
    box(x, z, w, d, h, c, th, yaw = 0, hidden) {
      const g = gy(x, z), T = th || h + 1.5, m = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), mat(c)); m.position.set(A.x + x, g + h - T / 2, A.z + z); m.rotation.y = yaw; group.add(m);
      const s = { type: 'box', x: A.x + x, z: A.z + z, hx: w / 2, hz: d / 2, yaw: -yaw, y0: g + h - T, top: g + h, kind: 'zone' }; ctx.phys.addDyn(s); solids.push(s); if (hidden) { m.visible = false; s.off = true; } return { m, s };
    },
    cyl(x, z, r, h, c, th, hidden) {
      const g = gy(x, z), T = th || h + 1.5, m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, T, 12), mat(c)); m.position.set(A.x + x, g + h - T / 2, A.z + z); group.add(m);
      const s = { type: 'cyl', x: A.x + x, z: A.z + z, r, y0: g + h - T, top: g + h, kind: 'zone' }; ctx.phys.addDyn(s); solids.push(s); if (hidden) { m.visible = false; s.off = true; } return { m, s };
    },
    mound(x, z, h, r) { this.cyl(x, z, r, h, 0x7cc35a, h + 0.6); },
    water(x, z, w, d) { // narrow stream with sandy banks: hop or fly over it
      d = Math.min(d, 3.2); const g = gy(x, z);
      const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d + 2.2), mat(0xe6cf8f)); bank.position.set(A.x + x, g + 0.05, A.z + z); group.add(bank);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), new THREE.MeshLambertMaterial({ color: 0x2f8fe0, emissive: 0x0b3a66, transparent: true, opacity: 0.9 })); m.position.set(A.x + x, g + 0.12, A.z + z); group.add(m);
      WATER_RECTS.push({ x: A.x + x, z: A.z + z, hw: w / 2, hd: d / 2 }); },
    pickup(tier, x, z, h) { const T = TIER[tier], m = new THREE.Mesh(T.geo(), mat(T.col, 0.8)); m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m); picks.push({ tier, m, y: m.position.y, got: false }); },
    node(kind, x, z, h) {
      const N = NODE[kind], col = TIER[N.tier].col, m = new THREE.Group();
      const body = new THREE.Mesh(kind === 'team' ? new THREE.CylinderGeometry(0.9, 0.9, 3, 10).rotateZ(Math.PI / 2) : kind === 'heavy' ? new THREE.CylinderGeometry(1.6, 1.8, 0.6, 16) : new THREE.DodecahedronGeometry(1.1), mat(kind === 'team' ? 0xb07a32 : col, kind === 'team' ? 0.15 : 0.7));
      body.position.y = kind === 'heavy' ? 0.3 : 1; m.add(body);
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); ring.position.y = 0.08; m.add(ring);
      m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m);
      const label = document.createElement('div'); label.className = 'zoneNode'; document.body.appendChild(label);
      nodes.push({ kind, m, body, label, done: false, wob: 0 });
    },
    builder(name, who, x, z, steps) {
      const ghost = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 })); ghost.position.set(A.x + x, gy(x, z) + 0.3, A.z + z); group.add(ghost);
      const parts = steps.map(([sx, sz, h, r]) => this.cyl(sx, sz, r, h, 0x8b6a45, Math.min(h + 1, 1.6), true));
      builds.push({ name, who, x: A.x + x, z: A.z + z, ghost, parts, done: false });
    },
    updraft(x, z, h) { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, h, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); m.position.set(A.x + x, gy(x, z) + h / 2, A.z + z); group.add(m); drafts.push({ x: A.x + x, z: A.z + z, top: gy(x, z) + h, m }); },
    hoop(x, z, h) { const m = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.15, 8, 24), mat(0xff6bd6, 0.6)); m.position.set(A.x + x, gy(x, z) + h, A.z + z); group.add(m); hoops.push({ m, got: false }); },
    starheart(x, z, h, caps) { this.node('heaviest', x, z, h); star = { node: nodes[nodes.length - 1], caps: caps.map(([cx, cz, ch]) => ({ x: A.x + cx, z: A.z + cz, y: gy(cx, cz) + ch })), carry: false, safe: { x: A.x, z: A.z + 2 }, mesh: null, lastY: 0, dropped: 0 }; },
  };
  const say = (s, d = 2200) => { if (t - msgT > 1.6) { msgT = t; ctx.toast(s, d); } };
  function clear() {
    WATER_RECTS.length = 0;
    for (const s of solids) s.off = true; // dyn solids stay in list but inert
    solids = []; picks = []; builds = []; drafts = []; hoops = []; star = null;
    for (const n of nodes) n.label.remove(); nodes = [];
    while (group.children.length) { const c = group.children.pop(); c.traverse?.(o => o.geometry?.dispose?.()); }
    id = null; recipe = null;
  }
  function load(pid, anchor) {
    clear(); recipe = Z[pid]; if (!recipe) return; id = pid; picked = 0; keyDone = false;
    A = { x: anchor.x, z: anchor.z };
    recipe.build.call(B);
    if (recipe.night) ctx.setNight(true);
    ctx.toast(`🎯 ${recipe.goal}`, 3600);
  }
  function crewAt(x, z, r) {
    const p = ctx.getP(); let n = Math.hypot(p.x - x, p.z - z) < r ? 1 : 0;
    for (const cid of ctx.crewIds()) { if (cid === ctx.cur()) continue; const q = ctx.parked(cid); if (q && Math.hypot(q.x - x, q.z - z) < r) n++; }
    for (const h of ctx.helpers()) if (Math.hypot(h.x - x, h.z - z) < r) n++;
    return n;
  }
  const keyGoalMet = () => !recipe || keyDone;
  function complete(why) { if (keyDone) return; keyDone = true; ctx.toast(`✅ ${why} — this zone can heal fully now!`, 3200); ctx.audio?.chime?.(); }
  function update(dt, cam) {
    if (!recipe) return; t += dt;
    const p = ctx.getP(), cur = ctx.cur(), size = SIZE[cur] || 'medium';
    for (const k of picks) {
      if (k.got) continue; k.m.rotation.y += dt * 2; k.m.position.y = k.y + Math.sin(t * 2 + k.y) * 0.15;
      if (Math.hypot(p.x - k.m.position.x, p.z - k.m.position.z) < 1.5 && Math.abs(p.y + 0.6 - k.m.position.y) < 1.8) {
        k.got = true; k.m.visible = false; ctx.addHeal(TIER[k.tier].heal); ctx.audio?.sample?.('ui2/pickup', 0.4); picked++;
        if (recipe.key === 'pick' && k.tier === 'dew' && ++keyDew >= recipe.pick) complete('Crown Dewdrops gathered');
        if (!recipe.key && picked >= recipe.pick) complete('Petals gathered');
      }
    }
    for (const b of builds) {
      if (b.done) { continue; }
      b.ghost.rotation.y += dt; const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < 2.6) {
        if (b.who.includes(cur)) { b.done = true; b.ghost.visible = false; b.parts.forEach(q => { q.m.visible = true; q.s.off = false; }); ctx.toast(`🪵 ${b.name} built! Walkers can climb it now.`, 2600); ctx.audio?.chime?.(); }
        else say(`🔨 ${b.name}: swap to ${b.who.map(w => w === 'bear' ? '🐻 Bear' : '🐾 Opossum').join(' or ')} to build this`);
      }
    }
    for (const w of drafts) if (FLYERS.has(cur) || cur === 'moth') { if (Math.hypot(p.x - w.x, p.z - w.z) < 1.6 && p.y < w.top) p.vy = Math.max(p.vy || 0, cur === 'butterfly' ? 12 : 8); }
    else if (Math.hypot(p.x - w.x, p.z - w.z) < 1.6 && p.y < w.top - 6) p.vy = Math.max(p.vy || 0, 7);
    for (const h of hoops) if (!h.got && p.position !== 0 && Math.hypot(p.x - h.m.position.x, p.z - h.m.position.z) < 1.6 && Math.abs(p.y - h.m.position.y) < 1.6) { h.got = true; h.m.material = mat(0x8be07a, 0.6); ctx.addHeal(0.01); ctx.toast('💫 Race hoop!', 1000); }
    for (const n of nodes) {
      if (n.done) { n.label.style.display = 'none'; continue; }
      n.body.rotation.y += dt * 0.4;
      const need = NEED[n.kind][size], have = crewAt(n.m.position.x, n.m.position.z, 4.2), pd = Math.hypot(p.x - n.m.position.x, p.z - n.m.position.z);
      // label in screen space
      const v = n.m.position.clone(); v.y += 3; v.project(cam);
      const on = v.z < 1 && pd < 30; n.label.style.display = on ? 'block' : 'none';
      if (on) { n.label.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; n.label.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; n.label.textContent = `${NODE[n.kind].name} ${'🐾'.repeat(Math.min(have, need))}${'◯'.repeat(Math.max(0, need - have))}`; }
      if (pd < 3.2 && Math.abs(p.y - n.m.position.y) < 3) {
        if (have >= need) {
          n.done = true; const N = NODE[n.kind]; ctx.addHeal(TIER[N.tier].heal * N.amt); ctx.toast(`💪 Everyone lifts together! +${N.amt} ${TIER[N.tier].em} ${TIER[N.tier].name}${N.amt > 1 ? 's' : ''}`, 2600); ctx.audio?.chime?.();
          if (star && n === star.node) { star.carry = true; star.mesh = n.body; n.m.remove(n.body); group.add(n.body); ctx.toast('⭐ Carry the Starheart down to the start ring — gently!', 3200); }
          else { n.m.visible = false; if (recipe.key === 'node') complete(`${N.name} lifted`); }
        } else { n.wob = 0.5; say(`😅 Too heavy! Bring more friends. (${have}/${need}) — use the Command wheel to send helpers`); }
      }
      if (n.wob > 0) { n.wob -= dt; n.body.rotation.z = Math.sin(t * 40) * 0.12 * n.wob; } else n.body.rotation.z = 0;
    }
    if (star && star.carry) {
      const s = star; s.mesh.position.set(p.x, p.y + 2.4, p.z); s.mesh.rotation.y += dt * 2;
      const vy = (p.y - s.lastY) / Math.max(dt, 1e-3); s.lastY = p.y;
      if (vy < -14 && t - s.dropped > 1.5) { // fell: drop onto nearest lower cap, never off the map
        s.dropped = t; s.carry = false; const low = s.caps.filter(c => c.y < p.y).sort((a, b) => b.y - a.y)[0] || s.caps[0];
        s.mesh.position.set(low.x, low.y + 1, low.z); const nn = star.node; nn.done = false; nn.m.position.set(low.x, low.y, low.z); nn.m.add(s.mesh); s.mesh.position.set(0, 1, 0); nn.m.visible = true;
        ctx.toast('💫 Whoops! The Starheart bounced onto a lower cap. Go get it!', 2800);
      } else if (Math.hypot(p.x - s.safe.x, p.z - s.safe.z) < 4 && p.y < gy(0, 2) + 2) {
        s.carry = false; s.mesh.visible = false; star = null; complete('Starheart carried home');
      }
    }
  }
  let keyDew = 0; const _load = load;
  return { load: (a, b) => { keyDew = 0; _load(a, b); }, clear, update, keyGoalMet, goal: () => recipe?.goal || '', active: () => !!recipe, NEED, SIZE };
}
