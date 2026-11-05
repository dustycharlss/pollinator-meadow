// Co-op puzzle sites: flattened corridors (terrain is levelled here) kept clear of scenery.
// Local frame: origin (x,z); u = (sin ang, cos ang) is the forward axis; the corridor spans s in [s0, s1] with half-width hw.
export const SITES = [
  { id: 'logroll', kind: 'logroll', x: -16, z: -8, ang: Math.PI / 2, s0: -4, s1: 26, hw: 7 },
  { id: 'scout', kind: 'scout', x: 40, z: -6, ang: 0, s0: 0, s1: 0, hw: 15 },
  { id: 'vine', kind: 'vine', x: -38, z: 8, ang: 0, s0: 0, s1: 0, hw: 10 },
  { id: 'sticks', kind: 'sticks', x: 6, z: 36, ang: 0, s0: -4, s1: 22, hw: 7 },
  { id: 'pad', kind: 'pad', x: -10, z: -44, ang: Math.PI / 2, s0: -4, s1: 32, hw: 8 },
  { id: 'moonvine', kind: 'vine', x: -68, z: 12, ang: 0, s0: 0, s1: 0, hw: 10 },
  { id: 'scout2', kind: 'scout', x: 68, z: -36, ang: 0, s0: 0, s1: 0, hw: 15 },
  { id: 'pad2', kind: 'pad', x: 18, z: -84, ang: -Math.PI / 2, s0: -4, s1: 32, hw: 8 },
];
export const siteDist = (S, x, z) => {
  const ux = Math.sin(S.ang), uz = Math.cos(S.ang), dx = x - S.x, dz = z - S.z;
  const s = Math.max(S.s0, Math.min(S.s1, dx * ux + dz * uz));
  return Math.hypot(dx - ux * s, dz - uz * s);
};
