/** Binary quantized snapshot codec (§1.7.1, §2.2).
 *  Full keyframe: header 8 B + 3 animals × 12 B + enemies × 6 B + escorts × 8 B + movers × 8 B.
 *  Counts of variable entities are implied by the loaded map (both peers know the lists)
 *  and also packed into a trailing layout so a buffer stays self-describing when counts
 *  are passed to decode(). Deltas are bitmasked against the last acked snapshot.
 *
 *  Coordinates are level-local metres, quantized at 1 cm (i16, ±327.67 m).
 */
export const TYPE_FULL = 1;
export const TYPE_DELTA = 2;
export const TYPE_INPUT = 3;

export const YAW_U8 = 256 / (Math.PI * 2);
const CM = 100;
const VEL_SCALE = 8; // i8, ±16 m/s

export function qI16(m) {
  return Math.max(-32768, Math.min(32767, Math.round((+m || 0) * CM)));
}
export function uI16(v) { return v / CM; }

export function qYaw(r) {
  const t = ((+r || 0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.max(0, Math.min(255, Math.round(t * YAW_U8) & 255));
}
export function uYaw(v) { return (v / 256) * Math.PI * 2; }

export function qVel(v) {
  return Math.max(-128, Math.min(127, Math.round((+v || 0) * VEL_SCALE)));
}
export function uVel(v) { return v / VEL_SCALE; }

/** flags: bit0 grounded, bit1 flying, bit2 sneak, bit3 carried, bit4 jump/air */
export function packFlags(a = {}) {
  let f = 0;
  if (a.grounded) f |= 1;
  if (a.flying || a.flapping) f |= 2;
  if (a.sneak) f |= 4;
  if (a.carried) f |= 8;
  if (a.jumpUp || a.air) f |= 16;
  return f & 255;
}

export function packEnState(st, sus) {
  const S = { idle: 0, sus: 1, '?': 1, alert: 2, '!': 2, sleep: 3, calm: 4, z: 0 };
  const s = S[st] ?? 0;
  const q = Math.max(0, Math.min(31, Math.round((+sus || 0) * 8)));
  return (s & 7) | ((q & 31) << 3);
}
export function unpackEnState(b) {
  const s = ['idle', 'sus', 'alert', 'sleep', 'calm'][b & 7] || 'idle';
  return { st: s, sus: ((b >> 3) & 31) / 8 };
}

function dv(buf) {
  return new DataView(buf.buffer === undefined ? buf : buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.byteLength === 0 ? buf.byteLength : buf.byteLength);
}

function makeView(n) {
  const buf = new ArrayBuffer(n);
  return { buf, v: new DataView(buf), u: new Uint8Array(buf), i: 0 };
}
function wU8(w, x) { w.v.setUint8(w.i, x & 255); w.i += 1; }
function wU16(w, x) { w.v.setUint16(w.i, x & 65535, true); w.i += 2; }
function wI16(w, x) { w.v.setInt16(w.i, x, true); w.i += 2; }
function wI8(w, x) { w.v.setInt8(w.i, x); w.i += 1; }

function header(w, type, meta) {
  wU8(w, type);
  wU16(w, meta.tick || 0);
  wU16(w, (meta.hostTime || 0) & 65535);
  wU16(w, (meta.ack || 0) & 65535);
  wU8(w, meta.presence != null ? meta.presence : presenceOf(meta.animals || meta.state?.animals));
}

export function presenceOf(animals = []) {
  let p = 0;
  for (let i = 0; i < 3; i++) if (animals[i]) p |= (1 << i);
  return p;
}

function writeAnimal(w, a = {}) {
  wI16(w, qI16(a.x)); wI16(w, qI16(a.y)); wI16(w, qI16(a.z));
  wU8(w, qYaw(a.yaw));
  wI8(w, qVel(a.vx)); wI8(w, qVel(a.vy)); wI8(w, qVel(a.vz));
  wU8(w, packFlags(a));
  wU8(w, (a.anim || 0) & 255);
}

function writeEnemy(w, e = {}) {
  wI16(w, qI16(e.x)); wI16(w, qI16(e.z));
  wU8(w, qYaw(e.yaw));
  wU8(w, packEnState(e.st, e.sus));
}

function writeEscort(w, e = {}) {
  wI16(w, qI16(e.x)); wI16(w, qI16(e.y)); wI16(w, qI16(e.z));
  wU8(w, qYaw(e.yaw));
  wU8(w, (e.called ? 1 : 0) | (e.following ? 2 : 0) | (e.hide ? 4 : 0));
}

function writeMover(w, m = {}) {
  wU8(w, (m.id || 0) & 255);
  wI16(w, qI16(m.x)); wI16(w, qI16(m.y)); wI16(w, qI16(m.z));
  wU8(w, qYaw(m.yaw));
}

function readAnimal(v, i) {
  const x = uI16(v.getInt16(i, true)); const y = uI16(v.getInt16(i + 2, true)); const z = uI16(v.getInt16(i + 4, true));
  const yaw = uYaw(v.getUint8(i + 6));
  const vx = uVel(v.getInt8(i + 7)); const vy = uVel(v.getInt8(i + 8)); const vz = uVel(v.getInt8(i + 9));
  const flags = v.getUint8(i + 10), anim = v.getUint8(i + 11);
  return {
    x, y, z, yaw, vx, vy, vz, anim, flags,
    grounded: !!(flags & 1), flying: !!(flags & 2), sneak: !!(flags & 4), carried: !!(flags & 8),
  };
}
function readEnemy(v, i) {
  const x = uI16(v.getInt16(i, true)), z = uI16(v.getInt16(i + 2, true));
  const yaw = uYaw(v.getUint8(i + 4));
  const { st, sus } = unpackEnState(v.getUint8(i + 5));
  return { x, z, yaw, st, sus };
}
function readEscort(v, i) {
  const x = uI16(v.getInt16(i, true)), y = uI16(v.getInt16(i + 2, true)), z = uI16(v.getInt16(i + 4, true));
  const yaw = uYaw(v.getUint8(i + 6)), f = v.getUint8(i + 7);
  return { x, y, z, yaw, called: !!(f & 1), following: !!(f & 2), hide: !!(f & 4), flags: f };
}
function readMover(v, i) {
  const id = v.getUint8(i);
  const x = uI16(v.getInt16(i + 1, true)), y = uI16(v.getInt16(i + 3, true)), z = uI16(v.getInt16(i + 5, true));
  const yaw = uYaw(v.getUint8(i + 7));
  return { id, x, y, z, yaw };
}

function countsOf(s) {
  return {
    nA: 3,
    nE: (s.enemies || []).length,
    nC: (s.escorts || []).length,
    nM: (s.movers || []).length,
  };
}

/** Worst-case full size in the spec is 148 B with 8 en / 3 esc / 4 mov and no count prefix.
 *  We write that exact layout: header + 3 animals + entity records, and stash counts
 *  in the unused high bits of presence when they fit, plus a 0-byte tag when the
 *  decoder is given `expect` (the usual path). encodeFull is self-contained by
 *  writing counts into presence (animals in bits 0-2) AND using expect on decode
 *  when provided; a 2-byte count trailer is appended only when `standalone` is true
 *  (not used on the wire — keep the 148 B worst-case).
 */
export function fullSize(s) {
  const c = countsOf(s);
  return 8 + 12 * 3 + 6 * c.nE + 8 * c.nC + 8 * c.nM;
}

export function encodeFull(state, meta = {}) {
  const animals = padAnimals(state.animals);
  const enemies = state.enemies || [];
  const escorts = state.escorts || [];
  const movers = state.movers || [];
  const n = 8 + 12 * 3 + 6 * enemies.length + 8 * escorts.length + 8 * movers.length;
  const w = makeView(n);
  header(w, TYPE_FULL, { ...meta, animals });
  for (let i = 0; i < 3; i++) writeAnimal(w, animals[i] || {});
  for (const e of enemies) writeEnemy(w, e);
  for (const e of escorts) writeEscort(w, e);
  for (const m of movers) writeMover(w, m);
  return w.buf;
}

function padAnimals(list = []) {
  const out = [list[0] || null, list[1] || null, list[2] || null];
  return out;
}

export function animalEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return qI16(a.x) === qI16(b.x) && qI16(a.y) === qI16(b.y) && qI16(a.z) === qI16(b.z)
    && qYaw(a.yaw) === qYaw(b.yaw)
    && qVel(a.vx) === qVel(b.vx) && qVel(a.vy) === qVel(b.vy) && qVel(a.vz) === qVel(b.vz)
    && packFlags(a) === packFlags(b) && ((a.anim || 0) & 255) === ((b.anim || 0) & 255);
}
function enemyEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return qI16(a.x) === qI16(b.x) && qI16(a.z) === qI16(b.z) && qYaw(a.yaw) === qYaw(b.yaw)
    && packEnState(a.st, a.sus) === packEnState(b.st, b.sus);
}
function escortEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return qI16(a.x) === qI16(b.x) && qI16(a.y) === qI16(b.y) && qI16(a.z) === qI16(b.z)
    && qYaw(a.yaw) === qYaw(b.yaw)
    && !!a.called === !!b.called && !!a.following === !!b.following && !!a.hide === !!b.hide;
}
function moverEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (a.id || 0) === (b.id || 0) && qI16(a.x) === qI16(b.x) && qI16(a.y) === qI16(b.y)
    && qI16(a.z) === qI16(b.z) && qYaw(a.yaw) === qYaw(b.yaw);
}

