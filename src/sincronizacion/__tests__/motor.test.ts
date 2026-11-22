/**
 * El motor de sincronización contra un servidor de mentira. Las mismas
 * situaciones, contra un Supabase de verdad, están en
 * `supabase/pruebas/sincronizacion.test.ts`; aquí van además las que necesitan
 * un servidor que se pueda manipular.
 */
import { randomUUID } from 'node:crypto';

import { cifrarTexto, generarClaveDeDatos } from '@/cripto';
import { nubeDeMentira, type NubeDeMentira } from '@/pruebas/nubeDeMentira';
import {
  contarFilas,
  crearDispositivo,
  sembrarTodo,
  type Dispositivo,
} from '@/pruebas/sincronizacionDePrueba';
import { cifrarFila } from '@/sincronizacion/filas';
import { crearMotor } from '@/sincronizacion/motor';
import { TABLAS } from '@/sincronizacion/tablas';

let nube: NubeDeMentira;
let clave: Uint8Array;
let usuario: string;

beforeEach(async () => {
  nube = nubeDeMentira();
  clave = await generarClaveDeDatos();
  usuario = randomUUID();
});

/** Un dispositivo con la sesión de `quien` (por defecto, el usuario de la prueba). */
const dispositivo = (
  opciones: Partial<Parameters<typeof crearDispositivo>[0]> = {},
  quien: () => string | null = () => usuario,
) => crearDispositivo({ servidor: nube.servidorDe(quien), clave, ...opciones });

/** A con datos en las doce tablas y ya subidos; B recién instalado y ya bajado. */
async function dosDispositivos() {
  const a = await dispositivo();
  const datos = await sembrarTodo(a);
  expect(await a.motor.evaluarEntrada()).toEqual({ estado: 'lista', accion: 'subir' });
  expect((await a.motor.ciclo()).estado).toBe('correcto');
  const b = await dispositivo();
  expect(await b.motor.evaluarEntrada()).toEqual({ estado: 'lista', accion: 'bajar' });
  expect((await b.motor.ciclo()).estado).toBe('correcto');
  return { a, b, datos };
}

const pendientes = async (d: Dispositivo) => (await d.motor.resumen()).pendientes;

describe('sin cuenta ligada', () => {
  it('el motor no sube ni baja nada', async () => {
    const a = await dispositivo();
    await sembrarTodo(a);
    expect((await a.motor.ciclo()).estado).toBe('sin_ligar');
    expect(nube.estado.llamadas.filter((l) => l !== 'usuario')).toEqual([]);
    expect(nube.filas.size).toBe(0);
  });

  it('tampoco si la sesión es de otra cuenta que la ligada', async () => {
    let quien = usuario;
    const a = await dispositivo({}, () => quien);
    await sembrarTodo(a);
    await a.motor.evaluarEntrada();
    await a.motor.ciclo();
    const antes = nube.filas.size;
    quien = randomUUID();
    await a.cuentas.crear({
      nombre: 'Otra',
      tipo: 'efectivo',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-01-01',
    });
    expect((await a.motor.ciclo()).estado).toBe('sin_ligar');
    expect(nube.filas.size).toBe(antes);
  });

  it('sin sesión o sin clave, lo dice y no hace nada', async () => {
    const sinSesion = await dispositivo({}, () => null);
    expect(await sinSesion.motor.evaluarEntrada()).toEqual({ estado: 'sesion_caducada' });
    const a = await dispositivo();
    await a.motor.evaluarEntrada();
    const motor = crearMotor({
      bd: a.bd,
      servidor: nube.servidorDe(() => usuario),
      // El llavero ya no tiene la clave.
      leerClave: async () => null,
      ahora: a.entorno.ahora,
      categoriasIniciales: [],
    });
    expect((await motor.ciclo()).estado).toBe('sin_clave');
  });
});

