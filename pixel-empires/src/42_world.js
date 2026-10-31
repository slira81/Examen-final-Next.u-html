/* =====================================================================
   Mundo vivo: niebla de guerra, clima, fuego, desastres naturales,
   campamentos hostiles, tesoros, reliquias y comportamiento animal.
   ===================================================================== */
'use strict';
Object.assign(BLD, {
  bandit_camp: { key: 'bandit_camp', n: 'Campamento de bandidos', fp: 3, hp: 1400, arm: 2, parm: 6, los: 6, cost: { wood: 200 }, time: 1, age: 9 },
  goblin_hut: { key: 'goblin_hut', n: 'Choza goblin', fp: 2, hp: 800, arm: 1, parm: 4, los: 5, cost: { wood: 100 }, time: 1, age: 9 },
  shrine: { key: 'shrine', n: 'Santuario antiguo', fp: 2, hp: 5000, arm: 99, parm: 99, los: 3, cost: {}, time: 1, age: 9, invuln: true },
  ruins: { key: 'ruins', n: 'Ruinas', fp: 2, hp: 5000, arm: 99, parm: 99, los: 2, cost: {}, time: 1, age: 9, invuln: true, flat: true },
});
const CIRC = [];
for (let r = 0; r <= 16; r++) { const a = []; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) a.push([x, y]); CIRC.push(a); }

const WEATHER = {
  clear: { n: 'Despejado', w: 50 }, rain: { n: 'Lluvia', w: 18 }, fog: { n: 'Niebla', w: 12 },
  snow: { n: 'Nieve', w: 8 }, storm: { n: 'Tormenta', w: 7 },
};

