/** 8 allowed emotes (§4). No free-text. Rate limit: 1 per 1.5 s. Shown 2.5 s. */

export const EMOTES = [
  { id: 'hi', em: '👋', text: 'Hi!', sfx: 'emote-wave' },
  { id: 'ok', em: '👍', text: 'OK!', sfx: 'emote-ok' },
  { id: 'help', em: '❓', text: 'Help?', sfx: 'emote-help' },
  { id: 'over-here', em: '👉', text: 'Over here!', sfx: 'emote-over-here', ping: true },
  { id: 'wait', em: '⏳', text: 'Wait for me!', sfx: 'emote-wait-for-me' },
  { id: 'follow', em: '🐾', text: 'Follow me!', sfx: 'emote-follow-me' },
  { id: 'yay', em: '🎉', text: 'Yay!', sfx: 'emote-yay' },
  { id: 'thanks', em: '🙏', text: 'Thanks!', sfx: 'emote-thanks' },
];

export const EMOTE_COOLDOWN = 1.5;
export const EMOTE_SHOW = 2.5;

const BY_ID = Object.fromEntries(EMOTES.map(e => [e.id, e]));
export function emoteOf(id) { return BY_ID[id] || null; }