/** Bitmask is 3 animals + enemies + escorts + movers, packed into ceil(n/8) bytes after the header. */
export function encodeDelta(state, prev, meta = {}) {
  if (!prev) return encodeFull(state, meta);
  const animals = padAnimals(state.animals);
  const prevA = padAnimals(prev.animals);
  const enemies = state.enemies || [], prevE = prev.enemies || [];
  const escorts = state.escorts || [], prevC = prev.escorts || [];
  const movers = state.movers || [], prevM = prev.movers || [];
  const bits = [];
  const recs = [];
  const push = (changed, writer, rec, size) => { bits.push(changed ? 1 : 0); if (changed) recs.push({ writer, rec, size }); };
  for (let i = 0; i < 3; i++) push(!animalEq(animals[i], prevA[i]), writeAnimal, animals[i] || {}, 12);
  const nE = Math.max(enemies.length, prevE.length);
  for (let i = 0; i < nE; i++) push(!enemyEq(enemies[i], prevE[i]), writeEnemy, enemies[i] || {}, 6);
  const nC = Math.max(escorts.length, prevC.length);
  for (let i = 0; i < nC; i++) push(!escortEq(escorts[i], prevC[i]), writeEscort, escorts[i] || {}, 8);
  const nM = Math.max(movers.length, prevM.length);
  for (let i = 0; i < nM; i++) push(!moverEq(movers[i], prevM[i]), writeMover, movers[i] || {}, 8);
  const maskBytes = Math.ceil(bits.length / 8) || 1;
  let recSize = 0;
  for (const r of recs) recSize += r.size;
  const w = makeView(8 + maskBytes + recSize);
  header(w, TYPE_DELTA, { ...meta, animals });
  for (let i = 0; i < maskBytes; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) if (bits[i * 8 + k]) b |= (1 << k);
    wU8(w, b);
  }
  for (const r of recs) r.writer(w, r.rec);
  return w.buf;
}

