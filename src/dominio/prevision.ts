/**
 * Previsión del saldo a fin de mes (T-069, dashboard D4): con cuánto dinero
 * disponible (banco y efectivo) se llegará si se cobran los recurrentes que
 * faltan y se sigue gastando al ritmo de lo que va de mes. Es una
 * estimación y así se rotula en pantalla.
 */
import { saldoEnFecha, type MovimientoDeCuenta } from './inversion';
import type { Cuenta, Movimiento } from './modelo';
import { finDeMes } from './patrimonio';
import type { Ocurrencia, ReglaRecurrente } from './recurrentes';
import { diasDelMes } from './tiempo';

type CuentaDePrevision = Pick<Cuenta, 'id' | 'tipo' | 'saldoInicial' | 'fechaSaldoInicial'>;
type ReglaDePrevision = Pick<
  ReglaRecurrente,
  'tipoMovimiento' | 'importe' | 'cuentaId' | 'cuentaDestinoId'
>;
type MovimientoDePrevision = MovimientoDeCuenta & Pick<Movimiento, 'reglaRecurrenteId'>;

/** Saldo conjunto de las cuentas de banco y efectivo al terminar un día. */
export function saldoDisponibleEn(
  cuentas: CuentaDePrevision[],
  movimientos: MovimientoDeCuenta[],
  fecha: string,
): number {
  let total = 0;
  for (const cuenta of cuentas) {
    if (cuenta.tipo === 'inversion') continue;
    total += saldoEnFecha(cuenta, movimientos, fecha) ?? 0;
  }
  return total;
}

export type Prevision = {
  saldoActual: number;
  /** Gastos recurrentes que faltan por cobrarse este mes. */
  gastosPendientes: number;
  /** Ingresos recurrentes que faltan por llegar este mes. */
  ingresosPendientes: number;
  /** Lo que saldrá de banco y efectivo en transferencias pendientes (neto). */
  aportacionesPendientes: number;
  /** Gasto del mes sin regla entre los días transcurridos contando hoy. */
  gastoVariableDiario: number;
  /** Días del mes que quedan sin contar hoy. */
  diasQueQuedan: number;
  /** Gasto variable previsto para esos días. */
  gastoVariablePrevisto: number;
  previsto: number;
};

/**
 * @param pendientes ocurrencias pendientes del mes de hoy (por confirmar y próximas).
 */
export function previsionDeFinDeMes(
  cuentas: CuentaDePrevision[],
  movimientos: MovimientoDePrevision[],
  pendientes: Pick<Ocurrencia<ReglaDePrevision>, 'regla' | 'estado'>[],
  hoy: string,
): Prevision {
  const mes = hoy.slice(0, 7);
  const dia = Number(hoy.slice(8, 10));
  const liquidas = new Set(cuentas.filter((c) => c.tipo !== 'inversion').map((c) => c.id));

  let gastosPendientes = 0;
  let ingresosPendientes = 0;
  let aportacionesPendientes = 0;
  for (const { regla, estado } of pendientes) {
    if (estado === 'confirmada') continue;
    if (regla.tipoMovimiento === 'gasto') {
      if (liquidas.has(regla.cuentaId)) gastosPendientes += regla.importe;
    } else if (regla.tipoMovimiento === 'ingreso') {
      if (liquidas.has(regla.cuentaId)) ingresosPendientes += regla.importe;
    } else {
      // Entre dos cuentas de banco o efectivo el total no cambia: sale y entra.
      if (liquidas.has(regla.cuentaId)) aportacionesPendientes += regla.importe;
      if (regla.cuentaDestinoId && liquidas.has(regla.cuentaDestinoId)) {
        aportacionesPendientes -= regla.importe;
      }
    }
  }

  let gastoVariable = 0;
  for (const mov of movimientos) {
    if (mov.borradoEn !== null || mov.tipo !== 'gasto' || mov.reglaRecurrenteId !== null) continue;
    if (mov.fecha.slice(0, 7) === mes && mov.fecha <= hoy) gastoVariable += mov.importe;
  }
  const diasQueQuedan = diasDelMes(mes) - dia;
  // Se multiplica antes de dividir para no arrastrar el redondeo del gasto diario.
  const gastoVariablePrevisto = Math.round((gastoVariable * diasQueQuedan) / dia);
  const saldoActual = saldoDisponibleEn(cuentas, movimientos, hoy);

  return {
    saldoActual,
    gastosPendientes,
    ingresosPendientes,
    aportacionesPendientes,
    gastoVariableDiario: Math.round(gastoVariable / dia),
    diasQueQuedan,
    gastoVariablePrevisto,
    previsto:
      saldoActual -
      gastosPendientes +
      ingresosPendientes -
      aportacionesPendientes -
      gastoVariablePrevisto,
  };
}

export type PuntoDePrevision = { fecha: string; saldo: number };

/**
 * Puntos para dibujar la previsión: el saldo real de cada día del mes hasta
 * hoy y, a partir de hoy, una recta hasta el saldo previsto del último día.
 */
export function lineaDePrevision(
  cuentas: CuentaDePrevision[],
  movimientos: MovimientoDeCuenta[],
  previsto: number,
  hoy: string,
): { real: PuntoDePrevision[]; estimado: PuntoDePrevision[] } {
  const mes = hoy.slice(0, 7);
  const dia = Number(hoy.slice(8, 10));
  const real: PuntoDePrevision[] = [];
  for (let d = 1; d <= dia; d++) {
    const fecha = `${mes}-${String(d).padStart(2, '0')}`;
    real.push({ fecha, saldo: saldoDisponibleEn(cuentas, movimientos, fecha) });
  }
  const ultimo = real[real.length - 1];
  const fin = finDeMes(mes);
  const estimado = fin === hoy ? [ultimo] : [ultimo, { fecha: fin, saldo: previsto }];
  return { real, estimado };
}
