// Step 5: one 1024² icon sheet + 3 instanced billboard draws
// (depth-tested icons, depth-off badges/labels, additive halos).
// A 4th additive depth-off mesh is used only while a focused goal halo
// must shine through walls (count 0 / hidden otherwise).
import * as THREE from 'three';

const SHEET = 1024;
const CAP0 = 128;
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _wp = new THREE.Vector3();
const _ndc = new THREE.Vector3();

function worldVisible(o) {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

function inScene(o) {
  for (let n = o; n; n = n.parent) if (n.isScene) return true;
  return false;
}

export function createIconSheet(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SHEET;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, SHEET, SHEET);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.anisotropy = 2;
  tex.premultiplyAlpha = false;

  const slots = new Map();
  let cx = 0, cy = 0, rowH = 128;

  function alloc(key, w, h) {
    if (slots.has(key)) return slots.get(key);
    if (cx + w > SHEET) { cx = 0; cy += rowH; rowH = h; }
    if (h > rowH) rowH = h;
    if (cy + h > SHEET) {
      console.warn('act3 icon sheet full, skipping', key);
      return { x: 0, y: 0, w: 0, h: 0, u: 0, v: 0, su: 0, sv: 0 };
    }
    const x = cx, y = cy;
    cx += w;
    // CanvasTexture flipY=true: uv (0,0) is the bottom of the canvas.
    const slot = { x, y, w, h, u: x / SHEET, v: 1 - (y + h) / SHEET, su: w / SHEET, sv: h / SHEET };
    slots.set(key, slot);
    return slot;
  }

  function packDisc(key = 'badge-back') {
    if (slots.has(key)) return slots.get(key);
    const s = alloc(key, 128, 128);
    g.save();
    g.beginPath();
    g.arc(s.x + 64, s.y + 64, 60, 0, Math.PI * 2);
    g.fillStyle = 'rgba(22, 18, 14, 0.96)';
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(10, 8, 6, 1)';
    g.stroke();
    g.restore();
    tex.needsUpdate = true;
    return s;
  }

  function packHalo() {
    if (slots.has('halo')) return slots.get('halo');
    const s = alloc('halo', 128, 128);
    const gr = g.createRadialGradient(s.x + 64, s.y + 64, 4, s.x + 64, s.y + 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(s.x, s.y, s.w, s.h);
    tex.needsUpdate = true;
    return s;
  }

  function packEmoji(e) {
    const key = 'em:' + e;
    if (slots.has(key)) return slots.get(key);
    const s = alloc(key, 128, 128);
    g.font = '96px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, s.x + 64, s.y + 70);
    tex.needsUpdate = true;
    return s;
  }

  function packText(key, text) {
    const k = 'tx:' + key;
    let s = slots.get(k);
    if (!s) s = alloc(k, 256, 64);
    g.clearRect(s.x, s.y, s.w, s.h);
    g.font = 'bold 44px ui-rounded, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f4efe4';
    g.fillText(text, s.x + 128, s.y + 34);
    tex.needsUpdate = true;
    return s;
  }

  function packImage(key, url, size = 128) {
    if (slots.has(key)) return slots.get(key);
    const s = alloc(key, size, size);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      g.clearRect(s.x, s.y, s.w, s.h);
      g.drawImage(img, s.x, s.y, s.w, s.h);
      tex.needsUpdate = true;
    };
    img.src = url;
    return s;
  }

  packHalo();

  const recs = [];
  const layers = {};

  function patchBillboard(mat) {
    mat.customProgramCacheKey = () => 'act3-icon-billboard';
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec4 aUvRect;\nattribute float aOpacity;\nvarying float vIconOp;',
        )
        .replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\n#ifdef USE_MAP\n	vMapUv = aUvRect.xy + vMapUv * aUvRect.zw;\n#endif\nvIconOp = aOpacity;',
        )
        .replace(
          '#include <project_vertex>',
          `
          vec3 iconPos = vec3(0.0);
          float iconSx = 1.0, iconSy = 1.0;
#ifdef USE_INSTANCING
          iconPos = instanceMatrix[3].xyz;
          iconSx = length(instanceMatrix[0].xyz);
          iconSy = length(instanceMatrix[1].xyz);
#endif
          vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 iconWorld = iconPos + camRight * (transformed.x * iconSx) + camUp * (transformed.y * iconSy);
          vec4 mvPosition = viewMatrix * vec4(iconWorld, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vec4 worldPosition = vec4(iconWorld, 1.0);
          `,
        )
        .replace(
          '#include <worldpos_vertex>',
          '/* worldPosition set in project_vertex */',
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vIconOp;')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vIconOp;');
    };
    return mat;
  }

  function makeLayer(name, { depthTest, blending, renderOrder }) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const aUv = new THREE.InstancedBufferAttribute(new Float32Array(CAP0 * 4), 4);
    const aOp = new THREE.InstancedBufferAttribute(new Float32Array(CAP0), 1);
    geo.setAttribute('aUvRect', aUv);
    geo.setAttribute('aOpacity', aOp);
    const mat = patchBillboard(new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending,
      fog: true,
      toneMapped: true,
      side: THREE.DoubleSide,
    }));
    const im = new THREE.InstancedMesh(geo, mat, CAP0);
    im.count = 0;
    im.visible = false;
    im.frustumCulled = false;
    im.castShadow = false;
    im.receiveShadow = false;
    im.renderOrder = renderOrder;
    im.name = name;
    im.userData.noPastel = true;
    im.userData.noMerge = true;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP0 * 3), 3);
    im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    return { name, im, aUv, aOp, cap: CAP0 };
  }

  layers.depth = makeLayer('act3IconDepth', { depthTest: true, blending: THREE.NormalBlending, renderOrder: 9 });
  layers.overlay = makeLayer('act3IconOverlay', { depthTest: false, blending: THREE.NormalBlending, renderOrder: 10 });
  layers.halo = makeLayer('act3IconHalo', { depthTest: true, blending: THREE.AdditiveBlending, renderOrder: 5 });
  layers.haloFocus = makeLayer('act3IconHaloFocus', { depthTest: false, blending: THREE.AdditiveBlending, renderOrder: 6 });

  function layerOf(rec) {
    const mat = rec.obj && rec.obj.material;
    const additive = rec.additive || (mat && mat.blending === THREE.AdditiveBlending);
    const dt = mat && mat.depthTest;
    if (additive) return (dt === false) ? 'haloFocus' : 'halo';
    if (mat && mat.depthTest === false) return 'overlay';
    return rec.layer || 'depth';
  }

  function slotOf(rec) {
    const mat = rec.obj && rec.obj.material;
    const key = (mat && mat.userData && mat.userData.iconKey) || rec.key;
    return (key && slots.get(key)) || rec.slot || null;
  }

  function make(opts = {}) {
    const o = new THREE.Object3D();
    o.userData.noPastel = true;
    o.userData.isIcon = true;
    const mat = opts.material || {
      opacity: opts.opacity != null ? opts.opacity : 1,
      depthTest: opts.depthTest !== false,
      color: new THREE.Color(opts.color != null ? opts.color : 0xffffff),
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      userData: { iconKey: opts.key },
    };
    if (opts.key && mat.userData && !mat.userData.iconKey) mat.userData.iconKey = opts.key;
    if (mat.color && !mat.color.isColor) mat.color = new THREE.Color(mat.color);
    if (!mat.color) mat.color = new THREE.Color(0xffffff);
    o.material = mat;
    const s = opts.size != null ? opts.size : 1;
    o.scale.set(s, s, 1);
    o.renderOrder = opts.renderOrder != null ? opts.renderOrder : 9;
    const rec = {
      obj: o,
      key: opts.key,
      layer: opts.layer,
      additive: !!opts.additive,
      clamp: !!opts.clamp,
      baseS: s,
    };
    o.userData.iconRec = rec;
    recs.push(rec);
    return o;
  }

  function reset() {
    // Drop handles from the last level. Meshes stay on the scene (not in the
    // zone group) so clear() cannot dispose their geometry.
    recs.length = 0;
    for (const L of Object.values(layers)) {
      L.im.count = 0;
      L.im.visible = false;
    }
  }

  function compact() {
    for (let i = recs.length - 1; i >= 0; i--) {
      const o = recs[i].obj;
      if (!o || !inScene(o)) recs.splice(i, 1);
    }
  }

  function sync(cam) {
    compact();
    const buckets = { depth: [], overlay: [], halo: [], haloFocus: [] };
    for (const rec of recs) {
      const o = rec.obj;
      if (!o || !inScene(o) || !worldVisible(o)) continue;
      const slot = slotOf(rec);
      if (!slot || !slot.su) continue;
      let opacity = (o.material && o.material.opacity != null) ? o.material.opacity : 1;
      if (opacity <= 0.001) continue;
      o.updateWorldMatrix(true, false);
      o.matrixWorld.decompose(_pos, _quat, _scl);
      let sx = Math.abs(_scl.x), sy = Math.abs(_scl.y);
      if (rec.clamp && cam) {
        const d = cam.position.distanceTo(_pos);
        _ndc.copy(_pos).project(cam);
        const atBottom = _ndc.y < -0.42, tooClose = d < 2.2;
        if (tooClose || atBottom) opacity = 0;
        const sc = THREE.MathUtils.clamp(rec.baseS * (d / 12), 0.28, 0.7);
        sx = sc; sy = sc;
        if (opacity <= 0.001) continue;
      }
      const col = (o.material && o.material.color) ? o.material.color : null;
      buckets[layerOf(rec)].push({
        x: _pos.x, y: _pos.y, z: _pos.z, sx, sy,
        u: slot.u, v: slot.v, su: slot.su, sv: slot.sv,
        opacity,
        r: col ? col.r : 1, g: col ? col.g : 1, b: col ? col.b : 1,
      });
    }
    for (const [name, L] of Object.entries(layers)) {
      const list = buckets[name] || [];
      const n = list.length;
      if (n > L.cap) {
        // grow attributes in place (InstancedMesh.instanceMatrix is already cap-sized;
        // rare to exceed 128 world icons). Extra instances are dropped.
      }
      const use = Math.min(n, L.cap);
      for (let i = 0; i < use; i++) {
        const it = list[i];
        _mat.makeScale(it.sx, it.sy, 1);
        _mat.setPosition(it.x, it.y, it.z);
        L.im.setMatrixAt(i, _mat);
        L.im.instanceColor.setXYZ(i, it.r, it.g, it.b);
        L.aUv.setXYZW(i, it.u, it.v, it.su, it.sv);
        L.aOp.setX(i, it.opacity);
      }
      L.im.count = use;
      L.im.visible = use > 0;
      if (use) {
        L.im.instanceMatrix.needsUpdate = true;
        L.im.instanceColor.needsUpdate = true;
        L.aUv.needsUpdate = true;
        L.aOp.needsUpdate = true;
      }
    }
  }

  function warm() {
    // One dummy instance on each layer so the billboard programs compile
    // during ready-wait, not after GO.
    _mat.makeScale(0.001, 0.001, 1);
    _mat.setPosition(0, -999, 0);
    const slot = slots.get('halo') || packHalo();
    for (const L of Object.values(layers)) {
      L.im.setMatrixAt(0, _mat);
      L.im.instanceColor.setXYZ(0, 1, 1, 1);
      L.aUv.setXYZW(0, slot.u, slot.v, slot.su, slot.sv);
      L.aOp.setX(0, 0);
      L.im.instanceMatrix.needsUpdate = true;
      L.im.instanceColor.needsUpdate = true;
      L.aUv.needsUpdate = true;
      L.aOp.needsUpdate = true;
      L.im.count = 1;
      L.im.visible = true;
    }
    return () => {
      for (const L of Object.values(layers)) { L.im.count = 0; L.im.visible = false; }
    };
  }

  return { packHalo, packDisc, packEmoji, packText, packImage, make, reset, sync, warm, texture: tex, slots };
}
