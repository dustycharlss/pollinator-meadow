/** TrysteroTransport for ?online=dev.
 *
 *  Uses Trystero's public Nostr signalling (no accounts, no keys) and
 *  public STUN only (no TURN) so two separate devices on the same Wi-Fi
 *  can find each other before Cloudflare SignalRoom / TURN exists.
 *
 *  identity is 'none' (nothing written to IndexedDB). This module must
 *  never assign to window.Trystero / window.trystero — n1.mjs would then
 *  take the isolated-context path and BroadcastChannel ?nettest would break.
 *
 *  The live (non-dev) path still wants a custom SignalRoom strategy and
 *  Cloudflare TURN iceServers from /ice with iceTransportPolicy: 'relay'.
 *  Those are stubbed until the Cloudflare account exists; a failed /ice
 *  must not fall back to direct.
 */
import { joinRoom, getRelaySockets } from 'trystero';
import { devIceConfig } from './ice.js';
import { isOnlineDev } from './flags.js';

export const TRYSTERO_STUB = false;

const APP_ID = 'dustycharlss.github.io/pollinator-meadow';
const NOTE = 'Trystero public signalling (Nostr) + public STUN, no TURN. Cloudflare SignalRoom / TURN not configured.';

export function createTrysteroTransport({ room, password, appId, maxUsers = 4, rtcConfig } = {}) {
  if (!isOnlineDev()) {
    throw new Error('Trystero / Nostr signalling is only allowed under ?online=dev. The public build uses Cloudflare SignalRoom only and will not fall back to a public relay.');
  }
  const roomId = room || 'pm-dev';
  const cfg = {
    appId: appId || APP_ID,
    identity: 'none',
    password: password || undefined,
    maxUsers,
    rtcConfig: rtcConfig || devIceConfig(),
  };
  const tr = joinRoom(cfg, roomId);
  const action = tr.makeAction('lobby');
  const listeners = [];
  const joinListeners = [];
  const errorListeners = [];
  const offs = [];
  offs.push(action.onMessage((data) => {
    for (const fn of listeners) { try { fn(data); } catch (e) {} }
  }));
  offs.push(tr.onUserJoin((ctx) => {
    for (const fn of joinListeners) { try { fn(ctx); } catch (e) {} }
  }));
  offs.push(tr.onError((err) => {
    for (const fn of errorListeners) { try { fn(err); } catch (e) {} }
  }));

  return {
    name: 'TrysteroTransport',
    id: 'trystero-nostr',
    kind: 'trystero',
    stub: false,
    room: roomId,
    password: password || null,
    appId: cfg.appId,
    maxUsers,
    icePolicy: (cfg.rtcConfig && cfg.rtcConfig.iceTransportPolicy) || 'all',
    note: NOTE,
    send(msg) {
      try {
        const p = action.send(msg);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
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
    getRelaySockets() {
      try { return getRelaySockets() || {}; } catch (e) { return {}; }
    },
    ready: tr.ready,
    close() {
      for (const off of offs) { try { off(); } catch (e) {} }
      offs.length = 0;
      try {
        const p = tr.leave();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    },
  };
}
