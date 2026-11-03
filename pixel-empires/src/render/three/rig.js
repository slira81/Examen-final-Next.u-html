/* =====================================================================
   Rig de unidades: esqueletos de piezas rígidas animadas por código.
   Cada modelo se modela en pose de descanso (mirando a +Z, pies en y=0)
   y asigna cada primitiva a una pieza. La CPU calcula una matriz por
   pieza y por instancia y la sube a una textura global (BONES); el
   shader la aplica según aPart. Una pieza con escala 0 desaparece
   (herramientas, carga, arma lanzada).
   ===================================================================== */
import * as THREE from 'three';
import { BONES } from './modelmat.js';

const MAXP = 24;                 // piezas máximas por modelo (3 texels cada una)
const TW = MAXP * 3;

// ------------------------------------------------------------ esqueletos
// [nombre, padre, pivote por defecto]  (alturas para un humano de ~0.62)
const HUMANOID = [
  ['root', null, [0, 0, 0]], ['body', 'root', [0, 0.27, 0]], ['head', 'body', [0, 0.46, 0]],
  ['armL', 'body', [-0.105, 0.43, 0]], ['armR', 'body', [0.105, 0.43, 0]],
  ['handL', 'armL', [-0.115, 0.25, 0.02]], ['handR', 'armR', [0.115, 0.25, 0.02]],
  ['legL', 'root', [-0.05, 0.25, 0]], ['legR', 'root', [0.05, 0.25, 0]],
  ['cape', 'body', [0, 0.45, -0.06]], ['back', 'body', [0, 0.36, -0.07]],
  ['toolAxe', 'handR', null], ['toolPick', 'handR', null], ['toolHammer', 'handR', null], ['toolHoe', 'handR', null], ['toolBasket', 'handL', null],
  ['carryWood', 'body', [0, 0.4, -0.08]], ['carryFood', 'body', [0, 0.4, -0.08]], ['carryGold', 'body', [0, 0.4, -0.08]], ['carryStone', 'body', [0, 0.4, -0.08]], ['carryIron', 'body', [0, 0.4, -0.08]],
];
const QUADRUPED = [
  ['root', null, [0, 0, 0]], ['body', 'root', [0, 0.3, 0]], ['head', 'body', [0, 0.36, 0.2]],
  ['legFL', 'root', [-0.07, 0.24, 0.15]], ['legFR', 'root', [0.07, 0.24, 0.15]], ['legBL', 'root', [-0.07, 0.24, -0.15]], ['legBR', 'root', [0.07, 0.24, -0.15]],
  ['tail', 'body', [0, 0.32, -0.22]], ['extra', 'body', [0, 0.3, 0]],
];
const RIDER = QUADRUPED.concat([
  ['rBody', 'body', [0, 0.46, -0.02]], ['rHead', 'rBody', [0, 0.66, -0.02]],
  ['rArmL', 'rBody', [-0.1, 0.62, -0.02]], ['rArmR', 'rBody', [0.1, 0.62, -0.02]],
  ['rHandL', 'rArmL', [-0.11, 0.45, 0]], ['rHandR', 'rArmR', [0.11, 0.45, 0]],
  ['rCape', 'rBody', [0, 0.64, -0.08]],
]);
const BIRD = [
  ['root', null, [0, 0, 0]], ['body', 'root', [0, 0.12, 0]], ['head', 'body', [0, 0.17, 0.06]],
  ['legL', 'root', [-0.025, 0.08, 0]], ['legR', 'root', [0.025, 0.08, 0]],
  ['wingL', 'body', [-0.05, 0.14, 0]], ['wingR', 'body', [0.05, 0.14, 0]], ['tail', 'body', [0, 0.14, -0.07]],
];
const SIEGE = [
  ['root', null, [0, 0, 0]], ['body', 'root', [0, 0.15, 0]],
  ['wheelFL', 'body', [-0.2, 0.1, 0.18]], ['wheelFR', 'body', [0.2, 0.1, 0.18]], ['wheelBL', 'body', [-0.2, 0.1, -0.18]], ['wheelBR', 'body', [0.2, 0.1, -0.18]],
  ['arm', 'body', [0, 0.25, -0.05]], ['arm2', 'body', [0, 0.25, 0]],
  ['crewL', 'root', [-0.18, 0, -0.3]], ['crewR', 'root', [0.18, 0, -0.3]],
];
const SKELETONS = { humanoid: HUMANOID, quadruped: QUADRUPED, rider: RIDER, bird: BIRD, siege: SIEGE };

