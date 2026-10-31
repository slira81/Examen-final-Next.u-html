/* =====================================================================
   Arranque: pantalla de configuración, galería de diseños, bucle
   principal (simulación a paso fijo de 30 Hz + render por frame).
   ===================================================================== */
'use strict';
const SETUP = { race: 'human' };
function resize() {
  if (!VIEW.cv) return;
  VIEW.w = Math.ceil(innerWidth / VIEW.S); VIEW.h = Math.ceil(innerHeight / VIEW.S);
  VIEW.cv.width = VIEW.w; VIEW.cv.height = VIEW.h; VIEW.cv.style.width = VIEW.w * VIEW.S + 'px'; VIEW.cv.style.height = VIEW.h * VIEW.S + 'px';
  VIEW.ctx.imageSmoothingEnabled = false; clampCam();
}
function showSetup() {
  G = null; UI.paused = true;
  $('hud').hidden = true; $('setup').hidden = false;
  const cards = $('races'); cards.innerHTML = '';
  for (const k of RACE_KEYS) {
    const r = RACES[k], card = document.createElement('button'); card.className = 'race' + (SETUP.race === k ? ' on' : ''); card.dataset.race = k;
    const cv = document.createElement('canvas'); cv.className = 'rport'; cv.dataset.key = k + '_general'; card.appendChild(cv);
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
function startFromSetup() {
  const seed = (Date.now() & 0x7fffffff) || 1, used = new Set([SETUP.race]);
  const players = [{ race: SETUP.race, color: 0, human: true, team: +$('s-team').value, name: 'Tu reino' }];
  document.querySelectorAll('.rival').forEach((r, i) => {
    let race = r.querySelector('.rr').value;
    if (race === 'random') { const pool = RACE_KEYS.filter(k => !used.has(k)); race = (pool.length ? pool : RACE_KEYS)[Math.floor(Math.random() * (pool.length || RACE_KEYS.length))]; }
    used.add(race);
    const names = PLAYER_NAMES[race]; players.push({ race, color: i + 1, human: false, team: +r.querySelector('.rt').value, diff: r.querySelector('.rd').value, name: names[Math.floor(Math.random() * names.length)] });
  });
  players[0].name = PLAYER_NAMES[SETUP.race][0];
  startGame({ seed, size: +$('s-size').value, mapType: $('s-map').value, players, resources: $('s-res').value, weather: $('s-weather').checked, disasters: $('s-dis').checked, revealed: $('s-reveal').checked, diff: $('s-diff').value });
}
function startGame(cfg) {
  $('setup').hidden = true; $('hud').hidden = false; $('modal').hidden = true; UI.modal = false;
  newGame(cfg);
  prerenderTerrain(); initHUD();
  UI.sig = ''; UI.page = 'root'; UI.placing = null; UI.paused = false; UI.logHTML = ''; UI.prSig = null;
  $('b-speed').textContent = '1x';
  resize();
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
  document.querySelectorAll('canvas.gc').forEach(cv => {
    const kind = cv.dataset.kind, key = cv.dataset.key, def = PE.ART[kind][key];
    let img;
    if (kind === 'units') img = PE.frame('units', key, f, { team: 0, anim: GALLERY.anim });
    else img = PE.frame(kind, key, Math.floor(f / 2) % ((def && def.frames) || 1), { team: 0, mask: 10, v: 0 });
    const s = kind === 'buildings' ? 2 : 3;
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
    if (!$('setup').hidden) document.querySelectorAll('.rport').forEach(cv => { const img = PE.frame('units', cv.dataset.key, Math.floor(ts / 160), { team: 0, anim: 'idle' }); if (cv.width !== img.width * 3) { cv.width = img.width * 3; cv.height = img.height * 3; } const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height); });
    galleryTick(dt);
    if (PREWARM.length) { const t0 = performance.now(); while (PREWARM.length && performance.now() - t0 < 4) { const [k, key, f, o] = PREWARM.pop(); if (PE.ART[k][key]) PE.frame(k, key, f, o); } }
    if (G) {
      if (!UI.paused) {
        ACC += dt * G.speed; let n = 0;
        while (ACC >= 1 / 30 && n++ < 8) { simStep(1 / 30); ACC -= 1 / 30; }
        if (n >= 8) ACC = 0;
      }
      cameraStep(dt);
      for (const m of UI.marks) m.t += dt; UI.marks = UI.marks.filter(m => m.t < 0.5);
      render(UI.paused ? 0 : dt);
      updateTop(); updateLog(); updateSelectionUI(false);
      if ((UI.miniT = (UI.miniT || 0) - dt) <= 0) { UI.miniT = 0.25; drawMinimap(); }
      if (G.time - (G.battleNear || -99) > 0) { /* música de batalla se gestiona en el audio */ }
    }
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function boot() {
  VIEW.cv = $('game'); VIEW.ctx = VIEW.cv.getContext('2d');
  VIEW.S = clamp(Math.round(innerHeight / 300), 2, 4);
  window.addEventListener('resize', resize);
  $('s-rivals').onchange = buildRivals;
  $('s-start').onclick = () => { audioUnlock(); musicStart(); startFromSetup(); };
  $('s-gallery').onclick = () => openGallery(SETUP.race);
  $('s-help').onclick = () => openHelp();
  initInput();
  showSetup(); resize();
  requestAnimationFrame(frame);
}
window.PE_GAME = { startGame, simStep, get G() { return G; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
