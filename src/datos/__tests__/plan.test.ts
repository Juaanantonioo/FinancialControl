import { crearRepositorios } from '@/datos';
import { MIGRACIONES, migrar, versionDelEsquema } from '@/datos/migraciones';
import { estadoDeObjetivo } from '@/dominio/objetivos';
import { ocurrenciasDelMes } from '@/dominio/recurrentes';
import {
  crearBdDePrueba,
  crearEntornoDePrueba,
  esperarError,
  prepararPrueba,
} from '@/pruebas/bdDePrueba';

// El reloj de prueba empieza el 15/11/2026.
const HOY = '2026-11-15';
const MES = '2026-11';

async function preparar() {
  const t = await prepararPrueba([
    { nombre: 'Casa', tipo: 'gasto' },
    { nombre: 'Ocio', tipo: 'gasto' },
    { nombre: 'Nómina', tipo: 'ingreso' },
  ]);
  const banco = await t.cuentas.crear({
    nombre: 'Banco',
    tipo: 'banco',
    saldoInicial: 500000,
    fechaSaldoInicial: '2026-01-01',
  });
  const ahorro = await t.cuentas.crear({
    nombre: 'Ahorro',
    tipo: 'banco',
    saldoInicial: 0,
    fechaSaldoInicial: '2026-01-01',
  });
  const categorias = await t.categorias.listar();
  const cat = (nombre: string) => categorias.find((c) => c.nombre === nombre)!.id;
  const gimnasio = () =>
    t.reglas.crear({
      nombre: 'Gimnasio',
      clase: 'fijo',
      importe: 3500,
      cuentaId: banco.id,
      categoriaId: cat('Ocio'),
      periodicidad: 'mensual',
      diaDelMes: 18,
      fechaInicio: '2026-01-01',
    });
  return { ...t, banco, ahorro, cat, gimnasio };
}

