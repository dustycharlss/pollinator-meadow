// Resource tiers (Petals / Dewdrops / Starseeds), team-lift nodes and species-building effects.
import * as THREE from 'three';
import { WATER_Y, POND } from './data.js';
import { TIER_LOOK, CATALOG } from './build.js';

export const SIZE_CLASS = { bee: 'tiny', butterfly: 'tiny', hummingbird: 'tiny', moth: 'tiny', bat: 'tiny', bumblebee: 'medium', robin: 'medium', raccoon: 'medium', opossum: 'medium', bear: 'bear' };
const CLASS_ICON = { tiny: '🐝', medium: '🦝', bear: '🐻' };
export const TEAM = {
  honeylog: { name: 'Honey Log', icon: '🪵', need: { tiny: 3, medium: 2, bear: 1 }, pay: { p: 15 } },
  dewpond: { name: 'Dew Pond', icon: '🫧', need: { tiny: 5, medium: 3, bear: 1 }, pay: { d: 5 } },
  starheart: { name: 'Starheart', icon: '💜', need: { tiny: 5, medium: 3, bear: 2 }, pay: { s: 1 } },
};
export const KID = {
  p: 'Petals are everywhere. Grab as many as you like!',
  d: 'Dewdrops! Catch them all before the sun dries them up.',
  s: 'A Starseed! Carry it home gently — no stopping.',
  heavy: 'Too heavy! Bring more friends.',
  build: "You're placing a building. Look around, then tap to set it down.",
};
const col = k => new THREE.Color(TIER_LOOK[k].col);
function glowTex(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, hex); g.addColorStop(0.35, hex + 'aa'); g.addColorStop(1, hex + '00'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(t0(c)); return t;
}
const t0 = c => c;
function glow(k, s) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(TIER_LOOK[k].col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.scale.setScalar(s); return m; }
function starGeo(r = 0.7) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false }).center(); }
function dropMesh(s = 0.45) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: col('d') }); const b = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), m); const c = new THREE.Mesh(new THREE.ConeGeometry(s * 0.86, s * 1.5, 12), m); c.position.y = s * 1.05; g.add(b, c); return g; }
function starMesh(r) { return new THREE.Mesh(starGeo(r), new THREE.MeshBasicMaterial({ color: col('s') })); }
function label() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false })); s.scale.set(8, 2, 1); s.renderOrder = 12; let last = '';
  s.userData.set = (txt, warn) => { if (txt + warn === last) return; last = txt + warn; const x = c.getContext('2d'); x.clearRect(0, 0, 512, 128); x.font = 'bold 56px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(20,30,40,.85)'; x.strokeText(txt, 256, 64); x.fillStyle = warn ? '#ffb0a0' : '#fff6b0'; x.fillText(txt, 256, 64); tex.needsUpdate = true; };
  return s;
}

