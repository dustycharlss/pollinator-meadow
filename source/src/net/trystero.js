/** TrysteroTransport for ?online=dev.
 *
 *  Uses Trystero's public Nostr signalling (no accounts, no keys) and
 *  public STUN only (no TURN) so two separate devices on the same Wi-Fi
 *  can find each other before Cloudflare SignalRoom / TURN exists.
 *
 *  App data normally rides a single reliable, ordered WebRTC data channel.
 *  On carrier NAT / mobile data, ICE often never gets a direct path (there
 *  is no TURN here), and action.send then silently no-ops. Even a poor
 *  direct path can HOL-block: 20 Hz snapshots + per-frame poses pile up
 *  behind lost packets and show up as ~3 s lag and a "dead" guest.
 *
 *  This transport therefore:
 *    - coalesces outbound snaps / poses / inputs (latest-wins, no backlog)
 *    - falls back to a signalling-plane bus (test hook, optional HTTP/SSE,
 *      or public Nostr) whenever no direct data channel is open
 *
 *  identity is 'none' (nothing written to IndexedDB). This module must
 *  never assign to window.Trystero / window.trystero — n1.mjs would then
 *  take the isolated-context path and BroadcastChannel ?nettest would break.
 *
 *  The live (non-dev) path still wants a custom SignalRoom strategy and
 *  Cloudflare TURN iceServers from /ice with iceTransportPolicy: 'relay'.
 *  Those are stubbed until the Cloudflare account exists; a failed /ice
 *  must not fall back to direct. A configured TURN would give a low-latency
 *  UDP relay and would usually avoid this signalling-plane path.
 */
import { joinRoom, getRelaySockets } from 'trystero';
import { devIceConfig } from './ice.js';
import { isOnlineDev, fallbackRelayUrl } from './flags.js';
import { createSignalFallback } from './signal-fallback.js';
import { createLinkMux } from './link-mux.js';
import { packNetInput, unpackNetInput } from './codec.js';

export const TRYSTERO_STUB = false;

const APP_ID = 'dustycharlss.github.io/pollinator-meadow';
const NOTE = 'Trystero public signalling (Nostr) + public STUN, no TURN. On ICE failure, a signalling-plane fallback carries coalesced inputs and snapshots. Cloudflare SignalRoom / TURN not configured.';

/** Trystero 0.27 getPeers()[id].connection is the RTCPeerConnection itself
 *  (peer.mjs returns { connection: pc, get channel() { return dataChannel } },
 *  but room.getPeers only copies `.connection`, not the channel getter).
 *  pc.channel / pc.readyState are undefined, so a readyState==='open' check
 *  on the PC is always false and would keep us on the Nostr fallback forever.
 */
function anyDirectOpen(tr) {
  try {
    const peers = tr.getPeers?.() || {};
    return Object.values(peers).some((p) => {
      if (!p || p.direct !== true || !p.connection) return false;
      const pc = p.connection.peerConnection || p.connection.pc || p.connection;
      if (!pc) return false;
      const cs = pc.connectionState;
      if (cs && cs !== 'connected') return false;
      const sctp = pc.sctp && pc.sctp.state;
      if (sctp && sctp !== 'connected') return false;
      const ice = pc.iceConnectionState;
      if (!cs && ice && ice !== 'connected' && ice !== 'completed') return false;
      return (cs === 'connected') || (!cs && (ice === 'connected' || ice === 'completed' || sctp === 'connected'));
    });
  } catch (e) {
    return false;
  }
}

function isBinary(d) {
  return d instanceof ArrayBuffer || ArrayBuffer.isView(d);
}

function asBuf(d) {
  if (!d) return null;
  if (d instanceof ArrayBuffer) return d;
  if (ArrayBuffer.isView(d)) {
    if (d.byteOffset === 0 && d.byteLength === d.buffer.byteLength) return d.buffer;
    return d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
  }
  return null;
}

