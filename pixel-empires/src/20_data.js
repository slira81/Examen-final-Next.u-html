/* =====================================================================
   Datos del juego: recursos, razas, unidades, edificios, tecnologías.
   Unidades de tiempo en segundos, velocidades en px/s (tile = 16 px),
   alcances en tiles.  Daño = max(1, ataque - armadura) + bonus de clase.
   ===================================================================== */
'use strict';
const T = 16;
const RES = ['food', 'wood', 'gold', 'stone', 'iron'];
const RES_N = { food: 'Comida', wood: 'Madera', gold: 'Oro', stone: 'Piedra', iron: 'Hierro' };
const GAIA = 7, HOSTILE = 8;      // animales neutrales / criaturas hostiles
const AGES = ['Era del Asentamiento', 'Era del Reino', 'Era del Imperio'];

// Experiencia: umbrales de XP acumulada para niveles 1..5 (progresivo, ver README)
const LEVEL_XP = [0, 100, 260, 480, 800];
const LEVEL_MAX = 5;
const levelMods = L => ({ hp: 1 + 0.10 * (L - 1), atk: 1 + 0.08 * (L - 1), arm: L >= 3 ? (L >= 5 ? 2 : 1) : 0, regen: L >= 4 ? 0.4 * (L - 3) : 0 });

const RACES = {
  human: {
    n: 'Humanos', adj: 'humano', color: '#3a6fe0',
    desc: 'Equilibrados y disciplinados. Caballería pesada, magos y catapultas.',
    bonus: ['Edificios se construyen 15% más rápido', 'Tecnología única: Disciplina (+15% vida militar)'],
    build: 1.15, unique: { n: 'Disciplina', d: '+15% de vida para toda la unidad militar', hp: 0.15 },
    names: { tc: 'Centro Urbano', castle: 'Castillo' },
  },
  elf: {
    n: 'Elfos', adj: 'élfico', color: '#4fae5a',
    desc: 'Ágiles y precisos. Arqueros de largo alcance, druidas sanadores.',
    bonus: ['Unidades 8% más rápidas', 'Recolectan madera 25% más rápido', 'Tecnología única: Agilidad élfica (+15% velocidad de ataque)'],
    speed: 1.08, unique: { n: 'Agilidad élfica', d: '+15% velocidad de ataque', rate: 0.87 },
    names: { tc: 'Árbol Madre', castle: 'Santuario Lunar' },
  },
  dwarf: {
    n: 'Enanos', adj: 'enano', color: '#c98a3a',
    desc: 'Resistentes y tozudos. Armaduras pesadas, pólvora y minería.',
    bonus: ['+1 armadura en toda la unidad militar', 'Minería 25% más rápida', 'Tecnología única: Runas de acero (+2 armadura)'],
    speed: 0.92, unique: { n: 'Runas de acero', d: '+2 armadura cuerpo a cuerpo y a distancia', arm: 2 },
    names: { tc: 'Gran Salón', castle: 'Fortaleza de la Montaña' },
  },
  orc: {
    n: 'Orcos', adj: 'orco', color: '#6f9a3a',
    desc: 'Brutales y numerosos. Lobos, chamanes y arietes.',
    bonus: ['Unidades cuestan 10% menos comida', '+10% de vida', 'Tecnología única: Sed de sangre (+15% ataque)'],
    foodCost: 0.9, hp: 1.10, unique: { n: 'Sed de sangre', d: '+15% de ataque', atk: 0.15 },
    names: { tc: 'Fortín del Clan', castle: 'Bastión de Guerra' },
  },
  giant: {
    n: 'Gigantes', adj: 'gigante', color: '#8fa0b0',
    desc: 'Pocos pero colosales. Cada unidad vale por varias.',
    bonus: ['Unidades enormes con mucha vida y daño', 'Edificios +30% de vida', 'Tecnología única: Piel de piedra (+20% vida)'],
    bldHp: 1.3, unique: { n: 'Piel de piedra', d: '+20% de vida', hp: 0.20 },
    names: { tc: 'Círculo de Piedra', castle: 'Trono del Titán' },
  },
};
const RACE_KEYS = Object.keys(RACES);
const ROLES = ['worker', 'inf', 'pike', 'ranged', 'cav', 'special', 'siege', 'general'];

