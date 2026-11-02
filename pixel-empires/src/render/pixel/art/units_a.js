import { PE } from '../sprite.js';
/* =====================================================================
   Pixel Empires — arte de unidades A: humanos, elfos y enanos (24 claves)
   ---------------------------------------------------------------------
   * Humanoides 32×32 ancla 16,29. Montados y asedio 40×32 ancla 20,29,
     perfil 3⁄4 mirando a la DERECHA (patas y ruedas animadas con P.t).
   * Todos atacan hacia la derecha salvo human_ranged, que conserva el arco
     a la izquierda del diseño Python aprobado (face: -1).
   * Ataque: atk 1 preparación, 2 golpe/disparo (sale el proyectil),
     3 seguimiento, 0 vuelta. Trabajadores dibujan o.carry.
   ===================================================================== */
(function () {
const U = PE.ART.units, PI = Math.PI;

PE.addMats({
  ua_horse: '#8a5432', ua_mane: '#3b2a24', ua_hoof: '#4a3c3a', ua_meat: '#c8564a', ua_grain: '#e3c48c',
  ua_deer: '#e8e0d0', ua_antler: '#cdb68a', ua_wool: '#d8cba8', ua_ramface: '#5e4a3e', ua_horn: '#c9a26e',
  ua_elfgreen: '#97c46a', ua_lightwood: '#d8b47c', ua_bronze: '#a8733f', ua_rbeard: '#c4602e',
  ua_bbeard: '#86502c', ua_gbeard: '#a8a4ae', ua_flower: '#f08cc4', ua_smoke: '#b8b2c6', ua_wax: '#efe2c0',
  ua_gem: '#72e88a', ua_blond: '#c4a25e',
});
PE.addEmissive('ua_gem');

// ------------------------------------------------------------- utilidades
// marco rotado: origen (gx,gy) = empuñadura, ang en grados (0 = arriba, + horario)
const rf = (gx, gy, ang) => { const r = ang * PI / 180, cs = Math.cos(r), sn = Math.sin(r); return (x, y) => [gx + x * cs - y * sn, gy + x * sn + y * cs]; };
const rp = (t, m, T, pts) => t.poly(m, pts.map(p => T(p[0], p[1])));
const rl = (t, m, T, x0, y0, x1, y1) => { const a = T(x0, y0), b = T(x1, y1); t.line(m, a[0], a[1], b[0], b[1]); };
const rb = (t, m, T, y0, y1, w = 2, x = 0) => rp(t, m, T, [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, y1], [x - w / 2, y1]]);
const re = (t, m, T, x, y, rx, ry) => { const p = T(x, y); t.ell(m, p[0], p[1], rx, ry ?? rx); };
// tramo grueso (w líneas paralelas en x)
function limb(c, m, x0, y0, x1, y1, w = 2) { for (let i = 0; i < w; i++) c.line(m, x0 + i, y0, x1 + i, y1); }
// brazo genérico: manga desde el hombro hasta la mano y puño de 2×2
function arm(c, sl, hand, x0, y0, x1, y1) { limb(c, sl, x0, y0, x1, y1, 2); c.rect(hand, Math.round(x1), Math.round(y1), Math.round(x1) + 1, Math.round(y1) + 1); }
// brillo alrededor de un segmento (sólo sobre fondo vacío)
function glowSeg(c, x0, y0, x1, y1, r, a, hex) {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++)
    for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
      const u = Math.max(0, Math.min(1, ((x + .5 - x0) * dx + (y + .5 - y0) * dy) / L));
      const d = Math.hypot(x + .5 - x0 - u * dx, y + .5 - y0 - u * dy);
      if (d <= r) c.glow(x, y, d < r * .55 ? a : a * .55, hex);
    }
}
const halo = (c, x, y, r, a, hex) => glowSeg(c, x, y, x, y, r, a, hex);
// estela de golpe: arco de brillo blanco entre dos ángulos (grados, 0 = arriba)
function smear(c, cx, cy, r, a0, a1, a = 80) {
  for (let g = a0; g <= a1; g += 4) for (const rr of [r, r - 1]) {
    const t = g * PI / 180; c.glow(Math.floor(cx + Math.sin(t) * rr), Math.floor(cy - Math.cos(t) * rr), rr === r ? a : a * .6, '#ffffff');
  }
}
const star = (c, m, x, y) => { c.px(m, x, y); c.px(m, x - 1, y); c.px(m, x + 1, y); c.px(m, x, y - 1); c.px(m, x, y + 1); };
// piernas: L, R = [x0, x1]; y0 arriba, yb inicio de la bota (botas 1 px hacia fuera)
function legs(c, P, m, boot, L, R, y0, yb, cuff) {
  c.at(0, P.ll, () => { c.rect(m, L[0], y0, L[1], yb - 1); c.rect(boot, L[0] - 1, yb, L[1], 29); if (cuff) c.rect(cuff, L[0] - 1, yb, L[1], yb); });
  c.at(0, P.lr, () => { c.rect(m, R[0], y0, R[1], yb - 1); c.rect(boot, R[0], yb, R[1] + 1, 29); if (cuff) c.rect(cuff, R[0], yb, R[1] + 1, yb); });
}
// rueda con radios que giran (cx, cy centro; ang en radianes)
function wheel(c, cx, cy, r, ang, m = 'darkwood', sp = 'wood', n = 2, hub = 'iron', fill) {
  if (fill) c.ell(fill, cx, cy, r - 1, r - 1);
  c.ring(m, cx, cy, r, r, ((r - 1.5) / r) ** 2);
  for (let k = 0; k < n; k++) {
    const t = ang + k * PI / n, dx = Math.cos(t) * (r - 1.2), dy = Math.sin(t) * (r - 1.2);
    c.line(sp, cx - .5 - dx, cy - .5 - dy, cx - .5 + dx, cy - .5 + dy);
  }
  c.ell(hub, cx, cy, 1.2, 1.2);
}
const spin = P => (P.anim === 'walk' ? P.t * PI / 8 : 0);

// bulto del trabajador colgando de la mano izquierda (x, y = mano)
function bundle(c, k, x, y) {
  if (k === 'food') { // cesta de mimbre con carne, bayas y hojas
    c.ring('darkwood', x - .5, y + 2, 3.4, 3.4, .6, (px, py) => py < y + 2);          // asa
    c.ell('leaf', x - 2.5, y + 1.5, 1.6, 1.2);
    c.ell('ua_meat', x + .5, y + 1, 2.2, 1.7); c.px('ua_meat.3', x, y); c.rect('bone', x + 2, y - 1, x + 3, y - 1); c.px('bone', x + 3, y - 2);
    c.px('red', x - 3, y + 2); c.px('red', x - 2, y + 1); c.px('red.2', x - 1, y + 2); c.px('purple', x - 2, y + 2);
    c.poly('thatch', [[x - 4, y + 2.5], [x + 3.5, y + 2.5], [x + 2.5, y + 7], [x - 3, y + 7]]);
    c.rect('thatch.2', x - 4, y + 3, x + 2, y + 3); c.dither('thatch.0', x - 3, y + 4, x + 2, y + 6, 0, 'thatch');
  } else { // saco con mineral asomando
    const ore = k === 'gold' ? 'gold' : k === 'stone' ? 'stone' : 'iron';
    c.ell('sack', x - .5, y + 4.6, 3.8, 3); c.poly('sack', [[x - 3, y + 2.5], [x + 1.5, y + 2.5], [x + 1, y + 1], [x - 2.5, y + 1]]);
    c.ell(ore, x - 2.3, y + .9, 1.8, 1.5); c.ell(ore, x + .3, y + .2, 1.7, 1.5); c.ell(ore, x - 1, y - .8, 1.3, 1.1);
    if (k === 'gold') { c.px('gold.3', x - 3, y); c.px('gold.3', x, y - 1); c.px('gold.0', x - 1, y + 1); }
    if (k === 'stone') { c.px('stone.3', x - 3, y); c.px('stone.0', x - 1, y + 1); c.px('stone.3', x, y - 1); }
    if (k === 'iron') { c.px('copper', x - 3, y + 1); c.px('copper', x + 1, y); c.px('iron.3', x - 1, y - 1); }
    c.rect('leather', x - 3, y + 2, x + 1, y + 2); c.px('sack.0', x - 1, y + 5);
  }
}
// troncos al hombro (x0, y0 = esquina superior izquierda del haz)
function logs(c, x0, y0, len = 12) {
  for (const [dx, dy] of [[2, 0], [0, 3]]) {
    c.rect('wood', x0 + dx + 1, y0 + dy, x0 + len, y0 + dy + 2);
    c.rect('wood.0', x0 + dx + 4, y0 + dy + 2, x0 + dx + 6, y0 + dy + 2); c.rect('wood.2', x0 + dx + 7, y0 + dy, x0 + dx + 9, y0 + dy);
    c.rect('ua_grain', x0 + dx, y0 + dy, x0 + dx + 1, y0 + dy + 2); c.px('ua_grain.0', x0 + dx + 1, y0 + dy + 1);
  }
  c.rect('leather', x0 + 8, y0, x0 + 8, y0 + 5);
}

// ===================================================================== HUMANOS
// ---- Aldeano (portado de make_sprites.py) + trabajo y bulto
U.human_worker = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P, o) {
    const b = P.body, a = P.atk, k = o && o.carry;
    legs(c, P, 'pants', 'leather', [12, 14], [17, 19], 24, 28);
    c.at(0, b, () => {
      c.rect('cloth', 11, 15, 20, 24); c.rect('cloth', 12, 24, 19, 25);
      c.rect('team', 11, 20, 20, 21); c.rect('leather', 13, 15, 14, 15);
      c.rect('skin', 14, 15, 17, 16); c.px('cloth', 15, 17);
    });
    c.at(P.sw, b, () => c.rect('team', 15, 22, 16, 25));
    if (k === 'wood') c.at(0, b, () => logs(c, 0, 10, 13));
    // brazo izquierdo y saco (contrafase)
    c.at(0, b + (k === 'wood' ? 0 : P.s), () => {
      if (k === 'wood') { c.rect('cloth', 9, 16, 11, 18); c.rect('skin', 7, 16, 8, 17); c.rect('skin', 8, 17, 9, 18); }
      else {
        c.rect('cloth', 9, 16, 11, 18); c.rect('skin', 9, 19, 10, 22);
        if (k) bundle(c, k, 8, 21); else { c.ell('sack', 8, 24.5, 3, 2.6); c.rect('leather', 7, 21, 9, 22); }
      }
    });
    // brazo derecho con hacha: en trabajo la alza (1), tala en diagonal (2) y sigue (3)
    const G = [[0, 25, 21.5], [-10, 25, 17], [100, 16, 19], [115, 16, 19]][a], T = rf(G[1], G[2], G[0]);
    c.at(0, b - (a ? 0 : P.s), () => {
      c.rect('cloth', 20, 16, 22, 18);
      if (!a) c.rect('skin', 22, 19, 23, 22); else limb(c, 'skin', 21, 19, G[1] - 1, G[2] - 1);
      c.rim((t, m) => rb(t, m, T, -13.5, 4.5), 'wood');
      c.rim((t, m) => rp(t, m, T, [[0, -14.5], [4.5, -16], [5.5, -8.5], [0, -9.5]]), 'steel');
      rp(c, 'blade', T, [[4, -14.5], [5, -14.5], [5, -8.5], [4, -8.5]]);
      if (!a) c.rect('skin', 22, 21, 25, 22); else c.rect('skin', G[1] - 1, G[2] - 1, G[1], G[2]);
      if (a === 2) smear(c, G[1], G[2], 15, 5, 95);
    });
    c.at(0, b, () => {
      c.ell('skin', 15.5, 10.4, 4.7, 4.9);
      c.rect('hair', 11, 8, 12, 12); c.rect('hair', 19, 8, 20, 12);
      c.px('eye', 14, 11); c.px('eye', 17, 11); c.px('mouth', 15, 13); c.px('mouth', 16, 13);
      c.px('skin', 15, 12); c.px('skin', 16, 12);
    });
    c.at(0, b + P.sec, () => c.ell('straw', 15.5, 7.4, 8.3, 2.1));
    c.at(0, b, () => { c.ell('straw', 15.5, 5.2, 4.7, 3.4); c.rect('team', 11, 6, 20, 7); c.px('straw', 11, 8); c.px('straw', 20, 8); });
  },
};

