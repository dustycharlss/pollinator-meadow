/** LocalTransport: BroadcastChannel, N1 local-only path (?nettest=host/client). */
export const LOCAL_ROOM = 'pm-n1-local';

export function createLocalTransport({ room = LOCAL_ROOM } = {}) {
  const bc = new BroadcastChannel(room);
  const listeners = [];
  const onMsg = ev => { for (const fn of listeners) { try { fn(ev.data); } catch (e) {} } };
  bc.addEventListener('message', onMsg);
  return {
    name: 'LocalTransport',
    id: 'broadcast',
    room,
    send(msg) { try { bc.postMessage(msg); } catch (e) {} },
    onMessage(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    close() { try { bc.removeEventListener('message', onMsg); bc.close(); } catch (e) {} },
  };
}
