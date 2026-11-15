#!/usr/bin/env node
// Map screen asset sync: copies Squid's ui-map kit into ui/map/ and builds tile thumbs + panel cards.
// Re-run after Squid's revised tiles/chrome land:  cd source && node tools/map-assets.mjs
// Sources: /workspace/assets-incoming/ui-map (tiles, chrome, nodes, backdrops)
//          /workspace/assets-incoming/act3/cards (Act 3 intro cards)
//          /workspace/assets-incoming/cards (Acts 1-2 intro cards, when they exist: card-<n>-<slug>.png or card-<id>.png)
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
fs.rmSync(path.join(OUT, 'cards'), { recursive: true, force: true });
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
