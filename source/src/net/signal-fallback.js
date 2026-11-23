/** Signalling-plane fallback when WebRTC ICE cannot get a direct (or TURN) path.
 *
 *  There is no Cloudflare TURN in this build. Public STUN-only often fails on
 *  carrier NAT / mobile data, and Trystero then has nowhere to send game data
 *  (one reliable ordered data channel, no built-in message relay).
 *
 *  This bus carries coalesced lobby + game packets:
 *    1) a test hook (`window.__pmTestFallback`) for forced-ICE gates
 *    2) an optional `?fallbackRelay=` HTTP/SSE bus (local http tests)
 *    3) public Nostr relays (same family Trystero already uses for signalling)
 *
 *  A real Cloudflare TURN path would be lower-latency UDP and would replace (3).
 */
import { schnorr } from '@noble/secp256k1';

const NOSTR_RELAYS = [
  'wss://relay.nostr.net',
  'wss://nostr.data.haus',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
];

function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function utf8(s) {
  return new TextEncoder().encode(s);
}

function b64(bytes) {
  let bin = '';
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
  return btoa(bin);
}

function unb64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function asU8(data) {
  if (!data) return null;
  if (data instanceof Uint8Array) return data;
  // ArrayBuffer has no .buffer — `new Uint8Array(buf.buffer, ...)` would be empty
  // and every snapshot would fail to decode on the fallback path.
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

function envelope(msg) {
  const ch = msg && msg.ch;
  const data = msg && Object.prototype.hasOwnProperty.call(msg, 'data') ? msg.data : msg;
  const u = asU8(data);
  if (u) return { ch: ch || 'snap', bin: b64(u) };
  return { ch: ch || 'evt', json: data };
}

function openEnvelope(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.bin) {
    const u = unb64(raw.bin);
    const copy = new Uint8Array(u.byteLength);
    copy.set(u);
    return { ch: raw.ch || 'snap', data: copy.buffer };
  }
  return { ch: raw.ch || 'evt', data: raw.json };
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

function topicKind(topic) {
  let h = 2166136261;
  for (let i = 0; i < topic.length; i++) h = Math.imul(h ^ topic.charCodeAt(i), 16777619);
  return (h >>> 0) % 1e4 + 2e4;
}

function createNostrSigner() {
  const { secretKey, publicKey } = schnorr.keygen();
  return { secretKey, pubkey: toHex(publicKey) };
}

async function nostrEvent(topic, content, signer) {
  const payload = {
    kind: topicKind(topic),
    tags: [['x', topic]],
    created_at: Math.floor(Date.now() / 1000),
    content,
    pubkey: signer.pubkey,
  };
  const id = await sha256(utf8(JSON.stringify([
    0, payload.pubkey, payload.created_at, payload.kind, payload.tags, payload.content,
  ])));
  return JSON.stringify(['EVENT', {
    ...payload,
    id: toHex(id),
    sig: toHex(await schnorr.signAsync(id, signer.secretKey)),
  }]);
}

function createNostrFallback(room, onMsg, { selfId } = {}) {
  const topic = 'pmfb:' + String(room || 'pm-dev').slice(0, 80);
  const signer = createNostrSigner();
  const sockets = [];
  let closed = false;
  const kind = topicKind(topic);
  const since = Math.max(0, Math.floor(Date.now() / 1000) - 30);

  function attach(url) {
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return; }
    sockets.push(ws);
    ws.addEventListener('open', () => {
      if (closed) { try { ws.close(); } catch (e) {} return; }
      const sub = 'pmfb' + Math.random().toString(36).slice(2, 8);
      try {
        ws.send(JSON.stringify(['REQ', sub, { kinds: [kind], '#x': [topic], since }]));
      } catch (e) {}
    });
    ws.addEventListener('message', ev => {
      try {
        const parsed = JSON.parse(ev.data);
        if (!Array.isArray(parsed) || parsed[0] !== 'EVENT') return;
        const evnt = parsed[2] || parsed[1];
        const content = evnt && evnt.content;
        if (!content) return;
        const raw = JSON.parse(content);
        if (!raw || raw.from === selfId) return;
        const msg = openEnvelope(raw);
        if (msg) onMsg(msg);
      } catch (e) {}
    });
  }

  for (const url of NOSTR_RELAYS) attach(url);

  return {
    name: 'nostr',
    async send(msg) {
      if (closed) return;
      const body = JSON.stringify({ from: selfId, ...envelope(msg) });
      const event = await nostrEvent(topic, body, signer);
      for (const ws of sockets) {
        if (ws.readyState === 1) { try { ws.send(event); } catch (e) {} }
      }
    },
    close() {
      closed = true;
      for (const ws of sockets) { try { ws.close(); } catch (e) {} }
      sockets.length = 0;
    },
  };
}

function createHttpFallback(url, room, onMsg, { selfId } = {}) {
  const base = String(url).replace(/\/$/, '');
  const src = new EventSource(base + '/r/' + encodeURIComponent(room));
  src.onmessage = ev => {
    try {
      const raw = JSON.parse(ev.data);
      if (!raw || raw.from === selfId) return;
      const msg = openEnvelope(raw);
      if (msg) onMsg(msg);
    } catch (e) {}
  };
  return {
    name: 'http',
    async send(msg) {
      const body = JSON.stringify({ from: selfId, ...envelope(msg) });
      try {
        await fetch(base + '/r/' + encodeURIComponent(room), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
      } catch (e) {}
    },
    close() { try { src.close(); } catch (e) {} },
  };
}

function createHookFallback(hook, room, onMsg, { selfId } = {}) {
  const off = hook.subscribe?.(room, (raw) => {
    if (!raw || raw.from === selfId) return;
    const msg = openEnvelope(raw);
    if (msg) onMsg(msg);
  });
  return {
    name: 'test',
    async send(msg) {
      const packed = { from: selfId, ...envelope(msg) };
      try { await hook.send?.(room, packed); } catch (e) {
        try { window.__pmFbSendErr = String(e && e.message || e); } catch (err) {}
        throw e;
      }
    },
    close() { try { off?.(); } catch (e) {} },
  };
}

export function createSignalFallback({ room, onMessage, selfId, httpUrl } = {}) {
  const listeners = [];
  const deliver = (msg) => { for (const fn of listeners) { try { fn(msg); } catch (e) {} } };
  if (onMessage) listeners.push(onMessage);

  const hook = typeof window !== 'undefined' ? window.__pmTestFallback : null;
  const bus = hook
    ? createHookFallback(hook, room, deliver, { selfId })
    : (httpUrl
      ? createHttpFallback(httpUrl, room, deliver, { selfId })
      : createNostrFallback(room, deliver, { selfId }));

  return {
    name: bus.name,
    send(msg) { return bus.send(msg); },
    onMessage(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    close() { try { bus.close(); } catch (e) {} },
  };
}

export { envelope, openEnvelope };
