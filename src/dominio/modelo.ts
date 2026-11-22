/**
 * Entidades del núcleo (docs/05, apartado 4).
 *
 * Convenciones comunes a todas:
 *  - `id`: UUID generado en el dispositivo, no en un servidor.
 *  - `creadoEn`, `modificadoEn`: marcas de tiempo en UTC (texto ISO 8601).
 *  - `borradoEn`: borrado lógico. La fila no se elimina: se marca. Así se
 *    puede deshacer y, en H4, sincronizar el borrado con Supabase.
 *  - Importes en céntimos enteros con su divisa.
 *  - Fechas de movimiento como día de calendario local, "AAAA-MM-DD".
 */

export type CamposComunes = {
  id: string;
  creadoEn: string;
  modificadoEn: string;
  borradoEn: string | null;
};

export const TIPOS_DE_CUENTA = ['banco', 'efectivo', 'inversion'] as const;
export type TipoDeCuenta = (typeof TIPOS_DE_CUENTA)[number];

export type Cuenta = CamposComunes & {
  nombre: string;
  tipo: TipoDeCuenta;
  divisa: string;
  /** Céntimos. Puede ser negativo (descubierto). */
  saldoInicial: number;
  /** Día desde el que cuentan los movimientos para el saldo. */
  fechaSaldoInicial: string;
  archivada: boolean;
  orden: number;
};

export const TIPOS_DE_CATEGORIA = ['gasto', 'ingreso'] as const;
export type TipoDeCategoria = (typeof TIPOS_DE_CATEGORIA)[number];

export type Categoria = CamposComunes & {
  nombre: string;
  tipo: TipoDeCategoria;
  icono: string | null;
  color: string | null;
  padreId: string | null;
  archivada: boolean;
  orden: number;
};

export const TIPOS_DE_MOVIMIENTO = ['gasto', 'ingreso', 'transferencia', 'ajuste'] as const;
export type TipoDeMovimiento = (typeof TIPOS_DE_MOVIMIENTO)[number];

export const ORIGENES_DE_MOVIMIENTO = [
  'manual',
  'apple_pay',
  'notificacion',
  'recurrente',
  'importacion',
] as const;
export type OrigenDeMovimiento = (typeof ORIGENES_DE_MOVIMIENTO)[number];

export type Movimiento = CamposComunes & {
  tipo: TipoDeMovimiento;
  /** Día de calendario local, "AAAA-MM-DD". */
  fecha: string;
  /**
   * Céntimos. Siempre positivo en gasto, ingreso y transferencia: el tipo
   * indica el sentido. Solo el ajuste lleva signo.
   */
  importe: number;
  divisa: string;
  cuentaId: string;
  /** Solo en transferencias. */
  cuentaDestinoId: string | null;
  /** Vacío en transferencias y ajustes. */
  categoriaId: string | null;
  nombre: string;
  comercio: string | null;
  nota: string | null;
  origen: OrigenDeMovimiento;
  // Enlaces a entidades de hitos posteriores. Se guardan ya para no migrar después.
  reglaRecurrenteId: string | null;
  capturaId: string | null;
  objetivoId: string | null;
};

/** Códigos de error de las reglas de negocio. Cada uno tiene su texto en el catálogo. */
export type CodigoDeError =
  | 'nombre_vacio'
  | 'texto_demasiado_largo'
  | 'nombre_duplicado'
  | 'importe_no_valido'
  | 'importe_cero'
  | 'fecha_no_valida'
  | 'divisa_no_valida'
  | 'cuenta_no_encontrada'
  | 'cuenta_archivada'
  | 'cuenta_con_movimientos'
  | 'cuenta_destino_obligatoria'
  | 'misma_cuenta'
  | 'divisas_distintas'
  | 'categoria_no_encontrada'
  | 'categoria_archivada'
  | 'categoria_de_otro_tipo'
  | 'categoria_obligatoria'
  | 'no_encontrado'
  | 'cuenta_no_es_de_inversion'
  | 'valor_no_valido'
  | 'fecha_futura'
  | 'fecha_anterior_a_la_cuenta'
  | 'valor_no_encontrado'
  | 'color_no_valido'
  | 'clase_no_valida'
  | 'periodicidad_no_valida'
  | 'dia_no_valido'
  | 'fecha_fin_anterior'
  | 'regla_no_encontrada'
  | 'sin_ocurrencia'
  | 'movimiento_no_enlazable'
  | 'periodo_no_valido'
  | 'categoria_no_presupuestable'
  | 'presupuesto_no_encontrado'
  | 'meta_no_valida'
  | 'objetivo_no_encontrado'
  | 'objetivo_archivado'
  | 'aportacion_no_encontrada'
  | 'captura_no_encontrada'
  | 'captura_incompleta'
  | 'captura_ya_resuelta'
  | 'alias_vacio'
  | 'alias_no_encontrado';

/**
 * Error de una regla de negocio. Lleva un código, no un texto: la pantalla
 * busca el texto en el catálogo de traducción.
 */
export class ErrorDeDominio extends Error {
  constructor(public readonly codigo: CodigoDeError) {
    super(codigo);
    this.name = 'ErrorDeDominio';
  }
}

/** Compara nombres sin distinguir mayúsculas, acentos ni espacios sobrantes. */
export function normalizarNombre(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** `true` si el texto es un día real con formato "AAAA-MM-DD". */
export function esFechaValida(fecha: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** Día de calendario local de una fecha, como "AAAA-MM-DD". */
export function fechaLocal(d: Date = new Date()): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
