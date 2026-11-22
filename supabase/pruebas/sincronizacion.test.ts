/**
 * La sincronización cifrada contra un Supabase de verdad (instancia local),
 * con el cliente de verdad y el motor de la app. Los «dispositivos» son bases
 * SQLite en memoria con los repositorios y el motor reales.
 *
 * Cubre el apartado 8 del encargo del bloque 4b-2: sincronización y entrada
 * en una cuenta. El cambio de contraseña está en `contrasena.test.ts`.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { generarClaveDeDatos } from '@/cripto';
import {
  contarFilas,
  sembrarTodo,
  type Dispositivo,
  entrarSubiendo,
} from '@/pruebas/sincronizacionDePrueba';
import { cifrarFila } from '@/sincronizacion/filas';
import { crearServidorDeFilas } from '@/sincronizacion/servidor';
import { TABLAS } from '@/sincronizacion/tablas';

import { consultar, crearUsuario, type Usuario } from './apoyo';
import { dispositivoDe, pausa, redEspiada } from './apoyoDeSincronizacion';

type FilaRemota = {
  tabla: string;
  id: string;
  contenido: string;
  version_de_formato: number;
  borrada: boolean;
  actualizada_en: string;
};

const filasRemotasDe = (usuario: Usuario) =>
  consultar<FilaRemota>(
    `select tabla, id, contenido, version_de_formato, borrada, actualizada_en
       from public.fila_cifrada where user_id = '${usuario.id}' order by tabla, id`,
  );

/** Cuenta nueva con A ya subido (datos en las doce tablas) y B ya bajado. */
async function cuentaConDosDispositivos(nombre: string) {
  const usuario = await crearUsuario(nombre);
  const clave = await generarClaveDeDatos();
  const a = await dispositivoDe(usuario, clave);
  const datos = await sembrarTodo(a);
  expect(await entrarSubiendo(a)).toEqual({ estado: 'lista', accion: 'subir' });
  expect((await a.motor.ciclo()).estado).toBe('correcto');
  const b = await dispositivoDe(usuario, clave);
  expect(await entrarSubiendo(b)).toEqual({ estado: 'lista', accion: 'bajar' });
  expect((await b.motor.ciclo()).estado).toBe('correcto');
  return { usuario, clave, a, b, datos };
}

const gasto = (d: Dispositivo, cuentaId: string, nombre: string, importe = 100) =>
  d.movimientos.crear({ tipo: 'gasto', fecha: '2026-11-21', importe, cuentaId, nombre });

const pendientes = async (d: Dispositivo) => (await d.motor.resumen()).pendientes;

