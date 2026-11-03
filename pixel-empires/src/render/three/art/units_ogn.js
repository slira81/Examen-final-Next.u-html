/* =====================================================================
   Arte 3D procedural — unidades orcas, gigantes, neutrales y fauna
   (ver docs/ART3D.md). Cada entrada: clave -> definición de modelo.
   Convenciones: modelos en pose de descanso mirando a +Z, pies en y=0;
   los pivotes de cada pieza coinciden con la articulación real.
   ===================================================================== */
import { shade } from '../kit.js';

const PI = Math.PI;
const Z0 = [0, 0, 0];
const ease = x => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
/** Interpolación por tramos (como rig.track). */
function track(k, keys) {
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (k <= keys[i][0]) { const [k0, v0] = keys[i - 1], [k1, v1] = keys[i]; return v0 + (v1 - v0) * ease((k - k0) / (k1 - k0)); }
  return keys[keys.length - 1][1];
}

// ------------------------------------------------------------------ geometría auxiliar
/** Centro y giro (orden XZY: el eje Y local apunta de a hacia c; ry gira sobre ese eje). */
function axis(a, c) {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-6;
  return { L, x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, z: (a[2] + c[2]) / 2, rx: Math.atan2(dz, dy), rz: -Math.asin(Math.max(-1, Math.min(1, dx / L))), order: 'XZY' };
}
/** Cilindro de a (radio ra) a c (radio rc). */
const seg = (b, a, c, ra, rc, sides, o = {}) => { const t = axis(a, c); return b.cyl(rc, ra, t.L, sides, Object.assign({}, o, t)); };
/** Caja alargada de a a c (ancho w en X local, fondo d). */
const bar = (b, a, c, w, d, o = {}) => { const t = axis(a, c); return b.box(w, t.L, d, Object.assign({}, o, t)); };
/** Cono con la base en a y la punta en c. */
const spike = (b, a, c, r, sides, o = {}) => { const t = axis(a, c); return b.cone(r, t.L, sides, Object.assign({}, o, t)); };
/** Punto a distancia d a lo largo de una dirección inclinada rx (plano YZ) y desplazado e en perpendicular. */
const along = (p, rx, d, e = 0) => [p[0], p[1] + Math.cos(rx) * d - Math.sin(rx) * e, p[2] + Math.sin(rx) * d + Math.cos(rx) * e];
const at = (p, o) => Object.assign({ x: p[0], y: p[1], z: p[2] }, o);
/** Posición con desplazamiento (para reutilizar piezas en jinetes). */
const ofs = d => (x, y, z, o) => Object.assign({ x: x + d[0], y: y + d[1], z: z + d[2] }, o);
const add3 = (p, d) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
/** Escudo redondo mirando hacia la dirección horizontal ry (0 = +Z). */
function roundShield(b, c, ry, r, face, rim, boss) {
  const n = [Math.sin(ry), 0, Math.cos(ry)];
  b.cyl(r, r, 0.022, 8, { x: c[0], y: c[1], z: c[2], rx: PI / 2, ry, order: 'YXZ', color: face });
  b.torus(r, 0.013, 8, 4, { x: c[0], y: c[1], z: c[2], ry, order: 'YXZ', color: rim });
  b.ball(r * 0.28, 0, { x: c[0] + n[0] * 0.016, y: c[1], z: c[2] + n[2] * 0.016, color: boss });
}

// ------------------------------------------------------------------ poses propias
/** Durante el ataque fija el ángulo absoluto (rx) del arma de la mano según keys [[k, ángulo], ...]. */
function holdKeys(keys, chain = ['body', 'armR', 'handR']) {
  const w0 = keys[0][1];
  return (pose, st) => {
    if (st.anim !== 'attack' || st.dead >= 0) return;
    let cur = 0; for (const n of chain) { const i = pose.sk.P[n]; if (i !== undefined) cur += pose.v[i * 7]; }
    pose.r(chain[chain.length - 1], track(st.k, keys) - w0 - cur, 0, 0);
  };
}
const both = (...fs) => (p, s) => { for (const f of fs) if (f) f(p, s); };
// Ángulos absolutos del arma: estocada (lanza vertical que baja y empuja), conjuro (bastón), golpe a dos manos.
const THRUST = [[0, 0], [0.3, 1.3], [0.48, 1.52], [0.64, 1.45], [1, 0]];
const CAST = [[0, 0], [0.35, -0.12], [0.5, 0.5], [0.75, 0.3], [1, 0]];
const smashKeys = w0 => [[0, w0], [0.38, -0.35], [0.52, 1.95], [0.7, 1.85], [1, w0]];
/** Herramientas de aldeano: corrige el ángulo durante el trabajo y mantiene la cesta derecha. */
function workerPose(extra = {}) {
  return (pose, st) => {
    if (st.dead >= 0) return;
    const v = pose.v, P = pose.sk.P, rx = n => v[P[n] * 7];
    if (st.anim === 'work') {
      if (st.work === 'gather') pose.r('handL', -(rx('body') + rx('armL')) * 0.9, 0, 0);
      else pose.r('handR', extra[st.work] ?? 0.35, 0, 0);
    }
  };
}

// ================================================================== ORCOS
const OSK = '#6f9a4a', HIDE = '#a07850', HIDE_D = '#7a5a3a', BONE = '#e8dcc0', RUST = '#7a5040', IRON = '#6d737c', IRON_L = '#a3a9b0',
  ORED = '#9c2f24', OHAIR = '#3a2c20', OWOOD = '#7a5a3a', LEATH = '#5e4430', WRAP = '#8a7458', FUR = '#6a5442', GOLD = '#d4af37';
const ORC_H = [0.162, 0.215, 0.025];
const ORC_PIV = {
  body: [0, 0.26, 0], head: [0, 0.47, 0.035], armL: [-0.138, 0.462, 0], armR: [0.138, 0.462, 0],
  handL: [-ORC_H[0], ORC_H[1], ORC_H[2]], handR: ORC_H, legL: [-0.068, 0.24, 0], legR: [0.068, 0.24, 0],
  cape: [0, 0.47, -0.08], back: [0, 0.43, -0.1],
};
function orcLegs(b, P, o = {}) {
  for (const s of [-1, 1]) {
    b.part = s < 0 ? P.legL : P.legR; const x = 0.068 * s;
    b.box(0.088, 0.13, 0.096, { x, y: 0.19, color: o.pants || HIDE_D });
    b.box(0.08, 0.095, 0.088, { x: x + 0.004 * s, y: 0.09, z: 0.004, color: o.wrap || WRAP });
    b.box(0.094, 0.045, 0.13, { x: x + 0.005 * s, y: 0.022, z: 0.022, color: o.foot || shade(OSK, -0.08) });
  }
}
/** Tronco encorvado: cinturón, vientre, pecho, joroba, cuello y taparrabos. */
function orcTrunk(b, part, o = {}, d = Z0) {
  const q = ofs(d), skin = o.skin || OSK;
  b.part = part;
  b.cyl(0.11, 0.114, 0.055, 8, q(0, 0.268, 0, { color: o.belt || LEATH }));
  b.blob(0.118, 0.1, 0.096, 1, q(0, 0.345, 0.022, { color: o.belly || skin }));
  b.blob(0.132, 0.1, 0.102, 1, q(0, 0.425, 0, { rx: 0.25, color: o.chest || skin, teamShade: 1.05 }));
  b.blob(0.1, 0.068, 0.072, 1, q(0, 0.46, -0.045, { color: o.hump || o.chest || skin, teamShade: 0.85 }));
  b.cyl(0.044, 0.054, 0.05, 6, q(0, 0.478, 0.03, { color: skin }));
  if (o.flaps !== false) {
    b.box(0.12, 0.12, 0.022, q(0, 0.2, 0.098, { rx: -0.1, color: o.flap || 'team' }));
    if (!d[1]) b.box(0.13, 0.11, 0.022, q(0, 0.205, -0.09, { rx: 0.1, color: o.flap || 'team', teamShade: 0.8 }));
  }
}
function orcHead(b, part, o = {}, d = Z0) {
  const q = ofs(d), skin = o.skin || OSK, skinD = shade(skin, -0.07);
  b.part = part;
  b.blob(0.072, 0.066, 0.074, 1, q(0, 0.548, 0.072, { color: skin }));
  b.box(0.112, 0.042, 0.07, q(0, 0.506, 0.098, { color: skinD }));
  b.box(0.122, 0.024, 0.034, q(0, 0.572, 0.122, { rx: -0.2, color: skinD }));
  for (const s of [-1, 1]) {
    b.box(0.018, 0.012, 0.008, q(0.03 * s, 0.553, 0.142, { color: o.eye || '#ffcf3a', glow: o.eyeGlow ?? 0.35 }));
    b.cone(0.012, 0.042, 5, q(0.036 * s, 0.538, 0.128, { rz: -0.2 * s, color: BONE }));
    if (o.ears !== false) b.cone(0.022, 0.075, 4, q(0.088 * s, 0.556, 0.058, { rz: -1.25 * s, ry: 0.4 * s, color: skin }));
  }
  if (o.hair === 'knot') { b.cyl(0.018, 0.03, 0.05, 5, q(0, 0.622, 0.035, { rx: -0.3, color: OHAIR })); b.ball(0.026, 0, q(0, 0.652, 0.025, { color: OHAIR })); }
  else if (o.hair === 'mohawk') for (let i = 0; i < 3; i++) b.cone(0.016, 0.06, 4, q(0, 0.615 - i * 0.008, 0.1 - i * 0.042, { rx: -0.35 - i * 0.25, color: o.hairColor || OHAIR }));
}
function orcArms(b, P, o = {}, d = Z0, names = ['armL', 'armR']) {
  const q = ofs(d), skin = o.skin || OSK;
  for (const s of [-1, 1]) {
    b.part = P[s < 0 ? names[0] : names[1]];
    b.ball(0.056, 0, q(0.142 * s, 0.452, 0, { color: o.shoulder || skin }));
    b.box(0.07, 0.13, 0.076, q(0.152 * s, 0.38, 0.005, { rz: 0.06 * s, color: o.upper || skin }));
    b.cyl(0.037, 0.032, 0.105, 6, q(0.159 * s, 0.27, 0.015, { color: o.fore || WRAP }));
    b.ball(0.042, 0, q(ORC_H[0] * s, ORC_H[1], ORC_H[2], { color: skin }));
  }
}
/** Hombreras con pinchos de hueso. */
function orcPads(b, P, color, spikes = 2, d = Z0, names = ['armL', 'armR'], rim = RUST) {
  const q = ofs(d);
  for (const s of [-1, 1]) {
    b.part = P[s < 0 ? names[0] : names[1]];
    b.blob(0.084, 0.05, 0.09, 1, q(0.152 * s, 0.49, 0, { rz: -0.28 * s, color }));
    b.blob(0.09, 0.026, 0.096, 0, q(0.158 * s, 0.468, 0, { rz: -0.28 * s, color: rim }));
    for (let i = 0; i < spikes; i++) {
      const z = spikes === 1 ? 0 : (i - (spikes - 1) / 2) * 0.06;
      spike(b, add3([0.165 * s, 0.515, z], d), add3([0.205 * s, 0.6, z * 1.15], d), 0.016, 4, { color: BONE });
    }
  }
}
/** Hacha arrojadiza (mango + hoja), en la mano o a la espalda. */
function throwAxe(b, h, rx, len = 0.17) {
  seg(b, along(h, rx, -0.04), along(h, rx, len), 0.011, 0.01, 5, { color: OWOOD });
  b.box(0.014, 0.07, 0.065, at(along(h, rx, len - 0.03, 0.035), { rx, color: IRON_L }));
}

