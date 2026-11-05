import * as THREE from 'three';
import { SPECIES, SPECIES_ORDER, STAGE_AT, WORLD_R, ZONES, WATER_Y, inWater } from './data.js';
import { ABILITIES, abilityFx } from './abilities.js';
import { buildMeadow } from './meadow.js';
import { buildWorld, heightAt, meadowHeightAt, setZoneHeight, timeU, POLS, polOf } from './world.js';
import { buildRiders, buildAmbient, updateFlaps } from './creatures.js';
import { buildGroundAmbient, animateGround, animateBirdWings, isBird } from './animals.js';
import { buildNests } from './nests.js';
import { createInput } from './input.js';
import { onAssets, iconUrl, ico } from './assets.js';
import { createWheels } from './wheels.js';
import { createHomeInd } from './homeind.js';
import { createAudio } from './audio.js';
import { loadMany } from './models.js';
import { flightStep, PAT_NAME } from './flight.js';
import { buildCoop, badge } from './coop.js';
import { SPECIAL as SPECIAL0 } from './journal.js';
import { FEATURES } from './features.js';
import { createHelpers, HIRE, HIRE_ORDER, HIRE_MAX } from './helpers.js';
import { createHazards } from './hazards.js';
import { createRivals } from './rivals.js';
import { createGoals } from './goals.js';
import { createOnboarding } from './onboarding.js';
import { createItems } from './items.js';
import { createCosmetics, EMOTES } from './cosmetics.js';
import { createValley, PATCHES, HEAL_PACKUP } from './valley.js';
import { createZones } from './zones.js';
import { createCrew, STARTER_CREW, SKILLS, crewTags, priceForCrew, isFlyer, crewValid } from './crew.js';
import { createContests } from './contests.js';
import { createPackUp } from './packup.js';
import { paintValleyMap, setHealArt, playPackupBurst } from './valley-art.js';
const SPECIAL = FEATURES.teamFoods ? SPECIAL0 : [];
import { ANIMAL_FACTS, MOMENTS } from './moments.js';
import { SEASONS, SEASON_INFO, SU, LOOK, patchSeason, createClock, nightOf, warmOf, NIGHT_T, DAY_T } from './seasons.js';
import { buildWeather } from './weather.js';
import { createGear, GEAR, SLOTS, SLOT_LABEL, RANGE_M, SPEED_M, DRAIN_M, RECH_M, capBonus, costOf, ringMult } from './gear.js';
import { buildBabies } from './babies.js';
import { ACT } from './creatures.js';
import { createTerritory } from './territory.js';
import { createBuild, BUILD_ORDER, CATALOG, RES_KEYS, RES_ICON, RES_OF, buildInfo, TIER_LOOK, BUILDS_OF } from './build.js';
import { createTiers, KID } from './tiers.js';
let tiers = null;
import { track as fdTrack, slotRect as fdSlot } from './frontdoor.js';
import { createRound, LENGTHS, CATS, loadSettings, saveSettings, bests, setBest, savedRound, clearRound, wipeAll } from './round.js';
import { createAdmin } from './admin.js';
import { ARCH, priceFor, barsHtml, SIZE_NAME, statBars } from './species.js';
import { createTech, TREES, TIER, nodeOf } from './tech.js';

const $ = id => document.getElementById(id);
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
const QUALITY = isMobile ? 0.55 : 1;
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
const PR = Math.min(devicePixelRatio || 1, isMobile ? 1.75 : 2);
renderer.setPixelRatio(PR); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const DAYFOG = new THREE.Color(0xb9d8ee), NIGHTFOG = new THREE.Color(0x0b1233);
scene.fog = new THREE.Fog(DAYFOG.clone(), 70, 300);
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 700);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a8a4a, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.4); sun.position.set(60, 120, 40); scene.add(sun);

const audio = createAudio();
const input = createInput(canvas);
const SAVE_KEY = 'pollinator-meadow-v1';
let save = { units: {}, species: 'bee', dew: [], coop: { stage: {} }, journal: {} }; try { save = Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
save.pos = save.pos || {}; save.coop = save.coop || { stage: {} }; save.coop.stage = save.coop.stage || {}; save.journal = save.journal || {};
save.gear = save.gear || {}; for (const id of SPECIES_ORDER) { const g = save.gear[id] = save.gear[id] || { t: [0, 0, 0], bank: save.units[id] || 0 }; g.t = (g.t || [0, 0, 0]).map(v => Math.max(0, Math.min(3, v | 0))); g.bank = g.bank || 0; }
const settings = loadSettings();
let NEWFLAG = null; try { const v = sessionStorage.getItem('pm-auto'); if (v) { sessionStorage.removeItem('pm-auto'); NEWFLAG = JSON.parse(v); } } catch (e) {}
if (NEWFLAG) clearRound();
const savedR = savedRound();
if (!savedR) { save.units = {}; save.pos = {}; save.dew = []; save.coop = { stage: {} }; } // a fresh round starts with fresh nests
const roundDone = savedR ? (savedR.roundDone || {}) : {};
let noSave = false;
const savePos = () => { for (const id of SPECIES_ORDER) { const q = P[id]; if (q && isFinite(q.x + q.y + q.z)) save.pos[id] = [+q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), +q.yaw.toFixed(2)]; } };
const persist = () => { if (noSave) return; savePos(); save.clock = clock.serialize(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// front door (Squid Job 14): splash slots + bar sizing, kept in step with resize / rotation
fdTrack(document.getElementById('load'), 'splash', () => {
  const L = document.getElementById('load'), r = L.querySelector('.fdIn').getBoundingClientRect(), t = fdSlot('splash', 'loading-text');
  L.style.setProperty('--fh', r.height + 'px'); L.style.setProperty('--cap', r.height / 2 + 'px'); if (t) document.getElementById('loadTxt').style.fontSize = Math.max(11, Math.min(22, t.h * 0.62)) + 'px';
});
function setLoad(p, txt) { $('loadBar').style.width = (5 + p * 95) + '%'; if (txt) $('loadTxt').textContent = txt; }
let shopBase = 0, shopT = 0, gearFx, shopOpen = false, shopPv = [0, 0, 0], shopSel = 0, world, riders, nests, ambient, groundAmb, stars, moon, shadow, fx, coop, meadow; const shadows = {}, marks = {};
const state = {};
const NEEDED = ['bee', 'bumblebee', 'butterflyB', 'hummingbird', 'moth', 'bat', 'beehive', 'honeycomb', 'twig', 'acorn', 'strawberry', 'raccoonQ', 'opossum', 'bearB', 'robinJ'];

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 70 : 62; camera.updateProjectionMatrix();
  world && world.resize(h * PR, camera.fov);
}
addEventListener('pagehide', () => persist()); document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
addEventListener('resize', resize); addEventListener('orientationchange', resize);

// ---------- home abilities (unlocked by home stage-ups) ----------
const abCache = {};
function abOf(id) {
  const st = nests ? nests[id].stage : 0; let c = abCache[id];
  const gt = save.gear[id].t, gk = gt.join('');
  const sk = build ? build.storageCount() : 0, tv = tech ? tech.ver : 0, nb = night > 0.5 ? 1 : 0, eb = round && round.running && round.elapsed < round.total / 3 ? 1 : 0;
  if (!c || c.st !== st || c.gk !== gk || c.sk !== sk || c.tv !== tv || c.nb !== nb || c.eb !== eb) {
    const T = tech ? tech.fx(id) : null, A = ARCH[id] || {};
    const sm = (T ? T.spd * (nb ? T.night : 1) * (eb ? T.early : 1) : 1) * (nb ? (A.night || 1) : 1);
    const f = abilityFx(id, st), sp = SPECIES[id], m0 = sp.mv, mv = Object.assign({}, m0, { run: m0.run * f.run * SPEED_M[gt[1]] * sm });
    if (m0.fly) mv.fly = Object.assign({}, m0.fly, { drain: m0.fly.drain * f.drain * DRAIN_M[gt[1]] * (T ? T.drain : 1), rech: m0.fly.rech * RECH_M[gt[1]] * (T ? T.rech : 1) }, m0.fly.speed ? { speed: m0.fly.speed * f.speed * sm } : {});
    const rm = T ? T.reach : 1;
    c = abCache[id] = { st, gk, sk, tv, nb, eb, fx: f, T, mv, sm, cap: sp.carry + f.carry + capBonus(sp.carry, gt[2]) + sk + (T ? T.cap + T.larder * sk : 0), reach: sp.reach * f.reach * RANGE_M[gt[0]] * rm, dig: (sp.dig || 0) * f.reach * RANGE_M[gt[0]] * rm, pick: T ? T.pick : 0, hover: !!(T && T.hover), autodig: !!(T && T.autodig), pts: T ? T.pts : 1, conv: T ? T.conv : [] };
  }
  if (items && items.capMul() !== 1) return Object.assign({}, c, { cap: Math.round(c.cap * items.capMul()) });
  return c;
}
// ---------- carry ring: a radial progress ring on the ground around the animal (replaces the old carry bar) ----------
let ringShown = 0, ringMesh = null;
function buildRing() {
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    uniforms: { uFill: { value: 0 }, uColor: { value: new THREE.Color('#ffd23f') }, uIn: { value: 0.7 }, uOut: { value: 0.82 }, uPulse: { value: 0 }, uFull: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz * vec2(1.0, -1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vP; uniform float uFill,uIn,uOut,uPulse,uFull; uniform vec3 uColor;
      void main(){ float r = length(vP); float a = atan(vP.x, vP.y); if (a < 0.0) a += 6.2831853; float f = a / 6.2831853;
        float aa = 0.02; float band = smoothstep(uIn - aa, uIn + aa, r) * (1.0 - smoothstep(uOut - aa, uOut + aa, r));
        float fillM = 1.0 - smoothstep(uFill - 0.004, uFill + 0.004, f); fillM *= step(0.001, uFill);
        vec3 col = clamp(mix(uColor * 1.25, vec3(1.0, 0.86, 0.35), 0.5), 0.0, 1.0); vec3 c = mix(vec3(1.0), col, fillM);
        float al = band * mix(0.45, 1.0, fillM);
        float glow = exp(-abs(r - (uIn + uOut) * 0.5) * 9.0) * uFull * (0.25 + 0.35 * uPulse);
        c = mix(c, vec3(1.0, 0.96, 0.7), uFull * (0.35 + 0.4 * uPulse) * fillM);
        al = max(al, glow * (1.0 - smoothstep(0.98, 1.0, r)));
        if (al < 0.01) discard; gl_FragColor = vec4(c, al); }` });
  const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh); return mesh;
}
let ringK = 1, ringR = 1.4;
function viewTiers(id) { return shopOpen && id === cur ? shopPv : save.gear[id].t; }
function updateRing(p, sp, t, dt) {
  if (!ringMesh) return;
  const u = ringMesh.material.uniforms, target = Math.min(1, p.carried / abOf(cur).cap), full = p.carried >= abOf(cur).cap ? 1 : 0;
  ringShown += (target - ringShown) * Math.min(1, dt * 9); if (Math.abs(target - ringShown) < 0.002) ringShown = target;
  ringK += (ringMult(viewTiers(cur)[0]) - ringK) * Math.min(1, dt * 8); const R = (0.3 * sp.size + 1.05) * ringK, Q = R * 1.45; ringR = R;
  ringMesh.visible = playing; ringMesh.position.set(p.x, (p.floorY ?? p.y) + 0.1, p.z); ringMesh.scale.setScalar(Q);
  u.uIn.value = (R - 0.24) / Q; u.uOut.value = R / Q; u.uFill.value = ringShown; u.uColor.value.set(sp.color); u.uFull.value += (full - u.uFull.value) * Math.min(1, dt * 6); u.uPulse.value = 0.5 + 0.5 * Math.sin(t * 5);
}

// ---------- stamina ring: second hoop around the character (cyan); HUD bar removed ----------
let stamMesh = null, stamShown = 1;
function buildStamRing() {
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
    uniforms: { uFill: { value: 1 }, uColor: { value: new THREE.Color('#7fd8ff') }, uIn: { value: 0.7 }, uOut: { value: 0.82 }, uPulse: { value: 0 }, uTired: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz * vec2(1.0, -1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vP; uniform float uFill,uIn,uOut,uPulse,uTired; uniform vec3 uColor;
      void main(){ float r = length(vP); float a = atan(vP.x, vP.y); if (a < 0.0) a += 6.2831853; float f = a / 6.2831853;
        float aa = 0.02; float band = smoothstep(uIn - aa, uIn + aa, r) * (1.0 - smoothstep(uOut - aa, uOut + aa, r));
        float fillM = 1.0 - smoothstep(uFill - 0.004, uFill + 0.004, f); fillM *= step(0.001, uFill);
        vec3 col = mix(uColor, vec3(1.0, 0.55, 0.45), uTired);
        vec3 c = mix(vec3(0.15, 0.22, 0.28), col * 1.15, fillM);
        float al = band * mix(0.35, 0.95, fillM);
        if (al < 0.01) discard; gl_FragColor = vec4(c, al); }` });
  const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 4; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh); return mesh;
}
function updateStamRing(p, sp, t, dt) {
  if (!stamMesh) return;
  const fly = !!(sp.mv && sp.mv.fly);
  const target = fly ? Math.max(0, Math.min(1, p.stam)) : 1;
  stamShown += (target - stamShown) * Math.min(1, dt * 10); if (Math.abs(target - stamShown) < 0.002) stamShown = target;
  // sit just outside the carry hoop
  const R = ringR + 0.28, Q = R * 1.45;
  stamMesh.visible = playing && fly; // only flyers drain stamina
  stamMesh.position.set(p.x, (p.floorY ?? p.y) + 0.08, p.z); stamMesh.scale.setScalar(Q);
  const u = stamMesh.material.uniforms;
  u.uIn.value = (R - 0.18) / Q; u.uOut.value = R / Q; u.uFill.value = stamShown;
  u.uTired.value += (((p.tired || stamShown < 0.15) ? 1 : 0) - u.uTired.value) * Math.min(1, dt * 6);
  u.uPulse.value = 0.5 + 0.5 * Math.sin(t * 6);
}

// ---------- player ----------
const P = {}; // per-species state
function initPlayer(id) {
  const n = SPECIES[id].nest, a = Math.atan2(n.z, n.x) + 0.5;
  const x = n.x + Math.cos(a) * 15, z = n.z + Math.sin(a) * 15;
  P[id] = { x, z, y: heightAt(x, z), yaw: Math.atan2(n.x - x, n.z - z), vx: 0, vz: 0, vy: 0, grounded: true, coyote: 0, buf: 0, jumpsLeft: 0, airT: 0, flapArmed: true, flapping: false, jumpUp: false, stam: 1,
    carried: 0, boostT: 0, boostCd: 0, digT: 0, digCd: 0, t: 0, speed: 0, fl: null };
  const q = save.pos && save.pos[id]; // animals stay where you parked them, even across reloads
  if (q && isFinite(q[0] + q[1] + q[2]) && Math.hypot(q[0], q[2]) < WORLD_R - 4) { const P0 = P[id]; P0.x = q[0]; P0.z = q[2]; P0.y = Math.max(q[1], heightAt(q[0], q[2])) + 0.6; P0.yaw = q[3] || 0; P0.grounded = false; }
}
SPECIES_ORDER.forEach(initPlayer);
const clock = createClock(save.clock); let weather, babies; const wxCol = new THREE.Color(), tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), SW = [0, 0, 0, 0];
let lead = (settings.lead && SPECIES[settings.lead]) ? settings.lead : 'bee', tech = null, techOpen = false;
let valley = null, crew = null, contests = null, packup = null;
let valleySession = null; // { patchId } when playing a valley patch
let healAmt = 0; // 0..1
let zones = null;
const price = total => {
  if (valleySession && crew && !crew.arcade) return crew.price(total);
  return priceFor(lead, total);
};
let cur = 'bee', night = 0, curNight = false, cam = { yaw: 0, pitch: 0.35, fx: 0, fy: 0, fz: 0, fov: 62, hold: 0, zoom: 1, zoomT: 1, offX: 0, offY: 0, offXT: 0, offYT: 0 };

// species voice on switch (integration-map species.*.voice); fallback blip
const VOICE = { bee: 'bee-buzz-short', bumblebee: 'bee-buzz-short', hummingbird: 'hummingbird-hum', bat: 'bat-squeak', raccoon: 'raccoon-chitter', robin: 'robin-chirp', opossum: 'possum-chitter', bear: 'bear-happy-grunt', butterfly: 'butterfly-flutter', moth: 'moth-flutter' };
const voiceT = {}; // species voice, throttled per species so hire/deposit/switch don't spam it
function voice(id, vol = 0.35, gap = 5) { const t = performance.now() / 1000; if (!VOICE[id] || t - (voiceT[id] ?? -99) < gap) return false; voiceT[id] = t; audio.sample('species/' + VOICE[id], vol); return true; }
function selectSpecies(id, first) {
  if (shopOpen) return;
  if (rts.possessed && !first && id !== rts.possessed.sp) releaseHelper();
  const prev = cur; cur = id; save.species = id; persist(); input.jump = false;
  if (!first && prev !== id) { cam.swoop = 1.3; voice(id, 0.4, 0.6) || VOICE[id] || audio.blip(6); fx.burst(P[id].x, P[id].y + 2.2, P[id].z, 16, 4); }
  const sp = SPECIES[id], p = P[id];
  $('spEm').textContent = sp.emoji; $('spName').textContent = sp.name; $('actTxt').textContent = sp.actName; $('actEm').textContent = sp.actEmoji; /* stamChip hidden — stamina is a world ring */
  if (sp.nocturnal !== curNight) setNight(sp.nocturnal, true);
  journalUnlock('a:' + id, sp.name);
  world.sparkle.setSpecies(id, performance.now() / 1000);
  if (first) { cam.yaw = p.yaw; cam.fx = p.x; cam.fz = p.z; cam.fy = p.y; } cam.pitch = 0.35; fxColor(sp.color); buildTray(); coopTipT = 0;
  updateHud(); if (looks) looks.apply(riders[id]); if (!first) toast(`${sp.emoji} ${sp.name}${sp.mv.fly ? ' · ' + PAT_NAME[id] : ''}`, 2200);
  buildCards(); setActLabel(); if (build && build.active) renderBTray(true);
}
function setNight(v, auto) { clock.set(v ? NIGHT_T : DAY_T); if (!auto) state.skipT = 0; syncNightFlag(); }
function syncNightFlag() { const v = nightOf(clock.t) > 0.5; if (v === curNight) return; if (state.musicLive) { moodOver = v ? 'dusk' : 'morning'; moodOverT = performance.now() / 1000 + 26; } curNight = v; $('bNight').textContent = v ? '☀️ Switch to day' : '🌙 Switch to night'; }

// ---------- HUD ----------
let toastT = 0; function toast(msg, ms = 2400) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function setHint(s) { $('hint').textContent = s; }
function updateHud() {
  const sp = SPECIES[cur], p = P[cur], n = nests[cur];
  $('carryTxt').textContent = `${p.carried} / ${abOf(cur).cap} ${sp.pickName}`; 
  const st = n.stage, next = STAGE_AT[st + 1], u = n.units;
  $('nestTxt').textContent = `${sp.nest.emoji} ${sp.nest.name} · ${sp.nest.stages[st]} (${st + 1}/4)` + (next ? ` · ${u}/${next}` : ' · complete!');
  const prevAt = STAGE_AT[st]; $('nestFill').style.width = (next ? 100 * (u - prevAt) / (next - prevAt) : 100) + '%';
  $('abTxt').textContent = (ABILITIES[cur] || []).map((a, i) => i < st ? a.icon : '🔒').join(' ') + (ABILITIES[cur] && st < 3 ? '  · next: ' + ABILITIES[cur][st].name + ' at ' + (st + 2 > 4 ? '' : 'stage ' + (st + 2)) : '  · all abilities!');
  $('gTxt').textContent = '🛠️ ' + gearLine(cur);
  $('dewTxt').textContent = `${save.dew.length} / ${world.platforms.count}`;
}
function renderMenuTeam() { const b = $('menuTeam'); if (!b) return; if (!crew) { b.innerHTML = ''; return; }
  b.innerHTML = `<b>🐾 Your team</b><span class="mt">${crew.get().map(id => `<button class="mtc ${id === cur ? 'on' : ''}" data-id="${id}">${SPECIES[id].emoji}<small>${SPECIES[id].name}</small></button>`).join('')}</span><button class="pill" id="mtEdit">✏️ Change team</button>`;
  b.querySelectorAll('.mtc').forEach(c => c.onclick = () => { const id = c.dataset.id; if (valleySession) crew.swapById(id); else selectSpecies(id); closeMenu(); });
  $('mtEdit').onclick = () => { closeMenu(); openTeamPick(() => { if ($('menu')) renderMenuTeam(); }); }; }
function buildCards() {
  const ORDER = valleySession && crew ? crew.get() : SPECIES_ORDER;
  $('cards').innerHTML = ORDER.map((id, i) => { const sp = SPECIES[id], n = nests[id]; const next = STAGE_AT[n.stage + 1];
    return `<div class="card ${id === cur ? 'sel' : ''}" data-id="${id}"><span class="em">${sp.emoji}</span><div style="flex:1"><b>${i + 1}. ${sp.name}</b>${sp.nocturnal ? '<span class="tag">🌙 night</span>' : '<span class="tag">☀️ day</span>'}<small>${sp.blurb}</small><small>🏠 ${sp.nest.name} — ${sp.nest.stages[n.stage]} (stage ${n.stage + 1}/4)</small><small class="abs">${(ABILITIES[id] || []).map((a, i) => i < n.stage ? `<span title="${a.desc}">${a.icon} <b>${a.name}</b> — ${a.desc}</span>` : `<span class="lk">🔒 ${a.name} (stage ${i + 2})</span>`).join('<br>')}</small><div class="pg"><i style="width:${next ? 100 * (n.units - STAGE_AT[n.stage]) / (next - STAGE_AT[n.stage]) : 100}%"></i></div></div></div>`; }).join('');
  document.querySelectorAll('.card').forEach(c => c.onclick = () => { if (valleySession && crew) crew.swapById(c.dataset.id); else selectSpecies(c.dataset.id); closeMenu(); });
}
const openMenu = () => { if (shopOpen) return; buildCards(); renderMenuTeam(); $('menu').classList.add('on'); input.active = false; paused = true; };
const closeMenu = () => { $('menu').classList.remove('on'); syncPause(); };
const swapOK = () => {
  if (valleySession && crew) return true; // crew of 3 always free to swap
  return !!adm.allowSwap || (round && round.mode === 'relaxed');
};
input.hooks.swap = d => playing && !paused && swapOK() && swapNext(d);
input.hooks.menu = () => shopOpen ? 0 : $('menu').classList.contains('on') ? closeMenu() : (playing && (swapOK() ? openMenu() : openHub('animals')));
input.hooks.species = i => {
  if (!(playing && swapOK())) return;
  if (valleySession && crew && i >= 0 && i < 3) { crew.swapTo(i); return; }
  selectSpecies(SPECIES_ORDER[i]);
};
input.hooks.night = () => playing && setNight(!curNight);
input.hooks.season = () => playing && !paused && toggleBuild();
$('bSeason').onclick = () => playing && clock.nextSeason();
$('bSwap').addEventListener('pointerdown', e => { e.preventDefault(); if (playing && !paused) swapNext(1); });
$('bSwap').oncontextmenu = e => e.preventDefault();
$('spChip').onclick = () => swapOK() ? openMenu() : openHub('animals'); $('menuClose').onclick = closeMenu;
$('bNight').onclick = () => setNight(!curNight);
async function showCredits() {
  const body = $('crBody'); if (!body.dataset.done) { try { const c = await (await fetch(import.meta.env.BASE_URL + 'credits.json')).json();
    body.innerHTML = `<p><b>CC-BY 4.0 / attribution required</b></p><ul>${c.attribution.map(e => `<li>${e.credit}${e.url ? ` — <a href="${e.url}" target="_blank" rel="noopener">source</a>` : ''}<span class="tag">${e.license}</span>${e.note ? `<br><i>${e.note}</i>` : ''}</li>`).join('')}</ul><p><b>CC0 / public domain</b></p><ul>${c.cc0.map(e => `<li>${e}</li>`).join('')}</ul><p style="opacity:.7">${c.footer}</p>`; body.dataset.done = 1; } catch (e) { body.textContent = 'Credits unavailable.'; } }
  openOv('credits');
}
$('bInfo').onclick = () => showCredits(); $('startCredits').onclick = showCredits;
$('crClose').onclick = () => closeOv('credits');
let playing = false, paused = true;
function swapNext(d = 1) {
  const hl = helpers ? helpers.list : [], L = [...SPECIES_ORDER, ...hl], n = L.length;
  const i = rts.possessed ? SPECIES_ORDER.length + hl.indexOf(rts.possessed) : SPECIES_ORDER.indexOf(cur); const nx = L[(i + d + n) % n];
  if (typeof nx === 'string') { if (rts.possessed) releaseHelper(); selectSpecies(nx); } else possessHelper(nx);
}


