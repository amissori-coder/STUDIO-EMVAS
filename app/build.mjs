// Assembla l'applicazione in un unico file HTML.
//   node app/build.mjs
// Produce:
//   app/dist/estratti-conto.html  corpo della pagina (pubblicato come Artifact su claude.ai)
//   app/dist/index.html           pagina completa da aprire nel browser in locale
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const shell = readFileSync(join(dir, 'src/shell.html'), 'utf8');
const js = readFileSync(join(dir, 'src/app.js'), 'utf8');
const causali = readFileSync(join(dir, 'src/causali-template.json'), 'utf8').trim();

const app = js.replace('/*CAUSALI*/[]', () => causali);
const body = shell.replace('/*APP_JS*/', () => app);

mkdirSync(join(dir, 'dist'), { recursive: true });
writeFileSync(join(dir, 'dist/estratti-conto.html'), body);
writeFileSync(
  join(dir, 'dist/index.html'),
  '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n',
);
console.log('Creati app/dist/estratti-conto.html e app/dist/index.html');
