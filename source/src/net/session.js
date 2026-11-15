/** N1 net session: host-authoritative snapshots + events over one wrappable channel.
 *  Local only (BroadcastChannel). Trystero arrives in N2.
 */
import { createChannel } from './channel.js';
import { createLocalTransport, LOCAL_ROOM } from './local.js';
import {
  encodeFull, encodeDelta, decodeSnap, encodeInput, decodeInput, TYPE_FULL, TYPE_DELTA, snapBytes,
} from './codec.js';

const ANIMAL_IDS = ['bee', 'raccoon', 'bear'];
const INTERP_MS = 100;
const KEYFRAME_MS = 1000;

export function readNetRole(search = (typeof location !== 'undefined' ? location.search : '')) {
  const q = new URLSearchParams(search.startsWith('?') || search.startsWith('http') ? search : '?' + search);
  // If a full href was passed, URLSearchParams still works on ?query only; handle href:
  try {
    if (/^https?:/i.test(search)) return readNetRole(new URL(search).search);
  } catch (e) {}
  const n = (q.get('nettest') || '').toLowerCase();
  if (n === 'host' || n === 'client') return n;
  return null;
}

function idsOf(getCrew) {
  try {
    const c = getCrew && getCrew();
    if (Array.isArray(c) && c.length) return c.slice(0, 3);
  } catch (e) {}
  return ANIMAL_IDS.slice();
}

export function snapshotFromHooks(hooks) {
  const zones = hooks.getZones?.();
  const st = zones?.netState ? zones.netState() : (zones?.status?.() || {});
  return st;
}