export function isEmptyNetPayload(buf) {
  if (buf == null) return true;
  if (buf instanceof ArrayBuffer) return buf.byteLength < 1;
  if (ArrayBuffer.isView(buf)) return buf.byteLength < 1;
  if (typeof buf === 'object') {
    const keys = Object.keys(buf);
    if (!keys.length) return true;
    if (buf.bin != null && isEmptyNetPayload(buf.bin) && buf.frame == null && buf.data == null) return true;
  }
  return false;
}

export function decodeSnap(buf, expect = {}) {
  if (isEmptyNetPayload(buf)) return null;
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.byteLength < 8) return null;
  const type = v.getUint8(0);
  const tick = v.getUint16(1, true);
  const hostTime = v.getUint16(3, true);
  const ack = v.getUint16(5, true);
  const presence = v.getUint8(7);
  const nE = expect.nE != null ? expect.nE : (expect.enemies && expect.enemies.length) || 0;
  const nC = expect.nC != null ? expect.nC : (expect.escorts && expect.escorts.length) || 0;
  const nM = expect.nM != null ? expect.nM : (expect.movers && expect.movers.length) || 0;
  if (type === TYPE_FULL) {
    let i = 8;
    const animals = [];
    for (let k = 0; k < 3; k++) { animals.push(readAnimal(v, i)); i += 12; }
    const enemies = [];
    for (let k = 0; k < nE && i + 6 <= u8.byteLength; k++) { enemies.push(readEnemy(v, i)); i += 6; }
    const escorts = [];
    for (let k = 0; k < nC && i + 8 <= u8.byteLength; k++) { escorts.push(readEscort(v, i)); i += 8; }
    const movers = [];
    for (let k = 0; k < nM && i + 8 <= u8.byteLength; k++) { movers.push(readMover(v, i)); i += 8; }
    return { type, tick, hostTime, ack, presence, animals, enemies, escorts, movers, bytes: u8.byteLength };
  }
  if (type === TYPE_DELTA) {
    const nBits = 3 + nE + nC + nM;
    const maskBytes = Math.ceil(nBits / 8) || 1;
    let i = 8;
    const bits = [];
    for (let b = 0; b < maskBytes && i < u8.byteLength; b++, i++) {
      const byte = v.getUint8(i);
      for (let k = 0; k < 8; k++) bits.push(!!(byte & (1 << k)));
    }
    const base = expect.base || {};
    const animals = padAnimals(base.animals).map(a => a ? { ...a } : null);
    const enemies = (base.enemies || []).map(e => ({ ...e }));
    const escorts = (base.escorts || []).map(e => ({ ...e }));
    const movers = (base.movers || []).map(m => ({ ...m }));
    let b = 0;
    for (let k = 0; k < 3; k++, b++) if (bits[b]) { animals[k] = readAnimal(v, i); i += 12; }
    for (let k = 0; k < nE; k++, b++) if (bits[b]) { enemies[k] = readEnemy(v, i); i += 6; }
    for (let k = 0; k < nC; k++, b++) if (bits[b]) { escorts[k] = readEscort(v, i); i += 8; }
    for (let k = 0; k < nM; k++, b++) if (bits[b]) { movers[k] = readMover(v, i); i += 8; }
    return { type, tick, hostTime, ack, presence, animals, enemies, escorts, movers, bytes: u8.byteLength };
  }
  return { type, tick, hostTime, ack, presence, bytes: u8.byteLength };
}

