/**
 * La cuenta de usuario (B4b-1), con un servidor de mentira que apunta todo
 * lo que recibe. La criptografía es la de verdad. Datos de ejemplo.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  derivarClaveMaestra,
  derivarClaves,
  desenvolverConCodigo,
  desenvolverConContrasena,
  gruposDelCodigo,
} from '@/cripto';
import { crearGestorDeCuenta, type GestorDeCuenta } from '@/estado/cuenta';
import { CLAVE_DE_DATOS_EN_EL_ALMACEN, CORREO_EN_EL_ALMACEN } from '@/lib/almacenSeguro';
import {
  esCorreoValido,
  LONGITUD_MINIMA_DE_CONTRASENA,
  problemaDeContrasena,
} from '@/lib/contrasena';
import { almacenEnMemoria, servidorDeMentira } from '@/pruebas/cuentaDePrueba';

const CORREO = 'ana.ejemplo@example.com';
const CONTRASENA = 'correcta batería caballo grapa';
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

type Montaje = ReturnType<typeof montar>;

function montar(opciones: { correcta?: boolean; sinCliente?: boolean; espera?: number } = {}) {
  const servidor = servidorDeMentira();
  const memoria = almacenEnMemoria();
  const gestor = crearGestorDeCuenta({
    cliente: opciones.sinCliente ? null : servidor.cliente,
    almacen: memoria.almacen,
    autocomprobar: async () => ({
      correcta: opciones.correcta ?? true,
      milisegundosDeDerivacion: 1,
    }),
    esperaMaxima: opciones.espera ?? 2_000,
    pausaAntesDeCalcular: 0,
  });
  return { servidor, memoria, gestor };
}

/** Peticiones hechas al servidor. Cerrar la sesión local del dispositivo no es una petición. */
const peticiones = (m: Montaje) => m.servidor.estado.llamadas.filter((l) => l !== 'signOut');

/** Los grupos que la pantalla pide, leídos del código que se está enseñando. */
function gruposPedidos(gestor: GestorDeCuenta): string[] {
  const { codigo, gruposPedidos: posiciones } = gestor.estado();
  const grupos = gruposDelCodigo(codigo!);
  return posiciones.map((p) => grupos[p]);
}

/** Alta completa. Devuelve el código de recuperación que se enseñó. */
async function altaCompleta(m: Montaje, correo = CORREO, contrasena = CONTRASENA): Promise<string> {
  expect(await m.gestor.crearCuenta(correo, contrasena)).toEqual({ ok: true });
  const codigo = m.gestor.estado().codigo!;
  expect(await m.gestor.confirmarCodigo(gruposPedidos(m.gestor))).toEqual({ ok: true });
  return codigo;
}

describe('reglas de la contraseña', () => {
  it('mínimo 12 caracteres', () => {
    expect(LONGITUD_MINIMA_DE_CONTRASENA).toBe(12);
    expect(problemaDeContrasena('once letras', CORREO)).toBe('corta');
    expect(problemaDeContrasena('doce letras!', CORREO)).toBeNull();
    expect(problemaDeContrasena('💸'.repeat(11), CORREO)).toBe('corta');
    expect(problemaDeContrasena('x'.repeat(257), CORREO)).toBe('larga');
  });

  it('rechaza las evidentes, también con mayúsculas o espacios', () => {
    for (const evidente of [
      '123456789012',
      'Password1234',
      'CONTRASEÑA123',
      'qwerty uiop 12',
      'aaaaaaaaaaaa',
      'abababababab',
      'FinancialControl',
    ]) {
      expect([evidente, problemaDeContrasena(evidente, CORREO)]).toEqual([evidente, 'evidente']);
    }
  });

  it('rechaza el propio correo y acepta una frase', () => {
    expect(problemaDeContrasena(CORREO, CORREO)).toBe('es_el_correo');
    expect(problemaDeContrasena('ana.ejemplo', 'ana.ejemplo@example.com')).toBe('corta');
    expect(problemaDeContrasena('Ana.Ejemplo.Largo', 'ana.ejemplo.largo@example.com')).toBe(
      'es_el_correo',
    );
    expect(problemaDeContrasena(CONTRASENA, CORREO)).toBeNull();
  });

  it('forma del correo', () => {
    for (const bueno of ['a@b.es', ' ana@example.com ', 'a.b+c@sub.example.org']) {
      expect(esCorreoValido(bueno)).toBe(true);
    }
    for (const malo of ['', 'ana', 'ana@', '@example.com', 'ana@example', 'a b@c.es', 'a@b@c.es']) {
      expect(esCorreoValido(malo)).toBe(false);
    }
  });
});

