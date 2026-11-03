/* =====================================================================
   Órdenes del jugador. La interfaz llama a estas funciones en lugar de
   tocar la simulación directamente:
     · partida normal: se ejecutan al instante (igual que antes);
     · multijugador: se codifican (entidades por id) y se envían; ambos
       navegadores las ejecutan en el mismo tick (ver net.js).
   El ejecutor comprueba que cada orden solo mueva lo del jugador que la
   dio (lo recibido por la red no es de fiar).
   ===================================================================== */
import { G, castAbility as simCast, cancelQueue as simCancelQueue, cmdAttack as simAttack, cmdMove as simMove, costOf, ejectAll as simEject, enqueue as simEnqueue, kill as simKill, marketTrade as simMarket, refund, releaseBell as simRelease, removeBuilding, ringBell as simRing, setMove as simSetMove, setOrder as simSetOrder, startFarm as simStartFarm, startGather as simGather, tribute as simTribute, tryBuild as simTryBuild } from '../sim/game.js';
import { breakAlliance as simBreak, declareWar as simWar, propose as simPropose, respondProposal as simRespond } from '../world/diplo.js';
import { NET, issue } from './net.js';
import { buildRoadFor } from '../ui/ui.js';

// ------------------------------------------------------------ codificación de argumentos
function enc(v) {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? null : v;
  if (Array.isArray(v)) return v.map(enc);
  if (v.k === 'u' || v.k === 'b') return { $e: v.id };
  if (v.k === 't') return { $t: v.id };
  if (v.k === 'r') return v.kind === 'carcass' ? { $c: v.id } : { $r: [v.tx, v.ty] };
  if (v.k === 'p') return { $p: [v.x, v.y] };
  const o = {}; for (const k in v) if (typeof v[k] !== 'function') o[k] = enc(v[k]); return o;
}
const MISSING = Symbol('missing');
function dec(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(dec).filter(x => x !== MISSING && !(x && x.dead));
  if ('$e' in v) { const e = G.byId.get(v.$e); return e && !e.dead ? e : MISSING; }
  if ('$t' in v) return G.treasures.find(t => t.id === v.$t && !t.taken) || MISSING;
  if ('$c' in v) return (G.resBy.carcass || []).find(r => r.id === v.$c && !r.dead) || MISSING;
  if ('$r' in v) { const r = G.map.res[v.$r[1] * G.map.W + v.$r[0]]; return r && !r.dead ? r : MISSING; }
  if ('$p' in v) return { k: 'p', x: v.$p[0], y: v.$p[1], dead: false, def: { size: 1 } };
  const o = {}; for (const k in v) { const d = dec(v[k]); o[k] = d === MISSING ? null : d; } return o;
}
const own = (team, e) => e && e !== MISSING && e.team === team;
const ownAll = (team, a) => Array.isArray(a) ? a.filter(e => own(team, e)) : [];
/** Error de una orden propia: se avisa solo al jugador que la dio (evita repetir el mismo aviso). */
let lastErr = '', lastErrT = -1;
function err(team, r) { if (typeof r !== 'string' || team !== G.human) return; if (r === lastErr && G.time - lastErrT < 1) return; lastErr = r; lastErrT = G.time; G.msg(r, '#ffb070', { sound: 'error' }); }

// ------------------------------------------------------------ ejecutores (se ejecutan en los dos navegadores)
const EXEC = {
  setOrder(team, [u, o]) { if (own(team, u) && o) simSetOrder(u, o); },
  cmdMove(team, [us, x, y, am]) { const a = ownAll(team, us); if (a.length) simMove(a, x, y, am); },
  cmdAttack(team, [us, t]) { const a = ownAll(team, us); if (a.length && t && t !== MISSING) simAttack(a, t); },
  setMove(team, [u, x, y, f]) { if (own(team, u)) simSetMove(u, x, y, f); },
  startGather(team, [u, r]) { if (own(team, u) && r && r !== MISSING) simGather(u, r); },
  startFarm(team, [u, b]) { if (own(team, u) && own(team, b)) simStartFarm(u, b); },
  tryBuild(team, [, type, tx, ty, builders]) { err(team, simTryBuild(team, type, tx, ty, ownAll(team, builders))); },
  enqueue(team, [b, kind, key]) { if (own(team, b)) err(team, simEnqueue(b, kind, key)); },
  cancelQueue(team, [b, i]) { if (own(team, b)) simCancelQueue(b, i); },
  kill(team, [e]) { if (own(team, e)) simKill(e, null); },
  ejectAll(team, [b]) { if (own(team, b)) simEject(b); },
  marketTrade(team, [, r, buy]) { err(team, simMarket(team, r, buy)); },
  tribute(team, [, to, res, amt]) { err(team, simTribute(team, to, res, amt)); },
  propose(team, [, to, type]) { simPropose(team, to, type); },
  declareWar(team, [, b]) { simWar(team, b); },
  breakAlliance(team, [, b]) { simBreak(team, b); },
  respondProposal(team, [pr, ok]) { const i = G.proposals.findIndex(p => p.from === pr.from && p.to === team && p.type === pr.type && p.t === pr.t); if (i >= 0) simRespond(i, ok); },
  ringBell(team) { simRing(team); },
  releaseBell(team) { simRelease(team); },
  useAbility(team, [gen]) { if (!own(team, gen) || gen.abCd > 0) return; if (simCast(gen)) gen.abCd = gen.def.ability.cd; else if (team === G.human) G.msg('No hay objetivos para ' + gen.def.ability.n, '#ffb070'); },
  cancelBuild(team, [b]) { if (!own(team, b) || b.done) return; refund(team, costOf(team, b.def.cost), 0.75); removeBuilding(b); G.sel = G.sel.filter(e => e !== b); },
  buildRoad(team, [tiles]) { if (Array.isArray(tiles)) buildRoadFor(team, tiles.filter(t => Array.isArray(t) && t.length === 2).slice(0, 200)); },
  setRally(team, [b, x, y, t]) { if (own(team, b)) b.rally = { x, y, target: t && t !== MISSING ? t : null }; },
  garrison(team, [us, b]) { const a = ownAll(team, us); if (!b || b === MISSING) return; for (const u of a) { u.prevOrder = null; simSetOrder(u, { t: 'garrison', b }); } },
  assignFarms(team, [workers, tgt]) {
    const ws = ownAll(team, workers); if (!own(team, tgt)) return; let first = true;
    for (const u of ws) { if (first && simStartFarm(u, tgt)) { first = false; continue; } const f2 = G.blds.find(b => !b.dead && b.done && b.team === team && b.type === 'farm' && !b.farmer); if (f2 && simStartFarm(u, f2)) continue; simSetOrder(u, { t: 'build', b: tgt }); }
  },
  setSpeed(team, [v]) { if ([1, 1.5, 2].includes(v)) { G.speed = v; const el = document.getElementById('b-speed'); if (el) el.textContent = v + 'x'; } },
};
/** Ejecuta una orden recibida o propia [nombre, args codificados]. */
NET.exec = (team, c) => { try { const f = EXEC[c && c[0]]; if (f) f(team, (c[1] || []).map(dec)); } catch (e) { console.error('Orden', c && c[0], e); } };

