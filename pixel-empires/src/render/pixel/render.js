import { PE } from './sprite.js';
import { BLD, GAIA, T } from '../../data/data.js';
import { TR, TR_COLOR, TR_PRIO, TR_TILE, TR_VARS } from '../../map/map.js';
import { G, canPlace, farmFood, isAlly, isAnimal, isEnemy, tileOf } from '../../sim/game.js';
import { exploredAt, visibleAt } from '../../world/world.js';
import { UI, canRoad, placementTiles, roadTiles } from '../../ui/ui.js';
/* =====================================================================
   Render: el entorno (terreno, árboles, minas, edificios) se dibuja a
   escala WS respecto a los personajes, que conservan su tamaño nativo,
   para que una casa mida unas tres veces un aldeano. Terreno por bloques
   generados bajo demanda (ligero en móvil), bordes mezclados entre biomas,
   agua animada, niebla suave, entidades por profundidad, clima y minimapa.
   Coordenadas: mundo (px de juego, tile = T) -> pantalla interna (x WS).
   ===================================================================== */
const VIEW = { S: 2, dpr: 1, w: 480, h: 300, WS: PE.ENV.scale, cv: null, ctx: null, anim: 0, cx: 0, cy: 0, ox: 0, oy: 0, ww: 240, wh: 150 };
const TS = T * PE.ENV.scale;                       // tamaño de tile en pantalla interna
const teamColorIdx = t => t >= 0 && t < 8 && G.players[t] ? G.players[t].color : 6;
const SX = wx => Math.round(wx * VIEW.WS) - VIEW.ox, SY = wy => Math.round(wy * VIEW.WS) - VIEW.oy;

