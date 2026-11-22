/**
 * Decide CUÁNDO se sincroniza y guarda lo que Cuenta enseña. El trabajo lo
 * hace el motor; esto solo lo llama.
 *
 * - Al abrir la app, al volver de segundo plano y con «Sincronizar ahora»: ya.
 * - Tras un cambio local: un poco después, agrupando los cambios seguidos.
 * - Si falla: se reintenta con espera creciente mientras la app esté abierta.
 * - Un solo ciclo a la vez. Nada de esto bloquea la pantalla: todo va por detrás.
 *
 * Sin React ni nada nativo: el reloj y el motor se reciben.
 */
import type { Motor, ResultadoDeCiclo, ResultadoDeUsarLaNube, Resumen } from './motor';

export type FaseDeSincronizacion =
  /** No hay sesión, o todavía no se ha intentado nada. */
  | 'inactiva'
  /** Hay que preguntar a la persona antes de sincronizar. Cuál de las dos preguntas: `pregunta`. */
  | 'preguntar'
  /** La persona ha dicho «ahora no» a subir sus datos: hay sesión, pero no se sincroniza. */
  | 'en_pausa'
  | 'al_dia'
  /** Alguna fila local no se ha podido subir. */
  | 'parcial'
  | 'sin_conexion'
  | 'sesion_caducada'
  | 'error';

export type EstadoDeSincronizacion = {
  fase: FaseDeSincronizacion;
  /**
   * Con `fase: 'preguntar'`: «subir» (¿subir los datos de este dispositivo a la
   * cuenta?) o «nube» (¿usar los datos de la nube?). Si no, `null`.
   */
  pregunta: 'subir' | 'nube' | null;
  /** Hay un ciclo en marcha ahora mismo. */
  trabajando: boolean;
  /** Cambios locales que aún no han subido. */
  pendientes: number;
  /** Filas remotas que no se han podido abrir. */
  ilegibles: number;
  /** Filas remotas que se han abierto pero aún no se pueden aplicar. */
  noAplicables: number;
  /** Instante de la última sincronización correcta, o `null`. */
  ultima: string | null;
};

export type MotivoDeSincronizacion =
  'arranque' | 'primer_plano' | 'sesion' | 'cambio' | 'manual' | 'reintento';

export interface Temporizador {
  poner(tarea: () => void, milisegundos: number): unknown;
  quitar(reloj: unknown): void;
}

/** Esperas entre reintentos tras un fallo. La última se repite. */
export const ESPERAS_DE_REINTENTO_MS = [5_000, 15_000, 60_000, 300_000];
/** Tiempo que se espera tras un cambio local, para agrupar los que vengan seguidos. */
export const AGRUPACION_DE_CAMBIOS_MS = 3_000;

const TEMPORIZADOR_REAL: Temporizador = {
  poner: (tarea, milisegundos) => setTimeout(tarea, milisegundos),
  quitar: (reloj) => clearTimeout(reloj as ReturnType<typeof setTimeout>),
};

type MotorUsado = Pick<
  Motor,
  'ciclo' | 'evaluarEntrada' | 'subirLoLocal' | 'usarLaNube' | 'desligar' | 'resumen'
>;

export type ResultadoDeSubir =
  | 'hecho'
  /** Mientras se preguntaba, la nube ha recibido datos: ahora toca la otra pregunta. */
  | 'hay_nube'
  | 'sin_conexion'
  | 'sesion_caducada'
  | 'error';

export type DependenciasDelSincronizador = {
  /** El motor, cuando la base de datos esté abierta. */
  motor: () => Promise<MotorUsado>;
  /** `true` si hay una cuenta abierta en este dispositivo. Sin ella no se hace nada. */
  haySesion: () => boolean;
  /** Se llama cuando la sincronización ha cambiado datos locales, para refrescar las pantallas. */
  alAplicar?: () => void;
  temporizador?: Temporizador;
  esperas?: number[];
  agrupacionMs?: number;
};

export type Sincronizador = ReturnType<typeof crearSincronizador>;

const INICIAL: EstadoDeSincronizacion = {
  fase: 'inactiva',
  pregunta: null,
  trabajando: false,
  pendientes: 0,
  ilegibles: 0,
  noAplicables: 0,
  ultima: null,
};

