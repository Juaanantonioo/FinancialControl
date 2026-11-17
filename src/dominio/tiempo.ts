/**
 * Vistas por día, por mes comparado y por año de la pestaña Análisis
 * (T-082 y dashboards D6 y D7). Funciones puras sobre los movimientos.
 */
import {
  balanceDelMes,
  moverMes,
  repartirGasto,
  sumarGastoPorClave,
  tasaDeAhorro,
  type CategoriaParaResumen,
  type GastoPorCategoria,
  type MovimientoParaResumen,
} from './resumen';

// -------------------------------------------------------------------- día

/** Número de días de un mes "AAAA-MM": 28, 29, 30 o 31. */
export function diasDelMes(mes: string): number {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, numero, 0)).getUTCDate();
}

export type DiaDelMes = {
  fecha: string;
  dia: number;
  gasto: number;
  ingreso: number;
  /** Gastos e ingresos de ese día. */
  movimientos: number;
};

/** Gasto e ingreso de cada día del mes. Transferencias y ajustes no cuentan. */
export function gastoPorDia(movimientos: MovimientoParaResumen[], mes: string): DiaDelMes[] {
  const dias: DiaDelMes[] = [];
  const total = diasDelMes(mes);
  for (let dia = 1; dia <= total; dia++) {
    dias.push({
      fecha: `${mes}-${String(dia).padStart(2, '0')}`,
      dia,
      gasto: 0,
      ingreso: 0,
      movimientos: 0,
    });
  }
  for (const mov of movimientos) {
    if (mov.borradoEn !== null || mov.fecha.slice(0, 7) !== mes) continue;
    if (mov.tipo !== 'gasto' && mov.tipo !== 'ingreso') continue;
    const casilla = dias[Number(mov.fecha.slice(8, 10)) - 1];
    if (!casilla) continue;
    if (mov.tipo === 'gasto') casilla.gasto += mov.importe;
    else casilla.ingreso += mov.importe;
    casilla.movimientos++;
  }
  return dias;
}

export type ResumenDiario = {
  dias: DiaDelMes[];
  gastoDelMes: number;
  /** Gasto de hoy, sea cual sea el mes que se consulta. */
  gastoDeHoy: number;
  /**
   * Gasto del mes entre los días transcurridos (mes en curso) o entre todos
   * sus días (mes pasado). `null` en un mes futuro.
   */
  mediaDiaria: number | null;
  /** Días entre los que se ha repartido la media. */
  diasContados: number;
  /** Día de mayor gasto, o `null` si el mes no tiene gastos. */
  diaDeMayorGasto: DiaDelMes | null;
};

export function resumenDiario(
  movimientos: MovimientoParaResumen[],
  mes: string,
  hoy: string,
): ResumenDiario {
  const dias = gastoPorDia(movimientos, mes);
  const gastoDelMes = dias.reduce((suma, d) => suma + d.gasto, 0);
  const mesDeHoy = hoy.slice(0, 7);
  let gastoDeHoy = 0;
  for (const mov of movimientos) {
    if (mov.borradoEn === null && mov.tipo === 'gasto' && mov.fecha === hoy) {
      gastoDeHoy += mov.importe;
    }
  }
  // El día 1 ya cuenta como un día transcurrido: nunca se divide entre cero.
  let diasContados = 0;
  if (mes === mesDeHoy) diasContados = Number(hoy.slice(8, 10));
  else if (mes < mesDeHoy) diasContados = dias.length;
  let mayor: DiaDelMes | null = null;
  for (const d of dias) {
    if (d.gasto > 0 && (!mayor || d.gasto > mayor.gasto)) mayor = d;
  }
  return {
    dias,
    gastoDelMes,
    gastoDeHoy,
    mediaDiaria: diasContados > 0 ? Math.round(gastoDelMes / diasContados) : null,
    diasContados,
    diaDeMayorGasto: mayor,
  };
}

/**
 * Semanas del mes para pintar un calendario que empieza en lunes. Cada
 * semana tiene siete casillas: el número del día o `null` si la casilla
 * queda fuera del mes.
 */
export function semanasDelMes(mes: string): (number | null)[][] {
  const [anio, numero] = mes.split('-').map(Number);
  // getUTCDay: 0 domingo … 6 sábado. Se pasa a 0 lunes … 6 domingo.
  const primero = (new Date(Date.UTC(anio, numero - 1, 1)).getUTCDay() + 6) % 7;
  const total = diasDelMes(mes);
  const casillas: (number | null)[] = [];
  for (let i = 0; i < primero; i++) casillas.push(null);
  for (let dia = 1; dia <= total; dia++) casillas.push(dia);
  while (casillas.length % 7 !== 0) casillas.push(null);
  const semanas: (number | null)[][] = [];
  for (let i = 0; i < casillas.length; i += 7) semanas.push(casillas.slice(i, i + 7));
  return semanas;
}

