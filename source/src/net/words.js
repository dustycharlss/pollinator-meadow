/** Approved 64 room-code words and 16-icon PIN subset (room-code-words.md, frozen). */

export const TABS = [
  { id: 'animals', em: '🐾', label: 'Animals', words: [
    'owl', 'fox', 'turtle', 'rabbit', 'koala', 'panda', 'sloth', 'giraffe',
    'penguin', 'dolphin', 'octopus', 'ladybug', 'puppy', 'snail', 'feather', 'nest',
  ] },
  { id: 'food', em: '🍴', label: 'Food & plants', words: [
    'orange', 'lemon', 'carrot', 'kiwi', 'pretzel', 'honey', 'pizza', 'cupcake',
    'ice', 'acorn', 'leaf', 'tulip', 'cactus', 'clover', 'tree', 'sprout',
  ] },
  { id: 'outside', em: '☀️', label: 'Outside', words: [
    'frog', 'apple', 'moon', 'cloud', 'snow', 'rocket', 'planet', 'rainbow',
    'sunrise', 'ocean', 'boat', 'anchor', 'castle', 'crown', 'train', 'kite',
  ] },
  { id: 'home', em: '🧸', label: 'Home & toys', words: [
    'lantern', 'drum', 'violin', 'crayon', 'robot', 'magnet', 'trumpet', 'gift',
    'puzzle', 'balloon', 'piano', 'hamster', 'bubble', 'globe', 'sparkle', 'donut',
  ] },
];

export const EMOJI = {
  owl: '🦉', fox: '🦊', turtle: '🐢', rabbit: '🐰', koala: '🐨', panda: '🐼', sloth: '🦥', giraffe: '🦒',
  penguin: '🐧', dolphin: '🐬', octopus: '🐙', ladybug: '🐞', puppy: '🐶', snail: '🐌', feather: '🪶', nest: '🪺',
  orange: '🍊', lemon: '🍋', carrot: '🥕', kiwi: '🥝', pretzel: '🥨', honey: '🍯', pizza: '🍕', cupcake: '🧁',
  ice: '🧊', acorn: '🌰', leaf: '🍃', tulip: '🌷', cactus: '🌵', clover: '🍀', tree: '🌳', sprout: '🌱',
  frog: '🐸', apple: '🍎', moon: '🌙', cloud: '☁️', snow: '❄️', rocket: '🚀', planet: '🪐', rainbow: '🌈',
  sunrise: '🌅', ocean: '🌊', boat: '⛵', anchor: '⚓', castle: '🏰', crown: '👑', train: '🚂', kite: '🪁',
  lantern: '🏮', drum: '🥁', violin: '🎻', crayon: '🖍️', robot: '🤖', magnet: '🧲', trumpet: '🎺', gift: '🎁',
  puzzle: '🧩', balloon: '🎈', piano: '🎹', hamster: '🐹', bubble: '🫧', globe: '🌍', sparkle: '✨', donut: '🍩',
};

export const PIN_WORDS = ['owl', 'fox', 'penguin', 'turtle', 'puppy', 'apple', 'carrot', 'cactus', 'tree', 'moon', 'rainbow', 'rocket', 'boat', 'crown', 'robot', 'drum'];

export const ALL_WORDS = TABS.flatMap(t => t.words);
const WORD_SET = new Set(ALL_WORDS);
const TAB_OF = {};
TABS.forEach((t, i) => t.words.forEach(w => { TAB_OF[w] = i; }));

export function tabOf(word) { return TAB_OF[word] ?? -1; }
export function isWord(w) { return WORD_SET.has(String(w || '').toLowerCase()); }

export function normalizeCode(s) {
  if (!s) return [];
  return String(s).toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

export function parseCode(s) {
  const parts = normalizeCode(s);
  if (parts.length !== 4 || !parts.every(isWord)) return null;
  return parts;
}

export function formatCode(words, sep = '-') {
  return (words || []).map(w => String(w).toLowerCase()).join(sep);
}

export function formatSpoken(words) {
  return (words || []).join(', ');
}

export function randomCode() {
  const out = [];
  for (let i = 0; i < 4; i++) out.push(ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)]);
  return out;
}

export function randomPin() {
  const out = [];
  for (let i = 0; i < 4; i++) out.push(PIN_WORDS[Math.floor(Math.random() * PIN_WORDS.length)]);
  return out;
}

export function pinIndices(words) {
  return (words || []).map(w => PIN_WORDS.indexOf(w)).filter(i => i >= 0);
}

/** Autocomplete after 3 letters. clover/cloud both match clo. */
export function suggestWords(prefix) {
  const p = String(prefix || '').toLowerCase().replace(/[^a-z]/g, '');
  if (p.length < 3) return [];
  return ALL_WORDS.filter(w => w.startsWith(p));
}

export function roomChannelId(words) {
  return 'pm-' + formatCode(words, '-');
}

export function shareLink(words, origin, path) {
  const origin0 = origin || (typeof location !== 'undefined' ? location.origin : '');
  let path0 = path || (typeof location !== 'undefined' ? location.pathname : '/');
  path0 = String(path0 || '/').replace(/index\.html$/i, '');
  if (!path0.endsWith('/')) path0 += '/';
  // N2 is behind ?online=dev; the PIN is never in the link (§3.6 check 6).
  return `${origin0}${path0}?online=dev&join=${formatCode(words, '-')}`;
}
