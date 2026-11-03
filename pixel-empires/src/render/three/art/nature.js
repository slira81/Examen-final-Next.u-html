/* =====================================================================
   Arte 3D procedural — naturaleza (ver docs/ART3D.md §6).
     Árboles: 3 variantes de forma, copa 'tint' (+ teamShade), pieza 1 = nieve,
       balanceo proporcional a la altura.  Tocón.
     Recursos: minas (pieza 0 roca con vetas, 1 = trozos extra > 66 %,
       2 = trozos > 33 %), arbusto de bayas (pieza 1 = bayas), banco de peces
       (origen = superficie del agua).
     Decoración (≤ 12 primitivas), tesoros (cofre: pieza 1 cerrado, 2 abierto).
     Andamios (huella fp×fp, 1.0 de alto: el motor los estira) y escombros.
     Proyectiles: centrados en el origen, apuntando a +Z.
   Formas propias (copas estrelladas de pino, frondas de palmera, cortinas de
   sauce, rocas facetadas) se construyen como geometrías de triángulos y se
   añaden con b.add(), así cuentan como una sola primitiva.
   ===================================================================== */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { shade, rng, solid } from '../kit.js';

const PI = Math.PI, TAU = PI * 2;
const SNOW = '#f2f6fa', BARK = '#86603c', BARK_D = '#6a4a2e', MOSS = '#6f9a4a', GRASS = '#5e9a40';
const WOOD = '#a8814e', WOOD_L = '#c49a62', WOOD_D = '#7a5636', CHAR = '#3e3128', ASH = '#5f5a55';
const STEEL = '#c8ced6', GOLD = '#f2c23a', BONE = '#e8dcc0', STONE = '#a29d94';

// =====================================================================
// Utilidades geométricas
// =====================================================================
/** Balanceo con el viento que crece con la altura sobre y0. */
const sway = (y0, k) => (x, y) => Math.max(0, y - y0) * k;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Normal unitaria de una cara [a, b, c] (sentido antihorario = cara frontal). */
function nrm([a, b, c]) {
  const u = sub(b, a), w = sub(c, a), n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}
/** Orienta cada cara para que mire lejos del punto c (formas estrelladas respecto a c). */
function orient(F, c) {
  return F.map(f => { const n = nrm(f), m = [0, 1, 2].map(k => (f[0][k] + f[1][k] + f[2][k]) / 3 - c[k]); return n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0 ? [f[0], f[2], f[1]] : f; });
}
/** Geometría desde caras [[a, b, c], ...]; two = doble cara (hojas, cortinas); c = orientar desde ese punto. */
function tri(F, { two = false, c = null } = {}) {
  if (c) F = orient(F, c);
  const p = [];
  for (const [a, b, d] of F) {
    p.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]);
    if (two) p.push(a[0], a[1], a[2], d[0], d[1], d[2], b[0], b[1], b[2]);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); return g;
}
/** Une dos anillos cerrados [x, y, z, ángulo] (ordenados por ángulo) con una tira de triángulos. */
function zip(A, B) {
  const F = [], na = A.length, nb = B.length, ta = k => A[k % na][3] + Math.floor(k / na) * TAU, tb = k => B[k % nb][3] + Math.floor(k / nb) * TAU;
  let i = 0, j = 0;
  while (i < na || j < nb) {
    if (j >= nb || (i < na && ta(i + 1) < tb(j + 1))) { F.push([A[i % na], B[j % nb], A[(i + 1) % na]]); i++; }
    else { F.push([A[i % na], B[j % nb], B[(j + 1) % nb]]); j++; }
  }
  return F;
}
/** Cilindro/cono de p a q (radio r0 en p, r1 en q). */
function limb(b, p, q, r0, r1, sides, o = {}) {
  const d = sub(q, p), L = Math.hypot(...d) || 1e-4;
  return b.cyl(r1, r0, L, sides, Object.assign({}, o, { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, z: (p[2] + q[2]) / 2, rz: -Math.asin(Math.max(-1, Math.min(1, d[0] / L))), rx: Math.atan2(d[2], d[1]) }));
}
/** Viga (caja w×largo×t) de p a q. */
function beam(b, p, q, w, t, o = {}) {
  const d = sub(q, p), L = Math.hypot(...d) || 1e-4;
  return b.box(w, L, t, Object.assign({}, o, { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, z: (p[2] + q[2]) / 2, rz: -Math.asin(Math.max(-1, Math.min(1, d[0] / L))), rx: Math.atan2(d[2], d[1]) }));
}
/** Cono estrellado (piso de pino): n puntas que caen `droop` bajo la base; k = radio relativo de las muescas. */
function starCone(r, h, n, k, droop, seed) {
  const R = rng(seed), A = [0, h, 0], C = [0, h * 0.12, 0], P = [];
  for (let j = 0; j < 2 * n; j++) {
    const tip = j % 2 === 0, a = (j + (R() - 0.5) * 0.3) * PI / n, q = (tip ? r : r * k) * (0.9 + R() * 0.2), dr = R();
    P.push([Math.cos(a) * q, tip ? -droop * (0.7 + dr * 0.6) : droop * 0.5, Math.sin(a) * q]);
  }
  const F = [];
  for (let j = 0; j < 2 * n; j++) { const p = P[j], q = P[(j + 1) % (2 * n)]; F.push([A, q, p], [C, p, q]); }
  return tri(F, { c: [0, h * 0.35, 0] });
}
/** Fronda de palmera a lo largo de +X: arco que sube y cae, foliolos en zigzag y nervio central. */
function frond(L, W, rise, droop, segs, seed) {
  const R = rng(seed), C = [], Lf = [], Rt = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = L * t, y = L * (rise * t - droop * t * t);
    const w = i === segs ? 0 : W * Math.pow(Math.sin(PI * (0.16 + 0.84 * t)), 0.8) * (i % 2 ? 0.55 : 1) * (0.9 + R() * 0.2), f = w * 0.32;
    C.push([x, y, 0]); Lf.push([x - w * 0.3, y - f, w]); Rt.push([x - w * 0.3, y - f, -w]);
  }
  const F = [];
  for (let i = 0; i < segs; i++) F.push([C[i], Lf[i], Lf[i + 1]], [C[i], Lf[i + 1], C[i + 1]], [C[i], C[i + 1], Rt[i + 1]], [C[i], Rt[i + 1], Rt[i]]);
  return tri(F, { two: true });
}
/** Cortina de ramas colgantes (sauce): n tiras que salen del borde de la copa (r0, y0), se abren hasta r1 y caen hasta yT. */
function drapes(r0, y0, r1, yT, n, w, seed, ph = 0) {
  const R = rng(seed), F = [];
  for (let j = 0; j < n; j++) {
    const a = ph + (j + (R() - 0.5) * 0.5) / n * TAU, ca = Math.cos(a), sa = Math.sin(a), tx = -sa, tz = ca, ww = w * (0.8 + R() * 0.4);
    const yk = y0 - 0.12 - R() * 0.06, rk = r1 * (0.92 + R() * 0.1), yt = yT - R() * 0.18, rt = rk * (1.02 + R() * 0.06);
    const P = (r, y, s) => [ca * r + tx * s, y, sa * r + tz * s];
    const t0 = P(r0, y0, -ww), t1 = P(r0, y0, ww), k0 = P(rk, yk, -ww * 0.85), k1 = P(rk, yk, ww * 0.85), m0 = P(rt, (yk + yt) / 2, -ww * 0.55), m1 = P(rt, (yk + yt) / 2, ww * 0.55), tip = P(rt * 0.98, yt, 0);
    F.push([t0, t1, k1], [t0, k1, k0], [k0, k1, m1], [k0, m1, m0], [m0, m1, tip]);
  }
  return tri(F, { two: true });
}
/** Cristal: prisma de `sides` lados con punta piramidal (convexo). */
function crystal(r, h, tip, sides = 6) {
  const v = [], f = [], ap = sides * 2, bo = ap + 1;
  for (let i = 0; i < sides; i++) { const a = i / sides * TAU; v.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * r * 0.92, h, Math.sin(a) * r * 0.92); }
  v.push(0, h + tip, 0, 0, -0.01, 0);
  for (let i = 0; i < sides; i++) { const a = i * 2, c = ((i + 1) % sides) * 2; f.push(a, c, a + 1, c, c + 1, a + 1, a + 1, c + 1, ap, a, bo, c); }
  return solid(v, f);
}
/** Bipirámide (orbe facetado, esquirla): radio r, mitad superior h1 e inferior h2. */
function bipyr(r, h1, h2, sides = 6) {
  const v = [0, h1, 0, 0, -h2, 0], f = [];
  for (let i = 0; i < sides; i++) { const a = i / sides * TAU; v.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  for (let i = 0; i < sides; i++) { const a = 2 + i, c = 2 + (i + 1) % sides; f.push(0, a, c, 1, c, a); }
  return solid(v, f);
}
/** Flor plana en estrella (pétalos): n pétalos de radio r, ligeramente en copa. */
function petals(r, n, cup, seed) {
  const R = rng(seed), C = [0, 0, 0], P = [];
  for (let j = 0; j < 2 * n; j++) { const tip = j % 2 === 0, a = j * PI / n + R() * 0.1, q = tip ? r : r * 0.38; P.push([Math.cos(a) * q, tip ? cup : cup * 0.3, Math.sin(a) * q]); }
  const F = []; for (let j = 0; j < 2 * n; j++) F.push([C, P[(j + 1) % (2 * n)], P[j]]);
  return tri(F, { two: true });
}
/** Caras de una roca facetada (anillos con jitter + cúspide), orientadas hacia fuera. */
function rockFaces(seed, w, h, d, n = 6) {
  const R = rng(seed);
  const ring = (k, rad, y, ph) => Array.from({ length: k }, (_, i) => { const t = ph + (i + (R() - 0.5) * 0.4) / k * TAU, q = rad * (0.84 + R() * 0.32); return [Math.cos(t) * q * w, y * h * (0.9 + R() * 0.2), Math.sin(t) * q * d, t]; });
  const B = ring(n, 0.8, -0.06, 0), M = ring(n, 1, 0.42, PI / n), T = ring(n - 1, 0.58, 0.82, R() * 0.4), A = [(R() - 0.5) * 0.35 * w, h, (R() - 0.5) * 0.35 * d];
  const F = [...zip(B, M), ...zip(M, T)], bc = [0, -0.08 * h, 0];
  T.forEach((p, i) => F.push([p, T[(i + 1) % T.length], A]));
  B.forEach((p, i) => F.push([p, B[(i + 1) % n], bc]));
  return orient(F, [A[0] * 0.3, h * 0.4, A[2] * 0.3]);
}
/** Añade una roca; top = { k, color } pinta de otro color las caras que miran arriba (nieve, musgo). */
function rock(b, F, o, top = null) {
  if (!top) return b.add(tri(F), o);
  const up = F.filter(f => nrm(f)[1] > top.k), side = F.filter(f => nrm(f)[1] <= top.k);
  b.add(tri(side), o); if (up.length) b.add(tri(up), Object.assign({}, o, top.o || {}, { color: top.color }));
}
/** Vetas: triángulos encogidos sobre caras laterales elegidas de una roca (misma transformación que la roca). */
function veins(F, R, count, s = 0.55) {
  const side = F.filter(f => { const n = nrm(f); return n[1] > -0.2 && n[1] < 0.8 && n[2] > -0.3; }), out = [];
  for (let i = 0; i < count && side.length; i++) {
    const f = side.splice(Math.floor(R() * side.length), 1)[0], n = nrm(f), g = [0, 1, 2].map(k => (f[0][k] + f[1][k] + f[2][k]) / 3);
    out.push(f.map(p => { const k = s * (0.7 + R() * 0.6); return [0, 1, 2].map(a => g[a] + (p[a] - g[a]) * k + n[a] * 0.008); }));
  }
  return tri(out);
}
/** Raíces que se abren desde la base del tronco. */
function roots(b, n, r, len, h, col, R, ph = 0, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = ph + (i + R() * 0.5) / n * TAU, L = len * (0.8 + R() * 0.4);
    limb(b, [Math.cos(a) * r * 0.2, h, Math.sin(a) * r * 0.2], [Math.cos(a) * L, -0.012, Math.sin(a) * L], r, r * 0.3, 5, Object.assign({ color: col }, o));
  }
}
/** Copa de bolas tintadas (más claras arriba). blobs: [x, y, z, r, sy?]. Devuelve [x, y, z, r, rVertical]. */
function crown(b, blobs, sy, R, wave, { detail = 1, lo = 0.8, hi = 1.12 } = {}) {
  const ys = blobs.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return blobs.map(([x, y, z, r, s]) => {
    const j = 0.92 + R() * 0.16, Rr = r * j, S = s ?? sy;
    b.ball(Rr, detail, { x, y, z, sy: S, ry: R() * 3, color: 'tint', teamShade: lo + (hi - lo) * (y - y0) / Math.max(0.01, y1 - y0) + R() * 0.06, wave });
    return [x, y, z, Rr, Rr * S];
  });
}
/** Capas de nieve sobre las n bolas más altas. */
function snowCaps(b, caps, n, wave) {
  caps.slice().sort((a, c) => (c[1] + c[4]) - (a[1] + a[4])).slice(0, n).forEach(([x, y, z, r, ry]) =>
    b.blob(r * 0.8, ry * 0.34, r * 0.8, 1, { x, y: y + ry * 0.68, z, color: SNOW, wave }));
}

