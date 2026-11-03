/* Modelos pequeños para los iconos de recursos de la interfaz (se renderizan como retratos). */
import { shade } from '../kit.js';

export const MODELS = {
  icon_food: { build(b) {   // pata asada + manzana
    b.blob(0.16, 0.11, 0.11, 1, { x: -0.05, y: 0.14, rz: 0.5, color: '#b5602e' });
    b.cyl(0.03, 0.03, 0.16, 6, { x: 0.12, y: 0.24, rz: 0.5, color: '#efe6d2' });
    b.ball(0.035, 0, { x: 0.18, y: 0.28, color: '#f4ecda' });
    b.ball(0.085, 1, { x: 0.1, y: 0.09, z: 0.12, color: '#d83a2a' });
    b.box(0.012, 0.05, 0.012, { x: 0.1, y: 0.19, z: 0.12, color: '#5a3a1a' });
    b.box(0.05, 0.012, 0.03, { x: 0.13, y: 0.2, z: 0.12, rz: -0.4, color: '#4f9a3a' });
  } },
  icon_wood: { build(b) {   // tres troncos apilados
    for (const [x, y] of [[-0.1, 0.07], [0.1, 0.07], [0, 0.2]]) {
      b.cyl(0.075, 0.075, 0.36, 8, { x, y, rx: Math.PI / 2, color: '#8a5a32' });
      b.cyl(0.062, 0.062, 0.005, 8, { x, y, z: 0.181, rx: Math.PI / 2, color: '#e2c08a' });
    }
  } },
  icon_gold: { build(b) {   // montón de pepitas y monedas
    for (const [x, y, z, r] of [[0, 0.08, 0, 0.1], [-0.1, 0.05, 0.05, 0.07], [0.1, 0.05, 0.04, 0.075], [0.02, 0.15, 0.02, 0.07], [-0.04, 0.05, -0.08, 0.06]]) b.ball(r, 0, { x, y, z, color: shade('#f2c43a', (x + z) * 0.5), glow: 0.15 });
    b.cyl(0.07, 0.07, 0.02, 10, { x: 0.12, y: 0.02, z: 0.14, color: '#e8b830' });
  } },
  icon_stone: { build(b) {  // bloques de piedra
    b.box(0.2, 0.12, 0.16, { x: -0.06, y: 0.06, ry: 0.3, color: '#a6a39e' });
    b.box(0.16, 0.11, 0.14, { x: 0.1, y: 0.055, z: 0.06, ry: -0.2, color: '#8f8c87' });
    b.box(0.15, 0.1, 0.12, { x: 0.01, y: 0.17, ry: 0.1, color: '#b8b5b0' });
  } },
  icon_iron: { build(b) {   // lingotes de hierro
    for (const [x, y, z] of [[-0.08, 0.04, 0], [0.08, 0.04, 0], [0, 0.12, 0]]) b.pyramid(0.14, 0.09, 0.3, { x, y: y - 0.04, z, sx: 1, color: shade('#7d838c', x * 0.6) });
    b.box(0.13, 0.075, 0.29, { x: 0, y: 0.13, color: '#8b929b' });
  } },
  icon_pop: { build(b) {    // busto de aldeano con capucha del color de equipo
    b.cyl(0.12, 0.16, 0.18, 8, { y: 0.09, color: 'team' });
    b.ball(0.09, 1, { y: 0.25, color: '#e8b48a' });
    b.cone(0.11, 0.12, 8, { y: 0.34, color: 'team', teamShade: 0.8 });
  } },
};

