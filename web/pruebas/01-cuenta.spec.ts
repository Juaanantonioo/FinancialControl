/**
 * Alta, código de recuperación, uso, cierre y nueva entrada, en un navegador
 * real sobre el sitio exportado con sus cabeceras definitivas.
 */
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
  vigilar,
} from './apoyo';

test('alta, código de recuperación, uso, cierre y nueva entrada', async ({ page }) => {
  const consola = vigilar(page);
  const correo = correoDePrueba('alta');

  // Sin cuenta, lo único que hay es la puerta: entrar o crear, con sus avisos.
  await page.goto('/');
  await expect(page.getByTestId('puerta-de-entrada')).toBeVisible();
  await expect(page.getByTestId('aviso-de-beta')).toContainText(es.web.betaTitulo);
  await expect(page.getByTestId('aviso-sin-recuperacion')).toContainText(
    'todavía no se puede usar',
  );
  await expect(page.getByTestId('aviso-de-beta')).toContainText(es.web.sinRecuperacionTitulo);
  // La app no se ve ni se alcanza hasta entrar.
  await expect(page.getByTestId('pestana-index')).toBeHidden();
  await expect(page.getByTestId('boton-anadir')).toBeHidden();

  const grupos = await altaEnWeb(page, correo);
  expect(grupos).toHaveLength(14);
  await expect(page.getByTestId('patrimonio-total')).toBeVisible();

  // Uso: una cuenta y dos gastos.
  await crearPrimeraCuenta(page, 'Cuenta de la web', '1.500,00');
  await anotarGasto(page, ['2', '3', 'decimal', '4', '0'], 'Mercado central');
  await anotarGasto(page, ['9', 'decimal', '9', '5'], 'Café');
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText('Mercado central')).toBeVisible();
  await expect(page.getByText('Café', { exact: true })).toBeVisible();
  await page.getByTestId('pestana-cuentas').click();
  await expect(page.getByTestId('saldo-Cuenta de la web')).toContainText('1.466,65');
  // Las cinco secciones abren.
  for (const pestana of ['analisis', 'plan', 'cuentas', 'movimientos', 'index']) {
    await page.getByTestId(`pestana-${pestana}`).click();
    await expect(page.getByTestId(`pestana-${pestana}`)).toHaveAttribute('aria-current', 'page');
  }
  // Todo ha subido cifrado: 9 categorías iniciales, 1 cuenta y 2 movimientos.
  await esperarFilasRemotas(correo, 12);

  // Cierre: vuelve la puerta, y el correo queda puesto en el formulario.
  await page.getByTestId('boton-ajustes').click();
  await page.getByTestId('abrir-cuenta').click();
  await expect(page.getByTestId('estado-de-sincronizacion')).toContainText(es.sinc.alDia);
  await expect(page.getByTestId('cambios-pendientes')).toContainText(es.sinc.sinPendientes);
  await page.getByTestId('cerrar-sesion').click();
  await expect(page.getByTestId('puerta-de-entrada')).toBeVisible();
  await expect(page.getByTestId('correo')).toHaveValue(correo);
  await expect(page.getByTestId('contrasena')).toHaveValue('');

  // Con una contraseña equivocada no se entra, y no se dice cuál de las dos cosas falla.
  await entrarEnWeb(page, correo, 'esta no es la contraseña', { yaEnLaPagina: true });
  await expect(page.getByTestId('texto-de-error')).toContainText(es.usuario.error_credenciales);

  // Nueva entrada: los datos vuelven, descifrados.
  await page.getByTestId('contrasena').fill(CONTRASENA);
  await page.getByTestId('enviar').click();
  await esperarDentro(page);
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText('Mercado central')).toBeVisible();
  await page.getByTestId('pestana-cuentas').click();
  await expect(page.getByTestId('saldo-Cuenta de la web')).toContainText('1.466,65');
  // Sin categorías duplicadas tras bajar: siguen siendo nueve filas en el servidor.
  expect(await esperarFilasRemotas(correo, 12)).toBe(12);

  // Lo único que ha salido por la consola es el rechazo del servidor a la contraseña equivocada.
  expect(consola).toEqual([
    'error: Failed to load resource: the server responded with a status of 400 (Bad Request)',
  ]);
});

test('recargar la página pide la contraseña y recupera los datos', async ({ page }) => {
  const correo = correoDePrueba('recarga');
  await altaEnWeb(page, correo);
  await crearPrimeraCuenta(page, 'Ahorros', '250,00');
  await anotarGasto(page, ['1', '2'], 'Antes de recargar');
  await esperarFilasRemotas(correo, 11);

  await page.reload();
  // Tras recargar no hay sesión: se ve la puerta, no la app.
  await expect(page.getByTestId('puerta-de-entrada')).toBeVisible();
  await expect(page.getByTestId('pestana-index')).toBeHidden();
  await expect(page.getByTestId('correo')).toHaveValue(correo);
  await expect(page.getByTestId('contrasena')).toHaveValue('');

  await entrarEnWeb(page, correo, CONTRASENA, { yaEnLaPagina: true });
  await esperarDentro(page);
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByText('Antes de recargar')).toBeVisible();
  await page.getByTestId('pestana-cuentas').click();
  await expect(page.getByTestId('saldo-Ahorros')).toContainText('238,00');
});
