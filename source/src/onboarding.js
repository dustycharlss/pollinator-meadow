// Pip tips (Fern onboarding.json) — progressive unlocks + tip card.
const ADV = () => document.body.classList.contains('adv');
const BEATS_OLD = [
  { id: 'hello', pip: "Hi! I'm Pip. Let's grow a meadow!", relaxed: 'Hi friend! I’m Pip. No rush here!', portrait: 'hello', after: 4 },
  { id: 'move', pip: 'Walk or fly to the sparkly flowers!', portrait: 'hint', wait: 1 },
  { id: 'gather', pip: 'Tap Act near flowers to gather. Yum!', portrait: 'hint', need: 'gather' },
  { id: 'deliver', pip: "Bag's full? Take it home!", portrait: 'hint', need: 'full' },
  { id: 'delivered', pip: 'Hooray! Goodies buy buildings!', portrait: 'unlock', need: 'deliver' },
  { id: 'interact', pip: 'Your Workbench lives here at home!', portrait: 'unlock', unlock: 'int' },
  { id: 'build', pip: "Let's build your first building!", portrait: 'hint', need: 'canBuild' },
  { id: 'unlock_tech', pip: 'Ta-da! The Tech tree is open!', portrait: 'unlock', unlock: 'tech', need: 'built' },
  { id: 'hire', pip: 'Friends can help you gather!', portrait: 'hint', need: 'canHire' },
  { id: 'unlock_command', pip: 'Yay, a helper! Tap 📣 Command for orders!', portrait: 'unlock', unlock: 'cmd', need: 'hired' },
  { id: 'crew_swap', pip: 'Tap a crew portrait to swap friends instantly!', portrait: 'unlock', need: 'valleyIn' },
  { id: 'packup', pip: 'Heal 85%! Pack Up your buildings and leave the patch wild!', portrait: 'unlock', need: 'healReady', unlock: 'pack' },
  { id: 'done', pip: 'You did it! Go grow, little buddy!', portrait: 'unlock' },
];
// Adventure refocus: Pip only teaches moving, swapping and Interact (puzzle hints come from the level)
const BEATS_ADV = [
  { id: 'hello', pip: "Hi! I'm Pip. Let's explore the valley!", relaxed: 'Hi friend! I’m Pip. No rush here!', portrait: 'hello', after: 4 },
  { id: 'move', pip: 'Walk, jump or fly around — grab the Petals!', portrait: 'hint', wait: 1 },
  { id: 'crew_swap', pip: 'Tap a portrait to swap friends instantly!', portrait: 'unlock', need: 'valleyIn' },
  { id: 'interact', pip: 'See a badge over something? Tap 🤝 Interact next to it!', portrait: 'unlock', unlock: 'int', need: 'valleyIn' },
  { id: 'done', pip: 'You did it! Have fun, little buddy!', portrait: 'unlock' },
];
const BEATS = new Proxy([], { get: (t, k) => { const B = ADV() ? BEATS_ADV : BEATS_OLD; const v = B[k]; return typeof v === 'function' ? v.bind(B) : v; } });
const PORTRAIT = { hello: 'guide-happy-blocky.png', unlock: 'guide-cheering-blocky.png', hint: 'guide-thinking-blocky.png' };

