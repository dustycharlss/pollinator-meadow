/** Grown-up gate + Allow / Direct switches (§4.1).
 *  The gate is a speed bump, not security: no PIN or password in v1.
 *  A 3 s hold (one pointer, or Enter while focused) unlocks the less-safe
 *  direction (Allow ON, Direct ON) for 60 s or until Settings closes.
 *  Turning either switch OFF never needs the gate.
 */
import { isOnlineDev, onlineDefaults } from './flags.js';

const HOLD_MS = 3000;
const OPEN_MS = 60000;
const DIRECT_LABEL = 'Direct mode: connect straight to friends\' devices. This shares your internet address (IP) with their devices.';
const DIRECT_NOTE = 'Off (recommended): everything goes through the safe relay, and no one in the game sees your internet address.';
const DIRECT_CONFIRM = 'Direct mode shares this device\'s internet address with friends\' devices in the game. Turn on?';

export function createOnlineSettings(hooks = {}) {
  let unlocked = false, unlockTimer = null, hold = null, mounted = false;

  function current() {
    return onlineDefaults(hooks.getSettings?.() || {});
  }
  function write(next) {
    const s = hooks.getSettings?.() || {};
    s.online = { allow: next.allow !== false, direct: !!next.direct };
    hooks.saveSettings?.(s);
    hooks.onChange?.(s.online);
    sync();
  }

  function lock() {
    unlocked = false;
    if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
    cancelHold();
    sync();
  }
  function unlock() {
    unlocked = true;
    if (unlockTimer) clearTimeout(unlockTimer);
    unlockTimer = setTimeout(lock, OPEN_MS);
    hooks.audio?.sample?.('ui/menu-tab', 0.35);
    sync();
  }

  function cancelHold() {
    if (!hold) return;
    try { hold.target.releasePointerCapture?.(hold.pointerId); } catch (e) {}
    if (hold.raf) cancelAnimationFrame(hold.raf);
    hold = null;
    const ring = document.getElementById('sOnlineGateRing');
    if (ring) ring.style.setProperty('--ol-p', '0%');
  }
  function startHold(target, pointerId, fromKey) {
    if (hold) return;
    hold = { target, pointerId, fromKey, t0: performance.now(), raf: 0 };
    const step = (now) => {
      if (!hold) return;
      const p = Math.min(1, (now - hold.t0) / HOLD_MS);
      const ring = document.getElementById('sOnlineGateRing');
      if (ring) ring.style.setProperty('--ol-p', (p * 100).toFixed(1) + '%');
      if (p >= 1) { cancelHold(); unlock(); return; }
      hold.raf = requestAnimationFrame(step);
    };
    hold.raf = requestAnimationFrame(step);
  }

  function onSettingsClosed() { lock(); }

  function sync() {
    const box = document.getElementById('sOnline');
    if (!box) return;
    const show = isOnlineDev();
    box.hidden = !show;
    if (!show) return;
    const o = current();
    const allow = document.getElementById('sAllow');
    const direct = document.getElementById('sDirect');
    const directRow = document.getElementById('sDirectRow');
    const hint = document.getElementById('sOnlineHint');
    if (allow) allow.checked = o.allow;
    if (direct) direct.checked = o.direct;
    if (directRow) directRow.hidden = !(unlocked || o.direct);
    if (hint) hint.hidden = unlocked;
    const gate = document.getElementById('sOnlineGate');
    if (gate) gate.setAttribute('aria-pressed', unlocked ? 'true' : 'false');
  }

  function confirmDirect() {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'olRoot';
      ov.style.zIndex = '100';
      ov.innerHTML = `<div class="olCard"><div class="olHead"><h2>Direct mode</h2></div><div class="olBody"><p>${DIRECT_CONFIRM}</p><div class="olRow"><button type="button" class="olBtn" data-y="1">Turn on</button><button type="button" class="olBtn sec" data-y="0">Cancel</button></div></div></div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click', e => {
        const b = e.target.closest('button[data-y]');
        if (!b) return;
        ov.remove();
        resolve(b.getAttribute('data-y') === '1');
      });
    });
  }

  function mount() {
    if (mounted) { sync(); return; }
    const host = document.getElementById('settings');
    const wipe = document.getElementById('sWipe');
    if (!host || !wipe) return;
    const wrap = document.createElement('div');
    wrap.id = 'sOnline';
    wrap.className = 'ksOnline';
    wrap.hidden = !isOnlineDev();
    wrap.innerHTML = `
      <div class="ksSec">Online</div>
      <p class="ksNote">For grown-ups: press and hold for 3 seconds.</p>
      <button type="button" class="olGate" id="sOnlineGate" aria-label="For grown-ups: press and hold for 3 seconds.">
        <span class="olGateRing" id="sOnlineGateRing"></span>
      </button>
      <p class="ksNote" id="sOnlineHint">More online settings appear after the hold.</p>
      <label class="ksChk"><input type="checkbox" id="sAllow"><span>Allow playing with friends (online)</span></label>
      <div id="sDirectRow" hidden>
        <label class="ksChk"><input type="checkbox" id="sDirect"><span>${DIRECT_LABEL}</span></label>
        <p class="ksNote">${DIRECT_NOTE}</p>
      </div>
    `;
    wipe.parentNode.insertBefore(wrap, wipe);
    const gate = document.getElementById('sOnlineGate');
    gate.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      if (hold) return; // second finger / extra pointer does not count
      if (ev.isPrimary === false) return;
      try { gate.setPointerCapture(ev.pointerId); } catch (e) {}
      startHold(gate, ev.pointerId, false);
    });
    const end = ev => { if (hold && (ev.pointerId == null || ev.pointerId === hold.pointerId)) cancelHold(); };
    gate.addEventListener('pointerup', end);
    gate.addEventListener('pointercancel', end);
    gate.addEventListener('lostpointercapture', end);
    gate.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      if (!hold) startHold(gate, 'key', true);
    });
    gate.addEventListener('keyup', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') cancelHold();
    });
    document.getElementById('sAllow').addEventListener('change', ev => {
      const want = ev.target.checked, o = current();
      if (want && !o.allow && !unlocked) { ev.target.checked = false; return; }
      write({ ...o, allow: want });
    });
    document.getElementById('sDirect').addEventListener('change', async ev => {
      const want = ev.target.checked, o = current();
      if (!want) { write({ ...o, direct: false }); return; }
      ev.target.checked = o.direct;
      if (!unlocked) return;
      const ok = await confirmDirect();
      if (ok) write({ ...o, direct: true });
      else sync();
    });
    document.getElementById('sClose')?.addEventListener('click', onSettingsClosed);
    const ov = document.getElementById('settings');
    if (ov) {
      const mo = new MutationObserver(() => {
        if (!ov.classList.contains('on')) onSettingsClosed();
        else if (isOnlineDev() && !document.getElementById('sOnline')?.hidden) {
          // Visible before the grown-up hold (alba-add-hooks.md, N2 menu).
          try { hooks.audio?.speak?.('settings.online.allow'); } catch (e) {}
        }
      });
      mo.observe(ov, { attributes: true, attributeFilter: ['class'] });
    }
    mounted = true;
    sync();
  }

  return { mount, sync, lock, current, onSettingsClosed };
}
