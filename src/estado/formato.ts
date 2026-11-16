/**
 * Formato de números de la región del dispositivo (docs/03, apartado 10):
 * separador decimal, separador de miles y posición del símbolo.
 */
import { getLocales } from 'expo-localization';

import { dinero, FORMATO_ES, formatearDinero, type FormatoRegional } from '@/dominio/dinero';

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