describe('dos dispositivos con la misma cuenta', () => {
  it('las doce tablas viajan y vuelven idénticas, campo a campo', async () => {
    const { a, b } = await cuentaConDosDispositivos('doce');
    const enA = await a.volcar();
    for (const tabla of TABLAS) expect(enA[tabla.nombre].length).toBeGreaterThan(0);
    expect(await b.volcar()).toEqual(enA);
    expect(await pendientes(a)).toBe(0);
    expect(await pendientes(b)).toBe(0);
  });

  it('un alta, un cambio y un borrado en A aparecen en B, y al revés', async () => {
    const { usuario, a, b, datos } = await cuentaConDosDispositivos('abc');
    const nuevo = await gasto(a, datos.banco.id, 'Alta en A', 1234);
    await a.cuentas.archivar(datos.broker.id, true);
    await a.movimientos.borrar(datos.movimiento.id);
    expect((await a.motor.ciclo()).estado).toBe('correcto');
    expect(await b.motor.ciclo()).toMatchObject({ estado: 'correcto', aplicadas: 3 });
    expect((await b.movimientos.obtener(nuevo.id))?.importe).toBe(1234);
    expect((await b.cuentas.obtener(datos.broker.id))?.archivada).toBe(true);
    expect((await b.movimientos.obtener(datos.movimiento.id))?.borradoEn).not.toBeNull();
    expect(await b.volcar()).toEqual(await a.volcar());

    // El borrado es lógico: la fila sigue en el servidor, marcada y cifrada.
    const remota = filasRemotasDe(usuario).find((f) => f.id === datos.movimiento.id);
    expect(remota?.borrada).toBe(true);

    // Y al revés.
    const deB = await gasto(b, datos.banco.id, 'Alta en B', 4321);
    await b.cuentas.archivar(datos.broker.id, false);
    await b.movimientos.borrar(nuevo.id);
    expect((await b.motor.ciclo()).estado).toBe('correcto');
    expect((await a.motor.ciclo()).aplicadas).toBe(3);
    expect((await a.movimientos.obtener(deB.id))?.importe).toBe(4321);
    expect((await a.cuentas.obtener(datos.broker.id))?.archivada).toBe(false);
    expect((await a.movimientos.obtener(nuevo.id))?.borradoEn).not.toBeNull();
    expect(await a.volcar()).toEqual(await b.volcar());
    // Nunca se ha usado DELETE: están todas las filas, vivas o marcadas.
    expect(filasRemotasDe(usuario)).toHaveLength(await contarFilas(a.bd));
  });

  it('conflicto: A y B cambian la misma fila sin conexión; gana la que sube después y la otra no deja restos', async () => {
    const { usuario, a, b, datos } = await cuentaConDosDispositivos('conflicto');
    const cambiar = (d: Dispositivo, nombre: string, importe: number) =>
      d.movimientos.modificar(datos.movimiento.id, {
        tipo: 'gasto',
        fecha: '2026-11-10',
        importe,
        cuentaId: datos.banco.id,
        categoriaId: datos.comida.id,
        nombre,
      });
    await cambiar(a, 'Versión de A', 1111);
    await cambiar(b, 'Versión de B', 2222);
    // B sube primero; A sube después: gana A, aunque B la cambió más tarde por su reloj.
    await b.motor.ciclo();
    await a.motor.ciclo();
    await b.motor.ciclo();
    for (const d of [a, b]) {
      expect(await d.movimientos.obtener(datos.movimiento.id)).toMatchObject({
        nombre: 'Versión de A',
        importe: 1111,
      });
      expect(await pendientes(d)).toBe(0);
    }
    expect(await b.volcar()).toEqual(await a.volcar());
    // En el servidor hay una sola fila para ese movimiento.
    expect(filasRemotasDe(usuario).filter((f) => f.id === datos.movimiento.id)).toHaveLength(1);
  });

  it('dos escrituras confirmadas fuera de orden: B recibe las dos', async () => {
    const { usuario, clave, a, b, datos } = await cuentaConDosDispositivos('orden');
    const otro = await dispositivoDe(usuario, clave);
    await entrarSubiendo(otro);
    await otro.motor.ciclo();
    // Un dispositivo con cursor ingenuo (sin ventana), para comprobar que el caso se da.
    const ingenuo = await dispositivoDe(usuario, clave, { ventanaMs: 0 });
    await entrarSubiendo(ingenuo);
    await ingenuo.motor.ciclo();

    // Alguien retiene la fila de la cuenta en el servidor durante unos segundos.
    const retencion = spawn(
      'npx',
      [
        'supabase',
        'db',
        'query',
        `select pg_sleep(4) /* retencion-${datos.banco.id} */ from (
           select 1 from public.fila_cifrada where id = '${datos.banco.id}' for update
         ) s`,
      ],
      { stdio: 'ignore' },
    );
    const terminada = new Promise<void>((seguir) => retencion.on('exit', () => seguir()));
    for (let i = 0; i < 40; i += 1) {
      const activas = consultar<{ n: number }>(
        `select count(*)::int as n from pg_stat_activity
          where query like '%retencion-${datos.banco.id}%' and query not like '%pg_stat_activity%'`,
      );
      if (activas[0]?.n > 0) break;
      await pausa(100);
    }

    // La escritura LENTA empieza ahora (su marca será la de este instante) y se queda esperando.
    await a.cuentas.archivar(datos.banco.id, true);
    let lentaConfirmada = false;
    const lenta = a.motor.ciclo().then((r) => {
      lentaConfirmada = true;
      return r;
    });
    await pausa(700);
    // La RÁPIDA empieza después y se confirma antes.
    const rapida = await gasto(otro, datos.broker.id, 'Rápida');
    expect((await otro.motor.ciclo()).estado).toBe('correcto');
    expect(lentaConfirmada).toBe(false);

    // B y el ingenuo bajan: ven la rápida y su cursor queda en ella.
    await b.motor.ciclo();
    await ingenuo.motor.ciclo();
    expect(await b.movimientos.obtener(rapida.id)).not.toBeNull();
    expect((await b.cuentas.obtener(datos.banco.id))?.archivada).toBe(false);

    await terminada;
    expect((await lenta).estado).toBe('correcto');
    const remotas = filasRemotasDe(usuario);
    const marcaLenta = remotas.find((f) => f.id === datos.banco.id)!.actualizada_en;
    const marcaRapida = remotas.find((f) => f.id === rapida.id)!.actualizada_en;
    // Confirmada después, pero con marca anterior: justo lo que un cursor ingenuo se salta.
    expect(new Date(marcaLenta).getTime()).toBeLessThan(new Date(marcaRapida).getTime());

    await b.motor.ciclo();
    await ingenuo.motor.ciclo();
    expect((await b.cuentas.obtener(datos.banco.id))?.archivada).toBe(true);
    // Con todos al día, B tiene exactamente lo mismo que A.
    await a.motor.ciclo();
    await b.motor.ciclo();
    expect(await b.volcar()).toEqual(await a.volcar());
    // El cursor sin ventana se la pierde: la prueba ejercita el caso de verdad.
    expect((await ingenuo.cuentas.obtener(datos.banco.id))?.archivada).toBe(false);
  }, 60_000);

  it('mil movimientos se suben y se bajan sin perder ninguno', async () => {
    const usuario = await crearUsuario('mil');
    const clave = await generarClaveDeDatos();
    const a = await dispositivoDe(usuario, clave);
    const banco = await a.cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    for (let i = 0; i < 1000; i += 1) await gasto(a, banco.id, `Movimiento ${i}`, i + 1);
    await entrarSubiendo(a);
    const subida = await a.motor.ciclo();
    expect(subida).toMatchObject({ estado: 'correcto', noSubidas: 0 });
    expect(subida.subidas).toBe(await contarFilas(a.bd));
    const b = await dispositivoDe(usuario, clave);
    expect(await entrarSubiendo(b)).toEqual({ estado: 'lista', accion: 'bajar' });
    const bajada = await b.motor.ciclo();
    expect(bajada).toMatchObject({ estado: 'correcto', retenidas: 0 });
    const enB = await b.volcar();
    expect(enB.movimiento).toHaveLength(1000);
    expect(enB).toEqual(await a.volcar());
    const suma = enB.movimiento.reduce((total, m) => total + Number(m.importe), 0);
    expect(suma).toBe((1000 * 1001) / 2);
    expect(
      consultar<{ n: number }>(
        `select count(*)::int as n from public.fila_cifrada where user_id = '${usuario.id}' and tabla = 'movimiento'`,
      )[0].n,
    ).toBe(1000);
  }, 120_000);

  it('sin conexión los cambios esperan, y salen al volver la conexión', async () => {
    const { usuario, clave, b, datos } = await cuentaConDosDispositivos('sinred');
    const red = redEspiada();
    const c = await dispositivoDe(usuario, clave, { red: red.fetch });
    await entrarSubiendo(c);
    await c.motor.ciclo();
    red.estado.cortada = true;
    const uno = await gasto(c, datos.banco.id, 'Sin cobertura 1');
    const dos = await gasto(c, datos.banco.id, 'Sin cobertura 2');
    expect((await c.motor.ciclo()).estado).toBe('sin_conexion');
    expect(await pendientes(c)).toBe(2);
    // La app sigue funcionando en local mientras tanto.
    expect((await c.movimientos.obtener(uno.id))?.nombre).toBe('Sin cobertura 1');
    red.estado.cortada = false;
    expect(await c.motor.ciclo()).toMatchObject({ estado: 'correcto', subidas: 2 });
    expect(await pendientes(c)).toBe(0);
    await b.motor.ciclo();
    expect(await b.movimientos.obtener(dos.id)).not.toBeNull();
  });
});

