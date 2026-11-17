/**
 * Presupuesto mensual por categorías y disponible del mes (T-060 a T-063,
 * dashboards D1 y D3). Funciones puras: «hoy» entra como parámetro.
 */
import type { CamposComunes } from './modelo';
import {
  moverMes,
  SIN_CATEGORIA,
  sumarGastoPorClave,
  type CategoriaParaResumen,
  type MovimientoParaResumen,
} from './resumen';
import { diasDelMes } from './tiempo';

export type Presupuesto = CamposComunes & {
  /** Mes "AAAA-MM". Hay como mucho un presupuesto por mes. */
  periodo: string;
  nota: string | null;
};

export type LineaDePresupuesto = CamposComunes & {
  presupuestoId: string;
  /** Categoría de gasto de primer nivel. */
  categoriaId: string;
  /** Céntimos, cero o positivo. */
  importe: number;
};

/** A partir de este tanto por ciento gastado una línea está «cerca» del límite. */
export const UMBRAL_DE_AVISO = 80;

export type EstadoDeLinea = 'dentro' | 'cerca' | 'excedida';

/** Estado de una línea: excedida si se gasta más de lo previsto; cerca desde el 80 %. */
export function estadoDeLinea(previsto: number, real: number): EstadoDeLinea {
  if (real > previsto) return 'excedida';
  if (previsto > 0 && real * 100 >= previsto * UMBRAL_DE_AVISO) return 'cerca';
  return 'dentro';
}

export type LineaConGasto = {
  categoriaId: string;
  previsto: number;
  /** Gasto del mes en la categoría y en sus subcategorías. */
  real: number;
  /** Previsto menos real. Negativo si la línea está excedida. */
  queda: number;
  /** Tanto por ciento gastado, sin tope. `null` si lo previsto es cero. */
  porcentaje: number | null;
  estado: EstadoDeLinea;
};

export type EstadoDelPresupuesto = {
  presupuestado: number;
  /** Todo el gasto del mes, tenga línea o no. */
  gastado: number;
  lineas: LineaConGasto[];
  /** Gasto en categorías sin línea y gasto sin categoría. */
  sinPresupuestar: number;
  /** Posición del día de hoy de 0 a 1. Solo en el mes en curso. */
  marcaDelDia: number | null;
};

/** Previsto frente a real de cada línea de un presupuesto. */
export function estadoDelPresupuesto(
  lineas: Pick<LineaDePresupuesto, 'categoriaId' | 'importe' | 'borradoEn'>[],
  movimientos: MovimientoParaResumen[],
  categorias: CategoriaParaResumen[],
  mes: string,
  hoy: string,
): EstadoDelPresupuesto {
  const gastos = sumarGastoPorClave(movimientos, categorias, (f) => f.slice(0, 7) === mes);
  let gastado = 0;
  for (const importe of gastos.values()) gastado += importe;

  const vivas = lineas.filter((l) => l.borradoEn === null);
  let presupuestado = 0;
  let conLinea = 0;
  const resultado: LineaConGasto[] = vivas.map((linea) => {
    const real = gastos.get(linea.categoriaId) ?? 0;
    presupuestado += linea.importe;
    conLinea += real;
    return {
      categoriaId: linea.categoriaId,
      previsto: linea.importe,
      real,
      queda: linea.importe - real,
      porcentaje: linea.importe > 0 ? Math.round((real * 100) / linea.importe) : null,
      estado: estadoDeLinea(linea.importe, real),
    };
  });

  return {
    presupuestado,
    gastado,
    lineas: resultado,
    sinPresupuestar: gastado - conLinea,
    marcaDelDia: mes === hoy.slice(0, 7) ? Number(hoy.slice(8, 10)) / diasDelMes(mes) : null,
  };
}

/**
 * Propuesta para un presupuesto nuevo: la media de gasto de cada categoría
 * principal en los tres meses naturales anteriores. La media se reparte
 * entre los meses de esos tres que tienen algún gasto anotado, para que un
 * histórico de uno o dos meses no dé cifras a un tercio. Sin histórico no
 * hay propuesta.
 */
export function propuestaDePresupuesto(
  movimientos: MovimientoParaResumen[],
  categorias: CategoriaParaResumen[],
  mes: string,
): Map<string, number> {
  const sumas = new Map<string, number>();
  let mesesConDatos = 0;
  for (const anterior of [moverMes(mes, -1), moverMes(mes, -2), moverMes(mes, -3)]) {
    const delMes = sumarGastoPorClave(movimientos, categorias, (f) => f.slice(0, 7) === anterior);
    if (delMes.size === 0) continue;
    mesesConDatos++;
    for (const [clave, importe] of delMes) {
      if (clave === SIN_CATEGORIA) continue;
      sumas.set(clave, (sumas.get(clave) ?? 0) + importe);
    }
  }
  const propuesta = new Map<string, number>();
  if (mesesConDatos === 0) return propuesta;
  for (const [clave, suma] of sumas) propuesta.set(clave, Math.round(suma / mesesConDatos));
  return propuesta;
}

export type Disponible = {
  /** Presupuesto total menos gastado menos fijos pendientes. Puede ser negativo. */
  disponible: number;
  /** Lo que se ha pasado, en positivo. Cero si no se ha pasado. */
  exceso: number;
  /** Días que quedan del mes contando hoy. Cero en un mes pasado. */
  diasQueQuedan: number;
  /** Disponible entre los días que quedan, redondeado hacia abajo. Cero si se ha pasado. */
  porDia: number;
  /** Tanto por ciento del presupuesto ya comprometido (gastado más fijos pendientes), de 0 a 100. */
  avance: number;
};

/** Días que quedan de un mes contando hoy: todos si es futuro, ninguno si ya pasó. */
export function diasQueQuedan(mes: string, hoy: string): number {
  const mesDeHoy = hoy.slice(0, 7);
  if (mes < mesDeHoy) return 0;
  if (mes > mesDeHoy) return diasDelMes(mes);
  return diasDelMes(mes) - Number(hoy.slice(8, 10)) + 1;
}

/**
 * Disponible del mes (D1). Un fijo ya confirmado está dentro de `gastado` y
 * no debe venir además en `fijosPendientes`: así no se resta dos veces.
 */
export function disponibleDelMes(
  presupuestado: number,
  gastado: number,
  fijosPendientes: number,
  mes: string,
  hoy: string,
): Disponible {
  const disponible = presupuestado - gastado - fijosPendientes;
  const dias = diasQueQuedan(mes, hoy);
  const comprometido = gastado + fijosPendientes;
  return {
    disponible,
    exceso: disponible < 0 ? -disponible : 0,
    diasQueQuedan: dias,
    porDia: disponible > 0 && dias > 0 ? Math.floor(disponible / dias) : 0,
    avance:
      presupuestado > 0
        ? Math.min(100, Math.round((comprometido * 100) / presupuestado))
        : comprometido > 0
          ? 100
          : 0,
  };
}
