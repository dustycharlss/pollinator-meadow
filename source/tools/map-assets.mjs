#!/usr/bin/env node
// Map screen asset sync: copies Squid's ui-map kit into ui/map/ and builds tile thumbs + intro cards.
// Re-run after Squid's revised tiles/chrome/cards land:  cd source && node tools/map-assets.mjs
// Sources: /workspace/assets-incoming/ui-map (tiles, chrome, nodes, backdrops, thumbs)
//          /workspace/assets-incoming/cards (Acts 1-2 intro cards, cards-manifest.json)
//          /workspace/assets-incoming/act3/cards (Act 3 intro cards, cards-manifest.json)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const KIT = process.env.MAP_KIT || '/workspace/assets-incoming/ui-map';
const CARDS3 = process.env.MAP_CARDS3 || '/workspace/assets-incoming/act3/cards';
const CARDS12 = process.env.MAP_CARDS12 || '/workspace/assets-incoming/cards';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.join(ROOT, 'ui/map');
const grid = JSON.parse(fs.readFileSync(path.join(KIT, 'grid.json'), 'utf8'));

const COPY = {
  tiles: ['tile-new', 'tile-played', 'tile-done', 'tile-selected', 'tile-current', 'tile-locked'],
  chrome: ['btn-back', 'btn-arrow-prev', 'btn-arrow-next', 'btn-play-normal', 'btn-play-pressed', 'btn-play-disabled', 'card-thumb-frame', 'chip', 'tab', 'tab-selected', 'toggle-timed-off', 'toggle-timed-on', 'icon-act1', 'icon-act2', 'icon-act3', 'select-panel', 'map-well', 'frame'],
  nodes: ['node-hub', 'node-region', 'node-current', 'badge-challenge', 'badge-trail', 'marker-starseed', 'stars-0', 'stars-1', 'stars-2', 'stars-3'],
};
for (const [dir, names] of Object.entries(COPY)) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const n of names) for (const s of ['', '@2x']) {
    const src = path.join(KIT, dir, n + s + '.png');
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, dir, n + s + '.png'));
    else console.warn('missing', src);
  }
}
fs.mkdirSync(path.join(OUT, 'backdrops'), { recursive: true });
for (const f of fs.readdirSync(path.join(KIT, 'backdrops')).filter(f => f.endsWith('.png'))) {
  await sharp(path.join(KIT, 'backdrops', f)).webp({ quality: 82 }).toFile(path.join(OUT, 'backdrops', f.replace('.png', '.webp')));
}
fs.copyFileSync(path.join(KIT, 'grid.json'), path.join(ROOT, 'source/src/map/grid.json'));
fs.copyFileSync(path.join(KIT, 'layout.json'), path.join(ROOT, 'source/src/map/layout.json'));

// ---- Squid's tile + panel thumbnails (thumbs/thumbs.json is the source of truth; ids map to files) ----
// Copies the files thumbs.json lists and writes a slim ui/map/thumbs/index.json the game fetches at runtime,
// so redone thumbs (crow / owl cards, Cliff Orchard crop) only need this script re-run — no game rebuild.
const TH = path.join(KIT, 'thumbs'), spec = JSON.parse(fs.readFileSync(path.join(TH, 'thumbs.json'), 'utf8'));
const tout = path.join(OUT, 'thumbs');
fs.rmSync(tout, { recursive: true, force: true }); fs.mkdirSync(tout, { recursive: true });
const index = { tile_css: spec.tile_thumb_css, panel_css: spec.panel_thumb_css, thumbs: {} };
for (const [id, e] of Object.entries(spec.thumbs)) {
  const out = {};
  for (const kind of ['tile', 'panel']) {
    const f = e[kind]; if (!f) continue;
    for (const k of ['png', 'png2x', 'webp', 'webp2x']) if (f[k]) fs.copyFileSync(path.join(TH, f[k]), path.join(tout, f[k]));
    out[kind] = { png: f.png, png2x: f.png2x, webp: f.webp, webp2x: f.webp2x };
  }
  index.thumbs[id] = out;
}
fs.writeFileSync(path.join(tout, 'index.json'), JSON.stringify(index) + '\n');
console.log('map assets ok: thumbs', Object.keys(index.thumbs).length);

// ---- Intro cards (textless 16:9 art; runtime overlays the title). Paths stay data-driven from the manifests
// so Squid can redo crow / owl / Cliff Orchard (or any other card) and a re-run of this script is enough.
const TITLE_DAY = { color: '#3b2614', shadow: '0 1px 0 rgba(255,248,230,.95), 0 2px 8px rgba(255,236,200,.75)' };
const TITLE_NIGHT = { color: '#f6f2ff', shadow: '0 1px 2px rgba(16,12,36,.9), 0 2px 10px rgba(16,12,36,.65)' };
// Night / dark-band cards that need light title text with a shadow (cards 3 and 14; Act 3 Night Market + Mirror Caves).
const NIGHT_IDS = new Set(['moon_meadow', 'owl_wood', 'night_market', 'mirror_caves']);

