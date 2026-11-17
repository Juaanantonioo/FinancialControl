/**
 * Patrimonio: lo que la persona posee (T-076, dashboard D5).
 *
 * Es la suma del saldo de las cuentas de banco y efectivo y del valor
 * estimado de las cuentas de inversión. No se guarda: se calcula. No mezcla
 * divisas: quien llama pasa las cuentas de una sola divisa.
 */
import {
  saldoEnFecha,
  valorEstimado,
  type MovimientoDeCuenta,
  type ValorRegistrado,
} from './inversion';
import type { Cuenta, TipoDeCuenta } from './modelo';
import { moverMes, repartirPorcentajes, ultimosMeses } from './resumen';

export type CuentaDePatrimonio = Pick<
  Cuenta,
  'id' | 'tipo' | 'saldoInicial' | 'fechaSaldoInicial' | 'archivada'
>;

/** Último día de un mes "AAAA-MM", como "AAAA-MM-DD". */
export function finDeMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  // El día 0 del mes siguiente es el último día de este.
  const dias = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return `${mes}-${String(dias).padStart(2, '0')}`;
}

/** Lo que vale una cuenta al terminar el día `fecha`. `null` si aún no existía. */
export function valorDeCuenta(
  cuenta: CuentaDePatrimonio,
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  fecha: string,
): number | null {
  return cuenta.tipo === 'inversion'
    ? valorEstimado(cuenta, movimientos, valores, fecha)
    : saldoEnFecha(cuenta, movimientos, fecha);
}

export type Patrimonio = {
  total: number;
  /** Banco y efectivo. */
  disponible: number;
  /** Cuentas de inversión, a su valor estimado. */
  invertido: number;
  porTipo: Record<TipoDeCuenta, number>;
  /**
   * Cuentas que cuentan, con su valor y su peso en tanto por ciento. El peso
   * es `null` si el total no es positivo o alguna cuenta está en negativo:
   * en ese caso un reparto en porcentajes no tiene sentido.
   */
  cuentas: { cuentaId: string; valor: number; peso: number | null }[];
};

/**
 * Patrimonio al terminar el día `fecha`. Una cuenta archivada cuenta si su
 * valor no es cero. Una cuenta que aún no existía en esa fecha no cuenta.
 */
export function patrimonioEn(
  cuentas: CuentaDePatrimonio[],
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  fecha: string,
): Patrimonio {
  const porTipo: Record<TipoDeCuenta, number> = { banco: 0, efectivo: 0, inversion: 0 };
  const lista: { cuentaId: string; valor: number }[] = [];
  for (const cuenta of cuentas) {
    const valor = valorDeCuenta(cuenta, movimientos, valores, fecha);
    if (valor === null) continue;
    if (cuenta.archivada && valor === 0) continue;
    porTipo[cuenta.tipo] += valor;
    lista.push({ cuentaId: cuenta.id, valor });
  }
  const disponible = porTipo.banco + porTipo.efectivo;
  const total = disponible + porTipo.inversion;
  const repartible = total > 0 && lista.every((c) => c.valor >= 0);
  const pesos = repartible
    ? repartirPorcentajes(
        lista.map((c) => c.valor),
        total,
      )
    : [];
  return {
    total,
    disponible,
    invertido: porTipo.inversion,
    porTipo,
    cuentas: lista.map((c, i) => ({ ...c, peso: repartible ? pesos[i] : null })),
  };
}

/** Fecha más antigua de saldo inicial: antes de ella no hay patrimonio conocido. */
export function inicioDeLaHistoria(cuentas: Pick<Cuenta, 'fechaSaldoInicial'>[]): string | null {
  let inicio: string | null = null;
  for (const c of cuentas) {
    if (inicio === null || c.fechaSaldoInicial < inicio) inicio = c.fechaSaldoInicial;
  }
  return inicio;
}

export type PuntoDePatrimonio = { mes: string; fecha: string; total: number };

/**
 * Patrimonio al último día de cada uno de los `cuantos` meses que terminan
 * en el mes de `hoy`. El mes en curso usa la fecha de hoy. Los meses
 * anteriores a la primera cuenta no aparecen: no se inventa un cero.
 */
export function evolucionDelPatrimonio(
  cuentas: CuentaDePatrimonio[],
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  hoy: string,
  cuantos = 12,
): PuntoDePatrimonio[] {
  const inicio = inicioDeLaHistoria(cuentas);
  if (inicio === null) return [];
  const mesActual = hoy.slice(0, 7);
  const puntos: PuntoDePatrimonio[] = [];
  for (const mes of ultimosMeses(mesActual, cuantos)) {
    const fecha = mes === mesActual ? hoy : finDeMes(mes);
    if (fecha < inicio) continue;
    puntos.push({ mes, fecha, total: patrimonioEn(cuentas, movimientos, valores, fecha).total });
  }
  return puntos;
}

export type Variacion = {
  /** Fecha con la que se compara. */
  desde: string;
  diferencia: number;
  /** Tanto por ciento con un decimal, o `null` si el punto de partida no es positivo. */
  porcentaje: number | null;
};

function variacionEntre(
  cuentas: CuentaDePatrimonio[],
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  desde: string,
  hasta: string,
): Variacion {
  const antes = patrimonioEn(cuentas, movimientos, valores, desde).total;
  const despues = patrimonioEn(cuentas, movimientos, valores, hasta).total;
  const diferencia = despues - antes;
  return {
    desde,
    diferencia,
    porcentaje: antes > 0 ? Math.round((diferencia * 1000) / antes) / 10 : null,
  };
}

/**
 * Lo que ha cambiado el patrimonio desde el cierre del mes anterior hasta
 * hoy. `null` si al cierre del mes anterior aún no había ninguna cuenta.
 */
export function variacionDelMes(
  cuentas: CuentaDePatrimonio[],
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  hoy: string,
): Variacion | null {
  const inicio = inicioDeLaHistoria(cuentas);
  const cierre = finDeMes(moverMes(hoy.slice(0, 7), -1));
  if (inicio === null || cierre < inicio) return null;
  return variacionEntre(cuentas, movimientos, valores, cierre, hoy);
}

/**
 * Lo que ha cambiado el patrimonio en un año natural: del cierre del año
 * anterior (o de la primera fecha con datos, si es posterior) al 31 de
 * diciembre (o a hoy, si el año está en curso). `null` si el año es futuro o
 * anterior a la primera cuenta.
 */
export function variacionDelAnio(
  cuentas: CuentaDePatrimonio[],
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  anio: number,
  hoy: string,
): (Variacion & { hasta: string }) | null {
  const inicio = inicioDeLaHistoria(cuentas);
  if (inicio === null) return null;
  const cierreAnterior = `${String(anio - 1).padStart(4, '0')}-12-31`;
  const finDeAnio = `${String(anio).padStart(4, '0')}-12-31`;
  const desde = cierreAnterior < inicio ? inicio : cierreAnterior;
  const hasta = finDeAnio > hoy ? hoy : finDeAnio;
  if (desde > hasta) return null;
  return { ...variacionEntre(cuentas, movimientos, valores, desde, hasta), hasta };
}