// ---- Espadachín (idéntico al ejemplo de referencia)
U.human_inf = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    c.at(0, P.ll, () => { c.rect('steel', 11, 22, 14, 27); c.rect('leather', 10, 27, 14, 29); });
    c.at(0, P.lr, () => { c.rect('steel', 17, 22, 20, 27); c.rect('leather', 17, 27, 21, 29); });
    c.at(0, b, () => {
      c.rect('team', 11, 15, 20, 24);
      c.poly('steel', [[10, 14], [21, 14], [20.5, 20], [11.5, 20]]);
      c.rect('steel', 14, 15, 17, 19); c.line('gold', 15, 15, 15, 18); c.line('gold', 16, 15, 16, 18);
      c.rect('leather', 10, 20, 21, 21); c.rect('gold', 15, 20, 16, 21);
    });
    c.at(P.sw, b, () => { c.rect('team', 12, 25, 14, 25); c.rect('team', 17, 25, 19, 25); });
    c.at(0, b, () => { c.ell('steel', 9.5, 15.5, 3, 2.6); c.ell('steel', 22.5, 15.5, 3, 2.6); });
    const sy = a === 1 ? -3 : a === 2 ? 2 : a === 3 ? 3 : 0, sx = a === 2 ? -2 : a === 3 ? -3 : 0;
    c.at(sx, b - P.s + sy, () => {
      c.rect('steel', 22, 17, 24, 22); c.rect('leather', 22, 21, 24, 22);
      c.rim((t, m) => { t.rect(m, 26, 5, 27, 19); t.px(m, 26, 4); t.px(m, 27, 4); t.px(m, 26, 3); t.rect(m, 24, 20, 29, 21); t.rect(m, 26, 22, 27, 24); t.rect(m, 25, 25, 28, 25); }, 'blade');
      c.rect('gold', 24, 20, 29, 21); c.rect('leather', 26, 22, 27, 24); c.rect('gold', 25, 25, 28, 25);
    });
    if (a === 2) c.at(0, b, () => smear(c, 20, 18, 11, 10, 80));
    c.at(a ? 1 : 0, b + P.s, () => {
      c.rim((t, m) => t.ell(m, 6.5, 19.5, 5.3, 6), 'steel');
      c.ell('team', 6.5, 19.5, 4, 4.7); c.rect('white', 6, 15, 6, 24); c.rect('white', 3, 19, 10, 19); c.ell('gold', 6.5, 19.5, 1.6, 1.6);
    });
    c.at(0, b, () => {
      c.ell('skin', 15.5, 10, 5, 5.2); c.ell('steel', 15.5, 8.2, 5.8, 5.4);
      c.rect('steel', 10, 9, 11, 14); c.rect('steel', 20, 9, 21, 14);
      c.rect('skin', 12, 10, 19, 14); c.px(null, 12, 14); c.px(null, 19, 14);
      c.rect('steel', 15, 9, 16, 12); c.px('eye', 13, 12); c.px('eye', 18, 12); c.px('mouth', 15, 14); c.px('mouth', 16, 14);
      c.rect('steel', 10, 8, 21, 8);
    });
    c.at(P.sec === 0 ? P.sw : 0, b + P.sec, () => { c.ell('team', 15.5, 2.4, 2.4, 2.6); c.rect('team', 15, 1, 19, 2); c.rect('team', 18, 2, 20, 5); });
    c.at(0, b, () => c.rect('gold', 13, 5, 18, 5));
  },
};

// ---- Lancero: casco abierto, gambesón con tabardo, pica larga
U.human_pike = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    legs(c, P, 'pants', 'leather', [12, 14], [17, 19], 23, 27);
    c.at(0, b, () => {
      c.rect('cloth', 11, 15, 20, 24);
      c.rect('cloth.0', 11, 18, 20, 18); c.rect('cloth.0', 11, 23, 20, 23); // pespuntes del gambesón
      c.rect('team', 13, 15, 18, 25); c.rect('gold', 13, 15, 18, 15);
      c.rect('gold', 15, 17, 16, 20); c.rect('gold', 14, 18, 17, 18);   // cruz del tabardo
      c.rect('leather', 11, 21, 20, 21); c.rect('steel', 15, 21, 16, 21);
      c.ell('cloth', 9.8, 16, 2.6, 2.2); c.ell('cloth', 21.2, 16, 2.6, 2.2);
    });
    c.at(P.sw, b, () => { c.px('team', 13, 26); c.px('team', 15, 26); c.px('team', 16, 26); c.px('team', 18, 26); });
    // brazo izquierdo: suelto en reposo, sujeta la pica en ataque
    c.at(0, b + (a ? 0 : P.s), () => {
      if (!a) { c.rect('cloth', 8, 17, 10, 20); c.rect('skin', 8, 21, 9, 22); }
      else if (a === 1) arm(c, 'cloth', 'skin', 9, 17, 12, 22);
      else arm(c, 'cloth', 'skin', 9, 17, 10, 18);
    });
    // pica: vertical (0), bajando (1), estocada (2), recoge (3)
    const G = [[0, 25, 20.5], [45, 16.5, 21], [90, 10, 18.5], [90, 8, 18.5]][a], T = rf(G[1], G[2], G[0]);
    const front = a >= 2;
    const pike = () => {
      c.rim((t, m) => rb(t, m, T, -15, 9.5), 'wood');
      c.rim((t, m) => rp(t, m, T, [[0, -21], [1.8, -17.5], [1, -15], [-1, -15], [-1.8, -17.5]]), 'blade');
      rb(c, 'steel', T, -15.5, -14.5, 2); rl(c, 'blade.3', T, 0, -19.5, 0, -16);
      c.at(P.anim === 'walk' ? P.sw : 0, P.sec, () => rp(c, 'team', T, [[1, -14], [5.5, -13.5], [4, -12.5], [5.5, -11], [1, -11]]));
    };
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!front) pike();
      if (!a) { c.rect('cloth', 20, 17, 22, 19); c.rect('skin', 22, 20, 25, 21); }
      else arm(c, 'cloth', 'skin', 21, 17, a === 1 ? 17 : 17, a === 1 ? 20 : 18);
    });
    c.at(0, b, () => {
      c.ell('skin', 15.5, 10.4, 4.7, 4.9);
      c.rect('hair', 11, 9, 12, 12); c.rect('hair', 19, 9, 20, 12);
      c.px('eye', 14, 11); c.px('eye', 17, 11); c.px('mouth', 15, 13); c.px('mouth', 16, 13);
      c.rect('leather', 11, 12, 11, 14); c.rect('leather', 20, 12, 20, 14); // barboquejo
      c.ell('steel', 15.5, 8.6, 7.6, 1.6);               // ala del casco abierto
      c.ell('steel', 15.5, 6.2, 4.6, 3.6);               // copa
      c.rect('steel.0', 11, 8, 20, 8); c.rect('steel.3', 15, 3, 15, 6);
      c.px('gold', 12, 7); c.px('gold', 19, 7);
    });
    if (front) c.at(0, b, () => {
      pike();
      const h = T(0, 0), h2 = T(0, -8);
      c.rect('skin', Math.round(h[0]) - 1, Math.round(h[1]) - 1, Math.round(h[0]), Math.round(h[1]));
      c.rect('skin', Math.round(h2[0]) - 1, Math.round(h2[1]) - 1, Math.round(h2[0]), Math.round(h2[1]));
      if (a === 2) for (let x = 2; x < 9; x += 2) c.glow(x, 19, 70, '#ffffff');
    });
  },
};

// ---- Arquero (portado de make_sprites.py) + tensado y disparo
U.human_ranged = {
  w: 32, h: 32, ax: 16, ay: 29, face: -1,
  draw(c, P) {
    const b = P.body, sw = P.sw, a = P.atk;
    c.poly('cloak', [[10, 13 + b], [21, 13 + b], [22 + sw, 20 + b], [9 + sw, 20 + b]]);
    c.at(0, P.ll, () => { c.rect('pants', 12, 22, 14, 26); c.rect('leather', 11, 26, 14, 29); c.rect('gold', 11, 26, 14, 26); });
    c.at(0, P.lr, () => { c.rect('pants', 17, 22, 19, 26); c.rect('leather', 17, 26, 20, 29); c.rect('gold', 17, 26, 20, 26); });
    c.at(0, b, () => c.rim((t, m) => t.rect(m, 21, 9, 23, 20), 'leather'));
    c.at(0, b + P.sec, () => { c.px('feather', 21, 7); c.px('feather', 22, 7); c.px('team', 22, 8); c.px('team', 23, 8); c.px('feather', 21, 8); });
    c.at(0, b, () => {
      c.rect('tunic', 11, 15, 20, 23); c.rect('leather', 12, 15, 19, 20);
      c.rect('leather', 11, 21, 20, 21); c.rect('gold', 15, 21, 16, 21);
      c.rect('team', 12, 22, 19, 22); c.rect('tunic', 12, 23, 19, 24);
    });
    // brazo derecho: cuelga (0), tensa la cuerda (1), suelta (2), vuelve (3)
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!a) { c.rect('tunic', 21, 15, 22, 19); c.rect('leather', 21, 18, 22, 20); c.px('skin', 21, 21); c.px('skin', 22, 21); }
      else if (a === 1) { c.rect('tunic', 14, 14, 22, 15); c.rect('leather', 14, 14, 15, 15); c.rect('skin', 12, 14, 13, 16); }
      else if (a === 2) { c.rect('tunic', 18, 13, 22, 14); c.rect('skin', 16, 12, 17, 13); }
      else { c.rect('tunic', 21, 15, 22, 18); c.rect('leather', 20, 17, 21, 18); c.rect('skin', 19, 18, 20, 19); }
    });
    c.at(0, b + P.s, () => {
      c.rect('tunic', 9, 15, 10, 18); c.rect('leather', 9, 18, 10, 19);
      c.rect('skin', 7, 16, 8, 18);
      c.ring('wood', 8, 15.5, a === 1 ? 6.3 : 5.4, a === 1 ? 11 : 11.5, .62, x => x <= 8);
      if (a === 1) { // cuerda tensa y flecha montada
        c.line('string', 8, 5, 12, 15); c.line('string', 12, 16, 8, 26);
        c.line('wood', 1, 15, 12, 15); c.px('steel', 0, 15); c.px('steel', 1, 14); c.px('steel', 1, 16);
        c.px('feather', 11, 14); c.px('team', 10, 14); c.px('feather', 11, 16); c.px('team', 10, 16);
      } else c.line('string', a === 2 ? 7 : 8, 4, a === 2 ? 7 : 8, 27);
    });
    c.at(0, b, () => {
      c.ell('hood', 15.5, 8.6, 6.2, 6.4);
      c.poly('hood', [[10.5, 13], [20.5, 13], [21, 16], [10, 16]]);
      c.rect('skin', 12, 9, 19, 13); c.px(null, 12, 13); c.px(null, 19, 13);
      c.rect('hood', 12, 8, 19, 8); c.rect('hood', 12, 9, 13, 9); c.rect('hood', 18, 9, 19, 9);
      c.px('eye', 14, 11); c.px('eye', 17, 11); c.px('white', 14, 10); c.px('white', 17, 10);
      c.px('mouth', 15, 13); c.px('mouth', 16, 13);
    });
    if (a === 1) c.at(0, b, () => { c.rect('skin', 12, 14, 13, 16); c.px('string', 12, 15); });
    c.at(P.sec === 0 ? sw : 0, b + P.sec, () => c.poly('hood', [[15.5, 0], [19, 4], [12, 4]]));
  },
};

// ---- Mago (portado de make_sprites.py; túnica del color del equipo) + conjuro
U.human_special = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, sw = P.sw, a = P.atk;
    c.poly('team', [[11, 16 + b], [20, 16 + b], [23.5 + sw, 29], [8.5 + sw, 29]]);
    c.rect('gold', 9 + sw, 27, 23 + sw, 28);
    c.at(0, b, () => { c.rect('hat', 12, 20, 19, 21); c.rect('gold', 15, 20, 16, 21); });
    c.line('hat', 15, 22 + b, 14 + sw, 27); c.line('hat', 16, 22 + b, 17 + sw, 27);
    c.at(0, P.ll, () => c.rect('leather', 11, 29, 14, 29));
    c.at(0, P.lr, () => c.rect('leather', 17, 29, 20, 29));
    // manga izquierda: en el conjuro la mano se alza con chispas
    c.at(0, b + (a ? 0 : P.s), () => {
      if (a === 1 || a === 2) {
        c.poly('team', [[7, 16], [11, 16], [10, 20], [6, 20]]); c.rect('gold', 5, 19, 9, 19); c.ell('skin', 5.5, 17.5, 1.5, 1.5);
        if (a === 2) { star(c, 'glowC', 3, 14); halo(c, 3.5, 14.5, 3, 90, '#6ef0f5'); }
      } else { c.poly('team', [[7, 16], [11, 16], [11, 22], [6, 23]]); c.rect('gold', 6, 22, 11, 22); c.ell('skin', 6.5, 24, 1.5, 1.5); }
    });
    // báculo: se adelanta y el orbe destella al lanzar (atk 2)
    const dx = [0, 1, 2, 1][a], dy = [0, -1, -1, 0][a];
    c.at(0, b - P.s, () => {
      c.poly('team', [[20, 16], [24, 16], [25, 22], [20, 22]]);
      c.rect('gold', 20, 22, 25, 22);
    });
    c.at(dx, b - P.s + dy, () => {
      c.rim((t, m) => t.rect(m, 26, 7, 27, 29), 'wood');
      c.rect('gold', 25, 6, 28, 7); c.rect('skin', 24 - dx, 22, 26, 24);
    });
    c.at(dx, b - P.s + dy + (a ? 0 : P.sec), () => {
      c.ell('orb', 26.5, 3.4, 2.7, 2.7); c.px('white', 25, 2);
      const gl = a ? [0, 2.2, 3.6, 2][a] : P.glow * .9;
      if (gl) halo(c, 26.5, 3.4, 2.7 + gl, a === 2 ? 150 : 110, '#6ef0f5');
      if (a === 2) { star(c, 'glowC', 28, 1); c.px('white', 26, 3); }
    });
    c.at(0, b, () => {
      c.ell('skin', 15.5, 12.5, 3.9, 3.3);
      c.poly('beard', [[11.8, 13], [19.2, 13], [18.2, 19], [15.5, 23], [12.8, 19]]);
      c.rect('skin', 14, 12, 17, 13);
      c.px('eye', 14, 12); c.px('eye', 17, 12);
      c.rect('white', 13, 11, 14, 11); c.rect('white', 17, 11, 18, 11);
      c.rect('skin', 15, 13, 16, 14);
    });
    c.at(sw, b, () => c.rect('beard', 15, 22, 16, 23));
    c.at(0, b, () => {
      c.poly('hat', [[15.5, -1], [17.5, 4], [20, 10], [11, 10], [13, 4]]);
      c.ell('hat', 15.5, 10.4, 8, 1.8);
      c.rect('gold', 12, 8, 19, 9);
      c.px('gold', 15, 4); c.px('gold', 14, 5); c.px('gold', 15, 5); c.px('gold', 16, 5); c.px('gold', 15, 6);
    });
    c.at(P.sec, b + P.sec, () => { c.px('hat', 17, 0); c.px('hat', 18, 1); });
  },
};

