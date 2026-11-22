/**
 * Parámetros criptográficos de la app. Cada valor está justificado, con su
 * referencia, en `docs/seguridad/diseno-criptografico.md`. Cambiar cualquiera
 * de ellos exige una versión nueva (de derivación o de formato): con la misma
 * versión, los mismos datos de entrada deben dar siempre el mismo resultado.
 */

/** Versión de la derivación de claves a partir de la contraseña. */
export const VERSION_DE_DERIVACION = 1;
/** Versión del formato del sobre cifrado. Es su primer byte. */
export const VERSION_DE_FORMATO = 1;

/**
 * Argon2id (libsodium `crypto_pwhash`, algoritmo ARGON2ID13).
 *
 * PROVISIONALES: decididos el 18/11/2026 sin haberlos medido en un iPhone ni
 * en un navegador de móvil. Hay que medirlos (Ajustes › Diagnóstico) y
 * fijarlos antes de crear la primera cuenta real: cambiarlos después exige
 * una versión de derivación nueva.
 */
export const ARGON2ID = {
  /** Pasadas sobre la memoria (`opslimit`). */
  pasadas: 8,
  /** Memoria en bytes (`memlimit`): 64 MiB. */
  memoria: 64 * 1024 * 1024,
} as const;

/** Coste de Argon2id de una versión de derivación. */
export type ParametrosDeDerivacion = { readonly pasadas: number; readonly memoria: number };

/**
 * Parámetros de cada versión de derivación. La cuenta guarda con qué versión
 * se derivaron sus claves; al iniciar sesión con una anterior a la actual, la
 * app rehace la envoltura con la actual (bloque 4b-2). Hoy solo existe la 1.
 */
export const PARAMETROS_POR_VERSION: Readonly<Record<number, ParametrosDeDerivacion>> = {
  [VERSION_DE_DERIVACION]: ARGON2ID,
};

/** Clave de BLAKE2b con la que se calcula la sal a partir del correo. */
export const CONSTANTE_DE_SAL = 'FinancialControl/sal-de-cuenta/v1';
/** Clave de BLAKE2b con la que se calcula la suma de control del código de recuperación. */
export const CONSTANTE_DE_CONTROL = 'FinancialControl/control-de-codigo/v1';

/** Subclaves que salen de la clave maestra: número y contexto de `crypto_kdf`. */
export const SUBCLAVE_DE_AUTENTICACION = { numero: 1, contexto: 'FCautent' } as const;
export const SUBCLAVE_DE_ENVOLTURA = { numero: 2, contexto: 'FCenvolt' } as const;
/** Subclave que sale del secreto del código de recuperación. */
export const SUBCLAVE_DE_RECUPERACION = { numero: 1, contexto: 'FCrecupe' } as const;

/** Para qué es un sobre. Entra en los datos autenticados: un sobre no vale para otro uso. */
export const USO_CLAVE_POR_CONTRASENA = 'clave-de-datos/contrasena';
export const USO_CLAVE_POR_RECUPERACION = 'clave-de-datos/recuperacion';

export const BYTES_DE_CLAVE = 32;
export const BYTES_DE_SAL = 16;
export const BYTES_DE_NONCE = 24;
export const BYTES_DE_ETIQUETA = 16;
/** Secreto del código de recuperación: 256 bits. */
export const BYTES_DE_SECRETO_DE_RECUPERACION = 32;
/** Suma de control del código de recuperación: 24 bits. */
export const BYTES_DE_CONTROL = 3;
/** El código se escribe en grupos de cuatro símbolos. */
export const SIMBOLOS_POR_GRUPO = 4;
export const GRUPOS_DEL_CODIGO = 14;