function worldInit() {
  const m = G.map;
  G.weather = { cur: 'clear', t: 120 + m.rnd() * 120, a: 0, flash: 0, bolt: null };
  G.disT = 480 + m.rnd() * 300; G.fires = new Set();
  for (const poi of m.poi) {
    if (poi.type === 'bandit_camp' || poi.type === 'goblin_hut') {
      const b = placeBuilding(HOSTILE, poi.type, poi.x, poi.y, [], true);
      b.spawnT = 5; b.spawned = []; b.raidT = 480 + m.rnd() * 300;
      const n = poi.type === 'bandit_camp' ? 3 : 3;
      for (let k = 0; k < n; k++) spawnGuard(b);
    } else if (poi.type === 'shrine') {
      placeBuilding(GAIA, 'shrine', poi.x, poi.y, [], true);
      addTreasure('relic', poi.x + 2, poi.y + 2); addTreasure('gold_pile', poi.x - 1, poi.y + 2);
      const o = spawnUnit('neutral_ogre', HOSTILE, (poi.x + 1) * T, (poi.y + 3) * T + 8); o.order = { t: 'idle', home: { x: o.x, y: o.y } };
    } else if (poi.type === 'ruins') {
      placeBuilding(GAIA, 'ruins', poi.x, poi.y, [], true);
      addTreasure('chest', poi.x + 2, poi.y + 1);
      for (let k = 0; k < 2; k++) { const g = spawnUnit('neutral_goblin', HOSTILE, (poi.x + k) * T + 8, (poi.y + 2) * T + 8); g.order = { t: 'idle', home: { x: g.x, y: g.y } }; }
    } else if (poi.type === 'chest') addTreasure('chest', poi.x, poi.y);
    else if (poi.type === 'relic') addTreasure('relic', poi.x, poi.y);
  }
}
function spawnGuard(b) {
  const key = b.type === 'bandit_camp' ? (Math.random() < 0.35 ? 'neutral_bandit_archer' : 'neutral_bandit') : 'neutral_goblin';
  const p = freeSpotNear(b), u = spawnUnit(key, HOSTILE, p.x, p.y);
  u.order = { t: 'idle', home: { x: p.x, y: p.y } }; b.spawned.push(u);
}
function addTreasure(type, tx, ty) {
  const m = G.map; if (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H) return;
  const i = ty * m.W + tx; if (m.blocked[i]) { m.blocked[i] = TR_BLOCK[m.terr[i]]; if (m.res[i]) { m.res[i].dead = true; m.res[i] = null; } }
  G.treasures.push({ id: G.nextId++, k: 't', type, tx, ty, taken: false, ph: Math.random() * 4 });
}
function takeTreasure(tr, u) {
  if (tr.taken || !isPlayer(u.team)) return;
  tr.taken = true; const p = G.players[u.team], c = { x: tr.tx * T + 8, y: tr.ty * T + 8 };
  let text;
  if (tr.type === 'relic') { p.relics++; text = 'Reliquia sagrada: +0,5 de oro por segundo'; addFx('fx_magic', c.x, c.y); }
  else if (tr.type === 'gold_pile') { p.res.gold += 300; text = 'Tesoro: +300 de oro'; }
  else {
    const roll = Math.random();
    if (roll < 0.25) { p.res.gold += 200; text = 'Cofre: +200 de oro'; }
    else if (roll < 0.42) { p.res.food += 250; text = 'Cofre: +250 de comida'; }
    else if (roll < 0.57) { p.res.wood += 250; text = 'Cofre: +250 de madera'; }
    else if (roll < 0.70) { p.res.iron += 150; text = 'Cofre: +150 de hierro'; }
    else if (roll < 0.80) { p.res.stone += 200; text = 'Cofre: +200 de piedra'; }
    else if (roll < 0.92) { let n = 0; sgEach(u.x, u.y, 4 * T, a => { if (a.team === u.team && isMil(a)) { gainXP(a, 70); n++; } }); if (!n) p.res.gold += 150; text = n ? 'Cofre de veteranía: +70 XP a las tropas cercanas' : 'Cofre: +150 de oro'; }
    else { if (u.team === G.human) revealArea(tr.tx, tr.ty, 14); p.res.gold += 80; text = 'Mapa antiguo: revela la zona y +80 de oro'; }
    tr.open = true; tr.taken = true;
  }
  addFx('fx_levelup', c.x, c.y - 4);
  G.texts.push({ x: c.x, y: c.y - 16, text: text.split(':')[1] || text, color: '#ffd23a', t: 0, life: 2 });
  if (u.team === G.human) G.msg(text, '#ffd23a', { sound: 'treasure' });
}
function campReward(b, team) {
  const g = b.type === 'bandit_camp' ? 300 : b.type === 'goblin_hut' ? 150 : 0; if (!g) return;
  G.players[team].res.gold += g;
  if (team === G.human) G.msg(b.def.n + ' destruido: botín de ' + g + ' de oro', '#ffd23a', { sound: 'treasure' });
}
function revealArea(tx, ty, r) { const m = G.map; for (const [dx, dy] of CIRC[Math.min(16, r)]) { const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < m.W && y < m.H && !G.vis[y * m.W + x]) G.vis[y * m.W + x] = 1; } G.fogDirty = true; }

// --------------------------------------------------------------- visión
function updVision() {
  const m = G.map, v = G.vis, W = m.W, H = m.H;
  if (G.cfg.revealed || G.human < 0) { v.fill(2); G.fogDirty = true; return; }
  for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
  const fogK = G.weather.cur === 'fog' ? 0.7 : 1;
  const mark = (cx, cy, r) => { r = Math.max(1, Math.min(16, Math.round(r * fogK))); for (const [dx, dy] of CIRC[r]) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < W && y < H) v[y * W + x] = 2; } };
  for (const u of G.units) if (!u.dead && u.team < 8 && isAlly(u.team, G.human) && !isAnimal(u)) mark(tileOf(u.x), tileOf(u.y), u.def.los);
  for (const u of G.units) if (!u.dead && isAnimal(u) && u.team === G.human) mark(tileOf(u.x), tileOf(u.y), 3);
  for (const b of G.blds) if (!b.dead && b.team < 8 && isAlly(b.team, G.human)) mark(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1), b.def.los + (b.fp >> 1));
  G.fogDirty = true;
}
const visibleAt = (x, y) => { if (G.human < 0 || G.cfg.revealed) return true; const tx = tileOf(x), ty = tileOf(y); return tx >= 0 && ty >= 0 && tx < G.map.W && ty < G.map.H && G.vis[ty * G.map.W + tx] === 2; };
const exploredAt = (tx, ty) => G.human < 0 || G.cfg.revealed || (tx >= 0 && ty >= 0 && tx < G.map.W && ty < G.map.H && G.vis[ty * G.map.W + tx] > 0);

