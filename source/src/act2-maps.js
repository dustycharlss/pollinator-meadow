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
  // ===== 9 · Sunbeam Grove — M1 Light & Shadow + E1 Sleepy Badger =====
  sunbeam_grove: {
    goal: 'Sunbeam Grove', act2: true, key: 'puzzles', ceil: 8.5, exit: [0, 61], par: 420,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 65 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🐝 Bee: Sunbeams make the ghost steps solid!', '🦝 Raccoon: And a sleepy badger… tiptoe with 🐾 Sneak.'], end: ['🐻 Bear: My shadow made a bridge!', '🐝 Bee: And nobody woke the badgers.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 64);
      [[-6.5, -4], [6.5, 8], [-6.5, 18], [6.5, 40], [-6.5, 52]].forEach(([x, z], i) => B.tree(x, z, 0.8 + (i % 2) * 0.15));
      // A · teach: the mirror bounces the sunbeam onto a ghost step → Raccoon climbs to the lever
      B.checkpoint(0, -1);
      B.sunlamp('sunA', -6, 3, 3, { to: 'mA' });
      B.mirror('mA', -2, 6, 1.6, [{ to: [-2, 11.5, 0.3] }, { lights: 'gA', to: [4, 8.5, 2.6] }], { label: 'Sun mirror' });
      B.ghost('gA', 4, 8.5, 3, 3, 2.4);
      B.wall(4, 12, 4, 3.4, 4.4, { look: 'stone' });
      B.lever('lvA', 4, 12.4, { base: 4.4, label: 'Ledge lever' });
      B.door('lvA', 14.5, -8, 8);
      // B · teach the badger: a narrow hedge path, sneak behind him or throw an acorn to lure him away
      B.checkpoint(0, 16.5);
      B.wall(-6, 22, 4, 5, 2.2, { look: 'hedge' }); B.wall(6, 22, 4, 5, 2.2, { look: 'hedge' });
      B.badger('bdB', 0.8, 22, { yaw: Math.PI / 2, lure: [-6.5, 26.5], lurePt: [-6, 26] });
      B.lever('lvB', 5.5, 26.5, { label: 'Gate lever' });
      B.door('lvB', 28.5, -8, 8);
      // C · Bear's shadow: park Bear in the sunbeam and his shadow turns the shadow-bridge solid
      B.checkpoint(0, 30);
      B.sunlamp('sunC', -6.5, 31, 3, { to: [-3, 31.5, 0.6], shade: [-3, 31.5, 1.7, 'gC'] });
      B.marker('bruiser', -3, 31.5, 0, 'Stand in the sunbeam'); B.tag('spotC');
      B.pond('stC', -8, 33.5, 8, 37.5, { level: 'mid' });
      B.ghost('gC', 3, 35.5, 2.6, 5, 0.45, { shadow: true, cross: true, bot: -0.3 });
      B.lever('lvC', 5, 40, { label: 'Bridge lever' });
      B.bridgeOn('lvC', -2, 33, -2, 38, 2.6);
      B.door('lvC', 43, -8, 8, { x: -2 });
      // D · combo: shutter lever + two mirrors aim a beam on the far gate's sun-lock; badger + gravel on the way
      B.checkpoint(-5, 45);
      B.lever('shD', -6, 47.5, { label: 'Shutter lever' });
      B.sunlamp('sunD', -6, 50.5, 3, { need: 'shD', to: 'mD1' });
      B.mirror('mD1', -1, 50.5, 1.6, [{ to: [-1, 46, 0.3] }, { to: 'mD2' }], { label: 'Sun mirror' });
      B.mirror('mD2', 4.5, 54, 1.6, [{ to: [7, 50, 0.3] }, { lights: 'gD', to: [2, 57.4, 1.6] }], { label: 'Sun mirror' });
      B.ghost('gD', 2, 57.4, 2.4, 0.5, 2.6, { bot: 0.9 });
      B.gravel(-1, 52.5, 7.5, 56);
      B.badger('bdD', 1, 54, { yaw: -Math.PI / 2, ring: 5, lure: [7, 47], lurePt: [6.5, 47.5] });
      B.door('lit:gD', 58, -8, 8);
      B.checkpoint(0, 59.5);
      B.puzzle('mirror', 'Sun step', ['scout', 'trickster'], ['lvA'], { hint: '🪽 Turn the mirror so the sunbeam hits the ghost step · 🐾 climb up and pull the lever.', track: [['lit:gA', 'scout', 'turn the sun mirror onto the ghost step', -2, 6, 1.6], ['lvA', 'trickster', 'hop up the sun step and pull the lever', 4, 12.4, 4.4]] });
      B.puzzle('badger', 'Sleepy Badger', ['trickster'], ['lvB'], { hint: '🐾 Sneak behind the badger (or throw an acorn at the far stump to lure him) and pull the gate lever.', track: [['lvB', 'trickster', 'sneak 🐾 past the badger, pull the lever', 5.5, 26.5]] });
      B.puzzle('shadow', 'Shadow bridge', ['bruiser', 'trickster'], ['lvC'], { hint: '🐻 Stand Bear in the sunbeam · 🐾 cross the shadow bridge and pull the lever.', track: [['shade:gC', 'bruiser', 'stand in the sunbeam to cast a shadow bridge', -3, 31.5], ['lvC', 'trickster', 'cross the shadow bridge, pull the lever', 5, 40]] });
      B.puzzle('beam', 'Sun-lock gate', ['trickster', 'scout'], ['lit:gD'], { hint: '🐾 Open the shutter · 🪽 aim both mirrors at the gate’s sun-lock. Gravel is noisy — lure the badger first!', track: [['shD', 'trickster', 'open the shutter lever', -6, 47.5], ['lit:gD', 'scout', 'aim both mirrors at the gate’s sun-lock', -1, 50.5, 1.6]] });
    },
  },
  // ===== 10 · Mill Pond — M2 Water Level + E2 Snapping Turtle =====
  mill_pond: {
    goal: 'Mill Pond', act2: true, key: 'puzzles', ceil: 8.5, exit: [0, 55], par: 420,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 59 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🦝 Raccoon: Sluice levers set the water low, middle or high!', '🐝 Bee: Watch the turtle — it snaps at anyone in front.'], end: ['🐻 Bear: I rode a log! Like a boat!', '🦝 Raccoon: And the turtle never even woke up.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 58);
      [[-6.5, -4], [6.5, 14], [-6.5, 30], [6.5, 50]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 2) * 0.1));
      // A · teach: drain the pond to reach the lever on the dry bed
      B.checkpoint(0, -1);
      B.pond('pA', -8, 4, 8, 10.5, { level: 'mid' });
      B.sluice('pA', -5, 2, 'low', { label: 'Sluice · water down' }); B.sluice('pA', 5, 2, 'mid', { label: 'Sluice · water middle' });
      B.lever('lvA', 0, 7.2, { label: 'Pond-bed lever' });
      B.door('lvA', 14.5, -8, 8);
      // B · teach the turtle: it guards the stepping-stone ford. Float the leaf to make it look away, or raise the water so it naps
      B.checkpoint(0, 16.5);
      B.pond('pB', -8, 21, 8, 27, { level: 'mid' });
      B.bridgeFixed(0, 20.6, 0, 27.4, 2.6);
      B.turtle('tuB', 0, 24, { yaw: Math.PI, pond: 'pB', leaf: [-5, 19], leafTo: [-7, 27] });
      B.sluice('pB', 5, 19, 'high', { label: 'Sluice · water up' });
      B.lever('lvB', 4, 29.5, { label: 'Gate lever' });
      B.door('lvB', 31.5, -8, 8);
      // C · combo: low water → Raccoon walks the bed to the mill lever; high water → the turtle naps and Bear rides the log
      B.checkpoint(0, 33);
      B.pond('pC', -8, 36, 8, 46, { level: 'mid' });
      B.sluice('pC', 6, 34.2, 'low', { label: 'Sluice · water down' });
      B.sluice('pC', 6, 47.6, 'high', { label: 'Sluice · water up' });
      B.lever('lvC', 4, 41, { label: 'Mill lever' });
      B.floatLog('lgC', 'pC', -4, 37.4, -4, 44.6, { w: 2.6, d: 2.2 });
      B.turtle('tuC', -4, 48, { yaw: Math.PI, pond: 'pC', nap: 16 });
      B.door(['lvC', 'log:lgC'], 50, -8, 8);
      B.checkpoint(0, 52);
      B.puzzle('drain', 'Dry pond bed', ['trickster'], ['lvA'], { hint: '🐾 Pull the water-down sluice, then walk the dry bed to the lever.', track: [['pA:low', 'trickster', 'pull the sluice to lower the water', -5, 2], ['lvA', 'trickster', 'walk the dry bed, pull the lever', 0, 7.2]] });
      B.puzzle('ford', 'Turtle ford', ['trickster'], ['lvB'], { hint: '🐾 Flick the floating leaf so the turtle looks away (or raise the water so it naps), then cross the ford.', track: [['lvB', 'trickster', 'distract the turtle, cross the ford, pull the lever', 4, 29.5]] });
      B.puzzle('mill', 'Mill run', ['trickster', 'bruiser'], ['lvC', 'log:lgC'], { hint: '🐾 Water down → walk the bed to the mill lever · water up on the far side → 🐻 ride the log while the turtle naps.', track: [['lvC', 'trickster', 'water down (sluice), walk the bed to the mill lever', 4, 41], ['log:lgC', 'bruiser', 'water up (far sluice), hop on the log and float across', -4, 37.4]] });
    },
  },
  // ===== 11 · Bramble Patch — M3 Seed Growing + E3 Grumpy Spider =====
  bramble_patch: {
    goal: 'Bramble Patch', act2: true, key: 'puzzles', ceil: 9.5, exit: [0, 65], par: 480,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 69 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🦝 Raccoon: I plant the seeds…', '🐝 Bee: …I bring the dewdrops! And mind the spider webs.'], end: ['🐻 Bear: BOING! Best mushroom ever.', '🦝 Raccoon: Snip snip — the spider never saw me.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 68);
      [[6.5, -4], [-6.5, 18], [6.5, 30], [-6.5, 50]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 2) * 0.1));
      // A · teach the vine: plant, water with a dewdrop, climb to the pillar lever
      B.checkpoint(0, -1);
      B.drip(4.5, 3.5, 2.4);
      B.wall(-4.5, 10, 3.4, 3.4, 4.6, { look: 'stone' });
      B.seed('sA', -4.5, 6.4, { vine: [-4.5, 7.9, 0, -4.5, 8.7, 4.6] });
      B.lever('lvA', -4.5, 10.3, { base: 4.6, label: 'Pillar lever' });
      B.door('lvA', 14, -8, 8);
      // B · teach the mushroom pad: Bear's weight bounces highest — up to the ledge plate
      B.checkpoint(0, 16);
      B.drip(-5, 18.5, 2.4);
      B.seed('sB', 2.5, 19, { grow: 'pad', padAt: [2.5, 21], padTo: [3, 25.6, 6.6] });
      B.wall(3, 25.5, 6, 3, 6.6, { look: 'stone' });
      B.plate('plB', 3, 25.6, { heavy: true, base: 6.6, label: 'ledge plate' });
      B.door('plB', 29, -8, 8, { x: -3 });
      // C · teach the spider: she watches her web. Pluck the far strand so she looks away, then snip!
      B.checkpoint(-3, 31);
      B.spider('spC', 4.5, 40.5, { yaw: Math.PI });
      B.door(null, 37, -8, 8, { w: 3.2, x: 0 });
      B.web('wC', 0, 37, 3.2, 3.2, { spider: 'spC' });
      B.strand('spC', 6.5, 33.5, { label: 'Web strand' });
      // D · combo: a web guards the seed spot; plant + water a mushroom so Bear can bounce to the exit-gate plate
      B.checkpoint(0, 44);
      B.spider('spD', -4.5, 51.5, { yaw: Math.PI });
      const hw = (x, z, w, d) => { B.wall(x, z, w, d, 3.2, { look: 'hedge' }); B.wall(x, z, w, d, 30, { bot: 3, hidden: true }).s.off = false; };
      hw(-1.6, 52, 0.6, 9.4); hw(-6.8, 47.3, 2.4, 0.6); hw(-2.5, 47.3, 1.8, 0.6);
      B.web('wD', -4.5, 47.3, 2.2, 3.2, { spider: 'spD' });
      B.strand('spD', 2, 51.5, { label: 'Web strand' });
      B.drip(5.5, 46, 2.4);
      B.seed('sD', -6.8, 52.2, { grow: 'pad', padAt: [-6.8, 54.4], padTo: [-5, 56.2, 6.6] });
      B.wall(-5, 56, 6, 2.6, 6.6, { look: 'stone' });
      B.plate('plD', -5, 56.2, { heavy: true, base: 6.6, label: 'ledge plate' });
      B.door('plD', 60, -8, 8);
      B.checkpoint(0, 62);
      B.puzzle('vine', 'Vine ladder', ['trickster', 'scout'], ['lvA'], { hint: '🐾 Plant the seed · 🪽 bring a dewdrop from the drip leaf · 🐾 climb the vine and pull the lever.', track: [['planted:sA', 'trickster', 'plant the seed by the pillar', -4.5, 6.4], ['grown:sA', 'scout', 'fly to the drip leaf, bring a dewdrop to the seed', 4.5, 3.5, 2.4], ['lvA', 'trickster', 'climb the vine, pull the lever', -4.5, 10.3, 4.6]] });
      B.puzzle('pad', 'Mushroom bounce', ['trickster', 'scout', 'bruiser'], ['plB'], { hint: '🐾 Plant · 🪽 water · 🐻 bounce on the mushroom up to the ledge plate.', track: [['planted:sB', 'trickster', 'plant the seed', 2.5, 19], ['grown:sB', 'scout', 'bring a dewdrop to the seed', -5, 18.5, 2.4], ['plB', 'bruiser', 'bounce on the mushroom onto the ledge plate', 2.5, 21]] });
      B.puzzle('web', 'Spider web', ['trickster'], ['wC'], { hint: '🐾 Pluck the far web strand so the spider turns away, then snip the web.', track: [['pluck:spC', 'trickster', 'pluck the strand so the spider looks away', 6.5, 33.5], ['wC', 'trickster', 'snip the web while she looks away!', 0, 37]] });
      B.puzzle('nest', 'Bramble garden', ['trickster', 'scout', 'bruiser'], ['plD'], { hint: '🐾 Pluck the strand, snip the web, plant · 🪽 water · 🐻 bounce to the gate plate.', track: [['wD', 'trickster', 'pluck the strand, then snip the web', 2, 51.5], ['planted:sD', 'trickster', 'sneak in behind the spider, plant the seed', -6.8, 52.2], ['grown:sD', 'scout', 'bring a dewdrop to the seed', 5.5, 46, 2.4], ['plD', 'bruiser', 'slip in while she looks away, bounce up to the gate plate', -6.8, 54.4]] });
    },
  },
  // ===== 12 · Weathervane Hill — M4 Wind Vanes + E4 Patrol Crow =====
  weathervane_hill: {
    goal: 'Weathervane Hill', act2: true, key: 'puzzles', ceil: 9.5, exit: [0, 57], par: 480,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 61 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🦝 Raccoon: Crank a vane and the wind flips for the whole hill!', '🐻 Bear: I’m too heavy for wind. I’ll hold the dandelion rafts.'], end: ['🐝 Bee: The crow never spotted me under the leaves!', '🦝 Raccoon: Raft rides are the best rides.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 60);
      [[6.5, -4], [-6.5, 30], [6.5, 46]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 2) * 0.1));
      // A · teach: the wind blows DOWN the hill. Crank the vane so it blows UP, Bear holds the raft while Raccoon boards, then lets go
      B.checkpoint(0, -1);
      B.vane('vA', 4.5, 2.5, { label: 'Vane crank' });
      B.windZone(-8, 3, 8, 14, { dz: 1, push: 5, lift: 3, h: 6 });
      B.wall(-3.5, 13, 5, 3, 5, { look: 'stone' });
      B.puffRaft('rA', -3.5, 7.5, [-3.5, 12.6, 5]);
      B.lever('lvA', -3.5, 13.3, { base: 5, label: 'Hilltop lever' });
      B.door('lvA', 16, -8, 8);
      // B · teach the crow: it circles and swoops at flyers in its cone. Hide under leaf canopies, or fly while its back is turned
      B.checkpoint(0, 18);
      B.crow('crB', 0, 26, 4.2, 4.6, { speed: 2.6 });
      B.hide('canopy', -4.5, 22, 2.4, 4.2); B.hide('canopy', 4.5, 29, 2.4, 4.2);
      B.wall(0, 26, 0.6, 0.6, 4.4, { look: 'bark' }); B.bell('blB', 0, 26, 5, { label: 'Crow-post bell' });
      B.door('blB', 33, -8, 8);
      B.onSig('blB', (on, api) => { if (on) api.wind(-1); });
      // C · combo: wind + crow + raft. Bee rings the gust bell, Raccoon rafts to the ridge lever, the crow circles above both
      B.checkpoint(0, 35);
      B.vane('vC', -5.5, 36.5, { label: 'Vane crank' });
      B.windZone(-8, 38, 8, 50, { dz: 1, push: 6, lift: 3, h: 7 });
      B.crow('crC', 0, 44, 5, 5.2, { speed: 3, ang: 2 });
      B.hide('canopy', -1.5, 41, 2.4, 4.4); B.hide('canopy', 4.5, 47, 2.2, 4.4);
      B.wall(5.5, 41.5, 0.6, 0.6, 5.4, { look: 'bark' }); B.bell('blC', 5.5, 41.5, 6, { label: 'Gust bell' });
      B.wall(-4.5, 48.5, 6, 3, 5.4, { look: 'stone' });
      B.puffRaft('rC', -4.5, 43.5, [-4.5, 48.2, 5.4]);
      B.lever('lvC', -4.5, 49, { base: 5.4, label: 'Ridge lever' });
      B.door(['blC', 'lvC'], 52, -8, 8);
      B.checkpoint(0, 54);
      B.puzzle('raft', 'Dandelion raft', ['trickster', 'bruiser'], ['lvA'], { hint: '🐾 Crank the vane so the wind blows UP · 🐻 hold the raft · 🐾 hop on · 🐻 let go!', track: [['wind:up', 'trickster', 'crank the vane so the wind blows up the hill', 4.5, 2.5], ['raft:rA', 'bruiser', 'hold the raft, Raccoon hops on, then Bear steps off', -3.5, 7.5], ['lvA', 'trickster', 'pull the hilltop lever', -3.5, 13.3, 5]] });
      B.puzzle('crow', 'Crow post', ['scout'], ['blB'], { hint: '🪽 Wait under a leaf canopy until the crow’s back is turned, then fly up and ring the bell.', track: [['blB', 'scout', 'hide under the leaves, then ring the crow-post bell', 0, 26, 5]] });
      B.puzzle('ridge', 'Windy ridge', ['scout', 'trickster', 'bruiser'], ['blC', 'lvC'], { hint: '🐾 Wind up · 🪽 ring the gust bell when the crow looks away · 🐻 + 🐾 raft to the ridge lever.', track: [['wind:up', 'trickster', 'crank the vane: wind up!', -5.5, 36.5], ['blC', 'scout', 'dodge the crow, ring the gust bell', 5.5, 41.5, 6], ['lvC', 'trickster', 'raft up to the ridge lever (Bear holds, then lets go)', -4.5, 43.5]] });
    },
  },
  // ===== 13 · Hornet Hedge — M5 Carry Chain + E5 Wasp Nest =====
  hornet_hedge: {
    goal: 'Hornet Hedge', act2: true, key: 'puzzles', ceil: 9.5, exit: [0, 61], par: 480,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 65 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🐻 Bear: The Golden Acorn is heavy — we pass it ring to ring.', '🐝 Bee: And stay out of the buzz zones! Bear’s mushrooms calm the wasps.'], end: ['🦝 Raccoon: Teamwork relay!', '🐻 Bear: The wasps didn’t even notice.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 64);
      [[6.5, -4], [-6.5, 20], [6.5, 36]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 2) * 0.1));
      // A · teach the chain: Bee fetches the acorn off the high shelf → hand-off ring → Bear carries it home
      B.checkpoint(0, -1);
      B.wall(-5, 4, 3, 3, 4.6, { look: 'stone' });
      B.acornChain('acA', [{ x: -5, z: 4, h: 4.6, who: 'scout' }, { x: 1.5, z: 7, who: 'bruiser' }, { x: 5, z: 12.5, who: 'bruiser', home: true }]);
      B.door('acA:home', 15, -8, 8);
      // B · teach the wasps: their buzz zone covers the path. Bear stomps the puff-mushroom → 6 s of calm smoke
      B.checkpoint(0, 17);
      B.wall(-6, 25, 4, 6, 3, { look: 'hedge' }); B.wall(6, 25, 4, 6, 3, { look: 'hedge' });
      B.wasps('wB', 0, 25, { r: 4.6 });
      B.puffShroom('mB', -3.5, 19.5, { r: 6, dur: 7 });
      B.lever('lvB', 3.5, 30.5, { label: 'Gate lever' });
      B.door('lvB', 32, -8, 8);
      // C · combo relay (timed: catch the acorn within 5 s): Raccoon climbs it up, Bee flies it high over the nest, Bear carries it home
      B.checkpoint(0, 34);
      B.wall(-5, 40.5, 3, 3, 4.4, { look: 'stone' });
      B.vine(-5, 38.6, 0, -5, 39.4, 4.4, { label: 'Vine' });
      B.wasps('wC', 0, 46, { r: 5.5 });
      B.wall(-6.5, 46, 3, 3, 3, { look: 'hedge' }); B.wall(6.5, 46, 3, 3, 3, { look: 'hedge' });
      B.puffShroom('mC', 2.5, 39.5, { r: 6, dur: 8 });
      B.acornChain('acC', [{ x: -3, z: 36, who: 'trickster' }, { x: -5, z: 40.8, h: 4.4, who: 'scout' }, { x: 4.5, z: 52, who: 'bruiser' }, { x: 0, z: 56, who: 'bruiser', home: true }], { timed: true });
      B.door('acC:home', 58, -8, 8);
      B.checkpoint(0, 59.5);
      B.puzzle('relay', 'Acorn relay', ['scout', 'bruiser'], ['acA:home'], { hint: '🪽 Grab the Golden Acorn off the high shelf, drop it in the hand-off ring · 🐻 carry it home.', track: [['acA:r1', 'scout', 'fetch the acorn from the high shelf, drop it in the ring', -5, 4, 4.6], ['acA:home', 'bruiser', 'pick up the acorn and carry it home', 1.5, 7]] });
      B.puzzle('wasps', 'Buzz zone', ['bruiser', 'trickster'], ['lvB'], { hint: '🐻 Stomp the puff-mushroom · everyone walks through the calm smoke · 🐾 pull the lever.', track: [['smoke:mB', 'bruiser', 'stomp the puff-mushroom for calm smoke', -3.5, 19.5], ['lvB', 'trickster', 'hurry through the smoke, pull the lever', 3.5, 30.5]] });
      B.puzzle('chain', 'Hornet relay', ['trickster', 'scout', 'bruiser'], ['acC:home'], { hint: '🐻 Smoke + walk to the far ring · 🐾 climb the acorn up the vine · 🪽 fly it high over the nest · 🐻 carry it home. Hand-offs must be caught within 5 s!', track: [['acC:r1', 'trickster', 'carry the acorn up the vine to the ledge ring', -3, 36], ['acC:r2', 'scout', 'fly the acorn high over the nest to the far ring', -5, 40.8, 4.4], ['acC:home', 'bruiser', 'catch it and carry it home', 4.5, 52]] });
    },
  },
  // ===== 14 · Owl Wood — M6 Day/Night + E6 Night Owl, and the night gear (Glow Lantern + Echo Whistle) =====
  owl_wood: {
    goal: 'Owl Wood', act2: true, moody: true, key: 'puzzles', ceil: 9.5, exit: [0, 61], par: 480,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 65 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🐝 Bee: Something shiny on that stump… a lantern?!', '🦝 Raccoon: The old owl only wakes at night. Stay behind the big trunks!'], end: ['🐝 Bee: My lantern makes glowing steps!', '🦝 Raccoon: And my whistle finds secret switches. Best. Gear. Ever.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 64);
      [[6.5, -4], [-6.5, 36], [6.5, 58]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 2) * 0.1));
      // A · the Glow Lantern: Bee flies up to the gift on the stump, then her lantern makes glow-steps solid for Raccoon
      B.checkpoint(0, -1);
      B.wall(-5, 4, 2.6, 2.6, 3.2, { look: 'bark' });
      B.gift('lantern', -5, 4, 3.8);
      B.glowStep(2.5, 6.5, 2.4, 2, 1.3); B.glowStep(2.5, 8.6, 2.4, 2, 2.6); B.glowStep(2.5, 10.7, 2.4, 2, 3.9);
      B.wall(2.5, 13, 4, 2.6, 3.9, { look: 'stone' });
      B.lever('lvA', 2.5, 13.2, { base: 3.9, label: 'Ledge lever' });
      B.door('lvA', 16, -8, 8);
      // B · night and the owl: ring the night bell → the moon gate opens, but the owl wakes. Sneak trunk to trunk to its lever
      B.checkpoint(0, 18);
      B.dayNightBell(4.5, 19.5, 2, { label: 'Night bell' });
      B.door('night', 22, -8, 8, { label: 'Moon gate' });
      B.owl('owB', 0, 32, { perch: 3.5, yaw: Math.PI, r: 9, half: 0.34 });
      B.hide('trunk', -3.5, 25.5, 1.2); B.hide('trunk', -4, 29.5, 1.2); B.hide('trunk', 3.5, 27, 1.2);
      B.lever('lvB', -6.5, 33.2, { label: 'Owl-tree lever' });
      B.door('lvB', 36, -8, 8);
      // C · combo, still night: Raccoon finds the Echo Whistle, pings the hidden steps + secret lever; Bear sneaks behind a trunk to the plate
      B.checkpoint(0, 38);
      B.gift('whistle', 5.5, 39.5);
      B.owl('owC', 0, 54, { perch: 3.5, yaw: Math.PI, r: 9, half: 0.34, sweep: 0.5 });
      B.hide('trunk', -4, 49.5, 1.0); B.hide('trunk', 2, 46, 1.0);
      B.hiddenStep(5.5, 45.5, 2.2, 2, 1.3); B.hiddenStep(5.5, 47.6, 2.2, 2, 2.6);
      B.wall(5.5, 50.2, 3, 3, 3.9, { look: 'stone' });
      B.hiddenLever('hlC', 5.5, 50.4, { base: 3.9, label: 'Secret lever' });
      B.plate('plC', -6.2, 51, { heavy: true, label: 'Root plate' });
      B.door(['hlC', 'plC'], 57, -8, 8);
      B.checkpoint(0, 59);
      B.puzzle('lantern', 'Glow Lantern', ['scout', 'trickster'], ['lvA'], { hint: '🪽 Fly up to the gift on the stump · stay near the steps with the 🏮 on · 🐾 climb the glow-steps to the lever.', track: [['gift:lantern', 'scout', 'fly up to the shiny gift on the stump', -5, 4, 3.2], ['lvA', 'trickster', 'climb the glow-steps while Bee’s lantern shines, pull the lever', 2.5, 6.5]] });
      B.puzzle('owl', 'Night owl', ['scout', 'trickster'], ['lvB'], { hint: '🪽 Ring the night bell to open the moon gate · 🐾 sneak trunk to trunk while the owl looks away · pull the lever.', track: [['night', 'scout', 'ring the night bell', 4.5, 19.5, 2], ['lvB', 'trickster', 'hide behind the trunks, sneak to the owl-tree lever', -6.5, 33.2]] });
      B.puzzle('echo', 'Echo whistle', ['trickster', 'bruiser'], ['hlC', 'plC'], { hint: '🐾 Grab the gift · the 🎶 whistle pings hidden steps + a secret lever · 🐻 sneak behind the trunk onto the root plate.', track: [['gift:whistle', 'trickster', 'grab the gift on the quiet side', 5.5, 39.5], ['hlC', 'trickster', 'ping, climb the hidden steps, pull the secret lever', 5.5, 45.5], ['plC', 'bruiser', 'sneak behind the trunk onto the root plate', -6.2, 51]] });
    },
  },
  // ===== 15 · Frost Hollow — M7 Seasons (creek ice, snow steps, mud chute) + E7 Prowling Fox =====
  frost_hollow: {
    goal: 'Frost Hollow', act2: true, key: 'puzzles', ceil: 9.5, exit: [0, 61], par: 480,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 65 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🐝 Bee: Three bells — summer, winter, spring! I’ll ring them.', '🦝 Raccoon: Winter freezes the creek, spring makes mud for sliding…', '🐻 Bear: …and snow hides Bee’s scent from the fox.'], end: ['🦝 Raccoon: That mud chute was the best!', '🐝 Bee: The fox never sniffed me out.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 64);
      [[6.5, -4], [-6.5, 14], [6.5, 36]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 2) * 0.1));
      // A · teach the seasons: ring ❄️ winter → the creek freezes and everyone walks across the ice
      B.checkpoint(0, -1);
      B.seasonBells(0, 2, 2);
      B.creek('cA', -8, 6, 8, 10);
      B.lever('lvA', 3.5, 12.5, { label: 'Frosty lever' });
      B.door('lvA', 15.5, -8, 8);
      // B · snow steps (winter only) up to the ledge · then 🌱 spring turns the chute to mud: belly-slide over the hedge
      B.checkpoint(0, 17.5);
      B.seasonBells(3, 19.5, 2);
      B.snowPile('snB1', -4.5, 20.6, 2.4, 2, 1.3); B.snowPile('snB2', -4.5, 22.7, 2.4, 2, 2.6);
      B.wall(-4.5, 25.4, 4, 3.2, 3.9, { look: 'stone' });
      B.door('lvB', 28.5, -8, 8);
      B.mudSlide('mdB', -4.5, 26.4, 3.9, -1, 32, 0, { label: 'Mud chute' });
      B.lever('lvB', 3.5, 32.5, { label: 'Hollow lever' });
      // C · combo: the fox prowls by the bell post. Hide in the hollow log or ring winter (snow hides your scent) · Bear slides the log across the ice
      B.checkpoint(0, 35.5);
      B.seasonBells(-3, 37.5, 2);
      B.creek('cC', -8, 41.5, 8, 46.5);
      B.boulder('logC', -5, 44, -3.6, 44, { kind: 'log', w: 1.4, d: 2.2, h: 1.0, slotH: 0.2, need: ['winter'], needWhy: 'Ring the ❄️ winter bell first — it only slides on ice', label: 'Log' });
      B.iceSlot('iceC', 5, 44, 0.2);
      B.fox('fxC', 0, 51, { yaw: Math.PI, ring: 5, path: [[-4, 51], [4, 51]], speed: 1.4 });
      B.hide('log', -2.5, 53.5, 1.4, 1.4);
      B.wall(5, 54, 0.6, 0.6, 2, { look: 'bark' }); B.bell('blC', 5, 54, 2.6, { label: 'Fox-post bell' });
      B.door(['iceC', 'blC'], 57, -8, 8);
      B.checkpoint(0, 59);
      B.puzzle('ice', 'Frozen creek', ['scout', 'trickster'], ['lvA'], { hint: '🪽 Fly into the ❄️ winter bell · the creek freezes · 🐾 walk across the ice and pull the lever.', track: [['winter', 'scout', 'fly into the ❄️ winter bell', 0, 2, 2], ['lvA', 'trickster', 'walk across the ice, pull the lever', 3.5, 12.5]] });
      B.puzzle('mud', 'Mud chute', ['scout', 'trickster'], ['lvB'], { hint: '🪽 Winter → 🐾 climb the snow steps to the ledge · 🪽 Spring → 🐾 belly-slide down the mud chute over the hedge · pull the lever.', track: [['mdB', 'trickster', 'winter: climb the snow steps · spring: slide the mud chute', -4.5, 20.6], ['lvB', 'trickster', 'pull the hollow lever', 3.5, 32.5]] });
      B.puzzle('fox', 'Fox hollow', ['scout', 'bruiser'], ['iceC', 'blC'], { hint: '❄️ Winter: 🐻 shove the log — it slides across the ice into the slot · 🪽 sneak past the fox (hollow log, or let the snow hide your scent) and ring the post bell.', track: [['iceC', 'bruiser', 'winter: shove the log across the ice', -5, 44], ['blC', 'scout', 'dodge the fox’s nose, ring the fox-post bell', 5, 54, 2.6]] });
    },
  },
  // ===== 16 · Backyard Split — M8 Two-Room Split + E8 Garden Hazards (sprinkler, mower) =====
  backyard_split: {
    goal: 'Backyard Split', act2: true, key: 'puzzles', ceil: 9.5, exit: [0, 58], par: 480,
    bounds: { x0: -9, x1: 9, z0: -8, z1: 62 },
    crew: 'Bee · Raccoon · Bear',
    banter: { start: ['🦝 Raccoon: A hedge splits the yard! I’m on the left…', '🐻 Bear: …Bee and I are on the right. Switches on one side open gates on the other!'], end: ['🐝 Bee: Back together again!', '🦝 Raccoon: I timed that mower perfectly.'] },
    build(B) {
      B.home(0, -5); B.lane(-8, 8, -7, 61);
      B.split({ trickster: [-4, -1], scout: [3, -1, 1], bruiser: [5, -1] });
      // the dividing hedge (low to see over, invisible tall cap so nobody hops it)
      B.wall(0, 18.25, 0.6, 51.5, 2.4, { look: 'hedge' }); B.wall(0, 18.25, 0.6, 51.5, 30, { bot: 2.3, hidden: true }).s.off = false;
      const gate = (s, x, z) => { B.gate(s, x, z, 8, 0.6, 2.8, { latch: true, label: 'Gate' }); B.wall(x, z, 8, 0.6, 30, { bot: 2.7, hidden: true }).s.off = false; };
      B.checkpoint(-4, 1.5); B.checkpoint(4, 1.5);
      // 1 · cross-room switch: Raccoon’s lever (left) opens the right gate
      B.lever('lvL1', -4, 7, { label: 'Garden lever' });
      gate('lvL1', 4, 10);
      // 2 · sprinkler + plate pause: Raccoon holds the tap plate (left) → the sprinkler (right) stops while Bear crosses to smash the fence
      gate('crR', -4, 12);
      B.plate('plL', -4, 9.5, { label: 'Tap plate' });
      B.checkpoint(4, 12.5);
      B.sprinkler('skR', 7.2, 19, { yaw: -Math.PI / 2, r: 7, speed: 0.7, sweep: 1.1, pause: 'plL', high: 9, beam: 0.26, grace: 0.4 }); // its spray arcs sky-high: flying Bee gets wet too
      B.cracked('crR', 4, 26, 7.4, 0.8, 2.2, { label: 'Old fence' });
      // 3 · mower timer: when the mower rests, Raccoon dashes across its lane to the shed lever → opens the right gate for Bee
      B.checkpoint(-4, 14.5);
      B.mower('mwL', -7.4, -0.6, 22, { period: 7, dur: 2.6 });
      B.lever('lvL3', -4, 31, { label: 'Shed lever' });
      gate('lvL3', 4, 30);
      B.checkpoint(4, 28.5); B.checkpoint(-4, 33);
      // 4 · back together: Bee rings the birdhouse bell (right) → the last gate opens for everyone
      B.wall(4, 38, 0.6, 0.6, 2.6, { look: 'bark' }); B.bell('blR', 4, 38, 3.2, { label: 'Birdhouse bell' });
      B.door('blR', 50, -8, 8);
      B.checkpoint(0, 53);
      B.puzzle('gate1', 'Cross-yard gate', ['trickster'], ['lvL1'], { hint: '🐾 Pull the lever on the left — the gate opens on the RIGHT side!', track: [['lvL1', 'trickster', 'pull the lever (it opens the gate in the other room)', -4, 7]] });
      B.puzzle('tap', 'Sprinkler tap', ['trickster', 'bruiser'], ['crR'], { hint: '🐾 Stand on the tap plate (left) to stop the sprinkler · its spray reaches high, so 🐻 AND 🪽 cross while it’s off · 🐻 smash the old fence.', track: [['plL', 'trickster', 'stand on the tap plate to stop the sprinkler', -4, 9.5], ['crR', 'bruiser', 'cross while it’s off (Bee too — the spray reaches flyers), smash the old fence', 4, 26]] });
      B.puzzle('mower', 'Mower dash', ['trickster'], ['lvL3'], { hint: '🐾 Wait for the mower to stop (it flashes ? before it goes), then dash across and pull the shed lever.', track: [['lvL3', 'trickster', 'time the mower, dash across, pull the shed lever', -4, 31]] });
      B.puzzle('home', 'Back together', ['scout'], ['blR'], { hint: '🪽 Cross the sprinkler while Raccoon holds the tap plate (it sprays high!), fly through the open gate, ring the birdhouse bell.', track: [['blR', 'scout', 'ring the birdhouse bell', 4, 38, 3.2]] });
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
