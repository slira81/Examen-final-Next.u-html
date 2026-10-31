/* =====================================================================
   Entrada: selección, órdenes con clic derecho, colocación de edificios,
   muros y caminos arrastrando, cámara, zoom, grupos y atajos.
   ===================================================================== */
'use strict';
const INPUT = { keys: {}, mx: -1, my: -1, mid: null, last: { t: 0, id: null }, grpTap: { d: null, t: 0 }, inWin: false };
const toWorld = (sx, sy) => ({ x: sx / VIEW.S + VIEW.cx, y: sy / VIEW.S + VIEW.cy });
function mark(x, y, c) { UI.marks.push({ x, y, c, t: 0 }); }
function ownSelUnits() { return G.sel.filter(e => e.k === 'u' && e.team === G.human && !e.dead && !e.inside); }

/** Entidad bajo el cursor (unidades primero, luego edificios, recursos y tesoros). */
function pickAt(w) {
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (u.dead || u.inside || (!isAlly(u.team, G.human) && !visibleAt(u.x, u.y))) continue;
    const def = PE.ART.units[u.key], hh = def ? Math.min(def.ay, 30) : 14;
    const dx = Math.abs(w.x - u.x), dy = w.y - (u.y - hh / 2);
    if (dx < u.def.size + 4 && Math.abs(dy) < hh / 2 + 3) { const d = dx + Math.abs(dy) * 0.5 - (u.team === G.human ? 3 : 0); if (d < bd) { bd = d; best = u; } }
  }
  if (best) return best;
  for (const b of G.blds) {
    if (b.dead || !exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) continue;
    const img = PE.ART.buildings[b.key], h = img ? (typeof img.h === 'number' ? img.h : b.fp * T) : b.fp * T, extra = b.def.flat ? 0 : Math.max(0, h - b.fp * T) * 0.7;
    if (w.x >= b.tx * T && w.x < (b.tx + b.fp) * T && w.y >= b.ty * T - extra && w.y < (b.ty + b.fp) * T) return b;
  }
  for (const t of G.treasures) if (!t.taken && Math.abs(w.x - (t.tx * T + 8)) < 10 && Math.abs(w.y - (t.ty * T + 8)) < 10 && exploredAt(t.tx, t.ty)) return t;
  for (const r of G.resBy.carcass || []) if (!r.dead && Math.abs(w.x - r.x) < 10 && Math.abs(w.y - r.y) < 8) return r;
  const tx = tileOf(w.x), ty = tileOf(w.y);
  for (const [ox, oy] of [[0, 0], [0, 1], [0, -1]]) { const x = tx + ox, y = ty + oy; if (x < 0 || y < 0 || x >= G.map.W || y >= G.map.H) continue; const r = G.map.res[y * G.map.W + x]; if (r && !r.dead && exploredAt(x, y) && (oy === 0 || r.kind === 'tree')) { if (oy === 1 && w.y < (y * T) - 18) continue; return r; } }
  return null;
}
function clickSelect(w, shift, dbl) {
  const e = pickAt(w);
  if (!e) { if (!shift) G.sel = []; UI.page = 'root'; return; }
  if (e.k === 't') { G.sel = []; return; }
  if (dbl && e.k === 'u' && e.team === G.human) {
    G.sel = G.units.filter(u => !u.dead && !u.inside && u.team === G.human && u.key === e.key && u.x > VIEW.cx && u.x < VIEW.cx + VIEW.w && u.y > VIEW.cy && u.y < VIEW.cy + VIEW.h); UI.page = 'root'; return;
  }
  if (shift && e.k === 'u' && e.team === G.human) { G.sel = G.sel.includes(e) ? G.sel.filter(s => s !== e) : G.sel.filter(s => s.k === 'u' && s.team === G.human).concat(e); }
  else G.sel = [e];
  UI.page = 'root';
  if (e.k === 'u' && e.team === G.human) sfx('click');
}
function boxSelect(d, shift) {
  const a = toWorld(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1)), b = toWorld(Math.max(d.x0, d.x1), Math.max(d.y0, d.y1));
  const inBox = u => !u.dead && !u.inside && u.team === G.human && u.x >= a.x - 4 && u.x <= b.x + 4 && u.y >= a.y && u.y <= b.y + 12;
  let s = G.units.filter(u => inBox(u) && !isAnimal(u));
  if (!s.length) s = G.units.filter(u => inBox(u));
  G.sel = shift ? [...new Set(G.sel.filter(e => e.k === 'u' && e.team === G.human).concat(s))] : s; UI.page = 'root';
}
function rightClick(w) {
  if (G.human < 0) return;
  const mine = G.sel.filter(e => e.team === G.human && !e.dead && !e.inside); if (!mine.length) return;
  const tgt = pickAt(w), bld = mine.length === 1 && mine[0].k === 'b' ? mine[0] : null;
  if (bld) {
    if (bld.def.train && bld.done) { bld.rally = { x: w.x, y: w.y, target: tgt && (tgt.k === 'r' || (tgt.k === 'b' && tgt.team === G.human)) ? tgt : null }; mark(w.x, w.y, '#ffd23a'); sfx('click'); }
    return;
  }
  const units = mine.filter(e => e.k === 'u'); if (!units.length) return;
  const workers = units.filter(u => u.def.role === 'worker'), others = units.filter(u => u.def.role !== 'worker');
  if (UI.amove) { cmdMove(units, w.x, w.y, true); mark(w.x, w.y, '#ff6a5a'); UI.amove = false; return; }
  if (tgt && tgt.k === 't') { for (const u of units) setOrder(u, { t: 'treasure', tr: tgt }); mark(w.x, w.y, '#ffd23a'); return; }
  if (tgt && (tgt.k === 'u' || tgt.k === 'b')) {
    const hostileish = canHarm(G.human, tgt.team) && !tgt.def.invuln && (isEnemy(G.human, tgt.team) || isPlayer(tgt.team) || (tgt.k === 'u' && isAnimal(tgt) && tgt.team !== G.human));
    if (hostileish) {
      if (isPlayer(tgt.team) && G.stance[G.human][tgt.team] !== 'enemy') G.msg('Atacar a ' + G.players[tgt.team].name + ' rompe la ' + (G.stance[G.human][tgt.team] === 'ally' ? 'alianza' : 'paz'), '#ffb070');
      const attackers = tgt.k === 'u' && isAnimal(tgt) ? units : units.filter(u => u.def.atk > 0);
      cmdAttack(attackers, tgt); mark(w.x, w.y, '#ff6a5a'); sfx('click'); return;
    }
    if (tgt.k === 'u' && tgt.team === G.human && isAnimal(tgt) && workers.length) { for (const u of workers) setOrder(u, { t: 'attack', target: tgt, forced: true }); if (others.length) cmdMove(others, w.x, w.y); mark(w.x, w.y, '#ffd23a'); return; }
    if (tgt.k === 'u' && isAlly(tgt.team, G.human) && tgt.hp < tgt.maxhp) { const healers = units.filter(u => u.def.heal); if (healers.length) { cmdAttack(healers, tgt); mark(w.x, w.y, '#9fe8a0'); } }
    if (tgt.k === 'b' && tgt.team === G.human && tgt.done && tgt.def.garrison && others.length && tgt.hp >= tgt.maxhp * 0.99) {
      for (const u of others) { u.prevOrder = null; setOrder(u, { t: 'garrison', b: tgt }); }
      if (workers.length) cmdMove(workers, w.x, w.y);
      mark(w.x, w.y, '#8fff7a'); sfx('click'); return;
    }
    if (tgt.k === 'b' && isAlly(tgt.team, G.human) && workers.length) {
      if (tgt.type === 'farm' && tgt.done) { let first = true; for (const u of workers) { if (first && startFarm(u, tgt)) { first = false; continue; } const f2 = G.blds.find(b => !b.dead && b.done && b.team === G.human && b.type === 'farm' && !b.farmer); if (f2 && startFarm(u, f2)) continue; setOrder(u, { t: 'build', b: tgt }); } }
      else if (!tgt.done || tgt.hp < tgt.maxhp) for (const u of workers) setOrder(u, { t: 'build', b: tgt });
      else if (tgt.def.drop) for (const u of workers) { if (u.carry && tgt.def.drop.includes(u.ckind)) { setOrder(u, { t: 'return', drop: tgt, kind: u.order.kind }); } else setMove(u, w.x, w.y); }
      else cmdMove(workers, w.x, w.y);
      if (others.length) cmdMove(others, w.x, w.y);
      mark(w.x, w.y, '#8fff7a'); sfx('click'); return;
    }
  }
  if (tgt && tgt.k === 'r' && workers.length) {
    for (const u of workers) startGather(u, tgt);
    if (others.length) cmdMove(others, w.x, w.y);
    mark(w.x, w.y, '#ffd23a'); sfx('click'); return;
  }
  cmdMove(units, w.x, w.y, false); mark(w.x, w.y, '#8fff7a'); sfx('click');
}
function placeAt(shift) {
  const t = UI.placing, builders = ownSelUnits().filter(u => u.def.role === 'worker');
  for (const [tx, ty] of placementTiles()) {
    const r = tryBuild(G.human, t, tx, ty, builders);
    if (typeof r === 'string') { G.msg(r, '#ffb070', { sound: 'error' }); break; }
    sfx('build');
  }
  if (!shift || !canAfford(G.human, costOf(G.human, BLD[t].cost))) UI.placing = null;
}
function initInput() {
  const cv = VIEW.cv;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => {
    audioUnlock(); musicStart();
    if (UI.modal || !G) return;
    const w = toWorld(e.clientX, e.clientY);
    if (e.button === 1) { INPUT.mid = { x: e.clientX, y: e.clientY, cx: G.cam.x, cy: G.cam.y }; e.preventDefault(); return; }
    if (e.button === 0) {
      if (UI.roadMode) { UI.roadDrag = { tx: tileOf(w.x), ty: tileOf(w.y) }; return; }
      if (UI.placing) { if (BLD[UI.placing].wall) UI.wallDrag = { tx: tileOf(w.x), ty: tileOf(w.y) }; else placeAt(e.shiftKey); return; }
      if (UI.amove) { const us = ownSelUnits(); if (us.length) { cmdMove(us, w.x, w.y, true); mark(w.x, w.y, '#ff6a5a'); } UI.amove = false; return; }
      UI.drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, box: false };
    } else if (e.button === 2) {
      if (UI.placing || UI.roadMode || UI.amove) { UI.placing = null; UI.roadMode = false; UI.amove = false; UI.wallDrag = null; UI.roadDrag = null; return; }
      rightClick(w);
    }
  });
  window.addEventListener('mousemove', e => {
    INPUT.mx = e.clientX; INPUT.my = e.clientY; INPUT.inWin = true;
    if (!G) return;
    UI.mouseWorld = toWorld(e.clientX, e.clientY);
    if (UI.drag) { UI.drag.x1 = e.clientX; UI.drag.y1 = e.clientY; if (Math.hypot(UI.drag.x1 - UI.drag.x0, UI.drag.y1 - UI.drag.y0) > 5) UI.drag.box = true; }
    if (INPUT.mid) { G.cam.x = INPUT.mid.cx - (e.clientX - INPUT.mid.x) / VIEW.S; G.cam.y = INPUT.mid.cy - (e.clientY - INPUT.mid.y) / VIEW.S; clampCam(); }
    if (UI.miniDown) miniGo(e);
  });
  document.addEventListener('mouseleave', () => { INPUT.inWin = false; });
  window.addEventListener('mouseup', e => {
    UI.miniDown = false;
    if (!G) return;
    if (e.button === 1) { INPUT.mid = null; return; }
    if (e.button !== 0) return;
    if (UI.roadDrag) { buildRoad(roadTiles()); UI.roadDrag = null; if (!e.shiftKey) UI.roadMode = false; return; }
    if (UI.wallDrag) { placeAt(e.shiftKey); UI.wallDrag = null; return; }
    const d = UI.drag; UI.drag = null; if (!d) return;
    if (d.box) boxSelect(d, e.shiftKey);
    else {
      const now = performance.now(), w = toWorld(d.x0, d.y0), e0 = pickAt(w), dbl = now - INPUT.last.t < 350 && e0 && INPUT.last.id === e0.id;
      INPUT.last = { t: now, id: e0 && e0.id }; clickSelect(w, e.shiftKey, dbl);
    }
  });
  cv.addEventListener('wheel', e => {
    if (!G || UI.modal) return; e.preventDefault();
    const before = toWorld(e.clientX, e.clientY);
    setZoom(VIEW.S + (e.deltaY < 0 ? 1 : -1));
    const after = toWorld(e.clientX, e.clientY); G.cam.x += before.x - after.x; G.cam.y += before.y - after.y; clampCam();
  }, { passive: false });
  // minimapa
  const mini = $('mini');
  const miniGo = e => { const r = mini.getBoundingClientRect(); G.cam.x = (e.clientX - r.left) / r.width * G.map.W * T; G.cam.y = (e.clientY - r.top) / r.height * G.map.H * T; clampCam(); };
  window.miniGo = miniGo;
  mini.addEventListener('mousedown', e => { audioUnlock(); if (!G) return; if (e.button === 0) { UI.miniDown = true; miniGo(e); } else if (e.button === 2) { const r = mini.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * G.map.W * T, y = (e.clientY - r.top) / r.height * G.map.H * T; const us = ownSelUnits(); if (us.length) { cmdMove(us, x, y, UI.amove); UI.amove = false; } } });
  mini.addEventListener('contextmenu', e => e.preventDefault());
  // panel inferior: retratos, cola, propuestas, modal
  $('info').addEventListener('click', e => {
    const c = e.target.closest('.mcell'); if (c) { const u = G.byId.get(+c.dataset.id); if (u && isActive(u)) { G.sel = e.shiftKey ? G.sel.filter(s => s !== u) : [u]; } return; }
    const q = e.target.closest('.qcell'); if (q && G.sel[0] && G.sel[0].team === G.human) { cancelQueue(G.sel[0], +q.dataset.q); sfx('click'); }
  });
  $('proposals').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.pr !== undefined) { respondProposal(+b.dataset.pr, b.dataset.ok === '1'); UI.prSig = null; } });
  $('modal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; sfx('click');
    if (b.dataset.close !== undefined) closeModal();
    else if (b.dataset.act === 'resume') closeModal();
    else if (b.dataset.act === 'help') openHelp();
    else if (b.dataset.act === 'gallery') openGallery('human');
    else if (b.dataset.act === 'restart') { closeModal(); showSetup(); }
    else if (b.dataset.act === 'watch') { closeModal(); UI.paused = false; }
    else if (b.dataset.gal) openGallery(b.dataset.gal);
    else if (b.dataset.dip || b.dataset.trib) onDiploClick(e);
  });
  document.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && !t.closest('.cmd')) showTip(t, esc(t.dataset.tip)); else if (!e.target.closest || !e.target.closest('.cmd')) hideTip(); });
  $('b-menu').onclick = () => openMenu();
  $('b-idle').onclick = () => onKey({ key: '.', preventDefault() {} });
  $('b-diplo').onclick = () => { openDiplomacy(); };
  $('b-music').onclick = () => { AUDIO.music = !AUDIO.music; $('b-music').classList.toggle('off', !AUDIO.music); };
  $('b-speed').onclick = () => { G.speed = G.speed >= 2 ? 1 : G.speed + 0.5; $('b-speed').textContent = G.speed + 'x'; };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', e => { INPUT.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { INPUT.keys = {}; });
}
function onKey(e) {
  const k = e.key.toLowerCase();
  if ($('setup') && !$('setup').hidden) return;
  if (UI.modal) { if (k === 'escape') closeModal(); return; }
  if (!G) return;
  INPUT.keys[k] = true;
  if (k.startsWith('arrow')) { e.preventDefault(); return; }
  if (e.ctrlKey && /^[1-9]$/.test(k)) { e.preventDefault(); if (!ownSelUnits().length) return; G.groups[k] = ownSelUnits().map(u => u.id); G.msg('Grupo ' + k + ' asignado', '#cfe8a0'); e.preventDefault(); return; }
  if (/^[1-9]$/.test(k)) {
    const ids = G.groups[k] || [], s = ids.map(id => G.byId.get(id)).filter(u => u && !u.dead && !u.inside);
    if (s.length) { const now = performance.now(); if (INPUT.grpTap.d === k && now - INPUT.grpTap.t < 350) { G.cam.x = s[0].x; G.cam.y = s[0].y; clampCam(); } INPUT.grpTap = { d: k, t: now }; G.sel = s; UI.page = 'root'; }
    return;
  }
  if (k === 'escape') { if (UI.placing || UI.amove || UI.roadMode) { UI.placing = null; UI.amove = false; UI.roadMode = false; } else if (UI.page !== 'root') { UI.page = 'root'; } else if (G.sel.length) G.sel = []; else openMenu(); return; }
  if (k === 'p' || k === 'pause') { openMenu(); return; }
  if (k === 'h') { const tc = G.blds.find(b => !b.dead && b.team === G.human && b.type === 'tc'); if (tc) { G.sel = [tc]; const c = centerOf(tc); G.cam.x = c.x; G.cam.y = c.y; clampCam(); } return; }
  if (k === '.') { const idle = G.units.filter(u => isActive(u) && u.team === G.human && u.def.role === 'worker' && u.order.t === 'idle'); if (idle.length) { INPUT.idleI = ((INPUT.idleI || 0) + 1) % idle.length; const u = idle[INPUT.idleI]; G.sel = [u]; G.cam.x = u.x; G.cam.y = u.y; clampCam(); } else G.msg('No hay aldeanos inactivos', '#cfe8a0'); return; }
  if (k === 'm' && !e.ctrlKey) { G.sel = G.units.filter(u => !u.dead && !u.inside && u.team === G.human && isMil(u)); UI.page = 'root'; return; }
  if (k === ' ') { e.preventDefault(); const t = G.sel[0] ? centerOf(G.sel[0]) : G.pings[G.pings.length - 1]; if (t) { G.cam.x = t.x; G.cam.y = t.y; clampCam(); } return; }
  const c = (UI.cmds || []).find(c => c && c.hk && c.hk.toLowerCase() === k);
  if (c) { e.preventDefault(); runCmd(c); }
}
function setZoom(s) { VIEW.S = clamp(s, 2, 5); resize(); }
function clampCam() {
  if (!G) return; const W = G.map.W * T, H = G.map.H * T, padB = 150 / VIEW.S;
  G.cam.x = clamp(G.cam.x, VIEW.w / 2 - 32, W - VIEW.w / 2 + 32); G.cam.y = clamp(G.cam.y, VIEW.h / 2 - 40, H - VIEW.h / 2 + padB + 16);
}
function cameraStep(dt) {
  const sp = 520 / VIEW.S * dt * 3 / 3 * (VIEW.S / 2.5), k = INPUT.keys, e = 6;
  let dx = 0, dy = 0;
  if (k['arrowleft'] || (INPUT.inWin && INPUT.mx >= 0 && INPUT.mx < e)) dx -= sp;
  if (k['arrowright'] || (INPUT.inWin && INPUT.mx > innerWidth - e)) dx += sp;
  if (k['arrowup'] || (INPUT.inWin && INPUT.my >= 0 && INPUT.my < e)) dy -= sp;
  if (k['arrowdown'] || (INPUT.inWin && INPUT.my > innerHeight - e)) dy += sp;
  if (dx || dy) { G.cam.x += dx; G.cam.y += dy; clampCam(); }
}
