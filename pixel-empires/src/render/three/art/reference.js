/* =====================================================================
   Modelos de referencia: fijan el estilo (low-poly facetado, siluetas
   claras, color de equipo bien visible) y muestran cómo usar el kit.
   Los módulos de cada autor pueden redefinir estas claves.
   ===================================================================== */
import { shade } from '../kit.js';

const STEEL = '#aab2bc', STEEL_D = '#7d858f', MAIL = '#8e959e', SKIN = '#e8b48a', LEATHER = '#6b4a2c', BOOT = '#3e2c1e', GOLD = '#d4af37', CLOTH = '#e8e2d0';
const PI = Math.PI;
/** Punto a lo largo de una dirección inclinada rx desde un origen (para armas inclinadas). */
const along = (o, rx, d) => [o[0], o[1] + Math.cos(rx) * d, o[2] + Math.sin(rx) * d];

/** Escudo de cometa (heater) con borde, cara del color de equipo y cruz; mira hacia ry. */
function heaterShield(b, c, ry, s = 1) {
  const pts = [[-0.09, 0.1], [0.09, 0.1], [0.09, 0.0], [0.06, -0.07], [0, -0.115], [-0.06, -0.07], [-0.09, 0.0]].map(([x, y]) => [x * s, y * s]);
  const n = [Math.sin(ry), 0, Math.cos(ry)];
  b.extrude(pts.map(([x, y]) => [x * 1.13, y * 1.1]), 0.014 * s, { x: c[0] - n[0] * 0.012, y: c[1], z: c[2] - n[2] * 0.012, ry, color: STEEL_D });
  b.extrude(pts, 0.02 * s, { x: c[0], y: c[1], z: c[2], ry, color: 'team' });
  b.box(0.026 * s, 0.15 * s, 0.008, { x: c[0] + n[0] * 0.012, y: c[1] - 0.005 * s, z: c[2] + n[2] * 0.012, ry, color: CLOTH });
  b.box(0.11 * s, 0.026 * s, 0.008, { x: c[0] + n[0] * 0.012, y: c[1] + 0.035 * s, z: c[2] + n[2] * 0.012, ry, color: CLOTH });
}