describe('arranque', () => {
  it('sin configuración del servidor, la cuenta no está disponible y no falla nada', async () => {
    const m = montar({ sinCliente: true });
    await m.gestor.iniciar();
    expect(m.gestor.estado().fase).toBe('sin_configurar');
    expect(await m.gestor.crearCuenta(CORREO, CONTRASENA)).toEqual({
      ok: false,
      error: 'no_disponible',
    });
  });

  it('si la autocomprobación falla, las funciones de cuenta quedan desactivadas', async () => {
    const m = montar({ correcta: false });
    await m.gestor.iniciar();
    expect(m.gestor.estado().fase).toBe('cripto_no_fiable');
    const no = { ok: false, error: 'no_disponible' };
    expect(await m.gestor.crearCuenta(CORREO, CONTRASENA)).toEqual(no);
    expect(await m.gestor.iniciarSesion(CORREO, CONTRASENA)).toEqual(no);
    expect(await m.gestor.cerrarSesion()).toEqual(no);
    expect(await m.gestor.borrarCuenta()).toEqual(no);
    expect(await m.gestor.confirmarCodigo(['A', 'B'])).toEqual(no);
    // No se ha pedido nada al servidor ni se ha escrito nada.
    expect(peticiones(m)).toEqual([]);
    expect(m.servidor.recibido).toEqual([]);
    expect(m.memoria.datos.size).toBe(0);
  });

  it('la autocomprobación se pide una sola vez', async () => {
    const autocomprobar = jest.fn(async () => ({ correcta: true, milisegundosDeDerivacion: 1 }));
    const gestor = crearGestorDeCuenta({
      cliente: servidorDeMentira().cliente,
      almacen: almacenEnMemoria().almacen,
      autocomprobar,
    });
    await Promise.all([gestor.iniciar(), gestor.iniciar()]);
    await gestor.iniciarSesion(CORREO, CONTRASENA);
    expect(autocomprobar).toHaveBeenCalledTimes(1);
  });

  it('sin sesión guardada arranca sin sesión', async () => {
    const m = montar();
    await m.gestor.iniciar();
    expect(m.gestor.estado()).toMatchObject({ fase: 'sin_sesion', correo: null, codigo: null });
  });
});