/** Prepara un esqueleto para un modelo: índices, padres y pivotes (con los del modelo). */
function makeSkeleton(name, pivots = {}) {
  const src = SKELETONS[name] || HUMANOID, n = src.length, P = {}, parent = new Int8Array(n), piv = new Float32Array(n * 3);
  src.forEach(([k], i) => { P[k] = i; });
  src.forEach(([k, par, pv], i) => {
    parent[i] = par === null ? -1 : P[par];
    const p = pivots[k] || pv || (par !== null ? (pivots[par] || src[P[par]][2]) : [0, 0, 0]);
    piv[i * 3] = p[0]; piv[i * 3 + 1] = p[1]; piv[i * 3 + 2] = p[2];
  });
  return { name, n, P, parent, piv, names: src.map(s => s[0]) };
}

// ------------------------------------------------------------ pose
// 7 valores por pieza: rx, ry, rz, px, py, pz, escala
class Pose {
  constructor(sk) { this.sk = sk; this.v = new Float32Array(sk.n * 7); this.reset(); }
  reset() { const v = this.v; v.fill(0); for (let i = 0; i < this.sk.n; i++) v[i * 7 + 6] = 1; }
  r(name, x, y, z) { const i = this.sk.P[name]; if (i === undefined) return; const o = i * 7, v = this.v; v[o] += x; v[o + 1] += y || 0; v[o + 2] += z || 0; }
  p(name, x, y, z) { const i = this.sk.P[name]; if (i === undefined) return; const o = i * 7 + 3, v = this.v; v[o] += x; v[o + 1] += y; v[o + 2] += z; }
  s(name, s) { const i = this.sk.P[name]; if (i === undefined) return; this.v[i * 7 + 6] = s; }
  has(name) { return this.sk.P[name] !== undefined; }
}
const _W = new Float32Array(MAXP * 12);
/** Calcula las matrices de mundo (relativas al modelo) y las escribe en la fila de la textura. */
function writeBones(pose, out, off) {
  const { n, parent, piv } = pose.sk, v = pose.v, W = _W;
  for (let i = 0; i < n; i++) {
    const o = i * 7, rx = v[o], ry = v[o + 1], rz = v[o + 2], s = v[o + 6];
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    // R = Rx * Ry * Rz (orden XYZ de Three.js)
    const a00 = cy * cz * s, a01 = -cy * sz * s, a02 = sy * s;
    const a10 = (cx * sz + sx * sy * cz) * s, a11 = (cx * cz - sx * sy * sz) * s, a12 = -sx * cy * s;
    const a20 = (sx * sz - cx * sy * cz) * s, a21 = (sx * cz + cx * sy * sz) * s, a22 = cx * cy * s;
    const px = piv[i * 3], py = piv[i * 3 + 1], pz = piv[i * 3 + 2];
    const t0 = px + v[o + 3] - (a00 * px + a01 * py + a02 * pz), t1 = py + v[o + 4] - (a10 * px + a11 * py + a12 * pz), t2 = pz + v[o + 5] - (a20 * px + a21 * py + a22 * pz);
    const w = i * 12, pi = parent[i];
    if (pi < 0) { W[w] = a00; W[w + 1] = a01; W[w + 2] = a02; W[w + 3] = t0; W[w + 4] = a10; W[w + 5] = a11; W[w + 6] = a12; W[w + 7] = t1; W[w + 8] = a20; W[w + 9] = a21; W[w + 10] = a22; W[w + 11] = t2; }
    else {
      const q = pi * 12;
      for (let r = 0; r < 3; r++) {
        const b0 = W[q + r * 4], b1 = W[q + r * 4 + 1], b2 = W[q + r * 4 + 2], b3 = W[q + r * 4 + 3];
        W[w + r * 4] = b0 * a00 + b1 * a10 + b2 * a20; W[w + r * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21; W[w + r * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22;
        W[w + r * 4 + 3] = b0 * t0 + b1 * t1 + b2 * t2 + b3;
      }
    }
  }
  out.set(W.subarray(0, n * 12), off);
}

// ------------------------------------------------------------ textura global de huesos
const BT = { tex: null, data: null, cap: 0, rows: 0 };
function bonesBegin() { BT.rows = 0; }
function bonesRow() {
  if (BT.rows >= BT.cap) {
    const cap = Math.max(256, BT.cap * 2), data = new Float32Array(TW * 4 * cap);
    if (BT.data) data.set(BT.data);
    if (BT.tex) BT.tex.dispose();
    BT.data = data; BT.cap = cap;
    BT.tex = new THREE.DataTexture(data, TW, cap, THREE.RGBAFormat, THREE.FloatType);
    BT.tex.magFilter = BT.tex.minFilter = THREE.NearestFilter; BT.tex.generateMipmaps = false;
    BONES.value = BT.tex;
  }
  return BT.rows++;
}
function bonesEnd() { if (BT.tex && BT.rows) BT.tex.needsUpdate = true; }

// ------------------------------------------------------------ animaciones
const PI = Math.PI;
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
/** Interpola por tramos: keys = [[k, v], ...] con k creciente. */
function track(k, keys) {
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (k <= keys[i][0]) { const [k0, v0] = keys[i - 1], [k1, v1] = keys[i]; return v0 + (v1 - v0) * ease((k - k0) / (k1 - k0)); }
  return keys[keys.length - 1][1];
}
const WORK_TOOL = { chop: 'toolAxe', mine: 'toolPick', build: 'toolHammer', farm: 'toolHoe', gather: 'toolBasket', hunt: 'toolAxe' };
const CARRY = { wood: 'carryWood', food: 'carryFood', gold: 'carryGold', stone: 'carryStone', iron: 'carryIron' };

/** Brazos y piernas de un humanoide (prefijo '' o 'r' para el jinete). */
function humanoidAnim(P, A, st, pre) {
  const n = k => pre ? 'r' + k[0].toUpperCase() + k.slice(1) : k;
  const armL = n('armL'), armR = n('armR'), handL = n('handL'), handR = n('handR'), body = n('body'), head = n('head'), cape = n('cape');
  const t = st.t + st.seed * 7, H = A.height || 0.62;
  // respiración y mirada
  P.r(body, Math.sin(t * 1.9) * 0.018, 0, 0); P.r(head, 0, Math.sin(t * 0.45) * 0.22 * (st.anim === 'idle' ? 1 : 0.3), 0);
  P.r(armL, 0, 0, -0.06 - Math.sin(t * 1.9) * 0.02); P.r(armR, 0, 0, 0.06 + Math.sin(t * 1.9) * 0.02);
  if (P.has(cape)) P.r(cape, 0.08 + Math.sin(t * 2.3) * 0.04 + (st.anim === 'walk' ? 0.3 : 0), 0, 0);
  if (st.anim === 'walk' && !pre) {
    const ph = st.f / 8 * 2 * PI, a = (A.stride ?? 0.55) * (A.walk === 'heavy' ? 0.7 : 1), s = Math.sin(ph);
    P.r('legL', -s * a, 0, 0); P.r('legR', s * a, 0, 0);
    const sw = A.hold === 'twohand' || A.hold === 'crossbow' ? 0.15 : 0.75;
    P.r(armL, s * a * sw, 0, 0); P.r(armR, -s * a * sw * (A.hold === 'spear' || A.hold === 'staff' ? 0.3 : 1), 0, 0);
    P.p('root', 0, Math.abs(Math.cos(ph)) * 0.022 * H / 0.62 * (A.walk === 'heavy' ? 1.6 : 1), 0);
    P.r(body, 0.05, s * 0.09, Math.sin(ph) * (A.walk === 'heavy' ? 0.07 : 0.03));
  }
  if (st.anim === 'attack') {
    const k = st.k;
    switch (A.attack) {
      case 'thrust': {
        const r = track(k, [[0, 0], [0.32, 0.55], [0.48, -1.35], [0.62, -1.25], [1, 0]]);
        P.r(armR, r, 0, 0); P.r(handR, r < 0 ? r * 0.25 : 0, 0, 0); P.r(armL, r * 0.6, 0, 0);
        P.r(body, -r * 0.12, -r * 0.15, 0); if (!pre) P.p('root', 0, 0, -r * 0.03);
        break;
      }
      case 'bow': {
        const aim = track(k, [[0, 0.3], [0.2, 1], [0.85, 1], [1, 0.3]]), draw = track(k, [[0, 0], [0.45, 1], [0.5, 0], [1, 0]]);
        P.r(armL, -1.45 * aim, 0, 0.1 * aim); P.r(handL, 1.45 * aim, 0, 0);
        P.r(armR, -1.35 * aim + draw * 0.25, -0.5 * aim, -0.35 * aim - draw * 0.2);
        P.r(body, 0, 0.35 * aim, 0);
        break;
      }
      case 'crossbow': case 'gun': {
        const aim = track(k, [[0, 0.2], [0.25, 1], [0.85, 1], [1, 0.2]]), kick = track(k, [[0.48, 0], [0.52, 1], [0.75, 0]]) * (A.attack === 'gun' ? 1.6 : 1);
        P.r(armR, -0.9 * aim + kick * 0.25, 0, 0); P.r(handR, 0.9 * aim - kick * 0.25, 0, 0); P.r(armL, -1.0 * aim + kick * 0.2, 0, 0.25 * aim);
        P.r(body, -kick * 0.12, 0, 0); if (!pre) P.p('root', 0, 0, -kick * 0.025);
        break;
      }
      case 'cast': case 'heal': {
        const up = track(k, [[0, 0], [0.35, 1], [0.5, 0.4], [0.75, 0.4], [1, 0]]), push = track(k, [[0.38, 0], [0.5, 1], [0.8, 0]]);
        P.r(armR, -2.3 * up - push * 0.6, 0, -0.15 * up); P.r(handR, 0.9 * up, 0, 0); P.r(armL, -1.1 * up - push * 0.9, 0, 0.3 * up);
        P.r(body, -0.12 * up + push * 0.18, 0, 0); P.r(head, -0.15 * up, 0, 0);
        break;
      }
      case 'throw': {
        const r = track(k, [[0, 0], [0.38, -3.0], [0.5, -0.9], [0.68, -0.3], [1, 0]]);
        P.r(armR, r, 0, 0.1); P.r(armL, -0.6 * (r < -1 ? 1 : 0.4), 0, 0); P.r(body, r < -1.5 ? 0.12 : -0.08, r * -0.08, 0);
        if (k > 0.5 && k < 0.86) P.s(handR, 0);
        break;
      }
      case 'smash': {
        const r = track(k, [[0, 0], [0.38, -2.7], [0.52, -0.55], [0.7, -0.5], [1, 0]]);
        P.r(armR, r, 0, 0.12); P.r(armL, r, 0, -0.12); P.r(body, r > -1 ? 0.3 * (k > 0.45 && k < 0.8 ? 1 : 0) : -0.18, 0, 0);
        if (!pre) P.p('root', 0, k > 0.48 && k < 0.7 ? -0.02 * H / 0.62 : 0, 0);
        break;
      }
      default: {   // 'swing': espada, hacha, maza
        const r = track(k, [[0, 0], [0.36, -2.4], [0.52, -0.45], [0.66, -0.55], [1, 0]]), z = track(k, [[0, 0], [0.36, -0.35], [0.52, 0.15], [1, 0]]);
        P.r(armR, r, 0, z); P.r(handR, k > 0.4 && k < 0.6 ? 0.45 : 0, 0, 0);
        P.r(armL, -0.4 * Math.min(1, -r), 0, 0.15); P.r(body, 0, track(k, [[0, 0], [0.36, -0.3], [0.52, 0.28], [1, 0]]), 0);
        if (!pre) P.p('root', 0, 0, k > 0.45 && k < 0.65 ? 0.02 : 0);
      }
    }
  }
  if (st.anim === 'work' && !pre) {
    const ph = st.f / 4 * 2 * PI, s = Math.sin(ph);
    switch (st.work) {
      case 'chop': P.r(armR, -1.25 + s * 0.65, 0, 0.35 - s * 0.25); P.r(armL, -1.1 + s * 0.6, 0, -0.2); P.r(body, 0.08, s * 0.35, 0); break;
      case 'mine': P.r(armR, -1.7 + s * 1.0, 0, 0.1); P.r(armL, -1.6 + s * 0.95, 0, -0.1); P.r(body, 0.18 + s * 0.1, 0, 0); break;
      case 'build': { const q = Math.sin(ph * 2); P.r(armR, -1.0 + q * 0.6, 0, 0); P.r(armL, -0.5, 0, 0.2); P.r(body, 0.3, 0, 0); P.p('root', 0, -0.02 * H / 0.62, 0); P.r('legL', -0.35, 0, 0); P.r('legR', 0.25, 0, 0); break; }
      case 'farm': P.r(armR, -1.0 + s * 0.6, 0, 0); P.r(armL, -0.95 + s * 0.55, 0, 0); P.r(body, 0.25 + s * 0.15, 0, 0); break;
      default: P.r(body, 0.55, 0, 0); P.r(armL, -0.95 + s * 0.3, 0, 0); P.r(armR, -0.95 - s * 0.3, 0, 0); P.r(head, -0.3, 0, 0); P.r('legL', -0.25, 0, 0); P.r('legR', 0.2, 0, 0); P.p('root', 0, -0.015, 0);
    }
  }
  if (st.stun > 0) P.r(head, 0.15, Math.sin(t * 9) * 0.3, Math.sin(t * 7) * 0.2);
}
function quadAnim(P, A, st) {
  const t = st.t + st.seed * 5, moving = st.anim === 'walk';
  P.r('tail', 0, Math.sin(t * (moving ? 9 : 2.2)) * (moving ? 0.35 : 0.2), 0);
  P.r('head', Math.sin(t * 0.7) * 0.06 + (st.anim === 'idle' && Math.sin(t * 0.31) > 0.6 ? 0.55 : 0), Math.sin(t * 0.4) * 0.12, 0);
  P.p('body', 0, Math.sin(t * 1.8) * 0.003, 0);
  if (moving) {
    const ph = st.f / 8 * 2 * PI, a = A.stride ?? 0.55, gallop = A.walk === 'gallop';
    const o = gallop ? [0, 0.5, PI, PI + 0.5] : [0, PI, PI, 0];
    P.r('legFL', -Math.sin(ph + o[0]) * a, 0, 0); P.r('legFR', -Math.sin(ph + o[1]) * a, 0, 0);
    P.r('legBL', -Math.sin(ph + o[2]) * a, 0, 0); P.r('legBR', -Math.sin(ph + o[3]) * a, 0, 0);
    P.p('body', 0, Math.abs(Math.cos(ph)) * 0.02 * (gallop ? 1.6 : 1) * (A.size || 1), 0); P.r('body', gallop ? Math.sin(ph) * 0.07 : 0, 0, 0);
    P.r('head', gallop ? -Math.sin(ph) * 0.12 : Math.sin(ph * 2) * 0.05, 0, 0);
  }
  if (st.anim === 'attack') {
    const k = st.k;
    if (A.attack === 'stomp') { const up = track(k, [[0, 0], [0.38, 1], [0.5, 0], [1, 0]]); P.r('body', -0.45 * up, 0, 0); P.p('body', 0, 0.06 * up * (A.size || 1), 0); P.r('legFL', -0.9 * up, 0, 0); P.r('legFR', -0.9 * up, 0, 0); P.r('head', -0.3 * up, 0, 0); }
    else if (A.attack === 'gore') { const r = track(k, [[0, 0], [0.35, 0.5], [0.5, -0.45], [0.7, -0.3], [1, 0]]); P.r('head', r, 0, 0); P.p('root', 0, 0, r < 0 ? 0.05 : -0.02); }
    else if (A.attack !== 'none') { const r = track(k, [[0, 0], [0.35, -0.25], [0.5, 0.45], [0.7, 0.2], [1, 0]]); P.r('head', r, 0, 0); P.p('root', 0, 0, r > 0.2 ? 0.04 : 0); }
  }
  if (st.anim === 'work') { const ph = st.f / 4 * 2 * PI; P.r('head', 0.6 + Math.sin(ph) * 0.1, 0, 0); }
}
function birdAnim(P, A, st) {
  const t = st.t + st.seed * 5;
  if (st.anim === 'walk') { const ph = st.f / 8 * 2 * PI * 2; P.r('legL', -Math.sin(ph) * 0.7, 0, 0); P.r('legR', Math.sin(ph) * 0.7, 0, 0); P.p('body', 0, Math.abs(Math.cos(ph)) * 0.01, 0); P.p('head', 0, 0, Math.sin(ph) * 0.02); }
  else { const peck = Math.max(0, Math.sin(t * 1.3)) > 0.8 ? 1 : 0; P.r('head', peck * 0.9, 0, 0); P.r('body', peck * 0.35, 0, 0); }
  const fl = st.anim === 'attack' || Math.sin(t * 0.5) > 0.97 ? Math.sin(t * 30) * 0.6 + 0.6 : 0; P.r('wingL', 0, 0, -fl); P.r('wingR', 0, 0, fl);
  P.r('tail', Math.sin(t * 2) * 0.1, 0, 0);
}
function siegeAnim(P, A, st) {
  const turns = A.wheelTurns || 1, wr = -(st.f / 8) * 2 * PI * turns;
  if (st.anim === 'walk') { for (const w of ['wheelFL', 'wheelFR', 'wheelBL', 'wheelBR']) P.r(w, wr, 0, 0); P.r('body', Math.sin(st.f / 8 * 2 * PI * 2) * 0.012, 0, 0); }
  else for (const w of ['wheelFL', 'wheelFR', 'wheelBL', 'wheelBR']) P.r(w, st.wheel || 0, 0, 0);
  // tripulación (si el modelo la tiene): empuja al moverse
  if (st.anim === 'walk') { const ph = st.f / 8 * 2 * PI * 2; P.p('crewL', 0, Math.abs(Math.sin(ph)) * 0.015, 0); P.p('crewR', 0, Math.abs(Math.cos(ph)) * 0.015, 0); }
  if (st.anim === 'attack') {
    const k = st.k;
    switch (A.attack) {
      case 'catapult': P.r('arm', track(k, [[0, 0], [0.42, 0], [0.5, -1.9], [0.6, -1.75], [1, 0]]), 0, 0); P.r('body', track(k, [[0.48, 0], [0.52, -0.05], [0.7, 0]]), 0, 0); break;
      case 'cannon': { const kick = track(k, [[0.47, 0], [0.5, 1], [0.8, 0]]); P.p('arm', 0, 0, -kick * 0.08); P.p('body', 0, 0, -kick * 0.03); P.r('body', -kick * 0.05, 0, 0); break; }
      case 'ram': { const z = track(k, [[0, 0], [0.38, -0.12], [0.5, 0.14], [0.65, 0.1], [1, 0]]); P.p('arm', 0, 0, z); break; }
      default: { const z = track(k, [[0, 0], [0.4, -0.06], [0.48, 0.02], [1, 0]]); P.p('arm', 0, 0, z); P.r('arm2', 0, track(k, [[0.45, 0], [0.5, 0.2], [0.7, 0]]), 0); }   // 'ballista'
    }
  }
}
/** Muerte: cae y yace; se hunde al final (los cadáveres duran 12 s en la simulación). */
function deathAnim(P, A, st, sk) {
  const k = ease(Math.min(1, st.dead / 0.5)), sink = Math.max(0, st.dead - 9) * 0.05;
  if (sk === 'humanoid') { const hk = (A.height || 0.62) / 0.62; P.r('root', 1.42 * k, 0, 0.12 * k); P.p('root', 0, 0.075 * hk * k - sink, -0.02 * k); P.r('armL', -0.4 * k, 0, -0.9 * k); P.r('armR', -0.4 * k, 0, 0.9 * k); P.r('legL', -0.15 * k, 0, -0.1 * k); P.r('legR', 0.1 * k, 0, 0.1 * k); P.r('head', -0.3 * k, 0, 0); }
  else { const r = 1.45 * k; P.r('root', 0, 0, r); P.p('root', 0, 0.1 * (A.size || 1) * k - sink, 0); P.r('legFL', 0.2 * k, 0, 0); P.r('legBL', -0.2 * k, 0, 0); P.r('rBody', -0.6 * k, 0, 0.3 * k); P.r('head', 0.3 * k, 0, 0); }
}
/**
 * Calcula la pose de un modelo para un estado de la simulación.
 * st: { anim: 'idle'|'walk'|'attack'|'work', f (u.af), k (0..1 del golpe), t, seed, work, carry, stun, dead (s desde la muerte) o -1 }
 */
function animate(def, pose, st) {
  pose.reset();
  const A = def.anim || {}, sk = def.skeleton || 'humanoid';
  if (sk === 'humanoid') humanoidAnim(pose, A, st, false);
  else if (sk === 'quadruped' || sk === 'rider') { quadAnim(pose, A, st); if (sk === 'rider') humanoidAnim(pose, Object.assign({}, A, { attack: A.riderAttack || 'swing' }), st, true); }
  else if (sk === 'bird') birdAnim(pose, A, st);
  else if (sk === 'siege') siegeAnim(pose, A, st);
  // herramientas y carga (aldeanos): solo se ve la herramienta del trabajo actual
  if (pose.has('toolAxe')) {
    const show = st.work && (st.anim === 'work' || st.anim === 'walk' || st.anim === 'attack') ? WORK_TOOL[st.work] : null;
    for (const k of ['toolAxe', 'toolPick', 'toolHammer', 'toolHoe', 'toolBasket']) if (k !== show) pose.s(k, 0);
    const c = st.carry ? CARRY[st.carry] : null;
    for (const k of ['carryWood', 'carryFood', 'carryGold', 'carryStone', 'carryIron']) if (k !== c) pose.s(k, 0);
  }
  if (st.dead >= 0) deathAnim(pose, A, st, sk === 'humanoid' ? 'humanoid' : 'other');
  if (def.pose) def.pose(pose, st);     // ajuste propio del modelo (opcional)
}

export { MAXP, SKELETONS, makeSkeleton, Pose, writeBones, animate, track, ease, BT, bonesBegin, bonesRow, bonesEnd };
