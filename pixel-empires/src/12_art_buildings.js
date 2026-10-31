/* =====================================================================
   Pixel Empires — Edificios (PE.ART.buildings)
   5 razas × 17 tipos + 4 neutrales. Vista 3/4 frontal: fachada sur + techo.
   w = huella×16; la fila inferior es el borde inferior de la huella.
   Estructura: utilidades (texturas, banderas, humo, props) → kit por raza
   (hall = cuerpo con muro+techo, puerta, ventana, torre...) → constructores
   por tipo (base + techo + elemento identificativo) → registro.
   Animación f = 0..3 (granja: etapa de crecimiento; puerta: 0 cerrada 1 abierta).
   ===================================================================== */
(() => {
'use strict';
const B = PE.ART.buildings;
PE.addMats({
  bld_elfwood: '#cdb07e', bld_bark: '#8c8578', bld_moon: '#d3d0c2', bld_elfglass: '#62e0a6',
  bld_granite: '#7d7984', bld_slate: '#4f5a74', bld_hide: '#b48c5e', bld_turf: '#6c9440',
  bld_logend: '#dbb47a', bld_glass: '#78b4ff', bld_pumpkin: '#e0832c', bld_cabbage: '#93c862',
  bld_mush: '#c94a3c', bld_grape: '#7b3f9e', bld_horse: '#b0703e', bld_rag: '#9a8a6a', bld_elfleaf: '#3f9a78',
});
PE.addFixed({ bld_hole: '#221a2b', bld_hole2: '#33263a' });
PE.addEmissive('bld_elfglass', 'bld_glass');

// ------------------------------------------------------------- utilidades
const PI = Math.PI, md = (a, n) => ((a % n) + n) % n, T = (m, k) => m + '.' + k;
const hs = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const PUL = [1, 2, 3, 2];                       // pulso de runas por frame
// Textura: fn(x,y) -> tono 0..3 | null, sólo sobre píxeles con material m exacto (sin tono)
function tex(c, m, x0, y0, x1, y1, fn) {
  for (let y = Math.round(y0); y <= y1; y++) for (let x = Math.round(x0); x <= x1; x++)
    if (c.get(x + c.ox, y + c.oy) === m) { const k = fn(x, y); if (k != null) c.px(T(m, k), x, y); }
}
const R = (c, m, x0, y0, x1, y1, fn) => { c.rect(m, x0, y0, x1, y1); if (fn) tex(c, m, x0, y0, x1, y1, fn); };
// trapecio: base yb (incl.) de xl a xr, cima yt con entrantes iL/iR
const trap = (c, m, xl, xr, yb, yt, iL, iR = iL) => c.poly(m, [[xl, yb + 1], [xr + 1, yb + 1], [xr + 1 - iR, yt], [xl + iL, yt]]);
const P = {   // patrones de textura
  brick: (ox, oy, bw, bh, hl = 3) => (x, y) => {
    const r = y - oy, k = Math.floor(r / bh), rr = md(r, bh), sx = x - ox + (k & 1) * (bw >> 1), xx = md(sx, bw);
    if (rr === bh - 1 || xx === bw - 1) return 0;
    if (hl && rr === 0 && xx === 0 && hs(k, Math.floor(sx / bw)) % hl === 0) return 2;
    return null;
  },
  tile: (ox, oy, bw = 4, bh = 3) => (x, y) => {      // tejas planas en hiladas escalonadas
    const r = y - oy, k = Math.floor(r / bh), rr = md(r, bh), xx = md(x - ox + (k & 1) * (bw >> 1), bw);
    if (rr === bh - 1) return 0;
    if (rr === bh - 2 && xx === bw - 1) return 0;
    return rr === 0 && xx < 2 ? 2 : null;
  },
  scale: (ox, oy, bw = 4, bh = 3) => (x, y) => {     // escamas de hoja: puntas colgantes escalonadas
    const r = y - oy, k = Math.floor(r / bh), rr = md(r, bh), j = Math.floor((x - ox + (k & 1) * (bw >> 1)) / bw), xx = md(x - ox + (k & 1) * (bw >> 1), bw);
    const v = hs(j, k) % 4;
    if (rr === bh - 1) return xx === 1 ? (v ? 1 : 0) : 0;
    if (rr === 0) return xx === 1 ? 3 : xx === 2 ? 2 : (xx === 0 ? 1 : null);
    return xx === 1 ? 2 : xx === bw - 1 ? 0 : null;
  },
  slate: (ox, oy, bw = 6, bh = 3) => (x, y) => {     // losas de pizarra
    const r = y - oy, k = Math.floor(r / bh), rr = md(r, bh), xx = md(x - ox + (k & 1) * (bw >> 1), bw);
    if (rr === bh - 1) return 0;
    if (xx === bw - 1) return 0;
    if (rr === 0) return xx < 3 ? 2 : null;
    return null;
  },
  thatch: (oy) => (x, y) => {                       // paja: hileras con flecos
    const r = y - oy, rr = md(r, 4), k = Math.floor(r / 4), v = hs(x, k) % 6;
    if (rr === 3) return v < 4 ? 0 : null;
    if (v === 0) return 0;
    if (v === 1 && rr < 2) return 2;
    return rr === 0 ? 2 : null;
  },
  plankV: (ox, pw = 3) => (x, y) => md(x - ox, pw) === pw - 1 ? 0 : (hs(x, y >> 2) % 23 === 0 ? 0 : null),
  plankH: (oy, ph = 3) => (x, y) => md(y - oy, ph) === ph - 1 ? 0 : md(y - oy, ph) === 0 && hs(x >> 2, y) % 3 === 0 ? 2 : null,
  logV: (ox, lw = 3) => (x) => { const xx = md(x - ox, lw); return xx === 0 ? 2 : xx === lw - 1 ? 0 : null; },
  logH: (oy, lh = 3) => (x, y) => { const rr = md(y - oy, lh); return rr === 0 ? 2 : rr === lh - 1 ? 0 : (hs(x >> 1, y) % 9 === 0 ? 0 : null); },
  turf: (ox, oy) => (x, y) => {                     // matas de hierba
    const r = y - oy, k = Math.floor(r / 3), rr = md(r, 3), xx = md(x - ox + (k & 1) * 3, 6);
    if (rr === 0 && xx === 2) return 3;
    if (rr === 1 && (xx === 1 || xx === 3)) return 2;
    if (rr === 2 && xx === 2) return 0;
    return null;
  },
  // sillares irregulares grandes (gigantes): hileras de alto bh, anchos variables
  stones: (ox, oy, bh = 5, wmin = 4, wmax = 8) => {
    const rows = {};
    const cuts = k => rows[k] || (rows[k] = (() => { const a = []; let x = -(hs(k, 7) % wmax); while (x < 200) { a.push(x); x += wmin + hs(k, x + 99) % (wmax - wmin + 1); } return a; })());
    return (x, y) => {
      const r = y - oy, k = Math.floor(r / bh), rr = md(r, bh), sx = x - ox, cs = cuts(k);
      let i = 0; while (i + 1 < cs.length && cs[i + 1] <= sx) i++;
      const a = cs[i], b = cs[i + 1] - 1, xx = sx - a;
      if (rr === bh - 1 || sx === b) return 0;
      if ((rr === 0 && (xx === 0 || sx === b - 1)) || (rr === bh - 2 && (xx === 0 || sx === b - 1))) return 0;
      if (rr === 0 && xx > 0 && xx < 3) return 2;
      if (rr === 1 && xx === 1) return 2;
      return null;
    };
  },
};

// ------------------------------------------------------------- elementos animados
// Bandera en asta: punta en (x,y), tela de len×hgt hacia dir; ondea con f
function flag(c, x, y, f, o = {}) {
  const L = o.len || 7, H = o.hgt || 4, d = o.dir || 1, m = o.m || 'team';
  c.line(o.pole || 'darkwood', x, y, x, y + (o.ph || 10));
  if (o.tip !== false) c.px(o.tip || 'gold', x, y - 1);
  for (let i = 1; i <= L; i++) {
    const a = i * 0.85 - f * PI / 2, amp = Math.min(1, i / 3), dy = Math.round(Math.sin(a) * amp), sl = Math.cos(a);
    const tn = sl > 0.4 ? 2 : sl < -0.4 ? 0 : 1;
    for (let j = 0; j < H; j++) {
      if (o.tail && i >= L - 1 && j > 0 && j < H - 1 && (i === L || j === H >> 1)) continue;
      c.px(T(m, j === 0 && tn === 1 ? 2 : tn), x + i * d, y + j + dy);
    }
  }
}
// Gallardete triangular
function pennant(c, x, y, f, o = {}) {
  const L = o.len || 6, d = o.dir || 1, m = o.m || 'team';
  c.line(o.pole || 'darkwood', x, y, x, y + (o.ph || 6));
  for (let i = 1; i <= L; i++) {
    const hh = Math.max(1, Math.round(3 * (1 - (i - 1) / L))), dy = Math.round(Math.sin(i * 0.9 - f * PI / 2) * Math.min(1, i / 3));
    for (let j = 0; j < hh; j++) c.px(T(m, j === 0 ? 2 : 1), x + i * d, y + j + dy + (3 - hh) / 2 | 0);
  }
}
// Estandarte colgante: barra en y0, tela w×h con punta en V, se mece abajo
function banner(c, x0, y0, w, h, f, o = {}) {
  const m = o.m || 'team', sw = [0, 1, 0, -1][f] * (o.sway ?? 1);
  c.rect(o.rod || 'gold', x0 - 1, y0, x0 + w, y0);
  for (let j = 1; j <= h; j++) {
    const dx = Math.round(sw * j / h);
    c.rect(m, x0 + dx, y0 + j, x0 + w - 1 + dx, y0 + j);
  }
  const dx = Math.round(sw);
  for (let i = 0; i < w; i++) { const dd = Math.min(i, w - 1 - i); for (let j = 1; j <= dd + 1 && j <= 2; j++) c.px(m, x0 + dx + i, y0 + h + j); }
  c.px(null, x0 + dx + (w >> 1), y0 + h + 1); if (!(w & 1)) c.px(null, x0 + dx + (w >> 1) - 1, y0 + h + 1);
  if (o.emb) o.emb(x0 + dx * 0.5 + (w - 1) / 2, y0 + 1 + (h >> 1));
}
// Humo: bocanadas semitransparentes que suben 1 px por frame (bucle de 4)
function smoke(c, x, y, f, o = {}) {
  const n = o.n || 4, col = o.col || '#d4d0dc', A = o.a || 150;
  for (let k = 0; k < n; k++) {
    const d = k * 4 + f, r = 0.8 + d * (o.grow || 0.14), a = A * (1 - d / (n * 4 + 1));
    const px = x + Math.sin(d * 0.5) * 1.2 + d * 0.18, py = y - d;
    for (let yy = Math.floor(py - r - 1); yy <= py + r + 1; yy++) for (let xx = Math.floor(px - r - 1); xx <= px + r + 1; xx++) {
      const q = ((xx + .5 - px) ** 2 + (yy + .5 - py) ** 2) / (r * r);
      if (q <= 1) c.glow(xx, yy, a * (q < 0.5 ? 1 : 0.7), col);
    }
  }
}
// Chispas/brasas que suben
function embers(c, x, y, f, n = 3) {
  for (let k = 0; k < n; k++) { const d = md(f * 2 + k * 3, 10); c.glow(Math.round(x + Math.sin(k * 2.1 + d * 0.6) * 2), y - d, 240 - d * 18, k & 1 ? '#ffd060' : '#ff7a30'); }
}
// Llama (material fire) de base en (cx, yb)
function flame(c, cx, yb, f, s = 1) {
  const sh = [[0, -1, 1, 0], [1, 0, -1, 1], [0, 1, 0, -1], [-1, 0, 1, 0]][f];
  const w = s >= 2 ? 2 : 1;
  c.rect('fire', cx - w, yb - 1, cx + w, yb);
  c.rect('fire', cx - w + 1, yb - 2 - s, cx + w - 1, yb - 1);
  c.px('fire', cx + sh[0], yb - 3 - s); if (s >= 2) { c.px('fire', cx + sh[1] - 1, yb - 3); c.px('fire', cx + sh[2] + 1, yb - 4); }
  c.px('fire', cx + sh[3], yb - 2 - s - (f & 1));
  c.px('glowY', cx, yb - 1); if (s >= 2) c.px('glowY', cx, yb - 2);
}
function torch(c, x, y, f) { c.rect('darkwood', x, y, x, y + 2); c.px('iron', x, y); flame(c, x, y - 1, f, 1); }
// Halo de luz (sobre fondo vacío)
function aura(c, cx, cy, r, a, col) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x + .5 - cx, y + .5 - cy) / r; if (d <= 1) c.glow(x, y, a * (1 - d), col);
  }
}
// Rueda dentada (gira 1 diente cada 4 frames)
function gear(c, cx, cy, r, f, m = 'iron', n = 8) {
  const a0 = f * (2 * PI / n) / 4;
  for (let k = 0; k < n; k++) { const a = a0 + k * 2 * PI / n; c.rect(m, cx + Math.cos(a) * r - .5, cy + Math.sin(a) * r - .5, cx + Math.cos(a) * r + .5, cy + Math.sin(a) * r + .5); }
  c.ell(m, cx, cy, r - .6, r - .6);
  c.ring(T(m, 0), cx, cy, r - 1.6, r - 1.6, 0.35);
  for (let k = 0; k < 4; k++) { const a = a0 + k * PI / 2 + PI / 4; c.line(m, cx, cy, cx + Math.cos(a) * (r - 1.6), cy + Math.sin(a) * (r - 1.6)); }
  c.ell(T(m, 2), cx, cy, 1.1, 1.1);
}
// Aspas de molino (4), giran 22.5° por frame: tela clara en bastidor con travesaños
function sails(c, cx, cy, Rr, f, o = {}) {
  const sp = o.spar || 'darkwood', fr = o.frame || 'wood', cl = o.cloth || 'cloth', w0 = o.w0 || 2, w1 = o.w1 || 4, r0 = o.r0 || 3;
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + f * PI / 8 + (o.a0 || 0), dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const W = s => w0 + (w1 - w0) * (s - r0) / (Rr - r0);
    c.poly(T(cl, dy < -0.3 ? 3 : dy > 0.3 ? 1 : 2), [[cx + dx * r0, cy + dy * r0], [cx + dx * Rr, cy + dy * Rr], [cx + dx * Rr + px * w1, cy + dy * Rr + py * w1], [cx + dx * r0 + px * w0, cy + dy * r0 + py * w0]]);
    if (o.lattice !== false) for (let s = r0 + 3; s <= Rr; s += 4) c.line(T(fr, 0), cx + dx * s, cy + dy * s, cx + dx * s + px * W(s), cy + dy * s + py * W(s));
    c.line(T(fr, 1), cx + dx * r0 + px * w0, cy + dy * r0 + py * w0, cx + dx * Rr + px * w1, cy + dy * Rr + py * w1);
    c.line(sp, cx, cy, cx + dx * (Rr + 1), cy + dy * (Rr + 1));
  }
  c.ell(o.hub || 'darkwood', cx, cy, 1.6, 1.6); c.px(T(o.hub || 'darkwood', 3), cx - .5, cy - .5);
}
// Rueda hidráulica: paletas que giran y agua que cae
function waterwheel(c, cx, cy, r, f, m = 'wood') {
  const a0 = f * (PI / 4) / 4;
  c.ring(m, cx, cy, r, r, 0.72);
  for (let k = 0; k < 8; k++) {
    const a = a0 + k * PI / 4, ca = Math.cos(a), sa = Math.sin(a);
    c.line(T(m, 0), cx + ca * 1.5, cy + sa * 1.5, cx + ca * (r - 1), cy + sa * (r - 1));
    c.rect(T(m, 2), cx + ca * (r + .6) - .5, cy + sa * (r + .6) - .5, cx + ca * (r + .6) + .5, cy + sa * (r + .6) + .5);
  }
  c.ell('iron', cx, cy, 1.5, 1.5);
}

// ------------------------------------------------------------- props
function barrel(c, x, yb, m = 'wood') {
  c.rect(m, x, yb - 5, x + 4, yb); c.px(null, x, yb - 5); c.px(null, x + 4, yb - 5); c.px(null, x, yb); c.px(null, x + 4, yb);
  c.rect(T('iron', 1), x, yb - 4, x + 4, yb - 4); c.rect(T('iron', 0), x, yb - 1, x + 4, yb - 1);
  c.rect(T(m, 2), x + 1, yb - 5, x + 3, yb - 5); c.px(T(m, 3), x + 1, yb - 3);
}
function crate(c, x, yb, s = 5, m = 'wood') {
  c.rect(m, x, yb - s + 1, x + s - 1, yb); c.rect(T(m, 0), x + 1, yb - s + 2, x + s - 2, yb - 1);
  c.line(m, x + 1, yb - 1, x + s - 2, yb - s + 2); c.rect(T(m, 2), x, yb - s + 1, x + s - 1, yb - s + 1);
}
function sack(c, x, yb, m = 'sack') { c.ell(m, x + 2, yb - 1.5, 2.6, 2.2); c.rect(m, x + 1, yb - 4, x + 3, yb - 3); c.px(T('leather', 0), x + 2, yb - 4); c.px(T(m, 3), x + 1, yb - 2); }
function hay(c, x, yb, w = 7, h = 5) {
  c.rect('straw', x, yb - h + 1, x + w - 1, yb); c.px(null, x, yb - h + 1); c.px(null, x + w - 1, yb - h + 1);
  tex(c, 'straw', x, yb - h + 1, x + w - 1, yb, (xx, yy) => (hs(xx, yy) % 4 === 0 ? 2 : hs(xx, yy) % 5 === 0 ? 0 : null));
  c.rect(T('straw', 3), x + 1, yb - h + 1, x + w - 2, yb - h + 1);
  c.line(T('thatch', 0), x + 2, yb - h + 1, x + 2, yb); c.line(T('thatch', 0), x + w - 3, yb - h + 1, x + w - 3, yb);
}
// Pila de troncos vista de frente (testas)
function logEnds(c, x, yb, n, m = 'darkwood') {
  for (let row = 0; row < n; row++) for (let i = 0; i < n - row; i++) {
    const cx = x + 2 + i * 4 + row * 2, cy = yb - 1.5 - row * 3.4;
    c.ell(m, cx, cy, 2.2, 2.1); c.ell('bld_logend', cx, cy, 1.4, 1.3); c.px(T('bld_logend', 0), cx - .5, cy - .5);
  }
}
// Tronco tumbado (vista lateral)
function logSide(c, x0, x1, yb, m = 'wood', d = 3) {
  R(c, m, x0, yb - d + 1, x1, yb, P.logH(yb - d + 1, d));
  c.rect('bld_logend', x1, yb - d + 1, x1, yb); c.px(T('bld_logend', 0), x1, yb - (d >> 1));
}
// Diana de tiro con arco sobre caballete
function target(c, cx, cy, f, m = 'straw') {
  c.line('darkwood', cx - 3, cy + 6, cx - 1, cy); c.line('darkwood', cx + 3, cy + 6, cx + 1, cy); c.line('darkwood', cx + 1, cy + 7, cx + 1, cy + 2);
  c.ell(m, cx + .5, cy + .5, 4.7, 4.7); c.ell(T('cloth', 2), cx + .5, cy + .5, 3.7, 3.7); c.ell(T('red', 1), cx + .5, cy + .5, 2.6, 2.6); c.ell(T('cloth', 3), cx + .5, cy + .5, 1.5, 1.5); c.px(T('red', 2), cx, cy);
  c.line('darkwood', cx + 2, cy - 1, cx + 5, cy - 3); c.px('feather', cx + 5, cy - 3); c.px('feather', cx + 6, cy - 3);
  c.line('darkwood', cx - 1, cy + 2, cx - 4, cy + 3); c.px('feather', cx - 4, cy + 3); c.px('feather', cx - 5, cy + 3);
}
// Maniquí de entrenamiento: poste, brazos de palo, cuerpo de paja con peto del equipo, cabeza de saco
function dummy(c, x, yb, f, m = 'straw') {
  c.line('darkwood', x - 2, yb, x + 2, yb); c.rect('darkwood', x, yb - 4, x, yb);
  c.line('wood', x - 5, yb - 10, x + 5, yb - 10); c.px(m, x - 6, yb - 11); c.px(m, x - 6, yb - 9); c.px(m, x + 6, yb - 11); c.px(m, x + 6, yb - 9);
  c.rect(m, x - 2, yb - 11, x + 2, yb - 4); c.rect('team', x - 2, yb - 10, x + 2, yb - 6); c.rect(T('team', 0), x - 2, yb - 6, x + 2, yb - 6);
  c.line('leather', x - 2, yb - 8, x + 2, yb - 8); c.px(T(m, 0), x - 1, yb - 4); c.px(T(m, 0), x + 1, yb - 4);
  c.ell('sack', x + .5, yb - 13, 2.2, 2.2); c.px('ol', x - 1, yb - 13); c.px('ol', x + 1, yb - 13); c.px(T('leather', 0), x, yb - 15);
}
// Yunque sobre tocón
function anvil(c, x, yb) {
  c.rect('darkwood', x + 1, yb - 2, x + 5, yb); c.rect('bld_logend', x + 1, yb - 2, x + 5, yb - 2);
  c.rect('iron', x + 2, yb - 4, x + 4, yb - 3); c.rect('iron', x, yb - 6, x + 6, yb - 5); c.px('iron', x - 1, yb - 6);
  c.rect(T('iron', 3), x + 1, yb - 6, x + 5, yb - 6);
}
// Vagoneta con mineral
function cart(c, x, yb, ore = 'gold') {
  c.ell(ore, x + 4, yb - 5, 3.4, 2); c.px(T(ore, 3), x + 3, yb - 6); c.px(T(ore, 3), x + 5, yb - 5);
  c.rect('iron', x, yb - 4, x + 8, yb - 1); c.rect(T('iron', 2), x, yb - 4, x + 8, yb - 4); c.rect(T('iron', 0), x + 1, yb - 2, x + 7, yb - 2);
  c.ell('darkwood', x + 2, yb, 1.3, 1.3); c.ell('darkwood', x + 6.5, yb, 1.3, 1.3);
}
function rails(c, x0, x1, y) { c.line('iron', x0, y, x1, y); for (let x = x0 + 1; x < x1; x += 3) c.px('darkwood', x, y + 1); }
// Escudo con espadas cruzadas (emblema de cuartel)
function crossed(c, cx, cy, o = {}) {
  c.line(o.blade || 'blade', cx - 4, cy - 4, cx + 4, cy + 4); c.line(o.blade || 'blade', cx + 4, cy - 4, cx - 4, cy + 4);
  c.px('gold', cx - 4, cy + 4); c.px('gold', cx + 4, cy + 4);
  c.rect(o.shield || 'team', cx - 2, cy - 2, cx + 2, cy + 1); c.rect(o.shield || 'team', cx - 1, cy + 2, cx + 1, cy + 2); c.px(o.shield || 'team', cx, cy + 3);
  c.px('gold', cx, cy - 1); c.px('gold', cx, cy);
}
// Herradura
function shoe(c, cx, cy, m = 'iron') { c.ring(T(m, 2), cx, cy, 3, 3, 0.2, (x, y) => y < cy + 1); c.rect(T(m, 1), cx - 3, cy + 1, cx - 2, cy + 2); c.rect(T(m, 0), cx + 1, cy + 1, cx + 2, cy + 2); c.px(T(m, 3), cx - 2, cy - 2); }
// Campana (oscila con f)
function bell(c, cx, y, f, m = 'gold') {
  const d = [0, 1, 0, -1][f];
  c.line('darkwood', cx - 3, y, cx + 3, y);
  c.at(d, 0, () => { c.rect(m, cx - 1, y + 1, cx + 1, y + 2); c.rect(m, cx - 2, y + 3, cx + 2, y + 4); c.rect(m, cx - 3, y + 5, cx + 3, y + 5); c.px('iron', cx, y + 6); c.px(T(m, 3), cx - 1, y + 2); });
}
// Calavera 3×3
function skull(c, x, y, m = 'bone') { c.rect(m, x, y, x + 2, y + 1); c.px(m, x + 1, y + 2); c.px('ol', x, y + 1); c.px('ol', x + 2, y + 1); }
// Mercancías sobre mostrador
function goods(c, x0, x1, y) {
  const g = ['red', 'gold', 'bld_cabbage', 'bld_pumpkin', 'bld_grape', 'cloth'];
  for (let x = x0, i = 0; x <= x1 - 1; x += 3, i++) { const m = g[hs(x, y) % g.length]; c.rect(m, x, y - 1, x + 1, y); c.px(T(m, 3), x, y - 1); }
}
// Toldo a rayas (a / b) con borde festoneado; trapecio de y0 a y1
function awning(c, x0, x1, y0, y1, o = {}) {
  const a = o.a || 'team', b = o.b || 'cloth', sw = o.sw || 3;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0), xl = Math.round(x0 + 1 - t * 2), xr = Math.round(x1 - 1 + t * 2);
    for (let x = xl; x <= xr; x++) c.px(md(x - x0, sw * 2) < sw ? a : b, x, y);
  }
  for (let x = x0 - 1; x <= x1 + 1; x++) if (md(x - x0, sw) !== sw - 1) c.px(md(x - x0, sw * 2) < sw ? T(a, 0) : T(b, 0), x, y1 + 1);
}
// Almenas: merlones mw de ancho, separación g
function battl(c, m, x0, x1, y, mw = 2, g = 2, mh = 2) { for (let x = x0; x <= x1; x += mw + g) c.rect(m, x, y - mh + 1, Math.min(x + mw - 1, x1), y); }
function fenceH(c, x0, x1, y, m = 'wood') { c.line(m, x0, y - 2, x1, y - 2); c.line(T(m, 0), x0, y - 1, x1, y - 1); for (let x = x0; x <= x1; x += 4) c.rect(T(m, 2), x, y - 3, x, y); }
function fenceV(c, x, y0, y1, m = 'wood') { c.line(m, x, y0, x, y1); for (let y = y0; y <= y1; y += 4) c.rect(T(m, 2), x, y - 2, x, y); }

