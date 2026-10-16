// Assembla l'applicazione in un unico file HTML.
//   node app/build.mjs
// Produce:
//   app/dist/estratti-conto.html  corpo della pagina (pubblicato come Artifact su claude.ai)
//   app/dist/index.html           pagina completa (in locale o su Firebase Hosting)
//   app/dist/firebase-config.js   copia di app/firebase-config.js
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
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
  '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<script src="firebase-config.js"></script>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n',
);
copyFileSync(join(dir, 'firebase-config.js'), join(dir, 'dist/firebase-config.js'));
console.log('Creati app/dist/estratti-conto.html, app/dist/index.html e app/dist/firebase-config.js');
