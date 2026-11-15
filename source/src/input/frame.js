/** InputFrame: same shape as online-coop.md §2.3 (local JS form).
 *  Network quantization (i8 sticks, u16 seq, edge counters) lands in N1.
 *  sx/sy are -1..1; cy is camera yaw in radians; sneak is a state, not a toggle.
 */
export function emptyEdges() {
  return { jump: 0, act: 0, call: 0, gear: 0, swap: 0, emote: 0, emoteId: 0 };
}

export function makeFrame(o = {}) {
  const e = { ...emptyEdges(), ...(o.e || {}) };
  return {
    s: o.s || 0,
    sx: o.sx || 0,
    sy: o.sy || 0,
    cy: o.cy || 0,
    jump: !!o.jump,
    sneakOn: !!o.sneakOn,
    jumpPressed: !!o.jumpPressed,
    actPressed: !!o.actPressed,
    callPressed: !!o.callPressed,
    gearPressed: !!o.gearPressed,
    swapDir: o.swapDir || 0,
    emoteId: o.emoteId || 0,
    dYaw: o.dYaw || 0,
    dPitch: o.dPitch || 0,
    e,
  };
}

export function mergeFrames(frames, seq = 0) {
  const out = makeFrame({ s: seq });
  if (!frames || !frames.length) return out;
  // Per-axis: first non-zero wins (matches today's keyboard-OR-touch poll).
  for (const f of frames) {
    if (!out.sx && f.sx) out.sx = f.sx;
    if (!out.sy && f.sy) out.sy = f.sy;
    if (f.jump) out.jump = true;
    if (f.sneakOn) out.sneakOn = true;
    if (f.jumpPressed) out.jumpPressed = true;
    if (f.actPressed) out.actPressed = true;
    if (f.callPressed) out.callPressed = true;
    if (f.gearPressed) out.gearPressed = true;
    if (f.swapDir && !out.swapDir) out.swapDir = f.swapDir;
    if (f.emoteId && !out.emoteId) out.emoteId = f.emoteId;
    out.dYaw += f.dYaw || 0;
    out.dPitch += f.dPitch || 0;
    if (f.cy) out.cy = f.cy;
    if (f.e) {
      for (const k of Object.keys(out.e)) {
        if (typeof f.e[k] === 'number' && f.e[k] > out.e[k]) out.e[k] = f.e[k];
      }
    }
  }
  return out;
}

export function dzAxis(v, dead = 0.18) {
  if (!v || Math.abs(v) < dead) return 0;
  const s = Math.sign(v);
  return s * Math.min(1, (Math.abs(v) - dead) / (1 - dead));
}
