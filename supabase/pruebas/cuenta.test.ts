/**
 * La cuenta de la app contra un Supabase de verdad (la instancia local):
 * el mismo código de `src/estado/cuenta.ts`, con el cliente real y la
 * criptografía real. Espía la red para comprobar qué sale del dispositivo.
 */
import { createClient } from '@supabase/supabase-js';

import { derivarClaveMaestra, derivarClaves, gruposDelCodigo } from '@/cripto';
import { crearGestorDeCuenta, type ClienteDeCuenta, type GestorDeCuenta } from '@/estado/cuenta';
import { CLAVE_DE_DATOS_EN_EL_ALMACEN, type AlmacenSeguro } from '@/lib/almacenSeguro';

import { CLAVE_PUBLICA, consultar, correoDePrueba, URL_LOCAL } from './apoyo';

const CONTRASENA = 'correcta batería caballo grapa';
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const formasDe = (bytes: Uint8Array) => [
  hex(bytes),
  Buffer.from(bytes).toString('base64'),
  Buffer.from(bytes).toString('base64url'),
];

/** Un «dispositivo»: su llavero, su cliente con la sesión en ese llavero y todo lo que envía. */
function dispositivo() {
  const llavero = new Map<string, string>();
  const almacen: AlmacenSeguro = {
    leer: async (clave) => llavero.get(clave) ?? null,
    guardar: async (clave, valor) => {
      llavero.set(clave, valor);
    },
    borrar: async (clave) => {
      llavero.delete(clave);
    },
  };
  /** Cada petición, entera: dirección, cabeceras y cuerpo. */
  const enviado: string[] = [];
  const red = { cortada: false };
  const fetchEspiado: typeof fetch = async (entrada, opciones) => {
    const cabeceras = JSON.stringify(Object.fromEntries(new Headers(opciones?.headers).entries()));
    enviado.push(`${String(entrada)}\n${cabeceras}\n${String(opciones?.body ?? '')}`);
    if (red.cortada) throw new TypeError('Network request failed');
    return fetch(entrada, opciones);
  };
  const cliente = createClient(URL_LOCAL, CLAVE_PUBLICA, {
    auth: {
      persistSession: true,
      storageKey: 'fc.cuenta.sesion',
      storage: {
        getItem: (clave) => almacen.leer(clave),
        setItem: (clave, valor) => almacen.guardar(clave, valor),
        removeItem: (clave) => almacen.borrar(clave),
      },
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchEspiado },
  });
  const gestor = crearGestorDeCuenta({
    cliente: cliente as unknown as ClienteDeCuenta,
    almacen,
    autocomprobar: async () => ({ correcta: true, milisegundosDeDerivacion: 1 }),
    pausaAntesDeCalcular: 0,
    esperaMaxima: 10_000,
  });
  return { llavero, enviado, red, gestor };
}

function gruposPedidos(gestor: GestorDeCuenta): string[] {
  const { codigo, gruposPedidos: posiciones } = gestor.estado();
  const grupos = gruposDelCodigo(codigo!);
  return posiciones.map((p) => grupos[p]);
}

async function alta(d: ReturnType<typeof dispositivo>, correo: string): Promise<string> {
  expect(await d.gestor.crearCuenta(correo, CONTRASENA)).toEqual({ ok: true });
  const codigo = d.gestor.estado().codigo!;
  expect(await d.gestor.confirmarCodigo(gruposPedidos(d.gestor))).toEqual({ ok: true });
  return codigo;
}

const filasDe = (correo: string) =>
  consultar<{ usuarios: number; claves: number }>(
    `select (select count(*)::int from auth.users where email = '${correo}') as usuarios,
            (select count(*)::int from public.claves_de_usuario c join auth.users u on u.id = c.user_id
              where u.email = '${correo}') as claves`,
  )[0];