// =====================================================================
// Árboles
// =====================================================================
const OAK = [
  { top: [0, 0.66, 0], sy: 0.86, blobs: [[0, 1.13, 0, 0.36], [0.27, 0.96, 0.05, 0.27], [-0.26, 0.98, -0.08, 0.28], [0.05, 0.94, 0.27, 0.26], [-0.05, 0.96, -0.27, 0.25], [0.17, 1.2, -0.14, 0.22], [-0.18, 0.86, 0.17, 0.21]] },
  { top: [0.02, 0.84, 0], sy: 0.92, blobs: [[0.02, 1.5, 0, 0.29], [0.2, 1.26, 0.05, 0.26], [-0.19, 1.29, -0.04, 0.26], [0.03, 1.22, 0.21, 0.24], [0, 1.2, -0.21, 0.24], [0.14, 1.0, -0.12, 0.21], [-0.12, 0.98, 0.13, 0.21]] },
  { top: [0.08, 0.64, 0.03], sy: 0.76, blobs: [[0.08, 1.12, 0.02, 0.34], [0.42, 0.98, 0.1, 0.26], [-0.28, 1.02, -0.06, 0.27], [0.12, 0.98, 0.38, 0.25], [0.04, 1.0, -0.34, 0.25], [-0.2, 0.96, 0.28, 0.21], [0.36, 0.98, -0.26, 0.21]] },
];
const PINE = [
  { trunk: 0.55, tiers: [[0.52, 0.3, 0.62], [0.44, 0.6, 0.56], [0.35, 0.9, 0.5], [0.24, 1.17, 0.46]] },
  { trunk: 0.6, tiers: [[0.42, 0.34, 0.56], [0.37, 0.62, 0.52], [0.31, 0.89, 0.48], [0.23, 1.15, 0.45], [0.15, 1.39, 0.44]] },
  { trunk: 0.5, tiers: [[0.58, 0.24, 0.6], [0.47, 0.54, 0.54], [0.35, 0.82, 0.5], [0.2, 1.08, 0.4]], lean: [0.035, 0.02] },
];
const SPINE = [
  { trunk: 0.5, tiers: [[0.46, 0.28, 0.52], [0.4, 0.52, 0.5], [0.33, 0.76, 0.46], [0.25, 0.99, 0.43], [0.16, 1.2, 0.44]] },
  { trunk: 0.55, tiers: [[0.38, 0.3, 0.5], [0.34, 0.54, 0.48], [0.29, 0.77, 0.46], [0.23, 0.99, 0.44], [0.17, 1.2, 0.42], [0.1, 1.4, 0.38]] },
  { trunk: 0.45, tiers: [[0.52, 0.24, 0.54], [0.43, 0.5, 0.5], [0.33, 0.75, 0.46], [0.21, 0.98, 0.42]] },
];
/** Pino genérico: pisos estrellados tintados; frost = escarcha en las aristas (pieza 0); pieza 1 = nieve. */
function pineBuild(b, V, v, seed, { frost = null, k = 0.66 } = {}) {
  const R = rng(seed + v * 71), sw = sway(0.25, 0.55), N = V.tiers.length, ln = V.lean || [0, 0];
  limb(b, [0, 0, 0], [ln[0] * 4, V.trunk, ln[1] * 4], 0.085, 0.045, 6, { color: BARK, wave: sw });
  roots(b, 3, 0.06, 0.17, 0.12, BARK_D, R, v);
  const T = V.tiers.map(([r, y, h], i) => {
    const s = seed * 10 + v * 40 + i, ry = i * 0.45 + v, x = (R() - 0.5) * 0.04 + ln[0] * (i + 1) * 1.6, z = (R() - 0.5) * 0.04 + ln[1] * (i + 1) * 1.6;
    b.add(starCone(r, h, 7, k, 0.07, s), { x, y, z, ry, color: 'tint', teamShade: 0.76 + 0.36 * i / (N - 1), wave: sw });
    if (frost && i >= N - frost.n) b.add(starCone(r * 0.98, h * 0.98, 7, 0.3, 0.07 * 0.98, s), { x, y: y + h * 0.02 + 0.018, z, ry, color: frost.color, wave: sw });
    return [r, y, h, s, ry, x, z];
  });
  b.part = 1;
  for (const [r, y, h, s, ry, x, z] of T) b.add(starCone(r * 0.82, h * 0.82, 7, k, 0.07 * 0.82, s), { x, y: y + h * 0.18 + 0.04, z, ry, color: SNOW, wave: sw });
}

