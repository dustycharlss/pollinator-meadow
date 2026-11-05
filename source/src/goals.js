// Goal cards (Fern goal-cards.json). 3 per round; collapsible HUD; impactful play-only rewards.
import GOALS from './goal-cards-data.json';
import { CATALOG } from './build.js';
const byTier = (b, n) => Object.keys(b).reduce((a, k) => a + (CATALOG[k] && CATALOG[k].tier === n ? b[k] : 0), 0);
const byModel = (b, m) => Object.keys(b).reduce((a, k) => a + (CATALOG[k] && CATALOG[k].m === m ? b[k] : 0), 0);

const ACTIVE = GOALS.filter(g => g.status === 'active');
const COLLAPSE_KEY = 'pm-goals-collapsed';

function targetOf(g, len) {
  const t = g.targets || {};
  return t[String(len)] ?? t[len] ?? 1;
}

function progress(g, ctx) {
  const T = targetOf(g, ctx.len);
  const s = ctx.round.stats, builds = s.builds || {};
  const id = g.id;
  const cond = g.condition || '';
  let cur = 0, need = T;
  if (cond.includes('units >=')) cur = s.units || 0;
  else if (cond.includes('builds.outpost')) cur = byTier(builds, 1);
  else if (cond.includes('builds.marker')) cur = byTier(builds, 2);
  else if (cond.includes('builds.garden')) cur = byTier(builds, 3);
  else if (cond.includes('builds.storage')) cur = s.starseeds || 0;
  else if (cond.includes('builds.bridge')) cur = byModel(builds, 'bridge');
  else if (cond.includes('helpers >=')) cur = s.helpers || 0;
  else if (cond.includes('helperUnits')) cur = s.helperUnits || 0;
  else if (cond.includes('maxPct')) { cur = Math.floor(s.maxPct || ctx.terrPct || 0); }
  else if (cond.includes('dew >=')) cur = s.dew || 0;
  else if (cond.includes('tech.count')) cur = ctx.techCount?.() || 0;
  else if (cond.includes('round.score')) cur = ctx.round.score();
  else if (cond.includes('homeLv')) cur = ctx.homeLv?.() || 1;
  else if (cond.includes('nests') && cond.includes('stage')) cur = ctx.nestStage?.() || 0;
  else if (cond.includes('first nestCheck') || id === 'quick_start') cur = (s.units || 0) > 0 && ctx.round.elapsed < 60 ? 1 : (s.units > 0 && ctx.round.elapsed >= 60 ? 0 : 0);
  else if (cond.includes('journalUnlock')) cur = ctx.journalN?.() || 0;
  else if (cond.includes('apiary|honeycave')) cur = byTier(builds, 2) + byTier(builds, 3);
  else if (cond.includes('gained')) { const gn = s.gained || {}; cur = Math.min(gn.p || 0, gn.d || 0, gn.s || 0); }
  else if (cond.includes('distinct keys')) cur = Object.keys(builds).length;
  else if (cond.includes('nightOf') || id.includes('night')) cur = s.nightUnits || 0;
  else if (cond.includes('beacon tends') || id.includes('tend')) cur = s.dewSets || 0;
  else if (cond.includes('buyGear') || id.includes('gear')) cur = s.gearBuys || 0;
  else if (cond.includes('p.lv >= 3') || cond.includes('upgrade')) cur = s.upgrades || 0;
  else cur = s.units || 0;
  if (id === 'quick_start') { need = 1; cur = s.quickStart ? 1 : 0; }
  return { cur: Math.min(cur, need), need, done: cur >= need };
}

