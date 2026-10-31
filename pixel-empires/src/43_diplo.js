/* =====================================================================
   Diplomacia: posturas aliado / neutral / enemigo, relación (-100..100),
   propuestas, exigencias de tributo y decisiones de la IA.
   Aliados comparten visión, no se atacan y se ayudan en la defensa.
   ===================================================================== */
'use strict';
const STANCE_N = { ally: 'Aliado', neutral: 'Neutral', enemy: 'Enemigo' };
function changeRel(a, b, v) { if (!G.rel[a]) return; G.rel[a][b] = clamp((G.rel[a][b] || 0) + v, -100, 100); }
function setStance(a, b, s) {
  G.stance[a][b] = s; G.stance[b][a] = s; G.fogDirty = true;
  if (s !== 'enemy') { (G.treaty = G.treaty || {})[Math.min(a, b) + '_' + Math.max(a, b)] = G.time; for (const u of G.units) if (!u.dead && (u.team === a || u.team === b) && u.order.t === 'attack' && u.order.target && (u.order.target.team === a || u.order.target.team === b) && u.order.target.team !== u.team) setOrder(u, { t: 'idle' }); }
}
function strength(t) {
  let s = 0; for (const u of G.units) if (!u.dead && u.team === t && isMil(u)) s += costSum(u.def.cost) * levelMods(u.lvl).hp;
  for (const b of G.blds) if (!b.dead && b.team === t && b.def.atk) s += 150;
  return s;
}
function nameOf(t) { return t === G.human ? 'Tú' : G.players[t].name; }
function declareWar(a, b, auto) {
  if (a === b || G.stance[a][b] === 'enemy') return;
  if (!auto && !G.players[a].human && G.time - ((G.treaty || {})[Math.min(a, b) + '_' + Math.max(a, b)] ?? -999) < 240) return;
  setStance(a, b, 'enemy'); changeRel(b, a, -40); changeRel(a, b, -20);
  if (a === G.human) G.msg('Has declarado la guerra a ' + G.players[b].name, '#ff8a6a');
  else if (b === G.human) G.msg(G.players[a].name + (auto ? ' te ataca: ¡estáis en guerra!' : ' te ha declarado la guerra'), '#ff6a5a', { sound: 'horn' });
  else G.msg(G.players[a].name + ' declara la guerra a ' + G.players[b].name, '#d0c8e8');
  // los aliados de b se enfadan con a
  for (const q of G.players) if (q.alive && q.id !== b && q.id !== a && G.stance[q.id][b] === 'ally') changeRel(q.id, a, -15);
}
/** Respuesta de la IA a una propuesta. Devuelve [aceptada, motivo]. */
function aiConsider(ai, from, type) {
  const rel = G.rel[ai][from], sAi = strength(ai), sFrom = strength(from);
  if (type === 'peace') {
    if (G.stance[ai][from] !== 'enemy') return [false, 'Ya no estamos en guerra'];
    if (rel >= 0 || sAi < sFrom * 0.6) return [true, ''];
    return [false, rel < -40 ? 'No olvidamos tus ofensas' : 'Aún no confiamos en ti (relación ' + Math.round(rel) + ')'];
  }
  if (type === 'alliance') {
    if (G.stance[ai][from] === 'enemy') return [false, 'Primero firmemos la paz'];
    for (const q of G.players) if (q.alive && q.id !== ai && q.id !== from && G.stance[ai][q.id] === 'ally' && G.stance[from][q.id] === 'enemy') return [false, 'Estás en guerra con nuestro aliado ' + q.name];
    if (rel >= 40) return [true, ''];
    return [false, 'Necesitamos más confianza (relación ' + Math.round(rel) + '/40). Un tributo ayudaría.'];
  }
  return [false, ''];
}
/** Propuesta de un jugador a otro (humano → IA se resuelve al instante). */
function propose(from, to, type) {
  if (G.players[to].human) { if (G.proposals.some(p => p.from === from && p.type === type)) return null; G.proposals.push({ from, to, type, t: G.time }); G.msg(G.players[from].name + (type === 'alliance' ? ' propone una alianza' : ' propone la paz') + ' (responde a la derecha)', '#9fe8ff', { sound: 'alert' }); return null; }
  const [ok, why] = aiConsider(to, from, type);
  if (ok) {
    setStance(from, to, type === 'alliance' ? 'ally' : 'neutral'); changeRel(to, from, 10);
    if (from === G.human || to === G.human) G.msg(G.players[to].name + ' acepta ' + (type === 'alliance' ? 'la alianza' : 'la paz') + '.', '#9fe8a0', { sound: 'treasure' });
    else G.msg(G.players[from].name + ' y ' + G.players[to].name + (type === 'alliance' ? ' forman una alianza' : ' firman la paz'), '#d0c8e8');
  } else {
    changeRel(to, from, -2);
    if (from === G.human) G.msg(G.players[to].name + ' rechaza: ' + why, '#ffb070');
  }
  return ok ? null : why;
}
function breakAlliance(a, b) { if (G.stance[a][b] !== 'ally') return; setStance(a, b, 'neutral'); changeRel(b, a, -30); if (b === G.human) G.msg(G.players[a].name + ' rompe la alianza contigo', '#ffb070'); else if (a === G.human) G.msg('Has roto la alianza con ' + G.players[b].name, '#ffb070'); }
function respondProposal(i, accept) {
  const pr = G.proposals[i]; if (!pr) return; G.proposals.splice(i, 1);
  const a = pr.from, me = pr.to;
  if (pr.type === 'tribute') {
    if (accept) { if (G.players[me].res[pr.res] >= pr.amt) { G.players[me].res[pr.res] -= pr.amt; G.players[a].res[pr.res] += pr.amt; changeRel(a, me, 25); G.msg('Pagas el tributo a ' + G.players[a].name, '#d0c8e8'); } else { changeRel(a, me, -20); G.msg('No tienes recursos suficientes para el tributo', '#ffb070'); } }
    else { changeRel(a, me, -25); G.msg(G.players[a].name + ' toma nota de tu negativa', '#ffb070'); if (G.rel[a][me] < -30 && strength(a) > strength(me)) declareWar(a, me); }
    return;
  }
  if (accept) { setStance(a, me, pr.type === 'alliance' ? 'ally' : 'neutral'); changeRel(a, me, 15); G.msg('Aceptas ' + (pr.type === 'alliance' ? 'la alianza' : 'la paz') + ' con ' + G.players[a].name, '#9fe8a0'); }
  else { changeRel(a, me, -10); }
}
function diploStep(dt) {
  G.proposals = G.proposals || [];
  G.proposals = G.proposals.filter(p => G.time - p.t < 60);
  if ((G.dipT = (G.dipT ?? 45) - dt) > 0) return;
  G.dipT = 25 + Math.random() * 20;
  const ps = G.players.filter(p => p.alive);
  for (const a of ps) for (const b of ps) {
    if (a.id >= b.id) continue;
    const st = G.stance[a.id][b.id];
    // deriva natural de la relación
    const lastFight = G.fought[a.id + '_' + b.id] ?? -999, calm = G.time - lastFight > 240;
    const drift = st === 'enemy' ? (calm ? 1.5 : -1) : st === 'ally' ? 1.2 : 0.8;
    changeRel(a.id, b.id, drift); changeRel(b.id, a.id, drift);
    // enemigos comunes acercan
    for (const c of ps) if (c.id !== a.id && c.id !== b.id && G.stance[a.id][c.id] === 'enemy' && G.stance[b.id][c.id] === 'enemy') { changeRel(a.id, b.id, 0.8); changeRel(b.id, a.id, 0.8); }
  }
  // iniciativas de la IA (una por ronda para no saturar)
  const ais = ps.filter(p => !p.human); if (!ais.length) return;
  const a = ais[Math.floor(Math.random() * ais.length)];
  const others = ps.filter(q => q.id !== a.id); if (!others.length) return;
  const b = others[Math.floor(Math.random() * others.length)];
  const st = G.stance[a.id][b.id], rel = G.rel[a.id][b.id], sa = strength(a.id), sb = strength(b.id);
  const calmAB = G.time - (G.fought[Math.min(a.id, b.id) + '_' + Math.max(a.id, b.id)] ?? -999) > 240;
  if (st === 'enemy' && G.time > 300 && ((rel > 5 && calmAB) || sa < sb * 0.5) && Math.random() < 0.5) propose(a.id, b.id, 'peace');
  else if (st === 'neutral' && rel > 50 && Math.random() < 0.5) propose(a.id, b.id, 'alliance');
  else if (st !== 'enemy' && rel < -35 && sa > sb * 1.2 && G.time > 400) declareWar(a.id, b.id);
  else if (st === 'neutral' && sa > sb * 1.6 && G.time > 900 && Math.random() < 0.3) { declareWar(a.id, b.id); if (b.human) G.msg(a.name + ' codicia tus tierras', '#ff8a6a'); }
  else if (b.human && st === 'neutral' && sa > sb * 1.5 && Math.random() < 0.35 && G.time > 420) {
    const res = ['gold', 'food', 'wood'][Math.floor(Math.random() * 3)], amt = 150 + Math.floor(Math.random() * 3) * 50;
    G.proposals.push({ from: a.id, to: b.id, type: 'tribute', res, amt, t: G.time });
    G.msg(a.name + ' exige ' + amt + ' de ' + RES_N[res].toLowerCase() + ' como tributo', '#ffb070', { sound: 'alert' });
  } else if (st === 'ally' && rel < 10 && Math.random() < 0.3) breakAlliance(a.id, b.id);
}