export const MODELS = {
  // ------------------------------------------------------------------ roble
  tree_oak: {
    variants: 3, tints: ['#4e9a3c', '#58a343', '#468f3a', '#63a848', '#4f9440', '#6dab45'], snow: true,
    build(b, { v }) {
      const V = OAK[v], R = rng(11 + v * 97), sw = sway(0.22, 0.85), t = V.top;
      limb(b, [0, 0, 0], t, 0.1, 0.06, 6, { color: BARK, wave: sw });
      roots(b, 3, 0.07, 0.21, 0.16, BARK_D, R, v * 0.7);
      for (const i of [1, 2, 3]) { const q = V.blobs[i]; limb(b, [t[0], t[1] - 0.06, t[2]], [q[0] * 0.75, q[1] - 0.06, q[2] * 0.75], 0.045, 0.02, 5, { color: BARK, wave: sw }); }
      const caps = crown(b, V.blobs, V.sy, R, sw);
      b.part = 1; snowCaps(b, caps, 5, sw);
    },
  },
  // ------------------------------------------------------------------ pino
  tree_pine: {
    variants: 3, tints: ['#3d7f46', '#47874a', '#367a4c', '#4b8c48', '#3f8352'], snow: true,
    build(b, { v }) { pineBuild(b, PINE[v], v, 23); },
  },
  // ------------------------------------------------------------------ pino nevado (escarcha azulada)
  tree_snowpine: {
    variants: 3, tints: ['#4d7d68', '#4a7a72', '#557f74', '#466f66', '#5a8478'], snow: true,
    build(b, { v }) { pineBuild(b, SPINE[v], v, 29, { frost: { n: 4, color: '#dceaf0' }, k: 0.62 }); },
  },
  // ------------------------------------------------------------------ abedul
  tree_birch: {
    variants: 3, tints: ['#9cc95a', '#a8cf62', '#8fbf5a', '#b3d36a', '#a6c450'], snow: true,
    build(b, { v }) {
      const R = rng(37 + v * 53), sw = sway(0.25, 0.8), W = '#ece6da', M = '#3e3830';
      const TR = [
        [[[0, 0, 0], [0.03, 1.2, 0], 0.05]],
        [[[-0.03, 0, 0.01], [-0.2, 1.12, 0.05], 0.046], [[0.03, 0, -0.01], [0.22, 1.24, -0.05], 0.043]],
        [[[0.0, 0, 0.04], [0.05, 1.08, 0.1], 0.042], [[-0.05, 0, -0.03], [-0.22, 0.98, -0.1], 0.036], [[0.05, 0, -0.04], [0.24, 0.9, -0.12], 0.034]],
      ][v];
      const BL = [
        [[0.02, 1.42, 0, 0.24, 1.35], [0.18, 1.22, 0.07, 0.2, 1.3], [-0.16, 1.26, -0.06, 0.21, 1.3], [0.06, 1.14, -0.18, 0.19, 1.25], [-0.06, 1.1, 0.17, 0.19, 1.25], [0.02, 0.92, 0.02, 0.16, 1.2]],
        [[-0.22, 1.34, 0.05, 0.21, 1.3], [0.24, 1.46, -0.05, 0.22, 1.3], [0, 1.25, 0, 0.2, 1.25], [-0.32, 1.1, 0.12, 0.17, 1.2], [0.34, 1.2, -0.14, 0.17, 1.2], [0.02, 1.08, 0.2, 0.16, 1.2]],
        [[0.05, 1.3, 0.1, 0.2, 1.3], [-0.22, 1.2, -0.1, 0.19, 1.3], [0.25, 1.12, -0.12, 0.18, 1.3], [-0.04, 1.08, -0.14, 0.17, 1.2], [0.1, 1.5, 0.0, 0.16, 1.3], [-0.3, 0.98, 0.04, 0.15, 1.2]],
      ][v];
      const marks = v === 0 ? 4 : 2;
      for (const [p, q, r] of TR) {
        limb(b, p, q, r, r * 0.5, 6, { color: W, wave: sw });
        limb(b, [p[0], -0.01, p[2]], lerp3(p, q, 0.12), r * 1.3, r * 1.02, 6, { color: '#56504a' });
        for (let i = 0; i < marks; i++) {
          const t = 0.2 + (i + R() * 0.6) / marks * 0.6, c = lerp3(p, q, t), rr = r * (1 - t * 0.5);
          b.box(rr * 2 + 0.016, 0.016, 0.026, { x: c[0], y: c[1], z: c[2], ry: R() * PI, color: M, wave: sw });
        }
      }
      if (v === 0) for (const i of [1, 2]) limb(b, [0.02, 0.85, 0], [BL[i][0] * 0.8, BL[i][1] - 0.1, BL[i][2] * 0.8], 0.02, 0.01, 4, { color: W, wave: sw });
      const caps = crown(b, BL, 1.3, R, sw, { lo: 0.86, hi: 1.14, detail: 0 });
      b.part = 1; snowCaps(b, caps, 4, sw);
    },
  },
  // ------------------------------------------------------------------ palmera
  tree_palm: {
    variants: 3, tints: ['#5ea24a', '#6aaa4a', '#58993f', '#73b04e'], snow: true,
    build(b, { v }) {
      const R = rng(41 + v * 13), P = [{ n: 5, len: 0.29, bend: 0.06, psi: 0.4, fr: 7, L: 0.62 }, { n: 5, len: 0.32, bend: 0.095, psi: -1.4, fr: 7, L: 0.64 }, { n: 4, len: 0.31, bend: 0.035, psi: 2.3, fr: 8, L: 0.56 }][v];
      const PALM = '#a3825a', sw = sway(0.2, 0.55);
      let p = [0, 0, 0], th = 0.03;
      const dx = Math.cos(P.psi), dz = Math.sin(P.psi);
      for (let i = 0; i < P.n; i++) {
        th += P.bend; const q = [p[0] + Math.sin(th) * dx * P.len, p[1] + Math.cos(th) * P.len, p[2] + Math.sin(th) * dz * P.len], r0 = 0.078 - i * 0.008;
        limb(b, p, q, r0, r0 * 0.74, 6, { color: shade(PALM, (i % 2) * 0.05 - 0.02), wave: sw });
        p = q;
      }
      const c = p, fw = (x, y, z) => Math.max(0, y - 0.2) * 0.55 + Math.hypot(x - c[0], z - c[2]) * 0.5;
      b.cone(0.07, 0.12, 6, { x: c[0], y: c[1] + 0.04, z: c[2], color: 'tint', teamShade: 0.7, wave: sw });
      const FR = [];
      for (let i = 0; i < P.fr; i++) {
        const f = [i / P.fr * TAU + R() * 0.4 + v, P.L * (0.85 + R() * 0.3), 0.45 + R() * 0.25, 1.05 + R() * 0.35, 900 + v * 20 + i];
        b.add(frond(f[1], 0.085, f[2], f[3], 7, f[4]), { x: c[0], y: c[1] + 0.05, z: c[2], ry: -f[0], color: 'tint', teamShade: 0.85 + R() * 0.3, wave: fw });
        FR.push(f);
      }
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; b.ball(0.045, 0, { x: c[0] + Math.cos(a) * 0.06, y: c[1] - 0.03 - (i % 2) * 0.03, z: c[2] + Math.sin(a) * 0.06, color: i === 1 ? '#7a5a2e' : '#5e4424', wave: sw }); }
      b.part = 1;
      b.blob(0.09, 0.035, 0.09, 1, { x: c[0], y: c[1] + 0.1, z: c[2], color: SNOW, wave: sw });
      for (const f of FR.filter((_, i) => i % 2 === 0)) b.add(frond(f[1] * 0.8, 0.045, f[2], f[3], 7, f[4]), { x: c[0], y: c[1] + 0.065, z: c[2], ry: -f[0], color: SNOW, wave: fw });
    },
  },
  // ------------------------------------------------------------------ sauce llorón
  tree_willow: {
    variants: 3, tints: ['#6f9f56', '#7aa85a', '#679a50', '#83ae5e'], snow: true,
    build(b, { v }) {
      const R = rng(53 + v * 29), sw = sway(0.25, 0.6), fw = (x, y) => 0.5 + Math.max(0, 1.25 - y) * 0.7;
      const V = [
        { top: [0.02, 0.8, 0], y: 1.2, lobes: [[0, 0, 1.0]], crown: [[0, 1.28, 0, 0.44, 0.5], [0.26, 1.2, 0.1, 0.27, 0.55], [-0.25, 1.22, -0.08, 0.27, 0.55], [0.0, 1.2, 0.27, 0.26, 0.55], [-0.02, 1.2, -0.27, 0.26, 0.55]] },
        { top: [0, 0.9, 0], y: 1.36, lobes: [[-0.2, 0.03, 0.78], [0.2, -0.03, 0.78]], crown: [[-0.2, 1.42, 0.03, 0.36, 0.55], [0.2, 1.5, -0.03, 0.36, 0.55], [0, 1.34, 0.22, 0.26, 0.55], [0, 1.34, -0.22, 0.26, 0.55], [0.4, 1.36, 0.06, 0.22, 0.55]] },
        { top: [0.14, 0.7, 0.04], y: 1.06, lobes: [[0.12, 0.04, 1.1]], crown: [[0.12, 1.14, 0.04, 0.48, 0.45], [0.44, 1.06, 0.1, 0.28, 0.5], [-0.2, 1.08, -0.04, 0.28, 0.5], [0.14, 1.06, 0.36, 0.27, 0.5], [0.1, 1.08, -0.3, 0.27, 0.5]] },
      ][v], t = V.top;
      limb(b, [0, 0, 0], t, 0.12, 0.075, 7, { color: BARK, wave: sw });
      roots(b, 3, 0.08, 0.22, 0.15, BARK_D, R, v);
      for (const i of [1, 2, 3]) { const q = V.crown[i]; limb(b, [t[0], t[1] - 0.05, t[2]], [q[0] * 0.85, q[1] - 0.04, q[2] * 0.85], 0.055, 0.022, 5, { color: BARK, wave: sw }); }
      V.lobes.forEach(([x, z, s], i) => {
        b.add(drapes(0.4 * s, V.y, 0.56 * s, 0.3 + (v === 2 ? -0.06 : 0), 15, 0.06, 700 + v * 9 + i), { x, z, color: 'tint', teamShade: 1.0, wave: fw });
        b.add(drapes(0.3 * s, V.y - 0.02, 0.44 * s, 0.5, 12, 0.07, 760 + v * 9 + i, 0.2), { x, z, color: 'tint', teamShade: 0.72, wave: fw });
      });
      const caps = crown(b, V.crown, 0.5, R, sw, { lo: 0.88, hi: 1.14 });
      b.part = 1; snowCaps(b, caps, 3, sw);
    },
  },
  // ------------------------------------------------------------------ árbol muerto (el tinte colorea la corteza)
  tree_dead: {
    variants: 3, tints: ['#8a7560', '#7f6c5a', '#958169', '#76675a'], snow: true,
    build(b, { v }) {
      const R = rng(61 + v * 17), sw = sway(0.3, 0.45);
      const V = [
        { tr: [[[0, 0, 0], [0.03, 0.5, 0.01], 0.085, 0.064], [[0.03, 0.5, 0.01], [-0.03, 0.92, 0.03], 0.064, 0.045]],
          br: [[[-0.03, 0.9, 0.03], [0.3, 1.3, 0.1], 0.04, 0.015], [[-0.03, 0.9, 0.03], [-0.32, 1.38, -0.04], 0.038, 0.014], [[-0.03, 0.9, 0.03], [0.02, 1.56, -0.12], 0.032, 0.012], [[0.03, 0.55, 0.01], [0.34, 0.8, -0.14], 0.035, 0.012]] },
        { tr: [[[0, 0, 0], [0.02, 0.62, 0], 0.115, 0.09], [[0.02, 0.62, 0], [0.0, 1.02, 0.02], 0.09, 0.07]],
          br: [[[0.02, 0.55, 0], [-0.32, 0.92, 0.1], 0.045, 0.016], [[0.0, 0.85, 0.02], [0.3, 1.28, -0.06], 0.035, 0.012], [[0.0, 0.98, 0.0], [0.04, 1.2, 0.05], 0.05, 0.01], [[0.0, 0.98, 0.0], [-0.07, 1.14, -0.04], 0.045, 0.008]] },
        { tr: [[[0, 0, 0], [0.13, 0.45, 0], 0.095, 0.07], [[0.13, 0.45, 0], [0.06, 0.82, 0.05], 0.07, 0.05]],
          br: [[[0.08, 0.78, 0.04], [0.52, 1.0, 0.12], 0.042, 0.014], [[0.06, 0.8, 0.05], [-0.4, 1.12, -0.1], 0.04, 0.014], [[0.06, 0.8, 0.05], [0.12, 1.36, -0.3], 0.034, 0.012], [[0.12, 0.5, 0.0], [-0.22, 0.62, 0.24], 0.03, 0.01]] },
      ][v];
      for (const [p, q, r0, r1] of V.tr) limb(b, p, q, r0, r1, 6, { color: 'tint', wave: sw });
      roots(b, 3, 0.075, 0.2, 0.14, 'tint', R, v, { teamShade: 0.82 });
      const tw = [];
      for (const [p, q, r0, r1] of V.br) {
        limb(b, p, q, r0, r1, 5, { color: 'tint', teamShade: 1.05, wave: sw });
        const m = lerp3(p, q, 0.6 + R() * 0.2), d = sub(q, p), side = [-d[2], 0, d[0]], s = R() > 0.5 ? 1 : -1;
        tw.push([m, [m[0] + d[0] * 0.25 + side[0] * 0.4 * s, m[1] + 0.16, m[2] + d[2] * 0.25 + side[2] * 0.4 * s]]);
      }
      for (const [p, q] of tw) limb(b, p, q, 0.014, 0.005, 4, { color: 'tint', teamShade: 1.1, wave: sw });
      if (v === 1) b.blob(0.05, 0.075, 0.03, 0, { x: 0.01, y: 0.42, z: 0.095, color: '#3a2c20' });
      b.part = 1;
      for (const [p, q, r0, r1] of V.br.slice(0, 3)) limb(b, [p[0], p[1] + r0 * 0.8, p[2]], [q[0], q[1] + r1 * 0.9, q[2]], r0 * 0.6, r1 * 0.5, 4, { color: SNOW, wave: sw });
      b.blob(0.07, 0.025, 0.07, 1, { x: V.br[0][0][0], y: V.br[0][0][1] + 0.03, z: V.br[0][0][2], color: SNOW, wave: sw });
    },
  },
  // ------------------------------------------------------------------ árbol anciano (gigante)
  tree_elder: {
    variants: 3, tints: ['#3f8f78', '#46946a', '#3a8570', '#4f9a64'], snow: true,
    build(b, { v }) {
      const R = rng(77 + v * 19), sw = sway(0.45, 0.45), BK = '#9c7e60';
      const top = [[0.02, 1.0, 0], [0.06, 1.05, -0.04], [-0.03, 1.12, 0.02]][v];
      limb(b, [0, 0, 0], top, 0.27, 0.17, 8, { color: BK, wave: sw, sx: 1.08 });
      b.ball(0.1, 0, { x: 0.17, y: 0.62 + v * 0.05, z: 0.12, sy: 1.3, color: shade(BK, -0.04), wave: sw });
      const nr = 5;
      for (let i = 0; i < nr; i++) {
        const a = (i + R() * 0.4) / nr * TAU + v, L = 0.55 + R() * 0.18, p = [Math.cos(a) * 0.1, 0.46 + R() * 0.1, Math.sin(a) * 0.1], q = [Math.cos(a) * L, -0.02, Math.sin(a) * L];
        limb(b, p, q, 0.12, 0.035, 5, { color: shade(BK, -0.03), sx: 0.75 });
        if (i === 0 || i === 2) { const m = lerp3(p, q, 0.5); b.blob(0.16, 0.05, 0.09, 1, { x: m[0], y: m[1] + 0.06, z: m[2], ry: -a, rz: -0.55, color: MOSS }); }
      }
      const C = [
        [[0, 1.86, 0, 0.5, 0.7], [0.55, 1.6, 0.1, 0.4], [-0.52, 1.64, -0.1, 0.41], [0.12, 1.58, 0.54, 0.4], [-0.1, 1.6, -0.54, 0.4], [-0.4, 1.56, 0.4, 0.34], [0.2, 2.02, -0.12, 0.32]],
        [[0.1, 1.82, 0.02, 0.52, 0.68], [0.66, 1.56, 0.06, 0.38], [-0.44, 1.66, -0.2, 0.42], [0.22, 1.56, 0.56, 0.38], [0.0, 1.58, -0.56, 0.4], [0.44, 1.5, -0.42, 0.32], [-0.2, 1.98, 0.14, 0.3]],
        [[0, 1.92, 0, 0.46, 0.75], [0.48, 1.68, 0.18, 0.38], [-0.48, 1.7, 0.08, 0.38], [0.04, 1.66, -0.5, 0.42], [-0.2, 1.62, 0.5, 0.36], [0.4, 1.62, -0.38, 0.32], [0, 2.1, 0.02, 0.3]],
      ][v];
      for (const i of [1, 2, 3]) limb(b, [top[0], top[1] - 0.12, top[2]], [C[i][0] * 0.7, C[i][1] - 0.1, C[i][2] * 0.7], 0.12, 0.05, 6, { color: BK, wave: sw });
      const caps = crown(b, C, 0.72, R, sw, { lo: 0.78, hi: 1.12 });
      for (let i = 0; i < 2; i++) { const a = i * PI + v; b.ball(0.028, 0, { x: Math.cos(a) * 0.55, y: 1.08 + i * 0.22, z: Math.sin(a) * 0.55, color: '#d9ff8a', glow: 1, spin: { c: [0, 0, 0], axis: [0, 1, 0], speed: 0.5 + i * 0.2 } }); }
      b.part = 1; snowCaps(b, caps, 4, sw);
    },
  },
  // ------------------------------------------------------------------ tocón
  stump: {
    build(b) {
      const R = rng(81);
      b.cyl(0.13, 0.155, 0.2, 7, { y: 0.1, color: BARK });
      b.cyl(0.123, 0.123, 0.02, 7, { y: 0.2, color: '#d9b27a' });
      b.cyl(0.075, 0.075, 0.02, 7, { y: 0.206, color: '#c49a62' });
      b.cyl(0.028, 0.028, 0.02, 6, { y: 0.212, color: '#a8804e' });
      b.cone(0.035, 0.1, 4, { x: 0.09, y: 0.25, z: -0.05, rz: -0.25, color: '#c9a26c' });
      roots(b, 4, 0.055, 0.22, 0.09, BARK_D, R, 0.3);
      b.blob(0.07, 0.03, 0.05, 1, { x: -0.11, y: 0.06, z: 0.08, ry: 0.8, rz: 0.9, color: MOSS });
    },
  },

  // =====================================================================
  // Recursos
  // =====================================================================
  mine_gold: mine('gold'), mine_stone: mine('stone'), mine_iron: mine('iron'), mine_gems: mine('gems'),
  // ------------------------------------------------------------------ arbusto de bayas
  bush_berry: {
    build(b) {
      const R = rng(611), L = '#4a8c3e', sw = sway(0, 0.45);
      const bl = [[0, 0.25, 0, 0.24], [0.18, 0.17, 0.06, 0.17], [-0.17, 0.18, -0.05, 0.18], [0.04, 0.16, 0.18, 0.16], [-0.03, 0.17, -0.18, 0.16]];
      b.blob(0.3, 0.06, 0.28, 0, { y: 0.03, color: shade(L, -0.06) });
      bl.forEach(([x, y, z, r], i) => b.ball(r, 1, { x, y, z, sy: 0.85, ry: R() * 3, color: shade(L, i ? -0.03 + R() * 0.06 : 0.05), wave: sw }));
      b.part = 1;
      for (let i = 0; i < 11; i++) {
        const k = bl[i % 5], a = R() * TAU, e = 0.25 + R() * 0.95;
        b.ball(0.03, 0, { x: k[0] + Math.cos(a) * Math.cos(e) * k[3], y: k[1] + Math.sin(e) * k[3] * 0.85, z: k[2] + Math.sin(a) * Math.cos(e) * k[3], color: i % 3 ? '#d22f3c' : '#7a2c6a', glow: 0.12, wave: sw });
      }
    },
  },
  // ------------------------------------------------------------------ banco de peces (origen = superficie del agua)
  fish_spot: {
    build(b) {
      const W = '#d6eef6', FISH = '#5f7f92', SILVER = '#a9c3d0';
      b.torus(0.2, 0.011, 16, 3, { y: 0.004, rx: PI / 2, sz: 0.35, color: W });
      b.torus(0.34, 0.009, 18, 3, { x: 0.03, y: 0.002, z: -0.02, rx: PI / 2, sz: 0.35, color: shade(W, -0.05) });
      // pez que nada en círculo: lomo, aleta dorsal y cola asoman del agua
      const sp = { c: [0, 0, 0], axis: [0, 1, 0], speed: 1.3 };
      b.blob(0.038, 0.032, 0.11, 1, { x: 0.2, y: -0.004, color: FISH, spin: sp });
      b.cone(0.045, 0.07, 4, { x: 0.2, y: 0.045, z: 0.015, rx: 0.45, sx: 0.18, color: shade(FISH, -0.06), spin: sp });
      b.cone(0.04, 0.06, 4, { x: 0.2, y: 0.012, z: 0.13, rx: -PI / 2, sx: 0.18, color: shade(FISH, -0.06), spin: sp });
      // pez que salta (gira en un círculo vertical medio sumergido)
      const jp = { c: [-0.06, -0.09, 0.05], axis: [0, 0, 1], speed: 2.3 };
      b.blob(0.065, 0.026, 0.022, 1, { x: -0.06, y: 0.06, z: 0.05, color: SILVER, spin: jp });
      b.cone(0.03, 0.045, 4, { x: 0.02, y: 0.06, z: 0.05, rz: PI / 2, sz: 0.2, color: shade(SILVER, -0.1), spin: jp });
      for (const [x, z, r] of [[-0.12, -0.14, 0.014], [0.1, -0.2, 0.011], [-0.2, 0.08, 0.012]]) b.ball(r, 0, { x, y: 0.006, z, color: '#ffffff' });
    },
  },

  // =====================================================================
  // Decoración (≤ 12 primitivas)
  // =====================================================================
  decor_flowers: {
    variants: 4,
    build(b, { v }) {
      const R = rng(301 + v * 17), sw = sway(0, 0.9);
      const [P1, P2, CEN] = [['#e8475a', '#f2788a', '#ffd84a'], ['#f2b62a', '#f7d860', '#b8581e'], ['#7f62de', '#a98cf0', '#f2e27a'], ['#f4f1e8', '#ffffff', '#f2c230']][v];
      b.blob(0.17, 0.05, 0.13, 0, { y: 0.015, ry: R() * 3, color: '#4f8f3a' });
      b.blob(0.11, 0.045, 0.1, 0, { x: 0.13, y: 0.015, z: -0.09, ry: R() * 3, color: '#5f9d44' });
      for (let i = 0; i < 4; i++) {
        const a = i * 1.57 + R() * 0.8, d = 0.07 + R() * 0.11, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.1 + R() * 0.1, col = i % 2 ? P2 : P1;
        b.cyl(0.007, 0.009, h, 4, { x, y: h / 2, z, color: '#4a8a34', wave: sw });
        if (v === 0) b.cyl(0.042, 0.022, 0.065, 6, { x, y: h + 0.025, z, color: col, wave: sw });
        else if (v === 2) b.cone(0.038, 0.065, 5, { x, y: h - 0.01, z, rx: PI, color: col, wave: sw });
        else b.add(petals(0.055, v === 3 ? 7 : 6, 0.015, 40 + i), { x, y: h + 0.004, z, ry: R() * 3, color: col, wave: sw });
        if (i < 2) {
          if (v === 1 || v === 3) b.ball(0.018, 0, { x, y: h + 0.014, z, color: CEN, wave: sw });
          else b.cone(0.03, 0.12, 3, { x: x * 1.6, y: 0.06, z: z * 1.6, rz: (x > 0 ? -1 : 1) * 0.3, sz: 0.35, color: '#5a9a3e', wave: sw });
        }
      }
    },
  },
  decor_grass_tuft: {
    variants: 2,
    build(b, { v }) {
      const R = rng(401 + v * 7), n = v ? 7 : 9, sw = (x, y) => Math.max(0, y) * 1.4;
      const tips = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + R() * 0.5, tilt = 0.2 + R() * 0.45, h = (v ? 0.34 : 0.2) * (0.7 + R() * 0.5);
        const tip = [Math.cos(a) * Math.sin(tilt) * h, Math.cos(tilt) * h, Math.sin(a) * Math.sin(tilt) * h];
        limb(b, [Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025], tip, 0.024, 0.002, 3, { color: shade(GRASS, (R() - 0.4) * 0.14), wave: sw });
        tips.push(tip);
      }
      if (v) for (let i = 0; i < 3; i++) { const t = tips[i * 2]; b.blob(0.016, 0.04, 0.016, 0, { x: t[0], y: t[1] + 0.02, z: t[2], color: '#d8c070', wave: sw }); }
      else b.blob(0.09, 0.025, 0.08, 0, { y: 0.01, color: shade(GRASS, -0.06) });
    },
  },
  decor_rock_small: {
    variants: 3,
    build(b, { v }) {
      const R = rng(451 + v * 11);
      if (v === 0) { rock(b, rockFaces(1 + v, 0.15, 0.17, 0.12), { color: STONE, ry: R() * 3 }); rock(b, rockFaces(7, 0.06, 0.06, 0.05), { x: 0.16, z: 0.08, color: shade(STONE, -0.06) }); }
      else if (v === 1) { rock(b, rockFaces(3, 0.12, 0.12, 0.1), { x: -0.08, color: shade(STONE, 0.03), ry: 1 }); rock(b, rockFaces(4, 0.1, 0.09, 0.09), { x: 0.1, z: 0.05, color: shade(STONE, -0.05), ry: 2 }); rock(b, rockFaces(8, 0.05, 0.05, 0.04), { x: 0.02, z: -0.12, color: STONE }); }
      else { rock(b, rockFaces(5, 0.2, 0.07, 0.15), { color: '#9a978f', ry: 0.4 }, { k: 0.75, color: MOSS }); rock(b, rockFaces(9, 0.05, 0.05, 0.05), { x: -0.17, z: 0.1, color: STONE }); rock(b, rockFaces(10, 0.04, 0.04, 0.035), { x: 0.18, z: -0.1, color: shade(STONE, -0.06) }); }
    },
  },
  decor_rock_big: {
    build(b) {
      rock(b, rockFaces(21, 0.34, 0.48, 0.3), { color: '#9c978e', ry: 0.3 }, { k: 0.72, color: '#6f9a4a' });
      rock(b, rockFaces(22, 0.18, 0.24, 0.16), { x: 0.3, z: 0.18, color: shade('#9c978e', -0.05), ry: 1.2 });
      rock(b, rockFaces(23, 0.08, 0.07, 0.07), { x: -0.3, z: 0.22, color: '#9c978e' });
      rock(b, rockFaces(24, 0.06, 0.05, 0.05), { x: 0.05, z: 0.36, color: shade('#9c978e', 0.04) });
      b.cone(0.03, 0.14, 3, { x: -0.22, y: 0.06, z: 0.27, rz: 0.3, sz: 0.4, color: GRASS });
      b.cone(0.028, 0.12, 3, { x: -0.18, y: 0.05, z: 0.3, rz: -0.25, sz: 0.4, color: shade(GRASS, 0.05) });
    },
  },
  decor_mushroom: {
    variants: 2,
    build(b, { v }) {
      const R = rng(501 + v * 3);
      if (v === 0) {
        for (const [x, z, h, r] of [[0, 0, 0.15, 0.085], [0.13, 0.07, 0.09, 0.055]]) {
          b.cyl(0.02, 0.028, h, 6, { x, y: h / 2, z, color: '#f1ead8' });
          b.blob(r, r * 0.55, r, 1, { x, y: h, z, color: '#d8342c' });
        }
        for (const [x, y, z] of [[0.03, 0.195, 0.02], [-0.04, 0.188, -0.01], [0.0, 0.18, -0.05], [0.12, 0.122, 0.08]]) b.ball(0.012, 0, { x, y, z, color: '#fff8ea' });
        b.cone(0.025, 0.1, 3, { x: -0.08, y: 0.045, z: 0.06, rz: 0.35, sz: 0.4, color: GRASS });
      } else {
        b.blob(0.14, 0.03, 0.11, 0, { y: 0.01, color: MOSS });
        for (const [x, z, h, r, c] of [[0, 0, 0.12, 0.06, '#9a6238'], [0.08, 0.05, 0.08, 0.045, '#b8834e'], [-0.07, 0.06, 0.07, 0.04, '#8a5432'], [0.03, -0.08, 0.06, 0.035, '#c49a62']]) {
          b.cyl(0.013, 0.018, h, 5, { x, y: h / 2, z, rz: x * 1.5, color: '#efe6cf' });
          b.cyl(0.006, r, r * 0.7, 7, { x: x * 1.12, y: h + r * 0.2, z, rz: x * 1.5, color: c });
        }
      }
    },
  },
  decor_reeds: {
    build(b) {
      const R = rng(551), sw = (x, y) => Math.max(0, y) * 1.1;
      b.blob(0.16, 0.025, 0.12, 0, { y: -0.005, color: '#5c6a3a' });
      const tops = [];
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3 + R(), d = 0.04 + R() * 0.07, p = [Math.cos(a) * d, -0.02, Math.sin(a) * d], h = 0.42 + R() * 0.2, q = [p[0] * 1.8 + (R() - 0.5) * 0.06, h, p[2] * 1.8 + (R() - 0.5) * 0.06];
        limb(b, p, q, 0.009, 0.004, 4, { color: shade('#7a9a4a', (R() - 0.5) * 0.1), wave: sw }); tops.push([p, q]);
      }
      for (let i = 0; i < 3; i++) { const [p, q] = tops[i]; limb(b, lerp3(p, q, 0.68), lerp3(p, q, 0.86), 0.022, 0.02, 6, { color: '#6b4628', wave: sw }); }
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; limb(b, [0, 0, 0], [Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14], 0.022, 0.002, 3, { color: '#6f9a4a', sz: 0.4, wave: sw }); }
    },
  },
  decor_bones: {
    build(b) {
      for (let i = 0; i < 3; i++) b.torus(0.1 - i * 0.012, 0.011, 8, 4, { x: -0.1 + i * 0.07, y: -0.02, ry: PI / 2, color: shade(BONE, -i * 0.03) });
      b.cyl(0.014, 0.012, 0.3, 5, { x: -0.04, y: 0.075, rz: PI / 2, color: BONE });
      b.ball(0.055, 0, { x: 0.17, y: 0.05, z: 0.02, sx: 1.1, sy: 0.85, color: BONE });
      b.box(0.08, 0.04, 0.05, { x: 0.23, y: 0.03, z: 0.04, ry: -0.3, color: shade(BONE, -0.04) });
      b.cone(0.016, 0.1, 5, { x: 0.15, y: 0.09, z: -0.05, rx: -1.1, rz: 0.3, color: '#d8cba8' });
      b.cone(0.016, 0.1, 5, { x: 0.16, y: 0.09, z: 0.09, rx: 1.1, rz: 0.3, color: '#d8cba8' });
      b.box(0.02, 0.018, 0.016, { x: 0.215, y: 0.065, z: -0.01, color: '#3a2c20' });
      b.box(0.02, 0.018, 0.016, { x: 0.22, y: 0.065, z: 0.05, color: '#3a2c20' });
      b.cyl(0.011, 0.011, 0.17, 5, { x: 0.02, y: 0.012, z: 0.2, rz: PI / 2, ry: 0.5, color: BONE });
      b.ball(0.02, 0, { x: -0.055, y: 0.014, z: 0.245, color: BONE });
    },
  },
  decor_snowrock: {
    build(b) {
      const G = '#8f949c';
      rock(b, rockFaces(31, 0.26, 0.34, 0.22), { color: G, ry: 0.5 }, { k: 0.62, color: SNOW });
      rock(b, rockFaces(32, 0.11, 0.13, 0.1), { x: 0.26, z: 0.14, color: shade(G, -0.04), ry: 1.4 }, { k: 0.62, color: SNOW });
      b.blob(0.2, 0.035, 0.12, 1, { x: -0.18, y: 0.0, z: 0.2, ry: 0.4, color: SNOW });
    },
  },
  decor_ruin_pillar: {
    build(b) {
      const R = rng(651), M = '#d6ccb8';
      b.box(0.38, 0.08, 0.38, { y: 0.04, color: '#b8ae9a', ry: 0.1 });
      b.cyl(0.15, 0.17, 0.06, 8, { y: 0.11, color: shade(M, -0.05) });
      // fuste roto: cilindro con la boca dentada
      const n = 8, rr = 0.12, hs = [0.78, 0.66, 0.72, 0.58, 0.62, 0.74, 0.8, 0.7], top = [], bot = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU; top.push([Math.cos(a) * rr, hs[i], Math.sin(a) * rr]); bot.push([Math.cos(a) * rr * 1.04, 0.13, Math.sin(a) * rr * 1.04]); }
      const tc = [0.02, 0.66, 0], F = [];
      for (let i = 0; i < n; i++) { const k = (i + 1) % n; F.push([bot[i], bot[k], top[k]], [bot[i], top[k], top[i]], [top[i], top[k], tc]); }
      b.add(tri(F, { c: [0, 0.4, 0] }), { color: M, ry: 0.3 });
      for (let i = 0; i < 4; i++) b.box(0.012, 0.42, 0.02, { x: Math.cos(i * 0.8 + 1.0) * 0.121, y: 0.38, z: Math.sin(i * 0.8 + 1.0) * 0.121, ry: -(i * 0.8 + 1.0), color: shade(M, -0.1) });
      b.cyl(0.115, 0.115, 0.2, 8, { x: 0.27, y: 0.115, z: 0.22, rz: PI / 2, ry: 0.7, color: shade(M, 0.03) });
      b.box(0.09, 0.06, 0.07, { x: -0.25, y: 0.03, z: 0.2, ry: 0.5, rz: 0.2, color: shade(M, -0.06) });
      b.blob(0.07, 0.11, 0.05, 0, { x: -0.1, y: 0.3, z: 0.08, ry: 0.6, color: '#5a8a3a' });
      b.blob(0.09, 0.04, 0.08, 0, { x: -0.16, y: 0.09, z: 0.12, color: '#4f7f34' });
    },
  },
  decor_signpost: {
    build(b) {
      b.box(0.05, 0.64, 0.05, { y: 0.32, color: WOOD_D });
      b.pyramid(0.07, 0.05, 0.07, { y: 0.665, color: shade(WOOD_D, -0.06) });
      const arrow = [[-0.14, 0.035], [0.1, 0.035], [0.15, 0], [0.1, -0.035], [-0.14, -0.035]];
      for (const [y, a] of [[0.54, 0.35], [0.4, 2.7]]) {
        b.extrude(arrow, 0.02, { x: Math.cos(a) * 0.07, y, z: -Math.sin(a) * 0.07 + 0.03, ry: a, color: WOOD_L });
        b.box(0.12, 0.008, 0.022, { x: Math.cos(a) * 0.06, y: y + 0.005, z: -Math.sin(a) * 0.06 + 0.03, ry: a, color: '#5a3b26' });
      }
      rock(b, rockFaces(41, 0.08, 0.07, 0.07), { x: -0.06, z: 0.05, color: STONE });
      rock(b, rockFaces(42, 0.06, 0.05, 0.05), { x: 0.07, z: 0.04, color: shade(STONE, -0.05) });
    },
  },
  decor_campfire: {
    build(b) {
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.2; b.ball(0.05, 0, { x: Math.cos(a) * 0.16, y: 0.025, z: Math.sin(a) * 0.16, sy: 0.7, ry: a, color: shade('#8f8a82', (i % 3) * 0.04 - 0.04) }); }
      b.cyl(0.12, 0.13, 0.02, 7, { y: 0.01, color: '#4a4440' });
      b.cyl(0.026, 0.026, 0.26, 6, { y: 0.05, rz: PI / 2, ry: 0.5, color: '#5a3e26' });
      b.cyl(0.026, 0.026, 0.26, 6, { y: 0.07, rz: PI / 2, ry: -0.6, color: '#4a3424' });
      const fl = (x, y) => Math.max(0, y - 0.05) * 2.2;
      b.cone(0.075, 0.24, 5, { y: 0.17, color: '#ff7a1e', glow: 1, wave: fl });
      b.cone(0.045, 0.17, 5, { x: 0.02, y: 0.15, z: 0.02, ry: 0.5, color: '#ffd23a', glow: 1, wave: fl });
      b.cone(0.035, 0.13, 4, { x: -0.05, y: 0.12, z: -0.02, ry: 1, color: '#ff4a1a', glow: 1, wave: fl });
    },
  },

  // =====================================================================
  // Tesoros
  // =====================================================================
  treasure_chest: {
    build(b) {
      const WD = '#8a5a30', TRIM = '#d4af37', w = 0.36, d = 0.24, h = 0.2;
      b.box(w, h, d, { y: h / 2, color: WD });
      b.box(w + 0.02, 0.03, d + 0.02, { y: 0.015, color: '#5a3b26' });
      for (const x of [-0.12, 0.12]) b.box(0.035, h + 0.004, d + 0.012, { x, y: h / 2, color: TRIM });
      b.box(0.06, 0.07, 0.02, { y: h - 0.03, z: d / 2 + 0.008, color: TRIM });
      // tapa: media caña (perfil semicircular extruido a lo largo de X) con la bisagra atrás
      const arc = []; for (let i = 0; i <= 6; i++) { const a = i / 6 * PI; arc.push([-d / 2 - Math.cos(a) * d / 2, Math.sin(a) * 0.1]); }
      const lid = (open) => {
        const o = { y: h, z: -d / 2, ry: PI / 2, rx: open ? -1.95 : 0, order: 'XYZ' };
        b.extrude(arc, w, Object.assign({ color: shade(WD, 0.04) }, o));
        for (const x of [-0.12, 0.12]) b.extrude(arc.map(([u, v2]) => [u * 1.03 + d * 0.015, v2 * 1.1]), 0.036, Object.assign({}, o, { x, color: TRIM }));
      };
      b.part = 1; lid(false);
      b.box(0.04, 0.05, 0.02, { y: h + 0.02, z: d / 2 + 0.01, color: TRIM });
      b.part = 2; lid(true);
      b.blob(w * 0.45, 0.05, d * 0.42, 1, { y: h - 0.005, color: GOLD, glow: 0.35 });
      b.ball(0.025, 0, { x: 0.08, y: h + 0.04, z: 0.02, color: '#e0405a', glow: 0.4 });
      b.cyl(0.024, 0.024, 0.008, 8, { x: -0.08, y: h + 0.045, z: 0.03, rx: 0.5, color: GOLD, glow: 0.35 });
    },
  },
  treasure_gold_pile: {
    build(b) {
      const R = rng(701);
      b.blob(0.22, 0.13, 0.19, 1, { y: 0.0, color: GOLD, glow: 0.25 });
      b.blob(0.12, 0.08, 0.11, 1, { x: 0.18, y: 0.0, z: 0.1, color: shade(GOLD, -0.04), glow: 0.25 });
      for (let i = 0; i < 5; i++) { const a = R() * TAU, d = 0.22 + R() * 0.08; b.cyl(0.03, 0.03, 0.01, 8, { x: Math.cos(a) * d, y: 0.012, z: Math.sin(a) * d, rx: (R() - 0.5) * 0.6, color: shade(GOLD, 0.04), glow: 0.3 }); }
      b.cyl(0.035, 0.022, 0.06, 7, { x: -0.06, y: 0.15, z: 0.02, rz: 0.4, color: '#e8c050', glow: 0.2 });
      b.cyl(0.006, 0.02, 0.05, 6, { x: -0.04, y: 0.12, z: 0.02, rz: 0.4, color: '#e8c050' });
      b.ball(0.03, 0, { x: 0.05, y: 0.12, z: 0.08, color: '#e0405a', glow: 0.45 });
      b.ball(0.025, 0, { x: -0.12, y: 0.07, z: 0.12, color: '#4ab0ff', glow: 0.45 });
    },
  },
  treasure_relic: {
    build(b) {
      const S = '#a39e94', C = '#9ff8f2';
      b.cyl(0.19, 0.21, 0.06, 6, { y: 0.03, color: shade(S, -0.05) });
      b.cyl(0.09, 0.11, 0.22, 6, { y: 0.17, color: S });
      b.cyl(0.14, 0.12, 0.05, 6, { y: 0.3, color: shade(S, 0.04) });
      for (const a of [0, PI]) b.box(0.03, 0.14, 0.01, { x: Math.sin(a) * 0.098, y: 0.17, z: Math.cos(a) * 0.098, ry: a, color: C, glow: 0.8 });
      const cy = 0.5, spin = { c: [0, cy, 0], axis: [0, 1, 0], speed: 1.1 };
      b.add(bipyr(0.07, 0.12, 0.1, 6), { y: cy, color: C, glow: 0.9, spin });
      b.torus(0.13, 0.01, 14, 3, { y: cy - 0.02, rx: PI / 2 + 0.3, color: '#e8fffd', glow: 0.8, spin: { c: [0, cy, 0], axis: [0, 1, 0], speed: -0.7 } });
      for (let i = 0; i < 2; i++) { const a = i * PI; b.add(bipyr(0.022, 0.04, 0.03, 4), { x: Math.cos(a) * 0.18, y: cy + 0.05 - i * 0.1, z: Math.sin(a) * 0.18, color: '#c8fff8', glow: 1, spin: { c: [0, cy, 0], axis: [0, 1, 0], speed: 1.8 } }); }
    },
  },

  // =====================================================================
  // Andamios y escombros
  // =====================================================================
  scaffold_1: scaffold(1), scaffold_2: scaffold(2), scaffold_3: scaffold(3), scaffold_4: scaffold(4),
  rubble_1: rubble(1), rubble_2: rubble(2), rubble_3: rubble(3), rubble_4: rubble(4),

  // =====================================================================
  // Proyectiles (centrados, apuntando a +Z)
  // =====================================================================
  proj_arrow: {
    build(b) {
      b.cyl(0.0085, 0.0085, 0.28, 5, { z: -0.01, rx: PI / 2, color: '#b08a58' });
      b.cone(0.022, 0.06, 4, { z: 0.155, rx: PI / 2, color: STEEL });
      b.box(0.004, 0.05, 0.075, { z: -0.11, color: '#efe9da' });
      b.box(0.05, 0.004, 0.075, { z: -0.11, color: '#c0392b' });
      b.box(0.018, 0.018, 0.012, { z: -0.152, color: '#5a3b26' });
    },
  },
  proj_bolt: {
    build(b) {
      b.cyl(0.013, 0.013, 0.17, 6, { z: -0.01, rx: PI / 2, color: '#8a6440' });
      b.cone(0.03, 0.065, 4, { z: 0.105, rx: PI / 2, ry: PI / 4, color: '#9aa2ac' });
      b.box(0.005, 0.042, 0.05, { z: -0.07, color: '#6b4a2c' });
      b.box(0.042, 0.005, 0.05, { z: -0.07, color: '#6b4a2c' });
    },
  },
  proj_axe: {
    build(b) {
      const spin = { c: [0, 0, 0], axis: [1, 0, 0], speed: 16 };
      b.cyl(0.012, 0.014, 0.22, 6, { y: -0.02, color: '#8a6440', spin });
      b.box(0.02, 0.04, 0.03, { y: -0.1, color: '#5a3b26', spin });
      b.box(0.022, 0.05, 0.035, { y: 0.075, color: '#6d737c', spin });
      b.extrude([[0.0, 0.1], [-0.04, 0.095], [-0.085, 0.135], [-0.105, 0.075], [-0.085, 0.02], [-0.04, 0.055], [0.0, 0.05]], 0.012, { ry: PI / 2, color: STEEL, spin });
    },
  },
  proj_rock: {
    build(b) {
      const spin = { c: [0, 0, 0], axis: [1, 0, 0], speed: 7 };
      b.add(tri(rockFaces(91, 0.12, 0.22, 0.115, 6)), { y: -0.105, color: '#8d877d', spin });
      b.ball(0.05, 0, { x: 0.07, y: 0.06, z: 0.04, color: '#7f796f', spin });
      b.ball(0.04, 0, { x: -0.06, y: -0.05, z: 0.07, color: '#9a948a', spin });
    },
  },
  proj_cannonball: {
    build(b) {
      b.ball(0.06, 1, { color: '#4c4e55' });
      b.ball(0.034, 0, { z: -0.1, color: '#cfcac0' });
      b.ball(0.024, 0, { x: 0.01, z: -0.155, color: '#e2ded6' });
    },
  },
  proj_magic: {
    build(b) {
      b.ball(0.055, 1, { color: '#38c8f0', glow: 1 });
      b.torus(0.08, 0.008, 14, 3, { color: '#e8ffff', glow: 1, spin: { c: [0, 0, 0], axis: [0, 0, 1], speed: 6 } });
      b.torus(0.075, 0.007, 14, 3, { ry: PI / 2, color: '#b8a0ff', glow: 1, spin: { c: [0, 0, 0], axis: [0, 1, 0], speed: -5 } });
      b.cone(0.04, 0.16, 6, { z: -0.1, rx: -PI / 2, color: '#2a9ad0', glow: 1 });
      b.ball(0.016, 0, { x: 0.09, color: '#ffffff', glow: 1, spin: { c: [0, 0, 0], axis: [0, 0, 1], speed: 9 } });
      b.ball(0.012, 0, { x: -0.07, y: 0.04, z: -0.06, color: '#d8c8ff', glow: 1 });
    },
  },
  proj_frost: {
    build(b) {
      const spin = { c: [0, 0, 0], axis: [0, 0, 1], speed: 6 };
      b.add(bipyr(0.035, 0.17, 0.07, 5), { rx: PI / 2, color: '#8fd4ff', glow: 0.6, spin });
      b.add(bipyr(0.018, 0.08, 0.03, 4), { x: 0.035, y: 0.01, z: -0.04, rx: PI / 2 + 0.35, rz: 0.4, color: '#e8f8ff', glow: 0.8, spin });
      b.add(bipyr(0.016, 0.07, 0.03, 4), { x: -0.03, y: -0.02, z: -0.05, rx: PI / 2 + 0.3, rz: -0.5, color: '#9fd8ff', glow: 0.8, spin });
      b.ball(0.014, 0, { z: -0.13, color: '#e8f8ff', glow: 0.6 });
      b.ball(0.01, 0, { x: 0.02, z: -0.17, color: '#e8f8ff', glow: 0.5 });
    },
  },
  proj_lightning: {
    build(b) {
      const P = [[0, 0, -0.16], [0.04, 0.02, -0.08], [-0.035, -0.01, 0.0], [0.035, 0.015, 0.08], [0, 0, 0.16]];
      for (let i = 0; i < 4; i++) beam(b, P[i], P[i + 1], 0.018, 0.018, { color: '#ffd83a', glow: 1 });
      beam(b, P[2], [-0.08, 0.03, 0.05], 0.012, 0.012, { color: '#ffe680', glow: 1 });
      b.ball(0.026, 0, { z: 0.16, color: '#ffffff', glow: 1 });
    },
  },
};

