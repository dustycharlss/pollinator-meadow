/** Persistent chip shown when the session is on the signalling fallback
 *  (no direct WebRTC / TURN path) or snapshots are arriving late. */
export const SLOW_LINK_TEXT = 'Connection is slow (no direct link)';

export function installSlowLinkHint({ getLink } = {}) {
  if (typeof document === 'undefined') return () => {};
  let el = document.getElementById('olSlowLink');
  if (!el) {
    el = document.createElement('div');
    el.id = 'olSlowLink';
    el.setAttribute('hidden', '');
    el.setAttribute('role', 'status');
    el.textContent = SLOW_LINK_TEXT;
    (document.body || document.documentElement).appendChild(el);
  }
  const tick = () => {
    let info = null;
    try { info = getLink?.(); } catch (e) { info = null; }
    const show = !!(info && info.slow && info.path && info.path !== 'local' && info.path !== 'none');
    if (show) {
      el.removeAttribute('hidden');
      el.classList.add('is-on');
    } else {
      el.setAttribute('hidden', '');
      el.classList.remove('is-on');
    }
  };
  const id = setInterval(tick, 400);
  tick();
  return () => { try { clearInterval(id); } catch (e) {} };
}
