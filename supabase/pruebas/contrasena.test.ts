/**
 * Cambio de contraseña (D-k) y actualización de parámetros (D-l) contra un
 * Supabase de verdad (instancia local): el código de `src/estado/cuenta.ts`
 * con el cliente real, cortando la red antes o después de cada paso, y el
 * motor de sincronización para comprobar que las filas se siguen descifrando.
 */
import { createClient } from '@supabase/supabase-js';

import { gruposDelCodigo, PARAMETROS_POR_VERSION } from '@/cripto';
import { crearGestorDeCuenta, type ClienteDeCuenta, type Dependencias } from '@/estado/cuenta';
import { CLAVE_DE_DATOS_EN_EL_ALMACEN, type AlmacenSeguro } from '@/lib/almacenSeguro';
import { prepararPrueba } from '@/pruebas/bdDePrueba';
import {
  INICIALES,
  sembrarTodo,
  volcar,
  type Dispositivo,
  entrarSubiendo,
} from '@/pruebas/sincronizacionDePrueba';
import { crearMotor } from '@/sincronizacion/motor';
import { crearServidorDeFilas } from '@/sincronizacion/servidor';

import { CLAVE_PUBLICA, consultar, correoDePrueba, URL_LOCAL } from './apoyo';

const VIEJA = 'correcta batería caballo grapa';
const NUEVA = 'otra frase larga y distinta 42';
const SIN = { ok: false, error: 'sin_conexion' };

type Operacion = 'update claves' | 'updateUser';
type Corte = 'antes' | 'despues';

function operacionDe(metodo: string, url: string): Operacion | null {
  if (metodo === 'PATCH' && url.includes('/rest/v1/claves_de_usuario')) return 'update claves';
  if (metodo === 'PUT' && url.endsWith('/auth/v1/user')) return 'updateUser';
  return null;
}

/** Un dispositivo: llavero, cliente real con la sesión en él, gestor de cuenta, base local y motor. */
async function dispositivo(derivacion?: Dependencias['derivacion']) {
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
  const enviado: string[] = [];
  const veces = new Map<Operacion, number>();
  const red = { cortar: null as null | ((operacion: Operacion, vez: number) => Corte | undefined) };
  const fetchEspiado: typeof fetch = async (entrada, opciones) => {
    const url = String(entrada);
    enviado.push(`${url}\n${String(opciones?.body ?? '')}`);
    const operacion = operacionDe(opciones?.method ?? 'GET', url);
    let corte: Corte | undefined;
    if (operacion) {
      const vez = (veces.get(operacion) ?? 0) + 1;
      veces.set(operacion, vez);
      corte = red.cortar?.(operacion, vez);
    }
    if (corte === 'antes') throw new TypeError('Network request failed');
    const respuesta = await fetch(entrada, opciones);
    // La petición llegó y se aplicó, pero la respuesta se pierde por el camino.
    if (corte === 'despues') throw new TypeError('Network request failed');
    return respuesta;
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
    derivacion,
  });
  const base = await prepararPrueba(INICIALES);
  const motor = crearMotor({
    bd: base.bd,
    servidor: crearServidorDeFilas(cliente),
    leerClave: () => gestor.leerClaveDeDatos(),
    ahora: base.entorno.ahora,
    categoriasIniciales: INICIALES,
  });
  return {
    ...base,
    motor,
    volcar: () => volcar(base.bd),
    gestor,
    enviado,
    red,
    clave: () => llavero.get(CLAVE_DE_DATOS_EN_EL_ALMACEN),
  };
}

type Aparato = Awaited<ReturnType<typeof dispositivo>>;