// =====================================================================
// Generadores compartidos (minas, andamios, escombros)
// =====================================================================
/** Afloramiento rocoso ~0.9 de ancho con vetas; piezas 1 y 2 = trozos de mineral según la cantidad. */
function mine(kind) {
  const K = {
    gold: { rock: '#8f857a', ore: GOLD, glow: 0.4, seed: 1 },
    stone: { rock: '#b3aea4', ore: '#d8d2c4', glow: 0, seed: 2 },
    iron: { rock: '#8e827a', ore: '#b0603a', glow: 0, seed: 3 },
    gems: { rock: '#6c667c', ore: '#b47cff', glow: 0.55, seed: 4 },
  }[kind];
  const ROCKS = [[0, -0.03, 0.3, 0.5, 0.27], [0.27, 0.1, 0.19, 0.3, 0.18], [-0.26, 0.06, 0.2, 0.34, 0.19], [0.06, -0.28, 0.22, 0.36, 0.18], [-0.1, 0.27, 0.13, 0.16, 0.12]];
  const GEMS = ['#b47cff', '#5fe0ff', '#ff6fc8'];
  return {
    build(b) {
      const R = rng(1000 + K.seed * 37);
      ROCKS.forEach(([x, z, w, h, d], i) => {
        const F = rockFaces(K.seed * 50 + i, w, h, d), o = { x, z, ry: R() * TAU, color: shade(K.rock, (i % 3) * 0.035 - 0.03) };
        rock(b, F, o);
        if (kind === 'stone') { if (i < 3) b.add(veins(F, R, 2, 0.6), Object.assign({}, o, { color: K.ore })); }
        else if (i < 4) b.add(veins(F, R, i ? 2 : 4, 0.6), Object.assign({}, o, { color: K.ore, glow: K.glow }));
        if (kind === 'iron' && i < 2) b.add(veins(F, R, 2, 0.45), Object.assign({}, o, { color: '#5d6470' }));
      });
      if (kind === 'gems') for (const [x, y, z, s, c] of [[0.1, 0.06, 0.2, 1.3, 0], [-0.18, 0.08, 0.18, 1.1, 1], [0.02, 0.38, 0.0, 1.2, 2]]) b.add(crystal(0.04 * s, 0.13 * s, 0.06 * s), { x, y, z, rz: -x * 1.6, rx: z * 1.5, color: GEMS[c], glow: K.glow });
      // trozos sueltos: pieza 1 (> 66 %) y pieza 2 (> 33 %)
      const chunks = [
        [1, [[0.04, 0.46, -0.04, 1.0], [0.3, 0.27, 0.1, 0.8], [-0.24, 0.3, 0.04, 0.85], [0.36, 0.03, 0.3, 0.7], [-0.36, 0.03, 0.28, 0.75]]],
        [2, [[0.16, 0.03, 0.34, 0.85], [-0.02, 0.03, 0.4, 0.7], [0.42, 0.03, -0.1, 0.75], [-0.4, 0.03, -0.14, 0.7]]],
      ];
      for (const [part, list] of chunks) {
        b.part = part;
        list.forEach(([x, y, z, s], i) => {
          const ry = R() * TAU;
          if (kind === 'gold') b.ball(0.055 * s, 0, { x, y: y + 0.02, z, sy: 0.8, ry, color: shade(GOLD, (i % 2) * 0.05), glow: 0.5 });
          else if (kind === 'stone') { b.box(0.15 * s, 0.09 * s, 0.11 * s, { x, y: y + 0.045 * s, z, ry, color: shade('#c9c3b6', (i % 2) * 0.04 - 0.02) }); }
          else if (kind === 'iron') rock(b, rockFaces(300 + part * 10 + i, 0.06 * s, 0.07 * s, 0.05 * s, 5), { x, y: y - 0.01, z, ry, color: i % 2 ? '#a0583a' : '#8a4e36' });
          else b.add(crystal(0.042 * s, 0.15 * s, 0.065 * s), { x, y: y - 0.01, z, ry, rz: (R() - 0.5) * 0.7, rx: (R() - 0.5) * 0.7, color: GEMS[(i + part) % 3], glow: 0.6 });
        });
      }
      b.part = 0;
    },
  };
}

