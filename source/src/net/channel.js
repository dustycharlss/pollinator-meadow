/** Wrappable send/receive channel. One path for LocalTransport now and Trystero later.
 *  N1 exposes this as g.net; tests delay/loss-wrap g.net.broadcast / g.net.send.
 *  S4 Master Bell belongs on the §2.5 world-state evt as `{ bell: 'A'|'B'|'C' }` plus season / time / wind;
 *  zones.netState() / applyNetState() expose and apply that slice so it rides the snapshot.
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