async function conCuenta(derivacion?: Dependencias['derivacion']) {
  const correo = correoDePrueba('clave');
  const a = await dispositivo(derivacion);
  expect(await a.gestor.crearCuenta(correo, VIEJA)).toEqual({ ok: true });
  const { codigo, gruposPedidos } = a.gestor.estado();
  const grupos = gruposDelCodigo(codigo!);
  expect(await a.gestor.confirmarCodigo(gruposPedidos.map((p) => grupos[p]))).toEqual({
    ok: true,
  });
  const fila = () =>
    consultar<{ largo: number; version: number; recuperacion: string; contrasena: string }>(
      `select char_length(c.clave_por_contrasena) as largo, c.version_de_derivacion as version,
              c.clave_por_recuperacion as recuperacion, c.clave_por_contrasena as contrasena
         from public.claves_de_usuario c join auth.users u on u.id = c.user_id
        where u.email = '${correo}'`,
    )[0];
  return { correo, a, claveDeDatos: a.clave()!, fila };
}

/** Prueba a entrar desde un dispositivo nuevo. Devuelve la clave de datos que obtiene, o `null`. */
async function entrar(correo: string, contrasena: string, derivacion?: Dependencias['derivacion']) {
  const nuevo = await dispositivo(derivacion);
  const resultado = await nuevo.gestor.iniciarSesion(correo, contrasena);
  return resultado.ok ? (nuevo.clave() ?? null) : null;
}

describe('cambio de contraseña contra la instancia local', () => {
  it('la vieja deja de valer, la nueva entra, y las filas se siguen descifrando en otro dispositivo tras volver a entrar', async () => {
    const { correo, a, claveDeDatos, fila } = await conCuenta();
    // A sube datos de las doce tablas; B entra en la cuenta y los baja.
    const datos = await sembrarTodo(a as unknown as Dispositivo);
    expect(await entrarSubiendo(a)).toEqual({ estado: 'lista', accion: 'subir' });
    expect((await a.motor.ciclo()).estado).toBe('correcto');
    const b = await dispositivo();
    expect(await b.gestor.iniciarSesion(correo, VIEJA)).toEqual({ ok: true });
    expect(await entrarSubiendo(b)).toEqual({ estado: 'lista', accion: 'bajar' });
    expect((await b.motor.ciclo()).estado).toBe('correcto');
    expect(await b.volcar()).toEqual(await a.volcar());

    const antes = fila();
    expect(await a.gestor.cambiarContrasena(VIEJA, NUEVA)).toEqual({ ok: true });
    const despues = fila();
    expect(despues).toMatchObject({ largo: 98, version: 1, recuperacion: antes.recuperacion });
    expect(despues.contrasena).not.toBe(antes.contrasena);
    expect(a.clave()).toBe(claveDeDatos);

    // La vieja ya no vale; la nueva sí.
    expect(await entrar(correo, VIEJA)).toBeNull();
    expect(await entrar(correo, NUEVA)).toBe(claveDeDatos);

    // A sigue sincronizando con su sesión de siempre, sin recifrar nada.
    const nuevo = await a.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-22',
      importe: 777,
      cuentaId: datos.banco.id,
      nombre: 'Tras el cambio',
    });
    expect(await a.motor.ciclo()).toMatchObject({ estado: 'correcto', subidas: 1 });

    // La sesión que B ya tenía abierta, ¿sigue valiendo en el servidor tras el cambio?
    // Sí: cambiar la contraseña NO cierra al momento las sesiones abiertas en otros
    // dispositivos. Es un riesgo anotado en el diseño (apartado 9.5), y aquí queda vigilado:
    // si Supabase cambia este comportamiento, esta línea avisará.
    expect((await b.motor.ciclo()).estado).toBe('correcto');

    // B vuelve a entrar con la nueva: su base sigue ligada a la cuenta y continúa.
    expect(await b.gestor.cerrarSesion()).toEqual({ ok: true });
    expect((await b.gestor.iniciarSesion(correo, VIEJA)).ok).toBe(false);
    expect(await b.gestor.iniciarSesion(correo, NUEVA)).toEqual({ ok: true });
    expect(b.clave()).toBe(claveDeDatos);
    expect(await entrarSubiendo(b)).toEqual({ estado: 'lista', accion: 'continuar' });
    expect(await b.motor.ciclo()).toMatchObject({ estado: 'correcto', retenidas: 0 });
    expect((await b.movimientos.obtener(nuevo.id))?.importe).toBe(777);
    expect(await b.volcar()).toEqual(await a.volcar());
    expect((await b.motor.resumen()).ilegibles).toBe(0);

    // Un tercer dispositivo, recién instalado, baja y descifra todo con la contraseña nueva.
    const c = await dispositivo();
    expect(await c.gestor.iniciarSesion(correo, NUEVA)).toEqual({ ok: true });
    expect(await entrarSubiendo(c)).toEqual({ estado: 'lista', accion: 'bajar' });
    expect(await c.motor.ciclo()).toMatchObject({ estado: 'correcto', retenidas: 0 });
    expect(await c.volcar()).toEqual(await a.volcar());

    // Ninguna contraseña ha salido de ningún dispositivo.
    for (const aparato of [a, b, c]) {
      const todo = aparato.enviado.join('\n');
      expect(todo).not.toContain(VIEJA);
      expect(todo).not.toContain(NUEVA);
      expect(todo).not.toContain(claveDeDatos);
    }
  }, 120_000);

  it('con la contraseña actual equivocada no cambia nada y la sesión sigue', async () => {
    const { correo, a, fila } = await conCuenta();
    const antes = fila();
    expect(await a.gestor.cambiarContrasena('esta no es la actual', NUEVA)).toEqual({
      ok: false,
      error: 'contrasena_actual',
    });
    expect(fila()).toEqual(antes);
    expect(a.gestor.estado().fase).toBe('con_sesion');
    // La sesión anterior sigue sirviendo para sincronizar.
    expect(await entrarSubiendo(a)).toEqual({ estado: 'lista', accion: 'subir' });
    expect((await a.motor.ciclo()).estado).toBe('correcto');
    expect(await entrar(correo, VIEJA)).not.toBeNull();
  }, 60_000);
});

