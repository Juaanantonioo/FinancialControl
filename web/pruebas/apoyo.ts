/**
 * Apoyo de las pruebas de la versión web: lo que se hace con el navegador
 * (entrar, anotar, exportar, volcar los almacenes) y un «dispositivo» de Node
 * que usa el MISMO código de cuenta, cifrado y sincronización que la app, con
 * el cliente real de Supabase, para comprobar que web y nativo se entienden.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, type Download, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { gruposDelCodigo } from '@/cripto';
import type { CategoriaInicial } from '@/datos';
import { crearGestorDeCuenta, type ClienteDeCuenta } from '@/estado/cuenta';
import es from '@/i18n/es.json';
import { CLAVE_DE_DATOS_EN_EL_ALMACEN, type AlmacenSeguro } from '@/lib/almacenSeguro';
import { prepararPrueba } from '@/pruebas/bdDePrueba';
import { volcar } from '@/pruebas/sincronizacionDePrueba';
import { crearMotor } from '@/sincronizacion/motor';
import { crearServidorDeFilas } from '@/sincronizacion/servidor';

import { consultar } from '../../supabase/pruebas/apoyo';

export { consultar };

export const URL_LOCAL = process.env.SUPABASE_LOCAL_URL ?? '';
export const CLAVE_PUBLICA = process.env.SUPABASE_LOCAL_CLAVE_PUBLICA ?? '';
export const CONTRASENA = 'correcta batería caballo grapa';
export const SITIO = 'http://127.0.0.1:4173';

export const correoDePrueba = (nombre: string) =>
  `web-${nombre}-${randomUUID().slice(0, 8)}@prueba.example`;

/** Las categorías iniciales de la app, las mismas que crea `Datos.tsx`. */
export const INICIALES_DE_LA_APP: CategoriaInicial[] = [
  ...(['comida', 'casa', 'transporte', 'ocio', 'salud', 'compras', 'otrosGastos'] as const).map(
    (clave) => ({ nombre: es.categoriasIniciales[clave], tipo: 'gasto' as const }),
  ),
  ...(['nomina', 'otrosIngresos'] as const).map((clave) => ({
    nombre: es.categoriasIniciales[clave],
    tipo: 'ingreso' as const,
  })),
];

// ------------------------------------------------------------ dispositivo de Node

