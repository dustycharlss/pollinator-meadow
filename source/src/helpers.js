// Hired helpers: friendly neighbours of other species who forage for you. They only ever sip, nibble and
// pick up plentiful food, carry it home and drop it off. Nobody chases or takes anything from anyone.
import * as THREE from 'three';
import { SPECIES, WORLD_R, POND, WATER_Y } from './data.js';
import { POLS, polOf } from './world.js';
import { makeGroundRider, animateGround } from './animals.js';
import { makeFlierModel } from './creatures.js';
import { RES_OF, RES_ICON } from './build.js';
import { badge } from './coop.js';
import { ARCH } from './species.js';

/** who you can hire, their specialty and starting price */
export const HIRE = {
  bee: { base: { n: 8, f: 4 }, note: 'Quick nectar runs' },
  butterfly: { base: { n: 8, w: 3 }, note: 'Nectar, drifts far' },
  hummingbird: { base: { n: 10, w: 4 }, note: 'Fast nectar sipper' },
  robin: { base: { f: 8, n: 4 }, note: 'Forage: worms & berries' },
  raccoon: { base: { f: 8, w: 4 }, note: 'Forage, carries lots' },
  opossum: { base: { f: 6, n: 6 }, note: 'Wood: sticks & twigs' },
  bear: { base: { n: 10, f: 8, w: 6 }, note: 'Honey, slow but strong' }
};
export const HIRE_ORDER = Object.keys(HIRE);
/** Visitors (Fern temp-helpers spec): building type -> visiting species, extra bases for non-hireables */
export const VISIT = { garden: 'butterfly', outpost: 'hummingbird', apiary: 'bee', wormfarm: 'robin', woodpile: 'opossum', honeycave: 'bear', roost: 'bat', stashden: 'raccoon' };
const VBASE = { bumblebee: { n: 9, f: 4 }, moth: { n: 8, f: 4 }, bat: { n: 9, f: 5 } };
const AMBER = 0xffb347;
export const HIRE_MAX = 10;
const TRAIN_TOTAL = lv => 10 + lv * 8;
const SPD = {}, CAP = {}; for (const k in ARCH) { SPD[k] = ARCH[k].hSpd; CAP[k] = ARCH[k].hCap; }
export { SPD as HSPD, CAP as HCAP };
const JOB_ICON = { gather: null, move: '📍', idle: '💤', possessed: '🎮' };

function textSprite() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false })); s.scale.set(5, 1.9, 1); s.renderOrder = 12;
  s.userData.set = txt => { const x = c.getContext('2d'); x.clearRect(0, 0, 256, 96); x.font = 'bold 54px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 9; x.strokeStyle = 'rgba(20,40,30,.85)'; x.strokeText(txt, 128, 50); x.fillStyle = '#fff6b0'; x.fillText(txt, 128, 50); tex.needsUpdate = true; };
  return s;
}

