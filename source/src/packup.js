// Pack Up finale — Tidy Up feel on YOUR buildings; 50% cost refund; leave bloom wild.
import { CATALOG, RES_ICON } from './build.js';

export function createPackUp(ctx) {
  const P = {
    active: false,
    target: null, // build record
    prog: 0,
    need: 1,
    cool: 0,
    ringEl: null,
    left: 0,
  };

  function ensureRing() {
    if (P.ringEl) return;
    const el = document.createElement('div');
    el.id = 'packRing';
    el.innerHTML = '<i></i><b>Pack</b>';
    el.style.cssText = 'display:none;position:fixed;width:72px;height:72px;border-radius:50%;border:4px solid #3b2614;background:rgba(255,243,216,.92);pointer-events:none;z-index:40;align-items:center;justify-content:center;flex-direction:column;font-weight:800;color:#3b2614;box-shadow:0 4px 0 #3b2614';
    el.querySelector('i').style.cssText = 'position:absolute;inset:4px;border-radius:50%;border:4px solid transparent;border-top-color:#7fc6e8;transform:rotate(0deg)';
    document.body.appendChild(el);
    P.ringEl = el;
  }

  P.canStart = () => {
    const sess = ctx.valleySession?.();
    if (!sess) return false;
    if ((ctx.heal?.() || 0) < (ctx.valley?.healThreshold || 0.85)) return false;
    const def = ctx.valley?.def?.(sess.patchId);
    if (def?.contest && def.contest !== 'festival') {
      const st = ctx.valley.get(sess.patchId);
      if (!st?.contestDone) return false;
    }
    return true;
  };

  P.begin = () => {
    if (!P.canStart()) {
      const sess = ctx.valleySession?.();
      const def = sess && ctx.valley?.def?.(sess.patchId);
      if ((ctx.heal?.() || 0) < (ctx.valley?.healThreshold || 0.85)) ctx.toast?.('Heal the patch to 85% first!', 2200);
      else if (def?.contest && def.contest !== 'festival' && !ctx.valley.get(sess.patchId)?.contestDone) ctx.toast?.('Win the neighbor contest first!', 2400);
      else ctx.toast?.('Not ready to pack up yet', 2000);
      return false;
    }
    P.active = true; P.target = null; P.prog = 0;
    const n = (ctx.build?.placed || []).filter(b => b.type !== 'home').length;
    P.left = n;
    ctx.toast?.(n ? '📦 Pack Up! Tap near each building to pack it' : '📦 Nothing to pack — leave the bloom wild!', 3200);
    ctx.audio?.sample?.('ui/wheel-open-whoosh', 0.4);
    ctx.onPackStart?.();
    if (!n) { P.finishAll(); return true; }
    ensureRing();
    return true;
  };

  P.cancel = () => {
    P.active = false; P.target = null; P.prog = 0;
    if (P.ringEl) P.ringEl.style.display = 'none';
  };

  function nearest(p) {
    const placed = ctx.build?.placed || [];
    let best = null, bd = 7;
    for (const b of placed) {
      if (b.type === 'home') continue;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  P.tap = (p) => {
    if (!P.active || !p) return false;
    const b = nearest(p);
    if (!b) { ctx.toast?.('Stand closer to one of your buildings', 1800); return false; }
    if (P.target && P.target !== b) { P.prog = 0; }
    P.target = b;
    if (P.cool > 0) return true;
    P.prog += 0.14; P.cool = 0.16;
    ctx.audio?.sample?.('build/place-thud', 0.28);
    ensureRing();
    updateRing(p);
    if (P.prog >= P.need) completeOne(b);
    return true;
  };

  function refundOf(b) {
    const paid = b.paid;
    if (paid) {
      const o = {};
      for (const k in paid) o[k] = Math.max(0, Math.floor(paid[k] * (ctx.valley?.refund ?? 0.5)));
      return o;
    }
    // fallback: half of catalog base
    const C = CATALOG[b.type];
    if (!C?.base) return {};
    const o = {};
    for (const k in C.base) o[k] = Math.max(0, Math.floor(C.base[k] * (ctx.valley?.refund ?? 0.5)));
    return o;
  }

  function completeOne(b) {
    const ref = refundOf(b);
    const label = Object.entries(ref).filter(([, v]) => v > 0).map(([k, v]) => (RES_ICON[k] || k) + v).join(' ') || 'bits';
    const scr = ctx.worldToScreen?.(b.x, (b.obj?.position?.y || 0) + 1.0, b.z) || { x: innerWidth / 2, y: innerHeight / 2 };
    P.target = null; P.prog = 0;
    if (P.ringEl) P.ringEl.style.display = 'none';
    let refunded = false, removed = false;
    const doRefund = () => {
      if (refunded) return; refunded = true;
      for (const k in ref) if (ref[k] > 0) ctx.round?.addRes(k, ref[k]);
      ctx.audio?.sample?.('build/place-thunk', 0.45);
      const pop = document.createElement('div');
      pop.className = 'packRefund';
      pop.textContent = '✨ ' + label;
      pop.style.left = scr.x + 'px';
      pop.style.top = scr.y + 'px';
      document.body.appendChild(pop);
      setTimeout(() => pop.remove(), 900);
    };
    const doHide = () => {
      if (removed) return; removed = true;
      if (b.obj) b.obj.visible = false;
    };
    const finish = () => {
      if (!removed) doHide();
      if (!refunded) doRefund();
      ctx.build?.removeOne?.(b);
      P.left = (ctx.build?.placed || []).filter(q => q.type !== 'home').length;
      if (P.left <= 0) P.finishAll();
    };
    if (ctx.playBurst) {
      ctx.playBurst(scr.x, scr.y, { onHide: doHide, onRefund: doRefund, onDone: finish });
    } else {
      ctx.fx?.burst?.(b.x, (b.obj?.position?.y || 0) + 1.2, b.z, 30, 7);
      doHide(); doRefund(); finish();
    }
  }

  P.finishAll = () => {
    P.active = false; P.target = null;
    if (P.ringEl) P.ringEl.style.display = 'none';
    ctx.audio?.sample?.('ui2/control-unlock-tada', 0.5);
    ctx.toast?.('🌸 Patch left wild and blooming. Pack complete!', 3600);
    ctx.onPackDone?.();
  };

  function updateRing(p) {
    if (!P.ringEl || !P.target) { if (P.ringEl) P.ringEl.style.display = 'none'; return; }
    const scr = ctx.worldToScreen?.(P.target.x, (P.target.obj?.position?.y || 0) + 2, P.target.z);
    if (!scr) { P.ringEl.style.display = 'none'; return; }
    P.ringEl.style.display = 'flex';
    P.ringEl.style.left = (scr.x - 36) + 'px';
    P.ringEl.style.top = (scr.y - 36) + 'px';
    const i = P.ringEl.querySelector('i');
    if (i) i.style.transform = `rotate(${P.prog * 360}deg)`;
    P.ringEl.querySelector('b').textContent = Math.round(P.prog * 100) + '%';
  }

  P.update = (dt, p) => {
    if (!P.active) return;
    P.cool = Math.max(0, P.cool - dt);
    if (P.target && p) {
      if (Math.hypot(p.x - P.target.x, p.z - P.target.z) > 9) { P.prog = Math.max(0, P.prog - dt * 0.25); }
      updateRing(p);
    }
  };

  return P;
}