export function createTiers(scene, ctx) {
  const { heightAt, round, fx, toast, audio } = ctx;
  const TI = { carrying: false, speedMul: 1, noDrain: false, nodes: [], clusters: [], seeds: [], team: [], said: {}, logs: 0, cd: {}, combo: { n: 0, t: 0 }, rainbowT: 0, songT: 0, boostT: 0 };
  const root = new THREE.Group(); scene.add(root);
  const land = (tries = 40, rMax = 120) => { for (let i = 0; i < tries; i++) { const a = Math.random() * 6.283, d = 25 + Math.random() * rMax, x = Math.cos(a) * d, z = Math.sin(a) * d; if (heightAt(x, z) > WATER_Y + 0.8 && Math.hypot(x - POND.x, z - POND.z) > POND.r + 4) return { x, z }; } return { x: 30, z: 30 }; };
  const say = (k, ms = 3200) => { if (TI.said[k]) return; TI.said[k] = 1; toast((k === 'p' ? '🌼 ' : k === 'd' ? '💧 ' : k === 's' ? '🌟 ' : '') + KID[k], ms); };
  TI.say = say;
  const P = () => ctx.player(), sp = () => ctx.cur();
  const cls = id => SIZE_CLASS[id] || 'medium';
  // ---------- T2 Dewdrop clusters
  function spawnCluster(at) {
    const c = at || land(); const cl = { x: c.x, z: c.z, drops: [], t0: 0, live: true, g: new THREE.Group() };
    for (let i = 0; i < 5; i++) { const a = i * 1.2566 + Math.random() * 0.4, r = 1.2 + Math.random() * 2.2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, y = heightAt(x, z) + 1.2; const m = dropMesh(); m.position.set(x, y, z); const gl = glow('d', 2.4); gl.position.copy(m.position); cl.g.add(m, gl); cl.drops.push({ x, y, z, m, gl, got: false }); }
    cl.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 6, 1, true), new THREE.MeshBasicMaterial({ color: col('d'), transparent: true, opacity: 0.35, depthWrite: false })); cl.beam.position.set(c.x, heightAt(c.x, c.z) + 7, c.z); cl.beam.visible = false; cl.g.add(cl.beam);
    root.add(cl.g); TI.clusters.push(cl); return cl;
  }
  function killCluster(cl) { cl.live = false; root.remove(cl.g); TI.clusters.splice(TI.clusters.indexOf(cl), 1); }
  // ---------- T3 Starseed nodes (escort)
  function spawnSeed(x, z, y) {
    const g = new THREE.Group(); const m = starMesh(0.8); const gl = glow('s', 4); g.add(m, gl);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 22, 6, 1, true), new THREE.MeshBasicMaterial({ color: col('s'), transparent: true, opacity: 0.4, depthWrite: false })); beam.position.y = 11; beam.visible = false; g.add(beam);
    const yy = y ?? Math.max(heightAt(x, z), WATER_Y) + 1.4; g.position.set(x, yy, z); root.add(g); const s = { x, z, y: yy, g, m, beam }; TI.seeds.push(s); return s;
  }
  const carryObj = new THREE.Group(); { carryObj.add(starMesh(0.55), glow('s', 2.6)); carryObj.visible = false; scene.add(carryObj); }
  TI.drop = (why) => { if (!TI.carrying) return; const p = P(); TI.carrying = false; carryObj.visible = false; spawnSeed(p.x, p.z); toast(why === 'water' ? '🌊 Splash! The Starseed slipped — it is floating right here. Pick it back up!' : '🌵 Ouch! You dropped the Starseed — it is right here.', 2600); ctx.onChange?.(); };
  TI.liftHive = () => sp() === 'bumblebee' && ctx.build.count('lift_hive') > 0;
  TI.onSnag = () => { if (TI.carrying && !TI.liftHive()) TI.drop('thorn'); };
  // ---------- team nodes
  function spawnTeam(kind, at) {
    const D = TEAM[kind], c = at || land(); const g = new THREE.Group(), y = heightAt(c.x, c.z);
    let body;
    if (kind === 'honeylog') { body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 4.2, 10), new THREE.MeshLambertMaterial({ color: 0x8a5a2b })); body.rotation.z = Math.PI / 2; body.position.y = 0.9; const hp = glow('p', 4); hp.position.y = 1.6; g.add(hp); for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: col('p') })); f.position.set(-1.5 + i * 0.6, 2, Math.sin(i) * 0.4); g.add(f); } }
    else if (kind === 'dewpond') { body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 16), new THREE.MeshLambertMaterial({ color: 0x3aa7c7 })); body.position.y = 0.3; for (let i = 0; i < 5; i++) { const d = dropMesh(0.4); d.position.set(Math.cos(i * 1.256) * 1.2, 1.1, Math.sin(i * 1.256) * 1.2); g.add(d); } const gl = glow('d', 6); gl.position.y = 1.2; g.add(gl); }
    else { body = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4), new THREE.MeshLambertMaterial({ color: 0x6b3fa0 })); body.position.y = 1.4; const st = starMesh(0.9); st.position.y = 3.4; g.add(st, glow('s', 6)); g.children.at(-1).position.y = 3.4; }
    g.add(body); const lb = label(); lb.position.y = 5.2; g.add(lb);
    g.position.set(c.x, y, c.z); root.add(g);
    const n = { kind, x: c.x, z: c.z, g, lb, body, lift: 0, wob: 0, msgT: -9, live: true, back: 0 }; TI.team.push(n); return n;
  }
  TI.strengthAt = n => {
    const p = P(), id = sp(); let s = 0, bodies = [];
    if (Math.hypot(p.x - n.x, p.z - n.z) < 5.5) { bodies.push(id); if (id === 'bear' && ctx.build.near('shove_stump', p.x, p.z)) bodies.push('bear'); }
    const H = ctx.helpers(); for (const h of (H ? H.list : [])) if (!h.possessed && Math.hypot(h.x - n.x, h.z - n.z) < 7) bodies.push(h.sp);
    for (const b of bodies) s += 1 / TEAM[n.kind].need[cls(b)];
    return { s, bodies };
  };
  TI.nearestTeam = (x, z) => { let b = null, bd = 1e9; for (const n of TI.team) if (n.live) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; b = n; } } return b; };
  TI.sendHelpers = () => { const p = P(), n = TI.nearestTeam(p.x, p.z), H = ctx.helpers(); if (!n) { toast('No team lift nearby right now'); return; } const hl = H ? H.list.filter(h => !h.possessed) : []; if (!hl.length) { toast('🐾 No helpers yet — hire one from 📣 Command'); return; } hl.forEach((h, i) => H.command(h, 'move', n.x + Math.cos(i) * 2.5, n.z + Math.sin(i) * 2.5)); toast(`🤝 Helpers: help lift the ${TEAM[n.kind].name}!`, 1800); ctx.ping?.(n.x, n.z); };
  function payTeam(n) {
    const D = TEAM[n.kind]; n.live = false; n.g.visible = false; n.back = round.elapsed + 55; fx.burst(n.x, heightAt(n.x, n.z) + 2, n.z, 50, 8); audio.chime?.();
    if (D.pay.s) { if (TI.carrying) round.addRes('s', 1); else { TI.carrying = true; say('s'); } toast('💜 Team lift! You freed a Starseed — carry it home gently.', 2600); }
    else { for (const k in D.pay) round.addRes(k, D.pay[k]); toast(`🤝 Team lift! +${D.pay.p || D.pay.d} ${D.pay.p ? '🌼 Petals' : '💧 Dewdrops'}`, 2200); }
    round.add('explore', 30); round.stats.teamLifts = (round.stats.teamLifts || 0) + 1; ctx.onChange?.();
  }
  // ---------- round lifecycle
  TI.reset = () => {
    for (const c of [...TI.clusters]) killCluster(c); for (const s of TI.seeds) root.remove(s.g); TI.seeds.length = 0; for (const n of TI.team) root.remove(n.g); TI.team.length = 0;
    TI.carrying = false; carryObj.visible = false; TI.logs = 0; TI.cd = {}; TI.spawnT = 0; TI.said = {};
    spawnCluster(); spawnCluster();
    const nS = 1 + (Math.random() < 0.5 ? 1 : 0); for (let i = 0; i < nS; i++) { const c = land(30, 150); spawnSeed(c.x, c.z); }
    spawnTeam('honeylog'); spawnTeam('honeylog'); spawnTeam('dewpond', { x: POND.x + (POND.r + 5), z: POND.z }); spawnTeam('starheart', land(30, 140));
  };
  TI.serialize = () => ({ carrying: TI.carrying, seeds: TI.seeds.map(s => [+s.x.toFixed(1), +s.z.toFixed(1)]) });
  TI.restore = s => { TI.reset(); if (!s) return; for (const q of TI.seeds) root.remove(q.g); TI.seeds.length = 0; for (const [x, z] of s.seeds || []) spawnSeed(x, z); TI.carrying = !!s.carrying; };
  // ---------- building effects helpers
  const near = (t, pad) => { const p = P(); return ctx.build.near(t, p.x, p.z, pad); };
  const lv = b => b ? (b.lv || 1) : 0;
  const cool = (k, s, t) => { if ((TI.cd[k] || 0) > t) return false; TI.cd[k] = t + s; return true; };
  const pair = t => { const L = ctx.build.placed.filter(b => b.type === t); return L.length >= 2 ? L : null; };
  const segDist = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1; let u = ((p.x - a.x) * dx + (p.z - a.z) * dz) / L; u = Math.max(0, Math.min(1, u)); return Math.hypot(a.x + dx * u - p.x, a.z + dz * u - p.z); };
  /** extra petals on each pick (apiary followers, nest grove, combo garden) */
  TI.onPick = (n, t) => {
    say('p'); let extra = 0; const p = P(), id = sp(), B = ctx.build;
    const ap = B.placed.filter(b => b.type === 'apiary'); if (ap.length) { const H = ctx.helpers(); const f = H ? H.list.filter(h => !h.possessed && h.job && h.job.kind === 'move' && Math.hypot(h.x - p.x, h.z - p.z) < 12).length : 0; extra += Math.min(f, 2 + Math.max(...ap.map(lv))) * (n ? 1 : 0); }
    const ng = B.placed.filter(b => b.type === 'nest_grove'); if (ng.length) extra += Math.max(...ng.map(lv));
    const cg = near('combo_garden'); if (cg) { TI.combo.n = t - TI.combo.t < 2.5 ? TI.combo.n + 1 : 1; TI.combo.t = t; const m = TI.combo.n >= 6 ? 3 : TI.combo.n >= 3 ? 2 : 1; if (m > 1) { extra += n * (m - 1) * (lv(cg) >= 2 ? 1 : 0.5) | 0; if (TI.combo.n === 3 || TI.combo.n === 6) toast(`🎯 Combo ×${m}!`, 900); } }
    return extra;
  };
  /** Act near a species building. Returns true if used. */
  TI.act = t => {
    const p = P(), B = ctx.build, H = ctx.helpers();
    if (TI.logs > 0 && sp() === 'opossum') { const y = heightAt(p.x, p.z); ctx.addStep?.(p.x + Math.sin(ctx.yaw()) * 1.6, y, p.z + Math.cos(ctx.yaw()) * 1.6); TI.logs--; toast(`🪵 Log step placed (${TI.logs} left)`, 1200); return true; }
    let b;
    if ((b = near('waggle_stage', 2))) { const hl = H ? H.list.filter(h => !h.possessed) : []; hl.forEach(h => H.command(h, 'gather', b.x, b.z)); TI.songT = t; toast(`🌻 Waggle dance! ${hl.length} helper${hl.length === 1 ? '' : 's'} gather here`, 1800); ctx.ping?.(b.x, b.z); return true; }
    if ((b = near('chrysalis', 1)) || (b = near('hollow_log', 1))) { const o = B.placed.find(q => q.type === b.type && q !== b); if (!o) { toast(`Build a second ${CATALOG[b.type].name} to travel between them`); return true; } p.x = o.x + 2.5; p.z = o.z; p.y = heightAt(p.x, p.z) + 1; p.vx = p.vz = p.vy = 0; fx.burst(p.x, p.y + 1, p.z, 30, 6); toast(b.type === 'chrysalis' ? '🦋 Whoosh — out of the other chrysalis!' : '🕳️ Through the tunnel!', 1400); return true; }
    if ((b = near('rainbow_arch', 2)) && cool('rain', 60, t)) { TI.rainbowT = t + 25; toast('🌈 Rainbow trail! The meadow blooms where you fly for 25 s', 2200); return true; }
    if ((b = near('dusk_bell', 2)) && cool('dusk', 90, t)) { ctx.setNight(true); TI.duskEnd = t + 45; spawnCluster({ x: b.x + 8, z: b.z }); spawnCluster(); toast('🔔 Dusk falls… fresh dewdrops appear!', 2400); return true; }
    if ((b = near('swoop_loop', 2)) && cool('swoop', 15, t)) { ctx.gatherAt(14 + 4 * lv(b)); fx.burst(p.x, p.y + 1, p.z, 40, 10); toast('🌀 Swoop!', 900); return true; }
    if ((b = near('worm_farm', 2)) && cool('worm', 10, t)) { const n = 3 * lv(b); round.addRes('p', n); round.add('gather', n * 3); fx.burst(b.x, heightAt(b.x, b.z) + 1, b.z, 20, 5); toast(`🪱 Stomp! +${n} 🌼`, 1200); return true; }
    if ((b = near('rummage_bin', 2)) && cool('rum', 20, t)) { const r = Math.random(); if (r < 0.1 * lv(b)) { round.addRes('s', 1); toast('🧺 A lucky Starseed! 🌟', 2000); } else if (r < 0.5) { round.addRes('d', 1 + lv(b)); toast(`🧺 +${1 + lv(b)} 💧`, 1200); } else { round.addRes('p', 4 * lv(b)); toast(`🧺 +${4 * lv(b)} 🌼`, 1200); } return true; }
    if ((b = near('shake_tree', 2)) && cool('shake', 20, t)) { round.addRes('p', 4 * lv(b)); round.addRes('d', 1); fx.burst(b.x, heightAt(b.x, b.z) + 5, b.z, 40, 7); toast(`🌳 Shake! +${4 * lv(b)} 🌼 +1 💧`, 1400); return true; }
    if ((b = near('woodpile', 2))) { TI.logs = 2 + lv(b); toast(`🪵 Got ${TI.logs} logs — press Act anywhere to set a step`, 2000); return true; }
    return false;
  };
  TI.swarmReady = () => ctx.build.count('queens_hall') > 0;
  TI.swarm = () => { const p = P(), H = ctx.helpers(); const hl = H ? H.list.filter(h => !h.possessed) : []; hl.forEach(h => H.command(h, 'gather', p.x, p.z)); TI.songT = round.elapsed + 10; TI.swarmT = round.elapsed + 20; toast('👑 Swarm Call! Every helper rushes to you', 2000); ctx.ping?.(p.x, p.z); };
  TI.helperMul = () => { const st = ctx.build.count('song_tree') ? (round.elapsed - (TI.songT || -99) < 20 ? 1.4 : 1) : 1; return st * (round.elapsed < (TI.swarmT || 0) ? 1.3 : 1); };
  TI.ordered = () => { TI.songT = round.elapsed; };
  TI.isDeposit = (x, z) => !!(ctx.build.near('stash_den', x, z, 1) || ctx.build.near('clover_pad', x, z, 1));
  // ---------- per-frame
  TI.update = (dt, t, playing) => {
    const p = P(); if (!p) return; const id = sp(), B = ctx.build;
    // dew
    TI.spawnT = (TI.spawnT || 0) + dt; if (TI.spawnT > 20 && TI.clusters.length < 3) { TI.spawnT = 0; spawnCluster(); }
    const echo = B.count('echo_tower') > 0;
    for (const cl of [...TI.clusters]) {
      cl.beam.scale.y = echo ? 2.5 : 1;
      for (const d of cl.drops) { if (d.got) continue; d.m.position.y = d.y + Math.sin(t * 2 + d.x) * 0.15; d.gl.material.opacity = 0.6 + 0.4 * Math.sin(t * 5); if (playing && Math.abs(p.x - d.x) < 2 && Math.abs(p.z - d.z) < 2 && Math.abs(p.y + 0.8 - d.y) < 2.6) { d.got = true; d.m.visible = d.gl.visible = false; if (!cl.t0) { cl.t0 = t; say('d'); } round.addRes('d', 1); round.flash('d'); round.stats.dewdrops = (round.stats.dewdrops || 0) + 1; fx.burst(d.x, d.y, d.z, 12, 4); audio.blip?.(4); ctx.onChange?.(); } }
      const left = cl.drops.filter(d => !d.got).length;
      if (!left) { round.stats.dewSets = (round.stats.dewSets || 0) + 1; toast('💧 All five! Perfect catch', 1400); round.add('explore', 15); killCluster(cl); continue; }
      if (cl.t0) { const rem = 8 - (t - cl.t0); for (const d of cl.drops) d.m.scale.setScalar(Math.max(0.3, rem / 8)); if (rem <= 0) { toast(`☀️ The sun dried the last ${left} — you kept ${5 - left}!`, 1600); killCluster(cl); } }
    }
    // starseeds
    for (const s of [...TI.seeds]) { s.m.rotation.y += dt * 1.5; s.beam.scale.y = echo ? 2.2 : 1; if (playing && !TI.carrying && Math.hypot(p.x - s.x, p.z - s.z) < 2.4 && Math.abs(p.y + 0.8 - s.y) < 3) { TI.carrying = true; root.remove(s.g); TI.seeds.splice(TI.seeds.indexOf(s), 1); say('s', 3600); audio.chime?.(); ctx.onChange?.(); } }
    if (TI.carrying) {
      carryObj.visible = true; carryObj.position.set(p.x, p.y + 3.4 + Math.sin(t * 3) * 0.15, p.z); carryObj.rotation.y += dt * 2;
      const wet = heightAt(p.x, p.z) < WATER_Y + 0.15 && p.y < WATER_Y + 1.2; if (wet && !TI.liftHive()) TI.drop('water');
      const n = ctx.nests[id]; if (TI.carrying && n && (Math.hypot(p.x - n.x, p.z - n.z) < 9 || TI.isDeposit(p.x, p.z))) { TI.carrying = false; carryObj.visible = false; round.addRes('s', 1); round.flash('s'); round.add('explore', 40); round.stats.starseeds = (round.stats.starseeds || 0) + 1; fx.burst(p.x, p.y + 3, p.z, 60, 9); audio.chime?.(); toast('🌟 Starseed home safe! +1 Starseed', 2200); ctx.onChange?.(); }
    } else carryObj.visible = false;
    // team nodes
    for (const n of TI.team) {
      if (!n.live) { if (round.elapsed > n.back) { n.live = true; n.g.visible = true; } continue; }
      const D = TEAM[n.kind], { s } = TI.strengthAt(n), need = D.need[cls(id)], have = Math.min(need, Math.floor(s * need + 1e-6)), dP = Math.hypot(p.x - n.x, p.z - n.z);
      n.lb.userData.set(`${D.icon} ` + CLASS_ICON[cls(id)].repeat(have) + '◌'.repeat(Math.max(0, need - have)) + ` ${have}/${need}`, s < 1 && dP < 5.5);
      if (playing && dP < 5.5) {
        if (s >= 1) { n.lift += dt; n.body.position.y += dt * 0.6; if (n.lift > 1.6) payTeam(n); }
        else { n.lift = 0; n.wob = 0.6; if (t - n.msgT > 4) { n.msgT = t; toast('😣 ' + KID.heavy, 1800); } }
      } else n.lift = Math.max(0, n.lift - dt);
      if (n.wob > 0) { n.wob -= dt; n.g.rotation.z = Math.sin(t * 40) * 0.07 * n.wob; } else n.g.rotation.z = 0;
    }
    // building effects
    TI.speedMul = 1; TI.noDrain = false;
    let b;
    const ws = pair('wind_streamer'); if (ws && id === 'butterfly') for (let i = 0; i < ws.length - 1; i++) if (segDist(p, ws[i], ws[i + 1]) < 5) { TI.speedMul *= 1.25 + 0.1 * lv(ws[i]); TI.noDrain = true; break; }
    const sl = pair('silk_line'); if (sl) for (let i = 0; i < sl.length - 1; i++) if (segDist(p, sl[i], sl[i + 1]) < 4) { TI.speedMul *= 1.25 + 0.1 * lv(sl[i]); break; }
    if ((b = near('moon_lantern'))) TI.speedMul *= 1.15 + 0.08 * lv(b);
    if ((b = near('dash_hoop')) && cool('dash', 4, t)) { TI.boostT = t + 2 + lv(b); toast('💨 Dash!', 700); }
    if (t < TI.boostT) TI.speedMul *= 1.6;
    if ((b = near('clover_pad')) || (b = near('hang_roost')) || (b = near('sip_ring'))) { p.stam = Math.min(1, (p.stam ?? 1) + dt * (0.8 + 0.4 * lv(b))); }
    if (playing && p.carried > 0 && TI.isDeposit(p.x, p.z) && cool('dep', 1.2, t)) ctx.deposit();
    if (id === 'bumblebee' && !p.grounded && (b = B.placed.find(q => q.type === 'garden_patch')) && cool('seed', 3 / lv(b), t)) { round.addRes('p', 1); fx.burst(p.x, p.y - 0.5, p.z, 4, 2); }
    if (t < TI.rainbowT && !p.grounded && cool('rb', 0.6, t)) { const k = 'rain' + ((TI.rbi = ((TI.rbi || 0) + 1) % 8)); ctx.terr.remove?.(k); ctx.terr.setSource(k, 'marker', p.x, p.z, 3, 7, 0.3); fx.burst(p.x, p.y - 1, p.z, 10, 4); }
    if (TI.duskEnd && t > TI.duskEnd) { TI.duskEnd = 0; if (!ctx.nocturnal()) ctx.setNight(false); }
  };
  return TI;
}