// Puerta de establo partida (abajo tablones con aspa, arriba abierta con caballo o cerrada)
function sdoor(c, K, cx, yb, w, h, horse, f) {
  const x0 = Math.round(cx - w / 2), x1 = x0 + w - 1, yt = yb - h + 1, ym = yt + (h >> 1) - 1;
  c.rect(K.beam, x0 - 1, yt - 1, x1 + 1, yb);
  R(c, K.wood, x0, ym + 1, x1, yb, P.plankV(x0, 2)); c.line(K.beam, x0, ym + 1, x1, yb); c.line(K.beam, x1, ym + 1, x0, yb);
  c.rect(T(K.beam, 2), x0 - 1, ym + 1, x1 + 1, ym + 1);
  if (horse) {
    c.rect('bld_hole', x0, yt, x1, ym);
    const hx = x0 + (w >> 1), b = f === 2 ? 1 : 0;
    c.at(0, b, () => {   // cabeza de caballo asomada de frente
      c.px(T(horse, 0), hx - 2, yt); c.px(T(horse, 0), hx + 1, yt);
      c.rect(horse, hx - 2, yt + 1, hx + 1, yt + 3); c.rect(horse, hx - 1, yt + 4, hx + 1, ym + 2); c.px(horse, hx - 2, yt + 4);
      c.rect(T(horse, 0), hx - 1, ym + 2, hx + 1, ym + 3); c.px(T('cloth', 3), hx, yt + 2); c.px(T('cloth', 2), hx, yt + 3);
      c.px('eye', hx - 2, yt + 2); c.px('eye', hx + 1, yt + 2); c.rect('hair', hx - 1, yt, hx, yt);
    });
  } else { R(c, K.wood, x0, yt, x1, ym, P.plankV(x0, 2)); c.line(K.beam, x0, yt, x1, ym); }
}
// Mostrador de puesto con mercancías
function counter(c, K, x0, x1, y) { R(c, K.wood, x0, y, x1, y + 4, P.plankH(y, 2)); c.rect(T(K.wood, 2), x0, y, x1, y); goods(c, x0 + 1, x1 - 1, y - 1); }

// ------------------------------------------------------------- kit: HUMANOS
// Piedra clara, entramado de madera y yeso, tejas del equipo, estandartes.
const HUM = {
  id: 'human', wood: 'wood', beam: 'darkwood', stone: 'stone', metal: 'iron', blade: 'blade', horse: 'bld_horse',
  timber(c, x0, y0, x1, y1, st = 9) {
    c.rect('plaster', x0, y0, x1, y1);
    c.rect('darkwood', x0, y0, x1, y0); c.rect('darkwood', x0, y1, x1, y1);
    const n = Math.max(1, Math.round((x1 - x0) / st)), xs = [];
    for (let i = 0; i <= n; i++) xs.push(Math.round(x0 + (x1 - x0) * i / n));
    xs.forEach(x => c.rect('darkwood', x, y0, x, y1));
    if (y1 - y0 > 4) { c.line('darkwood', xs[0], y1, xs[1], y0); c.line('darkwood', xs[n], y1, xs[n - 1], y0); }
  },
  stonewall(c, x0, y0, x1, y1) { R(c, 'stone', x0, y0, x1, y1, P.brick(x0, y0, 5, 3)); },
  roof(c, xl, xr, yb, yt, o = {}) {
    const m = o.m || 'team', ins = o.ins ?? Math.round((yb - yt) * 0.45);
    trap(c, m, xl, xr, yb, yt, ins);
    tex(c, m, xl, yt, xr, yb, m === 'thatch' ? P.thatch(yb + 1) : P.tile(xl, yb + 1));
    if (xr - xl - 2 * ins > 0) c.rect(T(o.ridge || 'darkwood', 1), xl + ins, yt, xr - ins, yt);
    c.rect(T(m, 0), xl, yb, xr, yb);
  },
  door(c, cx, yb, w, h, o = {}) {
    const x0 = Math.round(cx - w / 2 + .01), x1 = x0 + w - 1, yt = yb - h + 1;
    c.rect('darkwood', x0 - 1, yt - 1, x1 + 1, yb);
    if (o.open) c.rect('bld_hole', x0, yt, x1, yb);
    else {
      R(c, 'wood', x0, yt, x1, yb, P.plankV(x0, 2));
      c.rect(T('iron', 1), x0, yt + 2, x1 - 1, yt + 2); c.rect(T('iron', 1), x0, yb - 2, x1 - 1, yb - 2); c.px('gold', x1 - 1, yt + (h >> 1) + 1);
    }
    if (w >= 4) { c.px('darkwood', x0, yt); c.px('darkwood', x1, yt); }
    return { x0, x1, yt };
  },
  win(c, x, y, w = 3, h = 4, o = {}) {
    c.rect('darkwood', x - 1, y - 1, x + w, y + h); c.rect('window', x, y, x + w - 1, y + h - 1);
    if (w >= 3) c.rect('darkwood', x + (w >> 1), y, x + (w >> 1), y + h - 1);
    c.rect(T('stone', 2), x - 1, y + h, x + w, y + h);
    if (o.sh) { c.rect(T('team', 1), x - 2, y - 1, x - 2, y + h - 1); c.rect(T('team', 0), x + w + 1, y - 1, x + w + 1, y + h - 1); }
  },
  chim(c, x, yt, yb, f, o = {}) {
    const w = o.w || 4;
    R(c, 'stone', x, yt, x + w - 1, yb, P.brick(x, yt, 4, 2, 0)); c.rect(T('stone', 2), x - 1, yt, x + w, yt); c.rect(T('stone', 0), x, yt + 1, x + w - 1, yt + 1);
    smoke(c, x + w / 2 - .5, yt - 1, f, o);
  },
  gable(c, xc, hw, gb, h, o = {}) {   // hastial frontal triangular con entramado y bordes de teja
    const gt = gb - h, rm = o.roof || 'team';
    c.poly('plaster', [[xc - hw, gb + 1], [xc + hw + 1, gb + 1], [xc + .5, gt + .5]]);
    c.line('darkwood', xc, gt + 2, xc, gb); c.rect('darkwood', xc - hw, gb, xc + hw, gb);
    for (let i = 0; i < 2; i++) { c.line(T(rm, 2), xc - hw - 1 + i, gb, xc, gt - 1 + i); c.line(T(rm, 0), xc + hw + 1 - i, gb, xc, gt - 1 + i); }
    c.px(T(rm, 3), xc, gt - 1);
    if (o.win) HUM.win(c, xc - 1, gb - 5, 3, 3);
  },
  // Cuerpo principal: muro (piedra abajo, entramado arriba) + tejado a cuatro aguas
  hall(c, x0, x1, yb, wh, rh, o = {}) {
    const wy = yb - wh + 1, f = o.f || 0, sh = o.sh ?? 3, cx = (x0 + x1) / 2;
    if (sh < wh) HUM.timber(c, x0, wy, x1, yb - sh, o.st || 9);
    HUM.stonewall(c, x0, Math.max(wy, yb - sh + 1), x1, yb);
    c.rect(T('darkwood', 0), x0, wy, x1, wy);
    HUM.roof(c, x0 - 2, x1 + 2, wy - 1, wy - rh, { m: o.roof, ins: o.ins });
    if (o.chim != null) HUM.chim(c, o.chim, wy - rh - 1, wy - Math.round(rh * 0.45), f);
    if (o.gable) HUM.gable(c, o.gable.x, o.gable.hw, wy - 1, o.gable.h, { win: o.gable.win, roof: o.roof });
    if (o.door !== false) HUM.door(c, o.door ?? cx, yb, o.dw || 5, o.dh || Math.min(wh - 2, 9), o);
    (o.wins || []).forEach(x => HUM.win(c, x, o.wy ?? wy + 3, o.ww || 3, o.whh || 4, { sh: o.shut }));
    return { wy, rt: wy - rh };
  },
  // Torre de piedra: cuerpo, cornisa, suelo de la plataforma y almenas (vista 3/4)
  tower(c, x0, x1, yb, yt, o = {}) {
    R(c, 'stone', x0, yt, x1, yb, P.brick(x0, yt, 5, 3));
    R(c, 'darkwood', x0, yt - 7, x1, yt - 4, P.plankH(yt - 7, 2));                // suelo visto desde arriba
    battl(c, T('stone', 2), x0, x1, yt - 7, 2, 2, 2);                              // almenas traseras
    R(c, 'stone', x0 - 1, yt - 3, x1 + 1, yt, P.brick(x0 - 1, yt - 3, 4, 2, 0));  // parapeto frontal
    c.rect(T('stone', 2), x0 - 1, yt - 3, x1 + 1, yt - 3);
    battl(c, 'stone', x0 - 1, x1 + 1, yt - 4, 2, 2, 2);
    for (let x = x0; x <= x1; x += 2) c.px(T('stone', 0), x, yt + 1);
    return yt - 5;
  },
  slit(c, x, y, h = 4) { c.rect('bld_hole', x, y, x, y + h - 1); c.px(T('stone', 2), x - 1, y - 1); c.px(T('stone', 2), x + 1, y - 1); },
  flag: (c, x, y, f, o) => flag(c, x, y, f, o),
  shedRoof: 'thatch', awnB: 'cloth',
  W: { face: 'stone', top: 'stone', ftex: (x, y) => P.brick(x, y, 5, 3), ttex: (x, y) => (xx, yy) => (md(yy - y, 3) === 2 ? 0 : null), merlon: 'stone' },
};

// ------------------------------------------------------------- constructores genéricos por tipo
// K = kit de raza. Cada uno compone hall + elemento identificativo.
const G = {
  house(c, f, K) { K.hall(c, 4, 27, 46, 12, 16, { f, door: 10.5, dw: 5, dh: 8, wins: [18], chim: 20, shut: true }); },
  barracks(c, f, K) {
    const g = K.hall(c, 4, 43, 58, 17, 20, { f, sh: 6, door: 24, dw: 8, dh: 10, wins: [9, 36], gable: { x: 23, hw: 10, h: 12 }, shut: true });
    crossed(c, 23, g.wy - 6, { blade: K.blade });
    K.flag(c, 6, g.rt - 9, f, { ph: 13 });
    dummy(c, 7, 62, f);
    c.line(K.beam, 36, 62, 36, 53); c.line(K.beam, 45, 62, 45, 53); c.line(K.beam, 36, 54, 45, 54);
    for (let x = 38; x <= 43; x += 2) { c.line(K.wood, x, 61, x, 51); c.px(K.blade, x, 50); c.px(K.blade, x, 49); c.px(T(K.blade, 3), x, 48); }
  },
  range(c, f, K) {
    const g = K.hall(c, 3, 26, 46, 12, 14, { f, door: 15, dw: 9, dh: 8, open: true, wins: [5], sh: 3 });
    c.line('wood', 12, 41, 12, 45); c.line('wood', 13, 40, 13, 40); c.line('wood', 13, 46, 13, 46); c.line('string', 11, 41, 11, 45);
    c.rect('leather', 17, 42, 18, 46); c.px('feather', 17, 41); c.px('feather', 18, 40);
    K.flag(c, 24, g.rt - 8, f, { ph: 9, len: 6 });
    hay(c, 31, 41, 9, 5); target(c, 35, 30, f); hay(c, 37, 53, 9, 5); target(c, 41, 42, f);
    for (const [x, y] of [[29, 51], [33, 54], [45, 50]]) { c.line('darkwood', x, y, x + 1, y - 3); c.px('feather', x + 1, y - 4); }
  },
  stable(c, f, K) {
    const g = K.hall(c, 2, 45, 52, 14, 16, { f, door: false, sh: 3, wins: [] });
    sdoor(c, K, 11, 52, 8, 10, K.horse, f); sdoor(c, K, 36, 52, 8, 10, null, f);
    c.rect(K.beam, 19, g.wy + 1, 28, g.wy + 8); R(c, K.wood, 20, g.wy + 2, 27, g.wy + 7, P.plankH(g.wy + 2, 3)); shoe(c, 23.5, g.wy + 4.2, K.metal);
    K.flag(c, 43, g.rt - 8, f, { ph: 10, len: 6 });
    hay(c, 18, 55, 7, 5); hay(c, 21, 51, 6, 4);
    R(c, K.wood, 27, 51, 34, 54, P.plankH(51, 2)); c.rect('water', 28, 51, 33, 51); c.px(T('water', 3), 29 + f, 51);
  },
  workshop(c, f, K) {
    const g = K.hall(c, 2, 30, 60, 15, 16, { f, door: 18, dw: 11, dh: 10, open: true, wins: [5], sh: 3 });
    c.ring(K.wood, 18, 55.5, 4, 4, 0.5); c.line(K.wood, 18, 52, 18, 59); c.line(K.wood, 14, 55, 22, 55);
    gear(c, 9, g.wy - 4, 4, f, K.metal);
    // grúa: mástil, pluma y carga que oscila
    c.rect(K.beam, 38, 9, 39, 61); c.line(K.beam, 44, 61, 39, 40); c.line(K.beam, 33, 61, 38, 40);
    c.rect(K.wood, 22, 8, 46, 9); c.rect(T(K.wood, 2), 22, 8, 46, 8); c.line(K.beam, 38, 10, 30, 9); c.line(K.beam, 39, 16, 44, 10);
    R(c, K.stone, 43, 10, 46, 13, P.brick(43, 10, 4, 2, 0));
    const sw = [0, 1, 0, -1][f];
    c.line('string', 25, 10, 25 + sw, 20); c.at(sw, 0, () => { c.px(K.metal, 25, 21); c.rect(K.stone, 23, 22, 27, 25); c.rect(T(K.stone, 2), 23, 22, 27, 22); c.px(T(K.stone, 0), 27, 25); });
    gear(c, 41, 52, 3.5, f, K.metal, 6);
    logSide(c, 31, 46, 62, K.wood, 3); logSide(c, 33, 44, 59, K.wood, 3);
  },
  forge(c, f, K) {
    const g = K.hall(c, 3, 22, 49, 12, 13, { f, door: 9.5, dw: 7, dh: 7, open: true, wins: [], sh: 3 });
    K.chim(c, 18, 16, g.wy - 3, f, { w: 6, col: '#857f92', a: 210, n: 4, forge: true });
    embers(c, 21, 14, f, 3);
    flame(c, 9, 48, f, 2); c.rect('fire', 7, 48, 12, 49); c.glow(9, 50, 0, '#000');
    c.rect('bld_hole', 16, g.wy + 3, 19, g.wy + 5); c.rect('fire', 16, g.wy + 5, 19, g.wy + 5); c.px('glowY', 17 + (f & 1), g.wy + 5);
    anvil(c, 23, 50); c.line('leather', 27, 43, 29, 45); c.rect(K.metal, 26, 42, 28, 43);
    barrel(c, 0, 50);
  },
  market(c, f, K) {
    const st = (x0, x1, ya, yc) => { c.rect(K.beam, x0 + 1, ya + 4, x0 + 1, yc + 4); c.rect(K.beam, x1 - 1, ya + 4, x1 - 1, yc + 4); K.awn(c, x0, x1, ya, ya + 5, f); counter(c, K, x0 + 1, x1 - 1, yc); };
    st(7, 40, 20, 39); c.rect('bld_hole2', 9, 26, 38, 38); for (let x = 11; x < 38; x += 5) { c.rect(K.wood, x, 30, x + 2, 37); c.px(T(K.wood, 2), x, 30); }
    st(1, 19, 32, 47); st(28, 46, 30, 45);
    barrel(c, 20, 54); barrel(c, 22, 49); crate(c, 25, 54, 5); sack(c, 14, 54); sack(c, 33, 54);
    K.flag(c, 23, 6, f, { ph: 13, len: 6 });
  },
  lumber(c, f, K) {
    K.shed(c, 2, 29, 30, 11, f);
    logEnds(c, 4, 30, 4, K.beam);
    pennant(c, 28, 3, f, { ph: 8 });
    // caballete con tronco y sierra
    c.line(K.beam, 18, 41, 22, 36); c.line(K.beam, 22, 41, 18, 36); c.line(K.beam, 25, 41, 29, 36); c.line(K.beam, 29, 41, 25, 36);
    logSide(c, 14, 30, 36, K.wood, 3);
    const sx = [0, 2, 3, 1][f];
    c.at(sx, 0, () => { c.rect(K.blade, 20, 37, 21, 39); c.line(T(K.blade, 0), 20, 40, 21, 40); c.rect(K.wood, 20, 30, 21, 33); c.rect(K.blade, 21, 33, 21, 36); });
    for (let i = 0; i < 3; i++) c.glow(19 + sx + i * 2 - (f & 1), 41 - (i & 1), 200, '#e8d4a0');
    c.rect(K.beam, 3, 38, 8, 42); c.rect('bld_logend', 3, 38, 8, 38); c.line(K.wood, 7, 37, 10, 33); c.rect(K.blade, 9, 32, 11, 33);
  },
  mine(c, f, K) {
    K.mound(c, f);
    K.portal(c, 9, 22, 41, 22, f);
    c.line(K.metal, 13, 36, 12, 42); c.line(K.metal, 18, 36, 19, 42); for (let y = 37; y <= 42; y += 2) c.line(K.beam, 12, y, 19, y);
    cart(c, 19, 42, 'gold');
    c.line(K.beam, 26, 42, 26, 33); c.px(K.metal, 27, 33); c.rect(K.metal, 27, 34, 28, 36); c.px(f & 1 ? 'glowY' : 'window', 27, 35); c.px('window', 28, 35);
    K.flag(c, 23, 6, f, { ph: 9, len: 6 });
  },
  farm(c, f, K, o) { K.farm(c, f); },
  wall(c, f, K, o) { wallDraw(c, f, K.W, o.mask | 0); },
  gate(c, f, K, o) { gateDraw(c, f, K.W, o.mask | 0); },
};

