/** N2 lobby: host/join, picture codes, secret PIN, approval, class pick, emotes.
 *  Transport is DevTransport (BroadcastChannel stub). No methods named host/join
 *  are hung on g.net (n1.mjs would then take the isolated-context path).
 */
import { createTrysteroTransport } from './trystero.js';
import { createChannel } from './channel.js';
import {
  TABS, EMOJI, PIN_WORDS, parseCode, formatCode, formatSpoken, randomCode, randomPin,
  pinIndices, suggestWords, roomChannelId, shareLink, tabOf, isWord,
} from './words.js';
import { pinReply, randomNonce, bytesToB64, b64ToBytes, timingSafeEqual, createPinGuard } from './pin.js';
import { EMOTES, EMOTE_COOLDOWN, EMOTE_SHOW, emoteOf } from './emotes.js';
import { isOnlineDev, canShowFriendsStation, parseJoinCode, onlineDefaults } from './flags.js';
import { createOnlineSettings } from './online-settings.js';
import { mountDebugOverlay } from './debug-overlay.js';

const BASE = import.meta.env.BASE_URL;
const ICON = (folder, name) => BASE + `ui/online/${folder}/${name}.png`;
const WORD_ICON = w => ICON('words', w);
const MAX_PLAYERS = 3;
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
      if (!online.allow) leave('allow-off');
    },
    audio: hooks.audio,
  });
  mountDebugOverlay({
    measureTile: () => document.querySelector('.olTile')?.getBoundingClientRect?.().width || 0,
    getWake: () => wakeState,
    getPath: () => pathInfo(),
  });

  let root = null, bar = null, screen = 'closed';
  let transport = null, channel = null;
  let role = null, code = null, pinWords = null, usePin = false, locked = false;
  let players = [];
  let pick = [];
  let tab = 0, focusRC = [0, 0], typeOpen = false;
  let pinGuard = createPinGuard();
  let pinNonce = null, pinHostId = '';
  let pendingAsk = null;
  let lastEmoteAt = 0;
  let wakeLock = null, wakeState = 'off';
  let lobbyMusic = false;

  function audio() { return hooks.audio; }
  function sfx(name, vol = 0.5) { try { audio()?.sample?.('online/' + name, vol); } catch (e) {} }
  function toast(s, ms) { hooks.toast?.(s, ms); }
  function pathInfo() {
    return {
      path: 'local',
      detail: 'DevTransport (BroadcastChannel). Cloudflare TURN / SignalRoom not configured.',
      policy: 'local',
      wake: wakeState,
    };
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
    if (root) root.hidden = true;
    screen = 'closed';
    if (lobbyMusic && audio()?.music?.current === 'lobby') audio().music.mood(hooks.hubMood?.() || 'hub');
    lobbyMusic = false;
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
    transport = createTrysteroTransport({
      room,
      password: formatCode(words, '-') + ':pollinator-meadow',
      appId: 'dustycharlss.github.io/pollinator-meadow',
      maxUsers: MAX_PLAYERS,
    });
    channel = createChannel(transport);
    channel.onMessage(msg => {
      if (!msg || msg.ch !== 'lobby') return;
      onMsg(msg.data || msg);
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
        if (locked) { send('locked', { to: d.from }); return; }
        if (players.length >= MAX_PLAYERS) { send('full', { to: d.from }); return; }
        if (pinGuard.roomLocked()) { send('pin-room-lock', { to: d.from }); return; }
        if (usePin && pinWords) {
          pendingAsk = { peer: d.from };
          pinNonce = randomNonce();
          send('pin-nonce', { to: d.from, nonce: bytesToB64(pinNonce), hostPeer: me });
          return;
        }
        pendingAsk = { peer: d.from };
        showApprove(d.from);
        sfx('join-request-knock', 0.55);
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
    if (typ === 'full') { toast('Room is full', 2600); showScreen('choice'); return; }
    if (typ === 'locked') { toast('This room is locked', 2600); showScreen('choice'); return; }
    if (typ === 'deny') { toast('The host said not now', 2800); showScreen('choice'); sfx('connection-lost', 0.4); return; }
    if (typ === 'pin-nonce') { pinNonce = b64ToBytes(d.nonce); pinHostId = d.hostPeer || d.from || ''; showScreen('pin-enter'); return; }
    if (typ === 'pin-result') {
      if (d.ok) return;
      if (d.room) { toast('This room is locked for a bit', 2600); showScreen('choice'); return; }
      shakePin(d.lockMs || 0);
      return;
    }
    if (typ === 'approve' || typ === 'state') {
      if (typ === 'approve' && role !== 'host') {
        role = 'client';
        sfx('joined', 0.55);
        audio()?.music?.jingle?.('joined');
      }
      if (d.players) players = d.players;
      if (d.usePin != null) usePin = d.usePin;
      if (d.locked != null) locked = d.locked;
      ensureSelf();
      showScreen('room');
      render();
      return;
    }
    if (typ === 'emote' && d.emote) hooks.onEmote?.(d.from, d.emote);
    if (typ === 'pin-room-lock') { toast('Someone keeps guessing the PIN. Try a new code.', 3000); showScreen('choice'); }
    if (typ === 'host-left' || typ === 'ended') {
      toast("The host's game ended. Back to your Meadow 🌼", 3200);
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
        if (r.roomLocked) toast('Someone keeps guessing your PIN. Make a new code? 🔄', 4000);
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

  function showApprove(peer) {
    pendingAsk = { peer };
    showScreen('approve');
    render();
  }

  function approve(yes) {
    if (role !== 'host' || !pendingAsk) return;
    const peer = pendingAsk.peer;
    if (!yes) { send('deny', { to: peer }); pendingAsk = null; showScreen('host'); render(); return; }
    if (players.length >= MAX_PLAYERS) { send('full', { to: peer }); pendingAsk = null; return; }
    const style = PLAYER_STYLE[players.length] || PLAYER_STYLE[2];
    players.push({ id: peer, cls: null, style: style.id, fill: style.fill, shape: style.shape });
    send('approve', lobbyState());
    broadcastState();
    sfx('host-approves', 0.55);
    pendingAsk = null;
    showScreen('host');
    render();
  }

  function startHosting() {
    if (!allowed()) { toast('Online play is turned off on this device. Ask a grown-up.', 2800); return; }
    role = 'host';
    code = randomCode();
    pinWords = null;
    usePin = false;
    locked = false;
    pinGuard.resetRoom();
    pinHostId = me;
    players = [];
    ensureSelf();
    attachRoom(code);
    sfx('room-created', 0.55);
    playLobbyMusic();
    requestWake();
    showScreen('host');
    render();
  }

  function beginJoin(words) {
    if (!allowed()) { toast('Online play is turned off on this device. Ask a grown-up.', 2800); return; }
    const parsed = Array.isArray(words) ? words : parseCode(words);
    if (!parsed) { toast('Not a known code. Check the four pictures.', 2400); return; }
    role = 'client';
    attachRoom(parsed);
    playLobbyMusic();
    showScreen('asking');
    render();
    setTimeout(() => send('hello', { want: 'join' }), 80);
    setTimeout(() => {
      if (screen === 'asking') { toast("Couldn't find that game. Check the code.", 3000); showScreen('join'); render(); }
    }, 15000);
  }

  function leave(why) {
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

  function copyLink() {
    const url = shareLink(code, location.origin, location.pathname);
    try { navigator.clipboard?.writeText(url); toast('Link copied! The secret PIN is not in the link.', 2400); }
    catch (e) { toast(url, 4000); }
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
    openRoot();
    screen = name;
    bar.hidden = !(name === 'room' || name === 'host');
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
      if (screen === 'choice') { leave('back'); return; }
      if (screen === 'join' || screen === 'host' || screen === 'asking' || screen === 'pin-enter') { if (role) leave('back'); showScreen('choice'); render(); return; }
      showScreen('choice'); render();
    });
    const title = el('h2');
    head.append(back, title);
    const body = el('div', 'olBody');
    card.append(head, body);
    root.append(card);

    if (screen === 'choice') {
      title.textContent = 'Play with friends';
      const row = el('div', 'olRow');
      const h = el('button', 'olChoice', '🏠 Host a game');
      const j = el('button', 'olChoice', '🚪 Join a game');
      h.onclick = startHosting;
      j.onclick = () => { pick = []; tab = 0; showScreen('join'); render(); };
      row.append(h, j);
      body.append(row);
      const fold = el('details', 'olHint');
      fold.innerHTML = `<summary>For grown-ups</summary><p>Playing with friends online. Your child can play with up to 2 friends using a secret 4-picture code (and, if the host wants, a secret picture PIN) that only you share. There's no chat. Players can only tap friendly emoji buttons like 👋 and 🎉. There are no accounts, names, or ads, and we don't store anything about your child. To connect the games, your device's internet address (IP) goes to Cloudflare, the connection service. Other players' devices never see it, unless a grown-up turns on <b>Direct mode</b> in Settings (off by default) on both devices. Only share the code with people you know. The host can say no to anyone and can lock the room. If the game can't reach the relay, it shows an error and never switches to a direct connection on its own.</p>`;
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
      pick = [];
      renderPicker(body, {
        pin: true,
        onJoin: async () => {
          if (pick.length !== 4) return;
          sfx('pin-tap', 0.4);
          try {
            const mac = await pinReply(pinIndices(pick), formatCode(code, '-'), pinNonce, pinHostId, me);
            send('pin-reply', { mac: bytesToB64(mac) });
            showScreen('asking');
            render();
          } catch (e) { toast('Could not send the PIN. Try again.', 2000); }
        },
      });
      return;
    }

    if (screen === 'asking') {
      title.textContent = 'Join a game';
      body.append(el('p', 'olHint', 'Asking the host…'));
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
      const slots = el('div', 'olSlots');
      (code || []).forEach(w => {
        const s = el('div', 'olSlot');
        const im = document.createElement('img');
        im.src = WORD_ICON(w); im.alt = w;
        const badge = el('span', 'olBadge', TABS[tabOf(w)]?.em || '');
        s.append(im, badge);
        s.title = w;
        slots.append(s);
      });
      body.append(slots);
      if (role === 'host') {
        const tools = el('div', 'olRow');
        tools.append(
          btn('Copy link', copyLink),
          btn(locked ? 'Unlock' : 'Lock', () => { locked = !locked; broadcastState(); render(); }),
          btn(usePin ? '🔐 Secret PIN on' : '🔐 Secret PIN', togglePin),
        );
        body.append(tools);
        if (usePin && pinWords) {
          const pr = el('div', 'olSlots');
          pinWords.forEach(w => {
            const s = el('div', 'olSlot');
            const im = document.createElement('img'); im.src = WORD_ICON(w); im.alt = w; s.append(im);
            s.title = w; pr.append(s);
          });
          body.append(el('p', 'olHint', 'Say the PIN out loud. It is not in the link.'));
          body.append(pr);
          body.append(btn('🔄 New PIN', freshPin, 'olBtn sec'));
        }
        body.append(el('p', 'olHint', players.length < 2 ? 'Waiting for friends' : 'Friends are in!'));
      }
      const cards = el('div', 'olCards');
      const taken = takenClasses();
      const mine = players.find(p => p.id === me);
      CLASSES.forEach(c => {
        const b = el('button', 'olClass', `${c.em}<br>${c.label}`);
        const holder = players.find(p => p.cls === c.id);
        if (holder) {
          b.classList.add('taken', holder.style || 'p1');
          b.innerHTML = `${c.em}<br>${c.label}<br><small>${holder.id === me ? 'you' : 'taken'}</small>`;
        }
        b.disabled = !!(holder && holder.id !== me);
        b.onclick = () => {
          if (b.disabled) return;
          if (mine) mine.cls = c.id;
          if (role === 'host') { broadcastState(); render(); }
          else send('pick-class', { cls: c.id });
          render();
        };
        cards.append(b);
      });
      body.append(cards);
      if (role === 'host') {
        const go = btn('Done', () => { closeUi(); bar.hidden = false; }, 'olBtn');
        body.append(go);
      }
      return;
    }
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
      toast(`Take a little break ⏳ 0:${String(s).padStart(2, '0')}`, 2800);
    } else toast('Not quite! Ask your friend for the PIN 🙂', 2600);
    pick = [];
    render();
  }

  function renderPicker(body, { pin, onJoin }) {
    const words = pin ? PIN_WORDS : TABS[tab].words;
    const slots = el('div', 'olSlots');
    for (let i = 0; i < 4; i++) {
      const s = el('div', 'olSlot');
      s.onclick = () => { pick = pick.slice(0, i); render(); };
      if (pick[i]) {
        const im = document.createElement('img'); im.src = WORD_ICON(pick[i]); im.alt = pick[i];
        s.append(im);
        if (!pin) s.append(el('span', 'olBadge', TABS[tabOf(pick[i])]?.em || ''));
      }
      slots.append(s);
    }
    body.append(slots);
    if (!pin) {
      const tabs = el('div', 'olTabs');
      TABS.forEach((t, i) => {
        const b = el('button', 'olTab' + (i === tab ? ' on' : ''), `${t.em} ${t.label}`);
        b.onclick = () => { tab = i; render(); };
        tabs.append(b);
      });
      body.append(tabs);
    }
    const grid = el('div', 'olGrid');
    words.forEach((w, i) => {
      const b = el('button', 'olTile' + (pick.includes(w) && pick[pick.length - 1] === w ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', w);
      const im = document.createElement('img'); im.src = WORD_ICON(w); im.alt = '';
      b.append(im);
      const r = Math.floor(i / 4), c = i % 4;
      if (focusRC[0] === r && focusRC[1] === c) b.classList.add('on');
      b.onclick = () => {
        sfx('pin-tap', 0.35);
        if (pick.length >= 4) return;
        pick = pick.concat(w);
        render();
      };
      grid.append(b);
    });
    body.append(grid);
    const go = btn(pin ? 'Enter PIN' : 'Join', onJoin);
    go.disabled = pick.length !== 4;
    body.append(go);
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
        body.append(inp);
      } else {
        const kb = btn('⌨️', () => { typeOpen = true; render(); }, 'olBtn sec');
        kb.setAttribute('aria-label', 'Type words');
        body.append(kb);
      }
    }
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
      if (w && pick.length < 4) { pick = pick.concat(w); ev.preventDefault(); render(); }
    } else if (ev.key === 'Backspace') { pick = pick.slice(0, -1); ev.preventDefault(); render(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); root.querySelector('.olHead button')?.click(); }
  }

  function openChoice() {
    if (!isOnlineDev()) return;
    if (!allowed()) { toast('Online play is turned off on this device. Ask a grown-up.', 2800); return; }
    playLobbyMusic();
    showScreen('choice');
    render();
  }

  function maybeAutoJoin() {
    if (!isOnlineDev()) return;
    if (!allowed()) {
      if (parseJoinCode()) toast('Online play is turned off on this device. Ask a grown-up.', 3200);
      return;
    }
    const raw = parseJoinCode();
    if (!raw) return;
    const parsed = parseCode(raw);
    if (parsed) { pick = parsed.slice(); beginJoin(parsed); }
    else { pick = []; showScreen('join'); render(); }
  }

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
    leave,
    sendEmote,
    settings: settingsApi,
    get role() { return role; },
    get code() { return code && formatCode(code, '-'); },
    get players() { return players.slice(); },
    get transport() { return transport; },
    allowed,
    pathInfo,
    wakeState: () => wakeState,
  };
}
