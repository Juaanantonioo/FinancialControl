import {
  avisoDeCapturas,
  avisosDeCobros,
  avisosDeInversion,
  avisosDePresupuesto,
  calcularAvisos,
  claveDePresupuesto,
  diaLocal,
  instanteLocal,
  MAXIMO_DE_AVISOS,
  SIN_AVISOS,
  type DatosParaAvisos,
} from '../avisos';
import type { EstadoDelPresupuesto, LineaConGasto } from '../presupuesto';
import type { ReglaRecurrente } from '../recurrentes';

/** 17/11/2026 a las 8:00, hora local. */
const AHORA = instanteLocal('2026-11-17', 8);
const TODOS = { cobros: true, presupuesto: true, capturas: true, inversion: true };

function regla(id: string, parcial: Partial<ReglaRecurrente> = {}): ReglaRecurrente {
  return {
    id,
    nombre: id,
    clase: 'fijo',
    tipoMovimiento: 'gasto',
    importe: 3500,
    divisa: 'EUR',
    cuentaId: 'banco',
    cuentaDestinoId: null,
    categoriaId: 'ocio',
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
const confirmado = (reglaId: string, fecha: string) => ({
  id: `m-${reglaId}-${fecha}`,
  fecha,
  reglaRecurrenteId: reglaId,
  borradoEn: null,
});
const hora = (instante: number) => {
  const d = new Date(instante);
  return [diaLocal(instante), d.getHours(), d.getMinutes()];
};
const VACIO: DatosParaAvisos = {
  reglas: [],
  movimientos: [],
  presupuesto: null,
  capturas: [],
  cuentas: [],
  valores: [],
  emitidos: [],
};

describe('hora local', () => {
  it('las 9:00 siguen siendo las 9:00 a los dos lados de un cambio de hora', () => {
    // Fechas de cambio de hora en buena parte de Europa y América, en 2026 y 2027.
    for (const fecha of [
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-11-01',
      '2027-03-14',
      '2027-03-28',
    ]) {
      expect(hora(instanteLocal(fecha, 9))).toEqual([fecha, 9, 0]);
    }
  });

  it('un aviso programado antes del cambio de hora sigue cayendo a las 9:00 de su día', () => {
    // Programado el 20 de marzo para un cobro del 30, después del cambio de hora de verano.
    const programadoEl = instanteLocal('2026-03-20', 12);
    const [aviso] = avisosDeCobros([regla('alquiler', { diaDelMes: 30 })], [], programadoEl);
    expect(hora(aviso.instante)).toEqual(['2026-03-30', 9, 0]);
    // Y lo mismo hacia el invierno.
    const enOctubre = instanteLocal('2026-10-20', 12);
    const [otro] = avisosDeCobros([regla('alquiler', { diaDelMes: 30 })], [], enOctubre);
    expect(hora(otro.instante)).toEqual(['2026-10-30', 9, 0]);
  });
});

describe('avisos de cobros próximos (T-066)', () => {
  it('avisa a las 9:00 del día del cobro, o tantos días antes como diga la regla', () => {
    const avisos = avisosDeCobros(
      [regla('gimnasio'), regla('seguro', { diaDelMes: 25, avisoDiasAntes: 3 })],
      [],
      AHORA,
    );
    const deNoviembre = avisos.filter((a) => a.clave.endsWith(':2026-11'));
    expect(deNoviembre.map((a) => [a.clave, ...hora(a.instante)])).toEqual([
      ['cobro:gimnasio:2026-11', '2026-11-18', 9, 0],
      ['cobro:seguro:2026-11', '2026-11-22', 9, 0],
    ]);
    expect(deNoviembre[0]).toMatchObject({
      tipo: 'cobros',
      contenido: { clase: 'cobro', nombre: 'gimnasio', importe: 3500, fecha: '2026-11-18' },
      destino: { ruta: '/cobro', parametros: { reglaId: 'gimnasio', mes: '2026-11' } },
    });
  });

  it('regla del día 31 en un mes de 30, con aviso tres días antes: avisa el 27', () => {
    const avisos = avisosDeCobros(
      [regla('alquiler', { diaDelMes: 31, avisoDiasAntes: 3 })],
      [],
      AHORA,
    );
    expect(avisos.map((a) => hora(a.instante)[0])).toEqual([
      '2026-11-27',
      '2026-12-28',
      '2027-01-28',
    ]);
  });

  it('un aviso cuyo momento ya ha pasado no se programa', () => {
    // El cobro es hoy, pero ya son las 10:00.
    const tarde = instanteLocal('2026-11-18', 10);
    const avisos = avisosDeCobros([regla('gimnasio')], [], tarde);
    expect(avisos.map((a) => a.clave)).toEqual([
      'cobro:gimnasio:2026-12',
      'cobro:gimnasio:2027-01',
    ]);
    // El día 5 ya pasó: solo quedan los de los meses siguientes.
    const pasado = avisosDeCobros([regla('luz', { diaDelMes: 5 })], [], AHORA);
    expect(pasado.map((a) => a.clave)).toEqual(['cobro:luz:2026-12', 'cobro:luz:2027-01']);
    // Justo a las 9:00 en punto tampoco: ya es la hora.
    expect(avisosDeCobros([regla('gimnasio')], [], instanteLocal('2026-11-18', 9))[0].clave).toBe(
      'cobro:gimnasio:2026-12',
    );
  });

  it('un cobro confirmado antes de la hora del aviso deja de avisar', () => {
    const reglas = [regla('gimnasio')];
    expect(avisosDeCobros(reglas, [], AHORA)[0].clave).toBe('cobro:gimnasio:2026-11');
    const movimientos = [confirmado('gimnasio', '2026-11-17')];
    expect(avisosDeCobros(reglas, movimientos, AHORA).map((a) => a.clave)).toEqual([
      'cobro:gimnasio:2026-12',
      'cobro:gimnasio:2027-01',
    ]);
    // Si el movimiento se borra, el aviso vuelve.
    const borrado = [{ ...movimientos[0], borradoEn: '2026-11-17T09:00:00Z' }];
    expect(avisosDeCobros(reglas, borrado, AHORA)[0].clave).toBe('cobro:gimnasio:2026-11');
  });

  it('una regla inactiva, borrada o terminada no avisa', () => {
    const reglas = [
      regla('off', { activa: false }),
      regla('borrada', { borradoEn: 'x' }),
      regla('terminada', { fechaFin: '2026-11-10' }),
    ];
    expect(avisosDeCobros(reglas, [], AHORA)).toEqual([]);
  });

  it('una regla anual solo avisa en su mes', () => {
    const anual = regla('seguro', {
      periodicidad: 'anual',
      fechaInicio: '2026-12-01',
      diaDelMes: 10,
    });
    expect(avisosDeCobros([anual], [], AHORA).map((a) => a.clave)).toEqual([
      'cobro:seguro:2026-12',
    ]);
    const lejana = regla('itv', { periodicidad: 'anual', fechaInicio: '2026-06-01' });
    expect(avisosDeCobros([lejana], [], AHORA)).toEqual([]);
  });
});

describe('avisos de presupuesto (T-067)', () => {
  const linea = (categoriaId: string, previsto: number, real: number): LineaConGasto => ({
    categoriaId,
    previsto,
    real,
    queda: previsto - real,
    porcentaje: previsto > 0 ? Math.round((real * 100) / previsto) : null,
    estado: real > previsto ? 'excedida' : real * 100 >= previsto * 80 ? 'cerca' : 'dentro',
  });
  const estado = (...lineas: LineaConGasto[]): EstadoDelPresupuesto => ({
    presupuestado: 0,
    gastado: 0,
    lineas,
    sinPresupuestar: 0,
    marcaDelDia: null,
  });
  const MES = '2026-11';

  it('avisa una vez al pasar del 80 % y otra al excederse', () => {
    const cerca = avisosDePresupuesto(estado(linea('comida', 10000, 8500)), MES, []);
    expect(cerca).toEqual([
      {
        clave: 'presupuesto:2026-11:comida:80',
        tipo: 'presupuesto',
        contenido: { clase: 'presupuesto_cerca', categoriaId: 'comida', porcentaje: 85 },
        destino: { ruta: '/plan', parametros: { seccion: 'presupuesto', mes: MES } },
        cubre: ['presupuesto:2026-11:comida:80'],
      },
    ]);
    const excedida = avisosDePresupuesto(estado(linea('comida', 10000, 12000)), MES, [
      claveDePresupuesto(MES, 'comida', 80),
    ]);
    expect(excedida).toHaveLength(1);
    expect(excedida[0]).toMatchObject({
      clave: 'presupuesto:2026-11:comida:100',
      contenido: { clase: 'presupuesto_excedido', exceso: 2000 },
    });
  });

  it('una línea que pasa del 80 % dos veces en el mes da un solo aviso', () => {
    const emitidos = [claveDePresupuesto(MES, 'comida', 80)];
    // Baja del 80 % (se borra un gasto) y vuelve a pasar.
    expect(avisosDePresupuesto(estado(linea('comida', 10000, 5000)), MES, emitidos)).toEqual([]);
    expect(avisosDePresupuesto(estado(linea('comida', 10000, 9000)), MES, emitidos)).toEqual([]);
  });

  it('si se excede de golpe da solo el aviso de excedida, que cubre también el del 80 %', () => {
    const [aviso] = avisosDePresupuesto(estado(linea('comida', 10000, 15000)), MES, []);
    expect(aviso.cubre).toEqual([
      'presupuesto:2026-11:comida:100',
      'presupuesto:2026-11:comida:80',
    ]);
    // Ya emitido: si luego baja a «cerca», no llega el del 80 %.
    expect(avisosDePresupuesto(estado(linea('comida', 10000, 9000)), MES, aviso.cubre)).toEqual([]);
  });

  it('cada categoría y cada mes tienen su propio aviso', () => {
    const lineas = estado(
      linea('comida', 10000, 9000),
      linea('ocio', 5000, 4500),
      linea('casa', 9000, 100),
    );
    const emitidos = [claveDePresupuesto(MES, 'comida', 80)];
    expect(avisosDePresupuesto(lineas, MES, emitidos).map((a) => a.clave)).toEqual([
      'presupuesto:2026-11:ocio:80',
    ]);
    expect(avisosDePresupuesto(lineas, '2026-12', emitidos).map((a) => a.clave)).toEqual([
      'presupuesto:2026-12:comida:80',
      'presupuesto:2026-12:ocio:80',
    ]);
  });

  it('sin presupuesto o con todo dentro no hay avisos', () => {
    expect(avisosDePresupuesto(null, MES, [])).toEqual([]);
    expect(avisosDePresupuesto(estado(linea('casa', 9000, 100)), MES, [])).toEqual([]);
  });
});

describe('aviso de capturas sin revisar (T-040)', () => {
  const captura = (id: string, horasAntes: number, extra = {}) => ({
    id,
    recibidaEn: new Date(AHORA - horasAntes * 3_600_000).toISOString(),
    estado: 'pendiente' as const,
    borradoEn: null,
    ...extra,
  });

  it('avisa cuando la pendiente más antigua cumple 24 horas', () => {
    const avisos = avisoDeCapturas([captura('a', 2), captura('b', 20), captura('c', 5)], AHORA);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({
      clave: 'capturas:b',
      tipo: 'capturas',
      contenido: { clase: 'capturas', pendientes: 3 },
      destino: { ruta: '/capturas' },
    });
    expect(avisos[0].instante - AHORA).toBe(4 * 3_600_000);
  });

  it('sin pendientes no hay aviso', () => {
    expect(avisoDeCapturas([], AHORA)).toEqual([]);
    const resueltas = [
      captura('a', 2, { estado: 'guardada' }),
      captura('b', 3, { estado: 'descartada' }),
      captura('c', 4, { estado: 'duplicada' }),
      captura('d', 5, { borradoEn: 'x' }),
    ];
    expect(avisoDeCapturas(resueltas, AHORA)).toEqual([]);
  });

  it('si la más antigua ya pasó de 24 horas no se programa', () => {
    expect(avisoDeCapturas([captura('a', 30), captura('b', 1)], AHORA)).toEqual([]);
  });
});

describe('aviso de valor de inversión antiguo (T-077)', () => {
  const cuenta = (id: string, extra = {}) => ({
    id,
    nombre: id,
    tipo: 'inversion' as const,
    archivada: false,
    borradoEn: null,
    fechaSaldoInicial: '2026-01-01',
    ...extra,
  });
  const valor = (cuentaId: string, fecha: string, borradoEn: string | null = null) => ({
    cuentaId,
    fecha,
    valor: 100000,
    borradoEn,
  });

  it('avisa a las 9:00 del día en que el último valor cumple 30 días', () => {
    const avisos = avisosDeInversion(
      [cuenta('broker')],
      [valor('broker', '2026-10-01'), valor('broker', '2026-11-05')],
      AHORA,
    );
    expect(avisos.map((a) => [a.clave, ...hora(a.instante)])).toEqual([
      ['inversion:broker:2026-11-05', '2026-12-05', 9, 0],
    ]);
    expect(avisos[0].destino).toEqual({ ruta: '/detalle-de-cuenta', parametros: { id: 'broker' } });
  });

  it('sin valores, con el plazo ya cumplido o en una cuenta que no es de inversión no avisa', () => {
    expect(avisosDeInversion([cuenta('broker')], [], AHORA)).toEqual([]);
    expect(avisosDeInversion([cuenta('broker')], [valor('broker', '2026-10-01')], AHORA)).toEqual(
      [],
    );
    expect(
      avisosDeInversion(
        [cuenta('banco', { tipo: 'banco' })],
        [valor('banco', '2026-11-05')],
        AHORA,
      ),
    ).toEqual([]);
    expect(
      avisosDeInversion(
        [cuenta('vieja', { archivada: true })],
        [valor('vieja', '2026-11-05')],
        AHORA,
      ),
    ).toEqual([]);
    // Un valor borrado no cuenta: manda el anterior.
    expect(
      avisosDeInversion(
        [cuenta('broker')],
        [valor('broker', '2026-11-05', 'x'), valor('broker', '2026-10-01')],
        AHORA,
      ),
    ).toEqual([]);
  });
});

describe('cálculo conjunto', () => {
  it('con todos los avisos desactivados no hay ninguno', () => {
    const datos: DatosParaAvisos = {
      ...VACIO,
      reglas: [regla('gimnasio')],
      capturas: [
        {
          id: 'a',
          recibidaEn: new Date(AHORA).toISOString(),
          estado: 'pendiente',
          borradoEn: null,
        },
      ],
    };
    expect(calcularAvisos(datos, SIN_AVISOS, AHORA)).toEqual({ programados: [], inmediatos: [] });
    expect(calcularAvisos(VACIO, TODOS, AHORA)).toEqual({ programados: [], inmediatos: [] });
  });

  it('solo incluye los tipos activados', () => {
    const datos: DatosParaAvisos = {
      ...VACIO,
      reglas: [regla('gimnasio')],
      capturas: [
        {
          id: 'a',
          recibidaEn: new Date(AHORA).toISOString(),
          estado: 'pendiente',
          borradoEn: null,
        },
      ],
    };
    const soloCapturas = calcularAvisos(datos, { ...SIN_AVISOS, capturas: true }, AHORA);
    expect(soloCapturas.programados.map((a) => a.tipo)).toEqual(['capturas']);
  });

  it('con más de 40 candidatos se quedan los 40 más cercanos, en orden', () => {
    const reglas = Array.from({ length: 25 }, (_, i) =>
      regla(`r${i}`, { diaDelMes: (i % 28) + 1 }),
    );
    const todos = avisosDeCobros(reglas, [], AHORA);
    expect(todos.length).toBeGreaterThan(MAXIMO_DE_AVISOS);
    const { programados } = calcularAvisos({ ...VACIO, reglas }, TODOS, AHORA);
    expect(programados).toHaveLength(MAXIMO_DE_AVISOS);
    const instantes = programados.map((a) => a.instante);
    expect([...instantes].sort((x, y) => x - y)).toEqual(instantes);
    const descartados = todos.filter((a) => !programados.some((p) => p.clave === a.clave));
    expect(Math.min(...descartados.map((a) => a.instante))).toBeGreaterThanOrEqual(
      Math.max(...instantes),
    );
    // Las claves no se repiten.
    expect(new Set(programados.map((a) => a.clave)).size).toBe(MAXIMO_DE_AVISOS);
  });

  it('el mismo cálculo con los mismos datos da las mismas claves', () => {
    const datos = { ...VACIO, reglas: [regla('gimnasio'), regla('luz', { diaDelMes: 25 })] };
    const uno = calcularAvisos(datos, TODOS, AHORA).programados.map((a) => a.clave);
    const dos = calcularAvisos(datos, TODOS, AHORA).programados.map((a) => a.clave);
    expect(dos).toEqual(uno);
  });
});