// ------------------------------------------------------------- muros y puertas (masks)
// Suelo de la tile en y 16..31. Caja central x4..11 / gy 20..26 y brazos hacia los vecinos
// (bits 1=N 2=E 4=S 8=O). Todo con tonos forzados para que las tiles empalmen sin costuras.
// W = { h, face, top, ff(x,y,fy,gb), tf(x,y,ty), crenH, crenV, post, deco, gate }
function wbox(c, W, x0, x1, gy0, gy1, H) {
  const ty = gy0 - H, fy = gy1 - H + 1;
  for (let y = ty; y <= gy1; y++) for (let x = x0; x <= x1; x++)
    { const v = y < fy ? W.tf(x, y, ty) : W.ff(x, y, fy, gy1); c.px(typeof v === 'string' ? v : T(y < fy ? W.top : W.face, v), x, y); }
  for (let x = x0; x <= x1; x++) c.glow(x, gy1 + 1, 60, '#140c28');
}
function wallDraw(c, f, W, m) {
  const H = W.h, N = m & 1, E = m & 2, S = m & 4, O = m & 8, fy = 27 - H;
  if (N) wbox(c, W, 4, 11, 16, 19, H);
  if (O) wbox(c, W, 0, 3, 20, 26, H);
  if (E) wbox(c, W, 12, 15, 20, 26, H);
  wbox(c, W, 4, 11, 20, 26, H);
  if (N) { W.crenV(c, 4, 16 - H, 19 - H, f); W.crenV(c, 11, 16 - H, 19 - H, f); }
  if (!O) W.crenV(c, 4, 20 - H, 26 - H, f); if (!E) W.crenV(c, 11, 20 - H, 26 - H, f);
  if (O) W.crenH(c, 0, 3, fy, f); if (!S) W.crenH(c, 4, 11, fy, f); if (E) W.crenH(c, 12, 15, fy, f);
  if (S) { wbox(c, W, 4, 11, 27, 31, H); W.crenV(c, 4, 27 - H, 31 - H, f); W.crenV(c, 11, 27 - H, 31 - H, f); }
  const straight = m === 5 || m === 10;
  if (!straight) W.post(c, f, m);
  W.deco(c, f, m, straight);
}
// Puerta: horizontal (arco en la cara frontal) o vertical (hueco entre dos torres N y S)
function gateDraw(c, f, W, m) {
  const Hg = W.h + 3, open = f === 1, horiz = (m & 10) || !(m & 5);
  if (horiz) { wbox(c, W, 0, 15, 19, 26, Hg); W.crenH(c, 0, 15, 27 - Hg, f); W.gate(c, f, true, open, Hg); return; }
  wbox(c, W, 3, 12, 16, 21, Hg);
  W.crenV(c, 3, 16 - Hg, 21 - Hg, f); W.crenV(c, 12, 16 - Hg, 21 - Hg, f);
  W.gate(c, f, false, open, Hg);       // dibuja en el hueco (filas 22-Hg+... hasta 26-Hg)
  wbox(c, W, 3, 12, 27, 31, Hg);
  W.crenV(c, 3, 27 - Hg, 31 - Hg, f); W.crenV(c, 12, 27 - Hg, 31 - Hg, f); W.crenH(c, 3, 12, 32 - Hg, f);
  if (W.gtop) W.gtop(c, f, Hg);
}

// Muros humanos: sillería clara con almenas, estandarte del equipo en los pilares
HUM.W = {
  h: 12, face: 'stone', top: 'stone',
  ff(x, y, fy, gb) {
    const r = y - fy, k = Math.floor(r / 3), rr = md(r, 3), sx = x + (k & 1) * 2, xx = md(sx, 5);
    if (y === gb) return 0; if (r === 0) return 2;
    if (rr === 2 || xx === 4) return 0;
    return rr === 0 && xx === 0 && hs(k, Math.floor(sx / 5)) % 3 === 0 ? 2 : 1;
  },
  tf: (x, y) => (md(y, 4) === 3 || md(x + (md(y >> 2, 2) ? 2 : 0), 4) === 3 ? 1 : 2),
  crenH(c, x0, x1, y) { for (let x = x0; x <= x1; x++) if (md(x, 4) < 2) { const r = md(x, 4) === 1; c.px(T('stone', r ? 2 : 3), x, y - 3); c.px(T('stone', r ? 0 : 1), x, y - 2); c.px(T('stone', r ? 0 : 1), x, y - 1); } },
  crenV(c, x, y0, y1) { for (let y = y0; y <= y1; y++) c.px(T('stone', md(y, 4) === 0 ? 3 : md(y, 4) === 1 ? 0 : 2), x, y); },
  post(c, f) {
    wbox(c, HUM.W, 2, 13, 18, 27, 16);
    for (let x = 2; x <= 13; x++) if (md(x, 3) < 2) { c.px(T('stone', 3), x, 1); c.px(T('stone', 1), x, 0); }
    HUM.W.crenV(c, 2, 2, 11); HUM.W.crenV(c, 13, 2, 11);
    for (let x = 2; x <= 13; x++) if (md(x, 3) < 2) { c.px(T('stone', 3), x, 9); c.px(T('stone', md(x, 3) ? 0 : 1), x, 10); c.px(T('stone', md(x, 3) ? 0 : 1), x, 11); }
    banner(c, 6, 13, 4, 6, f, { sway: 0, emb: (x, y) => { c.px('gold', x - .5, y); c.px('gold', x + .5, y); } });
  },
  deco(c, f, m, st) { if (m === 10) { c.rect('team', 7, 17, 8, 20); c.px(T('team', 0), 8, 18); c.px('gold', 7, 17); c.px('gold', 8, 17); } if (m === 5) pennant(c, 7, 2, f, { ph: 5, len: 4 }); },
  gate(c, f, horiz, open, Hg) {
    if (horiz) {
      c.rect(T('stone', 2), 3, 15, 12, 26); c.rect(T('stone', 1), 4, 15, 11, 15); c.rect(T('stone', 3), 7, 14, 8, 15);
      c.rect(open ? 'bld_hole' : 'wood', 4, 17, 11, 26); c.rect(open ? 'bld_hole' : 'wood', 5, 16, 10, 16);
      if (!open) { tex(c, 'wood', 4, 16, 11, 26, P.plankV(4, 2)); c.rect('darkwood', 7, 17, 8, 26); c.rect(T('iron', 1), 4, 19, 11, 19); c.rect(T('iron', 1), 4, 23, 11, 23); c.px('gold', 6, 21); c.px('gold', 9, 21); }
      else { c.rect(T('iron', 1), 4, 17, 11, 17); for (let x = 5; x <= 10; x += 2) c.rect(T('iron', 0), x, 18, x, 19); c.rect('bld_hole2', 4, 24, 11, 26); }
      banner(c, 1, 27 - Hg + 2, 2, 5, f, { sway: 0 }); banner(c, 13, 27 - Hg + 2, 2, 5, f, { sway: 0 });
    } else {
      const y0 = 22 - Hg, y1 = 26 - Hg;
      if (!open) { for (let y = y0; y <= y1; y++) for (let x = 4; x <= 11; x++) c.px(T('wood', md(x, 2) ? 1 : 2), x, y); c.rect(T('iron', 1), 4, y0 + 1, 11, y0 + 1); c.rect(T('iron', 0), 4, y1, 11, y1); }
      else { c.rect('bld_hole2', 4, y0, 11, y1); for (let x = 4; x <= 11; x += 2) c.px(T('iron', 1), x, y0); }
    }
  },
  gtop(c, f, Hg) { banner(c, 6, 17 - Hg, 4, 4, f, { sway: 0 }); },
};
HUM.awn = (c, x0, x1, y0, y1) => awning(c, x0, x1, y0, y1, { a: 'team', b: 'cloth' });
HUM.shed = (c, x0, x1, yb, yt, f) => {
  R(c, 'wood', x0 + 1, yt + 8, x1 - 1, yb, P.plankV(x0 + 1, 3));
  c.rect('darkwood', x0, yt + 6, x0 + 1, yb); c.rect('darkwood', x1 - 1, yt + 6, x1, yb);
  HUM.roof(c, x0 - 1, x1 + 1, yt + 8, yt, { m: 'thatch', ins: 2 });
};
HUM.mound = (c) => {
  c.ell('rock', 16, 34, 15.5, 22); c.rect(null, 0, 43, 31, 60);
  tex(c, 'rock', 0, 10, 31, 42, P.stones(0, 12, 5, 4, 8));
  c.ell('moss', 9, 15, 5, 2.5); c.ell('moss', 23, 17, 4, 2); tex(c, 'moss', 0, 10, 31, 20, P.turf(0, 12));
};
HUM.portal = (c, x0, x1, yb, yt) => {
  c.rect('bld_hole', x0 + 1, yt + 2, x1 - 1, yb); c.rect('bld_hole2', x0 + 2, yt + 3, x1 - 2, yt + 4);
  c.rect('darkwood', x0, yt + 1, x0 + 1, yb); c.rect('darkwood', x1 - 1, yt + 1, x1, yb);
  c.rect('wood', x0 - 1, yt, x1 + 1, yt + 2); c.rect(T('wood', 2), x0 - 1, yt, x1 + 1, yt); c.px('bld_logend', x0 - 1, yt + 1); c.px('bld_logend', x1 + 1, yt + 1);
};
HUM.farm = (c, f) => {
  R(c, 'dirt', 2, 6, 45, 45, (x, y) => (md(y, 4) === 3 ? 0 : md(y, 4) === 0 ? 2 : null));
  fenceH(c, 1, 46, 6); fenceV(c, 1, 6, 46); fenceV(c, 46, 6, 46); fenceH(c, 1, 46, 46);
  for (let y = 9; y <= 44; y += 4) for (let x = 4; x <= 43; x += 2) {
    if (x > 34 && x < 42 && y < 22) continue;
    if (f === 0) { if (md(x + y, 4) === 0) c.px(T('straw', 3), x, y); }
    else if (f === 1) { c.px('leaf', x, y - 1); if (x & 2) c.px(T('leaf', 2), x, y - 2); }
    else if (f === 2) { c.rect('grass', x, y - 3, x, y - 1); c.px(T('grass', 3), x, y - 3); if (x & 2) c.px(T('straw', 2), x, y - 4); }
    else { c.rect('straw', x, y - 4, x, y - 1); c.px(T('straw', 3), x, y - 4); c.px(T('straw', 3), x, y - 5); c.px(T('straw', 0), x, y - 1); if (md(x, 4) === 0) c.px(T('straw', 2), x + 1, y - 5); }
  }
  // espantapájaros con camisa del equipo
  c.line('darkwood', 38, 20, 38, 8); c.line('darkwood', 34, 12, 42, 12);
  c.rect('team', 36, 11, 40, 16); c.rect(T('team', 0), 36, 16, 40, 16); c.ell('sack', 38.5, 9, 1.8, 1.8); c.rect('straw', 35, 7, 41, 7); c.rect('straw', 36, 6, 40, 6);
  c.px('straw', 33, 12); c.px('straw', 43, 12);
};

// ------------------------------------------------------------- humanos: tipos especiales
const HUMS = {
  tc(c, f) {
    HUM.hall(c, 4, 59, 91, 19, 22, { f, sh: 8, door: false, wins: [9, 15, 45, 51], shut: true, chim: 51 });
    HUM.gable(c, 12, 7, 72, 8, { win: true }); HUM.gable(c, 51, 7, 72, 8, { win: true });
    // campanario central
    R(c, 'stone', 24, 34, 39, 91, P.brick(24, 34, 5, 3));
    for (let y = 34; y <= 91; y += 3) { c.rect(T('stone', 2), 24, y, 25, y + 1); c.rect(T('stone', 0), 38, y + 1, 39, y + 2); }
    c.rect('bld_hole', 27, 37, 36, 46); c.rect('stone', 27, 37, 27, 37); c.rect('stone', 36, 37, 36, 37); c.rect(T('stone', 2), 26, 47, 37, 47);
    bell(c, 31.5, 38, f);
    HUM.roof(c, 22, 41, 33, 13, { ins: 9 });
    flag(c, 31, 4, f, { ph: 9, len: 8, hgt: 4, tail: true });
    banner(c, 28, 51, 8, 10, f, { sway: 0, emb: (x, y) => { c.rect('gold', x - 1, y - 1, x + 1, y + 1); c.px('team', x, y); } });
    HUM.door(c, 31.5, 91, 8, 13); c.rect(T('stone', 2), 26, 92, 37, 93); c.rect(T('stone', 0), 27, 94, 36, 94);
    torch(c, 25, 80, f); torch(c, 38, 80, f);
  },
  temple(c, f) {
    const g = HUM.hall(c, 3, 44, 68, 18, 20, { f, sh: 18, door: false, wins: [] });
    for (const x of [7, 38]) { c.rect('stone', x - 1, 52, x + 3, 62); c.rect('bld_glass', x, 54, x + 2, 61); c.px('stone', x, 54); c.px('stone', x + 2, 54); c.rect('red', x, 58, x + 2, 58); c.px('gold', x + 1, 56); }
    // fachada-torre con aguja
    R(c, 'stone', 16, 30, 31, 68, P.brick(16, 30, 5, 3));
    c.rect(T('stone', 2), 15, 30, 32, 31);
    const gl = PUL[f];
    c.ell('stone', 23.5, 40, 5.4, 5.4); c.ell('bld_glass', 23.5, 40, 4.2, 4.2);
    for (let k = 0; k < 8; k++) { const a = k * PI / 4; c.line(T('stone', 1), 23.5, 40, 23.5 + Math.cos(a) * 4, 40 + Math.sin(a) * 4); }
    c.ell(T('gold', gl), 23.5, 40, 1.2, 1.2); c.px(T('red', 2), 21, 37); c.px(T('red', 2), 26, 43); c.px(T('team', 3), 26, 37); c.px(T('team', 3), 21, 43);
    HUM.roof(c, 14, 33, 29, 4, { ins: 9 });
    c.rect('gold', 23, 0, 24, 4); c.rect('gold', 21, 1, 26, 1); aura(c, 23.5, 2, 5, 70 + gl * 20, '#ffe98a');
    c.rect('stone', 19, 52, 28, 68); c.rect('bld_hole', 20, 55, 27, 68); c.rect('wood', 20, 56, 27, 68); tex(c, 'wood', 20, 56, 27, 68, P.plankV(20, 2));
    c.rect('stone', 20, 55, 20, 56); c.rect('stone', 27, 55, 27, 56); c.px('stone', 21, 55); c.px('stone', 26, 55); c.rect('gold', 23, 61, 24, 61);
    banner(c, 16, 47, 3, 9, f, { sway: 0 }); banner(c, 29, 47, 3, 9, f, { sway: 0 });
    c.rect(T('stone', 2), 18, 69, 29, 69);
  },
  tower(c, f) {
    R(c, 'stone', 6, 72, 25, 78, P.brick(6, 72, 5, 3));
    const top = HUM.tower(c, 7, 24, 77, 24);
    c.rect(T('stone', 2), 7, 24, 8, 77); c.rect(T('stone', 0), 23, 24, 24, 77);
    for (const y of [32, 48]) { HUM.slit(c, 11, y, 5); HUM.slit(c, 20, y, 5); }
    banner(c, 13, 37, 6, 11, f, { emb: (x, y) => { c.px('gold', x, y); c.px('gold', x + 1, y); c.px('gold', x, y + 1); c.px('gold', x + 1, y + 1); } });
    HUM.door(c, 16, 77, 6, 9); torch(c, 11, 66, f);
    flag(c, 16, 3, f, { ph: 15, len: 8, tail: true });
  },
  castle(c, f) {
    // torreón trasero
    R(c, 'stone', 18, 30, 45, 86, P.brick(18, 30, 5, 3));
    R(c, 'darkwood', 18, 23, 45, 26, P.plankH(23, 2)); battl(c, T('stone', 2), 18, 45, 23, 2, 2, 2);
    R(c, 'stone', 17, 27, 46, 30, P.brick(17, 27, 4, 2, 0)); battl(c, 'stone', 17, 46, 26, 2, 2, 2); c.rect(T('stone', 2), 17, 27, 46, 27);
    R(c, 'stone', 27, 12, 36, 24, P.brick(27, 12, 5, 3)); HUM.roof(c, 25, 38, 11, 0, { ins: 6 });
    flag(c, 31, 1, f, { ph: 3, len: 0, tip: false });
    for (const x of [22, 30, 38]) HUM.win(c, x, 40, 3, 5); for (const x of [22, 38]) HUM.win(c, x, 56, 3, 5);
    banner(c, 29, 52, 6, 12, f, { emb: (x, y) => { c.rect('gold', x, y - 1, x + 1, y + 2); c.rect('gold', x - 1, y, x + 2, y); } });
    // muralla frontal
    R(c, 'stone', 14, 82, 49, 108, P.brick(14, 82, 5, 3));
    R(c, 'darkwood', 14, 76, 49, 78, P.plankH(76, 2)); battl(c, T('stone', 2), 14, 49, 76, 2, 2, 2);
    R(c, 'stone', 14, 79, 49, 82, P.brick(14, 79, 4, 2, 0)); c.rect(T('stone', 2), 14, 79, 49, 79); battl(c, 'stone', 14, 49, 78, 2, 2, 2);
    c.rect('stone', 25, 89, 38, 108); c.rect('bld_hole', 26, 92, 37, 108); c.rect('stone', 26, 92, 27, 93); c.rect('stone', 36, 92, 37, 93); c.px('stone', 28, 92); c.px('stone', 35, 92);
    for (let x = 27; x <= 36; x += 2) c.rect('iron', x, 93, x, 101); for (let y = 95; y <= 101; y += 3) c.rect('iron', 26, y, 37, y);
    c.rect(T('stone', 2), 25, 88, 38, 88);
    banner(c, 18, 86, 4, 10, f); banner(c, 42, 86, 4, 10, f);
    // torres delanteras con techo cónico
    for (const [x0, x1, fx] of [[2, 15, 8], [48, 61, 55]]) {
      R(c, 'stone', x0, 48, x1, 109, P.brick(x0, 48, 5, 3));
      c.rect(T('stone', 2), x0, 48, x0 + 1, 109); c.rect(T('stone', 0), x1 - 1, 48, x1, 109);
      R(c, 'stone', x0 - 1, 44, x1 + 1, 48, P.brick(x0 - 1, 44, 4, 2, 0)); c.rect(T('stone', 2), x0 - 1, 44, x1 + 1, 44);
      for (let x = x0; x <= x1; x += 2) c.px(T('stone', 0), x, 49);
      HUM.roof(c, x0 - 2, x1 + 2, 43, 26, { ins: 7 });
      flag(c, fx + (fx > 32 ? 0 : 1), 16, f, { ph: 10, len: 7, dir: fx > 32 ? 1 : -1, tail: true });
      HUM.slit(c, fx + 1, 60, 5); HUM.slit(c, fx + 1, 80, 5);
    }
    torch(c, 23, 96, f); torch(c, 40, 96, f);
  },
  mill(c, f) {
    c.poly('plaster', [[9, 62], [23, 62], [21, 30], [11, 30]]);
    R(c, 'stone', 8, 55, 23, 61, P.brick(8, 55, 4, 3));
    c.line('darkwood', 10, 54, 11, 31); c.line('darkwood', 21, 54, 20, 31); c.line('darkwood', 12, 44, 19, 44);
    HUM.win(c, 15, 37, 2, 3); HUM.door(c, 16, 61, 4, 6);
    HUM.roof(c, 8, 23, 30, 16, { m: 'team', ins: 7 }); c.rect('darkwood', 15, 14, 16, 16);
    sails(c, 15.5, 25.5, 14, f, { cloth: 'cloth', spar: 'darkwood' });
    pennant(c, 16, 2, f, { ph: 12 });
    sack(c, 4, 62); sack(c, 23, 62); sack(c, 26, 62);
  },
};

