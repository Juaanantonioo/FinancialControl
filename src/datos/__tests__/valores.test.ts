import { MIGRACIONES, migrar, versionDelEsquema } from '@/datos/migraciones';
import { crearRepositorios } from '@/datos';
import {
  crearBdDePrueba,
  crearEntornoDePrueba,
  esperarError,
  prepararPrueba,
} from '@/pruebas/bdDePrueba';

// El reloj de prueba empieza el 15/11/2026.
const HOY = '2026-11-15';

async function conBroker() {
  const t = await prepararPrueba([{ nombre: 'Comida', tipo: 'gasto' }]);
  const banco = await t.cuentas.crear({
    nombre: 'Banco',
    tipo: 'banco',
    saldoInicial: 500000,
    fechaSaldoInicial: '2026-01-01',
  });
  const broker = await t.cuentas.crear({
    nombre: 'Bróker',
    tipo: 'inversion',
    saldoInicial: 0,
    fechaSaldoInicial: '2026-02-01',
  });
  return { ...t, banco, broker };
}

describe('migración 2: valores de inversión', () => {
  it('una base de datos con el esquema anterior migra sin perder ni alterar datos', async () => {
    const bd = crearBdDePrueba();
    // Esquema de H2 (versión 1) con datos de ejemplo.
    await bd.ejecutar('PRAGMA foreign_keys = ON');
    await migrar(
      bd,
      MIGRACIONES.filter((m) => m.version === 1),
    );
    expect(await versionDelEsquema(bd)).toBe(1);
    const repos = crearRepositorios(bd, crearEntornoDePrueba());
    const banco = await repos.cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      saldoInicial: 215000,
      fechaSaldoInicial: '2026-10-15',
    });
    const broker = await repos.cuentas.crear({
      nombre: 'Bróker',
      tipo: 'inversion',
      saldoInicial: 580000,
      fechaSaldoInicial: '2026-10-15',
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
    await repos.movimientos.crear({
      tipo: 'transferencia',
      fecha: '2026-11-11',
      importe: 20000,
      cuentaId: banco.id,
      cuentaDestinoId: broker.id,
    });
    const borrado = await repos.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-12',
      importe: 999,
      cuentaId: banco.id,
    });
    await repos.movimientos.borrar(borrado.id);

    const volcar = async () => ({
      cuentas: await bd.consultar('SELECT * FROM cuenta ORDER BY id'),
      categorias: await bd.consultar('SELECT * FROM categoria ORDER BY id'),
      movimientos: await bd.consultar('SELECT * FROM movimiento ORDER BY id'),
    });
    const antes = await volcar();
    expect(antes.cuentas).toHaveLength(2);
    expect(antes.movimientos).toHaveLength(3);

    // Solo hasta la versión 2, que es la que comprueba esta prueba. El paso a la 3 tiene la suya.
    const resultado = await migrar(
      bd,
      MIGRACIONES.filter((m) => m.version <= 2),
    );
    expect(resultado).toEqual({ desde: 1, hasta: 2 });
    expect(await volcar()).toEqual(antes);
    expect(await repos.cuentas.saldo(banco.id)).toBe(215000 - 2340 - 20000);
    expect(await repos.valores.listar()).toEqual([]);
    // Y la tabla nueva funciona sobre los datos migrados.
    await repos.valores.registrar({ cuentaId: broker.id, fecha: '2026-11-12', valor: 612000 });
    expect(await repos.valores.listarPorCuenta(broker.id)).toHaveLength(1);
  });

  it('la migración 2 solo crea la tabla nueva y su índice', async () => {
    const m2 = MIGRACIONES.find((m) => m.version === 2);
    expect(m2?.sentencias).toHaveLength(2);
    for (const sentencia of m2?.sentencias ?? []) {
      expect(sentencia).toMatch(/valor_de_inversion/);
      expect(sentencia).not.toMatch(/ALTER|DROP|UPDATE|DELETE/i);
    }
    expect(MIGRACIONES.map((m) => m.version).slice(0, 2)).toEqual([1, 2]);
  });

  it('la base de datos rechaza un valor negativo y dos valores activos el mismo día', async () => {
    const { bd, broker } = await conBroker();
    const insertar = (id: string, valor: number) =>
      bd.ejecutar(
        `INSERT INTO valor_de_inversion (id, cuenta_id, fecha, valor, creado_en, modificado_en)
         VALUES (?, ?, '2026-03-01', ?, 'x', 'x')`,
        [id, broker.id, valor],
      );
    await expect(insertar('a', -1)).rejects.toThrow();
    await insertar('b', 100);
    await expect(insertar('c', 200)).rejects.toThrow();
  });
});