// Valores por defecto de cada unidad
const U_DEF = { hp: 50, atk: 5, arm: 0, parm: 0, range: 0, rate: 1.6, sp: 34, cost: {}, time: 15, pop: 1, los: 6, bonus: {}, size: 5, age: 1 };
const UNITS = {};
function defUnits(race, list) {
  for (const role in list) UNITS[race + '_' + role] = Object.assign({}, U_DEF, { race, role, key: race + '_' + role }, list[role]);
}
const AT = { worker: 'tc', inf: 'barracks', pike: 'barracks', ranged: 'range', cav: 'stable', special: 'temple', siege: 'workshop', general: 'castle' };
const AGE_OF = { worker: 1, inf: 1, pike: 1, ranged: 2, cav: 2, special: 2, siege: 3, general: 3 };

defUnits('human', {
  worker: { n: 'Aldeano', hp: 25, atk: 3, rate: 1.5, cost: { food: 50 }, time: 10, los: 4, carry: 10 },
  inf: { n: 'Espadachín', hp: 70, atk: 8, arm: 1, parm: 1, cost: { food: 60, iron: 20 }, time: 14, bonus: { building: 3 } },
  pike: { n: 'Lancero', hp: 55, atk: 4, rate: 2, cost: { food: 35, wood: 25 }, time: 12, bonus: { cav: 12, general: 4 } },
  ranged: { n: 'Arquero', hp: 35, atk: 5, range: 5, rate: 2, sp: 33, cost: { wood: 25, gold: 45 }, time: 15, proj: 'proj_arrow', bonus: { pike: 2, inf: 1 } },
  cav: { n: 'Caballero', hp: 110, atk: 10, arm: 2, parm: 2, rate: 1.8, sp: 55, cost: { food: 70, gold: 50, iron: 30 }, time: 22, size: 7, los: 7, bonus: { ranged: 6, siege: 8 } },
  special: { n: 'Mago', hp: 40, atk: 9, range: 6, rate: 3, sp: 32, cost: { food: 40, gold: 120 }, time: 22, proj: 'proj_magic', splash: 18, bonus: { inf: 3, pike: 3 } },
  siege: { n: 'Catapulta', hp: 160, atk: 40, parm: 6, range: 8, minr: 2, rate: 5, sp: 18, cost: { wood: 180, gold: 90, iron: 40 }, time: 30, pop: 3, size: 8, proj: 'proj_rock', splash: 22, bonus: { building: 80 } },
  general: { n: 'Rey Paladín', hp: 420, atk: 18, arm: 4, parm: 4, rate: 1.5, sp: 40, cost: { food: 250, gold: 250, iron: 100 }, time: 45, pop: 2, los: 8, size: 6, unique: true,
    aura: { n: 'Aura de protección', d: '+2 armadura y regeneración a los aliados cercanos', arm: 2, regen: 1.2, r: 5 },
    ability: { n: 'Bendición', d: 'Cura 60 de vida a los aliados cercanos', cd: 30, type: 'heal', v: 60, r: 5 } },
});
defUnits('elf', {
  worker: { n: 'Recolector élfico', hp: 24, atk: 3, rate: 1.5, sp: 36, cost: { food: 50 }, time: 10, los: 5, carry: 10, gather: { wood: 1.25, food: 1.1 } },
  inf: { n: 'Danzante de espadas', hp: 55, atk: 7, parm: 1, rate: 1.0, sp: 42, cost: { food: 55, gold: 30 }, time: 14, bonus: { ranged: 3 } },
  pike: { n: 'Guardián del bosque', hp: 60, atk: 6, arm: 1, parm: 1, rate: 1.8, sp: 36, cost: { food: 40, wood: 30 }, time: 13, bonus: { cav: 14, general: 4 } },
  ranged: { n: 'Arquero élfico', hp: 32, atk: 6, range: 7, rate: 1.8, sp: 35, cost: { wood: 30, gold: 45 }, time: 15, los: 8, proj: 'proj_arrow', bonus: { inf: 2, pike: 2 } },
  cav: { n: 'Jinete de ciervo', hp: 85, atk: 6, range: 5, rate: 1.6, sp: 58, cost: { food: 60, gold: 70 }, time: 22, size: 7, los: 8, proj: 'proj_arrow', bonus: { siege: 4, inf: 1 } },
  special: { n: 'Druida', hp: 45, atk: 3, range: 5, rate: 2, sp: 34, cost: { food: 60, gold: 100 }, time: 22, proj: 'proj_magic', heal: { v: 7, rate: 1.5, r: 5 } },
  siege: { n: 'Lanzavirotes', hp: 120, atk: 22, parm: 5, range: 9, rate: 3.5, sp: 22, cost: { wood: 150, gold: 80 }, time: 28, pop: 3, size: 8, proj: 'proj_bolt', bonus: { building: 25, cav: 10, inf: 6 } },
  general: { n: 'Reina del Bosque', hp: 330, atk: 14, arm: 2, parm: 4, range: 7, rate: 1.2, sp: 44, cost: { food: 250, gold: 280, iron: 40 }, time: 45, pop: 2, los: 9, unique: true, proj: 'proj_arrow',
    aura: { n: 'Canto del bosque', d: '+15% velocidad de ataque a los aliados cercanos', rate: 0.85, r: 5 },
    ability: { n: 'Lluvia de flechas', d: 'Una lluvia de flechas daña a todos los enemigos de una zona', cd: 25, type: 'volley', v: 14, r: 3 } },
});
defUnits('dwarf', {
  worker: { n: 'Minero', hp: 30, atk: 3, arm: 1, rate: 1.5, sp: 31, cost: { food: 50 }, time: 10, los: 4, carry: 12, gather: { gold: 1.25, stone: 1.3, iron: 1.3 } },
  inf: { n: 'Hachero', hp: 85, atk: 9, arm: 2, parm: 2, rate: 1.8, sp: 30, cost: { food: 60, iron: 30 }, time: 15, bonus: { building: 4 } },
  pike: { n: 'Alabardero', hp: 70, atk: 6, arm: 3, parm: 4, rate: 2, sp: 30, cost: { food: 40, wood: 20, iron: 20 }, time: 14, bonus: { cav: 14, general: 4 } },
  ranged: { n: 'Ballestero', hp: 45, atk: 7, arm: 1, parm: 1, range: 6, rate: 2.6, sp: 29, cost: { wood: 30, gold: 40, iron: 15 }, time: 16, proj: 'proj_bolt', bonus: { inf: 2 } },
  cav: { n: 'Jinete de carnero', hp: 120, atk: 9, arm: 3, parm: 3, rate: 1.8, sp: 46, cost: { food: 70, gold: 40, iron: 40 }, time: 22, size: 7, bonus: { ranged: 5, building: 6 } },
  special: { n: 'Atronador', hp: 55, atk: 20, arm: 1, parm: 1, range: 5, rate: 4.5, sp: 29, cost: { food: 50, gold: 80, iron: 40 }, time: 22, proj: 'proj_cannonball', ap: true, bonus: { cav: 6, general: 6 } },
  siege: { n: 'Bombarda', hp: 200, atk: 60, parm: 8, range: 9, minr: 2, rate: 6, sp: 16, cost: { wood: 150, gold: 120, iron: 80 }, time: 32, pop: 3, size: 8, proj: 'proj_cannonball', splash: 24, bonus: { building: 120 } },
  general: { n: 'Rey de la Montaña', hp: 480, atk: 20, arm: 6, parm: 6, rate: 1.8, sp: 34, cost: { food: 250, gold: 200, iron: 160 }, time: 45, pop: 2, los: 8, unique: true,
    aura: { n: 'Muro de escudos', d: '+2 armadura a los aliados cercanos', arm: 2, r: 5 },
    ability: { n: 'Martillo sísmico', d: 'Golpea el suelo: daño en área y aturde', cd: 25, type: 'stomp', v: 40, r: 3, stun: 2.5 } },
});
defUnits('orc', {
  worker: { n: 'Peón orco', hp: 30, atk: 4, rate: 1.5, cost: { food: 45 }, time: 10, los: 4, carry: 10 },
  inf: { n: 'Bruto', hp: 85, atk: 9, rate: 1.8, cost: { food: 65, iron: 10 }, time: 14, bonus: { building: 4 } },
  pike: { n: 'Lancero salvaje', hp: 60, atk: 5, rate: 1.8, sp: 36, cost: { food: 40, wood: 20 }, time: 12, bonus: { cav: 12, general: 4 } },
  ranged: { n: 'Lanzahachas', hp: 45, atk: 7, range: 4, rate: 2.2, cost: { food: 30, wood: 20, iron: 15 }, time: 14, proj: 'proj_axe', bonus: { inf: 2 } },
  cav: { n: 'Jinete de lobo', hp: 100, atk: 9, arm: 1, parm: 1, rate: 1.3, sp: 60, cost: { food: 80, gold: 40 }, time: 20, size: 7, los: 7, bonus: { ranged: 6, worker: 4 } },
  special: { n: 'Chamán', hp: 45, atk: 8, range: 5, rate: 2.5, sp: 33, cost: { food: 50, gold: 110 }, time: 22, proj: 'proj_lightning', chain: 2 },
  siege: { n: 'Ariete', hp: 300, atk: 4, arm: 2, parm: 14, rate: 3, sp: 22, cost: { wood: 160, iron: 30 }, time: 26, pop: 3, size: 8, onlyBld: true, bonus: { building: 70 } },
  general: { n: 'Caudillo', hp: 500, atk: 22, arm: 3, parm: 3, rate: 1.6, sp: 40, cost: { food: 260, gold: 220, iron: 90 }, time: 45, pop: 2, los: 8, unique: true, splash: 12,
    aura: { n: 'Furia del clan', d: '+3 de ataque a los aliados cercanos', atk: 3, r: 5 },
    ability: { n: 'Grito de guerra', d: 'Aliados cercanos +30% velocidad y ataque por 8 s', cd: 30, type: 'warcry', v: 0.3, r: 6, dur: 8 } },
});
defUnits('giant', {
  worker: { n: 'Recolector gigante', hp: 55, atk: 5, rate: 1.8, sp: 30, cost: { food: 65 }, time: 13, los: 5, carry: 20, size: 7, gather: { food: 1.3, wood: 1.35, gold: 1.25, stone: 1.4, iron: 1.25 } },
  inf: { n: 'Guerrero gigante', hp: 180, atk: 16, arm: 1, parm: 1, rate: 2.2, sp: 28, cost: { food: 110, iron: 20 }, time: 24, pop: 2, size: 8, splash: 10, bonus: { building: 6 } },
  pike: { n: 'Muro de piedra', hp: 240, atk: 8, arm: 4, parm: 6, rate: 2.4, sp: 24, cost: { food: 90, stone: 40 }, time: 24, pop: 2, size: 8, bonus: { cav: 16, general: 6 } },
  ranged: { n: 'Lanzarrocas', hp: 120, atk: 14, range: 6, rate: 3, sp: 26, cost: { food: 60, stone: 40, gold: 40 }, time: 24, pop: 2, size: 8, proj: 'proj_rock', splash: 14, bonus: { building: 8 } },
  cav: { n: 'Mamut de guerra', hp: 420, atk: 18, arm: 3, parm: 2, rate: 2.4, sp: 36, cost: { food: 200, gold: 100, iron: 30 }, time: 34, pop: 4, size: 10, los: 7, splash: 14, bonus: { building: 10, inf: 4 } },
  special: { n: 'Gigante de escarcha', hp: 200, atk: 10, range: 3, rate: 2.6, sp: 27, cost: { food: 100, gold: 120 }, time: 26, pop: 2, size: 8, proj: 'proj_frost', splash: 16, slow: 0.4 },
  siege: { n: 'Rompemuros', hp: 300, atk: 10, arm: 2, parm: 6, rate: 3, sp: 24, cost: { food: 120, wood: 100, iron: 40 }, time: 30, pop: 3, size: 8, bonus: { building: 90 } },
  general: { n: 'Rey Titán', hp: 800, atk: 30, arm: 4, parm: 4, rate: 2.2, sp: 30, cost: { food: 300, gold: 250, iron: 120 }, time: 50, pop: 3, los: 9, size: 10, unique: true, splash: 16,
    aura: { n: 'Presencia titánica', d: '+1 armadura y regeneración rápida a los aliados cercanos', arm: 1, regen: 2, r: 5 },
    ability: { n: 'Pisotón', d: 'Sacude la tierra: daño en área y aturde', cd: 28, type: 'stomp', v: 55, r: 3.5, stun: 2 } },
});
for (const k in UNITS) { const u = UNITS[k]; u.at = AT[u.role]; u.age = AGE_OF[u.role]; }

