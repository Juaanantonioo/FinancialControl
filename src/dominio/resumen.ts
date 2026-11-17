/**
 * Resúmenes del mes para Inicio y para el detalle de cuenta.
 *
 * Son funciones puras: reciben los movimientos y devuelven cifras en céntimos
 * enteros. Las pantallas no suman importes, solo pintan lo que sale de aquí.
 * Ninguna cifra se guarda: todo se calcula a partir de los movimientos
 * (docs/05, apartado 4.4).
 *
 * Un mes es un mes de calendario local, escrito "AAAA-MM". Las fechas de los
 * movimientos ya son días locales "AAAA-MM-DD", así que pertenecer a un mes
 * es comparar los siete primeros caracteres: no interviene la zona horaria.
 */
import type { Categoria, Cuenta, Movimiento } from './modelo';
import { calcularSaldo, efectoEnCuenta } from './saldo';

export type MovimientoParaResumen = Pick<
  Movimiento,
  | 'tipo'
  | 'fecha'
  | 'importe'
  | 'divisa'
  | 'cuentaId'
  | 'cuentaDestinoId'
  | 'categoriaId'
  | 'borradoEn'
>;
export type CuentaParaResumen = Pick<
  Cuenta,
  'id' | 'nombre' | 'tipo' | 'divisa' | 'saldoInicial' | 'fechaSaldoInicial' | 'archivada'
>;
export type CategoriaParaResumen = Pick<Categoria, 'id' | 'padreId'>;

// ---------------------------------------------------------------- meses

/** `true` si el texto es un mes "AAAA-MM" real. */
export function esMesValido(mes: string): boolean {
  const partes = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!partes) return false;
  const numero = Number(partes[2]);
  return numero >= 1 && numero <= 12;
}

