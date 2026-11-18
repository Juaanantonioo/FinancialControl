/**
 * Validación de entradas externas: parámetros de ruta y textos de Atajos.
 */
import {
  esId,
  esRutaDeAviso,
  ID_INEXISTENTE,
  leerParametros,
  limpiarTextoExterno,
  LONGITUD_MAXIMA_DE_PARAMETRO,
  textoDeParametro,
} from '@/dominio/entradas';
import { HOSTILES, UUID_DE_EJEMPLO as UUID } from '@/pruebas/hostiles';

describe('textoDeParametro', () => {
  it('acepta un texto corto', () => {
    expect(textoDeParametro('abc')).toBe('abc');
    expect(textoDeParametro('a'.repeat(LONGITUD_MAXIMA_DE_PARAMETRO))).toHaveLength(200);
  });
  it('rechaza lo vacío, lo ausente, lo desmesurado y lo repetido', () => {
    expect(textoDeParametro('')).toBeNull();
    expect(textoDeParametro(undefined)).toBeNull();
    expect(textoDeParametro(null)).toBeNull();
    expect(textoDeParametro('a'.repeat(201))).toBeNull();
    expect(textoDeParametro(['a', 'b'])).toBeNull();
    expect(textoDeParametro(7)).toBeNull();
  });
});

describe('identificadores', () => {
  it('esId solo acepta un UUID completo', () => {
    expect(esId(UUID)).toBe(true);
    expect(esId(UUID.toUpperCase())).toBe(true);
    expect(esId(ID_INEXISTENTE)).toBe(true);
    for (const [, valor] of HOSTILES) expect(esId(valor)).toBe(false);
  });

  it('id: válido pasa, ausente o vacío es null', () => {
    expect(leerParametros({ id: UUID }, { id: 'id' })).toEqual({ id: UUID });
    expect(leerParametros({}, { id: 'id' })).toEqual({ id: null });
    expect(leerParametros({ id: '' }, { id: 'id' })).toEqual({ id: null });
    expect(leerParametros(undefined, { id: 'id' })).toEqual({ id: null });
    expect(leerParametros(null, { id: 'id' })).toEqual({ id: null });
  });

  it.each(HOSTILES)('id malformado (%s) pasa a ser el identificador que no existe', (_n, valor) => {
    expect(leerParametros({ id: valor }, { id: 'id' })).toEqual({ id: ID_INEXISTENTE });
  });

  it.each(HOSTILES)('idOpcional malformado (%s) se ignora', (_n, valor) => {
    expect(leerParametros({ x: valor }, { x: 'idOpcional' })).toEqual({ x: null });
  });

  it('cola: letras, cifras y guiones, hasta 80', () => {
    expect(leerParametros({ c: `prueba-${UUID}` }, { c: 'cola' }).c).toBe(`prueba-${UUID}`);
    expect(leerParametros({ c: 'cola-9' }, { c: 'cola' }).c).toBe('cola-9');
    expect(leerParametros({ c: 'a'.repeat(81) }, { c: 'cola' }).c).toBeNull();
    for (const [, valor] of HOSTILES.filter(([n]) => n !== 'texto' && n !== 'UUID con sufijo')) {
      expect(leerParametros({ c: valor }, { c: 'cola' }).c).toBeNull();
    }
  });
});

