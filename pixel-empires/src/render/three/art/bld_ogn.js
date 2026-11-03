/* =====================================================================
   Arte 3D procedural — bld_ogn.js: edificios de orcos y gigantes, más
   las estructuras neutrales (campamento bandido, choza goblin,
   santuario, ruinas). Ver docs/ART3D.md §5.
     Orcos    pieles tensadas sobre armazones, empalizadas de troncos
              afilados, huesos/calaveras/colmillos, hierro oxidado,
              pintura de guerra roja y negra, braseros.
     Gigantes megalitos y piedras en pie, troncos enormes, tejados de
              tepe, pieles, runas talladas y cristales de hielo (glow).
   ===================================================================== */
import { shade, rng, solid } from '../kit.js';

const PI = Math.PI, TAU = PI * 2;
const DARK = '#2a2018', HOLE = '#30251c', FIRE = '#ff7a1a', FLAME = '#ffd24a';

// =====================================================================
// Utilidades geométricas
// =====================================================================
/** Transformación local -> mundo (giro ry alrededor de x0,z0). */
const rot = (x0, z0, ry) => { const c = Math.cos(ry), s = Math.sin(ry); return (lx, lz) => [x0 + lx * c + lz * s, z0 - lx * s + lz * c]; };
/** Ángulos (rx, rz) que llevan el eje +Y a la dirección (dx, dy, dz). */
function aim(dx, dy, dz) { const L = Math.hypot(dx, dy, dz) || 1e-6; return { L, rx: Math.atan2(dz, dy), rz: Math.asin(Math.max(-1, Math.min(1, -dx / L))) }; }
/** Cilindro (tronco, viga, poste) entre dos puntos; r0 en p0, r1 en p1. */
function beam(b, p0, p1, r0, r1 = r0, seg = 6, o = {}) {
  const a = aim(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  return b.cyl(r1, r0, a.L, seg, Object.assign({}, o, { x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2, z: (p0[2] + p1[2]) / 2, rx: a.rx, rz: a.rz }));
}
/** Cono con la base en p0 y la punta en p1 (pinchos, colmillos, cuernos). */
function point(b, p0, p1, r, seg = 5, o = {}) {
  const a = aim(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  return b.cone(r, a.L, seg, Object.assign({}, o, { x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2, z: (p0[2] + p1[2]) / 2, rx: a.rx, rz: a.rz }));
}
/** Colmillo curvo en dos tramos. */
function tusk(b, p0, p1, p2, r, color) { beam(b, p0, p1, r, r * 0.8, 6, { color }); point(b, p1, p2, r * 0.8, 6, { color }); }
/** Tronco de pirámide (sillar, piedra en pie, zócalo); o.jit desbasta la cara superior. */
function frustum(b, w0, d0, w1, d1, h, o = {}) {
  const r = rng(o.seed ?? 5), J = () => (r() - 0.5) * 2 * (o.jit || 0), tx = o.tx || 0, tz = o.tz || 0;
  const v = [-w0 / 2, 0, -d0 / 2, w0 / 2, 0, -d0 / 2, w0 / 2, 0, d0 / 2, -w0 / 2, 0, d0 / 2,
    -w1 / 2 + tx + J(), h + J(), -d1 / 2 + tz + J(), w1 / 2 + tx + J(), h + J(), -d1 / 2 + tz + J(), w1 / 2 + tx + J(), h + J(), d1 / 2 + tz + J(), -w1 / 2 + tx + J(), h + J(), d1 / 2 + tz + J()];
  const f = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  return b.add(solid(v, f), o);
}
/** Roca facetada. */
function rock(b, x, y, z, rx, ry, rz, color, seed = 1) { const r = rng(seed); return b.blob(rx, ry, rz, 0, { x, y, z, rx: r() * 3, ry: r() * 3, color }); }

// ---- color de equipo
/** Mástil con bandera que ondea hacia +x (o.dir = -1: hacia -x). Devuelve la altura de la punta. */
function flagPole(b, x, y0, z, h, o = {}) {
  const dir = o.dir ?? 1, w = o.w ?? 0.34, fh = o.fh ?? 0.2, r = o.r ?? 0.022, top = y0 + h;
  b.cyl(r * 0.7, r, h, 6, { x, y: y0 + h / 2, z, color: o.pole ?? '#5e4430' });
  const fy = top - fh / 2 - 0.03, f = (px) => Math.abs(px - x) * (o.k ?? 3.4);
  b.box(w, fh, 0.024, { x: x + dir * (w / 2 + r * 0.5), y: fy, z, color: 'team', flag: f });
  if (o.stripe) b.box(w * 0.86, fh * 0.24, 0.034, { x: x + dir * (w * 0.5 + r), y: fy, z, color: o.stripe, glow: o.glow || 0, flag: f });
  return top;
}
/** Estandarte colgante (tela en el plano XY girada ry) con travesaño y emblema opcional. */
function banner(b, x, yTop, z, w, h, o = {}) {
  const ry = o.ry || 0, f = (px, py) => Math.max(0, yTop - py) * (o.k ?? 1.5);
  b.box(w, h, 0.022, { x, y: yTop - h / 2, z, ry, color: 'team', teamShade: o.ts ?? 1, flag: f });
  b.extrude([[-w / 2, 0], [w / 2, 0], [0, -h * 0.28]], 0.022, { x, y: yTop - h, z, ry, color: 'team', teamShade: o.ts ?? 1, flag: f });
  if (o.bar !== false) b.cyl(0.018, 0.018, w + 0.1, 5, { x, y: yTop, z, rz: PI / 2, ry, color: o.barColor ?? '#5e4430' });
  if (o.emblem) b.box(w * 0.4, h * 0.34, 0.032, { x, y: yTop - h * 0.5, z, ry, color: o.emblem, glow: o.glow || 0, flag: f });
}

// =====================================================================
// ORCOS
// =====================================================================
const O = {
  hide: '#a07850', hideL: '#b8915f', hideD: '#86623f',
  wood: '#7a5a3a', woodL: '#916c46', woodD: '#5e4430',
  bone: '#e8dcc0', boneD: '#cdbf9e',
  iron: '#7a5040', ironD: '#5c3d31',
  red: '#9c2f24', black: '#3a2c20',
  earth: '#7c6648', earthD: '#68553c', stone: '#8a8072', stoneD: '#716a5f',
  straw: '#cfae5a', meat: '#a8453a', soil: '#6f5032', soilD: '#5b402a',
};
/** Calavera (o.horns: cuernos; o.tusks: colmillos de orco) mirando hacia ry. */
function skull(b, x, y, z, s = 1, ry = 0, o = {}) {
  const fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
  b.ball(0.06 * s, 0, { x, y, z, sy: 0.92, color: O.bone });
  for (const e of [-1, 1]) b.box(0.024 * s, 0.022 * s, 0.014, { x: x + fx * 0.052 * s + sx * e * 0.024 * s, y: y + 0.004 * s, z: z + fz * 0.052 * s + sz * e * 0.024 * s, ry, color: DARK });
  b.box(0.066 * s, 0.034 * s, 0.05 * s, { x: x + fx * 0.024 * s, y: y - 0.05 * s, z: z + fz * 0.024 * s, ry, color: O.boneD });
  if (o.horns) for (const e of [-1, 1]) {
    const p0 = [x + sx * e * 0.045 * s, y + 0.03 * s, z + sz * e * 0.045 * s], p1 = [x + sx * e * 0.11 * s, y + 0.06 * s, z + sz * e * 0.11 * s], p2 = [x + sx * e * 0.13 * s - fx * 0.02 * s, y + 0.15 * s, z + sz * e * 0.13 * s - fz * 0.02 * s];
    tusk(b, p0, p1, p2, 0.022 * s, O.boneD);
  }
  if (o.tusks) for (const e of [-1, 1]) point(b, [x + fx * 0.05 * s + sx * e * 0.025 * s, y - 0.06 * s, z + fz * 0.05 * s + sz * e * 0.025 * s], [x + fx * 0.07 * s + sx * e * 0.035 * s, y + 0.01 * s, z + fz * 0.07 * s + sz * e * 0.035 * s], 0.012 * s, 4, { color: O.bone });
}
/** Escudo redondo pintado con el color de equipo, mirando hacia ry. */
function oShield(b, x, y, z, r, ry = 0, o = {}) {
  const fx = Math.sin(ry), fz = Math.cos(ry), base = { rx: PI / 2, ry, order: 'YXZ' };
  b.cyl(r * 1.12, r * 1.12, 0.026, 8, Object.assign({ x: x - fx * 0.012, y, z: z - fz * 0.012, color: O.woodD }, base));
  b.cyl(r, r, 0.03, 8, Object.assign({ x, y, z, color: 'team', teamShade: o.ts ?? 1 }, base));
  if (o.stripe !== false) b.box(r * 1.7, r * 0.26, 0.012, { x: x + fx * 0.017, y, z: z + fz * 0.017, ry, rz: 0.6, color: O.black });
  b.ball(r * 0.26, 0, { x: x + fx * 0.02, y, z: z + fz * 0.02, color: o.boss ?? O.bone });
}
/** Brasero con fuego (o.tripod: patas de hierro). Devuelve el punto de las llamas. */
function brazier(b, x, z, h = 0.42, o = {}) {
  const y0 = o.y0 || 0, top = y0 + h;
  if (o.tripod) for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4; beam(b, [x + Math.sin(a) * 0.11, y0, z + Math.cos(a) * 0.11], [x + Math.sin(a) * 0.035, top, z + Math.cos(a) * 0.035], 0.018, 0.015, 4, { color: O.ironD }); }
  else b.cyl(0.032, 0.045, h, 6, { x, y: y0 + h / 2, z, color: O.woodD });
  b.cyl(0.11, 0.06, 0.09, 7, { x, y: top + 0.03, z, color: O.iron });
  const fl = (px, py) => Math.max(0, py - top) * 5;
  b.cone(0.085, 0.24, 6, { x, y: top + 0.19, z, color: FIRE, glow: 1, flag: fl });
  b.cone(0.045, 0.16, 5, { x: x + 0.012, y: top + 0.16, z, ry: 0.5, color: FLAME, glow: 1, flag: fl });
  return [x, top + 0.3, z];
}
/** Empalizada de troncos afilados (doble hilera escalonada) a lo largo de X local, girada ry. */
function palisade(b, x, z, len, h, ry = 0, o = {}) {
  const n = o.n ?? Math.max(2, Math.round(len / 0.12)), w = len / n, r = rng(o.seed ?? 3), tip = o.tip ?? w * 1.25, y = o.y ?? 0, col = o.color ?? O.wood, d = o.d ?? 0.07;
  const row = (m, x0, hk) => { const pts = [[x0, 0]]; for (let i = 0; i < m; i++) { const a = x0 + i * w, hh = h * (hk + (r() - 0.5) * 0.14); pts.push([a, hh], [a + w / 2, hh + tip], [a + w, hh]); } pts.push([x0 + m * w, 0]); return pts; };
  const fx = Math.sin(ry), fz = Math.cos(ry);
  b.extrude(row(n, -len / 2, 1), d, { x: x - fx * d * 0.5, y, z: z - fz * d * 0.5, ry, color: col });
  b.extrude(row(n - 1, -len / 2 + w / 2, 0.84), d, { x: x + fx * d * 0.5, y, z: z + fz * d * 0.5, ry, color: shade(col, -0.06) });
  if (o.rope !== false) b.box(len, o.ropeH ?? 0.04, d * 2 + 0.03, { x, y: y + h * 0.42, z, ry, color: o.rope ?? O.woodD });
}
/** Tronco afilado vertical. */
function stake(b, x, y0, z, h, r = 0.05, color = O.wood) {
  b.cyl(r, r * 1.1, h, 6, { x, y: y0 + h / 2, z, color });
  b.cone(r, r * 2.6, 6, { x, y: y0 + h + r * 1.3, z, color: shade(color, 0.07) });
}
/** Bastidor con una piel tensada y pintura de guerra. */
function hideRack(b, x, z, w, h, ry = 0, o = {}) {
  const T = rot(x, z, ry), y0 = o.y0 || 0;
  for (const s of [-1, 1]) { const [px, pz] = T(s * w / 2, 0); b.cyl(0.02, 0.025, h, 5, { x: px, y: y0 + h / 2, z: pz, color: O.woodD }); }
  b.box(w + 0.08, 0.035, 0.035, { x, y: y0 + h - 0.03, z, ry, color: O.wood });
  b.box(w + 0.02, 0.03, 0.03, { x, y: y0 + 0.13, z, ry, color: O.wood });
  b.box(w - 0.07, h - 0.24, 0.018, { x, y: y0 + (h + 0.1) / 2, z, ry, color: o.color ?? O.hideL });
  b.box(0.035, h - 0.34, 0.026, { x, y: y0 + (h + 0.1) / 2, z, ry, rz: 0.5, color: O.red });
  b.box(0.035, h - 0.34, 0.026, { x, y: y0 + (h + 0.1) / 2, z, ry, rz: -0.5, color: O.red });
}
/** Tejado de pieles a dos aguas sobre armazón: tiras de color de equipo, cumbrera y cabios cruzados. */
function hideRoof(b, w, h, d, y0, o = {}) {
  const x = o.x || 0, z = o.z || 0, th = Math.atan2(h, d / 2);
  const r = rng(o.seed ?? Math.round(w * 100)), slope = (t, s) => ({ y: y0 + h * t, z: z + s * d / 2 * (1 - t) });
  b.wedge(w, h, d, { x, y: y0, z, color: o.color ?? O.hide });
  // retales de piel cosidos (tonos distintos) sobre las dos aguas
  for (let i = 0; i < (o.patches ?? Math.round(w * 2.2)); i++) {
    const s = i % 3 === 2 ? -1 : 1, t = 0.12 + r() * 0.7, q = slope(t, s), pw = 0.22 + r() * 0.22, pd = Math.min(0.3, d * 0.2) + r() * 0.1;
    b.box(pw, 0.02, pd, { x: x + (r() - 0.5) * (w - pw - 0.1), y: q.y, z: q.z, rx: s * th, ry: (r() - 0.5) * 0.5, color: r() < 0.5 ? O.hideL : O.hideD });
  }
  for (const t of o.stripes ?? [0.3, 0.62]) for (const s of [-1, 1]) { const q = slope(t, s); b.box(w + 0.02, 0.03, o.sw ?? 0.12, { x, y: q.y, z: q.z, rx: s * th, color: 'team' }); }
  // pintura de guerra roja en el agua delantera
  const pq = slope(0.45, 1), px = x + w * 0.28;
  for (const k of [-1, 0, 1]) b.box(0.045, 0.03, Math.min(0.36, d * 0.22) * (1 - Math.abs(k) * 0.18), { x: px + k * 0.085, y: pq.y, z: pq.z, rx: th, ry: 0.35, color: O.red });
  b.cyl(0.045, 0.045, w + 0.2, 6, { x, y: y0 + h, z, rz: PI / 2, color: O.woodD });
  // púas de hueso a lo largo de la cumbrera
  const nsp = Math.max(2, Math.round(w / 0.5));
  for (let i = 0; i < nsp; i++) { const sx = x - w / 2 + 0.2 + i * (w - 0.4) / (nsp - 1); point(b, [sx, y0 + h, z], [sx + 0.02, y0 + h + 0.16, z + 0.03], 0.03, 4, { color: i % 2 ? O.boneD : O.bone }); }
  if (o.rafters !== false) for (const e of [-1, 1]) for (const s of [-1, 1]) beam(b, [x + e * (w / 2 - 0.02), y0, z + s * d / 2], [x + e * (w / 2 - 0.02), y0 + h + 0.18, z - s * 0.18 * d / 2 / h], 0.04, 0.032, 5, { color: O.woodL });
}
/** Casco de tienda cónica de pieles con banda de equipo y palos que asoman por la punta. */
function hideCone(b, x, z, r, h, y0, o = {}) {
  const seg = o.seg ?? 9, rr = (y) => r * (1 - (y - y0) / h);
  b.cone(r, h, seg, { x, y: y0 + h / 2, z, ry: o.ry || 0, color: o.color ?? O.hide });
  const a0 = y0 + h * (o.band ?? 0.24), a1 = a0 + h * 0.15;
  b.cyl(rr(a1) + 0.012, rr(a0) + 0.012, a1 - a0, seg, { x, y: (a0 + a1) / 2, z, ry: o.ry || 0, color: 'team' });
  b.cyl(rr(y0 + 0.06) + 0.01, r + 0.01, 0.06, seg, { x, y: y0 + 0.03, z, ry: o.ry || 0, color: O.red });
  if (o.poles !== false) for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4, k = h * 0.33; beam(b, [x + Math.sin(a) * r * 0.32, y0 + h * 0.68, z + Math.cos(a) * r * 0.32], [x - Math.sin(a) * k * 0.4, y0 + h + k * 0.7, z - Math.cos(a) * k * 0.4], 0.02, 0.016, 4, { color: O.woodD }); }
}
/** Lobo tumbado (perrera). */
function wolf(b, x, z, ry, y0 = 0, s = 1) {
  const T = rot(x, z, ry), F = '#8d8f94', D = '#6b6d73', L = '#b9bbbf', at = (lx, ly, lz) => { const [px, pz] = T(lx * s, lz * s); return [px, y0 + ly * s, pz]; };
  let p = at(0, 0.09, 0); b.blob(0.12 * s, 0.085 * s, 0.22 * s, 1, { x: p[0], y: p[1], z: p[2], ry, color: F });
  p = at(0, 0.15, -0.04); b.blob(0.09 * s, 0.05 * s, 0.13 * s, 0, { x: p[0], y: p[1], z: p[2], ry, color: D });
  p = at(0, 0.13, 0.22); b.blob(0.075 * s, 0.07 * s, 0.08 * s, 0, { x: p[0], y: p[1], z: p[2], ry, color: F });
  p = at(0, 0.11, 0.31); b.box(0.055 * s, 0.05 * s, 0.09 * s, { x: p[0], y: p[1], z: p[2], ry, color: L });
  p = at(0, 0.125, 0.355); b.box(0.025 * s, 0.022 * s, 0.02 * s, { x: p[0], y: p[1], z: p[2], ry, color: DARK });
  for (const e of [-1, 1]) { p = at(e * 0.04, 0.2, 0.2); b.cone(0.024 * s, 0.07 * s, 4, { x: p[0], y: p[1], z: p[2], ry, color: D }); p = at(e * 0.06, 0.025, 0.2); b.box(0.04 * s, 0.04 * s, 0.12 * s, { x: p[0], y: p[1], z: p[2], ry, color: F }); }
  beam(b, at(0.02, 0.08, -0.2), at(0.14, 0.05, -0.36), 0.035 * s, 0.018 * s, 5, { color: D });
}

/** Vigas X de arriostramiento entre cuatro patas. */
function legPos(base, top, y0, y1, y) { return base + (top - base) * (y - y0) / (y1 - y0); }

/** Puesto de mercado con toldo a rayas (equipo / alternativo); P = paleta y escala (por defecto orca). */
function oStall(b, x, z, ry, w, d, goods, P = {}) {
  const T = rot(x, z, ry), at = (lx, lz) => T(lx, lz), k = P.k ?? 1, pr = P.pr ?? 0.03, y0 = 0.08, hf = 0.72 * k, hb = 0.92 * k;
  for (const [lx, lz, h] of [[-w / 2, d / 2, hf], [w / 2, d / 2, hf], [-w / 2, -d / 2, hb], [w / 2, -d / 2, hb]]) { const [px, pz] = at(lx, lz); b.cyl(pr, pr * 1.15, h, P.seg ?? 5, { x: px, y: y0 + h / 2, z: pz, color: P.post ?? O.woodD }); }
  let [px, pz] = at(0, d / 2 - 0.12); b.box(w - 0.06, 0.3 * k, 0.24, { x: px, y: y0 + 0.15 * k, z: pz, ry, color: P.counter ?? O.wood });
  b.box(w - 0.02, 0.03, 0.28, { x: px, y: y0 + 0.3 * k + 0.015, z: pz, ry, color: P.top ?? O.woodL });
  const n = 4, sw = (w + 0.12) / n, sl = Math.atan2(hb - hf, d), len = Math.hypot(d + 0.22, (hb - hf) * (d + 0.22) / d);
  for (let i = 0; i < n; i++) { [px, pz] = at(-w / 2 - 0.06 + sw * (i + 0.5), 0.0); b.box(sw + 0.003, 0.025, len, { x: px, y: y0 + (hf + hb) / 2 + 0.02, z: pz, rx: sl, ry, order: 'YXZ', color: i % 2 ? (P.alt ?? O.hideL) : 'team' }); }
  [px, pz] = at(0, d / 2 + 0.11); b.box(w + 0.14, 0.07, 0.025, { x: px, y: y0 + hf - 0.02, z: pz, ry, color: 'team', teamShade: 0.75, flag: (qx, qy) => Math.max(0, y0 + hf + 0.02 - qy) * 2 });
  if (goods) goods(at, ry);
}

// =====================================================================
// GIGANTES
// =====================================================================
const G = {
  stone: '#a39e94', stoneD: '#8b8780', stoneL: '#b8b3a9', stoneM: '#979289',
  turf: '#6f8a54', turfL: '#86a364', turfD: '#5d7547',
  wood: '#b08a5a', woodD: '#8a6a44', woodL: '#c49e6c',
  fur: '#cdbfa5', furD: '#ac9e83', furB: '#8a6c4e',
  ice: '#bfeaff', rune: '#8fe6ff', iron: '#7d838c', earth: '#7a6648', rope: '#8f7a58',
  hay: '#d2b25c', soil: '#6c5236', soilD: '#5a432c',
};

