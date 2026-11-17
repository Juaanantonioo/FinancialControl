import {
  diasEntre,
  evolucionDeInversion,
  rentabilidadSimple,
  resumenDeInversion,
  resumenDeInversiones,
  saldoEnFecha,
  ultimoValor,
  valorDesactualizado,
  valorEstimado,
  type MovimientoDeCuenta,
  type ValorRegistrado,
} from '../inversion';

const broker = { id: 'broker', saldoInicial: 0, fechaSaldoInicial: '2026-01-01' };

function aporta(fecha: string, importe: number, borradoEn: string | null = null) {
  return {
    tipo: 'transferencia',
    fecha,
    importe,
    cuentaId: 'banco',
    cuentaDestinoId: 'broker',
    borradoEn,
  } satisfies MovimientoDeCuenta;
}
function retira(fecha: string, importe: number): MovimientoDeCuenta {
  return {
    tipo: 'transferencia',
    fecha,
    importe,
    cuentaId: 'broker',
    cuentaDestinoId: 'banco',
    borradoEn: null,
  };
}
function valor(fecha: string, importe: number, borradoEn: string | null = null): ValorRegistrado {
  return { cuentaId: 'broker', fecha, valor: importe, borradoEn };
}

const TRES = [
  aporta('2026-02-01', 100000),
  aporta('2026-03-01', 50000),
  aporta('2026-04-01', 50000),
];

describe('ejemplo del encargo', () => {
  it('1 000 + 500 + 500 € y un valor de 2 150 €: ganancia 150 € y 7,5 %', () => {
    const r = resumenDeInversion(broker, TRES, [valor('2026-04-10', 215000)], '2026-04-30');
    expect(r).toEqual({
      aportado: 200000,
      valor: 215000,
      ganancia: 15000,
      rentabilidad: 7.5,
      ultimo: { fecha: '2026-04-10', valor: 215000 },
    });
  });

  it('una aportación posterior de 200 € deja 2 350 €, 2 200 € y 150 €', () => {
    const movs = [...TRES, aporta('2026-05-05', 20000)];
    const r = resumenDeInversion(broker, movs, [valor('2026-04-10', 215000)], '2026-05-31');
    expect(r.valor).toBe(235000);
    expect(r.aportado).toBe(220000);
    expect(r.ganancia).toBe(15000);
    expect(r.rentabilidad).toBe(6.8);
  });
});

