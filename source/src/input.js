/** Solo input facade: kb-all + touch + gamepad, same API as the old input.js.
 *  Hooks, poll(), active, jumpPressed, actPressed, dYaw/dPitch stay so main.js and tests keep working.
 */
import { createKeyboard, getKeyHub } from './input/keyboard.js';
import { createTouch } from './input/touch.js';
import { createGamepad } from './input/gamepad.js';
import { composeSources } from './input/compose.js';
import { createRemote } from './input/remote.js';
import { makeFrame } from './input/frame.js';

export { createKeyboard, getKeyHub } from './input/keyboard.js';
export { createTouch } from './input/touch.js';
export { createGamepad } from './input/gamepad.js';
export { createRemote } from './input/remote.js';
export { composeSources } from './input/compose.js';
export { makeFrame } from './input/frame.js';

export function createInput(canvas) {
  const hooks = {};
  const hooksRef = { hooks };
  const getCamYaw = () => (inp.getCamYaw ? inp.getCamYaw() : 0);
  const getSneak = () => (inp.getSneak ? !!inp.getSneak() : false);
  const isActive = () => inp.active;

  const keyboardAll = createKeyboard('kb-all', { hooksRef, getCamYaw, getSneak });
  const keyboardLeft = createKeyboard('kb-left', { hooksRef, getCamYaw });
  const keyboardRight = createKeyboard('kb-right', { hooksRef, getCamYaw });
  const touch = createTouch(canvas, { isActive, getCamYaw, getSneak });
  const gamepad = createGamepad({ hooksRef, getCamYaw, getSneak });
  const solo = composeSources([keyboardAll, touch, gamepad], { id: 'kb-all+touch+gamepad', isActive, getCamYaw, getSneak });

  const inp = {
    sx: 0, sy: 0, jump: false, jumpPressed: false, actPressed: false,
    dYaw: 0, dPitch: 0, orbiting: false, lastOrbit: 0, tilt: false, active: false,
    hooks,
    keyboard: { all: keyboardAll, left: keyboardLeft, right: keyboardRight, hub: getKeyHub(hooksRef) },
    touch, gamepad,
    id: 'kb-all+touch+gamepad',
    sources: { keyboardAll, keyboardLeft, keyboardRight, touch, gamepad, solo },
    getCamYaw: null,
    getSneak: null,
    pollFrame() {
      const f = solo.pollFrame();
      inp.sx = f.sx; inp.sy = f.sy; inp.jump = f.jump;
      inp.orbiting = !!touch.orbiting;
      inp.lastOrbit = touch.lastOrbit || inp.lastOrbit;
      if (f.dYaw) inp.dYaw += f.dYaw;
      if (f.dPitch) inp.dPitch += f.dPitch;
      // Keep legacy one-shot flags in sync for any leftover readers.
      if (f.jumpPressed) inp.jumpPressed = true;
      if (f.actPressed) inp.actPressed = true;
      return f;
    },
    poll() {
      if (!inp.active) {
        inp.jumpPressed = inp.actPressed = false;
        return { sx: 0, sy: 0, jump: false };
      }
      const f = inp.pollFrame();
      return { sx: f.sx, sy: f.sy, jump: f.jump };
    },
  };
  return inp;
}
