import './ui/styles.css';
import './render/pixel/sprite.js';
import './render/pixel/art/units_a.js';
import './render/pixel/art/units_b.js';
import './render/pixel/art/buildings.js';
import './render/pixel/art/nature.js';
import './render/pixel/art/fauna_fx.js';
import { PE } from './render/pixel/sprite.js';
import { ANIMALS, BLD, DIFFICULTY, PLAYER_NAMES, RACES, RACE_KEYS, ROLES, T, UNITS } from './data/data.js';
import { G, clamp, newGame, setG, simStep } from './sim/game.js';
import { RV, setRenderer, artIcon } from './render/view.js';
import { pixelRenderer } from './render/pixel/adapter.js';
import { threeRenderer } from './render/three/engine.js';
import { buildMiniBase, drawMinimap } from './ui/minimap.js';
import { $, UI, initHUD, openHelp, openModal, updateLog, updateSelectionUI, updateTop, updateTouchUI } from './ui/ui.js';
import { INPUT, cameraStep, centerOn, clampCam, initInput, updateZoomButtons } from './input/input.js';
import { audioUnlock, musicStart } from './audio/audio.js';
import * as __m0 from './data/data.js';
import * as __m1 from './map/map.js';
import * as __m2 from './sim/path.js';
import * as __m3 from './sim/game.js';
import * as __m4 from './ai/ai.js';
import * as __m5 from './world/world.js';
import * as __m6 from './world/diplo.js';
import * as __m7 from './render/pixel/sprite.js';
import * as __m8 from './render/pixel/render.js';
import * as __m9 from './ui/ui.js';
import * as __m10 from './input/input.js';
import * as __m11 from './audio/audio.js';
import * as __m12 from './audio/zzfx.js';
import * as __self from './main.js';
import * as __v1 from './render/view.js';
import * as __v2 from './render/three/engine.js';
import * as __v3 from './render/three/terrain.js';
import * as __v4 from './render/pixel/adapter.js';
import * as __v5 from './ui/minimap.js';
import * as __v6 from './render/three/particles.js';
import * as __v7 from './render/three/entities.js';
import * as __act from './net/act.js';
import * as __net from './net/net.js';
import { startViewer } from './render/three/viewer.js';
import { loadGfx, applyGfx, openGraphics } from './ui/graphics.js';
import { NET, netFrame, withSim, makeRng } from './net/net.js';
import { openMultiplayer, netWatch, endNet } from './net/lobby.js';
/* =====================================================================
   Arranque: pantalla de configuración, galería de diseños, bucle
   principal (simulación a paso fijo de 30 Hz + render por frame).
   ===================================================================== */