// ------------------------------------------------------------ iconos de comandos, mejoras y estadísticas
// Se ven casi de frente (ver portrait.js): siluetas gruesas y colores vivos.
const STEEL = '#c8d0da', STEEL_D = '#8a929c', WOOD = '#8a5a32', GOLD = '#f0c040', LEATHER = '#7a4a2a';
function sword(b, o = {}) {
  const r = o.r ?? 0.7, x = o.x || 0, y = o.y ?? 0.26, z = o.z || 0, s = o.s || 1, c = Math.cos(r), sn = Math.sin(r);
  const at = d => ({ x: x - sn * d * s, y: y + c * d * s, z });
  b.box(0.05 * s, 0.34 * s, 0.018 * s, { ...at(0.1), rz: r, color: o.blade || STEEL, glow: o.glow || 0 });
  b.box(0.16 * s, 0.035 * s, 0.04 * s, { ...at(-0.08), rz: r, color: GOLD });
  b.box(0.035 * s, 0.1 * s, 0.03 * s, { ...at(-0.14), rz: r, color: LEATHER });
  b.ball(0.03 * s, 0, { ...at(-0.2), color: GOLD });
}
function shield(b, o = {}) {
  const s = o.s || 1, x = o.x || 0, y = o.y ?? 0.25;
  b.cyl(0.19 * s, 0.19 * s, 0.04, 10, { x, y, z: -0.02, rx: Math.PI / 2, color: o.rim || STEEL_D });
  b.cyl(0.16 * s, 0.16 * s, 0.05, 10, { x, y, z: 0, rx: Math.PI / 2, color: o.face || '#3a6ad8' });
  b.ball(0.05 * s, 0, { x, y, z: 0.03, color: STEEL });
}
function bow(b, o = {}) {
  const x = o.x || 0, y = o.y ?? 0.25;
  for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; b.box(0.03, 0.09, 0.03, { x: x - 0.16 + Math.cos(a) * 0.06 + (1 - Math.cos(a)) * 0.02, y: y + Math.sin(a) * 0.2, rz: -a * 0.55, color: WOOD }); }
  b.box(0.008, 0.38, 0.008, { x: x - 0.06, y, color: '#efe6d2' });
  b.box(0.3, 0.014, 0.014, { x: x - 0.02, y, color: '#6a4a2a' }); b.cone(0.03, 0.06, 4, { x: x + 0.15, y, rz: -Math.PI / 2, color: STEEL });
  b.box(0.04, 0.03, 0.005, { x: x - 0.15, y: y + 0.02, color: '#e04a3a' }); b.box(0.04, 0.03, 0.005, { x: x - 0.15, y: y - 0.02, color: '#e04a3a' });
}
function boot(b, o = {}) {
  const x = o.x || 0;
  b.box(0.12, 0.24, 0.12, { x: x - 0.03, y: 0.2, color: o.c || LEATHER }); b.box(0.24, 0.08, 0.13, { x: x + 0.03, y: 0.06, color: o.c || LEATHER });
  b.box(0.14, 0.04, 0.13, { x: x - 0.03, y: 0.31, color: '#a8743a' });
  if (o.wing) for (let i = 0; i < 3; i++) b.box(0.16 - i * 0.03, 0.035, 0.02, { x: x - 0.15, y: 0.26 - i * 0.05, z: -0.06, rz: 0.4, color: '#f4f4f4' });
}
function tool(b, kind, o = {}) {
  const r = o.r ?? -0.6, s = o.s || 1, x = o.x || 0, y = o.y ?? 0.22, c = Math.cos(r), sn = Math.sin(r);
  const at = d => ({ x: x - sn * d * s, y: y + c * d * s });
  b.box(0.035 * s, 0.42 * s, 0.035 * s, { ...at(0), rz: r, color: WOOD });
  const h = at(0.2);
  if (kind === 'hammer') b.box(0.2 * s, 0.1 * s, 0.1 * s, { ...h, rz: r, color: STEEL_D });
  else if (kind === 'axe') b.extrude([[0, 0.05], [0.13, 0.11], [0.15, -0.09], [0, -0.04]].map(([a, bb]) => [a * s, bb * s]), 0.03, { ...h, rz: r, color: STEEL });
  else if (kind === 'pick') { b.box(0.3 * s, 0.04 * s, 0.04 * s, { ...h, rz: r, color: STEEL_D }); b.cone(0.03 * s, 0.07 * s, 4, { x: h.x + c * 0.17 * s, y: h.y + sn * 0.17 * s, rz: r - Math.PI / 2, color: STEEL }); b.cone(0.03 * s, 0.07 * s, 4, { x: h.x - c * 0.17 * s, y: h.y - sn * 0.17 * s, rz: r + Math.PI / 2, color: STEEL }); }
}
function flag(b, col, o = {}) {
  b.cyl(0.015, 0.015, 0.5, 6, { x: -0.12, y: 0.25, color: WOOD }); b.ball(0.025, 0, { x: -0.12, y: 0.51, color: GOLD });
  b.box(0.24, 0.15, 0.015, { x: 0.005, y: 0.41, color: col || 'team' }); b.cone(0.075, 0.08, 3, { x: 0.15, y: 0.41, rz: -Math.PI / 2, sz: 0.2, color: col || 'team' });
}
Object.assign(MODELS, {
  icon_attack: { icon: true, build(b) { sword(b, { r: 0.7 }); } },
  icon_armor: { icon: true, build(b) { shield(b, { face: '#8a929c', rim: '#5a626c' }); } },
  icon_parmor: { icon: true, build(b) { shield(b, { face: '#a0763a', rim: '#6a4a22' }); b.box(0.3, 0.014, 0.014, { x: 0.02, y: 0.3, z: 0.05, rz: -0.5, color: '#6a4a2a' }); b.cone(0.03, 0.06, 4, { x: 0.15, y: 0.22, z: 0.05, rz: -Math.PI / 2 - 0.5, color: STEEL }); } },
  icon_range: { icon: true, build(b) { bow(b); } },
  icon_speed: { icon: true, build(b) { boot(b, { wing: true }); } },
  cmd_attackmove: { icon: true, build(b) { sword(b, { r: 0.75, x: -0.04 }); b.cone(0.07, 0.12, 3, { x: 0.18, y: 0.14, rz: -Math.PI / 2, sz: 0.3, color: '#e84a3a' }); b.box(0.16, 0.04, 0.02, { x: 0.08, y: 0.14, color: '#e84a3a' }); } },
  cmd_stop: { icon: true, build(b) { shield(b, { face: '#c83a2a' }); b.box(0.16, 0.05, 0.02, { y: 0.25, z: 0.05, color: '#f6ecd2' }); } },
  cmd_build: { icon: true, build(b) { tool(b, 'hammer', { r: -0.7, s: 1.1 }); b.box(0.22, 0.06, 0.12, { x: 0.06, y: 0.03, color: '#b08a5a' }); b.box(0.18, 0.06, 0.12, { x: 0.04, y: 0.09, ry: 0.3, color: '#c49a62' }); } },
  cmd_wall: { icon: true, build(b) { sword(b, { r: 0.7, x: -0.06 }); sword(b, { r: -0.7, x: 0.06 }); shield(b, { s: 0.55, y: 0.22, face: 'team' }); } },
  cmd_road: { icon: true, build(b) { for (let i = 0; i < 9; i++) b.box(0.11, 0.05, 0.1, { x: -0.13 + (i % 3) * 0.13 + ((i / 3 | 0) % 2) * 0.03, y: 0.03 + (i / 3 | 0) * 0.005, z: -0.12 + (i / 3 | 0) * 0.12, color: i % 2 ? '#b8b0a2' : '#a49c8c' }); } },
  cmd_ability: { icon: true, build(b) { b.ball(0.12, 0, { y: 0.25, color: '#ffe070', glow: 0.9 }); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.cone(0.05, 0.14, 4, { x: Math.cos(a) * 0.15, y: 0.25 + Math.sin(a) * 0.15, rz: a - Math.PI / 2, color: '#ffd23a', glow: 0.7 }); } } },
  cmd_back: { icon: true, build(b) { for (let i = 0; i < 6; i++) { const a = Math.PI * (0.1 + i * 0.16); b.box(0.07, 0.07, 0.05, { x: Math.cos(a) * 0.14, y: 0.24 + Math.sin(a) * 0.14, rz: a, color: '#f0c040' }); } b.cone(0.09, 0.14, 3, { x: -0.15, y: 0.18, rz: Math.PI, sz: 0.4, color: '#f0c040' }); } },
  cmd_delete: { icon: true, build(b) { b.box(0.4, 0.09, 0.05, { y: 0.25, rz: 0.78, color: '#d83a2a' }); b.box(0.4, 0.09, 0.05, { y: 0.25, rz: -0.78, color: '#d83a2a' }); } },
  cmd_diplomacy: { icon: true, build(b) { b.cyl(0.05, 0.05, 0.42, 8, { y: 0.4, rz: Math.PI / 2, color: '#e8d8b0' }); b.box(0.38, 0.3, 0.012, { y: 0.24, color: '#f2e6c4' }); b.cyl(0.05, 0.05, 0.42, 8, { y: 0.08, rz: Math.PI / 2, color: '#e8d8b0' }); b.cyl(0.05, 0.05, 0.02, 10, { x: 0.09, y: 0.14, z: 0.015, rx: Math.PI / 2, color: '#c83a2a' }); for (let i = 0; i < 3; i++) b.box(0.22, 0.012, 0.005, { x: -0.04, y: 0.32 - i * 0.05, z: 0.01, color: '#6a5a40' }); } },
  cmd_idle: { icon: true, build(b) { b.lathe([[0.001, 0.42], [0.06, 0.4], [0.09, 0.32], [0.11, 0.2], [0.17, 0.1], [0.18, 0.08]], 10, { color: '#e0b040' }); b.ball(0.04, 0, { y: 0.07, color: '#8a6a2a' }); b.torus(0.03, 0.012, 8, 4, { y: 0.45, color: '#c09030' }); } },
  cmd_rally: { icon: true, build(b) { flag(b); } },
  cmd_repair: { icon: true, build(b) { tool(b, 'hammer', { r: -0.7 }); tool(b, 'axe', { r: 0.7, x: 0.04 }); } },
  cmd_upg_walls: { icon: true, build(b) { b.box(0.3, 0.32, 0.22, { y: 0.16, color: '#a8a39a' }); for (let i = 0; i < 3; i++) b.box(0.07, 0.07, 0.22, { x: -0.11 + i * 0.11, y: 0.355, color: '#b8b3aa' }); b.box(0.1, 0.14, 0.02, { y: 0.07, z: 0.115, color: '#5a3a22' }); b.box(0.012, 0.16, 0.012, { x: 0.12, y: 0.47, color: WOOD }); b.box(0.09, 0.06, 0.01, { x: 0.17, y: 0.52, color: 'team' }); } },
  cmd_ageup: { icon: true, build(b) { b.cyl(0.17, 0.15, 0.12, 10, { y: 0.15, color: GOLD }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; b.cone(0.04, 0.12, 4, { x: Math.cos(a) * 0.14, y: 0.27, z: Math.sin(a) * 0.14, color: GOLD }); b.ball(0.025, 0, { x: Math.cos(a + 0.6) * 0.165, y: 0.15, z: Math.sin(a + 0.6) * 0.165, color: i % 2 ? '#d83a4a' : '#3a8ad8', glow: 0.3 }); } } },
  cmd_upg_armor: { icon: true, build(b) { b.lathe([[0.001, 0.05], [0.15, 0.06], [0.17, 0.2], [0.15, 0.36], [0.1, 0.42], [0.001, 0.43]], 8, { sz: 0.6, color: STEEL }); b.ball(0.07, 0, { x: -0.17, y: 0.38, sz: 0.6, color: STEEL_D }); b.ball(0.07, 0, { x: 0.17, y: 0.38, sz: 0.6, color: STEEL_D }); b.box(0.32, 0.03, 0.2, { y: 0.14, color: GOLD }); } },
  cmd_upg_cav: { icon: true, build(b) { for (let i = 0; i < 9; i++) { const a = Math.PI * (-0.15 + i * 0.16); b.box(0.06, 0.08, 0.05, { x: Math.cos(a) * 0.15, y: 0.22 + Math.sin(a) * 0.15, rz: a, color: STEEL_D }); } for (let i = 0; i < 5; i++) { const a = Math.PI * (0.05 + i * 0.22); b.ball(0.018, 0, { x: Math.cos(a) * 0.15, y: 0.22 + Math.sin(a) * 0.15, z: 0.03, color: '#3a3a3a' }); } } },
  cmd_upg_farm: { icon: true, build(b) { for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.12; b.box(0.02, 0.36, 0.02, { x: Math.sin(a) * 0.12, y: 0.2, rz: -a, color: '#d8b84a' }); b.blob(0.03, 0.06, 0.03, 0, { x: Math.sin(a) * 0.3, y: 0.38 + Math.cos(a) * 0.02, rz: -a, color: '#f0d060' }); } b.box(0.14, 0.04, 0.06, { y: 0.15, color: '#a0763a' }); } },
  cmd_upg_heal: { icon: true, build(b) { b.ball(0.15, 1, { y: 0.17, color: '#3ad870', glow: 0.35 }); b.cyl(0.04, 0.05, 0.12, 8, { y: 0.34, color: '#b8e8d0' }); b.cyl(0.05, 0.05, 0.04, 8, { y: 0.41, color: '#8a5a32' }); b.box(0.1, 0.03, 0.02, { y: 0.18, z: 0.14, color: '#ffffff' }); b.box(0.03, 0.1, 0.02, { y: 0.18, z: 0.14, color: '#ffffff' }); } },
  cmd_upg_loom: { icon: true, build(b) { b.cyl(0.11, 0.11, 0.24, 10, { y: 0.24, color: '#e8e0f0' }); b.cyl(0.15, 0.15, 0.04, 10, { y: 0.1, color: WOOD }); b.cyl(0.15, 0.15, 0.04, 10, { y: 0.38, color: WOOD }); for (let i = 0; i < 4; i++) b.torus(0.112, 0.01, 12, 4, { y: 0.15 + i * 0.06, rx: Math.PI / 2, color: '#c8a0e0' }); } },
  cmd_upg_melee: { icon: true, build(b) { sword(b, { r: 0.6, glow: 0.35, blade: '#ffd0a0' }); b.box(0.3, 0.07, 0.12, { y: 0.03, color: '#4a4a52' }); b.box(0.16, 0.06, 0.1, { y: 0.09, color: '#5a5a62' }); } },
  cmd_upg_mine: { icon: true, build(b) { tool(b, 'pick', { r: -0.5 }); b.ball(0.07, 0, { x: 0.13, y: 0.05, color: GOLD, glow: 0.2 }); } },
  cmd_upg_ranged: { icon: true, build(b) { bow(b); b.box(0.3, 0.014, 0.014, { x: 0.02, y: 0.33, color: '#6a4a2a' }); b.cone(0.03, 0.06, 4, { x: 0.18, y: 0.33, rz: -Math.PI / 2, color: '#ffd0a0', glow: 0.4 }); } },
  cmd_upg_speed: { icon: true, build(b) { boot(b, { wing: true, c: '#5a7ab0' }); } },
  cmd_upg_unique: { icon: true, build(b) { b.ball(0.15, 0, { y: 0.25, sy: 1.4, color: '#b070ff', glow: 0.6 }); b.torus(0.2, 0.02, 14, 4, { y: 0.25, rx: 1.2, color: GOLD }); } },
  cmd_upg_wood: { icon: true, build(b) { tool(b, 'axe', { r: -0.5, s: 1.1 }); b.cyl(0.05, 0.05, 0.25, 7, { x: 0.12, y: 0.05, rx: Math.PI / 2, color: WOOD }); } },
});
