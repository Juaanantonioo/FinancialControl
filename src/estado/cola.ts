/**
 * Paso de la cola de las acciones de Atajos a la base de datos.
 *
 * Las acciones «Registrar pago» y «Añadir gasto» se ejecutan con la app
 * cerrada y dejan su trabajo en una cola del dispositivo. Al abrir la app,
 * cada entrada de esa cola se convierte aquí en una captura. La captura de
 * prueba de la guía entra por este mismo camino.
 */
import type { Repositorios } from '@/datos';
import {
  ACCION_REGISTRAR_PAGO,
  gastoDeLaInvocacion,
  pagoDeLaInvocacion,
  type Invocacion,
} from '@/dominio/captura';

/**
 * Importa las entradas de la cola. Cada una se identifica por su `id`, así
 * que importar dos veces la misma no crea nada nuevo. Una entrada que no se
 * puede leer se salta: nunca interrumpe a las demás. Devuelve cuántas
 * capturas nuevas han quedado pendientes.
 */
export async function importarInvocaciones(
  repos: Repositorios,
  invocaciones: Invocacion[],
  ahora: string,
): Promise<number> {
  const antes = await repos.capturas.contarPendientes();
  // De la más antigua a la más reciente: así la regla de duplicados marca la segunda.
  const enOrden = [...invocaciones].sort((x, y) => (x.createdAt ?? 0) - (y.createdAt ?? 0));
  for (const invocacion of enOrden) {
    try {
      const pago = pagoDeLaInvocacion(invocacion, ahora);
      if (pago) {
        await repos.capturas.registrar(pago);
        continue;
      }
      const gasto = gastoDeLaInvocacion(invocacion, ahora);
      if (gasto) await repos.capturas.anadirGasto(gasto);
    } catch {
      // Una entrada estropeada no debe impedir importar las demás.
    }
  }
  return (await repos.capturas.contarPendientes()) - antes;
}

/** Entrada de ejemplo, con la misma forma que deja la acción «Registrar pago». */
export function invocacionDePrueba(id: string, comercio: string, ahora: number): Invocacion {
  return {
    id: `prueba-${id}`,
    name: ACCION_REGISTRAR_PAGO,
    params: { importe: '12,34 €', comercio, tarjeta: '', origen: 'prueba' },
    createdAt: ahora,
  };
}
