/**
 * Lanza las pruebas de aislamiento y de cuenta contra la instancia LOCAL de
 * Supabase. Uso: `npm run test:remoto` (antes: `npx supabase start`).
 *
 * Lee la dirección y la clave pública con `supabase status` y las pasa a las
 * pruebas por el entorno. No las escribe en disco ni las enseña. Se niega a
 * funcionar contra nada que no sea esta máquina: estas pruebas crean y
 * borran usuarios.
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

const resultado = spawnSync(
  'npx',
  ['jest', '--config', 'jest.remoto.config.js', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_LOCAL_URL: url, SUPABASE_LOCAL_CLAVE_PUBLICA: clavePublica },
  },
);
process.exit(resultado.status ?? 1);
