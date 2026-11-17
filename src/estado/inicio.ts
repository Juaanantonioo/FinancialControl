/**
 * Reglas de presentación de Inicio: cuántos elementos caben en cada bloque y
 * qué pasos de «Primeros pasos» están hechos. No calculan dinero: eso lo
 * hace `src/dominio`. Tampoco guardan nada: todo se deduce de los datos.
 */

/** Cobros por confirmar que caben en «Pendiente». El resto, con «Ver todos». */
export const COBROS_EN_PENDIENTE = 3;
/** Avisos de presupuesto que caben en «Pendiente». */
export const AVISOS_EN_PENDIENTE = 3;
/** Próximos cobros que caben en Inicio. */
export const PROXIMOS_EN_INICIO = 3;
/** Objetivos que caben en Inicio. */
export const OBJETIVOS_EN_INICIO = 2;

/** Los primeros `maximo` elementos y cuántos se quedan fuera. */
export function recortar<T>(lista: T[], maximo: number): { visibles: T[]; ocultos: number } {
  return { visibles: lista.slice(0, maximo), ocultos: Math.max(0, lista.length - maximo) };
}

export const PASOS = ['cuenta', 'movimiento', 'presupuesto'] as const;
export type Paso = (typeof PASOS)[number];

export type PrimerosPasos = {
  pasos: { paso: Paso; hecho: boolean }[];
  hechos: number;
  /** `true` cuando no queda ninguno: la tarjeta deja de mostrarse. */
  completos: boolean;
};

/**
 * Estado de los tres primeros pasos: crear una cuenta, anotar un movimiento
 * y crear un presupuesto. Cada uno se da por hecho en cuanto existe el dato.
 */
export function primerosPasos(datos: {
  hayCuenta: boolean;
  hayMovimiento: boolean;
  hayPresupuesto: boolean;
}): PrimerosPasos {
  const hecho: Record<Paso, boolean> = {
    cuenta: datos.hayCuenta,
    movimiento: datos.hayMovimiento,
    presupuesto: datos.hayPresupuesto,
  };
  const pasos = PASOS.map((paso) => ({ paso, hecho: hecho[paso] }));
  const hechos = pasos.filter((p) => p.hecho).length;
  return { pasos, hechos, completos: hechos === pasos.length };
}
