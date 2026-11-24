/** N2 lobby: host/join, picture codes, secret PIN, approval, class pick, emotes.
 *  Transport is Trystero (public Nostr signalling + public STUN) under ?online=dev.
 *  No methods named host/join
 *  are hung on g.net (n1.mjs would then take the isolated-context path).
 */
import { createTrysteroTransport } from './trystero.js';
import { installSlowLinkHint } from './slow-link-hint.js';
import { createSignalRoomTransport } from './signalroom.js';
import { createChannel } from './channel.js';
import {
  TABS, EMOJI, PIN_WORDS, parseCode, formatCode, formatSpoken, randomCode, randomPin,
  pinIndices, suggestWords, roomChannelId, shareLink, tabOf, isWord,
} from './words.js';
import { pinReply, randomNonce, bytesToB64, b64ToBytes, timingSafeEqual, createPinGuard } from './pin.js';
import { EMOTES, EMOTE_COOLDOWN, EMOTE_SHOW, emoteOf } from './emotes.js';
import { isOnlineDev, canShowFriendsStation, parseJoinCode, onlineDefaults, stripRoomParamsFromUrl } from './flags.js';
import { createOnlineSettings } from './online-settings.js';
import { mountDebugOverlay } from './debug-overlay.js';

const BASE = import.meta.env.BASE_URL;
const ICON = (folder, name) => BASE + `ui/online/${folder}/${name}.png`;
const WORD_ICON = w => ICON('words', w);
const MAX_PLAYERS = 3;
const MIN_PLAYERS = 2; // host can Start once this many people are in the room
const CLASSES = [
  { id: 'bruiser', em: '🐻', label: 'Bruiser' },
  { id: 'trickster', em: '🦝', label: 'Trickster' },
  { id: 'scout', em: '🐝', label: 'Scout' },
];
const PLAYER_STYLE = [
  { id: 'p1', fill: '#ffd23f', shape: 'circle-star', tag: 'tag-p1' },
  { id: 'p2', fill: '#6db4d6', shape: 'square-chevron', tag: 'tag-p2' },
  { id: 'p3', fill: '#d45890', shape: 'hex-dots', tag: 'tag-p3' },
];
export const ANIMAL_OF = { bruiser: 'bear', trickster: 'raccoon', scout: 'bee' };
const BADGE_TAB = { animals: 'animals', food: 'food-plants', outside: 'outside', home: 'home-toys' };
const PICKS = (name) => ICON('picks', name);