// ---- Montura: pata animada (fase ph del ciclo de 8 frames de walk)
function qleg(c, P, m, hoof, hx, hy, ph, front, w = 2, amp = 2.5, lift = 3, gy = 29) {
  let dx = 0, up = 0;
  if (P.anim === 'walk') { const t = (P.t / 8 + ph) * 2 * PI; dx = -Math.cos(t) * amp; up = Math.max(0, Math.sin(t)) * lift; }
  const fx = Math.round(hx + dx), fy = Math.round(gy - up);
  const kx = Math.round((hx + fx) / 2 + (front ? 1 : -1) * up * .7), ky = Math.round(hy + (fy - hy) * .5 - up * .3);
  limb(c, m, hx, hy, kx, ky, w); limb(c, m, kx, ky, fx, fy - 1, w);
  c.rect(hoof, fx, fy, fx + w - 1, fy);
}

// ---- Caballo de perfil (mira a la derecha)
function horse(c, P) {
  const b = P.body, sw = P.sw;
  c.at(0, b, () => c.poly('ua_mane', [[10.5, 13], [8, 14.5], [5.5 + sw, 20], [6 + sw, 24], [7.5, 22], [9, 17.5], [11.5, 15.5]]));
  qleg(c, P, 'ua_horse.0', 'ua_hoof', 14, 20 + b, .12, 0);
  qleg(c, P, 'ua_horse.0', 'ua_hoof', 27, 20 + b, .62, 1);
  c.at(0, b, () => {
    c.ell('ua_horse', 13.5, 16.5, 4.8, 4.6); c.ell('ua_horse', 19.5, 17.5, 9, 4.4); c.ell('ua_horse', 25.5, 16.5, 4.2, 4.6);
    c.poly('ua_horse', [[23.5, 15], [27.5, 6.5], [31.5, 6], [30.5, 17]]);
    c.poly('ua_horse', [[29.5, 5.5], [32, 3.5], [34.5, 4.5], [38.5, 9.5], [38.5, 12], [36.5, 13], [33, 11], [30, 9.5]]);
    c.poly('ua_horse', [[30.5, 4.5], [31.5, 1.5], [33, 4]]);
    c.px('eye', 33, 7); c.px('ua_horse.0', 37, 11);
    c.poly('ua_mane', [[28.5, 4.5], [31, 3.5], [30, 7], [27, 12], [24.5, 15], [25, 11]]);
    c.line('leather', 32, 6, 36, 10);  // brida
  });
  qleg(c, P, 'ua_horse', 'ua_hoof', 11, 20 + b, 0, 0);
  qleg(c, P, 'ua_horse', 'ua_hoof', 25, 20 + b, .5, 1);
}

// ---- Caballero
U.human_cav = {
  w: 40, h: 32, ax: 20, ay: 29,
  render: { shadow: { cx: 20, cy: 30, rx: 13 } },
  draw(c, P) {
    const b = P.body, a = P.atk;
    horse(c, P);
    c.at(0, b, () => { // gualdrapa del equipo con borde dorado dentado
      c.poly('team', [[11.5, 12], [26.5, 12], [29, 15.5], [28.5, 22], [11, 22], [9.5, 16]]);
      for (let x = 11; x <= 28; x += 2) c.px('gold', x, 22);
      c.rect('gold', 11, 21, 28, 21); c.ell('gold', 15.5, 17, 1.6, 1.6); c.ell('gold', 24.5, 17, 1.6, 1.6);
      c.line('leather', 23, 12, 35, 10);   // riendas
    });
    // lanza: en alto (0), bajando (1), carga (2), sostiene (3)
    const G = [[8, 23, 14], [50, 22, 12], [86, 25, 12], [86, 23.5, 12]][a], T = rf(G[1], G[2], G[0]);
    c.at(0, b, () => {
      c.rect('steel', 17, 13, 19, 18); c.rect('steel', 18, 19, 21, 20); c.px('gold', 18, 15); // pierna
      c.rect('leather', 14, 11, 22, 12); c.rect('leather', 13, 9, 14, 11); c.rect('leather', 22, 10, 23, 11);
      c.rect('steel', 15, 5, 21, 11); c.rect('team', 15, 8, 21, 12); c.rect('gold', 15, 11, 21, 11);
      const h = T(0, 0); limb(c, 'steel', 20, 7, Math.round(h[0]) - 2, Math.round(h[1]) - 1);
      c.rim((t, m) => { rb(t, m, T, -12, 8, 2); rp(t, m, T, [[-2, -1], [2, -1], [1, -4], [-1, -4]]); rp(t, m, T, [[-1, -12], [1, -12], [0, -15]]); }, 'cloth');
      for (const y of [-6, 1, 4, 7]) rb(c, 'team', T, y, y + 1.2, 2);
      rp(c, 'steel', T, [[-2, -1], [2, -1], [1, -4], [-1, -4]]); rp(c, 'blade', T, [[-1, -12], [1, -12], [0, -15]]);
      c.at(0, P.sec, () => rp(c, 'team', T, [[1, -12], [5.5, -11.5 + P.sw * .5], [4, -10.5], [5.5, -9.5 + P.sw * .5], [1, -9]]));
      c.rect('steel', Math.round(h[0]) - 1, Math.round(h[1]) - 1, Math.round(h[0]), Math.round(h[1]));
      c.ell('steel', 18.5, 3.6, 3.6, 3.4); c.rect('steel', 15, 3, 22, 6);
      c.rect('ol', 19, 4, 22, 4); c.px('ol', 21, 6); c.rect('gold', 15, 2, 15, 6);
      c.ell('steel', 18, 7.5, 2.6, 1.8);
      // escudo cercano
      c.rim((t, m) => t.poly(m, [[12, 7], [18, 7], [18, 12], [15, 16], [12, 12]]), 'steel');
      c.poly('team', [[13, 8], [17, 8], [17, 12], [15, 14.5], [13, 12]]); c.rect('white', 15, 8, 15, 13); c.rect('white', 13, 10, 17, 10);
      if (a === 2) for (let i = 0; i < 4; i++) c.glow(6 + i * 2, 12, 60, '#ffffff');
    });
    c.at(P.sec === 0 ? P.sw : 0, b + P.sec, () => { c.ell('feather', 17.5, 1.5, 2, 1.4); c.rect('feather', 13, 1, 17, 2); c.px('feather', 12, 3); c.px('team', 17, 1); });
  },
};

// ---- Catapulta (mangonel) con ruedas y brazo
U.human_siege = {
  w: 40, h: 32, ax: 20, ay: 29,
  render: { shadow: { cx: 20, cy: 30, rx: 16 } },
  draw(c, P) {
    const W = P.anim === 'walk', b = W ? P.body : 0, r = spin(P), a = P.atk;
    c.ell('darkwood.0', 13.5, 24, 4.5, 4.5); c.ell('darkwood.0', 31.5, 24, 4.5, 4.5);   // ruedas lejanas
    const ang = [-70, -78, 14, 2][a], loaded = a < 2, T = rf(20, 18.5 + b, ang);
    c.at(0, b, () => {
      c.rect('wood.0', 6, 17, 36, 18);                                   // larguero lejano
      c.line('wood.0', 19, 17, 25, 7); c.line('wood.0', 31, 17, 26, 7);  // caballete lejano
      c.rect('wood', 7, 15, 8, 18); c.rect('sack', 6, 14, 9, 15);         // tope trasero acolchado
      c.rect('darkwood', 26, 0, 26, 6);                                   // banderín
      c.poly('team', [[27, 0], [32 + P.sw, 1 + (P.t & 1) * .5], [27, 3.5]]);
    });
    // brazo con cuchara y piedra
    c.rim((t, m) => rb(t, m, T, -11.5, 2.5, 2), 'wood');
    rb(c, 'iron', T, -7, -6, 2);
    re(c, 'darkwood', T, 0, -13, 2.5); re(c, 'darkwood.0', T, 0, -13.5, 1.4);
    if (loaded) re(c, 'stone', T, 0, -14, 1.8);
    if (a === 2) smear(c, 20, 18.5, 13, -70, 12);
    c.at(0, b, () => {
      // caballete cercano en A con travesaño acolchado
      c.rim((t, m) => { t.poly(m, [[15, 20], [17, 20], [24, 8], [22.5, 8]]); t.poly(m, [[28, 20], [30, 20], [25.5, 8], [24, 8]]); t.rect(m, 21, 7, 26, 9); }, 'wood');
      c.rect('sack', 21, 7, 23, 9); c.rect('iron', 24, 8, 26, 8); c.rect('wood.0', 18, 15, 28, 15);
      c.ell('sack', 20, 18.5, 2.6, 2.6); c.line('leather', 18, 17, 22, 20); c.ell('iron', 20, 18.5, 1, 1);
      c.rect('wood', 4, 19, 36, 21); c.rect('wood.0', 4, 21, 36, 21);     // larguero cercano
      c.rect('team', 7, 19, 13, 21); c.rect('gold', 7, 19, 13, 19);
      c.px('iron', 15, 20); c.px('iron', 25, 20); c.px('iron', 34, 20);
      if (loaded) { const p = T(0, -8); c.line('string', 5, 19, Math.round(p[0]), Math.round(p[1] - b)); }
      c.rect('darkwood', 3, 18, 5, 21); c.px('iron', 4, 19);              // torno
    });
    wheel(c, 11.5, 25, 4.5, r, 'darkwood', 'wood', 2, 'iron', 'darkwood.0'); wheel(c, 29.5, 25, 4.5, r, 'darkwood', 'wood', 2, 'iron', 'darkwood.0');
  },
};

// ---- Rey Paladín: corona sobre yelmo, armadura dorada y plateada, capa, mandoble
U.human_general = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, sw = P.sw, a = P.atk;
    c.poly('team', [[9.5, 13.5 + b], [21.5, 13.5 + b], [26 + sw, 29], [5 + sw, 29]]);   // capa larga
    c.rect('team.0', 13, 23, 18, 28); c.rect('gold', 5 + sw, 28, 26 + sw, 28);
    for (let x = 6; x <= 25; x += 3) c.px('gold.3', x + sw, 28);
    legs(c, P, 'silver', 'steel', [12, 14], [17, 19], 23, 27, 'gold');
    c.at(0, b, () => {
      c.rect('silver', 11, 15, 20, 23);
      c.poly('gold', [[11, 15], [20, 15], [19, 17], [12, 17]]);
      c.rect('gold', 15, 17, 16, 22); c.rect('gold', 13, 19, 18, 19);  // cruz del peto
      c.rect('team', 12, 24, 19, 25); c.rect('gold', 11, 22, 20, 23); c.px('red', 15, 22); c.px('red', 16, 22);
      c.ell('gold', 9.5, 15.5, 3.2, 2.7); c.ell('gold', 22.5, 15.5, 3.2, 2.7);
      c.px('silver', 9, 15); c.px('silver', 22, 15);
    });
    // mandoble: reposo, alzado atrás (1), tajo (2), seguimiento (3)
    const G = [[0, 26.5, 21], [-58, 22, 12], [100, 13, 19], [120, 14, 20]][a], T = rf(G[1], G[2], G[0]);
    const sword = () => {
      c.rim((t, m) => { rp(t, m, T, [[-1.5, -3], [1.5, -3], [1.5, -16], [0, -18.5], [-1.5, -16]]); rb(t, m, T, -3, -1.5, 9); rb(t, m, T, -1.5, 2.5, 2); rb(t, m, T, 2.5, 4, 3); }, 'blade');
      rl(c, 'blade.3', T, 0, -15.5, 0, -4); rb(c, 'gold', T, -3, -1.5, 9); rb(c, 'leather', T, -1.5, 2.5, 2); rb(c, 'gold', T, 2.5, 4, 3);
      re(c, 'red', T, 0, -2.25, .8);
      const p0 = T(0, -4), p1 = T(0, -17);
      glowSeg(c, p0[0], p0[1], p1[0], p1[1], 2 + (a === 2 ? 1.5 : P.glow * .5), a === 2 ? 110 : 70, '#ffe98a');
    };
    if (a === 1) c.at(0, b, sword);
    c.at(0, b + (a ? 0 : P.s), () => { // brazo izquierdo
      if (!a) { c.rect('silver', 8, 17, 10, 21); c.rect('steel', 8, 22, 9, 23); c.px('gold', 8, 19); c.px('gold', 9, 19); }
      else arm(c, 'silver', 'steel', 9, 17, G[1] - 1, G[2] - 1);
    });
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!a) { sword(); c.rect('silver', 22, 17, 24, 20); c.rect('steel', 24, 20, 27, 22); c.px('gold', 22, 19); c.px('gold', 23, 19); }
    });
    c.at(0, b, () => {
      c.ell('skin', 15.5, 10.4, 4.6, 4.8);
      c.ell('silver', 15.5, 8.2, 5.6, 4.8); c.rect('silver', 10, 8, 11, 13); c.rect('silver', 20, 8, 21, 13);
      c.rect('skin', 12, 9, 19, 13); c.px(null, 12, 13); c.px(null, 19, 13);
      c.rect('silver', 15, 8, 16, 11); c.px('gold', 15, 8); c.px('gold', 16, 8);   // nasal
      c.px('eye', 13, 11); c.px('eye', 18, 11);
      c.rect('ua_bbeard', 13, 13, 18, 13); c.rect('ua_bbeard', 14, 14, 17, 14); c.px('mouth', 15, 13); c.px('mouth', 16, 13);
      // corona sobre el yelmo
      c.rect('gold', 11, 5, 20, 6);
      for (const [x, h] of [[11, 3], [13, 4], [15, 2], [16, 2], [18, 4], [20, 3]]) c.rect('gold', x, h, x, 4);
      c.px('gold.3', 15, 1); c.px('gold.3', 16, 1);
      c.px('red', 15, 5); c.px('red', 16, 5); c.px('team', 12, 6); c.px('team', 19, 6);
      halo(c, 15.5, 3, 3 + P.glow, 60, '#ffe98a');
    });
    if (a >= 2) c.at(0, b, () => {
      sword();
      const h = T(0, 0); arm(c, 'silver', 'steel', 22, 17, Math.round(h[0]) - 1, Math.round(h[1]) - 1);
      if (a === 2) smear(c, G[1], G[2], 17, -40, 95, 100);
    });
    if (a === 1) c.at(0, b, () => { const h = T(0, 0); arm(c, 'silver', 'steel', 22, 17, Math.round(h[0]), Math.round(h[1]) - 1); });
  },
};