/** Andamio para una huella fp×fp centrada en el origen, exactamente 1.0 de alto (el motor lo estira en Y). */
function scaffold(fp) {
  return {
    fp,
    build(b) {
      const h = fp / 2 - 0.03, n = Math.max(1, Math.round(fp)), st = 2 * h / n, R = rng(800 + fp);
      const P = WOOD, L = [0.33, 0.66, 0.975];
      // postes en esquinas y a lo largo de los lados
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
        if (i && j && i < n && j < n) continue;
        b.box(0.042, 1.0, 0.042, { x: -h + i * st, y: 0.5, z: -h + j * st, color: shade(P, (R() - 0.5) * 0.08) });
      }
      // largueros horizontales en tres alturas
      for (const y of L) {
        b.box(2 * h + 0.04, 0.024, 0.026, { y, z: h, color: shade(P, 0.03) }); b.box(2 * h + 0.04, 0.024, 0.026, { y, z: -h, color: shade(P, -0.02) });
        b.box(0.026, 0.024, 2 * h + 0.04, { x: h, y, color: shade(P, 0.01) }); b.box(0.026, 0.024, 2 * h + 0.04, { x: -h, y, color: shade(P, -0.03) });
      }
      // plataformas de tablones (frente y lado derecho) en los dos primeros niveles
      for (const [k, y] of [[0, L[0]], [1, L[1]]]) {
        for (let s = 0; s < 2; s++) {
          const off = h + 0.005 - s * 0.065, c = shade(WOOD_L, (s ? -0.04 : 0.02) + k * 0.02);
          if (k === 0 || fp > 1) b.box(2 * h + 0.06, 0.02, 0.06, { y: y + 0.022, z: off, color: c });
          if (k === 1 || fp > 1) b.box(0.06, 0.02, 2 * h + 0.06, { x: off, y: y + 0.022, color: c });
        }
      }
      // tornapuntas en diagonal (bahías alternas de cada lado)
      for (let i = 0; i < n; i++) {
        const a = -h + i * st, c = a + st, low = i % 2 ? 0.66 : 0.02, high = i % 2 ? 0.02 : 0.66;
        if (i % 2 === 0 || n === 1) { beam(b, [a, low, h + 0.03], [c, high, h + 0.03], 0.02, 0.016, { color: shade(P, -0.05) }); beam(b, [-h - 0.03, low, a], [-h - 0.03, high, c], 0.016, 0.02, { color: shade(P, -0.06) }); }
        if (i % 2 === 1 || n === 1) { beam(b, [h + 0.03, 0.33, a], [h + 0.03, 0.97, c], 0.016, 0.02, { color: shade(P, -0.05) }); beam(b, [a, 0.33, -h - 0.03], [c, 0.97, -h - 0.03], 0.02, 0.016, { color: shade(P, -0.06) }); }
      }
      // escalera apoyada en el frente
      const lx = fp > 1 ? h - st * 0.5 : 0.12, lz = h + 0.05;
      for (const dx of [-0.065, 0.065]) b.box(0.022, 0.98, 0.022, { x: lx + dx, y: 0.49, z: lz, color: '#8a6440' });
      for (let i = 0; i < 6; i++) b.box(0.13, 0.016, 0.018, { x: lx, y: 0.1 + i * 0.16, z: lz, color: '#9a7448' });
    },
  };
}

