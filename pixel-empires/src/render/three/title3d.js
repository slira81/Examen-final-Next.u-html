/* =====================================================================
   Fondo 3D animado de la pantalla de título: una isla con un pequeño
   asentamiento de la raza elegida, bosque, aldeanos que van y vienen,
   ganado, humo de chimeneas y la cámara orbitando despacio.
   No depende de la simulación (G puede ser null).
   ===================================================================== */
import * as THREE from 'three';
import { GLOBAL, withFog } from './shaderlib.js';
import { artDef, artGeometry, skeletonOf } from './art/index.js';
import { RigSet, StaticSet } from './sets.js';
import { Pose, animate, writeBones, bonesBegin, bonesRow, bonesEnd, BT, MAXP } from './rig.js';
import { initParticles, disposeParticles, emit, stepParticles } from './particles.js';
import { PE } from '../pixel/sprite.js';

const TT = { scene: null, cam: null, race: null, sets: [], walkers: [], statics: [], time: 0, poses: new Map() };
const R = 10;   // radio de la isla (casillas)
function hgt(x, z) {
  const d = Math.hypot(x, z) / R, n = Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.12 + Math.sin(x * 1.9 + z * 1.3) * 0.05;
  return d < 0.82 ? n * 0.6 : (n * 0.6) - (d - 0.82) * 4.2;
}
function buildIsland(scene) {
  const g = new THREE.PlaneGeometry(R * 2.6, R * 2.6, 96, 96).rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = hgt(x, z); pos.setY(i, y);
    const d = Math.hypot(x, z) / R, path = Math.abs(Math.hypot(x, z - 0.5) - 4.2) < 0.45 || (Math.abs(x) < 0.45 && z > 0);
    if (d > 0.86) c.set('#d8c48c'); else if (path) c.set('#9a7a52'); else c.set(Math.sin(x * 2.1) * Math.cos(z * 1.7) > 0.3 ? '#4f8a36' : '#5f9a40');
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, withFog(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'title_ground' })); m.receiveShadow = true; scene.add(m);
  const w = new THREE.Mesh(new THREE.CircleGeometry(80, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#2b6f9e', transparent: true, opacity: 0.92 }));
  w.position.y = -0.16; scene.add(w); TT.water = w;
  const shallow = new THREE.Mesh(new THREE.RingGeometry(R * 0.82, R * 1.1, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4fa8c8', transparent: true, opacity: 0.55 }));
  shallow.position.y = -0.15; scene.add(shallow);
}
function stat(key, kind, v, x, z, yaw, s = 1, tint = null, mask = 0) {
  const set = new StaticSet(TT.scene, artGeometry(key, kind, v), { cap: 1 });
  set.begin(); set.add(x, hgt(x, z), z, yaw, s, s, s, tint, mask, 99, Math.random()); set.end(); TT.sets.push(set);
  return set;
}
function build(race) {
  dispose();
  TT.race = race; TT.time = 0;
  const scene = TT.scene = new THREE.Scene(); scene.background = new THREE.Color('#9cc4dc');
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#7a6a50', 1.45));
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.2); sun.position.set(-9, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -14; sc.right = sc.top = 14; sc.far = 60; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  TT.cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 300);
  buildIsland(scene);
  const team = new THREE.Color(PE.TEAM_COLORS[0].hex);
  // asentamiento
  stat(race + '_tc', 'bld', 0, 0, -1.2, 0, 1, team);
  stat(race + '_house', 'bld', 0, -4.2, 0.8, 0.25, 1, team);
  stat(race + '_house', 'bld', 0, 3.9, 1.6, -0.3, 1, team);
  stat(race + '_house', 'bld', 0, -2.4, 3.6, 0.1, 1, team);
  stat(race + '_mill', 'bld', 0, 4.6, -2.6, -0.5, 1, team);
  stat(race + '_tower', 'bld', 0, -5.2, -3.4, 0.4, 1, team);
  stat(race + '_farm', 'bld', 0, 2.2, 5.2, 0.15, 1, team, 8);
  stat(race + '_barracks', 'bld', 0, -1.2, -5.6, 0.1, 1, team);
  // bosque y recursos
  const trees = race === 'elf' ? ['tree_elder', 'tree_birch', 'tree_oak'] : race === 'giant' ? ['tree_snowpine', 'tree_pine'] : race === 'orc' ? ['tree_pine', 'tree_dead', 'tree_oak'] : ['tree_oak', 'tree_pine', 'tree_birch'];
  for (let i = 0; i < 46; i++) {
    const a = i * 2.399, r = 6.2 + (i % 5) * 0.55 + Math.sin(i) * 0.3, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 2.5 && Math.abs(x) < 4.5) continue;
    const key = trees[i % trees.length], d = artDef(key, 'nature'), tint = d.tints ? new THREE.Color(d.tints[i % d.tints.length]) : null;
    stat(key, 'nature', i % (d.variants || 1), x, z, a, 0.9 + (i % 3) * 0.1, tint, race === 'giant' ? 2 : 0);
  }
  stat('mine_gold', 'nature', 0, 6.1, 2.4, 0.7, 1, null, 6); stat('mine_stone', 'nature', 0, -6.4, 2.9, 1.9, 1, null, 6);
  for (let i = 0; i < 4; i++) stat('bush_berry', 'nature', 0, -3.6 + i * 0.7, -2.4 + (i % 2) * 0.6, i, 1, null, 2);
  // unidades que caminan por el camino circular y otras quietas
  TT.walkers = [];
  const roles = ['worker', 'worker', 'inf', 'worker', 'ranged', 'cav', 'worker', 'pike'];
  roles.forEach((r, i) => TT.walkers.push({ key: race + '_' + r, ang: i / roles.length * Math.PI * 2, sp: (r === 'cav' ? 0.16 : 0.09) * (i % 2 ? 1 : -1), carry: r === 'worker' ? ['wood', 'gold', 'food', 'stone'][i % 4] : null }));
  TT.idle = [{ key: race + '_general', x: 0.9, z: 1.9, yaw: 0.2 }, { key: race + '_inf', x: -1.1, z: 1.7, yaw: -0.3 }, { key: race + '_special', x: 2.1, z: -0.6, yaw: 0.8 }];
  TT.sheep = [0, 1, 2, 3].map(i => ({ x: 1.4 + i * 0.5, z: 6.9 + (i % 2) * 0.4, yaw: i * 1.3 }));
  TT.rigs = new Map();
  initParticles(scene);
}
function rig(key) { let s = TT.rigs.get(key); if (!s) { s = new RigSet(TT.scene, artGeometry(key, 'unit'), { cap: 8 }); TT.rigs.set(key, s); } return s; }
function pose(key) { let p = TT.poses.get(key); if (!p) { p = new Pose(skeletonOf(key)); TT.poses.set(key, p); } return p; }
const ST = { anim: 'idle', f: 0, k: 0, t: 0, seed: 0, work: null, carry: null, stun: 0, dead: -1, wheel: 0 };
function drawRig(key, x, z, yaw, anim, f, seed, carry, team) {
  const def = artDef(key, 'unit');
  ST.anim = anim; ST.f = f; ST.t = TT.time; ST.seed = seed; ST.carry = carry; ST.work = carry ? (carry === 'wood' ? 'chop' : carry === 'food' ? 'gather' : 'mine') : null;
  if (anim === 'walk') ST.wheel = 0;
  const p = pose(key); animate(def, p, ST);
  const row = bonesRow(); writeBones(p, BT.data, row * MAXP * 12);
  rig(key).add(row, x, hgt(x, z), z, yaw, def.scale || 1, team);
}
/** Dibuja un frame del fondo del título con el renderizador dado. */
function titleFrame(renderer, dt, race) {
  if (!TT.scene || TT.race !== race) build(race);
  TT.time += dt;
  GLOBAL.uFogOn.value = 0; GLOBAL.uHaze.value = 0; GLOBAL.uFlash.value = 0; GLOBAL.uTime.value = TT.time; GLOBAL.uWind.value.set(0.8, 0.3);
  const t = TT.time, team = new THREE.Color(PE.TEAM_COLORS[0].hex), wild = new THREE.Color('#ffffff');
  for (const s of TT.rigs.values()) s.begin();
  bonesBegin();
  for (const w of TT.walkers) {
    w.ang += w.sp * dt; const r = 4.2, x = Math.cos(w.ang) * r, z = 0.5 + Math.sin(w.ang) * r;
    const yaw = Math.atan2(-Math.sin(w.ang) * Math.sign(w.sp), Math.cos(w.ang) * Math.sign(w.sp));
    drawRig(w.key, x, z, yaw, 'walk', (t * 10 * (w.sp > 0.12 || w.sp < -0.12 ? 1.6 : 1)) % 8, w.ang, w.carry, team);
  }
  for (const u of TT.idle) drawRig(u.key, u.x, u.z, u.yaw + Math.sin(t * 0.3) * 0.2, 'idle', 0, u.x, null, team);
  for (const s of TT.sheep) drawRig('animal_sheep', s.x, s.z, s.yaw + Math.sin(t * 0.2 + s.x) * 0.5, Math.sin(t * 0.7 + s.x * 3) > 0.6 ? 'work' : 'idle', (t * 4) % 4, s.x, null, wild);
  bonesEnd();
  for (const s of TT.rigs.values()) s.end();
  // humo de las casas y del centro
  if (Math.random() < dt * 3) { const p = [[-4.2, 0.8], [3.9, 1.6], [-2.4, 3.6], [0, -1.2]][Math.floor(Math.random() * 4)]; emit(1, { x: p[0] + 0.4, y: hgt(p[0], p[1]) + 1.5, z: p[1] - 0.3, vx: 0.2, vz: 0.1, vy: 0.45, vs: 0.08, life: [2.5, 3.5], size: [0.15, 0.6], c0: '#e4ded4', c1: '#b0aca6', alpha: 0.35, kind: 1, keep: true }); }
  stepParticles(dt);
  // cámara orbitando
  const a = t * 0.05 + 0.6, d = 19 + Math.sin(t * 0.13) * 1.5;
  TT.cam.position.set(Math.sin(a) * d, 8.5 + Math.sin(t * 0.21) * 0.6, Math.cos(a) * d); TT.cam.lookAt(0, 0.4, 0.6);
  TT.cam.aspect = innerWidth / innerHeight; TT.cam.updateProjectionMatrix();
  renderer.render(TT.scene, TT.cam);
}
function dispose() {
  if (!TT.scene) return;
  for (const s of TT.sets) s.dispose(); TT.sets = [];
  if (TT.rigs) for (const s of TT.rigs.values()) s.dispose();
  disposeParticles();
  TT.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh) { o.geometry.dispose(); } });
  TT.scene = null; TT.race = null;
}
export { titleFrame, dispose as disposeTitle };
