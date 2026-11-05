export function createInput(canvas) {
  const inp = { sx: 0, sy: 0, jump: false, jumpPressed: false, actPressed: false, dYaw: 0, dPitch: 0, orbiting: false, lastOrbit: 0, tilt: false, active: false };
  const keys = {}; const joy = document.getElementById('joy'), knob = joy.firstElementChild;
  let joyId = null, jx = 0, jy = 0, camId = null, cx = 0, cy = 0;
  const R = 52;
  const half = () => innerWidth * 0.5;
  canvas.addEventListener('pointerdown', e => {
    if (!inp.active) return; e.preventDefault();
    if ((e.clientX < half() || e.pointerType === 'mouse' && e.button === 0 && !e.shiftKey && false) && joyId === null) {
      joyId = e.pointerId; jx = e.clientX; jy = e.clientY; joy.style.display = 'block'; joy.style.left = jx + 'px'; joy.style.top = jy + 'px'; knob.style.transform = 'translate(0,0)'; canvas.setPointerCapture(e.pointerId);
    } else if (camId === null) { camId = e.pointerId; cx = e.clientX; cy = e.clientY; inp.orbiting = true; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId === joyId) {
      let dx = e.clientX - jx, dy = e.clientY - jy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      inp.sx = dx / R; inp.sy = -dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (e.pointerId === camId) {
      inp.dYaw -= (e.clientX - cx) * 0.008; inp.dPitch += (e.clientY - cy) * 0.006; cx = e.clientX; cy = e.clientY; inp.lastOrbit = performance.now();
    }
  });
  const end = e => {
    if (e.pointerId === joyId) { joyId = null; inp.sx = inp.sy = 0; joy.style.display = 'none'; }
    if (e.pointerId === camId) { camId = null; inp.orbiting = false; inp.lastOrbit = performance.now(); }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  const hold = (id, key) => { const el = document.getElementById(id); const on = e => { e.preventDefault(); inp[key] = true; el.classList.add('on'); el.setPointerCapture?.(e.pointerId); }; const off = () => { inp[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off); };
  const jb = document.getElementById('bJump');
  jb.addEventListener('pointerdown', e => { e.preventDefault(); inp.jump = true; inp.jumpPressed = true; jb.classList.add('on'); jb.setPointerCapture?.(e.pointerId); });
  const joff = () => { inp.jump = false; jb.classList.remove('on'); };
  jb.addEventListener('pointerup', joff); jb.addEventListener('pointercancel', joff); jb.addEventListener('lostpointercapture', joff);
  document.getElementById('bAct').addEventListener('pointerdown', e => { e.preventDefault(); inp.actPressed = true; });

  const hooks = {};
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (keys[k]) return; keys[k] = true;
    if (k === ' ') inp.jumpPressed = true;
    if (k === 'e' || k === 'x') inp.actPressed = true;
    if (k >= '1' && k <= '9') hooks.species && hooks.species(+k - 1); else if (k === '0') hooks.species && hooks.species(9);
    if (k === 'n') hooks.night && hooks.night();
    if (k === 'b') hooks.season && hooks.season();
    if (k === 'tab') { e.preventDefault(); hooks.swap && hooks.swap(e.shiftKey ? -1 : 1); }
    if (k === 'm') hooks.menu && hooks.menu();
    if (k === 'j') hooks.journal && hooks.journal();
    if (k === 'g') hooks.shop && hooks.shop();
    if (k === 't') hooks.tech && hooks.tech();
    if (k === 'escape') hooks.esc && hooks.esc();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  inp.hooks = hooks;
  inp.poll = () => {
    if (!inp.active) { inp.jumpPressed = inp.actPressed = false; return { sx: 0, sy: 0, jump: false }; }
    const k = keys; let kx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0), ky = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    if (k['q']) inp.dYaw += 0.04; if (k['r']) inp.dYaw -= 0.04;
    return { sx: Math.abs(kx) > 0 ? kx : inp.sx, sy: Math.abs(ky) > 0 ? ky : inp.sy, jump: inp.jump || !!k[' '] };
  };
  return inp;
}
