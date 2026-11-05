// Distinct, recognisable flight patterns for each flyer. Hold Jump in the air to flap (stamina-limited bursts), release to glide / fall.
//  bee        direct purposeful lines, holds still (hover) when you let go of the stick
//  butterfly  erratic up-down flutter with long soft glides, drifting sideways a little
//  moth       loopy spirals, gently drawn toward lights
//  hummingbird instant hover, sharp darts (action button), flies backwards
//  bat        swooping arcs: flap to climb, release to dive; never stops, banks sharply
//  robin      flap-and-glide bounding: short undulating hops
//  bumblebee  heavy, wobbly bumbling: slow, sags between flaps, rolls side to side
export const PAT = { bee: 'line', butterfly: 'flutter', moth: 'spiral', hummingbird: 'hover', bat: 'swoop', robin: 'bound', bumblebee: 'bumble' };
export const PAT_NAME = { bee: 'Direct lines · hover at flowers', butterfly: 'Fluttering glides', moth: 'Loopy spirals · loves lights', hummingbird: 'Hover · darts · backwards', bat: 'Swooping arcs · never stops', robin: 'Flap-and-glide hops', bumblebee: 'Heavy bumbling · sags & wobbles' };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const TAU = Math.PI * 2;

/**
 * Runs the flight model for one frame. S = { flapping, press, mag, dx, dz, dt, t, light, speedFrac }
 * (dx,dz = desired world direction, unit). Mutates p (vx,vz,vy,yaw...). Returns { h, v, glide, drain, lockYaw, pitch, roll }.
 *   h: horizontal velocity handled here; v: vertical handled here; glide: min vy (slow fall) to apply when airborne;
 *   drain: stamina multiplier this frame.
 */