export const MODELS = {
  // ------------------------------------------------------------------ espadachín humano
  human_inf: {
    skeleton: 'humanoid',
    anim: { attack: 'swing', hold: 'sword', height: 0.62 },
    // pivotes por defecto del esqueleto humanoide (proporciones de un humano)
    build(b, P) {
      for (const [p, x] of [[P.legL, -0.05], [P.legR, 0.05]]) {
        b.part = p;
        b.box(0.07, 0.19, 0.08, { x, y: 0.15, color: '#5b4a3a' });
        b.box(0.078, 0.075, 0.105, { x, y: 0.037, z: 0.01, color: BOOT });
      }
      b.part = P.body;
      b.cyl(0.095, 0.118, 0.11, 8, { y: 0.265, color: MAIL });
      b.box(0.19, 0.17, 0.118, { y: 0.365, color: MAIL });
      b.box(0.15, 0.25, 0.13, { y: 0.33, color: 'team' });
      b.box(0.2, 0.03, 0.135, { y: 0.258, color: '#5a3a22' });
      b.box(0.03, 0.026, 0.02, { y: 0.258, z: 0.068, color: GOLD });
      b.cyl(0.058, 0.074, 0.05, 8, { y: 0.455, color: MAIL });
      b.part = P.head;
      b.ball(0.068, 1, { y: 0.527, color: SKIN });
      b.box(0.014, 0.012, 0.01, { x: -0.025, y: 0.535, z: 0.064, color: '#2a1e1a' });
      b.box(0.014, 0.012, 0.01, { x: 0.025, y: 0.535, z: 0.064, color: '#2a1e1a' });
      b.cyl(0.081, 0.083, 0.034, 8, { y: 0.565, color: STEEL_D });
      b.cone(0.08, 0.085, 8, { y: 0.623, color: STEEL });
      b.box(0.016, 0.06, 0.014, { y: 0.54, z: 0.074, color: STEEL });
      for (const [p, x] of [[P.armL, -1], [P.armR, 1]]) {
        b.part = p;
        b.ball(0.046, 0, { x: 0.122 * x, y: 0.43, sy: 0.8, color: STEEL });
        b.box(0.054, 0.19, 0.06, { x: 0.125 * x, y: 0.335, color: MAIL });
        b.box(0.052, 0.052, 0.058, { x: 0.125 * x, y: 0.236, color: LEATHER });
      }
      // espada en la mano derecha, inclinada hacia delante
      b.part = P.handR;
      const h = [0.125, 0.236, 0.02], rx = 0.75;
      b.cyl(0.012, 0.012, 0.07, 6, { x: h[0], y: h[1], z: h[2], rx, color: LEATHER });
      let q = along(h, rx, 0.04); b.box(0.085, 0.016, 0.022, { x: q[0], y: q[1], z: q[2], rx, color: '#c9b26a' });
      q = along(h, rx, 0.17); b.box(0.03, 0.25, 0.01, { x: q[0], y: q[1], z: q[2], rx, color: '#d6dce3' });
      q = along(h, rx, 0.315); b.cone(0.021, 0.045, 4, { x: q[0], y: q[1], z: q[2], rx, ry: PI / 4, sz: 0.4, color: '#d6dce3' });
      q = along(h, rx, -0.045); b.ball(0.016, 0, { x: q[0], y: q[1], z: q[2], color: GOLD });
      // escudo en el brazo izquierdo
      b.part = P.handL;
      heaterShield(b, [-0.165, 0.275, 0.045], -0.55);
    },
  },

  // ------------------------------------------------------------------ caballero (jinete)
  human_cav: {
    skeleton: 'rider',
    anim: { walk: 'gallop', riderAttack: 'thrust', stride: 0.6, size: 1.2 },
    pivots: {
      body: [0, 0.37, 0], head: [0, 0.46, 0.2], tail: [0, 0.43, -0.22], extra: [0, 0.37, 0],
      legFL: [-0.062, 0.3, 0.15], legFR: [0.062, 0.3, 0.15], legBL: [-0.062, 0.3, -0.15], legBR: [0.062, 0.3, -0.15],
      rBody: [0, 0.47, -0.02], rHead: [0, 0.66, -0.02], rArmL: [-0.1, 0.62, -0.02], rArmR: [0.1, 0.62, -0.02], rHandL: [-0.115, 0.46, 0], rHandR: [0.115, 0.46, 0], rCape: [0, 0.64, -0.08],
    },
    build(b, P) {
      const HORSE = '#8a5a36', MANE = '#3a2618';
      b.part = P.body;
      b.blob(0.095, 0.1, 0.235, 1, { y: 0.375, color: HORSE });
      b.blob(0.085, 0.1, 0.08, 1, { y: 0.39, z: 0.17, color: HORSE });
      b.part = P.extra;       // gualdrapa y silla
      b.box(0.205, 0.13, 0.44, { y: 0.31, color: 'team' });
      b.box(0.21, 0.022, 0.445, { y: 0.25, color: '#d8c27a' });
      b.box(0.14, 0.04, 0.13, { y: 0.47, z: -0.02, color: '#5a3a22' });
      b.box(0.15, 0.08, 0.03, { y: 0.47, z: 0.05, color: '#5a3a22' });
      b.part = P.head;        // cuello + cabeza (asienten juntos)
      b.box(0.075, 0.21, 0.1, { y: 0.52, z: 0.25, rx: 0.5, color: HORSE });
      b.box(0.03, 0.2, 0.05, { y: 0.55, z: 0.215, rx: 0.5, color: MANE });
      b.box(0.075, 0.08, 0.18, { y: 0.6, z: 0.34, rx: 0.75, color: HORSE });
      b.box(0.08, 0.05, 0.12, { y: 0.63, z: 0.32, rx: 0.75, color: STEEL });   // testera
      b.cone(0.016, 0.05, 4, { x: -0.025, y: 0.675, z: 0.27, color: HORSE });
      b.cone(0.016, 0.05, 4, { x: 0.025, y: 0.675, z: 0.27, color: HORSE });
      for (const [l, x, z] of [['legFL', -0.062, 0.15], ['legFR', 0.062, 0.15], ['legBL', -0.062, -0.15], ['legBR', 0.062, -0.15]]) {
        b.part = P[l];
        b.box(0.048, 0.2, 0.055, { x, y: 0.2, z, color: HORSE });
        b.box(0.04, 0.1, 0.045, { x, y: 0.07, z, color: HORSE });
        b.box(0.048, 0.035, 0.058, { x, y: 0.018, z: z + 0.005, color: '#2a2018' });
      }
      b.part = P.tail; b.box(0.04, 0.2, 0.045, { y: 0.35, z: -0.27, rx: -0.35, color: MANE });
      // jinete
      b.part = P.rBody;
      for (const x of [-1, 1]) {
        b.box(0.06, 0.06, 0.15, { x: 0.095 * x, y: 0.47, z: 0.02, color: MAIL });
        b.box(0.055, 0.15, 0.06, { x: 0.112 * x, y: 0.38, z: 0.08, color: STEEL });
        b.box(0.06, 0.04, 0.085, { x: 0.112 * x, y: 0.3, z: 0.09, color: BOOT });
      }
      b.box(0.18, 0.17, 0.11, { y: 0.565, z: -0.02, color: MAIL });
      b.box(0.14, 0.2, 0.122, { y: 0.55, z: -0.02, color: 'team' });
      b.box(0.185, 0.026, 0.125, { y: 0.48, z: -0.02, color: '#5a3a22' });
      b.part = P.rHead;
      b.cyl(0.068, 0.07, 0.11, 8, { y: 0.715, z: -0.02, color: STEEL });
      b.cone(0.068, 0.04, 8, { y: 0.79, z: -0.02, color: STEEL });
      b.box(0.1, 0.012, 0.01, { y: 0.725, z: 0.05, color: '#1e1a1e' });
      b.box(0.022, 0.09, 0.13, { y: 0.83, z: -0.04, color: 'team', flag: 0.4 });
      for (const [p, x] of [[P.rArmL, -1], [P.rArmR, 1]]) {
        b.part = p;
        b.ball(0.044, 0, { x: 0.115 * x, y: 0.62, z: -0.02, sy: 0.8, color: STEEL });
        b.box(0.05, 0.17, 0.055, { x: 0.115 * x, y: 0.535, z: -0.02, color: MAIL });
        b.box(0.05, 0.05, 0.055, { x: 0.115 * x, y: 0.45, z: -0.02, color: LEATHER });
      }
      // lanza en ristre y escudo
      b.part = P.rHandR;
      const h = [0.12, 0.45, 0.0], rx = 1.32;
      let q = along(h, rx, 0.22); b.cyl(0.012, 0.016, 0.78, 6, { x: q[0], y: q[1], z: q[2], rx, color: '#8a6440' });
      q = along(h, rx, 0.06); b.cone(0.04, 0.08, 7, { x: q[0], y: q[1], z: q[2], rx, color: STEEL });
      q = along(h, rx, 0.64); b.cone(0.016, 0.07, 5, { x: q[0], y: q[1], z: q[2], rx, color: STEEL });
      q = along(h, rx, 0.5); b.box(0.004, 0.05, 0.09, { x: q[0], y: q[1] + 0.035, z: q[2] - 0.03, color: 'team', flag: (x, y, z) => Math.max(0, q[2] - z) * 6 });
      b.part = P.rHandL;
      heaterShield(b, [-0.16, 0.52, 0.03], -0.7, 0.9);
    },
  },

  // ------------------------------------------------------------------ oveja
  animal_sheep: {
    skeleton: 'quadruped',
    anim: { walk: 'trot', stride: 0.5, attack: 'none' },
    pivots: { body: [0, 0.17, 0], head: [0, 0.22, 0.11], tail: [0, 0.22, -0.13], legFL: [-0.05, 0.12, 0.08], legFR: [0.05, 0.12, 0.08], legBL: [-0.05, 0.12, -0.08], legBR: [0.05, 0.12, -0.08] },
    build(b, P) {
      const W = '#efeae0';
      b.part = P.body;
      b.blob(0.11, 0.095, 0.14, 1, { y: 0.2, color: W });
      for (const [x, y, z, r] of [[-0.055, 0.26, 0.05, 0.06], [0.05, 0.265, -0.03, 0.065], [0, 0.28, 0.0, 0.06], [-0.04, 0.25, -0.08, 0.055], [0.06, 0.24, 0.07, 0.05]]) b.ball(r, 0, { x, y, z, color: shade(W, (x + z) * 0.25) });
      b.part = P.head;
      b.box(0.058, 0.066, 0.085, { y: 0.235, z: 0.175, rx: 0.3, color: '#3b3330' });
      b.ball(0.042, 0, { y: 0.275, z: 0.15, color: W });
      b.box(0.04, 0.016, 0.022, { x: -0.045, y: 0.255, z: 0.15, rz: 0.4, color: '#3b3330' });
      b.box(0.04, 0.016, 0.022, { x: 0.045, y: 0.255, z: 0.15, rz: -0.4, color: '#3b3330' });
      b.box(0.01, 0.01, 0.006, { x: -0.022, y: 0.25, z: 0.215, color: '#111' });
      b.box(0.01, 0.01, 0.006, { x: 0.022, y: 0.25, z: 0.215, color: '#111' });
      for (const [l, x, z] of [['legFL', -0.05, 0.08], ['legFR', 0.05, 0.08], ['legBL', -0.05, -0.08], ['legBR', 0.05, -0.08]]) { b.part = P[l]; b.box(0.026, 0.13, 0.026, { x, y: 0.065, z, color: '#3b3330' }); }
      b.part = P.tail; b.ball(0.03, 0, { y: 0.21, z: -0.15, color: W });
    },
  },

  // ------------------------------------------------------------------ casa humana (2×2)
  human_house: {
    fp: 2, smoke: [[0.42, 1.36, -0.28]],
    build(b) {
      const STONE = '#b9b2a6', PLASTER = '#efe6cf', BEAM = '#5a3b26', TILE = '#b5523b';
      // zócalo de piedra con bloques
      b.box(1.5, 0.3, 1.3, { y: 0.15, color: STONE });
      for (let i = 0; i < 7; i++) b.box(0.2, 0.09, 0.02, { x: -0.62 + i * 0.205 + (i % 2) * 0.03, y: 0.08 + (i % 2) * 0.12, z: 0.655, color: shade(STONE, -0.06) });
      // planta alta con entramado
      b.box(1.42, 0.42, 1.22, { y: 0.51, color: PLASTER });
      for (const x of [-0.7, -0.24, 0.24, 0.7]) b.box(0.05, 0.43, 0.05, { x, y: 0.51, z: 0.6, color: BEAM });
      for (const z of [-0.6, 0, 0.6]) for (const x of [-0.71, 0.71]) b.box(0.05, 0.43, 0.05, { x, y: 0.51, z, color: BEAM });
      b.box(1.46, 0.05, 1.26, { y: 0.3, color: BEAM }); b.box(1.46, 0.05, 1.26, { y: 0.72, color: BEAM });
      b.box(0.05, 0.5, 0.03, { x: -0.47, y: 0.51, z: 0.61, rz: 0.72, color: BEAM });
      b.box(0.05, 0.5, 0.03, { x: 0.47, y: 0.51, z: 0.61, rz: -0.72, color: BEAM });
      // tejado a dos aguas con hiladas de tejas y cumbrera del color de equipo
      b.wedge(1.72, 0.6, 1.5, { y: 0.74, color: TILE });
      for (let i = 1; i < 4; i++) { const t = i / 4, y = 0.74 + 0.6 * t, d = 0.75 * (1 - t); for (const s of [-1, 1]) b.box(1.74, 0.025, 0.05, { y: y - 0.005, z: s * d, rx: s * 0.67, color: shade(TILE, -0.08) }); }
      b.box(1.76, 0.06, 0.08, { y: 1.34, color: 'team' });
      b.box(0.06, 0.08, 1.52, { x: -0.86, y: 0.75, color: 'team', teamShade: 0.75 });
      b.box(0.06, 0.08, 1.52, { x: 0.86, y: 0.75, color: 'team', teamShade: 0.75 });
      // chimenea
      b.box(0.2, 0.55, 0.2, { x: 0.42, y: 1.1, z: -0.28, color: STONE });
      b.box(0.24, 0.05, 0.24, { x: 0.42, y: 1.36, z: -0.28, color: shade(STONE, -0.1) });
      // puerta, toldo y ventanas
      b.box(0.26, 0.4, 0.04, { x: -0.25, y: 0.2, z: 0.66, color: '#6a4528' });
      b.box(0.3, 0.04, 0.05, { x: -0.25, y: 0.42, z: 0.665, color: BEAM });
      b.box(0.36, 0.03, 0.16, { x: -0.25, y: 0.47, z: 0.73, rx: 0.35, color: 'team' });
      for (const x of [0.15, 0.45]) { b.box(0.16, 0.16, 0.03, { x, y: 0.52, z: 0.62, color: '#3d4f66' }); b.box(0.04, 0.17, 0.035, { x: x - 0.1, y: 0.52, z: 0.625, color: 'team', teamShade: 0.85 }); b.box(0.04, 0.17, 0.035, { x: x + 0.1, y: 0.52, z: 0.625, color: 'team', teamShade: 0.85 }); }
      b.box(0.16, 0.16, 0.03, { x: -0.25, y: 0.52, z: 0.62, color: '#3d4f66' });
      // barril y leña
      b.cyl(0.08, 0.08, 0.16, 8, { x: 0.62, y: 0.08, z: 0.74, color: '#8a6440' });
      for (let i = 0; i < 3; i++) b.cyl(0.03, 0.03, 0.3, 6, { x: -0.72, y: 0.035 + i * 0.05, z: 0.2 - i * 0.03, rx: PI / 2, color: '#9a7046' });
    },
  },

  // ------------------------------------------------------------------ roble (3 variantes; pieza 1 = nieve)
  tree_oak: {
    variants: 3, tints: ['#4e9a3c', '#58a343', '#468f3a', '#63a848', '#4f9440'], snow: true,
    build(b, { v }) {
      const BARK = '#6b4a2c', r = (k) => ((Math.sin((v + 1) * 91.7 + k * 13.3) * 43758.5) % 1 + 1) % 1;
      const sway = (x, y) => Math.max(0, y - 0.25) * 0.9;
      b.cyl(0.055, 0.1, 0.62, 6, { y: 0.31, color: BARK, wave: sway });
      b.cyl(0.11, 0.13, 0.06, 6, { y: 0.03, color: shade(BARK, -0.05) });
      b.cyl(0.025, 0.04, 0.3, 5, { x: 0.1, y: 0.62, z: 0.02, rz: -0.7, color: BARK, wave: sway });
      b.cyl(0.025, 0.04, 0.28, 5, { x: -0.08, y: 0.66, z: -0.04, rz: 0.6, rx: 0.3, color: BARK, wave: sway });
      const blobs = [[0, 1.08, 0, 0.36], [0.24, 0.92, 0.05, 0.27], [-0.23, 0.95, -0.06, 0.28], [0.04, 0.9, 0.24, 0.26], [-0.04, 0.93, -0.24, 0.25]];
      blobs.forEach(([x, y, z, s], i) => {
        const j = 0.85 + r(i) * 0.3;
        b.ball(s * j, 1, { x: x * j, y: y - (1 - j) * 0.2, z: z * j, sy: 0.85, ry: r(i + 5) * 3, color: 'tint', teamShade: 0.9 + (y - 0.9) * 0.9 + r(i + 9) * 0.1, wave: sway });
      });
      b.part = 1;   // nieve en lo alto de las copas
      blobs.forEach(([x, y, z, s], i) => { const j = 0.85 + r(i) * 0.3; b.blob(s * j * 0.8, s * j * 0.3, s * j * 0.8, 1, { x: x * j, y: y - (1 - j) * 0.2 + s * j * 0.58, z: z * j, color: '#f2f6fa', wave: sway }); });
    },
  },
};
