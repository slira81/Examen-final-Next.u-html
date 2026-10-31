/* =====================================================================
   Simulación: entidades, órdenes, movimiento, combate, experiencia,
   recolección, construcción, producción, tecnologías y eliminación.
   ===================================================================== */
'use strict';
let G = null;
const RES_TYPE = { tree: 'wood', berry: 'food', fish: 'food', carcass: 'food', gold: 'gold', gems: 'gold', stone: 'stone', iron: 'iron' };
const GATHER_RATE = { tree: 0.56, berry: 0.46, fish: 0.50, carcass: 0.68, gold: 0.47, gems: 0.64, stone: 0.45, iron: 0.42, farm: 0.46 };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const tileOf = v => Math.floor(v / T);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const isAnimal = u => u.def.role === 'animal';
const isMil = u => u.def.role !== 'worker' && u.def.role !== 'animal' && u.team < 8;
const isPlayer = t => t >= 0 && t < 8 && G.players[t];
function isAlly(a, b) { return a === b || (a < 8 && b < 8 && G.players[a] && G.players[b] && G.stance[a][b] === 'ally'); }
function isEnemy(a, b) {
  if (a === b) return false;
  if (a === GAIA || b === GAIA) return false;
  if (a === HOSTILE || b === HOSTILE) return true;
  return G.stance[a][b] === 'enemy';
}
const canHarm = (a, b) => a !== b && !isAlly(a, b) && !(a === GAIA && b === GAIA);
function rectOf(e) {
  if (e.k === 'u') { const s = e.def.size * 0.5; return { x0: e.x - s, y0: e.y - s, x1: e.x + s, y1: e.y + s }; }
  if (e.k === 'b') return { x0: e.tx * T, y0: e.ty * T, x1: (e.tx + e.fp) * T, y1: (e.ty + e.fp) * T };
  return { x0: e.tx * T, y0: e.ty * T, x1: (e.tx + 1) * T, y1: (e.ty + 1) * T };
}
const distRect = (px, py, r) => Math.hypot(Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.y0 - py, 0, py - r.y1));
const centerOf = e => e.k === 'u' || e.k === 'p' ? { x: e.x, y: e.y } : e.k === 'b' ? { x: (e.tx + e.fp / 2) * T, y: (e.ty + e.fp / 2) * T } : { x: e.tx * T + 8, y: e.ty * T + 8 };
const costSum = c => Object.values(c || {}).reduce((a, b) => a + b, 0);

// --------------------------------------------------------------- partida
function newGame(cfg) {
  G = {
    cfg, time: 0, players: [], units: [], blds: [], treasures: [], projs: [], fx: [], texts: [], corpses: [], decals: [],
    nextId: 1, byId: new Map(), human: cfg.observer ? -1 : 0, sel: [], groups: {}, msgs: [], over: false, speed: 1,
    stance: [], rel: [], pings: [], shake: 0, alerts: { t: -99 }, statVer: 0,
  };
  G.msg = gameMsg;
  G.map = generateMap(cfg);
  pfInit(G.map.W, G.map.H); sgInit(G.map.W, G.map.H);
  G.resBy = {}; for (const r of G.map.resList) (G.resBy[r.kind] = G.resBy[r.kind] || []).push(r);
  G.vis = new Uint8Array(G.map.W * G.map.H);
  const startRes = cfg.resources === 'low' ? 100 : cfg.resources === 'high' ? 500 : 200;
  cfg.players.forEach((pc, i) => {
    const p = {
      id: i, name: pc.name, race: pc.race, color: pc.color, human: !!pc.human, teamGroup: pc.team,
      res: { food: startRes, wood: startRes, gold: Math.round(startRes / 2), stone: Math.round(startRes / 2), iron: Math.round(startRes / 4) },
      age: 1, techs: new Set(), researching: new Set(), alive: true, generalId: null, relics: 0, popCap: 0, pop: 0,
      stats: { trained: 0, killed: 0, lost: 0, built: 0, gathered: { food: 0, wood: 0, gold: 0, stone: 0, iron: 0 }, maxLevel: 1, razed: 0 },
      market: Object.assign({}, MARKET_BASE), diff: pc.diff || cfg.diff || 'normal',
    };
    G.players.push(p);
  });
  // diplomacia inicial
  const n = G.players.length;
  for (let a = 0; a < 9; a++) { G.stance[a] = []; G.rel[a] = []; for (let b = 0; b < 9; b++) { const same = a < n && b < n && G.players[a].teamGroup > 0 && G.players[a].teamGroup === G.players[b].teamGroup; G.stance[a][b] = a === b ? 'ally' : same ? 'ally' : 'enemy'; G.rel[a][b] = same ? 80 : -25 + Math.floor(G.map.rnd() * 40); } }
  G.fought = {};
  // bases iniciales
  G.players.forEach((p, i) => {
    const s = G.map.starts[i];
    const tc = placeBuilding(i, 'tc', s.x - 2, s.y - 2, [], true);
    for (let k = 0; k < 4; k++) spawnUnit(p.race + '_worker', i, (s.x - 2 + k) * T + 8, (s.y + 3) * T + 8);
    spawnUnit(p.race + '_inf', i, (s.x + 3) * T + 8, (s.y + 2) * T + 8);
    placeBuilding(i, 'house', s.x - 6, s.y - 1, [], true);
    if (p.race === 'giant') placeBuilding(i, 'house', s.x - 6, s.y + 2, [], true);
  });
  // fauna
  for (const f of G.map.fauna) {
    const a = ANIMALS[f.kind]; let team = a.hostile ? HOSTILE : GAIA;
    if (f.owner) team = G.map.starts.indexOf(f.owner);
    const u = spawnUnit('animal_' + f.kind, team, f.x * T + 8, f.y * T + 8); u.home = { x: u.x, y: u.y };
  }
  worldInit();
  if (G.human >= 0) { const s = G.map.starts[G.human]; G.cam = { x: s.x * T, y: s.y * T }; }
  else G.cam = { x: G.map.W * T / 2, y: G.map.H * T / 2 };
  aiInit();
  updatePop();
  return G;
}

function gameMsg(text, color, opts = {}) {
  G.msgs.push({ text, color: color || '#f4e9c8', t: G.time, real: performance.now() });
  if (G.msgs.length > 60) G.msgs.shift();
  if (opts.ping) G.pings.push({ x: opts.ping.x, y: opts.ping.y, t: 0 });
  if (opts.sound) sfx(opts.sound);
}

// --------------------------------------------------------------- estadísticas
function uStats(u) {
  const d = u.def, p = isPlayer(u.team) ? G.players[u.team] : null, L = levelMods(u.lvl || 1);
  let atk = d.atk * L.atk, arm = d.arm + L.arm, parm = d.parm + L.arm, rate = d.rate, sp = d.sp, range = d.range, hpMul = L.hp, hpAdd = 0;
  if (p && !isAnimal(u)) {
    const r = RACES[p.race], mil = d.role !== 'worker', tc = p.techs;
    if (r.speed) sp *= r.speed;
    if (r.hp) hpMul *= r.hp;
    if (mil) {
      if (p.race === 'dwarf') { arm += 1; parm += 1; }
      if (tc.has('unique')) { const q = r.unique; if (q.hp) hpMul *= 1 + q.hp; if (q.atk) atk *= 1 + q.atk; if (q.rate) rate *= q.rate; if (q.arm) { arm += q.arm; parm += q.arm; } }
      if (!d.proj) atk += (tc.has('melee1') ? 1 : 0) + (tc.has('melee2') ? 2 : 0);
      else atk += (tc.has('ranged1') ? 1 : 0) + (tc.has('ranged2') ? 2 : 0);
      const ar = (tc.has('armor1') ? 1 : 0) + (tc.has('armor2') ? 2 : 0); arm += ar; parm += ar;
      if (d.proj && d.range && tc.has('ranged0')) range += 1;
      if ((d.role === 'inf' || d.role === 'pike') && tc.has('march')) sp *= 1.12;
      if (d.role === 'cav' && tc.has('cavspeed')) sp *= 1.10;
      if (d.role === 'special' && tc.has('heal')) atk *= 1.3;
    } else if (tc.has('loom')) { arm += 1; parm += 2; hpAdd = 15; }
  }
  if (u.buffT > G.time) { atk += u.buff.atk || 0; arm += u.buff.arm || 0; parm += u.buff.arm || 0; if (u.buff.rate) rate *= u.buff.rate; }
  if (u.cryT > G.time) { atk *= 1 + u.cry; sp *= 1 + u.cry; }
  if (u.slowT > G.time) sp *= 1 - u.slow;
  if (G.weather && G.weather.cur === 'snow') sp *= 0.92;
  return { atk, arm, parm, rate, sp, range, hpMul, hpAdd };
}
function refreshHp(u) { const s = uStats(u), mh = Math.round(u.def.hp * s.hpMul + s.hpAdd), r = u.hp / (u.maxhp || 1); u.maxhp = mh; u.hp = Math.min(mh, Math.max(1, Math.round(mh * r))); }
function bStats(b) {
  const p = isPlayer(b.team) ? G.players[b.team] : null, d = b.def;
  let atk = d.atk || 0;
  if (p && atk) { atk += (p.techs.has('ranged1') ? 1 : 0) + (p.techs.has('ranged2') ? 2 : 0) + (p.techs.has('masonry') && b.type === 'tower' ? 2 : 0); if (p.race === 'dwarf' && b.type === 'tower') atk += 2; }
  let range = d.range || 0; if (p && p.race === 'elf' && b.type === 'tower') range += 1;
  return { atk, range, rate: d.rate || 2, arm: d.arm, parm: d.parm };
}

