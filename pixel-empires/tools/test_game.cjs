// Prueba automática: carga el juego, arranca una partida (observador o humano), simula N minutos y reporta.
// Uso: node tools/test_game.js [minutos=10] [--obs] [--shot=out.png] [--size=96] [--players=4]
const { chromium } = require('playwright');
(async () => {
  const args = process.argv.slice(2), mins = +(args.find(a => /^\d+$/.test(a)) || 10);
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  await p.waitForTimeout(300);
  const res = await p.evaluate(async ({ mins, opt }) => {
    const races = ['human', 'elf', 'dwarf', 'orc', 'giant'], n = +(opt.players || 4);
    const players = [];
    for (let i = 0; i < n; i++) players.push({ race: races[(i + (+opt.offset || 0)) % 5], color: i, human: i === 0 && !opt.obs, team: 0, diff: 'normal', name: 'P' + i });
    const t0 = performance.now();
    PE_GAME.startGame({ seed: +(opt.seed || 12345), size: +(opt.size || 96), mapType: opt.map || 'continental', players, resources: 'normal', weather: true, disasters: true, revealed: !!opt.reveal, observer: !!opt.obs, diff: 'normal' });
    const tStart = performance.now() - t0;
    const G = PE_GAME.G; UI.paused = true;
    const t1 = performance.now(); const steps = mins * 60 * 30;
    for (let i = 0; i < steps; i++) PE_GAME.simStep(1 / 30);
    const simMs = performance.now() - t1;
    const summary = G.players.map(pl => ({ name: pl.name, race: pl.race, alive: pl.alive, age: pl.age, pop: pl.pop + '/' + pl.popCap, res: Object.fromEntries(Object.entries(pl.res).map(([k, v]) => [k, Math.round(v)])), units: G.units.filter(u => u.team === pl.id && !u.dead && u.def.role !== 'animal').length, mil: G.units.filter(u => u.team === pl.id && !u.dead && isMil(u)).length, blds: G.blds.filter(b => b.team === pl.id && !b.dead).map(b => b.type).sort().join(','), techs: [...pl.techs].join(','), maxLvl: pl.stats.maxLevel, killed: pl.stats.killed, lost: pl.stats.lost, gen: !!pl.generalId }));
    const lv = {}; for (const u of G.units) if (!u.dead && isMil(u)) lv[u.lvl] = (lv[u.lvl] || 0) + 1;
    const r0 = performance.now(); for (let i = 0; i < 60; i++) { G.cam.x = G.map.W * 8 + Math.sin(i / 9) * 300; G.cam.y = G.map.H * 8; render(1 / 60); } const renderMs = ((performance.now() - r0) / 60).toFixed(2);
    return { renderMs, tStart: Math.round(tStart), simMs: Math.round(simMs), msPerStep: (simMs / steps).toFixed(3), time: Math.round(G.time), units: G.units.length, over: G.over, weather: G.weather.cur, levels: lv, summary, missing: [...PE.MISSING].slice(0, 40), msgs: G.msgs.filter(m => /avanza|general|ha caído|derrotado|guerra|alianza|paz/i.test(m.text)).slice(-25).map(m => Math.round(m.t) + 's ' + m.text), idleW: G.units.filter(u => !u.dead && u.def.role === 'worker' && u.order.t === 'idle').length };
  }, { mins, opt });
  if (opt.shot) {
    await p.evaluate(() => { UI.paused = false; const G = PE_GAME.G; const tc = G.blds.find(b => b.team === Math.max(0, G.human) && b.type === 'tc') || G.blds[0]; if (tc) { G.cam.x = (tc.tx + 2) * 16; G.cam.y = (tc.ty + 2) * 16; } });
    await p.waitForTimeout(800);
    await p.screenshot({ path: opt.shot });
  }
  console.log(JSON.stringify(res, null, 1));
  console.log(errs.length ? 'ERRORES (' + errs.length + '):\n' + [...new Set(errs)].slice(0, 15).join('\n') : 'SIN ERRORES');
  await b.close();
})();
