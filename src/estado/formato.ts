/**
 * Formato de números de la región del dispositivo (docs/03, apartado 10):
 * separador decimal, separador de miles y posición del símbolo.
 */
import { getLocales } from 'expo-localization';

import {
  dinero,
  FORMATO_ES,
  formatearDinero,
  formatearNumero,
  type FormatoRegional,
} from '@/dominio/dinero';

let formato: FormatoRegional | null = null;

export function formatoRegional(): FormatoRegional {
  if (formato) return formato;
  try {
    const region = getLocales()[0];
    const decimal = region?.decimalSeparator === '.' ? '.' : ',';
    // Si la región no informa del separador de miles, se usa el contrario al decimal.
    const miles = region?.digitGroupingSeparator || (decimal === ',' ? '.' : ',');
    formato = {
      separadorDecimal: decimal,
      separadorDeMiles: miles === decimal ? (decimal === ',' ? '.' : ',') : miles,
      simboloDelante: region?.languageCode === 'en',
    };
  } catch {
    formato = FORMATO_ES;
  }
  return formato;
}

/** Importe con su símbolo en el formato de la región: "1.234,56 €". */
export function importe(centimos: number, divisa: string): string {
  return formatearDinero(dinero(centimos, divisa), formatoRegional());
}

/**
 * Importe con signo explícito: "+12,00 €" o "-12,00 €". El cero va sin signo.
 * El signo acompaña siempre al color (docs/03, apartado 8).
 */
export function conSigno(centimos: number, divisa: string): string {
  const texto = importe(Math.abs(centimos), divisa);
  if (centimos > 0) return `+${texto}`;
  if (centimos < 0) return `-${texto}`;
  return texto;
}

/** Tanto por ciento con coma decimal y signo: 7.5 produce "+7,5 %". */
export function porcentaje(valor: number, conSignoMas = true): string {
  const absoluto = Math.abs(valor);
  const texto = Number.isInteger(absoluto)
    ? String(absoluto)
    : absoluto.toFixed(1).replace('.', formatoRegional().separadorDecimal);
  const signo = valor < 0 ? '-' : valor > 0 && conSignoMas ? '+' : '';
  return `${signo}${texto} %`;
}

/** Euros redondeados sin céntimos ni símbolo, para casillas pequeñas: "1.235". */
export function sinCentimos(centimos: number): string {
  const euros = Math.round(Math.abs(centimos) / 100);
  const texto = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, formatoRegional().separadorDeMiles);
  return centimos < 0 ? `-${texto}` : texto;
}

/** Caracteres que caben en una casilla del calendario. */
export const ANCHO_DE_CASILLA = 6;

/**
 * Importe exacto para una casilla pequeña, sin símbolo: "9,99", "620" o
 * "1.234". Nunca redondea: los céntimos solo se omiten si son cero. Si el
 * texto no cabe devuelve una cadena vacía y la casilla muestra solo su marca.
 */
export function importeExactoCorto(centimos: number, maximo = ANCHO_DE_CASILLA): string {
  const formato = formatoRegional();
  const completo = formatearNumero(Math.abs(centimos), formato);
  const texto = centimos % 100 === 0 ? completo.slice(0, completo.length - 3) : completo;
  return texto.length <= maximo ? texto : '';
}