describe('la cuenta contra la instancia local', () => {
  it('alta, cierre e inicio de sesión en otro dispositivo recuperan la misma clave de datos', async () => {
    const correo = correoDePrueba('cuenta');
    const uno = dispositivo();
    await alta(uno, correo);
    expect(uno.gestor.estado()).toMatchObject({ fase: 'con_sesion', correo });
    const clave = hex((await uno.gestor.leerClaveDeDatos())!);
    expect(filasDe(correo)).toEqual({ usuarios: 1, claves: 1 });

    expect(await uno.gestor.cerrarSesion()).toEqual({ ok: true });
    expect(uno.llavero.size).toBe(0);

    // Otro dispositivo, con el llavero vacío.
    const otro = dispositivo();
    expect(await otro.gestor.iniciarSesion(correo.toUpperCase(), CONTRASENA)).toEqual({ ok: true });
    expect(hex((await otro.gestor.leerClaveDeDatos())!)).toBe(clave);
    // La sesión de Supabase ha ido al llavero de ese dispositivo.
    expect(otro.llavero.has('fc.cuenta.sesion')).toBe(true);
  });

  it('el servidor recibe la subclave de autenticación; nunca la contraseña, la maestra, la clave de datos ni el código', async () => {
    const correo = correoDePrueba('red');
    const d = dispositivo();
    const codigo = await alta(d, correo);
    const claveDeDatos = (await d.gestor.leerClaveDeDatos())!;
    await d.gestor.cerrarSesion();
    await d.gestor.iniciarSesion(correo, 'una contraseña equivocada');
    await d.gestor.iniciarSesion(correo, CONTRASENA);

    const maestra = await derivarClaveMaestra(CONTRASENA, correo);
    const claves = await derivarClaves(CONTRASENA, correo);
    const todo = d.enviado.join('\n');
    expect(d.enviado.length).toBeGreaterThanOrEqual(5);
    // Lo que sí viaja: la subclave de autenticación, como «contraseña» de Supabase.
    const altaEnviada = d.enviado.find((p) => p.includes('/auth/v1/signup'))!;
    expect(JSON.parse(altaEnviada.split('\n')[2])).toMatchObject({
      email: correo,
      password: claves.autenticacion,
    });
    const entrada = d.enviado.filter((p) => p.includes('/auth/v1/token?grant_type=password'));
    expect(JSON.parse(entrada[entrada.length - 1].split('\n')[2]).password).toBe(
      claves.autenticacion,
    );
    // Lo que no viaja, ni en el cuerpo, ni en la dirección, ni en las cabeceras.
    const secretos = [
      CONTRASENA,
      encodeURIComponent(CONTRASENA),
      JSON.stringify(CONTRASENA).slice(1, -1),
      'una contraseña equivocada',
      codigo,
      codigo.replace(/-/g, ''),
      ...gruposDelCodigo(codigo)
        .map((g, i, t) => `${g}-${t[i + 1]}`)
        .slice(0, 13),
      ...formasDe(maestra),
      ...formasDe(claveDeDatos),
      ...formasDe(claves.envoltura),
    ];
    for (const secreto of secretos) {
      expect([secreto.slice(0, 6), todo.includes(secreto)]).toEqual([secreto.slice(0, 6), false]);
    }
    // Solo se habla con la instancia local, y nunca con la clave de servicio.
    for (const peticion of d.enviado) expect(peticion.startsWith(URL_LOCAL)).toBe(true);
    expect(todo).not.toMatch(/service_role/);
  });

  it('en el servidor queda la clave de datos solo envuelta, y la contraseña solo como hash de la subclave', async () => {
    const correo = correoDePrueba('reposo');
    const d = dispositivo();
    await alta(d, correo);
    const claveDeDatos = (await d.gestor.leerClaveDeDatos())!;
    const [fila] = consultar<Record<string, string>>(
      `select c.clave_por_contrasena, c.clave_por_recuperacion, u.encrypted_password
       from public.claves_de_usuario c join auth.users u on u.id = c.user_id where u.email = '${correo}'`,
    );
    expect(fila.clave_por_contrasena).toMatch(/^[A-Za-z0-9_-]{98}$/);
    expect(fila.clave_por_recuperacion).toMatch(/^[A-Za-z0-9_-]{98}$/);
    const guardado = JSON.stringify(fila);
    for (const forma of [...formasDe(claveDeDatos), CONTRASENA]) {
      expect(guardado.includes(forma)).toBe(false);
    }
    // Supabase guarda un hash (bcrypt o similar) de la subclave, no la subclave.
    const { autenticacion } = await derivarClaves(CONTRASENA, correo);
    expect(fila.encrypted_password).not.toContain(autenticacion);
    expect(fila.encrypted_password.length).toBeGreaterThan(40);
  });

  it('alta con un correo ya registrado: no confirma si existe y no toca la cuenta que había', async () => {
    const correo = correoDePrueba('repetido');
    const dueno = dispositivo();
    await alta(dueno, correo);
    const intruso = dispositivo();
    expect(await intruso.gestor.crearCuenta(correo, 'otra contraseña larga 123')).toEqual({
      ok: false,
      error: 'alta_rechazada',
    });
    expect(intruso.llavero.has(CLAVE_DE_DATOS_EN_EL_ALMACEN)).toBe(false);
    expect(filasDe(correo)).toEqual({ usuarios: 1, claves: 1 });
  });

  it('alta interrumpida entre crear el usuario y guardar las claves: al reintentar se completa', async () => {
    const correo = correoDePrueba('interrumpida');
    const d = dispositivo();
    expect(await d.gestor.crearCuenta(correo, CONTRASENA)).toEqual({ ok: true });
    // La app se cierra con el código en pantalla.
    expect(filasDe(correo)).toEqual({ usuarios: 1, claves: 0 });

    const reintento = dispositivo();
    expect(await reintento.gestor.crearCuenta(correo, CONTRASENA)).toEqual({ ok: true });
    expect(reintento.gestor.estado().fase).toBe('pendiente_de_codigo');
    expect(await reintento.gestor.confirmarCodigo(gruposPedidos(reintento.gestor))).toEqual({
      ok: true,
    });
    expect(filasDe(correo)).toEqual({ usuarios: 1, claves: 1 });
    // Y quien no sabe la contraseña no puede terminar el alta de otro.
    const otro = dispositivo();
    expect((await otro.gestor.iniciarSesion(correo, 'no la sé pero pruebo')).ok).toBe(false);
  });

  it('sin conexión en cada paso: mensaje de sin conexión y nada a medias', async () => {
    const SIN = { ok: false, error: 'sin_conexion' };
    const correo = correoDePrueba('sinred');
    const d = dispositivo();
    d.red.cortada = true;
    expect(await d.gestor.crearCuenta(correo, CONTRASENA)).toEqual(SIN);
    expect(await d.gestor.iniciarSesion(correo, CONTRASENA)).toEqual(SIN);
    expect(filasDe(correo)).toEqual({ usuarios: 0, claves: 0 });

    d.red.cortada = false;
    expect(await d.gestor.crearCuenta(correo, CONTRASENA)).toEqual({ ok: true });
    d.red.cortada = true;
    expect(await d.gestor.confirmarCodigo(gruposPedidos(d.gestor))).toEqual(SIN);
    expect(d.gestor.estado().fase).toBe('pendiente_de_codigo');
    d.red.cortada = false;
    expect(await d.gestor.confirmarCodigo(gruposPedidos(d.gestor))).toEqual({ ok: true });

    d.red.cortada = true;
    expect(await d.gestor.borrarCuenta()).toEqual(SIN);
    expect(d.gestor.estado().fase).toBe('con_sesion');
    expect(filasDe(correo)).toEqual({ usuarios: 1, claves: 1 });
    // Cerrar sesión no necesita red.
    expect(await d.gestor.cerrarSesion()).toEqual({ ok: true });
    expect(d.llavero.size).toBe(0);
  });

  it('borrado de cuenta y nueva alta con el mismo correo', async () => {
    const correo = correoDePrueba('borrada');
    const d = dispositivo();
    const codigo1 = await alta(d, correo);
    const clave1 = hex((await d.gestor.leerClaveDeDatos())!);
    expect(await d.gestor.borrarCuenta()).toEqual({ ok: true });
    expect(filasDe(correo)).toEqual({ usuarios: 0, claves: 0 });
    expect(d.llavero.size).toBe(0);
    expect(d.gestor.estado().fase).toBe('sin_sesion');
    // Con la cuenta borrada ya no se puede entrar.
    expect((await d.gestor.iniciarSesion(correo, CONTRASENA)).ok).toBe(false);

    const codigo2 = await alta(d, correo);
    expect(codigo2).not.toBe(codigo1);
    expect(hex((await d.gestor.leerClaveDeDatos())!)).not.toBe(clave1);
    expect(filasDe(correo)).toEqual({ usuarios: 1, claves: 1 });
  });

  it('la misma contraseña en dos cuentas da claves de autenticación distintas', async () => {
    const a = await derivarClaves(CONTRASENA, correoDePrueba('x'));
    const b = await derivarClaves(CONTRASENA, correoDePrueba('y'));
    expect(a.autenticacion).not.toBe(b.autenticacion);
  });
});