/** Runa tallada que brilla (dos trazos) sobre una cara que mira hacia ry. */
function rune(b, x, y, z, ry = 0, s = 1, c = G.rune) {
  const fx = Math.sin(ry) * 0.012, fz = Math.cos(ry) * 0.012, sx = Math.cos(ry), sz = -Math.sin(ry);
  b.box(0.026 * s, 0.14 * s, 0.016, { x: x + fx, y, z: z + fz, ry, color: c, glow: 0.9 });
  b.box(0.022 * s, 0.08 * s, 0.016, { x: x + fx + sx * 0.03 * s, y: y + 0.03 * s, z: z + fz + sz * 0.03 * s, ry, rz: -0.75, color: c, glow: 0.9 });
}
/** Cristal de hielo (bipirámide) con brillo propio; o.spin para que flote girando. */
function crystal(b, x, y, z, s = 1, o = {}) {
  const c = o.color ?? G.ice, g = o.glow ?? 0.85;
  b.cone(0.08 * s, 0.26 * s, 5, { x, y: y + 0.13 * s, z, ry: o.ry || 0, color: c, glow: g, spin: o.spin });
  b.cone(0.08 * s, 0.11 * s, 5, { x, y: y - 0.055 * s, z, rx: PI, ry: o.ry || 0, color: shade(c, -0.08), glow: g, spin: o.spin });
}
/** Racimo de esquirlas de hielo brotando de un punto. */
function shards(b, x, y, z, s = 1, seed = 1, n = 4) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, t = i === 0 ? 0.05 : 0.4 + r() * 0.45, L = (i === 0 ? 0.34 : 0.16 + r() * 0.12) * s;
    point(b, [x + Math.sin(a) * 0.03 * s, y - 0.02, z + Math.cos(a) * 0.03 * s], [x + Math.sin(a) * L * Math.sin(t), y + L * Math.cos(t), z + Math.cos(a) * L * Math.sin(t)], (i === 0 ? 0.065 : 0.042) * s, 5, { color: i % 2 ? G.ice : '#d6f4ff', glow: 0.8 });
  }
}
/** Piedra en pie desbastada (megalito). */
function menhir(b, x, z, w, h, d, o = {}) {
  return frustum(b, w, d, w * (o.taper ?? 0.8), d * (o.taper ?? 0.8), h, { x, y: o.y0 || 0, z, ry: o.ry || 0, color: o.color ?? G.stone, jit: o.jit ?? 0.025, seed: o.seed ?? Math.round((x + 5) * 31 + (z + 5) * 17), tx: o.tx || 0, tz: o.tz || 0 });
}
/** Sillares sobre una cara (plano XY local que mira a +z, girada ry). */
function blocks(b, x, y0, z, w, h, rows, cols, o = {}) {
  const r = rng(o.seed ?? 9), ry = o.ry || 0, T = rot(x, z, ry), bh = h / rows, bw = w / cols, col = o.color ?? G.stone;
  for (let i = 0; i < rows; i++) {
    const off = i % 2 ? bw / 2 : 0, edges = [-w / 2];
    for (let k = 1; k <= cols; k++) { const e = -w / 2 + k * bw - off; if (e > -w / 2 + 0.06 && e < w / 2 - 0.06) edges.push(e); }
    edges.push(w / 2);
    for (let k = 0; k < edges.length - 1; k++) { const [px, pz] = T((edges[k] + edges[k + 1]) / 2, 0); b.box(edges[k + 1] - edges[k] - 0.03, bh - 0.03, 0.04, { x: px, y: y0 + bh * (i + 0.5), z: pz, ry, color: shade(col, (r() - 0.5) * 0.1) }); }
  }
}
/** Tejado de tepe a dos aguas: tablazón, capa de hierba, cumbrera del color de equipo, matas y tablas cruzadas. */
function turfRoof(b, w, h, d, y0, o = {}) {
  const x = o.x || 0, z = o.z || 0, th = 0.075, r = rng(o.seed ?? Math.round(w * 37)), sl = Math.atan2(h, d / 2);
  b.wedge(w, h, d, { x, y: y0, z, color: G.woodD });
  b.wedge(w - 0.03, h, d - 0.04, { x, y: y0 + th, z, color: G.turf });
  b.box(w - 0.02, 0.07, 0.17, { x, y: y0 + h + th + 0.005, z, color: 'team' });
  for (const s of [-1, 1]) { const t = 0.16; b.box(w - 0.02, 0.035, 0.16, { x, y: y0 + th + h * t, z: z + s * (d / 2 - 0.02) * (1 - t), rx: s * sl, color: 'team', teamShade: 0.8 }); }
  for (let i = 0; i < (o.tufts ?? Math.round(w * 2.5)); i++) {
    const s = i % 3 === 2 ? -1 : 1, t = 0.3 + r() * 0.55, yy = y0 + th + h * t, zz = z + s * (d / 2 - 0.02) * (1 - t);
    b.cone(0.05 + r() * 0.03, 0.1 + r() * 0.06, 4, { x: x + (r() - 0.5) * (w - 0.3), y: yy + 0.04, z: zz, ry: r() * 2, color: r() < 0.5 ? G.turfL : G.turfD });
  }
  if (o.boards !== false) for (const e of [-1, 1]) for (const s of [-1, 1]) {
    const bx = x + e * (w / 2 - 0.01), top = [bx, y0 + h + th + 0.24, z - s * 0.17];
    beam(b, [bx, y0 + 0.02, z + s * (d / 2 + 0.02)], top, 0.045, 0.04, 5, { color: G.woodL });
    point(b, top, [bx, top[1] + 0.1, top[2] - s * 0.05], 0.04, 5, { color: G.woodL });
  }
}
/** Escudo redondo gigante: cara del color de equipo con cruz de tablas y umbo de hierro. */
function gShield(b, x, y, z, r, ry = 0, o = {}) {
  const fx = Math.sin(ry), fz = Math.cos(ry), base = { rx: PI / 2, ry, order: 'YXZ' };
  b.cyl(r * 1.1, r * 1.1, 0.03, 9, Object.assign({ x: x - fx * 0.012, y, z: z - fz * 0.012, color: G.woodD }, base));
  b.cyl(r, r, 0.034, 9, Object.assign({ x, y, z, color: 'team', teamShade: o.ts ?? 1 }, base));
  b.box(r * 1.85, r * 0.18, 0.014, { x: x + fx * 0.02, y, z: z + fz * 0.02, ry, color: G.fur });
  b.box(r * 0.18, r * 1.85, 0.014, { x: x + fx * 0.02, y, z: z + fz * 0.02, ry, color: G.fur });
  b.ball(r * 0.25, 0, { x: x + fx * 0.024, y, z: z + fz * 0.024, color: G.iron });
}
/** Brasero de hielo: pedestal de piedra con cuenco y llama fría. */
function iceBrazier(b, x, z, h = 0.4, y0 = 0) {
  frustum(b, 0.2, 0.2, 0.15, 0.15, h, { x, y: y0, z, color: G.stoneD, jit: 0.01 });
  b.cyl(0.15, 0.09, 0.09, 7, { x, y: y0 + h + 0.04, z, color: G.stone });
  const fl = (px, py) => Math.max(0, py - y0 - h) * 4;
  b.cone(0.1, 0.28, 6, { x, y: y0 + h + 0.22, z, color: '#7fd8ff', glow: 1, flag: fl });
  b.cone(0.05, 0.18, 5, { x, y: y0 + h + 0.19, z, ry: 0.5, color: '#eaffff', glow: 1, flag: fl });
}
/** Mamut (corral de los gigantes). */
function mammoth(b, x, z, ry, y0 = 0, s = 1) {
  const T = rot(x, z, ry), at = (lx, ly, lz) => { const [px, pz] = T(lx * s, lz * s); return [px, y0 + ly * s, pz]; }, F = '#7a5a3e', FD = '#5e442f', TK = '#efe6d0';
  const put = (lx, ly, lz) => { const p = at(lx, ly, lz); return { x: p[0], y: p[1], z: p[2], ry }; };
  for (const [lx, lz] of [[-0.17, 0.24], [0.17, 0.24], [-0.17, -0.24], [0.17, -0.24]]) b.cyl(0.085 * s, 0.1 * s, 0.5 * s, 7, Object.assign(put(lx, 0.25, lz), { color: FD }));
  b.blob(0.3 * s, 0.3 * s, 0.44 * s, 1, Object.assign(put(0, 0.66, 0), { color: F }));
  b.blob(0.31 * s, 0.13 * s, 0.42 * s, 0, Object.assign(put(0, 0.46, 0), { color: FD }));
  b.blob(0.24 * s, 0.2 * s, 0.24 * s, 1, Object.assign(put(0, 0.86, 0.14), { color: shade(F, -0.03) }));
  b.blob(0.2 * s, 0.23 * s, 0.19 * s, 1, Object.assign(put(0, 0.8, 0.44), { color: F }));
  for (const e of [-1, 1]) b.blob(0.035 * s, 0.13 * s, 0.11 * s, 0, Object.assign(put(e * 0.18, 0.8, 0.38), { color: FD }));
  beam(b, at(0, 0.72, 0.58), at(0, 0.45, 0.69), 0.07 * s, 0.055 * s, 6, { color: F });
  beam(b, at(0, 0.45, 0.69), at(0, 0.2, 0.64), 0.055 * s, 0.04 * s, 6, { color: F });
  for (const e of [-1, 1]) { tusk(b, at(e * 0.09, 0.64, 0.56), at(e * 0.16, 0.42, 0.74), at(e * 0.08, 0.54, 0.95), 0.035 * s, TK); b.box(0.025 * s, 0.025 * s, 0.02 * s, Object.assign(put(e * 0.12, 0.87, 0.58), { color: DARK })); }
  beam(b, at(0, 0.7, -0.42), at(0, 0.42, -0.5), 0.03 * s, 0.02 * s, 5, { color: FD });
  // manta de montura del color de equipo
  b.box(0.42 * s, 0.05 * s, 0.4 * s, Object.assign(put(0, 0.965, -0.08), { color: 'team' }));
  for (const e of [-1, 1]) b.box(0.04 * s, 0.3 * s, 0.38 * s, Object.assign(put(e * 0.26, 0.82, -0.08), { rz: e * 0.4, color: 'team', teamShade: 0.85 }));
}

