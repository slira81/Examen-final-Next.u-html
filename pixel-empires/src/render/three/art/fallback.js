/* Modelos genéricos de reserva (si un modelo definitivo falta o falla). */
import { UNITS, BLD } from '../../../data/data.js';

const RACE_H = { human: 1, elf: 1.08, dwarf: 0.8, orc: 1.08, giant: 1.8, neutral: 1 };
function skeletonFor(key) {
  const d = UNITS[key] || {};
  if (key === 'animal_chicken') return 'bird';
  if (key.startsWith('animal_')) return 'quadruped';
  if (d.role === 'cav') return 'rider';
  if (d.role === 'siege' && d.race !== 'giant') return 'siege';
  return 'humanoid';
}
function fallbackUnit(key) {
  const d = UNITS[key] || {}, sk = skeletonFor(key), s = RACE_H[d.race] || 1;
  const skin = d.race === 'orc' ? '#7fa65a' : d.race === 'giant' ? '#9fb3c8' : '#e2b08a';
  if (sk === 'humanoid') return {
    skeleton: 'humanoid', anim: { attack: d.range ? 'throw' : 'swing', height: 0.62 * s },
    pivots: { body: [0, 0.27 * s, 0], head: [0, 0.46 * s, 0], armL: [-0.105 * s, 0.43 * s, 0], armR: [0.105 * s, 0.43 * s, 0], handL: [-0.115 * s, 0.25 * s, 0.02], handR: [0.115 * s, 0.25 * s, 0.02], legL: [-0.05 * s, 0.25 * s, 0], legR: [0.05 * s, 0.25 * s, 0] },
    build(b, P) {
      b.part = P.legL; b.box(0.07 * s, 0.25 * s, 0.08 * s, { x: -0.05 * s, y: 0.125 * s, color: '#5a4632' });
      b.part = P.legR; b.box(0.07 * s, 0.25 * s, 0.08 * s, { x: 0.05 * s, y: 0.125 * s, color: '#5a4632' });
      b.part = P.body; b.box(0.19 * s, 0.21 * s, 0.12 * s, { y: 0.35 * s, color: 'team' });
      b.part = P.head; b.ball(0.075 * s, 0, { y: 0.53 * s, color: skin });
      b.part = P.armL; b.box(0.055 * s, 0.2 * s, 0.06 * s, { x: -0.125 * s, y: 0.33 * s, color: skin });
      b.part = P.armR; b.box(0.055 * s, 0.2 * s, 0.06 * s, { x: 0.125 * s, y: 0.33 * s, color: skin });
      b.part = P.handR; b.box(0.02 * s, 0.24 * s, 0.02 * s, { x: 0.125 * s, y: 0.3 * s, z: 0.1 * s, rx: 0.8, color: '#b8bec6' });
    },
  };
  if (sk === 'bird') return { skeleton: 'bird', build(b, P) { b.part = P.body; b.blob(0.06, 0.05, 0.07, 0, { y: 0.12, color: '#f4efe4' }); b.part = P.head; b.ball(0.03, 0, { y: 0.19, z: 0.06, color: '#f4efe4' }); b.part = P.legL; b.box(0.01, 0.08, 0.01, { x: -0.025, y: 0.04, color: '#e0a030' }); b.part = P.legR; b.box(0.01, 0.08, 0.01, { x: 0.025, y: 0.04, color: '#e0a030' }); } };
  if (sk === 'siege') return { skeleton: 'siege', anim: { attack: 'catapult' }, build(b, P) { b.part = P.body; b.box(0.4, 0.12, 0.6, { y: 0.18, color: '#7a5634' }); b.box(0.42, 0.04, 0.1, { y: 0.26, color: 'team' }); for (const [w, x, z] of [['wheelFL', -0.22, 0.18], ['wheelFR', 0.22, 0.18], ['wheelBL', -0.22, -0.18], ['wheelBR', 0.22, -0.18]]) { b.part = P[w]; b.cyl(0.1, 0.1, 0.04, 8, { x, y: 0.1, z, rz: Math.PI / 2, color: '#5a3e24' }); } b.part = P.arm; b.box(0.05, 0.05, 0.5, { y: 0.3, z: 0.05, color: '#8a6440' }); } };
  // cuadrúpedo y jinete
  const big = key === 'animal_bear' || key === 'animal_cow' || key === 'animal_horse' || sk === 'rider' ? 1.3 : 1, k = (d.race === 'giant' ? 1.7 : 1) * big;
  const fur = { animal_sheep: '#eeeae0', animal_pig: '#e9a6a0', animal_cow: '#f2efe8', animal_deer: '#a87a4a', animal_horse: '#8a5a36', animal_boar: '#5a4636', animal_wolf: '#8d8f94', animal_bear: '#5e4330' }[key] || '#8a5a36';
  return {
    skeleton: sk, anim: { walk: sk === 'rider' ? 'gallop' : 'trot', size: k, riderAttack: d.range ? 'bow' : 'thrust' },
    pivots: { body: [0, 0.3 * k, 0], head: [0, 0.34 * k, 0.2 * k], legFL: [-0.07 * k, 0.24 * k, 0.15 * k], legFR: [0.07 * k, 0.24 * k, 0.15 * k], legBL: [-0.07 * k, 0.24 * k, -0.15 * k], legBR: [0.07 * k, 0.24 * k, -0.15 * k], tail: [0, 0.32 * k, -0.22 * k] },
    build(b, P) {
      b.part = P.body; b.blob(0.1 * k, 0.09 * k, 0.2 * k, 0, { y: 0.32 * k, color: fur });
      b.part = P.head; b.box(0.08 * k, 0.08 * k, 0.14 * k, { y: 0.4 * k, z: 0.26 * k, color: fur });
      for (const [l, x, z] of [['legFL', -0.07, 0.15], ['legFR', 0.07, 0.15], ['legBL', -0.07, -0.15], ['legBR', 0.07, -0.15]]) { b.part = P[l]; b.box(0.04 * k, 0.24 * k, 0.04 * k, { x: x * k, y: 0.12 * k, z: z * k, color: '#3a2c20' }); }
      if (sk === 'rider') {
        b.part = P.extra; b.box(0.22 * k, 0.08 * k, 0.24 * k, { y: 0.38 * k, color: 'team' });
        b.part = P.rBody; b.box(0.16, 0.2, 0.11, { y: 0.56, color: 'team' }); b.part = P.rHead; b.ball(0.07, 0, { y: 0.72, color: skin });
        b.part = P.rHandR; b.box(0.02, 0.5, 0.02, { x: 0.11, y: 0.5, z: 0.15, rx: 1.2, color: '#b8bec6' });
      }
    },
  };
}
const ROOF = { human: '#b5523b', elf: '#5f9a4c', dwarf: '#5d646e', orc: '#7a5a3a', giant: '#6f8a54' };
const WALL = { human: '#d8cdb4', elf: '#c8b98a', dwarf: '#9a9690', orc: '#8a6a48', giant: '#a39e94' };
function fallbackBuilding(key) {
  const [race, ...rest] = key.split('_'), type = rest.join('_'), def = BLD[type] || {}, fp = def.fp || (key === 'bandit_camp' ? 3 : 2);
  const wall = WALL[race] || '#b8a888', roof = ROOF[race] || '#7a6a5a';
  if (type === 'wall_post' || type === 'wall') return { build(b) { b.box(0.62, 0.95, 0.62, { y: 0.475, color: wall }); b.box(0.66, 0.06, 0.66, { y: 0.95, color: 'team' }); } };
  if (type === 'wall_seg') return { build(b) { b.box(0.5, 0.8, 0.42, { x: 0.25, y: 0.4, color: wall }); } };
  return {
    fp, build(b) {
      const w = fp * 0.84, h = type === 'farm' ? 0.05 : type === 'tower' ? 2.2 : 0.5 + fp * 0.18;
      if (type === 'farm') { b.box(fp * 0.96, 0.05, fp * 0.96, { y: 0.025, color: '#8a6a3c' }); b.part = 1; for (let i = 0; i < 5; i++) b.box(fp * 0.86, 0.12, 0.12, { y: 0.08, z: -fp * 0.38 + i * fp * 0.19, color: '#d8b84a' }); return; }
      b.box(w, h, w, { y: h / 2, color: wall });
      b.pyramid(w * 1.12, Math.max(0.35, fp * 0.3), w * 1.12, { y: h + Math.max(0.35, fp * 0.3) / 2, color: roof });
      b.box(w * 1.13, 0.06, w * 1.13, { y: h, color: 'team' });
      b.box(0.2, 0.3, 0.04, { y: 0.15, z: w / 2 + 0.01, color: '#4a3424' });
    },
  };
}
const TREE = { tree_pine: '#2f6b3a', tree_snowpine: '#4d7d68', tree_birch: '#8fbf5a', tree_palm: '#5ea24a', tree_willow: '#6f9f56', tree_dead: '#7a6450', tree_elder: '#3f8f78', tree_oak: '#4f9140' };
function fallbackNature(key) {
  if (key.startsWith('tree_')) return { build(b) { b.cyl(0.05, 0.08, 0.5, 5, { y: 0.25, color: '#6b4a2c' }); b.cone(0.36, 0.9, 6, { y: 0.85, color: TREE[key] || '#4f9140', wave: (x, y) => y * 0.5 }); } };
  if (key.startsWith('mine_')) return { build(b) { b.ball(0.3, 0, { y: 0.15, color: key === 'mine_gold' ? '#e7c13d' : key === 'mine_iron' ? '#7b5d50' : key === 'mine_gems' ? '#a46cff' : '#a6a39e' }); } };
  if (key.startsWith('proj_')) return { build(b) { b.box(0.03, 0.03, 0.28, { color: '#e8dcc0', glow: key === 'proj_magic' || key === 'proj_frost' ? 1 : 0 }); } };
  return { build(b) { b.ball(0.12, 0, { y: 0.08, color: '#8a8a7a' }); } };
}
export { fallbackUnit, fallbackBuilding, fallbackNature, skeletonFor };