describe('subida y bajada', () => {
  it('las doce tablas viajan y vuelven idénticas, campo a campo', async () => {
    const { a, b } = await dosDispositivos();
    const enA = await a.volcar();
    for (const tabla of TABLAS) expect(enA[tabla.nombre].length).toBeGreaterThan(0);
    expect(await b.volcar()).toEqual(enA);
    // Sin duplicar las categorías iniciales.
    expect(enA.categoria).toHaveLength(3);
  });

  it('al servidor solo llegan sobres: ningún campo de ninguna fila en claro', async () => {
    const { a } = await dosDispositivos();
    // Lo único que no es metadato es el contenido: ahí no puede leerse nada.
    const enviado = nube.estado.recibido.map((f) => f.contenido).join(' ');
    const filas = Object.values(await a.volcar()).flat();
    expect(nube.estado.recibido.length).toBe(filas.length);
    for (const fila of filas) {
      for (const [columna, valor] of Object.entries(fila)) {
        if (columna === 'id' || valor === null) continue;
        const texto = String(valor);
        // Los valores muy cortos (0, 1, «EUR») aparecen por azar en cualquier base64.
        if (texto.length >= 5) expect(enviado).not.toContain(texto);
      }
    }
    for (const fila of nube.estado.recibido) {
      expect(Object.keys(fila).sort()).toEqual([
        'borrada',
        'contenido',
        'id',
        'tabla',
        'version_de_formato',
      ]);
      expect(fila.contenido).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('un alta, un cambio y un borrado en A aparecen en B, y al revés', async () => {
    const { a, b, datos } = await dosDispositivos();
    const nuevo = await a.movimientos.crear({
      tipo: 'ingreso',
      fecha: '2026-11-20',
      importe: 150000,
      cuentaId: datos.banco.id,
      nombre: 'Nómina',
    });
    await a.cuentas.modificar(datos.banco.id, {
      nombre: 'Banco principal',
      tipo: 'banco',
      saldoInicial: 215000,
      fechaSaldoInicial: '2026-10-01',
    });
    await a.movimientos.borrar(datos.movimiento.id);
    await a.motor.ciclo();
    const ciclo = await b.motor.ciclo();
    expect(ciclo.estado).toBe('correcto');
    expect(await b.volcar()).toEqual(await a.volcar());
    expect((await b.movimientos.obtener(nuevo.id))?.importe).toBe(150000);
    expect((await b.cuentas.obtener(datos.banco.id))?.nombre).toBe('Banco principal');
    expect((await b.movimientos.obtener(datos.movimiento.id))?.borradoEn).not.toBeNull();
    // El borrado es lógico: la fila sigue en el servidor, marcada.
    expect(nube.filas.get(nube.clave(usuario, 'movimiento', datos.movimiento.id))?.borrada).toBe(
      true,
    );

    // Y al revés.
    await b.movimientos.borrar(nuevo.id);
    const otra = await b.cuentas.crear({
      nombre: 'Cartera',
      tipo: 'efectivo',
      saldoInicial: 5000,
      fechaSaldoInicial: '2026-11-01',
    });
    await b.motor.ciclo();
    await a.motor.ciclo();
    expect(await a.volcar()).toEqual(await b.volcar());
    expect((await a.cuentas.obtener(otra.id))?.nombre).toBe('Cartera');
    expect((await a.movimientos.obtener(nuevo.id))?.borradoEn).not.toBeNull();
  });

  it('lo bajado no se vuelve a subir, y lo ya conocido no se vuelve a aplicar', async () => {
    const { a, b } = await dosDispositivos();
    expect(await pendientes(b)).toBe(0);
    const subidas = nube.estado.recibido.length;
    const ciclo = await b.motor.ciclo();
    expect(ciclo).toMatchObject({ estado: 'correcto', subidas: 0, aplicadas: 0 });
    expect((await a.motor.ciclo()).aplicadas).toBe(0);
    expect(nube.estado.recibido.length).toBe(subidas);
  });

  it('pagina por clave aunque muchas filas compartan marca de tiempo', async () => {
    const a = await dispositivo({ filasPorLote: 50 });
    const banco = (await sembrarTodo(a)).banco;
    for (let i = 0; i < 60; i += 1) {
      await a.movimientos.crear({
        tipo: 'gasto',
        fecha: '2026-11-01',
        importe: 100 + i,
        cuentaId: banco.id,
        nombre: `Gasto ${i}`,
      });
    }
    await a.motor.evaluarEntrada();
    await a.motor.ciclo();
    const b = await dispositivo({ filasPorPagina: 7 });
    await b.motor.evaluarEntrada();
    await b.motor.ciclo();
    expect(await b.volcar()).toEqual(await a.volcar());
  });

  it('una fila que cambia mientras se sube sigue pendiente y sube después', async () => {
    const a = await dispositivo();
    const { banco } = await sembrarTodo(a);
    await a.motor.evaluarEntrada();
    const real = nube.servidorDe(() => usuario);
    let cambiada = false;
    // Un motor sobre la base de A cuyo servidor tarda: mientras la primera
    // subida viaja, la persona archiva la cuenta.
    const motor = crearMotor({
      bd: a.bd,
      servidor: {
        ...real,
        async subir(quien, filas) {
          if (!cambiada) {
            cambiada = true;
            await a.cuentas.archivar(banco.id, true);
          }
          return real.subir(quien, filas);
        },
      },
      leerClave: async () => new Uint8Array(clave),
      ahora: a.entorno.ahora,
      categoriasIniciales: [],
    });
    const ciclo = await motor.ciclo();
    expect(ciclo.estado).toBe('correcto');
    // La cuenta subió dos veces: la versión anterior y, después, la archivada.
    const subidasDeLaCuenta = nube.estado.recibido.filter((f) => f.id === banco.id);
    expect(subidasDeLaCuenta).toHaveLength(2);
    expect(await pendientes(a)).toBe(0);
    const b = await dispositivo();
    await b.motor.evaluarEntrada();
    await b.motor.ciclo();
    expect((await b.cuentas.obtener(banco.id))?.archivada).toBe(true);
  });
});

describe('conflictos', () => {
  it('gana la escritura que llega después al servidor, y la otra no deja restos', async () => {
    const { a, b, datos } = await dosDispositivos();
    const cambiar = (d: Dispositivo, nombre: string, importe: number) =>
      d.movimientos.modificar(datos.movimiento.id, {
        tipo: 'gasto',
        fecha: '2026-11-10',
        importe,
        cuentaId: datos.banco.id,
        categoriaId: datos.comida.id,
        nombre,
      });
    // Los dos cambian la misma fila sin conexión. B la cambia más tarde por su reloj…
    await cambiar(a, 'Versión de A', 1111);
    await cambiar(b, 'Versión de B', 2222);
    // …pero A sincroniza después: gana A.
    await b.motor.ciclo();
    await a.motor.ciclo();
    await b.motor.ciclo();
    for (const d of [a, b]) {
      const fila = await d.movimientos.obtener(datos.movimiento.id);
      expect(fila).toMatchObject({ nombre: 'Versión de A', importe: 1111 });
    }
    expect(await b.volcar()).toEqual(await a.volcar());
    expect(await pendientes(a)).toBe(0);
    expect(await pendientes(b)).toBe(0);
  });

  it('si uno borra y el otro cambia y sube después, la fila reaparece', async () => {
    const { a, b, datos } = await dosDispositivos();
    await a.movimientos.borrar(datos.movimiento.id);
    await b.movimientos.modificar(datos.movimiento.id, {
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 999,
      cuentaId: datos.banco.id,
      categoriaId: datos.comida.id,
      nombre: 'Sigue viva',
    });
    await a.motor.ciclo();
    await b.motor.ciclo();
    await a.motor.ciclo();
    expect((await a.movimientos.obtener(datos.movimiento.id))?.borradoEn).toBeNull();
    expect(await a.volcar()).toEqual(await b.volcar());
  });

  it('dos presupuestos del mismo mes creados sin conexión: queda el de id menor en los dos', async () => {
    const { a, b, datos } = await dosDispositivos();
    const deA = await a.presupuestos.guardar('2026-12', [
      { categoriaId: datos.comida.id, importe: 10000 },
    ]);
    const deB = await b.presupuestos.guardar('2026-12', [
      { categoriaId: datos.comida.id, importe: 20000 },
    ]);
    for (let i = 0; i < 3; i += 1) {
      await a.motor.ciclo();
      await b.motor.ciclo();
    }
    const gana = deA.id < deB.id ? deA : deB;
    const pierde = deA.id < deB.id ? deB : deA;
    for (const d of [a, b]) {
      const vivo = await d.presupuestos.delMes('2026-12');
      expect(vivo?.id).toBe(gana.id);
      const [perdido] = await d.bd.consultar<{ borrado_en: string | null }>(
        'SELECT borrado_en FROM presupuesto WHERE id = ?',
        [pierde.id],
      );
      expect(perdido.borrado_en).not.toBeNull();
      expect(await pendientes(d)).toBe(0);
    }
    expect(nube.filas.get(nube.clave(usuario, 'presupuesto', pierde.id))?.borrada).toBe(true);
    expect((await b.motor.resumen()).noAplicables).toBe(0);
  });
});

describe('sin conexión y errores', () => {
  it('sin conexión los cambios esperan, y salen al volver', async () => {
    const { a, b, datos } = await dosDispositivos();
    nube.estado.sinRed = true;
    await a.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-21',
      importe: 700,
      cuentaId: datos.banco.id,
      nombre: 'Sin cobertura',
    });
    expect((await a.motor.ciclo()).estado).toBe('sin_conexion');
    expect(await pendientes(a)).toBe(1);
    nube.estado.sinRed = false;
    expect(await a.motor.ciclo()).toMatchObject({ estado: 'correcto', subidas: 1 });
    expect(await pendientes(a)).toBe(0);
    await b.motor.ciclo();
    expect(await b.volcar()).toEqual(await a.volcar());
  });

  it('una fila que el servidor rechaza no detiene a las demás', async () => {
    const { a, b, datos } = await dosDispositivos();
    const mala = await a.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-21',
      importe: 1,
      cuentaId: datos.banco.id,
      nombre: 'Rechazada',
    });
    const buena = await a.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-21',
      importe: 2,
      cuentaId: datos.banco.id,
      nombre: 'Aceptada',
    });
    nube.estado.rechazados.add(mala.id);
    expect(await a.motor.ciclo()).toMatchObject({ estado: 'parcial', subidas: 1, noSubidas: 1 });
    expect(await pendientes(a)).toBe(1);
    await b.motor.ciclo();
    expect(await b.movimientos.obtener(buena.id)).not.toBeNull();
    expect(await b.movimientos.obtener(mala.id)).toBeNull();
    nube.estado.rechazados.clear();
    expect((await a.motor.ciclo()).estado).toBe('correcto');
    expect(await pendientes(a)).toBe(0);
  });

  it('un servidor averiado o una sesión caducada se distinguen de la falta de red', async () => {
    const { a } = await dosDispositivos();
    nube.estado.averiado = true;
    expect((await a.motor.ciclo()).estado).toBe('error');
    nube.estado.averiado = false;
    const caducado = await dispositivo({}, () => null);
    await caducado.bd.ejecutar("INSERT INTO sinc_estado (clave, valor) VALUES ('usuario', ?)", [
      usuario,
    ]);
    expect((await caducado.motor.ciclo()).estado).toBe('sesion_caducada');
  });
});

