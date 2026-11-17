import {
  ACCION_ANADIR_GASTO,
  ACCION_REGISTRAR_PAGO,
  categoriaDelComercio,
  cuentaDeLaTarjeta,
  esDuplicada,
  extraerImporte,
  gastoDeLaInvocacion,
  limpiarTexto,
  loQueFalta,
  normalizarComercio,
  normalizarTarjeta,
  origenDelMovimiento,
  pagoDeLaInvocacion,
  seGuardaConUnToque,
} from '../captura';

describe('extracción de importe y divisa (T-031)', () => {
  it.each([
    ['23,40 €', 2340, 'EUR'],
    ['€23.40', 2340, 'EUR'],
    ['23.40', 2340, null],
    ['1.234,56 €', 123456, 'EUR'],
    ['1,234.56', 123456, null],
    ['EUR 5', 500, 'EUR'],
    ['5', 500, null],
    ['23,4 €', 2340, 'EUR'],
    ['0,01 €', 1, 'EUR'],
    ['1.234.567,89 €', 123456789, 'EUR'],
    ['1,234,567.89', 123456789, null],
    ['1.234.567 €', 123456700, 'EUR'],
    ['  23,40 €  ', 2340, 'EUR'],
    ['$12.50', 1250, 'USD'],
    ['12,50 usd', 1250, 'USD'],
    ['£3', 300, 'GBP'],
    ['23,40 CHF', 2340, 'CHF'],
    ['€ 23,40 EUR', 2340, 'EUR'],
  ])('«%s» da %i céntimos y divisa %s', (texto, importe, divisa) => {
    expect(extraerImporte(texto)).toEqual({ importe, divisa });
  });

  it.each([
    ['', 'vacío'],
    ['   ', 'solo espacios'],
    ['€', 'solo el símbolo'],
    ['EUR', 'solo el código'],
    ['sin importe', 'sin números'],
    ['23,40 € 12,00 €', 'dos números'],
    ['2 x 5,00 €', 'dos números con texto'],
    ['1.234', 'miles o decimales, no se sabe'],
    ['1,234 €', 'miles o decimales, no se sabe'],
    ['-5,00 €', 'negativo'],
    ['−5,00 €', 'negativo con signo tipográfico'],
    ['0,00 €', 'cero'],
    ['0', 'cero'],
    ['12,345,67', 'separadores incoherentes'],
    ['1.23.456,00', 'grupos de miles mal formados'],
    ['23,456 €', 'tres decimales'],
    ['23,', 'acaba en separador'],
    [',50', 'empieza en separador'],
    ['$5 €', 'dos divisas'],
    ['5 EUR USD', 'dos códigos'],
    ['23,40 euros', 'palabra que no es un código'],
    ['99999999999999', 'desmesurado'],
  ])('«%s» (%s) queda sin importe', (texto) => {
    expect(extraerImporte(texto)).toBeNull();
  });
});

describe('limpieza de textos', () => {
  it('recorta a 200 caracteres sin partir emojis y trata lo que no es texto como vacío', () => {
    expect(limpiarTexto('  Café Ñandú 🥐  ')).toBe('Café Ñandú 🥐');
    expect(limpiarTexto('a'.repeat(300))).toHaveLength(200);
    const emojis = limpiarTexto('🥐'.repeat(300));
    expect([...emojis]).toHaveLength(200);
    expect(emojis.endsWith('🥐')).toBe(true);
    for (const raro of [undefined, null, 12, {}, []]) expect(limpiarTexto(raro)).toBe('');
  });
});

