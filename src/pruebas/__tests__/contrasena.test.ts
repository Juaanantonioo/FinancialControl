/**
 * Cambio de contraseña (D-k) y actualización de parámetros de derivación
 * (D-l), con criptografía de verdad y un servidor de mentira que se puede
 * cortar antes o después de cada paso.
 */
import { PARAMETROS_POR_VERSION } from '@/cripto';
import { crearGestorDeCuenta, sobresDeLaColumna, type Dependencias } from '@/estado/cuenta';
import { CLAVE_DE_DATOS_EN_EL_ALMACEN } from '@/lib/almacenSeguro';
import { almacenEnMemoria, servidorDeMentira, type Corte } from '@/pruebas/cuentaDePrueba';

const CORREO = 'ana.ejemplo@example.com';
const VIEJA = 'correcta batería caballo grapa';
const NUEVA = 'otra frase larga y distinta 42';
const SIN = { ok: false, error: 'sin_conexion' };

type Servidor = ReturnType<typeof servidorDeMentira>;

/** Un dispositivo: su llavero y su gestor, contra el servidor compartido. */
function dispositivo(servidor: Servidor, derivacion?: Dependencias['derivacion']) {
  const memoria = almacenEnMemoria();
  const gestor = crearGestorDeCuenta({
    cliente: servidor.cliente,
    almacen: memoria.almacen,
    autocomprobar: async () => ({ correcta: true, milisegundosDeDerivacion: 1 }),
    pausaAntesDeCalcular: 0,
    derivacion,
  });
  return { gestor, memoria, clave: () => memoria.datos.get(CLAVE_DE_DATOS_EN_EL_ALMACEN) };
}

async function conCuenta(derivacion?: Dependencias['derivacion']) {
  const servidor = servidorDeMentira();
  const a = dispositivo(servidor, derivacion);
  expect(await a.gestor.crearCuenta(CORREO, VIEJA)).toEqual({ ok: true });
  const { codigo, gruposPedidos } = a.gestor.estado();
  const grupos = codigo!.split('-');
  expect(await a.gestor.confirmarCodigo(gruposPedidos.map((p) => grupos[p]))).toEqual({
    ok: true,
  });
  const fila = () => [...servidor.claves.values()][0];
  return { servidor, a, claveDeDatos: a.clave()!, fila };
}

/** Prueba a entrar desde un dispositivo nuevo. Devuelve la clave de datos que obtiene, o `null`. */
async function entrar(
  servidor: Servidor,
  contrasena: string,
  derivacion?: Dependencias['derivacion'],
) {
  const nuevo = dispositivo(servidor, derivacion);
  const resultado = await nuevo.gestor.iniciarSesion(CORREO, contrasena);
  return resultado.ok ? (nuevo.clave() ?? null) : null;
}

