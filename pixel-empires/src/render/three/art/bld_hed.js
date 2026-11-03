/* =====================================================================
   Arte 3D procedural — edificios de humanos, elfos y enanos (bld_hed.js).
   Ver docs/ART3D.md §5. Cada entrada: clave -> { fp, build(b), smoke, fire }.
     Humanos  piedra clara, entramado de madera, teja de terracota, cruces y escudos.
     Elfos    madera viva, formas curvas, cúpulas de hojas, arcos, piedra blanca, oro, cristales.
     Enanos   bloques de granito, pizarra, bronce y hierro, runas brillantes, chimeneas.
   ===================================================================== */
import { shade, solid } from '../kit.js';

const PI = Math.PI, HP = PI / 2;

/* ------------------------------------------------------------------ geometría auxiliar */
/** Tronco de pirámide: base w×d en y=0, techo wt×dt en y=h (muros ataludados, zócalos). */
function frustumGeo(w, d, h, wt, dt) {
  const a = w / 2, c = d / 2, e = wt / 2, g = dt / 2;
  return solid([-a, 0, -c, a, 0, -c, a, 0, c, -a, 0, c, -e, h, -g, e, h, -g, e, h, g, -e, h, g],
    [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
}
/** Tejado a cuatro aguas con cumbrera de largo r a lo largo de X (r = 0: pirámide). */
function hipGeo(w, d, h, r) {
  const a = w / 2, c = d / 2, e = Math.max(0.001, r / 2);
  return solid([-a, 0, -c, a, 0, -c, a, 0, c, -a, 0, c, -e, h, 0, e, h, 0], [0, 1, 2, 0, 2, 3, 0, 1, 5, 0, 5, 4, 3, 2, 5, 3, 5, 4, 1, 2, 5, 0, 3, 4]);
}
const frustum = (b, w, d, h, wt, dt, o) => b.add(frustumGeo(w, d, h, wt, dt), o);
const hip = (b, w, d, h, r, o) => b.add(hipGeo(w, d, h, r), o);

/** Grupo girado/desplazado: mismas primitivas, posiciones locales (giro en Y, orden YXZ). */
function grp(b, gx, gy, gz, g = 0) {
  const c = Math.cos(g), s = Math.sin(g);
  const P = (x, z) => [gx + x * c + z * s, gz - x * s + z * c];
  const T = (o = {}) => {
    const [x, z] = P(o.x || 0, o.z || 0), r = Object.assign({}, o, { x, y: gy + (o.y || 0), z, ry: (o.ry || 0) + g, order: 'YXZ' });
    if (o.spin) { const [cx, cz] = P(o.spin.c[0], o.spin.c[2]), a = o.spin.axis; r.spin = { c: [cx, gy + o.spin.c[1], cz], axis: [a[0] * c + a[2] * s, a[1], -a[0] * s + a[2] * c], speed: o.spin.speed }; }
    return r;
  };
  return {
    b, P, T, g,
    box: (w, h, d, o) => b.box(w, h, d, T(o)), cyl: (rt, rb, h, n, o) => b.cyl(rt, rb, h, n, T(o)), cone: (r, h, n, o) => b.cone(r, h, n, T(o)),
    ball: (r, dt, o) => b.ball(r, dt, T(o)), blob: (rx, ry, rz, dt, o) => b.blob(rx, ry, rz, dt, T(o)), wedge: (w, h, d, o) => b.wedge(w, h, d, T(o)),
    pyramid: (w, h, d, o) => b.pyramid(w, h, d, T(o)), torus: (r, t, n, m, o) => b.torus(r, t, n, m, T(o)), lathe: (p, n, o) => b.lathe(p, n, T(o)),
    extrude: (p, d, o) => b.extrude(p, d, T(o)), add: (geo, o) => b.add(geo, T(o)),
    frustum: (w, d, h, wt, dt, o) => b.add(frustumGeo(w, d, h, wt, dt), T(o)), hip: (w, d, h, r, o) => b.add(hipGeo(w, d, h, r), T(o)),
  };
}
/** n posiciones repartidas entre a y b (centros de celdas). */
const spread = (n, a, z) => Array.from({ length: n }, (_, i) => a + (i + 0.5) * (z - a) / n);
/** Contorno de puerta con arco de medio punto (k > 0 lo alarga): ancho w, alto total h, base en y=0. */
function archPts(w, h, k = 0, n = 6) {
  const r = w / 2, ys = h - r * (1 + k), pts = [[-r, 0]];
  for (let i = 0; i <= n; i++) { const a = PI - i * PI / n; pts.push([Math.cos(a) * r, ys + Math.sin(a) * r * (1 + k)]); }
  pts.push([r, 0]); return pts;
}
/** Marco de arco (corona de dovelas) como contorno cerrado: exterior R, interior r, base en y=0. */
function archRing(R, r, n = 6, k = 1) {
  const o = [], i = [];
  for (let j = 0; j <= n; j++) { const a = PI - (j / n) * PI; o.push([Math.cos(a) * R, Math.sin(a) * R * k]); i.push([Math.cos(a) * r, Math.sin(a) * r * k]); }
  return o.concat(i.reverse());
}
/** Silueta apuntada (lanceta/hoja) de ancho w y alto h, base en y=0. */
function lancetPts(w, h, n = 5) {
  const L = [], R = [];
  for (let j = 0; j <= n; j++) { const t = j / n, x = (w / 2) * Math.pow(1 - t, 0.55); L.push([-x, h * t]); if (j < n) R.push([x, h * t]); }
  return L.concat(R.reverse());
}
/** Media hoja de puerta con remate en arco: bisagra en x=0, ancho w (hacia +X si dir=1), arranque del arco ys. */
function leafPts(w, ys, dir = 1, n = 4, k = 1) {
  const pts = [[0, 0], [w * dir, 0]];
  for (let i = 0; i <= n; i++) { const a = HP + (i / n) * HP; pts.push([(w + w * Math.cos(a)) * dir, ys + Math.sin(a) * w * k]); }
  return dir > 0 ? pts : pts.reverse();
}

/* ------------------------------------------------------------------ piezas comunes */
const flagFn = (x0, z0, k) => (x, y, z) => Math.hypot(x - x0, z - z0) * k;
/**
 * Mástil con bandera del color de equipo que ondea. o: { w, fh, ry, pole, tip, shape: 'rect'|'tail'|'pennant', r, emblem }.
 * La tela sale del mástil hacia +X girada ry.
 */
function flag(b, x, y0, z, h, o = {}) {
  const w = o.w ?? 0.34, fh = o.fh ?? 0.2, ry = o.ry ?? 0, r = o.r ?? 0.02, k = o.k ?? 5;
  b.cyl(r, r * 1.3, h, 6, { x, y: y0 + h / 2, z, color: o.pole || '#5a3b26' });
  if (o.tip !== false) b.ball(r * 1.8, 0, { x, y: y0 + h + r, z, color: o.tip || '#d4af37', glow: o.tipGlow || 0 });
  const yt = y0 + h - 0.03, fl = flagFn(x, z, k);
  const pts = o.shape === 'pennant' ? [[0, 0], [w, -fh / 2], [0, -fh]] : o.shape === 'tail' ? [[0, 0], [w, 0], [w * 0.72, -fh / 2], [w, -fh], [0, -fh]] : [[0, 0], [w, 0], [w, -fh], [0, -fh]];
  b.extrude(pts, 0.026, { x: x + Math.cos(ry) * r, y: yt, z: z - Math.sin(ry) * r, ry, color: 'team', flag: fl });
  if (o.emblem) b.extrude([[w * 0.3, -fh * 0.32], [w * 0.62, -fh * 0.32], [w * 0.62, -fh * 0.68], [w * 0.3, -fh * 0.68]], 0.034, { x: x + Math.cos(ry) * r, y: yt, z: z - Math.sin(ry) * r, ry, color: o.emblem, flag: fl });
}
/**
 * Estandarte colgante (tela vertical con punta) mirando hacia ry (0 = +Z). Barra arriba, emblema opcional.
 * emb: 'cross' | 'diamond' | 'leaf' | 'rune' | null; ec = color del emblema.
 */
function banner(b, x, yt, z, w, h, o = {}) {
  const ry = o.ry || 0, nx = Math.sin(ry), nz = Math.cos(ry), fl = (px, py) => Math.max(0, yt - py) * (o.k ?? 1.6);
  b.cyl(0.016, 0.016, w + 0.08, 5, { x, y: yt + 0.01, z, rz: HP, ry, order: 'YXZ', color: o.rod || '#d4af37' });
  const tip = o.tail ? [[w / 2, -h], [w / 4, -h + 0.08], [0, -h], [-w / 4, -h + 0.08], [-w / 2, -h]] : [[w / 2, -h], [0, -h - w * 0.35], [-w / 2, -h]];
  b.extrude([[-w / 2, 0], [w / 2, 0], ...tip], 0.026, { x, y: yt, z, ry, color: 'team', teamShade: o.ts ?? 1, flag: fl });
  if (o.trim) b.extrude([[-w / 2 - 0.004, 0], [w / 2 + 0.004, 0], [w / 2 + 0.004, -0.04], [-w / 2 - 0.004, -0.04]], 0.032, { x, y: yt, z, ry, color: o.trim, flag: fl });
  const ex = x + nx * 0.016, ez = z + nz * 0.016, ec = o.ec || '#efe6cf', cy = yt - h * 0.5;
  if (o.emb === 'cross') {
    b.box(w * 0.16, h * 0.6, 0.02, { x: ex, y: cy, z: ez, ry, color: ec, flag: fl });
    b.box(w * 0.6, w * 0.16, 0.02, { x: ex, y: cy + h * 0.1, z: ez, ry, color: ec, flag: fl });
  } else if (o.emb === 'diamond') b.box(w * 0.36, w * 0.36, 0.02, { x: ex, y: cy, z: ez, ry, rz: PI / 4, order: 'YXZ', color: ec, flag: fl });
  else if (o.emb === 'leaf') b.extrude(lancetPts(w * 0.38, h * 0.55), 0.02, { x: ex, y: cy - h * 0.27, z: ez, ry, color: ec, flag: fl, glow: o.eg || 0 });
  else if (o.emb === 'rune') {
    b.box(w * 0.1, h * 0.5, 0.02, { x: ex, y: cy, z: ez, ry, color: ec, glow: o.eg ?? 0.8, flag: fl });
    b.box(w * 0.1, h * 0.3, 0.02, { x: ex + Math.cos(ry) * w * 0.12, y: cy + h * 0.08, z: ez - Math.sin(ry) * w * 0.12, ry, rz: -0.7, order: 'YXZ', color: ec, glow: o.eg ?? 0.8, flag: fl });
  }
}
/** Escudo de cometa con cara del equipo y cruz (mirando a ry). s = escala (1 ≈ 0.26 de alto). */
function heater(b, x, y, z, ry = 0, s = 1, o = {}) {
  const pts = [[-0.1, 0.11], [0.1, 0.11], [0.1, 0.0], [0.066, -0.08], [0, -0.13], [-0.066, -0.08], [-0.1, 0.0]].map(([a, c]) => [a * s, c * s]);
  const nx = Math.sin(ry), nz = Math.cos(ry);
  b.extrude(pts.map(([a, c]) => [a * 1.14, c * 1.1]), 0.026, { x, y, z, ry, color: o.rim || '#c9a43a' });
  b.extrude(pts, 0.03, { x: x + nx * 0.008, y, z: z + nz * 0.008, ry, color: 'team' });
  if (o.cross !== false) {
    b.box(0.032 * s, 0.17 * s, 0.03, { x: x + nx * 0.015, y: y - 0.008 * s, z: z + nz * 0.015, ry, color: o.ec || '#efe6cf' });
    b.box(0.13 * s, 0.032 * s, 0.03, { x: x + nx * 0.015, y: y + 0.035 * s, z: z + nz * 0.015, ry, color: o.ec || '#efe6cf' });
  }
}
/** Escudo redondo (enanos/elfos): disco del equipo con borde y umbo. Mira hacia ry. */
function roundShield(b, x, y, z, ry, r, o = {}) {
  const nx = Math.sin(ry), nz = Math.cos(ry);
  b.cyl(r, r, 0.03, o.n || 8, { x, y, z, rx: HP, ry, order: 'YXZ', color: o.rim || '#c08a3e' });
  b.cyl(r * 0.84, r * 0.84, 0.04, o.n || 8, { x: x + nx * 0.006, y, z: z + nz * 0.006, rx: HP, ry, order: 'YXZ', color: 'team' });
  b.ball(r * 0.26, 0, { x: x + nx * 0.03, y, z: z + nz * 0.03, color: o.boss || '#c08a3e', glow: o.glow || 0 });
}
/** Almenas: n merlones repartidos a lo largo de X entre x0 y x1 (en z), base y. */
function merlonsX(b, x0, x1, n, y, z, mw, mh, md, col) { for (const x of spread(n, x0, x1)) b.box(mw, mh, md, { x, y: y + mh / 2, z, color: col }); }
function merlonsZ(b, z0, z1, n, y, x, mw, mh, md, col) { for (const z of spread(n, z0, z1)) b.box(md, mh, mw, { x, y: y + mh / 2, z, color: col }); }
/** Almenas en anillo (torres redondas). */
function merlonsRing(b, x, z, r, n, y, mw, mh, md, col, a0 = 0) { for (let i = 0; i < n; i++) { const a = a0 + i * 2 * PI / n; b.box(mw, mh, md, { x: x + Math.sin(a) * r, y: y + mh / 2, z: z + Math.cos(a) * r, ry: a, color: col }); } }
/** Tronco tumbado con cara de corte clara. Eje a lo largo de X (ry gira). */
function log(b, x, y, z, len, r, o = {}) {
  const ry = o.ry || 0, c = Math.cos(ry), s = Math.sin(ry);
  b.cyl(r, r, len, 7, { x, y, z, rz: HP, ry, order: 'YXZ', color: o.bark || '#6b4a2c' });
  for (const e of [-1, 1]) b.cyl(r * 0.82, r * 0.82, 0.02, 7, { x: x + c * e * len / 2, y, z: z - s * e * len / 2, rz: HP, ry, order: 'YXZ', color: o.wood || '#d9b98a' });
}
/** Barril vertical. */
function barrel(b, x, z, r = 0.09, h = 0.2, o = {}) {
  b.cyl(r * 0.88, r * 0.88, h, 8, { x, y: (o.y || 0) + h / 2, z, color: o.col || '#8a6440' });
  b.cyl(r, r, h * 0.36, 8, { x, y: (o.y || 0) + h / 2, z, color: shade(o.col || '#8a6440', 0.05) });
  b.cyl(r * 0.93, r * 0.93, 0.025, 8, { x, y: (o.y || 0) + h * 0.85, z, color: o.hoop || '#5d6168' });
}
/** Caja de madera con tablas. */
function crate(b, x, y, z, s, o = {}) {
  b.box(s, s, s, { x, y: y + s / 2, z, ry: o.ry || 0, color: o.col || '#a57a4e' });
  b.box(s * 1.02, s * 0.18, s * 1.02, { x, y: y + s * 0.5, z, ry: o.ry || 0, color: shade(o.col || '#a57a4e', -0.1) });
}
/** Saco (montón de grano). */
const sack = (b, x, y, z, s = 1, col = '#d8c49a') => b.blob(0.09 * s, 0.075 * s, 0.07 * s, 0, { x, y: y + 0.065 * s, z, color: col });
/** Cristal biconico brillante (elfos). */
function crystal(b, x, y, z, s, o = {}) {
  const col = o.color || '#7ff0c0', g = o.glow ?? 0.9;
  b.cyl(0, 0.05 * s, 0.14 * s, 6, { x, y: y + 0.07 * s, z, rx: o.rx || 0, rz: o.rz || 0, color: col, glow: g, spin: o.spin });
  b.cyl(0.05 * s, 0, 0.07 * s, 6, { x, y: y - 0.035 * s, z, rx: o.rx || 0, rz: o.rz || 0, color: shade(col, -0.08), glow: g, spin: o.spin });
}
/** Runa brillante sobre una cara (enanos): trazo vertical + dos oblicuos. */
function rune(b, x, y, z, ry = 0, s = 1, col = '#5fe3ff') {
  const c = Math.cos(ry), sn = Math.sin(ry), o = { ry, color: col, glow: 1 };
  b.box(0.022 * s, 0.13 * s, 0.026, Object.assign({ x, y, z }, o));
  b.box(0.02 * s, 0.075 * s, 0.026, Object.assign({ x: x + c * 0.028 * s, y: y + 0.03 * s, z: z - sn * 0.028 * s, rz: -0.75, order: 'YXZ' }, o));
  b.box(0.02 * s, 0.075 * s, 0.026, Object.assign({ x: x - c * 0.028 * s, y: y - 0.03 * s, z: z + sn * 0.028 * s, rz: -0.75, order: 'YXZ' }, o));
}
/** Roca facetada (montículos, minas). */
const rock = (b, x, y, z, r, col, o = {}) => b.ball(r, 0, Object.assign({ x, y, z, sy: o.sy ?? 0.75, ry: o.ry ?? (x * 3.1 + z * 1.7), color: col }, o.extra || {}));
/** Ventana: hueco oscuro con marco y alféizar, mirando a ry. */
function win(b, x, y, z, w, h, o = {}) {
  const ry = o.ry || 0, nx = Math.sin(ry), nz = Math.cos(ry);
  b.box(w + 0.05, h + 0.05, 0.03, { x, y, z, ry, color: o.frame || '#5a3b26' });
  b.box(w, h, 0.034, { x: x + nx * 0.004, y, z: z + nz * 0.004, ry, color: o.glass || '#3d4f66', glow: o.glow || 0 });
  if (o.bar !== false) b.box(0.022, h, 0.04, { x: x + nx * 0.006, y, z: z + nz * 0.006, ry, color: o.frame || '#5a3b26' });
  if (o.shutter) for (const e of [-1, 1]) b.box(w * 0.5, h + 0.02, 0.03, { x: x + Math.cos(ry) * e * (w * 0.75 + 0.03), y, z: z - Math.sin(ry) * e * (w * 0.75 + 0.03), ry, color: o.shutter, teamShade: 0.85 });
}

/* ==================================================================================== HUMANOS */
const HS = '#b9b2a6', HS_D = '#9d968a', HS_L = '#cdc6b9', PLA = '#efe6cf', BEAM = '#5a3b26', TILE = '#b5523b', TILE_D = '#9a4431',
  HW = '#8a6440', HW_L = '#a57a4e', HDOOR = '#6a4528', GLASS = '#3d4f66', STEEL = '#aab2bc', IRON = '#5d6168', GOLD = '#d4af37',
  STRAW = '#d9bf6a', SOIL = '#7a5a3a', GRASS = '#7d9a55', CLOTH = '#efe6cf';

/** Tejado de teja a dos aguas (cumbrera en X) con hiladas, cumbrera y tablas del equipo. o.gable = color del piñón. */
function hRoof(G, w, h, d, y, o = {}) {
  G.wedge(w, h, d, { y, color: o.col || TILE });
  const rows = o.rows ?? 3, sl = Math.atan2(h, d / 2), L = Math.hypot(h, d / 2);
  for (let i = 1; i <= rows; i++) { const t = i / (rows + 1); for (const s of [-1, 1]) G.box(w + 0.02, 0.026, 0.05, { y: y + h * t - 0.006, z: s * (d / 2) * (1 - t), rx: s * sl, color: o.rowCol || TILE_D }); }
  G.box(w + 0.04, 0.065, 0.085, { y: y + h, color: 'team' });
  if (o.barge !== false) for (const s of [-1, 1]) for (const e of [-1, 1]) G.box(0.05, 0.05, L + 0.04, { x: s * (w / 2 + 0.01), y: y + h / 2 + 0.03, z: e * d / 4, rx: e * sl, color: 'team', teamShade: 0.75 });
  if (o.gable) gableTri(G, w, h, d, y, o.gable, o.gableBeam);
}
/** Triángulos de piñón (muro) metidos dentro de los extremos de una cuña w×h×d. */
function gableTri(G, w, h, d, y, col, beam) {
  const k = 0.84, yc = y + h / 3, b0 = yc - k * h / 3, top = yc + 2 * k * h / 3, hw = k * d / 2;
  for (const e of [-1, 1]) {
    G.extrude([[-hw, 0], [hw, 0], [0, top - b0]], 0.03, { x: e * (w / 2 + 0.006), y: b0, ry: HP, color: col });
    if (beam) { G.box(0.03, (top - b0) * 0.8, 0.05, { x: e * (w / 2 + 0.02), y: b0 + (top - b0) * 0.4, color: beam }); G.box(0.03, 0.045, hw * 1.3, { x: e * (w / 2 + 0.02), y: b0 + (top - b0) * 0.3, color: beam }); }
  }
}
/** Muro entramado (yeso + vigas) de w×h×d con base en y. ry gira el conjunto. */
function hTimber(G, w, h, d, y, o = {}) {
  G.box(w, h, d, { y: y + h / 2, color: o.plaster || PLA });
  G.box(w + 0.04, 0.05, d + 0.04, { y: y + 0.02, color: BEAM });
  G.box(w + 0.04, 0.05, d + 0.04, { y: y + h - 0.02, color: BEAM });
  const nx = Math.max(1, Math.round(w / 0.45)), nz = Math.max(1, Math.round(d / 0.5));
  for (let i = 0; i <= nx; i++) { const x = -w / 2 + i * w / nx; G.box(0.05, h, 0.04, { x, y: y + h / 2, z: d / 2 + 0.01, color: BEAM }); if (o.back) G.box(0.05, h, 0.04, { x, y: y + h / 2, z: -d / 2 - 0.01, color: BEAM }); }
  for (let i = 0; i <= nz; i++) { const z = -d / 2 + i * d / nz; for (const s of [-1, 1]) if (o.sides !== false && i > 0 && i < nz) G.box(0.04, h, 0.05, { x: s * (w / 2 + 0.01), y: y + h / 2, z, color: BEAM }); }
  if (o.brace !== false) for (let i = 0; i < nx; i += 2) { const x = -w / 2 + (i + 0.5) * w / nx, a = Math.atan2(w / nx, h) * (i % 4 ? -1 : 1); G.box(0.04, Math.hypot(h, w / nx) * 0.95, 0.03, { x, y: y + h / 2, z: d / 2 + 0.015, rz: a, color: BEAM }); }
}
/** Puerta de madera con arco, marco de piedra y herrajes; mira a +Z del grupo. */
function hDoor(G, x, z, w, h, o = {}) {
  const y = o.y || 0;
  G.extrude(archPts(w + 0.08, h + 0.05), 0.04, { x, y, z: z - 0.005, color: o.frame || HS_L });
  G.extrude(archPts(w, h), 0.05, { x, y, z, color: o.col || HDOOR });
  G.box(0.02, h * 0.82, 0.056, { x, y: y + h * 0.41, z, color: shade(o.col || HDOOR, -0.1) });
  for (const yy of [0.3, 0.7]) G.box(w * 0.9, 0.025, 0.06, { x, y: y + h * yy, z, color: IRON });
}
/** Chimenea de piedra con remate. */
function hChimney(G, x, z, y0, h, s = 0.2) {
  G.box(s, h, s, { x, y: y0 + h / 2, z, color: HS });
  G.box(s + 0.05, 0.05, s + 0.05, { x, y: y0 + h - 0.02, z, color: HS_D });
  G.box(s + 0.03, 0.04, s + 0.03, { x, y: y0 + h * 0.55, z, color: HS_D });
}
/** Zócalo de piedra (hunde 0.1 bajo el suelo) con hilada de sillares en la cara frontal. */
function hPlinth(G, w, d, h, o = {}) {
  G.box(w, h + 0.1, d, { y: (h - 0.1) / 2, color: o.col || HS_D });
  G.box(w + 0.02, 0.035, d + 0.02, { y: h - 0.015, color: o.top || HS });
}
/** Escalones frontales. */
function steps(G, x, z, w, n, rise, run, col) { for (let i = 0; i < n; i++) G.box(w, rise * (n - i), run, { x, y: rise * (n - i) / 2, z: z + i * run, color: shade(col, i * 0.02) }); }

const HUMAN = {
  // ------------------------------------------------------------------ casa (2×2)
  human_house: {
    fp: 2, smoke: [[0.42, 1.42, -0.28]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.62, 0.16, 1.46, { y: -0.03, color: HS_D });
      b.box(1.5, 0.3, 1.3, { y: 0.15, color: HS });
      for (let i = 0; i < 7; i++) b.box(0.2, 0.09, 0.02, { x: -0.62 + i * 0.205 + (i % 2) * 0.03, y: 0.08 + (i % 2) * 0.12, z: 0.655, color: shade(HS, -0.06) });
      b.box(1.42, 0.42, 1.22, { y: 0.51, color: PLA });
      for (const x of [-0.7, -0.24, 0.24, 0.7]) b.box(0.05, 0.43, 0.05, { x, y: 0.51, z: 0.6, color: BEAM });
      for (const z of [-0.6, 0, 0.6]) for (const x of [-0.71, 0.71]) b.box(0.05, 0.43, 0.05, { x, y: 0.51, z, color: BEAM });
      b.box(1.46, 0.05, 1.26, { y: 0.3, color: BEAM }); b.box(1.46, 0.05, 1.26, { y: 0.72, color: BEAM });
      b.box(0.05, 0.5, 0.03, { x: -0.47, y: 0.51, z: 0.61, rz: 0.72, color: BEAM });
      b.box(0.05, 0.5, 0.03, { x: 0.47, y: 0.51, z: 0.61, rz: -0.72, color: BEAM });
      // tejado con buhardilla
      b.wedge(1.72, 0.6, 1.5, { y: 0.74, color: TILE });
      for (let i = 1; i < 4; i++) { const t = i / 4, y = 0.74 + 0.6 * t, d = 0.75 * (1 - t); for (const s of [-1, 1]) b.box(1.74, 0.025, 0.05, { y: y - 0.005, z: s * d, rx: s * 0.67, color: TILE_D }); }
      b.box(1.76, 0.06, 0.08, { y: 1.34, color: 'team' });
      b.box(0.06, 0.08, 1.52, { x: -0.86, y: 0.75, color: 'team', teamShade: 0.75 });
      b.box(0.06, 0.08, 1.52, { x: 0.86, y: 0.75, color: 'team', teamShade: 0.75 });
      b.box(0.34, 0.3, 0.36, { x: -0.28, y: 1.0, z: 0.42, color: PLA });
      b.wedge(0.3, 0.17, 0.44, { x: -0.28, y: 1.14, z: 0.44, ry: HP, color: TILE });
      b.box(0.05, 0.05, 0.44, { x: -0.28, y: 1.31, z: 0.44, color: 'team' });
      win(b, -0.28, 1.0, 0.6, 0.14, 0.15, { frame: BEAM });
      // chimenea
      b.box(0.2, 0.62, 0.2, { x: 0.42, y: 1.1, z: -0.28, color: HS });
      b.box(0.25, 0.05, 0.25, { x: 0.42, y: 1.41, z: -0.28, color: HS_D });
      // puerta, toldo y ventanas con jardineras
      b.box(0.26, 0.4, 0.04, { x: -0.25, y: 0.2, z: 0.66, color: HDOOR });
      b.box(0.3, 0.04, 0.05, { x: -0.25, y: 0.42, z: 0.665, color: BEAM });
      b.box(0.36, 0.03, 0.16, { x: -0.25, y: 0.47, z: 0.73, rx: 0.35, color: 'team' });
      steps(G, -0.25, 0.7, 0.32, 1, 0.06, 0.12, HS);
      for (const x of [0.15, 0.45]) {
        b.box(0.16, 0.16, 0.03, { x, y: 0.52, z: 0.62, color: GLASS });
        b.box(0.04, 0.17, 0.035, { x: x - 0.1, y: 0.52, z: 0.625, color: 'team', teamShade: 0.85 }); b.box(0.04, 0.17, 0.035, { x: x + 0.1, y: 0.52, z: 0.625, color: 'team', teamShade: 0.85 });
        b.box(0.2, 0.05, 0.07, { x, y: 0.42, z: 0.65, color: HW });
        b.ball(0.035, 0, { x: x - 0.05, y: 0.46, z: 0.655, color: x > 0.3 ? '#e05a6a' : '#f0c040' }); b.ball(0.035, 0, { x: x + 0.05, y: 0.465, z: 0.655, color: '#5e9a3c' });
      }
      // banderola en el piñón
      flag(b, -0.72, 1.3, 0.0, 0.42, { w: 0.3, fh: 0.17, r: 0.018 });
      // barril y leña
      barrel(b, 0.62, 0.74, 0.08, 0.17);
      for (let i = 0; i < 3; i++) b.cyl(0.03, 0.03, 0.3, 6, { x: -0.73 - (i === 2 ? 0 : 0), y: 0.035 + (i === 2 ? 0.05 : 0), z: 0.22 - i * 0.065 + (i === 2 ? 0.1 : 0), rx: HP, color: '#9a7046' });
    },
  },

  // ------------------------------------------------------------------ centro urbano (4×4)
  human_tc: {
    fp: 4, smoke: [[-0.75, 2.12, -0.75], [0.85, 2.12, -0.85]], fire: [[-1, 1.4, -0.4], [1, 1.4, -0.4], [0, 1.8, 0.4], [-1.3, 1, 0.4]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      // plaza empedrada
      b.box(3.8, 0.2, 3.8, { y: -0.02, color: HS_D });
      b.box(3.7, 0.04, 3.7, { y: 0.09, color: '#b0a796' });
      for (const [x, z, w] of [[-1.1, 1.4, 0.5], [0.9, 1.55, 0.6], [-0.4, 1.7, 0.4], [1.5, 1.1, 0.3]]) b.box(w, 0.025, 0.22, { x, y: 0.11, z, color: '#a39a88' });
      const y0 = 0.1;
      // sala principal
      hPlinth(grp(b, 0, y0, -0.45), 2.7, 1.5, 0.12);
      b.box(2.56, 0.55, 1.4, { y: y0 + 0.39, z: -0.45, color: HS });
      for (const x of spread(6, -1.25, 1.25)) b.box(0.2, 0.08, 0.02, { x, y: y0 + 0.3 + (Math.round(x * 4) % 2 ? 0.17 : 0), z: 0.26, color: HS_D });
      hTimber(grp(b, 0, 0, -0.45), 2.5, 0.48, 1.34, y0 + 0.66, { brace: true });
      hRoof(grp(b, 0, 0, -0.45), 2.8, 0.82, 1.78, y0 + 1.14, { rows: 3 });
      for (const x of [-0.62, 0.62]) win(b, x, y0 + 0.9, 0.24, 0.15, 0.2, { shutter: 'team' });
      hChimney(G, -0.75, -0.75, 1.3, 0.82);
      hChimney(G, 0.85, -0.85, 1.3, 0.82);
      // alas laterales con piñón frontal
      for (const s of [-1, 1]) {
        const W = grp(b, s * 1.32, y0, -0.15);
        hPlinth(W, 1.0, 1.9, 0.1);
        W.box(0.92, 0.5, 1.8, { y: 0.35, color: HS });
        hTimber(W, 0.88, 0.42, 1.76, 0.6, { brace: false });
        hRoof(grp(b, s * 1.32, 0, -0.15, HP), 2.0, 0.6, 1.1, y0 + 1.02, { rows: 2, gable: PLA, gableBeam: BEAM });
        win(b, s * 1.32 + s * 0.18, y0 + 0.8, 0.77, 0.15, 0.2, { shutter: 'team' });
        win(b, s * 1.32, y0 + 1.2, 0.89, 0.1, 0.12, { bar: false });
        W.extrude(archPts(0.24, 0.36), 0.04, { x: -s * 0.17, y: 0.1, z: 0.76, color: HDOOR });
        banner(b, s * 1.32 - s * 0.42, y0 + 1.0, 0.78, 0.16, 0.4, { emb: 'cross' });
      }
      // torre del reloj/campanario central
      const T = grp(b, 0, y0, 0.45);
      hPlinth(T, 0.9, 0.9, 0.12);
      T.box(0.8, 1.2, 0.8, { y: 0.72, color: HS_L });
      for (const [x, z] of [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4]]) for (let i = 0; i < 4; i++) T.box(0.1, 0.12, 0.1, { x: x * 1.02, y: 0.25 + i * 0.27, z: z * 1.02, color: HS });
      T.box(0.9, 0.08, 0.9, { y: 1.34, color: HS_D });
      // campanario abierto
      for (const [x, z] of [[-0.34, 0.34], [0.34, 0.34], [-0.34, -0.34], [0.34, -0.34]]) T.box(0.1, 0.42, 0.1, { x, y: 1.59, z, color: HS_L });
      T.cyl(0.07, 0.12, 0.16, 8, { y: 1.62, color: GOLD });
      T.box(0.84, 0.06, 0.84, { y: 1.82, color: BEAM });
      T.pyramid(1.0, 0.72, 1.0, { y: 2.21, color: TILE });
      T.box(1.02, 0.06, 1.02, { y: 1.87, color: 'team' });
      T.cyl(0.015, 0.015, 0.2, 5, { y: 2.65, color: GOLD }); T.ball(0.04, 0, { y: 2.6, color: GOLD });
      // reloj
      T.cyl(0.17, 0.17, 0.03, 10, { y: 1.12, z: 0.41, rx: HP, color: CLOTH });
      T.cyl(0.2, 0.2, 0.025, 10, { y: 1.12, z: 0.405, rx: HP, color: GOLD });
      T.box(0.02, 0.12, 0.02, { y: 1.16, z: 0.43, color: '#3a2c20' }); T.box(0.09, 0.02, 0.02, { x: 0.035, y: 1.12, z: 0.43, color: '#3a2c20' });
      // portón
      hDoor(T, 0, 0.405, 0.36, 0.5, { y: 0.12 });
      heater(b, -0.26, y0 + 0.86, 0.87, 0, 0.9); heater(b, 0.26, y0 + 0.86, 0.87, 0, 0.9);
      steps(G, 0, 0.92, 0.6, 2, 0.05, 0.12, HS);
      // banderas de la plaza
      flag(b, -0.85, y0, 1.45, 1.55, { w: 0.42, fh: 0.26, shape: 'tail' });
      flag(b, 0.85, y0, 1.45, 1.55, { w: 0.42, fh: 0.26, shape: 'tail' });
      for (const x of [-0.85, 0.85]) b.box(0.14, 0.08, 0.14, { x, y: y0 + 0.04, z: 1.45, color: HS_D });
      // pozo
      const P = grp(b, -1.35, y0, 1.25);
      P.cyl(0.2, 0.22, 0.22, 8, { y: 0.11, color: HS }); P.cyl(0.15, 0.15, 0.03, 8, { y: 0.22, color: '#3d5f7a' });
      for (const s of [-1, 1]) P.box(0.04, 0.4, 0.04, { x: s * 0.17, y: 0.38, color: BEAM });
      P.wedge(0.5, 0.15, 0.32, { y: 0.56, color: TILE });
      // carro con mercancías y cajas
      crate(b, 1.4, y0, 1.25, 0.18); crate(b, 1.55, y0, 1.05, 0.15, { ry: 0.4 }); crate(b, 1.4, y0 + 0.18, 1.22, 0.13, { ry: 0.2 });
      barrel(b, 1.15, 1.5, 0.09, 0.2); sack(b, 1.62, y0, 1.42); sack(b, -1.62, y0, 0.9, 0.9);
    },
  },

  // ------------------------------------------------------------------ cuartel (3×3)
  human_barracks: {
    fp: 3, smoke: [[-0.9, 1.75, -1.0]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.03, color: '#9a8a6c' });
      b.box(2.7, 0.03, 1.5, { y: 0.05, z: 0.62, color: '#a8966f' });
      // salón principal
      const M = grp(b, 0, 0, -0.68);
      hPlinth(M, 2.66, 1.3, 0.12);
      M.box(2.5, 0.42, 1.18, { y: 0.33, color: HS });
      hTimber(M, 2.44, 0.42, 1.12, 0.54, { brace: true });
      hRoof(M, 2.74, 0.72, 1.5, 0.96, { rows: 3 });
      hChimney(G, -0.9, -1.0, 1.1, 0.65);
      hDoor(M, 0, 0.6, 0.4, 0.5, { y: 0.12 });
      M.box(0.7, 0.42, 0.5, { y: 1.15, z: 0.38, color: PLA });
      hRoof(grp(b, 0, 0, -0.68 + 0.36, HP), 0.74, 0.42, 0.86, 1.33, { rows: 1, gable: PLA, gableBeam: BEAM });
      win(b, 0, 1.2, -0.68 + 0.74, 0.16, 0.16, { shutter: 'team' });
      M.box(0.6, 0.05, 0.22, { y: 0.66, z: 0.68, rx: 0.3, color: 'team' });
      for (const x of [-0.85, -0.45, 0.45, 0.85]) win(b, x, 0.75, -0.11, 0.15, 0.17, { shutter: x < 0 ? 'team' : 'team' });
      for (const x of [-0.65, 0.65]) heater(b, x, 0.36, -0.07, 0, 0.95);
      // torre de vigía en la esquina
      const T = grp(b, 0.97, 0, -0.95);
      T.box(0.6, 1.5, 0.6, { y: 0.75, color: HS });
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) T.box(0.1, 0.12, 0.1, { x: s * 0.3, y: 0.15 + i * 0.3, z: 0.3, color: HS_L });
      T.box(0.7, 0.3, 0.7, { y: 1.62, color: PLA }); T.box(0.72, 0.05, 0.72, { y: 1.48, color: BEAM }); T.box(0.72, 0.05, 0.72, { y: 1.76, color: BEAM });
      T.box(0.16, 0.14, 0.03, { y: 1.62, z: 0.36, color: GLASS });
      T.pyramid(0.86, 0.55, 0.86, { y: 2.06, color: TILE }); T.box(0.88, 0.05, 0.88, { y: 1.8, color: 'team' });
      flag(b, 0.97, 2.3, -0.95, 0.45, { w: 0.34, fh: 0.2, shape: 'tail' });
      // patio: armero de lanzas
      const R = grp(b, -0.85, 0.05, 0.55);
      for (const s of [-1, 1]) R.box(0.05, 0.42, 0.05, { x: s * 0.35, y: 0.21, color: BEAM });
      R.box(0.78, 0.05, 0.06, { y: 0.36, color: BEAM }); R.box(0.78, 0.05, 0.12, { y: 0.06, color: BEAM });
      for (const x of spread(5, -0.3, 0.3)) { R.cyl(0.012, 0.012, 0.62, 5, { x, y: 0.33, z: 0.03, rx: -0.12, color: HW_L }); R.cone(0.025, 0.08, 4, { x, y: 0.68, z: 0.07, rx: -0.12, color: STEEL }); }
      // escudos apoyados
      for (const [x, z, a] of [[-1.25, 0.95, 0.3], [-1.1, 1.15, 0.6]]) heater(b, x, 0.2, z, a, 1.1);
      // muñeco de entrenamiento
      const D = grp(b, 0.55, 0.05, 0.65, -0.3);
      D.cyl(0.025, 0.03, 0.6, 5, { y: 0.3, color: HW });
      D.box(0.4, 0.04, 0.04, { y: 0.47, color: HW });
      D.blob(0.1, 0.14, 0.08, 0, { y: 0.42, color: STRAW }); D.ball(0.07, 0, { y: 0.62, color: STRAW });
      D.box(0.16, 0.12, 0.09, { y: 0.4, z: 0.02, color: 'team' });
      heater(b, 0.33, 0.47, 0.73, -0.3, 0.8);
      D.box(0.24, 0.03, 0.24, { y: 0.015, color: HW });
      // estandarte grande del patio
      flag(b, 1.1, 0.05, 1.05, 1.4, { w: 0.46, fh: 0.28, emblem: CLOTH, ry: PI });
      b.box(0.16, 0.08, 0.16, { x: 1.1, y: 0.06, z: 1.05, color: HS_D });
      // armero de espadas y tonel
      barrel(b, -0.2, 1.05, 0.085, 0.2); for (const [x, a] of [[-0.23, 0.2], [-0.17, -0.25]]) b.box(0.02, 0.3, 0.012, { x, y: 0.33, z: 1.05, rz: a, color: STEEL });
      // vallado bajo del patio
      for (const s of [-1, 1]) { b.box(0.05, 0.2, 1.4, { x: s * 1.36, y: 0.1, z: 0.62, color: BEAM }); for (const z of [0.05, 0.62, 1.2]) b.box(0.07, 0.28, 0.07, { x: s * 1.36, y: 0.14, z, color: HW }); }
    },
  },

  // ------------------------------------------------------------------ molino (2×2)
  human_mill: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.cyl(0.82, 0.86, 0.22, 8, { y: 0.0, color: HS_D });
      b.cyl(0.62, 0.66, 0.1, 8, { y: 0.15, color: HS });
      // torre troncocónica de yeso con base de piedra
      b.cyl(0.42, 0.54, 1.28, 8, { y: 0.84, color: PLA });
      b.cyl(0.555, 0.58, 0.34, 8, { y: 0.36, color: HS });
      b.cyl(0.47, 0.48, 0.06, 8, { y: 0.96, color: BEAM });
      b.cyl(0.43, 0.44, 0.06, 8, { y: 1.46, color: BEAM });
      // capota cónica de teja con anillo del equipo
      b.cyl(0.57, 0.6, 0.08, 8, { y: 1.5, color: 'team' });
      b.cone(0.58, 0.5, 8, { y: 1.79, color: TILE });
      b.cone(0.3, 0.27, 8, { y: 1.93, color: 'team', teamShade: 0.85 });
      flag(b, 0, 2.0, -0.04, 0.36, { w: 0.28, fh: 0.17, shape: 'pennant' });
      hDoor(G, 0, 0.6, 0.24, 0.36, { y: 0.2 });
      win(b, 0, 1.12, 0.47, 0.12, 0.14, { bar: false });
      win(b, 0.42, 0.8, 0.25, 0.1, 0.13, { ry: 1.05, bar: false });
      win(b, -0.42, 0.8, 0.25, 0.1, 0.13, { ry: -1.05, bar: false });
      // eje y aspas giratorias (lienzo alterno equipo / blanco)
      const hy = 1.34, hz = 0.66, sp = { c: [0, hy, hz], axis: [0, 0, 1], speed: 1.0 };
      b.cyl(0.04, 0.05, 0.3, 6, { y: hy, z: hz - 0.14, rx: HP, color: BEAM });
      b.cyl(0.08, 0.08, 0.08, 8, { y: hy, z: hz, rx: HP, color: IRON, spin: sp });
      for (let i = 0; i < 4; i++) {
        const a = i * HP + 0.35, ca = Math.cos(a), sa = Math.sin(a), L = 0.88, at = (d, o) => [-sa * d + ca * o, hy + ca * d + sa * o];
        let [x, y] = at(L / 2, 0); b.box(0.045, L, 0.045, { x, y, z: hz + 0.02, rz: a, color: BEAM, spin: sp });
        [x, y] = at(0.54, 0.135); b.box(0.22, 0.64, 0.026, { x, y, z: hz + 0.05, rz: a, color: i % 2 ? 'team' : CLOTH, spin: sp });
        [x, y] = at(0.54, 0.255); b.box(0.026, 0.66, 0.04, { x, y, z: hz + 0.04, rz: a, color: HW_L, spin: sp });
        for (const d of [0.25, 0.54, 0.84]) { [x, y] = at(d, 0.13); b.box(0.27, 0.026, 0.04, { x, y, z: hz + 0.04, rz: a, color: HW_L, spin: sp }); }
      }
      // anexo de almacén
      const A = grp(b, -0.6, 0, -0.45);
      A.box(0.48, 0.42, 0.62, { y: 0.21, color: HW_L });
      A.wedge(0.56, 0.24, 0.6, { y: 0.42, ry: HP, color: TILE });
      A.box(0.05, 0.05, 0.62, { y: 0.66, ry: HP, color: 'team' });
      // sacos de grano y carretilla
      sack(b, 0.55, 0.12, 0.48); sack(b, 0.68, 0.12, 0.35, 0.9); sack(b, 0.6, 0.24, 0.42, 0.8);
      sack(b, -0.62, 0.12, 0.42, 0.9);
      b.cyl(0.11, 0.11, 0.03, 8, { x: 0.68, y: 0.11, z: -0.48, rz: HP, color: HW });
      b.box(0.24, 0.07, 0.36, { x: 0.55, y: 0.18, z: -0.42, color: HW_L });
    },
  },

  // ------------------------------------------------------------------ aserradero (2×2)
  human_lumber: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.12, 1.84, { y: -0.02, color: '#8f7a58' });
      for (let i = 0; i < 6; i++) b.box(0.05, 0.02, 0.04, { x: -0.3 + i * 0.13, y: 0.05, z: 0.3 + (i % 3) * 0.12, ry: i, color: '#d9b98a' });
      // cobertizo con tejado a un agua
      const S = grp(b, 0.1, 0, -0.5);
      S.box(1.5, 0.08, 0.7, { y: 0.06, color: HW });
      for (const x of [-0.7, 0, 0.7]) { S.box(0.07, 0.95, 0.07, { x, y: 0.5, z: -0.32, color: BEAM }); S.box(0.07, 0.74, 0.07, { x, y: 0.4, z: 0.32, color: BEAM }); }
      S.box(1.42, 0.55, 0.05, { y: 0.4, z: -0.34, color: HW_L });
      S.box(1.62, 0.05, 0.92, { y: 0.88, z: 0.0, rx: 0.27, color: TILE });
      for (const z of [-0.2, 0.15]) S.box(1.63, 0.02, 0.04, { y: 0.9 - z * 0.27 + 0.03, z, color: TILE_D });
      S.box(1.64, 0.07, 0.06, { y: 0.76, z: 0.44, color: 'team' });
      S.box(1.64, 0.07, 0.06, { y: 1.0, z: -0.44, color: 'team', teamShade: 0.8 });
      // tablones apilados bajo el cobertizo
      for (let i = 0; i < 4; i++) S.box(0.9, 0.05, 0.22, { x: -0.25, y: 0.13 + i * 0.055, z: -0.05 + (i % 2) * 0.03, color: shade('#c49a68', i * 0.02) });
      for (let i = 0; i < 3; i++) S.box(0.1, 0.5, 0.03, { x: 0.35 + i * 0.12, y: 0.4, z: -0.3, rz: 0.08, color: '#c49a68' });
      // sierra colgada
      S.box(0.36, 0.06, 0.02, { x: 0.45, y: 0.62, z: -0.3, color: STEEL });
      // pila de troncos
      const L = [[-0.5, 0.1, 0.3], [-0.5, 0.1, 0.48], [-0.5, 0.1, 0.66], [-0.5, 0.25, 0.39], [-0.5, 0.25, 0.57], [-0.5, 0.4, 0.48]];
      for (const [x, y, z] of L) log(b, x, y, z, 0.72, 0.085, { ry: 0 });
      for (const s of [-1, 1]) b.box(0.05, 0.36, 0.05, { x: -0.5 + s * 0.3, y: 0.18, z: 0.77, color: BEAM });
      // caballete con tronco y sierra de dos mangos
      const H = grp(b, 0.48, 0, 0.45);
      for (const s of [-1, 1]) { H.box(0.04, 0.34, 0.04, { x: s * 0.25, y: 0.16, z: 0.08, rx: 0.35, color: BEAM }); H.box(0.04, 0.34, 0.04, { x: s * 0.25, y: 0.16, z: -0.08, rx: -0.35, color: BEAM }); }
      log(b, 0.48, 0.34, 0.45, 0.7, 0.07);
      H.box(0.03, 0.38, 0.12, { x: 0.05, y: 0.4, z: 0.05, rx: 0.3, color: STEEL });
      H.box(0.16, 0.03, 0.03, { x: 0.05, y: 0.58, z: 0.11, color: HW });
      // tajo con hacha
      b.cyl(0.11, 0.12, 0.18, 7, { x: 0.2, y: 0.09, z: 0.75, color: '#6b4a2c' }); b.cyl(0.1, 0.1, 0.02, 7, { x: 0.2, y: 0.18, z: 0.75, color: '#d9b98a' });
      b.cyl(0.012, 0.012, 0.28, 5, { x: 0.27, y: 0.3, z: 0.75, rz: -0.6, color: HW_L }); b.box(0.08, 0.06, 0.02, { x: 0.2, y: 0.21, z: 0.75, rz: -0.6, color: STEEL });
      flag(b, -0.62, 0.0, -0.84, 1.3, { w: 0.32, fh: 0.2, shape: 'tail' });
    },
  },

  // ------------------------------------------------------------------ campamento minero (2×2)
  human_mine: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.12, 1.84, { y: -0.02, color: '#8d846f' });
      // montículo rocoso
      const RK = '#8f8b84';
      for (const [x, y, z, r] of [[0, 0.3, -0.42, 0.5], [-0.48, 0.2, -0.48, 0.42], [0.48, 0.22, -0.5, 0.4], [-0.15, 0.62, -0.5, 0.36], [0.28, 0.55, -0.55, 0.32], [-0.66, 0.1, -0.05, 0.25], [0.66, 0.1, -0.1, 0.24]]) rock(b, x, y, z, r, shade(RK, (x * 7 % 3) * 0.02 - 0.02));
      for (const [x, y, z] of [[-0.35, 0.5, -0.32], [0.42, 0.45, -0.3], [0.1, 0.78, -0.45]]) b.box(0.06, 0.05, 0.05, { x, y, z, rx: 0.5, ry: x * 4, color: GOLD, glow: 0.25 });
      // bocamina entibada
      b.box(0.5, 0.48, 0.2, { y: 0.27, z: -0.08, color: '#3a2c20' });
      for (const s of [-1, 1]) b.box(0.09, 0.6, 0.09, { x: s * 0.29, y: 0.3, z: 0.02, color: BEAM });
      b.box(0.78, 0.1, 0.12, { y: 0.62, z: 0.02, color: BEAM });
      for (const s of [-1, 1]) b.box(0.05, 0.3, 0.05, { x: s * 0.2, y: 0.5, z: 0.06, rz: s * 0.8, color: BEAM });
      b.box(0.34, 0.12, 0.03, { y: 0.75, z: 0.03, color: HW_L }); b.box(0.06, 0.06, 0.04, { y: 0.75, z: 0.05, color: 'team' });
      // raíles
      for (const s of [-1, 1]) b.box(0.025, 0.03, 1.0, { x: s * 0.12, y: 0.065, z: 0.45, color: IRON });
      for (const z of spread(6, -0.05, 0.95)) b.box(0.36, 0.025, 0.07, { y: 0.05, z, color: HW });
      // vagoneta cargada
      const V = grp(b, 0, 0.08, 0.5);
      V.frustum(0.3, 0.38, 0.18, 0.36, 0.44, { y: 0.06, color: HW });
      V.box(0.38, 0.03, 0.46, { y: 0.24, color: IRON });
      for (const [x, z] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) V.cyl(0.055, 0.055, 0.03, 8, { x, y: 0.05, z, rz: HP, color: IRON });
      for (const [x, z, c] of [[-0.06, -0.08, GOLD], [0.07, 0.06, '#8f8b84'], [0.02, -0.02, GOLD], [-0.07, 0.1, '#9a5a3a']]) V.ball(0.075, 0, { x, y: 0.27, z, color: c, glow: c === GOLD ? 0.2 : 0 });
      // grúa de polea a la derecha
      const C = grp(b, 0.62, 0, 0.35);
      for (const s of [-1, 1]) C.box(0.05, 0.9, 0.05, { x: s * 0.12, y: 0.45, z: 0, rz: -s * 0.12, color: BEAM });
      C.box(0.06, 0.06, 0.5, { y: 0.88, z: 0.12, color: BEAM });
      C.torus(0.08, 0.018, 8, 4, { y: 0.84, z: 0.32, ry: HP, color: IRON });
      C.box(0.012, 0.4, 0.012, { y: 0.6, z: 0.38, color: '#c8b07a' });
      C.cyl(0.07, 0.06, 0.12, 7, { y: 0.36, z: 0.38, color: HW_L });
      // bloques de piedra y picos
      for (const [x, z, y] of [[-0.64, 0.5, 0.06], [-0.45, 0.58, 0.06], [-0.55, 0.53, 0.2]]) b.box(0.16, 0.13, 0.14, { x, y: y + 0.065, z, ry: x, color: HS_L });
      for (const [x, z, a] of [[-0.82, 0.85, 0.4], [-0.3, 0.86, -0.3]]) { b.cyl(0.012, 0.012, 0.32, 5, { x, y: 0.2, z, rz: a, color: HW_L }); b.box(0.18, 0.03, 0.03, { x: x - Math.sin(a) * 0.15, y: 0.35, z, rz: a, color: STEEL }); }
      // farol
      b.cyl(0.015, 0.015, 0.55, 5, { x: 0.38, y: 0.32, z: 0.08, color: BEAM }); b.box(0.07, 0.09, 0.07, { x: 0.38, y: 0.56, z: 0.12, color: '#ffc860', glow: 0.9 });
      barrel(b, 0.75, 0.8, 0.08, 0.18);
      // tolda del equipo sobre el montón de mineral
      const TD = grp(b, -0.55, 0, 0.55);
      for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) TD.box(0.04, 0.5, 0.04, { x, y: 0.25, z, color: BEAM });
      TD.wedge(0.66, 0.2, 0.56, { y: 0.48, color: 'team' }); TD.box(0.68, 0.03, 0.04, { y: 0.68, color: CLOTH });
      flag(b, -0.33, 0.66, 0.02, 0.62, { w: 0.3, fh: 0.18, shape: 'tail' });
    },
  },

  // ------------------------------------------------------------------ granja (3×3, plana)
  human_farm: {
    fp: 3,
    build(b) { farm(b, 'human'); },
  },

  // ------------------------------------------------------------------ galería de tiro (3×3)
  human_range: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.12, 2.84, { y: -0.02, color: '#8aa05c' });
      for (const z of [-0.85, 0, 0.85]) b.box(1.9, 0.02, 0.36, { x: 0.25, y: 0.05, z, color: '#a3b06c' });
      // pabellón de tiro a la izquierda
      const S = grp(b, -0.88, 0, -0.05);
      S.box(0.9, 0.08, 2.5, { y: 0.06, color: HW });
      for (const z of [-1.1, -0.37, 0.37, 1.1]) for (const s of [-1, 1]) S.box(0.07, 0.86, 0.07, { x: s * 0.36, y: 0.5, z, color: BEAM });
      S.box(0.06, 0.45, 2.3, { x: -0.38, y: 0.32, color: HW_L });
      hRoof(grp(b, -0.88, 0, -0.05, HP), 2.66, 0.55, 1.02, 0.92, { rows: 2 });
      // armero de arcos y carcajes
      for (const z of [-0.8, -0.55, 0.55, 0.8]) { b.extrude(archRing(0.17, 0.145, 5, 1), 0.03, { x: -1.22, y: 0.5, z, rz: -HP, ry: HP, order: 'YXZ', color: HW_L }); b.box(0.008, 0.34, 0.012, { x: -1.225, y: 0.5, z, color: CLOTH }); }
      for (const z of [-0.15, 0.15]) { b.cyl(0.05, 0.045, 0.24, 6, { x: -0.7, y: 0.22, z, color: '#6b4a2c' }); for (const k of [-1, 1]) b.box(0.01, 0.12, 0.01, { x: -0.7 + k * 0.015, y: 0.38, z, color: CLOTH }); }
      banner(b, -0.88, 0.88, 1.17, 0.2, 0.38, { emb: 'cross' });
      // dianas giradas hacia el pabellón y la cámara
      for (const [z, i] of [[-0.85, 0], [0, 1], [0.85, 2]]) {
        const T = grp(b, 0.95, 0.04, z, -0.85);
        for (const s of [-1, 1]) T.box(0.04, 0.6, 0.04, { x: s * 0.16, y: 0.28, z: -0.06, rx: -0.15, color: BEAM });
        T.box(0.04, 0.5, 0.04, { y: 0.24, z: -0.16, rx: 0.4, color: BEAM });
        T.cyl(0.25, 0.25, 0.08, 10, { y: 0.42, rx: HP, color: STRAW });
        T.cyl(0.2, 0.2, 0.09, 10, { y: 0.42, rx: HP, color: CLOTH });
        T.cyl(0.14, 0.14, 0.1, 10, { y: 0.42, rx: HP, color: 'team' });
        T.cyl(0.07, 0.07, 0.11, 8, { y: 0.42, rx: HP, color: GOLD });
        T.box(0.012, 0.012, 0.2, { x: 0.05 - i * 0.04, y: 0.45 + i * 0.03, z: 0.1, color: HW_L });
        T.box(0.03, 0.03, 0.03, { x: 0.05 - i * 0.04, y: 0.45 + i * 0.03, z: 0.2, color: CLOTH });
      }
      // balas de paja detrás
      for (const [x, z] of [[1.25, -0.4], [1.25, 0.45]]) { b.box(0.22, 0.2, 0.36, { x, y: 0.12, z, ry: 0.2, color: STRAW }); b.box(0.23, 0.02, 0.37, { x, y: 0.15, z, ry: 0.2, color: '#b89a4a' }); }
      // cuerda con banderines
      b.cyl(0.02, 0.025, 1.0, 5, { x: 0.15, y: 0.5, z: 1.25, color: BEAM });
      b.cyl(0.006, 0.006, 1.0, 4, { x: -0.3, y: 0.94, z: 1.25, rz: HP + 0.08, color: '#c8b07a' });
      for (const x of spread(4, -0.75, 0.1)) b.extrude([[-0.05, 0], [0.05, 0], [0, -0.1]], 0.026, { x, y: 0.94 + (x - 0.15) * 0.08, z: 1.25, color: 'team', flag: 0.8 });
      flag(b, 1.2, 0.04, 1.2, 1.45, { w: 0.4, fh: 0.24, shape: 'tail', ry: PI });
    },
  },

  // ------------------------------------------------------------------ establo (3×3)
  human_stable: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.12, 2.84, { y: -0.02, color: '#8f8a5c' });
      // granero principal (piñón al frente)
      const B = grp(b, -0.55, 0, -0.35);
      hPlinth(B, 1.56, 1.96, 0.12);
      B.box(1.46, 0.72, 1.86, { y: 0.48, color: '#9a5a3a' });
      for (const x of spread(6, -0.73, 0.73)) B.box(0.02, 0.72, 0.02, { x, y: 0.48, z: 0.935, color: shade('#9a5a3a', -0.1) });
      B.box(1.5, 0.05, 1.9, { y: 0.86, color: BEAM });
      hRoof(grp(b, -0.55, 0, -0.35, HP), 2.06, 0.75, 1.68, 0.86, { rows: 3, gable: '#a8643f' });
      // portón doble con aspa
      B.box(0.62, 0.56, 0.04, { y: 0.4, z: 0.95, color: '#6a4528' });
      for (const s of [-1, 1]) B.box(0.035, 0.74, 0.03, { x: s * 0.15, y: 0.4, z: 0.975, rz: s * 0.5, color: CLOTH });
      B.box(0.66, 0.04, 0.05, { y: 0.69, z: 0.97, color: CLOTH });
      // pajar alto con heno
      B.box(0.28, 0.22, 0.03, { y: 1.1, z: 1.05, color: '#3a2c20' });
      B.blob(0.13, 0.07, 0.06, 0, { y: 1.02, z: 1.07, color: STRAW });
      B.box(0.04, 0.04, 0.3, { y: 1.32, z: 1.12, color: BEAM });
      // cúpula de ventilación y veleta
      B.box(0.26, 0.2, 0.26, { y: 1.68, color: '#a8643f' }); B.pyramid(0.36, 0.22, 0.36, { y: 1.89, color: TILE });
      flag(b, -0.55, 1.98, -0.35, 0.34, { w: 0.28, fh: 0.16, shape: 'pennant' });
      heater(b, -0.9, 0.5, 0.63, 0, 0.9); heater(b, -0.2, 0.5, 0.63, 0, 0.9);
      // ala de cuadras
      const W = grp(b, 0.75, 0, -1.0);
      W.box(1.2, 0.62, 0.7, { y: 0.31, color: '#9a5a3a' });
      W.box(1.3, 0.05, 0.9, { y: 0.7, z: 0.04, rx: -0.25, color: TILE });
      W.box(1.32, 0.06, 0.06, { y: 0.6, z: 0.47, color: 'team' });
      for (const x of [-0.38, 0.0, 0.38]) { W.box(0.26, 0.24, 0.04, { x, y: 0.2, z: 0.36, color: '#6a4528' }); W.box(0.26, 0.22, 0.02, { x, y: 0.46, z: 0.35, color: '#3a2c20' }); }
      // cabeza de caballo asomando
      W.box(0.08, 0.1, 0.18, { x: 0.0, y: 0.47, z: 0.44, rx: 0.4, color: '#8a5a36' });
      W.box(0.03, 0.08, 0.04, { x: 0.0, y: 0.55, z: 0.37, color: '#3a2618' });
      // cercado (paddock)
      const fx0 = 0.2, fx1 = 1.36, fz0 = -0.5, fz1 = 1.36;
      for (const [x, z] of [[fx0, fz1], [fx1, fz1], [fx1, fz0], [fx0, 0.45], [0.78, fz1], [fx1, 0.45]]) b.box(0.06, 0.34, 0.06, { x, y: 0.17, z, color: HW });
      for (const y of [0.14, 0.28]) { b.box(fx1 - fx0, 0.035, 0.035, { x: (fx0 + fx1) / 2, y, z: fz1, color: HW_L }); b.box(0.035, 0.035, fz1 - fz0, { x: fx1, y, z: (fz0 + fz1) / 2, color: HW_L }); b.box(0.035, 0.035, fz1 - 0.45, { x: fx0, y, z: (fz1 + 0.45) / 2, color: HW_L }); }
      // caballo con manta del equipo
      const H = grp(b, 0.78, 0.04, 0.6, -0.5);
      H.blob(0.09, 0.09, 0.2, 0, { y: 0.32, color: '#8a5a36' });
      H.box(0.19, 0.08, 0.22, { y: 0.34, color: 'team' });
      H.box(0.06, 0.18, 0.08, { y: 0.44, z: 0.2, rx: 0.45, color: '#8a5a36' });
      H.box(0.06, 0.07, 0.16, { y: 0.52, z: 0.27, rx: 0.7, color: '#8a5a36' });
      H.box(0.025, 0.16, 0.04, { y: 0.46, z: 0.17, rx: 0.45, color: '#3a2618' });
      for (const [x, z] of [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]]) H.box(0.035, 0.25, 0.04, { x, y: 0.13, z, color: '#7a4e2e' });
      H.box(0.025, 0.16, 0.03, { y: 0.28, z: -0.22, rx: -0.4, color: '#3a2618' });
      // abrevadero y heno
      b.box(0.45, 0.12, 0.16, { x: 1.05, y: 0.08, z: -0.25, color: HW }); b.box(0.4, 0.02, 0.12, { x: 1.05, y: 0.14, z: -0.25, color: '#5f8fb0' });
      for (const [x, z, y] of [[-1.15, 0.95, 0.06], [-0.88, 1.1, 0.06], [-1.0, 1.0, 0.24]]) { b.box(0.26, 0.18, 0.18, { x, y: y + 0.09, z, ry: x, color: STRAW }); b.box(0.265, 0.02, 0.185, { x, y: y + 0.12, z, ry: x, color: '#b89a4a' }); }
      b.cyl(0.02, 0.02, 0.32, 5, { x: -0.6, y: 0.2, z: 0.95, rz: 0.4, color: HW_L }); b.box(0.12, 0.08, 0.02, { x: -0.66, y: 0.36, z: 0.95, rz: 0.4, color: STEEL });
    },
  },

  // ------------------------------------------------------------------ templo (3×3): iglesia con campanario
  human_temple: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.16, 2.84, { y: -0.03, color: HS_D });
      b.box(2.7, 0.04, 2.7, { y: 0.06, color: '#b0a796' });
      // nave
      const N = grp(b, 0.25, 0.08, -0.2);
      hPlinth(N, 1.44, 1.74, 0.1);
      N.box(1.3, 1.0, 1.6, { y: 0.6, color: HS_L });
      for (const z of [-0.53, 0, 0.53]) for (const s of [-1, 1]) { N.frustum(0.2, 0.18, 0.75, 0.08, 0.14, { x: s * 0.7, y: 0.1, z, color: HS }); N.box(0.05, 0.28, 0.03, { x: s * 0.66, y: 0.7, z: z + 0.3, ry: HP, color: '#c8a050', glow: 0.25 }); }
      hRoof(grp(b, 0.25, 0, -0.2, HP), 1.74, 0.78, 1.56, 1.18, { rows: 3, gable: HS_L });
      // ábside
      N.cyl(0.38, 0.4, 0.85, 8, { y: 0.52, z: -0.8, color: HS_L });
      N.cone(0.42, 0.42, 8, { y: 1.14, z: -0.8, color: TILE });
      // rosetón (vidriera) y portal
      N.cyl(0.19, 0.19, 0.04, 10, { y: 1.36, z: 0.9, rx: HP, color: HS });
      N.cyl(0.14, 0.14, 0.05, 10, { y: 1.36, z: 0.905, rx: HP, color: '#d84a4a', glow: 0.35 });
      N.box(0.04, 0.27, 0.06, { y: 1.36, z: 0.915, color: GOLD, glow: 0.3 }); N.box(0.27, 0.04, 0.06, { y: 1.36, z: 0.915, color: GOLD, glow: 0.3 });
      hDoor(N, 0, 0.82, 0.34, 0.56, { frame: HS, y: 0.1 });
      banner(b, 0.25 - 0.42, 1.0, 0.64, 0.2, 0.46, { emb: 'cross' }); banner(b, 0.25 + 0.42, 1.0, 0.64, 0.2, 0.46, { emb: 'cross' });
      steps(G, 0.25, 0.68, 0.5, 2, 0.06, 0.12, HS);
      // campanario a la izquierda
      const T = grp(b, -0.78, 0.08, 0.05);
      hPlinth(T, 0.76, 0.76, 0.1);
      T.box(0.66, 1.3, 0.66, { y: 0.75, color: HS });
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) T.box(0.09, 0.12, 0.09, { x: s * 0.33, y: 0.2 + i * 0.3, z: 0.33, color: HS_L });
      T.box(0.74, 0.07, 0.74, { y: 1.42, color: HS_D });
      for (const a of [0, HP, -HP]) { const nx = Math.sin(a), nz = Math.cos(a); T.extrude(archPts(0.2, 0.3), 0.03, { x: nx * 0.335, y: 1.0, z: nz * 0.335, ry: a, color: '#3a2c20' }); }
      T.cyl(0.06, 0.1, 0.13, 8, { y: 1.1, z: 0.28, color: GOLD });
      T.box(0.76, 0.05, 0.76, { y: 1.47, color: 'team' });
      T.pyramid(0.74, 0.62, 0.74, { y: 1.8, color: TILE });
      T.box(0.03, 0.24, 0.03, { y: 2.2, color: GOLD }); T.box(0.13, 0.03, 0.03, { y: 2.23, color: GOLD });
      heater(b, -0.78, 0.88, 0.42, 0, 1.1);
      // jardín: cruz de piedra y bancos
      b.box(0.08, 0.36, 0.06, { x: 1.15, y: 0.25, z: 0.9, color: HS }); b.box(0.24, 0.06, 0.06, { x: 1.15, y: 0.34, z: 0.9, color: HS });
      for (const [x, z] of [[1.15, 0.3], [-1.15, 1.0]]) { b.box(0.3, 0.04, 0.1, { x, y: 0.15, z, color: HW_L }); for (const s of [-1, 1]) b.box(0.04, 0.1, 0.08, { x: x + s * 0.12, y: 0.1, z, color: HW }); }
      flag(b, -1.25, 0.08, 1.2, 1.25, { w: 0.36, fh: 0.22, shape: 'tail', emblem: CLOTH });
      for (const [x, z] of [[1.25, -1.2], [-1.2, -1.15], [0.95, -1.25]]) { b.cyl(0.03, 0.05, 0.4, 5, { x, y: 0.2, z, color: '#6b4a2c' }); b.ball(0.16, 0, { x, y: 0.45, z, color: '#4e8a3c' }); }
    },
  },

  // ------------------------------------------------------------------ herrería (2×2)
  human_forge: {
    fp: 2, smoke: [[0.55, 1.92, -0.55]], fire: [[-0.35, 0.45, 0.25], [0.3, 1.0, -0.4]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.12, 1.84, { y: -0.02, color: '#8d846f' });
      b.box(1.6, 0.02, 0.8, { y: 0.05, z: 0.5, color: '#6f6656' });
      // edificio de piedra
      const M = grp(b, 0, 0, -0.4);
      hPlinth(M, 1.76, 0.96, 0.1);
      M.box(1.66, 0.7, 0.86, { y: 0.45, color: HS });
      for (const x of spread(5, -0.75, 0.75)) M.box(0.22, 0.08, 0.02, { x, y: 0.3 + (Math.round(x * 5) % 2 ? 0.2 : 0), z: 0.44, color: HS_D });
      hRoof(M, 1.84, 0.5, 1.02, 0.8, { rows: 2 });
      // gran chimenea
      M.box(0.36, 1.86, 0.36, { x: 0.55, y: 0.93, z: -0.15, color: HS_L });
      M.box(0.42, 0.06, 0.42, { x: 0.55, y: 1.86, z: -0.15, color: HS_D });
      M.box(0.4, 0.05, 0.4, { x: 0.55, y: 1.42, z: -0.15, color: HS_D });
      // hogar de la forja abierto en la fachada, con campana
      M.box(0.62, 0.42, 0.3, { x: -0.38, y: 0.31, z: 0.55, color: HS_L });
      M.extrude(archPts(0.36, 0.26), 0.04, { x: -0.38, y: 0.12, z: 0.7, color: '#ff7a1e', glow: 1 });
      M.box(0.3, 0.05, 0.2, { x: -0.38, y: 0.15, z: 0.62, color: '#ffb040', glow: 1 });
      M.frustum(0.62, 0.3, 0.3, 0.26, 0.18, { x: -0.38, y: 0.52, z: 0.52, color: HS });
      M.box(0.22, 0.4, 0.16, { x: -0.38, y: 0.95, z: 0.48, color: HS });
      M.box(0.66, 0.05, 0.34, { x: -0.38, y: 0.54, z: 0.56, color: 'team' });
      // fuelle
      M.wedge(0.24, 0.1, 0.18, { x: -0.8, y: 0.12, z: 0.62, ry: HP, color: '#6b4a2c' });
      // puerta con toldo
      hDoor(M, 0.3, 0.44, 0.24, 0.4, { y: 0.1 });
      M.box(0.42, 0.03, 0.2, { x: 0.3, y: 0.58, z: 0.56, rx: 0.35, color: 'team' });
      // yunque sobre tocón
      const A = grp(b, 0.0, 0.06, 0.55, -0.3);
      A.cyl(0.08, 0.09, 0.14, 7, { y: 0.07, color: '#6b4a2c' });
      A.box(0.08, 0.06, 0.06, { y: 0.17, color: IRON });
      A.box(0.22, 0.06, 0.1, { y: 0.23, color: '#7d858f' });
      A.cone(0.04, 0.1, 5, { x: 0.15, y: 0.23, rz: -HP, color: '#7d858f' });
      A.box(0.12, 0.025, 0.035, { x: -0.03, y: 0.27, ry: 0.4, color: '#ff8a2a', glow: 0.9 });
      A.cyl(0.012, 0.012, 0.18, 5, { x: 0.05, y: 0.29, z: 0.08, rz: HP, color: HW_L }); A.box(0.04, 0.04, 0.06, { x: -0.04, y: 0.29, z: 0.08, color: IRON });
      // tina de templar, muela y armero
      barrel(b, 0.42, 0.62, 0.1, 0.2, { y: 0.06 }); b.cyl(0.085, 0.085, 0.02, 8, { x: 0.42, y: 0.25, z: 0.62, color: '#4d6f8a' });
      b.cyl(0.13, 0.13, 0.05, 10, { x: -0.62, y: 0.24, z: 0.82, rz: HP, color: '#a39e94' });
      for (const s of [-1, 1]) b.box(0.03, 0.22, 0.03, { x: -0.62 + s * 0.05, y: 0.15, z: 0.82, color: HW });
      b.box(0.04, 0.32, 0.26, { x: 0.8, y: 0.22, z: 0.35, color: HW });
      for (const [z, a] of [[0.27, 0.06], [0.35, -0.04], [0.43, 0.05]]) { b.box(0.012, 0.34, 0.025, { x: 0.76, y: 0.28, z, rx: a, color: STEEL }); b.box(0.02, 0.02, 0.07, { x: 0.76, y: 0.13, z, color: GOLD }); }
      // lingotes y carbón
      for (let i = 0; i < 3; i++) b.box(0.1, 0.035, 0.05, { x: 0.22 + i * 0.03, y: 0.08 + i * 0.035, z: 0.86, ry: i * 0.3, color: '#9aa2ac' });
      for (let i = 0; i < 3; i++) b.ball(0.055, 0, { x: -0.85 + i * 0.08, y: 0.07, z: 0.85 - i * 0.03, color: '#4a4440' });
      // letrero colgante
      b.box(0.2, 0.02, 0.02, { x: 0.75, y: 0.72, z: 0.1, color: IRON });
      b.box(0.16, 0.12, 0.025, { x: 0.8, y: 0.62, z: 0.1, color: HW_L }); b.box(0.08, 0.04, 0.03, { x: 0.8, y: 0.62, z: 0.1, color: IRON });
      flag(b, -0.86, 0.8, -0.4, 0.62, { w: 0.3, fh: 0.18, shape: 'tail' });
    },
  },

  // ------------------------------------------------------------------ mercado (3×3)
  human_market: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.03, color: HS_D });
      b.box(2.74, 0.03, 2.74, { y: 0.05, color: '#bdb39f' });
      for (const [x, z] of [[-0.6, 0.3], [0.5, 0.6], [0.1, -0.05], [-0.2, 0.9], [0.9, 0.15]]) b.box(0.3, 0.02, 0.2, { x, y: 0.07, z, ry: x, color: '#a89e8a' });
      // lonja cubierta al fondo
      const L = grp(b, 0, 0.06, -0.8);
      L.box(2.5, 0.08, 1.0, { y: 0.04, color: HS });
      for (const x of [-1.15, -0.38, 0.38, 1.15]) for (const z of [-0.42, 0.42]) L.box(0.08, 0.72, 0.08, { x, y: 0.44, z, color: BEAM });
      L.box(2.48, 0.07, 0.98, { y: 0.82, color: BEAM });
      L.hip(2.7, 1.2, 0.55, 1.5, { y: 0.85, color: TILE });
      L.box(1.52, 0.06, 0.08, { y: 1.4, color: 'team' });
      for (const s of [-1, 1]) L.box(2.72, 0.06, 0.05, { y: 0.86, z: s * 0.6, color: 'team', teamShade: 0.8 });
      // mesas con mercancías
      for (const x of [-0.75, 0, 0.75]) {
        L.box(0.6, 0.06, 0.4, { x, y: 0.3, z: 0.05, color: HW_L }); L.box(0.56, 0.22, 0.04, { x, y: 0.16, z: 0.22, color: HW });
      }
      for (const [x, c] of [[-0.9, '#d8452e'], [-0.75, '#e8a33a'], [-0.6, '#8bbf4a']]) L.ball(0.06, 0, { x, y: 0.38, z: 0.05, color: c });
      L.blob(0.1, 0.05, 0.06, 0, { x: -0.05, y: 0.37, z: 0.05, color: '#d9a35a' }); L.blob(0.09, 0.05, 0.06, 0, { x: 0.12, y: 0.37, z: 0.0, color: '#c9904a' });
      for (const [x, c] of [[0.62, '#4a6fb5'], [0.75, '#b54a8a'], [0.88, '#e8d8a0']]) L.cyl(0.04, 0.04, 0.3, 6, { x, y: 0.37, z: 0.05, rx: HP, color: c });
      // puestos con toldos rayados del equipo
      for (const [x, z, a] of [[-0.9, 0.55, 0.35], [0.9, 0.55, -0.35]]) {
        const S = grp(b, x, 0.06, z, a);
        S.box(0.72, 0.3, 0.32, { y: 0.15, color: HW });
        S.box(0.76, 0.04, 0.36, { y: 0.31, color: HW_L });
        for (const s of [-1, 1]) { S.box(0.04, 0.72, 0.04, { x: s * 0.36, y: 0.36, z: -0.2, color: BEAM }); S.box(0.04, 0.58, 0.04, { x: s * 0.36, y: 0.29, z: 0.2, color: BEAM }); }
        for (let i = 0; i < 4; i++) S.box(0.2, 0.03, 0.56, { x: -0.3 + i * 0.2, y: 0.66, z: 0.0, rx: 0.25, color: i % 2 ? CLOTH : 'team' });
        S.box(0.82, 0.08, 0.025, { y: 0.56, z: 0.29, color: 'team', teamShade: 0.8, flag: 0.3 });
        for (const [gx, c] of [[-0.22, '#d8452e'], [-0.08, '#e8c040'], [0.08, '#8bbf4a'], [0.22, '#c87a3a']]) S.ball(0.055, 0, { x: gx, y: 0.37, z: 0.02, color: c });
        S.cyl(0.07, 0.06, 0.1, 7, { x: 0.2, y: 0.38, z: -0.08, color: '#b87a4a' });
      }
      // cruz de mercado con bandera
      const C = grp(b, 0, 0.06, 0.55);
      C.cyl(0.24, 0.27, 0.1, 8, { y: 0.05, color: HS }); C.cyl(0.17, 0.2, 0.1, 8, { y: 0.15, color: HS_L });
      flag(b, 0, 0.26, 0.55, 1.5, { w: 0.42, fh: 0.26, shape: 'tail', r: 0.03, pole: HS_L, emblem: CLOTH });
      // barriles, sacos, carreta
      barrel(b, -1.25, 1.2, 0.09, 0.2, { y: 0.05 }); barrel(b, -1.05, 1.28, 0.09, 0.2, { y: 0.05 }); barrel(b, -1.15, 1.22, 0.08, 0.18, { y: 0.25 });
      sack(b, 1.15, 0.06, 1.2); sack(b, 1.3, 0.06, 1.05, 0.9); crate(b, 1.0, 0.06, 1.3, 0.16, { ry: 0.3 });
      const K = grp(b, 0.55, 0.06, 1.15, 0.3);
      K.box(0.44, 0.1, 0.3, { y: 0.17, color: HW_L }); for (const s of [-1, 1]) K.cyl(0.1, 0.1, 0.03, 8, { x: 0, y: 0.1, z: s * 0.17, rx: HP, color: HW });
      K.box(0.04, 0.04, 0.4, { x: -0.38, y: 0.15, ry: HP, color: HW }); K.ball(0.07, 0, { y: 0.27, color: '#8bbf4a' }); K.ball(0.07, 0, { x: 0.1, y: 0.27, color: '#d8452e' });
    },
  },

  // ------------------------------------------------------------------ torre de arqueros (2×2, ~2.6)
  human_tower: {
    fp: 2, fire: [[0, 1.7, 0.3], [0.2, 1.0, 0.3]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.add(frustumGeo(1.5, 1.5, 0.3, 1.3, 1.3), { y: -0.1, color: HS_D });
      // fuste ataludado con sillares en las esquinas
      const B0 = 1.08, B1 = 0.9, Y0 = 0.2, FH = 1.38;
      G.frustum(B0, B0, FH, B1, B1, { y: Y0, color: HS });
      for (let i = 0; i < 5; i++) { const y = 0.3 + i * 0.27, w = B0 - (B0 - B1) * (y - Y0) / FH, q = w / 2 - 0.04 + (i % 2) * 0.012; for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) b.box(0.13, 0.12, 0.13, { x: x * q, y, z: z * q, color: HS_L }); }
      b.box(1.02, 0.045, 1.02, { y: 0.86, color: HS_D });
      // saeteras
      for (const [a, y] of [[0, 1.2], [HP, 1.0], [-HP, 1.0], [HP, 0.55], [-HP, 0.55]]) { const r = (B0 - (B0 - B1) * (y - Y0) / FH) / 2 + 0.005; b.box(0.05, 0.2, 0.03, { x: Math.sin(a) * r, y, z: Math.cos(a) * r, ry: a, color: '#3a2c20' }); }
      hDoor(G, 0, 0.52, 0.26, 0.42, { y: 0.2 });
      steps(G, 0, 0.58, 0.36, 2, 0.08, 0.1, HS);
      // matacanes y cadalso de madera
      for (const a of [0, HP, PI, -HP]) for (const t of [-0.3, 0, 0.3]) b.box(0.08, 0.14, 0.12, { x: Math.sin(a) * 0.47 + Math.cos(a) * t, y: 1.56, z: Math.cos(a) * 0.47 - Math.sin(a) * t, ry: a, color: HS_D });
      b.box(1.12, 0.06, 1.12, { y: 1.65, color: BEAM });
      b.box(1.08, 0.32, 1.08, { y: 1.84, color: PLA });
      for (const [x, z] of [[-0.54, 0.54], [0.54, 0.54], [-0.54, -0.54], [0.54, -0.54], [0, 0.54], [-0.54, 0], [0.54, 0]]) b.box(0.05, 0.34, 0.05, { x, y: 1.84, z, color: BEAM });
      for (const [x, z, a] of [[-0.27, 0.545, 0], [0.27, 0.545, 0], [0.545, 0.27, HP], [-0.545, 0.27, -HP]]) b.box(0.14, 0.1, 0.03, { x, y: 1.87, z, ry: a, color: '#3a2c20' });
      b.box(1.16, 0.06, 1.16, { y: 2.02, color: 'team' });
      // tejado piramidal
      b.pyramid(1.36, 0.62, 1.36, { y: 2.36, color: TILE });
      for (const t of [0.3, 0.6]) b.box(1.36 * (1 - t) + 0.02, 0.025, 1.36 * (1 - t) + 0.02, { y: 2.05 + 0.62 * t, color: TILE_D });
      b.pyramid(0.5, 0.23, 0.5, { y: 2.555, color: 'team' });
      flag(b, 0, 2.5, 0, 0.42, { w: 0.34, fh: 0.2, shape: 'tail' });
      banner(b, -0.3, 1.62, 0.57, 0.17, 0.4, { emb: 'cross' }); banner(b, 0.3, 1.62, 0.57, 0.17, 0.4, { emb: 'cross' });
      heater(b, 0, 1.35, 0.49, 0, 1.0);
    },
  },

  // ------------------------------------------------------------------ puerta (1×1): pieza 0 marco, 1 cerrada, 2 abierta
  human_gate: {
    fp: 1,
    build(b) {
      for (const s of [-1, 1]) {
        b.box(0.27, 0.14, 0.64, { x: s * 0.37, y: 0.02, color: HS_D });
        b.box(0.24, 1.12, 0.6, { x: s * 0.37, y: 0.56, color: HS });
        for (let i = 0; i < 4; i++) b.box(0.07, 0.1, 0.62, { x: s * 0.255, y: 0.15 + i * 0.26, color: HS_L });
        b.box(0.28, 0.06, 0.64, { x: s * 0.37, y: 1.14, color: HS_D }); b.box(0.2, 0.03, 0.4, { x: s * 0.37, y: 1.18, color: 'team' });
        for (const z of [-0.24, 0, 0.24]) b.box(0.1, 0.13, 0.1, { x: s * 0.42, y: 1.235, z, color: HS });
        banner(b, s * 0.37, 1.08, 0.315, 0.15, 0.34, { emb: 'cross' });
      }
      // dintel con arco de medio punto y adarve
      const r = 0.25, ys = 0.56, arc = [];
      for (let i = 0; i <= 6; i++) { const a = i * PI / 6; arc.push([Math.cos(a) * r, ys + Math.sin(a) * r]); }
      b.extrude([[-r, 1.06], [r, 1.06], ...arc], 0.48, { color: HS });
      for (const s of [-1, 1]) b.extrude(archRing(r + 0.05, r, 6, 1), 0.03, { y: ys, z: s * 0.245, color: HS_L });
      b.box(0.54, 0.05, 0.5, { y: 1.08, color: HS_D }); b.box(0.3, 0.025, 0.28, { y: 1.11, color: 'team' });
      for (const x of [-0.13, 0.13]) for (const z of [-0.2, 0.2]) b.box(0.1, 0.12, 0.08, { x, y: 1.16, z, color: HS });
      heater(b, 0, 0.95, 0.27, 0, 0.62);
      b.box(0.5, 0.02, 0.5, { y: 0.01, color: '#a39a88' });
      // hojas: cerradas (pieza 1) y abiertas hacia dentro (pieza 2)
      const leaf = (G, dir) => {
        G.extrude(leafPts(0.245, ys, dir), 0.05, { color: HDOOR });
        for (const y of [0.16, 0.48]) G.box(0.22, 0.03, 0.06, { x: dir * 0.122, y, color: IRON });
        G.box(0.025, 0.6, 0.058, { x: dir * 0.2, y: 0.32, color: shade(HDOOR, -0.1) });
      };
      b.part = 1; leaf(grp(b, -0.25, 0, 0, 0), 1); leaf(grp(b, 0.25, 0, 0, 0), -1);
      b.part = 2; leaf(grp(b, -0.22, 0, 0.02, HP), 1); leaf(grp(b, 0.22, 0, 0.02, -HP), -1);
    },
  },

  // ------------------------------------------------------------------ taller de asedio (3×3)
  human_workshop: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.12, 2.84, { y: -0.02, color: '#8f7a58' });
      for (let i = 0; i < 8; i++) b.box(0.06, 0.02, 0.04, { x: -0.6 + (i * 0.37) % 1.3, y: 0.05, z: 0.2 + (i * 0.23) % 0.9, ry: i, color: '#d9b98a' });
      // nave de trabajo abierta
      const W = grp(b, -0.3, 0, -0.72);
      hPlinth(W, 2.0, 1.2, 0.1);
      W.box(1.9, 0.75, 0.08, { y: 0.47, z: -0.52, color: HW_L });
      for (const s of [-1, 1]) hTimber(grp(b, -0.3 + s * 0.92, 0, -0.72), 0.1, 0.75, 1.1, 0.1, { brace: false, sides: false });
      for (const x of [-0.5, 0.2]) W.box(0.08, 0.8, 0.08, { x, y: 0.5, z: 0.55, color: BEAM });
      W.box(2.0, 0.08, 0.08, { y: 0.88, z: 0.56, color: BEAM });
      hRoof(W, 2.1, 0.66, 1.32, 0.9, { rows: 2, gable: PLA, gableBeam: BEAM });
      // grúa de rueda (treadwheel)
      const C = grp(b, 1.0, 0, -0.75);
      C.box(0.5, 0.06, 0.6, { y: 0.06, color: HW });
      for (const s of [-1, 1]) C.box(0.06, 0.72, 0.06, { x: 0, y: 0.42, z: s * 0.22, color: BEAM });
      C.torus(0.33, 0.035, 12, 4, { y: 0.45, ry: HP, color: HW_L });
      C.torus(0.33, 0.035, 12, 4, { x: 0.1, y: 0.45, ry: HP, color: HW_L });
      for (let i = 0; i < 4; i++) C.box(0.03, 0.66, 0.03, { y: 0.45, x: 0.05, rx: i * PI / 4, color: HW });
      C.box(0.07, 1.7, 0.07, { x: -0.15, y: 0.9, z: 0, rz: 0.1, color: BEAM });
      C.box(0.06, 0.06, 1.0, { x: -0.25, y: 1.7, z: 0.35, rx: -0.25, color: BEAM });
      C.box(0.012, 0.6, 0.012, { x: -0.25, y: 1.38, z: 0.82, color: '#c8b07a' });
      C.box(0.5, 0.07, 0.07, { x: -0.25, y: 1.06, z: 0.82, color: HW_L });
      // catapulta a medio hacer
      const K = grp(b, -0.15, 0.06, 0.55, 0.25);
      for (const s of [-1, 1]) K.box(0.07, 0.07, 0.9, { x: s * 0.22, y: 0.14, color: HW_L });
      for (const z of [-0.35, 0.05, 0.38]) K.box(0.52, 0.06, 0.06, { y: 0.15, z, color: HW_L });
      for (const [x, z] of [[-0.29, -0.3], [0.29, -0.3], [-0.29, 0.3]]) K.cyl(0.13, 0.13, 0.05, 8, { x, y: 0.13, z, rz: HP, color: HW });
      K.cyl(0.13, 0.13, 0.05, 8, { x: 0.55, y: 0.05, z: 0.45, color: HW });
      for (const s of [-1, 1]) { K.box(0.06, 0.5, 0.06, { x: s * 0.2, y: 0.4, z: -0.05, rx: 0.3, color: HW_L }); K.box(0.06, 0.5, 0.06, { x: s * 0.2, y: 0.4, z: -0.25, rx: -0.3, color: HW_L }); }
      K.box(0.5, 0.06, 0.06, { y: 0.62, z: -0.15, color: HW_L });
      K.box(0.06, 0.06, 0.8, { y: 0.3, z: 0.25, rx: -0.3, color: '#c49a68' });
      K.box(0.18, 0.06, 0.16, { y: 0.42, z: 0.62, rx: -0.3, color: '#6b4a2c' });
      K.box(0.36, 0.03, 0.14, { y: 0.22, z: -0.32, color: 'team' });
      // vigas apiladas, rueda apoyada y piedras
      for (let i = 0; i < 4; i++) b.box(0.07, 0.07, 0.9, { x: 1.0 + (i % 2) * 0.08 + Math.floor(i / 2) * 0.16, y: 0.1 + Math.floor(i / 2) * 0.07, z: 0.55, color: '#c49a68' });
      b.cyl(0.2, 0.2, 0.05, 10, { x: -1.25, y: 0.24, z: 0.35, rz: HP - 0.2, color: HW }); b.cyl(0.05, 0.05, 0.07, 6, { x: -1.24, y: 0.24, z: 0.35, rz: HP - 0.2, color: IRON });
      for (const [x, z] of [[-1.0, 1.05], [-0.85, 1.15], [-0.93, 1.25]]) b.ball(0.08, 0, { x, y: 0.1, z, color: '#9a968e' });
      flag(b, 1.25, 0.06, 1.25, 1.35, { w: 0.4, fh: 0.24, shape: 'tail', emblem: CLOTH, ry: PI });
      banner(b, -0.15, 0.86, -0.18, 0.2, 0.36, { emb: 'cross' });
      // banco de trabajo
      b.box(0.5, 0.05, 0.22, { x: -0.95, y: 0.3, z: -0.55, color: HW_L }); for (const s of [-1, 1]) b.box(0.04, 0.28, 0.18, { x: -0.95 + s * 0.2, y: 0.16, z: -0.55, color: HW });
    },
  },

  // ------------------------------------------------------------------ castillo (4×4, ~2.8)
  human_castle: {
    fp: 4, fire: [[0, 1.9, -0.3], [-1.4, 1.4, 1.4], [1.4, 1.4, -1.4], [0.6, 1.0, 1.4]],
    build(b) {
      b.add(frustumGeo(3.86, 3.86, 0.28, 3.6, 3.6), { y: -0.12, color: '#8f8a7e' });
      b.box(3.0, 0.03, 3.0, { y: 0.16, color: '#b0a796' });
      const y0 = 0.15, R = 1.42, WH = 1.0;
      // murallas con adarve y almenas exteriores
      for (const a of [0, HP, PI, -HP]) {
        const C = grp(b, 0, y0, 0, a);
        if (a === 0) { for (const s of [-1, 1]) { C.box(0.62, WH, 0.34, { x: s * 0.73, y: WH / 2, z: R, color: HS }); merlonsX(C, s * 0.44, s * 1.04, 3, WH, R + 0.13, 0.12, 0.14, 0.08, HS_L); } }
        else { C.box(2.1, WH, 0.34, { y: WH / 2, z: R, color: HS }); merlonsX(C, -1.04, 1.04, 6, WH, R + 0.13, 0.12, 0.14, 0.08, HS_L); C.box(2.1, 0.04, 0.36, { y: 0.32, z: R + 0.01, color: HS_D }); }
      }
      // torres de esquina con tejado cónico
      for (const [x, z] of [[-R, R], [R, R], [-R, -R], [R, -R]]) {
        b.cyl(0.4, 0.45, 1.45, 8, { x, y: y0 + 0.72, z, color: HS_L });
        b.cyl(0.46, 0.43, 0.16, 8, { x, y: y0 + 1.52, z, color: HS });
        b.cyl(0.475, 0.475, 0.07, 8, { x, y: y0 + 1.62, z, color: 'team' });
        b.cone(0.49, 0.7, 8, { x, y: y0 + 2.0, z, color: TILE }); b.cone(0.27, 0.38, 8, { x, y: y0 + 2.18, z, color: 'team' });
        b.box(0.05, 0.18, 0.03, { x: x * 0.97, y: y0 + 0.95, z: z + Math.sign(z) * 0.43, color: '#3a2c20' });
      }
      for (const [x, z] of [[-R, R], [R, -R]]) flag(b, x, y0 + 2.28, z, 0.4, { w: 0.34, fh: 0.2, shape: 'pennant' });
      // torre del homenaje
      const KH = 1.72, K = grp(b, 0, y0, -0.3);
      K.box(1.5, 0.1, 1.4, { y: 0.05, color: HS_D });
      K.box(1.36, KH, 1.26, { y: 0.1 + KH / 2, color: HS });
      for (let i = 0; i < 5; i++) for (const x of [-0.68, 0.68]) K.box(0.12, 0.14, 0.12, { x, y: 0.22 + i * 0.33, z: 0.63, color: HS_L });
      K.box(1.46, 0.08, 1.36, { y: KH + 0.13, color: HS_D });
      const ym = KH + 0.17;
      merlonsX(K, -0.7, 0.7, 5, ym, 0.64, 0.14, 0.15, 0.1, HS); merlonsX(K, -0.7, 0.7, 5, ym, -0.64, 0.14, 0.15, 0.1, HS);
      merlonsZ(K, -0.5, 0.5, 3, ym, -0.69, 0.14, 0.15, 0.1, HS); merlonsZ(K, -0.5, 0.5, 3, ym, 0.69, 0.14, 0.15, 0.1, HS);
      for (const [x, z] of [[-0.68, 0.63], [0.68, 0.63], [-0.68, -0.63], [0.68, -0.63]]) { K.cyl(0.15, 0.13, 0.46, 7, { x, y: ym + 0.13, z, color: HS_L }); K.cyl(0.18, 0.18, 0.04, 7, { x, y: ym + 0.36, z, color: 'team' }); K.cone(0.19, 0.42, 7, { x, y: ym + 0.58, z, color: TILE }); }
      K.box(0.5, 0.32, 0.5, { y: ym + 0.12, color: HS_L }); K.pyramid(0.62, 0.34, 0.62, { y: ym + 0.45, color: TILE });
      flag(b, 0, y0 + ym + 0.55, -0.3, 0.42, { w: 0.48, fh: 0.28, shape: 'tail', emblem: CLOTH });
      for (const x of [-0.3, 0.3]) win(b, x, y0 + 1.4, 0.34, 0.12, 0.2, { glass: '#2c3442' });
      banner(b, -0.4, y0 + 1.15, 0.35, 0.24, 0.6, { emb: 'cross', trim: GOLD }); banner(b, 0.4, y0 + 1.15, 0.35, 0.24, 0.6, { emb: 'cross', trim: GOLD });
      hDoor(K, 0, 0.64, 0.3, 0.42, { y: 0.1 });
      heater(b, 0, y0 + 1.68, 0.37, 0, 1.3);
      // casa de guardia con rastrillo
      for (const s of [-1, 1]) { b.cyl(0.24, 0.27, 1.3, 8, { x: s * 0.42, y: y0 + 0.65, z: R + 0.05, color: HS_L }); merlonsRing(b, s * 0.42, R + 0.05, 0.22, 6, y0 + 1.3, 0.09, 0.13, 0.07, HS, 0.3); b.cyl(0.275, 0.275, 0.07, 8, { x: s * 0.42, y: y0 + 1.12, z: R + 0.05, color: 'team' }); b.cyl(0.18, 0.18, 0.02, 8, { x: s * 0.42, y: y0 + 1.3, z: R + 0.05, color: 'team', teamShade: 0.8 }); }
      b.box(0.4, 0.4, 0.42, { y: y0 + 0.96, z: R, color: HS });
      b.extrude(archRing(0.2, 0.16, 6, 1.1), 0.04, { y: y0 + 0.55, z: R + 0.215, color: HS_D });
      for (const x of [-0.09, 0, 0.09]) b.box(0.022, 0.68, 0.03, { x, y: y0 + 0.4, z: R + 0.12, color: IRON });
      for (const y of [0.25, 0.5]) b.box(0.32, 0.022, 0.03, { y: y0 + y, z: R + 0.12, color: IRON });
      banner(b, 0, y0 + 1.15, R + 0.23, 0.22, 0.26, { emb: 'cross' });
      for (const x of [-1.0, 1.0]) heater(b, x, y0 + 0.66, R + 0.19, 0, 1.0);
      for (const s of [-1, 1]) heater(b, s * (R + 0.19), y0 + 0.66, 0.2, s * HP, 1.0);
      // patio: pozo, heno y barril
      b.cyl(0.14, 0.15, 0.16, 8, { x: -0.9, y: y0 + 0.08, z: 0.9, color: HS }); b.cyl(0.11, 0.11, 0.02, 8, { x: -0.9, y: y0 + 0.16, z: 0.9, color: '#3d5f7a' });
      b.box(0.24, 0.16, 0.18, { x: 0.9, y: y0 + 0.08, z: 0.85, color: STRAW }); barrel(b, 0.95, 0.6, 0.08, 0.18, { y: y0 });
    },
  },

  // ------------------------------------------------------------------ muro: pilar y tramo
  human_wall_post: {
    fp: 1,
    build(b) {
      b.box(0.62, 0.16, 0.62, { y: 0.0, color: HS_D });
      b.add(frustumGeo(0.56, 0.56, 0.95, 0.5, 0.5), { y: 0.06, color: HS_L });
      for (const y of [0.3, 0.62]) b.box(0.54, 0.03, 0.54, { y, color: HS });
      b.box(0.6, 0.07, 0.6, { y: 1.0, color: HS_D });
      b.box(0.61, 0.06, 0.61, { y: 0.92, color: 'team' }); b.box(0.32, 0.03, 0.32, { y: 1.045, color: 'team', teamShade: 0.85 });
      for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) b.box(0.15, 0.15, 0.15, { x, y: 1.1, z, color: HS });
      b.cyl(0.014, 0.018, 0.4, 5, { y: 1.22, color: BEAM });
      b.extrude([[0, 0], [0.2, -0.06], [0, -0.12]], 0.026, { y: 1.4, z: 0, color: 'team', flag: (x) => Math.max(0, x) * 6 });
    },
  },
  human_wall_seg: {
    fp: 1,
    build(b) {
      b.box(0.5, 0.14, 0.46, { x: 0.25, y: 0.0, color: HS_D });
      b.box(0.5, 0.82, 0.4, { x: 0.25, y: 0.41, color: HS });
      for (const s of [-1, 1]) {
        b.box(0.5, 0.035, 0.41, { x: 0.25, y: 0.33, color: HS_D });
        b.box(0.18, 0.08, 0.01, { x: 0.37, y: 0.55, z: s * 0.2, color: shade(HS, -0.05) });
        b.box(0.5, 0.05, 0.08, { x: 0.25, y: 0.845, z: s * 0.165, color: HS_L });
        b.box(0.13, 0.13, 0.08, { x: 0.375, y: 0.935, z: s * 0.165, color: HS_L });
      }
      b.box(0.5, 0.02, 0.26, { x: 0.25, y: 0.83, color: '#a39a88' });
    },
  },
};