describe('sobres que no se pueden aplicar', () => {
  it('manipulado, movido de id, de tabla o de usuario: no se aplica, se cuenta y el resto sigue', async () => {
    const { a, b, datos } = await dosDispositivos();
    const crear = (nombre: string) =>
      a.movimientos.crear({
        tipo: 'gasto',
        fecha: '2026-11-21',
        importe: 500,
        cuentaId: datos.banco.id,
        nombre,
      });
    const [bit, deId, sana] = [await crear('Bit'), await crear('De id'), await crear('Sana')];
    await a.motor.ciclo();
    const guardada = (tabla: string, id: string) => nube.filas.get(nube.clave(usuario, tabla, id))!;

    // Un bit cambiado.
    const f1 = guardada('movimiento', bit.id);
    const letra = f1.contenido[40] === 'A' ? 'B' : 'A';
    f1.contenido = f1.contenido.slice(0, 40) + letra + f1.contenido.slice(41);
    // El sobre de otra fila, puesto en esta.
    guardada('movimiento', deId.id).contenido = guardada('movimiento', sana.id).contenido;
    // El sobre de una cuenta, presentado como una categoría nueva.
    const deTabla = randomUUID();
    nube.filas.set(nube.clave(usuario, 'categoria', deTabla), {
      ...guardada('cuenta', datos.banco.id),
      tabla: 'categoria',
      id: deTabla,
      actualizada_en: nube.marca(),
    });
    // Una fila de otra persona, cifrada con otra clave, copiada a esta cuenta.
    const ajena = randomUUID();
    const otroUsuario = randomUUID();
    nube.filas.set(nube.clave(usuario, 'cuenta', ajena), {
      usuario,
      tabla: 'cuenta',
      id: ajena,
      contenido: await cifrarFila(await generarClaveDeDatos(), otroUsuario, 'cuenta', {
        ...(await a.volcar()).cuenta[0],
        id: ajena,
      }),
      version_de_formato: 1,
      borrada: false,
      actualizada_en: nube.marca(),
    });
    // Y el mismo caso con la clave buena pero cifrada para otro usuario.
    const deOtro = randomUUID();
    nube.filas.set(nube.clave(usuario, 'cuenta', deOtro), {
      usuario,
      tabla: 'cuenta',
      id: deOtro,
      contenido: await cifrarFila(clave, otroUsuario, 'cuenta', {
        ...(await a.volcar()).cuenta[0],
        id: deOtro,
      }),
      version_de_formato: 1,
      borrada: false,
      actualizada_en: nube.marca(),
    });
    for (const id of [bit.id, deId.id]) guardada('movimiento', id).actualizada_en = nube.marca();

    const filasAntes = nube.filas.size;
    const ciclo = await b.motor.ciclo();
    expect(ciclo.estado).toBe('correcto');
    expect(ciclo.retenidas).toBe(5);
    expect((await b.motor.resumen()).ilegibles).toBe(5);
    // La sana sí llega; las otras no existen en B.
    expect(await b.movimientos.obtener(sana.id)).not.toBeNull();
    expect(await b.movimientos.obtener(bit.id)).toBeNull();
    expect(await b.movimientos.obtener(deId.id)).toBeNull();
    expect((await b.volcar()).cuenta.map((c) => c.id)).not.toContain(ajena);
    expect((await b.volcar()).categoria.map((c) => c.id)).not.toContain(deTabla);
    // No se borra nada del servidor, y no se recuenta en cada ciclo.
    expect(nube.filas.size).toBe(filasAntes);
    expect((await b.motor.ciclo()).retenidas).toBe(0);
    expect((await b.motor.resumen()).ilegibles).toBe(5);

    // Si A vuelve a subir una de ellas, B la recibe y deja de contarla.
    await a.movimientos.modificar(bit.id, {
      tipo: 'gasto',
      fecha: '2026-11-21',
      importe: 501,
      cuentaId: datos.banco.id,
      nombre: 'Bit, otra vez',
    });
    await a.motor.ciclo();
    await b.motor.ciclo();
    expect((await b.movimientos.obtener(bit.id))?.importe).toBe(501);
    expect((await b.motor.resumen()).ilegibles).toBe(4);
  });

  it('la marca «borrada» del servidor no decide nada: decide el contenido', async () => {
    const { a, b, datos } = await dosDispositivos();
    await a.cuentas.archivar(datos.banco.id, true);
    await a.motor.ciclo();
    const fila = nube.filas.get(nube.clave(usuario, 'cuenta', datos.banco.id))!;
    fila.borrada = true;
    await b.motor.ciclo();
    const enB = await b.cuentas.obtener(datos.banco.id);
    expect(enB).toMatchObject({ archivada: true, borradoEn: null });
  });

  it('una fila que llega antes que aquella a la que apunta se retiene y se aplica después', async () => {
    const { a, b } = await dosDispositivos();
    const cuenta = await a.cuentas.crear({
      nombre: 'Nueva',
      tipo: 'efectivo',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-11-01',
    });
    const movimiento = await a.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-21',
      importe: 300,
      cuentaId: cuenta.id,
      nombre: 'Hijo',
    });
    await a.motor.ciclo();
    // El servidor no entrega la cuenta todavía.
    const k = nube.clave(usuario, 'cuenta', cuenta.id);
    const escondida = nube.filas.get(k)!;
    nube.filas.delete(k);
    const primero = await b.motor.ciclo();
    expect(primero).toMatchObject({ estado: 'correcto', retenidas: 1 });
    expect(await b.movimientos.obtener(movimiento.id)).toBeNull();
    expect((await b.motor.resumen()).noAplicables).toBe(1);
    // Ahora sí.
    nube.filas.set(k, { ...escondida, actualizada_en: nube.marca() });
    await b.motor.ciclo();
    expect((await b.movimientos.obtener(movimiento.id))?.importe).toBe(300);
    expect((await b.motor.resumen()).noAplicables).toBe(0);
    expect(await b.volcar()).toEqual(await a.volcar());
  });

  it('una fila escrita por una versión futura de la app se retiene sin perderla', async () => {
    const { b } = await dosDispositivos();
    const id = randomUUID();
    const futura = JSON.stringify({ v: 1, f: { id, nombre: 'x', columna_nueva: 1 } });
    nube.filas.set(nube.clave(usuario, 'cuenta', id), {
      usuario,
      tabla: 'cuenta',
      id,
      contenido: await cifrarTexto(clave, futura, `fila/${usuario}/cuenta/${id}`),
      version_de_formato: 1,
      borrada: false,
      actualizada_en: nube.marca(),
    });
    expect((await b.motor.ciclo()).retenidas).toBe(1);
    const resumen = await b.motor.resumen();
    expect(resumen).toMatchObject({ noAplicables: 1, ilegibles: 0 });
  });
});

