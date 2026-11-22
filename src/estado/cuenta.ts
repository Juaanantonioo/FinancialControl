/**
 * La cuenta de usuario: alta, inicio y cierre de sesión, y borrado.
 *
 * Aquí se crean y se guardan las claves con las que se cifran los datos, y se
 * cambia la contraseña. Ninguna función de este fichero toca los datos
 * financieros: sincronizarlos es de `src/sincronizacion/`.
 *
 * Qué sale del dispositivo: el correo, la subclave de autenticación (en
 * lugar de la contraseña) y la clave de datos ya cifrada. Nunca la
 * contraseña, la clave maestra, la clave de datos en claro ni el código de
 * recuperación.
 *
 * Este fichero no importa nada nativo ni de React: recibe el cliente del
 * servidor y el almacén de secretos, para poder probarlo entero.
 *
 * Invariante del alta: las claves de la cuenta solo se guardan en el servidor
 * cuando la persona ha confirmado que tiene su código de recuperación. Si el
 * alta se interrumpe antes, queda un usuario sin claves; al volver a entrar
 * con el mismo correo y la misma contraseña el alta se reanuda con un código
 * nuevo. Nunca queda una cuenta con claves cuyo código nadie ha visto.
 *
 * Invariante del cambio de contraseña: en cada momento hay exactamente una
 * contraseña que abre la cuenta entera. Mientras dura el cambio, la columna
 * `clave_por_contrasena` lleva dos sobres seguidos (el nuevo y el anterior);
 * quien entra después termina o deshace el cambio según cuál abra su
 * contraseña (`docs/seguridad/diseno-sincronizacion.md`, apartado 9).
 */
import { autocomprobarCripto, type ResultadoDeAutocomprobacion } from '@/cripto/autocomprobacion';
import {
  borrar,
  CARACTERES_DE_CLAVE_ENVUELTA,
  claveATexto,
  claveDeTexto,
  derivarClaves,
  desenvolverConContrasena,
  envolverConCodigo,
  envolverConContrasena,
  generarClaveDeDatos,
  generarCodigoDeRecuperacion,
  gruposDelCodigo,
  normalizarCorreo,
  PARAMETROS_POR_VERSION,
  posicionesAlAzar,
  VERSION_DE_DERIVACION,
  VERSION_DE_FORMATO,
  type ClavesDeLaContrasena,
  type ParametrosDeDerivacion,
} from '@/cripto';
import {
  CLAVE_DE_DATOS_EN_EL_ALMACEN,
  CORREO_EN_EL_ALMACEN,
  type AlmacenSeguro,
} from '@/lib/almacenSeguro';
import { esCorreoValido, problemaDeContrasena } from '@/lib/contrasena';

/** Milisegundos que se espera como mucho a una respuesta del servidor. */
export const ESPERA_MAXIMA_MS = 15_000;

type ErrorRemoto = { message?: string; status?: number; code?: string; name?: string } | null;
type Sesion = { user: { id: string; email?: string | null } } | null;

/** Lo que la cuenta necesita del cliente de Supabase. El cliente real lo cumple. */
export interface ClienteDeCuenta {
  auth: {
    signUp(datos: {
      email: string;
      password: string;
    }): Promise<{ data: { user: unknown; session: Sesion }; error: ErrorRemoto }>;
    signInWithPassword(datos: {
      email: string;
      password: string;
    }): Promise<{ data: { session: Sesion }; error: ErrorRemoto }>;
    signOut(opciones: { scope: 'local' }): Promise<{ error: ErrorRemoto }>;
    /** Cambia la «contraseña» del servidor, que es la subclave de autenticación. */
    updateUser(datos: {
      password: string;
      current_password?: string;
    }): Promise<{ error: ErrorRemoto }>;
    getSession(): Promise<{ data: { session: Sesion }; error: ErrorRemoto }>;
  };
  from(tabla: 'claves_de_usuario'): {
    select(columnas: string): {
      maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: ErrorRemoto }>;
    };
    insert(fila: Record<string, unknown>): PromiseLike<{ error: ErrorRemoto }>;
    update(fila: Record<string, unknown>): {
      eq(
        columna: 'user_id',
        valor: string,
      ): {
        /** Devuelve las filas cambiadas: si no hay ninguna, no se ha guardado nada. */
        select(columnas: string): PromiseLike<{ data: unknown[] | null; error: ErrorRemoto }>;
      };
    };
  };
  rpc(funcion: 'borrar_mi_cuenta'): PromiseLike<{ error: ErrorRemoto }>;
}