// ------------------------------------------------------------- kit: ELFOS
// Madera viva clara y curva, tejados de hojas en ojiva, cristal verde, lianas, plata y oro.
const ELF = {
  id: 'elf', wood: 'bld_elfwood', beam: 'bld_bark', stone: 'bld_moon', metal: 'silver', blade: 'silver', horse: 'cloth',
  // Cúpula de hojas apuntada (ogiva) con punta rizada; o.val = cenefa del equipo en el alero
  roof(c, xl, xr, yb, yt, o = {}) {
    const m = o.m || 'bld_elfleaf', cx = (xl + xr + 1) / 2, hw = (xr - xl + 1) / 2, H = yb - yt + 1, L = [], Rr = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20, w = hw * Math.pow(1 - Math.pow(t, 1.8), 0.62) * (1 + 0.1 * Math.sin(t * PI)); L.push([cx - w, yb + 1 - t * H]); Rr.unshift([cx + w, yb + 1 - t * H]); }
    c.poly(m, L.concat(Rr));
    tex(c, m, xl - 3, yt, xr + 3, yb, P.scale(Math.round(cx) + 2, yb + 1, 4, 3));
    if (o.rib) for (const d of [-0.5, 0.5]) for (let i = 2; i < 20; i++) { const t = i / 20, w = hw * d * Math.pow(1 - Math.pow(t, 1.8), 0.62); c.px(o.rib, cx + w - .5, yb + 1 - t * H); }
    c.px(T(m, 2), cx - .5, yt - 1); c.px(T(m, 3), cx + .5, yt - 2); c.px(T(m, 2), cx + 1.5, yt - 2);
    if (o.val !== false) for (let x = Math.round(xl + 1); x <= xr - 1; x++) { c.px(T('team', md(x, 3) === 0 ? 2 : 1), x, yb); if (md(x, 3) === 1) c.px(T('team', 0), x, yb + 1); }
  },
  door(c, cx, yb, w, h, o = {}) {
    const x0 = Math.round(cx - w / 2 + .01), x1 = x0 + w - 1, yt = yb - h + 1, ap = Math.ceil(w / 2), mx = (x0 + x1 + 1) / 2;
    c.poly('bld_bark', [[x0 - 1, yb + 1], [x1 + 2, yb + 1], [x1 + 2, yt + ap - 1], [mx, yt - 2], [x0 - 1, yt + ap - 1]]);
    c.poly(o.open ? 'bld_hole' : 'wood', [[x0, yb + 1], [x1 + 1, yb + 1], [x1 + 1, yt + ap], [mx, yt], [x0, yt + ap]]);
    if (!o.open) { tex(c, 'wood', x0, yt, x1, yb, P.plankV(x0, 2)); c.line('silver', mx - .5, yt + 2, mx - .5, yb - 1); c.px('silver', mx - 1.5, yt + 4); c.px('silver', mx + .5, yt + 6); c.px('gold', x1 - 1, yt + (h >> 1) + 1); }
    return { x0, x1, yt };
  },
  win(c, x, y, w = 3, h = 4) {
    const mx = x + (w - 1) / 2;
    c.rect('bld_bark', x - 1, y, x + w, y + h); c.rect('bld_bark', x, y - 1, x + w - 1, y - 1); c.px('bld_bark', mx, y - 2);
    c.rect('bld_elfglass', x, y, x + w - 1, y + h - 1); if (w & 1) c.px('bld_elfglass', mx, y - 1);
    c.px(T('bld_elfglass', 3), x, y); c.rect('gold', x - 1, y + h, x + w, y + h);
  },
  chim(c, x, yt, yb, f, o = {}) {
    const w = o.w || 4;
    R(c, 'bld_moon', x, yt, x + w - 1, yb, P.brick(x, yt, 4, 3, 0)); c.rect('gold', x - 1, yt, x + w, yt); c.rect(T('bld_moon', 0), x, yt + 1, x + w - 1, yt + 1);
    smoke(c, x + w / 2 - .5, yt - 1, f, Object.assign({ col: '#e4f0e8' }, o));
  },
  gable(c, xc, hw, gb, h) {   // arco ojival de piedra lunar con medallón del equipo
    const p = [[xc - hw, gb + 1], [xc + hw + 1, gb + 1], [xc + hw + 1, gb - h * .45], [xc + .5, gb - h], [xc - hw, gb - h * .45]];
    c.poly('bld_moon', p);
    c.poly('bld_elfwood', [[xc - hw + 2, gb + 1], [xc + hw - 1, gb + 1], [xc + hw - 1, gb - h * .4], [xc + .5, gb - h + 2.5], [xc - hw + 2, gb - h * .4]]);
    c.line('gold', xc - hw, gb + 1, xc - hw, gb - h * .45);
  },
  lantern(c, x, y, f) {   // farol de cristal colgado de una rama curva, con luciérnagas
    c.line('bld_bark', x, y, x + 3, y - 2); c.px('bld_bark', x + 4, y - 2); c.px('bld_bark', x + 4, y - 1);
    c.px('silver', x + 4, y); c.rect(T('bld_elfglass', f & 1 ? 3 : 2), x + 3, y + 1, x + 5, y + 3); c.px('gold', x + 4, y + 4);
    for (let k = 0; k < 3; k++) c.glow(x + 2 + Math.round(Math.sin(f * 1.6 + k * 2.2) * 3), y - 2 + Math.round(Math.cos(f * 1.3 + k * 1.7) * 2) - k * 2, 200, '#c8ff9a');
  },
  hall(c, x0, x1, yb, wh, rh, o = {}) {
    const wy = yb - wh + 1, f = o.f || 0, cx = (x0 + x1) / 2, rt = wy - Math.round(rh * 1.15);
    R(c, 'bld_moon', x0 - 1, yb - 1, x1 + 1, yb, P.brick(x0 - 1, yb - 1, 6, 2, 0)); c.rect(T('bld_moon', 2), x0 - 1, yb - 1, x1 + 1, yb - 1);
    R(c, 'bld_elfwood', x0 + 1, wy, x1 - 1, yb - 2, P.plankV(x0 + 1, 3));
    for (const [x, d] of [[x0, -1], [x1, 1]]) {   // troncos de esquina con ramas que abrazan el tejado
      c.rect('bld_bark', Math.min(x, x - d), wy - 1, Math.max(x, x - d), yb); c.px(T('bld_bark', d < 0 ? 2 : 0), x, wy + 2);
      c.px('bld_bark', x + d, yb); c.px('bld_bark', x + d, wy - 1); c.px('bld_bark', x + 2 * d, wy - 2); c.px('bld_bark', x + 2 * d, wy - 3);
      c.px('bld_elfleaf', x + d, wy + 2); c.px('bld_elfleaf', x + d, wy + 4); c.px(T('bld_elfleaf', 2), x, wy + 3);
    }
    c.rect(T('bld_elfwood', 0), x0 + 1, wy, x1 - 1, wy);
    ELF.roof(c, x0 - 2, x1 + 2, wy - 1, rt, { val: o.val });
    if (o.gable) ELF.gable(c, o.gable.x, Math.min(o.gable.hw, 6), wy + 1, o.gable.h);
    if (o.chim != null) ELF.lantern(c, x1, wy + 1, f);
    if (o.door !== false) ELF.door(c, o.door ?? cx, yb - 2, o.dw || 5, o.dh || Math.min(wh - 3, 9), o);
    (o.wins || []).forEach(x => ELF.win(c, x, o.wy ?? wy + 4, o.ww || 3, o.whh || 4));
    return { wy, rt };
  },
  flag: (c, x, y, f, o = {}) => flag(c, x, y, f, Object.assign({ pole: 'silver', tail: true, hgt: 3, len: 8 }, o)),
  awn: (c, x0, x1, y0, y1) => { awning(c, x0, x1, y0, y1, { a: 'team', b: 'bld_moon', sw: 2 }); c.rect('bld_elfleaf', x0, y0 - 1, x1, y0 - 1); tex(c, 'bld_elfleaf', x0, y0 - 1, x1, y0 - 1, (x) => (md(x, 3) ? 2 : 0)); },
  shed(c, x0, x1, yb, yt) {
    R(c, 'bld_elfwood', x0 + 1, yt + 8, x1 - 1, yb, P.plankV(x0 + 1, 3));
    c.rect('bld_bark', x0, yt + 5, x0 + 1, yb); c.rect('bld_bark', x1 - 1, yt + 5, x1, yb);
    trap(c, 'bld_elfleaf', x0 - 2, x1 + 2, yt + 8, yt, 3); tex(c, 'bld_elfleaf', x0 - 2, yt, x1 + 2, yt + 8, P.scale(x0, yt + 9, 4, 3));
    for (let x = x0; x <= x1; x++) if (md(x, 3) === 1) c.px(T('team', 1), x, yt + 9);
  },
  mound(c) {
    c.ell('rock', 16, 34, 15.5, 22); c.rect(null, 0, 43, 31, 60);
    tex(c, 'rock', 0, 10, 31, 42, P.stones(0, 12, 5, 4, 8));
    c.ell('moss', 16, 15, 12, 4); c.ell('moss', 5, 26, 4, 6); c.ell('moss', 27, 28, 4, 6); tex(c, 'moss', 0, 10, 31, 34, P.turf(0, 12));
    for (const [x, y] of [[4, 36], [7, 40], [25, 37], [28, 40]]) { c.rect('bld_elfglass', x, y - 3, x, y); c.px('bld_elfglass', x - 1, y - 1); c.px(T('bld_elfglass', 3), x, y - 3); }
  },
  portal(c, x0, x1, yb, yt, f) {
    const mx = (x0 + x1 + 1) / 2;
    c.poly('bld_moon', [[x0 - 1, yb + 1], [x1 + 2, yb + 1], [x1 + 2, yt + 6], [mx, yt - 2], [x0 - 1, yt + 6]]);
    c.poly('bld_hole', [[x0 + 1, yb + 1], [x1, yb + 1], [x1, yt + 7], [mx, yt + 1.5], [x0 + 1, yt + 7]]);
    c.line('gold', x0 - 1, yb, x0 - 1, yt + 6); c.px(T('bld_elfglass', PUL[f]), mx - .5, yt);
    for (let y = yt + 2; y < yb - 2; y += 3) { c.px('bld_elfleaf', x0 - 2, y); c.px(T('bld_elfleaf', 2), x1 + 2, y + 1); }
  },
  farm(c, f) {   // viñedo: espalderas con vides y uvas/bayas
    R(c, 'dirt', 2, 6, 45, 45, (x, y) => (md(y, 8) === 7 ? 0 : null));
    for (let x = 1; x <= 46; x += 3) { c.px('bld_elfleaf', x, 5); c.px(T('bld_elfleaf', 2), x + 1, 5); c.px('bld_elfleaf', x, 46); }
    for (let y = 6; y <= 46; y += 3) { c.px('bld_elfleaf', 1, y); c.px('bld_elfleaf', 46, y); }
    for (let r = 0; r < 5; r++) {
      const y = 14 + r * 8;
      c.line('bld_bark', 4, y - 5, 43, y - 5); for (let x = 4; x <= 43; x += 13) c.rect('bld_bark', x, y - 6, x, y);
      for (let x = 5; x <= 42; x++) {
        if (x > 33 && r === 0) continue;
        if (f === 0) { if (md(x, 4) === 0) c.px(T('bld_elfleaf', 2), x, y); }
        else if (f === 1) { if (md(x, 2) === 0) { c.px('bld_elfleaf', x, y - 1); c.px(T('bld_elfleaf', 2), x, y - 2); } }
        else { c.rect('bld_elfleaf', x, y - 4, x, y - 1); if (md(x + r, 3) === 0) c.px(T('bld_elfleaf', 2), x, y - 4); if (md(x + r, 4) === 1) c.px(T('bld_elfleaf', 0), x, y - 2); if (f === 3 && md(x + r * 2, 5) === 0) { c.rect('bld_grape', x, y - 3, x + 1, y - 1); c.px(T('bld_grape', 3), x, y - 3); } }
      }
    }
    flag(c, 38, 3, f, { pole: 'silver', tail: true, hgt: 3, len: 6, ph: 9 });
  },
};
// Muros élficos: piedra lunar con remate de seto de hojas, lianas
ELF.W = {
  h: 11, face: 'bld_moon', top: 'bld_elfleaf',
  ff(x, y, fy, gb) { const r = y - fy, k = Math.floor(r / 4), rr = md(r, 4), xx = md(x + (k & 1) * 4, 8); if (y === gb) return 0; if (r === 0) return 0; if (rr === 3 || xx === 7) return 0; if (md(x * 7 + k * 3, 11) === 0 && rr === 1) return 3; return r === 1 ? 2 : 1; },
  tf(x, y) { const k = y >> 1, xx = md(x + (k & 1) * 2, 4), rr = md(y, 2); return rr === 1 && (xx === 0 || xx === 3) ? 0 : (rr === 0 && xx === 1 ? 3 : 2); },
  crenH(c, x0, x1, y) { for (let x = x0; x <= x1; x++) { c.px(T('bld_elfleaf', md(x, 2) ? 1 : 0), x, y); c.px(T('bld_elfleaf', 2), x, y - 1); if (md(x, 4) === 1) { c.px(T('bld_elfleaf', 3), x, y - 2); c.px(T('bld_elfleaf', 2), x + 1, y - 2); } } for (let x = x0; x <= x1; x++) if (md(x * 5, 7) === 0) c.px('bld_elfleaf', x, y + 1 + md(x, 2)); },
  crenV(c, x, y0, y1) { for (let y = y0; y <= y1; y++) if (md(y, 3) === 0) c.px(T('bld_elfleaf', 3), x, y); },
  post(c, f) {
    wbox(c, ELF.W, 5, 10, 19, 26, 15);
    c.ell('bld_elfleaf', 7.5, 4, 5, 3.5); tex(c, 'bld_elfleaf', 2, 0, 13, 8, P.scale(0, 0, 4, 3));
    pennant(c, 8, 0, f, { pole: 'silver', ph: 4, len: 5 }); c.rect(T('bld_elfglass', PUL[f]), 7, 15, 8, 17); c.rect('gold', 6, 18, 9, 18);
  },
  deco(c, f, m) { if (m === 10) { c.rect('team', 7, 17, 8, 21); c.px(T('team', 0), 7, 22); c.px('silver', 7, 17); c.px('silver', 8, 17); } if (m === 5) { c.px('team', 7, 10); c.px('team', 8, 11); } },
  gate(c, f, horiz, open, Hg) {
    if (horiz) {
      c.poly('bld_moon', [[3, 27], [13, 27], [13, 18], [8, 12], [3, 18]]);
      c.poly(open ? 'bld_hole' : 'bld_elfwood', [[4, 27], [12, 27], [12, 19], [8, 14], [4, 19]]);
      if (!open) { tex(c, 'bld_elfwood', 4, 14, 11, 26, P.plankV(4, 2)); c.rect('bld_bark', 7, 16, 8, 26); c.px('silver', 5, 21); c.px('silver', 10, 21); c.px(T('bld_elfglass', 3), 7, 19); c.px(T('bld_elfglass', 3), 8, 19); }
      else { c.rect('bld_hole2', 4, 24, 11, 26); c.rect('bld_elfwood', 4, 19, 4, 26); c.rect('bld_elfwood', 11, 19, 11, 26); }
      c.line('gold', 3, 18, 7, 13); c.line('gold', 12, 18, 8, 13);
      flag(c, 1, 27 - Hg - 2, f, { pole: 'silver', ph: 6, len: 4, hgt: 3, tail: true }); flag(c, 14, 27 - Hg - 2, f, { pole: 'silver', ph: 6, len: 4, hgt: 3, tail: true, dir: -1 });
    } else {
      const y0 = 22 - Hg, y1 = 26 - Hg;
      if (!open) { for (let y = y0; y <= y1; y++) for (let x = 4; x <= 11; x++) c.px(T('bld_elfwood', md(x, 2) ? 1 : 2), x, y); c.rect('silver', 4, y0 + 1, 11, y0 + 1); }
      else { c.rect('bld_hole2', 4, y0, 11, y1); c.rect(T('bld_elfwood', 2), 4, y0, 4, y1); c.rect(T('bld_elfwood', 2), 11, y0, 11, y1); }
    }
  },
  gtop(c, f, Hg) { pennant(c, 7, 16 - Hg - 4, f, { pole: 'silver', ph: 4, len: 5 }); },
};

// ------------------------------------------------------------- elfos: tipos especiales
const bark = (x, y) => (md(x, 3) === 0 && hs(x, y >> 2) % 3 ? 0 : md(x, 3) === 1 && hs(x, y >> 1) % 7 === 0 ? 2 : null);
const ELFS = {
  house(c, f) { ELF.hall(c, 5, 26, 46, 13, 15, { f, door: 11, dw: 5, dh: 8, wins: [18], chim: 1 }); },
  tc(c, f) {
    ELF.hall(c, 3, 21, 92, 14, 13, { f, door: false, wins: [7, 14] });
    ELF.hall(c, 42, 60, 92, 14, 13, { f, door: false, wins: [46, 53] });
    // gran árbol central con raíces
    c.poly('bld_bark', [[23, 94], [41, 94], [37, 84], [36, 36], [28, 36], [27, 84]]);
    c.poly('bld_bark', [[18, 94], [27, 94], [28, 85]]); c.poly('bld_bark', [[37, 94], [46, 94], [36, 85]]);
    tex(c, 'bld_bark', 16, 30, 48, 94, bark);
    c.line('bld_bark', 29, 40, 14, 34); c.line('bld_bark', 29, 41, 15, 35); c.line('bld_bark', 35, 40, 50, 34); c.line('bld_bark', 35, 41, 49, 35);
    for (const [x, y, rx, ry] of [[32, 24, 29, 12], [12, 30, 11, 7], [52, 30, 11, 7], [32, 12, 18, 9], [20, 17, 11, 7], [44, 17, 11, 7]]) c.ell('bld_elfleaf', x, y, rx, ry);
    tex(c, 'bld_elfleaf', 0, 0, 63, 40, P.scale(0, 0, 5, 3));
    for (const [x, y] of [[10, 22], [26, 10], [46, 14], [54, 26], [36, 28], [18, 30]]) { c.px(T('bld_elfglass', 3), x, y); }
    ELF.door(c, 32, 92, 8, 15);
    ELF.win(c, 31, 54, 3, 5); ELF.win(c, 31, 70, 3, 4);
    c.rect(T('gold', 2), 26, 93, 37, 93);
    banner(c, 9, 36, 3, 14, f, { rod: 'silver', emb: (x, y) => c.px('gold', x, y) }); banner(c, 52, 36, 3, 14, f, { rod: 'silver', emb: (x, y) => c.px('gold', x, y) });
    flag(c, 32, 1, f, { pole: 'silver', tail: true, hgt: 3, len: 9, ph: 3 });
    for (let k = 0; k < 6; k++) c.glow(Math.round(32 + Math.sin(k * 2.4 + f * 0.8) * 26), Math.round(40 + Math.cos(k * 1.9 + f * 0.6) * 6), 210, '#c8ff9a');
  },
  temple(c, f) {
    const pu = PUL[f];
    R(c, 'bld_moon', 3, 66, 44, 69, P.brick(3, 66, 8, 2, 0)); c.rect(T('bld_moon', 2), 3, 66, 44, 66);
    R(c, 'bld_moon', 6, 63, 41, 65, P.brick(6, 63, 8, 3, 0)); c.rect(T('bld_moon', 2), 6, 63, 41, 63);
    c.rect('bld_hole2', 9, 40, 38, 62);
    c.rect('bld_moon', 18, 57, 29, 62); c.rect(T('bld_moon', 2), 18, 57, 29, 57); c.rect('gold', 18, 59, 29, 59);
    c.rect('bld_bark', 23, 46, 24, 56); c.line('bld_bark', 22, 50, 20, 48); c.line('bld_bark', 25, 49, 27, 47);
    c.ell(T('bld_elfglass', pu), 23.5, 45, 6, 4.5); c.ell(T('bld_elfglass', Math.min(3, pu + 1)), 23.5, 44, 3, 2);
    for (const x of [7, 15, 30, 38]) { c.rect('bld_moon', x, 41, x + 2, 62); c.rect(T('bld_moon', 2), x, 41, x, 62); c.rect(T('bld_moon', 0), x + 2, 41, x + 2, 62); c.rect('gold', x - 1, 40, x + 3, 40); for (let y = 44; y < 62; y += 4) c.px('bld_elfleaf', x + (y & 4 ? 0 : 2), y); }
    c.rect('bld_moon', 5, 35, 42, 39); c.rect('gold', 5, 37, 42, 37); c.rect(T('bld_moon', 2), 5, 35, 42, 35);
    ELF.roof(c, 4, 43, 34, 5, { rib: 'gold', val: false });
    c.rect('gold', 23, 0, 24, 3); aura(c, 23.5, 2, 6, 80 + pu * 30, '#c8ffb0');
    banner(c, 11, 41, 3, 10, f, { rod: 'gold', sway: 0 }); banner(c, 34, 41, 3, 10, f, { rod: 'gold', sway: 0 });
    for (let k = 0; k < 4; k++) c.glow(Math.round(23.5 + Math.sin(k * 1.6 + f) * 9), 30 - md(f * 2 + k * 3, 10), 200, '#b8ff8a');
  },
  tower(c, f) {
    c.poly('bld_bark', [[11, 79], [21, 79], [19, 71], [18, 28], [14, 28], [13, 71]]);
    c.poly('bld_bark', [[7, 79], [13, 79], [14, 73]]); c.poly('bld_bark', [[19, 79], [25, 79], [18, 73]]);
    tex(c, 'bld_bark', 6, 26, 26, 79, bark);
    for (let y = 32; y < 74; y++) { const x = Math.round(16 + Math.sin(y * 0.35) * 2.6); if (md(y, 2) === 0) c.px(md(y, 6) ? 'bld_elfleaf' : T('bld_elfleaf', 2), x, y); }
    c.line('bld_bark', 14, 34, 7, 29); c.line('bld_bark', 18, 34, 25, 29);
    R(c, 'bld_elfwood', 4, 26, 27, 29, P.plankV(4, 3)); c.rect(T('bld_elfwood', 2), 4, 26, 27, 26); c.rect(T('bld_elfwood', 0), 4, 29, 27, 29);
    c.rect('bld_elfwood', 8, 16, 23, 25); tex(c, 'bld_elfwood', 8, 16, 23, 25, P.plankV(8, 3));
    ELF.win(c, 10, 19, 2, 4); ELF.win(c, 15, 19, 2, 4); ELF.win(c, 20, 19, 2, 4);
    c.line('silver', 4, 23, 27, 23); for (let x = 4; x <= 27; x += 3) c.rect('silver', x, 23, x, 25);
    ELF.roof(c, 6, 25, 15, 0, {});
    banner(c, 14, 30, 4, 10, f, { rod: 'silver', emb: (x, y) => c.px('gold', x, y) });
  },
  castle(c, f) {
    const spire = (x0, x1, yb, yt, rh, fl) => {
      R(c, 'bld_moon', x0, yt, x1, yb, P.brick(x0, yt, 6, 4, 0)); c.rect(T('bld_moon', 2), x0, yt, x0, yb); c.rect(T('bld_moon', 0), x1, yt, x1, yb);
      c.rect('gold', x0 - 1, yt, x1 + 1, yt); for (let x = x0; x <= x1; x++) if (md(x, 2)) c.px(T('bld_moon', 0), x, yt + 1);
      ELF.roof(c, x0 - 2, x1 + 2, yt - 1, yt - rh, {});
      for (let y = yt + 6; y < yb - 10; y += 14) ELF.win(c, Math.round((x0 + x1) / 2) - 1, y, 3, 6);
      if (fl) flag(c, Math.round((x0 + x1 + 1) / 2), yt - rh - 9, f, { pole: 'silver', tail: true, hgt: 3, len: 7, ph: 7, dir: fl });
    };
    spire(25, 38, 96, 30, 26, 1);
    banner(c, 29, 52, 6, 14, f, { rod: 'gold', emb: (x, y) => { c.rect('gold', x - .5, y - 1, x + .5, y + 2); c.px('gold', x - 1.5, y); c.px('gold', x + 1.5, y); } });
    // muralla curva con arcos
    R(c, 'bld_moon', 12, 82, 51, 108, P.brick(12, 82, 8, 4, 0)); c.rect(T('bld_moon', 2), 12, 82, 51, 82); c.rect('gold', 12, 83, 51, 83);
    for (let x = 12; x <= 51; x += 2) { c.px(T('bld_elfleaf', md(x, 4) ? 2 : 3), x, 81); c.px('bld_elfleaf', x + 1, 80 + md(x, 3) % 2); }
    for (const x of [15, 44]) ELF.win(c, x, 90, 3, 6);
    ELF.door(c, 32, 107, 10, 18); c.rect(T('gold', 2), 26, 108, 37, 108);
    for (const x of [18, 41]) { c.rect('bld_bark', x, 86, x + 1, 108); for (let y = 88; y < 106; y += 3) c.px('bld_elfleaf', x + (y & 1 ? -1 : 2), y); }
    spire(3, 14, 109, 50, 20, -1); spire(49, 60, 109, 50, 20, 1);
    banner(c, 7, 68, 4, 10, f, { rod: 'gold' }); banner(c, 53, 68, 4, 10, f, { rod: 'gold' });
    for (let k = 0; k < 5; k++) c.glow(Math.round(32 + Math.sin(k * 2.4 + f * 0.8) * 22), Math.round(70 + Math.cos(k * 1.9 + f * 0.6) * 8), 200, '#c8ff9a');
  },
  mill(c, f) {
    c.poly('bld_elfwood', [[10, 62], [22, 62], [20, 30], [12, 30]]); tex(c, 'bld_elfwood', 9, 30, 23, 62, P.plankV(10, 3));
    c.line('bld_bark', 10, 61, 12, 30); c.line('bld_bark', 21, 61, 19, 30); c.line('bld_bark', 9, 61, 11, 40);
    R(c, 'bld_moon', 8, 58, 23, 62, P.brick(8, 58, 6, 2, 0));
    ELF.win(c, 15, 40, 2, 4); ELF.door(c, 16, 60, 4, 7);
    ELF.roof(c, 8, 23, 30, 14, {});
    // aspas en forma de hoja
    for (let k = 0; k < 4; k++) {
      const a = k * PI / 2 + f * PI / 8, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, L = [], Rr = [], R0 = 2, R1 = 14;
      for (let i = 0; i <= 10; i++) { const s = R0 + (R1 - R0) * i / 10, w = 3.2 * Math.pow(Math.sin(PI * i / 10), 0.8); L.push([16 + dx * s + px * w, 25 + dy * s + py * w]); Rr.unshift([16 + dx * s - px * w * .5, 25 + dy * s - py * w * .5]); }
      c.poly(T('bld_elfleaf', dy < -0.3 ? 3 : dy > 0.3 ? 1 : 2), L.concat(Rr)); c.line(T('bld_elfleaf', 0), 16 + dx * 3, 25 + dy * 3, 16 + dx * 13, 25 + dy * 13);
    }
    c.ell('gold', 16, 25, 1.6, 1.6);
    flag(c, 16, 3, f, { pole: 'silver', tail: true, hgt: 3, len: 7, ph: 9 });
  },
};