/** Montón de escombros quemados para una huella fp×fp (bajo: ≤ 0.35). */
function rubble(fp) {
  return {
    fp,
    build(b) {
      const R = rng(900 + fp * 31), H = fp / 2 - 0.12, rnd = (a, c) => a + R() * (c - a), k = Math.min(fp, 2.5);
      const pt = (m = 1) => [rnd(-H, H) * m, rnd(-H, H) * m];
      // ceniza y tierra quemada (manchas bajas, de tonos suaves)
      for (let i = 0; i < 2 + fp; i++) { const [x, z] = i ? pt(0.75) : [0, 0]; b.blob(rnd(0.16, 0.26) * (0.6 + k * 0.4), 0.016 + (i ? 0 : 0.01), rnd(0.13, 0.22) * (0.6 + k * 0.4), 0, { x, y: 0.0, z, ry: R() * 3, color: shade(i % 2 ? '#6c645c' : '#575049', (R() - 0.5) * 0.05) }); }
      // montón central: cascotes ennegrecidos y piedras
      const nm = 3 + fp;
      for (let i = 0; i < nm; i++) {
        const a = i / nm * TAU + R(), d = i ? rnd(0.08, 0.2) * k : 0, s = (i ? rnd(0.09, 0.14) : 0.15) * (0.8 + k * 0.2);
        rock(b, rockFaces(950 + fp * 10 + i, s * 1.3, s * (i ? 1.1 : 1.5), s * 1.1, 5), { x: Math.cos(a) * d, z: Math.sin(a) * d, ry: R() * 3, color: shade(i % 2 ? '#5d554e' : '#7d756c', (R() - 0.5) * 0.06) });
      }
      // piedras sillares rotas y tejas
      const ns = 3 + fp * 4;
      for (let i = 0; i < ns; i++) {
        const s = rnd(0.06, 0.12), [x, z] = pt(0.85), tile = i % 4 === 3;
        if (tile) b.box(s * 1.4, 0.022, s, { x, y: 0.02, z, ry: R() * 3, rx: (R() - 0.5) * 0.5, color: shade('#9c5a44', (R() - 0.5) * 0.08) });
        else if (i % 2) b.box(s * 1.6, s, s * 1.2, { x, y: s * 0.35, z, ry: R() * 3, rx: (R() - 0.5) * 0.4, rz: (R() - 0.5) * 0.4, color: shade('#a29a8e', (R() - 0.5) * 0.1) });
        else rock(b, rockFaces(980 + fp * 20 + i, s, s * 0.9, s * 0.85, 5), { x, z, ry: R() * 3, color: shade('#8f877d', (R() - 0.5) * 0.08) });
      }
      // vigas carbonizadas, unas tumbadas y otras apoyadas en el montón
      const nb = 1 + Math.ceil(fp * 1.5);
      for (let i = 0; i < nb; i++) {
        const L = rnd(0.32, 0.5) * Math.min(fp, 2) + 0.1, a = R() * PI, lift = i % 2 ? rnd(0.12, 0.24) : 0, c = i % 2 ? [rnd(-0.1, 0.1) * k, rnd(-0.1, 0.1) * k] : pt(0.7);
        const p = [c[0] - Math.cos(a) * L / 2, 0.035, c[1] - Math.sin(a) * L / 2], q = [c[0] + Math.cos(a) * L / 2, 0.035 + lift, c[1] + Math.sin(a) * L / 2];
        beam(b, p, q, 0.065, 0.055, { color: shade(CHAR, (R() - 0.5) * 0.06) });
        if (i < 2) beam(b, lerp3(p, q, 0.86), q, 0.07, 0.06, { color: '#2e241e' });
      }
      // muñón de muro en una esquina (huellas grandes)
      if (fp >= 2) { b.box(0.52, 0.3, 0.13, { x: -H + 0.2, y: 0.15, z: -H + 0.05, ry: 0.05, color: '#8a837a' }); b.box(0.13, 0.2, 0.36, { x: -H + 0.01, y: 0.1, z: -H + 0.2, color: '#7e776e' }); b.box(0.5, 0.05, 0.14, { x: -H + 0.2, y: 0.3, z: -H + 0.05, ry: 0.05, color: '#4a423c' }); }
      // brasas
      for (let i = 0; i < fp + 2; i++) { const [x, z] = pt(0.5); b.ball(0.022, 0, { x, y: 0.03, z, color: i % 2 ? '#ff7a2a' : '#ffb03a', glow: 0.8 }); }
    },
  };
}