describe('tarjeta a cuenta (T-032, docs/04 A.4)', () => {
  const cuenta = (id: string, tipo: 'banco' | 'efectivo' | 'inversion' = 'banco', extra = {}) => ({
    id,
    tipo,
    archivada: false,
    borradoEn: null,
    ...extra,
  });
  const alias = (texto: string, cuentaId: string, borradoEn: string | null = null) => ({
    texto,
    cuentaId,
    borradoEn,
  });

  it('normaliza: sin espacios en los extremos, minúsculas y sin acentos', () => {
    expect(normalizarTarjeta('  Tarjeta DÉBITO Ñ  ')).toBe('tarjeta debito n');
    // Los espacios interiores se respetan en la tarjeta y se unen en el comercio.
    expect(normalizarTarjeta('Visa  Oro')).toBe('visa  oro');
    expect(normalizarComercio('  Mercado   CENTRAL  ')).toBe('mercado central');
  });

  it('con coincidencia exacta del alias lleva esa cuenta', () => {
    const cuentas = [cuenta('a'), cuenta('b')];
    const lista = [alias('visa oro', 'b')];
    expect(cuentaDeLaTarjeta('  Visa ORO ', lista, cuentas)).toEqual({
      cuentaId: 'b',
      sugerida: false,
    });
  });

  it('no usa coincidencia aproximada', () => {
    const cuentas = [cuenta('a'), cuenta('b')];
    const lista = [alias('visa oro', 'b')];
    for (const parecido of ['visa', 'visa oro 2', 'visaoro', 'visa  oro']) {
      expect(cuentaDeLaTarjeta(parecido, lista, cuentas).cuentaId).toBeNull();
    }
  });

  it('tarjeta desconocida con una sola cuenta de banco: se propone, como sugerida', () => {
    const cuentas = [cuenta('banco'), cuenta('cartera', 'efectivo'), cuenta('broker', 'inversion')];
    expect(cuentaDeLaTarjeta('Desconocida', [], cuentas)).toEqual({
      cuentaId: 'banco',
      sugerida: true,
    });
  });

  it('tarjeta desconocida con dos cuentas de banco, o con ninguna: sin cuenta', () => {
    expect(cuentaDeLaTarjeta('Desconocida', [], [cuenta('a'), cuenta('b')])).toEqual({
      cuentaId: null,
      sugerida: false,
    });
    expect(cuentaDeLaTarjeta('Desconocida', [], [cuenta('c', 'efectivo')]).cuentaId).toBeNull();
    expect(cuentaDeLaTarjeta('Desconocida', [], []).cuentaId).toBeNull();
  });

  it('con la tarjeta vacía aplica la misma regla de una o varias cuentas', () => {
    expect(cuentaDeLaTarjeta('', [alias('', 'b')], [cuenta('a')])).toEqual({
      cuentaId: 'a',
      sugerida: true,
    });
    expect(cuentaDeLaTarjeta('  ', [], [cuenta('a'), cuenta('b')]).cuentaId).toBeNull();
  });

  it('un alias cuya cuenta se archivó o se borró no cuenta', () => {
    const lista = [alias('visa oro', 'vieja')];
    const archivada = [cuenta('vieja', 'banco', { archivada: true }), cuenta('a'), cuenta('b')];
    expect(cuentaDeLaTarjeta('Visa Oro', lista, archivada).cuentaId).toBeNull();
    // Si tras archivarla queda una sola cuenta de banco, se propone esa.
    const unaSola = [cuenta('vieja', 'banco', { archivada: true }), cuenta('a')];
    expect(cuentaDeLaTarjeta('Visa Oro', lista, unaSola)).toEqual({
      cuentaId: 'a',
      sugerida: true,
    });
    const borrada = [cuenta('vieja', 'banco', { borradoEn: 'x' }), cuenta('a'), cuenta('b')];
    expect(cuentaDeLaTarjeta('Visa Oro', lista, borrada).cuentaId).toBeNull();
  });

  it('un alias borrado no cuenta', () => {
    const cuentas = [cuenta('a'), cuenta('b')];
    expect(
      cuentaDeLaTarjeta('Visa Oro', [alias('visa oro', 'b', 'x')], cuentas).cuentaId,
    ).toBeNull();
  });
});

