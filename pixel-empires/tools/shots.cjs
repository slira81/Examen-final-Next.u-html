// Capturas de interfaz: selección de aldeanos, edificio con cola, batalla avanzada.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  await p.evaluate(() => {
    PE_GAME.startGame({ seed: 777, size: 96, mapType: 'continental', players: ['human', 'orc', 'elf'].map((r, i) => ({ race: r, color: i, human: i === 0, team: 0, diff: 'normal', name: 'P' + i })), resources: 'high', weather: true, disasters: false });
    const G = PE_GAME.G; G.sel = G.units.filter(u => u.team === 0 && u.def.role === 'worker');
  });
  await p.waitForTimeout(700); await p.screenshot({ path: 'tools/out/ui_workers.png' });
  await p.keyboard.press('q'); await p.waitForTimeout(300); await p.screenshot({ path: 'tools/out/ui_build_eco.png' });
  await p.evaluate(() => { const G = PE_GAME.G; const tc = G.blds.find(b => b.team === 0 && b.type === 'tc'); G.players[0].res.food = 2000; enqueue(tc, 'unit', 'human_worker'); enqueue(tc, 'unit', 'human_worker'); enqueue(tc, 'tech', 'loom'); G.sel = [tc]; });
  await p.waitForTimeout(700); await p.mouse.move(1150, 690); await p.waitForTimeout(300); await p.screenshot({ path: 'tools/out/ui_tc.png' });
  // batalla: soldados de nivel alto contra orcos
  await p.evaluate(() => {
    const G = PE_GAME.G, s = G.map.starts[0], x = (s.x + 6) * 16, y = (s.y + 6) * 16;
    const mine = []; for (let i = 0; i < 6; i++) { const u = spawnUnit(['human_inf', 'human_pike', 'human_ranged', 'human_cav', 'human_special', 'human_general'][i], 0, x + i * 14, y); u.lvl = 1 + (i % 5); refreshHp(u); u.hp = u.maxhp; mine.push(u); }
    for (let i = 0; i < 6; i++) spawnUnit(['orc_inf', 'orc_pike', 'orc_ranged', 'orc_cav', 'orc_special', 'orc_general'][i], 1, x + i * 14, y + 50);
    G.cam.x = x + 40; G.cam.y = y + 20; G.sel = mine; UI.paused = false;
  });
  await p.waitForTimeout(1600); await p.screenshot({ path: 'tools/out/ui_battle.png' });
  await p.evaluate(() => { const G = PE_GAME.G; G.sel = [G.units.find(u => u.team === 0 && u.def.unique)]; G.sel[0].pxp = 40; G.sel[0].xp = 300; });
  await p.waitForTimeout(400); await p.screenshot({ path: 'tools/out/ui_general.png' });
  console.log(errs.length ? errs.join('\n') : 'SIN ERRORES'); await b.close();
})();