/** Intensidad de 0 a 4 de un gasto frente al mayor del mes. 0 solo si no hay gasto. */
export function intensidad(gasto: number, mayor: number): 0 | 1 | 2 | 3 | 4 {
  if (gasto <= 0 || mayor <= 0) return 0;
  const nivel = Math.ceil((gasto / mayor) * 4);
  return Math.min(4, Math.max(1, nivel)) as 1 | 2 | 3 | 4;
}

// ------------------------------------------------- comparativa de dos meses

export type LineaDeComparativa = {
  /** Id de la categoría principal o `SIN_CATEGORIA`. */
  clave: string;
  actual: number;
  anterior: number;
  diferencia: number;
  /** Tanto por ciento entero frente al mes anterior. `null` si el anterior fue cero. */
  porcentaje: number | null;
  /** `true` si el mes anterior no hubo gasto en esta categoría. */
  nuevo: boolean;
};

export type Comparativa = {
  mesAnterior: string;
  lineas: LineaDeComparativa[];
  total: LineaDeComparativa;
};

function linea(clave: string, actual: number, anterior: number): LineaDeComparativa {
  return {
    clave,
    actual,
    anterior,
    diferencia: actual - anterior,
    porcentaje: anterior > 0 ? Math.round(((actual - anterior) * 100) / anterior) : null,
    nuevo: anterior === 0 && actual > 0,
  };
}

/** Gasto de cada categoría principal en un mes frente al mes anterior. */
export function comparativaConMesAnterior(
  movimientos: MovimientoParaResumen[],
  categorias: CategoriaParaResumen[],
  mes: string,
): Comparativa {
  const mesAnterior = moverMes(mes, -1);
  const actual = sumarGastoPorClave(movimientos, categorias, (f) => f.slice(0, 7) === mes);
  const anterior = sumarGastoPorClave(
    movimientos,
    categorias,
    (f) => f.slice(0, 7) === mesAnterior,
  );
  const claves = [...new Set([...actual.keys(), ...anterior.keys()])];
  const lineas = claves
    .map((clave) => linea(clave, actual.get(clave) ?? 0, anterior.get(clave) ?? 0))
    .sort((a, b) => b.actual - a.actual || b.anterior - a.anterior || (a.clave < b.clave ? -1 : 1));
  const suma = (mapa: Map<string, number>) => [...mapa.values()].reduce((a, b) => a + b, 0);
  return { mesAnterior, lineas, total: linea('total', suma(actual), suma(anterior)) };
}

// -------------------------------------------------------------------- año

export type MesDelAnio = {
  mes: string;
  ingresos: number;
  gastos: number;
  balance: number;
  /** Gastos e ingresos del mes. Con 0 el mes no tiene datos. */
  movimientos: number;
};

export type ResumenDelAnio = {
  anio: number;
  ingresos: number;
  gastos: number;
  balance: number;
  tasaDeAhorro: number | null;
  meses: MesDelAnio[];
  /** Meses con algún gasto o ingreso. */
  mesesConDatos: number;
  mesDeMayorGasto: MesDelAnio | null;
  mesDeMenorGasto: MesDelAnio | null;
  /** Gasto del año entre los meses con datos. `null` si no hay ninguno. */
  mediaMensual: number | null;
  gastoPorCategoria: GastoPorCategoria;
};

/** Resumen de un año natural, de enero a diciembre. */
export function resumenDelAnio(
  movimientos: MovimientoParaResumen[],
  categorias: CategoriaParaResumen[],
  anio: number,
): ResumenDelAnio {
  const prefijo = String(anio).padStart(4, '0');
  const meses: MesDelAnio[] = [];
  for (let numero = 1; numero <= 12; numero++) {
    const mes = `${prefijo}-${String(numero).padStart(2, '0')}`;
    const b = balanceDelMes(movimientos, mes);
    meses.push({
      mes,
      ingresos: b.ingresos,
      gastos: b.gastos,
      balance: b.balance,
      movimientos: b.movimientos,
    });
  }
  const ingresos = meses.reduce((s, m) => s + m.ingresos, 0);
  const gastos = meses.reduce((s, m) => s + m.gastos, 0);
  const conDatos = meses.filter((m) => m.movimientos > 0);
  let mayor: MesDelAnio | null = null;
  let menor: MesDelAnio | null = null;
  for (const m of conDatos) {
    if (!mayor || m.gastos > mayor.gastos) mayor = m;
    if (!menor || m.gastos < menor.gastos) menor = m;
  }
  return {
    anio,
    ingresos,
    gastos,
    balance: ingresos - gastos,
    tasaDeAhorro: tasaDeAhorro(ingresos, gastos),
    meses,
    mesesConDatos: conDatos.length,
    mesDeMayorGasto: mayor,
    // Con un solo mes con datos, mayor y menor serían el mismo: no se repite.
    mesDeMenorGasto: conDatos.length > 1 ? menor : null,
    mediaMensual: conDatos.length > 0 ? Math.round(gastos / conDatos.length) : null,
    gastoPorCategoria: repartirGasto(
      sumarGastoPorClave(movimientos, categorias, (f) => f.slice(0, 4) === prefijo),
    ),
  };
}
