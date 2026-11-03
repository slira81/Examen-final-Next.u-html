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

/* ==================================================================================== ELFOS */
const EW = '#8a6a3c', EW_L = '#a8844f', LEAF = '#5f9a4c', LEAF_L = '#7fbf5a', LEAF_D = '#4b8541', EWH = '#e9e5d6', EWH_L = '#f4f1e6', EWH_D = '#d0cab7',
  EG = '#d9b44a', CRY = '#7ff0c0', EGL = '#5fb8a0', BIRCH = '#d8d0bc';
const crySpin = (x, y, z, s = 0.9) => ({ c: [x, y, z], axis: [0, 1, 0], speed: s });

/** Cúpula de hojas (perfil de capullo) en dos tonos, con anillo del equipo y remate dorado + cristal. */
function eDome(G, r, h, y, o = {}) {
  const x = o.x || 0, z = o.z || 0, n = o.seg || 8;
  G.lathe([[r * 0.9, 0], [r, h * 0.16], [r * 0.97, h * 0.36], [r * 0.82, h * 0.56]], n, { x, y, z, color: o.col || LEAF_D });
  G.lathe([[r * 0.82, h * 0.56], [r * 0.56, h * 0.76]], n, { x, y, z, color: o.col2 || LEAF });
  G.lathe([[r * 0.56, h * 0.76], [r * 0.24, h * 0.92], [0.001, h]], n, { x, y, z, color: o.teamTop ? 'team' : (o.col2 || LEAF_L), teamShade: 0.9 });
  if (o.band !== false) G.cyl(r * 1.02, r * 1.0, Math.max(0.05, h * 0.09), n, { x, y: y + Math.max(0.025, h * 0.045), z, color: o.band || 'team' });
  if (o.tip !== false) {
    G.cone(Math.max(0.025, r * 0.07), h * 0.3, 6, { x, y: y + h + h * 0.13, z, color: EG });
    if (o.crystal !== false) {
      const cy = y + h * 1.38, k = Math.max(0.6, r * 1.6), spin = o.spin ? crySpin(x, cy, z) : undefined;
      G.cyl(0, 0.05 * k, 0.14 * k, 6, { x, y: cy + 0.07 * k, z, color: CRY, glow: 0.9, spin });
      G.cyl(0.05 * k, 0, 0.07 * k, 6, { x, y: cy - 0.035 * k, z, color: shade(CRY, -0.08), glow: 0.9, spin });
    }
  }
}
/** Tejado curvo apuntado (lanceta) con cumbrera a lo largo de X; piñones blancos y aleros del equipo. */
function eRoof(G, w, h, d, y, o = {}) {
  G.extrude(lancetPts(d, h, 6), w, { y, ry: HP, color: o.col || LEAF });
  G.extrude(lancetPts(d * 0.516 * 1.05, h * 0.3 * 1.04, 5), w + 0.012, { y: y + h * 0.7 - 0.004, ry: HP, color: o.col2 || 'team', teamShade: 0.9 });
  G.box(w + 0.04, 0.05, 0.06, { y: y + h * 1.0, color: EG });
  for (const s of [-1, 1]) G.box(w + 0.03, 0.06, 0.07, { y: y + 0.03, z: s * (d / 2 - 0.02), color: 'team' });
  if (o.gable !== false) for (const e of [-1, 1]) {
    G.extrude(lancetPts(d * 0.66, h * 0.6, 5), 0.03, { x: e * (w / 2 + 0.01), y, ry: HP, color: o.gable || EWH });
    G.cyl(0.07, 0.07, 0.03, 8, { x: e * (w / 2 + 0.026), y: y + h * 0.3, rz: HP, color: EGL, glow: 0.5 });
  }
}
/** Tronco vivo con raíces que se abren en la base. */
function eTrunk(G, x, z, y0, h, r, o = {}) {
  G.cyl(r * 0.78, r * 1.12, h, 6, { x, y: y0 + h / 2, z, rz: o.lean || 0, color: o.col || EW });
  const n = o.roots ?? 3;
  for (let i = 0; i < n; i++) { const a = (o.a || 0) + i * 2 * PI / n, k = o.rootK || 1; G.cyl(r * 0.22 * k, r * 0.5 * k, r * 2.4 * k, 5, { x: x + Math.sin(a) * r * 1.05, y: y0 + r * 0.55, z: z + Math.cos(a) * r * 1.05, rx: -Math.cos(a) * 1.0, rz: Math.sin(a) * 1.0, color: shade(o.col || EW, -0.04) }); }
}
/** Columna blanca con basa y capitel dorados. */
function ePillar(G, x, z, y0, h, r = 0.06) {
  G.cyl(r, r * 1.1, h, 8, { x, y: y0 + h / 2, z, color: EWH_L });
  G.cyl(r * 1.5, r * 1.6, 0.05, 8, { x, y: y0 + 0.025, z, color: EG });
  G.cyl(r * 1.7, r * 1.2, 0.07, 8, { x, y: y0 + h - 0.035, z, color: EG });
}
/** Ventana apuntada con marco dorado y vidrio verdoso tenue (base en y). */
function eWin(b, x, y, z, w, h, ry = 0) {
  const nx = Math.sin(ry), nz = Math.cos(ry);
  b.extrude(lancetPts(w + 0.05, h + 0.06), 0.03, { x, y: y - 0.025, z, ry, color: EG });
  b.extrude(lancetPts(w, h), 0.036, { x: x + nx * 0.004, y, z: z + nz * 0.004, ry, color: EGL, glow: 0.45 });
}
/** Puerta apuntada de madera con marco dorado y cristal encima. */
function eDoor(G, x, z, w, h, o = {}) {
  const y = o.y || 0;
  G.extrude(lancetPts(w + 0.08, h + 0.08), 0.04, { x, y, z: z - 0.005, color: EG });
  G.extrude(lancetPts(w, h), 0.05, { x, y, z, color: o.col || EW_L });
  G.box(0.02, h * 0.7, 0.056, { x, y: y + h * 0.35, z, color: EW });
  if (o.gem !== false) G.ball(0.03, 0, { x, y: y + h + 0.1, z: z + 0.02, color: CRY, glow: 0.9 });
}
/** Anillo apuntado (dovelas de un arco élfico): exterior W×H, interior w×h elevado dy. */
const lancetRing = (W, H, w, h, dy) => lancetPts(W, H).concat(lancetPts(w, h).map(([x, y]) => [x, y + dy]).reverse());
/** Farol élfico: poste blanco con cristal. */
function eLamp(b, x, z, h = 0.5, y0 = 0) {
  b.cyl(0.018, 0.026, h, 6, { x, y: y0 + h / 2, z, color: EWH_L });
  b.cyl(0.045, 0.02, 0.05, 6, { x, y: y0 + h, z, color: EG });
  crystal(b, x, y0 + h + 0.07, z, 0.6);
}
/** Árbol élfico pequeño (tronco + copas). */
function eTree(b, x, z, s = 1, y0 = 0) {
  const sw = (px, py) => Math.max(0, py - y0) * 0.5;
  b.cyl(0.03 * s, 0.05 * s, 0.45 * s, 6, { x, y: y0 + 0.22 * s, z, color: EW, wave: sw });
  for (const [dx, dy, dz, r] of [[0, 0.55, 0, 0.24], [0.12, 0.45, 0.05, 0.17], [-0.11, 0.47, -0.04, 0.17]]) b.ball(r * s, 1, { x: x + dx * s, y: y0 + dy * s, z: z + dz * s, sy: 0.85, color: shade(LEAF, dy * 0.2 - 0.06), wave: sw });
}
/** Bandera élfica: mástil blanco, remate de cristal, cola de golondrina. */
const eFlag = (b, x, y0, z, h, o = {}) => flag(b, x, y0, z, h, Object.assign({ pole: EWH_L, tip: CRY, tipGlow: 0.9, shape: 'tail', r: 0.02 }, o));
/** Hoja de puerta apuntada: bisagra en x=0, ancho w hacia dir, arranque ys y flecha H. */
function lancetLeaf(w, ys, H, dir = 1, n = 5) {
  const pts = [[0, 0], [w * dir, 0]];
  for (let j = n; j >= 0; j--) { const t = j / n; pts.push([(w - w * Math.pow(1 - t, 0.55)) * dir, ys + H * t]); }
  return dir > 0 ? pts : pts.reverse();
}
/** Contorno de dintel con hueco apuntado: ancho 2w, arranque ys, flecha H, techo yt. */
function lancetLintel(w, ys, H, yt) {
  const arc = []; for (let j = 0; j <= 6; j++) { const t = j / 6; arc.push([w * Math.pow(1 - t, 0.55), ys + H * t]); }
  return [[-w, yt], [w, yt], ...arc, ...arc.slice(0, -1).map(([x, y]) => [-x, y]).reverse()];
}
/** Plataforma octogonal blanca con borde dorado (cara plana al frente). */
function ePlat(b, r, h, y, col = EWH_D) {
  b.cyl(r, r * 1.02, h, 8, { y: y + h / 2, ry: PI / 8, color: col });
  b.cyl(r * 1.012, r * 1.012, 0.035, 8, { y: y + h - 0.04, ry: PI / 8, color: EG });
}

