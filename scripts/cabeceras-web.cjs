/**
 * Último paso de la exportación web: escribe en `dist/_headers` la dirección
 * del proyecto de Supabase dentro de la política de seguridad de contenido.
 *
 * La política solo deja conectar con el propio sitio y con ese proyecto. La
 * dirección es la misma que usa la app: la variable EXPO_PUBLIC_SUPABASE_URL
 * del entorno o del fichero `.env`. De `.env` solo se lee esa línea.
 *
 * Falla (y la exportación con él) si no hay dirección, si no es https salvo en
 * esta máquina, o si queda alguna marca sin sustituir.
 */
const fs = require('node:fs');
const path = require('node:path');

const CARPETA = path.resolve(process.env.CARPETA || 'dist');
const fichero = path.join(CARPETA, '_headers');
const MARCA = '__SUPABASE__';

function direccionDeSupabase() {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL) return process.env.EXPO_PUBLIC_SUPABASE_URL;
  try {
    const linea = fs
      .readFileSync('.env', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('EXPO_PUBLIC_SUPABASE_URL='));
    return linea
      ? linea
          .slice(linea.indexOf('=') + 1)
          .trim()
          .replace(/^["']|["']$/g, '')
      : '';
  } catch {
    return '';
  }
}

function fallar(mensaje) {
  process.stderr.write(`cabeceras-web: ${mensaje}\n`);
  process.exit(1);
}

let origen;
try {
  origen = new URL(direccionDeSupabase()).origin;
} catch {
  fallar('falta EXPO_PUBLIC_SUPABASE_URL (en el entorno o en .env), o no es una dirección.');
}
const esLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origen);
if (!origen.startsWith('https://') && !esLocal) {
  fallar('la dirección de Supabase debe ser https.');
}
if (!fs.existsSync(fichero)) fallar(`no existe ${fichero}. ¿Se ha exportado el sitio?`);

const contenido = fs.readFileSync(fichero, 'utf8');
if (!contenido.includes(MARCA)) fallar('el fichero de cabeceras no tiene la marca de Supabase.');
const final = contenido.split(MARCA).join(origen);
const csp = /Content-Security-Policy: (.*)/.exec(final)?.[1] ?? '';
// Cloudflare Pages no admite cabeceras de más de 2.000 caracteres.
if (csp.length === 0 || csp.length > 2000) fallar('la política de seguridad no cabe o falta.');
fs.writeFileSync(fichero, final);
process.stdout.write(
  `cabeceras-web: el sitio solo podrá conectar con su propio origen y con ${origen}${esLocal ? ' (instancia LOCAL: no publiques esta carpeta)' : ''}\n`,
);