export const MODELS = {
  // ==================================================================== ORCOS
  // ------------------------------------------------------------------ casa (2×2): choza redonda de pieles
  orc_house: {
    fp: 2, smoke: [[0, 1.5, 0]], fire: [[0, 1.0, 0], [-0.4, 0.5, 0.3], [0.4, 0.6, -0.3]],
    build(b) {
      const r = rng(11);
      b.cyl(0.82, 0.88, 0.1, 10, { y: 0.05, color: O.earth });
      for (let i = 0; i < 6; i++) { const a = -1.25 + i * 0.5; rock(b, Math.sin(a) * 0.8, 0.07, Math.cos(a) * 0.8, 0.07, 0.05, 0.06, shade(O.stone, (r() - 0.5) * 0.1), i + 3); }
      b.cyl(0.58, 0.6, 0.52, 12, { y: 0.36, color: O.woodD });
      for (let i = 1; i < 16; i++) { const a = i / 16 * TAU, h = 0.54 + r() * 0.06; b.cyl(0.055, 0.062, h, 6, { x: Math.sin(a) * 0.6, y: 0.1 + h / 2, z: Math.cos(a) * 0.6, color: shade(O.wood, (r() - 0.5) * 0.08) }); }
      hideCone(b, 0, 0, 0.88, 0.8, 0.6, { seg: 10, band: 0.22 });
      // puerta con porche (toldo del color de equipo) y colmillos
      b.box(0.3, 0.4, 0.06, { y: 0.3, z: 0.6, color: HOLE });
      b.cyl(0.042, 0.042, 0.36, 6, { y: 0.52, z: 0.64, rz: PI / 2, color: O.hideD });
      for (const s of [-1, 1]) {
        b.cyl(0.035, 0.04, 0.5, 6, { x: s * 0.2, y: 0.35, z: 0.64, color: O.woodD });
        b.cyl(0.03, 0.035, 0.5, 5, { x: s * 0.22, y: 0.35, z: 0.77, color: O.wood });
        tusk(b, [s * 0.33, 0.08, 0.72], [s * 0.37, 0.3, 0.78], [s * 0.27, 0.5, 0.82], 0.04, O.bone);
      }
      b.box(0.56, 0.03, 0.28, { y: 0.6, z: 0.71, rx: 0.32, color: 'team' });
      skull(b, 0, 0.8, 0.71, 1.1, 0, { horns: true });
      // escudos en el muro
      for (const s of [-1, 1]) oShield(b, Math.sin(s * 0.75) * 0.68, 0.36, Math.cos(s * 0.75) * 0.68, 0.13, s * 0.75);
      // detalles: estaca con calavera, caldero, leña, bastidor con piel, bandera
      stake(b, -0.66, 0.08, 0.64, 0.5, 0.035, O.woodD); skull(b, -0.66, 0.63, 0.66, 0.9, 0.3, { tusks: true });
      b.cyl(0.11, 0.08, 0.13, 8, { x: 0.64, y: 0.15, z: 0.62, color: O.ironD });
      b.cyl(0.09, 0.09, 0.02, 8, { x: 0.64, y: 0.215, z: 0.62, color: '#7a8a3a' });
      for (let i = 0; i < 3; i++) rock(b, 0.64 + Math.sin(i * 2.1) * 0.12, 0.1, 0.62 + Math.cos(i * 2.1) * 0.12, 0.045, 0.04, 0.045, O.stoneD, i + 20);
      for (const [y, x] of [[0.15, 0.68], [0.15, 0.78], [0.24, 0.73]]) b.cyl(0.045, 0.045, 0.42, 6, { x, y, z: 0.05, rx: PI / 2, color: shade(O.woodL, y - 0.2) });
      hideRack(b, -0.6, -0.6, 0.38, 0.5, PI / 4);
      flagPole(b, 0.6, 0.08, -0.6, 1.6, { dir: -1, stripe: O.black });
    },
  },

  // ------------------------------------------------------------------ centro urbano (4×4): gran salón de guerra
  orc_tc: {
    fp: 4, smoke: [[0.5, 2.1, -0.35]], fire: [[0, 1.4, -0.3], [-0.9, 1.0, -0.6], [0.9, 1.1, 0.1], [0.2, 0.8, 0.9]],
    build(b) {
      const r = rng(21), ZH = -0.35;
      frustum(b, 3.66, 3.56, 3.52, 3.42, 0.14, { z: 0.02, color: O.earth });
      for (let i = 0; i < 8; i++) rock(b, -1.6 + i * 0.46, 0.08, 1.72, 0.09, 0.06, 0.07, shade(O.stone, (r() - 0.5) * 0.12), i + 40);
      // salón: muros de troncos
      b.box(2.2, 0.74, 1.5, { y: 0.51, z: ZH, color: O.woodD });
      for (let i = 0; i < 14; i++) { const x = -1.05 + i * 0.1615; if (Math.abs(x) < 0.36) continue; const h = 0.74 + r() * 0.05; b.cyl(0.06, 0.066, h, 6, { x, y: 0.14 + h / 2, z: ZH + 0.77, color: shade(O.wood, (r() - 0.5) * 0.1) }); }
      for (const [x, z] of [[-1.1, ZH + 0.76], [1.1, ZH + 0.76], [-1.1, ZH - 0.76], [1.1, ZH - 0.76]]) b.cyl(0.1, 0.11, 0.76, 7, { x, y: 0.52, z, color: O.woodL });
      skull(b, -1.1, 0.72, ZH + 0.88, 1.1, 0, { tusks: true }); skull(b, 1.1, 0.72, ZH + 0.88, 1.1, 0, { tusks: true });
      hideRoof(b, 2.7, 1.05, 2.2, 0.88, { z: ZH, stripes: [0.22, 0.5, 0.76] });
      b.wedge(0.32, 0.15, 0.3, { x: 0.5, y: 1.88, z: ZH, color: O.hideD });
      for (const e of [-1, 1]) flagPole(b, e * 1.33, 1.95, ZH, 0.75, { dir: -e, w: 0.4, fh: 0.24, stripe: O.black });
      // porche con tejado del color de equipo, colmillos gigantes y calavera
      for (const s of [-1, 1]) b.cyl(0.05, 0.055, 0.78, 6, { x: s * 0.44, y: 0.53, z: 1.08, color: O.woodL });
      b.wedge(0.9, 0.4, 1.04, { y: 0.9, z: 0.74, ry: PI / 2, color: 'team' });
      b.cyl(0.03, 0.03, 0.94, 5, { y: 1.3, z: 0.74, rx: PI / 2, color: O.bone });
      b.box(0.58, 0.62, 0.05, { y: 0.45, z: ZH + 0.77, color: HOLE });
      b.cyl(0.055, 0.055, 0.64, 6, { y: 0.79, z: ZH + 0.8, rz: PI / 2, color: O.hideD });
      skull(b, 0, 1.08, 1.2, 1.7, 0, { horns: true, tusks: true });
      for (const s of [-1, 1]) tusk(b, [s * 0.6, 0.12, 1.24], [s * 0.66, 0.78, 1.3], [s * 0.2, 1.42, 1.25], 0.075, O.bone);
      for (const s of [-1, 1]) brazier(b, s * 0.82, 1.22, 0.45);
      // escudos en la fachada
      for (const x of [-0.85, -0.55, 0.55, 0.85]) oShield(b, x, 0.55, ZH + 0.86, 0.12, 0);
      // tótem de calaveras con estandarte (delante a la izquierda)
      const TX = -1.32, TZ = 1.12;
      b.cyl(0.07, 0.085, 1.75, 6, { x: TX, y: 0.14 + 0.875, z: TZ, color: O.woodD });
      [[0.42, O.red], [0.74, O.black], [1.06, O.red]].forEach(([y, c], i) => {
        b.box(0.22, 0.24, 0.2, { x: TX, y: 0.14 + y, z: TZ, ry: (i - 1) * 0.15, color: shade(O.woodL, i * 0.04) });
        b.box(0.23, 0.05, 0.21, { x: TX, y: 0.14 + y + 0.03, z: TZ, ry: (i - 1) * 0.15, color: c });
        for (const e of [-1, 1]) { b.box(0.04, 0.03, 0.02, { x: TX + e * 0.05, y: 0.14 + y + 0.03, z: TZ + 0.105, color: O.bone }); point(b, [TX + e * 0.06, 0.14 + y - 0.08, TZ + 0.1], [TX + e * 0.08, 0.14 + y + 0.0, TZ + 0.16], 0.018, 4, { color: O.bone }); }
      });
      banner(b, TX, 1.7, TZ + 0.12, 0.36, 0.4, { emblem: O.black });
      skull(b, TX, 1.98, TZ, 1.2, 0, { horns: true });
      // brasero grande y provisiones (delante a la derecha)
      brazier(b, 1.3, 1.22, 0.5, { tripod: true, y0: 0.14 });
      b.cyl(0.12, 0.12, 0.28, 8, { x: 1.5, y: 0.28, z: 0.62, color: O.woodL }); b.cyl(0.11, 0.11, 0.26, 8, { x: 1.55, y: 0.27, z: 0.34, color: O.wood });
      b.box(0.26, 0.24, 0.26, { x: 1.3, y: 0.26, z: 0.58, ry: 0.3, color: O.woodD });
      // empalizada trasera y laterales, bastidores de pieles
      palisade(b, 0, -1.62, 3.4, 0.7, 0, { seed: 5 });
      for (const e of [-1, 1]) palisade(b, e * 1.66, -0.95, 1.3, 0.7, PI / 2, { seed: 6 + e });
      hideRack(b, -1.5, 0.15, 0.4, 0.62, PI / 2, { y0: 0.14 });
      hideRack(b, 1.5, -0.2, 0.4, 0.6, -PI / 2, { y0: 0.14, color: O.hide });
      // pinchos oxidados en el borde delantero
      for (let i = 0; i < 6; i++) { const x = -1.45 + i * 0.58; if (Math.abs(x) < 0.5) continue; point(b, [x, 0.1, 1.58], [x, 0.34, 1.78], 0.035, 5, { color: O.iron }); }
    },
  },

  // ------------------------------------------------------------------ cuartel (3×3): barracón con patio de armas
  orc_barracks: {
    fp: 3, fire: [[0, 1.2, -0.6], [-0.7, 0.9, -0.5], [0.7, 0.9, -0.7]],
    build(b) {
      const r = rng(31), ZH = -0.6;
      frustum(b, 2.76, 2.76, 2.64, 2.64, 0.1, { color: O.earth });
      b.box(2.1, 0.6, 1.1, { y: 0.4, z: ZH, color: O.woodD });
      for (const [y, k] of [[0.2, 0], [0.36, 0.05], [0.52, -0.04]]) b.cyl(0.065, 0.065, 2.16, 6, { y, z: ZH + 0.55, rz: PI / 2, color: shade(O.wood, k) });
      for (const s of [-1, 1]) b.cyl(0.08, 0.09, 0.62, 7, { x: s * 1.06, y: 0.41, z: ZH + 0.55, color: O.woodL });
      hideRoof(b, 2.4, 0.85, 1.5, 0.7, { z: ZH });
      b.box(0.42, 0.48, 0.06, { y: 0.34, z: ZH + 0.6, color: HOLE });
      for (const s of [-1, 1]) { b.cyl(0.035, 0.04, 0.52, 6, { x: s * 0.24, y: 0.36, z: ZH + 0.64, color: O.woodL }); tusk(b, [s * 0.36, 0.1, ZH + 0.7], [s * 0.4, 0.34, ZH + 0.74], [s * 0.3, 0.55, ZH + 0.78], 0.035, O.bone); }
      b.cyl(0.035, 0.035, 0.6, 6, { y: 0.6, z: ZH + 0.66, rz: PI / 2, color: O.woodL });
      for (const x of [-0.72, 0.72]) oShield(b, x, 0.36, ZH + 0.64, 0.13, 0);
      oShield(b, 0.9, 0.2, ZH + 0.68, 0.12, 0.2, { ts: 0.8 });
      for (const s of [-1, 1]) brazier(b, s * 0.5, ZH + 0.82, 0.4, { y0: 0.1 });
      // armero con hachas y lanzas
      const RX = -0.8, RZ = 0.45;
      for (const s of [-1, 1]) b.cyl(0.03, 0.035, 0.55, 5, { x: RX + s * 0.32, y: 0.37, z: RZ, color: O.woodD });
      b.box(0.74, 0.04, 0.05, { x: RX, y: 0.58, z: RZ, color: O.wood });
      for (let i = 0; i < 4; i++) {
        const x = RX - 0.22 + i * 0.15;
        beam(b, [x, 0.1, RZ + 0.1], [x - 0.02, 0.72, RZ - 0.02], 0.014, 0.012, 5, { color: O.woodL });
        if (i % 2) b.box(0.1, 0.09, 0.02, { x: x + 0.03, y: 0.66, z: RZ, rz: 0.1, color: O.iron });
        else point(b, [x - 0.02, 0.72, RZ - 0.02], [x - 0.025, 0.84, RZ - 0.04], 0.025, 4, { color: O.iron });
      }
      // muñeco de entrenamiento
      const DX = 0.8, DZ = 0.5;
      b.cyl(0.035, 0.04, 0.62, 5, { x: DX, y: 0.41, z: DZ, color: O.woodD });
      b.cyl(0.025, 0.025, 0.44, 5, { x: DX, y: 0.58, z: DZ, rz: PI / 2, color: O.woodD });
      b.cyl(0.1, 0.085, 0.26, 7, { x: DX, y: 0.5, z: DZ, color: O.straw });
      b.ball(0.075, 0, { x: DX, y: 0.72, z: DZ, color: O.hideL });
      b.box(0.1, 0.03, 0.02, { x: DX, y: 0.73, z: DZ + 0.07, rz: 0.4, color: O.red });
      beam(b, [DX + 0.2, 0.55, DZ + 0.3], [DX + 0.02, 0.52, DZ + 0.03], 0.008, 0.008, 4, { color: O.woodL });
      // tambor de guerra
      b.cyl(0.15, 0.13, 0.22, 8, { x: 0.25, y: 0.21, z: 0.75, color: O.woodL });
      b.cyl(0.155, 0.155, 0.03, 8, { x: 0.25, y: 0.33, z: 0.75, color: O.hideL });
      b.box(0.31, 0.04, 0.012, { x: 0.25, y: 0.21, z: 0.88, color: O.red });
      // estandarte con calavera, brasero, empalizadas laterales
      flagPole(b, -1.2, 0.1, 1.15, 1.65, { w: 0.4, fh: 0.26, stripe: O.black });
      skull(b, -1.2, 1.8, 1.15, 1.1, 0, { horns: true });
      brazier(b, 1.15, 1.15, 0.45, { tripod: true, y0: 0.1 });
      for (const e of [-1, 1]) palisade(b, e * 1.3, 0.62, 1.05, 0.5, PI / 2, { seed: 9 + e, y: 0.06 });
      b.cyl(0.04, 0.04, 0.5, 6, { x: -0.3, y: 0.14, z: 0.95, rz: PI / 2, ry: 0.3, color: O.boneD });
      skull(b, -0.15, 0.16, 0.9, 0.9, 0.4);
    },
  },

  // ------------------------------------------------------------------ molino (2×2): torre de troncos con aspas de piel
  orc_mill: {
    fp: 2, fire: [[0, 1.2, 0], [0.2, 0.5, 0.3]],
    build(b) {
      const r = rng(41), HUB = [0, 1.1, 0.56], sp = { c: HUB, axis: [0, 0, 1], speed: 1.1 };
      b.cyl(0.82, 0.88, 0.1, 9, { y: 0.05, color: O.earth });
      b.cyl(0.36, 0.5, 1.0, 8, { y: 0.6, ry: PI / 8, color: O.woodD });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; beam(b, [Math.sin(a) * 0.51, 0.08, Math.cos(a) * 0.51], [Math.sin(a) * 0.37, 1.12, Math.cos(a) * 0.37], 0.055, 0.045, 6, { color: shade(O.wood, (r() - 0.5) * 0.1) }); }
      for (const [y, rr] of [[0.42, 0.48], [0.84, 0.42]]) b.cyl(rr + 0.02, rr + 0.03, 0.05, 8, { y, color: O.black });
      hideCone(b, 0, 0, 0.56, 0.52, 1.08, { seg: 8, band: 0.3, poles: false });
      point(b, [0, 1.56, 0], [0, 1.78, 0], 0.035, 5, { color: O.iron });
      skull(b, 0, 1.52, 0.12, 0.9, 0);
      // eje y aspas (giran)
      b.cyl(0.05, 0.05, 0.3, 6, { y: HUB[1], z: 0.42, rx: PI / 2, color: O.woodL });
      b.cyl(0.08, 0.08, 0.1, 8, { x: HUB[0], y: HUB[1], z: HUB[2], rx: PI / 2, color: O.iron, spin: sp });
      skull(b, HUB[0], HUB[1], HUB[2] + 0.07, 0.8, 0, {});
      for (let i = 0; i < 4; i++) {
        const a = i * PI / 2 + 0.3, dx = -Math.sin(a), dy = Math.cos(a), px = Math.cos(a), py = Math.sin(a);
        b.box(0.05, 0.86, 0.04, { x: HUB[0] + dx * 0.43, y: HUB[1] + dy * 0.43, z: HUB[2], rz: a, color: O.woodL, spin: sp });
        b.box(0.25, 0.6, 0.02, { x: HUB[0] + dx * 0.52 + px * 0.145, y: HUB[1] + dy * 0.52 + py * 0.145, z: HUB[2] - 0.012, rz: a, color: i % 2 ? O.hideL : O.hide, spin: sp });
        b.box(0.25, 0.1, 0.028, { x: HUB[0] + dx * 0.64 + px * 0.145, y: HUB[1] + dy * 0.64 + py * 0.145, z: HUB[2] - 0.012, rz: a, color: 'team', spin: sp });
        b.box(0.25, 0.06, 0.028, { x: HUB[0] + dx * 0.36 + px * 0.145, y: HUB[1] + dy * 0.36 + py * 0.145, z: HUB[2] - 0.012, rz: a, color: O.red, spin: sp });
        b.box(0.04, 0.04, 0.035, { x: HUB[0] + dx * 0.81 + px * 0.27, y: HUB[1] + dy * 0.81 + py * 0.27, z: HUB[2], rz: a, color: O.woodD, spin: sp });
      }
      // puerta, sacos, muela, bandera
      b.box(0.24, 0.34, 0.05, { y: 0.27, z: 0.48, color: HOLE });
      b.cyl(0.03, 0.03, 0.3, 5, { y: 0.45, z: 0.5, rz: PI / 2, color: O.woodL });
      for (const [x, z, s] of [[-0.55, 0.5, 1], [-0.68, 0.32, 0.9], [-0.6, 0.38, 0.85]]) b.blob(0.11 * s, 0.13 * s, 0.1 * s, 0, { x, y: 0.1 + 0.11 * s + (s < 0.88 ? 0.15 : 0), z, color: s < 0.88 ? O.hideL : O.straw });
      b.cyl(0.19, 0.19, 0.07, 9, { x: 0.6, y: 0.27, z: 0.38, rx: PI / 2, ry: -0.5, order: 'YXZ', color: O.stone });
      b.cyl(0.04, 0.04, 0.072, 6, { x: 0.6, y: 0.27, z: 0.38, rx: PI / 2, ry: -0.5, order: 'YXZ', color: O.stoneD });
      flagPole(b, -0.62, 0.08, -0.55, 1.62, { stripe: O.black });
      hideRack(b, 0.6, -0.55, 0.36, 0.5, -PI / 4);
      oShield(b, 0.42, 0.34, 0.36, 0.12, 0.85);
    },
  },

  // ------------------------------------------------------------------ aserradero (2×2): cobertizo, troncos y sierra circular
  orc_lumber: {
    fp: 2, fire: [[0, 0.9, -0.4], [0.5, 0.5, 0.4]],
    build(b) {
      const r = rng(51), SAW = [0.5, 0.4, 0.42];
      frustum(b, 1.76, 1.76, 1.66, 1.66, 0.08, { color: O.earth });
      for (const [x, z, h] of [[-0.74, -0.74, 0.95], [0.74, -0.74, 0.95], [-0.74, -0.02, 0.75], [0.74, -0.02, 0.75]]) b.cyl(0.045, 0.055, h, 6, { x, y: 0.08 + h / 2, z, color: O.woodL });
      b.box(1.66, 0.04, 0.9, { y: 0.93, z: -0.38, rx: 0.245, color: O.hide });
      b.box(1.68, 0.045, 0.14, { y: 0.84, z: 0.02, rx: 0.245, color: 'team' });
      b.box(1.68, 0.045, 0.1, { y: 0.95, z: -0.42, rx: 0.245, color: 'team', teamShade: 0.8 });
      // pila de troncos con testas claras
      let k = 0;
      for (const [row, n, y] of [[0, 4, 0.17], [1, 3, 0.32], [2, 2, 0.47]]) for (let i = 0; i < n; i++) {
        const x = -0.6 + row * 0.085 + i * 0.17;
        b.cyl(0.08, 0.08, 0.62, 7, { x, y, z: -0.4, rx: PI / 2, color: shade(O.wood, (r() - 0.5) * 0.1) });
        b.cyl(0.066, 0.066, 0.02, 7, { x, y, z: -0.085, rx: PI / 2, color: k++ % 2 ? '#c9a46e' : '#d4b07a' });
      }
      for (let i = 0; i < 3; i++) b.box(0.42, 0.035, 0.12, { x: 0.45, y: 0.1 + i * 0.04, z: -0.45, ry: i * 0.08, color: shade(O.woodL, i * 0.03) });
      // sierra circular oxidada sobre un tronco (gira)
      const sp = { c: SAW, axis: [1, 0, 0], speed: 3 };
      b.cyl(0.29, 0.29, 0.025, 8, { x: SAW[0], y: SAW[1], z: SAW[2], rz: PI / 2, color: O.iron, spin: sp });
      b.cyl(0.29, 0.29, 0.024, 8, { x: SAW[0], y: SAW[1], z: SAW[2], rz: PI / 2, rx: PI / 8, color: O.ironD, spin: sp });
      b.cyl(0.06, 0.06, 0.05, 6, { x: SAW[0], y: SAW[1], z: SAW[2], rz: PI / 2, color: O.bone, spin: sp });
      for (const s of [-1, 1]) b.box(0.05, 0.46, 0.08, { x: SAW[0] + s * 0.07, y: 0.31, z: SAW[2], color: O.woodD });
      b.cyl(0.02, 0.02, 0.24, 5, { x: SAW[0], y: SAW[1], z: SAW[2], rz: PI / 2, color: O.ironD });
      b.cyl(0.085, 0.085, 0.72, 7, { x: SAW[0], y: 0.3, z: 0.46, rx: PI / 2, color: O.woodL });
      for (const z of [0.18, 0.74]) for (const s of [-1, 1]) beam(b, [SAW[0] + s * 0.12, 0.08, z], [SAW[0] - s * 0.04, 0.27, z], 0.02, 0.02, 4, { color: O.woodD });
      // tocón con hacha clavada y astillas
      b.cyl(0.13, 0.15, 0.2, 7, { x: -0.45, y: 0.18, z: 0.45, color: O.wood });
      b.cyl(0.125, 0.125, 0.02, 7, { x: -0.45, y: 0.285, z: 0.45, color: '#c9a46e' });
      beam(b, [-0.42, 0.3, 0.45], [-0.3, 0.6, 0.52], 0.016, 0.014, 5, { color: O.woodL });
      b.box(0.12, 0.08, 0.02, { x: -0.43, y: 0.33, z: 0.45, rz: -0.35, color: O.iron });
      for (let i = 0; i < 5; i++) b.box(0.06, 0.02, 0.03, { x: -0.25 + r() * 0.5, y: 0.09, z: 0.25 + r() * 0.5, ry: r() * 3, color: '#d4b07a' });
      for (const [x, z] of [[-0.18, 0.62], [-0.08, 0.66]]) b.cyl(0.04, 0.04, 0.3, 5, { x, y: 0.12, z, rz: PI / 2, ry: 0.4, color: O.woodL });
      // bandera, escudos y calavera
      flagPole(b, -0.8, 0.08, -0.8, 1.55, { stripe: O.black });
      oShield(b, -0.74, 0.5, 0.04, 0.12, 0); oShield(b, 0.74, 0.5, 0.04, 0.12, 0, { ts: 0.85 });
      skull(b, 0.74, 0.9, 0.0, 0.9, 0, { horns: true });
    },
  },

  // ------------------------------------------------------------------ campamento minero (2×2)
  orc_mine: {
    fp: 2, fire: [[0, 0.7, -0.3], [0.5, 0.4, 0.5]],
    build(b) {
      const ROCK = '#867a6b', GOLD = '#e6c04a';
      frustum(b, 1.76, 1.76, 1.66, 1.66, 0.08, { color: O.earth });
      b.blob(0.72, 0.58, 0.44, 1, { y: 0.08, z: -0.42, color: ROCK });
      b.blob(0.42, 0.42, 0.36, 0, { x: -0.48, y: 0.12, z: -0.3, ry: 0.4, color: shade(ROCK, -0.05) });
      b.blob(0.38, 0.36, 0.34, 0, { x: 0.5, y: 0.1, z: -0.36, ry: 1.1, color: shade(ROCK, 0.04) });
      for (const [x, y, z] of [[-0.3, 0.42, -0.25], [0.3, 0.5, -0.4], [0.55, 0.3, -0.12], [-0.6, 0.3, -0.08]]) b.ball(0.045, 0, { x, y, z, color: GOLD, glow: 0.35 });
      // entrada con armazón de troncos
      b.box(0.42, 0.5, 0.16, { y: 0.33, z: 0.0, color: HOLE });
      for (const s of [-1, 1]) { b.cyl(0.05, 0.055, 0.58, 6, { x: s * 0.24, y: 0.37, z: 0.1, color: O.woodL }); tusk(b, [s * 0.36, 0.08, 0.16], [s * 0.42, 0.34, 0.2], [s * 0.32, 0.56, 0.24], 0.035, O.bone); }
      b.cyl(0.05, 0.05, 0.66, 6, { y: 0.66, z: 0.1, rz: PI / 2, color: O.woodL });
      skull(b, 0, 0.75, 0.14, 1.1, 0, { horns: true });
      // raíles y vagoneta con mineral
      for (const s of [-1, 1]) b.box(0.03, 0.03, 0.8, { x: s * 0.12, y: 0.1, z: 0.46, color: O.ironD });
      for (let i = 0; i < 5; i++) b.box(0.34, 0.02, 0.06, { y: 0.088, z: 0.12 + i * 0.17, color: O.woodD });
      const CZ = 0.56;
      frustum(b, 0.34, 0.26, 0.42, 0.32, 0.18, { y: 0.14, z: CZ, color: O.wood });
      b.box(0.43, 0.03, 0.33, { y: 0.31, z: CZ, color: O.iron });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.06, 0.06, 0.03, 8, { x: sx * 0.17, y: 0.15, z: CZ + sz * 0.09, rz: PI / 2, color: O.ironD });
      b.ball(0.09, 0, { x: -0.06, y: 0.33, z: CZ, color: GOLD, glow: 0.3 });
      b.ball(0.08, 0, { x: 0.08, y: 0.34, z: CZ + 0.03, color: '#9a8e7c' });
      b.ball(0.06, 0, { x: 0.02, y: 0.38, z: CZ - 0.06, color: GOLD, glow: 0.3 });
      // picos apoyados, montón de mineral, brasero, tienda, bandera
      for (const [x, a] of [[-0.42, 0.25], [-0.52, -0.15]]) { beam(b, [x, 0.08, 0.22], [x + 0.06, 0.5, 0.06], 0.014, 0.014, 5, { color: O.woodL }); b.box(0.2, 0.035, 0.03, { x: x + 0.06, y: 0.5, z: 0.06, rz: a, color: O.iron }); }
      for (const [x, z, s, c] of [[-0.58, 0.55, 0.1, GOLD], [-0.7, 0.42, 0.08, '#9a8e7c'], [-0.5, 0.42, 0.07, GOLD], [-0.64, 0.66, 0.07, '#9a8e7c']]) b.ball(s, 0, { x, y: 0.08 + s * 0.6, z, color: c, glow: c === GOLD ? 0.3 : 0 });
      brazier(b, 0.38, 0.22, 0.4, { y0: 0.08 });
      hideCone(b, 0.58, 0.55, 0.3, 0.55, 0.08, { seg: 7, band: 0.3, color: 'team' });
      b.box(0.7, 0.03, 0.3, { y: 0.74, z: 0.22, rx: 0.35, color: 'team' });
      b.box(0.72, 0.035, 0.05, { y: 0.69, z: 0.36, color: O.woodD });
      b.box(0.12, 0.2, 0.02, { x: 0.58, y: 0.18, z: 0.82, rx: -0.5, color: HOLE });
      flagPole(b, 0.18, 0.5, -0.45, 1.0, { stripe: O.black });
      oShield(b, -0.3, 0.42, 0.14, 0.1, 0.3);
    },
  },

  // ------------------------------------------------------------------ granja (3×3, plana): 0 tierra/vallado; 1-3 cultivo
  orc_farm: {
    fp: 3,
    build(b) {
      const r = rng(61), xs = [-1.08, -0.72, -0.36, 0, 0.36, 0.72, 1.08], zs = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
      b.box(2.8, 0.04, 2.8, { y: 0.02, color: O.soil });
      for (const x of xs) b.box(0.2, 0.035, 2.5, { x, y: 0.05, color: O.soilD });
      // vallado bajo de estacas con travesaño superior pintado
      const E = 1.34, P = [-E, -0.45, 0.45, E], seen = new Set();
      for (const p of P) for (const [x, z] of [[p, -E], [p, E], [-E, p], [E, p]]) {
        const k = x + ',' + z; if (seen.has(k)) continue; seen.add(k);
        const h = 0.2 + r() * 0.05; b.cyl(0.03, 0.035, h, 5, { x, y: 0.04 + h / 2, z, rz: (r() - 0.5) * 0.12, color: O.woodD }); b.cone(0.03, 0.07, 5, { x, y: 0.04 + h + 0.035, z, color: O.wood });
      }
      const rail = (x, z, len, alongX) => { b.box(alongX ? len : 0.075, 0.04, alongX ? 0.075 : len, { x, y: 0.2, z, color: 'team' }); b.box(alongX ? len : 0.045, 0.035, alongX ? 0.045 : len, { x, y: 0.11, z, color: "team", teamShade: 0.7 }); };
      rail(0, -E, 2.68, true); rail(-E, 0, 2.68, false); rail(E, 0, 2.68, false);
      for (const s of [-1, 1]) rail(s * 0.895, E, 0.89, true);
      // espantapájaros con calavera y estandarte
      const SX = 1.12, SZ = -1.12;
      b.cyl(0.025, 0.03, 0.62, 5, { x: SX, y: 0.35, z: SZ, color: O.woodD });
      b.cyl(0.018, 0.018, 0.36, 5, { x: SX, y: 0.52, z: SZ, rz: PI / 2, color: O.woodD });
      b.box(0.2, 0.22, 0.03, { x: SX, y: 0.42, z: SZ, color: O.hideL, flag: (px, py) => Math.max(0, 0.53 - py) * 2 });
      skull(b, SX, 0.7, SZ, 0.9, 0.4, { tusks: true });
      banner(b, SX - 0.12, 0.52, SZ + 0.03, 0.12, 0.2, { bar: false, k: 2.5 });
      // cubo y azada
      b.cyl(0.07, 0.06, 0.12, 7, { x: -1.15, y: 0.1, z: 1.15, color: O.wood });
      beam(b, [-1.25, 0.04, 0.85], [-1.28, 0.42, 0.75], 0.012, 0.012, 4, { color: O.woodL });
      // cultivo: brotes, medio, maduro (mijo dorado)
      const sway = (x, y) => Math.max(0, y - 0.04) * 1.6;
      b.part = 1; for (const x of xs) for (const z of zs) b.cone(0.05, 0.09, 4, { x: x + (r() - 0.5) * 0.04, y: 0.11, z: z + (r() - 0.5) * 0.06, ry: r() * 2, color: shade('#7fb04a', (r() - 0.5) * 0.08) });
      b.part = 2; for (const x of xs) for (const z of zs) { const h = 0.17 + r() * 0.05; b.cyl(0.065, 0.025, h, 5, { x: x + (r() - 0.5) * 0.04, y: 0.065 + h / 2, z: z + (r() - 0.5) * 0.06, ry: r() * 2, color: shade('#5f9a3c', (r() - 0.5) * 0.1), wave: sway }); }
      b.part = 3; for (const x of xs) for (const z of zs) { const h = 0.26 + r() * 0.07; b.cyl(0.085, 0.03, h, 5, { x: x + (r() - 0.5) * 0.04, y: 0.065 + h / 2, z: z + (r() - 0.5) * 0.06, ry: r() * 2, color: shade('#d8b448', (r() - 0.5) * 0.1), wave: sway }); }
    },
  },

  // ------------------------------------------------------------------ galería de tiro (3×3)
  orc_range: {
    fp: 3, fire: [[0.75, 1.0, 0.8], [-0.8, 0.5, -0.9]],
    build(b) {
      const r = rng(71);
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: O.earth });
      // dianas de paja con anillos pintados
      for (const x of [-0.85, 0.0, 0.85]) {
        const y = 0.5, z = -0.95;
        for (const s of [-1, 1]) beam(b, [x + s * 0.16, 0.08, z - 0.16], [x + s * 0.08, 0.62, z - 0.03], 0.025, 0.022, 5, { color: O.woodD });
        b.cyl(0.26, 0.26, 0.14, 10, { x, y, z, rx: PI / 2, color: O.straw });
        b.cyl(0.19, 0.19, 0.15, 10, { x, y, z, rx: PI / 2, color: 'team' });
        b.cyl(0.12, 0.12, 0.16, 10, { x, y, z, rx: PI / 2, color: O.bone });
        b.cyl(0.05, 0.05, 0.17, 8, { x, y, z, rx: PI / 2, color: O.black });
        for (let i = 0; i < 2; i++) { const ax = x + (r() - 0.5) * 0.24, ay = y + (r() - 0.5) * 0.24; beam(b, [ax, ay, z + 0.06], [ax + 0.02, ay + 0.03, z + 0.3], 0.008, 0.008, 4, { color: O.woodL }); b.box(0.004, 0.035, 0.05, { x: ax + 0.02, y: ay + 0.03, z: z + 0.28, color: O.red }); }
      }
      // línea de tiro
      for (const x of [-1.2, -0.6, 0]) b.cyl(0.03, 0.035, 0.32, 5, { x, y: 0.24, z: 0.3, color: O.woodD });
      b.cyl(0.035, 0.035, 1.34, 6, { x: -0.6, y: 0.36, z: 0.3, rz: PI / 2, color: O.wood });
      // plataforma elevada de arqueros con tejado de pieles
      const PX = 0.75, PZ = 0.75;
      for (const [x, z] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) b.cyl(0.045, 0.05, 0.6, 6, { x: PX + x, y: 0.38, z: PZ + z, color: O.woodL });
      b.box(0.92, 0.06, 0.72, { x: PX, y: 0.7, z: PZ, color: O.wood });
      palisade(b, PX, PZ + 0.34, 0.9, 0.26, 0, { y: 0.73, seed: 13, rope: false });
      palisade(b, PX - 0.44, PZ, 0.6, 0.26, PI / 2, { y: 0.73, seed: 14, rope: false });
      for (const x of [-0.4, 0.4]) b.cyl(0.035, 0.04, 0.62, 6, { x: PX + x, y: 1.04, z: PZ - 0.32, color: O.woodD });
      b.box(1.0, 0.035, 0.86, { x: PX, y: 1.3, z: PZ + 0.02, rx: 0.25, color: 'team' });
      b.box(1.02, 0.04, 0.12, { x: PX, y: 1.25, z: PZ + 0.22, rx: 0.25, color: O.hide });
      b.box(1.02, 0.04, 0.1, { x: PX, y: 1.36, z: PZ - 0.2, rx: 0.25, color: O.hideD });
      beam(b, [PX + 0.25, 0.08, PZ + 0.55], [PX + 0.25, 0.73, PZ + 0.3], 0.018, 0.018, 4, { color: O.woodD });
      oShield(b, PX + 0.15, 0.85, PZ + 0.41, 0.11, 0);
      // armero de arcos y carcaj
      const BX = -0.8, BZ = 0.85;
      for (const s of [-1, 1]) b.cyl(0.028, 0.032, 0.6, 5, { x: BX + s * 0.3, y: 0.38, z: BZ, color: O.woodD });
      b.box(0.68, 0.04, 0.05, { x: BX, y: 0.62, z: BZ, color: O.wood });
      for (let i = 0; i < 3; i++) {
        const x = BX - 0.17 + i * 0.17, z = BZ + 0.04;
        beam(b, [x, 0.66, z], [x + 0.06, 0.4, z + 0.03], 0.013, 0.011, 4, { color: O.woodL });
        beam(b, [x + 0.06, 0.4, z + 0.03], [x, 0.14, z + 0.06], 0.011, 0.013, 4, { color: O.woodL });
        beam(b, [x - 0.01, 0.65, z], [x - 0.01, 0.15, z + 0.06], 0.004, 0.004, 3, { color: O.bone });
      }
      b.cyl(0.1, 0.09, 0.24, 8, { x: -0.2, y: 0.2, z: 0.9, color: O.wood });
      for (let i = 0; i < 4; i++) { const a = i * 1.6; beam(b, [-0.2 + Math.sin(a) * 0.04, 0.2, 0.9 + Math.cos(a) * 0.04], [-0.2 + Math.sin(a) * 0.08, 0.44, 0.9 + Math.cos(a) * 0.08], 0.008, 0.008, 3, { color: O.woodL }); b.box(0.03, 0.05, 0.004, { x: -0.2 + Math.sin(a) * 0.08, y: 0.43, z: 0.9 + Math.cos(a) * 0.08, ry: a, color: O.red }); }
      // estandarte, pacas de paja y calavera-diana
      flagPole(b, -1.25, 0.08, 1.2, 1.6, { w: 0.38, fh: 0.24, stripe: O.black });
      for (const [x, z] of [[1.2, -0.35], [1.15, -0.05]]) b.cyl(0.13, 0.13, 0.3, 8, { x, y: 0.21, z, rz: PI / 2, ry: 0.2, color: O.straw });
      stake(b, -1.25, 0.08, -0.55, 0.55, 0.035, O.woodD); skull(b, -1.25, 0.69, -0.53, 1.0, 0.3, { tusks: true });
      beam(b, [-1.26, 0.7, -0.48], [-1.2, 0.74, -0.2], 0.008, 0.008, 4, { color: O.woodL });
    },
  },

  // ------------------------------------------------------------------ establo (3×3): perreras de lobos
  orc_stable: {
    fp: 3, fire: [[0, 0.8, -0.8], [-0.8, 0.6, -0.8]],
    build(b) {
      const r = rng(81), ZK = -0.78;
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: O.earth });
      b.box(2.3, 0.44, 0.9, { y: 0.3, z: ZK, color: O.woodD });
      hideRoof(b, 2.5, 0.62, 1.22, 0.52, { z: ZK, stripes: [0.28, 0.6], sw: 0.1 });
      for (const x of [-0.75, 0, 0.75]) {
        b.cyl(0.14, 0.14, 0.05, 9, { x, y: 0.22, z: ZK + 0.45, rx: PI / 2, color: HOLE });
        b.torus(0.155, 0.025, 10, 4, { x, y: 0.22, z: ZK + 0.47, color: O.bone });
      }
      for (const x of [-0.38, 0.38]) skull(b, x, 0.4, ZK + 0.48, 0.85, 0, { tusks: true });
      for (const x of [-1.05, 1.05]) oShield(b, x, 0.3, ZK + 0.48, 0.11, 0);
      // empalizada del cercado con puerta
      for (const e of [-1, 1]) palisade(b, e * 1.3, 0.47, 1.54, 0.42, PI / 2, { seed: 20 + e });
      for (const e of [-1, 1]) palisade(b, e * 0.85, 1.24, 0.9, 0.42, 0, { seed: 23 + e });
      // postes de la puerta con cráneos de lobo
      for (const e of [-1, 1]) {
        const x = e * 0.34, z = 1.2;
        b.cyl(0.05, 0.06, 0.85, 6, { x, y: 0.5, z, color: O.woodL });
        b.box(0.12, 0.1, 0.13, { x, y: 0.97, z: z + 0.02, color: O.bone });
        b.box(0.07, 0.06, 0.12, { x, y: 0.94, z: z + 0.13, color: O.boneD });
        for (const s of [-1, 1]) { b.cone(0.025, 0.08, 4, { x: x + s * 0.045, y: 1.06, z, color: O.boneD }); b.box(0.022, 0.02, 0.012, { x: x + s * 0.03, y: 0.99, z: z + 0.085, color: DARK }); }
        point(b, [x - 0.02, 0.92, z + 0.17], [x - 0.02, 0.88, z + 0.19], 0.012, 4, { color: O.bone });
      }
      flagPole(b, 0.34, 1.02, 1.2, 0.55, { w: 0.3, fh: 0.18, dir: 1 });
      // lobos
      wolf(b, -0.5, 0.3, 0.7, 0.08); wolf(b, 0.6, 0.55, -2.3, 0.08, 1.05); wolf(b, 0.15, -0.12, 0.2, 0.08, 0.9);
      // secadero de carne, huesos, abrevadero, paja
      const MX = -0.95, MZ = -0.05;
      for (const s of [-1, 1]) b.cyl(0.025, 0.03, 0.62, 5, { x: MX + s * 0.22, y: 0.39, z: MZ, color: O.woodD });
      b.cyl(0.02, 0.02, 0.54, 5, { x: MX, y: 0.66, z: MZ, rz: PI / 2, color: O.woodD });
      for (const x of [-0.12, 0.02, 0.14]) b.blob(0.045, 0.08, 0.035, 0, { x: MX + x, y: 0.54, z: MZ, color: O.meat });
      for (let i = 0; i < 3; i++) b.cyl(0.018, 0.018, 0.2, 5, { x: 0.95 + i * 0.06, y: 0.1, z: -0.05 + i * 0.05, rz: PI / 2, ry: r() * 3, color: O.bone });
      skull(b, 1.0, 0.13, 0.1, 0.8, -0.6);
      b.box(0.5, 0.12, 0.18, { x: -0.6, y: 0.14, z: 0.95, color: O.wood }); b.box(0.44, 0.02, 0.12, { x: -0.6, y: 0.2, z: 0.95, color: '#5f7f8a' });
      for (const [x, z] of [[0.95, 0.95], [-0.2, 0.05]]) b.blob(0.22, 0.03, 0.16, 0, { x, y: 0.09, z, ry: r() * 3, color: O.straw });
    },
  },

  // ------------------------------------------------------------------ templo (3×3): cabaña chamánica, altar y tótems
  orc_temple: {
    fp: 3, smoke: [[0, 0.9, 0.42]], fire: [[0, 1.2, -0.5], [-0.9, 0.9, 0.4]],
    build(b) {
      const r = rng(91), ZD = -0.5;
      frustum(b, 2.8, 2.8, 2.64, 2.64, 0.12, { color: O.stoneD });
      frustum(b, 2.2, 2.0, 2.04, 1.84, 0.12, { y: 0.12, z: -0.24, color: O.stone });
      b.box(0.8, 0.06, 0.22, { y: 0.15, z: 0.83, color: O.stone });
      // cúpula de pieles con costillas de hueso
      b.blob(0.72, 1.08, 0.72, 1, { y: 0.24, z: ZD, color: O.hide });
      for (let i = 0; i < 4; i++) b.torus(0.73, i % 2 ? 0.035 : 0.06, 16, 4, { y: 0.24, z: ZD, sy: 1.08 / 0.73, ry: i * PI / 4 + PI / 8, color: i % 2 ? O.bone : 'team' });
      b.cyl(0.71, 0.73, 0.14, 14, { y: 0.31, z: ZD, color: O.red });
      b.cyl(0.2, 0.2, 0.06, 8, { y: 0.4, z: ZD + 0.68, rx: PI / 2, color: HOLE });
      skull(b, 0, 1.36, ZD, 1.5, 0, { horns: true, tusks: true });
      point(b, [0, 1.42, ZD - 0.05], [0, 1.72, ZD - 0.08], 0.03, 5, { color: O.iron });
      // altar con fuego de sangre bajo un arco de colmillos
      const AZ = 0.42;
      frustum(b, 0.56, 0.4, 0.5, 0.34, 0.3, { y: 0.24, z: AZ, color: O.stoneD, jit: 0.02 });
      b.box(0.52, 0.04, 0.06, { y: 0.4, z: AZ + 0.19, color: O.red });
      b.cyl(0.13, 0.08, 0.08, 8, { y: 0.58, z: AZ, color: O.iron });
      const fl = (px, py) => Math.max(0, py - 0.6) * 5;
      b.cone(0.11, 0.3, 6, { y: 0.76, z: AZ, color: '#ff3a24', glow: 1, flag: fl });
      b.cone(0.06, 0.2, 5, { y: 0.72, z: AZ, ry: 0.4, color: '#ffb040', glow: 1, flag: fl });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) tusk(b, [sx * 0.5, 0.24, AZ + sz * 0.38], [sx * 0.52, 0.8, AZ + sz * 0.4], [sx * 0.1, 1.22, AZ + sz * 0.08], 0.05, sz > 0 ? O.bone : O.boneD);
      // tótems con estandartes
      for (const e of [-1, 1]) {
        const TX = e * 1.02, TZ = 0.5;
        b.cyl(0.065, 0.08, 1.7, 6, { x: TX, y: 0.12 + 0.85, z: TZ, color: O.woodD });
        [[0.5, O.red], [0.88, O.black]].forEach(([y, c], i) => {
          b.box(0.22, 0.26, 0.2, { x: TX, y: 0.12 + y, z: TZ, color: shade(O.woodL, i * 0.04) });
          b.box(0.23, 0.05, 0.21, { x: TX, y: 0.16 + y, z: TZ, color: c });
          for (const s of [-1, 1]) { b.box(0.04, 0.03, 0.02, { x: TX + s * 0.05, y: 0.16 + y, z: TZ + 0.105, color: O.bone }); point(b, [TX + s * 0.06, 0.04 + y, TZ + 0.1], [TX + s * 0.08, 0.13 + y, TZ + 0.16], 0.018, 4, { color: O.bone }); }
        });
        banner(b, TX, 1.62, TZ + 0.1, 0.32, 0.42, { emblem: O.black });
        skull(b, TX, 1.92, TZ, 1.1, 0, { horns: true });
      }
      // estacas con calaveras y braseros
      for (const [x, z] of [[-1.25, -1.15], [1.25, -1.15], [-1.25, -0.2], [1.25, -0.2]]) { stake(b, x, 0.12, z, 0.5, 0.032, O.woodD); skull(b, x, 0.72, z + 0.02, 0.85, 0); }
      for (const s of [-1, 1]) brazier(b, s * 0.52, 1.0, 0.36, { y0: 0.12 });
    },
  },

  // ------------------------------------------------------------------ herrería (2×2): horno de piedra y yunque
  orc_forge: {
    fp: 2, smoke: [[-0.48, 1.58, -0.48]], fire: [[-0.45, 0.8, -0.45], [0.45, 0.9, -0.3]],
    build(b) {
      const r = rng(101);
      frustum(b, 1.76, 1.76, 1.66, 1.66, 0.08, { color: O.earth });
      b.box(1.0, 0.02, 1.0, { x: 0.2, y: 0.09, z: 0.1, color: O.stoneD });
      // horno y chimenea
      frustum(b, 0.74, 0.66, 0.62, 0.54, 0.56, { x: -0.45, y: 0.08, z: -0.45, color: O.stone, jit: 0.02 });
      b.box(0.26, 0.2, 0.04, { x: -0.42, y: 0.28, z: -0.115, color: FIRE, glow: 1 });
      b.box(0.34, 0.05, 0.06, { x: -0.42, y: 0.41, z: -0.11, color: O.stoneD });
      frustum(b, 0.36, 0.36, 0.28, 0.28, 0.86, { x: -0.48, y: 0.63, z: -0.48, color: O.stoneD, jit: 0.015 });
      b.cyl(0.21, 0.21, 0.05, 4, { x: -0.48, y: 1.0, z: -0.48, ry: PI / 4, color: O.iron });
      b.box(0.34, 0.05, 0.34, { x: -0.48, y: 1.51, z: -0.48, color: O.stone });
      for (const [x, z] of [[-0.75, -0.1], [-0.15, -0.75]]) rock(b, x, 0.12, z, 0.07, 0.05, 0.07, O.stoneD, x * 10);
      // fuelle de cuero
      b.wedge(0.26, 0.12, 0.16, { x: -0.08, y: 0.16, z: -0.32, ry: PI / 2, color: O.hideD });
      b.box(0.24, 0.06, 0.18, { x: -0.08, y: 0.13, z: -0.32, ry: PI / 2, color: O.woodD });
      // cobertizo de pieles a la derecha
      for (const [x, z, h] of [[0.12, 0.05, 0.8], [0.8, 0.05, 0.8], [0.12, -0.8, 1.0], [0.8, -0.8, 1.0]]) b.cyl(0.035, 0.045, h, 6, { x, y: 0.08 + h / 2, z, color: O.woodL });
      b.box(0.86, 0.035, 0.98, { x: 0.46, y: 0.98, z: -0.38, rx: 0.2, color: O.hide });
      b.box(0.88, 0.04, 0.24, { x: 0.46, y: 0.91, z: -0.01, rx: 0.2, color: 'team' });
      b.box(0.88, 0.04, 0.1, { x: 0.46, y: 1.0, z: -0.42, rx: 0.2, color: 'team', teamShade: 0.8 });
      // armero de espadas y hachas
      b.box(0.6, 0.04, 0.05, { x: 0.46, y: 0.6, z: -0.78, color: O.wood });
      for (let i = 0; i < 4; i++) { const x = 0.24 + i * 0.15; b.box(0.03, 0.4, 0.01, { x, y: 0.4, z: -0.74, rz: (i - 1.5) * 0.06, color: i % 2 ? '#9a9590' : O.iron }); b.box(0.08, 0.02, 0.02, { x, y: 0.58, z: -0.74, color: O.ironD }); }
      // yunque sobre tocón, martillo, barril de temple, lingotes y carbón
      const AX = 0.3, AZ = 0.38;
      b.cyl(0.13, 0.15, 0.2, 7, { x: AX, y: 0.19, z: AZ, color: O.wood });
      b.box(0.1, 0.08, 0.09, { x: AX, y: 0.33, z: AZ, color: O.ironD });
      b.box(0.26, 0.065, 0.12, { x: AX, y: 0.4, z: AZ, color: O.iron });
      point(b, [AX + 0.13, 0.4, AZ], [AX + 0.24, 0.41, AZ], 0.04, 5, { color: O.iron });
      beam(b, [AX - 0.05, 0.44, AZ + 0.03], [AX - 0.18, 0.47, AZ + 0.17], 0.012, 0.012, 4, { color: O.woodL });
      b.box(0.05, 0.05, 0.1, { x: AX - 0.04, y: 0.455, z: AZ + 0.02, ry: 0.8, color: O.ironD });
      b.cyl(0.13, 0.12, 0.28, 8, { x: -0.32, y: 0.22, z: 0.42, color: O.wood });
      b.cyl(0.115, 0.115, 0.02, 8, { x: -0.32, y: 0.355, z: 0.42, color: '#4f6a72' });
      b.cyl(0.135, 0.135, 0.025, 8, { x: -0.32, y: 0.28, z: 0.42, color: O.ironD });
      for (let i = 0; i < 3; i++) b.box(0.16, 0.04, 0.06, { x: 0.65, y: 0.12 + i * 0.04, z: 0.45 + (i % 2) * 0.03, ry: i * 0.3, color: i === 2 ? '#c9853a' : O.iron, glow: i === 2 ? 0.4 : 0 });
      for (let i = 0; i < 4; i++) b.ball(0.06, 0, { x: -0.68 + r() * 0.12, y: 0.12, z: 0.2 + r() * 0.15, color: '#4a3c32' });
      flagPole(b, -0.78, 0.08, 0.72, 1.45, { stripe: O.black });
      oShield(b, 0.76, 0.5, 0.1, 0.12, 0.3);
      skull(b, 0.12, 0.9, 0.1, 0.85, 0, { horns: true });
    },
  },

  // ------------------------------------------------------------------ mercado (3×3): puestos con toldos del equipo
  orc_market: {
    fp: 3, fire: [[0, 0.9, -0.8], [-0.9, 0.7, 0.3], [0.9, 0.7, 0.3]],
    build(b) {
      const r = rng(111);
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: O.earth });
      oStall(b, 0, -0.85, 0, 1.3, 0.7, (at, ry) => {
        for (const lx of [-0.4, -0.2, 0.0, 0.25, 0.42]) { const [x, z] = at(lx, 0.33); b.blob(0.05, 0.085, 0.04, 0, { x, y: 0.68, z, color: lx === 0 ? O.hideL : O.meat }); }
        for (const lx of [-0.4, 0.4]) { const [x, z] = at(lx, 0.25); skull(b, x, 0.47, z, 0.8, ry); }
        const [x, z] = at(0, 0.24); b.box(0.3, 0.06, 0.18, { x, y: 0.44, z, ry, color: O.hideL });
      });
      oStall(b, -0.92, 0.35, PI / 2, 1.1, 0.6, (at, ry) => {
        for (const [lx, c, h] of [[-0.3, O.hideL, 0.04], [-0.3, O.hide, 0.08], [0.0, O.hideD, 0.04], [0.0, '#c9b48a', 0.08]]) { const [x, z] = at(lx, 0.2); b.box(0.24, 0.04, 0.16, { x, y: 0.41 + h, z, ry: ry + h, color: c }); }
        for (const lx of [0.25, 0.38]) { const [x, z] = at(lx, 0.2); b.cyl(0.05, 0.04, 0.12, 7, { x, y: 0.47, z, color: lx > 0.3 ? O.red : '#8a6a50' }); }
      });
      oStall(b, 0.92, 0.35, -PI / 2, 1.1, 0.6, (at, ry) => {
        for (const lx of [-0.32, -0.12]) { const [x, z] = at(lx, 0.22); oShield(b, x, 0.52, z, 0.1, ry, { ts: lx < -0.2 ? 1 : 0.8 }); }
        for (const lx of [0.12, 0.3]) { const [x, z] = at(lx, 0.2); b.box(0.04, 0.03, 0.26, { x, y: 0.42, z, ry: ry + 0.3, color: O.woodL }); const [hx, hz] = at(lx, 0.1); b.box(0.1, 0.03, 0.06, { x: hx, y: 0.43, z: hz, ry, color: O.iron }); }
      });
      // tótem central con bandera y brasero
      b.cyl(0.07, 0.085, 1.5, 6, { y: 0.83, z: 0.15, color: O.woodD });
      b.box(0.2, 0.22, 0.2, { y: 0.55, z: 0.15, color: O.woodL }); b.box(0.21, 0.05, 0.21, { y: 0.6, z: 0.15, color: O.red });
      skull(b, 0, 1.62, 0.15, 1.1, 0, { horns: true });
      flagPole(b, 0.0, 1.0, 0.15, 0.55, { w: 0.4, fh: 0.24, r: 0.02, stripe: O.black });
      brazier(b, 0.38, 0.55, 0.38, { y0: 0.08, tripod: true });
      // cajas, barriles y carreta
      for (const [x, z, s] of [[-0.3, 0.6, 0.2], [-0.42, 0.78, 0.16], [0.95, -0.62, 0.22]]) b.box(s, s, s, { x, y: 0.08 + s / 2, z, ry: r(), color: O.woodD });
      for (const [x, z] of [[-1.15, -0.55], [-0.98, -0.62]]) b.cyl(0.1, 0.1, 0.24, 8, { x, y: 0.2, z, color: O.wood });
      const CX = 0.55, CZ = 1.05;
      b.box(0.62, 0.06, 0.36, { x: CX, y: 0.28, z: CZ, ry: 0.15, color: O.wood });
      for (const s of [-1, 1]) b.cyl(0.13, 0.13, 0.04, 8, { x: CX + s * 0.05, y: 0.21, z: CZ + s * 0.21, rx: PI / 2, ry: 0.15, order: 'YXZ', color: O.woodD });
      beam(b, [CX - 0.3, 0.28, CZ + 0.05], [CX - 0.62, 0.12, CZ + 0.1], 0.02, 0.02, 4, { color: O.woodD });
      for (const [x, z] of [[CX - 0.1, CZ], [CX + 0.1, CZ + 0.05], [CX + 0.02, CZ - 0.06]]) b.blob(0.1, 0.12, 0.09, 0, { x, y: 0.42, z, color: O.straw });
    },
  },

  // ------------------------------------------------------------------ torre de vigía (2×2, ~2.6)
  orc_tower: {
    fp: 2, fire: [[0, 2.2, 0], [0, 1.2, 0.3]],
    build(b) {
      const r = rng(121), B = 0.58, T = 0.41, Y0 = 0.1, Y1 = 1.78, lp = (y) => legPos(B, T, Y0, Y1, y);
      b.cyl(0.82, 0.88, 0.12, 8, { y: 0.06, color: O.earth });
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; rock(b, Math.sin(a) * 0.76, 0.1, Math.cos(a) * 0.76, 0.08, 0.06, 0.07, shade(O.stone, (r() - 0.5) * 0.1), i + 60); }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beam(b, [sx * B, 0.08, sz * B], [sx * T, Y1 + 0.02, sz * T], 0.08, 0.065, 7, { color: O.woodL });
      // arriostramiento
      const sides = [[[-1, 1], [1, 1]], [[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]]];
      sides.forEach(([[ax, az], [bx, bz]], i) => {
        const nx = (ax + bx) / 2 * 0.06, nz = (az + bz) / 2 * 0.06, P = (sx, sz, y) => [sx * lp(y) + nx, y, sz * lp(y) + nz];
        beam(b, P(ax, az, 0.22), P(bx, bz, 0.95), 0.026, 0.026, 5, { color: O.wood });
        beam(b, P(bx, bz, 0.22), P(ax, az, 0.95), 0.026, 0.026, 5, { color: O.woodD });
        beam(b, P(ax, az, 0.98), P(bx, bz, 0.98), 0.03, 0.03, 5, { color: O.woodD });
        beam(b, P(i % 2 ? ax : bx, i % 2 ? az : bz, 1.0), P(i % 2 ? bx : ax, i % 2 ? bz : az, 1.68), 0.024, 0.024, 5, { color: O.wood });
      });
      // escalera (lado derecho)
      for (const s of [-1, 1]) beam(b, [0.76, 0.08, s * 0.1], [0.5, Y1 + 0.06, s * 0.1], 0.018, 0.018, 4, { color: O.woodD });
      for (let i = 0; i < 6; i++) { const t = (i + 0.7) / 7; b.box(0.025, 0.025, 0.22, { x: 0.76 - 0.26 * t, y: 0.08 + 1.76 * t, z: 0, color: O.wood }); }
      // plataforma con parapeto de estacas
      b.box(1.1, 0.08, 1.1, { y: Y1 + 0.04, color: O.wood });
      for (const [x, z, ry] of [[0, 0.52, 0], [0, -0.52, 0], [-0.52, 0, PI / 2], [0.52, 0, PI / 2]]) palisade(b, x, z, 1.08, 0.3, ry, { y: Y1 + 0.08, seed: 30 + x * 7 + z * 3, d: 0.05, rope: false });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cyl(0.035, 0.04, 0.36, 5, { x: sx * 0.47, y: Y1 + 0.26, z: sz * 0.47, color: O.woodD });
      hideCone(b, 0, 0, 0.74, 0.48, Y1 + 0.42, { seg: 8, ry: PI / 8, band: 0.3, poles: false });
      flagPole(b, 0, Y1 + 0.8, 0, 0.5, { w: 0.34, fh: 0.2, stripe: O.black });
      // estandarte colgante, escudos y calaveras
      b.cyl(0.02, 0.02, 0.86, 5, { y: Y1 - 0.06, z: lp(Y1 - 0.06) + 0.07, rz: PI / 2, color: O.woodD });
      banner(b, 0, Y1 - 0.06, lp(Y1 - 0.06) + 0.08, 0.42, 0.52, { bar: false, emblem: O.bone });
      for (const x of [-0.3, 0.3]) oShield(b, x, Y1 + 0.22, 0.6, 0.11, 0);
      oShield(b, -0.6, Y1 + 0.22, 0, 0.11, -PI / 2, { ts: 0.85 });
      for (const sx of [-1, 1]) skull(b, sx * 0.47, Y1 + 0.5, 0.5, 0.8, 0);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; point(b, [Math.sin(a) * 0.62, 0.1, Math.cos(a) * 0.62], [Math.sin(a) * 0.82, 0.32, Math.cos(a) * 0.82], 0.03, 5, { color: O.iron }); }
    },
  },

  // ------------------------------------------------------------------ puerta (1×1): 0 marco, 1 cerrada, 2 abierta
  orc_gate: {
    fp: 1,
    build(b) {
      // torres de troncos a ambos lados (empalman con los tramos en x = ±0.5)
      for (const s of [-1, 1]) {
        b.box(0.26, 0.14, 0.46, { x: s * 0.37, y: 0.07, color: O.earth });
        b.cyl(0.115, 0.125, 1.08, 8, { x: s * 0.375, y: 0.62, color: O.woodL });
        b.cone(0.115, 0.2, 8, { x: s * 0.375, y: 1.26, color: O.wood });
        for (const z of [-0.15, 0.15]) stake(b, s * 0.38, 0.1, z, 0.84, 0.065, O.wood);
        b.cyl(0.125, 0.125, 0.12, 8, { x: s * 0.375, y: 0.86, color: 'team' });
        banner(b, s * 0.375, 0.78, 0.2, 0.16, 0.34, { bar: false, k: 2 });
        point(b, [s * 0.4, 0.4, 0.2], [s * 0.42, 0.5, 0.34], 0.03, 5, { color: O.iron });
        point(b, [s * 0.4, 0.4, -0.2], [s * 0.42, 0.5, -0.34], 0.03, 5, { color: O.iron });
        tusk(b, [s * 0.3, 0.05, 0.22], [s * 0.34, 0.3, 0.27], [s * 0.26, 0.48, 0.3], 0.03, O.bone);
      }
      b.cyl(0.07, 0.07, 1.0, 7, { y: 1.02, z: 0.06, rz: PI / 2, color: O.woodL });
      b.cyl(0.06, 0.06, 1.0, 7, { y: 1.02, z: -0.08, rz: PI / 2, color: O.wood });
      skull(b, 0, 1.13, 0.06, 1.3, 0, { horns: true, tusks: true });
      b.cyl(0.015, 0.015, 0.45, 5, { x: 0.38, y: 1.5, color: O.woodD });
      b.box(0.22, 0.13, 0.02, { x: 0.27, y: 1.64, color: 'team', flag: (px) => Math.abs(px - 0.38) * 4 });
      // hojas: 1 = cerradas, 2 = abiertas (giran hacia -Z)
      const leaf = (s, open) => {
        const hx = s * 0.26, P = (u, t) => open ? [s * 0.225 + s * t, -0.03 - u] : [hx - s * u, t];
        const ry = open ? PI / 2 : 0;
        let [x, z] = P(0.125, 0); b.box(0.24, 0.66, 0.05, { x, y: 0.43, z, ry, color: O.wood });
        for (const u of [0.04, 0.125, 0.21]) { [x, z] = P(u, 0); b.cone(0.04, 0.12, 5, { x, y: 0.82, z, color: O.woodL }); }
        for (const y of [0.25, 0.6]) { [x, z] = P(0.125, 0.03); b.box(0.25, 0.05, 0.025, { x, y, z, ry, color: O.ironD }); }
        [x, z] = P(0.17, 0.035); b.ball(0.025, 0, { x, y: 0.43, z, color: O.iron });
      };
      b.part = 1; leaf(-1, false); leaf(1, false);
      b.part = 2; leaf(-1, true); leaf(1, true);
    },
  },

  // ------------------------------------------------------------------ taller de asedio (3×3)
  orc_workshop: {
    fp: 3, fire: [[0, 1.4, -0.65], [-0.5, 0.6, 0.5]],
    build(b) {
      const r = rng(131), ZS = -0.65;
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: O.earth });
      for (const x of [-1.1, 0, 1.1]) for (const z of [ZS + 0.58, ZS - 0.58]) b.cyl(0.05, 0.06, 0.92, 6, { x, y: 0.54, z, color: O.woodL });
      hideRoof(b, 2.44, 0.72, 1.36, 1.0, { z: ZS });
      b.box(1.0, 0.06, 0.4, { x: -0.5, y: 0.5, z: ZS - 0.3, color: O.wood });
      for (const s of [-1, 1]) b.box(0.06, 0.42, 0.36, { x: -0.5 + s * 0.44, y: 0.29, z: ZS - 0.3, color: O.woodD });
      for (let i = 0; i < 4; i++) b.box(0.9, 0.035, 0.14, { x: 0.5, y: 0.11 + i * 0.035, z: ZS - 0.25 + (i % 2) * 0.03, ry: (r() - 0.5) * 0.1, color: shade(O.woodL, i * 0.02) });
      for (const z of [ZS - 0.1, ZS + 0.2]) b.cyl(0.15, 0.15, 0.05, 9, { x: 1.2, y: 0.24, z, rz: PI / 2 - 0.25, color: O.woodD });
      // catapulta a medio hacer
      const C = rot(-0.6, 0.55, 0.25), at = (lx, ly, lz) => { const [x, z] = C(lx, lz); return [x, ly, z]; };
      for (const s of [-1, 1]) beam(b, at(s * 0.2, 0.2, -0.45), at(s * 0.2, 0.2, 0.45), 0.04, 0.04, 6, { color: O.wood });
      for (const lz of [-0.35, 0.35]) beam(b, at(-0.24, 0.22, lz), at(0.24, 0.22, lz), 0.035, 0.035, 6, { color: O.woodD });
      for (const [lx, lz] of [[-0.27, -0.3], [0.27, -0.3], [-0.27, 0.3]]) { const p = at(lx, 0.15, lz); b.cyl(0.14, 0.14, 0.04, 9, { x: p[0], y: p[1], z: p[2], rz: PI / 2, ry: 0.25, order: 'YXZ', color: O.woodD }); b.cyl(0.04, 0.04, 0.05, 6, { x: p[0], y: p[1], z: p[2], rz: PI / 2, ry: 0.25, order: 'YXZ', color: O.iron }); }
      for (const s of [-1, 1]) { beam(b, at(s * 0.2, 0.22, -0.25), at(s * 0.2, 0.66, -0.02), 0.03, 0.028, 5, { color: O.woodL }); beam(b, at(s * 0.2, 0.22, 0.2), at(s * 0.2, 0.66, -0.02), 0.03, 0.028, 5, { color: O.woodL }); }
      beam(b, at(-0.24, 0.66, -0.02), at(0.24, 0.66, -0.02), 0.03, 0.03, 5, { color: O.iron });
      beam(b, at(0, 0.28, 0.4), at(0, 0.84, -0.32), 0.035, 0.03, 6, { color: O.woodL });
      let p = at(0, 0.9, -0.36); b.cyl(0.09, 0.05, 0.08, 7, { x: p[0], y: p[1], z: p[2], color: O.iron });
      // ariete con cabeza de hierro sobre caballetes
      const RX = 0.7, RZ = 0.5;
      for (const z of [RZ - 0.3, RZ + 0.25]) for (const s of [-1, 1]) beam(b, [RX + s * 0.14, 0.08, z], [RX - s * 0.04, 0.34, z], 0.025, 0.025, 4, { color: O.woodD });
      b.cyl(0.1, 0.11, 1.0, 7, { x: RX, y: 0.38, z: RZ, rx: PI / 2, color: O.wood });
      point(b, [RX, 0.38, RZ + 0.5], [RX, 0.38, RZ + 0.72], 0.13, 6, { color: O.iron });
      for (const z of [RZ + 0.3, RZ + 0.42]) b.cyl(0.115, 0.115, 0.04, 7, { x: RX, y: 0.38, z, rx: PI / 2, color: O.ironD });
      for (const s of [-1, 1]) point(b, [RX + s * 0.08, 0.42, RZ + 0.5], [RX + s * 0.2, 0.5, RZ + 0.62], 0.03, 5, { color: O.bone });
      // grúa trípode con tronco colgando
      const TP = [0.15, 1.42, 0.25];
      for (const [x, z] of [[-0.2, 0.55], [0.5, 0.5], [0.15, -0.12]]) beam(b, [x, 0.08, z], TP, 0.03, 0.022, 5, { color: O.woodD });
      beam(b, TP, [0.15, 0.62, 0.25], 0.008, 0.008, 3, { color: '#6b5236' });
      b.cyl(0.07, 0.07, 0.5, 6, { x: 0.15, y: 0.58, z: 0.25, rz: PI / 2, color: O.woodL });
      // estandarte, escudos
      flagPole(b, -1.25, 0.08, 1.22, 1.55, { w: 0.38, fh: 0.24, stripe: O.black });
      for (const x of [-1.1, 1.1]) oShield(b, x, 0.6, ZS + 0.64, 0.12, 0);
      skull(b, 0, 0.95, ZS + 0.66, 1.0, 0, { horns: true });
    },
  },

  // ------------------------------------------------------------------ castillo (4×4, ~2.8): fortaleza orca
  orc_castle: {
    fp: 4, fire: [[0, 2.0, -0.2], [-1.38, 1.5, 1.38], [1.38, 1.5, -1.38], [0.6, 1.0, 1.3]],
    build(b) {
      const r = rng(141), C = 1.38, ZK = -0.25;
      frustum(b, 3.68, 3.68, 3.54, 3.54, 0.16, { color: O.stoneD });
      // murallas: zócalo de piedra + empalizada doble
      const wall = (x, z, len, ry, seed) => { b.box(len, 0.3, 0.42, { x, y: 0.31, z, ry, color: O.stone }); palisade(b, x, z, len, 0.62, ry, { y: 0.46, seed, d: 0.08, rope: 'team', ropeH: 0.07 }); };
      wall(0, -C, 2.3, 0, 1); wall(-C, 0, 2.3, PI / 2, 2); wall(C, 0, 2.3, PI / 2, 3);
      wall(-0.86, C, 0.72, 0, 4); wall(0.86, C, 0.72, 0, 5);
      // torres de esquina de troncos con tejado de pieles y bandera
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * C, z = sz * C;
        b.cyl(0.44, 0.46, 0.26, 8, { x, y: 0.29, z, color: O.stone });
        b.cyl(0.36, 0.4, 1.28, 8, { x, y: 1.06, z, color: O.woodL });
        b.cyl(0.37, 0.37, 0.1, 8, { x, y: 1.2, z, color: 'team' });
        b.cyl(0.44, 0.44, 0.08, 8, { x, y: 1.72, z, color: O.woodD });
        b.cyl(0.43, 0.42, 0.2, 8, { x, y: 1.86, z, color: O.wood });
        hideCone(b, x, z, 0.46, 0.55, 1.96, { seg: 8, ry: PI / 8, band: 0.28, poles: false });
        flagPole(b, x, 2.4, z, 0.5, { dir: -sx, w: 0.32, fh: 0.2, stripe: O.black });
        if (sz > 0) skull(b, x, 1.45, z + 0.41, 1.1, 0, { tusks: true });
      }
      // puerta principal entre dos torreones con colmillos
      for (const s of [-1, 1]) { b.cyl(0.2, 0.22, 1.25, 8, { x: s * 0.4, y: 0.78, z: C, color: O.woodL }); b.cone(0.2, 0.3, 8, { x: s * 0.4, y: 1.55, z: C, color: O.wood }); tusk(b, [s * 0.62, 0.16, C + 0.24], [s * 0.66, 0.7, C + 0.3], [s * 0.3, 1.18, C + 0.3], 0.06, O.bone); }
      b.cyl(0.08, 0.08, 1.05, 7, { y: 1.22, z: C + 0.05, rz: PI / 2, color: O.woodL });
      b.box(0.44, 0.8, 0.08, { y: 0.56, z: C, color: O.wood });
      for (let i = 0; i < 4; i++) b.cone(0.05, 0.12, 5, { x: -0.16 + i * 0.107, y: 1.02, z: C, color: O.woodL });
      b.box(0.46, 0.05, 0.1, { y: 0.4, z: C + 0.01, color: O.ironD }); b.box(0.46, 0.05, 0.1, { y: 0.75, z: C + 0.01, color: O.ironD });
      skull(b, 0, 1.36, C + 0.08, 1.8, 0, { horns: true, tusks: true });
      // torreón central: base de piedra, cuerpo de troncos y tejado de pieles
      frustum(b, 1.9, 1.7, 1.78, 1.58, 0.86, { y: 0.16, z: ZK, color: O.stone, jit: 0.01 });
      for (let i = 0; i < 5; i++) b.box(0.32, 0.12, 0.03, { x: -0.7 + i * 0.35, y: 0.3 + (i % 2) * 0.32, z: ZK + 0.84, color: shade(O.stone, -0.07) });
      b.box(1.5, 0.66, 1.3, { y: 1.35, z: ZK, color: O.woodD });
      for (let i = 0; i < 9; i++) { const x = -0.68 + i * 0.17; b.cyl(0.055, 0.06, 0.68, 6, { x, y: 1.36, z: ZK + 0.66, color: shade(O.wood, (r() - 0.5) * 0.1) }); }
      b.pyramid(1.92, 0.92, 1.72, { y: 1.68 + 0.46, z: ZK, color: O.hide });
      for (const t of [0.12, 0.42]) frustum(b, 1.92 * (1 - t) + 0.03, 1.72 * (1 - t) + 0.03, 1.92 * (0.86 - t) + 0.03, 1.72 * (0.86 - t) + 0.03, 0.92 * 0.14, { y: 1.68 + 0.92 * t, z: ZK, color: 'team' });
      b.cyl(0.035, 0.035, 0.5, 5, { y: 2.75, z: ZK, color: O.woodD });
      skull(b, 0, 2.65, ZK + 0.04, 1.2, 0, { horns: true });
      skull(b, 0, 1.4, ZK + 0.76, 2.4, 0, { horns: true, tusks: true });
      for (const s of [-1, 1]) banner(b, s * 0.55, 1.0, ZK + 0.87, 0.34, 0.55, { emblem: O.black, bar: true });
      b.box(0.44, 0.5, 0.05, { y: 0.41, z: ZK + 0.86, color: HOLE });
      for (const s of [-1, 1]) brazier(b, s * 0.85, ZK + 1.05, 0.4, { y0: 0.16 });
      // escudos en la muralla frontal y pinchos
      for (const x of [-1.0, -0.72, 0.72, 1.0]) oShield(b, x, 0.38, C + 0.23, 0.1, 0);
      for (const x of [-1.3, -0.9, 0.9, 1.3]) point(b, [x, 0.12, C + 0.25], [x, 0.3, C + 0.44], 0.03, 5, { color: O.iron });
    },
  },

  // ------------------------------------------------------------------ muro: pilar (centro de casilla) y tramo (x 0 → 0.5)
  orc_wall_post: {
    fp: 1,
    build(b) {
      const r = rng(151);
      b.cyl(0.3, 0.34, 0.16, 8, { y: 0.08, color: O.earth });
      b.cyl(0.18, 0.2, 0.9, 8, { y: 0.55, color: O.woodL });
      b.cone(0.18, 0.22, 8, { y: 1.11, color: O.wood });
      b.cyl(0.205, 0.205, 0.14, 8, { y: 0.8, color: 'team' });
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const h = 0.64 + r() * 0.1; stake(b, sx * 0.16, 0.12, sz * 0.16, h, 0.075, shade(O.wood, (r() - 0.5) * 0.1)); }
      b.torus(0.26, 0.024, 10, 4, { y: 0.46, rx: PI / 2, color: '#6b5236' });
      b.cyl(0.013, 0.013, 0.42, 5, { y: 1.38, color: O.woodD });
      b.box(0.2, 0.12, 0.02, { x: 0.105, y: 1.52, color: 'team', flag: (px) => Math.abs(px) * 4 });
      point(b, [0, 1.58, 0], [0, 1.66, 0], 0.02, 4, { color: O.iron });
    },
  },
  orc_wall_seg: {
    fp: 1,
    build(b) {
      frustum(b, 0.5, 0.44, 0.5, 0.3, 0.12, { x: 0.25, color: O.earth });
      [0.6, 0.64, 0.58, 0.62].forEach((h, i) => stake(b, 0.0625 + i * 0.125, 0.1, 0, h, 0.064, shade(O.wood, (i % 2 ? 0.04 : -0.03))));
      for (const z of [-0.075, 0.075]) for (const y of [0.32, 0.56]) b.box(0.5, 0.05, 0.04, { x: 0.25, y, z, color: O.woodD });
      b.box(0.5, 0.03, 0.045, { x: 0.25, y: 0.44, z: 0.08, color: O.red });
      point(b, [0.25, 0.22, 0.06], [0.25, 0.32, 0.26], 0.03, 5, { color: O.iron });
      point(b, [0.25, 0.22, -0.06], [0.25, 0.32, -0.26], 0.03, 5, { color: O.iron });
    },
  },
  // ==================================================================== GIGANTES
  // ------------------------------------------------------------------ casa (2×2): casa de piedra seca con tejado de tepe
  giant_house: {
    fp: 2, smoke: [[0.42, 1.66, -0.38]], fire: [[0, 1.1, 0], [-0.4, 0.7, 0.3], [0.4, 0.8, -0.3]],
    build(b) {
      const r = rng(201), ZH = -0.06;
      frustum(b, 1.76, 1.72, 1.64, 1.6, 0.1, { color: G.stoneD, jit: 0.01 });
      b.box(1.34, 0.62, 1.08, { y: 0.41, z: ZH, color: G.stone });
      blocks(b, 0, 0.1, ZH + 0.54, 1.34, 0.62, 2, 4, { seed: 3 });
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) menhir(b, sx * 0.69, ZH + sz * 0.55, 0.24, 0.66, 0.24, { y0: 0.08, color: sz > 0 ? G.stoneL : G.stoneM });
      turfRoof(b, 1.7, 0.6, 1.48, 0.72, { z: ZH });
      // chimenea de piedras apiladas
      frustum(b, 0.26, 0.26, 0.2, 0.2, 0.58, { x: 0.42, y: 1.02, z: -0.38, color: G.stoneM, jit: 0.015 });
      b.box(0.28, 0.05, 0.28, { x: 0.42, y: 1.6, z: -0.38, color: G.stoneD });
      // gran puerta de madera con dintel tallado
      b.box(0.36, 0.52, 0.05, { y: 0.36, z: ZH + 0.56, color: G.woodD });
      for (const x of [-0.07, 0.07]) b.box(0.016, 0.5, 0.055, { x, y: 0.36, z: ZH + 0.565, color: shade(G.woodD, -0.08) });
      for (const y of [0.24, 0.48]) b.box(0.38, 0.035, 0.06, { y, z: ZH + 0.57, color: G.iron });
      for (const s of [-1, 1]) b.box(0.1, 0.6, 0.1, { x: s * 0.24, y: 0.4, z: ZH + 0.58, color: G.wood });
      b.cyl(0.065, 0.065, 0.66, 6, { y: 0.68, z: ZH + 0.6, rz: PI / 2, color: G.woodL });
      rune(b, -0.1, 0.68, ZH + 0.66, 0, 0.7); rune(b, 0.1, 0.68, ZH + 0.66, 0, 0.7);
      for (const x of [-0.46, 0.46]) gShield(b, x, 0.42, ZH + 0.58, 0.12, 0, { ts: x < 0 ? 1 : 0.85 });
      // piedra rúnica, leña enorme, piel colgada, bandera
      menhir(b, 0.68, 0.7, 0.16, 0.5, 0.13, { y0: 0.08, color: G.stoneL }); rune(b, 0.68, 0.36, 0.77, 0, 0.8);
      shards(b, 0.55, 0.1, 0.74, 0.55, 7, 3);
      for (const [x, y] of [[-0.8, 0.17], [-0.8, 0.32]]) b.cyl(0.075, 0.075, 0.62, 6, { x, y, z: 0.05 + (y > 0.2 ? 0.04 : 0), rx: PI / 2, color: shade(G.woodL, y - 0.2) });
      b.cyl(0.075, 0.075, 0.62, 6, { x: -0.8, y: 0.17, z: 0.05, rx: PI / 2, ry: 0.05, color: G.wood });
      b.blob(0.16, 0.05, 0.22, 0, { x: -0.58, y: 0.13, z: 0.7, ry: 0.4, color: G.fur });
      flagPole(b, -0.66, 0.08, -0.66, 1.75, { pole: G.woodD, stripe: G.rune, glow: 0.6 });
    },
  },

  // ------------------------------------------------------------------ centro urbano (4×4): gran salón megalítico
  giant_tc: {
    fp: 4, smoke: [[0.7, 2.42, -0.65]], fire: [[0, 1.6, -0.3], [-1.0, 1.2, -0.4], [1.0, 1.3, 0.0], [0.3, 0.9, 0.9]],
    build(b) {
      const r = rng(211), ZH = -0.35;
      frustum(b, 3.66, 3.56, 3.5, 3.4, 0.16, { z: 0.02, color: G.stoneD, jit: 0.01 });
      b.box(1.2, 0.08, 0.62, { y: 0.2, z: 0.88, color: G.stoneM });
      b.box(2.5, 0.86, 1.7, { y: 0.59, z: ZH, color: G.stone });
      blocks(b, 0, 0.16, ZH + 0.85, 2.5, 0.86, 2, 6, { seed: 5 });
      for (const x of [-1.25, -0.72, 0.72, 1.25]) menhir(b, x, ZH + 0.92, 0.3, 0.86, 0.28, { y0: 0.14, color: G.stoneL, taper: 0.88 });
      for (const x of [-1.25, 1.25]) menhir(b, x, ZH - 0.86, 0.3, 0.86, 0.28, { y0: 0.14, color: G.stoneM, taper: 0.88 });
      turfRoof(b, 2.95, 1.0, 2.34, 1.0, { z: ZH, seed: 4 });
      for (const e of [-1, 1]) flagPole(b, e * 1.47, 2.08, ZH, 0.62, { dir: -e, w: 0.42, fh: 0.26, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      frustum(b, 0.34, 0.34, 0.28, 0.28, 0.8, { x: 0.7, y: 1.56, z: -0.65, color: G.stoneM, jit: 0.02 });
      b.box(0.38, 0.06, 0.38, { x: 0.7, y: 2.36, z: -0.65, color: G.stoneD });
      // puerta doble de madera
      b.box(0.74, 0.72, 0.05, { y: 0.6, z: ZH + 0.87, color: G.woodD });
      for (const x of [-0.18, 0, 0.18]) b.box(0.018, 0.7, 0.056, { x, y: 0.6, z: ZH + 0.875, color: shade(G.woodD, -0.08) });
      for (const y of [0.4, 0.8]) b.box(0.76, 0.04, 0.06, { y, z: ZH + 0.88, color: G.iron });
      // trilito del pórtico con runas, cristal flotante y estandartes
      const PZ = 0.95;
      for (const s of [-1, 1]) { menhir(b, s * 0.52, PZ, 0.3, 1.26, 0.3, { y0: 0.22, color: G.stoneL, taper: 0.85 }); rune(b, s * 0.52, 0.85, PZ + 0.15, 0, 1.1); }
      frustum(b, 1.44, 0.4, 1.36, 0.34, 0.26, { y: 1.47, z: PZ, color: G.stone, jit: 0.02, seed: 8 });
      for (const x of [-0.3, 0, 0.3]) rune(b, x, 1.6, PZ + 0.19, 0, 0.8);
      crystal(b, 0, 1.92, PZ, 1.5, { spin: { c: [0, 1.95, PZ], axis: [0, 1, 0], speed: 0.8 } });
      for (const s of [-1, 1]) banner(b, s * 0.22, 1.46, PZ + 0.21, 0.24, 0.5, { bar: false, emblem: G.rune, glow: 0.7 });
      for (const s of [-1, 1]) iceBrazier(b, s * 0.95, 1.2, 0.36, 0.16);
      // escudos en la fachada
      for (const x of [-1.0, -0.48, 0.48, 1.0]) gShield(b, x, 0.66, ZH + 0.9, 0.14, 0, { ts: Math.abs(x) > 0.7 ? 0.85 : 1 });
      // piedras rúnicas en las esquinas delanteras
      for (const s of [-1, 1]) { menhir(b, s * 1.5, 1.42, 0.24, 0.9, 0.2, { y0: 0.14, color: G.stoneL }); rune(b, s * 1.5, 0.62, 1.52, 0, 1.0); shards(b, s * 1.3, 0.16, 1.55, 0.6, 11 + s, 3); }
      // leña de troncos enormes y bastidor con pieles
      for (const [y, z] of [[0.27, -0.55], [0.27, -0.3], [0.47, -0.42]]) b.cyl(0.1, 0.1, 0.95, 6, { x: -1.62, y, z, rx: PI / 2, color: shade(G.woodL, y - 0.35) });
      const FX = 1.6;
      for (const z of [-0.6, 0.0]) b.cyl(0.04, 0.05, 0.86, 6, { x: FX, y: 0.59, z, color: G.woodD });
      b.cyl(0.035, 0.035, 0.72, 6, { x: FX, y: 1.0, z: -0.3, rx: PI / 2, color: G.wood });
      b.box(0.04, 0.5, 0.26, { x: FX + 0.02, y: 0.72, z: -0.45, color: G.fur, flag: (px, py) => Math.max(0, 0.98 - py) * 0.8 });
      b.box(0.04, 0.44, 0.24, { x: FX + 0.02, y: 0.75, z: -0.14, color: G.furB, flag: (px, py) => Math.max(0, 0.98 - py) * 0.8 });
    },
  },

  // ------------------------------------------------------------------ cuartel (3×3): casa larga y círculo de entrenamiento
  giant_barracks: {
    fp: 3, fire: [[0, 1.3, -0.6], [-0.7, 0.9, -0.6], [0.7, 0.9, -0.6]],
    build(b) {
      const r = rng(221), ZH = -0.62;
      frustum(b, 2.76, 2.76, 2.64, 2.64, 0.12, { color: G.stoneD, jit: 0.01 });
      b.box(2.1, 0.64, 1.06, { y: 0.44, z: ZH, color: G.stone });
      blocks(b, 0, 0.12, ZH + 0.53, 2.1, 0.64, 2, 5, { seed: 7 });
      for (const s of [-1, 1]) menhir(b, s * 1.06, ZH + 0.55, 0.26, 0.66, 0.26, { y0: 0.1, color: G.stoneL });
      turfRoof(b, 2.42, 0.78, 1.42, 0.76, { z: ZH, seed: 9 });
      b.box(0.44, 0.56, 0.05, { y: 0.4, z: ZH + 0.555, color: G.woodD });
      for (const y of [0.28, 0.56]) b.box(0.46, 0.035, 0.06, { y, z: ZH + 0.565, color: G.iron });
      frustum(b, 0.64, 0.16, 0.6, 0.14, 0.12, { y: 0.68, z: ZH + 0.58, color: G.stoneL, jit: 0.01 });
      rune(b, 0, 0.74, ZH + 0.66, 0, 0.7);
      for (const x of [-0.65, 0.65]) gShield(b, x, 0.46, ZH + 0.57, 0.14, 0, { ts: x < 0 ? 1 : 0.85 });
      // círculo de entrenamiento de piedras
      const CX = 0.1, CZ = 0.58;
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.2; menhir(b, CX + Math.sin(a) * 0.5, CZ + Math.cos(a) * 0.42, 0.13, 0.22 + (i % 3) * 0.05, 0.12, { y0: 0.1, ry: a, color: i % 2 ? G.stoneM : G.stoneL }); }
      b.cyl(0.36, 0.38, 0.02, 10, { x: CX, y: 0.12, z: CZ, sz: 0.84, color: G.earth });
      // armero con mazas de piedra y un hacha enorme
      const RX = -0.98, RZ = 0.38;
      for (const s of [-1, 1]) b.cyl(0.04, 0.05, 0.7, 6, { x: RX, y: 0.47, z: RZ + s * 0.34, color: G.woodD });
      b.cyl(0.035, 0.035, 0.8, 6, { x: RX, y: 0.78, z: RZ, rx: PI / 2, color: G.wood });
      for (let i = 0; i < 3; i++) { const z = RZ - 0.2 + i * 0.2; beam(b, [RX + 0.12, 0.12, z], [RX - 0.02, 0.86, z], 0.022, 0.026, 5, { color: G.woodL }); b.blob(0.075, 0.1, 0.075, 0, { x: RX - 0.03, y: 0.92, z, color: G.stoneM }); }
      beam(b, [RX + 0.22, 0.12, RZ + 0.42], [RX + 0.12, 0.95, RZ + 0.36], 0.022, 0.022, 5, { color: G.woodL });
      b.box(0.03, 0.2, 0.18, { x: RX + 0.13, y: 0.86, z: RZ + 0.43, color: G.iron });
      // piedras para levantar y poste de entrenamiento con piel
      for (const [x, z, s] of [[0.98, 0.22, 0.16], [1.12, 0.48, 0.12], [0.88, 0.5, 0.1]]) rock(b, x, 0.12 + s * 0.7, z, s, s * 0.85, s, G.stoneM, Math.round(x * 50));
      b.cyl(0.11, 0.13, 0.8, 7, { x: 1.0, y: 0.52, z: 1.0, color: G.wood });
      b.cyl(0.14, 0.14, 0.34, 7, { x: 1.0, y: 0.56, z: 1.0, color: G.fur });
      b.box(0.3, 0.04, 0.03, { x: 1.0, y: 0.6, z: 1.14, rz: 0.4, color: G.furB });
      // estandarte con cristal
      flagPole(b, -1.2, 0.12, 1.15, 1.7, { w: 0.42, fh: 0.27, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      crystal(b, -1.2, 1.9, 1.15, 0.7);
      iceBrazier(b, 0.55, 1.18, 0.3, 0.12);
    },
  },

  // ------------------------------------------------------------------ molino (2×2): casa de piedra y gran rueda de andar (gira)
  giant_mill: {
    fp: 2, fire: [[-0.36, 1.0, -0.3], [0.5, 0.7, 0]],
    build(b) {
      const r = rng(231), C = [0.38, 0.62, 0.36], sp = { c: C, axis: [0, 0, 1], speed: 0.9 }, R = 0.44;
      frustum(b, 1.76, 1.76, 1.66, 1.66, 0.1, { color: G.stoneD, jit: 0.01 });
      b.box(0.8, 0.62, 0.86, { x: -0.36, y: 0.41, z: -0.3, color: G.stone });
      blocks(b, -0.36, 0.1, 0.13, 0.8, 0.62, 2, 3, { seed: 13 });
      turfRoof(b, 0.94, 0.5, 1.04, 0.72, { x: -0.36, z: -0.28, seed: 3, tufts: 3 });
      b.box(0.26, 0.42, 0.05, { x: -0.48, y: 0.31, z: 0.15, color: G.woodD });
      b.box(0.34, 0.08, 0.1, { x: -0.48, y: 0.56, z: 0.16, color: G.stoneL });
      rune(b, -0.2, 0.46, 0.155, 0, 0.7);
      shards(b, -0.76, 0.1, 0.13, 0.5, 4, 3);
      // soportes y eje (la rueda mira a la cámara)
      for (const z of [C[2] - 0.27, C[2] + 0.27]) for (const s of [-1, 1]) beam(b, [C[0] + s * 0.3, 0.08, z], [C[0], C[1] + 0.04, z], 0.035, 0.03, 5, { color: G.woodD });
      b.cyl(0.035, 0.035, 0.66, 6, { x: C[0], y: C[1], z: C[2], rx: PI / 2, color: G.iron });
      // rueda de andar: dos aros, radios, travesaños (mitad del color de equipo)
      for (const z of [C[2] - 0.19, C[2] + 0.19]) {
        b.torus(R, 0.032, 14, 4, { x: C[0], y: C[1], z, color: G.wood, spin: sp });
        for (const a of [0, PI / 2]) b.box(0.04, R * 2, 0.035, { x: C[0], y: C[1], z, rz: a + PI / 4, color: G.woodD, spin: sp });
      }
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; b.box(0.11, 0.035, 0.4, { x: C[0] + Math.sin(a) * R, y: C[1] + Math.cos(a) * R, z: C[2], rz: -a, color: i % 2 ? 'team' : G.woodL, spin: sp }); }
      b.cyl(0.07, 0.07, 0.4, 7, { x: C[0], y: C[1], z: C[2], rx: PI / 2, color: G.stoneL, spin: sp });
      // muelas y sacos
      b.cyl(0.24, 0.26, 0.1, 9, { x: -0.36, y: 0.15, z: 0.52, color: G.stoneM });
      b.cyl(0.22, 0.22, 0.09, 9, { x: -0.36, y: 0.245, z: 0.52, ry: 0.3, color: G.stoneL });
      b.cyl(0.05, 0.05, 0.1, 6, { x: -0.36, y: 0.26, z: 0.52, color: G.woodD });
      for (const [x, z, c] of [[0.42, -0.42, G.hay], [0.6, -0.28, G.fur], [0.45, -0.2, G.hay]]) b.blob(0.1, 0.12, 0.09, 0, { x, y: 0.2, z, color: c });
      flagPole(b, 0.7, 0.08, -0.7, 1.6, { dir: -1, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      gShield(b, -0.08, 0.42, -0.1, 0.12, PI / 2);
    },
  },

  // ------------------------------------------------------------------ aserradero (2×2): troncos colosales y hacha gigante
  giant_lumber: {
    fp: 2, fire: [[0, 0.9, -0.4], [-0.4, 0.5, 0.4]],
    build(b) {
      const r = rng(241);
      frustum(b, 1.76, 1.76, 1.66, 1.66, 0.08, { color: G.earth });
      for (const [x, z, h] of [[-0.74, -0.74, 1.02], [0.74, -0.74, 1.02], [-0.74, -0.06, 0.82], [0.74, -0.06, 0.82]]) b.cyl(0.065, 0.08, h, 6, { x, y: 0.08 + h / 2, z, color: G.wood });
      b.box(1.7, 0.05, 0.92, { y: 1.0, z: -0.4, rx: 0.245, color: G.woodD });
      b.box(1.64, 0.07, 0.86, { y: 1.06, z: -0.41, rx: 0.245, color: G.turf });
      b.box(1.66, 0.03, 0.2, { y: 1.0, z: -0.04, rx: 0.245, color: 'team' });
      for (let i = 0; i < 4; i++) b.cone(0.05, 0.11, 4, { x: -0.6 + i * 0.4 + r() * 0.1, y: 1.13, z: -0.4 + (r() - 0.5) * 0.3, color: G.turfL });
      b.cyl(0.05, 0.05, 1.6, 6, { y: 0.88, z: -0.06, rz: PI / 2, color: G.woodL });
      // troncos colosales con testas
      for (const [y, z] of [[0.22, -0.56], [0.22, -0.28], [0.46, -0.42]]) { b.cyl(0.135, 0.135, 1.28, 7, { x: -0.02, y, z, rz: PI / 2, color: shade(G.wood, (r() - 0.5) * 0.1) }); b.cyl(0.115, 0.115, 0.02, 7, { x: 0.63, y, z, rz: PI / 2, color: '#d8b886' }); }
      // tocón gigante con hacha clavada
      b.cyl(0.21, 0.24, 0.3, 8, { x: -0.38, y: 0.23, z: 0.45, color: G.wood });
      b.cyl(0.2, 0.2, 0.02, 8, { x: -0.38, y: 0.385, z: 0.45, color: '#d8b886' });
      beam(b, [-0.36, 0.38, 0.45], [-0.12, 0.92, 0.55], 0.03, 0.026, 6, { color: G.woodL });
      b.box(0.24, 0.16, 0.035, { x: -0.38, y: 0.44, z: 0.45, rz: -0.42, color: G.stoneM });
      b.box(0.04, 0.17, 0.04, { x: -0.48, y: 0.48, z: 0.45, rz: -0.42, color: G.ice, glow: 0.5 });
      // caballete con tronco a medio partir y cuñas
      for (const x of [0.12, 0.7]) for (const s of [-1, 1]) beam(b, [x, 0.08, 0.5 + s * 0.14], [x, 0.36, 0.5 - s * 0.04], 0.025, 0.025, 4, { color: G.woodD });
      b.cyl(0.11, 0.11, 0.8, 7, { x: 0.41, y: 0.42, z: 0.48, rz: PI / 2, color: G.woodL });
      b.box(0.04, 0.1, 0.06, { x: 0.3, y: 0.55, z: 0.48, color: G.iron });
      for (let i = 0; i < 6; i++) b.box(0.08, 0.025, 0.04, { x: -0.1 + r() * 0.8, y: 0.09, z: 0.2 + r() * 0.6, ry: r() * 3, color: '#d8b886' });
      b.torus(0.1, 0.03, 8, 4, { x: 0.05, y: 0.11, z: 0.68, rx: PI / 2, color: G.rope });
      flagPole(b, -0.8, 0.08, -0.82, 1.62, { pole: G.woodD, stripe: G.rune, glow: 0.6 });
      gShield(b, -0.74, 0.55, 0.04, 0.12, 0); gShield(b, 0.74, 0.55, 0.04, 0.12, 0, { ts: 0.85 });
    },
  },

  // ------------------------------------------------------------------ campamento minero (2×2): trilito en la colina y cristales
  giant_mine: {
    fp: 2, fire: [[0, 0.8, -0.3], [0.5, 0.4, 0.5]],
    build(b) {
      const GOLD = '#e6c04a';
      frustum(b, 1.76, 1.76, 1.66, 1.66, 0.08, { color: G.earth });
      b.blob(0.74, 0.6, 0.44, 1, { y: 0.08, z: -0.42, color: G.stoneD });
      b.blob(0.58, 0.24, 0.34, 1, { y: 0.52, z: -0.5, color: G.turf });
      b.blob(0.36, 0.36, 0.32, 0, { x: -0.52, y: 0.12, z: -0.32, ry: 0.5, color: G.stoneM });
      b.blob(0.34, 0.32, 0.3, 0, { x: 0.54, y: 0.1, z: -0.36, ry: 1.2, color: G.stone });
      shards(b, -0.48, 0.32, -0.2, 0.9, 21, 4); shards(b, 0.52, 0.26, -0.18, 0.8, 22, 3);
      // trilito de entrada
      b.box(0.38, 0.56, 0.16, { y: 0.36, z: 0.0, color: HOLE });
      for (const s of [-1, 1]) menhir(b, s * 0.27, 0.1, 0.17, 0.64, 0.2, { y0: 0.06, color: G.stoneL, taper: 0.88 });
      frustum(b, 0.8, 0.26, 0.74, 0.22, 0.17, { y: 0.69, z: 0.1, color: G.stone, jit: 0.015, seed: 3 });
      rune(b, -0.12, 0.78, 0.22, 0, 0.6); rune(b, 0.12, 0.78, 0.22, 0, 0.6);
      b.box(0.72, 0.03, 0.2, { y: 0.87, z: 0.1, color: 'team' });
      banner(b, 0, 0.69, 0.24, 0.22, 0.22, { bar: false, k: 2 });
      // trineo sobre rodillos con sillares y mineral
      for (const z of [0.4, 0.56, 0.72]) b.cyl(0.04, 0.04, 0.52, 6, { y: 0.12, z, rz: PI / 2, color: G.woodL });
      b.box(0.5, 0.05, 0.46, { y: 0.185, z: 0.56, color: G.wood });
      for (const s of [-1, 1]) b.box(0.05, 0.06, 0.5, { x: s * 0.22, y: 0.2, z: 0.56, color: G.woodD });
      b.box(0.2, 0.15, 0.16, { x: -0.1, y: 0.285, z: 0.52, ry: 0.1, color: G.stoneL });
      b.box(0.16, 0.12, 0.14, { x: 0.12, y: 0.27, z: 0.64, ry: -0.2, color: G.stone });
      b.ball(0.07, 0, { x: 0.1, y: 0.28, z: 0.45, color: GOLD, glow: 0.3 });
      crystal(b, -0.08, 0.42, 0.52, 0.5);
      b.box(0.24, 0.035, 0.36, { x: 0.12, y: 0.35, z: 0.56, rz: -0.12, color: 'team' });
      // martillo gigante apoyado, farol de cristal y montón de mineral
      beam(b, [-0.5, 0.08, 0.28], [-0.4, 0.62, 0.12], 0.025, 0.025, 5, { color: G.woodL });
      b.box(0.12, 0.12, 0.2, { x: -0.4, y: 0.64, z: 0.12, rx: -0.3, color: G.stoneM });
      b.cyl(0.03, 0.035, 0.6, 5, { x: 0.45, y: 0.38, z: 0.25, color: G.woodD });
      crystal(b, 0.45, 0.74, 0.25, 0.6);
      for (const [x, z, s, c] of [[-0.6, 0.6, 0.1, GOLD], [-0.72, 0.44, 0.09, G.stoneM], [-0.5, 0.45, 0.07, GOLD], [-0.66, 0.72, 0.08, G.stoneL]]) b.ball(s, 0, { x, y: 0.08 + s * 0.6, z, color: c, glow: c === GOLD ? 0.3 : 0 });
      flagPole(b, 0.2, 0.55, -0.48, 0.95, { pole: G.woodD, stripe: G.rune, glow: 0.6 });
      gShield(b, 0.62, 0.3, 0.5, 0.12, -0.4);
      gShield(b, 0.68, 0.25, 0.25, 0.11, -0.9, { ts: 0.85 });
    },
  },

  // ------------------------------------------------------------------ granja (3×3, plana): 0 tierra y murete; 1-3 trigo gigante
  giant_farm: {
    fp: 3,
    build(b) {
      const r = rng(251), xs = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0], zs = [-0.96, -0.48, 0, 0.48, 0.96];
      b.box(2.8, 0.04, 2.8, { y: 0.02, color: G.soil });
      for (const x of xs) b.box(0.26, 0.035, 2.45, { x, y: 0.05, color: G.soilD });
      // murete de piedra seca con remate pintado
      const E = 1.24, wall = (x, z, len, alongX) => {
        b.box(alongX ? len : 0.18, 0.14, alongX ? 0.18 : len, { x, y: 0.11, z, color: G.stoneM });
        b.box(alongX ? len : 0.1, 0.03, alongX ? 0.1 : len, { x, y: 0.195, z, color: 'team' });
        const n = Math.round(len / 0.45); for (let i = 0; i < n; i++) { const t = -len / 2 + (i + 0.5) * len / n; rock(b, alongX ? x + t : x + (r() - 0.5) * 0.06, 0.06, alongX ? z + (r() - 0.5) * 0.06 : z + t, 0.08, 0.06, 0.08, shade(G.stone, (r() - 0.5) * 0.1), i + Math.round(len * 10)); }
      };
      wall(0, -E, 2.34, true); wall(-E, 0, 2.34, false); wall(E, 0, 2.34, false);
      for (const s of [-1, 1]) wall(s * 0.83, E, 0.66, true);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) menhir(b, sx * E, sz * E, 0.22, 0.42, 0.22, { y0: 0.02, color: G.stoneL });
      for (const s of [-1, 1]) rune(b, s * E, 0.24, E + 0.1, 0, 0.7);
      flagPole(b, E, 0.44, -E, 0.75, { dir: -1, w: 0.32, fh: 0.2, pole: G.woodD });
      b.cyl(0.1, 0.06, 0.32, 6, { x: -1.08, y: 0.2, z: 1.06, color: G.hay });
      // cultivo: brotes, trigo verde, trigo dorado gigante
      const sway = (x, y) => Math.max(0, y - 0.05) * 1.3;
      b.part = 1; for (const x of xs) for (const z of zs) { const j = (r() - 0.5) * 0.06; b.cone(0.07, 0.12, 4, { x: x + j, y: 0.12, z: z + j, ry: r() * 2, color: shade('#86b850', (r() - 0.5) * 0.08) }); b.cone(0.045, 0.09, 4, { x: x + 0.07 + j, y: 0.1, z: z - 0.06, ry: r() * 2, color: '#9cc85e' }); }
      b.part = 2; for (const x of xs) for (const z of zs) { const h = 0.3 + r() * 0.08; b.cyl(0.1, 0.035, h, 5, { x: x + (r() - 0.5) * 0.05, y: 0.065 + h / 2, z: z + (r() - 0.5) * 0.06, ry: r() * 2, color: shade('#62a040', (r() - 0.5) * 0.1), wave: sway }); }
      b.part = 3; for (const x of xs) for (const z of zs) { const h = 0.42 + r() * 0.1, xx = x + (r() - 0.5) * 0.05, zz = z + (r() - 0.5) * 0.06; b.cyl(0.12, 0.04, h, 6, { x: xx, y: 0.065 + h / 2, z: zz, ry: r() * 2, color: shade('#d9b64c', (r() - 0.5) * 0.1), wave: sway }); b.cyl(0.125, 0.12, 0.08, 6, { x: xx, y: 0.03 + h, z: zz, ry: r() * 2, color: '#e8c862', wave: sway }); }
    },
  },

  // ------------------------------------------------------------------ galería (3×3): campo de lanzamiento de rocas y jabalinas
  giant_range: {
    fp: 3, fire: [[0.8, 1.0, 0.75], [-0.8, 0.6, -0.9]],
    build(b) {
      const r = rng(261);
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: G.earth });
      // dianas: grandes rodelas de madera con anillos y jabalinas clavadas
      for (const x of [-0.85, 0.0, 0.85]) {
        const y = 0.56, z = -0.98;
        for (const s of [-1, 1]) b.cyl(0.05, 0.06, 0.6, 6, { x: x + s * 0.2, y: 0.38, z: z - 0.06, color: G.woodD });
        b.cyl(0.3, 0.3, 0.1, 10, { x, y, z, rx: PI / 2, color: G.woodL });
        b.cyl(0.22, 0.22, 0.11, 10, { x, y, z, rx: PI / 2, color: 'team' });
        b.cyl(0.13, 0.13, 0.12, 10, { x, y, z, rx: PI / 2, color: G.fur });
        b.cyl(0.05, 0.05, 0.13, 8, { x, y, z, rx: PI / 2, color: G.rune, glow: 0.6 });
        const ax = x + (r() - 0.5) * 0.25, ay = y + (r() - 0.5) * 0.2;
        beam(b, [ax, ay, z + 0.04], [ax + 0.05, ay + 0.12, z + 0.62], 0.016, 0.014, 5, { color: G.woodL });
      }
      // mojón de piedras como diana y línea de tiro de piedras
      for (const [y, s] of [[0.16, 0.16], [0.36, 0.12], [0.52, 0.09]]) rock(b, 1.18, y, -0.42, s, s * 0.8, s, G.stoneM, Math.round(y * 100));
      crystal(b, 1.18, 0.68, -0.42, 0.6);
      for (let i = 0; i < 5; i++) { const h = 0.2 + (i % 2) * 0.06; menhir(b, -1.05 + i * 0.36, 0.2, 0.13, h, 0.12, { y0: 0.06, color: G.stoneL, jit: 0.005 }); b.box(0.13, 0.04, 0.12, { x: -1.05 + i * 0.36, y: 0.06 + h, z: 0.2, color: 'team' }); }
      // munición: montón de rocas redondas
      for (const [x, z, s] of [[-0.95, 0.75, 0.15], [-0.7, 0.85, 0.13], [-0.85, 1.05, 0.12], [-0.82, 0.86, 0.11]]) rock(b, x, 0.08 + s * 0.8 + (s < 0.12 ? 0.12 : 0), z, s, s * 0.9, s, shade(G.stone, (r() - 0.5) * 0.1), Math.round(x * 30 + z * 7));
      // cobertizo de tepe con armero de jabalinas
      const PX = 0.78, PZ = 0.78;
      for (const [x, z, h] of [[-0.42, -0.32, 1.1], [0.42, -0.32, 1.1], [-0.42, 0.32, 0.9], [0.42, 0.32, 0.9]]) b.cyl(0.05, 0.06, h, 6, { x: PX + x, y: 0.08 + h / 2, z: PZ + z, color: G.wood });
      b.box(1.0, 0.05, 0.86, { x: PX, y: 1.08, z: PZ, rx: 0.24, color: G.woodD });
      b.box(0.96, 0.07, 0.82, { x: PX, y: 1.14, z: PZ - 0.01, rx: 0.24, color: G.turf });
      b.box(0.96, 0.03, 0.24, { x: PX, y: 1.09, z: PZ + 0.3, rx: 0.24, color: 'team' });
      b.cyl(0.035, 0.035, 0.84, 5, { x: PX, y: 0.62, z: PZ - 0.3, rz: PI / 2, color: G.woodD });
      for (let i = 0; i < 4; i++) { const x = PX - 0.3 + i * 0.2; beam(b, [x, 0.08, PZ - 0.18], [x - 0.02, 1.0, PZ - 0.34], 0.018, 0.014, 5, { color: G.woodL }); point(b, [x - 0.02, 1.0, PZ - 0.34], [x - 0.025, 1.1, PZ - 0.36], 0.03, 4, { color: G.stoneL }); }
      gShield(b, PX + 0.42, 0.55, PZ + 0.36, 0.12, 0);
      // estandarte y brasero de hielo
      flagPole(b, -1.22, 0.08, 1.2, 1.65, { w: 0.42, fh: 0.27, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      iceBrazier(b, -0.2, 0.85, 0.32, 0.08);
    },
  },

  // ------------------------------------------------------------------ establo (3×3): corral de mamuts
  giant_stable: {
    fp: 3, fire: [[0, 1.2, -0.8], [-0.8, 0.9, -0.8]],
    build(b) {
      const r = rng(271);
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: G.earth });
      // cobertizo abierto: muro trasero de piedra, postes y tejado de tepe
      b.box(2.3, 0.9, 0.22, { y: 0.53, z: -1.12, color: G.stone });
      blocks(b, 0, 0.08, -1.0, 2.3, 0.9, 2, 5, { seed: 17 });
      for (const x of [-1.1, -0.37, 0.37, 1.1]) b.cyl(0.07, 0.085, 0.92, 7, { x, y: 0.54, z: -0.46, color: G.wood });
      turfRoof(b, 2.5, 0.55, 1.06, 0.98, { z: -0.8, seed: 12 });
      for (const [x, z, s] of [[-0.7, -0.78, 1], [-0.3, -0.85, 0.85], [0.7, -0.8, 0.9]]) b.blob(0.3 * s, 0.2 * s, 0.22 * s, 0, { x, y: 0.12, z, color: G.hay });
      // cercado de troncos enormes con puerta
      const post = (x, z, h = 0.58) => b.cyl(0.065, 0.075, h, 6, { x, y: 0.08 + h / 2, z, color: G.woodD });
      const rail = (a, c) => { for (const y of [0.28, 0.5]) beam(b, [a[0], y, a[1]], [c[0], y, c[1]], 0.045, 0.045, 6, { color: shade(G.wood, y - 0.4) }); };
      for (const e of [-1, 1]) { for (const z of [-0.4, 0.3, 1.3]) post(e * 1.3, z); rail([e * 1.3, -0.4], [e * 1.3, 1.3]); post(e * 0.86, 1.3); rail([e * 1.3, 1.3], [e * 0.42, 1.3]); }
      for (const e of [-1, 1]) { b.cyl(0.08, 0.09, 0.95, 7, { x: e * 0.42, y: 0.555, z: 1.3, color: G.wood }); }
      crystal(b, -0.42, 1.1, 1.3, 0.75);
      flagPole(b, 0.42, 1.03, 1.3, 0.55, { dir: 1, w: 0.32, fh: 0.2, pole: G.woodD });
      // mamut
      mammoth(b, 0.05, 0.28, -0.45, 0.08, 1.0);
      // abrevadero de piedra y heno
      b.box(0.5, 0.16, 0.24, { x: 0.82, y: 0.16, z: 0.85, ry: 0.2, color: G.stoneM }); b.box(0.42, 0.02, 0.16, { x: 0.82, y: 0.235, z: 0.85, ry: 0.2, color: '#6fa0b4' });
      b.blob(0.22, 0.12, 0.18, 0, { x: -0.62, y: 0.14, z: 0.82, color: G.hay });
      gShield(b, -0.8, 0.6, -0.99, 0.13, 0); gShield(b, 0.8, 0.6, -0.99, 0.13, 0, { ts: 0.85 });
      rune(b, 0, 0.62, -0.99, 0, 1.0);
    },
  },

  // ------------------------------------------------------------------ templo (3×3): círculo de trilitos y cristal flotante
  giant_temple: {
    fp: 3, smoke: [], fire: [[0, 1.0, 0], [-0.7, 0.9, -0.5], [0.7, 0.9, -0.5]],
    build(b) {
      const r = rng(281);
      b.cyl(1.3, 1.36, 0.12, 12, { y: 0.06, color: G.stoneD });
      b.cyl(1.1, 1.16, 0.1, 12, { y: 0.17, color: G.stone });
      b.box(0.7, 0.06, 0.24, { y: 0.15, z: 1.18, color: G.stoneM });
      b.torus(0.62, 0.05, 20, 3, { y: 0.225, rx: PI / 2, sz: 0.3, color: 'team' });
      // trilitos en anillo (abierto hacia el frente)
      for (let i = 0; i < 5; i++) {
        const a = PI / 5 + i * TAU / 5, cx = Math.sin(a) * 0.9, cz = Math.cos(a) * 0.9, tx = Math.cos(a), tz = -Math.sin(a);
        for (const s of [-1, 1]) menhir(b, cx + tx * s * 0.21, cz + tz * s * 0.21, 0.18, 1.04, 0.22, { y0: 0.2, ry: a, color: s > 0 ? G.stoneL : G.stone, taper: 0.86 });
        frustum(b, 0.64, 0.24, 0.6, 0.2, 0.15, { x: cx, y: 1.22, z: cz, ry: a, color: G.stoneM, jit: 0.015, seed: i + 30 });
        b.box(0.5, 0.03, 0.08, { x: cx, y: 1.385, z: cz, ry: a, color: 'team' });
        rune(b, cx - Math.sin(a) * 0.1 + tx * 0.21, 0.66, cz - Math.cos(a) * 0.1 + tz * 0.21, a + PI, 1.0);
        if (i === 0 || i === 4) banner(b, cx + Math.sin(a) * 0.12, 1.2, cz + Math.cos(a) * 0.12, 0.26, 0.5, { ry: a, bar: false, emblem: G.rune, glow: 0.7 });
      }
      // altar y gran cristal flotante con esquirlas en órbita
      frustum(b, 0.6, 0.44, 0.52, 0.38, 0.32, { y: 0.22, color: G.stoneM, jit: 0.02 });
      rune(b, 0, 0.38, 0.22, 0, 0.9);
      const C = [0, 1.02, 0];
      crystal(b, 0, 1.0, 0, 2.2, { spin: { c: C, axis: [0, 1, 0], speed: 0.7 } });
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; crystal(b, Math.sin(a) * 0.34, 0.96 + i * 0.06, Math.cos(a) * 0.34, 0.45, { spin: { c: C, axis: [0, 1, 0], speed: -1.2 } }); }
      for (const s of [-1, 1]) iceBrazier(b, s * 0.48, 0.78, 0.3, 0.22);
      for (const [x, z] of [[-1.08, 0.5], [1.08, 0.5], [0, -1.2]]) menhir(b, x, z, 0.14, 0.32, 0.12, { y0: 0.1, color: G.stoneM });
      flagPole(b, 0, 1.36, -0.92, 0.62, { w: 0.36, fh: 0.22, pole: G.woodD, stripe: G.rune, glow: 0.6 });
    },
  },

  // ------------------------------------------------------------------ herrería (2×2): horno megalítico y yunque de piedra
  giant_forge: {
    fp: 2, smoke: [[-0.44, 1.66, -0.46]], fire: [[-0.42, 0.9, -0.42], [0.45, 0.9, -0.3]],
    build(b) {
      const r = rng(291);
      frustum(b, 1.76, 1.76, 1.66, 1.66, 0.1, { color: G.stoneD, jit: 0.01 });
      // horno y chimenea de bloques
      frustum(b, 0.8, 0.76, 0.66, 0.6, 0.52, { x: -0.42, y: 0.08, z: -0.42, color: G.stoneM, jit: 0.02 });
      b.blob(0.34, 0.2, 0.3, 0, { x: -0.42, y: 0.6, z: -0.42, color: G.stone });
      b.box(0.26, 0.2, 0.05, { x: -0.38, y: 0.27, z: -0.05, color: FIRE, glow: 1 });
      frustum(b, 0.36, 0.06, 0.34, 0.06, 0.08, { x: -0.38, y: 0.38, z: -0.06, color: G.stoneL });
      frustum(b, 0.36, 0.36, 0.32, 0.32, 0.45, { x: -0.44, y: 0.7, z: -0.46, color: G.stone, jit: 0.02, seed: 2 });
      frustum(b, 0.32, 0.32, 0.28, 0.28, 0.45, { x: -0.44, y: 1.14, z: -0.46, ry: 0.3, color: G.stoneM, jit: 0.02, seed: 3 });
      b.box(0.36, 0.06, 0.36, { x: -0.44, y: 1.6, z: -0.46, color: G.stoneD });
      rune(b, -0.6, 0.3, -0.03, 0, 0.7);
      // fuelle de piel
      b.wedge(0.28, 0.14, 0.2, { x: -0.02, y: 0.16, z: -0.34, ry: PI / 2, color: G.fur });
      b.box(0.26, 0.06, 0.22, { x: -0.02, y: 0.13, z: -0.34, ry: PI / 2, color: G.woodD });
      // cobertizo de tepe a la derecha
      for (const [x, z, h] of [[0.14, 0.04, 0.82], [0.8, 0.04, 0.82], [0.14, -0.8, 1.02], [0.8, -0.8, 1.02]]) b.cyl(0.05, 0.06, h, 6, { x, y: 0.08 + h / 2, z, color: G.wood });
      b.box(0.86, 0.05, 1.0, { x: 0.47, y: 1.0, z: -0.38, rx: 0.2, color: G.woodD });
      b.box(0.82, 0.07, 0.96, { x: 0.47, y: 1.06, z: -0.39, rx: 0.2, color: G.turf });
      b.box(0.82, 0.03, 0.26, { x: 0.47, y: 1.02, z: -0.04, rx: 0.2, color: 'team' });
      b.box(0.6, 0.04, 0.05, { x: 0.47, y: 0.62, z: -0.78, color: G.wood });
      for (let i = 0; i < 3; i++) { const x = 0.28 + i * 0.19; b.box(0.05, 0.44, 0.015, { x, y: 0.4, z: -0.74, rz: (i - 1) * 0.05, color: i === 1 ? G.ice : G.iron, glow: i === 1 ? 0.4 : 0 }); b.box(0.12, 0.03, 0.03, { x, y: 0.6, z: -0.74, color: G.woodD }); }
      // yunque de piedra con cara de hierro y martillo gigante
      const AX = 0.3, AZ = 0.38;
      frustum(b, 0.32, 0.28, 0.26, 0.22, 0.26, { x: AX, y: 0.08, z: AZ, color: G.stoneM, jit: 0.01 });
      b.box(0.38, 0.08, 0.16, { x: AX, y: 0.38, z: AZ, color: G.iron });
      point(b, [AX + 0.19, 0.38, AZ], [AX + 0.32, 0.39, AZ], 0.05, 5, { color: G.iron });
      beam(b, [AX - 0.3, 0.1, AZ + 0.2], [AX - 0.12, 0.5, AZ + 0.12], 0.022, 0.022, 5, { color: G.woodL });
      b.box(0.12, 0.12, 0.2, { x: AX - 0.32, y: 0.12, z: AZ + 0.21, ry: 0.4, color: G.stoneL });
      // pila de temple con escarcha y barras de metal
      b.box(0.36, 0.16, 0.24, { x: -0.36, y: 0.18, z: 0.45, color: G.stoneM });
      b.box(0.3, 0.02, 0.18, { x: -0.36, y: 0.255, z: 0.45, color: '#7fb6cc' });
      shards(b, -0.6, 0.1, 0.62, 0.45, 9, 3);
      for (let i = 0; i < 3; i++) b.box(0.2, 0.05, 0.07, { x: 0.68, y: 0.13 + i * 0.05, z: 0.48 + (i % 2) * 0.03, ry: i * 0.3, color: i === 2 ? '#d98c3a' : G.iron, glow: i === 2 ? 0.4 : 0 });
      flagPole(b, -0.78, 0.08, 0.74, 1.5, { pole: G.woodD, stripe: G.rune, glow: 0.6 });
      gShield(b, 0.76, 0.5, 0.1, 0.12, 0.3);
    },
  },

  // ------------------------------------------------------------------ mercado (3×3): puestos de madera recia, pieles y quesos
  giant_market: {
    fp: 3, fire: [[0, 0.9, -0.8], [-0.9, 0.7, 0.3], [0.9, 0.7, 0.3]],
    build(b) {
      const r = rng(301), P = { k: 1.12, pr: 0.05, seg: 6, post: G.wood, counter: G.stoneM, top: G.stoneL, alt: G.fur };
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: G.stoneD, jit: 0.01 });
      oStall(b, 0, -0.85, 0, 1.3, 0.7, (at, ry) => {
        for (const lx of [-0.42, -0.22]) { const [x, z] = at(lx, 0.24); b.cyl(0.09, 0.09, 0.07, 9, { x, y: 0.47, z, color: '#e8c45a' }); b.cyl(0.085, 0.085, 0.07, 9, { x: x + 0.02, y: 0.54, z, color: '#e0ba50' }); }
        for (const lx of [0.05, 0.22, 0.4]) { const [x, z] = at(lx, 0.24); b.cyl(0.07, 0.06, 0.16, 7, { x, y: 0.51, z, color: lx > 0.3 ? G.stoneL : '#b07a50' }); }
        for (const lx of [-0.3, 0.0, 0.3]) { const [x, z] = at(lx, 0.36); b.blob(0.035, 0.09, 0.025, 0, { x, y: 0.72, z, color: '#a9b8c0' }); }
      }, P);
      oStall(b, -0.92, 0.35, PI / 2, 1.1, 0.6, (at, ry) => {
        for (const [lx, c, h] of [[-0.28, G.fur, 0.05], [-0.28, G.furB, 0.1], [0.05, G.furD, 0.05], [0.05, '#e8e2d4', 0.1], [0.32, G.furB, 0.05]]) { const [x, z] = at(lx, 0.2); b.box(0.24, 0.05, 0.18, { x, y: 0.43 + h, z, ry: ry + h, color: c }); }
      }, P);
      oStall(b, 0.92, 0.35, -PI / 2, 1.1, 0.6, (at, ry) => {
        for (const lx of [-0.3, -0.05]) { const [x, z] = at(lx, 0.2); b.box(0.2, 0.14, 0.14, { x, y: 0.53, z, ry: ry + lx, color: G.stoneL }); }
        const [x, z] = at(0.28, 0.2); crystal(b, x, 0.56, z, 0.55);
      }, P);
      // piedra rúnica central con bandera
      menhir(b, 0, 0.15, 0.3, 1.0, 0.22, { y0: 0.06, color: G.stoneL });
      rune(b, 0, 0.55, 0.27, 0, 1.0);
      crystal(b, 0, 1.18, 0.15, 0.8);
      flagPole(b, 0.3, 0.08, 0.2, 1.55, { w: 0.4, fh: 0.25, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      // barriles, tinajas y carro
      for (const [x, z] of [[-1.15, -0.55], [-0.98, -0.62]]) b.cyl(0.12, 0.12, 0.3, 8, { x, y: 0.23, z, color: G.wood });
      for (const [x, z] of [[1.0, -0.6], [1.18, -0.42]]) b.cyl(0.08, 0.12, 0.26, 7, { x, y: 0.21, z, color: '#b07a50' });
      const CX = 0.55, CZ = 1.02;
      b.box(0.66, 0.07, 0.38, { x: CX, y: 0.3, z: CZ, ry: 0.12, color: G.wood });
      for (const s of [-1, 1]) b.cyl(0.15, 0.15, 0.05, 8, { x: CX + s * 0.04, y: 0.22, z: CZ + s * 0.22, rx: PI / 2, ry: 0.12, order: 'YXZ', color: G.woodD });
      beam(b, [CX - 0.32, 0.3, CZ + 0.04], [CX - 0.66, 0.12, CZ + 0.08], 0.025, 0.025, 4, { color: G.woodD });
      for (const [x, z] of [[CX - 0.12, CZ], [CX + 0.12, CZ + 0.04]]) b.cyl(0.1, 0.1, 0.22, 8, { x, y: 0.45, z, color: G.woodL });
      b.blob(0.2, 0.06, 0.14, 0, { x: -0.45, y: 0.11, z: 0.75, color: G.fur });
    },
  },

  // ------------------------------------------------------------------ torre (2×2, ~2.6): torre redonda con faro de hielo
  giant_tower: {
    fp: 2, fire: [[0, 2.0, 0], [0, 1.0, 0.4]],
    build(b) {
      const r = rng(311);
      frustum(b, 1.7, 1.7, 1.6, 1.6, 0.12, { color: G.stoneD, jit: 0.01 });
      b.cyl(0.56, 0.62, 0.62, 8, { y: 0.43, ry: PI / 8, color: G.stone });
      b.cyl(0.51, 0.56, 0.6, 8, { y: 1.04, ry: PI / 8 + 0.12, color: G.stoneM });
      b.cyl(0.47, 0.51, 0.56, 8, { y: 1.62, ry: PI / 8 + 0.05, color: G.stone });
      for (const [y, rr] of [[0.74, 0.565], [1.34, 0.52]]) b.cyl(rr, rr + 0.01, 0.05, 8, { y, ry: PI / 8, color: G.stoneD });
      for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; menhir(b, Math.sin(a) * 0.58, Math.cos(a) * 0.58, 0.2, 0.7, 0.2, { y0: 0.1, ry: a, color: G.stoneL }); }
      // galería superior de madera pintada con almenas de piedra
      b.cyl(0.62, 0.56, 0.14, 8, { y: 1.97, ry: PI / 8, color: 'team' });
      b.cyl(0.6, 0.6, 0.04, 8, { y: 2.06, ry: PI / 8, color: 'team', teamShade: 0.75 });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; frustum(b, 0.2, 0.13, 0.16, 0.11, 0.2, { x: Math.sin(a) * 0.52, y: 2.08, z: Math.cos(a) * 0.52, ry: a, color: i % 2 ? G.stoneL : G.stone, jit: 0.012, seed: i + 40 }); }
      // faro de hielo
      b.cyl(0.22, 0.15, 0.14, 8, { y: 2.15, color: G.stoneM });
      crystal(b, 0, 2.36, 0, 1.3, { spin: { c: [0, 2.4, 0], axis: [0, 1, 0], speed: 0.9 } });
      flagPole(b, -0.36, 2.08, -0.36, 0.8, { w: 0.34, fh: 0.22, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      // puerta, runas y estandarte largo
      b.box(0.36, 0.52, 0.05, { y: 0.38, z: 0.59, color: G.woodD });
      for (const y of [0.26, 0.5]) b.box(0.38, 0.035, 0.06, { y, z: 0.6, color: G.iron });
      frustum(b, 0.52, 0.16, 0.48, 0.14, 0.12, { y: 0.64, z: 0.6, color: G.stoneL, jit: 0.01 });
      banner(b, 0, 1.84, 0.53, 0.34, 0.66, { bar: true, emblem: G.rune, glow: 0.7 });
      for (const a of [PI / 2, -PI / 2]) rune(b, Math.sin(a) * 0.5, 1.15, 0, a, 1.1);
      shards(b, 0.6, 0.12, 0.48, 0.55, 31, 3);
    },
  },

  // ------------------------------------------------------------------ puerta (1×1): trilito; 1 cerrada, 2 abierta
  giant_gate: {
    fp: 1,
    build(b) {
      for (const s of [-1, 1]) {
        frustum(b, 0.25, 0.52, 0.25, 0.5, 0.1, { x: s * 0.375, color: G.stoneD });
        menhir(b, s * 0.375, 0, 0.25, 1.1, 0.48, { y0: 0.08, taper: 0.88, color: G.stoneL, jit: 0.015, seed: s + 3 });
        b.box(0.24, 0.1, 0.46, { x: s * 0.375, y: 0.84, color: 'team' });
        rune(b, s * 0.375, 0.5, 0.235, 0, 1.0);
        rune(b, s * 0.375, 0.5, -0.235, PI, 1.0);
      }
      frustum(b, 1.0, 0.48, 0.96, 0.42, 0.22, { y: 1.18, color: G.stone, jit: 0.02, seed: 7 });
      for (const x of [-0.25, 0.25]) rune(b, x, 1.29, 0.235, 0, 0.7);
      banner(b, 0, 1.18, 0.25, 0.26, 0.2, { bar: false, emblem: G.rune, glow: 0.6, k: 2 });
      b.box(0.92, 0.03, 0.16, { y: 1.41, color: 'team' });
      crystal(b, 0, 1.5, 0, 0.8);
      const leaf = (s, open) => {
        const hx = s * 0.25, P = (u, t) => open ? [s * 0.215 + s * t, -0.04 - u] : [hx - s * u, t], ry = open ? PI / 2 : 0;
        let [x, z] = P(0.125, 0); b.box(0.25, 0.92, 0.07, { x, y: 0.54, z, ry, color: G.woodL });
        for (const u of [0.06, 0.19]) { [x, z] = P(u, 0.003); b.box(0.014, 0.9, 0.072, { x, y: 0.54, z, ry, color: shade(G.woodL, -0.12) }); }
        for (const y of [0.3, 0.78]) { [x, z] = P(0.125, 0.04); b.box(0.26, 0.05, 0.02, { x, y, z, ry, color: G.iron }); }
      };
      b.part = 1; leaf(-1, false); leaf(1, false);
      b.part = 2; leaf(-1, true); leaf(1, true);
    },
  },

  // ------------------------------------------------------------------ taller (3×3): grúa, honda gigante a medio hacer y sillares
  giant_workshop: {
    fp: 3, fire: [[0.8, 1.5, -0.6], [-0.5, 0.7, 0.5]],
    build(b) {
      const r = rng(321);
      frustum(b, 2.76, 2.76, 2.66, 2.66, 0.08, { color: G.earth });
      // cobertizo de tepe al fondo a la izquierda
      for (const [x, z] of [[-1.2, -1.15], [-0.2, -1.15], [-1.2, -0.45], [-0.2, -0.45]]) b.cyl(0.06, 0.07, 0.86, 6, { x, y: 0.51, z, color: G.wood });
      turfRoof(b, 1.28, 0.5, 1.0, 0.92, { x: -0.7, z: -0.8, seed: 6, tufts: 3 });
      for (let i = 0; i < 3; i++) b.cyl(0.08, 0.08, 0.9, 6, { x: -0.7, y: 0.16 + (i === 2 ? 0.14 : 0), z: -0.95 + (i === 2 ? 0.08 : i * 0.16), rz: PI / 2, color: shade(G.woodL, i * 0.04) });
      // grúa de doble caballete con roca colgando
      const CZ = -0.55;
      for (const x of [0.45, 1.15]) for (const s of [-1, 1]) beam(b, [x, 0.08, CZ + s * 0.42], [x, 1.62, CZ], 0.05, 0.04, 6, { color: G.wood });
      b.box(0.9, 0.1, 0.12, { x: 0.8, y: 1.62, z: CZ, color: 'team' });
      b.cyl(0.01, 0.01, 0.7, 4, { x: 0.8, y: 1.24, z: CZ, color: G.rope });
      rock(b, 0.8, 0.78, CZ, 0.2, 0.17, 0.18, G.stoneM, 5);
      b.torus(0.12, 0.02, 8, 3, { x: 0.8, y: 0.92, z: CZ, rx: PI / 2, color: G.rope });
      // honda gigante a medio hacer
      const T = rot(-0.5, 0.6, 0.2), at = (lx, ly, lz) => { const [x, z] = T(lx, lz); return [x, ly, z]; };
      for (const s of [-1, 1]) beam(b, at(s * 0.26, 0.15, -0.5), at(s * 0.26, 0.15, 0.5), 0.07, 0.07, 6, { color: G.wood });
      for (const lz of [-0.4, 0.4]) beam(b, at(-0.3, 0.2, lz), at(0.3, 0.2, lz), 0.05, 0.05, 6, { color: G.woodD });
      for (const s of [-1, 1]) { beam(b, at(s * 0.26, 0.2, -0.3), at(s * 0.26, 0.82, 0), 0.045, 0.04, 5, { color: G.woodL }); beam(b, at(s * 0.26, 0.2, 0.3), at(s * 0.26, 0.82, 0), 0.045, 0.04, 5, { color: G.woodL }); }
      beam(b, at(-0.3, 0.82, 0), at(0.3, 0.82, 0), 0.04, 0.04, 5, { color: G.iron });
      beam(b, at(0, 0.3, 0.5), at(0, 1.2, -0.42), 0.05, 0.04, 6, { color: G.woodL });
      let p = at(0, 1.2, -0.44); b.box(0.22, 0.05, 0.16, { x: p[0], y: p[1], z: p[2], ry: 0.2, color: 'team' });
      p = at(0, 0.42, 0.42); b.box(0.3, 0.24, 0.24, { x: p[0], y: p[1], z: p[2], ry: 0.2, color: G.stoneM });
      // sillares tallados y mazo
      for (const [x, y, z, ry] of [[0.85, 0.17, 0.75, 0.1], [1.12, 0.17, 0.82, -0.2], [0.98, 0.36, 0.78, 0.3]]) b.box(0.26, 0.18, 0.22, { x, y, z, ry, color: shade(G.stoneL, (r() - 0.5) * 0.08) });
      rune(b, 0.98, 0.36, 0.9, 0.3, 0.6);
      beam(b, [0.45, 0.1, 0.95], [0.35, 0.55, 0.85], 0.022, 0.022, 5, { color: G.woodL });
      b.box(0.14, 0.12, 0.14, { x: 0.47, y: 0.12, z: 0.97, color: G.wood });
      flagPole(b, -1.22, 0.08, 1.2, 1.65, { w: 0.42, fh: 0.27, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      for (const x of [-1.2, -0.2]) gShield(b, x, 0.55, -0.38, 0.12, 0, { ts: x < -1 ? 1 : 0.85 });
      shards(b, 1.22, 0.08, 0.2, 0.6, 3, 3);
    },
  },

  // ------------------------------------------------------------------ castillo (4×4, ~2.8): gran salón de piedra fortificado
  giant_castle: {
    fp: 4, fire: [[0, 2.2, -0.25], [-1.38, 1.6, 1.38], [1.38, 1.6, -1.38], [0.7, 1.1, 1.2]],
    build(b) {
      const r = rng(331), C = 1.38, ZK = -0.3;
      frustum(b, 3.68, 3.68, 3.54, 3.54, 0.18, { color: G.stoneD, jit: 0.01 });
      // murallas megalíticas con remate de tepe y almenas de piedra en pie
      const wall = (x, z, len, ry, n) => {
        const T = rot(x, z, ry);
        b.box(len, 0.62, 0.42, { x, y: 0.49, z, ry, color: G.stone });
        b.box(len, 0.05, 0.44, { x, y: 0.825, z, ry, color: G.turf });
        b.box(len, 0.06, 0.03, { x: x + Math.sin(ry) * 0.215, y: 0.6, z: z + Math.cos(ry) * 0.215, ry, color: 'team' });
        for (let i = 0; i < n; i++) { const [px, pz] = T(-len / 2 + (i + 0.5) * len / n, 0); frustum(b, 0.2, 0.34, 0.16, 0.28, 0.2, { x: px, y: 0.85, z: pz, ry, color: i % 2 ? G.stoneL : G.stoneM, jit: 0.015, seed: i + n * 7 }); }
      };
      wall(0, -C, 2.3, 0, 5); wall(-C, 0, 2.3, PI / 2, 5); wall(C, 0, 2.3, PI / 2, 5);
      wall(-0.88, C, 0.72, 0, 2); wall(0.88, C, 0.72, 0, 2);
      // torres redondas de esquina con tejado de tepe
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * C, z = sz * C;
        b.cyl(0.42, 0.45, 0.9, 8, { x, y: 0.63, z, ry: PI / 8, color: G.stone });
        b.cyl(0.39, 0.42, 0.66, 8, { x, y: 1.41, z, ry: PI / 8 + 0.1, color: G.stoneM });
        b.cyl(0.44, 0.4, 0.14, 8, { x, y: 1.8, z, ry: PI / 8, color: 'team' });
        b.cone(0.46, 0.6, 8, { x, y: 2.17, z, ry: PI / 8, color: G.turf });
        b.cyl(0.46 * 0.5 + 0.012, 0.46 * 0.72 + 0.012, 0.13, 8, { x, y: 1.87 + 0.6 * 0.28 + 0.065, z, ry: PI / 8, color: 'team' });
        b.cone(0.47, 0.12, 8, { x, y: 1.93, z, ry: PI / 8, color: G.woodD });
        if (sz > 0) { rune(b, x, 1.2, z + 0.42, 0, 1.0); crystal(b, x, 2.55, z, 0.6); }
        else flagPole(b, x, 2.4, z, 0.55, { dir: -sx, w: 0.34, fh: 0.22, pole: G.woodD, stripe: G.rune, glow: 0.6 });
      }
      // puerta principal: trilito con hojas de madera
      for (const s of [-1, 1]) menhir(b, s * 0.38, C, 0.28, 1.2, 0.5, { y0: 0.16, color: G.stoneL, taper: 0.88 });
      frustum(b, 1.1, 0.5, 1.04, 0.44, 0.26, { y: 1.34, z: C, color: G.stone, jit: 0.02, seed: 4 });
      b.box(0.5, 0.96, 0.08, { y: 0.66, z: C, color: G.woodL });
      for (const x of [-0.12, 0, 0.12]) b.box(0.014, 0.94, 0.085, { x, y: 0.66, z: C, color: shade(G.woodL, -0.12) });
      for (const y of [0.42, 0.9]) b.box(0.52, 0.05, 0.1, { y, z: C + 0.01, color: G.iron });
      for (const x of [-0.26, 0.26]) rune(b, x, 1.47, C + 0.24, 0, 0.8);
      banner(b, 0, 1.34, C + 0.27, 0.3, 0.26, { bar: false, emblem: G.rune, glow: 0.6, k: 2 });
      // gran salón central con torre del homenaje
      b.box(1.9, 1.0, 1.5, { y: 0.68, z: ZK, color: G.stone });
      blocks(b, 0, 0.18, ZK + 0.75, 1.9, 1.0, 2, 4, { seed: 23 });
      for (const x of [-0.95, 0.95]) menhir(b, x, ZK + 0.78, 0.3, 1.0, 0.28, { y0: 0.16, color: G.stoneL, taper: 0.9 });
      turfRoof(b, 2.24, 0.92, 1.8, 1.18, { z: ZK, seed: 8 });
      frustum(b, 0.66, 0.66, 0.56, 0.56, 1.0, { y: 1.55, z: ZK - 0.42, color: G.stoneM, jit: 0.015 });
      b.box(0.62, 0.12, 0.62, { y: 2.6, z: ZK - 0.42, color: 'team' });
      b.pyramid(0.74, 0.34, 0.74, { y: 2.66 + 0.17, z: ZK - 0.42, color: G.turf });
      crystal(b, 0, 3.0, ZK - 0.42, 0.9, { spin: { c: [0, 3.02, ZK - 0.42], axis: [0, 1, 0], speed: 0.8 } });
      b.box(0.5, 0.66, 0.05, { y: 0.5, z: ZK + 0.77, color: G.woodD });
      frustum(b, 0.7, 0.18, 0.66, 0.16, 0.14, { y: 0.84, z: ZK + 0.78, color: G.stoneL, jit: 0.01 });
      for (const s of [-1, 1]) banner(b, s * 0.55, 1.12, ZK + 0.8, 0.3, 0.56, { emblem: G.rune, glow: 0.7 });
      rune(b, 0, 1.06, ZK + 0.8, 0, 1.2);
      for (const s of [-1, 1]) iceBrazier(b, s * 0.72, 0.85, 0.34, 0.18);
      for (const x of [-1.0, 1.0]) gShield(b, x, 0.5, C + 0.22, 0.13, 0, { ts: x < 0 ? 1 : 0.85 });
    },
  },

  // ------------------------------------------------------------------ muro: piedra en pie (pilar) y tramo de piedra seca
  giant_wall_post: {
    fp: 1,
    build(b) {
      frustum(b, 0.6, 0.6, 0.56, 0.56, 0.12, { color: G.stoneD, jit: 0.01 });
      menhir(b, 0, 0, 0.5, 0.92, 0.5, { y0: 0.1, taper: 0.84, color: G.stoneL, jit: 0.02, seed: 4 });
      b.box(0.47, 0.11, 0.47, { y: 0.72, color: 'team' });
      frustum(b, 0.52, 0.52, 0.44, 0.44, 0.1, { y: 1.0, color: 'team', teamShade: 0.85, jit: 0.015, seed: 6 });
      for (const a of [0, PI]) rune(b, Math.sin(a) * 0.235, 0.42, Math.cos(a) * 0.235, a, 1.0);
      crystal(b, 0, 1.17, 0, 0.8);
    },
  },
  giant_wall_seg: {
    fp: 1,
    build(b) {
      b.box(0.5, 0.1, 0.46, { x: 0.25, y: 0.05, color: G.stoneD });
      b.box(0.5, 0.56, 0.4, { x: 0.25, y: 0.38, color: G.stone });
      for (const z of [-0.205, 0.205]) {
        for (const y of [0.29, 0.48]) b.box(0.5, 0.025, 0.014, { x: 0.25, y, z, color: G.stoneD });
        for (const [x, y] of [[0.16, 0.2], [0.36, 0.385], [0.2, 0.57]]) b.box(0.02, 0.16, 0.014, { x, y, z, color: G.stoneD });
      }
      b.box(0.5, 0.05, 0.42, { x: 0.25, y: 0.685, color: G.turf });
      for (const x of [0.125, 0.375]) frustum(b, 0.17, 0.3, 0.14, 0.25, 0.17, { x, y: 0.7, color: G.stoneL, jit: 0.012, seed: Math.round(x * 40) });
    },
  },
  // ==================================================================== NEUTRALES (sin color de equipo)
  // ------------------------------------------------------------------ campamento de bandidos (3×3)
  bandit_camp: {
    fp: 3, smoke: [[0, 0.5, 0.35]], fire: [[0, 0.35, 0.35], [-0.62, 0.6, -0.55], [0.7, 0.6, -0.6]],
    build(b) {
      const r = rng(401), N = { lea: '#7a5a3c', leaD: '#5e4430', red: '#8a3f32', redD: '#6e332a', can: '#b8a582', canD: '#9c8a6a', wood: '#7a5a3a', woodD: '#5a4230', dirt: '#7a6a4e', gold: '#e6c04a', stone: '#8a8278' };
      b.cyl(1.32, 1.36, 0.04, 12, { y: 0.02, color: N.dirt });
      // tiendas de lona y cuero (entrada mirando a la hoguera)
      const tent = (cx, cz, ry, w, h, d, col) => {
        const T = rot(cx, cz, ry), sl = Math.atan2(h, d / 2);
        b.wedge(w, h, d, { x: cx, y: 0.04, z: cz, ry, color: col });
        for (const [lx, t, s, c] of [[-0.18, 0.35, 1, N.canD], [0.2, 0.6, -1, N.lea], [0.1, 0.25, 1, N.redD]]) { const [px, pz] = T(lx, s * d / 2 * (1 - t)); b.box(0.22, 0.02, 0.18, { x: px, y: 0.04 + h * t, z: pz, rx: s * sl, ry, order: 'YXZ', color: c }); }
        b.cyl(0.02, 0.02, w + 0.16, 5, { x: cx, y: 0.05 + h, z: cz, rz: PI / 2, ry, color: N.woodD });
        for (const e of [-1, 1]) { const [px, pz] = T(e * (w / 2 + 0.04), 0); b.cyl(0.018, 0.02, h + 0.08, 5, { x: px, y: 0.04 + (h + 0.08) / 2, z: pz, color: N.woodD }); }
        const [ox, oz] = T(w / 2 + 0.006, 0); b.extrude([[-d * 0.22, 0], [d * 0.22, 0], [0, h * 0.7]], 0.02, { x: ox, y: 0.04, z: oz, ry: ry + PI / 2, color: HOLE });
        for (const s of [-1, 1]) { const [ax, az] = T(-w / 2 - 0.04, 0), [gx, gz] = T(-w / 2 - 0.22, s * 0.25); beam(b, [ax, 0.05 + h, az], [gx, 0.04, gz], 0.006, 0.006, 3, { color: '#c8b88e' }); }
      };
      tent(-0.62, -0.55, -0.97, 0.92, 0.62, 0.78, N.can);
      tent(0.72, -0.58, -2.2, 0.86, 0.58, 0.74, N.red);
      // empalizada parcial
      palisade(b, -0.1, -1.24, 1.5, 0.6, 0, { seed: 41 });
      palisade(b, -1.22, -0.2, 1.2, 0.55, PI / 2, { seed: 42 });
      palisade(b, 1.0, -1.0, 0.6, 0.55, -PI / 4, { seed: 43 });
      // hoguera con piedras, troncos, espetón
      const FX = 0, FZ = 0.35;
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; rock(b, FX + Math.sin(a) * 0.2, 0.06, FZ + Math.cos(a) * 0.2, 0.06, 0.045, 0.055, shade(N.stone, (r() - 0.5) * 0.1), i + 70); }
      for (let i = 0; i < 3; i++) { const a = i * 2.1; beam(b, [FX + Math.sin(a) * 0.15, 0.05, FZ + Math.cos(a) * 0.15], [FX - Math.sin(a) * 0.04, 0.14, FZ - Math.cos(a) * 0.04], 0.03, 0.025, 5, { color: '#4a3424' }); }
      const fl = (px, py) => Math.max(0, py - 0.08) * 4;
      b.cone(0.11, 0.3, 6, { x: FX, y: 0.22, z: FZ, color: FIRE, glow: 1, flag: fl });
      b.cone(0.06, 0.22, 5, { x: FX + 0.02, y: 0.19, z: FZ, ry: 0.4, color: FLAME, glow: 1, flag: fl });
      for (const s of [-1, 1]) { beam(b, [FX + s * 0.27, 0.03, FZ], [FX + s * 0.25, 0.4, FZ], 0.018, 0.015, 4, { color: N.woodD }); point(b, [FX + s * 0.25, 0.38, FZ], [FX + s * 0.3, 0.46, FZ], 0.012, 3, { color: N.woodD }); }
      b.cyl(0.012, 0.012, 0.62, 4, { x: FX, y: 0.4, z: FZ, rz: PI / 2, color: N.woodD });
      b.blob(0.1, 0.06, 0.06, 0, { x: FX, y: 0.38, z: FZ, color: '#9a5034' });
      for (const [x, z, ry] of [[-0.42, 0.62, 0.6], [0.45, 0.66, -0.5]]) b.cyl(0.07, 0.07, 0.42, 6, { x, y: 0.1, z, rz: PI / 2, ry, color: N.wood });
      // botín: cofre abierto con oro, montón de monedas, sacos, barril y cajas
      const LX = 0.85, LZ = 0.42;
      b.box(0.3, 0.17, 0.2, { x: LX, y: 0.125, z: LZ, ry: -0.3, color: N.lea });
      b.box(0.32, 0.03, 0.22, { x: LX, y: 0.215, z: LZ, ry: -0.3, color: '#c9a040' });
      b.box(0.3, 0.16, 0.03, { x: LX + 0.03, y: 0.3, z: LZ - 0.12, ry: -0.3, rx: -0.4, order: 'YXZ', color: N.leaD });
      b.blob(0.12, 0.05, 0.08, 0, { x: LX, y: 0.23, z: LZ, ry: -0.3, color: N.gold, glow: 0.35 });
      b.cone(0.16, 0.13, 7, { x: LX - 0.05, y: 0.105, z: LZ + 0.32, color: N.gold, glow: 0.3 });
      for (let i = 0; i < 4; i++) b.cyl(0.03, 0.03, 0.01, 6, { x: LX - 0.25 + r() * 0.3, y: 0.045, z: LZ + 0.2 + r() * 0.3, rx: 0.2, color: N.gold, glow: 0.3 });
      b.cyl(0.1, 0.1, 0.24, 8, { x: 1.12, y: 0.16, z: 0.05, color: N.wood });
      for (const [x, z, s] of [[1.0, -0.15, 0.22], [1.1, 0.25, 0.17]]) b.box(s, s, s, { x, y: 0.04 + s / 2, z, ry: r(), color: N.woodD });
      for (const [x, z] of [[0.55, 0.85], [0.68, 0.95]]) b.blob(0.1, 0.12, 0.09, 0, { x, y: 0.13, z, color: N.canD });
      // armero con armas robadas
      const RX = -0.85, RZ = 0.55;
      for (const s of [-1, 1]) b.cyl(0.025, 0.03, 0.5, 5, { x: RX + s * 0.25, y: 0.29, z: RZ, color: N.woodD });
      b.box(0.6, 0.035, 0.04, { x: RX, y: 0.5, z: RZ, color: N.wood });
      for (let i = 0; i < 3; i++) { const x = RX - 0.15 + i * 0.15; b.box(0.025, 0.36, 0.01, { x, y: 0.3, z: RZ + 0.04, rz: (i - 1) * 0.1, color: '#a8acb0' }); b.box(0.08, 0.02, 0.02, { x, y: 0.46, z: RZ + 0.04, color: N.leaD }); }
      // poste vigía con trapo rojo
      b.cyl(0.03, 0.04, 1.5, 6, { x: -1.0, y: 0.77, z: -0.95, color: N.woodD });
      b.box(0.3, 0.2, 0.02, { x: -0.84, y: 1.38, z: -0.95, color: N.red, flag: (px) => Math.max(0, px + 1.0) * 3.4 });
      b.box(0.12, 0.08, 0.025, { x: -0.72, y: 1.25, z: -0.95, color: N.redD, flag: (px) => Math.max(0, px + 1.0) * 3.4 });
    },
  },

  // ------------------------------------------------------------------ choza goblin (2×2): destartalada, chatarra y chimenea torcida
  goblin_hut: {
    fp: 2, smoke: [[0.36, 1.62, -0.22]], fire: [[0, 0.9, -0.1], [-0.5, 0.4, 0.5]],
    build(b) {
      const r = rng(411), GOB = '#8fa04a', PL = ['#7d6a4a', '#6a5a3e', '#8a7450', '#5e5038'], TIN = '#8a8f94', RUST = '#9a5a36', RAG = '#7a6a8a';
      b.cyl(0.84, 0.88, 0.05, 9, { y: 0.025, color: '#6e5e40' });
      // cabaña sobre pilotes cortos, tablas desparejas
      for (const [x, z] of [[-0.45, 0.35], [0.45, 0.35], [-0.45, -0.38], [0.45, -0.38]]) b.cyl(0.04, 0.05, 0.2, 5, { x, y: 0.12, z, color: '#4a3c2a' });
      b.box(1.02, 0.08, 0.86, { y: 0.24, z: -0.02, color: PL[3] });
      b.box(0.96, 0.52, 0.8, { y: 0.54, z: -0.02, rz: 0.04, ry: 0.05, color: PL[0] });
      for (let i = 0; i < 6; i++) { const x = -0.42 + i * 0.17; b.box(0.15, 0.5 + r() * 0.06, 0.03, { x, y: 0.54, z: 0.39 + (i % 2) * 0.008, rz: (r() - 0.5) * 0.12, color: PL[i % 4] }); }
      b.box(0.5, 0.06, 0.03, { x: 0.15, y: 0.66, z: 0.42, rz: 0.12, color: PL[2] });
      b.cyl(0.15, 0.15, 0.04, 8, { x: -0.2, y: 0.47, z: 0.42, rx: PI / 2, color: HOLE });
      b.torus(0.155, 0.025, 8, 4, { x: -0.2, y: 0.47, z: 0.43, color: '#4a3c2a' });
      b.box(0.14, 0.12, 0.03, { x: 0.25, y: 0.58, z: 0.43, rz: 0.08, color: '#ffd85a', glow: 0.6 });
      b.box(0.17, 0.03, 0.035, { x: 0.25, y: 0.58, z: 0.44, rz: 0.08, color: PL[3] });
      // tejado remendado y torcido
      const RY = 0.8, sl = Math.atan2(0.52, 0.6);
      b.wedge(1.28, 0.52, 1.2, { y: RY, z: -0.02, ry: 0.05, color: '#7a6440' });
      for (const [x, t, s, c, w] of [[-0.35, 0.35, 1, GOB, 0.3], [0.3, 0.55, 1, RAG, 0.24], [0.1, 0.2, 1, TIN, 0.32], [-0.2, 0.5, -1, RUST, 0.3], [0.4, 0.25, -1, GOB, 0.26]]) b.box(w, 0.025, 0.22, { x, y: RY + 0.52 * t, z: -0.02 + s * 0.6 * (1 - t), rx: s * sl, ry: (r() - 0.5) * 0.4, color: c });
      b.cyl(0.03, 0.03, 1.4, 5, { y: RY + 0.52, z: -0.02, rz: PI / 2 + 0.04, color: '#4a3c2a' });
      for (const s of [-1, 1]) point(b, [s * 0.6, RY + 0.5, -0.02], [s * 0.72, RY + 0.66, -0.02], 0.03, 4, { color: '#e8dcc0' });
      // chimenea torcida con sombrerete de lata
      b.box(0.2, 0.3, 0.2, { x: 0.34, y: 1.06, z: -0.22, rz: 0.1, color: '#8a7a68' });
      b.box(0.18, 0.26, 0.18, { x: 0.37, y: 1.32, z: -0.22, rz: -0.18, color: '#7a6a58' });
      b.box(0.16, 0.18, 0.16, { x: 0.33, y: 1.52, z: -0.22, rz: 0.28, color: RUST });
      b.cone(0.15, 0.1, 4, { x: 0.3, y: 1.68, z: -0.22, ry: PI / 4, rz: 0.3, color: TIN });
      // chatarra: barril, rueda rota, engranajes, huesos, setas
      b.cyl(0.1, 0.1, 0.24, 8, { x: 0.64, y: 0.17, z: 0.42, color: PL[2] });
      b.cyl(0.105, 0.105, 0.03, 8, { x: 0.64, y: 0.12, z: 0.42, color: TIN });
      b.torus(0.17, 0.025, 9, 4, { x: -0.72, y: 0.2, z: 0.08, ry: PI / 2, rx: 0.25, color: '#5e4c34' });
      b.box(0.02, 0.3, 0.03, { x: -0.7, y: 0.2, z: 0.08, rx: 0.25, color: '#5e4c34' });
      for (const [x, z, s] of [[0.66, -0.55, 0.12], [0.75, -0.35, 0.08]]) { b.cyl(s, s, 0.04, 8, { x, y: 0.07 + s * 0.3, z, rx: 0.3, color: TIN }); b.cyl(s * 0.4, s * 0.4, 0.05, 6, { x, y: 0.07 + s * 0.3, z, rx: 0.3, color: RUST }); }
      for (let i = 0; i < 3; i++) b.box(0.18, 0.025, 0.12, { x: 0.62 + r() * 0.12, y: 0.07 + i * 0.025, z: -0.05 + r() * 0.12, ry: r() * 3, rz: (r() - 0.5) * 0.3, color: i % 2 ? RUST : TIN });
      for (let i = 0; i < 2; i++) b.cyl(0.015, 0.015, 0.18, 4, { x: 0.15 + i * 0.08, y: 0.06, z: 0.72, rz: PI / 2, ry: r() * 3, color: '#e8dcc0' });
      for (const [x, z, c] of [[-0.6, -0.55, '#b44a3a'], [-0.5, -0.65, '#8a5ab0'], [-0.68, -0.42, '#b44a3a']]) { b.cyl(0.015, 0.02, 0.08, 4, { x, y: 0.09, z, color: '#e8dcc0' }); b.cone(0.05, 0.05, 6, { x, y: 0.15, z, color: c }); }
      // caldero con brebaje verde sobre piedras
      const KX = -0.45, KZ = 0.62;
      for (let i = 0; i < 3; i++) { const a = i * 2.1; rock(b, KX + Math.sin(a) * 0.1, 0.07, KZ + Math.cos(a) * 0.1, 0.05, 0.04, 0.05, '#7a7468', i + 90); }
      b.cyl(0.12, 0.09, 0.13, 8, { x: KX, y: 0.17, z: KZ, color: '#3e3a36' });
      b.cyl(0.1, 0.1, 0.02, 8, { x: KX, y: 0.235, z: KZ, color: '#9cff5a', glow: 0.7 });
      b.cone(0.06, 0.1, 5, { x: KX, y: 0.08, z: KZ, color: FIRE, glow: 1 });
      // tótem goblin con calavera y harapos; estacas torcidas
      b.cyl(0.03, 0.035, 0.9, 5, { x: 0.68, y: 0.48, z: 0.72, rz: 0.08, color: '#4a3c2a' });
      skull(b, 0.66, 0.96, 0.73, 0.85, 0.2, { horns: true });
      b.box(0.1, 0.22, 0.02, { x: 0.74, y: 0.72, z: 0.73, color: GOB, flag: (px, py) => Math.max(0, 0.84 - py) * 2 });
      for (const [x, z, a] of [[-0.78, 0.45, 0.3], [-0.82, 0.25, -0.2], [0.82, 0.12, 0.25]]) beam(b, [x, 0.03, z], [x + Math.sin(a) * 0.1, 0.42, z + 0.05], 0.025, 0.02, 4, { color: PL[1] });
    },
  },

  // ------------------------------------------------------------------ santuario antiguo (2×2): piedra sagrada, runas y piedra flotante
  shrine: {
    fp: 2,
    build(b) {
      const r = rng(421), S = { st: '#9c978c', stD: '#7f7b72', stL: '#b4afa4', moss: '#6c8a46', mossD: '#58743a', g: '#9ff5e0', gold: '#e0c070' };
      b.cyl(0.82, 0.86, 0.1, 10, { y: 0.05, color: S.stD });
      b.cyl(0.66, 0.7, 0.09, 10, { y: 0.145, ry: 0.15, color: S.st });
      b.cyl(0.46, 0.5, 0.08, 8, { y: 0.23, color: S.stL });
      b.box(0.42, 0.05, 0.14, { y: 0.125, z: 0.72, color: S.st });
      // cuatro columnas antiguas (dos rotas) con runas que brillan
      [[PI / 4, 0.82, false], [-PI / 4, 0.5, true], [3 * PI / 4, 0.62, true], [-3 * PI / 4, 0.84, false]].forEach(([a, h, broken], i) => {
        const x = Math.sin(a) * 0.68, z = Math.cos(a) * 0.68;
        b.box(0.22, 0.06, 0.22, { x, y: 0.13, z, ry: a, color: S.stL });
        b.cyl(0.08, 0.09, h, 8, { x, y: 0.16 + h / 2, z, color: S.st });
        if (broken) b.cyl(0.05, 0.08, 0.08, 8, { x: x + 0.01, y: 0.2 + h, z, rz: 0.35, color: S.stD });
        else { b.box(0.22, 0.07, 0.22, { x, y: 0.195 + h, z, ry: a, color: S.stL }); b.box(0.16, 0.03, 0.16, { x, y: 0.245 + h, z, ry: a, color: S.moss }); }
        b.box(0.03, h * 0.5, 0.02, { x: x - Math.sin(a) * 0.085, y: 0.16 + h * 0.45, z: z - Math.cos(a) * 0.085, ry: a, color: S.g, glow: 0.9 });
        b.blob(0.06, h * 0.3, 0.06, 0, { x: x + Math.cos(a) * 0.06, y: 0.16 + h * 0.25, z: z - Math.sin(a) * 0.06, color: S.mossD });
      });
      // musgo sobre los escalones
      for (const [x, z, s] of [[-0.55, 0.3, 0.16], [0.4, -0.45, 0.13], [0.2, 0.5, 0.1], [-0.3, -0.5, 0.12]]) b.blob(s, 0.025, s * 0.8, 0, { x, y: x * x + z * z > 0.3 ? 0.105 : 0.19, z, ry: r() * 3, color: S.moss });
      // altar con runas y anillo luminoso
      frustum(b, 0.36, 0.36, 0.28, 0.28, 0.3, { y: 0.27, color: S.stL, jit: 0.01 });
      for (const a of [0, PI / 2, -PI / 2]) rune(b, Math.sin(a) * 0.16, 0.42, Math.cos(a) * 0.16, a, 0.8, S.g);
      b.torus(0.12, 0.018, 12, 3, { y: 0.6, rx: PI / 2, color: S.g, glow: 1 });
      // piedra flotante con cristal y guijarros en órbita
      const C = [0, 0.92, 0], sp = { c: C, axis: [0, 1, 0], speed: 0.6 };
      b.blob(0.15, 0.2, 0.15, 0, { x: 0, y: 0.9, z: 0, rx: 0.3, ry: 0.5, color: S.st, spin: sp });
      b.box(0.03, 0.16, 0.02, { x: 0, y: 0.9, z: 0.13, color: S.g, glow: 0.9, spin: sp });
      crystal(b, 0, 1.12, 0, 0.7, { color: S.g, spin: sp });
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; b.blob(0.04, 0.035, 0.04, 0, { x: Math.sin(a) * 0.3, y: 0.86 + (i % 2) * 0.08, z: Math.cos(a) * 0.3, rx: a, color: S.stL, spin: { c: C, axis: [0, 1, 0], speed: -0.9 } }); }
      // ofrendas: velas y cuenco de oro
      for (const [x, z] of [[-0.3, 0.32], [0.32, 0.3]]) { b.cyl(0.025, 0.025, 0.08, 5, { x, y: 0.31, z, color: '#efe6cf' }); b.cone(0.018, 0.05, 4, { x, y: 0.375, z, color: FLAME, glow: 1 }); }
      b.cyl(0.07, 0.045, 0.05, 7, { x: 0.0, y: 0.295, z: 0.36, color: S.gold, glow: 0.3 });
    },
  },

  // ------------------------------------------------------------------ ruinas (2×2, casi planas): columnas rotas, sillares caídos y musgo
  ruins: {
    fp: 2,
    build(b) {
      const r = rng(431), R = { st: '#a8a294', stD: '#8c877c', stL: '#bcb6a8', moss: '#6f8c4a', mossD: '#5a763c', dirt: '#7a6c52' };
      b.cyl(0.84, 0.88, 0.03, 9, { y: 0.015, color: R.dirt });
      // losas del suelo, algunas levantadas
      for (let i = 0; i < 9; i++) { const gx = (i % 3) - 1, gz = Math.floor(i / 3) - 1; if (i === 5) continue; const w = 0.4 + r() * 0.08; b.box(w, 0.05, w * (0.85 + r() * 0.2), { x: gx * 0.46 + (r() - 0.5) * 0.06, y: 0.045, z: gz * 0.46 + (r() - 0.5) * 0.06, ry: (r() - 0.5) * 0.15, rx: (r() - 0.5) * 0.08, rz: (r() - 0.5) * 0.08, color: shade(i % 2 ? R.st : R.stL, (r() - 0.5) * 0.08) }); }
      // columnas rotas
      for (const [x, z, h] of [[-0.5, -0.45, 0.42], [0.45, -0.5, 0.24]]) {
        b.box(0.3, 0.08, 0.3, { x, y: 0.1, z, color: R.stL });
        b.cyl(0.1, 0.11, h, 8, { x, y: 0.14 + h / 2, z, color: R.st });
        b.cyl(0.055, 0.1, 0.09, 8, { x: x + 0.015, y: 0.17 + h, z, rz: 0.35, rx: 0.2, color: R.stD });
        b.blob(0.07, h * 0.28, 0.07, 0, { x: x + 0.07, y: 0.14 + h * 0.3, z: z + 0.05, color: R.mossD });
      }
      // tambores de columna caídos
      b.cyl(0.1, 0.1, 0.34, 8, { x: 0.05, y: 0.15, z: 0.2, rz: PI / 2, ry: 0.5, color: R.st });
      b.cyl(0.1, 0.1, 0.26, 8, { x: 0.38, y: 0.15, z: 0.38, rz: PI / 2, ry: 0.9, color: R.stD });
      // lienzo de muro desmoronado al fondo
      frustum(b, 0.9, 0.18, 0.86, 0.16, 0.3, { x: 0.05, y: 0.06, z: -0.72, color: R.stD, jit: 0.07, seed: 3 });
      b.box(0.24, 0.12, 0.16, { x: -0.25, y: 0.42, z: -0.72, ry: 0.2, rz: 0.15, color: R.st });
      // sillares sueltos y cascotes
      for (const [x, z, s] of [[-0.62, 0.3, 0.18], [0.7, 0.1, 0.15], [-0.25, 0.62, 0.13], [0.62, -0.22, 0.12]]) b.box(s * 1.3, s, s, { x, y: 0.05 + s / 2, z, ry: r() * 3, rz: (r() - 0.5) * 0.3, color: shade(R.st, (r() - 0.5) * 0.1) });
      for (let i = 0; i < 5; i++) rock(b, (r() - 0.5) * 1.4, 0.07, (r() - 0.5) * 1.4, 0.04, 0.03, 0.04, R.stD, i + 100);
      // musgo y matas de hierba
      for (const [x, z, s] of [[-0.2, -0.2, 0.18], [0.5, 0.55, 0.14], [-0.6, -0.05, 0.12], [0.25, -0.3, 0.1], [-0.45, 0.62, 0.11]]) b.blob(s, 0.02, s * 0.8, 0, { x, y: 0.075, z, ry: r() * 3, color: r() < 0.5 ? R.moss : R.mossD });
      for (const [x, z] of [[-0.72, -0.6], [0.72, 0.62], [0.05, 0.72], [-0.75, 0.58]]) for (let k = 0; k < 2; k++) b.cone(0.035, 0.14, 4, { x: x + k * 0.05, y: 0.09, z: z + k * 0.03, rz: (k - 0.5) * 0.4, color: '#7ea050', wave: (px, py) => py * 1.2 });
    },
  },
};