export function flightStep(p, sp, mv, S) {
  const F = mv.fly, pat = PAT[sp.id], dt = S.dt, t = S.t, run = mv.run, mag = S.mag, B = S.boost || 1;
  const fl = p.fl || (p.fl = { ph: 0, cyc: 0, back: 0, burst: 0, bat: false, hd: 0, seed: Math.random() * 6 });
  const out = { h: false, v: false, glide: 0, drain: 1, lockYaw: false, pitch: null, roll: 0 };
  if (p.grounded) { fl.bat = false; fl.cyc = 0; fl.burst = 0; fl.back = 0; return out; }
  const speed = Math.hypot(p.vx, p.vz);
  const accel = (tx, tz, a) => { const dx = tx - p.vx, dz = tz - p.vz, l = Math.hypot(dx, dz), st = a * dt; if (l <= st || l < 1e-6) { p.vx = tx; p.vz = tz; } else { p.vx += dx / l * st; p.vz += dz / l * st; } };
  if (pat === 'swoop') {
    if (S.flapping) fl.bat = true;
    if (!fl.bat) return out;
    // constant forward flight: stick steers heading (sharp banking); flap = climb & slow, release = dive & speed up
    const want = mag > 0.12 ? Math.atan2(S.dx, S.dz) : p.yaw, diff = angDiff(want, p.yaw), rate = 3.2 * (1 - 0.35 * Math.min(1, speed / 18));
    const turn = Math.max(-rate * dt, Math.min(rate * dt, diff)); p.yaw += turn;
    let s = Math.max(speed, 6);
    if (S.flapping) { s = damp(s, 9.0, 0.9, dt); p.vy = damp(p.vy, 3.4, 5, dt); out.drain = 1; }
    else { s = damp(s, 17.5, 0.7, dt); p.vy = damp(p.vy, -4.2, 3, dt); }
    p.vx = Math.sin(p.yaw) * s; p.vz = Math.cos(p.yaw) * s;
    out.h = out.v = true; out.lockYaw = true; out.pitch = -Math.atan2(p.vy, s) * 0.8; out.roll = Math.max(-0.95, Math.min(0.95, -turn / dt * 0.32));
    return out;
  }
  if (!S.flapping) {
    if (pat === 'flutter' || pat === 'spiral') out.glide = pat === 'flutter' ? 1.7 : 2.0; // long soft glides
    else if (pat === 'bumble') out.glide = 9.5; // heavy: drops fast when not flapping
    else if (pat === 'line' || pat === 'hover') out.glide = 6.5; // slow-ish settle once tired
    else out.glide = 8;
    if (pat === 'flutter' || pat === 'spiral') { out.pitch = 0.12; }
    return out;
  }
  // ---------- flapping ----------
  const base = mag > 0.05 ? mag : 0;
  fl.ph += dt * TAU * (pat === 'flutter' ? 2.6 : pat === 'spiral' ? 1.6 : 1);
  if (pat === 'line') {
    accel(S.dx * base * run * F.speed * B, S.dz * base * run * F.speed * B, 44); out.h = true;
    p.vy = damp(p.vy, mag > 0.1 ? 0.5 : 1.1, 8, dt); out.v = true; out.drain = mag > 0.1 ? 1 : 0.7;
    out.pitch = 0.22 * Math.min(1, speed / (run * F.speed * B));
  } else if (pat === 'flutter') {
    const wave = Math.sin(fl.ph), surge = 0.62 + 0.38 * Math.sin(fl.ph - 0.9);
    const sx = S.dz, sz = -S.dx, sway = Math.sin(fl.ph * 0.5 + fl.seed) * 1.9; // sideways drift
    accel(S.dx * base * run * F.speed * B * surge + sx * sway * (0.4 + base), S.dz * base * run * F.speed * B * surge + sz * sway * (0.4 + base), 13); out.h = true;
    p.vy = damp(p.vy, 1.0 + 4.3 * wave, 11, dt); out.v = true; out.pitch = -0.25 * wave; out.roll = 0.28 * Math.sin(fl.ph * 0.5 + fl.seed);
  } else if (pat === 'spiral') {
    let dir = base ? Math.atan2(S.dx, S.dz) : fl.hd, L = S.light;
    if (base) { dir += 0.95 * Math.sin(t * 1.9 + fl.seed); fl.hd = dir; } else fl.hd += 1.5 * dt; // no stick: lazy circling
    if (L && L.d < 20) { const toL = Math.atan2(L.x - p.x, L.z - p.z), a = 0.55 * (1 - L.d / 20); dir += angDiff(toL, dir) * a * (base ? 1 : 1.4); if (!base && L.d < 7) fl.hd = toL + 1.25; }
    const spd = (base ? base * run * F.speed * B : 3.2) * (0.8 + 0.2 * Math.sin(fl.ph));
    accel(Math.sin(dir) * spd, Math.cos(dir) * spd, 10); out.h = true;
    p.vy = damp(p.vy, 0.7 + 2.0 * Math.sin(t * 2.2 + fl.seed), 5, dt); out.v = true; out.roll = 0.5 * Math.sin(t * 1.9 + fl.seed + 1.6); out.pitch = 0.1;
  } else if (pat === 'hover') {
    if (S.press) fl.burst = 0.34;
    fl.burst = Math.max(0, fl.burst - dt);
    const dart = fl.burst > 0, rel = base ? angDiff(Math.atan2(S.dx, S.dz), p.yaw) : 0;
    const backward = !dart && base > 0.3 && Math.abs(rel) > 1.9;
    fl.back = backward ? fl.back + dt : 0; out.lockYaw = backward && fl.back < 1.1;
    const dx = base ? S.dx : Math.sin(p.yaw), dz = base ? S.dz : Math.cos(p.yaw), amt = dart ? 1 : base, mul = dart ? 2.1 : backward ? 0.6 : 1;
    accel(dx * amt * run * F.speed * mul, dz * amt * run * F.speed * mul, dart ? 140 : 70); out.h = true; // stops dead: instant hover
    p.vy = damp(p.vy, dart ? 0.4 : 0.8 + 1.7 * base, 16, dt); out.v = true; out.drain = dart ? 1.2 : 0.65;
    out.pitch = backward ? -0.35 : dart ? 0.55 : 0.1 + 0.25 * Math.min(1, speed / 14); out.roll = 0;
  } else if (pat === 'bumble') {
    // heavy bumbling: slow turns, a gentle sag after every flap, and a lazy side-to-side wobble
    fl.cyc += dt; const per = 1.15, ph = (fl.cyc % per) / per, sag = ph > 0.62 ? -1.6 * Math.sin((ph - 0.62) / 0.38 * Math.PI) : 0;
    const wob = Math.sin(t * 2.7 + fl.seed) * 0.9 + Math.sin(t * 4.3 + fl.seed * 2) * 0.4, sx = S.dz, sz = -S.dx;
    const sp2 = run * F.speed * B * (0.82 + 0.18 * Math.sin(fl.cyc * TAU / per));
    accel(S.dx * base * sp2 + sx * wob * (0.35 + base * 0.8), S.dz * base * sp2 + sz * wob * (0.35 + base * 0.8), 15); out.h = true;
    p.vy = damp(p.vy, 0.35 + 0.9 * base + sag + Math.sin(t * 3.3 + fl.seed) * 0.35, 6, dt); out.v = true; out.drain = base ? 1 : 0.8;
    out.pitch = 0.32 + 0.1 * Math.sin(t * 3.3); out.roll = 0.3 * Math.sin(t * 2.7 + fl.seed) + 0.1 * wob;
  } else if (pat === 'bound') {
    fl.cyc += dt; const per = 0.78, ph = fl.cyc % per, flap = ph < 0.34;
    const mul = flap ? 1.12 : 1.32;
    accel(S.dx * base * run * F.speed * B * mul, S.dz * base * run * F.speed * B * mul, 30); out.h = true;
    p.vy = damp(p.vy, flap ? 7.0 : -1.5, flap ? 14 : 6, dt); out.v = true; out.drain = flap ? 1 : 0.05; out.pitch = flap ? -0.42 : 0.3;
  }
  return out;
}