const ORCS = {
  // -------------------------------------------------------------- peón orco
  orc_worker: {
    skeleton: 'humanoid', pivots: ORC_PIV,
    anim: { attack: 'swing', hold: 'sword', height: 0.65, stride: 0.55 },
    pose: workerPose({ chop: 0.55, mine: 0.75, build: 0.3, farm: 0.6 }),
    build(b, P) {
      orcLegs(b, P, { pants: HIDE_D });
      orcTrunk(b, P.body, { chest: 'team', belly: 'team', hump: 'team', flap: HIDE });
      orcHead(b, P.head, { hair: 'knot' });
      orcArms(b, P, { fore: WRAP });
      b.part = P.body;
      b.box(0.2, 0.026, 0.06, { y: 0.47, z: 0.0, rx: 0.25, color: 'team', teamShade: 0.7 });          // pañuelo al cuello
      // armazón de carga a la espalda
      b.part = P.back;
      for (const s of [-1, 1]) seg(b, [0.065 * s, 0.25, -0.1], [0.055 * s, 0.58, -0.145], 0.012, 0.01, 5, { color: OWOOD });
      b.box(0.16, 0.022, 0.024, { y: 0.31, z: -0.11, color: OWOOD });
      // herramientas (mano derecha) inclinadas hacia delante
      const h = ORC_H, rx = 1.0;
      b.part = P.toolAxe;
      seg(b, along(h, rx, -0.06), along(h, rx, 0.25), 0.012, 0.011, 5, { color: OWOOD });
      b.box(0.016, 0.08, 0.07, at(along(h, rx, 0.21, 0.04), { rx, color: IRON_L }));
      b.part = P.toolPick;
      seg(b, along(h, rx, -0.06), along(h, rx, 0.25), 0.012, 0.011, 5, { color: OWOOD });
      spike(b, along(h, rx, 0.23), along(h, rx, 0.2, 0.11), 0.017, 4, { color: IRON });
      spike(b, along(h, rx, 0.23), along(h, rx, 0.21, -0.08), 0.015, 4, { color: IRON });
      b.part = P.toolHammer;
      seg(b, along(h, rx, -0.05), along(h, rx, 0.2), 0.012, 0.011, 5, { color: OWOOD });
      bar(b, along(h, rx, 0.2, -0.045), along(h, rx, 0.2, 0.055), 0.055, 0.055, { color: '#8a8f96' });
      b.part = P.toolHoe;
      seg(b, along(h, rx, -0.08), along(h, rx, 0.33), 0.011, 0.01, 5, { color: OWOOD });
      b.box(0.075, 0.014, 0.07, at(along(h, rx, 0.32, 0.035), { rx, color: IRON }));
      b.part = P.toolBasket;
      const c = [-0.19, 0.12, 0.05];
      b.cyl(0.062, 0.046, 0.075, 7, at(c, { color: '#b89a5a' }));
      b.torus(0.062, 0.009, 8, 4, { x: c[0], y: c[1] + 0.037, z: c[2], rx: PI / 2, color: '#8a6a3a' });
      b.ball(0.035, 0, { x: c[0], y: c[1] + 0.04, z: c[2], color: '#b8473a' });
      // cargas a la espalda (sobre el armazón)
      b.part = P.carryWood;
      for (let i = 0; i < 3; i++) b.cyl(0.028, 0.028, 0.24, 6, { x: (i - 1) * 0.012, y: 0.36 + i * 0.05, z: -0.17 - (i % 2) * 0.012, rz: PI / 2, color: shade('#9a7046', (i - 1) * 0.05) });
      b.box(0.022, 0.16, 0.08, { y: 0.41, z: -0.165, color: LEATH });
      b.part = P.carryFood;
      b.blob(0.085, 0.09, 0.07, 1, { y: 0.4, z: -0.175, color: '#c0a070' });
      b.blob(0.05, 0.035, 0.035, 0, { x: 0.03, y: 0.5, z: -0.17, rz: 0.5, color: '#b0503a' });
      b.cyl(0.01, 0.01, 0.06, 5, { x: -0.025, y: 0.525, z: -0.17, rz: 0.5, color: BONE });
      b.part = P.carryGold;
      b.blob(0.08, 0.085, 0.065, 1, { y: 0.4, z: -0.175, color: '#a08a5e' });
      b.ball(0.035, 0, { x: -0.02, y: 0.49, z: -0.17, color: '#e7c13d', glow: 0.35 });
      b.ball(0.028, 0, { x: 0.035, y: 0.475, z: -0.16, color: '#f0d050', glow: 0.35 });
      b.part = P.carryStone;
      b.box(0.15, 0.08, 0.09, { y: 0.37, z: -0.175, ry: 0.1, color: '#a6a39e' });
      b.box(0.11, 0.07, 0.08, { y: 0.45, z: -0.17, ry: -0.2, color: '#8f8c88' });
      b.box(0.02, 0.17, 0.1, { y: 0.4, z: -0.17, color: LEATH });
      b.part = P.carryIron;
      b.blob(0.08, 0.08, 0.065, 1, { y: 0.39, z: -0.175, color: '#8a7458' });
      b.ball(0.04, 0, { x: -0.025, y: 0.475, z: -0.17, color: '#7b5d50' });
      b.ball(0.033, 0, { x: 0.035, y: 0.465, z: -0.16, color: '#6a5048' });
    },
  },

  // -------------------------------------------------------------- bruto
  orc_inf: {
    skeleton: 'humanoid', pivots: ORC_PIV,
    anim: { attack: 'swing', hold: 'sword', height: 0.66, stride: 0.5 },
    build(b, P) {
      orcLegs(b, P, { pants: HIDE_D, wrap: LEATH });
      orcTrunk(b, P.body, { flap: 'team' });
      orcHead(b, P.head, { eye: '#ff6a2a' });
      orcArms(b, P, { fore: LEATH });
      orcPads(b, P, 'team', 2);
      b.part = P.body;
      // banda cruzada de equipo y calavera en el cinturón
      bar(b, [-0.125, 0.47, 0.03], [0.0, 0.4, 0.125], 0.055, 0.02, { color: 'team', teamShade: 0.85 });
      bar(b, [0.0, 0.4, 0.125], [0.11, 0.285, 0.1], 0.055, 0.02, { color: 'team', teamShade: 0.85 });
      b.ball(0.032, 0, { y: 0.268, z: 0.12, color: BONE });
      for (const s of [-1, 1]) b.box(0.01, 0.01, 0.006, { x: 0.012 * s, y: 0.272, z: 0.15, color: '#1a1410' });
      // casquete de hierro con cresta
      b.part = P.head;
      b.blob(0.08, 0.046, 0.082, 1, { y: 0.592, z: 0.066, color: IRON });
      b.box(0.018, 0.05, 0.016, { y: 0.56, z: 0.15, color: IRON });
      spike(b, [0, 0.625, 0.05], [0, 0.69, 0.02], 0.022, 5, { color: RUST });
      // brazal con pinchos (izquierda)
      b.part = P.armL;
      for (const z of [-0.02, 0.03]) spike(b, [-0.19, 0.28, z], [-0.235, 0.29, z], 0.012, 4, { color: BONE });
      // gran cuchilla en la mano derecha
      b.part = P.handR;
      const h = ORC_H, rx = 0.85;
      seg(b, along(h, rx, -0.05), along(h, rx, 0.1), 0.015, 0.013, 6, { color: LEATH });
      b.box(0.018, 0.22, 0.105, at(along(h, rx, 0.21, 0.03), { rx, color: '#8a8f96' }));
      b.box(0.026, 0.225, 0.024, at(along(h, rx, 0.21, -0.02), { rx, color: RUST }));
      b.box(0.012, 0.21, 0.02, at(along(h, rx, 0.21, 0.085), { rx, color: IRON_L }));
      b.ball(0.022, 0, at(along(h, rx, -0.06), { color: BONE }));
    },
  },

  // -------------------------------------------------------------- lancero salvaje
  orc_pike: {
    skeleton: 'humanoid', pivots: ORC_PIV,
    anim: { attack: 'thrust', hold: 'spear', height: 0.66, stride: 0.6 },
    pose: holdKeys(THRUST),
    build(b, P) {
      orcLegs(b, P, { pants: OSK, wrap: WRAP });
      orcTrunk(b, P.body, { flap: 'team' });
      orcHead(b, P.head, { hair: 'mohawk', hairColor: '#7a2a1e' });
      orcArms(b, P, { fore: WRAP });
      b.part = P.body;
      b.torus(0.06, 0.012, 8, 4, { y: 0.48, z: 0.035, rx: PI / 2 - 0.3, color: BONE });    // collar de colmillos
      b.blob(0.13, 0.04, 0.1, 0, { y: 0.48, z: -0.02, color: 'team', teamShade: 0.75 });   // piel sobre los hombros
      // piel de equipo a la espalda
      b.part = P.cape;
      b.box(0.21, 0.25, 0.02, { y: 0.35, z: -0.125, rx: 0.18, color: 'team', flag: (x, y) => Math.max(0, 0.45 - y) * 1.6 });
      // pluma en el pelo
      b.part = P.head;
      b.box(0.01, 0.09, 0.026, { x: 0.05, y: 0.6, z: -0.02, rx: -1.0, rz: -0.5, color: '#f2efe4' });
      // escudo de piel en la izquierda
      b.part = P.handL;
      roundShield(b, [-0.2, 0.28, 0.06], -0.95, 0.1, 'team', HIDE_D, BONE);
      b.box(0.012, 0.12, 0.005, { x: -0.18, y: 0.28, z: 0.085, ry: -0.95, color: '#efe6cf' });
      // lanza con punta de hueso (vertical)
      b.part = P.handR;
      const hx = ORC_H[0], hz = ORC_H[2] + 0.005;
      seg(b, [hx, 0.04, hz], [hx, 0.76, hz], 0.012, 0.011, 5, { color: OWOOD });
      b.cyl(0.018, 0.018, 0.04, 5, { x: hx, y: 0.75, z: hz, color: LEATH });
      spike(b, [hx, 0.765, hz], [hx, 0.9, hz], 0.026, 4, { color: BONE });
      b.box(0.004, 0.07, 0.03, { x: hx + 0.02, y: 0.71, z: hz, color: 'team', flag: (x, y) => Math.max(0, 0.74 - y) * 8 });
    },
  },

  // -------------------------------------------------------------- lanzahachas
  orc_ranged: {
    skeleton: 'humanoid', pivots: ORC_PIV,
    anim: { attack: 'throw', hold: 'sword', height: 0.66, stride: 0.6 },
    build(b, P) {
      orcLegs(b, P, { pants: HIDE_D });
      orcTrunk(b, P.body, { chest: 'team', belly: 'team', hump: HIDE, flap: HIDE });
      orcHead(b, P.head, { hair: 'mohawk' });
      orcArms(b, P, { fore: LEATH });
      // pañuelo de equipo con colas
      b.part = P.head;
      b.torus(0.07, 0.016, 8, 4, { y: 0.585, z: 0.07, rx: PI / 2 + 0.12, color: 'team', teamShade: 0.85 });
      for (const s of [-1, 1]) b.box(0.016, 0.07, 0.012, { x: 0.02 * s, y: 0.56, z: -0.015, rx: 0.4, rz: 0.15 * s, color: 'team', teamShade: 0.85, flag: (x, y) => Math.max(0, 0.6 - y) * 5 });
      // hombrera de cuero (izquierda)
      b.part = P.armL;
      b.blob(0.075, 0.04, 0.08, 1, { x: -0.152, y: 0.49, rz: 0.28, color: HIDE_D });
      // correa y hachas de repuesto a la espalda
      b.part = P.back;
      bar(b, [-0.12, 0.47, 0.0], [0.11, 0.29, -0.06], 0.035, 0.02, { color: LEATH, z: -0.105 });
      throwAxe(b, [-0.06, 0.38, -0.13], -0.35, 0.17);
      throwAxe(b, [0.03, 0.36, -0.14], -0.1, 0.18);
      throwAxe(b, [0.09, 0.35, -0.13], 0.25, 0.16);
      // hacha en la mano
      b.part = P.handR;
      throwAxe(b, ORC_H, 0.95, 0.19);
    },
  },

  // -------------------------------------------------------------- chamán
  orc_special: {
    skeleton: 'humanoid', pivots: ORC_PIV,
    anim: { attack: 'cast', hold: 'staff', height: 0.68, stride: 0.45 },
    pose: holdKeys(CAST),
    build(b, P) {
      orcLegs(b, P, { pants: HIDE_D, wrap: HIDE_D });
      orcTrunk(b, P.body, { chest: 'team', belly: 'team', hump: FUR, flaps: false });
      orcHead(b, P.head, { hair: null, eye: '#9dff5a', eyeGlow: 0.9 });
      orcArms(b, P, { fore: 'team', upper: OSK });
      b.part = P.body;
      b.cyl(0.118, 0.155, 0.19, 8, { y: 0.16, color: 'team', teamShade: 0.8 });                 // túnica larga
      b.blob(0.15, 0.05, 0.12, 1, { y: 0.48, z: -0.015, color: FUR });                          // manto de piel
      b.torus(0.062, 0.01, 8, 4, { y: 0.47, z: 0.05, rx: PI / 2 - 0.35, color: BONE });         // collar de dientes
      // fetiches de hueso colgando del cinturón
      for (const [x, z] of [[-0.09, 0.07], [0.0, 0.115], [0.09, 0.07]]) { b.box(0.012, 0.05, 0.01, { x, y: 0.23, z, color: '#c9b48a' }); b.ball(0.019, 0, { x, y: 0.2, z: z + 0.005, color: BONE }); }
      // tocado: capucha de piel de lobo, cuernos y plumas
      b.part = P.head;
      b.blob(0.085, 0.06, 0.085, 1, { y: 0.585, z: 0.05, color: '#8a7a68' });
      for (const s of [-1, 1]) spike(b, [0.06 * s, 0.61, 0.04], [0.12 * s, 0.7, -0.01], 0.02, 5, { color: BONE });
      for (const [x, c] of [[-0.03, '#c0392b'], [0, '#f2efe4'], [0.03, 'team']]) b.box(0.014, 0.12, 0.035, { x, y: 0.67, z: -0.03, rx: -0.35, rz: -x * 4, color: c });
      // bastón con calavera brillante
      b.part = P.handR;
      const hx = ORC_H[0], hz = ORC_H[2] + 0.005;
      seg(b, [hx, 0.03, hz], [hx + 0.01, 0.48, hz], 0.012, 0.012, 5, { color: OWOOD });
      seg(b, [hx + 0.01, 0.48, hz], [hx - 0.005, 0.7, hz + 0.01], 0.012, 0.014, 5, { color: OWOOD });
      b.ball(0.04, 1, { x: hx, y: 0.735, z: hz + 0.015, color: BONE });
      b.box(0.045, 0.02, 0.035, { x: hx, y: 0.705, z: hz + 0.04, color: shade(BONE, -0.1) });
      for (const s of [-1, 1]) b.box(0.012, 0.012, 0.006, { x: hx + 0.016 * s, y: 0.74, z: hz + 0.053, color: '#9dff5a', glow: 1 });
      b.ball(0.03, 0, { x: hx, y: 0.8, z: hz + 0.01, color: '#8aff5a', glow: 1 });
      for (const s of [-1, 1]) b.box(0.004, 0.08, 0.02, { x: hx + 0.035 * s, y: 0.66, z: hz, color: s < 0 ? '#c0392b' : 'team', flag: (x, y) => Math.max(0, 0.7 - y) * 6 });
    },
  },

  // -------------------------------------------------------------- caudillo
  orc_general: {
    skeleton: 'humanoid', pivots: ORC_PIV, scale: 1.15,
    anim: { attack: 'smash', hold: 'twohand', height: 0.7, stride: 0.5 },
    pose: holdKeys(smashKeys(0.45)),
    build(b, P) {
      orcLegs(b, P, { pants: RUST, wrap: LEATH, foot: LEATH });
      orcTrunk(b, P.body, { chest: IRON, belly: 'team', hump: FUR, flap: 'team', belt: ORED });
      orcHead(b, P.head, { eye: '#ff4a2a', eyeGlow: 0.7 });
      orcArms(b, P, { fore: RUST });
      orcPads(b, P, 'team', 3, Z0, ['armL', 'armR'], IRON);
      b.part = P.body;
      b.ball(0.03, 0, { y: 0.27, z: 0.118, color: GOLD, glow: 0.3 });                           // hebilla
      b.blob(0.16, 0.055, 0.12, 1, { y: 0.49, z: -0.02, color: FUR });                          // collar de piel
      // casco con cuernos
      b.part = P.head;
      b.blob(0.084, 0.055, 0.086, 1, { y: 0.592, z: 0.066, color: IRON });
      b.cyl(0.086, 0.088, 0.02, 8, { y: 0.565, z: 0.066, color: GOLD, glow: 0.2 });
      b.box(0.02, 0.06, 0.018, { y: 0.55, z: 0.152, color: IRON });
      for (const s of [-1, 1]) {
        spike(b, [0.07 * s, 0.6, 0.06], [0.15 * s, 0.66, 0.05], 0.03, 6, { color: BONE });
        spike(b, [0.145 * s, 0.655, 0.05], [0.17 * s, 0.76, 0.02], 0.019, 5, { color: shade(BONE, 0.04) });
      }
      // estandarte de trofeos a la espalda
      b.part = P.back;
      seg(b, [0.0, 0.3, -0.13], [0.0, 1.0, -0.17], 0.013, 0.011, 5, { color: OWOOD });
      b.box(0.26, 0.022, 0.022, { y: 0.93, z: -0.165, color: OWOOD });
      b.box(0.22, 0.25, 0.012, { y: 0.795, z: -0.165, color: 'team', flag: (x, y) => Math.max(0, 0.93 - y) * 3 });
      b.box(0.22, 0.03, 0.014, { y: 0.66, z: -0.165, color: ORED, flag: 0.45 });
      b.ball(0.04, 0, { y: 1.02, z: -0.17, color: BONE });
      for (const s of [-1, 1]) spike(b, [0.03 * s, 1.03, -0.17], [0.09 * s, 1.09, -0.17], 0.012, 4, { color: BONE });
      // gran hacha doble
      b.part = P.handR;
      const h = ORC_H, rx = 0.45;
      seg(b, along(h, rx, -0.1), along(h, rx, 0.5), 0.015, 0.014, 6, { color: OWOOD });
      seg(b, along(h, rx, -0.02), along(h, rx, 0.06), 0.019, 0.019, 6, { color: LEATH });
      const blade = [[0.02, -0.05], [0.08, -0.1], [0.13, -0.085], [0.15, 0], [0.13, 0.085], [0.08, 0.1], [0.02, 0.05]];
      const hp = along(h, rx, 0.42);
      for (const s of [-1, 1]) b.extrude(blade.map(([x, y]) => [x * s, y]), 0.02, at(hp, { rx, ry: PI / 2, color: s < 0 ? IRON_L : shade(IRON_L, -0.05) }));
      b.cyl(0.026, 0.026, 0.1, 6, at(hp, { rx, color: RUST }));
      spike(b, along(h, rx, 0.47), along(h, rx, 0.56), 0.016, 4, { color: IRON_L });
    },
  },

  // -------------------------------------------------------------- jinete de lobo
  orc_cav: {
    skeleton: 'rider',
    anim: { walk: 'gallop', attack: 'bite', riderAttack: 'swing', hold: 'sword', stride: 0.62, size: 1.25, height: 0.62 },
    pivots: {
      body: [0, 0.36, 0], head: [0, 0.42, 0.2], tail: [0, 0.41, -0.26], extra: [0, 0.36, 0],
      legFL: [-0.075, 0.33, 0.16], legFR: [0.075, 0.33, 0.16], legBL: [-0.075, 0.33, -0.17], legBR: [0.075, 0.33, -0.17],
      rBody: [0, 0.5, -0.03], rHead: [0, 0.69, 0.005], rArmL: [-0.138, 0.682, -0.03], rArmR: [0.138, 0.682, -0.03],
      rHandL: [-ORC_H[0], ORC_H[1] + 0.22, ORC_H[2] - 0.03], rHandR: [ORC_H[0], ORC_H[1] + 0.22, ORC_H[2] - 0.03], rCape: [0, 0.69, -0.11],
    },
    build(b, P) {
      const W = '#8a8076', WD = '#665d55', WL = '#c4baa8';
      // lobo
      b.part = P.body;
      b.blob(0.13, 0.11, 0.24, 1, { y: 0.37, z: -0.02, color: W });
      b.blob(0.145, 0.14, 0.125, 1, { y: 0.405, z: 0.13, color: WD });
      b.blob(0.118, 0.105, 0.11, 1, { y: 0.37, z: -0.17, color: shade(W, -0.03) });
      for (const z of [0.12, 0.04]) spike(b, [0, 0.49, z], [0, 0.56, z - 0.06], 0.035, 4, { color: WD });
      b.part = P.head;
      b.blob(0.08, 0.085, 0.09, 1, { y: 0.445, z: 0.23, color: WD });
      b.blob(0.072, 0.064, 0.078, 1, { y: 0.48, z: 0.31, color: W });
      b.box(0.064, 0.052, 0.11, { y: 0.455, z: 0.39, color: WL });
      b.box(0.058, 0.024, 0.1, { y: 0.415, z: 0.375, rx: 0.22, color: WL });
      b.box(0.05, 0.012, 0.08, { y: 0.432, z: 0.375, rx: 0.1, color: '#8a2a2a' });
      b.box(0.03, 0.022, 0.02, { y: 0.47, z: 0.448, color: '#221a16' });
      for (const s of [-1, 1]) {
        b.cone(0.026, 0.075, 4, { x: 0.042 * s, y: 0.56, z: 0.29, rz: -0.25 * s, color: WD });
        b.box(0.018, 0.012, 0.01, { x: 0.035 * s, y: 0.5, z: 0.375, color: '#ffd23a', glow: 0.6 });
        b.cone(0.008, 0.026, 4, { x: 0.022 * s, y: 0.422, z: 0.43, rx: PI, color: '#f2efe4' });
      }
      for (const [l, x, z, back] of [['legFL', -0.075, 0.16, 0], ['legFR', 0.075, 0.16, 0], ['legBL', -0.075, -0.17, 1], ['legBR', 0.075, -0.17, 1]]) {
        b.part = P[l];
        b.box(back ? 0.065 : 0.058, 0.17, back ? 0.085 : 0.07, { x, y: 0.265, z: z - back * 0.01, color: back ? W : WD });
        b.box(0.042, 0.15, 0.048, { x, y: 0.105, z: z + (back ? -0.02 : 0.005), color: W });
        b.box(0.056, 0.034, 0.075, { x, y: 0.017, z: z + (back ? -0.01 : 0.02), color: WD });
      }
      b.part = P.tail;
      b.blob(0.042, 0.042, 0.12, 1, { y: 0.37, z: -0.35, rx: -0.6, color: W });
      b.blob(0.03, 0.03, 0.06, 0, { y: 0.31, z: -0.43, rx: -0.8, color: WL });
      // silla y gualdrapa de equipo
      b.part = P.extra;
      b.box(0.24, 0.11, 0.21, { y: 0.43, z: -0.03, color: 'team' });
      b.box(0.245, 0.02, 0.215, { y: 0.375, z: -0.03, color: BONE });
      b.box(0.13, 0.04, 0.12, { y: 0.495, z: -0.03, color: LEATH });
      b.box(0.14, 0.07, 0.03, { y: 0.51, z: 0.03, color: LEATH });
      b.ball(0.03, 0, { y: 0.39, z: 0.235, color: BONE });
      // jinete orco (tronco elevado 0.22)
      const d = [0, 0.22, -0.03];
      b.part = P.rBody;
      for (const s of [-1, 1]) {
        b.box(0.075, 0.07, 0.15, { x: 0.105 * s, y: 0.5, z: 0.02, color: HIDE_D });
        b.box(0.068, 0.13, 0.072, { x: 0.13 * s, y: 0.42, z: 0.08, color: WRAP });
        b.box(0.075, 0.04, 0.11, { x: 0.13 * s, y: 0.35, z: 0.1, color: shade(OSK, -0.08) });
      }
      orcTrunk(b, P.rBody, { chest: 'team', belly: 'team', hump: HIDE, flaps: false }, d);
      orcHead(b, P.rHead, { hair: 'knot' }, d);
      orcArms(b, P, { fore: LEATH }, d, ['rArmL', 'rArmR']);

      // estandarte en la espalda
      b.part = P.rCape;
      seg(b, [0.06, 0.6, -0.15], [0.06, 1.0, -0.17], 0.01, 0.009, 5, { color: OWOOD });
      b.box(0.004, 0.14, 0.12, { x: 0.06, y: 0.9, z: -0.24, color: 'team', flag: (x, y, z) => Math.max(0, -0.17 - z) * 7 });
      // hacha de guerra
      b.part = P.rHandR;
      const h = [ORC_H[0], ORC_H[1] + 0.22, ORC_H[2] - 0.03], rx = 0.85;
      seg(b, along(h, rx, -0.05), along(h, rx, 0.26), 0.013, 0.012, 5, { color: OWOOD });
      b.box(0.018, 0.12, 0.1, at(along(h, rx, 0.21, 0.045), { rx, color: RUST }));
      b.box(0.012, 0.12, 0.02, at(along(h, rx, 0.21, 0.1), { rx, color: IRON_L }));
      // escudo pequeño
      b.part = P.rHandL;
      roundShield(b, [-0.2, 0.49, 0.0], -1.2, 0.085, 'team', HIDE_D, BONE);
    },
  },

  // -------------------------------------------------------------- ariete
  orc_siege: {
    skeleton: 'siege',
    anim: { attack: 'ram', wheelTurns: 1 },
    pivots: {
      body: [0, 0.2, 0], wheelFL: [-0.25, 0.12, 0.28], wheelFR: [0.25, 0.12, 0.28], wheelBL: [-0.25, 0.12, -0.3], wheelBR: [0.25, 0.12, -0.3],
      arm: [0, 0.3, 0], arm2: [0, 0.3, 0], crewL: [-0.13, 0, -0.62], crewR: [0.13, 0, -0.62],
    },
    build(b, P) {
      b.part = P.body;
      for (const s of [-1, 1]) b.box(0.05, 0.06, 0.98, { x: 0.2 * s, y: 0.16, color: OWOOD });
      for (const z of [-0.44, 0, 0.44]) b.box(0.46, 0.04, 0.05, { y: 0.2, z, color: shade(OWOOD, -0.05) });
      for (const s of [-1, 1]) for (const z of [-0.42, 0.42]) b.box(0.04, 0.2, 0.04, { x: 0.2 * s, y: 0.28, z, color: OWOOD });
      // tejado de pieles (cumbrera a lo largo de Z) con paneles de equipo
      b.wedge(0.98, 0.32, 0.6, { y: 0.37, ry: PI / 2, color: HIDE_D });
      for (const s of [-1, 1]) {
        const a = Math.atan2(0.32, 0.3);
        b.box(0.012, 0.36, 0.7, { x: 0.152 * s, y: 0.53, rz: s * (PI / 2 - a), color: 'team' });
      }
      b.box(0.04, 0.04, 1.02, { y: 0.69, color: OWOOD });
      for (const z of [-0.3, 0, 0.3]) spike(b, [0, 0.7, z], [0, 0.8, z - 0.03], 0.02, 4, { color: BONE });
      b.ball(0.06, 0, { y: 0.47, z: 0.5, color: BONE });
      for (const s of [-1, 1]) b.box(0.016, 0.016, 0.006, { x: 0.022 * s, y: 0.48, z: 0.555, color: '#1a1410' });
      for (const s of [-1, 1]) spike(b, [0.05 * s, 0.5, 0.49], [0.12 * s, 0.56, 0.47], 0.016, 4, { color: BONE });
      b.box(0.36, 0.1, 0.012, { y: 0.31, z: -0.5, color: 'team', teamShade: 0.75, flag: (x, y) => Math.max(0, 0.36 - y) * 3 });
      // estandarte sobre el tejado
      seg(b, [0, 0.7, -0.4], [0, 1.0, -0.4], 0.01, 0.009, 5, { color: OWOOD });
      b.box(0.004, 0.12, 0.14, { y: 0.92, z: -0.47, color: 'team', flag: (x, y, z) => Math.max(0, -0.4 - z) * 6 });
      // ruedas macizas (eje en X)
      for (const [w, x, z] of [['wheelFL', -0.25, 0.28], ['wheelFR', 0.25, 0.28], ['wheelBL', -0.25, -0.3], ['wheelBR', 0.25, -0.3]]) {
        b.part = P[w];
        b.cyl(0.12, 0.12, 0.05, 8, { x, y: 0.12, z, rz: PI / 2, color: '#6a4a2c' });
        b.cyl(0.035, 0.035, 0.07, 6, { x, y: 0.12, z, rz: PI / 2, color: IRON });
        b.box(0.054, 0.2, 0.025, { x, y: 0.12, z, color: shade('#6a4a2c', -0.08) });
      }
      // tronco del ariete con cabeza de hierro
      b.part = P.arm;
      b.cyl(0.06, 0.062, 1.0, 8, { y: 0.3, z: 0.02, rx: PI / 2, color: '#8a6440' });
      for (const z of [-0.3, 0.2]) b.cyl(0.066, 0.066, 0.035, 8, { y: 0.3, z, rx: PI / 2, color: RUST });
      for (const z of [-0.2, 0.25]) b.box(0.012, 0.36, 0.012, { y: 0.5, z, color: IRON });
      b.cyl(0.08, 0.07, 0.09, 8, { y: 0.3, z: 0.55, rx: PI / 2, color: IRON });
      b.blob(0.075, 0.07, 0.07, 1, { y: 0.3, z: 0.62, color: IRON });
      for (const s of [-1, 1]) {
        spike(b, [0.05 * s, 0.33, 0.6], [0.11 * s, 0.37, 0.52], 0.022, 5, { color: IRON_L });
        b.box(0.016, 0.014, 0.006, { x: 0.03 * s, y: 0.32, z: 0.688, color: '#ff6a2a', glow: 0.6 });
      }
      // dos orcos empujando detrás
      for (const [cw, cx] of [['crewL', -0.13], ['crewR', 0.13]]) {
        b.part = P[cw]; const z0 = -0.62;
        for (const s of [-1, 1]) {
          bar(b, [cx + 0.045 * s, 0.24, z0 - 0.02], [cx + 0.05 * s, 0.03, z0 - 0.1], 0.06, 0.07, { color: HIDE_D });
          b.box(0.065, 0.04, 0.1, { x: cx + 0.05 * s, y: 0.02, z: z0 - 0.09, color: shade(OSK, -0.08) });
        }
        b.blob(0.1, 0.085, 0.12, 1, { x: cx, y: 0.33, z: z0 + 0.03, rx: 0.9, color: 'team' });
        b.blob(0.062, 0.058, 0.064, 1, { x: cx, y: 0.42, z: z0 + 0.13, color: OSK });
        b.box(0.09, 0.035, 0.055, { x: cx, y: 0.39, z: z0 + 0.15, color: shade(OSK, -0.07) });
        for (const s of [-1, 1]) {
          b.cone(0.01, 0.034, 4, { x: cx + 0.03 * s, y: 0.415, z: z0 + 0.18, rz: -0.2 * s, color: BONE });
          bar(b, [cx + 0.1 * s, 0.4, z0 + 0.06], [cx + 0.1 * s, 0.35, z0 + 0.22], 0.05, 0.055, { color: OSK });
        }
      }
    },
  },
};

