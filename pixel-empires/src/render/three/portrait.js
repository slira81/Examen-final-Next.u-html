/* =====================================================================
   Retratos e iconos renderizados desde los modelos 3D (unidades,
   edificios, recursos). Usa el renderizador principal sobre un destino
   fuera de pantalla y copia el resultado a un canvas 2D (cacheado).
   ===================================================================== */
import * as THREE from 'three';
import { PE } from '../pixel/sprite.js';
import { GLOBAL } from './shaderlib.js';
import { artDef, artGeometry, skeletonOf } from './art/index.js';
import { RigSet, StaticSet } from './sets.js';
import { Pose, animate, writeBones, bonesRow, BT, MAXP } from './rig.js';

const PR = { scene: null, cam: null, rt: null, buf: null, cache: new Map(), size: 0 };
function setup(renderer, size) {
  if (PR.scene && PR.size === size) return;
  PR.scene = new THREE.Scene();
  PR.scene.add(new THREE.HemisphereLight('#e6efff', '#7a6a50', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d2', 1.9); sun.position.set(-2, 4, 3); PR.scene.add(sun);
  const rim = new THREE.DirectionalLight('#b8d0ff', 0.7); rim.position.set(3, 2, -3); PR.scene.add(rim);
  PR.cam = new THREE.PerspectiveCamera(24, 1, 0.05, 100);
  if (PR.rt) PR.rt.dispose();
  PR.rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 }); PR.rt.texture.colorSpace = THREE.SRGBColorSpace;
  PR.buf = new Uint8Array(size * size * 4); PR.size = size;
}
const ST = { anim: 'idle', f: 0, k: 0, t: 0.9, seed: 0, work: null, carry: null, stun: 0, dead: -1, wheel: 0 };
/**
 * Canvas con el retrato de un modelo. kind: 'units' | 'buildings' | 'nature'.
 * team: índice de color (0..7). out: tamaño final en px (se renderiza al doble y se reduce).
 */
function modelIcon(renderer, kind, key, team = 0, out = 64) {
  const ck = kind + ':' + key + ':' + team + ':' + out;
  if (PR.cache.has(ck)) return PR.cache.get(ck);
  const size = out * 2; setup(renderer, size);
  const col = new THREE.Color(PE.TEAM_COLORS[team] ? PE.TEAM_COLORS[team].hex : '#3a6ad8');
  let set, box;
  const saved = { fog: GLOBAL.uFogOn.value, haze: GLOBAL.uHaze.value, flash: GLOBAL.uFlash.value };
  GLOBAL.uFogOn.value = 0; GLOBAL.uHaze.value = 0; GLOBAL.uFlash.value = 0;
  try {
    if (kind === 'units') {
      const def = artDef(key, 'unit'), geo = artGeometry(key, 'unit'), pose = new Pose(skeletonOf(key));
      animate(def, pose, ST); const row = bonesRow(); writeBones(pose, BT.data, row * MAXP * 12); BT.tex.needsUpdate = true;
      set = new RigSet(PR.scene, geo, { cap: 1, shadow: false }); set.begin(); set.add(row, 0, 0, 0, 0.55, 1, col); set.end();
      box = geo.boundingBox.clone();
    } else {
      const k2 = kind === 'buildings' ? 'bld' : 'nature', geo = artGeometry(key, k2), d = artDef(key, k2);
      const tint = d.tints ? new THREE.Color(d.tints[0]) : col;
      set = new StaticSet(PR.scene, geo, { cap: 1, shadow: false }); set.begin();
      set.add(0, 0, 0, kind === 'buildings' ? 0 : 0.5, 1, 1, 1, tint, /_gate$/.test(key) ? 2 : /_farm$/.test(key) ? 8 : /^bush_berry|^treasure_chest/.test(key) ? 2 : /^mine_/.test(key) ? 6 : 0); set.end();
      box = geo.boundingBox.clone();
    }
    // encuadre: vista 3/4 desde arriba a la derecha
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
    const dir = kind === 'units' ? new THREE.Vector3(0.35, 0.42, 1).normalize() : new THREE.Vector3(0.55, 0.85, 1).normalize();
    const dist = r / Math.sin(THREE.MathUtils.degToRad(12)) * (kind === 'units' ? 0.86 : 0.95);
    PR.cam.position.copy(c).addScaledVector(dir, dist); PR.cam.lookAt(c); PR.cam.near = dist * 0.2; PR.cam.far = dist * 3; PR.cam.updateProjectionMatrix();
    const prevT = renderer.getRenderTarget(), prevClear = renderer.getClearAlpha(), prevSM = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(PR.rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(PR.scene, PR.cam);
    renderer.readRenderTargetPixels(PR.rt, 0, 0, size, size, PR.buf);
    renderer.setRenderTarget(prevT); renderer.setClearAlpha(prevClear); renderer.shadowMap.autoUpdate = prevSM;
  } finally {
    GLOBAL.uFogOn.value = saved.fog; GLOBAL.uHaze.value = saved.haze; GLOBAL.uFlash.value = saved.flash;
    if (set) set.dispose();
  }
  // copiar (invertido en Y) y reducir a la mitad con suavizado
  const big = document.createElement('canvas'); big.width = big.height = size;
  const img = big.getContext('2d').createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(PR.buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  big.getContext('2d').putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = cv.height = out;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(big, 0, 0, out, out);
  cv.dataset.r3d = '1';
  PR.cache.set(ck, cv);
  return cv;
}
export { modelIcon };