export function createNet(hooks = {}) {
  const role = readNetRole();
  const onlineDev = typeof location !== 'undefined' && /(?:\?|&)online=dev(?:&|$)/.test(location.search || '');
  const active = !!(role || onlineDev);

  let transport = null;
  let channel = createChannel();
  let connected = false;
  let ready = false;
  let peers = [];
  let tick = 0;
  let lastSnapAt = 0;
  let lastFullAt = 0;
  let lastEncoded = null;
  let lastAcked = null;
  let lastAckTick = 0;
  let lastHelloAt = 0;
  let pendingLoad = null;
  let loading = false;
  let recvBuf = []; // { tHost, wall, state }
  let lastApplied = null;
  let lastPoseSent = {};
  let poseSeeded = false;
  let lastInAt = 0;
  const evq = [];

  const room = LOCAL_ROOM;
  const net = {
    role: role || null,
    room: role ? room : null,
    roomCode: role ? 'local' : null,
    topic: role ? room : null,
    transport: { name: 'LocalTransport', id: 'broadcast' },
    kind: 'local',
    mode: role ? 'nettest' : (onlineDev ? 'dev' : null),
    isHost: role === 'host',
    isClient: role === 'client',
    amHost: role === 'host',
    get connected() { return connected; },
    get ready() { return ready; },
    get peers() { return peers.slice(); },
    get peerCount() { return peers.length; },
    channel,
    /* filled below: send, broadcast, onMessage, wrap */
  };

  function attachTransport() {
    if (!active) return;
    if (transport) try { transport.close?.(); } catch (e) {}
    transport = createLocalTransport({ room });
    channel = createChannel(transport);
    net.channel = channel;
  }

  function outbound(chan, data) {
    return channel.send({ ch: chan, data });
  }

  function broadcast(chan, data) {
    return outbound(chan, data);
  }
  function send(peer, chan, data) {
    if (arguments.length === 1) return outbound('evt', peer);
    if (arguments.length === 2) return outbound(peer, chan);
    return outbound(chan, data);
  }

  const msgFns = [];
  function onMessage(a, b) {
    const filter = typeof a === 'string' ? a : '*';
    const fn = typeof a === 'function' ? a : b;
    if (typeof fn !== 'function') return () => {};
    const wrap = msg => {
      const ch = msg && msg.ch, data = msg && msg && Object.prototype.hasOwnProperty.call(msg, 'data') ? msg.data : msg;
      if (filter !== '*' && filter !== ch) return;
      if (typeof a === 'function') fn(msg);
      else fn(ch, data);
    };
    msgFns.push(wrap);
    return channel.onMessage(wrap);
  }

  function wrap(fn) {
    channel = channel.wrap(fn);
    net.channel = channel;
    return net;
  }

  net.send = send;
  net.broadcast = broadcast;
  net.onMessage = onMessage;
  net.wrap = wrap;

  function markPeer(id) {
    if (!id) id = 'peer';
    if (!peers.includes(id)) peers.push(id);
    connected = true;
    ready = true;
  }

  function currentSnapState() {
    const zones = hooks.getZones?.();
    if (!zones) return null;
    const st = typeof zones.netState === 'function' ? zones.netState() : null;
    if (!st) return null;
    return st;
  }

  function codecState(st) {
    if (!st) return { animals: [], enemies: [], escorts: [], movers: [] };
    const ids = st.bodyIds || idsOf(hooks.getCrew);
    const animals = ids.map((id, i) => {
      const b = (st.bodies && (st.bodies[id] || st.bodies[i])) || null;
      return b ? { id, ...b } : { id, x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0 };
    });
    while (animals.length < 3) animals.push({ id: ANIMAL_IDS[animals.length], x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0 });
    return {
      animals: animals.slice(0, 3),
      enemies: st.enemies || [],
      escorts: st.escorts || [],
      movers: st.movers || [],
    };
  }

  function expectOf(st) {
    const c = codecState(st || lastApplied || lastEncoded || {});
    return { nE: c.enemies.length, nC: c.escorts.length, nM: c.movers.length, enemies: c.enemies, escorts: c.escorts, movers: c.movers, base: c };
  }

  function hostTimeNow() {
    const t = (hooks.now?.() ?? (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    return t & 65535;
  }

  function sendSnap(forceFull = false) {
    if (role !== 'host') return;
    const st = currentSnapState();
    if (!st) return;
    const c = codecState(st);
    tick = (tick + 1) & 65535;
    const meta = { tick, hostTime: hostTimeNow(), ack: lastAckTick, animals: c.animals };
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const wantFull = forceFull || !lastEncoded || (now - lastFullAt >= KEYFRAME_MS);
    const buf = wantFull ? encodeFull(c, meta) : encodeDelta(c, lastEncoded, meta);
    if (wantFull) lastFullAt = now;
    lastEncoded = c;
    lastSnapAt = now;
    try { net.broadcast('snap', buf); } catch (e) {}
  }

  function sendEvt(obj) {
    if (role !== 'host' && obj && obj.type !== 'hello' && obj.type !== 'pose' && obj.type !== 'join' && obj.type !== 'in') {
      if (role === 'client' && obj.type) { /* allowed */ } else if (role === 'client') return;
    }
    try { net.broadcast('evt', obj); } catch (e) {}
  }

  function sendHello() {
    lastHelloAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const st = currentSnapState();
    sendEvt({
      type: 'hello',
      role,
      map: st?.id || null,
      from: role,
    });
  }

  function sendWelcome() {
    const st = currentSnapState();
    sendEvt({ type: 'welcome', role: 'host', map: st?.id || null, state: st, from: 'host' });
    sendSnap(true);
  }

  function seedPosesFrom(st) {
    lastPoseSent = {};
    const bodies = st && st.bodies;
    if (!bodies) return;
    for (const [id, b] of Object.entries(bodies)) lastPoseSent[id] = { x: b.x, y: b.y, z: b.z, yaw: b.yaw };
    poseSeeded = true;
  }
  function applyState(st, { interpolate = false } = {}) {
    const zones = hooks.getZones?.();
    if (!st || !zones) return;
    if (st.id && hooks.ensureMap) hooks.ensureMap(st.id);
    if (typeof zones.applyNetState === 'function') zones.applyNetState(st);
    lastApplied = st;
    if (!poseSeeded && st.bodies) seedPosesFrom(st);
  }

  function mergeSnap(decoded) {
    const ids = idsOf(hooks.getCrew);
    const bodies = {};
    (decoded.animals || []).forEach((a, i) => {
      const id = (lastApplied?.bodyIds && lastApplied.bodyIds[i]) || ids[i] || ANIMAL_IDS[i];
      if (id && a) bodies[id] = a;
    });
    const prev = lastApplied || {};
    return {
      ...prev,
      bodies: { ...(prev.bodies || {}), ...bodies },
      enemies: decoded.enemies && decoded.enemies.length ? decoded.enemies : (prev.enemies || []),
      escorts: decoded.escorts && decoded.escorts.length ? decoded.escorts : (prev.escorts || []),
      movers: decoded.movers && decoded.movers.length ? decoded.movers : (prev.movers || []),
      tick: decoded.tick,
      hostTime: decoded.hostTime,
      bodyIds: prev.bodyIds || ids,
    };
  }

  function onSnap(data) {
    if (role === 'host') return;
    const buf = data;
    const expect = expectOf(currentSnapState() || lastApplied);
    const dec = decodeSnap(buf, expect);
    if (!dec) return;
    const st = mergeSnap(dec);
    const wall = typeof performance !== 'undefined' ? performance.now() : Date.now();
    recvBuf.push({ tHost: dec.hostTime, wall, state: st, tick: dec.tick });
    if (recvBuf.length > 24) recvBuf.splice(0, recvBuf.length - 24);
    lastAckTick = dec.tick;
    connected = true;
    ready = true;
    // ack via the next in/evt is enough; also send a tiny ack evt occasionally
  }

  function lerpNum(a, b, k) { return a + (b - a) * k; }
  function lerpAng(a, b, k) {
    let d = b - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return a + d * k;
  }
  function lerpBodies(A, B, k) {
    const out = {};
    const ids = new Set([...Object.keys(A || {}), ...Object.keys(B || {})]);
    for (const id of ids) {
      const a = (A && A[id]) || B[id], b = (B && B[id]) || A[id];
      if (!a || !b) { out[id] = b || a; continue; }
      out[id] = {
        ...b,
        x: lerpNum(a.x, b.x, k), y: lerpNum(a.y, b.y, k), z: lerpNum(a.z, b.z, k),
        yaw: lerpAng(a.yaw || 0, b.yaw || 0, k),
        vx: lerpNum(a.vx || 0, b.vx || 0, k),
        vy: lerpNum(a.vy || 0, b.vy || 0, k),
        vz: lerpNum(a.vz || 0, b.vz || 0, k),
      };
    }
    return out;
  }

  function unwrapHost(t, ref) {
    // hostTime is u16 ms; unwrap near ref
    let x = t;
    while (x < ref - 32768) x += 65536;
    while (x > ref + 32768) x -= 65536;
    return x;
  }

  function interpolatedState() {
    if (!recvBuf.length) return lastApplied;
    if (recvBuf.length === 1) return recvBuf[0].state;
    const latest = recvBuf[recvBuf.length - 1];
    const target = unwrapHost(latest.tHost, latest.tHost) - INTERP_MS;
    let a = recvBuf[0], b = latest;
    for (let i = 0; i < recvBuf.length; i++) {
      const s = recvBuf[i];
      const th = unwrapHost(s.tHost, latest.tHost);
      if (th <= target) a = s;
      if (th >= target && b === latest) b = s;
    }
    const ta = unwrapHost(a.tHost, latest.tHost), tb = unwrapHost(b.tHost, latest.tHost);
    const k = tb === ta ? 1 : Math.max(0, Math.min(1, (target - ta) / (tb - ta)));
    if (a === b || k === 0) return a.state;
    if (k === 1) return b.state;
    return { ...b.state, bodies: lerpBodies(a.state.bodies, b.state.bodies, k), enemies: b.state.enemies, escorts: b.state.escorts, movers: b.state.movers };
  }

  function applyClientView() {
    const st = interpolatedState();
    if (st) applyState(st);
  }

  function onEvt(data) {
    if (!data || typeof data !== 'object') return;
    const typ = data.type;
    if (typ === 'hello') {
      markPeer(data.from || data.role || 'peer');
      if (role === 'host' && !ready) sendWelcome();
      return;
    }
    if (typ === 'welcome' || typ === 'load') {
      markPeer(data.from || 'host');
      if (role === 'client') {
        const map = data.map || data.id || data.state?.id;
        if (map && hooks.ensureMap) hooks.ensureMap(map);
        if (data.state) {
          // apply after the map is up; stash if not
          pendingLoad = { ...data.state, sigFull: true };
          tryApplyPending();
        }
      }
      return;
    }
    if (typ === 'join' && role === 'host') {
      markPeer(data.from || 'client');
      sendWelcome();
      return;
    }
    if (typ === 'pose' && role === 'host') {
      markPeer(data.from || 'client');
      const zones = hooks.getZones?.();
      if (data.bodies && zones?.applyNetState) {
        zones.applyNetState({ bodies: data.bodies, poseOnly: true });
      }
      return;
    }
    if (typ === 'ack' && role === 'host') {
      lastAckTick = data.tick || lastAckTick;
      lastAcked = lastEncoded;
      return;
    }
    // world events: client applies
    if (role === 'client' && typ !== 'in') {
      const zones = hooks.getZones?.();
      if (zones?.applyNetEvent) zones.applyNetEvent(data);
      else if (data.sig != null && zones?.applyNetState) {
        const sig = { ...((zones.status?.() || {}).sig || {}) };
        sig[data.sig] = data.v !== false;
        zones.applyNetState({ sig });
      }
      if (data.kind === 'toast' && hooks.toast && data.quiet !== true) hooks.toast(data.text, data.ms);
    }
  }

  function onIn(data) {
    if (role !== 'host') return;
    let frame = data;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) frame = decodeInput(data);
    if (!frame) return;
    hooks.applyRemoteFrame?.(frame, data && data.body);
  }

  function handle(chan, data) {
    if (chan === 'snap' || (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) onSnap(data);
    else if (chan === 'in') onIn(data);
    else onEvt(data);
  }

  function listen() {
    channel.onMessage(msg => {
      if (!msg) return;
      const ch = msg.ch;
      const data = msg && Object.prototype.hasOwnProperty.call(msg, 'data') ? msg.data : msg;
      handle(ch || (data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? 'snap' : 'evt'), data);
    });
  }

  function tryApplyPending() {
    if (!pendingLoad) return;
    const zones = hooks.getZones?.();
    const id = pendingLoad.id;
    const cur = zones?.status?.()?.id;
    if (id && cur !== id) return; // wait until map matches
    applyState(pendingLoad);
    pendingLoad = null;
  }

  function posePayload() {
    const st = currentSnapState();
    if (!st || !st.bodies) return null;
    const changed = {};
    let n = 0;
    for (const [id, b] of Object.entries(st.bodies)) {
      const prev = lastPoseSent[id];
      if (!prev || Math.hypot((b.x || 0) - (prev.x || 0), (b.y || 0) - (prev.y || 0), (b.z || 0) - (prev.z || 0)) > 0.04
        || Math.abs((b.yaw || 0) - (prev.yaw || 0)) > 0.05) {
        changed[id] = b;
        lastPoseSent[id] = { x: b.x, y: b.y, z: b.z, yaw: b.yaw };
        n++;
      }
    }
    return n ? changed : null;
  }

  function snapRate() {
    if (hooks.isPaused?.()) return 1;
    if (!hooks.isPlaying?.() || !hooks.isInLevel?.()) return 10;
    return 20;
  }

  function tickNet(wallDt) {
    if (!active || !role) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (role === 'host') {
      const hz = snapRate();
      const period = 1000 / Math.max(1, hz);
      if (!lastSnapAt) lastSnapAt = now;
      // Catch up so a slow rAF (two WebGL tabs) still hits ~20 Hz on the wall clock.
      let n = 0;
      while (now - lastSnapAt >= period - 2 && n < 8) { sendSnap(false); n++; }
      if (now - lastHelloAt > 4000) sendHello();
    } else if (role === 'client') {
      // Send local teleports/input BEFORE snapshots overwrite P (T.tpL + T.step are sync).
      if (now - lastInAt >= 50) {
        lastInAt = now;
        const poses = poseSeeded ? posePayload() : (seedPosesFrom(currentSnapState()), null);
        if (poses) sendEvt({ type: 'pose', from: 'client', bodies: poses });
        const frame = hooks.pollLocalFrame?.();
        if (frame) broadcast('in', encodeInput(frame));
      }
      applyClientView();
      tryApplyPending();
      if (now - lastHelloAt > 4000) {
        sendHello();
        sendEvt({ type: 'join', from: 'client' });
      }
    }
  }

  function onHostEvent(ev) {
    if (!active || role !== 'host' || !ev) return;
    evq.push(ev);
    sendEvt({ type: ev.kind || ev.type || 'evt', ...ev, from: 'host' });
  }

  function onMapLoaded(id) {
    if (role === 'host') sendEvt({ type: 'load', map: id, id, state: currentSnapState(), from: 'host' });
    if (role === 'client') {
      tryApplyPending();
      sendEvt({ type: 'join', from: 'client', map: id });
    }
  }

  let snapClock = null;
  function armSnapClock() {
    if (snapClock) { try { clearInterval(snapClock); } catch (e) {} snapClock = null; }
    if (role !== 'host' || typeof setInterval === 'undefined') return;
    snapClock = setInterval(() => {
      try {
        const hz = snapRate();
        const period = 1000 / Math.max(1, hz);
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!lastSnapAt || now - lastSnapAt >= period - 2) sendSnap(false);
      } catch (e) {}
    }, 16);
  }

  // Activate
  if (active && role) {
    attachTransport();
    listen();
    // Hello after a tick so the other tab's listener is up
    if (typeof setTimeout !== 'undefined') setTimeout(() => { try { sendHello(); if (role === 'client') sendEvt({ type: 'join', from: 'client' }); } catch (e) {} }, 50);
    if (role === 'host') armSnapClock();
    connected = false;
    ready = !!role;
  }

  net.tick = tickNet;
  net.onHostEvent = onHostEvent;
  net.onMapLoaded = onMapLoaded;
  net.sendSnap = sendSnap;
  net.isClient = role === 'client';
  net.isHost = role === 'host';
  net.role = role;
  net.active = active;
  net.tryApplyPending = tryApplyPending;
  net.sizes = () => ({ lastFull: lastFullAt, tick });
  return net;
}
