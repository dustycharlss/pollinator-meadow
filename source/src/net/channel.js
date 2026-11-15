/** Wrappable send/receive channel. N0 ships the shape only; N1 will expose it as g.net.
 *  S4 Master Bell (when present) belongs on the §2.5 world-state evt as `{ bell: 'A'|'B'|'C' }` plus season / time / wind.
 *  zones.netState() / applyNetState() already expose and apply that slice so N1 can fold it into the full snapshot.
 */
export function createChannel(inner = {}) {
  const listeners = [];
  const base = {
    send(msg) { return inner.send ? inner.send(msg) : undefined; },
    onMessage(fn) {
      listeners.push(fn);
      const off = inner.onMessage ? inner.onMessage(msg => fn(msg)) : null;
      return () => {
        const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
        if (off) off();
      };
    },
    emit(msg) { for (const fn of listeners) try { fn(msg); } catch (e) {} },
  };
  return {
    ...base,
    wrap(wrapper) { return createChannel(wrapper(base)); },
  };
}