describe('cursor', () => {
  it('recoge una escritura confirmada fuera de orden; sin ventana se perdería', async () => {
    const { a, b, datos } = await dosDispositivos();
    const ingenuo = await dispositivo({ ventanaMs: 0 });
    await ingenuo.motor.evaluarEntrada();
    await ingenuo.motor.ciclo();

    const crear = (nombre: string) =>
      a.movimientos.crear({
        tipo: 'gasto',
        fecha: '2026-11-21',
        importe: 100,
        cuentaId: datos.banco.id,
        nombre,
      });
    // La lenta empieza antes (su marca es anterior) pero se confirma después.
    const marcaDeLaLenta = nube.marca();
    const rapida = await crear('Rápida');
    await a.motor.ciclo();
    await b.motor.ciclo();
    await ingenuo.motor.ciclo();
    expect(await b.movimientos.obtener(rapida.id)).not.toBeNull();

    const lenta = await crear('Lenta');
    await a.motor.ciclo();
    nube.filas.get(nube.clave(usuario, 'movimiento', lenta.id))!.actualizada_en = marcaDeLaLenta;

    await b.motor.ciclo();
    await ingenuo.motor.ciclo();
    expect(await b.movimientos.obtener(lenta.id)).not.toBeNull();
    expect(await ingenuo.movimientos.obtener(lenta.id)).toBeNull();
  });
});

