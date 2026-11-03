// Prueba móvil con eventos táctiles reales (CDP): tocar, arrastrar, pellizcar, mantener.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 })) });
  const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await p.waitForTimeout(40); await touch('touchEnd', []); await p.waitForTimeout(80); };
  const drag = async (x0, y0, x1, y1, hold = 0) => { await touch('touchStart', [[x0, y0]]); if (hold) await p.waitForTimeout(hold); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8]]); await p.waitForTimeout(16); } await touch('touchEnd', []); await p.waitForTimeout(80); };
  await p.addInitScript(() => { window.__TEST__ = true; });
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  await p.waitForTimeout(600); await p.screenshot({ path: 'tools/out/m_setup.png' });
  // El render por software (SwiftShader) va a ~5 fps y retrasa los eventos táctiles hasta convertir
  // toques en pulsaciones largas; para probar la entrada se baja la carga gráfica (no la lógica).
  await p.evaluate(() => { if (RV.kind === 'three') { Q.shadows = false; E.renderer.shadowMap.enabled = false; E.sun.castShadow = false; Q.scale = 0.34; RV.impl.resize(); } });
  const log = [];
  try {
  log.push('touchClass=' + await p.evaluate(() => document.body.classList.contains('touch')));
  await p.evaluate(() => { document.getElementById('s-rivals').value = '2'; buildRivals(); });
  const st = await p.$('#s-start'); await st.scrollIntoViewIfNeeded(); await p.waitForTimeout(200); const bb = await st.boundingBox(); await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(900);
  log.push('started=' + await p.evaluate(() => !!PE_GAME.G) + ' render=' + await p.evaluate(() => RV.kind));
  await p.evaluate(() => { PE_GAME.startGame({ seed: 777, size: 96, mapType: 'continental', players: ['human', 'orc', 'elf'].map((r, i) => ({ race: r, color: i, human: i === 0, team: 0, diff: 'easy', name: 'P' + i })), resources: 'high', weather: false, disasters: false }); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'tools/out/m_game.png' });
  const scr = (wx, wy) => p.evaluate(([wx, wy]) => RV.impl.worldToScreen(wx, wy), [wx, wy]);
  // tocar un aldeano y luego un árbol
  const info = await p.evaluate(() => { const G = PE_GAME.G, u = G.units.find(u => u.team === 0 && u.def.role === 'worker'); const r = findRes(u, 'berry', 30) || findRes(u, 'tree', 30); G.cam.x = u.x; G.cam.y = u.y; clampCam(); return { ux: u.x, uy: u.y - 5, id: u.id, rx: r.tx * 16 + 8, ry: r.ty * 16 + 8 }; });
  await p.waitForTimeout(150);
  let s = await scr(info.ux, info.uy); await tap(s.x, s.y);
  log.push('sel=' + await p.evaluate(() => PE_GAME.G.sel.map(e => e.def ? e.def.n : e.kind).join(',')));
  await p.evaluate(([x, y]) => { PE_GAME.G.cam.x = x; PE_GAME.G.cam.y = y; clampCam(); }, [info.rx, info.ry]); await p.waitForTimeout(150);
  s = await scr(info.rx, info.ry); await tap(s.x, s.y); await p.waitForTimeout(300);
  log.push('orden=' + await p.evaluate(id => PE_GAME.G.byId.get(id).order.t, info.id));
  // arrastrar = mover cámara
  const cam0 = await p.evaluate(() => ({ ...PE_GAME.G.cam }));
  await drag(400, 200, 250, 150); const cam1 = await p.evaluate(() => ({ ...PE_GAME.G.cam }));
  log.push('pan=' + Math.round(cam1.x - cam0.x) + ',' + Math.round(cam1.y - cam0.y));
  // pellizcar = zoom
  const zv = () => p.evaluate(() => RV.kind === 'three' ? +E.tdist.toFixed(1) : VIEW.S);
  const s0 = await zv();
  await touch('touchStart', [[380, 200], [460, 200]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[380 - i * 15, 200], [460 + i * 15, 200]]); await p.waitForTimeout(16); } await touch('touchEnd', []); await p.waitForTimeout(100);
  const s1 = await zv();
  await touch('touchStart', [[300, 200], [560, 200]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[300 + i * 14, 200], [560 - i * 14, 200]]); await p.waitForTimeout(16); } await touch('touchEnd', []); await p.waitForTimeout(100);
  log.push('pinch ' + s0 + ' -> ' + s1 + ' -> ' + await zv());
  // botones de zoom
  await p.evaluate(() => { const z = document.getElementById('z-out'); z.click(); });
  log.push('zoomOutBtn ' + await zv());
  // mantener y arrastrar = selección múltiple
  await p.evaluate(() => { const G = PE_GAME.G, tc = G.blds.find(b => b.team === 0 && b.type === 'tc'); G.cam.x = (tc.tx + 2) * 16; G.cam.y = (tc.ty + 4) * 16; clampCam(); G.sel = []; for (const u of G.units) if (u.team === 0 && u.def.role === 'worker') setOrder(u, { t: 'idle' }); });
  await p.waitForTimeout(100);
  await drag(30, 60, 800, 270, 520);
  log.push('caja=' + await p.evaluate(() => PE_GAME.G.sel.length));
  // construir una casa: menú económicos -> casa -> tocar mapa -> Construir
  await p.evaluate(() => { const G = PE_GAME.G; G.sel = G.units.filter(u => u.team === 0 && u.def.role === 'worker').slice(0, 2); UI.page = 'root'; updateSelectionUI(true); });
  await p.waitForTimeout(100);
  let btn, bx;
  for (let tries = 0; tries < 3 && !(await p.evaluate(() => UI.placing)); tries++) {   // el render por software puede retrasar un toque
    await p.evaluate(() => { const G = PE_GAME.G; cancelModes(); G.sel = G.units.filter(u => u.team === 0 && u.def.role === 'worker').slice(0, 2); UI.page = 'root'; updateSelectionUI(true); });
    await p.waitForTimeout(300);
    btn = (await p.$$('#cmds .cmd'))[0]; bx = await btn.boundingBox(); await tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.waitForTimeout(400);
    btn = (await p.$$('#cmds .cmd'))[0]; bx = await btn.boundingBox(); await tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.waitForTimeout(400);
  }
  log.push('placing=' + await p.evaluate(() => UI.placing) + ' barra=' + await p.evaluate(() => !document.getElementById('placebar').hidden));
  const spot = await p.evaluate(() => { const G = PE_GAME.G, s = G.map.starts[0]; for (let r = 4; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (canPlace(0, 'house', s.x + dx, s.y + dy)) { G.cam.x = (s.x + dx + 1) * 16; G.cam.y = (s.y + dy + 1) * 16; clampCam(); return { x: (s.x + dx + 1) * 16, y: (s.y + dy + 1) * 16 }; } });
  await p.waitForTimeout(100); s = await scr(spot.x, spot.y); await tap(s.x, s.y);
  await p.screenshot({ path: 'tools/out/m_place.png' });
  log.push('ghost=' + await p.evaluate(() => JSON.stringify(UI.ghost || null)) + ' barra2=' + await p.evaluate(() => !document.getElementById('placebar').hidden));
  const ok = await p.$('#pb-ok'); const ob = await ok.boundingBox(); if (ob) await tap(ob.x + ob.width / 2, ob.y + ob.height / 2); else log.push('SIN BOTON OK');
  log.push('casas=' + await p.evaluate(() => PE_GAME.G.blds.filter(b => b.team === 0 && b.type === 'house').length));
  // pulsación larga en un botón muestra ayuda sin ejecutar
  btn = (await p.$$('#cmds .cmd'))[0]; bx = await btn.boundingBox();
  await touch('touchStart', [[bx.x + 10, bx.y + 10]]); await p.waitForTimeout(600); log.push('tip=' + await p.evaluate(() => !document.getElementById('tip').hidden)); await touch('touchEnd', []);
  await p.waitForTimeout(300);
  // vertical
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  await p.evaluate(() => { const G = PE_GAME.G; G.sel = G.units.filter(u => u.team === 0 && u.def.role === 'worker').slice(0, 1); UI.page = 'root'; updateSelectionUI(true); });
  await p.waitForTimeout(300); await p.screenshot({ path: 'tools/out/m_portrait.png' });
  log.push('vertical ' + await p.evaluate(() => innerWidth + 'x' + innerHeight));
  } catch (e) { log.push('FALLO: ' + e.message); }
  console.log(log.join('\n')); console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'SIN ERRORES'); await b.close();
})();