// ---------- pickup fx ----------
function buildFx() {
  const N = 120, g = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3).fill(-9999), vel = new Float32Array(N * 3), life = new Float32Array(N);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const tex = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'img/star.png');
  const m = new THREE.PointsMaterial({ map: tex, size: 1.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd23f }); const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  let head = 0;
  return { m, burst(x, y, z, n = 14, spd = 5) { for (let i = 0; i < n; i++) { const k = head++ % N; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; const a = Math.random() * 6.28, b = Math.random() * 2 - 0.5; vel[k * 3] = Math.cos(a) * spd * (0.4 + Math.random()); vel[k * 3 + 1] = b * spd; vel[k * 3 + 2] = Math.sin(a) * spd * (0.4 + Math.random()); life[k] = 0.8 + Math.random() * 0.5; } },
    update(dt) { let any = false; for (let k = 0; k < N; k++) { if (life[k] > 0) { life[k] -= dt; any = true; pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt; vel[k * 3 + 1] -= 2 * dt; if (life[k] <= 0) pos[k * 3 + 1] = -9999; } } if (any) g.attributes.position.needsUpdate = true; } };
}
function fxColor(c) { fx && fx.m.color.set(c); }


// ---------- gear workbench ----------
const tierName = (id, si, t) => t ? GEAR[id][si].names[t - 1] : 'No gear yet';
function gearLine(id, long) { const g = save.gear[id].t; return SLOTS.map((_, i) => long ? `${GEAR[id][i].icon} ${g[i] ? GEAR[id][i].names[g[i] - 1] + ' ' + '★'.repeat(g[i]) : '—'}` : `${GEAR[id][i].icon}${g[i]}`).join(long ? '  ·  ' : ' '); }
function gearEffect(id, si, t) {
  const sp = SPECIES[id];
  if (si === 0) return `Pickup reach ×${RANGE_M[t].toFixed(2).replace(/0$/, '')}`;
  if (si === 1) return `Speed +${Math.round((SPEED_M[t] - 1) * 100)}%` + (sp.mv.fly ? ` · stamina +${Math.round((1 / DRAIN_M[t] - 1) * 100)}%` : '');
  return `Carry ${sp.carry + capBonus(sp.carry, t)} ${sp.pickName}`;
}
const gCost = (id, t) => costOf(SPECIES[id].carry, t);
function nearHome() { const n = nests[cur], p = P[cur]; return Math.hypot(p.x - n.x, p.z - n.z) < 16; }
function affordable(id) { const g = save.gear[id]; return g.t.some(t => t < 3 && g.bank >= gCost(id, t + 1)); }
function updateShopChip() {
  const show = playing && !paused && !shopOpen && nests && nearHome(), c = $('shopChip');
  c.style.display = show ? '' : 'none';
  if (show) { $('shopChipN').textContent = affordable(cur) ? '✨ upgrades ready!' : ''; if (!save.gearHint && !document.body.classList.contains('buildOn')) { save.gearHint = 1; toast('🛠️ You can spend what you gather on silly gear — tap 🤝 Interact at home (or press G)!', 4200); } }
}
function renderShop() {
  const id = cur, sp = SPECIES[id], g = save.gear[id];
  $('shAn').textContent = `${sp.emoji} ${sp.name}'s Workbench`; $('shBank').textContent = `${sp.pickEmoji || '🎁'} ${g.bank} ${sp.pickName}`;
  $('shRows').innerHTML = SLOTS.map((k, si) => {
    const t = g[si === 0 ? 't' : 't'][si], gi = GEAR[id][si], next = t < 3 ? gCost(id, t + 1) : 0, can = t < 3 && g.bank >= next;
    const pips = [1, 2, 3].map(n => `<i class="${n <= t ? 't' + n : ''}"></i>`).join('');
    const info = t < 3 ? `${t ? gearEffect(id, si, t) : 'Base'} → <b style="color:#ffd23f">${gearEffect(id, si, t + 1)}</b> · ${gi.names[t]}` : `${gearEffect(id, si, 3)} · fully upgraded!`;
    return `<div class="shr ${si === shopSel ? 'sel' : ''}" data-s="${si}"><span class="ic">${gi.icon}</span><div class="tx"><b>${SLOT_LABEL[k]}: ${tierName(id, si, t)}<span class="pp">${pips}</span></b><small>${info}</small></div>` +
      (t < 3 ? `<button class="buy" data-s="${si}" ${can ? '' : 'disabled'}>${can ? 'Buy ' : ''}${next}</button>` : `<button class="buy max" disabled>MAX ★</button>`) + `</div>`;
  }).join('');
  $('shNote').textContent = save.gear[id].t.every(t => t === 3) ? '🌟 All gear maxed — what a fancy animal!' : 'Tap a row to preview the next upgrade on your animal.';
}
function previewShop() { const g = save.gear[cur].t; shopPv = g.map((t, i) => (i === shopSel && t < 3 ? t + 1 : t)); gearFx.set(cur, shopPv); }
function openShop() {
  if (!playing || paused || shopOpen) return;
  if (!nearHome()) { toast(`🛠️ Your workbench is at home — head to your ${SPECIES[cur].nest.name} to upgrade gear`, 2800); return; }
  shopOpen = true; input.active = false; paused = true; document.body.classList.add('shopOn');
  const g = save.gear[cur].t; let si = g.findIndex((t, i) => t < 3 && save.gear[cur].bank >= gCost(cur, t + 1)); if (si < 0) si = g.findIndex(t => t < 3); shopSel = Math.max(0, si);
  cam.fx = P[cur].x; cam.fz = P[cur].z; { const nn = nests[cur]; shopBase = Math.atan2(nn.x - P[cur].x, nn.z - P[cur].z); shopT = 0; P[cur].yaw = shopBase + Math.PI; riders[cur].rotation.y = P[cur].yaw; } cam.yaw = shopBase; cam.zoomT = 0.42; const land = innerWidth > innerHeight; cam.offXT = land ? 0.3 : 0; cam.offYT = land ? 0 : -0.27; if (!land) cam.pitch = 0.22;
  renderShop(); previewShop(); $('shop').classList.add('on'); audio.blip(3);
}
function closeShop() {
  if (!shopOpen) return; shopOpen = false; gearFx.set(cur, save.gear[cur].t); shopPv = save.gear[cur].t;
  $('shop').classList.remove('on'); document.body.classList.remove('shopOn'); cam.zoomT = 1; cam.offXT = cam.offYT = 0;
  syncPause();
  updateHud(); updateShopChip();
}
function buyGear(id, si) {
  const g = save.gear[id], t = g.t[si]; if (t >= 3) return false; const cost = gCost(id, t + 1); if (g.bank < cost) return false;
  g.bank -= cost; g.t[si] = t + 1; abCache[id] = null; gearFx.set(id, g.t); gearFx.burst(id, t === 2 ? 0xffd23a : 0xbff7c8);
  audio.sample('ui2/gear-equip-clink', 0.45); persist(); buildTray(); updateHud();
  toast(`${GEAR[id][si].icon} ${GEAR[id][si].names[t]}! ${gearEffect(id, si, t + 1)}`, 2600);
  if (shopOpen) { shopSel = g.t[si] < 3 ? si : Math.max(0, g.t.findIndex(v => v < 3)); renderShop(); previewShop(); }
  return true;
}
function gearSet(id, tiers) { save.gear[id].t = tiers.slice(); abCache[id] = null; gearFx.set(id, tiers); buildTray(); if (id === cur) updateHud(); }
$('shopChip').onclick = () => openShop(); $('shClose').onclick = closeShop;
input.hooks.shop = () => shopOpen ? closeShop() : openShop();
$('shRows').addEventListener('click', e => { const b = e.target.closest('.buy'); if (b) { buyGear(cur, +b.dataset.s); return; } const r = e.target.closest('.shr'); if (r) { shopSel = +r.dataset.s; renderShop(); previewShop(); audio.blip(1); } });

// ---------- co-op UI: tray, tip pill, journal ----------
let coopTipT = 0, tipMute = 0, tipNeed = null, guide = null, tipKey = '';
const SHORT = { bee: 'Bee', butterfly: 'Butterfly', hummingbird: 'Hummer', moth: 'Moth', bat: 'Bat', raccoon: 'Raccoon', robin: 'Robin', opossum: 'Possum', bear: 'Bear', bumblebee: 'Bumble' };
let trayHelpers = false;
function buildTray() {
  const hl = helpers ? helpers.list.filter(h => !h.visitor) : []; if (!hl.length) trayHelpers = false;
  if (trayHelpers) { $('tray').innerHTML = `<button class="tc tg" data-tg="0" title="Your animals">◀<small>Animals</small></button>` + hl.map(h => `<button class="tc hl ${h === rts.possessed ? 'sel' : ''}" data-h="${h.uid}" title="${SPECIES[h.sp].name} helper">${SPECIES[h.sp].emoji}<small>Helper</small></button>`).join(''); return; }
  $('tray').innerHTML = SPECIES_ORDER.map(id => `<button class="tc ${id === cur && !rts.possessed ? 'sel' : ''}" data-id="${id}" title="${SPECIES[id].name}">${SPECIES[id].emoji}<small>${SHORT[id]}</small><span class="gp">${save.gear[id].t.map(t => `<i class="${t ? 't' + t : ''}"></i>`).join('')}</span></button>`).join('')
    + (hl.length ? `<button class="tc tg ${rts.possessed ? 'sel' : ''}" data-tg="1" title="Your helpers">🐾<small>Helpers ${hl.length}</small></button>` : '');
}
$('tray').addEventListener('pointerdown', e => { const b = e.target.closest('.tc'); if (!b) return; e.preventDefault(); e.stopPropagation(); if (!playing || paused) return; if (b.dataset.tg) { trayHelpers = b.dataset.tg === '1'; buildTray(); return; } if (b.dataset.h) { const h = helpers.list.find(q => q.uid === +b.dataset.h); if (h && h !== rts.possessed) possessHelper(h); } else if (swapOK() || b.dataset.id === lead || b.dataset.id === cur) selectSpecies(b.dataset.id); else toast('Locked to ' + SPECIES[lead].emoji + ' ' + SPECIES[lead].name + ' this round (Relaxed can swap)', 2400); });
const JTOTAL = SPECIAL.length + SPECIES_ORDER.length + MOMENTS.length;
const specialFound = () => SPECIAL.filter(s => save.journal[s.id]).length;
const jFound = () => specialFound() + Object.keys(save.journal).filter(k => k[0] === 'a' && k[1] === ':' || k[0] === 'm' && k[1] === ':').length;
function refreshJournalBadge() { $('jBadge').textContent = jFound() + '/' + JTOTAL; }
/** record a new Animals / Meadow Moments page (once) */
function journalUnlock(key, label) {
  if (save.journal[key]) return false; save.journal[key] = { t: Date.now() }; persist(); refreshJournalBadge();
  if (playing && round && round.running) round.add('team', 15);
  if (playing) { $('bPause').classList.add('pulse'); $('bJournal').classList.add('pulse'); // hub pulses (journal lives in the hub; Fern onboarding beat 16)
    toast('📖 New journal page: ' + label, 3200); audio.blip(5); }
  if ($('journal').classList.contains('on')) renderJournal(); return true;
}
let jTab = FEATURES.teamFoods ? 0 : 1; const jPages = [0, 0, 0];
const JTABS = [() => SPECIAL, () => SPECIES_ORDER.map(id => ({ id: 'a:' + id, sp: SPECIES[id] })), () => MOMENTS.map(m => ({ ...m, id: 'm:' + m.id }))];
function openJournal(page, tab) {
  if (shopOpen) return;
  if (tab != null) jTab = tab; if (jTab === 0 && !FEATURES.teamFoods) jTab = 1;
  if (jTab === 0) { const firstUn = SPECIAL.findIndex(s => !save.journal[s.id]); jPages[0] = page != null ? page : Math.max(0, firstUn < 0 ? 0 : jPages[0]); }
  else if (page != null) jPages[jTab] = page;
  renderJournal();
  $('journal').classList.add('on'); input.active = false; paused = true; $('bJournal').classList.remove('pulse'); $('bPause').classList.remove('pulse');
}
function closeJournal() { $('journal').classList.remove('on'); syncPause(); }
function renderJournal(anim) {
  const list = JTABS[jTab](), jPage = (jPages[jTab] = Math.min(jPages[jTab], list.length - 1)), d = list[jPage], got = save.journal[d.id];
  const art = $('jArt'), jt = $('jTeam');
  $('jGuide').style.display = 'none'; $('jFact').style.display = got ? '' : 'none'; $('jHint').style.display = got ? 'none' : '';
  if (jTab === 0) {
    const pz = coop.puzzles.find(z => z.def.id === d.id);
    art.className = 'art' + (got ? '' : ' empty'); art.innerHTML = `<span>${d.icon}</span>`;
    $('jName').textContent = got ? d.name : '??? Undiscovered';
    const tm = got ? got.team || d.team : d.team, em = i => i === 'any' ? '🐾' : SPECIES[i].emoji, nm = i => i === 'any' ? 'Any animal' : SPECIES[i].name;
    jt.textContent = got ? 'Teamwork: ' + tm.map(i => em(i) + ' ' + nm(i)).join(' + ') : 'Team needed: ' + (tm[0] === 'any' ? '🐾 any two animals' : tm.map(em).join(' ')) + (d.night ? '  🌙 night only' : '');
    $('jFact').textContent = got ? d.fact : ''; $('jHint').textContent = got ? '' : '💡 ' + d.hint;
    $('jGuide').style.display = got ? 'none' : ''; $('jGuide').onclick = () => { guide = pz; closeJournal(); toast('📍 Follow the arrow to the ' + d.name, 3000); };
  } else if (jTab === 1) {
    const sp = d.sp, id = d.id.slice(2), n = nests[id], ab = ABILITIES[id] || [];
    art.className = 'art' + (got ? '' : ' empty'); art.innerHTML = `<span>${sp.emoji}</span>`;
    $('jName').textContent = got ? sp.name : '??? Not met yet';
    jt.textContent = got ? `${sp.nest.emoji} ${sp.nest.name}: ${sp.nest.stages[n.stage]} · ${ab.filter((_, i) => i < n.stage).length}/${ab.length} abilities` + (sp.nocturnal ? ' · 🌙 night' : '') : '';
    $('jFact').textContent = got ? ANIMAL_FACTS[id] + (ab.length ? '\n' + ab.map((a, i) => (i < n.stage ? a.icon + ' ' + a.name : '🔒 ???')).join('  ·  ') : '') + '\n🛠️ ' + gearLine(id, true) : '';
    $('jHint').textContent = '💡 Pick this animal from the tray (or press ' + (SPECIES_ORDER.indexOf(id) + 1) % 10 + ') to meet it.';
  } else {
    art.className = 'art' + (got ? '' : ' empty'); art.innerHTML = `<span>${d.icon}</span>`;
    $('jName').textContent = got ? d.name : '??? Not witnessed yet'; jt.textContent = '';
    $('jFact').textContent = got ? d.fact : ''; $('jHint').textContent = '💡 ' + d.hint;
  }
  $('jFact').style.whiteSpace = 'pre-line';
  const tc = [specialFound(), SPECIES_ORDER.filter(i => save.journal['a:' + i]).length, MOMENTS.filter(m => save.journal['m:' + m.id]).length];
  $('jCount').textContent = tc[jTab] + ' / ' + list.length + ' found';
  document.querySelectorAll('#jTabs button').forEach(b => { b.classList.toggle('act', +b.dataset.t === jTab); b.querySelector('small').textContent = tc[+b.dataset.t] + '/' + JTABS[+b.dataset.t]().length; });
  $('jDots').innerHTML = list.map((s, i) => `<i class="${save.journal[s.id] ? 'f' : ''} ${i === jPage ? 'c' : ''}" data-i="${i}"></i>`).join('');
  $('jDots').querySelectorAll('i').forEach(e => e.onclick = () => { jPages[jTab] = +e.dataset.i; renderJournal(true); });
  $('jPrev').disabled = jPage === 0; $('jNext').disabled = jPage === list.length - 1;
  const pg = $('jPg'); pg.classList.remove('flip'); void pg.offsetWidth; pg.classList.add('flip');
}
document.querySelectorAll('#jTabs button').forEach(b => b.onclick = () => { jTab = +b.dataset.t; renderJournal(true); });
$('bJournal').onclick = () => playing && openJournal();
$('jClose').onclick = closeJournal; $('jPrev').onclick = () => { jPages[jTab] = Math.max(0, jPages[jTab] - 1); renderJournal(true); }; $('jNext').onclick = () => { jPages[jTab] = Math.min(JTABS[jTab]().length - 1, jPages[jTab] + 1); renderJournal(true); };
input.hooks.journal = () => playing && !shopOpen && ($('journal').classList.contains('on') ? closeJournal() : openJournal());
input.hooks.esc = () => {
  const on = id => $(id).classList.contains('on');
  if (shopOpen) closeShop(); else if (on('confirm')) closeOv('confirm'); else if (on('journal')) closeJournal(); else if (on('settings')) closeOv('settings'); else if (on('how')) closeOv('how'); else if (on('credits')) closeOv('credits'); else if (on('menu')) closeMenu();
  else if (on('results')) return; else if (build && build.active) setBuild(false); else if (on('pause')) closeOv('pause'); else if (playing && !paused) openPause();
};
function updateTip(dt, t) {
  tipMute -= dt; const tip = $('coopTip'); let sg = null;
  if (tipMute <= 0 && !guide) sg = coop.suggestion(cur);
  const key = sg ? sg.puzzle.def.id + '|' + sg.text + '|' + (sg.need || '') : '';
  if (key !== tipKey) { tipKey = key; tipNeed = sg && sg.need; if (sg) tip.innerHTML = `${sg.text}${sg.need ? `<u>Tap to switch to ${SPECIES[sg.need].emoji} ${SPECIES[sg.need].name}</u>` : ''}`; }
  tip.classList.toggle('on', !!sg);
}
$('coopTip').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (tipNeed && SPECIES[tipNeed] && swapOK()) selectSpecies(tipNeed); else tipMute = 25; $('coopTip').classList.remove('on'); tipKey = ''; });
// ---------- music mood ----------
let moodOver = null, moodOverT = 0, inZone = false, resultsAt = 0, lastTick = 0;
function updateMusic(t) {
  let m = 'title';
  if (playing && !$('menu').classList.contains('on') && !$('results').classList.contains('on')) {
    if (moodOver && t < moodOverT) m = moodOver;
    else {
      moodOver = null; let near = 1e9; const p = P[cur];
      for (const z of coop.puzzles) if (!z.done) near = Math.min(near, Math.hypot(z.hintPos.x - p.x, z.hintPos.z - p.z));
      inZone = inZone ? near < 40 : near < 26;
      m = night > 0.5 ? 'night' : inZone ? 'puzzle' : SEASONS[clock.season];
    }
    if (round.running && !round.free && round.left <= 60) m = 'final'; // faster, higher take of the day song for the last minute
    if (round.running && !round.free) { const sec = Math.ceil(round.left); if (sec !== lastTick && sec >= 1 && sec <= 10) audio.sample(sec <= 3 ? 'round/countdown-final-tick' : 'round/countdown-tick', 0.45); lastTick = sec; }
  } else if ($('results').classList.contains('on')) m = performance.now() - resultsAt < 7600 ? 'hush' : 'results'; // win theme plays first
  audio.music.mood(m);
}
addEventListener('pointerdown', () => audio.start(), { once: true });