// ===================================================================== ELFOS
// esbeltos y altos: cabeza y≈8.8 r≈4.3, torso x12–19 y13–22, piernas largas y21–29
const EL = [13, 14], ER = [17, 18];
const arc = (cx, cy, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const t = (a0 + (a1 - a0) * i / n) * PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
const SICKLE = [...arc(3, -7.5, 4.2, 150, 360), ...arc(3.3, -7.2, 3, 360, 200)];
// cimitarra élfica (curva hacia +x); s = -1 la refleja
const scim = s => [[-1 * s, -1.5], [1 * s, -1.5], [1.6 * s, -6], [2 * s, -9], [1.4 * s, -12.5], [.2 * s, -9.5], [-.6 * s, -6]];
// cabeza élfica: o.hair, o.long (melena detrás), o.top (false = sin flequillo), o.ears
function elfHead(c, o = {}) {
  const h = o.hair || 'elfhair', h2 = h === 'silver' ? 'steel' : 'ua_blond';
  if (o.long) c.poly(h2, [[11, 6], [20, 6], [21, 15 + (o.sw || 0) * .5], [10, 15 + (o.sw || 0) * .5]]);
  c.ell('elfskin', 15.5, 8.8, 4.2, 4.5);
  if (o.top !== false) { c.ell(h, 15.5, 5.6, 4.8, 2.7); c.rect(h2, 11, 6, 12, 9); c.rect(h2, 19, 6, 20, 9); c.px(h, 13, 7); c.px(h, 11, 5); c.px(h, 20, 5); }
  if (o.ears !== false) {
    c.poly('elfskin', [[12, 8], [7.5, 4.5], [12, 10.5]]); c.poly('elfskin', [[19, 8], [23.5, 4.5], [19, 10.5]]);
    c.px('elfskin.0', 10, 7); c.px('elfskin.0', 21, 7);
  }
  c.px('eye', 14, 9); c.px('eye', 17, 9); c.px('elfskin.0', 15, 11); c.px('elfskin.0', 16, 11);
}
// arco élfico (curvo, puntas recurvas doradas). x0 = línea de la cuerda, dir +1 = barriga a la derecha
function elfBow(c, m, x0, y0, y1, bulge, dir, tip = 'gold') {
  const cy = (y0 + y1) / 2 + .5, ry = (y1 - y0) / 2 + .5;
  c.ring(m, x0 + .5, cy, bulge, ry, .6, x => dir > 0 ? x >= x0 : x <= x0);
  c.px(tip, x0 - dir, y0 - 1); c.px(tip, x0, y0); c.px(tip, x0 - dir, y1 + 1); c.px(tip, x0, y1);
  c.rect('leather', x0 + dir * Math.round(bulge) - (dir > 0 ? 1 : 0), cy - 1.5, x0 + dir * Math.round(bulge) - (dir > 0 ? 0 : -1), cy + .5);
}
// cuerda: recta o tensada hasta (nx, ny) con flecha hacia dir
function bowString(c, x0, y0, y1, pull, ny, dir, arrow, head = 'steel', fl = 'team') {
  if (pull <= 0) { const x = x0 + (pull < 0 ? dir : 0); c.line('string', x, y0 + 1, x, y1 - 1); return; }   // pull -1 = cuerda recién suelta
  const nx = x0 - dir * pull;
  c.line('string', x0, y0, nx, ny); c.line('string', nx, ny + 1, x0, y1);
  if (arrow) {
    const tx = x0 + dir * arrow;
    c.line('wood', nx, ny, tx - dir, ny); c.px(head, tx, ny); c.px(head, tx - dir, ny - 1); c.px(head, tx - dir, ny + 1);
    c.px(fl, nx + dir, ny - 1); c.px(fl, nx + dir, ny + 1); c.px('feather', nx + 2 * dir, ny - 1); c.px('feather', nx + 2 * dir, ny + 1);
  }
}

// ---- Recolector élfico: túnica verde clara, capucha corta, hoz y cesta
U.elf_worker = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P, o) {
    const b = P.body, a = P.atk, sw = P.sw, k = o && o.carry;
    legs(c, P, 'tunic', 'leather', EL, ER, 21, 26);
    c.at(0, b, () => {
      c.poly('ua_elfgreen', [[12, 18], [19.5, 18], [20.5, 24], [10.5, 24]]);
      c.rect('ua_elfgreen', 12, 13, 19, 19); c.rect('ua_elfgreen.0', 16, 20, 16, 23);
      c.rect('team', 12, 18, 19, 19); c.px('gold', 15, 18); c.px('gold', 16, 18);
    });
    c.at(sw, b, () => c.rect('team', 13, 20, 14, 23));
    if (k === 'wood') c.at(0, b, () => logs(c, 0, 9, 12));
    c.at(0, b + (k === 'wood' ? 0 : P.s), () => {
      if (k === 'wood') { c.rect('ua_elfgreen', 10, 14, 11, 16); c.rect('elfskin', 7, 15, 9, 16); }
      else {
        c.rect('ua_elfgreen', 10, 14, 11, 18); c.rect('elfskin', 10, 19, 11, 20);
        if (k) bundle(c, k, 9, 20);
        else { c.ring('darkwood', 8.5, 22, 3.4, 3.4, .6, (x, y) => y < 22); c.poly('thatch', [[5, 22.5], [12.5, 22.5], [11.5, 27], [6, 27]]); c.rect('darkwood', 6, 22, 11, 22); c.rect('thatch.2', 5, 23, 11, 23); c.dither('thatch.0', 6, 24, 11, 26, 0, 'thatch'); }
      }
    });
    // hoz: reposo, alzada (1), siega (2), sigue (3)
    const G = [[0, 22, 20.5], [-15, 22, 16], [110, 20, 19], [135, 19, 19]][a], T = rf(G[1], G[2], G[0]);
    c.at(0, b - (a ? 0 : P.s), () => {
      c.rect('ua_elfgreen', 20, 14, 21, 17);
      if (!a) c.rect('elfskin', 20, 18, 21, 19); else limb(c, 'elfskin', 20, 18, G[1] - 1, G[2] - 1);
      c.rim((t, m) => rp(t, m, T, SICKLE), 'blade'); rl(c, 'blade.3', T, 0, -10, 4, -11);
      c.rim((t, m) => rb(t, m, T, -5, 2.5, 2), 'wood');
      c.rect('elfskin', G[1] - 1, G[2] - 1, G[1], G[2]);
      if (a === 2) smear(c, G[1], G[2], 11, 10, 110);
    });
    c.at(0, b, () => {
      c.ell('leaf', 15.5, 7.6, 5.4, 5.4);
      c.poly('leaf', [[10.5, 12], [20.5, 12], [21.5, 15.5], [9.5, 15.5]]); c.rect('leaf.0', 10, 15, 21, 15);
      c.px('gold', 15, 13); c.px('gold', 16, 13);
      c.ell('elfskin', 15.5, 9.5, 3.6, 3.8); c.rect('elfhair', 12, 6, 19, 7); c.px('elfhair', 12, 8); c.px('elfhair', 19, 8);
      c.poly('elfskin', [[11.5, 8.5], [7.5, 5.5], [11.5, 10.5]]); c.poly('elfskin', [[19.5, 8.5], [23.5, 5.5], [19.5, 10.5]]);
      c.px('eye', 14, 9); c.px('eye', 17, 9); c.px('elfskin.0', 15, 11); c.px('elfskin.0', 16, 11);
    });
    c.at(0, b + P.sec, () => c.poly('leaf', [[13, 2.5], [18, 2.5], [15.5, .5]]));
  },
};

// ---- Danzante de espadas: dos cimitarras, armadura de hojas plateadas, fajín del equipo
U.elf_inf = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw;
    c.at(sw, b + P.sec, () => c.poly('ua_blond', [[14, 3], [18, 3], [12, 11], [9.5, 15], [9, 12]]));  // coleta
    legs(c, P, 'cloak', 'leather', EL, ER, 21, 26);
    c.at(0, P.ll, () => c.rect('silver', 13, 23, 14, 24)); c.at(0, P.lr, () => c.rect('silver', 17, 23, 18, 24));
    c.at(0, b, () => {
      c.rect('silver', 12, 13, 19, 20);
      for (const y of [15, 17, 19]) for (let x = 12 + (y & 2 ? 1 : 0); x <= 19; x += 2) c.px('silver.0', x, y);
      c.poly('leaf', [[13, 13], [18, 13], [15.5, 16]]); c.px('gold', 15, 13); c.px('gold', 16, 13);
      c.poly('leaf', [[11.5, 21], [19.5, 21], [20.5, 23], [18, 24], [15.5, 22.5], [13, 24], [10.5, 23]]);
      c.rect('team', 12, 20, 19, 21);
      c.poly('silver', [[9, 13], [12.5, 12.5], [12.5, 15.5], [10, 16]]); c.poly('silver', [[22, 13], [18.5, 12.5], [18.5, 15.5], [21, 16]]);
    });
    c.at(sw * 1.5, b, () => { c.rect('team', 11, 21, 12, 25); c.px('team', 10, 26); c.px('gold', 11, 22); });
    // cimitarras: guardia (0), alzadas (1), tajo en abanico (2), abajo (3)
    const R = [[25, 21, 19], [10, 22, 13], [95, 20, 18], [150, 21, 20]][a], L = [[-135, 10, 18], [-10, 9, 13], [-95, 11, 18], [-150, 10, 20]][a];
    const blade = (g, s) => {
      const T = rf(g[1], g[2], g[0]);
      c.rim((t, m) => { rp(t, m, T, scim(s)); rb(t, m, T, -2, -1, 4); rb(t, m, T, -1, 2, 1.6); }, 'blade');
      rb(c, 'gold', T, -2, -1, 4); rb(c, 'leather', T, -1, 2, 1.6); rl(c, 'blade.3', T, .2 * s, -3, .9 * s, -9);
    };
    c.at(0, b + (a ? 0 : P.s), () => { arm(c, 'elfskin', 'elfskin', 10, 15, L[1] - 1, L[2] - 1); c.rect('silver', 10, 14, 11, 15); blade(L, -1); c.rect('elfskin', L[1] - 1, L[2] - 1, L[1], L[2]); });
    c.at(0, b - (a ? 0 : P.s), () => { arm(c, 'elfskin', 'elfskin', 20, 15, R[1] - 1, R[2] - 1); c.rect('silver', 20, 14, 21, 15); blade(R, 1); c.rect('elfskin', R[1] - 1, R[2] - 1, R[1], R[2]); });
    if (a === 2) c.at(0, b, () => { smear(c, 20, 18, 12, 10, 95); smear(c, 11, 18, 12, -95, -10); });
    c.at(0, b, () => { elfHead(c); c.rect('silver', 11, 5, 20, 5); c.px('ua_gem', 15, 5); c.px('ua_gem', 16, 5); });
  },
};

