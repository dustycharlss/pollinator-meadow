import { stampUrl, inviteRingAccepts } from './valley-art.js';
// Neighbor contests (overhaul-123): Dance-Off, Pollen Relay, Pretty-Up. Retires Peekaboo/Snack Swipe/Flower Flag/rival Tidy Up.
import { SPECIES } from './data.js';

export const CONTEST_DEFS = {
  dance_off: { id: 'dance_off', name: 'Dance-Off', emoji: '💃', seconds: [30, 45], neighborScore: 0.7 },
  pollen_relay: { id: 'pollen_relay', name: 'Pollen Relay', emoji: '🌼', seconds: [40, 60], legs: 3 },
  decorating: { id: 'decorating', name: 'Pretty-Up', emoji: '🎀', seconds: [45, 70], pieces: 5 },
  festival: { id: 'festival', name: 'Meadow Festival', emoji: '🎉', seconds: [20, 30] },
};

const DANCE_MOVES = [
  { id: 'wave', icon: '👋', name: 'Wave' },
  { id: 'hop', icon: '🐇', name: 'Hop' },
  { id: 'spin', icon: '💫', name: 'Spin' },
  { id: 'bow', icon: '🙇', name: 'Bow' },
];

const DECO = [
  { id: 'bow', icon: '🎀', name: 'Twig bow' },
  { id: 'pebbles', icon: '🪨', name: 'Pebble stack' },
  { id: 'crown', icon: '👑', name: 'Flower crown' },
  { id: 'bunting', icon: '🎏', name: 'Leaf bunting' },
  { id: 'lamp', icon: '🪔', name: 'Acorn lamp' },
];