describe('casos límite', () => {
  it('una fila demasiado grande para el servidor no sube, se cuenta, y no detiene a las demás', async () => {
    const { a, b, datos } = await cuentaConDosDispositivos('grande');
    // Desde el bloque 5 la app limita los textos y ya no deja crear una nota así.
    await expect(
      a.movimientos.crear({
        tipo: 'gasto',
        fecha: '2026-11-21',
        importe: 100,
        cuentaId: datos.banco.id,
        nombre: 'Con una nota enorme',
        nota: 'x'.repeat(70_000),
      }),
    ).rejects.toMatchObject({ codigo: 'texto_demasiado_largo' });
    // Pero puede existir de antes: se escribe directamente en la base, como si ya estuviera.
    const enorme = await gasto(a, datos.banco.id, 'Con una nota enorme');
    await a.bd.ejecutar('UPDATE movimiento SET nota = ? WHERE id = ?', [
      'x'.repeat(70_000),
      enorme.id,
    ]);
    const normal = await gasto(a, datos.banco.id, 'Normal');
    expect(await a.motor.ciclo()).toMatchObject({ estado: 'parcial', subidas: 1, noSubidas: 1 });
    expect(await pendientes(a)).toBe(1);
    await b.motor.ciclo();
    expect(await b.movimientos.obtener(normal.id)).not.toBeNull();
    expect(await b.movimientos.obtener(enorme.id)).toBeNull();
    // En local la fila sigue entera, sin recortar; si se acorta, sube.
    expect((await a.movimientos.obtener(enorme.id))?.nota).toHaveLength(70_000);
    await a.movimientos.modificar(enorme.id, {
      tipo: 'gasto',
      fecha: '2026-11-21',
      importe: 100,
      cuentaId: datos.banco.id,
      nombre: 'Con una nota razonable',
      nota: 'x'.repeat(2_000),
    });
    expect(await a.motor.ciclo()).toMatchObject({ estado: 'correcto', subidas: 1 });
    await b.motor.ciclo();
    expect((await b.movimientos.obtener(enorme.id))?.nota).toHaveLength(2_000);
  });

  it('borrar la cuenta borra del servidor todas sus filas cifradas', async () => {
    const { usuario } = await cuentaConDosDispositivos('borrada');
    expect(filasRemotasDe(usuario).length).toBeGreaterThan(12);
    const { error } = await usuario.cliente.rpc('borrar_mi_cuenta');
    expect(error).toBeNull();
    expect(filasRemotasDe(usuario)).toEqual([]);
  });

  it('dos dispositivos que sincronizan a la vez acaban iguales', async () => {
    const { a, b, datos } = await cuentaConDosDispositivos('alavez');
    for (let i = 0; i < 20; i += 1) {
      await gasto(a, datos.banco.id, `De A ${i}`, 100 + i);
      await gasto(b, datos.banco.id, `De B ${i}`, 200 + i);
    }
    await Promise.all([a.motor.ciclo(), b.motor.ciclo()]);
    await Promise.all([a.motor.ciclo(), b.motor.ciclo()]);
    await a.motor.ciclo();
    const enA = await a.volcar();
    expect(enA.movimiento.filter((m) => String(m.nombre).startsWith('De '))).toHaveLength(40);
    expect(await b.volcar()).toEqual(enA);
  });
});

