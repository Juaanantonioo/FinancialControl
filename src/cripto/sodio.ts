/**
 * Único punto de la app que carga la biblioteca criptográfica (libsodium).
 *
 * `react-native-libsodium` usa la biblioteca nativa en iOS y Android y la
 * versión en WebAssembly en el navegador. En web hace falta la variante
 * «sumo», que es la que incluye Argon2id (`crypto_pwhash`); por eso se pide
 * antes de esperar a que esté lista. En nativo esa llamada no hace nada.
 *
 * Nada fuera de `src/cripto/` debe importar este fichero ni la biblioteca.
 */
import sodio from 'react-native-libsodium';

sodio.loadSumoVersion();

export type Sodio = typeof sodio;

/** La biblioteca, lista para usarse. */
export async function cargarSodio(): Promise<Sodio> {
  await sodio.ready;
  return sodio;
}
