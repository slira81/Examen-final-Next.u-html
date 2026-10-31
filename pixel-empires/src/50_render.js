/* =====================================================================
   Render: terreno pre-renderizado con bordes mezclados entre biomas,
   agua animada con espuma, niebla de guerra suave, entidades ordenadas
   por profundidad, insignias de nivel, clima, efectos y minimapa.
   ===================================================================== */
'use strict';
const VIEW = { S: 3, w: 480, h: 300, cv: null, ctx: null, anim: 0 };
const teamColorIdx = t => t >= 0 && t < 8 && G.players[t] ? G.players[t].color : 6;

// --------------------------------------------------------------- terreno
const EDGE = { cache: new Map() };
const DIRS8 = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 3], [1, 1, 6], [-1, 1, 12], [-1, -1, 9]];
function hash2(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
function tileImg(t, v, f = 0) { return PE.frame('nature', TR_TILE[t], f, { v: v % TR_VARS[t] }); }
/** Tile del terreno t recortada a una banda irregular junto al borde d (0..7 = N E S O NE SE SO NO). */
function edgeTile(t, d, v, f = 0) {
  const k = t + ':' + d + ':' + v + ':' + f; let c = EDGE.cache.get(k); if (c) return c;
  const src = tileImg(t, v, f); c = PE.makeCanvas(T, T); const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const id = x.getImageData(0, 0, T, T), D = id.data;
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    let dd;
    if (d === 0) dd = py; else if (d === 1) dd = T - 1 - px; else if (d === 2) dd = T - 1 - py; else if (d === 3) dd = px;
    else { const ex = d === 4 || d === 5 ? T - 1 - px : px, ey = d === 4 || d === 7 ? py : T - 1 - py; dd = Math.hypot(ex, ey) * 0.9; }
    const n = hash2(px * 7 + d, py * 13 + t) * 1.6 + Math.sin((d < 4 ? (d % 2 ? py : px) : px + py) * 0.9 + t) * 0.6;
    if (dd > 3.4 + n) D[(py * T + px) * 4 + 3] = 0;
  }
  x.putImageData(id, 0, 0); EDGE.cache.set(k, c); return c;
}
function prerenderTerrain() {
  const m = G.map, W = m.W, H = m.H;
  VIEW.terr = PE.makeCanvas(W * T, H * T); const x = VIEW.terr.getContext('2d'); x.imageSmoothingEnabled = false;
  VIEW.waterTiles = new Map();
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) drawTerrainTile(x, tx, ty);
  // decoración estática
  for (const d of m.decor) {
    if (d.anim) continue; const def = PE.ART.nature[d.key]; if (!def) continue;
    const img = PE.frame('nature', d.key, 0, { v: d.v }); x.drawImage(img, d.tx * T + 8 - (def.ax ?? img.width / 2), d.ty * T + 15 - (def.ay ?? img.height - 1));
  }
  // color del minimapa
  VIEW.miniBase = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) { const c = PE.hx(TR_COLOR[m.terr[i]]); VIEW.miniBase.data.set([c[0], c[1], c[2], 255], i * 4); }
  VIEW.fog = PE.makeCanvas(W, H); VIEW.fogCtx = VIEW.fog.getContext('2d'); VIEW.fogImg = VIEW.fogCtx.createImageData(W, H); G.fogDirty = true;
}
function drawTerrainTile(x, tx, ty) {
  const m = G.map, W = m.W, i = ty * W + tx, t = m.terr[i], v = Math.floor(hash2(tx, ty) * 8);
  x.drawImage(tileImg(t, v), tx * T, ty * T);
  const edges = [];
  for (let d = 0; d < 8; d++) {
    const [dx, dy] = DIRS8[d], nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= m.H) continue;
    const nt = m.terr[ny * W + nx]; if (TR_PRIO[nt] <= TR_PRIO[t]) continue;
    if (d >= 4) { const a = m.terr[ty * W + nx], b = m.terr[ny * W + tx]; if (a === nt || b === nt) continue; }
    edges.push(edgeTile(nt, d, Math.floor(hash2(nx, ny) * 8) % TR_VARS[nt]));
  }
  edges.sort((a, b) => 0);
  for (const e of edges) x.drawImage(e, tx * T, ty * T);
  if (t === TR.WATER || t === TR.SHALLOW) {
    let mask = 0; for (let d = 0; d < 4; d++) { const [dx, dy, bit] = DIRS8[d], nx = tx + dx, ny = ty + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < m.H) { const nt = m.terr[ny * W + nx]; if (nt !== TR.WATER && nt !== TR.SHALLOW) mask |= bit; } }
    VIEW.waterTiles.set(i, { t, edges, mask });
  } else VIEW.waterTiles.delete(i);
}
function redrawTiles(tx, ty, r = 1) {
  const x = VIEW.terr.getContext('2d');
  for (let y = ty - r; y <= ty + r; y++) for (let xx = tx - r; xx <= tx + r; xx++) if (xx >= 0 && y >= 0 && xx < G.map.W && y < G.map.H) drawTerrainTile(x, xx, y);
  const i = ty * G.map.W + tx; VIEW.miniBase.data.set(PE.hx(TR_COLOR[G.map.terr[i]]).slice(0, 3), i * 4);
}
function updateFog() {
  const v = G.vis, d = VIEW.fogImg.data;
  for (let i = 0; i < v.length; i++) d[i * 4 + 3] = v[i] === 2 ? 0 : v[i] === 1 ? 135 : 255;
  for (let i = 0; i < v.length; i++) { d[i * 4] = 8; d[i * 4 + 1] = 6; d[i * 4 + 2] = 16; }
  VIEW.fogCtx.putImageData(VIEW.fogImg, 0, 0); G.fogDirty = false;
}

