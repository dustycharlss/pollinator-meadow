// Act 2 maps (Fern act2-mechanics-levels.md): Trailhead Trials + levels 9-16.
// Every map: one new mechanic + one new sneak-only enemy, safe teach room → enemy teach room → combo → exit.
// Built from the Act 2 kit in zones.js (B.lane / B.door / B.checkpoint / enemies / mechanics).
export const MAPS2 = {
  // dev-only lab (not on any level page): checkpoints, sneak, badger awareness
  a2_lab: {
    goal: 'Lab', act2: true, key: 'puzzles', ceil: 9, exit: [0, 30], par: 0,
    bounds: { x0: -12, x1: 12, z0: -8, z1: 34 },
    build(B) {
      B.home(0, 0); B.lane(-12, 12, -8, 34);
      B.checkpoint(0, 4);
      B.badger('b1', 0, 14, { yaw: Math.PI / 2, lure: [-9, 18], lurePt: [-7, 16] });
      B.checkpoint(0, 24);
      B.puzzle('lab', 'Lab', ['scout'], ['labDone'], { track: [['labDone', 'scout', 'walk past the badger', 0, 24]] });
    },
  },
};
