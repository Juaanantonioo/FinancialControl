/**
 * Dónde se guardan las preferencias de seguridad.
 *
 * - El bloqueo, en el almacén de clave y valor de expo-sqlite, como el resto
 *   de preferencias. Se lee sin esperar para decidir antes del primer pintado.
 * - El modo privado, en las preferencias del sistema (`UserDefaults`), porque
 *   es el único sitio que también puede leer el código Swift del aviso de
 *   captura. Un solo valor para la app y para Swift; al widget le llega
 *   dentro de los datos que la app le envía.
 *
 * Ninguno de los dos es un secreto: son dos interruptores.
 */
import Storage from 'expo-sqlite/kv-store';
import { Settings } from 'react-native';

import { BLOQUEO_MAS_ESTRICTO, interpretarBloqueo } from '@/dominio/bloqueo';

import {
  CLAVE_DE_BLOQUEO,
  CLAVE_DE_MODO_PRIVADO,
  interpretarModoPrivado,
  type AlmacenDeSeguridad,
} from './seguridad';

export const almacenDeSeguridad: AlmacenDeSeguridad = {
  leerBloqueo() {
    try {
      return interpretarBloqueo(Storage.getItemSync(CLAVE_DE_BLOQUEO));
    } catch {
      // Si no se puede leer no se sabe si había bloqueo: se pide autenticación.
      return { ...BLOQUEO_MAS_ESTRICTO };
    }
  },
  async guardarBloqueo(ajustes) {
    await Storage.setItemAsync(CLAVE_DE_BLOQUEO, JSON.stringify(ajustes));
  },
  leerModoPrivado() {
    try {
      return interpretarModoPrivado(Settings.get(CLAVE_DE_MODO_PRIVADO));
    } catch {
      return false;
    }
  },
  async guardarModoPrivado(activo) {
    Settings.set({ [CLAVE_DE_MODO_PRIVADO]: activo });
  },
};