// ------------------------------------------------------------- kit: ENANOS
// Granito tallado pesado, pizarra, cornisas, oro y runas que pulsan, chimeneas, hierro.
function glyph(c, x, y, f, v = 0, m = 'rune') {   // runa 3×4 que pulsa
  const t = T(m, PUL[f]), g = [[[1, 0], [1, 1], [1, 2], [1, 3], [0, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 0], [2, 2]], [[1, 0], [0, 1], [2, 1], [1, 2], [1, 3]], [[0, 0], [2, 0], [1, 1], [1, 2], [0, 3], [2, 3]]][v % 4];
  g.forEach(([dx, dy]) => c.px(t, x + dx, y + dy));
}
const DWA = {
  id: 'dwarf', wood: 'darkwood', beam: 'iron', stone: 'bld_granite', metal: 'iron', blade: 'steel', horse: 'fur',
  wall(c, x0, y0, x1, y1) { R(c, 'bld_granite', x0, y0, x1, y1, P.brick(x0, y0, 7, 4)); },
  roof(c, xl, xr, yb, yt, o = {}) {   // pizarra baja y pesada con cumbrera dorada
    const ins = o.ins ?? Math.round((yb - yt) * 0.35);
    trap(c, 'bld_slate', xl, xr, yb, yt, ins); tex(c, 'bld_slate', xl, yt, xr, yb, P.slate(xl, yb + 1, 6, 3));
    c.rect(T('stone', 2), xl + ins, yt, xr - ins, yt); c.rect(T('stone', 0), xl + ins, yt + 1, xr - ins, yt + 1);
    c.px('gold', xl + ins, yt - 1); c.px('gold', xr - ins, yt - 1);
    R(c, 'stone', xl, yb - 1, xr, yb, (x, y) => (y === yb - 1 ? 2 : md(x, 4) === 0 ? 0 : 1));   // cornisa
  },
  door(c, cx, yb, w, h, o = {}) {
    const x0 = Math.round(cx - w / 2 + .01), x1 = x0 + w - 1, yt = yb - h + 1;
    R(c, 'stone', x0 - 2, yt - 2, x1 + 2, yb, (x, y) => (y === yt - 2 ? 2 : md(x - x0, 3) === 2 && y < yt ? 0 : md(y - yt, 3) === 2 && (x < x0 || x > x1) ? 0 : null));
    c.rect('gold', Math.floor(cx) - (w & 1 ? 0 : 1) + (w & 1 ? 0 : 1) - 1, yt - 3, Math.floor(cx) + 1 - (w & 1 ? 1 : 0), yt - 2);
    if (o.open) c.rect('bld_hole', x0, yt, x1, yb);
    else { R(c, 'darkwood', x0, yt, x1, yb, P.plankV(x0, 2)); c.rect(T('iron', 2), x0, yt + 2, x1, yt + 2); c.rect(T('iron', 1), x0, yb - 3, x1, yb - 3); for (let x = x0 + 1; x < x1; x += 2) { c.px('gold', x, yt + 2); c.px('gold', x, yb - 3); } }
    c.px('stone', x0, yt); c.px('stone', x1, yt);
    return { x0, x1, yt };
  },
  win(c, x, y, w = 3, h = 3) {
    c.rect('stone', x - 1, y - 1, x + w, y + h); c.rect(T('stone', 2), x - 1, y - 1, x + w, y - 1);
    c.rect('window', x, y, x + w - 1, y + h - 1); for (let i = x + 1; i < x + w; i += 2) c.rect(T('iron', 0), i, y, i, y + h - 1);
  },
  chim(c, x, yt, yb, f, o = {}) {
    const w = o.w || 5;
    R(c, 'bld_granite', x, yt, x + w - 1, yb, P.brick(x, yt, 5, 3, 0)); c.rect(T('stone', 2), x - 1, yt, x + w, yt); c.rect('gold', x - 1, yt + 1, x + w, yt + 1);
    if (o.forge) embers(c, x + w / 2, yt - 1, f, 3);
    smoke(c, x + w / 2 - .5, yt - 1, f, Object.assign({ col: '#9a94a6', a: 190 }, o));
  },
  gable(c, xc, hw, gb, h, f = 0) {   // frontón de piedra con borde dorado y runa
    c.poly('bld_granite', [[xc - hw, gb + 1], [xc + hw + 1, gb + 1], [xc + .5, gb - h + .5]]);
    tex(c, 'bld_granite', xc - hw, gb - h, xc + hw, gb, P.brick(xc, gb, 5, 3, 0));
    c.line('gold', xc - hw - 1, gb, xc, gb - h); c.line(T('gold', 0), xc + hw + 1, gb, xc + 1, gb - h);
    c.rect(T('stone', 2), xc - hw, gb, xc + hw, gb);
  },
  hall(c, x0, x1, yb, wh, rh, o = {}) {
    const wy = yb - wh + 1, f = o.f || 0, cx = (x0 + x1) / 2, rt = wy - Math.round(rh * 0.82);
    R(c, 'bld_granite', x0 - 1, yb - 2, x1 + 1, yb, P.brick(x0 - 1, yb - 2, 8, 3, 0)); c.rect(T('bld_granite', 2), x0 - 1, yb - 2, x1 + 1, yb - 2);
    DWA.wall(c, x0, wy, x1, yb - 3);
    for (const x of [x0, x1 - 2]) { R(c, 'stone', x, wy, x + 2, yb - 3, (xx, y) => (md(y - wy, 4) === 3 ? 0 : xx === x ? 2 : null)); }
    glyph(c, x0 + 0, wy + 4, f, x0); glyph(c, x1 - 2, wy + 4, f, x1 + 1);
    c.rect('gold', x0 + 3, wy + 1, x1 - 3, wy + 1); c.rect(T('bld_granite', 0), x0 + 3, wy + 2, x1 - 3, wy + 2);
    DWA.roof(c, x0 - 2, x1 + 2, wy, rt, { ins: o.ins });
    if (o.chim != null) DWA.chim(c, o.chim, rt - 3, wy - 4, f);
    if (o.gable) DWA.gable(c, o.gable.x, o.gable.hw, wy - 2, o.gable.h, f);
    if (o.door !== false) DWA.door(c, o.door ?? cx, yb - 3, o.dw || 5, o.dh || Math.min(wh - 6, 8), o);
    (o.wins || []).forEach(x => DWA.win(c, x, o.wy ?? wy + 5, o.ww || 3, o.whh || 3));
    (o.ban || []).forEach(x => banner(c, x, wy + 3, 3, Math.min(8, wh - 9), f, { rod: 'gold', sway: 0, emb: (ex, ey) => c.px('gold', ex, ey) }));
    return { wy, rt };
  },
  flag: (c, x, y, f, o = {}) => flag(c, x, y, f, Object.assign({ pole: 'iron', hgt: 5, len: 6 }, o)),
  awn: (c, x0, x1, y0, y1) => { awning(c, x0, x1, y0, y1, { a: 'team', b: 'gold', sw: 3 }); c.rect('iron', x0, y0, x1, y0); },
  shed(c, x0, x1, yb, yt) {
    DWA.wall(c, x0 + 1, yt + 8, x1 - 1, yb);
    R(c, 'stone', x0, yt + 6, x0 + 2, yb, (x, y) => (md(y, 4) === 3 ? 0 : null)); R(c, 'stone', x1 - 2, yt + 6, x1, yb, (x, y) => (md(y, 4) === 3 ? 0 : null));
    DWA.roof(c, x0 - 1, x1 + 1, yt + 7, yt, { ins: 2 });
  },
  mound(c) {
    c.poly('bld_granite', [[0, 43], [2, 22], [8, 12], [15, 8], [22, 11], [29, 18], [31, 43]]);
    tex(c, 'bld_granite', 0, 6, 31, 42, P.stones(0, 8, 5, 5, 9));
    c.poly('snow', [[8, 13], [15, 8], [22, 11], [20, 13], [16, 11], [12, 14]]);
  },
  portal(c, x0, x1, yb, yt, f) {
    R(c, 'stone', x0 - 2, yt - 1, x1 + 2, yb, (x, y) => (md(y, 3) === 2 && (x < x0 + 1 || x > x1 - 1) ? 0 : null));
    c.rect('bld_hole', x0 + 1, yt + 4, x1 - 1, yb); c.rect('bld_hole2', x0 + 1, yt + 4, x1 - 1, yt + 5);
    c.rect('stone', x0 - 3, yt - 3, x1 + 3, yt + 2); c.rect(T('stone', 2), x0 - 3, yt - 3, x1 + 3, yt - 3); c.rect('gold', x0 - 3, yt + 2, x1 + 3, yt + 2);
    for (let i = 0; i < 3; i++) glyph(c, x0 + 1 + i * 4, yt - 2, f, i);
  },
  farm(c, f) {   // setas en bancales de piedra
    R(c, 'dirt', 1, 4, 46, 46, () => 0);
    for (let r = 0; r < 4; r++) {
      const y0 = 6 + r * 10;
      R(c, 'bld_granite', 2, y0, 45, y0 + 8, (x, y) => (y === y0 ? 2 : y === y0 + 8 ? 0 : md(x + (y & 2), 6) === 5 ? 0 : 1));
      R(c, 'dirt', 4, y0 + 1, 43, y0 + 6, (x, y) => (md(x * 3 + y, 7) === 0 ? 1 : 0));
      for (let x = 6; x <= 41; x += 5) {
        const xx = x + (r & 1) * 2, y = y0 + 6;
        if (f === 0) { c.px(T('bone', 1), xx, y - 1); }
        else if (f === 1) { c.px(T('bone', 2), xx, y - 1); c.px(T('bld_mush', 1), xx, y - 2); }
        else if (f === 2) { c.rect(T('bone', 2), xx, y - 2, xx, y - 1); c.rect('bld_mush', xx - 1, y - 3, xx + 1, y - 3); c.px(T('bld_mush', 3), xx - 1, y - 3); }
        else { c.rect(T('bone', 2), xx, y - 2, xx + 1, y - 1); c.rect('bld_mush', xx - 1, y - 4, xx + 2, y - 3); c.px('bld_mush', xx, y - 5); c.px('bld_mush', xx + 1, y - 5); c.px(T('bone', 3), xx, y - 4); c.px(T('bone', 3), xx + 2, y - 3); }
      }
    }
    c.line('iron', 44, 2, 44, 12); banner(c, 41, 3, 3, 5, f, { rod: 'gold' }); c.rect('iron', 2, 4, 3, 6); c.px(f & 1 ? 'glowY' : 'window', 2, 5);
  },
};
DWA.W = {
  h: 12, face: 'bld_granite', top: 'stone',
  ff(x, y, fy, gb) { const r = y - fy, k = Math.floor(r / 4), rr = md(r, 4), xx = md(x + (k & 1) * 4, 8); if (y === gb) return 0; if (r === 0) return 2; if (r === 1) return 0; if (rr === 1 || xx === 7) return 0; return rr === 2 && xx === 0 ? 2 : 1; },
  tf: (x, y) => (md(y, 4) === 3 || md(x, 8) === 7 ? 0 : 1),
  crenH(c, x0, x1, y) { for (let x = x0; x <= x1; x++) { const q = md(x, 4); if (q < 3) { c.px(T('stone', q === 2 ? 0 : 2), x, y - 4); c.px(T('bld_granite', q === 2 ? 0 : 1), x, y - 3); c.px(T('bld_granite', q === 2 ? 0 : 1), x, y - 2); c.px(T('bld_granite', q === 2 ? 0 : 1), x, y - 1); if (q === 1) c.px('gold', x, y - 5); } } },
  crenV(c, x, y0, y1) { for (let y = y0; y <= y1; y++) c.px(T('bld_granite', md(y, 4) === 3 ? 0 : 2), x, y); },
  post(c, f) {
    wbox(c, DWA.W, 1, 14, 18, 27, 15);
    for (let x = 1; x <= 14; x++) if (md(x, 4) < 3) { c.px(T('stone', 2), x, 1); c.px(T('bld_granite', 1), x, 0); }
    DWA.W.crenH(c, 1, 14, 13); glyph(c, 6, 18, f, 1); glyph(c, 9, 20, f, 3);
    banner(c, 2, 15, 3, 7, f, { rod: 'gold', sway: 0 }); banner(c, 11, 15, 3, 7, f, { rod: 'gold', sway: 0 });
  },
  deco(c, f, m) { if (m === 10) { glyph(c, 6, 19, f, 2); c.rect('team', 10, 16, 12, 20); c.rect('gold', 10, 16, 12, 16); } if (m === 5) { c.rect('team', 7, 9, 8, 11); c.rect('gold', 7, 9, 8, 9); } },
  gate(c, f, horiz, open, Hg) {
    if (horiz) {
      c.rect('stone', 2, 13, 13, 26); c.rect(T('stone', 2), 2, 13, 13, 13); c.rect('gold', 2, 15, 13, 15); glyph(c, 6, 9, f, 0);
      c.rect(open ? 'bld_hole' : 'darkwood', 4, 16, 11, 26);
      if (!open) { tex(c, 'darkwood', 4, 16, 11, 26, P.plankV(4, 2)); c.rect('iron', 4, 18, 11, 18); c.rect('iron', 4, 23, 11, 23); c.rect('iron', 7, 16, 8, 26); for (let x = 5; x <= 10; x += 2) { c.px('gold', x, 18); c.px('gold', x, 23); } }
      else { c.rect(T('iron', 1), 4, 16, 11, 17); for (let x = 5; x <= 10; x += 2) c.px(T('iron', 0), x, 18); c.rect('bld_hole2', 4, 24, 11, 26); }
      banner(c, 0, 13, 2, 7, f, { rod: 'gold', sway: 0 }); banner(c, 14, 13, 2, 7, f, { rod: 'gold', sway: 0 });
    } else {
      const y0 = 22 - Hg, y1 = 26 - Hg;
      if (!open) { for (let y = y0; y <= y1; y++) for (let x = 4; x <= 11; x++) c.px(T('darkwood', md(x, 2) ? 1 : 2), x, y); c.rect('iron', 4, y0 + 1, 11, y0 + 1); c.rect('iron', 4, y1, 11, y1); c.px('gold', 7, y0 + 1); }
      else { c.rect('bld_hole2', 4, y0, 11, y1); for (let x = 4; x <= 11; x += 2) c.px(T('iron', 1), x, y0); }
    }
  },
  gtop(c, f, Hg) { c.rect('team', 6, 17 - Hg, 9, 20 - Hg); c.rect('gold', 6, 17 - Hg, 9, 17 - Hg); },
};