describe('alta', () => {
  it('no continúa sin confirmar el código, y al confirmarlo queda la sesión iniciada', async () => {
    const m = montar();
    expect(await m.gestor.crearCuenta(`  ${CORREO.toUpperCase()} `, CONTRASENA)).toEqual({
      ok: true,
    });
    const estado = m.gestor.estado();
    expect(estado.fase).toBe('pendiente_de_codigo');
    expect(estado.correo).toBe(CORREO);
    expect(gruposDelCodigo(estado.codigo!)).toHaveLength(14);
    expect(estado.gruposPedidos).toHaveLength(2);
    expect(new Set(estado.gruposPedidos).size).toBe(2);
    // Hasta confirmar: ni claves en el servidor ni clave en el llavero.
    expect(m.servidor.claves.size).toBe(0);
    expect(m.memoria.datos.has(CLAVE_DE_DATOS_EN_EL_ALMACEN)).toBe(false);

    // Grupos equivocados, vacíos, de menos o los correctos en otro orden: no pasa.
    const buenos = gruposPedidos(m.gestor);
    for (const malos of [['AAAA', 'BBBB'], ['', ''], [buenos[0]], [buenos[1], buenos[0]], []]) {
      if (malos[0] === buenos[0] && malos[1] === buenos[1]) continue;
      expect(await m.gestor.confirmarCodigo(malos)).toEqual({
        ok: false,
        error: 'codigo_no_coincide',
      });
    }
    expect(m.gestor.estado().fase).toBe('pendiente_de_codigo');
    expect(m.servidor.claves.size).toBe(0);

    // Bien escritos, aunque sea en minúsculas y con espacios.
    expect(await m.gestor.confirmarCodigo(buenos.map((g) => ` ${g.toLowerCase()} `))).toEqual({
      ok: true,
    });
    expect(m.gestor.estado()).toMatchObject({ fase: 'con_sesion', correo: CORREO, codigo: null });
    expect(m.servidor.claves.size).toBe(1);
    expect(m.memoria.datos.has(CLAVE_DE_DATOS_EN_EL_ALMACEN)).toBe(true);
  });

  it('lo guardado en el servidor se abre con la contraseña y con el código, y da la clave del llavero', async () => {
    const m = montar();
    const codigo = await altaCompleta(m);
    const [fila] = [...m.servidor.claves.values()];
    expect(fila).toMatchObject({ version_de_derivacion: 1, version_de_formato: 1 });
    expect(Object.keys(fila).sort()).toEqual([
      'clave_por_contrasena',
      'clave_por_recuperacion',
      'version_de_derivacion',
      'version_de_formato',
    ]);
    const { envoltura } = await derivarClaves(CONTRASENA, CORREO);
    const porContrasena = await desenvolverConContrasena(
      String(fila.clave_por_contrasena),
      envoltura,
    );
    const porCodigo = await desenvolverConCodigo(String(fila.clave_por_recuperacion), codigo);
    expect(hex(porContrasena)).toBe(hex(porCodigo));
    expect(hex((await m.gestor.leerClaveDeDatos())!)).toBe(hex(porContrasena));
  });

  it.each([
    ['correo sin forma', 'ana', CONTRASENA, 'correo_invalido'],
    ['contraseña corta', CORREO, 'corta', 'contrasena_corta'],
    ['contraseña evidente', CORREO, 'password1234', 'contrasena_evidente'],
    ['la contraseña es el correo', CORREO, CORREO, 'contrasena_es_el_correo'],
  ])('%s: se rechaza sin pedir nada al servidor', async (_n, correo, contrasena, error) => {
    const m = montar();
    expect(await m.gestor.crearCuenta(correo, contrasena)).toEqual({ ok: false, error });
    expect(peticiones(m)).toEqual([]);
  });

  it('con un correo ya registrado y otra contraseña: mensaje que no confirma si existe', async () => {
    const m = montar();
    await altaCompleta(m);
    await m.gestor.cerrarSesion();
    const existente = await m.gestor.crearCuenta(CORREO, 'otra contraseña distinta');
    expect(existente).toEqual({ ok: false, error: 'alta_rechazada' });
    expect(m.gestor.estado().fase).toBe('sin_sesion');
    // Las claves de la cuenta que ya existía no se han tocado.
    expect(m.servidor.claves.size).toBe(1);
    expect(m.memoria.datos.has(CLAVE_DE_DATOS_EN_EL_ALMACEN)).toBe(false);
  });

  it('con un correo ya registrado y su misma contraseña: es su cuenta, y entra', async () => {
    const m = montar();
    await altaCompleta(m);
    const clave = hex((await m.gestor.leerClaveDeDatos())!);
    await m.gestor.cerrarSesion();
    expect(await m.gestor.crearCuenta(CORREO, CONTRASENA)).toEqual({ ok: true });
    expect(m.gestor.estado().fase).toBe('con_sesion');
    expect(hex((await m.gestor.leerClaveDeDatos())!)).toBe(clave);
  });

  it('cancelar el alta deja el dispositivo limpio', async () => {
    const m = montar();
    await m.gestor.crearCuenta(CORREO, CONTRASENA);
    expect(await m.gestor.cancelarAlta()).toEqual({ ok: true });
    expect(m.gestor.estado()).toMatchObject({ fase: 'sin_sesion', codigo: null, correo: null });
    expect(m.servidor.sesionActual()).toBeNull();
    expect(m.memoria.datos.size).toBe(0);
  });
});

