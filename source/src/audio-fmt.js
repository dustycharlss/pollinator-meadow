// Music + ambience format pick (Beans' loop-safe set, Nov 2026): every bed ships as Opus-in-Ogg (.ogg) + AAC-LC (.m4a, iTunSMPB/elst gapless).
// Serve Opus where the browser says it can play Opus; otherwise AAC (iOS / older Safari). Two ambient .ogg files are still original
// Vorbis copies (birdsong, wind-grass), so any element whose .ogg fails to decode retries once with the .m4a.
const probe = t => { try { return document.createElement('audio').canPlayType(t); } catch (e) { return ''; } };
export const OPUS_OK = !!probe('audio/ogg; codecs="opus"');
export const EXT = OPUS_OK ? 'ogg' : 'm4a';
/** SFX one-shots are still Vorbis .ogg + .m4a; keep the Vorbis test for them */
export const EXT_SFX = probe('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
/** one-shot .ogg → .m4a retry on a media element (keeps loop / play state) */
export function withFallback(el) {
  el.addEventListener('error', () => {
    const s = el.currentSrc || el.src || '';
    if (!/\.ogg(\?|$)/.test(s) || el.dataset.fb) return;
    el.dataset.fb = '1'; const play = !el.paused || el.autoplay || el.dataset.want === '1';
    el.src = s.replace(/\.ogg(\?|$)/, '.m4a$1'); el.load(); if (play) el.play().catch(() => {});
  });
  const p = el.play.bind(el); el.play = () => { el.dataset.want = '1'; return p(); };
  return el;
}
