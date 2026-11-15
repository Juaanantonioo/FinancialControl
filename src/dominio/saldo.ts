/**
 * Reglas de cálculo (docs/05, apartado 4.4).
 *
 * Los saldos y totales se CALCULAN a partir de los movimientos; no se guardan
 * en ninguna tabla. Así nunca pueden quedar desfasados.
 */
import type { Cuenta, Movimiento } from './modelo';

type CuentaParaSaldo = Pick<Cuenta, 'id' | 'saldoInicial' | 'fechaSaldoInicial'>;
type MovimientoParaSaldo = Pick<
  Movimiento,
  'tipo' | 'fecha' | 'importe' | 'cuentaId' | 'cuentaDestinoId' | 'borradoEn'
>;

/**
 * Efecto en céntimos de un movimiento sobre una cuenta: positivo si entra
 * dinero, negativo si sale, 0 si no le afecta.
 */
export function efectoEnCuenta(mov: MovimientoParaSaldo, cuentaId: string): number {
  if (mov.borradoEn !== null) return 0;
  switch (mov.tipo) {
    case 'ingreso':
      return mov.cuentaId === cuentaId ? mov.importe : 0;
    case 'gasto':
      return mov.cuentaId === cuentaId ? -mov.importe : 0;
    case 'ajuste':
      // El ajuste ya lleva su signo.
      return mov.cuentaId === cuentaId ? mov.importe : 0;
    case 'transferencia': {
      let efecto = 0;
      if (mov.cuentaId === cuentaId) efecto -= mov.importe;
      if (mov.cuentaDestinoId === cuentaId) efecto += mov.importe;
      return efecto;
    }
  }
}

/**
 * Saldo de una cuenta: saldo inicial más los movimientos con fecha igual o
 * posterior a la del saldo inicial. Los movimientos borrados no cuentan.
 *
 * Las fechas "AAAA-MM-DD" se comparan como texto: el orden alfabético de ese
 * formato coincide con el cronológico.
 */
export function calcularSaldo(cuenta: CuentaParaSaldo, movimientos: MovimientoParaSaldo[]): number {
  let saldo = cuenta.saldoInicial;
  for (const mov of movimientos) {
    if (mov.fecha < cuenta.fechaSaldoInicial) continue;
    saldo += efectoEnCuenta(mov, cuenta.id);
  }
  return saldo;
}

/**
 * Gasto de un mes: suma de los movimientos de tipo `gasto` de ese mes. Las
 * transferencias, los ingresos y los ajustes no cuentan.
 *
 * @param mes "AAAA-MM"
 */
export function gastoDelMes(
  movimientos: Pick<Movimiento, 'tipo' | 'fecha' | 'importe' | 'borradoEn'>[],
  mes: string,
): number {
  let total = 0;
  for (const mov of movimientos) {
    if (mov.borradoEn !== null || mov.tipo !== 'gasto') continue;
    if (mov.fecha.slice(0, 7) === mes) total += mov.importe;
  }
  return total;
}
