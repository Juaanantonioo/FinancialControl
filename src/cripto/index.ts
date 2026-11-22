/**
 * Módulo criptográfico de la app. Es una capa fina y sin estado sobre
 * libsodium: aquí no hay ninguna primitiva escrita a mano, solo llamadas a la
 * biblioteca y el orden en que se hacen. El diseño completo, con el formato
 * byte a byte y los vectores de prueba, está en
 * `docs/seguridad/diseno-criptografico.md`.
 *
 * Jerarquía:
 *   contraseña + sal(correo) --Argon2id--> clave maestra
 *   clave maestra --crypto_kdf--> subclave de autenticación (va al servidor)
 *   clave maestra --crypto_kdf--> subclave de envoltura
 *   código de recuperación --crypto_kdf--> clave de recuperación
 *   clave de datos: aleatoria; se guarda envuelta con las dos anteriores
 *
 * Reglas de uso:
 * - Las claves son `Uint8Array` y viven en memoria lo mínimo: quien las pide
 *   las pasa por `borrar` en cuanto termina.
 * - Todo fallo sale como `ErrorDeCripto`, sin motivo.
 */
import { aBase32, deBase32 } from './base32';
import { ErrorDeCripto } from './errores';
import {
  ARGON2ID,
  BYTES_DE_CLAVE,
  BYTES_DE_CONTROL,
  BYTES_DE_ETIQUETA,
  BYTES_DE_NONCE,
  BYTES_DE_SAL,
  BYTES_DE_SECRETO_DE_RECUPERACION,
  CONSTANTE_DE_CONTROL,
  CONSTANTE_DE_SAL,
  SIMBOLOS_POR_GRUPO,
  SUBCLAVE_DE_AUTENTICACION,
  SUBCLAVE_DE_ENVOLTURA,
  SUBCLAVE_DE_RECUPERACION,
  USO_CLAVE_POR_CONTRASENA,
  USO_CLAVE_POR_RECUPERACION,
  VERSION_DE_FORMATO,
} from './parametros';
import { cargarSodio } from './sodio';

export { ErrorDeCripto } from './errores';
export { GRUPOS_DEL_CODIGO, VERSION_DE_DERIVACION, VERSION_DE_FORMATO } from './parametros';

/** Claves que salen de la contraseña. */
export type ClavesDeLaContrasena = {
  /**
   * Lo que se envía al servidor en lugar de la contraseña, ya como texto
   * (base64 para URL, sin relleno, 43 caracteres).
   */
  autenticacion: string;
  /** Clave que envuelve la clave de datos. No sale del dispositivo. */
  envoltura: Uint8Array;
};

const utf8 = (texto: string): Uint8Array => new TextEncoder().encode(texto);

/** Pone a cero el contenido de unas claves. Hay que llamarlo al terminar de usarlas. */
export function borrar(...claves: (Uint8Array | null | undefined)[]): void {
  for (const clave of claves) clave?.fill(0);
}

/** Carga la biblioteca. Las demás funciones la esperan solas; esto solo adelanta la carga. */
export async function prepararCripto(): Promise<void> {
  await cargarSodio();
}

/**
 * Forma única de un correo: sin espacios en los extremos, en forma Unicode
 * NFKC y en minúsculas. De ella sale la sal, así que el mismo correo escrito
 * con mayúsculas o con un espacio de más da las mismas claves.
 */
export function normalizarCorreo(correo: string): string {
  return correo.normalize('NFKC').trim().toLowerCase();
}

/** Sal de Argon2id: BLAKE2b de 16 bytes del correo normalizado, con la constante de la app como clave. */
export async function salDelCorreo(correo: string): Promise<Uint8Array> {
  const sodio = await cargarSodio();
  return sodio.crypto_generichash(
    BYTES_DE_SAL,
    utf8(normalizarCorreo(correo)),
    utf8(CONSTANTE_DE_SAL),
  );
}

