// Partida con cada raza: el jugador usa la interfaz (selección, menús, órdenes) y una IA de prueba
// le ayuda a avanzar. 10 minutos de juego con clima y desastres; revisa errores y toma capturas.
// Uso: node tools/race_match.cjs [razas separadas por coma] [minutos]
const { chromium } = require('playwright');
(async () => {
  const races = (process.argv[2] || 'human,elf,dwarf,orc,giant').split(','), mins = +(process.argv[3] || 10);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const race of races) {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
    await p.addInitScript(() => { window.__TEST__ = true; });
    await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
    await p.evaluate(race => {
      const rivals = ['human', 'elf', 'dwarf', 'orc', 'giant'].filter(r => r !== race).slice(0, 2);
      PE_GAME.startGame({ seed: 1234, size: 96, mapType: 'continental', players: [race, ...rivals].map((r, i) => ({ race: r, color: i, human: i === 0, team: 0, diff: 'normal', name: 'P' + i })), resources: 'normal', weather: true, disasters: true });
      const G = PE_GAME.G, me = G.players[0]; INPUT.inWin = false;
      me.ai = { t: 1, think: 2, attackT: 700, wave: 0, waveSize: 8, attacking: false, target: null, lastDef: -99 };   // IA de prueba para el jugador
    }, race);
    const step = secs => p.evaluate(secs => { UI.paused = true; for (let i = 0; i < secs * 30; i++) { if (RV.impl.beforeStep) RV.impl.beforeStep(); PE_GAME.simStep(1 / 30); } UI.paused = false; }, secs);
    const ui = [];
    for (let m = 0; m < mins; m++) {
      await step(60);
      await p.waitForTimeout(1200);   // frames reales con el bucle del juego
      if (m === 2) {   // aldeano: menús de construcción (iconos 3D de la raza)
        await p.evaluate(() => { const G = PE_GAME.G, u = G.units.find(u => u.team === 0 && u.def.role === 'worker'); if (u) { G.sel = [u]; centerOn(u.x, u.y); UI.page = 'eco'; updateSelectionUI(true); } });
        await p.waitForTimeout(1500); await p.screenshot({ path: `tools/out/race_${race}_eco.png` });
        await p.evaluate(() => { UI.page = 'mil'; updateSelectionUI(true); }); await p.waitForTimeout(1200);
        ui.push('menus=' + await p.evaluate(() => document.querySelectorAll('#cmds canvas[data-r3d]').length));
      }
      if (m === 5) {   // centro urbano con H y entrenar con Q
        await p.keyboard.press('h'); await p.waitForTimeout(600); await p.keyboard.press('q'); await p.waitForTimeout(400);
        ui.push('tc=' + await p.evaluate(() => PE_GAME.G.sel[0] && PE_GAME.G.sel[0].type) + ' cola=' + await p.evaluate(() => PE_GAME.G.sel[0] ? PE_GAME.G.sel[0].queue.length : -1));
      }
      if (m === mins - 1) {   // ejército: M (seleccionar militares) y atacar moviéndose
        await p.keyboard.press('m'); await p.waitForTimeout(500);
        ui.push('ejercito=' + await p.evaluate(() => PE_GAME.G.sel.length));
        await p.evaluate(() => { const G = PE_GAME.G, tc = G.blds.find(b => b.team === 0 && b.type === 'tc') || G.blds.find(b => b.team === 0); if (tc) centerOn((tc.tx + tc.fp / 2) * 16, (tc.ty + tc.fp) * 16); G.sel = []; updateSelectionUI(true); });
        await p.waitForTimeout(2500); await p.screenshot({ path: `tools/out/race_${race}_base.png` });
      }
    }
    const st = await p.evaluate(() => { const G = PE_GAME.G, me = G.players[0]; return { tiempo: Math.round(G.time), era: me.age, unidades: G.units.filter(u => u.team === 0 && !u.dead).length, edificios: [...new Set(G.blds.filter(b => b.team === 0 && !b.dead).map(b => b.type))].join(','), clima: G.weather.cur, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : '?' }; });
    report.push(race + ' ' + JSON.stringify(st) + ' ' + ui.join(' ') + ' → ' + (errs.length ? 'ERRORES:\n  ' + [...new Set(errs)].slice(0, 6).join('\n  ') : 'SIN ERRORES'));
    console.log(report[report.length - 1]);
    await p.close();
  }
  await b.close();
})();