describe('cambio de contraseña', () => {
  it('la vieja deja de valer, la nueva entra y la clave de datos es la misma', async () => {
    const { servidor, a, claveDeDatos, fila } = await conCuenta();
    const sobreAnterior = fila().clave_por_contrasena;
    const recuperacion = fila().clave_por_recuperacion;
    expect(await a.gestor.cambiarContrasena(VIEJA, NUEVA)).toEqual({ ok: true });
    expect(a.gestor.estado().fase).toBe('con_sesion');
    expect(a.clave()).toBe(claveDeDatos);
    // En el servidor: un solo sobre, distinto del anterior; el de recuperación, intacto.
    expect(sobresDeLaColumna(fila().clave_por_contrasena)).toHaveLength(1);
    expect(fila().clave_por_contrasena).not.toBe(sobreAnterior);
    expect(fila().clave_por_recuperacion).toBe(recuperacion);
    expect(await entrar(servidor, VIEJA)).toBeNull();
    expect(await entrar(servidor, NUEVA)).toBe(claveDeDatos);
  });

  it('sigue los tres pasos en orden: dos sobres, contraseña del servidor, un sobre', async () => {
    const { servidor, a } = await conCuenta();
    servidor.estado.llamadas.length = 0;
    const columnas: number[] = [];
    servidor.estado.cortar = (operacion) => {
      if (operacion === 'updateUser') {
        columnas.push(String([...servidor.claves.values()][0].clave_por_contrasena).length);
      }
      return undefined;
    };
    await a.gestor.cambiarContrasena(VIEJA, NUEVA);
    expect(servidor.estado.llamadas).toEqual([
      'signInWithPassword',
      'select claves',
      'update claves',
      'updateUser',
      'update claves',
    ]);
    // Cuando se cambia la contraseña del servidor, los dos sobres ya están guardados.
    expect(columnas).toEqual([196]);
  });

  it('pide la contraseña actual: con una equivocada no cambia nada', async () => {
    const { servidor, a, fila } = await conCuenta();
    const antes = { ...fila() };
    expect(await a.gestor.cambiarContrasena('no es esta contraseña', NUEVA)).toEqual({
      ok: false,
      error: 'contrasena_actual',
    });
    expect(await a.gestor.cambiarContrasena('', NUEVA)).toEqual({
      ok: false,
      error: 'contrasena_actual',
    });
    expect(fila()).toEqual(antes);
    expect(servidor.estado.llamadas).not.toContain('updateUser');
    expect(a.gestor.estado().fase).toBe('con_sesion');
    expect(await entrar(servidor, VIEJA)).not.toBeNull();
  });

  it('la nueva pasa las mismas reglas que en el alta, y no puede ser la actual', async () => {
    const { servidor, a } = await conCuenta();
    servidor.estado.llamadas.length = 0;
    const cambiar = async (nueva: string) =>
      (await a.gestor.cambiarContrasena(VIEJA, nueva)) as {
        error?: string;
      };
    expect((await cambiar('corta')).error).toBe('contrasena_corta');
    expect((await cambiar('123456789012')).error).toBe('contrasena_evidente');
    expect((await cambiar(CORREO)).error).toBe('contrasena_es_el_correo');
    expect((await cambiar(VIEJA)).error).toBe('contrasena_igual');
    expect(servidor.estado.llamadas).toEqual([]);
  });

  it('al servidor no llega ninguna de las dos contraseñas, ni la clave de datos', async () => {
    const { servidor, a, claveDeDatos } = await conCuenta();
    await a.gestor.cambiarContrasena(VIEJA, NUEVA);
    const recibido = JSON.stringify(servidor.recibido);
    expect(recibido).not.toContain(VIEJA);
    expect(recibido).not.toContain(NUEVA);
    expect(recibido).not.toContain(claveDeDatos);
  });

  it('sin sesión no se puede cambiar', async () => {
    const servidor = servidorDeMentira();
    const d = dispositivo(servidor);
    expect((await d.gestor.cambiarContrasena(VIEJA, NUEVA)).ok).toBe(false);
    // Lo único que hace un dispositivo sin cuenta al arrancar es quitar restos de sesión.
    expect(servidor.estado.llamadas.filter((l) => l !== 'signOut')).toEqual([]);
  });

  it('otro dispositivo con la sesión abierta conserva su clave y sus datos', async () => {
    const { servidor, a, claveDeDatos } = await conCuenta();
    const b = dispositivo(servidor);
    await b.gestor.iniciarSesion(CORREO, VIEJA);
    await a.gestor.cambiarContrasena(VIEJA, NUEVA);
    // B no se entera: sigue con su clave, que es la misma de siempre.
    expect(b.gestor.estado().fase).toBe('con_sesion');
    expect(b.clave()).toBe(claveDeDatos);
    // Cuando vuelva a entrar, será con la nueva.
    await b.gestor.cerrarSesion();
    expect((await b.gestor.iniciarSesion(CORREO, VIEJA)).ok).toBe(false);
    expect(await b.gestor.iniciarSesion(CORREO, NUEVA)).toEqual({ ok: true });
    expect(b.clave()).toBe(claveDeDatos);
  });
});

