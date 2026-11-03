/* =====================================================================
   Arte 3D procedural — units_hed.js: unidades humanas, élficas y enanas
   (ver docs/ART3D.md). Cada entrada: clave -> definición.
   Convenciones propias:
     · along(o, a, d): punto a distancia d de o en el plano YZ, con ángulo a
       medido desde +Y hacia +Z (0 = vertical, PI/2 = hacia delante).
     · Las armas de asta (thrust), los bastones (cast/heal), el martillo
       (smash) y los brazos de asedio usan pose() para corregir el ángulo
       del arma respecto al brazo (el rig gira el arma junto con el brazo).
   ===================================================================== */
import { shade } from '../kit.js';

const PI = Math.PI;
// ---- paleta común
const STEEL = '#aab2bc', STEEL_D = '#7d858f', MAIL = '#8e959e', LEATHER = '#6b4a2c', LEATHER_D = '#4e3622', BOOT = '#3e2c1e', GOLD = '#d4af37',
  CLOTH = '#e8e2d0', WOOD = '#8a6440', WOOD_D = '#5e4128', EYE = '#241a16', ROPE = '#c9b48a', BLADE = '#d6dce3';
// ---- elfos
const E_WOOD = '#8a6a3c', E_WOOD_L = '#a8844f', LEAF = '#5f9a4c', LEAF_L = '#7fbf5a', E_WHITE = '#f1efe4', E_GOLD = '#d9b44a', CRYSTAL = '#7ff0c0';
// ---- enanos
const GRANITE = '#8d8a86', SLATE = '#4f5661', BRONZE = '#c08a3e', IRON = '#6d737c', RUNE = '#5fe3ff', RUNE_O = '#ff9a3a';

// ------------------------------------------------------------ utilidades geométricas
const along = (o, a, d) => [o[0], o[1] + Math.cos(a) * d, o[2] + Math.sin(a) * d];
/** Desplaza p en la perpendicular (a + 90°) dentro del plano YZ. */
const off = (p, a, d) => [p[0], p[1] - Math.sin(a) * d, p[2] + Math.cos(a) * d];
const xyz = (p) => ({ x: p[0], y: p[1], z: p[2] });
/** Cilindro (o cono si r1 = 0) entre dos puntos: r0 en a, r1 en c. */
function rod(b, a, c, r0, r1, seg, o = {}) {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2], L = Math.hypot(dx, dy, dz);
  return b.cyl(r1, r0, L, seg, Object.assign({}, o, { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: Math.atan2(dz, dy), rz: Math.asin(-dx / L) }));
}
/** Caja alineada con un segmento (su eje Y va de a a c). */
function bar(b, a, c, w, d, o = {}) {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2], L = Math.hypot(dx, dy, dz);
  return b.box(w, L, d, Object.assign({}, o, { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: Math.atan2(dz, dy), rz: Math.asin(-dx / L) }));
}

// ------------------------------------------------------------ animación auxiliar (copias locales)
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
function track(k, keys) {
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (k <= keys[i][0]) { const [k0, v0] = keys[i - 1], [k1, v1] = keys[i]; return v0 + (v1 - v0) * ease((k - k0) / (k1 - k0)); }
  return keys[keys.length - 1][1];
}
const atk = st => st.anim === 'attack' && !(st.dead >= 0);
/** 'thrust': el rig gira el asta con el brazo; aquí se compensa para que baje a la horizontal y apunte al frente. */
function thrustFix(want, rider) {
  const hand = rider ? 'rHandR' : 'handR';
  return (P, st) => {
    if (!atk(st)) return;
    const k = st.k, r = track(k, [[0, 0], [0.32, 0.55], [0.48, -1.35], [0.62, -1.25], [1, 0]]);
    const eng = r + (r < 0 ? r * 0.25 : 0) - r * 0.12;
    P.r(hand, track(k, want) - eng, 0, 0);
  };
}
const PIKE_WANT = [[0, 0], [0.3, 1.45], [0.48, 1.62], [0.62, 1.58], [1, 0]];
/** 'cast'/'heal': mantiene el bastón casi vertical (algo inclinado al frente) con el brazo en alto. */
function castFix(P, st) {
  if (!atk(st)) return;
  const k = st.k, up = track(k, [[0, 0], [0.35, 1], [0.5, 0.4], [0.75, 0.4], [1, 0]]), push = track(k, [[0.38, 0], [0.5, 1], [0.8, 0]]);
  P.r('handR', 1.75 * up + 0.75 * push, 0, 0);
}
/** Flecha encordada (pieza toolBasket, hija de handL) visible solo mientras se tensa el arco. */
function nockFix(P, st) { P.s('toolBasket', atk(st) && st.k > 0.12 && st.k < 0.49 ? 1 : 0); }

// ------------------------------------------------------------ proporciones por raza
const HU = { hip: 0.25, legX: 0.05, legW: 0.07, legD: 0.08, sh: [0.105, 0.43], armX: 0.125, armW: 0.054, handY: 0.236, neck: 0.46, headY: 0.527, headR: 0.068, torsoD: 0.12, skin: '#e8b48a' };
const EL = { hip: 0.285, legX: 0.044, legW: 0.058, legD: 0.066, sh: [0.094, 0.476], armX: 0.11, armW: 0.045, handY: 0.268, neck: 0.505, headY: 0.568, headR: 0.06, torsoD: 0.1, skin: '#f2d4b4' };
const DW = { hip: 0.155, legX: 0.058, legW: 0.08, legD: 0.088, sh: [0.12, 0.312], armX: 0.146, armW: 0.064, handY: 0.165, neck: 0.338, headY: 0.388, headR: 0.072, torsoD: 0.15, skin: '#e3a882' };
/** Pivotes reales del humanoide según las proporciones R. */
function piv(R, extra) {
  const back = [0, (R.hip + R.sh[1]) / 2 + 0.03, -R.torsoD / 2 - 0.02];
  return Object.assign({
    body: [0, R.hip + 0.02, 0], head: [0, R.neck, 0],
    armL: [-R.sh[0], R.sh[1], 0], armR: [R.sh[0], R.sh[1], 0],
    handL: [-R.armX, R.handY, 0], handR: [R.armX, R.handY, 0],
    legL: [-R.legX, R.hip, 0], legR: [R.legX, R.hip, 0],
    cape: [0, R.sh[1] + 0.015, -R.torsoD / 2 - 0.01], back,
    carryWood: back, carryFood: back, carryGold: back, carryStone: back, carryIron: back,
  }, extra || {});
}
const H_R = R => [R.armX, R.handY, 0], H_L = R => [-R.armX, R.handY, 0];
/** Proporciones desplazadas en altura (jinetes sentados en la silla). */
const lift = (R, dy) => Object.assign({}, R, { hip: R.hip + dy, sh: [R.sh[0], R.sh[1] + dy], handY: R.handY + dy, neck: R.neck + dy, headY: R.headY + dy });
/** Casco de cúpula (torno abierto por abajo). */
function helm(b, y0, r, h, color, o = {}) { b.lathe([[r, 0], [r * 0.99, h * 0.35], [r * 0.84, h * 0.7], [r * 0.46, h * 0.94], [0.001, h]], o.seg || 8, { y: y0, color }); }

// ------------------------------------------------------------ piezas del cuerpo
function legs(b, P, R, pants, boot, o = {}) {
  const bh = o.bootH ?? R.hip * 0.3, top = R.hip + 0.015;
  for (const [p, s] of [[P.legL, -1], [P.legR, 1]]) {
    b.part = p; const x = R.legX * s;
    b.box(R.legW, top - bh + 0.01, R.legD, { x, y: (top + bh - 0.01) / 2, color: pants });
    b.box(R.legW + 0.012, bh, R.legD + 0.03, { x, y: bh / 2, z: 0.013, color: boot });
    if (o.cuff) b.box(R.legW + 0.022, 0.022, R.legD + 0.018, { x, y: bh, color: o.cuff });
    if (o.knee) b.ball(R.legW * 0.56, 0, { x, y: bh + (R.hip - bh) * 0.42, z: R.legD * 0.42, color: o.knee });
  }
}
/** Brazos: o.sleeve (brazo), o.fore (antebrazo), o.hand (puño), o.pad (hombrera), o.padR, o.ts (teamShade manga). */
function arms(b, P, R, o) {
  const top = R.sh[1], hy = R.handY, el = hy + (top - hy) * 0.48, w = R.armW;
  if (o.rider) P = { armL: P.rArmL, armR: P.rArmR };
  for (const [p, s] of [[P.armL, -1], [P.armR, 1]]) {
    b.part = p; const x = R.armX * s;
    if (!o.fore || o.fore === o.sleeve) b.box(w, top - hy - 0.01, w + 0.004, { x, y: (top + hy) / 2 + 0.01, color: o.sleeve, teamShade: o.ts });
    else {
      b.box(w, top - el + 0.01, w + 0.004, { x, y: (top + el) / 2, color: o.sleeve, teamShade: o.ts });
      b.box(w * 0.9, el - hy, w * 0.94, { x, y: (el + hy) / 2 + 0.012, color: o.fore });
    }
    if (o.cuff) b.box(w * 1.12, 0.026, w * 1.16, { x, y: hy + 0.04, color: o.cuff, teamShade: o.cuffTs });
    b.box(w * 0.96, 0.05, w * 1.04, { x, y: hy, color: o.hand || R.skin });
    if (o.pad) b.ball(o.padR ?? w * 0.88, 0, { x: x * 1.02, y: top - 0.006, sy: 0.78, color: o.pad, teamShade: o.padTs });
  }
}
function eyes(b, R, o = {}) {
  const y = R.headY + (o.dy ?? 0.008), z = R.headR * (o.zk ?? 0.93), sx = o.sep ?? R.headR * 0.37;
  b.box(0.014, o.h ?? 0.014, 0.012, { x: -sx, y, z, color: o.color || EYE });
  b.box(0.014, o.h ?? 0.014, 0.012, { x: sx, y, z, color: o.color || EYE });
}
function headHuman(b, R, o = {}) {
  b.ball(R.headR, 1, { y: R.headY, color: R.skin });
  eyes(b, R);
  if (!o.noNose) b.box(0.016, 0.026, 0.02, { y: R.headY - 0.01, z: R.headR * 0.98, color: shade(R.skin, -0.06) });
  if (o.hair) b.blob(R.headR * 1.04, R.headR * 0.62, R.headR * 1.04, 1, { y: R.headY + R.headR * 0.42, z: -0.01, color: o.hair });
  if (o.beard) {
    b.blob(R.headR * 0.86, R.headR * 0.55, R.headR * 0.6, 1, { y: R.headY - R.headR * 0.55, z: R.headR * 0.42, color: o.beard });
    b.box(0.05, 0.012, 0.016, { y: R.headY - 0.022, z: R.headR * 0.98, color: o.beard });
  }
}
function headElf(b, R, o = {}) {
  const y = R.headY, r = R.headR;
  b.ball(r, 1, { y, sy: 1.07, color: R.skin });
  eyes(b, R, { color: o.eye || '#2c5a3a', h: 0.011 });
  b.box(0.012, 0.02, 0.016, { y: y - 0.012, z: r * 0.98, color: shade(R.skin, -0.05) });
  for (const s of [-1, 1]) rod(b, [s * r * 0.82, y + 0.004, -0.004], [s * (r + 0.05), y + 0.05, -0.032], 0.017, 0.0, 4, { color: R.skin });
  if (o.hair) {
    b.blob(r * 1.05, r * 0.7, r * 1.08, 1, { y: y + r * 0.4, z: -0.008, color: o.hair });
    if (o.long !== false) b.box(r * 1.6, o.long ?? 0.15, 0.03, { y: y - (o.long ?? 0.15) / 2 + 0.02, z: -r * 0.78, color: shade(o.hair, -0.04) });
  }
}
/** Cabeza de enano con barba enorme (barba y bigote en la pieza head). */
function headDwarf(b, R, beard, o = {}) {
  const y = R.headY, r = R.headR, bd = shade(beard, -0.05);
  b.ball(r, 1, { y, color: R.skin });
  eyes(b, R, { dy: 0.014, sep: 0.027 });
  b.box(0.07, 0.016, 0.02, { y: y + 0.03, z: r * 0.86, color: o.brow || bd });
  b.ball(0.022, 0, { y: y - 0.004, z: r * 0.96, color: shade(R.skin, -0.05) });
  b.blob(r * 0.98, r * 0.62, r * 0.76, 1, { y: y - r * 0.5, z: r * 0.5, color: beard });
  b.cone(r * (o.wide ?? 0.95), o.len ?? 0.16, 6, { y: y - r * 0.62 - (o.len ?? 0.16) / 2, z: o.z ?? r * 1.32, rx: PI - 0.12, sz: 0.55, color: bd });
  b.box(0.1, 0.022, 0.03, { y: y - 0.024, z: r * 0.92, color: shade(beard, 0.06) });
  if (o.braid) for (const s of [-1, 1]) b.box(0.016, 0.03, 0.016, { x: s * 0.036, y: y - r - 0.06, z: r * 0.98, color: o.braid });
}