describe('lo que llega al servidor', () => {
  it('ningún campo de ninguna fila en claro: ni en las peticiones ni en la tabla remota', async () => {
    const usuario = await crearUsuario('espia');
    const clave = await generarClaveDeDatos();
    const red = redEspiada();
    const a = await dispositivoDe(usuario, clave, { red: red.fetch });
    const datos = await sembrarTodo(a);
    await entrarSubiendo(a);
    await a.motor.ciclo();
    await a.movimientos.borrar(datos.movimiento.id);
    await a.motor.ciclo({ repaso: true });

    const filas = Object.values(await a.volcar()).flat();
    // Valores con algo que buscar: los muy cortos (0, 1, «EUR») salen por azar en cualquier texto.
    const sensibles = new Set<string>();
    for (const fila of filas) {
      for (const [columna, valor] of Object.entries(fila)) {
        if (columna !== 'id' && valor !== null && String(valor).length >= 5) {
          sensibles.add(String(valor));
        }
      }
    }
    expect(sensibles.size).toBeGreaterThan(30);
    expect(sensibles).toContain('Mercado');
    expect(sensibles).toContain('215000');

    // 1. Las peticiones: URL y cuerpo, sin los sobres (que son base64 al azar).
    const subidas = red.peticiones.filter(
      (p) => p.metodo === 'POST' && p.url.includes('fila_cifrada'),
    );
    expect(subidas.length).toBeGreaterThan(0);
    const idsDeFilas = new Set(filas.map((f) => String(f.id)));
    for (const peticion of red.peticiones) {
      let texto = `${decodeURIComponent(peticion.url)} ${peticion.cuerpo}`;
      for (const id of idsDeFilas) texto = texto.split(id).join('');
      // Las marcas de tiempo del cursor son del servidor (la fecha de hoy), no de ninguna fila.
      texto = texto.replace(
        /"?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})"?/g,
        '',
      );
      if (peticion.cuerpo.startsWith('[')) {
        const enviadas = JSON.parse(peticion.cuerpo) as Record<string, unknown>[];
        for (const enviada of enviadas) {
          expect(Object.keys(enviada).sort()).toEqual([
            'borrada',
            'contenido',
            'id',
            'tabla',
            'user_id',
            'version_de_formato',
          ]);
          expect(enviada.contenido).toMatch(/^[A-Za-z0-9_-]{55,}$/);
          texto = texto.split(String(enviada.contenido)).join('');
        }
      }
      for (const valor of sensibles) {
        // Los nombres de tabla sí viajan: «valor_de_inversion» contiene «inversion».
        if (TABLAS.some((t) => t.nombre.includes(valor))) continue;
        expect(texto).not.toContain(valor);
      }
    }

    // 2. La tabla remota, leída como administrador.
    const remotas = filasRemotasDe(usuario);
    expect(remotas).toHaveLength(filas.length);
    const todoLoGuardado = remotas.map((f) => f.contenido).join(' ');
    for (const valor of sensibles) expect(todoLoGuardado).not.toContain(valor);
    for (const remota of remotas) {
      expect(remota.contenido).toMatch(/^[A-Za-z0-9_-]{55,}$/);
      expect(remota.version_de_formato).toBe(1);
      // El tamaño va por tramos de 256 bytes: 1 de versión + 24 de nonce + n·256 + 16 de etiqueta.
      const bytes = Buffer.from(remota.contenido, 'base64url').length;
      expect((bytes - 41) % 256).toBe(0);
    }
    // Las columnas de la tabla son las que son: no hay dónde poner nada en claro.
    const columnas = consultar<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'fila_cifrada' order by column_name`,
    );
    expect(columnas.map((c) => c.column_name)).toEqual([
      'actualizada_en',
      'borrada',
      'contenido',
      'id',
      'tabla',
      'user_id',
      'version_de_formato',
    ]);
    // Y nunca se pidió un DELETE.
    expect(red.peticiones.filter((p) => p.metodo === 'DELETE')).toEqual([]);
  });
});

describe('sobres manipulados y otros usuarios', () => {
  it('un bit cambiado, movido a otro id, a otra tabla o copiado a otro usuario: no se aplica, no rompe el resto y se cuenta', async () => {
    const { usuario, clave, a, b, datos } = await cuentaConDosDispositivos('manipula');
    const [bit, deId, sana] = [
      await gasto(a, datos.banco.id, 'Bit'),
      await gasto(a, datos.banco.id, 'De id'),
      await gasto(a, datos.banco.id, 'Sana'),
    ];
    await a.motor.ciclo();
    const remotas = filasRemotasDe(usuario);
    const sobreDe = (id: string) => remotas.find((f) => f.id === id)!.contenido;
    const escribir = async (tabla: string, id: string, contenido: string) => {
      const { error } = await usuario.cliente
        .from('fila_cifrada')
        .upsert(
          { tabla, id, contenido, version_de_formato: 1 },
          { onConflict: 'user_id,tabla,id' },
        );
      expect(error).toBeNull();
    };
    // Un bit cambiado.
    const original = sobreDe(bit.id);
    const letra = original[40] === 'A' ? 'B' : 'A';
    await escribir('movimiento', bit.id, original.slice(0, 40) + letra + original.slice(41));
    // El sobre de una fila, puesto en otra.
    await escribir('movimiento', deId.id, sobreDe(sana.id));
    // El sobre de una cuenta, presentado como categoría con un id nuevo, y con el suyo.
    const idNuevo = randomUUID();
    await escribir('categoria', idNuevo, sobreDe(datos.banco.id));
    await escribir('categoria', datos.banco.id, sobreDe(datos.banco.id));

    const ciclo = await b.motor.ciclo();
    expect(ciclo.estado).toBe('correcto');
    expect(ciclo.retenidas).toBe(4);
    expect((await b.motor.resumen()).ilegibles).toBe(4);
    expect(await b.movimientos.obtener(sana.id)).not.toBeNull();
    expect(await b.movimientos.obtener(bit.id)).toBeNull();
    expect(await b.movimientos.obtener(deId.id)).toBeNull();
    expect((await b.volcar()).categoria.map((c) => c.id)).not.toContain(idNuevo);
    expect((await b.volcar()).categoria.map((c) => c.id)).not.toContain(datos.banco.id);
    // No se borra nada del servidor.
    expect(filasRemotasDe(usuario)).toHaveLength(remotas.length + 2);
    // La sincronización sigue: un cambio posterior llega con normalidad.
    const despues = await gasto(a, datos.banco.id, 'Después');
    await a.motor.ciclo();
    expect((await b.motor.ciclo()).retenidas).toBe(0);
    expect(await b.movimientos.obtener(despues.id)).not.toBeNull();

    // Copiado a otro usuario: C recibe en su cuenta un sobre de A.
    const c = await crearUsuario('copia');
    const claveDeC = await generarClaveDeDatos();
    const { error } = await c.cliente.from('fila_cifrada').insert({
      tabla: 'cuenta',
      id: datos.banco.id,
      contenido: sobreDe(datos.banco.id),
      version_de_formato: 1,
    });
    expect(error).toBeNull();
    // Ni con su clave ni —peor caso— con la clave de A se abre para el usuario C.
    for (const claveUsada of [claveDeC, clave]) {
      const dc = await dispositivoDe(c, claveUsada);
      // C tiene «datos» en la nube (el sobre copiado): su dispositivo nuevo baja.
      expect(await entrarSubiendo(dc)).toEqual({ estado: 'lista', accion: 'bajar' });
      expect(await dc.motor.ciclo()).toMatchObject({
        estado: 'correcto',
        aplicadas: 0,
        retenidas: 1,
      });
      expect((await dc.volcar()).cuenta).toEqual([]);
      expect((await dc.motor.resumen()).ilegibles).toBe(1);
    }
  });

  it('el usuario C no ve nada de A aunque conozca sus ids', async () => {
    const { usuario: a, clave, datos } = await cuentaConDosDispositivos('aislado');
    const c = await crearUsuario('curioso');
    const servidorDeC = crearServidorDeFilas(c.cliente);
    // Pide las filas de A por su id de usuario y por los ids de sus filas.
    expect(await servidorDeC.hayFilas(a.id)).toEqual({ ok: true, datos: false });
    expect(await servidorDeC.cambios(a.id, null, null, 500)).toEqual({ ok: true, datos: [] });
    expect(await servidorDeC.marcas(a.id, null, 500)).toEqual({ ok: true, datos: [] });
    expect(await servidorDeC.porIds(a.id, 'cuenta', [datos.banco.id])).toEqual({
      ok: true,
      datos: [],
    });
    expect(await servidorDeC.porIds(c.id, 'cuenta', [datos.banco.id])).toEqual({
      ok: true,
      datos: [],
    });
    const directa = await c.cliente.from('fila_cifrada').select('id').eq('id', datos.banco.id);
    expect(directa.data).toEqual([]);
    // Tampoco puede escribir en la cuenta de A.
    const sobre = await cifrarFila(clave, a.id, 'cuenta', {
      ...(await consultarCuenta(datos.banco.id)),
    });
    const intento = await servidorDeC.subir(a.id, [
      {
        tabla: 'cuenta',
        id: datos.banco.id,
        contenido: sobre,
        version_de_formato: 1,
        borrada: true,
      },
    ]);
    expect(intento.ok).toBe(false);
    expect(filasRemotasDe(a).find((f) => f.id === datos.banco.id)?.borrada).toBe(false);
    // Un dispositivo de C, aunque tuviera la clave de A, no baja nada: su nube está vacía.
    const dc = await dispositivoDe(c, clave);
    expect(await entrarSubiendo(dc)).toEqual({ estado: 'lista', accion: 'subir' });
    expect((await dc.motor.ciclo()).aplicadas).toBe(0);
    expect((await dc.volcar()).cuenta).toEqual([]);

    async function consultarCuenta(id: string) {
      return {
        id,
        nombre: 'x',
        tipo: 'banco',
        divisa: 'EUR',
        saldo_inicial: 0,
        fecha_saldo_inicial: '2026-01-01',
        archivada: 0,
        orden: 0,
        creado_en: 'x',
        modificado_en: 'x',
        borrado_en: null,
      };
    }
  });

  it('sin sesión el servidor no entrega ni acepta nada, y el motor lo llama sesión caducada', async () => {
    const { usuario, clave, datos } = await cuentaConDosDispositivos('caduca');
    const d = await dispositivoDe(usuario, clave);
    await entrarSubiendo(d);
    await d.motor.ciclo();
    await d.cliente.auth.signOut({ scope: 'local' });
    await gasto(d, datos.banco.id, 'Sin sesión');
    expect((await d.motor.ciclo()).estado).toBe('sesion_caducada');
    expect(await pendientes(d)).toBe(1);
  });
});

describe('entrada en una cuenta', () => {
  it('nube vacía y dispositivo con datos: pregunta; sin respuesta no sube nada; con el «sí», sube', async () => {
    const usuario = await crearUsuario('sube');
    const clave = await generarClaveDeDatos();
    const a = await dispositivoDe(usuario, clave);
    await sembrarTodo(a);
    const total = await contarFilas(a.bd);
    const antes = await a.volcar();
    expect(await a.motor.evaluarEntrada()).toEqual({ estado: 'preguntar', pregunta: 'subir' });
    expect((await a.motor.ciclo()).estado).toBe('sin_ligar');
    expect(filasRemotasDe(usuario)).toEqual([]);
    expect(await a.volcar()).toEqual(antes);
    expect(await a.motor.subirLoLocal()).toEqual({ estado: 'lista', accion: 'subir' });
    expect((await a.motor.ciclo()).subidas).toBe(total);
    expect(filasRemotasDe(usuario)).toHaveLength(total);
  });

  it('dispositivo recién instalado y nube con datos: baja, sin duplicar categorías iniciales', async () => {
    const { usuario, a, b } = await cuentaConDosDispositivos('baja');
    const categorias = (await b.volcar()).categoria;
    expect(categorias).toHaveLength(3);
    expect(categorias.filter((c) => c.nombre === 'Comida')).toHaveLength(1);
    expect(categorias).toEqual((await a.volcar()).categoria);
    // Las categorías iniciales de B no han subido.
    expect(filasRemotasDe(usuario).filter((f) => f.tabla === 'categoria')).toHaveLength(3);
  });

  it('ambos con datos: pregunta; «Cancelar» no cambia nada; «Usar la nube» exporta antes y luego reemplaza', async () => {
    const { usuario, clave, a } = await cuentaConDosDispositivos('ambos');
    const c = await dispositivoDe(usuario, clave);
    await sembrarTodo(c);
    const local = await c.volcar();
    const remotas = filasRemotasDe(usuario);
    expect(await entrarSubiendo(c)).toEqual({ estado: 'preguntar', pregunta: 'nube' });

    // «Cancelar»: no se hace nada más. Ni un ciclo pedido por error sube o baja.
    expect((await c.motor.ciclo()).estado).toBe('sin_ligar');
    expect(await c.volcar()).toEqual(local);
    expect(filasRemotasDe(usuario)).toEqual(remotas);

    // «Usar la nube», pero la persona cierra la hoja de compartir sin guardar.
    expect(await c.motor.usarLaNube(async () => false)).toEqual({ estado: 'sin_copia' });
    expect(await c.volcar()).toEqual(local);

    // «Usar la nube», guardando la copia.
    let copia: unknown = null;
    const resultado = await c.motor.usarLaNube(async () => {
      copia = await c.volcar();
      return true;
    });
    expect(resultado).toMatchObject({ estado: 'hecho', retenidas: 0 });
    expect(copia).toEqual(local);
    expect(await c.volcar()).toEqual(await a.volcar());
    // Lo local no ha subido encima de la nube.
    expect(filasRemotasDe(usuario)).toEqual(remotas);
    expect((await c.motor.ciclo()).subidas).toBe(0);
    expect(filasRemotasDe(usuario)).toEqual(remotas);
  });
});