// --------------------------------------------------------------- creación
function spawnUnit(key, team, x, y) {
  const def = UNITS[key]; if (!def) { console.warn('unidad desconocida', key); return null; }
  const u = {
    id: G.nextId++, k: 'u', key, def, team, x, y, hp: 1, maxhp: 1, order: { t: 'idle' }, path: [], cd: 0, swing: -1, anim: 'idle', af: Math.random() * 4, face: Math.random() < 0.5 ? 1 : -1,
    carry: 0, ckind: null, gt: 0, xp: 0, pxp: 0, lvl: 1, lastCombat: -99, dmgBy: null, stun: 0, slowT: 0, slow: 0, buffT: 0, buff: null, cryT: 0, cry: 0,
    sc: Math.random() * 0.5, rp: 0, abCd: def.ability ? 8 : 0, stuckT: 0, lx: x, ly: y, born: G.time,
  };
  u.maxhp = 1; u.hp = 1; refreshHp(u); u.hp = u.maxhp;
  G.units.push(u); G.byId.set(u.id, u);
  if (isPlayer(team) && !isAnimal(u)) { const p = G.players[team]; p.stats.trained++; if (def.unique) p.generalId = u.id; }
  return u;
}
function placeBuilding(team, type, tx, ty, builders, instant) {
  const p = G.players[team], race = p ? p.race : 'neutral', d = BLD[type];
  const b = {
    id: G.nextId++, k: 'b', type, def: d, key: race + '_' + type, team, tx, ty, fp: d.fp, hp: 1, maxhp: d.hp, done: !!instant, progress: instant ? 1 : 0,
    queue: [], qt: 0, rally: null, cd: 0, sc: 0, ph: Math.random() * 4, nb: 0, nbNext: 0, food: 0, farmer: null, fire: 0, open: false,
  };
  if (p) { let hp = d.hp * (RACES[race].bldHp || 1); if (p.techs.has('masonry')) hp *= 1.2; b.maxhp = Math.round(hp); }
  b.hp = instant ? b.maxhp : Math.max(1, Math.round(b.maxhp * 0.1));
  if (type === 'farm') b.food = farmFood(p);
  setBlock(b, true);
  G.blds.push(b); G.byId.set(b.id, b);
  for (const u of builders || []) setOrder(u, { t: 'build', b });
  if (instant) onBuilt(b);
  if (p) p.stats.built += instant ? 0 : 1;
  pushUnitsOut(b);
  return b;
}
const farmFood = p => p && p.techs.has('plow') ? 600 : 420;
function setBlock(b, on) {
  if (b.def.flat) return;
  const m = G.map;
  for (let y = b.ty; y < b.ty + b.fp; y++) for (let x = b.tx; x < b.tx + b.fp; x++) {
    const i = y * m.W + x; m.blocked[i] = on ? 1 : (TR_BLOCK[m.terr[i]] || (m.res[i] && m.res[i].kind !== 'carcass' && m.res[i].kind !== 'fish') ? 1 : 0);
    if (b.def.gate) m.gate[i] = on ? b.team : -1;
  }
}
function pushUnitsOut(b) {
  if (b.def.flat) return;
  const r = rectOf(b);
  for (const u of G.units) if (!u.dead && u.x >= r.x0 - 2 && u.x <= r.x1 + 2 && u.y >= r.y0 - 2 && u.y <= r.y1 + 2) { const p = freeSpotNear(b); u.x = p.x; u.y = p.y; u.path = []; }
}
function freeSpotNear(b, target) {
  const W = G.map.W, cand = [];
  for (let rad = 1; rad < 6 && !cand.length; rad++)
    for (let y = b.ty - rad; y < b.ty + b.fp + rad; y++) for (let x = b.tx - rad; x < b.tx + b.fp + rad; x++) {
      if (x >= b.tx && x < b.tx + b.fp && y >= b.ty && y < b.ty + b.fp) continue;
      if (x < 0 || y < 0 || x >= W || y >= G.map.H || !passable(y * W + x, b.team)) continue;
      cand.push({ x: x * T + 8, y: y * T + 8 });
    }
  if (!cand.length) return { x: (b.tx + b.fp / 2) * T, y: (b.ty + b.fp) * T + 8 };
  const tg = target || { x: (b.tx + b.fp / 2) * T, y: (b.ty + b.fp + 2) * T };
  cand.sort((a, c) => Math.hypot(a.x - tg.x, a.y - tg.y) - Math.hypot(c.x - tg.x, c.y - tg.y));
  return cand[Math.floor(Math.random() * Math.min(3, cand.length))];
}
function canPlace(team, type, tx, ty) {
  const d = BLD[type], m = G.map;
  for (let y = ty; y < ty + d.fp; y++) for (let x = tx; x < tx + d.fp; x++) {
    if (x < 0 || y < 0 || x >= m.W || y >= m.H) return false;
    const i = y * m.W + x, t = m.terr[i];
    if (m.blocked[i] || m.res[i] || t === TR.WATER || t === TR.SHALLOW || t === TR.ROCK) return false;
    if (team === G.human && !G.cfg.revealed && !G.vis[i]) return false;
    if (G.blds.some(b => !b.dead && b.def.flat && x >= b.tx && x < b.tx + b.fp && y >= b.ty && y < b.ty + b.fp)) return false;
  }
  return true;
}
function costOf(team, cost) {
  const p = G.players[team], out = {}; for (const k in cost) out[k] = Math.round(cost[k] * (k === 'food' && RACES[p.race].foodCost ? RACES[p.race].foodCost : 1)); return out;
}
const canAfford = (team, cost) => { const p = G.players[team]; for (const k in cost) if (p.res[k] < cost[k]) return false; return true; };
function pay(team, cost) { const p = G.players[team]; for (const k in cost) p.res[k] -= cost[k]; }
function refund(team, cost, f = 1) { const p = G.players[team]; for (const k in cost) p.res[k] += Math.floor(cost[k] * f); }
function missingText(team, cost) { const p = G.players[team]; return Object.keys(cost).filter(k => p.res[k] < cost[k]).map(k => RES_N[k]).join(', '); }

/** Intento del jugador/IA de colocar un edificio pagando. Devuelve el edificio o un texto de error. */
function tryBuild(team, type, tx, ty, builders) {
  const p = G.players[team], d = BLD[type];
  if (d.age > p.age) return 'Requiere ' + AGES[d.age - 1];
  if (type === 'gate') { // puede reemplazar un muro propio
    const w = G.blds.find(b => !b.dead && b.type === 'wall' && b.team === team && b.tx === tx && b.ty === ty);
    if (w) { const c = costOf(team, d.cost); if (!canAfford(team, c)) return 'Faltan recursos: ' + missingText(team, c); pay(team, c); removeBuilding(w); return placeBuilding(team, type, tx, ty, builders); }
  }
  if (!canPlace(team, type, tx, ty)) return 'No se puede construir aquí';
  const c = costOf(team, d.cost); if (!canAfford(team, c)) return 'Faltan recursos: ' + missingText(team, c);
  pay(team, c);
  return placeBuilding(team, type, tx, ty, builders);
}
function removeBuilding(b) { b.dead = true; setBlock(b, false); G.byId.delete(b.id); }