// ------------------------------------------------------------ envoltorios para la interfaz
function call(name, args, local) {
  if (!NET.active) return local();
  issue(name, args.map(enc)); return undefined;
}
const setOrder = (u, o) => call('setOrder', [u, o], () => simSetOrder(u, o));
const cmdMove = (us, x, y, am) => call('cmdMove', [us, x, y, am], () => simMove(us, x, y, am));
const cmdAttack = (us, t) => call('cmdAttack', [us, t], () => simAttack(us, t));
const setMove = (u, x, y, f) => call('setMove', [u, x, y, f], () => simSetMove(u, x, y, f));
const startGather = (u, r) => call('startGather', [u, r], () => simGather(u, r));
const startFarm = (u, b) => call('startFarm', [u, b], () => simStartFarm(u, b));
const tryBuild = (team, type, tx, ty, builders) => call('tryBuild', [team, type, tx, ty, builders], () => simTryBuild(team, type, tx, ty, builders));
const enqueue = (b, kind, key) => call('enqueue', [b, kind, key], () => simEnqueue(b, kind, key));
const cancelQueue = (b, i) => call('cancelQueue', [b, i], () => simCancelQueue(b, i));
const kill = (e, k) => call('kill', [e], () => simKill(e, k));
const ejectAll = b => call('ejectAll', [b], () => simEject(b));
const marketTrade = (team, r, buy) => call('marketTrade', [team, r, buy], () => simMarket(team, r, buy));
const tribute = (from, to, res, amt) => call('tribute', [from, to, res, amt], () => simTribute(from, to, res, amt));
const propose = (from, to, type) => call('propose', [from, to, type], () => simPropose(from, to, type));
const declareWar = (a, b) => call('declareWar', [a, b], () => simWar(a, b));
const breakAlliance = (a, b) => call('breakAlliance', [a, b], () => simBreak(a, b));
const respondProposal = (i, ok) => { const pr = G.proposals[i]; if (!pr) return; return call('respondProposal', [{ from: pr.from, type: pr.type, t: pr.t }, ok], () => simRespond(i, ok)); };
const ringBell = team => call('ringBell', [], () => simRing(team));
const releaseBell = team => call('releaseBell', [], () => simRelease(team));
const useAbility = gen => call('useAbility', [gen], () => EXEC.useAbility(G.human, [gen]));
const cancelBuild = b => call('cancelBuild', [b], () => EXEC.cancelBuild(G.human, [b]));
const buildRoad = tiles => call('buildRoad', [tiles], () => buildRoadFor(G.human, tiles));
const setRally = (b, x, y, t) => call('setRally', [b, x, y, t], () => EXEC.setRally(G.human, [b, x, y, t]));
const garrison = (us, b) => call('garrison', [us, b], () => EXEC.garrison(G.human, [us, b]));
const assignFarms = (ws, tgt) => call('assignFarms', [ws, tgt], () => EXEC.assignFarms(G.human, [ws, tgt]));
const setSpeed = v => call('setSpeed', [v], () => EXEC.setSpeed(G.human, [v]));

export { setOrder, cmdMove, cmdAttack, setMove, startGather, startFarm, tryBuild, enqueue, cancelQueue, kill, ejectAll, marketTrade, tribute, propose, declareWar, breakAlliance, respondProposal, ringBell, releaseBell, useAbility, cancelBuild, buildRoad, setRally, garrison, assignFarms, setSpeed, EXEC, enc, dec };
