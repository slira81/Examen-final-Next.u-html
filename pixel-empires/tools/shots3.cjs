const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  await p.evaluate(() => {
    PE_GAME.startGame({ seed: 4242, size: 96, mapType: 'continental', players: ['human', 'elf', 'dwarf', 'orc', 'giant'].map((r, i) => ({ race: r, color: i, human: false, team: 0, diff: 'normal', name: 'P' + i })), resources: 'normal', weather: false, disasters: false, observer: true });
    UI.paused = true; for (let i = 0; i < 30 * 60 * 22; i++) PE_GAME.simStep(1 / 30);
  });
  for (let i = 0; i < 5; i++) {
    const ok = await p.evaluate(i => { const G = PE_GAME.G; const tc = G.blds.find(b => b.team === i && b.type === 'tc') || G.blds.find(b => b.team === i); if (!tc) return false; G.cam.x = (tc.tx + 2) * 16; G.cam.y = (tc.ty + 2) * 16 + 20; UI.paused = false; return true; }, i);
    if (!ok) continue;
    await p.waitForTimeout(500); await p.screenshot({ path: `tools/out/base_${i}.png` });
  }
  console.log(errs.length ? errs.join('\n') : 'SIN ERRORES'); await b.close();
})();
