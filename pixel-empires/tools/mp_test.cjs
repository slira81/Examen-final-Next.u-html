// Prueba de multijugador con dos pestañas (canal local, ?mptest): sala con código, inicio, órdenes de los
// dos jugadores por la interfaz y comprobación de que ambas simulaciones siguen idénticas (huellas).
// Uso: node tools/mp_test.cjs [segundos de juego real]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
(async () => {
  const secs = +(process.argv[2] || 60);
  const root = path.resolve(__dirname, '../dist');
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); } }); }).listen(8765);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
  const errs = { A: [], B: [] };
  const open = async who => { const p = await ctx.newPage(); p.on('pageerror', e => errs[who].push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs[who].push(m.text().slice(0, 160)); }); await p.addInitScript(() => { window.__TEST__ = true; }); await p.goto('http://localhost:8765/index.html?mptest', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1500); return p; };
  const A = await open('A'), B = await open('B');
  const log = [];
  // A crea (cooperativo), B se une con el código
  await A.evaluate(() => { document.querySelector('.race[data-race="orc"]').click(); document.getElementById('s-rivals').value = '1'; buildRivals(); document.getElementById('s-mp').click(); });
  await A.waitForTimeout(300); await A.evaluate(() => { document.getElementById('mp-mode').value = 'coop'; document.getElementById('mp-create').click(); });
  await A.waitForTimeout(800);
  const code = await A.evaluate(() => (document.querySelector('.mpcode b') || {}).textContent);
  log.push('codigo=' + code);
  await B.evaluate(() => { document.querySelector('.race[data-race="elf"]').click(); document.getElementById('s-mp').click(); });
  await B.waitForTimeout(300); await B.evaluate(c => { document.getElementById('mp-code').value = c; document.getElementById('mp-join').click(); }, code);
  await A.waitForFunction(() => document.getElementById('mp-start'), null, { timeout: 15000 });
  log.push('A ve al invitado=' + await A.evaluate(() => document.getElementById('mp-status').textContent.includes('Elfos')));
  await A.evaluate(() => document.getElementById('mp-start').click());
  await B.waitForFunction(() => window.G && __net.NET.active, null, { timeout: 15000 });
  const info = p => p.evaluate(() => ({ human: G.human, players: G.players.map(p => p.race + (p.human ? '*' : '') + ':' + p.teamGroup).join(' '), net: __net.NET.active, tick: __net.NET.tick }));
  log.push('A ' + JSON.stringify(await info(A))); log.push('B ' + JSON.stringify(await info(B)));
  // órdenes por la capa de órdenes (las mismas funciones que usa la interfaz)
  const orders = p => p.evaluate(() => {
    const me = G.human, ws = G.units.filter(u => u.team === me && u.def.role === 'worker');
    const tree = G.resBy.tree.filter(r => !r.dead).sort((a, b) => Math.hypot(a.tx * 16 - ws[0].x, a.ty * 16 - ws[0].y) - Math.hypot(b.tx * 16 - ws[0].x, b.ty * 16 - ws[0].y))[0];
    for (const u of ws.slice(0, 3)) __act.startGather(u, tree);
    const tc = G.blds.find(b => b.team === me && b.type === 'tc'); __act.enqueue(tc, 'unit', G.players[me].race + '_worker'); __act.enqueue(tc, 'unit', G.players[me].race + '_worker');
    const s = G.map.starts[me]; let placed = false;
    for (let r = 4; r < 10 && !placed; r++) for (let dy = -r; dy <= r && !placed; dy++) for (let dx = -r; dx <= r && !placed; dx++) if (canPlace(me, 'house', s.x + dx, s.y + dy)) { __act.tryBuild(me, 'house', s.x + dx, s.y + dy, ws.slice(3, 4)); placed = true; }
    return ws.length;
  });
  log.push('ordenes A=' + await orders(A) + ' B=' + await orders(B));
  await A.evaluate(() => __act.setSpeed(2));
  await A.waitForTimeout(secs * 1000);
  // comparar huellas de los turnos comunes
  const hashes = p => p.evaluate(() => [...__net.NET.hashes.entries()]);
  const hA = new Map(await hashes(A)), hB = new Map(await hashes(B)); let common = 0, diff = 0;
  for (const [t, v] of hA) if (hB.has(t)) { common++; if (hB.get(t) !== v) diff++; }
  const st = p => p.evaluate(() => ({ t: Math.round(G.time), tick: __net.NET.tick, speed: G.speed, desync: __net.NET.desync, casas: G.blds.filter(b => b.type === 'house').length, unidades: G.units.length, cola: G.blds.filter(b => b.type === 'tc' && b.team < 2).map(b => b.queue.length).join('/') }));
  log.push('A ' + JSON.stringify(await st(A))); log.push('B ' + JSON.stringify(await st(B)));
  log.push('huellas comunes=' + common + ' distintas=' + diff);
  // desconexión: se cierra B; A debe seguir con el elfo en manos de la IA
  await B.close(); await A.waitForTimeout(16000);
  log.push('tras desconexión: ' + JSON.stringify(await A.evaluate(() => ({ net: __net.NET.active, elfoIA: !!G.players[1].ai, aviso: (document.getElementById('mp-wait') || {}).textContent, t: Math.round(G.time) }))));
  await A.screenshot({ path: 'tools/out/mp_A.png' });
  console.log(log.join('\n'));
  for (const k of ['A', 'B']) console.log(k + ': ' + (errs[k].length ? 'ERRORES ' + [...new Set(errs[k])].slice(0, 6).join(' | ') : 'SIN ERRORES'));
  await b.close(); srv.close();
})();
