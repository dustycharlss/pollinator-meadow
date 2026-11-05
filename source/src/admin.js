// Admin / debug panel. Opened from the pause menu (🛠) or with ?admin=1 (floating ADM button).
// Built from a small spec so every control is a button / toggle / slider inside collapsible sections.
export function createAdmin(X) {
  const root = document.getElementById('admin'), btn = document.getElementById('admBtn'), fpsEl = document.getElementById('fps');
  const { round, terr, build, adm } = X;
  const live = [];                       // controls that need to re-read their value
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const sections = [];
  const sec = (title, open, items) => sections.push({ title, open, items });
  const B = (label, fn) => ({ k: 'b', label, fn });
  const T = (label, get, set) => ({ k: 't', label, get, set });
  const S = (label, min, max, step, get, set, fmt) => ({ k: 's', label, min, max, step, get, set, fmt: fmt || (v => v) });
  const F = text => ({ k: 'f', text });
  const SEL = (label, opts, go) => ({ k: 'sel', label, opts, go });
  const RES = { p: '🌼', d: '💧', s: '🌟' };

  sec('⏱ Round', true, [
    F(() => `Time left ${Math.floor(round.left / 60)}:${String(Math.floor(round.left % 60)).padStart(2, '0')} · score ${round.score()}`),
    B('+1 min', () => round.setLeft(round.left + 60)), B('−1 min', () => round.setLeft(round.left - 60)), B('Set 30 s', () => round.setLeft(30)),
    T('Pause timer', () => round.timerPaused, v => { round.timerPaused = v; }),
    T('Allow swap / possess (default off: locked to lead)', () => !!adm.allowSwap, v => { adm.allowSwap = v; }),
    T('∞ Free play (no timer, secret: hold top-left 5 s in the last 10 s or after time is up)', () => X.freePlay(), v => X.setFree(v)),
    B('⏹ End round now', () => X.endRound()), B('↻ Restart round', () => X.restartRound()),
  ]);
  sec('★ Score + resources', false, [
    B('+100 pts', () => round.add('admin', 100)), B('+1,000', () => round.add('admin', 1000)), B('+10,000', () => round.add('admin', 10000)),
    B('+100 each resource', () => { for (const k in RES) round.addRes(k, 100); }), B('Max resources', () => { for (const k in RES) round.addRes(k, 9999 - round.res[k]); }),
    ...Object.keys(RES).map(k => B(`+100 ${RES[k]}`, () => round.addRes(k, 100))), B('Zero resources', () => { for (const k in RES) round.addRes(k, -round.res[k]); }),
  ]);
  sec('🔨 Building', false, [
    B('Clear all builds', () => X.clearTerritory()),
    T('Instant build (free)', () => build.free, v => { build.free = v; }),
    B('🌻 Free beacon at my feet', () => X.freeAtFeet('outpost')), B('🌷 Free garden', () => X.freeAtFeet('garden')),
    B('🧺 Free larder', () => X.freeAtFeet('storage')), B('🌉 Free bridge', () => X.freeAtFeet('bridge')),
    B('🏡 Max all homes', () => X.maxHomes()),
    S('Player edge vs rivals', 0, 0.5, 0.05, () => adm.playerEdge, v => { adm.playerEdge = +v; }, v => Math.round((+v) * 100) + '%'),
    T('Rival reactions (startle / raid / dismantle responses)', () => adm.rivalReact !== false, v => { adm.rivalReact = v; }),
    T('🎮 Unlock all controls', () => !!(X.onb && X.save && X.save.onb && X.save.onb.cmd && X.save.onb.tech && X.save.onb.int), v => { if (!X.onb) return; v ? X.onb.unlockAll() : X.onb.relock(); }),
    B('↺ Reset tips', () => X.onb && X.onb.reset()),
    B('🎨 Unlock all looks', () => { if (!X.save || !X.looks) return; const L = X.save.looks; L.unlocked = { pal: ['default','honey','lilac','mint','berry','sunset','sky','midnight'], pat: ['none','stripes','spots','hearts'], emo: ['wave','hop','spin','toss'] }; X.persist?.(); X.looks.openPanel?.(); X.toast?.('🎨 All looks unlocked'); }),

    S('Garden output ×', 0.25, 8, 0.25, () => build.gardenMul, v => { build.gardenMul = v; }, v => '×' + v),
    S('Bloom / food respawn ×', 0.25, 8, 0.25, () => adm.respawn, v => { adm.respawn = v; }, v => '×' + v),
  ]);
  sec('🐾 Helpers', false, [
    F(() => X.helpers ? `${X.helpers.list.length} helpers · level ${X.helpers.lvl} · delivered ${round.stats.helperUnits || 0}` : ''),
    T('Hire free', () => !!(X.helpers && X.helpers.free), v => X.hireFree(v)),
    ...[['bee', '🐝'], ['butterfly', '🦋'], ['hummingbird', '🐦'], ['robin', '🐦‍⬛'], ['raccoon', '🦝'], ['opossum', '🐭'], ['bear', '🐻']].map(([s, e]) => B(`${e} Spawn ${s}`, () => X.spawnHelper(s))),
    S('Helper speed ×', 0.5, 4, 0.25, () => adm.helperSpeed, v => { adm.helperSpeed = v; }, v => '×' + v),
    B('🎓 Train helpers (free)', () => X.trainHelpers()), B('Remove all helpers', () => X.clearHelpers()),
    B('🚩 Free trail marker', () => X.freeAtFeet('marker')), B('📣 Toggle Command (legacy RTS stub)', () => X.toggleRts()),
  ]);
  if (X.tech) sec('🧬 Species + tech', false, [
    SEL('Lead species (this round)', () => X.speciesList(), i => X.setLead(i)),
    F(() => `Lead: ${X.leadText()} · ${X.tech.count()} tech researched`),
    B('🧬 Unlock all tech', () => X.tech.unlockAll()), T('Instant research', () => X.tech.instant, v => { X.tech.instant = v; }), T('Free research', () => X.tech.free, v => { X.tech.free = v; }),
    B('Reset tech', () => { X.tech.reset(); X.tech.onChange?.(); }), B('🧬 Open tech tree', () => { A.close(); X.openTech(); }),
    { k: 'h', html: () => X.statsTable() },
  ]);
  sec('🏃 Player', false, [
    S('Player speed ×', 0.5, 4, 0.1, () => adm.speed, v => { adm.speed = v; }, v => '×' + (+v).toFixed(1)),
    S('Game speed ×', 0.5, 3, 0.1, () => adm.game, v => { adm.game = v; }, v => '×' + (+v).toFixed(1)),
    T('Fly anywhere (hold Jump)', () => adm.fly, v => { adm.fly = v; }), T('Infinite stamina', () => adm.stam, v => { adm.stam = v; }),
    B('⌂ Teleport home', () => X.tpHome()), SEL('Teleport to puzzle', () => X.puzzleList(), i => X.tpPuzzle(i)),
    B('Fill carry bag', () => X.fillBag()),
  ]);
  sec('🛠 Gear + journal', false, [
    B('Max all gear', () => X.gear(true)), B('Reset gear', () => X.gear(false)), B('+500 gear bank', () => X.bank(500)),
    B('📖 Unlock all journal pages', () => X.unlockJournal()),
  ]);
  sec('🌦 World', false, [
    B('Next season', () => X.nextSeason()), T('Night', () => X.isNight(), v => X.setNight(v)),
    B('☀ Clear', () => X.weather.force('clear', 120)), B('🌫 Mist', () => X.weather.force('mist', 120)), B('🌧 Rain', () => X.weather.force('rain', 120)), B('❄ Snow', () => X.weather.force('snow', 120)),
  ]);
  sec('📈 Perf + debug', false, [
    T('FPS / draw stats', () => adm.showFps, v => { adm.showFps = v; fpsEl.style.display = v ? 'block' : 'none'; }),
    F(() => X.perfText().replace(/\n/g, ' · ')),
    B('Full reset save…', () => X.wipeSave()),
  ]);

  root.innerHTML = '';
  const head = el('h3', '', '🛠 Admin <button id="admX">✕</button>'); root.appendChild(head);
  head.querySelector('#admX').onclick = () => A.close();
  for (const s of sections) {
    const d = el('details'); if (s.open) d.open = true; d.appendChild(el('summary', '', s.title)); const body = el('div', 'ab'); d.appendChild(body);
    for (const it of s.items) {
      if (it.k === 'b') { const b = el('button', '', it.label); b.onclick = () => { it.fn(); A.refresh(); }; body.appendChild(b); }
      else if (it.k === 't') { const b = el('button', '', it.label); b.onclick = () => { it.set(!it.get()); A.refresh(); }; live.push(() => b.classList.toggle('on', !!it.get())); body.appendChild(b); }
      else if (it.k === 's') {
        const w = el('div', 'sl'), lab = el('span', '', ''), inp = el('input'); inp.type = 'range'; inp.min = it.min; inp.max = it.max; inp.step = it.step;
        const l = el('div', '', it.label); l.style.cssText = 'flex:0 0 100%;font-size:12px;opacity:.85'; body.appendChild(l);
        inp.oninput = () => { it.set(+inp.value); lab.textContent = it.fmt(+inp.value); }; w.append(inp, lab); body.appendChild(w);
        live.push(() => { if (document.activeElement !== inp) inp.value = it.get(); lab.textContent = it.fmt(+it.get()); });
      }
      else if (it.k === 'h') { const f = el('div', 'stt', ''); body.appendChild(f); live.push(() => { const h = it.html(); if (f.dataset.h !== h) { f.dataset.h = h; f.innerHTML = h; } }); }
      else if (it.k === 'f') { const f = el('div', 'ft', ''); body.appendChild(f); live.push(() => { f.textContent = typeof it.text === 'function' ? it.text() : it.text; }); }
      else if (it.k === 'sel') {
        const s2 = el('select'); s2.style.cssText = 'flex:1;padding:6px;border-radius:8px;background:#2a1a3a;color:#fff;border:1px solid #ff7ad9'; const go = el('button', '', 'Go');
        const fill = () => { const o = it.opts(); if (s2.options.length !== o.length) s2.innerHTML = o.map((n, i) => `<option value="${i}">${n}</option>`).join(''); };
        go.onclick = () => it.go(+s2.value); body.append(s2, go); live.push(fill);
      }
    }
    root.appendChild(d);
  }
  const A = {
    get isOpen() { return root.classList.contains('on'); },
    refresh() { for (const f of live) f(); },
    open() { root.classList.add('on'); A.refresh(); X.onToggle && X.onToggle(true); },
    close() { root.classList.remove('on'); X.onToggle && X.onToggle(false); },
    toggle() { A.isOpen ? A.close() : A.open(); },
    showButton(v) { btn.classList.toggle('show', v); },
    update(dt) { if (A.isOpen) { A.tk = (A.tk || 0) - dt; if (A.tk <= 0) { A.tk = 0.3; A.refresh(); } } if (adm.showFps) { A.fk = (A.fk || 0) - dt; if (A.fk <= 0) { A.fk = 0.5; fpsEl.textContent = X.perfText(); } } },
  };
  btn.onclick = () => A.toggle();
  return A;
}