// ---------- platformer controller ----------
const tmpV = new THREE.Vector3();
const WORLD_LIM = WORLD_R - 6;
let msgT = 0;
function lightNear(p) {
  let best = null, bd = 1e9;
  for (const pz of coop.puzzles) { if (pz.done || !pz.prize || !pz.prizeG.visible) continue; const d = Math.hypot(pz.prize.x - p.x, pz.prize.z - p.z); if (d < bd) { bd = d; best = pz; } }
  return best && bd < 24 ? { x: best.prize.x, z: best.prize.z, d: bd } : null;
}
function placeShadow(id, p, sp) {
  const phys = world.phys, sf = phys.floor(p.x, p.z, p.y + 0.05, 0.05), alt = Math.max(0, p.y - sf.y), rad = (0.28 * sp.size + 0.25) * Math.max(0.55, 1 - alt * 0.045), sh = shadows[id];
  sh.position.set(p.x, sf.y + 0.07, p.z); sh.scale.setScalar(rad); sh.material.opacity = Math.max(0.28, 0.62 - alt * 0.03); p.floorY = sf.y;
}
function wingAmp(R, p, dt, k) {
  // Bat: honour Flying clip_alias time scales (idle 1.0 / jump-flap 1.4 / excited 1.6).
  if (R.userData.mixer && R.userData.flyAct) {
    const want = k >= 0.85 ? 1.4 : k >= 0.35 ? 1.0 : 0.55;
    const act = R.userData.flyAct;
    act.timeScale += (want - act.timeScale) * Math.min(1, dt * 6);
    R.userData.mixer.update(dt);
    return;
  }
  // Birds use dedicated wing meshes (animateBirdWings) — do not drive vertex body-flap.
  if (R.userData.birdWings) return;
  for (const m of R.userData.flapMats || []) m.userData.uAmp.value += (k * m.userData.baseAmp - m.userData.uAmp.value) * Math.min(1, dt * 10);
}
function stepPlayer(dt, t) {
  const sp = SPECIES[cur], AB = abOf(cur), mv = adm.speed === 1 ? AB.mv : speedMv(AB.mv), p = P[cur], c = input.poll(), phys = world.phys, fly = mv.fly, col = sp.coll || { h: 1.4, r: 0.8 };
  p.t += dt;
  if (build && build.active) { state.bmStick = { sx: c.sx, sy: c.sy }; c.sx = c.sy = 0; c.jump = false; input.jumpPressed = false; }
  if (playing) { if (adm.stam) p.stam = 1; if (adm.fly && input.jump) { p.vy = Math.max(p.vy, 9); p.grounded = false; p.coyote = 0; } }
  // --- intent (camera relative)
  const mag = Math.min(1, Math.hypot(c.sx, c.sy)), fyw = cam.yaw;
  const wx = (Math.sin(fyw) * c.sy - Math.cos(fyw) * c.sx), wz = (Math.cos(fyw) * c.sy + Math.sin(fyw) * c.sx), wl = Math.hypot(wx, wz) || 1;
  // --- action button (puzzle interaction first, then the species' own ability)
  let pressed = false;
  if (input.actPressed && build && build.active) { input.actPressed = false; if (build.placeGhost()) setBuild(false); }
  else if (input.actPressed) {
    input.actPressed = false; pressed = true;
    // Rival tidy-up taps only while a dismantle is already underway (start it from Interact wheel)
    if (playing && tiers && tiers.act(t)) { }
    else if (playing && rivals && rivals.dismantle) { rivals.tapDismantle(); }
    else if (playing && coop.onAction(p, sp, cur, t)) { if (sp.ground) { p.digT = 0.45; p.digCd = 0.35 * AB.fx.digCd; } }
    else if (sp.ground) { if (p.digCd <= 0) { p.digT = 0.45; p.digCd = 0.35 * AB.fx.digCd; gather(p, sp, t, AB.dig, true); } }
    else if (p.boostCd <= 0) { p.boostT = 0.6; p.boostCd = 3.1 * AB.fx.boostCd; audio.blip(3); fx.burst(p.x, p.y + 0.8, p.z, 8, 3); if (AB.fx.buzz) { fx.burst(p.x, p.y + 0.5, p.z, 26, 7); gather(p, sp, t, AB.reach * 2.6, false); } }
  }
  p.boostCd = Math.max(0, p.boostCd - dt); p.digCd = Math.max(0, p.digCd - dt); p.digT = Math.max(0, p.digT - dt); p.boostT = Math.max(0, p.boostT - dt);
  $('bAct').classList.toggle('cd', (sp.ground ? p.digCd : p.boostCd) > 0);
  // --- jumping
  if (p.grounded) { p.coyote = 0.12; p.jumpsLeft = mv.jumps - 1; p.airT = 0; } else { p.coyote -= dt; p.airT += dt; }
  if (input.jumpPressed) { input.jumpPressed = false; p.buf = 0.14; }
  p.buf -= dt;
  if (p.buf > 0) {
    if (p.coyote > 0) { p.vy = mv.jump; p.coyote = 0; p.buf = 0; p.grounded = false; p.jumpsLeft = mv.jumps - 1; p.flapArmed = false; p.jumpUp = true; audio.blip(2); }
    else if (p.jumpsLeft > 0) { p.vy = mv.jump2 || mv.jump * 0.9; p.jumpsLeft--; p.buf = 0; p.flapArmed = false; p.jumpUp = true; audio.blip(4); fx.burst(p.x, p.y + 0.3, p.z, 8, 3); }
    else if (fly) { p.flapArmed = true; p.buf = 0; }
  }
  if (!c.jump) p.flapArmed = true;
  if (p.grounded || (!c.jump && p.stam > 0.2)) p.tired = false;
  let flapping = !!fly && !p.tired && c.jump && !p.grounded && p.jumpsLeft <= 0 && (p.flapArmed || p.vy < 0) && p.stam > 0 && p.airT > 0.1;
  if (fly && sp.id === 'hummingbird' && !p.grounded && !p.tired && p.stam > 0.04 && p.airT > 0.1 && (pressed || (p.fl && p.fl.burst > 0))) flapping = true; // the dart works even without holding Jump
  if (flapping) p.flapArmed = true;
  p.flapping = flapping;
  // --- horizontal
  const stam0 = p.stam;
  const fo = fly ? flightStep(p, sp, mv, { flapping, press: pressed, mag, dx: wx / wl, dz: wz / wl, dt, t, light: sp.id === 'moth' && !p.grounded ? lightNear(p) : null, boost: (p.boostT > 0 ? 1.7 * AB.fx.boost : 1) * (tiers ? tiers.speedMul : 1) }) : null;
  if (tiers && tiers.noDrain && p.stam < stam0) p.stam = stam0;
  if (fo && fo.glide) fo.glide *= AB.fx.sink;
  if (hazards && hazards.locked(t)) { p.vx *= Math.exp(-8 * dt); p.vz *= Math.exp(-8 * dt); p.speed = Math.hypot(p.vx, p.vz); }
  else if (!(fo && fo.h)) {
    let maxS = mv.run * (p.boostT > 0 ? 1.7 * AB.fx.boost : 1) * (tiers ? tiers.speedMul : 1);
    if (hazards) maxS = hazards.modSpeed(maxS, t);
    const tx = mag > 0.05 ? (wx / wl) * mag * maxS : 0, tz = mag > 0.05 ? (wz / wl) * mag * maxS : 0;
    const acc = (p.grounded ? mv.accel : mv.accel * mv.air) * (p.boostT > 0 ? 1.5 : 1);
    const dx = tx - p.vx, dz = tz - p.vz, l = Math.hypot(dx, dz), st = acc * dt; if (l <= st || l < 1e-6) { p.vx = tx; p.vz = tz; } else { p.vx += dx / l * st; p.vz += dz / l * st; }
  }
  p.speed = Math.hypot(p.vx, p.vz);
  const wOx = p.x, wOz = p.z;
  p.x += p.vx * dt; p.z += p.vz * dt; if (onb && p.speed > 1) onb.flags.moved = 1;
  const rr = Math.hypot(p.x, p.z); if (rr > WORLD_LIM) { p.x *= WORLD_LIM / rr; p.z *= WORLD_LIM / rr; if (t - msgT > 4) { msgT = t; toast('🌲 The meadow edge — turn back, there is lots to find!', 2000); } }
  if (playing) coop.tryPush(p, sp, dt, t);
  phys.resolve(p, col.r, col.h, 0.55);
  // water is a solid edge for walkers on the ground: bump back (jump or fly over it instead)
  if (!fly && p.grounded && !inWater(wOx, wOz, col.r * 0.5) && inWater(p.x, p.z, col.r * 0.5)) { p.x = wOx; p.z = wOz; p.vx *= -0.35; p.vz *= -0.35; if (t - (p.wBumpT || 0) > 1.2) { p.wBumpT = t; audio.blip(1); fx.burst(p.x, p.y + 0.3, p.z, 6, 2); if (t - msgT > 4) { msgT = t; toast('💧 Water! Jump over it', 1500); } } }
  if (!(fo && fo.lockYaw) && mag > 0.1 && p.speed > 0.6) { const want = Math.atan2(p.vx, p.vz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * (1 - Math.exp(-14 * dt)); }
  // --- vertical
  const wasG = p.grounded, oldY = p.y, vyBefore = p.vy;
  if (fo && fo.v) { if (flapping) { p.stam = Math.max(0, p.stam - fly.drain * fo.drain * dt); if (p.stam <= 0.001) p.tired = true; } }
  else if (!wasG) {
    let g = mv.grav; if (!c.jump && p.vy > 3 && p.jumpUp) g *= 2.2;
    p.vy = Math.max(-34, p.vy - g * dt);
    if (fo && fo.glide && p.vy < -fo.glide) p.vy = -fo.glide;
  }
  if (!flapping) p.stam = Math.min(1, p.stam + (wasG ? (fly ? fly.rech : 1) : 0.08) * dt);
  if (!wasG || p.vy > 0) p.y += p.vy * dt;
  const fl = phys.floor(p.x, p.z, oldY, 0.6); p.floorY = fl.y;
  if (p.vy <= 0 && (p.y <= fl.y || (wasG && p.y - fl.y <= 0.35))) {
    p.y = fl.y;
    if (fl.solid && fl.solid.bounce && vyBefore < -4 && !wasG) { p.vy = fl.solid.bounce; p.grounded = false; p.jumpsLeft = mv.jumps - 1; p.jumpUp = false; audio.blip(5); fx.burst(p.x, p.y + 0.2, p.z, 10, 4); }
    else { if (!wasG && vyBefore < -9) fx.burst(p.x, p.y + 0.1, p.z, 5, 2); p.vy = 0; p.grounded = true; p.jumpUp = false; }
  } else p.grounded = false;
  if (p.y < -2.5) p.y = fl.y;
  // --- rig
  const R = riders[cur], bodyG = R.userData;
  R.position.set(p.x, p.y, p.z); R.rotation.y = p.yaw;
  if (sp.ground) {
    animateGround(R, dt, t, Math.min(1, p.speed / mv.run), !p.grounded, flapping, p.digT > 0 ? Math.sin((1 - p.digT / 0.45) * Math.PI) : 0);
    if (sp.id === 'robin') wingAmp(R, p, dt, p.grounded ? 0.06 : flapping ? 1 : 0.35);
  } else {
    const tp = fo && fo.pitch != null ? fo.pitch : (flapping ? 0.2 : (p.grounded ? 0 : -0.1)), tr = fo ? fo.roll : 0, kk = Math.min(1, dt * (sp.id === 'bat' ? 12 : 8));
    R.rotation.x += (tp - R.rotation.x) * kk; R.rotation.z += (tr - R.rotation.z) * kk;
    // Birds: no whole-body bob — wings flap instead. Other flyers keep a tiny hover bob.
    const bird = isBird(sp.id);
    const bob = bird ? 0 : (p.grounded ? Math.abs(Math.sin(p.t * 9)) * 0.08 * Math.min(1, p.speed / mv.run) : Math.sin(p.t * 5.5) * 0.04);
    bodyG.body.position.y = -(bodyG.box ? bodyG.box.min.y : 0) + bob;
    if (bodyG.birdWings) animateBirdWings(R, t, { air: !p.grounded, flapping, grounded: !!p.grounded });
    wingAmp(R, p, dt, p.grounded ? 0.16 : flapping ? 1 : (sp.id === 'bat' ? 0.1 : 0.3));
  }
  placeShadow(cur, p, sp); updateRing(p, sp, t, dt); updateStamRing(p, sp, t, dt);
  if (playing) { gather(p, sp, t, AB.reach, false); nestCheck(p, sp, t); dewCheck(p, sp, t); }
  $('stam').style.width = (p.stam * 100) + '%';
}
// Animals you are not controlling stay exactly where you left them: they settle onto the ground and idle.
function stepParked(id, dt, t) {
  const sp = SPECIES[id], mv = sp.mv, p = P[id], phys = world.phys, col = sp.coll || { h: 1.4, r: 0.8 }, R = riders[id], U = R.userData;
  p.t += dt; p.vx = p.vz = 0; p.speed = 0; p.flapping = false; p.boostT = 0; p.digT = 0;
  const fs = !p.goto && playing && !paused ? followSlot(id) : null;
  if (fs) { const L = P[cur]; let wob = Math.sin(p.t * 0.7 + id.length) * 0.9;
    const tx = L.x - Math.sin(L.yaw) * fs.back + Math.cos(L.yaw) * (fs.side * 2.4 + wob), tz = L.z - Math.cos(L.yaw) * fs.back - Math.sin(L.yaw) * (fs.side * 2.4 + wob);
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), dl = Math.hypot(L.x - p.x, L.z - p.z);
    if (dl > 45) placeFollowers(true);
    else if (d > 1.2 && (dl > 3.4 || d > 3)) { const sp2 = Math.min(mv.run * (d > 10 ? 1.25 : 0.85), d * 3); const v = Math.min(d, sp2 * dt); p.x += dx / d * v; p.z += dz / d * v; p.yaw = Math.atan2(dx, dz); p.speed = sp2; }
    else { p.yaw += (Math.atan2(Math.sin(L.yaw - p.yaw), Math.cos(L.yaw - p.yaw))) * Math.min(1, dt * 2); }
    if (mv.fly) { const gy = heightAt(p.x, p.z), ty = Math.max(gy, L.y + (L.grounded ? 0 : 0.6)); if (ty > gy + 0.3 || !p.grounded) { p.y += (ty - p.y) * Math.min(1, dt * 3); p.vy = 0; p.grounded = false; } }
    else {
      // Walkers: at most one normal jump. If the player is above what a normal jump can reach, wait at the bottom (no infinite hop).
      const jump = mv.jump || 10, grav = mv.grav || 28;
      const apex = (jump * jump) / (2 * grav) + (mv.jumps > 1 ? ((mv.jump2 || jump * 0.9) ** 2) / (2 * grav) : 0);
      const need = L.y - p.y;
      if (p.grounded && need > 0.7 && need <= apex + 0.5 && dl < 8) { p.vy = jump; p.grounded = false; }
      else if (p.grounded && need <= apex + 0.5 && inWater(p.x + Math.sin(p.yaw) * 1.2, p.z + Math.cos(p.yaw) * 1.2, 0)) { p.vy = jump; p.grounded = false; }
      // else: cliff / water too tall — wait at the bottom
    }
  }
  if (p.goto && playing && !paused) { const dx = p.goto.x - p.x, dz = p.goto.z - p.z, d = Math.hypot(dx, dz); if (d < 1) p.goto = null; else { const v = Math.min(d, mv.run * 0.7 * dt); p.x += dx / d * v; p.z += dz / d * v; p.yaw = Math.atan2(dx, dz); p.speed = mv.run * 0.7; } }
  const wasG = p.grounded, oldY = p.y;
  if (!wasG) { p.vy = Math.max(sp.mv.fly ? -6 : -30, p.vy - mv.grav * dt); p.y += p.vy * dt; }
  phys.resolve(p, col.r, col.h, 0.55);
  const fl = phys.floor(p.x, p.z, oldY, 0.6);
  if (p.vy <= 0 && (p.y <= fl.y || (wasG && p.y - fl.y <= 0.35))) { p.y = fl.y; p.vy = 0; p.grounded = true; } else p.grounded = false;
  if (p.y < -2.5) p.y = fl.y;
  p.stam = Math.min(1, p.stam + (p.grounded ? 0.5 : 0.08) * dt);
  R.position.set(p.x, p.y, p.z); R.rotation.y = p.yaw;
  if (sp.ground) {
    animateGround(R, dt, t, p.speed ? 0.7 : 0, !p.grounded, false, 0);
    if (sp.id === 'robin') wingAmp(R, p, dt, p.grounded ? 0.04 : 0.7);
  } else { const kk = Math.min(1, dt * 8); R.rotation.x += (0 - R.rotation.x) * kk; R.rotation.z += (0 - R.rotation.z) * kk; const bird = isBird(id); U.body.position.y = -(U.box ? U.box.min.y : 0) + (bird ? 0 : (p.grounded ? Math.sin(t * 1.7 + id.length) * 0.015 : 0)); if (U.birdWings) animateBirdWings(R, t, { air: !p.grounded, flapping: !p.grounded, grounded: !!p.grounded }); wingAmp(R, p, dt, p.grounded ? 0.12 : 0.8); }
  placeShadow(id, p, sp);
  const m = marks[id]; m.visible = playing; m.position.set(p.x, p.y + sp.size * 0.9 + 2.4 + Math.sin(t * 2 + p.x) * 0.12, p.z);
}

function gather(p, sp, t, reach, dig, extra) {
  if (tiers && tiers.carrying && !extra) return;
  const B = world.blooms, bit = 1 << POLS.indexOf(polOf(cur)), AB = abOf(cur); let got = 0, sawFull = false, near = 0; if (AB.autodig) dig = true;
  const cy = sp.ground ? p.y : p.y + 0.9;
  B.query(p.x, p.z, reach + 3, i => {
    if (!(B.mask[i] & bit) || B.readyAt[i] > t) return;
    const fd = B.isFood(i) ? B.foodAt(i) : null;
    if (fd && fd.buried && !dig) return;
    const dx = B.x[i] - p.x, dz = B.z[i] - p.z, dy = B.y[i] - cy;
    if (sp.ground) { if (dx * dx + dz * dz > reach * reach || dy > 3 || dy < -2.2) return; }
    else { const rr = reach + B.r[i]; if (dx * dx + dy * dy + dz * dz > rr * rr) return; if (p.speed > sp.maxSlow && sp.maxSlow && !AB.hover) { if (t - msgT > 2.5) { msgT = t; toast('🐦 Slow down to sip from the flower', 1500); } return; } }
    near++;
    if (p.carried >= abOf(cur).cap) { sawFull = true; return; }
    const val = (fd ? fd.val : (sp.yield || 1)) + AB.pick;
    p.carried = Math.min(abOf(cur).cap, p.carried + val); got++;
    B.readyAt[i] = t + 45 / adm.respawn; world.sparkle.set(i, false); if (fd) world.food.take(i, t);
    fx.burst(B.x[i], B.y[i], B.z[i], 10, 3.5); audio.blip(p.carried); if (onb) onb.note('gathered');
  });
  if (got && tiers && !extra) { const ex = tiers.onPick(got, t); if (ex > 0) round.addRes('p', ex); }
  if (got) { updateHud(); if (p.carried >= abOf(cur).cap) { if (onb) onb.flags.full = 1; if (t - msgT > 0.5) { msgT = t; toast(`${sp.emoji} Full! Head home to your ${sp.nest.name}`, 2600); } } }
  else if (sawFull && t - msgT > 4) { msgT = t; toast(`${sp.emoji} Full! Head home to your ${sp.nest.name}`, 2200); }
  else if (dig && !near && t - msgT > 1.2) { msgT = t; toast('🔎 Nothing buried here — follow the sparkles', 1600); }
}
function nestCheck(p, sp, t, force) {
  const n = nests[cur]; const d = Math.hypot(p.x - n.x, p.z - n.z);
  if ((force || (d < 9 && p.y < n.y + 30)) && p.carried > 0) {
    const amt = p.carried, was = n.stage; p.carried = 0; save.gear[cur].bank += amt; const up = n.set(n.units + amt, true); save.units[cur] = n.units; persist();
    round.addRes('p', amt); if (tiers) tiers.onPick && 0; round.add('gather', amt * 5 * (1 + 0.12 * build.storageCount()) * abOf(cur).pts); bonusRes(cur, amt); round.stats.units += amt; if (round.elapsed < 60) round.stats.quickStart = 1; if (onb) { onb.note('delivered'); onb.flags.full = 0; } if (items) items.onDeliver(); round.flash(RES_OF[cur]); if (up >= 0) build.refreshHomes();
    const grown = meadow.setUnits(cur, n.units, true); if (grown) fx.burst(n.x, n.y + 2, n.z, 10 + grown, 6);
    if (up >= 0) { meadow.setStage(cur, n.stage); abCache[cur] = null; }
    const gained = up >= 0 ? (ABILITIES[cur] || []).slice(was, up) : []; fx.burst(n.x, n.y + 4, n.z, 30, 7); up >= 0 ? audio.music.jingle('stage') : audio.chime(); voice(cur, 0.3, 8); if (gained.length) audio.sample('ui2/control-unlock-tada', 0.45); updateHud();
        toast(up >= 0 ? `🎉 ${sp.nest.stages[up]} unlocked!` + gained.map(a => `\n${a.icon} New ability: ${a.name} — ${a.desc}`).join('') : `${sp.nest.emoji} +${amt} ${sp.pickName} deposited · 🌼 the meadow blooms`, up >= 0 ? 5200 : 1900);
    if (up >= 0) { fx.burst(n.x, n.y + 8, n.z, 50, 10); babies.sync(); if (babies.list.length) journalUnlock('m:baby', 'Little Ones'); }
    babies.love(cur);
  }
}
/** species by-product (lead flavour) + tech conversions: e.g. bees make a little honey, bears bring wood */
const convAcc = {};
function bonusRes(id, amt) {
  const L = [...(abOf(id).conv || [])]; const by = ARCH[id]?.by; if (by) L.push(by); const got = [];
  L.forEach((c, i) => { const key = id + i + c.k; convAcc[key] = (convAcc[key] || 0) + amt; const n = Math.floor(convAcc[key] / c.per); if (n > 0) { convAcc[key] -= n * c.per; round.addRes(c.k, n); got.push(`+${n}${RES_ICON[c.k] || '🌼'}`); } });
  return got;
}
function dewCheck(p, sp, t) {
  for (const d of world.platforms.dewdrops) {
    if (d.got) continue; if (Math.abs(p.x - d.x) > 1.8 || Math.abs(p.z - d.z) > 1.8 || Math.abs(p.y + 0.9 - d.y) > 2.2) continue;
    d.got = true; round.add('explore', 20); round.stats.dew++; save.dew.push(d.id); persist(); p.carried = Math.min(abOf(cur).cap, p.carried + 3);
    fx.burst(d.x, d.y, d.z, 40, 8); audio.sample('round/golden-dewdrop', 0.55); updateHud(); toast(`✨ Golden dewdrop! ${save.dew.length} / ${world.platforms.count}`, 2400);
  }
}

// ---------- camera: behind and above, like a 3D platformer ----------
const bmF = { x: 0, z: 0, y: 0, floorY: 0, speed: 0, yaw: 0, on: false };
function bmFocus(dt) {
  const p = P[cur]; if (!bmF.on) { bmF.on = true; bmF.x = p.x; bmF.z = p.z; }
  const s = state.bmStick || { sx: 0, sy: 0 }, yw = cam.yaw, v = 24 * dt;
  bmF.x += (Math.sin(yw) * s.sy - Math.cos(yw) * s.sx) * v; bmF.z += (Math.cos(yw) * s.sy + Math.sin(yw) * s.sx) * v;
  const r = Math.hypot(bmF.x, bmF.z); if (r > WORLD_LIM) { bmF.x *= WORLD_LIM / r; bmF.z *= WORLD_LIM / r; }
  bmF.y = bmF.floorY = Math.max(heightAt(bmF.x, bmF.z), -1.6); bmF.yaw = cam.yaw; return bmF;
}
function updateCamera(dt) {
  const p = playing ? (build && build.active ? bmFocus(dt) : P[cur]) : titleTarget(dt), sp = SPECIES[cur], now = performance.now(), bm = !!(build && build.active);
  cam.yaw += input.dYaw; cam.pitch = Math.max(0.1, Math.min(0.95, cam.pitch + input.dPitch)); input.dYaw = input.dPitch = 0;
  const idle = !input.orbiting && now - input.lastOrbit > 1200;
  if (!playing) { cam.yaw += dt * 0.12; cam.zoomT = 3.4; cam.pitch += (0.5 - cam.pitch) * Math.min(1, dt); }
  else if (idle && p.speed > 1) { let d = p.yaw - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 2.2) cam.yaw += d * 1.4 * (1 - Math.abs(d) / 2.3) * dt; }
  if (playing && !input.orbiting && now - input.lastOrbit > (bm ? 1200 : 2500)) cam.pitch += ((bm ? 0.8 : 0.35) - cam.pitch) * Math.min(1, dt * (bm ? 2.5 : 0.8));
  const sw = cam.swoop > 0; if (sw) cam.swoop -= dt; const k = 1 - Math.exp(-(!playing ? 0.7 : sw ? 3.5 : 12) * dt); cam.fx += (p.x - cam.fx) * k; cam.fz += (p.z - cam.fz) * k;
  const floorY = p.floorY ?? p.y, tgtY = Math.max(floorY, p.y - 4.5); cam.fy += (tgtY - cam.fy) * (1 - Math.exp(-(!playing ? 0.7 : sw ? 3 : 5) * dt));
  cam.zoom += ((cam.zoomT ?? 1) * (bm ? 1.9 : 1) - cam.zoom) * Math.min(1, dt * 4); const dist = (8 + sp.size * 1.2) * cam.zoom, cp = Math.cos(cam.pitch), spn = Math.sin(cam.pitch);
  const focusY = cam.fy + 0.9 + sp.size * 0.25 + Math.max(0, p.y - cam.fy) * 0.5;
  let cx = cam.fx - Math.sin(cam.yaw) * dist * cp, cz = cam.fz - Math.cos(cam.yaw) * dist * cp, cy = focusY + dist * spn;
  cy = Math.max(cy, heightAt(cx, cz) + 1.2);
  cam.offX += (cam.offXT - cam.offX) * Math.min(1, dt * 4); cam.offY += (cam.offYT - cam.offY) * Math.min(1, dt * 4);
  const ox = -Math.cos(cam.yaw) * cam.offX * dist, oz = Math.sin(cam.yaw) * cam.offX * dist, oy = cam.offY * dist; cx += ox; cz += oz; cy += oy;
  { // occlusion pull-in (playtest-01 H2: was shop-only): pull the camera in front of rocks / stumps / logs / decor and tree canopies
    // between it and the focus, in play, build mode, the shop and the title orbit.
    const fx = cam.fx + ox, fy = focusY + oy, fz = cam.fz + oz; let want = 1;
    if (world?.phys) {
      const segR = Math.hypot(cx - fx, cz - fz), CN = [];
      for (const c of world.canopies || []) { const dx = c.x - fx, dz = c.z - fz; if (dx * dx + dz * dz < (segR + c.r + 1) ** 2 && Math.hypot(dx, dz) > c.r * 0.7 + 0.3) CN.push(c); }
      for (let i = 1; i <= 14 && want === 1; i++) {
        const u = i / 14, x = fx + (cx - fx) * u, y = fy + (cy - fy) * u, z = fz + (cz - fz) * u;
        for (const c of CN) if (y > c.y0 && y < c.y1 && (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) { want = Math.max(0.3, u - 0.12); break; }
        if (want < 1) break;
        world.phys.near(x, z, (so) => {
          if (want < 1 || so.wall === false && so.kind === 'trunk') return;
          const f = world.phys.foot(so, x, z); if (f.d > 0.9 || y > so.top + 0.5 || y < so.y0) return;
          const f0 = world.phys.foot(so, fx, fz); if (f0.d < 0.4) return; // the focus is on/in it: ignore
          want = Math.max(0.3, u - 0.12);
        });
      }
    }
    cam.occ = want;
    cam.shopK = cam.shopK ?? 1; cam.shopK += (want - cam.shopK) * Math.min(1, dt * (want < cam.shopK ? 12 : 2.5));
    if (cam.shopK < 0.999) { cx = fx + (cx - fx) * cam.shopK; cy = fy + (cy - fy) * cam.shopK; cz = fz + (cz - fz) * cam.shopK; cy = Math.max(cy, heightAt(cx, cz) + 0.9); }
  }
  camera.position.set(cx, cy, cz); tmpV.set(cam.fx + ox, focusY + oy, cam.fz + oz); camera.lookAt(tmpV);
  const baseFov = innerWidth / innerHeight < 1 ? 70 : 62; const wantFov = baseFov + (p.boostT > 0 ? 6 : 0); cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 4); if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); world.resize(innerHeight * PR, camera.fov); }
}

// ---------- compass arrow ----------
let arrowT = 0, nearestBloom = -1;
function updateArrow(dt, t) {
  const sp = SPECIES[cur], p = P[cur], n = nests[cur]; arrowT -= dt;
  const toNest = p.carried >= Math.max(2, abOf(cur).cap * 0.6);
  if (arrowT <= 0) { arrowT = 0.5; const B = world.blooms; let best = -1, bd = 1e12; for (const i of B.byPol[polOf(cur)]) { if (B.readyAt[i] > t) continue; const d = (B.x[i] - p.x) ** 2 + (B.z[i] - p.z) ** 2; if (d < bd) { bd = d; best = i; } } nearestBloom = best; }
  let tx, tz, label, show = true;
  if (toNest || (p.carried > 0 && nearestBloom < 0)) { tx = n.x; tz = n.z; label = `${sp.nest.emoji} ${sp.nest.name}`; }
  else if (nearestBloom >= 0) { const B = world.blooms; tx = B.x[nearestBloom]; tz = B.z[nearestBloom]; label = sp.ground ? '✨ nearest food' : '✨ nearest flower'; if (Math.hypot(tx - p.x, tz - p.z) < 8) show = false; }
  else show = false;
  if (guide && guide.done) guide = null;
  if (guide) { tx = guide.hintPos.x; tz = guide.hintPos.z; const gd = Math.hypot(tx - p.x, tz - p.z); label = '📍 ' + guide.def.name; show = gd > 12; if (gd < 12 && t - (state.gT || 0) > 1) { /* arrived */ } }
  if (pingHomeT > 0) { pingHomeT -= dt; tx = n.x; tz = n.z; show = Math.hypot(tx - p.x, tz - p.z) > 6; }
  if (!homeInd) homeInd = createHomeInd(scene);
  { const far = Math.hypot(tx - p.x, tz - p.z) || 0, col = guide ? '#7ff7e8' : (toNest || pingHomeT > 0) ? '#' + new THREE.Color(sp.nest.color).getHexString() : '#ffd23f';
    homeInd.update({ x: p.x, y: p.floorY ?? p.y, z: p.z, R: ringR, ang: Math.atan2((tx ?? p.x) - p.x, (tz ?? p.z) - p.z), show: show && !rts.on && !(build && build.active), color: col, mode: settings.ind || 'ring', t, dt, far }); }
  const A = $('arrowA'); A.style.opacity = show ? 1 : 0; $('arrowL').textContent = show ? `${label} · ${Math.round(Math.hypot(tx - p.x, tz - p.z))}m` : '';
  if (show) { const want = Math.atan2(tx - p.x, tz - p.z); const rel = want - cam.yaw; A.style.transform = `rotate(${-rel * 57.3}deg)`; }
  A.firstElementChild.querySelector('path').setAttribute('fill', guide ? '#7ff7e8' : toNest ? '#' + new THREE.Color(sp.nest.color).getHexString() : '#ffd23f');
}

