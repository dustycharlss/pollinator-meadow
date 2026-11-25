import * as THREE from 'three';
// t23u G: 3D home/target indicator. 'ring' = a glowing pip that orbits the carry hoop around the character;
// 'arrow' = a bigger ground arrow just ahead of the character. Both point at the current target (home / food / guide).
export function createHomeInd(scene) {
  const mat = () => new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
  const tri = new THREE.Shape(); tri.moveTo(0, 0.42); tri.lineTo(0.34, -0.2); tri.lineTo(0, -0.06); tri.lineTo(-0.34, -0.2); tri.closePath();
  const gTri = new THREE.ShapeGeometry(tri); gTri.rotateX(-Math.PI / 2); // tip points to -z... we orient with rotation.y below
  const pip = new THREE.Group(); const pm = new THREE.Mesh(gTri, mat()); pip.add(pm);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2), mat()); halo.material.opacity = 0.22; halo.position.y = -0.01; pip.add(halo);
  const ar = new THREE.Shape(); ar.moveTo(0, 1.1); ar.lineTo(0.62, 0.25); ar.lineTo(0.24, 0.25); ar.lineTo(0.24, -0.75); ar.lineTo(-0.24, -0.75); ar.lineTo(-0.24, 0.25); ar.lineTo(-0.62, 0.25); ar.closePath();
  const gAr = new THREE.ShapeGeometry(ar); gAr.rotateX(-Math.PI / 2);
  const arrow = new THREE.Group(); const am = new THREE.Mesh(gAr, mat()); arrow.add(am);
  const edge = new THREE.Mesh(gAr.clone().scale(1.22, 1, 1.18), mat()); edge.material.color.set(0x1a2a20); edge.material.opacity = 0.45; edge.position.y = -0.01; arrow.add(edge);
  for (const o of [pip, arrow]) { o.visible = false; o.renderOrder = 4; o.traverse(m => { m.frustumCulled = false; m.renderOrder = 4; }); scene.add(o); }
  // l20k Arrow assist: one shared overhead chevron (fill + dark edge = 2 draws, MeshBasic, no shadows).
  const assist = new THREE.Group();
  const asFill = new THREE.Mesh(gAr, mat());
  const asEdge = new THREE.Mesh(gAr.clone().scale(1.22, 1, 1.18), mat());
  asEdge.material.color.set(0x1a2a20); asEdge.material.opacity = 0.6; asEdge.position.y = -0.012;
  // FrontSide: DoubleSide was 2 draws per mesh (4 total). Chevrons face +Y after rotateX.
  for (const m of [asFill, asEdge]) {
    m.material.side = THREE.FrontSide;
    m.userData.noCast = true;
    m.userData.noPastel = true;
  }
  assist.add(asEdge, asFill);
  assist.visible = false; assist.renderOrder = 6;
  assist.traverse(m => { m.frustumCulled = false; m.renderOrder = 6; m.castShadow = false; m.receiveShadow = false; });
  scene.add(assist);
  let fade = 0, aFade = 0;
  return {
    pip, arrow, assist,
    assistOn: () => assist.visible && aFade > 0.02,
    update({ x, y, z, R, ang, show, color, mode, t, dt, far }) {
      fade += ((show ? 1 : 0) - fade) * Math.min(1, dt * 6);
      const ringOn = mode !== 'arrow', o = ringOn ? pip : arrow, other = ringOn ? arrow : pip; other.visible = false;
      o.visible = fade > 0.02; if (!o.visible) return;
      // ShapeGeometry tip is +y -> after rotateX(-90deg) tip is at -z. rotation.y = ang + PI makes the tip face (sin ang, cos ang).
      const d = ringOn ? R + 0.42 + 0.08 * Math.sin(t * 5) : R + 1.3 + 0.25 * Math.sin(t * 4);
      o.position.set(x + Math.sin(ang) * d, y + 0.12, z + Math.cos(ang) * d); o.rotation.y = ang + Math.PI;
      const s = ringOn ? 1 + 0.25 * Math.min(1, far / 60) : 1.1;
      o.scale.setScalar(s);
      o.traverse(m => { if (m.material && m !== halo && m !== edge) { m.material.color.set(color); m.material.opacity = 0.92 * fade; } });
      halo.material.opacity = 0.22 * fade; edge.material.opacity = 0.45 * fade;
    },
    updateAssist({ x, y, z, ang, show, color, t, dt, bob = true }) {
      aFade += ((show ? 1 : 0) - aFade) * Math.min(1, dt * 6);
      assist.visible = aFade > 0.02; if (!assist.visible) return;
      const lift = bob ? 0.1 * Math.sin(t * 3.2) : 0;
      assist.position.set(x, y + lift, z);
      assist.rotation.y = ang + Math.PI;
      assist.scale.setScalar(0.58);
      asFill.material.color.set(color || '#ffd23f');
      asFill.material.opacity = 0.95 * aFade;
      asEdge.material.opacity = 0.6 * aFade;
    },
    hide() { pip.visible = arrow.visible = assist.visible = false; fade = 0; aFade = 0; },
  };
}
