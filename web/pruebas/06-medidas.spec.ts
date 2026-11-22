/**
 * Medidas: Argon2id (64 MiB, 8 pasadas) en el navegador de escritorio y con
 * emulación de móvil, memoria, tamaño del sitio y tiempo de carga. Las deja en
 * test-results/medidas-web.json para el informe.
 *
 * La emulación de móvil frena el procesador y pone la pantalla y el agente de
 * un teléfono; NO limita la memoria. La medida en un móvil real no está hecha.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

import { devices, expect, test, type Page } from '@playwright/test';

import { altaEnWeb, correoDePrueba } from './apoyo';

const medidas: Record<string, unknown> = {};

test.afterAll(() => {
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/medidas-web.json', `${JSON.stringify(medidas, null, 2)}\n`);
});

/** Mide la derivación tres veces desde Ajustes › Diagnóstico. Milisegundos. */
async function medirDerivacion(page: Page): Promise<number[]> {
  await page.getByTestId('pestana-index').click();
  await page.getByTestId('boton-ajustes').click();
  await page.getByTestId('ajuste-diagnostico').click();
  // La biblioteca del navegador da los vectores conocidos.
  await expect(page.getByTestId('resultado-cripto')).toContainText('✓', { timeout: 60_000 });
  const tiempos: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId('medir-derivacion').click();
    await expect(page.getByTestId('resultado-derivacion')).toContainText(/\d+ ms/, {
      timeout: 120_000,
    });
    const texto = (await page.getByTestId('resultado-derivacion').textContent()) ?? '';
    tiempos.push(Number(/(\d+) ms/.exec(texto)![1]));
    await page.waitForTimeout(300);
  }
  return tiempos;
}

/** Memoria de la pestaña, incluida la de WebAssembly. Solo existe con la página aislada. */
const memoriaEnMiB = (page: Page) =>
  page.evaluate(async () => {
    const medir = (
      performance as unknown as {
        measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
      }
    ).measureUserAgentSpecificMemory;
    if (!medir) return null;
    try {
      return Math.round((await medir.call(performance)).bytes / 1048576);
    } catch {
      return null;
    }
  });

test('Argon2id en el navegador de escritorio', async ({ page }) => {
  const t0 = Date.now();
  await altaEnWeb(page, correoDePrueba('medida'));
  const alta = Date.now() - t0;
  const tiempos = await medirDerivacion(page);
  medidas.escritorio = {
    derivacionMs: tiempos,
    altaCompletaMs: alta,
    memoriaTrasUsarMiB: await memoriaEnMiB(page),
  };
  // 64 MiB y 8 pasadas funcionan, y en un tiempo que no estorba.
  expect(Math.max(...tiempos)).toBeLessThan(5_000);
});

test('Argon2id con emulación de móvil (procesador frenado 4×)', async ({ browser }) => {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-ES' });
  const page = await contexto.newPage();
  const cdp = await contexto.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  // El alta entera, con su derivación y su autocomprobación, funciona.
  await altaEnWeb(page, correoDePrueba('movil'));
  const alta = Date.now() - t0;
  const tiempos = await medirDerivacion(page);
  medidas.movilEmulado = {
    dispositivo: 'Pixel 7 (emulado), procesador ×4 más lento',
    derivacionMs: tiempos,
    altaCompletaMs: alta,
    memoriaTrasUsarMiB: await memoriaEnMiB(page),
  };
  expect(Math.max(...tiempos)).toBeLessThan(20_000);
  await contexto.close();
});

test('tamaño del sitio exportado y tiempo de carga inicial', async ({ browser }) => {
  // Tamaño en disco y lo que viajaría comprimido.
  const ficheros: { ruta: string; bytes: number; gzip: number }[] = [];
  const recorrer = (carpeta: string) => {
    for (const nombre of readdirSync(carpeta)) {
      const ruta = join(carpeta, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else {
        const contenido = readFileSync(ruta);
        ficheros.push({ ruta, bytes: contenido.length, gzip: gzipSync(contenido).length });
      }
    }
  };
  recorrer('dist');
  const suma = (campo: 'bytes' | 'gzip') => ficheros.reduce((total, f) => total + f[campo], 0);
  const mayores = [...ficheros]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 4)
    .map(
      (f) =>
        `${f.ruta.replace(/-[0-9a-f]{32}/, '').replace(/\.[0-9a-f]{32}/, '')}: ${Math.round(f.bytes / 1024)} KiB`,
    );

  // Carga en frío (sin caché), tres veces: hasta que el formulario de entrada responde.
  const cargas: number[] = [];
  let pedidoKiB = 0;
  for (let i = 0; i < 3; i += 1) {
    const contexto = await browser.newContext({ locale: 'es-ES' });
    const page = await contexto.newPage();
    let bytes = 0;
    page.on('response', async (respuesta) => {
      bytes += (await respuesta.body().catch(() => Buffer.alloc(0))).length;
    });
    const t0 = Date.now();
    await page.goto('/');
    await page.getByTestId('correo').waitFor();
    cargas.push(Date.now() - t0);
    await page.waitForTimeout(500);
    pedidoKiB = Math.round(bytes / 1024);
    await contexto.close();
  }
  medidas.sitio = {
    ficheros: ficheros.length,
    tamanoKiB: Math.round(suma('bytes') / 1024),
    comprimidoConGzipKiB: Math.round(suma('gzip') / 1024),
    mayores,
    descargadoHastaElFormularioKiB: pedidoKiB,
    cargaEnFrioMs: cargas,
    nota: 'Servidor en la misma máquina: sin red de por medio. Sin compresión en el servidor de pruebas.',
  };
  expect(suma('bytes')).toBeLessThan(15 * 1024 * 1024);
  expect(Math.min(...cargas)).toBeLessThan(10_000);
});