describe('alta interrumpida', () => {
  it('entre crear el usuario y guardar las claves: al reintentar el alta se reanuda con un código nuevo', async () => {
    const m = montar();
    await m.gestor.crearCuenta(CORREO, CONTRASENA);
    const primerCodigo = m.gestor.estado().codigo;
    // La app se cierra aquí: el usuario existe en el servidor, sin claves.
    expect(m.servidor.usuarios.size).toBe(1);
    expect(m.servidor.claves.size).toBe(0);

    // Nuevo arranque: mismo servidor y mismo llavero, memoria vacía.
    const otro = crearGestorDeCuenta({
      cliente: m.servidor.cliente,
      almacen: m.memoria.almacen,
      autocomprobar: async () => ({ correcta: true, milisegundosDeDerivacion: 1 }),
    });
    await otro.iniciar();
    // Había sesión pero no clave: se limpia y se pide entrar.
    expect(otro.estado().fase).toBe('sin_sesion');
    expect(m.servidor.sesionActual()).toBeNull();

    expect(await otro.crearCuenta(CORREO, CONTRASENA)).toEqual({ ok: true });
    expect(otro.estado().fase).toBe('pendiente_de_codigo');
    expect(otro.estado().codigo).not.toBe(primerCodigo);
    expect(await otro.confirmarCodigo(gruposPedidos(otro))).toEqual({ ok: true });
    expect(otro.estado().fase).toBe('con_sesion');
    expect(m.servidor.usuarios.size).toBe(1);
    expect(m.servidor.claves.size).toBe(1);
  });

  it('también se reanuda al iniciar sesión en lugar de repetir el alta', async () => {
    const m = montar();
    await m.gestor.crearCuenta(CORREO, CONTRASENA);
    await m.gestor.cancelarAlta();
    expect(await m.gestor.iniciarSesion(CORREO, CONTRASENA)).toEqual({ ok: true });
    expect(m.gestor.estado().fase).toBe('pendiente_de_codigo');
    await m.gestor.confirmarCodigo(gruposPedidos(m.gestor));
    expect(m.gestor.estado().fase).toBe('con_sesion');
  });

  it('quien no sabe la contraseña no puede reanudar el alta de otro', async () => {
    const m = montar();
    await m.gestor.crearCuenta(CORREO, CONTRASENA);
    await m.gestor.cancelarAlta();
    expect(await m.gestor.crearCuenta(CORREO, 'la de otra persona 123')).toEqual({
      ok: false,
      error: 'alta_rechazada',
    });
    expect(await m.gestor.iniciarSesion(CORREO, 'la de otra persona 123')).toEqual({
      ok: false,
      error: 'credenciales',
    });
    expect(m.servidor.claves.size).toBe(0);
  });

  it('si el servidor falla al guardar las claves, se sigue en el código y se puede reintentar', async () => {
    const m = montar();
    await m.gestor.crearCuenta(CORREO, CONTRASENA);
    const codigo = m.gestor.estado().codigo;
    m.servidor.estado.fallaAlGuardarClaves = true;
    expect(await m.gestor.confirmarCodigo(gruposPedidos(m.gestor))).toEqual({
      ok: false,
      error: 'desconocido',
    });
    expect(m.gestor.estado()).toMatchObject({ fase: 'pendiente_de_codigo', codigo });
    expect(m.memoria.datos.has(CLAVE_DE_DATOS_EN_EL_ALMACEN)).toBe(false);
    m.servidor.estado.fallaAlGuardarClaves = false;
    expect(await m.gestor.confirmarCodigo(gruposPedidos(m.gestor))).toEqual({ ok: true });
  });
});

