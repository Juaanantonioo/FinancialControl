/**
 * Base32 de Crockford: 32 símbolos sin las letras I, L, O ni U, que se
 * confunden con cifras o entre sí. Al leer, una O se toma por 0 y una I o
 * una L por 1, sin distinguir mayúsculas. No es criptografía: solo es la
 * forma de escribir bytes para que una persona pueda copiarlos.
 */
export const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const CONFUNDIBLES: Record<string, string> = { O: '0', I: '1', L: '1' };

/** Escribe bytes en base32. La longitud en bits debe ser múltiplo de 5. */
export function aBase32(bytes: Uint8Array): string {
  if ((bytes.length * 8) % 5 !== 0) throw new RangeError('longitud no admitida');
  let texto = '';
  let acumulado = 0;
  let bits = 0;
  for (const byte of bytes) {
    acumulado = (acumulado << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      texto += ALFABETO[(acumulado >>> bits) & 31];
    }
    acumulado &= (1 << bits) - 1;
  }
  return texto;
}

/**
 * Lee base32. Ignora espacios y guiones. Devuelve `null` si hay un símbolo
 * que no es del alfabeto o si la longitud no da bytes enteros.
 */
export function deBase32(texto: string): Uint8Array | null {
  const limpio = texto.toUpperCase().replace(/[\s-]/g, '');
  if (limpio.length === 0 || (limpio.length * 5) % 8 !== 0) return null;
  const bytes = new Uint8Array((limpio.length * 5) / 8);
  let acumulado = 0;
  let bits = 0;
  let escritos = 0;
  for (const simbolo of limpio) {
    const valor = ALFABETO.indexOf(CONFUNDIBLES[simbolo] ?? simbolo);
    if (valor < 0) return null;
    acumulado = (acumulado << 5) | valor;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes[escritos++] = (acumulado >>> bits) & 255;
      acumulado &= (1 << bits) - 1;
    }
  }
  return bytes;
}
