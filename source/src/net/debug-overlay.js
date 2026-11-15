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
    const wake = hooks.getWake?.() || path.wake || 'off';
    const support = (typeof navigator !== 'undefined' && navigator.wakeLock) ? 'yes' : 'no';
    const mode = path.path || 'local';
    const policy = path.policy || 'local';
    const detail = path.detail || '';
    return [
      `view ${vw}×${vh} (visual ${vis})`,
      `tile ${tile ? tile.toFixed(1) : '—'} px` + (fallback ? ' · 64 px landscape fallback ON' : (tile >= 72 ? ' · portrait 72+ OK' : '')),
      `Wake Lock API ${support} · state ${wake}`,
      `path ${mode} · policy ${policy}`,
      detail,
      'Cloudflare TURN / SignalRoom: not configured',
    ].filter(Boolean).join('\n');
  }
  function update() { el.textContent = line(); }
  update();
  setInterval(update, 500);
  addEventListener('resize', update);
  return { update, el };
}
