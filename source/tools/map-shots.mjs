// Map screen screenshots + layout checks: node tools/map-shots.mjs [--url=http://localhost:8955/]
import { createRequire } from 'node:module';
const req = createRequire(process.env.PW_FROM || '/workspace/fern-reports/tests/package.json');
const { chromium } = req('playwright');
import fs from 'node:fs';
const url = (process.argv.find(a => a.startsWith('--url=')) || '--url=http://localhost:8955/').slice(6);
const OUT = '/workspace/tc-wt-map/shots';
const VPS = { portrait: [390, 844], portraitSmall: [360, 740], tallLandscape: [1024, 700], shortLandscape: [844, 390] };
const SAVE = { stars: { sunny_hollow: { n: 3, challenge: true, seed: true }, creek_bend: { n: 2 }, moon_meadow: { n: 1 }, sunbeam_grove: { n: 2, seed: true }, ember_ridge: { n: 3, challenge: true, seed: true } },
  beaten: ['training_garden', 'trailhead_trials', 'sunny_hollow', 'creek_bend', 'moon_meadow', 'sunbeam_grove'], visit: ['log_jam', 'mill_pond'], active: 'creek_bend' };
const res = {}; let fail = 0;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, [w, h]] of Object.entries(VPS).filter(([n]) => !process.env.VPS || process.env.VPS.split(',').includes(n))) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(url + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__game?.valley && window.__game.openMap, null, { timeout: 120000 });
  await pg.evaluate(S => { const V = __game.valley; Object.assign(V.data.stars = V.data.stars || {}, S.stars); V.data.beaten = S.beaten; for (const id of S.visit) V.setState(id, 'in_progress'); V.data.activePatch = S.active; V.save(); }, SAVE);
  for (const view of [1, 2, 3, 0]) {
    await pg.evaluate(v => __game.openMap(v), view); await pg.waitForTimeout(900);
    const m = await pg.evaluate(() => {
      const r = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom), r: Math.round(b.right) }; };
      const go = document.getElementById('vGo'), g = document.getElementById('vGrid'), tiles = [...g.querySelectorAll('.msTile')];
      const cs = getComputedStyle(g);
      return { vw: innerWidth, vh: innerHeight, play: r(go), playLabel: go.textContent.trim(), playOn: go.offsetParent !== null, timed: !document.getElementById('vTimed').hidden,
        cols: cs.gridTemplateColumns.split(' ').length, tile: tiles[0] ? r(tiles[0].querySelector('.tSq')) : null, cell: tiles[0] ? r(tiles[0]) : null,
        rowGap: cs.rowGap, scroll: g.scrollHeight > g.clientHeight + 1, n: tiles.length, nodes: document.querySelectorAll('.msNode').length,
        title: document.getElementById('msTitle').textContent, ov: document.documentElement.scrollWidth > innerWidth };
    });
    const ok = m.playOn && m.play.b <= m.vh && m.play.r <= m.vw && m.play.y >= 0 && !m.ov && (view === 0 || !m.tile || m.tile.w >= 48);
    if (!ok) fail++;
    const file = `${OUT}/map-${name}-${view === 0 ? 'world' : 'act' + view}.png`;
    await pg.screenshot({ path: file, timeout: 180000 });
    res[`${name}/${view}`] = { ok, ...m, file };
  }
  // Hub HUD (Crew/Skins/note) in the 3D Hub
  await pg.evaluate(() => { document.getElementById('vBack').click(); __game.startValleyPatch('meadow_hub'); });
  await pg.waitForTimeout(500);
  await pg.waitForFunction(() => document.body.classList.contains('inHub'), null, { timeout: 60000 }).catch(() => {});
  await pg.waitForFunction(() => window.__game?.valley, null, { timeout: 120000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  const hub = await pg.evaluate(() => ({ inHub: document.body.classList.contains('inHub'), tools: getComputedStyle(document.getElementById('hubTools')).display, crew: !!document.getElementById('bHubCrew')?.offsetParent })).catch(e => ({ err: String(e) }));
  await pg.screenshot({ path: `${OUT}/hub-${name}.png`, timeout: 180000 }).catch(() => {});
  // Hub map button → Meadow overview
  const ovw = await pg.evaluate(() => { document.getElementById('bHubMap')?.click(); return { on: document.getElementById('valley').classList.contains('on'), view: __game.mapUI.view }; }).catch(e => ({ err: String(e) }));
  res[`${name}/hub`] = { ...hub, mapBtn: ovw, errs };
  if (errs.length || ovw.view !== 'world') fail++;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/map-shots.json`, JSON.stringify(res, null, 1));
for (const [k, v] of Object.entries(res)) console.log(k, v.ok === false ? 'FAIL' : 'ok', JSON.stringify({ cols: v.cols, tile: v.tile && v.tile.w, cell: v.cell && v.cell.h, gap: v.rowGap, play: v.play && [v.play.y, v.play.b, v.playLabel], n: v.n, nodes: v.nodes, scroll: v.scroll, timed: v.timed, hub: v.inHub, tools: v.tools, map: v.mapBtn, errs: v.errs }));
process.exit(fail ? 1 : 0);
