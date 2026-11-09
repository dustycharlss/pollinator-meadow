// Act 2 maps (Fern act2-mechanics-levels.md): Trailhead Trials + levels 9-16.
// Every map: one new mechanic + one new sneak-only enemy, safe teach room → enemy teach room → combo → exit.
// Built from the Act 2 kit in zones.js (B.lane / B.door / B.checkpoint / enemies / mechanics).
export const MAPS2 = {
  // ===== Act 2 tutorial: 8 tiny trail stops, one new trick + one sleepy critter "peek" each (no fail, no stars) =====
  trailhead_trials: {
    goal: 'Trailhead Trials', kid: true, act2: true, peek: true, noStars: true, startCls: 'scout',
    key: 'puzzles', ceil: 8.5, exit: [0, 97], par: 0,
    bounds: { x0: -10, x1: 10, z0: -10, z1: 101 },
    kidStart: { me: [0, -6], trickster: [-2.5, -6.5], bruiser: [2.5, -7] },
    kidBounds: { x0: -4.9, x1: 4.9, z0: -9.2, z1: 99.2 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: [], end: [] },
    build(B) {
      B.home(-3, -8);
      B.fence(-5, -9.5, 5, 99.5);
      [[-8, -4], [8, 10], [-8, 24], [8, 38], [-8, 52], [8, 66], [-8, 80], [8, 94]].forEach(([x, z], i) => B.tree(x, z, 0.9 + (i % 3) * 0.1));
      // 1 · Light & Shadow + Sleepy Badger: turn the mirror, the sunbeam makes the ghost step solid
      B.sunlamp('sun1', -4, 2, 3, { to: 'm1' });
      B.mirror('m1', 0, 4.5, 1.4, [{ to: [-1.5, 9, 0.3] }, { lights: 'g1', to: [2.5, 8.5, 1.7] }]);
      B.ghost('g1', 2.5, 8.5, 3, 2.4, 1.6);
      B.kidFlower('f1', 2.5, 8.5, 1.6);
      B.badger('bd1', -3, 8, { yaw: Math.PI / 2 });
      B.kidGate('f1', 11);
      // 2 · Water Level + Snapping Turtle: the sluice drains the pond, walk the dry bed
      B.pond('p2', -5, 14, 5, 18, { level: 'high' });
      B.sluice('p2', 3, 12.5, 'low', { label: 'Sluice lever' });
      B.wall(-3.5, 16, 1.8, 1.8, 0.6, { look: 'stone' }); B.turtle('tu2', -3.5, 16, { base: 0.6, yaw: Math.PI / 2 });
      B.kidFlower('f2', 0, 20);
      B.kidGate('f2', 22.5);
      // 3 · Seed Growing + Grumpy Spider: plant, water with a dewdrop, climb the vine
      B.drip(-3, 25, 2.4);
      B.wall(3, 31.6, 4, 3, 4.4, { look: 'stone' });
      B.seed('sd3', 3, 27.6, { vine: [3, 29.4, 0, 3, 30.3, 4.4], vineLabel: 'Vine ladder' });
      B.kidFlower('f3', 3, 32, 4.4);
      B.spider('sp3', -3.5, 31, { yaw: 0 });
      B.kidGate('f3', 34.5);
      // 4 · Wind Vanes + Patrol Crow: crank the vane, the wind carries Bee up to the flower
      B.vane('v4', 3, 36.5);
      B.windZone(-5, 38, 5, 46, { dz: 1, push: 6, lift: 3, h: 6 });
      B.wall(-3.5, 41, 0.6, 0.6, 2.2, { look: 'bark' }); B.crow('cr4', -3.5, 41, 0.01, 2.6, { speed: 0.0001 });
      B.kidFlower('f4', 0, 44, 3.2);
      B.kidGate('f4', 46.5);
      // 5 · Carry Chain + Wasp Nest: stomp the calm-smoke mushroom, hand the acorn ring to ring
      B.puffShroom('m5', 3.5, 48.8);
      B.wasps('w5', -3.6, 56, { r: 2.6 });
      B.acornChain('ac5', [{ x: -2.5, z: 49.5, who: 'scout' }, { x: 0.5, z: 52.5, who: 'bruiser' }, { x: 2.5, z: 56, who: 'bruiser', home: true }]);
      B.kidGate('ac5:home', 58.5);
      // 6 · Day/Night + Night Owl, with BORROWED night gear (returned at the end)
      B.dayNightBell(0, 60.5, 2);
      B.glowStep(-3, 63, 2.4, 2, 1.3); B.glowStep(-3, 65.6, 2.4, 2, 2.6);
      B.kidFlower('f6', -3, 65.6, 2.6);
      B.hiddenLever('hl6', 3, 65.5, { label: 'Secret lever' });
      B.owl('ow6', 0, 69.2, { perch: 2.4, yaw: Math.PI, r: 7, half: 0.3 });
      B.kidGate('hl6', 70.8);
      B.onSig('hl6', (on, api) => { if (on) api.night(false); });
      // 7 · Seasons + Prowling Fox: winter freezes the creek and the log slides far on ice
      B.seasonBells(0, 72.6, 2);
      B.creek('c7', -5, 75, 5, 78);
      B.boulder('log7', -3, 80.4, -1.6, 80.4, { kind: 'log', w: 1.4, d: 2.2, h: 1.0, slotH: 0.2, need: ['winter'], needWhy: 'Ring the ❄️ winter bell first', label: 'Log' });
      B.iceSlot('ice7', 2.8, 80.4, 0.2);
      B.fox('fx7', -4, 74, { yaw: Math.PI / 2, ring: 3 });
      B.kidGate('ice7', 83.5);
      B.onSig('ice7', (on, api) => { if (on) api.season('summer'); });
      // 8 · Two-Room Split + Garden Hazards: Bee rings the bell in the left room, the gate opens in the right
      B.wall(0, 90, 0.6, 11, 2.4, { look: 'hedge' });
      B.wall(0, 90, 0.6, 11, 30, { bot: 2.3, hidden: true }).s.off = false;
      B.bell('b8', -2.5, 89.5, 2.0, { label: 'Bell' });
      B.gate('b8', 2.5, 92, 5, 0.6, 2.8, { latch: true, label: 'Gate' });
      B.wall(2.5, 92, 5, 0.6, 30, { bot: 2.7, hidden: true }).s.off = false;
      B.sprinkler('sk8', 2.6, 87.6, { yaw: Math.PI / 2, r: 3.5, speed: 0.3 });
      B.puzzle('trail', 'Trailhead Trials', ['scout', 'trickster', 'bruiser'], ['b8']);
    },
    steps: K => {
      const E = c => K.em(c);
      return [
        { n: 1, icons: ['🐾', '🦡'], say: 'Tap Sneak! Shh…', point: 'sneak', color: 'scout', latch: true, done: () => K.sneak() || K.lit('g1') || K.sig('f1') },
        { n: 1, icons: [E('scout'), '🪞', '☀️'], say: 'Turn the mirror!', point: 'int', glow: ['mir:m1'], color: 'scout', trail: [[0, -3], [0, 3]], tgt: [0, 1.6, 4.5], done: () => K.lit('g1') || K.sig('f1') },
        { n: 1, icons: ['⬆️', '🌼'], say: 'Hop on the sun step!', point: 'jump', glow: ['f1'], color: 'scout', trail: [[0.5, 5.5], [2.5, 7.4]], tgt: [2.5, 2.4, 8.5], done: () => K.sig('f1'), herd: { trickster: [-2, 10], bruiser: [0, 10] } },
        { n: 2, icons: ['🐾', '🏃'], say: 'Tap Sneak again!', point: 'sneak', latch: true, done: () => !K.sneak() || K.sig('f2') },
        { n: 2, icons: ['👆', E('trickster')], say: `Tap the ${E('trickster')}!`, point: 'dock:trickster', color: 'trickster', latch: false, done: () => K.cls() === 'trickster' || K.sig('p2:low') },
        { n: 2, icons: [E('trickster'), '🎚️', '💧'], say: 'Drain the pond!', point: 'int', glow: ['p2:low:lv'], color: 'trickster', trail: [[0, 10.5], [2.6, 12]], tgt: [3, 0.8, 12.5], done: () => K.sig('p2:low') },
        { n: 2, icons: ['➡️', '🌼'], say: 'Walk across!', glow: ['f2'], color: 'trickster', trail: [[0, 13], [0, 19]], tgt: [0, 0.6, 20], done: () => K.sig('f2'), herd: { scout: [-2, 21.5], bruiser: [2, 21.5] } },
        { n: 3, icons: [E('trickster'), '🌰'], say: 'Plant the seed!', point: 'int', glow: ['planted:sd3'], color: 'trickster', trail: [[0, 23], [2.6, 26.6]], tgt: [3, 0.6, 27.6], done: () => K.sig('planted:sd3') },
        { n: 3, icons: ['👆', E('scout')], say: `Tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => K.cls() === 'scout' || K.sig('grown:sd3') },
        { n: 3, icons: [E('scout'), '💧'], say: 'Fly to the drip!', point: 'jump', hold: true, color: 'scout', trail: [[-1, 23], [-3, 24.4]], tgt: [-3, 2.4, 25], latch: false, done: () => K.dew() || K.sig('grown:sd3') },
        { n: 3, icons: [E('scout'), '💧', '🌱'], say: 'Water the seed!', color: 'scout', trail: [[-2, 25.6], [2.6, 27.2]], tgt: [3, 0.8, 27.6], done: () => K.sig('grown:sd3') },
        { n: 3, icons: ['👆', E('trickster')], say: `Tap the ${E('trickster')}!`, point: 'dock:trickster', color: 'trickster', latch: false, done: () => K.cls() === 'trickster' || K.sig('f3') },
        { n: 3, icons: [E('trickster'), '🌿', '🌼'], say: 'Climb the vine!', point: 'int', glow: ['f3'], color: 'trickster', trail: [[1.5, 26.5], [3, 29]], tgt: [3, 5, 32], done: () => K.sig('f3'), herd: { scout: [-2, 33.5], bruiser: [0, 33.5] } },
        { n: 4, icons: [E('trickster'), '🌀', '🌬️'], say: 'Turn the wind!', point: 'int', glow: ['vane:v4'], color: 'trickster', trail: [[1, 35], [2.6, 36]], tgt: [3, 1.6, 36.5], done: () => K.wind() > 0 || K.sig('f4') },
        { n: 4, icons: ['👆', E('scout')], say: `Tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => K.cls() === 'scout' || K.sig('f4') },
        { n: 4, icons: [E('scout'), '🌬️', '🌼'], say: 'Fly with the wind!', point: 'jump', hold: true, glow: ['f4'], color: 'scout', trail: [[0, 36], [0, 42]], tgt: [0, 3.8, 44], done: () => K.sig('f4'), herd: { trickster: [-2, 47.2], bruiser: [1.5, 47] } },
        { n: 5, icons: ['👆', E('bruiser')], say: `Tap the ${E('bruiser')}!`, point: 'dock:bruiser', color: 'bruiser', latch: false, done: () => K.cls() === 'bruiser' || K.sig('smoke:m5') },
        { n: 5, icons: [E('bruiser'), '🍄', '💨'], say: 'Stomp the mushroom!', point: 'int', glow: ['smoke:m5'], color: 'bruiser', trail: [[1.5, 47.4], [3.2, 48]], tgt: [3.5, 1.2, 48.8], done: () => K.sig('smoke:m5') || K.carry('scout') || K.sig('ac5:r1') },
        { n: 5, icons: ['👆', E('scout')], say: `Tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => K.cls() === 'scout' || K.carry('scout') || K.sig('ac5:r1') },
        { n: 5, icons: [E('scout'), '🌰'], say: 'Grab the acorn!', point: 'int', glow: ['ac5:r0'], color: 'scout', trail: [[0, 46.8], [-2.4, 48.8]], tgt: [-2.5, 1.2, 49.5], done: () => K.carry('scout') || K.sig('ac5:r1') },
        { n: 5, icons: [E('scout'), '🌰', '⭕'], say: 'Drop it in the ring!', point: 'int', glow: ['ac5:r1'], color: 'scout', trail: [[-2, 50], [0.3, 52]], tgt: [0.5, 1, 52.5], done: () => K.sig('ac5:r1') },
        { n: 5, icons: ['👆', E('bruiser')], say: `Tap the ${E('bruiser')}!`, point: 'dock:bruiser', color: 'bruiser', latch: false, done: () => K.cls() === 'bruiser' || K.carry('bruiser') || K.sig('ac5:home') },
        { n: 5, icons: [E('bruiser'), '🌰'], say: 'Grab the acorn!', point: 'int', glow: ['ac5:r1'], color: 'bruiser', trail: [[2.5, 49.5], [0.8, 52]], tgt: [0.5, 1.2, 52.5], done: () => K.carry('bruiser') || K.sig('ac5:home') },
        { n: 5, icons: [E('bruiser'), '🌰', '🏠'], say: 'Carry it home!', point: 'int', glow: ['ac5:r2'], color: 'bruiser', trail: [[0.8, 53], [2.4, 55.4]], tgt: [2.5, 1.2, 56], done: () => K.sig('ac5:home'), herd: { scout: [-2, 59.2], trickster: [2, 59.2] } },
        { n: 6, icons: ['🏮', '🎶', '🎁'], say: 'Pip lends you gear!', latch: true, done: () => K.borrow() },
        { n: 6, icons: ['👆', E('scout')], say: `Tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => K.cls() === 'scout' || K.night() },
        { n: 6, icons: [E('scout'), '🌗', '🔔'], say: 'Ring the night bell!', point: 'jump', hold: true, glow: ['dnBell'], color: 'scout', trail: [[-1, 59.4], [0, 60]], tgt: [0, 2, 60.5], done: () => K.night() || K.sig('hl6') },
        { n: 6, icons: [E('scout'), '🏮', '🌼'], say: 'Lantern finds glow steps!', point: 'jump', glow: ['f6'], color: 'scout', trail: [[-1, 61], [-3, 62.4]], tgt: [-3, 3.4, 65.6], done: () => K.sig('f6') || K.sig('hl6') },
        { n: 6, icons: ['👆', E('trickster')], say: `Tap the ${E('trickster')}!`, point: 'dock:trickster', color: 'trickster', latch: false, done: () => K.cls() === 'trickster' || K.sig('hl6') },
        { n: 6, icons: [E('trickster'), '🎶', '👀'], say: 'Whistle finds secrets!', color: 'trickster', tgt: [3, 1, 65.5], latch: true, done: () => K.pinged() || K.sig('hl6') },
        { n: 6, icons: [E('trickster'), '🎚️'], say: 'Pull the secret lever!', point: 'int', glow: ['hl6'], color: 'trickster', trail: [[2, 61], [3, 64.6]], tgt: [3, 0.8, 65.5], done: () => K.sig('hl6'), herd: { scout: [-2, 71.4], bruiser: [2.6, 71.4] } },
        { n: 7, icons: ['👆', E('scout')], say: `Tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => K.cls() === 'scout' || K.season() === 'winter' || K.sig('ice7') },
        { n: 7, icons: [E('scout'), '❄️', '🔔'], say: 'Ring the snow bell!', point: 'jump', hold: true, glow: ['bell:winter'], color: 'scout', trail: [[-1.5, 71.6], [0, 72]], tgt: [0, 2, 72.6], done: () => K.season() === 'winter' || K.sig('ice7') },
        { n: 7, icons: ['👆', E('bruiser')], say: `Tap the ${E('bruiser')}!`, point: 'dock:bruiser', color: 'bruiser', latch: false, done: () => K.cls() === 'bruiser' || K.sig('ice7') },
        { n: 7, icons: [E('bruiser'), '🧊', '🪵'], say: 'Push the log! Wheee!', point: 'int', glow: ['log7'], color: 'bruiser', trail: [[2.6, 73], [0, 76.5], [-1.2, 80]], tgt: [-3, 1.4, 80.4], done: () => K.sig('ice7'), herd: { scout: [-2.5, 85.5], trickster: [2.5, 85] } },
        { n: 8, icons: ['👆', E('scout')], say: `Tap the ${E('scout')}!`, point: 'dock:scout', color: 'scout', latch: false, done: () => K.cls() === 'scout' || K.sig('b8') },
        { n: 8, icons: [E('scout'), '🔔', '🚪'], say: 'Ring it! Open their gate!', point: 'jump', hold: true, glow: ['b8'], color: 'scout', trail: [[-2.5, 86], [-2.5, 88.6]], tgt: [-2.5, 2, 89.5], done: () => K.sig('b8') },
        { n: 9, icons: ['🏁', E('scout'), E('trickster'), E('bruiser')], say: 'Everyone to the flag!', point: 'exit', glow: ['exit'], trail: [[2.5, 88], [2.5, 94], [0.5, 96]], tgt: [0, 1, 97], done: () => false },
      ];
    },
  },
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
