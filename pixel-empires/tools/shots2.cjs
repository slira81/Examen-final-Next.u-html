const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../dist/index.html'));
  await p.waitForTimeout(1500); await p.screenshot({ path: 'tools/out/setup.png' });
  await p.click('#s-gallery'); await p.waitForTimeout(800); await p.screenshot({ path: 'tools/out/gallery.png' });
  await p.click('[data-gal="orc"]'); await p.waitForTimeout(600); await p.screenshot({ path: 'tools/out/gallery_orc.png', fullPage: false });
  await p.click('[data-close]');
  await p.click('#s-start'); await p.waitForTimeout(1000);
  await p.click('#b-diplo'); await p.waitForTimeout(400); await p.screenshot({ path: 'tools/out/diplo.png' });
  console.log(errs.length ? errs.join('\n') : 'SIN ERRORES'); await b.close();
})();
