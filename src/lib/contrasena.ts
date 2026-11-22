/**
 * Reglas de la contraseña de la cuenta. No mide «fortaleza»: exige una
 * longitud mínima y rechaza una lista corta de contraseñas evidentes.
 *
 * La contraseña cifra los datos y nadie puede restablecerla, así que
 * conviene que sea larga. Una frase de varias palabras es buena opción.
 */
export const LONGITUD_MINIMA_DE_CONTRASENA = 12;
/** Más larga no aporta nada y solo sirve para atascar la derivación. */
export const LONGITUD_MAXIMA_DE_CONTRASENA = 256;

/** Contraseñas de 12 caracteres o más que cualquiera probaría primero. Se comparan sin mayúsculas ni espacios. */
const EVIDENTES = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '012345678901',
  '111111111111',
  '000000000000',
  '123123123123',
  '121212121212',
  'abcdefghijkl',
  'abcdefghijklm',
  'qwertyuiopas',
  'qwertyuiop12',
  'qwertyuiop123',
  'qwerty123456',
  'asdfghjklzxc',
  '1q2w3e4r5t6y',
  'password1234',
  'password12345',
  'passwordpassword',
  'contraseña123',
  'contraseña1234',
  'contrasena123',
  'contrasena1234',
  'micontraseña',
  'micontrasena',
  'financialcontrol',
  'financialcontrol1',
  'iloveyou1234',
  'tequiero1234',
  'administrador',
  'administrator',
  'letmein12345',
  'bienvenido123',
  'welcome12345',
]);

export type ProblemaDeContrasena = 'corta' | 'larga' | 'evidente' | 'es_el_correo';

const simplificar = (texto: string) => texto.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

/** El problema de una contraseña, o `null` si se acepta. */
export function problemaDeContrasena(
  contrasena: string,
  correo: string,
): ProblemaDeContrasena | null {
  const caracteres = [...contrasena.normalize('NFKC')];
  if (caracteres.length < LONGITUD_MINIMA_DE_CONTRASENA) return 'corta';
  if (caracteres.length > LONGITUD_MAXIMA_DE_CONTRASENA) return 'larga';
  const simple = simplificar(contrasena);
  const correoSimple = simplificar(correo);
  if (
    correoSimple.length > 0 &&
    (simple === correoSimple || simple === correoSimple.split('@')[0])
  ) {
    return 'es_el_correo';
  }
  // Un solo carácter repetido, o un par repetido («abababababab»).
  if (new Set(simple).size <= 2) return 'evidente';
  if (EVIDENTES.has(simple)) return 'evidente';
  return null;
}

/** Comprobación mínima de la forma de un correo: algo, arroba, algo con un punto. */
export function esCorreoValido(correo: string): boolean {
  const limpio = correo.trim();
  return limpio.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio);
}