export function createTrysteroTransport({ room, password, appId, maxUsers = 4, rtcConfig } = {}) {
  if (!isOnlineDev()) {
    throw new Error('Trystero / Nostr signalling is only allowed under ?online=dev. The public build uses Cloudflare SignalRoom only and will not fall back to a public relay.');
  }
  const roomId = room || 'pm-dev';
  const ice = rtcConfig || devIceConfig();
  const cfg = {
    appId: appId || APP_ID,
    identity: 'none',
    password: password || undefined,
    maxUsers,
    rtcConfig: {
      iceServers: ice.iceServers || [],
      iceTransportPolicy: ice.iceTransportPolicy || 'all',
    },
  };
  const tr = joinRoom(cfg, roomId);
  const action = tr.makeAction('lobby');
  const snapAction = tr.makeAction('snap');
  const inAction = tr.makeAction('in');
  const selfId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : ('self-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
  const listeners = [];
  const joinListeners = [];
  const errorListeners = [];
  const offs = [];

  const fallback = createSignalFallback({
    room: roomId,
    selfId,
    httpUrl: fallbackRelayUrl(),
  });

  function directSend(msg) {
    const ch = msg && msg.ch;
    const data = msg && Object.prototype.hasOwnProperty.call(msg, 'data') ? msg.data : msg;
    if (ch === 'snap' || (isBinary(data) && ch !== 'in' && ch !== 'evt')) {
      const buf = asBuf(data);
      if (buf && buf.byteLength) return snapAction.send(buf);
      return;
    }
    if (ch === 'in') {
      const bin = isBinary(data) ? data : (data && data.bin);
      const buf = asBuf(bin);
      if (buf && buf.byteLength) {
        const body = (msg && msg.body) || (data && data.body) || null;
        const from = (msg && msg.from) || (data && data.from) || null;
        const s = (msg && msg.s) ?? (data && data.s);
        const packed = packNetInput(buf, { body, from });
        return inAction.send(packed, { metadata: { body, s, from } });
      }
      return;
    }
    return action.send(msg);
  }

  const mux = createLinkMux({
    directSend,
    fallbackSend: (msg) => fallback.send(msg),
    isDirectOpen: () => !ice.forcedFail && anyDirectOpen(tr),
    onMessage: (msg) => {
      for (const fn of listeners) { try { fn(msg); } catch (e) {} }
    },
  });

  offs.push(action.onMessage((data) => { mux.deliver(data); }));
  offs.push(snapAction.onMessage((data) => { mux.deliver({ ch: 'snap', data }); }));
  offs.push(inAction.onMessage((data, ctx) => {
    const meta = (ctx && ctx.metadata) || {};
    const unpacked = unpackNetInput(data) || {};
    const bin = unpacked.bin || data;
    const body = unpacked.body || meta.body || null;
    const from = unpacked.from || meta.from || (ctx && ctx.peerId) || null;
    const s = meta.s;
    mux.deliver({ ch: 'in', data: { bin, body, s, from } });
  }));
  offs.push(fallback.onMessage((msg) => { mux.deliver(msg); }));
  offs.push(tr.onUserJoin((ctx) => {
    for (const fn of joinListeners) { try { fn(ctx); } catch (e) {} }
  }));
  offs.push(tr.onError((err) => {
    for (const fn of errorListeners) { try { fn(err); } catch (e) {} }
  }));

  let lastIcePair = null;
  const iceTimer = (typeof setInterval !== 'undefined') ? setInterval(async () => {
    try {
      const peers = tr.getPeers?.() || {};
      for (const p of Object.values(peers)) {
        const pc = p && (p.connection?.peerConnection || p.connection?.pc || p.connection);
        if (!pc || typeof pc.getStats !== 'function') continue;
        const st = await pc.getStats();
        let sel = null;
        const byId = {};
        st.forEach(r => { byId[r.id] = r; });
        st.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) sel = byId[r.selectedCandidatePairId]; });
        if (!sel) st.forEach(r => { if (r.type === 'candidate-pair' && (r.nominated || r.selected) && (r.state === 'succeeded' || r.state === 'in-progress')) sel = r; });
        if (sel) {
          const l = byId[sel.localCandidateId] || {};
          const rm = byId[sel.remoteCandidateId] || {};
          lastIcePair = {
            local: l.candidateType || l.type || null,
            remote: rm.candidateType || rm.type || null,
            proto: l.protocol || l.protocol || null,
            relayProto: l.relayProtocol || null,
            rtt: sel.currentRoundTripTime != null ? Math.round(sel.currentRoundTripTime * 1000) : null,
            pc: pc.connectionState || null,
            ice: pc.iceConnectionState || null,
            sctp: (pc.sctp && pc.sctp.state) || null,
          };
          break;
        } else {
          lastIcePair = { pc: pc.connectionState || null, ice: pc.iceConnectionState || null, sctp: (pc.sctp && pc.sctp.state) || null, local: null, remote: null };
        }
      }
    } catch (e) {}
  }, 1000) : null;

  const iceFail = !!ice.forcedFail;
  const note = iceFail
    ? 'Forced ICE failure (?iceFail=1); game data rides the signalling fallback (no TURN).'
    : NOTE;

  return {
    name: 'TrysteroTransport',
    id: 'trystero-nostr',
    kind: 'trystero',
    stub: false,
    room: roomId,
    password: password || null,
    appId: cfg.appId,
    maxUsers,
    selfId,
    icePolicy: cfg.rtcConfig.iceTransportPolicy || 'all',
    iceFail,
    note,
    send(msg) {
      mux.send(msg);
    },
    onMessage(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    onPeerJoin(fn) {
      joinListeners.push(fn);
      return () => { const i = joinListeners.indexOf(fn); if (i >= 0) joinListeners.splice(i, 1); };
    },
    onError(fn) {
      errorListeners.push(fn);
      return () => { const i = errorListeners.indexOf(fn); if (i >= 0) errorListeners.splice(i, 1); };
    },
    getPeers() {
      try { return tr.getPeers?.() || {}; } catch (e) { return {}; }
    },
    getRelaySockets() {
      try { return getRelaySockets() || {}; } catch (e) { return {}; }
    },
    getLink() { return mux.getLink(); },
    getIcePair() { return lastIcePair; },
    maybePing() { mux.maybePing(); },
    ready: tr.ready,
    close() {
      mux.close();
      if (iceTimer) { try { clearInterval(iceTimer); } catch (e) {} }
      try { fallback.close(); } catch (e) {}
      for (const off of offs) { try { off(); } catch (e) {} }
      offs.length = 0;
      try {
        const p = tr.leave();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    },
  };
}
