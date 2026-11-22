/**
 * Exporta los datos a un fichero y lo entrega con la hoja de compartir. Pide
 * antes autenticación si el bloqueo de la app está activo. Recibe de fuera la
 * base de datos, cómo se comparte y cómo se autentica, para poder probarlo.
 */
import type { BaseDeDatos } from '@/datos/bd';
import type { FormatoRegional } from '@/dominio/dinero';
import type { ResultadoDeCompartir } from '@/lib/compartirFichero';

import {
  aJson,
  csvDeMovimientos,
  exportarTodo,
  nombreDeFichero,
  type TextosDelCsv,
} from './exportacion';

export type ResultadoDeExportar =
  /** El fichero se ha entregado a un destino elegido por la persona. */
  | 'compartido'
  /** La persona ha cerrado la hoja sin elegir destino: no hay copia. */
  | 'descartado'
  /** No ha pasado la autenticación del bloqueo. */
  | 'no_autenticado'
  | 'no_disponible'
  | 'error';

export type DependenciasDelExportador = {
  bd: () => Promise<BaseDeDatos>;
  compartir: (nombre: string, contenido: string) => Promise<ResultadoDeCompartir>;
  /** Devuelve `true` si la persona se ha autenticado o si el bloqueo no está activo. */
  autenticar: () => Promise<boolean>;
  ahora: () => Date;
  textosDelCsv: () => TextosDelCsv;
  formato: () => FormatoRegional;
};

export type Exportador = ReturnType<typeof crearExportador>;

export function crearExportador(dependencias: DependenciasDelExportador) {
  async function entregar(
    extension: 'json' | 'csv',
    sufijo: string,
    generar: (bd: BaseDeDatos, ahora: Date) => Promise<string>,
  ): Promise<ResultadoDeExportar> {
    try {
      if (!(await dependencias.autenticar())) return 'no_autenticado';
      const ahora = dependencias.ahora();
      const contenido = await generar(await dependencias.bd(), ahora);
      return await dependencias.compartir(nombreDeFichero(ahora, extension, sufijo), contenido);
    } catch {
      return 'error';
    }
  }

  return {
    /** Todas las filas de todas las tablas, en un JSON legible y sin cifrar. */
    todo: (sufijo = '') =>
      entregar('json', sufijo, async (bd, ahora) => aJson(await exportarTodo(bd, ahora))),
    /** Los movimientos, en un CSV para hojas de cálculo. */
    movimientos: () =>
      entregar('csv', '-movimientos', (bd) =>
        csvDeMovimientos(bd, dependencias.textosDelCsv(), dependencias.formato()),
      ),
  };
}
