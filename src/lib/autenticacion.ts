/**
 * Capa fina sobre expo-local-authentication: Face ID, Touch ID o el código
 * del iPhone. Todo lo que decide cuándo pedirla está en
 * `src/dominio/bloqueo.ts`; aquí solo se traduce a llamadas del sistema,
 * detrás de la interfaz `Autenticador`, que las pruebas sustituyen.
 *
 * No se guarda ningún secreto ligado a la biometría: solo se pregunta al
 * sistema «¿es la persona dueña del iPhone?» y se recibe un sí o un no.
 */
import * as LocalAuthentication from 'expo-local-authentication';

import type { Capacidad, ResultadoDeAutenticacion } from '@/dominio/bloqueo';

export interface Autenticador {
  /** Con qué puede protegerse este iPhone ahora mismo. */
  capacidad(): Promise<Capacidad>;
  /**
   * Pide la cara o la huella y, si fallan o no hay, el código del iPhone.
   * Nunca lanza un error: lo que no sea un sí es un no.
   */
  autenticar(motivo: string, cancelar: string): Promise<ResultadoDeAutenticacion>;
}

const CANCELADOS = ['user_cancel', 'system_cancel', 'app_cancel'];
const NO_DISPONIBLES = ['passcode_not_set', 'not_enrolled', 'not_available'];

export const autenticador: Autenticador = {
  async capacidad() {
    try {
      const nivel = await LocalAuthentication.getEnrolledLevelAsync();
      if (nivel === LocalAuthentication.SecurityLevel.NONE) return 'ninguna';
      return nivel === LocalAuthentication.SecurityLevel.SECRET ? 'codigo' : 'biometria';
    } catch {
      return 'ninguna';
    }
  },
  async autenticar(motivo, cancelar) {
    try {
      const respuesta = await LocalAuthentication.authenticateAsync({
        promptMessage: motivo,
        cancelLabel: cancelar,
        // Si la cara o la huella fallan, el sistema ofrece el código del iPhone.
        disableDeviceFallback: false,
      });
      if (respuesta.success) return 'correcto';
      if (CANCELADOS.includes(respuesta.error)) return 'cancelado';
      if (NO_DISPONIBLES.includes(respuesta.error)) return 'no_disponible';
      return 'fallido';
    } catch {
      return 'fallido';
    }
  },
};