describe('meses, días, años, listas y marcas', () => {
  const esquema = {
    mes: 'mes',
    dia: 'dia',
    anio: 'anio',
    seccion: { lista: ['presupuesto', 'fijos', 'objetivos'] },
    peticion: 'marca',
  } as const;

  it('lee los valores con su forma', () => {
    expect(
      leerParametros(
        { mes: '2026-11', dia: '2026-11-18', anio: '2026', seccion: 'fijos', peticion: 'ir-3' },
        esquema,
      ),
    ).toEqual({
      mes: '2026-11',
      dia: '2026-11-18',
      anio: 2026,
      seccion: 'fijos',
      peticion: 'ir-3',
    });
  });

  it('ignora lo que no tiene su forma', () => {
    const vacio = { mes: null, dia: null, anio: null, seccion: null, peticion: null };
    expect(leerParametros({}, esquema)).toEqual(vacio);
    expect(
      leerParametros(
        { mes: '2026-13', dia: '2026-02-31', anio: '1999', seccion: 'Fijos', peticion: 'a b' },
        esquema,
      ),
    ).toEqual(vacio);
    expect(leerParametros({ mes: '2026-1', anio: '2101', seccion: '' }, esquema)).toEqual(vacio);
    expect(leerParametros({ anio: '20261' }, esquema).anio).toBeNull();
    expect(leerParametros({ anio: '2000' }, esquema).anio).toBe(2000);
    expect(leerParametros({ anio: '2100' }, esquema).anio).toBe(2100);
  });

  it.each(HOSTILES)('valor hostil (%s) en mes, día, año y sección: se ignora', (_n, valor) => {
    expect(
      leerParametros({ mes: valor, dia: valor, anio: valor, seccion: valor }, esquema),
    ).toEqual({ mes: null, dia: null, anio: null, seccion: null, peticion: null });
  });

  it('la marca de petición solo admite letras, cifras y guiones, hasta 40', () => {
    const leer = (v: unknown) => leerParametros({ peticion: v }, esquema).peticion;
    expect(leer('ir-12')).toBe('ir-12');
    expect(leer('a'.repeat(41))).toBeNull();
    expect(leer('a;b')).toBeNull();
    expect(leer('a\nb')).toBeNull();
    expect(leer('../a')).toBeNull();
    expect(leer(['a', 'b'])).toBeNull();
  });

  it('un parámetro repetido se ignora aunque sus dos valores sean válidos', () => {
    expect(leerParametros({ mes: ['2026-11', '2026-10'] }, esquema).mes).toBeNull();
    expect(leerParametros({ seccion: ['fijos', 'objetivos'] }, esquema).seccion).toBeNull();
  });

  it('no devuelve claves que no estén en el esquema ni lee propiedades heredadas', () => {
    expect(leerParametros({ mes: '2026-11', otra: 'x' }, { mes: 'mes' })).toEqual({
      mes: '2026-11',
    });
    expect(leerParametros({}, { constructor: { texto: 10 }, toString: 'marca' })).toEqual({
      constructor: null,
      toString: null,
    });
  });

  it('numero: una cantidad escrita, y nada más', () => {
    const leer = (v: unknown) => leerParametros({ n: v }, { n: 'numero' }).n;
    expect(leer('12,50')).toBe('12,50');
    expect(leer('1.234,56')).toBe('1.234,56');
    expect(leer('300')).toBe('300');
    expect(leer('-5')).toBeNull();
    expect(leer('12€')).toBeNull();
    expect(leer('1e9')).toBeNull();
    expect(leer('9'.repeat(30))).toBeNull();
    for (const [, valor] of HOSTILES) expect(leer(valor)).toBeNull();
  });
});

describe('limpiarTextoExterno', () => {
  it('deja intacto un texto normal, con acentos y emojis', () => {
    expect(limpiarTextoExterno('Café Güell 💸', 200)).toBe('Café Güell 💸');
  });

  it('cambia los caracteres de control por un espacio y junta los espacios', () => {
    expect(limpiarTextoExterno('Mercado\n\nna\tCentral\r\n', 200)).toBe('Mercado na Central');
    expect(limpiarTextoExterno('a\u0000b\u0007c\u001Bd\u007Fe\u0085f', 200)).toBe('a b c d e f');
    expect(limpiarTextoExterno('uno\u2028dos\u2029tres', 200)).toBe('uno dos tres');
  });

  it('quita las marcas invisibles de dirección del texto', () => {
    expect(limpiarTextoExterno('pago\u202Eodasrever\u202C', 200)).toBe('pago odasrever');
    expect(limpiarTextoExterno('\u200Fa\u2066b\u2069', 200)).toBe('a b');
  });

  it('recorta a la longitud pedida sin partir un emoji', () => {
    expect(limpiarTextoExterno('a'.repeat(5_000), 200)).toHaveLength(200);
    expect(limpiarTextoExterno('💸'.repeat(300), 200)).toBe('💸'.repeat(200));
    expect(limpiarTextoExterno('ab   cd', 3)).toBe('ab');
  });

  it('lo que no es texto queda vacío', () => {
    for (const valor of [undefined, null, 7, {}, ['a'], true]) {
      expect(limpiarTextoExterno(valor, 200)).toBe('');
    }
    expect(limpiarTextoExterno(' \n\t ', 200)).toBe('');
    expect(limpiarTextoExterno('abc', 0)).toBe('');
  });

  it('texto libre de un parámetro: limpio y acotado', () => {
    const leer = (v: unknown) => leerParametros({ t: v }, { t: { texto: 80 } }).t;
    expect(leer('Ahorro\npara el coche')).toBe('Ahorro para el coche');
    expect(leer('x'.repeat(10_000))).toHaveLength(80);
    expect(leer('\n\n')).toBeNull();
    expect(leer(['a', 'b'])).toBeNull();
  });
});

describe('rutas de aviso', () => {
  it('solo las cuatro pantallas a las que llevan los avisos', () => {
    for (const ruta of ['/cobro', '/plan', '/capturas', '/detalle-de-cuenta']) {
      expect(esRutaDeAviso(ruta)).toBe(true);
    }
    for (const ruta of ['/movimiento', '/', '//evil', '/cobro/../ajustes', 'cobro', '', null, 3]) {
      expect(esRutaDeAviso(ruta)).toBe(false);
    }
  });
});
