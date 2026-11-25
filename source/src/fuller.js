// l20p "make it feel fuller" shared state: current level id (set by zones.js on level build), used by the grade LUT etc.
let levelId = null;
export function setFullerLevel(id) { levelId = id || null; if (typeof window !== 'undefined') window.__fullerLevel = levelId; }
export function fullerLevel() { return levelId; }
export const NIGHT_LEVELS = new Set(['moon_meadow', 'owl_wood', 'night_market']);