const ELF = {
  // ------------------------------------------------------------------ casa (2×2): vaina de piedra blanca con cúpula de hojas
  elf_house: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      ePlat(b, 0.86, 0.22, -0.1);
      b.cyl(0.47, 0.5, 0.6, 8, { y: 0.42, ry: PI / 8, color: EWH });
      for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8; if (Math.abs(Math.sin(a)) < 0.5 && Math.cos(a) > 0) continue; G.box(0.06, 0.66, 0.05, { x: Math.sin(a) * 0.49, y: 0.44, z: Math.cos(a) * 0.49, ry: a, rx: 0.06, color: EW }); }
      eDome(G, 0.62, 0.72, 0.72, { teamTop: true });
      eDoor(G, 0, 0.47, 0.22, 0.4, { y: 0.12 });
      for (const a of [-1.0, 1.0]) eWin(b, Math.sin(a) * 0.465, 0.36, Math.cos(a) * 0.465, 0.1, 0.2, a);
      // vaina trasera
      b.cyl(0.27, 0.29, 0.42, 8, { x: -0.5, y: 0.33, z: -0.38, color: EWH });
      eDome(grp(b, -0.5, 0, -0.38), 0.33, 0.4, 0.54, { band: EG, crystal: false });
      // árbol que abraza la casa
      eTrunk(G, 0.56, -0.42, 0.12, 0.8, 0.07, { lean: -0.12, roots: 3 });
      for (const [x, y, z, r] of [[0.62, 1.02, -0.45, 0.24], [0.44, 0.94, -0.5, 0.17], [0.72, 0.9, -0.3, 0.16]]) b.ball(r, 1, { x, y, z, sy: 0.85, color: shade(LEAF_L, (y - 1) * 0.3), wave: (px, py) => Math.max(0, py - 0.5) * 0.4 });
      // farol, flores, bandera
      eLamp(b, 0.42, 0.56, 0.42, 0.12);
      for (const [x, z, c] of [[-0.3, 0.6, '#e8a0d0'], [-0.42, 0.52, '#f4f1e6'], [0.25, 0.66, '#e8d070']]) { b.ball(0.06, 0, { x, y: 0.15, z, sy: 0.7, color: LEAF }); b.ball(0.03, 0, { x, y: 0.2, z, color: c }); }
      eFlag(b, -0.66, 0.12, 0.42, 1.0, { w: 0.3, fh: 0.18 });
      b.box(0.36, 0.05, 0.16, { y: 0.1, z: 0.6, color: EWH_L });
    },
  },

  // ------------------------------------------------------------------ centro urbano (4×4): rotonda bajo el gran árbol
  elf_tc: {
    fp: 4, fire: [[0, 1.5, 0.5], [-1.2, 1.2, 0.2], [1.2, 1.2, 0.2], [0, 1.8, -1]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      ePlat(b, 1.9, 0.22, -0.12);
      ePlat(b, 1.42, 0.14, 0.1, EWH);
      for (let i = 0; i < 2; i++) b.box(0.9 - i * 0.12, 0.08 + i * 0.08, 0.2, { y: (0.08 + i * 0.08) / 2 + 0.06, z: 1.5 - i * 0.18, color: EWH_L });
      // rotonda con columnata
      b.cyl(0.7, 0.74, 1.0, 8, { y: 0.74, ry: PI / 8, color: EWH });
      for (let i = 0; i < 8; i++) { const a = PI / 8 + i * PI / 4; ePillar(G, Math.sin(a) * 0.82, Math.cos(a) * 0.82, 0.24, 1.0, 0.06); }
      b.cyl(0.9, 0.9, 0.09, 8, { y: 1.28, ry: PI / 8, color: EWH_L });
      b.cyl(0.92, 0.92, 0.03, 8, { y: 1.24, ry: PI / 8, color: EG });
      eDome(G, 0.86, 1.0, 1.32, { spin: true, teamTop: true });
      eDoor(G, 0, 0.665, 0.3, 0.6, { y: 0.24 });
      for (const a of [-PI / 2, -PI / 4, PI / 4, PI / 2]) eWin(b, Math.sin(a) * 0.67, 0.62, Math.cos(a) * 0.67, 0.13, 0.32, a);
      // gran árbol detrás
      eTrunk(G, 0, -1.12, 0.24, 2.0, 0.26, { roots: 4, a: 0.4 });
      for (const s of [-1, 1]) b.cyl(0.05, 0.09, 0.7, 5, { x: s * 0.3, y: 2.05, z: -1.12, rz: -s * 0.9, color: EW });
      for (const [x, y, z, r] of [[0, 2.5, -1.15, 0.56], [-0.6, 2.25, -1.05, 0.42], [0.6, 2.28, -1.1, 0.42], [-0.28, 2.3, -1.45, 0.4], [0.3, 2.62, -0.9, 0.36]]) b.ball(r, 1, { x, y, z, sy: 0.82, color: shade(LEAF_L, (y - 2.4) * 0.25 - 0.03), wave: (px, py) => Math.max(0, py - 1.6) * 0.25 });
      // pabellones laterales
      for (const s of [-1, 1]) {
        const x = s * 1.22, z = 0.12, P = grp(b, x, 0, z);
        P.cyl(0.32, 0.34, 1.12, 8, { y: 0.8, ry: PI / 8, color: EWH });
        P.cyl(0.36, 0.36, 0.05, 8, { y: 1.36, ry: PI / 8, color: EG });
        eDome(P, 0.42, 0.58, 1.38, {});
        P.box(0.36, 0.66, 0.42, { x: -s * 0.42, y: 0.57, color: EWH_L });
        P.box(0.38, 0.04, 0.44, { x: -s * 0.42, y: 0.92, color: EG });
        P.extrude(lancetPts(0.14, 0.32), 0.44, { x: -s * 0.42, y: 0.3, color: '#3e5a50' });
        eWin(b, x, 0.6, z + 0.31, 0.1, 0.26, 0);
        banner(b, x, 1.3, z + 0.35, 0.2, 0.5, { emb: 'leaf', ec: EG, rod: EG });
      }
      // banderas, faroles y jardín
      for (const s of [-1, 1]) {
        eFlag(b, s * 1.12, 0.24, 1.12, 1.35, { w: 0.42, fh: 0.26, ry: s > 0 ? PI : 0 });
        eLamp(b, s * 0.55, 1.25, 0.55, 0.24);
        eTree(b, s * 1.45, -0.75, 1.05, 0.1);
        for (const [dx, dz] of [[0.0, 0.0], [0.12, 0.1]]) b.ball(0.1, 0, { x: s * (0.95 + dx), y: 0.28, z: 0.9 + dz, sy: 0.7, color: LEAF });
        b.ball(0.035, 0, { x: s * 0.98, y: 0.36, z: 0.92, color: '#e8a0d0' });
      }
      // estanque frente a la escalinata
      b.cyl(0.32, 0.34, 0.08, 8, { y: 0.28, z: 1.02, color: EWH_L }); b.cyl(0.26, 0.26, 0.02, 8, { y: 0.32, z: 1.02, color: '#6fd8e0', glow: 0.35 });
      crystal(b, 0, 0.42, 1.02, 0.9);
    },
  },

  // ------------------------------------------------------------------ cuartel (3×3)
  elf_barracks: {
    fp: 3,
    build(b) {
      b.box(2.84, 0.16, 2.84, { y: -0.04, color: EWH_D });
      b.box(2.86, 0.03, 2.86, { y: 0.045, color: EG });
      b.box(2.7, 0.02, 1.3, { y: 0.06, z: 0.6, color: '#c9c1a8' });
      // salón con tejado apuntado
      const H = grp(b, 0, 0.06, -0.72);
      H.box(2.36, 0.08, 1.12, { y: 0.04, color: EWH_L });
      H.box(2.24, 0.62, 1.0, { y: 0.39, color: EWH });
      H.box(2.28, 0.04, 1.04, { y: 0.7, color: EG });
      eRoof(H, 2.46, 0.84, 1.28, 0.72);
      eDoor(H, 0, 0.5, 0.3, 0.5, { y: 0.08 });
      for (const x of [-0.85, -0.5, 0.5, 0.85]) eWin(b, x, 0.4, -0.72 + 0.505, 0.11, 0.24, 0);
      for (const s of [-1, 1]) { eTrunk(H, s * 1.14, 0.5, 0.08, 0.95, 0.07, { roots: 2, a: s }); H.ball(0.15, 0, { x: s * 1.14, y: 1.05, z: 0.5, color: LEAF_L }); }
      banner(b, -0.3, 0.68, -0.21, 0.16, 0.36, { emb: 'leaf', ec: EG, rod: EG }); banner(b, 0.3, 0.68, -0.21, 0.16, 0.36, { emb: 'leaf', ec: EG, rod: EG });
      // aguja de guardia
      const T = grp(b, 1.08, 0.06, -1.05);
      T.cyl(0.17, 0.22, 1.7, 8, { y: 0.85, color: EWH });
      T.cyl(0.25, 0.25, 0.06, 8, { y: 1.3, color: EG });
      eDome(T, 0.26, 0.5, 1.7, {});
      // patio: armero de gujas, arcos, círculo de duelo y muñeco
      const R = grp(b, -0.85, 0.06, 0.62);
      R.box(0.7, 0.05, 0.08, { y: 0.42, color: EW }); for (const s of [-1, 1]) R.cyl(0.025, 0.03, 0.5, 6, { x: s * 0.33, y: 0.25, color: EW });
      for (const x of spread(4, -0.27, 0.27)) { R.cyl(0.012, 0.012, 0.72, 5, { x, y: 0.38, z: 0.04, rx: -0.1, color: EW_L }); R.extrude(lancetPts(0.06, 0.16), 0.02, { x: x + 0.02, y: 0.72, z: 0.08, rx: -0.1, color: EWH_L }); }
      for (const [x, z, a] of [[-1.22, 1.05, 0.4], [-1.05, 1.18, 0.1]]) b.extrude(archRing(0.2, 0.17, 6, 0.9), 0.025, { x, y: 0.36, z, rz: -HP, ry: a, order: 'YXZ', color: EW_L });
      b.torus(0.42, 0.025, 12, 3, { x: 0.35, y: 0.08, z: 0.68, rx: HP, color: EG });
      const D = grp(b, 0.35, 0.06, 0.68);
      D.cyl(0.025, 0.03, 0.55, 6, { y: 0.27, color: EW }); D.blob(0.09, 0.13, 0.07, 0, { y: 0.4, color: LEAF });
      D.extrude(lancetPts(0.16, 0.26), 0.03, { x: -0.1, y: 0.28, z: 0.06, ry: -0.3, color: 'team' });
      eFlag(b, 1.15, 0.06, 1.1, 1.45, { w: 0.44, fh: 0.28, ry: PI });
      eLamp(b, -0.45, 1.2, 0.45, 0.06); eLamp(b, 0.8, 1.2, 0.45, 0.06);
      eTree(b, -1.1, -0.05, 0.85, 0.06);
    },
  },

  // ------------------------------------------------------------------ molino (2×2): torre esbelta con aspas de hoja
  elf_mill: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      ePlat(b, 0.84, 0.24, -0.1);
      b.cyl(0.33, 0.44, 1.32, 8, { y: 0.8, color: EWH });
      for (const [y, rx, rz] of [[0.45, 0.22, 0.1], [0.85, -0.2, 0.12], [1.22, 0.18, -0.14]]) b.torus(0.42 - (y - 0.4) * 0.08, 0.026, 10, 3, { y, rx: HP + rx, rz, color: EW });
      for (const [y, a] of [[0.55, 2.2], [0.95, -2.4], [1.3, 0.9]]) b.ball(0.06, 0, { x: Math.sin(a) * 0.4, y, z: Math.cos(a) * 0.4, color: LEAF_L });
      eDome(G, 0.46, 0.56, 1.46, { teamTop: true });
      eDoor(G, 0, 0.43, 0.2, 0.36, { y: 0.14 });
      eWin(b, 0, 1.0, 0.37, 0.09, 0.2, 0);
      // aspas en forma de hoja (5), alternando equipo y hoja
      const hy = 1.26, hz = 0.56, sp = { c: [0, hy, hz], axis: [0, 0, 1], speed: 0.9 };
      b.cyl(0.03, 0.04, 0.24, 6, { y: hy, z: hz - 0.1, rx: HP, color: EW });
      b.ball(0.07, 0, { y: hy, z: hz + 0.02, color: EG, spin: sp });
      for (let i = 0; i < 5; i++) {
        const a = i * 2 * PI / 5 + 0.2;
        b.extrude(lancetPts(0.24, 0.78, 6), 0.026, { x: -Math.sin(a) * 0.06, y: hy + Math.cos(a) * 0.06, z: hz + 0.02, rz: a, color: i % 2 ? 'team' : LEAF_L, spin: sp });
        b.box(0.022, 0.72, 0.034, { x: -Math.sin(a) * 0.42, y: hy + Math.cos(a) * 0.42, z: hz + 0.03, rz: a, color: EG, spin: sp });
      }
      for (const [x, z] of [[0.55, 0.42], [0.66, 0.24]]) { b.cyl(0.1, 0.08, 0.14, 8, { x, y: 0.21, z, color: EW_L }); b.ball(0.08, 0, { x, y: 0.28, z, sy: 0.4, color: '#e3c050' }); }
      sack(b, -0.58, 0.14, 0.42, 0.9, '#e8dfc4'); sack(b, -0.66, 0.14, 0.26, 0.85, '#e8dfc4');
      b.cyl(0.24, 0.26, 0.36, 8, { x: -0.48, y: 0.32, z: -0.42, color: EWH });
      eDome(grp(b, -0.48, 0, -0.42), 0.3, 0.34, 0.5, { band: EG, crystal: false });
      eFlag(b, 0.62, 0.14, -0.5, 1.15, { w: 0.3, fh: 0.18, ry: PI });
    },
  },

  // ------------------------------------------------------------------ aserradero (2×2)
  elf_lumber: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.12, 1.84, { y: -0.02, color: '#8f8a5c' });
      b.box(1.5, 0.04, 0.9, { y: 0.05, z: -0.4, color: EWH_D });
      for (const [x, z] of [[-0.62, -0.78], [0.62, -0.78], [-0.62, -0.05], [0.62, -0.05]]) eTrunk(G, x, z, 0.06, 0.88, 0.05, { lean: x > 0 ? 0.14 : -0.14, roots: 2, a: x });
      b.blob(0.8, 0.14, 0.54, 1, { y: 0.96, z: -0.42, color: 'team', teamShade: 0.9 });
      for (const [x, z, r] of [[-0.45, -0.6, 0.26], [0.42, -0.55, 0.24], [0.0, -0.75, 0.22]]) b.blob(r, r * 0.45, r, 1, { x, y: 1.06, z, color: x ? LEAF : LEAF_L });
      for (let i = 0; i < 4; i++) b.box(0.9, 0.045, 0.2, { x: -0.1, y: 0.1 + i * 0.05, z: -0.45 + (i % 2) * 0.03, color: shade(BIRCH, i * 0.02) });
      b.box(0.4, 0.05, 0.22, { x: 0.38, y: 0.3, z: -0.55, color: EW_L }); for (const s of [-1, 1]) b.box(0.04, 0.26, 0.18, { x: 0.38 + s * 0.16, y: 0.16, z: -0.55, color: EW });
      for (const [x, y, z] of [[-0.5, 0.11, 0.3], [-0.5, 0.11, 0.48], [-0.5, 0.11, 0.66], [-0.5, 0.26, 0.39], [-0.5, 0.26, 0.57]]) log(b, x, y, z, 0.7, 0.085, { bark: BIRCH, wood: '#e9d9b0' });
      for (const [x, z] of [[-0.62, 0.28], [-0.4, 0.5], [-0.55, 0.65]]) b.box(0.05, 0.02, 0.03, { x, y: 0.2, z, color: '#4a4440' });
      const H = grp(b, 0.5, 0.06, 0.45);
      for (const s of [-1, 1]) { H.box(0.035, 0.3, 0.035, { x: s * 0.22, y: 0.14, z: 0.07, rx: 0.35, color: EW }); H.box(0.035, 0.3, 0.035, { x: s * 0.22, y: 0.14, z: -0.07, rx: -0.35, color: EW }); }
      log(b, 0.5, 0.36, 0.45, 0.64, 0.065, { bark: BIRCH, wood: '#e9d9b0' });
      H.extrude(archRing(0.2, 0.17, 6, 0.8), 0.025, { x: 0.05, y: 0.4, z: 0.08, color: EW_L });
      H.box(0.4, 0.02, 0.02, { x: 0.05, y: 0.4, z: 0.08, color: '#c8ccd2' });
      b.cyl(0.13, 0.15, 0.1, 8, { x: 0.12, y: 0.1, z: 0.72, color: EWH }); b.cyl(0.11, 0.11, 0.02, 8, { x: 0.12, y: 0.15, z: 0.72, color: '#6a5034' });
      b.cyl(0.012, 0.016, 0.22, 5, { x: 0.12, y: 0.26, z: 0.72, color: EW }); b.ball(0.08, 0, { x: 0.12, y: 0.4, z: 0.72, color: LEAF_L });
      crystal(b, 0.3, 0.12, 0.78, 0.6);
      eFlag(b, 0.82, 0.06, -0.82, 1.3, { w: 0.3, fh: 0.2, ry: PI });
    },
  },

  // ------------------------------------------------------------------ campamento minero (2×2)
  elf_mine: {
    fp: 2,
    build(b) {
      b.box(1.84, 0.12, 1.84, { y: -0.02, color: '#8a9064' });
      const RK = '#9a978c';
      for (const [x, y, z, r] of [[0, 0.3, -0.42, 0.5], [-0.48, 0.2, -0.48, 0.42], [0.48, 0.22, -0.5, 0.4], [-0.15, 0.62, -0.5, 0.34], [0.28, 0.55, -0.55, 0.3], [-0.66, 0.1, -0.05, 0.24], [0.66, 0.1, -0.1, 0.23]]) rock(b, x, y, z, r, shade(RK, (x * 7 % 3) * 0.02 - 0.02));
      for (const [x, y, z, r] of [[-0.45, 0.48, -0.5, 0.28], [0.3, 0.76, -0.58, 0.2], [0.55, 0.44, -0.45, 0.22]]) b.blob(r, r * 0.3, r * 0.9, 0, { x, y, z, color: LEAF });
      for (const [x, y, z, s, rz] of [[-0.62, 0.36, -0.2, 1.2, 0.4], [-0.52, 0.4, -0.3, 0.9, -0.2], [0.6, 0.4, -0.22, 1.1, -0.4], [0.05, 0.86, -0.55, 1.3, 0.1], [0.68, 0.22, 0.1, 0.8, -0.6]]) crystal(b, x, y, z, s, { rz });
      // portal blanco apuntado
      b.extrude(lancetPts(0.62, 0.84), 0.2, { y: 0.06, z: -0.1, color: EWH });
      b.extrude(lancetRing(0.68, 0.9, 0.44, 0.64, 0), 0.03, { y: 0.05, z: 0.01, color: EG });
      b.extrude(lancetPts(0.44, 0.64), 0.03, { y: 0.05, z: 0.005, color: '#2e3a34' });
      crystal(b, 0, 1.02, 0.04, 0.9);
      banner(b, -0.42, 0.62, 0.02, 0.14, 0.32, { emb: 'leaf', ec: EG, rod: EG });
      // raíles y vagoneta blanca y dorada
      for (const s of [-1, 1]) b.box(0.025, 0.03, 0.95, { x: s * 0.12, y: 0.065, z: 0.48, color: '#9aa2ac' });
      for (const z of spread(5, 0.02, 0.95)) b.box(0.34, 0.025, 0.06, { y: 0.05, z, color: EW_L });
      const V = grp(b, 0, 0.08, 0.52);
      V.frustum(0.28, 0.36, 0.16, 0.36, 0.44, { y: 0.06, color: EWH_L });
      V.box(0.38, 0.03, 0.46, { y: 0.22, color: EG });
      for (const [x, z] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) V.cyl(0.05, 0.05, 0.03, 8, { x, y: 0.05, z, rz: HP, color: EG });
      crystal(b, -0.05, 0.36, 0.48, 1.0, { rz: 0.3 }); crystal(b, 0.07, 0.34, 0.58, 0.8, { rz: -0.4 });
      b.ball(0.06, 0, { x: 0.08, y: 0.33, z: 0.42, color: EG, glow: 0.2 });
      // tolda del equipo sobre los cristales extraídos
      const TD = grp(b, -0.58, 0.06, 0.58);
      for (const [x, z] of [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]]) TD.cyl(0.02, 0.025, 0.46, 5, { x, y: 0.23, z, color: EWH_L });
      TD.extrude(lancetPts(0.5, 0.22), 0.56, { y: 0.44, ry: HP, color: 'team' });
      crystal(b, -0.58, 0.14, 0.58, 0.8); crystal(b, -0.5, 0.12, 0.66, 0.6, { rz: 0.5 });
      eLamp(b, 0.42, 0.25, 0.5, 0.06);
      eFlag(b, 0.78, 0.06, 0.78, 1.1, { w: 0.3, fh: 0.18, ry: PI });
    },
  },

  // ------------------------------------------------------------------ granja (3×3)
  elf_farm: { fp: 3, build(b) { farm(b, 'elf'); } },

  // ------------------------------------------------------------------ galería de tiro (3×3)
  elf_range: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.12, 2.84, { y: -0.02, color: '#86a45e' });
      for (const z of [-0.85, 0, 0.85]) b.box(1.9, 0.02, 0.34, { x: 0.25, y: 0.05, z, color: '#a3b878' });
      // pabellón de tiro alargado
      b.box(0.9, 0.08, 2.5, { x: -0.88, y: 0.06, z: -0.05, color: EWH_D });
      for (const z of [-1.05, 0, 1.0]) for (const s of [-1, 1]) eTrunk(G, -0.88 + s * 0.34, z, 0.1, 0.8, 0.045, { roots: 2, a: z + s });
      eRoof(grp(b, -0.88, 0, -0.05, HP), 2.6, 0.62, 1.0, 0.88);
      b.box(0.05, 0.4, 2.2, { x: -1.24, y: 0.3, z: -0.05, color: EWH });
      for (const z of [-0.75, -0.45, 0.45, 0.75]) { b.extrude(archRing(0.2, 0.17, 6, 0.85), 0.03, { x: -1.19, y: 0.52, z, rz: -HP, ry: HP, order: 'YXZ', color: EW_L }); b.box(0.008, 0.4, 0.012, { x: -1.195, y: 0.52, z, color: EWH_L }); }
      for (const z of [-0.12, 0.15]) { b.cyl(0.045, 0.04, 0.24, 6, { x: -0.7, y: 0.22, z, color: EW_L }); for (const k of [-1, 1]) b.box(0.01, 0.12, 0.01, { x: -0.7 + k * 0.015, y: 0.38, z, color: EWH_L }); }
      banner(b, -0.88, 0.86, 1.17, 0.18, 0.36, { emb: 'leaf', ec: EG, rod: EG });
      // dianas colgadas de arcos de madera viva
      for (const [z, i] of [[-0.85, 0], [0, 1], [0.85, 2]]) {
        const T = grp(b, 0.95, 0.06, z, -0.85);
        T.extrude(archRing(0.32, 0.27, 7, 1.7), 0.05, { color: EW });
        T.cyl(0.01, 0.01, 0.08, 4, { y: 0.43, color: EWH_L });
        T.cyl(0.16, 0.16, 0.06, 10, { y: 0.24, rx: HP, color: EWH_L });
        T.cyl(0.11, 0.11, 0.07, 10, { y: 0.24, rx: HP, color: 'team' });
        T.cyl(0.05, 0.05, 0.08, 8, { y: 0.24, rx: HP, color: EG });
        T.box(0.012, 0.012, 0.2, { x: 0.04 - i * 0.03, y: 0.26 + i * 0.02, z: 0.1, color: EW_L });
      }
      for (const x of [-0.35, 0.75]) b.cyl(0.02, 0.025, 1.0, 5, { x, y: 0.5, z: 1.25, color: EWH_L });
      b.cyl(0.006, 0.006, 1.1, 4, { x: 0.2, y: 0.95, z: 1.25, rz: HP, color: EG });
      for (const x of spread(5, -0.3, 0.7)) b.extrude([[-0.05, 0], [0.05, 0], [0, -0.12]], 0.026, { x, y: 0.94, z: 1.25, color: 'team', flag: 0.8 });
      eFlag(b, 1.22, 0.06, -1.25, 1.4, { w: 0.4, fh: 0.24, ry: PI });
      eTree(b, 1.12, 1.15, 0.9, 0.06); eLamp(b, -0.25, 0.5, 0.45, 0.06);
    },
  },

  // ------------------------------------------------------------------ establo (3×3): cuadras para alces
  elf_stable: {
    fp: 3,
    build(b) {
      b.box(2.84, 0.12, 2.84, { y: -0.02, color: '#8a9a5c' });
      const H = grp(b, 0, 0.06, -0.85);
      H.box(2.5, 0.08, 1.0, { y: 0.04, color: EWH_D });
      H.box(2.36, 0.58, 0.86, { y: 0.37, color: EWH });
      H.box(2.4, 0.04, 0.9, { y: 0.67, color: EG });
      eRoof(H, 2.56, 0.78, 1.14, 0.69);
      for (const x of [-0.75, 0, 0.75]) { H.extrude(lancetPts(0.42, 0.54), 0.02, { x, y: 0.06, z: 0.432, color: EG }); H.extrude(lancetPts(0.36, 0.48), 0.03, { x, y: 0.08, z: 0.438, color: '#3e4a3a' }); H.box(0.34, 0.2, 0.04, { x, y: 0.18, z: 0.455, color: EW_L }); }
      H.box(0.08, 0.09, 0.16, { x: 0.75, y: 0.42, z: 0.5, rx: 0.3, color: '#a87a4a' });
      for (const s of [-1, 1]) H.cyl(0.008, 0.012, 0.14, 4, { x: 0.75 + s * 0.05, y: 0.52, z: 0.47, rz: -s * 0.6, color: '#e8dcc0' });
      // cercado de seto con arco de entrada
      for (const s of [-1, 1]) b.box(0.12, 0.2, 1.75, { x: s * 1.32, y: 0.1, z: 0.45, color: LEAF });
      for (const s of [-1, 1]) b.box(0.95, 0.2, 0.12, { x: s * 0.87, y: 0.1, z: 1.32, color: LEAF });
      for (const [x, z] of [[-1.32, 1.32], [1.32, 1.32], [-1.32, -0.4], [1.32, -0.4]]) b.ball(0.12, 0, { x, y: 0.2, z, color: LEAF_L });
      for (const s of [-1, 1]) b.cyl(0.035, 0.05, 0.62, 6, { x: s * 0.36, y: 0.31, z: 1.32, rz: -s * 0.12, color: EW });
      b.extrude(archRing(0.42, 0.36, 6, 0.5), 0.05, { y: 0.6, z: 1.32, color: EW });
      // alce blanco con manta del equipo
      const E = grp(b, 0.25, 0.06, 0.5, -0.6);
      E.blob(0.1, 0.1, 0.22, 0, { y: 0.36, color: '#ead9c0' });
      E.box(0.2, 0.08, 0.22, { y: 0.4, color: 'team' }); E.box(0.21, 0.02, 0.23, { y: 0.36, color: EG });
      E.box(0.065, 0.2, 0.08, { y: 0.5, z: 0.2, rx: 0.4, color: '#ead9c0' });
      E.box(0.065, 0.07, 0.16, { y: 0.6, z: 0.28, rx: 0.6, color: '#ead9c0' });
      for (const s of [-1, 1]) { E.cyl(0.008, 0.012, 0.22, 4, { x: s * 0.07, y: 0.72, z: 0.2, rz: -s * 0.55, rx: -0.2, color: '#d9c49a' }); E.cyl(0.006, 0.01, 0.1, 4, { x: s * 0.12, y: 0.79, z: 0.24, rz: -s * 1.2, color: '#d9c49a' }); }
      for (const [x, z] of [[-0.055, 0.13], [0.055, 0.13], [-0.055, -0.13], [0.055, -0.13]]) E.box(0.035, 0.28, 0.04, { x, y: 0.14, z, color: '#d9c4a8' });
      b.cyl(0.24, 0.2, 0.14, 8, { x: -0.8, y: 0.12, z: 0.3, color: EWH_L }); b.cyl(0.2, 0.2, 0.02, 8, { x: -0.8, y: 0.19, z: 0.3, color: '#6fc8d8', glow: 0.25 });
      b.cyl(0.2, 0.16, 0.16, 8, { x: 0.85, y: 0.14, z: 0.9, color: EW_L }); b.ball(0.17, 0, { x: 0.85, y: 0.24, z: 0.9, sy: 0.45, color: '#d8c070' });
      eFlag(b, -1.15, 0.06, 0.85, 1.4, { w: 0.4, fh: 0.24 });
      eLamp(b, 0.62, 1.15, 0.45, 0.06); eTree(b, 1.2, -0.1, 0.8, 0.06);
    },
  },

  // ------------------------------------------------------------------ templo (3×3): pozo lunar bajo cúpula de nervios
  elf_temple: {
    fp: 3, fire: [[0, 1.2, 0.6], [-0.7, 1, 0], [0.7, 1, 0]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      ePlat(b, 1.42, 0.2, -0.08);
      ePlat(b, 1.15, 0.14, 0.12, EWH);
      for (let i = 0; i < 2; i++) b.box(0.7 - i * 0.1, 0.07 + i * 0.07, 0.18, { y: (0.07 + i * 0.07) / 2 + 0.05, z: 1.24 - i * 0.16, color: EWH_L });
      const R = 0.95;
      for (let i = 0; i < 8; i++) { const a = PI / 8 + i * PI / 4; ePillar(G, Math.sin(a) * R, Math.cos(a) * R, 0.26, 1.08, 0.065); }
      b.torus(R, 0.08, 8, 4, { y: 1.38, rx: HP, rz: PI / 8, color: 'team' });
      b.torus(R, 0.035, 8, 3, { y: 1.31, rx: HP, rz: PI / 8, color: EG });
      for (let i = 0; i < 4; i++) b.extrude(archRing(R, R - 0.06, 8, 0.9), 0.05, { y: 1.4, ry: i * PI / 4 + PI / 8, color: EG });
      b.cyl(0.24, 0.24, 0.06, 8, { y: 2.2, color: EG });
      eDome(G, 0.2, 0.28, 2.22, { spin: true, teamTop: true });
      // pozo lunar con gran cristal flotante
      b.cyl(0.46, 0.5, 0.16, 8, { y: 0.34, color: EWH_L });
      b.cyl(0.4, 0.4, 0.02, 8, { y: 0.42, color: '#6fd8e0', glow: 0.55 });
      crystal(b, 0, 1.0, 0, 3.2, { spin: crySpin(0, 1.0, 0, 0.6) });
      for (let i = 0; i < 4; i++) { const a = i * HP + PI / 4; crystal(b, Math.sin(a) * 0.48, 0.47, Math.cos(a) * 0.48, 0.7); }
      banner(b, -0.36, 1.28, 0.86, 0.18, 0.5, { emb: 'leaf', ec: EG, rod: EG }); banner(b, 0.36, 1.28, 0.86, 0.18, 0.5, { emb: 'leaf', ec: EG, rod: EG });
      for (const s of [-1, 1]) banner(b, s * 0.86, 1.28, -0.36, 0.18, 0.5, { emb: 'leaf', ec: EG, rod: EG, ry: s * HP });
      for (const [x, z] of [[-1.1, -1.05], [1.1, -1.05]]) eTree(b, x, z, 1.0, 0.06);
      for (const s of [-1, 1]) eLamp(b, s * 0.5, 1.22, 0.5, 0.05);
      eFlag(b, 1.25, 0.05, 0.95, 1.5, { w: 0.4, fh: 0.24, ry: PI });
    },
  },

  // ------------------------------------------------------------------ herrería (2×2)
  elf_forge: {
    fp: 2, smoke: [[0.63, 2.02, -0.58]], fire: [[-0.4, 0.4, 0.3], [0.3, 0.9, -0.4]],
    build(b) {
      b.box(1.84, 0.12, 1.84, { y: -0.02, color: '#9a9478' });
      const M = grp(b, 0, 0.06, -0.42);
      M.box(1.7, 0.08, 0.94, { y: 0.04, color: EWH_D });
      M.box(1.58, 0.62, 0.82, { y: 0.39, color: EWH });
      M.box(1.62, 0.04, 0.86, { y: 0.7, color: EG });
      eRoof(M, 1.76, 0.6, 0.98, 0.72);
      for (const [y, h, r, x] of [[0.7, 0.55, 0.16, 0.55], [1.25, 0.4, 0.13, 0.58], [1.62, 0.3, 0.11, 0.63]]) { M.cyl(r * 0.9, r, h, 7, { x, y: y + h / 2, z: -0.16, color: EWH_L }); M.cyl(r * 1.1, r * 1.1, 0.04, 7, { x, y: y + h, z: -0.16, color: EG }); }
      // horno-cúpula con brasas y cristal
      M.ball(0.3, 1, { x: -0.42, y: 0.12, z: 0.56, sy: 0.85, color: EWH_L });
      M.cyl(0.33, 0.33, 0.04, 10, { x: -0.42, y: 0.12, z: 0.56, color: 'team' });
      M.extrude(archPts(0.24, 0.2), 0.06, { x: -0.42, y: 0.08, z: 0.82, color: '#ff8a2a', glow: 1 });
      M.box(0.2, 0.04, 0.12, { x: -0.42, y: 0.1, z: 0.8, color: '#ffc050', glow: 1 });
      crystal(b, -0.42, 0.48, 0.12, 0.9);
      const A = grp(b, 0.12, 0.06, 0.55, -0.3);
      A.cyl(0.08, 0.1, 0.14, 8, { y: 0.07, color: EWH_D });
      A.box(0.24, 0.06, 0.1, { y: 0.17, color: '#c8ccd2' }); A.cone(0.04, 0.1, 5, { x: 0.16, y: 0.17, rz: -HP, color: '#c8ccd2' });
      A.box(0.13, 0.02, 0.03, { y: 0.21, ry: 0.4, color: '#ffb040', glow: 0.9 });
      b.cyl(0.14, 0.1, 0.12, 8, { x: 0.5, y: 0.12, z: 0.68, color: EWH_L }); b.cyl(0.12, 0.12, 0.02, 8, { x: 0.5, y: 0.18, z: 0.68, color: '#5fb8d0', glow: 0.25 });
      b.box(0.04, 0.34, 0.3, { x: 0.82, y: 0.23, z: 0.3, color: EW });
      for (const z of [0.2, 0.3, 0.4]) { b.extrude(lancetPts(0.03, 0.34), 0.012, { x: 0.79, y: 0.1, z, ry: HP, rz: 0.15, order: 'YXZ', color: '#d8dce2' }); b.box(0.02, 0.02, 0.07, { x: 0.79, y: 0.1, z, color: EG }); }
      eDoor(M, 0.3, 0.415, 0.22, 0.4, { y: 0.08 });
      M.extrude(lancetPts(0.4, 0.14), 0.24, { x: 0.3, y: 0.62, z: 0.5, rx: -HP + 0.25, color: 'team' });
      eWin(b, 0.0, 0.3, -0.42 + 0.415, 0.09, 0.22, 0);
      for (let i = 0; i < 3; i++) b.box(0.1, 0.035, 0.05, { x: 0.25 + i * 0.03, y: 0.08 + i * 0.035, z: 0.86, ry: i * 0.3, color: '#dfe8ee' });
      for (let i = 0; i < 3; i++) log(b, -0.78, 0.1 + (i === 2 ? 0.1 : 0), 0.4 + i * 0.12 - (i === 2 ? 0.18 : 0), 0.3, 0.05, { ry: HP, bark: BIRCH, wood: '#e9d9b0' });
      eFlag(b, -0.82, 0.78, -0.42, 0.62, { w: 0.3, fh: 0.18 });
    },
  },

  // ------------------------------------------------------------------ mercado (3×3): puestos con sombrillas del equipo
  elf_market: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      ePlat(b, 1.52, 0.16, -0.1, EWH_D);
      b.cyl(1.2, 1.2, 0.02, 8, { y: 0.07, ry: PI / 8, color: '#d8d2bc' });
      eTrunk(G, 0, -0.05, 0.06, 1.2, 0.13, { roots: 4 });
      for (const [x, y, z, r] of [[0, 1.45, -0.05, 0.48], [-0.38, 1.28, 0.05, 0.32], [0.38, 1.3, -0.1, 0.32], [0.05, 1.3, -0.42, 0.3]]) b.ball(r, 1, { x, y, z, sy: 0.82, color: shade(LEAF_L, (y - 1.35) * 0.4), wave: (px, py) => Math.max(0, py - 0.8) * 0.3 });
      b.cyl(0.42, 0.44, 0.14, 8, { y: 0.13, z: -0.05, color: EWH_L }); b.cyl(0.43, 0.43, 0.03, 8, { y: 0.2, z: -0.05, color: EG });
      const goods = [['#d8452e', '#e8a33a', '#8bbf4a'], ['#9fd8ff', '#c08aff', '#7ff0c0'], ['#e8d8a0', '#5f9a4c', '#d9b44a'], ['#e85a8a', '#f0c040', '#a0d060']];
      [[-0.88, 0.62], [0.88, 0.62], [-0.9, -0.7], [0.9, -0.7]].forEach(([x, z], k) => {
        const S = grp(b, x, 0.06, z, Math.atan2(-x, -z));
        S.box(0.56, 0.26, 0.24, { y: 0.13, z: 0.12, color: EW_L }); S.box(0.6, 0.03, 0.28, { y: 0.27, z: 0.12, color: EG });
        S.cyl(0.018, 0.022, 0.78, 6, { y: 0.39, z: -0.06, color: EWH_L });
        S.cone(0.46, 0.2, 8, { y: 0.84, z: -0.06, color: 'team' });
        S.cone(0.2, 0.1, 8, { y: 0.97, z: -0.06, color: EWH_L });
        S.cyl(0.47, 0.47, 0.03, 8, { y: 0.73, z: -0.06, color: EG });
        goods[k].forEach((c, i) => { const gx = -0.18 + i * 0.18; if (k === 1) { const [px, pz] = S.P(gx, 0.12); crystal(b, px, 0.4, pz, 0.55, { color: c }); } else S.ball(0.055, 0, { x: gx, y: 0.33, z: 0.12, color: c }); });
        S.cyl(0.07, 0.055, 0.08, 7, { x: 0.2, y: 0.32, z: 0.02, color: EW });
      });
      for (const [x, z] of [[-0.3, 1.1], [0.3, 1.1]]) eLamp(b, x, z, 0.5, 0.06);
      eFlag(b, 1.15, 0.06, 0.05, 1.6, { w: 0.42, fh: 0.26, ry: PI });
      for (const [x, z] of [[-1.15, 0.0], [0.0, 1.25]]) { b.cyl(0.08, 0.07, 0.16, 8, { x, y: 0.14, z, color: EW_L }); b.ball(0.07, 0, { x, y: 0.22, z, sy: 0.6, color: '#e3c050' }); }
    },
  },

  // ------------------------------------------------------------------ torre (2×2, ~2.6): aguja blanca con balcón y cristal
  elf_tower: {
    fp: 2, fire: [[0, 1.6, 0.3], [0, 0.9, 0.35]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      ePlat(b, 0.78, 0.22, -0.1);
      ePlat(b, 0.58, 0.1, 0.12, EWH);
      eTrunk(G, 0, 0, 0.12, 0.42, 0.33, { roots: 5, a: 0.3, rootK: 0.6 });
      b.cyl(0.3, 0.4, 1.62, 8, { y: 0.95, ry: PI / 8, color: EWH });
      for (const [y, rx, rz] of [[0.55, 0.25, 0.1], [0.95, -0.22, 0.15], [1.35, 0.2, -0.12]]) b.torus(0.4 - (y - 0.3) * 0.07, 0.028, 10, 3, { y, rx: HP + rx, rz, color: EW });
      for (const [y, a] of [[0.62, 2.0], [1.0, -2.2], [1.42, 1.0], [0.7, -0.6]]) b.ball(0.065, 0, { x: Math.sin(a) * 0.37, y, z: Math.cos(a) * 0.37, color: LEAF_L });
      for (const [y, a] of [[0.72, 0], [1.2, 0], [1.0, HP], [1.0, -HP]]) eWin(b, Math.sin(a) * 0.345, y, Math.cos(a) * 0.345, 0.09, 0.22, a);
      eDoor(G, 0, 0.39, 0.2, 0.34, { y: 0.22, gem: false });
      // balcón
      b.cyl(0.56, 0.4, 0.14, 8, { y: 1.8, ry: PI / 8, color: EWH_L });
      b.cyl(0.57, 0.57, 0.03, 8, { y: 1.88, ry: PI / 8, color: 'team' });
      b.torus(0.53, 0.018, 8, 3, { y: 2.0, rx: HP, rz: PI / 8, color: EG });
      for (let i = 0; i < 8; i++) { const a = i * PI / 4; b.box(0.02, 0.12, 0.02, { x: Math.sin(a) * 0.53, y: 1.94, z: Math.cos(a) * 0.53, color: EG }); }
      b.cyl(0.26, 0.28, 0.32, 8, { y: 2.03, ry: PI / 8, color: EWH });
      for (const a of [0, HP, -HP, PI]) b.box(0.07, 0.18, 0.02, { x: Math.sin(a) * 0.27, y: 2.05, z: Math.cos(a) * 0.27, ry: a, color: EGL, glow: 0.5 });
      // aguja de hojas y cristal flotante
      G.lathe([[0.36, 0], [0.33, 0.12], [0.22, 0.3], [0.1, 0.5], [0.001, 0.66]], 8, { y: 2.18, color: LEAF });
      b.cyl(0.35, 0.36, 0.06, 8, { y: 2.21, color: 'team' });
      crystal(b, 0, 2.98, 0, 1.6, { spin: crySpin(0, 2.98, 0, 1.2) });
      for (const s of [-1, 1]) banner(b, s * 0.22, 1.7, 0.42, 0.15, 0.42, { emb: 'leaf', ec: EG, rod: EG });
      eFlag(b, 0.62, 0.12, -0.55, 1.2, { w: 0.3, fh: 0.18, ry: PI });
    },
  },

  // ------------------------------------------------------------------ puerta (1×1)
  elf_gate: {
    fp: 1,
    build(b) {
      const ys = 0.46, H = 0.42, w = 0.25;
      for (const s of [-1, 1]) {
        b.box(0.26, 0.14, 0.54, { x: s * 0.37, y: 0.02, color: EWH_D });
        b.box(0.22, 1.14, 0.46, { x: s * 0.37, y: 0.57, color: EWH });
        b.box(0.24, 0.04, 0.48, { x: s * 0.37, y: 0.72, color: EG });
        b.box(0.26, 0.06, 0.5, { x: s * 0.37, y: 1.16, color: EWH_L });
        b.box(0.14, 0.03, 0.44, { x: s * 0.37, y: 1.2, color: 'team' });
        b.lathe([[0.1, 0], [0.09, 0.08], [0.05, 0.18], [0.001, 0.26]], 6, { x: s * 0.37, y: 1.2, color: LEAF });
        banner(b, s * 0.37, 1.04, 0.245, 0.13, 0.32, { emb: 'leaf', ec: EG, rod: EG });
      }
      b.extrude(lancetLintel(w, ys, H, 1.1), 0.42, { color: EWH });
      for (const s of [-1, 1]) b.extrude(lancetRing(0.6, 0.52, 0.5, 0.42, 0.06), 0.03, { y: ys - 0.06, z: s * 0.215, color: EG });
      b.box(0.52, 0.06, 0.44, { y: 1.13, color: EWH_L });
      for (const [x, r] of [[-0.12, 0.12], [0.1, 0.13]]) b.ball(r, 0, { x, y: 1.2, z: 0, sy: 0.6, color: LEAF_L });
      crystal(b, 0, 1.28, 0.0, 0.9);
      b.box(0.5, 0.02, 0.44, { y: 0.01, color: '#d8d2bc' });
      const leaf = (G, dir) => {
        G.extrude(lancetLeaf(w, ys, H, dir), 0.05, { color: EW_L });
        G.box(0.03, 0.5, 0.062, { x: dir * w * 0.5, y: 0.3, color: EG });
        G.box(w * 0.8, 0.03, 0.062, { x: dir * w * 0.5, y: 0.3, color: EG });
      };
      b.part = 1; leaf(grp(b, -w, 0, 0, 0), 1); leaf(grp(b, w, 0, 0, 0), -1);
      b.part = 2; leaf(grp(b, -0.22, 0, 0.02, HP), 1); leaf(grp(b, 0.22, 0, 0.02, -HP), -1);
    },
  },

  // ------------------------------------------------------------------ taller (3×3): balista a medio hacer y grúa-árbol
  elf_workshop: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.12, 2.84, { y: -0.02, color: '#90885c' });
      for (let i = 0; i < 8; i++) b.box(0.06, 0.02, 0.04, { x: -0.6 + (i * 0.37) % 1.3, y: 0.05, z: 0.2 + (i * 0.23) % 0.9, ry: i, color: '#e9d9b0' });
      const W = grp(b, -0.3, 0.06, -0.8);
      W.box(2.0, 0.08, 1.0, { y: 0.04, color: EWH_D });
      W.box(1.9, 0.6, 0.08, { y: 0.38, z: -0.42, color: EWH });
      for (const x of [-0.9, -0.3, 0.3, 0.9]) eTrunk(W, x, 0.42, 0.08, 0.72, 0.05, { roots: 2, a: x });
      eRoof(W, 2.1, 0.66, 1.18, 0.78);
      for (let i = 0; i < 4; i++) W.box(0.8, 0.045, 0.16, { x: -0.4, y: 0.11 + i * 0.05, z: -0.15, color: shade(BIRCH, i * 0.02) });
      // grúa: árbol curvado con viga colgante
      eTrunk(G, 1.05, -0.95, 0.06, 1.1, 0.12, { roots: 3 });
      b.cyl(0.07, 0.1, 0.7, 6, { x: 1.0, y: 1.38, z: -0.75, rx: 0.7, color: EW });
      b.cyl(0.05, 0.07, 0.6, 6, { x: 0.95, y: 1.58, z: -0.3, rx: 1.4, color: EW });
      b.ball(0.26, 1, { x: 1.05, y: 1.35, z: -1.0, color: LEAF }); b.ball(0.2, 1, { x: 0.9, y: 1.62, z: -0.55, color: LEAF_L });
      b.box(0.012, 0.75, 0.012, { x: 0.95, y: 1.2, z: -0.05, color: LEAF_D });
      b.box(0.6, 0.07, 0.07, { x: 0.95, y: 0.8, z: -0.05, color: BIRCH });
      // balista a medio hacer
      const K = grp(b, -0.15, 0.06, 0.55, 0.3);
      K.box(0.3, 0.08, 0.8, { y: 0.2, color: EW_L });
      for (const s of [-1, 1]) K.cyl(0.13, 0.13, 0.05, 8, { x: s * 0.2, y: 0.13, z: -0.2, rz: HP, color: EW });
      K.cyl(0.13, 0.13, 0.05, 8, { x: 0.55, y: 0.05, z: 0.35, color: EW });
      K.box(0.06, 0.06, 0.9, { y: 0.32, z: 0.05, color: BIRCH });
      K.extrude(archRing(0.42, 0.38, 8, 0.45), 0.05, { y: 0.32, z: 0.36, rx: HP, color: EW_L });
      K.box(0.06, 0.2, 0.06, { y: 0.26, z: 0.38, color: EG });
      K.box(0.3, 0.04, 0.12, { y: 0.25, z: -0.3, color: 'team' });
      for (let i = 0; i < 3; i++) b.box(0.025, 0.025, 0.4, { x: 0.65 + i * 0.04, y: 0.08 + (i % 2) * 0.03, z: 0.75, color: EW_L });
      for (let i = 0; i < 4; i++) b.box(0.07, 0.07, 0.9, { x: 1.0 + (i % 2) * 0.08 + Math.floor(i / 2) * 0.04, y: 0.1 + Math.floor(i / 2) * 0.07, z: 0.55, color: BIRCH });
      b.cyl(0.2, 0.2, 0.05, 10, { x: -1.25, y: 0.24, z: 0.35, rz: HP - 0.2, color: EW_L }); b.cyl(0.06, 0.06, 0.07, 6, { x: -1.24, y: 0.24, z: 0.35, rz: HP - 0.2, color: EG });
      eFlag(b, 1.25, 0.06, 1.25, 1.35, { w: 0.4, fh: 0.24, ry: PI });
      banner(b, -0.3, 0.92, -0.2, 0.18, 0.34, { emb: 'leaf', ec: EG, rod: EG });
      eLamp(b, -1.15, 1.1, 0.45, 0.06);
    },
  },

  // ------------------------------------------------------------------ castillo (4×4, ~2.8): ciudadela blanca
  elf_castle: {
    fp: 4, fire: [[0, 2.0, -0.2], [-1.3, 1.3, 1.3], [1.3, 1.3, -1.3], [0.6, 0.9, 1.3]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      ePlat(b, 1.92, 0.24, -0.12);
      b.cyl(1.5, 1.5, 0.02, 8, { y: 0.13, ry: PI / 8, color: '#d8d2bc' });
      const y0 = 0.12, R = 1.28, WH = 0.88;
      for (const a of [0, HP, PI, -HP]) {
        const C = grp(b, 0, y0, 0, a);
        const segs = a === 0 ? [[-1.0, -0.32], [0.32, 1.0]] : [[-1.0, 1.0]];
        for (const [x0, x1] of segs) {
          C.box(x1 - x0, WH, 0.3, { x: (x0 + x1) / 2, y: WH / 2, z: R, color: EWH });
          C.box(x1 - x0, 0.04, 0.32, { x: (x0 + x1) / 2, y: WH * 0.68, z: R, color: EG });
          C.box(x1 - x0, 0.05, 0.34, { x: (x0 + x1) / 2, y: WH + 0.02, z: R, color: EWH_L });
          for (const x of spread(Math.round((x1 - x0) / 0.34), x0, x1)) C.pyramid(0.1, 0.17, 0.08, { x, y: WH + 0.13, z: R + 0.11, color: EWH_L });
        }
      }
      for (const [x, z] of [[-R, R], [R, R], [-R, -R], [R, -R]]) {
        b.cyl(0.27, 0.33, 1.55, 8, { x, y: y0 + 0.77, z, ry: PI / 8, color: EWH });
        b.cyl(0.34, 0.3, 0.12, 8, { x, y: y0 + 1.6, z, ry: PI / 8, color: EWH_L });
        b.cyl(0.35, 0.35, 0.04, 8, { x, y: y0 + 1.56, z, ry: PI / 8, color: EG });
        G.lathe([[0.32, 0], [0.3, 0.14], [0.2, 0.36], [0.08, 0.6], [0.001, 0.78]], 8, { x, y: y0 + 1.66, z, color: 'team', teamShade: 0.85 });
        b.cyl(0.34, 0.33, 0.06, 8, { x, y: y0 + 1.66, z, color: LEAF });
        crystal(b, x, y0 + 2.58, z, 0.8);
        if (z > 0) eWin(b, x, y0 + 0.75, z + 0.3, 0.08, 0.2, 0);
      }
      // torre del homenaje con cúpula bulbosa
      const K = grp(b, 0, y0, -0.25);
      K.cyl(0.6, 0.66, 1.75, 8, { y: 0.88, ry: PI / 8, color: EWH });
      K.cyl(0.66, 0.66, 0.04, 8, { y: 1.25, ry: PI / 8, color: EG });
      K.cyl(0.76, 0.6, 0.14, 8, { y: 1.8, ry: PI / 8, color: EWH_L });
      K.cyl(0.77, 0.77, 0.03, 8, { y: 1.88, ry: PI / 8, color: 'team' });
      K.torus(0.72, 0.018, 8, 3, { y: 1.99, rx: HP, rz: PI / 8, color: EG });
      eDome(K, 0.58, 0.78, 1.88, { spin: true, teamTop: true });
      for (const a of [-0.5, 0.5]) eWin(b, Math.sin(a) * 0.62, y0 + 0.95, -0.25 + Math.cos(a) * 0.62, 0.12, 0.34, a);
      eDoor(K, 0, 0.6, 0.26, 0.5, { y: 0.0 });
      banner(b, -0.36, y0 + 1.72, -0.25 + 0.55, 0.2, 0.55, { emb: 'leaf', ec: EG, rod: EG, ry: -0.6 });
      banner(b, 0.36, y0 + 1.72, -0.25 + 0.55, 0.2, 0.55, { emb: 'leaf', ec: EG, rod: EG, ry: 0.6 });
      for (const s of [-1, 1]) { const T = grp(b, s * 0.68, y0, -0.55); T.cyl(0.22, 0.25, 1.35, 8, { y: 0.68, color: EWH_L }); eDome(T, 0.28, 0.42, 1.35, { band: EG }); }
      // gran árbol a un lado
      eTrunk(G, -0.72, -1.0, y0, 1.35, 0.13, { roots: 3 });
      for (const [x, y, z, r] of [[-0.75, 1.75, -1.0, 0.42], [-0.45, 1.6, -1.1, 0.3], [-1.0, 1.58, -0.85, 0.3]]) b.ball(r, 1, { x, y, z, sy: 0.82, color: shade(LEAF_L, (y - 1.65) * 0.4), wave: (px, py) => Math.max(0, py - 1.1) * 0.3 });
      // puerta principal apuntada
      for (const s of [-1, 1]) { b.box(0.22, 1.18, 0.4, { x: s * 0.42, y: y0 + 0.59, z: R, color: EWH_L }); G.lathe([[0.15, 0], [0.13, 0.12], [0.07, 0.28], [0.001, 0.4]], 6, { x: s * 0.42, y: y0 + 1.18, z: R, color: LEAF }); }
      b.extrude(lancetLintel(0.31, y0 + 0.5, 0.38, y0 + 1.0), 0.34, { z: R, color: EWH });
      b.extrude(lancetRing(0.7, 0.96, 0.6, 0.86, 0.0), 0.03, { y: y0 + 0.02, z: R + 0.17, color: EG });
      b.extrude(lancetPts(0.58, 0.84), 0.03, { y: y0 + 0.02, z: R + 0.165, color: EW_L });
      for (const s of [-1, 1]) eFlag(b, s * 0.82, y0 + WH, R - 0.02, 0.85, { w: 0.34, fh: 0.2, ry: s > 0 ? PI : 0 });
      for (const s of [-1, 1]) eLamp(b, s * 0.75, 0.75, 0.45, y0);
    },
  },

  // ------------------------------------------------------------------ muro élfico
  elf_wall_post: {
    fp: 1,
    build(b) {
      b.cyl(0.34, 0.36, 0.16, 8, { y: 0.0, ry: PI / 8, color: EWH_D });
      b.cyl(0.29, 0.3, 0.92, 8, { y: 0.5, ry: PI / 8, color: EWH });
      b.cyl(0.305, 0.305, 0.04, 8, { y: 0.6, ry: PI / 8, color: EG });
      b.cyl(0.34, 0.31, 0.08, 8, { y: 0.98, ry: PI / 8, color: EWH_L });
      b.torus(0.3, 0.022, 10, 3, { y: 0.35, rx: HP + 0.25, color: EW });
      b.ball(0.05, 0, { x: 0.27, y: 0.42, z: 0.1, color: LEAF_L });
      b.lathe([[0.24, 0], [0.24, 0.08], [0.16, 0.2], [0.06, 0.3], [0.001, 0.36]], 8, { y: 1.02, color: 'team' });
      b.cyl(0.25, 0.25, 0.03, 8, { y: 1.03, color: EG });
      crystal(b, 0, 1.44, 0, 0.6);
    },
  },
  elf_wall_seg: {
    fp: 1,
    build(b) {
      b.box(0.5, 0.14, 0.44, { x: 0.25, y: 0.0, color: EWH_D });
      b.box(0.5, 0.8, 0.38, { x: 0.25, y: 0.4, color: EWH });
      b.box(0.5, 0.03, 0.39, { x: 0.25, y: 0.6, color: EG });
      b.box(0.5, 0.05, 0.42, { x: 0.25, y: 0.82, color: EWH_L });
      b.box(0.5, 0.07, 0.14, { x: 0.25, y: 0.875, color: LEAF });
      for (const s of [-1, 1]) {
        b.pyramid(0.11, 0.18, 0.08, { x: 0.375, y: 0.935, z: s * 0.16, color: EWH_L });
        b.extrude(lancetPts(0.09, 0.22), 0.012, { x: 0.25, y: 0.22, z: s * 0.194, color: shade(EWH, -0.05) });
      }
      for (const [x, z] of [[0.12, 0.2], [0.42, -0.2]]) b.ball(0.05, 0, { x, y: 0.7, z, sy: 0.7, color: LEAF_L });
    },
  },
};