export function crearSincronizador(dependencias: DependenciasDelSincronizador) {
  const { haySesion } = dependencias;
  const temporizador = dependencias.temporizador ?? TEMPORIZADOR_REAL;
  const esperas = dependencias.esperas ?? ESPERAS_DE_REINTENTO_MS;
  const agrupacion = dependencias.agrupacionMs ?? AGRUPACION_DE_CAMBIOS_MS;

  let estado: EstadoDeSincronizacion = INICIAL;
  const oyentes = new Set<() => void>();
  let enMarcha: Promise<void> | null = null;
  let otraVez = false;
  let repasoPedido = false;
  let fallosSeguidos = 0;
  let relojDeCambio: unknown = null;
  let relojDeReintento: unknown = null;

  function fijar(cambios: Partial<EstadoDeSincronizacion>): void {
    estado = { ...estado, ...cambios };
    // La pregunta solo existe mientras se pregunta.
    if (estado.fase !== 'preguntar' && estado.pregunta !== null) {
      estado = { ...estado, pregunta: null };
    }
    oyentes.forEach((avisar) => avisar());
  }

  function quitarRelojes(): void {
    if (relojDeCambio !== null) temporizador.quitar(relojDeCambio);
    if (relojDeReintento !== null) temporizador.quitar(relojDeReintento);
    relojDeCambio = null;
    relojDeReintento = null;
  }

  function deResumen(resumen: Resumen): Partial<EstadoDeSincronizacion> {
    return {
      pendientes: resumen.pendientes,
      ilegibles: resumen.ilegibles,
      noAplicables: resumen.noAplicables,
      ultima: resumen.ultima,
    };
  }

  function programarReintento(): void {
    if (relojDeReintento !== null) temporizador.quitar(relojDeReintento);
    const espera = esperas[Math.min(fallosSeguidos, esperas.length - 1)];
    fallosSeguidos += 1;
    relojDeReintento = temporizador.poner(() => {
      relojDeReintento = null;
      void pedir('reintento');
    }, espera);
  }

  /** Un ciclo, resolviendo antes la entrada en la cuenta si la base no está ligada. */
  async function unaVuelta(repaso: boolean): Promise<void> {
    const motor = await dependencias.motor();
    let resultado: ResultadoDeCiclo = await motor.ciclo({ repaso });
    if (resultado.estado === 'sin_ligar') {
      const entrada = await motor.evaluarEntrada();
      if (entrada.estado === 'preguntar') {
        // No se reintenta sola: espera la respuesta de la persona.
        fijar({
          fase: 'preguntar',
          pregunta: entrada.pregunta,
          ...deResumen(await motor.resumen()),
          pendientes: 0,
        });
        return;
      }
      if (entrada.estado !== 'lista') {
        fijar({ fase: entrada.estado === 'sin_clave' ? 'error' : entrada.estado });
        if (entrada.estado !== 'sesion_caducada') programarReintento();
        return;
      }
      // Al quitar las categorías iniciales para bajar, las pantallas tienen que enterarse.
      if (entrada.accion === 'bajar') dependencias.alAplicar?.();
      resultado = await motor.ciclo({ repaso });
    }
    if (!haySesion()) return;
    if (resultado.aplicadas > 0) dependencias.alAplicar?.();
    const resumen = deResumen(await motor.resumen());
    switch (resultado.estado) {
      case 'correcto':
        fallosSeguidos = 0;
        fijar({ fase: 'al_dia', ...resumen });
        return;
      case 'sesion_caducada':
        // Reintentar no arregla nada: hay que volver a entrar.
        fijar({ fase: 'sesion_caducada', ...resumen });
        return;
      case 'parcial':
      case 'sin_conexion':
        fijar({ fase: resultado.estado, ...resumen });
        programarReintento();
        return;
      default:
        // «sin_ligar» por segunda vez, «sin_clave» o un error: no se puede seguir ahora.
        fijar({ fase: 'error', ...resumen });
        programarReintento();
    }
  }

  function ejecutar(repaso: boolean): Promise<void> {
    if (enMarcha) {
      // Ya hay un ciclo: se hará otro al terminar, para recoger lo que haya cambiado.
      otraVez = true;
      repasoPedido ||= repaso;
      return enMarcha;
    }
    fijar({ trabajando: true });
    enMarcha = (async () => {
      try {
        await unaVuelta(repaso);
        while (
          otraVez &&
          haySesion() &&
          estado.fase !== 'preguntar' &&
          estado.fase !== 'en_pausa'
        ) {
          const conRepaso = repasoPedido;
          otraVez = false;
          repasoPedido = false;
          await unaVuelta(conRepaso);
        }
      } catch {
        fijar({ fase: 'error' });
        programarReintento();
      } finally {
        otraVez = false;
        repasoPedido = false;
        enMarcha = null;
        fijar({ trabajando: false });
      }
    })();
    return enMarcha;
  }

  /**
   * Pide una sincronización. No espera a la red para volver salvo que quien
   * llama espere la promesa. Sin sesión no hace nada.
   */
  function pedir(motivo: MotivoDeSincronizacion): Promise<void> {
    if (!haySesion()) {
      quitarRelojes();
      if (estado !== INICIAL) fijar(INICIAL);
      return Promise.resolve();
    }
    // Con la pregunta abierta solo la respuesta de la persona mueve algo.
    if (estado.fase === 'preguntar' && motivo !== 'sesion') return Promise.resolve();
    // En pausa solo se vuelve a preguntar si la persona lo pide.
    if (estado.fase === 'en_pausa' && motivo !== 'sesion' && motivo !== 'manual') {
      return Promise.resolve();
    }
    if (motivo === 'cambio') {
      if (relojDeCambio !== null) temporizador.quitar(relojDeCambio);
      relojDeCambio = temporizador.poner(() => {
        relojDeCambio = null;
        void ejecutar(false);
      }, agrupacion);
      return Promise.resolve();
    }
    if (motivo !== 'reintento' && relojDeReintento !== null) {
      temporizador.quitar(relojDeReintento);
      relojDeReintento = null;
    }
    if (motivo === 'manual') fallosSeguidos = 0;
    return ejecutar(motivo === 'manual');
  }

  /**
   * Respuesta «Usar los datos de la nube» a la pregunta de entrada. `exportar`
   * entrega antes a la persona una copia de lo local y dice si la ha guardado.
   */
  async function usarLaNube(exportar: () => Promise<boolean>): Promise<ResultadoDeUsarLaNube> {
    if (enMarcha) await enMarcha;
    fijar({ trabajando: true });
    let resultado: ResultadoDeUsarLaNube;
    try {
      const motor = await dependencias.motor();
      resultado = await motor.usarLaNube(exportar);
      if (resultado.estado === 'hecho') {
        dependencias.alAplicar?.();
        fijar({ fase: 'al_dia', ...deResumen(await motor.resumen()) });
      }
    } catch {
      resultado = { estado: 'error' };
    } finally {
      fijar({ trabajando: false });
    }
    if (resultado.estado === 'hecho') void pedir('sesion');
    return resultado;
  }

  /** Respuesta «sí» a «¿Subir los datos de este dispositivo a tu cuenta?». */
  async function confirmarSubida(): Promise<ResultadoDeSubir> {
    if (enMarcha) await enMarcha;
    fijar({ trabajando: true });
    let entrada: Awaited<ReturnType<MotorUsado['subirLoLocal']>>;
    try {
      entrada = await (await dependencias.motor()).subirLoLocal();
    } catch {
      entrada = { estado: 'error' };
    } finally {
      fijar({ trabajando: false });
    }
    if (entrada.estado === 'lista') {
      await pedir('sesion');
      return 'hecho';
    }
    if (entrada.estado === 'preguntar') {
      fijar({ fase: 'preguntar', pregunta: entrada.pregunta });
      return 'hay_nube';
    }
    return entrada.estado === 'sin_clave' ? 'error' : entrada.estado;
  }

  /**
   * Respuesta «cancelar» a esa misma pregunta: no se sincroniza y no se borra
   * nada. La sesión sigue abierta. Se vuelve a preguntar con «Sincronizar ahora»
   * o la próxima vez que se abra la app.
   */
  function posponerSubida(): void {
    if (estado.fase === 'preguntar' && estado.pregunta === 'subir') fijar({ fase: 'en_pausa' });
  }

  /** Al cerrar sesión: se para todo. La base sigue ligada, para continuar al volver a entrar. */
  function alCerrarSesion(): void {
    quitarRelojes();
    fallosSeguidos = 0;
    fijar(INICIAL);
  }

  /** Al borrar la cuenta: además, la base deja de estar ligada a ella. */
  async function alBorrarCuenta(): Promise<void> {
    alCerrarSesion();
    try {
      if (enMarcha) await enMarcha;
      await (await dependencias.motor()).desligar();
    } catch {
      // Si no se puede desligar ahora, al entrar en otra cuenta se decide de nuevo.
    }
  }

  return {
    pedir,
    confirmarSubida,
    posponerSubida,
    usarLaNube,
    alCerrarSesion,
    alBorrarCuenta,
    /** Quita los relojes pendientes (al desmontar la app en las pruebas). */
    detener: quitarRelojes,
    estado: () => estado,
    suscribir(avisar: () => void) {
      oyentes.add(avisar);
      return () => {
        oyentes.delete(avisar);
      };
    },
  };
}
