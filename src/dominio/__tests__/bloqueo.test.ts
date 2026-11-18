/**
 * Bloqueo de la app: reglas puras. «Ahora» entra siempre como parámetro.
 */
import {
  BLOQUEO_MAS_ESTRICTO,
  ESPERAS,
  interpretarBloqueo,
  MILISEGUNDOS_DE_ESPERA,
  SIN_BLOQUEO,
  tocaBloquear,
  TOLERANCIA_ENTRE_RELOJES,
  trasAutenticar,
  type AjustesDeBloqueo,
  type Instante,
} from '@/dominio/bloqueo';

const SALIDA: Instante = { reloj: 1_800_000_000_000, monotono: 50_000 };
/** El instante `ms` milisegundos después de la salida, con los dos relojes de acuerdo. */
const tras = (ms: number): Instante => ({
  reloj: SALIDA.reloj + ms,
  monotono: SALIDA.monotono + ms,
});
const con = (espera: AjustesDeBloqueo['espera']): AjustesDeBloqueo => ({ activo: true, espera });
const SEGUNDO = 1_000;
const MINUTO = 60 * SEGUNDO;

describe('interpretarBloqueo', () => {
  it('sin nada guardado no hay bloqueo: así viene la app', () => {
    expect(interpretarBloqueo(null)).toEqual(SIN_BLOQUEO);
    expect(interpretarBloqueo(undefined)).toEqual(SIN_BLOQUEO);
    expect(SIN_BLOQUEO).toEqual({ activo: false, espera: 'inmediato' });
  });

  it('lee lo que guarda la app', () => {
    for (const espera of ESPERAS) {
      for (const activo of [true, false]) {
        expect(interpretarBloqueo(JSON.stringify({ activo, espera }))).toEqual({ activo, espera });
      }
    }
  });

  it.each([
    ['texto vacío', ''],
    ['texto roto', '{activo:'],
    ['un número', '7'],
    ['null', 'null'],
    ['una lista', '[true]'],
    ['un texto', '"si"'],
    ['activo como texto', '{"activo":"true","espera":"5min"}'],
    ['activo como número', '{"activo":1}'],
    ['sin activo', '{"espera":"5min"}'],
    ['objeto vacío', '{}'],
  ])('preferencia corrupta (%s): el bloqueo más estricto', (_n, texto) => {
    expect(interpretarBloqueo(texto)).toEqual(BLOQUEO_MAS_ESTRICTO);
    expect(BLOQUEO_MAS_ESTRICTO).toEqual({ activo: true, espera: 'inmediato' });
  });

  it('una espera desconocida con el bloqueo activo pasa a ser sin espera', () => {
    for (const espera of ['1h', '', 5, null, 'INMEDIATO', ['5min']]) {
      expect(interpretarBloqueo(JSON.stringify({ activo: true, espera }))).toEqual(
        BLOQUEO_MAS_ESTRICTO,
      );
    }
  });

  it('desactivado de forma explícita sigue desactivado aunque la espera no se entienda', () => {
    expect(interpretarBloqueo('{"activo":false,"espera":"nunca"}')).toEqual(SIN_BLOQUEO);
  });

  it('no devuelve nunca el mismo objeto de las constantes', () => {
    const leido = interpretarBloqueo(null);
    leido.activo = true;
    expect(SIN_BLOQUEO.activo).toBe(false);
  });
});

