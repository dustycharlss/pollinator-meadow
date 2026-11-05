import { ico, kebab } from './assets.js';
// t31u: four big right-side buttons with hold-to-open radial wheels.
// Tap = the button's default; hold (or drag out) = wheel opens; drag onto an option and release to pick it.
export function createWheels({ defs, onOpen, onClose, vibrate = true, sound = null }) {
  const snd = k => { try { sound && sound(k); } catch (e) {} };
  const host = document.getElementById('wheelUi'); const W = { open: null, defs };
  const HOLD = 260, DRAG = 22, R = 104;
  let st = null;
  // ---- ring planner (user rule, 29 Oct): one ring unless its buttons would overlap by more than 10%.
  // overlap(pair) = max(0, (D - dist) / D); on an evenly spaced ring dist = chord = 2*R*sin(pi/n) (full circle) or 2*R*sin(step/2) (our arc).
  // We score the REAL on-screen positions after edge clamping, so corners (which squash the arc) are accounted for.
  const MAXOV = 0.10;
  let Dc = 0;
  function btnD() {
    if (Dc) return Dc; const pr = document.createElement('div'); pr.className = 'wo'; pr.style.cssText = 'visibility:hidden;animation:none;left:-999px;top:-999px';
    host.appendChild(pr); const w = pr.offsetWidth || 66, sc = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1; pr.remove(); return (Dc = w * sc);
  }
  const ovOf = (D, d) => Math.max(0, (D - d) / D);
  function place(n, k, cx, cy, D, cfg) {
    // k = inner count; cfg = { R, R2, a1 } ; returns positions, worst overlap, all-on-screen
    const m = D / 2 + 4, W = innerWidth, Hh = innerHeight, P = [];
    for (let i = 0; i < n; i++) {
      const outer = i >= k, j = outer ? i - k : i, c = outer ? n - k : k, rr = outer ? cfg.R2 : cfg.R;
      const a0 = 92, a1 = cfg.a1 ?? (c > 4 ? 222 : 200), step = c > 1 ? (a1 - a0) / (c - 1) : 0;
      const a = (a0 + step * j) * Math.PI / 180; const rx = cx + Math.cos(a) * rr, ry = cy - Math.sin(a) * rr;
      P.push({ x: Math.max(m, Math.min(W - m, rx)), y: Math.max(m, Math.min(Hh - m, ry)), outer });
    }
    let worst = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) worst = Math.max(worst, ovOf(D, Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y)));
    const on = P.every(q => q.x - D / 2 >= 0 && q.y - D / 2 >= 0 && q.x + D / 2 <= W && q.y + D / 2 <= Hh);
    return { P, worst, on };
  }
  /** pick the layout: single ring if it stays <= 10% overlap, else the most balanced inner/outer split that keeps every pair <= 10% */
  function plan(n, cx, cy) {
    const D = btnD(), R = Math.max(104, D * 1.45);
    const one = place(n, n, cx, cy, D, { R });
    const chord1 = n > 1 ? 2 * R * Math.sin(((n > 4 ? 130 : 108) * Math.PI / 180) / (n - 1) / 2) : 1e9;
    if (one.worst <= MAXOV && one.on) return { ...one, rings: 1, k: n, D, R, chord: chord1, theory: ovOf(D, chord1) };
    let best = null;
    const gap = Math.max(74, D * 1.12);
    for (const dR of [0, 12, 24, 38, 54]) for (const a1 of [null, 205, 240, 260, 180, 170]) {
      for (let dk = 0; dk <= Math.ceil(n / 2); dk++) for (const sg of dk ? [1, -1] : [1]) {
        const k = Math.ceil(n / 2) + sg * dk; if (k < 1 || k >= n) continue;
        const L = place(n, k, cx, cy, D, { R, R2: R + gap + dR, a1 });
        const ok = L.worst <= MAXOV && L.on;
        // preference: feasible > balanced split > small outer radius > default arc
        const score = (ok ? 0 : 1000 + L.worst * 100 + (L.on ? 0 : 50)) + dk * 3 + dR / 10 + (a1 == null ? 0 : 1);
        if (!best || score < best.score) best = { ...L, rings: 2, k, D, R, R2: R + gap + dR, a1, score };
      }
      if (best && best.score < 1000) break;
    }
    return best;
  }
  function layout(btn, opts, id) {
    const b = btn.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    host.innerHTML = ''; host.classList.add('on');
    // fan towards the screen centre: from straight up (90 deg) round to down-left; second, outer ring only when one ring would overlap > 10%
    const pl = plan(opts.length, cx, cy);
    const els = opts.map((o, i) => {
      const { x, y } = pl.P[i];
      const e = document.createElement('div'); e.className = 'wo' + (o.dis ? ' dis' : '') + (pl.P[i].outer ? ' outer' : ''); e.style.left = x + 'px'; e.style.top = y + 'px';
      e.innerHTML = `<span>${ico([o.ik, `wheel-${id}-${kebab(o.label)}`, kebab(o.label)], o.icon, true)}</span><b>${o.label}</b>`; host.appendChild(e); return { e, x, y, o };
    });
    const c = document.createElement('div'); c.className = 'wc'; c.style.left = cx + 'px'; c.style.top = cy + 'px'; host.appendChild(c);
    W.lastPlan = { id, n: opts.length, rings: pl.rings, inner: pl.k, outer: opts.length - pl.k, worst: +pl.worst.toFixed(3), on: pl.on, D: pl.D, R: pl.R, R2: pl.R2 || null, vw: innerWidth, vh: innerHeight };
    return { els, cx, cy };
  }
  W.plan = (n, cx, cy) => plan(n, cx, cy);
  // re-plan on resize / orientation change (button size may change with the viewport); an open wheel is laid out again in place
  const relayout = () => { Dc = 0; if (st && st.L) { const d = defs[st.id]; const opts = (d.options() || []).filter(o => o && !o.hide); if (st.sel) st.sel.e.classList.remove('hi'); st.sel = null; st.L = layout(st.btn, opts, st.id); } };
  addEventListener('resize', relayout); addEventListener('orientationchange', () => setTimeout(relayout, 120));
  function pick(x, y) {
    if (!st || !st.L) return null; let best = null, bd = 1e9;
    for (const it of st.L.els) { const d = Math.hypot(it.x - x, it.y - y); if (d < bd) { bd = d; best = it; } }
    const fromC = Math.hypot(x - st.L.cx, y - st.L.cy);
    return bd < 58 || (fromC > 46 && bd < 95) ? best : null;
  }
  function openWheel() {
    if (!st || st.L) return; const d = defs[st.id]; const opts = (d.options() || []).filter(o => o && !o.hide); if (!opts.length) return;
    st.L = layout(st.btn, opts, st.id); st.wOpen = performance.now(); W.open = st.id; st.btn.classList.add('wopen');
    if (vibrate) try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    snd('open'); onOpen && onOpen(st.id);
  }
  function close() {
    host.classList.remove('on'); host.innerHTML = ''; if (st && st.btn) st.btn.classList.remove('wopen', 'on');
    const was = W.open; W.open = null; clearTimeout(st && st.tm); st = null; if (was) onClose && onClose(was);
  }
  W.close = close;
  // sticky wheel: a plain tap opens it and leaves it open; the next tap picks an option (or closes it when it misses)
  function sticky(id, btn) {
    st = { id, btn, pid: -1, L: null, sel: null, fired: true, sticky: true, mv: 0 }; openWheel(); if (!st || !st.L) { close(); return; }
    const h = ev => { ev.preventDefault(); ev.stopPropagation(); removeEventListener('pointerdown', h, true); W.stickyH = null; const it = pick(ev.clientX, ev.clientY); close();
      if (it && !it.o.dis) { snd('pick'); it.o.on(); } else if (it && it.o.dis && it.o.why) { snd('err'); defs[id].why && defs[id].why(it.o.why); } else snd('cancel'); };
    W.stickyH = h; setTimeout(() => { if (W.stickyH === h) addEventListener('pointerdown', h, true); }, 0);
  }
  W.sticky = id => { const d = defs[id], btn = d && document.getElementById(d.el); if (btn && !st) sticky(id, btn); };
  for (const id in defs) {
    const btn = document.getElementById(defs[id].el); if (!btn) continue;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); if (st) return; if (defs[id].enabled && !defs[id].enabled()) return;
      st = { id, btn, pid: e.pointerId, x0: e.clientX, y0: e.clientY, L: null, sel: null, fired: false, t0: e.timeStamp, w0: performance.now(), mv: 0 };
      btn.classList.add('on'); try { btn.setPointerCapture(e.pointerId); } catch (er) {}
      if (defs[id].down) { defs[id].down(); st.fired = true; }
      st.tm = setTimeout(openWheel, HOLD);
    });
    btn.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.pid) return; st.mv = Math.max(st.mv, Math.hypot(e.clientX - st.x0, e.clientY - st.y0));
      if (!st.L && Math.hypot(e.clientX - st.x0, e.clientY - st.y0) > DRAG) { clearTimeout(st.tm); openWheel(); }
      if (!st || !st.L) return; const it = pick(e.clientX, e.clientY);
      if (it !== st.sel) { if (st.sel) st.sel.e.classList.remove('hi'); st.sel = it; if (it) { it.e.classList.add('hi'); snd('hi'); if (vibrate) try { navigator.vibrate && navigator.vibrate(6); } catch (er) {} } }
    });
    const up = e => {
      if (!st || e.pointerId !== st.pid) return; const s = st;
      if (!s.L) { close(); if (defs[id].tapOpen) return sticky(id, btn); if (!s.fired) defs[id].tap && defs[id].tap(); return; }
      // playtest-01 M2: on slow frames the hold timer can fire before a quick tap's release is handled. A release with
      // nothing highlighted and (almost) no drag is still a tap when the press itself was short (event timestamps), or the
      // wheel only just opened (< 200 ms ago, i.e. the finger came up as it appeared). A real hold-then-centre-release still cancels.
      if (e.type === 'pointerup' && !s.sel && s.mv < DRAG && (e.timeStamp - s.t0 < HOLD + 60 || performance.now() - (s.wOpen || 0) < 200)) { W.lastTap = { id, late: true }; close(); if (defs[id].tapOpen) return sticky(id, btn); if (!s.fired) defs[id].tap && defs[id].tap(); return; }
      const it = e.type === 'pointerup' ? (s.sel || pick(e.clientX, e.clientY)) : null; close();
      if (it && !it.o.dis) { snd('pick'); it.o.on(); } else if (it && it.o.dis && it.o.why) { snd('err'); defs[id].why && defs[id].why(it.o.why); } else if (!it) snd('cancel');
    };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('lostpointercapture', e => { if (st && st.btn === btn && e.pointerId === st.pid) up({ type: 'pointercancel', pointerId: e.pointerId }); });
    btn.oncontextmenu = e => e.preventDefault();
  }
  return W;
}
