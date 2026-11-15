import { agruparPorDia } from '@/datos/movimientos';
import { gastoDelMes } from '@/dominio/saldo';
import { esperarError, prepararPrueba } from '@/pruebas/bdDePrueba';

async function escenario() {
  const prueba = await prepararPrueba();
  const { cuentas, categorias } = prueba;
  const banco = await cuentas.crear({
    nombre: 'Cuenta principal',
    tipo: 'banco',
    saldoInicial: 100000,
    fechaSaldoInicial: '2026-11-01',
  });
  const cartera = await cuentas.crear({
    nombre: 'Cartera',
    tipo: 'efectivo',
    saldoInicial: 6000,
    fechaSaldoInicial: '2026-11-01',
  });
  const comida = await categorias.crear({ nombre: 'Comida', tipo: 'gasto' });
  const ocio = await categorias.crear({ nombre: 'Ocio', tipo: 'gasto' });
  const nomina = await categorias.crear({ nombre: 'Nómina', tipo: 'ingreso' });
  return { ...prueba, banco, cartera, comida, ocio, nomina };
}

describe('movimientos: crear, leer, modificar y borrar', () => {
  it('crea un gasto, lo lee, lo modifica y lo borra', async () => {
    const { movimientos, banco, comida, ocio } = await escenario();
    const gasto = await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 2340,
      cuentaId: banco.id,
      categoriaId: comida.id,
      nombre: 'Mercado Central',
    });
    expect(gasto).toMatchObject({
      tipo: 'gasto',
      importe: 2340,
      divisa: 'EUR',
      cuentaId: banco.id,
      cuentaDestinoId: null,
      categoriaId: comida.id,
      nombre: 'Mercado Central',
      origen: 'manual',
      borradoEn: null,
    });
    expect(await movimientos.obtener(gasto.id)).toEqual(gasto);

    const editado = await movimientos.modificar(gasto.id, {
      tipo: 'gasto',
      fecha: '2026-11-11',
      importe: 2500,
      cuentaId: banco.id,
      categoriaId: ocio.id,
      nombre: 'Mercado',
    });
    expect(editado).toMatchObject({ importe: 2500, fecha: '2026-11-11', categoriaId: ocio.id });
    expect(editado.creadoEn).toBe(gasto.creadoEn);
    expect(editado.modificadoEn > gasto.modificadoEn).toBe(true);

    await movimientos.borrar(gasto.id);
    expect(await movimientos.listar()).toHaveLength(0);
    await esperarError(movimientos.modificar(gasto.id, { ...editado }), 'no_encontrado');
  });

  it('usa la divisa de la cuenta y limpia los textos', async () => {
    const { movimientos, cuentas } = await escenario();
    const dolares = await cuentas.crear({ nombre: 'USD', tipo: 'banco', divisa: 'USD' });
    const mov = await movimientos.crear({
      tipo: 'ingreso',
      fecha: '2026-11-15',
      importe: 100,
      cuentaId: dolares.id,
      nombre: '  Café   ☕ del  barrio ',
      comercio: '   ',
      nota: ' con leche ',
    });
    expect(mov.divisa).toBe('USD');
    expect(mov.nombre).toBe('Café ☕ del barrio');
    expect(mov.comercio).toBeNull();
    expect(mov.nota).toBe('con leche');
  });

  it('rechaza importes no válidos', async () => {
    const { movimientos, banco } = await escenario();
    const base = { tipo: 'gasto' as const, fecha: '2026-11-10', cuentaId: banco.id };
    await esperarError(movimientos.crear({ ...base, importe: 0 }), 'importe_cero');
    await esperarError(movimientos.crear({ ...base, importe: -500 }), 'importe_no_valido');
    await esperarError(movimientos.crear({ ...base, importe: 10.5 }), 'importe_no_valido');
    await esperarError(movimientos.crear({ ...base, importe: NaN }), 'importe_no_valido');
    await esperarError(movimientos.crear({ ...base, tipo: 'ajuste', importe: 0 }), 'importe_cero');
    expect(await movimientos.listar()).toHaveLength(0);
  });

  it('rechaza fechas, cuentas y categorías no válidas', async () => {
    const { movimientos, banco, comida, nomina, categorias } = await escenario();
    const base = { tipo: 'gasto' as const, fecha: '2026-11-10', importe: 100, cuentaId: banco.id };
    await esperarError(movimientos.crear({ ...base, fecha: '10/11/2026' }), 'fecha_no_valida');
    await esperarError(movimientos.crear({ ...base, fecha: '2026-13-01' }), 'fecha_no_valida');
    await esperarError(
      movimientos.crear({ ...base, cuentaId: 'no-existe' }),
      'cuenta_no_encontrada',
    );
    await esperarError(
      movimientos.crear({ ...base, categoriaId: 'no-existe' }),
      'categoria_no_encontrada',
    );
    // Una categoría de ingreso no sirve para un gasto.
    await esperarError(
      movimientos.crear({ ...base, categoriaId: nomina.id }),
      'categoria_de_otro_tipo',
    );
    await categorias.borrar(comida.id);
    await esperarError(
      movimientos.crear({ ...base, categoriaId: comida.id }),
      'categoria_no_encontrada',
    );
  });

  it('un gasto sin categoría ni nombre se guarda', async () => {
    const { movimientos, banco } = await escenario();
    const mov = await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 100,
      cuentaId: banco.id,
    });
    expect(mov.categoriaId).toBeNull();
    expect(mov.nombre).toBe('');
  });

  it('el ajuste lleva signo y no lleva categoría', async () => {
    const { movimientos, cuentas, banco, comida } = await escenario();
    const ajuste = await movimientos.crear({
      tipo: 'ajuste',
      fecha: '2026-11-10',
      importe: -330,
      cuentaId: banco.id,
      categoriaId: comida.id,
    });
    expect(ajuste.categoriaId).toBeNull();
    expect(await cuentas.saldo(banco.id)).toBe(100000 - 330);
  });
});

