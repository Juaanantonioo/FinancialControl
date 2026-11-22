/**
 * Autocomprobación de la biblioteca criptográfica en el propio dispositivo.
 *
 * Antes de permitir cualquier operación de cuenta, la app calcula con la
 * biblioteca que tiene delante (la nativa en el iPhone, la de WebAssembly en
 * el navegador) unos resultados cuyo valor correcto se conoce de antemano, y
 * los compara. Los valores están en `vectores.json` y se calcularon con
 * libsodium directamente (`scripts/vectores-de-cripto.cjs`).
 *
 * Existe porque el paquete que enlaza libsodium lleva un parche propio
 * (`plugins/parche-libsodium.js`). Si ese enlace, la biblioteca o los
 * parámetros dieran un resultado distinto del conocido, las claves de una
 * cuenta no servirían en otro dispositivo: mejor no crear ninguna.
 *
 * Si algo no coincide, las funciones de cuenta quedan desactivadas. El resto
 * de la app no depende de esto y sigue funcionando en local.
 */
import {
  derivarClaveMaestra,
  desenvolverConCodigo,
  desenvolverConContrasena,
  borrar,
  cifrar,
  descifrar,
  leerCodigoDeRecuperacion,
  subclavesDe,
} from './index';
import { ARGON2ID } from './parametros';
import { cargarSodio } from './sodio';
import vectores from './vectores.json';

export type ResultadoDeAutocomprobacion = {
  correcta: boolean;
  /** Milisegundos que tardó la derivación de la clave maestra (Argon2id). */
  milisegundosDeDerivacion: number | null;
};

async function comprobar(): Promise<ResultadoDeAutocomprobacion> {
  const { entrada, salida } = vectores;
  try {
    const sodio = await cargarSodio();
    const hex = (bytes: Uint8Array) => sodio.to_hex(bytes);
    // Los vectores deben haberse calculado con los parámetros que usa la app.
    if (
      entrada.argon2id_pasadas !== ARGON2ID.pasadas ||
      entrada.argon2id_memoria_bytes !== ARGON2ID.memoria
    ) {
      return { correcta: false, milisegundosDeDerivacion: null };
    }
    const inicio = performance.now();
    const maestra = await derivarClaveMaestra(entrada.contrasena, entrada.correo_escrito);
    const milisegundosDeDerivacion = Math.round(performance.now() - inicio);
    const claves = await subclavesDe(maestra);
    const porContrasena = await desenvolverConContrasena(
      salida.sobre_por_contrasena,
      claves.envoltura,
    );
    const porCodigo = await desenvolverConCodigo(
      salida.sobre_por_recuperacion,
      salida.codigo_de_recuperacion,
    );
    // Ida y vuelta con un cifrado nuevo, y rechazo de un sobre alterado.
    const nuevo = await cifrar(claves.envoltura, porContrasena, 'autocomprobacion');
    const deVuelta = await descifrar(claves.envoltura, nuevo, 'autocomprobacion');
    let rechazaLoAlterado = false;
    try {
      await descifrar(claves.envoltura, nuevo, 'autocomprobacion/otro-uso');
    } catch {
      rechazaLoAlterado = true;
    }
    const correcta =
      hex(maestra) === salida.clave_maestra_hex &&
      claves.autenticacion === salida.subclave_de_autenticacion_base64url &&
      hex(claves.envoltura) === salida.subclave_de_envoltura_hex &&
      hex(porContrasena) === entrada.clave_de_datos_hex &&
      hex(porCodigo) === entrada.clave_de_datos_hex &&
      hex(deVuelta) === entrada.clave_de_datos_hex &&
      rechazaLoAlterado &&
      (await leerCodigoDeRecuperacion(salida.codigo_de_recuperacion)) ===
        salida.codigo_de_recuperacion;
    // Son claves de ejemplo, públicas; se borran igualmente, por costumbre.
    borrar(maestra, claves.envoltura, porContrasena, porCodigo, deVuelta);
    return { correcta, milisegundosDeDerivacion };
  } catch {
    return { correcta: false, milisegundosDeDerivacion: null };
  }
}

let enCurso: Promise<ResultadoDeAutocomprobacion> | null = null;

/**
 * Comprueba la biblioteca. Se calcula una vez por arranque de la app y se
 * recuerda. Nunca lanza un error: un fallo es `correcta: false`.
 */
export function autocomprobarCripto(): Promise<ResultadoDeAutocomprobacion> {
  enCurso ??= comprobar();
  return enCurso;
}

/** Solo para pruebas: olvida el resultado recordado. */
export function olvidarAutocomprobacion(): void {
  enCurso = null;
}

/**
 * Mide cuánto tarda en este dispositivo la derivación de la clave maestra,
 * con una contraseña y un correo de ejemplo. Devuelve solo el tiempo: la
 * clave calculada se borra y no sale de aquí.
 */
export async function medirDerivacion(): Promise<number | null> {
  try {
    const inicio = performance.now();
    const maestra = await derivarClaveMaestra(
      vectores.entrada.contrasena,
      vectores.entrada.correo_escrito,
    );
    const milisegundos = Math.round(performance.now() - inicio);
    borrar(maestra);
    return milisegundos;
  } catch {
    return null;
  }
}