// ================================================================== GIGANTES
const GSK = '#a3b3c2', FSK = '#c4dbec', GFUR = '#cdbfa5', GFUR_D = '#a8987c', GSTONE = '#a39e94', GSTONE_D = '#8b8780', GWOOD = '#b08a5a', ICE = '#bfeaff',
  GLEATH = '#7a5a3e', WICKER = '#c2a066', SNOW = '#eef3f8';
const GH = [0.285, 0.475, 0.035];
const GIANT_PIV = {
  body: [0, 0.55, 0], head: [0, 0.965, 0.03], armL: [-0.25, 0.92, 0], armR: [0.25, 0.92, 0],
  handL: [-GH[0], GH[1], GH[2]], handR: GH, legL: [-0.11, 0.5, 0], legR: [0.11, 0.5, 0],
  cape: [0, 0.94, -0.15], back: [0, 0.82, -0.18],
};
function giantLegs(b, P, o = {}) {
  for (const s of [-1, 1]) {
    b.part = s < 0 ? P.legL : P.legR; const x = 0.11 * s;
    b.box(0.15, 0.24, 0.16, { x, y: 0.4, color: o.pants || GLEATH });
    b.cyl(0.086, 0.076, 0.21, 7, { x: x + 0.005 * s, y: 0.18, z: 0.005, color: o.wrap || GFUR });
    b.box(0.165, 0.075, 0.23, { x: x + 0.008 * s, y: 0.038, z: 0.035, color: o.foot || GFUR_D });
  }
}
function giantTrunk(b, part, o = {}, d = Z0) {
  const q = ofs(d), skin = o.skin || GSK;
  b.part = part;
  b.cyl(0.2, 0.205, 0.07, 8, q(0, 0.555, 0, { color: o.belt || GLEATH }));
  if (o.kilt !== false) b.cyl(0.205, 0.25, 0.19, 8, q(0, 0.44, 0, { color: o.kilt || 'team', teamShade: 0.9 }));
  b.blob(0.2, 0.17, 0.165, 1, q(0, 0.68, 0.025, { color: o.belly || skin }));
  b.blob(0.235, 0.15, 0.175, 1, q(0, 0.83, 0, { color: o.chest || skin, teamShade: 1.05 }));
  b.cyl(0.075, 0.09, 0.08, 7, q(0, 0.965, 0.025, { color: skin }));
  if (o.mantle !== false) b.blob(0.25, 0.07, 0.19, 1, q(0, 0.93, -0.01, { color: o.mantle || GFUR }));
}
function giantHead(b, part, o = {}, d = Z0) {
  const q = ofs(d), skin = o.skin || GSK, skinD = shade(skin, -0.08), beard = o.beard || '#d8d0c0';
  b.part = part;
  b.blob(0.1, 0.108, 0.098, 1, q(0, 1.06, 0.045, { color: skin }));
  b.box(0.16, 0.032, 0.05, q(0, 1.088, 0.12, { rx: -0.2, color: skinD }));
  b.box(0.036, 0.05, 0.04, q(0, 1.045, 0.148, { rx: -0.15, color: skinD }));
  for (const s of [-1, 1]) b.box(0.022, 0.016, 0.01, q(0.04 * s, 1.066, 0.138, { color: o.eye || '#26303e', glow: o.eyeGlow || 0 }));
  if (o.beard !== null) {
    b.cone(0.08, 0.21, 6, q(0, 0.93, 0.115, { rx: PI, color: beard }));
    b.box(0.12, 0.03, 0.04, q(0, 1.012, 0.15, { color: beard }));
  }
  if (o.hair !== null) b.blob(0.105, 0.085, 0.1, 1, q(0, 1.11, 0.02, { color: o.hair || beard }));
}
function giantArms(b, P, o = {}, d = Z0, names = ['armL', 'armR']) {
  const q = ofs(d), skin = o.skin || GSK;
  for (const s of [-1, 1]) {
    b.part = P[s < 0 ? names[0] : names[1]];
    b.ball(0.095, 0, q(0.255 * s, 0.905, 0, { color: o.shoulder || skin }));
    b.box(0.125, 0.24, 0.135, q(0.272 * s, 0.775, 0.005, { rz: 0.05 * s, color: o.upper || skin }));
    b.cyl(0.068, 0.058, 0.19, 7, q(0.282 * s, 0.6, 0.02, { color: o.fore || GLEATH }));
    b.ball(0.072, 0, q(GH[0] * s, GH[1], GH[2], { color: skin }));
  }
}
/** Hombreras de losa de piedra. */
function stonePads(b, P, color = GSTONE) {
  for (const s of [-1, 1]) { b.part = s < 0 ? P.armL : P.armR; b.box(0.19, 0.06, 0.2, { x: 0.275 * s, y: 1.0, rz: -0.35 * s, color }); }
}
/** Las patas delanteras siguen al cuerpo cuando el animal se encabrita (stomp). */
function legsFollow(names) {
  return (pose, st) => {
    if (st.dead >= 0 || st.anim !== 'attack') return;
    const P = pose.sk.P, v = pose.v, piv = pose.sk.piv, ib = P.body * 7;
    const a = v[ib], py = v[ib + 4], pz = v[ib + 5], by = piv[P.body * 3 + 1], bz = piv[P.body * 3 + 2], c = Math.cos(a), s = Math.sin(a);
    for (const n of names) {
      const i = P[n], y = piv[i * 3 + 1] - by, z = piv[i * 3 + 2] - bz;
      pose.p(n, 0, y * c - z * s - y + py, y * s + z * c - z + pz);
    }
  };
}

