import { ANIMALS, BLD, DIFFICULTY, GAIA, HOSTILE, RES, T, TECHS, UNITS } from '../data/data.js';
import { sgEach } from '../sim/path.js';
import { G, RES_TYPE, ageReqCount, canAfford, canPlace, centerOf, costOf, dist, distRect, enqueue, findRes, isActive, isAlly, isAnimal, isEnemy, isMil, marketTrade, rectOf, releaseBell, ringBell, setMove, setOrder, startFarm, startGather, tryBuild } from '../sim/game.js';
/* =====================================================================
   IA de los rivales: reparte aldeanos por recurso, construye casas,
   puntos de acopio, granjas y edificios militares, avanza de era,
   investiga, entrena un ejército mixto, defiende y ataca en oleadas.
   ===================================================================== */
const AI_SHARE = { 1: { food: 0.5, wood: 0.38, gold: 0.08, stone: 0.04, iron: 0 }, 2: { food: 0.36, wood: 0.28, gold: 0.18, stone: 0.06, iron: 0.12 }, 3: { food: 0.34, wood: 0.22, gold: 0.18, stone: 0.12, iron: 0.14 } };
function aiInit() {
  for (const p of G.players) {
    if (p.human) continue;
    const D = DIFFICULTY[p.diff];
    p.ai = { t: 1 + p.id * 0.37, think: D.think, attackT: D.firstAttack * (0.85 + Math.random() * 0.3), wave: 0, waveSize: 8, attacking: false, target: null, lastDef: -99 };
  }
}
function aiStep(dt) {
  for (const p of G.players) {
    if (!p.ai || !p.alive) continue;
    if ((p.ai.t -= dt) <= 0) { p.ai.t = p.ai.think; try { aiThink(p); } catch (e) { console.error('IA', p.name, e); } }
  }
}
function aiSpot(team, type, near, minR = 3, maxR = 18, margin = 1) {
  const fp = BLD[type].fp, cx = Math.round(near.x / T - fp / 2), cy = Math.round(near.y / T - fp / 2), m = G.map;
  for (let r = minR; r <= maxR; r++) {
    const c = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) c.push([cx + dx, cy + dy]);
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    for (const [x, y] of c) {
      if (!canPlace(team, type, x, y)) continue;
      let ok = true;
      if (margin) for (let yy = y - margin; yy < y + fp + margin && ok; yy++) for (let xx = x - margin; xx < x + fp + margin; xx++) {
        if (xx < 0 || yy < 0 || xx >= m.W || yy >= m.H) { ok = false; break; }
        const i = yy * m.W + xx; if (m.blocked[i] && !(xx >= x && xx < x + fp && yy >= y && yy < y + fp)) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
  }
  return null;
}
function aiThink(p) {
  const team = p.id, race = p.race, ai = p.ai;
  const all = G.units.filter(u => !u.dead && u.team === team && !isAnimal(u)), mine = all.filter(isActive);
  const workers = mine.filter(u => u.def.role === 'worker'), army = mine.filter(u => isMil(u));
  const blds = G.blds.filter(b => !b.dead && b.team === team);
  const ofType = t => blds.filter(b => b.type === t), doneOf = t => blds.filter(b => b.type === t && b.done);
  const tc = doneOf('tc')[0] || blds[0]; if (!tc) return;
  const home = centerOf(tc);
  const reserve = { food: 0, gold: 0, wood: 0, stone: 0, iron: 0 };
  const ageTech = p.age === 1 ? 'age2' : p.age === 2 ? 'age3' : null;
  const wantAge = ageTech && ageReqCount(team) >= 2 && !p.researching.has(ageTech) && workers.length >= (p.age === 1 ? 14 : 22) * (race === 'giant' ? 0.7 : 1);
  if (wantAge) Object.assign(reserve, TECHS[ageTech].cost);
  if (p.age >= 3 && !blds.some(b => b.type === 'castle')) reserve.stone = 600;
  const castle = blds.find(b => b.type === 'castle' && b.done);
  if (castle && !(p.generalId && G.byId.get(p.generalId)) && !castle.queue.length) { const gc = costOf(team, UNITS[race + '_general'].cost); if (canAfford(team, gc)) enqueue(castle, 'unit', race + '_general'); else for (const k in gc) reserve[k] = Math.max(reserve[k] || 0, gc[k]); }
  // mercado: vender excedentes y comprar lo que falta
  if (blds.some(b => b.type === 'market' && b.done)) {
    for (const r of ['wood', 'stone', 'iron', 'food']) if (p.res[r] > 900 + (reserve[r] || 0)) marketTrade(team, r, false);
    const need = ['food', 'wood', 'iron', 'stone'].sort((a, b) => p.res[a] - p.res[b])[0];
    if (p.res.gold > 700 && p.res[need] < 200) marketTrade(team, need, true);
  }
  const spare = (cost, mil) => { const rv = mil && army.length < 6 + p.age * 2 ? {} : reserve; for (const k in cost) if (p.res[k] - (rv[k] || 0) < cost[k]) return false; return true; };
  if (wantAge && canAfford(team, costOf(team, TECHS[ageTech].cost)) && !tc.queue.some(q => q.kind === 'tech')) enqueue(tc, 'tech', ageTech);

  // --- aldeanos
  const target = Math.round([0, 24, 40, 56][p.age] * (race === 'giant' ? 0.7 : 1));
  const queuedW = tc.queue.filter(q => q.key === race + '_worker').length;
  const allW = all.filter(u => u.def.role === 'worker').length;
  if (allW + queuedW < target && tc.queue.length < 2 && p.pop < p.popCap && spare(costOf(team, UNITS[race + '_worker'].cost))) enqueue(tc, 'unit', race + '_worker');

  // --- reparto de recursos
  const kindOf = u => { const o = u.order; if (o.t === 'gather') return RES_TYPE[o.kind]; if (o.t === 'farm') return 'food'; if (o.t === 'return') return u.ckind; if (o.t === 'build') return 'build'; return null; };
  const count = { food: 0, wood: 0, gold: 0, stone: 0, iron: 0, build: 0 };
  for (const w of workers) { const k = kindOf(w); if (k) count[k]++; }
  const share = AI_SHARE[p.age], idle = workers.filter(w => w.order.t === 'idle');
  const deficit = () => RES.map(r => [r, share[r] * workers.length - count[r]]).sort((a, b) => b[1] - a[1]);
  for (const w of idle) {
    for (const [r] of deficit()) { if (aiAssign(p, w, r, home)) { count[r]++; break; } }
  }
  // reequilibrio suave
  const d = deficit(); if (d[0][1] > 2.5) { const over = d[d.length - 1][0]; const w = workers.find(u => kindOf(u) === over && !u.carry); if (w && aiAssign(p, w, d[0][0], home)) { count[over]--; count[d[0][0]]++; } }

  // --- construcción
  const building = blds.filter(b => !b.done).length;
  for (const b of blds) if (!b.done && b.nb === 0 && !G.units.some(u => !u.dead && u.order.b === b)) { const w = workers.filter(u => u.order.t !== 'build').sort((a, c) => dist(a, centerOf(b)) - dist(c, centerOf(b)))[0]; if (w) setOrder(w, { t: 'build', b }); }
  const build = (type, near, minR, maxR, nB = 1) => {
    const c = costOf(team, BLD[type].cost); if (!spare(c)) return false;
    const s = aiSpot(team, type, near || home, minR || 3, maxR || 18, type === 'farm' ? 0 : 1) || aiSpot(team, type, near || home, minR || 3, (maxR || 18) + 12, 0); if (!s) return false;
    const pick = workers.filter(w => w.order.t !== 'build').sort((a, b) => Math.hypot(a.x - s.x * T, a.y - s.y * T) - Math.hypot(b.x - s.x * T, b.y - s.y * T)).slice(0, nB);
    if (!pick.length) return false;
    const r = tryBuild(team, type, s.x, s.y, pick); return typeof r !== 'string';
  };
  if (p.popCap < 200 && p.pop + 4 + Math.floor(p.pop / 12) >= p.popCap && ofType('house').filter(b => !b.done).length < (p.pop > 40 ? 2 : 1)) build('house', home, 4, 14);
  if (building < 2 + p.age) {
    // puntos de acopio cerca de recursos lejanos
    const farFrom = (kind, type) => {
      const gs = workers.filter(w => w.order.t === 'gather' && w.order.kind === kind && w.order.res);
      if (gs.length < 3) return false;
      const r = gs[0].order.res, drops = blds.filter(b => b.def.drop && b.def.drop.includes(RES_TYPE[kind]));
      const dmin = Math.min(...drops.map(b => distRect(r.tx * T, r.ty * T, rectOf(b))));
      if (dmin > 6 * T && !ofType(type).some(b => !b.done)) return build(type, { x: r.tx * T, y: r.ty * T }, 2, 6);
      return false;
    };
    farFrom('tree', 'lumber') || farFrom('gold', 'mine') || farFrom('stone', 'mine') || farFrom('iron', 'mine') || farFrom('berry', 'mill');
    if (!ofType('barracks').length && workers.length >= 9) build('barracks', home, 5, 14, 2);
    if (!ofType('mill').length && workers.length >= 8) { const b = findRes({ x: home.x, y: home.y }, 'berry', 16); build('mill', b ? { x: b.tx * T, y: b.ty * T } : home, 2, 8); }
    if (!ofType('lumber').length && workers.length >= 7) { const t = findRes({ x: home.x, y: home.y }, 'tree', 20); if (t) build('lumber', { x: t.tx * T, y: t.ty * T }, 2, 6); }
    if (!ofType('mine').length && workers.length >= 12) { const g = findRes({ x: home.x, y: home.y }, 'gold', 20); if (g) build('mine', { x: g.tx * T, y: g.ty * T }, 2, 6); }
    // granjas cuando se acaba la comida silvestre
    const foodW = count.food, farms = ofType('farm').length, wild = (G.resBy.berry || []).some(r => !r.dead && Math.hypot(r.tx * T - home.x, r.ty * T - home.y) < 18 * T);
    if ((!wild || p.age >= 2) && farms < Math.max(2, foodW) && farms < 14) { const mill = doneOf('mill')[0]; build('farm', mill ? centerOf(mill) : home, 2, 10); }
    if (p.age >= 2) {
      for (const t of ['range', 'forge', 'stable', 'temple', 'market']) if (!ofType(t).length) { if (build(t, home, 5, 16, 2)) break; }
      if (ofType('tower').length < 2 && p.res.stone > 200) build('tower', { x: home.x + (G.map.W * T / 2 - home.x) * 0.15, y: home.y + (G.map.H * T / 2 - home.y) * 0.15 }, 3, 10);
      if (ofType('barracks').length < 2 && p.res.wood > 400) build('barracks', home, 6, 16, 2);
    }
    if (p.age >= 3) {
      if (!ofType('workshop').length) build('workshop', home, 6, 18, 2);
      if (!ofType('castle').length && p.res.stone >= 600) build('castle', home, 6, 18, 4);
      if (ofType('stable').length < 2 && p.res.wood > 600) build('stable', home, 6, 18, 2);
    }
  }
  // --- tecnologías
  const techOrder = ['loom', 'axe', 'pick', 'plow', 'melee1', 'armor1', 'ranged1', 'march', 'ranged0', 'cavspeed', 'heal', 'axe2', 'pick2', 'unique', 'melee2', 'armor2', 'ranged2', 'masonry'];
  for (const k of techOrder) {
    if (p.techs.has(k) || p.researching.has(k)) continue;
    if (k === 'loom' && workers.length < 12) continue;
    const b = blds.find(o => o.done && (o.def.techs || []).includes(k) && o.queue.length === 0);
    if (!b || !spare(costOf(team, TECHS[k].cost))) continue;
    if (enqueue(b, 'tech', k) === null) break;
  }
  // --- ejército
  for (const b of blds) {
    if (!b.done || !b.def.train || b.type === 'tc' || b.queue.length >= 2) continue;
    let roles = b.def.train.slice();
    if (b.type === 'barracks') roles = Math.random() < 0.62 ? ['inf'] : ['pike'];
    if (b.type === 'workshop' && army.filter(u => u.def.role === 'siege').length >= 3) continue;
    if (b.type === 'temple' && army.filter(u => u.def.role === 'special').length > army.length / 5) continue;
    if (b.type === 'castle') { if (p.generalId && G.byId.get(p.generalId)) continue; }
    const key = race + '_' + roles[Math.floor(Math.random() * roles.length)], def = UNITS[key];
    if (def.age > p.age || !spare(costOf(team, def.cost), true)) continue;
    if (p.pop + def.pop > p.popCap && !def.unique) continue;
    enqueue(b, 'unit', key);
  }
  // --- defensa
  let threat = null;
  for (const b of blds) { const c = centerOf(b); sgEach(c.x, c.y, 12 * T, u => { if (isEnemy(team, u.team) && !(isAnimal(u) && u.team === GAIA) && (isMil(u) || u.team === HOSTILE)) { threat = u; return true; } }); if (threat) break; }
  if (threat) {
    G.underAttack = G.underAttack || {}; G.underAttack[team] = { t: G.time, x: threat.x, y: threat.y };
    // campana si el enemigo supera a la defensa cerca del centro urbano
    let foes = 0, mine2 = 0; sgEach(home.x, home.y, 12 * T, u => { if (isEnemy(team, u.team) && (isMil(u) || u.team === HOSTILE)) foes += u.def.pop; else if (u.team === team && isMil(u)) mine2 += u.def.pop; });
    if (!p.bell && foes >= 4 && foes > mine2 * 1.3 && dist(threat, home) < 10 * T) { ringBell(team); ai.bellT = G.time; }
    for (const u of army) if (u.order.t === 'idle' || (u.order.t === 'move' && !ai.attacking)) setMove(u, threat.x, threat.y, true);
    return;
  }
  if (p.bell && G.time - (ai.bellT || 0) > 15) releaseBell(team);
  // ayudar a aliados atacados
  if (G.underAttack) for (const k in G.underAttack) { const ua = G.underAttack[k]; if (+k !== team && isAlly(team, +k) && G.time - ua.t < 10 && !ai.attacking && army.length > 4) { for (const u of army.slice(0, Math.ceil(army.length / 2))) if (u.order.t === 'idle') setMove(u, ua.x, ua.y, true); } }
  // --- ataque en oleadas
  const armyPop = army.reduce((s, u) => s + u.def.pop, 0);
  if (ai.attacking) {
    if (army.length < 3) { ai.attacking = false; ai.attackT = G.time + 120 * DIFFICULTY[p.diff].wave; }
    else {
      const tp = G.players[ai.target];
      if (!tp || !tp.alive || !isEnemy(team, ai.target)) ai.attacking = false;
      else for (const u of army) if (u.order.t === 'idle') { const tg = aiTargetBld(team, ai.target, u); if (tg) { const c = centerOf(tg); setMove(u, c.x, c.y, true); } }
    }
  } else if (G.time > ai.attackT && armyPop >= ai.waveSize) {
    const enemies = G.players.filter(q => q.alive && q.id !== team && isEnemy(team, q.id));
    if (enemies.length) {
      enemies.sort((a, b) => dist(G.map.starts[a.id], G.map.starts[team]) - dist(G.map.starts[b.id], G.map.starts[team]));
      ai.target = (Math.random() < 0.7 ? enemies[0] : enemies[Math.floor(Math.random() * enemies.length)]).id;
      const tg = aiTargetBld(team, ai.target, { x: home.x, y: home.y });
      if (tg) {
        const c = centerOf(tg); for (const u of army) setMove(u, c.x, c.y, true);
        ai.attacking = true; ai.wave++; ai.waveSize = Math.min(60, ai.waveSize + 5); ai.attackT = G.time + 150 * DIFFICULTY[p.diff].wave;
        if (ai.target === G.human) G.msg('Exploradores avisan: el ejército de ' + p.name + ' marcha hacia ti', '#ff8a6a', { sound: 'alert' });
      }
    }
  } else {
    // reagrupar en el punto de reunión
    const rally = { x: home.x + (G.map.W * T / 2 - home.x) * 0.12, y: home.y + (G.map.H * T / 2 - home.y) * 0.12 };
    for (const u of army) if (u.order.t === 'idle' && dist(u, rally) > 5 * T) { setMove(u, rally.x + (Math.random() - 0.5) * 48, rally.y + (Math.random() - 0.5) * 48); u.order.home = null; }
  }
}
function aiTargetBld(team, enemy, from) {
  let best = null, bd = 1e9;
  for (const b of G.blds) if (!b.dead && b.team === enemy && !b.def.wall) { const d = dist(centerOf(b), from); if (d < bd) { bd = d; best = b; } }
  if (!best) for (const u of G.units) if (!u.dead && u.team === enemy && !isAnimal(u)) { const d = dist(u, from); if (d < bd) { bd = d; best = u; } }
  return best;
}
function aiAssign(p, w, r, home) {
  const from = { x: home.x, y: home.y };
  if (r === 'food') {
    const berry = findRes(from, 'berry', 16); if (berry) { startGather(w, berry); return true; }
    const carc = findRes(w, 'carcass', 14); if (carc) { startGather(w, carc); return true; }
    const herd = G.units.find(a => !a.dead && isAnimal(a) && a.team === p.id && ANIMALS[a.def.animal].herd && dist(a, w) < 20 * T);
    if (herd) { setOrder(w, { t: 'attack', target: herd, forced: true }); return true; }
    const farm = G.blds.find(b => !b.dead && b.done && b.team === p.id && b.type === 'farm' && (!b.farmer || !G.byId.get(b.farmer) || G.byId.get(b.farmer).order.b !== b));
    if (farm) return startFarm(w, farm);
    const fish = findRes(from, 'fish', 14); if (fish) { startGather(w, fish); return true; }
    const deer = G.units.find(a => !a.dead && isAnimal(a) && a.def.animal === 'deer' && dist(a, w) < 16 * T);
    if (deer) { setOrder(w, { t: 'attack', target: deer, forced: true }); return true; }
    return false;
  }
  const kinds = r === 'wood' ? ['tree'] : r === 'gold' ? ['gold', 'gems'] : [r];
  for (const k of kinds) { const res = findRes(from, k, 32); if (res) { startGather(w, res); return true; } }
  return false;
}

export { AI_SHARE, aiInit, aiStep, aiSpot, aiThink, aiTargetBld, aiAssign };