// --------------------------------------------------------------- órdenes
function setOrder(u, o) {
  if (u.order && u.order.t === 'farm' && u.order.b && u.order.b.farmer === u.id && o.t !== 'farm' && o.t !== 'return') u.order.b.farmer = null;
  u.order = o; u.path = []; u.rp = 0; u.gt = 0; u.fails = 0; u.swing = -1;
}
function setMove(u, x, y, amove) {
  x = clamp(x, 4, G.map.W * T - 4); y = clamp(y, 4, G.map.H * T - 4);
  setOrder(u, { t: 'move', x, y, amove: !!amove });
  const gx = tileOf(x), gy = tileOf(y), W = G.map.W, gb = !passable(gy * W + gx, u.team);
  const p = findPath(tileOf(u.x), tileOf(u.y), gx, gy, (a, b) => (a === gx && b === gy) || (gb && Math.max(Math.abs(a - gx), Math.abs(b - gy)) <= 1), u.team);
  if (!p) { u.path = []; return; }
  if (!gb && !p.partial) { if (p.length) p.pop(); p.push({ x, y }); }
  u.path = p;
}
function moveStep(u, dt) {
  if (!u.path.length) return false;
  const p = u.path[0], dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy);
  const ti = tileOf(u.y) * G.map.W + tileOf(u.x), base = u.order.cap ? Math.min(u.order.cap, uStats(u).sp) : uStats(u).sp, s = base * (TR_SPEED[G.map.terr[ti]] || 1) * dt;
  if (d <= s) { u.x = p.x; u.y = p.y; u.path.shift(); } else { u.x += dx / d * s; u.y += dy / d * s; }
  if (Math.abs(dx) > 0.5) u.face = dx > 0 ? 1 : -1;
  u.moving = true; return true;
}
function approach(u, e, reach, dt) {
  const r = rectOf(e);
  if (distRect(u.x, u.y, r) <= reach) { u.path.length = 0; return true; }
  if (!u.path.length || (e.k === 'u' && (u.rp -= dt) <= 0)) {
    u.rp = 0.5 + Math.random() * 0.4;
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, near = { x: clamp(u.x, r.x0, r.x1), y: clamp(u.y, r.y0, r.y1) };
    if (distRect(u.x, u.y, r) < reach + 20 && e.k === 'u') u.path = [near];
    else {
      const p = findPath(tileOf(u.x), tileOf(u.y), tileOf(cx), tileOf(cy), (x, y) => distRect(x * T + 8, y * T + 8, r) <= reach - 2, u.team, e.k === 'u' ? 2500 : 6000);
      if (!p) { if (++u.fails > 3) { u.fails = 0; return null; } u.path = [near]; }
      else if (!p.length) u.path = [near];
      else { u.path = p; if (p.partial && e.k !== 'u' && ++u.fails > 3) { u.fails = 0; return null; } }
    }
  }
  moveStep(u, dt);
  return false;
}
function cmdMove(units, x, y, amove) {
  const n = units.length, cols = Math.ceil(Math.sqrt(n)), sp = 12;
  const cap = n > 1 && units.every(u => isMil(u)) ? Math.min(...units.map(u => uStats(u).sp)) : 0;
  units.forEach((u, i) => { setMove(u, x + ((i % cols) - (cols - 1) / 2) * sp, y + (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * sp, amove); if (cap) u.order.cap = cap; });
}
function cmdAttack(units, tgt) { for (const u of units) if (u.def.atk > 0 || u.def.heal) setOrder(u, { t: 'attack', target: tgt, forced: true }); }
function startGather(u, r) { const ty = RES_TYPE[r.kind]; if (u.carry > 0 && u.ckind !== ty) u.carry = 0; setOrder(u, { t: 'gather', res: r, kind: r.kind }); }
function startFarm(u, b) { if (u.carry > 0 && u.ckind !== 'food') u.carry = 0; if (b.farmer && b.farmer !== u.id) { const o = G.byId.get(b.farmer); if (o && !o.dead && o.order.b === b) return false; } b.farmer = u.id; setOrder(u, { t: 'farm', b }); return true; }

function findRes(u, kind, maxTiles = 18, exclude) {
  let best = null, bd = maxTiles * T; const list = G.resBy[kind] || [];
  for (const r of list) {
    if (r.dead || r === exclude) continue;
    const d = Math.abs(r.tx * T + 8 - u.x) + Math.abs(r.ty * T + 8 - u.y);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
function nearestDrop(u, type) {
  let best = null, bd = 1e9;
  for (const b of G.blds) if (!b.dead && b.done && b.team === u.team && b.def.drop && b.def.drop.includes(type)) { const d = distRect(u.x, u.y, rectOf(b)); if (d < bd) { bd = d; best = b; } }
  return best;
}
function depleteRes(r) {
  if (r.dead) return; r.dead = true;
  const m = G.map, i = r.ty * m.W + r.tx; m.res[i] = null;
  if (r.kind !== 'fish') m.blocked[i] = TR_BLOCK[m.terr[i]];
  if (r.kind === 'tree') G.decals.push({ key: 'stump', tx: r.tx, ty: r.ty, v: r.v % 2 });
  const L = G.resBy[r.kind]; if (L) { const k = L.indexOf(r); if (k >= 0) L.splice(k, 1); }
}
function addCarcass(a) {
  const tx = tileOf(a.x), ty = tileOf(a.y), food = a.def.food || 0; if (!food) return null;
  const r = { id: G.map.rid(), k: 'r', kind: 'carcass', tx, ty, x: a.x, y: a.y, amt: food, max: food, v: 0, art: a.key, face: a.face, ph: 0 };
  (G.resBy.carcass = G.resBy.carcass || []).push(r); return r;
}

// --------------------------------------------------------------- combate
function damageOf(att, st, tgt) {
  const d = att.def, ranged = !!d.proj;
  let armor;
  if (tgt.k === 'b') { const bs = bStats(tgt); armor = ranged ? bs.parm : bs.arm; }
  else { const ts = uStats(tgt); armor = ranged ? ts.parm : ts.arm; }
  if (d.ap) armor *= 0.5;
  let bonus = 0;
  if (d.bonus) { if (tgt.k === 'b') bonus += d.bonus.building || 0; else bonus += d.bonus[tgt.def.role] || 0; }
  if (d.onlyBld && tgt.k !== 'b') return 1;
  return Math.max(1, st.atk - armor) + bonus;
}
function attackEnt(att, tgt) {
  const st = att.k === 'u' ? uStats(att) : bStats(att);
  const proj = att.k === 'u' ? att.def.proj : 'proj_arrow';
  if (proj) spawnProj(att, tgt, st, proj);
  else applyHit(att, tgt, att.k === 'u' ? damageOf(att, st, tgt) : st.atk, true);
  if (att.k === 'u') sfxAt(att.def.proj ? (att.def.proj === 'proj_cannonball' ? 'cannon' : att.def.proj === 'proj_magic' || att.def.proj === 'proj_lightning' || att.def.proj === 'proj_frost' ? 'magic' : att.def.proj === 'proj_rock' ? 'throw' : 'bow') : (att.def.role === 'animal' ? 'bite' : 'hit'), att.x, att.y);
}
function spawnProj(att, tgt, st, art) {
  const c = centerOf(tgt), sx = att.k === 'u' ? att.x : (att.tx + att.fp / 2) * T, sy = att.k === 'u' ? att.y - 10 : att.ty * T + 4;
  const d = Math.hypot(c.x - sx, c.y - sy), speed = art === 'proj_rock' || art === 'proj_cannonball' ? 150 : art === 'proj_magic' || art === 'proj_frost' ? 170 : 260;
  let miss = 0.08; if (G.weather.cur === 'rain' || G.weather.cur === 'storm') miss += 0.12;
  if ((art === 'proj_rock' || art === 'proj_cannonball') && tgt.k === 'u' && att.def && att.def.role === 'siege') miss = 0.45;
  if (tgt.k === 'b') miss = 0;
  const off = Math.random() < miss ? { x: (Math.random() - 0.5) * 24, y: (Math.random() - 0.5) * 24 } : null;
  const dmg = att.k === 'u' ? damageOf(att, st, tgt) : Math.max(1, st.atk - (tgt.k === 'u' ? uStats(tgt).parm : bStats(tgt).parm));
  G.projs.push({ x: sx, y: sy, sx, sy, tgt, att, team: att.team, art, t: 0, dur: Math.max(0.12, d / speed), off, dmg, arc: art === 'proj_rock' || art === 'proj_cannonball' || art === 'proj_axe' || art === 'proj_spear' ? Math.min(28, d * 0.18) : Math.min(10, d * 0.06) });
}
function updProjs(dt) {
  for (const p of G.projs) {
    p.t += dt; const k = Math.min(1, p.t / p.dur);
    const c = p.tgt.dead ? (p.last || { x: p.sx, y: p.sy }) : centerOf(p.tgt); p.last = c;
    const tx = c.x + (p.off ? p.off.x : 0), ty = c.y + (p.off ? p.off.y : 0) - (p.tgt.k === 'u' ? 6 : 0);
    const nx = p.sx + (tx - p.sx) * k, ny = p.sy + (ty - p.sy) * k - Math.sin(k * Math.PI) * p.arc;
    p.ang = Math.atan2(ny - p.y, nx - p.x); p.x = nx; p.y = ny;
    if (k >= 1) {
      p.done = true;
      const a = p.att, d = a.def || {};
      if (!p.off && !p.tgt.dead && p.tgt.k !== 'p') applyHit(a, p.tgt, p.dmg, true, p.team);
      if (d.splash) splashAt(a, tx, ty, d.splash, p.dmg * 0.5, p.tgt, p.team);
      if (p.art === 'proj_cannonball' || p.art === 'proj_rock') { addFx(p.art === 'proj_cannonball' ? 'fx_explosion' : 'fx_dust', tx, ty); if (d.splash) sfxAt('boom', tx, ty); }
      else if (p.art === 'proj_magic') addFx(d.heal ? 'fx_heal' : 'fx_magic', tx, ty);
      else if (p.art === 'proj_frost') addFx('fx_frost', tx, ty);
      else if (p.art === 'proj_lightning') addFx('fx_lightning', tx, ty - 16);
    }
  }
  G.projs = G.projs.filter(p => !p.done);
}
function splashAt(att, x, y, r, dmg, skip, team) {
  sgEach(x, y, r, u => { if (u !== skip && canHarm(team, u.team) && !(u.team === GAIA && !isEnemy(team, GAIA))) applyHit(att, u, dmg, false, team); });
  for (const b of G.blds) if (!b.dead && b !== skip && canHarm(team, b.team) && b.team !== GAIA && distRect(x, y, rectOf(b)) < r && att.def && (att.def.bonus || {}).building) applyHit(att, b, dmg, false, team);
}
/** Aplica daño, registra experiencia pendiente y reacciones. */
function applyHit(att, tgt, dmg, primary, team) {
  if (tgt.dead) return;
  team = team ?? att.team;
  dmg = Math.max(1, dmg);
  tgt.hp -= dmg; tgt.flash = 0.09;
  if (primary && att && att.def && !att.def.proj && Math.random() < 0.35) { const c = centerOf(tgt); addFx(tgt.k === 'u' ? 'fx_blood' : 'fx_dust', c.x + (Math.random() - 0.5) * 8, c.y - (tgt.k === 'u' ? 8 : 0) + (Math.random() - 0.5) * 6); }
  if (isPlayer(team) && isPlayer(tgt.team) && team !== tgt.team) { if (G.stance[team][tgt.team] !== 'enemy' && att && att.k === 'u' && att.order && att.order.forced) declareWar(team, tgt.team, true); G.fought[Math.min(team, tgt.team) + '_' + Math.max(team, tgt.team)] = G.time; }
  if (tgt.team === G.human || team === G.human) G.battleNear = G.time;
  const aU = att && att.k === 'u' && !att.dead ? att : null;
  if (tgt.k === 'u') {
    tgt.lastCombat = G.time;
    if (aU) {
      (tgt.dmgBy = tgt.dmgBy || new Map()).set(aU.id, (tgt.dmgBy.get(aU.id) || 0) + dmg);
      aU.lastCombat = G.time;
      if (isMil(aU)) aU.pxp += dmg * 0.25;
    }
    if (primary && att && att.def) {
      const d = att.def;
      if (d.slow) { tgt.slow = d.slow; tgt.slowT = G.time + 3; }
      if (d.chain) chainLightning(att, tgt, d.chain, dmg * 0.7, team);
    }
    // reacciones
    if (aU && !tgt.dead && tgt.hp > 0) reactToHit(tgt, aU);
  } else if (tgt.k === 'b') {
    if (aU) { (tgt.dmgBy = tgt.dmgBy || new Map()).set(aU.id, (tgt.dmgBy.get(aU.id) || 0) + dmg); aU.lastCombat = G.time; if (isMil(aU)) aU.pxp += dmg * 0.03; }
    if (aU && isPlayer(tgt.team) && tgt.def.atk === undefined) { /* edificios sin ataque */ }
  }
  if (tgt.team === G.human && att && isEnemy(team, G.human) && G.time - G.alerts.t > 12) {
    G.alerts.t = G.time; const c = centerOf(tgt);
    G.msg(tgt.k === 'b' ? '¡Atacan tu ' + tgt.def.n.toLowerCase() + '!' : '¡Tus unidades están bajo ataque!', '#ff8a6a', { ping: c, sound: 'alert' });
  }
  if (tgt.hp <= 0) kill(tgt, aU);
}
function reactToHit(t, a) {
  if (isAnimal(t)) {
    const A = ANIMALS[t.def.animal];
    if (A.flee || A.herd) { const ang = Math.atan2(t.y - a.y, t.x - a.x); setMove(t, t.x + Math.cos(ang) * 80, t.y + Math.sin(ang) * 80); t.order.flee = true; }
    else if (t.order.t !== 'attack') setOrder(t, { t: 'attack', target: a });
    return;
  }
  if (t.order.t === 'idle' || (t.order.t === 'move' && t.order.amove)) {
    if (isMil(t) || t.team === HOSTILE) setOrder(t, { t: 'attack', target: a, auto: true, resume: t.order.t === 'move' ? t.order : null });
    else if (t.def.role === 'worker' && isMil(a)) { /* aldeanos inactivos huyen un poco */ const ang = Math.atan2(t.y - a.y, t.x - a.x); setMove(t, t.x + Math.cos(ang) * 48, t.y + Math.sin(ang) * 48); }
  }
}
function chainLightning(att, first, n, dmg, team) {
  let last = first; const hit = new Set([first.id]);
  for (let k = 0; k < n; k++) {
    let best = null, bd = 56;
    sgEach(last.x, last.y, 56, u => { if (!hit.has(u.id) && canHarm(team, u.team) && u.team !== GAIA) { const d = dist(u, last); if (d < bd) { bd = d; best = u; } } });
    if (!best) break;
    G.fx.push({ key: 'beam', x: last.x, y: last.y - 8, x2: best.x, y2: best.y - 8, t: 0, life: 0.25 });
    hit.add(best.id); applyHit(att, best, dmg, false, team); last = best;
  }
}
function kill(e, killer) {
  if (e.dead) return; e.dead = true; e.hp = 0; G.byId.delete(e.id);
  if (e.k === 'u') {
    const p = isPlayer(e.team) && !isAnimal(e) ? G.players[e.team] : null;
    // experiencia por bajas: se reparte según el daño y queda pendiente hasta sobrevivir al combate
    if (e.dmgBy && !isAnimal(e)) {
      const value = 20 + costSum(e.def.cost) / 5 + 15 * (e.lvl - 1) + (e.def.unique ? 120 : 0) + (e.team === HOSTILE ? 10 : 0);
      let total = 0; for (const v of e.dmgBy.values()) total += v;
      for (const [id, d] of e.dmgBy) { const a = G.byId.get(id); if (a && a.k === 'u' && isMil(a)) { a.pxp += value * d / total; a.lastCombat = G.time; } }
    } else if (e.dmgBy && isAnimal(e) && e.team === HOSTILE) {
      for (const [id] of e.dmgBy) { const a = G.byId.get(id); if (a && a.k === 'u' && isMil(a)) a.pxp += 12; }
    }
    if (killer && isPlayer(killer.team) && !isAnimal(e)) G.players[killer.team].stats.killed++;
    if (p) { p.stats.lost++; if (p.generalId === e.id) { p.generalId = null; G.msg((e.team === G.human ? 'Tu ' : 'El ') + e.def.n + ' ha caído' + (e.team === G.human ? '' : ' (' + p.name + ')'), '#ffd27a', { sound: 'horn' }); } }
    G.corpses.push({ key: e.key, team: e.team, x: e.x, y: e.y, face: e.face, t: 0 });
    if (isAnimal(e)) {
      const r = addCarcass(e);
      if (r) for (const u of G.units) if (!u.dead && u.order.target === e && u.def.role === 'worker') startGather(u, r);
    }
    sfxAt(isAnimal(e) ? 'animal' : 'die', e.x, e.y);
  } else if (e.k === 'b') {
    setBlock(e, false);
    ejectAll(e, true);
    if (e.dmgBy) { const value = 30 + costSum(e.def.cost) / 8; let total = 0; for (const v of e.dmgBy.values()) total += v; for (const [id, d] of e.dmgBy) { const a = G.byId.get(id); if (a && a.k === 'u' && isMil(a)) a.pxp += value * d / total; } }
    if (killer && isPlayer(killer.team)) G.players[killer.team].stats.razed++;
    const c = centerOf(e);
    if (!e.def.flat) { G.decals.push({ key: 'rubble', tx: e.tx, ty: e.ty, size: e.fp, t: G.time }); addFx('fx_explosion', c.x, c.y); for (let k = 0; k < e.fp * 2; k++) addFx('fx_smoke', c.x + (Math.random() - 0.5) * e.fp * T, c.y + (Math.random() - 0.5) * e.fp * T * 0.6); }
    sfxAt('collapse', c.x, c.y);
    if (e.team === G.human) G.msg('Has perdido: ' + e.def.n, '#ff8a6a');
    if (e.team === HOSTILE && killer && isPlayer(killer.team)) campReward(e, killer.team);
    updatePop();
  }
}

// --------------------------------------------------------------- experiencia
function gainXP(u, amt) {
  if (!isMil(u) || u.lvl >= LEVEL_MAX) { if (u.lvl >= LEVEL_MAX) u.xp = Math.max(u.xp, LEVEL_XP[LEVEL_MAX - 1]); return; }
  u.xp += amt;
  let up = false;
  while (u.lvl < LEVEL_MAX && u.xp >= LEVEL_XP[u.lvl]) { u.lvl++; up = true; }
  if (up) {
    const r = u.hp / u.maxhp; refreshHp(u); u.hp = Math.min(u.maxhp, Math.round(u.maxhp * Math.min(1, r + 0.25)));
    addFx('fx_levelup', u.x, u.y - 10);
    G.texts.push({ x: u.x, y: u.y - 26, text: 'Nivel ' + u.lvl, color: '#ffd23a', t: 0, life: 1.8 });
    if (isPlayer(u.team)) { const p = G.players[u.team]; p.stats.maxLevel = Math.max(p.stats.maxLevel, u.lvl); }
    if (u.team === G.human) { G.msg(u.def.n + ' sube a nivel ' + u.lvl + '. Más fuerte y resistente.', '#ffd23a'); sfx('levelup'); }
  }
}

// --------------------------------------------------------------- actualización de unidades
function updUnit(u, dt) {
  const d = u.def, o = u.order;
  u.moving = false;
  if (u.cd > 0) u.cd -= dt;
  if (u.abCd > 0) u.abCd -= dt;
  // regeneración (nivel, auras, templo)
  let regen = levelMods(u.lvl).regen;
  if (u.buffT > G.time && u.buff.regen) regen += u.buff.regen;
  if (regen > 0 && u.hp < u.maxhp && G.time - u.lastCombat > 2) u.hp = Math.min(u.maxhp, u.hp + regen * dt);
  // experiencia pendiente: se gana al sobrevivir al enfrentamiento (5 s sin combatir)
  if (u.pxp > 0 && G.time - u.lastCombat > 5) { if (u.team === G.human && u.pxp >= 3 && u.lvl < LEVEL_MAX) G.texts.push({ x: u.x, y: u.y - 30, text: '+' + Math.floor(u.pxp) + ' XP', color: '#ffe08a', t: 0, life: 1.4 }); gainXP(u, u.pxp); u.pxp = 0; }
  if (u.inside) { if (u.inside.dead) ejectOne(u, u.inside); else { u.hp = Math.min(u.maxhp, u.hp + dt * 0.8); return; } }
  if (u.stun > 0) { u.stun -= dt; u.anim = 'idle'; return; }
  // golpe en curso
  if (u.swing >= 0) {
    const dur = u.swingDur; u.swing += dt;
    if (!u.hitDone && u.swing >= dur * 0.5) {
      u.hitDone = true; const t = u.swTarget;
      if (t && !t.dead) { if (d.heal && !canHarm(u.team, t.team)) healTarget(u, t); else attackEnt(u, t); }
    }
    if (u.swing >= dur) u.swing = -1;
    u.anim = 'attack'; u.af = Math.min(3.99, (u.swing / dur) * 4); if (u.swing < 0) u.af = 0;
    return;
  }
  if (isAnimal(u)) animalAI(u, dt);
  switch (o.t) {
    case 'idle': idleThink(u, dt); break;
    case 'move': {
      if (o.amove && (u.sc -= dt) <= 0) { u.sc = 0.5; const e = nearestEnemy(u, uStats(u).los || d.los * T); if (e) { setOrder(u, { t: 'attack', target: e, auto: true, resume: o }); break; } }
      if (!moveStep(u, dt)) { setOrder(u, { t: 'idle' }); if (o.then) o.then(u); }
      stuckCheck(u, dt);
      break;
    }
    case 'attack': doAttackOrder(u, o, dt); break;
    case 'gather': doGather(u, o, dt); break;
    case 'farm': doFarm(u, o, dt); break;
    case 'return': doReturn(u, o, dt); break;
    case 'build': doBuild(u, o, dt); break;
    case 'garrison': {
      const b = o.b; if (b.dead || !b.done || b.team !== u.team && !isAlly(b.team, u.team)) { setOrder(u, { t: 'idle' }); break; }
      const a = approach(u, b, 12, dt);
      if (a === null) setOrder(u, { t: 'idle' });
      else if (a) { if ((b.garrison = b.garrison || []).length >= b.def.garrison) { setOrder(u, { t: 'idle' }); if (u.team === G.human) G.msg(b.def.n + ' está lleno', '#ffb070'); } else { b.garrison.push(u); u.inside = b; u.path = []; G.sel = G.sel.filter(e => e !== u); } }
      break;
    }
    case 'treasure': {
      const tr = o.tr; if (tr.taken) { setOrder(u, { t: 'idle' }); break; }
      const a = approach(u, tr, 6, dt); if (a === null) setOrder(u, { t: 'idle' }); else if (a) takeTreasure(tr, u);
      break;
    }
  }
  // animación
  if (u.swing < 0) {
    if (u.moving) { u.anim = 'walk'; u.af = (u.af + dt * 10 * (uStats(u).sp / 34)) % 8; }
    else if (u.working) { u.anim = 'work'; u.af = (u.af + dt * 6) % 4; }
    else { u.anim = 'idle'; u.af = (u.af + dt * 3) % 4; }
  }
  u.working = false;
}
function stuckCheck(u, dt) {
  if (!u.moving) return;
  u.stuckT += dt;
  if (u.stuckT > 1.2) { const moved = Math.hypot(u.x - u.lx, u.y - u.ly); if (moved < 4 && u.path.length) { const last = u.path[u.path.length - 1]; const o = u.order; if (o.t === 'move') { setMove(u, last.x, last.y, o.amove); u.order.then = o.then; } else u.path = []; } u.stuckT = 0; u.lx = u.x; u.ly = u.y; }
}
function idleThink(u, dt) {
  if ((u.sc -= dt) > 0) return;
  u.sc = 0.4 + Math.random() * 0.3;
  if (isAnimal(u)) return;
  if (u.def.heal) { const t = woundedAlly(u, u.def.heal.r * T); if (t) { setOrder(u, { t: 'attack', target: t, auto: true }); return; } }
  if (isMil(u) || u.team === HOSTILE) {
    const e = nearestEnemy(u, u.def.los * T * (G.weather.cur === 'fog' ? 0.7 : 1));
    if (e) { setOrder(u, { t: 'attack', target: e, auto: true, home: u.order.home || { x: u.x, y: u.y } }); return; }
    if (u.order.home && dist(u, u.order.home) > 24) setMove(u, u.order.home.x, u.order.home.y);
  }
}
function nearestEnemy(u, r) {
  let best = null, bd = r + 1;
  sgEach(u.x, u.y, r, e => {
    if (e.team === u.team || !isEnemy(u.team, e.team)) return;
    if (isAnimal(e) && e.team === GAIA) return;
    let d = dist(u, e); if (!isMil(e) && e.team !== HOSTILE) d += 20; // prioriza combatientes
    if (d < bd) { bd = d; best = e; }
  });
  if (best) return best;
  if (u.def.role === 'animal') return null;
  for (const b of G.blds) { if (b.dead || !isEnemy(u.team, b.team) || b.def.wall) continue; const d = distRect(u.x, u.y, rectOf(b)); if (d < bd) { bd = d; best = b; } }
  return best;
}
function woundedAlly(u, r) {
  let best = null, bw = 0;
  sgEach(u.x, u.y, r, e => { if (e !== u && isAlly(e.team, u.team) && !isAnimal(e) && e.hp < e.maxhp) { const w = 1 - e.hp / e.maxhp; if (w > bw) { bw = w; best = e; } } });
  return best;
}
function healTarget(u, t) {
  const h = u.def.heal, p = isPlayer(u.team) ? G.players[u.team] : null, mul = p && p.techs.has('heal') ? 1.3 : 1;
  t.hp = Math.min(t.maxhp, t.hp + h.v * mul * levelMods(u.lvl).atk);
  addFx('fx_heal', t.x, t.y - 8); u.pxp += 1.5; u.lastCombat = G.time;
}
function doAttackOrder(u, o, dt) {
  const t = o.target, d = u.def;
  const done = () => { if (o.resume && o.resume.t === 'move') setMove(u, o.resume.x, o.resume.y, o.resume.amove); else setOrder(u, { t: 'idle', home: o.home }); };
  if (!t || t.dead || (!o.forced && !d.heal && t.team !== u.team && !isEnemy(u.team, t.team))) return done();
  if (d.heal && !canHarm(u.team, t.team) && t.hp >= t.maxhp) return done();
  if (t.k === 'u' && t.team !== u.team && G.human === u.team && !G.cfg.revealed && !o.forced) { /* sigue */ }
  if (o.auto && o.home && dist(u, o.home) > d.los * T * 2.2) { setMove(u, o.home.x, o.home.y); return; }
  if (t.k === 'r') return done();
  const st = uStats(u), ranged = d.proj || d.heal;
  const reach = ranged ? (d.heal ? d.heal.r * T : st.range * T) + (t.k === 'u' ? t.def.size * 0.5 : 0) : 10 + d.size * 0.6 + (t.k === 'u' ? t.def.size * 0.5 : 0);
  if (d.minr && t.k === 'u' && dist(u, t) < d.minr * T) { // demasiado cerca: retroceder
    const ang = Math.atan2(u.y - t.y, u.x - t.x); u.path = [{ x: u.x + Math.cos(ang) * 20, y: u.y + Math.sin(ang) * 20 }]; moveStep(u, dt); return;
  }
  const a = approach(u, t, reach, dt);
  if (a === null) return done();
  if (a) {
    const c = centerOf(t); u.face = c.x >= u.x ? 1 : -1;
    if (u.cd <= 0) { u.cd = st.rate; u.swing = 0; u.swingDur = Math.min(0.55, st.rate * 0.6); u.swTarget = t; u.hitDone = false; }
    else u.anim = 'idle';
  } else stuckCheck(u, dt);
}
function gatherRate(u, kind) {
  const p = G.players[u.team]; let r = GATHER_RATE[kind] * ((u.def.gather || {})[RES_TYPE[kind] || 'food'] || 1);
  if (kind === 'farm') r *= (u.def.gather || {}).food || 1;
  if (p) {
    const tc = p.techs, ty = kind === 'farm' ? 'food' : RES_TYPE[kind];
    if (ty === 'wood') r *= (tc.has('axe') ? 1.2 : 1) * (tc.has('axe2') ? 1.2 : 1);
    if (ty === 'gold' || ty === 'stone' || ty === 'iron') r *= (tc.has('pick') ? 1.2 : 1) * (tc.has('pick2') ? 1.2 : 1);
    if (kind === 'farm' && tc.has('plow')) r *= 1.15;
    if (!p.human) r *= DIFFICULTY[p.diff].gather;
  }
  if (kind === 'farm' && G.weather.cur === 'snow') r *= 0.85;
  return r;
}
function doGather(u, o, dt) {
  let r = o.res; const cap = u.def.carry || 10;
  if (!r || r.dead || r.amt <= 0) {
    r = findRes(u, o.kind) || (o.kind === 'gems' ? findRes(u, 'gold') : o.kind === 'gold' ? findRes(u, 'gems') : null);
    if (!r) { if (u.carry > 0) setOrder(u, { t: 'return', kind: o.kind }); else setOrder(u, { t: 'idle' }); return; }
    o.res = r; u.path = [];
  }
  const ty = RES_TYPE[r.kind];
  if (u.carry >= cap || (u.carry > 0 && u.ckind !== ty)) { setOrder(u, { t: 'return', res: r, kind: r.kind }); return; }
  const a = approach(u, r, 13, dt);
  if (a === null) { const alt = findRes(u, o.kind, 18, r); if (alt) { o.res = alt; u.path = []; } else setOrder(u, { t: 'idle' }); return; }
  if (a) {
    u.working = true; const c = centerOf(r); u.face = c.x >= u.x ? 1 : -1;
    u.gt += dt * gatherRate(u, r.kind);
    if (r.kind === 'tree') r.shake = G.time;
    if ((u.gsfx = (u.gsfx || 0) - dt) <= 0) { u.gsfx = 1.1; sfxAt(r.kind === 'tree' ? 'chop' : r.kind === 'berry' || r.kind === 'carcass' || r.kind === 'fish' ? 'pick' : 'mine', u.x, u.y, 0.35); }
    while (u.gt >= 1) {
      u.gt -= 1; u.carry++; u.ckind = ty; r.amt--;
      if (r.amt <= 0) { depleteRes(r); break; }
      if (u.carry >= cap) break;
    }
  } else stuckCheck(u, dt);
}
function doFarm(u, o, dt) {
  const b = o.b;
  if (b.dead || !b.done) { setOrder(u, { t: 'idle' }); return; }
  if (u.carry >= (u.def.carry || 10) || (u.carry > 0 && u.ckind !== 'food')) { setOrder(u, { t: 'return', farm: b, kind: 'farm' }); return; }
  const r = rectOf(b), inside = u.x > r.x0 + 4 && u.x < r.x1 - 4 && u.y > r.y0 + 4 && u.y < r.y1 - 4;
  if (!inside) {
    if (!u.path.length) { const p = findPath(tileOf(u.x), tileOf(u.y), b.tx + 1, b.ty + 1, (x, y) => x === b.tx + 1 && y === b.ty + 1, u.team); u.path = p && p.length ? p : [{ x: (b.tx + 1.5) * T, y: (b.ty + 1.5) * T }]; u.path[u.path.length - 1] = { x: r.x0 + 8 + Math.random() * 32, y: r.y0 + 10 + Math.random() * 28 }; }
    moveStep(u, dt); return;
  }
  u.working = true; u.path = [];
  if ((u.wander = (u.wander || 0) - dt) <= 0) { u.wander = 3 + Math.random() * 3; u.path = [{ x: r.x0 + 8 + Math.random() * 32, y: r.y0 + 10 + Math.random() * 28 }]; }
  if (u.path.length) moveStep(u, dt);
  u.gt += dt * gatherRate(u, 'farm');
  while (u.gt >= 1) {
    u.gt -= 1; u.carry++; u.ckind = 'food'; b.food--;
    if (b.food <= 0) {
      const p = G.players[u.team];
      if (p && p.res.wood >= 60) { p.res.wood -= 60; b.food = farmFood(p); if (u.team === G.human) G.msg('Granja resembrada (60 de madera)', '#cfe8a0'); }
      else { if (u.team === G.human) G.msg('Una granja se agotó y no hay madera para resembrar', '#ffb070'); kill(b, null); setOrder(u, { t: 'return', kind: 'farm' }); return; }
    }
  }
}
function doReturn(u, o, dt) {
  if (!u.carry) { resumeWork(u, o); return; }
  let dp = o.drop && !o.drop.dead ? o.drop : null;
  if (!dp) { dp = nearestDrop(u, u.ckind); o.drop = dp; u.path = []; }
  if (!dp) { setOrder(u, { t: 'idle' }); return; }
  const a = approach(u, dp, 12, dt);
  if (a === null) { setOrder(u, { t: 'idle' }); return; }
  if (a) {
    const p = G.players[u.team]; if (p) { p.res[u.ckind] += u.carry; p.stats.gathered[u.ckind] += u.carry; }
    if (u.team === G.human && u.carry >= 5) G.texts.push({ x: u.x, y: u.y - 22, text: '+' + u.carry, color: '#f4e9c8', t: 0, life: 0.9, icon: 'icon_' + u.ckind });
    u.carry = 0; resumeWork(u, o);
  } else stuckCheck(u, dt);
}
function resumeWork(u, o) {
  if (o.farm && !o.farm.dead) { startFarm(u, o.farm) || setOrder(u, { t: 'idle' }); return; }
  const r = o.res && !o.res.dead ? o.res : (o.kind && o.kind !== 'farm' ? findRes(u, o.kind) : null);
  if (r) startGather(u, r); else setOrder(u, { t: 'idle' });
}
function doBuild(u, o, dt) {
  const b = o.b;
  if (b.dead) { setOrder(u, { t: 'idle' }); return; }
  if (b.done && b.hp >= b.maxhp && !b.fire) { afterBuild(u, b); return; }
  const a = approach(u, b, 12, dt);
  if (a === null) { setOrder(u, { t: 'idle' }); return; }
  if (!a) { stuckCheck(u, dt); return; }
  u.working = true; const c = centerOf(b); u.face = c.x >= u.x ? 1 : -1;
  b.nbNext++;
  const p = G.players[u.team], n = Math.max(1, b.nb), mul = (p && RACES[p.race].build || 1) / Math.pow(n, 0.3);
  if ((u.gsfx = (u.gsfx || 0) - dt) <= 0) { u.gsfx = 0.9; sfxAt('build', u.x, u.y, 0.35); if (Math.random() < 0.3) addFx('fx_build', c.x + (Math.random() - 0.5) * b.fp * 10, (b.ty + b.fp) * T - 4); }
  if (!b.done) {
    const step = dt / b.def.time * mul;
    b.progress = Math.min(1, b.progress + step); b.hp = Math.min(b.maxhp, b.hp + b.maxhp * 0.9 * step);
    if (b.progress >= 1) { b.done = true; b.hp = Math.max(b.hp, b.maxhp * 0.98); onBuilt(b); }
  } else {
    if (b.fire) b.fire = Math.max(0, b.fire - dt * 2); // apagar fuego
    const heal = b.maxhp / b.def.time * 0.5 * dt * mul, cost = b.def.cost, frac = heal / b.maxhp * 0.5;
    if (p) { for (const k in cost) { if (p.res[k] < cost[k] * frac) { if (u.team === G.human && G.time - (G.repairMsg || 0) > 8) { G.repairMsg = G.time; G.msg('Faltan recursos para reparar', '#ffb070'); } setOrder(u, { t: 'idle' }); return; } } for (const k in cost) p.res[k] -= cost[k] * frac; }
    b.hp = Math.min(b.maxhp, b.hp + heal);
  }
}
function afterBuild(u, b) {
  if (b.type === 'farm' && startFarm(u, b)) return;
  if (b.def.drop && b.type !== 'tc') {
    for (const ty of b.def.drop) { const kinds = Object.keys(RES_TYPE).filter(k => RES_TYPE[k] === ty && k !== 'carcass' && k !== 'fish'); for (const k of kinds) { const r = findRes(u, k, 10); if (r) { startGather(u, r); return; } } }
  }
  // seguir construyendo algo cercano sin terminar
  const other = G.blds.find(o => !o.dead && !o.done && o.team === u.team && distRect(u.x, u.y, rectOf(o)) < 6 * T);
  if (other) setOrder(u, { t: 'build', b: other }); else setOrder(u, { t: 'idle' });
}
function onBuilt(b) {
  updatePop();
  if (b.team === G.human && G.time > 1) { G.msg(b.def.n + ' terminado', '#cfe8a0'); sfx('built'); }
  if (b.type === 'farm') b.food = b.food || farmFood(G.players[b.team]);
}

// --------------------------------------------------------------- edificios
function updBld(b, dt) {
  b.nb = b.nbNext; b.nbNext = 0;
  if (b.fire > 0) { b.fire -= dt; b.hp -= dt * 6; if (b.hp <= 0) { kill(b, null); return; } }
  if (!b.done) return;
  const p = isPlayer(b.team) ? G.players[b.team] : null;
  if (b.queue.length && p) {
    const q = b.queue[0];
    if (q.kind === 'unit') {
      const def = UNITS[q.key];
      if (p.pop + def.pop > p.popCap && !def.unique) { if (!b.housed && b.team === G.human) G.msg('Población máxima: construye más casas', '#ffb070', { sound: 'error' }); b.housed = true; }
      else { b.housed = false; b.qt += dt; if (b.qt >= def.time) { b.qt = 0; b.queue.shift(); finishTrain(b, q.key); } }
    } else { b.qt += dt; const tdef = TECHS[q.key]; if (b.qt >= tdef.time) { b.qt = 0; b.queue.shift(); applyTech(b.team, q.key); } }
  }
  // torres, centro urbano y castillo disparan
  if (b.def.atk) {
    b.cd -= dt;
    if (b.cd <= 0) {
      const bs = bStats(b), c = centerOf(b), R = bs.range * T + b.fp * 8;
      let best = null, bd = R;
      sgEach(c.x, c.y, R, u => { if (isEnemy(b.team, u.team) && !(isAnimal(u) && u.team === GAIA)) { const d = dist(u, c); if (d < bd) { bd = d; best = u; } } });
      if (best) {
        b.cd = bs.rate; spawnProj(b, best, bs, 'proj_arrow'); sfxAt('bow', c.x, c.y, 0.5);
        // cada unidad en la guarnición añade una flecha (máx. 10)
        const extra = Math.min(10, (b.garrison || []).length);
        if (extra) { const tg = []; sgEach(c.x, c.y, R, u => { if (isEnemy(b.team, u.team) && !(isAnimal(u) && u.team === GAIA)) tg.push(u); }); for (let k = 0; k < extra; k++) spawnProj(b, tg[k % tg.length] || best, bs, 'proj_arrow'); }
      } else b.cd = 0.4;
    }
  }
  // templo con Sanación cura a los cercanos
  if (b.type === 'temple' && p && p.techs.has('heal') && (b.sc -= dt) <= 0) {
    b.sc = 1; const c = centerOf(b); sgEach(c.x, c.y, 5 * T, u => { if (isAlly(u.team, b.team) && u.hp < u.maxhp) u.hp = Math.min(u.maxhp, u.hp + 3); });
  }
  if (b.def.gate) { let open = false; const c = centerOf(b); sgEach(c.x, c.y, 22, u => { if (isAlly(u.team, b.team)) open = true; return open; }); b.open = open; }
}
function finishTrain(b, key) {
  const pt = freeSpotNear(b, b.rally), u = spawnUnit(key, b.team, pt.x, pt.y);
  if (!u) return;
  if (b.team === G.human) sfx('trained');
  if (u.def.unique && b.team === G.human) G.msg('¡' + u.def.n + ' se une a tu ejército! Aura: ' + u.def.aura.n, '#ffd27a', { sound: 'horn' });
  if (b.rally) {
    const rt = b.rally.target;
    if (rt && rt.k === 'r' && !rt.dead && u.def.role === 'worker') startGather(u, rt);
    else if (rt && rt.k === 'b' && rt.type === 'farm' && u.def.role === 'worker' && startFarm(u, rt)) { /* ok */ }
    else if (rt && rt.k === 'b' && !rt.done && u.def.role === 'worker') setOrder(u, { t: 'build', b: rt });
    else setMove(u, b.rally.x, b.rally.y);
  }
}
/** Encola una unidad o tecnología. Devuelve null o un mensaje de error. */
function enqueue(b, kind, key) {
  const p = G.players[b.team];
  if (!b.done) return 'El edificio no está terminado';
  if (b.queue.length >= 6) return 'Cola llena';
  if (kind === 'unit') {
    const def = UNITS[key]; if (def.age > p.age) return 'Requiere ' + AGES[def.age - 1];
    if (def.unique && (p.generalId && G.byId.get(p.generalId) || G.blds.some(o => !o.dead && o.team === b.team && o.queue.some(q => q.key === key)))) return 'Solo puede existir un ' + def.n;
    const c = costOf(b.team, def.cost); if (!canAfford(b.team, c)) return 'Faltan recursos: ' + missingText(b.team, c);
    pay(b.team, c); b.queue.push({ kind, key, cost: c });
  } else {
    const t = TECHS[key];
    if (p.techs.has(key) || p.researching.has(key)) return 'Ya investigado';
    if (t.age && p.age < t.age) return 'Requiere ' + AGES[t.age - 1];
    if (t.toAge && p.age !== t.age) return 'No disponible';
    if (t.req && !p.techs.has(t.req)) return 'Requiere ' + TECHS[t.req].n;
    if (t.toAge) { const n = ageReqCount(b.team); if (n < 2) return 'Necesitas 2 edificios de la era actual (' + n + '/2)'; }
    const c = costOf(b.team, t.cost); if (!canAfford(b.team, c)) return 'Faltan recursos: ' + missingText(b.team, c);
    pay(b.team, c); p.researching.add(key); b.queue.push({ kind, key, cost: c });
  }
  updatePop();
  return null;
}
const AGE_REQ = { 1: ['barracks', 'mill', 'lumber', 'mine'], 2: ['range', 'stable', 'temple', 'forge', 'market'] };
function ageReqCount(team) { const p = G.players[team], set = new Set(); for (const b of G.blds) if (!b.dead && b.done && b.team === team && AGE_REQ[p.age] && AGE_REQ[p.age].includes(b.type)) set.add(b.type); return set.size; }
function cancelQueue(b, i) {
  const q = b.queue[i]; if (!q) return; b.queue.splice(i, 1); if (i === 0) b.qt = 0;
  refund(b.team, q.cost); if (q.kind === 'tech') G.players[b.team].researching.delete(q.key); updatePop();
}
function applyTech(team, key) {
  const p = G.players[team], t = TECHS[key]; p.researching.delete(key); p.techs.add(key);
  if (t.toAge) { p.age = t.toAge; if (team === G.human) G.msg('¡Has avanzado a la ' + AGES[p.age - 1] + '!', '#ffd27a', { sound: 'horn' }); else G.msg(p.name + ' avanza a la ' + AGES[p.age - 1], '#d0c8e8'); }
  else if (team === G.human) { G.msg('Investigación completada: ' + (key === 'unique' ? RACES[p.race].unique.n : t.n), '#cfe8a0'); sfx('tech'); }
  if (key === 'loom' || key === 'unique' || key === 'armor1') for (const u of G.units) if (u.team === team && !u.dead) refreshHp(u);
  if (key === 'masonry') for (const b of G.blds) if (b.team === team && !b.dead) { const r = b.hp / b.maxhp; b.maxhp = Math.round(b.maxhp * 1.2); b.hp = b.maxhp * r; }
  if (key === 'plow') for (const b of G.blds) if (b.team === team && b.type === 'farm' && !b.dead) b.food += 150;
}
function updatePop() {
  for (const p of G.players) { p.popCap = 0; p.pop = 0; }
  for (const b of G.blds) if (!b.dead && b.done && isPlayer(b.team) && b.def.pop) G.players[b.team].popCap += b.def.pop;
  for (const u of G.units) if (!u.dead && isPlayer(u.team) && !isAnimal(u)) G.players[u.team].pop += u.def.pop;
  for (const p of G.players) p.popCap = Math.min(200, p.popCap);
}

// --------------------------------------------------------------- generales: auras y habilidades
function updGenerals(dt) {
  for (const u of G.units) {
    if (u.dead || !u.def.unique) continue;
    const au = u.def.aura;
    sgEach(u.x, u.y, au.r * T, a => { if (isAlly(a.team, u.team) && !isAnimal(a)) { a.buff = au; a.buffT = G.time + 0.8; } });
    // habilidad automática cuando hay combate cerca
    const ab = u.def.ability;
    if (u.abCd <= 0 && G.time - u.lastCombat < 3) { if (castAbility(u)) u.abCd = ab.cd; }
  }
}
function castAbility(u) {
  const ab = u.def.ability, R = ab.r * T;
  if (ab.type === 'heal') {
    let n = 0; sgEach(u.x, u.y, R, a => { if (isAlly(a.team, u.team) && a.hp < a.maxhp && !isAnimal(a)) { a.hp = Math.min(a.maxhp, a.hp + ab.v); addFx('fx_heal', a.x, a.y - 8); n++; } });
    if (!n) return false;
  } else if (ab.type === 'stomp') {
    let n = 0; sgEach(u.x, u.y, R, a => { if (canHarm(u.team, a.team) && a.team !== GAIA) { applyHit(u, a, ab.v * levelMods(u.lvl).atk, false); a.stun = ab.stun; n++; } });
    if (!n) return false; addFx('fx_stomp', u.x, u.y); G.shake = Math.max(G.shake, 0.4); sfxAt('boom', u.x, u.y);
  } else if (ab.type === 'warcry') {
    sgEach(u.x, u.y, R, a => { if (isAlly(a.team, u.team) && !isAnimal(a)) { a.cry = ab.v; a.cryT = G.time + ab.dur; } }); addFx('fx_levelup', u.x, u.y - 8); sfxAt('horn', u.x, u.y);
  } else if (ab.type === 'volley') {
    const e = nearestEnemy(u, uStats(u).range * T + 16); if (!e || e.k !== 'u') return false;
    for (let k = 0; k < 10; k++) { const tx = e.x + (Math.random() - 0.5) * R * 1.4, ty = e.y + (Math.random() - 0.5) * R * 1.4; G.projs.push({ x: u.x, y: u.y - 12, sx: u.x, sy: u.y - 12, tgt: { k: 'p', x: tx, y: ty, dead: false, def: { size: 1 } }, att: u, team: u.team, art: 'proj_arrow', t: -k * 0.04, dur: 0.6, off: null, dmg: 0, arc: 24 }); }
    setTimeoutSim(0.65, () => { sgEach(e.x, e.y, R, a => { if (canHarm(u.team, a.team) && a.team !== GAIA) applyHit(u, a, ab.v, false); }); });
  }
  if (u.team === G.human) G.msg(u.def.n + ' usa ' + ab.n, '#ffd27a');
  return true;
}
const SIM_TIMERS = [];
function setTimeoutSim(t, fn) { SIM_TIMERS.push({ at: G.time + t, fn }); }

// --------------------------------------------------------------- separación de unidades
function separate() {
  for (const c of SG.cells) {
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
      const a = c[i], b = c[j]; const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, min = (a.def.size + b.def.size) * 0.6;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) * 0.5, ux = dx / d * push, uy = dy / d * push;
        const aw = a.moving && !b.moving ? 0.3 : 1, bw = b.moving && !a.moving ? 0.3 : 1;
        moveIfFree(a, -ux * aw, -uy * aw); moveIfFree(b, ux * bw, uy * bw);
      } else if (d2 <= 0.01) { a.x += Math.random() - 0.5; a.y += Math.random() - 0.5; }
    }
  }
}
function moveIfFree(u, dx, dy) {
  const nx = u.x + dx, ny = u.y + dy, W = G.map.W, tx = tileOf(nx), ty = tileOf(ny);
  if (tx < 0 || ty < 0 || tx >= W || ty >= G.map.H) return;
  if (passable(ty * W + tx, u.team) || !passable(tileOf(u.y) * W + tileOf(u.x), u.team)) { u.x = nx; u.y = ny; }
}

