/**
 * La biblioteca criptográfica en el navegador: libsodium compilada a
 * WebAssembly, en su variante «sumo», que es la que incluye Argon2id. Es la
 * misma versión exacta (0.8.4) que usan las pruebas, y la misma libsodium que
 * la app de iOS lleva compilada en nativo: mismas funciones, mismos resultados.
 * La autocomprobación de vectores lo verifica en cada navegador antes de
 * permitir cualquier operación de cuenta.
 *
 * Único punto de carga en web. Nada fuera de `src/cripto/` debe importarlo.
 */
import sodio from 'libsodium-wrappers-sumo';

import type { Sodio } from './sodio';

/** La biblioteca, lista para usarse. */
export async function cargarSodio(): Promise<Sodio> {
  // El objeto por defecto es la biblioteca entera; `ready` es su promesa de carga.
  // eslint-disable-next-line import/no-named-as-default-member
  await sodio.ready;
  return sodio as unknown as Sodio;
}

export type { Sodio };
