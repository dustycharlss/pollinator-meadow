// Rival colonies (Fern rivals.json). Builds on a schedule + cartoon reactions (startle / raid / claim / dismantle).
import * as THREE from 'three';
import { SPECIES, SPECIES_ORDER, WORLD_R } from './data.js';
import { loadGLB } from './models.js';

const TEAM = {
  bee: '#ffd23f', bumblebee: '#ff8a1f', butterfly: '#4aa8ff', moth: '#9b6bdc', hummingbird: '#13b5a5',
  bat: '#4148c9', robin: '#e23b3b', raccoon: '#64748b', opossum: '#ff7eb6', bear: '#8b5a2b',
};
const COLONY = {
  bee: 'Honey Hive Bees', bumblebee: 'Bumble Burrow Bumbles', butterfly: 'Chrysalis Garden Butterflies',
  moth: 'Silk Cocoon Moths', hummingbird: 'Cup Nest Hummingbirds', bat: 'Bat Roost Bats',
  robin: 'Nest Grove Robins', raccoon: 'Stash Den Raccoons', opossum: 'Woodpile Opossums', bear: 'Honey Cave Bears',
};
const BUILD_ORDER = ['outpost', 'marker', 'outpost', 'garden', 'outpost', 'home', 'storage', 'outpost', 'marker', 'producer'];
const ROLE_FILE = { home: 'home', outpost: 'home', marker: null, garden: 'producer', storage: 'research', producer: 'producer', bridge: null };
const BUILD_TIME = { marker: 12, outpost: 20, garden: 20, storage: 20, home: 30, producer: 30, bridge: 12 };
const STAGES = ['built', 'scaffold', 'dismantle-75', 'dismantle-50', 'dismantle-25'];
const SLOTS = {
  3: [27, 68, 109, 139, 164],
  5: [45, 98, 151, 190, 229, 261],
  10: [90, 165, 240, 295, 350, 405, 460, 505, 550],
  15: [135, 227, 319, 411, 478, 545, 613, 680, 735, 790],
  20: [180, 286, 392, 498, 576, 654, 732, 809, 887, 951, 1014, 1078],
};


const SIZE = { bee: 'S', bumblebee: 'S', butterfly: 'S', moth: 'S', hummingbird: 'S', bat: 'S', robin: 'M', raccoon: 'M', opossum: 'M', bear: 'L' };
const STARTLE_FLAVOR = {
  bee: 'spins in a dizzy little circle!',
  bumblebee: 'bounces like a fuzzy balloon!',
  butterfly: 'zigzags up in a sparkle!',
  moth: 'flutters toward the nearest glow!',
  hummingbird: 'zooms backward — whoa!',
  bat: 'does a loop-the-loop!',
  robin: 'puffs up round and hops back!',
  raccoon: 'covers its eyes — peekaboo!',
  opossum: 'plays possum… then pops up!',
  bear: 'plops on its bottom — whump!',
};
const CLAIM_FLAVOR = {
  bee: 'waggle-dances toward a new flower patch!',
  bumblebee: 'hums a soft good-game tune!',
  butterfly: 'blows a sparkly kiss to the meadow!',
  moth: 'tips a tiny hat at the moonlight!',
  hummingbird: 'draws a heart in the air!',
  bat: 'gives a upside-down thumbs-up!',
  robin: 'chirps “nice one!” and hops aside!',
  raccoon: 'claps its little hands — good game!',
  opossum: 'grins and offers a shiny pebble!',
  bear: 'rumbles a friendly chuckle!',
};

function retintTeam(root, hex) {
  const c = new THREE.Color(hex);
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i]; if (!m) continue;
      if (/team/i.test(m.name || '')) {
        const n = m.clone(); n.color = c.clone(); mats[i] = n; if (!Array.isArray(o.material)) o.material = n;
      }
    }
    if (Array.isArray(o.material)) o.material = mats;
  });
}
function setStage(root, stage) {
  for (const s of STAGES) {
    const n = root.getObjectByName(s); if (n) n.visible = s === stage;
  }
}
function scaleTo(root, targetH = 3.2) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const h = box.getSize(new THREE.Vector3()).y || 1;
  const k = targetH / h;
  root.scale.setScalar(k);
  root.position.y -= box.min.y * k;
}

