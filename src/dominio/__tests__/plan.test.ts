import type { MovimientoDeCuenta } from '../inversion';
import type { Movimiento } from '../modelo';
import { aportadoA, estadoDeObjetivo, mesesHasta } from '../objetivos';
import {
  diasQueQuedan,
  disponibleDelMes,
  estadoDeLinea,
  estadoDelPresupuesto,
  propuestaDePresupuesto,
} from '../presupuesto';
import { lineaDePrevision, previsionDeFinDeMes, saldoDisponibleEn } from '../prevision';
import {
  estaVigente,
  fechaDeOcurrencia,
  fijosPendientes,
  ocurrenciasDelMes,
  pendientesDelMes,
  porConfirmar,
  proximosCobros,
  sumarDias,
  tipoDeLaClase,
  totalMensualDeFijos,
  type ReglaRecurrente,
} from '../recurrentes';
import { SIN_CATEGORIA } from '../resumen';

const HOY = '2026-11-17';

function regla(id: string, parcial: Partial<ReglaRecurrente> = {}): ReglaRecurrente {
  return {
    id,
    nombre: id,
    clase: 'fijo',
    tipoMovimiento: 'gasto',
    importe: 4500,
    divisa: 'EUR',
    cuentaId: 'banco',
    cuentaDestinoId: null,
    categoriaId: 'casa',
    periodicidad: 'mensual',
    diaDelMes: 18,
    fechaInicio: '2026-01-01',
    fechaFin: null,
    activa: true,
    avisoDiasAntes: 0,
    objetivoId: null,
    creadoEn: 'x',
    modificadoEn: 'x',
    borradoEn: null,
    ...parcial,
  };
}

type Mov = Pick<
  Movimiento,
  | 'id'
  | 'tipo'
  | 'fecha'
  | 'importe'
  | 'divisa'
  | 'cuentaId'
  | 'cuentaDestinoId'
  | 'categoriaId'
  | 'reglaRecurrenteId'
  | 'borradoEn'
>;
let contador = 0;
function mov(parcial: Partial<Mov> & { importe: number }): Mov {
  contador++;
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    fecha: '2026-11-10',
    divisa: 'EUR',
    cuentaId: 'banco',
    cuentaDestinoId: null,
    categoriaId: null,
    reglaRecurrenteId: null,
    borradoEn: null,
    ...parcial,
  };
}