describe('valor estimado', () => {
  it('sin ningún valor registrado es lo aportado y no hay ganancia', () => {
    const r = resumenDeInversion(broker, TRES, [], '2026-12-31');
    expect(r).toMatchObject({ aportado: 200000, valor: 200000, ganancia: 0, rentabilidad: 0 });
    expect(r.ultimo).toBeNull();
  });

  it('usa el último valor con fecha igual o anterior, no uno posterior', () => {
    const valores = [valor('2026-02-15', 101000), valor('2026-04-10', 215000)];
    expect(valorEstimado(broker, TRES, valores, '2026-02-20')).toBe(101000);
    // El 1 de marzo entran 500 € más.
    expect(valorEstimado(broker, TRES, valores, '2026-03-31')).toBe(151000);
    expect(valorEstimado(broker, TRES, valores, '2026-04-10')).toBe(215000);
    expect(valorEstimado(broker, TRES, valores, '2026-02-10')).toBe(100000);
  });

  it('una aportación el mismo día del valor ya está incluida; al día siguiente se suma', () => {
    const elMismoDia = [...TRES, aporta('2026-04-10', 30000)];
    expect(valorEstimado(broker, elMismoDia, [valor('2026-04-10', 215000)], '2026-04-30')).toBe(
      215000,
    );
    const alDiaSiguiente = [...TRES, aporta('2026-04-11', 30000)];
    expect(valorEstimado(broker, alDiaSiguiente, [valor('2026-04-10', 215000)], '2026-04-30')).toBe(
      245000,
    );
  });

  it('una retirada parcial después del valor baja el valor y lo aportado por igual', () => {
    const movs = [...TRES, retira('2026-05-02', 60000)];
    const r = resumenDeInversion(broker, movs, [valor('2026-04-10', 215000)], '2026-05-31');
    expect(r).toMatchObject({ aportado: 140000, valor: 155000, ganancia: 15000 });
  });

  it('un valor menor que lo aportado es una pérdida, y un valor cero lo pierde todo', () => {
    const pierde = resumenDeInversion(broker, TRES, [valor('2026-04-10', 180000)], '2026-04-30');
    expect(pierde).toMatchObject({ ganancia: -20000, rentabilidad: -10 });
    const cero = resumenDeInversion(broker, TRES, [valor('2026-04-10', 0)], '2026-04-30');
    expect(cero).toMatchObject({ valor: 0, ganancia: -200000, rentabilidad: -100 });
  });

  it('con lo aportado en cero o negativo no hay porcentaje', () => {
    const todoFuera = [...TRES, retira('2026-05-02', 200000)];
    const r = resumenDeInversion(broker, todoFuera, [valor('2026-04-10', 215000)], '2026-05-31');
    expect(r).toMatchObject({ aportado: 0, valor: 15000, ganancia: 15000, rentabilidad: null });
    const masFuera = [...TRES, retira('2026-05-02', 210000)];
    const s = resumenDeInversion(broker, masFuera, [valor('2026-04-10', 215000)], '2026-05-31');
    expect(s).toMatchObject({ aportado: -10000, valor: 5000, rentabilidad: null });
    expect(rentabilidadSimple(100, 0)).toBeNull();
    expect(rentabilidadSimple(100, -5)).toBeNull();
  });

  it('un valor borrado no cuenta: los cálculos vuelven al estado anterior', () => {
    const borrado = [valor('2026-04-10', 215000, '2026-04-11T10:00:00.000Z')];
    expect(resumenDeInversion(broker, TRES, borrado, '2026-04-30')).toEqual(
      resumenDeInversion(broker, TRES, [], '2026-04-30'),
    );
  });

  it('los valores de otra cuenta y los movimientos borrados no afectan', () => {
    const ajeno = [{ cuentaId: 'otra', fecha: '2026-04-10', valor: 999999, borradoEn: null }];
    const movs = [...TRES, aporta('2026-04-02', 77700, '2026-04-03T00:00:00.000Z')];
    expect(valorEstimado(broker, movs, ajeno, '2026-04-30')).toBe(200000);
  });

  it('antes de la fecha del saldo inicial la cuenta no tiene valor: null, no cero', () => {
    expect(saldoEnFecha(broker, TRES, '2025-12-31')).toBeNull();
    expect(valorEstimado(broker, TRES, [], '2025-12-31')).toBeNull();
    expect(saldoEnFecha(broker, TRES, '2026-01-01')).toBe(0);
  });

  it('un valor anterior a la primera aportación se respeta y las aportaciones se suman', () => {
    const r = resumenDeInversion(broker, TRES, [valor('2026-01-10', 0)], '2026-04-30');
    expect(r).toMatchObject({ aportado: 200000, valor: 200000, ganancia: 0 });
  });

  it('un valor anterior a la fecha del saldo inicial se ignora', () => {
    const cuenta = { id: 'broker', saldoInicial: 50000, fechaSaldoInicial: '2026-03-15' };
    expect(ultimoValor(cuenta, [valor('2026-03-01', 1)], '2026-04-30')).toBeNull();
    // Solo cuenta la aportación de abril: las anteriores ya están en el saldo inicial.
    expect(valorEstimado(cuenta, TRES, [valor('2026-03-01', 1)], '2026-04-30')).toBe(100000);
  });

  it('el saldo inicial cuenta como aportado y un ingreso directo también', () => {
    const cuenta = { id: 'broker', saldoInicial: 580000, fechaSaldoInicial: '2026-01-01' };
    const ingreso: MovimientoDeCuenta = {
      tipo: 'ingreso',
      fecha: '2026-02-01',
      importe: 1200,
      cuentaId: 'broker',
      cuentaDestinoId: null,
      borradoEn: null,
    };
    expect(resumenDeInversion(cuenta, [ingreso], [], '2026-02-28').aportado).toBe(581200);
  });
});

describe('conjunto de inversiones y evolución', () => {
  it('suma varias cuentas y calcula la rentabilidad del conjunto', () => {
    const fondo = { id: 'fondo', saldoInicial: 100000, fechaSaldoInicial: '2026-01-01' };
    const valores = [
      valor('2026-04-10', 215000),
      { cuentaId: 'fondo', fecha: '2026-04-10', valor: 90000, borradoEn: null },
    ];
    expect(resumenDeInversiones([broker, fondo], TRES, valores, '2026-04-30')).toEqual({
      aportado: 300000,
      valor: 305000,
      ganancia: 5000,
      rentabilidad: 1.7,
    });
    expect(resumenDeInversiones([], [], [], '2026-04-30')).toEqual({
      aportado: 0,
      valor: 0,
      ganancia: 0,
      rentabilidad: null,
    });
  });

  it('la evolución omite las fechas anteriores a la cuenta', () => {
    const puntos = evolucionDeInversion(
      broker,
      TRES,
      [valor('2026-04-10', 215000)],
      ['2025-12-31', '2026-01-31', '2026-03-31', '2026-04-30'],
    );
    expect(puntos).toEqual([
      { fecha: '2026-01-31', aportado: 0, valor: 0 },
      { fecha: '2026-03-31', aportado: 150000, valor: 150000 },
      { fecha: '2026-04-30', aportado: 200000, valor: 215000 },
    ]);
  });
});

describe('aviso de valor antiguo', () => {
  it('cuenta días naturales, también con cambio de año y año bisiesto', () => {
    expect(diasEntre('2026-11-17', '2026-11-17')).toBe(0);
    expect(diasEntre('2025-12-31', '2026-01-01')).toBe(1);
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2);
    expect(diasEntre('2026-03-01', '2026-02-27')).toBe(-2);
  });

  it('avisa a partir del día 31 y nunca si no hay valores', () => {
    expect(valorDesactualizado('2026-10-18', '2026-11-17')).toBe(false);
    expect(valorDesactualizado('2026-10-17', '2026-11-17')).toBe(true);
    expect(valorDesactualizado(null, '2026-11-17')).toBe(false);
  });
});
