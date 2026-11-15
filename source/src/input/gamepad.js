/** Gamepad InputSource. Standard mapping, deadzone 0.18, act3-shop-coop.md §2.3.
 *  Solo uses the first connected pad, OR-ed with keyboard and touch.
 *  Connect / disconnect are handled via events plus a per-frame getGamepads() poll.
 */
import { makeFrame, dzAxis } from './frame.js';

const DEAD = 0.18;
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

function readPad(gp) {
  if (!gp || gp.connected === false) return null;
  const ax = gp.axes || [];
  const bt = gp.buttons || [];
  const pressed = i => !!(bt[i] && (bt[i].pressed || bt[i].value > 0.5));
  let sx = dzAxis(ax[0] || 0, DEAD);
  let sy = dzAxis(-(ax[1] || 0), DEAD); // up is negative on the standard mapping
  if (pressed(BTN.RIGHT)) sx = 1; else if (pressed(BTN.LEFT)) sx = -1;
  if (pressed(BTN.UP)) sy = 1; else if (pressed(BTN.DOWN)) sy = -1;
  const dYaw = -dzAxis(ax[2] || 0, DEAD) * 0.06;
  const dPitch = dzAxis(ax[3] || 0, DEAD) * 0.04;
  return {
    id: gp.id, index: gp.index,
    sx, sy, dYaw, dPitch,
    jump: pressed(BTN.A),
    act: pressed(BTN.X),
    call: pressed(BTN.Y),
    sneak: pressed(BTN.LB),
    gear: pressed(BTN.RB),
    swap: pressed(BTN.BACK),
    pause: pressed(BTN.START),
  };
}

export function createGamepad(opts = {}) {
  const prev = {}; // index -> last button snapshot
  const sneakOn = {};
  const connected = new Set();
  let seq = 0;

  const on = ev => {
    const g = ev && ev.gamepad;
    if (g && typeof g.index === 'number') connected.add(g.index);
  };
  const off = ev => {
    const g = ev && ev.gamepad;
    const i = g && typeof g.index === 'number' ? g.index : null;
    if (i != null) {
      connected.delete(i);
      delete prev[i];
      delete sneakOn[i];
    }
  };
  addEventListener('gamepadconnected', on);
  addEventListener('gamepaddisconnected', off);

  function pads() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
    try { return navigator.getGamepads() || []; }
    catch (e) { return []; }
  }

  function snapshot(index) {
    const list = pads();
    const gp = list[index];
    const r = readPad(gp);
    if (r) connected.add(index);
    else connected.delete(index);
    return r;
  }

  function edgesFor(index, r) {
    const p = prev[index] || {};
    const e = {
      jumpPressed: !!(r && r.jump && !p.jump),
      actPressed: !!(r && r.act && !p.act),
      callPressed: !!(r && r.call && !p.call),
      gearPressed: !!(r && r.gear && !p.gear),
      swapPressed: !!(r && r.swap && !p.swap),
      pausePressed: !!(r && r.pause && !p.pause),
      sneakPressed: !!(r && r.sneak && !p.sneak),
    };
    prev[index] = r ? { jump: r.jump, act: r.act, call: r.call, gear: r.gear, swap: r.swap, pause: r.pause, sneak: r.sneak } : {};
    if (e.sneakPressed) sneakOn[index] = !sneakOn[index];
    if (!r) sneakOn[index] = false;
    return e;
  }

  function frameFrom(index, r, e) {
    const hooks = opts.hooksRef && opts.hooksRef.hooks;
    if (e.pausePressed) hooks?.esc?.();
    if (e.callPressed) hooks?.call?.();
    if (e.gearPressed) hooks?.shop?.();
    if (e.sneakPressed) hooks?.sneak?.();
    if (e.swapPressed) hooks?.swap?.(1);
    let sneak = !!sneakOn[index];
    if (opts.getSneak) sneak = !!opts.getSneak() || sneak;
    return makeFrame({
      s: ++seq,
      sx: r ? r.sx : 0, sy: r ? r.sy : 0,
      cy: opts.getCamYaw ? opts.getCamYaw() : 0,
      jump: !!(r && r.jump), sneakOn: sneak,
      jumpPressed: e.jumpPressed, actPressed: e.actPressed,
      callPressed: e.callPressed, gearPressed: e.gearPressed,
      swapDir: e.swapPressed ? 1 : 0,
      dYaw: r ? r.dYaw : 0, dPitch: r ? r.dPitch : 0,
    });
  }

  function firstIndex() {
    const list = pads();
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected !== false) return i;
    // also honour indices we saw via events even if the Array is sparse
    for (const i of connected) {
      const gp = list[i];
      if (gp && gp.connected !== false) return i;
    }
    return 0;
  }

  const src = {
    id: 'gamepad',
    connected: () => {
      const list = pads();
      for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected !== false) return true;
      return connected.size > 0;
    },
    pads,
    pollFrame() {
      const i = firstIndex();
      const r = snapshot(i);
      const e = edgesFor(i, r);
      return frameFrom(i, r, e);
    },
    pollIndex(i) {
      const r = snapshot(i);
      const e = edgesFor(i, r);
      return frameFrom(i, r, e);
    },
    poll() { const f = src.pollFrame(); return { sx: f.sx, sy: f.sy, jump: f.jump }; },
  };
  return src;
}