describe('transferencias (T-024)', () => {
  it('50 € bajan el origen, suben el destino y no alteran el gasto del mes', async () => {
    const { movimientos, cuentas, banco, cartera, comida } = await escenario();
    await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-05',
      importe: 2340,
      cuentaId: banco.id,
      categoriaId: comida.id,
    });
    const gastoAntes = gastoDelMes(await movimientos.listar(), '2026-11');
    const saldoBancoAntes = await cuentas.saldo(banco.id);
    const saldoCarteraAntes = await cuentas.saldo(cartera.id);

    const transferencia = await movimientos.crear({
      tipo: 'transferencia',
      fecha: '2026-11-10',
      importe: 5000,
      cuentaId: banco.id,
      cuentaDestinoId: cartera.id,
      categoriaId: comida.id, // se descarta: una transferencia no lleva categoría
    });
    expect(transferencia.categoriaId).toBeNull();
    expect(transferencia.cuentaDestinoId).toBe(cartera.id);

    expect(await cuentas.saldo(banco.id)).toBe(saldoBancoAntes - 5000);
    expect(await cuentas.saldo(cartera.id)).toBe(saldoCarteraAntes + 5000);
    expect(gastoDelMes(await movimientos.listar(), '2026-11')).toBe(gastoAntes);
    expect(gastoAntes).toBe(2340);
  });

  it('rechaza la misma cuenta de origen y destino', async () => {
    const { movimientos, banco } = await escenario();
    await esperarError(
      movimientos.crear({
        tipo: 'transferencia',
        fecha: '2026-11-10',
        importe: 5000,
        cuentaId: banco.id,
        cuentaDestinoId: banco.id,
      }),
      'misma_cuenta',
    );
  });

  it('exige cuenta de destino, y que exista', async () => {
    const { movimientos, banco } = await escenario();
    const base = {
      tipo: 'transferencia' as const,
      fecha: '2026-11-10',
      importe: 5000,
      cuentaId: banco.id,
    };
    await esperarError(movimientos.crear(base), 'cuenta_destino_obligatoria');
    await esperarError(
      movimientos.crear({ ...base, cuentaDestinoId: 'no-existe' }),
      'cuenta_no_encontrada',
    );
  });

  it('rechaza una cuenta archivada como origen o como destino', async () => {
    const { movimientos, cuentas, banco, cartera } = await escenario();
    await cuentas.archivar(cartera.id, true);
    const base = { tipo: 'transferencia' as const, fecha: '2026-11-10', importe: 5000 };
    await esperarError(
      movimientos.crear({ ...base, cuentaId: banco.id, cuentaDestinoId: cartera.id }),
      'cuenta_archivada',
    );
    await esperarError(
      movimientos.crear({ ...base, cuentaId: cartera.id, cuentaDestinoId: banco.id }),
      'cuenta_archivada',
    );
    await esperarError(
      movimientos.crear({ tipo: 'gasto', fecha: '2026-11-10', importe: 1, cuentaId: cartera.id }),
      'cuenta_archivada',
    );
  });

  it('una transferencia antigua con una cuenta archivada después se puede editar', async () => {
    const { movimientos, cuentas, banco, cartera } = await escenario();
    const t = await movimientos.crear({
      tipo: 'transferencia',
      fecha: '2026-11-10',
      importe: 5000,
      cuentaId: banco.id,
      cuentaDestinoId: cartera.id,
    });
    await cuentas.archivar(cartera.id, true);
    const editada = await movimientos.modificar(t.id, {
      tipo: 'transferencia',
      fecha: '2026-11-10',
      importe: 6000,
      cuentaId: banco.id,
      cuentaDestinoId: cartera.id,
    });
    expect(editada.importe).toBe(6000);
    expect(await cuentas.saldo(banco.id)).toBe(100000 - 6000);
  });

  it('rechaza transferir entre divisas distintas', async () => {
    const { movimientos, cuentas, banco } = await escenario();
    const dolares = await cuentas.crear({ nombre: 'USD', tipo: 'banco', divisa: 'USD' });
    await esperarError(
      movimientos.crear({
        tipo: 'transferencia',
        fecha: '2026-11-10',
        importe: 5000,
        cuentaId: banco.id,
        cuentaDestinoId: dolares.id,
      }),
      'divisas_distintas',
    );
  });

  it('convertir una transferencia en gasto quita el destino', async () => {
    const { movimientos, cuentas, banco, cartera } = await escenario();
    const t = await movimientos.crear({
      tipo: 'transferencia',
      fecha: '2026-11-10',
      importe: 5000,
      cuentaId: banco.id,
      cuentaDestinoId: cartera.id,
    });
    const gasto = await movimientos.modificar(t.id, {
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 5000,
      cuentaId: banco.id,
      cuentaDestinoId: cartera.id,
    });
    expect(gasto.cuentaDestinoId).toBeNull();
    expect(await cuentas.saldo(cartera.id)).toBe(6000);
  });
});

