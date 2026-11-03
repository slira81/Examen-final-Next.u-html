/* =====================================================================
   Sala de espera multijugador: crear una partida (código de 4 letras) o
   unirse con el código. El anfitrión elige mapa y rivales en la pantalla
   inicial; al pulsar «Comenzar», los dos navegadores arrancan la misma
   partida con la misma semilla.
   ===================================================================== */
import { RACES, RACE_KEYS, PLAYER_NAMES, DIFFICULTY } from '../data/data.js';
import { G } from '../sim/game.js';
import { $, openModal, closeModal, esc } from '../ui/ui.js';
import { NET, roomTransport, channelTransport, startNet, stopNet, waitingFor } from './net.js';

const LOBBY = { tr: null, role: null, code: '', me: Math.random().toString(36).slice(2, 10), peer: null, peerRace: null, mode: 'coop', started: false, onStart: null, getSetup: null };
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const testMode = () => /[?&]mptest/.test(location.search);

async function transportFor(code) {
  if (testMode()) return channelTransport(code, LOBBY.me);
  try { return await roomTransport(code); } catch (e) { console.warn('Sala no disponible', e); return null; }
}
/** Abre la ventana de multijugador. hooks: { getSetup() -> {race, ...}, onStart(cfg, net) } */
function openMultiplayer(hooks) {
  Object.assign(LOBBY, hooks);
  const avail = testMode() || !!(window.claude && window.claude.use);
  openModal(`<h2>Jugar con otra persona</h2><div class="mp">
    <p class="lead">Los dos necesitáis tener abierto este juego en claude.ai. Uno crea la partida y comparte el código; el otro se une con ese código.</p>
    ${avail ? '' : '<p class="warn">El multijugador solo funciona dentro de claude.ai (abre el juego desde su enlace, con tu cuenta).</p>'}
    <div class="mpgrid">
      <section><h3>Crear partida</h3><p class="mpnote">Tú eliges el mapa, el modo y los rivales controlados por la IA en la pantalla inicial.</p>
        <label for="mp-mode">Modo</label><select id="mp-mode"><option value="coop">Juntos contra la IA</option><option value="versus">Uno contra el otro</option></select>
        <button id="mp-create" ${avail ? '' : 'disabled'}>Crear partida</button></section>
      <section><h3>Unirse</h3><p class="mpnote">Escribe el código que te pasó el otro jugador. Juegas con la raza elegida en la pantalla inicial.</p>
        <label for="mp-code">Código</label><input id="mp-code" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD">
        <button id="mp-join" ${avail ? '' : 'disabled'}>Unirse</button></section>
    </div>
    <div id="mp-status" class="mpstatus" aria-live="polite"></div>
  </div><div class="mrow"><button id="mp-close">Cerrar</button></div>`);
  $('mp-close').onclick = () => { leave(); closeModal(); };
  $('mp-create').onclick = () => create($('mp-mode').value);
  $('mp-join').onclick = () => join($('mp-code').value.trim().toUpperCase());
  $('mp-code').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); };
}
function setStatus(html) { const el = $('mp-status'); if (el) el.innerHTML = html; }
function leave() { if (LOBBY.tr && !LOBBY.started) { LOBBY.tr.close(); LOBBY.tr = null; } LOBBY.role = null; LOBBY.peer = null; }