// ---- Guardián del bosque: guja élfica, yelmo alado plateado
U.elf_pike = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw;
    legs(c, P, 'cloak', 'silver', EL, ER, 21, 25);
    c.at(0, b, () => {
      c.poly('leaf', [[11.5, 19], [19.5, 19], [21, 25], [10, 25]]);
      c.rect('silver', 12, 13, 19, 19); c.rect('silver.3', 13, 14, 13, 17);
      c.rect('team', 13, 16, 18, 26); c.poly('gold', [[15.5, 17], [17, 19.5], [15.5, 22], [14, 19.5]]); c.rect('leaf', 15, 19, 16, 20);
      c.rect('gold', 12, 19, 19, 19);
      c.poly('silver', [[8.5, 12.5], [12.5, 12.5], [12.5, 16], [10, 16.5]]); c.poly('silver', [[22.5, 12.5], [18.5, 12.5], [18.5, 16], [21, 16.5]]);
      c.px('gold', 10, 14); c.px('gold', 21, 14);
    });
    c.at(sw, b, () => { c.px('team', 13, 27); c.px('team', 15, 27); c.px('team', 16, 27); c.px('team', 18, 27); });
    // guja: vertical (0), alzada atrás (1), barrido (2), abajo (3)
    const G = [[0, 25, 20.5], [-35, 22, 18], [75, 11.5, 19], [115, 13, 20]][a], T = rf(G[1], G[2], G[0]);
    const glaive = () => {
      c.rim((t, m) => { rb(t, m, T, -12, 8.5, 2); rp(t, m, T, [[-1, -12], [1.2, -12], [2.6, -15], [2.3, -18.5], [.5, -20.5], [-.3, -19], [-1, -15]]); rp(t, m, T, [[-1, -13], [-3, -14.5], [-1, -15]]); }, 'ua_lightwood');
      rp(c, 'blade', T, [[-1, -12], [1.2, -12], [2.6, -15], [2.3, -18.5], [.5, -20.5], [-.3, -19], [-1, -15]]); rp(c, 'blade', T, [[-1, -13], [-3, -14.5], [-1, -15]]);
      rl(c, 'blade.3', T, 1, -14, 1, -18); rb(c, 'gold', T, -12.5, -11, 2.6);
      c.at(P.anim === 'walk' ? sw : 0, P.sec, () => { rl(c, 'team', T, 1.5, -11, 3, -7); rl(c, 'team', T, 2, -11, 3.5, -8); });
    };
    c.at(0, b + (a ? 0 : P.s), () => { if (!a) { c.rect('ua_elfgreen', 10, 15, 11, 19); c.rect('elfskin', 10, 20, 11, 21); } else { const h = T(0, -6); arm(c, 'ua_elfgreen', 'elfskin', 10, 15, h[0] - 1, h[1] - 1); } });
    if (a === 1) c.at(0, b, glaive);
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!a) { glaive(); c.rect('ua_elfgreen', 20, 15, 21, 19); c.rect('elfskin', 21, 19, 24, 21); }
    });
    c.at(0, b, () => {
      elfHead(c, { top: false });
      c.ell('silver', 15.5, 5.6, 4.9, 3.4); c.rect('silver', 11, 6, 12, 9); c.rect('silver', 19, 6, 20, 9);
      c.rect('gold', 11, 7, 20, 7); c.rect('silver', 15, 7, 16, 9);
      c.poly('feather', [[11, 6], [7.5, 0.5], [9, 4], [6.5, 2.5], [9.5, 7]]); c.poly('feather', [[20, 6], [23.5, 0.5], [22, 4], [24.5, 2.5], [21.5, 7]]);
      c.px('feather.0', 9, 4); c.px('feather.0', 22, 4);
    });
    if (a >= 2) c.at(0, b, () => {
      glaive();
      const h = T(0, 0), h2 = T(0, -6);
      arm(c, 'ua_elfgreen', 'elfskin', 20, 15, h[0] - 1, h[1] - 1); c.rect('elfskin', Math.round(h2[0]) - 1, Math.round(h2[1]) - 1, Math.round(h2[0]), Math.round(h2[1]));
      if (a === 2) smear(c, G[1], G[2], 19, -30, 75, 90);
    });
    if (a === 1) c.at(0, b, () => { const h = T(0, 0); arm(c, 'ua_elfgreen', 'elfskin', 20, 15, h[0] - 1, h[1] - 1); });
  },
};

// ---- Arquero élfico: arco largo curvo, capa con hojas, pelo largo (dispara a la derecha)
U.elf_ranged = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw;
    c.poly('cloak', [[11, 12 + b], [20, 12 + b], [22 + sw, 25], [9 + sw, 25]]);           // capa
    for (let x = 9; x <= 21; x += 2) c.px('leaf', x + sw, 25 - (x & 2 ? 1 : 0));
    c.at(0, b, () => { c.rim((t, m) => t.rect(m, 8, 9, 10, 19), 'leather'); });               // carcaj a la espalda
    c.at(0, b + P.sec, () => { c.px('feather', 8, 7); c.px('team', 9, 7); c.px('feather', 10, 7); c.px('team', 8, 8); c.px('feather', 9, 8); c.px('team', 10, 8); });
    legs(c, P, 'tunic', 'leather', EL, ER, 21, 26, 'gold');
    c.at(0, b, () => {
      c.rect('ua_elfgreen', 12, 13, 19, 22); c.rect('leather', 12, 19, 19, 19); c.px('gold', 15, 19); c.px('gold', 16, 19);
      c.rect('team', 15, 13, 16, 18); c.line('leather', 12, 13, 19, 20);
      c.poly('ua_elfgreen', [[11.5, 20], [19.5, 20], [20, 23], [11, 23]]); c.rect('team', 11, 23, 20, 23);
    });
    // brazo izquierdo: cuelga (0), tensa (1), suelta (2), vuelve (3)
    c.at(0, b + (a ? 0 : P.s), () => {
      if (!a) { c.rect('ua_elfgreen', 10, 14, 11, 18); c.rect('elfskin', 10, 19, 11, 20); }
      else if (a === 1) { c.rect('ua_elfgreen', 10, 14, 18, 15); c.rect('elfskin', 18, 14, 19, 16); }
      else if (a === 2) { c.rect('ua_elfgreen', 10, 13, 14, 14); c.rect('elfskin', 14, 12, 15, 13); }
      else { c.rect('ua_elfgreen', 10, 14, 11, 17); c.rect('elfskin', 11, 17, 12, 18); }
    });
    c.at(0, b - P.s, () => {
      c.rect('ua_elfgreen', 20, 14, 21, 16); c.rect('elfskin', 22, 15, 23, 17);
      elfBow(c, 'ua_lightwood', 23, 3, 27, a === 1 ? 5.8 : 4.8, 1);
      bowString(c, 23, 3, 27, a === 1 ? 4 : a === 2 ? -1 : 0, 15, 1, a === 1 ? 8 : 0);
    });
    c.at(0, b, () => elfHead(c, { long: true, sw }));
    if (a === 1) c.at(0, b, () => c.rect('elfskin', 18, 14, 19, 16));
  },
};

// ---- Ciervo blanco de perfil (mira a la derecha)
function deer(c, P) {
  const b = P.body;
  c.at(0, b + P.sec, () => { c.ell('ua_deer', 9.8, 14.5, 1.5, 1.8); c.px('white', 9, 14); });
  qleg(c, P, 'ua_deer.0', 'ua_hoof', 14, 19 + b, .12, 0, 2, 3, 3.5);
  qleg(c, P, 'ua_deer.0', 'ua_hoof', 26, 18 + b, .62, 1, 2, 3, 3.5);
  c.at(0, b, () => {
    c.ell('ua_deer', 12.5, 16, 3.8, 3.8); c.ell('ua_deer', 18.5, 16.5, 8, 3.4); c.ell('ua_deer', 24.5, 15.5, 3.4, 3.8);
    c.rect('ua_deer.0', 14, 19, 23, 19);
    c.poly('ua_deer', [[22.5, 14], [27, 8.5], [30, 8], [28.5, 15]]);
    c.poly('ua_deer', [[28.5, 8], [31, 6.5], [33, 7], [36.5, 10.5], [36, 12], [33.5, 12], [30.5, 10.5]]);
    c.poly('ua_deer', [[29.5, 8], [26, 5.5], [30.5, 6.5]]); c.px('ua_deer.0', 28, 7);
    c.px('eye', 32, 8); c.px('ua_mane', 36, 11); c.rect('white', 26, 12, 27, 14);
    // astas grandes (rama lejana más oscura)
    const ant = (m, l) => l.forEach(p => c.line(m, p[0], p[1], p[2], p[3]));
    ant('ua_antler.0', [[32, 6, 34, 4], [33, 6, 35, 4], [34, 4, 37, 1], [35, 4, 35, 1], [36, 2, 38, 2], [37, 1, 37, 0]]);
    ant('ua_antler', [[30, 6, 28, 4], [31, 6, 29, 4], [28, 4, 26, 1], [29, 4, 30, 1], [27, 2, 28, 0], [26, 1, 25, 0], [30, 5, 32, 4], [27, 3, 25, 3]]);
  });
  qleg(c, P, 'ua_deer', 'ua_hoof', 12, 19 + b, 0, 0, 2, 3, 3.5);
  qleg(c, P, 'ua_deer', 'ua_hoof', 24, 18 + b, .5, 1, 2, 3, 3.5);
}

// ---- Jinete de ciervo: arquero élfico montado
U.elf_cav = {
  w: 40, h: 32, ax: 20, ay: 29,
  render: { shadow: { cx: 20, cy: 30, rx: 12 } },
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw;
    c.at(0, b, () => c.poly('cloak', [[16, 7], [19, 7], [14 + sw, 15], [10 + sw, 14]]));   // capa al viento
    deer(c, P);
    c.at(0, b, () => {
      c.poly('team', [[13.5, 12], [22.5, 12], [23, 17], [13, 17]]); c.rect('gold', 13, 17, 23, 17);
      for (let x = 14; x <= 22; x += 2) c.px('gold', x, 18);
      c.rect('tunic', 17, 12, 19, 18); c.rect('leather', 18, 19, 20, 20);           // pierna
      c.rect('ua_elfgreen', 16, 6, 20, 13); c.rect('team', 16, 11, 20, 11); c.line('leather', 16, 6, 20, 10);
      // cabeza de perfil
      c.poly('ua_blond', [[16, 1.5], [18.5, 1.5], [17.5, 7], [15 + sw * .5, 9.5], [14.5, 4]]);
      c.ell('elfskin', 19, 3.6, 2.8, 2.8); c.rect('elfskin', 20, 4, 21, 6);
      c.poly('elfhair', [[16, 2], [21, 1], [21.5, 2.5], [18, 3], [17, 5]]);
      c.poly('elfskin', [[17, 3.5], [14, 0.5], [17.5, 5]]); c.px('eye', 20, 4);
    });
    // arco al frente: brazo adelantado; la otra mano tensa en ataque
    c.at(0, b, () => {
      limb(c, 'ua_elfgreen', 19, 8, 23, 8); c.rect('elfskin', 24, 8, 25, 9);
      elfBow(c, 'ua_lightwood', 24, 1, 16, a === 1 ? 4.6 : 3.8, 1);
      bowString(c, 24, 1, 16, a === 1 ? 4 : a === 2 ? -1 : 0, 8, 1, a === 1 ? 9 : 0);
      const hx = [21, 19, 18, 20][a], hy = [10, 8, 6, 9][a];
      limb(c, 'ua_elfgreen', 18, 8, hx - 1, hy); c.rect('elfskin', hx, hy, hx + 1, hy + 1);
    });
  },
};

// ---- Druida: báculo de raíz con flores y brillo verde, túnica de hojas, corona de ramas
U.elf_special = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw;
    c.poly('steel', [[11, 7 + b], [20, 7 + b], [21, 18 + b], [10, 18 + b]]);                  // melena plateada
    c.poly('leaf', [[12, 13 + b], [19, 13 + b], [22.5 + sw, 29], [8.5 + sw, 29]]);           // túnica de hojas
    for (let x = 9; x <= 22; x += 2) c.poly(x & 2 ? 'moss' : 'leaf', [[x + sw - 1, 27], [x + sw + 1, 27], [x + sw, 29.5]]);
    for (const [x, y] of [[13, 21], [17, 24], [12, 25], [19, 19]]) c.px('moss', x + (y > 22 ? sw : 0), y + (y < 23 ? b : 0));
    c.at(0, P.ll, () => c.rect('leather', 12, 29, 14, 29)); c.at(0, P.lr, () => c.rect('leather', 17, 29, 19, 29));
    c.at(0, b, () => { c.rect('team', 14, 13, 17, 21); c.rect('gold', 14, 18, 17, 18); c.rect('darkwood', 12, 18, 19, 18); });
    c.at(sw, b, () => { c.rect('team', 14, 22, 15, 25); c.rect('team', 16, 22, 17, 24); c.px('gold', 14, 25); c.px('gold', 16, 24); });
    // manga izquierda: se alza con chispas verdes en el conjuro
    c.at(0, b + (a ? 0 : P.s), () => {
      if (a === 1 || a === 2) {
        c.poly('leaf', [[8, 13], [12, 13], [11, 17], [7, 17]]); c.ell('elfskin', 6.5, 15, 1.4, 1.4);
        if (a === 2) { star(c, 'glowG', 4, 12); halo(c, 4.5, 12.5, 3, 90, '#b8ff8a'); }
      } else { c.poly('leaf', [[8, 13], [12, 13], [12, 19], [7, 20]]); c.ell('elfskin', 7.5, 21, 1.4, 1.4); }
    });
    const dx = [0, 1, 2, 1][a], dy = [0, -1, -1, 0][a];
    c.at(0, b - P.s, () => c.poly('leaf', [[19, 13], [23, 13], [24, 19], [19, 19]]));
    c.at(dx, b - P.s + dy, () => {
      c.rim((t, m) => { t.rect(m, 25, 8, 26, 29); t.px(m, 24, 14); t.px(m, 27, 20); }, 'darkwood');
      c.px('darkwood.0', 25, 12); c.px('darkwood.0', 26, 17); c.px('darkwood.0', 25, 23);
      c.line('darkwood', 25, 8, 23, 4); c.line('darkwood', 26, 8, 28, 4); c.line('darkwood', 23, 4, 24, 2); c.line('darkwood', 28, 4, 27, 2);   // raíces en garra
      c.px('leaf', 22, 6); c.px('leaf', 29, 6); c.px('leaf', 28, 9);
      c.rect('elfskin', 23 - dx, 19, 26, 20);
    });
    c.at(dx, b - P.s + dy + (a ? 0 : P.sec), () => {
      c.ell('ua_gem', 25.5, 4.2, 2, 2.2); c.px('white', 25, 3);
      c.px('ua_flower', 22, 3); c.px('ua_flower', 29, 3); c.px('ua_flower.3', 23, 7); c.px('ua_flower', 28, 7);
      const gl = a ? [0, 2.2, 3.6, 2][a] : P.glow * .9;
      if (gl) halo(c, 25.5, 4.2, 2.6 + gl, a === 2 ? 150 : 100, '#b8ff8a');
      if (a === 2) star(c, 'glowG', 27, 1);
    });
    c.at(0, b, () => {
      elfHead(c, { hair: 'silver' });
      for (const p of [[12, 5, 10, 1], [14, 4, 13, 0], [17, 4, 18, 0], [19, 5, 21, 1], [11, 3, 9, 3], [20, 3, 22, 3]]) c.line('wood', p[0], p[1], p[2], p[3]);
      c.px('leaf', 10, 0); c.px('leaf', 13, 0); c.px('leaf', 18, 0); c.px('leaf', 21, 0); c.px('ua_flower', 15, 3); c.px('ua_flower', 16, 3);
    });
  },
};