// Neutrales y fauna
defUnits('neutral', {
  bandit: { n: 'Bandido', hp: 50, atk: 6, rate: 1.6, los: 6 },
  bandit_archer: { n: 'Bandido arquero', hp: 35, atk: 4, range: 5, rate: 2, los: 7, proj: 'proj_arrow' },
  goblin: { n: 'Goblin', hp: 28, atk: 4, rate: 1.1, sp: 40, los: 6 },
  ogre: { n: 'Ogro', hp: 420, atk: 20, arm: 2, parm: 2, rate: 2.4, sp: 28, size: 9, splash: 12, los: 6 },
});
const ANIMALS = {
  sheep: { n: 'Oveja', hp: 10, food: 100, sp: 20, herd: true },
  pig: { n: 'Cerdo', hp: 14, food: 120, sp: 20, herd: true },
  cow: { n: 'Vaca', hp: 20, food: 180, sp: 16, herd: true },
  chicken: { n: 'Gallina', hp: 5, food: 40, sp: 18, herd: true },
  deer: { n: 'Ciervo', hp: 15, food: 120, sp: 48, flee: true },
  horse: { n: 'Caballo salvaje', hp: 40, food: 150, sp: 56, flee: true },
  boar: { n: 'Jabalí', hp: 70, food: 200, sp: 38, atk: 6, fight: true },
  wolf: { n: 'Lobo', hp: 40, food: 0, sp: 50, atk: 5, hostile: true },
  bear: { n: 'Oso', hp: 130, food: 220, sp: 40, atk: 11, hostile: true, arm: 1 },
};
for (const k in ANIMALS) {
  const a = ANIMALS[k];
  UNITS['animal_' + k] = Object.assign({}, U_DEF, { race: 'animal', role: 'animal', key: 'animal_' + k, animal: k, atk: a.atk || 0, rate: 1.4, los: 5, size: k === 'cow' || k === 'bear' || k === 'horse' ? 7 : 5 }, a);
}

