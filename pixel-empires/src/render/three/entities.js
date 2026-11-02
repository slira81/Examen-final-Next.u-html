/* =====================================================================
   Vistas de entidades (Fase 2: marcadores provisionales). Cada vista
   recibe el estado de la simulación y lo dibuja con InstancedMesh.
   Las fases 3–5 sustituyen estas vistas por los modelos definitivos
   manteniendo la misma interfaz: build(scene), update(dt, alpha), dispose().
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { T } from '../../data/data.js';
import { G, isAlly, isAnimal } from '../../sim/game.js';
import { exploredAt, visibleAt } from '../../world/world.js';
import { PE } from '../pixel/sprite.js';
import { teamColorIdx } from '../view.js';
import { heightAt, footprintHeight } from './terrain.js';
import { withFog } from './shaderlib.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
const TEAM_COL = () => PE.TEAM_COLORS.map(t => new THREE.Color(t.hex));

/** Conjunto de instancias reutilizable: begin(), add(pos, yaw, scale, color), end(). */
class Pool {
  constructor(scene, geo, mat, max, { shadow = true } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow; this.mesh.receiveShadow = true;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.max = max; this.n = 0; scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  add(x, y, z, yaw, sx, sy, sz, col) {
    if (this.n >= this.max) return;
    _p.set(x, y, z); _q.setFromAxisAngle(_up, yaw); _s.set(sx, sy, sz); _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(this.n, _m); if (col) this.mesh.setColorAt(this.n, col); this.n++;
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.dispose(); }
}
const lambert = (opts, key) => withFog(new THREE.MeshLambertMaterial(opts), { key });

/** Posición interpolada entre el paso anterior y el actual de la simulación. */
function lerpXY(e, alpha) {
  if (e._px === undefined) return [e.x, e.y];
  const dx = e.x - e._px, dy = e.y - e._py; if (dx * dx + dy * dy > 64 * 64) return [e.x, e.y];   // teletransporte (salir de un edificio)
  return [e._px + dx * alpha, e._py + dy * alpha];
}
const RACE_SCALE = { human: 1, elf: 1.08, dwarf: 0.82, orc: 1.05, giant: 1.85, neutral: 1, animal: 0.8 };

const VIEWS = { pools: [], teamCols: null };
function buildEntities(scene) {
  VIEWS.teamCols = TEAM_COL();
  const pawn = mergeGeometries([new THREE.CylinderGeometry(0.13, 0.17, 0.42, 7).translate(0, 0.21, 0), new THREE.SphereGeometry(0.11, 8, 6).translate(0, 0.53, 0)]);
  VIEWS.units = new Pool(scene, pawn, lambert({ color: 0xffffff }, 'u'), 3000);
  VIEWS.bldBody = new Pool(scene, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), lambert({ color: 0xffffff }, 'bb'), 1500);
  VIEWS.bldRoof = new Pool(scene, new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), lambert({ color: 0xffffff }, 'br'), 1500);
  VIEWS.trunk = new Pool(scene, new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5).translate(0, 0.25, 0), lambert({ color: 0x6b4a2c }, 'tt'), 12000);
  VIEWS.canopy = new Pool(scene, new THREE.ConeGeometry(0.36, 0.9, 6).translate(0, 0.85, 0), lambert({ color: 0xffffff, flatShading: true }, 'tc'), 12000);
  VIEWS.rock = new Pool(scene, new THREE.DodecahedronGeometry(0.32, 0).translate(0, 0.2, 0), lambert({ color: 0xffffff, flatShading: true }, 'rk'), 3000);
  VIEWS.bush = new Pool(scene, new THREE.IcosahedronGeometry(0.28, 0).translate(0, 0.22, 0), lambert({ color: 0xffffff, flatShading: true }, 'bu'), 2000);
  VIEWS.small = new Pool(scene, new THREE.BoxGeometry(0.3, 0.2, 0.22).translate(0, 0.1, 0), lambert({ color: 0xffffff }, 'sm'), 2000);
  VIEWS.proj = new Pool(scene, new THREE.BoxGeometry(0.28, 0.04, 0.04), lambert({ color: 0xffffff, emissive: 0x222222 }, 'pj'), 1500, { shadow: false });
  VIEWS.ring = new Pool(scene, new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), 600, { shadow: false });
  VIEWS.ghost = new Pool(scene, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }), 80, { shadow: false });
  VIEWS.ring.mesh.renderOrder = 3; VIEWS.ghost.mesh.renderOrder = 4;
  VIEWS.pools = [VIEWS.units, VIEWS.bldBody, VIEWS.bldRoof, VIEWS.trunk, VIEWS.canopy, VIEWS.rock, VIEWS.bush, VIEWS.small, VIEWS.proj, VIEWS.ring, VIEWS.ghost];
}
const BH = { tc: 1.5, house: 0.8, tower: 2.4, castle: 2.6, wall: 0.85, gate: 1, farm: 0.04, temple: 1.6, market: 1, mill: 1.4, bandit_camp: 0.7, goblin_hut: 0.7, shrine: 1.2, ruins: 0.4 };
const TREE_COL = { tree_pine: '#2f6b3a', tree_snowpine: '#4d7d68', tree_birch: '#8fbf5a', tree_palm: '#5ea24a', tree_willow: '#6f9f56', tree_dead: '#7a6450', tree_elder: '#3f8f78', tree_oak: '#4f9140' };
const MINE_COL = { gold: '#e7c13d', stone: '#a6a39e', iron: '#7b5d50', gems: '#a46cff' };
const C = {}; const col = h => C[h] || (C[h] = new THREE.Color(h));

