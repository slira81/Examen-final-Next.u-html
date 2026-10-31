/* =====================================================================
   Interfaz: barra de recursos, panel de selección (vida, estadísticas,
   nivel y experiencia), rejilla de comandos con atajos, tooltips,
   registro de mensajes, propuestas, diplomacia, mercado y menús.
   ===================================================================== */
'use strict';
const UI = { placing: null, page: 'root', marks: [], mouseWorld: null, sig: '', infoT: 0, cmdT: 0, amove: false, rallyMode: false, roadDrag: null, wallDrag: null };
const $ = id => document.getElementById(id);
const HOTKEYS = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function iconCanvas(img, size, cls) {
  const c = document.createElement('canvas'), s = Math.max(1, Math.floor(Math.min(size / img.width, size / img.height)));
  c.width = img.width * s; c.height = img.height * s; c.className = cls || 'ico';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height); return c;
}
/** Imagen recortada (sin márgenes transparentes) para retratos. */
function trimmed(img) {
  if (img._trim) return img._trim;
  const x = img.getContext('2d'), d = x.getImageData(0, 0, img.width, img.height).data; let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let xx = 0; xx < img.width; xx++) if (d[(y * img.width + xx) * 4 + 3] > 40) { x0 = Math.min(x0, xx); y0 = Math.min(y0, y); x1 = Math.max(x1, xx); y1 = Math.max(y1, y); }
  if (x1 < 0) return (img._trim = img);
  const c = PE.makeCanvas(x1 - x0 + 1, y1 - y0 + 1); c.getContext('2d').drawImage(img, -x0, -y0); return (img._trim = c);
}
function costHTML(cost, team) {
  const p = G.players[team];
  return Object.entries(cost).filter(([, v]) => v).map(([k, v]) => `<span class="cost ${p && p.res[k] < v ? 'lack' : ''}"><i class="ri ri-${k}"></i>${v}</span>`).join(' ');
}
function resIconCSS() {
  // genera reglas CSS con los íconos de recursos como data URL
  let css = '';
  for (const r of [...RES, 'pop']) { const img = PE.frame('icons', 'icon_' + r, 0); const c = iconCanvas(img, 24); css += `.ri-${r}{background-image:url(${c.toDataURL()})}`; }
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
}
function initHUD() {
  resIconCSS();
  const rb = $('resbar'); rb.innerHTML = '';
  for (const r of RES) rb.insertAdjacentHTML('beforeend', `<span class="res" data-tip="${RES_N[r]}"><i class="ri ri-${r}"></i><b id="r-${r}">0</b></span>`);
  rb.insertAdjacentHTML('beforeend', `<span class="res" data-tip="Población / límite"><i class="ri ri-pop"></i><b id="r-pop">0</b></span>`);
  UI.mini = $('mini');
}
function updateTop() {
  if (G.human < 0) { $('resbar').style.visibility = 'hidden'; } else {
    const p = G.players[G.human];
    for (const r of RES) $('r-' + r).textContent = Math.floor(p.res[r]);
    const pe = $('r-pop'); pe.textContent = p.pop + '/' + p.popCap; pe.classList.toggle('lack', p.pop >= p.popCap);
    $('age').textContent = AGES[p.age - 1] + (p.relics ? ' · Reliquias ' + p.relics : '');
    const idle = G.units.filter(u => !u.dead && !u.inside && u.team === G.human && u.def.role === 'worker' && u.order.t === 'idle').length;
    const ib = $('b-idle'); ib.textContent = 'Inactivos: ' + idle; ib.classList.toggle('warn', idle > 0);
  }
  const t = Math.floor(G.time), mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
  $('clock').textContent = mm + ':' + ss; $('weather').textContent = WEATHER[G.weather.cur].n;
}
function updateLog() {
  const now = performance.now(), el = $('log');
  const recent = G.msgs.filter(m => now - m.real < 12000).slice(-7);
  const html = recent.map(m => `<div style="color:${m.color};opacity:${Math.min(1, (12000 - (now - m.real)) / 2000)}">${esc(m.text)}</div>`).join('');
  if (html !== UI.logHTML) { el.innerHTML = html; UI.logHTML = html; }
  // propuestas pendientes
  const pr = (G.proposals || []).filter(p => p.to === G.human);
  const sig = pr.map(p => p.from + p.type + p.t).join('|');
  if (sig !== UI.prSig) {
    UI.prSig = sig;
    $('proposals').innerHTML = pr.map(p => `<div class="toast"><b>${esc(G.players[p.from].name)}</b> ${p.type === 'alliance' ? 'propone una alianza' : p.type === 'peace' ? 'propone la paz' : 'exige ' + p.amt + ' de ' + RES_N[p.res].toLowerCase()}<div><button data-pr="${G.proposals.indexOf(p)}" data-ok="1">${p.type === 'tribute' ? 'Pagar' : 'Aceptar'}</button><button data-pr="${G.proposals.indexOf(p)}" data-ok="0">Rechazar</button></div></div>`).join('');
  }
}
// --------------------------------------------------------------- selección
function selSig() { return G.sel.map(e => e.id || e.tx + ',' + e.ty).join(',') + '|' + UI.page; }
function updateSelectionUI(force) {
  const sig = selSig();
  if (sig !== UI.sig || force) { UI.sig = sig; buildInfoStatic(); buildCmds(); }
  if ((UI.infoT -= 1) <= 0) { UI.infoT = 6; updateInfoDynamic(); }
  if ((UI.cmdT -= 1) <= 0) { UI.cmdT = 15; refreshCmdStates(); }
}
function portrait(e) {
  if (e.k === 'u') return trimmed(PE.frame('units', e.key, 0, { team: teamColorIdx(e.team), anim: 'idle' }));
  if (e.k === 'b') return trimmed(PE.frame('buildings', e.key, 0, { team: teamColorIdx(e.team), mask: 10 }));
  if (e.k === 'r') { const key = e.kind === 'tree' ? e.art : e.kind === 'berry' ? 'bush_berry' : e.kind === 'fish' ? 'fish_spot' : e.kind === 'carcass' ? null : 'mine_' + e.kind; return key ? trimmed(PE.frame('nature', key, 0, { v: 0 })) : trimmed(PE.frame('units', e.art, 0, { dead: true })); }
  return null;
}
const RES_KIND_N = { tree: 'Árbol', berry: 'Arbusto de bayas', fish: 'Banco de peces', carcass: 'Carne', gold: 'Mina de oro', gems: 'Veta de gemas', stone: 'Cantera de piedra', iron: 'Mina de hierro' };
function buildInfoStatic() {
  const el = $('info'); el.innerHTML = '';
  if (!G.sel.length) {
    if (G.human >= 0) { const p = G.players[G.human]; el.innerHTML = `<div class="hint"><b>${esc(p.name)}</b> · ${RACES[p.race].n}<br>Clic: seleccionar · arrastrar: selección múltiple · clic derecho: ordenar.<br>Las unidades militares ganan experiencia al <b>sobrevivir</b> a los combates y suben hasta nivel 5.</div>`; }
    return;
  }
  if (G.sel.length === 1) {
    const e = G.sel[0], img = portrait(e);
    const wrap = document.createElement('div'); wrap.className = 'one';
    if (img) { const pc = iconCanvas(img, 64, 'portrait'); wrap.appendChild(pc); }
    const txt = document.createElement('div'); txt.className = 'otxt'; txt.id = 'otxt'; wrap.appendChild(txt);
    el.appendChild(wrap);
    if (e.k === 'b') { const q = document.createElement('div'); q.id = 'queue'; q.className = 'queue'; wrap.appendChild(q); }
  } else {
    const grid = document.createElement('div'); grid.className = 'multi';
    for (const e of G.sel.slice(0, 40)) {
      const d = document.createElement('div'); d.className = 'mcell'; d.dataset.id = e.id;
      d.appendChild(iconCanvas(portrait(e), 24, 'mico'));
      d.insertAdjacentHTML('beforeend', `<i class="hpb"><i style="width:${Math.round(e.hp / e.maxhp * 100)}%"></i></i>` + (e.lvl > 1 ? `<em class="lv">${e.lvl}</em>` : ''));
      grid.appendChild(d);
    }
    el.appendChild(grid);
  }
  updateInfoDynamic();
}
function statLine(icon, v, tip) { return `<span class="st" data-tip="${tip}"><i class="si" style="background-image:url(${iconURL(icon)})"></i>${v}</span>`; }
const ICON_URL = {};
function iconURL(k) { return ICON_URL[k] || (ICON_URL[k] = iconCanvas(PE.frame('icons', k, 0), 24).toDataURL()); }
function updateInfoDynamic() {
  if (G.sel.length > 1) { document.querySelectorAll('.mcell').forEach(d => { const e = G.byId.get(+d.dataset.id); if (e) d.querySelector('.hpb i').style.width = Math.round(e.hp / e.maxhp * 100) + '%'; }); return; }
  const e = G.sel[0], el = $('otxt'); if (!e || !el) return;
  let h = '';
  const owner = e.team !== undefined && isPlayer(e.team) ? G.players[e.team] : null;
  if (e.k === 'u') {
    const d = e.def, st = uStats(e);
    h += `<div class="nm">${esc(d.n)}${e.lvl > 1 ? ` <span class="lvl">Nivel ${e.lvl}</span>` : ''}</div>`;
    h += `<div class="sub">${owner ? esc(owner.name) : e.team === HOSTILE ? 'Hostil' : isAnimal(e) ? 'Animal' : ''}${d.unique ? ' · General único' : ''}</div>`;
    h += `<div class="hpline"><i class="hpb big"><i style="width:${e.hp / e.maxhp * 100}%"></i></i> ${Math.ceil(e.hp)}/${e.maxhp}</div>`;
    if (!isAnimal(e)) {
      h += '<div class="stats">' + statLine('icon_attack', (Math.round(st.atk * 10) / 10) + (d.splash ? ' área' : ''), 'Ataque') + statLine('icon_armor', Math.round(st.arm), 'Armadura cuerpo a cuerpo') + statLine('icon_parmor', Math.round(st.parm), 'Armadura a distancia') + (st.range ? statLine('icon_range', st.range, 'Alcance (casillas)') : '') + statLine('icon_speed', Math.round(st.sp), 'Velocidad') + '</div>';
      if (isMil(e)) {
        const L = e.lvl, nxt = L < LEVEL_MAX ? LEVEL_XP[L] : null, prev = LEVEL_XP[L - 1];
        const f = nxt ? clamp((e.xp - prev) / (nxt - prev), 0, 1) : 1, pf = nxt ? Math.min(1 - f, e.pxp / (nxt - prev)) : 0;
        h += `<div class="xp"><i class="xpb"><i style="width:${f * 100}%"></i><i class="pend" style="left:${f * 100}%;width:${pf * 100}%"></i></i> ${nxt ? 'XP ' + Math.floor(e.xp) + '/' + nxt : 'Nivel máximo'}${e.pxp >= 1 ? ` <span class="pxp">+${Math.floor(e.pxp)} si sobrevive</span>` : ''}</div>`;
      }
      if (d.role === 'worker') h += `<div class="sub">${e.carry ? 'Lleva ' + e.carry + ' de ' + RES_N[e.ckind].toLowerCase() + ' · ' : ''}${orderText(e)}</div>`;
      if (d.unique) h += `<div class="sub gold">Aura: ${esc(d.aura.n)} · Habilidad: ${esc(d.ability.n)} ${e.abCd > 0 ? '(' + Math.ceil(e.abCd) + ' s)' : '(lista)'}</div>`;
      if (d.heal) h += `<div class="sub">Cura ${d.heal.v} de vida a aliados cercanos</div>`;
    }
  } else if (e.k === 'b') {
    const d = e.def, nm = owner && RACES[owner.race].names[e.type] || d.n;
    h += `<div class="nm">${esc(nm)}</div><div class="sub">${owner ? esc(owner.name) : e.team === HOSTILE ? 'Hostil' : 'Neutral'}</div>`;
    if (!d.invuln) h += `<div class="hpline"><i class="hpb big"><i style="width:${e.hp / e.maxhp * 100}%"></i></i> ${Math.ceil(e.hp)}/${e.maxhp}</div>`;
    if (!e.done) h += `<div class="sub">Construcción: ${Math.floor(e.progress * 100)}%${e.nb ? ' · ' + e.nb + ' constructor(es)' : ' · sin constructores'}</div>`;
    else {
      const chips = [];
      if (e.type === 'farm') chips.push('Comida restante: ' + Math.floor(e.food) + (e.farmer ? '' : ' (sin granjero)'));
      if (d.pop) chips.push('+' + d.pop + ' de población');
      if (d.drop) chips.push('Acopio: ' + (d.drop.length === 5 ? 'todos los recursos' : d.drop.map(r => RES_N[r].toLowerCase()).join(', ')));
      if (d.garrison) chips.push('Guarnición ' + (e.garrison || []).length + '/' + d.garrison + ((e.garrison || []).length ? ' (+' + Math.min(10, e.garrison.length) + ' flechas)' : ''));
      if (chips.length) h += `<div class="sub">${chips.join(' · ')}</div>`;
      if (d.atk) { const bs = bStats(e); h += '<div class="stats">' + statLine('icon_attack', bs.atk, 'Ataque') + statLine('icon_range', bs.range, 'Alcance') + statLine('icon_armor', bs.arm, 'Armadura cuerpo a cuerpo') + statLine('icon_parmor', bs.parm, 'Armadura a distancia') + '</div>'; }
      if (e.housed) h += `<div class="sub warn">Producción detenida: falta población</div>`;
      if (d.market && e.team === G.human) h += `<div class="sub">Compra y vende recursos con los botones. Precios: ${['food', 'wood', 'stone', 'iron'].map(r => RES_N[r] + ' ' + Math.round(owner.market[r])).join(' · ')}</div>`;
    }
    const q = $('queue');
    if (q) {
      const sig = e.queue.map(x => x.key).join(',');
      if (q.dataset.sig !== sig) { q.dataset.sig = sig; q.innerHTML = ''; e.queue.forEach((it, i) => { const c = it.kind === 'unit' ? iconCanvas(trimmed(PE.frame('units', it.key, 0, { team: teamColorIdx(e.team) })), 22, 'qi') : iconCanvas(PE.frame('icons', TECHS[it.key].icon, 0), 22, 'qi'); const w = document.createElement('div'); w.className = 'qcell'; w.dataset.q = i; w.dataset.tip = 'Clic para cancelar: ' + (it.kind === 'unit' ? UNITS[it.key].n : TECHS[it.key].n); w.appendChild(c); if (i === 0) w.insertAdjacentHTML('beforeend', '<i class="qp"><i></i></i>'); q.appendChild(w); }); }
      const first = e.queue[0], qp = q.querySelector('.qp i'); if (first && qp) qp.style.width = Math.min(100, e.qt / (first.kind === 'unit' ? UNITS[first.key].time : TECHS[first.key].time) * 100) + '%';
    }
  } else if (e.k === 'r') {
    h += `<div class="nm">${RES_KIND_N[e.kind] || 'Recurso'}</div><div class="sub">${Math.floor(e.amt)} de ${RES_N[RES_TYPE[e.kind]].toLowerCase()}${e.burn ? ' · ¡en llamas!' : ''}</div>`;
  }
  if (el.innerHTML !== h) el.innerHTML = h;
}
function orderText(u) {
  const o = u.order;
  return { idle: 'Inactivo', move: 'Moviéndose', attack: 'Atacando', gather: 'Recolectando ' + (RES_KIND_N[o.kind] || '').toLowerCase(), farm: 'Cultivando', return: 'Llevando recursos', build: o.b && o.b.done ? 'Reparando' : 'Construyendo', treasure: 'Buscando tesoro' }[o.t] || '';
}
// --------------------------------------------------------------- comandos
function cmdList() {
  const out = [], s = G.sel; if (!s.length || G.human < 0) return out;
  const mine = s.filter(e => e.team === G.human && !e.dead && !e.inside); if (!mine.length) return out;
  const p = G.players[G.human], race = p.race;
  const units = mine.filter(e => e.k === 'u' && !isAnimal(e)), workers = units.filter(u => u.def.role === 'worker');
  const bld = mine.length === 1 && mine[0].k === 'b' ? mine[0] : null;
  const back = { icon: ['icons', 'cmd_back'], n: 'Volver', key: 'b', fn: () => { UI.page = 'root'; updateSelectionUI(true); } };
  if (workers.length && UI.page !== 'root') {
    const list = UI.page === 'eco' ? ['house', 'farm', 'mill', 'lumber', 'mine', 'market', 'tower', 'wall', 'gate', 'tc'] : ['barracks', 'range', 'stable', 'temple', 'forge', 'workshop', 'castle'];
    for (const t of list) { const d = BLD[t]; out.push({ icon: ['buildings', race + '_' + t], n: (RACES[race].names[t] || d.n), cost: costOf(G.human, d.cost), d: bldDesc(t), locked: d.age > p.age ? 'Requiere ' + AGES[d.age - 1] : null, fn: () => startPlacing(t) }); }
    if (UI.page === 'eco') out.push({ icon: ['icons', 'cmd_road'], n: 'Camino', cost: { stone: 2 }, d: 'Arrastra para trazar un camino. Las unidades se mueven un 35% más rápido sobre él. 2 de piedra por casilla.', fn: () => { UI.roadMode = true; UI.placing = null; } });
    while (out.length < 14) out.push(null);
    out.push(back);
    return out;
  }
  if (workers.length) {
    out.push({ icon: ['icons', 'cmd_build'], n: 'Edificios económicos', d: 'Casas, granjas, acopios, mercado, torres, muros, caminos.', fn: () => { UI.page = 'eco'; updateSelectionUI(true); } });
    out.push({ icon: ['icons', 'cmd_wall'], n: 'Edificios militares', d: 'Cuartel, galería de tiro, establo, templo, herrería, taller de asedio y castillo.', fn: () => { UI.page = 'mil'; updateSelectionUI(true); } });
  }
  if (units.length) {
    const gen = units.find(u => u.def.unique);
    if (gen) out.push({ icon: ['icons', 'cmd_ability'], n: gen.def.ability.n, d: gen.def.ability.d + '. Se lanza sola en combate. Recarga: ' + gen.def.ability.cd + ' s.', locked: gen.abCd > 0 ? 'Recargando (' + Math.ceil(gen.abCd) + ' s)' : null, fn: () => { if (gen.abCd > 0) return; if (castAbility(gen)) gen.abCd = gen.def.ability.cd; else G.msg('No hay objetivos para ' + gen.def.ability.n, '#ffb070'); } });
    while (out.length < 5) out.push(null);
    out.push({ icon: ['icons', 'cmd_attackmove'], n: 'Atacar moviéndose', key: 'a', d: 'Haz clic en el destino: las unidades atacan a todo enemigo que encuentren por el camino.', fn: () => { UI.amove = true; } });
    out.push({ icon: ['icons', 'cmd_stop'], n: 'Detener', key: 's', d: 'Cancela la orden actual.', fn: () => units.forEach(u => setOrder(u, { t: 'idle' })) });
    if (workers.length) out.push({ icon: ['icons', 'cmd_repair'], n: 'Reparar / construir', d: 'Clic derecho sobre un edificio propio dañado o sin terminar.', fn: () => G.msg('Haz clic derecho sobre un edificio propio para repararlo', '#cfe8a0') });
    while (out.length < 14) out.push(null);
    out.push({ icon: ['icons', 'cmd_delete'], n: 'Eliminar', key: 'Delete', d: 'Elimina las unidades seleccionadas.', fn: () => { for (const u of units) kill(u, null); } });
    return out;
  }
  if (bld && bld.done) {
    const d = bld.def;
    for (const role of d.train || []) {
      const key = race + '_' + role, ud = UNITS[key];
      out.push({ icon: ['units', key], n: ud.n, cost: costOf(G.human, ud.cost), d: unitDesc(ud), locked: ud.age > p.age ? 'Requiere ' + AGES[ud.age - 1] : (ud.unique && p.generalId && G.byId.get(p.generalId)) ? 'Ya tienes un ' + ud.n : null, fn: () => doEnqueue(bld, 'unit', key) });
    }
    if (d.market) for (const r of ['food', 'wood', 'stone', 'iron']) {
      out.push({ icon: ['icons', 'icon_' + r], n: 'Comprar 100 de ' + RES_N[r].toLowerCase(), cost: { gold: Math.round(p.market[r]) }, d: 'El precio sube con cada compra.', fn: () => { const e = marketTrade(G.human, r, true); if (e) G.msg(e, '#ffb070', { sound: 'error' }); else sfx('click'); } });
    }
    while (out.length % 5) out.push(null);
    for (const t of d.techs || []) {
      if (p.techs.has(t)) continue; const td = TECHS[t];
      if (td.toAge && td.age !== p.age) continue;
      const nm = t === 'unique' ? RACES[race].unique.n : td.n, ds = t === 'unique' ? RACES[race].unique.d : td.d;
      out.push({ icon: ['icons', td.icon], n: nm, cost: costOf(G.human, td.cost), d: ds, locked: p.researching.has(t) ? 'Investigando…' : td.age && p.age < td.age ? 'Requiere ' + AGES[td.age - 1] : td.req && !p.techs.has(td.req) ? 'Requiere ' + TECHS[td.req].n : null, fn: () => doEnqueue(bld, 'tech', t) });
    }
    if (d.market) { while (out.length % 5) out.push(null); for (const r of ['food', 'wood', 'stone', 'iron']) out.push({ icon: ['icons', 'icon_' + r], n: 'Vender 100 de ' + RES_N[r].toLowerCase(), d: 'Recibes ' + Math.round(p.market[r] * 0.7) + ' de oro. El precio baja con cada venta.', fn: () => { const e = marketTrade(G.human, r, false); if (e) G.msg(e, '#ffb070', { sound: 'error' }); else sfx('click'); } }); out.push({ icon: ['icons', 'cmd_diplomacy'], n: 'Diplomacia y tributos', d: 'Sin mercado, los tributos pierden un 20%.', fn: () => openDiplomacy() }); }
    if (d.garrison) {
      while (out.length < 10) out.push(null);
      if (bld.type === 'tc') out.push(p.bell ? { icon: ['icons', 'cmd_back'], n: 'Regresar al trabajo', d: 'Los aldeanos refugiados vuelven a sus tareas.', fn: () => releaseBell(G.human) } : { icon: ['icons', 'cmd_idle'], n: 'Toque de campana', d: 'Los aldeanos cercanos se refugian en el centro urbano, torres y castillo, que disparan una flecha más por cada unidad dentro.', fn: () => ringBell(G.human) });
      out.push({ icon: ['icons', 'cmd_back'], n: 'Expulsar guarnición (' + (bld.garrison || []).length + '/' + d.garrison + ')', d: 'Saca a todas las unidades del edificio. Con clic derecho sobre el edificio, tus soldados entran en él.', fn: () => { ejectAll(bld); updateSelectionUI(true); } });
    }
    while (out.length < 13) out.push(null);
    if (d.train) out.push({ icon: ['icons', 'cmd_rally'], n: 'Punto de reunión', d: 'Haz clic derecho en el mapa con el edificio seleccionado para fijar dónde van las unidades nuevas (sobre un recurso, los aldeanos irán a recolectarlo).', fn: () => G.msg('Clic derecho en el mapa para fijar el punto de reunión', '#cfe8a0') });
    else out.push(null);
    out.push({ icon: ['icons', 'cmd_delete'], n: 'Demoler', key: 'Delete', d: 'Destruye el edificio.', fn: () => kill(bld, null) });
    return out;
  }
  if (bld && !bld.done) { while (out.length < 14) out.push(null); out.push({ icon: ['icons', 'cmd_delete'], n: 'Cancelar construcción', key: 'Delete', d: 'Recuperas el 75% del coste.', fn: () => { refund(G.human, costOf(G.human, bld.def.cost), 0.75); removeBuilding(bld); G.sel = []; } }); return out; }
  return out;
}
function bldDesc(t) {
  const d = BLD[t], parts = [];
  if (d.train) parts.push('Entrena: ' + d.train.map(r => UNITS[G.players[G.human].race + '_' + r].n).join(', '));
  if (d.drop) parts.push('Acopio de ' + d.drop.map(r => RES_N[r].toLowerCase()).join(', '));
  if (d.pop) parts.push('+' + d.pop + ' de población');
  if (d.atk) parts.push('Dispara flechas (alcance ' + d.range + ')');
  if (t === 'farm') parts.push('Fuente de comida renovable');
  if (t === 'market') parts.push('Comercio y tributos sin pérdidas');
  if (t === 'wall') parts.push('Arrastra para levantar un muro');
  if (t === 'gate') parts.push('Solo pasan tus unidades y las aliadas. Puede colocarse sobre un muro');
  if (d.techs && d.techs.length) parts.push('Investiga mejoras');
  return parts.join('. ') + '.';
}
function unitDesc(ud) {
  const parts = [`Vida ${ud.hp} · Ataque ${ud.atk}${ud.range ? ' · Alcance ' + ud.range : ''} · Armadura ${ud.arm}/${ud.parm}`];
  const b = Object.entries(ud.bonus || {}).map(([k, v]) => `+${v} vs ${({ building: 'edificios', cav: 'caballería', inf: 'infantería', pike: 'lanceros', ranged: 'tiradores', siege: 'asedio', general: 'generales', worker: 'aldeanos' })[k] || k}`);
  if (b.length) parts.push(b.join(', '));
  if (ud.splash) parts.push('Daño en área'); if (ud.heal) parts.push('Cura aliados'); if (ud.slow) parts.push('Ralentiza'); if (ud.chain) parts.push('Rayo en cadena'); if (ud.ap) parts.push('Ignora media armadura');
  if (ud.unique) parts.push('ÚNICO: solo uno a la vez. ' + ud.aura.n + ': ' + ud.aura.d + '. ' + ud.ability.n + ': ' + ud.ability.d);
  if (ud.pop > 1) parts.push('Ocupa ' + ud.pop + ' de población');
  return parts.join('. ') + '.';
}
/** Ejecuta un comando del panel; los bloqueados (era, recarga, en investigación) solo informan. */
function runCmd(c) {
  if (c.locked && !c.allowLocked) { G.msg(c.locked, '#ffb070', { sound: 'error' }); return; }
  sfx('click'); c.fn();
}
function doEnqueue(b, kind, key) { const e = enqueue(b, kind, key); if (e) G.msg(e, '#ffb070', { sound: 'error' }); else sfx('click'); refreshCmdStates(); }
function buildCmds() {
  const el = $('cmds'); el.innerHTML = ''; UI.cmds = cmdList();
  UI.cmds.slice(0, 15).forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'cmd';
    if (!c) { b.className = 'cmd empty'; b.disabled = true; el.appendChild(b); return; }
    const [kind, key] = c.icon; let img;
    if (kind === 'units') img = trimmed(PE.frame('units', key, 0, { team: teamColorIdx(G.human), anim: 'idle' }));
    else if (kind === 'buildings') img = trimmed(PE.frame('buildings', key, 0, { team: teamColorIdx(G.human), mask: 10 }));
    else img = PE.frame(kind, key, 0);
    b.appendChild(iconCanvas(img, 32, 'cico'));
    c.hk = c.key || HOTKEYS[i];
    b.insertAdjacentHTML('beforeend', `<em>${c.hk === 'Delete' ? 'Supr' : c.hk.toUpperCase()}</em>`);
    b.onclick = () => runCmd(c);
    b.onmouseenter = () => showTip(b, `<b>${esc(c.n)}</b> <span class="hk">[${c.hk === 'Delete' ? 'Supr' : c.hk.toUpperCase()}]</span>${c.cost ? '<div>' + costHTML(c.cost, G.human) + '</div>' : ''}${c.locked ? `<div class="warn">${esc(c.locked)}</div>` : ''}<div class="d">${esc(c.d || '')}</div>`);
    b.onmouseleave = hideTip;
    c.el = b; el.appendChild(b);
  });
  refreshCmdStates();
}
function refreshCmdStates() {
  if (!UI.cmds || G.human < 0) return;
  for (const c of UI.cmds) { if (!c || !c.el) continue; const lack = c.cost && !canAfford(G.human, c.cost); c.el.classList.toggle('lack', !!lack); c.el.classList.toggle('locked', !!c.locked); }
}
function showTip(el, html) { const t = $('tip'); t.innerHTML = html; t.hidden = false; const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 300, Math.max(8, r.left - 100)) + 'px'; t.style.bottom = (innerHeight - r.top + 8) + 'px'; }
function hideTip() { $('tip').hidden = true; }