// --------------------------------------------------------------- bucle de simulación
function simStep(dt) {
  if (G.over && !G.cfg.observer) { /* la partida sigue visible */ }
  G.time += dt;
  sgRebuild(G.units);
  for (let i = SIM_TIMERS.length - 1; i >= 0; i--) if (G.time >= SIM_TIMERS[i].at) { const t = SIM_TIMERS.splice(i, 1)[0]; t.fn(); }
  for (const u of G.units) if (!u.dead) { updUnit(u, dt); if (u.flash > 0) u.flash -= dt; }
  for (const b of G.blds) if (!b.dead) { updBld(b, dt); if (b.flash > 0) b.flash -= dt; }
  updGenerals(dt);
  updProjs(dt);
  separate();
  worldStep(dt);
  aiStep(dt);
  diploStep(dt);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < (f.life || 1));
  for (const t of G.texts) { t.t += dt; t.y -= dt * 14; }
  G.texts = G.texts.filter(t => t.t < t.life);
  for (const c of G.corpses) c.t += dt;
  G.corpses = G.corpses.filter(c => c.t < 12);
  if (G.shake > 0) G.shake -= dt;
  if ((G.cleanT = (G.cleanT || 0) - dt) <= 0) {
    G.cleanT = 1;
    G.units = G.units.filter(u => !u.dead); G.blds = G.blds.filter(b => !b.dead);
    G.sel = G.sel.filter(e => !e.dead);
    updatePop(); checkElimination();
    if (G.decals.length > 400) G.decals.splice(0, G.decals.length - 400);
  }
}
function checkElimination() {
  for (const p of G.players) {
    if (!p.alive) continue;
    const hasU = G.units.some(u => !u.dead && u.team === p.id && !isAnimal(u));
    const hasB = G.blds.some(b => !b.dead && b.team === p.id && !b.def.wall && !b.def.gate && b.type !== 'farm' && b.type !== 'house');
    if (!hasU && !hasB) {
      p.alive = false;
      for (const b of G.blds) if (b.team === p.id && !b.dead) kill(b, null);
      G.msg(p.id === G.human ? 'Tu imperio ha caído.' : p.name + ' ha sido derrotado.', p.id === G.human ? '#ff6a5a' : '#ffd27a', { sound: 'horn' });
    }
  }
  if (G.over) return;
  const alive = G.players.filter(p => p.alive);
  if (G.human >= 0) {
    if (!G.players[G.human].alive) endGame(false);
    else if (alive.every(p => isAlly(p.id, G.human))) endGame(true);
  } else if (alive.length <= 1 || alive.every(p => isAlly(p.id, alive[0].id))) endGame(true);
}
function addFx(key, x, y, opts) { G.fx.push(Object.assign({ key, x, y, t: 0, life: (PE.ART.fx[key] && PE.ART.fx[key].frames || 6) / 12 }, opts || {})); }