const GIANTS = {
  // -------------------------------------------------------------- recolector gigante
  giant_worker: {
    skeleton: 'humanoid', pivots: GIANT_PIV,
    anim: { attack: 'swing', hold: 'sword', height: 1.15, walk: 'heavy', stride: 0.5 },
    pose: workerPose({ chop: 0.55, mine: 0.75, build: 0.3, farm: 0.6 }),
    build(b, P) {
      giantLegs(b, P);
      giantTrunk(b, P.body, { kilt: GLEATH, belly: 'team', chest: 'team', mantle: false });
      giantHead(b, P.head, { beard: '#8a6a4a', hair: '#7a5a3a' });
      giantArms(b, P, { fore: GFUR_D });
      b.part = P.body;
      for (const s of [-1, 1]) bar(b, [0.13 * s, 0.985, 0.06], [0.14 * s, 0.7, 0.2], 0.045, 0.02, { color: GLEATH });
      // gran cesta de mimbre a la espalda
      b.part = P.back;
      b.cyl(0.15, 0.12, 0.3, 8, { y: 0.8, z: -0.27, color: WICKER });
      b.torus(0.15, 0.018, 8, 4, { y: 0.95, z: -0.27, rx: PI / 2, color: shade(WICKER, -0.12) });
      b.torus(0.138, 0.011, 8, 3, { y: 0.76, z: -0.27, rx: PI / 2, color: shade(WICKER, -0.08) });
      // herramientas
      const h = GH, rx = 1.0;
      b.part = P.toolAxe;
      seg(b, along(h, rx, -0.1), along(h, rx, 0.42), 0.02, 0.018, 6, { color: GWOOD });
      b.box(0.026, 0.13, 0.12, at(along(h, rx, 0.36, 0.065), { rx, color: IRON_L }));
      b.part = P.toolPick;
      seg(b, along(h, rx, -0.1), along(h, rx, 0.42), 0.02, 0.018, 6, { color: GWOOD });
      spike(b, along(h, rx, 0.39), along(h, rx, 0.34, 0.18), 0.028, 4, { color: IRON });
      spike(b, along(h, rx, 0.39), along(h, rx, 0.36, -0.13), 0.025, 4, { color: IRON });
      b.part = P.toolHammer;
      seg(b, along(h, rx, -0.08), along(h, rx, 0.34), 0.02, 0.018, 6, { color: GWOOD });
      bar(b, along(h, rx, 0.34, -0.08), along(h, rx, 0.34, 0.09), 0.1, 0.1, { color: GSTONE });
      b.part = P.toolHoe;
      seg(b, along(h, rx, -0.12), along(h, rx, 0.54), 0.018, 0.016, 6, { color: GWOOD });
      b.box(0.12, 0.022, 0.11, at(along(h, rx, 0.53, 0.055), { rx, color: IRON }));
      b.part = P.toolBasket;
      const c = [-0.33, 0.33, 0.07];
      b.cyl(0.1, 0.075, 0.12, 8, at(c, { color: WICKER }));
      b.torus(0.1, 0.014, 8, 4, { x: c[0], y: c[1] + 0.06, z: c[2], rx: PI / 2, color: shade(WICKER, -0.12) });
      b.ball(0.06, 0, { x: c[0], y: c[1] + 0.065, z: c[2], color: '#7a9a3a' });
      // cargas dentro de la cesta
      b.part = P.carryWood;
      for (let i = 0; i < 3; i++) b.cyl(0.035, 0.035, 0.42, 6, { x: (i - 1) * 0.07, y: 0.98, z: -0.27 + (i % 2) * 0.03, rz: (i - 1) * 0.15, color: shade('#9a7046', (i - 1) * 0.05) });
      b.part = P.carryFood;
      b.blob(0.13, 0.07, 0.13, 1, { y: 0.96, z: -0.27, color: '#6f8f3a' });
      b.ball(0.05, 0, { x: 0.05, y: 1.0, z: -0.25, color: '#c0392b' });
      b.ball(0.045, 0, { x: -0.05, y: 1.0, z: -0.3, color: '#d9a03a' });
      b.part = P.carryGold;
      b.blob(0.13, 0.05, 0.13, 1, { y: 0.95, z: -0.27, color: '#c9a032', glow: 0.25 });
      b.ball(0.05, 0, { x: -0.04, y: 0.99, z: -0.26, color: '#e7c13d', glow: 0.4 });
      b.ball(0.04, 0, { x: 0.05, y: 0.985, z: -0.29, color: '#f0d050', glow: 0.4 });
      b.part = P.carryStone;
      b.box(0.16, 0.12, 0.13, { y: 0.98, z: -0.27, ry: 0.3, color: GSTONE });
      b.box(0.12, 0.1, 0.1, { x: 0.05, y: 1.07, z: -0.26, ry: -0.2, color: GSTONE_D });
      b.part = P.carryIron;
      b.blob(0.13, 0.05, 0.13, 1, { y: 0.95, z: -0.27, color: '#6a5048' });
      b.ball(0.06, 0, { x: -0.03, y: 1.0, z: -0.27, color: '#7b5d50' });
      b.ball(0.05, 0, { x: 0.06, y: 0.99, z: -0.25, color: '#8a6a5a' });
    },
  },

  // -------------------------------------------------------------- guerrero gigante
  giant_inf: {
    skeleton: 'humanoid', pivots: GIANT_PIV,
    anim: { attack: 'smash', hold: 'twohand', height: 1.18, walk: 'heavy', stride: 0.5 },
    pose: holdKeys(smashKeys(0.5)),
    build(b, P) {
      giantLegs(b, P);
      giantTrunk(b, P.body, {});
      giantHead(b, P.head, { beard: '#b5653a', hair: '#a85a30' });
      giantArms(b, P, { fore: GLEATH });
      b.part = P.body;
      bar(b, [-0.2, 0.95, 0.05], [0, 0.82, 0.185], 0.1, 0.025, { color: 'team', teamShade: 0.8 });
      bar(b, [0, 0.82, 0.185], [0.19, 0.62, 0.16], 0.1, 0.025, { color: 'team', teamShade: 0.8 });
      b.part = P.head;
      for (const s of [-1, 1]) b.box(0.03, 0.13, 0.03, { x: 0.075 * s, y: 0.92, z: 0.12, color: '#a85a30' });     // trenzas
      b.part = P.armL; b.box(0.19, 0.06, 0.2, { x: -0.275, y: 1.0, rz: 0.35, color: GSTONE });
      b.part = P.armR; b.blob(0.11, 0.05, 0.11, 1, { x: 0.27, y: 0.99, rz: -0.35, color: GFUR });
      // maza de piedra
      b.part = P.handR;
      const h = GH, rx = 0.5;
      seg(b, along(h, rx, -0.1), along(h, rx, 0.42), 0.03, 0.034, 6, { color: GWOOD });
      b.cyl(0.046, 0.046, 0.06, 6, at(along(h, rx, 0.4), { rx, color: GLEATH }));
      b.blob(0.1, 0.15, 0.1, 1, at(along(h, rx, 0.53), { rx, color: GSTONE }));
      spike(b, along(h, rx, 0.56, 0.07), along(h, rx, 0.6, 0.15), 0.03, 4, { color: GSTONE_D });
      spike(b, along(h, rx, 0.5, -0.07), along(h, rx, 0.52, -0.15), 0.028, 4, { color: GSTONE_D });
    },
  },

  // -------------------------------------------------------------- muro de piedra
  giant_pike: {
    skeleton: 'humanoid', pivots: GIANT_PIV,
    anim: { attack: 'thrust', hold: 'spear', height: 1.2, walk: 'heavy', stride: 0.45 },
    pose: holdKeys(THRUST),
    build(b, P) {
      giantLegs(b, P, { wrap: GSTONE_D });
      giantTrunk(b, P.body, { mantle: false });
      giantHead(b, P.head, { beard: '#8f8a80', hair: null });
      giantArms(b, P, { fore: GSTONE_D, shoulder: GSTONE });
      stonePads(b, P, shade(GSTONE, 0.04));
      b.part = P.body;
      b.box(0.34, 0.22, 0.07, { y: 0.83, z: 0.15, rx: -0.12, color: GSTONE });
      b.box(0.26, 0.12, 0.06, { y: 0.665, z: 0.17, rx: 0.1, color: GSTONE_D });
      b.box(0.36, 0.22, 0.06, { y: 0.82, z: -0.16, rx: 0.1, color: GSTONE_D });
      b.part = P.head;
      b.blob(0.115, 0.07, 0.112, 1, { y: 1.12, z: 0.04, color: GSTONE });
      b.box(0.03, 0.08, 0.03, { y: 1.07, z: 0.155, color: GSTONE_D });
      // escudo de losa con la cara de equipo
      b.part = P.handL;
      const ry = -0.75, n = [Math.sin(ry), 0, Math.cos(ry)], c = [-0.38, 0.62, 0.14], f = k => [c[0] + n[0] * k, c[1], c[2] + n[2] * k];
      b.box(0.38, 0.6, 0.06, at(c, { ry, color: GSTONE }));
      b.box(0.3, 0.5, 0.012, at(f(0.034), { ry, color: 'team' }));
      b.box(0.07, 0.42, 0.012, at(f(0.042), { ry, color: GFUR }));
      b.box(0.24, 0.07, 0.012, at(f(0.042), { y: c[1] + 0.08, ry, color: GFUR }));
      // lanza larga con punta de piedra
      b.part = P.handR;
      const hx = GH[0], hz = GH[2] + 0.005;
      seg(b, [hx, 0.07, hz], [hx, 1.38, hz], 0.022, 0.02, 6, { color: GWOOD });
      b.cyl(0.03, 0.03, 0.06, 6, { x: hx, y: 1.37, z: hz, color: GLEATH });
      b.cone(0.05, 0.2, 4, { x: hx, y: 1.5, z: hz, color: GSTONE_D });
      b.box(0.005, 0.12, 0.1, { x: hx + 0.03, y: 1.28, z: hz - 0.05, color: 'team', flag: (x, y, z) => Math.max(0, hz - z) * 5 });
    },
  },

  // -------------------------------------------------------------- lanzarrocas
  giant_ranged: {
    skeleton: 'humanoid', pivots: GIANT_PIV,
    anim: { attack: 'throw', hold: 'sword', height: 1.17, walk: 'heavy', stride: 0.5 },
    build(b, P) {
      giantLegs(b, P);
      giantTrunk(b, P.body, { chest: 'team' });
      giantHead(b, P.head, { beard: '#d8d0c0', hair: '#d8d0c0' });
      giantArms(b, P, { fore: GLEATH });
      b.part = P.body;
      bar(b, [0.2, 0.95, 0.05], [-0.18, 0.62, 0.16], 0.04, 0.02, { color: GLEATH, z: 0.13 });
      // red con rocas a la espalda
      b.part = P.back;
      b.blob(0.16, 0.17, 0.11, 1, { y: 0.78, z: -0.26, color: '#8a7458' });
      b.ball(0.085, 0, { x: -0.06, y: 0.95, z: -0.25, color: GSTONE });
      b.ball(0.072, 0, { x: 0.07, y: 0.93, z: -0.28, color: GSTONE_D });
      b.ball(0.06, 0, { x: 0.0, y: 0.6, z: -0.3, color: GSTONE });
      // roca en la mano
      b.part = P.handR;
      b.ball(0.115, 0, { x: GH[0] + 0.01, y: GH[1] + 0.03, z: GH[2] + 0.1, color: GSTONE });
      b.ball(0.06, 0, { x: GH[0] + 0.05, y: GH[1] + 0.09, z: GH[2] + 0.14, color: shade(GSTONE, 0.05) });
    },
  },

  // -------------------------------------------------------------- gigante de escarcha
  giant_special: {
    skeleton: 'humanoid', pivots: GIANT_PIV,
    anim: { attack: 'cast', hold: 'staff', height: 1.2, walk: 'heavy', stride: 0.45 },
    pose: holdKeys(CAST),
    build(b, P) {
      giantLegs(b, P, { pants: '#6a7a8a', wrap: SNOW, foot: '#c8d4de' });
      giantTrunk(b, P.body, { skin: FSK, kilt: false, chest: 'team', belly: 'team', mantle: SNOW });
      giantHead(b, P.head, { skin: FSK, beard: SNOW, hair: SNOW, eye: ICE, eyeGlow: 1 });
      giantArms(b, P, { skin: FSK, upper: FSK, fore: 'team' });
      b.part = P.body;
      b.cyl(0.21, 0.29, 0.42, 8, { y: 0.32, color: 'team', teamShade: 0.8 });
      b.cyl(0.292, 0.3, 0.04, 8, { y: 0.12, color: ICE, glow: 0.3 });
      for (const s of [-1, 1]) {
        b.part = s < 0 ? P.armL : P.armR;
        spike(b, [0.27 * s, 0.96, 0], [0.34 * s, 1.14, -0.02], 0.045, 4, { color: ICE, glow: 0.6 });
        spike(b, [0.23 * s, 0.95, -0.06], [0.24 * s, 1.08, -0.12], 0.032, 4, { color: ICE, glow: 0.6 });
        b.part = P.head;
        b.cone(0.013, 0.07, 4, { x: 0.035 * s, y: 0.82, z: 0.13, rx: PI, color: ICE, glow: 0.5 });
        spike(b, [0.05 * s, 1.16, 0.03], [0.09 * s, 1.27, 0.0], 0.025, 4, { color: ICE, glow: 0.7 });
      }
      // bastón de escarcha con cristal brillante
      b.part = P.handR;
      const hx = GH[0], hz = GH[2] + 0.005;
      seg(b, [hx, 0.06, hz], [hx, 1.3, hz], 0.022, 0.02, 6, { color: '#dfe8ee' });
      b.cone(0.07, 0.2, 4, { x: hx, y: 1.42, z: hz, color: ICE, glow: 0.9 });
      b.cone(0.07, 0.12, 4, { x: hx, y: 1.26, z: hz, rx: PI, color: ICE, glow: 0.9 });
      for (const s of [-1, 1]) spike(b, [hx, 1.3, hz], [hx + 0.09 * s, 1.44, hz + 0.02], 0.025, 4, { color: ICE, glow: 0.7 });
    },
  },

  // -------------------------------------------------------------- rompemuros
  giant_siege: {
    skeleton: 'humanoid',
    pivots: Object.assign({}, GIANT_PIV, { handL: [-0.27, 0.58, 0.3], handR: [0.27, 0.58, 0.3] }),
    anim: { attack: 'smash', hold: 'twohand', height: 1.18, walk: 'heavy', stride: 0.45 },
    // el tronco va en la mano derecha: compensa la apertura de los brazos para que siga horizontal
    pose(pose, st) { if (st.dead < 0) pose.r('handR', 0, 0, -pose.v[pose.sk.P.armR * 7 + 2]); },
    build(b, P) {
      giantLegs(b, P);
      giantTrunk(b, P.body, { chest: GLEATH });
      giantHead(b, P.head, { beard: '#6a5040', hair: '#5a4030' });
      b.part = P.body;
      for (const s of [-1, 1]) bar(b, [0.15 * s, 0.97, 0.06], [-0.14 * s, 0.62, 0.17], 0.07, 0.02, { color: 'team', z: 0.15 });
      b.part = P.head;
      b.blob(0.112, 0.06, 0.108, 1, { y: 1.13, z: 0.04, color: IRON });
      for (const s of [-1, 1]) spike(b, [0.09 * s, 1.14, 0.04], [0.17 * s, 1.24, 0.02], 0.028, 5, { color: BONE });
      // brazos adelantados sujetando el tronco
      for (const s of [-1, 1]) {
        b.part = s < 0 ? P.armL : P.armR;
        b.ball(0.095, 0, { x: 0.255 * s, y: 0.905, color: GSK });
        bar(b, [0.26 * s, 0.9, 0], [0.29 * s, 0.7, 0.12], 0.125, 0.135, { color: GSK });
        seg(b, [0.29 * s, 0.7, 0.12], [0.275 * s, 0.6, 0.27], 0.068, 0.058, 7, { color: GLEATH });
        b.ball(0.072, 0, { x: 0.27 * s, y: 0.58, z: 0.3, color: GSK });
        b.blob(0.11, 0.05, 0.11, 1, { x: 0.27 * s, y: 0.99, rz: -0.35 * s, color: GFUR });
      }
      // gran tronco zunchado de hierro
      b.part = P.handR;
      b.cyl(0.1, 0.1, 1.0, 8, { y: 0.62, z: 0.36, rz: PI / 2, color: '#8a6440' });
      for (const x of [-0.36, 0.36]) b.cyl(0.107, 0.107, 0.05, 8, { x, y: 0.62, z: 0.36, rz: PI / 2, color: IRON });
      b.cyl(0.108, 0.108, 0.12, 8, { y: 0.62, z: 0.36, rz: PI / 2, color: 'team' });
      for (const s of [-1, 1]) {
        b.cyl(0.085, 0.1, 0.05, 8, { x: 0.51 * s, y: 0.62, z: 0.36, rz: PI / 2, color: IRON });
        spike(b, [0.53 * s, 0.62, 0.36], [0.62 * s, 0.62, 0.36], 0.05, 5, { color: IRON_L });
      }
      b.box(0.005, 0.14, 0.05, { x: 0.04, y: 0.52, z: 0.47, color: 'team', flag: (x, y) => Math.max(0, 0.6 - y) * 5 });
    },
  },

  // -------------------------------------------------------------- rey titán
  giant_general: {
    skeleton: 'humanoid', pivots: GIANT_PIV, scale: 1.15,
    anim: { attack: 'smash', hold: 'twohand', height: 1.22, walk: 'heavy', stride: 0.45 },
    pose: holdKeys(smashKeys(0.5)),
    build(b, P) {
      giantLegs(b, P, { pants: '#5a6a7a', wrap: SNOW, foot: '#c8d4de' });
      giantTrunk(b, P.body, { belly: 'team', mantle: SNOW, belt: GSTONE_D });
      giantHead(b, P.head, { beard: SNOW, hair: SNOW, eye: ICE, eyeGlow: 0.6 });
      giantArms(b, P, { fore: GSTONE_D, shoulder: GSTONE });
      stonePads(b, P);
      b.part = P.body;
      b.box(0.09, 0.07, 0.03, { y: 0.555, z: 0.205, color: GOLD, glow: 0.3 });
      b.box(0.3, 0.16, 0.05, { y: 0.84, z: 0.155, rx: -0.12, color: GSTONE });
      b.box(0.08, 0.08, 0.02, { y: 0.85, z: 0.185, rx: -0.12, ry: PI / 4, color: ICE, glow: 0.8 });
      // corona de piedra con cristales de hielo
      b.part = P.head;
      b.cyl(0.11, 0.106, 0.05, 8, { y: 1.15, z: 0.04, color: GSTONE });
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.6; b.cone(0.024, i === 2 ? 0.14 : 0.09, 4, { x: Math.sin(a) * 0.1, y: i === 2 ? 1.24 : 1.215, z: 0.04 + Math.cos(a) * 0.1, color: ICE, glow: 0.8 }); }
      for (const s of [-1, 1]) { b.part = s < 0 ? P.armL : P.armR; spike(b, [0.28 * s, 1.02, 0], [0.33 * s, 1.15, -0.02], 0.035, 4, { color: ICE, glow: 0.6 }); }
      // capa de equipo con cuello de piel
      b.part = P.cape;
      b.box(0.46, 0.68, 0.03, { y: 0.6, z: -0.22, rx: 0.12, color: 'team', flag: (x, y) => Math.max(0, 0.92 - y) * 1.2 });
      b.box(0.47, 0.05, 0.035, { y: 0.27, z: -0.26, rx: 0.12, color: SNOW, flag: 0.8 });
      // gran mazo de piedra con runas de hielo
      b.part = P.handR;
      const h = GH, rx = 0.5;
      seg(b, along(h, rx, -0.12), along(h, rx, 0.56), 0.03, 0.03, 6, { color: '#6a4a30' });
      bar(b, along(h, rx, 0.6, -0.18), along(h, rx, 0.6, 0.18), 0.18, 0.18, { color: GSTONE });
      for (const e of [-0.12, 0.12]) bar(b, along(h, rx, 0.6, e - 0.015), along(h, rx, 0.6, e + 0.015), 0.19, 0.19, { color: IRON });
      b.box(0.19, 0.05, 0.05, at(along(h, rx, 0.6), { rx, color: ICE, glow: 0.9 }));
    },
  },

  // -------------------------------------------------------------- mamut de guerra
  giant_cav: {
    skeleton: 'rider',
    anim: { walk: 'trot', attack: 'stomp', riderAttack: 'throw', hold: 'sword', stride: 0.4, size: 2, height: 1.1 },
    pivots: {
      body: [0, 0.68, 0], head: [0, 0.82, 0.42], tail: [0, 0.78, -0.52], extra: [0, 0.68, 0],
      legFL: [-0.19, 0.6, 0.28], legFR: [0.19, 0.6, 0.28], legBL: [-0.18, 0.58, -0.3], legBR: [0.18, 0.58, -0.3],
      rBody: [0, 1.05, -0.12], rHead: [0, 1.465, -0.09], rArmL: [-0.25, 1.42, -0.12], rArmR: [0.25, 1.42, -0.12],
      rHandL: [-GH[0], GH[1] + 0.5, GH[2] - 0.12], rHandR: [GH[0], GH[1] + 0.5, GH[2] - 0.12], rCape: [0, 1.44, -0.27],
    },
    pose: legsFollow(['legFL', 'legFR']),
    build(b, P) {
      const M = '#7a5a3e', MD = '#5e4430', ML = '#9a7a58', IV = '#efe6cf';
      b.part = P.body;
      b.blob(0.32, 0.27, 0.5, 1, { y: 0.68, z: -0.04, color: M });
      b.blob(0.29, 0.25, 0.27, 1, { y: 0.8, z: 0.22, color: MD });
      b.blob(0.33, 0.14, 0.48, 1, { y: 0.5, z: -0.02, color: MD });
      for (const [x, z] of [[-0.3, 0.15], [0.3, 0.15], [-0.31, -0.2], [0.31, -0.2]]) spike(b, [x, 0.56, z], [x * 1.05, 0.36, z], 0.08, 4, { color: MD });
      b.part = P.head;
      b.blob(0.2, 0.22, 0.18, 1, { y: 0.86, z: 0.55, color: M });
      b.blob(0.13, 0.1, 0.12, 1, { y: 1.04, z: 0.5, color: MD });
      seg(b, [0, 0.76, 0.68], [0, 0.5, 0.78], 0.09, 0.07, 7, { color: M });
      seg(b, [0, 0.5, 0.78], [0, 0.27, 0.76], 0.07, 0.052, 7, { color: M });
      seg(b, [0, 0.27, 0.76], [0, 0.16, 0.84], 0.052, 0.04, 6, { color: ML });
      for (const s of [-1, 1]) {
        seg(b, [0.11 * s, 0.72, 0.64], [0.17 * s, 0.5, 0.82], 0.042, 0.035, 6, { color: IV });
        seg(b, [0.17 * s, 0.5, 0.82], [0.16 * s, 0.5, 1.0], 0.035, 0.026, 6, { color: IV });
        seg(b, [0.16 * s, 0.5, 1.0], [0.1 * s, 0.64, 1.08], 0.026, 0.01, 5, { color: IV });
        b.blob(0.03, 0.11, 0.09, 0, { x: 0.19 * s, y: 0.86, z: 0.5, color: MD });
        b.box(0.025, 0.02, 0.012, { x: 0.12 * s, y: 0.9, z: 0.7, color: '#1e1814' });
      }
      for (const [l, x, z] of [['legFL', -0.19, 0.28], ['legFR', 0.19, 0.28], ['legBL', -0.18, -0.3], ['legBR', 0.18, -0.3]]) {
        b.part = P[l];
        b.cyl(0.105, 0.095, 0.6, 7, { x, y: 0.36, z, color: M });
        b.cyl(0.11, 0.116, 0.07, 7, { x, y: 0.035, z, color: ML });
      }
      b.part = P.tail;
      seg(b, [0, 0.78, -0.52], [0, 0.6, -0.6], 0.03, 0.022, 5, { color: M });
      b.blob(0.035, 0.06, 0.035, 0, { y: 0.56, z: -0.61, color: MD });
      // manta de equipo, plataforma y estandartes
      b.part = P.extra;
      b.blob(0.345, 0.22, 0.34, 1, { y: 0.77, z: -0.12, color: 'team' });
      b.box(0.58, 0.05, 0.46, { y: 1.02, z: -0.15, color: GWOOD });
      b.box(0.6, 0.035, 0.48, { y: 0.99, z: -0.15, color: GFUR });
      b.box(0.56, 0.12, 0.035, { y: 1.1, z: -0.37, color: shade(GWOOD, -0.1) });
      for (const s of [-1, 1]) {
        seg(b, [0.27 * s, 1.0, -0.37], [0.27 * s, 1.62, -0.37], 0.016, 0.014, 5, { color: GWOOD });
        b.box(0.005, 0.2, 0.17, { x: 0.27 * s, y: 1.5, z: -0.46, color: 'team', flag: (x, y, z) => Math.max(0, -0.37 - z) * 5 });
        b.ball(0.025, 0, { x: 0.27 * s, y: 1.64, z: -0.37, color: GOLD, glow: 0.3 });
      }
      // jinete gigante sentado (sin falda: se sienta sobre la plataforma)
      const d = [0, 0.5, -0.12];
      b.part = P.rBody;
      for (const s of [-1, 1]) {
        b.box(0.15, 0.12, 0.26, { x: 0.13 * s, y: 1.1, z: -0.02, color: GLEATH });
        b.box(0.12, 0.1, 0.24, { x: 0.09 * s, y: 1.08, z: 0.09, ry: -0.9 * s, color: GFUR });
      }
      giantTrunk(b, P.rBody, { kilt: false, chest: 'team' }, d);
      giantHead(b, P.rHead, { beard: '#b5653a', hair: '#a85a30' }, d);
      giantArms(b, P, { fore: GLEATH }, d, ['rArmL', 'rArmR']);
      b.part = P.rHandR;
      b.ball(0.1, 0, { x: GH[0] + 0.01, y: GH[1] + 0.53, z: GH[2] - 0.03, color: GSTONE });
    },
  },
};

