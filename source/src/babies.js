// Baby animals: once a home has grown, tiny young of that species hop or flutter around it. Purely cosmetic and always safe -
// they wander near home, cheer (and float little hearts) whenever you deposit something there.
import * as THREE from 'three';
import { SPECIES, SPECIES_ORDER } from './data.js';
import { makeGroundRider, animateGround } from './animals.js';
import { heightAt } from './world.js';

function heartTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ff5c8a'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath();
  g.moveTo(32, 54); g.bezierCurveTo(4, 34, 8, 10, 24, 12); g.bezierCurveTo(30, 13, 32, 18, 32, 20); g.bezierCurveTo(32, 18, 34, 13, 40, 12); g.bezierCurveTo(56, 10, 60, 34, 32, 54); g.closePath(); g.stroke(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const BABY_COUNT = (id, stage) => stage >= 3 ? (SPECIES[id].ground ? 2 : 3) : stage >= 2 ? 1 : 0;

export function buildBabies(scene, riders, nests) {
  const list = [], hearts = [];
  const hTex = heartTex(), hMat = new THREE.SpriteMaterial({ map: hTex, transparent: true, depthWrite: false });
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(hMat.clone()); s.visible = false; s.scale.setScalar(0.6); scene.add(s); hearts.push({ s, t: 9, vx: 0 }); }
  const heart = (x, y, z) => { const h = hearts.find(q => q.t >= 1.6) || hearts[0]; h.t = 0; h.s.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8); h.s.visible = true; h.vx = (Math.random() - 0.5) * 0.4; };

  function make(id) {
    const sp = SPECIES[id]; let g;
    if (sp.ground) g = makeGroundRider(id, sp.size * 0.45);
    else {
      const src = riders[id]; g = new THREE.Group(); g.rotation.order = 'YXZ';
      const body = new THREE.Group(); body.position.y = src.userData.body.position.y; g.add(body);
      for (const c of src.userData.body.children) if (c.isMesh) { const m = new THREE.Mesh(c.geometry, c.material); m.frustumCulled = false; m.position.copy(c.position); m.rotation.copy(c.rotation); m.scale.copy(c.scale); body.add(m); }
      g.scale.setScalar(0.5); g.userData.flyer = true;
    }
    g.frustumCulled = false; scene.add(g); return g;
  }
  const have = {};
  function sync() { // create any babies a home has earned
    for (const id of SPECIES_ORDER) {
      const want = BABY_COUNT(id, nests[id].stage), arr = have[id] ||= [];
      while (arr.length < want) {
        const n = nests[id], a = Math.random() * 6.28, d = 3 + Math.random() * 3;
        const b = { id, g: make(id), x: n.x + Math.cos(a) * d, z: n.z + Math.sin(a) * d, y: 0, yaw: Math.random() * 6.28, tx: 0, tz: 0, tm: 0, ph: Math.random() * 10, cheer: 0, mv: 0 };
        b.tx = b.x; b.tz = b.z; arr.push(b); list.push(b); heart(b.x, heightAt(b.x, b.z) + 1.4, b.z);
      }
    }
  }
  function love(id) { for (const b of have[id] || []) { b.cheer = 1; heart(b.x, b.y + 1.1, b.z); } }
  function update(dt, t, night) {
    for (const b of list) {
      const sp = SPECIES[b.id], n = nests[b.id], vis = sp.nocturnal ? night > 0.5 : night < 0.5;
      b.g.visible = vis; if (!vis) continue;
      b.tm -= dt;
      if (b.tm <= 0) { const a = Math.random() * 6.28, d = 2 + Math.random() * 6; b.tx = n.x + Math.cos(a) * d; b.tz = n.z + Math.sin(a) * d; b.tm = 2.5 + Math.random() * 4; b.pause = Math.random() < 0.35 ? 1.2 : 0; }
      let dx = b.tx - b.x, dz = b.tz - b.z; const d = Math.hypot(dx, dz);
      b.pause = Math.max(0, (b.pause || 0) - dt);
      const spd = b.pause > 0 || d < 0.3 ? 0 : (sp.ground ? 1.5 : 2.0);
      b.mv += (spd / 2 - b.mv) * Math.min(1, dt * 5);
      if (spd) { b.x += dx / d * spd * dt; b.z += dz / d * spd * dt; const yw = Math.atan2(dx, dz); let dy = yw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * Math.min(1, dt * 6); }
      b.cheer = Math.max(0, b.cheer - dt * 1.4);
      const gy = heightAt(b.x, b.z);
      if (sp.ground) {
        const hop = b.cheer > 0 ? Math.abs(Math.sin(t * 9 + b.ph)) * 0.9 * b.cheer : (spd ? Math.abs(Math.sin(t * 7 + b.ph)) * 0.18 : 0);
        b.y = gy + hop; b.g.position.set(b.x, b.y, b.z); b.g.rotation.y = b.yaw; animateGround(b.g, dt, t, b.mv, hop > 0.05, false, 0);
      } else {
        b.y = gy + 1.3 + Math.sin(t * 1.3 + b.ph) * 0.35 + b.cheer * Math.abs(Math.sin(t * 8)) * 0.8; b.g.position.set(b.x, b.y, b.z); b.g.rotation.set(0, b.yaw, Math.sin(t * 1.1 + b.ph) * 0.1);
      }
    }
    for (const h of hearts) { if (h.t >= 1.6) { h.s.visible = false; continue; } h.t += dt; h.s.position.y += 0.9 * dt; h.s.position.x += h.vx * dt; h.s.material.opacity = Math.min(1, (1.6 - h.t) * 1.6); h.s.scale.setScalar(0.45 + 0.25 * Math.sin(Math.min(1, h.t * 3) * 1.57)); }
  }
  return { sync, love, update, list, have };
}