// --------------------------------------------------------------- edificios
const BLD = {
  tc: { n: 'Centro Urbano', fp: 4, hp: 2400, cost: { wood: 275, stone: 100 }, time: 90, pop: 5, drop: RES, train: ['worker'], techs: ['loom', 'age2', 'age3'], los: 8, atk: 5, range: 6, rate: 2, arm: 3, parm: 8, age: 1, garrison: 15 },
  house: { n: 'Casa', fp: 2, hp: 550, cost: { wood: 30 }, time: 15, pop: 5, los: 3, age: 1 },
  barracks: { n: 'Cuartel', fp: 3, hp: 1200, cost: { wood: 175 }, time: 40, train: ['inf', 'pike'], techs: ['march'], los: 5, age: 1 },
  mill: { n: 'Molino', fp: 2, hp: 600, cost: { wood: 100 }, time: 25, drop: ['food'], techs: ['plow'], los: 4, age: 1 },
  lumber: { n: 'Aserradero', fp: 2, hp: 600, cost: { wood: 100 }, time: 25, drop: ['wood'], techs: ['axe', 'axe2'], los: 4, age: 1 },
  mine: { n: 'Campamento minero', fp: 2, hp: 600, cost: { wood: 100 }, time: 25, drop: ['gold', 'stone', 'iron'], techs: ['pick', 'pick2'], los: 4, age: 1 },
  farm: { n: 'Granja', fp: 3, hp: 300, cost: { wood: 60 }, time: 15, los: 2, age: 1, flat: true },
  range: { n: 'Galería de tiro', fp: 3, hp: 1200, cost: { wood: 175 }, time: 40, train: ['ranged'], techs: ['ranged0'], los: 5, age: 2 },
  stable: { n: 'Establo', fp: 3, hp: 1200, cost: { wood: 175 }, time: 40, train: ['cav'], techs: ['cavspeed'], los: 5, age: 2 },
  temple: { n: 'Templo', fp: 3, hp: 1200, cost: { wood: 100, stone: 100, gold: 50 }, time: 50, train: ['special'], techs: ['heal'], los: 6, age: 2 },
  forge: { n: 'Herrería', fp: 2, hp: 900, cost: { wood: 150 }, time: 40, techs: ['melee1', 'ranged1', 'armor1', 'melee2', 'ranged2', 'armor2'], los: 4, age: 2 },
  market: { n: 'Mercado', fp: 3, hp: 1200, cost: { wood: 175 }, time: 50, los: 5, age: 2, market: true },
  tower: { n: 'Torre de arqueros', fp: 2, hp: 1000, cost: { wood: 50, stone: 125 }, time: 45, los: 9, atk: 7, range: 7, rate: 2, arm: 2, parm: 8, age: 2, garrison: 5 },
  wall: { n: 'Muro', fp: 1, hp: 1500, cost: { stone: 6 }, time: 5, los: 2, age: 2, arm: 6, parm: 12, wall: true },
  gate: { n: 'Puerta', fp: 1, hp: 2000, cost: { stone: 25 }, time: 12, los: 3, age: 2, arm: 6, parm: 12, gate: true },
  workshop: { n: 'Taller de asedio', fp: 3, hp: 1200, cost: { wood: 200 }, time: 45, train: ['siege'], los: 5, age: 3 },
  castle: { n: 'Castillo', fp: 4, hp: 4200, cost: { stone: 600, wood: 200 }, time: 120, train: ['general'], techs: ['unique', 'masonry'], los: 10, atk: 11, range: 8, rate: 1.5, arm: 6, parm: 12, age: 3, garrison: 20 },
};
for (const k in BLD) { BLD[k].key = k; BLD[k].arm ??= 2; BLD[k].parm ??= 7; }
const BUILD_MENU = ['house', 'farm', 'mill', 'lumber', 'mine', 'barracks', 'range', 'stable', 'temple', 'forge', 'market', 'tower', 'wall', 'gate', 'workshop', 'castle', 'tc'];

