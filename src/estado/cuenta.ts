/**
 * La cuenta de usuario: alta, inicio y cierre de sesión, y borrado.
 *
 * En este bloque la cuenta NO sincroniza nada: crea las claves con las que
 * se cifrarán los datos y las deja guardadas. Los datos financieros siguen
 * solo en el dispositivo y ninguna función de aquí los toca.
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
 */
import { autocomprobarCripto, type ResultadoDeAutocomprobacion } from '@/cripto/autocomprobacion';
import {
  borrar,
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
  posicionesAlAzar,
  VERSION_DE_DERIVACION,
  VERSION_DE_FORMATO,
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
    getSession(): Promise<{ data: { session: Sesion }; error: ErrorRemoto }>;
  };
  from(tabla: 'claves_de_usuario'): {
    select(columnas: string): {
      maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: ErrorRemoto }>;
    };
    insert(fila: Record<string, unknown>): PromiseLike<{ error: ErrorRemoto }>;
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
};

export type GestorDeCuenta = ReturnType<typeof crearGestorDeCuenta>;

export function crearGestorDeCuenta(dependencias: Dependencias) {
  const { cliente, almacen } = dependencias;
  const autocomprobar = dependencias.autocomprobar ?? autocomprobarCripto;
  const limite = dependencias.esperaMaxima ?? ESPERA_MAXIMA_MS;
  const pausa = dependencias.pausaAntesDeCalcular ?? 50;
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

  /**
   * Con una sesión recién abierta: si la cuenta ya tiene claves, las abre con
   * la contraseña y las guarda en el llavero; si no las tiene (alta
   * interrumpida), reanuda el alta.
   */
  async function entrarConSesion(correo: string, envoltura: Uint8Array): Promise<Resultado> {
    const { data, error } = await conLimite(
      cliente!.from('claves_de_usuario').select('clave_por_contrasena').maybeSingle(),
      limite,
    );
    if (error) {
      await limpiarDispositivo();
      return fallo(esDeRed(error) ? 'sin_conexion' : 'desconocido');
    }
    if (!data) {
      await prepararClaves(correo, envoltura);
      return OK;
    }
    let claveDeDatos: Uint8Array | null = null;
    try {
      claveDeDatos = await desenvolverConContrasena(String(data.clave_por_contrasena), envoltura);
      await almacen.guardar(CORREO_EN_EL_ALMACEN, correo);
      await almacen.guardar(CLAVE_DE_DATOS_EN_EL_ALMACEN, await claveATexto(claveDeDatos));
    } catch {
      // Las claves del servidor no se abren con esta contraseña, o no se pueden guardar.
      await limpiarDispositivo();
      return fallo('desconocido');
    } finally {
      borrar(claveDeDatos);
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
      const claves = await derivarClaves(contrasena, correo);
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
        if (entrada.error || !entrada.data.session) return fallo('alta_rechazada');
        return await entrarConSesion(correo, claves.envoltura);
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
          version_de_derivacion: VERSION_DE_DERIVACION,
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
      const claves = await derivarClaves(contrasena, correo);
      try {
        const entrada = await conLimite(
          cliente!.auth.signInWithPassword({ email: correo, password: claves.autenticacion }),
          limite,
        );
        if (entrada.error && esDeRed(entrada.error)) return fallo('sin_conexion');
        if (entrada.error || !entrada.data.session) return fallo('credenciales');
        return await entrarConSesion(correo, claves.envoltura);
      } finally {
        borrar(claves.envoltura);
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
      fijar({ fase: 'sin_sesion', correo: null, codigo: null, gruposPedidos: [] });
      return OK;
    });
  }

  /** La clave de datos guardada, para cifrar (bloque 4b-2). Quien la pide debe borrarla al acabar. */
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