// ================================================================== NEUTRALES
const NSK = '#d9a882', NBOOT = '#3e2c1e';
function banditBody(b, P, o) {
  for (const [p, x] of [[P.legL, -0.05], [P.legR, 0.05]]) {
    b.part = p;
    b.box(0.07, 0.19, 0.08, { x, y: 0.15, color: o.pants || '#4e463c' });
    b.box(0.08, 0.09, 0.102, { x, y: 0.045, z: 0.01, color: NBOOT });
  }
  b.part = P.body;
  b.cyl(0.092, 0.118, 0.13, 8, { y: 0.27, color: o.jerkin });
  b.box(0.18, 0.18, 0.115, { y: 0.37, color: o.jerkin });
  b.box(0.19, 0.03, 0.125, { y: 0.27, color: NBOOT });
  b.box(0.03, 0.024, 0.02, { y: 0.27, z: 0.064, color: '#b8a070' });
  bar(b, [-0.085, 0.45, 0.062], [0.08, 0.29, 0.064], 0.04, 0.012, { color: 'team' });
  b.cyl(0.062, 0.078, 0.05, 8, { y: 0.455, color: o.scarf });
  b.part = P.cape;
  b.box(0.18, 0.27, 0.02, { y: 0.31, z: -0.072, rx: 0.1, color: o.scarf, flag: (x, y) => Math.max(0, 0.42 - y) * 1.5 });
  b.part = P.head;
  b.ball(0.066, 1, { y: 0.525, color: NSK });
  for (const s of [-1, 1]) b.box(0.014, 0.012, 0.01, { x: 0.024 * s, y: 0.533, z: 0.062, color: '#1e1a1e' });
  b.blob(0.078, 0.078, 0.078, 1, { y: 0.54, z: -0.024, color: o.hood });
  b.cone(0.05, 0.09, 6, { y: 0.585, z: -0.085, rx: -1.1, color: o.hood });
  b.box(0.11, 0.04, 0.03, { y: 0.503, z: 0.05, color: o.mask });
  for (const [p, s] of [[P.armL, -1], [P.armR, 1]]) {
    b.part = p;
    b.ball(0.044, 0, { x: 0.12 * s, y: 0.43, sy: 0.8, color: o.scarf });
    b.box(0.052, 0.19, 0.058, { x: 0.125 * s, y: 0.335, color: shade(o.jerkin, -0.04) });
    b.box(0.054, 0.052, 0.06, { x: 0.125 * s, y: 0.236, color: NBOOT });
  }
}