describe('tocaBloquear', () => {
  it('sin bloqueo activo nunca toca', () => {
    for (const espera of ESPERAS) {
      expect(tocaBloquear({ activo: false, espera }, SALIDA, tras(60 * MINUTO))).toBe(false);
    }
  });

  it('si la app no ha salido a segundo plano no toca', () => {
    for (const espera of ESPERAS) expect(tocaBloquear(con(espera), null, tras(0))).toBe(false);
  });

  it('volver a los 30 segundos: bloquea con «inmediato», no con 1 ni con 5 minutos', () => {
    expect(tocaBloquear(con('inmediato'), SALIDA, tras(30 * SEGUNDO))).toBe(true);
    expect(tocaBloquear(con('1min'), SALIDA, tras(30 * SEGUNDO))).toBe(false);
    expect(tocaBloquear(con('5min'), SALIDA, tras(30 * SEGUNDO))).toBe(false);
  });

  it('«inmediato» bloquea aunque no haya pasado nada de tiempo', () => {
    expect(tocaBloquear(con('inmediato'), SALIDA, tras(0))).toBe(true);
  });

  it('1 minuto: bloquea justo al cumplirse, no un milisegundo antes', () => {
    expect(MILISEGUNDOS_DE_ESPERA['1min']).toBe(MINUTO);
    expect(tocaBloquear(con('1min'), SALIDA, tras(MINUTO - 1))).toBe(false);
    expect(tocaBloquear(con('1min'), SALIDA, tras(MINUTO))).toBe(true);
    expect(tocaBloquear(con('1min'), SALIDA, tras(3 * MINUTO))).toBe(true);
  });

  it('5 minutos: bloquea justo al cumplirse, no un milisegundo antes', () => {
    expect(MILISEGUNDOS_DE_ESPERA['5min']).toBe(5 * MINUTO);
    expect(tocaBloquear(con('5min'), SALIDA, tras(3 * MINUTO))).toBe(false);
    expect(tocaBloquear(con('5min'), SALIDA, tras(5 * MINUTO - 1))).toBe(false);
    expect(tocaBloquear(con('5min'), SALIDA, tras(5 * MINUTO))).toBe(true);
  });

  it('reloj hacia atrás mientras estaba en segundo plano: bloquea', () => {
    for (const espera of ESPERAS) {
      // Pasaron 10 segundos de verdad, pero la hora del iPhone marca una hora menos.
      const ahora = { reloj: SALIDA.reloj - 60 * MINUTO, monotono: SALIDA.monotono + 10 * SEGUNDO };
      expect(tocaBloquear(con(espera), SALIDA, ahora)).toBe(true);
    }
  });

  it('reloj atrasado para aparentar menos tiempo fuera: bloquea', () => {
    // Pasaron 10 minutos de verdad y alguien retrasa la hora para que parezcan 30 segundos.
    const ahora = { reloj: SALIDA.reloj + 30 * SEGUNDO, monotono: SALIDA.monotono + 10 * MINUTO };
    expect(tocaBloquear(con('5min'), SALIDA, ahora)).toBe(true);
    expect(tocaBloquear(con('1min'), SALIDA, ahora)).toBe(true);
    // Aunque el tiempo real también quede dentro de la espera: la hora no cuadra.
    const sospechoso = { reloj: SALIDA.reloj + SEGUNDO, monotono: SALIDA.monotono + 40 * SEGUNDO };
    expect(tocaBloquear(con('5min'), SALIDA, sospechoso)).toBe(true);
  });

  it('un desajuste pequeño entre los dos relojes no bloquea', () => {
    const ahora = {
      reloj: SALIDA.reloj + 30 * SEGUNDO,
      monotono: SALIDA.monotono + 30 * SEGUNDO + TOLERANCIA_ENTRE_RELOJES,
    };
    expect(tocaBloquear(con('1min'), SALIDA, ahora)).toBe(false);
  });

  it('el iPhone durmió: el reloj que no se cambia cuenta de menos y manda la hora', () => {
    // Fuera 10 minutos, de los que el iPhone estuvo despierto 20 segundos.
    const ahora = { reloj: SALIDA.reloj + 10 * MINUTO, monotono: SALIDA.monotono + 20 * SEGUNDO };
    expect(tocaBloquear(con('5min'), SALIDA, ahora)).toBe(true);
    expect(tocaBloquear(con('1min'), SALIDA, ahora)).toBe(true);
  });

  it('reloj adelantado: bloquea, que es lo seguro', () => {
    const ahora = { reloj: SALIDA.reloj + 24 * 60 * MINUTO, monotono: SALIDA.monotono + SEGUNDO };
    expect(tocaBloquear(con('5min'), SALIDA, ahora)).toBe(true);
  });

  it('valores que no son números, o un reloj que retrocede: bloquea', () => {
    const raros: Instante[] = [
      { reloj: Number.NaN, monotono: SALIDA.monotono + SEGUNDO },
      { reloj: SALIDA.reloj + SEGUNDO, monotono: Number.NaN },
      { reloj: Number.POSITIVE_INFINITY, monotono: SALIDA.monotono },
      { reloj: SALIDA.reloj + SEGUNDO, monotono: SALIDA.monotono - 5 },
      { reloj: undefined as never, monotono: undefined as never },
    ];
    for (const ahora of raros) expect(tocaBloquear(con('5min'), SALIDA, ahora)).toBe(true);
    expect(tocaBloquear(con('5min'), { reloj: Number.NaN, monotono: 0 }, tras(SEGUNDO))).toBe(true);
  });

  it('una espera que no existe se trata como sin espera', () => {
    expect(tocaBloquear({ activo: true, espera: 'nunca' as never }, SALIDA, tras(SEGUNDO))).toBe(
      true,
    );
  });
});

describe('trasAutenticar', () => {
  it('solo una autenticación correcta abre la app', () => {
    for (const capacidad of ['ninguna', 'codigo', 'biometria'] as const) {
      expect(trasAutenticar('correcto', capacidad)).toBe('entrar');
    }
  });

  it('fallida o cancelada: sigue bloqueada, tenga lo que tenga el iPhone', () => {
    for (const capacidad of ['ninguna', 'codigo', 'biometria'] as const) {
      expect(trasAutenticar('fallido', capacidad)).toBe('seguir_bloqueada');
      expect(trasAutenticar('cancelado', capacidad)).toBe('seguir_bloqueada');
    }
  });

  it('iPhone sin código ni biometría: se entra, avisando de que no hay protección', () => {
    expect(trasAutenticar('no_disponible', 'ninguna')).toBe('entrar_sin_proteccion');
  });

  it('biometría desactivada en el sistema pero con código: sigue bloqueada hasta autenticarse', () => {
    expect(trasAutenticar('no_disponible', 'codigo')).toBe('seguir_bloqueada');
    expect(trasAutenticar('no_disponible', 'biometria')).toBe('seguir_bloqueada');
  });
});