// ------------------------------------------------------------- enanos: tipos especiales
const DWAS = {
  house(c, f) { DWA.hall(c, 4, 27, 46, 14, 15, { f, door: 11, dw: 5, dh: 7, wins: [19], chim: 19, ban: [] }); banner(c, 18, 41, 3, 3, f, { rod: 'gold', sway: 0 }); },
  barracks(c, f) { G.barracks(c, f, DWA); },
  tc(c, f) {
    const g = DWA.hall(c, 8, 55, 91, 26, 26, { f, door: false, wins: [], chim: 44 });
    DWA.chim(c, 15, g.rt - 2, g.wy - 6, f);
    DWA.gable(c, 31, 14, g.wy - 2, 13, f); glyph(c, 30, g.wy - 9, f, 2);
    for (const x of [14, 46]) DWA.win(c, x, 74, 4, 4);
    banner(c, 20, 70, 4, 12, f, { rod: 'gold', emb: (x, y) => { c.px('gold', x, y); c.px('gold', x, y - 1); } }); banner(c, 39, 70, 4, 12, f, { rod: 'gold', emb: (x, y) => { c.px('gold', x, y); c.px('gold', x, y - 1); } });
    DWA.door(c, 31.5, 88, 10, 14);
    // torres flanqueantes
    for (const [x0, x1, d] of [[1, 12, -1], [51, 62, 1]]) {
      R(c, 'bld_granite', x0, 44, x1, 92, P.brick(x0, 44, 6, 4)); c.rect(T('bld_granite', 2), x0, 44, x0, 92); c.rect(T('bld_granite', 0), x1, 44, x1, 92);
      R(c, 'stone', x0 - 1, 40, x1 + 1, 44, (x, y) => (y === 40 ? 2 : md(x, 3) === 0 ? 0 : 1)); c.rect('gold', x0 - 1, 44, x1 + 1, 44);
      for (let x = x0 - 1; x <= x1 + 1; x++) if (md(x, 4) < 3) { c.px(T('bld_granite', md(x, 4) === 2 ? 0 : 1), x, 38); c.px(T('bld_granite', md(x, 4) === 2 ? 0 : 1), x, 39); c.px(T('stone', 2), x, 37); }
      DWA.win(c, x0 + 4, 56, 3, 4); glyph(c, x0 + 5, 70, f, x0); DWA.flag(c, d < 0 ? x0 + 2 : x1 - 2, 26, f, { ph: 11, dir: d < 0 ? 1 : -1 });
    }
    R(c, 'stone', 22, 92, 41, 94, (x, y) => (y === 92 ? 2 : md(x, 5) === 0 ? 0 : 1));
  },
  temple(c, f) {
    const pu = PUL[f];
    R(c, 'stone', 2, 66, 45, 69, (x, y) => (y === 66 ? 2 : md(x + (y & 1) * 3, 6) === 5 ? 0 : 1)); R(c, 'stone', 5, 63, 42, 65, (x, y) => (y === 63 ? 2 : md(x, 6) === 5 ? 0 : 1));
    DWA.roof(c, 3, 44, 34, 14, { ins: 6 });
    c.rect('bld_hole2', 8, 38, 39, 62);
    // altar-yunque rúnico brillante
    c.rect('bld_granite', 17, 55, 30, 62); c.rect(T('stone', 2), 17, 55, 30, 55); glyph(c, 19, 57, f, 0); glyph(c, 26, 57, f, 3);
    anvil(c, 20, 54); c.ell(T('rune', pu), 23.5, 44, 3.5, 3.5); c.ell(T('rune', 3), 23.5, 44, 1.5, 1.5);
    for (const x of [6, 14, 31, 39]) { R(c, 'stone', x, 38, x + 3, 62, (xx, y) => (xx === x ? 2 : xx === x + 3 ? 0 : md(y, 5) === 4 ? 0 : null)); c.rect('gold', x - 1, 38, x + 4, 39); c.rect(T('stone', 2), x - 1, 61, x + 4, 62); }
    DWA.gable(c, 23, 21, 36, 12, f); c.rect('stone', 2, 35, 45, 37); c.rect('gold', 2, 37, 45, 37); c.rect(T('stone', 2), 2, 35, 45, 35);
    glyph(c, 22, 28, f, 1); aura(c, 23.5, 30, 4, 60 + pu * 25, '#9ff8f2');
    for (const x of [1, 43]) { c.rect('iron', x, 60, x + 3, 61); c.rect('iron', x + 1, 62, x + 2, 65); flame(c, x + 1.5, 59, f, 2); }
    banner(c, 10, 41, 3, 10, f, { rod: 'gold', sway: 0 }); banner(c, 35, 41, 3, 10, f, { rod: 'gold', sway: 0 });
  },
  tower(c, f) {
    R(c, 'bld_granite', 4, 70, 27, 78, P.brick(4, 70, 8, 3, 0)); c.rect(T('bld_granite', 2), 4, 70, 27, 70);
    R(c, 'bld_granite', 6, 30, 25, 70, P.brick(6, 30, 7, 4)); c.rect(T('bld_granite', 2), 6, 30, 7, 70); c.rect(T('bld_granite', 0), 24, 30, 25, 70);
    R(c, 'stone', 4, 23, 27, 29, (x, y) => (y === 23 ? 2 : y === 29 ? 0 : md(x, 4) === 0 ? 0 : 1)); c.rect('gold', 4, 29, 27, 29);
    R(c, 'darkwood', 5, 17, 26, 20, P.plankH(17, 2));
    for (let x = 4; x <= 27; x++) if (md(x, 4) < 3) { const q = md(x, 4) === 2; c.px(T('stone', q ? 0 : 2), x, 18); c.px(T('bld_granite', q ? 0 : 1), x, 19); c.px(T('bld_granite', q ? 0 : 1), x, 20); c.px(T('bld_granite', q ? 0 : 1), x, 21); c.px(T('bld_granite', q ? 0 : 1), x, 22); if (md(x, 4) === 1) c.px('gold', x, 17); }
    c.rect('copper', 16, 19, 22, 20); c.rect(T('copper', 3), 16, 19, 22, 19); c.rect('iron', 22, 19, 23, 21);
    for (const y of [36, 52]) { c.rect('bld_hole', 11, y, 11, y + 4); c.rect('bld_hole', 20, y, 20, y + 4); }
    c.rect('rune', 10, 45, 21, 45); for (let i = 0; i < 3; i++) glyph(c, 10 + i * 4, 46, f, i);
    banner(c, 14, 32, 4, 9, f, { rod: 'gold', emb: (x, y) => c.px('gold', x, y) });
    DWA.door(c, 16, 75, 6, 8); DWA.flag(c, 8, 4, f, { ph: 13 });
  },
  castle(c, f) {
    c.poly('rock', [[0, 74], [4, 40], [14, 22], [24, 8], [32, 3], [40, 9], [50, 22], [60, 40], [63, 74]]);
    tex(c, 'rock', 0, 0, 63, 74, P.stones(0, 0, 6, 6, 11));
    c.poly('snow', [[17, 18], [24, 8], [32, 3], [40, 9], [47, 18], [41, 16], [36, 12], [31, 15], [26, 12], [21, 17]]);
    const g = DWA.hall(c, 16, 47, 82, 34, 18, { f, door: false, wins: [20, 41], chim: 40, ban: [25, 36] });
    DWA.gable(c, 31, 10, g.wy - 2, 10, f); glyph(c, 30, g.wy - 8, f, 1);
    R(c, 'bld_granite', 12, 84, 51, 109, P.brick(12, 84, 7, 4));
    R(c, 'stone', 11, 79, 52, 84, (x, y) => (y === 79 ? 2 : md(x, 4) === 0 ? 0 : 1)); c.rect('gold', 11, 84, 52, 84);
    for (let x = 11; x <= 52; x++) if (md(x, 4) < 3) { c.px(T('stone', 2), x, 76); c.px(T('bld_granite', md(x, 4) === 2 ? 0 : 1), x, 77); c.px(T('bld_granite', md(x, 4) === 2 ? 0 : 1), x, 78); }
    DWA.door(c, 31.5, 109, 12, 16); for (let i = 0; i < 4; i++) glyph(c, 24 + i * 4, 86, f, i);
    for (const [x0, x1, d] of [[1, 14, -1], [49, 62, 1]]) {
      R(c, 'bld_granite', x0, 58, x1, 110, P.brick(x0, 58, 7, 4)); c.rect(T('bld_granite', 2), x0, 58, x0, 110); c.rect(T('bld_granite', 0), x1, 58, x1, 110);
      R(c, 'stone', x0 - 1, 52, x1 + 1, 58, (x, y) => (y === 52 ? 2 : md(x, 4) === 0 ? 0 : 1)); c.rect('gold', x0 - 1, 58, x1 + 1, 58);
      DWA.roof(c, x0 - 2, x1 + 2, 51, 38, { ins: 6 });
      DWA.win(c, x0 + 5, 66, 3, 4); glyph(c, x0 + 5, 80, f, x0 + 2); c.rect('bld_hole', x0 + 6, 92, x0 + 6, 96);
      DWA.flag(c, d < 0 ? x0 + 7 : x1 - 6, 26, f, { ph: 12, dir: d < 0 ? -1 : 1 });
    }
  },
  mill(c, f) {
    const g = DWA.hall(c, 3, 19, 61, 20, 16, { f, door: 10, dw: 4, dh: 7, wins: [9], ban: [], wy: 46 });
    DWA.chim(c, 5, g.rt - 2, g.wy - 4, f, { w: 4 });
    banner(c, 14, 44, 3, 6, f, { rod: 'gold', sway: 0 });
    // canal de piedra y rueda hidráulica
    R(c, 'stone', 20, 28, 31, 31, (x, y) => (y === 28 ? 2 : md(x, 4) === 0 ? 0 : 1)); c.rect('water', 20, 29, 31, 29); c.px(T('water', 3), 22 + f * 2, 29);
    c.rect('stone', 29, 32, 31, 62); tex(c, 'stone', 29, 32, 31, 62, (x, y) => (md(y, 4) === 3 ? 0 : x === 29 ? 2 : null));
    waterwheel(c, 24, 46, 8.5, f, 'wood');
    for (let y = 32; y < 38; y++) c.px(T('water', md(y + f, 3) ? 2 : 3), 21, y);
    for (let k = 0; k < 3; k++) c.glow(19 + k * 3, 61 - md(f + k, 3), 160, '#cfe8ff');
    c.rect('water', 17, 60, 28, 62); c.px(T('water', 3), 18 + f * 2, 61);
    sack(c, 0, 62);
  },
};

// ------------------------------------------------------------- kit: ORCOS
// Pieles sobre postes, empalizadas de troncos afilados, huesos, cráneos, pinchos de hierro, tótems.
function logsV(c, x0, y0, x1, y1, pointed, seed = 0) {   // troncos verticales alternos (punta opcional)
  for (let x = x0; x <= x1; x++) {
    const k = Math.floor((x - x0) / 3), xx = md(x - x0, 3), m = (k + seed) & 1 ? 'wood' : 'darkwood', top = y0 + (pointed ? (xx === 1 ? 0 : 1) + hs(k, seed) % 3 : 0);
    for (let y = top; y <= y1; y++) c.px(T(m, y === top && pointed ? 2 : xx === 0 ? 2 : xx === 2 ? 0 : 1), x, y);
  }
}
function tusk(c, x, y, d) { c.px('bone', x, y); c.px('bone', x + d, y - 1); c.px(T('bone', 3), x + d, y - 2); c.px(T('bone', 2), x + 2 * d, y - 3); }
function spikes(c, x0, x1, y, m = 'iron') { for (let x = x0; x <= x1; x += 3) { c.px(T(m, 1), x, y); c.px(T(m, 2), x, y - 1); } }
const ORC = {
  id: 'orc', wood: 'darkwood', beam: 'darkwood', stone: 'rock', metal: 'iron', blade: 'iron', horse: 'rock',
  // Tejado-tienda de pieles: casi triangular, costuras, postes cruzados en la cima, franja pintada del equipo
  roof(c, xl, xr, yb, yt, o = {}) {
    const cx = Math.round((xl + xr) / 2), hw = (xr - xl + 1) / 2, ins = o.ins ?? Math.max(2, Math.round(hw - 3)), H = yb - yt;
    trap(c, 'bld_hide', xl, xr, yb, yt, ins);
    tex(c, 'bld_hide', xl, yt, xr, yb, (x, y) => { const r = yb - y; if (md(r, 5) === 4) return md(x, 2) ? 0 : 2; return hs(x >> 2, (r / 5) | 0) % 7 === 0 ? 0 : null; });
    for (let i = 1; i < 4; i++) { const ex = Math.round(xl + (xr - xl) * i / 4); c.line(T('bld_hide', 0), ex, yb, cx, yt + 1); }
    const py = Math.round(yb - H * 0.45);
    for (let y = py; y <= py + 1; y++) for (let x = xl; x <= xr; x++) if (c.get(x, y) && c.get(x, y).startsWith('bld_hide')) c.px(T('team', y === py ? 2 : 1), x, y);
    for (let x = xl + 1; x < xr; x++) if (md(x, 5) === 2 && c.get(x, py + 2) && c.get(x, py + 2).startsWith('bld_hide')) { c.px(T('team', 1), x, py + 2); c.px(T('team', 0), x, py + 3); }
    for (let x = xl; x <= xr; x++) if (md(x - xl, 6) === 3) c.px(null, x, yb); else if (md(x - xl, 6) === 0) c.px(T('bld_hide', 0), x, yb + 1);
    c.line('darkwood', cx - 4, yt + 3, cx + 2, yt - 3); c.line('darkwood', cx + 4, yt + 3, cx - 2, yt - 3); c.px('bone', cx + 2, yt - 4); c.px('bone', cx - 2, yt - 4);
  },
  door(c, cx, yb, w, h, o = {}) {
    const x0 = Math.round(cx - w / 2 + .01), x1 = x0 + w - 1, yt = yb - h + 1;
    c.rect('bld_hole', x0, yt + 1, x1, yb); c.rect('bld_hole', x0 + 1, yt, x1 - 1, yt);
    if (!o.open) c.poly('fur', [[x0, yt + 1], [x1 + 1, yt + 1], [x1 + 1, yt + 3], [x0 + 2, yb + 1], [x0, yb + 1]]);
    c.line('bone', x0 - 1, yb, x0 - 1, yt + 2); c.line('bone', x1 + 1, yb, x1 + 1, yt + 2); tusk(c, x0 - 1, yt + 1, 1); tusk(c, x1 + 1, yt + 1, -1);
    skull(c, Math.round(cx) - 1, yt - 4);
    return { x0, x1, yt };
  },
  win(c, x, y) { c.rect('bld_hole', x, y, x + 1, y + 1); c.px('fire', x, y + 1); c.px(T('fire', 3), x + 1, y + 1); c.line('bone', x - 1, y + 2, x + 2, y + 2); },
  chim(c, x, yt, yb, f, o = {}) {   // fogón: pila de piedras con humo negro
    const w = o.w || 5;
    R(c, 'rock', x, yt, x + w - 1, yb, P.stones(x, yt, 3, 2, 4)); spikes(c, x, x + w - 1, yt - 1, 'bone');
    if (o.forge) embers(c, x + w / 2, yt - 2, f, 3);
    smoke(c, x + w / 2 - .5, yt - 2, f, Object.assign({ col: '#6e6878', a: 200 }, o));
  },
  gable(c, xc, hw, gb, h) {   // escudo de piel redondo pintado con el equipo
    const cy = gb - h * 0.5;
    c.ell('darkwood', xc + .5, cy, 5.5, 5.5); c.ell('team', xc + .5, cy, 4.4, 4.4); c.ell(T('team', 0), xc + .5, cy, 2, 2);
    c.ring(T('iron', 1), xc + .5, cy, 5.5, 5.5, 0.75, (x, y) => md(x + y, 3) === 0);
  },
  hall(c, x0, x1, yb, wh, rh, o = {}) {
    const wy = yb - wh + 1, f = o.f || 0, cx = (x0 + x1) / 2, rt = wy - Math.round(rh * 1.15);
    c.rect('dirt', x0 - 2, yb - 1, x1 + 2, yb); tex(c, 'dirt', x0 - 2, yb - 1, x1 + 2, yb, (x, y) => (y === yb - 1 ? (md(x, 4) ? 2 : null) : 0));
    logsV(c, x0, wy - 2, x1, yb - 1, true, x0);
    for (let x = x0; x <= x1; x++) if (md(x, 3) !== 1) { c.px(T('leather', 1), x, wy + 3); c.px(T('leather', 0), x, yb - 4); }
    ORC.roof(c, x0 - 3, x1 + 3, wy, rt, { ins: o.ins });
    tusk(c, x0 - 3, wy, -1); tusk(c, x1 + 3, wy, 1);
    if (o.chim != null) smoke(c, Math.round(cx) - .5, rt - 4, f, { col: '#6e6878', a: 190 });
    if (o.gable) ORC.gable(c, o.gable.x, o.gable.hw, wy - 1, o.gable.h);
    if (o.door !== false) ORC.door(c, o.door ?? cx, yb - 1, o.dw || 5, o.dh || Math.min(wh - 3, 8), o);
    (o.wins || []).forEach(x => ORC.win(c, x, o.wy ?? wy + 5));
    spikes(c, x0 + 1, x1 - 1, yb - 1 + 0 * f, 'iron');
    return { wy, rt };
  },
  flag(c, x, y, f, o = {}) { flag(c, x, y, f, Object.assign({ pole: 'darkwood', tail: true, hgt: 5, len: 6, tip: false }, o)); skull(c, x - 1, y - 3); c.px('bone', x - 2, y - 4); c.px('bone', x + 2, y - 4); },
  awn: (c, x0, x1, y0, y1) => { awning(c, x0, x1, y0, y1, { a: 'team', b: 'bld_hide', sw: 4 }); spikes(c, x0, x1, y0 - 1, 'bone'); },
  shed(c, x0, x1, yb, yt) {
    logsV(c, x0 + 1, yt + 6, x1 - 1, yb, false, 1);
    c.rect('darkwood', x0, yt + 3, x0 + 1, yb); c.rect('darkwood', x1 - 1, yt + 3, x1, yb);
    trap(c, 'bld_hide', x0 - 2, x1 + 2, yt + 8, yt, 2); tex(c, 'bld_hide', x0 - 2, yt, x1 + 2, yt + 8, (x, y) => (md(y - yt, 4) === 3 ? (md(x, 2) ? 0 : 2) : null));
    c.rect(T('team', 1), x0 + 4, yt + 3, x1 - 4, yt + 4); tusk(c, x0 - 2, yt + 8, -1); tusk(c, x1 + 2, yt + 8, 1);
  },
  mound(c) {
    c.ell('rock', 16, 34, 15.5, 22); c.rect(null, 0, 43, 31, 60);
    tex(c, 'rock', 0, 10, 31, 42, P.stones(0, 12, 5, 4, 8));
    c.ell('dirt', 16, 14, 10, 3); spikes(c, 8, 24, 13, 'bone'); skull(c, 4, 30); skull(c, 25, 33);
  },
  portal(c, x0, x1, yb, yt) {
    c.rect('bld_hole', x0 + 1, yt + 2, x1 - 1, yb);
    c.rect('darkwood', x0 - 1, yt, x0 + 1, yb); c.rect('darkwood', x1 - 1, yt, x1 + 1, yb);
    c.rect('wood', x0 - 3, yt - 1, x1 + 3, yt + 1); c.rect(T('wood', 2), x0 - 3, yt - 1, x1 + 3, yt - 1);
    c.rect('red', x0 - 1, yt + 4, x0 + 1, yt + 4); c.rect('red', x1 - 1, yt + 6, x1 + 1, yt + 6);
    tusk(c, x0 - 3, yt, -1); tusk(c, x1 + 3, yt, 1); skull(c, Math.round((x0 + x1) / 2) - 1, yt - 3); spikes(c, x0 - 2, x1 + 2, yt - 2, 'iron');
  },
  farm(c, f) {   // calabazas en surcos, cerca tosca de palos con cráneos
    R(c, 'dirt', 2, 6, 45, 45, (x, y) => (md(y, 8) >= 6 ? 0 : md(y, 8) === 0 ? 2 : null));
    for (let x = 1; x <= 46; x += 5) { c.rect(T('darkwood', 1), x, 3, x, 7); c.rect(T('darkwood', 1), x, 43, x, 47); }
    c.line(T('wood', 0), 1, 5, 46, 5); c.line(T('wood', 0), 1, 45, 46, 45); c.line(T('wood', 0), 1, 5, 1, 45); c.line(T('wood', 0), 46, 5, 46, 45);
    skull(c, 0, 1); skull(c, 45, 1);
    for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) {
      const x = 5 + i * 7 + (r & 1) * 3, y = 12 + r * 8;
      if (x > 42) continue;
      if (f === 0) { c.px(T('leaf', 1), x, y); }
      else if (f === 1) { c.px('leaf', x, y - 1); c.px('leaf', x + 1, y); c.px(T('leaf', 2), x - 1, y); }
      else if (f === 2) { c.line('leaf', x - 2, y, x + 3, y); c.ell('bld_pumpkin', x + .5, y - 1, 1.6, 1.3); c.px(T('leaf', 2), x + 3, y - 1); }
      else { c.line('leaf', x - 3, y + 1, x + 4, y + 1); c.ell('bld_pumpkin', x + .5, y - 1, 3, 2.2); c.line(T('bld_pumpkin', 0), x, y - 2, x, y); c.px(T('bld_pumpkin', 3), x - 1, y - 2); c.px('darkwood', x, y - 4); }
    }
    flag(c, 41, 8, f, { pole: 'darkwood', tail: true, hgt: 4, len: 5, ph: 10, tip: false }); skull(c, 40, 5);
  },
};
ORC.W = {
  h: 11, face: 'darkwood', top: 'bld_logend',
  ff(x, y, fy, gb) { const k = Math.floor(x / 3), xx = md(x, 3), m = k & 1 ? 'wood' : 'darkwood'; if (y === fy + 3 || y === gb - 3) return T('leather', xx === 1 ? 0 : 1); return T(m, y === gb ? 0 : xx === 0 ? 2 : xx === 2 ? 0 : 1); },
  tf(x, y) { const xx = md(x, 3), yy = md(y, 3); return xx === 1 && yy === 1 ? 0 : (xx === 2 || yy === 2) ? T('darkwood', 1) : 2; },
  crenH(c, x0, x1, y) { for (let x = x0; x <= x1; x++) { const k = Math.floor(x / 3), xx = md(x, 3), m = k & 1 ? 'wood' : 'darkwood', h = 2 + hs(k, 5) % 2; for (let j = 1; j <= h - (xx === 1 ? 0 : 1); j++) c.px(T(m, j === h - (xx === 1 ? 0 : 1) ? 2 : xx === 2 ? 0 : 1), x, y - j); } },
  crenV(c, x, y0, y1) { for (let y = y0; y <= y1; y++) if (md(y, 3) === 1) { c.px(T('darkwood', 2), x, y); c.px(T('darkwood', 2), x, y - 1); } },
  post(c, f) {   // tótem con cráneo y estandarte
    R(c, 'wood', 5, 0, 10, 27, (x, y) => (x === 5 ? 2 : x === 10 ? 0 : md(y, 6) === 5 ? 0 : null));
    c.rect('red', 5, 7, 10, 7); c.px('eye', 6, 9); c.px('eye', 9, 9); c.rect('bone', 6, 11, 9, 11); c.px('bone', 6, 12); c.px('bone', 9, 12);
    c.rect('red', 5, 17, 10, 17); tusk(c, 4, 4, -1); tusk(c, 11, 4, 1); skull(c, 6, 1);
    banner(c, 6, 19, 4, 5, f, { rod: 'bone', sway: 0 });
  },
  deco(c, f, m) { if (m === 10) { skull(c, 7, 19); c.rect('team', 6, 22, 9, 24); } if (m === 5) { c.px('team', 7, 8); c.px('team', 8, 8); c.px(T('team', 0), 8, 9); } },
  gate(c, f, horiz, open, Hg) {
    if (horiz) {
      c.rect(open ? 'bld_hole' : 'wood', 3, 15, 12, 26);
      if (!open) { logsV(c, 3, 15, 12, 26, false, 1); c.rect(T('darkwood', 0), 3, 18, 12, 18); c.rect(T('darkwood', 0), 3, 23, 12, 23); c.line('darkwood', 3, 23, 12, 18); }
      else { c.rect('bld_hole2', 3, 24, 12, 26); }
      c.rect('darkwood', 1, 10, 2, 26); c.rect('darkwood', 13, 10, 14, 26); tusk(c, 2, 13, 1); tusk(c, 13, 13, -1); skull(c, 6, 10);
      banner(c, 0, 11, 2, 6, f, { rod: 'bone', sway: 0 }); banner(c, 14, 11, 2, 6, f, { rod: 'bone', sway: 0 });
    } else {
      const y0 = 22 - Hg, y1 = 26 - Hg;
      if (!open) { for (let y = y0; y <= y1; y++) for (let x = 4; x <= 11; x++) c.px(T(md(x, 3) === 2 ? 'darkwood' : 'wood', md(x, 3) === 0 ? 2 : 1), x, y); c.rect(T('leather', 0), 4, y0 + 2, 11, y0 + 2); }
      else c.rect('bld_hole2', 4, y0, 11, y1);
    }
  },
  gtop(c, f, Hg) { skull(c, 6, 16 - Hg); c.px('team', 9, 17 - Hg); c.px('team', 10, 17 - Hg); c.px('team', 10, 18 - Hg); },
};

