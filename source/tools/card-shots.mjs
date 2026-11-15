// Quick intro-card screenshots: day (Sunny Hollow) + night (Moon Meadow, card 3) at 390x844 and 844x390.
// Usage: node tools/card-shots.mjs --url=http://127.0.0.1:8961/
import { createRequire } from 'node:module';
const req = createRequire(process.env.PW_FROM || '/workspace/fern-reports/tests/package.json');
const { chromium } = req('playwright');
import fs from 'node:fs';
const url = (process.argv.find(a => a.startsWith('--url=')) || '--url=http://127.0.0.1:8961/').slice(6);
const OUT = '/workspace/tc-wt-map/shots';
fs.mkdirSync(OUT, { recursive: true });
const VPS = { portrait: [390, 844], landscape: [844, 390] };
const CARDS = [
  { id: 'sunny_hollow', label: 'day', expect: { theme: 'day', text: '1 · Sunny Hollow', light: false } },
  { id: 'moon_meadow', label: 'night3', expect: { theme: 'night', text: '3 · Moon Meadow', light: true } },
];
const res = {}; let fail = 0;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [vp, [w, h]] of Object.entries(VPS)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__game?.showIntroCard && window.__game.hasIntroCard, null, { timeout: 120000 });
  for (const c of CARDS) {
    const has = await pg.evaluate(id => { const h = __game.hasIntroCard(id); __game.showIntroCard(id, { force: true, holdMs: 0 }); return h; }, c.id);
    await pg.waitForFunction(() => { const img = document.querySelector('#introCard img'); return !!(img && img.naturalWidth > 0); }, null, { timeout: 20000 });
    await pg.waitForTimeout(500); // wait out the enter zoom so layout is measured at rest
    const info = await pg.evaluate(() => {
      const el = document.getElementById('introCard');
      const img = el?.querySelector('img');
      const tx = el?.querySelector('.icTitle');
      const fr = el?.querySelector('.icFrame');
      const r = n => { const b = n.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
      const col = tx ? getComputedStyle(tx).color : null;
      const rgb = col && /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(col);
      const lum = rgb ? (0.2126 * +rgb[1] + 0.7152 * +rgb[2] + 0.0722 * +rgb[3]) / 255 : null;
      return {
        shown: !el?.hidden && el?.classList.contains('on'), id: el?.dataset.id, theme: el?.dataset.theme,
        title: tx?.textContent, color: col, lum, shadow: tx ? getComputedStyle(tx).textShadow : null,
        still: el?.classList.contains('icStill'),
        frame: fr ? r(fr) : null, titleBox: tx ? r(tx) : null, img: img ? { w: img.naturalWidth, h: img.naturalHeight, src: img.currentSrc || img.src } : null,
        vw: innerWidth, vh: innerHeight,
      };
    });
    info.has = has;
    const file = `${OUT}/card-${c.label}-${vp}.png`;
    await pg.screenshot({ path: file, timeout: 180000 });
    const light = info.lum != null && info.lum > 0.7;
    const framed = info.frame && info.frame.w > 40 && info.frame.h > 40 && info.frame.x >= -1 && info.frame.y >= -1
      && info.frame.x + info.frame.w <= info.vw + 1 && info.frame.y + info.frame.h <= info.vh + 1;
    const titled = info.titleBox && info.frame
      && info.titleBox.y >= info.frame.y - 1
      && info.titleBox.y + info.titleBox.h <= info.frame.y + info.frame.h + 1;
    const ok = info.has && info.shown && info.title === c.expect.text && info.theme === c.expect.theme
      && light === c.expect.light && framed && titled && !errs.length;
    if (!ok) fail++;
    res[`${c.label}/${vp}`] = { ok, file, light, framed, titled, ...info, errs: [...errs] };
    await pg.evaluate(() => __game.dismissIntroCard());
  }
  // reduce-motion: no zoom class / still flag
  const rm = await pg.evaluate(() => {
    document.documentElement.classList.add('reduceMotion');
    __game.showIntroCard('moon_meadow', { force: true, holdMs: 0, reduceMotion: true });
    const el = document.getElementById('introCard');
    const cs = getComputedStyle(el.querySelector('.icFrame'));
    const out = { still: el.classList.contains('icStill'), transform: cs.transform, animation: cs.animationName };
    __game.dismissIntroCard();
    document.documentElement.classList.remove('reduceMotion');
    return out;
  });
  const rmOk = rm.still && (rm.transform === 'none' || rm.transform === 'matrix(1, 0, 0, 1, 0, 0)') && (rm.animation === 'none' || !rm.animation);
  if (!rmOk) fail++;
  res[`${vp}/reduceMotion`] = { ok: rmOk, ...rm };
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/card-shots.json`, JSON.stringify(res, null, 2));
for (const [k, v] of Object.entries(res)) console.log(k, v.ok ? 'ok' : 'FAIL', JSON.stringify({ title: v.title, theme: v.theme, lum: v.lum, frame: v.frame, img: v.img && v.img.w, still: v.still, transform: v.transform, animation: v.animation, errs: v.errs }));
process.exit(fail ? 1 : 0);
