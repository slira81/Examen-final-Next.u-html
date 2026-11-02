import { PE } from '../sprite.js';
/* =====================================================================
   Pixel Empires — arte de unidades B: orcos, gigantes y neutrales.
   Solo registra definiciones en PE.ART.units (contrato: ART_SPEC.md).
   ===================================================================== */
(function () {
const U = PE.ART.units;

// ------------------------------------------------------------- materiales propios (prefijo ub_)
PE.addMats({
  ub_hide: '#c4a074',   // cuero curtido claro (escudos, techos)
  ub_rag: '#7d6447',    // harapos marrones
  ub_rag2: '#56473c',   // capucha / pañuelo oscuro
  ub_gob: '#a3bf6c',    // piel goblin verde pálido
  ub_ogre: '#b5926b',   // piel de ogro
  ub_wolf: '#8c8f9c',   // pelaje de lobo gris
  ub_mamm: '#87512f',   // pelaje de mamut
  ub_rope: '#c9ab72',   // cuerda
  ub_boulder: '#6f7a8c',// roca azulada de los lanzarrocas
});
PE.addFixed({
  ub_sm: '#fff6e070',   // estela de golpe (semitransparente)
  ub_frost: '#c9f7ffb4',// aliento helado
  ub_bolt: '#eafcff',   // relámpago
});

// ------------------------------------------------------------- utilidades
const D2R = Math.PI / 180, lerp = (A, B, k) => A + (B - A) * k;
// marco local de un arma: u a lo largo del asta desde la mano, v perpendicular
const fr = (px, py, ang) => { const r = ang * D2R, cs = Math.cos(r), sn = Math.sin(r); return (u, v) => [px + u * cs - v * sn, py + u * sn + v * cs]; };
const pw = (t, m, f, pts) => t.poly(m, pts.map(p => f(p[0], p[1])));
const bar = (t, m, f, u0, u1, w) => {
  if (w <= 1) { const [x0, y0] = f(u0, 0), [x1, y1] = f(u1, 0); t.line(m, x0, y0, x1, y1); return; }
  pw(t, m, f, [[u0, -w / 2], [u1, -w / 2], [u1, w / 2], [u0, w / 2]]);
};
// miembro (brazo, pata) de grosor w entre dos puntos
const limb = (c, m, x0, y0, x1, y1, w) => {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2;
  c.poly(m, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
};
// halo pulsante alrededor de un punto
const halo = (c, cx, cy, r, g, hex) => {
  const R = r + 0.8 + g * 0.9;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
    const d = Math.hypot(x + .5 - cx, y + .5 - cy);
    if (d > r && d <= R) c.glow(x, y, d < r + 1.3 ? 135 : 65, hex);
  }
};
// estela de golpe: arco alrededor de (cx,cy) entre a0 y a1 (grados)
const smear = (c, cx, cy, r, a0, a1, w = 2) => {
  for (let a = a0; a0 < a1 ? a <= a1 : a >= a1; a += a0 < a1 ? 4 : -4) for (let k = 0; k < w; k++) {
    const rr = r - k, x = cx + Math.cos(a * D2R) * rr, y = cy + Math.sin(a * D2R) * rr;
    if (c.get(Math.round(x + c.ox), Math.round(y + c.oy)) === null) c.px('ub_sm', x, y);   // sólo sobre fondo vacío
  }
};
// rayo en zigzag entre dos puntos (semilla fija por frame)
const bolt = (c, x0, y0, x1, y1, seed, m = 'ub_bolt') => {
  const n = 5, cx = x => Math.max(1 - c.ox, Math.min(c.w - 2.6 - c.ox, x)), cy = y => Math.max(1 - c.oy, Math.min(c.h - 2.6 - c.oy, y));
  let px = cx(x0), py = cy(y0);
  for (let i = 1; i <= n; i++) {
    const k = i / n, j = i === n ? 0 : (((seed * 7 + i * 13) % 5) - 2) * 0.9;
    const nx = cx(lerp(x0, x1, k) + (y1 - y0 ? j : 0) * 0.3), ny = cy(lerp(y0, y1, k) + j);   // dentro del lienzo
    c.line(m, px, py, nx, ny); px = nx; py = ny;
  }
};

// ------------------------------------------------------------- bultos de trabajador (32 px, hombro izq.)
function load32(c, kind) {
  if (kind === 'wood') {        // dos troncos al hombro con la veta a la vista
    c.rim(t => t.rect('x', 1, 11, 12, 13), 'wood'); c.rim(t => t.rect('x', 2, 7, 12, 9), 'wood');
    c.line('darkwood', 3, 12, 11, 12); c.line('darkwood', 4, 8, 11, 8);
    for (const [x, y] of [[1, 11], [2, 7]]) { c.rect('cloth', x, y, x, y + 2); c.px('wood.0', x, y + 1); }
    c.rect('ub_rope', 7, 7, 7, 13);
  } else if (kind === 'food') { // saco con un jamón
    c.ell('sack', 5.5, 11.2, 4.6, 4); c.rect('ub_rope', 8, 7, 9, 8); c.px('sack.0', 5, 13); c.px('sack.0', 3, 12);
    c.ell('red', 4.5, 6.5, 2.4, 1.7); c.px('red.2', 4, 6); c.rect('bone', 1, 5, 2, 5); c.px('bone', 1, 4); c.ell('leaf', 8, 6.5, 1.3, 1.2);
  } else if (kind === 'gold') { // saco rebosante de pepitas
    c.ell('sack', 5.5, 11.6, 4.4, 3.8); c.rect('ub_rope', 3, 8, 8, 8);
    for (const [x, y] of [[2, 7], [4, 6], [6, 5], [8, 6], [5, 7], [7, 7], [3, 8]]) c.px('gold', x, y);
    c.px('gold.3', 6, 5); c.px('gold.3', 2, 7); c.px('gold.0', 5, 7);
  } else if (kind === 'stone') { // bloque de piedra
    c.rim(t => t.poly('x', [[0.5, 9], [3, 5.5], [10, 6], [11.5, 10], [10, 14.5], [1.5, 14.5]]), 'stone');
    c.line('stone.0', 4, 9, 7, 12); c.line('stone.0', 7, 12, 9, 12); c.px('stone.3', 3, 7); c.px('stone.3', 4, 7); c.px('stone.0', 9, 14);
  } else if (kind === 'iron') {  // mena de hierro con óxido
    c.rim(t => t.poly('x', [[0.5, 10], [2.5, 6], [7, 5], [11, 8], [11, 13.5], [6, 15], [1.5, 14]]), 'iron');
    c.px('copper', 4, 11); c.px('copper', 5, 11); c.px('copper', 8, 9); c.px('copper.0', 7, 13); c.px('iron.3', 4, 7); c.px('iron.3', 9, 12); c.px('iron.3', 3, 8);
  }
}

// ------------------------------------------------------------- orcos (32×32): encorvados y fornidos
const OSK = 'orcskin';
// hombros (8,16.5) y (23,16.5); brazos colgando por fuera del torso para que el contorno los separe
function orcLegs(c, P, pm = 'leather', bm = 'fur') {
  c.at(0, P.ll, () => { c.rect(pm, 10, 23, 14, 26); c.rect(bm, 9, 26, 14, 29); c.px(null, 9, 26); c.rect(bm + '.0', 10, 27, 14, 27); });
  c.at(0, P.lr, () => { c.rect(pm, 17, 23, 21, 26); c.rect(bm, 17, 26, 22, 29); c.px(null, 22, 26); c.rect(bm + '.0', 17, 27, 21, 27); });
}
function orcTorso(c, b, s = OSK) {
  c.at(0, b, () => {
    c.ell(s, 15.5, 15.4, 7.8, 3.8);                                               // trapecios / joroba
    c.poly(s, [[8, 14.5], [23, 14.5], [22, 18.5], [20.5, 23], [10.5, 23], [9, 18.5]]); // pecho ancho, cintura
    c.rect(s + '.0', 11, 18, 14, 18); c.rect(s + '.0', 17, 18, 20, 18);
  });
}
// cabeza baja, mandíbula ancha y colmillos; contorno propio para separarla del torso
function orcHead(c, b, o = {}) {
  const s = o.skin || OSK, eye = o.eye || 'glowY';
  c.at(0, b, () => {
    c.rim(t => {
      t.ell('x', 15.5, 10.2, 4.6, 4.2); t.rect('x', 11, 11, 20, 13); t.rect('x', 12, 14, 19, 14);
      t.px('x', 10, 9); t.px('x', 9, 8); t.px('x', 21, 9); t.px('x', 22, 8);
    }, s);
    c.rect(s + '.0', 12, 9, 14, 9); c.rect(s + '.0', 17, 9, 19, 9);
    c.px(eye, 13, 10); c.px(eye, 18, 10);
    c.px(s + '.2', 15, 10); c.px(s + '.2', 15, 11); c.px(s + '.0', 16, 11);
    c.rect('ol', 14, 13, 17, 13);
    c.px('bone', 13, 12); c.px('bone', 13, 13); c.px('bone', 18, 12); c.px('bone', 18, 13);
    if (o.paint) { c.px('red', 12, 11); c.px('red', 12, 12); c.px('red', 19, 11); c.px('red', 19, 12); c.rect('red', 15, 6, 16, 8); }
  });
}
const fist = (c, s, x, y) => c.ell(s, x, y, 1.7, 1.7);
const orcArm = (c, x0, y0, x1, y1, br) => { limb(c, OSK, x0, y0, x1, y1, 3); if (br) limb(c, br, lerp(x0, x1, .55), lerp(y0, y1, .55), lerp(x0, x1, .9), lerp(y0, y1, .9), 3.4); };
// hacha arrojadiza (u desde la mano, filo hacia v+)
const AXE_S = [[4, 0.5], [6.5, 0.5], [7.6, 3.6], [3, 3.6]];
const throwAxe = (c, f) => {
  c.rim(t => { bar(t, 'x', f, -1, 6.5, 2); pw(t, 'x', f, AXE_S); }, 'wood');
  pw(c, 'iron', f, AXE_S); pw(c, 'blade', f, [[3, 2.9], [7.4, 2.9], [7.6, 3.6], [3, 3.6]]);
};

U.orc_worker = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P, o) {
    const b = P.body, a = P.atk, cr = o.carry;
    orcLegs(c, P, OSK, 'leather');
    c.at(0, b, () => { c.rect('ub_rope', 10, 22, 21, 22); c.ell('sack', 9.5, 24.5, 1.8, 2); c.px('ub_rope', 10, 23); });
    c.at(P.sw, b, () => { c.poly('team', [[11.5, 23], [19.5, 23], [18.5, 27.5], [12.5, 27.5]]); c.rect('team.0', 15, 24, 15, 27); });
    orcTorso(c, b);
    c.at(0, b, () => { c.line('ub_rope', 11, 15, 20, 21); c.line('ub_rope', 12, 15, 21, 21); });
    // brazo izquierdo: sujeta el bulto al hombro o se balancea
    if (cr) c.at(0, b, () => { orcArm(c, 8, 16.5, 6.5, 12.5); c.rect('team', 5, 15, 9, 16); load32(c, cr); fist(c, OSK, 7, 12.5); });
    else c.at(0, b + P.s, () => { orcArm(c, 8, 16.5, 6, 22.5); c.rect('team', 5, 17, 9, 18); fist(c, OSK, 6, 23); });
    orcHead(c, b);
    c.at(0, b, () => { c.px('gold', 22, 9); c.px('gold', 9, 9); });
    // brazo derecho con hacha tosca (rota en el ataque / trabajo)
    const T = [[25.5, 21.5 - P.s, -90], [21.5, 12.5, -150], [17.5, 17.5, -10], [18.5, 19.5, 30]][a];
    c.at(0, b, () => {
      orcArm(c, 23, 16.5, T[0], T[1]);
      if (a === 2) smear(c, T[0], T[1], 12, -125, -20);
      const f = fr(T[0], T[1], T[2]), head = [[8, 0.5], [11, 0.5], [12.6, 5.2], [6.4, 5.2]], sp = [[8.5, -0.5], [10.5, -0.5], [9.5, -2.5]];
      c.rim(t => { bar(t, 'x', f, -3, 12, 2); pw(t, 'x', f, head); pw(t, 'x', f, sp); }, 'wood');
      pw(c, 'iron', f, head); pw(c, 'iron', f, sp); pw(c, 'blade', f, [[6.4, 4.4], [12.6, 4.4], [12.6, 5.2], [6.4, 5.2]]);
      bar(c, 'ub_rope', f, 8.6, 10.4, 2);
      fist(c, OSK, T[0], T[1]);
    });
  },
};

