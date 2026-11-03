// Captura de la pantalla de título (fondo 3D) y del menú de gráficos. Uso: node tools/setup_shot.cjs salida.png [ancho alto]
const { chromium } = require('playwright');
(async () => {
  const [out, w, h] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(w || 1366), height: +(h || 800) } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  await p.waitForTimeout(6000);
  await p.screenshot({ path: out || 'tools/out/setup.png' });
  await p.evaluate(() => document.getElementById('s-gfx').click()); await p.waitForTimeout(800);
  await p.screenshot({ path: (out || 'tools/out/setup.png').replace('.png', '_gfx.png') });
  console.log(errs.length ? [...new Set(errs)].slice(0, 10).join('\n') : 'SIN ERRORES'); await b.close();
})();
