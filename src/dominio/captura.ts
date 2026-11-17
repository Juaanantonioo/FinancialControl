/**
 * Capturas de pagos (T-030 a T-034, diseño en docs/04, apartados A.3 a A.5).
 *
 * Una captura es lo que llega desde Atajos cuando se paga con Apple Pay:
 * tres textos (importe, comercio y tarjeta) tal como los entrega iOS. Aquí
 * están las reglas que los interpretan. Son funciones puras: no leen la base
 * de datos ni el reloj. La regla general es no adivinar: ante la duda, la
 * captura queda incompleta y la persona la completa.
 */
import { CENTIMOS_MAXIMOS } from './dinero';
import type { CamposComunes, Categoria, Cuenta } from './modelo';

export const ORIGENES_DE_CAPTURA = ['transaccion', 'notificacion', 'manual', 'prueba'] as const;
export type OrigenDeCaptura = (typeof ORIGENES_DE_CAPTURA)[number];

export const ESTADOS_DE_CAPTURA = ['pendiente', 'guardada', 'descartada', 'duplicada'] as const;
export type EstadoDeCaptura = (typeof ESTADOS_DE_CAPTURA)[number];

export type Captura = CamposComunes & {
  /** Instante en que se ejecutó la acción, en UTC (texto ISO 8601). */
  recibidaEn: string;
  origen: OrigenDeCaptura;
  /** Lo que llegó, sin interpretar. */
  importeTexto: string;
  comercioTexto: string;
  tarjetaTexto: string;
  /** Céntimos extraídos del texto, o `null` si no se pudo leer un importe con seguridad. */
  importe: number | null;
  divisa: string | null;
  /** Cuenta y categoría propuestas. La persona puede cambiarlas. */
  cuentaId: string | null;
  categoriaId: string | null;
  estado: EstadoDeCaptura;
  /** Movimiento creado al guardarla. */
  movimientoId: string | null;
  /** Identificador de la entrada de la cola nativa de la que salió, si salió de ella. */
  idDeCola: string | null;
};

export type AliasDeTarjeta = CamposComunes & {
  /** Texto de la tarjeta, normalizado. */
  texto: string;
  cuentaId: string;
};

export type ReglaDeComercio = CamposComunes & {
  /** Comercio normalizado. */
  comercio: string;
  categoriaId: string;
};

/** Longitud máxima de cada texto de una captura. La misma que aplica la acción en Swift. */
export const LONGITUD_MAXIMA_DE_TEXTO = 200;

/** Quita los espacios de los extremos y recorta. Un valor que no es texto queda vacío. */
export function limpiarTexto(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  // Se recorta por caracteres completos, para no partir un emoji por la mitad.
  return [...valor.trim()].slice(0, LONGITUD_MAXIMA_DE_TEXTO).join('');
}

// ------------------------------------------------------- importe y divisa

const SIMBOLOS: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP' };

export type ImporteExtraido = {
  /** Céntimos, siempre mayor que cero. */
  importe: number;
  /** Código de divisa si el texto la indica; `null` si no dice nada. */
  divisa: string | null;
};

/**
 * Lee un número escrito con separadores y devuelve céntimos, o `null` si
 * admite más de una lectura.
 *
 * - Con punto y coma, el último es el decimal y el otro separa miles.
 * - Con un solo separador seguido de una o dos cifras, es el decimal.
 * - Con un solo separador repetido ("1.234.567") separa miles.
 * - Con un solo separador seguido de tres cifras ("1.234") no se sabe si
 *   son miles o decimales: se devuelve `null`.
 */
