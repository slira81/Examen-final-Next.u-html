// Captura del render 3D tras simular unos minutos. Uso: node tools/shot3d.cjs [minutos] [salida.png] [--obs] [--zoom=n]
const { chromium } = require('playwright');
(async () => {
  const args = process.argv.slice(2), mins = +(args[0] || 0), out = args[1] || 'tools/out/s3d.png';
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(opt.w || 1366), height: +(opt.h || 800) } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html') + (opt.pixel ? '#pixel' : ''));
  const info = await p.evaluate(async ({ mins, opt }) => {
    const players = ['human', 'elf', 'dwarf', 'orc', 'giant'].slice(0, +(opt.players || 3)).map((r, i) => ({ race: r, color: i, human: i === 0 && !opt.obs, team: 0, diff: 'normal', name: 'P' + i }));
    PE_GAME.startGame({ seed: +(opt.seed || 4242), size: 96, mapType: opt.map || 'continental', players, resources: 'normal', weather: false, disasters: false, observer: !!opt.obs, revealed: !!opt.reveal });
    const G = PE_GAME.G; UI.paused = true;
    for (let i = 0; i < mins * 60 * 30; i++) PE_GAME.simStep(1 / 30);
    UI.paused = false; INPUT.inWin = false; INPUT.mx = -1; INPUT.my = -1;
    if (opt.zoom) { RV.impl.pinchBegin(); RV.impl.pinchUpdate(+opt.zoom, innerWidth / 2, innerHeight / 2); }
    if (opt.weather) { G.cfg.weather = true; G.weather.cur = opt.weather; G.weather.a = 1; G.weather.t = 999; G.weather.boltT = 1; }
    if (opt.fx) {   // efectos de prueba alrededor del centro de la cámara y un edificio dañado
      const c = G.cam, put = (key, dx, dy, o) => G.fx.push(Object.assign({ key, x: c.x + dx, y: c.y + dy, t: 0, life: 0.8 }, o || {}));
      window.__fxTimer = setInterval(() => { put('fx_explosion', -60, 20); put('fx_magic', -20, -30); put('fx_heal', 20, -30); put('fx_frost', 60, -30); put('fx_levelup', -40, 50); put('fx_stomp', 40, 50); put('fx_blood', 0, 10); put('beam', -80, -60, { x2: c.x + 80, y2: c.y - 70 }); }, 700);
      const b = G.blds.find(b => b.type === 'tc'); if (b) { b.hp = b.maxhp * 0.2; G.cam.x = (b.tx + 2) * 16; G.cam.y = (b.ty + 5) * 16; }
      const g = G.units.find(u => u.def.role === 'worker'); if (g) g.stun = 30;
    }
    return { kind: RV.kind, units: G.units.length };
  }, { mins, opt });
  await p.waitForTimeout(+(opt.wait || 2500));
  const perf = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 10; i++) RV.impl.frame(1 / 60, 0.5); return ((performance.now() - t0) / 10).toFixed(1) + ' ms/frame (software)'; });
  await p.screenshot({ path: out });
  console.log(JSON.stringify(info), perf); console.log(errs.length ? [...new Set(errs)].slice(0, 12).join('\n') : 'SIN ERRORES'); await b.close();
})();
