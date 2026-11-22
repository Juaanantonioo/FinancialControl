/**
 * Almacén para secretos: la clave de datos y la sesión de la cuenta.
 *
 * Es una interfaz, sin nada nativo. En iOS y Android la cumple el llavero del
 * sistema (`almacenSeguroNativo.ts`). En web no hay llavero: qué usar en un
 * navegador queda PENDIENTE para el bloque de la web, y no se resuelve aquí.
 *
 * Lo que se guarda aquí nunca va a SQLite, al almacén de clave y valor ni a
 * las preferencias del sistema.
 */
export interface AlmacenSeguro {
  leer(clave: string): Promise<string | null>;
  guardar(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
}

/** Nombre con el que se guarda la clave de datos de la cuenta. */
export const CLAVE_DE_DATOS_EN_EL_ALMACEN = 'fc.cuenta.clave-de-datos';
/** Correo de la cuenta abierta. No es un secreto; va con la clave para borrarse con ella. */
export const CORREO_EN_EL_ALMACEN = 'fc.cuenta.correo';
/** Nombre con el que el cliente de Supabase guarda la sesión. */
export const SESION_EN_EL_ALMACEN = 'fc.cuenta.sesion';