export function createOnboarding(ctx) {
  const save = ctx.save;
  if (!save.onb) {
    // returning players skip tips
    const returning = ctx.hasBests?.() || Object.keys(save.journal || {}).length > 0;
    save.onb = returning
      ? { cmd: 1, tech: 1, int: 1, seen: [], done: true, skipped: false }
      : { cmd: 0, tech: 0, int: 0, seen: [], done: false, skipped: false };
  }
  const O = { beat: null, t: 0, shownAt: 0 };

  let card = document.getElementById('pipCard');
  if (!card) {
    card = document.createElement('div'); card.id = 'pipCard';
    card.style.cssText = 'position:fixed;left:50%;bottom:max(200px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;display:none;align-items:flex-end;gap:8px;max-width:min(340px,92vw);pointer-events:auto';
    card.innerHTML = `<img id="pipImg" width="64" height="64" alt="" style="image-rendering:pixelated;filter:drop-shadow(0 2px 0 #3b2614)"><div style="flex:1;background:#fff3d8;border:3px solid #3b2614;border-radius:16px;padding:10px 12px;color:#3b2614;font:800 14px/1.3 system-ui;box-shadow:0 3px 0 #3b2614"><div id="pipTxt"></div><div style="margin-top:6px;display:flex;gap:8px;justify-content:flex-end"><button id="pipSkip" style="font:800 11px system-ui;border:2px solid #3b2614;border-radius:10px;background:#ffe08a;padding:3px 8px;cursor:pointer">Skip tips</button><button id="pipOk" style="font:800 11px system-ui;border:2px solid #3b2614;border-radius:10px;background:#b8f0a8;padding:3px 8px;cursor:pointer">OK</button></div></div>`;
    document.body.appendChild(card);
    card.querySelector('#pipSkip').onclick = () => O.skip();
    card.querySelector('#pipOk').onclick = () => O.dismiss();
  }

  function applyLocks() {
    const onb = save.onb;
    document.body.classList.toggle('onbCmd', !onb.cmd);
    document.body.classList.toggle('onbTech', !onb.tech);
    document.body.classList.toggle('onbInt', !onb.int && !ADV());
    const rts = document.getElementById('bRts'); if (rts) rts.style.display = onb.cmd ? '' : 'none';
    const bi = document.getElementById('bInt'); if (bi) bi.style.display = (onb.int || ADV()) ? '' : 'none';
  }

  function showBeat(b) {
    O.beat = b; O.shownAt = performance.now() / 1000;
    const relaxed = ctx.round?.()?.mode === 'relaxed';
    card.style.display = 'flex';
    card.querySelector('#pipTxt').textContent = relaxed && b.relaxed ? b.relaxed : b.pip;
    card.querySelector('#pipImg').src = `./ui/portraits/${PORTRAIT[b.portrait] || PORTRAIT.hello}`;
    if (b.id === 'hello') ctx.audio?.sample?.('ui2/toad-ribbit-hello', 0.5);
    if (b.unlock) ctx.audio?.sample?.('ui2/control-unlock-tada', 0.45);
    applyLocks();
  }
  function hide() { card.style.display = 'none'; O.beat = null; }

  O.dismiss = () => {
    if (!O.beat) return;
    const b = O.beat;
    if (!save.onb.seen.includes(b.id)) save.onb.seen.push(b.id);
    if (b.unlock === 'int') save.onb.int = 1;
    if (b.unlock === 'tech') save.onb.tech = 1;
    if (b.unlock === 'cmd') save.onb.cmd = 1;
    if (b.id === 'done') save.onb.done = true;
    ctx.persist?.(); applyLocks(); hide();
  };
  O.skip = () => {
    Object.assign(save.onb, { cmd: 1, tech: 1, int: 1, done: true, skipped: true });
    ctx.persist?.(); applyLocks(); hide();
    ctx.toast?.('⏭️ Tips skipped. All controls unlocked!', 2500);
    ctx.audio?.sample?.('ui2/control-unlock-tada', 0.4);
  };
  O.unlockAll = () => { save.onb.before = { ...save.onb }; Object.assign(save.onb, { cmd: 1, tech: 1, int: 1, done: true }); applyLocks(); hide(); ctx.persist?.(); };
  O.relock = () => { if (save.onb.before) Object.assign(save.onb, save.onb.before); applyLocks(); ctx.persist?.(); };
  O.reset = () => { save.onb = { cmd: 0, tech: 0, int: 0, seen: [], done: false, skipped: false }; applyLocks(); ctx.persist?.(); };

  O.startRound = () => {
    applyLocks();
    if (save.onb.done) return;
    const hello = BEATS.find(b => b.id === 'hello');
    if (!save.onb.seen.includes('hello')) showBeat(hello);
  };

  O.flags = { gathered: 0, delivered: 0, built: 0, hired: 0, moved: 0 };

  O.note = (ev) => { O.flags[ev] = (O.flags[ev] || 0) + 1; };

  O.update = (dt, st) => {
    applyLocks();
    if (save.onb.done) return;
    const now = performance.now() / 1000;
    if (O.beat) {
      const b = O.beat;
      const relaxed = ctx.round?.()?.mode === 'relaxed';
      if (!relaxed && b.after && now - O.shownAt >= b.after) O.dismiss();
      return;
    }
    // pick next unseen beat whose need is met
    for (const b of BEATS) {
      if (save.onb.seen.includes(b.id)) continue;
      if (b.need === 'gather' && !O.flags.gathered) continue;
      if (b.need === 'full' && !O.flags.full) continue;
      if (b.need === 'deliver' && !O.flags.delivered) continue;
      if (b.need === 'canBuild' && !O.flags.delivered) continue;
      if (b.need === 'built' && !O.flags.built) continue;
      if (b.need === 'canHire' && !(O.flags.built && save.onb.tech)) continue;
      if (b.need === 'hired' && !O.flags.hired) continue;
      if (b.need === 'valleyIn' && !O.flags.valleyIn) continue;
      if (b.need === 'healReady' && !O.flags.healReady) continue;
      if (b.id === 'move' && !save.onb.seen.includes('hello')) continue;
      if (b.id === 'move' && O.flags.moved < 1 && now - (O._helloAt || now) < 1) continue;
      if (b.id === 'interact' && !O.flags.delivered) continue;
      if (b.id === 'unlock_overview' && !save.onb.cmd) continue;
      if (b.id === 'done' && !save.onb.cmd) continue;
      if (b.unlock === 'tech' && !O.flags.built) continue;
      if (b.unlock === 'cmd' && !O.flags.hired) continue;
      showBeat(b);
      if (b.id === 'hello') O._helloAt = now;
      break;
    }
  };

  applyLocks();
  return O;
}
