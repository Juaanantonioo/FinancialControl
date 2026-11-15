/**
 * Dinero (T-021).
 *
 * Regla del proyecto: un importe es SIEMPRE un número entero de céntimos más
 * el código de su divisa. Nunca un decimal en coma flotante.
 *
 * Por qué: en JavaScript (como en Java con `double`) 0.1 + 0.2 da
 * 0.30000000000000004. Con enteros, 10 + 20 céntimos da exactamente 30.
 * Tampoco se convierte texto a número con `parseFloat`: el texto se trocea en
 * parte entera y parte decimal y se compone el entero a mano.
 *
 * Límite conocido: se suponen dos decimales para toda divisa. Vale para el
 * euro, que es la divisa inicial (docs/03, apartado 10). Divisas sin
 * decimales, como el yen, quedan fuera de este hito.
 */

export type Dinero = {
  /** Importe en unidades menores (céntimos). Entero, puede ser negativo. */
  centimos: number;
  /** Código ISO 4217, por ejemplo "EUR". */
  divisa: string;
};

/** Importe máximo admitido: 999.999.999,99. Muy por debajo del límite de enteros exactos. */
export const CENTIMOS_MAXIMOS = 99_999_999_999;

export class ErrorDeDinero extends Error {}

function exigirCentimos(valor: number): void {
  if (!Number.isSafeInteger(valor)) {
    throw new ErrorDeDinero(`Los céntimos deben ser un entero: ${valor}`);
  }
}

export function dinero(centimos: number, divisa: string): Dinero {
  exigirCentimos(centimos);
  return { centimos, divisa };
}

/** Suma dos importes de la misma divisa. Sumar divisas distintas es un error. */
export function sumar(a: Dinero, b: Dinero): Dinero {
  if (a.divisa !== b.divisa) {
    throw new ErrorDeDinero(`No se pueden sumar ${a.divisa} y ${b.divisa}`);
  }
  return dinero(a.centimos + b.centimos, a.divisa);
}

export function restar(a: Dinero, b: Dinero): Dinero {
  return sumar(a, dinero(-b.centimos, b.divisa));
}

/**
 * Convierte un texto escrito por una persona en céntimos.
 *
 * Acepta coma o punto como separador decimal y separadores de miles:
 * "23,40", "23.40", "1.234,56", "1,234.56", "1234", "0,5", "-12,30".
 * Devuelve `null` si el texto está vacío o no es un importe inequívoco.
 * Nunca redondea: tres decimales ("1,234" con un único separador se
 * interpreta como miles, "0,123" se rechaza).
 */
export function analizarImporte(texto: string): number | null {
  // Fuera espacios (también el espacio fino y el de no separación) y símbolos de divisa.
  let limpio = texto.replace(/[\s  ]/g, '').replace(/[€$£]/g, '');
  if (limpio === '') return null;

  let signo = 1;
  // Se acepta el guion normal y el signo menos tipográfico.
  if (limpio[0] === '-' || limpio[0] === '−') {
    signo = -1;
    limpio = limpio.slice(1);
  } else if (limpio[0] === '+') {
    limpio = limpio.slice(1);
  }
  if (!/^[0-9.,]+$/.test(limpio) || !/[0-9]/.test(limpio)) return null;

  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  let parteEntera = limpio;
  let parteDecimal = '';

  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Hay de los dos: el que aparece más a la derecha es el decimal.
    const posDecimal = Math.max(ultimaComa, ultimoPunto);
    const separadorDecimal = limpio[posDecimal];
    const separadorMiles = separadorDecimal === ',' ? '.' : ',';
    if (limpio.indexOf(separadorDecimal) !== posDecimal) return null; // decimal repetido
    parteEntera = limpio.slice(0, posDecimal);
    parteDecimal = limpio.slice(posDecimal + 1);
    if (!gruposDeMilesValidos(parteEntera, separadorMiles)) return null;
    parteEntera = parteEntera.split(separadorMiles).join('');
  } else if (ultimaComa !== -1 || ultimoPunto !== -1) {
    const separador = ultimaComa !== -1 ? ',' : '.';
    const veces = limpio.split(separador).length - 1;
    const trasElUltimo = limpio.slice(limpio.lastIndexOf(separador) + 1);
    if (veces > 1) {
      // "1.234.567": solo puede ser separador de miles.
      if (!gruposDeMilesValidos(limpio, separador)) return null;
      parteEntera = limpio.split(separador).join('');
    } else if (trasElUltimo.length === 3) {
      // "1.234" o "1,234": se lee como miles. "0,123" no es un importe válido.
      if (!gruposDeMilesValidos(limpio, separador)) return null;
      parteEntera = limpio.split(separador).join('');
    } else {
      parteEntera = limpio.slice(0, limpio.lastIndexOf(separador));
      parteDecimal = trasElUltimo;
    }
  }

  if (parteDecimal.length > 2) return null;
  if (parteEntera === '' && parteDecimal === '') return null;
  if (!/^[0-9]*$/.test(parteEntera) || !/^[0-9]*$/.test(parteDecimal)) return null;

  const euros = parteEntera === '' ? 0 : Number(parteEntera);
  const centimos = parteDecimal === '' ? 0 : Number(parteDecimal.padEnd(2, '0'));
  const total = euros * 100 + centimos;
  if (!Number.isSafeInteger(total) || total > CENTIMOS_MAXIMOS) return null;
  // Evita devolver -0, que confunde las comparaciones en las pruebas.
  return total === 0 ? 0 : signo * total;
}