U.orc_inf = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    orcLegs(c, P, 'leather', 'iron');
    c.at(0, b, () => { c.rect('leather', 10, 21, 21, 22); c.rect('iron', 15, 21, 16, 22); });
    c.at(P.sw, b, () => { c.rect('team', 10, 23, 21, 25); c.px('team.0', 13, 25); c.px('team.0', 16, 25); c.px('team.0', 19, 25); });
    orcTorso(c, b);
    c.at(0, b, () => { c.poly('leather', [[9, 15], [11, 15], [21, 21], [19, 21]]); c.poly('leather', [[20, 15], [22, 15], [12, 21], [10, 21]]); c.rect('iron', 14, 17, 17, 19); c.px('iron.3', 14, 17); });
    c.at(0, b + P.s, () => { orcArm(c, 8, 16.5, 6, 23, 'leather'); fist(c, OSK, 6, 23.5); });
    // hombreras con pinchos
    c.at(0, b, () => {
      c.ell('iron', 7.5, 15.5, 3.6, 3); c.ell('iron', 23.5, 15.5, 3.6, 3);
      c.rect('team', 5, 17, 9, 17); c.rect('team', 22, 17, 26, 17);
      for (const [x, y] of [[5, 12], [7, 11], [24, 11], [26, 12]]) { c.px('bone', x, y); c.px('bone', x, y + 1); }
    });
    orcHead(c, b);
    c.at(0, b, () => {   // casquete de hierro con nasal y cresta
      c.ring('iron', 15.5, 9.2, 5.3, 4.8, -1, (x, y) => y <= 8); c.rect('iron', 10, 8, 21, 8); c.rect('iron.0', 11, 8, 20, 8);
      c.rect('iron', 15, 9, 16, 10); c.rect('iron.2', 15, 2, 16, 4); c.px('iron.2', 12, 4); c.px('iron.2', 19, 4); c.px('iron.3', 13, 5);
    });
    // brazo derecho con cuchilla enorme
    const T = [[25.5, 21.5 - P.s, -90], [21.5, 11.5, -150], [18.5, 17.5, 5], [19.5, 19.5, 36]][a];
    c.at(0, b, () => {
      orcArm(c, 23, 16.5, T[0], T[1], 'leather');
      if (a === 2) smear(c, T[0], T[1], 11, -135, 0, 3);
      const f = fr(T[0], T[1], T[2]), blade = [[2.5, -1.5], [11, -1.5], [11.5, 1], [10.5, 4.5], [3.5, 3.5], [2.5, 1.5]];
      c.rim(t => { bar(t, 'x', f, -2, 3, 2); pw(t, 'x', f, blade); }, 'iron');
      pw(c, 'blade', f, [[3.5, 2.2], [10.6, 3.6], [10.5, 4.5], [3.5, 3.5]]);
      const [hx, hy] = f(9, 0); c.px('ol', hx, hy);
      bar(c, 'leather', f, -2, 2, 2);
      fist(c, OSK, T[0], T[1]);
    });
  },
};

U.orc_pike = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    orcLegs(c, P, 'fur', 'leather');
    c.at(0, b, () => c.rect('leather', 10, 22, 21, 22));
    c.at(P.sw, b, () => { c.poly('ub_hide', [[11.5, 23], [19.5, 23], [19, 26.5], [12, 26.5]]); c.px(null, 13, 26); c.px(null, 16, 26); c.px(null, 18, 26); });
    orcTorso(c, b);
    c.at(0, b, () => {    // pintura de guerra, collar y hombrera de piel
      c.line('red', 11, 15, 13, 17); c.line('red', 20, 15, 18, 17);
      c.px('bone', 14, 16); c.px('bone', 15, 17); c.px('bone', 16, 17); c.px('bone', 17, 16);
      c.ell('fur', 23, 15.2, 3.2, 2.5);
    });
    // escudo de piel con emblema del equipo
    c.at(a === 2 ? 1 : 0, b + P.s, () => {
      orcArm(c, 8, 16.5, 6.5, 21);
      c.rim(t => t.ell('x', 6, 19.5, 4.6, 6.2), 'ub_hide');
      c.ell('team', 6, 19.5, 3.2, 4.6); c.rect('ub_hide', 5, 15, 6, 24); c.ell('bone', 5.5, 19.5, 1.4, 1.4);
      c.px('ub_hide.0', 3, 16); c.px('ub_hide.0', 8, 23); c.rect('fur', 5, 26, 6, 27);
    });
    orcHead(c, b, { paint: 1 });
    c.at(P.sec === 0 ? 0 : -P.sec, b + P.sec, () => {   // cresta teñida del equipo
      c.rect('team', 15, 2, 16, 6); c.px('team', 14, 3); c.px('team', 17, 3); c.px('team', 14, 5); c.px('team', 17, 5); c.px('team.3', 15, 2);
    });
    // lanza con punta de hueso: vertical en reposo, embestida horizontal en el ataque
    const T = [[25.5, 19.5 - P.s, -90, 0], [19.5, 15.5, -30, -8], [22.5, 17.5, -4, -8], [21.5, 18.5, 6, -8]][a];
    c.at(0, b, () => {
      orcArm(c, 23, 16.5, T[0], T[1]);
      const f = fr(T[0], T[1], T[2]), k = T[3], tip = [[11.5 + k, -1.6], [13.5 + k, -1.8], [17 + k, 0], [13.5 + k, 1.8], [11.5 + k, 1.6]];
      if (a === 2) for (const [v, u0, u1] of [[-2.5, -6, -14], [2.5, -4, -12]]) { const [x0, y0] = f(u0, v), [x1, y1] = f(u1, v); c.line('ub_sm', x0, y0, x1, y1); }
      c.rim(t => { bar(t, 'x', f, -5 + k, 12 + k, 2); pw(t, 'x', f, tip); }, 'wood');
      pw(c, 'bone', f, tip); bar(c, 'ub_rope', f, 10.5 + k, 11.6 + k, 2.4); bar(c, 'feather', f, 9 + k, 9.9 + k, 2.6);
      fist(c, OSK, T[0], T[1]);
    });
  },
};

U.orc_ranged = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    orcLegs(c, P, 'leather', 'fur');
    c.at(P.sw, b, () => { c.poly('team', [[12.5, 23], [18.5, 23], [18, 27], [13, 27]]); c.rect('team.0', 15, 24, 15, 26); });
    orcTorso(c, b);
    c.at(0, b, () => {   // correas cruzadas y cinto con hachas arrojadizas
      c.line('leather', 9, 15, 20, 21); c.line('leather', 10, 15, 21, 21); c.px('iron', 13, 17); c.px('iron', 17, 19);
      c.rect('leather', 10, 21, 21, 22); c.rect('iron', 15, 21, 16, 22);
      throwAxe(c, fr(11, 22, 110)); throwAxe(c, fr(20, 22, 70));
    });
    c.at(0, b + P.s, () => { orcArm(c, 8, 16.5, 6, 22.5, 'leather'); fist(c, OSK, 6, 23); });
    orcHead(c, b);
    c.at(0, b, () => { c.rect('team', 11, 7, 20, 8); c.rect('team.0', 11, 8, 20, 8); c.rect('team', 21, 8, 22, 9); });
    c.at(-P.sw, b + P.sec, () => { c.px('team', 23, 9); c.px('team', 23, 10); c.px('team', 24, 11); c.px('team', 22, 11); });
    // brazo de lanzamiento: atrás (1), suelta (2: sin hacha), seguimiento (3)
    const T = [[25.5, 21.5 - P.s, -80], [21.5, 8.5, -160], [29.5, 14.5, -10], [23.5, 22.5, 60]][a];
    c.at(0, b, () => {
      orcArm(c, 23, 16.5, T[0], T[1], 'leather');
      if (a === 2) smear(c, 23, 16.5, 9, -120, -20, 2);
      if (a < 2) throwAxe(c, fr(T[0], T[1], T[2]));
      fist(c, OSK, T[0], T[1]);
    });
  },
};