// --------------------------------------------------------------- colocación
function startPlacing(t) {
  const p = G.players[G.human], d = BLD[t];
  if (d.age > p.age) { G.msg('Requiere ' + AGES[d.age - 1], '#ffb070', { sound: 'error' }); return; }
  if (!canAfford(G.human, costOf(G.human, d.cost))) { G.msg('Faltan recursos: ' + missingText(G.human, costOf(G.human, d.cost)), '#ffb070', { sound: 'error' }); return; }
  UI.placing = t; UI.roadMode = false;
}
function placementTiles() {
  const d = BLD[UI.placing], w = UI.mouseWorld;
  const tx = Math.round(w.x / T - d.fp / 2), ty = Math.round(w.y / T - d.fp / 2);
  if (UI.wallDrag && d.wall) return lineTiles(UI.wallDrag.tx, UI.wallDrag.ty, Math.floor(w.x / T), Math.floor(w.y / T));
  return [[tx, ty]];
}
function lineTiles(x0, y0, x1, y1) {
  const out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  if (dx >= dy) { const s = Math.sign(x1 - x0) || 1; for (let x = x0; x !== x1 + s; x += s) out.push([x, y0]); if (dy) { const s2 = Math.sign(y1 - y0); for (let y = y0 + s2; y !== y1 + s2; y += s2) out.push([x1, y]); } }
  else { const s = Math.sign(y1 - y0) || 1; for (let y = y0; y !== y1 + s; y += s) out.push([x0, y]); if (dx) { const s2 = Math.sign(x1 - x0); for (let x = x0 + s2; x !== x1 + s2; x += s2) out.push([x, y1]); } }
  return out.slice(0, 60);
}
function roadTiles() { const w = UI.mouseWorld, r = UI.roadDrag; return lineTiles(r.tx, r.ty, Math.floor(w.x / T), Math.floor(w.y / T)); }
function canRoad(tx, ty) {
  const m = G.map; if (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H) return false;
  const i = ty * m.W + tx, t = m.terr[i];
  return !m.blocked[i] && !m.res[i] && (t === TR.GRASS || t === TR.GRASS_DARK || t === TR.DIRT || t === TR.SAND || t === TR.SNOW) && exploredAt(tx, ty);
}
function buildRoad(tiles) {
  let n = 0; const p = G.players[G.human];
  for (const [tx, ty] of tiles) { if (!canRoad(tx, ty)) continue; if (p.res.stone < 2) { G.msg('Falta piedra para el camino', '#ffb070', { sound: 'error' }); break; } p.res.stone -= 2; G.map.terr[ty * G.map.W + tx] = TR.ROAD; redrawTiles(tx, ty); n++; }
  if (n) { sfx('build'); G.msg('Camino trazado: ' + n + ' casillas', '#cfe8a0'); }
}

