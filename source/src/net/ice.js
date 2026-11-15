/** ICE / TURN credentials (§1.3, §1.8).
 *
 *  LIVE PATH (needs a Cloudflare account + the pm-net Worker, not created in N2):
 *    GET https://<pm-net>.workers.dev/ice  →  { iceServers, ttl }
 *    with Origin check, 4 h TTL, per-IP rate limit. Used as
 *    rtcConfig: { iceServers, iceTransportPolicy: 'relay' }.
 *
 *  N2 ships a stub: no Cloudflare resources are created. Testers under
 *  ?online=dev use LocalTransport (BroadcastChannel) or this empty ICE
 *  config if a later Trystero path is pointed at it. A failed /ice must
 *  never silently fall back to a direct connection (§4.1).
 */
export const ICE_STUB_REASON = 'cloudflare-unset';

export async function fetchIce({ url, direct = false } = {}) {
  if (!url) {
    return {
      ok: false,
      reason: ICE_STUB_REASON,
      iceServers: [],
      iceTransportPolicy: 'relay',
      note: 'pm-net /ice is not deployed. N2 uses a local/dev transport. Cloudflare Realtime TURN + a short-lived credential Worker still need to be set up (§1.8).',
    };
  }
  try {
    const r = await fetch(url, { credentials: 'omit' });
    if (!r.ok) {
      return { ok: false, reason: 'ice-http-' + r.status, iceServers: [], iceTransportPolicy: 'relay', failure: true };
    }
    const j = await r.json();
    const iceServers = j.iceServers || j.urls || [];
    return {
      ok: true,
      iceServers,
      iceTransportPolicy: direct ? 'all' : 'relay',
      ttl: j.ttl || 0,
    };
  } catch (e) {
    return { ok: false, reason: 'ice-unreachable', iceServers: [], iceTransportPolicy: 'relay', failure: true };
  }
}
