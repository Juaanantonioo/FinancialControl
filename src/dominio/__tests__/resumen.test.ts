import type { Cuenta, Movimiento } from '../modelo';
import {
  balanceDelMes,
  cuentasDelMes,
  deDivisa,
  divisasDe,
  esMesValido,
  evolucion,
  gastoPorCategoria,
  mesDe,
  moverMes,
  OTRAS,
  repartirPorcentajes,
  resumenDeCuenta,
  SIN_CATEGORIA,
  tasaDeAhorro,
  ultimosMeses,
} from '../resumen';

type Mov = Pick<
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

function mov(parcial: Partial<Mov> & Pick<Mov, 'tipo' | 'importe'>): Mov {
  return {
    fecha: '2026-11-10',
    divisa: 'EUR',
    cuentaId: 'banco',
    cuentaDestinoId: null,
    categoriaId: null,
    borradoEn: null,
    ...parcial,
  };
}

type Cta = Pick<
  Cuenta,
  'id' | 'nombre' | 'tipo' | 'divisa' | 'saldoInicial' | 'fechaSaldoInicial' | 'archivada'
>;

function cuenta(id: string, parcial: Partial<Cta> = {}): Cta {
  return {
    id,
    nombre: id,
    tipo: 'banco',
    divisa: 'EUR',
    saldoInicial: 0,
    fechaSaldoInicial: '2026-01-01',
    archivada: false,
    ...parcial,
  };
}

const MES = '2026-11';