describe('comercio a categoría (T-033)', () => {
  const categoria = (id: string, extra = {}) => ({
    id,
    tipo: 'gasto' as const,
    archivada: false,
    borradoEn: null,
    ...extra,
  });
  const regla = (comercio: string, categoriaId: string, borradoEn: string | null = null) => ({
    comercio,
    categoriaId,
    borradoEn,
  });

  it('propone la categoría recordada, sin distinguir mayúsculas, acentos ni espacios', () => {
    const reglas = [regla('mercado central', 'comida')];
    expect(categoriaDelComercio(' MERCADO   Céntral ', reglas, [categoria('comida')])).toBe(
      'comida',
    );
  });

  it('sin regla, con el comercio vacío o con otro comercio no propone nada', () => {
    const reglas = [regla('mercado central', 'comida')];
    const categorias = [categoria('comida')];
    expect(categoriaDelComercio('Mercado', reglas, categorias)).toBeNull();
    expect(categoriaDelComercio('', reglas, categorias)).toBeNull();
    expect(categoriaDelComercio('Mercado Central', [], categorias)).toBeNull();
  });

  it('una categoría que luego se archiva, se borra o no es de gasto no se propone', () => {
    const reglas = [regla('mercado central', 'comida')];
    for (const extra of [{ archivada: true }, { borradoEn: 'x' }, { tipo: 'ingreso' as const }]) {
      expect(
        categoriaDelComercio('Mercado Central', reglas, [categoria('comida', extra)]),
      ).toBeNull();
    }
    expect(categoriaDelComercio('Mercado Central', reglas, [])).toBeNull();
    expect(
      categoriaDelComercio(
        'Mercado Central',
        [regla('mercado central', 'comida', 'x')],
        [categoria('comida')],
      ),
    ).toBeNull();
  });

  it('admite comercios con emojis y con acentos', () => {
    expect(normalizarComercio('  Café ☕ Ñandú ')).toBe('cafe ☕ nandu');
    const reglas = [regla('cafe ☕ nandu', 'ocio')];
    expect(categoriaDelComercio('CAFÉ ☕ ñandú', reglas, [categoria('ocio')])).toBe('ocio');
  });
});

describe('duplicados (T-034)', () => {
  const BASE = Date.parse('2026-11-17T10:00:00.000Z');
  const captura = (minutos: number, extra = {}) => ({
    recibidaEn: new Date(BASE + minutos * 60_000).toISOString(),
    importe: 2340,
    cuentaId: 'banco',
    estado: 'pendiente' as const,
    borradoEn: null,
    ...extra,
  });

  it('dos capturas iguales a 9 minutos son la misma; a 11, no', () => {
    expect(esDuplicada(captura(9), [captura(0)])).toBe(true);
    expect(esDuplicada(captura(11), [captura(0)])).toBe(false);
    // El límite de 10 minutos exactos queda fuera.
    expect(esDuplicada(captura(10), [captura(0)])).toBe(false);
    // También si la segunda entrada tiene una hora anterior.
    expect(esDuplicada(captura(-9), [captura(0)])).toBe(true);
  });

  it('con distinto importe o distinta cuenta no es duplicada', () => {
    expect(esDuplicada(captura(1, { importe: 2341 }), [captura(0)])).toBe(false);
    expect(esDuplicada(captura(1, { cuentaId: 'otra' }), [captura(0)])).toBe(false);
    expect(esDuplicada(captura(1, { cuentaId: null }), [captura(0)])).toBe(false);
    // Dos capturas sin cuenta y con el mismo importe sí lo son.
    expect(esDuplicada(captura(1, { cuentaId: null }), [captura(0, { cuentaId: null })])).toBe(
      true,
    );
  });

  it('sin importe no se compara', () => {
    expect(esDuplicada(captura(1, { importe: null }), [captura(0, { importe: null })])).toBe(false);
  });

  it('se compara con las pendientes y las guardadas, no con descartadas, duplicadas ni borradas', () => {
    expect(esDuplicada(captura(1), [captura(0, { estado: 'guardada' })])).toBe(true);
    expect(esDuplicada(captura(1), [captura(0, { estado: 'descartada' })])).toBe(false);
    expect(esDuplicada(captura(1), [captura(0, { estado: 'duplicada' })])).toBe(false);
    expect(esDuplicada(captura(1), [captura(0, { borradoEn: 'x' })])).toBe(false);
    expect(esDuplicada(captura(1), [])).toBe(false);
  });
});