// ---- Lanzavirotes: balista élfica curva de madera clara con virote
U.elf_siege = {
  w: 40, h: 32, ax: 20, ay: 29,
  render: { shadow: { cx: 20, cy: 30, rx: 15 } },
  draw(c, P) {
    const W = P.anim === 'walk', b = W ? P.body : 0, r = spin(P), a = P.atk;
    c.ring('ua_lightwood.0', 14, 24, 4.5, 4.5, .5, (x, y) => y < 22); c.ring('ua_lightwood.0', 30, 24, 4.5, 4.5, .5, (x, y) => y < 22);
    const nut = [16, 12, 27, 26][a], tip = [25, 23, 27, 26][a], loaded = a < 2;
    c.at(0, b, () => {
      // bastidor curvo con hojas
      c.rim((t, m) => { t.poly(m, [[6, 19], [33, 19], [37, 20], [33, 22], [6, 22]]); t.poly(m, [[7, 22], [3.5, 19], [3.5, 15.5], [5.5, 15.5], [5.5, 18.5], [8, 19]]); }, 'ua_lightwood');
      c.rect('ua_lightwood.0', 7, 21, 33, 21); c.px('leaf', 4, 15); c.px('leaf', 3, 14); c.px('leaf', 9, 18); c.px('leaf', 32, 18); c.px('leaf', 33, 18);
      c.rect('team', 16, 19, 24, 21); c.poly('gold', [[20, 19], [21.5, 20], [20, 21], [18.5, 20]]);
      c.rim((t, m) => t.poly(m, [[18, 19], [21, 19], [20.5, 13], [18.5, 13]]), 'ua_lightwood');        // poste
      c.rim((t, m) => t.poly(m, [[8, 10], [31, 10], [32, 11.5], [9, 12.5]]), 'ua_lightwood');            // riel
      c.px('gold', 31, 10); c.rect('darkwood', 8, 10, 10, 12);
      // palas curvas (arco) y cuerda
      const lim = (t, m) => { t.line(m, 30, 10, tip + 1, 4); t.line(m, tip + 1, 4, tip, 1); t.line(m, 30, 12, tip + 1, 18); t.line(m, tip + 1, 18, tip, 21); t.line(m, 31, 10, tip + 2, 4); t.line(m, 31, 12, tip + 2, 18); };
      c.rim(lim, 'ua_lightwood'); c.px('gold', tip, 1); c.px('gold', tip, 21);
      if (a >= 2) c.line('string', tip, 1, tip, 21);
      else { c.line('string', tip, 1, nut, 10); c.line('string', nut, 11, tip, 21); }
      if (a === 3) c.px('string', tip - 1, 11);
      if (loaded) {
        c.line('wood', nut, 10, 33, 10); c.poly('silver', [[33, 8.5], [36.5, 10.5], [33, 12.5], [34, 10.5]]); c.px('ua_gem', 35, 10);
        c.px('team', nut + 1, 9); c.px('team', nut + 2, 9); c.px('feather', nut + 1, 11); c.px('feather', nut + 2, 11);
      }
      if (a === 2) for (let x = 33; x < 40; x += 2) c.glow(x, 10, 80, '#b8ff8a');
      c.rect('darkwood', 26, 0, 26, 7); c.px('ua_lightwood', 26, 0);                // banderola
    });
    c.at(0, b + P.sec, () => c.poly('team', [[27, 1], [31 + P.sw, 2.5], [27, 4.5]]));
    wheel(c, 12, 25, 4.5, r, 'ua_lightwood', 'ua_lightwood', 2, 'gold', 'wood.0'); wheel(c, 28, 25, 4.5, r, 'ua_lightwood', 'ua_lightwood', 2, 'gold', 'wood.0');
  },
};

// ---- Reina del Bosque: corona de hojas doradas, arco dorado, capa larga del equipo, brillo
U.elf_general = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw;
    c.poly('team', [[10, 12 + b], [21, 12 + b], [26 + sw, 29], [5 + sw, 29]]);                     // capa larga
    c.rect('gold', 5 + sw, 28, 26 + sw, 28); for (let x = 6; x <= 25; x += 3) c.px('leaf', x + sw, 27);
    c.at(0, b, () => c.poly('ua_blond', [[11, 6], [20, 6], [21.5, 19 + sw * .5], [9.5, 19 + sw * .5]]));   // melena dorada
    c.poly('snow', [[12, 19 + b], [19, 19 + b], [22, 29], [9, 29]]);                                       // falda
    c.rect('gold', 9, 28, 22, 28); c.line('snow.0', 15, 21 + b, 14, 28); c.line('gold', 12, 27, 19, 27); c.px('leaf', 12, 26); c.px('leaf', 19, 25);
    c.at(0, P.ll, () => c.rect('gold', 12, 29, 14, 29)); c.at(0, P.lr, () => c.rect('gold', 17, 29, 19, 29));
    c.at(0, b, () => {
      c.rect('silver', 12, 13, 19, 19); c.poly('gold', [[12, 13], [19, 13], [15.5, 17]]); c.rect('gold', 12, 19, 19, 19); c.px('ua_gem', 15, 19); c.px('ua_gem', 16, 19);
      c.poly('gold', [[9, 12.5], [12.5, 12.5], [12.5, 15], [10, 15.5]]); c.poly('gold', [[22, 12.5], [18.5, 12.5], [18.5, 15], [21, 15.5]]);
    });
    c.at(0, b + (a ? 0 : P.s), () => {
      if (!a) { c.rect('silver', 10, 15, 11, 19); c.rect('elfskin', 10, 20, 11, 21); }
      else if (a === 1) { c.rect('silver', 10, 14, 18, 15); c.rect('elfskin', 18, 14, 19, 16); }
      else if (a === 2) { c.rect('silver', 10, 13, 14, 14); c.rect('elfskin', 14, 12, 15, 13); }
      else { c.rect('silver', 10, 14, 11, 17); c.rect('elfskin', 11, 17, 12, 18); }
    });
    c.at(0, b - P.s, () => {
      c.rect('silver', 20, 14, 21, 16); c.rect('elfskin', 22, 15, 23, 17);
      elfBow(c, 'gold', 23, 3, 27, a === 1 ? 5.8 : 4.8, 1, 'ua_gem');
      bowString(c, 23, 3, 27, a === 1 ? 4 : a === 2 ? -1 : 0, 15, 1, a === 1 ? 8 : 0, 'ua_gem', 'ua_gem');
      if (a === 1) glowSeg(c, 19, 15.5, 31, 15.5, 2.5, 110, '#b8ff8a');
      glowSeg(c, 26, 4, 28, 26, 1.5 + P.glow * .5, 50, '#ffe98a');
    });
    c.at(0, b, () => {
      elfHead(c, { top: false });
      c.ell('elfhair', 15.5, 5.6, 4.8, 2.7); c.rect('ua_blond', 11, 6, 12, 10); c.rect('ua_blond', 19, 6, 20, 10);
      c.poly('elfskin', [[12, 8], [7.5, 4.5], [12, 10.5]]); c.poly('elfskin', [[19, 8], [23.5, 4.5], [19, 10.5]]);
      c.px('eye', 14, 9); c.px('eye', 17, 9); c.px('mouth', 15, 11); c.px('mouth', 16, 11);
      // corona de hojas doradas
      c.rect('gold', 11, 4, 20, 4);
      for (const [x, y] of [[11, 2], [13, 1], [15, 0], [16, 0], [18, 1], [20, 2]]) c.poly('gold', [[x, 4], [x + .5, y], [x + 1.2, 4]]);
      c.px('ua_gem', 15, 3); c.px('ua_gem', 16, 3);
      halo(c, 15.5, 2.5, 3.5 + P.glow, 70, '#b8ff8a');
    });
    if (a === 1) c.at(0, b, () => c.rect('elfskin', 18, 14, 19, 16));
  },
};

// ===================================================================== ENANOS
// bajos y anchos: cabeza grande y≈11.5 r≈4.7, barba enorme y12–23, torso x9–22 y14–25, piernas cortas y25–29
const DL = [11, 14], DR = [17, 20];
function dwarfBody(c, m, belt = 'leather') {
  c.rect(m, 9, 15, 22, 25); c.rect(m, 10, 14, 21, 14);
  c.rect(belt, 9, 22, 22, 23); c.rect('gold', 14, 22, 17, 23); c.px('gold.0', 15, 23); c.px('gold.0', 16, 23);
}
// cabeza enana: cara bajo el casco, nariz grande, cejas pobladas y barba enorme (o.braid = trenzas con anillos)
function dwarfHead(c, bd, o = {}) {
  c.ell('skin', 15.5, 11.5, 4.7, 4.2);
  c.poly(bd, [[10, 12], [21, 12], [21.5, 16], [19.5, 20.5], [15.5, 23], [11.5, 20.5], [9.5, 16]]);
  c.line(bd + '.0', 13, 16, 14, 20); c.line(bd + '.0', 18, 16, 17, 20); c.px(bd + '.0', 15, 18); c.px(bd + '.0', 16, 21);
  if (o.braid) { c.rect(bd, 13, 20, 14, 25); c.rect(bd, 17, 20, 18, 25); c.rect('gold', 13, 23, 14, 23); c.rect('gold', 17, 23, 18, 23); c.px(bd + '.0', 13, 22); c.px(bd + '.0', 18, 22); }
  c.rect(bd + '.2', 11, 13, 14, 13); c.rect(bd + '.2', 17, 13, 20, 13); c.rect(bd, 12, 14, 19, 14);       // bigote
  c.rect('skin', 15, 11, 16, 13); c.px('skin.3', 15, 11); c.px('skin.0', 16, 13);                       // nariz
  c.px('eye', 13, 11); c.px('eye', 18, 11); c.rect(bd, 12, 10, 14, 10); c.rect(bd, 17, 10, 19, 10);        // ojos y cejas
}
// brazos gruesos de enano
const dArmL = (c, m, f = 'skin') => { c.rect(m, 6, 15, 8, 20); c.rect(f, 6, 21, 8, 22); };
const dArmR = (c, m, f = 'skin') => { c.rect(m, 23, 15, 25, 20); c.rect(f, 23, 21, 25, 22); };
const fist = (c, f, h) => c.rect(f, Math.round(h[0]) - 1, Math.round(h[1]) - 1, Math.round(h[0]) + 1, Math.round(h[1]));
// brazo grueso hasta un punto (ataques)
const dArmTo = (c, m, f, x0, y0, h) => { limb(c, m, x0, y0, Math.round(h[0]) - 1, Math.round(h[1]) - 1, 3); fist(c, f, h); };
const PICK = [[-5, -11], [-3, -13.5], [0, -14.5], [3, -13.5], [6, -11], [3, -12.3], [0, -12.8], [-3, -12.3]];

