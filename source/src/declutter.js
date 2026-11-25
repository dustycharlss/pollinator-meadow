// Declutter (t158u): while a level is open, ambient critters / world decor stay out of the play area
// so the route and its puzzle props read clearly. CLIP is the level rect in world coords (+ margin).
export const CLIP = { on: false, x0: 0, z0: 0, x1: 0, z1: 0, keep: 1 };
/** true → hide this ambient instance (inside the level rect, or past the few we keep) */
export function clipped(x, z, i, m = 0) {
  if (!CLIP.on) return false; if (i >= CLIP.keep) return true;
  const r = inRoute(x, z, m); if (r != null) return r; // l20p: route corridor only when the level has one
  return x > CLIP.x0 - m && x < CLIP.x1 + m && z > CLIP.z0 - m && z < CLIP.z1 + m;
}
// l20p: walking-route corridor (Beans fuller spec §5). Set per level by fuller-decor.js (world coords).
let RC = null;
export function setRouteClip(r) { RC = r && (r.lane || (r.route && r.route.length)) ? r : null; }
const segD = (x, z, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1; let t = ((x - a[0]) * vx + (z - a[1]) * vz) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); };
/** true → (x,z) is on the walking route (+ margin m). null when no route is known (callers keep the old rect rule). */
export function inRoute(x, z, m = 0) {
  if (!RC) return null;
  if (RC.lane) { const [x0, x1, z0, z1] = RC.lane; return x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m; }
  for (let i = 0; i < RC.route.length - 1; i++) if (segD(x, z, RC.route[i], RC.route[i + 1]) < RC.half + m) return true;
  return RC.keep.some(k => Math.hypot(x - k.x, z - k.z) < k.r + m);
}
