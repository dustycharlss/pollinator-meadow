// Free cosmetics + emotes (earned by play only — no shop / real money).
import * as THREE from 'three';

export const PALETTES = [
  { id: 'default', name: 'Natural', a: null, b: null, unlock: 0 },
  { id: 'honey', name: 'Honeyglow', a: '#ffd23f', b: '#ff8c42', unlock: 1 },
  { id: 'lilac', name: 'Lilac Soft', a: '#c9a0ff', b: '#7ec8ff', unlock: 2 },
  { id: 'mint', name: 'Mint Dew', a: '#7dffb3', b: '#3ecf8e', unlock: 3 },
  { id: 'berry', name: 'Berry Jam', a: '#ff6b9d', b: '#ffd1e8', unlock: 5 },
  { id: 'sunset', name: 'Sunset', a: '#ff9a3c', b: '#ff5e7a', unlock: 8 },
  { id: 'sky', name: 'Sky Blue', a: '#6ecbff', b: '#ffffff', unlock: 12 },
  { id: 'midnight', name: 'Midnight', a: '#3d4a8a', b: '#b8c0ff', unlock: 16 },
];

export const PATTERNS = [
  { id: 'none', name: 'Plain', unlock: 0 },
  { id: 'stripes', name: 'Stripes', unlock: 2 },
  { id: 'spots', name: 'Spots', unlock: 4 },
  { id: 'hearts', name: 'Heart Dots', unlock: 10 },
];

export const EMOTES = [
  { id: 'wave', name: 'Wave', icon: '👋', unlock: 0 },
  { id: 'hop', name: 'Happy Hop', icon: '⬆️', unlock: 1 },
  { id: 'spin', name: 'Spin', icon: '🌀', unlock: 3 },
  { id: 'toss', name: 'Flower Toss', icon: '🌸', unlock: 6 },
];

function starsFrom(bestsObj) {
  let n = 0;
  for (const v of Object.values(bestsObj || {})) {
    if (typeof v === 'number') n += v >= 5000 ? 3 : v >= 2000 ? 2 : v >= 500 ? 1 : 0;
    else if (v && typeof v === 'object' && typeof v.score === 'number') {
      const s = v.score; n += s >= 5000 ? 3 : s >= 2000 ? 2 : s >= 500 ? 1 : 0;
    }
  }
  return n;
}