// lobo gigante de perfil (mirando a la derecha) para 40×32
function wolf(c, P, lunge) {
  const b = P.body, walk = P.anim === 'walk', W = 'ub_wolf';
  for (const [hx, ph, far, hind] of [[12.5, 0, 1, 1], [26, .5, 1, 0], [15, .14, 0, 1], [28.5, .64, 0, 0]]) {
    let dx = 0, lift = 0;
    if (walk) { const th = 2 * Math.PI * (P.t / 8 + ph); dx = 2.6 * Math.cos(th); lift = Math.max(0, 2.2 * Math.sin(th)); }
    else if (lunge) dx = hind ? -1.5 : 2;
    const m = far ? W + '.0' : W, hy = 19.5 + b, fy = 28.5 - lift, fx = hx + dx + (hind ? -0.5 : 0.5);
    const kx = hind ? hx - 2.2 + dx * .3 : hx + dx * .5, ky = hind ? 24.8 - lift * .5 : 24.5 - lift * .4;
    limb(c, m, hx, hy, kx, ky, hind ? 4.2 : 3.4); limb(c, m, kx, ky, fx, fy, 2.8);
    c.rect(m, Math.round(fx) - 1, Math.round(fy), Math.round(fx) + 2, Math.round(fy)); c.px(far ? 'ol' : W + '.0', Math.round(fx) + 2, Math.round(fy));
  }
  c.at(lunge ? 1 : 0, b, () => {
    c.at(0, -P.sec, () => { c.poly(W, [[10, 15], [6, 11.5], [2, 10.5], [1.5, 13], [4, 15.5], [9, 19]]); c.px(W + '.3', 2, 11); c.px(W + '.3', 3, 11); });
    c.ell(W, 13, 18, 5, 4.6);
    c.ell(W, 20, 18.2, 9, 4);
    c.ell(W, 26.5, 17.5, 4.8, 5.2);
    c.poly(W, [[24, 13], [30, 9], [34, 11], [32, 19.5], [26.5, 20]]);
    c.line(W + '.0', 25, 13, 29, 10.5); c.line(W + '.0', 15, 14, 22, 14); c.px(W + '.3', 30, 17); c.px(W + '.3', 31, 15); c.px(W + '.3', 29, 19);
  });
}
function wolfHead(c, P, lunge, bite) {
  const W = 'ub_wolf';
  c.at(lunge ? 1 : 0, P.body + (lunge ? 1 : 0), () => {
    c.ell(W, 32.5, 11.8, 3.8, 3.4);
    c.poly(W, [[30, 5.5], [32, 9], [29.5, 9.5]]); c.poly(W, [[33, 5.5], [34.5, 9], [32.5, 9.5]]);
    c.px(W + '.0', 30, 7); c.px(W + '.0', 33, 7);
    if (bite) {
      c.poly(W, [[33.5, 10], [38.5, 9], [38.5, 11.2], [34.5, 12.5]]);
      c.poly(W, [[33, 14], [37.5, 15.5], [37.5, 16.6], [33, 16]]);
      c.poly('red', [[34.5, 12.5], [38, 11.4], [37.5, 15.4], [33.5, 14]]);
      c.px('white', 37, 11.6); c.px('white', 35, 12.2); c.px('white', 36, 14.6); c.px('ol', 38, 9);
    } else {
      c.poly(W, [[33.5, 10], [38.5, 11], [38.5, 13.2], [33.5, 15]]);
      c.line('ol', 34, 14, 38, 13); c.px('white', 36, 14); c.px('ol', 38, 11);
    }
    c.px('glowY', 33, 10.6); c.px('ol', 32, 10);
  });
}

U.orc_cav = {
  w: 40, h: 32, ax: 20, ay: 29, render: { shadow: { cx: 20, cy: 30, rx: 14 } },
  draw(c, P) {
    const b = P.body, a = P.atk, lunge = a === 2 || a === 3;
    wolf(c, P, lunge);
    c.at(lunge ? 1 : 0, b, () => {   // montura y gualdrapa del equipo
      c.poly('team', [[14, 14.5], [23.5, 14.5], [24, 21.5], [13.5, 21.5]]); c.rect('team.0', 13, 21, 24, 21);
      c.px('bone', 15, 22); c.px('bone', 18, 22); c.px('bone', 21, 22); c.ell('bone', 18.5, 18, 1.5, 1.3); c.px('ol', 18, 18);
      c.rect('leather', 13, 13, 24, 14); c.rect('leather', 13, 11, 14, 13);
    });
    wolfHead(c, P, lunge, a === 2);
    // jinete orco (encorvado hacia delante)
    const rb = b + (lunge ? 1 : 0), rx = lunge ? 1 : 0;
    c.at(rx, rb, () => {
      limb(c, 'leather', 18.5, 13, 22.5, 15.5, 3.4); limb(c, 'leather', 22.5, 15.5, 22, 20.5, 3); c.rect('fur', 21, 20, 24, 22);
      c.poly(OSK, [[15, 7.5], [21, 6.5], [23, 13], [15.5, 14]]);
      c.poly('leather', [[15.5, 9.5], [22, 9], [23, 13], [15.5, 14]]); c.rect('team', 15, 10, 22, 11); c.px('iron', 19, 12);
      c.ell('fur', 17, 8, 3.2, 2.4);
      c.rim(t => { t.ell('x', 21, 5.4, 3.3, 3.1); t.rect('x', 21, 5, 25, 8); t.px('x', 18, 4); t.px('x', 17, 3); }, OSK);
      c.rect(OSK + '.0', 22, 4, 24, 4); c.px('glowY', 23, 5); c.rect('ol', 22, 7, 25, 7); c.px('bone', 24, 6); c.px('bone', 21, 6);
      c.ring('iron', 20.5, 5, 3.6, 3.2, -1, (x, y) => y <= 3); c.px('iron.2', 20, 1);
    });
    // brazo y cuchilla curva
    const T = [[25.5, 12.5, -82], [19.5, 8.5, -168], [26.5, 10.5, 25], [25.5, 13.5, 55]][a];
    c.at(rx, rb, () => {
      orcArm(c, 19.5, 8.5, T[0], T[1], 'leather');
      if (a === 2) smear(c, T[0], T[1], 11, -115, 20, 2);
      const f = fr(T[0], T[1], T[2]), bl = [[2, -1.2], [9.5, -1.6], [12, 0.5], [10.5, 3.6], [4, 2.4], [2, 1.2]];
      c.rim(t => { bar(t, 'x', f, -2, 2.5, 2); pw(t, 'x', f, bl); }, 'iron');
      pw(c, 'blade', f, [[4, 1.6], [11, 2.6], [10.5, 3.6], [4, 2.4]]); bar(c, 'leather', f, -2, 1.5, 2);
      fist(c, OSK, T[0], T[1]);
    });
  },
};

U.orc_special = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw, g = P.glow;
    c.at(0, P.ll, () => c.rect('leather', 10, 27, 14, 29));
    c.at(0, P.lr, () => c.rect('leather', 17, 27, 21, 29));
    // túnica larga del equipo con dobladillo raído
    c.poly('team', [[10, 19 + b], [21, 19 + b], [23 + sw, 28], [8 + sw, 28]]);
    for (let x = 9; x <= 22; x += 3) c.px(null, x + sw, 28);
    c.rect('team.0', 15 + sw, 22, 15 + sw, 27);
    orcTorso(c, b);
    c.at(0, b, () => {   // manto de piel y collar de huesos
      c.ell('fur', 15.5, 15, 8.2, 3.2); c.poly('fur', [[8, 15], [23, 15], [20, 19], [11, 19]]);
      c.rect('leather', 10, 20, 21, 21); c.rect('team', 14, 20, 17, 21);
      for (const [x, y] of [[12, 18], [14, 19], [17, 19], [19, 18]]) c.px('bone', x, y);
    });
    // mano izquierda que conjura
    const cast = a === 1 || a === 2, lh = cast ? [5, 13.5] : [6, 22.5 + P.s];
    c.at(0, b, () => {
      orcArm(c, 8, 16.5, lh[0], lh[1], 'fur'); fist(c, OSK, lh[0], lh[1]);
      if (cast) { halo(c, lh[0], lh[1] - 2.5, 1, g, '#9ff8f2'); c.px('ub_bolt', lh[0] - 1, lh[1] - 3); c.px('ub_bolt', lh[0] + 1, lh[1] - 4); c.px('glowC', lh[0], lh[1] - 3); }
    });
    // plumas detrás de la cabeza
    c.at(0, b + P.sec, () => {
      for (const [x0, y0, x1, y1] of [[12, 7, 8, 2], [15, 6, 15, 1], [19, 7, 23, 2]]) { limb(c, 'feather', x0 + .5, y0 + .5, x1 + .5, y1 + .5, 1.8); c.rect('team', x1, y1, x1 + (x1 > 15 ? 0 : x1 < 15 ? 0 : 1), y1 + 1); }
    });
    orcHead(c, b);
    c.at(0, b, () => {   // máscara de hueso (frente y ojos) con cuernitos
      c.poly('bone', [[10.5, 6.5], [20.5, 6.5], [20.5, 11], [18, 12], [13, 12], [10.5, 11]]);
      c.rect('ol', 12, 9, 14, 10); c.rect('ol', 17, 9, 19, 10); c.px('glowC', 13, 10); c.px('glowC', 18, 10);
      c.px('ol', 15, 11); c.px('ol', 16, 11); c.rect('red', 15, 7, 16, 8);
      c.rect('bone.0', 11, 6, 20, 6); c.px('bone.0', 13, 11); c.px('bone.0', 18, 11);
    });
    // bastón con calavera y relámpagos
    const T = [[25.5, 20.5 - P.s, -90], [25.5, 17.5, -90], [25.5, 17.5, -76], [25.5, 19.5, -85]][a];
    c.at(0, b, () => {
      orcArm(c, 23, 16.5, T[0], T[1], 'fur');
      const f = fr(T[0], T[1], T[2]), [sx, sy] = f(13, 0);
      c.rim(t => { bar(t, 'x', f, -8, 11, 2); t.ell('x', sx, sy, 2.5, 2.3); }, 'darkwood');
      c.ell('bone', sx, sy, 2.5, 2.3); c.px('ol', sx - 1, sy); c.px('ol', sx + 1, sy); c.px('bone.0', sx, sy + 1.5);
      c.px('glowC', sx - 1, sy); c.px('glowC', sx + 1, sy);
      const [fx, fy] = f(9, 1.5); c.line('feather', fx, fy, fx + 1, fy + 3); c.px('team', fx + 1, fy + 3);
      halo(c, sx, sy, 2.7, a ? g + 1 : g * 0.6, '#9ff8f2');
      if (a === 1) { bolt(c, sx - 3, sy, sx - 1, sy - 3, 1); bolt(c, sx + 3, sy - 1, sx + 2, sy + 3, 2); }
      if (a === 2) { bolt(c, sx + 2, sy - 1, sx + 2, sy - 3, 3); bolt(c, sx - 2, sy - 2, sx - 6, sy - 4, 4); bolt(c, sx + 1, sy + 2, sx + 2, sy + 7, 5); }
      if (a === 3) { c.px('ub_bolt', sx - 3, sy - 2); c.px('ub_bolt', sx + 3, sy - 3); }
      fist(c, OSK, T[0], T[1]);
    });
  },
};