// ------------------------------------------------------------ armas y equipo
/** Arco vertical en el plano YZ: empuñadura en c, cuerda detrás (-Z). */
function bow(b, c, len, o = {}) {
  const h = len / 2, w = o.wood || E_WOOD, r = o.r ?? 0.011, cv = o.curve ?? 0.11;
  const pts = [[0, -h, -cv * len], [0, -h * 0.55, -0.025 * len], [0, -0.04, 0], [0, 0.04, 0], [0, h * 0.55, -0.025 * len], [0, h, -cv * len]].map(([x, y, z]) => [c[0] + x, c[1] + y, c[2] + z]);
  rod(b, pts[0], pts[1], r * 0.6, r, 5, { color: w });
  rod(b, pts[1], pts[2], r, r * 1.15, 5, { color: w });
  rod(b, pts[3], pts[4], r * 1.15, r, 5, { color: w });
  rod(b, pts[4], pts[5], r, r * 0.6, 5, { color: w });
  b.cyl(r * 1.5, r * 1.5, 0.09, 6, { x: c[0], y: c[1], z: c[2], color: o.grip || LEATHER });
  rod(b, pts[0], pts[5], 0.005, 0.005, 4, { color: o.string || '#ece6d4' });
  if (o.tips) for (const p of [pts[0], pts[5]]) b.ball(r * 1.6, 0, { x: p[0], y: p[1], z: p[2], color: o.tips, glow: o.tipGlow || 0 });
}
/** Flecha encordada (en handL, apunta a +Z). */
function nocked(b, P, c, o = {}) {
  b.part = P.toolBasket;
  rod(b, [c[0] + 0.012, c[1], c[2] - 0.05], [c[0] + 0.012, c[1], c[2] + 0.2], 0.006, 0.006, 4, { color: o.shaft || '#c8a878' });
  b.cone(0.014, 0.04, 4, { x: c[0] + 0.012, y: c[1], z: c[2] + 0.215, rx: PI / 2, color: STEEL });
}
function quiver(b, c, o = {}) {
  const rz = o.rz ?? -0.4, L = o.len ?? 0.2, col = o.color || LEATHER;
  const top = [c[0] + Math.sin(-rz) * L * 0.5, c[1] + Math.cos(rz) * L * 0.5, c[2]];
  b.cyl(o.r ?? 0.034, (o.r ?? 0.034) * 0.85, L, 7, { x: c[0], y: c[1], z: c[2], rz, color: col });
  b.cyl((o.r ?? 0.034) * 1.08, (o.r ?? 0.034) * 1.08, 0.022, 7, { x: top[0], y: top[1], z: top[2], rz, color: o.rim || LEATHER_D });
  for (const [dx, dz, cc] of [[-0.012, 0.008, o.fl || CLOTH], [0.012, -0.006, o.fl2 || '#c0392b'], [0, 0.0, o.fl || CLOTH]]) {
    const p = [top[0] + dx + Math.sin(-rz) * 0.04, top[1] + Math.cos(rz) * 0.04, top[2] + dz];
    b.box(0.022, 0.05, 0.006, { x: p[0], y: p[1], z: p[2], rz, ry: dx * 30, color: cc });
  }
}
/** Escudo de cometa (heater) del color de equipo; mira hacia ry. */
function heaterShield(b, c, ry, s = 1, o = {}) {
  const pts = [[-0.09, 0.1], [0.09, 0.1], [0.09, 0.0], [0.06, -0.07], [0, -0.115], [-0.06, -0.07], [-0.09, 0.0]].map(([x, y]) => [x * s, y * s]);
  const n = [Math.sin(ry), 0, Math.cos(ry)];
  b.extrude(pts.map(([x, y]) => [x * 1.13, y * 1.1]), 0.014 * s, { x: c[0] - n[0] * 0.012, y: c[1], z: c[2] - n[2] * 0.012, ry, color: o.rim || STEEL_D });
  b.extrude(pts, 0.02 * s, { x: c[0], y: c[1], z: c[2], ry, color: 'team' });
  b.box(0.026 * s, 0.15 * s, 0.008, { x: c[0] + n[0] * 0.012, y: c[1] - 0.005 * s, z: c[2] + n[2] * 0.012, ry, color: o.cross || CLOTH });
  b.box(0.11 * s, 0.026 * s, 0.008, { x: c[0] + n[0] * 0.012, y: c[1] + 0.035 * s, z: c[2] + n[2] * 0.012, ry, color: o.cross || CLOTH });
}
/** Escudo redondo enano: aro de hierro, cara de equipo, umbo de bronce y runa. */
function roundShield(b, c, ry, r, o = {}) {
  const n = [Math.sin(ry), 0, Math.cos(ry)], rx = PI / 2;
  b.cyl(r * 1.08, r * 1.08, 0.022, 10, { x: c[0] - n[0] * 0.006, y: c[1], z: c[2] - n[2] * 0.006, rx, ry, order: 'YXZ', color: o.rim || IRON });
  b.cyl(r, r, 0.03, 10, { x: c[0], y: c[1], z: c[2], rx, ry, order: 'YXZ', color: 'team' });
  b.ball(r * 0.3, 0, { x: c[0] + n[0] * 0.016, y: c[1], z: c[2] + n[2] * 0.016, sz: 0.6, ry, color: o.boss || BRONZE });
  if (o.band !== false) b.box(r * 1.9, r * 0.2, 0.01, { x: c[0] + n[0] * 0.015, y: c[1], z: c[2] + n[2] * 0.015, ry, color: o.bandC || BRONZE });
  if (o.rune) b.box(r * 0.18, r * 0.5, 0.008, { x: c[0] + n[0] * 0.017, y: c[1] + r * 0.55, z: c[2] + n[2] * 0.017, ry, color: o.rune, glow: 0.9 });
}
/** Escudo-hoja élfico (extrusión), nervio dorado. */
function leafShield(b, c, ry, s = 1) {
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, y = 0.13 - t * 0.27, w = Math.sin(t * PI) * 0.085 * (1 - t * 0.25); pts.push([w * s, y * s]); }
  for (let i = 7; i >= 1; i--) { const t = i / 8, y = 0.13 - t * 0.27, w = Math.sin(t * PI) * 0.085 * (1 - t * 0.25); pts.push([-w * s, y * s]); }
  const n = [Math.sin(ry), 0, Math.cos(ry)];
  b.extrude(pts.map(([x, y]) => [x * 1.12, y * 1.06]), 0.012, { x: c[0] - n[0] * 0.008, y: c[1], z: c[2] - n[2] * 0.008, ry, color: E_GOLD });
  b.extrude(pts, 0.02, { x: c[0], y: c[1], z: c[2], ry, color: 'team' });
  b.box(0.012, 0.25 * s, 0.006, { x: c[0] + n[0] * 0.012, y: c[1] - 0.005, z: c[2] + n[2] * 0.012, ry, color: E_GOLD });
  for (const dy of [0.04, -0.03]) for (const sd of [-1, 1]) b.box(0.05 * s, 0.008, 0.005, { x: c[0] + n[0] * 0.012 + Math.cos(ry) * sd * 0.022, y: c[1] + dy + 0.012, z: c[2] + n[2] * 0.012 - Math.sin(ry) * sd * 0.022, ry, rz: -sd * 0.5, color: shade(E_GOLD, -0.08) });
}
/** Hoja curva (cimitarra/guja élfica) en el plano YZ: base en p, dirección a; se curva hacia el lomo (-n). */
function curvedBlade(b, p, a, len, o = {}) {
  const w = o.w ?? 0.028, c = o.curve ?? 0.06;
  const pts = [[0, w / 2], [len * 0.33, c * 0.11 + w / 2], [len * 0.66, c * 0.44 + w / 2], [len, c], [len * 0.75, c * 0.56 - w / 2], [len * 0.4, c * 0.16 - w / 2], [0, -w / 2]];
  b.extrude(pts.map(([u, v]) => [v, u]), o.t ?? 0.012, { x: p[0], y: p[1], z: p[2], rx: a, ry: PI / 2, color: o.color || BLADE, glow: o.glow || 0 });
}
/** Cuerno de carnero en espiral (extrusión de perfil). c = centro de la espiral; side = -1/1. */
function hornSpiral(b, c, side, s, color) {
  const out = [], inn = [], N = 10, T = 1.7 * PI;
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = PI / 2 - side * t * T, R = s * (0.062 - 0.036 * t), w = s * (0.032 - 0.02 * t);
    out.push([Math.cos(th) * R, Math.sin(th) * R]); inn.push([Math.cos(th) * (R - w), Math.sin(th) * (R - w)]);
  }
  b.extrude(out.concat(inn.reverse()), 0.036 * s, { x: c[0], y: c[1], z: c[2], ry: side * PI / 2, color });
}
/** Piernas del jinete (en rBody): muslos a lo largo de Z y espinillas colgando a los lados de la montura. */
function riderLegs(b, sy, zc, xs, o) {
  for (const s of [-1, 1]) {
    b.box(o.w, o.w, 0.15, { x: s * xs, y: sy, z: zc + 0.05, color: o.pants });
    b.box(o.w * 0.92, o.shin, o.w, { x: s * (xs + 0.012), y: sy - o.shin / 2, z: zc + 0.105, color: o.shinC || o.pants });
    b.box(o.w + 0.008, 0.04, o.w + 0.03, { x: s * (xs + 0.012), y: sy - o.shin, z: zc + 0.115, color: o.boot });
  }
}

// ------------------------------------------------------------ aldeanos: herramientas y cargas
/** Herramientas (mano derecha) y cesta (mano izquierda). Ángulos elegidos para que chop/mine/build/farm golpeen al frente. */
function workerTools(b, P, H, HL, o = {}) {
  const s = o.s || 1, W = o.wood || WOOD, M = o.metal || STEEL, da = o.da || 0;
  let a = 1.9 - da;
  b.part = P.toolAxe;
  rod(b, along(H, a, -0.04 * s), along(H, a, 0.25 * s), 0.011 * s, 0.011 * s, 6, { color: W });
  let q = off(along(H, a, 0.215 * s), a, 0.03 * s);
  b.box(0.014 * s, 0.05 * s, 0.07 * s, { ...xyz(q), rx: a, color: M });
  q = off(along(H, a, 0.215 * s), a, 0.066 * s);
  b.box(0.017 * s, 0.08 * s, 0.014 * s, { ...xyz(q), rx: a, color: shade(M, 0.12) });
  a = 2.5 - da;
  b.part = P.toolPick;
  rod(b, along(H, a, -0.04 * s), along(H, a, 0.25 * s), 0.011 * s, 0.011 * s, 6, { color: W });
  const hp = along(H, a, 0.235 * s);
  rod(b, hp, along(hp, a + PI / 2 + 0.3, 0.1 * s), 0.016 * s, 0.003, 5, { color: M });
  rod(b, hp, along(hp, a - PI / 2 - 0.3, 0.075 * s), 0.016 * s, 0.003, 5, { color: M });
  a = 2.2 - da;
  b.part = P.toolHammer;
  rod(b, along(H, a, -0.04 * s), along(H, a, 0.21 * s), 0.011 * s, 0.011 * s, 6, { color: W });
  b.box(0.05 * s, 0.05 * s, 0.11 * s, { ...xyz(along(H, a, 0.2 * s)), rx: a, color: o.hammer || M });
  a = 2.5 - da;
  b.part = P.toolHoe;
  rod(b, along(H, a, -0.13 * s), along(H, a, 0.3 * s), 0.01 * s, 0.01 * s, 6, { color: W });
  b.box(0.075 * s, 0.014 * s, 0.065 * s, { ...xyz(off(along(H, a, 0.3 * s), a, 0.03 * s)), rx: a, color: M });
  b.part = P.toolBasket;
  const bc = [HL[0] - 0.03 * s, HL[1] - 0.085 * s, HL[2] + 0.01];
  b.torus(0.042 * s, 0.006 * s, 8, 4, { x: HL[0] - 0.015 * s, y: HL[1] - 0.04 * s, z: bc[2], rz: 0.35, color: o.basket || '#b8925a' });
  b.cyl(0.056 * s, 0.04 * s, 0.07 * s, 8, { ...xyz(bc), color: o.basket || '#b8925a' });
  b.blob(0.046 * s, 0.022 * s, 0.046 * s, 0, { x: bc[0], y: bc[1] + 0.036 * s, z: bc[2], color: '#c0392b' });
}
/** Cargas a la espalda. back = [y, z] del centro de la espalda. */
function workerCarry(b, P, back, o = {}) {
  const s = o.s || 1, [y, z] = back;
  b.part = P.carryWood;
  for (const [dy, dz, l] of [[-0.03, -0.035, 0.22], [-0.03, -0.09, 0.2], [0.022, -0.062, 0.24]]) b.cyl(0.03 * s, 0.03 * s, l * s, 6, { y: y + dy * s, z: z + dz * s, rz: PI / 2, color: shade('#9a7046', dz * 0.6) });
  b.box(0.03 * s, 0.11 * s, 0.1 * s, { y, z: z - 0.06 * s, color: ROPE });
  b.part = P.carryFood;
  b.cyl(0.07 * s, 0.055 * s, 0.11 * s, 8, { y, z: z - 0.06 * s, rx: -0.15, color: '#b8925a' });
  for (const [dx, dz, c] of [[-0.03, -0.05, '#c0392b'], [0.025, -0.07, '#e0a030'], [0.0, -0.04, '#7fbf5a']]) b.ball(0.03 * s, 0, { x: dx * s, y: y + 0.065 * s, z: z + dz * s, color: c });
  b.part = P.carryGold;
  b.blob(0.075 * s, 0.07 * s, 0.055 * s, 1, { y, z: z - 0.055 * s, color: '#a07a4a' });
  for (const [dx, dy] of [[-0.03, 0.06], [0.02, 0.07], [0.0, 0.045]]) b.ball(0.028 * s, 0, { x: dx * s, y: y + dy * s, z: z - 0.05 * s, color: '#f2c94c', glow: 0.35 });
  b.part = P.carryStone;
  b.box(0.13 * s, 0.1 * s, 0.07 * s, { y: y - 0.01 * s, z: z - 0.05 * s, ry: 0.1, color: '#a6a39e' });
  b.box(0.09 * s, 0.06 * s, 0.06 * s, { x: 0.01 * s, y: y + 0.07 * s, z: z - 0.05 * s, ry: -0.2, color: '#b9b5ae' });
  b.box(0.14 * s, 0.018 * s, 0.08 * s, { y: y + 0.015 * s, z: z - 0.05 * s, color: ROPE });
  b.part = P.carryIron;
  b.blob(0.07 * s, 0.065 * s, 0.05 * s, 1, { y, z: z - 0.055 * s, color: '#7a6a58' });
  for (const [dx, dy, c] of [[-0.03, 0.06, '#7b5d50'], [0.025, 0.065, '#8a8f99'], [0.0, 0.04, '#6d4a3e']]) b.ball(0.032 * s, 0, { x: dx * s, y: y + dy * s, z: z - 0.05 * s, color: c });
}

// ------------------------------------------------------------ asedio
/** Rueda con el eje en X: llanta (toro), cubo y dos radios. */
function wheel(b, c, r, o = {}) {
  const w = o.w ?? 0.035;
  b.torus(r - w * 0.35, w * 0.45, o.seg || 10, 4, { x: c[0], y: c[1], z: c[2], ry: PI / 2, color: o.rim || WOOD_D });
  b.cyl(r * 0.22, r * 0.22, w * 1.5, 7, { x: c[0], y: c[1], z: c[2], rz: PI / 2, color: o.hub || IRON });
  b.box(w * 0.6, r * 1.8, r * 0.16, { x: c[0], y: c[1], z: c[2], color: o.spoke || WOOD });
  b.box(w * 0.6, r * 0.16, r * 1.8, { x: c[0], y: c[1], z: c[2], color: o.spoke || WOOD });
}
/** Tripulante pequeño empujando (pieza crewL/crewR). */
function crewman(b, x, z, o) {
  const s = o.s || 1, skin = o.skin || HU.skin;
  for (const d of [-1, 1]) b.box(0.042 * s, 0.15 * s, 0.05 * s, { x: x + d * 0.03 * s, y: 0.075 * s, z: z + d * 0.02 * s, color: o.pants || '#5b4a3a' });
  b.box(0.12 * s, 0.15 * s, 0.08 * s, { x, y: 0.215 * s, z: z + 0.01 * s, rx: 0.25, color: 'team' });
  b.ball(0.05 * s, 0, { x, y: 0.33 * s, z: z + 0.045 * s, color: skin });
  if (o.hat) b.cone(0.055 * s, 0.05 * s, 6, { x, y: 0.375 * s, z: z + 0.045 * s, color: o.hat });
  if (o.beard) b.blob(0.04 * s, 0.05 * s, 0.03 * s, 0, { x, y: 0.29 * s, z: z + 0.085 * s, color: o.beard });
  for (const d of [-1, 1]) b.box(0.034 * s, 0.13 * s, 0.036 * s, { x: x + d * 0.075 * s, y: 0.25 * s, z: z + 0.09 * s, rx: -1.15, color: o.sleeve || 'team', teamShade: 0.8 });
}

