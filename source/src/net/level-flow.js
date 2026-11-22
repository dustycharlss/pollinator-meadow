/** N3 ready-wait, catchup badge, and host-only level-complete Continue. */
const BASE = import.meta.env.BASE_URL || './';
const ICON = (folder, name) => BASE + `ui/online/${folder}/${name}.png`;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function createLevelFlow(hooks = {}) {
  const root = el('div');
  root.id = 'olLevel';
  root.hidden = true;
  document.body.appendChild(root);

  const readyBox = el('div', 'olReady');
  readyBox.hidden = true;
  const bg = document.createElement('img');
  bg.className = 'olReadyBg';
  bg.src = ICON('ready', 'overlay');
  bg.alt = '';
  const card = el('div', 'olReadyCard');
  const msg = el('div', 'olReadyMsg');
  const roster = el('ul', 'olReadyRoster');
  const count = el('div', 'olReadyCount');
  count.hidden = true;
  const disc = document.createElement('img');
  disc.src = ICON('ready', 'count-disc');
  disc.alt = '';
  const num = el('b', '', '3');
  count.append(disc, num);
  card.append(msg, roster, count);
  readyBox.append(bg, card);

  const completeBox = el('div', 'olComplete');
  completeBox.hidden = true;
  const cCard = el('div', 'olCompleteCard');
  const cTitle = el('h2', '', 'Level cleared!');
  const cStars = el('p', 'olCompleteStars');
  const cWait = el('p', 'olCompleteWait');
  const cGo = el('button', 'olCompleteGo', 'Continue');
  cGo.type = 'button';
  cCard.append(cTitle, cStars, cWait, cGo);
  completeBox.append(cCard);

  const catchup = el('div', 'olCatchup');
  catchup.hidden = true;
  const cImg = document.createElement('img');
  cImg.src = ICON('catchup', 'badge');
  cImg.alt = '';
  const cTx = el('span', '', 'Catching up…');
  catchup.append(cImg, cTx);

  root.append(readyBox, completeBox, catchup);

  let loopEl = null, onContinue = null, lastMap = null;

  function sfx(name, vol = 0.5) {
    try { hooks.audio?.sample?.('online/n3n4/' + name, vol); } catch (e) {}
  }
  function speak(id) {
    try { hooks.audio?.speak?.(id); } catch (e) {}
  }
  function showRoot() { root.hidden = false; }
  function hideIfIdle() {
    if (readyBox.hidden && completeBox.hidden && catchup.hidden) root.hidden = true;
  }

  function startLoop() {
    stopLoop();
    try { hooks.audio?.startLoop?.('online/n3n4/friend-loading-loop', 0.35); } catch (e) {}
  }
  function stopLoop() {
    try { hooks.audio?.stopLoop?.('online/n3n4/friend-loading-loop'); } catch (e) {}
    if (!loopEl) return;
    try { loopEl.pause(); loopEl.removeAttribute('src'); } catch (e) {}
    loopEl = null;
  }

  function showReady({ map, name, roster: people, phase } = {}) {
    lastMap = map || lastMap;
    showRoot();
    readyBox.hidden = false;
    completeBox.hidden = true;
    count.hidden = true;
    const label = name || map || 'the level';
    msg.textContent = 'Waiting for friends 🐝🦝🐻';
    if (phase !== 'countdown') speak('lobby.waitingFriends');
    roster.innerHTML = '';
    for (const p of people || []) {
      const li = el('li');
      const im = document.createElement('img');
      im.src = ICON('ready', p.ready ? 'check' : 'pending');
      im.alt = p.ready ? 'ready' : 'loading';
      li.append(im, el('span', '', p.label || p.em || ''));
      roster.append(li);
    }
    startLoop();
  }

  function updateRoster(people) {
    if (readyBox.hidden) return;
    roster.innerHTML = '';
    for (const p of people || []) {
      const li = el('li');
      const im = document.createElement('img');
      im.src = ICON('ready', p.ready ? 'check' : 'pending');
      im.alt = p.ready ? 'ready' : 'loading';
      li.append(im, el('span', '', p.label || p.em || ''));
      roster.append(li);
    }
  }

  function showCountdown(n, name, map) {
    lastMap = map || lastMap;
    showRoot();
    readyBox.hidden = false;
    count.hidden = false;
    num.textContent = String(n);
    const label = name || map || 'the level';
    msg.textContent = `Starting ${label} in ${n}…`;
    if (n === 3) {
      stopLoop();
      sfx('all-ready-chime', 0.55);
      if (map) speak('lobby.starting.' + map);
    } else {
      sfx('ready-tick', 0.45);
    }
  }

  function hideReady() {
    readyBox.hidden = true;
    count.hidden = true;
    stopLoop();
    hideIfIdle();
  }

  function showTimeout() {
    showRoot();
    readyBox.hidden = false;
    count.hidden = true;
    stopLoop();
    msg.textContent = "Couldn't load, try again";
    speak('lobby.loadTimeout');
  }

  function showComplete({ result, isHost, title, onContinue: fn } = {}) {
    showRoot();
    completeBox.hidden = false;
    readyBox.hidden = true;
    onContinue = fn || null;
    cTitle.textContent = title || (result?.name ? `${result.name} cleared!` : 'Level cleared!');
    const st = result?.stars || result || {};
    const n = result?.n != null ? result.n : (st.n != null ? st.n : 0);
    if (result?.noStars) cStars.textContent = '🏅 Trailhead badge!';
    else cStars.textContent = '⭐'.repeat(Math.max(0, n)) + '☆'.repeat(Math.max(0, 3 - n));
    cGo.hidden = !isHost;
    cWait.hidden = !!isHost;
    cWait.textContent = isHost ? '' : 'Waiting for the host…';
    if (isHost) speak('ui.vFree.continue');
  }

  function hideComplete() {
    completeBox.hidden = true;
    onContinue = null;
    hideIfIdle();
  }

  function showCatchup() {
    showRoot();
    catchup.hidden = false;
    cTx.textContent = 'Catching up…';
    speak('lobby.catchingUp');
  }
  function hideCatchup() {
    catchup.hidden = true;
    hideIfIdle();
  }

  cGo.onclick = () => {
    if (cGo.hidden) return;
    const fn = onContinue;
    hideComplete();
    if (fn) fn();
  };

  return {
    showReady, updateRoster, showCountdown, hideReady, showTimeout,
    showComplete, hideComplete, showCatchup, hideCatchup,
    tickSfx(kind) { sfx(kind === 'ready' ? 'ready-tick' : kind, 0.45); },
    el: root,
    get completeBtn() { return cGo; },
  };
}
