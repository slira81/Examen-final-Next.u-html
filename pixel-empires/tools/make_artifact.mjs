// A partir de dist/index.html genera:
//   index.html             copia en la raíz del proyecto (se abre con doble clic)
//   dist/artifact.html     versión sin <html>/<head>/<body> para publicar como página
import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1], body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keepHead = head.replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
// el título va primero para que la página lo detecte
const title = (keepHead.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'), title + '\n' + keepHead.replace(title, '') + '\n' + body);
fs.writeFileSync(path.join(ROOT, 'Pixel Empires.html'), html);
console.log('artefacto:', Math.round(fs.statSync(path.join(ROOT, 'dist', 'artifact.html')).size / 1024), 'KB');