export function createContests(ctx) {
  const S = {
    active: null, // { type, patchId, neighbor, t, maxT, score, need, ... }
    inviteReady: false,
    inviteAt: 0,
    retryAt: 0,
    el: null,
  };

  function ensureUi() {
    if (S.el) return S.el;
    const el = document.createElement('div');
    el.id = 'contestUi';
    el.innerHTML = `
      <div class="cvInvite" id="cvInvite" style="display:none">
        <div class="cvCard">
          <div class="cvRing" id="cvInvRing" aria-hidden="true"></div>
          <span class="cvEm" id="cvInvEm">💃</span>
          <b id="cvInvTitle">Contest?</b>
          <p id="cvInvTxt"></p>
          <div class="cvRow"><button class="big" id="cvYes">Let's play!</button><button class="big sec" id="cvNo">Maybe later</button></div>
        </div>
      </div>
      <div class="cvPlay" id="cvPlay" style="display:none">
        <div class="cvHud"><span id="cvName"></span><span id="cvTimer"></span><span id="cvScore"></span></div>
        <div id="cvBody"></div>
        <p id="cvHint" class="cvHint"></p>
      </div>
      <div class="cvResult" id="cvResult" style="display:none">
        <div class="cvCard">
          <img class="cvStamp" id="cvStamp" alt="" hidden>
          <span class="cvEm" id="cvResEm">👍</span>
          <b id="cvResTitle">Good game!</b>
          <p id="cvResTxt"></p>
          <button class="big" id="cvResOk">OK</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    S.el = el;
    $('cvYes').onclick = () => { hideInvite(); beginActive(); };
    $('cvNo').onclick = () => { hideInvite(); S.retryAt = performance.now() / 1000 + 60; toastLater(); };
    $('cvResOk').onclick = () => { $('cvResult').style.display = 'none'; };
    // Beans: accept when tap lands inside trigger_radius_uv × ring width of center
    const ring = $('cvInvRing');
    if (ring) {
      ring.style.cursor = 'pointer';
      ring.title = 'Step in to play';
      ring.onclick = (ev) => {
        if (inviteRingAccepts(ev.clientX, ev.clientY, ring)) { hideInvite(); beginActive(); }
      };
    }
    return el;
  }
  function $(id) { return document.getElementById(id); }
  function toastLater() { ctx.toast?.("They'll invite you again in a minute 👍", 2200); }

  function hideInvite() { const e = $('cvInvite'); if (e) e.style.display = 'none'; S.inviteReady = false; }

  S.resetRound = () => {
    S.active = null; S.inviteReady = false; S.inviteAt = 0; S.retryAt = 0;
    if (S.el) {
      hideInvite();
      const p = $('cvPlay'); if (p) p.style.display = 'none';
      const r = $('cvResult'); if (r) r.style.display = 'none';
    }
  };

  S.maybeInvite = (patchDef, heal, relaxed) => {
    if (!patchDef || !patchDef.contest || patchDef.contest === 'festival') return;
    if (S.active || S.inviteReady) return;
    const now = performance.now() / 1000;
    if (now < S.retryAt) return;
    // invite once heal ≥ 25% (neighbor camping done quiet phase)
    if (heal < 0.25) return;
    const st = ctx.valley?.get(patchDef.id);
    if (st?.contestDone) return;
    ensureUi();
    const def = CONTEST_DEFS[patchDef.contest];
    if (!def) return;
    S.inviteReady = true;
    S.pending = { type: patchDef.contest, patchId: patchDef.id, neighbor: patchDef.neighbor, relaxed: !!relaxed };
    const sp = SPECIES[patchDef.neighbor];
    $('cvInvEm').textContent = def.emoji;
    $('cvInvTitle').textContent = `${sp?.emoji || '🐾'} ${def.name}?`;
    $('cvInvTxt').textContent = `${sp?.name || 'Neighbors'} invite you to a friendly ${def.name}!`;
    $('cvInvite').style.display = 'flex';
    ctx.audio?.sample?.('contest/invite-chime', 0.5);
  };

  function beginActive() {
    const p = S.pending; if (!p) return;
    const def = CONTEST_DEFS[p.type];
    const span = def.seconds || [30, 45];
    const maxT = p.relaxed ? span[1] * 1.15 : (span[0] + span[1]) / 2;
    S.active = {
      type: p.type, patchId: p.patchId, neighbor: p.neighbor, relaxed: p.relaxed,
      t: 0, maxT, score: 0, need: 1, hits: 0, misses: 0, seq: [], seqI: 0, placed: 0, leg: 0,
    };
    ensureUi();
    $('cvPlay').style.display = 'block';
    $('cvName').textContent = `${def.emoji} ${def.name}`;
    $('cvHint').textContent = '';
    if (p.type === 'dance_off') setupDance(S.active, p.relaxed);
    else if (p.type === 'pollen_relay') setupRelay(S.active);
    else if (p.type === 'decorating') setupDecor(S.active);
    updatePlayHud();
  }

  function setupDance(A, relaxed) {
    A.need = 8;
    A.seq = [];
    for (let i = 0; i < A.need + 2; i++) A.seq.push(DANCE_MOVES[Math.floor(Math.random() * DANCE_MOVES.length)]);
    A.seqI = 0;
    A.neighborTarget = (CONTEST_DEFS.dance_off.neighborScore || 0.7) + (relaxed ? -0.15 : 0);
    renderDance();
  }
  function renderDance() {
    const A = S.active; if (!A) return;
    const prompt = A.seq[A.seqI];
    const body = $('cvBody');
    body.innerHTML = `<div class="cvPrompt">${prompt ? prompt.icon : '✨'}</div><div class="cvMoves" id="cvMoves"></div>`;
    const row = $('cvMoves');
    for (const m of DANCE_MOVES) {
      const b = document.createElement('button');
      b.className = 'cvMove'; b.textContent = m.icon + ' ' + m.name;
      b.onclick = () => danceTap(m.id);
      row.appendChild(b);
    }
    $('cvHint').textContent = 'Match the move!';
  }
  function danceTap(id) {
    const A = S.active; if (!A || A.type !== 'dance_off') return;
    const want = A.seq[A.seqI];
    if (want && want.id === id) { A.hits++; A.score = A.hits / A.need; A.seqI++; ctx.audio?.blip?.(3); }
    else { A.misses++; ctx.audio?.sample?.('ui/error-bonk', 0.3); }
    if (A.seqI >= A.need) finish(A.score >= (A.neighborTarget || 0.7));
    else renderDance();
    updatePlayHud();
  }

  function setupRelay(A) {
    A.need = 3; A.leg = 0; A.score = 0;
    const crew = ctx.crew?.get() || ['bee', 'robin', 'bear'];
    A.legs = [
      { role: 'flyer', hint: 'Flyer leg — swap to a flyer!', ok: id => !!SPECIES[id]?.mv?.fly },
      { role: 'walker', hint: 'Walker leg — swap to a ground friend!', ok: id => !SPECIES[id]?.mv?.fly || id === 'robin' || id === 'bear' },
      { role: 'any', hint: 'Final leg — anyone!', ok: () => true },
    ];
    // prefer matching crew order
    A.legSp = crew.slice(0, 3);
    renderRelay();
  }
  function renderRelay() {
    const A = S.active; if (!A) return;
    const leg = A.legs[A.leg];
    $('cvBody').innerHTML = `<div class="cvPrompt">🌼</div><p>Drop pollen puff ${A.leg + 1} / 3</p><button class="big" id="cvDrop">Deliver puff</button>`;
    $('cvHint').textContent = leg.hint;
    $('cvDrop').onclick = () => {
      const cur = ctx.cur?.();
      if (!leg.ok(cur)) { ctx.toast?.('Swap crew for this leg!', 1800); ctx.audio?.sample?.('ui/error-bonk', 0.3); return; }
      A.leg++; A.hits++; A.score = A.hits / A.need;
      ctx.audio?.blip?.(4);
      if (A.leg >= 3) finish(true);
      else renderRelay();
      updatePlayHud();
    };
  }

  function setupDecor(A) {
    A.need = 5; A.placed = 0; A.score = 0;
    A.pieces = DECO.slice().sort(() => Math.random() - 0.5);
    renderDecor();
  }
  function renderDecor() {
    const A = S.active; if (!A) return;
    const left = A.pieces.filter(p => !p.done);
    $('cvBody').innerHTML = `<div class="cvPrompt">🎀</div><div class="cvMoves" id="cvMoves"></div>`;
    const row = $('cvMoves');
    for (const p of left) {
      const b = document.createElement('button');
      b.className = 'cvMove'; b.textContent = p.icon + ' ' + p.name;
      b.onclick = () => {
        p.done = true; A.placed++; A.hits++; A.score = A.placed / A.need;
        ctx.audio?.blip?.(2);
        if (A.placed >= A.need) finish(A.score >= (A.relaxed ? 0.55 : 0.7));
        else renderDecor();
        updatePlayHud();
      };
      row.appendChild(b);
    }
    $('cvHint').textContent = `Place cute props (${A.placed}/${A.need})`;
  }

  function updatePlayHud() {
    const A = S.active; if (!A) return;
    $('cvTimer').textContent = '⏱ ' + Math.max(0, Math.ceil(A.maxT - A.t));
    $('cvScore').textContent = `★ ${Math.round((A.score || 0) * 100)}%`;
  }

  function finish(won) {
    const A = S.active; if (!A) return;
    $('cvPlay').style.display = 'none';
    const def = CONTEST_DEFS[A.type];
    const nid = A.neighbor;
    ensureUi();
    const stamp = $('cvStamp');
    if (won) {
      ctx.valley?.markContest(A.patchId);
      ctx.valley?.addFriendship(nid, ctx.valley.friendship(nid) > 0 ? 0.5 : 1);
      ctx.onContestWin?.(0.10);
      if (ctx.round) {
        ctx.round.addRes('n', 4); ctx.round.addRes('f', 3);
      }
      if (stamp) { stamp.hidden = false; stamp.src = stampUrl(A.type); stamp.alt = def?.name || 'Win'; }
      $('cvResEm').textContent = '';
      $('cvResTitle').textContent = 'You win!';
      $('cvResTxt').textContent = `Friendship with ${SPECIES[nid]?.emoji || ''} ${SPECIES[nid]?.name || 'neighbors'} grew! + gift 🌼🪱`;
      ctx.audio?.sample?.('contest/win-jingle', 0.55);
    } else {
      if (stamp) { stamp.hidden = false; stamp.src = stampUrl('good_game'); stamp.alt = 'Good game!'; }
      $('cvResEm').textContent = '';
      $('cvResTitle').textContent = 'Good game!';
      $('cvResTxt').textContent = 'No star this time — try again in a minute.';
      S.retryAt = performance.now() / 1000 + 60;
      ctx.audio?.sample?.('contest/good-game', 0.45);
    }
    $('cvResult').style.display = 'flex';
    S.active = null; S.pending = null;
  }

  S.update = (dt, { playing, paused, heal, patchDef, relaxed }) => {
    if (!playing || paused) return;
    if (S.active) {
      S.active.t += dt;
      updatePlayHud();
      if (S.active.t >= S.active.maxT) finish(S.active.score >= 0.7 - (S.active.relaxed ? 0.15 : 0));
      return;
    }
    S.maybeInvite(patchDef, heal, relaxed);
  };

  S.forceInvite = (patchDef) => { S.retryAt = 0; S.maybeInvite(patchDef, 1, false); };

  return S;
}