/**
 * Clave maestra: Argon2id de la contraseña (en forma NFKC, para que la misma
 * contraseña dé lo mismo en cualquier teclado y plataforma) con la sal del
 * correo. Tarda a propósito. No sale nunca del dispositivo.
 */
export async function derivarClaveMaestra(contrasena: string, correo: string): Promise<Uint8Array> {
  const sodio = await cargarSodio();
  const sal = await salDelCorreo(correo);
  const bytes = utf8(contrasena.normalize('NFKC'));
  try {
    return sodio.crypto_pwhash(
      BYTES_DE_CLAVE,
      bytes,
      sal,
      ARGON2ID.pasadas,
      ARGON2ID.memoria,
      sodio.crypto_pwhash_ALG_ARGON2ID13,
    );
  } catch {
    throw new ErrorDeCripto();
  } finally {
    borrar(bytes);
  }
}

/** Las dos subclaves de una clave maestra. */
export async function subclavesDe(maestra: Uint8Array): Promise<ClavesDeLaContrasena> {
  const sodio = await cargarSodio();
  if (maestra.length !== BYTES_DE_CLAVE) throw new ErrorDeCripto();
  const autenticacion = sodio.crypto_kdf_derive_from_key(
    BYTES_DE_CLAVE,
    SUBCLAVE_DE_AUTENTICACION.numero,
    SUBCLAVE_DE_AUTENTICACION.contexto,
    maestra,
  );
  const envoltura = sodio.crypto_kdf_derive_from_key(
    BYTES_DE_CLAVE,
    SUBCLAVE_DE_ENVOLTURA.numero,
    SUBCLAVE_DE_ENVOLTURA.contexto,
    maestra,
  );
  try {
    return { autenticacion: sodio.to_base64(autenticacion), envoltura };
  } finally {
    borrar(autenticacion);
  }
}

/**
 * De la contraseña y el correo, lo que hace falta para entrar: la clave de
 * autenticación y la de envoltura. La clave maestra se borra antes de volver.
 */
export async function derivarClaves(
  contrasena: string,
  correo: string,
): Promise<ClavesDeLaContrasena> {
  const maestra = await derivarClaveMaestra(contrasena, correo);
  try {
    return await subclavesDe(maestra);
  } finally {
    borrar(maestra);
  }
}

/** Clave de datos nueva: 256 bits del generador aleatorio de la biblioteca. */
export async function generarClaveDeDatos(): Promise<Uint8Array> {
  const sodio = await cargarSodio();
  return sodio.randombytes_buf(BYTES_DE_CLAVE);
}

// ------------------------------------------------------------------ sobre

/** Lo que se autentica junto al contenido: la versión del formato y para qué es el sobre. */
function datosAutenticados(version: number, uso: string): string {
  // Solo ASCII visible: se escribe igual en todas las plataformas.
  if (!/^[\x21-\x7E]{1,200}$/.test(uso)) throw new ErrorDeCripto();
  return `FC${version}|${uso}`;
}

/**
 * Cifra un contenido en un sobre: un byte de versión, 24 de nonce aleatorio
 * y el contenido cifrado con su etiqueta (XChaCha20-Poly1305). Se devuelve en
 * base64 para URL, sin relleno. `uso` dice para qué es (por ejemplo,
 * `fila/movimiento/<id>`): el mismo sobre presentado para otro uso no se abre.
 */
export async function cifrar(clave: Uint8Array, datos: Uint8Array, uso: string): Promise<string> {
  const sodio = await cargarSodio();
  if (clave.length !== BYTES_DE_CLAVE) throw new ErrorDeCripto();
  const autenticados = datosAutenticados(VERSION_DE_FORMATO, uso);
  try {
    const nonce = sodio.randombytes_buf(BYTES_DE_NONCE);
    const cifrado = sodio.crypto_aead_xchacha20poly1305_ietf_encrypt(
      datos,
      autenticados,
      null,
      nonce,
      clave,
    );
    const sobre = new Uint8Array(1 + BYTES_DE_NONCE + cifrado.length);
    sobre[0] = VERSION_DE_FORMATO;
    sobre.set(nonce, 1);
    sobre.set(cifrado, 1 + BYTES_DE_NONCE);
    return sodio.to_base64(sobre);
  } catch {
    throw new ErrorDeCripto();
  }
}