U.orc_siege = {
  w: 40, h: 32, ax: 20, ay: 29, render: { shadow: { cx: 20, cy: 30, rx: 16 } },
  draw(c, P) {
    const a = P.atk, walk = P.anim === 'walk', b = walk ? P.body : 0;
    const lx = [0, -2, 2, 1][a] + (walk ? P.sw : 0);
    c.at(0, b, () => {
      // armazón: dos caballetes en A y bancada
      for (const x of [8.5, 30.5]) { limb(c, 'darkwood', x - 3.5, 21, x, 8, 2); limb(c, 'darkwood', x + 3.5, 21, x, 8, 2); c.rect('darkwood', x - 2, 15, x + 2, 15); }
      c.rect('darkwood', 3, 20, 36, 21); c.rect('darkwood.0', 3, 21, 36, 21); c.px('iron', 8, 20); c.px('iron', 31, 20);
      // cuerdas y tronco colgante con cabeza de hierro
      c.at(lx, 0, () => {
        c.line('ub_rope', 14 - lx, 10, 14, 13); c.line('ub_rope', 25 - lx, 10, 25, 13);
        const hd = [[31, 12], [34.5, 13], [36.6, 15.5], [34.5, 18], [31, 19]];
        c.rim(t => { t.rect('x', 3, 13, 31, 17); t.poly('x', hd); }, 'wood');
        c.line('darkwood', 5, 14, 29, 14); c.px('darkwood', 9, 16); c.px('darkwood', 20, 16); c.rect('wood.3', 3, 13, 3, 17); c.px('wood.2', 4, 15);
        c.poly('iron', hd); c.px('iron.3', 32, 13); c.px('glowR', 35, 15); c.rect('iron.0', 31, 18, 34, 18);
        c.poly('bone', [[32, 12.5], [31, 9.5], [33.5, 11.5]]); c.poly('bone', [[32, 18.5], [31, 21.5], [33.5, 19.5]]);
        c.rect('iron', 13, 12.5, 14, 17.5); c.rect('iron', 24, 12.5, 25, 17.5);
      });
      // techo de pieles del equipo
      c.poly('team', [[7, 5], [32, 5], [35.5, 10], [3.5, 10]]);
      c.rect('ub_hide', 11, 6, 16, 9); c.rect('fur', 24, 6, 28, 9); c.line('ub_hide.0', 11, 7, 16, 7); c.px('fur.0', 26, 8);
      c.line('team.0', 4, 10, 35, 10); for (let x = 6; x <= 34; x += 4) c.px('team.0', x, 9);
      c.rect('darkwood', 6, 4, 33, 4);
      c.poly('bone', [[33, 4], [36.5, 2.5], [35, 5.5]]); c.ell('bone', 35, 6.5, 1.6, 1.4); c.px('ol', 35, 6);
      for (const x of [10, 19, 28]) c.rect('iron.2', x, 2, x, 3);
    });
    // ruedas con radios que giran
    for (const wx of [10.5, 29.5]) c.at(0, b, () => {
      c.ell('darkwood', wx, 25.5, 3.7, 3.7); c.ell('wood', wx, 25.5, 2.5, 2.5);
      const cx = Math.floor(wx), cy = 25;
      if (walk && (P.t & 1)) { c.line('darkwood', cx - 1, cy - 1, cx + 1, cy + 1); c.line('darkwood', cx - 1, cy + 1, cx + 1, cy - 1); }
      else { c.line('darkwood', cx, cy - 2, cx, cy + 2); c.line('darkwood', cx - 2, cy, cx + 2, cy); }
      c.px('iron', cx, cy);
    });
  },
};

U.orc_general = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw, g = P.glow;
    // estandarte del equipo a la espalda
    c.at(0, b, () => {
      c.rect('darkwood', 8, 2, 8, 16); c.rect('darkwood', 2, 2, 8, 2); c.px('gold', 8, 1);
      c.at(sw === 0 ? 0 : -Math.sign(sw), 0, () => {
        c.poly('team', [[2, 3], [8, 3], [8, 12], [5, 10], [2, 12]]); c.rect('team.0', 2, 3, 8, 3);
        c.ell('bone', 5, 6.5, 1.6, 1.4); c.px('ol', 4, 6); c.px('ol', 6, 6); c.px('bone', 5, 8);
      });
    });
    // capa larga del equipo
    c.poly('team', [[8, 14 + b], [23, 14 + b], [25 + sw, 28], [6 + sw, 28]]); c.rect('team.0', 6 + sw, 28, 25 + sw, 28);
    orcLegs(c, P, 'iron', 'fur');
    c.at(0, b, () => { c.rect('leather', 10, 21, 21, 22); c.rect('gold', 14, 21, 17, 22); c.px('ol', 15, 21); c.px('ol', 16, 21); });
    c.at(sw, b, () => { c.rect('team', 11, 23, 20, 26); c.rect('gold', 11, 26, 20, 26); });
    orcTorso(c, b);
    c.at(0, b, () => {   // coraza de hierro con ribete dorado
      c.poly('iron', [[9.5, 15], [21.5, 15], [20.5, 21], [10.5, 21]]); c.rect('gold', 10, 15, 21, 15);
      c.line('gold', 15, 16, 15, 20); c.line('gold', 16, 16, 16, 20); c.px('iron.3', 11, 16);
    });
    c.at(0, b + P.s, () => { orcArm(c, 7.5, 16.5, 5.5, 23, 'iron'); c.rect('gold', 4, 20, 7, 20); fist(c, OSK, 5.5, 23.5); });
    c.at(0, b, () => {   // pieles y hombreras
      c.ell('fur', 15.5, 14, 8, 2.4);
      c.ell('iron', 7, 15, 3.8, 3.2); c.ell('iron', 24, 15, 3.8, 3.2); c.rect('gold', 4, 17, 9, 17); c.rect('gold', 22, 17, 27, 17);
      for (const [x, y] of [[4, 11], [6, 10], [25, 10], [27, 11]]) { c.px('bone', x, y); c.px('bone', x, y + 1); }
    });
    orcHead(c, b, { eye: 'glowR' });
    c.at(0, b, () => {   // yelmo con grandes cuernos
      c.ring('iron', 15.5, 9.2, 5.4, 4.8, -1, (x, y) => y <= 8); c.rect('iron', 10, 8, 21, 8); c.rect('gold', 11, 8, 20, 8);
      c.rect('iron', 15, 9, 16, 10); c.px('gold', 15, 5); c.px('gold', 16, 5);
      c.poly('bone', [[11, 6], [11.5, 8.5], [8, 8], [6, 6.5], [5, 2], [7, 4.5], [9, 6]]);
      c.poly('bone', [[21, 6], [20.5, 8.5], [24, 8], [26, 6.5], [27, 2], [25, 4.5], [23, 6]]);
      c.px('bone.0', 8, 7); c.px('bone.0', 23, 7); c.px('bone.3', 5, 2); c.px('bone.3', 26, 2);
    });
    halo(c, 13.5, 10.5 + b, 0.4, g * 0.5, '#ff6a4a'); halo(c, 18.5, 10.5 + b, 0.4, g * 0.5, '#ff6a4a');
    // hacha doble con brillo
    const T = [[25.5, 21.5 - P.s, -90], [21.5, 11.5, -150], [16.5, 17.5, 20], [19.5, 14.5, 78]][a];
    c.at(0, b, () => {
      orcArm(c, 24, 16.5, T[0], T[1], 'iron');
      if (a === 2) smear(c, T[0], T[1], 12, -140, 15, 3);
      const f = fr(T[0], T[1], T[2]), B1 = [[9.5, 1], [13.5, 1], [14.5, 3.5], [13.8, 5.2], [11.5, 4], [9.2, 5.2], [8.5, 3.5]], B2 = B1.map(([u, v]) => [u, -v]);
      c.rim(t => { bar(t, 'x', f, -4, 14, 2); pw(t, 'x', f, B1); pw(t, 'x', f, B2); }, 'darkwood');
      pw(c, 'iron', f, B1); pw(c, 'iron', f, B2);
      pw(c, 'blade', f, [[9.2, 4.4], [11.5, 3.4], [13.8, 4.4], [13.8, 5.2], [11.5, 4], [9.2, 5.2]]); pw(c, 'blade', f, [[9.2, -4.4], [11.5, -3.4], [13.8, -4.4], [13.8, -5.2], [11.5, -4], [9.2, -5.2]]);
      bar(c, 'gold', f, 10.5, 12.5, 2.2); const [gx, gy] = f(14.5, 0); c.px('gold', gx, gy);
      const [cx, cy] = f(11.5, 0); halo(c, cx, cy, 5.6, a ? g + 0.5 : g * 0.5, '#ff8a4a');
      fist(c, OSK, T[0], T[1]);
    });
  },
};

// ------------------------------------------------------------- gigantes (40×40, ancla 20,37): pesados y lentos
const GSK = 'giantskin';
// hombros (10,19.5) y (29,19.5); brazos gruesos colgando por fuera
function giantLegs(c, P, pm = GSK, bm = 'fur') {
  c.at(0, P.ll, () => { c.rect(pm, 13, 30, 18, 34); c.rect(bm, 12, 34, 18, 37); c.px(null, 12, 34); c.rect(bm + '.0', 13, 35, 18, 35); });
  c.at(0, P.lr, () => { c.rect(pm, 21, 30, 26, 34); c.rect(bm, 21, 34, 27, 37); c.px(null, 27, 34); c.rect(bm + '.0', 21, 35, 26, 35); });
}
function giantTorso(c, b, s = GSK) {
  c.at(0, b, () => {
    c.ell(s, 19.5, 19, 10, 4.8);
    c.poly(s, [[10, 18], [29, 18], [28, 23], [26.5, 30], [12.5, 30], [11, 23]]);
    c.rect(s + '.0', 13, 22, 18, 22); c.rect(s + '.0', 21, 22, 26, 22); c.px(s + '.0', 19, 26); c.px(s + '.0', 20, 26);
  });
}
function giantHead(c, b, o = {}) {
  const s = o.skin || GSK, eye = o.eye || 'eye';
  c.at(0, b + (o.dy || 0), () => {
    c.rim(t => { t.ell('x', 19.5, 11, 4.8, 4.6); t.rect('x', 15, 11, 24, 14); t.rect('x', 16, 15, 23, 15); t.rect('x', 14, 11, 14, 12); t.rect('x', 25, 11, 25, 12); }, s);
    c.rect(s + '.0', 16, 10, 18, 10); c.rect(s + '.0', 21, 10, 23, 10);
    c.px(eye, 17, 11); c.px(eye, 22, 11);
    c.rect(s + '.2', 19, 11, 19, 13); c.rect(s + '.0', 20, 12, 20, 13);
    if (o.beard) { c.poly(o.beard, [[15, 12.5], [24, 12.5], [24.5, 16], [22, 19.5], [19.5, 21], [17, 19.5], [14.5, 16]]); c.rect(s, 18, 13, 21, 13); c.rect(s + '.0', 20, 13, 20, 13); }
    c.rect('ol', 18, 14, 21, 14);
    if (o.tusk) { c.px('bone', 18, 13); c.px('bone', 21, 13); }
    if (o.hair) { c.ring(o.hair, 19.5, 10.4, 5.2, 4.6, -1, (x, y) => y <= 8); c.rect(o.hair, 14, 8, 14, 10); c.rect(o.hair, 25, 8, 25, 10); }
  });
}
const gfist = (c, s, x, y) => c.ell(s, x, y, 2.2, 2.2);
const gArm = (c, s, x0, y0, x1, y1, br) => { limb(c, s, x0, y0, x1, y1, 4.4); if (br) limb(c, br, lerp(x0, x1, .55), lerp(y0, y1, .55), lerp(x0, x1, .9), lerp(y0, y1, .9), 4.8); };
const furMantle = (c, b, m = 'fur') => c.at(0, b, () => {
  c.ell(m, 19.5, 17.5, 10.5, 3.6);
  for (let x = 10; x <= 29; x += 3) c.px(m, x, 21);
  c.ell(m, 10, 18.5, 3.6, 3); c.ell(m, 29, 18.5, 3.6, 3);
});
// carga de la cesta (vista por encima del borde)
function basketLoad(c, kind) {
  if (kind === 'wood') {
    c.rim(t => t.rect('x', 5, 3, 33, 5), 'wood'); c.rim(t => t.rect('x', 7, 0, 31, 2), 'wood');   // troncos atravesados
    c.line('darkwood', 7, 4, 32, 4); c.line('darkwood', 9, 1, 30, 1);
    for (const [x, y] of [[5, 3], [7, 0]]) { c.rect('cloth', x, y, x, y + 2); c.px('wood.0', x, y + 1); }
    c.rect('ub_rope', 12, 0, 12, 5); c.rect('ub_rope', 27, 0, 27, 5);
  } else if (kind === 'food') {
    c.ell('leaf', 11.5, 4, 3, 2.6); c.ell('leaf', 27.5, 4, 3, 2.6); c.ell('leaf', 19.5, 3, 3.4, 2.6);
    c.px('leaf.3', 10, 3); c.px('leaf.3', 18, 2); c.px('leaf.3', 26, 3); c.line('leaf.0', 19, 2, 20, 4);
    c.ell('red', 15, 4.5, 2, 1.6); c.ell('red', 24, 4.5, 2, 1.6); c.px('bone', 14, 3); c.px('bone', 25, 3);
  } else if (kind === 'gold') {
    c.ell('gold', 19.5, 5, 10, 3); for (const [x, y] of [[12, 3], [16, 2], [20, 1], [24, 2], [27, 3]]) { c.px('gold', x, y); c.px('gold.3', x, y); }
    c.px('gold.0', 15, 5); c.px('gold.0', 23, 4); c.px('gold.0', 19, 6);
  } else if (kind === 'stone') {
    for (const [x, y, r] of [[11, 4, 2.6], [16.5, 3, 2.6], [22.5, 3.2, 2.8], [28, 4, 2.6]]) c.rim(t => t.ell('x', x, y, r, r * 0.85), 'stone');
    c.px('stone.3', 10, 3); c.px('stone.3', 16, 2); c.px('stone.3', 22, 2); c.px('stone.3', 27, 3);
  } else if (kind === 'iron') {
    for (const [x, y] of [[11, 4], [17, 3], [23, 3], [28, 4]]) c.rim(t => t.poly('x', [[x - 2.5, y + 1.5], [x - 1, y - 2], [x + 2, y - 1.5], [x + 2.5, y + 1.5]]), 'iron');
    c.px('copper', 11, 4); c.px('copper', 23, 3); c.px('iron.3', 17, 2); c.px('iron.3', 28, 3); c.px('copper.0', 18, 4);
  }
}

