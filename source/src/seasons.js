// Day/night clock + four gentle seasons. Everything visual is driven by a handful of shared uniforms (SU) that the
// ground, grass and flower/tree materials read, so a season change is one smooth blend, not a pile of swaps.
import * as THREE from 'three';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_INFO = [
  { id: 'spring', emoji: '🌸', name: 'Spring', blurb: 'Fresh green, mist and soft rain.' },
  { id: 'summer', emoji: '☀️', name: 'Summer', blurb: 'Golden light, full meadow, fireflies.' },
  { id: 'autumn', emoji: '🍂', name: 'Autumn', blurb: 'Leaves turn amber; the meadow quiets.' },
  { id: 'winter', emoji: '❄️', name: 'Winter', blurb: 'Soft snow; the little ones nap.' }
];

export const SU = {
  uAut: { value: 0 }, uWin: { value: 0 }, uSpr: { value: 0 },
  uGT: { value: new THREE.Vector3(1, 1, 1) }, uGT2: { value: new THREE.Vector3(1, 1, 1) },
  uSnowG: { value: 0 }, uSnowT: { value: 0 }
};

// Per-season looks, index = spring, summer, autumn, winter
export const LOOK = {
  fog: [0xc6e2e6, 0xb9d8ee, 0xe9d4b2, 0xdde8f2].map(c => new THREE.Color(c)),
  fogFar: [0.95, 1, 0.95, 0.8],
  sun: [1.0, 1.1, 0.95, 0.85], sunCol: [0xfff2da, 0xffeec4, 0xffd9a8, 0xe4efff].map(c => new THREE.Color(c)),
  hemi: [1.5, 1.55, 1.4, 1.45], bg: [1, 1, 0.95, 0.88],
  gt: [[1.04, 1.1, 0.96], [1, 1, 0.97], [1.42, 1.0, 0.62], [1, 1, 1]],
  gt2: [[1.1, 1.2, 0.95], [1, 1, 1], [1.7, 1.0, 0.5], [1, 1, 1]],
  snowG: [0, 0, 0, 0.88], snowT: [0, 0, 0, 0.8],
  activity: [0.88, 1, 0.8, 0.35]
};

/** Season weights from a continuous season position sv in [0,4): linear cross-fade between neighbours (sums to 1). */
export function seasonWeights(sv, out = [0, 0, 0, 0]) {
  const i = Math.floor(sv) % 4, f = sv - Math.floor(sv), k = f * f * (3 - 2 * f);
  out[0] = out[1] = out[2] = out[3] = 0; out[i] = 1 - k; out[(i + 1) % 4] += k; return out;
}

const VERT_SV = `
#ifdef USE_INSTANCING
  vSV = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
#else
  vSV = 0.5;
#endif
vWP = position.xz;`;
const FRAG = {
  prop: `
  { vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.3, 0.59, 0.11));
    float leaf = smoothstep(0.012, 0.07, c.g - max(c.r, c.b));
    vec3 ac = vSV < 0.3 ? vec3(0.93, 0.27, 0.09) : (vSV < 0.65 ? vec3(0.98, 0.6, 0.12) : vec3(0.9, 0.78, 0.22));
    ac *= 0.5 + lum * 1.4;
    c = mix(c, ac, leaf * uAut);
    c = mix(c, c * vec3(1.1, 1.2, 0.95) + 0.015, uSpr * leaf * 0.55);
    c = mix(c, vec3(lum) * vec3(1.0, 0.98, 0.95) + 0.05, uAut * (1.0 - leaf) * 0.22);
    vec3 fr = vec3(lum * 0.7 + 0.46) * vec3(0.93, 0.97, 1.0);
    c = mix(c, fr, uWin * (0.5 * leaf + 0.3 * (1.0 - leaf)));
    diffuseColor.rgb = c; }`,
  ground: `
  { vec3 c = diffuseColor.rgb * uGT;
    float pat = 0.8 + 0.2 * sin(vWP.x * 0.19) * sin(vWP.y * 0.23 + 1.3);
    c = mix(c, vec3(0.93, 0.96, 1.0) * (0.9 + 0.1 * pat), uSnowG * pat);
    diffuseColor.rgb = c; }`,
  grass: `
  { vec3 c = diffuseColor.rgb * uGT2;
    c = mix(c, vec3(0.86, 0.92, 0.96) * (0.8 + 0.4 * vSV * 0.5), uSnowT);
    diffuseColor.rgb = c; }`
};

/** Make a material season-aware. kind: 'prop' (flowers/trees/rocks), 'ground', 'grass'. Safe to call twice. */
export function patchSeason(mat, kind = 'prop') {
  if (mat.userData.seas) return mat;
  mat.userData.seas = kind;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, SU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSV; varying vec2 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_SV);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uAut, uWin, uSpr, uSnowG, uSnowT; uniform vec3 uGT, uGT2; varying float vSV; varying vec2 vWP;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG[kind]);
  };
  mat.customProgramCacheKey = () => 'seas-' + kind;
  mat.needsUpdate = true;
  return mat;
}

// ---------------- clock ----------------
const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
export const NIGHT_T = 0.93, DAY_T = 0.3;
/** 0 = full day, 1 = full night, for clock t in [0,1) (0 = midnight). */
export function nightOf(t) { const h = t * 24; if (h < 5 || h >= 20.5) return 1; if (h < 6.8) return 1 - sm(5, 6.8, h); if (h >= 18.4) return sm(18.4, 20.5, h); return 0; }
/** warm glow around sunrise and sunset, 0..1 */
export function warmOf(t) { const h = t * 24; return Math.max(Math.exp(-(((h - 6.2) / 0.85) ** 2)), Math.exp(-(((h - 18.9) / 1.0) ** 2))); }

export function createClock(saved) {
  const c = {
    t: saved && isFinite(saved.t) ? ((saved.t % 1) + 1) % 1 : DAY_T, day: saved && saved.day | 0 || 0,
    season: saved && saved.season >= 0 && saved.season < 4 ? saved.season | 0 : 0, sv: 0, DAY_S: 540, SEASON_DAYS: 2, changed: 0
  };
  c.sv = c.season;
  c.speed = 1;
  c.set = (t) => { c.t = ((t % 1) + 1) % 1; };
  c.setSeason = (s, snap) => { c.season = ((s % 4) + 4) % 4; if (snap) c.sv = c.season; c.changed++; };
  c.nextSeason = () => { c.day = Math.floor(c.day / c.SEASON_DAYS) * c.SEASON_DAYS + c.SEASON_DAYS; c.setSeason(c.season + 1); };
  c.update = (dt) => {
    c.t += dt * c.speed / c.DAY_S;
    if (c.t >= 1) { c.t -= 1; c.day++; if (c.day % c.SEASON_DAYS === 0) c.setSeason(c.season + 1); }
    const f = (((c.season - c.sv) % 4) + 4) % 4;
    if (f > 3.9) c.sv = c.season;
    else if (f > 0) { c.sv += Math.min(f, dt / 5); if (c.sv >= 4) c.sv -= 4; if (f < 1e-4) c.sv = c.season; }
  };
  c.weights = (out) => seasonWeights(c.sv, out);
  c.serialize = () => ({ t: +c.t.toFixed(4), day: c.day, season: c.season });
  return c;
}
