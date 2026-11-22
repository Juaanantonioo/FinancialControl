/**
 * La apariencia elegida, en el navegador: `localStorage`. Es una de las dos
 * únicas cosas que la web guarda (la otra es el correo, para rellenar el
 * formulario de entrada). No es un dato sensible: vale «automatico», «claro»
 * u «oscuro».
 */
import {
  APARIENCIA_POR_DEFECTO,
  CLAVE_DE_APARIENCIA,
  interpretarApariencia,
  type AlmacenDeApariencia,
} from '@/lib/apariencia';

const CLAVE = `fc.${CLAVE_DE_APARIENCIA}`;

export const almacenDeApariencia: AlmacenDeApariencia = {
  leer() {
    try {
      return interpretarApariencia(globalThis.localStorage?.getItem(CLAVE) ?? null);
    } catch {
      // Navegación privada o almacenamiento bloqueado: se sigue al sistema.
      return APARIENCIA_POR_DEFECTO;
    }
  },
  async guardar(apariencia) {
    try {
      globalThis.localStorage?.setItem(CLAVE, apariencia);
    } catch {
      // Si no se puede guardar, el cambio vale hasta recargar.
    }
  },
};