/** 14 B InputFrame (§1.7.2): type, seq u16, sx i8, sy i8, cy u8, buttons u8, edges u8×5, dYaw i8, pad. */
export function encodeInput(frame = {}, seq = 0) {
  const w = makeView(14);
  wU8(w, TYPE_INPUT);
  wU16(w, (frame.s || seq) & 65535);
  wI8(w, Math.max(-127, Math.min(127, Math.round((frame.sx || 0) * 127))));
  wI8(w, Math.max(-127, Math.min(127, Math.round((frame.sy || 0) * 127))));
  wU8(w, qYaw(frame.cy));
  let btn = 0;
  if (frame.jump) btn |= 1;
  if (frame.sneakOn) btn |= 2;
  if (frame.jumpPressed) btn |= 4;
  if (frame.actPressed) btn |= 8;
  if (frame.callPressed) btn |= 16;
  if (frame.gearPressed) btn |= 32;
  if (frame.swapDir > 0) btn |= 64;
  if (frame.swapDir < 0) btn |= 128;
  wU8(w, btn);
  const e = frame.e || {};
  wU8(w, (e.jump || 0) & 255);
  wU8(w, (e.act || 0) & 255);
  wU8(w, (e.call || 0) & 255);
  wU8(w, (e.gear || 0) & 255);
  wU8(w, (e.swap || 0) & 255);
  wI8(w, Math.max(-128, Math.min(127, Math.round((frame.dYaw || 0) * 80))));
  wU8(w, (frame.emoteId || e.emoteId || 0) & 255);
  return w.buf;
}

