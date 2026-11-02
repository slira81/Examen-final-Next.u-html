import { PE } from '../sprite.js';
/* =====================================================================
   Pixel Empires — arte de naturaleza (PE.ART.nature)
   Tiles 16×16 repetibles (tonos forzados, sin sombreado ni contorno),
   árboles con balanceo, minas con destellos, comida, decoración,
   tesoros, escombros, andamios y quemaduras. Sólo registra definiciones.
   Anclas: centro del borde inferior -> ax = w/2, ay = h-1.
   ===================================================================== */
(function () {
  const N = PE.ART.nature;

  // ---------------------------------------------------------- materiales
  PE.addMats({
    // terreno (cada color se usa casi siempre en tono .1 = paleta exacta)
    nat_grass: '#5c9a3e', nat_grassd: '#518c39', nat_grassl: '#6aa946',
    nat_fgrass: '#447d3b', nat_fgrassd: '#3a6f36', nat_fgrassl: '#508b43',
    nat_dirt: '#8e6c48', nat_dirtd: '#7d5e3e', nat_dirtl: '#a07e56',
    nat_sand: '#dcc690', nat_sandd: '#ccb47f', nat_sandl: '#e8d6a3',
    nat_snow: '#e3ebf3', nat_snowd: '#cad8e8', nat_snowl: '#f3f7fb',
    nat_road: '#7e6c55', nat_roadl: '#8c7a62', nat_roadd: '#71614c', nat_cob: '#a49c8c', nat_cob2: '#9b9489', nat_cobd: '#8e877b',
    nat_rock: '#7a7470', nat_rockd: '#5a5453', nat_rockm: '#6c6663',
    nat_water: '#3a74c4', nat_waterd: '#3369b6', nat_waterl: '#5690dc',
    nat_shal: '#4fa3c4', nat_shald: '#4495b8', nat_shall: '#6cb8d0',
    // vegetación
    nat_leaf: '#4a9a3e', nat_pine: '#2f7a50', nat_spine: '#2f6a5a', nat_bleaf: '#8cbf45', nat_palm: '#5aa83a',
    nat_willow: '#6aa868', nat_eleaf: '#3f8f70', nat_bush: '#3f8a40', nat_tuft: '#78b24a', nat_reed: '#7f9c42',
    nat_cattail: '#7a4e2e', nat_bark: '#7a5232', nat_birch: '#e2dccb', nat_birchm: '#4a4040', nat_pbark: '#a8844f',
    nat_dead: '#80705f', nat_ebark: '#6b5a4c', nat_cut: '#d9b77a', nat_coco: '#7a5228', nat_snowt: '#eef3f8',
    // minerales
    nat_ore: '#8a7c70', nat_ore2: '#7e7166', nat_quarry: '#aaa59c', nat_quarry2: '#9c978f',
    nat_irock: '#5b5052', nat_irock2: '#514749', nat_rust: '#b0603a', nat_ironm: '#8e9aac',
    nat_gem: '#9a5ae0', nat_gem2: '#4a8ae8', nat_grock: '#57525f', nat_grock2: '#4d4855',
    // decoración y tesoros
    nat_berry: '#d03a4a', nat_petR: '#e04a4a', nat_petY: '#f0cc40', nat_petW: '#eeeae0', nat_petB: '#7a6ae0',
    nat_cap: '#c83a32', nat_capb: '#a07048', nat_stalk: '#e8dcc0', nat_marble: '#c4bcae',
    nat_boulder: '#8f8a84', nat_boulder2: '#837e79', nat_chest: '#8a4a2a', nat_magic: '#7ff0b0',
    nat_fish: '#a8b8c8', nat_plank: '#b08a58',
  });
  PE.addFixed({
    nat_foam: '#eaf6fb', nat_foamA: '#d8eef8b0', nat_foamB: '#cfe8f670', nat_glint: '#d8eeff',
    nat_spark: '#fffbe6', nat_ripple: '#dff2ffa0', nat_ripple2: '#dff2ff58',
    nat_scorchA: '#1a120e48', nat_scorchB: '#1a120e88', nat_scorchC: '#120a08c0', nat_ash: '#5a524c90', nat_ember: '#ff7a3a',
    nat_dust: '#3a2e2448', nat_dust2: '#2a201a60', nat_wisp: '#e6ffb8', nat_wispA: '#d8ffb0a0', nat_flame: '#ffe27a', nat_sparkA: '#ffd070b0',
  });
  PE.addEmissive('nat_magic');

  // ---------------------------------------------------------- utilidades
  const rng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const SW = [0, 1, 1, 0], SW2 = [0, 0, 1, 0];       // balanceo de copa alta / media
  const GL = [0, 0, 1, 2];                           // ciclo de destello (nada, nada, punto, cruz)
  const TILE = { shade: false, outline: false };
  const V = (o, n) => ((o.v | 0) % n + n) % n;
  const tile = (variants, draw, extra) => Object.assign({ w: 16, h: 16, ax: 8, ay: 15, variants, render: TILE, draw }, extra || {});
  const obj = (w, h, extra) => Object.assign({ w, h, ax: w / 2, ay: h - 1 }, extra);

  // estampa: filas de caracteres -> material según paleta ('.' = nada)
  function stamp(c, rows, x, y, pal) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const m = pal[rows[j][i]]; if (m) c.px(m, x + i, y + j); }
  }
  // reparte n estampas sin cruzar bordes (variantes combinables) y sin amontonar (distancia toroidal d)
  function sprinkle(c, seed, n, stamps, pal, d = 5) {
    const r = rng(seed), pts = [];
    for (let t = 0; t < 500 && pts.length < n; t++) {
      const s = stamps[r() * stamps.length | 0], w = s[0].length, h = s.length;
      const x = r() * (17 - w) | 0, y = r() * (17 - h) | 0, cx = x + w / 2, cy = y + h / 2;
      if (pts.some(p => { const dx = Math.abs(p[0] - cx), dy = Math.abs(p[1] - cy); return Math.hypot(Math.min(dx, 16 - dx), Math.min(dy, 16 - dy)) < d; })) continue;
      pts.push([cx, cy]); stamp(c, s, x, y, pal);
    }
  }
  // destello en cruz sólo sobre píxeles ya pintados (k 0 nada, 1 punto, 2 cruz)
  function glint(c, x, y, k, m = 'nat_spark') {
    if (!k || c.get(x, y) === null) return;
    c.px(m, x, y);
    if (k > 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (c.get(x + dx, y + dy) !== null) c.px(m, x + dx, y + dy);
  }

  // =========================================================== TERRENO
  // --- hierba: matas en V (punta clara, base oscura) y manchas de luz suaves
  const GP = { d: 'nat_grassd.1', l: 'nat_grassl.1', h: 'nat_grassl.2' };
  const TUFT = [['h.h', 'd.d', '.d.'], ['h..', 'd.h', '.dd'], ['..h', 'h.d', 'dd.']], DOT = [['h', 'd']], PATCH = [['.ll.', 'llll', '.ll.'], ['ll.', 'lll', '.l.']];
  function grassTile(c, base, pal, v, so = 0) {
    c.rect(base, 0, 0, 15, 15);
    const s = 11 + v * 7 + so;
    if (v === 2 || v === 3) sprinkle(c, s + 3, 1, PATCH, pal, 8);
    sprinkle(c, s, [4, 3, 3, 2][v], TUFT, pal, 6);
    sprinkle(c, s + 1, [1, 2, 1, 3][v], DOT, pal, 5);
  }
  N.tile_grass = tile(4, (c, f, o) => grassTile(c, 'nat_grass.1', GP, V(o, 4)));
  // --- hierba oscura (bosque)
  const FP = { d: 'nat_fgrassd.1', l: 'nat_fgrassl.1', h: 'nat_fgrassl.2' };
  N.tile_grass_dark = tile(2, (c, f, o) => grassTile(c, 'nat_fgrass.1', FP, [0, 3][V(o, 2)], 100));
  // --- tierra
  const DP = { d: 'nat_dirtd.1', l: 'nat_dirtl.1', h: 'nat_dirt.2', s: 'nat_dirt.0' };
  N.tile_dirt = tile(2, (c, f, o) => {
    const v = V(o, 2);
    c.rect('nat_dirt.1', 0, 0, 15, 15);
    sprinkle(c, 23 + v * 9, 4, [['hl', 'ds'], ['l', 'd'], ['dd'], ['.l', 'ld']], DP, 5);
  });
  // --- arena (ondas suaves)
  const SP = { d: 'nat_sandd.1', l: 'nat_sandl.1' };
  N.tile_sand = tile(2, (c, f, o) => {
    const v = V(o, 2);
    c.rect('nat_sand.1', 0, 0, 15, 15);
    sprinkle(c, 31 + v * 13, 4, [['.lll', 'd..d'], ['ll.', '..d'], ['l', 'd'], ['.ll', 'd..']], SP, 6);
  });
  // --- nieve (sombras azuladas y brillos)
  const NP = { d: 'nat_snowd.1', l: 'nat_snowl.1', w: 'nat_snow.2' };
  N.tile_snow = tile(2, (c, f, o) => {
    const v = V(o, 2);
    c.rect('nat_snow.1', 0, 0, 15, 15);
    sprinkle(c, 53 + v * 11, 4, [['.ww.', 'd..d'], ['ddd'], ['w'], ['.w', 'd.']], NP, 6);
  });
  // --- juntas/grietas: los bloques quedan con borde superior-izq claro e inferior-der oscuro.
  // Las grietas cruzan los bordes sólo en "puertos" fijos -> cualquier variante encaja con otra.
  function cracks(c, paths, P) {
    const t = new PE.SCanvas(16, 16);
    for (const p of paths) for (let i = 0; i < p.length - 1; i++) t.line('k', p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
    const K = (x, y) => t.get(x, y) !== null;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (K(x, y)) c.px(P.k, x, y);
      else if (K(x + 1, y) || K(x, y + 1)) c.px(P.s, x, y);
      else if (P.s2 && (K(x, y + 2) || K(x + 1, y + 1))) c.px(P.s2, x, y);
      else if (K(x - 1, y) || K(x, y - 1)) c.px(P.l, x, y);
      else if (P.l2 && (K(x - 1, y - 1) || K(x, y - 2) || K(x - 2, y))) c.px(P.l2, x, y);
    }
  }
  // --- bultos: formas rellenas con borde sup-izq claro e inf-der oscuro (adoquines, guijarros)
  function lumps(c, shapes, P, rect) {
    const t = new PE.SCanvas(16, 16);
    for (const [x, y, a, b, k] of shapes) {
      const m = k ? 'b' : 'a';
      if (!rect) { t.ell(m, x, y, a, b); continue; }
      t.rect(m, x, y, a, b); t.px(null, x, y); t.px(null, a, y); t.px(null, x, b); t.px(null, a, b);   // esquinas romas
    }
    const I = (x, y, m) => t.get(x, y) === m;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const m = t.get(x, y); if (!m) continue;
      const b = m === 'a' ? P.a : P.b;
      c.px(!I(x + 1, y, m) || !I(x, y + 1, m) ? P.s : !I(x - 1, y, m) || !I(x, y - 1, m) ? b + '.2' : b + '.1', x, y);
    }
  }
  // --- camino: 0 adoquines, 1 tierra apisonada con piedras sueltas (misma tierra = combinables).
  // Las piedras no tocan la fila 0 ni la columna 0 -> junta continua entre tiles.
  const COB = { a: 'nat_cob', b: 'nat_cob2', s: 'nat_cobd.1' };
  N.tile_road = tile(2, (c, f, o) => {
    const v = V(o, 2);
    c.rect('nat_road.1', 0, 0, 15, 15);
    if (v === 0) {
      lumps(c, [[1, 1, 9, 7, 0], [11, 1, 15, 7, 1], [1, 9, 5, 15, 1], [7, 9, 15, 15, 0]], COB, true);
      c.px('nat_cobd.1', 4, 4); c.px('nat_cob.2', 4, 5); c.px('nat_cobd.1', 13, 3); c.px('nat_cobd.1', 11, 12); c.px('nat_cob.2', 11, 13); c.px('nat_cobd.1', 3, 11);
    } else {
      sprinkle(c, 91, 4, [['ll.', '.dd'], ['l', 'd'], ['.l', 'd.']], { l: 'nat_roadl.1', d: 'nat_roadd.1' }, 5);
      lumps(c, [[4.5, 4.5, 3, 2.5, 0], [11.5, 10.5, 2.5, 2.2, 1], [4.5, 12.5, 1.6, 1.4, 1]], COB);
    }
  });
  // --- roca (montaña infranqueable): bloques partidos por grietas + guijarros
  const RP = { k: 'nat_rock.0', s: 'nat_rockd.1', s2: 'nat_rockm.1', l: 'nat_rock.3', l2: 'nat_rock.2' };
  const ROCKC = [   // puertos: izquierda/derecha en y=10, arriba/abajo en x=6
    [[[0, 10], [3, 9], [7, 10], [10, 8], [15, 10]], [[6, 0], [7, 3], [10, 4], [13, 3]], [[10, 4], [10, 8]], [[7, 10], [5, 13], [6, 15]], [[2, 4], [4, 5], [7, 3]]],
    [[[0, 10], [4, 11], [9, 12], [12, 9], [15, 10]], [[6, 0], [5, 3], [8, 6], [12, 9]], [[8, 6], [3, 7], [1, 6]], [[9, 12], [6, 15]], [[12, 2], [13, 5]]],
  ];
  N.tile_rock = tile(2, (c, f, o) => {
    const v = V(o, 2);
    c.rect('nat_rock.1', 0, 0, 15, 15);
    cracks(c, ROCKC[v], RP);
    for (const [x, y] of v ? [[3, 3], [11, 4], [3, 13]] : [[3, 13], [12, 6], [12, 13]]) { c.px('nat_rockd.1', x, y); c.px('nat_rock.2', x, y + 1); }
  });
  // --- agua profunda: crestas que brillan en su sitio (no cruzan bordes) y destello
  function wave(c, x, y, k, L, H, D) {
    if (k === 0) { c.px(L, x, y); c.px(L, x + 1, y); }
    else if (k === 1) { c.rect(L, x - 1, y, x + 2, y); c.rect(D, x, y + 1, x + 1, y + 1); }
    else if (k === 2) { c.rect(L, x - 1, y, x + 2, y); c.px(H, x, y); c.rect(D, x - 1, y + 1, x + 2, y + 1); }
    else { c.px(L, x - 1, y); c.px(L, x + 2, y); c.rect(D, x, y + 1, x + 1, y + 1); }
  }
  const WAVES = [[[3, 2, 0], [11, 4, 2], [6, 8, 1], [13, 10, 3], [2, 12, 2], [9, 14, 0]], [[9, 1, 1], [3, 5, 3], [12, 7, 0], [6, 11, 2], [13, 13, 1], [1, 9, 0]]];
  N.tile_water = tile(2, (c, f, o) => {
    c.rect('nat_water.1', 0, 0, 15, 15);
    WAVES[V(o, 2)].forEach(([x, y, p], i) => wave(c, x, y, (f + p) % 4, 'nat_waterl.1', i ? 'nat_waterl.2' : 'nat_glint', 'nat_waterd.1'));
  }, { frames: 4 });
  // --- agua somera: fondo arenoso visible y ondas claras
  const SHW = [[[10, 2, 0], [4, 7, 2], [12, 6, 1], [7, 13, 3]], [[3, 2, 1], [11, 5, 3], [6, 9, 0], [12, 13, 2]]];
  N.tile_shallow = tile(2, (c, f, o) => {
    const v = V(o, 2);
    c.rect('nat_shal.1', 0, 0, 15, 15);
    if (v) { c.ell('nat_shall.1', 11, 10, 3.5, 2); c.ell('nat_shall.1', 3.5, 4, 2.5, 1.5); c.px('nat_shald.1', 6, 13); c.px('nat_shald.1', 13, 2); }
    else { c.ell('nat_shall.1', 4.5, 11, 3.5, 2); c.ell('nat_shall.1', 11, 4, 3, 1.6); c.px('nat_shald.1', 12, 9); c.px('nat_shald.1', 3, 4); }
    SHW[v].forEach(([x, y, p], i) => wave(c, x, y, (f + p) % 4, 'nat_shall.2', i % 2 ? 'nat_shall.3' : 'nat_glint', 'nat_shald.1'));
  }, { frames: 4 });
  // --- espuma de orilla (superposición): bits = lados con tierra 1N 2E 4S 8O.
  // El motor desfasa el frame por tile: los extremos de cada lado no dependen del frame
  // (ventana W) y la ola sólo avanza/retrocede en el centro -> tiles vecinos siempre encajan.
  N.shore_foam = tile(1, (c, f, o) => {
    const m = o.mask | 0;
    const P = (s, a, d) => s === 1 ? [a, d] : s === 2 ? [15 - d, a] : s === 4 ? [a, 15 - d] : [d, a];
    const sides = [1, 2, 4, 8].filter(s => m & s);
    const W = a => Math.sin(Math.PI * (a + .5) / 16), up = [0, 1, 2, 1][f];
    const wv = (a, s) => Math.sin((a + s * 3) * Math.PI / 4 + f * Math.PI / 2);
    for (const s of sides) for (let a = 2; a < 14; a++)            // burbujas sueltas que se retiran
      if ((a + f * 3 + s) % 5 === 0) c.px('nat_foamB', ...P(s, a, 2 + Math.round(W(a) * [1, 2, 3, 2][f])));
    for (const s of sides) for (let a = 0; a < 16; a++) {          // espuma suave
      const e = 1 + Math.round(W(a) * (up + (wv(a, s) > .3 ? 1 : 0)) * .8);
      for (let d = 1; d <= e; d++) c.px('nat_foamA', ...P(s, a, d));
    }
    for (const s of sides) for (let a = 0; a < 16; a++) {          // línea de espuma pegada a la tierra
      c.px('nat_foam', ...P(s, a, 0));
      if (W(a) * wv(a, s) > .55) c.px('nat_foam', ...P(s, a, 1));
    }
  }, { masks: true, frames: 4, variants: 1 });

  // =========================================================== ÁRBOLES
  const TREE_R = { shadow: { cx: 12, cy: 30, rx: 6, ry: 1.6, a: 60 } };
  const tree = (variants, draw, w = 24, h = 32, extra) => obj(w, h, Object.assign({ frames: 4, variants, render: TREE_R, draw }, extra));
  const swayY = (y, f, a = 11, b = 16) => y < a ? SW[f] : y < b ? SW2[f] : 0;
  // grumo de follaje: L 1 sombra, 2 normal, 3 cima soleada
  // tramado de hojas: tablero de ajedrez sólo sobre píxeles ya pintados (no ensucia la silueta)
  const chk = c => (x, y) => ((x + y) & 1) === 0 && c.get(x + c.ox, y + c.oy) !== null;
  function blob(c, m, x, y, rx, ry, L) {
    c.ell(m + '.0', x, y, rx, ry);
    const mx = x - .7, my = y - .9, mrx = rx - (L > 1 ? 1 : 1.5), mry = ry - (L > 1 ? 1.1 : 1.6), k = chk(c);
    c.ring(m + '.1', mx, my, mrx + 1, mry + 1, .55, (px, py) => k(px, py) && py < y + ry * .3);
    c.ell(m + '.1', mx, my, mrx, mry);
    if (L >= 2) {
      const hx = x - rx * .34 - .3, hy = y - ry * .42 - .3, hr = rx * (L > 2 ? .55 : .42), hv = ry * (L > 2 ? .48 : .38);
      c.ring(m + '.2', hx + .3, hy + .3, hr + 1, hv + 1, .5, k);
      c.ell(m + '.2', hx, hy, hr, hv);
    }
    if (L >= 3) { const px = Math.floor(x - rx * .5), py = Math.floor(y - ry * .62); c.px(m + '.3', px, py); c.px(m + '.3', px + 1, py); c.px(m + '.3', px, py + 1); }
  }
  function crown(c, m, bl, f, a, b) { for (const q of bl) c.at(swayY(q[1], f, a, b), 0, () => blob(c, m, ...q)); }
  function trunk(c, m, x0, x1, y0, y1) {
    c.rect(m, x0, y0, x1, y1);
    c.px(m, x0 - 1, y1); c.px(m, x1 + 1, y1); c.px(m, x0 - 1, y1 - 1);
    if (x1 - x0 >= 2) c.line(m + '.0', x0 + 1, y0 + 2, x0 + 1, y0 + 4);
  }

  // --- roble
  const OAK = [
    { t: [10, 13, 19], bl: [[7.5, 18, 4.5, 3.5, 1], [14.5, 18.5, 5, 3.5, 1], [19, 16.5, 3, 3, 1], [5.5, 12.5, 4, 4.5, 2], [18, 12, 4, 4.5, 1], [12.5, 13, 5.5, 5, 2], [15.5, 7.5, 4.5, 4, 2], [9.5, 6.5, 5, 4.5, 3]] },
    { t: [10, 13, 21], bl: [[5.5, 18.5, 3.5, 3, 1], [12, 19.5, 5.5, 3, 1], [18.5, 18, 3.5, 3, 1], [17.5, 13.5, 4.5, 4, 1], [5.5, 14, 4, 4, 2], [11.5, 14, 6, 4.5, 2], [15, 9, 5, 4, 2], [8.5, 9.5, 5, 4, 3]] },
    { t: [11, 13, 21], bl: [[8, 21, 3.5, 2.8, 1], [15.5, 20.5, 3.5, 3, 1], [12, 21.5, 4, 2.5, 1], [16, 15.5, 4, 4, 1], [7.5, 15.5, 4, 4, 2], [12, 14.5, 4.5, 4.5, 2], [14.5, 9.5, 4, 4, 2], [9.5, 10, 4, 4, 3], [12, 5, 3.5, 3.5, 3]] },
  ];
  N.tree_oak = tree(3, (c, f, o) => {
    const d = OAK[V(o, 3)];
    trunk(c, 'nat_bark', d.t[0], d.t[1], d.t[2], 30);
    c.rect('nat_bark.0', d.t[0], d.t[2], d.t[1], d.t[2] + 1);                 // sombra de la copa
    c.line('nat_bark', d.t[0] + 1, d.t[2], d.t[0] - 2, d.t[2] - 3);           // rama asomando
    crown(c, 'nat_leaf', d.bl, f);
  });
  // --- pino: pisos triangulares
  function tier(c, m, cx, top, bot, hw) {
    c.poly(m + '.0', [[cx, top], [cx + hw, bot], [cx - hw, bot]]);
    c.poly(m + '.1', [[cx, top], [cx + hw * .4, bot - 1.6], [cx - hw + .6, bot - .6]]);
    c.poly(m + '.2', [[cx - .2, top + 1], [cx - .2, top + (bot - top) * .45], [cx - hw * .6, bot - 1.5]]);
    for (let x = Math.ceil(cx - hw + 1); x < cx + hw - 1; x += 3) c.px(m + '.0', x, Math.round(bot));
  }
  // nieve sobre el piso: capa superior con borde inferior festoneado, luz a la izquierda y sombra azulada a la derecha
  function snowTier(c, cx, top, bot, hw) {
    const hh = bot - top, yl = Math.floor(top + hh * .62);
    for (let y = Math.floor(top); y <= yl; y++) {
      const w = hw * (y + .5 - top) / hh, x0 = Math.ceil(cx - w - .5), x1 = Math.floor(cx + w - .5);
      for (let x = x0; x <= x1; x++) {
        if (y === yl && (x + (hw | 0)) % 3 === 0) continue;
        if (y === yl - 1 && x > cx + w * .5 && x % 2) continue;
        c.px(x <= cx - w * .35 ? 'nat_snowt.2' : x >= cx + w * .4 ? 'nat_snowt.0' : 'nat_snowt.1', x, y);
      }
    }
  }
  const PINE = [
    [[15, 25, 9], [10, 20, 7], [5, 15, 5], [1, 9.5, 3.5]],
    [[16, 25, 7.5], [11, 20, 6], [6, 15, 4.5], [1, 10, 3]],
    [[17, 26, 9.5], [12, 21, 8], [7, 16, 6], [2.5, 11, 4]],
  ];
  function pineTree(c, f, T, m, snow) {
    trunk(c, 'nat_bark', 11, 12, 22, 30);
    T.forEach(([top, bot, hw], i) => c.at(i >= T.length - 2 ? SW[f] : i === 1 ? SW2[f] : 0, 0, () => {
      tier(c, m, 12, top, bot, hw); if (snow) snowTier(c, 12, top, bot, hw);
    }));
  }
  N.tree_pine = tree(3, (c, f, o) => pineTree(c, f, PINE[V(o, 3)], 'nat_pine', false));
  N.tree_snowpine = tree(2, (c, f, o) => pineTree(c, f, PINE[V(o, 2) * 2], 'nat_spine', true));
  // --- abedul: tronco blanco con marcas, copa clara y aireada
  const BIRCH = [
    { tr: [[11, 12, 12]], br: [[12, 17, 16, 12], [11, 19, 8, 15]], bl: [[8, 17, 3.5, 3, 1], [16, 15, 3.5, 3, 1], [12, 13, 4.5, 4, 2], [8.5, 11, 3.5, 3.5, 2], [15.5, 9, 4, 3.5, 2], [11, 6, 4, 3.5, 3], [14, 4, 3, 2.5, 3]] },
    { tr: [[12, 13, 9]], br: [[12, 19, 8, 15], [8, 15, 7, 12], [13, 16, 16, 13]], bl: [[6.5, 13, 3, 2.5, 1], [17, 12, 3, 2.5, 1], [12.5, 11, 4, 3.5, 2], [8, 8.5, 3.5, 3.5, 2], [16, 7.5, 3.5, 3.5, 2], [12, 4.5, 4, 3.5, 3]] },
  ];
  N.tree_birch = tree(2, (c, f, o) => {
    const d = BIRCH[V(o, 2)];
    for (const [x0, y0, x1, y1] of d.br) c.line('nat_birch', x0, y0, x1, y1);
    for (const [a, b, y0] of d.tr) {
      c.rect('nat_birch', a, y0, b, 30);
      for (let y = y0 + 2; y < 29; y += 3) c.px('nat_birchm.1', (y * 7) % 2 ? a : b, y);
      c.px('nat_birch', a - 1, 30); c.px('nat_birch', b + 1, 30);
    }
    crown(c, 'nat_bleaf', d.bl, f, 10, 15);
  });
  // --- palmera: tronco curvo anillado, hojas arqueadas y cocos
  function palmFrond(c, cx, cy, dx, dy, dr, s) {
    const n = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(cx + dx * t + s * t), y = Math.round(cy + dy * t + dr * t * t);
      c.px(t < .25 ? 'nat_palm.1' : 'nat_palm.2', x, y);
      if (t > .15 && t < .9) c.px(i % 2 ? 'nat_palm.0' : 'nat_palm.1', x, y + 1);
      if (t > .3 && t < .8 && i % 2) c.px('nat_palm.0', x, y + 2);
    }
  }
  const PALM = [{ b: [11, 30], k: [8, 20], t: [13, 11] }, { b: [12, 30], k: [16, 21], t: [10, 12] }];
  N.tree_palm = tree(2, (c, f, o) => {
    const d = PALM[V(o, 2)];
    let py = -1;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, u = 1 - t, x = Math.round(u * u * d.b[0] + 2 * u * t * d.k[0] + t * t * d.t[0]), y = Math.round(u * u * d.b[1] + 2 * u * t * d.k[1] + t * t * d.t[1]);
      if (y === py) continue; py = y;
      const ring = y % 3 === 0;
      c.rect(ring ? 'nat_pbark.0' : 'nat_pbark', x - 1, y, x + (t < .3 ? 1 : 0) + 1, y);
      if (ring) c.px('nat_pbark.1', x - 1, y);
    }
    const cx = d.t[0], cy = d.t[1], s = SW[f], s2 = SW2[f];
    for (const [dx, dy, dr, k] of [[-3, -7, 2, 0], [4, -7, 2, 0], [-7, -4, 4, 1], [8, -4, 4, 1], [-9, 0, 5, 1], [8, 0, 5, 1], [-6, 3, 5, 2], [6, 3, 5, 2]])
      palmFrond(c, cx, cy, dx, dy, dr, k === 0 ? s : k === 1 ? s2 : 0);
    c.ell('nat_coco', cx - .5, cy + 2, 1.5, 1.5); c.ell('nat_coco', cx + 1.8, cy + 2.2, 1.5, 1.5);
    c.ell('nat_palm.1', cx + .2, cy - .2, 2, 1.5);
  });
  // --- sauce: cúpula y cortina de ramas colgantes
  const WILLOW = [
    { t: [10, 13, 16], top: [[7, 10, 5, 4, 2], [17, 10, 5, 4, 2], [12, 7, 6, 5, 3], [8, 5.5, 3.5, 3, 3]], x0: 3, x1: 20, yb: 26 },
    { t: [11, 13, 18], top: [[8, 12, 4.5, 3.5, 2], [16, 12, 4.5, 3.5, 2], [12, 9, 5.5, 4.5, 3]], x0: 5, x1: 18, yb: 25 },
  ];
  N.tree_willow = tree(2, (c, f, o) => {
    const d = WILLOW[V(o, 2)];
    trunk(c, 'nat_bark', d.t[0], d.t[1], d.t[2], 30);
    for (let x = d.x0; x <= d.x1; x++) {
      if (x >= d.t[0] && x <= d.t[1] && x % 2) continue;                         // huecos para ver el tronco
      const yb = d.yb - ((x * 5) % 4) - (Math.abs(x - 11.5) > 6 ? 2 : 0), y0 = 10;
      const tone = x % 3 === 0 ? '.1' : x % 3 === 1 ? '.0' : '.1';
      c.line('nat_willow' + tone, x, y0, x, 17);
      c.at(SW2[f] * (x % 2), 0, () => c.line('nat_willow' + tone, x, 18, x, yb));
      if (x % 3 === 0) c.px('nat_willow.2', x, 12 + (x % 4));
    }
    crown(c, 'nat_willow', d.top, f, 9, 13);
  });
  // --- árbol seco: ramas desnudas
  const DEAD = [
    { t: [11, 13, 13], br: [[12, 14, 7, 8, 1], [7, 8, 4, 4, 0], [7, 8, 9, 4, 0], [13, 15, 17, 9, 1], [17, 9, 19, 5, 0], [17, 9, 15, 5, 0], [12, 13, 12, 6, 1], [12, 6, 13, 3, 0]] },
    { t: [11, 13, 11], br: [[12, 15, 7, 11, 1], [7, 11, 5, 8, 0], [13, 13, 17, 10, 0], [17, 10, 18, 7, 0], [11, 11, 10, 7, 0]] },
  ];
  N.tree_dead = tree(2, (c, f, o) => {
    const v = V(o, 2), d = DEAD[v];
    trunk(c, 'nat_dead', d.t[0], d.t[1], d.t[2], 30);
    for (const [x0, y0, x1, y1, th] of d.br) c.at(y1 < 7 ? SW[f] : 0, 0, () => { c.line('nat_dead', x0, y0, x1, y1); if (th) c.line('nat_dead', x0 + 1, y0, x1 + 1, y1); });
    if (v === 1) { c.rect('nat_dead.2', 11, 10, 13, 10); c.px('nat_dead.0', 12, 10); c.rect('nat_birchm.1', 12, 19, 12, 20); }  // tocón partido y hueco
  });
  // --- árbol anciano: enorme, raíces, runas y luciérnagas mágicas
  N.tree_elder = tree(1, (c, f) => {
    const P2 = [0, 1, 2, 1][f];                                                  // pulso mágico
    // raíces y tronco retorcido
    c.poly('nat_ebark', [[11, 29], [4, 37], [8, 38.5], [13, 34]]); c.poly('nat_ebark', [[20, 29], [28, 36], [24, 38.5], [18, 34]]);
    c.poly('nat_ebark', [[14, 32], [11, 38.5], [16, 38.5], [16, 33]]); c.poly('nat_ebark', [[18, 33], [21, 38.5], [18, 38.5]]);
    c.poly('nat_ebark', [[12, 18], [20, 18], [19, 30], [21, 37], [11, 37], [13, 30]]);
    c.line('nat_ebark.0', 14, 22, 15, 30); c.line('nat_ebark.0', 18, 21, 17, 28); c.line('nat_ebark.2', 13, 22, 13, 27);
    c.rect('nat_ebark.0', 12, 18, 20, 19);
    c.rect('nat_ebark.0', 14, 31, 17, 35); c.rect('nat_ebark.0', 15, 30, 16, 30);    // hueco luminoso
    c.rect(P2 ? 'nat_wisp' : 'nat_magic.3', 15, 32, 16, 34); c.px('nat_magic.2', 14, 34); c.px('nat_magic.2', 17, 34);
    for (const [x, y] of [[16, 24], [17, 25], [16, 26], [13, 28], [19, 31], [12, 33]]) c.px(P2 === 2 ? 'nat_wisp' : 'nat_magic.' + (2 + (P2 & 1)), x, y);   // runas
    // copa
    const BL = [[6.5, 21, 4, 3, 1], [25.5, 21, 4, 3, 1], [16, 20.5, 5, 3, 1], [5.8, 15, 4.3, 4.5, 2], [25.8, 15, 4.2, 4.5, 2], [11, 17, 5, 4, 2], [21, 17, 5, 4, 2],
      [16, 13, 8.5, 6, 2], [9.5, 9, 5.5, 4.5, 3], [22.5, 9, 5.5, 4.5, 3], [16, 5.5, 7, 4.5, 3]];
    crown(c, 'nat_eleaf', BL, f, 11, 17);
    // lianas colgantes con puntas que brillan
    for (const [x, y0, l] of [[4, 22, 4], [9, 23, 3], [23, 23, 4], [28, 22, 3]]) c.at(SW2[f], 0, () => { c.line('nat_eleaf.0', x, y0, x, y0 + l); c.px('nat_magic.' + (2 + (P2 & 1)), x, y0 + l + 1); });
    // flores/frutos luminosos en la copa
    [[9, 7], [21, 6], [15, 11], [25, 13], [6, 14], [19, 17]].forEach(([x, y], i) => c.at(swayY(y, f, 11, 17), 0, () => {
      const on = (P2 + i) % 3 === 0;
      c.px('nat_magic.3', x, y); c.px('nat_magic.2', x + 1, y); c.px('nat_magic.2', x, y + 1); c.px(on ? 'nat_wisp' : 'nat_magic.1', x + 1, y + 1);
    }));
    // aura tenue alrededor de la copa (sólo sobre vacío)
    for (let y = 0; y < 30; y++) for (let x = 0; x < 32; x++) {
      if (c.get(x, y) !== null) continue;
      let n = 0; for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const m = c.get(x + dx, y + dy); if (m && m.startsWith('nat_eleaf')) n++; }
      if (n) c.glow(x, y, 18 + 8 * P2, '#a8ffd0');
    }
    // luciérnagas que suben
    [[3, 12], [28, 8], [10, 3], [29, 22], [2, 27], [21, 1], [25, 30], [6, 33]].forEach(([x, y], i) => {
      const k = (f + i) % 4, yy = y - k;
      if (k === 3) return;
      if (c.get(x, yy) === null) { c.px('nat_wispA', x, yy); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.glow(x + dx, yy + dy, 80, '#d8ffb0'); }
      else c.px('nat_wisp', x, yy);
    });
  }, 32, 40, { ax: 16, ay: 39, render: { shadow: { cx: 16, cy: 37.5, rx: 11, ry: 2, a: 60 } } });
  // --- tocón: 0 corte limpio con anillos, 1 bajo y astillado con musgo
  N.stump = obj(16, 16, {
    variants: 2, render: { shadow: { cx: 8, cy: 14, rx: 5.5, ry: 1.5, a: 60 } }, draw(c, f, o) {
      const v = V(o, 2), t = v ? 10 : 8;
      c.rect('nat_bark', 4, t, 11, 13); c.px('nat_bark', 3, 13); c.px('nat_bark', 12, 13); c.px('nat_bark', 3, 12); c.px('nat_bark', 13, 13);
      c.ell('nat_cut.1', 8, t, 4, 2);
      c.ring('nat_cut.0', 8, t, 2.8, 1.4, .45); c.px('nat_cut.2', 6, t - 1); c.px('nat_cut.0', 8, t);
      c.line('nat_bark.0', 6, t + 2, 6, 12); c.line('nat_bark.0', 9, t + 3, 9, 12);
      if (v) { c.rect('nat_bark', 9, t - 3, 10, t - 1); c.px('nat_bark', 10, t - 4); c.rect('moss', 4, 12, 6, 13); c.px('moss', 11, 13); }   // astilla y musgo
    },
  });

  // =========================================================== MINAS
  const MINE_R = { shadow: { cx: 8, cy: 18, rx: 7, ry: 1.6, a: 60 } };
  const mine = draw => obj(16, 20, { frames: 4, variants: 3, render: MINE_R, draw(c, f, o) { draw(c, f, V(o, 3)); } });
  const ROUND = [
    [[5.5, 11, 4, 4.5, 0], [10.5, 9.5, 4, 5, 1], [8, 15, 6, 3.5, 0], [3.8, 16.5, 2.6, 2, 1], [12.4, 16.5, 2.5, 2, 1]],
    [[8, 9, 5, 5.5, 1], [4.3, 14, 3.2, 3.5, 0], [11.8, 13.5, 3.2, 4, 0], [8, 16, 5, 2.5, 1]],
    [[4.8, 12, 3.8, 4, 1], [10.8, 11, 4, 5, 0], [7.5, 7, 3.5, 3.5, 1], [8, 16, 6.5, 2.5, 0], [13.2, 16.5, 1.8, 2, 1]],
  ];
  // peñasco: masa oscura, cuerpo desplazado arriba-izq, faceta de luz y brillo -> cada roca se separa sola
  function stoneBlob(c, m, x, y, rx, ry) {
    c.ell(m + '.0', x, y, rx, ry);
    c.ell(m + '.1', x - .5, y - .7, rx - .8, ry - .9);
    c.ell(m + '.2', x - rx * .35 - .3, y - ry * .45 - .3, rx * .5, ry * .38);
    c.px(m + '.3', Math.floor(x - rx * .55), Math.floor(y - ry * .6));
  }
  const rocks = (c, L, m0, m1) => { for (const [x, y, rx, ry, k] of L) stoneBlob(c, k ? m1 : m0, x, y, rx, ry); };
  const SPK = [[[6, 8], [11, 13]], [[7, 6], [4, 13]], [[11, 8], [6, 14]]];
  function sparkles(c, f, v) { const [a, b] = SPK[v]; glint(c, a[0], a[1], GL[f]); glint(c, b[0], b[1], GL[(f + 2) % 4]); }
  // --- oro
  const GOLD = [
    [[4, 9, 3], [10, 6, 3], [11, 11, 2], [6, 14, 3], [2, 15, 1], [10, 15, 2], [13, 16, 1], [8, 10, 1]],
    [[6, 5, 3], [10, 9, 3], [3, 11, 2], [12, 13, 2], [6, 13, 3], [4, 16, 1], [9, 16, 1]],
    [[10, 7, 3], [6, 5, 2], [3, 10, 3], [12, 12, 2], [6, 14, 3], [11, 16, 2], [8, 10, 1]],
  ];
  // pepita: sombreado automático del material 'gold' + brillo forzado
  function nugget(c, m, x, y, s) {
    if (s === 1) c.rect(m, x, y, x + 1, y);
    else if (s === 2) { c.rect(m, x, y, x + 1, y + 1); c.px(m, x + 2, y + 1); }
    else { c.rect(m, x, y, x + 2, y + 1); c.rect(m, x + 1, y - 1, x + 2, y + 2); c.px(m + '.3', x + 1, y - 1); }
  }
  N.mine_gold = mine((c, f, v) => {
    rocks(c, ROUND[v], 'nat_ore', 'nat_ore2');
    for (const [x, y, s] of GOLD[v]) nugget(c, 'gold', x, y, s);
    sparkles(c, f, v);
  });
  // --- piedra: bloques tallados claros
  function block(c, m, x0, y0, x1, y1, top) {
    c.rect(m, x0, y0, x1, y1);
    c.rect(m + '.2', x0, y0, x1, y0 + top - 1); c.line(m + '.3', x0 + 1, y0, x1 - 1, y0);
    c.line(m + '.0', x0 + 1, y1, x1, y1);
    c.px(null, x0, y0); c.px(null, x1, y0); c.px(null, x1, y1);
  }
  const STONE = [
    [[2, 7, 8, 12, 2, 0], [8, 5, 14, 11, 2, 1], [1, 12, 6, 17, 2, 1], [6, 11, 13, 18, 2, 0], [12, 14, 14, 18, 1, 1]],
    [[4, 4, 11, 10, 2, 1], [1, 10, 7, 16, 2, 0], [8, 9, 14, 15, 2, 0], [4, 15, 10, 18, 1, 1], [11, 15, 14, 18, 1, 1]],
    [[6, 6, 12, 12, 2, 0], [1, 9, 6, 14, 2, 1], [10, 11, 14, 17, 2, 1], [3, 13, 10, 18, 2, 0], [1, 16, 3, 18, 1, 1]],
  ];
  N.mine_stone = mine((c, f, v) => {
    for (const [x0, y0, x1, y1, t, k] of STONE[v]) {
      block(c, k ? 'nat_quarry2' : 'nat_quarry', x0, y0, x1, y1, t);
      if (y1 - y0 >= 4 && x1 - x0 >= 4) c.line((k ? 'nat_quarry2' : 'nat_quarry') + '.0', x0 + 2, y0 + t + 1, x0 + 3, y0 + t + 2);   // grieta
    }
    sparkles(c, f, v);
  });
  // --- hierro: roca oscura con vetas de óxido y nódulos metálicos
  const IRON = [
    { vein: [[3, 10, 7, 13], [9, 7, 12, 10], [6, 15, 10, 16]], nod: [[5, 9], [11, 11], [8, 14], [13, 16]] },
    { vein: [[5, 7, 10, 11], [2, 14, 5, 13], [10, 14, 13, 12]], nod: [[7, 6], [4, 12], [12, 12], [8, 16]] },
    { vein: [[2, 11, 6, 14], [9, 9, 13, 13], [5, 6, 9, 8]], nod: [[10, 8], [4, 11], [12, 13], [6, 16]] },
  ];
  N.mine_iron = mine((c, f, v) => {
    rocks(c, ROUND[v], 'nat_irock', 'nat_irock2');
    const d = IRON[v];
    for (const [x0, y0, x1, y1] of d.vein) { c.line('nat_rust.1', x0, y0, x1, y1); c.line('nat_rust.0', x0 + 1, y0 + 1, x1, y1 + 1); c.px('nat_rust.2', x0, y0); }
    for (const [x, y] of d.nod) { c.rect('nat_ironm.1', x, y, x + 1, y + 1); c.px('nat_ironm.3', x, y); c.px('nat_ironm.0', x + 1, y + 1); }
    sparkles(c, f, v);
  });
  // --- gemas: cristales morados y azules sobre roca oscura
  function crystal(c, m, x, yb, h, w, ln) {
    for (let y = yb - h; y <= yb; y++) {
      const k = y - (yb - h), sx = x + Math.round(ln * (yb - y) / h);
      if (k === 0) { c.px(m + '.3', sx + (w >> 1), y); continue; }
      for (let i = 0; i < w; i++) c.px(m + (i === 0 ? (k === 1 ? '.3' : '.2') : i === w - 1 ? '.0' : '.1'), sx + i, y);
    }
  }
  const GEMS = [
    { r: [[8, 15, 6, 3.5, 0], [3.8, 16.5, 2.6, 2, 1], [12.2, 16.5, 2.6, 2, 1]], cr: [[6, 14, 9, 3, -1, 0], [9, 14, 11, 3, 1, 1], [3, 15, 5, 2, -1, 1], [11, 15, 6, 2, 1, 0], [8, 16, 4, 2, 0, 0]] },
    { r: [[8, 15.5, 6, 3, 1], [4.3, 13, 3, 3, 0], [11.7, 13, 3, 3, 0]], cr: [[7, 13, 12, 3, 0, 1], [4, 13, 7, 2, -1, 0], [10, 13, 8, 2, 1, 0], [2, 15, 4, 2, -1, 1], [12, 15, 4, 2, 1, 1]] },
    { r: [[7, 15, 6, 3.5, 0], [12, 15.5, 2.8, 2.5, 1]], cr: [[4, 14, 10, 3, -1, 1], [8, 14, 8, 3, 0, 0], [11, 15, 10, 2, 1, 1], [2, 16, 4, 2, -1, 0], [12, 16, 5, 2, 1, 0]] },
  ];
  N.mine_gems = mine((c, f, v) => {
    const d = GEMS[v];
    rocks(c, d.r, 'nat_grock', 'nat_grock2');
    for (const [x, yb, h, w, ln, k] of d.cr) crystal(c, k ? 'nat_gem2' : 'nat_gem', x, yb, h, w, ln);
    const a = [40, 70, 100, 70][f];
    for (const [x, yb, h, w, ln, k] of d.cr) if (h > 7) { const tx = x + ln + (w >> 1), ty = yb - h; c.glow(tx, ty - 1, a, k ? '#7fb0ff' : '#c890ff'); c.glow(tx - 1, ty, a * .7, k ? '#7fb0ff' : '#c890ff'); c.glow(tx + 1, ty, a * .7, k ? '#7fb0ff' : '#c890ff'); }
    const t = d.cr[f % d.cr.length]; glint(c, t[0] + t[4] + (t[3] >> 1), t[1] - t[2] + 1, GL[f] || 1);
  });

  // =========================================================== COMIDA
  const BUSH = [[4.5, 11.5, 3.5, 3, 1], [11.5, 11.5, 3.5, 3, 1], [8, 12.5, 5, 2.5, 1], [5, 8, 3.5, 3, 2], [11, 8, 3.5, 3, 2], [8, 6, 3.5, 3, 3]];
  N.bush_berry = obj(16, 16, {
    variants: 2, render: { shadow: { cx: 8, cy: 14.5, rx: 6, ry: 1.4, a: 60 } }, draw(c, f, o) {
      for (const q of BUSH) blob(c, 'nat_bush', ...q);
      if (V(o, 2) === 0) for (const [x, y] of [[4, 8], [7, 4], [10, 6], [12, 10], [6, 11], [9, 10], [2, 11]]) {
        c.px('nat_berry.2', x, y); c.px('nat_berry.1', x + 1, y); c.px('nat_berry.0', x, y + 1);
      }
    },
  });
  N.fish_spot = obj(16, 16, {
    frames: 4, variants: 1, render: TILE, draw(c, f) {
      const r = [2, 3, 4.5, 5.5][f], m = f < 2 ? 'nat_ripple' : 'nat_ripple2';
      c.ring(m, 8, 10, r, r * .5, ((r - 1) / r) ** 2);
      if (f === 0) { c.rect('nat_waterd.0', 6, 10, 9, 10); c.px('nat_waterd.0', 10, 9); c.px('nat_waterd.0', 10, 11); }
      const fish = (x, y, up) => { c.rect('nat_fish.1', x, y, x + 2, y); c.px('nat_fish.2', x + 1, y - 1 + (up ? 0 : 0)); c.px('nat_fish.0', x - 1, y + (up ? 1 : -1)); c.px('nat_fish.3', x + 2, y); c.px('nat_fish.0', x + 1, y + 1); };
      if (f === 1) fish(7, 8, true);
      if (f === 2) fish(8, 5, false);
      if (f === 3) { for (const [x, y] of [[6, 7], [10, 7], [8, 6], [5, 9], [11, 9]]) c.px('nat_foam', x, y); }
    },
  });

  // =========================================================== DECORACIÓN
  const PET = [['nat_petR', 'nat_petY'], ['nat_petY', 'nat_cut'], ['nat_petW', 'nat_petY'], ['nat_petB', 'nat_petW']];
  N.decor_flowers = obj(16, 16, {
    variants: 4, render: { outline: false }, draw(c, f, o) {
      const v = V(o, 4), [p, q] = PET[v], r = rng(5 + v * 17);
      const pts = [[4, 8], [8, 5], [11, 9], [6, 11], [12, 4]].slice(0, 4 + (v & 1));
      for (const [x0, y0] of pts) {
        const x = x0 + (r() * 2 | 0), y = y0 + (r() * 2 | 0);
        c.line('nat_grassd.0', x, y + 1, x, y + 3); c.px('nat_grassd.1', x - 1, y + 3); c.px('nat_grassd.1', x + 1, y + 2);
        c.px(p + '.1', x - 1, y); c.px(p + '.1', x + 1, y); c.px(p + '.2', x, y - 1); c.px(p + '.0', x, y + 1); c.px(q + '.2', x, y);
      }
    },
  });
  function boulder(c, x, y, rx, ry, m = 'nat_boulder') {
    c.ell(m, x, y, rx, ry);
    c.ell(m + '.2', x - rx * .3, y - ry * .35, rx * .45, ry * .35);
    if (rx > 2.5) c.line(m + '.0', Math.round(x + rx * .1), Math.round(y - ry * .1), Math.round(x + rx * .5), Math.round(y + ry * .3));
  }
  const SH = (cx, cy, rx) => ({ shadow: { cx, cy, rx, ry: 1.2, a: 55 } });
  N.decor_rock_small = obj(16, 16, {
    variants: 3, render: SH(8, 13.5, 4.5), draw(c, f, o) {
      const v = V(o, 3);
      if (v === 0) boulder(c, 8, 11.5, 3.5, 2.8);
      else if (v === 1) { boulder(c, 6, 11.5, 3, 2.5); boulder(c, 11, 12.5, 2, 1.8, 'nat_boulder2'); }
      else { boulder(c, 5, 12.5, 2, 1.5); boulder(c, 9, 11, 2.5, 2, 'nat_boulder2'); boulder(c, 12, 13, 1.6, 1.2); }
    },
  });
  N.decor_rock_big = obj(16, 16, {
    variants: 2, render: SH(8, 14, 7), draw(c, f, o) {
      if (V(o, 2) === 0) { boulder(c, 8, 9.5, 6, 4.8); c.rect('moss', 4, 6, 7, 6); c.rect('moss', 3, 7, 5, 7); }
      else { boulder(c, 6, 10.5, 4.5, 3.8); boulder(c, 11.5, 11.5, 3.5, 3, 'nat_boulder2'); boulder(c, 9, 6.5, 3, 2.5, 'nat_boulder2'); }
    },
  });
  // mata alta: hojas de 2 px en la base que se afinan, puntas claras que se mecen
  N.decor_grass_tuft = obj(16, 16, {
    frames: 4, variants: 2, render: { outline: false }, draw(c, f, o) {
      const v = V(o, 2), B = v ? [[4, 9, -2], [6, 6, -1], [8, 4, 0], [10, 6, 1], [11, 9, 2], [7, 8, 0]] : [[5, 8, -2], [7, 5, -1], [9, 6, 1], [11, 9, 2], [8, 9, 0]];
      c.ell('nat_tuft.0', 8, 13.5, 4.5, 1.2);
      B.forEach(([x, top, lean], i) => {
        const s = (i + f) % 4 < 2 ? SW[f] : SW2[f], tx = x + lean + s, my = Math.round((top + 13) / 2), mx = Math.round(x + lean / 2);
        c.line('nat_tuft.0', x, 13, mx, my); c.line('nat_tuft.1', x + 1, 13, mx + 1, my);
        c.line('nat_tuft.1', mx, my, tx, top + 1); c.px('nat_tuft.2', tx, top + 1); c.px('nat_tuft.3', tx, top);
      });
    },
  });
  N.decor_mushroom = obj(16, 16, {
    variants: 2, render: SH(8, 13.5, 5), draw(c, f, o) {
      if (V(o, 2) === 0) {
        c.rect('nat_stalk', 6, 9, 7, 13); c.ell('nat_cap', 6.5, 8, 3.5, 2.2); c.px('nat_petW.1', 5, 7); c.px('nat_petW.1', 8, 8);
        c.rect('nat_stalk', 11, 11, 11, 13); c.ell('nat_cap', 11.5, 10.5, 2, 1.4); c.px('nat_petW.1', 11, 10);
      } else for (const [x, y, s] of [[5, 11, 2], [9, 9, 2.5], [11, 12, 1.8]]) { c.rect('nat_stalk', x, y, x, 13); c.ell('nat_capb', x + .5, y, s, s * .6); }
    },
  });
  N.decor_bones = obj(16, 16, {
    variants: 1, draw(c) {
      c.line('bone', 3, 13, 9, 11); c.px('bone', 2, 13); c.px('bone', 3, 14); c.px('bone', 9, 10); c.px('bone', 10, 11);
      c.line('bone', 9, 14, 13, 12); c.px('bone', 14, 12); c.px('bone', 8, 14);
      c.ell('bone', 6.5, 9, 2.6, 2.3); c.rect('bone', 5, 10, 8, 11);
      c.px('eye', 5, 9); c.px('eye', 7, 9); c.px('bone.0', 6, 11);
    },
  });
  N.decor_ruin_pillar = obj(16, 24, {
    variants: 2, render: SH(8, 22, 6), draw(c, f, o) {
      if (V(o, 2) === 0) {
        c.rect('nat_marble', 3, 19, 12, 22); c.rect('nat_marble.2', 3, 19, 12, 19);
        c.rect('nat_marble', 5, 5, 10, 18);
        c.line('nat_marble.0', 7, 7, 7, 18); c.line('nat_marble.2', 6, 6, 6, 18);
        c.px(null, 5, 5); c.px(null, 6, 5); c.px(null, 10, 5); c.px(null, 10, 6); c.px(null, 9, 5);
        c.rect('moss', 5, 17, 6, 18); c.px('moss', 9, 18); c.px('moss', 10, 17);
      } else {
        c.rect('nat_marble', 2, 15, 8, 21); c.rect('nat_marble.2', 2, 15, 8, 15); c.px(null, 8, 15); c.px(null, 7, 15);
        c.line('nat_marble.0', 5, 16, 5, 21);
        c.ell('nat_marble', 11.5, 18.5, 3, 3); c.ell('nat_marble.2', 11.5, 18.5, 1.8, 2); c.px('nat_marble.0', 11, 18);
        c.rect('moss', 2, 20, 4, 21);
      }
    },
  });
  N.decor_signpost = obj(16, 20, {
    variants: 1, render: SH(8, 18.5, 3), draw(c) {
      c.rect('wood', 7, 4, 8, 18);
      c.poly('nat_plank', [[2, 5], [12, 5], [14, 6.5], [12, 8], [2, 8]]); c.line('nat_plank.0', 4, 6, 9, 6);
      c.poly('nat_plank', [[4, 10], [13, 10], [13, 12], [4, 12], [2, 11]]); c.line('nat_plank.0', 6, 11, 11, 11);
      c.px('iron', 7, 6); c.px('iron', 8, 11);
    },
  });
  // fogata: anillo de piedras, troncos cruzados, llama en gota con núcleo amarillo, chispas y halo
  const FLAME = [[[8, 3], [5.5, 7], [10.5, 6]], [[7, 2], [10, 5], [5, 6]], [[8, 3], [5, 5.5], [11, 7]], [[9, 2], [6, 6], [10, 5]]];
  N.decor_campfire = obj(16, 16, {
    frames: 4, variants: 1, draw(c, f) {
      for (const [x, y] of [[3, 11.5], [12.5, 11.5], [5, 9.5], [10.5, 9.5]]) c.ell('stone', x, y, 1.6, 1.2);
      c.line('darkwood', 3, 13, 12, 10); c.line('darkwood', 3, 12, 12, 9); c.line('wood', 3, 10, 12, 13); c.line('wood', 4, 9, 12, 12);
      for (const [x, y] of [[5, 13.5], [8, 14], [11, 13.5]]) c.ell('stone', x, y, 1.6, 1.2);
      const [t, l, r] = FLAME[f];
      c.poly('fire', [[4.5, 11.5], [11.5, 11.5], [r[0], r[1] + 2], [r[0], r[1]], [9.5, 7], t, [6.5, 7], [l[0], l[1]], [l[0], l[1] + 2]]);
      c.poly('nat_flame', [[6, 11.5], [10, 11.5], [9.5, 9], [t[0], t[1] + 4], [6.5, 9]]);
      c.px('nat_flame', t[0], t[1] + 3);
      for (const [x, y] of [[8, 1], [5, 4], [11, 4], [4, 7], [12, 7]]) c.glow(x, y, [60, 90, 70, 100][f], '#ffb050');
      c.px('nat_sparkA', [10, 6, 11, 5][f], [2, 1, 0, 2][f]); c.px('nat_sparkA', [5, 10, 6, 9][f], [1, 0, 3, 1][f]);
    },
  });
  // juncos de orilla: hojas en abanico y espadañas que se mecen por fases
  N.decor_reeds = obj(16, 16, {
    frames: 4, variants: 1, render: { outline: false }, draw(c, f) {
      c.line('nat_reed.0', 4, 14, 1, 8); c.line('nat_reed.0', 12, 14, 14, 9); c.line('nat_reed.1', 6, 14, 5, 7); c.line('nat_reed.1', 10, 14, 11, 8);
      for (const [x, top, ph] of [[3, 5, 0], [6, 2, 1], [9, 4, 2], [12, 6, 3]]) {
        const s = [0, 1, 1, 0][(f + ph) % 4];
        c.line('nat_reed.0', x, 14, x, 11); c.line('nat_reed.1', x, 11, x + s, top + 4);
        c.rect('nat_cattail.1', x + s, top, x + s, top + 3); c.px('nat_cattail.2', x + s, top); c.px('nat_cattail.0', x + s, top + 3);
        c.px('nat_reed.2', x + s, top - 1);
      }
      c.line('nat_reed.2', 7, 14, 8, 9); c.line('nat_reed.0', 8, 14, 9, 10);
    },
  });
  N.decor_snowrock = obj(16, 16, {
    variants: 1, render: SH(8, 13.5, 6), draw(c) {
      boulder(c, 8, 10, 6, 4.2, 'rock');
      c.ell('nat_snowt.1', 7, 6.8, 4.2, 1.6); c.rect('nat_snowt.1', 4, 7, 6, 8); c.px('nat_snowt.1', 9, 8);
      c.line('nat_snowt.2', 4, 6, 6, 6); c.px('nat_snowt.0', 10, 7); c.px('nat_snowt.0', 7, 8);
    },
  });

  // =========================================================== TESOROS
  N.treasure_chest = obj(16, 16, {
    frames: 4, variants: 1, render: SH(8, 14.5, 6), draw(c, f, o) {
      c.rect('nat_chest', 3, 8, 12, 14);
      c.rect('gold', 3, 13, 12, 13); c.rect('gold', 4, 8, 4, 14); c.rect('gold', 11, 8, 11, 14);
      if (o.open) {   // tapa echada atrás (se ve su interior), boca oscura y montón de oro que brilla
        c.poly('nat_chest.1', [[3, 2], [13, 2], [12, 6], [4, 6]]); c.line('gold', 3, 2, 12, 2); c.line('nat_chest.0', 4, 4, 11, 4); c.px('gold', 3, 3); c.px('gold', 12, 3);
        c.rect('nat_chest.0', 3, 6, 12, 8);
        c.ell('gold', 7.5, 7.8, 4.2, 1.8); c.px('gold.3', 5, 7); c.px('gold.3', 9, 6); c.px('gold.0', 7, 8); c.px('nat_berry.2', 8, 7); c.px('nat_gem.2', 6, 7);
        c.rect('nat_chest.2', 3, 9, 12, 9); c.line('gold', 3, 9, 12, 9);
        for (const [x, y] of [[2, 6], [13, 6], [1, 4], [14, 4], [2, 9], [13, 9]]) c.glow(x, y, [60, 90, 120, 90][f], '#ffe98a');
      } else {
        c.ell('nat_chest', 7.5, 7.5, 5, 2.5); c.rect('nat_chest', 3, 7, 12, 8);
        c.rect('gold', 3, 8, 12, 8); c.line('gold', 4, 5, 4, 7); c.line('gold', 11, 5, 11, 7);
        c.rect('gold', 7, 8, 8, 10); c.px('black', 7, 9);
      }
      glint(c, [4, 11, 7, 11][f], [13, 8, 8, 13][f], [0, 1, 2, 1][f]);
    },
  });
  N.treasure_relic = obj(16, 20, {
    frames: 4, variants: 1, render: SH(8, 18.5, 5), draw(c, f) {
      c.rect('nat_marble', 4, 14, 11, 18); c.rect('nat_marble.2', 4, 14, 11, 14); c.rect('nat_marble', 3, 17, 12, 18);
      c.line('nat_marble.0', 6, 16, 9, 16);
      const b = [0, -1, -1, 0][f];
      c.at(0, b, () => {
        c.ell('gold', 8, 7.5, 3, 3.2); c.ell('orb', 8, 7.5, 1.8, 2); c.px('glowC', 7, 6);
        c.px('gold', 8, 3); c.px('gold', 8, 12); c.px('gold', 4, 7); c.px('gold', 11, 8);
      });
      const a = [60, 90, 120, 90][f];
      for (const [x, y] of [[8, 2], [3, 7], [12, 7], [5, 4], [11, 4], [5, 11], [11, 11], [8, 13]]) c.glow(x, y + b, a, '#9ff8f2');
      glint(c, 8 + [-2, 2, 0, -1][f], 7 + b + [-1, 1, -2, 2][f], GL[(f + 1) % 4]);
    },
  });
  N.treasure_gold_pile = obj(16, 16, {
    frames: 4, variants: 1, render: SH(8, 14, 6.5), draw(c, f) {
      c.ell('gold', 8, 11.5, 6, 3.2); c.ell('gold', 7.5, 9, 3.5, 2.5);
      for (const [x, y] of [[4, 12], [7, 13], [10, 12], [6, 10], [9, 10], [12, 13]]) { c.px('gold.0', x, y); c.px('gold.2', x - 1, y - 1); }
      c.ell('nat_gem', 10.5, 9, 1.2, 1.2); c.px('nat_gem.3', 10, 8);
      c.rect('gold', 1, 13, 2, 13); c.rect('gold', 13, 11, 14, 11);
      glint(c, [6, 9, 11, 4][f], [8, 10, 12, 11][f], [1, 2, 0, 2][f]);
    },
  });

  // =========================================================== OTROS
  const SZ = o => Math.max(1, Math.min(4, o.size | 0 || 1));
  N.rubble = {
    w: o => SZ(o) * 16, h: o => SZ(o) * 16, ax: o => SZ(o) * 8, ay: o => SZ(o) * 16 - 1, sizes: [1, 2, 3, 4], variants: 4,
    // mancha de ceniza + montones (piedras, ladrillos, vigas quemadas) concentrados en 1–4 focos
    draw(c, f, o) {
      const s = SZ(o), W = s * 16, H = s * 16, r = rng(97 + s * 31 + (o.v | 0) * 7);
      c.ell('nat_dust', W / 2, H / 2 + 1, W / 2 - .5, H / 2 - 1.5);
      c.ell('nat_dust2', W / 2, H / 2 + 1, W / 2 - 3, H / 2 - 4);
      const P = [], foci = [];
      for (let i = 0; i < (s > 1 ? s + 1 : 1); i++) foci.push([W * (.25 + .5 * r()), H * (.3 + .45 * r())]);
      if (s === 1) foci[0] = [8, 9];
      for (let i = 0; i < 4 + s * 6; i++) {                                                   // guijarros sueltos
        const a = r() * 6.283, d = Math.sqrt(r()) * .85, x = W / 2 + Math.cos(a) * d * (W / 2 - 2) | 0, y = H / 2 + 1 + Math.sin(a) * d * (H / 2 - 3) | 0;
        c.px(r() < .6 ? 'stone.2' : 'brick.1', x, y);
      }
      for (let i = 0; i < 3 + s * s * 3; i++) {
        const [fx, fy] = foci[i % foci.length], a = r() * 6.283, d = (.25 + .75 * r()) * r() * (4 + s * 4);
        P.push([Math.max(2, Math.min(W - 3, fx + Math.cos(a) * d)), Math.max(3, Math.min(H - 3, fy + Math.sin(a) * d * .7)), r(), d]);
      }
      P.sort((a, b) => a[1] - b[1]);
      for (const [x, y, k, d] of P) {
        const big = Math.max(.6, 1.6 - d / (4 + s * 3));
        if (k < .5) { const rx = (1.3 + r() * 1.2) * big * Math.min(1.6, .8 + s * .3), ry = rx * .75, m = k < .25 ? 'stone' : 'nat_boulder2'; c.rim((t, q) => t.ell(q, x, y, rx, ry), m); c.px(m + '.3', Math.round(x - rx * .4), Math.round(y - ry * .5)); }
        else if (k < .72) c.rim((t, q) => t.rect(q, x - 1, y - 1, x + 1, y), k < .6 ? 'brick' : 'nat_marble');
        else { const l = 3 + r() * 2.5 * Math.min(2, s), dd = r() < .5 ? 1 : -1; c.rim((t, q) => { t.line(q, x - l / 2, y - dd, x + l / 2, y + dd); t.line(q, x - l / 2, y - dd + 1, x + l / 2, y + dd + 1); }, 'darkwood'); c.px('nat_ember', Math.round(x + l / 2), y + dd); }
      }
    },
  };
  N.scaffold = {
    w: o => SZ(o) * 16, h: o => SZ(o) * 16 + 16, ax: o => SZ(o) * 8, ay: o => SZ(o) * 16 + 15, sizes: [1, 2, 3, 4], variants: 4,
    draw(c, f, o) {
      const s = SZ(o), W = s * 16, H = s * 16 + 16, sp = 10 + 2 * s, xs = [];
      for (let i = 0; i <= s; i++) xs.push(i === 0 ? 1 : i === s ? W - 2 : i * 16);
      c.rect('wood.0', 4, 1, 4, H - 14); c.rect('wood.0', W - 5, 1, W - 5, H - 14);              // postes traseros
      for (const x of xs) c.rect('wood', x, 0, x, H - 1);                                          // postes delanteros
      for (let y = H - 1 - sp, k = 0; y >= 5; y -= sp, k++) {
        c.rect('nat_plank', 0, y, W - 1, y + 1); c.line('nat_plank.0', 0, y + 1, W - 1, y + 1);
        for (let x = 5 + k * 3; x < W - 2; x += 7) c.px('nat_plank.0', x, y);                     // juntas de tablón
        for (let i = 0; i < xs.length - 1; i++) if ((i + k) % 2 === 0) c.line('wood.0', xs[i] + 1, y + 2, xs[i + 1] - 1, Math.min(H - 1, y + sp - 1));
        for (const x of xs) { c.px('string', x, y - 1); c.px('string', x, y + 2); }
      }
      c.rect('nat_plank', Math.min(W - 6, 6), H - 4, Math.min(W - 3, 9), H - 3);                      // tablón suelto
    },
  };
  N.scorch = obj(16, 16, {
    variants: 2, render: TILE, draw(c, f, o) {
      const v = V(o, 2), r = rng(13 + v * 29);
      c.ell('nat_scorchA', 8, 9, 7.5, 5.5);
      for (let i = 0; i < 5; i++) c.ell('nat_scorchA', 2 + r() * 12, 4 + r() * 9, 1.5, 1);
      c.ell('nat_scorchB', 8, 9, 5, 3.5); c.ell('nat_scorchC', 8 - v, 9, 2.6 + v, 1.8);
      for (let i = 0; i < 4; i++) c.px('nat_ash', 4 + r() * 8 | 0, 7 + r() * 5 | 0);
      if (v) { c.px('nat_ember', 7, 9); c.px('nat_ember', 10, 10); }
    },
  });
})();