U.giant_worker = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P, o) {
    const b = P.body, a = P.atk, cr = o.carry;
    // cesta enorme a la espalda (asoma por encima y a los lados)
    c.at(0, b, () => {
      c.poly('thatch', [[7, 5.5], [32, 5.5], [31, 14], [28.5, 19], [10.5, 19], [8, 14]]);
      for (let y = 8; y <= 18; y += 3) for (let x = 7 + (y % 2); x <= 32; x += 4) { c.px('thatch.0', x, y); c.px('thatch.0', x + 1, y); c.px('thatch.2', x + 2, y + 1); }
      c.rect('team', 8, 11, 31, 12); c.rect('team.0', 8, 12, 31, 12);
      c.ell('wood', 19.5, 5.5, 12.4, 2.4); c.ell('darkwood.0', 19.5, 5.2, 10.8, 1.3);
      if (cr) c.at(0, 1, () => basketLoad(c, cr));
    });
    giantLegs(c, P, GSK, 'leather');
    c.at(0, b, () => { c.rect('ub_rope', 12, 29, 27, 29); });
    c.at(P.sw, b, () => { c.poly('team', [[15, 30], [24, 30], [23.5, 34], [15.5, 34]]); c.rect('team.0', 19, 31, 19, 33); });
    giantTorso(c, b);
    c.at(0, b, () => { c.line('ub_rope', 14, 16, 14, 26); c.line('ub_rope', 25, 16, 25, 26); c.line('ub_rope', 14, 26, 25, 26); });
    c.at(0, b + P.s, () => { gArm(c, GSK, 10, 19.5, 7.5, 29.5, 'leather'); gfist(c, GSK, 7.5, 30); });
    giantHead(c, b, { hair: 'hair' });
    // garrote pequeño
    const T = [[31.5, 29.5 - P.s, -80], [27.5, 14.5, -150], [24.5, 22.5, -12], [25.5, 26.5, 30]][a];
    c.at(0, b, () => {
      gArm(c, GSK, 29, 19.5, T[0], T[1], 'leather');
      if (a === 2) smear(c, T[0], T[1], 11, -130, -20, 3);
      const f = fr(T[0], T[1], T[2]);
      c.rim(t => pw(t, 'x', f, [[-1.5, -1.2], [4, -1.4], [10, -2.6], [11, 0], [10, 2.6], [4, 1.4], [-1.5, 1.2]]), 'wood');
      const [kx, ky] = f(8, -1); c.px('darkwood', kx, ky); const [lx, ly] = f(6, 1); c.px('darkwood', lx, ly);
      gfist(c, GSK, T[0], T[1]);
    });
  },
};

U.giant_inf = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P) {
    const b = P.body, a = P.atk;
    giantLegs(c, P, GSK, 'fur');
    c.at(0, b, () => { c.rect('leather', 12, 28, 27, 29); c.rect('team', 18, 28, 21, 29); });
    c.at(P.sw, b, () => { c.poly('fur', [[13, 30], [26, 30], [26.5, 34], [12.5, 34]]); for (let x = 14; x <= 25; x += 3) c.px(null, x, 34); c.rect('team', 13, 30, 26, 31); c.rect('team.0', 13, 31, 26, 31); });
    giantTorso(c, b);
    c.at(0, b, () => { c.poly('team', [[11, 17], [15, 17], [27, 27], [23, 27]]); c.px('team.0', 19, 22); });
    c.at(0, b + P.s, () => { gArm(c, GSK, 10, 19.5, 7.5, 29.5, 'leather'); gfist(c, GSK, 7.5, 30); });
    furMantle(c, b);
    giantHead(c, b, { hair: 'copper', beard: 'copper' });
    c.at(0, b, () => { c.rect('bone', 15, 7, 15, 8); c.rect('bone', 24, 7, 24, 8); });
    // garrote de tronco con clavos
    const T = [[31.5, 28.5 - P.s, -100], [27.5, 13.5, -160], [21.5, 22.5, 16], [22.5, 24.5, 35]][a];
    c.at(0, b, () => {
      gArm(c, GSK, 29, 19.5, T[0], T[1], 'leather');
      if (a === 2) smear(c, T[0], T[1], 16, -150, 5, 3);
      const f = fr(T[0], T[1], T[2]), club = [[-2, -1.3], [5, -1.5], [16, -3], [16.8, 0], [16, 3], [5, 1.5], [-2, 1.3]];
      c.rim(t => { pw(t, 'x', f, club); for (const [u, v] of [[10, -3], [12.5, 3.2], [14.5, -3.6], [15.5, 3.6]]) { const [x, y] = f(u, v); t.px('x', x, y); } }, 'wood');
      for (const [u, v] of [[10, -3], [12.5, 3.2], [14.5, -3.6], [15.5, 3.6]]) { const [x, y] = f(u, v); c.px('iron', x, y); }
      for (const [u, v] of [[8, 0], [12, -1], [14, 1]]) { const [x, y] = f(u, v); c.px('darkwood', x, y); }
      const [ex, ey] = f(16.3, 0); c.px('wood.3', ex, ey);
      gfist(c, GSK, T[0], T[1]);
    });
  },
};

U.giant_pike = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P) {
    const b = P.body, a = P.atk;
    giantLegs(c, P, 'leather', 'rock');
    c.at(0, b, () => c.rect('leather', 12, 28, 27, 29));
    c.at(P.sw, b, () => { c.poly('team', [[15, 30], [24, 30], [23.5, 34], [15.5, 34]]); });
    giantTorso(c, b);
    c.at(0, b, () => {   // armadura de rocas
      c.poly('rock', [[13, 18], [26, 18], [25, 26], [14, 26]]); c.line('rock.0', 19, 19, 20, 25); c.line('rock.0', 14, 22, 18, 22); c.px('rock.3', 14, 19); c.px('moss', 24, 25); c.px('moss', 25, 24);
      c.ell('rock', 29, 18, 4.6, 3.6); c.line('rock.0', 27, 17, 30, 19); c.px('rock.3', 26, 16); c.px('moss', 31, 16);
    });
    giantHead(c, b, { hair: 'hair' });
    c.at(0, b, () => { c.ring('rock', 19.5, 10.4, 5.3, 4.6, -1, (x, y) => y <= 8); c.rect('rock', 14, 8, 25, 8); c.rect('rock.0', 15, 8, 24, 8); c.px('rock.3', 17, 6); });
    // escudo: losa de piedra con franja del equipo (contrafase)
    c.at(a === 2 ? 2 : a === 3 ? 1 : 0, b + P.s, () => {
      gArm(c, GSK, 10, 19.5, 9.5, 27, 'leather');
      c.rim(t => t.poly('x', [[2, 15.5], [14.5, 14.5], [15.5, 34], [3, 35]]), 'stone');
      c.poly('team', [[2.4, 22], [14.9, 21], [15.1, 25], [2.6, 26]]);
      c.line('stone.0', 6, 16, 8, 20); c.line('stone.0', 11, 28, 9, 32); c.px('stone.3', 3, 16); c.px('stone.3', 4, 16); c.px('moss', 13, 33); c.px('moss', 14, 32); c.px('moss', 3, 34);
      c.rect('rune', 8, 23, 9, 23);
    });
    // pica con punta de piedra: vertical en reposo, embestida en el ataque
    const T = [[32.5, 27.5 - P.s, -90, 0], [27.5, 20.5, -30, -13], [29.5, 22.5, -4, -14], [28.5, 23.5, 6, -14]][a];
    c.at(0, b, () => {
      gArm(c, GSK, 29, 19.5, T[0], T[1], 'leather');
      const f = fr(T[0], T[1], T[2]), k = T[3], tip = [[18 + k, -2], [20.5 + k, -2.4], [24.5 + k, 0], [20.5 + k, 2.4], [18 + k, 2]];
      if (a === 2) for (const [v, u0, u1] of [[-3.5, -6, -16], [3.5, -4, -14]]) { const [x0, y0] = f(u0 + k, v), [x1, y1] = f(u1 + k, v); c.line('ub_sm', x0, y0, x1, y1); }
      c.rim(t => { bar(t, 'x', f, -8 + k, 19 + k, 2); pw(t, 'x', f, tip); }, 'darkwood');
      pw(c, 'stone', f, tip); bar(c, 'ub_rope', f, 17 + k, 18.5 + k, 3);
      gfist(c, GSK, T[0], T[1]);
    });
  },
};