// ---- Minero: casco con vela, barba, pico
U.dwarf_worker = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P, o) {
    const b = P.body, a = P.atk, k = o && o.carry;
    legs(c, P, 'pants', 'leather', DL, DR, 25, 27);
    c.at(0, b, () => {
      dwarfBody(c, 'team', 'darkwood');
      c.rect('leather', 12, 17, 19, 26); c.rect('leather', 11, 15, 11, 17); c.rect('leather', 20, 15, 20, 17);   // peto de cuero
      c.rect('darkwood', 12, 22, 19, 22); c.rect('gold', 15, 22, 16, 22); c.rect('iron', 20, 23, 21, 25);       // cinto y martillito
    });
    if (k === 'wood') c.at(0, b, () => logs(c, 0, 11, 11));
    c.at(0, b + (k === 'wood' ? 0 : P.s), () => {
      if (k === 'wood') { c.rect('team', 6, 15, 8, 17); c.rect('skin', 5, 16, 7, 17); }
      else { dArmL(c, 'team'); if (k) bundle(c, k, 7, 22); }
    });
    // pico: reposo, alzado (1), golpe con chispas (2), sigue (3)
    const G = [[0, 25.5, 21], [-20, 24, 15], [120, 18.5, 18], [135, 19, 18]][a], T = rf(G[1], G[2], G[0]);
    const pick = () => {
      c.rim((t, m) => rb(t, m, T, -13, 3.5, 2), 'wood');
      c.rim((t, m) => rp(t, m, T, PICK), 'iron'); rl(c, 'iron.3', T, -2, -13.5, 2, -13.5);
      if (a === 2) { const p = T(6, -11); star(c, 'glowY', Math.round(p[0]), Math.round(p[1]) - 1); halo(c, p[0], p[1] - 1, 3, 100, '#ffe98a'); }
    };
    if (a === 1) c.at(0, b, pick);
    c.at(0, b, () => {
      dwarfHead(c, 'ua_bbeard');
      c.ell('iron', 15.5, 7.6, 5.4, 3.4); c.rect('iron', 9, 9, 22, 10); c.rect('leather', 9, 10, 22, 10); c.px('iron.3', 13, 6);
      c.rect('copper', 14, 4, 17, 5); c.rect('ua_wax', 15, 2, 16, 3); c.px('ua_wax.0', 16, 3);
    });
    c.at(P.anim === 'walk' ? P.sw * .5 : 0, b, () => { c.px('fire', 15, 1); c.px('fire', 16, 1); c.px('glowY', 15 + (P.t & 1), 0); });
    c.at(0, b, () => halo(c, 15.5, 1, 2.5 + P.glow * .6, 70, '#ffe98a'));
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!a) { dArmR(c, 'team'); pick(); c.rect('skin', 23, 20, 26, 22); }
      else { if (a !== 1) pick(); dArmTo(c, 'team', 'skin', 23, 15, T(0, 0)); }
      if (a === 2) smear(c, G[1], G[2], 13, -20, 115);
    });
  },
};

// ---- Hachero: yelmo con cuernos cortos, armadura pesada, hacha grande a dos manos
U.dwarf_inf = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    legs(c, P, 'iron', 'leather', DL, DR, 25, 27);
    c.at(0, b, () => {
      dwarfBody(c, 'steel');
      c.rect('team', 10, 24, 21, 26); c.rect('gold', 10, 26, 21, 26); c.rect('team.0', 15, 24, 16, 26);
      c.ell('steel', 8, 15.5, 3.4, 2.8); c.ell('steel', 23, 15.5, 3.4, 2.8); c.rect('team', 6, 16, 10, 16); c.rect('team', 21, 16, 25, 16);
      c.px('gold', 8, 14); c.px('gold', 23, 14);
    });
    const G = [[0, 25, 20], [-30, 22, 18], [100, 15, 19], [118, 16, 17.5]][a], T = rf(G[1], G[2], G[0]);
    const AXE = [[1, -16], [3.5, -17.5], [6.5, -16], [7, -12.5], [5.5, -8.5], [3, -9.5], [1, -10]];
    const axe = () => {
      c.rim((t, m) => { rb(t, m, T, -16.5, 6.5, 2); rp(t, m, T, AXE); rp(t, m, T, [[-1, -15], [-3.5, -13.5], [-1, -12]]); }, 'steel');
      rb(c, 'wood', T, -16, 6.5, 2); rb(c, 'leather', T, -2, 3, 2); rb(c, 'gold', T, -16.5, -15.5, 2.4);
      rp(c, 'blade', T, [[5.5, -16.5], [6.5, -16], [7, -12.5], [5.5, -8.5], [4.6, -9], [5.8, -12.5]]); re(c, 'rune', T, 3.5, -13, .8);
    };
    if (a === 1) c.at(0, b, axe);
    c.at(0, b + (a ? 0 : P.s), () => { if (!a) dArmL(c, 'steel', 'iron'); else dArmTo(c, 'steel', 'iron', 7, 15, T(0, 3)); });
    c.at(0, b, () => {
      dwarfHead(c, 'ua_rbeard');
      c.ell('steel', 15.5, 7.6, 5.5, 3.4); c.rect('steel', 10, 9, 21, 10); c.rect('gold', 10, 10, 21, 10); c.rect('steel', 15, 10, 16, 11);
      c.poly('bone', [[10.5, 8], [7, 7], [6, 3.5], [8.5, 5.5], [11, 6]]); c.poly('bone', [[20.5, 8], [24, 7], [25, 3.5], [22.5, 5.5], [20, 6]]);
      c.px('bone.0', 8, 7); c.px('bone.0', 23, 7); c.px('steel.3', 13, 6);
    });
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!a) { dArmR(c, 'steel', 'iron'); axe(); c.rect('iron', 23, 19, 26, 21); }
      else { if (a !== 1) axe(); dArmTo(c, 'steel', 'iron', 22, 15, T(0, 0)); }
      if (a === 2) smear(c, G[1], G[2], 17, -30, 100);
    });
  },
};

// ---- Alabardero: escudo torre rectangular y alabarda
U.dwarf_pike = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    legs(c, P, 'iron', 'leather', DL, DR, 25, 27);
    c.at(0, b, () => { dwarfBody(c, 'steel'); c.dither('iron', 10, 15, 21, 21, 0, 'steel'); c.ell('steel', 23, 15.5, 3.2, 2.6); });
    const G = [[0, 25, 20], [-15, 24, 19.5], [80, 11.5, 19], [100, 13, 20]][a], T = rf(G[1], G[2], G[0]);
    const halberd = () => {
      c.rim((t, m) => { rb(t, m, T, -19, 9, 2); rp(t, m, T, [[1, -17.5], [5, -18.5], [5.5, -12.5], [1, -12]]); rp(t, m, T, [[-1, -16], [-4, -15], [-1, -13.5]]); rp(t, m, T, [[-1, -19], [1, -19], [0, -21]]); }, 'steel');
      rb(c, 'wood', T, -18.5, 9, 2); rp(c, 'blade', T, [[4, -18.3], [5, -18.5], [5.5, -12.5], [4.4, -12.4]]);
      rb(c, 'gold', T, -12, -11, 2.4); re(c, 'rune', T, 3, -15.3, .8);
    };
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!a) { dArmR(c, 'steel', 'iron'); halberd(); c.rect('iron', 23, 19, 26, 21); }
    });
    c.at(0, b, () => {
      dwarfHead(c, 'hair');
      c.ell('steel', 15.5, 7.6, 5.4, 3.4); c.rect('steel', 10, 9, 21, 10); c.rect('steel', 10, 10, 11, 13); c.rect('steel', 20, 10, 21, 13);
      c.rect('steel.3', 15, 5, 16, 7); c.rect('gold', 10, 10, 21, 10); c.rect('team', 14, 3, 17, 4);
    });
    // escudo torre (contrafase al andar; avanza al golpear)
    c.at(a === 2 ? 1 : 0, b + (a ? 0 : P.s), () => {
      c.rim((t, m) => t.rect(m, 2, 12, 11, 28), 'steel');
      c.rect('team', 3, 13, 10, 27); c.rect('gold', 3, 13, 10, 13); c.rect('gold', 3, 27, 10, 27);
      c.rect('steel', 6, 16, 7, 24); c.rect('steel', 4, 18, 9, 19); c.rect('rune', 6, 18, 7, 19);      // martillo grabado
      for (const [x, y] of [[3, 15], [10, 15], [3, 25], [10, 25]]) c.px('steel.3', x, y);
    });
    if (a) c.at(0, b, () => {
      halberd(); const h = T(0, 0), h2 = T(0, 5);
      dArmTo(c, 'steel', 'iron', 22, 15, h); fist(c, 'iron', h2);
      if (a === 2) smear(c, G[1], G[2], 19, -10, 80);
    });
  },
};

// ---- Ballestero: ballesta pesada, yelmo cerrado, barba trenzada
U.dwarf_ranged = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    legs(c, P, 'pants', 'leather', DL, DR, 25, 27);
    c.at(0, b, () => {
      dwarfBody(c, 'leather', 'darkwood'); c.rect('team', 10, 23, 21, 26); c.rect('gold', 10, 26, 21, 26);
      c.ell('steel', 8, 15.5, 3, 2.4); c.ell('steel', 23, 15.5, 3, 2.4);
      c.rect('leather', 19, 21, 21, 24); c.px('team', 19, 20); c.px('feather', 20, 20); c.px('team', 21, 20);   // bolsa de virotes
    });
    c.at(0, b, () => {
      dwarfHead(c, 'ua_gbeard', { braid: true });
      c.ell('steel', 15.5, 10, 5.5, 5.3); c.rect('steel', 10, 10, 21, 13);                              // yelmo cerrado
      c.rect('ol', 12, 11, 19, 11); c.px('steel', 15, 11); c.px('steel', 16, 11); c.px('steel.0', 14, 13); c.px('steel.0', 17, 13);
      c.rect('gold', 10, 8, 21, 8); c.rect('steel.3', 15, 5, 16, 7);
    });
    c.at(P.sec === 0 ? P.sw : 0, b + P.sec, () => { c.rect('team', 14, 2, 17, 4); c.rect('team', 12, 3, 13, 5); });   // cresta
    // ballesta: en reposo baja; apunta (1), dispara (2), recarga (3)
    const lift = [0, -3, -3, -2][a], rec = a === 2 ? -1 : 0, nut = [20, 20, 26, 23][a];
    c.at(0, b, () => { limb(c, 'leather', 6, 16, 11 + rec, 19 + lift, 3); limb(c, 'leather', 23, 15, 23 + rec, 19 + lift, 3); });
    c.at(rec, b + lift, () => {
      c.rim((t, m) => { t.rect(m, 14, 18, 27, 19); t.poly(m, [[11, 18], [15, 18], [15, 21], [11, 22]]); }, 'wood');   // caja y culata
      c.rim((t, m) => { t.poly(m, [[27, 18], [29, 18], [27.5, 12], [26, 12.5]]); t.poly(m, [[27, 19.5], [29, 19.5], [27.5, 25], [26, 24.5]]); }, 'steel'); // arco de acero
      c.line('string', 26, 13, nut, 18); c.line('string', nut, 19, 26, 24);
      if (a < 2) { c.line('darkwood', 20, 17, 29, 17); c.rect('steel', 30, 17, 31, 17); c.px('steel', 30, 16); c.px('team', 21, 16); c.px('team', 22, 16); }
      c.rect('gold', 18, 18, 19, 19); c.rect('iron', 17, 20, 17, 21);
      c.rect('skin', 11, 19, 13, 20); c.rect('skin', 23, 19, 25, 20);
      if (a === 2) for (let x = 29; x < 32; x++) c.glow(x, 17, 90, '#ffffff');
    });
  },
};

// ---- Carnero de montaña de perfil (mira a la derecha); lunge = embestida de la cabeza
function ram(c, P, lunge) {
  const b = P.body;
  c.at(0, b + P.sec, () => c.ell('ua_wool', 9.5, 16.5, 1.8, 1.6));
  qleg(c, P, 'ua_ramface.0', 'ua_hoof', 14, 22 + b, .12, 0, 2, 2, 2.5);
  qleg(c, P, 'ua_ramface.0', 'ua_hoof', 25, 22 + b, .62, 1, 2, 2, 2.5);
  c.at(0, b, () => {
    c.ell('ua_wool', 18.5, 18, 9.5, 5.2); c.ell('ua_wool', 25.5, 17.5, 4, 4.6);
    for (const [x, y] of [[12, 16], [15, 14], [19, 15], [23, 14], [13, 20], [17, 19], [21, 20], [25, 19], [11, 18], [27, 16], [15, 22], [20, 22]]) c.px('ua_wool.0', x, y);
  });
  c.at(lunge, b + (lunge ? 1 : 0), () => {                // cabeza baja con cuerno enroscado
    c.ell('ua_wool', 28.5, 15.5, 3.4, 3.6);
    c.poly('ua_ramface', [[28, 12.5], [32.5, 12.5], [37.5, 16.5], [37, 19.5], [33.5, 20.5], [29, 18]]);
    c.px('eye', 33, 15); c.px('ua_ramface.0', 37, 19); c.rect('ua_ramface.2', 34, 15, 36, 15);
    c.rim((t, m) => { t.ring(m, 29.5, 15.5, 4.2, 4, .2, (x, y) => !(y >= 17 && x >= 30)); t.poly(m, [[30, 17.5], [32.5, 18.5], [32, 20.5], [30.5, 19.5]]); }, 'ua_horn');
    c.px('ua_horn.0', 29, 15); c.px('ua_horn.0', 30, 16); c.px('ua_horn.0', 28, 17); c.px('ua_horn.3', 28, 12); c.px('ua_horn.0', 26, 16); c.px('ua_horn.0', 32, 14);
  });
  qleg(c, P, 'ua_ramface', 'ua_hoof', 12, 22 + b, 0, 0, 2, 2, 2.5);
  qleg(c, P, 'ua_ramface', 'ua_hoof', 23, 22 + b, .5, 1, 2, 2, 2.5);
}