// --------------------------------------------------------------- guarnición y campana de alarma
function restoreOrder(u) {
  const o = u.prevOrder; u.prevOrder = null;
  if (o && o.t === 'gather' && o.res && !o.res.dead) startGather(u, o.res);
  else if (o && o.t === 'farm' && o.b && !o.b.dead) { if (!startFarm(u, o.b)) setOrder(u, { t: 'idle' }); }
  else if (o && o.t === 'build' && o.b && !o.b.dead) setOrder(u, { t: 'build', b: o.b });
  else if (o && o.t === 'return') setOrder(u, { t: 'return', res: o.res, kind: o.kind, farm: o.farm });
  else setOrder(u, { t: 'idle' });
}
function ejectOne(u, b, hurt) {
  u.inside = null; const p = freeSpotNear(b); u.x = p.x; u.y = p.y; u.path = [];
  if (hurt) { u.hp -= u.maxhp * 0.3; if (u.hp <= 0) { kill(u, null); return; } }
  restoreOrder(u);
}
function ejectAll(b, hurt) { const g = b.garrison || []; b.garrison = []; for (const u of g) if (!u.dead) ejectOne(u, b, hurt); }
function garrisonSpots(team) { return G.blds.filter(b => !b.dead && b.done && b.team === team && b.def.garrison); }
/** Campana: los aldeanos cercanos se refugian en el centro urbano, torres o castillo más cercanos. */
function ringBell(team) {
  const spots = garrisonSpots(team); if (!spots.length) return 0;
  const used = new Map(spots.map(b => [b, (b.garrison || []).length])); let n = 0;
  for (const u of G.units) {
    if (u.dead || u.inside || u.team !== team || u.def.role !== 'worker' || u.order.t === 'garrison') continue;
    const best = spots.filter(b => used.get(b) < b.def.garrison).sort((a, c) => dist(centerOf(a), u) - dist(centerOf(c), u))[0];
    if (!best || dist(centerOf(best), u) > 24 * T) continue;
    used.set(best, used.get(best) + 1); u.prevOrder = u.order; setOrder(u, { t: 'garrison', b: best }); n++;
  }
  if (team === G.human) G.msg('¡Toque de campana! ' + n + ' aldeanos se refugian', '#ffd27a', { sound: 'horn' });
  G.players[team].bell = true; return n;
}
function releaseBell(team) {
  for (const b of garrisonSpots(team)) { const keep = []; for (const u of b.garrison || []) { if (u.dead) continue; if (u.def.role === 'worker') ejectOne(u, b); else keep.push(u); } b.garrison = keep; }
  for (const u of G.units) if (!u.dead && u.team === team && u.order.t === 'garrison' && u.def.role === 'worker') restoreOrder(u);
  G.players[team].bell = false;
  if (team === G.human) G.msg('Los aldeanos vuelven al trabajo', '#cfe8a0');
}

// --------------------------------------------------------------- comercio y tributo
function marketTrade(team, res, buy) {
  const p = G.players[team], price = Math.round(p.market[res]);
  if (buy) { if (p.res.gold < price) return 'Falta oro'; p.res.gold -= price; p.res[res] += 100; p.market[res] *= 1.03; }
  else { if (p.res[res] < 100) return 'Faltan ' + RES_N[res].toLowerCase(); p.res[res] -= 100; p.res.gold += Math.round(price * 0.7); p.market[res] = Math.max(25, p.market[res] * 0.97); }
  return null;
}
function tribute(from, to, res, amt) {
  const p = G.players[from], q = G.players[to];
  if (p.res[res] < amt) return 'Recursos insuficientes';
  const hasMarket = G.blds.some(b => !b.dead && b.done && b.team === from && b.type === 'market');
  p.res[res] -= amt; q.res[res] += Math.round(amt * (hasMarket ? 1 : 0.8));
  changeRel(to, from, amt / 8);
  return null;
}
