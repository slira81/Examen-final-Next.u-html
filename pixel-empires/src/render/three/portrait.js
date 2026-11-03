/* =====================================================================
   Retratos e iconos renderizados desde los modelos 3D (unidades,
   edificios, recursos). Usa un renderizador pequeño propio y copia el
   resultado a un canvas 2D (cacheado).
   ===================================================================== */
import * as THREE from 'three';
import { PE } from '../pixel/sprite.js';
import { GLOBAL } from './shaderlib.js';
import { artDef, artGeometry, skeletonOf, hasArt } from './art/index.js';
import { RigSet, StaticSet } from './sets.js';
import { Pose, animate, writeBones, bonesRow, BT, MAXP } from './rig.js';

const PR = { scene: null, cam: null, r: null, cache: new Map(), size: 0 };
function setup(size) {
  if (!PR.r) {
    PR.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    PR.r.outputColorSpace = THREE.SRGBColorSpace; PR.r.toneMapping = THREE.ACESFilmicToneMapping; PR.r.toneMappingExposure = 1.1; PR.r.setPixelRatio(1);
  }
  if (PR.size !== size) { PR.r.setSize(size, size, false); PR.size = size; }
  if (PR.scene) return;
  PR.scene = new THREE.Scene();
  PR.scene.add(new THREE.HemisphereLight('#e6efff', '#7a6a50', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d2', 1.9); sun.position.set(-2, 4, 3); PR.scene.add(sun);
  const rim = new THREE.DirectionalLight('#b8d0ff', 0.7); rim.position.set(3, 2, -3); PR.scene.add(rim);
  PR.cam = new THREE.PerspectiveCamera(24, 1, 0.05, 100);
}
const ST = { anim: 'idle', f: 0, k: 0, t: 0.9, seed: 0, work: null, carry: null, stun: 0, dead: -1, wheel: 0 };
/**
 * Canvas con el retrato de un modelo. kind: 'units' | 'buildings' | 'nature'.
 * team: índice de color (0..7). out: tamaño final en px (se renderiza al doble y se reduce).
 */
function modelIcon(_renderer, kind, key, team = 0, out = 64) {
  const ck = kind + ':' + key + ':' + team + ':' + out;
  if (PR.cache.has(ck)) return PR.cache.get(ck);
  if (kind === 'nature' && !hasArt(key)) return null;   // sin modelo propio: la interfaz usa el icono pixel
  const size = out * 2; setup(size); const R = PR.r;
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
      set.add(0, 0, 0, kind === 'buildings' || artDef(key, k2).icon ? 0 : 0.5, 1, 1, 1, tint, /_gate$/.test(key) ? 2 : /_farm$/.test(key) ? 8 : /^bush_berry|^treasure_chest/.test(key) ? 2 : /^mine_/.test(key) ? 6 : 0); set.end();
      box = geo.boundingBox.clone();
    }
    // encuadre: vista 3/4 desde arriba a la derecha
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
    const flat = kind === 'nature' && artDef(key, 'nature').icon;   // iconos de comandos: casi de frente
    const dir = kind === 'units' ? new THREE.Vector3(0.35, 0.42, 1).normalize() : flat ? new THREE.Vector3(0.18, 0.32, 1).normalize() : new THREE.Vector3(0.55, 0.85, 1).normalize();
    const dist = r / Math.sin(THREE.MathUtils.degToRad(12)) * (kind === 'units' ? 0.86 : flat ? 0.8 : 0.95);
    PR.cam.position.copy(c).addScaledVector(dir, dist); PR.cam.lookAt(c); PR.cam.near = dist * 0.2; PR.cam.far = dist * 3; PR.cam.updateProjectionMatrix();
    R.setClearColor(0x000000, 0); R.clear(); R.render(PR.scene, PR.cam);
  } finally {
    GLOBAL.uFogOn.value = saved.fog; GLOBAL.uHaze.value = saved.haze; GLOBAL.uFlash.value = saved.flash;
    if (set) set.dispose();
  }
  // reducir a la mitad con suavizado
  const cv = document.createElement('canvas'); cv.width = cv.height = out;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, size, size, 0, 0, out, out);
  cv.dataset.r3d = '1';
  PR.cache.set(ck, cv);
  return cv;
}
/**
 * Frame animado de una unidad dibujado en un canvas (galería). anim: 'idle' | 'walk' | 'attack'.
 * Las unidades se renderizan cada vez (sin caché); edificios y naturaleza usan el retrato fijo.
 */
const GAL = { sets: new Map(), poses: new Map() };
function modelFrameTo(cv, kind, key, team, anim, t) {
  if (kind !== 'units') { const ic = modelIcon(null, kind, key, team, 96); if (ic && !cv.dataset.done) { cv.width = cv.height = 96; cv.getContext('2d').drawImage(ic, 0, 0); cv.dataset.done = '1'; cv.dataset.r3d = '1'; } return !!ic; }
  const size = 192; setup(size); const R = PR.r;
  let set = GAL.sets.get(key), pose = GAL.poses.get(key);
  if (!set) { set = new RigSet(PR.scene, artGeometry(key, 'unit'), { cap: 1, shadow: false }); GAL.sets.set(key, set); pose = new Pose(skeletonOf(key)); GAL.poses.set(key, pose); }
  for (const [k, s2] of GAL.sets) s2.mesh.visible = k === key;
  const def = artDef(key, 'unit'), st = { anim, f: (t * 10) % 8, k: (t % 1.2) / 1.2, t, seed: 0, work: null, carry: null, stun: 0, dead: -1, wheel: -(t * 10 / 8) * Math.PI * 2 };
  if (anim !== 'walk') st.wheel = 0;
  animate(def, pose, st); const row = bonesRow(); writeBones(pose, BT.data, row * MAXP * 12); BT.tex.needsUpdate = true;
  set.begin(); set.add(row, 0, 0, 0, 0.55, 1, new THREE.Color(PE.TEAM_COLORS[team] ? PE.TEAM_COLORS[team].hex : '#3a6ad8')); set.end();
  const box = set.geo0.boundingBox, c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = new THREE.Vector3(0.35, 0.42, 1).normalize(), dist = r / Math.sin(THREE.MathUtils.degToRad(12)) * 0.95;
  PR.cam.position.copy(c).addScaledVector(dir, dist); PR.cam.lookAt(c); PR.cam.near = dist * 0.2; PR.cam.far = dist * 3; PR.cam.updateProjectionMatrix();
  const saved = GLOBAL.uFogOn.value; GLOBAL.uFogOn.value = 0;
  R.setClearColor(0x000000, 0); R.clear(); R.render(PR.scene, PR.cam);
  GLOBAL.uFogOn.value = saved; set.mesh.visible = false;
  if (cv.width !== 96) { cv.width = cv.height = 96; } cv.dataset.r3d = '1';
  const x = cv.getContext('2d'); x.clearRect(0, 0, 96, 96); x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, size, size, 0, 0, 96, 96);
  return true;
}
export { modelIcon, modelFrameTo };
