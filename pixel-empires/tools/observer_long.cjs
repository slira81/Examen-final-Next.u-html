// Modo observador largo por el bucle real del juego a 2x: errores de consola, memoria (montón JS y
// recursos de GPU) y tiempos de frame. Uso: node tools/observer_long.cjs [minutos de juego] [salida.png]
const { chromium } = require('playwright');
(async () => {
  const mins = +(process.argv[2] || 16), out = process.argv[3] || 'tools/out/observer_long.png';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
  await p.addInitScript(() => { window.__TEST__ = true; });
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  await p.evaluate(() => {
    const players = ['human', 'elf', 'dwarf', 'orc', 'giant'].map((r, i) => ({ race: r, color: i, human: false, team: 0, diff: 'normal', name: 'P' + i }));
    PE_GAME.startGame({ seed: 2026, size: 96, mapType: 'continental', players, resources: 'normal', weather: true, disasters: true, observer: true });
    const G = PE_GAME.G; G.speed = 2; INPUT.inWin = false; UI.paused = false;
    // registro de tiempos de frame y cámara que recorre las bases
    window.__ft = []; let last = performance.now();
    const tick = t => { window.__ft.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    window.__camT = setInterval(() => { const ps = G.players.filter(p => p.alive), q = ps[Math.floor(G.time / 40) % ps.length]; const tc = q && G.blds.find(b => b.team === q.id && b.type === 'tc'); if (tc) { G.cam.x = (tc.tx + 2) * 16; G.cam.y = (tc.ty + 5) * 16; clampCam(); } }, 3000);
  });
  const samples = [];
  for (;;) {
    await p.waitForTimeout(20000);
    const s = await p.evaluate(() => { const G = PE_GAME.G, ft = window.__ft.splice(0).sort((a, b) => a - b), q = k => ft.length ? +ft[Math.min(ft.length - 1, Math.floor(ft.length * k))].toFixed(0) : 0; const mem = E.renderer.info.memory; return { t: Math.round(G.time), units: G.units.length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1, geos: mem.geometries, tex: mem.textures, frames: ft.length, p50: q(0.5), p95: q(0.95), max: q(1), clima: G.weather.cur, over: !!G.over }; });
    samples.push(s); console.log(JSON.stringify(s));
    if (s.t >= mins * 60 || s.over) break;
  }
  await p.screenshot({ path: out });
  const h0 = samples[1] || samples[0], h1 = samples[samples.length - 1];
  console.log('montón JS: ' + h0.heapMB + ' → ' + h1.heapMB + ' MB · geometrías ' + h0.geos + ' → ' + h1.geos + ' · texturas ' + h0.tex + ' → ' + h1.tex);
  console.log(errs.length ? 'ERRORES:\n' + [...new Set(errs)].slice(0, 12).join('\n') : 'SIN ERRORES');
  await b.close();
})();
