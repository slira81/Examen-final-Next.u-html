// Paridad: ejecuta dos builds con aleatoriedad determinista y compara la huella del estado.
const { chromium } = require('playwright');
const files = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const out = [];
  for (const f of files) {
    const p = await b.newPage({ viewport: { width: 1366, height: 800 } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { let a = 123456789; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; performance.now = (() => { let t = 0; return () => (t += 16); })(); });
    await p.goto('file://' + require('path').resolve(f));
    const sig = await p.evaluate(() => {
      // re-sembrar justo antes de la partida: lo que consuman los módulos al cargar (Three.js crea UUIDs) no cuenta
      let a = 987654321; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const players = ['human', 'elf', 'dwarf', 'orc'].map((r, i) => ({ race: r, color: i, human: false, team: 0, diff: 'normal', name: 'P' + i }));
      PE_GAME.startGame({ seed: 4242, size: 96, mapType: 'continental', players, resources: 'normal', weather: true, disasters: true, observer: true });
      const G = PE_GAME.G; UI.paused = true;
      for (let i = 0; i < 30 * 60 * 8; i++) PE_GAME.simStep(1 / 30);
      let h = 0; const mix = v => { h = (Math.imul(h ^ Math.round(v * 100), 2654435761) >>> 0); };
      for (const u of G.units) { mix(u.id); mix(u.x); mix(u.y); mix(u.hp); mix(u.lvl); }
      for (const b of G.blds) { mix(b.id); mix(b.tx); mix(b.ty); mix(b.hp); }
      for (const p of G.players) for (const k in p.res) mix(p.res[k]);
      return { hash: h, units: G.units.length, blds: G.blds.length, res: G.players.map(p => Object.values(p.res).map(Math.round).join('/')).join(' | '), time: Math.round(G.time) };
    });
    const camInfo = await p.evaluate(() => { UI.paused = true; INPUT.inWin = false; INPUT.mx = -1; const G = PE_GAME.G, tc = G.blds.find(b => b.type === 'tc'); G.cam.x = (tc.tx + 2) * 16; G.cam.y = (tc.ty + 2) * 16; return JSON.stringify({ tc: [tc.tx, tc.ty], cam: G.cam }); });
    await p.waitForTimeout(300);
    const camAfter = await p.evaluate(() => JSON.stringify({ cam: PE_GAME.G.cam, S: VIEW.S, w: VIEW.w, h: VIEW.h }));
    console.log('cam', camInfo, camAfter); await p.screenshot({ path: 'tools/out/parity_' + out.length + '.png' });
    out.push({ file: f, sig, errs }); await p.close();
  }
  for (const o of out) console.log(o.file.split('/').pop(), JSON.stringify(o.sig), o.errs.length ? 'ERRORES ' + o.errs.join('; ') : 'sin errores');
  console.log(out.length === 2 && out[0].sig.hash === out[1].sig.hash ? 'PARIDAD EXACTA' : 'DIFERENCIAS');
  await b.close();
})();