export type FaseDeCuenta =
  /** Aún no se sabe: se está comprobando la biblioteca y leyendo la sesión. */
  | 'comprobando'
  /** Falta la configuración del servidor (fichero .env). */
  | 'sin_configurar'
  /** La biblioteca criptográfica no ha pasado su autocomprobación. */
  | 'cripto_no_fiable'
  | 'sin_sesion'
  /** Alta a medias: hay que guardar y confirmar el código de recuperación. */
  | 'pendiente_de_codigo'
  | 'con_sesion';

export type EstadoDeCuenta = {
  fase: FaseDeCuenta;
  correo: string | null;
  /** El código de recuperación, solo mientras se enseña. Nunca se guarda. */
  codigo: string | null;
  /** Posiciones (desde 0) de los grupos que hay que escribir para confirmar. */
  gruposPedidos: number[];
  ocupado: boolean;
};

export type ErrorDeCuenta =
  | 'correo_invalido'
  | 'contrasena_corta'
  | 'contrasena_larga'
  | 'contrasena_evidente'
  | 'contrasena_es_el_correo'
  /** Alta rechazada. No se dice si el correo ya existe. */
  | 'alta_rechazada'
  /** Correo o contraseña incorrectos. No se dice cuál. */
  | 'credenciales'
  | 'codigo_no_coincide'
  /** Al cambiar la contraseña: la actual no es correcta. */
  | 'contrasena_actual'
  /** Al cambiar la contraseña: la nueva es la misma que la actual. */
  | 'contrasena_igual'
  | 'sin_conexion'
  | 'no_disponible'
  | 'desconocido';

export type Resultado = { ok: true } | { ok: false; error: ErrorDeCuenta };

const OK: Resultado = { ok: true };
const fallo = (error: ErrorDeCuenta): Resultado => ({ ok: false, error });

class SinConexion extends Error {}

/** Espera una respuesta del servidor como mucho `ESPERA_MAXIMA_MS`. */
function conLimite<T>(promesa: PromiseLike<T>, limite: number): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new SinConexion()), limite);
    Promise.resolve(promesa).then(
      (valor) => {
        clearTimeout(reloj);
        resolver(valor);
      },
      () => {
        clearTimeout(reloj);
        // Un error de red del cliente también es «sin conexión».
        rechazar(new SinConexion());
      },
    );
  });
}

/** `true` si el error del servidor es en realidad un fallo de red. */
function esDeRed(error: ErrorRemoto): boolean {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return true;
  if (error.status === undefined && !error.code) return true;
  return /network|fetch|timeout|failed to|abort/i.test(error.message ?? '');
}

export type Dependencias = {
  /** `null` si falta la configuración del servidor. */
  cliente: ClienteDeCuenta | null;
  almacen: AlmacenSeguro;
  autocomprobar?: () => Promise<ResultadoDeAutocomprobacion>;
  esperaMaxima?: number;
  /** Milisegundos que se cede a la pantalla antes de un cálculo largo, para que pinte «Calculando…». */
  pausaAntesDeCalcular?: number;
  /** Se llama cuando la cuenta se ha borrado del servidor, para desligar de ella la base local. */
  alBorrarCuenta?: () => Promise<void>;
  /**
   * Versiones de derivación que conoce la app y cuál es la actual. Por defecto,
   * las de `src/cripto/parametros.ts`. Las pruebas añaden aquí una versión 2.
   */
  derivacion?: { actual: number; parametros: Readonly<Record<number, ParametrosDeDerivacion>> };
};

/** Los sobres que hay en `clave_por_contrasena`: uno, o dos durante un cambio (nuevo y anterior). */
export function sobresDeLaColumna(columna: unknown): string[] | null {
  if (typeof columna !== 'string') return null;
  const largo = CARACTERES_DE_CLAVE_ENVUELTA;
  if (columna.length === largo) return [columna];
  if (columna.length === 2 * largo) return [columna.slice(0, largo), columna.slice(largo)];
  return null;
}

export type GestorDeCuenta = ReturnType<typeof crearGestorDeCuenta>;

