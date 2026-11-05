// Gentle weather. Nothing here ever blocks, slows or harms you: it only changes mood - mist, soft rain, snowfall and a rainbow
// after the rain. States ease in and out and last a minute or two.
import * as THREE from 'three';

const RAIN_N = 520;
export function buildWeather(scene) {
  // ---- rain streaks, world-anchored around the camera (wrap in a 44 m box)
  const seed = new Float32Array(RAIN_N * 2 * 4), end = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) { const a = Math.random(), b = Math.random(), c = Math.random(), d = Math.random(); for (let k = 0; k < 2; k++) { const j = (i * 2 + k); seed.set([a, b, c, d], j * 4); end[j] = k; } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 2 * 3), 3));
  rg.setAttribute('aS', new THREE.BufferAttribute(seed, 4)); rg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1)); rg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(0.78, 0.86, 1) } },
    vertexShader: `attribute vec4 aS; attribute float aEnd; uniform vec3 uCam; uniform float uTime, uAmt; varying float vA;
      void main(){
        float bx = uCam.x + mod(aS.x * 44.0 - uCam.x, 44.0) - 22.0, bz = uCam.z + mod(aS.z * 44.0 - uCam.z, 44.0) - 22.0;
        float fall = mod(aS.y * 34.0 + uTime * (19.0 + aS.w * 6.0), 34.0);
        vec3 p = vec3(bx + fall * 0.1, uCam.y + 16.0 - fall, bz) + aEnd * vec3(0.1, 1.0, 0.02) * (0.9 + aS.w * 0.5);
        float dist = length(p - uCam);
        vA = uAmt * (0.2 + 0.3 * aS.w) * (1.0 - smoothstep(14.0, 24.0, dist)) * step(aS.w, 0.15 + uAmt * 0.85);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA); }`
  });
  const rain = new THREE.LineSegments(rg, rainMat); rain.frustumCulled = false; rain.renderOrder = 6; rain.visible = false; scene.add(rain);

  // ---- rainbow (a big shader half-ring far behind the meadow)
  const rbMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, uniforms: { uA: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec2 vP;
      vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){ float r = (length(vP) - 250.0) / 24.0; float a = sin(clamp(r, 0.0, 1.0) * 3.14159); a *= a;
        vec3 c = mix(vec3(1.0), hue((1.0 - clamp(r, 0.0, 1.0)) * 0.78), 0.82);
        float ends = smoothstep(0.0, 0.18, vP.y / 250.0 + 0.06);
        gl_FragColor = vec4(c, a * uA * 0.5 * ends); }`
  });
  const rainbow = new THREE.Mesh(new THREE.RingGeometry(250, 274, 72, 1, 0, Math.PI), rbMat); rainbow.frustumCulled = false; rainbow.renderOrder = 4; rainbow.visible = false; scene.add(rainbow);

  const W = {
    kind: 'clear', timer: 50,
    v: { clear: 1, mist: 0, rain: 0, snow: 0 }, rainbow: 0, rbT: 0, rbBearing: 0,
    events: [], // moments to record: 'rain' | 'snow' | 'mist' | 'rainbow'
    force(kind, dur = 90) { W.kind = kind; W.timer = dur; },
    mist() { return W.v.mist; }, rainV() { return W.v.rain; }, snowV() { return W.v.snow; },
    pick(season, hour) {
      const r = Math.random();
      if (season === 3) return r < 0.4 ? 'snow' : r < 0.5 ? 'mist' : 'clear';
      if (hour > 4 && hour < 10 && r < 0.3) return 'mist';
      const rainP = season === 0 ? 0.34 : season === 2 ? 0.3 : 0.17;
      return r < 0.3 + rainP ? 'rain' : 'clear';
    },
    update(dt, t, o) { // o: {season, hour, night, cam}
      const wasRain = W.v.rain;
      W.timer -= dt;
      if (W.timer <= 0) {
        const k = W.pick(o.season, o.hour); W.kind = k; W.timer = k === 'clear' ? 70 + Math.random() * 90 : 55 + Math.random() * 70;
      }
      // winter has no rain, summer-ish skies have no snow
      if (o.season === 3 && W.kind === 'rain') W.kind = 'snow'; if (o.season !== 3 && W.kind === 'snow') W.kind = 'rain';
      for (const k of ['mist', 'rain', 'snow']) {
        const goal = W.kind === k ? 1 : 0, rate = goal ? 0.14 : 0.1;
        W.v[k] += Math.max(-rate * dt, Math.min(rate * dt, goal - W.v[k]));
        if (W.v[k] > 0.6 && !W.events.includes(k)) W.events.push(k);
      }
      W.v.clear = 1 - Math.max(W.v.mist * 0.4, W.v.rain, W.v.snow * 0.7);
      // rainbow after a daytime rain
      if (wasRain > 0.35 && W.v.rain <= 0.35 && o.night < 0.2 && o.season !== 3 && W.rbT <= 0 && W.rainbow < 0.05) { W.rbT = 1; W.rbBearing = Math.atan2(-60, -40); }
      if (W.rbT > 0) { W.rbT -= dt / 55; W.rainbow = Math.min(1, Math.sin(Math.max(0, W.rbT) * Math.PI) * 2.2); if (W.rbT <= 0) W.rainbow = 0; }
      if (o.night > 0.5 && W.rainbow > 0) W.rainbow = Math.max(0, W.rainbow - dt * 0.2);
      if (W.rainbow > 0.5 && !W.events.includes('rainbow')) W.events.push('rainbow');
      // visuals
      const rv = W.v.rain; rain.visible = rv > 0.02; rainMat.uniforms.uAmt.value = rv; rainMat.uniforms.uTime.value = t; rainMat.uniforms.uCam.value.copy(o.cam);
      rainMat.uniforms.uCol.value.setRGB(0.78, 0.86, 1).multiplyScalar(1 - 0.7 * o.night);
      rainbow.visible = W.rainbow > 0.01; rbMat.uniforms.uA.value = W.rainbow;
      if (rainbow.visible) { rainbow.position.set(o.cam.x + Math.sin(W.rbBearing) * 520, o.cam.y - 70, o.cam.z + Math.cos(W.rbBearing) * 520); rainbow.rotation.set(0, W.rbBearing + Math.PI, 0); }
    }
  };
  return W;
}
