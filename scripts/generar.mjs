// Genera la carpeta "dist" con la web lista para GitHub Pages.
// Lo ejecuta GitHub Actions cada pocos minutos: recoge las carteleras y crea listings.json.
import { getListings } from '../netlify/functions/listings.mts';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const data = await getListings(true);
if (!data.sessions.length) {
  // Si no hay nada, falla a propósito: así se conserva la última versión publicada.
  throw new Error('No se obtuvo ninguna sesión; no se publica.');
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('vendor', 'dist/vendor', { recursive: true });
await cp('lib', 'dist/lib', { recursive: true, filter: src => !src.endsWith('.ts') });
await cp('styles.css', 'dist/styles.css');
await writeFile('dist/listings.json', JSON.stringify(data));
await writeFile('dist/.nojekyll', '');

// Copias de index.html y app.js adaptadas a GitHub Pages (el original sigue valiendo para Netlify).
async function adaptar(archivo, cambios, obligatorio = false) {
  let texto = await readFile(archivo, 'utf8');
  for (const [buscar, poner] of cambios) {
    if (!texto.includes(buscar)) {
      if (obligatorio) throw new Error(`No se encontró en ${archivo}: ${buscar}`);
      console.warn(`Aviso: no se encontró en ${archivo}: ${buscar}`);
      continue;
    }
    texto = texto.replaceAll(buscar, poner);
  }
  return texto;
}

await writeFile('dist/index.html', await adaptar('index.html', [
  ['href="/styles.css"', 'href="styles.css"'],
  ['src="/vendor/smartcrop.js"', 'src="vendor/smartcrop.js"'],
  ['src="/app.js"', 'src="app.js"'],
  ['<meta charset="UTF-8">', '<meta charset="UTF-8"><meta name="referrer" content="no-referrer">'],
], true));

await writeFile('dist/app.js', await adaptar('app.js', [
  ["'/.netlify/functions/listings'", "'listings.json'"],
], false));

// Sin las funciones de Netlify, los carteles se cargan directamente desde la web de cada cine.
await writeFile('dist/lib/posters.js', await adaptar('lib/posters.js', [
  ["sources.push({url:`/.netlify/functions/cinema-poster?url=${encodeURIComponent(url)}`,label:session.venue});", ''],
  ["sources.push({url:`/.netlify/functions/letterboxd-poster?${params}`,label:'Letterboxd'});", ''],
]));

console.log(`Listo: ${data.sessions.length} sesiones, ${data.sources.filter(s => s.available).length}/${data.sources.length} fuentes disponibles.`);

console.log('Fuentes que han fallado:');

data.sources
  .filter(s => !s.available)
  .forEach(s => console.log('-', s.name));