export function decodeInput(buf) {
  if (isEmptyNetPayload(buf)) return null;
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8.byteLength < 14 || u8[0] !== TYPE_INPUT) return null;
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const btn = v.getUint8(6);
  const swapDir = (btn & 64) ? 1 : (btn & 128) ? -1 : 0;
  return {
    s: v.getUint16(1, true),
    sx: v.getInt8(3) / 127,
    sy: v.getInt8(4) / 127,
    cy: uYaw(v.getUint8(5)),
    jump: !!(btn & 1), sneakOn: !!(btn & 2),
    jumpPressed: !!(btn & 4), actPressed: !!(btn & 8),
    callPressed: !!(btn & 16), gearPressed: !!(btn & 32),
    swapDir,
    e: { jump: v.getUint8(7), act: v.getUint8(8), call: v.getUint8(9), gear: v.getUint8(10), swap: v.getUint8(11), emote: 0, emoteId: v.getUint8(13) },
    dYaw: v.getInt8(12) / 80,
    dPitch: 0,
    emoteId: v.getUint8(13),
  };
}

export function snapBytes(buf) { return buf ? (buf.byteLength || buf.length || 0) : 0; }


/** Wire wrapper so body/from survive a top-level binary Trystero action
 *  even if action metadata is dropped. Magic 0xA1, then body/from utf8, then the 14-byte input. */
const IN_WRAP = 0xA1;
export function packNetInput(bin, { body = '', from = '' } = {}) {
  const raw = bin instanceof Uint8Array ? bin : new Uint8Array(bin instanceof ArrayBuffer ? bin : bin);
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const bodyU = enc ? enc.encode(String(body || '')) : new Uint8Array(0);
  const fromU = enc ? enc.encode(String(from || '')) : new Uint8Array(0);
  if (bodyU.length > 255 || fromU.length > 255) return raw.buffer;
  const packed = new Uint8Array(4 + bodyU.length + fromU.length + raw.length);
  packed[0] = IN_WRAP;
  packed[1] = bodyU.length;
  packed[2] = fromU.length;
  packed[3] = 0;
  packed.set(bodyU, 4);
  packed.set(fromU, 4 + bodyU.length);
  packed.set(raw, 4 + bodyU.length + fromU.length);
  return packed.buffer;
}
export function unpackNetInput(buf) {
  if (buf == null) return null;
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u.byteLength < 4 || u[0] !== IN_WRAP) {
    const bin = u.byteLength ? u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) : buf;
    return { bin, body: null, from: null };
  }
  const bodyLen = u[1], fromLen = u[2];
  const hdr = 4 + bodyLen + fromLen;
  if (u.byteLength < hdr) return { bin: buf, body: null, from: null };
  const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  const body = bodyLen && dec ? dec.decode(u.subarray(4, 4 + bodyLen)) : null;
  const from = fromLen && dec ? dec.decode(u.subarray(4 + bodyLen, hdr)) : null;
  const raw = u.subarray(hdr);
  const bin = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return { bin, body: body || null, from: from || null };
}