// =====================================================================
export const MODELS = {
  // ================================================================== HUMANOS
  human_worker: {
    skeleton: 'humanoid', pivots: piv(HU), anim: { attack: 'swing', hold: 'none', height: 0.62 },
    build(b, P) {
      const R = HU, HOOD = '#8d6e48';
      legs(b, P, R, '#7a6448', '#4a3524', { bootH: 0.07 });
      b.part = P.body;
      b.box(0.17, 0.165, 0.108, { y: 0.375, color: 'team' });
      b.cyl(0.098, 0.122, 0.135, 8, { y: 0.262, color: 'team', teamShade: 0.82 });
      b.box(0.182, 0.026, 0.12, { y: 0.318, color: LEATHER });
      b.box(0.022, 0.026, 0.01, { y: 0.318, z: 0.062, color: '#c9b26a' });
      b.box(0.045, 0.055, 0.032, { x: -0.07, y: 0.282, z: 0.058, color: '#8a6440' });
      b.box(0.06, 0.07, 0.01, { y: 0.42, z: 0.055, color: CLOTH });
      b.cyl(0.078, 0.108, 0.05, 8, { y: 0.452, color: HOOD });
      b.part = P.head;
      headHuman(b, R, { beard: '#7a4a2a' });
      b.ball(0.081, 1, { y: R.headY + 0.014, z: -0.03, color: HOOD });
      b.cone(0.03, 0.08, 5, { y: R.headY + 0.03, z: -0.11, rx: -1.9, color: HOOD });
      arms(b, P, R, { sleeve: 'team', ts: 0.9, fore: R.skin, cuff: CLOTH });
      workerTools(b, P, H_R(R), H_L(R));
      workerCarry(b, P, [0.39, -0.06]);
    },
  },

  human_inf: {
    skeleton: 'humanoid', pivots: piv(HU), anim: { attack: 'swing', hold: 'sword', height: 0.62 },
    build(b, P) {
      const R = HU;
      legs(b, P, R, '#5b4a3a', BOOT, { cuff: STEEL_D, knee: STEEL });
      b.part = P.body;
      b.cyl(0.1, 0.122, 0.12, 8, { y: 0.27, color: MAIL });
      b.box(0.19, 0.17, 0.118, { y: 0.37, color: MAIL });
      b.box(0.152, 0.27, 0.132, { y: 0.318, color: 'team' });
      b.box(0.028, 0.19, 0.006, { y: 0.335, z: 0.068, color: CLOTH });
      b.box(0.1, 0.028, 0.006, { y: 0.385, z: 0.068, color: CLOTH });
      b.box(0.2, 0.03, 0.137, { y: 0.258, color: '#5a3a22' });
      b.box(0.03, 0.026, 0.02, { y: 0.258, z: 0.07, color: GOLD });
      b.box(0.03, 0.09, 0.03, { x: -0.1, y: 0.22, z: 0.02, rz: 0.15, color: '#4a3020' });
      b.cyl(0.06, 0.076, 0.05, 8, { y: 0.455, color: MAIL });
      b.part = P.head;
      headHuman(b, R, { noNose: true });
      b.cyl(0.081, 0.083, 0.034, 8, { y: 0.565, color: STEEL_D });
      b.cone(0.08, 0.085, 8, { y: 0.623, color: STEEL });
      b.box(0.016, 0.062, 0.016, { y: 0.54, z: 0.074, color: STEEL });
      b.box(0.022, 0.05, 0.11, { y: 0.665, z: -0.012, color: 'team', flag: (x, y, z) => Math.max(0, -z) * 3 });
      arms(b, P, R, { sleeve: MAIL, hand: LEATHER, pad: 'team', padR: 0.05, cuff: STEEL });
      for (const s of [-1, 1]) { b.part = s < 0 ? P.armL : P.armR; b.box(0.064, 0.016, 0.07, { x: 0.125 * s, y: 0.405, color: STEEL }); }
      b.part = P.handR;
      const h = H_R(R), rx = 0.75;
      b.cyl(0.012, 0.012, 0.07, 6, { ...xyz(h), rx, color: LEATHER });
      let q = along(h, rx, 0.04); b.box(0.09, 0.018, 0.024, { ...xyz(q), rx, color: '#c9b26a' });
      q = along(h, rx, 0.19); b.box(0.034, 0.28, 0.012, { ...xyz(q), rx, color: BLADE });
      q = along(h, rx, 0.35); b.cone(0.024, 0.05, 4, { ...xyz(q), rx, ry: PI / 4, sz: 0.4, color: BLADE });
      q = along(h, rx, -0.045); b.ball(0.017, 0, { ...xyz(q), color: GOLD });
      b.part = P.handL;
      heaterShield(b, [-0.168, 0.272, 0.045], -0.55, 1.12);
    },
  },

  human_pike: {
    skeleton: 'humanoid', pivots: piv(HU), anim: { attack: 'thrust', hold: 'spear', height: 0.62 },
    pose: thrustFix(PIKE_WANT),
    build(b, P) {
      const R = HU, PAD = '#cdb88e';
      legs(b, P, R, '#6a5a48', BOOT, { cuff: '#5a3a22' });
      b.part = P.body;
      b.cyl(0.1, 0.12, 0.12, 8, { y: 0.27, color: PAD });
      b.box(0.188, 0.17, 0.118, { y: 0.37, color: PAD });
      for (const y of [0.33, 0.39]) b.box(0.192, 0.008, 0.122, { y, color: shade(PAD, -0.08) });
      b.box(0.148, 0.28, 0.13, { y: 0.31, color: 'team' });
      b.box(0.15, 0.03, 0.004, { y: 0.4, z: 0.066, color: CLOTH });
      b.box(0.15, 0.03, 0.004, { y: 0.4, z: -0.066, color: CLOTH });
      b.box(0.198, 0.028, 0.135, { y: 0.262, color: LEATHER });
      b.box(0.03, 0.08, 0.03, { x: -0.1, y: 0.23, z: 0.0, color: LEATHER_D });
      b.cyl(0.06, 0.07, 0.04, 8, { y: 0.455, color: PAD });
      b.part = P.head;
      headHuman(b, R, { beard: '#5a3a22' });
      b.cyl(0.115, 0.115, 0.014, 10, { y: 0.574, color: STEEL_D });
      b.cyl(0.062, 0.078, 0.06, 8, { y: 0.606, color: STEEL });
      b.ball(0.022, 0, { y: 0.64, color: STEEL_D });
      arms(b, P, R, { sleeve: PAD, fore: PAD, hand: LEATHER, pad: 'team', padR: 0.048, cuff: LEATHER });
      b.part = P.handR;
      const h = [R.armX, R.handY, 0.012], a = 0.14;
      rod(b, along(h, a, -0.215), along(h, a, 0.74), 0.012, 0.011, 6, { color: '#8a6440' });
      b.cyl(0.016, 0.016, 0.03, 6, { ...xyz(along(h, a, 0.745)), rx: a, color: STEEL_D });
      rod(b, along(h, a, 0.75), along(h, a, 0.87), 0.024, 0.0, 4, { color: BLADE });
      const fp = along(h, a, 0.68);
      b.box(0.004, 0.06, 0.12, { x: fp[0], y: fp[1], z: fp[2] - 0.05, rx: a, color: 'team', flag: (x, y, z) => Math.max(0, fp[2] - z) * 5 });
      b.cone(0.012, 0.03, 4, { ...xyz(along(h, a, -0.23)), rx: a + PI, color: STEEL_D });
    },
  },

  human_ranged: {
    skeleton: 'humanoid', pivots: piv(HU), anim: { attack: 'bow', hold: 'bow', height: 0.62 },
    pose: nockFix,
    build(b, P) {
      const R = HU, JERK = '#7a5636';
      legs(b, P, R, '#5d6640', '#5a3e26', { bootH: 0.1, cuff: '#6b4a2c' });
      b.part = P.body;
      b.cyl(0.098, 0.118, 0.12, 8, { y: 0.27, color: 'team', teamShade: 0.85 });
      b.box(0.18, 0.17, 0.112, { y: 0.37, color: JERK });
      b.box(0.04, 0.17, 0.004, { y: 0.37, z: 0.057, color: shade(JERK, -0.1) });
      b.box(0.19, 0.026, 0.124, { y: 0.29, color: LEATHER_D });
      b.box(0.02, 0.07, 0.022, { x: 0.075, y: 0.25, z: 0.06, rz: 0.2, color: STEEL_D });
      b.cyl(0.066, 0.112, 0.06, 8, { y: 0.44, color: 'team' });
      b.box(0.022, 0.2, 0.124, { y: 0.37, rz: -0.75, color: LEATHER_D });
      b.part = P.back;
      quiver(b, [0.04, 0.39, -0.085], { rz: -0.45, color: '#7a4e2c' });
      b.part = P.head;
      headHuman(b, R, { hair: '#7a4a2a' });
      b.ball(0.08, 1, { y: R.headY + 0.012, z: -0.032, color: 'team', teamShade: 0.92 });
      b.cone(0.034, 0.1, 5, { y: R.headY + 0.0, z: -0.12, rx: -2.1, color: 'team', teamShade: 0.92 });
      arms(b, P, R, { sleeve: '#8a6a44', fore: '#8a6a44', hand: LEATHER, pad: 'team', padR: 0.046, padTs: 0.92 });
      b.part = P.armL; b.box(0.06, 0.07, 0.064, { x: -R.armX, y: 0.28, color: LEATHER_D });
      b.part = P.handL;
      const c = [-R.armX - 0.004, R.handY, 0.03];
      bow(b, c, 0.46, { wood: '#8a5a30', r: 0.011, curve: 0.12 });
      nocked(b, P, c);
    },
  },

  human_cav: {
    skeleton: 'rider',
    anim: { walk: 'gallop', riderAttack: 'thrust', attack: 'none', stride: 0.6, size: 1.2 },
    pivots: {
      body: [0, 0.37, 0], head: [0, 0.46, 0.2], tail: [0, 0.43, -0.22], extra: [0, 0.37, 0],
      legFL: [-0.065, 0.31, 0.15], legFR: [0.065, 0.31, 0.15], legBL: [-0.065, 0.31, -0.16], legBR: [0.065, 0.31, -0.16],
      rBody: [0, 0.48, -0.03], rHead: [0, 0.665, -0.03], rArmL: [-0.1, 0.625, -0.03], rArmR: [0.1, 0.625, -0.03], rHandL: [-0.118, 0.46, -0.01], rHandR: [0.118, 0.46, -0.01], rCape: [0, 0.64, -0.09],
    },
    pose: thrustFix([[0, 0], [0.3, -0.12], [0.48, 0.1], [0.62, 0.08], [1, 0]], true),
    build(b, P) {
      const HORSE = '#7a4e30', MANE = '#3a2618', HOOF = '#2e241c';
      b.part = P.body;
      b.blob(0.1, 0.105, 0.245, 1, { y: 0.38, color: HORSE });
      b.blob(0.09, 0.1, 0.085, 1, { y: 0.39, z: 0.17, color: HORSE });
      b.blob(0.092, 0.095, 0.08, 1, { y: 0.4, z: -0.17, color: shade(HORSE, 0.02) });
      b.part = P.extra;
      b.box(0.215, 0.135, 0.46, { y: 0.32, color: 'team' });
      b.box(0.22, 0.024, 0.465, { y: 0.258, color: GOLD });
      b.box(0.2, 0.02, 0.4, { y: 0.39, color: 'team', teamShade: 0.8 });
      for (const s of [-1, 1]) b.box(0.006, 0.07, 0.07, { x: s * 0.11, y: 0.33, z: 0.0, color: CLOTH });
      for (const s of [-1, 1]) b.box(0.006, 0.026, 0.07, { x: s * 0.111, y: 0.335, z: 0.0, rx: PI / 2, color: CLOTH });
      b.box(0.15, 0.04, 0.14, { y: 0.47, z: -0.03, color: '#5a3a22' });
      b.box(0.15, 0.085, 0.03, { y: 0.48, z: 0.045, color: '#5a3a22' });
      b.box(0.15, 0.07, 0.03, { y: 0.48, z: -0.105, color: '#5a3a22' });
      b.part = P.head;
      b.box(0.08, 0.22, 0.105, { y: 0.52, z: 0.25, rx: 0.5, color: HORSE });
      b.box(0.084, 0.16, 0.08, { y: 0.53, z: 0.23, rx: 0.5, color: 'team', teamShade: 0.85 });
      b.box(0.03, 0.2, 0.05, { y: 0.56, z: 0.21, rx: 0.5, color: MANE });
      b.box(0.078, 0.085, 0.185, { y: 0.6, z: 0.345, rx: 0.75, color: HORSE });
      b.box(0.084, 0.05, 0.13, { y: 0.63, z: 0.33, rx: 0.75, color: STEEL });
      b.box(0.02, 0.07, 0.03, { y: 0.69, z: 0.29, rx: -0.2, color: 'team' });
      for (const s of [-1, 1]) {
        b.cone(0.016, 0.05, 4, { x: s * 0.026, y: 0.676, z: 0.27, color: HORSE });
        b.box(0.008, 0.012, 0.012, { x: s * 0.04, y: 0.625, z: 0.38, color: '#141010' });
      }
      for (const [l, x, z] of [['legFL', -0.065, 0.15], ['legFR', 0.065, 0.15], ['legBL', -0.065, -0.16], ['legBR', 0.065, -0.16]]) {
        b.part = P[l];
        b.box(0.05, 0.2, 0.058, { x, y: 0.215, z, color: HORSE });
        b.box(0.04, 0.11, 0.046, { x, y: 0.075, z, color: HORSE });
        b.box(0.05, 0.036, 0.06, { x, y: 0.018, z: z + 0.005, color: HOOF });
      }
      b.part = P.tail; b.box(0.04, 0.22, 0.045, { y: 0.34, z: -0.27, rx: -0.35, color: MANE });
      // ---- jinete
      b.part = P.rBody;
      for (const s of [-1, 1]) {
        b.box(0.06, 0.06, 0.15, { x: 0.096 * s, y: 0.48, z: 0.0, color: MAIL });
        b.box(0.055, 0.15, 0.06, { x: 0.112 * s, y: 0.39, z: 0.06, color: STEEL });
        b.box(0.062, 0.04, 0.088, { x: 0.112 * s, y: 0.31, z: 0.07, color: BOOT });
      }
      b.box(0.18, 0.17, 0.11, { y: 0.57, z: -0.03, color: MAIL });
      b.box(0.142, 0.22, 0.124, { y: 0.55, z: -0.03, color: 'team' });
      b.box(0.028, 0.15, 0.004, { y: 0.565, z: 0.033, color: GOLD });
      b.box(0.1, 0.026, 0.004, { y: 0.6, z: 0.033, color: GOLD });
      b.box(0.186, 0.026, 0.128, { y: 0.48, z: -0.03, color: '#5a3a22' });
      b.cyl(0.058, 0.07, 0.04, 8, { y: 0.66, z: -0.03, color: MAIL });
      b.part = P.rHead;
      b.cyl(0.068, 0.07, 0.11, 8, { y: 0.72, z: -0.03, color: STEEL });
      b.cone(0.068, 0.045, 8, { y: 0.797, z: -0.03, color: STEEL });
      b.box(0.1, 0.012, 0.01, { y: 0.73, z: 0.04, color: '#1e1a1e' });
      b.box(0.012, 0.05, 0.01, { y: 0.71, z: 0.04, color: '#1e1a1e' });
      b.cyl(0.072, 0.072, 0.014, 8, { y: 0.775, z: -0.03, color: GOLD });
      b.box(0.024, 0.1, 0.15, { y: 0.84, z: -0.055, color: 'team', flag: (x, y, z) => Math.max(0, -0.02 - z) * 3 });
      for (const [p, s] of [[P.rArmL, -1], [P.rArmR, 1]]) {
        b.part = p;
        b.ball(0.048, 0, { x: 0.116 * s, y: 0.625, z: -0.03, sy: 0.8, color: STEEL });
        b.box(0.05, 0.17, 0.055, { x: 0.116 * s, y: 0.54, z: -0.03, color: MAIL });
        b.box(0.05, 0.05, 0.055, { x: 0.118 * s, y: 0.46, z: -0.02, color: LEATHER });
      }
      b.part = P.rHandR;
      const h = [0.118, 0.46, -0.01], rx = 1.32;
      let q = along(h, rx, 0.24); b.cyl(0.012, 0.017, 0.82, 6, { ...xyz(q), rx, color: '#8a6440' });
      q = along(h, rx, 0.06); b.cone(0.042, 0.085, 7, { ...xyz(q), rx, color: STEEL });
      for (let i = 0; i < 2; i++) { q = along(h, rx, 0.18 + i * 0.16); b.cyl(0.016, 0.016, 0.03, 6, { ...xyz(q), rx, color: 'team' }); }
      q = along(h, rx, 0.68); b.cone(0.017, 0.08, 5, { ...xyz(q), rx, color: BLADE });
      q = along(h, rx, 0.54); b.box(0.004, 0.055, 0.1, { x: q[0], y: q[1] + 0.035, z: q[2] - 0.035, color: 'team', flag: (x, y, z) => Math.max(0, q[2] - z) * 6 });
      b.part = P.rHandL;
      heaterShield(b, [-0.162, 0.53, 0.02], -0.7, 0.95);
    },
  },

  human_special: {
    skeleton: 'humanoid', pivots: piv(HU), anim: { attack: 'cast', hold: 'staff', height: 0.62 },
    pose: castFix,
    build(b, P) {
      const R = HU, BEARD = '#ece8de', TRIM = '#e9d27a';
      legs(b, P, R, '#4a3a5a', '#3e2c1e', { bootH: 0.06 });
      b.part = P.body;
      b.cyl(0.098, 0.15, 0.2, 8, { y: 0.165, color: 'team', teamShade: 0.85 });
      b.cyl(0.152, 0.152, 0.02, 8, { y: 0.068, color: TRIM });
      b.cyl(0.085, 0.1, 0.19, 8, { y: 0.355, color: 'team' });
      b.box(0.04, 0.39, 0.012, { y: 0.255, z: 0.098, rx: -0.12, color: CLOTH });
      b.cyl(0.104, 0.104, 0.03, 8, { y: 0.29, color: TRIM });
      b.cyl(0.07, 0.12, 0.06, 8, { y: 0.445, color: 'team', teamShade: 0.75 });
      b.box(0.03, 0.04, 0.03, { x: -0.07, y: 0.24, z: 0.08, color: '#6b4a8a' });
      b.part = P.head;
      headHuman(b, R, {});
      b.blob(0.058, 0.04, 0.04, 1, { y: R.headY - 0.04, z: 0.04, color: BEARD });
      b.cone(0.05, 0.15, 6, { y: R.headY - 0.11, z: 0.058, rx: PI - 0.15, sz: 0.6, color: BEARD });
      b.box(0.06, 0.014, 0.018, { y: R.headY - 0.02, z: 0.067, color: BEARD });
      b.box(0.052, 0.012, 0.012, { y: R.headY + 0.03, z: 0.06, color: BEARD });
      b.cyl(0.125, 0.125, 0.016, 10, { y: R.headY + 0.05, color: 'team', teamShade: 0.75 });
      b.cyl(0.074, 0.074, 0.03, 8, { y: R.headY + 0.068, color: TRIM });
      b.cone(0.074, 0.16, 8, { y: R.headY + 0.16, z: -0.008, rx: -0.12, color: 'team' });
      b.cone(0.03, 0.08, 6, { y: R.headY + 0.255, z: -0.05, rx: -0.9, color: 'team' });
      b.ball(0.016, 0, { x: 0.035, y: R.headY + 0.13, z: 0.05, color: '#fff2a0', glow: 0.8 });
      for (const [p, s] of [[P.armL, -1], [P.armR, 1]]) {
        b.part = p;
        b.box(R.armW, 0.11, R.armW, { x: R.armX * s, y: 0.38, color: 'team' });
        b.cyl(0.032, 0.05, 0.11, 7, { x: R.armX * s, y: 0.285, color: 'team', teamShade: 0.9 });
        b.cyl(0.052, 0.052, 0.016, 7, { x: R.armX * s, y: 0.232, color: TRIM });
        b.box(0.045, 0.045, 0.048, { x: R.armX * s, y: 0.214, color: R.skin });
      }
      b.part = P.handR;
      const h = [R.armX, 0.214, 0.03];
      rod(b, [h[0], 0.01, h[2]], [h[0], 0.66, h[2]], 0.012, 0.014, 6, { color: '#6a4a2a' });
      for (const a of [0, 2.1, 4.2]) rod(b, [h[0], 0.64, h[2]], [h[0] + Math.cos(a) * 0.04, 0.72, h[2] + Math.sin(a) * 0.04], 0.009, 0.004, 4, { color: GOLD });
      b.ball(0.04, 1, { x: h[0], y: 0.715, z: h[2], color: '#8fe8ff', glow: 1 });
      b.torus(0.06, 0.006, 10, 3, { x: h[0], y: 0.715, z: h[2], rx: 1.2, color: '#c8f6ff', glow: 0.8, spin: { c: [h[0], 0.715, h[2]], axis: [0.2, 1, 0.3], speed: 2.5 } });
    },
  },

  human_siege: {
    skeleton: 'siege', anim: { attack: 'catapult', wheelTurns: 0.7 },
    pivots: {
      body: [0, 0.2, 0], wheelFL: [-0.25, 0.11, 0.24], wheelFR: [0.25, 0.11, 0.24], wheelBL: [-0.25, 0.11, -0.24], wheelBR: [0.25, 0.11, -0.24],
      arm: [0, 0.235, -0.04], arm2: [0, 0.235, -0.04], crewL: [-0.22, 0, -0.48], crewR: [0.22, 0, -0.48],
    },
    pose(P, st) {
      if (!atk(st)) return;
      const k = st.k, e = track(k, [[0, 0], [0.42, 0], [0.5, -1.9], [0.6, -1.75], [1, 0]]), w = track(k, [[0, 0], [0.42, 0], [0.5, 1.52], [0.6, 1.42], [1, 0]]);
      P.r('arm', w - e, 0, 0); P.r('arm2', w, 0, 0);
      if (k > 0.49 && k < 0.9) P.s('arm2', 0);
    },
    build(b, P) {
      const FR = '#8a6440', FR_D = '#6a4a2c';
      b.part = P.body;
      for (const s of [-1, 1]) {
        b.box(0.055, 0.065, 0.78, { x: s * 0.175, y: 0.19, color: FR });
        b.box(0.012, 0.05, 0.6, { x: s * 0.206, y: 0.19, color: 'team' });
        rod(b, [s * 0.175, 0.22, 0.12], [s * 0.15, 0.53, 0.06], 0.022, 0.02, 6, { color: FR });
        rod(b, [s * 0.175, 0.22, -0.12], [s * 0.15, 0.48, 0.05], 0.018, 0.018, 6, { color: FR_D });
        b.cyl(0.02, 0.02, 0.07, 6, { x: s * 0.215, y: 0.11, z: 0.24, rz: PI / 2, color: IRON });
        b.cyl(0.02, 0.02, 0.07, 6, { x: s * 0.215, y: 0.11, z: -0.24, rz: PI / 2, color: IRON });
      }
      for (const z of [0.36, -0.36, 0.13, -0.2]) b.box(0.4, 0.05, 0.05, { y: 0.19, z, color: FR_D });
      b.box(0.3, 0.03, 0.3, { y: 0.17, z: -0.04, color: shade(FR, -0.05) });
      b.box(0.36, 0.055, 0.06, { y: 0.53, z: 0.07, color: FR });
      b.box(0.2, 0.06, 0.05, { y: 0.53, z: 0.035, color: 'team' });
      b.cyl(0.05, 0.05, 0.3, 8, { y: 0.235, z: -0.04, rz: PI / 2, color: ROPE });
      b.cyl(0.04, 0.04, 0.3, 7, { y: 0.24, z: -0.3, rz: PI / 2, color: FR_D });
      for (const s of [-1, 1]) { b.box(0.012, 0.16, 0.025, { x: s * 0.16, y: 0.24, z: -0.3, color: IRON }); b.box(0.012, 0.025, 0.16, { x: s * 0.16, y: 0.24, z: -0.3, color: IRON }); }
      rod(b, [0, 0.27, -0.3], [0, 0.29, -0.4], 0.008, 0.008, 4, { color: ROPE });
      rod(b, [-0.175, 0.22, 0.36], [-0.175, 0.72, 0.36], 0.01, 0.01, 5, { color: WOOD_D });
      b.box(0.006, 0.1, 0.16, { x: -0.175, y: 0.66, z: 0.28, color: 'team', flag: (x, y, z) => Math.max(0, 0.36 - z) * 5 });
      for (const [w, x, z] of [['wheelFL', -0.25, 0.24], ['wheelFR', 0.25, 0.24], ['wheelBL', -0.25, -0.24], ['wheelBR', 0.25, -0.24]]) { b.part = P[w]; wheel(b, [x, 0.11, z], 0.11); }
      // brazo amartillado: apunta atrás y algo arriba; el cazo en la punta
      b.part = P.arm;
      const piv0 = [0, 0.235, -0.04], aa = -PI / 2 + 0.2, tip = along(piv0, aa, 0.4);
      rod(b, along(piv0, aa, -0.04), tip, 0.03, 0.022, 6, { color: '#9a7046' });
      for (const d of [0.12, 0.26]) b.cyl(0.032, 0.032, 0.02, 6, { ...xyz(along(piv0, aa, d)), rx: aa, color: IRON });
      b.lathe([[0.0, 0.0], [0.05, 0.005], [0.07, 0.035], [0.072, 0.05]], 8, { x: tip[0], y: tip[1] + 0.005, z: tip[2], color: WOOD_D });
      b.part = P.arm2;
      b.ball(0.055, 0, { x: tip[0], y: tip[1] + 0.06, z: tip[2], color: '#9a958c' });
      b.part = P.crewL; crewman(b, -0.22, -0.48, { hat: '#8d6e48' });
      b.part = P.crewR; crewman(b, 0.22, -0.48, { hat: STEEL });
    },
  },

  human_general: {
    skeleton: 'humanoid', pivots: piv(HU), scale: 1.15, anim: { attack: 'swing', hold: 'sword', height: 0.62 },
    build(b, P) {
      const R = HU, PLATE = '#b8c0ca';
      legs(b, P, R, PLATE, STEEL_D, { cuff: GOLD, knee: GOLD });
      b.part = P.body;
      b.cyl(0.104, 0.128, 0.12, 8, { y: 0.27, color: STEEL });
      b.box(0.196, 0.17, 0.12, { y: 0.37, color: PLATE });
      b.blob(0.085, 0.07, 0.04, 1, { y: 0.39, z: 0.05, color: PLATE });
      b.box(0.15, 0.31, 0.136, { y: 0.3, color: 'team' });
      b.box(0.154, 0.018, 0.14, { y: 0.155, color: GOLD });
      for (const s of [-1, 1]) b.box(0.012, 0.3, 0.14, { x: s * 0.072, y: 0.3, color: GOLD });
      b.extrude([[0, 0.05], [0.035, 0.02], [0.03, -0.035], [0, -0.055], [-0.03, -0.035], [-0.035, 0.02]], 0.01, { y: 0.37, z: 0.07, color: GOLD });
      b.box(0.206, 0.032, 0.142, { y: 0.258, color: '#5a3a22' });
      b.box(0.04, 0.03, 0.02, { y: 0.258, z: 0.072, color: GOLD });
      b.cyl(0.062, 0.078, 0.05, 8, { y: 0.455, color: STEEL });
      b.part = P.cape;
      b.box(0.2, 0.4, 0.018, { y: 0.255, z: -0.085, rx: 0.1, color: 'team', teamShade: 0.82, flag: (x, y) => Math.max(0, 0.42 - y) * 2.2 });
      b.box(0.21, 0.04, 0.05, { y: 0.45, z: -0.07, color: CLOTH });
      b.part = P.head;
      headHuman(b, R, { beard: '#7a4a2a', hair: '#7a4a2a' });
      b.cyl(0.066, 0.064, 0.026, 8, { y: 0.582, color: GOLD });
      for (let i = 0; i < 5; i++) { const a = i / 5 * 2 * PI; b.cone(0.014, 0.034, 4, { x: Math.sin(a) * 0.058, y: 0.61, z: Math.cos(a) * 0.058, color: GOLD }); }
      b.ball(0.011, 0, { y: 0.582, z: 0.066, color: '#e03a3a', glow: 0.6 });
      arms(b, P, R, { sleeve: PLATE, hand: STEEL_D, cuff: GOLD });
      for (const [p, s] of [[P.armL, -1], [P.armR, 1]]) { b.part = p; b.blob(0.054, 0.04, 0.06, 1, { x: 0.124 * s, y: 0.432, color: PLATE }); b.box(0.016, 0.03, 0.11, { x: 0.172 * s, y: 0.41, rz: s * 0.4, color: GOLD }); }
      b.part = P.handR;
      const h = H_R(R), rx = 0.72;
      b.cyl(0.013, 0.013, 0.09, 6, { ...xyz(along(h, rx, 0.0)), rx, color: LEATHER });
      let q = along(h, rx, 0.055); b.box(0.13, 0.022, 0.03, { ...xyz(q), rx, color: GOLD });
      q = along(h, rx, 0.25); b.box(0.042, 0.36, 0.013, { ...xyz(q), rx, color: '#e2e8ee', glow: 0.18 });
      q = along(h, rx, 0.25); b.box(0.008, 0.33, 0.016, { ...xyz(q), rx, color: '#9aa6b4' });
      q = along(h, rx, 0.45); b.cone(0.03, 0.06, 4, { ...xyz(q), rx, ry: PI / 4, sz: 0.4, color: '#e2e8ee', glow: 0.18 });
      q = along(h, rx, -0.058); b.ball(0.02, 0, { ...xyz(q), color: GOLD });
    },
  },
  // ================================================================== ELFOS
  elf_worker: {
    skeleton: 'humanoid', pivots: piv(EL), anim: { attack: 'swing', hold: 'none', height: 0.68, stride: 0.5 },
    build(b, P) {
      const R = EL, HAIR = '#e8d08a';
      legs(b, P, R, '#6d7a48', '#6a4a2c', { bootH: 0.1, cuff: E_WOOD_L });
      b.part = P.body;
      b.box(0.146, 0.15, 0.094, { y: 0.43, color: 'team' });
      b.cyl(0.078, 0.1, 0.15, 8, { y: 0.305, color: 'team', teamShade: 0.82 });
      b.box(0.156, 0.024, 0.104, { y: 0.37, color: E_WOOD });
      b.box(0.022, 0.032, 0.01, { y: 0.37, z: 0.056, rz: PI / 4, color: LEAF_L });
      b.box(0.05, 0.055, 0.03, { x: -0.05, y: 0.33, z: -0.062, color: E_WOOD_L });
      b.cyl(0.058, 0.09, 0.04, 8, { y: 0.495, color: LEAF });
      b.part = P.head;
      headElf(b, R, { hair: HAIR });
      b.torus(0.062, 0.008, 10, 3, { y: R.headY + 0.03, rx: PI / 2 - 0.15, color: LEAF_L });
      arms(b, P, R, { sleeve: 'team', ts: 0.9, fore: R.skin, cuff: LEAF });
      workerTools(b, P, H_R(R), H_L(R), { wood: E_WOOD_L, metal: '#c9d2c8', basket: '#c8a86a' });
      workerCarry(b, P, [0.43, -0.05]);
    },
  },

  elf_inf: {
    skeleton: 'humanoid', pivots: piv(EL), anim: { attack: 'swing', hold: 'sword', height: 0.68 },
    build(b, P) {
      const R = EL, HAIR = '#ece8dc';
      legs(b, P, R, '#4f6a3e', '#5a4a32', { bootH: 0.11, cuff: E_GOLD });
      b.part = P.body;
      b.box(0.146, 0.15, 0.094, { y: 0.43, color: LEAF });
      for (const [x, y, c] of [[-0.036, 0.468, LEAF_L], [0.036, 0.468, LEAF_L], [-0.03, 0.41, shade(LEAF_L, -0.06)], [0.03, 0.41, shade(LEAF_L, -0.06)]])
        b.blob(0.04, 0.03, 0.016, 0, { x, y, z: 0.046, rz: x > 0 ? -0.5 : 0.5, color: c });
      b.box(0.034, 0.2, 0.104, { y: 0.43, rz: 0.62, color: 'team' });
      b.cyl(0.08, 0.102, 0.13, 6, { y: 0.31, color: 'team', teamShade: 0.85 });
      for (const sd of [-1, 1]) b.extrude([[0, 0], [0.03, -0.04], [0.02, -0.12], [0, -0.16], [-0.02, -0.12], [-0.03, -0.04]], 0.012, { x: sd * 0.045, y: 0.37, z: 0.095, color: 'team' });
      b.box(0.156, 0.022, 0.104, { y: 0.37, color: E_GOLD });
      b.cyl(0.055, 0.07, 0.03, 8, { y: 0.505, color: LEAF });
      b.part = P.head;
      headElf(b, R, { hair: HAIR, long: 0.08 });
      rod(b, [0, R.headY + 0.04, -0.06], [0, R.headY - 0.13, -0.13], 0.022, 0.012, 5, { color: HAIR });
      b.torus(0.062, 0.009, 10, 3, { y: R.headY + 0.022, rx: PI / 2, color: 'team' });
      arms(b, P, R, { sleeve: LEAF_L, fore: R.skin, cuff: E_GOLD, pad: LEAF, padR: 0.042 });
      for (const [p, sd] of [[P.handR, 1], [P.handL, -1]]) {
        b.part = p; const h = [R.armX * sd, R.handY, 0], a = 0.72;
        b.cyl(0.011, 0.011, 0.06, 6, { ...xyz(h), rx: a, color: E_WOOD });
        b.box(0.06, 0.014, 0.022, { ...xyz(along(h, a, 0.036)), rx: a, color: E_GOLD });
        curvedBlade(b, along(h, a, 0.04), a, 0.27, { curve: 0.065, color: '#e4ecf2' });
        b.ball(0.013, 0, { ...xyz(along(h, a, -0.04)), color: CRYSTAL, glow: 0.6 });
      }
    },
  },

  elf_pike: {
    skeleton: 'humanoid', pivots: piv(EL), anim: { attack: 'thrust', hold: 'spear', height: 0.68 },
    pose: thrustFix(PIKE_WANT),
    build(b, P) {
      const R = EL, ARM = '#6f8f5a';
      legs(b, P, R, '#56704a', '#7a6a48', { bootH: 0.12, cuff: E_GOLD, knee: E_GOLD });
      b.part = P.body;
      b.box(0.15, 0.15, 0.098, { y: 0.43, color: ARM });
      b.cyl(0.082, 0.102, 0.13, 8, { y: 0.31, color: shade(ARM, -0.06) });
      b.box(0.11, 0.3, 0.108, { y: 0.34, color: 'team' });
      for (const sd of [-1, 1]) b.box(0.012, 0.3, 0.112, { x: sd * 0.05, y: 0.34, color: E_GOLD });
      b.box(0.034, 0.034, 0.006, { y: 0.43, z: 0.056, rz: PI / 4, color: E_GOLD });
      b.box(0.16, 0.022, 0.112, { y: 0.37, color: E_WOOD });
      b.cyl(0.055, 0.07, 0.03, 8, { y: 0.505, color: E_GOLD });
      b.part = P.cape;
      b.box(0.15, 0.3, 0.014, { y: 0.345, z: -0.064, rx: 0.08, color: 'team', teamShade: 0.85, flag: (x, y) => Math.max(0, 0.48 - y) * 2.4 });
      b.part = P.head;
      headElf(b, R, { hair: '#d8c070', long: 0.1 });
      b.cyl(0.065, 0.067, 0.04, 8, { y: R.headY + 0.032, color: E_GOLD });
      helm(b, R.headY + 0.05, 0.066, 0.08, shade(E_GOLD, 0.05));
      b.extrude([[0.07, 0], [0.03, 0.05], [-0.04, 0.09], [-0.09, 0.07], [-0.05, 0.015]], 0.012, { y: R.headY + 0.09, z: 0.0, ry: PI / 2, color: 'team' });
      for (const sd of [-1, 1]) b.box(0.012, 0.055, 0.04, { x: sd * 0.062, y: R.headY - 0.012, z: 0.022, color: E_GOLD });
      arms(b, P, R, { sleeve: ARM, fore: ARM, hand: E_WOOD, cuff: E_GOLD, pad: 'team', padR: 0.044 });
      b.part = P.handR;
      const h = [R.armX, R.handY, 0.014], a = 0.13;
      rod(b, along(h, a, -0.25), along(h, a, 0.56), 0.011, 0.01, 6, { color: E_WOOD_L });
      b.cyl(0.016, 0.014, 0.04, 6, { ...xyz(along(h, a, 0.56)), rx: a, color: E_GOLD });
      curvedBlade(b, along(h, a, 0.575), a, 0.2, { w: 0.038, curve: 0.05, color: '#e4ecf2' });
      b.cone(0.012, 0.03, 4, { ...xyz(along(h, a, -0.265)), rx: a + PI, color: E_GOLD });
      const tp = along(h, a, 0.52);
      b.box(0.004, 0.08, 0.04, { x: tp[0], y: tp[1] - 0.04, z: tp[2] - 0.022, color: 'team', flag: (x, y) => Math.max(0, tp[1] - y) * 4 });
      b.part = P.handL;
      leafShield(b, [-0.152, 0.31, 0.045], -0.55, 1.0);
    },
  },

  elf_ranged: {
    skeleton: 'humanoid', pivots: piv(EL), anim: { attack: 'bow', hold: 'bow', height: 0.68 }, pose: nockFix,
    build(b, P) {
      const R = EL, VEST = '#6e6a3a';
      legs(b, P, R, '#5a6a40', '#6a4a2c', { bootH: 0.13, cuff: E_GOLD });
      b.part = P.body;
      b.box(0.146, 0.15, 0.094, { y: 0.43, color: VEST });
      b.cyl(0.078, 0.098, 0.13, 8, { y: 0.31, color: 'team', teamShade: 0.85 });
      b.box(0.156, 0.022, 0.104, { y: 0.37, color: E_WOOD });
      b.box(0.02, 0.15, 0.104, { y: 0.43, rz: -0.6, color: E_WOOD });
      b.cyl(0.06, 0.1, 0.05, 8, { y: 0.49, color: 'team' });
      b.box(0.022, 0.022, 0.012, { y: 0.476, z: 0.08, rz: PI / 4, color: E_GOLD });
      b.part = P.cape;
      b.box(0.15, 0.32, 0.014, { y: 0.33, z: -0.064, rx: 0.08, color: 'team', teamShade: 0.88, flag: (x, y) => Math.max(0, 0.48 - y) * 2.4 });
      b.part = P.back;
      quiver(b, [0.05, 0.44, -0.088], { rz: -0.4, color: E_WOOD, rim: E_GOLD, fl: LEAF_L, fl2: E_WHITE, len: 0.21, r: 0.03 });
      b.part = P.head;
      headElf(b, R, { hair: '#e8d08a', long: false });
      b.ball(0.072, 1, { y: R.headY + 0.012, z: -0.03, sy: 1.08, color: 'team' });
      b.cone(0.03, 0.1, 5, { y: R.headY + 0.005, z: -0.115, rx: -2.0, color: 'team' });
      arms(b, P, R, { sleeve: VEST, fore: VEST, hand: E_WOOD, cuff: E_GOLD });
      b.part = P.armL; b.box(0.052, 0.07, 0.056, { x: -R.armX, y: 0.31, color: E_WOOD });
      b.part = P.handL;
      const c = [-R.armX - 0.004, R.handY + 0.01, 0.03];
      bow(b, c, 0.5, { wood: E_WOOD_L, r: 0.011, curve: 0.13, tips: E_GOLD });
      nocked(b, P, c, { shaft: E_WOOD_L });
    },
  },

  elf_cav: {
    skeleton: 'rider',
    anim: { walk: 'gallop', attack: 'none', riderAttack: 'bow', stride: 0.62, size: 1.2 },
    pivots: {
      body: [0, 0.41, 0], head: [0, 0.48, 0.19], tail: [0, 0.46, -0.23], extra: [0, 0.41, 0],
      legFL: [-0.058, 0.37, 0.15], legFR: [0.058, 0.37, 0.15], legBL: [-0.058, 0.37, -0.15], legBR: [0.058, 0.37, -0.15],
      rBody: [0, 0.5, 0], rHead: [0, 0.72, 0], rArmL: [-0.094, 0.691, 0], rArmR: [0.094, 0.691, 0], rHandL: [-0.11, 0.483, 0], rHandR: [0.11, 0.483, 0], rCape: [0, 0.705, -0.055],
    },
    build(b, P) {
      const STAG = '#b07a48', BELLY = '#ecdcc0', DARK = '#4e3626', ANT = '#e6d8b8';
      b.part = P.body;
      b.blob(0.088, 0.096, 0.235, 1, { y: 0.42, color: STAG });
      b.blob(0.082, 0.095, 0.08, 1, { y: 0.43, z: 0.165, color: STAG });
      b.blob(0.084, 0.09, 0.08, 1, { y: 0.44, z: -0.165, color: shade(STAG, 0.03) });
      b.blob(0.07, 0.05, 0.17, 0, { y: 0.36, color: BELLY });
      b.part = P.extra;
      b.box(0.19, 0.12, 0.25, { y: 0.445, z: -0.02, color: 'team' });
      b.box(0.196, 0.018, 0.256, { y: 0.388, z: -0.02, color: E_GOLD });
      for (const sd of [-1, 1]) b.extrude([[0, 0.03], [0.03, 0], [0, -0.04], [-0.03, 0]], 0.008, { x: sd * 0.098, y: 0.44, z: -0.02, ry: PI / 2, color: E_GOLD });
      b.box(0.13, 0.035, 0.13, { y: 0.51, z: -0.02, color: E_WOOD });
      b.box(0.13, 0.06, 0.025, { y: 0.52, z: 0.05, color: E_WOOD });
      b.box(0.17, 0.022, 0.03, { y: 0.45, z: 0.22, rx: -0.3, color: E_WOOD });
      b.ball(0.02, 0, { y: 0.45, z: 0.245, color: CRYSTAL, glow: 0.8 });
      b.part = P.head;
      bar(b, [0, 0.43, 0.16], [0, 0.62, 0.26], 0.07, 0.085, { color: STAG });
      bar(b, [0, 0.44, 0.2], [0, 0.6, 0.285], 0.05, 0.03, { color: BELLY });
      b.blob(0.046, 0.046, 0.07, 1, { y: 0.655, z: 0.305, rx: 0.5, color: STAG });
      b.box(0.042, 0.04, 0.06, { y: 0.63, z: 0.365, rx: 0.5, color: shade(STAG, -0.08) });
      b.box(0.03, 0.022, 0.02, { y: 0.62, z: 0.395, rx: 0.5, color: DARK });
      for (const sd of [-1, 1]) {
        b.cone(0.02, 0.06, 4, { x: sd * 0.06, y: 0.68, z: 0.27, rz: -sd * 1.2, color: STAG });
        b.box(0.01, 0.012, 0.012, { x: sd * 0.038, y: 0.665, z: 0.335, color: '#141010' });
        const p0 = [sd * 0.025, 0.69, 0.28], p1 = [sd * 0.07, 0.77, 0.25], p2 = [sd * 0.12, 0.85, 0.22], p3 = [sd * 0.14, 0.94, 0.17];
        rod(b, p0, p1, 0.014, 0.012, 5, { color: ANT });
        rod(b, p1, p2, 0.012, 0.01, 5, { color: ANT });
        rod(b, p2, p3, 0.01, 0.007, 5, { color: ANT });
        rod(b, p1, [sd * 0.075, 0.82, 0.32], 0.009, 0.004, 4, { color: ANT });
        rod(b, p2, [sd * 0.155, 0.9, 0.29], 0.008, 0.004, 4, { color: ANT });
        rod(b, p3, [sd * 0.19, 0.97, 0.13], 0.007, 0.003, 4, { color: ANT });
      }
      for (const [l, x, z] of [['legFL', -0.058, 0.15], ['legFR', 0.058, 0.15], ['legBL', -0.058, -0.15], ['legBR', 0.058, -0.15]]) {
        b.part = P[l];
        b.box(0.042, 0.21, 0.052, { x, y: 0.275, z, color: STAG });
        b.box(0.03, 0.16, 0.036, { x, y: 0.1, z, color: shade(STAG, -0.05) });
        b.box(0.036, 0.03, 0.046, { x, y: 0.015, z: z + 0.004, color: DARK });
      }
      b.part = P.tail; b.blob(0.026, 0.04, 0.02, 0, { y: 0.45, z: -0.25, rx: -0.4, color: BELLY });
      // ---- jinete élfico
      const R = lift(EL, 0.215), VEST = '#6e6a3a';
      b.part = P.rBody;
      riderLegs(b, 0.5, -0.02, 0.1, { w: 0.05, shin: 0.13, pants: '#5a6a40', boot: '#6a4a2c' });
      b.box(0.14, 0.14, 0.09, { y: 0.645, color: VEST });
      b.cyl(0.074, 0.09, 0.09, 8, { y: 0.545, color: 'team', teamShade: 0.85 });
      b.box(0.15, 0.02, 0.1, { y: 0.585, color: E_WOOD });
      b.cyl(0.058, 0.096, 0.045, 8, { y: 0.7, color: 'team' });
      quiver(b, [0.05, 0.64, -0.08], { rz: -0.4, color: E_WOOD, rim: E_GOLD, fl: LEAF_L, fl2: E_WHITE, len: 0.2, r: 0.028 });
      b.part = P.rCape;
      b.box(0.14, 0.26, 0.014, { y: 0.58, z: -0.07, rx: 0.32, color: 'team', teamShade: 0.88, flag: (x, y) => Math.max(0, 0.7 - y) * 2.5 });
      b.part = P.rHead;
      headElf(b, R, { hair: '#e8d08a', long: false });
      b.ball(0.072, 1, { y: R.headY + 0.012, z: -0.03, sy: 1.08, color: 'team' });
      b.cone(0.03, 0.1, 5, { y: R.headY + 0.005, z: -0.115, rx: -2.0, color: 'team' });
      arms(b, P, R, { rider: true, sleeve: VEST, fore: VEST, hand: E_WOOD, cuff: E_GOLD });
      b.part = P.rHandL;
      bow(b, [-R.armX - 0.004, R.handY + 0.01, 0.0], 0.48, { wood: E_WOOD_L, r: 0.011, curve: 0.13, tips: E_GOLD });
    },
  },

  elf_special: {
    skeleton: 'humanoid', pivots: piv(EL), anim: { attack: 'heal', hold: 'staff', height: 0.68 }, pose: castFix,
    build(b, P) {
      const R = EL, ROBE = '#7a6a48', HAIR = '#e6e2d6', ANT = '#e2d4b4';
      legs(b, P, R, '#5a5040', '#5a4a32', { bootH: 0.06 });
      b.part = P.body;
      b.cyl(0.085, 0.145, 0.24, 8, { y: 0.19, color: ROBE });
      b.cyl(0.147, 0.147, 0.02, 8, { y: 0.075, color: LEAF });
      b.cyl(0.075, 0.088, 0.2, 8, { y: 0.4, color: 'team', teamShade: 0.9 });
      b.cyl(0.06, 0.115, 0.075, 8, { y: 0.47, color: 'team' });
      for (const sd of [-1, 1]) b.box(0.03, 0.3, 0.012, { x: sd * 0.035, y: 0.25, z: 0.104, rx: -0.15, color: 'team', teamShade: 0.75 });
      b.cyl(0.092, 0.092, 0.024, 8, { y: 0.31, color: E_WOOD });
      for (const sd of [-1, 1]) b.blob(0.034, 0.012, 0.044, 0, { x: sd * 0.06, y: 0.505, z: 0.035, ry: sd * 0.6, color: LEAF_L });
      b.part = P.head;
      headElf(b, R, { hair: HAIR, long: 0.2 });
      b.torus(0.063, 0.01, 10, 3, { y: R.headY + 0.03, rx: PI / 2, color: LEAF });
      for (const sd of [-1, 1]) {
        const y = R.headY, p0 = [sd * 0.035, y + 0.05, -0.005], p1 = [sd * 0.08, y + 0.12, -0.02], p2 = [sd * 0.11, y + 0.2, -0.05];
        rod(b, p0, p1, 0.012, 0.01, 5, { color: ANT });
        rod(b, p1, p2, 0.01, 0.006, 5, { color: ANT });
        rod(b, p1, [sd * 0.075, y + 0.17, 0.03], 0.008, 0.003, 4, { color: ANT });
        rod(b, p2, [sd * 0.15, y + 0.22, -0.01], 0.007, 0.003, 4, { color: ANT });
      }
      arms(b, P, R, { sleeve: 'team', ts: 0.9, fore: 'team', hand: R.skin, cuff: LEAF });
      b.part = P.handR;
      const h = [R.armX, R.handY, 0.03], top = [h[0] - 0.005, 0.68, h[2] - 0.005];
      rod(b, [h[0], 0.01, h[2]], [h[0] + 0.012, 0.4, h[2] + 0.012], 0.012, 0.013, 6, { color: '#6a4a2a' });
      rod(b, [h[0] + 0.012, 0.4, h[2] + 0.012], top, 0.013, 0.015, 6, { color: '#6a4a2a' });
      rod(b, top, [h[0] + 0.035, 0.76, h[2]], 0.01, 0.004, 4, { color: '#6a4a2a' });
      rod(b, top, [h[0] - 0.04, 0.765, h[2] + 0.01], 0.01, 0.004, 4, { color: '#6a4a2a' });
      b.blob(0.024, 0.044, 0.024, 0, { x: h[0], y: 0.74, z: h[2], color: CRYSTAL, glow: 1, spin: { c: [h[0], 0.74, h[2]], axis: [0, 1, 0], speed: 1.5 } });
      for (const sd of [-1, 1]) b.blob(0.03, 0.01, 0.017, 0, { x: h[0] + sd * 0.03, y: 0.64, z: h[2], rz: -sd * 0.6, color: LEAF_L });
    },
  },

  elf_siege: {
    skeleton: 'siege', anim: { attack: 'ballista', wheelTurns: 0.7 },
    pivots: {
      body: [0, 0.2, 0], wheelFL: [-0.22, 0.1, 0.2], wheelFR: [0.22, 0.1, 0.2], wheelBL: [-0.22, 0.1, -0.22], wheelBR: [0.22, 0.1, -0.22],
      arm: [0, 0.37, -0.06], arm2: [0, 0.37, -0.06], crewL: [-0.25, 0, -0.42], crewR: [0.25, 0, -0.42],
    },
    pose(P, st) {
      if (!atk(st)) return;
      const k = st.k, z = track(k, [[0, 0], [0.4, -0.06], [0.48, 0.02], [1, 0]]), ry = track(k, [[0.45, 0], [0.5, 0.2], [0.7, 0]]);
      P.r('arm2', 0, -ry, 0); P.p('arm2', 0, 0, z);
      if (k > 0.47 && k < 0.92) P.s('arm2', 0);
    },
    build(b, P) {
      b.part = P.body;
      b.box(0.08, 0.05, 0.72, { y: 0.17, z: -0.03, color: E_WOOD_L });
      for (const sd of [-1, 1]) {
        b.box(0.03, 0.04, 0.58, { x: sd * 0.15, y: 0.17, z: -0.01, color: E_WOOD });
        b.box(0.008, 0.13, 0.5, { x: sd * 0.168, y: 0.14, z: -0.01, color: 'team' });
        b.box(0.01, 0.016, 0.5, { x: sd * 0.169, y: 0.075, z: -0.01, color: E_GOLD });
      }
      for (const z of [0.2, -0.22]) b.box(0.36, 0.04, 0.05, { y: 0.15, z, color: E_WOOD });
      b.cyl(0.04, 0.055, 0.13, 7, { y: 0.255, color: E_WOOD });
      b.box(0.06, 0.05, 0.64, { y: 0.335, z: 0.03, color: E_WOOD });
      b.box(0.02, 0.012, 0.6, { y: 0.362, z: 0.03, color: E_WOOD_L });
      b.box(0.09, 0.075, 0.07, { y: 0.34, z: 0.3, color: 'team', teamShade: 0.8 });
      b.box(0.16, 0.012, 0.3, { y: 0.312, z: -0.12, color: 'team', teamShade: 0.9 });
      b.extrude([[0, 0.06], [0.035, 0.02], [0.02, -0.035], [0, -0.05], [-0.02, -0.035], [-0.035, 0.02]], 0.012, { y: 0.35, z: 0.338, color: E_GOLD });
      b.ball(0.014, 0, { y: 0.355, z: 0.346, color: CRYSTAL, glow: 1 });
      for (const sd of [-1, 1]) {
        const a0 = [sd * 0.04, 0.345, 0.3], a1 = [sd * 0.18, 0.355, 0.255], a2 = [sd * 0.3, 0.375, 0.15];
        rod(b, a0, a1, 0.019, 0.015, 6, { color: E_WOOD_L });
        rod(b, a1, a2, 0.015, 0.009, 6, { color: E_WOOD_L });
        b.ball(0.016, 0, { ...xyz(a2), color: E_GOLD });
        rod(b, a2, [0, 0.372, -0.08], 0.005, 0.005, 4, { color: '#ece6d4' });
      }
      b.cyl(0.035, 0.035, 0.18, 7, { y: 0.3, z: -0.25, rz: PI / 2, color: WOOD_D });
      for (const sd of [-1, 1]) b.box(0.012, 0.11, 0.02, { x: sd * 0.1, y: 0.3, z: -0.25, color: E_GOLD });
      for (const sd of [-1, 1]) {
        rod(b, [sd * 0.15, 0.19, -0.3], [sd * 0.15, 0.72, -0.3], 0.009, 0.009, 5, { color: E_WOOD });
        b.box(0.006, 0.18, 0.12, { x: sd * 0.15, y: 0.6, z: -0.365, color: 'team', flag: (x, y, z) => Math.max(0, -0.3 - z) * 6 });
        b.cone(0.016, 0.04, 4, { x: sd * 0.15, y: 0.74, z: -0.3, color: E_GOLD });
      }
      for (const [w, x, z] of [['wheelFL', -0.22, 0.2], ['wheelFR', 0.22, 0.2], ['wheelBL', -0.22, -0.22], ['wheelBR', 0.22, -0.22]]) { b.part = P[w]; wheel(b, [x, 0.1, z], 0.1, { rim: '#6a4a2a', hub: E_GOLD, spoke: E_WOOD_L }); }
      b.part = P.arm;
      b.box(0.05, 0.03, 0.08, { y: 0.375, z: -0.08, color: E_GOLD });
      b.box(0.014, 0.05, 0.02, { y: 0.35, z: -0.115, rx: 0.4, color: WOOD_D });
      b.part = P.arm2;
      rod(b, [0, 0.385, -0.07], [0, 0.385, 0.4], 0.009, 0.009, 5, { color: E_WOOD_L });
      b.cone(0.022, 0.08, 4, { y: 0.385, z: 0.44, rx: PI / 2, color: CRYSTAL, glow: 0.7 });
      b.box(0.004, 0.035, 0.06, { y: 0.395, z: -0.04, color: 'team' });
      b.box(0.035, 0.004, 0.06, { y: 0.385, z: -0.04, color: 'team' });
      b.part = P.crewL; crewman(b, -0.25, -0.42, { s: 1.08, skin: EL.skin, hat: LEAF, pants: '#5a6a40' });
      b.part = P.crewR; crewman(b, 0.25, -0.42, { s: 1.08, skin: EL.skin, hat: '#e8d08a', pants: '#5a6a40' });
    },
  },

  elf_general: {
    skeleton: 'humanoid', pivots: piv(EL), scale: 1.15, anim: { attack: 'bow', hold: 'bow', height: 0.68 }, pose: nockFix,
    build(b, P) {
      const R = EL, HAIR = '#f0d890';
      legs(b, P, R, E_WHITE, E_GOLD, { bootH: 0.06 });
      b.part = P.body;
      b.cyl(0.085, 0.165, 0.27, 10, { y: 0.165, color: 'team' });
      b.cyl(0.168, 0.17, 0.03, 10, { y: 0.045, color: E_WHITE });
      b.cyl(0.17, 0.17, 0.012, 10, { y: 0.066, color: E_GOLD });
      b.box(0.05, 0.27, 0.012, { y: 0.17, z: 0.122, rx: -0.27, color: E_WHITE });
      b.box(0.14, 0.15, 0.09, { y: 0.43, color: E_WHITE });
      b.box(0.144, 0.08, 0.094, { y: 0.405, color: LEAF });
      b.cyl(0.088, 0.088, 0.02, 8, { y: 0.31, color: E_GOLD });
      b.ball(0.016, 0, { y: 0.47, z: 0.05, color: CRYSTAL, glow: 1 });
      b.cyl(0.055, 0.085, 0.03, 8, { y: 0.5, color: E_GOLD });
      b.part = P.cape;
      b.box(0.18, 0.46, 0.016, { y: 0.27, z: -0.07, rx: 0.12, color: 'team', teamShade: 0.82, flag: (x, y) => Math.max(0, 0.48 - y) * 2 });
      b.box(0.19, 0.03, 0.04, { y: 0.49, z: -0.06, color: LEAF_L });
      b.part = P.head;
      headElf(b, R, { hair: HAIR, long: 0.24, eye: '#2a6a5a' });
      b.torus(0.06, 0.009, 10, 3, { y: R.headY + 0.038, rx: PI / 2, color: E_GOLD });
      for (let i = 0; i < 7; i++) {
        const a = (i - 3) * 0.42, sa = Math.sin(a), ca = Math.cos(a);
        rod(b, [sa * 0.058, R.headY + 0.04, ca * 0.058], [sa * 0.078, R.headY + (i === 3 ? 0.13 : 0.1), ca * 0.078], 0.016, 0.0, 4, { color: i % 2 ? LEAF_L : E_GOLD });
      }
      b.ball(0.014, 0, { y: R.headY + 0.05, z: 0.064, color: CRYSTAL, glow: 1 });
      arms(b, P, R, { sleeve: E_WHITE, fore: E_WHITE, hand: R.skin, cuff: E_GOLD, pad: LEAF, padR: 0.04 });
      b.part = P.handL;
      const c = [-R.armX - 0.004, R.handY + 0.01, 0.03];
      bow(b, c, 0.52, { wood: E_WHITE, r: 0.012, curve: 0.14, tips: CRYSTAL, tipGlow: 1, grip: E_GOLD });
      for (const sd of [-1, 1]) b.blob(0.018, 0.04, 0.014, 0, { x: c[0], y: c[1] + sd * 0.13, z: c[2] - 0.004, color: E_GOLD });
      nocked(b, P, c, { shaft: E_WHITE });
    },
  },

  // ================================================================== ENANOS
  dwarf_worker: {
    skeleton: 'humanoid', pivots: piv(DW), anim: { attack: 'swing', hold: 'none', height: 0.48 },
    build(b, P) {
      const R = DW, BEARD = '#c46a2c';
      legs(b, P, R, '#6a5a48', '#4a3524', { bootH: 0.06, cuff: '#5a3a22' });
      b.part = P.body;
      b.box(0.22, 0.16, 0.14, { y: 0.262, color: 'team' });
      b.cyl(0.108, 0.12, 0.075, 8, { y: 0.18, color: 'team', teamShade: 0.82 });
      b.box(0.13, 0.13, 0.012, { y: 0.2, z: 0.074, color: LEATHER });
      b.box(0.232, 0.032, 0.152, { y: 0.2, color: LEATHER_D });
      b.box(0.034, 0.03, 0.01, { y: 0.2, z: 0.078, color: BRONZE });
      for (const sd of [-1, 1]) b.box(0.022, 0.13, 0.148, { x: sd * 0.07, y: 0.28, color: LEATHER_D });
      b.part = P.head;
      headDwarf(b, R, BEARD, {});
      b.cyl(0.094, 0.094, 0.012, 10, { y: R.headY + 0.044, color: IRON });
      helm(b, R.headY + 0.044, 0.078, 0.07, shade(IRON, 0.06));
      b.box(0.032, 0.032, 0.026, { y: R.headY + 0.068, z: 0.074, color: BRONZE });
      b.cyl(0.014, 0.014, 0.012, 6, { y: R.headY + 0.068, z: 0.09, rx: PI / 2, color: '#ffe08a', glow: 1 });
      arms(b, P, R, { sleeve: 'team', ts: 0.9, fore: R.skin, hand: LEATHER, cuff: LEATHER_D });
      workerTools(b, P, H_R(R), H_L(R), { s: 0.82, da: 0.35, metal: IRON });
      workerCarry(b, P, [0.27, -0.075]);
    },
  },

  dwarf_inf: {
    skeleton: 'humanoid', pivots: piv(DW), anim: { attack: 'swing', hold: 'sword', height: 0.48 },
    build(b, P) {
      const R = DW, BEARD = '#8a4a24', HORN = '#e8dcc0';
      legs(b, P, R, '#5a4a3e', BOOT, { bootH: 0.06, cuff: IRON });
      b.part = P.body;
      b.box(0.226, 0.17, 0.146, { y: 0.258, color: MAIL });
      b.cyl(0.11, 0.122, 0.08, 8, { y: 0.18, color: MAIL });
      b.box(0.19, 0.23, 0.156, { y: 0.232, color: 'team' });
      b.box(0.236, 0.036, 0.158, { y: 0.2, color: LEATHER_D });
      b.box(0.046, 0.04, 0.012, { y: 0.2, z: 0.08, color: BRONZE });
      b.part = P.head;
      headDwarf(b, R, BEARD, { braid: BRONZE });
      b.cyl(0.081, 0.083, 0.026, 8, { y: R.headY + 0.045, color: BRONZE });
      helm(b, R.headY + 0.055, 0.079, 0.075, IRON);
      b.box(0.016, 0.05, 0.012, { y: R.headY + 0.015, z: 0.079, color: IRON });
      for (const sd of [-1, 1]) {
        rod(b, [sd * 0.068, R.headY + 0.07, 0], [sd * 0.12, R.headY + 0.1, 0.01], 0.02, 0.014, 5, { color: HORN });
        rod(b, [sd * 0.12, R.headY + 0.1, 0.01], [sd * 0.135, R.headY + 0.16, 0.03], 0.014, 0.0, 5, { color: HORN });
      }
      arms(b, P, R, { sleeve: MAIL, hand: LEATHER, pad: 'team', padTs: 0.85, padR: 0.058, cuff: BRONZE });
      b.part = P.handR;
      const h = H_R(R), a = 0.75, hc = along(h, a, 0.25);
      rod(b, along(h, a, -0.05), along(h, a, 0.31), 0.013, 0.013, 6, { color: WOOD });
      b.cyl(0.018, 0.018, 0.05, 6, { ...xyz(hc), rx: a, color: IRON });
      const fan = [[-0.032, 0.0], [0.032, 0.0], [0.075, 0.09], [0.0, 0.074], [-0.075, 0.09]];
      for (const sd of [1, -1]) b.extrude(fan.map(([u, v]) => [-sd * v * (sd > 0 ? 1 : 0.75), u * (sd > 0 ? 1 : 0.75)]), 0.014, { ...xyz(hc), rx: a, ry: PI / 2, color: sd > 0 ? '#c4ccd4' : STEEL });
      b.box(0.016, 0.03, 0.012, { ...xyz(off(hc, a, 0.045)), rx: a, color: RUNE, glow: 0.9 });
      b.part = P.handL;
      roundShield(b, [-0.192, 0.215, 0.042], -0.55, 0.1, { rune: RUNE });
    },
  },

  dwarf_pike: {
    skeleton: 'humanoid', pivots: piv(DW), anim: { attack: 'thrust', hold: 'spear', height: 0.48 },
    pose: thrustFix(PIKE_WANT),
    build(b, P) {
      const R = DW, BEARD = '#b8b2a8', PL = '#7d848e';
      legs(b, P, R, PL, SLATE, { bootH: 0.06, cuff: BRONZE, knee: BRONZE });
      b.part = P.body;
      b.box(0.228, 0.17, 0.148, { y: 0.258, color: PL });
      b.cyl(0.112, 0.128, 0.08, 8, { y: 0.175, color: SLATE });
      b.box(0.17, 0.22, 0.158, { y: 0.228, color: 'team' });
      for (const sd of [-1, 1]) b.box(0.01, 0.22, 0.162, { x: sd * 0.08, y: 0.228, color: BRONZE });
      b.part = P.cape;
      b.box(0.2, 0.22, 0.016, { y: 0.215, z: -0.086, rx: 0.08, color: 'team', teamShade: 0.82, flag: (x, y) => Math.max(0, 0.32 - y) * 2.5 });
      b.part = P.body;
      b.box(0.238, 0.03, 0.16, { y: 0.19, color: LEATHER_D });
      b.box(0.04, 0.036, 0.012, { y: 0.19, z: 0.082, color: BRONZE });
      b.part = P.head;
      headDwarf(b, R, BEARD, { len: 0.15 });
      b.cyl(0.08, 0.08, 0.075, 8, { y: R.headY + 0.022, color: PL });
      helm(b, R.headY + 0.058, 0.08, 0.06, shade(PL, 0.05));
      b.box(0.1, 0.012, 0.012, { y: R.headY + 0.018, z: 0.078, color: '#1e1a1e' });
      b.box(0.012, 0.05, 0.012, { y: R.headY + 0.0, z: 0.08, color: BRONZE });
      b.box(0.024, 0.05, 0.13, { y: R.headY + 0.13, z: -0.01, color: 'team', flag: (x, y, z) => Math.max(0, -z) * 3 });
      arms(b, P, R, { sleeve: PL, hand: IRON, pad: 'team', padTs: 0.85, padR: 0.055, cuff: BRONZE });
      b.part = P.handR;
      const h = [R.armX + 0.006, R.handY, 0.02], a = 0.26, hd = along(h, a, 0.44);
      rod(b, along(h, a, -0.13), along(h, a, 0.5), 0.012, 0.011, 6, { color: WOOD });
      b.cyl(0.016, 0.016, 0.07, 6, { ...xyz(along(h, a, 0.42)), rx: a, color: IRON });
      rod(b, along(h, a, 0.48), along(h, a, 0.6), 0.016, 0.0, 4, { color: BLADE });
      const fan = [[-0.045, 0.0], [0.04, 0.0], [0.07, 0.085], [0.0, 0.07], [-0.07, 0.08]];
      b.extrude(fan.map(([u, v]) => [-v, u]), 0.012, { ...xyz(hd), rx: a, ry: PI / 2, color: '#c4ccd4' });
      rod(b, hd, along(hd, a - PI / 2 + 0.35, 0.07), 0.014, 0.0, 4, { color: STEEL });
      b.box(0.03, 0.05, 0.03, { ...xyz(along(h, a, 0.36)), rx: a, color: 'team' });
      b.cone(0.012, 0.03, 4, { ...xyz(along(h, a, -0.145)), rx: a + PI, color: IRON });
    },
  },

  dwarf_ranged: {
    skeleton: 'humanoid', pivots: piv(DW), anim: { attack: 'crossbow', hold: 'crossbow', height: 0.48 },
    build(b, P) {
      const R = DW, BEARD = '#6b4022', JACK = '#8a6a44';
      legs(b, P, R, '#5a4a3e', '#4a3524', { bootH: 0.06, cuff: LEATHER });
      b.part = P.body;
      b.box(0.224, 0.17, 0.146, { y: 0.258, color: JACK });
      b.cyl(0.11, 0.122, 0.08, 8, { y: 0.18, color: 'team', teamShade: 0.85 });
      b.box(0.15, 0.2, 0.154, { y: 0.245, color: 'team' });
      b.box(0.234, 0.03, 0.156, { y: 0.19, color: LEATHER_D });
      b.box(0.04, 0.034, 0.012, { y: 0.19, z: 0.08, color: BRONZE });
      b.part = P.back;
      b.box(0.07, 0.15, 0.045, { x: -0.04, y: 0.27, z: -0.1, rz: 0.3, color: LEATHER });
      for (const dx of [-0.02, 0.0, 0.02]) b.box(0.01, 0.04, 0.03, { x: -0.065 + dx, y: 0.355, z: -0.1, rz: 0.3, color: dx ? CLOTH : '#c0392b' });
      b.part = P.head;
      headDwarf(b, R, BEARD, { braid: BRONZE });
      b.cyl(0.104, 0.104, 0.012, 10, { y: R.headY + 0.044, color: IRON });
      helm(b, R.headY + 0.044, 0.078, 0.07, shade(IRON, 0.08));
      b.cyl(0.08, 0.08, 0.016, 8, { y: R.headY + 0.056, color: 'team' });
      arms(b, P, R, { sleeve: JACK, hand: LEATHER, pad: 'team', padR: 0.056, cuff: LEATHER_D });
      b.part = P.handR;
      const h = H_R(R), y = h[1] + 0.02, x = h[0] - 0.01;
      b.box(0.034, 0.04, 0.27, { x, y, z: 0.07, color: WOOD });
      b.box(0.04, 0.05, 0.05, { x, y: y - 0.02, z: -0.06, color: WOOD_D });
      for (const sd of [-1, 1]) {
        rod(b, [x, y + 0.012, 0.2], [x + sd * 0.13, y + 0.012, 0.16], 0.012, 0.008, 5, { color: STEEL_D });
        rod(b, [x + sd * 0.13, y + 0.012, 0.16], [x, y + 0.02, 0.07], 0.005, 0.005, 4, { color: '#ece6d4' });
      }
      rod(b, [x, y + 0.03, 0.07], [x, y + 0.03, 0.22], 0.006, 0.006, 4, { color: '#c8a878' });
      b.torus(0.024, 0.006, 8, 3, { x, y: y + 0.01, z: 0.215, color: STEEL_D });
      b.box(0.01, 0.04, 0.012, { x, y: y - 0.035, z: 0.03, rx: 0.3, color: IRON });
    },
  },

  dwarf_cav: {
    skeleton: 'rider',
    anim: { walk: 'gallop', attack: 'gore', riderAttack: 'swing', stride: 0.55, size: 1.1 },
    pivots: {
      body: [0, 0.3, 0], head: [0, 0.37, 0.17], tail: [0, 0.34, -0.22], extra: [0, 0.3, 0],
      legFL: [-0.068, 0.25, 0.13], legFR: [0.068, 0.25, 0.13], legBL: [-0.068, 0.25, -0.13], legBR: [0.068, 0.25, -0.13],
      rBody: [0, 0.405, 0], rHead: [0, 0.583, 0], rArmL: [-0.12, 0.557, 0], rArmR: [0.12, 0.557, 0], rHandL: [-0.146, 0.41, 0], rHandR: [0.146, 0.41, 0], rCape: [0, 0.575, -0.08],
    },
    build(b, P) {
      const WOOL = '#e6dcc4', FACE = '#5e4e42', HORN = '#d8c8a0';
      b.part = P.body;
      b.blob(0.12, 0.11, 0.22, 1, { y: 0.31, color: WOOL });
      for (const [x, y, z, r] of [[-0.07, 0.33, 0.1, 0.06], [0.07, 0.33, 0.1, 0.06], [-0.075, 0.32, -0.09, 0.062], [0.075, 0.32, -0.09, 0.062], [0, 0.35, -0.15, 0.06]]) b.ball(r, 0, { x, y, z, color: shade(WOOL, (x + z) * 0.2) });
      b.part = P.extra;
      b.box(0.245, 0.13, 0.24, { y: 0.345, color: 'team' });
      b.box(0.25, 0.018, 0.246, { y: 0.28, color: BRONZE });
      for (const sd of [-1, 1]) b.box(0.006, 0.04, 0.04, { x: sd * 0.124, y: 0.35, rx: PI / 4, color: RUNE, glow: 0.9 });
      b.box(0.14, 0.035, 0.13, { y: 0.42, color: LEATHER });
      b.box(0.14, 0.06, 0.025, { y: 0.43, z: 0.065, color: LEATHER });
      b.part = P.head;
      b.blob(0.065, 0.075, 0.075, 1, { y: 0.37, z: 0.17, color: WOOL });
      b.box(0.072, 0.08, 0.13, { y: 0.36, z: 0.27, rx: 0.55, color: FACE });
      b.box(0.06, 0.05, 0.05, { y: 0.32, z: 0.33, rx: 0.55, color: shade(FACE, -0.05) });
      b.box(0.08, 0.05, 0.075, { y: 0.405, z: 0.255, rx: 0.55, color: 'team', teamShade: 0.9 });
      b.box(0.084, 0.012, 0.08, { y: 0.428, z: 0.245, rx: 0.55, color: BRONZE });
      for (const sd of [-1, 1]) {
        b.box(0.01, 0.012, 0.012, { x: sd * 0.037, y: 0.38, z: 0.3, color: '#141010' });
        hornSpiral(b, [sd * 0.058, 0.36, 0.215], sd, 1.15, HORN);
      }
      for (const [l, x, z] of [['legFL', -0.068, 0.13], ['legFR', 0.068, 0.13], ['legBL', -0.068, -0.13], ['legBR', 0.068, -0.13]]) {
        b.part = P[l];
        b.box(0.062, 0.12, 0.07, { x, y: 0.2, z, color: shade(WOOL, -0.06) });
        b.box(0.042, 0.12, 0.046, { x, y: 0.075, z, color: FACE });
        b.box(0.048, 0.03, 0.055, { x, y: 0.015, z: z + 0.004, color: '#2e241c' });
      }
      b.part = P.tail; b.ball(0.035, 0, { y: 0.33, z: -0.22, color: WOOL });
      // ---- jinete enano
      const R = lift(DW, 0.25), BEARD = '#a0522d';
      b.part = P.rBody;
      riderLegs(b, 0.405, 0, 0.135, { w: 0.07, shin: 0.12, pants: '#5a4a3e', boot: BOOT });
      b.box(0.22, 0.165, 0.144, { y: 0.49, color: MAIL });
      b.box(0.15, 0.18, 0.152, { y: 0.48, color: 'team' });
      b.box(0.23, 0.032, 0.154, { y: 0.44, color: LEATHER_D });
      b.box(0.04, 0.034, 0.012, { y: 0.44, z: 0.079, color: BRONZE });
      b.part = P.rHead;
      headDwarf(b, R, BEARD, { braid: BRONZE, len: 0.13 });
      b.cyl(0.081, 0.083, 0.026, 8, { y: R.headY + 0.045, color: BRONZE });
      helm(b, R.headY + 0.055, 0.079, 0.075, IRON);
      for (const sd of [-1, 1]) {
        rod(b, [sd * 0.068, R.headY + 0.07, 0], [sd * 0.12, R.headY + 0.1, 0.01], 0.02, 0.014, 5, { color: '#e8dcc0' });
        rod(b, [sd * 0.12, R.headY + 0.1, 0.01], [sd * 0.135, R.headY + 0.16, 0.03], 0.014, 0.0, 5, { color: '#e8dcc0' });
      }
      b.box(0.022, 0.04, 0.1, { y: R.headY + 0.14, z: -0.01, color: 'team', flag: (x, y, z) => Math.max(0, -z) * 3 });
      arms(b, P, R, { rider: true, sleeve: MAIL, hand: LEATHER, pad: 'team', padTs: 0.85, padR: 0.056, cuff: BRONZE });
      b.part = P.rHandR;
      const h = H_R(R), a = 0.75, hc = along(h, a, 0.24);
      rod(b, along(h, a, -0.05), along(h, a, 0.3), 0.013, 0.013, 6, { color: WOOD });
      b.cyl(0.018, 0.018, 0.045, 6, { ...xyz(hc), rx: a, color: IRON });
      b.extrude([[-0.03, 0.0], [0.03, 0.0], [0.07, 0.085], [0.0, 0.07], [-0.07, 0.085]].map(([u, v]) => [-v, u]), 0.014, { ...xyz(hc), rx: a, ry: PI / 2, color: '#c4ccd4' });
      b.part = P.rHandL;
      roundShield(b, [-0.192, 0.46, 0.042], -0.55, 0.095, { rune: RUNE });
    },
  },

  dwarf_special: {
    skeleton: 'humanoid', pivots: piv(DW), anim: { attack: 'gun', hold: 'crossbow', height: 0.48 },
    pose(P, st) { P.s('toolAxe', atk(st) && st.k > 0.48 && st.k < 0.6 ? 1 : 0); },
    build(b, P) {
      const R = DW, BEARD = '#d8d0c4';
      legs(b, P, R, '#4a4a52', '#3e2c1e', { bootH: 0.065, cuff: BRONZE });
      b.part = P.body;
      b.box(0.224, 0.17, 0.146, { y: 0.258, color: 'team' });
      b.cyl(0.112, 0.13, 0.11, 8, { y: 0.165, color: 'team', teamShade: 0.8 });
      b.box(0.03, 0.22, 0.158, { y: 0.26, rz: 0.75, color: LEATHER });
      for (let i = 0; i < 3; i++) b.box(0.018, 0.03, 0.012, { x: 0.035 - i * 0.035, y: 0.225 + i * 0.035, z: 0.08, rz: 0.75, color: BRONZE });
      b.box(0.234, 0.03, 0.156, { y: 0.2, color: LEATHER_D });
      b.part = P.back;
      b.cyl(0.048, 0.048, 0.1, 8, { y: 0.26, z: -0.115, rz: PI / 2, color: WOOD });
      for (const dx of [-0.032, 0.032]) b.cyl(0.051, 0.051, 0.012, 8, { x: dx, y: 0.26, z: -0.115, rz: PI / 2, color: IRON });
      b.part = P.head;
      headDwarf(b, R, BEARD, { len: 0.14 });
      helm(b, R.headY + 0.042, 0.079, 0.072, shade(IRON, 0.04));
      b.box(0.12, 0.02, 0.03, { y: R.headY + 0.058, z: 0.062, color: LEATHER_D });
      for (const sd of [-1, 1]) {
        b.cyl(0.02, 0.02, 0.014, 7, { x: sd * 0.026, y: R.headY + 0.06, z: 0.078, rx: PI / 2, color: BRONZE });
        b.cyl(0.014, 0.014, 0.008, 7, { x: sd * 0.026, y: R.headY + 0.06, z: 0.086, rx: PI / 2, color: '#9fd8ff', glow: 0.35 });
      }
      arms(b, P, R, { sleeve: 'team', ts: 0.9, hand: LEATHER, cuff: BRONZE, pad: LEATHER, padR: 0.05 });
      b.part = P.handR;
      const h = H_R(R), x = h[0], y = h[1] + 0.03;
      b.box(0.036, 0.05, 0.12, { x, y: h[1] + 0.005, z: -0.01, color: WOOD });
      b.box(0.04, 0.075, 0.045, { x, y: h[1] - 0.012, z: -0.08, color: WOOD_D });
      b.cyl(0.02, 0.023, 0.26, 7, { x, y, z: 0.14, rx: PI / 2, color: BRONZE });
      b.cyl(0.046, 0.024, 0.07, 8, { x, y, z: 0.3, rx: PI / 2, color: shade(BRONZE, 0.06) });
      for (const z of [0.05, 0.2]) b.cyl(0.027, 0.027, 0.016, 7, { x, y, z, rx: PI / 2, color: IRON });
      b.ball(0.011, 0, { x, y: y + 0.024, z: 0.03, color: RUNE_O, glow: 1 });
      b.part = P.toolAxe;
      b.blob(0.05, 0.05, 0.08, 0, { x, y, z: 0.4, color: '#ffc06a', glow: 1 });
      b.blob(0.03, 0.03, 0.05, 0, { x, y, z: 0.47, color: '#fff2c0', glow: 1 });
    },
  },

  dwarf_siege: {
    skeleton: 'siege', anim: { attack: 'cannon', wheelTurns: 0.6 },
    pivots: {
      body: [0, 0.18, 0], wheelFL: [-0.2, 0.13, 0.1], wheelFR: [0.2, 0.13, 0.1], wheelBL: [-0.15, 0.07, -0.32], wheelBR: [0.15, 0.07, -0.32],
      arm: [0, 0.29, 0.06], arm2: [0, 0.32, 0.45], crewL: [-0.28, 0, -0.16], crewR: [0.28, 0, -0.16],
    },
    pose(P, st) { P.s('arm2', atk(st) && st.k > 0.48 && st.k < 0.58 ? 1 : 0); },
    build(b, P) {
      const CW = '#7a5634';
      b.part = P.body;
      const prof = [[0.18, 0.1], [0.18, 0.2], [0.11, 0.27], [0.0, 0.27], [-0.1, 0.2], [-0.42, 0.1], [-0.42, 0.04], [0.0, 0.08]];
      for (const sd of [-1, 1]) {
        b.extrude(prof.map(([z, y]) => [-z, y]), 0.04, { x: sd * 0.095, ry: PI / 2, color: 'team', teamShade: 0.85 });
        b.box(0.046, 0.02, 0.2, { x: sd * 0.095, y: 0.135, z: -0.2, rx: -0.33, color: IRON });
        b.box(0.046, 0.12, 0.02, { x: sd * 0.095, y: 0.18, z: 0.12, color: IRON });
        b.box(0.008, 0.04, 0.05, { x: sd * 0.117, y: 0.17, z: -0.06, color: RUNE_O, glow: 0.9 });
      }
      b.cyl(0.022, 0.022, 0.42, 7, { y: 0.13, z: 0.1, rz: PI / 2, color: IRON });
      b.cyl(0.018, 0.018, 0.32, 7, { y: 0.07, z: -0.32, rz: PI / 2, color: IRON });
      b.box(0.19, 0.06, 0.05, { y: 0.17, z: -0.06, color: CW });
      b.box(0.19, 0.05, 0.08, { y: 0.09, z: -0.34, color: CW });
      b.wedge(0.12, 0.05, 0.12, { y: 0.19, z: -0.1, ry: PI / 2, color: shade(CW, 0.08) });
      for (const [x, y, z] of [[-0.035, 0.15, -0.27], [0.035, 0.15, -0.27], [0, 0.19, -0.27]]) b.ball(0.036, 0, { x, y, z, color: '#4f5258' });
      rod(b, [0.07, 0.12, -0.4], [0.07, 0.62, -0.4], 0.009, 0.009, 5, { color: WOOD_D });
      b.box(0.006, 0.16, 0.2, { x: 0.07, y: 0.52, z: -0.5, color: 'team', flag: (x, y, z) => Math.max(0, -0.4 - z) * 5 });
      for (const sd of [-1, 1]) b.box(0.012, 0.09, 0.09, { x: sd * 0.12, y: 0.2, z: 0.02, color: 'team', teamShade: 1.05 });
      b.cone(0.016, 0.04, 4, { x: 0.07, y: 0.64, z: -0.4, color: BRONZE });
      for (const [w, x, y, z, r] of [['wheelFL', -0.2, 0.13, 0.1, 0.13], ['wheelFR', 0.2, 0.13, 0.1, 0.13], ['wheelBL', -0.15, 0.07, -0.32, 0.07], ['wheelBR', 0.15, 0.07, -0.32, 0.07]]) { b.part = P[w]; wheel(b, [x, y, z], r, { rim: '#4e3826', hub: IRON, spoke: CW, w: r > 0.1 ? 0.04 : 0.032 }); }
      b.part = P.arm;
      const pv = [0, 0.29, 0.06], a = PI / 2 - 0.1;
      b.lathe([[0.001, -0.25], [0.035, -0.245], [0.06, -0.21], [0.068, -0.12], [0.06, 0.1], [0.052, 0.22], [0.064, 0.25], [0.068, 0.3], [0.045, 0.305], [0.04, 0.27]], 10, { ...xyz(pv), rx: a, color: BRONZE });
      for (const d of [-0.12, 0.1, 0.25]) b.cyl(0.072, 0.072, d === 0.1 ? 0.05 : 0.022, 10, { ...xyz(along(pv, a, d)), rx: a, color: d === 0.1 ? 'team' : shade(BRONZE, -0.1) });
      b.ball(0.03, 0, { ...xyz(along(pv, a, -0.27)), color: shade(BRONZE, -0.06) });
      b.cyl(0.024, 0.024, 0.24, 7, { ...xyz(pv), rz: PI / 2, color: IRON });
      b.cyl(0.041, 0.041, 0.01, 10, { ...xyz(along(pv, a, 0.29)), rx: a, color: '#2a2420' });
      b.box(0.016, 0.012, 0.16, { ...xyz(off(along(pv, a, -0.02), a, -0.064)), rx: a - PI / 2, color: RUNE_O, glow: 0.9 });
      b.part = P.arm2;
      b.blob(0.07, 0.07, 0.1, 0, { y: 0.32, z: 0.45, color: '#ffc06a', glow: 1 });
      b.blob(0.04, 0.04, 0.07, 0, { y: 0.325, z: 0.54, color: '#fff2c0', glow: 1 });
      b.part = P.crewL; crewman(b, -0.28, -0.16, { s: 0.78, skin: DW.skin, beard: '#c46a2c', hat: IRON });
      b.part = P.crewR; crewman(b, 0.28, -0.16, { s: 0.78, skin: DW.skin, beard: '#6b4022', hat: BRONZE });
    },
  },

  dwarf_general: {
    skeleton: 'humanoid', pivots: piv(DW), scale: 1.15, anim: { attack: 'smash', hold: 'twohand', height: 0.48 },
    pose(P, st) {
      if (!atk(st)) return;
      const k = st.k, r = track(k, [[0, 0], [0.38, -2.7], [0.52, -0.55], [0.7, -0.5], [1, 0]]);
      P.r('handR', track(k, [[0, 0.5], [0.38, -0.45], [0.52, 1.7], [0.7, 1.65], [1, 0.5]]) - 0.5 - r, 0, 0);
    },
    build(b, P) {
      const R = DW, BEARD = '#ece6da', PL = '#8a919b';
      legs(b, P, R, PL, SLATE, { bootH: 0.065, cuff: GOLD, knee: GOLD });
      b.part = P.body;
      b.box(0.232, 0.172, 0.15, { y: 0.258, color: PL });
      b.cyl(0.114, 0.13, 0.085, 8, { y: 0.172, color: SLATE });
      b.box(0.17, 0.24, 0.16, { y: 0.225, color: 'team' });
      for (const sd of [-1, 1]) b.box(0.012, 0.24, 0.164, { x: sd * 0.08, y: 0.225, color: GOLD });
      b.box(0.174, 0.016, 0.164, { y: 0.11, color: GOLD });
      b.box(0.04, 0.04, 0.008, { y: 0.27, z: 0.082, rz: PI / 4, color: RUNE, glow: 0.9 });
      b.box(0.242, 0.034, 0.162, { y: 0.19, color: LEATHER_D });
      b.box(0.05, 0.04, 0.012, { y: 0.19, z: 0.084, color: GOLD });
      b.part = P.cape;
      b.box(0.24, 0.29, 0.018, { y: 0.18, z: -0.09, rx: 0.1, color: 'team', teamShade: 0.82, flag: (x, y) => Math.max(0, 0.32 - y) * 2.5 });
      b.blob(0.13, 0.035, 0.06, 0, { y: 0.33, z: -0.05, color: '#d8d0c4' });
      b.part = P.head;
      headDwarf(b, R, BEARD, { len: 0.2, wide: 1.05, braid: GOLD });
      helm(b, R.headY + 0.044, 0.08, 0.072, IRON);
      b.cyl(0.084, 0.084, 0.03, 8, { y: R.headY + 0.056, color: GOLD });
      for (let i = 0; i < 5; i++) { const a = i / 5 * 2 * PI; b.cone(0.017, 0.045, 4, { x: Math.sin(a) * 0.076, y: R.headY + 0.09, z: Math.cos(a) * 0.076, color: GOLD }); }
      b.ball(0.013, 0, { y: R.headY + 0.056, z: 0.085, color: RUNE, glow: 1 });
      arms(b, P, R, { sleeve: PL, hand: SLATE, cuff: GOLD });
      for (const [p, sd] of [[P.armL, -1], [P.armR, 1]]) { b.part = p; b.blob(0.066, 0.046, 0.072, 1, { x: sd * 0.15, y: 0.318, color: 'team', teamShade: 0.9 }); b.box(0.016, 0.03, 0.12, { x: sd * 0.205, y: 0.3, rz: sd * 0.45, color: GOLD }); }
      b.part = P.handR;
      const h = H_R(R), a = 0.5, hc = along(h, a, 0.33);
      rod(b, along(h, a, -0.07), along(h, a, 0.3), 0.014, 0.014, 6, { color: '#5a3e24' });
      b.cyl(0.018, 0.018, 0.06, 6, { ...xyz(along(h, a, 0.0)), rx: a, color: LEATHER });
      b.box(0.11, 0.1, 0.17, { ...xyz(hc), rx: a, color: IRON });
      for (const sd of [-1, 1]) b.box(0.12, 0.11, 0.024, { ...xyz(off(hc, a, sd * 0.085)), rx: a, color: GOLD });
      b.box(0.114, 0.022, 0.12, { ...xyz(hc), rx: a, color: RUNE, glow: 1 });
      for (const sx of [-1, 1]) b.box(0.006, 0.055, 0.06, { x: hc[0] + sx * 0.056, y: hc[1], z: hc[2], rx: a, color: RUNE, glow: 1 });
      b.ball(0.022, 0, { ...xyz(along(h, a, -0.085)), color: GOLD });
    },
  },
};