// --------------------------------------------------------------- paso del mundo
function worldStep(dt) {
  if ((G.visT = (G.visT || 0) - dt) <= 0) { G.visT = 0.25; updVision(); }
  weatherStep(dt);
  fireStep(dt);
  if (G.cfg.disasters && (G.disT -= dt) <= 0) { G.disT = 420 + Math.random() * 360; disaster(); }
  // reliquias
  for (const p of G.players) if (p.relics && p.alive) p.res.gold += p.relics * 0.5 * dt;
  if ((G.slowT = (G.slowT || 0) - dt) <= 0) {
    G.slowT = 0.5;
    // tesoros: los recoge cualquier unidad que pase cerca
    for (const tr of G.treasures) { if (tr.taken) continue; const c = { x: tr.tx * T + 8, y: tr.ty * T + 8 }; sgEach(c.x, c.y, 14, u => { if (isPlayer(u.team) && !isAnimal(u)) { takeTreasure(tr, u); return true; } }); }
    // ganado neutral pasa a quien llegue primero
    for (const u of G.units) {
      if (u.dead || u.team !== GAIA || !isAnimal(u) || !ANIMALS[u.def.animal].herd) continue;
      let best = null, bd = 3 * T; sgEach(u.x, u.y, 3 * T, o => { if (isPlayer(o.team) && !isAnimal(o)) { const d = dist(o, u); if (d < bd) { bd = d; best = o; } } });
      if (best) { u.team = best.team; if (best.team === G.human) G.msg('Has encontrado ganado: ' + u.def.n.toLowerCase(), '#cfe8a0'); }
    }
    // campamentos: generan guardias y lanzan incursiones
    for (const b of G.blds) {
      if (b.dead || b.team !== HOSTILE || !b.spawned) continue;
      b.spawned = b.spawned.filter(u => !u.dead);
      if ((b.spawnT -= 0.5) <= 0) { b.spawnT = b.type === 'bandit_camp' ? 70 : 90; if (b.spawned.length < (b.type === 'bandit_camp' ? 5 : 4)) spawnGuard(b); }
      if ((b.raidT -= 0.5) <= 0 && G.time > 360) {
        b.raidT = 240 + Math.random() * 180;
        const raiders = b.spawned.filter(u => u.order.t === 'idle');
        if (raiders.length >= 3) {
          let tgt = null, bd = 1e9; const c = centerOf(b);
          for (const o of G.blds) if (!o.dead && isPlayer(o.team) && !o.def.wall) { const d = dist(centerOf(o), c); if (d < bd) { bd = d; tgt = o; } }
          if (tgt && bd < 40 * T) { const tc = centerOf(tgt); for (const u of raiders) { setMove(u, tc.x, tc.y, true); u.order.home = null; } b.spawned = b.spawned.filter(u => !raiders.includes(u)); if (tgt.team === G.human) G.msg('¡Una incursión de ' + (b.type === 'bandit_camp' ? 'bandidos' : 'goblins') + ' se dirige a tu territorio!', '#ff8a6a', { ping: tc, sound: 'alert' }); }
        }
      }
    }
  }
}
// --------------------------------------------------------------- fauna
function animalAI(u, dt) {
  const A = ANIMALS[u.def.animal], o = u.order;
  if (o.t === 'attack' || (o.t === 'move' && !o.wander)) return;
  if ((u.wt = (u.wt || Math.random() * 4) - dt) > 0) return;
  u.wt = 0.6;
  if (A.flee) {
    let th = null; sgEach(u.x, u.y, 4 * T, e => { if (!isAnimal(e)) { th = e; return true; } });
    if (th) { const ang = Math.atan2(u.y - th.y, u.x - th.x) + (Math.random() - 0.5) * 0.6; setMove(u, u.x + Math.cos(ang) * 6 * T, u.y + Math.sin(ang) * 6 * T); u.order.wander = true; return; }
  }
  if (o.t === 'idle' && Math.random() < 0.18) {
    const home = u.home || { x: u.x, y: u.y }, r = A.herd ? 2.5 * T : 5 * T;
    const base = A.herd && isPlayer(u.team) ? { x: u.x, y: u.y } : home;
    setMove(u, base.x + (Math.random() - 0.5) * r * 2, base.y + (Math.random() - 0.5) * r * 2); u.order.wander = true;
  }
}

