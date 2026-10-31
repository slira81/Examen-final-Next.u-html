/* =====================================================================
   A* en rejilla (8 direcciones, sin cortar esquinas), costes por terreno
   (caminos rápidos, vados lentos), puertas que solo dejan pasar a su
   dueño y aliados, suavizado por línea de visión y rejilla espacial.
   ===================================================================== */
'use strict';
const PF = { stamp: null, g: null, from: null, gen: 1, W: 0, H: 0, heap: new Heap() };
function pfInit(W, H) {
  PF.W = W; PF.H = H; PF.stamp = new Uint32Array(W * H); PF.closed = new Uint32Array(W * H);
  PF.g = new Float32Array(W * H); PF.from = new Int32Array(W * H); PF.gen = 1;
}
function passable(i, team) {
  const m = G.map; if (!m.blocked[i]) return true;
  const g = m.gate[i]; return g >= 0 && team >= 0 && team < 8 && (g === team || isAlly(g, team));
}
function tileCost(i) { return 1 / TR_SPEED[G.map.terr[i]]; }
/**
 * Busca camino desde (sx,sy) hasta una tile que cumpla goal(x,y). hx,hy = destino para la heurística.
 * Devuelve lista de puntos en px (sin el inicio) o null. Si no llega, devuelve camino parcial al nodo más cercano.
 */
function findPath(sx, sy, hx, hy, goal, team, maxNodes = 6000) {
  const W = PF.W, H = PF.H;
  sx = Math.max(0, Math.min(W - 1, sx)); sy = Math.max(0, Math.min(H - 1, sy));
  const gen = ++PF.gen, st = PF.stamp, cl = PF.closed, g = PF.g, from = PF.from, heap = PF.heap; heap.k.length = 0; heap.p.length = 0;
  const h = (x, y) => { const dx = Math.abs(x - hx), dy = Math.abs(y - hy); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
  const s = sy * W + sx; st[s] = gen; g[s] = 0; from[s] = -1; heap.push(s, h(sx, sy));
  let best = s, bestH = h(sx, sy), n = 0, found = -1;
  while (heap.size) {
    const c = heap.pop(); if (cl[c] === gen) continue; cl[c] = gen;
    const x = c % W, y = (c / W) | 0;
    if (goal(x, y)) { found = c; break; }
    const hc = h(x, y); if (hc < bestH) { bestH = hc; best = c; }
    if (++n > maxNodes) break;
    for (let d = 0; d < 8; d++) {
      const dx = DX8[d], dy = DY8[d], nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx; if (cl[ni] === gen || !passable(ni, team)) continue;
      if (dx && dy && (!passable(y * W + nx, team) || !passable(ny * W + x, team))) continue;
      const ng = g[c] + (dx && dy ? 1.414 : 1) * tileCost(ni);
      if (st[ni] !== gen || ng < g[ni]) { st[ni] = gen; g[ni] = ng; from[ni] = c; heap.push(ni, ng + h(nx, ny) * 0.999); }
    }
  }
  const end = found >= 0 ? found : best;
  if (found < 0 && end === s) return null;
  const pts = []; let k = end;
  while (k !== s && k >= 0) { pts.push(k); k = from[k]; }
  pts.reverse();
  // suavizado: saltar puntos con línea de visión libre
  const out = []; let ax = sx, ay = sy, i = 0;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && j - i < 12 && lineFree(ax, ay, pts[j + 1] % W, (pts[j + 1] / W) | 0, team)) j++;
    const px = pts[j] % W, py = (pts[j] / W) | 0;
    out.push({ x: px * T + 8, y: py * T + 8 }); ax = px; ay = py; i = j + 1;
  }
  out.partial = found < 0;
  return out;
}
const DX8 = [1, -1, 0, 0, 1, 1, -1, -1], DY8 = [0, 0, 1, -1, 1, -1, 1, -1];
function lineFree(x0, y0, x1, y1, team) {
  const W = PF.W; let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), x = x0, y = y0, sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1, e = dx - dy;
  const c0 = tileCost(y0 * W + x0);
  for (let k = 0; k < 64; k++) {
    if (!passable(y * W + x, team) || Math.abs(tileCost(y * W + x) - c0) > 0.2) return false;
    if (x === x1 && y === y1) return true;
    const e2 = 2 * e;
    if (e2 > -dy && e2 < dx) { if (!passable(y * W + x + sx, team) || !passable((y + sy) * W + x, team)) return false; }
    if (e2 > -dy) { e -= dy; x += sx; }
    if (e2 < dx) { e += dx; y += sy; }
  }
  return false;
}

// --------------------------------------------------------------- rejilla espacial
const SG = { cell: 64, cw: 0, ch: 0, cells: [] };
function sgInit(W, H) { SG.cw = Math.ceil(W * T / SG.cell); SG.ch = Math.ceil(H * T / SG.cell); SG.cells = Array.from({ length: SG.cw * SG.ch }, () => []); }
function sgRebuild(units) {
  for (const c of SG.cells) c.length = 0;
  for (const u of units) { if (u.dead || u.inside) continue; const cx = Math.min(SG.cw - 1, Math.max(0, (u.x / SG.cell) | 0)), cy = Math.min(SG.ch - 1, Math.max(0, (u.y / SG.cell) | 0)); SG.cells[cy * SG.cw + cx].push(u); }
}
/** Llama fn(u) para cada unidad en el radio r (px). Devuelve true si fn devuelve true (corte). */
function sgEach(x, y, r, fn) {
  const x0 = Math.max(0, ((x - r) / SG.cell) | 0), x1 = Math.min(SG.cw - 1, ((x + r) / SG.cell) | 0), y0 = Math.max(0, ((y - r) / SG.cell) | 0), y1 = Math.min(SG.ch - 1, ((y + r) / SG.cell) | 0), r2 = r * r;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (const u of SG.cells[cy * SG.cw + cx]) {
    if (u.dead) continue; const dx = u.x - x, dy = u.y - y; if (dx * dx + dy * dy <= r2 && fn(u)) return true;
  }
  return false;
}
