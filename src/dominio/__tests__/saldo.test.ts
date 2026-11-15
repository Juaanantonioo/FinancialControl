import type { Movimiento } from '@/dominio/modelo';
import { calcularSaldo, efectoEnCuenta, gastoDelMes } from '@/dominio/saldo';

type Mov = Pick<
  Movimiento,
  'tipo' | 'fecha' | 'importe' | 'cuentaId' | 'cuentaDestinoId' | 'borradoEn'
>;

function mov(parcial: Partial<Mov> & Pick<Mov, 'tipo' | 'importe'>): Mov {
  return { fecha: '2026-11-10', cuentaId: 'A', cuentaDestinoId: null, borradoEn: null, ...parcial };
}

const cuentaA = { id: 'A', saldoInicial: 100000, fechaSaldoInicial: '2026-11-01' };
const cuentaB = { id: 'B', saldoInicial: 0, fechaSaldoInicial: '2026-11-01' };

describe('cálculo de saldo', () => {
  it('sin movimientos es el saldo inicial', () => {
    expect(calcularSaldo(cuentaA, [])).toBe(100000);
  });

  it('combina ingresos, gastos, transferencias y ajustes', () => {
    const movimientos = [
      mov({ tipo: 'ingreso', importe: 150000 }),
      mov({ tipo: 'gasto', importe: 2340 }),
      mov({ tipo: 'gasto', importe: 10 }),
      mov({ tipo: 'gasto', importe: 20 }),
      mov({ tipo: 'transferencia', importe: 5000, cuentaId: 'A', cuentaDestinoId: 'B' }),
      mov({ tipo: 'transferencia', importe: 1200, cuentaId: 'B', cuentaDestinoId: 'A' }),
      mov({ tipo: 'ajuste', importe: -330 }),
      mov({ tipo: 'ajuste', importe: 100 }),
    ];
    // 100000 + 150000 − 2340 − 10 − 20 − 5000 + 1200 − 330 + 100
    expect(calcularSaldo(cuentaA, movimientos)).toBe(243600);
    // B: 0 + 5000 − 1200
    expect(calcularSaldo(cuentaB, movimientos)).toBe(3800);
  });

  it('una transferencia no crea ni destruye dinero', () => {
    const movimientos = [
      mov({ tipo: 'transferencia', importe: 5000, cuentaId: 'A', cuentaDestinoId: 'B' }),
    ];
    const antes = cuentaA.saldoInicial + cuentaB.saldoInicial;
    const despues = calcularSaldo(cuentaA, movimientos) + calcularSaldo(cuentaB, movimientos);
    expect(despues).toBe(antes);
  });

  it('ignora los movimientos anteriores a la fecha del saldo inicial', () => {
    const movimientos = [
      mov({ tipo: 'gasto', importe: 9999, fecha: '2026-10-31' }),
      mov({ tipo: 'gasto', importe: 100, fecha: '2026-11-01' }),
    ];
    expect(calcularSaldo(cuentaA, movimientos)).toBe(99900);
  });

  it('ignora los movimientos borrados y los de otras cuentas', () => {
    const movimientos = [
      mov({ tipo: 'gasto', importe: 500, borradoEn: '2026-11-11T00:00:00.000Z' }),
      mov({ tipo: 'gasto', importe: 700, cuentaId: 'C' }),
    ];
    expect(calcularSaldo(cuentaA, movimientos)).toBe(100000);
  });

  it('admite saldos negativos', () => {
    expect(calcularSaldo(cuentaB, [mov({ tipo: 'gasto', importe: 250, cuentaId: 'B' })])).toBe(
      -250,
    );
  });

  it('una transferencia a la misma cuenta, si llegara a existir, no altera el saldo', () => {
    const rara = mov({ tipo: 'transferencia', importe: 500, cuentaId: 'A', cuentaDestinoId: 'A' });
    expect(efectoEnCuenta(rara, 'A')).toBe(0);
  });
});

describe('gasto del mes', () => {
  it('suma solo los gastos del mes: ni transferencias, ni ingresos, ni ajustes', () => {
    const movimientos = [
      mov({ tipo: 'gasto', importe: 2340, fecha: '2026-11-03' }),
      mov({ tipo: 'gasto', importe: 1000, fecha: '2026-11-30' }),
      mov({ tipo: 'gasto', importe: 9999, fecha: '2026-10-31' }),
      mov({ tipo: 'gasto', importe: 9999, fecha: '2026-12-01' }),
      mov({ tipo: 'ingreso', importe: 150000 }),
      mov({ tipo: 'transferencia', importe: 5000, cuentaDestinoId: 'B' }),
      mov({ tipo: 'ajuste', importe: -330 }),
      mov({ tipo: 'gasto', importe: 777, borradoEn: '2026-11-11T00:00:00.000Z' }),
    ];
    expect(gastoDelMes(movimientos, '2026-11')).toBe(3340);
    expect(gastoDelMes(movimientos, '2025-11')).toBe(0);
  });
});