/** Mes de calendario local de una fecha, como "AAAA-MM". */
export function mesDe(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Suma o resta meses a un mes "AAAA-MM". De enero hacia atrás pasa a diciembre del año anterior. */
export function moverMes(mes: string, salto: number): string {
  const [anio, numero] = mes.split('-').map(Number);
  // Meses contados desde el año 0: así el cambio de año sale de una división.
  const total = anio * 12 + (numero - 1) + salto;
  const anioNuevo = Math.floor(total / 12);
  const mesNuevo = total - anioNuevo * 12 + 1;
  return `${String(anioNuevo).padStart(4, '0')}-${String(mesNuevo).padStart(2, '0')}`;
}

/** Los `cuantos` meses que terminan en `mes`, del más antiguo al más reciente. */
export function ultimosMeses(mes: string, cuantos: number): string[] {
  const meses: string[] = [];
  for (let i = cuantos - 1; i >= 0; i--) meses.push(moverMes(mes, -i));
  return meses;
}

function esDelMes(mov: Pick<Movimiento, 'fecha' | 'borradoEn'>, mes: string): boolean {
  return mov.borradoEn === null && mov.fecha.slice(0, 7) === mes;
}

/** Divisas presentes en las cuentas, sin repetir y en el orden en que aparecen. */
export function divisasDe(cuentas: Pick<Cuenta, 'divisa'>[]): string[] {
  return [...new Set(cuentas.map((c) => c.divisa))];
}

// ------------------------------------------------- balance global del mes

export type BalanceDelMes = {
  ingresos: number;
  gastos: number;
  /** Ingresos menos gastos. Negativo si se ha gastado más de lo ingresado. */
  balance: number;
  /** Suma con signo de los ajustes del mes. No forma parte del balance. */
  ajustes: number;
  /** Porcentaje entero, o `null` si no hay ingresos (no se divide entre cero). */
  tasaDeAhorro: number | null;
  /** Número de gastos e ingresos del mes. Con 0 se muestra el estado vacío. */
  movimientos: number;
};

/**
 * Parte de los ingresos que no se ha gastado, en tanto por ciento redondeado.
 * Con 2 000 € de ingresos y 1 600 € de gastos devuelve 20.
 */
export function tasaDeAhorro(ingresos: number, gastos: number): number | null {
  if (ingresos <= 0) return null;
  return Math.round(((ingresos - gastos) * 100) / ingresos);
}

/**
 * Ingresos, gastos y balance de un mes. Las transferencias y los ajustes no
 * cuentan como ingreso ni como gasto. Los movimientos borrados no cuentan.
 *
 * No mezcla divisas: quien llama pasa los movimientos de una sola divisa
 * (ver `deDivisa`).
 */
export function balanceDelMes(movimientos: MovimientoParaResumen[], mes: string): BalanceDelMes {
  let ingresos = 0;
  let gastos = 0;
  let ajustes = 0;
  let cuenta = 0;
  for (const mov of movimientos) {
    if (!esDelMes(mov, mes)) continue;
    if (mov.tipo === 'ingreso') {
      ingresos += mov.importe;
      cuenta++;
    } else if (mov.tipo === 'gasto') {
      gastos += mov.importe;
      cuenta++;
    } else if (mov.tipo === 'ajuste') {
      ajustes += mov.importe;
    }
  }
  return {
    ingresos,
    gastos,
    balance: ingresos - gastos,
    ajustes,
    tasaDeAhorro: tasaDeAhorro(ingresos, gastos),
    movimientos: cuenta,
  };
}

/** Deja solo los movimientos de una divisa. */
export function deDivisa<T extends Pick<Movimiento, 'divisa'>>(
  movimientos: T[],
  divisa: string,
): T[] {
  return movimientos.filter((m) => m.divisa === divisa);
}

// ------------------------------------------------------ balance por cuenta

export type ResumenDeCuenta = {
  cuentaId: string;
  /** Saldo actual de la cuenta (no el del mes consultado). */
  saldo: number;
  /** Dinero que ha entrado en la cuenta en el mes. Siempre 0 o positivo. */
  entradas: number;
  /** Dinero que ha salido de la cuenta en el mes. Siempre 0 o positivo. */
  salidas: number;
  /** Entradas menos salidas. Incluye transferencias y ajustes. */
  variacion: number;
  /** Movimientos del mes que afectan a la cuenta. */
  movimientos: number;
};

/**
 * Resumen de una cuenta en un mes. Aplica la misma regla de fecha que
 * `calcularSaldo`: un movimiento anterior a la fecha del saldo inicial no
 * cuenta, porque ese saldo ya lo incluye.
 */
export function resumenDeCuenta(
  cuenta: Pick<Cuenta, 'id' | 'saldoInicial' | 'fechaSaldoInicial'>,
  movimientos: MovimientoParaResumen[],
  mes: string,
): ResumenDeCuenta {
  let entradas = 0;
  let salidas = 0;
  let cuantos = 0;
  for (const mov of movimientos) {
    if (!esDelMes(mov, mes) || mov.fecha < cuenta.fechaSaldoInicial) continue;
    if (mov.cuentaId !== cuenta.id && mov.cuentaDestinoId !== cuenta.id) continue;
    cuantos++;
    const efecto = efectoEnCuenta(mov, cuenta.id);
    if (efecto > 0) entradas += efecto;
    else salidas -= efecto;
  }
  return {
    cuentaId: cuenta.id,
    saldo: calcularSaldo(cuenta, movimientos),
    entradas,
    salidas,
    variacion: entradas - salidas,
    movimientos: cuantos,
  };
}

export type CuentaResumida<C> = C & { resumen: ResumenDeCuenta };

/**
 * Cuentas que se listan en Inicio con su resumen del mes: todas las activas
 * y, de las archivadas, solo las que tienen movimientos en ese mes.
 */
export function cuentasDelMes<C extends CuentaParaResumen>(
  cuentas: C[],
  movimientos: MovimientoParaResumen[],
  mes: string,
): CuentaResumida<C>[] {
  return cuentas
    .map((cuenta) => ({ ...cuenta, resumen: resumenDeCuenta(cuenta, movimientos, mes) }))
    .filter((cuenta) => !cuenta.archivada || cuenta.resumen.movimientos > 0);
}

// ----------------------------------------------------- gasto por categoría

/** Identificador de la parte que agrupa lo que no cabe en la lista. */
export const OTRAS = '__otras__';
/** Identificador de la parte de los gastos sin categoría. */
export const SIN_CATEGORIA = '__sin_categoria__';

export type ParteDelGasto = {
  /** Id de la categoría principal, `SIN_CATEGORIA` u `OTRAS`. */
  clave: string;
  importe: number;
  /** Porcentaje entero. Los porcentajes de todas las partes suman 100. */
  porcentaje: number;
};

export type GastoPorCategoria = { total: number; partes: ParteDelGasto[] };

/**
 * Devuelve la función que lleva de una categoría a su categoría principal,
 * subiendo por la cadena de padres.
 */
export function buscadorDePrincipal(categorias: CategoriaParaResumen[]): (id: string) => string {
  const padres = new Map(categorias.map((c) => [c.id, c.padreId]));
  return (id: string): string => {
    let actual = id;
    // El límite evita un bucle si los datos tuvieran un ciclo de padres.
    for (let i = 0; i < 10; i++) {
      const padre = padres.get(actual);
      if (!padre) break;
      actual = padre;
    }
    return actual;
  };
}

/** Una categoría y todas las que cuelgan de ella, a cualquier nivel. */
export function conSubcategorias(categorias: CategoriaParaResumen[], id: string): string[] {
  const hijas = categorias.filter((c) => c.id !== id && esDescendiente(categorias, c.id, id));
  return [id, ...hijas.map((c) => c.id)];
}

function esDescendiente(categorias: CategoriaParaResumen[], id: string, ancestro: string): boolean {
  const padres = new Map(categorias.map((c) => [c.id, c.padreId]));
  let actual: string | null | undefined = padres.get(id);
  for (let i = 0; i < 10 && actual; i++) {
    if (actual === ancestro) return true;
    actual = padres.get(actual);
  }
  return false;
}

/**
 * Gasto por categoría principal de los movimientos cuya fecha cumple
 * `enPeriodo`. Una subcategoría suma en su categoría principal y los gastos
 * sin categoría van a `SIN_CATEGORIA`.
 */
export function sumarGastoPorClave(
  movimientos: MovimientoParaResumen[],
  categorias: CategoriaParaResumen[],
  enPeriodo: (fecha: string) => boolean,
): Map<string, number> {
  const principal = buscadorDePrincipal(categorias);
  const sumas = new Map<string, number>();
  for (const mov of movimientos) {
    if (mov.borradoEn !== null || mov.tipo !== 'gasto' || !enPeriodo(mov.fecha)) continue;
    const clave = mov.categoriaId ? principal(mov.categoriaId) : SIN_CATEGORIA;
    sumas.set(clave, (sumas.get(clave) ?? 0) + mov.importe);
  }
  return sumas;
}

/** Ordena las sumas de mayor a menor, deja `maximo` y agrupa el resto en «Otras». */
export function repartirGasto(sumas: Map<string, number>, maximo = 5): GastoPorCategoria {
  let total = 0;
  for (const importe of sumas.values()) total += importe;
  if (total === 0) return { total: 0, partes: [] };

  // A igual importe decide la clave, para que el orden no cambie entre pintados.
  const ordenadas = [...sumas]
    .map(([clave, importe]) => ({ clave, importe }))
    .sort((a, b) => b.importe - a.importe || (a.clave < b.clave ? -1 : 1));
  const visibles = ordenadas.slice(0, maximo);
  const resto = ordenadas.slice(maximo).reduce((suma, p) => suma + p.importe, 0);
  if (resto > 0) visibles.push({ clave: OTRAS, importe: resto });

  const porcentajes = repartirPorcentajes(
    visibles.map((p) => p.importe),
    total,
  );
  return { total, partes: visibles.map((p, i) => ({ ...p, porcentaje: porcentajes[i] })) };
}

/**
 * Reparte el gasto de un mes por categoría principal, de mayor a menor.
 * Una subcategoría suma en su categoría principal. Se muestran como mucho
 * `maximo` categorías y el resto se agrupa en «Otras».
 */
export function gastoPorCategoria(
  movimientos: MovimientoParaResumen[],
  categorias: CategoriaParaResumen[],
  mes: string,
  maximo = 5,
): GastoPorCategoria {
  const sumas = sumarGastoPorClave(movimientos, categorias, (f) => f.slice(0, 7) === mes);
  return repartirGasto(sumas, maximo);
}

/**
 * Porcentajes enteros que suman exactamente 100 (método del resto mayor):
 * se redondea hacia abajo y los puntos que faltan van a las partes con más
 * decimales perdidos.
 */
export function repartirPorcentajes(importes: number[], total: number): number[] {
  if (total <= 0) return importes.map(() => 0);
  const exactos = importes.map((importe) => (importe * 100) / total);
  const enteros = exactos.map(Math.floor);
  let faltan = 100 - enteros.reduce((a, b) => a + b, 0);
  const porResto = exactos
    .map((exacto, i) => ({ i, resto: exacto - enteros[i] }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) {
    if (faltan <= 0) break;
    enteros[i]++;
    faltan--;
  }
  return enteros;
}

// ---------------------------------------------------------------- evolución

export type MesDeEvolucion = { mes: string; ingresos: number; gastos: number };

/** Ingresos y gastos de los `cuantos` meses que terminan en `mes`. */
export function evolucion(
  movimientos: MovimientoParaResumen[],
  mes: string,
  cuantos = 6,
): MesDeEvolucion[] {
  return ultimosMeses(mes, cuantos).map((m) => {
    const { ingresos, gastos } = balanceDelMes(movimientos, m);
    return { mes: m, ingresos, gastos };
  });
}