const NEUTRALS = {
  // -------------------------------------------------------------- bandido
  neutral_bandit: {
    skeleton: 'humanoid',
    anim: { attack: 'swing', hold: 'sword', height: 0.62 },
    build(b, P) {
      banditBody(b, P, { jerkin: '#6b4a2c', scarf: '#7a3a30', hood: '#5a3a2e', mask: '#3e3430' });
      // sable curvo
      b.part = P.handR;
      const h = [0.125, 0.236, 0.02], rx = 0.8;
      seg(b, along(h, rx, -0.04), along(h, rx, 0.04), 0.012, 0.012, 6, { color: NBOOT });
      b.box(0.07, 0.016, 0.02, at(along(h, rx, 0.04), { rx, color: '#9a8a5a' }));
      b.box(0.012, 0.15, 0.032, at(along(h, rx, 0.12, 0.004), { rx, color: '#c9cfd6' }));
      b.box(0.012, 0.1, 0.03, at(along(h, rx, 0.24, 0.018), { rx: rx + 0.25, color: '#c9cfd6' }));
      // puñal en la izquierda
      b.part = P.handL;
      b.box(0.01, 0.08, 0.022, { x: -0.125, y: 0.2, z: 0.06, rx: 2.2, color: '#b8bec6' });
    },
  },

  // -------------------------------------------------------------- bandido arquero
  neutral_bandit_archer: {
    skeleton: 'humanoid',
    anim: { attack: 'bow', hold: 'bow', height: 0.62 },
    build(b, P) {
      banditBody(b, P, { jerkin: '#5a5a3a', scarf: '#6a4a32', hood: '#4a5236', mask: '#3a3a2e', pants: '#4a4034' });
      // carcaj
      b.part = P.back;
      b.cyl(0.032, 0.028, 0.2, 6, { x: 0.03, y: 0.38, z: -0.085, rz: -0.35, color: '#7a5634' });
      for (const dx of [-0.012, 0.012]) b.box(0.012, 0.05, 0.024, { x: 0.07 + dx, y: 0.5, z: -0.085, rz: -0.35, color: '#e8e2d0' });
      // arco vertical en la izquierda
      b.part = P.handL;
      const x = -0.125, z = 0.03;
      seg(b, [x, 0.236, z + 0.01], [x, 0.38, z], 0.012, 0.01, 5, { color: '#7a5030' });
      seg(b, [x, 0.38, z], [x, 0.47, z - 0.04], 0.01, 0.007, 5, { color: '#7a5030' });
      seg(b, [x, 0.236, z + 0.01], [x, 0.1, z], 0.012, 0.01, 5, { color: '#7a5030' });
      seg(b, [x, 0.1, z], [x, 0.01, z - 0.04], 0.01, 0.007, 5, { color: '#7a5030' });
      b.box(0.004, 0.46, 0.004, { x, y: 0.24, z: z - 0.042, color: '#e8e2d0' });
    },
  },

  // -------------------------------------------------------------- goblin
  neutral_goblin: {
    skeleton: 'humanoid',
    pivots: { body: [0, 0.15, 0], head: [0, 0.255, 0.02], armL: [-0.07, 0.245, 0], armR: [0.07, 0.245, 0], handL: [-0.082, 0.13, 0.025], handR: [0.082, 0.13, 0.025], legL: [-0.035, 0.14, 0], legR: [0.035, 0.14, 0], back: [0, 0.22, -0.05] },
    anim: { attack: 'swing', hold: 'sword', height: 0.42, stride: 0.7 },
    build(b, P) {
      const S = '#8fa04a', SD = shade(S, -0.08), RAG = '#7a6a4a';
      for (const s of [-1, 1]) {
        b.part = s < 0 ? P.legL : P.legR;
        b.box(0.034, 0.11, 0.04, { x: 0.035 * s, y: 0.085, color: S });
        b.box(0.05, 0.024, 0.08, { x: 0.037 * s, y: 0.012, z: 0.018, color: SD });
      }
      b.part = P.body;
      b.cyl(0.058, 0.074, 0.1, 7, { y: 0.15, color: RAG });
      b.blob(0.066, 0.058, 0.055, 1, { y: 0.215, z: 0.005, color: shade(RAG, 0.05) });
      b.box(0.06, 0.06, 0.012, { y: 0.11, z: 0.072, rx: -0.1, color: 'team' });
      b.box(0.13, 0.016, 0.07, { y: 0.255, z: -0.005, color: 'team', teamShade: 0.8 });
      b.part = P.head;
      b.blob(0.068, 0.06, 0.064, 1, { y: 0.31, z: 0.04, color: S });
      for (const s of [-1, 1]) {
        b.cone(0.03, 0.13, 4, { x: 0.105 * s, y: 0.33, z: 0.025, rz: -1.3 * s, ry: 0.25 * s, sz: 0.45, color: S });
        b.box(0.018, 0.014, 0.01, { x: 0.026 * s, y: 0.322, z: 0.097, color: '#ffe23a', glow: 0.7 });
      }
      b.cone(0.016, 0.06, 4, { y: 0.3, z: 0.12, rx: PI / 2 + 0.3, color: SD });
      b.box(0.05, 0.01, 0.01, { y: 0.278, z: 0.098, color: '#f2efe4' });
      b.cone(0.022, 0.06, 4, { y: 0.375, z: 0.03, rx: -0.4, color: '#4a3a2a' });
      for (const s of [-1, 1]) {
        b.part = s < 0 ? P.armL : P.armR;
        b.ball(0.024, 0, { x: 0.074 * s, y: 0.24, color: RAG });
        b.box(0.028, 0.1, 0.032, { x: 0.079 * s, y: 0.185, color: S });
        b.ball(0.022, 0, { x: 0.082 * s, y: 0.13, z: 0.025, color: SD });
      }
      b.part = P.handR;
      const h = [0.082, 0.13, 0.025], rx = 0.9;
      seg(b, along(h, rx, -0.025), along(h, rx, 0.03), 0.008, 0.008, 5, { color: '#5a3e24' });
      b.box(0.008, 0.09, 0.03, at(along(h, rx, 0.075, 0.006), { rx, color: '#9a8a7a' }));
    },
  },

  // -------------------------------------------------------------- ogro
  neutral_ogre: {
    skeleton: 'humanoid', scale: 1,
    pivots: { body: [0, 0.46, 0], head: [0, 0.86, 0.1], armL: [-0.27, 0.82, 0.02], armR: [0.27, 0.82, 0.02], handL: [-0.31, 0.37, 0.07], handR: [0.31, 0.37, 0.07], legL: [-0.12, 0.42, 0], legR: [0.12, 0.42, 0], back: [0, 0.75, -0.2] },
    anim: { attack: 'smash', hold: 'twohand', height: 1.1, walk: 'heavy', stride: 0.45 },
    pose: holdKeys(smashKeys(0.55)),
    build(b, P) {
      const S = '#8a9a78', SD = shade(S, -0.08), SL = shade(S, 0.06);
      for (const s of [-1, 1]) {
        b.part = s < 0 ? P.legL : P.legR; const x = 0.12 * s;
        b.box(0.15, 0.22, 0.16, { x, y: 0.31, color: S });
        b.box(0.13, 0.16, 0.14, { x: x + 0.005 * s, y: 0.12, z: 0.005, color: SD });
        b.box(0.16, 0.06, 0.22, { x: x + 0.008 * s, y: 0.03, z: 0.035, color: SD });
      }
      b.part = P.body;
      b.cyl(0.2, 0.21, 0.06, 8, { y: 0.47, color: '#5a4030' });
      b.box(0.17, 0.17, 0.03, { y: 0.37, z: 0.2, rx: -0.12, color: 'team' });
      b.box(0.2, 0.15, 0.03, { y: 0.38, z: -0.19, rx: 0.12, color: '#7a5a3a' });
      b.blob(0.26, 0.24, 0.25, 1, { y: 0.62, z: 0.06, color: SL });
      b.blob(0.25, 0.14, 0.18, 1, { y: 0.78, z: -0.02, color: S });
      b.blob(0.18, 0.1, 0.12, 1, { y: 0.85, z: -0.08, color: S });
      b.ball(0.05, 0, { y: 0.47, z: 0.21, color: BONE });
      b.part = P.head;
      b.blob(0.085, 0.08, 0.085, 1, { y: 0.94, z: 0.16, color: S });
      b.box(0.13, 0.05, 0.09, { y: 0.89, z: 0.2, color: SD });
      b.box(0.14, 0.03, 0.04, { y: 0.965, z: 0.235, rx: -0.2, color: SD });
      for (const s of [-1, 1]) {
        b.cone(0.012, 0.045, 4, { x: 0.04 * s, y: 0.925, z: 0.24, color: '#e8dcc0' });
        b.box(0.018, 0.012, 0.01, { x: 0.03 * s, y: 0.945, z: 0.245, color: '#2a1e14' });
        b.cone(0.025, 0.05, 4, { x: 0.09 * s, y: 0.95, z: 0.14, rz: -1.2 * s, color: S });
      }
      b.box(0.03, 0.04, 0.06, { y: 1.02, z: 0.14, rx: -0.3, color: '#3a2c20' });
      for (const s of [-1, 1]) {
        b.part = s < 0 ? P.armL : P.armR;
        b.ball(0.1, 0, { x: 0.275 * s, y: 0.8, z: 0.02, color: S });
        b.box(0.13, 0.22, 0.14, { x: 0.292 * s, y: 0.67, z: 0.03, rz: 0.06 * s, color: S });
        b.box(0.13, 0.17, 0.14, { x: 0.305 * s, y: 0.49, z: 0.05, color: SD });
        b.cyl(0.074, 0.074, 0.05, 7, { x: 0.305 * s, y: 0.53, z: 0.05, color: '#5a4030' });
        b.ball(0.075, 0, { x: 0.31 * s, y: 0.37, z: 0.07, color: S });
      }
      // garrote con clavos
      b.part = P.handR;
      const h = [0.31, 0.37, 0.07], rx = 0.55;
      seg(b, along(h, rx, -0.1), along(h, rx, 0.25), 0.03, 0.04, 6, { color: '#7a5634' });
      seg(b, along(h, rx, 0.25), along(h, rx, 0.62), 0.06, 0.085, 7, { color: '#8a6440' });
      for (const [d, e] of [[0.45, 0.07], [0.55, -0.08]]) spike(b, along(h, rx, d, e * 0.9), along(h, rx, d, e * 2), 0.014, 4, { color: IRON });
      const m = along(h, rx, 0.5); spike(b, [m[0] + 0.065, m[1], m[2]], [m[0] + 0.14, m[1], m[2]], 0.014, 4, { color: IRON });
    },
  },
};