/* ==================================================================================== ENANOS */
const GR = '#8d8a86', GR_D = '#6e6b68', GR_L = '#a5a29c', SL = '#4f5661', SL_L = '#606874', BR = '#c08a3e', BR_D = '#9a6c2e', IR = '#6d737c',
  RN = '#5fe3ff', RO = '#ff9a3a', DWD = '#6b4a2c', DWD_L = '#8a6440', MT = '#8a847c', DGND = '#857a68', FIRE = '#ff8a2a';

/** Bloque de granito ataludado con hiladas marcadas. */
function dMass(G, w, d, h, y, o = {}) {
  const k = o.k ?? 0.9, x = o.x || 0, z = o.z || 0;
  G.frustum(w, d, h, w * k, d * k, { x, y, z, color: o.col || GR });
  for (const t of (o.courses || [0.38, 0.74])) { const s = 1 - (1 - k) * t, s2 = 1 - (1 - k) * (t + 0.04); G.frustum(w * s + 0.02, d * s + 0.02, h * 0.04, w * s2 + 0.02, d * s2 + 0.02, { x, y: y + h * t, z, color: o.line || GR_D }); }
}
/** Tejado de pizarra a cuatro aguas, bajo, con alero de bronce, hilada y casquete del equipo. */
function dRoof(G, w, d, h, y, o = {}) {
  const x = o.x || 0, z = o.z || 0, r = o.r ?? Math.max(0, w - d) * 0.9, t0 = o.t0 ?? 0.76;
  G.hip(w, d, h, r, { x, y, z, color: o.col || SL });
  const sl = (t) => [w - (w - r) * t, d * (1 - t)];
  let [a, c] = sl(0.3), [a2, c2] = sl(0.36); G.frustum(a + 0.02, c + 0.02, h * 0.06, a2 + 0.02, c2 + 0.02, { x, y: y + h * 0.3, z, color: SL_L });
  [a, c] = sl(t0); G.hip(a + 0.03, c + 0.03, h * (1 - t0) + 0.02, r + 0.02, { x, y: y + h * t0 - 0.004, z, color: o.cap || 'team', teamShade: 0.9 });
  G.frustum(w + 0.04, d + 0.04, 0.06, w + 0.01, d + 0.01, { x, y: y - 0.02, z, color: BR });
}
/** Runa brillante en coordenadas de grupo (mira a +Z del grupo). */
function gRune(G, x, y, z, s = 1, col = RN) {
  G.box(0.022 * s, 0.13 * s, 0.026, { x, y, z, color: col, glow: 1 });
  G.box(0.02 * s, 0.075 * s, 0.026, { x: x + 0.028 * s, y: y + 0.03 * s, z, rz: -0.75, color: col, glow: 1 });
  G.box(0.02 * s, 0.075 * s, 0.026, { x: x - 0.028 * s, y: y - 0.03 * s, z, rz: -0.75, color: col, glow: 1 });
}
/** Portón de bronce con arco, marco de sillares, dintel y runa. */
function dDoor(G, x, z, w, h, o = {}) {
  const y = o.y || 0;
  G.box(w + 0.16, h + 0.1, 0.08, { x, y: y + (h + 0.1) / 2, z: z - 0.03, color: o.frame || GR_L });
  G.extrude(archPts(w, h), 0.06, { x, y, z, color: BR_D });
  G.box(0.025, h * 0.86, 0.07, { x, y: y + h * 0.43, z, color: BR });
  for (const yy of [0.22, 0.56]) G.box(w * 0.94, 0.035, 0.072, { x, y: y + h * yy, z, color: IR });
  G.box(w + 0.24, 0.09, 0.13, { x, y: y + h + 0.1, z: z - 0.01, color: GR_D });
  gRune(G, x, y + h + 0.1, z + 0.06, 0.55, o.rune || RN);
}
/** Chimenea maciza con banda de bronce y sombrerete de hierro. */
function dChimney(G, x, z, y0, h, s = 0.24) {
  G.box(s, h, s, { x, y: y0 + h / 2, z, color: GR_D });
  G.box(s + 0.05, 0.05, s + 0.05, { x, y: y0 + h * 0.62, z, color: BR });
  G.frustum(s + 0.08, s + 0.08, 0.08, s - 0.02, s - 0.02, { x, y: y0 + h, z, color: IR });
}
/** Ventana pequeña con reja y luz cálida. */
const dWin = (b, x, y, z, w, h, ry = 0) => win(b, x, y, z, w, h, { ry, frame: GR_L, glass: '#e8a040', glow: 0.4 });
/** Bandera enana: mástil de hierro, remate de bronce, paño rectangular con franja de bronce. */
const dFlag = (b, x, y0, z, h, o = {}) => flag(b, x, y0, z, h, Object.assign({ pole: IR, tip: BR, shape: 'rect', r: 0.022, emblem: BR }, o));
/** Escudo redondo del equipo con borde y umbo de bronce. */
const dShield = (b, x, y, z, ry = 0, r = 0.1) => roundShield(b, x, y, z, ry, r, { rim: BR, boss: BR });
/** Brasero de bronce con fuego. */
function brazier(b, x, y, z, s = 1) {
  b.cyl(0.03 * s, 0.05 * s, 0.14 * s, 6, { x, y: y + 0.07 * s, z, color: IR });
  b.cyl(0.1 * s, 0.06 * s, 0.07 * s, 8, { x, y: y + 0.17 * s, z, color: BR });
  b.cone(0.07 * s, 0.16 * s, 5, { x, y: y + 0.27 * s, z, color: FIRE, glow: 1 });
}
/** Farol de hierro con luz anaranjada. */
function dLamp(b, x, z, h = 0.5, y0 = 0) {
  b.box(0.04, h, 0.04, { x, y: y0 + h / 2, z, color: IR });
  b.box(0.09, 0.1, 0.09, { x, y: y0 + h + 0.03, z, color: '#ffb050', glow: 0.9 });
  b.box(0.11, 0.025, 0.11, { x, y: y0 + h + 0.09, z, color: BR });
}
/** Montaña de fondo: rocas grandes facetadas. */
const mount = (b, list) => list.forEach(([x, y, z, r], i) => rock(b, x, y, z, r, shade(MT, ((i * 37) % 5) * 0.015 - 0.03), { sy: 0.85 }));
/** Hacha de guerra (mango vertical + hoja). */
function axe(G, x, y, z, a = 0) {
  G.cyl(0.012, 0.012, 0.4, 5, { x, y: y + 0.2, z, rz: a, color: DWD_L });
  G.extrude([[0, 0], [0.09, 0.05], [0.09, -0.07], [0, -0.03]], 0.02, { x: x - Math.sin(a) * 0.15, y: y + 0.35, z, rz: a, color: '#9aa2ac' });
}

