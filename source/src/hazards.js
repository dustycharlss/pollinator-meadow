// Passive meadow hazards (Fern hazards.json). Never chase the player.
// Relaxed: every hit is a short 0.8× slowdown for 1 s — no drops, stick, dizzy, etc.
import * as THREE from 'three';
import { loadGLB, bakeParts, lambertFrom } from './models.js';
import { WORLD_R } from './data.js';

const DEFS = [
  { id: 'mud', name: 'Squishy Mud', model: 'x/nests/mud-pool-pixor', size: 1.8, r: 3.5, lasts: 90, respawn: [40, 70], affects: 'walk', pen: { type: 'slow', speed: 0.55, linger: 1.5 }, sfx: 'hazards/mud-squelch', status: 'slow' },
  { id: 'puddle', name: 'Splashy Puddle', model: 'x/hazards/puddle-water-pixor-blocky', size: 1.6, r: 2.8, lasts: 60, respawn: [35, 60], affects: 'walk', pen: { type: 'slow', speed: 0.65, linger: 1.0 }, sfx: 'hazards/water-splash', status: 'wet' },
  { id: 'bramble', name: 'Bramble Bush', model: 'x/hazards/thorn-bush-pixor-blocky', size: 2.4, r: 2.2, lasts: 120, respawn: [50, 80], affects: 'low', pen: { type: 'drop', dropFrac: 0.15, dropMax: 3 }, sfx: 'hazards/bramble-snag', status: 'goodies' },
  { id: 'web', name: 'Sticky Web', model: 'x/hazards/spider-web-google_cM0NzColM_0-blocky', size: 2.8, r: 2.4, lasts: 75, respawn: [40, 70], affects: 'fly', pen: { type: 'stick', hold: 1.2 }, sfx: 'hazards/web-stick', status: 'web' },
  { id: 'sprinkler', name: 'Sprinkler', model: 'x/hazards/garden-sprinkler', size: 1.4, r: 4.0, lasts: 90, respawn: [45, 75], affects: 'all', pen: { type: 'slow', speed: 0.7, linger: 1.2, flyExtra: 0.15 }, sfx: 'hazards/sprinkler-hiss', status: 'wet' },
  { id: 'acorn_drop', name: 'Acorn Plop', model: 'x/hazards/acorn-blocky', size: 0.55, r: 2.0, lasts: 45, respawn: [30, 55], affects: 'all', pen: { type: 'dizzy', hold: 1.4 }, sfx: 'hazards/acorn-bonk', status: 'dizzy', aerial: true },
  { id: 'nettle', name: 'Itchy Nettles', model: 'x/hazards/nettle-patch-blocky', size: 1.5, r: 2.6, lasts: 120, respawn: [50, 80], affects: 'walk', pen: { type: 'itchy', speed: 0.75, linger: 2.0 }, sfx: 'hazards/nettle-itch-scratch', status: 'slow' },
  { id: 'pollen_cloud', name: 'Sneezy Cloud', model: 'x/hazards/smoke-puff-pixor-blocky', size: 2.2, r: 3.2, lasts: 40, respawn: [35, 60], affects: 'all', pen: { type: 'sneeze', dropN: 1, linger: 1.0 }, sfx: 'hazards/smoke-puff', status: 'dizzy', drift: true },
  { id: 'wind_gust', name: 'Gusty Breeze', model: null, size: 0, r: 5.0, lasts: 4, respawn: [25, 45], affects: 'all', pen: { type: 'push', force: 7, flyMul: 1.4 }, sfx: 'hazards/geyser-whoosh', status: null, invisible: true },
  { id: 'rain_cloud', name: 'Drizzle Cloud', model: 'x/hazards/rain-cloud-pixor-blocky', size: 2.6, r: 4.0, lasts: 50, respawn: [40, 70], affects: 'fly', pen: { type: 'slow', speed: 0.72, linger: 1.5 }, sfx: 'hazards/mist-hiss', status: 'wet', aerial: true, drift: true },
  { id: 'mist_vent', name: 'Misty Puff', model: 'x/hazards/steam-vent-pixor-blocky', size: 1.8, r: 2.8, lasts: 100, respawn: [50, 80], affects: 'all', pen: { type: 'foggy', linger: 2.0 }, sfx: 'hazards/mist-hiss', status: 'wet' },
  { id: 'slippery_rock', name: 'Slippy Rock', model: 'x/hazards/rock-mossy-pixor-blocky', size: 1.5, r: 2.0, lasts: 150, respawn: [60, 90], affects: 'walk', pen: { type: 'slide', speed: 1.35, linger: 0.8 }, sfx: 'hazards/mud-squelch', status: null },
  { id: 'smoke_puff', name: 'Puffball Poof', model: 'x/hazards/smoke-puff-pixor-blocky', size: 1.7, r: 2.6, lasts: 90, respawn: [45, 75], affects: 'low', pen: { type: 'dusty', linger: 1.6 }, sfx: 'hazards/smoke-puff', status: 'soot' },
  { id: 'geyser', name: 'Bubbly Geyser', model: 'x/hazards/geyser-pixor-blocky', size: 2.0, r: 2.4, lasts: 120, respawn: [55, 85], affects: 'all', pen: { type: 'pop_up', vy: 11 }, sfx: 'hazards/geyser-whoosh', status: 'wet' },
  { id: 'venus_flytrap', name: 'Huggy Flytrap', model: 'x/hazards/venus-flytrap-poly-by-google_0y4ZpRcGhoD-blocky', size: 2.2, r: 2.0, lasts: 120, respawn: [55, 85], affects: 'low', pen: { type: 'hug', hold: 1.6 }, sfx: 'hazards/flytrap-snap', status: 'web' },
  { id: 'pigeon', name: 'Peckish Pigeon', model: 'x/hazards/pigeon-quaternius_9NGlBTpDEr-blocky', size: 1.3, r: 2.5, lasts: 90, respawn: [45, 75], affects: 'all', pen: { type: 'startle_drop', dropN: 1 }, sfx: 'hazards/pigeon-coo', status: 'goodies', wander: true },
  { id: 'wasp', name: 'Buzzy Wasp', model: 'x/hazards/wasp-quaternius_3aQgc75sUR-blocky', size: 0.9, r: 2.2, lasts: 100, respawn: [50, 80], affects: 'fly', pen: { type: 'nudge', force: 4 }, sfx: 'hazards/wasp-buzz-loop', status: 'dizzy', aerial: true, wander: true },
];

