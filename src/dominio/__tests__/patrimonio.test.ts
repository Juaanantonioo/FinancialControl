import type { MovimientoDeCuenta, ValorRegistrado } from '../inversion';
import {
  evolucionDelPatrimonio,
  finDeMes,
  patrimonioEn,
  variacionDelAnio,
  variacionDelMes,
  type CuentaDePatrimonio,
} from '../patrimonio';
import { calcularSaldo } from '../saldo';

function cuenta(id: string, parcial: Partial<CuentaDePatrimonio> = {}): CuentaDePatrimonio {
  return {
    id,
    tipo: 'banco',
    saldoInicial: 0,
    fechaSaldoInicial: '2026-01-01',
    archivada: false,
    ...parcial,
  };
}
function mov(parcial: Partial<MovimientoDeCuenta> & { importe: number }): MovimientoDeCuenta {
  return {
    tipo: 'gasto',
    fecha: '2026-11-10',
    cuentaId: 'banco',
    cuentaDestinoId: null,
    borradoEn: null,
    ...parcial,
  };
}

const banco = cuenta('banco', { saldoInicial: 500000 });
const cartera = cuenta('cartera', { tipo: 'efectivo', saldoInicial: 6000 });
const broker = cuenta('broker', { tipo: 'inversion', saldoInicial: 0 });
const CUENTAS = [banco, cartera, broker];
const MOVS: MovimientoDeCuenta[] = [
  mov({ tipo: 'ingreso', importe: 200000, fecha: '2026-11-01' }),
  mov({ importe: 160000, fecha: '2026-11-05' }),
  mov({ tipo: 'transferencia', importe: 100000, cuentaDestinoId: 'broker', fecha: '2026-10-02' }),
  mov({ importe: 1500, cuentaId: 'cartera', fecha: '2026-11-12' }),
];
const HOY = '2026-11-17';

describe('fin de mes', () => {
  it('conoce los meses de 28, 29, 30 y 31 días', () => {
    expect(finDeMes('2026-02')).toBe('2026-02-28');
    expect(finDeMes('2028-02')).toBe('2028-02-29');
    expect(finDeMes('2026-04')).toBe('2026-04-30');
    expect(finDeMes('2026-12')).toBe('2026-12-31');
  });
});

describe('patrimonio', () => {
  it('coherencia: sin valores registrados es la suma de saldos, como mostraba Cuentas', () => {
    const p = patrimonioEn(CUENTAS, MOVS, [], HOY);
    const sumaDeSaldos = CUENTAS.map((c) => calcularSaldo(c, MOVS)).reduce((a, b) => a + b, 0);
    expect(p.total).toBe(sumaDeSaldos);
    expect(p.total).toBe(544500);
    expect(p).toMatchObject({ disponible: 444500, invertido: 100000 });
    expect(p.porTipo).toEqual({ banco: 440000, efectivo: 4500, inversion: 100000 });
  });

  it('coherencia: es banco y efectivo más el valor estimado de inversión', () => {
    const valores: ValorRegistrado[] = [
      { cuentaId: 'broker', fecha: '2026-11-15', valor: 112345, borradoEn: null },
    ];
    const p = patrimonioEn(CUENTAS, MOVS, valores, HOY);
    expect(p.invertido).toBe(112345);
    expect(p.total).toBe(calcularSaldo(banco, MOVS) + calcularSaldo(cartera, MOVS) + 112345);
    expect(p.total).toBe(p.disponible + p.invertido);
    expect(p.cuentas.reduce((s, c) => s + c.valor, 0)).toBe(p.total);
    expect(p.cuentas.reduce((s, c) => s + (c.peso ?? 0), 0)).toBe(100);
  });

  it('una cuenta archivada cuenta si tiene saldo y no aparece si está a cero', () => {
    const vieja = cuenta('vieja', { archivada: true, saldoInicial: 25000 });
    const vacia = cuenta('vacia', { archivada: true });
    const fondo = cuenta('fondo', { tipo: 'inversion', archivada: true, saldoInicial: 70000 });
    const p = patrimonioEn([banco, vieja, vacia, fondo], [], [], HOY);
    expect(p.total).toBe(595000);
    expect(p.cuentas.map((c) => c.cuentaId)).toEqual(['banco', 'vieja', 'fondo']);
  });

  it('un descubierto puede dejar el patrimonio en negativo, y entonces no hay pesos', () => {
    const rojo = cuenta('rojo', { saldoInicial: -90000 });
    const p = patrimonioEn([rojo, cartera], [], [], HOY);
    expect(p.total).toBe(-84000);
    expect(p.cuentas.every((c) => c.peso === null)).toBe(true);
    // Con total positivo pero una cuenta en negativo tampoco se reparte.
    const q = patrimonioEn([banco, rojo], [], [], HOY);
    expect(q.total).toBe(410000);
    expect(q.cuentas.every((c) => c.peso === null)).toBe(true);
  });

  it('sin cuentas el patrimonio es cero y no hay evolución ni variación', () => {
    expect(patrimonioEn([], [], [], HOY)).toMatchObject({ total: 0, cuentas: [] });
    expect(evolucionDelPatrimonio([], [], [], HOY)).toEqual([]);
    expect(variacionDelMes([], [], [], HOY)).toBeNull();
    expect(variacionDelAnio([], [], [], 2026, HOY)).toBeNull();
  });

  it('una cuenta que aún no existía en la fecha no cuenta', () => {
    const nueva = cuenta('nueva', { saldoInicial: 300000, fechaSaldoInicial: '2026-11-10' });
    expect(patrimonioEn([banco, nueva], [], [], '2026-11-09').total).toBe(500000);
    expect(patrimonioEn([banco, nueva], [], [], '2026-11-10').total).toBe(800000);
  });
});