// --------------------------------------------------------------- diplomacia
function openDiplomacy() {
  if (G.human < 0) return;
  const me = G.human, rows = G.players.filter(p => p.id !== me).map(p => {
    const st = G.stance[me][p.id], rel = Math.round(G.rel[p.id][me]);
    return `<tr class="${p.alive ? '' : 'dead'}"><td><i class="sw" style="background:${PE.TEAM_COLORS[p.color].hex}"></i></td><td><b>${esc(p.name)}</b><br><small>${RACES[p.race].n}${p.alive ? '' : ' · derrotado'}</small></td>
      <td><div class="stance">${['ally', 'neutral', 'enemy'].map(s => `<button data-dip="${p.id}" data-st="${s}" class="${st === s ? 'on ' + s : ''}" ${p.alive ? '' : 'disabled'}>${STANCE_N[s]}</button>`).join('')}</div></td>
      <td><div class="relbar"><i style="left:${(rel + 100) / 2}%"></i></div><small>Relación ${rel > 0 ? '+' : ''}${rel}</small></td>
      <td class="trib">${RES.map(r => `<button data-trib="${p.id}" data-res="${r}" ${p.alive ? '' : 'disabled'} data-tip="Enviar 100 de ${RES_N[r].toLowerCase()}"><i class="ri ri-${r}"></i>100</button>`).join('')}</td></tr>`;
  }).join('');
  openModal(`<h2>Diplomacia</h2><p class="lead">Propón alianzas o paz, declara la guerra o envía tributos para mejorar la relación. Los aliados comparten visión, no se atacan y acuden a defenderse. La IA acepta una alianza con relación de 40 o más.</p><table class="dip">${rows}</table><div class="mrow"><button data-close>Cerrar</button></div>`);
}
function onDiploClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.dip) {
    const id = +b.dataset.dip, st = b.dataset.st, cur = G.stance[G.human][id];
    if (st === cur) return;
    if (st === 'enemy') declareWar(G.human, id);
    else if (st === 'neutral') { if (cur === 'ally') breakAlliance(G.human, id); else propose(G.human, id, 'peace'); }
    else propose(G.human, id, 'alliance');
    openDiplomacy();
  } else if (b.dataset.trib) { const e2 = tribute(G.human, +b.dataset.trib, b.dataset.res, 100); if (e2) G.msg(e2, '#ffb070', { sound: 'error' }); else { G.msg('Tributo enviado a ' + G.players[+b.dataset.trib].name, '#cfe8a0'); sfx('treasure'); } openDiplomacy(); }
}
function openModal(html) { const m = $('modal'); m.innerHTML = '<div class="mbox">' + html + '</div>'; m.hidden = false; UI.modal = true; }
function closeModal() { $('modal').hidden = true; UI.modal = false; if (UI.pausedByModal) { UI.paused = false; UI.pausedByModal = false; } }
function openMenu() {
  UI.paused = true; UI.pausedByModal = true;
  openModal(`<h2>Pausa</h2><div class="menu">
    <button data-act="resume">Continuar</button><button data-act="help">Cómo jugar</button><button data-act="gallery">Galería de diseños</button><button data-act="restart">Nueva partida</button></div>
    <div class="vol"><label for="v-sfx">Efectos</label><input id="v-sfx" type="range" min="0" max="100" value="${AUDIO.sfxVol * 100}"><label for="v-mus">Música</label><input id="v-mus" type="range" min="0" max="100" value="${AUDIO.musVol * 100}"></div>`);
  $('v-sfx').oninput = e => { AUDIO.sfxVol = e.target.value / 100; };
  $('v-mus').oninput = e => { AUDIO.musVol = e.target.value / 100; };
}
function openHelp() {
  openModal(`<h2>Cómo jugar</h2><div class="help">
  <h3>Controles</h3><ul>
  <li><b>Clic izquierdo</b>: seleccionar. Arrastra para seleccionar varias unidades. Doble clic: todas las del mismo tipo en pantalla.</li>
  <li><b>Clic derecho</b>: mover, atacar, recolectar, construir, reparar, cazar o recoger tesoros. Con un edificio seleccionado fija el punto de reunión.</li>
  <li><b>Flechas, bordes o botón central</b>: mover la cámara. <b>Rueda</b>: zoom. <b>H</b>: centro urbano. <b>.</b>: aldeano inactivo.</li>
  <li><b>Ctrl + 1–9</b>: crear grupo; <b>1–9</b>: seleccionar grupo. <b>A</b>: atacar moviéndose. <b>S</b>: detener. <b>Supr</b>: eliminar. <b>P</b> o <b>Esc</b>: pausa.</li>
  <li>Los comandos del panel se activan con <b>Q W E R T / A S D F G / Z X C V B</b>.</li></ul>
  <h3>Economía</h3><p>Recursos: comida, madera, oro, piedra y hierro. Los aldeanos los llevan al centro urbano o a un acopio (molino, aserradero, campamento minero). Construye casas para aumentar la población. Las granjas dan comida renovable y se resiembran solas con 60 de madera. Los caminos aceleran el movimiento.</p>
  <h3>Eras</h3><p>Avanza en el centro urbano. Necesitas dos edificios de la era actual. La Era del Reino desbloquea tiradores, caballería, templo, herrería, mercado, torres y muros; la Era del Imperio, el asedio, el castillo y tu general.</p>
  <h3>Experiencia y niveles</h3><p>Las unidades militares acumulan experiencia pendiente al dañar y derrotar enemigos. Solo la ganan si <b>sobreviven al enfrentamiento</b> (5 segundos sin combatir). Subir es progresivo: nivel 2 con 100 XP, 3 con 260, 4 con 480 y 5 con 800. Cada nivel da +10% de vida y +8% de ataque; desde el nivel 3, +1 de armadura, y desde el 4 regeneran vida. La insignia sobre la cabeza indica el nivel.</p>
  <h3>Generales</h3><p>Cada raza tiene un general único que se entrena en el castillo. Solo puede existir uno a la vez. Tiene un aura que refuerza a los aliados cercanos y una habilidad especial que lanza solo en combate.</p>
  <h3>Mundo</h3><p>Bandidos y goblins atacan desde sus campamentos: destrúyelos para obtener botín. Hay cofres, reliquias (oro constante) y un santuario custodiado por un ogro. El clima cambia (lluvia, niebla, nieve, tormentas) y pueden ocurrir incendios, terremotos y plagas.</p>
  <h3>Diplomacia</h3><p>Desde la barra superior puedes aliarte, firmar la paz, declarar la guerra o enviar tributos. Ganas cuando todos los reinos que quedan son tus aliados.</p></div><div class="mrow"><button data-close>Cerrar</button></div>`);
}
function endGame(won) {
  if (G.over) return; G.over = true;
  const rows = G.players.map(p => `<tr><td><i class="sw" style="background:${PE.TEAM_COLORS[p.color].hex}"></i> ${esc(p.name)}</td><td>${RACES[p.race].n}</td><td>${p.alive ? 'En pie' : 'Derrotado'}</td><td>${p.stats.trained}</td><td>${p.stats.killed}</td><td>${p.stats.lost}</td><td>${p.stats.razed}</td><td>${Math.round(Object.values(p.stats.gathered).reduce((a, b) => a + b, 0))}</td><td>${p.stats.maxLevel}</td></tr>`).join('');
  setTimeout(() => {
    UI.paused = true;
    openModal(`<h2 class="${won ? 'win' : 'lose'}">${won ? '¡Victoria!' : 'Derrota'}</h2><p class="lead">${won ? 'Tu imperio domina estas tierras.' : 'Tu reino ha caído, pero la historia aún puede reescribirse.'} Duración: ${Math.floor(G.time / 60)} min.</p>
      <table class="stats-t"><tr><th>Reino</th><th>Raza</th><th>Estado</th><th>Unidades</th><th>Bajas causadas</th><th>Pérdidas</th><th>Edificios arrasados</th><th>Recursos</th><th>Nivel máx.</th></tr>${rows}</table>
      <div class="mrow"><button data-act="watch">Seguir mirando</button><button data-act="restart">Nueva partida</button></div>`);
    sfx(won ? 'horn' : 'die');
  }, 1200);
}