// Night Market's dusk sky sits under the light title at ~3.92:1. Bake a soft top scrim into
// that card's art so #f6f2ff reaches ≥ 4.5:1 in the title safe area (Fern samples the image,
// not the CSS shadow). Other night cards already clear 4.5:1 and are left alone.
const TITLE_SCRIM = {
  night_market: { rgb: [16, 12, 36], alpha: 0.28, fadeStart: 0.30, fadeEnd: 0.40 },
};

async function applyTitleScrim(file, spec) {
  const img = sharp(file);
  const { width, height, format } = await img.metadata();
  if (!width || !height) return;
  const [r, g, b] = spec.rgb;
  const a = spec.alpha;
  const s = Math.round(spec.fadeStart * 1000) / 10;
  const e = Math.round(spec.fadeEnd * 1000) / 10;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="rgb(${r},${g},${b})" stop-opacity="${a}"/>` +
    `<stop offset="${s}%" stop-color="rgb(${r},${g},${b})" stop-opacity="${a}"/>` +
    `<stop offset="${e}%" stop-color="rgb(${r},${g},${b})" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  const tmp = file + '.scrim';
  const pipe = sharp(file).composite([{ input: svg, blend: 'over' }]);
  if (format === 'webp') await pipe.webp({ quality: 90 }).toFile(tmp);
  else await pipe.png().toFile(tmp);
  fs.renameSync(tmp, file);
}


function tileIdFor(card) {
  if (typeof card.level === 'number' && card.level >= 1) {
    for (const a of Object.values(grid.acts)) {
      const t = a.tiles.find(t => t.n === card.level);
      if (t) return t.id;
    }
  }
  const slug = String(card.slug || card.id || '').toLowerCase();
  if (slug === 'act1-title' || card.id === 'act1-title') return 'act1_region';
  if (slug === 'act2-title' || card.id === 'act2-title') return 'act2_region';
  if (slug === 'act3-title' || card.id === 'act3-title') return 'act3_region';
  const unders = slug.replace(/-/g, '_');
  for (const a of Object.values(grid.acts)) {
    const t = a.tiles.find(t => t.id === unders || t.name === card.name);
    if (t) return t.id;
  }
  return unders || null;
}

function readManifest(dir) {
  const p = path.join(dir, 'cards-manifest.json');
  if (!fs.existsSync(p)) return null;
  return { dir, man: JSON.parse(fs.readFileSync(p, 'utf8')) };
}

const cout = path.join(OUT, 'cards');
fs.rmSync(cout, { recursive: true, force: true });
fs.mkdirSync(cout, { recursive: true });
const cards = {};
let safeArea = null, copied = 0;
for (const src of [readManifest(CARDS12), readManifest(CARDS3)].filter(Boolean)) {
  if (!safeArea && src.man.safeArea) safeArea = src.man.safeArea;
  for (const card of src.man.cards || []) {
    const id = tileIdFor(card);
    if (!id) { console.warn('intro card: no tile id for', card.id || card.slug); continue; }
    const files = card.files || {};
    const outFiles = {};
    for (const [k, name] of Object.entries(files)) {
      const from = path.join(src.dir, name);
      if (!fs.existsSync(from)) { console.warn('missing card file', from); continue; }
      fs.copyFileSync(from, path.join(cout, name));
      outFiles[k] = name;
      copied++;
    }
    if (TITLE_SCRIM[id]) {
      for (const name of Object.values(outFiles)) await applyTitleScrim(path.join(cout, name), TITLE_SCRIM[id]);
    }
    const night = NIGHT_IDS.has(id);
    const ink = night ? TITLE_NIGHT : TITLE_DAY;
    const tile = Object.values(grid.acts).flatMap(a => a.tiles).find(t => t.id === id);
    const uv = card.safeArea?.uv
      ? (Array.isArray(card.safeArea.uv)
        ? { x: card.safeArea.uv[0], y: card.safeArea.uv[1], w: card.safeArea.uv[2], h: card.safeArea.uv[3] }
        : card.safeArea.uv)
      : (src.man.safeArea?.uv || { x: 0.1, y: 0.0444, w: 0.8, h: 0.2667 });
    cards[id] = {
      id: card.id,
      slug: card.slug,
      title: (tile && tile.name) || card.name,
      n: tile && tile.n != null ? tile.n : (typeof card.level === 'number' && card.level >= 1 ? card.level : null),
      theme: night ? 'night' : 'day',
      color: ink.color,
      shadow: ink.shadow,
      safeArea: { uv },
      png: outFiles.png || null,
      png2x: outFiles.png2x || null,
      webp: outFiles.webp || null,
      webp2x: outFiles.webp2x || null,
    };
  }
}
const cardsJson = {
  holdMs: 2500,
  defaultTitle: { ...TITLE_DAY },
  safeArea: safeArea || { uv: { x: 0.1, y: 0.0444, w: 0.8, h: 0.2667 } },
  cards,
};
const jsonText = JSON.stringify(cardsJson, null, 2) + '\n';
fs.writeFileSync(path.join(cout, 'index.json'), jsonText);
fs.writeFileSync(path.join(ROOT, 'source/src/map/cards.json'), jsonText);
console.log('map assets ok: intro cards', Object.keys(cards).length, 'ids,', copied, 'files');