describe('sesión', () => {
  it('alta, cierre e inicio de sesión recuperan la misma clave de datos', async () => {
    const m = montar();
    await altaCompleta(m);
    const clave = hex((await m.gestor.leerClaveDeDatos())!);
    expect(await m.gestor.cerrarSesion()).toEqual({ ok: true });
    expect(await m.gestor.leerClaveDeDatos()).toBeNull();
    expect(await m.gestor.iniciarSesion(CORREO.toUpperCase(), CONTRASENA)).toEqual({ ok: true });
    expect(m.gestor.estado()).toMatchObject({ fase: 'con_sesion', correo: CORREO, codigo: null });
    expect(hex((await m.gestor.leerClaveDeDatos())!)).toBe(clave);
  });

  it('cerrar sesión borra la clave y la sesión del dispositivo, y nada más', async () => {
    const m = montar();
    await altaCompleta(m);
    m.memoria.datos.set('otra-cosa-de-la-app', 'se queda');
    await m.gestor.cerrarSesion();
    expect([...m.memoria.datos.keys()]).toEqual(['otra-cosa-de-la-app']);
    expect(m.servidor.sesionActual()).toBeNull();
    expect(m.gestor.estado()).toMatchObject({ fase: 'sin_sesion', correo: null });
    // La cuenta sigue en el servidor.
    expect(m.servidor.usuarios.size).toBe(1);
    expect(m.servidor.claves.size).toBe(1);
  });

  it('contraseña equivocada o correo desconocido: el mismo mensaje', async () => {
    const m = montar();
    await altaCompleta(m);
    await m.gestor.cerrarSesion();
    const mala = await m.gestor.iniciarSesion(CORREO, 'no es la contraseña');
    const nadie = await m.gestor.iniciarSesion('nadie@example.com', CONTRASENA);
    expect(mala).toEqual({ ok: false, error: 'credenciales' });
    expect(nadie).toEqual(mala);
    expect(m.memoria.datos.size).toBe(0);
  });

  it('al volver a abrir la app con sesión y clave, sigue iniciada sin pedir nada al servidor', async () => {
    const m = montar();
    await altaCompleta(m);
    m.servidor.estado.llamadas.length = 0;
    const otro = crearGestorDeCuenta({
      cliente: m.servidor.cliente,
      almacen: m.memoria.almacen,
      autocomprobar: async () => ({ correcta: true, milisegundosDeDerivacion: 1 }),
    });
    await otro.iniciar();
    expect(otro.estado()).toMatchObject({ fase: 'con_sesion', correo: CORREO });
    expect(peticiones(m)).toEqual([]);
  });

  it('sin conexión y con la sesión caducada, al abrir la app la cuenta sigue abierta y la clave intacta', async () => {
    const m = montar();
    await altaCompleta(m);
    const clave = m.memoria.datos.get(CLAVE_DE_DATOS_EN_EL_ALMACEN);
    // El cliente no puede renovar la sesión: no hay red.
    m.servidor.estado.sinRed = true;
    jest.spyOn(m.servidor.cliente.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 },
    });
    const otro = crearGestorDeCuenta({
      cliente: m.servidor.cliente,
      almacen: m.memoria.almacen,
      autocomprobar: async () => ({ correcta: true, milisegundosDeDerivacion: 1 }),
    });
    await otro.iniciar();
    expect(otro.estado()).toMatchObject({ fase: 'con_sesion', correo: CORREO });
    expect(m.memoria.datos.get(CLAVE_DE_DATOS_EN_EL_ALMACEN)).toBe(clave);
    expect(hex((await otro.leerClaveDeDatos())!)).toHaveLength(64);
  });

  it('una clave ilegible en el llavero se trata como si no hubiera cuenta abierta', async () => {
    const m = montar();
    m.memoria.datos.set(CLAVE_DE_DATOS_EN_EL_ALMACEN, 'esto no es una clave');
    await m.gestor.iniciar();
    expect(m.gestor.estado().fase).toBe('sin_sesion');
    expect(m.memoria.datos.size).toBe(0);
  });

  it('si las claves del servidor no se abren con la contraseña, no se entra y se limpia', async () => {
    const m = montar();
    await altaCompleta(m);
    await m.gestor.cerrarSesion();
    const [id] = [...m.servidor.claves.keys()];
    const fila = m.servidor.claves.get(id)!;
    const alterada = String(fila.clave_por_contrasena).replace(/.$/, (c) =>
      c === 'A' ? 'B' : 'A',
    );
    m.servidor.claves.set(id, { ...fila, clave_por_contrasena: alterada });
    expect(await m.gestor.iniciarSesion(CORREO, CONTRASENA)).toEqual({
      ok: false,
      error: 'desconocido',
    });
    expect(m.gestor.estado().fase).toBe('sin_sesion');
    expect(m.memoria.datos.size).toBe(0);
    expect(m.servidor.sesionActual()).toBeNull();
  });

  it('dos operaciones a la vez: la segunda no hace nada', async () => {
    const m = montar();
    const [una, otra] = await Promise.all([
      m.gestor.crearCuenta(CORREO, CONTRASENA),
      m.gestor.crearCuenta(CORREO, CONTRASENA),
    ]);
    expect([una.ok, otra.ok].sort()).toEqual([false, true]);
    expect(m.servidor.estado.llamadas.filter((l) => l === 'signUp')).toHaveLength(1);
  });
});