describe('corte en cada paso, contra la instancia local', () => {
  const cortes: {
    nombre: string;
    operacion: Operacion;
    vez: number;
    corte: Corte;
    resultado: unknown;
    vale: 'vieja' | 'nueva';
  }[] = [
    {
      nombre: 'paso 1, no llega',
      operacion: 'update claves',
      vez: 1,
      corte: 'antes',
      resultado: SIN,
      vale: 'vieja',
    },
    {
      nombre: 'paso 1, se pierde la respuesta',
      operacion: 'update claves',
      vez: 1,
      corte: 'despues',
      resultado: SIN,
      vale: 'vieja',
    },
    {
      nombre: 'paso 2, no llega',
      operacion: 'updateUser',
      vez: 1,
      corte: 'antes',
      resultado: SIN,
      vale: 'vieja',
    },
    {
      nombre: 'paso 2, se pierde la respuesta',
      operacion: 'updateUser',
      vez: 1,
      corte: 'despues',
      resultado: SIN,
      vale: 'nueva',
    },
    {
      nombre: 'paso 3, no llega',
      operacion: 'update claves',
      vez: 2,
      corte: 'antes',
      resultado: { ok: true },
      vale: 'nueva',
    },
    {
      nombre: 'paso 3, se pierde la respuesta',
      operacion: 'update claves',
      vez: 2,
      corte: 'despues',
      resultado: { ok: true },
      vale: 'nueva',
    },
  ];

  async function cortar(caso: (typeof cortes)[number]) {
    const cuenta = await conCuenta();
    cuenta.a.red.cortar = (operacion, vez) =>
      operacion === caso.operacion && vez === caso.vez ? caso.corte : undefined;
    expect(await cuenta.a.gestor.cambiarContrasena(VIEJA, NUEVA)).toEqual(caso.resultado);
    cuenta.a.red.cortar = null;
    expect(cuenta.a.gestor.estado().fase).toBe('con_sesion');
    expect(cuenta.a.clave()).toBe(cuenta.claveDeDatos);
    return cuenta;
  }

  it.each(cortes)(
    '$nombre: la cuenta sigue accesible con exactamente una de las dos contraseñas',
    async (caso) => {
      const { correo, claveDeDatos, fila } = await cortar(caso);
      const vale = caso.vale === 'vieja' ? VIEJA : NUEVA;
      const noVale = caso.vale === 'vieja' ? NUEVA : VIEJA;
      expect(await entrar(correo, noVale)).toBeNull();
      expect(await entrar(correo, vale)).toBe(claveDeDatos);
      // Esa entrada ha terminado o deshecho el cambio: queda un solo sobre.
      expect(fila().largo).toBe(98);
      expect(await entrar(correo, vale)).toBe(claveDeDatos);
    },
    90_000,
  );

  it.each(cortes)(
    '$nombre: la app sabe terminar el cambio al repetirlo',
    async (caso) => {
      const { correo, a, claveDeDatos, fila } = await cortar(caso);
      expect(await a.gestor.cambiarContrasena(VIEJA, NUEVA)).toEqual({ ok: true });
      expect(fila()).toMatchObject({ largo: 98, version: 1 });
      expect(await entrar(correo, VIEJA)).toBeNull();
      expect(await entrar(correo, NUEVA)).toBe(claveDeDatos);
    },
    90_000,
  );
});

