/**
 * El correo de la última entrada, en el navegador: `localStorage`. En la web
 * hay que escribir la contraseña en cada carga de la página; al menos el correo
 * se rellena solo. No es un secreto, pero en un ordenador compartido deja ver
 * qué correo entró.
 */
const CLAVE = 'fc.correo';

export function leerCorreoRecordado(): string {
  try {
    const guardado = globalThis.localStorage?.getItem(CLAVE) ?? '';
    return guardado.length <= 254 ? guardado : '';
  } catch {
    return '';
  }
}

export function guardarCorreoRecordado(correo: string): void {
  try {
    globalThis.localStorage?.setItem(CLAVE, correo.trim().slice(0, 254));
  } catch {
    // Navegación privada o almacenamiento bloqueado: no se recuerda, y ya está.
  }
}