// ---------- day/night ----------
function updateNight(dt) {
  const cdt = (!playing || paused) ? 0 : dt;
  const sp = SPECIES[cur], nF = nightOf(clock.t);
  // the clock hurries past the hours this animal sleeps through, and lingers over the ones it loves
  clock.speed = sp.nocturnal ? (nF < 0.5 ? 3 : 0.55) : (nF > 0.5 ? 3 : 1);
  if (state.freeze) clock.speed = 0;
  const season0 = clock.season; clock.update(cdt); if (clock.season !== season0) onSeasonChange();
  syncNightFlag();
  night += (nightOf(clock.t) - night) * (1 - Math.exp(-3 * (state.nightInit ? dt : 1))); if (Math.abs(night - nightOf(clock.t)) < 0.002) night = nightOf(clock.t);
  const n = night, w = clock.weights(SW), warm = warmOf(clock.t) * (1 - n * 0.6);
  const mist = weather ? weather.v.mist : 0, rain = weather ? weather.v.rain : 0, snow = weather ? weather.v.snow : 0, grey = Math.max(rain, snow * 0.6);
  // seasons -> shared shader uniforms
  SU.uAut.value = w[2]; SU.uWin.value = w[3]; SU.uSpr.value = w[0];
  SU.uSnowG.value = w[3] * LOOK.snowG[3]; SU.uSnowT.value = w[3] * LOOK.snowT[3];
  SU.uGT.value.set(0, 0, 0); SU.uGT2.value.set(0, 0, 0);
  for (let i = 0; i < 4; i++) { SU.uGT.value.x += LOOK.gt[i][0] * w[i]; SU.uGT.value.y += LOOK.gt[i][1] * w[i]; SU.uGT.value.z += LOOK.gt[i][2] * w[i]; SU.uGT2.value.x += LOOK.gt2[i][0] * w[i]; SU.uGT2.value.y += LOOK.gt2[i][1] * w[i]; SU.uGT2.value.z += LOOK.gt2[i][2] * w[i]; }
  let fogFar = 0, sunI = 0, hemiI = 0, bgI = 0, act = 0; tmpC.setRGB(0, 0, 0); tmpC2.setRGB(0, 0, 0);
  for (let i = 0; i < 4; i++) { fogFar += LOOK.fogFar[i] * w[i]; sunI += LOOK.sun[i] * w[i]; hemiI += LOOK.hemi[i] * w[i]; bgI += LOOK.bg[i] * w[i]; act += LOOK.activity[i] * w[i]; tmpC.r += LOOK.fog[i].r * w[i]; tmpC.g += LOOK.fog[i].g * w[i]; tmpC.b += LOOK.fog[i].b * w[i]; tmpC2.r += LOOK.sunCol[i].r * w[i]; tmpC2.g += LOOK.sunCol[i].g * w[i]; tmpC2.b += LOOK.sunCol[i].b * w[i]; }
  ACT.v = act;
  scene.backgroundBlurriness = 0;
  scene.backgroundIntensity = THREE.MathUtils.lerp(bgI, 0.06, n) * (1 - 0.3 * grey) * (1 - 0.15 * mist);
  scene.fog.color.copy(tmpC).lerp(NIGHTFOG, n).lerp(wxCol.setRGB(0.66, 0.72, 0.78).multiplyScalar(1 - 0.75 * n), 0.55 * grey).lerp(wxCol.setRGB(0.86, 0.9, 0.93).multiplyScalar(1 - 0.8 * n), 0.5 * mist);
  scene.fog.color.lerp(wxCol.setRGB(1, 0.62, 0.38), 0.22 * warm);
  scene.fog.near = (70 - 25 * n) * (1 - 0.7 * mist - 0.25 * grey); scene.fog.far = (300 - 90 * n) * fogFar * (1 - 0.65 * mist - 0.35 * grey);
  hemi.intensity = THREE.MathUtils.lerp(hemiI, 1.05, n) * (1 - 0.15 * grey); hemi.color.set(0xcfe8ff).lerp(wxCol.set(0x8fa4ff), n); hemi.groundColor.set(0x6a8a4a).lerp(wxCol.set(0x2a3a5a), n);
  sun.intensity = THREE.MathUtils.lerp(2.4 * sunI, 0.9, n) * (1 - 0.5 * grey - 0.2 * mist); sun.color.copy(tmpC2).lerp(wxCol.set(0x9fb4ff), n).lerp(wxCol.set(0xffb070), 0.55 * warm);
  const ang = (clock.t - 0.25) * 6.2832; sun.position.set(Math.cos(ang) * 100, 28 + 92 * Math.max(0, Math.sin(ang)), 40);
  stars.material.opacity = n; stars.visible = n > 0.01; moon.visible = n > 0.01; moon.material.opacity = n;
  world.sparkle.mat.uniforms.uBoost.value = 1 + 0.35 * n;
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.0, 1.35, n);
  if (Math.abs(n - (state.lastN ?? -1)) > 0.004 || !state.nightInit) { state.lastN = n; world.sparkle.setSpecies(cur, performance.now() / 1000); }
  audio.night(n, Math.max(w[3] * 0.55, rain * 0.6, snow * 0.4)); audio.rain(rain);
  { const now = performance.now(); if (now - (state.creekT || 0) > 500 && P[cur]) { state.creekT = now; const p = P[cur]; let wd = 99; // nearest water within ~24 m -> creek bed level
    if (heightAt(p.x, p.z) < WATER_Y) wd = 0; else for (const r of [5, 11, 18, 24]) { for (let a = 0; a < 6.28 && wd > r; a += 0.785) if (heightAt(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r) < WATER_Y) wd = r; if (wd <= r) break; }
    audio.ambCtx(wd > 24 ? 0 : 1 - Math.max(0, wd - 4) / 22, clock.season === 3); } }
  state.nightInit = true;
}
function updateDrift() {
  const a = 0.04 + 0.9 * meadow.level() / meadow.maxLevel, s = clock.weights(SW); let m = 0; for (let i = 1; i < 4; i++) if (s[i] > s[m]) m = i;
  const k = THREE.MathUtils.smoothstep(s[m], 0.5, 0.95), rain = weather.v.rain, snow = weather.v.snow;
  if (snow > 0.05) { meadow.drift.set('snow', Math.min(1, 0.3 + 0.7 * snow) * Math.max(k, snow)); return; }
  if (m === 0) meadow.drift.set('petal', a * k * (1 - 0.85 * rain));
  else if (m === 1) meadow.drift.set('petal', a * 0.55 * k * (1 - 0.85 * rain));
  else if (m === 2) meadow.drift.set('leaf', (0.35 + 0.35 * a) * k * (1 - 0.8 * rain));
  else meadow.drift.set('snow', 0.28 * k);
}
function onSeasonChange() {
  const si = SEASON_INFO[clock.season]; $('bSeason').textContent = si.emoji + ' Season: ' + si.name;
  if (playing) { toast(`${si.emoji} ${si.name} · ${si.blurb}`, 3600); audio.chime(); }
  journalUnlock('m:s' + clock.season, si.name); persist();
}

// ---------- timed round, build mode, title / pause / results, admin ----------
const adm = { allowSwap: false, speed: 1, game: 1, fly: false, stam: false, grow: 1, respawn: 1, showFps: false, helperSpeed: 1, playerEdge: 0.2, rivalReact: true };
let round, terr, build, admin, simT = 1, dirty = false;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const BLOCK = ['pause', 'results', 'settings', 'how', 'confirm', 'credits', 'journal', 'menu'];
function syncPause() { const b = BLOCK.some(id => $(id).classList.contains('on')) || shopOpen; paused = !playing || b; input.active = playing && !b && !rts.on && !techOpen; }
const openOv = id => { $(id).classList.add('on'); syncPause(); };
const closeOv = id => { $(id).classList.remove('on'); syncPause(); };
let cfYes = null;
function confirmDlg(title, text, yes, fn) { $('cfT').textContent = title; $('cfP').textContent = text; $('cfYes').textContent = yes; cfYes = fn; openOv('confirm'); }
$('cfNo').onclick = () => closeOv('confirm'); $('cfYes').onclick = () => { const f = cfYes; cfYes = null; closeOv('confirm'); f && f(); };

// round length chips (title + settings)
function buildLens() {
  for (const id of ['lens', 'lens2']) {
    const c = $(id); c.querySelectorAll('button').forEach(b => b.remove());
    for (const m of LENGTHS) { const b = document.createElement('button'); b.textContent = m + ' min'; b.className = m === settings.len ? 'on' : ''; b.onclick = () => { settings.len = m; saveSettings(settings); buildLens(); refreshTitle(); }; c.appendChild(b); }
  }
}

// ---------- Valley · Crew · Neighbors ----------
let vSelPatch = null, vEditMode = false;
function openValleyMap() {
  audio.start();
  if (!valley) { toast('🌼 Valley still waking…', 1800); return; }
  closeOv('title'); closeOv('pick'); closeOv('pause'); closeOv('results'); closeOv('festival');
  document.body.classList.add('inValley');
  renderValleyMap();
  openOv('valley');
  audio.sample?.('valley/map-open', 0.45);
}
function closeValleyMap() {
  closeOv('valley'); document.body.classList.remove('inValley');
}
function renderValleyMap() {
  if (!valley || !crew) return;
  crew.loadFromValley();
  const wildN = valley.patches.filter(p => valley.get(p.id).state === 'wild').length;
  $('vSub').textContent = `${wildN}/8 wild · crew ${crew.get().map(id => SPECIES[id].emoji).join('')} · pick 🌿 Free roam or ⏱ Challenge for any open level`;
  paintValleyMap({
    getState: id => valley.get(id),
    selected: vSelPatch,
    onSelect: id => { vSelPatch = id; renderValleyMap(); },
    friendship: nid => valley.friendship(nid),
  });
  const crewBox = $('vCrew'); crewBox.innerHTML = '';
  for (const id of crew.get()) {
    const sp = SPECIES[id], sk = SKILLS[id];
    const el = document.createElement('div');
    el.className = 'vc on';
    el.innerHTML = `${sp.emoji} ${sp.name}<br><small>${sk ? sk.name : ''}</small>`;
    crewBox.appendChild(el);
  }
  const def = vSelPatch ? valley.def(vSelPatch) : null;
  const st = vSelPatch ? valley.get(vSelPatch) : null;
  const gate = def ? valley.canStart(def.id, crew.tags()) : { ok: false, why: 'Pick a patch' };
  const stars = def && def.neighbor && def.neighbor !== 'all'
    ? ' · ' + '★'.repeat(Math.floor(valley.friendship(def.neighbor))) + '☆'.repeat(3 - Math.floor(valley.friendship(def.neighbor)))
    : '';
  $('vDetail').textContent = def
    ? `${def.emoji} ${def.name} — ${def.blurb}${stars}${gate.ok ? '' : ' · 🔒 ' + gate.why}`
    : 'Pick a wilted patch to heal';
  const go = $('vGo'), fr = $('vFree'), cont = st && st.state !== 'wilted';
  go.disabled = !gate.ok; if (fr) fr.disabled = !gate.ok;
  go.textContent = (cont ? '⏱ Continue · ' : '⏱ ') + 'Challenge';
  if (fr) fr.textContent = (cont ? '🌿 Continue · ' : '🌿 ') + 'Free roam';
}
function openCrewTent(after) { openTeamPick(after || renderValleyMap); }
// ---- Team picker (crew of 3): in-game overlay, replaces browser prompt
let tpSel = [], tpAfter = null;
function teamUnlocked() { const u = crew ? crew.unlocked() : STARTER_CREW; return SPECIES_ORDER.filter(id => u.includes(id)); }
function openTeamPick(after) {
  if (!crew) return; crew.loadFromValley(); tpSel = crew.get(); tpAfter = after || null; renderTeamPick(); openOv('teamPick');
}
function renderTeamPick() {
  const un = new Set(teamUnlocked());
  $('tpSlots').innerHTML = [0, 1, 2].map(i => { const id = tpSel[i]; return id ? `<button class="tps on" data-r="${i}">${SPECIES[id].emoji}<small>${SPECIES[id].name}</small><i>✕</i></button>` : `<button class="tps" disabled>＋<small>slot ${i + 1}</small></button>`; }).join('');
  $('tpList').innerHTML = SPECIES_ORDER.map(id => { const sp = SPECIES[id], on = tpSel.includes(id), lk = !un.has(id), sk = SKILLS[id];
    return `<button class="tpc ${on ? 'on' : ''} ${lk ? 'lk' : ''}" data-s="${id}" ${lk ? 'disabled' : ''}><span>${lk ? '🔒' : sp.emoji}</span><b>${sp.name}</b><small>${isFlyer(id) ? '🪽 flyer' : '🐾 walker'}${id === 'robin' ? ' + walker' : ''}${sk ? ' · ' + sk.name : ''}</small></button>`; }).join('');
  const v = crewValid(tpSel);
  $('tpWhy').textContent = v.ok ? '✓ Great team! Tap a portrait in-level to swap instantly.' : (tpSel.length < 3 ? `Pick ${3 - tpSel.length} more · need a flyer and a walker` : v.why);
  $('tpWhy').classList.toggle('bad', !v.ok && tpSel.length === 3);
  $('tpGo').disabled = !v.ok;
}
$('tpList').addEventListener('click', e => { const c = e.target.closest('.tpc'); if (!c || c.disabled) return; const id = c.dataset.s; audio.blip(2);
  const i = tpSel.indexOf(id); if (i >= 0) tpSel.splice(i, 1); else if (tpSel.length < 3) tpSel.push(id); else { tpSel[2] = id; } renderTeamPick(); });
$('tpSlots').addEventListener('click', e => { const c = e.target.closest('.tps.on'); if (!c) return; tpSel.splice(+c.dataset.r, 1); audio.blip(1); renderTeamPick(); });
$('tpDef').onclick = () => { tpSel = [...STARTER_CREW]; renderTeamPick(); };
$('tpBack').onclick = () => closeOv('teamPick');
$('tpGo').onclick = () => {
  const r = crew.set(tpSel.slice());
  if (!r.ok) { toast('⛺ ' + r.why, 2600); return; }
  closeOv('teamPick'); audio.sample?.('ui/select-pop', 0.35);
  toast('🐾 Team ready: ' + crew.get().map(id => SPECIES[id].emoji).join(' '), 2200);
  if (playing && crew.get().length) {
    if (!crew.includes(cur)) { selectSpecies(crew.get()[0]); if (valleySession) lead = crew.get()[0]; }
    crew.active = Math.max(0, crew.get().indexOf(cur)); placeFollowers(true);
    if (valleySession) renderCrewDock();
  }
  const f = tpAfter; tpAfter = null; f && f();
};
// teammates (crew minus active) trail the active animal loosely
function followerIds() { if (!crew || !playing || rts.on) return []; return crew.get().filter(id => id !== cur && P[id]); }
function followSlot(id) { const f = followerIds(), k = f.indexOf(id); return k < 0 ? null : { side: k ? 1 : -1, back: 3.2 + k * 1.6 }; }
function placeFollowers(snap) { const L = P[cur]; if (!L) return; for (const id of followerIds()) { const s = followSlot(id), p = P[id]; const tx = L.x - Math.sin(L.yaw) * s.back + Math.cos(L.yaw) * s.side * 2.4, tz = L.z - Math.cos(L.yaw) * s.back - Math.sin(L.yaw) * s.side * 2.4; if (snap || Math.hypot(p.x - L.x, p.z - L.z) > 45) { p.x = tx; p.z = tz; p.y = Math.max(heightAt(tx, tz), L.y) + 0.5; p.vy = 0; p.grounded = false; p.goto = null; } } }
function startValleyPatch(patchId) {
  if (!valley || !crew) return;
  const gate = valley.canStart(patchId, crew.tags());
  if (!gate.ok) { toast('🔒 ' + gate.why, 2600); return; }
  const def = valley.def(patchId);
  valleySession = { patchId, neighbor: def.neighbor, contest: def.contest };
  valley.data.activePatch = patchId;
  {
    const st = valley.get(patchId);
    // UNLOCK_ALL_LEVELS: allow replaying a wild patch by resetting heal progress
    if (st && st.state === 'wild') { valley.setHeal(patchId, 0); valley.setState(patchId, 'in_progress'); st.contestDone = false; }
    else if (st && st.state === 'wilted') valley.setState(patchId, 'in_progress');
  }
  valley.save();
  crew.arcade = false;
  closeValleyMap();
  // lead = first crew member for nest/tech defaults; swap free among crew
  const members = crew.get();
  settings.lead = members[0]; saveSettings(settings);
  setLead(members[0], true);
  // ensure all crew animals exist as playable
  for (const id of members) if (!P[id]) initPlayer(id);
  selectSpecies(members[0], true);
  crew.active = 0;
  healAmt = valley.get(patchId).heal || 0;
  if (contests) contests.resetRound();
  if (packup) packup.cancel();
  startNew(settings.len || 10);
  if (zones) {
    const p0 = P[cur] || { x: 0, z: 0 };
    // Anchor the map so local (0,0) home sits on the player; then snap onto the new heightfield.
    zones.load(patchId, { x: p0.x, z: p0.z });
    const p = P[cur];
    if (p) {
      p.x = p0.x; p.z = p0.z; p.vx = p.vz = p.vy = 0;
      p.y = heightAt(p.x, p.z) + 1.0; p.grounded = true; p.coyote = 0.2;
    }
    placeFollowers(true);
  }
  renderCrewDock();
  updateHealUi();
  onb?.note?.('valleyIn');
  toast(`${def.emoji} ${def.name} · heal the meadow with your crew!`, 3200);
}
function renderCrewDock() {
  const dock = $('crewDock'); if (!dock) return;
  dock.innerHTML = '';
  dock.classList.toggle('arc', !valleySession);
  if (!valleySession) {
    // arcade / free-roam rounds: species switcher (Relaxed always allows swapping)
    if (!playing || !swapOK()) return;
    SPECIES_ORDER.forEach((id, i) => {
      const sp = SPECIES[id]; if (!sp) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = id === cur ? 'on' : '';
      b.innerHTML = `${sp.emoji}<small>${i + 1}</small>`; b.title = sp.name;
      b.onpointerup = e => { e.preventDefault(); if (playing && !paused && id !== cur) { selectSpecies(id); renderCrewDock(); } };
      dock.appendChild(b);
    });
    return;
  }
  if (!crew) return;
  crew.get().forEach((id, i) => {
    const sp = SPECIES[id], sk = SKILLS[id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = i === crew.active ? 'on' : '';
    b.innerHTML = `${sp.emoji}<small>${i + 1}</small>`;
    b.title = `${sp.name} — ${sk ? sk.name : ''}`;
    let holdT = 0, holdTimer = null;
    b.onpointerdown = e => {
      e.preventDefault();
      holdT = performance.now();
      holdTimer = setTimeout(() => { toast(`${sp.emoji} ${sk ? sk.name : sp.name}`, 1800); holdTimer = null; }, 260);
    };
    b.onpointerup = e => {
      e.preventDefault();
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (performance.now() - holdT < 260) crew.swapTo(i);
    };
    b.onpointerleave = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    dock.appendChild(b);
  });
}
function updateHealUi() {
  setHealArt(healAmt);
  document.body.classList.toggle('packReady', !!(valleySession && packup && !packup.active && packup.canStart()));
}
function endValleyPatchWild() {
  if (!valleySession) return;
  const id = valleySession.patchId;
  valley.markWild(id, { at: Date.now(), heal: 1 });
  const def = valley.def(id);
  toast(`🌿 ${def.name} is wild forever!`, 3200);
  valleySession = null; zones?.clear();
  playing = false; round.running = false; round.over = true;
  document.body.classList.remove('inRound', 'packReady');
  if (packup) packup.cancel();
  // unlock friendship auto if no neighbor contest required
  if (def && (!def.contest || def.contest === 'festival') && def.neighbor && def.neighbor !== 'all') {
    if (valley.friendship(def.neighbor) < 1) valley.addFriendship(def.neighbor, 1);
  }
  if (valley.checkFestival() && !valley.data.festivalSeen) {
    valley.data.festivalSeen = true; valley.save();
    openFestival();
  } else {
    openValleyMap();
  }
}
function openFestival() {
  openOv('festival');
  audio.music?.jingle?.('win');
  $('festTxt').textContent = 'Every patch is wild and every neighbor is a friend. You earned the Meadow Festival badge!';
}
function backToValleyFromPause() {
  closeOv('pause');
  confirmDlg('Leave patch?', 'Progress is saved. You can continue this patch from the Valley Map.', 'Back to Valley', () => {
    if (valleySession) {
      valley.setHeal(valleySession.patchId, healAmt);
      valley.save();
    }
    zones?.clear();
    playing = false; round.running = false;
    document.body.classList.remove('inRound', 'packReady');
    saveRound();
    openValleyMap();
  });
}


function refreshTitle() {
  const b = bests(), sr = savedRound(); $('cont').style.display = sr ? '' : 'none'; if (sr) $('cont').textContent = `⏩ Continue round · ${fmtT(sr.left)} left`;
  $('bestTxt').textContent = b[settings.len] ? `🏆 Best score (${settings.len} min): ${b[settings.len].toLocaleString()}` : `No ${settings.len}-minute score yet. Set the first one!`;
  const L = settings.lead && SPECIES[settings.lead] ? settings.lead : 'bee', lb = spBests()[L + ':' + settings.len]; if (lb) $('bestTxt').textContent += ` · ${SPECIES[L].emoji} ${lb.toLocaleString()}`;
}
function saveRound() { if (noSave || !round || !playing || !round.running || round.over || round.free) return; round.save({ tiers: tiers && tiers.serialize(), build: build.serialize(), helpers: helpers && helpers.serialize(), tech: tech && tech.serialize(), lead, roundDone, savedAt: Date.now() }); }
addEventListener('pagehide', saveRound);

function beginRound() {
  dirty = true; round.running = true; round.over = false; round.noTimer = !!valleySession && round.mode === 'relaxed';
  if (!swapOK() && cur !== lead && SPECIES[lead]) selectSpecies(lead, true);
  $('title').classList.remove('on'); document.body.classList.add('inRound'); playing = true; syncPause(); audio.start(); renderCrewDock();
  cam.zoomT = 1; cam.pitch = 0.35; { const p = P[cur]; cam.yaw = p.yaw; cam.swoop = 1.4; }
  setHint(isMobile ? 'Drag left to move · hold Jump in the air to fly · hold a big button for its wheel' : 'WASD move · Space jump (hold in air = fly) · E action · B build · Esc menu'); setTimeout(() => setHint(''), 10000);
  if (rivals && !rivals.active) rivals.resetRound(lead);
  if (hazards && !(hazards.list && hazards.list.length)) hazards.resetRound();
  if (goals) goals.resetRound();
  if (onb) onb.startRound();
  if (looks) looks.refreshUnlocks();
  toast(`${SPECIES[lead].emoji} ${SPECIES[lead].name} leads · costs in ${payIcons(lead)} · tap 🔨 to grow your meadow`, 3800);
  updateHud(); updateRoundHud(true); setActLabel(); state.pT = 0; terr.refresh();
}
let pendingStart = null;
function startNew(len) {
  settings.len = len; saveSettings(settings);
  // Boot may still be loading when the kid taps Start — queue instead of throwing on undefined.reset
  if (!round || !tech) {
    pendingStart = { len };
    toast('🌼 Meadow still waking — starting in a moment…', 2000);
    return;
  }
  if (dirty || savedRound()) { try { sessionStorage.setItem('pm-auto', JSON.stringify({ len, lead: settings.lead, mode: settings.mode, patch: valleySession ? valleySession.patchId : null })); } catch (e) {} clearRound(); noSave = true; location.reload(); return; }
  round.reset(len); round.mode = settings.mode === 'relaxed' ? 'relaxed' : 'challenge'; setLead(settings.lead && SPECIES[settings.lead] ? settings.lead : 'bee', true); selectSpecies(lead, true); if (hazards) hazards.resetRound(); if (rivals) rivals.resetRound(lead); tech.reset(); if (tiers) tiers.reset(); for (const k in convAcc) delete convAcc[k]; if (crew) crew.arcade = !valleySession; if (valleySession) { updateHealUi(); } else { document.body.classList.remove('packReady'); } beginRound();
}
function toTitle() { persist(); saveRound(); noSave = true; try { sessionStorage.removeItem('pm-auto'); } catch (e) {} location.reload(); }
function openPause() { $('bPause').classList.remove('pulse');
  if (shopOpen) closeShop();
  if (!playing || round.over || $('pause').classList.contains('on')) return;
  $('pauseInfo').textContent = `${round.free ? '∞ Free play (not saved to best scores)' : `⏱ ${fmtT(round.left)} left`} · ★ ${round.score().toLocaleString()}`; openOv('pause'); hubSet('game');
}
// title: Challenge / Relaxed set mode then open Valley Map (overhaul primary path)
for (const [id, mode] of [['tChallenge', 'challenge'], ['tRelaxed', 'relaxed']]) $(id).onclick = () => { settings.mode = mode; saveSettings(settings); openValleyMap(); };
if ($('tValley')) $('tValley').onclick = () => openValleyMap();
fdTrack($('title'), 'title', C => {
  const m = $('title').querySelector('.menu'), a = fdSlot('title', 'button-challenge'), r = fdSlot('title', 'button-relaxed'); if (!m || !r) return;
  const below = C.vh - (r.y + r.h) - 10, cx = r.x + r.w / 2;
  if (C.o === 'l' && below < 150) { const left = r.x + r.w + 14, w = Math.min(280, C.vw - left - 12); Object.assign(m.style, { left: left + 'px', top: a.y + 'px', width: w + 'px', maxHeight: (C.vh - a.y - 8) + 'px', maxWidth: 'none' }); }
  else { const w = Math.min(C.vw - 24, Math.max(r.w, 380)); Object.assign(m.style, { left: (cx - w / 2) + 'px', top: (r.y + r.h + 10) + 'px', width: w + 'px', maxHeight: Math.max(60, below) + 'px', maxWidth: 'none' }); }
});
$('play').onclick = () => { audio.start(); if (savedRound()) confirmDlg('Start a new round?', 'You have a round in progress. A new round will replace it.', 'New round', openPick); else openPick(); };

if ($('vBack')) $('vBack').onclick = () => { closeValleyMap(); openOv('title'); $('title').classList.add('on'); };
function startValleyIn(mode) { if (!vSelPatch) return; settings.mode = mode; saveSettings(settings); startValleyPatch(vSelPatch); }
if ($('vGo')) $('vGo').onclick = () => startValleyIn('challenge');
if ($('vFree')) $('vFree').onclick = () => startValleyIn('relaxed');
if ($('vEditCrew')) $('vEditCrew').onclick = () => openCrewTent();
if ($('festOk')) $('festOk').onclick = () => { closeOv('festival'); openValleyMap(); };
if ($('packBtn')) $('packBtn').onclick = () => { if (packup) packup.begin(); };
if ($('pValley')) $('pValley').onclick = () => backToValleyFromPause();
addEventListener('orientationchange', () => { if (document.body.classList.contains('inValley')) setTimeout(renderValleyMap, 120); });
addEventListener('resize', () => { if (document.body.classList.contains('inValley')) { clearTimeout(window.__vMapR); window.__vMapR = setTimeout(renderValleyMap, 140); } });

$('cont').onclick = () => { audio.start(); beginRound(); };
$('bPause').onclick = openPause; $('pResume').onclick = () => closeOv('pause');
$('pRestart').onclick = () => confirmDlg('Restart round?', 'Everything built or collected this round will be reset. Your gear and journal are kept.', 'Restart', () => startNew(round.len));
$('pQuit').onclick = () => confirmDlg('Quit to title?', 'Your round is saved. You can pick it up again with “Continue round”.', 'Quit', toTitle);
$('pJournal').onclick = () => openJournal(); $('pSettings').onclick = () => openOv('settings');
$('tJournal').onclick = () => openJournal(); $('tSettings').onclick = () => openOv('settings'); $('tHow').onclick = () => openOv('how'); $('howClose').onclick = () => closeOv('how');
$('pAdmin').onclick = () => { closeOv('pause'); admin.showButton(true); admin.open(); };
$('sClose').onclick = () => closeOv('settings');
// t22u mixer: master + music / gameplay / ambience / rain, live while dragging, saved in settings
const MIX_DEF = { music: 1, sfx: 1, amb: 1, rain: 0.5 };
function mixGet(k) { return k === 'master' ? settings.vol : (settings.mix && settings.mix[k] != null ? settings.mix[k] : MIX_DEF[k]); }
function applyMix() { audio.set('master', settings.vol); for (const k in MIX_DEF) audio.set(k, mixGet(k)); }
function syncMixUi() { for (const el of document.querySelectorAll('#mix input[data-k]')) { el.value = Math.round(mixGet(el.dataset.k) * 100); el.nextElementSibling.textContent = el.value; } }
let mixPrevT = 0;
$('mix').addEventListener('input', e => { const el = e.target.closest('input[data-k]'); if (!el) return; const k = el.dataset.k, v = +el.value / 100; el.nextElementSibling.textContent = el.value;
  if (k === 'master') settings.vol = v; else { settings.mix = Object.assign({}, MIX_DEF, settings.mix); settings.mix[k] = v; }
  audio.set(k, v); saveSettings(settings);
  const now = performance.now(); if (now - mixPrevT > 180 && (k === 'sfx' || k === 'master')) { mixPrevT = now; audio.blip(3); } });
$('sMute').onchange = () => { settings.mute = $('sMute').checked; audio.setMute(settings.mute); saveSettings(settings); };
function wipeSave() { confirmDlg('Full reset save?', 'This erases your gear, journal, best scores, saved round and settings, then reloads the game.', 'Erase everything', () => { noSave = true; wipeAll(); try { sessionStorage.removeItem('pm-auto'); } catch (e) {} location.reload(); }); }
$('sWipe').onclick = wipeSave;
$('rsAgain').onclick = () => startNew(round.len); $('rsTitle').onclick = toTitle;
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.start(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing && round && !round.over && !paused) openPause(); });