describe('borrado de cuenta', () => {
  it('borra lo remoto y cierra la sesión', async () => {
    const m = montar();
    await altaCompleta(m);
    expect(await m.gestor.borrarCuenta()).toEqual({ ok: true });
    expect(m.servidor.usuarios.size).toBe(0);
    expect(m.servidor.claves.size).toBe(0);
    expect(m.memoria.datos.size).toBe(0);
    expect(m.gestor.estado()).toMatchObject({ fase: 'sin_sesion', correo: null });
  });

  it('después se puede crear otra cuenta con el mismo correo, con claves nuevas', async () => {
    const m = montar();
    const codigo1 = await altaCompleta(m);
    const clave1 = hex((await m.gestor.leerClaveDeDatos())!);
    await m.gestor.borrarCuenta();
    const codigo2 = await altaCompleta(m);
    expect(codigo2).not.toBe(codigo1);
    expect(hex((await m.gestor.leerClaveDeDatos())!)).not.toBe(clave1);
    expect(m.gestor.estado().fase).toBe('con_sesion');
  });

  it('sin sesión no se puede pedir', async () => {
    const m = montar();
    expect((await m.gestor.borrarCuenta()).ok).toBe(false);
    expect(peticiones(m)).toEqual([]);
  });
});

describe('sin conexión en cada paso', () => {
  const SIN = { ok: false, error: 'sin_conexion' };

  it('al crear la cuenta', async () => {
    const m = montar();
    m.servidor.estado.sinRed = true;
    expect(await m.gestor.crearCuenta(CORREO, CONTRASENA)).toEqual(SIN);
    expect(m.gestor.estado()).toMatchObject({ fase: 'sin_sesion', ocupado: false });
    expect(m.memoria.datos.size).toBe(0);
  });

  it('al confirmar el código: se queda en el código y se puede reintentar', async () => {
    const m = montar();
    await m.gestor.crearCuenta(CORREO, CONTRASENA);
    const codigo = m.gestor.estado().codigo;
    m.servidor.estado.sinRed = true;
    expect(await m.gestor.confirmarCodigo(gruposPedidos(m.gestor))).toEqual(SIN);
    expect(m.gestor.estado()).toMatchObject({
      fase: 'pendiente_de_codigo',
      codigo,
      ocupado: false,
    });
    m.servidor.estado.sinRed = false;
    expect(await m.gestor.confirmarCodigo(gruposPedidos(m.gestor))).toEqual({ ok: true });
  });

  it('al iniciar sesión, antes y después de autenticarse', async () => {
    const m = montar();
    await altaCompleta(m);
    await m.gestor.cerrarSesion();
    m.servidor.estado.sinRed = true;
    expect(await m.gestor.iniciarSesion(CORREO, CONTRASENA)).toEqual(SIN);
    m.servidor.estado.sinRed = false;
    // La red cae justo después de autenticarse, al pedir las claves.
    jest.spyOn(m.servidor.cliente, 'from').mockImplementationOnce(() => ({
      select: () => ({
        maybeSingle: async () => ({ data: null, error: { message: 'fetch failed' } }),
      }),
      insert: async () => ({ error: null }),
    }));
    expect(await m.gestor.iniciarSesion(CORREO, CONTRASENA)).toEqual(SIN);
    // No queda una sesión a medias.
    expect(m.gestor.estado().fase).toBe('sin_sesion');
    expect(m.servidor.sesionActual()).toBeNull();
    expect(m.memoria.datos.size).toBe(0);
    expect(await m.gestor.iniciarSesion(CORREO, CONTRASENA)).toEqual({ ok: true });
  });

  it('al cerrar sesión: funciona igual', async () => {
    const m = montar();
    await altaCompleta(m);
    m.servidor.estado.sinRed = true;
    expect(await m.gestor.cerrarSesion()).toEqual({ ok: true });
    expect(m.memoria.datos.size).toBe(0);
  });

  it('al borrar la cuenta: no se cambia nada', async () => {
    const m = montar();
    await altaCompleta(m);
    m.servidor.estado.sinRed = true;
    expect(await m.gestor.borrarCuenta()).toEqual(SIN);
    expect(m.gestor.estado().fase).toBe('con_sesion');
    expect(m.memoria.datos.has(CLAVE_DE_DATOS_EN_EL_ALMACEN)).toBe(true);
    expect(m.servidor.usuarios.size).toBe(1);
  });

  it('un servidor que no contesta no deja la app esperando para siempre', async () => {
    const m = montar({ espera: 150 });
    m.servidor.estado.colgado = true;
    const inicio = Date.now();
    expect(await m.gestor.crearCuenta(CORREO, CONTRASENA)).toEqual(SIN);
    expect(Date.now() - inicio).toBeLessThan(5_000);
    expect(m.gestor.estado()).toMatchObject({ fase: 'sin_sesion', ocupado: false });
    expect(await m.gestor.iniciarSesion(CORREO, CONTRASENA)).toEqual(SIN);
  });

  it('un cliente que lanza un error en lugar de devolverlo también es «sin conexión»', async () => {
    const m = montar();
    jest
      .spyOn(m.servidor.cliente.auth, 'signUp')
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await m.gestor.crearCuenta(CORREO, CONTRASENA)).toEqual(SIN);
    expect(m.gestor.estado().ocupado).toBe(false);
  });
});

