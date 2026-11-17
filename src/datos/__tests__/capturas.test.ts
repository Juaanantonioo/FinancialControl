import { crearRepositorios } from '@/datos';
import { MIGRACIONES, migrar, versionDelEsquema } from '@/datos/migraciones';
import {
  crearBdDePrueba,
  crearEntornoDePrueba,
  esperarError,
  prepararPrueba,
} from '@/pruebas/bdDePrueba';

const T0 = Date.parse('2026-11-15T12:00:00.000Z');
const a = (minutos: number) => new Date(T0 + minutos * 60_000).toISOString();

async function preparar() {
  const t = await prepararPrueba([
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Ocio', tipo: 'gasto' },
    { nombre: 'Nómina', tipo: 'ingreso' },
  ]);
  const banco = await t.cuentas.crear({
    nombre: 'Banco',
    tipo: 'banco',
    saldoInicial: 100000,
    fechaSaldoInicial: '2026-01-01',
  });
  const cartera = await t.cuentas.crear({
    nombre: 'Cartera',
    tipo: 'efectivo',
    saldoInicial: 0,
    fechaSaldoInicial: '2026-01-01',
  });
  const categorias = await t.categorias.listar();
  const cat = (nombre: string) => categorias.find((c) => c.nombre === nombre)!.id;
  const pago = (extra: Partial<Parameters<typeof t.capturas.registrar>[0]> = {}) =>
    t.capturas.registrar({
      origen: 'transaccion',
      recibidaEn: a(0),
      importeTexto: '23,40 €',
      comercioTexto: 'Mercado Central',
      tarjetaTexto: 'Visa Oro',
      ...extra,
    });
  return { ...t, banco, cartera, cat, pago };
}

describe('migración 4: capturas y avisos', () => {
  it('una base de datos en versión 3 con datos pasa a la 4 sin perder ni alterar nada', async () => {
    const bd = crearBdDePrueba();
    await bd.ejecutar('PRAGMA foreign_keys = ON');
    await migrar(
      bd,
      MIGRACIONES.filter((m) => m.version <= 3),
    );
    expect(await versionDelEsquema(bd)).toBe(3);
    // Datos de ejemplo creados con los repositorios sobre el esquema de la versión 3.
    const repos = crearRepositorios(bd, crearEntornoDePrueba());
    const banco = await repos.cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      saldoInicial: 215000,
      fechaSaldoInicial: '2026-10-01',
    });
    const broker = await repos.cuentas.crear({
      nombre: 'Bróker',
      tipo: 'inversion',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-10-01',
    });
    const comida = await repos.categorias.crear({ nombre: 'Comida', tipo: 'gasto' });
    await repos.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 2340,
      cuentaId: banco.id,
      categoriaId: comida.id,
      nombre: 'Mercado',
    });
    await repos.valores.registrar({ cuentaId: broker.id, fecha: '2026-11-12', valor: 612000 });
    const regla = await repos.reglas.crear({
      nombre: 'Súper',
      clase: 'fijo',
      importe: 5000,
      cuentaId: banco.id,
      categoriaId: comida.id,
      periodicidad: 'mensual',
      diaDelMes: 20,
      fechaInicio: '2026-11-01',
    });
    await repos.reglas.confirmar(regla.id, '2026-11');
    await repos.presupuestos.guardar('2026-11', [{ categoriaId: comida.id, importe: 30000 }]);
    const viaje = await repos.objetivos.crear({ nombre: 'Viaje', tipo: 'ahorro', meta: 150000 });
    await repos.objetivos.aportar({ objetivoId: viaje.id, fecha: '2026-11-03', importe: 5000 });

    const tablas = [
      'cuenta',
      'categoria',
      'movimiento',
      'valor_de_inversion',
      'regla_recurrente',
      'presupuesto',
      'linea_de_presupuesto',
      'objetivo',
      'aportacion_a_objetivo',
    ];
    const volcar = async () =>
      Object.fromEntries(
        await Promise.all(
          tablas.map(async (t) => [t, await bd.consultar(`SELECT * FROM ${t} ORDER BY id`)]),
        ),
      );
    const antes = await volcar();
    expect(tablas.every((t) => antes[t].length > 0)).toBe(true);

    expect(await migrar(bd)).toEqual({ desde: 3, hasta: 4 });
    expect(await volcar()).toEqual(antes);
    expect(await repos.cuentas.saldo(banco.id)).toBe(215000 - 2340 - 5000);

    // Las tablas nuevas funcionan sobre los datos migrados.
    const captura = await repos.capturas.registrar({
      origen: 'prueba',
      importeTexto: '4,50 €',
      comercioTexto: 'Café',
    });
    await repos.capturas.proponer(captura.id, { categoriaId: comida.id });
    expect((await repos.capturas.guardar(captura.id)).capturaId).toBe(captura.id);
    expect(await repos.avisos.registrar('prueba')).toBe(true);
  });

  it('la migración 4 solo crea tablas e índices nuevos', async () => {
    const m4 = MIGRACIONES.find((m) => m.version === 4);
    for (const sentencia of m4?.sentencias ?? []) {
      expect(sentencia).toMatch(/^CREATE (TABLE|INDEX|UNIQUE INDEX)/);
      expect(sentencia).not.toMatch(/ALTER|DROP|UPDATE|DELETE|INSERT/i);
    }
    expect(MIGRACIONES.map((m) => m.version)).toEqual([1, 2, 3, 4]);
  });

  it('la base de datos rechaza por sí misma los datos incoherentes', async () => {
    const { bd } = await preparar();
    const captura = (id: string, extra: string) =>
      bd.ejecutar(
        `INSERT INTO captura (id, recibida_en, origen, importe, estado, movimiento_id, id_de_cola,
                              creado_en, modificado_en)
         VALUES ('${id}', 'x', ${extra}, 'x', 'x')`,
      );
    await expect(captura('a', "'otro', NULL, 'pendiente', NULL, NULL")).rejects.toThrow();
    await expect(captura('b', "'prueba', 0, 'pendiente', NULL, NULL")).rejects.toThrow();
    await expect(captura('c', "'prueba', 5, 'otro', NULL, NULL")).rejects.toThrow();
    await captura('d', "'prueba', 5, 'pendiente', NULL, 'cola-1'");
    await expect(captura('e', "'prueba', 5, 'pendiente', NULL, 'cola-1'")).rejects.toThrow();
    // Sin identificador de cola puede haber muchas.
    await captura('f', "'prueba', 5, 'pendiente', NULL, NULL");
    await captura('g', "'prueba', 5, 'pendiente', NULL, NULL");
  });
});