/** "1.234" es válido; "12.34", ".234" o "0.234" no lo son como grupos de miles. */
function gruposDeMilesValidos(texto: string, separador: string): boolean {
  const grupos = texto.split(separador);
  if (grupos.length === 1) return /^[0-9]+$/.test(texto);
  const [primero, ...resto] = grupos;
  if (!/^[1-9][0-9]{0,2}$/.test(primero)) return false;
  return resto.every((g) => /^[0-9]{3}$/.test(g));
}

/** Cómo escribe los números la región del dispositivo. */
export type FormatoRegional = {
  separadorDecimal: string;
  separadorDeMiles: string;
  /** `true` si el símbolo va delante del número ("$1,234.56"). */
  simboloDelante: boolean;
};

/** Formato de España: "1.234,56 €". Es el valor por defecto de la app. */
export const FORMATO_ES: FormatoRegional = {
  separadorDecimal: ',',
  separadorDeMiles: '.',
  simboloDelante: false,
};

const SIMBOLOS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

export function simboloDeDivisa(divisa: string): string {
  return SIMBOLOS[divisa] ?? divisa;
}

/** Solo el número, sin símbolo: 123456 céntimos produce "1.234,56". */
export function formatearNumero(centimos: number, formato: FormatoRegional = FORMATO_ES): string {
  exigirCentimos(centimos);
  const absoluto = Math.abs(centimos);
  const enteros = Math.floor(absoluto / 100);
  const decimales = String(absoluto % 100).padStart(2, '0');
  // Inserta el separador de miles cada tres cifras empezando por la derecha.
  const conMiles = String(enteros).replace(/\B(?=(\d{3})+(?!\d))/g, formato.separadorDeMiles);
  return `${centimos < 0 ? '-' : ''}${conMiles}${formato.separadorDecimal}${decimales}`;
}

/** Importe con su símbolo: "1.234,56 €" o "$1,234.56" según la región. */
export function formatearDinero(valor: Dinero, formato: FormatoRegional = FORMATO_ES): string {
  const simbolo = simboloDeDivisa(valor.divisa);
  const numero = formatearNumero(Math.abs(valor.centimos), formato);
  const signo = valor.centimos < 0 ? '-' : '';
  return formato.simboloDelante ? `${signo}${simbolo}${numero}` : `${signo}${numero} ${simbolo}`;
}

/* ------------------------------------------------------------------ */
/* Teclado de importe de P07                                           */
/* ------------------------------------------------------------------ */

export type TeclaDeImporte =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'decimal' | 'borrar';

/**
 * Aplica una pulsación del teclado propio al texto del importe.
 *
 * El texto interno usa siempre la coma como separador ("23,4"); la pantalla
 * lo muestra con el separador de la región. Reglas: un solo separador, dos
 * decimales como máximo, nueve cifras enteras como máximo y sin ceros a la
 * izquierda. Una pulsación que rompería una regla se ignora.
 */
export function pulsarTecla(texto: string, tecla: TeclaDeImporte): string {
  if (tecla === 'borrar') return texto.slice(0, -1);
  const [enteros, decimales] = texto.split(',');
  const tieneDecimal = texto.includes(',');
  if (tecla === 'decimal') {
    if (tieneDecimal) return texto;
    return texto === '' ? '0,' : `${texto},`;
  }
  if (tieneDecimal) {
    return (decimales ?? '').length >= 2 ? texto : texto + tecla;
  }
  if (enteros === '0') return tecla === '0' ? texto : tecla; // "0" + "5" es "5"
  if (enteros.length >= 9) return texto;
  return texto + tecla;
}

/** Céntimos que representa el texto del teclado. Texto vacío o a medias vale 0. */
export function centimosDelTeclado(texto: string): number {
  return analizarImporte(texto.endsWith(',') ? texto.slice(0, -1) : texto) ?? 0;
}

/** Texto del teclado que corresponde a unos céntimos (para editar un movimiento). */
export function tecladoDesdeCentimos(centimos: number): string {
  const absoluto = Math.abs(centimos);
  const enteros = Math.floor(absoluto / 100);
  const resto = absoluto % 100;
  if (resto === 0) return String(enteros);
  return `${enteros},${String(resto).padStart(2, '0')}`;
}

/** Texto del teclado tal como se muestra: con miles y el separador regional. */
export function mostrarTeclado(texto: string, formato: FormatoRegional = FORMATO_ES): string {
  if (texto === '') return `0`;
  const [enteros, decimales] = texto.split(',');
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, formato.separadorDeMiles);
  return texto.includes(',')
    ? `${conMiles}${formato.separadorDecimal}${decimales ?? ''}`
    : conMiles;
}