// ================================================================== FAUNA (sin color de equipo)
const EYE = '#16120e', HOOF = '#3a2c20';
/** Pata de cuadrúpedo: muslo, caña y pezuña/zarpa (pieza propia, se queda en el suelo). */
function qLeg(b, part, x, z, top, up, low, foot, c) {
  b.part = part;
  const yk = top - up[1];                        // rodilla
  b.box(up[0], up[1] + 0.02, up[2], { x, y: (top + yk) / 2 + 0.01, z, color: c[0] });
  b.box(low[0], yk - foot[1] + 0.01, low[2], { x, y: (yk + foot[1]) / 2, z, color: c[1] });
  b.box(foot[0], foot[1], foot[2], { x, y: foot[1] / 2, z: z + 0.006, color: c[2] });
}
const legs4 = (b, P, xf, zf, xb, zb, top, up, low, foot, c, cb) => {
  qLeg(b, P.legFL, -xf, zf, top, up, low, foot, c); qLeg(b, P.legFR, xf, zf, top, up, low, foot, c);
  qLeg(b, P.legBL, -xb, zb, top, cb ? cb.up : up, low, foot, c); qLeg(b, P.legBR, xb, zb, top, cb ? cb.up : up, low, foot, c);
};
const quadPiv = (by, hy, hz, lx, ly, lzf, lzb, ty, tz) => ({
  body: [0, by, 0], head: [0, hy, hz], tail: [0, ty, tz],
  legFL: [-lx, ly, lzf], legFR: [lx, ly, lzf], legBL: [-lx, ly, lzb], legBR: [lx, ly, lzb],
});

