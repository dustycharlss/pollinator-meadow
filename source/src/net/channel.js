/** Wrappable send/receive channel. N0 ships the shape only; N1 will expose it as g.net. */
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
