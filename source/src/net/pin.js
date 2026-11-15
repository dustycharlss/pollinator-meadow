/** Picture-PIN challenge-response (§3.6). The PIN is never sent, not even hashed. */

function enc() { return new TextEncoder(); }

function concatBytes(...parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export async function derivePinKey(indices, roomCode) {
  const subtle = globalThis.crypto && crypto.subtle;
  if (!subtle) throw new Error('subtle crypto required for PIN');
  const raw = enc().encode((indices || []).join(','));
  const material = await subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc().encode(String(roomCode || '')), iterations: 100000 },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export async function pinReply(indices, roomCode, nonce, hostPeerId, joinerPeerId) {
  const subtle = crypto.subtle;
  const keyBytes = await derivePinKey(indices, roomCode);
  const key = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = concatBytes(nonce instanceof Uint8Array ? nonce : new Uint8Array(nonce), enc().encode(String(hostPeerId || '')), enc().encode(String(joinerPeerId || '')));
  return new Uint8Array(await subtle.sign('HMAC', key, msg));
}

export function randomNonce(n = 16) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export function b64ToBytes(s) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** Host-side try / lockout counters. 3 wrong → 30s, then 60, 120, 240 max. 10 room-wide locks new joiners. */
export function createPinGuard() {
  const peers = new Map(); // id -> { wrong, lockUntil, tier }
  let roomWrong = 0;
  let roomLocked = false;
  function state(id) {
    let s = peers.get(id);
    if (!s) { s = { wrong: 0, lockUntil: 0, tier: 0 }; peers.set(id, s); }
    return s;
  }
  return {
    lockedFor(id, now = Date.now()) {
      if (roomLocked) return { room: true, ms: 0 };
      const s = state(id);
      const ms = Math.max(0, s.lockUntil - now);
      return { room: false, ms, wrong: s.wrong };
    },
    roomLocked: () => roomLocked,
    roomWrong: () => roomWrong,
    recordFail(id, now = Date.now()) {
      const s = state(id);
      s.wrong += 1;
      roomWrong += 1;
      if (s.wrong >= 3) {
        s.wrong = 0;
        const sec = [30, 60, 120, 240][Math.min(3, s.tier)];
        s.tier = Math.min(3, s.tier + 1);
        s.lockUntil = now + sec * 1000;
      }
      if (roomWrong >= 10) roomLocked = true;
      return { lockMs: Math.max(0, s.lockUntil - now), roomLocked, roomWrong };
    },
    recordPass(id) {
      const s = state(id);
      s.wrong = 0;
    },
    resetRoom() { roomWrong = 0; roomLocked = false; peers.clear(); },
  };
}
