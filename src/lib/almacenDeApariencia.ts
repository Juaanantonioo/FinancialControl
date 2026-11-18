/**
 * Dónde se guarda la apariencia elegida: en el mismo almacén de clave y
 * valor que el resto de preferencias (expo-sqlite), en el propio
 * dispositivo. No va en la base de datos financiera.
 *
 * La lectura es síncrona a propósito: la app la hace al arrancar, antes del
 * primer pintado, para que no se vea un destello del tema contrario.
 */
import Storage from 'expo-sqlite/kv-store';

import {
  APARIENCIA_POR_DEFECTO,
  CLAVE_DE_APARIENCIA,
  interpretarApariencia,
  type AlmacenDeApariencia,
} from '@/lib/apariencia';

export const almacenDeApariencia: AlmacenDeApariencia = {
  leer() {
    try {
      return interpretarApariencia(Storage.getItemSync(CLAVE_DE_APARIENCIA));
    } catch {
      // Si el almacén no se puede leer, la app sigue al sistema.
      return APARIENCIA_POR_DEFECTO;
    }
  },
  async guardar(apariencia) {
    await Storage.setItemAsync(CLAVE_DE_APARIENCIA, apariencia);
  },
};
