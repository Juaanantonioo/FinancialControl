/**
 * Sistema de migraciones (T-020).
 *
 * Una migración es una lista de sentencias SQL que lleva el esquema de una
 * versión a la siguiente. SQLite guarda un número de versión en la propia
 * base de datos (`PRAGMA user_version`). Al abrir la app se aplican, en
 * orden, las migraciones que falten.
 *
 * Regla: una migración ya publicada NO se edita. Un cambio de esquema es
 * siempre una migración nueva al final de la lista.
 */
import type { BaseDeDatos } from './bd';

export type Migracion = { version: number; sentencias: string[] };

const COMUNES = `
  creado_en TEXT NOT NULL,
  modificado_en TEXT NOT NULL,
  borrado_en TEXT`;

export const MIGRACIONES: Migracion[] = [
  {
    version: 1,
    sentencias: [
      `CREATE TABLE cuenta (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('banco', 'efectivo', 'inversion')),
        divisa TEXT NOT NULL,
        saldo_inicial INTEGER NOT NULL,
        fecha_saldo_inicial TEXT NOT NULL,
        archivada INTEGER NOT NULL DEFAULT 0,
        orden INTEGER NOT NULL DEFAULT 0,
        ${COMUNES}
      )`,
      `CREATE TABLE categoria (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
        icono TEXT,
        color TEXT,
        padre_id TEXT REFERENCES categoria (id),
        archivada INTEGER NOT NULL DEFAULT 0,
        orden INTEGER NOT NULL DEFAULT 0,
        ${COMUNES}
      )`,
      // Las tres últimas restricciones repiten en la base de datos las reglas
      // del dominio, como segunda barrera: importe positivo salvo en ajustes,
      // destino solo en transferencias y distinto del origen, y categoría
      // vacía en transferencias y ajustes.
      `CREATE TABLE movimiento (
        id TEXT PRIMARY KEY NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso', 'transferencia', 'ajuste')),
        fecha TEXT NOT NULL,
        importe INTEGER NOT NULL,
        divisa TEXT NOT NULL,
        cuenta_id TEXT NOT NULL REFERENCES cuenta (id),
        cuenta_destino_id TEXT REFERENCES cuenta (id),
        categoria_id TEXT REFERENCES categoria (id),
        nombre TEXT NOT NULL DEFAULT '',
        comercio TEXT,
        nota TEXT,
        origen TEXT NOT NULL DEFAULT 'manual'
          CHECK (origen IN ('manual', 'apple_pay', 'notificacion', 'recurrente', 'importacion')),
        regla_recurrente_id TEXT,
        captura_id TEXT,
        objetivo_id TEXT,
        ${COMUNES},
        CHECK ((tipo = 'ajuste' AND importe <> 0) OR (tipo <> 'ajuste' AND importe > 0)),
        CHECK (
          (tipo = 'transferencia' AND cuenta_destino_id IS NOT NULL AND cuenta_destino_id <> cuenta_id)
          OR (tipo <> 'transferencia' AND cuenta_destino_id IS NULL)
        ),
        CHECK (tipo IN ('gasto', 'ingreso') OR categoria_id IS NULL)
      )`,
      `CREATE INDEX movimiento_por_fecha ON movimiento (fecha)`,
      `CREATE INDEX movimiento_por_cuenta ON movimiento (cuenta_id)`,
      `CREATE INDEX movimiento_por_destino ON movimiento (cuenta_destino_id)`,
      `CREATE INDEX movimiento_por_categoria ON movimiento (categoria_id)`,
    ],
  },
];

export async function versionDelEsquema(bd: BaseDeDatos): Promise<number> {
  const filas = await bd.consultar<{ user_version: number }>('PRAGMA user_version');
  return filas[0]?.user_version ?? 0;
}

/**
 * Aplica las migraciones pendientes. Cada una va en su transacción: si una
 * sentencia falla, esa migración se deshace entera y la versión no avanza.
 * Devuelve la versión anterior y la nueva.
 */
export async function migrar(
  bd: BaseDeDatos,
  migraciones: Migracion[] = MIGRACIONES,
): Promise<{ desde: number; hasta: number }> {
  const desde = await versionDelEsquema(bd);
  let actual = desde;
  const pendientes = migraciones
    .filter((m) => m.version > desde)
    .sort((a, b) => a.version - b.version);
  for (const migracion of pendientes) {
    await bd.transaccion(async () => {
      for (const sentencia of migracion.sentencias) {
        await bd.ejecutar(sentencia);
      }
      // PRAGMA no admite parámetros; la versión es un entero propio, no un dato externo.
      await bd.ejecutar(`PRAGMA user_version = ${Math.trunc(migracion.version)}`);
    });
    actual = migracion.version;
  }
  return { desde, hasta: actual };
}
