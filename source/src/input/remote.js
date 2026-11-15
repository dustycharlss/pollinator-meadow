/** Remote InputSource: latest InputFrame from the network for a slot.
 *  N0 ships the stub only. N1+ will write frames into push().
 */
import { makeFrame } from './frame.js';

export function createRemote(opts = {}) {
  let last = makeFrame({ cy: 0 });
  let seq = 0;
  return {
    id: opts.id || 'remote',
    local: false,
    push(frame) { last = { ...makeFrame(frame), s: ++seq }; },
    pollFrame() { return { ...last, cy: last.cy || (opts.getCamYaw ? opts.getCamYaw() : 0) }; },
    poll() { const f = this.pollFrame(); return { sx: f.sx, sy: f.sy, jump: f.jump }; },
  };
}