const DWARF = {
  // ------------------------------------------------------------------ casa (2×2): casa baja de granito junto a la roca
  dwarf_house: {
    fp: 2, smoke: [[0.45, 1.62, -0.4]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.14, 1.84, { y: -0.04, color: DGND });
      mount(b, [[-0.5, 0.25, -0.56, 0.34], [0.05, 0.32, -0.6, 0.32], [0.6, 0.2, -0.6, 0.3], [-0.72, 0.12, -0.15, 0.19]]);
      G.frustum(1.56, 1.2, 0.14, 1.5, 1.14, { y: -0.01, z: 0.08, color: GR_D });
      dMass(G, 1.44, 1.06, 0.56, 0.13, { z: 0.08, k: 0.92, courses: [0.45] });
      dRoof(G, 1.64, 1.26, 0.42, 0.69, { z: 0.08 });
      dChimney(G, 0.45, -0.4, 0.62, 0.9, 0.26);
      dDoor(G, -0.16, 0.6, 0.26, 0.36, { y: 0.13 });
      dWin(b, 0.36, 0.42, 0.585, 0.14, 0.14);
      dShield(b, -0.56, 0.45, 0.585, 0, 0.1); dShield(b, 0.68, 0.42, 0.3, HP, 0.09);
      for (const s of [-1, 1]) G.box(0.12, 0.6, 0.12, { x: s * 0.72, y: 0.43, z: 0.6, color: GR_L });
      dFlag(b, -0.62, 0.9, 0.08, 0.55, { w: 0.3, fh: 0.18 });
      barrel(b, 0.62, 0.78, 0.09, 0.2, { col: '#7a5a3a', hoop: BR });
      for (let i = 0; i < 3; i++) log(b, -0.65, 0.07 + (i === 2 ? 0.1 : 0), 0.62 + i * 0.1 - (i === 2 ? 0.15 : 0), 0.3, 0.05, { ry: HP });
      b.cyl(0.012, 0.012, 0.32, 5, { x: 0.38, y: 0.18, z: 0.78, rz: 0.4, color: DWD_L }); b.box(0.16, 0.03, 0.03, { x: 0.32, y: 0.32, z: 0.78, rz: 0.4, color: '#9aa2ac' });
      for (const [x, z] of [[0.15, -0.45], [-0.25, -0.5]]) { b.cyl(0.015, 0.02, 0.07, 5, { x, y: 0.5, z, color: '#e8dcc0' }); b.cyl(0.05, 0.02, 0.04, 6, { x, y: 0.55, z, color: '#c0503a' }); }
    },
  },

  // ------------------------------------------------------------------ centro urbano (4×4): salón excavado en la montaña
  dwarf_tc: {
    fp: 4, smoke: [[-1.05, 2.6, -0.95], [1.05, 2.6, -0.95]], fire: [[-0.8, 1.2, 0.4], [0.8, 1.2, 0.4], [0, 1.8, -0.2], [0, 0.9, 0.9]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(3.84, 0.16, 3.84, { y: -0.04, color: DGND });
      mount(b, [[-1.3, 0.5, -1.3, 0.58], [-0.45, 0.75, -1.32, 0.58], [0.45, 0.8, -1.32, 0.58], [1.3, 0.5, -1.3, 0.56], [0, 1.3, -1.35, 0.5], [-0.9, 1.1, -1.38, 0.42], [0.9, 1.12, -1.38, 0.42], [-1.62, 0.2, -0.7, 0.28], [1.62, 0.2, -0.75, 0.28]]);
      G.frustum(3.44, 2.3, 0.18, 3.34, 2.2, { y: -0.02, z: 0.08, color: GR_D });
      // salón principal y piso superior
      dMass(G, 3.0, 1.7, 0.86, 0.16, { z: -0.05, k: 0.93 });
      G.box(2.86, 0.08, 1.64, { y: 1.04, z: -0.05, color: GR_L });
      merlonsX(G, -1.38, 1.38, 9, 1.08, 0.72, 0.15, 0.13, 0.12, GR);
      dMass(G, 2.1, 1.2, 0.5, 1.08, { z: -0.25, k: 0.93, courses: [0.5] });
      dRoof(G, 2.32, 1.42, 0.5, 1.58, { z: -0.25 });
      for (const x of [-0.75, -0.3, 0.3, 0.75]) dWin(b, x, 1.33, 0.33, 0.12, 0.14);
      // gran portón entre pilares con braseros
      dDoor(G, 0, 0.82, 0.56, 0.62, { y: 0.16 });
      for (const s of [-1, 1]) {
        G.frustum(0.3, 0.3, 1.0, 0.24, 0.24, { x: s * 0.5, y: 0.16, z: 0.88, color: GR_L });
        G.box(0.32, 0.06, 0.32, { x: s * 0.5, y: 0.5, z: 0.88, color: BR });
        brazier(b, s * 0.5, 1.16, 0.88, 1.2);
        gRune(G, s * 0.5, 0.82, 1.015, 0.8, RO);
      }
      G.box(1.24, 0.13, 0.3, { y: 1.08, z: 0.88, color: GR });
      for (const x of [-0.25, 0, 0.25]) gRune(G, x, 1.08, 1.04, 0.6, RN);
      // estatuas de enano
      for (const s of [-1, 1]) {
        const S = grp(b, s * 1.0, 0.16, 1.15);
        S.box(0.3, 0.12, 0.3, { y: 0.06, color: GR_D });
        S.frustum(0.24, 0.2, 0.3, 0.2, 0.16, { y: 0.12, color: GR_L });
        S.ball(0.075, 0, { y: 0.5, color: GR_L }); S.cone(0.085, 0.09, 6, { y: 0.58, color: BR });
        S.wedge(0.14, 0.18, 0.06, { y: 0.28, z: 0.1, rx: PI, color: GR });
        S.box(0.03, 0.34, 0.03, { x: s * 0.13, y: 0.3, z: 0.04, color: IR }); S.box(0.1, 0.06, 0.03, { x: s * 0.13, y: 0.47, z: 0.04, color: '#9aa2ac' });
      }
      // estandartes, runas del frontis y chimeneas
      for (const s of [-1, 1]) {
        banner(b, s * 1.1, 0.98, 0.81, 0.28, 0.55, { emb: 'rune', ec: RN, rod: BR });
        dShield(b, s * 0.75, 0.62, 0.82, 0, 0.11);
        dChimney(G, s * 1.05, -0.95, 0.9, 1.6, 0.3);
        dFlag(b, s * 1.5, 0.16, 1.05, 1.35, { w: 0.42, fh: 0.26, ry: s > 0 ? PI : 0 });
      }
      for (let i = 0; i < 3; i++) { G.box(1.0 - i * 0.1, 0.05 * (3 - i), 0.14, { y: 0.025 * (3 - i) + 0.12, z: 1.12 + i * 0.13, color: GR_L }); G.box(0.42, 0.012, 0.14, { y: 0.05 * (3 - i) + 0.125, z: 1.12 + i * 0.13, color: 'team' }); }
      G.box(0.42, 0.012, 0.3, { y: 0.165, z: 0.95, color: 'team' });
      // carro de mineral y barriles
      barrel(b, -1.45, 0.55, 0.09, 0.2, { col: '#7a5a3a', hoop: BR, y: 0.12 }); barrel(b, -1.3, 0.75, 0.09, 0.2, { col: '#7a5a3a', hoop: BR, y: 0.12 });
      crate(b, 1.4, 0.12, 0.6, 0.18, { col: DWD_L }); b.ball(0.08, 0, { x: 1.55, y: 0.2, z: 0.8, color: '#e7c13d', glow: 0.2 });
    },
  },

  // ------------------------------------------------------------------ cuartel (3×3)
  dwarf_barracks: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.04, color: DGND });
      b.box(2.7, 0.02, 1.3, { y: 0.04, z: 0.62, color: '#958a74' });
      const H = grp(b, 0, 0, -0.66);
      H.frustum(2.66, 1.3, 0.14, 2.6, 1.24, { y: -0.01, color: GR_D });
      dMass(H, 2.44, 1.12, 0.72, 0.13, { k: 0.93 });
      H.box(2.36, 0.07, 1.06, { y: 0.88, color: GR_L });
      merlonsX(H, -1.12, 1.12, 7, 0.91, 0.47, 0.15, 0.14, 0.1, GR); merlonsX(H, -1.12, 1.12, 7, 0.91, -0.47, 0.15, 0.14, 0.1, GR);
      merlonsZ(H, -0.35, 0.35, 2, 0.91, -1.12, 0.15, 0.14, 0.1, GR); merlonsZ(H, -0.35, 0.35, 2, 0.91, 1.12, 0.15, 0.14, 0.1, GR);
      dRoof(H, 2.0, 0.82, 0.42, 0.91);
      dDoor(H, 0, 0.56, 0.34, 0.46, { y: 0.13 });
      for (const s of [-1, 1]) { banner(b, s * 0.55, 0.84, -0.1, 0.18, 0.4, { emb: 'rune', ec: RN, rod: BR }); dShield(b, s * 0.95, 0.5, -0.11, 0, 0.1); }
      // torreón de esquina
      const T = grp(b, 1.02, 0, -1.02);
      dMass(T, 0.7, 0.7, 1.4, 0.0, { k: 0.86 });
      T.box(0.7, 0.07, 0.7, { y: 1.42, color: GR_L });
      for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) T.box(0.13, 0.15, 0.13, { x, y: 1.53, z, color: GR });
      T.add(hipGeo(0.6, 0.6, 0.4, 0), { y: 1.46, color: SL }); T.add(hipGeo(0.26, 0.26, 0.18, 0), { y: 1.69, color: 'team' });
      gRune(T, 0, 0.95, 0.32, 0.8, RN);
      // patio: armero de hachas, escudos, poste de entrenamiento y brasero
      const R = grp(b, -0.85, 0.04, 0.58);
      for (const s of [-1, 1]) R.box(0.06, 0.45, 0.06, { x: s * 0.34, y: 0.22, color: DWD });
      R.box(0.76, 0.06, 0.08, { y: 0.42, color: DWD }); R.box(0.76, 0.05, 0.14, { y: 0.06, color: DWD });
      for (const x of spread(4, -0.28, 0.28)) axe(R, x, 0.06, 0.03, 0.05);
      for (const [x, z, a] of [[-1.2, 1.0, 0.4], [-1.05, 1.18, 0.7]]) dShield(b, x, 0.16, z, a, 0.13);
      const D = grp(b, 0.45, 0.04, 0.62);
      D.box(0.08, 0.55, 0.08, { y: 0.27, color: DWD }); D.box(0.36, 0.06, 0.06, { y: 0.42, color: DWD });
      D.frustum(0.2, 0.14, 0.18, 0.16, 0.1, { y: 0.28, color: IR }); D.ball(0.07, 0, { y: 0.55, color: IR }); D.cone(0.03, 0.08, 4, { x: 0.07, y: 0.6, rz: -0.9, color: '#e8dcc0' }); D.cone(0.03, 0.08, 4, { x: -0.07, y: 0.6, rz: 0.9, color: '#e8dcc0' });
      brazier(b, -0.1, 0.04, 1.1, 1.1);
      dFlag(b, 1.12, 0.04, 1.05, 1.45, { w: 0.44, fh: 0.28, ry: PI });
      b.box(0.16, 0.08, 0.16, { x: 1.12, y: 0.06, z: 1.05, color: GR_D });
      for (const s of [-1, 1]) b.box(0.12, 0.24, 1.4, { x: s * 1.34, y: 0.12, z: 0.62, color: GR });
    },
  },

  // ------------------------------------------------------------------ molino (2×2): torre de piedra con aspas de hierro
  dwarf_mill: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.14, 1.84, { y: -0.04, color: DGND });
      G.frustum(1.5, 1.5, 0.16, 1.4, 1.4, { y: -0.01, color: GR_D });
      dMass(G, 1.0, 1.0, 1.2, 0.15, { k: 0.8, courses: [0.3, 0.62] });
      G.box(0.84, 0.06, 0.84, { y: 1.36, color: BR });
      dRoof(G, 1.04, 1.04, 0.56, 1.38, { r: 0, t0: 0.6 });
      dFlag(b, 0, 1.86, 0, 0.4, { w: 0.3, fh: 0.18 });
      dDoor(G, 0, 0.5, 0.22, 0.32, { y: 0.15 });
      dWin(b, 0.0, 1.0, 0.43, 0.1, 0.12);
      // aspas de bastidor de hierro con lienzo
      const hy = 1.14, hz = 0.6, sp = { c: [0, hy, hz], axis: [0, 0, 1], speed: 0.8 };
      b.cyl(0.045, 0.05, 0.3, 6, { y: hy, z: hz - 0.14, rx: HP, color: IR });
      b.cyl(0.09, 0.09, 0.08, 8, { y: hy, z: hz, rx: HP, color: BR, spin: sp });
      for (let i = 0; i < 4; i++) {
        const a = i * HP + PI / 4, ca = Math.cos(a), sa = Math.sin(a), at = (d, o) => [-sa * d + ca * o, hy + ca * d + sa * o];
        let [x, y] = at(0.41, 0); b.box(0.05, 0.82, 0.05, { x, y, z: hz + 0.02, rz: a, color: IR, spin: sp });
        [x, y] = at(0.5, 0.13); b.box(0.22, 0.58, 0.026, { x, y, z: hz + 0.05, rz: a, color: i % 2 ? 'team' : '#d8cdb4', spin: sp });
        [x, y] = at(0.5, 0.25); b.box(0.03, 0.6, 0.04, { x, y, z: hz + 0.04, rz: a, color: BR, spin: sp });
        for (const d of [0.22, 0.79]) { [x, y] = at(d, 0.13); b.box(0.27, 0.03, 0.04, { x, y, z: hz + 0.04, rz: a, color: BR, spin: sp }); }
      }
      // engranaje lateral giratorio
      const gs = { c: [0.47, 0.75, 0.0], axis: [1, 0, 0], speed: 1.6 };
      b.torus(0.15, 0.035, 10, 4, { x: 0.47, y: 0.75, ry: HP, color: BR, spin: gs });
      for (let i = 0; i < 4; i++) b.box(0.04, 0.3, 0.03, { x: 0.47, y: 0.75, rx: i * PI / 4, color: BR_D, spin: gs, order: 'YXZ', ry: HP });
      b.cyl(0.04, 0.04, 0.08, 6, { x: 0.45, y: 0.75, rz: HP, color: IR });
      // sacos, barriles y almacén
      sack(b, 0.6, 0.15, 0.55, 1, '#cdb88a'); sack(b, 0.72, 0.15, 0.4, 0.9, '#cdb88a'); sack(b, 0.64, 0.27, 0.48, 0.8, '#cdb88a');
      barrel(b, -0.62, 0.62, 0.09, 0.2, { col: '#7a5a3a', hoop: BR, y: 0.15 });
      const A = grp(b, -0.62, 0.15, -0.45);
      A.box(0.46, 0.4, 0.56, { y: 0.2, color: GR });
      A.add(hipGeo(0.56, 0.66, 0.22, 0.1), { y: 0.4, color: SL });
    },
  },

  // ------------------------------------------------------------------ aserradero (2×2): sierra circular de hierro
  dwarf_lumber: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.14, 1.84, { y: -0.04, color: '#8a7a5c' });
      for (let i = 0; i < 6; i++) b.box(0.05, 0.02, 0.04, { x: -0.1 + i * 0.12, y: 0.04, z: 0.2 + (i % 3) * 0.12, ry: i, color: '#d9b98a' });
      // cobertizo pesado de pizarra
      const S = grp(b, 0.05, 0, -0.5);
      S.frustum(1.6, 0.8, 0.12, 1.56, 0.76, { y: -0.01, color: GR_D });
      S.box(1.5, 0.5, 0.14, { y: 0.36, z: -0.32, color: GR });
      for (const x of [-0.7, 0, 0.7]) S.box(0.1, 0.8, 0.1, { x, y: 0.5, z: 0.32, color: DWD });
      for (const x of [-0.7, 0.7]) S.box(0.12, 0.08, 0.12, { x, y: 0.88, z: 0.32, color: BR });
      S.box(1.68, 0.06, 0.96, { y: 0.98, z: 0.0, rx: 0.2, color: SL });
      S.box(1.7, 0.03, 0.06, { y: 1.02, z: -0.15, color: SL_L });
      S.box(1.7, 0.07, 0.07, { y: 0.88, z: 0.48, color: 'team' }); S.box(1.7, 0.07, 0.07, { y: 1.08, z: -0.46, color: 'team', teamShade: 0.8 });
      for (let i = 0; i < 4; i++) S.box(0.86, 0.05, 0.22, { x: -0.3, y: 0.15 + i * 0.055, z: 0.0 + (i % 2) * 0.03, color: shade('#b08a5a', i * 0.02) });
      // sierra circular giratoria sobre banco
      const sx = 0.42, sy = 0.5, sz = 0.42, sp = { c: [sx, sy, sz], axis: [0, 0, 1], speed: 5 };
      b.box(0.62, 0.28, 0.3, { x: sx, y: 0.14, z: sz, color: DWD_L }); b.box(0.66, 0.04, 0.34, { x: sx, y: 0.3, z: sz, color: IR });
      b.cyl(0.24, 0.24, 0.025, 12, { x: sx, y: sy, z: sz, rx: HP, color: '#b8bec6', spin: sp });
      for (let i = 0; i < 8; i++) { const a = i * PI / 4; b.box(0.05, 0.05, 0.03, { x: sx + Math.sin(a) * 0.25, y: sy + Math.cos(a) * 0.25, z: sz, rz: -a, color: '#d6dce3', spin: sp }); }
      b.cyl(0.06, 0.06, 0.06, 8, { x: sx, y: sy, z: sz, rx: HP, color: BR });
      b.box(0.06, 0.24, 0.06, { x: sx, y: 0.38, z: sz - 0.08, color: IR });
      log(b, sx - 0.05, 0.38, sz + 0.0, 0.4, 0.07, { ry: 0 });
      // pila de troncos y tajo
      for (const [x, y, z] of [[-0.48, 0.1, 0.3], [-0.48, 0.1, 0.48], [-0.48, 0.1, 0.66], [-0.48, 0.25, 0.39], [-0.48, 0.25, 0.57], [-0.48, 0.4, 0.48]]) log(b, x, y, z, 0.7, 0.085);
      for (const s of [-1, 1]) b.box(0.07, 0.4, 0.07, { x: -0.48 + s * 0.32, y: 0.2, z: 0.8, color: IR });
      b.cyl(0.11, 0.12, 0.18, 7, { x: 0.05, y: 0.09, z: 0.78, color: DWD }); b.cyl(0.1, 0.1, 0.02, 7, { x: 0.05, y: 0.18, z: 0.78, color: '#d9b98a' });
      axe(G, 0.08, 0.16, 0.78, -0.5);
      dFlag(b, -0.8, 0.0, -0.8, 1.35, { w: 0.32, fh: 0.2 });
    },
  },

  // ------------------------------------------------------------------ campamento minero (2×2): portal rúnico en la roca
  dwarf_mine: {
    fp: 2,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.14, 1.84, { y: -0.04, color: '#80786a' });
      mount(b, [[0, 0.35, -0.45, 0.5], [-0.5, 0.25, -0.48, 0.42], [0.5, 0.25, -0.5, 0.4], [-0.15, 0.7, -0.52, 0.34], [0.3, 0.65, -0.55, 0.3], [-0.7, 0.1, -0.05, 0.22], [0.7, 0.1, -0.1, 0.22]]);
      for (const [x, y, z] of [[-0.4, 0.52, -0.3], [0.45, 0.48, -0.3], [0.12, 0.88, -0.45]]) b.box(0.07, 0.06, 0.06, { x, y, z, rx: 0.5, ry: x * 4, color: '#e7c13d', glow: 0.3 });
      // portal de granito con dintel rúnico
      b.box(0.44, 0.62, 0.2, { y: 0.34, z: -0.08, color: '#2e2a26' });
      for (const s of [-1, 1]) G.frustum(0.22, 0.3, 0.8, 0.17, 0.26, { x: s * 0.33, y: 0.04, z: 0.02, color: GR_L });
      G.frustum(0.98, 0.36, 0.16, 0.9, 0.32, { y: 0.82, z: 0.02, color: GR });
      G.box(0.92, 0.04, 0.37, { y: 0.84, z: 0.02, color: BR });
      for (const x of [-0.24, 0, 0.24]) gRune(G, x, 0.91, 0.19, 0.55, RN);
      for (const s of [-1, 1]) { G.box(0.05, 0.7, 0.06, { x: s * 0.23, y: 0.4, z: 0.12, color: BR }); banner(b, s * 0.33, 0.78, 0.19, 0.14, 0.3, { emb: 'rune', ec: RN, rod: BR }); }
      // raíles y vagoneta de hierro con oro
      for (const s of [-1, 1]) b.box(0.025, 0.03, 0.95, { x: s * 0.12, y: 0.055, z: 0.48, color: IR });
      for (const z of spread(5, 0.02, 0.95)) b.box(0.34, 0.025, 0.06, { y: 0.04, z, color: DWD });
      const V = grp(b, 0, 0.07, 0.52);
      V.frustum(0.3, 0.38, 0.18, 0.38, 0.46, { y: 0.06, color: IR });
      V.box(0.4, 0.03, 0.48, { y: 0.24, color: BR });
      for (const [x, z] of [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.12], [0.16, 0.12]]) V.cyl(0.055, 0.055, 0.03, 8, { x, y: 0.05, z, rz: HP, color: '#4f5258' });
      for (const [x, z, c] of [[-0.07, -0.08, '#e7c13d'], [0.07, 0.06, '#e7c13d'], [0.03, -0.02, '#8f8b84'], [-0.07, 0.1, '#e7c13d']]) V.ball(0.075, 0, { x, y: 0.27, z, color: c, glow: c === '#8f8b84' ? 0 : 0.25 });
      // torno de extracción con rueda
      const C = grp(b, 0.62, 0, 0.38);
      for (const s of [-1, 1]) C.box(0.06, 0.95, 0.06, { x: s * 0.13, y: 0.47, rz: -s * 0.12, color: DWD });
      C.box(0.34, 0.07, 0.07, { y: 0.9, color: IR });
      C.torus(0.16, 0.03, 10, 4, { y: 0.9, z: 0.04, color: BR, spin: { c: [0, 0.9, 0.04], axis: [0, 0, 1], speed: 1.2 } });
      C.box(0.015, 0.5, 0.015, { y: 0.6, z: 0.18, color: IR });
      C.box(0.2, 0.12, 0.2, { y: 0.06, z: 0.2, color: GR_L });
      // mineral, picos, tolda y farol
      for (const [x, z, c] of [[-0.62, 0.55, '#e7c13d'], [-0.5, 0.62, '#8f8b84'], [-0.56, 0.5, '#9a5a3a']]) b.ball(0.09, 0, { x, y: 0.1, z, sy: 0.7, color: c, glow: c === '#e7c13d' ? 0.25 : 0 });
      const TD = grp(b, -0.58, 0, 0.58);
      for (const [x, z] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]]) TD.box(0.05, 0.48, 0.05, { x, y: 0.24, z, color: DWD });
      TD.wedge(0.62, 0.18, 0.56, { y: 0.48, color: 'team' }); TD.box(0.64, 0.03, 0.04, { y: 0.66, color: BR });
      dLamp(b, 0.38, 0.05, 0.5);
      dFlag(b, 0.48, 0.04, -0.15, 1.15, { w: 0.3, fh: 0.18, ry: PI });
    },
  },

  // ------------------------------------------------------------------ granja (3×3)
  dwarf_farm: { fp: 3, build(b) { farm(b, 'dwarf'); } },

  // ------------------------------------------------------------------ galería de tiro (3×3): puesto de ballesteros
  dwarf_range: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.04, color: '#8a8264' });
      for (const z of [-0.85, 0, 0.85]) b.box(1.9, 0.02, 0.34, { x: 0.25, y: 0.04, z, color: '#9a9070' });
      // puesto de tiro de piedra
      const S = grp(b, -0.9, 0, -0.05);
      S.frustum(0.92, 2.6, 0.12, 0.88, 2.56, { y: -0.01, color: GR_D });
      S.box(0.14, 0.36, 2.4, { x: 0.36, y: 0.29, color: GR });
      S.box(0.16, 0.05, 2.44, { x: 0.36, y: 0.48, color: BR });
      S.box(0.14, 0.7, 2.4, { x: -0.36, y: 0.46, color: GR });
      for (const z of [-1.12, 0, 1.12]) S.box(0.14, 0.82, 0.14, { x: 0.36, y: 0.52, z, color: GR_L });
      dRoof(grp(b, -0.9, 0, -0.05, HP), 2.66, 1.06, 0.4, 0.9);
      for (const z of [-0.7, -0.4, 0.4, 0.7]) { const C = grp(b, -1.18, 0.45, z, HP); C.box(0.05, 0.05, 0.3, { color: DWD_L }); C.box(0.28, 0.025, 0.04, { z: 0.1, color: IR }); }
      for (const [z, y] of [[0.0, 0.12], [0.2, 0.12], [0.1, 0.3]]) barrel(b, -0.95, z, 0.08, 0.17, { col: '#5a4030', hoop: BR, y });
      gRune(S, 0.44, 0.29, 0.6, 0.7, RO); for (const z of [-0.6, 0.6]) dShield(b, -0.9 + 0.44, 0.3, -0.05 + z + 0.0, HP, 0.1);
      // dianas: escudos redondos sobre bloques de piedra
      for (const [z, i] of [[-0.85, 0], [0, 1], [0.85, 2]]) {
        const T = grp(b, 0.98, 0.04, z, -0.85);
        T.frustum(0.32, 0.22, 0.2, 0.28, 0.18, { color: GR });
        T.box(0.05, 0.35, 0.05, { y: 0.35, z: -0.04, color: DWD });
        T.cyl(0.22, 0.22, 0.07, 10, { y: 0.45, rx: HP, color: DWD_L });
        T.cyl(0.16, 0.16, 0.08, 10, { y: 0.45, rx: HP, color: 'team' });
        T.cyl(0.07, 0.07, 0.09, 8, { y: 0.45, rx: HP, color: BR });
        T.box(0.016, 0.016, 0.16, { x: 0.04 - i * 0.03, y: 0.47 + i * 0.02, z: 0.1, color: IR });
      }
      // armadura de prácticas y bandera
      const D = grp(b, 0.3, 0.04, 1.15);
      D.box(0.06, 0.5, 0.06, { y: 0.25, color: DWD }); D.frustum(0.22, 0.15, 0.2, 0.18, 0.12, { y: 0.28, color: IR }); D.ball(0.07, 0, { y: 0.55, color: IR }); D.box(0.2, 0.04, 0.04, { y: 0.48, color: IR });
      dFlag(b, 1.2, 0.04, 1.2, 1.45, { w: 0.4, fh: 0.24, ry: PI });
      dLamp(b, -0.25, 1.15, 0.5, 0.04);
    },
  },

  // ------------------------------------------------------------------ establo (3×3): cuadras de carneros de guerra
  dwarf_stable: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.04, color: '#8a8060' });
      const H = grp(b, 0, 0, -0.88);
      H.frustum(2.66, 1.06, 0.14, 2.6, 1.0, { y: -0.01, color: GR_D });
      dMass(H, 2.48, 0.9, 0.62, 0.13, { k: 0.93, courses: [0.45] });
      dRoof(H, 2.7, 1.12, 0.44, 0.73);
      for (const x of [-0.78, 0, 0.78]) { H.extrude(archPts(0.36, 0.44), 0.03, { x, y: 0.13, z: 0.44, color: '#2e2a26' }); H.box(0.34, 0.2, 0.05, { x, y: 0.23, z: 0.46, color: DWD_L }); H.box(0.36, 0.03, 0.06, { x, y: 0.3, z: 0.465, color: BR }); }
      H.box(0.1, 0.1, 0.16, { x: 0.78, y: 0.44, z: 0.52, color: '#8a7a68' }); H.torus(0.04, 0.015, 6, 3, { x: 0.72, y: 0.47, z: 0.5, ry: HP, color: '#d8c8a0' }); H.torus(0.04, 0.015, 6, 3, { x: 0.84, y: 0.47, z: 0.5, ry: HP, color: '#d8c8a0' });
      for (const s of [-1, 1]) dShield(b, s * 0.4, 0.55, -0.88 + 0.44, 0, 0.09);
      // cercado de piedra
      for (const s of [-1, 1]) { b.box(0.14, 0.24, 1.75, { x: s * 1.33, y: 0.12, z: 0.45, color: GR }); b.box(0.95, 0.24, 0.14, { x: s * 0.86, y: 0.12, z: 1.33, color: GR }); }
      for (const [x, z] of [[-1.33, 1.33], [1.33, 1.33], [-0.38, 1.33], [0.38, 1.33]]) b.box(0.2, 0.32, 0.2, { x, y: 0.16, z, color: GR_L });
      for (const s of [-1, 1]) b.box(0.1, 0.04, 0.1, { x: s * 0.38, y: 0.34, z: 1.33, color: BR });
      // carnero de guerra con manta del equipo
      const E = grp(b, 0.2, 0.04, 0.5, -0.6);
      E.blob(0.12, 0.11, 0.2, 0, { y: 0.3, color: '#cbbfa8' });
      E.box(0.22, 0.07, 0.2, { y: 0.38, color: 'team' }); E.box(0.23, 0.02, 0.21, { y: 0.35, color: BR });
      E.box(0.09, 0.1, 0.14, { y: 0.36, z: 0.22, rx: 0.3, color: '#8a7a68' });
      for (const s of [-1, 1]) E.torus(0.05, 0.02, 7, 3, { x: s * 0.07, y: 0.42, z: 0.18, ry: HP, color: '#d8c8a0' });
      for (const [x, z] of [[-0.06, 0.12], [0.06, 0.12], [-0.06, -0.12], [0.06, -0.12]]) E.box(0.04, 0.2, 0.045, { x, y: 0.1, z, color: '#6a5c4c' });
      // abrevadero, heno, bandera
      b.box(0.5, 0.14, 0.2, { x: -0.8, y: 0.07, z: 0.4, color: GR_L }); b.box(0.44, 0.02, 0.14, { x: -0.8, y: 0.14, z: 0.4, color: '#5f8fb0' });
      for (const [x, z, y] of [[1.0, 0.95, 0.0], [0.78, 1.05, 0.0], [0.9, 1.0, 0.18]]) { b.box(0.24, 0.17, 0.17, { x, y: y + 0.085, z, ry: x, color: STRAW }); b.box(0.245, 0.02, 0.175, { x, y: y + 0.11, z, ry: x, color: BR_D }); }
      dFlag(b, -1.12, 0.04, 0.9, 1.4, { w: 0.4, fh: 0.24 });
      dLamp(b, 0.0, 1.25, 0.5, 0.04);
    },
  },

  // ------------------------------------------------------------------ templo (3×3): zigurat con monolito rúnico
  dwarf_temple: {
    fp: 3, fire: [[0, 1.3, 0.3], [-0.6, 0.9, 0.6], [0.6, 0.9, 0.6]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.04, color: DGND });
      dMass(G, 2.64, 2.4, 0.42, -0.02, { k: 0.94, courses: [0.5] });
      G.frustum(2.53, 2.31, 0.05, 2.52, 2.3, { y: 0.33, color: BR });
      dMass(G, 1.94, 1.74, 0.4, 0.42, { k: 0.93, courses: [0.5], z: -0.1 });
      G.frustum(1.86, 1.67, 0.05, 1.85, 1.66, { y: 0.72, z: -0.1, color: BR });
      dMass(G, 1.22, 1.08, 0.38, 0.82, { k: 0.92, courses: [0.5], z: -0.22 });
      G.box(1.14, 0.06, 1.0, { y: 1.2, z: -0.22, color: GR_L });
      // escalinata frontal
      for (let i = 0; i < 6; i++) G.box(0.5, 0.2, 0.17, { y: 0.1 + i * 0.2 - 0.02, z: 1.14 - i * 0.17, color: shade(GR_L, -i * 0.015) });
      for (const s of [-1, 1]) G.box(0.08, 1.0, 1.0, { x: s * 0.29, y: 0.52, z: 0.72, rx: -0.85, color: GR_D });
      // altar-yunque y monolito rúnico
      G.box(0.36, 0.16, 0.26, { y: 1.31, z: -0.05, color: GR_D }); G.box(0.42, 0.08, 0.2, { y: 1.43, z: -0.05, color: IR }); G.cone(0.05, 0.12, 5, { x: 0.27, y: 1.43, z: -0.05, rz: -HP, color: IR });
      G.frustum(0.52, 0.18, 0.9, 0.42, 0.14, { y: 1.22, z: -0.5, color: GR_D });
      G.add(hipGeo(0.44, 0.16, 0.14, 0.3), { y: 2.12, z: -0.5, color: BR });
      for (const [x, y] of [[0, 1.85], [-0.1, 1.55], [0.1, 1.55]]) gRune(G, x, y, -0.415, 0.8, RO);
      G.box(0.4, 0.04, 0.03, { y: 1.72, z: -0.42, color: RO, glow: 1 });
      // braseros en las esquinas y pilares rúnicos al pie
      for (const s of [-1, 1]) { brazier(b, s * 0.48, 1.22, 0.22, 1.1); brazier(b, s * 0.8, 0.82, 0.62, 1.0); }
      for (const s of [-1, 1]) { G.frustum(0.24, 0.24, 0.62, 0.18, 0.18, { x: s * 0.45, y: 0.0, z: 1.25, color: GR_L }); G.box(0.26, 0.05, 0.26, { x: s * 0.45, y: 0.6, z: 1.25, color: BR }); gRune(G, s * 0.45, 0.32, 1.37, 0.7, RN); }
      // estandartes del equipo en las gradas
      for (const s of [-1, 1]) { banner(b, s * 0.78, 0.78, 0.79, 0.24, 0.26, { emb: 'rune', ec: RN, rod: BR }); dShield(b, s * 0.58, 1.02, 0.72, 0, 0.1); }
      G.box(0.9, 0.04, 0.8, { y: 1.235, z: -0.22, color: 'team', teamShade: 0.85 });
      dFlag(b, -1.22, 0.4, -1.1, 1.3, { w: 0.4, fh: 0.24 });
    },
  },

  // ------------------------------------------------------------------ herrería (2×2): gran forja con dos chimeneas
  dwarf_forge: {
    fp: 2, smoke: [[0.5, 1.95, -0.6], [-0.48, 1.8, -0.62]], fire: [[-0.3, 0.45, 0.3], [0.3, 1.0, -0.4]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(1.84, 0.14, 1.84, { y: -0.04, color: '#6f665a' });
      const M = grp(b, 0, 0, -0.36);
      M.frustum(1.76, 1.0, 0.14, 1.7, 0.94, { y: -0.01, color: GR_D });
      dMass(M, 1.64, 0.88, 0.7, 0.13, { k: 0.93, courses: [0.45] });
      dRoof(M, 1.82, 1.06, 0.4, 0.83);
      dChimney(M, 0.5, -0.24, 0.6, 1.25, 0.28);
      dChimney(M, -0.48, -0.26, 0.6, 1.1, 0.24);
      // horno con boca incandescente
      M.frustum(0.72, 0.36, 0.62, 0.62, 0.3, { x: -0.3, y: 0.13, z: 0.56, color: GR_L });
      M.extrude(archPts(0.34, 0.3), 0.04, { x: -0.3, y: 0.16, z: 0.74, color: FIRE, glow: 1 });
      M.box(0.3, 0.05, 0.1, { x: -0.3, y: 0.18, z: 0.72, color: '#ffc050', glow: 1 });
      gRune(M, -0.3, 0.6, 0.72, 0.7, RO);
      M.box(0.76, 0.06, 0.4, { x: -0.3, y: 0.76, z: 0.56, color: 'team' });
      // canal de lava hacia el molde
      b.box(0.08, 0.03, 0.42, { x: -0.3, y: 0.05, z: 0.6, color: FIRE, glow: 0.9 }); b.box(0.2, 0.06, 0.16, { x: -0.3, y: 0.05, z: 0.86, color: GR_D }); b.box(0.14, 0.02, 0.1, { x: -0.3, y: 0.085, z: 0.86, color: '#ffb040', glow: 0.8 });
      // yunque grande, fuelle, tina y lingotes
      const A = grp(b, 0.3, 0.04, 0.5, -0.25);
      A.frustum(0.22, 0.2, 0.16, 0.18, 0.16, { color: GR_D });
      A.box(0.1, 0.07, 0.08, { y: 0.19, color: IR }); A.box(0.3, 0.08, 0.13, { y: 0.26, color: '#7d858f' }); A.cone(0.05, 0.13, 5, { x: 0.21, y: 0.26, rz: -HP, color: '#7d858f' });
      A.box(0.14, 0.03, 0.04, { y: 0.31, ry: 0.4, color: FIRE, glow: 0.9 });
      A.cyl(0.015, 0.015, 0.22, 5, { x: 0.06, y: 0.34, z: 0.1, rz: HP, color: DWD_L }); A.box(0.06, 0.06, 0.08, { x: -0.06, y: 0.34, z: 0.1, color: IR });
      b.wedge(0.26, 0.12, 0.2, { x: 0.18, y: 0.05, z: 0.22, ry: HP, color: '#5a4030' });
      b.box(0.36, 0.14, 0.2, { x: 0.7, y: 0.07, z: 0.4, color: GR_L }); b.box(0.3, 0.02, 0.14, { x: 0.7, y: 0.14, z: 0.4, color: '#4d6f8a' });
      for (let i = 0; i < 4; i++) b.box(0.1, 0.04, 0.05, { x: 0.62 + (i % 2) * 0.06, y: 0.06 + Math.floor(i / 2) * 0.04, z: 0.8, ry: i * 0.2, color: i % 2 ? '#e7c13d' : '#9aa2ac', glow: i % 2 ? 0.15 : 0 });
      for (let i = 0; i < 3; i++) b.ball(0.06, 0, { x: -0.78 + i * 0.08, y: 0.06, z: 0.82 - i * 0.03, color: '#4a4440' });
      dShield(b, 0.5, 0.45, -0.36 + 0.45, 0, 0.1);
      dFlag(b, 0.82, 0.04, 0.82, 1.15, { w: 0.3, fh: 0.18, ry: PI });
    },
  },

  // ------------------------------------------------------------------ mercado (3×3)
  dwarf_market: {
    fp: 3,
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.04, color: GR_D });
      b.box(2.74, 0.03, 2.74, { y: 0.04, color: '#8f8a80' });
      for (const [x, z] of [[-0.6, 0.3], [0.5, 0.6], [0.1, -0.05], [-0.2, 0.9], [0.9, 0.15]]) b.box(0.36, 0.02, 0.26, { x, y: 0.065, z, ry: x * 0.3, color: GR_L });
      // pilar central con bandera
      G.frustum(0.5, 0.5, 0.2, 0.42, 0.42, { y: 0.04, z: 0.1, color: GR });
      G.box(0.44, 0.04, 0.44, { y: 0.24, z: 0.1, color: BR });
      dFlag(b, 0, 0.26, 0.1, 1.5, { w: 0.44, fh: 0.27, r: 0.03, pole: GR_L });
      gRune(G, 0, 0.13, 0.33, 0.6, RN);
      // puestos de piedra con toldos del equipo
      const goods = [['#5fe3ff', '#ff9a3a', '#b070ff'], ['#e7c13d', '#9aa2ac', '#e7c13d'], ['#e8c860', '#d8a040', '#e8c860'], ['#c0503a', '#8f8b84', '#9a5a3a']];
      [[-0.85, -0.85, 0], [0.85, -0.85, 0], [-1.0, 0.35, HP], [1.0, 0.35, -HP]].forEach(([x, z, a], k) => {
        const S = grp(b, x, 0.04, z, a);
        S.box(0.74, 0.3, 0.3, { y: 0.15, z: 0.05, color: GR });
        S.box(0.78, 0.05, 0.34, { y: 0.32, z: 0.05, color: GR_L });
        for (const s of [-1, 1]) { S.box(0.07, 0.8, 0.07, { x: s * 0.36, y: 0.4, z: -0.2, color: DWD }); S.box(0.07, 0.64, 0.07, { x: s * 0.36, y: 0.32, z: 0.24, color: DWD }); }
        S.box(0.88, 0.04, 0.6, { y: 0.74, z: 0.02, rx: 0.3, color: 'team' });
        S.box(0.9, 0.05, 0.04, { y: 0.66, z: 0.3, color: BR });
        goods[k].forEach((c, i) => { const gx = -0.22 + i * 0.22; if (k === 2) S.cyl(0.07, 0.07, 0.06, 8, { x: gx, y: 0.38, z: 0.05, color: c }); else if (k === 1) S.box(0.12, 0.05, 0.06, { x: gx, y: 0.37, z: 0.05, color: c, glow: c === '#e7c13d' ? 0.15 : 0 }); else S.ball(0.055, 0, { x: gx, y: 0.39, z: 0.05, color: c, glow: k === 0 ? 0.8 : 0 }); });
      });
      // toneles de cerveza tumbados y balanza
      for (const [x, y, z] of [[0.5, 0.15, 1.12], [0.75, 0.15, 1.12], [0.62, 0.34, 1.12]]) { b.cyl(0.11, 0.11, 0.26, 8, { x, y, z, rx: HP, color: '#7a5a3a' }); b.cyl(0.115, 0.115, 0.04, 8, { x, y, z: z + 0.08, rx: HP, color: BR }); }
      b.cyl(0.02, 0.02, 0.06, 5, { x: 0.5, y: 0.15, z: 1.26, rx: HP, color: BR });
      const K = grp(b, -0.6, 0.04, 1.05);
      K.box(0.3, 0.26, 0.2, { y: 0.13, color: DWD_L }); K.box(0.02, 0.3, 0.02, { y: 0.41, color: BR }); K.box(0.3, 0.02, 0.02, { y: 0.55, color: BR });
      for (const s of [-1, 1]) K.cyl(0.06, 0.04, 0.03, 8, { x: s * 0.14, y: 0.42, color: BR });
      crate(b, -1.1, 0.04, 1.15, 0.18, { col: DWD_L }); crate(b, 1.15, 0.04, -0.15, 0.16, { col: DWD_L, ry: 0.3 });
      dLamp(b, 0.0, -1.25, 0.5, 0.04);
    },
  },

  // ------------------------------------------------------------------ torre (2×2, ~2.6): torre maciza con tejado sobre pilares
  dwarf_tower: {
    fp: 2, fire: [[0, 1.8, 0.3], [0.2, 1.0, 0.4]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      G.frustum(1.62, 1.62, 0.22, 1.46, 1.46, { y: -0.04, color: GR_D });
      dMass(G, 1.22, 1.22, 1.52, 0.18, { k: 0.82, courses: [0.25, 0.5, 0.75] });
      for (const [a, y] of [[0, 1.25], [HP, 1.0], [-HP, 1.0], [HP, 0.55], [-HP, 0.55]]) { const r = (1.22 - 0.22 * (y - 0.18) / 1.52) / 2 + 0.005; b.box(0.05, 0.2, 0.03, { x: Math.sin(a) * r, y, z: Math.cos(a) * r, ry: a, color: '#2e2a26' }); }
      gRune(G, 0, 0.92, 0.555, 1.0, RN);
      dDoor(G, 0, 0.6, 0.28, 0.38, { y: 0.18 });
      G.box(0.42, 0.1, 0.16, { y: 0.09, z: 0.72, color: GR_L });
      // plataforma volada con almenas
      for (const a of [0, HP, PI, -HP]) for (const t of [-0.32, 0, 0.32]) b.box(0.1, 0.14, 0.12, { x: Math.sin(a) * 0.5 + Math.cos(a) * t, y: 1.66, z: Math.cos(a) * 0.5 - Math.sin(a) * t, ry: a, color: GR_D });
      b.box(1.34, 0.12, 1.34, { y: 1.78, color: GR_L });
      b.box(1.36, 0.05, 1.36, { y: 1.74, color: BR });
      for (const a of [0, HP, PI, -HP]) { const C = grp(b, 0, 1.84, 0, a); merlonsX(C, -0.55, 0.55, 3, 0, 0.6, 0.18, 0.18, 0.12, GR); }
      // tejado de pizarra sobre pilares de esquina
      for (const [x, z] of [[-0.56, -0.56], [0.56, -0.56], [-0.56, 0.56], [0.56, 0.56]]) { b.box(0.14, 0.46, 0.14, { x, y: 2.07, z, color: GR }); b.box(0.16, 0.05, 0.16, { x, y: 2.3, z, color: BR }); }
      dRoof(G, 1.46, 1.46, 0.5, 2.32, { r: 0, t0: 0.62 });
      b.box(0.3, 0.12, 0.3, { y: 1.96, color: IR }); b.cyl(0.05, 0.06, 0.3, 6, { y: 2.0, z: 0.25, rx: HP - 0.15, color: BR });
      for (const s of [-1, 1]) banner(b, s * 0.28, 1.68, 0.62, 0.17, 0.42, { emb: 'rune', ec: RN, rod: BR });
      dShield(b, 0, 1.38, 0.535, 0, 0.11);
      dFlag(b, -0.62, 1.84, -0.62, 0.62, { w: 0.32, fh: 0.2 });
    },
  },

  // ------------------------------------------------------------------ puerta (1×1)
  dwarf_gate: {
    fp: 1,
    build(b) {
      const G = grp(b, 0, 0, 0);
      for (const s of [-1, 1]) {
        G.frustum(0.268, 0.6, 1.12, 0.23, 0.54, { x: s * 0.365, y: -0.04, color: GR });
        for (const t of [0.35, 0.7]) G.frustum(0.27 - 0.04 * t + 0.02, 0.6 - 0.06 * t + 0.02, 0.04, 0.27 - 0.04 * t + 0.015, 0.6 - 0.06 * t + 0.015, { x: s * 0.365, y: -0.04 + 1.12 * t, color: GR_D });
        b.box(0.26, 0.06, 0.58, { x: s * 0.365, y: 1.1, color: BR });
        b.box(0.16, 0.03, 0.4, { x: s * 0.365, y: 1.145, color: 'team' });
        for (const z of [-0.2, 0.2]) b.box(0.12, 0.14, 0.12, { x: s * 0.4, y: 1.2, z, color: GR_L });
        gRune(G, s * 0.365, 0.82, 0.29, 0.8, RN);
        banner(b, s * 0.365, 0.66, 0.29, 0.15, 0.3, { emb: null, rod: BR });
      }
      // dintel macizo con placa rúnica
      G.frustum(0.5, 0.5, 0.3, 0.46, 0.46, { y: 0.72, color: GR_L });
      b.box(0.52, 0.04, 0.52, { y: 1.02, color: GR_D });
      b.box(0.18, 0.12, 0.03, { y: 0.87, z: 0.245, color: BR }); gRune(G, 0, 0.87, 0.262, 0.6, RO);
      b.box(0.46, 0.02, 0.5, { y: 0.01, color: '#8f8a80' });
      // hojas de bronce con tachones
      const leaf = (L, dir) => {
        L.box(0.23, 0.7, 0.06, { x: dir * 0.115, y: 0.35, color: BR_D });
        for (const y of [0.15, 0.36, 0.57]) L.box(0.22, 0.035, 0.07, { x: dir * 0.115, y, color: IR });
        L.box(0.03, 0.66, 0.068, { x: dir * 0.2, y: 0.34, color: BR });
        L.ball(0.025, 0, { x: dir * 0.17, y: 0.42, z: 0.03, color: BR });
      };
      b.part = 1; leaf(grp(b, -0.23, 0, 0, 0), 1); leaf(grp(b, 0.23, 0, 0, 0), -1);
      b.part = 2; leaf(grp(b, -0.2, 0, 0.03, HP), 1); leaf(grp(b, 0.2, 0, 0.03, -HP), -1);
    },
  },

  // ------------------------------------------------------------------ taller (3×3): cañón a medio hacer y grúa de engranajes
  dwarf_workshop: {
    fp: 3, smoke: [[-1.0, 1.75, -1.0]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      b.box(2.84, 0.14, 2.84, { y: -0.04, color: '#7a7262' });
      const W = grp(b, -0.3, 0, -0.78);
      W.frustum(2.08, 1.06, 0.14, 2.02, 1.0, { y: -0.01, color: GR_D });
      dMass(W, 1.96, 0.9, 0.7, 0.13, { k: 0.93, courses: [0.45] });
      dRoof(W, 2.14, 1.1, 0.44, 0.83);
      W.extrude(archPts(0.7, 0.56), 0.04, { y: 0.13, z: 0.44, color: '#2e2a26' });
      W.extrude(archRing(0.4, 0.35, 6, 0.6), 0.05, { y: 0.39, z: 0.45, color: BR });
      dChimney(W, -0.7, -0.22, 0.6, 1.1, 0.26);
      for (const s of [-1, 1]) banner(b, -0.3 + s * 0.68, 0.8, -0.32, 0.18, 0.36, { emb: 'rune', ec: RN, rod: BR });
      // grúa de hierro con engranaje
      const C = grp(b, 1.02, 0, -0.85);
      C.frustum(0.5, 0.5, 0.22, 0.44, 0.44, { color: GR });
      C.box(0.1, 1.6, 0.1, { y: 1.0, color: IR });
      C.box(0.08, 0.08, 1.0, { y: 1.72, z: 0.35, rx: -0.2, color: IR });
      C.box(0.06, 0.6, 0.06, { y: 1.45, z: 0.18, rx: 0.65, color: IR });
      C.torus(0.18, 0.04, 10, 4, { x: 0.08, y: 0.45, ry: HP, color: BR, spin: { c: [0.08, 0.45, 0], axis: [1, 0, 0], speed: 1 } });
      C.box(0.015, 0.7, 0.015, { y: 1.45, z: 0.82, color: IR });
      C.box(0.5, 0.08, 0.08, { y: 1.08, z: 0.82, color: '#9aa2ac' });
      // cañón a medio hacer
      const K = grp(b, -0.15, 0.04, 0.6, 0.3);
      K.box(0.32, 0.14, 0.7, { y: 0.2, color: DWD_L });
      for (const s of [-1, 1]) { K.cyl(0.16, 0.16, 0.05, 10, { x: s * 0.2, y: 0.16, z: -0.12, rz: HP, color: DWD }); K.cyl(0.05, 0.05, 0.07, 6, { x: s * 0.21, y: 0.16, z: -0.12, rz: HP, color: IR }); }
      K.cyl(0.08, 0.1, 0.7, 8, { y: 0.38, z: 0.1, rx: HP - 0.2, color: BR });
      for (const t of [-0.2, 0.15]) K.cyl(0.11, 0.11, 0.05, 8, { y: 0.38 - t * 0.2, z: 0.1 + t, rx: HP - 0.2, color: BR_D });
      K.box(0.3, 0.04, 0.14, { y: 0.29, z: -0.3, color: 'team' });
      // engranajes y planchas por el suelo
      b.torus(0.15, 0.04, 10, 4, { x: 0.85, y: 0.06, z: 0.75, rx: HP, color: BR }); b.cyl(0.05, 0.05, 0.06, 6, { x: 0.85, y: 0.05, z: 0.75, color: IR });
      b.torus(0.1, 0.03, 8, 4, { x: 1.1, y: 0.05, z: 0.5, rx: HP, color: BR_D });
      for (let i = 0; i < 3; i++) b.box(0.4, 0.03, 0.26, { x: -1.05, y: 0.06 + i * 0.03, z: 0.75, ry: i * 0.15, color: '#8a9098' });
      for (const [x, z] of [[-1.0, 1.15], [-0.85, 1.22], [-0.93, 1.05]]) b.ball(0.08, 0, { x, y: 0.1, z, color: '#4a4440' });
      dFlag(b, 1.22, 0.04, 1.22, 1.35, { w: 0.4, fh: 0.24, ry: PI });
      dLamp(b, 0.45, -0.2, 0.55, 0.04);
    },
  },

  // ------------------------------------------------------------------ castillo (4×4, ~2.8): fortaleza de montaña
  dwarf_castle: {
    fp: 4, smoke: [[-0.5, 2.62, -0.65], [0.55, 2.62, -0.65]], fire: [[0, 2.0, -0.3], [-1.35, 1.4, 1.35], [1.35, 1.4, -1.35], [0.6, 0.9, 1.35]],
    build(b) {
      const G = grp(b, 0, 0, 0);
      G.frustum(3.86, 3.86, 0.24, 3.62, 3.62, { y: -0.08, color: GR_D });
      b.box(2.9, 0.03, 2.9, { y: 0.16, color: '#8f8a80' });
      const y0 = 0.15, R = 1.38, WH = 1.0;
      for (const a of [0, HP, PI, -HP]) {
        const C = grp(b, 0, y0, 0, a);
        const segs = a === 0 ? [[-1.0, -0.4], [0.4, 1.0]] : [[-1.0, 1.0]];
        for (const [x0, x1] of segs) {
          C.frustum(x1 - x0, 0.44, WH, x1 - x0, 0.36, { x: (x0 + x1) / 2, z: R, color: GR });
          C.box(x1 - x0, 0.04, 0.42, { x: (x0 + x1) / 2, y: WH * 0.45, z: R, color: GR_D });
          C.box(x1 - x0, 0.06, 0.4, { x: (x0 + x1) / 2, y: WH + 0.01, z: R, color: GR_L });
          merlonsX(C, x0, x1, Math.round((x1 - x0) / 0.32), WH + 0.04, R + 0.14, 0.14, 0.15, 0.1, GR);
        }
      }
      // torres cuadradas de esquina
      for (const [x, z] of [[-R, R], [R, R], [-R, -R], [R, -R]]) {
        G.frustum(0.84, 0.84, 1.55, 0.7, 0.7, { x, y: y0 - 0.02, z, color: GR });
        G.frustum(0.86, 0.86, 0.05, 0.84, 0.84, { x, y: y0 + 0.7, z, color: GR_D });
        G.box(0.8, 0.07, 0.8, { x, y: y0 + 1.55, z, color: BR });
        for (const [dx, dz] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]]) G.box(0.14, 0.16, 0.14, { x: x + dx, y: y0 + 1.66, z: z + dz, color: GR_L });
        G.add(hipGeo(0.66, 0.66, 0.46, 0), { x, y: y0 + 1.59, z, color: SL }); G.add(hipGeo(0.3, 0.3, 0.21, 0), { x, y: y0 + 1.84, z, color: 'team', teamShade: 0.9 });
        if (z > 0) gRune(G, x, y0 + 0.95, z + 0.37, 0.9, RN);
      }
      // torre del homenaje escalonada
      const K = grp(b, 0, y0, -0.3);
      dMass(K, 1.7, 1.46, 1.1, 0.0, { k: 0.92 });
      K.box(1.6, 0.07, 1.36, { y: 1.12, color: GR_L });
      merlonsX(K, -0.76, 0.76, 6, 1.15, 0.62, 0.14, 0.15, 0.1, GR); merlonsZ(K, -0.5, 0.5, 3, 1.15, -0.76, 0.14, 0.15, 0.1, GR); merlonsZ(K, -0.5, 0.5, 3, 1.15, 0.76, 0.14, 0.15, 0.1, GR);
      dMass(K, 1.12, 0.96, 0.78, 1.14, { k: 0.92, courses: [0.5] });
      dRoof(K, 1.26, 1.1, 0.6, 1.92, { t0: 0.6 });
      for (const s of [-1, 1]) dChimney(K, s * 0.52, -0.35, 1.4, 1.1, 0.22);
      for (const x of [-0.25, 0.25]) dWin(b, x, y0 + 1.5, -0.3 + 0.45, 0.1, 0.14);
      for (const s of [-1, 1]) banner(b, s * 0.48, y0 + 1.0, -0.3 + 0.72, 0.24, 0.55, { emb: 'rune', ec: RN, rod: BR });
      dDoor(K, 0, 0.73, 0.3, 0.42, {});
      dShield(b, 0, y0 + 1.68, -0.3 + 0.47, 0, 0.12);
      // gran puerta frontal
      for (const s of [-1, 1]) { G.frustum(0.46, 0.56, 1.3, 0.38, 0.48, { x: s * 0.44, y: y0 - 0.02, z: R, color: GR_L }); G.box(0.42, 0.06, 0.52, { x: s * 0.44, y: y0 + 1.28, z: R, color: BR }); G.box(0.24, 0.025, 0.3, { x: s * 0.44, y: y0 + 1.32, z: R, color: 'team' }); gRune(G, s * 0.44, y0 + 0.8, R + 0.25, 0.9, RO); }
      G.frustum(0.5, 0.46, 0.32, 0.46, 0.42, { y: y0 + 0.72, z: R, color: GR });
      G.box(0.42, 0.7, 0.06, { y: y0 + 0.35, z: R + 0.05, color: BR_D });
      for (const y of [0.18, 0.4, 0.6]) G.box(0.42, 0.035, 0.07, { y: y0 + y, z: R + 0.055, color: IR });
      G.box(0.03, 0.68, 0.075, { y: y0 + 0.34, z: R + 0.06, color: BR });
      banner(b, 0, y0 + 1.02, R + 0.25, 0.22, 0.26, { emb: null, rod: BR });
      dFlag(b, 0, y0 + 2.5, -0.3, 0.4, { w: 0.46, fh: 0.28 });
      for (const s of [-1, 1]) dFlag(b, s * 0.9, y0 + WH + 0.04, R - 0.1, 0.75, { w: 0.32, fh: 0.2, ry: s > 0 ? PI : 0 });
      mount(b, [[-1.55, 0.25, -0.5, 0.3], [1.6, 0.22, 0.3, 0.26]]);
    },
  },

  // ------------------------------------------------------------------ muro enano
  dwarf_wall_post: {
    fp: 1,
    build(b) {
      const G = grp(b, 0, 0, 0);
      G.frustum(0.66, 0.66, 0.16, 0.62, 0.62, { y: -0.08, color: GR_D });
      G.frustum(0.6, 0.6, 0.96, 0.52, 0.52, { y: 0.06, color: GR });
      G.frustum(0.6, 0.6, 0.04, 0.59, 0.59, { y: 0.4, color: GR_D });
      b.box(0.58, 0.06, 0.58, { y: 1.0, color: BR });
      b.box(0.62, 0.07, 0.62, { y: 1.06, color: GR_L });
      for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) b.box(0.15, 0.16, 0.15, { x, y: 1.17, z, color: GR });
      b.add(hipGeo(0.3, 0.3, 0.16, 0), { y: 1.095, color: 'team' });
      gRune(G, 0, 0.72, 0.275, 0.8, RN);
    },
  },
  dwarf_wall_seg: {
    fp: 1,
    build(b) {
      b.box(0.5, 0.14, 0.5, { x: 0.25, y: 0.0, color: GR_D });
      b.box(0.5, 0.84, 0.44, { x: 0.25, y: 0.42, color: GR });
      for (const s of [-1, 1]) {
        for (const y of [0.3, 0.58]) b.box(0.5, 0.03, 0.012, { x: 0.25, y, z: s * 0.222, color: GR_D });
        for (const [x, y] of [[0.14, 0.44], [0.38, 0.16], [0.38, 0.72]]) b.box(0.025, 0.24, 0.012, { x, y, z: s * 0.222, color: GR_D });
        b.box(0.5, 0.06, 0.1, { x: 0.25, y: 0.86, z: s * 0.18, color: GR_L });
        b.box(0.15, 0.15, 0.1, { x: 0.375, y: 0.965, z: s * 0.18, color: GR });
      }
      b.box(0.5, 0.025, 0.26, { x: 0.25, y: 0.85, color: '#7d7a76' });
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
    for (const s of [-1, 1]) { b.box(0.06, 0.03, 2.6, { x: s * 1.34, y: 0.19, color: 'team' }); b.box(1.0, 0.03, 0.06, { x: s * 0.88, y: 0.19, z: 1.34, color: 'team' }); }
    b.box(2.82, 0.03, 0.06, { y: 0.19, z: -1.34, color: 'team' });
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
    for (const s of [-1, 1]) { b.box(0.15, 0.04, 2.72, { x: s * 1.36, y: 0.19, color: 'team', teamShade: 0.85 }); b.box(1.0, 0.04, 0.15, { x: s * 0.86, y: 0.19, z: 1.36, color: 'team', teamShade: 0.85 }); }
    b.box(2.86, 0.04, 0.15, { y: 0.19, z: -1.36, color: 'team', teamShade: 0.85 });
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

export const MODELS = Object.assign({}, HUMAN, ELF, DWARF);
