/**
 * Web y nativo se entienden: una cuenta creada con el código de la app fuera
 * del navegador (el mismo que corre en el iPhone, con libsodium en Node) abre
 * en la web, y al revés. Las doce tablas se leen idénticas, campo a campo.
 *
 * Lo que la web tiene en su base en memoria se lee con su propia exportación.
 */
import { expect, test } from '@playwright/test';

import { sembrarTodo, type Dispositivo } from '@/pruebas/sincronizacionDePrueba';
import { TABLAS } from '@/sincronizacion/tablas';

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
  vigilar,
} from './apoyo';

test('una cuenta creada con el código nativo abre en la web, con las doce tablas idénticas', async ({
  page,
}) => {
  const consola = vigilar(page);
  const correo = correoDePrueba('nativo');
  const nativo = await dispositivoDeNode();
  await altaEnNode(nativo, correo);
  const datos = await sembrarTodo(nativo as unknown as Dispositivo);
  expect(await nativo.motor.subirLoLocal()).toEqual({ estado: 'lista', accion: 'subir' });
  expect((await nativo.motor.ciclo()).estado).toBe('correcto');
  const enNativo = await nativo.volcar();
  for (const tabla of TABLAS) expect(enNativo[tabla.nombre].length).toBeGreaterThan(0);

  // La misma contraseña, en el navegador: mismas claves, mismos sobres.
  await entrarEnWeb(page, correo);
  await esperarDentro(page);
  const { datos: exportado, nombre } = await exportarDesdeLaWeb(page);
  expect(nombre).toMatch(/^financialcontrol-\d{4}-\d{2}-\d{2}\.json$/);
  for (const tabla of TABLAS) {
    expect(exportado.tablas[tabla.nombre], tabla.nombre).toEqual(enNativo[tabla.nombre]);
  }
  // Y se ve en pantalla lo que se anotó fuera.
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText('Mercado', { exact: true })).toBeVisible();
  await page.getByTestId('pestana-cuentas').click();
  await expect(page.getByTestId('saldo-Banco')).toBeVisible();

  // Un cambio hecho en la web llega al dispositivo nativo.
  await anotarGasto(page, ['7', 'decimal', '5', '0'], 'Anotado en la web');
  await esperarFilasRemotas(correo, Object.values(enNativo).flat().length + 1);
  await nativo.motor.ciclo();
  const movimientos = (await nativo.volcar()).movimiento;
  const nuevo = movimientos.find((m) => m.nombre === 'Anotado en la web');
  expect(nuevo).toMatchObject({ importe: 750, tipo: 'gasto', cuenta_id: datos.banco.id });
  expect(consola).toEqual([]);
});

test('una cuenta creada en la web abre con el código nativo, con las mismas filas', async ({
  page,
}) => {
  const correo = correoDePrueba('web');
  await altaEnWeb(page, correo);
  await crearPrimeraCuenta(page, 'Cuenta «web» ñ €', '1.234,56');
  await anotarGasto(page, ['4', '5', 'decimal', '9', '0'], 'Gasto con tilde: café y señal');
  await esperarFilasRemotas(correo, 11);
  const { datos: enWeb } = await exportarDesdeLaWeb(page);

  const nativo = await dispositivoDeNode();
  expect(await nativo.gestor.iniciarSesion(correo, CONTRASENA)).toEqual({ ok: true });
  // Dispositivo recién instalado y nube con datos: baja, sin duplicar categorías.
  expect(await nativo.motor.evaluarEntrada()).toEqual({ estado: 'lista', accion: 'bajar' });
  expect(await nativo.motor.ciclo()).toMatchObject({ estado: 'correcto', retenidas: 0 });
  const enNativo = await nativo.volcar();
  for (const tabla of TABLAS) {
    expect(enNativo[tabla.nombre], tabla.nombre).toEqual(enWeb.tablas[tabla.nombre]);
  }
  expect(enNativo.categoria).toHaveLength(9);
  expect(enNativo.cuenta[0]).toMatchObject({ nombre: 'Cuenta «web» ñ €', saldo_inicial: 123456 });
  expect(enNativo.movimiento[0]).toMatchObject({
    nombre: 'Gasto con tilde: café y señal',
    importe: 4590,
  });
});
