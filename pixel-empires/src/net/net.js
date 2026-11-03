/* =====================================================================
   Multijugador por sincronía de turnos (lockstep).
   Los dos navegadores simulan la MISMA partida: misma configuración y
   semilla, y las órdenes de ambos jugadores se aplican en el mismo tick.
   Solo viajan las órdenes (pocos bytes), nunca el estado.
     · Turno = 3 ticks (100 ms). Lo que un jugador ordena durante el turno
       N se ejecuta en el turno N + RETARDO en los dos navegadores.
     · Si falta el paquete del otro jugador para un turno, la simulación
       espera (nadie avanza más rápido que el otro).
     · El azar de la simulación usa una semilla compartida solo mientras
       se simula; la interfaz, el render y el audio usan su propio azar.
     · Cada cierto tiempo se compara una huella del estado para detectar
       desincronizaciones.
   Transporte: la "presencia" de una sala de claude.ai (cada uno publica
   su objeto, el otro lo recibe). Es un canal "último valor": por eso se
   reenvía la ventana de turnos sin confirmar hasta que el otro la
   confirma (ack). En pruebas locales se usa BroadcastChannel.
   ===================================================================== */
import { G } from '../sim/game.js';

/** Diagnóstico de la sala (se muestra en la ventana de multijugador). */
const TR_INFO = { peers: 0, connected: null, error: null };
const TPT = 3;          // ticks por turno
const DELAY = 3;        // turnos de retardo de entrada (300 ms)
const HASH_EVERY = 20;  // turnos entre comprobaciones de huella

const NET = {
  active: false, role: null, team: 0, peerTeam: 1, code: '', peerName: '',
  tick: 0, acc: 0, waiting: false, waitT: 0, desync: false, peerGone: false, ended: false,
  out: [],                       // órdenes locales aún no asignadas a un turno
  own: new Map(),                // turno -> órdenes propias (ventana de envío sin confirmar)
  sched: new Map(),              // turno -> órdenes propias pendientes de ejecutar
  recv: new Map(),               // turno -> órdenes del otro jugador
  lastRecv: -1, peerAck: -1,     // último turno contiguo recibido / confirmado por el otro
  hashes: new Map(), peerHash: null,
  transport: null, simCam: { x: 0, y: 0 }, realCam: null, rng: null, ping: 0, lastPeerT: 0,
  exec: null,                    // (team, cmd) -> void, lo registra act.js
  onStatus: null,                // aviso a la interfaz (esperando, desconexión, desincronización)
};

