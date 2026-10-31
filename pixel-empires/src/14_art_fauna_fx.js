/* =====================================================================
   Pixel Empires — 14: fauna, efectos, proyectiles e íconos
   Animales de perfil mirando a la DERECHA (idle/walk/attack + o.dead),
   efectos con ancla al centro, proyectiles apuntando a la derecha e
   íconos de interfaz (recursos, estadísticas, insignias, comandos).
   ===================================================================== */
(function () {
  'use strict';
  const U = PE.ART.units, FX = PE.ART.fx, IC = PE.ART.icons, TAU = Math.PI * 2;

  // ----------------------------------------------------------- materiales
  PE.addMats({
    fa_wool: '#e6e0d0', fa_sface: '#54464b', fa_sleg: '#625457', fa_hoof: '#3f3438',
    fa_pig: '#eda4a0', fa_snout: '#d67a7c',
    fa_cow: '#ece8de', fa_spot: '#3e3438', fa_udder: '#e9a2a2', fa_horn: '#ddd2b0', fa_cowmz: '#e3a59a',
    fa_hen: '#f1ece0', fa_comb: '#d8322c', fa_beak: '#efb030',
    fa_deer: '#b97a48', fa_deerl: '#ecdcc0', fa_antler: '#d9c79c',
    fa_horse: '#8f5634', fa_mane: '#3b2b27',
    fa_wolf: '#80869a', fa_wolfl: '#cfcbc4',
    fa_bear: '#6e4a31', fa_bearl: '#a87b52',
    fa_boar: '#5f4b3f', fa_bristle: '#3c2f29', fa_tusk: '#efe5cb',
    fa_tongue: '#e06f7c', fa_claw: '#e9e1cc',
  });
  PE.addFixed({
    fa_eyeY: '#ffd84a', fa_eyeR: '#ff5a3a', fa_teeth: '#f6f2e4',
    fa_blood: '#8c1a26e6', fa_bloodd: '#5e0e1acc',
  });

  // ----------------------------------------------------------- ayudas fauna
  // Marcha de 4 tiempos (8 frames de P.t): fase por pata -> [dx, lift]
  function gait(P, ph, amp = 1.5) {
    if (P.anim !== 'walk') return [0, 0];
    const a = (P.t / 8 + ph) * TAU;
    return [Math.round(Math.sin(a) * amp), Math.cos(a) > 0.3 ? -1 : 0];
  }
  // Pata: cadera (x,y0) -> pie (x+dx, y1+lift) con rodilla/corvejón a media altura desplazado kb; ancho w; pezuña hm
  function leg(c, m, x, y0, y1, g, w = 1, hm, kb = 0) {
    const [dx, lf] = g, yb = y1 + lf, ym = Math.round(y0 + (yb - y0) * .55), mx = Math.round(dx / 2) + kb;
    for (let i = 0; i < w; i++) { c.line(m, x + i, y0, x + i + mx, ym); c.line(m, x + i + mx, ym, x + i + dx, yb); }
    if (hm) for (let i = 0; i < w; i++) c.px(hm, x + i + dx, yb);
  }
  const ATKX = [0, -1, 2, 1];               // desplazamiento de embestida por fase atk
  // Pata tiesa de cadáver: segmento desde (x,y) con dirección (dx,dy); grosor w perpendicular
  function stiff(c, m, x, y, dx, dy, w = 1, hm) {
    const hz = Math.abs(dx) > Math.abs(dy);
    for (let i = 0; i < w; i++) { const ox = hz ? 0 : i, oy = hz ? i : 0; c.line(m, x + ox, y + oy, x + ox + dx, y + oy + dy); if (hm) c.px(hm, x + ox + dx, y + oy + dy); }
  }
  // Patas estiradas del cadáver tendido de costado (far: lejanas en sombra, detrás del cuerpo)
  function sprawl(c, m, hm, xb, xf, y, L, w, far) {
    if (far) { stiff(c, m + '.0', xb + 1, y - 2, -L, -1, w, hm); stiff(c, m + '.0', xf - 1, y - 2, L, -1, w, hm); }
    else { stiff(c, m, xb, y, -L, 1, w, hm); stiff(c, m, xf, y, L + 1, 1, w, hm); }
  }
  // Charco de sangre bajo el cadáver
  function pool(c, cx, cy, rx) { c.ell('fa_bloodd', cx, cy, rx, 1.5); c.ell('fa_blood', cx - .5, cy - .3, rx * .6, 1); }
  // Ojo cerrado de cadáver
  function deadEye(c, x, y) { c.px('eye', x, y); c.px('eye', x + 1, y); }

  // ======================================================== OVEJA 24×20
  U.animal_sheep = {
    w: 24, h: 20, ax: 12, ay: 17, dead: true,
    render: { shadow: { cx: 11.5, cy: 18, rx: 7.5, ry: 1.5 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 12, 17.5, 6);
        sprawl(c, 'fa_sleg', 'fa_hoof', 7, 15, 15, 5, 1, true);
        c.ell('fa_wool', 3, 13, 1.5, 1.5);
        c.ell('fa_wool', 11, 14, 7.5, 3.2); c.ell('fa_wool', 7, 12, 2.6, 2); c.ell('fa_wool', 11.5, 11.4, 2.8, 2); c.ell('fa_wool', 15.5, 12.2, 2.4, 1.8);
        c.px('fa_wool.0', 9, 14); c.px('fa_wool.0', 13, 15);
        sprawl(c, 'fa_sleg', 'fa_hoof', 6, 15, 16, 5, 1);
        c.ell('fa_sface', 19, 14.2, 2.6, 1.9); c.rect('fa_sface', 20, 14, 21, 15); c.ell('fa_wool', 17.5, 12.7, 1.5, 1.1);
        c.rect('fa_sface', 15, 14, 16, 14); deadEye(c, 18, 13); c.px('fa_tongue', 21, 16);
        return;
      }
      const b = P.body, t = P.t, k = P.atk;
      const gz = P.anim === 'idle' ? [0, 1, 2, 2][t] : 0;      // pastar
      const hd = k === 1 || k === 2 ? 1 : 0;                    // cabeza gacha al embestir
      c.at([-1, -1, 0, -1][k], 0, () => {
        leg(c, 'fa_sleg.0', 8, 14 + b, 17, gait(P, .5));
        leg(c, 'fa_sleg.0', 16, 14 + b, 17, gait(P, .75));
        c.at(0, b + P.sec, () => c.ell('fa_wool', 3.5, 9.5, 1.7, 1.7));      // cola
        c.at(0, b, () => {
          c.ell('fa_wool', 11, 10.5, 7.5, 4.6);
          c.ell('fa_wool', 6.5, 8.3, 2.6, 2.4); c.ell('fa_wool', 10.5, 6.9, 2.8, 2.2); c.ell('fa_wool', 14.8, 7.2, 2.6, 2.1);
          for (const [x, y] of [[9, 9], [13, 10], [8, 12], [15, 12]]) c.px('fa_wool.0', x, y);   // rizos
        });
        leg(c, 'fa_sleg', 6, 14 + b, 17, gait(P, 0));
        leg(c, 'fa_sleg', 14, 14 + b, 17, gait(P, .25));
        const hx = 19 + (k === 1 ? -1 : 0), hy = 8 + gz * 2.6 + hd * 2 + b;
        c.ell('fa_wool', 17, (9 + hy) / 2 + 1, 2.4, 2.6);                                     // cuello
        c.ell('fa_sface', hx + .5, hy + .5, 2.7, 2.2);
        c.rect('fa_sface', hx + 2, hy + 1, hx + 3, hy + 2 + (gz === 2 && t === 3 ? 1 : 0));  // hocico (mastica)
        c.ell('fa_wool', hx - .5, hy - 1.2, 1.6, 1.2);                                       // copete
        c.rect('fa_sface', hx - 3, hy + 1, hx - 2, hy + 1); c.px('fa_sface.2', hx - 3, hy + 1); // oreja
        c.px('fa_wool', hx + 1, hy); c.px('eye', hx + 1, hy + 1);
      });
    },
  };

  // ======================================================== CERDO 24×20
  U.animal_pig = {
    w: 24, h: 20, ax: 12, ay: 17, dead: true,
    render: { shadow: { cx: 12, cy: 18, rx: 8, ry: 1.5 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 12, 17.5, 6);
        sprawl(c, 'fa_pig', 'fa_hoof', 7, 15, 15, 3, 2, true);
        c.ell('fa_pig', 11.5, 14, 8, 3.3); c.px('fa_pig', 3, 13); c.px('fa_pig', 2, 12); c.px('fa_pig', 2, 14);
        c.px('fa_pig.0', 7, 15); c.px('fa_pig.0', 8, 16);
        sprawl(c, 'fa_pig', 'fa_hoof', 6, 15, 16, 3, 2);
        c.ell('fa_pig', 19, 14, 3, 2.4); c.rect('fa_snout', 21, 13, 22, 15); c.px('fa_hoof', 22, 14);
        c.poly('fa_snout', [[16, 11.5], [19, 11.5], [19.5, 13.5]]); deadEye(c, 19, 13); c.px('fa_tongue', 21, 16);
        return;
      }
      const b = P.body, t = P.t, k = P.atk;
      const sn = P.anim === 'idle' ? [0, 1, 1, 0][t] : 0;      // olfatea
      c.at([-1, -1, 0, -1][k], k === 1 ? 1 : 0, () => {                       // agazapa y embiste
        leg(c, 'fa_pig.0', 8, 14 + b, 17, gait(P, .5), 2, 'fa_hoof');
        leg(c, 'fa_pig.0', 15, 14 + b, 17, gait(P, .75), 2, 'fa_hoof');
        c.at(0, b, () => {
          const cq = (t + (P.anim === 'walk' ? 0 : 1)) % 2;                     // cola enroscada
          c.px('fa_pig', 3, 9); c.px('fa_pig', 2, 8 + cq); c.px('fa_pig', 3, 7 + cq * 2);
          c.ell('fa_pig', 11, 11, 7.8, 4.6);
          c.px('fa_pig.0', 6, 13); c.px('fa_pig.0', 7, 14);                       // barro
        });
        leg(c, 'fa_pig', 6, 14 + b, 17, gait(P, 0), 2, 'fa_hoof');
        leg(c, 'fa_pig', 13, 14 + b, 17, gait(P, .25), 2, 'fa_hoof');
        c.at(0, b + sn + (k === 1 ? 1 : 0), () => {
          c.ell('fa_pig', 18.5, 10.8, 3.3, 3.2);
          c.line('fa_pig.0', 15, 9, 15, 13); c.px('fa_pig.0', 16, 14);           // pliegue del cuello
          c.rect('fa_snout', 21, 10, 22, 12); c.px('fa_snout.2', 21, 10); c.px('fa_hoof', 22, 11);
          const ef = P.anim === 'walk' ? (P.sec > 0 ? 1 : 0) : (t === 2 ? 1 : 0); // oreja caída que aletea
          c.px('eye', 20, 10);
          c.poly('fa_snout', [[16, 6.5], [19.5, 6.5 + ef], [20.6, 9.6 + ef * .5], [17.5, 8.6]]); c.px('fa_snout.0', 19, 9);
          if (k === 2) c.px('fa_tongue', 21, 13);
        });
      });
    },
  };

  // ======================================================== VACA 32×24
  U.animal_cow = {
    w: 32, h: 24, ax: 16, ay: 21, dead: true,
    render: { shadow: { cx: 15.5, cy: 22, rx: 10, ry: 1.6 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 16, 21.5, 8);
        sprawl(c, 'fa_cow', 'fa_hoof', 9, 20, 19, 6, 2, true);
        c.line('fa_cow', 5, 17, 2, 19); c.px('fa_spot', 1, 19); c.px('fa_spot', 1, 20);
        c.ell('fa_cow', 15, 17.5, 10, 3.8);
        c.ell('fa_spot', 11, 16.5, 3, 1.8); c.poly('fa_spot', [[16, 17], [20, 16], [20, 19], [17, 19]]);
        c.ell('fa_udder', 12, 20.5, 1.8, 1);
        sprawl(c, 'fa_cow', 'fa_hoof', 8, 20, 20, 6, 2);
        c.poly('fa_cow', [[22, 15], [25, 15], [27, 19], [23, 20]]);
        c.ell('fa_cow', 26, 16.8, 2.8, 2.4); c.rect('fa_cowmz', 27, 17, 30, 19); c.px('fa_cowmz.0', 30, 18);
        c.ell('fa_spot', 25, 16, 1.3, 1); c.line('fa_horn', 24, 14, 23, 13); c.px('fa_horn', 25, 13);
        deadEye(c, 26, 16); c.px('fa_tongue', 29, 20);
        return;
      }
      const b = P.body, t = P.t, k = P.atk;
      const gz = P.anim === 'idle' ? [0, 0, 1, 1][t] : 0;
      const hd = k === 1 || k === 2 ? 2 : k === 3 ? 1 : 0;
      c.at([0, -1, 1, 1][k], 0, () => {
        leg(c, 'fa_cow.0', 11, 16 + b, 21, gait(P, .5), 2, 'fa_hoof');
        leg(c, 'fa_cow.0', 21, 16 + b, 21, gait(P, .75), 2, 'fa_hoof');
        const sw = P.anim === 'idle' ? [0, 1, 0, -1][t] : P.anim === 'walk' ? P.sw : 0;   // cola que espanta moscas
        c.at(0, b, () => { c.line('fa_cow', 7, 9, 6 + sw, 13); c.line('fa_cow', 6 + sw, 13, 5 + sw, 16); c.rect('fa_spot', 4 + sw, 16, 5 + sw, 17); });
        c.at(0, b, () => {
          c.rect('fa_cow', 8, 8, 23, 16); c.ell('fa_cow', 9, 12, 2.5, 4.3); c.ell('fa_cow', 22, 12, 2.5, 4.3);
          c.rect('fa_cow', 9, 7, 21, 7);
          c.ell('fa_spot', 12, 10, 2.8, 2.2); c.poly('fa_spot', [[16, 13], [20, 12], [21, 16], [17, 16]]); c.ell('fa_spot', 19.5, 8.5, 1.8, 1.2);
          c.ell('fa_udder', 12.5, 17, 1.8, 1.3); c.px('fa_udder.0', 12, 18); c.px('fa_udder.0', 13, 18);
        });
        leg(c, 'fa_cow', 9, 16 + b, 21, gait(P, 0), 2, 'fa_hoof');
        leg(c, 'fa_cow', 19, 16 + b, 21, gait(P, .25), 2, 'fa_hoof');
        c.at(gz, b + gz * 3 + hd, () => {
          const ch = P.anim === 'idle' && t % 2 ? 1 : 0;                         // mastica
          c.poly('fa_cow', [[21, 8], [24, 6], [25, 11], [22, 13]]);
          c.ell('fa_cow', 25.5, 8.5, 2.8, 2.6);
          c.rect('fa_cowmz', 26, 9, 28, 11 + ch); c.px('fa_cowmz.0', 28, 10); c.px('fa_cowmz.2', 26, 9);
          c.ell('fa_spot', 24.5, 7.5, 1.4, 1.2);
          c.line('fa_horn', 23, 5, 24, 4); c.px('fa_horn', 25, 3); c.px('fa_horn.0', 26, 5);
          c.rect('fa_cow', 21, 6, 22, 7); c.px('fa_cow.0', 21, 7);              // oreja
          c.px('eye', 26, 7);
        });
      });
    },
  };

  // ======================================================== GALLINA 16×16
  U.animal_chicken = {
    w: 16, h: 16, ax: 8, ay: 13, dead: true,
    render: { shadow: { cx: 7.5, cy: 14, rx: 4.5, ry: 1.2 } },
    draw(c, P, o) {
      if (o.dead) {
        c.ell('fa_bloodd', 8, 13.6, 4, 1.2);
        c.ell('fa_hen', 7, 11.5, 4.2, 2.4); c.poly('fa_hen', [[2, 10], [4, 9], [4, 12]]);
        c.line('fa_beak', 7, 9, 8, 7); c.line('fa_beak', 9, 9, 10, 7); c.px('fa_beak', 7, 7); c.px('fa_beak', 11, 7);
        c.ell('fa_hen', 12, 12, 1.8, 1.5); c.px('fa_comb', 12, 10); c.px('fa_comb', 13, 10); c.px('fa_beak', 14, 12); deadEye(c, 12, 12);
        c.px('fa_hen.0', 6, 12); c.px('fa_hen.0', 8, 12);
        return;
      }
      const b = P.body, t = P.t, k = P.atk;
      const pk = P.anim === 'idle' ? [0, 1, 2, 0][t] : k === 1 ? 0 : k === 2 ? 2 : k === 3 ? 1 : 0;   // picoteo
      const fl = k === 1 || k === 2;                                              // aletea al atacar
      const bob = P.anim === 'walk' ? [0, 1, 1, 0, 0, 1, 1, 0][t] : 0;            // cabeceo al andar
      c.at(0, 0, () => {
        // patas
        const [d1, l1] = gait(P, 0, 1), [d2, l2] = gait(P, .5, 1);
        c.line('fa_beak', 6, 11 + b, 6 + d1, 13 + l1); c.px('fa_beak', 7 + d1, 13 + l1);
        c.line('fa_beak.0', 8, 11 + b, 8 + d2, 13 + l2); c.px('fa_beak.0', 9 + d2, 13 + l2);
        c.at(0, b + (pk ? pk * .5 : 0), () => {
          c.poly('fa_hen', [[2, 4 + P.sec], [4.5, 6], [4.5, 10], [2.5, 8.5]]);                    // cola
          c.px('fa_hen.0', 3, 6 + P.sec); c.px('fa_hen.0', 3, 8);
          c.ell('fa_hen', 7, 8.6, 4.2, 3);
          if (fl) { c.poly('fa_hen', [[5, 7], [9, 7], [7, 2 + (k === 2 ? 2 : 0)], [4, 4]]); c.line('fa_hen.0', 5, 5, 7, 4 + (k === 2 ? 2 : 0)); }
          else { c.ell('fa_hen.2', 6.5, 8.5, 2.3, 1.4); c.line('fa_hen.0', 5, 10, 8, 10); }    // ala
        });
        const hx = 10.5 + bob + (pk === 2 ? 1.5 : pk), hy = 4.6 + b + pk * 2.6;
        c.ell('fa_hen', 9.5 + (pk ? .5 : 0), 6.5 + b + pk * .8, 1.7, 2);                         // cuello
        c.ell('fa_hen', hx, hy, 1.9, 1.8);
        c.px('fa_comb', hx - 1, hy - 2); c.px('fa_comb', hx, hy - 2.4); c.px('fa_comb', hx + 1, hy - 2);
        c.px('fa_beak', hx + 2, hy); c.px('fa_beak.0', hx + 2, hy + 1);
        c.px('fa_comb', hx + 1, hy + 2); c.px('eye', hx + 1, hy - .6);
      });
    },
  };

  // ======================================================== CIERVO 32×28
  // Cabeza+astas en un bloque que se desplaza (hx,hy) y cuello poligonal hasta él
  function deerHead(c, hx, hy, m, ear, antl) {
    c.ell(m, 25 + hx, 6.5 + hy, 2.4, 1.9);
    c.poly(m, [[25 + hx, 5 + hy], [28.6 + hx, 6.3 + hy], [28.6 + hx, 7.8 + hy], [25 + hx, 8.4 + hy]]);
    c.px('fa_hoof', 28 + hx, 6 + hy); c.px('eye', 25 + hx, 6 + hy);
    c.line(m, 23 + hx, 5 + hy, 22 + hx, 4 + hy - ear); c.px(m + '.0', 21 + hx, 4 + hy - ear);    // oreja
    if (antl) {   // astas ramificadas: lejana (sombra) y cercana
      const A = (m2, pts) => pts.forEach(([x, y]) => c.px(m2, x + hx, y + hy));
      A('fa_antler.0', [[25, 4], [26, 3], [26, 2], [27, 1], [26, 0], [25, 1]]);
      A('fa_antler', [[24, 4], [23, 3], [22, 2], [21, 1], [20, 0], [23, 1], [23, 0], [21, 2], [20, 3]]);
    }
  }
  U.animal_deer = {
    w: 32, h: 28, ax: 16, ay: 25, dead: true,
    render: { shadow: { cx: 15, cy: 26, rx: 9, ry: 1.6 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 15, 25.5, 7);
        sprawl(c, 'fa_deer', 'fa_hoof', 10, 20, 23, 7, 1, true);
        c.ell('fa_deer', 15, 21.6, 8, 3); c.ell('fa_deer', 9.5, 21.6, 3, 3); c.ell('fa_deerl', 7, 20.5, 1.3, 1.5);
        c.line('fa_deerl', 12, 24, 18, 24);
        sprawl(c, 'fa_deer', 'fa_hoof', 9, 20, 23, 7, 1);
        c.poly('fa_deer', [[19, 19], [23, 18], [25, 21], [21, 22]]);
        c.ell('fa_deer', 25, 19.6, 2.4, 1.8); c.poly('fa_deer', [[25, 18], [28.6, 19.4], [28.6, 21], [25, 21.4]]); c.px('fa_hoof', 28, 19);
        deadEye(c, 25, 19); c.px('fa_tongue', 27, 22);
        [[24, 17], [23, 16], [22, 15], [21, 14], [20, 13], [23, 14], [23, 13], [21, 15], [20, 16]].forEach(([x, y]) => c.px('fa_antler', x, y));
        return;
      }
      const b = P.body, t = P.t, k = P.atk, A = P.anim;
      const ear = A === 'idle' && t === 1 ? 1 : 0, tail = A === 'idle' ? (t === 3 ? -1 : 0) : (A === 'walk' ? (P.sec > 0 ? -1 : 0) : -1);
      // cabeza: idle baja a mordisquear en t2, ataque baja astas y embiste
      let hx = 0, hy = 0;
      if (A === 'idle' && t === 2) { hx = 1; hy = 2; }
      if (k === 1) { hx = 0; hy = 4; } else if (k === 2) { hx = 1; hy = 4; } else if (k === 3) { hx = 1; hy = 2; }
      c.at([0, -1, 1, 1][k], 1, () => {                     // +1 abajo: las astas no tocan el borde
        leg(c, 'fa_deer.0', 11, 16 + b, 24, gait(P, .5, 2), 1, 'fa_hoof', -1);
        leg(c, 'fa_deer.0', 18, 15 + b, 24, gait(P, .75, 2), 1, 'fa_hoof');
        c.at(0, b, () => {
          c.ell('fa_deer', 15, 13.5, 7.6, 3.6);
          c.ell('fa_deer', 9.5, 14, 3, 3.6);                                               // anca
          c.line('fa_deerl.1', 13, 17, 18, 17); c.line('fa_deerl.0', 12, 16, 12, 16);      // vientre claro
          c.ell('fa_deerl', 7.5, 12.2, 1.4, 2);                                            // grupa blanca
          c.at(0, tail, () => { c.rect('fa_deerl', 6, 10, 7, 11); c.px('fa_deer.0', 6, 10); });   // rabo
        });
        leg(c, 'fa_deer', 9, 16 + b, 24, gait(P, 0, 2), 1, 'fa_hoof', -1);
        leg(c, 'fa_deer', 20, 15 + b, 24, gait(P, .25, 2), 1, 'fa_hoof');
        c.at(0, b, () => {
          c.poly('fa_deer', [[19, 15], [20, 11], [23 + hx, 6 + hy], [25.5 + hx, 7 + hy], [23, 14]]);       // cuello
          c.px('fa_deerl', 24 + hx, 8 + hy); c.px('fa_deerl', 23, 12);                                       // garganta
          deerHead(c, hx, hy, 'fa_deer', ear, true);
        });
      });
    },
  };

  // ======================================================== CABALLO 32×28
  U.animal_horse = {
    w: 32, h: 28, ax: 16, ay: 25, dead: true,
    render: { shadow: { cx: 15, cy: 26, rx: 9.5, ry: 1.6 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 15, 25.5, 8);
        sprawl(c, 'fa_horse', 'fa_hoof', 10, 20, 22, 7, 2, true);
        c.line('fa_mane', 6, 21, 2, 23); c.line('fa_mane', 6, 22, 1, 24); c.line('fa_mane', 5, 20, 2, 21);
        c.ell('fa_horse', 14, 21, 9, 3.4); c.ell('fa_horse', 9, 21, 3.4, 3.4);
        sprawl(c, 'fa_horse', 'fa_hoof', 9, 20, 22, 7, 2);
        c.poly('fa_horse', [[19, 18], [23, 16], [26, 17], [30, 19.5], [30, 21.5], [26, 21], [21, 21]]);
        c.rect('fa_horse.0', 29, 20, 30, 21); c.px('fa_hoof', 30, 20);
        c.line('fa_mane', 18, 18, 23, 15); c.line('fa_mane', 19, 18, 24, 16); c.px('fa_horse', 24, 15); c.px('fa_horse', 25, 15);
        deadEye(c, 25, 18); c.px('fa_tongue', 28, 22);
        return;
      }
      const b = P.body, t = P.t, k = P.atk, A = P.anim;
      const tw = A === 'idle' ? [0, 1, 0, -1][t] : A === 'walk' ? P.sw : 0;      // cola
      const hb = A === 'idle' ? [0, 0, 1, 1][t] : 0;                             // cabeceo
      const rr = k === 1 ? 4 : k === 3 ? 1 : 0;                                  // encabritarse
      const fx = k === 2 ? 2 : 0;
      c.at(0, 1, () => {                                     // +1 abajo: orejas lejos del borde
        // patas traseras (no se levantan al encabritarse)
        leg(c, 'fa_horse.0', 11, 16 + b, 24, gait(P, .5, 2), 2, 'fa_hoof', -1);
        // patas delanteras lejana
        if (rr >= 3) { c.line('fa_horse.0', 19, 14 - rr, 22, 16 - rr); c.line('fa_horse.0', 19, 15 - rr, 22, 17 - rr); c.rect('fa_hoof', 22, 17 - rr, 23, 17 - rr); }
        else leg(c, 'fa_horse.0', 18 + fx, 16 + b - rr, 24, gait(P, .75, 2), 2, 'fa_hoof');
        c.at(0, b, () => {   // cola
          c.line('fa_mane', 7, 10, 5 + tw, 14); c.line('fa_mane', 6, 10, 4 + tw, 15); c.line('fa_mane', 5 + tw, 14, 4 + tw, 19); c.line('fa_mane', 4 + tw, 15, 3 + tw, 19);
        });
        c.at(0, b, () => {
          c.poly('fa_horse', [[7, 11], [10, 9], [19, 9 - rr], [23, 11 - rr], [23, 16 - rr * .5], [19, 17], [9, 17], [6, 14]]);
          c.ell('fa_horse', 9.5, 13, 3.2, 4);                                               // anca
          c.ell('fa_horse', 21, 13.5 - rr * .7, 2.6, 3.5);                                   // pecho
        });
        leg(c, 'fa_horse', 8, 16 + b, 24, gait(P, 0, 2), 2, 'fa_hoof', -1);
        if (rr >= 3) { c.line('fa_horse', 21, 13 - rr, 24, 15 - rr); c.line('fa_horse', 21, 14 - rr, 24, 16 - rr); c.rect('fa_hoof', 24, 15 - rr, 25, 16 - rr); }
        else leg(c, 'fa_horse', 20 + fx, 16 + b - rr, 24, gait(P, .25, 2), 2, 'fa_hoof');
        c.at(k === 2 ? 1 : rr >= 3 ? -1 : 0, b + hb - (rr >= 3 ? 0 : rr), () => {   // al encabritarse la cabeza se echa atrás
          c.poly('fa_horse', [[18, 11], [21, 6], [23, 3], [26, 4], [25, 9], [23, 15]]);      // cuello
          c.poly('fa_horse', [[23, 2], [26, 2], [29.5, 7], [29, 9.5], [26, 9], [24, 6]]);    // cabeza
          c.rect('fa_horse.0', 28, 8, 29, 9); c.px('fa_hoof', 29, 8);                        // morro
          c.line('fa_horse.3', 26, 3, 28, 6);                                                // lucero
          c.px('fa_horse', 24, 1); c.px('fa_horse', 24, 0); c.px('fa_horse.0', 23, 1);       // orejas
          c.px('eye', 25, 4);
          c.poly('fa_mane', [[17, 9.5], [22.5, 1.5], [24.2, 2.6], [19.6, 10.4]]);             // crin
          c.px('fa_mane', 17 - (A === 'walk' ? P.sw : 0), 11); c.px('fa_mane', 19 - (A === 'walk' ? P.sw : 0), 7);
          c.px('fa_mane.2', 20, 6); c.px('fa_mane', 25, 1); c.px('fa_mane', 25, 2);
        });
      });
    },
  };

  // ======================================================== LOBO 32×24
  U.animal_wolf = {
    w: 32, h: 24, ax: 16, ay: 21, dead: true,
    render: { shadow: { cx: 15, cy: 22, rx: 9, ry: 1.5 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 15, 21.5, 7);
        sprawl(c, 'fa_wolf', 'fa_wolf.0', 10, 19, 19, 6, 1, true);
        c.poly('fa_wolf', [[8, 16], [4, 17], [1, 19], [3, 20], [8, 19]]); c.px('fa_wolfl', 1, 19); c.px('fa_wolfl', 2, 20);
        c.ell('fa_wolf', 14, 18, 8, 2.8); c.ell('fa_wolfl', 15, 19.8, 5, .9);
        sprawl(c, 'fa_wolf', 'fa_wolf.0', 9, 19, 20, 6, 2);
        c.ell('fa_wolf', 24, 17.2, 3, 2.3); c.poly('fa_wolf', [[25, 16], [30, 17.2], [30, 19], [25, 19.4]]); c.px('fa_hoof', 30, 17);
        c.poly('fa_wolf', [[21, 16], [22, 13], [24, 15.5]]); deadEye(c, 24, 16); c.line('mouth', 26, 19, 29, 19);
        c.px('fa_tongue', 28, 20); c.px('fa_tongue', 29, 20);
        return;
      }
      const b = P.body, t = P.t, k = P.atk, A = P.anim;
      const lunge = [0, -2, 3, 2][k], crouch = k === 1 ? 1 : 0;
      const jaw = k === 2 ? 2 : (A === 'idle' && (t === 1 || t === 2) ? 1 : 0);   // jadeo / mordisco
      const tw = A === 'idle' ? [0, 1, 1, 0][t] : A === 'walk' ? P.sw : (k === 1 ? -1 : 0);
      c.at(lunge, 0, () => {
        const lb = 13 + b + crouch;
        leg(c, 'fa_wolf.0', 11, lb, 21, gait(P, .5, 2), 1, 'fa_wolf.0', -2);
        if (k === 2) { c.line('fa_wolf.0', 19, 14, 23, 17); c.line('fa_wolf.0', 19, 15, 23, 18); }
        else leg(c, 'fa_wolf.0', 18, lb + 1, 21, gait(P, .75, 2), 1, 'fa_wolf.0');
        c.at(0, b + crouch, () => {  // cola tupida, recta hacia atrás (agresivo)
          c.poly('fa_wolf', [[9, 9], [5, 9.5 + tw * .5], [2, 11 + tw], [1, 13 + tw], [3, 13.6 + tw], [6, 12], [9, 12.5]]);
          c.px('fa_wolfl', 1, 13 + tw); c.px('fa_wolfl', 2, 13 + tw); c.px('fa_wolf.0', 5, 12);
        });
        c.at(0, b + crouch, () => {
          c.ell('fa_wolf', 10, 11.5, 3.2, 3);                                                        // anca
          c.poly('fa_wolf', [[9, 9], [14, 8.5], [17, 7.5], [21, 7.5], [23.5, 10], [23, 14], [20, 16], [16, 14], [13, 13], [9, 14]]);
          c.ell('fa_wolf', 20, 11.8, 3, 3.8);                                                        // pecho
          c.poly('fa_wolfl', [[18, 15.5], [22.6, 11.5], [22.6, 14.6], [20, 16]]); c.line('fa_wolfl.0', 12, 13, 15, 13);   // pecho y vientre
          c.poly('fa_wolf', [[15, 8], [16, 5.6], [17.4, 8]]); c.poly('fa_wolf', [[17.4, 8], [19, 5], [20.4, 8]]);     // pelo erizado
          c.px('fa_wolf.0', 16, 8); c.px('fa_wolf.0', 19, 8); c.line('fa_wolf.0', 11, 9, 14, 9);
        });
        leg(c, 'fa_wolf', 9, lb, 21, gait(P, 0, 2), 2, 'fa_wolf.0', -2);
        if (k === 2) { c.line('fa_wolf', 20, 14, 25, 18); c.line('fa_wolf', 21, 14, 26, 18); c.line('fa_wolf', 20, 15, 25, 19); }
        else leg(c, 'fa_wolf', 20, lb + 1, 21, gait(P, .25, 2), 2, 'fa_wolf.0');
        // cabeza baja y amenazante
        c.at(0, b + crouch * 2 - (k === 2 ? 1 : 0), () => {
          c.ell('fa_wolf', 24, 10.5, 3.2, 2.8);
          c.poly('fa_wolf', [[25, 9], [30, 10.2], [30, 11.8], [25, 12.6]]);                        // hocico
          c.px('fa_hoof', 30, 10); c.px('fa_wolf.0', 27, 10);
          c.at(0, jaw, () => { c.poly('fa_wolf', [[24, 12], [29.6, 12], [28.6, 13.6], [24, 13.8]]); c.px('fa_wolfl', 25, 13); });
          if (jaw) { c.rect('mouth', 25, 12, 29, 11 + jaw); c.px('fa_teeth', 29, 12); c.px('fa_teeth', 27, 11 + jaw); if (jaw > 1) c.px('fa_teeth', 29, 13); c.px('fa_tongue', 26, 12 + jaw - (jaw > 1 ? 1 : 0)); }
          else { c.line('mouth', 25, 12, 29, 12); c.px('fa_teeth', 28, 12); }
          const et = A === 'idle' && t === 3 ? 1 : 0;
          c.poly('fa_wolf.0', [[23.4, 9], [24.6, 5.2 + et], [26, 9]]);                              // oreja lejana
          c.poly('fa_wolf', [[21, 9.4], [21.8, 5], [24, 8.6]]); c.px('fa_wolf.0', 22, 7);          // oreja
          c.px('fa_eyeY', 25, 9); c.px('fa_bristle', 24, 9); c.px('fa_bristle', 26, 8);           // ceño
        });
      });
    },
  };

  // ======================================================== OSO 32×28
  U.animal_bear = {
    w: 32, h: 28, ax: 16, ay: 25, dead: true,
    render: { shadow: { cx: 15, cy: 26, rx: 10, ry: 1.7 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 15, 25.5, 9);
        sprawl(c, 'fa_bear', 'fa_bear.0', 9, 19, 22, 6, 3, true);
        c.ell('fa_bear', 14, 20.5, 9.5, 4.3); c.ell('fa_bear', 18, 17.5, 4, 2); c.px('fa_bearl', 17, 16); c.px('fa_bearl', 15, 17);
        sprawl(c, 'fa_bear', 'fa_bear.0', 8, 19, 22, 6, 3);
        c.px('fa_claw', 1, 23); c.px('fa_claw', 1, 25); c.px('fa_claw', 27, 23); c.px('fa_claw', 27, 25);
        c.ell('fa_bear', 24.5, 18.5, 3.6, 3); c.rect('fa_bearl', 27, 18, 30, 20); c.px('fa_hoof', 30, 18);
        c.ell('fa_bear', 22.5, 15.6, 1.4, 1.4); deadEye(c, 25, 17); c.px('fa_tongue', 29, 21);
        return;
      }
      const b = P.body, t = P.t, k = P.atk, A = P.anim;
      const sway = A === 'idle' ? [0, 0, 1, 1][t] : 0;                                  // balanceo de cabeza
      const rr = k === 1 ? 4 : k === 2 ? 1 : 0;                                         // se alza
      const roar = k === 1 || k === 2;
      const claws = (x, y) => { c.px('fa_claw', x, y); c.px('fa_claw', x - 2, y); };
      c.at(k === 2 ? 2 : k === 3 ? 1 : 0, 0, () => {
        leg(c, 'fa_bear.0', 10, 18 + b, 25, gait(P, .5, 1.5), 3, 'fa_bear.0', -1);
        leg(c, 'fa_bear.0', 17, 18 + b - rr, 25 - (k === 1 ? 2 : 0), gait(P, .75, 1.5), 3, 'fa_bear.0');
        c.at(0, b, () => {
          c.px('fa_bear', 4, 12); c.px('fa_bear', 4, 13);                                     // rabo
          c.poly('fa_bear', [[5, 12], [9, 9], [16, 8 - rr], [21, 6.5 - rr], [24, 11 - rr], [24, 19 - rr * .5], [20, 21], [8, 21], [5, 18]]);
          c.ell('fa_bear', 9, 15, 4, 5.5);                                                    // ancas
          c.ell('fa_bear', 19, 10 - rr, 4.4, 3.8);                                            // joroba
          c.px('fa_bearl', 18, 7 - rr); c.px('fa_bearl', 16, 8 - rr * .7); c.px('fa_bear.3', 19, 7 - rr);   // pelaje claro
          c.px('fa_bear.0', 15, 18); c.px('fa_bear.0', 12, 19); c.px('fa_bear.0', 18, 17);
        });
        { const g = gait(P, 0, 1.5); leg(c, 'fa_bear', 7, 18 + b, 25, g, 3, 'fa_bear.0', -1); claws(9 + g[0] + 1, 25 + g[1]); }
        // pata delantera cercana: zarpazo en ataque
        if (k === 1) {
          for (let i = 0; i < 3; i++) c.line('fa_bear', 20 + i, 14 - rr, 25 + i, 6 - rr + 4);
          c.rect('fa_bear', 25, 5, 28, 7); c.px('fa_claw', 29, 5); c.px('fa_claw', 29, 7); c.px('fa_claw', 28, 4);
        } else if (k === 2) {
          for (let i = 0; i < 3; i++) c.line('fa_bear', 20 + i, 13, 25 + i, 19);
          c.rect('fa_bear', 26, 19, 28, 20); c.px('fa_claw', 29, 21); c.px('fa_claw', 28, 21); c.px('fa_claw', 29, 19);
        } else { const g = gait(P, .25, 1.5); leg(c, 'fa_bear', 20, 18 + b, 25, g, 3, 'fa_bear.0'); claws(22 + g[0] + 1, 25 + g[1]); }
        c.at(0, b + sway - rr * 1.2, () => {
          c.ell('fa_bear.0', 25.5, 10.6, 1.3, 1.3);                                              // oreja lejana
          c.ell('fa_bear', 25, 13.6, 3.7, 3.3);
          c.rect('fa_bearl', 27, 13, 30, 15); c.px('fa_bearl', 27, 12); c.px('fa_bearl', 28, 12); c.px('fa_hoof', 30, 13);   // hocico
          if (roar) { c.rect('mouth', 27, 15, 30, 16); c.px('fa_teeth', 29, 15); c.px('fa_teeth', 28, 16); c.rect('fa_bearl', 27, 17, 29, 17); }
          else c.line('fa_bear.0', 27, 15, 29, 15);
          c.ell('fa_bear', 23, 10.4, 1.5, 1.5); c.px('fa_bear.0', 23, 10);                       // oreja
          c.px('eye', 26, 12); c.px('fa_bear.0', 25, 11);
        });
      });
    },
  };

  // ======================================================== JABALÍ 28×22
  U.animal_boar = {
    w: 28, h: 22, ax: 14, ay: 19, dead: true,
    render: { shadow: { cx: 13.5, cy: 20, rx: 9, ry: 1.5 } },
    draw(c, P, o) {
      if (o.dead) {
        pool(c, 14, 19.5, 7);
        sprawl(c, 'fa_boar', 'fa_hoof', 8, 17, 17, 4, 2, true);
        c.line('fa_boar', 4, 15, 2, 16); c.px('fa_bristle', 1, 16);
        c.ell('fa_boar', 12.5, 16, 8.5, 3.2); c.line('fa_bristle', 7, 13, 18, 13); c.px('fa_bristle', 10, 12); c.px('fa_bristle', 14, 12);
        sprawl(c, 'fa_boar', 'fa_hoof', 7, 17, 18, 4, 2);
        c.poly('fa_boar', [[19, 13], [22, 13], [26, 15], [26, 18], [21, 18]]); c.rect('fa_snout', 26, 15, 26, 17);
        c.line('fa_tusk', 24, 18, 25, 16); c.poly('fa_boar', [[19, 13], [20, 11], [21.5, 13]]); deadEye(c, 22, 14);
        return;
      }
      const b = P.body, t = P.t, k = P.atk, A = P.anim;
      const sn = A === 'idle' ? [0, 1, 0, 0][t] : 0;                         // resopla
      const hy = k === 1 ? 2 : k === 2 ? -1 : k === 3 ? 0 : sn;
      c.at([0, -1, 3, 2][k], 0, () => {
        leg(c, 'fa_boar.0', 9, 14 + b, 19, gait(P, .5, 1.5), 2, 'fa_hoof');
        leg(c, 'fa_boar.0', 16, 14 + b, 19, gait(P, .75, 1.5), 2, 'fa_hoof');
        c.at(0, b, () => {
          const tw = A === 'idle' ? [0, 1, 0, -1][t] : P.sw;
          c.line('fa_boar', 4, 9, 3, 12); c.px('fa_bristle', 3 + tw, 13); c.px('fa_bristle', 2 + tw, 13);  // rabo
          c.poly('fa_boar', [[4, 10], [8, 7], [14, 5], [19, 4], [22, 8], [22, 14], [18, 16], [7, 16], [4, 13]]);
          c.ell('fa_boar', 8, 12, 3.6, 3.8);
          // crin de cerdas
          for (let x = 9; x <= 20; x += 2) { c.px('fa_bristle', x, 4 + (x < 13 ? 2 : x < 17 ? 1 : 0) - 1); c.px('fa_bristle', x, 5 + (x < 13 ? 2 : x < 17 ? 1 : 0) - 1); }
          c.line('fa_bristle', 10, 6, 20, 4);
          c.px('fa_boar.0', 12, 12); c.px('fa_boar.0', 15, 11); c.px('fa_boar.2', 10, 9);
        });
        leg(c, 'fa_boar', 7, 14 + b, 19, gait(P, 0, 1.5), 2, 'fa_hoof');
        leg(c, 'fa_boar', 18, 14 + b, 19, gait(P, .25, 1.5), 2, 'fa_hoof');
        c.at(0, b + hy, () => {
          c.poly('fa_boar', [[19, 6], [22, 7], [25.5, 11], [25.5, 14], [21, 14], [18, 11]]);       // cabeza en cuña
          c.rect('fa_snout', 25, 11, 26, 13); c.px('fa_snout.0', 26, 12);                        // jeta
          c.poly('fa_boar', [[19, 7], [20, 4], [21.5, 7]]); c.px('fa_bristle', 20, 5);           // oreja
          c.line('fa_tusk', 23, 13, 24, 11); c.px('fa_tusk', 24, 10);                            // colmillo
          c.px('fa_eyeR', 22, 8); c.px('fa_bristle', 21, 8);
        });
      });
    },
  };

  // ===================================================================
  //  EFECTOS (ancla al centro; se reproducen una vez salvo el fuego)
  // ===================================================================
  // Color fijo con alfa creado al vuelo: C('#ffcc00', .6) -> nombre de material fijo
  const C = (hex, a = 1) => {
    const aa = Math.max(0, Math.min(255, Math.round(a * 255))).toString(16).padStart(2, '0'), n = 'fa_x' + hex.slice(1) + aa;
    if (!PE.FIXED[n]) PE.FIXED[n] = hex + aa;
    return n;
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const NOOL = { outline: false };
  // Halo radial (sólo sobre vacío)
  function halo(c, cx, cy, r, a, hex) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x + .5 - cx, y + .5 - cy) / r; if (d < 1) c.glow(x, y, a * (1 - d) ** 1.4, hex);
    }
  }
  // Destello en cruz de radio s (centro más claro opcional)
  function spark(c, m, x, y, s, mc) {
    for (let i = 1; i <= s; i++) { c.px(m, x + i, y); c.px(m, x - i, y); c.px(m, x, y + i); c.px(m, x, y - i); }
    c.px(mc || m, x, y);
  }
  // Bocanada redonda con luz arriba-izquierda: [claro, medio, oscuro]
  function puff(c, cx, cy, r, cols) {
    c.ell(cols[2], cx, cy, r, r);
    c.ell(cols[1], cx - r * .15, cy - r * .15, r * .85, r * .85);
    if (r > 1.6) c.ell(cols[0], cx - r * .35, cy - r * .4, r * .45, r * .45);
  }
  // Nube irregular: tres bocanadas solapadas
  function cloud(c, cx, cy, r, cols, seed = 0) {
    const o = rnd(seed) * TAU;
    puff(c, cx - r * .55, cy + r * .2, r * .7, cols); puff(c, cx + r * .55, cy + r * .25, r * .62, cols);
    puff(c, cx + Math.cos(o) * r * .15, cy - r * .25, r * .8, cols);
  }
  // Lengua de fuego: base (cx,by), ancho w, alto h, fase ph; capas de fuera hacia dentro
  const FIRE = ['#b52a26', '#ee6a28', '#ffae36', '#ffe27a', '#fff8dc'];
  function flame(c, cx, by, w, h, ph, a = 1) {
    for (let L = 0; L < 4; L++) {
      const hh = h * (1 - L * .2), ww = w * (1 - L * .24), m = C(FIRE[L + (L > 2 ? 1 : 0)], L === 0 ? .8 * a : a);
      for (let i = 0; i < hh; i++) {
        const ty = i / hh, half = ww / 2 * Math.pow(1 - ty, .85) * Math.min(1, (ty + .3) / .5);
        const off = Math.sin(ty * 3.4 + ph) * ty * w * .28;
        if (half < .3) continue;
        c.rect(m, Math.round(cx + off - half), by - i, Math.round(cx + off + half) - 1, by - i);
      }
    }
  }

  // ------------------------------------------------ fuego (bucle, 3 tamaños)
  const FIRE_SZ = [[10, 14], [14, 20], [20, 28]];
  FX.fx_fire = {
    frames: 4, variants: 3, render: NOOL, loop: true,
    w: o => FIRE_SZ[(o.v || 0) % 3][0], h: o => FIRE_SZ[(o.v || 0) % 3][1],
    draw(c, f, o) {
      const [W, H] = FIRE_SZ[(o.v || 0) % 3], ph = f * TAU / 4, by = H - 2;
      halo(c, W / 2, H * .62, W * .62, 70, '#ff8a2a');
      flame(c, W * .32, by, W * .45, H * (.55 + .08 * Math.sin(ph + 1)), ph + 2);
      flame(c, W * .7, by, W * .42, H * (.5 + .08 * Math.sin(ph + 3)), ph + 4);
      flame(c, W * .5, by, W * .62, H * (.78 + .07 * Math.sin(ph)), ph);
      c.rect(C('#ffe27a', .9), Math.round(W * .3), by, Math.round(W * .7) - 1, by);           // brasas
      c.rect(C('#b52a26', .7), Math.round(W * .2), by + 1, Math.round(W * .8) - 1, by + 1);
      for (let i = 0; i < 2 + (o.v || 0); i++) {                                                   // chispas que suben
        const x = Math.round(W * (.25 + .5 * rnd(i * 7 + 1)) + Math.sin(f + i) * 1.2), y = Math.round(((H * .35 - ((f + i * 2) % 4) * H * .1) + H) % (H * .5));
        c.px(C(i % 2 ? '#ffe27a' : '#ffae36'), x, y);
      }
    },
  };

  // ------------------------------------------------ humo (6)
  FX.fx_smoke = {
    w: 16, h: 20, frames: 6, render: NOOL,
    draw(c, f) {
      const a = [.92, .9, .8, .65, .45, .25][f], cols = [C('#ece6ef', a), C('#aea6ba', a), C('#746c84', a)];
      [[8, 15, 3.2], [5, 13, 2.6], [11, 12.5, 2.8], [8, 10.5, 2.4]].forEach(([x, y, r], i) => {
        const yy = y - f * 1.5 - i * .3, rr = r * (.75 + f * .14);
        puff(c, x + Math.sin(f * .8 + i * 2) * .9, yy, rr, cols);
      });
    },
  };

  // ------------------------------------------------ explosión (6, 32×32)
  FX.fx_explosion = {
    w: 32, h: 32, frames: 6, render: NOOL,
    draw(c, f) {
      const cx = 16, cy = 17;
      if (f === 0) {
        halo(c, cx, cy, 13, 120, '#ffd27a');
        c.ell(C('#ffae36'), cx, cy, 6, 5.5); c.ell(C('#ffe27a'), cx, cy, 4.6, 4.2); c.ell(C('#fff8dc'), cx, cy, 3, 2.8);
        for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + .3; c.line(C('#ffe27a', .9), cx + Math.cos(an) * 6, cy + Math.sin(an) * 6, cx + Math.cos(an) * 10, cy + Math.sin(an) * 10); }
        return;
      }
      if (f <= 2) {     // bola de fuego
        const r = f === 1 ? 10 : 11.5;
        halo(c, cx, cy, r + 4, 80, '#ff8a2a');
        for (let i = 0; i < 9; i++) { const an = i * TAU / 9 + f, rr = r * (.55 + .2 * rnd(i + f * 9)); c.ell(C('#b52a26', .9), cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * .9, 3.6, 3.4); }
        c.ell(C('#ee6a28'), cx, cy, r * .82, r * .76);
        for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + f * .7, rr = r * .45; c.ell(C('#ffae36'), cx + Math.cos(an) * rr, cy + Math.sin(an) * rr, 2.8, 2.6); }
        c.ell(C('#ffae36'), cx, cy, r * .5, r * .45); c.ell(C('#ffe27a'), cx - 1, cy - 1, r * .34, r * .3);
        if (f === 1) c.ell(C('#fff8dc'), cx - 1, cy - 1, 2.2, 2);
        else { c.ell(C('#5e5870', .8), cx + 3, cy - 7, 3, 2.5); c.ell(C('#5e5870', .8), cx - 5, cy - 6, 2.6, 2.2); }
      } else {          // humo que se abre, brasas y escombros
        const k = f - 3, a = [.9, .7, .45][k], R = 9 + k * 2.4;
        for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8 + .4, rr = R * (.7 + .25 * rnd(i * 3 + k));
          puff(c, cx + Math.cos(an) * rr * .9, cy - 2 - k * 1.5 + Math.sin(an) * rr * .7, 3.6 + k * .6, [C('#a49cb0', a), C('#6e6680', a), C('#4a4458', a)]);
        }
        if (k < 2) { c.ell(C('#ee6a28', a), cx, cy - k, 4 - k * 1.5, 3.5 - k); c.ell(C('#ffae36', a), cx, cy - k, 2 - k, 1.8 - k * .5); }
        for (let i = 0; i < 7; i++) {                                                              // escombros
          const an = i * TAU / 7 + 1, d = 9 + k * 4 + rnd(i) * 3, x = cx + Math.cos(an) * d, y = cy + Math.sin(an) * d * .8 + k * k;
          c.px(C(i % 3 ? '#3e3438' : '#ffae36', k === 2 ? .7 : 1), x, y); if (i % 2) c.px(C('#3e3438', .8), x + 1, y);
        }
      }
    },
  };

  // ------------------------------------------------ curación (6): cruces verdes que suben
  FX.fx_heal = {
    w: 16, h: 24, frames: 6, render: NOOL,
    draw(c, f) {
      const fade = f < 4 ? 1 : f === 4 ? .7 : .35;
      c.ring(C('#7dff8a', .55 * fade), 8, 20.5, 6.5 - (f > 3 ? 0 : 3 - f), 2.2, .45);                 // anillo de base
      halo(c, 8, 14, 9, 50 * fade, '#9dffa8');
      const cross = (x, y, s, a) => { const m = C('#9dffa8', a), m2 = C('#effff0', a); c.rect(m, x - s, y, x + s, y); c.rect(m, x, y - s, x, y + s); c.px(m2, x, y); if (s > 1) { c.rect(m, x - s, y + 1, x + s, y + 1); c.rect(m, x + 1, y - s, x + 1, y + s); c.px(m2, x + 1, y); c.px(m2, x, y + 1); c.px(m2, x + 1, y + 1); } };
      [[8, 0, 2], [4, 2, 1], [12, 3, 1], [6, 4, 1]].forEach(([x, d, s], i) => {
        const y = 19 - (f - d * .4) * 3.2;
        if (f >= d * .6 && y > 0) cross(Math.round(x + Math.sin(f + i) * .6), Math.round(y), s, fade * (y < 5 ? .6 : 1));
      });
      for (let i = 0; i < 5; i++) { const x = 2 + rnd(i) * 12, y = 20 - ((f * 3 + i * 4) % 18); c.px(C('#effff0', fade), x, y); }
    },
  };

  // ------------------------------------------------ escarcha (6): esquirlas de hielo
  FX.fx_frost = {
    w: 24, h: 24, frames: 6, render: NOOL,
    draw(c, f) {
      const cx = 12, cy = 12, a = f < 4 ? 1 : f === 4 ? .65 : .3, R = [3, 6, 8, 9, 9.5, 10][f];
      halo(c, cx, cy, R + 3, 60 * a, '#bfefff');
      if (f < 3) { c.ell(C('#e8fbff', .9 * a), cx, cy, 3.5 - f, 3.5 - f); }
      for (let i = 0; i < 8; i++) {                                                                // cristales radiales
        const an = i * TAU / 8 + (i % 2) * .2, L = R * (i % 2 ? .7 : 1), x1 = cx + Math.cos(an) * L, y1 = cy + Math.sin(an) * L;
        const x0 = cx + Math.cos(an) * L * .35, y0 = cy + Math.sin(an) * L * .35;
        c.line(C('#5ab0e8', .9 * a), x0, y0, x1, y1); c.line(C('#a8e4ff', a), x0, y0 - (Math.abs(Math.sin(an)) < .5 ? 1 : 0), x1, y1 - (Math.abs(Math.sin(an)) < .5 ? 1 : 0));
        c.px(C('#f4feff', a), Math.round(x1), Math.round(y1));
      }
      if (f >= 1 && f <= 4) for (let i = 0; i < 5; i++) {                                         // esquirlas en rombo
        const an = i * TAU / 5 + .6, d = 3 + f * 2, x = cx + Math.cos(an) * d, y = cy + Math.sin(an) * d;
        c.poly(C('#a8e4ff', a), [[x - 1.5, y], [x, y - 2], [x + 1.5, y], [x, y + 2]]); c.px(C('#f4feff', a), Math.round(x - .5), Math.round(y - 1));
      }
      for (let i = 0; i < 6; i++) {                                                                // copos
        const an = i * 1.7 + f * .3, d = R * .9 + 2 + rnd(i) * 2;
        if (f > 0) spark(c, C('#d8f6ff', a * .9), Math.round(cx + Math.cos(an) * d), Math.round(cy + Math.sin(an) * d), f > 2 && i % 2 ? 0 : 1, C('#ffffff', a));
      }
    },
  };

  // ------------------------------------------------ rayo (4, 16×48)
  function bolt(c, x0, y0, y1, seed, w, cols, branch) {
    let x = x0, pts = [[x, y0]];
    for (let y = y0; y < y1;) { const st = 3 + Math.floor(rnd(seed + y) * 4); y = Math.min(y1, y + st); x = Math.max(2, Math.min(13, x + Math.round((rnd(seed * 3 + y) - .5) * 7))); pts.push([x, y]); }
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      if (w > 1) { c.line(cols[0], ax - 1, ay, bx - 1, by); c.line(cols[0], ax + 1, ay, bx + 1, by); }
      c.line(cols[1], ax, ay, bx, by);
      if (branch && i % 3 === 1) { const d = rnd(seed + i) > .5 ? 1 : -1; c.line(cols[0], bx, by, bx + d * 4, by + 5); c.line(cols[0], bx + d * 4, by + 5, bx + d * 5, by + 8); }
    }
    return pts;
  }
  FX.fx_lightning = {
    w: 16, h: 48, frames: 4, render: NOOL,
    draw(c, f) {
      const a = [1, .9, .7, .35][f];
      halo(c, 8, 42, 9, [140, 110, 80, 40][f], '#bfe8ff');
      if (f < 3) { halo(c, 8, 24, 10, [50, 40, 20][f], '#bfe8ff'); bolt(c, 8, 0, 44, f === 1 ? 7 : 3, f < 2 ? 2 : 1, [C('#7fc8ff', .75 * a), C(f === 2 ? '#bfe8ff' : '#ffffff', a)], f < 2); }
      c.ell(C('#bfe8ff', .8 * a), 8, 44.5, 5 - f, 1.6); c.ell(C('#ffffff', a), 8, 44.5, 2.5 - f * .5, 1);
      for (let i = 0; i < 5; i++) { const an = Math.PI + i * Math.PI / 4 + f * .2, d = 3 + f * 2; c.px(C('#ffffff', a), 8 + Math.cos(an) * d, 44 + Math.sin(an) * d * .7); }
    },
  };

  // ------------------------------------------------ magia (6): runa púrpura que converge y estalla
  FX.fx_magic = {
    w: 24, h: 24, frames: 6, render: NOOL,
    draw(c, f) {
      const cx = 12, cy = 12, a = f < 4 ? 1 : f === 4 ? .6 : .3;
      halo(c, cx, cy, 10, (f === 3 ? 110 : 60) * a, '#d07aff');
      if (f < 3) {        // partículas en espiral hacia el centro
        for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + f * .9, d = 10 - f * 3; c.px(C('#f0c8ff', a), cx + Math.cos(an) * d, cy + Math.sin(an) * d); c.px(C('#b04aff', .8 * a), cx + Math.cos(an - .25) * (d + 1), cy + Math.sin(an - .25) * (d + 1)); }
        c.ring(C('#b04aff', .7), cx, cy, 4 + f, 4 + f, .7);
        c.ell(C('#e8a8ff'), cx, cy, 1.5 + f * .6, 1.5 + f * .6); c.px(C('#ffffff'), cx, cy);
      } else {            // estallido en estrella
        const k = f - 3, r = 3 + k * 3;
        if (k === 0) { spark(c, C('#e8a8ff'), cx, cy, 6, C('#ffffff')); spark(c, C('#ffffff'), cx, cy, 2); c.ell(C('#d07aff', .8), cx, cy, 2.6, 2.6); c.ell(C('#ffffff'), cx, cy, 1.5, 1.5); }
        else c.ring(C('#d07aff', .7 * a), cx, cy, r + 1, r + 1, .8);
        for (let i = 0; i < 8; i++) {                                                               // chispas que se dispersan
          const an = i * TAU / 8 + .2, d = r + 2 + (i % 2) * 2, x = Math.round(cx + Math.cos(an) * d), y = Math.round(cy + Math.sin(an) * d);
          if (i % 2) c.px(C('#f0c8ff', a), x, y); else spark(c, C('#b04aff', .9 * a), x, y, k < 2 ? 1 : 0, C('#ffffff', a));
        }
      }
    },
  };

  // ------------------------------------------------ subida de nivel (8): anillo de destellos dorados
  FX.fx_levelup = {
    w: 24, h: 32, frames: 8, render: NOOL,
    draw(c, f) {
      const cx = 12, a = f < 6 ? 1 : f === 6 ? .6 : .3, ry = 3.2, rx = 9;
      const cy = 27 - f * 2.4;                                                                     // el anillo sube
      halo(c, cx, cy, 11, 50 * a, '#ffe98a');
      for (let i = 0; i < 4; i++) { const x = 4 + i * 5 + (i % 2), y0 = 29 - f * 3 - i * 2; c.line(C('#fff3b0', .45 * a), x, y0, x, y0 + 4); }   // estelas
      c.ring(C('#e2b237', .6 * a), cx, cy, rx, ry, .72, (x, y) => y > cy - 1);                    // mitad delantera
      for (let i = 0; i < 8; i++) {
        const an = i * TAU / 8 + f * .45, x = Math.round(cx + Math.cos(an) * rx), y = Math.round(cy + Math.sin(an) * ry);
        const front = Math.sin(an) > 0, big = (i + f) % 3 === 0;
        spark(c, C(front ? '#ffd84a' : '#c8902a', a * (front ? 1 : .7)), x, y, big ? 2 : 1, C('#fffbe6', a));
      }
      if (f >= 5) spark(c, C('#ffe98a', a), cx, cy - 4, 3, C('#ffffff', a));
    },
  };

  // ------------------------------------------------ polvo (4)
  FX.fx_dust = {
    w: 16, h: 12, frames: 4, render: NOOL,
    draw(c, f) {
      const a = [.8, .7, .5, .25][f], cols = [C('#e8d8b4', a), C('#c4ab80', a), C('#9a8060', a)];
      cloud(c, 8, 8 - f * .6, 2.6 + f * .7, cols, 3);
      if (f) { puff(c, 3 - f * .5, 9, 1.2 + f * .3, cols); puff(c, 13 + f * .5, 9, 1.1 + f * .3, cols); }
    },
  };

  // ------------------------------------------------ salpicadura (4)
  FX.fx_splash = {
    w: 16, h: 16, frames: 4, render: NOOL,
    draw(c, f) {
      const W1 = C('#e8f6ff'), W2 = C('#8ccfff', .9), W3 = C('#3d7fd0', .7);
      c.ring(f < 2 ? W2 : C('#8ccfff', .6), 8, 13, 3 + f * 1.5, 1 + f * .4, .55);
      if (f === 0) { c.rect(W2, 7, 7, 8, 12); c.rect(W1, 7, 8, 7, 11); c.px(W1, 8, 6); }
      if (f === 1) { c.line(W2, 5, 12, 3, 7); c.line(W2, 11, 12, 13, 7); c.line(W1, 7, 11, 7, 5); c.line(W2, 9, 11, 9, 6); c.px(W1, 3, 6); c.px(W1, 13, 6); c.px(W1, 7, 4); }
      if (f === 2) { [[2, 7], [14, 7], [6, 4], [10, 5], [8, 3]].forEach(([x, y]) => { c.px(W1, x, y + 1); c.px(W2, x, y + 2); }); c.rect(W3, 6, 12, 10, 12); }
      if (f === 3) { [[2, 10], [14, 10], [6, 8], [10, 9]].forEach(([x, y]) => c.px(W2, x, y + 1)); }
    },
  };

  // ------------------------------------------------ sangre (4)
  FX.fx_blood = {
    w: 12, h: 12, frames: 4, render: NOOL,
    draw(c, f) {
      const B1 = C('#d8323a'), B2 = C('#8c1a26', .95), a = f === 3 ? .55 : 1;
      if (f === 0) { c.ell(B2, 6, 6, 2, 2); c.px(B1, 5, 5); c.px(B1, 6, 5); }
      for (let i = 0; i < 6; i++) {
        const an = i * TAU / 6 - .6 + rnd(i) * .5, d = f * 1.8 + 1, x = 6 + Math.cos(an) * d, y = 6 + Math.sin(an) * d + f * f * .35;
        if (f > 0) { c.px(C('#8c1a26', a), x, y); if (i % 2 === 0 && f < 3) c.px(C('#d8323a', a), x - Math.cos(an), y - Math.sin(an)); }
      }
    },
  };

  // ------------------------------------------------ construcción (4): polvo, astillas y chispa de martillo
  FX.fx_build = {
    w: 24, h: 16, frames: 4, render: NOOL,
    draw(c, f) {
      const a = [.8, .75, .55, .3][f], cols = [C('#e8d8b4', a), C('#c4ab80', a), C('#9a8060', a)];
      cloud(c, 6 - f, 12 - f * .5, 2.4 + f * .5, cols, 1); cloud(c, 18 + f, 12 - f * .5, 2.3 + f * .5, cols, 2); cloud(c, 12, 11 - f, 2 + f * .4, cols, 5);
      for (let i = 0; i < 4; i++) {                                                                 // astillas
        const d = i < 2 ? -1 : 1, x = 12 + d * (2 + f * 2 + i % 2 * 2), y = 9 - f * 2 + f * f * .6 - (i % 2) * 2;
        c.rect(C('#d8a868', f === 3 ? .6 : 1), x, y, x + 1, y); c.rect(C('#7a5230', f === 3 ? .6 : 1), x, y + 1, x + 1, y + 1);
      }
      if (f < 2) spark(c, C('#ffe98a'), 12, 6 - f, 2 - f, C('#ffffff'));
    },
  };

  // ------------------------------------------------ pisotón (6): onda de choque en el suelo
  FX.fx_stomp = {
    w: 32, h: 16, frames: 6, render: NOOL,
    draw(c, f) {
      const a = [1, .9, .8, .6, .4, .2][f], rx = 3 + f * 2.6, ry = 1.2 + f * .8;
      c.ring(C('#6e5638', .8 * a), 16, 11, rx + 1, ry + .7, .5);
      c.ring(C('#f0e2c0', .95 * a), 16, 11, rx, ry, .62, (x, y) => y < 11);
      if (f > 0 && f < 5) for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + .3, d = rx * .5; c.line(C('#4a3a28', .7 * a), 16 + Math.cos(an) * 1.5, 11 + Math.sin(an) * .6, 16 + Math.cos(an) * d, 11 + Math.sin(an) * d * ry / rx); }   // grietas
      if (f < 2) { c.ell(C('#fff3c8', .8), 16, 11, 3 - f, 1.2); }
      for (let i = 0; i < 6; i++) {                                                                 // piedras que saltan
        const d = i < 3 ? -1 : 1, x = 16 + d * (3 + (i % 3) * 2 + f * 1.8), y = 10 - (i % 3 + 1) * f * 1.2 + f * f * .45;
        if (f > 0 && y < 13) { c.px(C('#7d7a78', a > .3 ? 1 : .6), x, y); if (i % 3 === 0) c.px(C('#5a5250', a > .3 ? 1 : .6), x + 1, y); }
      }
      if (f > 1) { const cols = [C('#e8d8b4', a * .7), C('#c4ab80', a * .7), C('#9a8060', a * .7)]; puff(c, 16 - rx, 10 - f * .3, 1.6 + f * .3, cols); puff(c, 16 + rx, 10 - f * .3, 1.6 + f * .3, cols); }
    },
  };

  // ===================================================================
  //  PROYECTILES (apuntan a la DERECHA; el motor los rota)
  // ===================================================================
  // Dibuja en un lienzo auxiliar cuadrado y lo copia girado f×90° (giro horario)
  function spin(c, f, fn) {
    const t = new PE.SCanvas(c.w, c.h); fn(t);
    const n = c.w;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const m = t.g[y * n + x]; if (m === null) continue;
      let X = x, Y = y;
      for (let k = 0; k < (f & 3); k++) { const nx = n - 1 - Y; Y = X; X = nx; }
      c.px(m, X, Y);
    }
  }
  PE.addMats({ fa_fletch: '#e4dccb' });

  PE.ART.fx.proj_arrow = {
    w: 14, h: 5, frames: 1,
    draw(c) {
      c.line('wood', 2, 2, 10, 2);
      c.rect('steel', 10, 1, 11, 3); c.px('steel', 12, 2); c.px('steel.3', 10, 1);
      c.rect('fa_fletch', 1, 1, 3, 1); c.rect('fa_fletch', 1, 3, 3, 3); c.px('red', 2, 1); c.px('red', 2, 3);
    },
  };
  PE.ART.fx.proj_bolt = {
    w: 10, h: 5, frames: 1,
    draw(c) {
      c.line('darkwood', 2, 2, 6, 2);
      c.rect('iron', 6, 1, 7, 3); c.px('iron', 8, 2); c.px('iron.3', 6, 1);
      c.px('leather', 1, 1); c.px('leather', 2, 1); c.px('leather', 1, 3); c.px('leather', 2, 3);
    },
  };
  PE.ART.fx.proj_spear = {
    w: 20, h: 5, frames: 1,
    draw(c) {
      c.line('wood', 1, 2, 13, 2); c.px('wood.0', 4, 2); c.px('wood.0', 8, 2);
      c.px('leather', 12, 2); c.px('leather', 12, 1); c.px('leather', 12, 3);
      c.rect('steel', 13, 1, 16, 3); c.rect('steel', 17, 2, 18, 2); c.line('steel.3', 13, 1, 16, 1); c.line('steel.0', 14, 3, 16, 3);
    },
  };
  PE.ART.fx.proj_rock = {
    w: 10, h: 10, frames: 4,
    draw(c, f) {
      spin(c, f, t => {
        t.poly('rock', [[1.5, 4.5], [3, 2], [6, 1.5], [8.6, 3.4], [8.4, 6.6], [6.4, 8.6], [3, 8.4], [1.5, 6.6]]);
        t.poly('rock.2', [[2.5, 4.5], [3.6, 2.6], [6, 2.4], [5, 4.6]]); t.px('rock.3', 4, 3);
        t.line('rock.0', 5, 5, 7, 7); t.line('rock.0', 5, 5, 3, 7); t.px('rock.0', 6, 4);
      });
    },
  };
  PE.ART.fx.proj_axe = {
    w: 12, h: 12, frames: 4,
    draw(c, f) {
      spin(c, f, t => {
        t.line('wood', 2, 9, 7, 4); t.line('wood.0', 3, 9, 7, 5);
        t.poly('blade', [[5.5, 3], [8.6, .6], [11.4, 3.4], [9, 6.4]]);
        t.line('blade.3', 9, 1, 11, 3); t.px('blade.3', 10, 4); t.px('steel.0', 7, 3); t.px('steel.0', 8, 4); t.px('iron', 6, 4); t.px('iron', 7, 5);
      });
    },
  };
  PE.ART.fx.proj_cannonball = {
    w: 12, h: 8, frames: 1,
    draw(c) {
      c.ell(C('#a49cb0', .35), 2.5, 4, 2.5, 1.6); c.ell(C('#c8c0d0', .55), 4.5, 4, 2, 1.8);
      c.ell('iron', 8, 4, 2.6, 2.6); c.px('iron.3', 7, 3); c.px('iron.2', 8, 3); c.px('iron.0', 9, 5);
    },
  };
  PE.ART.fx.proj_fireball = {
    w: 16, h: 10, frames: 4, render: NOOL,
    draw(c, f) {
      const ph = f * TAU / 4;
      halo(c, 10.5, 5, 6, 80, '#ff8a2a');
      for (let i = 0; i < 3; i++) {                                                                  // estela de llamas
        const y = 5 + Math.sin(ph + i * 2.1) * 1.2, x0 = 9 - i, L = 6 + ((f + i) % 3);
        c.line(C(FIRE[1], .9), x0, y, x0 - L, y + Math.sin(ph + i) * .8); c.line(C(FIRE[0], .7), x0 - 1, y + 1, x0 - L + 1, y + 1);
        if (i === 1) c.line(C(FIRE[2]), x0, y, x0 - L + 3, y);
      }
      c.ell(C(FIRE[0], .9), 10.5, 5, 3.6, 3.4); c.ell(C(FIRE[1]), 10.7, 5, 3, 2.8); c.ell(C(FIRE[2]), 11, 4.8, 2.2, 2);
      c.ell(C(FIRE[3]), 11.3, 4.6, 1.4, 1.3); c.px(C(FIRE[4]), 11, 4);
      for (let i = 0; i < 3; i++) c.px(C(i % 2 ? FIRE[3] : FIRE[2]), 1 + ((f * 2 + i * 3) % 6), 3 + ((i * 3 + f) % 5));   // pavesas
    },
  };
  PE.ART.fx.proj_magic = {
    w: 14, h: 10, frames: 4, render: NOOL,
    draw(c, f) {
      halo(c, 9, 5, 5.5, 90, '#d07aff');
      for (let i = 0; i < 4; i++) {                                                                  // estela de chispas
        const x = 6 - i * 1.6 - (f % 2), y = 5 + Math.sin(f * 1.6 + i * 1.9) * 2;
        if (i % 2) c.px(C('#f0c8ff', 1 - i * .18), x, y); else spark(c, C('#b04aff', .85 - i * .15), Math.round(x), Math.round(y), 1, C('#f0c8ff'));
      }
      c.ell(C('#8a3ad8', .9), 9, 5, 2.8, 2.8); c.ell(C('#d07aff'), 9, 5, 2, 2); c.ell(C('#f6e0ff'), 9.3, 4.7, 1.1, 1.1);
      const r = f % 2 ? 4 : 3; c.px(C('#ffffff', .9), 9 + r, 5); c.px(C('#ffffff', .9), 9, 5 - r); c.px(C('#ffffff', .9), 9, 5 + r);
    },
  };
  PE.ART.fx.proj_lightning = {
    w: 20, h: 8, frames: 2, render: NOOL,
    draw(c, f) {
      halo(c, 10, 4, 9, 50, '#bfe8ff');
      const ys = f ? [4, 3, 5, 2, 4, 5, 3, 4] : [4, 5, 2, 4, 6, 3, 5, 4], xs = [1, 3, 6, 8, 10, 13, 15, 18];
      for (let i = 0; i < ys.length - 1; i++) {
        const x0 = xs[i], x1 = xs[i + 1];
        c.line(C('#7fc8ff', .8), x0, ys[i] - 1, x1, ys[i + 1] - 1); c.line(C('#7fc8ff', .8), x0, ys[i] + 1, x1, ys[i + 1] + 1);
        c.line(C('#ffffff'), x0, ys[i], x1, ys[i + 1]);
      }
      c.ell(C('#ffffff'), 18.5, 4, 1.4, 1.4); c.px(C('#7fc8ff'), 7 + f * 3, f ? 0 : 7);
    },
  };
  PE.ART.fx.proj_frost = {
    w: 14, h: 10, frames: 4, render: NOOL,
    draw(c, f) {
      halo(c, 9, 5, 5.5, 70, '#bfefff');
      for (let i = 0; i < 4; i++) {                                                                  // escarcha que se desprende
        const x = 5 - i * 1.4, y = 5 + ((i + f) % 2 ? -1 : 1) * (1 + (i % 2));
        if ((i + f) % 3) c.px(C('#e8fbff', .9 - i * .15), x, y); else spark(c, C('#a8e4ff', .8 - i * .12), Math.round(x), Math.round(y), 1, C('#ffffff'));
      }
      c.poly(C('#4a90c8'), [[5, 5], [8.5, 2.5], [13, 5], [8.5, 7.5]]);
      c.poly(C('#a8e4ff'), [[6, 5], [8.5, 3.3], [12, 5]]); c.poly(C('#6cb8e8'), [[6, 5], [12, 5], [8.5, 6.7]]);
      c.line(C('#f4feff'), 7, 4, 9, 3); c.px(C('#ffffff'), 12, 5);
    },
  };

  // ===================================================================
  //  ÍCONOS (render sin sombra): recursos/estadísticas 12×12,
  //  insignias de nivel ≤11×8, comandos 16×16
  // ===================================================================
  PE.addMats({
    fa_logend: '#dcb27a', fa_meat: '#cc553c', fa_ingot: '#5b6c8c', fa_istone: '#a29d94', fa_xp: '#58d0ee',
    fa_bronze: '#c47a3c', fa_ruby: '#dc2a40', fa_up: '#5cc23e', fa_stop: '#d23a32', fa_glass: '#cfe6ee',
    fa_paper: '#eadcb6', fa_potion: '#d8304a', fa_ui: '#e6e1d6', fa_yarn: '#c9506e', fa_magic: '#b65cff',
  });
  const ICON = { shadow: false };
  const icon = (w, draw) => ({ w, h: w, frames: 1, render: ICON, draw });

  // --- piezas reutilizables (x,y = origen; s = escala 12/16)
  function sword(c, x, y, L) {                   // guarda centrada en (x,y); hoja de 2 px en diagonal arriba-derecha
    for (let i = 1; i <= L; i++) { c.px('blade.3', x + i, y - i); if (i < L) c.px('blade', x + i + 1, y - i); if (i < L - 1) c.px('blade.0', x + i + 1, y - i + 1); }
    for (let i = -2; i <= 2; i++) c.px(i ? 'gold' : 'gold.3', x + i, y + i);
    c.px('leather', x - 1, y + 1); c.px('leather.0', x - 2, y + 2); c.px('gold', x - 3, y + 3);
  }
  function upArrow(c) {                          // flecha verde de mejora (abajo a la derecha)
    c.poly('fa_up', [[9.5, 11.5], [12.5, 8.5], [15.5, 11.5]]); c.rect('fa_up', 11, 11, 13, 14); c.px('fa_up.3', 12, 9);
  }
  function hammer(c, x, y, s = 1) {              // martillo: mango diagonal y cabeza de hierro
    c.line('wood', x, y, x + 5 * s, y - 5 * s); c.line('wood.0', x + 1, y, x + 5 * s, y - 4 * s);
    c.poly('iron', [[x + 3 * s, y - 7 * s], [x + 5 * s, y - 9 * s], [x + 9 * s, y - 5 * s], [x + 7 * s, y - 3 * s]]);
    c.px('iron.3', x + 5 * s, y - 8 * s);
  }
  function bow(c, ox, oy) {                      // arco tenso (madera de 2 px) con flecha horizontal (12×12)
    const P = (m, pts) => pts.forEach(([x, y]) => c.px(m, ox + x, oy + y));
    c.line('string', ox + 3, oy + 1, ox + 1, oy + 5); c.line('string', ox + 1, oy + 6, ox + 3, oy + 10);
    P('wood', [[3, 1], [4, 1], [4, 2], [5, 2], [5, 3], [6, 3], [6, 4], [7, 4], [6, 5], [7, 5], [6, 6], [7, 6], [6, 7], [7, 7], [5, 8], [6, 8], [4, 9], [5, 9], [3, 10], [4, 10]]);
    P('wood.3', [[3, 1], [4, 2], [5, 3], [6, 4]]); P('leather', [[6, 6], [7, 6], [6, 7], [7, 7]]);
    c.line('fa_ui', ox + 1, oy + 5, ox + 8, oy + 5);
    c.poly('steel', [[ox + 8.5, oy + 3.5], [ox + 11, oy + 5.5], [ox + 8.5, oy + 7.5]]);
    P('red', [[0, 4], [1, 4], [0, 6], [1, 6]]);
  }
  function boot(c, ox, oy) {                     // bota alada
    c.poly('fa_ui', [[ox + .5, oy + 1.5], [ox + 4.5, oy + 2.6], [ox + 4.5, oy + 6.5], [ox + 2, oy + 6], [ox + .5, oy + 4]]);
    c.line('fa_ui.0', ox + 1, oy + 3, ox + 4, oy + 4); c.line('fa_ui.0', ox + 2, oy + 5, ox + 4, oy + 5);
    c.rect('leather', ox + 5, oy + 1, ox + 8, oy + 7); c.poly('leather', [[ox + 5, oy + 6.5], [ox + 9, oy + 6.5], [ox + 11, oy + 8], [ox + 11, oy + 10], [ox + 5, oy + 10]]);
    c.rect('leather.0', ox + 5, oy + 10, ox + 10, oy + 10); c.rect('gold', ox + 5, oy + 1, ox + 8, oy + 1); c.line('leather.3', ox + 6, oy + 2, ox + 6, oy + 6);
  }
  function wallSeg(c, x0, y0, x1, y1) {          // muro de piedra con almenas
    c.rect('stone', x0, y0 + 2, x1, y1);
    for (let x = x0; x <= x1; x += 3) c.rect('stone', x, y0, Math.min(x + 1, x1), y0 + 1);
    for (let y = y0 + 4; y <= y1; y += 3) { c.line('stone.0', x0, y, x1, y); for (let x = x0 + ((y / 3) & 1 ? 1 : 3); x < x1; x += 4) c.px('stone.0', x, y - 1); }
  }

  // ------------------------------------------------ recursos y estadísticas 12×12
  IC.icon_wood = icon(12, c => {               // dos troncos de perfil con la testa veteada a la derecha
    const log = (x0, x1, y) => {
      c.rect('wood', x0, y, x1, y + 3); c.line('wood.2', x0, y, x1, y); c.line('wood.0', x0, y + 3, x1, y + 3);
      c.line('wood.0', x0 + 2, y + 1, x0 + 3, y + 1);
      c.rect('fa_logend.2', x1, y, x1 + 2, y + 3); c.px(null, x1 + 2, y); c.px(null, x1 + 2, y + 3); c.px('fa_logend.1', x1 + 2, y + 2);
      c.px('fa_logend.0', x1 + 1, y + 1); c.px('fa_logend.0', x1 + 1, y + 2); c.px('fa_logend.3', x1, y);
    };
    log(3, 7, 2); log(1, 6, 6); c.px('leaf', 4, 1); c.px('leaf', 5, 1);
  });
  IC.icon_food = icon(12, c => {               // muslo asado
    c.poly('fa_meat', [[1.5, 5], [3.5, 1.8], [7, 1.5], [8.6, 4], [7.6, 7.4], [4.6, 8.4], [2, 7.6]]);
    c.px('fa_meat.3', 4, 3); c.px('fa_meat.2', 5, 3); c.px('fa_meat.0', 6, 6); c.px('fa_meat.0', 3, 6);
    c.line('bone', 7, 7, 9, 9); c.line('bone', 8, 7, 9, 8); c.rect('bone', 9, 9, 10, 10); c.px('bone', 10, 8); c.px('bone', 8, 10);
  });
  IC.icon_gold = icon(12, c => {               // pepitas de oro con destello
    c.poly('gold', [[1.5, 9.5], [2.5, 6.6], [4.6, 6], [5.6, 8], [5, 10.4], [2.4, 10.5]]);
    c.poly('gold', [[6, 10.5], [6.4, 7.4], [8.6, 6.6], [10.6, 8.4], [10, 10.5]]);
    c.poly('gold', [[3.5, 6.6], [4.6, 3.4], [7.4, 3], [8.6, 5.6], [7.4, 7.6], [4.6, 7.6]]);
    c.px('gold.3', 5, 4); c.px('gold.3', 3, 7); c.px('gold.3', 7, 8); c.px('gold.0', 7, 6);
    c.px('white', 9, 2); c.px('glowY', 8, 2); c.px('glowY', 10, 2); c.px('glowY', 9, 1); c.px('glowY', 9, 3);
  });
  IC.icon_stone = icon(12, c => {              // peñascos grises con facetas
    c.ell('fa_istone', 7.6, 5, 3, 3);
    c.ell('fa_istone', 4.2, 7.6, 3.4, 3); c.ell('fa_istone', 8.6, 8.6, 2.4, 2);
    c.line('fa_istone.0', 6, 10, 7, 7); c.line('fa_istone.0', 6, 5, 8, 4.4); c.px('fa_istone.0', 9, 6);
    c.px('fa_istone.3', 3, 6); c.px('fa_istone.3', 6, 3); c.px('fa_istone.3', 8, 7); c.px('fa_istone.0', 3, 9);
  });
  IC.icon_iron = icon(12, c => {               // lingotes de hierro azulado (cara superior clara)
    const ingot = (x, y) => {
      c.rect('fa_ingot.3', x + 2, y, x + 6, y); c.rect('fa_ingot.2', x + 1, y + 1, x + 7, y + 1);
      c.rect('fa_ingot', x, y + 2, x + 8, y + 2); c.rect('fa_ingot.0', x, y + 3, x + 8, y + 3); c.px('fa_ingot.0', x + 8, y + 2);
    };
    ingot(2, 2); ingot(1, 6); c.px('white', 4, 6);
  });
  IC.icon_pop = icon(12, c => {                // dos personas (población)
    c.ell('skin.0', 8.5, 3, 1.8, 1.8); c.ell('team.0', 8.5, 8.6, 2.6, 2.8);
    c.rect('team', 1, 7, 7, 10); c.ell('team', 4, 7.4, 3.2, 2); c.ell('skin', 4, 3.6, 2.2, 2.3); c.px('hair', 3, 1); c.rect('hair', 2, 2, 5, 2);
  });
  IC.icon_attack = icon(12, c => sword(c, 3, 8, 7));
  IC.icon_armor = icon(12, c => {              // escudo de acero
    c.poly('steel', [[1.5, 1.5], [10.5, 1.5], [10.5, 5.5], [6, 10.5], [1.5, 5.5]]);
    c.poly('silver', [[3, 3], [9, 3], [9, 5.4], [6, 8.6], [3, 5.4]]); c.line('steel', 6, 2, 6, 9); c.line('steel', 2, 4, 10, 4);
  });
  IC.icon_parmor = icon(12, c => {             // rodela de cuero con flecha clavada
    c.ell('leather', 5.5, 6.5, 4.6, 4.6); c.ring('iron', 5.5, 6.5, 4.6, 4.6, .7); c.ell('iron', 5.5, 6.5, 1.3, 1.3); c.px('iron.3', 5, 6);
    c.line('fa_ui', 7, 5, 10, 2); c.px('red', 10, 1); c.px('red', 11, 2); c.px('red', 11, 1);
  });
  IC.icon_range = icon(12, c => bow(c, 0, 0));
  IC.icon_speed = icon(12, c => boot(c, 0, 0));
  IC.icon_hp = icon(12, c => {                 // corazón
    c.ell('red', 3.6, 4, 2.6, 2.6); c.ell('red', 7.6, 4, 2.6, 2.6); c.poly('red', [[1, 4.6], [10.2, 4.6], [5.6, 10.5]]);
    c.px('red.3', 3, 3); c.px('red.2', 2, 4); c.px('red.2', 4, 2);
  });
  IC.icon_xp = icon(12, c => {                 // estrella de experiencia
    const P5 = []; for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.2 : 5.2; P5.push([5.8 + Math.cos(an) * r, 6.2 + Math.sin(an) * r]); }
    c.poly('fa_xp', P5); c.px('fa_xp.3', 5, 4); c.px('white', 6, 5);
  });
  IC.icon_time = icon(12, c => {               // reloj de arena
    c.rect('wood', 2, 1, 9, 1); c.rect('wood', 2, 10, 9, 10);
    c.poly('fa_glass', [[3, 2], [9, 2], [6.6, 6], [9, 10], [3, 10], [5.4, 6]]);
    c.poly('sand', [[4.5, 3.5], [7.5, 3.5], [6.2, 5.6], [5.8, 5.6]]); c.line('sand', 6, 6, 6, 8); c.poly('sand', [[4, 9.6], [6, 8], [8, 9.6]]);
    c.line('wood.0', 2, 2, 2, 9); c.line('wood.0', 9, 2, 9, 9);
  });

  // ------------------------------------------------ insignias de nivel (11×8)
  function chev(c, m, y, thick) {              // galón en ^ (grueso de 4 filas o fino de 2)
    if (thick) { c.rect(m, 4, y, 6, y); c.rect(m, 3, y + 1, 4, y + 1); c.rect(m, 6, y + 1, 7, y + 1); c.rect(m, 2, y + 2, 3, y + 2); c.rect(m, 7, y + 2, 8, y + 2); c.rect(m, 1, y + 3, 2, y + 3); c.rect(m, 8, y + 3, 9, y + 3); c.px(m + '.3', 5, y); c.px(m + '.3', 4, y); c.px(m + '.3', 3, y + 1); }
    else { c.rect(m, 4, y, 6, y); c.px(m, 3, y + 1); c.px(m, 7, y + 1); c.px(m, 2, y + 2); c.px(m, 8, y + 2); c.px(m + '.3', 4, y); c.px(m + '.3', 5, y); }
  }
  IC.badge_2 = { w: 11, h: 8, frames: 1, render: ICON, draw: c => chev(c, 'fa_bronze', 2, true) };
  IC.badge_3 = { w: 11, h: 8, frames: 1, render: ICON, draw: c => { chev(c, 'silver', 1, true); chev(c, 'silver', 4, true); } };
  IC.badge_4 = { w: 11, h: 8, frames: 1, render: ICON, draw: c => { chev(c, 'gold', 1); chev(c, 'gold', 3); chev(c, 'gold', 5); } };
  IC.badge_5 = {
    w: 11, h: 8, frames: 1, render: ICON,
    draw(c) {                                  // estrella rubí con laureles dorados
      for (const s of [-1, 1]) {
        const X = x => Math.round(5 + s * x);
        [[5, 2], [5, 3], [5, 4], [4, 5], [3, 6]].forEach(([x, y]) => c.px('gold', X(x), y));
        c.px('gold.3', X(4), 2); c.px('gold.3', X(4), 4);
      }
      const P5 = []; for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 1.5 : 3.4; P5.push([5.5 + Math.cos(an) * r, 4.2 + Math.sin(an) * r]); }
      c.poly('fa_ruby', P5); c.px('fa_ruby.3', 5, 3); c.px('white', 5, 2);
    },
  };

  // ------------------------------------------------ comandos 16×16
  IC.cmd_stop = icon(16, c => {                // octógono rojo con barra
    const O = []; for (let i = 0; i < 8; i++) { const an = Math.PI / 8 + i * Math.PI / 4; O.push([7.5 + Math.cos(an) * 7, 7.5 + Math.sin(an) * 7]); }
    c.poly('fa_stop', O); c.rect('fa_ui', 4, 7, 11, 8);
  });
  IC.cmd_attackmove = icon(16, c => {          // espada + flechas de avance
    sword(c, 6, 9, 8);
    for (const x of [1, 5]) { c.poly('fa_stop', [[x - .5, 9.5], [x + 1.5, 9.5], [x + 4.5, 12.5], [x + 1.5, 15.5], [x - .5, 15.5], [x + 2.5, 12.5]]); }
  });
  IC.cmd_build = icon(16, c => {               // ladrillos y martillo
    c.rect('brick', 1, 10, 9, 14); c.line('plaster', 1, 12, 9, 12); c.px('plaster', 4, 10); c.px('plaster', 4, 11); c.px('plaster', 7, 13); c.px('plaster', 7, 14); c.px('plaster', 2, 13); c.px('plaster', 2, 14);
    hammer(c, 6, 13);
  });
  IC.cmd_repair = icon(16, c => {              // llave y martillo cruzados
    c.line('steel', 3, 3, 12, 12); c.line('steel', 3, 4, 11, 12); c.ell('steel', 3, 3, 2.2, 2.2); c.px(null, 2, 2); c.px(null, 1, 2); c.px(null, 2, 1);
    c.ell('steel', 12.5, 12.5, 1.6, 1.6);
    hammer(c, 3, 13);
  });
  IC.cmd_delete = icon(16, c => {              // X roja
    for (let i = -1; i <= 1; i++) { c.line('fa_stop', 3 + i, 3, 12 + i, 12); c.line('fa_stop', 12 + i, 3, 3 + i, 12); }
    c.line('fa_stop.3', 3, 3, 6, 6); c.line('fa_stop.3', 12, 3, 10, 5);
  });
  IC.cmd_rally = icon(16, c => {               // bandera de reunión del color de equipo
    c.line('wood', 4, 2, 4, 14); c.px('gold', 4, 1);
    c.poly('team', [[5, 2], [12, 3], [10.5, 5.5], [13, 8], [5, 8]]); c.px('team.3', 6, 3); c.line('team.0', 6, 7, 11, 7);
    c.ell('dirt', 4.5, 14.5, 3, 1.2);
  });
  IC.cmd_idle = icon(16, c => {                // aldeano ocioso (Zz)
    c.ell('skin', 6.5, 10, 3.6, 3.4); c.rect('tunic', 3, 13, 10, 14);
    c.ell('straw', 6.5, 7.6, 5.4, 1.6); c.ell('straw', 6.5, 6, 3, 2.2); c.line('straw.0', 3, 7, 10, 7);
    c.line('eye', 5, 10, 6, 10); c.line('eye', 8, 10, 9, 10);
    c.rect('fa_ui', 11, 1, 14, 1); c.px('fa_ui', 13, 2); c.px('fa_ui', 12, 3); c.rect('fa_ui', 11, 4, 14, 4);
    c.rect('fa_ui', 9, 6, 11, 6); c.px('fa_ui', 10, 7); c.rect('fa_ui', 9, 8, 11, 8);
  });
  IC.cmd_ageup = icon(16, c => {               // torre con estandarte y flecha dorada
    c.rect('stone', 2, 6, 8, 14); for (const x of [2, 5, 8]) c.rect('stone', x, 4, x, 5); c.rect('stone', 2, 5, 8, 5);
    c.rect('darkwood', 4, 11, 6, 14); c.px('window', 5, 8);
    c.line('wood', 5, 0, 5, 3); c.rect('team', 6, 0, 8, 1);
    c.poly('gold', [[8.5, 6.5], [12, 2.6], [15.5, 6.5]]); c.rect('gold', 10.5, 6, 13.5, 14); c.px('gold.3', 12, 4); c.line('gold.3', 11, 7, 11, 13);
  });
  IC.cmd_trade = icon(16, c => {               // balanza dorada
    c.line('gold', 7, 2, 7, 13); c.rect('gold', 4, 14, 10, 14); c.rect('gold', 5, 13, 9, 13);
    c.line('gold', 1, 4, 13, 4); c.px('gold.3', 7, 1);
    c.line('string', 1, 5, 0, 8); c.line('string', 1, 5, 3, 8); c.line('string', 13, 5, 11, 8); c.line('string', 13, 5, 15, 8);
    c.poly('copper', [[-0.5, 8.5], [3.5, 8.5], [2.5, 10.5], [.5, 10.5]]); c.poly('copper', [[10.5, 8.5], [14.5, 8.5], [13.5, 10.5], [11.5, 10.5]]);
  });
  IC.cmd_diplomacy = icon(16, c => {           // pergamino con sello de cera
    c.rect('fa_paper', 3, 3, 12, 12); c.ell('fa_paper', 3, 7.5, 1.6, 5); c.rect('fa_paper.0', 2, 2, 13, 2); c.rect('fa_paper.0', 2, 13, 13, 13);
    c.ell('fa_paper', 13, 2.5, 1.4, 1.4); c.ell('fa_paper', 13, 13, 1.4, 1.4);
    for (let y = 5; y <= 9; y += 2) c.line('fa_paper.0', 5, y, 11, y);
    c.ell('red', 10.5, 11, 2.2, 2.2); c.px('red.3', 10, 10); c.line('team', 9, 13, 8, 15); c.line('team', 11, 13, 12, 15);
  });
  IC.cmd_back = icon(16, c => {                // flecha de volver (↰)
    c.poly('fa_ui', [[1, 5.5], [6, 0.5], [6, 3.5], [10, 3.5], [13.5, 7], [13.5, 13.5], [10.5, 13.5], [10.5, 8], [9.5, 7], [6, 7], [6, 10.5]]);
    c.line('fa_ui.0', 7, 6, 10, 6); c.line('fa_ui.0', 11, 9, 11, 13);
  });
  IC.cmd_ability = icon(16, c => {             // destello mágico
    c.poly('fa_magic', [[7.5, 0.5], [9.2, 5.8], [14.5, 7.5], [9.2, 9.2], [7.5, 14.5], [5.8, 9.2], [0.5, 7.5], [5.8, 5.8]]);
    c.poly('fa_magic.3', [[7.5, 4], [8.4, 6.6], [11, 7.5], [8.4, 8.4], [7.5, 11], [6.6, 8.4], [4, 7.5], [6.6, 6.6]]); c.px('white', 7, 7);
    c.px('fa_magic', 12, 2); c.px('fa_magic', 2, 12); c.px('fa_magic.3', 13, 13);
  });
  IC.cmd_upg_melee = icon(16, c => { sword(c, 4, 11, 9); upArrow(c); });
  IC.cmd_upg_ranged = icon(16, c => { bow(c, 1, 1); upArrow(c); });
  IC.cmd_upg_armor = icon(16, c => {           // peto de acero
    c.poly('steel', [[1.5, 2.5], [4.5, 1.5], [6, 3.5], [9, 3.5], [10.5, 1.5], [13.5, 2.5], [12.5, 7], [11.5, 12.5], [3.5, 12.5], [2.5, 7]]);
    c.line('steel.0', 7, 4, 7, 12); c.line('steel.3', 4, 4, 5, 9); c.rect('gold', 4, 10, 10, 10); upArrow(c);
  });
  IC.cmd_upg_wood = icon(16, c => {            // hacha de leñador
    c.line('wood', 3, 14, 10, 3); c.line('wood.0', 4, 14, 10, 4);
    c.poly('blade', [[7.5, 2.5], [10, .8], [14, 4.5], [12, 7.5], [9.5, 5]]); c.line('blade.3', 10, 2, 12, 4); upArrow(c);
  });
  IC.cmd_upg_mine = icon(16, c => {            // pico
    c.line('wood', 2, 14, 9, 5); c.line('wood.0', 3, 14, 9, 6);
    c.poly('iron', [[2.5, 3], [6, 1.6], [9.5, 2.5], [13, 5], [13.5, 8.5], [11, 5.6], [8, 4.4], [5, 4.4]]); c.line('iron.3', 5, 2, 9, 3); upArrow(c);
  });
  IC.cmd_upg_farm = icon(16, c => {            // tres espigas de trigo atadas
    for (const [x, y] of [[3, 3], [7, 1], [11, 3]]) {
      c.line('straw.0', x, y + 2, x, y + 7);
      for (let k = 0; k < 3; k++) { c.px('straw', x - 1, y + 2 + k * 2); c.px('straw', x + 1, y + 2 + k * 2); c.px('straw.3', x - 1, y + 1 + k * 2); c.px('straw.0', x + 1, y + 3 + k * 2); }
      c.px('straw.3', x, y + 1); c.px('straw', x, y); c.px('straw.2', x, y - 1);
    }
    c.line('straw.0', 3, 10, 6, 12); c.line('straw.0', 11, 10, 8, 12); c.line('straw.0', 7, 8, 7, 12);
    c.px('straw.0', 5, 14); c.px('straw.0', 7, 14); c.px('straw.0', 9, 14); c.rect('red', 5, 13, 9, 13); upArrow(c);
  });
  IC.cmd_upg_loom = icon(16, c => {            // ovillo con aguja
    c.ell('fa_yarn', 6.5, 8, 5, 5); for (let i = 0; i < 3; i++) c.line('fa_yarn.0', 3 + i * 2, 4, 5 + i * 2, 12);
    c.line('fa_yarn.3', 3, 6, 8, 4); c.line('fa_yarn', 10, 12, 13, 14);
    c.line('silver', 1, 14, 9, 2); c.px('fa_ui', 9, 2); upArrow(c);
  });
  IC.cmd_upg_walls = icon(16, c => { wallSeg(c, 1, 4, 13, 13); upArrow(c); });
  IC.cmd_upg_heal = icon(16, c => {            // poción curativa
    c.rect('cloth', 6, 1, 8, 2); c.rect('fa_glass', 6, 3, 8, 5);
    c.ell('fa_glass', 7, 10, 5, 4.5); c.ell('fa_potion', 7, 11, 4.2, 3.4); c.rect('fa_glass', 3, 6, 11, 7);
    c.px('white', 5, 8); c.px('fa_potion.3', 5, 10); upArrow(c);
  });
  IC.cmd_upg_unique = icon(16, c => {          // corona con gema
    c.poly('gold', [[1.5, 11.5], [1.5, 4], [4.5, 7], [7.5, 2], [10.5, 7], [13.5, 4], [13.5, 11.5]]);
    c.rect('gold.0', 2, 10, 13, 11); c.ell('fa_ruby', 7.5, 8, 1.5, 1.5); c.px('fa_xp', 4, 9); c.px('fa_xp', 11, 9);
    c.px('gold.3', 7, 2); c.px('gold.3', 1, 4); c.px('gold.3', 13, 4); upArrow(c);
  });
  IC.cmd_upg_cav = icon(16, c => {             // herradura
    c.ring('iron', 7.5, 7, 5.5, 6, .38, (x, y) => y < 9);
    c.rect('iron', 2, 9, 4, 13); c.rect('iron', 11, 9, 13, 13);
    for (const [x, y] of [[3, 5], [5, 2], [10, 2], [12, 5], [3, 10], [12, 10]]) c.px('fa_ui', x, y);
    c.px('iron.3', 4, 3); upArrow(c);
  });
  IC.cmd_upg_speed = icon(16, c => { boot(c, 1, 2); upArrow(c); });
  IC.cmd_road = icon(16, c => {                // camino empedrado (vista cenital) entre hierba
    c.rect('grass', 1, 1, 14, 14); c.px('grass.3', 2, 3); c.px('grass.3', 13, 9); c.px('grass.0', 2, 11); c.px('grass.0', 13, 4);
    c.rect('fa_istone', 4, 1, 11, 14);
    for (let r = 0; r < 5; r++) {
      const y = 1 + r * 3; c.line('fa_istone.0', 4, y + 2, 11, y + 2);
      for (let x = 4 + (r % 2 ? 1 : 3); x <= 11; x += 4) { c.px('fa_istone.0', x, y); c.px('fa_istone.0', x, y + 1); }
      c.px('fa_istone.3', 5 + (r % 2) * 2, y); c.px('fa_istone.3', 9 + (r % 2), y);
    }
    c.line('dirt', 3, 1, 3, 14); c.line('dirt', 12, 1, 12, 14);
  });
  IC.cmd_wall = icon(16, c => wallSeg(c, 1, 3, 14, 14));
  IC.cmd_gate = icon(16, c => {                // muro con portón de madera
    wallSeg(c, 1, 2, 14, 14);
    c.rect('wood', 4, 8, 11, 14); c.ell('wood', 7.5, 8.5, 3.6, 3); c.line('wood.0', 7, 6, 7, 14); c.line('wood.0', 8, 6, 8, 14);
    c.line('iron', 4, 10, 11, 10); c.line('iron', 4, 13, 11, 13); c.px('gold', 9, 11);
  });
})();
