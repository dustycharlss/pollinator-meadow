// Act 3 maps (Fern act3-integration.md). Patch 1: Meadow Hub. Patch 2: S5 escort + S3 lures (Practice Yard sandbox). Patch 3: S2 gear yard (stump, pouch, sling, glider). S4: Master Bell kit + Bell Yard demo (act3_bell). Level 22 Thaw Valley; 23-24 ship later.
// Levels 17-24 are added here one patch at a time; a level tile is playable as soon as its map exists.
export const MAPS3 = {
  // ===== S1 Meadow Hub: walk to a station to open it. Rescued friends move in and open features. =====
  meadow_hub: {
    goal: 'Meadow Hub', hub: true, key: 'puzzles', ceil: 10,
    bounds: { x0: -18, x1: 18, z0: -15, z1: 19 },
    crew: 'Pick your crew in the Crew Tent',
    intro: ['🏡 Welcome home to the Meadow Hub!', '🪧 Walk to the Trail Board to pick a level · ⛺ Crew Tent picks your crew'],
    build(B) {
      B.home(0, -6); B.lane(-17, 17, -14, 18);
      [[-15, -12], [15, -12], [-15, 4], [15, 2], [-14, 16], [14, 16], [-6, 17], [6, 17.5], [0, -13]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 3) * 0.12));
      B.glade(0, 3, 0xb8e09a); B.glade(-9, 2); B.glade(10, -5); B.glade(-9, -7); B.glade(-9, 11);
      B.banner(-3, 8.5, 0); B.banner(3, 8.5, 0);
      // Pond Dock: a little pond + plank dock
      B.pool(11, 10, 3.2, 0);
      B.hubPad('map', 0, 10, { emoji: '🪧', label: 'Trail Board · pick a level', col: 0xffc93c });
      B.hubPad('crew', -9, 2, { emoji: '⛺', label: 'Crew Tent · pick your crew', col: 0x7ad06a });
      B.hubPad('dock', 7.5, 7, { emoji: '🛶', label: 'Pond Dock · replay board', need: 'ducklings', col: 0x5ab8ff, lockTx: '🔒 Pond Dock · rescue the Ducklings in level 18 (Flooded Mill) to open it' });
      B.hubPad('bench', 10, -5, { emoji: '🔧', label: 'Gear Bench', need: 'badger', col: 0xd89a4a, lockTx: '🔒 Gear Bench · help Badger Bramble in level 17 (Ember Ridge) to open it' });
      B.hubPad('closet', -9, -7, { emoji: '👗', label: 'Costume Closet', need: 'fawn', col: 0xff8ad8, lockTx: '🔒 Costume Closet · rescue the Fawn in level 22 (Thaw Valley) to open it' });
      B.hubPad('stars', -9, 11, { emoji: '⭐', label: 'Star Board', need: 'owlet', col: 0xffe07a, lockTx: '🔒 Star Board · help the Owlet in level 19 (Night Market) to open it' });
      B.hubPad('lab', 0, 16, { emoji: '🧪', label: 'Practice Yard · try new tricks', col: 0x7ad0c8 });
      B.hubPad('bell', 5.5, 16, { emoji: '🔔', label: 'Bell Yard · try the Master Bell', col: 0xe8c44a });
      B.hubPad('friends', -14, -2.5, { emoji: '🧺', label: 'Play with friends', col: 0xa99cf0, noSign: true, yaw: Math.PI / 2, gated: true });
      // rescued friends who move in (hidden until rescued)
      B.friend('badger', 12.5, -6.5, { id: 'badger', s: 0.8, yaw: -1.2, say: ['🦡 Badger Bramble: I only LOOK grumpy. Want to see some gear?', '🦡 Badger Bramble: Zzz… oh! Hello, friends.'] });
      for (let i = 0; i < 3; i++) B.friend('duckling', 9.6 + i * 0.9, 12.2 + i * 0.4, { id: 'ducklings', s: 1, yaw: 2.6, say: ['🐥 Ducklings: Peep! Peep peep! (Want to replay a level?)'] });
      B.friend('turtle', 13.8, 12.6, { id: 'turtle', s: 0.7, yaw: -2.4, say: ['🐢 Shelly: Thanks for the ride home. Slow and steady!'] });
      B.friend('owl', -11.5, 12.5, { id: 'owlet', s: 0.6, yaw: 1.2, say: ['🦉 Owlet: Hoo! I keep track of every star you earn.'] });
      B.friend('fawn', -11.8, -8, { id: 'fawn', s: 0.9, yaw: 1.4, say: ['🦌 Fawn: Try on a costume! Skins are just for fun.'] });
      B.friend('fox', 4, 14.5, { id: 'foxkit', s: 0.55, yaw: 3.0, say: ['🦊 Fox kit: I dug a tunnel under the big tree!', '🦊 Fox kit: Tag! You\'re it!'] });
    },
  },

  // ===== 17 · Ember Ridge (Fern act3-levels-17-21.md §2): Wind (M4) + Seasons (M7) + the Bubble Pouch (S2). Baby: badger cub. =====
  ember_ridge: {
    ambience: 'ember-ridge', // Beans CC0 loop (campfire crackle + calm forest wind), SFX bus
    goal: 'Ember Ridge', act2: true, key: 'puzzles', ceil: 12, exit: [0, 80], par: 540,
    bounds: { x0: -18, x1: 12, z0: -10, z1: 86 },
    terraces: [[16, 24, 3], [40, 48, 3]], // creek terrace y0 → wind shelf y3 → season ridge y6
    crew: 'Bee · Raccoon · Bear', friend: 'badger',
    windYaw: { down: 0, up: Math.PI / 2 }, windText: { up: '🌬️ The wind turns — it blows EAST, off the path!', down: '🌬️ The wind turns — it blows up the hill again' },
    banter: { start: ['🐝 Bee: The grass is puffing soot! I’ll blow bubbles on it!', '🦝 Raccoon: Sparks send you back to the flag. Cool them first.', '🐻 Bear: And we’ll walk the badger cub home, nice and slow.', '🐝 Bee: Bubble Pouch, I was born to puff this trail!'], end: ['🦡 Badger Bramble: Yawn… you brought my cub back? Thank you.', '🐝 Bee: Badger Bramble, the Hub will love you!', '🦝 Raccoon: He only looks grumpy. I respect that.', '🐻 Bear: Cub’s safe. Now we all deserve a nap.', '🦡 Badger Bramble: Zzz… oh. I’ll keep the Gear Bench tidy.'] }, // Fern banter.md §17
    pip: [
      ['start', 'A cool cave sits by the creek. Look inside!'],
      [['xlt:-8.5', 'sig:gift:bubble+3'], 'Fill the pouch in the creek, then puff the sparks.'],
      ['z:24.5', 'Crank the vane. Blow the sparks off the path!'],
      ['z:39', 'Ring the spring bell. Dew makes the grass safe.'],
      ['stuck:dam', 'Bear dams the creek. Then refill the pouch.'],
      [['sig:cubBlocked', 'sig:called'], 'Call the cub when the grass is cool and dim.'],
    ],
    build(B) {
      B.home(0, -5); B.lane(-18, 12, -10, 86, { look: 'hedge' });
      // corridor hedges at x = ±6.5 (2 m segments follow the terraces) + an invisible tall cap so nobody flies around the doors
      const hedge = (x, z0, z1) => B.hedgeRun(x, z0, z1, { look: 'hedge' });
      hedge(-6.5, -10, 0); hedge(-6.5, 4, 59); hedge(-6.5, 65, 86); hedge(6.5, -10, 86);
      // the cool cave (west, z 0..8): enclosed stone room, a 3 m mouth at (-8, 2)
      const rock = (x, z, w, d, top = 3) => { B.wall(x, z, w, d, top, { look: 'stone' }); B.wall(x, z, w, d, 30, { bot: top - 0.1, hidden: true }).s.off = false; };
      rock(-12.25, -0.3, 11.5, 0.6, 5.2); rock(-13, 8.3, 10, 0.6, 5.2); rock(-18.15, 4, 0.7, 8.6, 5.2);
      rock(-8, 0.25, 0.6, 0.5, 2.4); rock(-8, 5.9, 0.6, 4.2, 2.4); rock(-7.25, 6.2, 1.5, 4, 2.4);
      B.wall(-13, 4, 11, 9.2, 5.2, { bot: 3.6, look: 'stone' }); // ceiling high enough for the crew, low enough to read as an interior
      B.wall(-13, 4, 10.4, 8.6, 5.0, { bot: 3.8, look: 'cliff' }); // cooler inner soffit
      B.deco('act3/ember-ridge/cave-entrance', -8.6, 2, 3.4, { yaw: -Math.PI / 2 });
      B.deco('act3/ember-ridge/rock-tall', -17, 1.5, 2.2); B.deco('act3/ember-ridge/rock-large', -16.5, 7, 1.6);
      B.gift('bubble', -11.5, 2, 0.6); // inward so the follow camera can sit at the mouth and still see the gift + stump
      B.gearStump(-7, 3.2, { label: 'Gear stump' });
      B.camRoom(-19, -1.2, -6.2, 9.2, { anchor: [-7.2, 2, 2.2], mix: 0.7 });
      // A · teach the pouch: the creek fills it, one bubble puts out ember A (door A opens)
      B.checkpoint(0, -1);
      B.escort('cub', 2.5, -3);
      B.creek('creek17', -6.5, 4, 3.5, 10); // a dry ford on the east (x 3.5..6.5) so everyone can walk round
      B.deco('act3/ember-ridge/rock-small', 4.2, 4.4, 0.7); B.deco('act3/ember-ridge/rock-small', 4.4, 9.6, 0.6);
      B.ember('emA', 0, 13, 10, 3, { dimIn: false });
      B.door('safe:emA', 16, -6.5, 6.5, { label: 'Smoky gate' });
      // ramp 1 (z 16..24) → B · the wind shelf: crank vane B so the wind blows EAST and the sparks fly into the basin (6 s)
      B.hide('log', 3, 20, 1.4, 1.4);
      B.checkpoint(0, 24);
      B.vane('vB', 5, 26, { model: 'act3/ember-ridge/wind-vane', label: 'Wind vane' });
      B.windZone(-6.5, 28, 6.5, 36, { push: 5, h: 3, alt: { down: [0, 1], up: [1, 0] } });
      B.ember('emB', 0, 32, 13, 6, { dimIn: false, blow: true });
      B.deco('act3/ember-ridge/campfire-stones', 9.5, 30, 1.0); B.deco('act3/ember-ridge/ember-coals', 9, 33, 1.0); B.deco('act3/ember-ridge/ember-coals', 10.5, 35, 0.9); // spark basin
      B.door('safe:emB', 36.5, -6.5, 6.5, { label: 'Windy gate' }); // 1.5 m south of CP-C so the flag never sits in a closed doorway
      // C · season dew: ring 🌱 spring → ember C dims, the cub can cross
      B.checkpoint(0, 38);
      B.seasonBells(0, 40, 2);
      B.hide('log', -3, 40, 1.4, 1.4);
      B.ember('emC', 0, 51, 13, 6, { dimIn: 'spring' }); // z 48..54, on the flat ridge
      B.door('safe:emC', 54.6, -6.5, 6.5, { label: 'Dewy gate' });
      // D · log-dam combo: Bear shoves the log into the gully slot → the puddle rises → Bee refills · vane D blows the last sparks east
      B.checkpoint(0, 56);
      B.gearStump(4, 58, { label: 'Gear stump' });
      B.hide('log', 3, 58.6, 1.4, 1.4);
      rock(-12.25, 56.3, 11.5, 0.6, 3.5); rock(-12.25, 73.7, 11.5, 0.6, 3.5);
      B.pond('puddle17', -18, 58, -7, 68, { level: 'low' });
      B.boulder('logD', -3, 62, -10, 62, { kind: 'log', w: 1.4, d: 2.6, h: 1.0, slotH: 0.3, label: 'Log' });
      B.onSig('logD', (on, api) => { if (on) { api.pond('puddle17', 'high'); } });
      B.vane('vD', 5, 64, { model: 'act3/ember-ridge/wind-vane', label: 'Wind vane' });
      B.windZone(-6.5, 66, 6.5, 72, { push: 5, h: 3, alt: { down: [0, 1], up: [1, 0] } });
      B.ember('emD', 0, 69, 13, 5, { dimIn: false, blow: true });
      B.door('safe:emD', 72.5, -6.5, 6.5, { label: 'Last gate' });
      // secret Starseed: a high bark nook over the gully. Raccoon climbs the spring vine once the dam is in
      B.wall(-16.5, 67.5, 3, 4, 3.4, { look: 'bark' });
      B.vine(-14.4, 69.6, 0.2, -15.6, 68.4, 3.4, { need: ['logD'], needWhy: 'Dam the creek with the log first — then the vine has water' });
      B.pickup('star', -16.5, 67, 4.3, { who: ['trickster'], whyNot: 'Too heavy for Bee — boost Raccoon, or step them from the dam.', set: 'emberStar' });
      // E · exit glade: the parent badger snoozes by the flag
      B.checkpoint(0, 74);
      B.badger('bdEnd', 5, 76, { yaw: -1.57, friendly: true, rollTo: [5, 78], ring: 0.1 });
      // Petals (26)
      const P = (x, z) => B.pickup('petal', x, z, 0.9);
      for (let i = 0; i < 4; i++) { const a = Math.PI * (0.25 + i / 3 * 0.5); P(-Math.cos(a) * 4.2, -8.3 + Math.sin(a) * 0.6); } // a shallow arc behind the nest, kept clear of the start poses
      for (let i = 0; i < 5; i++) P(-5 + i * 2.5, 2);
      P(-16, 4); P(-12, 6);
      for (let i = 0; i < 3; i++) P(-2, 18 + i * 2);
      for (let i = 0; i < 4; i++) P(-4 + i * 8 / 3, 28 + i * 2);
      for (let i = 0; i < 3; i++) P(-4 + i * 4, 42 + i * 2);
      for (let i = 0; i < 3; i++) P(-4 + i * 4, 50 + (i === 1 ? 2 : 0));
      P(-12, 66); P(-9, 66);
      // dry golden hillside dressing (CC0: Kenney Nature Kit, Kenney Fantasy Town, built Ember Ridge models)
      const G = ['dry-grass', 'dry-grass-large', 'dry-grass-leafs'];
      [[-5.5, -8], [5.5, -7.5], [-5.2, 11.5], [5.6, 15], [-5.6, 21], [5.5, 23], [-5.6, 26.5], [-5.5, 37], [5.6, 41], [-5.5, 45], [5.6, 47.5], [-5.6, 60], [5.6, 61], [-5.5, 76], [5.8, 83], [-5.5, 84]].forEach(([x, z], i) => B.deco('act3/ember-ridge/' + G[i % 3], x, z, 0.7 + (i % 3) * 0.15, { yaw: i * 1.7 }));
      [[9.5, -6, 'tree-fall', 4.2], [10, 12, 'tree-crooked', 4.6], [-11, 20, 'tree-simple-fall', 4.4], [-13, 34, 'tree-fall', 4.8], [9.5, 45, 'tree-crooked', 5], [-12, 48, 'tree-simple-fall', 4.4], [9.5, 70, 'tree-fall', 4.6], [-13, 80, 'tree-crooked', 5], [9.6, 82, 'tree-simple-fall', 4.2]].forEach(([x, z, k, h], i) => B.deco('act3/ember-ridge/' + k, x, z, h, { yaw: i * 2.1 }));
      [[-10, 12, 'rock-large', 1.6], [9.5, 20, 'rock-tall', 2.2], [-10, 42, 'stump-old', 1.0], [9.5, 56, 'rock-large', 1.4], [-4.8, 63.5, 'log', 0.8], [-5.2, 79, 'stump-old', 1.0]].forEach(([x, z, k, h], i) => B.deco('act3/ember-ridge/' + k, x, z, h, { yaw: i * 1.3 }));
      B.deco('act3/ember-ridge/season-bell', 4.6, 39.2, 1.6, { yaw: Math.PI });
      B.puzzle('pouch', 'Bubble Pouch', ['scout'], ['safe:emA'], { hint: '🪽 Find the Bubble Pouch in the cool cave · dip low over the creek to fill it · face the sparks and press G (or Use) to puff them out.', track: [['gift:bubble', 'any', 'find the Bubble Pouch in the cool cave', -11.5, 2, 0.6], ['safe:emA', 'scout', 'fill it in the creek, then puff ember A', 0, 13]] });
      B.puzzle('sparks', 'Windy shelf', ['trickster'], ['safe:emB'], { hint: '🐾 Crank the wind vane — the wind blows EAST and the sparks fly off the path for 6 seconds. Run!', track: [['safe:emB', 'trickster', 'crank the vane, then cross while the sparks are blown away', 5, 26]] });
      B.puzzle('dew', 'Season dew', ['scout'], ['safe:emC'], { hint: '🪽 Fly into the 🌱 spring bell — dew dims the hot grass so you and the cub can cross.', track: [['spring', 'scout', 'ring the 🌱 spring bell', 0, 40, 2]] });
      B.puzzle('dam', 'Log dam', ['bruiser', 'trickster', 'scout'], ['logD', 'safe:emD'], { hint: '🐻 Shove the log into the gully slot → the puddle fills · 🐾 crank vane D · 🪽 refill the pouch in the puddle and puff any sparks left.', track: [['logD', 'bruiser', 'shove the log west into the gully slot', -3, 62], ['safe:emD', 'trickster', 'crank vane D (or 🪽 puff the sparks)', 5, 64]] });
    },
  },

  // ===== 18 · Flooded Mill (Fern act3-levels-17-21.md §3): Water Level (M2) + Carry Chain (M5) + turtle ride (S3). Baby: 3 ducklings. =====
  flooded_mill: {
    ambience: 'flooded-mill', // Beans CC0 loop (Berwitz watermill + Nox_Sound stream), SFX bus
    goal: 'Flooded Mill', act2: true, key: 'puzzles', ceil: 14, exit: [0, 72], par: 600,
    bounds: { x0: -16, x1: 16, z0: -10, z1: 78 },
    crew: 'Bee · Raccoon · Bear', friend: ['ducklings', 'turtle'],
    escortGoal: { z: 70, sig: 'ducks:bank' },
    banter: { start: ['🦝 Raccoon: Three floors of water. I’ll work every sluice.', '🐝 Bee: Ducklings, stay in a line! I can scout ahead!', '🐻 Bear: If the turtle rides high, we follow behind it.', '🦝 Raccoon: Lucky I packed a keep-dry snack. Don’t drop it.'], end: ['🐝 Bee: All three ducklings made it! Peep-peep parade!', '🐻 Bear: Shelly can visit the Hub. Slow and steady.', '🐢 Shelly: Thanks for the ride home, friends.', '🦝 Raccoon: I still have a dry snack. Miracle.', '🐥 Ducklings: Peep! Peep peep!'] },
    pip: [
      ['start', 'The turtle rides high water to a far rock.'],
      ['near:lever', 'Try each sluice. Watch where the turtle goes.'],
      ['z:24.5', 'Pass the millstone down: Bee, then Raccoon, then Bear.'],
      ['stuck:gear', 'High for Bee. Middle for Raccoon. Low for Bear.'],
      ['sig:ms18:home', 'Ducklings float when the water is high.'],
      ['stuck:ducks', 'Lower the water so the ducklings can hop.'],
    ],
    build(B) {
      B.home(0, -5); B.lane(-16, 16, -10, 78, { look: 'hedge' });
      const hedge = (x, z0, z1) => B.hedgeRun(x, z0, z1, { look: 'hedge' });
      hedge(-6.5, -10, 10); hedge(6.5, -10, 10);
      B.checkpoint(0, -1);
      B.escort('duckling', 3, -2, { count: 3 });
      B.gearStump(-4, 10, { label: 'Gear stump' });
      B.hide('log', -4, 12, 1.4, 1.4);
      // sluices (Trickster) — custom mill pond: dry / 2.4 m / 5.0 m
      B.pond('millPond', -14, 10, 14, 67.5, { level: 'mid', heights: { low: 0, mid: 2.4, high: 5.0 }, holes: [[3.0, 41.2, 14, 49.2]] });
      B.wall(8, 45.2, 8.8, 6.4, 0.35, { look: 'stone' }); // dry footing at the millstone / waterwheel so the mechanic camera is not in the water
      B.sluice('millPond', 6, 8, 'high', { label: 'Sluice · high water' });
      B.sluice('millPond', 0, 8, 'mid', { label: 'Sluice · mid water' });
      B.sluice('millPond', -6, 8, 'low', { label: 'Sluice · low water' });
      B.deco('act3/flooded-mill/sluice', 6, 8, 1.8, { yaw: Math.PI });
      B.deco('act3/flooded-mill/sluice', 0, 8, 1.8, { yaw: Math.PI });
      B.deco('act3/flooded-mill/sluice', -6, 8, 1.8, { yaw: Math.PI });
      // east turtle rocks. After the first high ride the turtle stays on the far rock.
      B.wall(12, 16, 3, 3, 0.6, { bot: 0, look: 'stone' });
      [[12, 22], [12, 28], [12, 34]].forEach(([x, z]) => B.wall(x, z, 1.6, 1.6, 0.6, { bot: 0, look: 'stone' }));
      B.wall(12, 38, 3, 3, 0.6, { bot: 0, look: 'stone' });
      B.turtle('tu18', 12, 16, { yaw: Math.PI, pond: 'millPond', ride: { high: [12, 38], low: [12, 16] }, farSig: 'tu18:far', rideSpeed: 6.5, nap: 20, leaf: [8, 12], leafTo: [14, 36] });
      B.checkpoint(12, 22, 0.6);
      // mill house (-8..8, 24..52): stone walls, south door on tu18:far, north door on ms18:home
      const cap = (x, z, w, d, top) => { B.wall(x, z, w, d, top, { look: 'stone' }); B.wall(x, z, w, d, 30, { bot: top - 0.1, hidden: true }).s.off = false; };
      cap(-4.8, 24, 6.4, 1, 8); cap(4.8, 24, 6.4, 1, 8);
      B.gate('tu18:far', 0, 24, 3.2, 0.7, 8, { latch: true, label: 'Mill door' });
      B.wall(0, 24, 3.2, 0.7, 30, { bot: 7.9, hidden: true }).s.off = false;
      B.checkpoint(0, 26);
      cap(-4.8, 52, 6.4, 1, 8); cap(4.8, 52, 6.4, 1, 8);
      B.gate('ms18:home', 0, 52, 3.2, 0.7, 8, { latch: true, label: 'North mill door' });
      B.wall(0, 52, 3.2, 0.7, 30, { bot: 7.9, hidden: true }).s.off = false;
      cap(-8, 30, 1, 11, 8); cap(-8, 46, 1, 11, 8);
      cap(8, 41.4, 1, 20.2, 8); // east wall north of the loft window
      cap(8, 25.4, 1, 2.0, 8); // east wall south of the loft window
      B.wall(8, 28.2, 1, 3.6, 5.8, { look: 'stone' }); // under the window
      B.wall(8, 28.2, 1, 3.6, 8, { bot: 7.4, look: 'stone' }); // lintel
      B.slip(8.8, 28, 6.5, 6.6, 28, 6.5, { label: 'Loft window' });
      // Floor 1 gallery at y=3 (dry at mid, flooded at high); centre left open so the bed is walkable at low
      B.wall(-5, 38, 4, 24, 3.0, { bot: 2.55, look: 'wood' });
      B.wall(4, 40, 6, 3.2, 3.0, { bot: 2.55, look: 'wood' }); // mid hand-off (r2), leaves a centre aisle
      B.wall(5, 32, 4, 8, 3.0, { bot: 2.55, look: 'wood' });
      B.checkpoint(0, 40, 3.0);
      // Floor 2 loft at y=6 (always dry)
      B.wall(3, 30, 8, 10, 6.0, { bot: 5.55, look: 'wood' });
      B.deco('act3/flooded-mill/planks', 3, 30, 1.2, { h: 6.0 });
      // west bear ramps (outside): yard 0 to floor 1 (z 26..32), landing, then to the loft (z 38..46)
      B.ramp(-10, 26, 0, 32, 3, { w: 3.2 });
      B.wall(-10, 35, 3.2, 6.2, 3.0, { bot: 2.55, look: 'wood' });
      B.ramp(-10, 38, 3, 46, 6, { w: 3.2 });
      B.deco('act3/flooded-mill/stairs', -10, 29, 3.2);
      B.deco('act3/flooded-mill/stairs', -10, 42, 3.2, { h: 3 });
      // millstone carry chain + waterwheel (starts stuck; ms18:home spins it and opens the north door)
      B.acornChain('ms18', [
        { x: 6, z: 30, h: 6.0, who: 'scout' },
        { x: 2, z: 34, h: 5.2, who: 'trickster' },
        { x: 2, z: 40, h: 3.0, who: 'trickster' },
        { x: 6, z: 46, h: 0.0, who: 'bruiser', home: true },
      ], { model: 'act3/flooded-mill/millstone', modelSize: 1.15, noun: 'millstone', em: '⚙️', timed: true, window: 8, homeLabel: 'Wheel slot' });
      B.waterwheel('wheel18', 8, 46, { axle: 3, size: 6, spin: 'ms18:home', yaw: -Math.PI / 2 });
      B.floatLog('lgA', 'millPond', 2, 24, 2, 36, { w: 2.6, d: 2.2, model: 'act3/flooded-mill/crate', modelSize: 2.4 });
      B.crossing(-2.2, 47.65, 2.2, 52.4); B.checkpoint(0, 50);
      B.hide('log', -5, 28, 1.4, 1.4); B.deco('act3/flooded-mill/barrel', -5, 28, 1.3);
      B.hide('log', 4, 44, 1.4, 1.4); B.deco('act3/flooded-mill/barrel', 4, 44, 1.3);
      // north pool, drain grate (ducklings cannot float this last bit), hop stone only at low
      B.hide('log', -6, 58, 1.4, 1.4);
      B.grate(-3, 69, 3, 71);
      B.hopStone('millPond:low', 0, 70, { r: 0.8, top: 0.15 });
      B.checkpoint(0, 70);
      // secret Starseed: east loft nook behind the wheel, Scout only
      B.wall(12, 46, 2.2, 2.2, 6.5, { bot: 6.1, look: 'wood' });
      B.pickup('star', 12, 46, 6.5, { who: ['scout'], whyNot: 'Only Bee fits behind the wheel paddles.', set: 'millStar' });
      // Petals (28)
      const P = (x, z, h = 0.9) => B.pickup('petal', x, z, h);
      for (let i = 0; i < 5; i++) P(-5 + i * 2.5, -2);
      for (let i = 0; i < 5; i++) P(-10 + i * 5, 10);
      for (let i = 0; i < 3; i++) P(12, 22 + i * 6, 1.5);
      for (let i = 0; i < 4; i++) P(-4 + i * 8 / 3, 32 + i, 3.9);
      for (let i = 0; i < 3; i++) P(3 + i * 1.5, 28 + i * 2, 6.9);
      P(-10, 26, 0.9); P(-10, 35, 3.9); P(-10, 46, 6.9);
      for (let i = 0; i < 4; i++) P(-8 + i * 16 / 3, 58);
      P(0, 70);
      // dressing
      B.deco('act3/flooded-mill/watermill', 8, 48, 5.5, { yaw: -Math.PI / 2 });
      B.deco('act3/flooded-mill/wall-wood', -8, 36, 3.5, { yaw: Math.PI / 2 });
      B.deco('act3/flooded-mill/roof', 0, 38, 4.5, { h: 8 });
      B.deco('act3/flooded-mill/barrel', 5, 10, 1.1, { yaw: 0.6 });
      B.deco('act3/flooded-mill/crate', -12, 8, 1.2, { yaw: 1.1 });
      [[-14, -6], [14, -7], [-14, 70], [14, 74], [-13, 20], [14.5, 50]].forEach(([x, z], i) => B.tree(x, z, 0.85 + (i % 3) * 0.12));
      B.puzzle('turtle', 'Turtle ride', ['trickster'], ['tu18:far'], { hint: '🐾 Pull the high sluice. The turtle rides to the far rock and naps — then the south mill door opens. Walk the east rocks (go behind the turtle, or wait until it has left).', track: [['millPond:high', 'trickster', 'pull the high sluice', 6, 8], ['tu18:far', 'any', 'watch the turtle nap on the far rock', 12, 38]] });
      B.puzzle('gear', 'Millstone chain', ['scout', 'trickster', 'bruiser'], ['ms18:home'], { hint: '🪽 At high water, fly through the loft window and pass the millstone to the floating crate · 🐾 lower to mid and carry along the gallery · 🐻 lower to low and fit the stone in the wheel.', track: [['ms18:r0', 'scout', 'fly in the loft window and pick the millstone', 6, 30, 6], ['ms18:r1', 'scout', 'drop it on the high crate ring', 2, 34, 5.2], ['ms18:r2', 'trickster', 'lower to mid, carry along the gallery', 2, 40, 3], ['ms18:home', 'bruiser', 'lower to low, fit the millstone in the wheel', 6, 46]] });
      B.puzzle('ducks', 'Duckling plan', ['scout', 'trickster', 'bruiser'], ['ducks:bank'], { hint: '📣 Call the ducklings · raise the water so they float the wide north pool · lower it so the hop stone appears, then walk the grate gap together.', track: [['ducks:bank', 'any', 'float the north pool at high, then hop the grate at low', 0, 70]] });
    },
  },


  // ===== 19 · Night Market (Fern act3-levels-17-21.md §4): night gear + owl bait (S3) + Two-Room Split (M8). Baby: owlet. =====
  night_market: {
    ambience: 'night-market', // Beans CC0 loop (Nox_Sound + qubodup), SFX bus
    goal: 'Night Market', act2: true, moody: true, night: true, loanGear: 'test', key: 'puzzles', ceil: 10, exit: [0, 74], par: 600,
    bounds: { x0: -16, x1: 16, z0: -10, z1: 80 },
    crew: 'Bee · Raccoon · Bear', friend: ['owlet'],
    banter: {
      start: ['🦝 Raccoon: We are split by a stream! I’ll sneak the west stalls.', '🐝 Bee: I’ll hold the lantern so the owl looks at me!', '🐻 Bear: I’ll wait for the plates. Heavy work is my job.', '🦉 Owlet: …hoo?'],
      end: ['🦉 Owlet: Hoo-hoo!', '🦉 Parent owl: Thank you for bringing our little one home.', '🐝 Bee: The market feels friendlier already.', '🐻 Bear: I like night markets. Quiet and glowy.', '🦝 Raccoon: Next snack is on me. Night snack.'],
    },
    pip: [
      ['start', 'You are split up! Bee is across the stream.'],
      ['z:8', 'Bee, hold the lantern on the roof. The owl looks!'],
      ['z:26', 'Raccoon, whistle to find the hidden lever.'],
      ['sig:hlW', 'Bee, ring the high bell for the others.'],
      ['z:56', 'Bait the owl again. Then sneak the owlet across.'],
      ['sig:ford19', 'Tap G to turn the lantern off if the owl stares.'],
    ],
    build(B) {
      B.lane(-16, 16, -10, 80, { look: 'hedge' });
      B.split({ trickster: [-6, -1], bruiser: [-4, -1], scout: [6, -1, 1] });
      // cosmetic nest in the stream, unreachable
      B.deco('act3/night-market/kenney-fantasytown-stall', 0, -6, 1.4, { yaw: Math.PI });

      // stream wall + invisible fly cap (true two-room split until the ford opens)
      B.wall(0, 24, 0.6, 64, 2.4, { look: 'hedge' });
      B.wall(0, 24, 0.6, 64, 30, { bot: 2.3, hidden: true }).s.off = false;
      // shallow water look along the stream bed
      for (let z = -6; z <= 54; z += 6) B.deco('act3/night-market/kenney-nature-ground-river-straight', 0, z, 0.2, { yaw: 0, h: 3.2 });

      const cap = (x, z, w, d, top) => { B.wall(x, z, w, d, top, { look: 'hedge' }); B.wall(x, z, w, d, 30, { bot: top - 0.1, hidden: true }).s.off = false; };
      const laneGate = (s, x, z, w = 13) => { B.gate(s, x, z, w, 0.7, 2.8, { latch: true, label: 'Gate' }); B.wall(x, z, w, 0.7, 30, { bot: 2.7, hidden: true }).s.off = false; };

      // ford cap (z 58–66): hides when owB is baited or day is rung
      // visible lip stays low so the reunion pad at (0, 62) is not inside a 2.4 m teal slab
      const fordWall = B.wall(0, 63, 0.6, 8, 0.45, { look: 'hedge' });
      const fordCap = B.wall(0, 63, 0.6, 8, 30, { bot: 0.4, hidden: true });
      fordCap.s.off = false;
      const emW58 = B.ember('emW58', -6, 58, 1.6, { dimIn: false });
      const emE58 = B.ember('emE58', 6, 58, 1.6, { dimIn: false });
      B.onSig('ford19', on => {
        fordCap.s.off = !!on; fordCap.m.visible = !on;
        fordWall.s.off = !!on; fordWall.m.visible = !on;
        if (on) {
          for (const em of [emW58, emE58]) { if (!em) continue; em.st = 'out'; if (em.G) em.G.visible = false; }
        }
      });

      B.checkpoint(-6, -1); B.checkpoint(6, -1);
      // Small soot braziers on the walkBonk lines (z+8 from each flag). Walk around them.
      B.ember('emW7', -6, 7, 1.6, { dimIn: false });
      B.ember('emE7', 6, 7, 1.6, { dimIn: false });
      B.ember('emW36', -6, 34, 1.6, { dimIn: false });
      B.ember('emE36', 6, 34, 1.6, { dimIn: false });
      B.ember('emX76', 0, 76, 1.6, { dimIn: false });
      B.escort('owlet', -4, 3);
      B.hide('trunk', -4, 3, 1.1, 1.2); // basket hide at spawn
      B.deco('act3/night-market/kenney-fantasytown-cart', -4, 3, 1.1, { yaw: 0.4 });

      B.gearStump(-10, 8, { label: 'Whistle stump' });
      B.gearStump(10, 8, { label: 'Lantern stump' });
      B.deco('act3/night-market/gear-stump', -10, 8, 1.0);
      B.deco('act3/night-market/gear-stump', 10, 8, 1.0);

      B.dayNightBell(8, 6, 2.0);

      // bait roof (Scout) + marker
      B.wall(8, 14, 4, 3, 4.0, { bot: 3.55, look: 'wood' });
      B.marker('scout', 8, 14, 4, 'Hold the lantern here');
      B.deco('act3/night-market/mushroom-stall', 8, 14, 2.2, { yaw: -Math.PI / 2 });
      B.deco('act3/night-market/kenney-holiday-lantern-hanging', 8, 14, 5.2);

      B.hide('trunk', -6, 10, 1.2); B.hide('trunk', -8, 14, 1.2); B.hide('trunk', -5, 18, 1.2);
      B.deco('act3/night-market/kenney-fantasytown-stall-green', -8, 8, 1.8, { yaw: 0.2 });
      B.deco('act3/night-market/kenney-fantasytown-stall-red', -12, 16, 1.8, { yaw: -0.3 });
      B.deco('act3/night-market/kenney-fantasytown-stall', 12, 8, 1.8, { yaw: 0.5 });
      B.deco('act3/night-market/kenney-nature-mushroom-red-group', -11, 12, 1.0);
      B.deco('act3/night-market/kenney-nature-mushroom-tan-group', 11, 18, 1.0);

      // owl A on a perch in the stream, looks south, baits toward the lantern
      B.owl('owA', 0, 16, { yaw: Math.PI, perch: 4.0, r: 12, half: 0.40, sweep: 0.7, baitR: 32 });
      B.deco('act3/night-market/perch-post', 0, 16, 4.2);

      B.lever('lvW1', -8, 22, { label: 'West lever' });
      laneGate('lvW1', -8, 24);
      laneGate('lvW1', 8, 24);
      B.checkpoint(-6, 28); B.checkpoint(6, 28);

      B.hiddenLever('hlW', -10, 40, { label: 'Hidden lever', range: 24 });
      laneGate('hlW', 8, 36);
      B.wall(8, 38, 4, 3, 4.0, { bot: 3.55, look: 'wood' }); // bell stall roof
      B.bell('bE', 8, 38, 4.5, { label: 'Stall bell' });
      B.deco('act3/night-market/mushroom-stall', 8, 38, 2.2, { yaw: Math.PI / 2 });
      laneGate('bE', -8, 36);

      B.plate('plW', -10, 48, { heavy: true, label: 'Heavy plate' });
      laneGate('plW', 8, 54); // east reunion hatch, latches open
      laneGate('sq19', -8, 54); // west door 3: opens if plate or bell
      B.checkpoint(-6, 50); B.checkpoint(6, 50);
      B.hide('trunk', -8, 48, 1.3);
      B.deco('act3/night-market/kenney-fantasytown-stall-green', -8, 48, 1.8);

      // reunion square
      B.hide('log', -3, 58, 1.3, 1.3);
      B.deco('act3/night-market/kenney-fantasytown-cart', -3, 58, 1.1, { yaw: 1.1 });
      B.owl('owB', 6, 62, { yaw: -Math.PI / 2, perch: 4.5, r: 11, half: 0.36, sweep: 0.5, baitR: 30, baitSig: 'ford19', daySig: 'ford19', friendSig: 'reunion' });
      B.deco('act3/night-market/perch-post', 6, 62, 4.7);
      B.wall(12, 64, 3, 3, 5.0, { bot: 4.55, look: 'wood' });
      B.marker('scout', 12, 64, 5, 'Bait perch');
      B.hide('canopy', 12, 64, 1.6, 4);
      B.deco('act3/night-market/mushroom-stall', 12, 64, 2.4, { yaw: Math.PI });

      B.checkpoint(0, 68);
      B.exit(0, 74, 3);

      // secret Starseed: whistle-revealed steps on the west, Trickster only
      B.hiddenStep(-12, 44, 2.2, 2, 2.6);
      B.hiddenStep(-12, 44, 2.2, 2, 3.9);
      B.pickup('star', -12, 44, 3.9, { who: ['trickster'], whyNot: 'Only a Trickster can carry this Starseed.', set: 'marketStar' });

      // petals (24)
      const P = (x, z, h = 0.9) => B.pickup('petal', x, z, h);
      [[-8, -3], [-6, -3], [-4, -3]].forEach(([x, z]) => P(x, z));
      [[4, -3], [6, -3], [8, -3]].forEach(([x, z]) => P(x, z));
      [[-8, 10], [-8, 15], [-8, 20]].forEach(([x, z]) => P(x, z));
      P(8, 12, 4.9); P(8, 16, 4.9);
      [[-10, 32], [-10, 38], [-10, 44]].forEach(([x, z]) => P(x, z));
      [[8, 32], [8, 38], [8, 44]].forEach(([x, z]) => P(x, z));
      P(8, 38, 5.4);
      [[-4, 62], [-1.3, 62], [1.3, 62], [4, 62]].forEach(([x, z]) => P(x, z));
      P(-3, 72); P(3, 72);

      // lanterns / hanging lights
      [[-12, 24], [12, 24], [-12, 40], [12, 50], [-10, 62], [10, 70]].forEach(([x, z], i) => B.deco('act3/night-market/kenney-fantasytown-lantern', x, z, 2.4, { yaw: i }));
      [[-14, -6], [14, -7], [-14, 70], [14, 74], [-14, 30], [14, 46]].forEach(([x, z], i) => B.tree(x, z, 0.9 + (i % 3) * 0.1));

      B.hook(({ set, isOn, escorts, night, loc, en }) => {
        if (isOn('plW') || isOn('bE')) set('sq19', true);
        const owB = en.find(e => e.id === 'owB');
        if (owB && (owB.bait || !night())) set('ford19', true);
        if (isOn('ford19')) {
          for (const em of [emW58, emE58]) { if (!em) continue; em.st = 'out'; if (em.G) em.G.visible = false; }
        }
        const baby = escorts.find(b => b.kind === 'owlet');
        if (baby && loc(baby.x, baby.z).z > 66) {
          set('reunion', true);
          if (owB) owB.o.friendly = true;
        }
      });

      B.puzzle('bait', 'Lantern bait', ['scout', 'trickster'], ['lvW1'], { hint: '🪽 Fly to the stall roof and hold the lantern on. The owl looks away — then 🐾 sneak trunk to trunk and pull the west lever.', track: [['owA', 'scout', 'hold the lantern on the stall roof', 8, 14, 4], ['lvW1', 'trickster', 'sneak and pull the west lever', -8, 22]] });
      B.puzzle('split', 'Split help', ['trickster', 'scout', 'bruiser'], ['plW'], { hint: '🐾 Whistle to find the hidden lever · 🪽 ring the high stall bell · 🐻 stand on the heavy plate so the east hatch latches open.', track: [['hlW', 'trickster', 'whistle, then pull the hidden lever', -10, 40], ['bE', 'scout', 'ring the high stall bell', 8, 38, 4.5], ['plW', 'bruiser', 'stand on the heavy plate', -10, 48]] });
      B.puzzle('reunion', 'Owlet reunion', ['scout', 'trickster', 'bruiser'], ['reunion'], { hint: '📣 Call the owlet · 🪽 bait the parent owl on the far perch · sneak the owlet across the ford, then meet at the flag.', track: [['ford19', 'scout', 'hold the lantern on the far perch (or ring day)', 12, 64, 5], ['reunion', 'any', 'sneak the owlet across the open ford', 0, 68]] });
      B.puzzle('marketStar', 'Secret Starseed', ['trickster'], ['marketStar'], { req: false, hint: '🐾 After west gate 2 opens, whistle and climb the hidden steps on the west wall.' });
    },
  },

  // ===== S5/S3 Practice Yard (sandbox, not a campaign level): escort + every new enemy lure =====
  act3_lab: {
    goal: 'Call the baby, try every lure, then bring your crew AND the cub to the 🏁 exit',
    act2: true, loanGear: 'all', noStars: true, key: 'puzzles', ceil: 10, exit: [0, 24], par: 0,
    bounds: { x0: -20, x1: 36, z0: -10, z1: 30 },
    intro: ['📣 Tap Call (or C) so the badger cub follows you!', 'Try new lures: 🎶 whistle the fox, 🏮 bait the owl, 🌊 float the turtle, 🌬️ blow the wasps, ✨ pebble the crow, 🫧 bubble the web, 🏮 roll the badger, 💦 fill the cup.', '🧰 East gear yard: swap gear at the stump · 🫧 fill the pouch at the pond, douse embers · 🪨 Bear slings the far crystal · 🍃 glide the ravine.', '🏁 The exit needs all three friends AND the cub. Nobody gets hurt — a bonk just poofs you back to the 🚩 flag.'],
    build(B) {
      B.home(0, 0); B.lane(-20, 36, -10, 30);
      B.glade(0, 8); B.checkpoint(0, 4);
      B.escort('cub', 2.5, 1.5);
      // Fox + whistle lure onto a light plate (opens a little practice gate)
      B.fox('fx', -12, 8, { yaw: 0, path: [[-12, 4], [-12, 12]], speed: 1.5, ring: 5 });
      B.hide('log', -8, 8, 1.6, 1.2);
      B.plate('foxPl', -16, 8, { label: 'fox plate' });
      B.gate('foxPl', -10, 20, 4, 0.7, 3, { latch: true, label: 'Fox-plate gate' });
      // Turtle rides the water: high floats it to a far rock, low traps it in the pool
      B.pond('labPond', 8, -7, 18, 2, { level: 'mid' });
      B.sluice('labPond', 7, -6, 'low', { label: 'Sluice · low water' });
      B.sluice('labPond', 7, 1.5, 'high', { label: 'Sluice · high water' });
      B.turtle('tu', 10, -2, { yaw: 1.57, pond: 'labPond', ride: { high: [16, -2], low: [10, -2] } });
      // Wasps + vane: a wind flip blows the swarm downwind for 6 s
      B.wasps('ws', -8, 20, { r: 4.5 });
      B.vane('v1', -13, 20);
      B.windZone(-16, 16, -4, 26, { dx: 0, dz: 1 });
      // Owl + lantern bait (night bell). Owl faces west toward the glade.
      B.dayNightBell(10, 20, 1.8);
      B.owl('ow', 16, 18, { yaw: -1.57, perch: 3.5, r: 11, half: 0.4, sweep: 0.7 });
      B.hide('trunk', 10, 16, 1.4, 3);
      B.hide('trunk', 6, 18, 1.4, 3);
      // Crow + shiny pebble
      B.crow('cr', 14, 8, 3.4, 4, { speed: 2.4, ang: 0 });
      B.tool('pebble', 14, 4);
      // Spider + bubble-cut web
      B.spider('sp', -16, -4, { yaw: 1.57 });
      B.web('web1', -10, -4, 5, 3.2, { spider: 'sp' });
      B.tool('bubble', -6, -4);
      // Friendly sleepy badger: lantern wake rolls him onto a heavy plate
      B.badger('bg', 8, 10, { yaw: 0, friendly: true, rollTo: [8, 13.5], ring: 0.1 });
      B.plate('badgerPl', 8, 13.5, { heavy: true, label: 'badger plate' });
      // Sprinkler fills a cup-switch
      B.sprinkler('spk', -3, 16, { yaw: 1.57, r: 7, beam: 0.28, sweep: 0.15, speed: 0.5 });
      B.cup('cup1', 3, 16, { fill: 1.4 });
      // ===== S2 gear yard (Act 3 P3): every gear piece is on loan here =====
      B.glade(27, 6, 0xd9c58a);
      B.gearStump(24, 4);
      B.pond('gyPond', 22, -8, 34, -4.5, { level: 'mid' });            // 🫧 fill the Bubble Pouch here
      B.ember('gyE1', 28, 2, 1.6, { dimIn: 'spring' }); B.ember('gyE2', 31.5, 2, 1.6, { dimIn: 'spring' });        // 🫧 douse from afar
      B.cup('gyCup', 33, 9, { fill: 1.4 });                              // 🫧 a bubble fills it in one shot
      B.seed('gySeed', 26, 10, { grow: 'pad' });                         // Trickster plants · 🫧 bubble waters from afar
      B.slingTarget('gyGong', 30, 14.5, 5, { label: 'Far crystal' });   // 🪨 only a sling pebble reaches it
      B.glideGap(21, 18, 35.5, 23);                                      // 🍃 about 4 tiles: glide it
      for (let i = 0; i < 3; i++) B.pickup('petal', 25 + i * 3, 26, 0.9);
    },
  },

  // ===== S4 Bell Yard (sandbox): Master Bell demo, testable before levels 22 and 24 exist. Kept off act3_lab so Practice Yard gear tests stay on summer day. =====
  act3_bell: {
    goal: 'Ring the Master Bell. Each ring changes the season, the time, and the wind together.',
    act2: true, noStars: true, key: 'puzzles', ceil: 10, exit: [0, 28], par: 0, masterStart: 'A',
    bounds: { x0: -14, x1: 14, z0: -8, z1: 34 },
    intro: ['🔔 This is the Master Bell. One ring changes the season, the time, and the wind together.', 'The three pictures above the bell show what comes next. The plaque says what is true now.', '❄️🌙⬆️ is A (winter night, north wind) · 🌱☀️⬇️ is B (spring day, south wind) · ☀️🌇▪️ is C (summer dusk, calm).', 'Anyone can ring it. Wait a moment for the clapper to settle. A bonk does not undo the ring.'],
    pip: [
      ['start', 'Walk up the ramp and ring the big gold bell.'],
      ['sig:master:B', 'Spring, day, and a south wind! Ring again for summer dusk.'],
      ['sig:master:C', 'Calm summer dusk. One more ring takes you back to winter night.'],
    ],
    build(B) {
      B.home(0, -4); B.lane(-14, 14, -8, 34);
      B.glade(0, 4); B.checkpoint(0, 0);
      // plinth is 2 m; ramp run 5.5 m keeps the slope gentler than 1:2.5 so the bear can walk up. Air above the bell stays open for the Scout.
      B.ramp(0, 8.5, 0, 14, 2, { w: 6, look: 'stone' });
      B.masterBell(0, 16, 2, { start: 'A' });
      B.creek('cMelt', -11, 6, -5, 14, { melt: true }); // ice in A, high in B, mid in C
      B.snowPile('sn1', 6.5, 10, 3.2, 3.2, 1.4);
      B.windZone(-6, 12, 6, 22, { dx: 0, dz: 1, push: 7 });
      B.puzzle('bell', 'Learn the Master Bell', ['scout', 'trickster', 'bruiser'], ['master:C'], { hint: 'Ring the bell: A is winter night, B melts the creek, C is calm dusk. The pictures tell you what is next.' });
    },
  },

  // ===== 22 · Thaw Valley (Fern act3-levels-22-24.md §2): Master Bell (S4) + Seasons + Fox + Seeds. Baby: fawn. Bonus: fox kit. =====
  thaw_valley: {
    ambience: 'thaw-valley', // Beans CC0 loop (maeve.linehan + Nox_Sound), already in audio/ambient/act3/
    goal: 'Thaw Valley', act2: true, key: 'puzzles', ceil: 14, exit: [0, 86], par: 660,
    bounds: { x0: -18, x1: 16, z0: -10, z1: 92 },
    terraces: [[28, 36, 4], [58, 66, 4]], // floor 0 → melt shelf 4 → bell hill 8
    crew: 'Bee · Raccoon · Bear', friend: 'fawn', loanGear: 'all', masterStart: 'A', windWalk: true,
    escortGoal: { z: 85, sig: 'fawn' }, bellLearnZ: 4,
    petalCol: 0xc8c6e8, petalCenter: 0xeef0fb,
    windYaw: { down: Math.PI, up: 0 },
    windText: { up: '🌬️ The wind turns — it blows NORTH, up the valley', down: '🌬️ The wind turns — it blows SOUTH, down the valley' },
    banter: {
      start: ['🐝 Bee: One big Master Bell! Season, time, and wind!', '🦝 Raccoon: I\'ll whistle if a fox looks our way.', '🐻 Bear: We\'re here for the fawn. Soft steps, team.', '🐝 Bee: And a fox kit in the den, if we want to help!'],
      end: ['🦌 Fawn: You thawed the valley. I\'ll come to the Hub.', '🐝 Bee: The Closet will be so pretty with you there!', '🦝 Raccoon: Master Bell, I still want to ring it again.', '🐻 Bear: I am bear-y proud. And a little soggy.', '🦊 Fox kit: I dug a tunnel! Tag — you\'re it, later! {if: foxkit_rescued}'],
    },
    pip: [
      ['start', 'That big bell changes season, time, and wind together.'],
      ['near:fox', 'Ping the whistle by the plate. Snow hides your smell.'],
      [['z:36', 'near:seed'], 'Ring spring and day. Then plant and water the vine.'],
      ['sig:fawnRefuse', 'The fawn needs a clear, unfrozen path. Try summer dusk.'],
      ['stuck:fawn', 'Ring until the three icons show summer, dusk, and calm.'],
      ['sig:foxPl', 'A fox kit is in the den, if you want to help.'],
    ],
    build(B) {
      B.home(0, -5); B.lane(-18, 16, -10, 92, { look: 'snow' });
      const hedge = (x, z0, z1) => B.hedgeRun(x, z0, z1, { look: 'snow' });
      // corridor hedges, with an east den gap (z 8–24) and a west seed-bank gap (z 40–56)
      hedge(-6.5, -10, 28); hedge(-6.5, 28, 40); hedge(-6.5, 56, 92);
      hedge(6.5, -10, 8); hedge(6.5, 24, 50); hedge(6.5, 58, 92);
      B.checkpoint(0, -1);
      B.escort('fawn', 2.5, -3);
      B.masterPost(0, 0);
      B.masterPost(0, 2, { yaw: 0 }); // smaller trail post that mirrors the hill bell's Now icons
      // A · fox valley: first creek (ice in A, mid otherwise — not a melt flood). Banks stay open for the crew.
      B.creek('cA', -6.5, 4, 0.2, 10);
      B.creek('cA2', 3.6, 4, 6.5, 10); // dirt ford at x 0.2..3.6 so the crew and fawn walk the middle, not the ice
      B.fox('fxA', 8, 17.5, { yaw: Math.PI, ring: 5, path: [[8, 17.5], [10, 17.5]], speed: 2.5 }); // just off the plate (r=1.3) so it does not auto-hold; a short whistle from (8,14) still lures it on
      B.plate('foxPl', 8, 16, { label: 'Fox plate' });
      B.gearStump(-4, 12, { label: 'Echo Whistle stump' });
      B.hide('log', -3, 14, 1.4, 1.4);
      B.deco('act3/fox-den', 13, 20, 2.4, { yaw: -Math.PI / 2 });
      B.door('foxPl', 18, 10.4, 16, { x: 12, w: 3.2, label: 'Den gate' });
      B.dig('digKit', 14, 21, 14, 24, { friend: 'foxkit', label: 'Soft dirt' });
      B.door('foxPlFox', 28, -6.5, 6.5, { label: 'Door A' }); // opens only when the fox holds the plate, not when a crew member runs over it
      B.checkpoint(0, 26);
      // first rise is the terrace [28,36,4] — no extra B.ramp solids (they blocked the path as knee-high steps)
      B.windZone(-6.5, -1, 6.5, 26, { push: 6, h: 3, lift: 0, alt: { down: [0, -1], up: [0, 1] } });
      // B · melt shelf
      B.checkpoint(0, 36); // gy is already 4 on the melt shelf; a base of 4 was putting the flag at y 8 and the arm height check failed
      B.creek('cMelt', -6.5, 44, 6.5, 52, { melt: true });
      B.seed('sV', -12, 46, { need: 'spring', needWhy: 'The seed only takes in spring — ring the Master Bell to B', grow: 'vine', vine: [-12, 48, 0.3, -8, 56, 4], vineLabel: 'Spring vine', label: 'Vine seed' });
      B.drip(-14, 42, 2.4);
      B.lever('lvV', -8, 56, { base: 4, label: 'Ledge lever' }); // gy is 4 on the shelf; base 4 puts the lever at y = 8
      B.hide('reed', -10, 48, 1.4, 1.6);
      B.door('lvV', 58, -6.5, 6.5, { label: 'Door B' });
      // second rise is the terrace [58,66,4] (shelf 4 → hill 8)
      B.windZone(-6.5, 36, 6.5, 56, { push: 6, h: 3, lift: 0, alt: { down: [0, -1], up: [0, 1] } });
      // C · bell hill
      B.checkpoint(0, 66); // gy is already 8 on the bell hill
      // hill is already at y 8 after the second terrace; no extra landing solids
      B.masterBell(0, 72, 2, { start: 'A' });
      B.gearStump(4, 68, { label: 'Gear stump' });
      B.hide('rock', 4, 70, 1.4, 1.2);
      B.creek('cFord', -4, 78, 4, 85, { melt: true }); // ice / high / mid with the states; banks at x ±4..±6.5 stay open
      B.hopStone('master:C', 0, 80, { r: 1.6, top: 0.2 });
      B.hopStone('master:C', 0, 82, { r: 1.6, top: 0.2 });
      B.hopStone('master:C', 0, 84, { r: 1.6, top: 0.2 });
      B.checkpoint(0, 85);
      B.windZone(-6.5, 66, 6.5, 76, { push: 6, h: 3, lift: 0, alt: { down: [0, -1], up: [0, 1] } });
      // secret Starseed: east ice cave. 4 m wall seals the mouth except in winter, when a 2 m snow lip is a step
      const mouth = B.wall(14, 53.2, 3.4, 1.4, 8, { bot: 4, c: 0x9a968c });
      const lip = B.wall(14, 54.6, 3.0, 1.6, 6, { bot: 4, c: 0xf4f2fc });
      lip.m.visible = false; lip.s.off = true;
      B.onSig('winter', on => { mouth.s.off = !!on; mouth.m.visible = !on; lip.s.off = !on; lip.m.visible = !!on; });
      B.pickup('star', 14, 52, 0.9, { who: ['trickster'], whyNot: 'Too heavy for Bee — boost Raccoon, or come in winter when the snow lip is a step.', set: 'thawStar' });
      B.deco('act3/thaw-valley/kenney-nature-cliff-cave-rock', 14, 51.2, 3.2, { yaw: Math.PI });
      B.deco('act3/thaw-valley/kenney-holiday-snow-pile', 14, 54.6, 1.6).userData.winterScale = true;
      // Petals (26)
      const P = (x, z, y) => B.pickup('petal', x, z, y);
      for (let i = 0; i < 4; i++) P(-3 + i * 2, -8.2, 0.9); // behind the nest so start poses do not auto-collect them
      for (let i = 0; i < 4; i++) P(-5 + i * 10 / 3, 2, 0.9);
      for (let i = 0; i < 3; i++) P(-4 + i * 5, 16, 0.9);
      P(12, 20, 0.9); P(14, 24, 0.9);
      P(-2, 37, 0.9); P(-2, 40, 0.9); // on the melt shelf, not on the slope where a collect TP clipped
      P(-14, 42, 0.9); P(-13, 45, 0.9); P(-12, 48, 0.9);
      P(-4, 42, 0.9); P(0, 48, 0.9); P(4, 54, 0.9);
      P(-4, 70, 0.9); P(0, 73, 0.9); P(4, 76, 0.9);
      P(-3, 82, 0.9); P(3, 82, 0.9);
      // dressing (CC0 Kenney Holiday + Nature, built ice)
      const snow = (k, x, z, h, yaw) => B.deco('act3/thaw-valley/' + k, x, z, h, { yaw: yaw || 0 });
      // repeat 3+ of the same keys so decorateProps can instance them (look-target instancing)
      [[-5, -7, 'kenney-platformer-tree-pine-snow', 4.4], [11, 10, 'kenney-platformer-tree-pine-snow', 4.6], [-5.4, 88, 'kenney-platformer-tree-pine-snow', 4.6],
        [5.2, -8, 'kenney-holiday-tree-snow-a', 4.2], [5.4, 62, 'kenney-holiday-tree-snow-a', 4.2], [-14, 38, 'kenney-holiday-tree-snow-a', 4.4],
        [15, 14, 'kenney-holiday-tree-snow-b', 4.0], [5.4, 88, 'kenney-holiday-tree-snow-b', 4.2], [-16, 52, 'kenney-holiday-tree-snow-b', 3.6]].forEach(([x, z, k, h], i) => snow(k, x, z, h, i * 1.3));
      [[-5, 12, 'kenney-holiday-snow-pile', 1.1], [10, 22, 'kenney-holiday-snow-pile', 1.0], [-4, 74, 'kenney-holiday-snow-pile', 1.0],
        [-15, 44, 'kenney-holiday-snow-pile', 0.9], [5.2, 48, 'kenney-holiday-snow-pile', 0.9]].forEach(([x, z, k, h], i) => { const H = snow(k, x, z, h, i * 0.8); H.userData.winterScale = true; });
      B.puzzle('bell', 'Learn the Master Bell', ['scout', 'trickster', 'bruiser'], ['bellLearn'], { hint: 'Walk north around the first creek. The three icons on the post match the big hill bell — A is winter, night, and a north wind.', track: [['bellLearn', 'any', 'walk north around the creek', 0, 4]] });
      B.puzzle('fox', 'Fox lure', ['trickster'], ['foxPl'], { hint: '🐾 Stay in state A (snow hides your smell). Stand by the plate and ping the Echo Whistle so the fox walks onto it.', track: [['foxPl', 'trickster', 'ping the whistle by the fox plate', 8, 16]] });
      B.puzzle('melt', 'Melt flood', ['trickster', 'scout'], ['grown:sV', 'lvV'], { hint: 'Ring the bell to B (spring and day). 🐾 plant the seed, 🪽 water it, then climb the vine and pull the lever.', track: [['planted:sV', 'trickster', 'plant the vine seed in spring', -12, 46], ['grown:sV', 'scout', 'water the seed from the drip or with the pouch', -12, 46], ['lvV', 'trickster', 'climb the vine and pull the lever', -8, 56]] });
      B.puzzle('fawn', 'Fawn crossing', ['scout', 'trickster', 'bruiser'], ['fawn'], { hint: 'Ring the bell to C (summer, dusk, calm). Call the fawn and walk it over the unfrozen ford.', track: [['master:C', 'any', 'ring the Master Bell to C', 0, 72], ['fawn', 'any', 'walk the fawn across the ford', 0, 82]] });
    },
  },

  // ===== L20 Mirror Caves =====
  mirror_caves: {
    ambience: 'mirror-caves', // Beans CC0 loop (banasz + Nox_Sound), SFX bus
    goal: 'Mirror Caves', act2: true, moody: true, night: true, loanGear: 'test', loanPouch: true,
    smoothTerrain: true, caveFloor: true, key: 'puzzles', ceil: 10, exit: [0, 82], par: 600,
    bounds: { x0: -16, x1: 16, z0: -10, z1: 88 },
    pits: [[-6.5, 15, 6.5, 19], [-6.5, 66, 6.5, 70], [-1.3, 6.2, 1.3, 8.0], [-1.3, 29.2, 1.3, 31.0], [-1.3, 53.2, 1.3, 55.0], [-1.3, 83.2, 1.3, 85.2]],
    crew: 'Bee · Raccoon · Bear',
    banter: {
      start: ['🐻 Bear: A pebble sling? I can ping those crystals!', '🐝 Bee: I’ll aim the shiny mirrors. Watch this beam!', '🦝 Raccoon: Whistle will find the hidden paths. And snacks.', '🐻 Bear: The bat pup likes the dark. Lantern off near it.'],
      end: ['🐻 Bear: Pebble Sling, meet crystal. What a shot!', '🐝 Bee: And the bat pup stayed in the dark, safe and snug.', '🦝 Raccoon: Webs snipped. Shiny cave, happy pup.', '🐝 Bee: I was born to bounce light underground!'],
    },
    intro: [
      '💎 Mirror Caves. It is always dark down here.',
      '🐻 Pick up the Pebble Sling and throw at the far crystal.',
      '🫧 The Bubble Pouch from Ember Ridge still cuts webs.',
      '🦇 The bat pup only walks in the dark — lantern off near it.',
    ],
    pip: [
      ['start', 'The Pebble Sling is on that stone. Pick it up, Bear!'],
      ['sig:gift:sling', 'Throw a pebble at the far crystal. Watch the beam!'],
      ['z:22', 'Whistle to see which crystals are mirrors.'],
      ['z:46', 'Bubble the web from far away. Or sling the dew.'],
      ['sig:called', 'Turn the lantern off. The pup only walks in the dark.'],
      ['stuck:bounce', 'Ping, then turn the three real mirrors.'],
    ],
    build(B) {
      B.home(0, -1);
      B.lane(-16, 16, -10, 88, { look: 'cave' });

      // Long merged cave walls (few draw calls) + a real ceiling so the cave feels enclosed.
      const wall = (x, z, w, d, top = 9.2) => B.wall(x, z, w, d, top, { look: 'cave' });
      wall(-6.5, 5, 0.7, 30); // west corridor, mouth through first chasm (z -10..20)
      wall(6.5, 0, 0.7, 12);  // east corridor south of the fill nook
      wall(6.5, 16, 0.7, 8);  // east corridor north of the fill nook, through the chasm
      wall(-6.5, 47, 0.7, 6); // west web-hall before the star nook
      wall(-6.5, 75, 0.7, 26); // west hall D
      wall(6.5, 66, 0.7, 44); // east from door through exit
      // west star nook (open from z 50–62)
      wall(-11.2, 50, 9.4, 0.7);
      wall(-11.2, 62, 9.4, 0.7);
      wall(-16, 56, 0.7, 12);
      // pup alcove (west of home)
      wall(-6.5, -8, 0.7, 4);
      wall(-11.2, -6, 9.4, 0.7);
      wall(-16, -8, 0.7, 4);
      // one ceiling slab over the whole cave + a hidden fly cap at the roof
      B.wall(0, 39, 32, 98, 10, { bot: 9.2, c: 0x8f82b8 }); // ceiling >= 65% caveStone, lit by hemi ground
      B.wall(0, 39, 32, 98, 30, { bot: 9.9, hidden: true }).s.off = false;
      // instanced stalactites (#8a7cb8) — one draw call, keeps the ceiling from reading as a flat slab
      { const st = []; for (let z = -6; z <= 86; z += 7) for (const x of [-4.2, 0, 4.2]) st.push([x + ((z * 0.13) % 1.2) - 0.6, z, 0.45 + ((z * 3) % 7) * 0.04, 1.4 + ((z * 5) % 9) * 0.12]); B.scatterStalactites(st, { c: 0x8a7cb8, y: 9.2 }); }
      B.deco('act3/mirror-caves/pixor-cave-entrance', 0, -8.6, 4.2, { yaw: Math.PI });

      B.checkpoint(0, -1);
      B.escort('batpup', -4, -2);
      B.hide('log', -5, 8, 1.2, 1.3);
      B.hide('log', -10, 26, 1.3, 1.3);
      B.hide('log', 5, 48, 1.2, 1.3);
      B.hide('log', -4, 64, 1.2, 1.3);

      // ===== A: sling cave =====
      B.gift('sling', 4, 3, 0.6);
      B.gearStump(5, 9, { label: 'Sling stump' });
      B.deco('act3/night-market/gear-stump', 5, 9, 1.0);
      B.sunlamp('sunA', -6, 4, 3, { to: 'mA' });
      B.mirror('mA', 6, 14, 2, [
        { to: [10, 14, 0.4] },
        { lights: 'gA', to: [0, 18, 0.5] },
      ], { k: 0, label: 'Far crystal' });
      B.deco('act3/mirror-caves/built-framed-mirror', 6, 14, 2.2, { h: 1.4, yaw: -Math.PI / 2 });
      // Wide, thin ghost dock through the chasm and a little into the gallery so a 40-frame walk from z=16 clears z=22. boost: a gentle crystal current (needed so Bear's 7.8 m/s covers 6 m in 0.67 s).
      B.ghost('gA', 0, 18, 10, 8, 2.5, { bot: 2.15, cross: true, boost: 8 });
      // muted fill pond in the east nook (no default emissive water); regex-visible to fillPouch
      B.pond('pool20', 8, 6, 12, 11, { level: 'mid', color: 0x9fd6e8, emissive: 0x000000, emissiveIntensity: 0, opacity: 0.85 });

      // ===== B: bounce gallery =====
      B.checkpoint(0, 22);
      B.lever('shB', -8, 22, { label: 'Lamp shutter' });
      B.sunlamp('sunB', -10, 24, 3.2, { need: 'shB', to: 'mB1' });
      B.mirror('mB1', -4, 28, 2, [
        { to: [-4, 28, 0] },
        { to: 'mB2' },
      ], { k: 0, label: 'Bounce crystal' });
      B.mirror('dummyB', -4, 32, 2, [{ to: [-4, 32, 0] }], { k: 0, dummy: true, label: 'Crystal' });
      B.mirror('mB2', 8, 30, 2, [
        { to: [8, 30, 0] },
        { to: 'mB3' },
      ], { k: 0, label: 'Bounce crystal' });
      B.mirror('dummyB2', 8, 26, 2, [{ to: [8, 26, 0] }], { k: 0, dummy: true, label: 'Crystal' });
      B.mirror('mB3', 4, 38, 2, [
        { to: [4, 38, 0] },
        { lights: 'gB', to: [0, 40, 2.6] },
      ], { k: 0, label: 'Bounce crystal' });
      B.ghost('gB', 0, 40, 3, 3, 2.6);
      B.wall(0, 41.6, 13, 1.4, 2.6, { bot: 2.1, look: 'cave' }); // stair ledge
      B.ramp(0, 42.3, 2.6, 43.6, 0, { w: 3.2, look: 'cave' }); // back to y=0 before CP-C's arm approach at z=43.8
      B.door('lit:gB', 49, -6.5, 6.5, { look: 'cave', label: 'Bounce door' });

      // ===== C: web hall =====
      B.checkpoint(0, 46);
      B.gearStump(-5, 46, { label: 'Pouch stump' });
      B.deco('act3/night-market/gear-stump', -5, 46, 1.0);
      const spC = B.spider('spC', 6, 54, { yaw: Math.PI });
      B.web('wC', 0, 52, 8, 3.5, { spider: 'spC', label: 'Hall web' });
      B.deco('act3/mirror-caves/pixor-cobweb', 0, 52, 3.2, { h: 1.6, yaw: 0 });
      B.slingTarget('dewC', 6, 54, 4.5, { label: 'Dew crystal', onHit: hitT => {
        spC.look = { x: spC.home.x + 4, z: spC.home.z + 4, until: hitT + 8, go: true };
      } });
      B.strand('spC', 5, 48);
      B.web('wStar', -10, 56, 5, 3.2, { label: 'Secret web' });
      B.deco('act3/mirror-caves/quaternius-cobweb', -10, 56, 2.6, { h: 1.2 });
      B.pickup('star', -12, 58, 1.2, { who: ['trickster'], whyNot: 'Raccoon has to walk this one out — Bee can pop the web first.', set: 'caveStar' });

      // ===== D: dark escort =====
      B.checkpoint(0, 62);
      B.sunlamp('sunD', -8, 64, 3, { shade: [-3, 64, 1.6, 'gD'] });
      B.marker('bruiser', -3, 64, 0, 'Stand in the beam');
      B.ghost('gD', 0, 68, 10, 5.2, 2.5, { bot: 1.9, shadow: true, cross: true });
      B.checkpoint(0, 76);
      B.exit(0, 82, 3);

      // petals (26)
      const P = (x, z, h = 0.9) => B.pickup('petal', x, z, h);
      // z=6 keeps these clear of CP-A / home (0,-1) so a pit-bonk warp cannot graze them
      [-4, -2, 0, 2, 4].forEach(x => P(x, 6));
      P(-2, 16, 3.6); P(0, 17, 3.6); P(2, 18, 3.6);
      [[-8, 26], [-8, 31], [-8, 36], [8, 28], [8, 33], [8, 36]].forEach(([x, z]) => P(x, z));
      P(0, 40, 3.5);
      [-4, 0, 4].forEach(x => P(x, 48));
      P(-12, 54); P(-8, 54);
      P(-4, 65); P(4, 65); P(-4, 71); P(4, 72);
      P(-8, 80); P(8, 80); // off the exit disc so a finish teleport cannot graze them

      // sparse hero crystals + one instanced rock scatter (phone draw calls stay low)
      B.deco('act3/mirror-caves/quaternius-big-crystal', -5, 8, 2.0, { yaw: 0.4 });
      B.deco('act3/mirror-caves/built-crystal-cluster-cyan', 5, 12, 1.6, { yaw: -0.5 });
      B.deco('act3/mirror-caves/quaternius-crystal', -12, 30, 1.8, { yaw: 0.8 });
      B.deco('act3/mirror-caves/built-crystal-cluster-pink', 12, 34, 1.7, { yaw: 1.1 });
      B.deco('act3/mirror-caves/quaternius-crystal-block', -12, 58, 1.4);
      B.deco('act3/mirror-caves/built-crystal-cluster-gold', 5, 72, 1.5, { yaw: 0.3 });
      B.deco('act3/mirror-caves/kenney-nature-cliff-cave-rock', -12, 8, 2.2, { yaw: 0.6 });
      B.deco('act3/mirror-caves/kenney-nature-rock-tall-a', 12, 50, 2.4, { yaw: -0.4 });
      B.scatterRocks([
        [-5.5, 1, 1.1, 0.7, 0.9, 0.3], [5.2, 8, 0.9, 0.55, 1.0, 1.1],
        [-12, 24, 1.3, 0.8, 1.1, 0.5], [12, 28, 1.0, 0.6, 0.9, 2.0],
        [-5.4, 40, 0.8, 0.5, 0.9, 0.8], [5.6, 50, 1.2, 0.7, 1.0, 1.4],
        [-12, 70, 1.1, 0.65, 1.0, 0.2], [5.4, 78, 0.9, 0.5, 0.8, 1.7],
        [-5.2, 86, 1.0, 0.6, 0.9, 0.9], [12, 80, 1.2, 0.7, 1.1, 0.1],
      ], { c: 0x5e5288 });

      B.puzzle('sling', 'Pebble Sling', ['bruiser'], ['lit:gA'], { hint: '🐻 Pick up the Pebble Sling and throw a pebble at the far crystal so the beam lights the ghost bridge.', track: [['gift:sling', 'bruiser', 'pick up the Pebble Sling', 4, 3], ['lit:gA', 'bruiser', 'sling the far crystal', 6, 14, 2]] });
      B.puzzle('bounce', 'Ping and beam', ['trickster', 'scout'], ['lit:gB'], { hint: '🐾 Pull the shutter, whistle to mark the real mirrors, then 🪽 turn the three-bounce path onto the ghost stair.', track: [['shB', 'trickster', 'pull the lamp shutter', -8, 22], ['lit:gB', 'scout', 'aim the three real mirrors', 4, 38, 2]] });
      B.puzzle('web', 'Spider web', ['scout'], ['wC'], { hint: '🫧 Equip the Bubble Pouch at the stump and bubble the web from the south. Or 🪨 sling the dew crystal so the spider looks away.', track: [['wC', 'scout', 'bubble the hall web', 0, 52]] });
      B.puzzle('pup', 'Dark escort', ['scout', 'trickster', 'bruiser'], ['shade:gD'], { hint: 'Turn the lantern off, call the bat pup, then 🐻 stand in lamp D so the shadow bridge is solid.', track: [['shade:gD', 'bruiser', 'stand in the beam', -3, 64]] });
      B.puzzle('caveStar', 'Secret Starseed', ['trickster'], ['caveStar'], { req: false, hint: '🫧 Bubble the side web in the west nook, then 🐾 walk the Starseed out.' });
    },
  },

  grand_garden: {
    ambience: 'grand-garden', // Beans CC0 loop, already in audio/ambient/act3/
    goal: 'Grand Garden', act2: true, key: 'puzzles', ceil: 16, exit: [0, 88], par: 660,
    bounds: { x0: -16, x1: 16, z0: -10, z1: 94 },
    crew: 'Bee · Raccoon · Bear', friend: 'snail', loanGear: 'all',
    escortGoal: { z: 87, sig: 'snail' },
    windStart: 1, waspBlow: 'east', waspClearOnFlip: true,
    windYaw: { down: Math.PI / 2, up: 0 },
    windText: { up: '🌬️ The wind turns — it blows NORTH, up the path', down: '🌬️ The wind turns — it blows EAST, off the path' },
    banter: {
      start: ['🦝 Raccoon: Every bit of gear we found. I\'ll swap as we go.', '🐝 Bee: Sprinklers, wasps, a gnome to climb! Watch this!', '🐻 Bear: The snail is slow. We leave it till the path is safe.', '🦝 Raccoon: Lucky I packed a patience snack.'],
      end: ['🐻 Bear: The snail made it. Slow and steady wins the bed.', '🦝 Raccoon: Greenhouse, gnome, and not one damp whisker.', '🐝 Bee: All our gear, all our tricks, all our friends!', '🐻 Bear: After that, I want a garden nap in the shade.'],
    },
    pip: [
      ['start', 'The snail is slow. Leave it here until the path is safe.'],
      ['z:12', 'Time the sprinkler to fill both cups. The pouch can help.'],
      ['z:44', 'Crank the vane. Blow the buzz off the path, then walk.'],
      ['z:62', 'Each job wants different gear. Swap at the stumps.'],
      [['sig:lvG', 'sig:gnBell'], 'Hold the plates so the spray and mower stay still.'],
      ['stuck:snail', 'Someone has to keep standing on each plate.'],
    ],
    build(B) {
      B.home(0, -5); B.lane(-16, 16, -10, 94, { look: 'hedge' });
      const hedge = (x, z0, z1) => B.hedgeRun(x, z0, z1, { look: 'hedge' });
      // west corridor; greenhouse is wider (x ±8). east gaps: cup lawn, wasp basin, gnome garden
      hedge(-6.5, -10, 24); hedge(-8, 24, 44); hedge(-6.5, 44, 94);
      hedge(6.5, -10, 12); hedge(8, 24, 44); hedge(6.5, 44, 50); hedge(6.5, 60, 66); hedge(6.5, 76, 94);
      B.checkpoint(0, -1);
      B.escort('snail', 3, -2);
      // A · cup lawn
      B.pond('puddle', 10, 8, 15, 13, { level: 'mid' });
      B.sprinkler('skA', 8, 16, { yaw: -Math.PI / 2, r: 7, speed: 0.55, sweep: 1.1, beam: 0.26, high: 8, pause: 'plA' });
      B.plate('plA', -5, 16, { label: 'Tap plate' });
      B.cup('cup1', 2, 16, { fill: 1.4 });
      B.cup('cup2', 2, 20, { fill: 1.4 });
      B.deco('act3/grand-garden/built-sprinkler', 8, 16, 1.6, { yaw: -Math.PI / 2 });
      B.deco('act3/grand-garden/j-toastie-hose-reel-blocky', 11, 18, 1.4, { yaw: Math.PI });
      B.hide('rock', 4, 8, 1.2, 1.2);
      B.checkpoint(0, 22);
      B.door(['cup1', 'cup2'], 24, -6.5, 6.5, { w: 3.2, label: 'Greenhouse door' });
      // B · greenhouse
      B.gearStump(-5, 28, { label: 'Lantern stump' });
      B.deco('act3/grand-garden/pixor-greenhouse', 0, 34, 7.5, { yaw: 0 });
      B.wall(0, 28, 2.2, 1.4, 3.6, { bot: 3.35, c: 0xc8e8a0 }); // vent lip
      B.wall(0, 36, 2.2, 1.4, 3.6, { bot: 3.35, c: 0xc8e8a0 });
      const ventA = B.wall(0, 28, 2.0, 1.2, 4.0, { bot: 3.55, c: 0x9aaa80 }), ventB = B.wall(0, 36, 2.0, 1.2, 4.0, { bot: 3.55, c: 0x9aaa80 });
      B.onSig(['cup1', 'cup2'], on => { ventA.s.off = !!on; ventA.m.visible = !on; ventB.s.off = !!on; ventB.m.visible = !on; });
      B.glowStep(0, 34, 2.2, 1.6, 0.9);
      B.glowStep(0, 36, 2.2, 1.6, 1.8);
      B.glowStep(0, 38, 2.2, 1.6, 2.6);
      B.lever('lvB', 0, 38, { base: 2.6, label: 'Greenhouse lever' });
      B.hide('log', -6, 30, 1.3, 1.2);
      B.door('lvB', 46, -6.5, 6.5, { label: 'Door C' }); // just north of CP-C at z=44 so the flag stays clear of the leaf
      B.checkpoint(0, 44);
      // C · wasp hedge
      B.vane('vC', -5, 48, { label: 'Garden vane' });
      B.puffShroom('mC', 4, 46);
      B.windZone(-6.5, 50, 6.5, 58, { push: 6, h: 3, lift: 0, alt: { down: [1, 0], up: [0, 1] } });
      B.wasps('w1', 0, 52, { r: 4.5 });
      B.wasps('w2', 2, 56, { r: 4.0 });
      B.deco('act3/grand-garden/built-wasp-nest', 0, 52, 1.8);
      B.deco('act3/grand-garden/built-wasp-nest', 2, 56, 1.6);
      B.door('waspClear', 64.5, -6.5, 6.5, { label: 'Door D' }); // north of CP-D so armCp can walk in from z-2.2
      B.checkpoint(0, 62);
      // D · gear garden
      B.gearStump(-8, 63, { label: 'Leaf Glider stump' });
      B.gearStump(0, 63, { label: 'Pebble Sling stump' });
      B.gearStump(8, 63, { label: 'Bubble Pouch stump' });
      B.hide('rock', 4, 63, 1.3, 1.2);
      // pit covers the center path so playB (x=0) cannot walk past z=72 without the glider
      B.glideGap(-6.5, 66, 6.5, 71);
      B.lever('lvG', -4, 73, { label: 'Glider lever' });
      B.slingTarget('gnBell', 12, 72, 7.2, { label: 'Gnome cap bell' });
      B.web('wGnome', 10, 70, 5, 3.2);
      B.deco('act3/grand-garden/built-garden-gnome', 12, 72, 6.4);
      // gnome stair after the web (optional secret route)
      B.wall(12, 68, 2.2, 1.6, 2.0, { look: 'stone' });
      B.wall(12, 70, 2.2, 1.6, 4.0, { look: 'stone' });
      B.wall(12, 72, 2.2, 1.6, 6.0, { look: 'stone' });
      B.wall(12, 74, 2.2, 1.6, 6.0, { look: 'stone' });
      B.door(['lvG', 'gnBell'], 78, -6.5, 6.5, { label: 'Door E' }); // north of CP-E so armCp can walk in from z-2.2
      B.checkpoint(0, 76);
      // E · snail lane
      B.sprinkler('skE', 8, 80, { yaw: -Math.PI / 2, r: 7, speed: 0.45, beam: 0.26, high: 8, pause: 'plE1' });
      B.deco('act3/grand-garden/built-sprinkler', 8, 80, 1.6, { yaw: -Math.PI / 2 });
      B.plate('plE1', -5, 80, { label: 'Sprinkler plate' });
      B.mower('mwE', -6.5, 6.5, 84, { period: 9, dur: 3.2, pause: 'plE2' });
      B.deco('act3/grand-garden/built-push-mower', 0, 84, 1.8);
      B.plate('plE2', -5, 83, { heavy: true, label: 'Mower plate' });
      B.hide('log', -4, 78, 1.3, 1.2);
      B.exit(0, 88, 3);
      // Petals (28) + Scout-only starseed in the gnome cap
      const P = (x, z, y) => B.pickup('petal', x, z, y);
      [[-4, -3], [-2, -0.75], [0, 1.5], [2, 3.75], [4, 6]].forEach(([x, z]) => P(x, z, 0.9));
      [[-4, 14], [-1.3, 16], [1.3, 18], [4, 20]].forEach(([x, z]) => P(x, z, 0.9));
      P(-4, 28, 0.9); P(-1.3, 31.3, 0.9); P(1.3, 34.6, 0.9); P(0, 36, 3.5);
      [[-4, 48], [0, 53], [4, 58]].forEach(([x, z]) => P(x, z, 0.9));
      [[-8, 63], [0, 63], [8, 63]].forEach(([x, z]) => P(x, z, 0.9));
      P(12, 70, 6.9); P(12, 74, 6.9);
      P(-4, 67, 2.5); P(-4, 71, 2.5);
      [[-4, 78], [0, 82], [4, 86]].forEach(([x, z]) => P(x, z, 0.9));
      P(-3, 90, 0.9); P(3, 90, 0.9);
      B.pickup('star', 12, 74, 8.5, { who: ['scout'], whyNot: 'Only Bee fits in the gnome\'s cap.', set: 'gardenStar' });
      // dressing (CC0 Kenney Nature / Fantasy Town / Platformer + built props)
      const g = (k, x, z, h, yaw) => B.deco('act3/grand-garden/' + k, x, z, h, { yaw: yaw || 0 });
      [['kenney-platformer-hedge', -5, -8, 2.2], ['kenney-nature-plant-bush', 5.2, -7, 1.8], ['kenney-nature-flower-yellow-a', -4, 10, 1.0], ['kenney-nature-flower-red-a', 4, 12, 1.0], ['kenney-nature-crop-carrot', 12, 14, 1.0], ['kenney-nature-crops-dirt-row', 13, 20, 1.6], ['kenney-fantasytown-fence', -10, 32, 1.8], ['kenney-nature-flower-purple-a', 5, 40, 1.0], ['kenney-nature-plant-bush-small', -5, 50, 1.2], ['kenney-platformer-flowers-tall', 10, 64, 1.6], ['kenney-nature-flower-yellow-b', 5, 78, 1.0], ['kenney-platformer-hedge', -5, 90, 2.2], ['kenney-platformer-hedge', 5, 90, 2.2]].forEach(([k, x, z, h], i) => g(k, x, z, h, i * 0.7));
      B.puzzle('cups', 'Sprinkler cups', ['scout', 'trickster'], ['cup1', 'cup2'], { hint: 'Time the sprinkler to fill both cups, or hold the plate and use the Bubble Pouch.', track: [['cup1', 'scout', 'fill the first cup', 2, 16], ['cup2', 'scout', 'fill the second cup', 2, 20]] });
      B.puzzle('wasps', 'Wasp wind', ['trickster', 'scout'], ['waspClear'], { hint: 'Light the glow steps, pull the lever, then crank the vane so the buzz blows east.', track: [['lvB', 'trickster', 'climb the glow steps and pull the lever', 0, 38], ['waspClear', 'trickster', 'crank the vane and blow the wasps off the path', -5, 48]] });
      B.puzzle('gear', 'Gear swap', ['trickster', 'bruiser'], ['lvG', 'gnBell'], { hint: 'Swap at the stumps. Glide to the west lever, and sling the gnome\'s cap bell.', track: [['lvG', 'trickster', 'glide the pit and pull the lever', -4, 73], ['gnBell', 'bruiser', 'sling the gnome cap bell', 12, 72]] });
      B.puzzle('snail', 'Snail escort', ['scout', 'trickster', 'bruiser'], ['snail'], { hint: 'Hold the plates so the spray and mower stay still, then walk the snail to the flag.', track: [['plE1', 'trickster', 'hold the sprinkler plate', -5, 80], ['plE2', 'bruiser', 'hold the mower plate', -5, 83], ['snail', 'any', 'walk the snail past the mower', 0, 87]] });
    },
  },

};