function leerNumero(numero: string): number | null {
  if (!/^\d[\d.,]*$/.test(numero) || /[.,]$/.test(numero)) return null;
  const puntos = (numero.match(/\./g) ?? []).length;
  const comas = (numero.match(/,/g) ?? []).length;
  let enteros = numero;
  let decimales = '';

  if (puntos > 0 && comas > 0) {
    const decimal = numero.lastIndexOf('.') > numero.lastIndexOf(',') ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    // El separador decimal solo puede aparecer una vez.
    if ((decimal === '.' ? puntos : comas) !== 1) return null;
    const [parteEntera, parteDecimal] = numero.split(decimal);
    if (!gruposDeMiles(parteEntera, miles)) return null;
    enteros = parteEntera.split(miles).join('');
    decimales = parteDecimal;
  } else if (puntos + comas === 1) {
    const [parteEntera, parteDecimal] = numero.split(/[.,]/);
    // Tres cifras tras el único separador: miles o decimales, no se sabe.
    if (parteDecimal.length === 3) return null;
    enteros = parteEntera;
    decimales = parteDecimal;
  } else if (puntos + comas > 1) {
    const separador = puntos > 0 ? '.' : ',';
    if (!gruposDeMiles(numero, separador)) return null;
    enteros = numero.split(separador).join('');
  }

  if (decimales.length > 2 || !/^\d+$/.test(enteros) || !/^\d*$/.test(decimales)) return null;
  const centimos = Number(enteros) * 100 + Number(decimales.padEnd(2, '0') || '0');
  return Number.isSafeInteger(centimos) ? centimos : null;
}

/** `true` si el texto son grupos de tres cifras separados, con el primero de una a tres. */
function gruposDeMiles(texto: string, separador: string): boolean {
  const [primero, ...resto] = texto.split(separador);
  return /^\d{1,3}$/.test(primero) && resto.length > 0 && resto.every((g) => /^\d{3}$/.test(g));
}

/**
 * Extrae el importe y la divisa del texto que entrega Atajos (T-031).
 * Devuelve `null` («sin importe») si el texto está vacío, no tiene números,
 * tiene más de un número, es negativo, es cero o admite dos lecturas. Nunca
 * inventa un importe.
 */
export function extraerImporte(texto: string): ImporteExtraido | null {
  let resto = texto.replace(/[\s  ]+/g, ' ').trim();
  if (resto === '') return null;

  let divisa: string | null = null;
  for (const [simbolo, codigo] of Object.entries(SIMBOLOS)) {
    if (resto.includes(simbolo)) {
      // Dos símbolos distintos: no se sabe en qué divisa está.
      if (divisa !== null && divisa !== codigo) return null;
      divisa = codigo;
      resto = resto.split(simbolo).join(' ');
    }
  }
  const codigos = resto.match(/[A-Za-z]{3,}/g) ?? [];
  if (codigos.length > 1) return null;
  if (codigos.length === 1) {
    // Solo se acepta un código de tres letras; cualquier otra palabra es texto ajeno.
    if (codigos[0].length !== 3) return null;
    const codigo = codigos[0].toUpperCase();
    if (divisa !== null && divisa !== codigo) return null;
    divisa = codigo;
    resto = resto.replace(codigos[0], ' ');
  }

  resto = resto.trim();
  // Un importe negativo sería una devolución: no se convierte en gasto a ciegas.
  if (/[-−–]/.test(resto) || /[A-Za-z]/.test(resto)) return null;
  const numeros = resto.split(' ').filter((parte) => parte !== '');
  if (numeros.length !== 1) return null;
  const centimos = leerNumero(numeros[0]);
  if (centimos === null || centimos <= 0 || centimos > CENTIMOS_MAXIMOS) return null;
  return { importe: centimos, divisa };
}

// ------------------------------------------------------- tarjeta a cuenta

/**
 * Normaliza el texto de una tarjeta (docs/04, A.4, paso 2): sin espacios al
 * principio ni al final, en minúsculas y sin acentos.
 */