// --------------------------------------------------------------- clima
function weatherStep(dt) {
  const w = G.weather;
  w.a = Math.min(1, w.a + dt / 6);
  if (w.flash > 0) w.flash -= dt * 2.5;
  if (!G.cfg.weather) { w.cur = 'clear'; return; }
  if ((w.t -= dt) <= 0) {
    const cold = MAP_TYPES[G.cfg.mapType].cold || MAP_TYPES[G.cfg.mapType].snow;
    const weights = Object.entries(WEATHER).map(([k, v]) => [k, k === 'snow' ? (cold ? 30 : 4) : k === 'clear' ? v.w : v.w]);
    let r = Math.random() * weights.reduce((s, x) => s + x[1], 0), next = 'clear';
    for (const [k, wt] of weights) { r -= wt; if (r <= 0) { next = k; break; } }
    if (next !== w.cur) { w.prev = w.cur; w.cur = next; w.a = 0; if (G.time > 5) G.msg('El clima cambia: ' + WEATHER[next].n + (next === 'rain' || next === 'storm' ? ' (menor precisión a distancia)' : next === 'snow' ? ' (unidades más lentas)' : next === 'fog' ? ' (menos visión)' : ''), '#b8c8e8'); }
    w.t = next === 'clear' ? 150 + Math.random() * 150 : 70 + Math.random() * 90;
  }
  if (w.cur === 'storm' && (w.boltT = (w.boltT || 4) - dt) <= 0) {
    w.boltT = 5 + Math.random() * 10;
    const m = G.map; let x, y;
    if (Math.random() < 0.5 && G.cam) { x = G.cam.x + (Math.random() - 0.5) * 400; y = G.cam.y + (Math.random() - 0.5) * 260; } else { x = Math.random() * m.W * T; y = Math.random() * m.H * T; }
    x = clamp(x, 0, m.W * T - 1); y = clamp(y, 0, m.H * T - 1);
    w.flash = 1; w.bolt = { x, y, t: 0 }; addFx('fx_lightning', x, y - 20); sfx('thunder');
    sgEach(x, y, 20, u => { u.hp -= 25; if (u.hp <= 0) kill(u, null); });
    const r = G.map.res[tileOf(y) * m.W + tileOf(x)]; if (r && r.kind === 'tree' && Math.random() < 0.6) ignite(r);
    for (const b of G.blds) if (!b.dead && distRect(x, y, rectOf(b)) < 8 && !b.def.invuln) { b.hp -= 60; if (Math.random() < 0.3) b.fire = 10; }
  }
}

