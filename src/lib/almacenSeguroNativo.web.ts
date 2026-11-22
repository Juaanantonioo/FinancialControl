/**
 * El almacén de secretos en el navegador: SOLO MEMORIA.
 *
 * En un navegador no hay llavero. Cualquier sitio donde se pueda guardar algo
 * (localStorage, IndexedDB, cookies) lo puede leer un script que se cuele en
 * la página, y sobrevive a cerrar la pestaña. Por eso aquí la clave de datos
 * y la sesión viven en una variable y nada más: recargar o cerrar la pestaña
 * las borra, y hay que volver a escribir la contraseña.
 *
 * Es la respuesta a la decisión que el bloque 4b-1 dejó abierta.
 */
import type { AlmacenSeguro } from './almacenSeguro';

const memoria = new Map<string, string>();

export const almacenSeguro: AlmacenSeguro = {
  leer: async (clave) => memoria.get(clave) ?? null,
  guardar: async (clave, valor) => {
    memoria.set(clave, valor);
  },
  borrar: async (clave) => {
    memoria.delete(clave);
  },
};
