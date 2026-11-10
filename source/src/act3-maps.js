// Act 3 maps (Fern act3-integration.md). Patch 1: Meadow Hub. Patch 2: S5 escort + S3 lures (Practice Yard sandbox).
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

  // ===== S5/S3 Practice Yard (sandbox, not a campaign level): escort + every new enemy lure =====
  act3_lab: {
    goal: 'Call the baby, try every lure, then bring your crew AND the cub to the 🏁 exit',
    act2: true, loanGear: true, noStars: true, key: 'puzzles', ceil: 10, exit: [0, 24], par: 0,
    bounds: { x0: -20, x1: 20, z0: -10, z1: 30 },
    intro: ['📣 Tap Call (or C) so the badger cub follows you!', 'Try new lures: 🎶 whistle the fox, 🏮 bait the owl, 🌊 float the turtle, 🌬️ blow the wasps, ✨ pebble the crow, 🫧 bubble the web, 🏮 roll the badger, 💦 fill the cup.', '🏁 The exit needs all three friends AND the cub. Nobody gets hurt — a bonk just poofs you back to the 🚩 flag.'],
    build(B) {
      B.home(0, 0); B.lane(-20, 20, -10, 30);
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
    },
  },
};