// --------------------------------------------------------------- tecnologías
// fx: efectos aplicados por el motor (ver game.applyTech)
const TECHS = {
  loom: { n: 'Telar', d: 'Aldeanos: +15 vida, +1/+2 armadura', cost: { food: 50 }, time: 20, icon: 'cmd_upg_loom' },
  age2: { n: 'Avanzar a la Era del Reino', d: 'Desbloquea galería de tiro, establo, templo, herrería, mercado, torres y muros. Requiere 2 edificios de la era actual.', cost: { food: 500 }, time: 60, icon: 'cmd_ageup', age: 1, toAge: 2 },
  age3: { n: 'Avanzar a la Era del Imperio', d: 'Desbloquea taller de asedio, castillo y general. Requiere 2 edificios de la Era del Reino.', cost: { food: 800, gold: 200 }, time: 90, icon: 'cmd_ageup', age: 2, toAge: 3 },
  axe: { n: 'Hacha de doble filo', d: 'Madera +20%', cost: { food: 100, wood: 50 }, time: 25, icon: 'cmd_upg_wood' },
  axe2: { n: 'Sierra de arco', d: 'Madera +20%', cost: { food: 150, wood: 100 }, time: 35, icon: 'cmd_upg_wood', age: 2, req: 'axe' },
  pick: { n: 'Pico de hierro', d: 'Oro, piedra y hierro +20%', cost: { food: 100, wood: 75 }, time: 25, icon: 'cmd_upg_mine' },
  pick2: { n: 'Minería profunda', d: 'Oro, piedra y hierro +20%', cost: { food: 200, wood: 150 }, time: 35, icon: 'cmd_upg_mine', age: 2, req: 'pick' },
  plow: { n: 'Arado pesado', d: 'Granjas +50% comida y +15% velocidad', cost: { food: 125, wood: 125 }, time: 30, icon: 'cmd_upg_farm' },
  march: { n: 'Marcha forzada', d: 'Infantería +12% velocidad', cost: { food: 150, gold: 50 }, time: 30, icon: 'cmd_upg_speed', age: 2 },
  ranged0: { n: 'Arco compuesto', d: 'Unidades a distancia +1 alcance', cost: { wood: 100, gold: 75 }, time: 30, icon: 'cmd_upg_ranged', age: 2 },
  cavspeed: { n: 'Herraduras', d: 'Caballería +10% velocidad', cost: { food: 150, iron: 50 }, time: 30, icon: 'cmd_upg_cav', age: 2 },
  heal: { n: 'Sanación', d: 'Unidades especiales +30% efecto; las unidades cerca del templo se curan', cost: { gold: 200 }, time: 40, icon: 'cmd_upg_heal', age: 2 },
  melee1: { n: 'Forja', d: 'Cuerpo a cuerpo +1 ataque', cost: { food: 150, iron: 50 }, time: 35, icon: 'cmd_upg_melee', age: 2 },
  melee2: { n: 'Fundición', d: 'Cuerpo a cuerpo +2 ataque', cost: { food: 220, iron: 120 }, time: 45, icon: 'cmd_upg_melee', age: 3, req: 'melee1' },
  ranged1: { n: 'Flechas punzantes', d: 'Distancia +1 ataque y torres +1', cost: { food: 100, gold: 50 }, time: 35, icon: 'cmd_upg_ranged', age: 2 },
  ranged2: { n: 'Puntas de hierro', d: 'Distancia +2 ataque y torres +2', cost: { food: 200, gold: 100, iron: 50 }, time: 45, icon: 'cmd_upg_ranged', age: 3, req: 'ranged1' },
  armor1: { n: 'Cota de malla', d: 'Militares +1/+1 armadura', cost: { food: 100, iron: 75 }, time: 35, icon: 'cmd_upg_armor', age: 2 },
  armor2: { n: 'Armadura de placas', d: 'Militares +2/+2 armadura', cost: { food: 200, iron: 150 }, time: 45, icon: 'cmd_upg_armor', age: 3, req: 'armor1' },
  masonry: { n: 'Mampostería', d: 'Edificios +20% vida, torres +2 ataque', cost: { stone: 150, wood: 100 }, time: 40, icon: 'cmd_upg_walls', age: 3 },
  unique: { n: 'Tecnología única', d: '', cost: { food: 300, gold: 300 }, time: 50, icon: 'cmd_upg_unique', age: 3 },
};

