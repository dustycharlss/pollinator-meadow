// Act 3 maps (Fern act3-integration.md). Patch 1: Meadow Hub. Patch 2: S5 escort + S3 lures (Practice Yard sandbox). Patch 3: S2 gear yard (stump, pouch, sling, glider). S4: Master Bell kit + Bell Yard demo (act3_bell). Levels 22-24 ship later.
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
      const hedge = (x, z0, z1) => { for (let z = z0; z < z1 - 0.01; z += 2) { const L = Math.min(2, z1 - z), zc = z + L / 2; B.wall(x, zc, 0.6, L + 0.05, 2.4, { look: 'hedge' }); B.wall(x, zc, 0.6, L + 0.05, 30, { bot: 2.3, hidden: true }).s.off = false; } };
      hedge(-6.5, -10, 0); hedge(-6.5, 4, 59); hedge(-6.5, 65, 86); hedge(6.5, -10, 86);
      // the cool cave (west, z 0..8): stone walls, a 3 m mouth at (-8, 2)
      const rock = (x, z, w, d, top = 3) => { B.wall(x, z, w, d, top, { look: 'stone' }); B.wall(x, z, w, d, 30, { bot: top - 0.1, hidden: true }).s.off = false; };
      rock(-12.25, -0.3, 11.5, 0.6); rock(-13, 8.3, 10, 0.6); rock(-8, 0.25, 0.6, 0.5, 2.4); rock(-8, 5.9, 0.6, 4.2, 2.4); rock(-7.25, 6.2, 1.5, 4, 2.4);
      B.wall(-13, 4, 10, 8.6, 3.2, { bot: 2.6, look: 'stone' }); // roof (cool + dim inside)
      B.deco('act3/ember-ridge/cave-entrance', -8.6, 2, 3.4, { yaw: -Math.PI / 2 });
      B.deco('act3/ember-ridge/rock-tall', -17, 1.5, 2.2); B.deco('act3/ember-ridge/rock-large', -16.5, 7, 1.6);
      B.gift('bubble', -14, 2, 0.6);
      B.gearStump(-7, 3.2, { label: 'Gear stump' });
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
      B.puzzle('pouch', 'Bubble Pouch', ['scout'], ['safe:emA'], { hint: '🪽 Find the Bubble Pouch in the cool cave · dip low over the creek to fill it · face the sparks and press G (or Use) to puff them out.', track: [['gift:bubble', 'any', 'find the Bubble Pouch in the cool cave', -14, 2, 0.6], ['safe:emA', 'scout', 'fill it in the creek, then puff ember A', 0, 13]] });
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
      const hedge = (x, z0, z1) => { for (let z = z0; z < z1 - 0.01; z += 2) { const L = Math.min(2, z1 - z), zc = z + L / 2; B.wall(x, zc, 0.6, L + 0.05, 2.4, { look: 'hedge' }); B.wall(x, zc, 0.6, L + 0.05, 30, { bot: 2.3, hidden: true }).s.off = false; } };
      hedge(-6.5, -10, 10); hedge(6.5, -10, 10);
      B.checkpoint(0, -1);
      B.escort('duckling', 3, -2, { count: 3 });
      B.gearStump(-4, 10, { label: 'Gear stump' });
      B.hide('log', -4, 12, 1.4, 1.4);
      // sluices (Trickster) — custom mill pond: dry / 2.4 m / 5.0 m
      B.pond('millPond', -14, 10, 14, 67.5, { level: 'mid', heights: { low: 0, mid: 2.4, high: 5.0 } });
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

};
