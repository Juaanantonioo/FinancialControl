/**
 * Catálogo de las tablas que se sincronizan: sus columnas, sus reglas de
 * unicidad y el orden en que hay que aplicarlas.
 *
 * Tiene que coincidir con el esquema local y con la lista que admite
 * `fila_cifrada.tabla` en el servidor. Una prueba compara este catálogo con el
 * esquema real de SQLite: si una migración añade una columna, una tabla o un
 * índice único y esto no se actualiza, la prueba falla.
 *
 * `aviso_emitido` no está: es memoria de cada dispositivo y no viaja.
 */

const COMUNES = ['creado_en', 'modificado_en', 'borrado_en'] as const;

export type TablaSincronizada = {
  nombre: string;
  /** Todas las columnas, en el orden del esquema. */
  columnas: readonly string[];
  /** Grupos de columnas que no pueden repetirse entre filas no borradas. */
  unicos: readonly (readonly string[])[];
};

/**
 * En orden de dependencia: cada tabla va después de aquellas a las que apunta
 * con una clave ajena. Al aplicar filas bajadas se sigue este orden.
 */
export const TABLAS: readonly TablaSincronizada[] = [
  {
    nombre: 'cuenta',
    columnas: [
      'id',
      'nombre',
      'tipo',
      'divisa',
      'saldo_inicial',
      'fecha_saldo_inicial',
      'archivada',
      'orden',
      ...COMUNES,
    ],
    unicos: [],
  },
  {
    nombre: 'categoria',
    columnas: [
      'id',
      'nombre',
      'tipo',
      'icono',
      'color',
      'padre_id',
      'archivada',
      'orden',
      ...COMUNES,
    ],
    unicos: [],
  },
  {
    nombre: 'objetivo',
    columnas: [
      'id',
      'nombre',
      'tipo',
      'meta',
      'divisa',
      'fecha_limite',
      'cuenta_id',
      'archivado',
      ...COMUNES,
    ],
    unicos: [],
  },
  {
    nombre: 'regla_recurrente',
    columnas: [
      'id',
      'nombre',
      'clase',
      'tipo_movimiento',
      'importe',
      'divisa',
      'cuenta_id',
      'cuenta_destino_id',
      'categoria_id',
      'periodicidad',
      'dia_del_mes',
      'fecha_inicio',
      'fecha_fin',
      'activa',
      'aviso_dias_antes',
      'objetivo_id',
      ...COMUNES,
    ],
    unicos: [],
  },
  {
    nombre: 'presupuesto',
    columnas: ['id', 'periodo', 'nota', ...COMUNES],
    unicos: [['periodo']],
  },
  {
    nombre: 'movimiento',
    columnas: [
      'id',
      'tipo',
      'fecha',
      'importe',
      'divisa',
      'cuenta_id',
      'cuenta_destino_id',
      'categoria_id',
      'nombre',
      'comercio',
      'nota',
      'origen',
      'regla_recurrente_id',
      'captura_id',
      'objetivo_id',
      ...COMUNES,
    ],
    unicos: [],
  },
  {
    nombre: 'captura',
    columnas: [
      'id',
      'recibida_en',
      'origen',
      'importe_texto',
      'comercio_texto',
      'tarjeta_texto',
      'importe',
      'divisa',
      'cuenta_id',
      'categoria_id',
      'estado',
      'movimiento_id',
      'id_de_cola',
      ...COMUNES,
    ],
    unicos: [['id_de_cola']],
  },
  {
    nombre: 'valor_de_inversion',
    columnas: ['id', 'cuenta_id', 'fecha', 'valor', ...COMUNES],
    unicos: [['cuenta_id', 'fecha']],
  },
  {
    nombre: 'aportacion_a_objetivo',
    columnas: ['id', 'objetivo_id', 'fecha', 'importe', 'movimiento_id', 'nota', ...COMUNES],
    unicos: [],
  },
  {
    nombre: 'linea_de_presupuesto',
    columnas: ['id', 'presupuesto_id', 'categoria_id', 'importe', ...COMUNES],
    unicos: [['presupuesto_id', 'categoria_id']],
  },
  {
    nombre: 'alias_de_tarjeta',
    columnas: ['id', 'texto', 'cuenta_id', ...COMUNES],
    unicos: [['texto']],
  },
  {
    nombre: 'regla_de_comercio',
    columnas: ['id', 'comercio', 'categoria_id', ...COMUNES],
    unicos: [['comercio']],
  },
];

/** Tablas locales con datos de la persona que no se sincronizan. La exportación las incluye. */
export const TABLAS_SOLO_LOCALES: readonly string[] = ['aviso_emitido'];

const POR_NOMBRE = new Map(TABLAS.map((tabla, orden) => [tabla.nombre, { tabla, orden }]));

export function tablaSincronizada(nombre: string): TablaSincronizada | null {
  return POR_NOMBRE.get(nombre)?.tabla ?? null;
}

/** Posición de la tabla en el orden de dependencia. Las desconocidas van al final. */
export function ordenDeTabla(nombre: string): number {
  return POR_NOMBRE.get(nombre)?.orden ?? TABLAS.length;
}

/** Una fila local tal como sale de SQLite: columnas con texto, número entero o nada. */
export type FilaLocal = Record<string, string | number | null>;
