import { esperarError, prepararPrueba } from '@/pruebas/bdDePrueba';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('cuentas: crear, leer, modificar y borrar', () => {
  it('crea una cuenta con saldo inicial y la devuelve en la lista con ese saldo', async () => {
    const { cuentas } = await prepararPrueba();
    const cuenta = await cuentas.crear({
      nombre: 'Cuenta principal',
      tipo: 'banco',
      saldoInicial: 215000,
      fechaSaldoInicial: '2026-11-01',
    });
    expect(cuenta.id).toMatch(UUID);
    expect(cuenta).toMatchObject({
      nombre: 'Cuenta principal',
      tipo: 'banco',
      divisa: 'EUR',
      saldoInicial: 215000,
      archivada: false,
      borradoEn: null,
    });
    expect(cuenta.creadoEn).toBe(cuenta.modificadoEn);
    const lista = await cuentas.listarConSaldo();
    expect(lista).toHaveLength(1);
    expect(lista[0].saldo).toBe(215000);
    expect(await cuentas.obtener(cuenta.id)).toEqual(cuenta);
  });

  it('modifica una cuenta y actualiza la marca de modificación', async () => {
    const { cuentas } = await prepararPrueba();
    const cuenta = await cuentas.crear({ nombre: 'Cartera', tipo: 'efectivo' });
    const cambiada = await cuentas.modificar(cuenta.id, {
      nombre: 'Monedero',
      tipo: 'efectivo',
      saldoInicial: 6000,
      fechaSaldoInicial: '2026-10-01',
    });
    expect(cambiada.nombre).toBe('Monedero');
    expect(cambiada.saldoInicial).toBe(6000);
    expect(cambiada.modificadoEn > cuenta.modificadoEn).toBe(true);
    expect(cambiada.creadoEn).toBe(cuenta.creadoEn);
  });

  it('borra una cuenta sin movimientos, deja de listarse y se puede recuperar', async () => {
    const { cuentas } = await prepararPrueba();
    const cuenta = await cuentas.crear({ nombre: 'Temporal', tipo: 'banco' });
    await cuentas.borrar(cuenta.id);
    expect(await cuentas.listar()).toHaveLength(0);
    expect((await cuentas.obtener(cuenta.id))?.borradoEn).not.toBeNull();
    await esperarError(cuentas.borrar(cuenta.id), 'cuenta_no_encontrada');
    const recuperada = await cuentas.restaurar(cuenta.id);
    expect(recuperada.borradoEn).toBeNull();
    expect(await cuentas.listar()).toHaveLength(1);
    // Deshacer dos veces no cambia nada.
    expect(await cuentas.restaurar(cuenta.id)).toEqual(recuperada);
  });

  it('no deja borrar una cuenta con movimientos, pero sí archivarla', async () => {
    const { cuentas, movimientos } = await prepararPrueba();
    const a = await cuentas.crear({ nombre: 'A', tipo: 'banco', fechaSaldoInicial: '2026-11-01' });
    const b = await cuentas.crear({ nombre: 'B', tipo: 'banco', fechaSaldoInicial: '2026-11-01' });
    const mov = await movimientos.crear({
      tipo: 'transferencia',
      fecha: '2026-11-10',
      importe: 5000,
      cuentaId: a.id,
      cuentaDestinoId: b.id,
    });
    await esperarError(cuentas.borrar(a.id), 'cuenta_con_movimientos');
    // También la cuenta de destino tiene movimientos.
    await esperarError(cuentas.borrar(b.id), 'cuenta_con_movimientos');
    const archivada = await cuentas.archivar(a.id, true);
    expect(archivada.archivada).toBe(true);
    expect(await cuentas.listar()).toHaveLength(1);
    expect(await cuentas.listar({ incluirArchivadas: true })).toHaveLength(2);
    // Con el movimiento borrado, la cuenta ya se puede borrar.
    await movimientos.borrar(mov.id);
    await cuentas.borrar(b.id);
  });

  it('rechaza nombres vacíos y duplicados', async () => {
    const { cuentas } = await prepararPrueba();
    const cuenta = await cuentas.crear({ nombre: '  Cuenta   principal ', tipo: 'banco' });
    expect(cuenta.nombre).toBe('Cuenta principal');
    await esperarError(cuentas.crear({ nombre: '', tipo: 'banco' }), 'nombre_vacio');
    await esperarError(cuentas.crear({ nombre: '   ', tipo: 'banco' }), 'nombre_vacio');
    await esperarError(
      cuentas.crear({ nombre: 'CUENTA PRINCIPAL', tipo: 'efectivo' }),
      'nombre_duplicado',
    );
    // Renombrarse a sí misma no es un duplicado.
    await cuentas.modificar(cuenta.id, { nombre: 'cuenta principal', tipo: 'banco' });
  });

  it('rechaza saldos, fechas y divisas no válidos', async () => {
    const { cuentas } = await prepararPrueba();
    await esperarError(
      cuentas.crear({ nombre: 'X', tipo: 'banco', saldoInicial: 10.5 }),
      'importe_no_valido',
    );
    await esperarError(
      cuentas.crear({ nombre: 'X', tipo: 'banco', fechaSaldoInicial: '2026-02-30' }),
      'fecha_no_valida',
    );
    await esperarError(
      cuentas.crear({ nombre: 'X', tipo: 'banco', divisa: 'euros' }),
      'divisa_no_valida',
    );
    expect(await cuentas.listar()).toHaveLength(0);
  });

  it('admite saldo inicial cero y negativo', async () => {
    const { cuentas } = await prepararPrueba();
    const cero = await cuentas.crear({ nombre: 'Cero', tipo: 'banco', saldoInicial: 0 });
    const rojo = await cuentas.crear({ nombre: 'Rojo', tipo: 'banco', saldoInicial: -1500 });
    expect(await cuentas.saldo(cero.id)).toBe(0);
    expect(await cuentas.saldo(rojo.id)).toBe(-1500);
  });

  it('admite nombres con acentos y emojis', async () => {
    const { cuentas } = await prepararPrueba();
    const cuenta = await cuentas.crear({ nombre: 'Bróker 📈', tipo: 'inversion' });
    expect((await cuentas.obtener(cuenta.id))?.nombre).toBe('Bróker 📈');
  });
});