describe('ocurrencias de una regla', () => {
  it('una regla mensual ocurre cada mes en su día', () => {
    const r = regla('gimnasio');
    expect(fechaDeOcurrencia(r, '2026-11')).toBe('2026-11-18');
    expect(fechaDeOcurrencia(r, '2027-03')).toBe('2027-03-18');
  });

  it('el día 31 cae en el último día de febrero, de febrero bisiesto y de abril', () => {
    const r = regla('alquiler', { diaDelMes: 31 });
    expect(fechaDeOcurrencia(r, '2027-02')).toBe('2027-02-28');
    expect(fechaDeOcurrencia(r, '2028-02')).toBe('2028-02-29');
    expect(fechaDeOcurrencia(r, '2026-04')).toBe('2026-04-30');
    expect(fechaDeOcurrencia(r, '2026-12')).toBe('2026-12-31');
    expect(fechaDeOcurrencia(regla('x', { diaDelMes: 30 }), '2027-02')).toBe('2027-02-28');
  });

  it('una regla anual ocurre solo en el mes de su fecha de inicio', () => {
    const r = regla('seguro', { periodicidad: 'anual', fechaInicio: '2026-03-01', diaDelMes: 15 });
    expect(fechaDeOcurrencia(r, '2026-03')).toBe('2026-03-15');
    expect(fechaDeOcurrencia(r, '2027-03')).toBe('2027-03-15');
    expect(fechaDeOcurrencia(r, '2026-11')).toBeNull();
    expect(fechaDeOcurrencia(r, '2026-04')).toBeNull();
  });

  it('no ocurre antes de la fecha de inicio', () => {
    const r = regla('nueva', { fechaInicio: '2026-11-17', diaDelMes: 5 });
    // El día 5 de noviembre es anterior al inicio: la primera vez es en diciembre.
    expect(fechaDeOcurrencia(r, '2026-11')).toBeNull();
    expect(fechaDeOcurrencia(r, '2026-12')).toBe('2026-12-05');
    expect(fechaDeOcurrencia(regla('hoy', { fechaInicio: HOY, diaDelMes: 17 }), '2026-11')).toBe(
      HOY,
    );
  });

  it('con fecha de fin a mitad de mes ocurre si su día es anterior y no si es posterior', () => {
    const fin = { fechaFin: '2026-11-15' };
    expect(fechaDeOcurrencia(regla('antes', { ...fin, diaDelMes: 10 }), '2026-11')).toBe(
      '2026-11-10',
    );
    expect(fechaDeOcurrencia(regla('justo', { ...fin, diaDelMes: 15 }), '2026-11')).toBe(
      '2026-11-15',
    );
    expect(fechaDeOcurrencia(regla('despues', { ...fin, diaDelMes: 18 }), '2026-11')).toBeNull();
    expect(fechaDeOcurrencia(regla('luego', { ...fin, diaDelMes: 10 }), '2026-12')).toBeNull();
  });

  it('una regla inactiva o borrada no ocurre', () => {
    expect(fechaDeOcurrencia(regla('off', { activa: false }), '2026-11')).toBeNull();
    expect(
      fechaDeOcurrencia(regla('del', { borradoEn: '2026-11-01T00:00Z' }), '2026-11'),
    ).toBeNull();
  });

  it('distingue confirmada, por confirmar y próximo, y ordena por día', () => {
    const reglas = [
      regla('gimnasio', { diaDelMes: 18 }),
      regla('luz', { diaDelMes: 5 }),
      regla('hoy', { diaDelMes: 17 }),
      regla('musica', { diaDelMes: 3 }),
    ];
    const movs = [mov({ importe: 999, reglaRecurrenteId: 'musica', fecha: '2026-11-04' })];
    const lista = ocurrenciasDelMes(reglas, movs, '2026-11', HOY);
    expect(lista.map((o) => [o.regla.id, o.fecha, o.estado])).toEqual([
      ['musica', '2026-11-03', 'confirmada'],
      ['luz', '2026-11-05', 'por_confirmar'],
      ['hoy', '2026-11-17', 'por_confirmar'],
      ['gimnasio', '2026-11-18', 'proximo'],
    ]);
    expect(lista[0].movimientoId).toBe(movs[0].id);
    expect(pendientesDelMes(reglas, movs, '2026-11', HOY).map((o) => o.regla.id)).toEqual([
      'luz',
      'hoy',
      'gimnasio',
    ]);
  });

  it('un movimiento borrado deja la ocurrencia pendiente; al deshacer vuelve a confirmada', () => {
    const r = [regla('luz', { diaDelMes: 5 })];
    const confirmado = mov({ importe: 4500, reglaRecurrenteId: 'luz', fecha: '2026-11-05' });
    const borrado = { ...confirmado, borradoEn: '2026-11-06T00:00:00.000Z' };
    expect(ocurrenciasDelMes(r, [confirmado], '2026-11', HOY)[0].estado).toBe('confirmada');
    expect(ocurrenciasDelMes(r, [borrado], '2026-11', HOY)[0].estado).toBe('por_confirmar');
    expect(ocurrenciasDelMes(r, [{ ...borrado, borradoEn: null }], '2026-11', HOY)[0].estado).toBe(
      'confirmada',
    );
  });

  it('si al movimiento confirmado se le cambia la fecha a otro mes, la ocurrencia vuelve a pendiente', () => {
    const r = [regla('luz', { diaDelMes: 5 })];
    const movido = mov({ importe: 4500, reglaRecurrenteId: 'luz', fecha: '2026-10-31' });
    expect(ocurrenciasDelMes(r, [movido], '2026-11', HOY)[0].estado).toBe('por_confirmar');
    expect(ocurrenciasDelMes(r, [movido], '2026-10', HOY)[0].estado).toBe('confirmada');
    // Dentro del mismo mes sigue confirmada aunque no sea el día de la regla.
    const otroDia = { ...movido, fecha: '2026-11-29' };
    expect(ocurrenciasDelMes(r, [otroDia], '2026-11', HOY)[0].estado).toBe('confirmada');
  });

  it('por confirmar reúne los vencidos de este mes y del anterior', () => {
    const reglas = [regla('luz', { diaDelMes: 5 }), regla('fin', { diaDelMes: 30 })];
    const lista = porConfirmar(reglas, [], HOY);
    expect(lista.map((o) => [o.regla.id, o.fecha])).toEqual([
      ['luz', '2026-10-05'],
      ['fin', '2026-10-30'],
      ['luz', '2026-11-05'],
    ]);
  });

  it('próximos cobros: después de hoy y hasta 14 días, también en el mes siguiente', () => {
    const reglas = [
      regla('hoy', { diaDelMes: 17 }),
      regla('gimnasio', { diaDelMes: 18 }),
      regla('limite', { diaDelMes: 1 }),
      regla('fuera', { diaDelMes: 2 }),
      regla('pagado', { diaDelMes: 20 }),
    ];
    const movs = [mov({ importe: 1, reglaRecurrenteId: 'pagado', fecha: '2026-11-16' })];
    expect(sumarDias(HOY, 14)).toBe('2026-12-01');
    expect(proximosCobros(reglas, movs, HOY).map((o) => [o.regla.id, o.fecha])).toEqual([
      ['gimnasio', '2026-11-18'],
      ['limite', '2026-12-01'],
    ]);
  });

  it('sumar días cruza meses, años y febrero bisiesto', () => {
    expect(sumarDias('2026-12-25', 14)).toBe('2027-01-08');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('el total mensual suma solo las reglas mensuales de gasto vigentes', () => {
    const reglas = [
      regla('alquiler', { importe: 62000 }),
      regla('musica', { importe: 999, clase: 'suscripcion' }),
      regla('seguro', { importe: 30000, periodicidad: 'anual' }),
      regla('nomina', { importe: 190000, clase: 'ingreso', tipoMovimiento: 'ingreso' }),
      regla('off', { importe: 5000, activa: false }),
      regla('acabada', { importe: 5000, fechaFin: '2026-11-16' }),
      regla('acaba-hoy', { importe: 100, fechaFin: HOY }),
    ];
    expect(totalMensualDeFijos(reglas, HOY)).toBe(62000 + 999 + 100);
    expect(estaVigente(reglas[5], HOY)).toBe(false);
  });

  it('cada clase genera su tipo de movimiento', () => {
    expect(tipoDeLaClase('fijo')).toBe('gasto');
    expect(tipoDeLaClase('suscripcion')).toBe('gasto');
    expect(tipoDeLaClase('ingreso')).toBe('ingreso');
    expect(tipoDeLaClase('aportacion')).toBe('transferencia');
  });
});

describe('presupuesto', () => {
  const categorias = [
    { id: 'comida', padreId: null },
    { id: 'super', padreId: 'comida' },
    { id: 'casa', padreId: null },
    { id: 'ocio', padreId: null },
  ];
  const linea = (categoriaId: string, importe: number, borradoEn: string | null = null) => ({
    categoriaId,
    importe,
    borradoEn,
  });

  it('estados de una línea: dentro, cerca desde el 80 % y excedida', () => {
    expect(estadoDeLinea(10000, 7999)).toBe('dentro');
    expect(estadoDeLinea(10000, 8000)).toBe('cerca');
    expect(estadoDeLinea(10000, 10000)).toBe('cerca');
    expect(estadoDeLinea(10000, 10001)).toBe('excedida');
    expect(estadoDeLinea(0, 0)).toBe('dentro');
    expect(estadoDeLinea(0, 1)).toBe('excedida');
  });

  it('el gasto de una subcategoría cuenta en la línea de su categoría principal', () => {
    const movs = [
      mov({ importe: 20000, categoriaId: 'comida' }),
      mov({ importe: 15000, categoriaId: 'super' }),
      mov({ importe: 62000, categoriaId: 'casa' }),
      mov({ importe: 3000, categoriaId: 'ocio' }),
      mov({ importe: 2000 }),
      mov({ importe: 99999, categoriaId: 'casa', fecha: '2026-10-10' }),
      mov({ tipo: 'transferencia', importe: 5000, cuentaDestinoId: 'x' }),
      mov({ tipo: 'ingreso', importe: 5000 }),
    ];
    const e = estadoDelPresupuesto(
      [linea('comida', 40000), linea('casa', 60000), linea('vieja', 9999, '2026-11-01T00:00Z')],
      movs,
      categorias,
      '2026-11',
      HOY,
    );
    expect(e.presupuestado).toBe(100000);
    expect(e.gastado).toBe(102000);
    expect(e.lineas).toEqual([
      {
        categoriaId: 'comida',
        previsto: 40000,
        real: 35000,
        queda: 5000,
        porcentaje: 88,
        estado: 'cerca',
      },
      {
        categoriaId: 'casa',
        previsto: 60000,
        real: 62000,
        queda: -2000,
        porcentaje: 103,
        estado: 'excedida',
      },
    ]);
    // Ocio no tiene línea y hay un gasto sin categoría.
    expect(e.sinPresupuestar).toBe(5000);
    expect(e.marcaDelDia).toBeCloseTo(17 / 30, 10);
  });

  it('sin líneas, con una línea a cero y con gasto solo en categorías sin línea', () => {
    const movs = [mov({ importe: 3000, categoriaId: 'ocio' })];
    const vacio = estadoDelPresupuesto([], movs, categorias, '2026-11', HOY);
    expect(vacio).toMatchObject({
      presupuestado: 0,
      gastado: 3000,
      lineas: [],
      sinPresupuestar: 3000,
    });
    const cero = estadoDelPresupuesto([linea('casa', 0)], movs, categorias, '2026-11', HOY);
    expect(cero.lineas[0]).toMatchObject({ real: 0, porcentaje: null, estado: 'dentro' });
    const ceroConGasto = estadoDelPresupuesto([linea('ocio', 0)], movs, categorias, '2026-11', HOY);
    expect(ceroConGasto.lineas[0]).toMatchObject({ queda: -3000, estado: 'excedida' });
    expect(ceroConGasto.sinPresupuestar).toBe(0);
  });

  it('la marca del día solo existe en el mes en curso', () => {
    expect(estadoDelPresupuesto([], [], [], '2026-10', HOY).marcaDelDia).toBeNull();
    expect(estadoDelPresupuesto([], [], [], '2026-12', HOY).marcaDelDia).toBeNull();
    expect(estadoDelPresupuesto([], [], [], '2026-11', '2026-11-30').marcaDelDia).toBe(1);
  });

  it('propone la media de los tres meses anteriores por categoría principal', () => {
    const movs = [
      mov({ importe: 30000, categoriaId: 'comida', fecha: '2026-08-10' }),
      mov({ importe: 33000, categoriaId: 'comida', fecha: '2026-09-10' }),
      mov({ importe: 30000, categoriaId: 'comida', fecha: '2026-10-10' }),
      mov({ importe: 6000, categoriaId: 'super', fecha: '2026-10-11' }),
      mov({ importe: 62000, categoriaId: 'casa', fecha: '2026-08-01' }),
      mov({ importe: 62000, categoriaId: 'casa', fecha: '2026-09-01' }),
      mov({ importe: 62001, categoriaId: 'casa', fecha: '2026-10-01' }),
      mov({ importe: 9000, categoriaId: 'ocio', fecha: '2026-09-20' }),
      mov({ importe: 500, fecha: '2026-09-21' }),
      // Fuera de la ventana: el propio mes y cuatro meses atrás.
      mov({ importe: 99999, categoriaId: 'ocio', fecha: '2026-11-02' }),
      mov({ importe: 99999, categoriaId: 'ocio', fecha: '2026-07-31' }),
    ];
    const p = propuestaDePresupuesto(movs, categorias, '2026-11');
    expect(Object.fromEntries(p)).toEqual({ comida: 33000, casa: 62000, ocio: 3000 });
    expect(p.has(SIN_CATEGORIA)).toBe(false);
  });

  it('con menos de tres meses con datos reparte entre los que hay; sin histórico no propone', () => {
    const movs = [
      mov({ importe: 30000, categoriaId: 'comida', fecha: '2026-10-10' }),
      mov({ importe: 10000, categoriaId: 'comida', fecha: '2026-09-10' }),
    ];
    expect(Object.fromEntries(propuestaDePresupuesto(movs, categorias, '2026-11'))).toEqual({
      comida: 20000,
    });
    expect(propuestaDePresupuesto([], categorias, '2026-11').size).toBe(0);
    // Enero mira a octubre, noviembre y diciembre del año anterior.
    expect(Object.fromEntries(propuestaDePresupuesto(movs, categorias, '2027-01'))).toEqual({
      comida: 30000,
    });
  });
});

describe('disponible del mes', () => {
  it('caso de comprobación: 368,00 € y 26,28 € al día', () => {
    const d = disponibleDelMes(110000, 68700, 4500, '2026-11', HOY);
    expect(d.disponible).toBe(36800);
    expect(d.diasQueQuedan).toBe(14);
    expect(d.porDia).toBe(2628);
    expect(d.exceso).toBe(0);
  });

  it('si el fijo se confirma por 45,00 € el disponible sigue en 368,00 €', () => {
    const fijo = regla('gimnasio', { diaDelMes: 18, importe: 4500 });
    const variables = [mov({ importe: 68700, fecha: '2026-11-10' })];
    const gasto = (movs: Mov[]) =>
      movs.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.importe, 0);
    const antes = fijosPendientes(pendientesDelMes([fijo], variables, '2026-11', HOY));
    expect(antes).toBe(4500);
    expect(disponibleDelMes(110000, gasto(variables), antes, '2026-11', HOY).disponible).toBe(
      36800,
    );

    const conConfirmado = [
      ...variables,
      mov({ importe: 4500, reglaRecurrenteId: 'gimnasio', fecha: '2026-11-18' }),
    ];
    const despues = fijosPendientes(pendientesDelMes([fijo], conConfirmado, '2026-11', HOY));
    expect(despues).toBe(0);
    expect(gasto(conConfirmado)).toBe(73200);
    expect(disponibleDelMes(110000, gasto(conConfirmado), despues, '2026-11', HOY).disponible).toBe(
      36800,
    );
  });

  it('los ingresos y las aportaciones pendientes no restan del disponible', () => {
    const reglas = [
      regla('nomina', { clase: 'ingreso', tipoMovimiento: 'ingreso', importe: 190000 }),
      regla('ahorro', { clase: 'aportacion', tipoMovimiento: 'transferencia', importe: 20000 }),
      regla('luz', { importe: 6000 }),
    ];
    expect(fijosPendientes(pendientesDelMes(reglas, [], '2026-11', HOY))).toBe(6000);
  });

  it('disponible negativo: se informa del exceso y el importe por día es 0', () => {
    const d = disponibleDelMes(100000, 120000, 5000, '2026-11', HOY);
    expect(d).toMatchObject({ disponible: -25000, exceso: 25000, porDia: 0, avance: 100 });
  });

  it('el último día del mes queda 1 día', () => {
    const d = disponibleDelMes(100000, 90000, 0, '2026-11', '2026-11-30');
    expect(d).toMatchObject({ diasQueQuedan: 1, porDia: 10000 });
  });

  it('redondea el importe por día hacia abajo y nunca reparte más de lo disponible', () => {
    const d = disponibleDelMes(100, 0, 0, '2026-11', '2026-11-28');
    expect(d).toMatchObject({ diasQueQuedan: 3, porDia: 33 });
    expect(d.porDia * d.diasQueQuedan).toBeLessThanOrEqual(d.disponible);
  });

  it('en un mes pasado no quedan días y en uno futuro quedan todos', () => {
    expect(diasQueQuedan('2026-10', HOY)).toBe(0);
    expect(diasQueQuedan('2026-12', HOY)).toBe(31);
    expect(disponibleDelMes(100000, 40000, 0, '2026-10', HOY)).toMatchObject({
      disponible: 60000,
      porDia: 0,
    });
  });

  it('el avance va de 0 a 100 y admite presupuesto cero', () => {
    expect(disponibleDelMes(100000, 25000, 25000, '2026-11', HOY).avance).toBe(50);
    expect(disponibleDelMes(0, 0, 0, '2026-11', HOY).avance).toBe(0);
    expect(disponibleDelMes(0, 1, 0, '2026-11', HOY).avance).toBe(100);
  });
});

describe('previsión de fin de mes', () => {
  const banco = {
    id: 'banco',
    tipo: 'banco' as const,
    saldoInicial: 234000,
    fechaSaldoInicial: '2026-01-01',
  };
  const cartera = {
    id: 'cartera',
    tipo: 'efectivo' as const,
    saldoInicial: 0,
    fechaSaldoInicial: '2026-01-01',
  };
  const broker = {
    id: 'broker',
    tipo: 'inversion' as const,
    saldoInicial: 500000,
    fechaSaldoInicial: '2026-01-01',
  };
  const pendiente = (r: ReglaRecurrente) => ({ regla: r, estado: 'proximo' as const });

  it('caso de comprobación: 2.890,00 €', () => {
    // 340 € de gasto variable en 17 días: 20 € al día. El saldo queda en 2 000 €.
    const movs = [mov({ importe: 34000, fecha: '2026-11-03' })];
    const p = previsionDeFinDeMes(
      [banco, broker],
      movs,
      [
        pendiente(regla('alquiler', { importe: 30000 })),
        pendiente(regla('luz', { importe: 5000 })),
        pendiente(
          regla('nomina', { clase: 'ingreso', tipoMovimiento: 'ingreso', importe: 150000 }),
        ),
      ],
      HOY,
    );
    expect(p).toEqual({
      saldoActual: 200000,
      gastosPendientes: 35000,
      ingresosPendientes: 150000,
      aportacionesPendientes: 0,
      gastoVariableDiario: 2000,
      diasQueQuedan: 13,
      gastoVariablePrevisto: 26000,
      previsto: 289000,
    });
  });

  it('una aportación pendiente hacia inversión resta; entre banco y efectivo no cambia el total', () => {
    const aInversion = regla('fondo', {
      clase: 'aportacion',
      tipoMovimiento: 'transferencia',
      importe: 20000,
      cuentaDestinoId: 'broker',
    });
    const aCartera = { ...aInversion, id: 'efectivo', cuentaDestinoId: 'cartera' };
    const desdeInversion = {
      ...aInversion,
      id: 'venta',
      cuentaId: 'broker',
      cuentaDestinoId: 'banco',
    };
    const cuentas = [banco, cartera, broker];
    const con = (r: ReglaRecurrente) => previsionDeFinDeMes(cuentas, [], [pendiente(r)], HOY);
    expect(con(aInversion)).toMatchObject({ aportacionesPendientes: 20000, previsto: 214000 });
    expect(con(aCartera)).toMatchObject({ aportacionesPendientes: 0, previsto: 234000 });
    expect(con(desdeInversion)).toMatchObject({ aportacionesPendientes: -20000, previsto: 254000 });
  });

  it('las ocurrencias confirmadas y los gastos con regla no cuentan dos veces', () => {
    const movs = [
      mov({ importe: 30000, reglaRecurrenteId: 'alquiler', fecha: '2026-11-01' }),
      mov({ importe: 1700, fecha: '2026-11-02' }),
    ];
    const p = previsionDeFinDeMes(
      [banco],
      movs,
      [{ regla: regla('alquiler', { importe: 30000 }), estado: 'confirmada' }],
      HOY,
    );
    expect(p.gastosPendientes).toBe(0);
    // Solo el gasto sin regla marca el ritmo: 17 € en 17 días.
    expect(p.gastoVariableDiario).toBe(100);
    expect(p.previsto).toBe(234000 - 31700 - 1300);
  });

  it('el primer día del mes divide entre 1 día transcurrido', () => {
    const p = previsionDeFinDeMes(
      [banco],
      [mov({ importe: 1000, fecha: '2026-11-01' })],
      [],
      '2026-11-01',
    );
    expect(p).toMatchObject({
      gastoVariableDiario: 1000,
      diasQueQuedan: 29,
      gastoVariablePrevisto: 29000,
    });
  });

  it('el último día del mes no queda nada que prever', () => {
    const p = previsionDeFinDeMes([banco], [mov({ importe: 3000 })], [], '2026-11-30');
    expect(p).toMatchObject({ diasQueQuedan: 0, gastoVariablePrevisto: 0, previsto: 231000 });
    const linea = lineaDePrevision([banco], [], p.previsto, '2026-11-30');
    expect(linea.real).toHaveLength(30);
    expect(linea.estimado).toHaveLength(1);
  });

  it('no cuenta gastos de otros meses, borrados ni posteriores a hoy', () => {
    const movs = [
      mov({ importe: 9000, fecha: '2026-10-31' }),
      mov({ importe: 9000, fecha: '2026-11-20' }),
      mov({ importe: 9000, borradoEn: '2026-11-11T00:00Z' }),
      mov({ tipo: 'ingreso', importe: 9000 }),
    ];
    expect(previsionDeFinDeMes([banco], movs, [], HOY).gastoVariableDiario).toBe(0);
  });

  it('el saldo disponible ignora las cuentas de inversión', () => {
    const movs: MovimientoDeCuenta[] = [
      mov({
        tipo: 'transferencia',
        importe: 10000,
        cuentaDestinoId: 'broker',
        fecha: '2026-11-05',
      }),
    ];
    expect(saldoDisponibleEn([banco, cartera, broker], movs, '2026-11-04')).toBe(234000);
    expect(saldoDisponibleEn([banco, cartera, broker], movs, HOY)).toBe(224000);
  });

  it('la línea da el saldo real de cada día hasta hoy y una recta hasta lo previsto', () => {
    const movs = [mov({ importe: 4000, fecha: '2026-11-03' })];
    const linea = lineaDePrevision([banco], movs, 150000, HOY);
    expect(linea.real).toHaveLength(17);
    expect(linea.real[0]).toEqual({ fecha: '2026-11-01', saldo: 234000 });
    expect(linea.real[16]).toEqual({ fecha: HOY, saldo: 230000 });
    expect(linea.estimado).toEqual([
      { fecha: HOY, saldo: 230000 },
      { fecha: '2026-11-30', saldo: 150000 },
    ]);
  });
});

describe('objetivos', () => {
  const viaje = { id: 'viaje', meta: 150000, fechaLimite: '2027-07-31' };
  const aporta = (importe: number, borradoEn: string | null = null, objetivoId = 'viaje') => ({
    objetivoId,
    importe,
    borradoEn,
  });

  it('caso de comprobación: 8 meses y 125,00 € al mes', () => {
    const e = estadoDeObjetivo(viaje, [aporta(30000), aporta(20000)], HOY);
    expect(e).toEqual({
      aportado: 50000,
      falta: 100000,
      avance: 33,
      situacion: 'en_curso',
      mesesRestantes: 8,
      necesarioAlMes: 12500,
    });
  });

  it('el aportado suma las aportaciones no borradas de ese objetivo', () => {
    const lista = [aporta(100), aporta(200, '2026-11-01T00:00Z'), aporta(400, null, 'otro')];
    expect(aportadoA('viaje', lista)).toBe(100);
  });

  it('redondea el necesario hacia arriba para no quedarse corto', () => {
    const e = estadoDeObjetivo({ id: 'viaje', meta: 100000, fechaLimite: '2027-02-10' }, [], HOY);
    expect(e.mesesRestantes).toBe(3);
    expect(e.necesarioAlMes).toBe(33334);
    expect((e.necesarioAlMes ?? 0) * 3).toBeGreaterThanOrEqual(100000);
  });

  it('sin fecha límite no hay ritmo', () => {
    const e = estadoDeObjetivo(
      { id: 'viaje', meta: 150000, fechaLimite: null },
      [aporta(100)],
      HOY,
    );
    expect(e).toMatchObject({ situacion: 'sin_fecha', mesesRestantes: null, necesarioAlMes: null });
  });

  it('con la fecha límite este mismo mes queda 1 mes', () => {
    const e = estadoDeObjetivo({ id: 'viaje', meta: 150000, fechaLimite: '2026-11-30' }, [], HOY);
    expect(e).toMatchObject({ situacion: 'en_curso', mesesRestantes: 1, necesarioAlMes: 150000 });
    expect(mesesHasta(HOY, HOY)).toBe(1);
    expect(mesesHasta('2027-01-01', HOY)).toBe(2);
  });

  it('con el plazo vencido sin conseguir no hay ritmo', () => {
    const e = estadoDeObjetivo({ id: 'viaje', meta: 150000, fechaLimite: '2026-11-16' }, [], HOY);
    expect(e).toMatchObject({ situacion: 'plazo_vencido', necesarioAlMes: null });
  });

  it('con lo aportado igual o mayor que la meta está conseguido, con tope del 100 %', () => {
    const justo = estadoDeObjetivo(viaje, [aporta(150000)], HOY);
    expect(justo).toMatchObject({
      situacion: 'conseguido',
      avance: 100,
      falta: 0,
      necesarioAlMes: null,
    });
    const pasado = estadoDeObjetivo({ ...viaje, fechaLimite: '2020-01-01' }, [aporta(999999)], HOY);
    expect(pasado).toMatchObject({ situacion: 'conseguido', avance: 100, falta: 0 });
  });

  it('no enseña un 100 % hasta llegar de verdad', () => {
    expect(estadoDeObjetivo(viaje, [aporta(149999)], HOY).avance).toBe(99);
  });

  it('admite una meta de más de un millón y una aportación de un céntimo', () => {
    const e = estadoDeObjetivo(
      { id: 'viaje', meta: 123456789, fechaLimite: '2027-11-30' },
      [aporta(1)],
      HOY,
    );
    expect(e.avance).toBe(0);
    expect(e.mesesRestantes).toBe(12);
    expect(e.necesarioAlMes).toBe(10288066);
  });
});