export function createCosmetics(ctx) {
  if (!ctx.save.looks) ctx.save.looks = { pal: 'default', pat: 'none', unlocked: { pal: ['default'], pat: ['none'], emo: ['wave'] }, lastEmote: 'wave' };
  const L = ctx.save.looks;
  for (const k of ['pal', 'pat', 'emo']) if (!L.unlocked[k]) L.unlocked[k] = k === 'emo' ? ['wave'] : [k === 'pal' ? 'default' : 'none'];

  const C = { playing: null, t: 0, baseColors: new WeakMap() };

  function playStars() {
    const b = ctx.bests?.() || {};
    return starsFrom(b) + (ctx.save.dew?.length || 0) + Math.floor((ctx.save.journal ? Object.keys(ctx.save.journal).length : 0) / 3) + (L.play || 0);
  }

  C.stars = playStars;

  C.grantPlay = (n = 1) => { ctx.save.looks.play = (ctx.save.looks.play || 0) + n; ctx.persist?.(); return C.refreshUnlocks(); };
  C.refreshUnlocks = () => {
    // include play grants from goals / rounds

    const s = playStars();
    let gained = [];
    for (const p of PALETTES) if (s >= p.unlock && !L.unlocked.pal.includes(p.id)) { L.unlocked.pal.push(p.id); gained.push(p.name); }
    for (const p of PATTERNS) if (s >= p.unlock && !L.unlocked.pat.includes(p.id)) { L.unlocked.pat.push(p.id); gained.push(p.name); }
    for (const e of EMOTES) if (s >= e.unlock && !L.unlocked.emo.includes(e.id)) { L.unlocked.emo.push(e.id); gained.push(e.name); }
    if (gained.length) {
      ctx.persist?.();
      ctx.toast?.(`🎨 Unlocked look: ${gained.slice(0, 2).join(', ')}${gained.length > 2 ? '…' : ''}!`, 3200);
      ctx.audio?.sample?.('ui2/control-unlock-tada', 0.4);
    }
    return gained;
  };

  function rememberBase(mat) {
    if (!C.baseColors.has(mat)) C.baseColors.set(mat, mat.color.clone());
  }

  C.apply = (rider) => {
    if (!rider) return;
    const pal = PALETTES.find(p => p.id === L.pal) || PALETTES[0];
    const pat = PATTERNS.find(p => p.id === L.pat) || PATTERNS[0];
    const ca = pal.a ? new THREE.Color(pal.a) : null;
    const cb = pal.b ? new THREE.Color(pal.b) : null;
    let i = 0;
    rider.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.color) continue;
        rememberBase(m);
        const base = C.baseColors.get(m);
        if (!ca) { m.color.copy(base); }
        else {
          const useB = (pat.id === 'stripes' && (i % 2)) || (pat.id === 'spots' && (i % 3 === 0)) || (pat.id === 'hearts' && (i % 4 === 0));
          const col = useB && cb ? cb : ca;
          m.color.copy(base).lerp(col, 0.72);
        }
        i++;
      }
    });
  };

  C.setPalette = (id) => {
    if (!L.unlocked.pal.includes(id)) { ctx.toast?.('Keep playing to unlock this colour!', 2000); return false; }
    L.pal = id; ctx.persist?.(); C.apply(ctx.rider?.()); ctx.audio?.sample?.('ui/select-pop', 0.4); return true;
  };
  C.setPattern = (id) => {
    if (!L.unlocked.pat.includes(id)) { ctx.toast?.('Keep playing to unlock this pattern!', 2000); return false; }
    L.pat = id; ctx.persist?.(); C.apply(ctx.rider?.()); ctx.audio?.sample?.('ui/select-pop', 0.4); return true;
  };

  C.emote = (id) => {
    if (!L.unlocked.emo.includes(id)) { ctx.toast?.('Earn more stars to unlock this emote!', 2000); return false; }
    if (C.playing) return false;
    L.lastEmote = id; ctx.persist?.();
    C.playing = id; C.t = 0;
    const p = ctx.player?.();
    if (id === 'wave') ctx.audio?.sample?.('ui2/toad-ribbit-hello', 0.35);
    else if (id === 'hop') ctx.audio?.blip?.(5);
    else if (id === 'spin') ctx.audio?.blip?.(7);
    else if (id === 'toss') {
      ctx.audio?.sample?.('ui/select-pop', 0.45);
      if (p && ctx.fx) ctx.fx.burst(p.x, p.y + 1.4, p.z, 28, 6);
    }
    ctx.toast?.(`${EMOTES.find(e => e.id === id)?.icon || ''} ${EMOTES.find(e => e.id === id)?.name || id}!`, 1400);
    return true;
  };
  C.emoteLast = () => C.emote(L.lastEmote || 'wave');
  C.hasEmote = (id) => !!(L.unlocked.emo && L.unlocked.emo.includes(id));


  C.update = (dt, rider, player) => {
    if (!C.playing || !rider) return;
    C.t += dt;
    const body = rider.userData?.body || rider;
    const t = C.t;
    if (C.playing === 'wave') {
      body.rotation.z = Math.sin(t * 10) * 0.35;
      if (t > 1.2) { body.rotation.z = 0; C.playing = null; }
    } else if (C.playing === 'hop') {
      const h = Math.abs(Math.sin(t * 8)) * 0.55;
      body.position.y = h;
      if (t > 1.0) { body.position.y = 0; C.playing = null; }
    } else if (C.playing === 'spin') {
      body.rotation.y = t * Math.PI * 4;
      if (t > 1.0) { body.rotation.y = 0; C.playing = null; }
    } else if (C.playing === 'toss') {
      body.rotation.x = -Math.sin(Math.min(1, t) * Math.PI) * 0.4;
      if (t > 0.5 && t < 0.55 && player && ctx.fx) ctx.fx.burst(player.x, player.y + 1.6, player.z, 18, 5);
      if (t > 1.1) { body.rotation.x = 0; C.playing = null; }
    }
  };

  C.openPanel = () => {
    C.refreshUnlocks();
    let el = document.getElementById('looksPanel');
    if (!el) {
      el = document.createElement('div'); el.id = 'looksPanel';
      el.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(20,12,8,.45);padding:12px';
      document.body.appendChild(el);
    }
    const stars = playStars();
    const chip = (label, on, locked, active) =>
      `<button data-act="${on}" style="font:800 12px system-ui;border:3px solid #3b2614;border-radius:12px;padding:6px 8px;margin:3px;cursor:pointer;background:${active ? '#b8f0a8' : locked ? '#ddd' : '#fff3d8'};opacity:${locked ? .55 : 1}" ${locked ? 'disabled' : ''}>${label}${locked ? ' 🔒' : ''}</button>`;
    el.innerHTML = `<div style="background:#fff8e8;border:4px solid #3b2614;border-radius:20px;padding:14px 16px;max-width:min(420px,94vw);max-height:86vh;overflow:auto;color:#3b2614;box-shadow:0 4px 0 #3b2614">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font:900 16px system-ui">🎨 Looks & Emotes</b>
      <button id="looksX" style="font:900 14px system-ui;border:2px solid #3b2614;border-radius:10px;background:#ffd0c8;padding:2px 8px;cursor:pointer">✕</button></div>
      <div style="font:700 12px system-ui;opacity:.8;margin-bottom:8px">Play stars: ${stars} · earned only, no shop</div>
      <div style="font:800 12px system-ui;margin:6px 0 4px">Colours</div>
      <div>${PALETTES.map(p => chip(p.name, 'pal:' + p.id, !L.unlocked.pal.includes(p.id), L.pal === p.id)).join('')}</div>
      <div style="font:800 12px system-ui;margin:10px 0 4px">Patterns</div>
      <div>${PATTERNS.map(p => chip(p.name, 'pat:' + p.id, !L.unlocked.pat.includes(p.id), L.pat === p.id)).join('')}</div>
      <div style="font:800 12px system-ui;margin:10px 0 4px">Emotes</div>
      <div>${EMOTES.map(e => chip(e.icon + ' ' + e.name, 'emo:' + e.id, !L.unlocked.emo.includes(e.id), L.lastEmote === e.id)).join('')}</div>
    </div>`;
    el.onclick = (ev) => {
      if (ev.target.id === 'looksX' || ev.target === el) { el.style.display = 'none'; return; }
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const [k, id] = b.dataset.act.split(':');
      if (k === 'pal') C.setPalette(id);
      if (k === 'pat') C.setPattern(id);
      if (k === 'emo') { C.emote(id); el.style.display = 'none'; }
      else C.openPanel();
    };
    el.style.display = 'flex';
  };

  C.refreshUnlocks();
  return C;
}
