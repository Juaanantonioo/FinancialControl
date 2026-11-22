/** La migración local 5: estado de la sincronización. No toca los datos existentes. */
import { crearRepositorios } from '@/datos';
import { conTransaccionesEnSerie } from '@/datos/bd';
import { MIGRACIONES, migrar, versionDelEsquema } from '@/datos/migraciones';
import { crearBdDePrueba, crearEntornoDePrueba, prepararPrueba } from '@/pruebas/bdDePrueba';
import { INICIALES, sembrarTodo, volcar } from '@/pruebas/sincronizacionDePrueba';
import { TABLAS } from '@/sincronizacion/tablas';

type Marca = { cambio: number; tabla: string; id: string };

describe('migración 5: estado de la sincronización', () => {
  it('una base en versión 4 con datos en todas las tablas pasa a la 5 sin perder ni alterar nada', async () => {
    const bd = crearBdDePrueba();
    await bd.ejecutar('PRAGMA foreign_keys = ON');
    await migrar(
      bd,
      MIGRACIONES.filter((m) => m.version <= 4),
    );
    expect(await versionDelEsquema(bd)).toBe(4);
    const entorno = crearEntornoDePrueba();
    const repos = crearRepositorios(bd, entorno);
    const datos = await sembrarTodo({ bd, entorno, ...repos } as never);
    await repos.avisos.registrar('aviso-anterior');
    const antes = await volcar(bd);
    const avisos = await bd.consultar('SELECT * FROM aviso_emitido');
    for (const tabla of TABLAS) expect(antes[tabla.nombre].length).toBeGreaterThan(0);

    expect(await migrar(bd)).toEqual({ desde: 4, hasta: 5 });
    expect(await volcar(bd)).toEqual(antes);
    expect(await bd.consultar('SELECT * FROM aviso_emitido')).toEqual(avisos);
    expect(await repos.cuentas.saldo(datos.banco.id)).toBe(215000 - 2340 - 5000);
    // Migrar no deja nada en la cola: lo que hay que subir se decide al entrar en una cuenta.
    expect(await bd.consultar('SELECT * FROM sinc_pendiente')).toEqual([]);

    // Y la app sigue escribiendo sobre los datos migrados.
    await repos.movimientos.borrar(datos.movimiento.id);
    const cola = await bd.consultar<Marca>('SELECT * FROM sinc_pendiente');
    expect(cola.map((m) => m.tabla)).toContain('movimiento');
  });

  it('solo crea tablas y disparadores nuevos, con nombre sinc_', () => {
    const m5 = MIGRACIONES.find((m) => m.version === 5)!;
    for (const sentencia of m5.sentencias) {
      expect(sentencia).toMatch(/^CREATE (TABLE|TRIGGER) sinc_/);
      expect(sentencia).not.toMatch(/ALTER|DROP/i);
    }
    expect(m5.sentencias.filter((s) => s.startsWith('CREATE TRIGGER'))).toHaveLength(24);
    expect(MIGRACIONES[MIGRACIONES.length - 1].version).toBe(5);
  });

  it('cada alta y cada cambio en una tabla sincronizada queda apuntado, con un número que solo crece', async () => {
    const d = await prepararPrueba(INICIALES);
    await d.bd.ejecutar('DELETE FROM sinc_pendiente');
    const cola = () => d.bd.consultar<Marca>('SELECT * FROM sinc_pendiente ORDER BY cambio');
    const banco = await d.cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    const [alta] = await cola();
    expect(alta).toMatchObject({ tabla: 'cuenta', id: banco.id });
    await d.cuentas.archivar(banco.id, true);
    const [cambio, ...resto] = await cola();
    expect(resto).toEqual([]);
    expect(cambio.cambio).toBeGreaterThan(alta.cambio);
    // Aunque la cola se vacíe, el número no vuelve atrás.
    await d.bd.ejecutar('DELETE FROM sinc_pendiente');
    await d.cuentas.archivar(banco.id, false);
    expect((await cola())[0].cambio).toBeGreaterThan(cambio.cambio);
  });

  it('todas las tablas sincronizadas apuntan sus cambios; aviso_emitido no', async () => {
    const d = await prepararPrueba(INICIALES);
    await d.bd.ejecutar('DELETE FROM sinc_pendiente');
    await sembrarTodo({ ...d, motor: null, volcar: null } as never);
    await d.avisos.registrar('un-aviso');
    const cola = await d.bd.consultar<Marca>('SELECT * FROM sinc_pendiente');
    const datos = await volcar(d.bd);
    for (const tabla of TABLAS) {
      const ids = cola.filter((m) => m.tabla === tabla.nombre).map((m) => m.id);
      const esperados = datos[tabla.nombre].map((f) => f.id);
      // Las categorías iniciales se crearon antes de vaciar la cola.
      if (tabla.nombre !== 'categoria') expect(ids.sort()).toEqual(esperados.sort());
    }
    expect(cola.map((m) => m.tabla)).not.toContain('aviso_emitido');
  });

  it('un cambio que se deshace con su transacción no deja marca', async () => {
    const d = await prepararPrueba(INICIALES);
    await d.bd.ejecutar('DELETE FROM sinc_pendiente');
    await expect(
      d.bd.transaccion(async () => {
        await d.categorias.crear({ nombre: 'Efímera', tipo: 'gasto' });
        throw new Error('se deshace');
      }),
    ).rejects.toThrow();
    expect(await d.bd.consultar('SELECT * FROM sinc_pendiente')).toEqual([]);
  });
});

describe('transacciones en serie', () => {
  it('dos transacciones pedidas a la vez no se pisan: la segunda espera', async () => {
    const cruda = crearBdDePrueba();
    await cruda.ejecutar('CREATE TABLE cosa (n INTEGER)');
    const ceder = () => new Promise<void>((seguir) => setTimeout(seguir, 5));
    const tarea = (bd: typeof cruda, n: number) =>
      bd.transaccion(async () => {
        await bd.ejecutar('INSERT INTO cosa (n) VALUES (?)', [n]);
        await ceder();
        await bd.ejecutar('INSERT INTO cosa (n) VALUES (?)', [n]);
      });
    // Sin la fila, la segunda intenta abrir una transacción dentro de la primera y falla.
    const sinFila = await Promise.allSettled([tarea(cruda, 1), tarea(cruda, 2)]);
    expect(sinFila.some((r) => r.status === 'rejected')).toBe(true);

    const otra = crearBdDePrueba();
    await otra.ejecutar('CREATE TABLE cosa (n INTEGER)');
    const enSerie = conTransaccionesEnSerie(otra);
    await Promise.all([tarea(enSerie, 1), tarea(enSerie, 2), tarea(enSerie, 3)]);
    const filas = await otra.consultar<{ n: number }>('SELECT n FROM cosa ORDER BY rowid');
    expect(filas.map((f) => f.n)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('una transacción que falla no atasca a las siguientes, y el error llega a quien la pidió', async () => {
    const bd = conTransaccionesEnSerie(crearBdDePrueba());
    await bd.ejecutar('CREATE TABLE cosa (n INTEGER)');
    const rota = bd.transaccion(async () => {
      await bd.ejecutar('INSERT INTO cosa (n) VALUES (1)');
      throw new Error('falla');
    });
    const buena = bd.transaccion(() => bd.ejecutar('INSERT INTO cosa (n) VALUES (2)'));
    await expect(rota).rejects.toThrow('falla');
    await buena;
    expect(await bd.consultar('SELECT n FROM cosa')).toEqual([{ n: 2 }]);
  });
});