describe('repaso completo', () => {
  it('una fila que el servidor ha perdido se vuelve a subir', async () => {
    const { a, b, datos } = await dosDispositivos();
    nube.filas.delete(nube.clave(usuario, 'movimiento', datos.movimiento.id));
    expect((await a.motor.ciclo()).desaparecidas).toBe(0);
    const repaso = await a.motor.ciclo({ repaso: true });
    expect(repaso).toMatchObject({ estado: 'correcto', desaparecidas: 1, subidas: 1 });
    expect(nube.filas.has(nube.clave(usuario, 'movimiento', datos.movimiento.id))).toBe(true);
    await b.motor.ciclo({ repaso: true });
    expect(await b.volcar()).toEqual(await a.volcar());
  });

  it('una fila devuelta con una marca anterior a la conocida no se aplica y se vuelve a subir', async () => {
    const { a, datos } = await dosDispositivos();
    const k = nube.clave(usuario, 'cuenta', datos.banco.id);
    const antigua = { ...nube.filas.get(k)! };
    await a.cuentas.archivar(datos.banco.id, true);
    await a.motor.ciclo();
    // El servidor vuelve a una copia antigua.
    nube.filas.set(k, antigua);
    const repaso = await a.motor.ciclo({ repaso: true });
    expect(repaso).toMatchObject({ revertidas: 1, subidas: 1, aplicadas: 0 });
    expect((await a.cuentas.obtener(datos.banco.id))?.archivada).toBe(true);
    const b = await dispositivo();
    await b.motor.evaluarEntrada();
    await b.motor.ciclo();
    expect((await b.cuentas.obtener(datos.banco.id))?.archivada).toBe(true);
  });

  it('recoge lo que el cursor no vio, por antiguo que sea', async () => {
    const { a, b, datos } = await dosDispositivos();
    const vieja = await a.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-21',
      importe: 100,
      cuentaId: datos.banco.id,
      nombre: 'Muy atrasada',
    });
    await a.motor.ciclo();
    nube.filas.get(nube.clave(usuario, 'movimiento', vieja.id))!.actualizada_en =
      '2026-01-01T00:00:00.000001+00:00';
    await b.motor.ciclo();
    expect(await b.movimientos.obtener(vieja.id)).toBeNull();
    await b.motor.ciclo({ repaso: true });
    expect(await b.movimientos.obtener(vieja.id)).not.toBeNull();
  });

  it('se hace solo cuando el último tiene más de siete días', async () => {
    const { a } = await dosDispositivos();
    const marcas = () => nube.estado.llamadas.filter((l) => l === 'marcas').length;
    await a.motor.ciclo();
    expect(marcas()).toBe(0);
    await a.bd.ejecutar(
      "UPDATE sinc_estado SET valor = '2026-01-01T00:00:00.000Z' WHERE clave = 'ultimo_repaso'",
    );
    await a.motor.ciclo();
    expect(marcas()).toBe(1);
    await a.motor.ciclo();
    expect(marcas()).toBe(1);
  });
});