function pileOf(home) {
  if (!home) return null;
  if (home.pileMesh) {
    const wp = new THREE.Vector3(); home.pileMesh.getWorldPosition(wp);
    return { x: wp.x, y: wp.y, z: wp.z };
  }
  const ang = Math.atan2(-(home.z || 0), -(home.x || 0));
  return { x: home.x + Math.cos(ang) * 3.4, z: home.z + Math.sin(ang) * 3.4, y: home.y };
}

export async function createRivals(scene, ctx) {
  const { heightAt, phys, nests, round, toast, audio, fx, terr, adm } = ctx;
  const R = {
    active: null, buildings: [], score: 0, slotI: 0, nextAt: 0, buildProg: null,
    dismantle: null, toastEl: null, badgeEl: null, ownerId: 1,
    react: null, claimT: 0, claimCd: 0, pileCd: 0, startleImm: 0, raidHold: 0, bank: { n: 20, f: 12, w: 8, h: 6 },
  };
  const reactOn = () => adm?.rivalReact !== false;
  const root = new THREE.Group(); scene.add(root);
  const cache = new Map();

  // toast / badge DOM
  function ensureUi() {
    if (!R.toastEl) {
      const el = document.createElement('div'); el.id = 'rvToast';
      el.style.cssText = 'position:fixed;left:50%;top:72px;transform:translateX(-50%);z-index:12;display:none;align-items:center;gap:10px;pointer-events:none;filter:drop-shadow(0 3px 0 #3b2614)';
      document.body.appendChild(el); R.toastEl = el;
    }
    if (!R.ringEl) {
      const el = document.createElement('div'); el.id = 'rvRing';
      el.style.cssText = 'position:fixed;left:50%;bottom:max(150px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;display:none;width:72px;height:72px;border-radius:50%;border:5px solid #3b2614;background:conic-gradient(#ffd23f 0deg,rgba 0deg);box-shadow:0 3px 0 #3b2614;pointer-events:none';
      const lab = document.createElement('div'); lab.style.cssText = 'position:absolute;inset:8px;border-radius:50%;background:#fff3d8;border:3px solid #3b2614;display:flex;align-items:center;justify-content:center;font:900 11px system-ui;color:#3b2614;text-align:center;line-height:1.1';
      lab.textContent = 'Take\napart'; el.appendChild(lab); R.ringLab = lab; document.body.appendChild(el); R.ringEl = el;
    }
  }
  ensureUi();

  function worldBadge(x, y, z, emoji, ms = 1600) {
    const el = document.createElement('div');
    el.textContent = emoji;
    el.style.cssText = 'position:fixed;z-index:11;pointer-events:none;font-size:28px;filter:drop-shadow(0 2px 0 #3b2614);transition:opacity .15s,transform .15s;opacity:0;transform:translate(-50%,-100%) scale(.6)';
    document.body.appendChild(el);
    const place = () => {
      if (!ctx.worldToScreen) { el.style.left = '50%'; el.style.top = '40%'; return; }
      const s = ctx.worldToScreen(x, y + 1.8, z);
      if (!s || s.ok === false) { el.style.opacity = '0'; return; }
      el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    };
    place(); requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translate(-50%,-120%) scale(1)'; });
    const iv = setInterval(place, 50);
    setTimeout(() => { clearInterval(iv); el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, ms);
  }
  function bounceMesh(mesh, amp = 0.55, n = 2) {
    if (!mesh || mesh.userData._bounce) return;
    const base = mesh.position.y; mesh.userData._bounce = true;
    const t0 = performance.now();
    const tick = () => {
      const u = (performance.now() - t0) / 700;
      if (u >= 1) { mesh.position.y = base; mesh.userData._bounce = false; return; }
      mesh.position.y = base + Math.abs(Math.sin(u * Math.PI * n)) * amp * (1 - u);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function showToast(kind, text, sp) {
    ensureUi();
    const img = kind === 'dismantled' ? 'toast-dismantled.png' : 'toast-claimed.png';
    const badge = kind === 'dismantled' ? 'toast-badge-dismantled.png' : 'toast-badge-claimed.png';
    R.toastEl.style.display = 'flex';
    R.toastEl.innerHTML = `<img src="./ui/rivals/toasts/${img}" height="56" alt=""><img src="./ui/rivals/badges/rival-badge-${sp}.png" width="40" height="40" alt="" style="margin-left:-18px;margin-top:-8px"><span style="margin-left:6px;padding:8px 14px;background:#fff3d8;border:3px solid #3b2614;border-radius:16px;font:800 14px system-ui;color:#3b2614">${text}</span>`;
    clearTimeout(R.toastT); R.toastT = setTimeout(() => { R.toastEl.style.display = 'none'; }, 2800);
  }

  async function loadBuilding(sp, role) {
    const key = `x/buildings/rivals/${sp}/${sp}-${role}`;
    if (cache.has(key)) return cache.get(key).clone(true);
    const gl = await loadGLB(key);
    if (!gl) { cache.set(key, null); return null; }
    const proto = gl.scene.clone(true);
    retintTeam(proto, TEAM[sp] || '#ffd23f');
    scaleTo(proto, role === 'home' ? 3.6 : 2.8);
    cache.set(key, proto);
    return proto.clone(true);
  }
  async function loadMarker(sp) {
    const key = `x/buildings/rivals/territory/territory-marker-${sp}`;
    if (cache.has(key)) return cache.get(key).clone(true);
    const gl = await loadGLB(key);
    if (!gl) return null;
    const proto = gl.scene.clone(true); retintTeam(proto, TEAM[sp] || '#ffd23f'); scaleTo(proto, 2.2);
    cache.set(key, proto); return proto.clone(true);
  }

  function pickRival(lead) {
    const pool = SPECIES_ORDER.filter(id => id !== lead);
    return pool[(Math.random() * pool.length) | 0];
  }
  function homeSpot(lead) {
    const n = nests[lead];
    // opposite-ish side of meadow
    const ang = Math.atan2(n.z, n.x) + Math.PI + (Math.random() - 0.5) * 0.6;
    for (let tries = 0; tries < 40; tries++) {
      const d = 70 + Math.random() * 40;
      const x = Math.cos(ang + (tries * 0.15)) * d, z = Math.sin(ang + (tries * 0.15)) * d;
      if (Math.hypot(x, z) > WORLD_R - 20) continue;
      if (Math.hypot(x - n.x, z - n.z) < 55) continue;
      if (phys?.blocked?.(x, z, 2)) continue;
      return { x, z, y: heightAt(x, z) };
    }
    return { x: -n.x * 0.7, z: -n.z * 0.7, y: heightAt(-n.x * 0.7, -n.z * 0.7) };
  }
  function nearPlayerEdge(x, z) {
    // Territory retired (t135u): no claim edge to avoid.
    return false;
  }
  function pickBuildSpot(base, kind) {
    const reach = kind === 'outpost' ? 36 : 28;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * 6.28, d = 8 + Math.random() * reach;
      const x = base.x + Math.cos(a) * d, z = base.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > WORLD_R - 12) continue;
      if (nearPlayerEdge(x, z)) continue;
      if (phys?.blocked?.(x, z, 1.5)) continue;
      if (R.buildings.some(b => Math.hypot(b.x - x, b.z - z) < 8)) continue;
      let tooCloseHome = false;
      for (const id of SPECIES_ORDER) { const n = nests[id]; if (Math.hypot(n.x - x, n.z - z) < 20) { tooCloseHome = true; break; } }
      if (tooCloseHome) continue;
      return { x, z, y: heightAt(x, z) };
    }
    return null;
  }

  function edgeMul() {
    const e = adm?.playerEdge != null ? adm.playerEdge : 0.2;
    return Math.max(0.4, 1 - e); // rival slower/weaker by player edge
  }
  function modeMul() { return round.mode === 'relaxed' ? 1.6 : 1; }

  function catchupMul() {
    const ps = round.score(), rs = R.score || 1;
    if (ps < rs * 0.85) return 1.25; // rival slows if player behind
    if (ps > rs * 1.5) return 0.9;
    return 1;
  }

  // t145u: rival colonies / competing species disabled. Ambient gatherers stay in creatures.js.
  R.resetRound = (_lead) => {
    for (const b of R.buildings) { root.remove(b.g); if (b.srcId) terr.remove(b.srcId); }
    R.buildings.length = 0; R.score = 0; R.slotI = 0; R.buildProg = null; R.dismantle = null; R.react = null; R.claimT = 0; R.pileCd = 0; R.startleImm = 0; R.raidHold = 0; R.raidProg = null; R.bank = { n: 24, f: 14, w: 10, h: 8 };
    R.active = null; R.nextAt = 1e9;
    if (R.ringEl) R.ringEl.style.display = 'none';
    if (R.toastEl) R.toastEl.style.display = 'none';
  };

  async function startBuild(kind, spot, isHome) {
    if (!R.active || !spot) return;
    const sp = R.active.sp;
    const role = ROLE_FILE[kind];
    const g = new THREE.Group(); g.position.set(spot.x, spot.y, spot.z);
    let mesh = null;
    if (kind === 'marker') mesh = await loadMarker(sp);
    else if (role) mesh = await loadBuilding(sp, role);
    if (!mesh) {
      // blocky stand-in
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshLambertMaterial({ color: new THREE.Color(TEAM[sp]) }));
      m.position.y = 1.1; mesh = m;
    }
    setStage(mesh, 'scaffold');
    g.add(mesh); root.add(g);
    const bt = (BUILD_TIME[kind] || 20) * Math.min(1, Math.max(0.6, Math.sqrt((round.len * 60) / 600))) * modeMul() / edgeMul();
    const id = 'rv-' + R.buildings.length + '-' + kind;
    const b = { id, kind, x: spot.x, y: spot.y, z: spot.z, g, mesh, stage: 'scaffold', buildLeft: bt, buildTotal: bt, done: false, srcId: null, hp: 1 };
    R.buildings.push(b);
    R.buildProg = b;
    audio?.sample?.('rivals/rival-build-start', 0.35);
    if (isHome) { /* finish faster first home */ b.buildLeft = Math.min(b.buildLeft, 6); }
  }

  async function ensurePile(home) {
    if (!home || home.pileMesh) return;
    try {
      const key = 'x/buildings/rivals/rival-pile-blocky';
      let proto = cache.get(key);
      if (proto === undefined) {
        const gl = await loadGLB(key);
        proto = gl ? gl.scene.clone(true) : null;
        if (proto) { retintTeam(proto, TEAM[R.active?.sp] || '#ffd23f'); scaleTo(proto, 1.6); }
        cache.set(key, proto);
      }
      if (!proto) return;
      const mesh = proto.clone(true);
      const ang = Math.atan2(-(home.z || 0), -(home.x || 0));
      mesh.position.set(Math.cos(ang) * 3.4, 0, Math.sin(ang) * 3.4);
      home.g.add(mesh); home.pileMesh = mesh;
    } catch (e) { /* pile is optional visual */ }
  }
  function finishBuild(b) {
    b.done = true; b.stage = 'built'; setStage(b.mesh, 'built');
    const r0 = b.kind === 'outpost' || b.kind === 'home' ? (b.kind === 'home' ? 18 : 14) : (b.kind === 'marker' ? 10 : 8);
    const rMax = b.kind === 'home' ? 32 : b.kind === 'outpost' ? 28 : 16;
    const rate = (b.kind === 'outpost' || b.kind === 'home' ? 0.12 : 0.04) * edgeMul();
    b.srcId = b.id;
    terr.setSource(b.srcId, 'rival', b.x, b.z, r0 * 0.55, rMax, rate, R.ownerId);
    const pts = b.kind === 'home' ? 40 : b.kind === 'outpost' ? 25 : b.kind === 'producer' ? 30 : 15;
    R.score += Math.round(pts * edgeMul());
    audio?.sample?.('rivals/rival-build-done', 0.45);
    if (b.kind === 'outpost' || b.kind === 'home' || b.kind === 'marker') {
      showToast('claimed', `${R.active.name} built nearby!`, R.active.sp);
      audio?.sample?.('rivals/rival-colony-cheer', 0.35);
    }
    if (b.kind === 'home') ensurePile(b);
    if (R.buildProg === b) R.buildProg = null;
  }

  function scheduleNext() {
    const slots = SLOTS[round.len] || SLOTS[10];
    R.slotI++;
    if (R.slotI >= slots.length) { R.nextAt = 1e9; return; }
    const base = slots[R.slotI];
    R.nextAt = base * catchupMul() * modeMul() / Math.max(0.5, edgeMul() + 0.5);
  }

  function tryQueueBuild() {
    if (!R.active || R.buildProg) return;
    const kind = BUILD_ORDER[R.active.orderI % BUILD_ORDER.length];
    R.active.orderI++;
    const spot = pickBuildSpot(R.active.home, kind);
    if (!spot) { scheduleNext(); return; }
    startBuild(kind, spot, false);
    scheduleNext();
  }

  // ---- dismantle mini-game
  function nearestBuild(p, max = 6.5) {
    let best = null, bd = max;
    for (const b of R.buildings) {
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  R.beginDismantle = (p) => {
    const b = nearestBuild(p); if (!b) return false;
    if (R.dismantle && R.dismantle.b === b) return true;
    R.dismantle = { b, prog: 0, need: b.done ? 1 : 0.5, cool: 0 };
    ensureUi(); R.ringEl.style.display = 'block'; R.ringLab.textContent = 'Take\napart';
    if (reactOn()) {
      audio?.sample?.('rivals/raid-stinger', 0.35);
      worldBadge(b.x, b.y, b.z, '😮', 1400);
      bounceMesh(b.mesh, 0.35, 1);
    }
    return true;
  };
  R.tapDismantle = () => {
    const D = R.dismantle; if (!D) return;
    if (D.cool > 0) { D.prog = Math.max(0, D.prog - 0.15); return; } // miss penalty if spam too fast — actually cool gates hits
    D.prog += 0.12; D.cool = 0.18;
    const b = D.b;
    if (D.prog >= 0.75) setStage(b.mesh, 'dismantle-25');
    else if (D.prog >= 0.5) setStage(b.mesh, 'dismantle-50');
    else if (D.prog >= 0.25) setStage(b.mesh, 'dismantle-75');
    audio?.sample?.('build/place-thud', 0.3);
    if (D.prog >= D.need) completeDismantle();
  };
  function completeDismantle() {
    const D = R.dismantle; if (!D) return;
    const b = D.b;
    const share = b.done ? 0.5 : 0.25;
    const pts = Math.round((b.kind === 'home' ? 40 : b.kind === 'outpost' ? 25 : 15) * (b.done ? 0.75 : 0.25));
    // materials back to player
    const pay = { n: Math.ceil(4 * share), f: Math.ceil(3 * share), w: Math.ceil(2 * share), h: Math.ceil(1 * share) };
    for (const k in pay) round.addRes(k, pay[k]);
    round.add('building', pts);
    R.score = Math.max(0, R.score - pts);
    if (b.srcId) terr.remove(b.srcId);
    fx?.burst?.(b.x, b.y + 1.5, b.z, 28, 8);
    if (reactOn()) {
      audio?.sample?.('rivals/dropped-items-scatter', 0.45);
      audio?.sample?.('rivals/good-sport-chuckle', 0.35);
      worldBadge(b.x, b.y, b.z, '👍', 1800);
      showToast('dismantled', `Borrowed materials from ${R.active.name}! +${pts}`, R.active.sp);
    } else {
      toast?.(`Borrowed materials! +${pts}`, 2200);
    }
    root.remove(b.g);
    const i = R.buildings.indexOf(b); if (i >= 0) R.buildings.splice(i, 1);
    R.dismantle = null; R.ringEl.style.display = 'none';
    ctx.onHud?.();
  }
  R.cancelDismantle = () => { R.dismantle = null; if (R.ringEl) R.ringEl.style.display = 'none'; };

  R.update = (dt, t, { playing, paused, p, lead }) => {
    if (!playing || paused || !R.active) return;
    // Territory retired — rival score from builds/actions only.
    R.score += 0;

    // construction
    if (R.buildProg) {
      const b = R.buildProg;
      b.buildLeft -= dt;
      if (b.buildLeft <= 0) finishBuild(b);
    } else if (round.elapsed >= R.nextAt && round.elapsed < round.total * 0.925) {
      tryQueueBuild();
    }

    // dismantle proximity / progress
    if (R.dismantle) {
      const D = R.dismantle; D.cool = Math.max(0, D.cool - dt);
      if (!p || Math.hypot(p.x - D.b.x, p.z - D.b.z) > 7.5) { R.cancelDismantle(); }
      else {
        const pct = Math.min(1, D.prog / D.need);
        R.ringEl.style.background = `conic-gradient(#ffd23f ${pct * 360}deg, #fff3d8 0deg)`;
      }
    } else if (p && nearestBuild(p, 6.5)) {
      // soft hint via act label handled in main
    }
    if (R.startleImm > 0) R.startleImm = Math.max(0, R.startleImm - dt);
    if (R.pileCd > 0) R.pileCd = Math.max(0, R.pileCd - dt);
    for (const b of R.buildings) if (b._claimCd > 0) b._claimCd = Math.max(0, b._claimCd - dt);
    if (R.react) { R.react.t -= dt; if (R.react.t <= 0) R.react = null; }
    if (reactOn() && p && !R.dismantle) { tickRaid(dt, p); /* Flower Flag / claim retired with territory (t135u) */ }
  };


  // ---- cartoon reactions (Fern): Peekaboo / Snack Swipe / Flower Flag
  function pitchFor() {
    const s = SIZE[R.active?.sp] || 'M';
    return s === 'S' ? 1.25 : s === 'L' ? 0.8 : 1.0;
  }
  R.reactBusy = () => !!(R.react && R.react.t > 0);

  R.tryStartle = (p) => {
    if (!reactOn() || !R.active || !p || R.reactBusy()) return false;
    if (R.startleImm > 0) { worldBadge(p.x, p.y, p.z, '👀', 900); return false; }
    const b = nearestBuild(p, 6.5); if (!b) return false;
    const sp = R.active.sp;
    R.react = { kind: 'startle', t: 2.4, b };
    R.startleImm = 25;
    worldBadge(b.x, b.y, b.z, '‼️', 1200);
    bounceMesh(b.mesh, 0.7, 2);
    audio?.sample?.('rivals/startle-eep', 0.5);
    fx?.burst?.(b.x, b.y + 1.2, b.z, 18, 6);
    // drop a little snack for the kid
    const drop = { n: 2, f: 1, w: 1, h: 0 }; drop[Object.keys(drop)[(Math.random() * 3) | 0]] += 1;
    for (const k in drop) if (drop[k]) round.addRes(k, drop[k]);
    setTimeout(() => {
      if (!reactOn() || !R.active) return;
      worldBadge(b.x, b.y, b.z, '💦', 1200);
      audio?.sample?.('rivals/dropped-items-scatter', 0.35);
      toast?.(`${SPECIES[sp].emoji} ${STARTLE_FLAVOR[sp] || 'Eep!'}`, 2400);
    }, 600);
    setTimeout(() => {
      if (!reactOn() || !R.active) return;
      worldBadge(b.x, b.y, b.z, '👍', 1400);
      audio?.sample?.('rivals/good-sport-chuckle', 0.3);
    }, 2000);
    ctx.onHud?.();
    return true;
  };

  R.tryRaid = (p) => {
    if (!reactOn() || !R.active || !p) return false;
    const home = R.buildings.find(b => b.kind === 'home' && b.done);
    if (!home) return false;
    const pile = pileOf(home);
    if (Math.hypot(p.x - pile.x, p.z - pile.z) > 5.5) return false;
    if (R.pileCd > 0) { worldBadge(pile.x, pile.y, pile.z, '🍃', 900); toast?.('Leaf cover — snacks tucked away a bit!', 1800); return false; }
    if (R.raidProg) return true;
    R.raidProg = { home, pile, t: 0, need: 1.5 };
    ensureUi(); R.ringEl.style.display = 'block'; R.ringLab.textContent = 'Swipe\nsnack';
    audio?.sample?.('rivals/sneaky-tiptoe', 0.4);
    worldBadge(pile.x, pile.y, pile.z, '❓', 1000);
    return true;
  };
  function tickRaid(dt, p) {
    const D = R.raidProg; if (!D) return;
    const home = D.home; const pile = D.pile || pileOf(home);
    if (!p || Math.hypot(p.x - pile.x, p.z - pile.z) > 6.5) {
      R.raidProg = null; if (!R.dismantle && R.ringEl) R.ringEl.style.display = 'none'; return;
    }
    D.t += dt;
    const pct = Math.min(1, D.t / D.need);
    R.ringEl.style.background = `conic-gradient(#ff8a1f ${pct * 360}deg, #fff3d8 0deg)`;
    if (D.t < D.need) return;
    R.raidProg = null; R.ringEl.style.display = 'none'; R.pileCd = 40;
    const n = (ctx.cur?.() === 'raccoon' || ctx.leadId?.() === 'raccoon') ? 5 : 4;
    const resOf = { bee: 'n', bumblebee: 'n', butterfly: 'n', moth: 'n', hummingbird: 'n', bat: 'n', robin: 'f', raccoon: 'f', opossum: 'w', bear: 'h' };
    const rk = resOf[R.active.sp] || 'n';
    const got = Math.min(n, Math.max(1, R.bank[rk] | 0)); R.bank[rk] = Math.max(0, (R.bank[rk] | 0) - got);
    round.addRes(rk, got); round.add('team', got * 4);
    worldBadge(pile.x, pile.y, pile.z, '😮', 1200);
    bounceMesh(home.pileMesh || home.mesh, 0.4, 1);
    audio?.sample?.('rivals/raid-rummage', 0.5);
    setTimeout(() => { if (reactOn()) { worldBadge(pile.x, pile.y, pile.z, '🤔', 1500); audio?.sample?.('rivals/good-sport-chuckle', 0.28); } }, 700);
    setTimeout(() => { if (reactOn()) { worldBadge(pile.x, pile.y, pile.z, '🍃', 1800); audio?.sample?.('rivals/leaf-cover-rustle', 0.4); toast?.(`🍃 ${R.active.name} tucked a leaf over their snacks!`, 2400); } }, 1600);
    toast?.(`🧺 Snack swipe! +${got} from ${R.active.name}`, 2400);
    showToast('claimed', `Snack swipe! +${got}`, R.active.sp);
    ctx.onHud?.();
  }

  function completeClaim(patch) {
    if (!patch || !R.active) return false;
    R.claimT = 0; patch._claimCd = 60;
    if (!R.dismantle && !R.raidProg && R.ringEl) R.ringEl.style.display = 'none';
    if (patch.srcId) {
      terr.remove(patch.srcId);
      const r0 = patch.kind === 'outpost' ? 14 : 10, rMax = patch.kind === 'outpost' ? 28 : 16;
      terr.setSource('pc-' + patch.id, 'beacon', patch.x, patch.z, r0 * 0.6, rMax, 0.14, 0);
      patch.srcId = null;
    }
    fx?.burst?.(patch.x, patch.y + 1, patch.z, 24, 7);
    audio?.sample?.('rivals/territory-flag-flap', 0.5);
    worldBadge(patch.x, patch.y, patch.z, '😅', 1400);
    const sp = R.active.sp;
    setTimeout(() => {
      if (!reactOn() || !R.active) return;
      worldBadge(patch.x, patch.y, patch.z, '👍', 1600);
      audio?.sample?.('rivals/good-sport-chuckle', 0.35);
      audio?.sample?.('ui2/rank-down-gentle', 0.35);
      toast?.(`${SPECIES[sp]?.emoji || '⭐'} ${CLAIM_FLAVOR[sp] || 'Good game!'}`, 2600);
    }, 900);
    showToast('claimed', `Flower flag! Patch is yours`, sp);
    /* territory score retired */
    ctx.onHud?.();
    return true;
  }
  // Flower Flag / territory claim retired (t135u). Kept as no-ops so any leftover callers stay safe.
  R.tryClaim = () => { R.claimT = 0; return false; };
  R.beginFlag = () => false;


  R.nearRival = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.z)) ? nearestBuild(p, 6.5) : null;
  R.nearHome = (p) => {
    if (!p || !Number.isFinite(p?.x)) return null;
    const home = R.buildings.find(b => b.kind === 'home' && b.done);
    if (!home) return null;
    const pile = pileOf(home);
    return Math.hypot(p.x - pile.x, p.z - pile.z) < 5.5 ? home : null;
  };
  R.nearPatch = (p) => {
    if (!p || !Number.isFinite(p?.x)) return null;
    for (const b of R.buildings) {
      if (!b.done || b.kind === 'home' || !b.srcId) continue;
      const r = b.kind === 'outpost' ? 12 : b.kind === 'marker' ? 9 : 7;
      if (Math.hypot(p.x - b.x, p.z - b.z) < r) return b;
    }
    return null;
  };
  R.context = (p) => {
    const on = reactOn() && !!R.active;
    const build = (p && Number.isFinite(p?.x)) ? nearestBuild(p, 6.5) : null;
    const home = on ? R.nearHome(p) : null;
    const patch = on ? R.nearPatch(p) : null;
    return {
      build, home, patch,
      canStartle: !!(on && build && R.startleImm <= 0 && !R.reactBusy()),
      canRaid: !!(on && home && R.pileCd <= 0 && !R.raidProg),
      canClaim: false,
      canDismantle: !!build,
    };
  };
  R.placement = () => {
    if (!R.active) return null;
    const L = (typeof ctx.leadId === 'function' ? ctx.leadId() : null) || 'bee';
    const ps = round.score(), rs = Math.floor(R.score);
    const rows = [
      { who: 'you', name: SPECIES[L]?.name || 'You', emoji: SPECIES[L]?.emoji || '⭐', score: ps },
      { who: 'rival', name: R.active.name, emoji: SPECIES[R.active.sp]?.emoji || '🏴', score: rs, sp: R.active.sp },
    ].sort((a, b) => b.score - a.score);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  };
  R.clear = () => {
    for (const b of R.buildings) { root.remove(b.g); if (b.srcId) terr.remove(b.srcId); }
    R.buildings.length = 0; R.active = null; R.dismantle = null;
    if (R.ringEl) R.ringEl.style.display = 'none';
  };

  return R;
}