function updateEntities(alpha, ctx) {
  const human = G.human, tc = VIEWS.teamCols, m = G.map;
  // unidades
  const U = VIEWS.units; U.begin();
  for (const u of G.units) {
    if (u.dead || u.inside || (!isAlly(u.team, human) && !visibleAt(u.x, u.y))) continue;
    const [x, y] = lerpXY(u, alpha), X = x / T, Z = y / T, s = (RACE_SCALE[u.def.race] || 1) * (u.def.role === 'cav' || u.def.role === 'siege' ? 1.25 : 1) * (u.def.unique ? 1.15 : 1);
    const c = isAnimal(u) ? col('#a88a64') : tc[teamColorIdx(u.team)];
    U.add(X, heightAt(X, Z), Z, u.face < 0 ? Math.PI : 0, s, s * (u.anim === 'walk' ? 1 + 0.04 * Math.sin(u.af * Math.PI) : 1), s, c);
  }
  U.end();
  // edificios
  const B = VIEWS.bldBody, Rf = VIEWS.bldRoof; B.begin(); Rf.begin();
  for (const b of G.blds) {
    if (b.dead || !exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) continue;
    const X = b.tx + b.fp / 2, Z = b.ty + b.fp / 2, y0 = footprintHeight(b.tx, b.ty, b.fp), w = b.fp * (b.def.wall || b.def.gate ? 1 : 0.86), hgt = (BH[b.type] || 1.2) * (b.done ? 1 : 0.15 + 0.85 * b.progress);
    const body = b.type === 'farm' ? col('#9a7a48') : b.team === 7 ? col('#9b968c') : col('#c9b48e');
    B.add(X, y0, Z, 0, w, hgt, w, body);
    if (!b.def.flat && !b.def.wall) Rf.add(X, y0 + hgt, Z, 0, w * 1.1, Math.max(0.3, b.fp * 0.35) * (b.done ? 1 : b.progress), w * 1.1, b.team < 7 ? tc[teamColorIdx(b.team)] : col('#7a6a5a'));
  }
  B.end(); Rf.end();
  // naturaleza y recursos (solo en el área cercana a la cámara)
  const Tr = VIEWS.trunk, Ca = VIEWS.canopy, Rk = VIEWS.rock, Bu = VIEWS.bush, Sm = VIEWS.small; Tr.begin(); Ca.begin(); Rk.begin(); Bu.begin(); Sm.begin();
  const { x0, y0, x1, y1 } = ctx.tileBox;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const r = m.res[ty * m.W + tx]; if (!r || r.dead || !exploredAt(tx, ty)) continue;
    const X = tx + 0.5, Z = ty + 0.5, h = heightAt(X, Z), j = ((tx * 73 + ty * 151) % 100) / 100;
    if (r.kind === 'tree') {
      const s = r.art === 'tree_elder' ? 1.7 : 0.85 + j * 0.35, sway = r.shake && G.time - r.shake < 0.12 ? 0.08 : 0;
      Tr.add(X + sway, h, Z, j * 6, s, s, s); Ca.add(X + sway, h, Z, j * 6, s * (r.art === 'tree_pine' || r.art === 'tree_snowpine' ? 0.9 : 1.25), s * (r.art === 'tree_dead' ? 0.4 : 1), s * (r.art === 'tree_pine' || r.art === 'tree_snowpine' ? 0.9 : 1.25), col(TREE_COL[r.art] || '#4f9140'));
    } else if (MINE_COL[r.kind]) Rk.add(X, h, Z, j * 6, 1 + j * 0.3, 0.8 + j * 0.4, 1 + j * 0.2, col(MINE_COL[r.kind]));
    else if (r.kind === 'berry') Bu.add(X, h, Z, j * 6, 1, 0.9, 1, col(r.amt > 0 ? '#3f7f3a' : '#56704a'));
  }
  for (const t of G.treasures) if (!t.taken && exploredAt(t.tx, t.ty)) Sm.add(t.tx + 0.5, heightAt(t.tx + 0.5, t.ty + 0.5), t.ty + 0.5, 0.3, 1, 1, 1, col(t.type === 'relic' ? '#9ff8f2' : '#d9a73a'));
  for (const r of G.resBy.carcass || []) if (!r.dead && exploredAt(r.tx, r.ty)) Sm.add(r.x / T, heightAt(r.x / T, r.y / T), r.y / T, 0, 1.4, 0.6, 1, col('#8a5a3a'));
  Tr.end(); Ca.end(); Rk.end(); Bu.end(); Sm.end();
  // proyectiles (con altura de arco)
  const P = VIEWS.proj; P.begin();
  for (const p of G.projs) {
    if (p.t < 0) continue; const [x, y] = lerpXY(p, alpha), X = x / T, Z = y / T;
    const k = Math.min(1, p.t / p.dur), lift = Math.sin(k * Math.PI) * p.arc / T + 0.4;
    P.add(X, heightAt(X, Z) + lift, Z, -(p.ang || 0), 1, 1, 1, col(p.art === 'proj_magic' ? '#7ff0ff' : p.art === 'proj_frost' ? '#bfeaff' : p.art === 'proj_lightning' ? '#fff27a' : '#e8dcc0'));
  }
  P.end();
  // anillos de selección
  const Rg = VIEWS.ring; Rg.begin();
  for (const e of G.sel) {
    if (e.dead || e.inside) continue;
    const cc = col(isAlly(e.team, human) ? '#8fff7a' : (e.team !== undefined && e.team !== 7) ? '#ff6a5a' : '#ffd23a');
    if (e.k === 'u') { const [x, y] = lerpXY(e, alpha), X = x / T, Z = y / T, r = 0.22 + e.def.size * 0.035; Rg.add(X, heightAt(X, Z) + 0.03, Z, 0, r, 1, r, cc); }
    else if (e.k === 'b') { const X = e.tx + e.fp / 2, Z = e.ty + e.fp / 2, r = e.fp * 0.72; Rg.add(X, footprintHeight(e.tx, e.ty, e.fp) + 0.04, Z, 0, r, 1, r, cc); }
    else if (e.k === 'r') { const X = e.tx + 0.5, Z = e.ty + 0.5; Rg.add(X, heightAt(X, Z) + 0.03, Z, 0, 0.55, 1, 0.55, cc); }
  }
  Rg.end();
  // fantasma de colocación
  const Gh = VIEWS.ghost; Gh.begin();
  if (ctx.placement) for (const g of ctx.placement) Gh.add(g.tx + g.fp / 2, footprintHeight(g.tx, g.ty, g.fp), g.ty + g.fp / 2, 0, g.fp * 0.98, g.h, g.fp * 0.98, col(g.ok ? '#4cff6a' : '#ff3a3a'));
  Gh.end();
}
function disposeEntities(scene) { for (const p of VIEWS.pools) p.dispose(scene); VIEWS.pools = []; }
export { VIEWS, Pool, lerpXY, buildEntities, updateEntities, disposeEntities, lambert, BH };
