import { mergeFrames, makeFrame } from './frame.js';

/** Merge several local InputSources into one (solo: kb-all + touch + gamepad). */
export function composeSources(sources, opts = {}) {
  let seq = 0;
  const src = {
    id: opts.id || sources.map(s => s.id).filter(Boolean).join('+') || 'compose',
    sources,
    pollFrame() {
      if (opts.isActive && !opts.isActive()) {
        return makeFrame({ s: ++seq, cy: opts.getCamYaw ? opts.getCamYaw() : 0 });
      }
      const frames = [];
      for (const s of sources) {
        if (!s) continue;
        frames.push(s.pollFrame ? s.pollFrame() : makeFrame({ ...(s.poll ? s.poll() : {}), s: 0 }));
      }
      const out = mergeFrames(frames, ++seq);
      if (opts.getCamYaw) out.cy = opts.getCamYaw();
      if (opts.getSneak) out.sneakOn = !!opts.getSneak() || out.sneakOn;
      return out;
    },
    poll() { const f = src.pollFrame(); return { sx: f.sx, sy: f.sy, jump: f.jump }; },
  };
  return src;
}