// ---- HUD
const hudCache = {};
// resource icon: Squid's resource-<name>.png, emoji fallback
const RI = k => `<span class="tier t${k}"></span>`;
function setTxt(id, s) { if (hudCache[id] !== s) { hudCache[id] = s; $(id).textContent = s; } }
function updateRoundHud(force) {
  if (tiers) $('rS').classList.toggle('carry', !!tiers.carrying);
  if (!round) return;
  setTxt('rbTime', (round.free || round.noTimer) ? '⏱ ∞' : '⏱ ' + fmtT(Math.ceil(round.left))); $('rbMain').classList.toggle('low', !round.free && !round.noTimer && round.running && round.left < 30 && !round.over);
  setTxt('rbScore', '★ ' + round.score().toLocaleString()); if ($('rbPct')) { $('rbPct').style.display = 'none'; $('rbPct').textContent = ''; }
  for (const k of RES_KEYS) { const h = RI(k) + ' ' + round.res[k], id = 'r' + k.toUpperCase(); if (hudCache[id] !== h) { hudCache[id] = h; $(id).innerHTML = h; } }
  if (helpers) setTxt('rHl', crewText()); if (tech) updateTechHud();
  if (round.flashT > 0 && round.flashK) { const s = $('r' + round.flashK.toUpperCase()); s.classList.remove('fl'); void s.offsetWidth; s.classList.add('fl'); round.flashT = 0; }
}
/** results: player bubble on the 1st step, score card between header and podium (portrait) or in the side panel (landscape) */
function layoutResults(C) {
  const me = $('rsMe'), card = $('rsCard'), st = fdSlot('results', 'stand-1', true), r1 = fdSlot('results', 'rank-1'), hd = fdSlot('results', 'header'), pn = fdSlot('results', 'panel');
  const sz = Math.max(40, Math.min(72, r1.w * 0.85)); Object.assign(me.style, { left: st.x + 'px', top: (st.y - 6) + 'px', width: sz + 'px', height: sz + 'px', fontSize: sz * 0.6 + 'px' });
  const put = (x, y, w, h) => Object.assign(card.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: Math.max(80, h) + 'px' });
  if (C.o === 'l') { const bh = 96; put(pn.x, hd.y + hd.h + 6, pn.w, C.vh - (hd.y + hd.h + 6) - bh - 14); Object.assign($('results').querySelector('.rsBtns').style, { position: 'absolute', left: pn.x + 'px', width: pn.w + 'px', top: (C.vh - bh - 8) + 'px', height: bh + 'px', right: 'auto' }); } else { const top = hd.y + hd.h + 6, bot = st.y - sz - 14; put(Math.max(12, C.vw / 2 - 180), top, Math.min(C.vw - 24, 360), bot - top); }
}
function showResults() {
  if (round.free) return;
  if (rts.possessed) releaseHelper(); if (rts.on) exitRts(true);
  setBuild(false); const score = round.score();
  const prev = bests()[round.len] || 0, isBest = setBest(round.len, score), sprev = spBests()[lead + ':' + round.len] || 0, spBest = setSpBest(lead, round.len, score); clearRound(); dirty = false; closeTech();
  $('rsLead').innerHTML = `${SPECIES[lead].emoji} Led by the ${SPECIES[lead].name} · ${tech.count()} tech researched<br><small>${spBest ? '🏆 Best ever as ' + SPECIES[lead].name + '!' : `${SPECIES[lead].name} best (${round.len} min): ${sprev.toLocaleString()}`}</small>`;
  $('rsScore').textContent = score.toLocaleString(); $('rsBest').textContent = isBest ? '🏆 New best score!' : `Best (${round.len} min): ${prev.toLocaleString()}`;
  $('rsBrk').innerHTML = CATS.filter(([k]) => (k !== 'admin' || round.sc[k] > 0) && (round.sc[k] || 0) > 0).map(([k, ic, nm]) => `<div><span>${ic} ${nm}</span><b>${Math.floor(round.sc[k]).toLocaleString()}</b></div>`).join('');
  const bl = Object.entries(round.stats.builds).map(([t, n]) => `${n} ${CATALOG[t] ? CATALOG[t].name : t}${n > 1 ? 's' : ''}`).join(', ');
  $('rsStats').textContent = `Built: ${bl || 'nothing'} · Delivered ${round.stats.units} gathered items · 🐾 ${helpers ? helpers.perm() : 0} helper${helpers && helpers.perm() === 1 ? '' : 's'} hired, who brought in ${round.stats.helperUnits || 0}${round.stats.visitors ? ` · 🎟️ ${round.stats.visitors} visitor${round.stats.visitors === 1 ? '' : 's'} brought ${round.stats.visitorUnits || 0}` : ''} · ${round.stats.dew} dewdrops`;
  if (goals) { const gl = goals.resultsLine(); if (gl) $('rsStats').textContent += ' · ' + gl; }
  if (looks && round.mode !== 'relaxed') looks.grantPlay?.(1);
  $('rsMe').textContent = SPECIES[lead].emoji; $('rsMe').title = 'You: ' + SPECIES[lead].name + (round.mode === 'relaxed' ? ' (Relaxed)' : '');
  if (rivals && rivals.active) {
    const rows = rivals.placement();
    const me = rows.find(r => r.who === 'you');
    const rv = rows.find(r => r.who === 'rival');
    if (me) $('rsMe').title += ` · #${me.rank}`;
    if (rv) {
      const line = document.createElement('div'); line.style.cssText = 'margin-top:6px;font:800 13px system-ui';
      line.textContent = `#${rv.rank} ${rv.emoji} ${rv.name}: ${rv.score.toLocaleString()} ★`;
      const host = $('rsBest'); if (host && !host.dataset.rival) { host.dataset.rival = '1'; host.after(line); }
    }
  }
  resultsAt = performance.now(); audio.music.jingle('win'); openOv('results'); fdTrack($('results'), 'results', layoutResults);
}

// ---- t22u: secret free play. Hold the top-left corner (80x80 px) for 5 s once the timer has run out (or in its last 10 s).
const FP_HOLD = 5000, FP_SHOW = 1500, FP_BOX = 80;
const fp = { t0: 0, id: null, raf: 0, done: false, unlocked: 0 };
const fpArmed = () => playing && round && !round.free && (round.over || (round.running && round.left <= 10));
function fpReset() { fp.t0 = 0; fp.id = null; clearInterval(fp.raf); const r = $('fpRing'); if (!r.classList.contains('sp')) { r.style.opacity = 0; r.style.transform = 'scale(.2)'; } }
function fpFrame() {
  if (!fp.t0) return; const el = performance.now() - fp.t0, r = $('fpRing');
  if (el >= FP_HOLD) { fpReset(); fpUnlock(); return; }
  if (el > FP_SHOW) { const k = (el - FP_SHOW) / (FP_HOLD - FP_SHOW); r.style.opacity = (0.12 + 0.3 * k).toFixed(3); r.style.transform = `scale(${(0.25 + 0.75 * k).toFixed(3)})`; }
}
addEventListener('pointerdown', e => { if (fp.t0 || e.clientX > FP_BOX || e.clientY > FP_BOX || !fpArmed()) return; fp.t0 = performance.now(); fp.id = e.pointerId; clearInterval(fp.raf); fp.raf = setInterval(fpFrame, 50); }, true);
addEventListener('pointermove', e => { if (fp.t0 && e.pointerId === fp.id && (e.clientX > FP_BOX + 30 || e.clientY > FP_BOX + 30)) fpReset(); }, true);
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, e => { if (fp.t0 && e.pointerId === fp.id) fpReset(); }, true);
addEventListener('click', e => { if (performance.now() - fp.done < 700) { e.stopPropagation(); e.preventDefault(); } }, true);
function fpUnlock() {
  fp.done = performance.now(); fp.unlocked++; const r = $('fpRing'); r.classList.remove('sp'); void r.offsetWidth; r.classList.add('sp'); setTimeout(() => { r.classList.remove('sp'); r.style.opacity = 0; }, 950);
  audio.sample('round/secret-unlock-sparkle', 0.5); enterFree(); toast('✨ Free Play unlocked · no timer, just the meadow', 3400);
}
function enterFree(on = true) {
  if (!round || !playing) return;
  if (!on) { round.free = false; document.body.classList.remove('freePlay'); if (round.left < 1) round.setLeft(60); updateRoundHud(true); return; }
  if (round.running && !round.over && round.left > 0 && round.left <= 10) round.setLeft(0); // finish the timed round first so its score counts
  round.free = true; round.over = false; round.running = true; round.left = 0;
  closeOv('results'); document.body.classList.add('freePlay'); syncPause(); fx.burst(P[cur].x, P[cur].y + 1.5, P[cur].z, 30, 6); updateRoundHud(true);
}

// ---- t19u/t20u: lead species, species picker, tech tree overlay, info cards
const SPB_KEY = 'pm-best-sp';
const spBests = () => { try { return JSON.parse(localStorage.getItem(SPB_KEY) || '{}'); } catch (e) { return {}; } };
function setSpBest(id, len, score) { const b = spBests(), k = id + ':' + len; if (score > (b[k] || 0)) { b[k] = score; try { localStorage.setItem(SPB_KEY, JSON.stringify(b)); } catch (e) {} return true; } return false; }
const payIcons = id => Object.keys(priceFor(id, 100)).map(k => RES_ICON[k]).join('');
const costLine = (c, free) => Object.keys(c).map(k => `<i class="${free || round.res[k] >= c[k] ? '' : 'no'}">${RI(k)}${c[k]}</i>`).join('');
function setLead(id, quiet) {
  if (!SPECIES[id]) return; lead = id; settings.lead = id; saveSettings(settings);
  for (const k in abCache) abCache[k] = null; if (tech) tech.ver++;
  $('rbLead').textContent = SPECIES[id].emoji; $('rbLead').title = 'Lead: ' + SPECIES[id].name + ' · pays in ' + payIcons(id);
  if (build && build.active) renderBTray(true); if (techOpen) renderTech();
  if (!quiet && playing) toast(`${SPECIES[id].emoji} ${SPECIES[id].name} now leads: costs in ${payIcons(id)}`, 2400);
}
// species picker (title ▶ Play)
let pickSel = 'bee';
function renderPick() {
  const b = spBests();
  $('pkList').innerHTML = SPECIES_ORDER.map(id => { const sp = SPECIES[id], A = ARCH[id], best = b[id + ':' + settings.len];
    return `<button class="pk ${id === pickSel ? 'on' : ''}" data-s="${id}"><div class="hd"><span>${sp.emoji}</span><div><b>${sp.name}</b><small>${SIZE_NAME[A.size]} · ${sp.mv.fly ? 'flier' : 'ground'} · brings ${RES_ICON[RES_OF[id]]}${A.by ? ' (+' + RES_ICON[A.by.k] + ')' : ''}</small></div></div>${barsHtml(id)}<div class="sw">＋ ${A.str.join(' · ')}</div><div class="wk">－ ${A.weak.join(' · ')}</div><div class="pay">Pays in ${payIcons(id)}${best ? ` · 🏆 ${best.toLocaleString()}` : ''}</div></button>`; }).join('');
  if ($('pkTeam') && crew) { crew.loadFromValley(); $('pkTeam').innerHTML = `🐾 Team: ${crew.get().map(id => SPECIES[id].emoji).join(' ')} <button class="pill" id="pkTeamBtn">✏️ Pick team</button>`; $('pkTeamBtn').onclick = () => openTeamPick(renderPick); }
  $('pkGo').textContent = `⏱ Challenge as ${SPECIES[pickSel].emoji}`; $('pkFree').textContent = `🌿 Free roam as ${SPECIES[pickSel].emoji}`;
}
function openPick() { pickSel = settings.lead && SPECIES[settings.lead] ? settings.lead : 'bee'; renderPick(); openOv('pick'); }
$('pkList').addEventListener('click', e => { const c = e.target.closest('.pk'); if (!c) return; audio.blip(2); pickSel = c.dataset.s; renderPick(); });
$('pkBack').onclick = () => closeOv('pick');
const pkStart = mode => { settings.mode = mode; closeOv('pick'); settings.lead = pickSel; saveSettings(settings); setLead(pickSel, true); startNew(settings.len); };
$('pkFree').onclick = () => pkStart('relaxed');
$('pkGo').onclick = () => pkStart('challenge');
if (0) $('pkGo').onclick = () => { closeOv('pick'); settings.lead = pickSel; saveSettings(settings); setLead(pickSel, true); startNew(settings.len); };
// tech tree overlay
let techSp = 'bee', techSel = null;
function openTech(sp) {
  if (!playing || !round || round.over || techOpen) return;
  techSp = sp && TREES[sp] ? sp : (rts.on && rts.sel.length ? rts.sel[0].sp : rts.on && rts.own ? rts.own : cur);
  techSel = null; techOpen = true; $('tech').classList.add('on'); syncPause(); renderTech(); audio.blip(4);
}
function closeTech() { if (!techOpen) return; techOpen = false; $('tech').classList.remove('on'); syncPause(); }
function renderTech() {
  if (!techOpen) return; const T = TREES[techSp], sp = techSp;
  $('tkRes').innerHTML = RES_KEYS.map(k => `${RI(k)}${round.res[k]}`).join(' ') + ` · pays in ${payIcons(lead)}`;
  $('tkTabs').innerHTML = SPECIES_ORDER.map(id => { const n = TREES[id].nodes.filter(q => tech.isDone(id, q.id)).length, a = tech.active[id];
    return `<button data-s="${id}" class="${id === sp ? 'on' : ''} ${id === lead ? 'lead' : ''}" title="${SPECIES[id].name}">${SPECIES[id].emoji}<i>${a ? '⏳' : n + '/6'}</i></button>`; }).join('');
  $('tkSub').innerHTML = `<div>${T.a}</div><div>${T.b}</div>`;
  const node = n => { const st = tech.state(sp, n), c = tech.cost(n);
    return `<button class="tn ${st} ${techSel === n.id ? 'sel' : ''}" data-n="${n.id}" style="grid-column:${n.br === 'a' ? 1 : 2};grid-row:${n.tier}"><span class="tr">T${n.tier}</span><span class="ic">${n.icon}</span><span class="tx"><b>${n.name}</b>${st === 'done' ? '<i>✓ Done</i>' : `<span>${costLine(c, tech.free)}</span>`}</span></button>`; };
  const lines = T.nodes.filter(n => n.req.length).map(n => { const r = nodeOf(sp, n.req[0]), on = tech.isDone(sp, r.id); const x = n.br === 'a' ? 25 : 75; return `<line x1="${x}%" y1="${(r.tier - 0.5) / 3 * 100}%" x2="${x}%" y2="${(n.tier - 0.5) / 3 * 100}%" stroke="${on ? '#ffd23f' : 'rgba(255,255,255,.3)'}" stroke-width="4" stroke-dasharray="${on ? '' : '6 5'}"/>`; }).join('');
  const html = `<svg>${lines}</svg>` + T.nodes.map(node).join('');
  if ($('tkTree').dataset.h !== html) { $('tkTree').dataset.h = html; $('tkTree').innerHTML = html; }
  const n = techSel ? nodeOf(sp, techSel) : null; let info;
  if (!n) { info = `<b>${SPECIES[sp].emoji} ${SPECIES[sp].name}</b> · ${SIZE_NAME[ARCH[sp].size]} ${SPECIES[sp].mv.fly ? 'flier' : 'ground'}<div>Tap a node to see what it does. Green = ready to research — finishes instantly when you pay.</div>`; }
  else { const st = tech.state(sp, n), why = tech.why(sp, n);
    info = `<b>${n.icon} ${n.name}</b> <small>· Tier ${n.tier} · ${n.br === 'a' ? T.a : T.b}</small><div>${n.desc}</div><div class="r">${st === 'done' ? '<span>✓ Researched</span>' : `<span class="co">${costLine(tech.cost(n), tech.free)}</span><button data-a="go" ${why ? 'disabled' : ''}>🧬 Research</button>${why ? `<span class="why">${why}</span>` : ''}`}</div>`; }
  if ($('tkInfo').dataset.h !== info) { $('tkInfo').dataset.h = info; $('tkInfo').innerHTML = info; }
}
$('tkTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; audio.blip(2); techSp = b.dataset.s; techSel = null; renderTech(); });
$('tkTree').addEventListener('click', e => { const b = e.target.closest('.tn'); if (!b) return; audio.sample('ui2/tech-node-hover', 0.35); techSel = b.dataset.n; renderTech(); });
$('tkInfo').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.a === 'go') tech.start(techSp, techSel); else if (b.dataset.a === 'cancel') tech.cancel(techSp); renderTech(); updateRoundHud(true); });
$('tkX').onclick = closeTech; $('tech').addEventListener('click', e => { if (e.target.id === 'tech') closeTech(); });
$('pTech').onclick = () => { closeOv('pause'); openTech(); };
$('rbTech').onclick = () => openTech(Object.keys(tech.active)[0]);
input.hooks.tech = () => techOpen ? closeTech() : (playing && !paused && openTech());
function updateTechHud() {
  const ks = Object.keys(tech.active), c = $('rbTech');
  if (!ks.length) { c.classList.remove('on'); } else { const a = tech.active[ks[0]], n = nodeOf(ks[0], a.id); c.classList.add('on'); const t = `🧬 ${SPECIES[ks[0]].emoji}${n.icon} ${n.name} ${Math.ceil(a.left)}s${ks.length > 1 ? ' +' + (ks.length - 1) : ''}`; if (c.textContent !== t) c.textContent = t; }
  if (techOpen) renderTech();
}
// build info card (tray): what the selected building does, with numbers
let infoKey = '';
function infoHtml(t) {
  const C = CATALOG[t], c = build.cost(t, cur), lines = buildInfo(t, { terr: 1 + tech.g().terr, garden: 1 + tech.g().garden }), lock = !build.unlocked(t);
  return `<b>${C.icon} ${t === 'home' ? `Home Lv ${Math.min(3, build.homeLv[cur] + 1)} · ${SPECIES[cur].name}` : C.name}</b><em>${C.blurb}</em><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>${lock ? `<div class="co">🧬 Unlock in the ${SPECIES[C.tech].emoji} ${SPECIES[C.tech].name} tech tree</div>` : c && !build.atMax(t, cur) ? `<div class="co">${costLine(c, build.free)} <small>(priced for ${SPECIES[lead].emoji} ${SPECIES[lead].name})</small></div>` : '<div class="co">MAX</div>'}`;
}
function hireInfoHtml(sp) {
  const A = ARCH[sp]; return `<b>${SPECIES[sp].emoji} ${SPECIES[sp].name} helper</b><em>${A.str[0]}; ${A.weak[0].toLowerCase()}.</em><ul><li>Speed ${helpers.speedOf(sp).toFixed(1)} m/s · carries ${helpers.capOf(sp)} ${RES_ICON[RES_OF[sp]]} · ${(1.6 * helpers.eatOf(sp)).toFixed(1)} s per pick</li><li>${SPECIES[sp].mv.fly ? 'Flies straight over water and hills.' : 'Walks: has to go around the pond.'}</li></ul><div class="co">${costLine(helpers.cost(sp), helpers.free)}</div>`;
}
let hoverHire = null;
function updateInfoCard() {
  const el = $('bInfoC'); let h = '';
  if (build.active) h = trayMode === 'hire' ? (hoverHire ? hireInfoHtml(hoverHire) : '') : infoHtml(build.sel);
  if (h !== infoKey) { infoKey = h; el.innerHTML = h; } el.classList.toggle('on', !!h);
}
$('bTray').addEventListener('pointerover', e => { const c = e.target.closest('.bc'); hoverHire = c && c.dataset.h ? c.dataset.h : null; });
$('bTray').addEventListener('pointerleave', () => { hoverHire = null; });
// RTS: placed building card
const crewText = () => { const v = helpers.visitors().length; return '🐾 ' + helpers.perm() + (v ? ' + ⏳' + v : ''); };
function inviteBtn(p) { const sp = helpers.visitorOf(p); if (!sp && !(p.type === 'outpost')) return ''; const w = helpers.visitWhy(p), c = sp ? helpers.visitCost(p) : null;
  const here = helpers.list.find(h => h.visitor && !h.visitor.bye && h.visitor.bid === p.id);
  if (here) return `<button data-a="inv" class="no" title="Visitor here">⏳ ${helpers.timeLeft(here)}s</button>`;
  return `<button data-a="inv" class="${w ? 'no' : ''}" title="${w || 'Visitor — A friend who helps for a little while.'}">🎟️ ${sp ? SPECIES[sp].emoji : ''}${c ? ' ' + Object.keys(c).map(k => RES_ICON[k] + c[k]).join(' ') : ''}</button>`; }