const ANIMALS = {
  // -------------------------------------------------------------- cerdo
  animal_pig: {
    skeleton: 'quadruped', pivots: quadPiv(0.17, 0.19, 0.12, 0.055, 0.13, 0.08, -0.085, 0.2, -0.16),
    anim: { walk: 'trot', stride: 0.5, attack: 'none' },
    build(b, P) {
      const S = '#eaa49c', SD = '#d48a84';
      b.part = P.body;
      b.blob(0.1, 0.09, 0.16, 1, { y: 0.175, color: S });
      b.blob(0.095, 0.088, 0.08, 1, { y: 0.18, z: 0.08, color: shade(S, -0.02) });
      b.part = P.head;
      b.blob(0.072, 0.068, 0.068, 1, { y: 0.19, z: 0.17, color: S });
      b.cyl(0.036, 0.04, 0.04, 8, { y: 0.175, z: 0.24, rx: PI / 2, color: SD });
      for (const s of [-1, 1]) {
        b.box(0.01, 0.012, 0.006, { x: 0.014 * s, y: 0.176, z: 0.261, color: '#7a4a48' });
        b.cone(0.03, 0.055, 4, { x: 0.04 * s, y: 0.245, z: 0.16, rx: 0.6, rz: -0.25 * s, color: SD });
        b.box(0.012, 0.012, 0.008, { x: 0.03 * s, y: 0.21, z: 0.228, color: EYE });
      }
      legs4(b, P, 0.055, 0.08, 0.055, -0.085, 0.13, [0.036, 0.06, 0.04], [0.03, 0, 0.032], [0.034, 0.02, 0.038], [S, SD, HOOF]);
      b.part = P.tail;
      b.torus(0.016, 0.005, 6, 3, { y: 0.2, z: -0.165, color: SD });
    },
  },

  // -------------------------------------------------------------- vaca
  animal_cow: {
    skeleton: 'quadruped', pivots: quadPiv(0.34, 0.38, 0.22, 0.08, 0.28, 0.15, -0.16, 0.42, -0.27),
    anim: { walk: 'trot', stride: 0.4, attack: 'none', size: 1.3 },
    build(b, P) {
      const W = '#f2efe8', D = '#4a3a30', PK = '#e0a090';
      b.part = P.body;
      b.blob(0.13, 0.12, 0.26, 1, { y: 0.35, z: -0.01, color: W });
      for (const [x, y, z, ry] of [[-0.118, 0.37, 0.06, 0], [0.118, 0.34, -0.1, 0], [0.12, 0.39, 0.1, 0]]) b.blob(0.02, 0.06, 0.08, 0, { x, y, z, ry, color: D });
      b.blob(0.07, 0.02, 0.09, 0, { y: 0.465, z: -0.09, color: D });
      b.blob(0.045, 0.035, 0.05, 0, { y: 0.235, z: -0.1, color: PK });
      b.part = P.head;
      b.blob(0.07, 0.078, 0.08, 1, { y: 0.39, z: 0.24, color: W });
      b.box(0.1, 0.09, 0.16, { y: 0.42, z: 0.32, rx: 0.35, color: W });
      b.box(0.04, 0.05, 0.1, { x: 0.03, y: 0.44, z: 0.31, rx: 0.35, color: D });
      b.box(0.092, 0.065, 0.06, { y: 0.375, z: 0.39, rx: 0.35, color: PK });
      for (const s of [-1, 1]) {
        spike(b, [0.04 * s, 0.47, 0.29], [0.1 * s, 0.51, 0.28], 0.014, 4, { color: '#e8dcc0' });
        b.box(0.055, 0.022, 0.032, { x: 0.075 * s, y: 0.45, z: 0.27, rz: -0.3 * s, color: W });
        b.box(0.014, 0.014, 0.008, { x: 0.045 * s, y: 0.44, z: 0.36, color: EYE });
      }
      legs4(b, P, 0.08, 0.15, 0.08, -0.16, 0.28, [0.064, 0.13, 0.072], [0.052, 0, 0.058], [0.058, 0.028, 0.064], [W, shade(W, -0.06), HOOF]);
      b.part = P.tail;
      seg(b, [0, 0.43, -0.27], [0, 0.24, -0.3], 0.01, 0.008, 5, { color: W });
      b.blob(0.02, 0.035, 0.02, 0, { y: 0.23, z: -0.3, color: D });
    },
  },

  // -------------------------------------------------------------- gallina (ave)
  animal_chicken: {
    skeleton: 'bird',
    anim: {},
    build(b, P) {
      const W = '#f4efe4', R = '#d8382c', O = '#e8a030';
      b.part = P.body;
      b.blob(0.06, 0.055, 0.075, 1, { y: 0.125, color: W });
      b.blob(0.045, 0.045, 0.04, 1, { y: 0.14, z: 0.05, color: shade(W, 0.02) });
      b.part = P.head;
      b.ball(0.032, 1, { y: 0.19, z: 0.07, color: W });
      b.box(0.01, 0.03, 0.045, { y: 0.224, z: 0.068, color: R });
      b.cone(0.011, 0.028, 4, { y: 0.186, z: 0.108, rx: PI / 2, color: O });
      b.box(0.008, 0.022, 0.012, { y: 0.163, z: 0.096, color: R });
      for (const s of [-1, 1]) b.box(0.006, 0.008, 0.008, { x: 0.027 * s, y: 0.196, z: 0.085, color: EYE });
      for (const [p, s] of [[P.wingL, -1], [P.wingR, 1]]) { b.part = p; b.blob(0.015, 0.036, 0.056, 0, { x: 0.058 * s, y: 0.13, z: -0.005, color: '#e4dccb' }); }
      b.part = P.tail;
      b.box(0.014, 0.065, 0.04, { y: 0.17, z: -0.075, rx: -0.5, color: W });
      b.box(0.01, 0.05, 0.03, { y: 0.165, z: -0.09, rx: -0.9, color: '#e4dccb' });
      for (const [p, s] of [[P.legL, -1], [P.legR, 1]]) {
        b.part = p;
        b.box(0.009, 0.075, 0.009, { x: 0.025 * s, y: 0.045, color: O });
        b.box(0.03, 0.007, 0.036, { x: 0.025 * s, y: 0.004, z: 0.01, color: O });
      }
    },
  },

  // -------------------------------------------------------------- ciervo
  animal_deer: {
    skeleton: 'quadruped', pivots: quadPiv(0.34, 0.4, 0.16, 0.05, 0.3, 0.13, -0.13, 0.37, -0.2),
    anim: { walk: 'gallop', stride: 0.6, attack: 'none' },
    build(b, P) {
      const C = '#a87a4a', CD = '#8a6038', WH = '#efe6d8', AN = '#d8c8a8';
      b.part = P.body;
      b.blob(0.08, 0.075, 0.19, 1, { y: 0.34, color: C });
      b.blob(0.07, 0.078, 0.07, 1, { y: 0.35, z: 0.12, color: C });
      b.blob(0.06, 0.03, 0.13, 0, { y: 0.28, color: WH });
      b.part = P.head;
      seg(b, [0, 0.36, 0.15], [0, 0.5, 0.24], 0.038, 0.028, 6, { color: C });
      b.box(0.06, 0.06, 0.11, { y: 0.52, z: 0.29, rx: 0.3, color: C });
      b.box(0.04, 0.03, 0.03, { y: 0.495, z: 0.345, rx: 0.3, color: '#2a2018' });
      for (const s of [-1, 1]) {
        b.cone(0.02, 0.065, 4, { x: 0.045 * s, y: 0.56, z: 0.25, rz: -1.0 * s, sz: 0.5, color: CD });
        b.box(0.01, 0.01, 0.008, { x: 0.031 * s, y: 0.535, z: 0.31, color: EYE });
        seg(b, [0.022 * s, 0.56, 0.27], [0.08 * s, 0.66, 0.22], 0.01, 0.008, 5, { color: AN });
        seg(b, [0.08 * s, 0.66, 0.22], [0.1 * s, 0.75, 0.15], 0.008, 0.006, 5, { color: AN });
        seg(b, [0.07 * s, 0.64, 0.23], [0.1 * s, 0.7, 0.29], 0.007, 0.005, 4, { color: AN });
        seg(b, [0.09 * s, 0.7, 0.19], [0.07 * s, 0.78, 0.22], 0.007, 0.005, 4, { color: AN });
      }
      legs4(b, P, 0.05, 0.13, 0.05, -0.13, 0.3, [0.036, 0.13, 0.046], [0.024, 0, 0.028], [0.027, 0.022, 0.032], [C, CD, HOOF], { up: [0.042, 0.13, 0.06] });
      b.part = P.tail;
      b.blob(0.022, 0.035, 0.02, 0, { y: 0.36, z: -0.2, rx: -0.4, color: WH });
    },
  },

  // -------------------------------------------------------------- caballo salvaje
  animal_horse: {
    skeleton: 'quadruped', pivots: quadPiv(0.37, 0.46, 0.2, 0.062, 0.3, 0.15, -0.15, 0.43, -0.22),
    anim: { walk: 'gallop', stride: 0.6, attack: 'none', size: 1.2 },
    build(b, P) {
      const H = '#b08458', HD = '#8a6440', M = '#3a2a1e';
      b.part = P.body;
      b.blob(0.095, 0.1, 0.235, 1, { y: 0.375, color: H });
      b.blob(0.085, 0.1, 0.08, 1, { y: 0.39, z: 0.17, color: H });
      b.blob(0.09, 0.04, 0.2, 0, { y: 0.45, z: -0.02, color: shade(H, 0.05) });
      b.part = P.head;
      b.box(0.075, 0.21, 0.1, { y: 0.52, z: 0.25, rx: 0.5, color: H });
      b.box(0.03, 0.23, 0.06, { y: 0.56, z: 0.21, rx: 0.5, color: M });
      b.box(0.075, 0.08, 0.18, { y: 0.6, z: 0.34, rx: 0.75, color: H });
      b.box(0.07, 0.06, 0.06, { y: 0.54, z: 0.41, rx: 0.75, color: HD });
      b.box(0.02, 0.07, 0.006, { y: 0.61, z: 0.38, rx: 0.75 - PI / 2, color: '#efe6d8' });
      b.box(0.03, 0.04, 0.05, { y: 0.66, z: 0.29, rx: 0.3, color: M });
      for (const s of [-1, 1]) {
        b.cone(0.016, 0.05, 4, { x: 0.025 * s, y: 0.675, z: 0.27, color: H });
        b.box(0.01, 0.012, 0.01, { x: 0.039 * s, y: 0.615, z: 0.34, color: EYE });
      }
      legs4(b, P, 0.062, 0.15, 0.062, -0.15, 0.3, [0.048, 0.18, 0.055], [0.038, 0, 0.044], [0.046, 0.034, 0.056], [H, M, '#2a2018']);
      b.part = P.tail;
      b.box(0.04, 0.22, 0.045, { y: 0.34, z: -0.27, rx: -0.3, color: M });
      b.box(0.03, 0.08, 0.035, { y: 0.21, z: -0.3, rx: -0.1, color: M });
    },
  },

  // -------------------------------------------------------------- jabalí
  animal_boar: {
    skeleton: 'quadruped', pivots: quadPiv(0.19, 0.21, 0.13, 0.055, 0.14, 0.09, -0.09, 0.22, -0.16),
    anim: { walk: 'trot', stride: 0.55, attack: 'gore' },
    build(b, P) {
      const C = '#5e4a3a', CD = '#3e2e24', SN = '#8a6a5a';
      b.part = P.body;
      b.blob(0.1, 0.1, 0.17, 1, { y: 0.2, z: -0.01, color: C });
      b.blob(0.1, 0.115, 0.09, 1, { y: 0.23, z: 0.08, color: shade(C, -0.03) });
      for (const z of [0.12, 0.04, -0.05]) spike(b, [0, 0.31 - (0.12 - z) * 0.3, z], [0, 0.37 - (0.12 - z) * 0.4, z - 0.04], 0.028, 4, { color: CD });
      b.part = P.head;
      b.blob(0.068, 0.07, 0.085, 1, { y: 0.2, z: 0.17, color: C });
      b.cyl(0.032, 0.036, 0.05, 7, { y: 0.17, z: 0.25, rx: PI / 2, color: SN });
      for (const s of [-1, 1]) {
        spike(b, [0.03 * s, 0.165, 0.235], [0.06 * s, 0.215, 0.27], 0.011, 4, { color: BONE });
        b.cone(0.026, 0.05, 4, { x: 0.045 * s, y: 0.265, z: 0.13, rz: -0.4 * s, color: CD });
        b.box(0.012, 0.01, 0.008, { x: 0.035 * s, y: 0.215, z: 0.232, color: '#2a0e0a' });
      }
      legs4(b, P, 0.055, 0.09, 0.055, -0.09, 0.14, [0.04, 0.06, 0.046], [0.032, 0, 0.036], [0.036, 0.02, 0.04], [C, CD, HOOF]);
      b.part = P.tail;
      seg(b, [0, 0.22, -0.16], [0, 0.15, -0.19], 0.008, 0.006, 4, { color: C });
      b.blob(0.012, 0.025, 0.012, 0, { y: 0.14, z: -0.19, color: CD });
    },
  },

  // -------------------------------------------------------------- lobo
  animal_wolf: {
    skeleton: 'quadruped', pivots: quadPiv(0.25, 0.29, 0.14, 0.05, 0.22, 0.11, -0.12, 0.28, -0.19),
    anim: { walk: 'gallop', stride: 0.6, attack: 'bite' },
    build(b, P) {
      const W = '#8d8f94', WD = '#6a6c72', WL = '#c8c6c0';
      b.part = P.body;
      b.blob(0.075, 0.075, 0.17, 1, { y: 0.255, z: -0.01, color: W });
      b.blob(0.088, 0.092, 0.08, 1, { y: 0.275, z: 0.09, color: WD });
      b.blob(0.065, 0.03, 0.12, 0, { y: 0.21, z: 0.0, color: WL });
      b.part = P.head;
      b.blob(0.055, 0.06, 0.065, 1, { y: 0.3, z: 0.16, color: WD });
      b.blob(0.05, 0.045, 0.055, 1, { y: 0.33, z: 0.21, color: W });
      b.box(0.042, 0.036, 0.075, { y: 0.312, z: 0.27, color: WL });
      b.box(0.038, 0.016, 0.065, { y: 0.285, z: 0.26, rx: 0.2, color: WL });
      b.box(0.022, 0.016, 0.014, { y: 0.322, z: 0.31, color: '#1e1a18' });
      for (const s of [-1, 1]) {
        b.cone(0.018, 0.055, 4, { x: 0.03 * s, y: 0.385, z: 0.2, rz: -0.25 * s, color: WD });
        b.box(0.012, 0.009, 0.008, { x: 0.024 * s, y: 0.345, z: 0.26, color: '#ffd23a', glow: 0.4 });
      }
      legs4(b, P, 0.05, 0.11, 0.05, -0.12, 0.22, [0.04, 0.11, 0.05], [0.03, 0, 0.034], [0.04, 0.024, 0.052], [W, W, WD], { up: [0.046, 0.11, 0.062] });
      b.part = P.tail;
      b.blob(0.03, 0.03, 0.085, 1, { y: 0.25, z: -0.25, rx: -0.6, color: W });
      b.blob(0.02, 0.02, 0.04, 0, { y: 0.205, z: -0.3, rx: -0.8, color: WL });
    },
  },

  // -------------------------------------------------------------- oso
  animal_bear: {
    skeleton: 'quadruped', pivots: quadPiv(0.33, 0.37, 0.2, 0.09, 0.28, 0.14, -0.15, 0.36, -0.26),
    anim: { walk: 'trot', stride: 0.45, attack: 'stomp', size: 1.3 },
    pose: legsFollow(['legFL', 'legFR']),
    build(b, P) {
      const B = '#6a4a32', BD = '#4e3624', BL = '#a08060';
      b.part = P.body;
      b.blob(0.15, 0.14, 0.25, 1, { y: 0.34, z: -0.02, color: B });
      b.blob(0.14, 0.15, 0.12, 1, { y: 0.39, z: 0.1, color: BD });
      b.part = P.head;
      b.blob(0.09, 0.085, 0.09, 1, { y: 0.39, z: 0.27, color: B });
      b.box(0.07, 0.06, 0.08, { y: 0.365, z: 0.35, color: BL });
      b.box(0.034, 0.022, 0.02, { y: 0.385, z: 0.39, color: '#1e1814' });
      for (const s of [-1, 1]) {
        b.ball(0.03, 0, { x: 0.06 * s, y: 0.465, z: 0.25, color: BD });
        b.box(0.014, 0.012, 0.008, { x: 0.04 * s, y: 0.415, z: 0.34, color: EYE });
      }
      legs4(b, P, 0.09, 0.14, 0.09, -0.15, 0.28, [0.08, 0.16, 0.09], [0.07, 0, 0.08], [0.08, 0.03, 0.1], [B, BD, BD]);
      for (const [p, s] of [[P.legFL, -1], [P.legFR, 1]]) { b.part = p; b.box(0.07, 0.012, 0.02, { x: 0.09 * s, y: 0.012, z: 0.195, color: BONE }); }
      b.part = P.tail;
      b.ball(0.03, 0, { y: 0.36, z: -0.27, color: BD });
    },
  },
};

export const MODELS = Object.assign({}, ORCS, GIANTS, NEUTRALS, ANIMALS);
