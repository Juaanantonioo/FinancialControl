import { esperarError, prepararPrueba } from '@/pruebas/bdDePrueba';

describe('categorías: crear, leer, modificar y borrar', () => {
  it('crea, lee, renombra y borra', async () => {
    const { categorias } = await prepararPrueba();
    const comida = await categorias.crear({ nombre: 'Comida', tipo: 'gasto' });
    expect(await categorias.obtener(comida.id)).toEqual(comida);
    const renombrada = await categorias.renombrar(comida.id, 'Alimentación');
    expect(renombrada.nombre).toBe('Alimentación');
    expect(renombrada.modificadoEn > comida.modificadoEn).toBe(true);
    await categorias.borrar(comida.id);
    expect(await categorias.listar()).toHaveLength(0);
    const recuperada = await categorias.restaurar(comida.id);
    expect(recuperada.nombre).toBe('Alimentación');
    expect(await categorias.restaurar(comida.id)).toEqual(recuperada);
  });

  it('añade las categorías iniciales solo al crear la base de datos', async () => {
    const { categorias } = await prepararPrueba([
      { nombre: 'Comida', tipo: 'gasto' },
      { nombre: 'Nómina', tipo: 'ingreso' },
    ]);
    expect((await categorias.listar()).map((c) => c.nombre)).toEqual(['Comida', 'Nómina']);
    expect((await categorias.listar({ tipo: 'ingreso' })).map((c) => c.nombre)).toEqual(['Nómina']);
  });

  it('rechaza nombres duplicados dentro del mismo tipo, también contra archivadas', async () => {
    const { categorias } = await prepararPrueba();
    const comida = await categorias.crear({ nombre: 'Comida', tipo: 'gasto' });
    await esperarError(categorias.crear({ nombre: 'comida', tipo: 'gasto' }), 'nombre_duplicado');
    await esperarError(categorias.crear({ nombre: ' COMÍDA ', tipo: 'gasto' }), 'nombre_duplicado');
    await esperarError(categorias.crear({ nombre: '', tipo: 'gasto' }), 'nombre_vacio');
    // El mismo nombre en el otro tipo sí vale.
    await categorias.crear({ nombre: 'Comida', tipo: 'ingreso' });
    const casa = await categorias.crear({ nombre: 'Casa', tipo: 'gasto' });
    await esperarError(categorias.renombrar(casa.id, 'Comida'), 'nombre_duplicado');
    await categorias.archivar(comida.id, true);
    await esperarError(categorias.crear({ nombre: 'Comida', tipo: 'gasto' }), 'nombre_duplicado');
    // Renombrarse a sí misma con otra grafía no es un duplicado.
    expect((await categorias.renombrar(casa.id, 'CASA')).nombre).toBe('CASA');
  });

  it('ordena las categorías', async () => {
    const { categorias } = await prepararPrueba();
    const a = await categorias.crear({ nombre: 'A', tipo: 'gasto' });
    const b = await categorias.crear({ nombre: 'B', tipo: 'gasto' });
    const c = await categorias.crear({ nombre: 'C', tipo: 'gasto' });
    expect((await categorias.listar()).map((x) => x.nombre)).toEqual(['A', 'B', 'C']);
    await categorias.ordenar([c.id, a.id, b.id]);
    expect((await categorias.listar()).map((x) => x.nombre)).toEqual(['C', 'A', 'B']);
    // Un id desconocido se ignora sin romper el orden del resto.
    await categorias.ordenar([b.id, 'no-existe', c.id, a.id]);
    expect((await categorias.listar()).map((x) => x.nombre)).toEqual(['B', 'C', 'A']);
  });

  it('archivar una categoría en uso la oculta en el alta y conserva sus movimientos', async () => {
    const { categorias, cuentas, movimientos } = await prepararPrueba();
    const cuenta = await cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      fechaSaldoInicial: '2026-11-01',
    });
    const ocio = await categorias.crear({ nombre: 'Ocio', tipo: 'gasto' });
    const mov = await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 1500,
      cuentaId: cuenta.id,
      categoriaId: ocio.id,
      nombre: 'Cine',
    });
    await categorias.archivar(ocio.id, true);

    // Oculta en el alta: ni en la lista activa ni en las frecuentes.
    expect(await categorias.listar({ tipo: 'gasto' })).toHaveLength(0);
    expect(await categorias.frecuentes('gasto')).toHaveLength(0);
    expect(await categorias.listar({ incluirArchivadas: true })).toHaveLength(1);

    // El movimiento conserva su categoría y sigue mostrando su nombre.
    const [listado] = await movimientos.listar();
    expect(listado.categoriaId).toBe(ocio.id);
    expect(listado.categoriaNombre).toBe('Ocio');

    // No se puede usar en un movimiento nuevo…
    await esperarError(
      movimientos.crear({
        tipo: 'gasto',
        fecha: '2026-11-11',
        importe: 100,
        cuentaId: cuenta.id,
        categoriaId: ocio.id,
      }),
      'categoria_archivada',
    );
    // …pero el movimiento antiguo se puede editar sin perderla.
    const editado = await movimientos.modificar(mov.id, {
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 1800,
      cuentaId: cuenta.id,
      categoriaId: ocio.id,
      nombre: 'Cine',
    });
    expect(editado.categoriaId).toBe(ocio.id);

    // Desarchivar la devuelve al alta.
    await categorias.archivar(ocio.id, false);
    expect(await categorias.listar({ tipo: 'gasto' })).toHaveLength(1);
  });

  it('pone primero las categorías más usadas', async () => {
    const { categorias, cuentas, movimientos } = await prepararPrueba();
    const cuenta = await cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      fechaSaldoInicial: '2026-11-01',
    });
    const casa = await categorias.crear({ nombre: 'Casa', tipo: 'gasto' });
    const comida = await categorias.crear({ nombre: 'Comida', tipo: 'gasto' });
    for (let i = 0; i < 2; i++) {
      await movimientos.crear({
        tipo: 'gasto',
        fecha: '2026-11-10',
        importe: 100,
        cuentaId: cuenta.id,
        categoriaId: comida.id,
      });
    }
    expect((await categorias.frecuentes('gasto')).map((c) => c.id)).toEqual([comida.id, casa.id]);
  });
});
