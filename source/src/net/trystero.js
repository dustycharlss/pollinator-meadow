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

export const TRYSTERO_STUB = false;

const APP_ID = 'dustycharlss.github.io/pollinator-meadow';
const NOTE = 'Trystero public signalling (Nostr) + public STUN, no TURN. On ICE failure, a signalling-plane fallback carries coalesced inputs and snapshots. Cloudflare SignalRoom / TURN not configured.';

function anyDirectOpen(tr) {
  try {
    const peers = tr.getPeers?.() || {};
    return Object.values(peers).some((p) => {
      if (!p || p.direct !== true || !p.connection) return false;
      const conn = p.connection;
      const dc = conn.channel || conn.dataChannel || conn;
      const pc = conn.peerConnection || conn.pc || conn;
      const ice = pc && (pc.iceConnectionState || pc.connectionState);
      if (ice && ice !== 'connected' && ice !== 'completed') return false;
      // Only treat the link as direct once a data channel is actually open.
      // A peer entry with no open channel would make action.send no-op and
      // silently drop snapshots while the fallback still works the other way.
      return dc && dc.readyState === 'open';
    });
  } catch (e) {
    return false;
  }
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

  const mux = createLinkMux({
    directSend: (msg) => action.send(msg),
    fallbackSend: (msg) => fallback.send(msg),
    isDirectOpen: () => !ice.forcedFail && anyDirectOpen(tr),
    onMessage: (msg) => {
      for (const fn of listeners) { try { fn(msg); } catch (e) {} }
    },
  });

  offs.push(action.onMessage((data) => { mux.deliver(data); }));
  offs.push(fallback.onMessage((msg) => { mux.deliver(msg); }));
  offs.push(tr.onUserJoin((ctx) => {
    for (const fn of joinListeners) { try { fn(ctx); } catch (e) {} }
  }));
  offs.push(tr.onError((err) => {
    for (const fn of errorListeners) { try { fn(err); } catch (e) {} }
  }));

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
    maybePing() { mux.maybePing(); },
    ready: tr.ready,
    close() {
      mux.close();
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
