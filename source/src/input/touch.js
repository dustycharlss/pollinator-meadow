/** On-screen joystick + Jump / Act / Sneak / Call. Today's input.js pointer path. */
import { makeFrame } from './frame.js';

export function createTouch(canvas, opts = {}) {
  const joy = document.getElementById('joy');
  const knob = joy && joy.firstElementChild;
  let joyId = null, jx = 0, jy = 0, camId = null, cx = 0, cy = 0;
  const R = 52;
  const half = () => innerWidth * 0.5;
  let sx = 0, sy = 0, jump = false, jumpPressed = false, actPressed = false;
  let dYaw = 0, dPitch = 0, orbiting = false, lastOrbit = 0;
  let seq = 0;

  if (canvas) {
    canvas.addEventListener('pointerdown', e => {
      if (opts.isActive && !opts.isActive()) return;
      e.preventDefault();
      if (joyId === null && (e.clientX < half() || false)) {
        joyId = e.pointerId; jx = e.clientX; jy = e.clientY;
        if (joy) { joy.style.display = 'block'; joy.style.left = jx + 'px'; joy.style.top = jy + 'px'; }
        if (knob) knob.style.transform = 'translate(0,0)';
        canvas.setPointerCapture(e.pointerId);
      } else if (camId === null) {
        camId = e.pointerId; cx = e.clientX; cy = e.clientY; orbiting = true;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId === joyId) {
        let dx = e.clientX - jx, dy = e.clientY - jy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
        sx = dx / R; sy = -dy / R;
        if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
      } else if (e.pointerId === camId) {
        dYaw -= (e.clientX - cx) * 0.008; dPitch += (e.clientY - cy) * 0.006; cx = e.clientX; cy = e.clientY; lastOrbit = performance.now();
      }
    });
    const end = e => {
      if (e.pointerId === joyId) { joyId = null; sx = sy = 0; if (joy) joy.style.display = 'none'; }
      if (e.pointerId === camId) { camId = null; orbiting = false; lastOrbit = performance.now(); }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  const jb = document.getElementById('bJump');
  if (jb) {
    jb.addEventListener('pointerdown', e => { e.preventDefault(); jump = true; jumpPressed = true; jb.classList.add('on'); jb.setPointerCapture?.(e.pointerId); });
    const joff = () => { jump = false; jb.classList.remove('on'); };
    jb.addEventListener('pointerup', joff); jb.addEventListener('pointercancel', joff); jb.addEventListener('lostpointercapture', joff);
  }
  const bAct = document.getElementById('bAct');
  if (bAct) bAct.addEventListener('pointerdown', e => { e.preventDefault(); actPressed = true; });

  const src = {
    id: 'touch',
    get orbiting() { return orbiting; },
    get lastOrbit() { return lastOrbit; },
    pollFrame() {
      const f = makeFrame({
        s: ++seq, sx, sy,
        cy: opts.getCamYaw ? opts.getCamYaw() : 0,
        jump, jumpPressed, actPressed,
        sneakOn: !!(opts.getSneak && opts.getSneak()),
        dYaw, dPitch,
      });
      // Consume one-shot edges (same as today's inp.jumpPressed / actPressed).
      jumpPressed = false; actPressed = false;
      dYaw = 0; dPitch = 0;
      return f;
    },
    poll() { const f = src.pollFrame(); return { sx: f.sx, sy: f.sy, jump: f.jump }; },
    // Used by the facade so build-mode / HUD can still read held jump.
    get jump() { return jump; },
    set jump(v) { jump = !!v; },
    get sx() { return sx; }, set sx(v) { sx = v; },
    get sy() { return sy; }, set sy(v) { sy = v; },
  };
  return src;
}