describe('migración 3: planificación', () => {
  it('una base de datos en versión 2 con datos pasa a la 3 sin perder ni alterar nada', async () => {
    const bd = crearBdDePrueba();
    await bd.ejecutar('PRAGMA foreign_keys = ON');
    await migrar(
      bd,
      MIGRACIONES.filter((m) => m.version <= 2),
    );
    expect(await versionDelEsquema(bd)).toBe(2);
    // Datos de ejemplo escritos con el esquema de la versión 2.
    const marca = '2026-11-10T10:00:00.000Z';
    const comunes = `'${marca}', '${marca}', NULL`;
    await bd.ejecutar(
      `INSERT INTO cuenta VALUES ('c1', 'Banco', 'banco', 'EUR', 215000, '2026-10-15', 0, 0, ${comunes})`,
    );
    await bd.ejecutar(
      `INSERT INTO cuenta VALUES ('c2', 'Bróker', 'inversion', 'EUR', 580000, '2026-10-15', 0, 1, ${comunes})`,
    );
    await bd.ejecutar(
      `INSERT INTO categoria VALUES ('k1', 'Comida', 'gasto', '☕', '#E8590C', NULL, 0, 0, ${comunes})`,
    );
    await bd.ejecutar(
      `INSERT INTO movimiento (id, tipo, fecha, importe, divisa, cuenta_id, categoria_id, nombre,
                               origen, creado_en, modificado_en)
       VALUES ('m1', 'gasto', '2026-11-10', 2340, 'EUR', 'c1', 'k1', 'Mercado', 'manual',
               '${marca}', '${marca}')`,
    );
    await bd.ejecutar(
      `INSERT INTO movimiento (id, tipo, fecha, importe, divisa, cuenta_id, cuenta_destino_id,
                               origen, creado_en, modificado_en, borrado_en)
       VALUES ('m2', 'transferencia', '2026-11-11', 20000, 'EUR', 'c1', 'c2', 'manual',
               '${marca}', '${marca}', '${marca}')`,
    );
    await bd.ejecutar(
      `INSERT INTO valor_de_inversion VALUES ('v1', 'c2', '2026-11-12', 612000, ${comunes})`,
    );
    const volcar = async () => ({
      cuentas: await bd.consultar('SELECT * FROM cuenta ORDER BY id'),
      categorias: await bd.consultar('SELECT * FROM categoria ORDER BY id'),
      movimientos: await bd.consultar('SELECT * FROM movimiento ORDER BY id'),
      valores: await bd.consultar('SELECT * FROM valor_de_inversion ORDER BY id'),
    });
    const antes = await volcar();
    expect(
      [antes.cuentas, antes.categorias, antes.movimientos, antes.valores].map((t) => t.length),
    ).toEqual([2, 1, 2, 1]);

    expect(await migrar(bd)).toEqual({ desde: 2, hasta: 3 });
    expect(await volcar()).toEqual(antes);

    // Las tablas nuevas funcionan sobre los datos migrados.
    const repos = crearRepositorios(bd, crearEntornoDePrueba());
    expect(await repos.cuentas.saldo('c1')).toBe(215000 - 2340);
    const regla = await repos.reglas.crear({
      nombre: 'Súper',
      clase: 'fijo',
      importe: 5000,
      cuentaId: 'c1',
      categoriaId: 'k1',
      periodicidad: 'mensual',
      diaDelMes: 20,
      fechaInicio: '2026-11-01',
    });
    expect((await repos.reglas.confirmar(regla.id, MES)).origen).toBe('recurrente');
    await repos.presupuestos.guardar(MES, [{ categoriaId: 'k1', importe: 30000 }]);
    await repos.objetivos.crear({ nombre: 'Viaje', tipo: 'ahorro', meta: 150000 });
  });

  it('la migración 3 solo crea tablas e índices nuevos y no toca las anteriores', async () => {
    const m3 = MIGRACIONES.find((m) => m.version === 3);
    for (const sentencia of m3?.sentencias ?? []) {
      expect(sentencia).toMatch(/^CREATE (TABLE|INDEX|UNIQUE INDEX)/);
      expect(sentencia).not.toMatch(/ALTER|DROP|UPDATE|DELETE|INSERT/i);
    }
    expect(MIGRACIONES.map((m) => m.version)).toEqual([1, 2, 3]);
    const bd = crearBdDePrueba();
    await migrar(bd);
    const tablas = await bd.consultar<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tablas.map((t) => t.name)).toEqual([
      'aportacion_a_objetivo',
      'categoria',
      'cuenta',
      'linea_de_presupuesto',
      'movimiento',
      'objetivo',
      'presupuesto',
      'regla_recurrente',
      'valor_de_inversion',
    ]);
  });

  it('la base de datos rechaza por sí misma los datos incoherentes', async () => {
    const { bd, banco, cat } = await preparar();
    const regla = (clase: string, tipo: string, extra = 'NULL', categoria = `'${cat('Ocio')}'`) =>
      bd.ejecutar(
        `INSERT INTO regla_recurrente (id, nombre, clase, tipo_movimiento, importe, divisa, cuenta_id,
           cuenta_destino_id, categoria_id, periodicidad, dia_del_mes, fecha_inicio, creado_en, modificado_en)
         VALUES ('${clase}${tipo}', 'x', '${clase}', '${tipo}', 100, 'EUR', '${banco.id}', ${extra},
                 ${categoria}, 'mensual', 5, '2026-01-01', 'x', 'x')`,
      );
    await expect(regla('fijo', 'ingreso')).rejects.toThrow();
    await expect(regla('aportacion', 'transferencia')).rejects.toThrow();
    await expect(regla('fijo', 'gasto', `'${banco.id}'`)).rejects.toThrow();
    await regla('fijo', 'gasto');
    await expect(
      bd.ejecutar(
        "INSERT INTO objetivo (id, nombre, tipo, meta, divisa, creado_en, modificado_en) VALUES ('o', 'x', 'ahorro', 0, 'EUR', 'x', 'x')",
      ),
    ).rejects.toThrow();
    await bd.ejecutar(
      "INSERT INTO presupuesto (id, periodo, creado_en, modificado_en) VALUES ('p1', '2026-11', 'x', 'x')",
    );
    await expect(
      bd.ejecutar(
        "INSERT INTO presupuesto (id, periodo, creado_en, modificado_en) VALUES ('p2', '2026-11', 'x', 'x')",
      ),
    ).rejects.toThrow();
  });
});