describe('lista, búsqueda y filtros (T-025)', () => {
  async function conMovimientos() {
    const e = await escenario();
    const { movimientos, banco, cartera, comida, ocio, nomina } = e;
    const crear = movimientos.crear;
    await crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 2340,
      cuentaId: banco.id,
      categoriaId: comida.id,
      nombre: 'Mercado Central',
    });
    await crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 900,
      cuentaId: cartera.id,
      categoriaId: ocio.id,
      nombre: 'Cine',
      nota: 'con Marta',
    });
    await crear({
      tipo: 'gasto',
      fecha: '2026-11-12',
      importe: 450,
      cuentaId: banco.id,
      categoriaId: comida.id,
      nombre: 'Café',
    });
    await crear({
      tipo: 'ingreso',
      fecha: '2026-10-28',
      importe: 150000,
      cuentaId: banco.id,
      categoriaId: nomina.id,
      nombre: 'Nómina octubre',
    });
    await crear({
      tipo: 'transferencia',
      fecha: '2026-11-11',
      importe: 5000,
      cuentaId: banco.id,
      cuentaDestinoId: cartera.id,
    });
    await crear({
      tipo: 'gasto',
      fecha: '2026-11-12',
      importe: 300,
      cuentaId: banco.id,
      categoriaId: ocio.id,
      comercio: 'Mercadillo',
    });
    return e;
  }

  it('ordena del más reciente al más antiguo y agrupa por día', async () => {
    const { movimientos } = await conMovimientos();
    const lista = await movimientos.listar();
    expect(lista).toHaveLength(6);
    const grupos = agruparPorDia(lista);
    expect(grupos.map((g) => [g.fecha, g.movimientos.length])).toEqual([
      ['2026-11-12', 2],
      ['2026-11-11', 1],
      ['2026-11-10', 2],
      ['2026-10-28', 1],
    ]);
    expect(agruparPorDia([])).toEqual([]);
  });

  it('buscar un nombre devuelve solo los movimientos que lo contienen', async () => {
    const { movimientos } = await conMovimientos();
    const porNombre = await movimientos.listar({ texto: 'merca' });
    expect(porNombre.map((m) => m.nombre || m.comercio).sort()).toEqual([
      'Mercadillo',
      'Mercado Central',
    ]);
    // Sin distinguir mayúsculas ni acentos.
    expect((await movimientos.listar({ texto: 'CAFE' })).map((m) => m.nombre)).toEqual(['Café']);
    expect((await movimientos.listar({ texto: 'nomina' })).map((m) => m.nombre)).toEqual([
      'Nómina octubre',
    ]);
    // También busca en la nota.
    expect((await movimientos.listar({ texto: 'marta' })).map((m) => m.nombre)).toEqual(['Cine']);
    expect(await movimientos.listar({ texto: 'no existe' })).toEqual([]);
    expect(await movimientos.listar({ texto: '   ' })).toHaveLength(6);
    // Los comodines de SQL son texto normal, no devuelven todo.
    expect(await movimientos.listar({ texto: '%' })).toEqual([]);
    expect(await movimientos.listar({ texto: "' OR 1=1 --" })).toEqual([]);
  });

  it('filtra por cuenta, categoría y mes, solos y combinados', async () => {
    const { movimientos, banco, cartera, comida } = await conMovimientos();
    // La transferencia aparece en las dos cuentas.
    expect(await movimientos.listar({ cuentaId: cartera.id })).toHaveLength(2);
    expect(await movimientos.listar({ cuentaId: banco.id })).toHaveLength(5);
    expect(await movimientos.listar({ categoriaId: comida.id })).toHaveLength(2);
    expect(await movimientos.listar({ mes: '2026-10' })).toHaveLength(1);
    expect(await movimientos.listar({ mes: '2026-11' })).toHaveLength(5);
    expect(
      await movimientos.listar({
        cuentaId: banco.id,
        categoriaId: comida.id,
        mes: '2026-11',
        texto: 'café',
      }),
    ).toHaveLength(1);
    expect(await movimientos.mesesConMovimientos()).toEqual(['2026-11', '2026-10']);
  });

  it('propone la última cuenta usada y la categoría de un nombre conocido', async () => {
    const { movimientos, cuentas, categorias, banco, comida } = await conMovimientos();
    expect(await movimientos.ultimaCuentaUsada()).toBe(banco.id);
    expect(await movimientos.sugerirCategoria('  mercado CENTRAL ', 'gasto')).toBe(comida.id);
    expect(await movimientos.sugerirCategoria('Desconocido', 'gasto')).toBeNull();
    expect(await movimientos.sugerirCategoria('', 'gasto')).toBeNull();
    await categorias.archivar(comida.id, true);
    expect(await movimientos.sugerirCategoria('Mercado Central', 'gasto')).toBeNull();
    await cuentas.archivar(banco.id, true);
    expect(await movimientos.ultimaCuentaUsada()).not.toBe(banco.id);
  });
});