describe('actualización de parámetros, contra la instancia local', () => {
  // La versión 2 solo existe en las pruebas.
  const V2 = {
    actual: 2,
    parametros: { 1: PARAMETROS_POR_VERSION[1], 2: { pasadas: 3, memoria: 16 * 1024 * 1024 } },
  };

  it('cuenta en versión 1 y app en versión 2: al entrar se actualiza sola y sigue descifrando', async () => {
    const { correo, a, claveDeDatos, fila } = await conCuenta();
    await sembrarTodo(a as unknown as Dispositivo);
    await entrarSubiendo(a);
    await a.motor.ciclo();
    expect(fila()).toMatchObject({ largo: 98, version: 1 });

    const b = await dispositivo(V2);
    expect(await b.gestor.iniciarSesion(correo, VIEJA)).toEqual({ ok: true });
    expect(b.clave()).toBe(claveDeDatos);
    expect(fila()).toMatchObject({ largo: 98, version: 2 });
    // Sigue descifrando: baja las filas que subió A.
    expect(await entrarSubiendo(b)).toEqual({ estado: 'lista', accion: 'bajar' });
    expect(await b.motor.ciclo()).toMatchObject({ estado: 'correcto', retenidas: 0 });
    expect(await b.volcar()).toEqual(await a.volcar());

    // Con la app en versión 2 se entra ya directamente; con una que solo conoce la 1, no.
    expect(await entrar(correo, VIEJA, V2)).toBe(claveDeDatos);
    expect(await entrar(correo, VIEJA)).toBeNull();
    // El dispositivo A, que no ha cerrado sesión, conserva su clave.
    expect(a.clave()).toBe(claveDeDatos);
  }, 90_000);

  it.each([
    ['update claves', 1, 'despues'],
    ['updateUser', 1, 'despues'],
    ['update claves', 2, 'antes'],
  ] as [Operacion, number, Corte][])(
    'si la actualización se corta en %s (vez %i, %s), se entra igual y termina en la siguiente entrada',
    async (operacion, vez, corte) => {
      const { correo, claveDeDatos, fila } = await conCuenta();
      const b = await dispositivo(V2);
      b.red.cortar = (op, n) => (op === operacion && n === vez ? corte : undefined);
      expect(await b.gestor.iniciarSesion(correo, VIEJA)).toEqual({ ok: true });
      expect(b.clave()).toBe(claveDeDatos);
      expect(await entrar(correo, VIEJA, V2)).toBe(claveDeDatos);
      expect(fila()).toMatchObject({ largo: 98, version: 2 });
    },
    90_000,
  );
});