U.giant_ranged = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P) {
    const b = P.body, a = P.atk;
    const rockAt = (x, y, r) => {
      c.rim(t => t.ell('x', x, y, r, r * 0.86), 'ub_boulder');
      c.line('ub_boulder.0', x - 1, y - 1, x + 1, y + 2); c.px('ub_boulder.3', x - 2, y - 2); c.px('ub_boulder.3', x - 3, y - 1); c.px('moss', x + 2, y - 2); c.px('moss', x + 1, y - 2);
    };
    giantLegs(c, P, GSK, 'leather');
    c.at(0, b, () => c.rect('leather', 12, 28, 27, 29));
    c.at(P.sw, b, () => { c.poly('team', [[15, 30], [24, 30], [23.5, 34.5], [15.5, 34.5]]); c.rect('team.0', 19, 31, 19, 34); });
    giantTorso(c, b);
    c.at(0, b, () => { c.line('leather', 11, 18, 27, 27); c.line('leather', 12, 18, 28, 27); c.ell('sack', 11.5, 29.5, 2.6, 2.4); c.px('ub_boulder', 11, 27); c.px('ub_boulder', 12, 27); });
    // brazos: roca al hombro (0), sobre la cabeza (1), lanzada (2: sin roca), bajando (3)
    const L = [[7.5, 29.5 + P.s], [13.5, 5.5], [8.5, 27.5], [9.5, 29.5]][a], R = [[31.5, 14.5], [25.5, 5.5], [35.5, 15.5], [31.5, 25.5]][a];
    if (a === 1) {
      giantHead(c, b, { hair: 'hair' });
      c.at(0, b, () => { c.rect('team', 14, 7, 25, 8); c.rect('team.0', 14, 8, 25, 8); });
      c.rim(t => { limb(t, 'x', 10, 19.5, L[0], L[1], 4.4); limb(t, 'x', 29, 19.5, R[0], R[1], 4.4); }, GSK);
      limb(c, 'leather', 12.6, 10, 13.2, 8, 4.6); limb(c, 'leather', 26.4, 10, 25.8, 8, 4.6);
      rockAt(19.5, 5.4, 5);
    } else {
      if (a === 2) smear(c, 29, 19.5, 13, -120, -10, 3);
      c.at(0, b, () => { gArm(c, GSK, 10, 19.5, L[0], L[1], 'leather'); gArm(c, GSK, 29, 19.5, R[0], R[1]); });
      giantHead(c, b, { hair: 'hair' });
      c.at(0, b, () => { c.rect('team', 14, 7, 25, 8); c.rect('team.0', 14, 8, 25, 8); });
      if (a === 0) c.at(0, b, () => rockAt(30.5, 10.5, 4.4));
    }
    c.at(0, a === 1 ? 0 : b, () => { gfist(c, GSK, L[0], L[1]); gfist(c, GSK, R[0], R[1]); });
  },
};

// mamut de perfil (mirando a la derecha) para 48×40
function mammoth(c, P, a) {
  const b = P.body, walk = P.anim === 'walk', M = 'ub_mamm';
  const hd = a === 1 ? [0, -2] : a === 2 ? [1, 2] : a === 3 ? [1, 1] : [0, 0];
  // patas: [x, fase, lejana]
  for (const [hx, ph, far] of [[12, 0, 1], [29, .5, 1], [16, .25, 0], [33, .75, 0]]) {
    let dx = 0, lift = 0;
    if (walk) { const th = 2 * Math.PI * (P.t / 8 + ph); dx = 1.8 * Math.cos(th); lift = Math.max(0, 1.6 * Math.sin(th)); }
    const m = far ? M + '.0' : M, x = hx + dx, y = 37 - lift;
    c.poly(m, [[hx - 2.5, 26 + b], [hx + 2.5, 26 + b], [x + 2.5, y - 1], [x - 2.5, y - 1]]);
    c.rect(far ? 'bone.0' : 'bone', Math.round(x) - 2, Math.round(y), Math.round(x) + 2, Math.round(y)); c.px(m, Math.round(x), Math.round(y));
  }
  c.at(0, b, () => {
    c.line(M, 7, 22, 4, 27); c.px(M + '.0', 4, 28);                       // cola
    c.ell(M, 21, 25, 14, 8.5);                                             // cuerpo
    c.ell(M, 29, 21, 7, 7);                                                // joroba de los hombros
    for (let x = 9; x <= 33; x += 2) c.line(M + '.0', x, 31, x - (x & 2 ? 1 : 0), 33 + (x % 3 ? 0 : 1));  // flecos de pelo
    c.line(M + '.0', 12, 27, 18, 29); c.line(M + '.0', 22, 29, 27, 28);
  });
  c.at(hd[0], b + hd[1], () => {
    c.ell(M, 36.5, 20, 6, 7);                                              // cabeza abovedada
    c.ell(M, 34, 21, 2.4, 3.4); c.ell(M + '.0', 34, 21.5, 1.6, 2.6);       // oreja
    c.px('eye', 38, 19); c.px(M + '.3', 36, 15);
    // trompa
    const tr = a === 1 ? [[40, 20], [43.5, 15], [45.5, 11], [46, 13], [44, 17], [41.5, 23]] : [[39, 22], [42.5, 22], [43, 30], [44.5, 33], [43, 35], [41, 32], [39.5, 27]];
    c.poly(M, tr);
    if (a !== 1) { c.px(M + '.0', 41, 25); c.px(M + '.0', 41, 28); c.px(M + '.0', 42, 31); }
    // colmillos curvos
    c.rim(t => { t.poly('x', [[38, 25], [41, 27.5], [44, 27.5], [45.6, 25], [46, 22], [44.6, 24.5], [42, 25.5], [39.5, 23.5]]); }, 'bone');
    c.px('bone.3', 45, 23);
  });
}

U.giant_cav = {
  w: 48, h: 40, ax: 24, ay: 37, render: { shadow: { cx: 23, cy: 38, rx: 16, ry: 1.8 } },
  draw(c, P) {
    const b = P.body, a = P.atk;
    mammoth(c, P, a);
    // howdah con gualdrapa del equipo
    c.at(0, b, () => {
      c.poly('team', [[12, 15], [31, 15], [32, 27], [11, 27]]); c.rect('gold', 11, 26, 32, 27); c.rect('team.0', 11, 25, 32, 25);
      for (let x = 13; x <= 30; x += 4) c.px('gold', x, 28);
      c.ell('gold', 21.5, 20.5, 2.2, 2.2); c.ell('team', 21.5, 20.5, 1, 1);
      c.rect('darkwood', 11, 13, 32, 15); c.rect('darkwood.0', 11, 15, 32, 15);
      for (const x of [12, 31]) c.rect('darkwood', x, 9, x, 13);
    });
    // jinete gigante con lanza
    c.at(0, b, () => {
      c.poly(GSK, [[17, 7], [26, 7], [27, 13], [16, 13]]); c.ell('fur', 21.5, 8, 5.6, 2.2); c.rect('team', 17, 11, 26, 12);
      c.rim(t => { t.ell('x', 22, 4.2, 3.4, 3.2); t.rect('x', 22, 4, 25.5, 7); }, GSK);
      c.rect('copper', 22, 6, 25, 8); c.px(GSK, 24, 6); c.rect('ol', 24, 6, 25, 6);
      c.px('eye', 24, 4); c.rect(GSK + '.0', 23, 3, 25, 3); c.px(GSK + '.2', 25, 4); c.px(GSK + '.2', 26, 5);
      c.ring('copper', 22, 3.8, 3.6, 3.2, -1, (x, y) => y <= 2 || x <= 20); c.rect('team', 19, 2, 24, 2);
      c.rect('darkwood', 11, 9, 32, 9);
    });
    const T = [[28.5, 11.5, -88], [26.5, 7.5, -35], [30.5, 12.5, 15], [29.5, 12.5, 30]][a];
    c.at(0, b, () => {
      limb(c, GSK, 24, 9, T[0], T[1], 3.2);
      const f = fr(T[0], T[1], T[2]), k = a ? -5 : -3, tip = [[8 + k, -1.6], [10 + k, -1.8], [13 + k, 0], [10 + k, 1.8], [8 + k, 1.6]];
      c.rim(t => { bar(t, 'x', f, -10 + k, 9 + k, 2); pw(t, 'x', f, tip); }, 'darkwood');
      pw(c, 'steel', f, tip); bar(c, 'team', f, 6.5 + k, 7.6 + k, 3);
      c.ell(GSK, T[0], T[1], 1.8, 1.8);
    });
  },
};

U.giant_special = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P) {
    const b = P.body, a = P.atk, g = P.glow, F = 'frostskin';
    // carámbanos y cristales a la espalda
    c.at(0, b, () => {
      for (const [x0, y0, x1, y1] of [[9, 17, 5, 9], [12, 16, 11, 9], [28, 16, 29, 9], [31, 17, 34, 10]]) { limb(c, 'ice', x0, y0, x1, y1, 2.4); c.px('ice.3', x1, y1); }
    });
    giantLegs(c, P, F, 'fur');
    c.at(0, b, () => { c.rect('leather', 12, 28, 27, 29); c.rect('silver', 18, 28, 21, 29); });
    c.at(P.sw, b, () => { c.poly('team', [[13, 30], [26, 30], [26, 34], [13, 34]]); for (let x = 14; x <= 25; x += 3) c.px(null, x, 34); c.rect('team.0', 19, 31, 19, 33); });
    giantTorso(c, b, F);
    c.at(0, b, () => { c.poly('team', [[11, 17], [15, 17], [27, 27], [23, 27]]); c.px('ice', 13, 19); c.px('ice', 24, 26); });
    // brazos: abiertos al soplar
    const L = a === 1 ? [6.5, 24.5] : a === 2 ? [5.5, 21.5] : [7.5, 29.5 + P.s], R = a === 1 ? [32.5, 24.5] : a === 2 ? [34.5, 22.5] : [31.5, 29.5 - P.s];
    c.at(0, b, () => {
      gArm(c, F, 10, 19.5, L[0], L[1], 'fur'); gArm(c, F, 29, 19.5, R[0], R[1], 'fur'); gfist(c, F, L[0], L[1]); gfist(c, F, R[0], R[1]);
      c.ell('fur', 19.5, 17.4, 10.5, 3.2); c.ell('fur', 10, 18.2, 3.8, 3); c.ell('fur', 29, 18.2, 3.8, 3);
      for (let x = 10; x <= 29; x += 3) c.px('fur', x, 21);
      c.px('ice', 8, 16); c.px('ice', 7, 15); c.px('ice', 31, 16); c.px('ice', 32, 15);
    });
    const hdy = a === 1 ? -1 : 0;
    giantHead(c, b, { skin: F, beard: 'snow', hair: 'snow', eye: 'glowC', dy: hdy });
    c.at(0, b + hdy, () => {   // barba de carámbanos y corona de hielo
      for (const [x, y, l] of [[16, 18, 2], [18, 20, 3], [21, 20, 3], [23, 18, 2]]) c.rect('ice', x, y, x, y + l);
      c.px('ice', 15, 5); c.px('ice', 15, 4); c.px('ice', 19, 4); c.rect('ice', 19, 2, 19, 5); c.px('ice', 24, 5); c.px('ice', 24, 4); c.px('ice.3', 19, 2);
      if (a === 2) { c.rect('ol', 18, 14, 21, 15); c.rect('glowC', 19, 14, 20, 15); }
    });
    halo(c, 17.5, 11.5 + b + hdy, 0.3, g * 0.4, '#9ff8f2'); halo(c, 22.5, 11.5 + b + hdy, 0.3, g * 0.4, '#9ff8f2');
    // aliento helado
    if (a === 1) c.at(0, b + hdy, () => { halo(c, 20, 14.5, 1.5, g, '#bff6ff'); });
    if (a === 2) c.at(0, b, () => {
      c.poly('ub_frost', [[21.5, 13.5], [39, 8], [39.5, 21], [21.5, 16]]);
      for (const [x, y] of [[25, 14], [28, 12], [30, 16], [33, 11], [34, 18], [37, 14], [36, 9], [38, 19]]) { c.px('white', x, y); c.glow(x, y - 1, 120, '#9ff8f2'); }
      for (const [x, y] of [[27, 15], [31, 13], [35, 15]]) c.px('glowC', x, y);
    });
    if (a === 3) c.at(0, b, () => { for (const [x, y] of [[26, 13], [30, 11], [32, 17], [35, 13], [37, 18]]) { c.px('ub_frost', x, y); c.px('ub_frost', x + 1, y); c.glow(x, y - 1, 90, '#9ff8f2'); } });
  },
};