// ------------------------------------------------------------ azar de la simulación
function makeRng(seed) { let a = seed | 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Ejecuta fn con el azar compartido (y la cámara compartida, que decide dónde caen los rayos). */
function withSim(fn) {
  if (!NET.active) return fn();
  const r = Math.random; Math.random = NET.rng;
  NET.realCam = G.cam; G.cam = NET.simCam;
  try { return fn(); } finally { G.cam = NET.realCam; NET.realCam = null; Math.random = r; }
}

// ------------------------------------------------------------ inicio / fin
function startNet({ role, team, peerTeam, seed, transport, code, peerName }) {
  Object.assign(NET, { active: true, role, team, peerTeam, code, peerName: peerName || 'el otro jugador', tick: 0, acc: 0, waiting: false, waitT: 0, desync: false, peerGone: false, ended: false, out: [], lastRecv: -1, peerAck: -1, peerHash: null, transport, rng: makeRng(seed ^ 0x5eed) });
  NET.own.clear(); NET.sched.clear(); NET.recv.clear(); NET.hashes.clear();
  NET.simCam = { x: G.map.W * 8, y: G.map.H * 8 };
  transport.onPeer(onPeerPacket);
  send();
}
function stopNet() { if (NET.transport && NET.active) { try { NET.transport.send({ pe: 2, team: NET.team, bye: 1, turns: [], ack: NET.lastRecv }); } catch (_) { /* nada */ } } NET.active = false; }

/** Orden local: se envía y se aplicará en un turno futuro en ambos navegadores. */
function issue(name, args) { NET.out.push([name, args]); }

// ------------------------------------------------------------ transporte
function send() {
  if (!NET.transport) return;
  const turns = [...NET.own.entries()].filter(([t]) => t > NET.peerAck).sort((a, b) => a[0] - b[0]);
  let h = null; for (const [t, v] of NET.hashes) if (!h || t > h[0]) h = [t, v];
  NET.transport.send({ pe: 2, team: NET.team, turns, ack: NET.lastRecv, h, t: Date.now(), bye: NET.ended ? 1 : 0 });
}
function onPeerPacket(p) {
  if (!p || p.pe !== 2 || p.team !== NET.peerTeam) return;
  NET.lastPeerT = performance.now();
  if (p.bye) { NET.peerGone = true; status(); return; }
  for (const [t, cmds] of p.turns || []) if (t > NET.lastRecv && !NET.recv.has(t)) NET.recv.set(t, Array.isArray(cmds) ? cmds : []);
  while (NET.recv.has(NET.lastRecv + 1)) NET.lastRecv++;
  if (typeof p.ack === 'number' && p.ack > NET.peerAck) { NET.peerAck = p.ack; for (const t of NET.own.keys()) if (t <= NET.peerAck) NET.own.delete(t); }
  if (p.h) { NET.peerHash = p.h; checkHash(); }
  send();   // confirmar lo recibido
}

// ------------------------------------------------------------ huella del estado
function stateHash() {
  let h = 2166136261 >>> 0; const mix = v => { h = Math.imul(h ^ (Math.round(v * 64) | 0), 16777619) >>> 0; };
  for (const u of G.units) if (!u.dead) { mix(u.id); mix(u.x); mix(u.y); mix(u.hp); }
  for (const b of G.blds) if (!b.dead) { mix(b.id); mix(b.hp); mix(b.progress || 0); }
  for (const p of G.players) for (const k in p.res) mix(p.res[k]);
  return h;
}
function checkHash() {
  const p = NET.peerHash; if (!p) return;
  const mine = NET.hashes.get(p[0]);
  if (mine !== undefined && mine !== p[1] && !NET.desync) { NET.desync = true; console.warn('Multijugador: desincronización en el turno', p[0]); status(); }
}

// ------------------------------------------------------------ bucle de turnos
function haveTurn(t) { return t < DELAY || NET.peerGone || NET.recv.has(t); }
/**
 * Avanza la simulación en sincronía. stepFn(dt) da un paso de 1/30 s.
 * Devuelve el número de pasos dados (0 si espera al otro jugador).
 */
function netFrame(dt, speed, stepFn) {
  NET.acc = Math.min(NET.acc + dt * speed, 0.5);
  let n = 0;
  while (NET.acc >= 1 / 30 && n < 8) {
    if (NET.tick % TPT === 0) {
      const turn = NET.tick / TPT;
      if (!haveTurn(turn)) { if (!NET.waiting) { NET.waiting = true; NET.waitT = performance.now(); } status(); break; }
      if (NET.waiting) { NET.waiting = false; status(); }
      // mis órdenes de este turno van al turno + RETARDO
      const cmds = NET.out.splice(0); NET.own.set(turn + DELAY, cmds); NET.sched.set(turn + DELAY, cmds);
      if (turn % HASH_EVERY === 0) { NET.hashes.set(turn, stateHash()); for (const k of NET.hashes.keys()) if (k < turn - HASH_EVERY * 3) NET.hashes.delete(k); checkHash(); }
      send();
      // aplicar las órdenes del turno: primero el jugador 0, luego el 1 (mismo orden en los dos navegadores)
      const mine = NET.sched.get(turn) || [], theirs = NET.recv.get(turn) || [];
      NET.sched.delete(turn);
      const first = NET.team < NET.peerTeam ? [NET.team, mine, NET.peerTeam, theirs] : [NET.peerTeam, theirs, NET.team, mine];
      withSim(() => { for (const c of first[1]) NET.exec(first[0], c); for (const c of first[3]) NET.exec(first[2], c); });
      NET.recv.delete(turn - DELAY * 4);
    }
    stepFn(1 / 30); NET.tick++; NET.acc -= 1 / 30; n++;
  }
  if (NET.waiting && performance.now() - NET.lastPeerT > 1500) send();   // reintento suave
  return n;
}
function status() { if (NET.onStatus) NET.onStatus(NET); }
function waitingFor() { return NET.waiting ? (performance.now() - NET.waitT) / 1000 : 0; }

// ------------------------------------------------------------ transportes
/** Sala de claude.ai (capacidad `room`): el objeto de presencia de cada uno es su paquete. */
async function roomTransport(code) {
  if (!(window.claude && window.claude.use)) throw new Error('no-claude');
  const room = await window.claude.use('room');
  if (!room) throw new Error('no-room');
  let r;
  try { r = await room.join('pe-' + code.toLowerCase()); } catch (e) { throw new Error('join:' + (e && (e.code || e.message) || e)); }
  let handler = null, lobbyHandler = null;
  const seen = new Map();
  const lastNet = new Map();
  r.onPeers(ch => {
    for (const p of ch.left) { const ln = lastNet.get(p.peer); if (ln && handler) handler({ pe: 2, team: ln.team, bye: 1 }); lastNet.delete(p.peer); }
    for (const p of ch.peers) {
      if (p.sameTab) continue;
      if (seen.get(p.peer) === p.presence) continue; seen.set(p.peer, p.presence);
      const pr = p.presence || {};
      if (pr.lobby && lobbyHandler) lobbyHandler(pr.lobby, p);
      if (pr.net) { lastNet.set(p.peer, pr.net); if (handler) handler(pr.net); }
    }
    if (lobbyHandler) lobbyHandler(null, null, ch.peers.filter(p => !p.sameTab));
    TR_INFO.peers = ch.peers.filter(p => !p.sameTab).length;
  });
  if (r.onConnection) r.onConnection(c => { TR_INFO.connected = c; }, e => { TR_INFO.error = e && e.code; });
  return {
    kind: 'room', name: r.name,
    send(net) { r.presence({ net }).catch(e => { TR_INFO.error = e && (e.code || e.message); }); },
    lobby(obj) { r.presence({ lobby: obj }).catch(e => { TR_INFO.error = e && (e.code || e.message); }); },
    onPeer(fn) { handler = fn; },
    onLobby(fn) { lobbyHandler = fn; },
    close() { r.leave().catch(() => {}); },
  };
}
/** Pruebas locales: dos pestañas del mismo navegador (BroadcastChannel). */
function channelTransport(code, me) {
  const ch = new BroadcastChannel('pe-' + code); let handler = null, lobbyHandler = null; const state = {};
  ch.onmessage = e => { const m = e.data || {}; if (m.from === me) return; if (m.lobby !== undefined && lobbyHandler) lobbyHandler(m.lobby, { peer: m.from }, [{ peer: m.from }]); if (m.net && handler) handler(m.net); };
  const post = () => ch.postMessage(Object.assign({ from: me }, state));
  const iv = setInterval(post, 250);   // la presencia se reafirma sola
  return { kind: 'local', send(net) { state.net = net; post(); }, lobby(obj) { state.lobby = obj; post(); }, onPeer(fn) { handler = fn; }, onLobby(fn) { lobbyHandler = fn; }, close() { clearInterval(iv); ch.close(); } };
}
export { TR_INFO, NET, TPT, DELAY, makeRng, withSim, startNet, stopNet, issue, netFrame, stateHash, waitingFor, roomTransport, channelTransport };
