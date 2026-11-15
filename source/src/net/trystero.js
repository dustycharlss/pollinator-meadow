/** TrysteroTransport interface (§2.1).
 *
 *  LIVE PATH (not wired in N2): `trystero` with identity: 'none',
 *  appId 'dustycharlss.github.io/pollinator-meadow', roomId 'pm-'+code,
 *  password = code+':pollinator-meadow', maxUsers: 3, a custom SignalRoom
 *  Durable Object strategy (no public Nostr relays), and Cloudflare TURN
 *  iceServers from /ice with iceTransportPolicy: 'relay'.
 *
 *  N2 does not create a Cloudflare account or Worker. This factory returns
 *  a LocalTransport over BroadcastChannel on the same room id so testers
 *  can exercise the lobby on one machine under ?online=dev. The shape
 *  (send / onMessage / close, name, room) matches LocalTransport so
 *  session.js can wrap either.
 */
import { createLocalTransport } from './local.js';

export const TRYSTERO_STUB = true;

export function createTrysteroTransport({ room, password, appId, maxUsers = 3 } = {}) {
  const local = createLocalTransport({ room: room || 'pm-dev' });
  return {
    ...local,
    name: 'DevTransport',
    id: 'dev-local',
    kind: 'local-stub',
    stub: true,
    password: password || null,
    appId: appId || 'dustycharlss.github.io/pollinator-meadow',
    maxUsers,
    note: 'Local BroadcastChannel stand-in. Cloudflare SignalRoom + TURN not configured.',
    // Placeholders so a later real Trystero wiring can fill these without changing callers.
    getRelaySockets() { return []; },
    peerConnection: null,
    icePolicy: 'local',
  };
}
