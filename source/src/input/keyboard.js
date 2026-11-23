/** Keyboard InputSources. One shared key hub, several mode views.
 *  kb-all: today's layout (WASD|arrows). kb-left / kb-right: S8 split (act3-shop-coop.md §2.2).
 */
import { makeFrame } from './frame.js';

const MODES = {
  'kb-all': {
    left: ['a', 'arrowleft'], right: ['d', 'arrowright'], up: ['w', 'arrowup'], down: ['s', 'arrowdown'],
    jump: [' '], jumpCodes: ['Space'], act: ['e', 'x'], sneakAnyShift: true,
    sneakCodes: ['ShiftLeft', 'ShiftRight'], call: ['c'], gear: ['g'], camL: ['q'], camR: ['r'],
  },
  'kb-left': {
    left: ['a'], right: ['d'], up: ['w'], down: ['s'],
    jump: [' '], jumpCodes: ['Space'], act: ['e'], sneakAnyShift: false,
    sneakCodes: ['ShiftLeft'], call: ['c'], gear: ['g'], camL: ['q'], camR: ['r'],
  },
  'kb-right': {
    left: ['arrowleft'], right: ['arrowright'], up: ['arrowup'], down: ['arrowdown'],
    jump: ['enter'], jumpCodes: ['Enter', 'NumpadEnter'], act: ['x'], sneakAnyShift: false,
    sneakCodes: ['ShiftRight'], call: ['c', ','], gear: ['h'], camL: [], camR: [],
  },
};

function down(hub, names, codes) {
  if (names) for (const n of names) if (hub.keys[n]) return true;
  if (codes) for (const c of codes) if (hub.codes[c]) return true;
  return false;
}

let HUB = null;

export function getKeyHub(hooksRef) {
  if (HUB) {
    if (hooksRef) HUB.hooksRef = hooksRef;
    return HUB;
  }
  const keys = {}, codes = {};
  const edge = { jump: {}, act: {}, call: {}, gear: {}, sneak: {}, swap: 0, species: -1 };
  const hub = { keys, codes, edge, hooksRef: hooksRef || { hooks: {} }, useAllHooks: true, sneakOn: { 'kb-all': false, 'kb-left': false, 'kb-right': false } };

  const onKeyDown = e => {
    const k = e.key.toLowerCase();
    const code = e.code || '';
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (keys[k] && (k !== 'shift' || codes[code])) return; // ignore repeats (shift can flip sides)
    keys[k] = true;
    codes[code] = true;
    const hooks = hub.hooksRef.hooks || {};
    // Global meta (shared in solo and split): menu, journal, pause, night, season, numbers, tab.
    if (k === 'n') hooks.night && hooks.night();
    if (k === 'b') hooks.season && hooks.season();
    if (k >= '1' && k <= '9') hooks.species && hooks.species(+k - 1); else if (k === '0') hooks.species && hooks.species(9);
    if (k === 'tab') { e.preventDefault(); hooks.swap && hooks.swap(e.shiftKey ? -1 : 1); }
    if (k === 'm') hooks.menu && hooks.menu();
    if (k === 'j') hooks.journal && hooks.journal();
    if (k === 't') hooks.tech && hooks.tech();
    if (k === 'escape') hooks.esc && hooks.esc();
    // Mode-owned edges are recorded here; each source consumes its own on poll.
    for (const [mode, M] of Object.entries(MODES)) {
      if (M.jump.includes(k) || (M.jumpCodes && M.jumpCodes.includes(code))) edge.jump[mode] = (edge.jump[mode] || 0) + 1;
      if (M.act.includes(k)) edge.act[mode] = (edge.act[mode] || 0) + 1;
      if (M.call.includes(k)) edge.call[mode] = (edge.call[mode] || 0) + 1;
      if (M.gear.includes(k)) edge.gear[mode] = (edge.gear[mode] || 0) + 1;
      const sneakHit = (M.sneakAnyShift && k === 'shift') || (M.sneakCodes && M.sneakCodes.includes(code));
      if (sneakHit) {
        hub.sneakOn[mode] = !hub.sneakOn[mode];
        edge.sneak[mode] = (edge.sneak[mode] || 0) + 1;
      }
    }
    // Solo keeps today's hook timing: C call, G gear, Shift sneak. Split mode leaves those to per-slot frames.
    if (k === 'c') hooks.call && hooks.call();
    if (k === 'g' && hub.useAllHooks) hooks.shop && hooks.shop();
    if (k === 'shift' && hub.useAllHooks) hooks.sneak && hooks.sneak();
  };
  const onKeyUp = e => {
    keys[e.key.toLowerCase()] = false;
    if (e.code) codes[e.code] = false;
  };
  // Capture on window + document so Playwright mobile keys reach the game even
  // if a hidden lobby control is focused or a bubble listener stops the event.
  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  HUB = hub;
  return hub;
}

export function createKeyboard(mode = 'kb-all', opts = {}) {
  const hub = getKeyHub(opts.hooksRef);
  const M = MODES[mode] || MODES['kb-all'];
  let seq = 0;
  let seen = { jump: 0, act: 0, call: 0, gear: 0 };
  const src = {
    id: mode,
    pollFrame() {
      const kx = (down(hub, M.right) ? 1 : 0) - (down(hub, M.left) ? 1 : 0);
      const ky = (down(hub, M.up) ? 1 : 0) - (down(hub, M.down) ? 1 : 0);
      let dYaw = 0;
      if (down(hub, M.camL)) dYaw += 0.04;
      if (down(hub, M.camR)) dYaw -= 0.04;
      const jumpN = hub.edge.jump[mode] || 0;
      const actN = hub.edge.act[mode] || 0;
      const callN = hub.edge.call[mode] || 0;
      const gearN = hub.edge.gear[mode] || 0;
      const jumpPressed = jumpN !== seen.jump;
      const actPressed = actN !== seen.act;
      const callPressed = callN !== seen.call;
      const gearPressed = gearN !== seen.gear;
      seen = { jump: jumpN, act: actN, call: callN, gear: gearN };
      let sneakOn = !!hub.sneakOn[mode];
      if (mode === 'kb-all' && opts.getSneak) sneakOn = !!opts.getSneak() || sneakOn;
      const f = makeFrame({
        s: ++seq,
        sx: kx, sy: ky,
        cy: opts.getCamYaw ? opts.getCamYaw() : 0,
        jump: down(hub, M.jump, M.jumpCodes),
        sneakOn,
        jumpPressed, actPressed, callPressed, gearPressed,
        dYaw,
        e: { jump: jumpN, act: actN, call: callN, gear: gearN, swap: 0, emote: 0, emoteId: 0 },
      });
      return f;
    },
    poll() { const f = src.pollFrame(); return { sx: f.sx, sy: f.sy, jump: f.jump }; },
  };
  return src;
}

export { MODES as KEY_MODES };