function buildingCard(p) {
  const C = CATALOG[p.type], lv = p.lv || 1, uc = build.upgradeCost(p), lines = buildInfo(p.type, { terr: 1 + tech.g().terr, garden: (1 + tech.g().garden) * (1 + 0.5 * (lv - 1)) });
  return `<div class="pt">${C.icon}</div><div class="tx"><b>${C.name} · Lv ${lv}</b><small>${lines[0] || C.blurb}</small>${p.type === 'garden' ? `<small>Grows ${RES_ICON[p.kind]} ${RES_NAME_[p.kind]}</small>` : ''}${uc ? `<small>⬆ ${build.upgradeText(p)}</small>` : '<small>Fully upgraded</small>'}</div><div class="bt">${inviteBtn(p)}${uc ? `<button data-a="up">⬆ ${Object.keys(uc).map(k => RES_ICON[k] + uc[k]).join(' ')}</button>` : ''}<button data-a="x">✕</button></div>`;
}
const RES_NAME_ = { n: 'Nectar', f: 'Forage', w: 'Wood', h: 'Honey' };
function statsTable() {
  return `<table><tr><th>Sp</th><th>run</th><th>fly</th><th>carry</th><th>reach</th><th>drain</th><th>hSpd</th><th>hCap</th><th>pays</th></tr>${SPECIES_ORDER.map(id => { const sp = SPECIES[id], a = abOf(id); return `<tr><td>${sp.emoji}${id === lead ? '★' : ''}</td><td>${a.mv.run.toFixed(1)}</td><td>${a.mv.fly ? (a.mv.fly.speed || 1).toFixed(2) : '–'}</td><td>${a.cap}</td><td>${a.reach.toFixed(1)}</td><td>${a.mv.fly ? a.mv.fly.drain.toFixed(2) : '–'}</td><td>${helpers.speedOf(id).toFixed(1)}</td><td>${helpers.capOf(id)}</td><td>${Object.entries(priceFor(id, 20)).map(([k, v]) => RES_ICON[k] + v).join('')}</td></tr>`; }).join('')}</table><small>pays = price of a 20-cost item</small>`;
}

// ---- build mode
function setActLabel() { const sp = SPECIES[cur]; if (build && build.active) { $('actTxt').textContent = 'Place'; $('actEm').textContent = '✓'; } else { $('actTxt').textContent = sp.actName; $('actEm').textContent = sp.actEmoji; } }
let trayKey = '';
let trayMode = 'build';
const costHtml = (c, free) => Object.keys(c).map(k => `<i class="${free || round.res[k] >= c[k] ? '' : 'no'}">${RI(k)}${c[k]}</i>`).join('');
function renderBTray(force) {
  const nH = helpers ? helpers.perm() : 0;
  if (trayMode === 'hire') {
    const full = nH >= helpers.max(), tc = helpers.trainCost();
    const html = `<div class="bc tab" data-x="back"><div class="ic">🔨</div><b>◀ Build</b><div class="co">${nH}/${helpers.max()} hired</div></div>` + HIRE_ORDER.map(sp => `<div class="bc hr ${full ? 'mx' : ''}" data-h="${sp}"><div class="ic">${SPECIES[sp].emoji}</div><b>${SHORT[sp]} ${RES_ICON[RES_OF[sp]]}</b><div class="co">${full ? 'FULL' : costHtml(helpers.cost(sp), helpers.free)}</div><div class="sbm"><div><span>💨</span><i><b style="width:${Math.round(100 * helpers.speedOf(sp) / 11)}%"></b></i></div><div><span>🎒</span><i><b style="width:${Math.round(100 * helpers.capOf(sp) / 12)}%"></b></i></div></div></div>`).join('')
      + `<div class="bc ${tc ? '' : 'mx'}" data-x="train"><div class="ic">🎓</div><b>Train Lv ${Math.min(3, helpers.lvl + 1)}</b><div class="co">${tc ? costHtml(tc, helpers.free) : 'MAX'}</div></div>`;
    const key = 'h' + html; if (key !== trayKey || force) { trayKey = key; $('bTray').innerHTML = html; } $('bBar').classList.remove('rot'); return;
  }
  const html = `<div class="bc tab" data-x="hire"><div class="ic">🐾</div><b>Hire helpers</b><div class="co">${nH}/${helpers.max()}</div></div><div class="bc tab" data-x="tech"><div class="ic">🧬</div><b>Tech tree</b><div class="co">${tech.count()} done${Object.keys(tech.active).length ? ' ⏳' : ''}</div></div>` + trayList().map(t => { const C = CATALOG[t], cost = build.cost(t, cur), mx = build.atMax(t, cur);
    const co = !cost || mx ? 'MAX' : Object.keys(cost).map(k => `<i class="${build.free || round.res[k] >= cost[k] ? '' : 'no'}">${RES_ICON[k]}${cost[k]}</i>`).join('');
    return `<div class="bc ${t === build.sel ? 'sel' : ''} ${mx ? 'mx' : ''}" data-t="${t}">${C.tier ? `<div class="tierb">T${C.tier}</div>` : ''}<div class="ic">${C.icon}</div><b>${t === 'home' ? 'Home Lv ' + Math.min(3, build.homeLv[cur] + 1) : C.name}</b><div class="co">${co}</div></div>`; }).join('') + lockedHtml();
  const key = html + build.sel; if (key !== trayKey || force) { trayKey = key; $('bTray').innerHTML = html; }
  $('bBar').classList.toggle('rot', !!CATALOG[build.sel].rot);
}
function trayList() { const L = ['home', ...BUILDS_OF(cur)]; if (!L.includes(build.sel)) build.setSel(L[1] || 'home'); return L; }
function lockedHtml() {
  if (round.mode !== 'relaxed' && !round.free) return '';
  return BUILD_ORDER.filter(t => CATALOG[t].sp !== cur).map(t => { const C = CATALOG[t], S = SPECIES[C.sp];
    return `<div class="bc lock" data-sw="${C.sp}" title="Only ${S.name} knows how to build this. Swap to ${S.name}!"><div class="tierb">T${C.tier}</div><div class="ic">${S.emoji}${C.icon}</div><b>${C.name}</b><div class="co">Swap to ${S.name}</div></div>`; }).join('');
}
function visitorTrayHtml() {
  const vb = build.placed.filter(p => helpers.visitorOf(p)); const vs = helpers.visitors();
  return vs.map(h => `<div class="bc mx vis"><div class="ic">${SPECIES[h.sp].emoji}</div><b>⏳ Visitor</b><div class="co">${helpers.timeLeft(h)}s</div></div>`).join('')
    + vb.filter(p => !vs.some(h => h.visitor.bid === p.id)).slice(0, 4).map(p => { const w = helpers.visitWhy(p), c = helpers.visitCost(p);
      return `<div class="bc ${w ? 'mx' : ''}" data-v="${p.id}" title="${w || 'Visitor — A friend who helps for a little while.'}"><div class="ic">🎟️${SPECIES[helpers.visitorOf(p)].emoji}</div><b>Invite · ${CATALOG[p.type].name}</b><div class="co">${w ? (helpers.vCool > 0 ? Math.ceil(helpers.vCool) + 's' : '–') : costHtml(c, helpers.free)}</div></div>`; }).join('');
}
/** Tap a build icon (wheel or tray) → select + place at ghost/feet. No extra confirm. */
function pickAndPlaceBuilding(t) {
  if (!build || !playing || paused) return false;
  if (!build.active) setBuild(true);
  if (!build.active) return false;
  setTrayMode('build');
  const again = build.sel === t && state.bmPicked === t; state.bmPicked = t;
  build.setSel(t);
  if (!again) { renderBTray(true); toast(`${CATALOG[t].icon} ${t === 'home' ? 'Home' : CATALOG[t].name} · move the view, then tap again (or Place) to build`, 1800); return false; }
  build.updateGhost(P[cur], cam.yaw, state.sT || 0); updateBuildUi(0, state.sT || 0);
  const ok = !!build.placeGhost(); if (ok) { state.bmPicked = null; setBuild(false); } return ok;
  renderBTray(true);
  build.updateGhost(P[cur], cam.yaw, state.sT || 0);
  updateBuildUi(0, state.sT || 0);
  // placeGhost toasts on failure; stay in build mode so they can walk / aim / use Place
  return !!build.placeGhost();
}
function setTrayMode(m) { trayMode = m; hoverHire = null; state.bT = 0; build.hiring = m === 'hire'; document.body.classList.toggle('hireOn', m === 'hire'); renderBTray(true); }
$('bTray').addEventListener('click', e => { const c = e.target.closest('.bc'); if (!c) return; audio.blip(2);
  if (c.dataset.x === 'hire') return setTrayMode('hire'); if (c.dataset.x === 'tech') return openTech(lead); if (c.dataset.x === 'back') return setTrayMode('build');
  if (c.dataset.x === 'train') { helpers.train(); return renderBTray(true); }
  if (c.dataset.v) { const p = build.placed.find(q => String(q.id) === c.dataset.v); if (p) helpers.invite(p).then(() => { renderBTray(true); updateRoundHud(true); }); return; }
  if (c.dataset.h) { const p = rts.on ? { x: rts.x, z: rts.z } : P[cur], a = Math.random() * 6.28; helpers.hire(c.dataset.h, { x: p.x + Math.cos(a) * 4, z: p.z + Math.sin(a) * 4 }).then(h => { if (h && valley) valley.noteHire(c.dataset.h); renderBTray(true); buildTray(); updateRoundHud(); }); return; }
  if (c.dataset.sw) { const id = c.dataset.sw; if (swapOK() || round.mode === 'relaxed') { setBuild(false); selectSpecies(id); toast(`⇄ Swapped to ${SPECIES[id].name}`, 1500); setBuild(true); } else toast(`🔒 Only ${SPECIES[id].name} knows how to build this. Swap to ${SPECIES[id].name}!`, 2200); return; }
  if (c.dataset.t) { pickAndPlaceBuilding(c.dataset.t); return; } });
function setBuild(on) {
  if (!build || on === build.active) return;
  if (on) { if (!playing || paused || shopOpen) return; const p = P[cur]; p.vx = p.vz = 0; bmF.on = false; state.bmPicked = null; build.enter(); renderBTray(true); } else { build.exit(); bmF.on = false; cam.swoop = 0.6; trayMode = 'build'; build.hiring = false; document.body.classList.remove('hireOn'); }
  document.body.classList.toggle('buildOn', on); $('bBuild').classList.toggle('on', on); setActLabel(); cam.pitch = on ? 0.8 : 0.35; if (on) toast('🔨 ' + KID.build, 2600); $('bmHint').textContent = on ? '🔒 ' + KID.build : ''; $('bmHint').classList.toggle('on', on);
}
function toggleBuild() { setBuild(!build.active); }
$('bbExit').onclick = () => setBuild(false); $('bbRot').onclick = () => build.rotate();
$('bbPlace').addEventListener('pointerdown', e => { e.preventDefault(); if (playing && !paused && build.placeGhost()) setBuild(false); });
let whyKey = '';
function updateBuildUi(dt, t) {
  build.aim = bmF.on ? { x: bmF.x, z: bmF.z } : null;
  build.updateGhost(P[cur], cam.yaw, t);
  const ok = build.valid, txt = trayMode === 'hire' ? `🐾 Tap a friend to hire (${helpers.perm()}/${helpers.max()}${helpers.visitors().length ? ' + ⏳' + helpers.visitors().length : ''}). New helpers follow you — 📣 Command to gather.` : ok ? (build.sel === 'home' ? '✓ Tap Home icon (or Place) to upgrade' : '✓ Tap the icon again (or Place) to build here') : '✖ ' + (build.why || '…'); const w = $('bWhy');
  if (whyKey !== txt) { whyKey = txt; w.textContent = txt; } w.classList.toggle('bad', !ok && trayMode !== 'hire'); $('bbPlace').classList.toggle('no', !ok);
  state.bT = (state.bT || 0) - dt; if (state.bT <= 0) { state.bT = 0.25; renderBTray(); updateInfoCard(); }
}

// ---- game flow helpers
function worldTick(dt, st) {
  if (rts.on) { for (const id of SPECIES_ORDER) stepParked(id, dt, st); } else { stepPlayer(dt, st); for (const id of SPECIES_ORDER) if (id !== cur) stepParked(id, dt, st); } coop.update(dt, st, cur);
  if (helpers) helpers.update(playing && !paused ? dt : 0, st, playing && !paused && round.running && !round.over);
  if (tiers) tiers.update(playing && !paused ? dt : 0, st, playing && !paused && round.running && !round.over);
  if (hazards) hazards.update(playing && !paused ? dt : 0, st, { playing, paused, p: P[cur], sp: SPECIES[cur], elapsed: round.len * 60 - (round.left || 0), len: round.len });
  if (rivals) rivals.update(playing && !paused ? dt : 0, st, { playing, paused, p: P[cur], lead });
  // Valley heal meter ← bloom %; contests + pack-up
  if (valleySession && playing && !paused && round.running && !round.over) {
    // Heal comes from zone pickups / team lifts / contests — territory bloom retired (t135u).
    if (zones) { zones.update(dt, camera); if (!zones.keyGoalMet()) healAmt = Math.min(healAmt, HEAL_PACKUP - 0.01); }
    if (valley) valley.setHeal(valleySession.patchId, healAmt);
    updateHealUi();
    const def = valley?.def(valleySession.patchId);
    const needContest = def && def.contest && def.contest !== 'festival';
    const contestOk = !needContest || !!(valley.get(valleySession.patchId)?.contestDone);
    if (healAmt >= HEAL_PACKUP && contestOk) {
      onb?.note?.('healReady');
      onb?.note?.('packup');
    }
    if (contests) contests.update(dt, { playing, paused, heal: healAmt, patchDef: def, relaxed: round.mode === 'relaxed' });
    if (packup) packup.update(dt, P[cur]);
  }

  if (items) items.update(playing && !paused ? dt : 0);
  if (looks) looks.update(playing && !paused ? dt : 0, riders[cur], P[cur]);
  if (goals && playing && !paused) goals.update();
  if (onb && playing && !paused) { if (round.stats.builds && Object.keys(round.stats.builds).length) onb.flags.built = 1; if (helpers && helpers.perm && helpers.perm() > 0) onb.flags.hired = 1; onb.update(dt, st); }
  if (playing && !paused && round.running && !round.over) { round.tick(dt); tech.update(dt); }
}
function frameSim(sdt, t, st) {
  terr.growMul = 0; terr.update(sdt, camera.position, night);
  build.update(playing && !paused ? sdt : 0, t, playing ? P[cur] : null, st);
}
let _smK = null, _smV = null, _smS = 0;
function speedMv(m) { if (_smK === m && _smS === adm.speed) return _smV; const f = adm.speed, o = Object.assign({}, m, { run: m.run * f }); if (m.fly) o.fly = Object.assign({}, m.fly, m.fly.speed ? { speed: m.fly.speed * f } : {}); _smK = m; _smS = f; _smV = o; return o; }
const titleP = { x: 0, y: 0, z: 0, floorY: 0, speed: 0, boostT: 0 }; let titleI = 0, titleT = 99;
function titleTarget(dt) {
  titleT += dt; if (titleT > 13) { titleT = 0; titleI = (titleI + 1) % SPECIES_ORDER.length; const n = SPECIES[SPECIES_ORDER[titleI]].nest; titleP.x = n.x; titleP.z = n.z; titleP.y = titleP.floorY = heightAt(n.x, n.z) + 1; }
  return titleP;
}