// Precios del mercado (oro por 100 unidades) y tributo
const MARKET_BASE = { food: 100, wood: 100, stone: 130, iron: 150 };

const MAP_TYPES = {
  continental: { n: 'Continental', water: 0.30, forest: 0.62, rock: 0.84, snow: false, river: false },
  forest: { n: 'Bosques profundos', water: 0.24, forest: 0.52, rock: 0.88, snow: false, river: false },
  mountains: { n: 'Montañas', water: 0.22, forest: 0.64, rock: 0.70, snow: true, river: false },
  rivers: { n: 'Ríos', water: 0.20, forest: 0.62, rock: 0.86, snow: false, river: true },
  tundra: { n: 'Tundra', water: 0.26, forest: 0.62, rock: 0.80, snow: true, river: true, cold: true },
};
const DIFFICULTY = {
  easy: { n: 'Fácil', gather: 0.8, think: 3.0, wave: 1.6, firstAttack: 1200 },
  normal: { n: 'Normal', gather: 1.0, think: 2.0, wave: 1.0, firstAttack: 780 },
  hard: { n: 'Difícil', gather: 1.2, think: 1.4, wave: 0.8, firstAttack: 540 },
};
const PLAYER_NAMES = {
  human: ['Reino de Valdoria', 'Casa Ardent', 'Corona de Albion'],
  elf: ['Bosque de Lothren', 'Corte Sylvana', 'Hojas de Eldar'],
  dwarf: ['Clan Martillohierro', 'Fortaleza Kazdur', 'Hermandad Barbagris'],
  orc: ['Horda Colmillo Negro', 'Clan Calavera Roja', 'Tribu Garra de Lobo'],
  giant: ['Tronos de Jotunheim', 'Clan Rompecumbres', 'Titanes de Hielo'],
};