async function create(mode) {
  leave(); LOBBY.role = 'host'; LOBBY.mode = mode; LOBBY.code = newCode();
  setStatus('Abriendo la sala…');
  const tr = await transportFor(LOBBY.code);
  if (!tr) { setStatus('<span class="warn">No se pudo abrir la sala. Abre el juego en claude.ai con tu cuenta e inténtalo de nuevo.</span>'); return; }
  LOBBY.tr = tr; const s = LOBBY.getSetup();
  tr.lobby({ role: 'host', race: s.race, mode });
  tr.onLobby((lob, peer) => { if (lob && lob.role === 'guest') { LOBBY.peer = peer; LOBBY.peerRace = RACE_KEYS.includes(lob.race) ? lob.race : 'human'; hostView(); } });
  hostView();
}
function hostView() {
  const s = LOBBY.getSetup();
  setStatus(`<div class="mpcode">Código: <b>${LOBBY.code}</b></div>
    <p>${LOBBY.peer ? `Se unió un jugador (${esc(RACES[LOBBY.peerRace].n)}). Revisa el mapa y los rivales en la pantalla inicial y pulsa Comenzar.` : 'Pásale este código al otro jugador. Esperando a que se una…'}</p>
    <p class="mpnote">Tú: ${esc(RACES[s.race].n)} · Modo: ${LOBBY.mode === 'coop' ? 'juntos contra la IA' : 'uno contra el otro'}</p>
    ${LOBBY.peer ? '<button id="mp-start" class="go">Comenzar</button>' : ''}`);
  if (LOBBY.peer) $('mp-start').onclick = hostStart;
}
function hostStart() {
  const s = LOBBY.getSetup(), seed = ((Date.now() ^ Math.floor(Math.random() * 1e9)) & 0x7fffffff) || 1;
  const players = s.players.map(p => Object.assign({}, p));
  // jugador 1 = el invitado (los rivales de la IA se desplazan)
  const coop = LOBBY.mode === 'coop', guest = { race: LOBBY.peerRace, color: 1, human: true, team: coop ? 1 : 2, name: PLAYER_NAMES[LOBBY.peerRace][1] || 'Invitado' };
  players[0].team = coop ? 1 : 1; players[0].human = true;
  const rivals = players.slice(1).map((p, i) => Object.assign(p, { color: i + 2, team: coop ? (p.team === 1 ? 3 : p.team || 0) : p.team }));
  const cfg = Object.assign({}, s.cfg, { seed, players: [players[0], guest, ...rivals].slice(0, 8), observer: false, revealed: s.cfg.revealed && !s.cfg.observer });
  LOBBY.tr.lobby({ role: 'host', start: { cfg }, t: Date.now() });
  begin(cfg, 0, 1);
}
async function join(code) {
  if (!/^[A-Z]{4}$/.test(code)) { setStatus('<span class="warn">El código tiene 4 letras.</span>'); return; }
  leave(); LOBBY.role = 'guest'; LOBBY.code = code;
  setStatus('Conectando…');
  const tr = await transportFor(code);
  if (!tr) { setStatus('<span class="warn">No se pudo entrar en la sala. Abre el juego en claude.ai con tu cuenta e inténtalo de nuevo.</span>'); return; }
  LOBBY.tr = tr; const s = LOBBY.getSetup();
  tr.lobby({ role: 'guest', race: s.race });
  let seenHost = false;
  tr.onLobby((lob, peer) => {
    if (!lob || lob.role !== 'host') return;
    if (!seenHost) { seenHost = true; setStatus(`<p>Conectado a la partida <b>${code}</b>. Esperando a que el anfitrión pulse Comenzar…</p>`); }
    if (lob.start && lob.start.cfg && !LOBBY.started) begin(lob.start.cfg, 1, 0);
  });
  setTimeout(() => { if (!seenHost && LOBBY.role === 'guest' && !LOBBY.started) setStatus(`<p>Sala <b>${code}</b> abierta, pero el anfitrión aún no aparece. Comprueba el código o espera a que lo cree.</p>`); }, 6000);
}
function begin(cfg, team, peerTeam) {
  LOBBY.started = true; closeModal();
  LOBBY.onStart(cfg, { team });
  startNet({ role: LOBBY.role, team, peerTeam, seed: cfg.seed, transport: LOBBY.tr, code: LOBBY.code, peerName: G.players[peerTeam] ? G.players[peerTeam].name : '' });
  NET.onStatus = onNetStatus; onNetStatus(NET);
}
/** Aviso en pantalla: esperando, desincronización o desconexión del otro jugador. */
function onNetStatus(n) {
  let el = $('mp-wait'); if (!el) { el = document.createElement('div'); el.id = 'mp-wait'; el.className = 'mpwait'; document.body.appendChild(el); }
  if (n.peerGone && n.active) {
    // el otro jugador se fue: su reino pasa a la IA y la partida sigue sin red
    const p = G.players[n.peerTeam]; if (p && p.alive && !p.ai) { p.human = false; p.diff = p.diff || 'normal'; const D = DIFFICULTY[p.diff]; p.ai = { t: 1, think: D.think, attackT: Math.max(G.time + 240, D.firstAttack), wave: 0, waveSize: 8, attacking: false, target: null, lastDef: -99 }; }
    stopNet(); el.textContent = (p ? p.name : 'El otro jugador') + ' se desconectó: su reino pasa a la IA.'; el.hidden = false; setTimeout(() => { el.hidden = true; }, 6000); return;
  }
  if (n.desync) { el.textContent = 'Aviso: las dos partidas se han desincronizado. Para jugar juntos de nuevo, empezad otra partida (mejor con el mismo navegador).'; el.hidden = false; return; }
  el.textContent = 'Esperando a ' + n.peerName + '…'; el.hidden = !n.waiting;
}
/** Comprobación periódica (desde el bucle): tras 12 s sin noticias, se da por ido al otro jugador. */
function netWatch() { if (NET.active && NET.waiting && waitingFor() > 12) { NET.peerGone = true; onNetStatus(NET); } }
function endNet() { if (NET.active) stopNet(); if (LOBBY.tr) { LOBBY.tr.close(); LOBBY.tr = null; } LOBBY.started = false; const el = $('mp-wait'); if (el) el.hidden = true; }
// al cerrar la pestaña se avisa al otro jugador
addEventListener('pagehide', () => { if (NET.active) stopNet(); });
export { LOBBY, openMultiplayer, netWatch, endNet };