// ---------- helpers + commander (RTS) view + possess ----------
let helpers = null;
let hazards = null;
let rivals = null;
let goals = null, onb = null, items = null, looks = null;
const rts = { on: false, x: 0, z: 0, h: 95, cx: 0, cz: 0, ch: 20, sel: [], own: null, boxMode: false, ptrs: new Map(), pinch0: 0, h0: 0, possessed: null, saved: null, lastTapT: 0, lastTapU: null, keys: {}, mouse: null, cardT: 0 };
const rtsRay = new THREE.Raycaster(), rtsV = new THREE.Vector3(), rtsN = new THREE.Vector2();
const ownRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); ownRing.visible = false; ownRing.renderOrder = 8; scene.add(ownRing);
const pingRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); pingRing.renderOrder = 8; scene.add(pingRing); let pingT = 9;
const clampH = h => Math.max(28, Math.min(200, h));
function enterRts() { return; } // RTS overview removed: orders live on the Command wheel
function _enterRtsOld() {
  if (!playing || paused || round.over || rts.on) return;
  if (rts.possessed) releaseHelper();
  rts.on = true; const p = P[cur]; rts.x = rts.cx = p.x; rts.z = rts.cz = p.z; rts.ch = 14; rts.h = rts.h || 95;
  document.body.classList.add('rts'); $('bRts').classList.add('on'); syncPause(); input.sx = input.sy = 0;
  if (build.active) build.aim = { x: rts.x, z: rts.z };
  setSelection([], null); toast(isMobile ? '📣 Command · use the Command wheel to send helpers' : '📣 Command · use the Command wheel (or C) to send helpers', 2800);
}
function exitRts(quiet) {
  if (!rts.on) return; rts.on = false; setSelection([], null); boxHide(); rts.ptrs.clear();
  document.body.classList.remove('rts'); $('bRts').classList.remove('on'); build.aim = null; cam.swoop = 1.3; syncPause();
  if (!quiet) toast(`${SPECIES[cur].emoji} Back to your ${SPECIES[cur].name}`, 1800);
}
function toggleRts() { if (rts.on) exitRts(); else enterRts(); }
function possessHelper(h) {
  if (!h || !playing) return; if (h.visitor) { toast('⏳ Visitors help on their own for a little while'); return; } if (rts.possessed) releaseHelper();
  const s = h.sp, p = P[s];
  rts.saved = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, carried: p.carried, sp: s };
  p.x = h.x; p.z = h.z; p.y = Math.max(h.y, world.phys.floor(h.x, h.z, h.y + 2, 3).y); p.vx = p.vz = p.vy = 0; p.yaw = h.yaw; p.carried = Math.min(abOf(s).cap, Math.floor(h.carry)); p.goto = null;
  h.possessed = true; h.carry = 0; h.sel = false; rts.possessed = h;
  if (rts.on) exitRts(true);
  selectSpecies(s); cam.fx = p.x; cam.fz = p.z; cam.fy = p.y; cam.yaw = p.yaw; cam.swoop = 1.4;
  document.body.classList.add('possess'); buildTray(); toast(`🎮 You’re playing your ${SPECIES[s].name} helper · tap the bar to go back`, 3000);
}
function releaseHelper() {
  const h = rts.possessed; if (!h) return; const o = rts.saved, p = P[o.sp];
  h.x = p.x; h.z = p.z; h.y = p.y; h.yaw = p.yaw; h.carry = Math.min(h.cap, p.carried || 0); h.possessed = false; h.st = h.carry >= h.cap ? 'home' : 'seek'; h.timer = 0;
  p.x = o.x; p.y = o.y; p.z = o.z; p.yaw = o.yaw; p.carried = o.carried; p.vx = p.vz = p.vy = 0;
  rts.possessed = null; rts.saved = null; document.body.classList.remove('possess'); buildTray(); updateHud();
}
function setSelection(list, own) {
  for (const h of rts.sel) h.sel = false; rts.sel = list.filter(h => !h.possessed); for (const h of rts.sel) h.sel = true; rts.own = own || null; if (list.length || own) rts.bsel = null; rts.cardT = 0; renderSelCard();
}
function worldToScreen(x, y, z) { rtsV.set(x, y, z).project(camera); return { x: (rtsV.x + 1) / 2 * innerWidth, y: (1 - rtsV.y) / 2 * innerHeight, ok: rtsV.z < 1 }; }
function groundAt(sx, sy) {
  rtsN.set(sx / innerWidth * 2 - 1, 1 - sy / innerHeight * 2); rtsRay.setFromCamera(rtsN, camera); const o = rtsRay.ray.origin, d = rtsRay.ray.direction;
  if (d.y > -0.01) return { x: rts.x, z: rts.z }; let t = (o.y - 0) / -d.y;
  for (let i = 0; i < 6; i++) { const x = o.x + d.x * t, z = o.z + d.z * t; t = (o.y - Math.max(heightAt(x, z), -1.6)) / -d.y; }
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}
function pickUnit(sx, sy) {
  let best = null, bd = 38;
  for (const h of helpers.list) { if (h.possessed) continue; const q = worldToScreen(h.x, h.y + 1, h.z); const d = Math.hypot(q.x - sx, q.y - sy); if (q.ok && d < bd) { bd = d; best = { h }; } }
  for (const id of SPECIES_ORDER) { if (!swapOK() && id !== cur) continue; const p = P[id]; const q = worldToScreen(p.x, p.y + 1, p.z); const d = Math.hypot(q.x - sx, q.y - sy) + 4; if (q.ok && d < bd) { bd = d; best = { own: id }; } }
  return best;
}
function ping(x, z, col) { pingRing.position.set(x, Math.max(heightAt(x, z), -1.6) + 0.3, z); pingRing.material.color.set(col); pingT = 0; }
function rtsCommand(g) {
  const B = world.blooms; let depot = null, bloom = -1, bd = 5.5;
  for (const p of build.placed) if (p.type === 'storage' && Math.hypot(p.x - g.x, p.z - g.z) < 4.5) depot = { x: p.x, z: p.z, r: 3.2, name: 'Acorn Larder' };
  for (const id of SPECIES_ORDER) { const n = nests[id]; if (!depot && Math.hypot(n.x - g.x, n.z - g.z) < 8) depot = { x: n.x, z: n.z, r: 7.5, name: SPECIES[id].name + ' home' }; }
  if (!depot) B.query(g.x, g.z, 5.5, i => { const d = Math.hypot(B.x[i] - g.x, B.z[i] - g.z); if (d < bd) { bd = d; bloom = i; } });
  const n = rts.sel.length;
  if (n) {
    if (depot) { for (const h of rts.sel) helpers.command(h, 'depot', depot); ping(depot.x, depot.z, 0xffd27a); toast(`🧺 ${n > 1 ? n + ' helpers' : helpers.label(rts.sel[0])} will deliver to the ${depot.name}`, 2200); }
    else if (bloom >= 0) { for (const h of rts.sel) helpers.command(h, 'gather', g.x, g.z); ping(g.x, g.z, 0x7dffb0); toast(`🌼 Gather around here (each helper picks its own food)`, 2200); }
    else { for (const h of rts.sel) helpers.command(h, 'move', g.x, g.z); ping(g.x, g.z, 0xffffff); }
  }
  if (rts.own) { P[rts.own].goto = { x: g.x, z: g.z }; ping(g.x, g.z, 0xffd23f); }
  audio.blip(3); rts.cardT = 0;
}
function rtsTap(sx, sy, right, mouse) {
  const u = right ? null : pickUnit(sx, sy), g = groundAt(sx, sy), now = performance.now();
  if (u) {
    const same = rts.lastTapU && (u.h ? rts.lastTapU.h === u.h : rts.lastTapU.own === u.own) && now - rts.lastTapT < 380; rts.lastTapU = u; rts.lastTapT = now;
    if (same) { if (!swapOK()) { if (u.own === cur) exitRts(true); return; } if (u.h) possessHelper(u.h); else { exitRts(true); selectSpecies(u.own); } return; }
    if (u.h) { if (mouse && rts.shift) setSelection(rts.sel.includes(u.h) ? rts.sel.filter(q => q !== u.h) : [...rts.sel, u.h], null); else setSelection([u.h], null); } else setSelection([], u.own);
    audio.blip(2); return;
  }
  if (build.active && !build.hiring && !right) { build.aim = g; return; }
  if (!rts.sel.length && !rts.own) { const b = g && !right ? build.nearest(g.x, g.z, 3.5) : null; rts.bsel = b; rts.cardT = 0; renderSelCard(); if (b) { audio.blip(2); ping(b.x, b.z, 0xffd27a); } return; }
  if (mouse && !right) { setSelection([], null); return; }
  rtsCommand(g);
}
function boxShow(q) { const b = $('selBox'), x = Math.min(q.x0, q.x), y = Math.min(q.y0, q.y); b.style.cssText = `display:block;left:${x}px;top:${y}px;width:${Math.abs(q.x - q.x0)}px;height:${Math.abs(q.y - q.y0)}px`; }
function boxHide() { $('selBox').style.display = 'none'; }
function boxSelect(q) {
  const x0 = Math.min(q.x0, q.x), x1 = Math.max(q.x0, q.x), y0 = Math.min(q.y0, q.y), y1 = Math.max(q.y0, q.y);
  const got = helpers.list.filter(h => { if (h.possessed) return false; const s = worldToScreen(h.x, h.y + 1, h.z); return s.ok && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1; });
  setSelection(got, null); if (got.length) { audio.blip(2); toast(`🐾 ${got.length} helper${got.length > 1 ? 's' : ''} selected`, 1400); }
}
function panBy(dx, dy) { const wpp = 2 * rts.h * Math.tan(camera.fov * Math.PI / 360) / innerHeight; rts.x -= dx * wpp; rts.z -= dy * wpp; const r = Math.hypot(rts.x, rts.z), L = WORLD_R; if (r > L) { rts.x *= L / r; rts.z *= L / r; } }
{
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', e => {
    if (!rts.on || paused) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    const q = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, btn: e.button, mouse: e.pointerType === 'mouse', moved: false, box: false };
    rts.shift = e.shiftKey; rts.ptrs.set(e.pointerId, q);
    if (rts.ptrs.size === 2) { const [a, b] = [...rts.ptrs.values()]; rts.pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; rts.h0 = rts.h; for (const k of rts.ptrs.values()) { k.moved = true; k.box = false; clearTimeout(k.lp); } boxHide(); return; }
    if (q.mouse ? q.btn === 0 : rts.boxMode) q.box = true;
    else if (!q.mouse) q.lp = setTimeout(() => { if (!q.moved && rts.ptrs.get(e.pointerId) === q) { q.box = true; navigator.vibrate?.(12); } }, 420);
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') rts.mouse = { x: e.clientX, y: e.clientY };
    const q = rts.ptrs.get(e.pointerId); if (!rts.on || !q) return;
    const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY;
    if (!q.moved && Math.hypot(q.x - q.x0, q.y - q.y0) > 9) { q.moved = true; if (!q.box) clearTimeout(q.lp); }
    if (rts.ptrs.size >= 2) { const [a, b] = [...rts.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1; rts.h = clampH(rts.h0 * rts.pinch0 / d); panBy(dx / 2, dy / 2); return; }
    if (q.box) { if (q.moved) boxShow(q); return; }
    if (q.moved && (!q.mouse || q.btn !== 0)) panBy(dx, dy);
  });
  const up = e => {
    const q = rts.ptrs.get(e.pointerId); if (!q) return; rts.ptrs.delete(e.pointerId); clearTimeout(q.lp); if (!rts.on) return;
    if (q.box && q.moved) { boxSelect(q); boxHide(); return; } boxHide();
    if (q.moved || rts.ptrs.size > 0 || e.type === 'pointercancel') return;
    rtsTap(q.x, q.y, q.mouse && q.btn === 2, q.mouse);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (!rts.on) return; e.preventDefault(); rts.h = clampH(rts.h * (1 + Math.max(-0.3, Math.min(0.3, e.deltaY * 0.0012)))); }, { passive: false });
  cv.addEventListener('pointerleave', () => { rts.mouse = null; });
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); rts.keys[k] = true; if (k === 'c' && playing && !paused && !e.repeat && wheels) wheels.sticky('cmd'); });
  addEventListener('keyup', e => { rts.keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { rts.keys = {}; });
}
function rtsCamera(dt) {
  const k = 1 - Math.exp(-6 * dt); rts.cx += (rts.x - rts.cx) * k; rts.cz += (rts.z - rts.cz) * k; rts.ch += (rts.h - rts.ch) * (1 - Math.exp(-3 * dt));
  const gy = Math.max(-1.6, heightAt(rts.cx, rts.cz)), H = rts.ch;
  camera.position.set(rts.cx, gy + H, rts.cz + H * 0.42); tmpV.set(rts.cx, gy, rts.cz); camera.lookAt(tmpV);
  const fov = innerWidth / innerHeight < 1 ? 62 : 50; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = cam.fov = fov; camera.updateProjectionMatrix(); }
  scene.fog.near = Math.max(scene.fog.near, H * 1.4); scene.fog.far = Math.max(scene.fog.far, H * 3 + 120);
  cam.fx = rts.cx; cam.fz = rts.cz; cam.fy = gy;
}
function rtsUpdate(dt) {
  if (!rts.on) { rts.cardT -= dt; if (rts.cardT <= 0) { rts.cardT = 0.3; renderSelCard(); } }
  pingT += dt; pingRing.material.opacity = Math.max(0, 0.9 - pingT * 0.9); pingRing.scale.setScalar(1.5 + pingT * 4);
  const ow = rts.on && rts.own; ownRing.visible = !!ow; if (ow) { const p = P[rts.own], sz = SPECIES[rts.own].size; ownRing.position.set(p.x, Math.max(heightAt(p.x, p.z), -1.6) + 0.25, p.z); ownRing.scale.setScalar(sz * 0.9 + 0.8); }
  if (!rts.on) { $('possBar').classList.toggle('on', !!rts.possessed); return; }
  if (!paused) {
    const K = rts.keys, sp = rts.h * 0.9 * dt / (2 * rts.h * Math.tan(camera.fov * Math.PI / 360) / innerHeight);
    let px = (K['d'] || K['arrowright'] ? 1 : 0) - (K['a'] || K['arrowleft'] ? 1 : 0), pz = (K['s'] || K['arrowdown'] ? 1 : 0) - (K['w'] || K['arrowup'] ? 1 : 0);
    const m = rts.mouse; if (m && !rts.ptrs.size) { const E = 10; if (m.x < E) px = -1; else if (m.x > innerWidth - E) px = 1; if (m.y < E) pz = -1; else if (m.y > innerHeight - E) pz = 1; }
    if (px || pz) panBy(-px * sp, -pz * sp);
  }
  rts.cardT -= dt; if (rts.cardT <= 0) { rts.cardT = 0.25; renderSelCard(); }
}
let selKey = '';
function nearBuilding(r) { const p = P[cur]; let best = null, bd = r; for (const q of build.placed) { if (q.type === 'home') continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } } return best; }
function renderSelCard() {
  const c = $('selCard'); let html = '';
  if (rts.on && rts.sel.length === 1) { const h = rts.sel[0]; html = `<div class="pt">${SPECIES[h.sp].emoji}</div><div class="tx"><b>${SPECIES[h.sp].name} helper</b><small>${helpers.jobText(h)}</small><small>Carrying ${RES_ICON[h.res]} ${Math.floor(h.carry)}/${h.cap}${h.depot ? ' · to ' + h.depot.name : ''}</small></div>`; }
  else if (rts.on && rts.sel.length > 1) { const by = {}; for (const h of rts.sel) by[h.sp] = (by[h.sp] || 0) + 1; html = `<div class="pt">🐾</div><div class="tx"><b>${rts.sel.length} helpers</b><small>${Object.entries(by).map(([s, n]) => SPECIES[s].emoji + '×' + n).join(' ')}</small><small>Carrying ${rts.sel.reduce((a, h) => a + Math.floor(h.carry), 0)} things</small></div>`; }
  else if (rts.on && rts.own) { const p = P[rts.own]; html = `<div class="pt">${SPECIES[rts.own].emoji}</div><div class="tx"><b>Your ${SPECIES[rts.own].name}${rts.own === lead ? ' ★' : ''}</b><small>${p.goto ? 'Walking to a spot' : 'Resting'}</small><small>Carrying ${RES_ICON[RES_OF[rts.own]]} ${p.carried}/${abOf(rts.own).cap}</small></div>`; }
  if (html && rts.sel.length <= 1) { const id = rts.sel.length ? rts.sel[0].sp : rts.own; html += barsHtml(id); }
  const nb = playing && build && !build.active && !rts.on ? nearBuilding(4.5) : null; if (nb !== rts.dism) rts.dism = undefined; rts.bsel = nb && nb !== rts.dism ? nb : null; const bsel = rts.bsel;
  if (!html && bsel) { html = buildingCard(bsel); }
  else if (html) html += `<div class="bt">${swapOK() ? '<button data-a="ctl">🎮 Control</button>' : ''}${rts.sel.length ? '<button data-a="auto">🔄 Auto</button>' : ''}<button data-a="tech">🧬</button><button data-a="x">✕</button></div>`;
  const any = !!html;
  if (html !== selKey) { selKey = html; c.innerHTML = html; } c.classList.toggle('on', any);
}
$('selCard').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a; audio.blip(2);
  if (a === 'ctl') { if (rts.sel.length) possessHelper(rts.sel[0]); else if (rts.own) { const id = rts.own; exitRts(true); selectSpecies(id); } }
  else if (a === 'auto') { for (const h of rts.sel) helpers.command(h, 'auto'); toast('🔄 Back to gathering on their own', 1600); }
  else if (a === 'tech') openTech(rts.sel.length ? rts.sel[0].sp : rts.own);
  else if (a === 'up') { if (rts.bsel) build.upgrade(rts.bsel); selKey = ''; }
  else if (a === 'inv') { if (rts.bsel) helpers.invite(rts.bsel).then(() => { selKey = ''; updateRoundHud(true); }); selKey = ''; }
  else { setSelection([], null); rts.dism = rts.bsel; rts.bsel = null; } renderSelCard(); });
$('rsAll').onclick = () => { setSelection(helpers.list.slice(), null); toast(helpers.list.length ? `🐾 All ${helpers.list.length} helpers selected · tap where they should work` : '🐾 No helpers yet: 🔨 → 🐾 Hire', 2200); };
$('rsBox').onclick = () => { rts.boxMode = !rts.boxMode; $('rsBox').classList.toggle('on', rts.boxMode); toast(rts.boxMode ? '⬚ Drag to draw a selection box' : 'Drag to pan', 1400); };
$('rsPlay').onclick = () => exitRts();

$('possBar').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (playing && !paused) releaseHelper(); });

// ---------- boot ----------
async function boot() {
  resize();
  const nestInfo = SPECIES_ORDER.map(id => SPECIES[id].nest);
  setLoad(0.05, 'Loading creatures…'); await loadMany(NEEDED, p => setLoad(0.05 + p * 0.2));
  setLoad(0.3, 'Growing the meadow…');
  world = await buildWorld(scene, { quality: QUALITY, nests: nestInfo, renderer }); resize();
  setLoad(0.7, 'Waking the pollinators…');
  riders = await buildRiders(scene); gearFx = createGear(scene, riders); for (const id of SPECIES_ORDER) gearFx.set(id, save.gear[id].t); ambient = await buildAmbient(scene, world, QUALITY); groundAmb = buildGroundAmbient(scene, world, QUALITY);
  setLoad(0.85, 'Building nests…'); nests = await buildNests(scene);
  for (const id of SPECIES_ORDER) nests[id].set(save.units[id] || 0, false);
  meadow = await buildMeadow(scene, nests, save); state.meadow = meadow;
  for (const id of SPECIES_ORDER) { meadow.setUnits(id, nests[id].units, false); meadow.setStage(id, nests[id].stage); }
  // stars + moon
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) { const u = Math.random(), v = Math.random() * 0.9 + 0.1, th = u * 6.283, ph = Math.acos(v); sp[i * 3] = 560 * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = 560 * Math.cos(ph); sp[i * 3 + 2] = 560 * Math.sin(ph) * Math.sin(th); }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); stars.visible = false; scene.add(stars);
  moon = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: 0xf4f0d8, transparent: true, opacity: 0, fog: false, depthWrite: false })); moon.position.set(-250, 260, -380); moon.lookAt(0, 0, 0); moon.visible = false; scene.add(moon);
  fx = buildFx(); world.platforms.setCollected(save.dew); ringMesh = buildRing(); stamMesh = buildStamRing();
  for (const id of SPECIES_ORDER) {
    riders[id].visible = true; riders[id].rotation.order = 'YXZ';
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); sh.rotation.x = -Math.PI / 2; scene.add(sh); shadows[id] = sh;
    const mk = badge(SPECIES[id].emoji, 3.0); mk.visible = false; scene.add(mk); marks[id] = mk;
  }
  round = createRound(); round.reset(settings.len); round.onEnd = showResults;
  terr = await createTerritory(scene, { heightAt, nestPts: nestInfo.map(n => [n.x, n.z]), quality: QUALITY });
  tech = createTech({ round, toast, lead: () => lead, price: t => price(t), sfx: k => audio.sample(k, 0.4) }); tech.onChange = () => { for (const k in abCache) abCache[k] = null; if (techOpen) renderTech(); if (build && build.active) renderBTray(true); updateRoundHud(true); };
  build = await createBuild(scene, { territory: terr, heightAt, phys: world.phys, nests, SPECIES, round, fx, toast, audio, cur: () => cur, price: t => price(t), allowed: t => t === 'home' || (CATALOG[t] && CATALOG[t].sp === cur), spName: id => SPECIES[id] ? SPECIES[id].name : id, techBuilds: () => tech.g().builds, gardenMul: () => 1 + tech.g().garden });
  if (savedR) { if (savedR.lead && SPECIES[savedR.lead]) lead = savedR.lead; tech.restore(savedR.tech); round.restore(savedR); const rf = build.restore(savedR.build); if (rf) round.addRes('p', rf); }
  zones = createZones(scene, { phys: world.phys, heightAt, meadowHeightAt, setZoneHeight, toast: (a, b) => toast(a, b), audio, getP: () => P[cur], cur: () => cur, crewIds: () => crew ? crew.get() : [], parked: id => P[id], helpers: () => helpers ? helpers.list : [], addHeal: n => { if (valleySession) { healAmt = Math.min(1, healAmt + n); valley?.setHeal(valleySession.patchId, healAmt); updateHealUi(); } }, setNight: v => setNight(v, true) });
  helpers = createHelpers(scene, { world, heightAt, nests, round, territory: terr, fx, toast, build, adm, audio, tech: () => tech, price: t => price(t), night: () => night, onDeliver: (sp, amt) => bonusRes(sp, amt), spdMul: () => tiers ? tiers.helperMul() : 1, voice: (sp, v, g) => voice(sp, v, g), player: () => P[cur] });
  tiers = createTiers(scene, { heightAt, round, fx, toast, audio, build, helpers: () => helpers, player: () => P[cur], cur: () => cur, nests, terr,
    ping: (x, z, c) => ping(x, z, c || 0xc77dff), setNight: v => { if (curNight !== v) setNight(v); }, nocturnal: () => !!SPECIES[cur].nocturnal,
    deposit: () => nestCheck(P[cur], SPECIES[cur], state.sT || 0, true), gatherAt: r => gather(P[cur], SPECIES[cur], state.sT || 0, r, true, true),
    addStep: (x, y, z) => { world.solids.push({ type: 'cyl', x, z, r: 1.1, y0: y - 1, top: y + 1.4, kind: 'decor' }); fx.burst(x, y + 1, z, 10, 3); }, yaw: () => P[cur].yaw, onChange: () => updateRoundHud(true) });
  if (savedR && savedR.tiers) tiers.restore(savedR.tiers);
  hazards = await createHazards(scene, {
    onSnag: () => tiers && tiers.onSnag && tiers.onSnag(P[cur]),
    heightAt, phys: world.phys, nests, round, toast, audio, fx, terr,
    journal: (k, lab) => journalUnlock(k, lab),
    homeLv: () => build.homeLv,
    cap: () => abOf(cur).cap,
    onPickup: () => updateHud(),
    jumpPressed: () => input.jumpPressed || input.jump,
    actPressed: () => input.actPressed,
  });
  rivals = await createRivals(scene, {
    heightAt, phys: world.phys, nests, round, toast, audio, fx, terr, adm,
    onHud: () => updateHud(),
    worldToScreen, cur: () => cur, leadId: () => lead,
  });
  valley = createValley({ toast });
  crew = createCrew({
    valley,
    lead: () => lead,
    onSwap: (id) => {
      if (!playing || !swapOK()) return;
      selectSpecies(id);
      lead = id; // portrait lead follows active crew member in valley
      renderCrewDock();
      onb?.note?.('crewSwap');
      audio.sample?.('ui/select-pop', 0.35);
      toast(`${SPECIES[id].emoji} ${SPECIES[id].name}`, 900);
    },
  });
  crew.loadFromValley();
  contests = createContests({
    toast, audio, round, valley, crew,
    cur: () => cur,
    onContestWin: (bonus) => {
      if (!valleySession) return;
      healAmt = Math.min(1, healAmt + bonus);
      valley.setHeal(valleySession.patchId, healAmt);
      updateHealUi();
      audio.sample?.('contest/win-jingle', 0.55);
    },
  });
  packup = createPackUp({
    toast, audio, fx, round, build, valley,
    playBurst: playPackupBurst,
    valleySession: () => valleySession,
    heal: () => healAmt,
    worldToScreen,
    onPackStart: () => {
      document.body.classList.remove('packReady');
      onb?.note?.('packup');
      // loop bed while packing
      try {
        if (!window.__packLoop) {
          const el = new Audio((import.meta.env.BASE_URL || './') + 'audio/sfx/valley/packup-loop.ogg');
          el.loop = true; el.volume = 0.35; window.__packLoop = el;
        }
        window.__packLoop.currentTime = 0; window.__packLoop.play().catch(() => {});
      } catch (e) {}
    },
    onPackDone: () => {
      try { window.__packLoop && window.__packLoop.pause(); } catch (e) {}
      audio.sample?.('valley/packup-done-chime', 0.55);
      audio.sample?.('valley/patch-complete-wild', 0.6);
      endValleyPatchWild();
    },
  });

  items = createItems({ save, persist, toast, audio, onHud: () => updateHud() });
  onb = createOnboarding({ save, persist, toast, audio, hasBests: () => Object.keys(bests()).length > 0 || Object.keys(save.journal || {}).length > 0, round: () => round });
  goals = createGoals({
    round, toast, audio,
    terr: () => terr, techCount: () => tech.count(),
    homeLv: () => build.homeLv[lead] || 1,
    nestStage: () => nests[lead]?.stage || 0,
    journalN: () => Object.keys(save.journal || {}).length,
    lead: () => lead,
    giveJumbo: n => items.give('jumbo', n),
    activateJumbo: () => { if (items && items.count('jumbo') > 0) items.useJumbo(); },
    grantBurst: (n = 14) => {
      const keys = ['n', 'f', 'w', 'h'];
      const each = Math.max(4, Math.round(n / 2));
      for (const k of keys) round.addRes(k, each);
      toast(`📦 Resource burst! +${each} ${keys.map(k => RES_ICON[k]).join('')}`, 2800);
      updateRoundHud?.(true); updateHud?.();
    },
    grantHelper: async () => {
      if (!helpers) return null;
      if (helpers.perm() >= helpers.max()) {
        toast('🐾 Crew full — helper gift becomes a resource burst', 2600);
        for (const k of ['n', 'f', 'w', 'h']) round.addRes(k, 10);
        updateRoundHud?.(true); return null;
      }
      const opts = HIRE_ORDER.filter(s => s !== lead);
      const sp = opts[(Math.random() * opts.length) | 0] || HIRE_ORDER[0];
      const p = P[cur] || nests[lead];
      const a = Math.random() * 6.28;
      const h = await helpers.spawnFree(sp, (p?.x || 0) + Math.cos(a) * 5, (p?.z || 0) + Math.sin(a) * 5);
      buildTray(); updateRoundHud?.(true);
      return h;
    },
    grantVisitor: async () => {
      if (!helpers) return null;
      const pool = ['butterfly', 'hummingbird', 'bee', 'robin', 'raccoon', 'opossum'];
      const sp = pool[(Math.random() * pool.length) | 0];
      const p = P[cur] || nests[lead];
      const h = await helpers.grantVisitor(sp, p, round.mode === 'relaxed' || round.free ? 100 : 85);
      if (!h) {
        toast('🎟️ Crew full — visitor gift becomes a resource burst', 2600);
        for (const k of ['n', 'f', 'w', 'h']) round.addRes(k, 8);
      }
      buildTray(); updateRoundHud?.(true); return h;
    },
    grantLooks: (n = 1) => { if (looks) looks.grantPlay?.(n); },
    grantHat: (id) => { if (looks) looks.grantPlay?.(1); /* cosmetic hat ids unlock via looks play stars for now */ toast(id ? `👒 Style progress toward ${id}` : '✨ Looks unlock!', 2200); },
    onGoalReward: (def, reward) => { if (looks) looks.grantPlay?.(1); },
  });
  looks = createCosmetics({
    save, persist, toast, audio, fx, bests,
    rider: () => riders[cur],
    player: () => P[cur],
  });
  looks.apply(riders[cur]);

  if (savedR && savedR.helpers) await helpers.restore(savedR.helpers);
  const E = { world, heightAt, P, roundDone, SPECIES, save, persist, fx, audio, toast, camera, night: () => night, updateHud,
    stickCost: () => abOf('opossum').fx.build ? 1 : 2,
    reward(id, def, first) { if (round.running) { round.add('team', first ? 150 : 60); if (first) round.stats.pages++; } const z = coop && coop.puzzles.find(q => q.def.id === id); z && meadow.bloomPuzzle(z.S.id, true); audio.music.jingle('clear'); refreshJournalBadge(); $('bJournal').classList.add('pulse'); },
    onJournal(pz) { refreshJournalBadge(); renderJournal && $('journal').classList.contains('on') && renderJournal(); } };
  coop = FEATURES.teamFoods ? buildCoop(scene, E) : { puzzles: [], update() {}, onAction() { return false; }, tryPush() {}, suggestion() { return null; } };
  if (!FEATURES.teamFoods) { const b0 = document.querySelector('#jTabs button[data-t="0"]'); if (b0) b0.style.display = 'none'; } state.E = E; refreshJournalBadge();
  for (const z of coop.puzzles) if (z.done) meadow.bloomPuzzle(z.S.id, false);
  for (const id of SPECIES_ORDER) { const U = riders[id].userData; if (!SPECIES[id].ground && U.box) U.body.position.y = -U.box.min.y; }
  babies = buildBabies(scene, riders, nests); babies.sync(); if (babies.list.length) { save.journal['m:baby'] = save.journal['m:baby'] || { t: Date.now() }; }
  selectSpecies(SPECIES.hasOwnProperty(save.species) ? save.species : 'bee', true);
  weather = buildWeather(scene);
  if (SPECIES[cur].nocturnal !== (nightOf(clock.t) > 0.5)) setNight(SPECIES[cur].nocturnal, true);
  curNight = nightOf(clock.t) > 0.5; $('bNight').textContent = curNight ? '☀️ Switch to day' : '🌙 Switch to night'; $('bSeason').textContent = SEASON_INFO[clock.season].emoji + ' Season: ' + SEASON_INFO[clock.season].name; night = nightOf(clock.t); updateNight(0.01);
  state.musicLive = true; setLoad(1, 'Ready'); $('load').style.opacity = 0; setTimeout(() => $('load').remove(), 700);
  buildCards(); loop(performance.now());
  buildLens(); refreshTitle(); syncMixUi(); $('sMute').checked = !!settings.mute; applyMix(); audio.setMute(settings.mute);
  const X = { round, terr, build, adm, rivals, goals, onb, items, looks, save, get weather() { return weather; },
    endRound: () => { if (playing && !round.over) round.finish(); }, restartRound: () => startNew(round.len),
    clearTerritory: () => { build.clear(); tiers && tiers.reset(); terr.resetBlooms(); terr.refresh(); renderBTray(true); },
    growMax: () => { for (const q of build.placed || []) if ((q.type === 'outpost' || q.type === 'marker')) terr.grow(q.id, 99); },
    freeAtFeet: type => { const p = P[cur]; build.free_place(type, p.x, p.z, cam.yaw); renderBTray(true); },
    maxHomes: () => { for (const id of SPECIES_ORDER) { build.homeLv[id] = 3; build.rebuildHome(id); } build.refreshHomes(); renderBTray(true); },
    tpHome: () => { const n = nests[cur]; X.tp(n.x + 7, n.z + 4); }, tp: (x, z) => { const p = P[cur]; p.x = x; p.z = z; p.y = world.phys.floor(x, z, 99, 99).y + 1.5; p.vx = p.vz = p.vy = 0; cam.fx = x; cam.fz = z; },
    puzzleList: () => coop.puzzles.map(z => `${z.def.icon || ''} ${z.def.name}`), tpPuzzle: i => { const z = coop.puzzles[i]; if (z) X.tp(z.hintPos.x, z.hintPos.z); },
    fillBag: () => { const p = P[cur]; p.carried = abOf(cur).cap; updateHud(); },
    gear: on => { for (const id of SPECIES_ORDER) gearSet(id, on ? [3, 3, 3] : [0, 0, 0]); persist(); updateHud(); },
    bank: n => { for (const id of SPECIES_ORDER) save.gear[id].bank += n; persist(); updateHud(); },
    unlockJournal: () => { for (const q of SPECIAL) save.journal[q.id] = save.journal[q.id] || { t: Date.now() }; for (const id of SPECIES_ORDER) save.journal['a:' + id] = save.journal['a:' + id] || { t: Date.now() }; for (const m of MOMENTS) save.journal['m:' + m.id] = save.journal['m:' + m.id] || { t: Date.now() }; persist(); refreshJournalBadge(); },
    nextSeason: () => clock.nextSeason(), isNight: () => curNight, setNight: v => setNight(v, true),
    perfText: () => { const i = renderer.info; return `${state.fps || 0} fps · ${i.render.calls} calls · ${(i.render.triangles / 1000).toFixed(0)}k tris · ${i.memory.geometries} geo · ${i.memory.textures} tex · sim ${simT.toFixed(0)}s`; },
    wipeSave, helpers,
    spawnHelper: sp => { const p = P[cur]; return helpers.spawnFree(sp, p.x + 3, p.z + 3).then(() => { buildTray(); renderBTray(true); }); },
    freePlay: () => !!(round && round.free), setFree: v => enterFree(v),
    hireFree: v => { helpers.free = v; }, clearHelpers: () => { releaseHelper(); helpers.clear(); buildTray(); },
    trainHelpers: () => { const f = helpers.free; helpers.free = true; helpers.train(); helpers.free = f; }, toggleRts: () => toggleRts(),
    tech, openTech: () => openTech(lead), speciesList: () => SPECIES_ORDER.map(id => `${SPECIES[id].emoji} ${SPECIES[id].name}${id === lead ? ' ★' : ''}`), setLead: i => setLead(SPECIES_ORDER[i]), leadText: () => `${SPECIES[lead].emoji} ${SPECIES[lead].name} (pays ${payIcons(lead)})`, statsTable };
  admin = createAdmin(X);
  if (/[?&]admin=1/.test(location.search)) admin.showButton(true);
  if (NEWFLAG) {
    if (NEWFLAG.lead && SPECIES[NEWFLAG.lead]) settings.lead = NEWFLAG.lead;
    if (NEWFLAG.mode) settings.mode = NEWFLAG.mode;
    saveSettings(settings);
    lead = settings.lead && SPECIES[settings.lead] ? settings.lead : lead;
  }
  setLead(lead, true);
  if (pendingStart) {
    const p = pendingStart; pendingStart = null;
    startNew(p.len);
  } else if (NEWFLAG && NEWFLAG.patch && valley) { const pid = NEWFLAG.patch; if (valley.get(pid)?.state === 'wilted') valley.setState(pid, 'in_progress'); startValleyPatch(pid); } else if (NEWFLAG) startNew(NEWFLAG.len || settings.len);
  window.__game = { get tiers() { return tiers; }, startValleyPatch, get crew() { return crew; }, get zones() { return zones; }, get valley() { return valley; }, get healAmt() { return healAmt; }, get riders() { return riders; }, get wheels() { return wheels; }, get homeInd() { return homeInd; }, openHub, settings, audio, enterFree, fp, get freePlay() { return !!round.free; }, mix: { get: mixGet, sync: syncMixUi }, tech, get lead() { return lead; }, setLead, price, priceFor, buildInfo, openTech, closeTech, get techOpen() { return techOpen; }, ARCH, TREES, openPick, statsTable, updateInfoCard, renderSelCard, helpers, hazards, rivals, goals, onb, items, looks, rts, enterRts, exitRts, toggleRts, possessHelper, releaseHelper, rtsTap, worldToScreen, setTrayMode, get cur() { return cur; }, THREE, cam, gearFx, gearSet, buyGear, openShop, closeShop, gearSave: () => save.gear, riders, SPECIES, clock, weather, babies, SU, meadow, ringMesh, abOf, ABILITIES, stepN(n, dt = 1 / 60) { for (let i = 0; i < n; i++) { state.sT = (state.sT || 0) + dt; simT += dt; worldTick(dt, state.sT); frameSim(dt, state.sT, simT); updateNight(dt); if (build.active) build.updateGhost(P[cur], cam.yaw, state.sT); } }, camStep(n = 30, dt = 1 / 30) { for (let i = 0; i < n; i++) { updateCamera(dt); if (build.active) updateBuildUi(dt, state.sT || 0); } }, round, terr, build, admin, adm, startNew, setBuild, toggleBuild, openPause, showResults, refreshTitle, X, get simT() { return simT; }, coop, music: audio.music, SPECIAL, swap: swapNext, openJournal, closeJournal, shadows, marks, stepParked, get guide() { return guide; }, scene, camera, renderer, world, P, nests, ambient, state, select: selectSpecies, setNight, input, cam, get cur() { return cur; }, get playing() { return playing; }, play: () => $('play').click(),
    tp: (x, z, up = 0) => { const p = P[cur]; p.x = x; p.z = z; p.y = world.phys.floor(x, z, 99, 99).y + up; p.vx = p.vz = p.vy = 0; },
    teleportNearFlower: () => { const B = world.blooms; const arr = B.byPol[polOf(cur)]; const i = arr[0]; const p = P[cur]; p.x = B.x[i] - 1; p.z = B.z[i]; p.y = Math.max(heightAt(p.x, p.z), B.y[i] - 0.5); p.vy = 0; } };
}

