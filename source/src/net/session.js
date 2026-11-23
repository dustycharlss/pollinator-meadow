/** N1 net session: host-authoritative snapshots + events over one wrappable channel.
 *  Local only (BroadcastChannel). Trystero arrives in N2.
 */
import { createChannel } from './channel.js';
import { createLocalTransport, LOCAL_ROOM } from './local.js';
import {
  encodeFull, encodeDelta, decodeSnap, encodeInput, decodeInput, TYPE_FULL, TYPE_DELTA, snapBytes,
  isEmptyNetPayload, packNetInput, unpackNetInput,
} from './codec.js';

const ANIMAL_IDS = ['bee', 'raccoon', 'bear'];
const INTERP_MS = 100;
const KEYFRAME_MS = 1000;
const SNAP_MAX_AGE_MS = 250;
const LOCAL_REWIND_MAX_AGE_MS = 180;

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
  let role = readNetRole();
  const onlineDev = typeof location !== 'undefined' && /(?:\?|&)online=dev(?:&|$)/.test(location.search || '');
  const nettestMode = !!role;
  const active = !!(role || onlineDev);

  let transport = null;
  let channel = createChannel();
  let connected = false;
  let ready = false;
  let peers = [];
  let holding = false;
  let readyWait = null;
  let listened = false;
  let inSeq = 0;
  let lastInSeq = 0;
  let bodyOwners = {};
  let lastReadyKey = null;
  let readySent = 0;
  let clientLoadGen = 0;
  let predictBlend = null;
  let remoteBodies = {};
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
  let snapRecv = 0;
  let lastSnapErr = null;
  let lastWelcomeAt = 0;
  let lastApplied = null;
  let lastPoseSent = {};
  let pendingPoses = {};
  let poseSeeded = false;
  let lastInAt = 0;
  let lastWorldSent = null;
  const evq = [];
  let readyGen = 0;

  const room = LOCAL_ROOM;
  const net = {
    role: role || null,
    room: role ? room : null,
    roomCode: role ? 'local' : null,
    topic: role ? room : null,
    transport: { name: 'LocalTransport', id: 'broadcast' },
    kind: 'local',
    mode: role ? 'nettest' : (onlineDev ? 'dev' : null), // role from ?nettest= is sticky
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
    sendWorld(st, wantFull);
  }

  function worldSlice(st) {
    if (!st) return null;
    return { bell: st.bell ?? null, master: st.master || null, world: st.world || null };
  }
  function sendWorld(st, force = false) {
    const w = worldSlice(st);
    if (!w || (w.bell == null && !w.master && !w.world)) return;
    const same = lastWorldSent && JSON.stringify(lastWorldSent) === JSON.stringify(w);
    if (!force && same) return;
    lastWorldSent = w;
    sendEvt({ type: 'world', ...w, from: 'host' });
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
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (ready && lastWelcomeAt && (now - lastWelcomeAt) < 2500) return;
    lastWelcomeAt = now;
    const st = currentSnapState();
    sendEvt({ type: 'welcome', role: 'host', map: st?.id || null, state: st, from: 'host', owners: { ...bodyOwners, ...(hooks.getOwners?.() || {}) } });
    sendSnap(true);
  }

  function seedPosesFrom(st) {
    lastPoseSent = {};
    const bodies = st && st.bodies;
    if (!bodies) return;
    for (const [id, b] of Object.entries(bodies)) lastPoseSent[id] = { x: b.x, y: b.y, z: b.z, yaw: b.yaw };
    poseSeeded = true;
  }
  function bodyDist(a, b) {
    if (!a || !b) return 0;
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0));
  }

  function applyState(st, { interpolate = false, respectLocal = false } = {}) {
    const zones = hooks.getZones?.();
    if (!st || !zones) return;
    if (st.id && hooks.ensureMap) hooks.ensureMap(st.id);
    let toApply = st;
    if (respectLocal && st.bodies) {
      // Keep only bodies we recently sent as a client pose (T.tp / input)
      // until the host snap echoes them. Do not freeze mid-interpolation —
      // that left the guest 1.2 m behind a host teleport (N1-POS).
      const local = zones.netState?.();
      const locBodies = local && local.bodies;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const kept = { ...st.bodies };
      for (const id of Object.keys(kept)) {
        const pend = pendingPoses[id];
        if (!pend) continue;
        if (now - pend.at > 2000) { delete pendingPoses[id]; continue; }
        const loc = locBodies && locBodies[id], snap = kept[id];
        if (snap && bodyDist(pend, snap) <= 0.3) { delete pendingPoses[id]; continue; }
        if (loc && snap && bodyDist(loc, snap) > 0.3) delete kept[id];
      }
      toApply = { ...st, bodies: kept, sigFull: false };
    }
    if (typeof zones.applyNetState === 'function') zones.applyNetState(toApply);
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
      // Periodic snaps must not inherit welcome's sigFull or they wipe client sigs.
      sigFull: false,
      bodies: { ...(prev.bodies || {}), ...bodies },
      enemies: decoded.enemies && decoded.enemies.length ? decoded.enemies : (prev.enemies || []),
      escorts: decoded.escorts && decoded.escorts.length ? decoded.escorts : (prev.escorts || []),
      movers: decoded.movers && decoded.movers.length ? decoded.movers : (prev.movers || []),
      tick: decoded.tick,
      hostTime: decoded.hostTime,
      bodyIds: prev.bodyIds || ids,
    };
  }


  function pruneRecvBuf() {
    if (!recvBuf.length) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cut = now - SNAP_MAX_AGE_MS;
    // Keep the newest snap even if it is old so the guest still has a pose
    // to show; drop everything else that aged out, then cap the buffer.
    while (recvBuf.length > 1 && recvBuf[0].wall < cut) recvBuf.shift();
    if (recvBuf.length > 8) recvBuf.splice(0, recvBuf.length - 8);
  }

  function onSnap(data) {
    if (role === 'host') return;
    if (isEmptyNetPayload(data)) { lastSnapErr = 'empty-or-json-object'; return; }
    const buf = data;
    let dec = null;
    try {
      const expect = expectOf(currentSnapState() || lastApplied);
      dec = decodeSnap(buf, expect);
    } catch (e) {
      lastSnapErr = String(e && e.message || e);
      return;
    }
    if (!dec) { lastSnapErr = lastSnapErr || 'decode-null'; return; }
    lastSnapErr = null;
    snapRecv++;
    const st = mergeSnap(dec);
    const wall = typeof performance !== 'undefined' ? performance.now() : Date.now();
    recvBuf.push({ tHost: dec.hostTime, wall, state: st, tick: dec.tick });
    pruneRecvBuf();
    lastAckTick = dec.tick;
    connected = true;
    ready = true;
    // Apply immediately: the guest tab's rAF is often throttled, and T.step
    // does not run the rAF loop. Tests read g.P after a short wait.
    applyClientView();
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

  function latestState() {
    return recvBuf.length ? recvBuf[recvBuf.length - 1].state : lastApplied;
  }
  function applyClientView() {
    // Apply the latest snap so a host teleport lands immediately. Interpolate
    // only when the latest pose is already close (smoothness, not catch-up).
    const latest = latestState();
    const interp = interpolatedState();
    let st = latest;
    if (latest && interp && latest.bodies && interp.bodies) {
      let far = false;
      for (const id of Object.keys(latest.bodies)) {
        if (bodyDist(latest.bodies[id], interp.bodies[id]) > 0.3) { far = true; break; }
      }
      if (!far) st = interp;
    }
    if (st) {
      const localId = hooks.localBody?.();
      const tweening = hooks.isTweening?.(localId);
      if (localId && st.bodies && st.bodies[localId] && !tweening) {
        const cur = hooks.getPose?.(localId);
        const snap = st.bodies[localId];
        const latestEntry = recvBuf.length ? recvBuf[recvBuf.length - 1] : null;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const snapAge = latestEntry && latestEntry.wall != null ? now - latestEntry.wall : 0;
        const stale = snapAge > LOCAL_REWIND_MAX_AGE_MS;
        if (cur && snap) {
          const d = bodyDist(cur, snap);
          const pend = pendingPoses[localId];
          const hasPend = !!(pend && (now - pend.at) < 2000);
          // Keep local prediction while the guest is driving (pending pose)
          // or when the snap is close / stale. Only hard-correct a large,
          // fresh snap with no pending pose (teleport / rescue).
          if (hasPend || d < 4 || stale) {
            const bodies = { ...st.bodies };
            delete bodies[localId];
            st = { ...st, bodies };
            predictBlend = null;
          } else {
            predictBlend = null;
          }
        }
      }
      applyState(st, { respectLocal: true });
      if (predictBlend && hooks.blendPose) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const k = Math.min(1, (now - predictBlend.at) / predictBlend.dur);
        const a = predictBlend.from, b = predictBlend.to;
        hooks.blendPose(predictBlend.id, {
          x: a.x + (b.x - a.x) * k,
          y: a.y + (b.y - a.y) * k,
          z: a.z + (b.z - a.z) * k,
        });
        if (k >= 1) predictBlend = null;
      }
    }
  }

  function onEvt(data) {
    if (!data || typeof data !== 'object') return;
    const typ = data.type;
    if (typ === 'hello') {
      markPeer(data.from || data.role || 'peer');
      if (role === 'host' && !ready) sendWelcome();
      return;
    }
    if (typ === 'owners' && data.owners && typeof data.owners === 'object') {
      bodyOwners = { ...data.owners };
      hooks.onOwners?.(bodyOwners);
      return;
    }
    if (typ === 'ready') {
      markPeer(data.from || 'client');
      if (role === 'host') onPeerReady(data.from || 'client', data.map);
      return;
    }
    if (typ === 'readywait' && role === 'client') {
      hooks.levelFlow?.showReady?.({ map: data.map, name: data.name, roster: data.roster });
      holding = true;
      if (hooks.onHold) hooks.onHold(true);
      return;
    }
    if (typ === 'countdown' && role === 'client') {
      hooks.levelFlow?.showCountdown?.(data.n, data.name, data.map);
      holding = true;
      return;
    }
    if (typ === 'go' && role === 'client') {
      holding = false;
      if (hooks.onHold) hooks.onHold(false);
      hooks.levelFlow?.hideReady?.();
      hooks.levelFlow?.hideCatchup?.();
            try { hooks.audio?.sample?.('online/sfx-n2/room-start-whoosh', 0.55); } catch (e) {}
      hooks.onGo?.(data.map);
      return;
    }
    if (typ === 'loadtimeout' && role === 'client') {
      holding = false;
      if (hooks.onHold) hooks.onHold(false);
      hooks.levelFlow?.showTimeout?.();
      hooks.onLoadTimeout?.(data.map);
      return;
    }
    if (typ === 'continue' && role === 'client') {
      hooks.levelFlow?.hideComplete?.();
      hooks.onHostContinue?.(data);
      return;
    }
    if (typ === 'complete' && role === 'client') {
      hooks.onLevelComplete?.(data);
      return;
    }
    if (typ === 'welcome' || typ === 'load') {
      markPeer(data.from || 'host');
      if (data.owners && typeof data.owners === 'object') {
        bodyOwners = { ...data.owners };
        hooks.onOwners?.(bodyOwners);
      }
      if (role === 'client') {
        const map = data.map || data.id || data.state?.id;
        if (map && hooks.ensureMap) hooks.ensureMap(map, { A: data.state && data.state.A, baseY: data.state && data.state.baseY, force: true });
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
      const from = data.from || 'client';
      if (data.bodies && zones?.applyNetState) {
        const owned = {};
        for (const id of Object.keys(data.bodies)) {
          if (!nettestMode && bodyOwners[id] && bodyOwners[id] !== from) continue;
          if (!nettestMode && !bodyOwners[id]) bodyOwners[id] = from;
          owned[id] = data.bodies[id];
          remoteBodies[id] = true;
        }
        if (!Object.keys(owned).length) return;
        zones.applyNetState({ bodies: owned, poseOnly: true });
        // Plate / hold checks live in zones.update, which may not run if the
        // host tab's rAF is throttled. Pulse so setSig fires from a guest sit.
        try { hooks.pulseWorld?.(); } catch (e) {}
      }
      return;
    }
    if (typ === 'ack' && role === 'host') {
      lastAckTick = data.tick || lastAckTick;
      lastAcked = lastEncoded;
      return;
    }
    // Client act/interact intents: the host checks and applies them (bell, levers, pads, gear).
    const fromClient = data.from === 'client';
    if (role === 'host' && fromClient && (typ === 'intent' || data.intent)) {
      hooks.applyRemoteIntent?.(data);
      return;
    }
    // Guest gameplay events (sig / pick / act results) — host applies and echoes.
    if (role === 'host' && fromClient && typ && typ !== 'in' && typ !== 'pose' && typ !== 'join' && typ !== 'hello' && typ !== 'ack' && typ !== 'intent') {
      const zones = hooks.getZones?.();
      if (zones?.applyNetEvent) zones.applyNetEvent(data);
      sendEvt({ ...data, type: typ, kind: data.kind || typ, from: 'host' });
      return;
    }
    // world events: client applies
    if (role === 'client' && typ !== 'in') {
      const zones = hooks.getZones?.();
      if (typ === 'world' && zones?.applyNetState) {
        const slice = { bell: data.bell, master: data.master, world: data.world };
        zones.applyNetState(slice);
        if (lastApplied) lastApplied = { ...lastApplied, ...slice };
        return;
      }
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
    if (isEmptyNetPayload(data)) return;
    let frame = data, body = null, who = (data && data.from) || null;
    if (data && typeof data === 'object' && !ArrayBuffer.isView(data) && !(data instanceof ArrayBuffer)) {
      body = data.body || data.id || null;
      who = data.from || who;
      let raw = data.bin || data.frame || data.data;
      if (raw && (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw))) {
        const unpacked = unpackNetInput(raw);
        if (unpacked) {
          raw = unpacked.bin;
          if (!body && unpacked.body) body = unpacked.body;
          if (!who && unpacked.from) who = unpacked.from;
        }
      }
      if (isEmptyNetPayload(raw)) return;
      if (raw) frame = decodeInput(raw);
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const unpacked = unpackNetInput(data);
      if (unpacked) {
        if (unpacked.body) body = unpacked.body;
        if (unpacked.from) who = unpacked.from;
        frame = decodeInput(unpacked.bin);
      } else frame = decodeInput(data);
    }
    if (!frame || isEmptyNetPayload(frame)) return;
    if (!nettestMode && body && who && bodyOwners[body] && bodyOwners[body] !== who) return;
    if (!nettestMode && body && who && !bodyOwners[body]) bodyOwners[body] = who;
    if (frame.s != null) lastInSeq = frame.s;
    if (body) remoteBodies[body] = true;
    hooks.applyRemoteFrame?.(frame, body);
  }

  function handle(chan, data) {
    if (chan === 'snap' || (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) onSnap(data);
    else if (chan === 'in') onIn(data);
    else onEvt(data);
  }

  function listen() {
    if (listened) return;
    listened = true;
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
    const localId = hooks.localBody?.();
    if (!localId || !st.bodies[localId]) return null;
    const b = st.bodies[localId];
    const prev = lastPoseSent[localId];
    if (prev && Math.hypot((b.x || 0) - (prev.x || 0), (b.y || 0) - (prev.y || 0), (b.z || 0) - (prev.z || 0)) <= 0.04
      && Math.abs((b.yaw || 0) - (prev.yaw || 0)) <= 0.05) return null;
    lastPoseSent[localId] = { x: b.x, y: b.y, z: b.z, yaw: b.yaw };
    pendingPoses[localId] = { x: b.x, y: b.y, z: b.z, yaw: b.yaw, at: typeof performance !== 'undefined' ? performance.now() : Date.now() };
    return { [localId]: b };
  }

  function snapRate() {
    // Ready-wait (`holding`) still freezes the sim in worldTick, but in-level
    // snapshots stay at 20 Hz even on a slow host. Only the pause overlay
    // drops the ticker to 1 Hz (n22 behaviour).
    if (hooks.isPaused?.()) return 1;
    if (!hooks.isPlaying?.() || !hooks.isInLevel?.()) return 10;
    return 20;
  }

  function tickNet(wallDt) {
    if (!active || !role) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try { transport?.maybePing?.(); } catch (e) {}
    if (role === 'host') {
      // Snapshots are sent from armSnapClock's fixed timestep, not from rAF/tickNet.
      if (now - lastHelloAt > 4000) sendHello();
    } else if (role === 'client') {
      // Always harvest poses before applyClientView so a T.tp in the same
      // T.step is marked pending (the 50 ms input cadence used to skip it
      // and the latest host snap rewound the guest off the plate — N1-SIG).
      const poses = poseSeeded ? posePayload() : (seedPosesFrom(currentSnapState()), null);
      if (poses) sendEvt({ type: 'pose', from: hooks.peerId?.() || 'client', bodies: poses });
      if (now - lastInAt >= 50) {
        lastInAt = now;
        const frame = hooks.pollLocalFrame?.();
        if (frame) {
          inSeq = (inSeq + 1) & 65535;
          broadcast('in', { bin: encodeInput(frame, inSeq), body: hooks.localBody?.() || null, s: inSeq, from: hooks.peerId?.() || 'client' });
        }
      }
      applyClientView();
      tryApplyPending();
      if (now - lastHelloAt > 4000) {
        sendHello();
        const live = hooks.getZones?.()?.status?.()?.id;
        if (!live || !ready) sendEvt({ type: 'join', from: 'client', map: live || null });
      }
    }
  }

  function onHostEvent(ev) {
    if (!active || !ev) return;
    const typ = ev.kind || ev.type || 'evt';
    if (role === 'host') {
      evq.push(ev);
      sendEvt({ type: typ, ...ev, from: 'host' });
    } else if (role === 'client') {
      // Forward guest setSig / picks / acts so the host can authoritatively apply them.
      sendEvt({ type: typ, ...ev, from: 'client' });
    }
  }

  function onMapLoaded(id) {
    if (role === 'host') {
      sendEvt({ type: 'load', map: id, id, state: currentSnapState(), from: 'host', owners: { ...bodyOwners, ...(hooks.getOwners?.() || {}) } });
      beginReadyWait(id);
    }
    if (role === 'client') {
      clientLoadGen += 1;
      lastReadyKey = null;
      tryApplyPending();
      sendEvt({ type: 'join', from: 'client', map: id });
      sendReady(id);
      hooks.levelFlow?.hideCatchup?.();
    }
  }
  function onMapReady(id) {
    if (role === 'client') sendReady(id);
  }

  function isHubMap(id) {
    return !id || id === 'meadow_hub' || hooks.isHub?.(id);
  }

  function rosterSnapshot(readySet) {
    const raw = hooks.getRoster?.() || [];
    const list = raw.length ? raw : defaultRoster();
    return list.map(p => ({
      id: p.id,
      label: p.label || p.em || p.style || '',
      cls: p.cls || null,
      ready: !!(readySet && readySet.has(p.id)) || p.id === 'host' && role === 'host' && readySet && readySet.has('host'),
    }));
  }
  function defaultRoster() {
    const out = [{ id: 'host', label: '🐻', cls: 'bruiser' }];
    if (peers.includes('client') || role === 'client' || (hooks.peerCount?.() || peers.length) >= 1) {
      out.push({ id: 'client', label: '🐝', cls: 'scout' });
    }
    return out;
  }

  function beginReadyWait(id) {
    if (role !== 'host' || isHubMap(id)) return;
    readyGen += 1;
    const name = hooks.levelName?.(id) || id;
    const selfId = hooks.peerId?.() || 'host';
    const readySet = new Set([selfId, 'host']);
    // Auto-ready any already-connected peer that is already on this map.
    const roster = rosterSnapshot(readySet);
    readyWait = { map: id, name, ready: readySet, started: (typeof performance !== 'undefined' ? performance.now() : Date.now()), timer: null, counting: false };
    holding = true;
    if (hooks.onHold) hooks.onHold(true);
    hooks.levelFlow?.showReady?.({ map: id, name, roster });
    sendEvt({ type: 'readywait', map: id, name, roster, from: 'host' });
    const gen = readyGen;
    readyWait.timer = setTimeout(() => { if (gen !== readyGen) return; finishReadyWait(true); }, 15000);
    setTimeout(() => maybeFinishReady(), 400);
  }

  function onPeerReady(from, map) {
    if (!readyWait || readyWait.counting) {
      const live = hooks.getZones?.()?.status?.()?.id;
      if (role === 'host' && !readyWait && map && live && live === map && !isHubMap(live)) {
        sendEvt({ type: 'go', map, from: 'host', late: true });
      }
      return;
    }
    if (map && readyWait.map && map !== readyWait.map) return;
    readyWait.ready.add(from);
    hooks.levelFlow?.tickSfx?.('ready');
    const roster = rosterSnapshot(readyWait.ready);
    hooks.levelFlow?.showReady?.({ map: readyWait.map, name: readyWait.name, roster });
    sendEvt({ type: 'readywait', map: readyWait.map, name: readyWait.name, roster, from: 'host' });
    maybeFinishReady();
  }

  function maybeFinishReady() {
    if (!readyWait || readyWait.counting) return;
    const needed = (hooks.getRoster?.() || defaultRoster()).map(p => p.id);
    const ids = needed.length ? needed : ['host', 'client'];
    const all = ids.every(id => readyWait.ready.has(id));
    // A solo host (no peers yet) should still wait a beat only if someone is connecting;
    // if the only roster id is host, go.
    const onlyHost = ids.length === 1 && ids[0] === 'host';
    if (all || onlyHost) finishReadyWait(false);
  }

  function finishReadyWait(timedOut) {
    if (!readyWait || readyWait.counting) return;
    if (readyWait.timer) { try { clearTimeout(readyWait.timer); } catch (e) {} readyWait.timer = null; }
    if (timedOut) {
      const map = readyWait.map;
      readyWait = null;
      holding = false;
      if (hooks.onHold) hooks.onHold(false);
      hooks.levelFlow?.showTimeout?.();
      sendEvt({ type: 'loadtimeout', map, from: 'host' });
      hooks.onLoadTimeout?.(map);
      return;
    }
    startCountdown();
  }

  function startCountdown() {
    if (!readyWait) return;
    readyWait.counting = true;
    const { map, name } = readyWait;
    const gen = readyGen;
    let n = 3;
    const go = () => {
      if (gen !== readyGen || !readyWait || readyWait.map !== map) return;
      holding = false;
      if (hooks.onHold) hooks.onHold(false);
      hooks.levelFlow?.hideReady?.();
            try { hooks.audio?.sample?.('online/sfx-n2/room-start-whoosh', 0.55); } catch (e) {}
      sendEvt({ type: 'go', map, from: 'host' });
      hooks.onGo?.(map);
      readyWait = null;
    };
    const tick = () => {
      if (gen !== readyGen || !readyWait || readyWait.map !== map) return;
      hooks.levelFlow?.showCountdown?.(n, name, map);
      sendEvt({ type: 'countdown', map, name, n, from: 'host' });
      if (n <= 1) { setTimeout(go, 1000); return; }
      n -= 1;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function sendReady(id) {
    if (role !== 'client') return;
    const key = String(id || '') + ':' + clientLoadGen;
    if (lastReadyKey === key) return;
    lastReadyKey = key;
    holding = true;
    if (hooks.onHold) hooks.onHold(true);
    readySent += 1;
    sendEvt({ type: 'ready', map: id, from: hooks.peerId?.() || 'client' });
  }

  function sendContinue(payload = {}) {
    if (role !== 'host') return;
    sendEvt({ type: 'continue', ...payload, from: 'host' });
    hooks.levelFlow?.hideComplete?.();
  }

  function abortReadyWait(opts = {}) {
    readyGen += 1;
    if (readyWait?.timer) { try { clearTimeout(readyWait.timer); } catch (e) {} }
    readyWait = null;
    holding = false;
    hooks.levelFlow?.hideReady?.();
    if (!opts.keepComplete) hooks.levelFlow?.hideComplete?.();
    if (hooks.onHold) hooks.onHold(false);
  }

  let snapClock = null, nextSnapAt = 0;
  function armSnapClock() {
    if (snapClock) { try { clearInterval(snapClock); } catch (e) {} snapClock = null; }
    if (role !== 'host' || typeof setInterval === 'undefined') return;
    // Fixed timestep: advance nextSnapAt by 1/hz, independent of rAF / worldTick.
    // A short setInterval is only the scheduler; missed ticks catch up by period, not "now".
    nextSnapAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    snapClock = setInterval(() => {
      try {
        const hz = snapRate();
        const period = 1000 / Math.max(1, hz);
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (nextSnapAt <= 0) nextSnapAt = now;
        if (now - nextSnapAt > period * 4) nextSnapAt = now; // skip a long stall, keep phase
        let n = 0;
        while (now >= nextSnapAt && n < 4) {
          sendSnap(false);
          nextSnapAt += period;
          n++;
        }
      } catch (e) {}
    }, 10);
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

  function syncRoleFlags() {
    net.isClient = role === 'client';
    net.isHost = role === 'host';
    net.amHost = role === 'host';
    net.role = role;
  }

  function bindRoom(opts = {}) {
    // ?nettest keeps the local BroadcastChannel; lobby runs beside it.
    if (readNetRole()) return;
    const r = opts.role;
    if (!r) return;
    role = r;
    syncRoleFlags();
    net.kind = opts.transport?.kind || opts.transport?.name || 'trystero';
    net.mode = 'dev';
    net.transport = opts.transport || net.transport;
    if (opts.transport) {
      transport = opts.transport;
      channel = opts.channel || createChannel(opts.transport);
      net.channel = channel;
      listened = false;
      listen();
    }
    if (role === 'host') armSnapClock();
    if (typeof setTimeout !== 'undefined') setTimeout(() => { try { sendHello(); if (role === 'client') sendEvt({ type: 'join', from: 'client' }); } catch (e) {} }, 50);
  }

  function unbindRoom() {
    if (readNetRole()) return;
    abortReadyWait();
    if (snapClock) { try { clearInterval(snapClock); } catch (e) {} snapClock = null; }
    role = null;
    syncRoleFlags();
    connected = false;
  }

  net.tick = tickNet;
  net.onHostEvent = onHostEvent;
  net.onMapLoaded = onMapLoaded;
  net.onMapReady = onMapReady;
  net.sendSnap = sendSnap;
  net.bindRoom = bindRoom;
  net.unbindRoom = unbindRoom;
  net.beginReadyWait = beginReadyWait;
  net.sendContinue = sendContinue;
  net.abortReadyWait = abortReadyWait;
  net.remoteBodies = () => Object.keys(remoteBodies);
  net.markRemote = (id) => { if (id) remoteBodies[id] = true; };
  function linkInfo() {
    pruneRecvBuf();
    const t = (typeof transport?.getLink === 'function') ? transport.getLink() : null;
    const latest = recvBuf.length ? recvBuf[recvBuf.length - 1] : null;
    const snapAge = latest && latest.wall != null
      ? ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - latest.wall)
      : null;
    const local = !!(readNetRole() || (transport && (transport.stub || transport.kind === 'local' || transport.name === 'LocalTransport')));
    const path = local ? 'local' : (t?.path || (transport ? 'direct' : 'none'));
    const slow = !local && (path === 'fallback' || !!(t && t.slow) || (snapAge != null && snapAge > 400));
    const owners = { ...bodyOwners, ...(hooks.getOwners?.() || {}) };
    return {
      path, snapAge, rtt: t?.rtt ?? null, slow, direct: path === 'direct',
      recvBuf: recvBuf.length, snapRecv, lastSnapErr, sent: t?.sent || null, recv: t?.recv || null,
      holding: !!holding, readySent, inSeq, lastInSeq, lastAckTick,
      ownBody: hooks.localBody?.() || null, owners,
      ice: (typeof transport?.getIcePair === 'function') ? transport.getIcePair() : null,
    };
  }
  Object.defineProperty(net, 'link', { get: linkInfo });
  Object.defineProperty(net, 'holding', { get: () => holding, set: v => { holding = !!v; } });
  syncRoleFlags();
  net.active = active;
  net.tryApplyPending = tryApplyPending;
  net.sizes = () => ({ lastFull: lastFullAt, tick });
  return net;
}
