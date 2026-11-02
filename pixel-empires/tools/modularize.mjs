// Convierte los scripts concatenados de src/*.js en módulos ES con imports/exports explícitos.
// Usa análisis de alcance (eslint-scope) para hallar los nombres libres de cada archivo.
import fs from 'fs'; import path from 'path';
import * as espree from 'espree'; import * as eslintScope from 'eslint-scope';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MAP = {
  '01_sprite.js': 'render/pixel/sprite.js', '02_vendor_zzfx.js': 'audio/zzfx.js',
  '10_art_units_a.js': 'render/pixel/art/units_a.js', '11_art_units_b.js': 'render/pixel/art/units_b.js',
  '12_art_buildings.js': 'render/pixel/art/buildings.js', '13_art_nature.js': 'render/pixel/art/nature.js', '14_art_fauna_fx.js': 'render/pixel/art/fauna_fx.js',
  '20_data.js': 'data/data.js', '30_map.js': 'map/map.js', '31_path.js': 'sim/path.js', '40_game.js': 'sim/game.js',
  '41_ai.js': 'ai/ai.js', '42_world.js': 'world/world.js', '43_diplo.js': 'world/diplo.js',
  '50_render.js': 'render/pixel/render.js', '51_ui.js': 'ui/ui.js', '52_input.js': 'input/input.js', '53_audio.js': 'audio/audio.js', '60_main.js': 'main.js',
};
const files = Object.keys(MAP), info = {};
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
  const ast = espree.parse(src, { ecmaVersion: 2024, sourceType: 'script', range: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: 'script' });
  const gs = sm.globalScope;
  const declared = gs.variables.filter(v => v.defs.length).map(v => v.name);
  const through = gs.through.map(r => ({ name: r.identifier.name, write: r.isWrite() }));
  info[f] = { src, declared: new Set(declared), through };
}
const owner = {}, dups = [];
for (const f of files) for (const n of info[f].declared) { if (owner[n] && owner[n] !== f) dups.push(n + ' en ' + owner[n] + ' y ' + f); owner[n] = owner[n] || f; }
const writes = [];
for (const f of files) {
  const imports = {};
  for (const { name, write } of info[f].through) {
    const o = owner[name]; if (!o || o === f) continue;
    (imports[o] = imports[o] || new Set()).add(name);
    if (write) writes.push(f + ' asigna ' + name + ' (de ' + o + ')');
  }
  const outPath = path.join(ROOT, 'src', MAP[f]);
  const rel = o => { let r = path.relative(path.dirname(outPath), path.join(ROOT, 'src', MAP[o])); if (!r.startsWith('.')) r = './' + r; return r; };
  const head = Object.keys(imports).sort((a, b) => files.indexOf(a) - files.indexOf(b)).map(o => `import { ${[...imports[o]].sort().join(', ')} } from '${rel(o)}';`).join('\n');
  let body = info[f].src.replace(/^'use strict';\n/m, '');
  const exp = [...info[f].declared];
  const out = (head ? head + '\n' : '') + body.trimEnd() + '\n' + (exp.length ? `\nexport { ${exp.join(', ')} };\n` : '');
  info[f].out = out; info[f].outPath = outPath; info[f].imports = imports;
}
if (process.argv.includes('--write')) for (const f of files) { fs.mkdirSync(path.dirname(info[f].outPath), { recursive: true }); fs.writeFileSync(info[f].outPath, info[f].out); }
console.log('Duplicados:', dups.length ? dups : 'ninguno');
console.log('Asignaciones entre módulos:', writes.length ? writes : 'ninguna');
for (const f of files) console.log(f, '->', MAP[f], '| importa de', Object.keys(info[f].imports).length, 'módulos | exporta', info[f].declared.size);