// ------------------------------------------------------------- orcos: tipos especiales
const ORCS = {
  house(c, f) {   // tienda de pieles con postes cruzados y humo
    c.rect('dirt', 2, 45, 29, 46);
    c.poly('bld_hide', [[3, 46], [29, 46], [17, 10], [15, 10]]);
    tex(c, 'bld_hide', 3, 10, 29, 46, (x, y) => (md(46 - y, 6) === 5 ? (md(x, 2) ? 0 : 2) : hs(x >> 2, y / 6 | 0) % 7 === 0 ? 0 : null));
    c.line(T('bld_hide', 0), 9, 46, 16, 12); c.line(T('bld_hide', 0), 23, 46, 16, 12);
    c.poly('fur', [[7, 46], [12, 46], [14, 30]]); c.poly('bld_hole', [[12, 46], [20, 46], [16, 30]]); c.poly('fur', [[18, 46], [24, 46], [16, 31], [17, 31]]);
    c.rect('team', 8, 24, 23, 25); for (let x = 9; x < 23; x += 4) { c.px(T('team', 0), x, 26); c.px(T('team', 0), x + 1, 27); }
    c.line('darkwood', 12, 14, 20, 4); c.line('darkwood', 19, 14, 12, 4); c.line('darkwood', 16, 12, 16, 3); skull(c, 15, 16);
    tusk(c, 3, 45, -1); tusk(c, 28, 45, 1);
    smoke(c, 15.5, 2, f, { col: '#6e6878', a: 180 });
  },
  tc(c, f) {
    const g = ORC.hall(c, 6, 57, 90, 18, 26, { f, door: false, wins: [12, 20, 42, 50], chim: 1 });
    // gran tótem central con cuernos
    R(c, 'wood', 27, 30, 36, 90, (x, y) => (x === 27 ? 2 : x === 36 ? 0 : md(y, 12) === 11 ? 0 : null));
    for (const y of [36, 52, 68]) { c.rect('red', 27, y, 36, y); c.rect('eye', 29, y + 3, 29, y + 3); c.rect('eye', 34, y + 3, 34, y + 3); c.rect('bone', 29, y + 6, 34, y + 6); c.px('bone', 29, y + 7); c.px('bone', 34, y + 7); }
    c.rect('fur', 25, 28, 38, 31); tusk(c, 25, 29, -1); tusk(c, 38, 29, 1); c.line('bone', 23, 27, 21, 21); c.line('bone', 40, 27, 42, 21); c.px('bone', 20, 20); c.px('bone', 43, 20);
    skull(c, 30, 25); skull(c, 32, 22);
    ORC.door(c, 31.5, 89, 8, 12);
    for (const x of [3, 58]) { c.rect('iron', x, 84, x + 3, 85); c.rect('iron', x + 1, 86, x + 2, 91); flame(c, x + 1.5, 83, f, 2); }
    ORC.flag(c, 10, 30, f, { ph: 22 }); ORC.flag(c, 53, 30, f, { ph: 22, dir: -1 });
    banner(c, 15, 68, 4, 8, f, { rod: 'bone' }); banner(c, 45, 68, 4, 8, f, { rod: 'bone' });
    spikes(c, 0, 63, 92, 'iron');
  },
  temple(c, f) {
    const pu = PUL[f];
    c.rect('dirt', 2, 66, 45, 68);
    c.ell('bld_hide', 23.5, 52, 18, 16); c.rect(null, 0, 63, 47, 71);
    tex(c, 'bld_hide', 0, 30, 47, 62, (x, y) => (md(y, 5) === 4 ? (md(x, 2) ? 0 : 2) : null));
    for (const d of [-1, 1]) for (let i = 0; i < 4; i++) c.line(T('bld_hide', 0), 23.5 + d * (4 + i * 4), 62, 23.5 + d * (2 + i * 2), 37 + i);
    c.rect('team', 8, 47, 39, 48); for (let x = 9; x < 39; x += 5) c.px(T('team', 0), x, 49);
    // gran cráneo de bestia sobre la entrada
    c.rect('bld_hole', 18, 54, 29, 65); c.rect('bld_hole', 19, 53, 28, 53);
    c.ell('bone', 23.5, 46, 7, 5); c.rect('bone', 19, 47, 28, 52); c.rect('ol', 20, 46, 22, 48); c.rect('ol', 25, 46, 27, 48);
    c.px(T('glowR', 0), 21, 47); c.px('glowR', 26, 47); c.rect('ol', 23, 50, 24, 51); for (let x = 19; x <= 28; x += 2) c.px(T('bone', 3), x, 53);
    tusk(c, 17, 52, -1); tusk(c, 30, 52, 1); c.line('bone', 17, 42, 13, 36); c.line('bone', 30, 42, 34, 36); c.px('bone', 12, 35); c.px('bone', 35, 35);
    for (const x of [2, 41]) { R(c, 'wood', x, 40, x + 4, 66, (xx, y) => (xx === x ? 2 : xx === x + 4 ? 0 : md(y, 8) === 7 ? 0 : null)); c.rect('red', x, 44, x + 4, 44); c.px(pu > 1 ? 'glowG' : T('purple', 2), x + 1, 47); c.px(pu > 1 ? 'glowG' : T('purple', 2), x + 3, 47); skull(c, x + 1, 37); }
    flame(c, 23.5, 69, f, 2); c.rect('darkwood', 19, 69, 28, 70); c.line('darkwood', 20, 68, 27, 70);
    aura(c, 23.5, 66, 8, 50 + pu * 20, '#b8ff8a');
    for (let k = 0; k < 3; k++) c.glow(Math.round(23.5 + Math.sin(k * 2 + f) * 4), 62 - md(f * 3 + k * 4, 12), 220, '#b8ff8a');
    ORC.flag(c, 40, 24, f, { ph: 12 });
  },
  tower(c, f) {
    for (const [a, b] of [[6, 10], [21, 25]]) { c.line('darkwood', a, 79, b, 28); c.line('darkwood', a + 1, 79, b + 1, 28); }
    for (let y = 36; y < 76; y += 12) { c.line('wood', 8, y + 10, 23, y); c.line('wood', 23, y + 10, 8, y); }
    for (let y = 40; y < 78; y += 4) c.rect('wood', 14, y, 17, y); c.rect('darkwood', 14, 38, 14, 78); c.rect('darkwood', 17, 38, 17, 78);
    logsV(c, 4, 22, 27, 33, true, 2); c.rect(T('leather', 0), 4, 27, 27, 27); c.rect('wood', 3, 32, 28, 34); c.rect(T('wood', 2), 3, 32, 28, 32);
    banner(c, 12, 35, 7, 9, f, { rod: 'bone', emb: (x, y) => skull(c, Math.round(x) - 1, Math.round(y) - 1) });
    ORC.roof(c, 3, 28, 21, 2, { ins: 11 });
    skull(c, 4, 19); skull(c, 25, 19); spikes(c, 4, 27, 21, 'iron');
    ORC.flag(c, 28, 8, f, { ph: 12 });
  },
  castle(c, f) {
    // fortaleza central: base de piedra, cuerpo de troncos y gran tienda con cuernos
    R(c, 'rock', 16, 66, 47, 88, P.stones(16, 66, 5, 5, 8));
    logsV(c, 18, 40, 45, 66, false, 0); for (let x = 18; x <= 45; x++) if (md(x, 3) !== 1) { c.px(T('leather', 0), x, 46); c.px(T('leather', 0), x, 60); }
    ORC.roof(c, 13, 50, 40, 6, { ins: 16 }); c.line('bone', 22, 30, 17, 16); c.line('bone', 41, 30, 46, 16); c.line('bone', 17, 16, 15, 12); c.line('bone', 46, 16, 48, 12);
    ORC.win(c, 24, 50); ORC.win(c, 38, 50); banner(c, 29, 47, 6, 12, f, { rod: 'bone', emb: (x, y) => skull(c, Math.round(x) - 1, Math.round(y) - 1) });
    // empalizada frontal con puerta
    logsV(c, 12, 82, 51, 109, true, 1); for (let x = 12; x <= 51; x++) if (md(x, 3) !== 1) { c.px(T('leather', 0), x, 88); c.px(T('leather', 0), x, 103); }
    c.rect('bld_hole', 25, 92, 38, 109); logsV(c, 26, 94, 37, 109, false, 0); c.line(T('darkwood', 0), 26, 99, 37, 99); c.line('darkwood', 26, 108, 37, 99);
    c.rect('darkwood', 23, 86, 24, 109); c.rect('darkwood', 39, 86, 40, 109); c.rect('wood', 21, 89, 42, 91); tusk(c, 22, 89, -1); tusk(c, 41, 89, 1); skull(c, 30, 86);
    spikes(c, 12, 51, 82, 'iron');
    // torres de vigía laterales
    for (const [x0, d] of [[1, -1], [49, 1]]) {
      c.line('darkwood', x0 + 1, 110, x0 + 2, 62); c.line('darkwood', x0 + 12, 110, x0 + 11, 62);
      for (let y = 70; y < 106; y += 12) { c.line('wood', x0 + 2, y + 10, x0 + 11, y); c.line('wood', x0 + 11, y + 10, x0 + 2, y); }
      logsV(c, x0, 52, x0 + 13, 62, true, x0); c.rect('wood', x0 - 1, 61, x0 + 14, 63);
      ORC.roof(c, x0 - 2, x0 + 15, 51, 36, { ins: 7 }); skull(c, x0 + 5, 56);
      ORC.flag(c, d < 0 ? x0 + 1 : x0 + 12, 26, f, { ph: 9, dir: d });
    }
    for (const x of [8, 52]) { c.rect('iron', x, 104, x + 3, 105); flame(c, x + 1.5, 103, f, 1); }
  },
  mill(c, f) {
    logsV(c, 10, 30, 21, 61, false, 0); c.poly(null, [[9, 30], [12, 30], [9, 62]]); c.poly(null, [[20, 30], [23, 30], [23, 62]]);
    for (let x = 9; x <= 22; x++) if (md(x, 3) !== 1) { c.px(T('leather', 0), x, 38); c.px(T('leather', 0), x, 52); }
    c.rect('dirt', 6, 61, 25, 62); ORC.door(c, 16, 61, 4, 7); ORC.roof(c, 8, 23, 30, 16, { ins: 6 });
    sails(c, 16, 25, 14, f, { cloth: 'bld_hide', spar: 'darkwood', frame: 'darkwood', w0: 2, w1: 5 });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + f * PI / 8; c.px(T('team', 1), 16 + Math.cos(a) * 9 - Math.sin(a) * 2, 25 + Math.sin(a) * 9 + Math.cos(a) * 2); c.px(T('team', 1), 16 + Math.cos(a) * 11 - Math.sin(a) * 3, 25 + Math.sin(a) * 11 + Math.cos(a) * 3); }
    skull(c, 15, 21); sack(c, 1, 62); sack(c, 25, 62);
  },
};

// ------------------------------------------------------------- kit: GIGANTES
// Megalitos, troncos gruesos, techos de tepe con hierba, piedras rúnicas, escala tosca.
function menhir(c, x, yb, w, h, f, o = {}) {   // piedra en pie con runa y tira de tela del equipo
  const yt = yb - h + 1;
  R(c, 'rock', x, yt + 1, x + w - 1, yb, (xx, y) => (xx === x ? 2 : xx === x + w - 1 ? 0 : hs(xx, y >> 1) % 9 === 0 ? 0 : null));
  c.rect('rock', x + 1, yt, x + w - 2, yt); c.px(T('rock', 3), x + 1, yt);
  if (o.rune !== false) glyph(c, x + (w >> 1) - 1, yt + 3, f, o.v || x);
  if (o.cloth) { c.rect('team', x, yt + h * 0.55, x + w - 1, yt + h * 0.55 + 1); c.px('team', x + w, yt + h * 0.55 + 2); c.px(T('team', 0), x + w, yt + h * 0.55 + 3 + (f & 1)); }
}
const GIA = {
  id: 'giant', wood: 'wood', beam: 'darkwood', stone: 'rock', metal: 'iron', blade: 'rock', horse: 'fur',
  wall(c, x0, y0, x1, y1) { R(c, 'rock', x0, y0, x1, y1, P.stones(x0, y0, 5, 5, 9)); },
  log(c, x, y0, y1, w = 4) { R(c, 'wood', x, y0, x + w - 1, y1, (xx, y) => (xx === x ? 2 : xx === x + w - 1 ? 0 : hs(xx, y >> 1) % 6 === 0 ? 0 : null)); c.rect('bld_logend', x, y0, x + w - 1, y0); c.px(T('bld_logend', 0), x + 1, y0); },
  logH(c, x0, x1, y, h = 3) { R(c, 'wood', x0, y, x1, y + h - 1, P.logH(y, h)); for (const x of [x0, x1]) { c.rect('bld_logend', x, y, x, y + h - 1); c.px(T('bld_logend', 0), x, y + (h >> 1)); } },
  roof(c, xl, xr, yb, yt, o = {}) {   // cúpula de tepe con flecos de hierba, flores y piedras
    const cx = (xl + xr + 1) / 2, hw = (xr - xl + 1) / 2, H = yb - yt + 1;
    c.ring('bld_turf', cx, yb + 1, hw, H, -1, (x, y) => y <= yb);
    tex(c, 'bld_turf', xl, yt, xr, yb, P.turf(Math.round(xl), yt));
    for (let x = Math.round(xl) + 1; x < xr; x++) if (md(x, 3) !== 0) c.px(T('bld_turf', md(x, 2) ? 1 : 0), x, yb + 1 + (md(x, 5) === 1 ? 1 : 0));
    for (let i = 0; i < Math.round(hw / 3); i++) { const x = Math.round(xl + 3 + hs(i, Math.round(xl)) % Math.max(1, Math.round(hw * 2 - 6))), y = Math.round(yb - 2 - hs(i, 9) % Math.max(1, H - 4)); if (c.get(x, y) && c.get(x, y).startsWith('bld_turf')) c.px(['red', 'gold', 'snow', 'gold'][i % 4], x, y); }
  },
  door(c, cx, yb, w, h, o = {}) {   // trilito con cortina de piel del equipo
    const x0 = Math.round(cx - w / 2 + .01), x1 = x0 + w - 1, yt = yb - h + 1;
    c.rect('bld_hole', x0, yt, x1, yb);
    if (!o.open) { c.rect('team', x0, yt, x1, yt + 2); c.poly('team', [[x0, yt + 2], [x0 + 3, yt + 2], [x0 + 1, yb + 1], [x0, yb + 1]]); c.poly('team', [[x1 - 2, yt + 2], [x1 + 1, yt + 2], [x1 + 1, yb + 1], [x1, yb + 1]]); tex(c, 'team', x0, yt, x1, yb, (x, y) => (md(x, 3) === 2 ? 0 : y === yt ? 2 : null)); }
    menhir(c, x0 - 3, yb, 3, h + 1, 0, { rune: false }); menhir(c, x1 + 1, yb, 3, h + 1, 0, { rune: false });
    R(c, 'stone', x0 - 4, yt - 3, x1 + 4, yt - 1, (x, y) => (y === yt - 3 ? 2 : y === yt - 1 ? 0 : null));
    return { x0, x1, yt };
  },
  win(c, x, y) { c.ell('stone', x + 1, y + 1, 2.4, 2.2); c.ell('bld_hole', x + 1, y + 1, 1.4, 1.3); c.px('window', x, y + 1); c.px('window', x + 1, y + 1); },
  chim(c, x, yt, yb, f, o = {}) {
    const w = o.w || 6;
    R(c, 'rock', x, yt, x + w - 1, yb, P.stones(x, yt, 3, 3, 5)); c.rect(T('rock', 2), x, yt, x + w - 1, yt);
    if (o.forge) embers(c, x + w / 2, yt - 1, f, 3);
    smoke(c, x + w / 2 - .5, yt - 1, f, Object.assign({ col: '#a49eae', a: 180 }, o));
  },
  gable(c, xc, hw, gb, h, f = 0) { menhir(c, xc - 3, gb + 1, 7, h + 2, f, { v: 2 }); },
  hall(c, x0, x1, yb, wh, rh, o = {}) {
    const wy = yb - wh + 1, f = o.f || 0, cx = (x0 + x1) / 2, rt = wy - rh;
    GIA.wall(c, x0, wy + 3, x1, yb);
    GIA.log(c, x0 - 1, wy, yb, 4); GIA.log(c, x1 - 2, wy, yb, 4);
    GIA.roof(c, x0 - 4, x1 + 4, wy, rt);
    GIA.logH(c, x0 - 3, x1 + 3, wy, 3);
    if (o.chim != null) { c.ell('rock', o.chim + 1, rt + 3, 2.5, 1.5); c.px('bld_hole', o.chim + 1, rt + 3); smoke(c, o.chim + .5, rt + 1, f, { col: '#a49eae', a: 180 }); }
    if (o.gable) GIA.gable(c, o.gable.x, o.gable.hw, wy - 1, o.gable.h, f);
    if (o.door !== false) GIA.door(c, o.door ?? cx, yb, o.dw || 6, o.dh || Math.min(wh - 5, 9), o);
    (o.wins || []).forEach(x => GIA.win(c, x, o.wy ?? wy + 6));
    (o.ban || []).forEach(x => { c.rect('team', x, wy + 3, x + 2, wy + 9); c.px('team', x + 1, wy + 10); tex(c, 'team', x, wy + 3, x + 2, wy + 9, (xx, y) => (y === wy + 3 ? 2 : null)); });
    return { wy, rt };
  },
  flag(c, x, y, f, o = {}) { flag(c, x, y, f, Object.assign({ pole: 'wood', tail: true, hgt: 5, len: 7, tip: false }, o)); c.rect('wood', x - 1, y, x - 1, y + (o.ph || 10)); c.rect('bld_logend', x - 1, y - 1, x, y - 1); },
  awn: (c, x0, x1, y0, y1) => { awning(c, x0, x1, y0, y1, { a: 'team', b: 'fur', sw: 4 }); c.rect('wood', x0 - 1, y0 - 1, x1 + 1, y0); },
  shed(c, x0, x1, yb, yt) {
    GIA.wall(c, x0 + 1, yt + 8, x1 - 1, yb);
    GIA.log(c, x0 - 1, yt + 5, yb, 4); GIA.log(c, x1 - 2, yt + 5, yb, 4);
    GIA.roof(c, x0 - 3, x1 + 3, yt + 7, yt);
  },
  mound(c) {
    for (const [x, y, rx, ry] of [[16, 30, 15, 14], [7, 34, 7, 9], [25, 33, 7, 10], [16, 18, 9, 7]]) c.ell('rock', x, y, rx, ry);
    c.rect(null, 0, 43, 31, 60); tex(c, 'rock', 0, 0, 31, 42, P.stones(0, 4, 6, 6, 10));
    c.ell('bld_turf', 16, 13, 8, 3); tex(c, 'bld_turf', 0, 8, 31, 16, P.turf(0, 10));
  },
  portal(c, x0, x1, yb, yt, f) {
    c.rect('bld_hole', x0, yt + 3, x1, yb);
    menhir(c, x0 - 3, yb, 4, yb - yt - 1, f, { rune: false }); menhir(c, x1, yb, 4, yb - yt - 1, f, { rune: false });
    R(c, 'stone', x0 - 5, yt - 1, x1 + 5, yt + 3, (x, y) => (y === yt - 1 ? 2 : y === yt + 3 ? 0 : null)); glyph(c, Math.round((x0 + x1) / 2) - 1, yt, f, 1);
  },
  farm(c, f) {   // coles enormes en hileras, borde de piedras y menhir con tela
    R(c, 'dirt', 3, 6, 44, 44, (x, y) => (md(y, 9) >= 7 ? 0 : md(y, 9) === 0 ? 2 : null));
    for (let x = 1; x <= 45; x += 6) { c.ell('rock', x + 2.5, 4.5, 3, 2.2); c.ell('rock', x + 2.5, 45.5, 3, 2.2); }
    for (let y = 9; y <= 42; y += 6) { c.ell('rock', 2, y + .5, 2, 2.6); c.ell('rock', 45, y + .5, 2, 2.6); }
    tex(c, 'rock', 0, 0, 47, 47, (x, y) => (hs(x, y) % 5 === 0 ? 0 : null));
    for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) {
      const x = 7 + i * 8 + (r & 1) * 3, y = 13 + r * 9;
      if (x > 34 && r === 0) continue;
      if (f === 0) c.px(T('bld_cabbage', 0), x, y);
      else if (f === 1) { c.px('bld_cabbage', x, y - 1); c.px('bld_cabbage', x - 1, y); c.px('bld_cabbage', x + 1, y); }
      else if (f === 2) { c.ell('bld_cabbage', x + .5, y - 1, 2.4, 2); c.px(T('bld_cabbage', 3), x, y - 2); }
      else { c.ell(T('bld_cabbage', 0), x + .5, y - 1, 3.8, 3); c.ell('bld_cabbage', x + .5, y - 1.5, 2.8, 2.4); c.line(T('bld_cabbage', 3), x, y - 3, x + 1, y - 1); c.px(T('bld_cabbage', 3), x - 1, y - 2); }
    }
    menhir(c, 38, 17, 5, 13, f, { cloth: true });
  },
};
GIA.W = {
  h: 12, face: 'rock', top: 'bld_turf',
  ff: (() => { const st = P.stones(0, 0, 5, 5, 9); return (x, y, fy, gb) => { if (y === gb) return 0; const v = st(x, y - fy); return v == null ? 1 : v; }; })(),
  tf(x, y) { const v = P.turf(0, 0)(x, y); return v == null ? 1 : v; },
  crenH(c, x0, x1, y) { for (let x = x0; x <= x1; x++) { const k = Math.floor(x / 4), xx = md(x, 4), h = 2 + hs(k, 11) % 3; if (xx === 3) { c.px(T('bld_turf', 1), x, y - 1); continue; } for (let j = 1; j <= h - (xx === 1 ? 0 : 1); j++) c.px(T('rock', j === h - (xx === 1 ? 0 : 1) ? 3 : xx === 2 ? 0 : 1), x, y - j); } },
  crenV(c, x, y0, y1) { for (let y = y0; y <= y1; y++) if (md(y, 4) === 1) { c.px(T('rock', 2), x, y); c.px(T('rock', 1), x, y + 1); } },
  post(c, f) { wbox(c, GIA.W, 3, 12, 19, 27, 13); menhir(c, 4, 22, 8, 22, f, { cloth: true, v: 3 }); },
  deco(c, f, m) { if (m === 10) { c.rect('team', 6, 18, 9, 20); c.px('team', 7, 21); c.px(T('team', 0), 9, 21); } if (m === 5) { c.px('team', 7, 9); c.px('team', 8, 9); } },
  gate(c, f, horiz, open, Hg) {
    if (horiz) {
      c.rect('bld_hole', 4, 15, 11, 26);
      if (!open) { for (let x = 4; x <= 11; x++) for (let y = 15; y <= 26; y++) c.px(T('wood', md(x, 4) === 0 ? 2 : md(x, 4) === 3 ? 0 : 1), x, y); c.rect(T('darkwood', 1), 4, 18, 11, 19); c.rect(T('darkwood', 1), 4, 23, 11, 24); }
      else c.rect('bld_hole2', 4, 24, 11, 26);
      menhir(c, 1, 27, 3, 15, f, { rune: false }); menhir(c, 12, 27, 3, 15, f, { rune: false });
      R(c, 'stone', 0, 10, 15, 13, (x, y) => (y === 10 ? 2 : y === 13 ? 0 : null)); glyph(c, 6, 10, f, 0);
      c.rect('team', 6, 14, 9, 16); c.px(T('team', 0), 7, 17);
    } else {
      const y0 = 22 - Hg, y1 = 26 - Hg;
      if (!open) { for (let y = y0; y <= y1; y++) for (let x = 4; x <= 11; x++) c.px(T('wood', md(x, 4) === 0 ? 2 : 1), x, y); c.rect(T('darkwood', 1), 4, y0 + 2, 11, y0 + 2); }
      else c.rect('bld_hole2', 4, y0, 11, y1);
    }
  },
  gtop(c, f, Hg) { c.rect('team', 6, 17 - Hg, 9, 19 - Hg); },
};

