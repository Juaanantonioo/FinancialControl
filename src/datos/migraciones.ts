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

/**
 * Las doce tablas que se sincronizan, tal como eran en la versión 5. Esta lista
 * pertenece a la migración 5 y no se toca: una tabla sincronizada nueva lleva
 * sus disparadores en su propia migración.
 */
const TABLAS_CON_COLA_V5 = [
  'cuenta',
  'categoria',
  'movimiento',
  'valor_de_inversion',
  'objetivo',
  'aportacion_a_objetivo',
  'regla_recurrente',
  'presupuesto',
  'linea_de_presupuesto',
  'captura',
  'alias_de_tarjeta',
  'regla_de_comercio',
];

/** Apunta en la cola de subida la fila recién escrita, con un número de cambio nuevo. */
function disparadoresDeCola(tabla: string): string[] {
  return ['INSERT', 'UPDATE'].map(
    (operacion) =>
      `CREATE TRIGGER sinc_${operacion.toLowerCase()}_${tabla} AFTER ${operacion} ON ${tabla}
       BEGIN
         DELETE FROM sinc_pendiente WHERE tabla = '${tabla}' AND id = NEW.id;
         INSERT INTO sinc_pendiente (tabla, id) VALUES ('${tabla}', NEW.id);
       END`,
  );
}

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
  {
    // H3: valor manual de las cuentas de inversión (T-070). Solo añade una
    // tabla; no toca cuentas, categorías ni movimientos.
    version: 2,
    sentencias: [
      `CREATE TABLE valor_de_inversion (
        id TEXT PRIMARY KEY NOT NULL,
        cuenta_id TEXT NOT NULL REFERENCES cuenta (id),
        fecha TEXT NOT NULL,
        valor INTEGER NOT NULL CHECK (valor >= 0),
        ${COMUNES}
      )`,
      // Un valor por cuenta y día entre los no borrados.
      `CREATE UNIQUE INDEX valor_de_inversion_por_dia
         ON valor_de_inversion (cuenta_id, fecha) WHERE borrado_en IS NULL`,
    ],
  },
  {
    // H5: planificación (T-060, T-064 y T-070). Solo añade tablas; no toca
    // ninguna de las existentes. `movimiento` ya tenía desde la versión 1 las
    // columnas `regla_recurrente_id` y `objetivo_id` que las enlazan.
    version: 3,
    sentencias: [
      `CREATE TABLE objetivo (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('ahorro', 'inversion')),
        meta INTEGER NOT NULL CHECK (meta > 0),
        divisa TEXT NOT NULL,
        fecha_limite TEXT,
        cuenta_id TEXT REFERENCES cuenta (id),
        archivado INTEGER NOT NULL DEFAULT 0,
        ${COMUNES}
      )`,
      `CREATE TABLE aportacion_a_objetivo (
        id TEXT PRIMARY KEY NOT NULL,
        objetivo_id TEXT NOT NULL REFERENCES objetivo (id),
        fecha TEXT NOT NULL,
        importe INTEGER NOT NULL CHECK (importe > 0),
        movimiento_id TEXT REFERENCES movimiento (id),
        nota TEXT,
        ${COMUNES}
      )`,
      `CREATE INDEX aportacion_por_objetivo ON aportacion_a_objetivo (objetivo_id)`,
      `CREATE INDEX aportacion_por_movimiento ON aportacion_a_objetivo (movimiento_id)`,
      // Las restricciones repiten las reglas del dominio como segunda barrera:
      // cada clase con su tipo de movimiento, destino solo en aportaciones y
      // categoría solo en gastos e ingresos.
      `CREATE TABLE regla_recurrente (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        clase TEXT NOT NULL CHECK (clase IN ('fijo', 'suscripcion', 'ingreso', 'aportacion')),
        tipo_movimiento TEXT NOT NULL
          CHECK (tipo_movimiento IN ('gasto', 'ingreso', 'transferencia')),
        importe INTEGER NOT NULL CHECK (importe > 0),
        divisa TEXT NOT NULL,
        cuenta_id TEXT NOT NULL REFERENCES cuenta (id),
        cuenta_destino_id TEXT REFERENCES cuenta (id),
        categoria_id TEXT REFERENCES categoria (id),
        periodicidad TEXT NOT NULL CHECK (periodicidad IN ('mensual', 'anual')),
        dia_del_mes INTEGER NOT NULL CHECK (dia_del_mes BETWEEN 1 AND 31),
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT,
        activa INTEGER NOT NULL DEFAULT 1,
        aviso_dias_antes INTEGER NOT NULL DEFAULT 0 CHECK (aviso_dias_antes >= 0),
        objetivo_id TEXT REFERENCES objetivo (id),
        ${COMUNES},
        CHECK (
          (clase IN ('fijo', 'suscripcion') AND tipo_movimiento = 'gasto')
          OR (clase = 'ingreso' AND tipo_movimiento = 'ingreso')
          OR (clase = 'aportacion' AND tipo_movimiento = 'transferencia')
        ),
        CHECK (
          (tipo_movimiento = 'transferencia' AND cuenta_destino_id IS NOT NULL
             AND cuenta_destino_id <> cuenta_id AND categoria_id IS NULL)
          OR (tipo_movimiento <> 'transferencia' AND cuenta_destino_id IS NULL)
        ),
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
      )`,
      `CREATE TABLE presupuesto (
        id TEXT PRIMARY KEY NOT NULL,
        periodo TEXT NOT NULL,
        nota TEXT,
        ${COMUNES}
      )`,
      // Un presupuesto por mes entre los no borrados.
      `CREATE UNIQUE INDEX presupuesto_por_periodo
         ON presupuesto (periodo) WHERE borrado_en IS NULL`,
      `CREATE TABLE linea_de_presupuesto (
        id TEXT PRIMARY KEY NOT NULL,
        presupuesto_id TEXT NOT NULL REFERENCES presupuesto (id),
        categoria_id TEXT NOT NULL REFERENCES categoria (id),
        importe INTEGER NOT NULL CHECK (importe >= 0),
        ${COMUNES}
      )`,
      // Una línea por categoría y presupuesto.
      `CREATE UNIQUE INDEX linea_por_categoria
         ON linea_de_presupuesto (presupuesto_id, categoria_id) WHERE borrado_en IS NULL`,
      `CREATE INDEX movimiento_por_regla ON movimiento (regla_recurrente_id)`,
    ],
  },
  {
    // B3: capturas de pagos y avisos (T-030 a T-034 y T-040). Solo añade
    // tablas. `movimiento` ya tenía desde la versión 1 la columna `captura_id`.
    version: 4,
    sentencias: [
      // Los tres textos guardan lo que llegó, sin tocar. `importe` y `divisa`
      // son lo que la app pudo leer de ellos; quedan vacíos si no pudo.
      `CREATE TABLE captura (
        id TEXT PRIMARY KEY NOT NULL,
        recibida_en TEXT NOT NULL,
        origen TEXT NOT NULL CHECK (origen IN ('transaccion', 'notificacion', 'manual', 'prueba')),
        importe_texto TEXT NOT NULL DEFAULT '',
        comercio_texto TEXT NOT NULL DEFAULT '',
        tarjeta_texto TEXT NOT NULL DEFAULT '',
        importe INTEGER CHECK (importe IS NULL OR importe > 0),
        divisa TEXT,
        cuenta_id TEXT REFERENCES cuenta (id),
        categoria_id TEXT REFERENCES categoria (id),
        estado TEXT NOT NULL DEFAULT 'pendiente'
          CHECK (estado IN ('pendiente', 'guardada', 'descartada', 'duplicada')),
        movimiento_id TEXT REFERENCES movimiento (id),
        id_de_cola TEXT,
        ${COMUNES},
        CHECK (estado = 'guardada' OR movimiento_id IS NULL)
      )`,
      // La misma entrada de la cola nativa no se importa dos veces.
      `CREATE UNIQUE INDEX captura_por_id_de_cola
         ON captura (id_de_cola) WHERE id_de_cola IS NOT NULL AND borrado_en IS NULL`,
      `CREATE INDEX captura_por_estado ON captura (estado)`,
      `CREATE TABLE alias_de_tarjeta (
        id TEXT PRIMARY KEY NOT NULL,
        texto TEXT NOT NULL CHECK (texto <> ''),
        cuenta_id TEXT NOT NULL REFERENCES cuenta (id),
        ${COMUNES}
      )`,
      `CREATE UNIQUE INDEX alias_por_texto ON alias_de_tarjeta (texto) WHERE borrado_en IS NULL`,
      `CREATE TABLE regla_de_comercio (
        id TEXT PRIMARY KEY NOT NULL,
        comercio TEXT NOT NULL CHECK (comercio <> ''),
        categoria_id TEXT NOT NULL REFERENCES categoria (id),
        ${COMUNES}
      )`,
      `CREATE UNIQUE INDEX regla_por_comercio
         ON regla_de_comercio (comercio) WHERE borrado_en IS NULL`,
      // Avisos que ya se han mostrado, para no repetirlos.
      `CREATE TABLE aviso_emitido (
        id TEXT PRIMARY KEY NOT NULL,
        clave TEXT NOT NULL,
        emitido_en TEXT NOT NULL,
        ${COMUNES}
      )`,
      `CREATE UNIQUE INDEX aviso_por_clave ON aviso_emitido (clave) WHERE borrado_en IS NULL`,
    ],
  },
  {
    // B4b-2: estado de la sincronización cifrada. Solo añade tablas y
    // disparadores; no toca ninguna tabla ni fila existente. Va en la base de
    // datos, y no en las preferencias, porque la cola y el cursor tienen que
    // cambiar en la misma transacción que los datos
    // (docs/seguridad/diseno-sincronizacion.md, apartado 4).
    version: 5,
    sentencias: [
      // Cuenta a la que está ligada la base, cursor y fechas del motor.
      `CREATE TABLE sinc_estado (
        clave TEXT PRIMARY KEY NOT NULL,
        valor TEXT NOT NULL
      )`,
      // Filas locales por subir. `cambio` solo crece: sirve para saber si una
      // fila volvió a cambiar mientras se subía.
      `CREATE TABLE sinc_pendiente (
        cambio INTEGER PRIMARY KEY AUTOINCREMENT,
        tabla TEXT NOT NULL,
        id TEXT NOT NULL,
        UNIQUE (tabla, id)
      )`,
      // Última marca de tiempo del servidor que este dispositivo conoce de cada fila.
      `CREATE TABLE sinc_remota (
        tabla TEXT NOT NULL,
        id TEXT NOT NULL,
        actualizada_en TEXT NOT NULL,
        PRIMARY KEY (tabla, id)
      )`,
      // Filas remotas que no se han podido aplicar. De las ilegibles no se
      // guarda el contenido; de las no aplicables, el sobre cifrado, para reintentar.
      `CREATE TABLE sinc_retenida (
        tabla TEXT NOT NULL,
        id TEXT NOT NULL,
        motivo TEXT NOT NULL CHECK (motivo IN ('ilegible', 'no_aplicable')),
        contenido TEXT,
        actualizada_en TEXT NOT NULL,
        PRIMARY KEY (tabla, id)
      )`,
      ...TABLAS_CON_COLA_V5.flatMap(disparadoresDeCola),
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