export function crearGestorDeCuenta(dependencias: Dependencias) {
  const { cliente, almacen } = dependencias;
  const autocomprobar = dependencias.autocomprobar ?? autocomprobarCripto;
  const limite = dependencias.esperaMaxima ?? ESPERA_MAXIMA_MS;
  const pausa = dependencias.pausaAntesDeCalcular ?? 50;
  const versionActual = dependencias.derivacion?.actual ?? VERSION_DE_DERIVACION;
  const parametrosPorVersion = dependencias.derivacion?.parametros ?? PARAMETROS_POR_VERSION;
  /** Las versiones con las que puede haberse creado una cuenta: la actual primero. */
  const versionesConocidas = Object.keys(parametrosPorVersion)
    .map(Number)
    .filter((version) => version <= versionActual)
    .sort((a, b) => b - a);
  // La derivación de claves ocupa el hilo de la interfaz medio segundo o más.
  const cederALaPantalla = () => new Promise<void>((seguir) => setTimeout(seguir, pausa));

  let estado: EstadoDeCuenta = {
    fase: 'comprobando',
    correo: null,
    codigo: null,
    gruposPedidos: [],
    ocupado: false,
  };
  const oyentes = new Set<() => void>();
  /** Alta a medias: lo que se guardará cuando se confirme el código. Solo en memoria. */
  let pendiente: {
    claveDeDatos: Uint8Array;
    porContrasena: string;
    porRecuperacion: string;
  } | null = null;
  let iniciando: Promise<void> | null = null;

  function fijar(cambios: Partial<EstadoDeCuenta>): void {
    estado = { ...estado, ...cambios };
    oyentes.forEach((avisar) => avisar());
  }

  function olvidarPendiente(): void {
    borrar(pendiente?.claveDeDatos);
    pendiente = null;
  }

  /** Deja el dispositivo sin sesión y sin clave. No toca los datos financieros. */
  async function limpiarDispositivo(): Promise<void> {
    olvidarPendiente();
    for (const nombre of [CLAVE_DE_DATOS_EN_EL_ALMACEN, CORREO_EN_EL_ALMACEN]) {
      try {
        await almacen.borrar(nombre);
      } catch {
        // Se sigue: lo importante es cerrar la sesión.
      }
    }
    try {
      if (cliente) await conLimite(cliente.auth.signOut({ scope: 'local' }), limite);
    } catch {
      // El cierre local no necesita red; si aun así falla, la sesión caducará sola.
    }
  }

  /** Comprueba la biblioteca y lee la sesión guardada. Se hace una vez. */
  function iniciar(): Promise<void> {
    iniciando ??= (async () => {
      if (!cliente) {
        fijar({ fase: 'sin_configurar' });
        return;
      }
      const { correcta } = await autocomprobar();
      if (!correcta) {
        fijar({ fase: 'cripto_no_fiable' });
        return;
      }
      // Lo que dice si hay cuenta abierta es la clave del llavero, no una
      // consulta al servidor: así la app arranca igual sin conexión, aunque la
      // sesión haya caducado y no se pueda renovar en ese momento.
      try {
        const clave = await almacen.leer(CLAVE_DE_DATOS_EN_EL_ALMACEN);
        if (clave) {
          borrar(await claveDeTexto(clave));
          fijar({ fase: 'con_sesion', correo: await almacen.leer(CORREO_EN_EL_ALMACEN) });
          return;
        }
      } catch {
        // Una clave ilegible no sirve: se trata como si no hubiera.
      }
      // Sin clave no hay cuenta abierta. Si quedó una sesión suelta (alta interrumpida), se quita.
      await limpiarDispositivo();
      fijar({ fase: 'sin_sesion', correo: null });
    })();
    return iniciando;
  }

  /** Ejecuta una operación de cuenta, de una en una y solo si la cuenta está disponible. */
  async function operar(
    permitidas: FaseDeCuenta[],
    tarea: () => Promise<Resultado>,
  ): Promise<Resultado> {
    await iniciar();
    if (!cliente || estado.fase === 'sin_configurar' || estado.fase === 'cripto_no_fiable') {
      return fallo('no_disponible');
    }
    if (estado.ocupado || !permitidas.includes(estado.fase)) return fallo('desconocido');
    fijar({ ocupado: true });
    try {
      return await tarea();
    } catch (error) {
      return fallo(error instanceof SinConexion ? 'sin_conexion' : 'desconocido');
    } finally {
      fijar({ ocupado: false });
    }
  }

  /** Genera clave de datos y código, y deja el alta esperando la confirmación del código. */
  async function prepararClaves(correo: string, envoltura: Uint8Array): Promise<void> {
    olvidarPendiente();
    const claveDeDatos = await generarClaveDeDatos();
    const codigo = await generarCodigoDeRecuperacion();
    pendiente = {
      claveDeDatos,
      porContrasena: await envolverConContrasena(claveDeDatos, envoltura),
      porRecuperacion: await envolverConCodigo(claveDeDatos, codigo),
    };
    fijar({
      fase: 'pendiente_de_codigo',
      correo,
      codigo,
      gruposPedidos: await posicionesAlAzar(gruposDelCodigo(codigo).length, 2),
    });
  }

  // --------------------------------------------- entrada y envoltura de la clave

  type Entrada =
    | { ok: true; claves: ClavesDeLaContrasena; version: number; usuario: string }
    | { ok: false; error: 'credenciales' | 'sin_conexion' };

  /**
   * Inicia sesión en el servidor con la contraseña. Prueba la versión de
   * derivación actual y, si el servidor la rechaza, las anteriores. Quien
   * recibe las claves debe borrar la de envoltura.
   */
  async function entrarEnElServidor(correo: string, contrasena: string): Promise<Entrada> {
    for (const version of versionesConocidas) {
      const claves = await derivarClaves(contrasena, correo, parametrosPorVersion[version]);
      let dentro = false;
      try {
        const entrada = await conLimite(
          cliente!.auth.signInWithPassword({ email: correo, password: claves.autenticacion }),
          limite,
        );
        if (entrada.error && esDeRed(entrada.error)) return { ok: false, error: 'sin_conexion' };
        const usuario = entrada.data.session?.user.id;
        if (!entrada.error && usuario) {
          dentro = true;
          return { ok: true, claves, version, usuario };
        }
      } finally {
        if (!dentro) borrar(claves.envoltura);
      }
    }
    return { ok: false, error: 'credenciales' };
  }

  /** Guarda el contenido de `clave_por_contrasena`. `true` si el servidor lo ha guardado. */
  async function guardarSobres(
    usuario: string,
    sobres: string,
    version?: number,
  ): Promise<'guardado' | 'red' | 'rechazado'> {
    const fila: Record<string, unknown> = { clave_por_contrasena: sobres };
    if (version !== undefined) fila.version_de_derivacion = version;
    try {
      const { data, error } = await conLimite(
        cliente!.from('claves_de_usuario').update(fila).eq('user_id', usuario).select('user_id'),
        limite,
      );
      if (error) return esDeRed(error) ? 'red' : 'rechazado';
      return data?.length === 1 ? 'guardado' : 'rechazado';
    } catch {
      return 'red';
    }
  }

  type Abierta = { claveDeDatos: Uint8Array; sobre: string };

  /**
   * Abre la clave de datos con la clave de envoltura de quien acaba de entrar.
   * Si la columna trae dos sobres es que un cambio de contraseña se cortó: si
   * abre el nuevo, el cambio se termina; si abre el anterior, se deshace.
   * Devuelve `null` si ningún sobre se abre.
   */
  async function abrirClaveDeDatos(
    usuario: string,
    columna: unknown,
    envoltura: Uint8Array,
    version: number,
  ): Promise<Abierta | null> {
    const sobres = sobresDeLaColumna(columna);
    if (!sobres) return null;
    for (const [posicion, sobre] of sobres.entries()) {
      let claveDeDatos: Uint8Array;
      try {
        claveDeDatos = await desenvolverConContrasena(sobre, envoltura);
      } catch {
        continue;
      }
      if (sobres.length === 2) {
        // Terminar (posición 0) guarda también la versión; deshacer (posición 1) no la toca.
        // Si no se puede guardar ahora, la cuenta sigue abriéndose y se hará en la próxima entrada.
        await guardarSobres(usuario, sobre, posicion === 0 ? version : undefined);
      }
      return { claveDeDatos, sobre };
    }
    return null;
  }

  /**
   * Cambia las claves que salen de la contraseña sin cambiar la clave de
   * datos, en tres pasos: (1) guardar el sobre nuevo junto al anterior,
   * (2) cambiar la contraseña del servidor, (3) dejar solo el sobre nuevo.
   * Tras cada paso hay exactamente una contraseña que abre la cuenta.
   */
  async function rehacerEnvoltura(
    usuario: string,
    abierta: Abierta,
    anteriores: ClavesDeLaContrasena,
    nuevas: ClavesDeLaContrasena,
    version: number,
  ): Promise<Resultado> {
    const nuevo = await envolverConContrasena(abierta.claveDeDatos, nuevas.envoltura);
    const paso1 = await guardarSobres(usuario, nuevo + abierta.sobre);
    if (paso1 !== 'guardado') return fallo(paso1 === 'red' ? 'sin_conexion' : 'desconocido');

    let cambio: { error: ErrorRemoto };
    try {
      cambio = await conLimite(
        cliente!.auth.updateUser({
          password: nuevas.autenticacion,
          current_password: anteriores.autenticacion,
        }),
        limite,
      );
    } catch {
      // No se sabe si el servidor llegó a cambiarla: se dejan los dos sobres, que
      // valen para las dos respuestas. Se resuelve al volver a entrar o al repetir el cambio.
      return fallo('sin_conexion');
    }
    if (cambio.error) {
      if (esDeRed(cambio.error)) return fallo('sin_conexion');
      // Rechazado: la contraseña sigue siendo la anterior. Se deshace el paso 1.
      await guardarSobres(usuario, abierta.sobre);
      return fallo('desconocido');
    }
    // La contraseña ya es la nueva. Si el paso 3 no se guarda ahora, lo hará la próxima entrada.
    await guardarSobres(usuario, nuevo, version);
    return OK;
  }

  async function leerColumnaDeClaves(): Promise<
    { ok: true; columna: unknown; hay: boolean } | { ok: false; error: ErrorDeCuenta }
  > {
    const { data, error } = await conLimite(
      cliente!.from('claves_de_usuario').select('clave_por_contrasena').maybeSingle(),
      limite,
    );
    if (error) return { ok: false, error: esDeRed(error) ? 'sin_conexion' : 'desconocido' };
    return { ok: true, columna: data?.clave_por_contrasena, hay: Boolean(data) };
  }

  /**
   * Con una sesión recién abierta: si la cuenta ya tiene claves, las abre con
   * la contraseña y las guarda en el llavero; si no las tiene (alta
   * interrumpida), reanuda el alta. Si la cuenta se derivó con una versión
   * anterior a la actual, la actualiza a continuación.
   */
  async function entrarConSesion(
    correo: string,
    contrasena: string,
    entrada: Extract<Entrada, { ok: true }>,
  ): Promise<Resultado> {
    const leida = await leerColumnaDeClaves();
    if (!leida.ok) {
      await limpiarDispositivo();
      return fallo(leida.error);
    }
    if (!leida.hay) {
      if (entrada.version !== versionActual) {
        // Un alta a medias solo puede ser de la versión actual.
        await limpiarDispositivo();
        return fallo('desconocido');
      }
      await prepararClaves(correo, entrada.claves.envoltura);
      return OK;
    }
    let abierta: Abierta | null = null;
    try {
      abierta = await abrirClaveDeDatos(
        entrada.usuario,
        leida.columna,
        entrada.claves.envoltura,
        entrada.version,
      );
      if (!abierta) throw new Error('Las claves no se abren.');
      await almacen.guardar(CORREO_EN_EL_ALMACEN, correo);
      await almacen.guardar(CLAVE_DE_DATOS_EN_EL_ALMACEN, await claveATexto(abierta.claveDeDatos));
      if (entrada.version < versionActual) {
        // Parámetros anteriores: se rehace la envoltura con los actuales. Si falla,
        // la sesión vale igual y se intentará en la próxima entrada.
        const nuevas = await derivarClaves(contrasena, correo, parametrosPorVersion[versionActual]);
        try {
          await rehacerEnvoltura(entrada.usuario, abierta, entrada.claves, nuevas, versionActual);
        } catch {
          // Igual: no impide entrar.
        } finally {
          borrar(nuevas.envoltura);
        }
      }
    } catch {
      // Las claves del servidor no se abren con esta contraseña, o no se pueden guardar.
      await limpiarDispositivo();
      return fallo('desconocido');
    } finally {
      borrar(abierta?.claveDeDatos);
    }
    fijar({ fase: 'con_sesion', correo, codigo: null, gruposPedidos: [] });
    return OK;
  }

  function validar(correo: string, contrasena: string): ErrorDeCuenta | null {
    if (!esCorreoValido(correo)) return 'correo_invalido';
    const problema = problemaDeContrasena(contrasena, correo);
    if (problema === 'corta') return 'contrasena_corta';
    if (problema === 'larga') return 'contrasena_larga';
    if (problema === 'evidente') return 'contrasena_evidente';
    if (problema === 'es_el_correo') return 'contrasena_es_el_correo';
    return null;
  }

  /**
   * Crea la cuenta. Si el correo ya está registrado, se prueba a entrar con
   * la misma contraseña: si es la suya, es un alta interrumpida y se reanuda
   * (o, si ya estaba completa, se inicia sesión). Si no, se responde lo mismo
   * que ante cualquier otro rechazo, sin confirmar que el correo existe.
   */
  function crearCuenta(correoEscrito: string, contrasena: string): Promise<Resultado> {
    return operar(['sin_sesion'], async () => {
      const invalido = validar(correoEscrito, contrasena);
      if (invalido) return fallo(invalido);
      const correo = normalizarCorreo(correoEscrito);
      await cederALaPantalla();
      const claves = await derivarClaves(contrasena, correo, parametrosPorVersion[versionActual]);
      try {
        const alta = await conLimite(
          cliente!.auth.signUp({ email: correo, password: claves.autenticacion }),
          limite,
        );
        if (alta.error && esDeRed(alta.error)) return fallo('sin_conexion');
        if (!alta.error && alta.data.session) {
          await prepararClaves(correo, claves.envoltura);
          return OK;
        }
        // Rechazada, o aceptada sin sesión (el servidor pide confirmar el correo).
        const entrada = await conLimite(
          cliente!.auth.signInWithPassword({ email: correo, password: claves.autenticacion }),
          limite,
        );
        if (entrada.error && esDeRed(entrada.error)) return fallo('sin_conexion');
        const usuario = entrada.data.session?.user.id;
        if (entrada.error || !usuario) return fallo('alta_rechazada');
        return await entrarConSesion(correo, contrasena, {
          ok: true,
          claves,
          version: versionActual,
          usuario,
        });
      } finally {
        borrar(claves.envoltura);
      }
    });
  }

  /**
   * Confirma que la persona tiene su código: debe escribir los grupos
   * pedidos. Solo entonces se guardan las claves en el servidor y la clave
   * de datos en el llavero.
   */
  function confirmarCodigo(gruposEscritos: string[]): Promise<Resultado> {
    return operar(['pendiente_de_codigo'], async () => {
      if (!pendiente || !estado.codigo) return fallo('desconocido');
      const grupos = gruposDelCodigo(estado.codigo);
      const limpiar = (texto: string) =>
        texto.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
      const coincide =
        gruposEscritos.length === estado.gruposPedidos.length &&
        estado.gruposPedidos.every(
          (posicion, i) => limpiar(gruposEscritos[i] ?? '') === grupos[posicion],
        );
      if (!coincide) return fallo('codigo_no_coincide');
      const { error } = await conLimite(
        cliente!.from('claves_de_usuario').insert({
          clave_por_contrasena: pendiente.porContrasena,
          clave_por_recuperacion: pendiente.porRecuperacion,
          version_de_derivacion: versionActual,
          version_de_formato: VERSION_DE_FORMATO,
        }),
        limite,
      );
      if (error) return fallo(esDeRed(error) ? 'sin_conexion' : 'desconocido');
      await almacen.guardar(CORREO_EN_EL_ALMACEN, estado.correo ?? '');
      await almacen.guardar(
        CLAVE_DE_DATOS_EN_EL_ALMACEN,
        await claveATexto(pendiente.claveDeDatos),
      );
      olvidarPendiente();
      fijar({ fase: 'con_sesion', codigo: null, gruposPedidos: [] });
      return OK;
    });
  }

  /** Abandona un alta a medias. El usuario queda sin claves y podrá reanudarla al volver a entrar. */
  function cancelarAlta(): Promise<Resultado> {
    return operar(['pendiente_de_codigo'], async () => {
      await limpiarDispositivo();
      fijar({ fase: 'sin_sesion', correo: null, codigo: null, gruposPedidos: [] });
      return OK;
    });
  }

  function iniciarSesion(correoEscrito: string, contrasena: string): Promise<Resultado> {
    return operar(['sin_sesion'], async () => {
      if (!esCorreoValido(correoEscrito) || contrasena.length === 0) return fallo('credenciales');
      const correo = normalizarCorreo(correoEscrito);
      await cederALaPantalla();
      const entrada = await entrarEnElServidor(correo, contrasena);
      if (!entrada.ok) return fallo(entrada.error);
      try {
        return await entrarConSesion(correo, contrasena, entrada);
      } finally {
        borrar(entrada.claves.envoltura);
      }
    });
  }

  /**
   * Cambia la contraseña. Pide la actual y la comprueba iniciando sesión con
   * ella. La clave de datos no cambia: no hay que volver a cifrar nada. Si un
   * intento anterior se cortó después de cambiarla en el servidor, repetirlo
   * con los mismos datos lo termina.
   */
  function cambiarContrasena(actual: string, nueva: string): Promise<Resultado> {
    return operar(['con_sesion'], async () => {
      const correo = estado.correo;
      if (!correo) return fallo('desconocido');
      if (actual.length === 0) return fallo('contrasena_actual');
      const invalido = validar(correo, nueva);
      if (invalido) return fallo(invalido);
      if (actual.normalize('NFKC') === nueva.normalize('NFKC')) return fallo('contrasena_igual');
      await cederALaPantalla();

      let entrada = await entrarEnElServidor(correo, actual);
      let yaCambiada = false;
      if (!entrada.ok && entrada.error === 'credenciales') {
        // ¿Se cortó un cambio anterior justo después de cambiarla en el servidor?
        entrada = await entrarEnElServidor(correo, nueva);
        if (!entrada.ok) {
          return fallo(entrada.error === 'credenciales' ? 'contrasena_actual' : entrada.error);
        }
        yaCambiada = true;
      }
      if (!entrada.ok) return fallo(entrada.error);

      let abierta: Abierta | null = null;
      let nuevas: ClavesDeLaContrasena | null = null;
      try {
        const leida = await leerColumnaDeClaves();
        if (!leida.ok) return fallo(leida.error);
        // Si había un cambio a medias, aquí se termina o se deshace.
        abierta = await abrirClaveDeDatos(
          entrada.usuario,
          leida.columna,
          entrada.claves.envoltura,
          entrada.version,
        );
        if (!abierta) return fallo('desconocido');
        if (yaCambiada && entrada.version === versionActual) return OK;
        nuevas = await derivarClaves(nueva, correo, parametrosPorVersion[versionActual]);
        return await rehacerEnvoltura(
          entrada.usuario,
          abierta,
          entrada.claves,
          nuevas,
          versionActual,
        );
      } finally {
        borrar(abierta?.claveDeDatos, entrada.claves.envoltura, nuevas?.envoltura);
      }
    });
  }

  /** Cierra la sesión en este dispositivo. Funciona sin conexión. No toca los datos financieros. */
  function cerrarSesion(): Promise<Resultado> {
    return operar(['con_sesion'], async () => {
      await limpiarDispositivo();
      fijar({ fase: 'sin_sesion', correo: null, codigo: null, gruposPedidos: [] });
      return OK;
    });
  }

  /**
   * Borra la cuenta del servidor y cierra la sesión. Si el servidor no
   * responde no se cambia nada. Los datos financieros locales se conservan.
   */
  function borrarCuenta(): Promise<Resultado> {
    return operar(['con_sesion'], async () => {
      const { error } = await conLimite(cliente!.rpc('borrar_mi_cuenta'), limite);
      if (error) return fallo(esDeRed(error) ? 'sin_conexion' : 'desconocido');
      await limpiarDispositivo();
      try {
        await dependencias.alBorrarCuenta?.();
      } catch {
        // La cuenta ya está borrada; lo que quede del estado local se rehace al entrar en otra.
      }
      fijar({ fase: 'sin_sesion', correo: null, codigo: null, gruposPedidos: [] });
      return OK;
    });
  }

  /** La clave de datos guardada, para cifrar las filas. Quien la pide debe borrarla al acabar. */
  async function leerClaveDeDatos(): Promise<Uint8Array | null> {
    if (estado.fase !== 'con_sesion') return null;
    try {
      const texto = await almacen.leer(CLAVE_DE_DATOS_EN_EL_ALMACEN);
      return texto ? await claveDeTexto(texto) : null;
    } catch {
      return null;
    }
  }

  return {
    iniciar,
    crearCuenta,
    confirmarCodigo,
    cancelarAlta,
    iniciarSesion,
    cerrarSesion,
    cambiarContrasena,
    borrarCuenta,
    leerClaveDeDatos,
    estado: () => estado,
    suscribir(avisar: () => void) {
      oyentes.add(avisar);
      return () => {
        oyentes.delete(avisar);
      };
    },
  };
}
