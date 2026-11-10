// Act 3 maps (Fern act3-integration.md). Patch 1: the S1 Meadow Hub glade (home base between levels).
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
      // rescued friends who move in (hidden until rescued)
      B.friend('badger', 12.5, -6.5, { id: 'badger', s: 0.8, yaw: -1.2, say: ['🦡 Badger Bramble: I only LOOK grumpy. Want to see some gear?', '🦡 Badger Bramble: Zzz… oh! Hello, friends.'] });
      for (let i = 0; i < 3; i++) B.friend('duckling', 9.6 + i * 0.9, 12.2 + i * 0.4, { id: 'ducklings', s: 1, yaw: 2.6, say: ['🐥 Ducklings: Peep! Peep peep! (Want to replay a level?)'] });
      B.friend('turtle', 13.8, 12.6, { id: 'turtle', s: 0.7, yaw: -2.4, say: ['🐢 Shelly: Thanks for the ride home. Slow and steady!'] });
      B.friend('owl', -11.5, 12.5, { id: 'owlet', s: 0.6, yaw: 1.2, say: ['🦉 Owlet: Hoo! I keep track of every star you earn.'] });
      B.friend('fawn', -11.8, -8, { id: 'fawn', s: 0.9, yaw: 1.4, say: ['🦌 Fawn: Try on a costume! Skins are just for fun.'] });
      B.friend('fox', 4, 14.5, { id: 'foxkit', s: 0.55, yaw: 3.0, say: ['🦊 Fox kit: I dug a tunnel under the big tree!', '🦊 Fox kit: Tag! You\'re it!'] });
    },
  },
};
