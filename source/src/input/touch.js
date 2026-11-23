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

  function beginJoy(x, y, id) {
    if (joyId !== null || x >= half()) return false;
    joyId = id; jx = x; jy = y;
    if (joy) { joy.style.display = 'block'; joy.style.left = jx + 'px'; joy.style.top = jy + 'px'; }
    if (knob) knob.style.transform = 'translate(0,0)';
    return true;
  }
  function moveJoy(x, y) {
    if (joyId === null) return;
    let dx = x - jx, dy = y - jy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    sx = dx / R; sy = -dy / R;
    if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  function endJoy(id) {
    if (id != null && joyId !== null && id !== joyId) return;
    joyId = null; sx = sy = 0; if (joy) joy.style.display = 'none';
  }
  if (canvas) {
    canvas.addEventListener('pointerdown', e => {
      if (opts.isActive && !opts.isActive()) return;
      e.preventDefault();
      if (beginJoy(e.clientX, e.clientY, e.pointerId)) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      } else if (camId === null) {
        camId = e.pointerId; cx = e.clientX; cy = e.clientY; orbiting = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId === joyId || (joyId !== null && camId !== e.pointerId && e.pointerType === 'touch')) moveJoy(e.clientX, e.clientY);
      else if (e.pointerId === camId) {
        dYaw -= (e.clientX - cx) * 0.008; dPitch += (e.clientY - cy) * 0.006; cx = e.clientX; cy = e.clientY; lastOrbit = performance.now();
      }
    });
    const end = e => {
      endJoy(e.pointerId);
      if (e.pointerId === camId) { camId = null; orbiting = false; lastOrbit = performance.now(); }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // CDP / real touch events do not always synthesize pointerdown. Drive the same
    // left-half stick from touchstart/move/end so guest touch input is reliable.
    const touchPt = (e) => e.changedTouches && e.changedTouches[0];
    canvas.addEventListener('touchstart', e => {
      if (opts.isActive && !opts.isActive()) return;
      const t = touchPt(e); if (!t) return;
      if (beginJoy(t.clientX, t.clientY, 'touch-' + t.identifier)) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      const t = touchPt(e); if (!t) return;
      if (joyId === 'touch-' + t.identifier || (typeof joyId === 'string' && String(joyId).startsWith('touch-'))) {
        moveJoy(t.clientX, t.clientY);
        e.preventDefault();
      }
    }, { passive: false });
    const touchEnd = e => {
      const t = touchPt(e); if (!t) return;
      endJoy('touch-' + t.identifier);
    };
    canvas.addEventListener('touchend', touchEnd);
    canvas.addEventListener('touchcancel', touchEnd);
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