/** Parse reward text into actionable kinds (play-only; no shop/money). */
function parseReward(def) {
  const raw = (def.reward || '').replace(/\s+/g, ' ').trim();
  const kinds = [];
  if (/free helper|🐾/i.test(raw)) kinds.push({ kind: 'helper' });
  if (/jumbo basket time/i.test(raw)) kinds.push({ kind: 'jumboUse', n: 1 });
  else if (/jumbo.*?×\s*2|jumbo.*?x2/i.test(raw)) kinds.push({ kind: 'jumbo', n: 2 });
  else if (/jumbo|basket/i.test(raw)) kinds.push({ kind: 'jumbo', n: 1 });
  if (/big resource burst/i.test(raw)) kinds.push({ kind: 'burst', n: 28 });
  else if (/resource burst|📦/i.test(raw) || /burst/i.test(raw)) kinds.push({ kind: 'burst', n: 14 });
  if (/temporary visitor|🎟️|visitor/i.test(raw)) kinds.push({ kind: 'visitor' });
  if (/looks unlock|✨/i.test(raw)) kinds.push({ kind: 'looks', n: 2 });
  const hat = /Hat:\s*([a-z0-9-]+)/i.exec(raw);
  if (hat) kinds.push({ kind: 'hat', id: hat[1] });
  else if (/Hat\s*\(/i.test(raw)) kinds.push({ kind: 'looks', n: 1 });
  const pts = /(?:\+|−|-)?(\d+)\s*pts?/i.exec(raw);
  kinds.push({ kind: 'pts', n: pts ? +pts[1] : (kinds.length ? 40 : 50) });
  if (!kinds.some(k => k.kind !== 'pts')) {
    // legacy points-only → upgrade to a small burst so every goal feels impactful
    kinds.push({ kind: 'burst', n: 10 });
  }
  return { label: raw || '+50 pts', kinds };
}

function isImpactful(def) {
  const { kinds } = parseReward(def);
  return kinds.some(k => k.kind === 'helper' || k.kind === 'visitor' || k.kind === 'jumbo' || k.kind === 'jumboUse');
}

function pickThree(len, lead, seed) {
  const pool = ACTIVE.filter(g => (g.min_len_min || 3) <= len);
  const shuffled = pool.slice().sort((a, b) => {
    const ha = (a.id.charCodeAt(0) * 17 + (seed | 0)) % 97;
    const hb = (b.id.charCodeAt(0) * 17 + (seed | 0) * 3) % 97;
    return ha - hb;
  });
  const out = [], tags = new Set();
  for (const g of shuffled) {
    const tag = (g.tags && g.tags[0]) || g.id;
    if (tags.has(tag) && out.length < 2) continue;
    out.push(g); tags.add(tag);
    if (out.length >= 3) break;
  }
  while (out.length < 3 && shuffled[out.length]) out.push(shuffled[out.length]);
  // Prefer at least one free-helper (or other impactful) reward in the trio
  if (!out.some(isImpactful)) {
    const swap = shuffled.find(g => isImpactful(g) && !out.includes(g));
    if (swap && out.length) out[out.length - 1] = swap;
  } else if (!out.some(g => /free helper|🐾/i.test(g.reward || ''))) {
    const help = shuffled.find(g => /free helper|🐾/i.test(g.reward || '') && !out.includes(g));
    if (help && out.length >= 2) out[1] = help;
  }
  return out.slice(0, 3);
}

function phoneDefaultCollapsed() {
  try { return window.matchMedia('(max-width: 520px), (orientation: portrait) and (max-width: 900px)').matches; } catch (e) { return true; }
}

function loadCollapsed() {
  try {
    const v = sessionStorage.getItem(COLLAPSE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (e) {}
  return phoneDefaultCollapsed(); // collapsed by default on phone
}

function saveCollapsed(on) {
  try { sessionStorage.setItem(COLLAPSE_KEY, on ? '1' : '0'); } catch (e) {}
}

export function createGoals(ctx) {
  const G = { cards: [], done: new Set(), collapsed: loadCollapsed() };
  let wrap = document.getElementById('goalWrap');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'goalWrap';
    document.body.appendChild(wrap);
  }
  wrap.classList.toggle('collapsed', G.collapsed);

  function toggleBtnLabel() {
    const doneN = G.done.size;
    const left = G.cards.length;
    const arrow = G.collapsed ? '▸' : '▾';
    if (!left) return `🎯 Done ${doneN}/3 ${arrow}`;
    return `🎯 ${left} left · ${doneN}/3 ${arrow}`;
  }

  function bindToggle(btn) {
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      G.collapsed = !G.collapsed;
      wrap.classList.toggle('collapsed', G.collapsed);
      saveCollapsed(G.collapsed);
      btn.textContent = toggleBtnLabel();
      btn.setAttribute('aria-expanded', G.collapsed ? 'false' : 'true');
    });
  }

  function render() {
    // Completed quests are removed from G.cards — hide the panel when none remain
    if (!G.cards.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    wrap.style.display = document.body.classList.contains('inRound') ? 'flex' : 'none';
    wrap.classList.toggle('collapsed', G.collapsed);
    const total = 3;
    const list = G.cards.map((c, i) => {
      const p = progress(c.def, snapshot());
      const reward = String(parseReward(c.def).label).replace(/\s*[+−-]?\d+\s*pts?\b/gi, '').replace(/^\s*[·,]\s*|\s*[·,]\s*$/g, '') || '🌸 Bonus';
      const pct = p.need ? Math.min(100, Math.round(100 * p.cur / p.need)) : 0;
      const tag = (c.def.tags && c.def.tags[0]) || '';
      const ic = ({ gathering: '🌼', building: '🔨', explore: '🗺️', helpers: '🐾', hiring: '🐾', tech: '🧬', territory: '🏳️', visit: '🎟️' }[tag] || '🎯');
      const desc = (c.def.description || '').replace(/</g, '');
      const num = G.done.size + i + 1;
      return `<article class="gCard" aria-label="Goal: ${c.def.title}">
        <header class="gHead"><span class="gNum">Goal ${num}/${total}</span><span class="gTitle">${c.def.title}</span></header>
        <div class="gBody">
          <div class="gIcon" aria-hidden="true">${ic}</div>
          <div class="gMeta">
            ${desc ? `<div class="gDesc">${desc}</div>` : ''}
            <div class="gProg">${p.cur} / ${p.need}</div>
            ${reward ? `<div class="gReward">★ ${reward}</div>` : ''}
          </div>
        </div>
        <div class="gBar" aria-hidden="true"><i style="width:${pct}%"></i></div>
      </article>`;
    }).join('');
    wrap.innerHTML = `<button type="button" id="goalToggle" class="goalToggle" aria-expanded="${G.collapsed ? 'false' : 'true'}" aria-controls="goalList">${toggleBtnLabel()}</button><div id="goalList" class="goalList">${list}</div>`;
    bindToggle(wrap.querySelector('#goalToggle'));
  }

  function snapshot() {
    return {
      len: ctx.round.len, round: ctx.round, terrPct: ctx.terr?.().pct || 0,
      techCount: ctx.techCount, homeLv: ctx.homeLv, nestStage: ctx.nestStage, journalN: ctx.journalN,
    };
  }

  async function grant(c) {
    const info = parseReward(c.def);
    let pts = 40;
    for (const k of info.kinds) {
      if (k.kind === 'pts') { pts = k.n; ctx.round.add('team', k.n); }
      else if (k.kind === 'jumbo') ctx.giveJumbo?.(k.n || 1);
      else if (k.kind === 'jumboUse') {
        ctx.giveJumbo?.(k.n || 1);
        ctx.activateJumbo?.();
      }
      else if (k.kind === 'burst') ctx.grantBurst?.(k.n || 14);
      else if (k.kind === 'helper') await ctx.grantHelper?.();
      else if (k.kind === 'visitor') await ctx.grantVisitor?.();
      else if (k.kind === 'looks') ctx.grantLooks?.(k.n || 1);
      else if (k.kind === 'hat') ctx.grantHat?.(k.id);
    }
    return String(info.label).replace(/\s*[+−-]?\d+\s*pts?\b/gi, '').replace(/^\s*[·,]\s*|\s*[·,]\s*$/g, '') || '🌸 Bonus';
  }

  G.resetRound = () => {
    G.done.clear();
    const seed = (Date.now() / 1000) | 0;
    G.cards = pickThree(ctx.round.len, ctx.lead?.(), seed).map(def => ({ def, rewarded: false }));
    // Re-apply phone-friendly default each new round if user hasn't chosen yet
    try {
      if (sessionStorage.getItem(COLLAPSE_KEY) == null) {
        G.collapsed = phoneDefaultCollapsed();
        wrap.classList.toggle('collapsed', G.collapsed);
      }
    } catch (e) {}
    for (const c of G.cards) ctx.audio?.sample?.('ui2/goal-card-appear-chime', 0.35);
    render();
    ctx.toast?.('🎯 Three meadow goals from Pip! Tap 🎯 to tuck them away.', 2600);
  };

  G.update = () => {
    if (!G.cards.length) return;
    let dirty = false;
    const finished = [];
    for (const c of G.cards) {
      if (c.rewarded) continue;
      const p = progress(c.def, snapshot());
      if (p.done) {
        c.rewarded = true; G.done.add(c.def.id); dirty = true; finished.push(c);
        (async () => {
          const label = await grant(c);
          ctx.audio?.sample?.('ui2/goal-complete-fanfare', 0.5);
          ctx.audio?.music?.jingle?.('goal');
          ctx.toast?.(`🎉 Goal: ${c.def.title}! ${label}`, 3400);
          ctx.onGoalReward?.(c.def, label);
        })();
      }
    }
    if (dirty) {
      // Clear completed quests from the menu immediately (reward toast still fires)
      G.cards = G.cards.filter(c => !c.rewarded);
      render();
    } else if ((G._t = (G._t || 0) + 1) % 15 === 0) render();
  };

  G.markQuickStart = () => { ctx.round.stats.quickStart = 1; };
  G.resultsLine = () => {
    const n = G.done.size;
    return n ? `Goals: ${n}/3 complete` : '';
  };
  G.render = render;
  G.setCollapsed = (on) => { G.collapsed = !!on; saveCollapsed(G.collapsed); wrap.classList.toggle('collapsed', G.collapsed); render(); };
  return G;
}
