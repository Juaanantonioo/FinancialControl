/**
 * Lanza las pruebas de la versión web en un navegador real.
 * Uso: `npm run test:web` (antes: `npx supabase start`).
 *
 * 1. Lee la dirección y la clave pública de la instancia LOCAL de Supabase.
 * 2. Exporta el sitio contra esa instancia (`npm run web:exportar`), con las
 *    cabeceras definitivas. Con SIN_EXPORTAR=1 reutiliza `dist/`.
 * 3. Lanza Playwright, que sirve `dist/` con `scripts/servir-web.cjs`.
 *
 * Se niega a funcionar contra nada que no sea esta máquina: las pruebas crean
 * y borran usuarios. La carpeta `dist/` que deja apunta a la instancia local:
 * no es la que se publica.
 */
const { execFileSync, spawnSync } = require('node:child_process');

function estado() {
  try {
    return execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

const variables = Object.fromEntries(
  estado()
    .split('\n')
    .map((linea) => /^([A-Z_]+)="?([^"]*)"?$/.exec(linea.trim()))
    .filter(Boolean)
    .map(([, nombre, valor]) => [nombre, valor]),
);
const url = variables.API_URL;
const clavePublica = variables.ANON_KEY || variables.PUBLISHABLE_KEY;

if (!url || !clavePublica) {
  process.stderr.write(
    'La instancia local de Supabase no está en marcha. Arráncala con: npx supabase start\n',
  );
  process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  process.stderr.write('Estas pruebas solo se ejecutan contra la instancia local.\n');
  process.exit(1);
}

const entorno = {
  ...process.env,
  EXPO_PUBLIC_SUPABASE_URL: url,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: clavePublica,
  SUPABASE_LOCAL_URL: url,
  SUPABASE_LOCAL_CLAVE_PUBLICA: clavePublica,
};

if (!process.env.SIN_EXPORTAR) {
  const exportacion = spawnSync('npm', ['run', 'web:exportar'], { stdio: 'inherit', env: entorno });
  if (exportacion.status !== 0) process.exit(exportacion.status ?? 1);
}

const pruebas = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: entorno,
});
process.exit(pruebas.status ?? 1);