describe('repositorio de valores de inversión', () => {
  it('registra un valor con UUID, marcas de tiempo y sin borrar', async () => {
    const { valores, broker } = await conBroker();
    const v = await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-10', valor: 215000 });
    expect(v).toMatchObject({ cuentaId: broker.id, fecha: '2026-04-10', valor: 215000 });
    expect(v.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(v.borradoEn).toBeNull();
    expect(v.creadoEn).toBe(v.modificadoEn);
  });

  it('registrar otro valor el mismo día sustituye al anterior', async () => {
    const { valores, broker } = await conBroker();
    const primero = await valores.registrar({ cuentaId: broker.id, fecha: HOY, valor: 100000 });
    const segundo = await valores.registrar({ cuentaId: broker.id, fecha: HOY, valor: 123400 });
    expect(segundo.id).toBe(primero.id);
    expect(segundo.modificadoEn > primero.modificadoEn).toBe(true);
    const lista = await valores.listarPorCuenta(broker.id);
    expect(lista).toHaveLength(1);
    expect(lista[0].valor).toBe(123400);
  });

  it('admite el valor cero', async () => {
    const { valores, broker } = await conBroker();
    expect((await valores.registrar({ cuentaId: broker.id, fecha: HOY, valor: 0 })).valor).toBe(0);
  });

  it('lista por cuenta del más reciente al más antiguo', async () => {
    const { valores, cuentas, broker } = await conBroker();
    const fondo = await cuentas.crear({
      nombre: 'Fondo',
      tipo: 'inversion',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    for (const [fecha, valor] of [
      ['2026-03-01', 1],
      ['2026-11-01', 3],
      ['2026-06-01', 2],
    ] as const) {
      await valores.registrar({ cuentaId: broker.id, fecha, valor });
    }
    await valores.registrar({ cuentaId: fondo.id, fecha: '2026-05-05', valor: 9 });
    expect((await valores.listarPorCuenta(broker.id)).map((v) => v.valor)).toEqual([3, 2, 1]);
    expect(await valores.listarPorCuenta(fondo.id)).toHaveLength(1);
    expect(await valores.listar()).toHaveLength(4);
  });

  it('edita la fecha y el importe', async () => {
    const { valores, broker } = await conBroker();
    const v = await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-10', valor: 215000 });
    const editado = await valores.modificar(v.id, { fecha: '2026-04-12', valor: 216000 });
    expect(editado).toMatchObject({ id: v.id, fecha: '2026-04-12', valor: 216000 });
    expect(editado.creadoEn).toBe(v.creadoEn);
  });

  it('mover un valor a un día que ya tenía otro sustituye a ese otro', async () => {
    const { valores, broker } = await conBroker();
    const a = await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-10', valor: 1 });
    const b = await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-20', valor: 2 });
    await valores.modificar(b.id, { fecha: '2026-04-10', valor: 3 });
    const lista = await valores.listarPorCuenta(broker.id);
    expect(lista.map((v) => [v.id, v.fecha, v.valor])).toEqual([[b.id, '2026-04-10', 3]]);
    expect((await valores.obtener(a.id))?.borradoEn).not.toBeNull();
  });

  it('borra y deshace el borrado con los mismos datos', async () => {
    const { valores, broker } = await conBroker();
    const v = await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-10', valor: 215000 });
    await valores.borrar(v.id);
    expect(await valores.listarPorCuenta(broker.id)).toEqual([]);
    expect((await valores.obtener(v.id))?.borradoEn).not.toBeNull();
    await esperarError(valores.borrar(v.id), 'valor_no_encontrado');
    const recuperado = await valores.restaurar(v.id);
    expect(recuperado).toMatchObject({ id: v.id, fecha: '2026-04-10', valor: 215000 });
    expect(recuperado.borradoEn).toBeNull();
    expect(await valores.listarPorCuenta(broker.id)).toHaveLength(1);
  });

  it('deshacer un borrado cuando ya hay otro valor ese día deja solo el restaurado', async () => {
    const { valores, broker } = await conBroker();
    const v = await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-10', valor: 1 });
    await valores.borrar(v.id);
    await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-10', valor: 2 });
    await valores.restaurar(v.id);
    const lista = await valores.listarPorCuenta(broker.id);
    expect(lista.map((x) => [x.id, x.valor])).toEqual([[v.id, 1]]);
  });

  it('rechaza una cuenta que no es de inversión, inexistente o borrada', async () => {
    const { valores, cuentas, banco } = await conBroker();
    await esperarError(
      valores.registrar({ cuentaId: banco.id, fecha: HOY, valor: 1 }),
      'cuenta_no_es_de_inversion',
    );
    await esperarError(
      valores.registrar({ cuentaId: 'no-existe', fecha: HOY, valor: 1 }),
      'cuenta_no_encontrada',
    );
    const otra = await cuentas.crear({
      nombre: 'Temporal',
      tipo: 'inversion',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    await cuentas.borrar(otra.id);
    await esperarError(
      valores.registrar({ cuentaId: otra.id, fecha: HOY, valor: 1 }),
      'cuenta_no_encontrada',
    );
  });

  it('rechaza valores negativos, con decimales o que no son un número', async () => {
    const { valores, broker } = await conBroker();
    for (const valor of [-1, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await esperarError(
        valores.registrar({ cuentaId: broker.id, fecha: HOY, valor }),
        'valor_no_valido',
      );
    }
    expect(await valores.listar()).toEqual([]);
  });

  it('rechaza una fecha irreal, futura o anterior a la cuenta', async () => {
    const { valores, broker } = await conBroker();
    const con = (fecha: string) => valores.registrar({ cuentaId: broker.id, fecha, valor: 1 });
    await esperarError(con('2026-02-30'), 'fecha_no_valida');
    await esperarError(con('ayer'), 'fecha_no_valida');
    await esperarError(con('2026-11-16'), 'fecha_futura');
    await esperarError(con('2026-01-31'), 'fecha_anterior_a_la_cuenta');
    // El mismo día del saldo inicial y hoy sí valen.
    await con('2026-02-01');
    await con(HOY);
    expect(await valores.listar()).toHaveLength(2);
  });

  it('modificar aplica las mismas reglas y no cambia nada si falla', async () => {
    const { valores, broker } = await conBroker();
    const v = await valores.registrar({ cuentaId: broker.id, fecha: '2026-04-10', valor: 5 });
    await esperarError(valores.modificar(v.id, { fecha: '2027-01-01', valor: 5 }), 'fecha_futura');
    await esperarError(
      valores.modificar(v.id, { fecha: '2026-04-10', valor: -5 }),
      'valor_no_valido',
    );
    await esperarError(
      valores.modificar('no-existe', { fecha: '2026-04-10', valor: 5 }),
      'valor_no_encontrado',
    );
    expect(await valores.obtener(v.id)).toEqual(v);
  });
});

describe('filtros nuevos de movimientos', () => {
  it('filtra por día', async () => {
    const { movimientos, banco } = await conBroker();
    for (const fecha of ['2026-11-09', '2026-11-10', '2026-11-10', '2026-11-11']) {
      await movimientos.crear({ tipo: 'gasto', fecha, importe: 100, cuentaId: banco.id });
    }
    expect(await movimientos.listar({ dia: '2026-11-10' })).toHaveLength(2);
    expect(await movimientos.listar({ dia: '2026-11-12' })).toHaveLength(0);
    expect(await movimientos.listar({ dia: '2026-11-10', mes: '2026-10' })).toHaveLength(0);
  });

  it('una categoría principal incluye los movimientos de sus subcategorías', async () => {
    const { bd, movimientos, categorias, banco } = await conBroker();
    const [comida] = await categorias.listar();
    const supermercado = await categorias.crear({ nombre: 'Súper', tipo: 'gasto' });
    const fruta = await categorias.crear({ nombre: 'Fruta', tipo: 'gasto' });
    const casa = await categorias.crear({ nombre: 'Casa', tipo: 'gasto' });
    // Hoy ninguna pantalla crea subcategorías: se enlazan aquí a mano.
    await bd.ejecutar('UPDATE categoria SET padre_id = ? WHERE id = ?', [
      comida.id,
      supermercado.id,
    ]);
    await bd.ejecutar('UPDATE categoria SET padre_id = ? WHERE id = ?', [
      supermercado.id,
      fruta.id,
    ]);
    for (const cat of [comida, supermercado, fruta, casa]) {
      await movimientos.crear({
        tipo: 'gasto',
        fecha: '2026-11-10',
        importe: 100,
        cuentaId: banco.id,
        categoriaId: cat.id,
        nombre: cat.nombre,
      });
    }
    const nombres = async (categoriaId: string) =>
      (await movimientos.listar({ categoriaId })).map((m) => m.nombre).sort();
    expect(await nombres(comida.id)).toEqual(['Comida', 'Fruta', 'Súper']);
    expect(await nombres(supermercado.id)).toEqual(['Fruta', 'Súper']);
    expect(await nombres(fruta.id)).toEqual(['Fruta']);
    expect(await nombres(casa.id)).toEqual(['Casa']);
  });
});

describe('icono y color de una categoría', () => {
  it('guarda el icono y el color, y null vuelve al valor derivado', async () => {
    const { categorias } = await conBroker();
    const [comida] = await categorias.listar();
    const con = await categorias.cambiarAspecto(comida.id, { icono: ' 🎸 ', color: '#0e9f8e' });
    expect(con).toMatchObject({ icono: '🎸', color: '#0E9F8E', nombre: 'Comida' });
    expect(con.modificadoEn > comida.modificadoEn).toBe(true);
    const sin = await categorias.cambiarAspecto(comida.id, { icono: null, color: null });
    expect(sin).toMatchObject({ icono: null, color: null });
  });

  it('rechaza un color que no es un color y una categoría que no existe', async () => {
    const { categorias } = await conBroker();
    const [comida] = await categorias.listar();
    await esperarError(
      categorias.cambiarAspecto(comida.id, { icono: null, color: 'rojo' }),
      'color_no_valido',
    );
    await esperarError(
      categorias.cambiarAspecto('no-existe', { icono: null, color: null }),
      'categoria_no_encontrada',
    );
    expect((await categorias.obtener(comida.id))?.color).toBeNull();
  });
});
