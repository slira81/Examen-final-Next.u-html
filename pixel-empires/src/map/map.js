import { MAP_TYPES } from '../data/data.js';
/* =====================================================================
   Generación de mapas: ruido fractal, biomas, ríos, conectividad,
   caminos, bosques por bioma, recursos por jugador, fauna y tesoros.
   ===================================================================== */
// Terrenos
const TR = { GRASS: 0, GRASS_DARK: 1, DIRT: 2, SAND: 3, SNOW: 4, ROAD: 5, ROCK: 6, WATER: 7, SHALLOW: 8 };
const TR_TILE = ['tile_grass', 'tile_grass_dark', 'tile_dirt', 'tile_sand', 'tile_snow', 'tile_road', 'tile_rock', 'tile_water', 'tile_shallow'];
const TR_VARS = [4, 2, 2, 2, 2, 2, 2, 1, 1];
const TR_PRIO = [5, 6, 4, 3, 7, 8, 9, 1, 2];
const TR_COLOR = ['#4c9a3c', '#3f8434', '#8a6a44', '#d9c08a', '#e6eef4', '#a8916a', '#6f6c6a', '#3a74c4', '#5a9ad8'];
const TR_SPEED = [1, 1, 1, 0.95, 0.88, 1.35, 1, 1, 0.6];
const TR_BLOCK = [0, 0, 0, 0, 0, 0, 1, 1, 0];

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function makeNoise(rnd, W, H, cell) {
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
function fbm(rnd, W, H, base) {
  const oct = [makeNoise(rnd, W, H, base), makeNoise(rnd, W, H, base / 2), makeNoise(rnd, W, H, base / 4), makeNoise(rnd, W, H, base / 8)];
  return (x, y) => (oct[0](x, y) * 0.5 + oct[1](x, y) * 0.25 + oct[2](x, y) * 0.15 + oct[3](x, y) * 0.1);
}

function generateMap(cfg) {
  const rnd = mulberry32(cfg.seed), W = cfg.size, H = cfg.size, N = W * H, mt = MAP_TYPES[cfg.mapType];
  const terr = new Uint8Array(N), idx = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const elevN = fbm(rnd, W, H, 24), moistN = fbm(rnd, W, H, 18), dirtN = fbm(rnd, W, H, 10), forestN = fbm(rnd, W, H, 9), biomeN = fbm(rnd, W, H, 30);
  // posiciones iniciales en círculo
  const np = cfg.players.length, starts = [], a0 = rnd() * Math.PI * 2, R = W * 0.36;
  for (let i = 0; i < np; i++) {
    const a = a0 + i * Math.PI * 2 / np + (rnd() - 0.5) * 0.25;
    starts.push({ x: Math.round(W / 2 + Math.cos(a) * R), y: Math.round(H / 2 + Math.sin(a) * R) });
  }
  const nearStart = (x, y, r) => starts.some(s => Math.hypot(x - s.x, y - s.y) < r);
  const elev = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let e = elevN(x, y);
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y); if (edge < 3) e = e * 0.7 + 0.15; // bordes suaves
    for (const s of starts) { const d = Math.hypot(x - s.x, y - s.y); if (d < 14) { const k = Math.max(0, 1 - d / 14); e = e * (1 - k) + 0.52 * k; } }
    elev[idx(x, y)] = e;
  }
  // umbrales por percentil
  const sorted = Array.from(elev).sort((a, b) => a - b), pct = p => sorted[Math.min(N - 1, Math.floor(p * N))];
  const wT = pct(mt.water * 0.55), rT = pct(mt.rock);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), e = elev[i], m = moistN(x, y);
    let t;
    if (e < wT) t = TR.WATER; else if (e < wT + 0.018) t = TR.SHALLOW; else if (e < wT + 0.04) t = TR.SAND;
    else if (e > rT) t = TR.ROCK;
    else if (mt.snow && e > rT - 0.05) t = TR.SNOW;
    else t = m > 0.52 ? TR.GRASS_DARK : TR.GRASS;
    if ((t === TR.GRASS || t === TR.GRASS_DARK) && dirtN(x, y) > 0.66) t = TR.DIRT;
    if (mt.cold && (t === TR.GRASS || t === TR.GRASS_DARK) && biomeN(x, y) > 0.42) t = TR.SNOW;
    terr[i] = t;
  }
  // ríos
  if (mt.river) {
    for (let r = 0; r < 2; r++) {
      let x, y, dx, dy;
      if (r === 0) { x = 0; y = Math.floor(H * (0.3 + rnd() * 0.4)); dx = 1; dy = 0; } else { y = 0; x = Math.floor(W * (0.3 + rnd() * 0.4)); dx = 0; dy = 1; }
      let ang = Math.atan2(dy, dx), step = 0;
      while (inb(Math.round(x), Math.round(y))) {
        ang += (rnd() - 0.5) * 0.5; const base = r === 0 ? 0 : Math.PI / 2; ang = base + Math.max(-0.7, Math.min(0.7, ang - base));
        x += Math.cos(ang); y += Math.sin(ang); step++;
        const ford = step % 18 < 3;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const xx = Math.round(x) + ox, yy = Math.round(y) + oy; if (!inb(xx, yy) || nearStart(xx, yy, 9)) continue;
          const i = idx(xx, yy), core = Math.abs(ox) + Math.abs(oy) <= 1;
          terr[i] = ford ? TR.SHALLOW : core ? TR.WATER : (terr[i] === TR.WATER ? TR.WATER : TR.SHALLOW);
        }
      }
    }
  }
  // limpiar base inicial
  for (const s of starts) for (let y = s.y - 8; y <= s.y + 8; y++) for (let x = s.x - 8; x <= s.x + 8; x++) {
    if (!inb(x, y) || Math.hypot(x - s.x, y - s.y) > 8) continue;
    const i = idx(x, y); if (TR_BLOCK[terr[i]] || terr[i] === TR.SHALLOW || terr[i] === TR.SAND) terr[i] = mt.cold ? TR.SNOW : TR.GRASS;
  }
  // arena alrededor del agua y playa
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y); if (terr[i] !== TR.GRASS && terr[i] !== TR.GRASS_DARK && terr[i] !== TR.DIRT) continue;
    let w = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (inb(xx, yy) && terr[idx(xx, yy)] === TR.WATER) w = true; }
    if (w && rnd() < 0.6) terr[i] = TR.SAND;
  }
  // conectividad: todos los inicios alcanzables desde el primero
  const passT = i => !TR_BLOCK[terr[i]];
  function flood(sx, sy) {
    const seen = new Uint8Array(N), q = [idx(sx, sy)]; seen[q[0]] = 1;
    for (let k = 0; k < q.length; k++) { const c = q[k], x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!inb(xx, yy)) continue; const n = idx(xx, yy); if (!seen[n] && passT(n)) { seen[n] = 1; q.push(n); } } }
    return seen;
  }
  for (let tries = 0; tries < 6; tries++) {
    const seen = flood(starts[0].x, starts[0].y); let ok = true;
    for (const s of starts) if (!seen[idx(s.x, s.y)]) {
      ok = false; let x = starts[0].x, y = starts[0].y;
      while (x !== s.x || y !== s.y) { if (x !== s.x && (y === s.y || rnd() < 0.5)) x += Math.sign(s.x - x); else y += Math.sign(s.y - y); const i = idx(x, y); if (TR_BLOCK[terr[i]]) terr[i] = terr[i] === TR.WATER ? TR.SHALLOW : TR.DIRT; }
    }
    if (ok) break;
  }
  const map = { W, H, terr, blocked: new Uint8Array(N), gate: new Int8Array(N).fill(-1), res: new Array(N).fill(null), decor: [], starts, seed: cfg.seed, type: cfg.mapType };
  for (let i = 0; i < N; i++) map.blocked[i] = TR_BLOCK[terr[i]];
  // caminos: de cada inicio al centro (A* simple sobre el terreno)
  const roadTo = (ax, ay, bx, by) => {
    const cost = i => terr[i] === TR.WATER ? 40 : terr[i] === TR.ROCK ? 60 : terr[i] === TR.SHALLOW ? 6 : terr[i] === TR.ROAD ? 0.3 : 1;
    const dist = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), open = new Heap(); const s = idx(ax, ay), g = idx(bx, by);
    dist[s] = 0; open.push(s, 0);
    while (open.size) { const c = open.pop(); if (c === g) break; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!inb(xx, yy)) continue; const n = idx(xx, yy), nd = dist[c] + cost(n) + (rnd() * 0.3); if (nd < dist[n]) { dist[n] = nd; prev[n] = c; open.push(n, nd + Math.abs(xx - bx) + Math.abs(yy - by)); } } }
    let k = g; while (k >= 0 && k !== s) { if (terr[k] === TR.WATER) terr[k] = TR.SHALLOW; else if (terr[k] === TR.ROCK) terr[k] = TR.DIRT; else if (terr[k] !== TR.SHALLOW) terr[k] = TR.ROAD; map.blocked[k] = 0; k = prev[k]; }
  };
  const cx = W >> 1, cy = H >> 1;
  for (const s of starts) roadTo(s.x, s.y + 3, cx, cy);
  for (let i = 0; i < starts.length; i++) roadTo(starts[i].x, starts[i].y, starts[(i + 1) % starts.length].x, starts[(i + 1) % starts.length].y);
  for (let i = 0; i < N; i++) map.blocked[i] = TR_BLOCK[terr[i]];
  // recursos
  const isLand = (x, y) => inb(x, y) && !TR_BLOCK[terr[idx(x, y)]] && terr[idx(x, y)] !== TR.SHALLOW && terr[idx(x, y)] !== TR.ROAD;
  const free = (x, y) => isLand(x, y) && !map.res[idx(x, y)] && !map.blocked[idx(x, y)];
  let rid = 1;
  const addRes = (kind, x, y, amt, extra) => {
    if (!free(x, y)) return null;
    const r = Object.assign({ id: rid++, k: 'r', kind, tx: x, ty: y, amt, max: amt, v: Math.floor(rnd() * 3), ph: rnd() * 4 }, extra || {});
    map.res[idx(x, y)] = r; if (kind !== 'carcass') map.blocked[idx(x, y)] = 1; return r;
  };
  map.addRes = addRes; map.rid = () => rid++;
  const treeType = (x, y) => {
    const t = terr[idx(x, y)], b = biomeN(x, y);
    if (t === TR.SNOW) return 'tree_snowpine';
    if (t === TR.SAND) return rnd() < 0.7 ? 'tree_palm' : 'tree_dead';
    let nearW = false; for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if (inb(x + ox, y + oy) && terr[idx(x + ox, y + oy)] === TR.WATER) nearW = true;
    if (nearW && rnd() < 0.5) return 'tree_willow';
    if (rnd() < 0.012) return 'tree_elder';
    if (t === TR.DIRT && rnd() < 0.3) return 'tree_dead';
    return b > 0.56 ? 'tree_pine' : b > 0.46 ? (rnd() < 0.5 ? 'tree_oak' : 'tree_birch') : (rnd() < 0.75 ? 'tree_oak' : 'tree_birch');
  };
  const addTree = (x, y) => { if (!free(x, y) || nearStart(x, y, 7)) return; const art = treeType(x, y); addRes('tree', x, y, art === 'tree_elder' ? 400 : art === 'tree_dead' ? 60 : 100, { art }); };
  const cluster = (kind, x0, y0, n, amt, extra) => {
    let placed = 0, x = x0, y = y0, guard = 0;
    while (placed < n && guard++ < 200) { if (addRes(kind, x, y, amt, extra)) placed++; x += Math.round(rnd() * 2 - 1); y += Math.round(rnd() * 2 - 1); if (Math.hypot(x - x0, y - y0) > 3) { x = x0; y = y0; } }
    return placed;
  };
  const ringSpot = (s, r0, r1, needFree = 2) => {
    for (let t = 0; t < 400; t++) {
      if (t === 150) { r1 += 4; needFree = Math.max(0, needFree - 1); } if (t === 300) { r0 = Math.max(4, r0 - 2); r1 += 4; needFree = 0; }
      const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0), x = Math.round(s.x + Math.cos(a) * r), y = Math.round(s.y + Math.sin(a) * r);
      let ok = true; for (let oy = -needFree; oy <= needFree && ok; oy++) for (let ox = -needFree; ox <= needFree; ox++) if (!free(x + ox, y + oy)) { ok = false; break; }
      if (ok) return { x, y };
    }
    return null;
  };
  const resMul = cfg.resources === 'low' ? 0.75 : cfg.resources === 'high' ? 1.4 : 1;
  for (const s of starts) {
    const p = ringSpot(s, 7, 9, 1); if (p) cluster('berry', p.x, p.y, 6, Math.round(125 * resMul));
    let g = ringSpot(s, 9, 12); if (g) cluster('gold', g.x, g.y, 6, Math.round(800 * resMul));
    g = ringSpot(s, 10, 13); if (g) cluster('stone', g.x, g.y, 5, Math.round(400 * resMul));
    g = ringSpot(s, 11, 14); if (g) cluster('iron', g.x, g.y, 5, Math.round(500 * resMul));
    for (let f = 0; f < 3; f++) { const w = ringSpot(s, 10, 15, 1); if (w) for (let k = 0; k < 18; k++) addTree(w.x + Math.round((rnd() - 0.5) * 6), w.y + Math.round((rnd() - 0.5) * 6)); }
  }
  const fT = (() => { const s = []; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) s.push(forestN(x, y)); s.sort((a, b) => a - b); return s[Math.floor(s.length * mt.forest)]; })();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (forestN(x, y) > fT && !nearStart(x, y, 9)) addTree(x, y);
  for (let k = 0; k < W * H / 220; k++) addTree(Math.floor(rnd() * W), Math.floor(rnd() * H));   // árboles sueltos
  // oro, piedra, hierro y gemas extra por el mapa
  const extra = Math.round((W * H) / 900);
  for (let k = 0; k < extra; k++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H); if (nearStart(x, y, 14)) continue;
    const kind = ['gold', 'stone', 'iron', 'gold', 'iron', 'gems'][k % 6];
    cluster(kind, x, y, kind === 'gems' ? 3 : 4, Math.round((kind === 'gems' ? 500 : 700) * resMul));
  }
  // peces
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (terr[idx(x, y)] !== TR.WATER || rnd() > 0.035) continue;
    let shore = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isLand(x + dx, y + dy)) shore = true;
    if (shore && !map.res[idx(x, y)]) { const r = { id: rid++, k: 'r', kind: 'fish', tx: x, ty: y, amt: 200, max: 200, v: 0, ph: rnd() * 4 }; map.res[idx(x, y)] = r; }
  }
  map.resList = map.res.filter(Boolean);
  // decoración
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), t = terr[i]; if (map.res[i] || map.blocked[i] || t === TR.ROAD) continue;
    const r = rnd();
    if (t === TR.GRASS || t === TR.GRASS_DARK) {
      if (r < 0.025) map.decor.push({ key: 'decor_flowers', tx: x, ty: y, v: Math.floor(rnd() * 4) });
      else if (r < 0.05) map.decor.push({ key: 'decor_grass_tuft', tx: x, ty: y, v: Math.floor(rnd() * 2), anim: true, ph: rnd() * 4 });
      else if (r < 0.058) map.decor.push({ key: 'decor_rock_small', tx: x, ty: y, v: Math.floor(rnd() * 3) });
      else if (r < 0.064 && t === TR.GRASS_DARK) map.decor.push({ key: 'decor_mushroom', tx: x, ty: y, v: Math.floor(rnd() * 2) });
    } else if (t === TR.SAND) {
      let w = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (inb(xx, yy) && terr[idx(xx, yy)] === TR.WATER) w = true; }
      if (w && r < 0.18) map.decor.push({ key: 'decor_reeds', tx: x, ty: y, v: 0, anim: true, ph: rnd() * 4 });
      else if (r < 0.02) map.decor.push({ key: 'decor_bones', tx: x, ty: y, v: 0 });
    } else if (t === TR.SNOW && r < 0.03) map.decor.push({ key: 'decor_snowrock', tx: x, ty: y, v: 0 });
    else if (t === TR.DIRT && r < 0.025) map.decor.push({ key: 'decor_rock_small', tx: x, ty: y, v: Math.floor(rnd() * 3) });
    if (t === TR.ROCK && r < 0.05) map.decor.push({ key: 'decor_rock_big', tx: x, ty: y, v: Math.floor(rnd() * 2) });
  }
  // puntos de interés neutrales (el motor crea las entidades)
  map.poi = [];
  const poiSpot = (minD) => { for (let t = 0; t < 300; t++) { const x = 4 + Math.floor(rnd() * (W - 8)), y = 4 + Math.floor(rnd() * (H - 8)); if (nearStart(x, y, minD)) continue; let ok = true; for (let oy = -2; oy <= 4 && ok; oy++) for (let ox = -2; ox <= 4; ox++) if (!free(x + ox, y + oy)) { ok = false; break; } if (ok) return { x, y }; } return null; };
  const nCamps = Math.max(1, Math.round(W / 48));
  for (let k = 0; k < nCamps; k++) { const p = poiSpot(22); if (p) map.poi.push({ type: 'bandit_camp', ...p }); }
  for (let k = 0; k < nCamps; k++) { const p = poiSpot(20); if (p) map.poi.push({ type: 'goblin_hut', ...p }); }
  { const p = poiSpot(24); if (p) map.poi.push({ type: 'shrine', ...p }); }
  for (let k = 0; k < 2; k++) { const p = poiSpot(16); if (p) map.poi.push({ type: 'ruins', ...p }); }
  for (let k = 0; k < Math.round(W / 10); k++) { const p = poiSpot(12); if (p) map.poi.push({ type: 'chest', ...p }); }
  for (let k = 0; k < Math.max(2, np); k++) { const p = poiSpot(18); if (p) map.poi.push({ type: 'relic', ...p }); }
  // fauna
  map.fauna = [];
  for (const s of starts) {
    const kinds = mt.cold ? ['sheep', 'sheep', 'cow', 'pig'] : ['sheep', 'sheep', 'pig', 'cow', 'chicken', 'chicken'];
    for (const k of kinds) { const p = ringSpot(s, 5, 8, 0); if (p) map.fauna.push({ kind: k, x: p.x, y: p.y, owner: s }); }
    for (let d = 0; d < 2; d++) { const p = ringSpot(s, 12, 18, 1); if (p) for (let n = 0; n < 3; n++) map.fauna.push({ kind: 'deer', x: p.x + n % 2, y: p.y + (n >> 1) }); }
    const b = ringSpot(s, 14, 19, 1); if (b) map.fauna.push({ kind: 'boar', x: b.x, y: b.y });
  }
  for (let k = 0; k < W / 12; k++) { const p = poiSpot(18); if (!p) continue; const r = rnd(); if (r < 0.35) for (let n = 0; n < 3; n++) map.fauna.push({ kind: 'wolf', x: p.x + n, y: p.y }); else if (r < 0.55) map.fauna.push({ kind: 'bear', x: p.x, y: p.y }); else if (r < 0.8) for (let n = 0; n < 3; n++) map.fauna.push({ kind: 'horse', x: p.x + n, y: p.y + 1 }); else for (let n = 0; n < 2; n++) map.fauna.push({ kind: rnd() < 0.5 ? 'sheep' : 'pig', x: p.x + n, y: p.y }); }
  map.rnd = rnd;
  return map;
}

// Montículo binario (A*, caminos)
class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) { const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p); while (i > 0) { const j = (i - 1) >> 1; if (P[j] <= p) break; K[i] = K[j]; P[i] = P[j]; i = j; } K[i] = k; P[i] = p; }
  pop() {
    const K = this.k, P = this.p, top = K[0], lk = K.pop(), lp = P.pop(), n = K.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && P[c + 1] < P[c]) c++; if (P[c] >= lp) break; K[i] = K[c]; P[i] = P[c]; i = c; } K[i] = lk; P[i] = lp; }
    return top;
  }
}

export { TR, TR_TILE, TR_VARS, TR_PRIO, TR_COLOR, TR_SPEED, TR_BLOCK, mulberry32, makeNoise, fbm, generateMap, Heap };