U.giant_siege = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P) {
    const b = P.body, a = P.atk, lx = [0, -3, 2, 1][a], lean = a === 1 ? -1 : a === 2 ? 1 : 0;
    giantLegs(c, P, GSK, 'fur');
    c.at(P.sw, b, () => { c.poly('team', [[15, 30], [24, 30], [23.5, 34], [15.5, 34]]); });
    c.at(lean, 0, () => {
      giantTorso(c, b);
      c.at(0, b, () => { c.poly('leather', [[10, 17], [13, 17], [27, 28], [24, 28]]); c.poly('leather', [[26, 17], [29, 17], [15, 28], [12, 28]]); c.ell('iron', 19.5, 22.5, 1.6, 1.6); c.rect('leather', 12, 28, 27, 29); });
      giantHead(c, b, { hair: 'hair', tusk: 1 });
      c.at(0, b, () => { c.rect('team', 14, 7, 25, 8); c.rect('team.0', 14, 8, 25, 8); c.px('team', 26, 9); c.px('team', 26, 10); });
    });
    // tronco-ariete bajo los brazos
    c.at(lx, b, () => {
      if (a === 2) for (const y of [24, 29]) c.line('ub_sm', 1, y, -6, y);
      const hd = [[32, 23.5], [35.5, 24], [37.5, 26.5], [35.5, 29], [32, 29.5]];
      c.rim(t => { t.rect('x', 4, 24, 32, 29); t.poly('x', hd); }, 'wood');
      c.line('darkwood', 6, 25, 30, 25); c.line('darkwood', 8, 27, 18, 27); c.line('darkwood', 22, 28, 29, 28);
      c.rect('cloth', 4, 24, 4, 29); c.rect('wood.0', 4, 26, 4, 27);
      c.poly('iron', hd); c.px('iron.3', 33, 24); c.rect('iron.0', 32, 28, 35, 28); c.rect('iron', 31, 24, 31, 29);
      c.rect('team', 7, 24, 8, 29); c.rect('team.0', 8, 24, 8, 29);
    });
    c.at(lean, b, () => {   // brazos que abrazan el tronco
      gArm(c, GSK, 10, 19.5, 10 + lx, 27.5, 'leather'); gArm(c, GSK, 29, 19.5, 27 + lx, 25, 'leather');
      gfist(c, GSK, 10 + lx, 28); gfist(c, GSK, 27 + lx, 25);
    });
  },
};

U.giant_general = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P) {
    const b = P.body, a = P.atk, sw = P.sw, g = P.glow;
    c.poly('team', [[8, 16 + b], [31, 16 + b], [34 + sw, 37], [5 + sw, 37]]); c.rect('gold', 5 + sw, 37, 34 + sw, 37);
    giantLegs(c, P, GSK, 'fur');
    c.at(0, P.ll, () => c.rect('gold', 13, 33, 18, 33)); c.at(0, P.lr, () => c.rect('gold', 21, 33, 26, 33));
    c.at(0, b, () => { c.rect('gold', 12, 27, 27, 29); c.ell('rune', 19.5, 28, 1.6, 1.2); });
    c.at(P.sw, b, () => { c.poly('team', [[14, 30], [25, 30], [24.5, 35], [14.5, 35]]); c.rect('gold', 14, 35, 24, 35); });
    giantTorso(c, b);
    c.at(0, b, () => { c.poly('stone', [[12.5, 18], [26.5, 18], [25.5, 26], [13.5, 26]]); c.rect('gold', 12, 18, 27, 18); c.line('gold', 19, 19, 19, 25); c.line('gold', 20, 19, 20, 25); c.px('stone.3', 14, 19); });
    c.at(0, b + P.s, () => { gArm(c, GSK, 9.5, 19.5, 7, 29.5, 'gold'); gfist(c, GSK, 7, 30); });
    c.at(0, b, () => {   // hombreras de piedra con oro
      c.ell('stone', 9, 17.5, 4.6, 3.6); c.ell('stone', 30, 17.5, 4.6, 3.6); c.rect('gold', 5, 20, 13, 20); c.rect('gold', 26, 20, 34, 20);
      c.px('stone.3', 7, 15); c.px('stone.3', 28, 15); c.px('rune', 9, 17); c.px('rune', 30, 17);
    });
    giantHead(c, b, { beard: 'beard', eye: 'glowC', dy: -1 });
    c.at(0, b - 1, () => {   // corona de piedra y oro
      c.rect('stone', 14, 6, 25, 8); c.rect('gold', 14, 8, 25, 8);
      for (const x of [14, 17, 22, 25]) c.rect('gold', x, 3, x, 5);
      c.rect('gold', 19, 2, 20, 5); c.px('gold.3', 19, 2); c.ell('rune', 19.5, 6.5, 1.2, 1.2);
    });
    halo(c, 19.5, 6 + b - 1, 1.4, g * 0.6, '#5ff0e0');
    halo(c, 17.5, 10.5 + b, 0.3, g * 0.4, '#9ff8f2'); halo(c, 22.5, 10.5 + b, 0.3, g * 0.4, '#9ff8f2');
    // maza enorme con runas
    const T = [[31.5, 28.5 - P.s, -100], [27.5, 13.5, -160], [21.5, 22.5, 18], [22.5, 24.5, 34]][a];
    c.at(0, b, () => {
      gArm(c, GSK, 29.5, 19.5, T[0], T[1], 'gold');
      if (a === 2) smear(c, T[0], T[1], 15, -150, 10, 3);
      const f = fr(T[0], T[1], T[2]), [mx, my] = f(13, 0);
      c.rim(t => { bar(t, 'x', f, -3, 10, 2.4); t.ell('x', mx, my, 3.8, 3.8); for (const [u, v] of [[13, -4.6], [13, 4.6], [17.2, 0]]) { const [x, y] = f(u, v); t.px('x', x, y); } }, 'darkwood');
      c.ell('iron', mx, my, 3.8, 3.8); c.ell('gold', mx, my, 1.4, 3.8); c.ell('rune', mx, my, 0.9, 0.9);
      for (const [u, v] of [[13, -4.6], [13, 4.6], [17.2, 0]]) { const [x, y] = f(u, v); c.px('gold', x, y); }
      halo(c, mx, my, 4.4, a ? g + 0.6 : g * 0.5, '#5ff0e0');
      gfist(c, GSK, T[0], T[1]);
    });
  },
};

// ------------------------------------------------------------- neutrales (sin color de equipo)
// cuerpo de bandido (proporciones humanas: cabeza y≈10, torso y14–24, piernas y22–29)
function banditBody(c, P) {
  const b = P.body, sw = P.sw;
  c.poly('ub_rag2', [[10, 14 + b], [21, 14 + b], [22.5 + sw, 25], [8.5 + sw, 25]]);
  for (let x = 9; x <= 22; x += 3) c.px(null, x + sw, 25);
  c.at(0, P.ll, () => { c.rect('pants', 11, 22, 14, 27); c.rect('leather', 10, 27, 14, 29); c.rect('ub_rope', 11, 25, 14, 25); });
  c.at(0, P.lr, () => { c.rect('pants', 17, 22, 20, 27); c.rect('leather', 17, 27, 21, 29); c.rect('ub_rope', 17, 25, 20, 25); });
  c.at(0, b, () => {
    c.rect('ub_rag', 11, 15, 20, 23); c.px(null, 11, 23); c.px(null, 14, 23); c.px(null, 18, 23);
    c.rect('sack', 17, 17, 18, 18); c.px('sack.0', 17, 18); c.line('ub_rag.0', 13, 16, 12, 19);
    c.rect('leather', 11, 21, 20, 21); c.px('iron', 15, 21); c.ell('sack', 18.5, 22.5, 1.4, 1.4);
  });
}
function banditHead(c, b, sec) {
  c.at(0, b, () => {
    c.ell('ub_rag2', 15.5, 9.8, 5.8, 5.6); c.poly('ub_rag2', [[13, 5], [15.5, 2.5], [18.5, 5]]);
    c.poly('ub_rag2', [[10, 12], [21, 12], [22, 16], [9, 16]]);
    c.ell('skin', 15.5, 11.2, 3.9, 3.2); c.rect('ub_rag2.0', 12, 8, 19, 8); c.px('ub_rag2.0', 11, 9); c.px('ub_rag2.0', 20, 9);
    c.px('ub_rag2.3', 13, 4); c.px('ub_rag2.3', 11, 7);
    c.px('eye', 14, 10); c.px('eye', 17, 10); c.rect('skin.0', 13, 9, 18, 9);
    c.rect('red', 11, 12, 20, 14); c.px('red.0', 13, 14); c.px('red.0', 16, 13); c.px('red.2', 12, 12);
  });
  c.at(0, b + sec, () => { c.px('red', 21, 13); c.px('red', 22, 14); c.px('red', 21, 15); c.px('red.0', 22, 15); });
}

