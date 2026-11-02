/* =====================================================================
   Conjuntos de instancias para los modelos procedurales.
     RigSet     un modelo con esqueleto (unidades): matriz + equipo + fila de huesos
     StaticSet  un modelo estático (edificios, naturaleza, decoración)
   Crecen solos al superar su capacidad. Uso por frame:
     set.begin(); set.add(...); ...; set.end();
   ===================================================================== */
import * as THREE from 'three';
import { modelMaterial, depthMaterial } from './modelmat.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0);

class InstSet {
  constructor(scene, geo, kind, { cap = 16, shadow = true, receive = true, order = 0, transparent = false, opacity = 1 } = {}) {
    this.scene = scene; this.geo0 = geo; this.kind = kind; this.shadow = shadow; this.receive = receive; this.order = order;
    this.mat = modelMaterial(kind, transparent ? { transparent, opacity, key: 'tr' + opacity } : {});
    this.depth = depthMaterial(kind);
    this.n = 0; this.cap = 0; this.mesh = null; this.alloc(cap);
  }
  alloc(cap) {
    const old = this.mesh, geo = this.geo0.clone();
    geo.setAttribute('iTeam', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4).fill(1), 4));
    geo.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
    for (const k of ['iTeam', 'iData']) geo.attributes[k].setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.InstancedMesh(geo, this.mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.customDepthMaterial = this.depth; mesh.castShadow = this.shadow; mesh.receiveShadow = this.receive;
    mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = this.order;
    if (old) { mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, Math.min(old.instanceMatrix.array.length, cap * 16))); this.scene.remove(old); old.geometry.dispose(); old.dispose(); }
    this.mesh = mesh; this.cap = cap; this.team = geo.attributes.iTeam.array; this.data = geo.attributes.iData.array;
    this.scene.add(mesh);
  }
  begin() { this.n = 0; }
  /** Reserva una instancia y devuelve su índice (crece si hace falta). */
  slot() {
    if (this.n >= this.cap) {
      const keepT = this.team.slice(0, this.n * 4), keepD = this.data.slice(0, this.n * 4);
      this.alloc(this.cap * 2); this.team.set(keepT); this.data.set(keepD);
    }
    return this.n++;
  }
  /** Posición, giro (yaw, rad) y escala; color de equipo (THREE.Color o null); datos extra. */
  put(i, x, y, z, yaw, sx, sy, sz, col, mask = 0, clip = 99, seed = 0, flash = 0, tilt = null) {
    _p.set(x, y, z); _s.set(sx, sy, sz);
    if (tilt) { _e.set(tilt[0], yaw, tilt[1], 'YXZ'); _q.setFromEuler(_e); } else _q.setFromAxisAngle(_up, yaw);
    _m.compose(_p, _q, _s); _m.toArray(this.mesh.instanceMatrix.array, i * 16);
    const t = this.team, d = this.data;
    if (col) { t[i * 4] = col.r; t[i * 4 + 1] = col.g; t[i * 4 + 2] = col.b; } else { t[i * 4] = t[i * 4 + 1] = t[i * 4 + 2] = 1; }
    d[i * 4] = mask; d[i * 4 + 1] = clip; d[i * 4 + 2] = seed; d[i * 4 + 3] = flash;
  }
  end() {
    const m = this.mesh; m.count = this.n;
    if (!this.n) return;
    m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, this.n * 16); m.instanceMatrix.needsUpdate = true;
    const g = m.geometry.attributes;
    for (const [k, w] of [['iTeam', 4], ['iData', 4]]) if (g[k]) { g[k].clearUpdateRanges(); g[k].addUpdateRange(0, this.n * w); g[k].needsUpdate = true; }
  }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.dispose(); this.geo0.dispose(); }
}
class RigSet extends InstSet {
  constructor(scene, geo, opts) { super(scene, geo, 'rig', opts); }
  add(row, x, y, z, yaw, s, col, flash = 0, tilt = null) { const i = this.slot(); this.put(i, x, y, z, yaw, s, s, s, col, 0, 99, 0, flash, tilt); this.team[i * 4 + 3] = row; return i; }
}
class StaticSet extends InstSet {
  constructor(scene, geo, opts) { super(scene, geo, 'static', opts); }
  add(x, y, z, yaw, sx, sy, sz, col, mask = 0, clip = 99, seed = 0, flash = 0, tilt = null) { const i = this.slot(); this.put(i, x, y, z, yaw, sx, sy, sz, col, mask, clip, seed, flash, tilt); return i; }
}
export { InstSet, RigSet, StaticSet };