describe('borrado con deshacer (T-028)', () => {
  it('tras borrar, deshacer recupera el movimiento con los mismos datos', async () => {
    const { movimientos, cuentas, banco, comida } = await escenario();
    const original = await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 2340,
      cuentaId: banco.id,
      categoriaId: comida.id,
      nombre: 'Mercado Central',
      nota: 'fruta',
    });
    await movimientos.borrar(original.id);
    expect(await movimientos.listar()).toHaveLength(0);
    expect(await cuentas.saldo(banco.id)).toBe(100000);

    const recuperado = await movimientos.restaurar(original.id);
    // Todo igual salvo la marca de modificación.
    expect({ ...recuperado, modificadoEn: '' }).toEqual({ ...original, modificadoEn: '' });
    expect(await movimientos.listar()).toHaveLength(1);
    expect(await cuentas.saldo(banco.id)).toBe(100000 - 2340);
  });

  it('deshacer dos veces y borrar dos veces son inofensivos', async () => {
    const { movimientos, cuentas, banco } = await escenario();
    const mov = await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 2340,
      cuentaId: banco.id,
    });
    await movimientos.borrar(mov.id);
    const marcaDelBorrado = (await movimientos.obtener(mov.id))?.borradoEn;
    await movimientos.borrar(mov.id);
    expect((await movimientos.obtener(mov.id))?.borradoEn).toBe(marcaDelBorrado);

    const primera = await movimientos.restaurar(mov.id);
    const segunda = await movimientos.restaurar(mov.id);
    expect(segunda).toEqual(primera);
    expect(await movimientos.listar()).toHaveLength(1);
    expect(await cuentas.saldo(banco.id)).toBe(100000 - 2340);
    await esperarError(movimientos.restaurar('no-existe'), 'no_encontrado');
    await esperarError(movimientos.borrar('no-existe'), 'no_encontrado');
  });
});

describe('segunda barrera en la base de datos', () => {
  it('SQLite rechaza por sí mismo una transferencia a la misma cuenta y un importe negativo', async () => {
    const { bd, banco } = await escenario();
    const insertar = (tipo: string, importe: number, destino: string | null) =>
      bd.ejecutar(
        `INSERT INTO movimiento (id, tipo, fecha, importe, divisa, cuenta_id, cuenta_destino_id,
                                 creado_en, modificado_en)
         VALUES ('x', ?, '2026-11-10', ?, 'EUR', ?, ?, 'a', 'a')`,
        [tipo, importe, banco.id, destino],
      );
    await expect(insertar('transferencia', 100, banco.id)).rejects.toThrow(/CHECK/);
    await expect(insertar('gasto', -100, null)).rejects.toThrow(/CHECK/);
    await expect(insertar('gasto', 100, 'cuenta-inexistente')).rejects.toThrow();
  });
});
