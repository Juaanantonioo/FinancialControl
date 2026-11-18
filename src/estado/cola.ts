/**
 * Paso de la cola de las acciones de Atajos a la base de datos.
 *
 * Las acciones «Registrar pago» y «Añadir gasto» se ejecutan con la app
 * cerrada y dejan su trabajo en una cola del dispositivo. Al abrir la app,
 * cada entrada de esa cola se convierte aquí en una captura. La captura de
 * prueba de la guía entra por este mismo camino.
 */
import type { Repositorios } from '@/datos';
import { limpiarTextoExterno } from '@/dominio/entradas';
import {
  ACCION_REGISTRAR_PAGO,
  LONGITUD_MAXIMA_DE_TEXTO,
  gastoDeLaInvocacion,
  pagoDeLaInvocacion,
  type Invocacion,
} from '@/dominio/captura';

/**
 * Copia de la entrada con sus textos limpios: sin caracteres de control y con
 * la longitud acotada. Lo que escribe un atajo es texto de fuera de la app.
 */
function sanear(invocacion: Invocacion): Invocacion {
  const params: Record<string, unknown> = {};
  const crudos: unknown = invocacion.params;
  if (typeof crudos === 'object' && crudos !== null) {
    for (const [clave, valor] of Object.entries(crudos).slice(0, 12)) {
      params[clave] =
        typeof valor === 'string' ? limpiarTextoExterno(valor, LONGITUD_MAXIMA_DE_TEXTO) : valor;
    }
  }
  return { ...invocacion, params: params as Invocacion['params'] };
}

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
  for (const original of enOrden) {
    try {
      const invocacion = sanear(original);
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