const SETUP = { race: 'human' };
function resize() { if (!RV.impl) return; RV.impl.resize(); clampCam(); updateZoomButtons(); }
function showSetup() {
  endNet(); setG(null); UI.paused = true;
  $('hud').hidden = true; $('setup').hidden = false;
  const cards = $('races'); cards.innerHTML = '';
  for (const k of RACE_KEYS) {
    const r = RACES[k], card = document.createElement('button'); card.className = 'race' + (SETUP.race === k ? ' on' : ''); card.dataset.race = k;
    const a3 = artIcon('units', k + '_general', 0, 200), cv = document.createElement('canvas'); cv.className = 'rport'; cv.dataset.key = k + '_general';
    if (a3) { cv.width = cv.height = 200; cv.dataset.r3d = '1'; cv.getContext('2d').drawImage(a3, 0, 0); }
    card.appendChild(cv);
    card.insertAdjacentHTML('beforeend', `<b>${r.n}</b><small>${r.desc}</small><ul>${r.bonus.map(b => '<li>' + b + '</li>').join('')}</ul>`);
    card.onclick = () => { SETUP.race = k; document.querySelectorAll('.race').forEach(c => c.classList.toggle('on', c.dataset.race === k)); };
    cards.appendChild(card);
  }
  buildRivals();
}
function buildRivals() {
  const n = +$('s-rivals').value, el = $('rivals'), old = [...el.querySelectorAll('.rival')].map(r => ({ race: r.querySelector('.rr').value, team: r.querySelector('.rt').value, diff: r.querySelector('.rd').value }));
  el.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const o = old[i] || { race: 'random', team: '0', diff: $('s-diff').value };
    el.insertAdjacentHTML('beforeend', `<div class="rival"><i class="sw" style="background:${PE.TEAM_COLORS[i + 1].hex}"></i><label class="sr" for="rr${i}">Raza del rival ${i + 1}</label><select id="rr${i}" class="rr"><option value="random">Aleatoria</option>${RACE_KEYS.map(k => `<option value="${k}" ${o.race === k ? 'selected' : ''}>${RACES[k].n}</option>`).join('')}</select>
      <label class="sr" for="rt${i}">Equipo del rival ${i + 1}</label><select id="rt${i}" class="rt"><option value="0">Libre</option>${[1, 2, 3].map(t => `<option value="${t}" ${o.team == t ? 'selected' : ''}>Equipo ${t}</option>`).join('')}</select>
      <label class="sr" for="rd${i}">Dificultad del rival ${i + 1}</label><select id="rd${i}" class="rd">${Object.entries(DIFFICULTY).map(([k, d]) => `<option value="${k}" ${o.diff === k ? 'selected' : ''}>${d.n}</option>`).join('')}</select></div>`);
  }
}
function startFromSetup() { startGame(buildSetupCfg()); }
/** Configuración de partida a partir de la pantalla inicial (sin arrancarla). */
function buildSetupCfg() {
  const seed = (Date.now() & 0x7fffffff) || 1, used = new Set([SETUP.race]);
  const players = [{ race: SETUP.race, color: 0, human: true, team: +$('s-team').value, name: 'Tu reino' }];
  document.querySelectorAll('.rival').forEach((r, i) => {
    let race = r.querySelector('.rr').value;
    if (race === 'random') { const pool = RACE_KEYS.filter(k => !used.has(k)); race = (pool.length ? pool : RACE_KEYS)[Math.floor(Math.random() * (pool.length || RACE_KEYS.length))]; }
    used.add(race);
    const names = PLAYER_NAMES[race]; players.push({ race, color: i + 1, human: false, team: +r.querySelector('.rt').value, diff: r.querySelector('.rd').value, name: names[Math.floor(Math.random() * names.length)] });
  });
  players[0].name = PLAYER_NAMES[SETUP.race][0];
  const obs = $('s-obs').checked; if (obs) { players[0].human = false; players[0].diff = $('s-diff').value; }
  return { seed, size: +$('s-size').value, mapType: $('s-map').value, players, resources: $('s-res').value, weather: $('s-weather').checked, disasters: $('s-dis').checked, revealed: $('s-reveal').checked || obs, observer: obs, diff: $('s-diff').value };
}
function startGame(cfg, net) {
  $('setup').hidden = true; $('hud').hidden = false; $('modal').hidden = true; UI.modal = false;
  if (net) {   // multijugador: misma partida en los dos navegadores (azar con la semilla compartida)
    const r = Math.random; Math.random = makeRng(cfg.seed); try { newGame(cfg); } finally { Math.random = r; }
    G.human = net.team; const s = G.map.starts[G.human]; G.cam = { x: s.x * T, y: s.y * T };
  } else { endNet(); newGame(cfg); }
  RV.impl.onGameStart(); buildMiniBase(); initHUD();
  UI.sig = ''; UI.page = 'root'; UI.placing = null; UI.paused = false; UI.logHTML = ''; UI.prSig = null;
  $('b-speed').textContent = '1x';
  resize();
  if (G.human >= 0) { const st = G.map.starts[G.human]; requestAnimationFrame(() => { updateTouchUI(); centerOn(st.x * T + 8, st.y * T + 20); }); }
  // pre-render progresivo de sprites de las razas y colores presentes (evita tirones)
  PREWARM.length = 0;
  for (const pl of G.players) {
    for (const role of ROLES) for (const anim of ['idle', 'walk', 'attack']) for (let f = 0; f < PE.ANIMS[anim].length; f++) PREWARM.push(['units', pl.race + '_' + role, f, { team: pl.color, anim }]);
    for (const t in BLD) if (BLD[t].age < 9) for (let f = 0; f < 4; f++) PREWARM.push(['buildings', pl.race + '_' + t, f, { team: pl.color }]);
  }
  for (const k in ANIMALS) for (const anim of ['idle', 'walk']) for (let f = 0; f < PE.ANIMS[anim].length; f++) PREWARM.push(['units', 'animal_' + k, f, { team: 6, anim }]);
  G.msg('Bienvenido, ' + (G.human >= 0 ? G.players[G.human].name : 'observador') + '. Recolecta recursos, crece y conquista. Pulsa P para ver la ayuda.', '#ffd27a');
  return G;
}
// --------------------------------------------------------------- galería de diseños
let GALLERY = null;
function openGallery(tab) {
  const tabs = RACE_KEYS.map(k => `<button data-gal="${k}" class="${tab === k ? 'on' : ''}">${RACES[k].n}</button>`).join('') + `<button data-gal="nature" class="${tab === 'nature' ? 'on' : ''}">Naturaleza y fauna</button><button data-gal="neutral" class="${tab === 'neutral' ? 'on' : ''}">Hostiles</button>`;
  let body = '';
  const cell = (kind, key, label, extra = '') => `<figure><canvas class="gc" data-kind="${kind}" data-key="${key}" ${extra}></canvas><figcaption>${label}</figcaption></figure>`;
  if (RACES[tab]) {
    body += '<h3>Unidades</h3><div class="ggrid">' + ROLES.map(r => cell('units', tab + '_' + r, UNITS[tab + '_' + r].n)).join('') + '</div>';
    body += '<h3>Edificios</h3><div class="ggrid big">' + Object.keys(BLD).filter(t => BLD[t].age < 9).map(t => cell('buildings', tab + '_' + t, RACES[tab].names[t] || BLD[t].n)).join('') + '</div>';
  } else if (tab === 'neutral') {
    body += '<div class="ggrid">' + ['neutral_bandit', 'neutral_bandit_archer', 'neutral_goblin', 'neutral_ogre'].map(k => cell('units', k, UNITS[k].n)).join('') + '</div>';
    body += '<div class="ggrid big">' + ['bandit_camp', 'goblin_hut', 'shrine', 'ruins'].map(k => cell('buildings', 'neutral_' + k, BLD[k].n)).join('') + '</div>';
  } else {
    body += '<h3>Animales</h3><div class="ggrid">' + Object.keys(ANIMALS).map(k => cell('units', 'animal_' + k, ANIMALS[k].n)).join('') + '</div>';
    body += '<h3>Árboles, minas y recursos</h3><div class="ggrid">' + ['tree_oak', 'tree_pine', 'tree_birch', 'tree_palm', 'tree_willow', 'tree_snowpine', 'tree_dead', 'tree_elder', 'mine_gold', 'mine_stone', 'mine_iron', 'mine_gems', 'bush_berry', 'fish_spot', 'treasure_chest', 'treasure_relic', 'treasure_gold_pile', 'decor_campfire'].map(k => cell('nature', k, k.replace(/_/g, ' '))).join('') + '</div>';
  }
  openModal(`<h2>Galería de diseños</h2><div class="gtabs">${tabs}</div><div class="gmode"><button data-gm="idle">Quieto</button><button data-gm="walk" class="on">Caminar</button><button data-gm="attack">Atacar</button></div>${body}<div class="mrow"><button data-close>Cerrar</button></div>`);
  GALLERY = { anim: 'walk', t: 0 };
  document.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => { GALLERY.anim = b.dataset.gm; document.querySelectorAll('[data-gm]').forEach(o => o.classList.toggle('on', o === b)); });
}
function galleryTick(dt) {
  if (!GALLERY || $('modal').hidden) { GALLERY = null; return; }
  GALLERY.t += dt; const f = Math.floor(GALLERY.t * 8);
  // render 3D: modelos (unidades animadas a ~15 fps)
  if (RV.impl.galleryFrame) { if ((GALLERY.acc = (GALLERY.acc || 0) + dt) < 1 / 15) return; GALLERY.acc = 0; let ok = true; document.querySelectorAll('canvas.gc').forEach(cv => { ok = RV.impl.galleryFrame(cv, cv.dataset.kind, cv.dataset.key, GALLERY.anim, GALLERY.t) && ok; }); if (ok) return; }
  document.querySelectorAll('canvas.gc').forEach(cv => {
    if (cv.dataset.r3d) return;
    const kind = cv.dataset.kind, key = cv.dataset.key, def = PE.ART[kind][key];
    let img;
    if (kind === 'units') img = PE.frame('units', key, f, { team: 0, anim: GALLERY.anim });
    else img = PE.frame(kind, key, Math.floor(f / 2) % ((def && def.frames) || 1), { team: 0, mask: 10, v: 0 });
    const s = kind === 'units' ? 2 : Math.max(1, Math.floor(2 / (img.k || 1)));
    if (cv.width !== img.width * s) { cv.width = img.width * s; cv.height = img.height * s; }
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
  });
}
// --------------------------------------------------------------- bucle
let LAST = 0, ACC = 0;
const PREWARM = [];
function frame(ts) {
  const dt = Math.min(0.1, (ts - LAST) / 1000 || 0); LAST = ts;
  try {
    // retratos animados de la pantalla inicial
    if (!G && !$('setup').hidden && RV.impl.titleFrame) RV.impl.titleFrame(dt, SETUP.race);
    if (!$('setup').hidden) document.querySelectorAll('.rport:not([data-r3d])').forEach(cv => { const img = PE.frame('units', cv.dataset.key, Math.floor(ts / 160), { team: 0, anim: 'idle' }); if (cv.width !== img.width * 3) { cv.width = img.width * 3; cv.height = img.height * 3; } const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height); });
    galleryTick(dt);
    if (PREWARM.length) { const t0 = performance.now(); while (PREWARM.length && performance.now() - t0 < 4) { const [k, key, f, o] = PREWARM.pop(); if (PE.ART[k][key]) PE.frame(k, key, f, o); } }
    if (G) {
      if (NET.active) {   // multijugador: la simulación avanza en sincronía con el otro jugador (no se pausa)
        netFrame(dt, G.speed, d => { if (RV.impl.beforeStep) RV.impl.beforeStep(); withSim(() => simStep(d)); });
        ACC = NET.acc; netWatch();
      } else if (!UI.paused) {
        ACC += dt * G.speed; let n = 0;
        while (ACC >= 1 / 30 && n++ < 8) { if (RV.impl.beforeStep) RV.impl.beforeStep(); simStep(1 / 30); ACC -= 1 / 30; }
        if (n >= 8) ACC = 0;
      }
      cameraStep(dt);
      for (const m of UI.marks) m.t += dt; UI.marks = UI.marks.filter(m => m.t < 0.5);
      RV.impl.frame(UI.paused ? 0 : dt, Math.min(1, ACC * 30));
      updateTop(); updateLog(); updateSelectionUI(false);
      if ((UI.miniT = (UI.miniT || 0) - dt) <= 0) { UI.miniT = 0.25; drawMinimap(); }
      if (G.time - (G.battleNear || -99) > 0) { /* música de batalla se gestiona en el audio */ }
    }
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function boot() {
  // 3D por defecto; '#pixel' en la dirección o falta de WebGL usan el render pixel anterior
  let use3d = !/pixel/.test(location.hash + location.search);
  if (use3d) { try { const t = document.createElement('canvas'); use3d = !!(t.getContext('webgl2')); } catch (_) { use3d = false; } }
  setRenderer(use3d ? threeRenderer : pixelRenderer);
  try { RV.impl.init({ canvas: $('game'), canvas3d: $('game3d'), overlay: $('overlay') }); }
  catch (e) { console.error('Sin WebGL, se usa el render pixel', e); setRenderer(pixelRenderer); RV.impl.init({ canvas: $('game') }); }
  loadGfx(); applyGfx();
  $('s-gfx').hidden = !RV.impl.setQuality; $('s-gfx').onclick = () => openGraphics();
  $('s-mp').onclick = () => { audioUnlock(); openMultiplayer({ getSetup: () => { const cfg = buildSetupCfg(); return { race: SETUP.race, players: cfg.players, cfg }; }, onStart: (cfg, net) => { musicStart(); startGame(cfg, net); } }); };
  window.addEventListener('resize', resize);
  if (matchMedia('(pointer: coarse)').matches) { INPUT.touch = true; document.body.classList.add('touch'); }
  $('s-rivals').onchange = buildRivals;
  $('s-start').onclick = () => { audioUnlock(); musicStart(); startFromSetup(); };
  $('s-gallery').onclick = () => openGallery(SETUP.race);
  $('s-help').onclick = () => openHelp();
  initInput();
  showSetup(); resize();
  requestAnimationFrame(frame);
}
window.PE_GAME = { startGame, simStep, get G() { return G; } };
// Puente de depuración: expone los módulos en window para las pruebas automáticas (Playwright).
if (typeof window !== 'undefined') {
  for (const m of [__m0, __m1, __m2, __m3, __m4, __m5, __m6, __m7, __m8, __m9, __m10, __m11, __m12, __self, __v1, __v2, __v3, __v4, __v5, __v6, __v7]) for (const k in m) if (k !== 'G' && !(k in window)) window[k] = m[k];
  Object.defineProperty(window, 'G', { get: () => G, configurable: true });
  window.__act = __act; window.__net = __net;
}
// '?viewer=units|buildings|nature' abre el visor de modelos 3D en lugar del juego
const start = /[?&]viewer=/.test(location.search) ? startViewer : boot;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

export { SETUP, resize, showSetup, buildRivals, startFromSetup, buildSetupCfg, startGame, GALLERY, openGallery, galleryTick, LAST, ACC, PREWARM, frame, boot };