describe('corte en cada paso del cambio', () => {
  // Las dos escrituras de claves son el paso 1 y el paso 3; updateUser es el paso 2.
  const cortes: {
    nombre: string;
    operacion: string;
    vez: number;
    corte: Corte;
    resultado: unknown;
    valeDespues: 'vieja' | 'nueva';
  }[] = [
    {
      nombre: 'paso 1, la petición no llega',
      operacion: 'update claves',
      vez: 1,
      corte: 'antes',
      resultado: SIN,
      valeDespues: 'vieja',
    },
    {
      nombre: 'paso 1, se guarda y se pierde la respuesta',
      operacion: 'update claves',
      vez: 1,
      corte: 'despues',
      resultado: SIN,
      valeDespues: 'vieja',
    },
    {
      nombre: 'paso 2, la petición no llega',
      operacion: 'updateUser',
      vez: 1,
      corte: 'antes',
      resultado: SIN,
      valeDespues: 'vieja',
    },
    {
      nombre: 'paso 2, el servidor la rechaza',
      operacion: 'updateUser',
      vez: 1,
      corte: 'rechazo',
      resultado: { ok: false, error: 'desconocido' },
      valeDespues: 'vieja',
    },
    {
      nombre: 'paso 2, se cambia y se pierde la respuesta',
      operacion: 'updateUser',
      vez: 1,
      corte: 'despues',
      resultado: SIN,
      valeDespues: 'nueva',
    },
    {
      nombre: 'paso 3, la petición no llega',
      operacion: 'update claves',
      vez: 2,
      corte: 'antes',
      resultado: { ok: true },
      valeDespues: 'nueva',
    },
    {
      nombre: 'paso 3, se guarda y se pierde la respuesta',
      operacion: 'update claves',
      vez: 2,
      corte: 'despues',
      resultado: { ok: true },
      valeDespues: 'nueva',
    },
  ];

  async function cortar(caso: (typeof cortes)[number]) {
    const cuenta = await conCuenta();
    cuenta.servidor.estado.cortar = (operacion, vez) =>
      operacion === caso.operacion && vez === caso.vez ? caso.corte : undefined;
    expect(await cuenta.a.gestor.cambiarContrasena(VIEJA, NUEVA)).toEqual(caso.resultado);
    cuenta.servidor.estado.cortar = null;
    // Pase lo que pase, este dispositivo sigue con su sesión y su clave.
    expect(cuenta.a.gestor.estado().fase).toBe('con_sesion');
    expect(cuenta.a.clave()).toBe(cuenta.claveDeDatos);
    return cuenta;
  }

  it.each(cortes)(
    '$nombre: la cuenta se abre con exactamente una de las dos, y entrar deja un solo sobre',
    async (caso) => {
      const { servidor, claveDeDatos, fila } = await cortar(caso);
      const vale = caso.valeDespues === 'vieja' ? VIEJA : NUEVA;
      const noVale = caso.valeDespues === 'vieja' ? NUEVA : VIEJA;
      expect(await entrar(servidor, noVale)).toBeNull();
      // La que vale abre la cuenta entera: sesión y la misma clave de datos.
      expect(await entrar(servidor, vale)).toBe(claveDeDatos);
      // Y esa entrada ha terminado (o deshecho) el cambio.
      expect(sobresDeLaColumna(fila().clave_por_contrasena)).toHaveLength(1);
      expect(await entrar(servidor, vale)).toBe(claveDeDatos);
      expect(await entrar(servidor, noVale)).toBeNull();
    },
  );

  it.each(cortes)('$nombre: repetir el cambio en el mismo dispositivo lo termina', async (caso) => {
    const { servidor, a, claveDeDatos, fila } = await cortar(caso);
    expect(await a.gestor.cambiarContrasena(VIEJA, NUEVA)).toEqual({ ok: true });
    expect(sobresDeLaColumna(fila().clave_por_contrasena)).toHaveLength(1);
    expect(fila().version_de_derivacion).toBe(1);
    expect(await entrar(servidor, VIEJA)).toBeNull();
    expect(await entrar(servidor, NUEVA)).toBe(claveDeDatos);
    expect(a.clave()).toBe(claveDeDatos);
  });

  it('si la red cae durante el cambio y también al entrar después, la cuenta sigue abriéndose', async () => {
    const caso = cortes.find((c) => c.nombre.startsWith('paso 2, se cambia'))!;
    const { servidor, claveDeDatos, fila } = await cortar(caso);
    // Al entrar, el paso 3 pendiente tampoco se puede guardar.
    servidor.estado.cortar = (operacion) => (operacion === 'update claves' ? 'antes' : undefined);
    expect(await entrar(servidor, NUEVA)).toBe(claveDeDatos);
    expect(sobresDeLaColumna(fila().clave_por_contrasena)).toHaveLength(2);
    servidor.estado.cortar = null;
    expect(await entrar(servidor, NUEVA)).toBe(claveDeDatos);
    expect(sobresDeLaColumna(fila().clave_por_contrasena)).toHaveLength(1);
  });
});