describe('registrar una captura (T-030)', () => {
  it('guarda los textos tal como llegaron y extrae el importe y la divisa', async () => {
    const { pago, banco } = await preparar();
    const c = await pago();
    expect(c).toMatchObject({
      recibidaEn: a(0),
      origen: 'transaccion',
      importeTexto: '23,40 €',
      comercioTexto: 'Mercado Central',
      tarjetaTexto: 'Visa Oro',
      importe: 2340,
      divisa: 'EUR',
      // Tarjeta desconocida y una sola cuenta de banco: se propone esa.
      cuentaId: banco.id,
      categoriaId: null,
      estado: 'pendiente',
      movimientoId: null,
      idDeCola: null,
      borradoEn: null,
    });
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('nunca rechaza una captura incompleta: la guarda con lo que tenga', async () => {
    const { pago } = await preparar();
    for (const importeTexto of ['', '€', 'dos 3,00 4,00', '1.234']) {
      const c = await pago({ importeTexto, recibidaEn: a(60) });
      expect(c).toMatchObject({ importeTexto, importe: null, divisa: null, estado: 'pendiente' });
    }
    const vacia = await pago({
      importeTexto: undefined,
      comercioTexto: undefined,
      tarjetaTexto: undefined,
    });
    expect(vacia).toMatchObject({ importeTexto: '', comercioTexto: '', tarjetaTexto: '' });
  });

  it('conserva la divisa que dice el texto aunque no sea el euro', async () => {
    const { pago } = await preparar();
    expect(await pago({ importeTexto: '$12.50' })).toMatchObject({ importe: 1250, divisa: 'USD' });
  });

  it('admite un comercio con emojis y acentos y recorta uno de 300 caracteres', async () => {
    const { pago } = await preparar();
    expect((await pago({ comercioTexto: ' Café ☕ Ñandú ' })).comercioTexto).toBe('Café ☕ Ñandú');
    expect(
      (await pago({ comercioTexto: 'x'.repeat(300), recibidaEn: a(30) })).comercioTexto,
    ).toHaveLength(200);
  });

  it('la misma entrada de la cola leída dos veces da una sola captura', async () => {
    const { pago, capturas } = await preparar();
    const primera = await pago({ idDeCola: 'cola-7' });
    const segunda = await pago({ idDeCola: 'cola-7', importeTexto: '99,00 €' });
    expect(segunda.id).toBe(primera.id);
    expect(segunda.importe).toBe(2340);
    expect(await capturas.listar()).toHaveLength(1);
  });

  it('con dos cuentas de banco y tarjeta desconocida queda sin cuenta', async () => {
    const { pago, cuentas } = await preparar();
    await cuentas.crear({
      nombre: 'Otro banco',
      tipo: 'banco',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    expect((await pago()).cuentaId).toBeNull();
  });

  it('con un alias de la tarjeta lleva la cuenta del alias', async () => {
    const { pago, capturas, cartera } = await preparar();
    await capturas.fijarAlias('  VISA Oro ', cartera.id);
    expect((await pago()).cuentaId).toBe(cartera.id);
  });

  it('un alias cuya cuenta se archiva después deja de aplicarse', async () => {
    const { pago, capturas, cuentas, cartera, banco } = await preparar();
    await capturas.fijarAlias('Visa Oro', cartera.id);
    await cuentas.archivar(cartera.id, true);
    // Queda una sola cuenta de banco activa: se propone esa.
    expect((await pago()).cuentaId).toBe(banco.id);
  });
});

describe('duplicados (T-034)', () => {
  it('dos capturas iguales a 9 minutos dejan una sola pendiente; a 11, las dos', async () => {
    const { pago, capturas } = await preparar();
    await pago({ recibidaEn: a(0) });
    const nueve = await pago({ recibidaEn: a(9), origen: 'notificacion' });
    expect(nueve.estado).toBe('duplicada');
    expect(await capturas.contarPendientes()).toBe(1);
    const once = await pago({ recibidaEn: a(20) });
    expect(once.estado).toBe('pendiente');
    expect(await capturas.contarPendientes()).toBe(2);
  });

  it('la duplicada sigue visible y se puede recuperar', async () => {
    const { pago, capturas } = await preparar();
    await pago();
    const repetida = await pago({ recibidaEn: a(1) });
    expect((await capturas.listar(['duplicada'])).map((c) => c.id)).toEqual([repetida.id]);
    expect((await capturas.recuperar(repetida.id)).estado).toBe('pendiente');
    expect(await capturas.contarPendientes()).toBe(2);
  });

  it('una captura y un movimiento manual del mismo pago no se fusionan solos', async () => {
    const { pago, capturas, movimientos, banco, cat } = await preparar();
    await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-15',
      importe: 2340,
      cuentaId: banco.id,
      categoriaId: cat('Comida'),
      nombre: 'Mercado Central',
    });
    const c = await pago();
    expect(c.estado).toBe('pendiente');
    expect(await capturas.contarPendientes()).toBe(1);
    expect(await movimientos.listar()).toHaveLength(1);
  });
});

describe('guardar, descartar y recuperar', () => {
  it('una captura completa se guarda con un toque como gasto enlazado, con origen Apple Pay', async () => {
    const { pago, capturas, movimientos, banco, cat } = await preparar();
    const c = await pago();
    await esperarError(capturas.guardar(c.id), 'captura_incompleta');
    await capturas.proponer(c.id, { categoriaId: cat('Comida') });
    const mov = await capturas.guardar(c.id);
    expect(mov).toMatchObject({
      tipo: 'gasto',
      importe: 2340,
      divisa: 'EUR',
      cuentaId: banco.id,
      categoriaId: cat('Comida'),
      nombre: 'Mercado Central',
      comercio: 'Mercado Central',
      origen: 'apple_pay',
      capturaId: c.id,
    });
    expect(await capturas.obtener(c.id)).toMatchObject({
      estado: 'guardada',
      movimientoId: mov.id,
    });
    expect(await movimientos.listar()).toHaveLength(1);
    // Guardarla otra vez no crea otro movimiento.
    await esperarError(capturas.guardar(c.id), 'captura_ya_resuelta');
    expect(await movimientos.listar()).toHaveLength(1);
  });

  it('una captura que llegó por notificación crea un movimiento con ese origen', async () => {
    const { pago, capturas, cat } = await preparar();
    const c = await pago({ origen: 'notificacion' });
    await capturas.proponer(c.id, { categoriaId: cat('Comida') });
    expect((await capturas.guardar(c.id)).origen).toBe('notificacion');
  });

  it('sin importe, sin cuenta o sin categoría no se guarda con un toque', async () => {
    const { pago, capturas, cuentas, movimientos, cat } = await preparar();
    const sinImporte = await pago({ importeTexto: '' });
    await capturas.proponer(sinImporte.id, { categoriaId: cat('Comida') });
    await esperarError(capturas.guardar(sinImporte.id), 'captura_incompleta');
    await cuentas.crear({
      nombre: 'Otro banco',
      tipo: 'banco',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    const sinCuenta = await pago({ recibidaEn: a(60) });
    await capturas.proponer(sinCuenta.id, { categoriaId: cat('Comida') });
    await esperarError(capturas.guardar(sinCuenta.id), 'captura_incompleta');
    expect(await movimientos.listar()).toEqual([]);
  });

  it('el alta puede guardar la captura con los datos corregidos', async () => {
    const { pago, capturas, cartera, cat } = await preparar();
    const c = await pago({ importeTexto: '' });
    const mov = await capturas.guardarEditada(c.id, {
      tipo: 'gasto',
      fecha: '2026-11-14',
      importe: 1999,
      cuentaId: cartera.id,
      categoriaId: cat('Ocio'),
      nombre: 'Cine',
    });
    expect(mov).toMatchObject({
      importe: 1999,
      fecha: '2026-11-14',
      cuentaId: cartera.id,
      nombre: 'Cine',
      comercio: 'Mercado Central',
      origen: 'apple_pay',
      capturaId: c.id,
    });
    expect((await capturas.obtener(c.id))?.estado).toBe('guardada');
  });

  it('si el alta falla, la captura sigue pendiente y no se crea nada', async () => {
    const { pago, capturas, movimientos, banco } = await preparar();
    const c = await pago();
    await esperarError(
      capturas.guardarEditada(c.id, {
        tipo: 'gasto',
        fecha: '2026-11-14',
        importe: 0,
        cuentaId: banco.id,
      }),
      'importe_cero',
    );
    expect((await capturas.obtener(c.id))?.estado).toBe('pendiente');
    expect(await movimientos.listar()).toEqual([]);
  });

  it('descartar no borra: cambia el estado y se puede deshacer', async () => {
    const { pago, capturas } = await preparar();
    const c = await pago();
    await capturas.descartar(c.id);
    expect(await capturas.obtener(c.id)).toMatchObject({ estado: 'descartada', borradoEn: null });
    expect(await capturas.contarPendientes()).toBe(0);
    expect((await capturas.recuperar(c.id)).estado).toBe('pendiente');
    await esperarError(capturas.descartar('no-existe'), 'captura_no_encontrada');
  });

  it('una captura guardada no se descarta ni se recupera', async () => {
    const { pago, capturas, cat } = await preparar();
    const c = await pago();
    await capturas.proponer(c.id, { categoriaId: cat('Comida') });
    await capturas.guardar(c.id);
    await esperarError(capturas.descartar(c.id), 'captura_ya_resuelta');
    await esperarError(capturas.recuperar(c.id), 'captura_ya_resuelta');
    await esperarError(capturas.proponer(c.id, { categoriaId: null }), 'captura_ya_resuelta');
  });

  it('guardar, borrar el movimiento y deshacer el borrado', async () => {
    const { pago, capturas, movimientos, cat } = await preparar();
    const c = await pago();
    await capturas.proponer(c.id, { categoriaId: cat('Comida') });
    const mov = await capturas.guardar(c.id);

    await movimientos.borrar(mov.id);
    expect(await capturas.obtener(c.id)).toMatchObject({ estado: 'pendiente', movimientoId: null });
    expect(await capturas.contarPendientes()).toBe(1);

    await movimientos.restaurar(mov.id);
    expect(await capturas.obtener(c.id)).toMatchObject({
      estado: 'guardada',
      movimientoId: mov.id,
    });
    expect(await movimientos.listar()).toHaveLength(1);
  });

  it('si tras borrar el movimiento la captura se descarta, deshacer el borrado no la cambia', async () => {
    const { pago, capturas, movimientos, cat } = await preparar();
    const c = await pago();
    await capturas.proponer(c.id, { categoriaId: cat('Comida') });
    const mov = await capturas.guardar(c.id);
    await movimientos.borrar(mov.id);
    await capturas.descartar(c.id);
    await movimientos.restaurar(mov.id);
    expect((await capturas.obtener(c.id))?.estado).toBe('descartada');
  });

  it('con 150 capturas pendientes la lista y el recuento siguen respondiendo', async () => {
    const { pago, capturas } = await preparar();
    for (let i = 0; i < 150; i++) {
      await pago({ recibidaEn: a(i * 15), importeTexto: `${i + 1},00 €`, idDeCola: `cola-${i}` });
    }
    expect(await capturas.contarPendientes()).toBe(150);
    const lista = await capturas.listar(['pendiente']);
    expect(lista).toHaveLength(150);
    // De la más reciente a la más antigua.
    expect(lista[0].importe).toBe(15000);
    expect(lista[149].importe).toBe(100);
    expect(await capturas.ultimaRecibida()).toBe(a(149 * 15));
  });
});

describe('lo que se aprende al guardar (T-032 y T-033)', () => {
  it('recuerda la categoría del comercio y la propone en la siguiente captura', async () => {
    const { pago, capturas, cat } = await preparar();
    const primera = await pago();
    await capturas.proponer(primera.id, { categoriaId: cat('Comida') });
    await capturas.guardar(primera.id);
    const segunda = await pago({ recibidaEn: a(120), comercioTexto: ' MERCADO   central ' });
    expect(segunda.categoriaId).toBe(cat('Comida'));
    // Con cuenta y categoría propuestas ya se puede guardar con un toque.
    expect((await capturas.guardar(segunda.id)).categoriaId).toBe(cat('Comida'));
  });

  it('el último guardado manda', async () => {
    const { pago, capturas, cat } = await preparar();
    const primera = await pago();
    await capturas.proponer(primera.id, { categoriaId: cat('Comida') });
    await capturas.guardar(primera.id);
    const segunda = await pago({ recibidaEn: a(120) });
    await capturas.proponer(segunda.id, { categoriaId: cat('Ocio') });
    await capturas.guardar(segunda.id);
    expect((await pago({ recibidaEn: a(240) })).categoriaId).toBe(cat('Ocio'));
    expect(await capturas.listarReglasDeComercio()).toHaveLength(1);
  });

  it('una categoría recordada que luego se archiva deja de proponerse', async () => {
    const { pago, capturas, categorias, cat } = await preparar();
    const primera = await pago();
    await capturas.proponer(primera.id, { categoriaId: cat('Comida') });
    await capturas.guardar(primera.id);
    await categorias.archivar(cat('Comida'), true);
    expect((await pago({ recibidaEn: a(120) })).categoriaId).toBeNull();
  });

  it('al guardar una captura con tarjeta sin alias, crea el alias con la cuenta elegida', async () => {
    const { pago, capturas, cuentas, cartera, cat } = await preparar();
    const otro = await cuentas.crear({
      nombre: 'Otro banco',
      tipo: 'banco',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    const primera = await pago();
    expect(primera.cuentaId).toBeNull();
    await capturas.guardarEditada(primera.id, {
      tipo: 'gasto',
      fecha: '2026-11-15',
      importe: 2340,
      cuentaId: otro.id,
      categoriaId: cat('Comida'),
    });
    expect((await capturas.listarAlias()).map((x) => [x.texto, x.cuentaId])).toEqual([
      ['visa oro', otro.id],
    ]);
    // La siguiente captura de esa tarjeta ya lleva su cuenta.
    expect((await pago({ recibidaEn: a(120) })).cuentaId).toBe(otro.id);
    // Un alias existente no se pisa al guardar en otra cuenta.
    const tercera = await pago({ recibidaEn: a(240) });
    await capturas.guardarEditada(tercera.id, {
      tipo: 'gasto',
      fecha: '2026-11-15',
      importe: 2340,
      cuentaId: cartera.id,
      categoriaId: cat('Comida'),
    });
    expect((await capturas.listarAlias())[0].cuentaId).toBe(otro.id);
  });

  it('sin nombre de tarjeta no se crea ningún alias', async () => {
    const { pago, capturas, cat } = await preparar();
    const c = await pago({ tarjetaTexto: '' });
    await capturas.proponer(c.id, { categoriaId: cat('Comida') });
    await capturas.guardar(c.id);
    expect(await capturas.listarAlias()).toEqual([]);
  });
});

describe('alias de tarjeta', () => {
  it('se crean, se cambian de cuenta, se borran y se recuperan', async () => {
    const { capturas, banco, cartera } = await preparar();
    const alias = await capturas.fijarAlias('  Visa ORO ', banco.id);
    expect(alias).toMatchObject({ texto: 'visa oro', cuentaId: banco.id });
    const cambiado = await capturas.fijarAlias('visa oro', cartera.id);
    expect(cambiado.id).toBe(alias.id);
    expect(cambiado.cuentaId).toBe(cartera.id);
    expect(await capturas.listarAlias()).toHaveLength(1);
    await capturas.borrarAlias(alias.id);
    expect(await capturas.listarAlias()).toEqual([]);
    await esperarError(capturas.borrarAlias(alias.id), 'alias_no_encontrado');
    await capturas.restaurarAlias(alias.id);
    expect(await capturas.listarAlias()).toHaveLength(1);
  });

  it('rechaza un texto vacío y una cuenta que no existe', async () => {
    const { capturas, banco } = await preparar();
    await esperarError(capturas.fijarAlias('   ', banco.id), 'alias_vacio');
    await esperarError(capturas.fijarAlias('Visa', 'no-existe'), 'cuenta_no_encontrada');
  });
});

describe('«Añadir gasto» desde Atajos (T-038)', () => {
  const pedido = (extra = {}) => ({
    idDeCola: 'gasto-1',
    recibidaEn: a(0),
    importeTexto: '4,50',
    categoriaTexto: 'comida',
    cuentaTexto: 'cartera',
    ...extra,
  });

  it('con importe, categoría y cuenta válidos crea el movimiento y deja constancia', async () => {
    const { capturas, movimientos, cartera, cat } = await preparar();
    const c = await capturas.anadirGasto(pedido());
    expect(c).toMatchObject({ estado: 'guardada', origen: 'manual', importe: 450 });
    const [mov] = await movimientos.listar();
    expect(mov).toMatchObject({
      tipo: 'gasto',
      importe: 450,
      cuentaId: cartera.id,
      categoriaId: cat('Comida'),
      origen: 'manual',
      capturaId: c.id,
    });
    // La misma entrada de la cola no crea otro gasto.
    await capturas.anadirGasto(pedido());
    expect(await movimientos.listar()).toHaveLength(1);
  });

  it('si falta algo deja una captura pendiente en lugar de fallar', async () => {
    const { capturas, movimientos } = await preparar();
    const sinImporte = await capturas.anadirGasto(pedido({ importeTexto: '', idDeCola: 'g2' }));
    expect(sinImporte).toMatchObject({ estado: 'pendiente', importe: null });
    const sinCategoria = await capturas.anadirGasto(
      pedido({ categoriaTexto: 'no existe', idDeCola: 'g3', recibidaEn: a(60) }),
    );
    expect(sinCategoria).toMatchObject({ estado: 'pendiente', categoriaId: null, importe: 450 });
    // Con dos cuentas y sin decir cuál, no se elige una al azar.
    const sinCuenta = await capturas.anadirGasto(
      pedido({ cuentaTexto: '', idDeCola: 'g4', recibidaEn: a(120) }),
    );
    expect(sinCuenta).toMatchObject({ estado: 'pendiente', cuentaId: null });
    // Una categoría de ingreso no vale para un gasto.
    const deIngreso = await capturas.anadirGasto(
      pedido({ categoriaTexto: 'Nómina', idDeCola: 'g5', recibidaEn: a(180) }),
    );
    expect(deIngreso.estado).toBe('pendiente');
    expect(await movimientos.listar()).toEqual([]);
    expect(await capturas.contarPendientes()).toBe(4);
  });
});

describe('registro de avisos emitidos', () => {
  it('la primera vez devuelve true y las siguientes false', async () => {
    const { avisos } = await preparar();
    expect(await avisos.registrar('presupuesto:2026-11:comida:80')).toBe(true);
    expect(await avisos.registrar('presupuesto:2026-11:comida:80')).toBe(false);
    expect(await avisos.registrar('presupuesto:2026-11:comida:100')).toBe(true);
    expect((await avisos.clavesEmitidas()).sort()).toEqual([
      'presupuesto:2026-11:comida:100',
      'presupuesto:2026-11:comida:80',
    ]);
  });
});