describe('repositorio de reglas recurrentes', () => {
  it('crea una regla con UUID, tipo derivado de la clase y divisa de la cuenta', async () => {
    const { gimnasio, banco } = await preparar();
    const regla = await gimnasio();
    expect(regla).toMatchObject({
      nombre: 'Gimnasio',
      clase: 'fijo',
      tipoMovimiento: 'gasto',
      importe: 3500,
      divisa: 'EUR',
      cuentaId: banco.id,
      cuentaDestinoId: null,
      periodicidad: 'mensual',
      diaDelMes: 18,
      fechaFin: null,
      activa: true,
      borradoEn: null,
    });
    expect(regla.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sin fecha de inicio empieza hoy', async () => {
    const { reglas, banco, cat } = await preparar();
    const regla = await reglas.crear({
      nombre: 'Música',
      clase: 'suscripcion',
      importe: 999,
      cuentaId: banco.id,
      categoriaId: cat('Ocio'),
      periodicidad: 'mensual',
      diaDelMes: 20,
    });
    expect(regla.fechaInicio).toBe(HOY);
  });

  it('lista por día, edita, desactiva, borra y deshace el borrado', async () => {
    const { reglas, gimnasio, banco, cat } = await preparar();
    const g = await gimnasio();
    const nomina = await reglas.crear({
      nombre: 'Nómina',
      clase: 'ingreso',
      importe: 190000,
      cuentaId: banco.id,
      categoriaId: cat('Nómina'),
      periodicidad: 'mensual',
      diaDelMes: 1,
    });
    expect((await reglas.listar()).map((r) => r.nombre)).toEqual(['Nómina', 'Gimnasio']);

    const editada = await reglas.modificar(g.id, {
      nombre: 'Gimnasio nuevo',
      clase: 'suscripcion',
      importe: 4000,
      cuentaId: banco.id,
      categoriaId: cat('Ocio'),
      periodicidad: 'anual',
      diaDelMes: 31,
      fechaFin: '2027-12-31',
    });
    expect(editada).toMatchObject({
      id: g.id,
      nombre: 'Gimnasio nuevo',
      clase: 'suscripcion',
      importe: 4000,
      periodicidad: 'anual',
      diaDelMes: 31,
      fechaFin: '2027-12-31',
      fechaInicio: '2026-01-01',
      creadoEn: g.creadoEn,
    });

    expect((await reglas.activar(nomina.id, false)).activa).toBe(false);
    expect(await reglas.listar()).toHaveLength(2);
    await reglas.borrar(nomina.id);
    expect((await reglas.listar()).map((r) => r.id)).toEqual([g.id]);
    await esperarError(reglas.borrar(nomina.id), 'regla_no_encontrada');
    expect((await reglas.restaurar(nomina.id)).borradoEn).toBeNull();
    expect(await reglas.listar()).toHaveLength(2);
  });

  it('rechaza nombres vacíos o duplicados que solo cambian en mayúsculas o acentos', async () => {
    const { reglas, gimnasio, banco, cat } = await preparar();
    const g = await gimnasio();
    const con = (nombre: string) =>
      reglas.crear({
        nombre,
        clase: 'fijo',
        importe: 100,
        cuentaId: banco.id,
        categoriaId: cat('Casa'),
        periodicidad: 'mensual',
        diaDelMes: 1,
      });
    await esperarError(con('   '), 'nombre_vacio');
    await esperarError(con(' GIMNÁSIO '), 'nombre_duplicado');
    // Editar una regla con su propio nombre no es un duplicado.
    await reglas.activar(g.id, true);
    await con('Gimnasio 2');
    expect(await reglas.listar()).toHaveLength(2);
  });

  it('rechaza importe, día, periodicidad, clase y fechas no válidos', async () => {
    const { reglas, banco, cat } = await preparar();
    const base = {
      nombre: 'Luz',
      clase: 'fijo' as const,
      importe: 6000,
      cuentaId: banco.id,
      categoriaId: cat('Casa'),
      periodicidad: 'mensual' as const,
      diaDelMes: 5,
    };
    await esperarError(reglas.crear({ ...base, importe: 0 }), 'importe_cero');
    await esperarError(reglas.crear({ ...base, importe: -5 }), 'importe_no_valido');
    await esperarError(reglas.crear({ ...base, importe: 10.5 }), 'importe_no_valido');
    await esperarError(reglas.crear({ ...base, diaDelMes: 0 }), 'dia_no_valido');
    await esperarError(reglas.crear({ ...base, diaDelMes: 32 }), 'dia_no_valido');
    await esperarError(reglas.crear({ ...base, diaDelMes: 1.5 }), 'dia_no_valido');
    await esperarError(
      reglas.crear({ ...base, periodicidad: 'semanal' as never }),
      'periodicidad_no_valida',
    );
    await esperarError(reglas.crear({ ...base, clase: 'otra' as never }), 'clase_no_valida');
    await esperarError(reglas.crear({ ...base, fechaInicio: '2026-02-30' }), 'fecha_no_valida');
    await esperarError(
      reglas.crear({ ...base, fechaInicio: '2026-11-01', fechaFin: '2026-10-31' }),
      'fecha_fin_anterior',
    );
    expect(await reglas.listar()).toEqual([]);
  });

  it('exige la coherencia entre clase, categoría y cuentas', async () => {
    const { reglas, cuentas, banco, ahorro, cat } = await preparar();
    const base = {
      nombre: 'Regla',
      importe: 1000,
      cuentaId: banco.id,
      periodicidad: 'mensual' as const,
      diaDelMes: 5,
    };
    await esperarError(reglas.crear({ ...base, clase: 'fijo' }), 'categoria_obligatoria');
    await esperarError(
      reglas.crear({ ...base, clase: 'fijo', categoriaId: cat('Nómina') }),
      'categoria_de_otro_tipo',
    );
    await esperarError(
      reglas.crear({ ...base, clase: 'ingreso', categoriaId: cat('Casa') }),
      'categoria_de_otro_tipo',
    );
    await esperarError(
      reglas.crear({ ...base, clase: 'aportacion' }),
      'cuenta_destino_obligatoria',
    );
    await esperarError(
      reglas.crear({ ...base, clase: 'aportacion', cuentaDestinoId: banco.id }),
      'misma_cuenta',
    );
    await esperarError(
      reglas.crear({ ...base, clase: 'fijo', categoriaId: cat('Casa'), cuentaId: 'no-existe' }),
      'cuenta_no_encontrada',
    );
    await esperarError(
      reglas.crear({
        ...base,
        clase: 'aportacion',
        cuentaDestinoId: ahorro.id,
        objetivoId: 'no-existe',
      }),
      'objetivo_no_encontrado',
    );
    const aportacion = await reglas.crear({
      ...base,
      clase: 'aportacion',
      cuentaDestinoId: ahorro.id,
      // Una aportación no lleva categoría aunque se le pase una.
      categoriaId: cat('Casa'),
    });
    expect(aportacion).toMatchObject({
      tipoMovimiento: 'transferencia',
      cuentaDestinoId: ahorro.id,
      categoriaId: null,
    });
    await cuentas.archivar(ahorro.id, true);
    await esperarError(
      reglas.crear({ ...base, nombre: 'Otra', clase: 'aportacion', cuentaDestinoId: ahorro.id }),
      'cuenta_archivada',
    );
  });
});

describe('confirmar un cobro', () => {
  it('crea un movimiento con origen recurrente, enlazado a la regla y con sus datos', async () => {
    const { reglas, movimientos, gimnasio, banco, cat } = await preparar();
    const regla = await gimnasio();
    const mov = await reglas.confirmar(regla.id, MES);
    expect(mov).toMatchObject({
      tipo: 'gasto',
      fecha: '2026-11-18',
      importe: 3500,
      cuentaId: banco.id,
      categoriaId: cat('Ocio'),
      nombre: 'Gimnasio',
      origen: 'recurrente',
      reglaRecurrenteId: regla.id,
      objetivoId: null,
    });
    const lista = await movimientos.listar();
    expect(lista).toHaveLength(1);
    const [o] = ocurrenciasDelMes([regla], lista, MES, HOY);
    expect(o).toMatchObject({ estado: 'confirmada', movimientoId: mov.id });
  });

  it('confirmar dos veces la misma ocurrencia no crea dos movimientos', async () => {
    const { reglas, movimientos, gimnasio } = await preparar();
    const regla = await gimnasio();
    const primero = await reglas.confirmar(regla.id, MES);
    const segundo = await reglas.confirmar(regla.id, MES, { importe: 9999 });
    expect(segundo.id).toBe(primero.id);
    expect(segundo.importe).toBe(3500);
    expect(await movimientos.listar()).toHaveLength(1);
    // Otro mes es otra ocurrencia.
    await reglas.confirmar(regla.id, '2026-12');
    expect(await movimientos.listar()).toHaveLength(2);
  });

  it('admite cambiar el importe y la fecha dentro del mes', async () => {
    const { reglas, gimnasio } = await preparar();
    const regla = await gimnasio();
    const mov = await reglas.confirmar(regla.id, MES, { importe: 3650, fecha: '2026-11-20' });
    expect(mov).toMatchObject({ importe: 3650, fecha: '2026-11-20' });
  });

  it('rechaza una fecha de otro mes, un mes sin ocurrencia y una regla inactiva o borrada', async () => {
    const { reglas, movimientos, gimnasio } = await preparar();
    const regla = await gimnasio();
    await esperarError(reglas.confirmar(regla.id, MES, { fecha: '2026-12-01' }), 'fecha_no_valida');
    await esperarError(reglas.confirmar(regla.id, '2025-12'), 'sin_ocurrencia');
    await esperarError(reglas.confirmar(regla.id, 'noviembre'), 'periodo_no_valido');
    await reglas.activar(regla.id, false);
    await esperarError(reglas.confirmar(regla.id, MES), 'sin_ocurrencia');
    await reglas.borrar(regla.id);
    await esperarError(reglas.confirmar(regla.id, MES), 'regla_no_encontrada');
    expect(await movimientos.listar()).toEqual([]);
  });

  it('si el movimiento confirmado se borra, la ocurrencia vuelve a pendiente; al deshacer, a confirmada', async () => {
    const { reglas, movimientos, gimnasio } = await preparar();
    const regla = await gimnasio();
    const mov = await reglas.confirmar(regla.id, MES);
    const estado = async () =>
      ocurrenciasDelMes([regla], await movimientos.listar(), MES, '2026-11-20')[0].estado;
    expect(await estado()).toBe('confirmada');
    await movimientos.borrar(mov.id);
    expect(await estado()).toBe('por_confirmar');
    await movimientos.restaurar(mov.id);
    expect(await estado()).toBe('confirmada');
  });

  it('borrado el movimiento, se puede confirmar de nuevo y crea uno distinto', async () => {
    const { reglas, movimientos, gimnasio } = await preparar();
    const regla = await gimnasio();
    const primero = await reglas.confirmar(regla.id, MES);
    await movimientos.borrar(primero.id);
    const segundo = await reglas.confirmar(regla.id, MES);
    expect(segundo.id).not.toBe(primero.id);
    expect(await movimientos.listar()).toHaveLength(1);
  });

  it('si al movimiento se le cambia la fecha a otro mes, la ocurrencia vuelve a pendiente y la regla se conserva', async () => {
    const { reglas, movimientos, gimnasio, banco, cat } = await preparar();
    const regla = await gimnasio();
    const mov = await reglas.confirmar(regla.id, MES);
    const movido = await movimientos.modificar(mov.id, {
      tipo: 'gasto',
      fecha: '2026-10-28',
      importe: 3500,
      cuentaId: banco.id,
      categoriaId: cat('Ocio'),
      nombre: 'Gimnasio',
    });
    // Editar un movimiento no le quita su regla ni su origen.
    expect(movido).toMatchObject({ reglaRecurrenteId: regla.id, origen: 'recurrente' });
    const lista = await movimientos.listar();
    expect(ocurrenciasDelMes([regla], lista, MES, '2026-11-20')[0].estado).toBe('por_confirmar');
    expect(ocurrenciasDelMes([regla], lista, '2026-10', '2026-11-20')[0].estado).toBe('confirmada');
  });

  it('una regla cuya cuenta o categoría se archiva sigue ocurriendo, pero confirmarla lo explica', async () => {
    const { reglas, cuentas, categorias, movimientos, gimnasio, banco, cat } = await preparar();
    const regla = await gimnasio();
    await categorias.archivar(cat('Ocio'), true);
    expect(ocurrenciasDelMes([regla], [], MES, HOY)).toHaveLength(1);
    await esperarError(reglas.confirmar(regla.id, MES), 'categoria_archivada');
    await categorias.archivar(cat('Ocio'), false);
    await cuentas.archivar(banco.id, true);
    await esperarError(reglas.confirmar(regla.id, MES), 'cuenta_archivada');
    expect(await movimientos.listar()).toEqual([]);
    // La regla se puede seguir editando con la cuenta que ya tenía.
    const editada = await reglas.modificar(regla.id, {
      nombre: 'Gimnasio',
      clase: 'fijo',
      importe: 3600,
      cuentaId: banco.id,
      categoriaId: cat('Ocio'),
      periodicidad: 'mensual',
      diaDelMes: 18,
    });
    expect(editada.importe).toBe(3600);
  });

  it('«Ya lo anoté» enlaza un movimiento existente del mismo mes, tipo y cuenta, sin crear nada', async () => {
    const { reglas, movimientos, gimnasio, banco, ahorro, cat } = await preparar();
    const regla = await gimnasio();
    const nuevo = (fecha: string, cuentaId = banco.id, tipo: 'gasto' | 'ingreso' = 'gasto') =>
      movimientos.crear({
        tipo,
        fecha,
        importe: 3500,
        cuentaId,
        categoriaId: tipo === 'gasto' ? cat('Ocio') : cat('Nómina'),
        nombre: `${tipo} ${fecha}`,
      });
    const bueno = await nuevo('2026-11-17');
    const otroMes = await nuevo('2026-10-17');
    const otraCuenta = await nuevo('2026-11-16', ahorro.id);
    const otroTipo = await nuevo('2026-11-15', banco.id, 'ingreso');

    expect((await reglas.candidatos(regla.id, MES)).map((m) => m.id)).toEqual([bueno.id]);
    for (const malo of [otroMes, otraCuenta, otroTipo]) {
      await esperarError(reglas.enlazar(regla.id, MES, malo.id), 'movimiento_no_enlazable');
    }
    await esperarError(reglas.enlazar(regla.id, MES, 'no-existe'), 'movimiento_no_enlazable');

    const enlazado = await reglas.enlazar(regla.id, MES, bueno.id);
    expect(enlazado).toMatchObject({ id: bueno.id, reglaRecurrenteId: regla.id, origen: 'manual' });
    expect(await movimientos.listar()).toHaveLength(4);
    expect(await reglas.candidatos(regla.id, MES)).toEqual([]);
    // Ya confirmada: confirmar de nuevo devuelve el enlazado y no crea otro.
    expect((await reglas.confirmar(regla.id, MES)).id).toBe(bueno.id);
    expect(await movimientos.listar()).toHaveLength(4);
  });

  it('un movimiento que ya confirma otra regla no se puede enlazar', async () => {
    const { reglas, gimnasio, banco, cat } = await preparar();
    const regla = await gimnasio();
    const otra = await reglas.crear({
      nombre: 'Piscina',
      clase: 'fijo',
      importe: 2000,
      cuentaId: banco.id,
      categoriaId: cat('Ocio'),
      periodicidad: 'mensual',
      diaDelMes: 10,
      fechaInicio: '2026-01-01',
    });
    const mov = await reglas.confirmar(otra.id, MES);
    await esperarError(reglas.enlazar(regla.id, MES, mov.id), 'movimiento_no_enlazable');
  });
});

describe('repositorio de presupuestos', () => {
  it('crea el presupuesto de un mes con sus líneas y lo consulta', async () => {
    const { presupuestos, cat } = await preparar();
    expect(await presupuestos.delMes(MES)).toBeNull();
    const p = await presupuestos.guardar(
      MES,
      [
        { categoriaId: cat('Casa'), importe: 70000 },
        { categoriaId: cat('Ocio'), importe: 0 },
      ],
      '  Mes de ahorro  ',
    );
    expect(p).toMatchObject({ periodo: MES, nota: 'Mes de ahorro', borradoEn: null });
    expect(p.lineas.map((l) => [l.categoriaId, l.importe])).toEqual([
      [cat('Casa'), 70000],
      [cat('Ocio'), 0],
    ]);
    expect((await presupuestos.delMes(MES))?.id).toBe(p.id);
    expect(await presupuestos.delMes('2026-12')).toBeNull();
  });

  it('guardar de nuevo actualiza, añade y quita líneas sin duplicar el presupuesto', async () => {
    const { bd, presupuestos, cat } = await preparar();
    const primero = await presupuestos.guardar(MES, [
      { categoriaId: cat('Casa'), importe: 70000 },
      { categoriaId: cat('Ocio'), importe: 5000 },
    ]);
    const segundo = await presupuestos.guardar(MES, [{ categoriaId: cat('Casa'), importe: 65000 }]);
    expect(segundo.id).toBe(primero.id);
    expect(segundo.lineas.map((l) => [l.id, l.importe])).toEqual([[primero.lineas[0].id, 65000]]);
    expect(await bd.consultar('SELECT id FROM presupuesto')).toHaveLength(1);
    // La línea quitada queda con borrado lógico, y se puede volver a añadir.
    const tercero = await presupuestos.guardar(MES, [
      { categoriaId: cat('Casa'), importe: 65000 },
      { categoriaId: cat('Ocio'), importe: 4000 },
    ]);
    expect(tercero.lineas).toHaveLength(2);
    expect(await bd.consultar('SELECT id FROM linea_de_presupuesto')).toHaveLength(3);
  });

  it('admite un presupuesto sin líneas', async () => {
    const { presupuestos } = await preparar();
    expect((await presupuestos.guardar(MES, [])).lineas).toEqual([]);
  });

  it('rechaza un periodo mal escrito, importes negativos y categorías que no son de gasto', async () => {
    const { bd, presupuestos, categorias, cat } = await preparar();
    await esperarError(presupuestos.guardar('2026-13', []), 'periodo_no_valido');
    const con = (categoriaId: string, importe = 100) =>
      presupuestos.guardar(MES, [{ categoriaId, importe }]);
    await esperarError(con(cat('Casa'), -1), 'importe_no_valido');
    await esperarError(con(cat('Casa'), 1.5), 'importe_no_valido');
    await esperarError(con(cat('Nómina')), 'categoria_no_presupuestable');
    await esperarError(con('no-existe'), 'categoria_no_encontrada');
    await esperarError(
      presupuestos.guardar(MES, [
        { categoriaId: cat('Casa'), importe: 1 },
        { categoriaId: cat('Casa'), importe: 2 },
      ]),
      'categoria_no_presupuestable',
    );
    // Una subcategoría no lleva línea propia: suma en su categoría principal.
    const sub = await categorias.crear({ nombre: 'Luz', tipo: 'gasto' });
    await bd.ejecutar('UPDATE categoria SET padre_id = ? WHERE id = ?', [cat('Casa'), sub.id]);
    await esperarError(con(sub.id), 'categoria_no_presupuestable');
    expect(await presupuestos.delMes(MES)).toBeNull();
  });

  it('borra el presupuesto de un mes y deshace el borrado con sus líneas', async () => {
    const { presupuestos, cat } = await preparar();
    await presupuestos.guardar(MES, [{ categoriaId: cat('Casa'), importe: 70000 }]);
    const id = await presupuestos.borrar(MES);
    expect(await presupuestos.delMes(MES)).toBeNull();
    await esperarError(presupuestos.borrar(MES), 'presupuesto_no_encontrado');
    const recuperado = await presupuestos.restaurar(id);
    expect(recuperado.id).toBe(id);
    expect(recuperado.lineas.map((l) => l.importe)).toEqual([70000]);
    await esperarError(presupuestos.restaurar('no-existe'), 'presupuesto_no_encontrado');
  });

  it('deshacer un borrado cuando ya hay otro presupuesto ese mes deja solo el restaurado', async () => {
    const { bd, presupuestos, cat } = await preparar();
    await presupuestos.guardar(MES, [{ categoriaId: cat('Casa'), importe: 1 }]);
    const id = await presupuestos.borrar(MES);
    await presupuestos.guardar(MES, [{ categoriaId: cat('Casa'), importe: 2 }]);
    const recuperado = await presupuestos.restaurar(id);
    expect(recuperado.lineas.map((l) => l.importe)).toEqual([1]);
    expect(await bd.consultar('SELECT id FROM presupuesto WHERE borrado_en IS NULL')).toHaveLength(
      1,
    );
  });
});

describe('repositorio de objetivos', () => {
  it('crea, consulta, edita, archiva, borra y deshace', async () => {
    const { objetivos, ahorro } = await preparar();
    const viaje = await objetivos.crear({
      nombre: '  Viaje  a Japón ',
      tipo: 'ahorro',
      meta: 150000,
      fechaLimite: '2027-07-31',
      cuentaId: ahorro.id,
    });
    expect(viaje).toMatchObject({
      nombre: 'Viaje a Japón',
      tipo: 'ahorro',
      meta: 150000,
      divisa: 'EUR',
      fechaLimite: '2027-07-31',
      cuentaId: ahorro.id,
      archivado: false,
      borradoEn: null,
    });
    expect(viaje.id).toMatch(/^[0-9a-f-]{36}$/);
    const editado = await objetivos.modificar(viaje.id, {
      nombre: 'Viaje',
      tipo: 'inversion',
      meta: 200000,
    });
    expect(editado).toMatchObject({
      nombre: 'Viaje',
      tipo: 'inversion',
      meta: 200000,
      fechaLimite: null,
      cuentaId: null,
      creadoEn: viaje.creadoEn,
    });
    await objetivos.archivar(viaje.id, true);
    expect(await objetivos.listar()).toEqual([]);
    expect(await objetivos.listar({ incluirArchivados: true })).toHaveLength(1);
    await objetivos.archivar(viaje.id, false);
    await objetivos.borrar(viaje.id);
    expect(await objetivos.listar({ incluirArchivados: true })).toEqual([]);
    await esperarError(objetivos.exigir(viaje.id), 'objetivo_no_encontrado');
    expect((await objetivos.restaurar(viaje.id)).borradoEn).toBeNull();
    expect(await objetivos.listar()).toHaveLength(1);
  });

  it('rechaza nombres vacíos o duplicados, metas no válidas, fechas irreales y cuentas inexistentes', async () => {
    const { objetivos } = await preparar();
    const base = { nombre: 'Viaje', tipo: 'ahorro' as const, meta: 150000 };
    await objetivos.crear(base);
    await esperarError(objetivos.crear({ ...base, nombre: ' ' }), 'nombre_vacio');
    await esperarError(objetivos.crear({ ...base, nombre: 'VIÁJE' }), 'nombre_duplicado');
    const otro = { ...base, nombre: 'Coche' };
    await esperarError(objetivos.crear({ ...otro, meta: 0 }), 'meta_no_valida');
    await esperarError(objetivos.crear({ ...otro, meta: -1 }), 'meta_no_valida');
    await esperarError(objetivos.crear({ ...otro, meta: 0.5 }), 'meta_no_valida');
    await esperarError(objetivos.crear({ ...otro, fechaLimite: '2027-02-30' }), 'fecha_no_valida');
    await esperarError(objetivos.crear({ ...otro, cuentaId: 'no-existe' }), 'cuenta_no_encontrada');
    expect(await objetivos.listar()).toHaveLength(1);
    // Una meta de más de un millón es válida.
    expect((await objetivos.crear({ ...otro, meta: 123456789 })).meta).toBe(123456789);
  });

  it('anota aportaciones sin movimiento, las lista, las borra y deshace', async () => {
    const { objetivos } = await preparar();
    const viaje = await objetivos.crear({ nombre: 'Viaje', tipo: 'ahorro', meta: 150000 });
    const a = await objetivos.aportar({
      objetivoId: viaje.id,
      fecha: '2026-11-01',
      importe: 30000,
      nota: ' Paga extra ',
    });
    expect(a).toMatchObject({ importe: 30000, movimientoId: null, nota: 'Paga extra' });
    await objetivos.aportar({ objetivoId: viaje.id, fecha: '2026-11-10', importe: 20000 });
    const lista = await objetivos.listarAportaciones(viaje.id);
    expect(lista.map((x) => x.importe)).toEqual([20000, 30000]);
    expect(estadoDeObjetivo(viaje, lista, HOY).aportado).toBe(50000);

    await objetivos.borrarAportacion(a.id);
    expect(estadoDeObjetivo(viaje, await objetivos.listarAportaciones(), HOY).aportado).toBe(20000);
    await esperarError(objetivos.borrarAportacion(a.id), 'aportacion_no_encontrada');
    await objetivos.restaurarAportacion(a.id);
    expect(await objetivos.listarAportaciones(viaje.id)).toHaveLength(2);
  });

  it('rechaza aportaciones de importe cero o negativo, con fecha irreal o a un objetivo archivado o inexistente', async () => {
    const { objetivos } = await preparar();
    const viaje = await objetivos.crear({ nombre: 'Viaje', tipo: 'ahorro', meta: 150000 });
    const con = (importe: number, fecha = HOY, objetivoId = viaje.id) =>
      objetivos.aportar({ objetivoId, fecha, importe });
    await esperarError(con(0), 'importe_cero');
    await esperarError(con(-1), 'importe_no_valido');
    await esperarError(con(1.5), 'importe_no_valido');
    await esperarError(con(100, '2026-13-01'), 'fecha_no_valida');
    await esperarError(con(100, HOY, 'no-existe'), 'objetivo_no_encontrado');
    await objetivos.archivar(viaje.id, true);
    await esperarError(con(100), 'objetivo_archivado');
    expect(await objetivos.listarAportaciones()).toEqual([]);
    // Un céntimo es una aportación válida.
    await objetivos.archivar(viaje.id, false);
    expect((await con(1)).importe).toBe(1);
  });
});

describe('aportación mensual a un objetivo (T-072)', () => {
  async function conAportacion() {
    const t = await preparar();
    const viaje = await t.objetivos.crear({
      nombre: 'Viaje',
      tipo: 'ahorro',
      meta: 150000,
      cuentaId: t.ahorro.id,
    });
    const regla = await t.reglas.crear({
      nombre: 'Ahorro para el viaje',
      clase: 'aportacion',
      importe: 12500,
      cuentaId: t.banco.id,
      cuentaDestinoId: t.ahorro.id,
      periodicidad: 'mensual',
      diaDelMes: 1,
      fechaInicio: '2026-11-01',
      objetivoId: viaje.id,
    });
    return { ...t, viaje, regla };
  }

  it('confirmarla crea la transferencia con el objetivo y suma al objetivo', async () => {
    const { reglas, objetivos, cuentas, banco, ahorro, viaje, regla } = await conAportacion();
    const mov = await reglas.confirmar(regla.id, MES);
    expect(mov).toMatchObject({
      tipo: 'transferencia',
      importe: 12500,
      cuentaId: banco.id,
      cuentaDestinoId: ahorro.id,
      categoriaId: null,
      origen: 'recurrente',
      reglaRecurrenteId: regla.id,
      objetivoId: viaje.id,
    });
    const aportaciones = await objetivos.listarAportaciones(viaje.id);
    expect(aportaciones).toHaveLength(1);
    expect(aportaciones[0]).toMatchObject({
      importe: 12500,
      fecha: '2026-11-01',
      movimientoId: mov.id,
    });
    expect(await cuentas.saldo(ahorro.id)).toBe(12500);
    expect(await cuentas.saldo(banco.id)).toBe(500000 - 12500);
    // Confirmar otra vez no duplica ni el movimiento ni la aportación.
    await reglas.confirmar(regla.id, MES);
    expect(await objetivos.listarAportaciones(viaje.id)).toHaveLength(1);
  });

  it('borrar el movimiento borra su aportación, y deshacer recupera las dos cosas', async () => {
    const { reglas, movimientos, objetivos, viaje, regla } = await conAportacion();
    const mov = await reglas.confirmar(regla.id, MES);
    const suelta = await objetivos.aportar({ objetivoId: viaje.id, fecha: HOY, importe: 700 });
    const aportado = async () =>
      estadoDeObjetivo(viaje, await objetivos.listarAportaciones(viaje.id), HOY).aportado;
    expect(await aportado()).toBe(13200);

    await movimientos.borrar(mov.id);
    expect(await aportado()).toBe(700);
    await movimientos.restaurar(mov.id);
    expect(await aportado()).toBe(13200);
    expect((await movimientos.obtener(mov.id))?.borradoEn).toBeNull();
    // La aportación suelta nunca se vio afectada.
    expect((await objetivos.obtenerAportacion(suelta.id))?.borradoEn).toBeNull();
  });

  it('deshacer el borrado no resucita una aportación que se había borrado antes a mano', async () => {
    const { reglas, movimientos, objetivos, viaje, regla } = await conAportacion();
    const mov = await reglas.confirmar(regla.id, MES);
    const [aportacion] = await objetivos.listarAportaciones(viaje.id);
    await objetivos.borrarAportacion(aportacion.id);
    await movimientos.borrar(mov.id);
    await movimientos.restaurar(mov.id);
    expect(await objetivos.listarAportaciones(viaje.id)).toEqual([]);
  });

  it('«Ya lo anoté» sobre una transferencia existente también suma al objetivo', async () => {
    const { reglas, movimientos, objetivos, banco, ahorro, viaje, regla } = await conAportacion();
    const mov = await movimientos.crear({
      tipo: 'transferencia',
      fecha: '2026-11-03',
      importe: 10000,
      cuentaId: banco.id,
      cuentaDestinoId: ahorro.id,
    });
    const enlazado = await reglas.enlazar(regla.id, MES, mov.id);
    expect(enlazado).toMatchObject({ reglaRecurrenteId: regla.id, objetivoId: viaje.id });
    const aportaciones = await objetivos.listarAportaciones(viaje.id);
    expect(aportaciones.map((a) => [a.importe, a.movimientoId])).toEqual([[10000, mov.id]]);
    expect(await movimientos.listar()).toHaveLength(1);
  });
});