// --------------------------------------------------------------- terreno
const EDGE = { cache: new Map() };
const DIRS8 = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 3], [1, 1, 6], [-1, 1, 12], [-1, -1, 9]];
function hash2(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
function tileImg(t, v, f = 0) { return PE.frame('nature', TR_TILE[t], f, { v: v % TR_VARS[t] }); }
/** Tile del terreno t recortada a una banda irregular junto al borde d (0..7 = N E S O NE SE SO NO). */
function edgeTile(t, d, v, f = 0) {
  const key = t + ':' + d + ':' + v + ':' + f; let c = EDGE.cache.get(key); if (c) return c;
  const src = tileImg(t, v, f), S = src.width, k = S / T; c = PE.makeCanvas(S, S); const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const id = x.getImageData(0, 0, S, S), D = id.data;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const lx = Math.floor(px / k), ly = Math.floor(py / k); let dd;
    if (d === 0) dd = ly; else if (d === 1) dd = T - 1 - lx; else if (d === 2) dd = T - 1 - ly; else if (d === 3) dd = lx;
    else { const ex = d === 4 || d === 5 ? T - 1 - lx : lx, ey = d === 4 || d === 7 ? ly : T - 1 - ly; dd = Math.hypot(ex, ey) * 0.9; }
    const n = hash2(lx * 7 + d, ly * 13 + t) * 1.6 + Math.sin((d < 4 ? (d % 2 ? ly : lx) : lx + ly) * 0.9 + t) * 0.6;
    if (dd > 3.4 + n) D[(py * S + px) * 4 + 3] = 0;
  }
  x.putImageData(id, 0, 0); EDGE.cache.set(key, c); return c;
}
const CHUNK = 8, CHUNK_PX = CHUNK * TS;
function prerenderTerrain() {
  const m = G.map, W = m.W, H = m.H;
  VIEW.chunks = new Map(); VIEW.waterTiles = new Map(); VIEW.tileEdges = new Array(W * H);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) computeTile(tx, ty);
  // decoración estática indexada por bloque (incluye vecinos para sprites que sobresalen)
  VIEW.decorBy = new Map();
  for (const d of m.decor) { if (d.anim) continue; const c0 = Math.floor((d.tx - 1) / CHUNK), c1 = Math.floor((d.tx + 1) / CHUNK), r0 = Math.floor((d.ty - 2) / CHUNK), r1 = Math.floor(d.ty / CHUNK); for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const k = c + ',' + r; (VIEW.decorBy.get(k) || VIEW.decorBy.set(k, []).get(k)).push(d); } }
  // color del minimapa
  VIEW.miniBase = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) { const c = PE.hx(TR_COLOR[m.terr[i]]); VIEW.miniBase.data.set([c[0], c[1], c[2], 255], i * 4); }
  VIEW.fog = PE.makeCanvas(W, H); VIEW.fogCtx = VIEW.fog.getContext('2d'); VIEW.fogImg = VIEW.fogCtx.createImageData(W, H); G.fogDirty = true;
}
function computeTile(tx, ty) {
  const m = G.map, W = m.W, i = ty * W + tx, t = m.terr[i], edges = [];
  for (let d = 0; d < 8; d++) {
    const [dx, dy] = DIRS8[d], nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= m.H) continue;
    const nt = m.terr[ny * W + nx]; if (TR_PRIO[nt] <= TR_PRIO[t]) continue;
    if (d >= 4) { const a = m.terr[ty * W + nx], b = m.terr[ny * W + tx]; if (a === nt || b === nt) continue; }
    edges.push([nt, d, Math.floor(hash2(nx, ny) * 8) % TR_VARS[nt]]);
  }
  VIEW.tileEdges[i] = edges;
  if (t === TR.WATER || t === TR.SHALLOW) {
    let mask = 0; for (let d = 0; d < 4; d++) { const [dx, dy, bit] = DIRS8[d], nx = tx + dx, ny = ty + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < m.H) { const nt = m.terr[ny * W + nx]; if (nt !== TR.WATER && nt !== TR.SHALLOW) mask |= bit; } }
    VIEW.waterTiles.set(i, { t, mask });
  } else VIEW.waterTiles.delete(i);
}
function getChunk(cx, cy) {
  const key = cx + ',' + cy; let ch = VIEW.chunks.get(key);
  if (ch && !ch.dirty) { VIEW.chunks.delete(key); VIEW.chunks.set(key, ch); return ch.cv; }   // LRU
  const cv = ch ? ch.cv : PE.makeCanvas(CHUNK_PX, CHUNK_PX), x = cv.getContext('2d'), m = G.map; x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
  for (let ty = cy * CHUNK; ty < (cy + 1) * CHUNK && ty < m.H; ty++) for (let tx = cx * CHUNK; tx < (cx + 1) * CHUNK && tx < m.W; tx++) {
    const i = ty * m.W + tx, px = (tx - cx * CHUNK) * TS, py = (ty - cy * CHUNK) * TS;
    x.drawImage(tileImg(m.terr[i], Math.floor(hash2(tx, ty) * 8)), px, py);
    for (const [nt, d, v] of VIEW.tileEdges[i]) x.drawImage(edgeTile(nt, d, v), px, py);
  }
  for (const d of VIEW.decorBy.get(key) || []) {
    const def = PE.ART.nature[d.key]; if (!def) continue;
    const img = PE.frame('nature', d.key, 0, { v: d.v }), k = img.k || 1;
    x.drawImage(img, (d.tx * T + 8) * VIEW.WS - cx * CHUNK_PX - (def.ax ?? img.width / k / 2) * k, (d.ty * T + 15) * VIEW.WS - cy * CHUNK_PX - (def.ay ?? img.height / k - 1) * k);
  }
  VIEW.chunks.set(key, { cv, dirty: false });
  if (VIEW.chunks.size > 90) { const old = VIEW.chunks.keys().next().value; VIEW.chunks.delete(old); }
  return cv;
}
function redrawTiles(tx, ty, r = 1) {
  for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < G.map.W && y < G.map.H) { computeTile(x, y); const ch = VIEW.chunks.get(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK)); if (ch) ch.dirty = true; }
  const i = ty * G.map.W + tx; VIEW.miniBase.data.set(PE.hx(TR_COLOR[G.map.terr[i]]).slice(0, 3), i * 4);
}
function updateFog() {
  const v = G.vis, d = VIEW.fogImg.data;
  for (let i = 0; i < v.length; i++) { d[i * 4] = 8; d[i * 4 + 1] = 6; d[i * 4 + 2] = 16; d[i * 4 + 3] = v[i] === 2 ? 0 : v[i] === 1 ? 135 : 255; }
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
/** Dibuja un sprite del entorno (escala k) con su ancla lógica sobre el punto de mundo (wx, wy). */
function drawEnv(img, def, wx, wy, dx = 0) {
  const k = img.k || 1, ax = (def && def.ax != null && typeof def.ax !== 'function' ? def.ax : img.width / k / 2) * k, ay = (def && def.ay != null && typeof def.ay !== 'function' ? def.ay : img.height / k - 1) * k;
  VIEW.ctx.drawImage(img, SX(wx) - Math.round(ax) + dx, SY(wy) - Math.round(ay));
}
/** Efecto escalado (para fuego en edificios, explosiones grandes). */
function drawFxBig(img, x, y, sc) { VIEW.ctx.drawImage(img, Math.round(x - img.width * sc / 2), Math.round(y - img.height * sc / 2), img.width * sc, img.height * sc); }

// --------------------------------------------------------------- frame principal
function render(dtReal) {
  const c = VIEW.ctx, m = G.map, WS = VIEW.WS; VIEW.anim += dtReal;
  VIEW.ww = VIEW.w / WS; VIEW.wh = VIEW.h / WS;
  let cx = G.cam.x - VIEW.ww / 2, cy = G.cam.y - VIEW.wh / 2;
  if (G.shake > 0) { cx += (Math.random() - 0.5) * 3; cy += (Math.random() - 0.5) * 2; }
  VIEW.ox = Math.round(cx * WS); VIEW.oy = Math.round(cy * WS); VIEW.cx = VIEW.ox / WS; VIEW.cy = VIEW.oy / WS;
  cx = VIEW.cx; cy = VIEW.cy;
  c.fillStyle = '#0a0812'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  // terreno por bloques
  const c0 = Math.max(0, Math.floor(VIEW.ox / CHUNK_PX)), c1 = Math.min(Math.ceil(m.W / CHUNK) - 1, Math.floor((VIEW.ox + VIEW.w) / CHUNK_PX));
  const r0 = Math.max(0, Math.floor(VIEW.oy / CHUNK_PX)), r1 = Math.min(Math.ceil(m.H / CHUNK) - 1, Math.floor((VIEW.oy + VIEW.h) / CHUNK_PX));
  for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) c.drawImage(getChunk(q, r), q * CHUNK_PX - VIEW.ox, r * CHUNK_PX - VIEW.oy);
  const x0 = Math.max(0, Math.floor(cx / T) - 1), y0 = Math.max(0, Math.floor(cy / T) - 1), x1 = Math.min(m.W - 1, Math.floor((cx + VIEW.ww) / T) + 1), y1 = Math.min(m.H - 1, Math.floor((cy + VIEW.wh) / T) + 3);
  // agua animada
  const wf = Math.floor(VIEW.anim * 3) % 4;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const i = ty * m.W + tx, w = VIEW.waterTiles.get(i); if (!w) continue;
    const f = (wf + ((tx * 3 + ty * 5) & 3)) % 4, sx = tx * TS - VIEW.ox, sy = ty * TS - VIEW.oy;
    c.drawImage(tileImg(w.t, 0, f), sx, sy);
    for (const [nt, d, v] of VIEW.tileEdges[i]) c.drawImage(edgeTile(nt, d, v), sx, sy);
    if (w.mask) c.drawImage(PE.frame('nature', 'shore_foam', f, { mask: w.mask }), sx, sy);
  }
  // marcas en el suelo
  for (const d of G.decals) {
    if (d.tx < x0 - 4 || d.tx > x1 || d.ty < y0 - 4 || d.ty > y1 || !exploredAt(d.tx, d.ty)) continue;
    if (d.key === 'rubble') { const img = PE.frame('nature', 'rubble', 0, { size: d.size }); c.drawImage(img, d.tx * TS - VIEW.ox, (d.ty + d.size) * TS - img.height - VIEW.oy); }
    else drawEnv(PE.frame('nature', d.key, 0, { v: d.v || 0 }), PE.ART.nature[d.key], d.tx * T + 8, d.ty * T + 15);
  }
  // granjas (planas, debajo de todo)
  for (const b of G.blds) if (!b.dead && b.def.flat && inView(b) && exploredAt(b.tx, b.ty)) drawBld(b);
  // lista de entidades
  const L = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const r = m.res[ty * m.W + tx]; if (r && !r.dead && exploredAt(tx, ty)) L.push([ty * T + 15, 0, r]); }
  for (const r of G.resBy.carcass || []) if (!r.dead && r.tx >= x0 && r.tx <= x1 && r.ty >= y0 && r.ty <= y1 && exploredAt(r.tx, r.ty)) L.push([r.y - 2, 0, r]);
  for (const d of m.decor) if (d.anim && d.tx >= x0 && d.tx <= x1 && d.ty >= y0 && d.ty <= y1) L.push([d.ty * T + 12, 3, d]);
  for (const b of G.blds) if (!b.dead && !b.def.flat && inView(b) && exploredAt(b.tx + (b.fp >> 1), b.ty + (b.fp >> 1))) L.push([(b.ty + b.fp) * T, 1, b]);
  for (const u of G.units) if (!u.dead && !u.inside && u.x > cx - 24 && u.x < cx + VIEW.ww + 24 && u.y > cy - 8 && u.y < cy + VIEW.wh + 30 && (isAlly(u.team, G.human) || visibleAt(u.x, u.y))) L.push([u.y, 2, u]);
  for (const t of G.treasures) if (!t.taken && t.tx >= x0 && t.tx <= x1 && t.ty >= y0 && t.ty <= y1 && exploredAt(t.tx, t.ty)) L.push([t.ty * T + 14, 4, t]);
  for (const k of G.corpses) if (k.x > cx - 20 && k.x < cx + VIEW.ww + 20 && k.y > cy - 10 && k.y < cy + VIEW.wh + 20 && visibleAt(k.x, k.y)) L.push([k.y - 6, 5, k]);
  L.sort((a, b) => a[0] - b[0]);
  for (const [, kind, e] of L) {
    if (kind === 0) drawRes(e);
    else if (kind === 1) drawBld(e);
    else if (kind === 2) drawUnit(e);
    else if (kind === 3) { const def = PE.ART.nature[e.key]; if (def) drawEnv(PE.frame('nature', e.key, (Math.floor(VIEW.anim * 3 + e.ph)) % (def.frames || 1), { v: e.v }), def, e.tx * T + 8, e.ty * T + 15); }
    else if (kind === 4) { const key = 'treasure_' + e.type, def = PE.ART.nature[key]; drawEnv(PE.frame('nature', key, Math.floor(VIEW.anim * 4 + e.ph) % ((def && def.frames) || 1), { open: !!e.open }), def, e.tx * T + 8, e.ty * T + 15); }
    else if (kind === 5) drawCorpse(e);
  }
  // proyectiles
  for (const p of G.projs) {
    if (p.t < 0) continue; const def = PE.ART.fx[p.art], img = PE.frame('fx', p.art, Math.floor(p.t * 12) % ((def && def.frames) || 1));
    c.save(); c.translate(SX(p.x), SY(p.y)); c.rotate(p.art === 'proj_rock' || p.art === 'proj_cannonball' ? 0 : p.ang || 0); c.drawImage(img, -img.width / 2, -img.height / 2); c.restore();
  }
  // efectos
  for (const f of G.fx) {
    if (f.key === 'beam') { c.strokeStyle = '#fff7a0'; c.lineWidth = 1; c.beginPath(); c.moveTo(SX(f.x), SY(f.y)); for (let k = 1; k <= 5; k++) { const tx = f.x + (f.x2 - f.x) * k / 5 + (k < 5 ? (Math.random() - 0.5) * 3 : 0), ty = f.y + (f.y2 - f.y) * k / 5 + (k < 5 ? (Math.random() - 0.5) * 3 : 0); c.lineTo(SX(tx), SY(ty)); } c.stroke(); continue; }
    if (!visibleAt(f.x, f.y)) continue;
    const def = PE.ART.fx[f.key]; if (!def) continue; const n = def.frames || 1, img = PE.frame('fx', f.key, Math.min(n - 1, Math.floor(f.t / f.life * n)), f.v != null ? { v: f.v } : {});
    if (f.big) drawFxBig(img, SX(f.x), SY(f.y), f.big);
    else c.drawImage(img, SX(f.x) - Math.round(def.ax != null && typeof def.ax !== 'function' ? def.ax : img.width / 2), SY(f.y) - Math.round(def.ay != null && typeof def.ay !== 'function' ? def.ay : img.height / 2));
  }
  // fuego en árboles
  const ff = Math.floor(VIEW.anim * 8) % 4;
  for (const r of G.fires) if (r.tx >= x0 && r.tx <= x1 && r.ty >= y0 && r.ty <= y1) drawFxBig(PE.frame('fx', 'fx_fire', (ff + r.tx) % 4, { v: 1 }), SX(r.tx * T + 8), SY(r.ty * T + 2), 2);
  // niebla de guerra
  if (G.fogDirty) updateFog();
  if (G.human >= 0 && !G.cfg.revealed) { c.imageSmoothingEnabled = true; c.drawImage(VIEW.fog, cx / T, cy / T, VIEW.ww / T, VIEW.wh / T, 0, 0, VIEW.w, VIEW.h); c.imageSmoothingEnabled = false; }
  drawOverlays();
  drawWeather(dtReal);
  // textos flotantes
  c.font = 'bold 9px monospace'; c.textAlign = 'center';
  for (const t of G.texts) { if (!visibleAt(t.x, t.y)) continue; const a = Math.min(1, (t.life - t.t) * 2), tx = SX(t.x), ty = SY(t.y) + 14; c.globalAlpha = a; c.fillStyle = '#140f1f'; c.fillText(t.text, tx + 1, ty + 1); c.fillStyle = t.color; c.fillText(t.text, tx, ty); c.globalAlpha = 1; }
  c.textAlign = 'left';
}
const inView = b => (b.tx + b.fp) * T > VIEW.cx - 16 && b.tx * T < VIEW.cx + VIEW.ww + 16 && (b.ty + b.fp) * T > VIEW.cy - 8 && b.ty * T < VIEW.cy + VIEW.wh + 64;
function drawRes(r) {
  const c = VIEW.ctx;
  if (r.kind === 'carcass') { const img = PE.frame('units', r.art, 0, { anim: 'idle', dead: true, team: 6 }); const def = PE.ART.units[r.art]; const fl = r.face < 0 ? flipped(img) : img; c.drawImage(fl, SX(r.x) - (def ? def.ax : 8), SY(r.y) - (def ? def.ay : 8)); return; }
  const key = r.kind === 'tree' ? r.art : r.kind === 'berry' ? 'bush_berry' : r.kind === 'fish' ? 'fish_spot' : 'mine_' + r.kind;
  const def = PE.ART.nature[key], frames = (def && def.frames) || 1;
  const f = r.kind === 'tree' ? Math.floor(VIEW.anim * 2.2 + r.ph) % frames : Math.floor(VIEW.anim * 3 + r.ph) % frames;
  const img = PE.frame('nature', key, f, { v: r.kind === 'berry' ? (r.amt > 0 ? 0 : 1) : r.v % ((def && def.variants) || 1) });
  drawEnv(img, def, r.tx * T + 8, r.ty * T + 15, r.shake && G.time - r.shake < 0.12 ? (Math.random() < 0.5 ? -1 : 1) : 0);
  if (G.sel.includes(r)) { c.strokeStyle = '#ffd23a'; c.strokeRect(r.tx * TS - VIEW.ox + 0.5, r.ty * TS - VIEW.oy + 0.5, TS - 1, TS - 1); }
}
function drawBld(b) {
  const c = VIEW.ctx, def = PE.ART.buildings[b.key];
  let f = Math.floor(VIEW.anim * 4 + b.ph) % ((def && def.frames) || 1), opts = { team: teamColorIdx(b.team) };
  if (b.type === 'farm') { const k = b.food / farmFood(G.players[b.team]); f = !b.done ? 0 : k > 0.66 ? 3 : k > 0.33 ? 2 : 1; }
  if (b.def.wall || b.def.gate) {
    const nb = (x, y) => G.blds.some(o => !o.dead && (o.def.wall || o.def.gate) && o.team === b.team && o.tx === x && o.ty === y);
    if (b._maskT !== G.cleanT) { b._mask = (nb(b.tx, b.ty - 1) ? 1 : 0) | (nb(b.tx + 1, b.ty) ? 2 : 0) | (nb(b.tx, b.ty + 1) ? 4 : 0) | (nb(b.tx - 1, b.ty) ? 8 : 0); b._maskT = G.cleanT; }
    opts.mask = b._mask; if (b.def.gate) f = b.open ? 1 : 0; else f = 0;
  }
  const img = PE.frame('buildings', b.key, f, opts), fw = b.fp * TS, sx = b.tx * TS - VIEW.ox, sy = (b.ty + b.fp) * TS - img.height - VIEW.oy;
  if (!b.done && !b.def.flat) {
    const h = Math.max(4, Math.round(img.height * (0.15 + 0.85 * b.progress)));
    c.globalAlpha = 0.9; c.drawImage(img, 0, img.height - h, img.width, h, sx, sy + img.height - h, img.width, h); c.globalAlpha = 1;
    const sc = PE.frame('nature', 'scaffold', 0, { size: b.fp }); c.drawImage(sc, sx, (b.ty + b.fp) * TS - sc.height - VIEW.oy);
  } else c.drawImage(img, sx, sy);
  if (b.flash > 0 && b.done) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25; c.drawImage(img, sx, sy); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
  const midY = (b.ty + b.fp / 2) * TS - VIEW.oy;
  if (b.done && !b.def.flat && b.hp < b.maxhp * 0.5 && !b.def.invuln) {
    const fi = PE.frame('fx', 'fx_fire', (Math.floor(VIEW.anim * 8) + b.id) % 4, { v: b.hp < b.maxhp * 0.25 ? 2 : 0 });
    drawFxBig(fi, sx + fw / 2 + ((b.id * 13) % (b.fp * 12)) - b.fp * 6, midY - fi.height, 2);
    if (b.hp < b.maxhp * 0.25) drawFxBig(fi, sx + fw * 0.3, midY - fi.height * 0.5, 2);
  }
  if (b.fire > 0) { const fi = PE.frame('fx', 'fx_fire', (Math.floor(VIEW.anim * 8) + b.id) % 4, { v: 2 }); drawFxBig(fi, sx + fw / 2, midY - fi.height, 2); }
  const sel = G.sel.includes(b);
  if (sel) { c.strokeStyle = isAlly(b.team, G.human) ? '#8fff7a' : isEnemy(b.team, G.human) ? '#ff6a5a' : '#ffd23a'; c.lineWidth = 1; c.strokeRect(sx + 0.5, b.ty * TS - VIEW.oy + 0.5, fw - 1, fw - 1); }
  if ((sel || (b.hp < b.maxhp && !b.def.flat) || (!b.done && !b.def.flat)) && !b.def.invuln && b.team !== GAIA) bar(sx + 6, sy - 6, fw - 12, b.done ? b.hp / b.maxhp : b.progress, b.done ? null : '#8ab4ff');
  if (sel && b.rally && b.team === G.human) { const fl = Math.floor(VIEW.anim * 4) % 2, rx = SX(b.rally.x), ry = SY(b.rally.y); c.fillStyle = '#e8e0c8'; c.fillRect(rx, ry - 14, 1, 14); c.fillStyle = PE.TEAM_COLORS[teamColorIdx(b.team)].hex; c.fillRect(rx + 1, ry - 14 + fl, 6, 4); }
}
function drawUnit(u) {
  const c = VIEW.ctx, def = PE.ART.units[u.key], img0 = unitFrame(u), flip = (u.face < 0) !== !!(def && def.face === -1), img = flip ? flipped(img0) : img0;
  const ax = def ? (flip ? img0.width - def.ax : def.ax) : 8, ay = def ? def.ay : 14;
  const px = SX(u.x), py = SY(u.y), sx = px - ax, sy = py - ay;
  const sel = G.sel.includes(u);
  if (sel) { const rx = 4 + u.def.size * 0.9; c.strokeStyle = isAlly(u.team, G.human) ? '#8fff7a' : isEnemy(u.team, G.human) ? '#ff6a5a' : '#ffd23a'; c.lineWidth = 1; c.beginPath(); c.ellipse(px, py + 1, rx, rx * 0.42, 0, 0, 7); c.stroke(); }
  if (u.stun > 0) c.globalAlpha = 0.8;
  c.drawImage(img, sx, sy);
  if (u.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55; c.drawImage(img, sx, sy); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
  if (u.slowT > G.time) { c.globalAlpha = 0.35; c.fillStyle = '#9fe0ff'; c.fillRect(sx + ax - 5, sy + 4, 10, ay - 4); }
  c.globalAlpha = 1;
  const headY = py - (def ? Math.min(ay, def.h) : 14) + 2;
  if ((sel || u.hp < u.maxhp) && !isAnimal(u)) bar(px - 6, headY - 5, 12, u.hp / u.maxhp);
  else if (isAnimal(u) && u.hp < u.maxhp) bar(px - 5, headY - 3, 10, u.hp / u.maxhp);
  if (u.lvl >= 2) { const bi = PE.frame('icons', 'badge_' + u.lvl, 0); c.drawImage(bi, px - Math.round(bi.width / 2), headY - 6 - bi.height - ((sel || u.hp < u.maxhp) ? 0 : -3)); }
  if (u.def.unique && Math.floor(VIEW.anim * 2) % 2 === 0) { c.fillStyle = '#ffd23a'; c.fillRect(px, headY - 2, 1, 1); }
  if (u.stun > 0) { c.fillStyle = '#ffe98a'; const a = VIEW.anim * 6; for (let k = 0; k < 3; k++) c.fillRect(Math.round(px + Math.cos(a + k * 2.1) * 5), headY + Math.round(Math.sin(a + k * 2.1) * 1.5), 1, 1); }
}
function drawCorpse(k) {
  const c = VIEW.ctx, def = PE.ART.units[k.key]; if (!def || k.key.startsWith('animal_')) return;
  const flip = (k.face < 0) !== (def.face === -1), img0 = PE.frame('units', k.key, 0, { team: teamColorIdx(k.team), anim: 'idle' }), img = flip ? flipped(img0) : img0;
  const fall = Math.min(1, k.t * 3), a = k.t > 8 ? Math.max(0, 1 - (k.t - 8) / 4) : 1;
  c.save(); c.globalAlpha = a * (k.t < 0.4 ? 1 : 0.75); c.translate(SX(k.x), SY(k.y)); c.rotate(fall * Math.PI / 2 * (k.face < 0 ? -1 : 1));
  c.drawImage(img, -def.ax, -def.ay); c.restore(); c.globalAlpha = 1;
}
function drawOverlays() {
  const c = VIEW.ctx;
  // colocación de edificios
  if (UI.placing && UI.mouseWorld) {
    const type = UI.placing, d = BLD[type], tiles = placementTiles();
    for (const [tx, ty] of tiles) {
      const ok = canPlace(G.human, type, tx, ty) || (type === 'gate' && G.blds.some(b => !b.dead && b.type === 'wall' && b.team === G.human && b.tx === tx && b.ty === ty));
      const img = PE.frame('buildings', G.players[G.human].race + '_' + type, 0, { team: teamColorIdx(G.human), mask: d.wall ? 10 : 0 });
      c.globalAlpha = 0.6; c.drawImage(img, tx * TS - VIEW.ox, (ty + d.fp) * TS - img.height - VIEW.oy);
      c.globalAlpha = 0.35; c.fillStyle = ok ? '#4cff6a' : '#ff3a3a'; c.fillRect(tx * TS - VIEW.ox, ty * TS - VIEW.oy, d.fp * TS, d.fp * TS); c.globalAlpha = 1;
    }
    if (type === 'tower' || type === 'castle' || type === 'tc') { const [tx, ty] = tiles[0]; c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc((tx + d.fp / 2) * TS - VIEW.ox, (ty + d.fp / 2) * TS - VIEW.oy, (d.range + d.fp / 2) * TS, 0, 7); c.stroke(); }
  }
  if (UI.roadDrag && UI.mouseWorld) { for (const [tx, ty] of roadTiles()) { c.globalAlpha = 0.45; c.fillStyle = canRoad(tx, ty) ? '#d8c08a' : '#ff3a3a'; c.fillRect(tx * TS - VIEW.ox, ty * TS - VIEW.oy, TS, TS); c.globalAlpha = 1; } }
  if (UI.drag && UI.drag.box) { const d = UI.drag, k = VIEW.dpr / VIEW.S; c.strokeStyle = '#8fff7a'; c.lineWidth = 1; c.strokeRect(Math.round(Math.min(d.x0, d.x1) * k) + 0.5, Math.round(Math.min(d.y0, d.y1) * k) + 0.5, Math.round(Math.abs(d.x1 - d.x0) * k), Math.round(Math.abs(d.y1 - d.y0) * k)); }
  for (const p of UI.marks) { const k = p.t / 0.5; c.strokeStyle = p.c; c.globalAlpha = 1 - k; const r = 3 + k * 10; c.strokeRect(SX(p.x) - r, SY(p.y) - r / 2, r * 2, r); c.globalAlpha = 1; }
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
  for (const u of G.units) { if (u.dead || u.inside || (isAnimal(u) && u.team >= 7)) continue; if (!isAlly(u.team, G.human) && !visibleAt(u.x, u.y)) continue; const col = PE.hx(PE.TEAM_COLORS[teamColorIdx(u.team)].hex); put(tileOf(u.y) * W + tileOf(u.x), col.map(v => Math.min(255, v + 40))); }
  if (G.human >= 0 && !G.cfg.revealed) for (let i = 0; i < W * H; i++) { const v = G.vis[i]; if (v === 0) { d[i * 4] = 10; d[i * 4 + 1] = 8; d[i * 4 + 2] = 16; } else if (v === 1) { d[i * 4] *= 0.55; d[i * 4 + 1] *= 0.55; d[i * 4 + 2] *= 0.6; } }
  x.putImageData(img, 0, 0);
  x.strokeStyle = '#fff'; x.lineWidth = 1; x.strokeRect((G.cam.x - VIEW.ww / 2) / T + 0.5, (G.cam.y - VIEW.wh / 2) / T + 0.5, VIEW.ww / T, VIEW.wh / T);
  for (const p of G.pings) { p.t += 0.25; const r = 2 + (p.t % 1) * 5; x.strokeStyle = '#ff5a4a'; x.beginPath(); x.arc(p.x / T, p.y / T, r, 0, 7); x.stroke(); }
  G.pings = G.pings.filter(p => p.t < 4);
}

export { VIEW, TS, teamColorIdx, SX, SY, EDGE, DIRS8, hash2, tileImg, edgeTile, CHUNK, CHUNK_PX, prerenderTerrain, computeTile, getChunk, redrawTiles, updateFog, flipped, unitFrame, bar, drawEnv, drawFxBig, render, inView, drawRes, drawBld, drawUnit, drawCorpse, drawOverlays, WX, drawWeather, drawMinimap };
