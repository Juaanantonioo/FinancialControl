/**
 * Saltos entre pestañas que piden una sección concreta. Las pestañas siguen
 * montadas entre visitas y aplican lo pedido una vez por petición, así que
 * cada salto lleva una marca distinta: pedir dos veces lo mismo funciona.
 */
import { router } from 'expo-router';

let peticiones = 0;

function marca(): string {
  peticiones += 1;
  return `ir-${peticiones}`;
}

export type SeccionDePlan = 'presupuesto' | 'fijos' | 'objetivos';
export type VistaDeAnalisis = 'dia' | 'mes' | 'anio';

/** Abre la pestaña Plan en una sección y, si se da, en un mes. */
export function abrirPlan(seccion: SeccionDePlan, mes?: string): void {
  router.navigate({
    pathname: '/plan',
    params: { seccion, ...(mes ? { mes } : {}), peticion: marca() },
  });
}

/** Abre la pestaña Análisis en una vista y, si se da, en un mes. */
export function abrirAnalisis(vista: VistaDeAnalisis, mes?: string): void {
  router.navigate({
    pathname: '/analisis',
    params: { vista, ...(mes ? { mes } : {}), peticion: marca() },
  });
}
