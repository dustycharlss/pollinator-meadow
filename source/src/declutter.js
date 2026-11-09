// Declutter (t158u): while a level is open, ambient critters / world decor stay out of the play area
// so the route and its puzzle props read clearly. CLIP is the level rect in world coords (+ margin).
export const CLIP = { on: false, x0: 0, z0: 0, x1: 0, z1: 0, keep: 1 };
/** true → hide this ambient instance (inside the level rect, or past the few we keep) */
export function clipped(x, z, i, m = 0) {
  return CLIP.on && (i >= CLIP.keep || (x > CLIP.x0 - m && x < CLIP.x1 + m && z > CLIP.z0 - m && z < CLIP.z1 + m));
}
