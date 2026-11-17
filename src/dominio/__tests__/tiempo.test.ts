import type { Movimiento } from '../modelo';
import { balanceDelMes, conSubcategorias, OTRAS, SIN_CATEGORIA } from '../resumen';
import {
  comparativaConMesAnterior,
  diasDelMes,
  gastoPorDia,
  intensidad,
  resumenDelAnio,
  resumenDiario,
  semanasDelMes,
} from '../tiempo';

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
function mov(parcial: Partial<Mov> & Pick<Mov, 'importe'>): Mov {
  return {
    tipo: 'gasto',
    fecha: '2026-11-10',
    divisa: 'EUR',
    cuentaId: 'banco',
    cuentaDestinoId: null,
    categoriaId: null,
    borradoEn: null,
    ...parcial,
  };
}

describe('días del mes', () => {
  it('febrero bisiesto, meses de 30 y de 31', () => {
    expect(diasDelMes('2028-02')).toBe(29);
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2026-11')).toBe(30);
    expect(diasDelMes('2026-12')).toBe(31);
  });

  it('las semanas empiezan en lunes y rellenan los huecos', () => {
    // Noviembre de 2026 empieza en domingo.
    const noviembre = semanasDelMes('2026-11');
    expect(noviembre[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(noviembre[1][0]).toBe(2);
    expect(noviembre).toHaveLength(6);
    expect(noviembre[5]).toEqual([30, null, null, null, null, null, null]);
    // Febrero de 2027 empieza en lunes y tiene 28 días: cuatro semanas exactas.
    const febrero = semanasDelMes('2027-02');
    expect(febrero).toHaveLength(4);
    expect(febrero[0][0]).toBe(1);
    expect(febrero[3][6]).toBe(28);
    // Todas las semanas tienen siete casillas y están todos los días.
    for (const mes of ['2026-11', '2028-02', '2026-12', '2027-02']) {
      const semanas = semanasDelMes(mes);
      expect(semanas.every((s) => s.length === 7)).toBe(true);
      expect(semanas.flat().filter((d) => d !== null)).toHaveLength(diasDelMes(mes));
    }
  });

  it('la intensidad va de 0 a 4 y solo es 0 sin gasto', () => {
    expect(intensidad(0, 1000)).toBe(0);
    expect(intensidad(1, 123456789)).toBe(1);
    expect(intensidad(250, 1000)).toBe(1);
    expect(intensidad(251, 1000)).toBe(2);
    expect(intensidad(1000, 1000)).toBe(4);
    expect(intensidad(500, 0)).toBe(0);
  });
});

describe('vista por día', () => {
  const movs = [
    mov({ importe: 1000, fecha: '2026-11-01' }),
    mov({ importe: 2500, fecha: '2026-11-10' }),
    mov({ importe: 500, fecha: '2026-11-10' }),
    mov({ tipo: 'ingreso', importe: 200000, fecha: '2026-11-10' }),
    mov({ importe: 700, fecha: '2026-11-17' }),
    mov({ importe: 400, fecha: '2026-11-30' }),
    mov({ tipo: 'transferencia', importe: 9000, cuentaDestinoId: 'x', fecha: '2026-11-10' }),
    mov({ tipo: 'ajuste', importe: -9000, fecha: '2026-11-10' }),
    mov({ importe: 9000, fecha: '2026-11-10', borradoEn: '2026-11-11T00:00:00.000Z' }),
    mov({ importe: 9000, fecha: '2026-10-31' }),
  ];

  it('da una casilla por día con su gasto y su ingreso', () => {
    const dias = gastoPorDia(movs, '2026-11');
    expect(dias).toHaveLength(30);
    expect(dias[9]).toEqual({
      fecha: '2026-11-10',
      dia: 10,
      gasto: 3000,
      ingreso: 200000,
      movimientos: 3,
    });
    expect(dias[1]).toMatchObject({ gasto: 0, ingreso: 0, movimientos: 0 });
    expect(dias[0].gasto).toBe(1000);
    expect(dias[29].gasto).toBe(400);
  });

  it('coherencia: la suma del gasto diario es el gasto del mes', () => {
    const r = resumenDiario(movs, '2026-11', '2026-11-17');
    expect(r.dias.reduce((s, d) => s + d.gasto, 0)).toBe(balanceDelMes(movs, '2026-11').gastos);
    expect(r.dias.reduce((s, d) => s + d.ingreso, 0)).toBe(balanceDelMes(movs, '2026-11').ingresos);
    expect(r.gastoDelMes).toBe(5100);
  });

  it('en el mes en curso la media reparte entre los días transcurridos', () => {
    const r = resumenDiario(movs, '2026-11', '2026-11-17');
    expect(r.diasContados).toBe(17);
    expect(r.mediaDiaria).toBe(300);
    expect(r.gastoDeHoy).toBe(700);
    expect(r.diaDeMayorGasto).toMatchObject({ fecha: '2026-11-10', gasto: 3000 });
  });

  it('hoy es día 1: la media no divide entre cero', () => {
    const r = resumenDiario(movs, '2026-11', '2026-11-01');
    expect(r.diasContados).toBe(1);
    expect(r.mediaDiaria).toBe(5100);
    expect(r.gastoDeHoy).toBe(1000);
  });

  it('en un mes pasado reparte entre todos sus días; en uno futuro no hay media', () => {
    const pasado = resumenDiario(movs, '2026-10', '2026-11-17');
    expect(pasado).toMatchObject({ diasContados: 31, mediaDiaria: 290, gastoDelMes: 9000 });
    // El gasto de hoy es el de hoy aunque se mire otro mes.
    expect(pasado.gastoDeHoy).toBe(700);
    const futuro = resumenDiario(movs, '2026-12', '2026-11-17');
    expect(futuro).toMatchObject({ mediaDiaria: null, diasContados: 0, diaDeMayorGasto: null });
  });

  it('un día con veinte movimientos los suma todos', () => {
    const veinte = Array.from({ length: 20 }, (_, i) => mov({ importe: 100 + i }));
    const dia = gastoPorDia(veinte, '2026-11')[9];
    expect(dia).toMatchObject({ movimientos: 20, gasto: 20 * 100 + 190 });
  });

  it('febrero bisiesto tiene 29 casillas y admite importes grandes', () => {
    const dias = gastoPorDia([mov({ importe: 123456789, fecha: '2028-02-29' })], '2028-02');
    expect(dias).toHaveLength(29);
    expect(dias[28].gasto).toBe(123456789);
  });
});

describe('comparativa con el mes anterior', () => {
  const categorias = [
    { id: 'comida', padreId: null },
    { id: 'super', padreId: 'comida' },
    { id: 'casa', padreId: null },
    { id: 'ocio', padreId: null },
  ];
  const movs = [
    mov({ importe: 30000, categoriaId: 'comida' }),
    mov({ importe: 6000, categoriaId: 'super' }),
    mov({ importe: 40000, categoriaId: 'comida', fecha: '2026-10-10' }),
    mov({ importe: 62000, categoriaId: 'casa' }),
    mov({ importe: 62000, categoriaId: 'casa', fecha: '2026-10-01' }),
    mov({ importe: 5000, categoriaId: 'ocio' }),
    mov({ importe: 1500, fecha: '2026-10-20' }),
  ];

  it('da la diferencia en euros y en porcentaje de cada categoría', () => {
    const c = comparativaConMesAnterior(movs, categorias, '2026-11');
    expect(c.mesAnterior).toBe('2026-10');
    expect(c.lineas).toEqual([
      { clave: 'casa', actual: 62000, anterior: 62000, diferencia: 0, porcentaje: 0, nuevo: false },
      {
        clave: 'comida',
        actual: 36000,
        anterior: 40000,
        diferencia: -4000,
        porcentaje: -10,
        nuevo: false,
      },
      { clave: 'ocio', actual: 5000, anterior: 0, diferencia: 5000, porcentaje: null, nuevo: true },
      {
        clave: SIN_CATEGORIA,
        actual: 0,
        anterior: 1500,
        diferencia: -1500,
        porcentaje: -100,
        nuevo: false,
      },
    ]);
    expect(c.total).toMatchObject({ actual: 103000, anterior: 103500, diferencia: -500 });
  });

  it('enero se compara con diciembre del año anterior', () => {
    expect(comparativaConMesAnterior([], [], '2026-01').mesAnterior).toBe('2025-12');
  });

  it('sin gastos en ninguno de los dos meses no hay líneas', () => {
    const c = comparativaConMesAnterior(movs, categorias, '2027-05');
    expect(c.lineas).toEqual([]);
    expect(c.total).toMatchObject({ actual: 0, anterior: 0, porcentaje: null, nuevo: false });
  });

  it('una categoría con subcategorías las incluye a cualquier nivel', () => {
    const arbol = [...categorias, { id: 'fruta', padreId: 'super' }];
    expect(conSubcategorias(arbol, 'comida').sort()).toEqual(['comida', 'fruta', 'super']);
    expect(conSubcategorias(arbol, 'super').sort()).toEqual(['fruta', 'super']);
    expect(conSubcategorias(arbol, 'casa')).toEqual(['casa']);
    expect(conSubcategorias(arbol, 'no-existe')).toEqual(['no-existe']);
  });
});

describe('vista por año', () => {
  const movs = [
    mov({ tipo: 'ingreso', importe: 200000, fecha: '2026-01-31' }),
    mov({ importe: 80000, fecha: '2026-01-01', categoriaId: 'casa' }),
    mov({ tipo: 'ingreso', importe: 200000, fecha: '2026-03-01' }),
    mov({ importe: 150000, fecha: '2026-03-15', categoriaId: 'casa' }),
    mov({ importe: 20000, fecha: '2026-12-31', categoriaId: 'ocio' }),
    mov({ tipo: 'transferencia', importe: 5000, cuentaDestinoId: 'x', fecha: '2026-06-06' }),
    mov({ importe: 99999, fecha: '2025-12-31' }),
    mov({ importe: 99999, fecha: '2027-01-01' }),
    mov({ importe: 99999, fecha: '2026-05-05', borradoEn: '2026-05-06T00:00:00.000Z' }),
  ];

  it('da los totales, los doce meses, el mayor y el menor gasto y la media', () => {
    const r = resumenDelAnio(movs, [], 2026);
    expect(r).toMatchObject({
      ingresos: 400000,
      gastos: 250000,
      balance: 150000,
      tasaDeAhorro: 38,
      mesesConDatos: 3,
      mediaMensual: 83333,
    });
    expect(r.meses).toHaveLength(12);
    expect(r.meses.map((m) => m.mes)[11]).toBe('2026-12');
    expect(r.mesDeMayorGasto?.mes).toBe('2026-03');
    expect(r.mesDeMenorGasto?.mes).toBe('2026-12');
    // Junio solo tiene una transferencia: no es un mes con datos.
    expect(r.meses[5]).toMatchObject({ movimientos: 0, gastos: 0 });
    expect(r.gastoPorCategoria.partes.map((p) => p.clave)).toEqual(['casa', 'ocio']);
  });

  it('coherencia: la suma de los doce meses es el total del año', () => {
    const r = resumenDelAnio(movs, [], 2026);
    expect(r.meses.reduce((s, m) => s + m.ingresos, 0)).toBe(r.ingresos);
    expect(r.meses.reduce((s, m) => s + m.gastos, 0)).toBe(r.gastos);
    expect(r.meses.reduce((s, m) => s + m.balance, 0)).toBe(r.balance);
    expect(r.gastoPorCategoria.total).toBe(r.gastos);
  });

  it('un año sin movimientos y un año futuro quedan a cero y sin medias', () => {
    for (const anio of [2020, 2031]) {
      expect(resumenDelAnio(movs, [], anio)).toMatchObject({
        ingresos: 0,
        gastos: 0,
        balance: 0,
        tasaDeAhorro: null,
        mesesConDatos: 0,
        mesDeMayorGasto: null,
        mesDeMenorGasto: null,
        mediaMensual: null,
      });
    }
  });

  it('con un solo mes con datos hay mayor gasto pero no menor', () => {
    const r = resumenDelAnio(movs, [], 2025);
    expect(r.mesesConDatos).toBe(1);
    expect(r.mesDeMayorGasto?.mes).toBe('2025-12');
    expect(r.mesDeMenorGasto).toBeNull();
    expect(r.mediaMensual).toBe(99999);
  });

  it('con más de cinco categorías agrupa el resto en Otras', () => {
    const muchas = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) =>
      mov({ importe: (9 - i) * 1000, categoriaId: id, fecha: `2026-0${i + 1}-10` }),
    );
    const partes = resumenDelAnio(muchas, [], 2026).gastoPorCategoria.partes;
    expect(partes.map((p) => p.clave)).toEqual(['a', 'b', 'c', 'd', 'e', OTRAS]);
    expect(partes.reduce((s, p) => s + p.porcentaje, 0)).toBe(100);
  });
});
