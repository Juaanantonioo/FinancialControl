/** Sin conexión, y aviso al cerrar la pestaña con cambios sin subir. */
import { expect, test } from '@playwright/test';

import es from '@/i18n/es.json';

import {
  altaEnWeb,
  anotarGasto,
  CONTRASENA,
  correoDePrueba,
  crearPrimeraCuenta,
  entrarEnWeb,
  esperarDentro,
  esperarFilasRemotas,
  filasRemotas,
} from './apoyo';

test('sin conexión: lo dice, no pierde lo escrito, y al volver lo sube', async ({
  page,
  context,
}) => {
  const correo = correoDePrueba('sinred');
  await altaEnWeb(page, correo);
  await crearPrimeraCuenta(page, 'Banco', '500,00');
  await esperarFilasRemotas(correo, 10);
  await expect(page.getByTestId('banda-sin-conexion')).toBeHidden();

  await context.setOffline(true);
  await expect(page.getByTestId('banda-sin-conexion')).toContainText(es.web.sinConexion);
  // La app sigue respondiendo y lo escrito se queda en pantalla.
  await anotarGasto(page, ['4', '2'], 'Anotado sin conexión');
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText('Anotado sin conexión')).toBeVisible();
  await page.waitForTimeout(5000);
  // No ha subido: el servidor sigue con las diez filas.
  expect(filasRemotas(correo)).toBe(10);
  await expect(page.getByTestId('banda-sin-conexion')).toBeVisible();
  await expect(page.getByText('Anotado sin conexión')).toBeVisible();

  await context.setOffline(false);
  // Sube solo, sin tocar nada, y el aviso se va.
  await esperarFilasRemotas(correo, 11);
  await expect(page.getByTestId('banda-sin-conexion')).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText('Anotado sin conexión')).toBeVisible();

  // Y está de verdad en la cuenta: tras recargar y entrar, sigue ahí.
  await page.reload();
  await entrarEnWeb(page, correo, CONTRASENA, { yaEnLaPagina: true });
  await esperarDentro(page);
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText('Anotado sin conexión')).toBeVisible();
});

test('sin conexión no se puede entrar, y la puerta lo dice', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('puerta-de-entrada')).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByTestId('sin-conexion')).toContainText(es.web.sinConexionAlEntrar);
  await page.getByTestId('cambiar-de-modo').click();
  await page.getByTestId('correo').fill(correoDePrueba('nadie'));
  await page.getByTestId('contrasena').fill(CONTRASENA);
  await page.getByTestId('enviar').click();
  await expect(page.getByTestId('texto-de-error')).toContainText(
    es.usuario.error_sin_conexion.slice(0, 30),
  );
  // Lo escrito sigue en el formulario.
  await expect(page.getByTestId('correo')).not.toHaveValue('');
  await expect(page.getByTestId('pestana-index')).toBeHidden();
});

test('al cerrar la pestaña con cambios sin subir, el navegador pregunta; sin cambios, no', async ({
  page,
  context,
}) => {
  const correo = correoDePrueba('cerrar');
  await altaEnWeb(page, correo);
  await crearPrimeraCuenta(page, 'Banco', '500,00');
  await esperarFilasRemotas(correo, 10);
  // Hace falta haber tocado la página para que el navegador acepte preguntar: ya se ha hecho.

  /** Intenta recargar y dice si el navegador preguntó. La respuesta es «quedarse». */
  async function preguntaAlSalir(): Promise<boolean> {
    let pregunto = false;
    const alDialogo = async (dialogo: import('@playwright/test').Dialog) => {
      pregunto = dialogo.type() === 'beforeunload';
      await dialogo.dismiss();
    };
    page.once('dialog', alDialogo);
    await page.evaluate(() => window.location.reload()).catch(() => undefined);
    await page.waitForTimeout(1500);
    page.off('dialog', alDialogo);
    return pregunto;
  }

  // Con un cambio que no puede subir, pregunta. Y al quedarse, el cambio sigue ahí.
  await context.setOffline(true);
  await anotarGasto(page, ['7'], 'Sin subir todavía');
  expect(await preguntaAlSalir()).toBe(true);
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText('Sin subir todavía')).toBeVisible();

  // Cuando ya ha subido todo, deja salir sin preguntar.
  await context.setOffline(false);
  await esperarFilasRemotas(correo, 11);
  await expect(page.getByTestId('banda-sin-conexion')).toBeHidden({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  expect(await preguntaAlSalir()).toBe(false);
  await expect(page.getByTestId('puerta-de-entrada')).toBeVisible();
});