const STATUS_CSS = {
  web: 'status-web-stuck', wet: 'status-wet-drips', soot: 'status-soot-puff',
  dizzy: 'status-dizzy-stars', slow: 'status-slow-snail', goodies: 'status-goodies-pop',
};

const ACTIVE_MAX = { 3: 2, 5: 3, 10: 5, 15: 6, 20: 7 };
const GRACE = { 3: 20, 5: 30, 10: 45, 15: 60, 20: 75 };

function activeMax(len, relaxed) {
  const keys = Object.keys(ACTIVE_MAX).map(Number).sort((a, b) => a - b);
  let m = ACTIVE_MAX[keys[0]];
  for (const k of keys) if (len >= k) m = ACTIVE_MAX[k];
  if (relaxed) m = Math.max(1, Math.floor(m * 0.6));
  return m;
}
function graceS(len) {
  const keys = Object.keys(GRACE).map(Number).sort((a, b) => a - b);
  let g = GRACE[keys[0]];
  for (const k of keys) if (len >= k) g = GRACE[k];
  return g;
}

export async function createHazards(scene, ctx) {
  const { heightAt, phys, nests, round, toast, audio, journal, fx, terr } = ctx;
  const H = { list: [], drops: [], cool: new Map(), fxState: null, met: new Set(), pending: 0 };
  const root = new THREE.Group(); scene.add(root);
  const dropRoot = new THREE.Group(); scene.add(dropRoot);
  const matCache = new Map();
  const tellMat = new THREE.MeshBasicMaterial({ color: 0xfff4a8, transparent: true, opacity: 0.35, depthWrite: false });

  // status HUD chip
  let chip = document.getElementById('hzChip');
  if (!chip) {
    chip = document.createElement('div'); chip.id = 'hzChip';
    chip.style.cssText = 'position:fixed;left:50%;bottom:max(110px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:8;display:none;align-items:center;gap:8px;padding:6px 12px;border-radius:16px;background:rgba(59,38,20,.72);color:#fff3d8;font:800 13px system-ui;pointer-events:none;text-shadow:0 1px 0 #3b2614';
    document.body.appendChild(chip);
  }

  async function bakeModel(key, size) {
    if (!key) return null;
    const ck = key + '@' + size;
    if (matCache.has(ck)) return matCache.get(ck);
    const gl = await loadGLB(key);
    if (!gl) { matCache.set(ck, null); return null; }
    const { parts } = bakeParts(gl, { size, mode: 'height' });
    const g = new THREE.Group();
    for (const p of parts) g.add(new THREE.Mesh(p.geometry, lambertFrom(p.material)));
    matCache.set(ck, g); return g;
  }

  // preload common models (non-blocking failures)
  await Promise.all(DEFS.filter(d => d.model).slice(0, 12).map(d => bakeModel(d.model, d.size)));

  function homeR(id) {
    const n = nests[id]; if (!n) return 15;
    const lv = (ctx.homeLv && ctx.homeLv()[id]) || 1;
    return Math.max(15, 15 + 6 * Math.max(0, lv - 1));
  }
  function nearHome(x, z) {
    for (const id of Object.keys(nests || {})) {
      const n = nests[id]; if (Math.hypot(x - n.x, z - n.z) < homeR(id)) return true;
    }
    return false;
  }
  function inBloom(x, z) {
    try { return terr && terr.claimed && terr.claimed(x, z); } catch (e) { return false; }
  }
  function farFromHazards(x, z, min = 20) {
    for (const h of H.list) if (Math.hypot(x - h.x, z - h.z) < min) return false;
    return true;
  }
  function pickSpot(def) {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (WORLD_R - 18);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (nearHome(x, z)) continue;
      if (phys && phys.blocked && phys.blocked(x, z, 1.2)) continue;
      if (!farFromHazards(x, z, 18)) continue;
      // half density in player's bloomed meadow
      if (inBloom(x, z) && Math.random() < 0.5) continue;
      const y = heightAt(x, z);
      if (def.aerial) return { x, y: y + 3.5 + Math.random() * 2, z };
      return { x, y, z };
    }
    return null;
  }

  async function spawnOne(def) {
    const pt = pickSpot(def); if (!pt) return null;
    const g = new THREE.Group(); g.position.set(pt.x, pt.y, pt.z);
    const tell = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.55, 12, 10), tellMat.clone());
    tell.material.opacity = 0.4; g.add(tell);
    let mesh = null;
    if (def.model && !def.invisible) {
      const proto = await bakeModel(def.model, def.size);
      if (proto) { mesh = proto.clone(true); g.add(mesh); mesh.visible = false; }
    }
    if (!mesh && !def.invisible) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(def.r * 0.35, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9ad07a, transparent: true, opacity: 0.7 }));
      m.position.y = def.r * 0.2; g.add(m); mesh = m; mesh.visible = false;
    }
    root.add(g);
    audio?.sample?.('hazards/hazard-appear-shimmer', 0.35);
    const h = {
      def, x: pt.x, y: pt.y, z: pt.z, g, mesh, tell, age: 0, life: def.lasts + 2,
      active: false, yaw: Math.random() * 6.28, pathA: Math.random() * 6.28, pathR: 4 + Math.random() * 6,
      ox: pt.x, oz: pt.z,
    };
    H.list.push(h); return h;
  }

  function despawn(h) {
    audio?.sample?.('hazards/fade-out-puff', 0.3);
    root.remove(h.g); const i = H.list.indexOf(h); if (i >= 0) H.list.splice(i, 1);
  }

  function showChip(label, statusKey) {
    const id = STATUS_CSS[statusKey];
    chip.style.display = 'flex';
    chip.innerHTML = (id ? `<img src="./textures/fx/status/${id}-still.png" width="36" height="36" alt="" style="image-rendering:pixelated">` : '') + `<span>${label}</span>`;
  }
  function hideChip() { chip.style.display = 'none'; chip.innerHTML = ''; }

  function dropGoodies(p, n, sp) {
    n = Math.max(0, Math.min(n, p.carried | 0)); if (n <= 0) return 0;
    p.carried -= n;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = 1.2 + Math.random() * 1.2;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, y = heightAt(x, z) + 0.4;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe27a, emissive: 0xaa8800 }));
      m.position.set(x, y, z); dropRoot.add(m);
      H.drops.push({ m, x, y, z, left: 20, val: 1, kind: sp?.pickName || 'goodie' });
    }
    fx?.burst?.(p.x, p.y + 1, p.z, 12, 4);
    return n;
  }

  function meet(def) {
    if (H.met.has(def.id)) return;
    H.met.add(def.id);
    journal?.('h:' + def.id, def.name);
  }

  function applies(def, p, sp) {
    const fly = !!(sp.mv && sp.mv.fly) && !p.grounded && (p.y - (p.floorY || 0) > 1.2);
    const a = def.affects;
    if (a === 'all') return true;
    if (a === 'walk') return !fly;
    if (a === 'fly') return fly || (!p.grounded && p.vy > 0.5);
    if (a === 'low') return !fly || (p.y - (p.floorY || 0) < 3);
    return true;
  }

  function hit(h, p, sp, t) {
    const def = h.def, pen = def.pen, relaxed = round.mode === 'relaxed';
    const cdKey = def.id; const last = H.cool.get(cdKey) || 0; if (t - last < 4) return;
    H.cool.set(cdKey, t);
    meet(def);
    audio?.sample?.(def.sfx, 0.45);
    if (relaxed) {
      H.fxState = { type: 'slow', speed: 0.8, until: t + 1, label: def.name + ' · soft slow', status: 'slow' };
      showChip(H.fxState.label, 'slow'); toast?.(`☁️ ${def.name} — just a soft slowdown`, 1800); return;
    }
    let label = def.name, status = def.status;
    if (pen.type === 'slow' || pen.type === 'itchy') {
      H.fxState = { type: 'slow', speed: pen.speed || 0.7, until: t + (pen.linger || 1.2), label, status };
    } else if (pen.type === 'stick' || pen.type === 'hug') {
      H.fxState = { type: 'lock', until: t + (pen.hold || 1.2), label: label + ' · tap Jump!', status: status || 'web', freeSfx: def.id === 'web' ? 'hazards/web-boing-free' : null };
    } else if (pen.type === 'dizzy' || pen.type === 'dusty' || pen.type === 'foggy' || pen.type === 'sneeze') {
      H.fxState = { type: 'dizzy', until: t + (pen.linger || pen.hold || 1.4), label, status: status || 'dizzy' };
      if (pen.dropN || pen.type === 'sneeze') dropGoodies(p, pen.dropN || 1, sp);
    } else if (pen.type === 'drop' || pen.type === 'startle_drop') {
      ctx.onSnag && ctx.onSnag(p);
      const n = pen.dropN || Math.min(pen.dropMax || 3, Math.ceil((p.carried || 0) * (pen.dropFrac || 0.15)));
      const got = dropGoodies(p, n, sp);
      H.fxState = { type: 'slow', speed: 0.85, until: t + 0.8, label: got ? `${label} · dropped ${got}` : label, status: 'goodies' };
    } else if (pen.type === 'push' || pen.type === 'nudge') {
      const f = (pen.force || 5) * (pen.flyMul && !p.grounded ? pen.flyMul : 1);
      const a = h.yaw || Math.random() * 6.28;
      p.vx += Math.cos(a) * f; p.vz += Math.sin(a) * f;
      H.fxState = { type: 'slow', speed: 0.9, until: t + 0.6, label, status };
    } else if (pen.type === 'pop_up') {
      p.vy = Math.max(p.vy, pen.vy || 10); p.grounded = false;
      H.fxState = { type: 'slow', speed: 0.85, until: t + 0.8, label, status: 'wet' };
    } else if (pen.type === 'slide') {
      H.fxState = { type: 'slide', speed: pen.speed || 1.3, until: t + (pen.linger || 0.8), label, status };
    } else {
      H.fxState = { type: 'slow', speed: 0.8, until: t + 1, label, status: 'slow' };
    }
    showChip(H.fxState.label, H.fxState.status);
    toast?.(`${sp.emoji} ${def.name}!`, 1600);
  }

  H.clear = () => { for (const h of H.list.slice()) despawn(h); for (const d of H.drops) dropRoot.remove(d.m); H.drops.length = 0; H.fxState = null; hideChip(); };
  H.resetRound = () => { H.clear(); H.cool.clear(); };

  H.update = (dt, t, { playing, paused, p, sp, elapsed, len }) => {
    if (!playing || paused || !p || !sp) { hideChip(); return; }
    const relaxed = round.mode === 'relaxed';
    const maxA = activeMax(len || round.len || 10, relaxed);
    const grace = graceS(len || round.len || 10);
    const left = round.left ?? 999;
    const elapsedS = elapsed != null ? elapsed : Math.max(0, (round.len || 10) * 60 - left);
    // ramp: grow from 1 to max by 40% of round
    const rampT = (len || round.len || 10) * 60 * 0.4;
    const want = elapsedS < grace ? 0 : left < 60 ? H.list.length : Math.max(1, Math.min(maxA, 1 + Math.floor((maxA - 1) * Math.min(1, (elapsedS - grace) / Math.max(1, rampT - grace)))));

    // spawn / despawn
    while (H.list.length + H.pending < want) {
      const pool = DEFS.filter(d => !H.list.some(h => h.def.id === d.id) || Math.random() < 0.35);
      const def = pool[(Math.random() * pool.length) | 0];
      H.pending++;
      spawnOne(def).then(h => { H.pending = Math.max(0, H.pending - 1); }).catch(() => { H.pending = Math.max(0, H.pending - 1); });
      break;
    }
    for (const h of H.list.slice()) {
      h.age += dt; h.life -= dt;
      if (h.life <= 0) { despawn(h); continue; }
      if (!h.active && h.age >= 2) {
        h.active = true; if (h.tell) h.g.remove(h.tell); if (h.mesh) h.mesh.visible = true;
      }
      // drift / wander
      if (h.def.drift || h.def.wander) {
        h.pathA += dt * (h.def.wander ? 0.7 : 0.35);
        h.x = h.ox + Math.cos(h.pathA) * h.pathR;
        h.z = h.oz + Math.sin(h.pathA) * h.pathR;
        if (!h.def.aerial) h.y = heightAt(h.x, h.z);
        h.g.position.set(h.x, h.y, h.z);
      }
      if (h.mesh && h.def.id === 'sprinkler') h.mesh.rotation.y += dt * 2.2;
      if (h.mesh && (h.def.wander || h.def.aerial)) h.mesh.rotation.y += dt * 1.2;
    }

    // drops pickup
    for (let i = H.drops.length - 1; i >= 0; i--) {
      const d = H.drops[i]; d.left -= dt; d.m.position.y = d.y + Math.sin(t * 4 + i) * 0.12;
      if (d.left <= 0) { dropRoot.remove(d.m); H.drops.splice(i, 1); continue; }
      if (Math.hypot(p.x - d.x, p.z - d.z) < 1.6 && Math.abs((p.y || 0) - d.y) < 2.5) {
        const cap = ctx.cap?.() ?? 99;
        if ((p.carried || 0) < cap) { p.carried = Math.min(cap, (p.carried || 0) + d.val); dropRoot.remove(d.m); H.drops.splice(i, 1); audio?.sample?.('ui/highlight-tick', 0.3); fx?.burst?.(d.x, d.y, d.z, 6, 2); ctx.onPickup?.(); }
      }
    }

    // collide
    if (H.fxState && t < H.fxState.until) {
      // allow Jump to free from stick/hug
      if (H.fxState.type === 'lock' && (ctx.jumpPressed?.() || ctx.actPressed?.())) {
        audio?.sample?.(H.fxState.freeSfx || 'hazards/web-boing-free', 0.5);
        H.fxState = null; hideChip();
      }
    } else if (H.fxState) { H.fxState = null; hideChip(); }

    for (const h of H.list) {
      if (!h.active) continue;
      const dist = Math.hypot(p.x - h.x, p.z - h.z);
      if (dist < h.def.r + 3) meet(h.def); // journal near
      if (dist > h.def.r) continue;
      if (!applies(h.def, p, sp)) continue;
      hit(h, p, sp, t);
    }
  };

  /** Apply active effect to movement intent. Call from stepPlayer after computing maxS. */
  H.modSpeed = (base, t) => {
    const f = H.fxState; if (!f || t >= f.until) return base;
    if (f.type === 'lock') return 0;
    if (f.type === 'dizzy') return base * 0.45;
    if (f.type === 'slide') return base * (f.speed || 1.3);
    if (f.type === 'slow') return base * (f.speed || 0.8);
    return base;
  };
  H.locked = (t) => !!(H.fxState && H.fxState.type === 'lock' && t < H.fxState.until);
  H.defs = DEFS;
  return H;
}
