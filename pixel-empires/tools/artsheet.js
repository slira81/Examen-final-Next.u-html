// Renderiza una hoja de contacto de todo el arte registrado.
// Uso: node tools/artsheet.js out.png <archivo_arte.js> [más archivos...] [--kind=units] [--prefix=human_] [--scale=3] [--team=0]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const args = process.argv.slice(2), out = args[0];
  const files = args.slice(1).filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  const scale = +(opt.scale || 3), kindF = opt.kind || '', prefix = opt.prefix || '', team = +(opt.team || 0);
  const core = fs.readFileSync(path.join(__dirname, '..', 'src', '01_sprite.js'), 'utf8');
  const scripts = [core, ...files.map(f => fs.readFileSync(f, 'utf8'))];
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.setContent('<!doctype html><body style="margin:0;background:#2b2340"></body>');
  for (const s of scripts) await p.addScriptTag({ content: s });
  const dataUrl = await p.evaluate(({ scale, kindF, prefix, team }) => {
    const rows = [];
    for (const kind of ['units', 'buildings', 'nature', 'fx', 'icons']) {
      if (kindF && kind !== kindF) continue;
      for (const key of Object.keys(PE.ART[kind])) {
        if (prefix && !key.startsWith(prefix)) continue;
        const def = PE.ART[kind][key], frames = [];
        if (kind === 'units') {
          for (const an of ['idle', 'walk', 'attack']) PE.ANIMS[an].forEach((_, i) => frames.push(PE.frame(kind, key, i, { team, anim: an })));
          frames.push(PE.frame(kind, key, 0, { team: (team + 1) % 6, anim: 'idle' }));
          if (def.dead !== undefined || key.startsWith('animal_')) frames.push(PE.frame(kind, key, 0, { team, anim: 'idle', dead: true }));
        } else {
          const vars = def.variants || 1, masks = def.masks ? [0, 5, 10, 15, 3, 6, 12, 9] : [null];
          for (const m of masks) for (let v = 0; v < vars; v++) for (let f = 0; f < (def.frames || 1); f++) {
            const o = { team, v }; if (m !== null) o.mask = m; if (def.sizes) o.size = def.sizes[v % def.sizes.length];
            frames.push(PE.frame(kind, key, f, o));
          }
        }
        rows.push({ label: kind + ':' + key, frames });
      }
    }
    const pad = 6, lab = 14;
    let W = 0, H = 0;
    for (const r of rows) { r.w = r.frames.reduce((s, c) => s + c.width * scale + pad, 0); r.h = Math.max(...r.frames.map(c => c.height)) * scale; W = Math.max(W, r.w + 220); H += r.h + pad + 2; }
    const cv = document.createElement('canvas'); cv.width = Math.min(W, 8000); cv.height = Math.max(20, H); const x = cv.getContext('2d');
    x.fillStyle = '#2b2340'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false;
    let y = 2;
    for (const r of rows) {
      x.fillStyle = '#efe9f7'; x.font = '12px monospace'; x.fillText(r.label, 4, y + 12);
      let xx = 210;
      for (const c of r.frames) { x.fillStyle = '#352b4f'; x.fillRect(xx, y, c.width * scale, c.height * scale); x.drawImage(c, xx, y, c.width * scale, c.height * scale); xx += c.width * scale + pad; }
      y += r.h + pad + 2;
    }
    return cv.toDataURL('image/png');
  }, { scale, kindF, prefix, team });
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('ok', out, errs.length ? 'ERRORES:\n' + errs.join('\n') : 'sin errores');
  await b.close();
})();