describe('lo que nunca sale del dispositivo', () => {
  /** Todas las formas en que un secreto podría aparecer escrito. */
  function formasDe(bytes: Uint8Array): string[] {
    return [hex(bytes), base64(bytes), base64url(bytes), base64(bytes).replace(/=+$/, '')];
  }

  async function recorrido() {
    const m = montar();
    const codigo = await altaCompleta(m);
    const claveDeDatos = (await m.gestor.leerClaveDeDatos())!;
    await m.gestor.cerrarSesion();
    await m.gestor.iniciarSesion(CORREO, 'una contraseña equivocada');
    await m.gestor.iniciarSesion(CORREO, CONTRASENA);
    const enLlavero = new Map(m.memoria.datos);
    await m.gestor.borrarCuenta();
    const maestra = await derivarClaveMaestra(CONTRASENA, CORREO);
    const claves = await derivarClaves(CONTRASENA, CORREO);
    return { m, codigo, claveDeDatos, maestra, claves, enLlavero };
  }

  it('el alta y el inicio de sesión reciben la subclave de autenticación, nunca la contraseña', async () => {
    const m = montar();
    const alta = jest.spyOn(m.servidor.cliente.auth, 'signUp');
    const entrada = jest.spyOn(m.servidor.cliente.auth, 'signInWithPassword');
    await altaCompleta(m);
    await m.gestor.cerrarSesion();
    await m.gestor.iniciarSesion(CORREO, CONTRASENA);
    const { autenticacion } = await derivarClaves(CONTRASENA, CORREO);
    expect(alta.mock.calls).toEqual([[{ email: CORREO, password: autenticacion }]]);
    expect(entrada.mock.calls).toEqual([[{ email: CORREO, password: autenticacion }]]);
    expect(autenticacion).not.toBe(CONTRASENA);
  });

  it('ninguna petición lleva la contraseña, la clave maestra, la clave de datos, la de envoltura ni el código', async () => {
    const { m, codigo, claveDeDatos, maestra, claves } = await recorrido();
    const enviado = JSON.stringify(m.servidor.recibido);
    // Alta, guardado de claves, un inicio de sesión fallido y uno correcto.
    expect(m.servidor.recibido).toHaveLength(4);
    // Lo que sí debe ir.
    expect(enviado).toContain(claves.autenticacion);
    expect(enviado).toContain(CORREO);
    // Lo que no.
    const secretos = [
      CONTRASENA,
      CONTRASENA.normalize('NFKC'),
      encodeURIComponent(CONTRASENA),
      'una contraseña equivocada',
      codigo,
      codigo.replace(/-/g, ''),
      ...gruposDelCodigo(codigo)
        .slice(0, 13)
        .map((g, i, todos) => `${g}-${todos[i + 1] ?? ''}`),
      ...formasDe(maestra),
      ...formasDe(claveDeDatos),
      ...formasDe(claves.envoltura),
    ].filter((s) => s.length >= 8);
    for (const secreto of secretos) {
      expect([secreto.slice(0, 6), enviado.includes(secreto)]).toEqual([
        secreto.slice(0, 6),
        false,
      ]);
    }
    // Y solo viajan los campos previstos.
    const campos = new Set(m.servidor.recibido.flatMap((r) => Object.keys(r as object)));
    expect([...campos].sort()).toEqual([
      'clave_por_contrasena',
      'clave_por_recuperacion',
      'email',
      'password',
      'version_de_derivacion',
      'version_de_formato',
    ]);
  });

  it('en el llavero solo queda la clave de datos; nunca la contraseña, la maestra ni el código', async () => {
    const { codigo, claveDeDatos, maestra, claves, enLlavero } = await recorrido();
    expect([...enLlavero.keys()].sort()).toEqual([
      CLAVE_DE_DATOS_EN_EL_ALMACEN,
      CORREO_EN_EL_ALMACEN,
    ]);
    expect(enLlavero.get(CORREO_EN_EL_ALMACEN)).toBe(CORREO);
    const guardado = JSON.stringify([...enLlavero]);
    expect(guardado).toContain(base64url(claveDeDatos));
    for (const secreto of [
      CONTRASENA,
      codigo,
      ...formasDe(maestra),
      ...formasDe(claves.envoltura),
      claves.autenticacion,
    ]) {
      expect(guardado.includes(secreto)).toBe(false);
    }
  });

  it('el estado que ven las pantallas no lleva claves, y el código solo mientras se enseña', async () => {
    const m = montar();
    const vistos: string[] = [];
    m.gestor.suscribir(() => vistos.push(JSON.stringify(m.gestor.estado())));
    const codigo = await altaCompleta(m);
    const clave = (await m.gestor.leerClaveDeDatos())!;
    const { envoltura, autenticacion } = await derivarClaves(CONTRASENA, CORREO);
    const todo = vistos.join('\n');
    for (const secreto of [CONTRASENA, autenticacion, ...formasDe(clave), ...formasDe(envoltura)]) {
      expect(todo.includes(secreto)).toBe(false);
    }
    expect(todo).toContain(codigo);
    expect(JSON.stringify(m.gestor.estado())).not.toContain(codigo);
    expect(Object.keys(m.gestor.estado()).sort()).toEqual([
      'codigo',
      'correo',
      'fase',
      'gruposPedidos',
      'ocupado',
    ]);
  });

  it('ni SQLite, ni el almacén de clave y valor, ni UserDefaults: la cuenta solo escribe en el llavero', () => {
    const raiz = join(__dirname, '..', '..');
    const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');
    const sinComentarios = (codigo: string) => codigo.replace(/\/\*[^]*?\*\/|\/\/.*$/gm, '');
    const PROHIBIDO =
      /expo-sqlite|kv-store|\bSettings\b|AsyncStorage|UserDefaults|@\/datos|localStorage|console\./;
    for (const fichero of [
      'estado/cuenta.ts',
      'estado/cuentaDeLaApp.ts',
      'lib/almacenSeguro.ts',
      'lib/almacenSeguroNativo.ts',
      'lib/contrasena.ts',
      'app/cuenta-de-usuario.tsx',
      ...(readdirSync(join(raiz, 'cripto')) as string[])
        .filter((f) => f.endsWith('.ts'))
        .map((f) => `cripto/${f}`),
    ]) {
      expect([fichero, PROHIBIDO.test(sinComentarios(leer(fichero)))]).toEqual([fichero, false]);
    }
    // El único almacén real de secretos es el llavero, sin biometría y sin salir del dispositivo.
    const nativo = leer('lib/almacenSeguroNativo.ts');
    expect(nativo).toContain('SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY');
    expect(nativo).toContain('requireAuthentication: false');
    // La sesión de Supabase va al mismo llavero.
    const supabase = leer('lib/supabase.ts');
    expect(supabase).toContain('almacenSeguro.guardar(clave, valor)');
    expect(supabase).toContain('persistSession: true');
    expect(sinComentarios(supabase)).not.toMatch(/service_role|SERVICE|secret/i);
    // Solo estos ficheros de la app tocan el llavero.
    const usan = (readdirSync(raiz, { recursive: true }) as string[])
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__'))
      .filter((f) => /expo-secure-store/.test(sinComentarios(leer(f))));
    expect(usan).toEqual(['lib/almacenSeguroNativo.ts']);
  });
});