describe('meses', () => {
  it('reconoce un mes válido', () => {
    expect(esMesValido('2026-11')).toBe(true);
    expect(esMesValido('2026-13')).toBe(false);
    expect(esMesValido('2026-00')).toBe(false);
    expect(esMesValido('2026-1')).toBe(false);
    expect(esMesValido('noviembre')).toBe(false);
  });

  it('retroceder desde enero lleva a diciembre del año anterior', () => {
    expect(moverMes('2026-01', -1)).toBe('2025-12');
    expect(moverMes('2025-12', 1)).toBe('2026-01');
    expect(moverMes('2026-11', -11)).toBe('2025-12');
    expect(moverMes('2026-11', 14)).toBe('2028-01');
    expect(moverMes('2026-06', 0)).toBe('2026-06');
  });

  it('los últimos seis meses cruzan el cambio de año en orden', () => {
    expect(ultimosMeses('2026-02', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('el mes de una fecha es el del calendario local, también en el primer y el último día', () => {
    expect(mesDe(new Date(2026, 10, 1, 0, 0, 0))).toBe('2026-11');
    expect(mesDe(new Date(2026, 10, 30, 23, 59, 59))).toBe('2026-11');
    expect(mesDe(new Date(2026, 11, 1, 0, 0, 0))).toBe('2026-12');
    expect(mesDe(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01');
  });
});

describe('balance global del mes', () => {
  it('2 000 € de ingresos y 1 600 € de gastos dan una tasa de ahorro del 20 %', () => {
    const b = balanceDelMes(
      [
        mov({ tipo: 'ingreso', importe: 200000 }),
        mov({ tipo: 'gasto', importe: 100000 }),
        mov({ tipo: 'gasto', importe: 60000 }),
      ],
      MES,
    );
    expect(b).toEqual({
      ingresos: 200000,
      gastos: 160000,
      balance: 40000,
      ajustes: 0,
      tasaDeAhorro: 20,
      movimientos: 3,
    });
  });

  it('un mes sin movimientos da todo a cero y sin tasa', () => {
    expect(balanceDelMes([], MES)).toEqual({
      ingresos: 0,
      gastos: 0,
      balance: 0,
      ajustes: 0,
      tasaDeAhorro: null,
      movimientos: 0,
    });
  });

  it('con gastos y sin ingresos no hay tasa de ahorro: no divide entre cero', () => {
    const b = balanceDelMes([mov({ tipo: 'gasto', importe: 5000 })], MES);
    expect(b.balance).toBe(-5000);
    expect(b.tasaDeAhorro).toBeNull();
    expect(tasaDeAhorro(0, 5000)).toBeNull();
  });

  it('con ingresos y sin gastos la tasa es del 100 %', () => {
    const b = balanceDelMes([mov({ tipo: 'ingreso', importe: 150000 })], MES);
    expect(b.balance).toBe(150000);
    expect(b.tasaDeAhorro).toBe(100);
  });

  it('si se gasta más de lo ingresado el balance y la tasa son negativos', () => {
    const b = balanceDelMes(
      [mov({ tipo: 'ingreso', importe: 100000 }), mov({ tipo: 'gasto', importe: 125000 })],
      MES,
    );
    expect(b.balance).toBe(-25000);
    expect(b.tasaDeAhorro).toBe(-25);
  });

  it('las transferencias y los ajustes no cuentan como ingreso ni como gasto', () => {
    const b = balanceDelMes(
      [
        mov({ tipo: 'transferencia', importe: 50000, cuentaDestinoId: 'cartera' }),
        mov({ tipo: 'ajuste', importe: 1200 }),
        mov({ tipo: 'ajuste', importe: -700 }),
      ],
      MES,
    );
    expect(b).toMatchObject({ ingresos: 0, gastos: 0, balance: 0, ajustes: 500, movimientos: 0 });
  });

  it('los movimientos borrados y los de otros meses no cuentan', () => {
    const b = balanceDelMes(
      [
        mov({ tipo: 'gasto', importe: 1000 }),
        mov({ tipo: 'gasto', importe: 9999, borradoEn: '2026-11-11T10:00:00.000Z' }),
        mov({ tipo: 'gasto', importe: 8888, fecha: '2026-10-31' }),
        mov({ tipo: 'gasto', importe: 7777, fecha: '2026-12-01' }),
        mov({ tipo: 'gasto', importe: 6666, fecha: '2025-11-10' }),
      ],
      MES,
    );
    expect(b.gastos).toBe(1000);
  });

  it('el primer y el último día del mes pertenecen al mes', () => {
    const b = balanceDelMes(
      [
        mov({ tipo: 'gasto', importe: 100, fecha: '2026-11-01' }),
        mov({ tipo: 'gasto', importe: 200, fecha: '2026-11-30' }),
      ],
      MES,
    );
    expect(b.gastos).toBe(300);
  });

  it('suma importes grandes sin perder céntimos', () => {
    const b = balanceDelMes(
      [mov({ tipo: 'ingreso', importe: 123456789 }), mov({ tipo: 'gasto', importe: 1 })],
      MES,
    );
    expect(b.balance).toBe(123456788);
  });

  it('un mes futuro sin movimientos da cero', () => {
    expect(balanceDelMes([mov({ tipo: 'gasto', importe: 100 })], '2031-03').gastos).toBe(0);
  });

  it('las divisas no se mezclan: se filtra antes de sumar', () => {
    const movs = [
      mov({ tipo: 'gasto', importe: 1000 }),
      mov({ tipo: 'gasto', importe: 5000, divisa: 'USD' }),
    ];
    expect(balanceDelMes(deDivisa(movs, 'EUR'), MES).gastos).toBe(1000);
    expect(balanceDelMes(deDivisa(movs, 'USD'), MES).gastos).toBe(5000);
    expect(divisasDe([{ divisa: 'EUR' }, { divisa: 'USD' }, { divisa: 'EUR' }])).toEqual([
      'EUR',
      'USD',
    ]);
  });
});

describe('balance por cuenta', () => {
  const banco = cuenta('banco', { saldoInicial: 100000 });
  const cartera = cuenta('cartera', { saldoInicial: 5000 });

  it('entradas, salidas y variación incluyen transferencias y ajustes', () => {
    const movs = [
      mov({ tipo: 'ingreso', importe: 200000 }),
      mov({ tipo: 'gasto', importe: 30000 }),
      mov({ tipo: 'transferencia', importe: 5000, cuentaDestinoId: 'cartera' }),
      mov({ tipo: 'ajuste', importe: -250 }),
      mov({ tipo: 'ajuste', importe: 100 }),
    ];
    expect(resumenDeCuenta(banco, movs, MES)).toEqual({
      cuentaId: 'banco',
      saldo: 100000 + 200000 - 30000 - 5000 - 250 + 100,
      entradas: 200100,
      salidas: 35250,
      variacion: 164850,
      movimientos: 5,
    });
    expect(resumenDeCuenta(cartera, movs, MES)).toMatchObject({
      saldo: 10000,
      entradas: 5000,
      salidas: 0,
      variacion: 5000,
      movimientos: 1,
    });
  });

  it('solo transferencias: balance global cero y variaciones que suman cero', () => {
    const movs = [
      mov({ tipo: 'transferencia', importe: 5000, cuentaDestinoId: 'cartera' }),
      mov({ tipo: 'transferencia', importe: 1200, cuentaId: 'cartera', cuentaDestinoId: 'banco' }),
    ];
    const global = balanceDelMes(movs, MES);
    const b = resumenDeCuenta(banco, movs, MES);
    const c = resumenDeCuenta(cartera, movs, MES);
    expect(global.balance).toBe(0);
    expect(b.variacion).toBe(-3800);
    expect(c.variacion).toBe(3800);
    expect(b.variacion + c.variacion).toBe(0);
  });

  it('un movimiento anterior a la fecha del saldo inicial no cuenta en la cuenta', () => {
    const nueva = cuenta('banco', { saldoInicial: 100000, fechaSaldoInicial: '2026-11-15' });
    const movs = [
      mov({ tipo: 'gasto', importe: 4000, fecha: '2026-11-10' }),
      mov({ tipo: 'gasto', importe: 1000, fecha: '2026-11-15' }),
    ];
    expect(resumenDeCuenta(nueva, movs, MES)).toMatchObject({
      saldo: 99000,
      salidas: 1000,
      variacion: -1000,
      movimientos: 1,
    });
    // En el balance global sí cuenta: es un gasto real del mes.
    expect(balanceDelMes(movs, MES).gastos).toBe(5000);
  });

  it('los movimientos borrados y los de otras cuentas no afectan', () => {
    const movs = [
      mov({ tipo: 'gasto', importe: 4000, borradoEn: '2026-11-11T10:00:00.000Z' }),
      mov({ tipo: 'gasto', importe: 900, cuentaId: 'cartera' }),
    ];
    expect(resumenDeCuenta(banco, movs, MES)).toMatchObject({
      saldo: 100000,
      entradas: 0,
      salidas: 0,
      variacion: 0,
      movimientos: 0,
    });
  });

  it('el saldo es el actual aunque se consulte un mes pasado', () => {
    const movs = [
      mov({ tipo: 'gasto', importe: 1000, fecha: '2026-10-05' }),
      mov({ tipo: 'gasto', importe: 2000, fecha: '2026-11-05' }),
    ];
    expect(resumenDeCuenta(banco, movs, '2026-10')).toMatchObject({
      saldo: 97000,
      salidas: 1000,
      variacion: -1000,
    });
  });

  it('coherencia: la suma de variaciones es el balance global más los ajustes', () => {
    const cuentas = [banco, cartera, cuenta('ahorro', { archivada: true })];
    const movs = [
      mov({ tipo: 'ingreso', importe: 200000 }),
      mov({ tipo: 'gasto', importe: 61234 }),
      mov({ tipo: 'gasto', importe: 999, cuentaId: 'cartera' }),
      mov({ tipo: 'gasto', importe: 5000, cuentaId: 'ahorro' }),
      mov({ tipo: 'transferencia', importe: 30000, cuentaDestinoId: 'ahorro' }),
      mov({ tipo: 'transferencia', importe: 700, cuentaId: 'cartera', cuentaDestinoId: 'banco' }),
      mov({ tipo: 'ajuste', importe: -321 }),
      mov({ tipo: 'ajuste', importe: 45, cuentaId: 'cartera' }),
      mov({ tipo: 'gasto', importe: 7777, borradoEn: '2026-11-12T08:00:00.000Z' }),
      mov({ tipo: 'gasto', importe: 8888, fecha: '2026-10-20' }),
    ];
    const global = balanceDelMes(movs, MES);
    const suma = cuentas
      .map((c) => resumenDeCuenta(c, movs, MES).variacion)
      .reduce((a, b) => a + b, 0);
    expect(suma).toBe(global.balance + global.ajustes);
    expect(suma).toBe(200000 - 61234 - 999 - 5000 - 321 + 45);
  });

  it('en la lista del mes una cuenta archivada solo aparece si tiene movimientos', () => {
    const cuentas = [
      banco,
      cuenta('vieja', { archivada: true }),
      cuenta('dormida', { archivada: true }),
    ];
    const movs = [mov({ tipo: 'gasto', importe: 500, cuentaId: 'vieja' })];
    expect(cuentasDelMes(cuentas, movs, MES).map((c) => c.id)).toEqual(['banco', 'vieja']);
    expect(cuentasDelMes(cuentas, movs, '2026-10').map((c) => c.id)).toEqual(['banco']);
  });

  it('sin cuentas, con una y con ocho', () => {
    expect(cuentasDelMes([], [], MES)).toEqual([]);
    expect(cuentasDelMes([banco], [], MES)).toHaveLength(1);
    const ocho = Array.from({ length: 8 }, (_, i) => cuenta(`c${i}`));
    const movs = ocho.map((c, i) => mov({ tipo: 'gasto', importe: (i + 1) * 100, cuentaId: c.id }));
    const lista = cuentasDelMes(ocho, movs, MES);
    expect(lista).toHaveLength(8);
    expect(lista.map((c) => c.resumen.variacion)).toEqual([
      -100, -200, -300, -400, -500, -600, -700, -800,
    ]);
  });
});

describe('gasto por categoría', () => {
  const categorias = [
    { id: 'comida', padreId: null },
    { id: 'casa', padreId: null },
    { id: 'super', padreId: 'comida' },
    { id: 'fruta', padreId: 'super' },
  ];

  it('un mes sin gastos no tiene partes', () => {
    expect(gastoPorCategoria([mov({ tipo: 'ingreso', importe: 100 })], categorias, MES)).toEqual({
      total: 0,
      partes: [],
    });
  });

  it('una sola categoría se lleva el 100 %', () => {
    const g = gastoPorCategoria(
      [mov({ tipo: 'gasto', importe: 1234, categoriaId: 'casa' })],
      categorias,
      MES,
    );
    expect(g).toEqual({ total: 1234, partes: [{ clave: 'casa', importe: 1234, porcentaje: 100 }] });
  });

  it('una subcategoría suma en su categoría principal, también con dos niveles', () => {
    const g = gastoPorCategoria(
      [
        mov({ tipo: 'gasto', importe: 1000, categoriaId: 'comida' }),
        mov({ tipo: 'gasto', importe: 2000, categoriaId: 'super' }),
        mov({ tipo: 'gasto', importe: 500, categoriaId: 'fruta' }),
        mov({ tipo: 'gasto', importe: 1500, categoriaId: 'casa' }),
      ],
      categorias,
      MES,
    );
    expect(g.partes).toEqual([
      { clave: 'comida', importe: 3500, porcentaje: 70 },
      { clave: 'casa', importe: 1500, porcentaje: 30 },
    ]);
  });

  it('los gastos sin categoría forman su propia parte', () => {
    const g = gastoPorCategoria(
      [
        mov({ tipo: 'gasto', importe: 300 }),
        mov({ tipo: 'gasto', importe: 700, categoriaId: 'casa' }),
      ],
      categorias,
      MES,
    );
    expect(g.partes.map((p) => p.clave)).toEqual(['casa', SIN_CATEGORIA]);
  });

  it('con más de cinco categorías muestra cinco y agrupa el resto en Otras', () => {
    const movs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) =>
      mov({ tipo: 'gasto', importe: (8 - i) * 1000, categoriaId: id }),
    );
    const g = gastoPorCategoria(movs, [], MES);
    expect(g.total).toBe(36000);
    expect(g.partes.map((p) => p.clave)).toEqual(['a', 'b', 'c', 'd', 'e', OTRAS]);
    expect(g.partes[5].importe).toBe(3000 + 2000 + 1000);
    expect(g.partes.reduce((s, p) => s + p.importe, 0)).toBe(g.total);
    expect(g.partes.reduce((s, p) => s + p.porcentaje, 0)).toBe(100);
  });

  it('con exactamente cinco categorías no hay Otras', () => {
    const movs = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      mov({ tipo: 'gasto', importe: 1000, categoriaId: id }),
    );
    expect(gastoPorCategoria(movs, [], MES).partes.map((p) => p.clave)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('no cuenta ingresos, transferencias, ajustes, borrados ni otros meses', () => {
    const g = gastoPorCategoria(
      [
        mov({ tipo: 'gasto', importe: 100, categoriaId: 'casa' }),
        mov({ tipo: 'ingreso', importe: 900, categoriaId: 'casa' }),
        mov({ tipo: 'transferencia', importe: 900, cuentaDestinoId: 'cartera' }),
        mov({ tipo: 'ajuste', importe: -900 }),
        mov({ tipo: 'gasto', importe: 900, categoriaId: 'casa', borradoEn: '2026-11-11T00:00Z' }),
        mov({ tipo: 'gasto', importe: 900, categoriaId: 'casa', fecha: '2026-10-10' }),
      ],
      categorias,
      MES,
    );
    expect(g.total).toBe(100);
  });

  it('los porcentajes son enteros y suman siempre 100', () => {
    expect(repartirPorcentajes([1, 1, 1], 3)).toEqual([34, 33, 33]);
    expect(repartirPorcentajes([1, 999], 1000)).toEqual([0, 100]);
    expect(repartirPorcentajes([50, 50], 100)).toEqual([50, 50]);
    expect(repartirPorcentajes([], 0)).toEqual([]);
    expect(repartirPorcentajes([5], 0)).toEqual([0]);
    const tercios = repartirPorcentajes([333, 333, 334], 1000);
    expect(tercios.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('evolución', () => {
  it('da ingresos y gastos de los seis últimos meses, con ceros donde no hay datos', () => {
    const movs = [
      mov({ tipo: 'ingreso', importe: 200000, fecha: '2026-11-01' }),
      mov({ tipo: 'gasto', importe: 50000, fecha: '2026-11-30' }),
      mov({ tipo: 'gasto', importe: 30000, fecha: '2026-09-15' }),
      mov({ tipo: 'gasto', importe: 99999, fecha: '2026-05-31' }),
      mov({ tipo: 'transferencia', importe: 4000, cuentaDestinoId: 'x', fecha: '2026-10-10' }),
    ];
    expect(evolucion(movs, MES)).toEqual([
      { mes: '2026-06', ingresos: 0, gastos: 0 },
      { mes: '2026-07', ingresos: 0, gastos: 0 },
      { mes: '2026-08', ingresos: 0, gastos: 0 },
      { mes: '2026-09', ingresos: 0, gastos: 30000 },
      { mes: '2026-10', ingresos: 0, gastos: 0 },
      { mes: '2026-11', ingresos: 200000, gastos: 50000 },
    ]);
  });

  it('cruza el cambio de año', () => {
    const e = evolucion([mov({ tipo: 'gasto', importe: 100, fecha: '2025-12-31' })], '2026-01');
    expect(e.map((m) => m.mes)).toEqual([
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
    expect(e[4].gastos).toBe(100);
  });
});