// --------------------------------------------------------------- utilidades de dibujo
function flipped(c) { if (c._flip) return c._flip; const f = PE.makeCanvas(c.width, c.height), x = f.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); c._flip = f; return f; }
function unitFrame(u) {
  const anim = u.anim === 'work' ? 'work' : u.anim, n = PE.ANIMS[anim].length;
  return PE.frame('units', u.key, Math.floor(u.af) % n, { team: teamColorIdx(u.team), anim, carry: u.carry > 0 ? u.ckind : undefined });
}
function bar(x, y, w, f, col) {
  const c = VIEW.ctx; c.fillStyle = '#1a1020'; c.fillRect(x - 1, y - 1, w + 2, 4);
  c.fillStyle = col || (f > 0.5 ? '#5fd35a' : f > 0.25 ? '#e8c43a' : '#e4483a'); c.fillRect(x, y, Math.max(1, Math.round(w * f)), 2);
}

// --------------------------------------------------------------- frame principal
function render(dtReal) {
  const c = VIEW.ctx, m = G.map; VIEW.anim += dtReal;
  let cx = Math.round(G.cam.x - VIEW.w / 2), cy = Math.round(G.cam.y - VIEW.h / 2);
  if (G.shake > 0) { cx += Math.round((Math.random() - 0.5) * 6); cy += Math.round((Math.random() - 0.5) * 4); }
  VIEW.cx = cx; VIEW.cy = cy;
  c.fillStyle = '#0a0812'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  c.drawImage(VIEW.terr, cx, cy, VIEW.w, VIEW.h, 0, 0, VIEW.w, VIEW.h);
  const x0 = Math.max(0, Math.floor(cx / T) - 1), y0 = Math.max(0, Math.floor(cy / T) - 1), x1 = Math.min(m.W - 1, Math.floor((cx + VIEW.w) / T) + 1), y1 = Math.min(m.H - 1, Math.floor((cy + VIEW.h) / T) + 2);
  // agua animada
  const wf = Math.floor(VIEW.anim * 3) % 4;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const w = VIEW.waterTiles.get(ty * m.W + tx); if (!w) continue;
    const f = (wf + ((tx * 3 + ty * 5) & 3)) % 4, sx = tx * T - cx, sy = ty * T - cy;
    c.drawImage(tileImg(w.t, 0, f), sx, sy);
    for (const e of w.edges) c.drawImage(e, sx, sy);
    if (w.mask) c.drawImage(PE.frame('nature', 'shore_foam', f, { mask: w.mask }), sx, sy);
  }
  // marcas en el suelo
  for (const d of G.decals) {
    if (d.tx < x0 - 4 || d.tx > x1 || d.ty < y0 - 4 || d.ty > y1 || !exploredAt(d.tx, d.ty)) continue;
    const img = d.key === 'rubble' ? PE.frame('nature', 'rubble', 0, { size: d.size }) : PE.frame('nature', d.key, 0, { v: d.v || 0 });
    if (d.key === 'rubble') c.drawImage(img, d.tx * T - cx, (d.ty + d.size) * T - img.height - cy);
    else c.drawImage(img, d.tx * T + 8 - img.width / 2 - cx, d.ty * T + 16 - img.height - cy);
  }
  // granjas (planas, debajo de todo)
  for (const b of G.blds) if (!b.dead && b.def.flat && inView(b) && exploredAt(b.tx, b.ty)) drawBld(b, cx, cy);
  // lista de entidades
  const L = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const r = m.res[ty * m.W + tx]; if (r && !r.dead && exploredAt(tx, ty)) L.push([ty * T + 15, 0, r]); }
  for (const r of G.resBy.carcass || []) if (!r.dead && r.tx >= x0 && r.tx <= x1 && r.ty >= y0 && r.ty <= y1 && exploredAt(r.tx, r.ty)) L.push([r.y - 2, 0, r]);
  for (const d of m.decor) if (d.anim && d.tx >= x0 && d.tx <= x1 && d.ty >= y0 && d.ty <= y1) L.push([d.ty * T + 12, 3, d]);
  for (const b of G.blds) if (!b.dead && !b.def.flat && inView(b) && exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) L.push([(b.ty + b.fp) * T, 1, b]);
  for (const u of G.units) if (!u.dead && u.x > cx - 40 && u.x < cx + VIEW.w + 40 && u.y > cy - 20 && u.y < cy + VIEW.h + 50 && (isAlly(u.team, G.human) || visibleAt(u.x, u.y))) L.push([u.y, 2, u]);
  for (const t of G.treasures) if (!t.taken && t.tx >= x0 && t.tx <= x1 && t.ty >= y0 && t.ty <= y1 && exploredAt(t.tx, t.ty)) L.push([t.ty * T + 14, 4, t]);
  for (const k of G.corpses) if (k.x > cx - 30 && k.x < cx + VIEW.w + 30 && k.y > cy - 20 && k.y < cy + VIEW.h + 30 && visibleAt(k.x, k.y)) L.push([k.y - 6, 5, k]);
  L.sort((a, b) => a[0] - b[0]);
  for (const [, kind, e] of L) {
    if (kind === 0) drawRes(e, cx, cy);
    else if (kind === 1) drawBld(e, cx, cy);
    else if (kind === 2) drawUnit(e, cx, cy);
    else if (kind === 3) { const def = PE.ART.nature[e.key]; if (def) { const img = PE.frame('nature', e.key, (Math.floor(VIEW.anim * 3 + e.ph)) % (def.frames || 1), { v: e.v }); c.drawImage(img, e.tx * T + 8 - (def.ax ?? img.width / 2) - cx, e.ty * T + 15 - (def.ay ?? img.height - 1) - cy); } }
    else if (kind === 4) { const key = 'treasure_' + e.type, def = PE.ART.nature[key], img = PE.frame('nature', key, Math.floor(VIEW.anim * 4 + e.ph) % ((def && def.frames) || 1), { open: !!e.open }); c.drawImage(img, e.tx * T + 8 - ((def && def.ax) ?? img.width / 2) - cx, e.ty * T + 15 - ((def && def.ay) ?? img.height - 1) - cy); }
    else if (kind === 5) drawCorpse(e, cx, cy);
  }
  // proyectiles
  for (const p of G.projs) {
    if (p.t < 0) continue; const def = PE.ART.fx[p.art], img = PE.frame('fx', p.art, Math.floor(p.t * 12) % ((def && def.frames) || 1));
    c.save(); c.translate(Math.round(p.x - cx), Math.round(p.y - cy)); c.rotate(p.art === 'proj_rock' || p.art === 'proj_cannonball' ? 0 : p.ang || 0); c.drawImage(img, -img.width / 2, -img.height / 2); c.restore();
  }
  // efectos
  for (const f of G.fx) {
    if (f.key === 'beam') { c.strokeStyle = '#fff7a0'; c.lineWidth = 1; c.beginPath(); let px = f.x - cx, py = f.y - cy; c.moveTo(px, py); for (let k = 1; k <= 5; k++) { const tx = f.x + (f.x2 - f.x) * k / 5 + (k < 5 ? (Math.random() - 0.5) * 6 : 0), ty = f.y + (f.y2 - f.y) * k / 5 + (k < 5 ? (Math.random() - 0.5) * 6 : 0); c.lineTo(tx - cx, ty - cy); } c.stroke(); continue; }
    if (!visibleAt(f.x, f.y)) continue;
    const def = PE.ART.fx[f.key]; if (!def) continue; const n = def.frames || 1, img = PE.frame('fx', f.key, Math.min(n - 1, Math.floor(f.t / f.life * n)));
    c.drawImage(img, Math.round(f.x - (def.ax ?? img.width / 2) - cx), Math.round(f.y - (def.ay ?? img.height / 2) - cy));
  }
  // fuego en árboles y edificios
  const ff = Math.floor(VIEW.anim * 8) % 4;
  for (const r of G.fires) if (r.tx >= x0 && r.tx <= x1 && r.ty >= y0 && r.ty <= y1) { const img = PE.frame('fx', 'fx_fire', (ff + r.tx) % 4, { v: 1 }); c.drawImage(img, r.tx * T + 8 - img.width / 2 - cx, r.ty * T - img.height / 2 - cy); }
  // niebla de guerra
  if (G.fogDirty) updateFog();
  if (G.human >= 0 && !G.cfg.revealed) { c.imageSmoothingEnabled = true; c.drawImage(VIEW.fog, cx / T, cy / T, VIEW.w / T, VIEW.h / T, 0, 0, VIEW.w, VIEW.h); c.imageSmoothingEnabled = false; }
  drawOverlays(cx, cy);
  drawWeather(dtReal);
  // textos flotantes
  c.font = 'bold 8px monospace'; c.textAlign = 'center';
  for (const t of G.texts) { if (!visibleAt(t.x, t.y)) continue; const a = Math.min(1, (t.life - t.t) * 2); c.globalAlpha = a; c.fillStyle = '#140f1f'; c.fillText(t.text, Math.round(t.x - cx) + 1, Math.round(t.y - cy) + 1); c.fillStyle = t.color; c.fillText(t.text, Math.round(t.x - cx), Math.round(t.y - cy)); c.globalAlpha = 1; }
  c.textAlign = 'left';
}
const inView = b => (b.tx + b.fp) * T > VIEW.cx - 16 && b.tx * T < VIEW.cx + VIEW.w + 16 && (b.ty + b.fp) * T > VIEW.cy - 16 && b.ty * T < VIEW.cy + VIEW.h + 120;
function drawRes(r, cx, cy) {
  const c = VIEW.ctx;
  if (r.kind === 'carcass') { const img = PE.frame('units', r.art, 0, { anim: 'idle', dead: true, team: 6 }); const def = PE.ART.units[r.art]; const fl = r.face < 0 ? flipped(img) : img; c.drawImage(fl, Math.round(r.x - (def ? def.ax : 8) - cx), Math.round(r.y - (def ? def.ay : 8) - cy)); return; }
  const key = r.kind === 'tree' ? r.art : r.kind === 'berry' ? 'bush_berry' : r.kind === 'fish' ? 'fish_spot' : 'mine_' + r.kind;
  const def = PE.ART.nature[key], frames = (def && def.frames) || 1;
  const f = r.kind === 'tree' ? Math.floor(VIEW.anim * 2.2 + r.ph) % frames : Math.floor(VIEW.anim * 3 + r.ph) % frames;
  const img = PE.frame('nature', key, f, { v: r.kind === 'berry' ? (r.amt > 0 ? 0 : 1) : r.v % ((def && def.variants) || 1) });
  let sx = r.tx * T + 8 - ((def && def.ax) ?? img.width / 2) - cx, sy = r.ty * T + 15 - ((def && def.ay) ?? img.height - 1) - cy;
  if (r.shake && G.time - r.shake < 0.12) sx += Math.random() < 0.5 ? -1 : 1;
  c.drawImage(img, Math.round(sx), Math.round(sy));
  if (G.sel.includes(r)) { c.strokeStyle = '#ffd23a'; c.strokeRect(r.tx * T - cx + 0.5, r.ty * T - cy + 0.5, 15, 15); }
}
function drawBld(b, cx, cy) {
  const c = VIEW.ctx, def = PE.ART.buildings[b.key];
  let f = Math.floor(VIEW.anim * 4 + b.ph) % ((def && def.frames) || 1), opts = { team: teamColorIdx(b.team) };
  if (b.type === 'farm') { const k = b.food / farmFood(G.players[b.team]); f = !b.done ? 0 : k > 0.66 ? 3 : k > 0.33 ? 2 : 1; }
  if (b.def.wall || b.def.gate) {
    let mask = 0; const nb = (x, y) => G.blds.some(o => !o.dead && (o.def.wall || o.def.gate) && o.team === b.team && o.tx === x && o.ty === y);
    if (b._maskT !== G.cleanT) { b._mask = (nb(b.tx, b.ty - 1) ? 1 : 0) | (nb(b.tx + 1, b.ty) ? 2 : 0) | (nb(b.tx, b.ty + 1) ? 4 : 0) | (nb(b.tx - 1, b.ty) ? 8 : 0); b._maskT = G.cleanT; }
    opts.mask = b._mask; if (b.def.gate) f = b.open ? 1 : 0; else f = 0;
  }
  const img = PE.frame('buildings', b.key, f, opts), sx = b.tx * T - cx, sy = (b.ty + b.fp) * T - img.height - cy;
  if (!b.done && !b.def.flat) {
    const h = Math.max(4, Math.round(img.height * (0.15 + 0.85 * b.progress)));
    c.globalAlpha = 0.9; c.drawImage(img, 0, img.height - h, img.width, h, sx, sy + img.height - h, img.width, h); c.globalAlpha = 1;
    const sc = PE.frame('nature', 'scaffold', 0, { size: b.fp }); c.drawImage(sc, sx, (b.ty + b.fp) * T - sc.height - cy);
  } else c.drawImage(img, sx, sy);
  if (b.done && !b.def.flat && b.hp < b.maxhp * 0.5 && !b.def.invuln) {
    const fi = PE.frame('fx', 'fx_fire', (Math.floor(VIEW.anim * 8) + b.id) % 4, { v: b.hp < b.maxhp * 0.25 ? 2 : 0 });
    c.drawImage(fi, sx + b.fp * 8 - fi.width / 2 + ((b.id * 7) % (b.fp * 6)) - b.fp * 3, (b.ty + b.fp / 2) * T - fi.height - cy);
  }
  if (b.fire > 0) { const fi = PE.frame('fx', 'fx_fire', (Math.floor(VIEW.anim * 8) + b.id) % 4, { v: 2 }); c.drawImage(fi, sx + b.fp * 8 - fi.width / 2, (b.ty + b.fp / 2) * T - fi.height - cy); }
  const sel = G.sel.includes(b);
  if (sel) { c.strokeStyle = isAlly(b.team, G.human) ? '#8fff7a' : isEnemy(b.team, G.human) ? '#ff6a5a' : '#ffd23a'; c.lineWidth = 1; c.strokeRect(b.tx * T - cx + 0.5, b.ty * T - cy + 0.5, b.fp * T - 1, b.fp * T - 1); }
  if ((sel || b.hp < b.maxhp) && !b.def.invuln && b.team !== GAIA) bar(sx + 4, sy - 5, b.fp * T - 8, b.done ? b.hp / b.maxhp : b.progress, b.done ? null : '#8ab4ff');
  if (sel && b.rally && b.team === G.human) { const fl = Math.floor(VIEW.anim * 4) % 2; c.fillStyle = '#e8e0c8'; c.fillRect(b.rally.x - cx, b.rally.y - cy - 10, 1, 10); c.fillStyle = PE.TEAM_COLORS[teamColorIdx(b.team)].hex; c.fillRect(b.rally.x - cx + 1, b.rally.y - cy - 10 + fl, 5, 3); }
}
function drawUnit(u, cx, cy) {
  const c = VIEW.ctx, def = PE.ART.units[u.key], img0 = unitFrame(u), img = u.face < 0 ? flipped(img0) : img0;
  const ax = def ? (u.face < 0 ? img0.width - def.ax : def.ax) : 8, ay = def ? def.ay : 14;
  const sx = Math.round(u.x - ax - cx), sy = Math.round(u.y - ay - cy);
  const sel = G.sel.includes(u);
  if (sel) { c.strokeStyle = isAlly(u.team, G.human) ? '#8fff7a' : isEnemy(u.team, G.human) ? '#ff6a5a' : '#ffd23a'; c.lineWidth = 1; c.beginPath(); c.ellipse(Math.round(u.x - cx), Math.round(u.y - cy) + 1, u.def.size + 2, (u.def.size + 2) * 0.45, 0, 0, 7); c.stroke(); }
  if (u.stun > 0) c.globalAlpha = 0.8;
  c.drawImage(img, sx, sy);
  if (u.slowT > G.time) { c.globalAlpha = 0.35; c.fillStyle = '#9fe0ff'; c.fillRect(sx + ax - 5, sy + 4, 10, ay - 4); }
  c.globalAlpha = 1;
  const top = sy + (def ? Math.max(0, ay - (def.h - (def.h - ay)) ) : 0);
  const headY = Math.round(u.y - cy) - (def ? Math.min(ay, def.h) : 14) + 2;
  if ((sel || u.hp < u.maxhp) && !isAnimal(u)) bar(Math.round(u.x - cx) - 6, headY - 5, 12, u.hp / u.maxhp);
  else if (isAnimal(u) && u.hp < u.maxhp) bar(Math.round(u.x - cx) - 5, headY - 3, 10, u.hp / u.maxhp);
  if (u.lvl >= 2) { const bi = PE.frame('icons', 'badge_' + u.lvl, 0); c.drawImage(bi, Math.round(u.x - cx - bi.width / 2), headY - 6 - bi.height - ((sel || u.hp < u.maxhp) ? 0 : -3)); }
  if (u.def.unique && Math.floor(VIEW.anim * 2) % 2 === 0) { c.fillStyle = '#ffd23a'; c.fillRect(Math.round(u.x - cx), headY - 2, 1, 1); }
  if (u.stun > 0) { c.fillStyle = '#ffe98a'; const a = VIEW.anim * 6; for (let k = 0; k < 3; k++) c.fillRect(Math.round(u.x - cx + Math.cos(a + k * 2.1) * 5), headY + Math.round(Math.sin(a + k * 2.1) * 1.5), 1, 1); }
}
function drawCorpse(k, cx, cy) {
  const c = VIEW.ctx, def = PE.ART.units[k.key]; if (!def || k.key.startsWith('animal_')) return;
  const img0 = PE.frame('units', k.key, 0, { team: teamColorIdx(k.team), anim: 'idle' }), img = k.face < 0 ? flipped(img0) : img0;
  const fall = Math.min(1, k.t * 3), a = k.t > 8 ? Math.max(0, 1 - (k.t - 8) / 4) : 1;
  c.save(); c.globalAlpha = a * (k.t < 0.4 ? 1 : 0.75); c.translate(Math.round(k.x - cx), Math.round(k.y - cy)); c.rotate(fall * Math.PI / 2 * (k.face < 0 ? -1 : 1));
  c.drawImage(img, -def.ax, -def.ay); c.restore(); c.globalAlpha = 1;
}
function drawOverlays(cx, cy) {
  const c = VIEW.ctx;
  // colocación de edificios
  if (UI.placing && UI.mouseWorld) {
    const type = UI.placing, d = BLD[type], tiles = placementTiles();
    for (const [tx, ty] of tiles) {
      const ok = canPlace(G.human, type, tx, ty) || (type === 'gate' && G.blds.some(b => !b.dead && b.type === 'wall' && b.team === G.human && b.tx === tx && b.ty === ty));
      const img = PE.frame('buildings', G.players[G.human].race + '_' + type, 0, { team: teamColorIdx(G.human), mask: d.wall ? 10 : 0 });
      c.globalAlpha = 0.6; c.drawImage(img, tx * T - cx, (ty + d.fp) * T - img.height - cy);
      c.globalAlpha = 0.35; c.fillStyle = ok ? '#4cff6a' : '#ff3a3a'; c.fillRect(tx * T - cx, ty * T - cy, d.fp * T, d.fp * T); c.globalAlpha = 1;
    }
    if (type === 'tower' || type === 'castle' || type === 'tc') { const [tx, ty] = tiles[0]; c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc((tx + d.fp / 2) * T - cx, (ty + d.fp / 2) * T - cy, (d.range + d.fp / 2) * T, 0, 7); c.stroke(); }
  }
  if (UI.roadDrag && UI.mouseWorld) { for (const [tx, ty] of roadTiles()) { c.globalAlpha = 0.45; c.fillStyle = canRoad(tx, ty) ? '#d8c08a' : '#ff3a3a'; c.fillRect(tx * T - cx, ty * T - cy, T, T); c.globalAlpha = 1; } }
  if (UI.drag && UI.drag.box) { const d = UI.drag; c.strokeStyle = '#8fff7a'; c.lineWidth = 1; c.strokeRect(Math.min(d.x0, d.x1) / VIEW.S + 0.5, Math.min(d.y0, d.y1) / VIEW.S + 0.5, Math.abs(d.x1 - d.x0) / VIEW.S, Math.abs(d.y1 - d.y0) / VIEW.S); }
  for (const p of UI.marks) { const k = p.t / 0.5; c.strokeStyle = p.c; c.globalAlpha = 1 - k; const r = 2 + k * 8; c.strokeRect(Math.round(p.x - cx - r), Math.round(p.y - cy - r / 2), r * 2, r); c.globalAlpha = 1; }
}
// --------------------------------------------------------------- clima
const WX = { drops: [], flakes: [], fogOff: 0 };
function drawWeather(dt) {
  const c = VIEW.ctx, w = G.weather, a = w.a, cur = w.cur;
  if (cur === 'storm') { c.fillStyle = 'rgba(20,16,50,' + (0.28 * a) + ')'; c.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (cur === 'rain' || cur === 'storm') {
    const n = Math.round((cur === 'storm' ? 160 : 100) * a); while (WX.drops.length < n) WX.drops.push({ x: Math.random() * VIEW.w, y: Math.random() * VIEW.h, s: 220 + Math.random() * 80 });
    WX.drops.length = n; c.strokeStyle = 'rgba(190,210,255,.55)'; c.beginPath();
    for (const d of WX.drops) { d.y += d.s * dt; d.x -= d.s * 0.25 * dt; if (d.y > VIEW.h) { d.y = -6; d.x = Math.random() * (VIEW.w + 40); } c.moveTo(Math.round(d.x), Math.round(d.y)); c.lineTo(Math.round(d.x - 2), Math.round(d.y + 6)); }
    c.stroke();
  } else WX.drops.length = 0;
  if (cur === 'snow') {
    const n = Math.round(120 * a); while (WX.flakes.length < n) WX.flakes.push({ x: Math.random() * VIEW.w, y: Math.random() * VIEW.h, s: 14 + Math.random() * 20, p: Math.random() * 6 });
    WX.flakes.length = n; c.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of WX.flakes) { f.y += f.s * dt; f.x += Math.sin(VIEW.anim + f.p) * 8 * dt; if (f.y > VIEW.h) { f.y = -2; f.x = Math.random() * VIEW.w; } c.fillRect(Math.round(f.x), Math.round(f.y), f.s > 26 ? 2 : 1, f.s > 26 ? 2 : 1); }
    c.fillStyle = 'rgba(230,240,255,' + 0.08 * a + ')'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  } else WX.flakes.length = 0;
  if (cur === 'fog') { WX.fogOff += dt * 6; const g = c.createLinearGradient(0, 0, VIEW.w, VIEW.h); g.addColorStop(0, 'rgba(220,226,235,' + 0.32 * a + ')'); g.addColorStop(0.5, 'rgba(220,226,235,' + 0.16 * a + ')'); g.addColorStop(1, 'rgba(220,226,235,' + 0.34 * a + ')'); c.fillStyle = g; c.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (w.flash > 0) { c.fillStyle = 'rgba(255,255,240,' + Math.min(0.7, w.flash * 0.7) + ')'; c.fillRect(0, 0, VIEW.w, VIEW.h); }
}
// --------------------------------------------------------------- minimapa
function drawMinimap() {
  const mc = UI.mini, x = mc.getContext('2d'), m = G.map, W = m.W, H = m.H;
  if (mc.width !== W) { mc.width = W; mc.height = H; }
  const img = new ImageData(new Uint8ClampedArray(VIEW.miniBase.data), W, H), d = img.data;
  const put = (i, c) => { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; };
  const RC = { tree: [38, 92, 44], gold: [255, 210, 58], gems: [190, 110, 255], stone: [200, 200, 200], iron: [160, 110, 90], berry: [220, 80, 120], fish: [140, 200, 255] };
  for (const r of G.map.resList) if (!r.dead && RC[r.kind]) put(r.ty * W + r.tx, RC[r.kind]);
  for (const b of G.blds) { if (b.dead) continue; const col = PE.hx(PE.TEAM_COLORS[teamColorIdx(b.team)].hex); for (let y = b.ty; y < b.ty + b.fp; y++) for (let xx = b.tx; xx < b.tx + b.fp; xx++) if (exploredAt(xx, y)) put(y * W + xx, col); }
  for (const u of G.units) { if (u.dead || (isAnimal(u) && u.team >= 7)) continue; if (!isAlly(u.team, G.human) && !visibleAt(u.x, u.y)) continue; const col = PE.hx(PE.TEAM_COLORS[teamColorIdx(u.team)].hex); put(tileOf(u.y) * W + tileOf(u.x), col.map(v => Math.min(255, v + 40))); }
  if (G.human >= 0 && !G.cfg.revealed) for (let i = 0; i < W * H; i++) { const v = G.vis[i]; if (v === 0) { d[i * 4] = 10; d[i * 4 + 1] = 8; d[i * 4 + 2] = 16; } else if (v === 1) { d[i * 4] *= 0.55; d[i * 4 + 1] *= 0.55; d[i * 4 + 2] *= 0.6; } }
  x.putImageData(img, 0, 0);
  x.strokeStyle = '#fff'; x.lineWidth = 1; x.strokeRect((G.cam.x - VIEW.w / 2) / T + 0.5, (G.cam.y - VIEW.h / 2) / T + 0.5, VIEW.w / T, VIEW.h / T);
  for (const p of G.pings) { p.t += 0.25; const r = 2 + (p.t % 1) * 5; x.strokeStyle = '#ff5a4a'; x.beginPath(); x.arc(p.x / T, p.y / T, r, 0, 7); x.stroke(); }
  G.pings = G.pings.filter(p => p.t < 4);
}