/** Un dispositivo «nativo» en Node: llavero, cliente real, cuenta, base local y motor. */
export async function dispositivoDeNode() {
  const llavero = new Map<string, string>();
  const almacen: AlmacenSeguro = {
    leer: async (clave) => llavero.get(clave) ?? null,
    guardar: async (clave, valor) => {
      llavero.set(clave, valor);
    },
    borrar: async (clave) => {
      llavero.delete(clave);
    },
  };
  const cliente = createClient(URL_LOCAL, CLAVE_PUBLICA, {
    auth: {
      persistSession: true,
      storageKey: 'fc.cuenta.sesion',
      storage: {
        getItem: (clave) => almacen.leer(clave),
        setItem: (clave, valor) => almacen.guardar(clave, valor),
        removeItem: (clave) => almacen.borrar(clave),
      },
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const gestor = crearGestorDeCuenta({
    cliente: cliente as unknown as ClienteDeCuenta,
    almacen,
    autocomprobar: async () => ({ correcta: true, milisegundosDeDerivacion: 1 }),
    pausaAntesDeCalcular: 0,
  });
  const base = await prepararPrueba(INICIALES_DE_LA_APP);
  const motor = crearMotor({
    bd: base.bd,
    servidor: crearServidorDeFilas(cliente),
    leerClave: () => gestor.leerClaveDeDatos(),
    ahora: base.entorno.ahora,
    categoriasIniciales: INICIALES_DE_LA_APP,
  });
  return {
    ...base,
    motor,
    gestor,
    volcar: () => volcar(base.bd),
    /** La clave de datos tal como se guarda en el llavero (base64 para URL). */
    claveDeDatos: () => llavero.get(CLAVE_DE_DATOS_EN_EL_ALMACEN) ?? '',
    sesion: () => llavero.get('fc.cuenta.sesion') ?? '',
  };
}

export type DispositivoDeNode = Awaited<ReturnType<typeof dispositivoDeNode>>;

/** Crea una cuenta con el código de la app, fuera del navegador. */
export async function altaEnNode(d: DispositivoDeNode, correo: string): Promise<void> {
  expect(await d.gestor.crearCuenta(correo, CONTRASENA)).toEqual({ ok: true });
  const { codigo, gruposPedidos } = d.gestor.estado();
  const grupos = gruposDelCodigo(codigo!);
  expect(await d.gestor.confirmarCodigo(gruposPedidos.map((p) => grupos[p]))).toEqual({
    ok: true,
  });
}

// ------------------------------------------------------------------- navegador

/** Apunta errores y avisos de consola, errores de página y violaciones de la CSP. */
export function vigilar(pagina: Page) {
  const consola: string[] = [];
  pagina.on('console', (mensaje) => {
    if (['error', 'warning'].includes(mensaje.type())) {
      consola.push(`${mensaje.type()}: ${mensaje.text().slice(0, 300)}`);
    }
  });
  pagina.on('pageerror', (error) =>
    consola.push(`error de página: ${String(error).slice(0, 300)}`),
  );
  return consola;
}

/** Espera a estar dentro de la app, con los datos ya bajados. */
export async function esperarDentro(pagina: Page): Promise<void> {
  await pagina.getByTestId('pestana-index').waitFor({ state: 'visible', timeout: 90_000 });
}

/** Alta completa en la web: formulario, código de recuperación y confirmación. */
export async function altaEnWeb(pagina: Page, correo: string): Promise<string[]> {
  await pagina.goto('/');
  await pagina.getByTestId('correo').fill(correo);
  await pagina.getByTestId('contrasena').fill(CONTRASENA);
  await pagina.getByTestId('repetir-contrasena').fill(CONTRASENA);
  await pagina.getByTestId('enviar').click();
  const codigo = pagina.getByTestId('codigo-de-recuperacion');
  await codigo.waitFor({ timeout: 90_000 });
  const grupos = ((await codigo.getAttribute('aria-label')) ?? '').split(': ')[1].split(', ');
  await pagina.getByTestId('codigo-guardado').click();
  for (const i of [0, 1]) {
    const campo = pagina.getByTestId(`grupo-${i}`);
    const numero = Number(((await campo.getAttribute('aria-label')) ?? '').replace(/\D/g, ''));
    await campo.fill(grupos[numero - 1]);
  }
  await pagina.getByTestId('confirmar-codigo').click();
  await esperarDentro(pagina);
  return grupos;
}

/** Inicio de sesión en la web con una cuenta que ya existe. */
export async function entrarEnWeb(
  pagina: Page,
  correo: string,
  contrasena: string = CONTRASENA,
  opciones: { yaEnLaPagina?: boolean } = {},
): Promise<void> {
  if (!opciones.yaEnLaPagina) await pagina.goto('/');
  await pagina.getByTestId('cambiar-de-modo').click();
  await pagina.getByTestId('correo').fill(correo);
  await pagina.getByTestId('contrasena').fill(contrasena);
  await pagina.getByTestId('enviar').click();
}

/** Abre una pestaña y espera a que sea la que se ve. */
export async function irA(pagina: Page, pestana: string): Promise<void> {
  await pagina.getByTestId(`pestana-${pestana}`).click();
  await expect(pagina.getByTestId(`pestana-${pestana}`)).toHaveAttribute('aria-current', 'page');
  // La pantalla anterior deja de verse un instante después.
  await expect(pagina.locator('[data-testid="boton-anadir"]:visible')).toHaveCount(1);
}

/**
 * Pulsa el botón «+» de la pestaña que se está viendo. Cada pestaña tiene el
 * suyo; al cambiar de pestaña hay un instante con dos, así que se espera a que
 * quede uno solo a la vista.
 */
async function pulsarAnadir(pagina: Page): Promise<void> {
  const visibles = pagina.locator('[data-testid="boton-anadir"]:visible');
  await expect(visibles).toHaveCount(1);
  await visibles.click();
}

/** Crea una cuenta bancaria desde el alta de movimiento (cuando aún no hay ninguna). */
export async function crearPrimeraCuenta(pagina: Page, nombre: string, saldo: string) {
  await pagina.getByTestId('pestana-index').click();
  await pulsarAnadir(pagina);
  await pagina.getByText(es.movimiento.crearCuenta, { exact: true }).click();
  await pagina.getByTestId('nombre').fill(nombre);
  await pagina.getByTestId('saldo-inicial').fill(saldo);
  await pagina.getByTestId('guardar').click();
}

/** Anota un gasto: teclas del importe (céntimos incluidos) y nombre. */
export async function anotarGasto(pagina: Page, teclas: string[], nombre: string) {
  if ((await pagina.getByTestId('importe').count()) === 0) {
    await pulsarAnadir(pagina);
  }
  await pagina.getByTestId('importe').waitFor();
  for (const tecla of teclas) await pagina.getByTestId(`tecla-${tecla}`).click();
  await pagina.getByTestId('nombre').fill(nombre);
  await pagina.getByTestId('guardar').click();
  await pagina.getByTestId('importe').waitFor({ state: 'detached' });
}

/** Descarga «Exportar todo (JSON)» desde Ajustes y devuelve su contenido. */
export async function exportarDesdeLaWeb(pagina: Page) {
  await pagina.getByTestId('pestana-index').click();
  await pagina.getByTestId('boton-ajustes').click();
  await pagina.getByTestId('abrir-exportar').click();
  const [descarga] = await Promise.all([
    pagina.waitForEvent('download'),
    pagina.getByTestId('exportar-todo').click(),
  ]);
  const texto = await leerDescarga(descarga);
  // De vuelta a Inicio.
  await pagina.getByTestId('volver').last().click();
  await pagina.getByTestId('volver').last().click();
  return {
    nombre: descarga.suggestedFilename(),
    datos: JSON.parse(texto) as { tablas: Record<string, Record<string, unknown>[]> },
  };
}

export async function leerDescarga(descarga: Download): Promise<string> {
  const ruta = await descarga.path();
  return readFileSync(ruta, 'utf8');
}

/** Filas cifradas que el servidor guarda de una cuenta, leídas como administrador. */
export function filasRemotas(correo: string): number {
  return consultar<{ n: number }>(
    `select count(*)::int as n from public.fila_cifrada f join auth.users u on u.id = f.user_id
      where u.email = '${correo}'`,
  )[0].n;
}

/** Espera a que el servidor tenga al menos esas filas de la cuenta. */
export async function esperarFilasRemotas(correo: string, minimo: number): Promise<number> {
  let filas = 0;
  await expect
    .poll(
      () => {
        filas = filasRemotas(correo);
        return filas;
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThanOrEqual(minimo);
  return filas;
}

export type Almacenes = {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: string;
  indexedDB: Record<string, string>;
  cacheStorage: Record<string, string[]>;
  opfs: { ruta: string; bytes: number; texto: string; distintosDeCero: number }[];
  serviceWorkers: number;
};

/** Vuelca TODO lo que el sitio tiene guardado en el navegador. */
export function volcarAlmacenes(pagina: Page): Promise<Almacenes> {
  return pagina.evaluate(async () => {
    const aObjeto = (almacen: Storage) =>
      Object.fromEntries(
        Object.keys(almacen).map((clave) => [clave, almacen.getItem(clave) ?? '']),
      );
    const indexedDBVolcado: Record<string, string> = {};
    for (const info of await indexedDB.databases()) {
      const nombre = info.name ?? '';
      const bd = await new Promise<IDBDatabase>((resolver, rechazar) => {
        const peticion = indexedDB.open(nombre);
        peticion.onsuccess = () => resolver(peticion.result);
        peticion.onerror = () => rechazar(peticion.error);
      });
      const contenido: Record<string, unknown[]> = {};
      for (const almacen of Array.from(bd.objectStoreNames)) {
        contenido[almacen] = await new Promise((resolver) => {
          const peticion = bd.transaction(almacen).objectStore(almacen).getAll();
          peticion.onsuccess = () => resolver(peticion.result);
          peticion.onerror = () => resolver(['ilegible']);
        });
      }
      indexedDBVolcado[nombre] = JSON.stringify(contenido);
      bd.close();
    }
    const cacheStorage: Record<string, string[]> = {};
    for (const nombre of await caches.keys()) {
      cacheStorage[nombre] = (await (await caches.open(nombre)).keys()).map((p) => p.url);
    }
    const opfs: { ruta: string; bytes: number; texto: string; distintosDeCero: number }[] = [];
    async function recorrer(carpeta: FileSystemDirectoryHandle, ruta: string) {
      for await (const [nombre, entrada] of carpeta.entries()) {
        if (entrada.kind === 'directory') {
          await recorrer(entrada as FileSystemDirectoryHandle, `${ruta}/${nombre}`);
        } else {
          const bytes = new Uint8Array(
            await (await (entrada as FileSystemFileHandle).getFile()).arrayBuffer(),
          );
          opfs.push({
            ruta: `${ruta}/${nombre}`,
            bytes: bytes.length,
            // Latin-1: un carácter por byte, para poder buscar valores conocidos.
            texto: Array.from(bytes, (b) => String.fromCharCode(b)).join(''),
            distintosDeCero: bytes.filter((b) => b !== 0).length,
          });
        }
      }
    }
    await recorrer(await navigator.storage.getDirectory(), '');
    return {
      localStorage: aObjeto(localStorage),
      sessionStorage: aObjeto(sessionStorage),
      cookies: document.cookie,
      indexedDB: indexedDBVolcado,
      cacheStorage,
      opfs,
      serviceWorkers: (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
    };
  });
}