function peerId() {
  try {
    let id = sessionStorage.getItem('pm-n2-peer');
    if (!id) { id = 'p-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('pm-n2-peer', id); }
    return id;
  } catch (e) { return 'p-' + Math.random().toString(36).slice(2, 10); }
}

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

export function createLobby(hooks = {}) {
  const me = peerId();
  const settingsApi = createOnlineSettings({
    getSettings: hooks.getSettings,
    saveSettings: hooks.saveSettings,
    onChange: (online) => {
      hooks.onOnlineSettings?.(online);
      syncTitleButton();
      if (!online.allow) leave('allow-off');
    },
    audio: hooks.audio,
  });
  let root = null, bar = null, screen = 'closed';
  let transport = null, channel = null;
  installSlowLinkHint({
    getLink: () => {
      try { return hooks.getNet?.()?.link || transport?.getLink?.() || null; } catch (e) { return null; }
    },
  });
  let role = null, code = null, pinWords = null, usePin = false, locked = false;
  let players = [];
  let pick = [];
  let tab = 0, focusRC = [0, 0], typeOpen = false;
  let pinGuard = createPinGuard();
  let pinNonce = null, pinHostId = '';
  let pendingAsk = null, askQueue = [];
  let lastEmoteAt = 0;
  let wakeLock = null, wakeState = 'off';
  mountDebugOverlay({
    measureTile: () => document.querySelector('.olTile')?.getBoundingClientRect?.().width || 0,
    getWake: () => wakeState,
    getPath: () => pathInfo(),
    getNet: () => hooks.getNet?.() || null,
    getIce: () => { try { return transport?.getIcePair?.() || hooks.getNet?.()?.link?.ice || null; } catch (e) { return null; } },
  });
  let lobbyMusic = false;
  let helloTimer = null, helloOff = null, findTimer = null;
  let pinHint = '';
  let statusBanner = '';
  let copiedOn = false;
  let copiedT = 0;
  let copiedEl = null;


  function audio() { return hooks.audio; }
  function sfx(name, vol = 0.5) { try { audio()?.sample?.('online/' + name, vol); } catch (e) {} }
  const PIN_TAPS = ['pin-tap', 'sfx-n2/pin-tap-b', 'sfx-n2/pin-tap-c', 'sfx-n2/pin-tap-d'];
  function pinTapSfx() { sfx(PIN_TAPS[(Math.random() * PIN_TAPS.length) | 0], 0.35); }
  const ASK_LOOP = 'online/sfx-n2/asking-host-loop';
  function startAskingLoop() { try { audio()?.startLoop?.(ASK_LOOP, 0.4); } catch (e) {} }
  function stopAskingLoop() { try { audio()?.stopLoop?.(ASK_LOOP); } catch (e) {} }
  function toast(s, ms) { hooks.toast?.(s, ms); }
  function speak(id) { try { hooks.audio?.speak?.(id); } catch (e) {} }
  function ensureCopiedEl() {
    if (copiedEl) return copiedEl;
    copiedEl = document.createElement('div');
    copiedEl.id = 'olCopiedFloat';
    copiedEl.className = 'olCopied';
    copiedEl.hidden = true;
    copiedEl.textContent = 'Copied!';
    document.body.appendChild(copiedEl);
    return copiedEl;
  }
  function showCopied() {
    const n = ensureCopiedEl();
    n.hidden = false;
    n.textContent = 'Copied!';
    copiedOn = true;
    clearTimeout(copiedT);
    copiedT = setTimeout(() => { copiedOn = false; n.hidden = true; if (root && !root.hidden) render(); }, 2400);
    if (root && !root.hidden) render();
    sfx('sfx-n2/copied-pop', 0.5);
  }
  const SCREEN_VOICE = {
    choice: 'lobby.btn-play-friends',
    join: 'lobby.join.title',
    host: 'lobby.host.title',
    asking: 'lobby.asking',
    full: 'lobby.full',
    denied: 'lobby.denied',
    'pin-enter': 'lobby.pin.prompt',
    approve: 'lobby.approve-card',
  };
  function pathInfo() {
    const t = transport;
    return {
      path: (t?.getLink?.()?.path) || t?.kind || (t?.stub ? 'local' : 'trystero'),
      detail: t?.note || 'Trystero public signalling (Nostr) + public STUN, no TURN. Cloudflare SignalRoom / TURN not configured.',
      policy: t?.icePolicy || 'all',
      link: (typeof t?.getLink === 'function') ? t.getLink() : null,
      iceFail: !!t?.iceFail,
      wake: wakeState,
      relays: typeof t?.getRelaySockets === 'function' ? Object.keys(t.getRelaySockets() || {}).length : 0,
    };
  }

  function stopFind() {
    if (findTimer) { clearTimeout(findTimer); findTimer = null; }
  }
  function stopHello() {
    if (helloTimer) { clearInterval(helloTimer); helloTimer = null; }
    try { helloOff?.(); } catch (e) {}
    helloOff = null;
    stopFind();
  }

  async function requestWake() {
    wakeState = 'unsupported';
    try {
      if (!navigator.wakeLock?.request) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeState = 'held';
      wakeLock.addEventListener('release', () => { if (wakeState === 'held') wakeState = 'released'; });
    } catch (e) { wakeState = 'denied'; }
  }
  function releaseWake() {
    try { wakeLock?.release?.(); } catch (e) {}
    wakeLock = null;
    if (wakeState === 'held') wakeState = 'off';
  }

  function allowed() {
    return canShowFriendsStation(hooks.getSettings?.() || {});
  }

  function closeUi() {
    const staying = !!role;
    if (root) root.hidden = true;
    screen = 'closed';
    stopAskingLoop();
    if (lobbyMusic && audio()?.music?.current === 'lobby') audio().music.mood(hooks.hubMood?.() || 'hub');
    lobbyMusic = false;
    if (staying) sfx('sfx-n2/room-start-whoosh', 0.55);
  }

  function openRoot() {
    if (!root) buildRoot();
    root.hidden = false;
  }

  function playLobbyMusic() {
    try { audio()?.music?.mood?.('lobby'); lobbyMusic = true; } catch (e) {}
  }

  function send(type, extra = {}) {
    try { channel?.send({ ch: 'lobby', data: { type, from: me, ...extra } }); } catch (e) {}
  }

  function attachRoom(words) {
    detach();
    code = words;
    const room = roomChannelId(words);
    // Public builds must use Cloudflare SignalRoom only — never Nostr / Trystero,
    // even if the Worker is not set up yet (no public-relay fallback).
    transport = isOnlineDev()
      ? createTrysteroTransport({
          room,
          password: formatCode(words, '-') + ':pollinator-meadow',
          appId: 'dustycharlss.github.io/pollinator-meadow',
          // One extra signalling seat so a 4th friend can receive "Room is full"
          // (Trystero maxUsers otherwise rejects them before hello arrives).
          maxUsers: MAX_PLAYERS + 1,
        })
      : createSignalRoomTransport({ room });
    channel = createChannel(transport);
    channel.onMessage(msg => {
      if (!msg || msg.ch !== 'lobby') return;
      onMsg(msg.data || msg);
    });
    transport.onError?.((err) => {
      if (err && err.code === 'room-full' && role !== 'host') {
        stopFind();
        stopHello();
        toast('Room is full', 3200); speak('lobby.full');
        statusBanner = 'Room is full'; showScreen('full');
        sfx('sfx-n2/room-full', 0.5);
        render();
      }
    });
    hooks.onRoomReady?.({ role, room, code: formatCode(words, '-'), transport, channel });
  }

  function detach() {
    try { channel = null; transport?.close?.(); } catch (e) {}
    transport = null;
  }

  function takenClasses() { return new Set(players.map(p => p.cls).filter(Boolean)); }

  function lobbyState() {
    return {
      type: 'state',
      code: formatCode(code || [], '-'),
      locked, usePin, players: players.map(p => ({ ...p })),
    };
  }

  function broadcastState() { if (role === 'host') send('state', lobbyState()); }

  function onMsg(d) {
    if (!d || d.from === me) return;
    const typ = d.type;
    if (role === 'host') {
      if (typ === 'hello') {
        onHello(d.from);
        return;
      }
      if (typ === 'pin-reply' && pendingAsk && pendingAsk.peer === d.from) {
        const lock = pinGuard.lockedFor(d.from);
        if (lock.room || lock.ms > 0) {
          send('pin-result', { to: d.from, ok: false, lockMs: lock.ms, room: lock.room });
          return;
        }
        handlePinReply(d);
        return;
      }
      if (typ === 'leave') {
        players = players.filter(p => p.id !== d.from);
        broadcastState();
        render();
        return;
      }
      if (typ === 'pick-class') {
        const pl = players.find(p => p.id === d.from);
        if (pl && !takenClasses().has(d.cls)) { pl.cls = d.cls; if (d.skin) pl.skin = d.skin; broadcastState(); render(); }
        return;
      }
    }
    if (d.to && d.to !== me) return;
    if (typ === 'full') { stopFind(); stopHello(); toast('Room is full', 3200); speak('lobby.full'); statusBanner = 'Room is full'; showScreen('full'); sfx('sfx-n2/room-full', 0.5); render(); return; }
    if (typ === 'locked') { stopFind(); stopHello(); toast('This room is locked', 2600); showScreen('choice'); return; }
    if (typ === 'deny') { stopFind(); stopHello(); toast('The host said not now', 2800); speak('lobby.denied'); statusBanner = 'The host said not now'; showScreen('denied'); sfx('sfx-n2/host-said-not-now', 0.5); render(); return; }
    if (typ === 'pin-nonce') { stopFind(); pinNonce = b64ToBytes(d.nonce); pinHostId = d.hostPeer || d.from || ''; pick = []; pinHint = ''; showScreen('pin-enter'); render(); return; }
    if (typ === 'pin-result') {
      if (d.ok) { stopFind(); statusBanner = 'Asking the host…'; showScreen('asking'); render(); return; }
      if (d.room) { toast('This room is locked for a bit', 2600); showScreen('choice'); return; }
      showScreen('pin-enter');
      shakePin(d.lockMs || 0);
      return;
    }
    if (typ === 'approve' || typ === 'state') {
      if (typ === 'approve' && role !== 'host') {
        stopHello();
        role = 'client';
        sfx('joined', 0.55);
      }
      if (d.players) players = d.players;
      if (d.usePin != null) usePin = d.usePin;
      if (d.locked != null) locked = d.locked;
      ensureSelf();
      showScreen('room');
      render();
      return;
    }
    if (typ === 'start' && role === 'client') { goPlay(); return; }
    if (typ === 'emote' && d.emote) hooks.onEmote?.(d.from, d.emote);
    if (typ === 'pin-room-lock') { stopFind(); stopHello(); toast('Someone keeps guessing the PIN. Try a new code.', 3000); speak('lobby.pin.guessing'); showScreen('choice'); }
    if (typ === 'host-left' || typ === 'ended') {
      toast("The host's game ended. Back to your Meadow 🌼", 3200); speak('lobby.hostLeft');
      leave('host-left');
    }
  }

  async function handlePinReply(d) {
    try {
      const reply = b64ToBytes(d.mac);
      const expect = await pinReply(pinIndices(pinWords), formatCode(code, '-'), pinNonce, me, d.from);
      if (!timingSafeEqual(reply, expect)) {
        const r = pinGuard.recordFail(d.from);
        send('pin-result', { to: d.from, ok: false, lockMs: r.lockMs, room: r.roomLocked });
        if (r.roomLocked) toast('Someone keeps guessing your PIN. Make a new code? 🔄', 4000); speak('lobby.pin.guessing');
        return;
      }
      pinGuard.recordPass(d.from);
      send('pin-result', { to: d.from, ok: true });
      pendingAsk = { peer: d.from };
      showApprove(d.from);
      sfx('join-request-knock', 0.55);
    } catch (e) {
      send('pin-result', { to: d.from, ok: false, lockMs: 0 });
    }
  }

  function ensureSelf() {
    if (!players.some(p => p.id === me)) {
      const style = PLAYER_STYLE[Math.min(PLAYER_STYLE.length - 1, players.length)];
      players.push({ id: me, cls: role === 'host' ? 'bruiser' : null, style: style.id, fill: style.fill, shape: style.shape });
    }
  }

  function reservedSlots() {
    return players.length + (pendingAsk ? 1 : 0) + askQueue.length;
  }

  function onHello(from) {
    if (locked) { send('locked', { to: from }); return; }
    if (players.some(p => p.id === from) || (pendingAsk && pendingAsk.peer === from) || askQueue.includes(from)) return;
    if (reservedSlots() >= MAX_PLAYERS) { send('full', { to: from }); return; }
    if (pinGuard.roomLocked()) { send('pin-room-lock', { to: from }); return; }
    if (pendingAsk) { askQueue.push(from); return; }
    if (usePin && pinWords) {
      pendingAsk = { peer: from };
      pinNonce = randomNonce();
      send('pin-nonce', { to: from, nonce: bytesToB64(pinNonce), hostPeer: me });
      return;
    }
    showApprove(from);
    sfx('join-request-knock', 0.55);
  }

  function nextAsk() {
    const from = askQueue.shift();
    if (from) onHello(from);
  }

  function showApprove(peer) {
    pendingAsk = { peer };
    showScreen('approve');
    render();
  }

  function approve(yes = true) {
    if (role !== 'host' || !pendingAsk) return;
    const peer = pendingAsk.peer;
    if (!yes) { send('deny', { to: peer }); pendingAsk = null; showScreen('host'); render(); nextAsk(); return; }
    if (players.length >= MAX_PLAYERS) { send('full', { to: peer }); pendingAsk = null; nextAsk(); return; }
    const style = PLAYER_STYLE[players.length] || PLAYER_STYLE[2];
    players.push({ id: peer, cls: null, style: style.id, fill: style.fill, shape: style.shape });
    send('approve', lobbyState());
    broadcastState();
    sfx('host-approves', 0.55);
    pendingAsk = null;
    showScreen('host');
    render();
    nextAsk();
  }

  function setPin(words) {
    if (role !== 'host') return false;
    if (!words) { usePin = false; pinWords = null; }
    else {
      const list = Array.isArray(words) ? words.map(w => String(w).toLowerCase()) : String(words).toLowerCase().split(/[-·,+\s]+/).filter(Boolean);
      if (list.length !== 4 || list.some(w => !PIN_WORDS.includes(w))) return false;
      usePin = true;
      pinWords = list;
    }
    pinGuard.resetRoom();
    broadcastState();
    render();
    return true;
  }

  function lockRoom(v) {
    if (role !== 'host') return;
    locked = v == null ? !locked : !!v;
    broadcastState();
    render();
  }

  function syncTitleButton() {
    if (typeof document === 'undefined') return;
    let b = document.getElementById('playWithFriends');
    if (!b) {
      const menu = document.querySelector('#title .menu') || document.getElementById('title');
      if (!menu) return;
      b = document.createElement('button');
      b.id = 'playWithFriends';
      b.className = 'olPlayFriends';
      b.type = 'button';
      b.textContent = 'Play with friends';
      b.addEventListener('click', () => { sfx('sfx-n2/play-friends-tap', 0.5); openChoice(); });
      const trow = document.querySelector('#title .trow');
      if (trow && trow.parentNode) trow.parentNode.insertBefore(b, trow);
      else menu.appendChild(b);
    }
    const on = allowed();
    b.hidden = !on;
    b.style.display = on ? '' : 'none';
  }

  function startHosting() {
    if (!allowed()) { showOffline(); return; }
    role = 'host';
    code = randomCode();
    pinWords = null;
    usePin = false;
    locked = false;
    pinGuard.resetRoom();
    pinHostId = me;
    players = [];
    pendingAsk = null;
    askQueue = [];
    ensureSelf();
    attachRoom(code);
    sfx('room-created', 0.55);
    playLobbyMusic();
    requestWake();
    showScreen('host');
    render();
  }

  function beginJoin(words) {
    if (!allowed()) { showOffline(); return; }
    const parsed = Array.isArray(words) ? words : parseCode(words);
    if (!parsed) { toast('Not a known code. Check the four pictures.', 2400); return; }
    role = 'client';
    stopHello();
    attachRoom(parsed);
    playLobbyMusic();
    statusBanner = 'Asking the host…';
    showScreen('asking');
    render();
    const tryHello = () => { if (screen === 'asking') send('hello', { want: 'join' }); };
    tryHello();
    helloOff = transport?.onPeerJoin?.(tryHello) || null;
    helloTimer = setInterval(tryHello, 1000);
    findTimer = setTimeout(() => {
      findTimer = null;
      stopHello();
      if (screen === 'asking') { toast("Couldn't find that game. Check the code.", 3000); speak('lobby.failed.title'); showScreen('join'); render(); }
    }, 15000);
  }

  function startPlay() {
    if (role !== 'host') return;
    if (players.length < MIN_PLAYERS) {
      toast('Waiting for a friend', 2200);
      return;
    }
    send('start', { from: 'host' });
    goPlay();
  }
  function goPlay() {
    closeUi();
    if (bar) bar.hidden = false;
    try { hooks.onStartPlay?.({ role, players: players.slice() }); } catch (e) {}
  }

  function leave(why) {
    if (why === 'lobby' || why === 'pause') sfx('sfx-n2/leave-game', 0.5);
    try { stripRoomParamsFromUrl(); } catch (e) {}
    stopHello();
    if (role) send('leave', { why });
    if (role === 'host') send('ended', { why });
    role = null; code = null; players = []; pick = [];
    detach();
    releaseWake();
    closeUi();
    if (bar) bar.hidden = true;
    hooks.onLeave?.(why);
  }

  function togglePin() {
    if (role !== 'host') return;
    if (!usePin) { usePin = true; pinWords = randomPin(); sfx('pin-tap', 0.4); }
    else { usePin = false; pinWords = null; }
    pinGuard.resetRoom();
    broadcastState();
    render();
  }

  function freshPin() { if (role === 'host' && usePin) { pinWords = randomPin(); render(); } }

  async function copyLink() {
    const url = shareLink(code, location.origin, location.pathname);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Play with friends', text: 'Join my Pollinator Meadow game', url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        // Fall through to the clipboard if share is unavailable or failed.
      }
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else throw new Error('no clipboard');
      toast('Copied!', 2400);
      showCopied();
    } catch (e) { toast(url, 4000); }
  }

  function sendEmote(id) {
    const now = performance.now() / 1000;
    if (now - lastEmoteAt < EMOTE_COOLDOWN) return;
    lastEmoteAt = now;
    const em = emoteOf(id);
    if (!em) return;
    send('emote', { emote: id });
    sfx(em.sfx, 0.5);
    hooks.onEmote?.(me, id);
  }

  // ---------- UI ----------
  function buildRoot() {
    root = el('div', 'olRoot');
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Play with friends');
    document.body.appendChild(root);
    bar = el('div', 'olBar');
    bar.hidden = true;
    EMOTES.forEach(e => {
      const b = el('button', 'olEm', e.em);
      b.type = 'button';
      b.title = e.text;
      b.setAttribute('aria-label', e.text);
      b.onclick = () => sendEmote(e.id);
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
    document.addEventListener('keydown', onKey);
  }

  function showScreen(name) {
    const changed = screen !== name;
    openRoot();
    screen = name;
    bar.hidden = !(name === 'room' || name === 'host');
    if (changed && SCREEN_VOICE[name]) speak(SCREEN_VOICE[name]);
    if (name === 'asking') startAskingLoop();
    else stopAskingLoop();
  }

  function imgBtn(src, label, fn, cls = 'olIco') {
    const b = el('button', cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.style.backgroundImage = `url(${src})`;
    b.onclick = fn;
    return b;
  }

  function render() {
    if (!root || root.hidden) return;
    root.innerHTML = '';
    const card = el('div', 'olCard');
    const head = el('div', 'olHead');
    const back = imgBtn(ICON('lobby', 'btn-back'), 'Back', () => {
      if (screen === 'choice') { if (role) { closeUi(); if (bar) bar.hidden = false; } else closeUi(); return; }
      if (screen === 'host' || screen === 'room') { closeUi(); if (bar) bar.hidden = false; return; }
      if (screen === 'join' || screen === 'asking' || screen === 'pin-enter' || screen === 'denied' || screen === 'full') { if (role) leave('back'); statusBanner = ''; showScreen('choice'); render(); return; }
      showScreen('choice'); render();
    });
    const title = el('h2');
    head.append(back, title);
    const body = el('div', 'olBody');
    card.append(head, body);
    root.append(card);
    if (statusBanner) {
      const ban = el('div', 'olBanner', statusBanner);
      ban.setAttribute('role', 'status');
      head.after(ban);
    }

    if (screen === 'choice') {
      title.textContent = 'Play with friends';
      const row = el('div', 'olChoiceRow');
      const mkChoice = (file, label, fn) => {
        const b = el('button', 'olChoiceCard');
        b.type = 'button';
        b.setAttribute('aria-label', label);
        const im = document.createElement('img');
        im.src = ICON('lobby', file); im.alt = '';
        b.append(im, el('span', '', label));
        b.onclick = fn;
        return b;
      };
      row.append(
        mkChoice('choice-host', 'Host a game', () => { sfx('sfx-n2/choice-host', 0.5); startHosting(); }),
        mkChoice('choice-join', 'Join a game', () => { sfx('sfx-n2/choice-join', 0.5); pick = []; tab = 0; statusBanner = ''; showScreen('join'); render(); }),
      );
      body.append(row);
      const fold = el('details', 'olHint');
      const foldBody = isOnlineDev()
        ? `Playing with friends online. Your child can play with up to 2 friends using a secret 4-picture code (and, if the host wants, a secret picture PIN) that only you share. There's no chat. Players can only tap friendly emoji buttons like 👋 and 🎉. There are no accounts, names, or ads, and we don't store anything about your child. This is a test connection through public signalling servers. It does not use Cloudflare until TURN is set up. Only share the code with people you know. The host can say no to anyone and can lock the room.`
        : `Playing with friends online. Your child can play with up to 2 friends using a secret 4-picture code (and, if the host wants, a secret picture PIN) that only you share. There's no chat. Players can only tap friendly emoji buttons like 👋 and 🎉. There are no accounts, names, or ads, and we don't store anything about your child. To connect the games, your device's internet address (IP) goes to Cloudflare, the connection service. Other players' devices never see it, unless a grown-up turns on <b>Direct mode</b> in Settings (off by default) on both devices. Only share the code with people you know. The host can say no to anyone and can lock the room. If the game can't reach Cloudflare's relay, it shows an error. It never switches to a direct connection on its own.`;
      fold.innerHTML = `<summary>For grown-ups</summary><p>${foldBody}</p>`;
      body.append(fold);
      return;
    }

    if (screen === 'join') {
      title.textContent = 'Join a game';
      renderPicker(body, { pin: false, onJoin: () => beginJoin(pick) });
      return;
    }

    if (screen === 'pin-enter') {
      title.textContent = 'This game has a secret PIN 🔐';
      if (pinHint) body.append(el('p', 'olHint', pinHint));
      renderPicker(body, {
        pin: true,
        onJoin: async () => {
          if (pick.length !== 4) return;
          sfx('pin-tap', 0.4);
          try {
            const mac = await pinReply(pinIndices(pick), formatCode(code, '-'), pinNonce, pinHostId, me);
            send('pin-reply', { mac: bytesToB64(mac) });
            // Stay on the PIN pad until pin-result so a wrong guess can shake
            // and show "Not quite! Ask your friend for the PIN 🙂".
          } catch (e) { toast('Could not send the PIN. Try again.', 2000); }
        },
      });
      return;
    }

    if (screen === 'asking' || screen === 'full' || screen === 'denied') {
      title.textContent = 'Join a game';
      if (screen === 'asking' && !statusBanner) statusBanner = 'Asking the host…';
      if (screen === 'full' && !statusBanner) statusBanner = 'Room is full';
      if (screen === 'denied' && !statusBanner) statusBanner = 'The host said not now';
      if (statusBanner && !root.querySelector('.olBanner')) {
        const ban = el('div', 'olBanner', statusBanner);
        ban.setAttribute('role', 'status');
        head.after(ban);
      }
      renderPicker(body, { pin: false, onJoin: () => beginJoin(pick) });
      return;
    }

    if (screen === 'approve') {
      title.textContent = 'Your room';
      const box = el('div', 'olApprove');
      box.innerHTML = `<p>🐾 A friend wants to join!</p>`;
      const row = el('div', 'olRow');
      const yes = el('button', 'olBtn', '✅ Let in');
      const no = el('button', 'olBtn sec', '❌ No');
      yes.onclick = () => approve(true);
      no.onclick = () => approve(false);
      row.append(yes, no);
      box.append(row);
      body.append(box);
      return;
    }

    if (screen === 'host' || screen === 'room') {
      title.textContent = role === 'host' ? 'Your room' : 'Friends';
      const left = el('div', 'olRoomCol');
      const right = el('div', 'olRoomCol');
      left.append(renderCodeWells(code || []));
      if (role === 'host') {
        const tools = el('div', 'olTools');
        tools.append(
          iconTool(ICON('lobby', 'btn-copy-link'), 'Copy link', copyLink),
          iconTool(ICON('lobby', locked ? 'btn-lock-on' : 'btn-lock-off'), locked ? 'Unlock' : 'Lock', () => { locked = !locked; broadcastState(); render(); }),
          iconTool(ICON('lobby', usePin ? 'btn-pin-on' : 'btn-pin-off'), usePin ? 'Secret PIN on' : 'Secret PIN', togglePin),
        );
        left.append(tools);
        if (usePin && pinWords) {
          left.append(el('p', 'olHint', 'Say the PIN out loud. It is not in the link.'));
          left.append(renderCodeWells(pinWords, { badges: false }));
          left.append(iconTool((import.meta.env.BASE_URL || './') + 'ui/online/pin/btn-reroll.png', 'New PIN', freshPin));
        }
        left.append(el('p', 'olHint', players.length < MIN_PLAYERS ? 'Waiting for friends' : 'Friends are in!'));
      }
      right.append(renderRoster());
      right.append(renderClassCards());
      if (copiedOn) right.append(el('div', 'olCopied', 'Copied!'));
      const actions = el('div', 'olRoomActions');
      if (role === 'host') {
        const go = el('button', 'olBtn olStart', 'Start');
        go.type = 'button';
        const ready = players.length >= MIN_PLAYERS;
        go.disabled = !ready;
        go.setAttribute('aria-disabled', ready ? 'false' : 'true');
        if (!ready) go.title = 'Waiting for a friend';
        go.onclick = () => startPlay();
        actions.append(go);
      }
      if (role) {
        const leaveBtn = el('button', 'olLeave', 'Leave game');
        leaveBtn.type = 'button';
        leaveBtn.onclick = () => leave('lobby');
        actions.append(leaveBtn);
      }
      if (actions.childNodes.length) right.append(actions);
      body.append(left, right);
      return;
    }
  }

  function iconTool(src, label, fn) {
    const b = el('button', 'olTool');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    const im = document.createElement('img');
    im.src = src; im.alt = '';
    b.append(im, el('span', '', label));
    b.onclick = fn;
    return b;
  }
  function renderCodeWells(words, { badges = true } = {}) {
    const row = el('div', 'olWells');
    (words || []).forEach(w => {
      const s = el('div', 'olWell');
      const im = document.createElement('img');
      im.src = WORD_ICON(w); im.alt = w;
      s.append(im);
      s.title = w;
      if (badges) {
        const tab = TABS[tabOf(w)];
        if (tab) {
          const badge = document.createElement('img');
          badge.className = 'olTabBadge';
          badge.src = ICON('lobby', 'badge-tab-' + (BADGE_TAB[tab.id] || tab.id));
          badge.alt = tab.label;
          s.append(badge);
        }
      }
      row.append(s);
    });
    return row;
  }

  function styleTag(style) {
    const tag = document.createElement('img');
    tag.className = 'olRosterTag';
    tag.src = ICON('players', PLAYER_STYLE.find(s => s.id === style)?.tag || ('tag-' + style));
    tag.alt = style;
    return tag;
  }
  function composeSeat(slot, im, style, cls) {
    // Glyph + colour tag so a seated player is never a blank well if a
    // baked slot-pN-animal (or taken-class) asset 404s.
    im.onerror = () => { im.onerror = null; im.src = ICON('lobby', 'slot-empty'); };
    im.src = ICON('lobby', 'slot-empty');
    im.alt = (cls ? `${style} ${cls}` : style + ' seated');
    slot.classList.add('composed');
    if (cls && !slot.querySelector('.olSlotGlyph')) {
      const glyph = document.createElement('img');
      glyph.className = 'olSlotGlyph';
      glyph.src = ICON('lobby', `class-${cls}`);
      glyph.alt = cls;
      glyph.onerror = () => { glyph.remove(); };
      slot.append(glyph);
    }
    if (!slot.querySelector('.olRosterTag')) slot.append(styleTag(style));
  }
  function renderRoster() {
    const row = el('div', 'olRoster');
    for (let i = 0; i < 3; i++) {
      const pl = players[i];
      const style = (pl && pl.style) || PLAYER_STYLE[i].id;
      const slot = el('button', 'olRosterSlot' + (pl && !pl.cls ? ' empty' : ''));
      slot.type = 'button';
      slot.style.setProperty('--ol-fill', (pl && pl.fill) || PLAYER_STYLE[i].fill);
      const im = document.createElement('img');
      im.className = 'olSlotFace';
      if (pl && pl.cls) {
        const animal = ANIMAL_OF[pl.cls] || 'bear';
        im.src = PICKS(`slot-${style}-${animal}`);
        im.alt = `${style} ${animal}`;
        im.onerror = () => composeSeat(slot, im, style, pl.cls);
        if (pl.id === me) slot.onclick = () => hooks.openSkinPick?.(pl.cls);
      } else if (pl) {
        // Seated but no class yet — colour + shape tag so the seat is visible.
        slot.append(im);
        composeSeat(slot, im, style, null);
        row.append(slot);
        continue;
      } else {
        im.src = ICON('lobby', 'slot-empty');
        im.alt = 'empty slot';
      }
      slot.append(im);
      row.append(slot);
    }
    return row;
  }

  function renderClassCards() {
    const cards = el('div', 'olCards');
    const mine = players.find(p => p.id === me);
    CLASSES.forEach(c => {
      const holder = players.find(p => p.cls === c.id);
      const b = el('button', 'olClass' + (holder ? ' taken ' + (holder.style || 'p1') : ''));
      b.type = 'button';
      const im = document.createElement('img');
      if (holder) {
        im.src = PICKS(`class-${c.id}-taken-${holder.style || 'p1'}`);
        im.alt = c.label;
        im.onerror = () => {
          im.onerror = () => { im.onerror = null; im.src = ICON('lobby', `class-${c.id}`); };
          im.src = ICON('lobby', `class-${c.id}-taken`);
        };
      } else {
        im.src = ICON('lobby', `class-${c.id}`);
        im.alt = c.label;
      }
      b.append(im, el('small', 'olClassLab', c.label));
      b.disabled = !!(holder && holder.id !== me);
      b.onclick = () => {
        if (b.disabled) return;
        if (mine) mine.cls = c.id;
        sfx('sfx-n2/character-pick', 0.5);
        if (role === 'host') { broadcastState(); render(); }
        else send('pick-class', { cls: c.id });
        render();
      };
      cards.append(b);
    });
    return cards;
  }

  function btn(label, fn, cls = 'olBtn') {
    const b = el('button', cls, label); b.type = 'button'; b.onclick = fn; return b;
  }

  function shakePin(lockMs) {
    sfx('pin-wrong', 0.5);
    const grid = root?.querySelector('.olGrid');
    if (grid) { grid.classList.remove('olShake'); void grid.offsetWidth; grid.classList.add('olShake'); }
    if (lockMs > 0) {
      sfx('locked-out', 0.45);
      const s = Math.ceil(lockMs / 1000);
      pinHint = `Take a little break ⏳ 0:${String(s).padStart(2, '0')}`;
      toast(pinHint, 2800);
      speak('lobby.pin.lockout');
    } else {
      pinHint = 'Not quite! Ask your friend for the PIN 🙂';
      toast(pinHint, 2600);
      speak('lobby.pin.wrong');
    }
    pick = [];
    render();
  }

  function renderPicker(body, { pin, onJoin }) {
    const words = pin ? PIN_WORDS : TABS[tab].words;
    const picker = el('div', 'olPicker');
    const left = el('div', 'olPickerLeft');
    const slots = el('div', 'olWells');
    for (let i = 0; i < 4; i++) {
      const s = el('div', 'olWell');
      s.onclick = () => { pick = pick.slice(0, i); render(); };
      if (pick[i]) {
        const im = document.createElement('img'); im.src = WORD_ICON(pick[i]); im.alt = pick[i];
        s.append(im);
        if (!pin) {
          const tabInfo = TABS[tabOf(pick[i])];
          if (tabInfo) {
            const badge = document.createElement('img');
            badge.className = 'olTabBadge';
            badge.src = ICON('lobby', 'badge-tab-' + (BADGE_TAB[tabInfo.id] || tabInfo.id));
            badge.alt = tabInfo.label;
            s.append(badge);
          }
        }
      }
      slots.append(s);
    }
    left.append(slots);
    if (!pin) {
      const tabs = el('div', 'olTabs');
      TABS.forEach((tb, i) => {
        const b = el('button', 'olTab' + (i === tab ? ' on' : ''), `${tb.em} ${tb.label}`);
        b.onclick = () => { tab = i; render(); };
        tabs.append(b);
      });
      left.append(tabs);
    }
    const grid = el('div', 'olGrid' + (pin ? ' olPinGrid' : ''));
    words.forEach((w, i) => {
      const picked = pick.includes(w) && pick[pick.length - 1] === w;
      const b = el('button', 'olTile' + (picked ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', w);
      const im = document.createElement('img'); im.src = WORD_ICON(w); im.alt = '';
      b.append(im);
      const r = Math.floor(i / 4), c = i % 4;
      if (focusRC[0] === r && focusRC[1] === c) b.classList.add('focus');
      b.onclick = () => {
        pinTapSfx();
        if (pick.length >= 4) return;
        pick = pick.concat(w);
        render();
      };
      grid.append(b);
    });
    const join = el('div', 'olJoinRow');
    const go = btn(pin ? 'Enter PIN' : 'Join', onJoin);
    go.disabled = pick.length !== 4;
    join.append(go);
    if (!pin) {
      const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      if (!touch || typeOpen) {
        const inp = el('input', 'olType');
        inp.type = 'text';
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.placeholder = 'Type a word (3 letters)…';
        inp.addEventListener('input', () => {
          const v = inp.value;
          const sug = suggestWords(v);
          if (sug.length === 1 && v.replace(/[^a-z]/gi, '').length >= (sug[0] === 'clover' || sug[0] === 'cloud' ? 4 : 3)) {
            const w = sug[0];
            if (pick.length < 4 && isWord(w)) { pick = pick.concat(w); inp.value = ''; tab = Math.max(0, tabOf(w)); render(); }
          }
        });
        join.append(inp);
      } else {
        const kb = el('button', 'olTool');
        kb.type = 'button';
        kb.setAttribute('aria-label', 'Type words');
        const kim = document.createElement('img');
        kim.src = ICON('lobby', 'btn-type'); kim.alt = '';
        kb.append(kim);
        kb.onclick = () => { typeOpen = true; render(); };
        join.append(kb);
      }
    }
    left.append(join);
    picker.append(left, grid);
    body.append(picker);
  }

  function onKey(ev) {
    if (!root || root.hidden) return;
    if (screen !== 'join' && screen !== 'pin-enter') {
      if (ev.key === 'z' || ev.key === 'Z') { /* emote bar focus */ return; }
      if (/^[1-8]$/.test(ev.key) && (screen === 'host' || screen === 'room')) { sendEmote(EMOTES[+ev.key - 1].id); ev.preventDefault(); }
      return;
    }
    const words = screen === 'pin-enter' ? PIN_WORDS : TABS[tab].words;
    const cols = 4, rows = 4;
    if (ev.key === 'ArrowRight' || ev.key === 'd') { focusRC[1] = (focusRC[1] + 1) % cols; ev.preventDefault(); render(); }
    else if (ev.key === 'ArrowLeft' || ev.key === 'a') { focusRC[1] = (focusRC[1] + cols - 1) % cols; ev.preventDefault(); render(); }
    else if (ev.key === 'ArrowDown') { focusRC[0] = Math.min(rows - 1, focusRC[0] + 1); ev.preventDefault(); render(); }
    else if (ev.key === 'ArrowUp') { focusRC[0] = Math.max(0, focusRC[0] - 1); ev.preventDefault(); render(); }
    else if (ev.key === 'q' || ev.key === 'Q' || ev.key === '[') { if (screen === 'join') { tab = (tab + 3) % 4; ev.preventDefault(); render(); } }
    else if (ev.key === 'e' || ev.key === 'E' || ev.key === ']') { if (screen === 'join') { tab = (tab + 1) % 4; ev.preventDefault(); render(); } }
    else if (/^[1-4]$/.test(ev.key) && screen === 'join') { tab = +ev.key - 1; ev.preventDefault(); render(); }
    else if (ev.key === 'Enter' || ev.key === ' ') {
      if (pick.length === 4 && ev.key === 'Enter') { ev.preventDefault(); root.querySelector('.olBtn:not(.sec)')?.click(); return; }
      const w = words[focusRC[0] * 4 + focusRC[1]];
      if (w && pick.length < 4) { pinTapSfx(); pick = pick.concat(w); ev.preventDefault(); render(); }
    } else if (ev.key === 'Backspace') { pick = pick.slice(0, -1); ev.preventDefault(); render(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); root.querySelector('.olHead button')?.click(); }
  }

  function showOffline() {
    const line = 'Online play is turned off on this device. Ask a grown-up.';
    toast(line, 2800); speak('lobby.onlineOff');
    sfx('sfx-n2/online-play-off', 0.5);
    statusBanner = line;
    playLobbyMusic();
    showScreen('choice');
    render();
  }

  function openChoice() {
    if (!isOnlineDev()) return;
    if (!allowed()) { showOffline(); return; }
    statusBanner = '';
    playLobbyMusic();
    showScreen('choice');
    render();
  }

  function maybeAutoJoin() {
    if (!isOnlineDev()) return;
    if (!allowed()) {
      if (parseJoinCode()) showOffline();
      else { toast('Online play is turned off on this device. Ask a grown-up.', 3200); speak('lobby.onlineOff'); }
      return;
    }
    const raw = parseJoinCode();
    if (!raw) return;
    const parsed = parseCode(raw);
    if (parsed) { pick = parsed.slice(); beginJoin(parsed); }
    else { pick = []; showScreen('join'); render(); }
  }

  try { syncTitleButton(); } catch (e) {}

  // Document-level Z for emotes when bar is visible
  document.addEventListener('keydown', ev => {
    if (bar && !bar.hidden && (ev.key === 'z' || ev.key === 'Z') && ev.target === document.body) {
      bar.querySelector('button')?.focus(); ev.preventDefault();
    }
  });

  return {
    open: openChoice,
    openChoice,
    maybeAutoJoin,
    startHosting,
    startPlay,
    beginJoin,
    copyLink,
    approve,
    leave,
    sendEmote,
    settings: settingsApi,
    // Fern n2.mjs hook names (on g.lobby only — never on g.net).
    startHost: startHosting,
    hostRoom: startHosting,
    joinRoom: beginJoin,
    joinByCode: beginJoin,
    enterRoom: beginJoin,
    setPin,
    setPIN: setPin,
    enablePin: setPin,
    letIn: () => approve(true),
    deny: () => approve(false),
    lock: lockRoom,
    get self() { return me; },
    get role() { return role; },
    get code() { return code && formatCode(code, '-'); },
    get roomCode() { return code && formatCode(code, '-'); },
    get players() { return players.slice(); },
    get peers() { return players.slice(); },
    get connected() { return !!role && players.length > 0; },
    get pending() { return !!pendingAsk; },
    get pin() { return usePin; },
    get pinOn() { return usePin; },
    get secretPin() { return usePin; },
    get transport() { return transport; },
    get iceTransportPolicy() { return pathInfo().policy; },
    get directAllowed() { return true; },
    allowed,
    pathInfo,
    wakeState: () => wakeState,
  };
}