/** Abre un sobre. Cualquier fallo, sea cual sea, sale como `ErrorDeCripto`. */
export async function descifrar(
  clave: Uint8Array,
  sobre: string,
  uso: string,
): Promise<Uint8Array> {
  const sodio = await cargarSodio();
  try {
    if (clave.length !== BYTES_DE_CLAVE) throw new ErrorDeCripto();
    if (typeof sobre !== 'string' || !/^[A-Za-z0-9_-]+$/.test(sobre)) throw new ErrorDeCripto();
    const bytes = sodio.from_base64(sobre);
    if (bytes.length < 1 + BYTES_DE_NONCE + BYTES_DE_ETIQUETA) throw new ErrorDeCripto();
    if (bytes[0] !== VERSION_DE_FORMATO) throw new ErrorDeCripto();
    return sodio.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      bytes.subarray(1 + BYTES_DE_NONCE),
      datosAutenticados(VERSION_DE_FORMATO, uso),
      bytes.subarray(1, 1 + BYTES_DE_NONCE),
      clave,
    );
  } catch {
    throw new ErrorDeCripto();
  }
}

// ------------------------------------------------- código de recuperación

async function controlDe(secreto: Uint8Array): Promise<Uint8Array> {
  const sodio = await cargarSodio();
  return sodio
    .crypto_generichash(BYTES_DE_SAL, secreto, utf8(CONSTANTE_DE_CONTROL))
    .subarray(0, BYTES_DE_CONTROL);
}

function enGrupos(simbolos: string): string {
  return (simbolos.match(new RegExp(`.{${SIMBOLOS_POR_GRUPO}}`, 'g')) ?? []).join('-');
}

/**
 * Código de recuperación nuevo: 256 bits aleatorios más 24 de control, en 14
 * grupos de cuatro símbolos sin caracteres ambiguos. Quien lo tenga puede
 * abrir la clave de datos: se enseña una vez y no se guarda en ningún sitio.
 */
export async function generarCodigoDeRecuperacion(): Promise<string> {
  const sodio = await cargarSodio();
  const secreto = sodio.randombytes_buf(BYTES_DE_SECRETO_DE_RECUPERACION);
  const completo = new Uint8Array(BYTES_DE_SECRETO_DE_RECUPERACION + BYTES_DE_CONTROL);
  try {
    completo.set(secreto, 0);
    completo.set(await controlDe(secreto), BYTES_DE_SECRETO_DE_RECUPERACION);
    return enGrupos(aBase32(completo));
  } finally {
    borrar(secreto, completo);
  }
}

/** El secreto de un código bien escrito, o `null` si tiene una errata. */
async function secretoDelCodigo(codigo: string): Promise<Uint8Array | null> {
  const completo = typeof codigo === 'string' && codigo.length <= 200 ? deBase32(codigo) : null;
  if (completo?.length !== BYTES_DE_SECRETO_DE_RECUPERACION + BYTES_DE_CONTROL) return null;
  const secreto = completo.slice(0, BYTES_DE_SECRETO_DE_RECUPERACION);
  const esperado = await controlDe(secreto);
  const coincide = esperado.every(
    (byte, i) => byte === completo[BYTES_DE_SECRETO_DE_RECUPERACION + i],
  );
  borrar(completo);
  if (coincide) return secreto;
  borrar(secreto);
  return null;
}

/**
 * Lee un código escrito por una persona. Admite minúsculas, espacios, guiones
 * de más o de menos, y O, I y L en lugar de 0 y 1. Devuelve el código en su
 * forma canónica, o `null` si la suma de control no cuadra (una errata).
 */