describe('actualización de parámetros de derivación', () => {
  // La versión 2 solo existe aquí: sirve para probar el mecanismo, no para usarse.
  const V2 = {
    actual: 2,
    parametros: { 1: PARAMETROS_POR_VERSION[1], 2: { pasadas: 3, memoria: 16 * 1024 * 1024 } },
  };

  it('la app solo conoce hoy la versión 1, con los parámetros acordados', () => {
    expect(PARAMETROS_POR_VERSION).toEqual({ 1: { pasadas: 8, memoria: 64 * 1024 * 1024 } });
  });

  it('cuenta en versión 1 y app en versión 2: al entrar se actualiza sola y sigue descifrando', async () => {
    const { servidor, a, claveDeDatos, fila } = await conCuenta();
    expect(fila().version_de_derivacion).toBe(1);
    const sobreV1 = fila().clave_por_contrasena;
    const claveDelServidorV1 = [...servidor.usuarios.values()][0].password;
    await a.gestor.cerrarSesion();

    servidor.estado.llamadas.length = 0;
    const b = dispositivo(servidor, V2);
    expect(await b.gestor.iniciarSesion(CORREO, VIEJA)).toEqual({ ok: true });
    expect(b.clave()).toBe(claveDeDatos);
    // Probó la 2, entró con la 1 y rehízo la envoltura en tres pasos.
    expect(servidor.estado.llamadas.filter((l) => l !== 'signOut')).toEqual([
      'signInWithPassword',
      'signInWithPassword',
      'select claves',
      'update claves',
      'updateUser',
      'update claves',
    ]);
    expect(fila().version_de_derivacion).toBe(2);
    expect(sobresDeLaColumna(fila().clave_por_contrasena)).toHaveLength(1);
    expect(fila().clave_por_contrasena).not.toBe(sobreV1);
    expect([...servidor.usuarios.values()][0].password).not.toBe(claveDelServidorV1);

    // La siguiente entrada va directa con la versión 2: una sola petición y nada que rehacer.
    servidor.estado.llamadas.length = 0;
    expect(await entrar(servidor, VIEJA, V2)).toBe(claveDeDatos);
    expect(servidor.estado.llamadas.filter((l) => l !== 'signOut')).toEqual([
      'signInWithPassword',
      'select claves',
    ]);
  });

  it('una contraseña equivocada sigue siendo equivocada, y no cambia nada', async () => {
    const { servidor, fila } = await conCuenta();
    const antes = { ...fila() };
    expect(await entrar(servidor, 'esta no es la contraseña', V2)).toBeNull();
    expect(fila()).toEqual(antes);
  });

  it.each([
    ['update claves', 1, 'antes'],
    ['update claves', 1, 'despues'],
    ['updateUser', 1, 'antes'],
    ['updateUser', 1, 'rechazo'],
    ['updateUser', 1, 'despues'],
    ['update claves', 2, 'antes'],
    ['update claves', 2, 'despues'],
  ] as [string, number, Corte][])(
    'si la actualización se corta en %s (vez %i, %s), se entra igual y se termina en la siguiente entrada',
    async (operacion, vez, corte) => {
      const { servidor, claveDeDatos, fila } = await conCuenta();
      servidor.estado.cortar = (op, n) => (op === operacion && n === vez ? corte : undefined);
      // La entrada no falla porque la actualización se corte.
      expect(await entrar(servidor, VIEJA, V2)).toBe(claveDeDatos);
      servidor.estado.cortar = null;
      expect(await entrar(servidor, VIEJA, V2)).toBe(claveDeDatos);
      expect(fila().version_de_derivacion).toBe(2);
      expect(sobresDeLaColumna(fila().clave_por_contrasena)).toHaveLength(1);
      expect(await entrar(servidor, VIEJA, V2)).toBe(claveDeDatos);
    },
  );

  it('cuenta nueva con la app en versión 2: nace en la 2', async () => {
    const { servidor, claveDeDatos, fila } = await conCuenta(V2);
    expect(fila().version_de_derivacion).toBe(2);
    expect(await entrar(servidor, VIEJA, V2)).toBe(claveDeDatos);
    // Una app que solo conoce la versión 1 no puede entrar en una cuenta de la 2.
    expect(await entrar(servidor, VIEJA)).toBeNull();
  });

  it('cambiar la contraseña de una cuenta en versión 1 con la app en versión 2 la deja en la 2', async () => {
    const { servidor, a, claveDeDatos, fila } = await conCuenta();
    await a.gestor.cerrarSesion();
    const b = dispositivo(servidor, V2);
    // Se entra con la actualización cortada, para que la cuenta siga en la versión 1.
    servidor.estado.cortar = (op) => (op === 'update claves' ? 'antes' : undefined);
    expect(await b.gestor.iniciarSesion(CORREO, VIEJA)).toEqual({ ok: true });
    servidor.estado.cortar = null;
    expect(fila().version_de_derivacion).toBe(1);
    expect(await b.gestor.cambiarContrasena(VIEJA, NUEVA)).toEqual({ ok: true });
    expect(fila().version_de_derivacion).toBe(2);
    expect(await entrar(servidor, NUEVA, V2)).toBe(claveDeDatos);
    expect(await entrar(servidor, VIEJA, V2)).toBeNull();
  });
});

describe('la columna de claves', () => {
  it('admite un sobre o dos, y nada más', async () => {
    const { fila } = await conCuenta();
    const sobre = String(fila().clave_por_contrasena);
    expect(sobre).toHaveLength(98);
    expect(sobresDeLaColumna(sobre)).toEqual([sobre]);
    expect(sobresDeLaColumna(sobre + sobre)).toEqual([sobre, sobre]);
    for (const mala of [null, 5, '', sobre.slice(1), sobre + 'A', sobre + sobre + sobre]) {
      expect(sobresDeLaColumna(mala)).toBeNull();
    }
    // Dos sobres caben en la columna del servidor (98 a 400 caracteres).
    expect((sobre + sobre).length).toBeLessThanOrEqual(400);
  });
});