describe('guardar con un toque', () => {
  const completa = {
    estado: 'pendiente' as const,
    importe: 2340,
    cuentaId: 'banco',
    categoriaId: 'comida',
  };

  it('solo con importe, cuenta y categoría', () => {
    expect(seGuardaConUnToque(completa)).toBe(true);
    expect(loQueFalta(completa)).toEqual([]);
    expect(loQueFalta({ importe: null, cuentaId: null, categoriaId: null })).toEqual([
      'importe',
      'cuenta',
      'categoria',
    ]);
    expect(seGuardaConUnToque({ ...completa, importe: null })).toBe(false);
    expect(seGuardaConUnToque({ ...completa, cuentaId: null })).toBe(false);
    expect(seGuardaConUnToque({ ...completa, categoriaId: null })).toBe(false);
    expect(seGuardaConUnToque({ ...completa, importe: 0 })).toBe(false);
  });

  it('solo si está pendiente', () => {
    for (const estado of ['guardada', 'descartada', 'duplicada'] as const) {
      expect(seGuardaConUnToque({ ...completa, estado })).toBe(false);
    }
  });

  it('el movimiento hereda el origen: notificación o Apple Pay', () => {
    expect(origenDelMovimiento('notificacion')).toBe('notificacion');
    expect(origenDelMovimiento('transaccion')).toBe('apple_pay');
    expect(origenDelMovimiento('prueba')).toBe('apple_pay');
    expect(origenDelMovimiento('manual')).toBe('apple_pay');
  });
});

describe('cola de las acciones de Atajos', () => {
  const AHORA = '2026-11-17T10:00:00.000Z';
  const entrada = (params: Record<string, unknown>, name = ACCION_REGISTRAR_PAGO) => ({
    id: 'cola-1',
    name,
    params,
    createdAt: Date.parse('2026-11-17T09:30:00.000Z'),
  });

  it('convierte una entrada de «Registrar pago» en un pago recibido', () => {
    const pago = pagoDeLaInvocacion(
      entrada({
        importe: ' 23,40 € ',
        comercio: 'Mercado',
        tarjeta: 'Visa',
        origen: 'notificacion',
      }),
      AHORA,
    );
    expect(pago).toEqual({
      idDeCola: 'cola-1',
      recibidaEn: '2026-11-17T09:30:00.000Z',
      origen: 'notificacion',
      importeTexto: '23,40 €',
      comercioTexto: 'Mercado',
      tarjetaTexto: 'Visa',
    });
  });

  it('nunca falla: lo que falta o no es texto queda vacío y un origen raro es una transacción', () => {
    const pago = pagoDeLaInvocacion(
      entrada({ importe: 12, comercio: null, origen: 'raro' }),
      AHORA,
    );
    expect(pago).toMatchObject({
      origen: 'transaccion',
      importeTexto: '',
      comercioTexto: '',
      tarjetaTexto: '',
    });
    const sinNada = pagoDeLaInvocacion(
      { id: 'x', name: ACCION_REGISTRAR_PAGO, params: undefined as never, createdAt: Number.NaN },
      AHORA,
    );
    expect(sinNada).toMatchObject({ idDeCola: 'x', recibidaEn: AHORA, importeTexto: '' });
  });

  it('recorta un comercio de 300 caracteres y admite el origen de prueba', () => {
    const pago = pagoDeLaInvocacion(
      entrada({ comercio: 'x'.repeat(300), origen: 'prueba' }),
      AHORA,
    );
    expect(pago?.comercioTexto).toHaveLength(200);
    expect(pago?.origen).toBe('prueba');
  });

  it('cada acción ignora las entradas de la otra', () => {
    expect(pagoDeLaInvocacion(entrada({}, ACCION_ANADIR_GASTO), AHORA)).toBeNull();
    expect(gastoDeLaInvocacion(entrada({}), AHORA)).toBeNull();
    expect(pagoDeLaInvocacion(entrada({}, 'otra'), AHORA)).toBeNull();
  });

  it('convierte una entrada de «Añadir gasto»', () => {
    const gasto = gastoDeLaInvocacion(
      entrada({ importe: '4,50', categoria: ' Comida ', cuenta: 'Cartera' }, ACCION_ANADIR_GASTO),
      AHORA,
    );
    expect(gasto).toEqual({
      idDeCola: 'cola-1',
      recibidaEn: '2026-11-17T09:30:00.000Z',
      importeTexto: '4,50',
      categoriaTexto: 'Comida',
      cuentaTexto: 'Cartera',
    });
  });
});
