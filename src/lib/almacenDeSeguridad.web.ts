/**
 * Preferencias de seguridad en el navegador: no hay ninguna.
 *
 * El bloqueo con Face ID no existe en un navegador, y no hace falta: en la web
 * recargar o cerrar la pestaña ya obliga a escribir la contraseña. El modo
 * privado (ocultar cifras en el widget y en los avisos) tampoco aplica: no hay
 * widget ni avisos. Así que el bloqueo está siempre desactivado y nada se guarda.
 */
import { SIN_BLOQUEO } from '@/dominio/bloqueo';

import type { AlmacenDeSeguridad } from './seguridad';

export const almacenDeSeguridad: AlmacenDeSeguridad = {
  leerBloqueo: () => ({ ...SIN_BLOQUEO }),
  guardarBloqueo: async () => undefined,
  leerModoPrivado: () => false,
  guardarModoPrivado: async () => undefined,
};