describe('evolución del patrimonio', () => {
  it('con dos meses de historia dibuja dos meses: no inventa los anteriores', () => {
    const reciente = [cuenta('banco', { saldoInicial: 100000, fechaSaldoInicial: '2026-10-15' })];
    const puntos = evolucionDelPatrimonio(
      reciente,
      [mov({ importe: 25000, fecha: '2026-11-03' })],
      [],
      HOY,
    );
    expect(puntos).toEqual([
      { mes: '2026-10', fecha: '2026-10-31', total: 100000 },
      { mes: '2026-11', fecha: HOY, total: 75000 },
    ]);
  });

  it('con historia larga da doce meses, cruza el cambio de año y el último es hoy', () => {
    const antigua = [cuenta('banco', { saldoInicial: 100000, fechaSaldoInicial: '2024-01-01' })];
    const puntos = evolucionDelPatrimonio(antigua, [], [], '2026-02-10');
    expect(puntos).toHaveLength(12);
    expect(puntos[0]).toMatchObject({ mes: '2025-03', fecha: '2025-03-31' });
    expect(puntos[9]).toMatchObject({ mes: '2025-12', fecha: '2025-12-31' });
    expect(puntos[11]).toMatchObject({ mes: '2026-02', fecha: '2026-02-10' });
  });

  it('cada punto usa solo los movimientos y valores hasta su fecha', () => {
    const valores: ValorRegistrado[] = [
      { cuentaId: 'broker', fecha: '2026-10-20', valor: 104000, borradoEn: null },
    ];
    const puntos = evolucionDelPatrimonio(CUENTAS, MOVS, valores, HOY);
    const octubre = puntos.find((p) => p.mes === '2026-10');
    const septiembre = puntos.find((p) => p.mes === '2026-09');
    expect(septiembre?.total).toBe(506000);
    // En octubre salen 1 000 € del banco, entran en el bróker y este vale 1 040 €.
    expect(octubre?.total).toBe(400000 + 6000 + 104000);
    expect(puntos[puntos.length - 1].total).toBe(patrimonioEn(CUENTAS, MOVS, valores, HOY).total);
  });
});

describe('variaciones', () => {
  it('la variación del mes compara hoy con el cierre del mes anterior', () => {
    const v = variacionDelMes(CUENTAS, MOVS, [], HOY);
    // Noviembre: +2 000 − 1 600 − 15 = +385 € sobre 5 060 €.
    expect(v).toEqual({ desde: '2026-10-31', diferencia: 38500, porcentaje: 7.6 });
  });

  it('si el mes anterior no había cuentas, no hay variación', () => {
    const nueva = [cuenta('banco', { saldoInicial: 100000, fechaSaldoInicial: '2026-11-02' })];
    expect(variacionDelMes(nueva, [], [], HOY)).toBeNull();
  });

  it('si el punto de partida no es positivo no hay porcentaje', () => {
    const rojo = [cuenta('banco', { saldoInicial: -5000 })];
    const v = variacionDelMes(rojo, [mov({ tipo: 'ingreso', importe: 20000 })], [], HOY);
    expect(v).toMatchObject({ diferencia: 20000, porcentaje: null });
  });

  it('la variación del año parte de la primera fecha con datos y llega a hoy', () => {
    const v = variacionDelAnio(CUENTAS, MOVS, [], 2026, HOY);
    expect(v).toMatchObject({ desde: '2026-01-01', hasta: HOY, diferencia: 38500 });
  });

  it('en un año pasado completo va de cierre a cierre', () => {
    const antigua = [cuenta('banco', { saldoInicial: 100000, fechaSaldoInicial: '2024-06-01' })];
    const movs = [mov({ tipo: 'ingreso', importe: 50000, fecha: '2025-03-03' })];
    expect(variacionDelAnio(antigua, movs, [], 2025, HOY)).toEqual({
      desde: '2024-12-31',
      hasta: '2025-12-31',
      diferencia: 50000,
      porcentaje: 50,
    });
  });

  it('un año futuro o anterior a la primera cuenta no tiene variación', () => {
    expect(variacionDelAnio(CUENTAS, MOVS, [], 2027, HOY)).toBeNull();
    expect(variacionDelAnio(CUENTAS, MOVS, [], 2025, HOY)).toBeNull();
  });
});