U.neutral_bandit = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    banditBody(c, P);
    c.at(0, b + P.s, () => { limb(c, 'ub_rag', 10.5, 16, 9, 21, 2.6); c.ell('skin', 9, 22, 1.4, 1.4); });
    banditHead(c, b, P.sec);
    // espada corta (barre en arco en el ataque)
    const T = [[23, 21.5 - P.s, -90], [21.5, 13.5, -150], [19.5, 18.5, 0], [19.5, 20.5, 40]][a];
    c.at(0, b, () => {
      limb(c, 'ub_rag', 20.5, 16, T[0], T[1], 2.6);
      if (a === 2) smear(c, T[0], T[1], 10, -140, -10, 2);
      const f = fr(T[0], T[1], T[2]), bl = [[2.6, -1], [9.6, -1], [11, 0], [9.6, 1], [2.6, 1]];
      c.rim(t => { bar(t, 'x', f, -1.5, 2, 2); pw(t, 'x', f, [[2, -2.4], [2.8, -2.4], [2.8, 2.4], [2, 2.4]]); pw(t, 'x', f, bl); }, 'blade');
      pw(c, 'iron', f, [[2, -2.4], [2.8, -2.4], [2.8, 2.4], [2, 2.4]]); bar(c, 'leather', f, -1.5, 1.8, 2);
      pw(c, 'blade.3', f, [[3, -0.2], [9.5, -0.2], [9.5, 0.4], [3, 0.4]]);
      c.ell('skin', T[0], T[1], 1.4, 1.4);
    });
  },
};

U.neutral_bandit_archer = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk;
    c.at(0, b, () => {   // carcaj a la espalda
      c.rim(t => t.poly('x', [[7, 8], [9.5, 7], [12.5, 17], [10, 18]]), 'leather');
      c.px('feather', 7, 6); c.px('feather', 8, 5); c.px('red', 9, 6); c.px('feather', 10, 6);
    });
    banditBody(c, P);
    banditHead(c, b, P.sec);
    // arco corto a la derecha, apuntando al frente; la mano izq. tensa la cuerda
    const draw = a === 1, sy = 19.5, bx = a === 2 ? 26 : 25;
    const hand = draw ? [17, sy] : a === 2 ? [19, 18] : [9, 22 + P.s];
    c.at(0, b + (a ? 0 : -P.s), () => {
      limb(c, 'ub_rag', 20.5, 16, bx - 1, sy, 2.6);
      c.ring('wood', bx - 4, sy, 5.6, 8.8, 0.5, (x) => x >= bx - 1);
      c.px('wood', bx, sy - 9); c.px('wood', bx, sy + 8);
      if (draw) { c.line('string', bx, sy - 8, hand[0], sy); c.line('string', bx, sy + 8, hand[0], sy); }
      else c.line('string', bx - (a === 2 ? 1 : 0), sy - 8, bx - (a === 2 ? 1 : 0), sy + 8);
      c.rect('leather', bx, sy - 1, bx + 1, sy + 1); c.ell('skin', bx, sy, 1.3, 1.3);
    });
    c.at(0, b + (a ? 0 : P.s), () => {
      limb(c, 'ub_rag', 10.5, 16, hand[0], hand[1], 2.6);
      if (draw) { c.line('wood', hand[0], sy, bx + 3, sy); c.px('steel', bx + 4, sy); c.px('steel', bx + 3, sy - 1); c.px('steel', bx + 3, sy + 1); c.px('feather', hand[0] - 1, sy - 1); c.px('feather', hand[0] - 1, sy + 1); }
      if (a === 2) { c.line('ub_sm', bx + 3, sy, bx + 6, sy); }
      c.ell('skin', hand[0], hand[1], 1.3, 1.3);
    });
  },
};

U.neutral_goblin = {
  w: 32, h: 32, ax: 16, ay: 29,
  draw(c, P) {
    const b = P.body, a = P.atk, G = 'ub_gob', lg = a === 2 ? 1 : 0;
    c.at(0, P.ll, () => { c.rect(G, 13, 25, 14, 28); c.rect('leather', 12, 28, 14, 29); });
    c.at(0, P.lr, () => { c.rect(G, 17, 25, 18, 28); c.rect('leather', 17, 28, 19, 29); });
    c.at(lg, b, () => {
      c.poly('ub_rag', [[12, 19], [19, 19], [20, 25.5], [11, 25.5]]); c.px(null, 12, 25); c.px(null, 15, 25); c.px(null, 18, 25);
      c.rect('ub_rope', 12, 22, 19, 22); c.px('ub_rag.0', 14, 20); c.px('ub_rag.0', 17, 24);
    });
    c.at(lg, b + P.s, () => { limb(c, G, 12, 20, 10, 24, 2); c.px(G, 10, 25); });
    c.at(lg, b, () => {   // cabezota con orejas enormes
      c.at(0, P.sec, () => { c.poly(G, [[12, 13], [4.5, 10], [6, 12], [12, 16]]); c.poly(G, [[19, 13], [26.5, 10], [25, 12], [19, 16]]); c.line(G + '.0', 7, 12, 11, 14); c.line(G + '.0', 24, 12, 20, 14); });
      c.rim(t => t.ell('x', 15.5, 14.5, 4.6, 4.2), G);
      c.rect(G + '.0', 12, 12, 14, 12); c.rect(G + '.0', 17, 12, 19, 12);
      c.px('glowY', 13, 13); c.px('eye', 14, 13); c.px('glowY', 18, 13); c.px('eye', 17, 13);
      c.rect(G + '.2', 15, 14, 16, 14); c.px(G + '.2', 16, 15); c.px(G + '.0', 17, 16);
      c.rect('ol', 13, 17, 18, 17); c.px('white', 14, 17); c.px('white', 17, 17);
      c.px('ub_rag2', 15, 10); c.px('ub_rag2', 16, 10); c.px('ub_rag2', 14, 10);
    });
    // daga: puñalada rápida
    const T = [[20.5, 23.5 - P.s, -70], [18.5, 18.5, -150], [23.5, 20.5, -10], [21.5, 22.5, 20]][a];
    c.at(lg, b, () => {
      limb(c, G, 19, 20, T[0] - lg, T[1], 2);
      if (a === 2) for (const y of [-2, 2]) c.line('ub_sm', T[0] - 3, T[1] + y, T[0] - 8, T[1] + y);
      const f = fr(T[0] - lg, T[1], T[2]);
      c.rim(t => { bar(t, 'x', f, -1, 1.5, 2); pw(t, 'x', f, [[1.5, -1], [6, -0.6], [7.2, 0], [6, 0.8], [1.5, 1]]); }, 'blade');
      bar(c, 'leather', f, -1, 1.2, 2); const [gx, gy] = f(1.6, 0); c.px('copper', gx, gy);
      c.ell(G, T[0] - lg, T[1], 1.3, 1.3);
    });
  },
};

U.neutral_ogre = {
  w: 40, h: 40, ax: 20, ay: 37,
  draw(c, P) {
    const b = P.body, a = P.atk, O = 'ub_ogre';
    c.at(0, P.ll, () => { c.rect(O, 13, 31, 18, 35); c.rect(O, 12, 35, 18, 37); c.px(null, 12, 35); c.rect('ub_rag', 13, 33, 18, 33); });
    c.at(0, P.lr, () => { c.rect(O, 21, 31, 26, 35); c.rect(O, 21, 35, 27, 37); c.px(null, 27, 35); c.rect('ub_rag', 21, 33, 26, 33); });
    c.at(0, b, () => {
      c.ell(O, 19.5, 18.5, 10, 4.6);                                   // hombros
      c.poly(O, [[10, 18], [29, 18], [28, 23], [12, 23]]);
      c.ell(O, 19.5, 25.5, 9.4, 6.8);                                  // barriga enorme
      c.rect(O + '.0', 13, 21, 17, 21); c.rect(O + '.0', 22, 21, 26, 21); c.px(O + '.0', 19, 27); c.px(O + '.0', 20, 27);
      c.ring(O + '.0', 19.5, 25.5, 9.4, 6.8, 0.82, (x, y) => y > 28);
      c.rect('ub_rope', 11, 29, 28, 30); c.ell('gold', 19.5, 29.5, 1.8, 1.4); c.px('gold.3', 19, 29);
    });
    c.at(P.sw, b, () => { c.poly('ub_rag', [[14, 31], [25, 31], [24, 35], [15, 35]]); c.px(null, 16, 35); c.px(null, 20, 35); c.px(null, 23, 35); c.px('ub_rag.0', 19, 32); });
    c.at(0, b, () => {   // collar de oro (botín que custodia)
      c.line('gold', 14, 17, 19, 20); c.line('gold', 25, 17, 20, 20); c.ell('gold', 19.5, 20.5, 1.4, 1.2); c.px('red', 19, 20);
    });
    c.at(0, b + P.s, () => { limb(c, O, 10, 19.5, 7.5, 30, 4.6); c.rect('leather', 5, 26, 10, 27); c.ell(O, 7.5, 30.5, 2.3, 2.2); });
    c.at(0, b, () => {   // cabeza pequeña, colmillos, moño
      c.rim(t => { t.ell('x', 19.5, 12.2, 4.4, 4.2); t.rect('x', 15, 13, 24, 16); t.rect('x', 14, 12, 14, 13); t.rect('x', 25, 12, 25, 13); }, O);
      c.rect(O + '.0', 16, 11, 18, 11); c.rect(O + '.0', 21, 11, 23, 11); c.px('eye', 17, 12); c.px('eye', 22, 12);
      c.rect(O + '.2', 19, 12, 20, 13); c.px(O + '.0', 20, 14); c.rect('ol', 17, 15, 22, 15); c.px('bone', 17, 14); c.px('bone', 22, 14); c.px('bone', 20, 15);
      c.ell('hair', 19.5, 7, 1.8, 1.6); c.px('ub_rope', 19, 8); c.px('ub_rope', 20, 8); c.px('gold', 25, 14);
    });
    // maza de hierro con pinchos
    const T = [[31.5, 28.5 - P.s, -100], [27.5, 13.5, -160], [21.5, 22.5, 18], [22.5, 24.5, 34]][a];
    c.at(0, b, () => {
      limb(c, O, 29, 19.5, T[0], T[1], 4.6); c.rect('leather', T[0] - 2.5, T[1] - 4, T[0] + 2.5, T[1] - 3);
      if (a === 2) smear(c, T[0], T[1], 15, -150, 10, 3);
      const f = fr(T[0], T[1], T[2]), [mx, my] = f(13, 0), sp = [[13, -4.4], [13, 4.4], [16.8, 0], [10, -3.4], [10, 3.4], [15.6, -3], [15.6, 3]];
      c.rim(t => { bar(t, 'x', f, -3, 10, 2.4); t.ell('x', mx, my, 3.6, 3.6); for (const [u, v] of sp) { const [x, y] = f(u, v); t.px('x', x, y); } }, 'darkwood');
      c.ell('iron', mx, my, 3.6, 3.6); for (const [u, v] of sp) { const [x, y] = f(u, v); c.px('iron.2', x, y); }
      const [hx, hy] = f(12, -1.5); c.px('iron.3', hx, hy); bar(c, 'iron', f, 8, 9, 2.8);
      c.ell(O, T[0], T[1], 2.3, 2.2);
    });
  },
};
})();