let last = performance.now(), fpsAcc = 0, fpsN = 0;
// ---------- t31u / F / G: radial control wheels, tabbed menu, 3D home pointer ----------

// asset layer: swap emoji for delivered UI icons (assets/ui/icons/<name>.png) once the manifest loads
function applyIcons() {
  const put = (el, names) => { const u = iconUrl(names, true); if (!el || !u) return; const sp = el.querySelector('span') || el; if (sp.dataset.ico === u) return; sp.dataset.ico = u; sp.innerHTML = `<img class="ico" src="${u}" alt="" draggable="false">`; };
  put($('bBuild'), ['wheel-build', 'build']); put($('bRts'), ['wheel-command', 'command']); put($('bInt'), ['wheel-interact', 'interact']); put($('bJump'), ['wheel-jump', 'jump']); put($('bPause'), ['menu', 'tab-menu']);
  put($('bAct'), [`wheel-act-${cur}`, 'wheel-act', 'act']);
  for (const b of document.querySelectorAll('#hubTabs button')) { const k = { inv: 'inventory' }[b.dataset.tab] || b.dataset.tab, u = iconUrl([k, `tab-${k}`]); if (u && !b.querySelector('img')) b.innerHTML = `<img class="ico" src="${u}" alt="" draggable="false"> ${b.textContent.replace(/^[^A-Za-z]+/, '')}`; }
}
onAssets(applyIcons);
const BUILD_IK = { outpost: 'beacon', marker: 'marker', garden: 'patch', storage: 'larder', bridge: 'bridge', home: 'home', apiary: 'apiary', honeycave: 'cave', woodpile: 'woodpile', wormfarm: 'farm', roost: 'roost', stashden: 'stashden' };
let wheels = null, hubTab = 'game', homeInd = null, pingHomeT = 0;
function openHub(tab = 'game') {
  if (!playing || round.over) return; if (build && build.active) setBuild(false); if (rts.on) exitRts();
  if (!$('pause').classList.contains('on')) openPause(); hubSet(tab);
}
function hubSet(tab) { if (hubTab !== tab) audio.sample('ui/menu-tab', 0.35);
  if (tab === 'tech') { closeOv('pause'); openTech(lead); return; } if (tab === 'journal') { openJournal(); return; } if (tab === 'settings') { openOv('settings'); return; }
  hubTab = tab; document.querySelectorAll('#hubTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('tpGame').classList.toggle('on', tab === 'game'); $('tpAnimals').classList.toggle('on', tab === 'animals'); $('tpInv').classList.toggle('on', tab === 'inv');
  if (tab === 'animals') renderAnimals(); if (tab === 'inv') renderInv();
}
$('hubTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; audio.blip(2); hubSet(b.dataset.tab); });
$('hubResume').onclick = () => closeOv('pause');
function inviteNear() {
  const p = P[cur]; let best = null, bd = 1e9; for (const q of build.placed) { if (!helpers.visitorOf(q)) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
  if (!best) { toast('🎟️ Upgrade a building to Lv2 so a visitor can come', 2200); return; }
  const w = helpers.visitWhy(best); if (w) { toast('🎟️ ' + w, 2000); return; } helpers.invite(best).then(() => updateRoundHud(true));
}

function canSendLoadHome() {
  const p = P[cur];
  if (!helpers || !p || !(p.carried > 0)) return { ok: false, why: 'Gather something first' };
  const h = helpers.pickCourier(p.x, p.z);
  if (!h) return { ok: false, why: 'Hire a helper to carry for you' };
  return { ok: true, h, amt: p.carried };
}
function sendLoadHome() {
  const gate = canSendLoadHome();
  if (!gate.ok) { toast('🏠 ' + gate.why, 2200); return false; }
  const p = P[cur], n = nests[cur] || nests[lead] || Object.values(nests)[0];
  if (!n) { toast('🏠 No nest to deliver to', 2000); return false; }
  const amt = Math.floor(p.carried);
  const depot = { x: n.x, z: n.z, r: 7.5, name: (SPECIES[cur]?.nest?.name || 'home') };
  if (!helpers.sendCourier(gate.h, amt, depot, 'p')) { toast('🏠 Could not send a helper', 2000); return false; }
  p.carried = 0;
  updateHud(); updateRoundHud?.(true);
  const sp = SPECIES[gate.h.sp];
  ping(p.x, p.z, 0xffd27a); audio.blip(3);
  toast(`${sp.emoji} Taking your ${amt} home — you keep exploring!`, 2600);
  return true;
}
function helperCmd(kind) {
  if (tiers) tiers.ordered && tiers.ordered();
  const hl = helpers ? helpers.list.filter(h => !h.possessed) : []; if (!hl.length) { toast('🐾 No helpers yet · hire some from 📣 Command or the 🐾 Animals menu', 2600); return; }
  const p = P[cur], n = nests[cur];
  for (const h of hl) { if (kind === 'follow') helpers.command(h, 'follow'); else if (kind === 'gather') helpers.command(h, 'gather', p.x, p.z); else if (kind === 'home') helpers.command(h, 'depot', { x: n.x, z: n.z, r: 7.5, name: SPECIES[cur].name + ' home' }); else if (kind === 'stay') helpers.command(h, 'stay'); else helpers.command(h, 'auto'); }
  ping(p.x, p.z, kind === 'gather' ? 0x7dffb0 : kind === 'home' ? 0xffd27a : 0xffffff); audio.blip(3);
  toast({ follow: '🧲 Helpers: follow you', gather: '🌼 Helpers: gather around here', home: '🏠 Helpers: deliver home', stay: '💤 Helpers: stay here', auto: '🔄 Helpers: work on their own' }[kind], 1800);
  if (hubTab === 'animals' && $('pause').classList.contains('on')) renderAnimals();
}
function renderAnimals() {
  const hl = helpers ? helpers.list : [], sp = SPECIES[cur];
  let h = `<h2>🐾 Your ${sp.name} colony</h2><p style="font-size:13px;margin:0 0 6px">You lead the ${sp.emoji} ${sp.name} this round. Helpers gather on their own; give orders from 📣 Command.</p>`;
  h += hl.length ? hl.map((q, i) => q.visitor ? `<div class="al vis"><span class="em">${SPECIES[q.sp].emoji}</span><div class="tx"><b>⏳ ${SPECIES[q.sp].name} visitor</b><small>${helpers.jobText(q)} · ${helpers.timeLeft(q)}s left · brought ${q.visitor.units}</small></div><button data-i="${i}" data-k="follow">🧲</button><button data-i="${i}" data-k="home">🏠</button></div>` : `<div class="al"><span class="em">${SPECIES[q.sp].emoji}</span><div class="tx"><b>${SPECIES[q.sp].name} helper</b><small>${helpers.jobText(q)} · carrying ${Math.round(q.carry)}/${q.cap}</small></div><button data-i="${i}" data-k="follow">🧲</button><button data-i="${i}" data-k="home">🏠</button>${swapOK() ? `<button data-i="${i}" data-k="poss">🎮</button>` : ''}</div>`).join('') : '<p style="opacity:.8">No helpers hired yet.</p>';
  h += `<div class="arow"><button class="abtn" data-c="hire">🐾 Hire helpers (${helpers ? helpers.perm() : 0}/${helpers ? helpers.max() : 0})</button>${swapOK() ? '<button class="abtn" data-c="swap">⇄ Switch creature (admin)</button>' : ''}</div>`;
  $('tpAnimals').innerHTML = h;
}
$('tpAnimals').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; audio.blip(2);
  if (b.dataset.c === 'hire') { closeOv('pause'); setBuild(true); if (build.active) setTrayMode('hire'); return; }
  if (b.dataset.c === 'swap') { closeOv('pause'); openMenu(); return; }
  if (b.dataset.c) return helperCmd(b.dataset.c);
  if (b.dataset.v) { const p = build.placed.find(q => String(q.id) === b.dataset.v); if (p) helpers.invite(p).then(() => renderAnimals()); return; }
  const q = helpers.list[+b.dataset.i]; if (!q) return; const p = P[cur], n = nests[cur];
  if (b.dataset.k === 'follow') helpers.command(q, 'follow'); else if (b.dataset.k === 'home') helpers.command(q, 'depot', { x: n.x, z: n.z, r: 7.5, name: 'home' }); else if (b.dataset.k === 'poss') { closeOv('pause'); possessHelper(q); return; }
  renderAnimals();
});
function renderInv() {
  const g = save.gear[cur], sp = SPECIES[cur];
  $('tpInv').innerHTML = `<h2>🎒 Inventory</h2><div class="al"><span class="em">🛠️</span><div class="tx"><b>${sp.name} gear</b><small>${gearLine(cur)} · bank ${Math.floor(g.bank || 0)}</small></div><button data-x="shop">Workbench</button></div>
    <div class="al"><span class="em">🧪</span><div class="tx"><b>Consumables</b><small>Jumbo Basket from goals · open Looks for free colours & emotes.</small></div></div>
    <p style="font-size:12px;opacity:.8">Gear is upgraded at your home's workbench (walk home, then 🤝 Interact).</p>
    <button class="abtn" data-c="looks">🎨 Looks &amp; Emotes (earned free)</button>`;
}
$('tpInv').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.x === 'shop') { closeOv('pause'); openShop(); } if (b.dataset.c === 'looks') { closeOv('pause'); looks && looks.openPanel(); } });
function depositNow() {
  const n = nests[cur], p = P[cur], sp = SPECIES[cur];
  if (!n || !p) return;
  if (p.carried <= 0) { toast('Nothing to deliver yet — gather some flowers first!', 2000); return; }
  if (Math.hypot(p.x - n.x, p.z - n.z) > 12) { toast(`${sp.nest.emoji} Get closer to your ${sp.nest.name} to deliver`, 2200); return; }
  // Force a deposit by nudging nestCheck path
  const t = performance.now() / 1000;
  nestCheck(p, sp, t);
  if (p.carried > 0) toast('Move a little closer to the nest entrance', 1800);
}
function wheelOpts() {
  const sp = SPECIES[cur];
  const whyToast = w => toast('🔒 ' + w, 1600);
  return {
    act: { el: 'bAct', enabled: () => playing && !paused, why: whyToast, options: () => [
      { icon: sp.actEmoji, ik: sp.mv && sp.mv.fly ? ['fly','ability'] : 'ability', label: sp.actName, on: () => { input.actPressed = true; } },
      { icon: '📍', ik: 'show-home', label: 'Show home', on: () => { pingHomeT = 6; toast(`${sp.nest.emoji} Pointing home for a few seconds`, 1500); } },
      { icon: '🎥', ik: 'overview-x', label: 'Reset view', on: () => { cam.yaw = P[cur].yaw; cam.pitch = 0.35; } },
      { icon: '🧺', ik: 'quick-item', label: items && items.count('jumbo') ? `Jumbo ×${items.count('jumbo')}` : 'Jumbo Basket', dis: !(items && items.count('jumbo')), why: 'Earn from goals', on: () => items && items.useJumbo() },
      { icon: '🎨', ik: 'looks', label: 'Looks', on: () => looks && looks.openPanel() },
    ] },
    build: { el: 'bBuild', enabled: () => playing && !paused, tap: () => toggleBuild(), options: () => {
      const L = ['home', ...BUILDS_OF(cur)].map(t => ({ icon: CATALOG[t].icon, ik: BUILD_IK[t], label: t === 'home' ? 'Home' : CATALOG[t].name.split(' ').slice(-1)[0], on: () => pickAndPlaceBuilding(t) }));
      return [...L, { icon: '🧬', ik: 'tech', label: 'Tech tree', on: () => openTech(lead) }];
    } },
    cmd: { el: 'bRts', enabled: () => playing && !paused, tapOpen: true, options: () => {
      const courier = canSendLoadHome();
      return [
      { icon: '💪', ik: 'assign', label: 'Help lift', on: () => tiers && tiers.sendHelpers() },
      ...(tiers && tiers.swarmReady && tiers.swarmReady() ? [{ icon: '👑', ik: 'gather-here', label: 'Swarm Call', on: () => tiers.swarm() }] : []),
      { icon: '🎟️', ik: 'assign', label: 'Invite visitor', on: () => inviteNear() },
      { icon: '📦', ik: 'return-home', label: 'Take these home', dis: !courier.ok, why: courier.why || 'Need a helper + carried goods', on: () => sendLoadHome() },
      { icon: '🧲', ik: 'follow', label: 'Follow me', on: () => helperCmd('follow') },
      { icon: '🌼', ik: 'gather-here', label: 'Gather here', on: () => helperCmd('gather') },
      { icon: '🏠', ik: 'return-home', label: 'Home drop', on: () => helperCmd('home') },
      { icon: '🐾', ik: 'assign', label: 'Hire', on: () => { setBuild(true); if (build.active) setTrayMode('hire'); } },
      { icon: '📋', ik: 'animals', label: 'Animals', on: () => openHub('animals') },
    ]; } },
    int: { el: 'bInt', enabled: () => playing && !paused, tap: () => interactTap(), why: whyToast, options: () => {
      const p = P[cur], opts = [];
      const home = nearHome();
      const ctxR = (rivals && rivals.context) ? rivals.context(p) : {};
      // Home context
      if (home) {
        opts.push({ icon: '🛠️', ik: 'tool', label: 'Workbench', on: () => openShop() });
        if (p.carried > 0) opts.push({ icon: '🏠', ik: 'return-home', label: 'Deliver', on: () => depositNow() });
      } else {
        opts.push({ icon: '🛠️', ik: 'tool', label: 'Workbench', dis: true, why: 'Head home for the workbench', on: () => {} });
      }
      // Neighbor contests supersede Peekaboo / Snack Swipe / Flower Flag / rival Tidy Up on this branch
      if (packup && packup.active) opts.push({ icon: '📦', ik: 'packup', label: 'Pack building', on: () => packup.tap(p) });
      else if (packup && packup.canStart()) opts.push({ icon: '📦', ik: 'packup', label: 'Pack Up', on: () => packup.begin() });
      if (contests && !contests.active && valleySession) opts.push({ icon: '🏅', ik: 'contest', label: 'Ask contest', on: () => {
        const def = valley?.def(valleySession.patchId); contests.forceInvite(def);
      } });
      // Emotes (always on Interact wheel; locked ones clearly disabled)
      for (const e of EMOTES) {
        const locked = !(looks && looks.hasEmote && looks.hasEmote(e.id));
        opts.push({ icon: e.icon, ik: 'emote-' + e.id, label: e.name, dis: locked, why: 'Earn more stars to unlock', on: () => looks && looks.emote(e.id) });
      }
      opts.push(
        { icon: '🎒', ik: 'inventory', label: 'Inventory', on: () => openHub('inv') },
        { icon: '📖', ik: 'journal', label: 'Journal', on: () => openJournal() },
        { icon: '☰', ik: 'menu', label: 'Menu', on: () => openHub('game') },
      );
      return opts;
    } },
  };
}
function interactTap() {
  const p = P[cur];
  if (packup && packup.active) { packup.tap(p); return; }
  if (nearHome() && p.carried > 0) { depositNow(); return; }
  if (nearHome()) return openShop();
  if (packup && packup.canStart()) { packup.begin(); return; }
  toast(`🤝 Nothing to interact with here · your ${SPECIES[cur].nest.name} workbench is at home`, 2200);
}
function initWheels() {
  const d = wheelOpts(); const defs = {};
  for (const k in d) defs[k] = { ...d[k], options: () => wheelOpts()[k].options() };
  wheels = createWheels({ defs, onOpen: () => document.body.classList.add('wheelOn'), onClose: () => document.body.classList.remove('wheelOn'), sound: k => audio.sample({ open: 'ui/wheel-open-whoosh', hi: 'ui/highlight-tick', pick: 'ui/select-pop', cancel: 'ui/cancel', err: 'ui/error-bonk' }[k], k === 'hi' ? 0.3 : 0.45) });
}
initWheels();
// settings: home pointer style
function syncInd() { document.querySelectorAll('#indOpt button').forEach(b => b.classList.toggle('on', b.dataset.v === (settings.ind || 'ring'))); }
$('indOpt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; settings.ind = b.dataset.v; saveSettings(settings); syncInd(); audio.blip(2); });
syncInd();
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; const t = now / 1000; timeU.value = t;
  const dt = playing && !paused ? rdt * adm.game * (wheels && wheels.open ? 0.3 : 1) : rdt; simT += dt;
  fpsAcc += dt; fpsN++; if (fpsAcc > 1) { state.fps = Math.round(fpsN / fpsAcc); fpsAcc = fpsN = 0; }
  updateNight(dt);
  updateFlaps(t);
  if (!paused || !playing) { const n = Math.max(1, Math.ceil(dt / 0.034)), h = dt / n; for (let i = 0; i < n; i++) worldTick(h, t); marks[cur].visible = false; }
  frameSim(dt, simT, simT);
  state.mT = (state.mT || 0) - dt; if (state.mT <= 0) { state.mT = 0.4; updateMusic(t); }
  if (playing && !paused) updateTip(dt, t); else if (!playing || paused) $('coopTip').classList.remove('on');
  world.platforms.update(t); world.food.update(t); groundAmb.update(dt, t);
  for (const id of SPECIES_ORDER) nests[id].update(dt, t, id === cur && P[id].carried > 0);
  if (playing && !paused) { weather.update(dt, t, { season: clock.season, hour: clock.t * 24, night, cam: camera.position }); while (weather.events.length) { const e = weather.events.pop(); journalUnlock('m:' + e, MOMENTS.find(m => m.id === e).name); } }
  babies.update(dt, t, night);
  ambient.update(dt, t, night); meadow.update(dt, t, camera.position, night, 1 + 1.4 * weather.v.rain + 0.6 * weather.v.snow); updateDrift();
  // respawn sparkles
  state.sparkAcc = (state.sparkAcc || 0) + dt; if (state.sparkAcc > 0.5) { state.sparkAcc = 0; const B = world.blooms, bit = 1 << POLS.indexOf(polOf(cur)); for (const i of B.byPol[polOf(cur)]) if (B.readyAt[i] > 0 && B.readyAt[i] <= t && !world.sparkle.isOn(i)) world.sparkle.set(i, true); }
  state.pT = (state.pT || 0) - dt; if (state.pT <= 0 && playing) { state.pT = 3; persist(); }
  { const AB = abOf(cur), pp = P[cur]; gearFx.update(dt, t, cur, paused ? 0 : Math.min(1, (pp.speed || 0) / AB.mv.run), shopOpen ? 0.65 : Math.min(1, pp.carried / AB.cap)); }
  if (shopOpen) { shopT += dt; cam.yaw = shopBase + Math.sin(shopT * 0.55) * 0.95; }
  state.gT = (state.gT || 0) - dt; if (state.gT <= 0) { state.gT = 0.4; updateShopChip(); }
  fx.update(dt); if (playing) rtsUpdate(rdt); updateCamera(rdt); if (build.active) updateBuildUi(rdt, t);
  state.hT = (state.hT || 0) - rdt; if (state.hT <= 0) { state.hT = 0.2; if (playing) updateRoundHud(); }
  state.rT = (state.rT || 0) - rdt; if (state.rT <= 0 && playing) { state.rT = 3; saveRound(); }
  if (admin) admin.update(rdt);
  if (playing && !paused) updateArrow(dt, t); else if (!playing && homeInd) homeInd.hide();
  world.water.position.y = -1.6 + Math.sin(t * 0.8) * 0.03;
  renderer.render(scene, camera);
}
boot().catch(e => { console.error('boot failed', e); $('loadTxt').textContent = 'Failed to load: ' + e.message; });