// ------------------------------------------------------------- gigantes: tipos especiales
const GIAS = {
  house(c, f) { GIA.hall(c, 6, 25, 46, 13, 15, { f, door: 13, dw: 6, dh: 7, wins: [20], chim: 11 }); },
  tc(c, f) {
    const g = GIA.hall(c, 6, 57, 90, 22, 28, { f, door: false, wins: [12, 47], chim: 18, ban: [19, 42] });
    smoke(c, 46, g.rt + 2, f, { col: '#a49eae', a: 170 });
    // gran trilito de entrada con runa
    c.rect('bld_hole', 26, 72, 37, 90); c.rect('team', 26, 72, 37, 75); tex(c, 'team', 26, 72, 37, 75, (x) => (md(x, 3) === 2 ? 0 : null));
    menhir(c, 21, 91, 5, 28, f, { rune: false }); menhir(c, 38, 91, 5, 28, f, { rune: false });
    R(c, 'stone', 18, 59, 45, 64, (x, y) => (y === 59 ? 2 : y === 64 ? 0 : hs(x, y) % 11 === 0 ? 0 : null)); glyph(c, 30, 60, f, 2); glyph(c, 34, 60, f, 0);
    menhir(c, 0, 93, 6, 34, f, { cloth: true, v: 1 }); menhir(c, 58, 93, 6, 34, f, { cloth: true, v: 3 });
    GIA.flag(c, 31, 16, f, { ph: 18 });
    R(c, 'stone', 23, 91, 40, 93, (x, y) => (y === 91 ? 2 : null));
  },
  temple(c, f) {   // círculo de piedras con altar rúnico brillante
    const pu = PUL[f];
    c.ell('bld_turf', 23.5, 56, 22, 12); tex(c, 'bld_turf', 0, 40, 47, 70, P.turf(0, 44));
    const ring = (back) => { for (let k = 0; k < 8; k++) { const a = PI * (back ? 1 : 0) + PI * (k + .5) / 8, x = Math.round(23.5 + Math.cos(a) * 19) - 2, y = Math.round(56 + Math.sin(a) * 9); if ((Math.sin(a) < 0) === back) menhir(c, x, y, 5, back ? 20 : 17, f, { v: k, rune: !back }); } };
    ring(true);
    R(c, 'rock', 16, 54, 31, 60, (x, y) => (y === 54 ? 2 : y === 60 ? 0 : null)); c.rect(T('rock', 3), 16, 54, 31, 54);
    glyph(c, 18, 56, f, 0); glyph(c, 22, 56, f, 1); glyph(c, 26, 56, f, 3);
    c.ell(T('rune', pu), 23.5, 48, 3, 3); c.ell(T('rune', 3), 23.5, 48, 1.4, 1.4);
    aura(c, 23.5, 46, 10, 50 + pu * 30, '#9ff8f2');
    for (let k = 0; k < 4; k++) c.glow(Math.round(23.5 + Math.sin(k * 1.7 + f) * 6), 44 - md(f * 3 + k * 4, 14), 220, '#9ff8f2');
    ring(false);
    GIA.flag(c, 3, 22, f, { ph: 18 });
  },
  tower(c, f) {   // torre de megalitos apilados con plataforma de troncos
    const blocks = [[6, 70, 25, 78], [7, 61, 24, 69], [6, 52, 25, 60], [8, 43, 23, 51], [7, 34, 24, 42]];
    blocks.forEach(([x0, y0, x1, y1], i) => { R(c, 'rock', x0, y0, x1, y1, (x, y) => (y === y0 ? 2 : y === y1 ? 0 : x === x0 ? 2 : x === x1 ? 0 : (md(x + i * 3, 7) === 0 && y < y1 - 1) ? 0 : null)); c.px(null, x0, y0); c.px(null, x1, y0); });
    glyph(c, 15, 63, f, 0); glyph(c, 15, 45, f, 2);
    c.rect('bld_hole', 14, 72, 17, 78); c.rect('team', 14, 72, 17, 74);
    GIA.logH(c, 3, 28, 30, 4);
    for (let x = 4; x <= 27; x += 4) GIA.log(c, x, 18 + (md(x, 8) ? 1 : 0), 30, 3);
    c.rect('wood', 4, 22, 27, 23); c.rect(T('wood', 2), 4, 22, 27, 22);
    banner(c, 12, 34, 7, 10, f, { rod: 'wood', emb: (x, y) => c.px('gold', x, y) });
    GIA.flag(c, 16, 3, f, { ph: 15 });
  },
  castle(c, f) {
    const g = GIA.hall(c, 14, 49, 74, 20, 22, { f, door: false, wins: [20, 41], chim: 24, ban: [30] });
    menhir(c, 28, 50, 8, 24, f, { cloth: true, v: 2 });
    GIA.wall(c, 10, 84, 53, 109); GIA.W.crenH(c, 10, 53, 84);
    c.rect('bld_hole', 25, 90, 38, 109); for (let x = 26; x <= 37; x++) for (let y = 92; y <= 109; y++) c.px(T('wood', md(x, 4) === 0 ? 2 : md(x, 4) === 3 ? 0 : 1), x, y);
    c.rect(T('darkwood', 1), 26, 96, 37, 97); c.rect(T('darkwood', 1), 26, 103, 37, 104);
    menhir(c, 21, 110, 5, 22, f, { rune: false }); menhir(c, 38, 110, 5, 22, f, { rune: false });
    R(c, 'stone', 18, 84, 45, 89, (x, y) => (y === 84 ? 2 : y === 89 ? 0 : null)); glyph(c, 30, 85, f, 1);
    for (const [x0, d] of [[1, -1], [48, 1]]) {
      GIA.wall(c, x0, 52, x0 + 14, 110); GIA.log(c, x0 - 1, 50, 110, 3); GIA.log(c, x0 + 13, 50, 110, 3);
      GIA.roof(c, x0 - 3, x0 + 17, 48, 34); GIA.logH(c, x0 - 2, x0 + 16, 48, 3);
      glyph(c, x0 + 6, 70, f, x0); GIA.win(c, x0 + 6, 58);
      GIA.flag(c, x0 + 7, 20, f, { ph: 14, dir: d });
    }
  },
  mill(c, f) {
    c.poly('rock', [[8, 62], [24, 62], [21, 30], [11, 30]]); tex(c, 'rock', 7, 30, 25, 62, P.stones(0, 30, 5, 4, 7));
    GIA.door(c, 16, 61, 5, 7);
    GIA.roof(c, 7, 24, 30, 17); GIA.logH(c, 8, 23, 30, 2);
    sails(c, 16, 26, 14, f, { cloth: 'wood', spar: 'darkwood', frame: 'darkwood', w0: 3, w1: 4, lattice: true });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + f * PI / 8; c.px(T('team', 2), 16 + Math.cos(a) * 12 - Math.sin(a) * 2, 26 + Math.sin(a) * 12 + Math.cos(a) * 2); c.px(T('team', 1), 16 + Math.cos(a) * 12 - Math.sin(a) * 3, 26 + Math.sin(a) * 12 + Math.cos(a) * 3); }
    sack(c, 2, 62); sack(c, 26, 62); c.ell('rock', 4, 58, 3, 2);
  },
};

// ------------------------------------------------------------- neutrales
const NEU = {
  bandit_camp: [48, 56, (c, f) => {   // tiendas raídas, fogata, botín
    c.rect('dirt', 4, 46, 44, 53); tex(c, 'dirt', 4, 46, 44, 53, (x, y) => (hs(x, y) % 6 === 0 ? 0 : hs(x, y) % 7 === 0 ? 2 : null)); c.px(null, 4, 46); c.px(null, 44, 46); c.px(null, 4, 53); c.px(null, 44, 53);
    // tienda principal en A con remiendos
    c.poly('bld_rag', [[2, 44], [26, 44], [15, 18], [13, 18]]);
    tex(c, 'bld_rag', 2, 18, 26, 44, (x, y) => (md(44 - y, 6) === 5 ? (md(x, 2) ? 0 : null) : null));
    c.rect('sack', 6, 34, 9, 37); c.rect(T('cloth', 1), 18, 28, 20, 31); c.rect(T('red', 0), 15, 38, 18, 40);
    c.poly('bld_hole', [[10, 44], [18, 44], [14, 30]]); c.poly('sack', [[17, 44], [21, 44], [14, 31]]);
    c.line('darkwood', 10, 22, 18, 13); c.line('darkwood', 18, 22, 10, 13);
    // lona tendida sobre un palo
    c.line('darkwood', 30, 46, 30, 26); c.line('darkwood', 45, 46, 45, 34);
    c.poly('sack', [[29, 26], [31, 26], [46, 34], [46, 37], [29, 30]]); tex(c, 'sack', 28, 25, 46, 38, (x, y) => (md(x, 4) === 3 ? 0 : null));
    c.rect('bld_hole2', 32, 36, 44, 46); crate(c, 34, 46, 5); barrel(c, 39, 46);
    // cofre del botín
    c.rect('wood', 37, 48, 44, 53); c.rect(T('wood', 2), 37, 48, 44, 48); c.rect('iron', 37, 50, 44, 50); c.rect('gold', 40, 50, 41, 51);
    c.rect('gold', 38, 47, 43, 47); c.px(T('gold', 3), 39, 47); c.glow(42, 45 - (f & 1), 200, '#ffe98a');
    // fogata con piedras, troncos y humo
    for (let k = 0; k < 7; k++) { const a = k * PI * 2 / 7; c.rect('rock', 24 + Math.cos(a) * 4, 50 + Math.sin(a) * 1.8, 24 + Math.cos(a) * 4 + 1, 50 + Math.sin(a) * 1.8); }
    c.line('darkwood', 21, 51, 27, 49); c.line('darkwood', 21, 49, 27, 51); flame(c, 24, 50, f, 2);
    aura(c, 24, 47, 9, 70, '#ffb050'); smoke(c, 24, 42, f, { col: '#9a94a6', a: 120 }); embers(c, 24, 44, f, 2);
    logSide(c, 11, 18, 54, 'wood', 3); logSide(c, 29, 35, 55, 'wood', 3);
    // estandarte rojo harapiento
    flag(c, 4, 10, f, { m: 'red', pole: 'darkwood', ph: 34, len: 7, hgt: 5, tail: true, tip: false }); skull(c, 3, 7);
    c.line('darkwood', 44, 53, 46, 41); c.px('steel', 46, 40); c.px('steel', 46, 39); c.line('darkwood', 42, 54, 43, 42); c.px('steel', 43, 41);
  }],
  ruins: [32, 44, (c, f) => {   // columnas rotas sobre losas agrietadas
    R(c, 'stone', 1, 33, 30, 42, (x, y) => (y === 33 ? 2 : y >= 41 ? 0 : md(x + (y > 37 ? 3 : 0), 7) === 6 || y === 37 ? 0 : null));
    c.line(T('stone', 0), 9, 34, 12, 39); c.line(T('stone', 0), 21, 38, 24, 42); c.rect(null, 27, 40, 30, 42); c.rect(null, 1, 41, 3, 42);
    // columna en pie con capitel y dintel roto
    R(c, 'stone', 4, 10, 9, 35, (x, y) => (x === 4 ? 2 : x === 9 ? 0 : x === 6 ? 1 : x === 7 ? 0 : null)); c.rect('stone', 3, 7, 10, 9); c.rect(T('stone', 2), 3, 7, 10, 7);
    c.rect('stone', 3, 4, 18, 6); c.rect(T('stone', 2), 3, 4, 18, 4); c.px(null, 18, 6); c.px(null, 17, 6); c.px(null, 18, 5); c.line(T('stone', 0), 3, 6, 16, 6);
    c.rect('stone', 3, 35, 10, 36); c.rect(T('stone', 0), 3, 36, 10, 36);
    // columna partida
    R(c, 'stone', 21, 21, 26, 36, (x, y) => (x === 21 ? 2 : x === 26 ? 0 : x === 23 ? 1 : x === 24 ? 0 : null));
    c.px(null, 21, 21); c.px(null, 22, 21); c.px(null, 26, 21); c.px(null, 26, 22); c.px(T('stone', 3), 23, 21); c.rect('stone', 20, 36, 27, 37); c.rect(T('stone', 0), 20, 37, 27, 37);
    // tambores caídos y escombros
    c.ell('stone', 15, 37.5, 4, 2.5); c.ell(T('stone', 2), 13, 37.5, 1.5, 2); c.ring(T('stone', 0), 13, 37.5, 1.5, 2, 0.4);
    c.ell('stone', 28, 30, 2.2, 2.6); c.px(T('stone', 3), 27, 29); c.rect('stone', 12, 30, 14, 31); c.px('stone', 17, 32);
    for (const [x, y] of [[5, 15], [8, 24], [22, 30], [25, 25], [10, 34], [2, 38]]) { c.px('moss', x, y); c.px(T('moss', 2), x, y + 1); }
    c.line('leaf', 9, 10, 9, 18); c.px('leaf', 10, 13); c.px('leaf', 10, 16);
    flag(c, 25, 12, f, { m: 'purple', pole: 'darkwood', ph: 9, len: 5, hgt: 4, tail: true, tip: false });
    c.glow(15 + (f & 1), 26 - f, 160, '#d8e8ff');
  }],
  shrine: [32, 52, (c, f) => {   // santuario antiguo con orbe brillante que custodia un tesoro
    const pu = PUL[f];
    R(c, 'stone', 1, 46, 30, 50, (x, y) => (y === 46 ? 2 : y === 50 ? 0 : md(x + (y & 1) * 3, 6) === 5 ? 0 : null));
    R(c, 'stone', 4, 42, 27, 45, (x, y) => (y === 42 ? 2 : md(x, 6) === 5 ? 0 : null));
    c.rect('bld_hole2', 7, 24, 24, 41);
    c.rect('stone', 12, 34, 19, 41); c.rect(T('stone', 2), 12, 34, 19, 34); glyph(c, 14, 36, f, 1, 'bld_glass');
    c.ell(T('orb', pu), 15.5, 30, 3, 3); c.px(T('orb', 3), 14, 29); c.px('white', 15, 29);
    for (const x of [5, 23]) { R(c, 'stone', x, 24, x + 3, 42, (xx, y) => (xx === x ? 2 : xx === x + 3 ? 0 : md(y, 6) === 5 ? 0 : null)); c.rect(T('stone', 2), x - 1, 23, x + 4, 23); }
    c.rect('stone', 3, 19, 28, 23); c.rect(T('stone', 2), 3, 19, 28, 19); c.rect(T('stone', 0), 3, 23, 28, 23); glyph(c, 9, 20, f, 0, 'bld_glass'); glyph(c, 20, 20, f, 2, 'bld_glass');
    trap(c, 'stone', 2, 29, 18, 6, 12); tex(c, 'stone', 2, 6, 29, 18, P.slate(2, 19, 5, 3)); c.rect(T('stone', 3), 14, 4, 17, 6);
    c.ell(T('orb', pu), 15.5, 2.5, 1.6, 1.6);
    aura(c, 15.5, 30, 12, 40 + pu * 25, '#9ff8f2'); aura(c, 15.5, 3, 6, 60 + pu * 25, '#9ff8f2');
    // cofre del tesoro con destellos
    c.rect('wood', 20, 45, 27, 50); c.rect(T('wood', 2), 20, 45, 27, 45); c.rect('gold', 20, 47, 27, 47); c.rect('gold', 23, 47, 24, 48); c.rect('gold', 20, 45, 20, 50); c.rect('gold', 27, 45, 27, 50);
    c.glow(22 + f * 2 % 6, 43, 230, '#fff2a0');
    for (const [x, y] of [[3, 30], [28, 34], [2, 44], [29, 40]]) c.px('moss', x, y);
  }],
  goblin_hut: [32, 44, (c, f) => {   // choza destartalada de tablas y remiendos, farol verde
    c.rect('dirt', 2, 41, 29, 42);
    c.poly('wood', [[5, 42], [27, 42], [26, 24], [6, 26]]);
    tex(c, 'wood', 4, 24, 28, 42, (x, y) => (md(x + (y > 33 ? 2 : 0), 4) === 3 ? 0 : hs(x >> 2, y > 33 ? 1 : 0) % 3 === 0 ? 2 : null));
    c.rect('darkwood', 10, 29, 16, 31); c.rect('darkwood', 18, 34, 25, 35);
    c.poly('bld_hole', [[9, 42], [16, 42], [15, 32], [10, 33]]); c.rect('leather', 9, 33, 10, 42);
    c.rect('bld_hole', 20, 28, 23, 31); c.px(f & 1 ? 'glowG' : T('bld_elfglass', 3), 21, 30);
    // tejado torcido de remiendos
    c.poly('bld_hide', [[1, 27], [30, 23], [24, 10], [9, 13]]);
    tex(c, 'bld_hide', 0, 9, 31, 28, (x, y) => (md(y + Math.floor(x / 6), 4) === 3 ? 0 : null));
    c.rect('sack', 6, 20, 11, 23); c.rect('bld_rag', 18, 14, 22, 18); c.rect(T('leather', 1), 23, 19, 27, 21);
    c.line('darkwood', 8, 12, 4, 6); c.line('darkwood', 23, 10, 27, 4); skull(c, 14, 9);
    // chimenea de tubo con humo
    c.rect('iron', 22, 4, 24, 12); c.rect(T('iron', 2), 21, 3, 25, 4); smoke(c, 23, 2, f, { col: '#8f9a7e', a: 160 });
    // farol verde, olla y huesos
    c.line('darkwood', 28, 42, 28, 30); c.line('darkwood', 28, 30, 30, 30); c.rect('iron', 29, 31, 30, 33); c.px(f & 1 ? 'glowG' : T('bld_elfglass', 2), 29, 32); c.glow(31, 32, 120, '#b8ff8a'); c.glow(31, 31, 80, '#b8ff8a');
    c.ell('iron', 4, 41, 3, 2); c.rect(T('bld_elfglass', 1), 2, 39, 6, 39); c.glow(3 + (f & 1) * 2, 37 - (f >> 1), 200, '#b8ff8a');
    c.line('bone', 18, 42, 21, 41); c.px('bone', 22, 41); skull(c, 24, 39);
  }],
};

// ------------------------------------------------------------- registro
const SZ = { tc: [64, 96], house: [32, 48], barracks: [48, 64], range: [48, 56], stable: [48, 56], workshop: [48, 64], temple: [48, 72], forge: [32, 52], market: [48, 56], tower: [32, 80], castle: [64, 112], mill: [32, 64], lumber: [32, 44], mine: [32, 44], farm: [48, 48], wall: [16, 32], gate: [16, 32] };
const KITS = { human: HUM, elf: ELF, dwarf: DWA, orc: ORC, giant: GIA }, SPECIAL = { human: HUMS, elf: ELFS, dwarf: DWAS, orc: ORCS, giant: GIAS };
for (const r of Object.keys(KITS)) for (const t of Object.keys(SZ)) {
  const fn = (SPECIAL[r] && SPECIAL[r][t]) || G[t]; if (!fn) continue;
  const [w, h] = SZ[t], K = KITS[r];
  B[r + '_' + t] = {
    w, h, frames: t === 'gate' ? 2 : 4, masks: (t === 'wall' || t === 'gate') || undefined,
    render: { shadow: (t === 'farm' || t === 'wall' || t === 'gate') ? false : { cx: w / 2 + 1, cy: h - 2, rx: w / 2 - 1, ry: 2.2, a: 60 } },
    draw(c, f, o) { fn(c, f, K, o || {}); },
  };
}
for (const k of Object.keys(NEU)) { const [w, h, fn] = NEU[k]; B['neutral_' + k] = { w, h, frames: 4, render: { shadow: { cx: w / 2 + 1, cy: h - 2, rx: w / 2 - 1, ry: 2.2, a: 60 } }, draw(c, f) { fn(c, f); } }; }
})();
