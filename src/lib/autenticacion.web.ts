/**
 * Autenticación del dispositivo en el navegador: no hay Face ID ni código del
 * sistema al alcance de una página. La capacidad es «ninguna» y el bloqueo de
 * la app no se ofrece. En la web la barrera es la contraseña de la cuenta, que
 * se pide en cada carga de la página.
 */
import type { Capacidad, ResultadoDeAutenticacion } from '@/dominio/bloqueo';

export interface Autenticador {
  capacidad(): Promise<Capacidad>;
  autenticar(motivo: string, cancelar: string): Promise<ResultadoDeAutenticacion>;
}

export const autenticador: Autenticador = {
  capacidad: async () => 'ninguna',
  autenticar: async () => 'no_disponible',
};
