/**
 * Formato de números de la región del dispositivo (docs/03, apartado 10):
 * separador decimal, separador de miles y posición del símbolo.
 */
import { getLocales } from 'expo-localization';

import { FORMATO_ES, type FormatoRegional } from '@/dominio/dinero';

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
