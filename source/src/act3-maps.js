// Act 3 maps (Fern act3-integration.md). Patch 1: Meadow Hub. Patch 2: S5 escort + S3 lures (Practice Yard sandbox). Patch 3: S2 gear yard (stump, pouch, sling, glider).
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
};