export function createHelpers(scene, ctx) {
  const { world, heightAt, nests, round, territory: T, fx, toast, build, adm } = ctx;
  const list = []; let uid = 1;
  const H = { list, lvl: 0, free: false, hiredTotal: 0, delivered: 0 };
  const tfx = sp => ctx.tech ? ctx.tech().fx(sp) : null, tg = () => ctx.tech ? ctx.tech().g() : { hireCap: 0, hireCost: {}, allSpd: 1, allEat: 1 };
  const isNight = () => (ctx.night ? ctx.night() : 0) > 0.5;
  const capOf = h => CAP[h.sp] + 2 * (h.visitor ? Math.max(0, H.lvl - 1) : H.lvl) + (tfx(h.sp)?.hCap || 0);
  const perm = () => list.filter(h => !h.visitor);
  H.perm = () => perm().length; H.visitors = () => list.filter(h => h.visitor && !h.visitor.bye);
  H.max = () => HIRE_MAX + (tg().hireCap || 0);
  H.speedOf = sp => { const f = tfx(sp), n = isNight(); return (SPD[sp] || 6) * (1 + 0.25 * H.lvl) * (adm.helperSpeed || 1) * (f ? f.hSpd : 1) * tg().allSpd * (n ? (ARCH[sp].night || 1) * (f ? f.hNight : 1) : 1); };
  H.eatOf = sp => { const f = tfx(sp); return ARCH[sp].hEat * (f ? f.hEat * (isNight() ? f.hNightEat : 1) : 1) * tg().allEat; };
  H.capOf = sp => CAP[sp] + 2 * H.lvl + (tfx(sp)?.hCap || 0);
  const ringGeo = new THREE.RingGeometry(0.85, 1, 32); ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const ringMatV = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const ringMatP = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const iconCache = {}; const iconTex = e => iconCache[e] || (iconCache[e] = badge(e, 2.2).material);
  const pops = [];
  function pop(x, y, z, txt) { let s = pops.find(q => !q.visible); if (!s) { s = textSprite(); scene.add(s); pops.push(s); } s.userData.set(txt); s.position.set(x, y, z); s.visible = true; s.userData.t = 0; s.material.opacity = 1; }

  const hireMult = n => n < 3 ? 1 + 0.2 * n : 1.4 + 0.4 * (n - 3);
  H.cost = sp => { const b = HIRE[sp].base, m = hireMult(H.perm()) * (tg().hireCost?.[sp] || 1); let tot = 0; for (const k in b) tot += b[k]; return ctx.price(Math.ceil(tot * m)); };
  H.can = sp => H.perm() < H.max() && (H.free || round.canPay(H.cost(sp)));
  H.trainCost = () => H.lvl >= 3 ? null : ctx.price(TRAIN_TOTAL(H.lvl));
  H.canTrain = () => !!H.trainCost() && (H.free || round.canPay(H.trainCost()));
  H.train = () => { const c = H.trainCost(); if (!c) { toast('🎓 Helpers are fully trained'); return false; } if (!H.free && !round.canPay(c)) { toast('Need more resources to train'); return false; } if (!H.free) round.pay(c); H.lvl++; for (const h of list) h.cap = capOf(h); round.add('building', 20 * H.lvl); toast(`🎓 Helpers trained to level ${H.lvl}: faster and carry more!`); ctx.audio.chime?.(); return true; };

  async function spawn(sp, x, z, rec) {
    const S = SPECIES[sp]; const obj = S.ground ? makeGroundRider(sp, S.size) : await makeFlierModel(sp);
    obj.scale.setScalar(0.85); scene.add(obj);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.scale.setScalar(S.size * 0.9 + 0.8); ring.visible = false; ring.renderOrder = 8; scene.add(ring);
    const icon = new THREE.Sprite(iconTex('💤')); icon.scale.set(2.2, 1.1, 1); icon.renderOrder = 9; icon.visible = false; scene.add(icon);
    const carryS = new THREE.Sprite(iconTex(RES_ICON[RES_OF[sp]])); carryS.scale.set(1.4, 0.7, 1); carryS.renderOrder = 9; carryS.visible = false; scene.add(carryS);
    const h = { uid: rec?.uid || uid++, sp, res: RES_OF[sp], obj, ring, icon, carryS, x, z, y: heightAt(x, z), yaw: 0, carry: rec?.carry || 0, cap: CAP[sp] + 2 * H.lvl, st: 'seek', tgt: -1, tx: x, tz: z, timer: 0, stuck: 0, lx: x, lz: z, speed: 0, sel: false, possessed: false, job: rec?.job || { kind: 'gather', cx: null, cz: null }, depot: rec?.depot || null, phase: Math.random() * 6 };
    uid = Math.max(uid, h.uid + 1); list.push(h); return h;
  }
  H.hire = async (sp, at) => {
    if (H.perm() >= H.max()) { toast(`🐾 That’s a full crew (${H.max()} helpers)`); return null; }
    if (!H.can(sp)) { toast('Need more resources to hire a ' + SPECIES[sp].name); return null; }
    const c = H.cost(sp); if (!H.free) round.pay(c);
    const n = nests[sp], ax = at ? at.x : n.x + 5, az = at ? at.z : n.z + 5;
    if (list.length + 1 > H.max() + 2) { const old = H.visitors().sort((a, b) => a.visitor.born - b.visitor.born)[0]; if (old) farewell(old); }
    const h = await spawn(sp, ax, az); H.hiredTotal++; round.stats.helpers = (round.stats.helpers || 0) + 1;
    fx.burst(ax, heightAt(ax, az) + 2, az, 24, 4); ctx.audio.sample ? ctx.audio.sample('ui2/helper-arrive-whistle', 0.4) : ctx.audio.chime?.(); setTimeout(() => ctx.voice?.(sp, 0.3, 3), 450);
    toast(`${SPECIES[sp].emoji} A friendly ${SPECIES[sp].name} joins your crew! It will gather ${RES_ICON[h.res]} for you`, 3000); return h;
  };

  // ---- visitors: temporary helpers invited from a building
  H.vCool = 0; H.vSerial = 0;
  const RT = () => round.total || 600, kT = () => Math.sqrt(RT() / 600);
  const vLv = p => p.lv || 1;
  H.visitorOf = p => { if (!p) return null; const sp = VISIT[p.type]; if (!sp) return null; if (p.type === 'outpost' && vLv(p) < 2) return null; return sp; };
  H.visitCost = p => { const sp = H.visitorOf(p); if (!sp) return null; const b = HIRE[sp]?.base || VBASE[sp] || { n: 8, f: 4 }; let tot = 0; for (const k in b) tot += b[k];
    return ctx.price(Math.max(4, Math.ceil(tot * hireMult(H.perm()) * 0.35 * (1 + 0.25 * (vLv(p) - 1))))); };
  H.visitDur = p => { const lv = vLv(p); const base = round.mode === 'relaxed' || round.free ? 75 : Math.min(75, Math.max(40, 5 * Math.round(60 * kT() / 5))); return (base + 15 * (lv - 1)) * (adm.visitorTime || 1); };
  H.visitWhy = p => {
    const sp = H.visitorOf(p); if (!sp) return p && p.type === 'outpost' ? 'Upgrade this Beacon to Lv2 to invite visitors' : 'No visitors come to this building';
    if (H.hiredTotal < 1 && !H.free) return 'Hire your first helper before inviting visitors';
    if (list.some(h => h.visitor && !h.visitor.bye && h.visitor.bid === p.id)) return 'A visitor is already here from this building';
    if (H.visitors().length >= 3) return 'Three visitors at once is the most';
    if (H.vCool > 0) return `Next visitor in ${Math.ceil(H.vCool)}s`;
    if (list.length + 1 > H.max() + 2) return 'Your crew is full';
    if (!H.free && !round.canPay(H.visitCost(p))) return 'Need more resources';
    return '';
  };
  H.invite = async p => {
    const w = H.visitWhy(p); if (w) { toast('🎟️ ' + w); return null; }
    const sp = H.visitorOf(p), c = H.visitCost(p); if (!H.free) round.pay(c);
    ctx.audio.sample?.('ui2/visitor-doorbell', 0.45);
    const a = Math.random() * 6.28, ax = p.x + Math.cos(a) * 4, az = p.z + Math.sin(a) * 4;
    const h = await spawn(sp, ax, az); const dur = H.visitDur(p);
    h.visitor = { bid: p.id, left: dur, dur, born: ++H.vSerial, units: 0, warned: 0, grace: 0, bye: 0 };
    h.ring.material = ringMatV; h.icon.material = iconTex('⏳'); attachTimer(h);
    round.stats.visitors = (round.stats.visitors || 0) + 1;
    fx.burst(ax, heightAt(ax, az) + 2, az, 20, 4); setTimeout(() => ctx.audio.sample?.('ui2/helper-arrive-whistle', 0.35), 350); setTimeout(() => ctx.voice?.(sp, 0.3, 3), 700);
    toast(`🎟️ ${SPECIES[sp].emoji} A ${SPECIES[sp].name} visitor came to help for ${Math.round(dur)}s! Visitor: a friend who helps for a little while.`, 3200);
    ctx.onVisitor?.(h); return h;
  };
  function attachTimer(h) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false })); s.scale.set(2.1, 2.1, 1); s.renderOrder = 10; scene.add(s);
    s.userData.draw = (f, amber) => { const x = c.getContext('2d'); x.clearRect(0, 0, 128, 128); x.lineWidth = 14; x.strokeStyle = 'rgba(20,40,30,.55)'; x.beginPath(); x.arc(64, 64, 50, 0, 6.2832); x.stroke();
      x.strokeStyle = amber ? '#ffb347' : '#7dffb0'; x.beginPath(); x.arc(64, 64, 50, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.max(0, f)); x.stroke();
      x.font = '58px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⏳', 64, 68); tex.needsUpdate = true; };
    s.userData.draw(1, false); h.timerS = s; h.timerF = -1;
  }
  function farewell(h) {
    const V = h.visitor; if (!V || V.bye) return; V.bye = 1.2; h.st = 'bye'; if (h.tgt >= 0) claimed.delete(h.tgt);
    const S = SPECIES[h.sp]; pop(h.x, h.y + S.size + 2.5, h.z, '💛'); fx.burst(h.x, h.y + 1.5, h.z, 16, 3); ctx.audio.sample?.('ui2/visitor-timeout', 0.4);
    H.vCool = 30 * kT();
    toast(`${S.emoji} The ${S.name} visitor waves bye-bye! Brought ${V.units} ${RES_ICON[h.res]}`, 2600);
  }
  H.farewell = farewell;
  function visitorTick(h, dt, running) {
    const V = h.visitor;
    if (V.bye) { V.bye -= dt; const n = nests[h.sp] || depotFor(h); if (n) { h.x += (n.x - h.x) * Math.min(1, dt * 0.6); h.z += (n.z - h.z) * Math.min(1, dt * 0.6); } h.y += dt * (2 - V.bye) * 2;
      const k = Math.max(0.01, V.bye / 1.2); h.obj.scale.setScalar(0.85 * k); h.speed = 0; if (V.bye <= 0) { H.remove(h); return 'gone'; } return 'bye'; }
    if (!running) return null;
    if (V.grace > 0) { V.grace -= dt; if (V.grace <= 0 || h.carry <= 0) { farewell(h); return 'bye'; } return null; }
    V.left -= dt;
    if (V.left <= 10 && V.warned < 1) { V.warned = 1; ctx.audio.sample?.('ui/highlight-tick', 0.25); }
    if (V.left <= 3 && V.warned < 2) { V.warned = 2; ctx.audio.sample?.('ui/highlight-tick', 0.25); }
    if (V.left <= 0) { if (h.carry > 0) { V.grace = 15; h.st = 'home'; h.job = { kind: 'gather', cx: null, cz: null }; } else { farewell(h); return 'bye'; } }
    return null;
  }

  // ---- targets
  const claimed = new Set();
  function depotFor(h) {
    if (h.depot) return h.depot;
    let best = null, bd = 1e9;
    for (const id in nests) { const n = nests[id], d = Math.hypot(n.x - h.x, n.z - h.z); if (d < bd) { bd = d; best = { x: n.x, z: n.z, r: 7.5, name: SPECIES[id].name + " home" }; } }
    for (const p of build.placed) if (p.type === 'storage') { const d = Math.hypot(p.x - h.x, p.z - h.z); if (d < bd) { bd = d; best = { x: p.x, z: p.z, r: 3.2, name: 'Acorn Larder' }; } }
    return best;
  }
  function seek(h, t) {
    const B = world.blooms, arr = B.byPol[polOf(h.sp)]; if (!arr) return -1;
    const cx = h.job.cx ?? h.x, cz = h.job.cz ?? h.z, hasC = h.job.cx != null; let best = -1, bs = 1e9;
    for (let k = 0; k < arr.length; k++) {
      const i = arr[k]; if (B.readyAt[i] > t || claimed.has(i)) continue; if (B.isFood(i)) { const f = B.foodAt(i); if (!f || f.buried) continue; }
      const x = B.x[i], z = B.z[i]; const d = Math.hypot(x - h.x, z - h.z) * 0.6 + Math.hypot(x - cx, z - cz) * (hasC ? 1.2 : 0.4) + (T.depth(x, z) > -10 || tfx(h.sp)?.hNoPen ? 0 : 35) + (SPECIES[h.sp].ground && heightAt(x, z) < WATER_Y + 0.1 ? 1e6 : 0);
      if (d < bs) { bs = d; best = i; }
    }
    return best;
  }

  // ---- per-frame
  const v = new THREE.Vector3();
  H.update = (dt, t, running) => {
    const B = world.blooms;
    if (running && H.vCool > 0) H.vCool -= dt;
    for (const h of list.slice()) {
      if (h.possessed) continue;
      if (h.visitor) { const r = visitorTick(h, dt, running); if (r === 'gone') continue; if (r === 'bye') { place(h, dt, t); continue; } }
      const S = SPECIES[h.sp], spd = H.speedOf(h.sp) * (h.visitor?.grace > 0 ? 1.25 : 1); h.cap = capOf(h);
      let moving = false;
      if (running) {
        if (h.job.kind === 'move' || h.job.kind === 'idle') {
          if (h.job.kind === 'move') { const d = Math.hypot(h.job.cx - h.x, h.job.cz - h.z); if (d > 1.2) { h.tx = h.job.cx; h.tz = h.job.cz; moving = true; } else h.job = { kind: 'idle', cx: h.job.cx, cz: h.job.cz }; }
        } else if (h.st === 'seek') {
          if (h.carry >= h.cap) h.st = 'home';
          else { h.timer -= dt; if (h.timer <= 0) { const i = seek(h, t); if (i >= 0) { h.tgt = i; claimed.add(i); h.st = 'go'; h.tx = B.x[i]; h.tz = B.z[i]; h.stuck = 0; } else { h.timer = tfx(h.sp)?.hNoWait ? 0.4 : 1.5; if (h.carry > 0) h.st = 'home'; } } }
        } else if (h.st === 'go') {
          const i = h.tgt; if (B.readyAt[i] > t) { claimed.delete(i); h.st = 'seek'; continue; }
          const d = Math.hypot(h.tx - h.x, h.tz - h.z); if (d > (S.ground ? 1.4 : 1.2)) moving = true; else { h.st = 'eat'; h.timer = H.eatOf(h.sp); }
        } else if (h.st === 'eat') {
          h.timer -= dt; if (h.timer <= 0) {
            const i = h.tgt; claimed.delete(i);
            if (B.readyAt[i] <= t) { const fd = B.isFood(i) ? B.foodAt(i) : null; h.carry = Math.min(h.cap, h.carry + (fd ? fd.val : (S.yield || 1))); B.readyAt[i] = t + 45 / (adm.respawn || 1); world.sparkle.set(i, false); if (fd) world.food.take(i, t); fx.burst(B.x[i], B.y[i], B.z[i], 6, 2.5); }
            h.st = h.carry >= h.cap ? 'home' : 'seek'; h.timer = 0.2;
          }
        } else if (h.st === 'home') {
          const D = depotFor(h); if (!D) { h.st = 'seek'; continue; } h.tx = D.x; h.tz = D.z;
          if (Math.hypot(D.x - h.x, D.z - h.z) > D.r) moving = true;
          else {
            const amt = Math.floor(h.carry); h.carry = 0; h.st = 'seek'; h.timer = 0.3;
            if (h.visitor && amt > 0) { h.visitor.units += amt; round.stats.visitorUnits = (round.stats.visitorUnits || 0) + amt; }
            if (amt > 0) { const pts = Math.round(amt * 5 * (1 + 0.12 * build.storageCount())); round.addRes(h.res, amt); round.add('gather', pts); ctx.onDeliver && ctx.onDeliver(h.sp, amt); round.stats.units += amt; if (!h.visitor) round.stats.helperUnits = (round.stats.helperUnits || 0) + amt; H.delivered += amt; round.flash(h.res); fx.burst(h.x, h.y + 2, h.z, 14, 3); pop(h.x, h.y + S.size + 3, h.z, `+${amt} ${RES_ICON[h.res]}`); }
          }
        }
      }
      // movement
      if (moving) {
        const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, spd * dt);
        let ux = dx / d, uz = dz / d;
        if (S.ground) { // ground animals walk around water instead of through it
          const wet = (a, b) => heightAt(a, b) < WATER_Y + 0.1; if (wet(h.x + ux * 1.5, h.z + uz * 1.5) && !wet(h.x, h.z)) { for (const a of [0.8, -0.8, 1.5, -1.5, 2.3, -2.3]) { const c = Math.cos(a), s2 = Math.sin(a), vx = ux * c - uz * s2, vz = ux * s2 + uz * c; if (!wet(h.x + vx * 1.5, h.z + vz * 1.5)) { ux = vx; uz = vz; break; } } }
        }
        h.x += ux * st; h.z += uz * st; const r = Math.hypot(h.x, h.z), lim = WORLD_R - 4; if (r > lim) { h.x *= lim / r; h.z *= lim / r; }
        let want = Math.atan2(dx, dz), dy = want - h.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); h.yaw += dy * Math.min(1, dt * 8); h.speed = spd;
        if (S.ground) { const p = { x: h.x, z: h.z, y: h.y }; world.phys.resolve(p, 0.7, 1.2, 0.55); h.x = p.x; h.z = p.z; }
        h.stuck += dt; if (h.stuck > 2.5) { if (Math.hypot(h.x - h.lx, h.z - h.lz) < 1.5) { if (h.st === 'go') { claimed.delete(h.tgt); h.st = 'seek'; h.timer = 0.5; } else { h.x += (Math.random() - 0.5) * 4; h.z += (Math.random() - 0.5) * 4; } } h.lx = h.x; h.lz = h.z; h.stuck = 0; }
      } else h.speed = 0;
      const g = Math.max(heightAt(h.x, h.z), WATER_Y);
      if (S.ground) { const fl = world.phys.floor(h.x, h.z, h.y + 1.5, 2); h.y += ((fl.y ?? g) - h.y) * Math.min(1, dt * 12); }
      else { h.phase += dt; const eat = h.st === 'eat' && h.tgt >= 0; const ty = eat ? B.y[h.tgt] + 0.3 : g + 2.6 + Math.sin(h.phase * 2.1) * 0.5; h.y += (ty - h.y) * Math.min(1, dt * 3); }
      place(h, dt, t);
    }
    for (const s of pops) if (s.visible) { s.userData.t += dt; s.position.y += dt * 1.6; s.material.opacity = Math.max(0, 1 - s.userData.t / 1.6); if (s.userData.t > 1.6) s.visible = false; }
  };
  function place(h, dt, t) {
    const S = SPECIES[h.sp], o = h.obj; o.visible = !h.possessed; o.position.set(h.x, h.y, h.z); o.rotation.y = h.yaw;
    if (S.ground) animateGround(o, dt, t, Math.min(1, h.speed / 7), false, false, h.st === 'eat' ? 0.6 : 0);
    else {
      o.rotation.z = Math.sin(h.phase * 3) * 0.08;
      if (o.userData.mixer && o.userData.flyAct) {
        o.userData.flyAct.timeScale = h.st === 'eat' ? 1.0 : (h.speed > 0.5 ? 1.25 : 0.9);
        o.userData.mixer.update(dt);
      } else if (o.userData.flapMats) {
        for (const m of o.userData.flapMats) m.userData.uAmp.value = m.userData.baseAmp;
      }
    }
    const V = h.visitor;
    h.ring.visible = (h.sel || (V && !V.bye && V.left <= 10 && (Math.sin(t * (V.left <= 3 ? 18 : 8)) > 0))) && !h.possessed; h.ring.material = h.possessed ? ringMatP : V ? ringMatV : ringMat; h.ring.position.set(h.x, Math.max(heightAt(h.x, h.z), WATER_Y) + 0.25, h.z);
    const job = h.possessed ? 'possessed' : h.job.kind; const e = V ? '⏳' : job === 'gather' ? RES_ICON[h.res] : JOB_ICON[job]; const m = iconTex(e); if (h.icon.material !== m) h.icon.material = m;
    h.icon.visible = h.sel && !h.possessed; h.icon.position.set(h.x, h.y + S.size * 0.9 + 2.6, h.z);
    if (h.timerS) { const f = V.bye ? 0 : Math.max(0, V.left / V.dur); h.timerS.visible = !V.bye; h.timerS.position.set(h.x, h.y + S.size * 0.9 + 3.1, h.z); const q = Math.round(f * 40); if (q !== h.timerF) { h.timerF = q; h.timerS.userData.draw(f, V.left <= 10); } }
    h.carryS.visible = h.carry > 0 && !h.possessed; const k = 0.6 + 0.5 * (h.carry / h.cap); h.carryS.scale.set(1.4 * k, 0.7 * k, 1); h.carryS.position.set(h.x, h.y + S.size * 0.9 + (h.sel ? 4 : 1.6), h.z);
  }
  // ---- commands
  H.command = (h, kind, x, z) => {
    if (kind === 'move') h.job = { kind: 'move', cx: x, cz: z };
    else if (kind === 'gather') { h.job = { kind: 'gather', cx: x, cz: z }; h.st = h.carry >= h.cap ? 'home' : 'seek'; h.timer = 0; if (h.tgt >= 0) claimed.delete(h.tgt); }
    else if (kind === 'depot') { h.depot = x; if (h.job.kind !== 'gather') h.job = { kind: 'gather', cx: null, cz: null }; h.st = h.carry > 0 ? 'home' : 'seek'; }
    else if (kind === 'auto') { h.job = { kind: 'gather', cx: null, cz: null }; h.depot = null; h.st = 'seek'; }
  };
  H.jobText = h => h.possessed ? 'You are playing it' : h.job.kind === 'move' ? 'Walking to a spot' : h.job.kind === 'idle' ? 'Waiting' : h.st === 'home' ? `Taking ${RES_ICON[h.res]} home` : h.st === 'eat' ? `Gathering ${RES_ICON[h.res]}` : `Looking for ${RES_ICON[h.res]}`;
  H.label = h => `${SPECIES[h.sp].emoji} ${SPECIES[h.sp].name} ${h.visitor ? 'visitor' : 'helper'}`;
  H.timeLeft = h => h.visitor ? Math.max(0, Math.ceil(h.visitor.left)) : null;
  H.at = (x, z) => list.filter(h => !h.possessed && Math.hypot(h.x - x, h.z - z) < 3);
  H.remove = (h, leave) => { if (leave) ctx.audio.sample?.('ui2/helper-leave', 0.4); for (const o of [h.obj, h.ring, h.icon, h.carryS, h.timerS]) if (o) scene.remove(o); if (h.tgt >= 0) claimed.delete(h.tgt); const i = list.indexOf(h); if (i >= 0) list.splice(i, 1); };
  H.clear = () => { while (list.length) H.remove(list[0]); H.lvl = 0; H.vCool = 0; };
  H.clearVisitors = () => { for (const h of list.filter(q => q.visitor)) H.remove(h); };
  H.serialize = () => ({ lvl: H.lvl, uid, vCool: H.vCool, list: list.filter(h => !h.visitor || !h.visitor.bye).map(h => ({ uid: h.uid, sp: h.sp, x: +h.x.toFixed(1), z: +h.z.toFixed(1), carry: h.carry, job: h.job, depot: h.depot, visitor: h.visitor || undefined })) });
  H.restore = async s => { H.clear(); if (!s) return; H.lvl = s.lvl || 0; H.vCool = s.vCool || 0; for (const r of s.list || []) { const h = await spawn(r.sp, r.x, r.z, r); h.carry = r.carry || 0; if (r.visitor) { h.visitor = { ...r.visitor, bye: 0 }; h.ring.material = ringMatV; attachTimer(h); } } uid = Math.max(uid, s.uid || 1); };
  H.spawnFree = async (sp, x, z) => { const prev = H.free; H.free = true; const h = await H.hire(sp, { x, z }); H.free = prev; return h; };
  /** Goal reward: temporary visitor that gathers for a while (no building / cost). */
  H.grantVisitor = async (sp, at, dur = 90) => {
    if (!sp) sp = 'butterfly';
    if (list.length + 1 > H.max() + 2) {
      const old = H.visitors().sort((a, b) => a.visitor.born - b.visitor.born)[0];
      if (old) farewell(old); else return null;
    }
    const n = nests[sp] || nests[Object.keys(nests)[0]];
    const ax = at && at.x != null ? at.x : (n ? n.x + 4 : 0);
    const az = at && at.z != null ? at.z : (n ? n.z + 4 : 0);
    const h = await spawn(sp, ax, az);
    h.visitor = { bid: 'goal', left: dur, dur, born: ++H.vSerial, units: 0, warned: 0, grace: 0, bye: 0 };
    h.ring.material = ringMatV; h.icon.material = iconTex('⏳'); attachTimer(h);
    round.stats.visitors = (round.stats.visitors || 0) + 1;
    fx.burst(ax, heightAt(ax, az) + 2, az, 20, 4);
    ctx.audio.sample?.('ui2/visitor-doorbell', 0.4);
    setTimeout(() => ctx.audio.sample?.('ui2/helper-arrive-whistle', 0.3), 350);
    toast(`🎟️ ${SPECIES[sp].emoji} Goal gift: a ${SPECIES[sp].name} visitor helps for ${Math.round(dur)}s!`, 3200);
    return h;
  };
  return H;
}
