/**
 * Sirve en esta máquina el sitio web exportado (`dist/`), con las MISMAS
 * cabeceras que tendrá publicado: las lee de `dist/_headers`, que es el
 * fichero que usa el alojamiento.
 *
 * Uso: `npm run web:servir` (antes: `npm run web:exportar`).
 * Opciones por entorno: PUERTO (por defecto 4173) y CARPETA (por defecto dist).
 *
 * Solo escucha en 127.0.0.1. Es para probar, no para publicar.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const CARPETA = path.resolve(process.env.CARPETA || 'dist');
const PUERTO = Number(process.env.PUERTO || 4173);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Lee un fichero `_headers`: una ruta sin sangría y, debajo, con sangría, sus
 * cabeceras («Nombre: valor»). Las líneas que empiezan por # son comentarios.
 * La ruta admite un * al final.
 */
function leerCabeceras(fichero) {
  if (!fs.existsSync(fichero)) return [];
  const reglas = [];
  for (const linea of fs.readFileSync(fichero, 'utf8').split('\n')) {
    if (linea.trim() === '' || linea.trim().startsWith('#')) continue;
    if (!/^\s/.test(linea)) {
      reglas.push({ ruta: linea.trim(), cabeceras: [] });
    } else if (reglas.length > 0) {
      const corte = linea.indexOf(':');
      if (corte > 0) {
        reglas[reglas.length - 1].cabeceras.push([
          linea.slice(0, corte).trim(),
          linea.slice(corte + 1).trim(),
        ]);
      }
    }
  }
  return reglas;
}

function coincide(ruta, patron) {
  return patron.endsWith('*') ? ruta.startsWith(patron.slice(0, -1)) : ruta === patron;
}

const reglas = leerCabeceras(path.join(CARPETA, '_headers'));

const servidor = http.createServer((peticion, respuesta) => {
  const ruta = decodeURIComponent(new URL(peticion.url, 'http://x').pathname);
  let fichero = path.join(CARPETA, ruta);
  // Nada fuera de la carpeta, y el fichero de cabeceras no se sirve.
  if (!fichero.startsWith(CARPETA) || ruta === '/_headers') {
    respuesta.writeHead(404).end();
    return;
  }
  if (fs.existsSync(fichero) && fs.statSync(fichero).isDirectory()) {
    fichero = path.join(fichero, 'index.html');
  }
  // Aplicación de una sola página: una ruta sin fichero recibe index.html.
  if (!fs.existsSync(fichero)) {
    if (path.extname(ruta) !== '') {
      respuesta.writeHead(404).end();
      return;
    }
    fichero = path.join(CARPETA, 'index.html');
  }
  for (const regla of reglas) {
    if (!coincide(ruta, regla.ruta)) continue;
    for (const [nombre, valor] of regla.cabeceras) respuesta.setHeader(nombre, valor);
  }
  respuesta.setHeader('Content-Type', TIPOS[path.extname(fichero)] || 'application/octet-stream');
  fs.createReadStream(fichero).pipe(respuesta);
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  process.stdout.write(
    `Sitio servido en http://127.0.0.1:${PUERTO} (${reglas.length} reglas de cabeceras)\n`,
  );
});
