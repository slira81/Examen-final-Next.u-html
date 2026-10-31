// Simula interacciones reales de un jugador con ratón y teclado.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto('file://' + require('path').resolve(__dirname, '../index.html'));
  await p.evaluate(() => PE_GAME.startGame({ seed: 777, size: 96, mapType: 'continental', players: ['human', 'orc'].map((r, i) => ({ race: r, color: i, human: i === 0, team: 0, diff: 'easy', name: 'P' + i })), resources: 'high', weather: false, disasters: false }));
  await p.waitForTimeout(400);
  const scr = (wx, wy) => p.evaluate(([wx, wy]) => ({ x: (wx - VIEW.cx) * VIEW.S, y: (wy - VIEW.cy) * VIEW.S }), [wx, wy]);
  const log = [];
  // 1) seleccionar aldeano con clic y mandar a un árbol cercano
  const info = await p.evaluate(() => { const G = PE_GAME.G, u = G.units.find(u => u.team === 0 && u.def.role === 'worker'); const r = findRes(u, 'tree', 30); G.cam.x = (u.x + r.tx * 16) / 2; G.cam.y = (u.y + r.ty * 16) / 2; return { ux: u.x, uy: u.y - 6, id: u.id, rx: r.tx * 16 + 8, ry: r.ty * 16 + 4 }; });
  await p.waitForTimeout(200);
  let s = await scr(info.ux, info.uy); await p.mouse.click(s.x, s.y); await p.waitForTimeout(100);
  log.push('sel=' + await p.evaluate(() => PE_GAME.G.sel.map(e => e.def.n).join(',')));
  s = await scr(info.rx, info.ry); await p.mouse.click(s.x, s.y, { button: 'right' }); await p.waitForTimeout(3000);
  log.push('orden=' + await p.evaluate(id => { const u = PE_GAME.G.byId.get(id); return u.order.t + ' carry=' + u.carry; }, info.id));
  // 2) construir una casa con Q (económicos) + Q (casa) y clic
  await p.keyboard.press('q'); await p.waitForTimeout(100); await p.keyboard.press('q'); await p.waitForTimeout(100);
  log.push('placing=' + await p.evaluate(() => UI.placing));
  const spot = await p.evaluate(() => { const G = PE_GAME.G, s = G.map.starts[0]; for (let r = 4; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (canPlace(0, 'house', s.x + dx, s.y + dy)) { G.cam.x = (s.x + dx) * 16; G.cam.y = (s.y + dy) * 16; return { x: (s.x + dx + 1) * 16, y: (s.y + dy + 1) * 16 }; } });
  await p.waitForTimeout(150); s = await scr(spot.x, spot.y); await p.mouse.move(s.x, s.y); await p.mouse.click(s.x, s.y); await p.waitForTimeout(200);
  log.push('casa=' + await p.evaluate(() => PE_GAME.G.blds.filter(b => b.team === 0 && b.type === 'house').map(b => (b.done ? 'hecha' : 'obra') + ' nb' + b.nb).join(',')));
  // 3) centro urbano: H, entrenar con Q, punto de reunión con clic derecho
  await p.keyboard.press('h'); await p.waitForTimeout(100); await p.keyboard.press('q'); await p.keyboard.press('q');
  log.push('cola=' + await p.evaluate(() => PE_GAME.G.sel[0].queue.length));
  s = await scr((await p.evaluate(() => PE_GAME.G.cam.x)) + 60, (await p.evaluate(() => PE_GAME.G.cam.y)) + 30); await p.mouse.click(s.x, s.y, { button: 'right' });
  log.push('rally=' + await p.evaluate(() => !!PE_GAME.G.sel[0].rally));
  // 4) caja de selección y tecla . de inactivos, M de ejército
  await p.keyboard.press('Escape'); await p.mouse.move(100, 120); await p.mouse.down(); await p.mouse.move(1200, 600, { steps: 5 }); await p.mouse.up();
  log.push('caja=' + await p.evaluate(() => PE_GAME.G.sel.length));
  await p.keyboard.press('m'); log.push('ejercito=' + await p.evaluate(() => PE_GAME.G.sel.length));
  // 5) muro arrastrando (avanzar a Era II por código)
  await p.evaluate(() => { const G = PE_GAME.G; G.players[0].age = 2; G.sel = G.units.filter(u => u.team === 0 && u.def.role === 'worker').slice(0, 2); UI.page = 'eco'; updateSelectionUI(true); });
  await p.evaluate(() => startPlacing('wall'));
  const wp = await p.evaluate(() => { const G = PE_GAME.G, s = G.map.starts[0]; G.cam.x = (s.x + 8) * 16; G.cam.y = (s.y - 6) * 16; return { x0: (s.x + 5) * 16 + 8, y: (s.y - 6) * 16 + 8, x1: (s.x + 11) * 16 + 8 }; });
  await p.waitForTimeout(150);
  let a = await scr(wp.x0, wp.y), c = await scr(wp.x1, wp.y); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up();
  log.push('muros=' + await p.evaluate(() => PE_GAME.G.blds.filter(b => b.team === 0 && b.type === 'wall').length));
  // 6) camino
  await p.evaluate(() => { UI.roadMode = true; });
  a = await scr(wp.x0, wp.y + 32); c = await scr(wp.x1, wp.y + 32); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up();
  log.push('caminos=' + await p.evaluate(() => { let n = 0; for (const t of PE_GAME.G.map.terr) if (t === TR.ROAD) n++; return n; }));
  // 7) menú, ayuda y diplomacia
  await p.keyboard.press('p'); await p.waitForTimeout(100); log.push('menu=' + await p.evaluate(() => UI.modal && UI.paused));
  await p.keyboard.press('Escape'); log.push('cerrado=' + await p.evaluate(() => !UI.modal && !UI.paused));
  await p.waitForTimeout(500); await p.screenshot({ path: 'tools/out/play.png' });
  console.log(log.join('\n')); console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'SIN ERRORES'); await b.close();
})();