// ---- Jinete de carnero: enano con martillo sobre carnero de montaña
U.dwarf_cav = {
  w: 40, h: 32, ax: 20, ay: 29,
  render: { shadow: { cx: 20, cy: 30, rx: 13 } },
  draw(c, P) {
    const b = P.body, a = P.atk;
    ram(c, P, [0, 2, 1, 0][a]);
    const G = [[25, 24, 12], [-50, 21, 9], [100, 24, 10], [125, 24, 11]][a], T = rf(G[1], G[2], G[0]);
    const hammer = () => {
      c.rim((t, m) => { rb(t, m, T, -7, 3, 1.6); rb(t, m, T, -10.5, -6.5, 6); }, 'steel');
      rb(c, 'wood', T, -6.5, 3, 1.6); rb(c, 'gold', T, -10.5, -9.5, 6); rb(c, 'rune', T, -8.5, -7.5, 2);
    };
    c.at(0, b, () => {
      c.poly('team', [[13, 12], [24, 12], [24.5, 18], [12.5, 18]]); c.rect('gold', 12, 18, 24, 18);
      for (let x = 13; x <= 24; x += 2) c.px('gold.0', x, 19);
      c.rect('iron', 16, 13, 19, 18); c.rect('leather', 16, 19, 20, 21);                       // pierna corta y bota
      c.rect('steel', 14, 6, 22, 13); c.rect('team', 14, 10, 22, 13); c.rect('gold', 14, 13, 22, 13);
      c.ell('steel', 17, 6.5, 3, 2.2);
      // cabeza de perfil con barba enorme
      c.ell('skin', 19.5, 5, 3.6, 3.4);
      c.poly('ua_rbeard', [[17.5, 6], [22.5, 6], [24.5, 9], [23, 13.5], [19.5, 13], [17, 9]]); c.line('ua_rbeard.0', 20, 9, 21, 12); c.rect('ua_rbeard.2', 21, 7, 23, 7);
      c.px('eye', 21, 5); c.rect('skin', 23, 5, 23, 6); c.px('skin.3', 23, 5);
      c.ell('steel', 19, 2.4, 3.8, 2.4); c.rect('gold', 15, 4, 22, 4); c.px('steel.3', 18, 1);
      c.poly('bone', [[16, 2.5], [13.5, 1.5], [13, 0], [16.5, 1]]);
    });
    c.at(0, b, () => {
      hammer();
      const h = T(0, 0); limb(c, 'steel', 20, 7, Math.round(h[0]) - 1, Math.round(h[1]) - 1, 2); fist(c, 'iron', h);
      if (a === 2) { smear(c, G[1], G[2], 10, -50, 100); const p = T(0, -8.5); halo(c, p[0], p[1], 3, 90, '#9ff8f2'); }
    });
  },
};

// ---- Atronador: trabuco con fogonazo, mochila de pólvora, gafas de latón
U.dwarf_special = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, rec = a === 2 ? -2 : a === 3 ? -1 : 0;
    c.at(rec * .5, b, () => {                                                                      // barril de pólvora a la espalda
      c.rim((t, m) => { t.rect(m, 4, 6, 10, 16); t.rect(m, 5, 5, 9, 5); }, 'darkwood'); c.rect('iron', 4, 8, 10, 8); c.rect('iron', 4, 13, 10, 13);
      c.rect('darkwood.2', 5, 9, 5, 12); c.line('string', 7, 4, 5, 2); c.px('fire', 5, 1); c.px('glowY', 4, 1);
    });
    legs(c, P, 'pants', 'leather', DL, DR, 25, 27);
    c.at(rec * .5, b, () => {
      dwarfBody(c, 'team', 'darkwood'); c.line('leather', 9, 15, 21, 24); c.line('leather', 10, 15, 22, 24);
      c.px('gold', 12, 17); c.px('gold', 15, 19); c.px('gold', 18, 21);                          // frascos de pólvora
    });
    c.at(rec * .5, b + (a ? 0 : P.s), () => dArmL(c, 'team'));
    c.at(rec * .5, b, () => {
      dwarfHead(c, 'ua_rbeard');
      c.ell('leather', 15.5, 7.6, 5.4, 3.4); c.rect('leather', 10, 9, 21, 10); c.rect('leather.0', 10, 10, 21, 10);
      c.ell('copper', 13, 7, 1.8, 1.6); c.ell('copper', 18, 7, 1.8, 1.6); c.px('glowC', 13, 7); c.px('glowC', 18, 7); c.px('white', 12, 6); c.rect('copper', 14, 7, 16, 7);
    });
    // trabuco: al hombro (0), apunta (1), FUEGO (2), humo (3)
    const G = [[40, 22, 20], [90, 15, 18], [90, 15, 18], [80, 15, 18]][a], T = rf(G[1] + rec, G[2], G[0]);
    c.at(0, b, () => {
      c.rim((t, m) => { rp(t, m, T, [[-1.5, 5], [1.5, 5], [1, 0], [-1, 0]]); rb(t, m, T, -11, 0, 2); rp(t, m, T, [[-1, -11], [1, -11], [2.2, -14], [-2.2, -14]]); }, 'ua_bronze');
      rp(c, 'darkwood', T, [[-1.5, 5], [1.5, 5], [1, 0], [-1, 0]]); rb(c, 'gold', T, -5, -4, 2.4); rb(c, 'ua_bronze.0', T, -14, -13, 4);
      const h = T(0, -1), h2 = T(0, -6);
      if (a) { dArmTo(c, 'team', 'skin', 22, 15, h); dArmTo(c, 'team', 'skin', 8, 16, h2); } else { dArmR(c, 'team'); fist(c, 'skin', h); }
      const mz = T(0, -15);
      if (a === 2) {                                                                             // fogonazo
        c.poly('fire', [[mz[0] - 1, mz[1] - 3], [mz[0] + 3, mz[1] - 3.5], [mz[0] + 2, mz[1] - 1], [mz[0] + 4, mz[1]], [mz[0] + 2, mz[1] + 1.5], [mz[0] + 3, mz[1] + 3.5], [mz[0] - 1, mz[1] + 3]]);
        c.ell('glowY', mz[0] + 1, mz[1] + .5, 1.6, 1.8); halo(c, mz[0] + 1, mz[1], 6, 120, '#ffe98a'); halo(c, mz[0] + 1, mz[1], 8, 50, '#ff6a4a');
      }
      if (a === 3) { c.ell('ua_smoke', mz[0] + .5, mz[1] - 2, 2, 1.8); c.ell('ua_smoke', mz[0] - 1.5, mz[1] - 4.5, 1.6, 1.5); c.px('ua_smoke.3', mz[0] - 1, mz[1] - 3); }
      if (a === 1) c.px('fire', Math.round(T(0, -2)[0]), Math.round(T(0, -2)[1]) - 2);
    });
  },
};

// ---- Bombarda: cañón de bronce rúnico sobre cureña, fogonazo al disparar
U.dwarf_siege = {
  w: 40, h: 32, ax: 20, ay: 29,
  render: { shadow: { cx: 20, cy: 30, rx: 16 } },
  draw(c, P) {
    const W = P.anim === 'walk', b = W ? P.body : 0, r = spin(P), a = P.atk, rec = a === 2 ? -2 : a === 3 ? -1 : 0;
    c.ring('darkwood.0', 23, 22.5, 6, 6, .5, (x, y) => y < 21);                                  // rueda lejana
    c.at(0, b, () => {
      c.rim((t, m) => t.poly(m, [[3, 29], [7, 29], [24, 22], [25, 18], [20, 17]]), 'darkwood');  // gualdera
      c.poly('team', [[8, 26], [19, 21.5], [21, 19.5], [9, 24]]); c.px('gold', 13, 23); c.px('gold', 17, 21.5);
      c.rect('iron', 3, 28, 6, 29);
    });
    c.at(rec, b, () => {
      c.rim((t, m) => { t.poly(m, [[10, 13.5], [30, 11], [30.5, 15.5], [10.5, 20.5]]); t.ell(m, 10, 17, 3.4, 3.5); t.ell(m, 5.8, 17.5, 1.4, 1.4); t.poly(m, [[29.5, 10], [33.5, 9.5], [34, 16], [30, 16.5]]); }, 'ua_bronze');
      for (const [x, y0, y1] of [[15, 13, 19], [23, 12, 17]]) c.line('ua_bronze.0', x, y0, x, y1);
      c.line('gold', 29, 11, 29, 16); c.line('ua_bronze.3', 11, 14.5, 29, 11.5); c.rect('ua_bronze.0', 33, 10, 33, 15);
      c.px('rune', 18, 15); c.px('rune', 19, 16); c.px('rune', 20, 15); c.px('rune', 26, 13); c.px('rune', 27, 14);
      if (a === 1 || a === 0) c.px(a === 1 ? 'glowY' : 'iron', 12, 14);
      if (a === 1) { c.px('fire', 12, 13); halo(c, 12, 13, 2.5 + P.glow * .5, 110, '#ffe98a'); }
      if (a === 2) {
        c.poly('fire', [[34, 8], [37.5, 8.5], [36, 11], [39.5, 12.5], [36, 14.5], [37.5, 17], [34, 17]]); c.ell('glowY', 35.5, 12.8, 1.6, 2.4);
        halo(c, 35.5, 12.8, 5, 130, '#ffe98a'); halo(c, 35.5, 12.8, 7, 50, '#ff6a4a');
      }
      if (a === 3) { c.ell('ua_smoke', 36.5, 11.5, 2.2, 2); c.ell('ua_smoke', 34.5, 8, 1.8, 1.6); c.px('ua_smoke.3', 35, 10); }
    });
    c.at(0, b, () => { c.rect('darkwood', 17, 15, 25, 19); c.rect('iron', 17, 15, 25, 15); c.rect('team', 18, 16, 24, 18); c.rect('gold', 21, 16, 21, 18); });   // muñón con placa del equipo
    wheel(c, 21, 23.5, 6, r, 'darkwood', 'wood', 3, 'iron', 'darkwood.0'); c.px('gold', 20, 22);
  },
};

// ---- Rey de la Montaña: corona-yelmo dorada, barba trenzada blanca, martillo rúnico brillante, capa
U.dwarf_general = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw;
    c.poly('team', [[8.5, 14 + b], [22.5, 14 + b], [26 + sw, 29], [5 + sw, 29]]);                 // capa
    c.rect('gold', 5 + sw, 28, 26 + sw, 28); c.rect('team.0', 13, 26, 18, 28);
    legs(c, P, 'steel', 'gold', DL, DR, 25, 27);
    c.at(0, b, () => {
      dwarfBody(c, 'gold', 'darkwood'); c.rect('steel', 11, 15, 20, 21); c.rect('rune', 15, 16, 16, 16); c.rect('rune', 14, 18, 17, 18);
      c.rect('team', 10, 24, 21, 26); c.rect('gold', 10, 26, 21, 26);
      c.ell('gold', 8, 15.5, 3.5, 2.9); c.ell('gold', 23, 15.5, 3.5, 2.9); c.px('rune', 8, 15); c.px('rune', 23, 15);
    });
    const G = [[0, 25, 20], [15, 22, 17], [110, 14, 19], [125, 15, 18]][a], T = rf(G[1], G[2], G[0]);
    const hammer = () => {
      c.rim((t, m) => { rb(t, m, T, -11, 5, 2); rb(t, m, T, -16, -10.5, 8); }, 'iron');
      rb(c, 'darkwood', T, -10.5, 5, 2); rb(c, 'gold', T, -16, -15, 8); rb(c, 'gold', T, -11.5, -10.5, 8); rb(c, 'gold', T, 4, 5, 2.6);
      rb(c, 'rune', T, -13.8, -12.8, 4); rb(c, 'rune', T, -14.5, -12, 1);
      const p = T(0, -13.3); halo(c, p[0], p[1], 5 + (a === 2 ? 2.5 : P.glow * .7), a === 2 ? 130 : 70, '#9ff8f2');
    };
    c.at(0, b + (a ? 0 : P.s), () => { if (!a) dArmL(c, 'gold', 'steel'); else dArmTo(c, 'gold', 'steel', 7, 15, T(0, 3)); });
    c.at(0, b, () => {
      dwarfHead(c, 'beard', { braid: true });
      c.ell('gold', 15.5, 7.6, 5.5, 3.4); c.rect('gold', 10, 8, 21, 10); c.rect('gold.0', 10, 10, 21, 10);
      for (const [x, h] of [[10, 3], [12, 2], [15, 1], [16, 1], [19, 2], [21, 3]]) c.rect('gold', x, h, x, 6);
      c.px('gold.3', 15, 0); c.px('gold.3', 16, 0); c.px('red', 15, 9); c.px('red', 16, 9); c.px('team', 12, 9); c.px('team', 19, 9);
      halo(c, 15.5, 3, 3 + P.glow, 55, '#ffe98a');
    });
    c.at(0, b - (a ? 0 : P.s), () => {
      if (!a) { dArmR(c, 'gold', 'steel'); hammer(); c.rect('steel', 23, 19, 26, 21); }
      else { hammer(); dArmTo(c, 'gold', 'steel', 22, 15, T(0, 0)); }
      if (a === 2) { smear(c, G[1], G[2], 15, -30, 110, 110); const p = T(0, -13); star(c, 'glowC', Math.round(p[0]) - 1, Math.round(p[1]) + 3); }
    });
  },
};

})();
