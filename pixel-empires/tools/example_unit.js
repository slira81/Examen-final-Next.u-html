// EJEMPLO DE REFERENCIA (no se incluye en el juego): guerrero humano portado del generador Python.
PE.ART.units.example_warrior = {
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
    // brazo con espada: en ataque la espada sube (1), baja en arco (2), queda abajo (3)
    const sy = a === 1 ? -3 : a === 2 ? 2 : a === 3 ? 3 : 0, sx = a === 2 ? -2 : a === 3 ? -3 : 0;
    c.at(sx, b - P.s + sy, () => {
      c.rect('steel', 22, 17, 24, 22); c.rect('leather', 22, 21, 24, 22);
      c.rim((t, m) => { t.rect(m, 26, 5, 27, 19); t.px(m, 26, 4); t.px(m, 27, 4); t.px(m, 26, 3); t.rect(m, 24, 20, 29, 21); t.rect(m, 26, 22, 27, 24); t.rect(m, 25, 25, 28, 25); }, 'blade');
      c.rect('gold', 24, 20, 29, 21); c.rect('leather', 26, 22, 27, 24); c.rect('gold', 25, 25, 28, 25);
    });
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