// --------------------------------------------------------------- fuego
function ignite(r) { if (r.dead || r.burn) return; r.burn = 8 + Math.random() * 6; G.fires.add(r); }
function fireStep(dt) {
  if (!G.fires.size) return;
  const m = G.map, rain = G.weather.cur === 'rain' || G.weather.cur === 'storm' || G.weather.cur === 'snow';
  for (const r of [...G.fires]) {
    r.burn -= dt * (rain ? 2.2 : 1); r.amt -= dt * 6;
    if (Math.random() < dt * (rain ? 0.05 : 0.35)) {
      const nx = r.tx + Math.round(Math.random() * 2 - 1), ny = r.ty + Math.round(Math.random() * 2 - 1);
      if (nx >= 0 && ny >= 0 && nx < m.W && ny < m.H) { const n = m.res[ny * m.W + nx]; if (n && n.kind === 'tree') ignite(n); }
    }
    const c = { x: r.tx * T + 8, y: r.ty * T + 8 };
    if ((r.dmgT = (r.dmgT || 0) - dt) <= 0) {
      r.dmgT = 1;
      sgEach(c.x, c.y, 18, u => { u.hp -= 4; if (u.hp <= 0) kill(u, null); });
      for (const b of G.blds) if (!b.dead && !b.def.invuln && distRect(c.x, c.y, rectOf(b)) < 10) { b.hp -= 10; if (!b.fire && Math.random() < 0.15) b.fire = 10; if (b.hp <= 0) kill(b, null); }
    }
    if (r.burn <= 0 || r.amt <= 0) { G.fires.delete(r); r.burn = 0; if (r.amt <= 0 || Math.random() < 0.7) { depleteRes(r); G.decals.push({ key: 'scorch', tx: r.tx, ty: r.ty, v: Math.floor(Math.random() * 2) }); } }
  }
}

// --------------------------------------------------------------- desastres
function disaster() {
  const alive = G.players.filter(p => p.alive); if (!alive.length) return;
  const p = alive[Math.floor(Math.random() * alive.length)], s = G.map.starts[p.id];
  const kind = ['fire', 'quake', 'locust'][Math.floor(Math.random() * 3)];
  const near = { x: (s.x + (Math.random() - 0.5) * 30) * T, y: (s.y + (Math.random() - 0.5) * 30) * T };
  if (kind === 'fire') {
    let best = null, bd = 1e9; for (const r of G.resBy.tree || []) { if (r.dead) continue; const d = Math.hypot(r.tx * T - near.x, r.ty * T - near.y); if (d < bd) { bd = d; best = r; } }
    if (!best || G.weather.cur === 'rain') return;
    ignite(best); for (let k = 0; k < 3; k++) { const n = G.map.res[(best.ty + k - 1) * G.map.W + best.tx + 1]; if (n && n.kind === 'tree') ignite(n); }
    G.msg('¡Desastre! Un incendio forestal se propaga' + (p.id === G.human ? ' cerca de tu aldea' : ' en tierras de ' + p.name), '#ff8a4a', { ping: { x: best.tx * T, y: best.ty * T }, sound: 'alert' });
  } else if (kind === 'quake') {
    const c = { x: s.x * T, y: s.y * T }; G.shake = 3.5; sfx('quake');
    for (const b of G.blds) if (!b.dead && !b.def.invuln && dist(centerOf(b), c) < 14 * T) { b.hp -= b.maxhp * (0.1 + Math.random() * 0.12); if (b.hp <= 0) kill(b, null); }
    sgEach(c.x, c.y, 14 * T, u => { u.stun = Math.max(u.stun, 1.2); });
    for (let k = 0; k < 10; k++) addFx('fx_dust', c.x + (Math.random() - 0.5) * 300, c.y + (Math.random() - 0.5) * 200);
    G.msg('¡Desastre! Un terremoto sacude ' + (p.id === G.human ? 'tu reino' : 'el territorio de ' + p.name), '#ff8a4a', { ping: c, sound: 'alert' });
  } else {
    let n = 0; for (const b of G.blds) if (!b.dead && b.team === p.id && b.type === 'farm') { b.food = Math.floor(b.food * 0.4); n++; }
    for (const r of G.resBy.berry || []) if (!r.dead && Math.hypot(r.tx - s.x, r.ty - s.y) < 16) r.amt = Math.floor(r.amt * 0.5);
    G.msg('¡Desastre! Una plaga de langostas arrasa ' + (n ? 'los cultivos' : 'los arbustos') + (p.id === G.human ? ' de tu aldea' : ' de ' + p.name), '#ff8a4a', { sound: 'alert' });
  }
}