export function normalizarTarjeta(texto: string): string {
  return texto.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Normaliza un comercio: como una tarjeta y, además, con los espacios repetidos unidos. */
export function normalizarComercio(texto: string): string {
  return normalizarTarjeta(texto).replace(/\s+/g, ' ');
}

type CuentaParaCaptura = Pick<Cuenta, 'id' | 'tipo' | 'archivada' | 'borradoEn'>;

export type CuentaPropuesta = {
  cuentaId: string | null;
  /** `true` si no hay alias y se propone la única cuenta de banco (A.4, paso 5). */
  sugerida: boolean;
};

/**
 * Regla de tarjeta a cuenta (T-032; docs/04, A.4):
 *  - coincidencia exacta del texto normalizado con un alias: esa cuenta;
 *  - sin coincidencia y con una sola cuenta de banco: esa, como sugerida;
 *  - sin coincidencia y con varias, o con ninguna: sin cuenta.
 * Con la tarjeta vacía se aplican los dos últimos pasos. Un alias cuya
 * cuenta está archivada o borrada no cuenta: no admitiría el movimiento.
 */
export function cuentaDeLaTarjeta(
  tarjetaTexto: string,
  alias: Pick<AliasDeTarjeta, 'texto' | 'cuentaId' | 'borradoEn'>[],
  cuentas: CuentaParaCaptura[],
): CuentaPropuesta {
  const activas = cuentas.filter((c) => !c.archivada && c.borradoEn === null);
  const buscado = normalizarTarjeta(tarjetaTexto);
  if (buscado !== '') {
    const encontrado = alias.find((a) => a.borradoEn === null && a.texto === buscado);
    if (encontrado && activas.some((c) => c.id === encontrado.cuentaId)) {
      return { cuentaId: encontrado.cuentaId, sugerida: false };
    }
  }
  const deBanco = activas.filter((c) => c.tipo === 'banco');
  if (deBanco.length === 1) return { cuentaId: deBanco[0].id, sugerida: true };
  return { cuentaId: null, sugerida: false };
}

// --------------------------------------------------- comercio a categoría

/**
 * Categoría que se propone para un comercio (T-033): la que se guardó la
 * última vez con ese comercio. Una categoría archivada, borrada o que no es
 * de gasto no se propone.
 */
export function categoriaDelComercio(
  comercioTexto: string,
  reglas: Pick<ReglaDeComercio, 'comercio' | 'categoriaId' | 'borradoEn'>[],
  categorias: Pick<Categoria, 'id' | 'tipo' | 'archivada' | 'borradoEn'>[],
): string | null {
  const buscado = normalizarComercio(comercioTexto);
  if (buscado === '') return null;
  const regla = reglas.find((r) => r.borradoEn === null && r.comercio === buscado);
  if (!regla) return null;
  const categoria = categorias.find((c) => c.id === regla.categoriaId);
  if (!categoria || categoria.archivada || categoria.borradoEn !== null) return null;
  return categoria.tipo === 'gasto' ? categoria.id : null;
}

// -------------------------------------------------------------- duplicados

/** Dos capturas iguales separadas menos de este tiempo son la misma (T-034). */
export const VENTANA_DE_DUPLICADOS_MS = 10 * 60 * 1000;

type CapturaParaDuplicados = Pick<
  Captura,
  'recibidaEn' | 'importe' | 'cuentaId' | 'estado' | 'borradoEn'
>;

/**
 * `true` si la captura nueva repite una anterior: mismo importe, misma
 * cuenta y menos de diez minutos entre las dos. Solo se compara con las que
 * siguen pendientes o ya se guardaron. Sin importe no hay con qué comparar.
 */
export function esDuplicada(
  nueva: Pick<Captura, 'recibidaEn' | 'importe' | 'cuentaId'>,
  anteriores: CapturaParaDuplicados[],
): boolean {
  if (nueva.importe === null) return false;
  const instante = Date.parse(nueva.recibidaEn);
  return anteriores.some(
    (otra) =>
      otra.borradoEn === null &&
      (otra.estado === 'pendiente' || otra.estado === 'guardada') &&
      otra.importe === nueva.importe &&
      otra.cuentaId === nueva.cuentaId &&
      Math.abs(Date.parse(otra.recibidaEn) - instante) < VENTANA_DE_DUPLICADOS_MS,
  );
}

// ------------------------------------------------------------------ guardar

/** Qué le falta a una captura para poder guardarse con un toque. */
export type FaltaEnCaptura = 'importe' | 'cuenta' | 'categoria';

export function loQueFalta(
  captura: Pick<Captura, 'importe' | 'cuentaId' | 'categoriaId'>,
): FaltaEnCaptura[] {
  const falta: FaltaEnCaptura[] = [];
  if (captura.importe === null || captura.importe <= 0) falta.push('importe');
  if (captura.cuentaId === null) falta.push('cuenta');
  if (captura.categoriaId === null) falta.push('categoria');
  return falta;
}

/** Solo se guarda con un toque una captura pendiente con importe, cuenta y categoría. */
export function seGuardaConUnToque(
  captura: Pick<Captura, 'estado' | 'importe' | 'cuentaId' | 'categoriaId'>,
): boolean {
  return captura.estado === 'pendiente' && loQueFalta(captura).length === 0;
}

/** Origen del movimiento que nace de una captura. */
export function origenDelMovimiento(origen: OrigenDeCaptura): 'apple_pay' | 'notificacion' {
  return origen === 'notificacion' ? 'notificacion' : 'apple_pay';
}

// ------------------------------------------------------------- cola nativa

/** Nombres de las acciones de Atajos. Deben coincidir con los del código Swift. */
export const ACCION_REGISTRAR_PAGO = 'registrarPago';
export const ACCION_ANADIR_GASTO = 'anadirGasto';

/** Entrada de la cola persistente en la que las acciones de Atajos dejan su trabajo. */
export type Invocacion = {
  id: string;
  name: string;
  params: Record<string, unknown>;
  /** Milisegundos desde 1970 (UTC). */
  createdAt: number;
};

export type PagoRecibido = {
  idDeCola: string;
  recibidaEn: string;
  origen: OrigenDeCaptura;
  importeTexto: string;
  comercioTexto: string;
  tarjetaTexto: string;
};

function instanteIso(milisegundos: unknown, porDefecto: string): string {
  return typeof milisegundos === 'number' && Number.isFinite(milisegundos) && milisegundos > 0
    ? new Date(milisegundos).toISOString()
    : porDefecto;
}

/**
 * Convierte una entrada de la cola de «Registrar pago» en un pago recibido.
 * Devuelve `null` si la entrada es de otra acción. Nunca lanza un error: un
 * dato que falta o que no es texto se trata como vacío.
 *
 * @param ahora instante que se usa si la entrada no trae fecha válida.
 */
export function pagoDeLaInvocacion(invocacion: Invocacion, ahora: string): PagoRecibido | null {
  if (invocacion.name !== ACCION_REGISTRAR_PAGO) return null;
  const parametros = invocacion.params ?? {};
  const origen = limpiarTexto(parametros.origen);
  return {
    idDeCola: String(invocacion.id),
    recibidaEn: instanteIso(invocacion.createdAt, ahora),
    origen: (ORIGENES_DE_CAPTURA as readonly string[]).includes(origen)
      ? (origen as OrigenDeCaptura)
      : 'transaccion',
    importeTexto: limpiarTexto(parametros.importe),
    comercioTexto: limpiarTexto(parametros.comercio),
    tarjetaTexto: limpiarTexto(parametros.tarjeta),
  };
}

export type GastoPedido = {
  idDeCola: string;
  recibidaEn: string;
  importeTexto: string;
  categoriaTexto: string;
  cuentaTexto: string;
};

/** Convierte una entrada de la cola de «Añadir gasto» (T-038). `null` si es de otra acción. */
export function gastoDeLaInvocacion(invocacion: Invocacion, ahora: string): GastoPedido | null {
  if (invocacion.name !== ACCION_ANADIR_GASTO) return null;
  const parametros = invocacion.params ?? {};
  return {
    idDeCola: String(invocacion.id),
    recibidaEn: instanteIso(invocacion.createdAt, ahora),
    importeTexto: limpiarTexto(parametros.importe),
    categoriaTexto: limpiarTexto(parametros.categoria),
    cuentaTexto: limpiarTexto(parametros.cuenta),
  };
}
