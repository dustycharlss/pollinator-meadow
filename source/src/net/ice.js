/** ICE / TURN credentials (§1.3, §1.8).
 *
 *  LIVE PATH (needs a Cloudflare account + the pm-net Worker, not created in N2):
 *    GET https://<pm-net>.workers.dev/ice  →  { iceServers, ttl }
 *    with Origin check, 4 h TTL, per-IP rate limit. Used as
 *    rtcConfig: { iceServers, iceTransportPolicy: 'relay' }.
 *
 *  Under ?online=dev only, testers use public STUN (no TURN) so two devices
 *  on the same Wi-Fi can connect before Cloudflare is set up. The public
 *  build stays relay-only by default: a missing or failed /ice must never
 *  silently fall back to a direct connection (§4.1).
 */
export const ICE_STUB_REASON = 'cloudflare-unset';

/** Public STUN only — Google + Cloudflare. No TURN, no credentials. */
export const PUBLIC_STUN = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

/** Dev-only ICE: allow host/srflx candidates so same-Wi-Fi peers can connect. */
export function devIceConfig() {
  return {
    iceServers: PUBLIC_STUN.slice(),
    iceTransportPolicy: 'all',
  };
}

export async function fetchIce({ url, direct = false } = {}) {
  if (!url) {
    return {
      ok: false,
      reason: ICE_STUB_REASON,
      iceServers: [],
      iceTransportPolicy: 'relay',
      note: 'pm-net /ice is not deployed. Public play stays relay-only. Cloudflare Realtime TURN + a short-lived credential Worker still need to be set up (§1.8).',
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
