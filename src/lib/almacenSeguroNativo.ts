/**
 * El llavero del sistema como almacén de secretos (expo-secure-store).
 *
 * - `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: se puede leer desde el primer
 *   desbloqueo tras encender el iPhone, y no viaja a otros dispositivos ni
 *   entra en las copias de seguridad que se restauran en otro teléfono.
 * - Sin `requireAuthentication`: nada queda vinculado a la cara o la huella.
 *   Cambiar Face ID no puede dejar a nadie sin su clave.
 */
import * as SecureStore from 'expo-secure-store';

import type { AlmacenSeguro } from './almacenSeguro';

const OPCIONES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

export const almacenSeguro: AlmacenSeguro = {
  leer: (clave) => SecureStore.getItemAsync(clave, OPCIONES),
  guardar: (clave, valor) => SecureStore.setItemAsync(clave, valor, OPCIONES),
  borrar: (clave) => SecureStore.deleteItemAsync(clave, OPCIONES),
};
