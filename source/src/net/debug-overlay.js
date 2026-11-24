/** ?debug (and ?dbg=layout) overlay for N2 device tests:
 *  viewport, tile size + 64 px landscape fallback, Wake Lock, relay vs direct.
 */
import { isDebugFlag, isOnlineDev } from './flags.js';

export function isLayoutDebug(search = typeof location !== 'undefined' ? location.search : '') {
  return isDebugFlag(search) || /(?:\?|&)dbg=layout(?:&|$)/.test(search || '');
}

export function mountDebugOverlay(hooks = {}) {
  if (typeof document === 'undefined' || !isLayoutDebug()) return { update() {}, el: null };
  const el = document.createElement('div');
  el.className = 'olDebug';
  el.id = 'olDebug';
  document.body.appendChild(el);

  function line() {
    const vw = typeof innerWidth === 'number' ? innerWidth : 0;
    const vh = typeof innerHeight === 'number' ? innerHeight : 0;
    const vis = (typeof visualViewport !== 'undefined' && visualViewport) ? Math.round(visualViewport.height) : vh;
    const landscape = vw > vh;
    const tile = hooks.measureTile?.() || 0;
    const fallback = landscape && tile > 0 && tile < 72 - 0.5;
    const path = hooks.getPath?.() || {};
    const net = hooks.getNet?.() || {};
    const link = net.link || path.link || {};
    const ice = hooks.getIce?.() || link.ice || null;
    const wake = hooks.getWake?.() || path.wake || 'off';
    const support = (typeof navigator !== 'undefined' && navigator.wakeLock) ? 'yes' : 'no';
    const mode = link.path || path.path || 'local';
    const policy = path.policy || 'local';
    const recv = link.recv || {};
    const snapLine = `snap recv ${recv.snap != null ? recv.snap : 0} hz? ${link.snapAge != null ? 'age ' + Math.round(link.snapAge) + 'ms' : 'age —'} err ${link.lastSnapErr || 'none'}`;
    const pair = ice
      ? `ice ${ice.local || '—'}→${ice.remote || '—'} ${ice.proto || ''} ${ice.relayProto ? 'relay=' + ice.relayProto : ''} rtt ${ice.rtt != null ? ice.rtt + 'ms' : (link.rtt != null ? Math.round(link.rtt) + 'ms' : '—')} pc=${ice.pc || '—'} sctp=${ice.sctp || '—'}`
      : `ice — rtt ${link.rtt != null ? Math.round(link.rtt) + 'ms' : '—'}`;
    const owners = link.owners ? Object.entries(link.owners).map(([k, v]) => v).join(',') : '';
    return [
      `view ${vw}×${vh} (visual ${vis})`,
      `tile ${tile ? tile.toFixed(1) : '—'} px` + (fallback ? ' · 64 px landscape fallback ON' : (tile >= 72 ? ' · portrait 72+ OK' : '')),
      `Wake Lock API ${support} · state ${wake}`,
      `path ${mode}${link.direct ? ' (direct)' : ''}${link.slow ? ' SLOW' : ''} · policy ${policy}`,
      pair,
      snapLine,
      `in seq ${link.inSeq != null ? link.inSeq : '—'} ack ${link.lastInSeq != null ? link.lastInSeq : '—'} holding ${link.holding ? 1 : 0} readySent ${link.readySent != null ? link.readySent : 0}`,
      `body ${link.ownBody || net.ownBody || '—'} owners ${owners || '—'}`,
      'Cloudflare TURN / SignalRoom: not configured',
    ].filter(Boolean).join('\n');
  }
  const snapTimes = [];
  function update() {
    const net = hooks.getNet?.() || {};
    const n = net.link && net.link.recv && net.link.recv.snap;
    if (typeof n === 'number') {
      snapTimes.push({ t: performance.now(), n });
      while (snapTimes.length && snapTimes[0].t < performance.now() - 2000) snapTimes.shift();
    }
    el.dataset.snapHz = '';
    if (snapTimes.length >= 2) {
      const a = snapTimes[0], b = snapTimes[snapTimes.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0.2) el.dataset.snapHz = ((b.n - a.n) / dt).toFixed(1);
    }
    let text = line();
    if (el.dataset.snapHz) text = text.replace('hz? ', el.dataset.snapHz + ' Hz ');
    else text = text.replace('hz? ', '');
    el.textContent = text;
  }
  update();
  setInterval(update, 400);
  addEventListener('resize', update);
  return { update, el };
}
