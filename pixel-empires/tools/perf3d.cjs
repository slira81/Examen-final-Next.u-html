// Rendimiento del render 3D: coste de CPU por frame (sin la GPU software) con muchas unidades.
// Uso: node tools/perf3d.cjs [unidades extra] [minutos]
const { chromium } = require('playwright');
(async () => {
  const extra = +(process.argv[2] || 300), mins = +(process.argv[3] || 6);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.addInitScript(() => { window.__TEST__ = true; });
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  const r = await p.evaluate(async ({ extra, mins }) => {
    const players = ['human', 'elf', 'dwarf', 'orc', 'giant', 'human'].map((r, i) => ({ race: r, color: i, human: false, team: 0, diff: 'hard', name: 'P' + i }));
    PE_GAME.startGame({ seed: 99, size: 96, mapType: 'continental', players, resources: 'high', weather: false, disasters: false, observer: true, revealed: true });
    const G = PE_GAME.G; UI.paused = true; INPUT.inWin = false;
    for (let i = 0; i < mins * 60 * 30; i++) PE_GAME.simStep(1 / 30);
    // ejército extra alrededor de la cámara (todas las razas y roles)
    const keys = Object.keys(UNITS).filter(k => !k.startsWith('neutral') && !k.startsWith('animal') && !k.endsWith('general'));
    const c = G.blds.find(b => b.type === 'tc'); const cx = (c.tx + 2) * 16, cy = (c.ty + 6) * 16;
    for (let i = 0; i < extra; i++) { const a = i * 2.4, rr = 16 + Math.sqrt(i) * 9; spawnUnit(keys[i % keys.length], i % 6, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    G.cam.x = cx; G.cam.y = cy; clampCam();
    for (let i = 0; i < 30; i++) PE_GAME.simStep(1 / 30);   // que se muevan / peleen
    const out = { units: G.units.length };
    const render = E.renderer.render.bind(E.renderer), noop = () => {};
    const bench = (label, n) => {
      for (let i = 0; i < 5; i++) RV.impl.frame(1 / 60, 0.5);
      E.renderer.render = noop; let acc = 0; for (let i = 0; i < n; i++) { PE_GAME.simStep(1 / 30); const t1 = performance.now(); RV.impl.frame(1 / 60, 0.5); acc += performance.now() - t1; } const cpu = acc / n;
      E.renderer.render = render; let t0 = performance.now(); for (let i = 0; i < 4; i++) RV.impl.frame(1 / 60, 0.5); const full = (performance.now() - t0) / 4;
      const info = E.renderer.info.render; out[label] = { cpu_ms: +cpu.toFixed(2), conRender_ms: +full.toFixed(1), tris: info.triangles, draws: info.calls, particulas: window.PARTICLES ? PARTICLES.normal.list.length + PARTICLES.add.list.length : -1 };
    };
    E.tdist = E.dist = 20; bench('zoom20', 40);
    E.tdist = E.dist = 46; bench('zoom46', 40);
    // simulación sola, para separar
    let t0 = performance.now(); for (let i = 0; i < 40; i++) PE_GAME.simStep(1 / 30); out.sim_ms = +((performance.now() - t0) / 40).toFixed(2);
    return out;
  }, { extra, mins });
  console.log(JSON.stringify(r, null, 1)); console.log(errs.length ? 'ERRORES:\n' + errs.slice(0, 8).join('\n') : 'SIN ERRORES'); await b.close();
})();
