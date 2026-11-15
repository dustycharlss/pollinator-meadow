// Screenshots: level intro with picture tips, and pause How-to-play, at 390x844 and 844x390.
// Usage: node tools/tip-shots.mjs --url=http://127.0.0.1:PORT/
import { createRequire } from 'node:module';
const req = createRequire(process.env.PW_FROM || '/workspace/fern-reports/tests/package.json');
const { chromium } = req('playwright');
import fs from 'node:fs';
const url = (process.argv.find(a => a.startsWith('--url=')) || '--url=http://127.0.0.1:8961/').slice(6);
const OUT = '/workspace/tc-wt-map/shots';
fs.mkdirSync(OUT, { recursive: true });
const VPS = { portrait: [390, 844], landscape: [844, 390] };
const res = {}; let fail = 0;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function waitTips(pg, sel, n = 1) {
  await pg.waitForFunction(({ sel, n }) => {
    const root = document.querySelector(sel);
    const imgs = [...(root?.querySelectorAll('img') || [])];
    return imgs.filter(i => i.naturalWidth > 0).length >= n;
  }, { sel, n }, { timeout: 20000 });
}

for (const [vp, [w, h]] of Object.entries(VPS)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__game?.showIntroCard && window.__game.fillHowTips && window.__game.openHow, null, { timeout: 120000 });

  // --- intro with tips (Training Garden has 9 new strips) ---
  const intro = await pg.evaluate(() => {
    __game.showIntroCard('training_garden', { force: true, holdMs: 0 });
    return { has: __game.hasIntroCard('training_garden') };
  });
  await pg.waitForFunction(() => { const img = document.querySelector('#introCard img'); return !!(img && img.naturalWidth > 0); }, null, { timeout: 20000 });
  await waitTips(pg, '#introCard .icTips', 1);
  await pg.waitForTimeout(500);
  const introInfo = await pg.evaluate(() => {
    const el = document.getElementById('introCard');
    const tips = el?.querySelectorAll('.icTips .tipCard') || [];
    const fr = el?.querySelector('.icFrame');
    const rail = el?.querySelector('.icTips');
    const r = n => { const b = n.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    return {
      shown: !el?.hidden && el?.classList.contains('on'),
      hasTips: el?.classList.contains('icHasTips'),
      title: el?.querySelector('.icTitle')?.textContent,
      nTips: tips.length,
      frame: fr ? r(fr) : null,
      tipsBox: rail && !rail.hidden ? r(rail) : null,
      vw: innerWidth, vh: innerHeight,
    };
  });
  const introFile = `${OUT}/tips-intro-${vp}.png`;
  await pg.screenshot({ path: introFile, timeout: 180000 });
  const introIn = introInfo.frame && introInfo.tipsBox
    && introInfo.frame.y >= -1 && introInfo.tipsBox.y + introInfo.tipsBox.h <= introInfo.vh + 2
    && introInfo.nTips >= 1 && introInfo.hasTips && introInfo.shown && intro.has && !errs.length;
  if (!introIn) fail++;
  res[`intro/${vp}`] = { ok: !!introIn, file: introFile, ...introInfo, has: intro.has, errs: [...errs] };
  await pg.evaluate(() => { __game.dismissIntroCard('skip'); __game.dismissLevelTips?.(); });
  errs.length = 0;

  // --- pause How-to-play ---
  const how = await pg.evaluate(async () => {
    document.getElementById('pause')?.classList.add('on');
    await __game.fillHowTips('sunny_hollow');
    __game.openHow ? document.getElementById('how')?.classList.add('on') : null;
    // fillHowTips already mounted; ensure how is visible even if openHow is async
    document.getElementById('how')?.classList.add('on');
    const box = document.getElementById('howTips');
    return { howOn: document.getElementById('how')?.classList.contains('on'), n: box?.querySelectorAll('.tipCard')?.length || 0, hidden: !!box?.hidden };
  });
  await waitTips(pg, '#howTips', 1);
  await pg.waitForTimeout(200);
  const howInfo = await pg.evaluate(() => {
    const how = document.getElementById('how');
    const box = document.getElementById('howTips');
    const r = n => { const b = n.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const img = box?.querySelector('img');
    return {
      howOn: how?.classList.contains('on'),
      nTips: box?.querySelectorAll('.tipCard')?.length || 0,
      hidden: !!box?.hidden,
      box: box ? r(box) : null,
      imgW: img?.naturalWidth || 0,
      zHow: how ? getComputedStyle(how).zIndex : null,
      zPause: document.getElementById('pause') ? getComputedStyle(document.getElementById('pause')).zIndex : null,
      vw: innerWidth, vh: innerHeight,
    };
  });
  const howFile = `${OUT}/tips-how-${vp}.png`;
  await pg.screenshot({ path: howFile, timeout: 180000 });
  const howOk = howInfo.howOn && howInfo.nTips >= 1 && !howInfo.hidden && howInfo.imgW > 0 && !errs.length
    && howInfo.box && howInfo.box.w > 40 && howInfo.box.y + howInfo.box.h <= howInfo.vh + 2;
  if (!howOk) fail++;
  res[`how/${vp}`] = { ok: !!howOk, file: howFile, ...howInfo, errs: [...errs] };

  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/tip-shots.json`, JSON.stringify(res, null, 2));
for (const [k, v] of Object.entries(res)) console.log(k, v.ok ? 'ok' : 'FAIL', JSON.stringify({ title: v.title, nTips: v.nTips, hasTips: v.hasTips, frame: v.frame, tipsBox: v.tipsBox, box: v.box, imgW: v.imgW, zHow: v.zHow, zPause: v.zPause, errs: v.errs }));
process.exit(fail ? 1 : 0);
