/** Public signalling: Cloudflare SignalRoom Durable Object on the pm-net Worker only.
 *  Never falls back to Nostr or any other public relay. The Worker is not
 *  deployed yet; this transport fails closed and opens no sockets.
 */
export const SIGNALROOM_UNSET = 'cloudflare-signalroom-unset';

export function createSignalRoomTransport({ room } = {}) {
  return {
    name: 'SignalRoomTransport',
    id: 'cloudflare-signalroom',
    kind: 'signalroom',
    stub: true,
    reason: SIGNALROOM_UNSET,
    room: room || null,
    note: 'Public play uses only the Cloudflare SignalRoom Durable Object on the pm-net Worker. It is not configured yet. This build will not fall back to Nostr or any public relay.',
    send() {},
    onMessage() { return () => {}; },
    onPeerJoin() { return () => {}; },
    onError() { return () => {}; },
    getRelaySockets() { return {}; },
    ready: Promise.resolve({ ok: false, reason: SIGNALROOM_UNSET }),
    close() {},
  };
}
