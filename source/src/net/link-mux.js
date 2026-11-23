/** Coalescing mux in front of the WebRTC action and the signalling fallback.
 *
 *  Outbound: latest-wins snapshots, latest-wins / coalesce inputs, bounded
 *  event queue (keep handshake events). Never pipeline a backlog — if a send
 *  is in flight, newer snaps/inputs replace the pending ones instead of
 *  queueing seconds of stale state (the HOL / 3 s lag failure mode).
 *
 *  Path: use an open direct data channel when one exists; otherwise send on
 *  the signalling fallback so lobby + game still work when ICE fails (no
 *  TURN). A "slow / no direct link" flag is exposed for the HUD hint.
 */

const MAX_EVTS = 8;
const HANDSHAKE = new Set(['hello', 'join', 'joined', 'leave', 'pinok', 'pinfail', 'kick', 'approve', 'letIn']);

function evtType(msg) {
  const d = msg && Object.prototype.hasOwnProperty.call(msg, 'data') ? msg.data : msg;
  return (d && typeof d === 'object' && !ArrayBuffer.isView(d)) ? (d.type || d.kind || '') : '';
}

function isHandshake(msg) {
  return HANDSHAKE.has(evtType(msg));
}

export function createLinkMux({ directSend, fallbackSend, isDirectOpen, onMessage } = {}) {
  const inbound = [];
  let pendingSnap = null;
  let pendingIn = null;
  let pendingPose = null;
  const pendingEvts = [];
  let inFlight = false;
  let closed = false;
  let lastPath = 'none';
  let lastSendAt = 0;
  let lastRecvAt = 0;
  let rttMs = null;
  let lastPingAt = 0;
  let pingPending = 0;
  const sent = { snap: 0, inn: 0, evt: 0, pose: 0 };
  const recv = { snap: 0, inn: 0, evt: 0, pose: 0 };

  function takeBatch() {
    const batch = [];
    while (pendingEvts.length && batch.length < MAX_EVTS) batch.push(pendingEvts.shift());
    if (pendingPose) { batch.push(pendingPose); pendingPose = null; }
    if (pendingIn) { batch.push(pendingIn); pendingIn = null; }
    if (pendingSnap) { batch.push(pendingSnap); pendingSnap = null; }
    return batch;
  }

  function stash(msg) {
    const ch = msg && msg.ch;
    if (ch === 'snap' || (msg && (msg.data instanceof ArrayBuffer || ArrayBuffer.isView(msg.data)) && !ch)) {
      pendingSnap = msg;
      return;
    }
    if (ch === 'in') { pendingIn = msg; return; }
    if (evtType(msg) === 'pose') { pendingPose = msg; return; }
    pendingEvts.push(msg);
    if (pendingEvts.length <= MAX_EVTS) return;
    // Drop oldest non-handshake events first so join/hello still get through.
    let drop = -1;
    for (let i = 0; i < pendingEvts.length; i++) {
      if (!isHandshake(pendingEvts[i])) { drop = i; break; }
    }
    if (drop < 0) drop = 0;
    pendingEvts.splice(drop, 1);
  }

  async function pump() {
    if (inFlight || closed) return;
    const batch = takeBatch();
    if (!batch.length) return;
    inFlight = true;
    const useDirect = !!isDirectOpen?.();
    const send = useDirect ? directSend : fallbackSend;
    lastPath = useDirect ? 'direct' : 'fallback';
    const t0 = performance.now();
    try {
      if (typeof send === 'function') {
        for (const m of batch) {
          await send(m);
          const c = m && m.ch;
          const typ = evtType(m);
          if (c === 'snap') sent.snap++;
          else if (c === 'in') sent.inn++;
          else if (typ === 'pose') sent.pose++;
          else sent.evt++;
        }
      }
    } catch (e) {
      // If the preferred path blew up, retry the last snap/in on the other one.
      const alt = useDirect ? fallbackSend : directSend;
      if (alt && alt !== send) {
        lastPath = useDirect ? 'fallback' : 'direct';
        try { for (const m of batch) await alt(m); } catch (err) {}
      }
    } finally {
      lastSendAt = performance.now();
      if (rttMs == null) rttMs = Math.max(0, lastSendAt - t0);
      inFlight = false;
      if (pendingSnap || pendingIn || pendingPose || pendingEvts.length) queueMicrotask(pump);
    }
  }

  function deliver(msg) {
    if (!msg || closed) return;
    lastRecvAt = performance.now();
    if (msg.ch === '__pong' || (msg.data && msg.data.type === '__pong')) {
      if (pingPending) { rttMs = Math.max(0, lastRecvAt - pingPending); pingPending = 0; }
      return;
    }
    if (msg.ch === '__ping' || (msg.data && msg.data.type === '__ping')) {
      const reply = { ch: 'evt', data: { type: '__pong' } };
      const useDirect = !!isDirectOpen?.();
      const send = useDirect ? directSend : fallbackSend;
      try { send?.(reply); } catch (e) {}
      return;
    }
    const c = msg && msg.ch;
    const typ = evtType(msg);
    if (c === 'snap' || (msg && (msg.data instanceof ArrayBuffer || ArrayBuffer.isView(msg.data)) && !c)) recv.snap++;
    else if (c === 'in') recv.inn++;
    else if (typ === 'pose') recv.pose++;
    else recv.evt++;
    try { onMessage?.(msg); } catch (e) {}
    for (const fn of inbound) { try { fn(msg); } catch (e) {} }
  }

  return {
    send(msg) {
      if (closed || !msg) return;
      stash(msg);
      pump();
    },
    onMessage(fn) {
      inbound.push(fn);
      return () => { const i = inbound.indexOf(fn); if (i >= 0) inbound.splice(i, 1); };
    },
    deliver,
    getLink() {
      const direct = !!isDirectOpen?.();
      const path = direct ? 'direct' : (lastPath === 'fallback' || lastSendAt || lastRecvAt ? 'fallback' : 'none');
      const now = performance.now();
      const idle = lastRecvAt ? now - lastRecvAt : (lastSendAt ? now - lastSendAt : 0);
      const slow = path !== 'direct' || (rttMs != null && rttMs > 400) || idle > 800;
      return { path, direct, rtt: rttMs, slow, lastSendAt, lastRecvAt, sent: { ...sent }, recv: { ...recv } };
    },
    maybePing() {
      const now = performance.now();
      if (now - lastPingAt < 1000) return;
      lastPingAt = now;
      pingPending = now;
      this.send({ ch: 'evt', data: { type: '__ping' } });
    },
    close() {
      closed = true;
      pendingSnap = pendingIn = pendingPose = null;
      pendingEvts.length = 0;
    },
  };
}