/* ------------------------------------------------------------------ granja (las tres razas) */
/**
 * Granja 3×3 plana. Pieza 0: tierra arada con surcos y vallado (madera / seto / murete de piedra).
 * Piezas 1, 2, 3: brotes, cultivo medio y espigas doradas.
 */
function farm(b, race) {
  const SO = race === 'dwarf' ? '#6f5a44' : race === 'elf' ? '#7a5e3c' : SOIL;
  b.box(2.86, 0.14, 2.86, { y: -0.05, color: shade(SO, 0.04) });
  const rows = spread(7, -1.15, 1.15);
  for (const z of rows) b.box(2.42, 0.06, 0.15, { y: 0.03, z, color: shade(SO, -0.06) });
  for (const z of rows.slice(0, -1)) b.box(2.42, 0.02, 0.06, { y: 0.02, z: z + 0.164, color: shade(SO, 0.08) });
  if (race === 'human') {
    // vallado de madera con entrada al frente
    for (const p of [-1.36, -0.68, 0, 0.68, 1.36]) for (const s of [-1, 1]) { b.box(0.06, 0.26, 0.06, { x: p, y: 0.13, z: s * 1.36, color: HW }); if (Math.abs(p) < 1.3) b.box(0.06, 0.26, 0.06, { x: s * 1.36, y: 0.13, z: p, color: HW }); }
    for (const y of [0.1, 0.2]) {
      const rc = y > 0.15 ? 'team' : HW_L;
      b.box(2.72, 0.035, 0.04, { y, z: -1.36, color: rc });
      for (const s of [-1, 1]) { b.box(0.04, 0.035, 2.72, { x: s * 1.36, y, color: rc }); b.box(1.06, 0.035, 0.04, { x: s * 0.83, y, z: 1.36, color: rc }); }
    }
    // espantapájaros con camisa del equipo
    const S = grp(b, -1.12, 0, -1.1);
    S.box(0.035, 0.62, 0.035, { y: 0.31, color: HW }); S.box(0.36, 0.03, 0.03, { y: 0.48, color: HW });
    S.box(0.15, 0.2, 0.08, { y: 0.44, color: 'team' }); S.ball(0.06, 0, { y: 0.62, color: STRAW });
    S.cone(0.1, 0.09, 6, { y: 0.69, color: '#b89a4a' });
    flag(b, 1.36, 0.0, 1.36, 0.6, { w: 0.24, fh: 0.14, shape: 'pennant', r: 0.022, ry: PI });
  } else if (race === 'elf') {
    // seto vivo bajo con arcos de madera viva en la entrada
    for (const s of [-1, 1]) { b.box(0.14, 0.18, 2.6, { x: s * 1.34, y: 0.09, color: '#5f9a4c' }); b.box(1.0, 0.18, 0.14, { x: s * 0.88, y: 0.09, z: 1.34, color: '#5f9a4c' }); }
    b.box(2.82, 0.18, 0.14, { y: 0.09, z: -1.34, color: '#5f9a4c' });
    for (const [x, z] of [[-1.34, -1.34], [1.34, -1.34], [-1.34, 1.34], [1.34, 1.34]]) b.ball(0.13, 0, { x, y: 0.18, z, color: '#7fbf5a' });
    for (const s of [-1, 1]) b.cyl(0.04, 0.06, 0.7, 6, { x: s * 0.36, y: 0.35, z: 1.34, rz: -s * 0.12, color: '#8a6a3c' });
    b.extrude(archRing(0.42, 0.36, 6, 0.55), 0.06, { y: 0.66, z: 1.34, color: '#8a6a3c' });
    b.ball(0.1, 0, { y: 0.92, z: 1.34, sy: 0.6, color: '#7fbf5a' });
    // farol de cristal con banderola
    b.cyl(0.02, 0.03, 0.7, 6, { x: -1.15, y: 0.35, z: -1.1, color: '#f1efe4' });
    crystal(b, -1.15, 0.78, -1.1, 0.9);
    flag(b, 1.15, 0.0, -1.12, 0.7, { w: 0.22, fh: 0.2, shape: 'tail', pole: '#f1efe4', tip: '#d9b44a', r: 0.018 });
  } else {
    // murete de piedra seca y mojón rúnico
    const ST = '#8d8a86';
    for (const s of [-1, 1]) { b.box(0.14, 0.17, 2.72, { x: s * 1.36, y: 0.085, color: ST }); b.box(1.0, 0.17, 0.14, { x: s * 0.86, y: 0.085, z: 1.36, color: ST }); }
    b.box(2.86, 0.17, 0.14, { y: 0.085, z: -1.36, color: ST });
    for (const [x, z] of [[-1.36, -0.6], [1.36, 0.4], [0.5, -1.36], [-0.9, 1.36]]) b.box(0.18, 0.06, 0.18, { x, y: 0.19, z, color: '#6e6b68' });
    b.box(0.16, 0.42, 0.12, { x: -1.12, y: 0.21, z: -1.12, color: '#6e6b68' });
    rune(b, -1.12, 0.25, -1.055, 0, 0.9, '#ff9a3a');
    flag(b, 1.15, 0.0, -1.15, 0.62, { w: 0.24, fh: 0.16, shape: 'rect', pole: '#6d737c', tip: '#c08a3e', r: 0.022 });
    barrel(b, 1.16, 1.12, 0.09, 0.2, { col: '#7a5a3a', hoop: '#c08a3e' });
  }
  // cultivo en tres etapas
  const grow = (x, y) => Math.max(0, y - 0.04) * 1.6;
  b.part = 1;
  for (const z of rows) for (const x of spread(7, -1.1, 1.1)) b.cone(0.045, 0.1, 4, { x, y: 0.1, z, ry: x * 3, color: '#7fbf4a', wave: grow });
  b.part = 2;
  for (const z of rows) {
    b.box(2.3, 0.12, 0.13, { y: 0.12, z, color: '#5f9a3c', wave: grow });
    for (const x of spread(5, -1.1, 1.1)) b.cone(0.07, 0.2, 5, { x, y: 0.22, z, ry: x * 2, color: '#79b04a', wave: grow });
  }
  b.part = 3;
  const RIPE = race === 'elf' ? '#e3c050' : race === 'dwarf' ? '#d2a63e' : '#dcb444';
  for (const z of rows) {
    b.box(2.32, 0.24, 0.15, { y: 0.17, z, color: shade(RIPE, -0.08), wave: grow });
    for (const x of spread(6, -1.1, 1.1)) b.box(0.12, 0.1, 0.12, { x, y: 0.33, z, ry: 0.4 + x, color: shade(RIPE, 0.06), wave: grow });
  }
}

export const MODELS = Object.assign({}, HUMAN);