describe('entrada en una cuenta', () => {
  it('nube vacía y dispositivo con datos: sube', async () => {
    const a = await dispositivo();
    await sembrarTodo(a);
    const total = await contarFilas(a.bd);
    expect(await a.motor.evaluarEntrada()).toEqual({ estado: 'lista', accion: 'subir' });
    expect(await pendientes(a)).toBe(total);
    await a.motor.ciclo();
    expect(nube.de(usuario)).toHaveLength(total);
  });

  it('dispositivo recién instalado y nube con datos: baja, sin duplicar categorías iniciales', async () => {
    const { a, b } = await dosDispositivos();
    const categorias = (await b.volcar()).categoria;
    expect(categorias.map((c) => c.id).sort()).toEqual(
      (await a.volcar()).categoria.map((c) => c.id).sort(),
    );
    expect(categorias.filter((c) => c.nombre === 'Comida')).toHaveLength(1);
    // Y nada local subió a la nube.
    expect(await pendientes(b)).toBe(0);
  });

  it('una categoría inicial tocada ya cuenta como dato del usuario', async () => {
    await dosDispositivos();
    const c = await dispositivo();
    const [ocio] = (await c.categorias.listar()).filter((x) => x.nombre === 'Ocio');
    await c.categorias.renombrar(ocio.id, 'Tiempo libre');
    expect(await c.motor.evaluarEntrada()).toEqual({ estado: 'preguntar' });
    const d = await dispositivo();
    await d.categorias.crear({ nombre: 'Mascotas', tipo: 'gasto' });
    expect(await d.motor.evaluarEntrada()).toEqual({ estado: 'preguntar' });
  });

  it('los dos con datos: pregunta, y mientras tanto no cambia nada', async () => {
    const { a } = await dosDispositivos();
    const c = await dispositivo();
    await sembrarTodo(c);
    const antes = await c.volcar();
    const enNube = JSON.stringify([...nube.filas.values()]);
    expect(await c.motor.evaluarEntrada()).toEqual({ estado: 'preguntar' });
    // «Cancelar» es no hacer nada más: ni el ciclo sube o baja.
    expect((await c.motor.ciclo()).estado).toBe('sin_ligar');
    expect(await c.volcar()).toEqual(antes);
    expect(JSON.stringify([...nube.filas.values()])).toBe(enNube);
    expect((await c.motor.resumen()).usuario).toBeNull();
    expect((await a.motor.ciclo()).aplicadas).toBe(0);
  });

  it('«usar la nube» exporta antes y luego reemplaza; lo local nunca sube', async () => {
    const { a } = await dosDispositivos();
    const c = await dispositivo();
    await sembrarTodo(c);
    await c.avisos.registrar('aviso-local');
    const antes = await c.volcar();
    const enNube = nube.filas.size;
    let alExportar: unknown = null;
    const resultado = await c.motor.usarLaNube(async () => {
      // En el momento de exportar, lo local sigue entero.
      alExportar = await c.volcar();
      return true;
    });
    expect(resultado).toMatchObject({ estado: 'hecho', retenidas: 0 });
    expect(alExportar).toEqual(antes);
    expect(await c.volcar()).toEqual(await a.volcar());
    expect(await c.bd.consultar('SELECT * FROM aviso_emitido')).toEqual([]);
    expect(await pendientes(c)).toBe(0);
    expect((await c.motor.ciclo()).subidas).toBe(0);
    expect(nube.filas.size).toBe(enNube);
    // A partir de ahí sincroniza con normalidad.
    await c.cuentas.crear({
      nombre: 'Desde C',
      tipo: 'efectivo',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-11-01',
    });
    await c.motor.ciclo();
    await a.motor.ciclo();
    expect(await a.volcar()).toEqual(await c.volcar());
  });

  it('si la persona no guarda la copia, o falla la bajada, no se toca nada local', async () => {
    await dosDispositivos();
    const c = await dispositivo();
    await sembrarTodo(c);
    const antes = await c.volcar();
    expect(await c.motor.usarLaNube(async () => false)).toEqual({ estado: 'sin_copia' });
    expect(await c.volcar()).toEqual(antes);
    const exportar = jest.fn(async () => {
      nube.estado.sinRed = true;
      return true;
    });
    expect(await c.motor.usarLaNube(exportar)).toEqual({ estado: 'sin_conexion' });
    expect(await c.volcar()).toEqual(antes);
    expect((await c.motor.resumen()).usuario).toBeNull();
  });

  it('volver a entrar en la misma cuenta continúa: lo cambiado sin sesión sube', async () => {
    const { a, b, datos } = await dosDispositivos();
    await b.cuentas.archivar(datos.broker.id, true);
    expect(await b.motor.evaluarEntrada()).toEqual({ estado: 'lista', accion: 'continuar' });
    await b.motor.ciclo();
    await a.motor.ciclo();
    expect((await a.cuentas.obtener(datos.broker.id))?.archivada).toBe(true);
  });

  it('al desligar se olvida la cuenta y los datos locales siguen', async () => {
    const { a } = await dosDispositivos();
    const antes = await a.volcar();
    await a.motor.desligar();
    expect(await a.volcar()).toEqual(antes);
    const resumen = await a.motor.resumen();
    expect(resumen).toMatchObject({ usuario: null, pendientes: 0, ultima: null });
    expect((await a.motor.ciclo()).estado).toBe('sin_ligar');
  });
});
