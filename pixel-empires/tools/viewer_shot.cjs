// Captura del visor de modelos 3D.
// Uso: node tools/viewer_shot.cjs <dist/index.html> <salida.png> "viewer=units&filter=human_&anim=walk" [ancho alto]
const { chromium } = require('playwright');
(async () => {
  const [file, out, query, w, h] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(w || 1400), height: +(h || 900) } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(file) + '?' + query);
  await p.waitForFunction(() => window.__viewerReady, null, { timeout: 120000 });
  await p.waitForTimeout(400);
  await p.screenshot({ path: out });
  console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'SIN ERRORES');
  await b.close();
})();