export async function leerCodigoDeRecuperacion(texto: string): Promise<string | null> {
  const secreto = await secretoDelCodigo(texto);
  if (!secreto) return null;
  borrar(secreto);
  const completo = deBase32(texto);
  return completo ? enGrupos(aBase32(completo)) : null;
}

/**
 * Posiciones distintas elegidas al azar entre `total`, en orden creciente. Se
 * usa para pedir a la persona dos grupos de su código. El azar sale del
 * generador de la biblioteca.
 */
export async function posicionesAlAzar(total: number, cuantas: number): Promise<number[]> {
  const sodio = await cargarSodio();
  const elegidas = new Set<number>();
  while (elegidas.size < Math.min(cuantas, total)) {
    elegidas.add(sodio.randombytes_uniform(total));
  }
  return [...elegidas].sort((x, y) => x - y);
}

/** Los grupos de un código, en orden. */
export function gruposDelCodigo(codigo: string): string[] {
  return codigo.split('-');
}

async function claveDeRecuperacion(codigo: string): Promise<Uint8Array> {
  const sodio = await cargarSodio();
  const secreto = await secretoDelCodigo(codigo);
  if (!secreto) throw new ErrorDeCripto();
  try {
    return sodio.crypto_kdf_derive_from_key(
      BYTES_DE_CLAVE,
      SUBCLAVE_DE_RECUPERACION.numero,
      SUBCLAVE_DE_RECUPERACION.contexto,
      secreto,
    );
  } finally {
    borrar(secreto);
  }
}

// ------------------------------------------- envoltura de la clave de datos

/** Envuelve la clave de datos con la clave de envoltura que sale de la contraseña. */
export function envolverConContrasena(datos: Uint8Array, envoltura: Uint8Array): Promise<string> {
  if (datos.length !== BYTES_DE_CLAVE) return Promise.reject(new ErrorDeCripto());
  return cifrar(envoltura, datos, USO_CLAVE_POR_CONTRASENA);
}

/** Recupera la clave de datos. Falla si la contraseña no era la buena. */
export async function desenvolverConContrasena(
  sobre: string,
  envoltura: Uint8Array,
): Promise<Uint8Array> {
  const datos = await descifrar(envoltura, sobre, USO_CLAVE_POR_CONTRASENA);
  if (datos.length !== BYTES_DE_CLAVE) throw new ErrorDeCripto();
  return datos;
}

/** Envuelve la clave de datos con la clave que sale del código de recuperación. */
export async function envolverConCodigo(datos: Uint8Array, codigo: string): Promise<string> {
  if (datos.length !== BYTES_DE_CLAVE) throw new ErrorDeCripto();
  const clave = await claveDeRecuperacion(codigo);
  try {
    return await cifrar(clave, datos, USO_CLAVE_POR_RECUPERACION);
  } finally {
    borrar(clave);
  }
}

/** Recupera la clave de datos con el código de recuperación. */
export async function desenvolverConCodigo(sobre: string, codigo: string): Promise<Uint8Array> {
  const clave = await claveDeRecuperacion(codigo);
  try {
    const datos = await descifrar(clave, sobre, USO_CLAVE_POR_RECUPERACION);
    if (datos.length !== BYTES_DE_CLAVE) throw new ErrorDeCripto();
    return datos;
  } finally {
    borrar(clave);
  }
}

/** Una clave como texto, para guardarla en el llavero. Solo para eso. */
export async function claveATexto(clave: Uint8Array): Promise<string> {
  return (await cargarSodio()).to_base64(clave);
}

/** La clave guardada en el llavero, de vuelta a bytes. */
export async function claveDeTexto(texto: string): Promise<Uint8Array> {
  try {
    if (!/^[A-Za-z0-9_-]{43}$/.test(texto)) throw new ErrorDeCripto();
    const clave = (await cargarSodio()).from_base64(texto);
    if (clave.length !== BYTES_DE_CLAVE) throw new ErrorDeCripto();
    return clave;
  } catch {
    throw new ErrorDeCripto();
  }
}
