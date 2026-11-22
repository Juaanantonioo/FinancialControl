/**
 * Seguridad local: el bloqueo de la app y el modo privado.
 *
 * El estado vive fuera de React para poder decidirlo al cargar la app, antes
 * del primer pintado: si hay bloqueo, lo primero que se pinta es la pantalla
 * de bloqueo. Las reglas (cuándo toca bloquear, qué hacer tras autenticar)
 * están en `src/dominio/bloqueo.ts`.
 *
 * El bloqueo es una barrera de acceso a la interfaz. No cifra nada.
 */
import { useSyncExternalStore } from 'react';

import {
  SIN_BLOQUEO,
  tocaBloquear,
  trasAutenticar,
  type AjustesDeBloqueo,
  type Capacidad,
  type Espera,
  type Instante,
  type ResultadoDeAutenticacion,
} from '@/dominio/bloqueo';
import { t } from '@/i18n';
import type { Autenticador } from '@/lib/autenticacion';
import type { AlmacenDeSeguridad } from '@/lib/seguridad';

export type EstadoDeSeguridad = {
  bloqueo: AjustesDeBloqueo;
  /** Modo privado: sin importes en el widget ni en los avisos, y app cubierta en el selector. */
  privado: boolean;
  /** La app pide autenticación y no enseña nada hasta recibirla. */
  bloqueada: boolean;
  /** La app está en segundo plano o a punto de estarlo, y su contenido se tapa. */
  cubierta: boolean;
  autenticando: boolean;
  /** El último intento de desbloqueo no salió bien. */
  fallo: boolean;
  /** El bloqueo está activado pero el iPhone ya no tiene código ni biometría. */
  sinProteccion: boolean;
};

export type EstadoDeLaApp = 'active' | 'inactive' | 'background' | 'unknown' | 'extension';

const INICIAL: EstadoDeSeguridad = {
  bloqueo: { ...SIN_BLOQUEO },
  privado: false,
  bloqueada: false,
  cubierta: false,
  autenticando: false,
  fallo: false,
  sinProteccion: false,
};

let estado: EstadoDeSeguridad = INICIAL;
let almacen: AlmacenDeSeguridad | null = null;
let autenticador: Autenticador | null = null;
/** Instante en que la app pasó a segundo plano, o `null` si está delante. */
let salida: Instante | null = null;
/** Queda por pedir autenticación en cuanto la app esté delante. */
let pendienteDePedir = false;
const oyentes = new Set<() => void>();

function fijar(cambios: Partial<EstadoDeSeguridad>): void {
  estado = { ...estado, ...cambios };
  oyentes.forEach((avisar) => avisar());
}

/**
 * Lee las preferencias y deja la app bloqueada si el bloqueo está activo. Se
 * llama una vez, al cargar la raíz de la app, antes del primer pintado.
 */
export function iniciarSeguridad(deDondeLeer: AlmacenDeSeguridad, conQue: Autenticador): void {
  almacen = deDondeLeer;
  autenticador = conQue;
  salida = null;
  const bloqueo = deDondeLeer.leerBloqueo();
  pendienteDePedir = bloqueo.activo;
  estado = {
    ...INICIAL,
    bloqueo,
    privado: deDondeLeer.leerModoPrivado(),
    // Al abrir la app siempre se pide autenticación, sea cual sea la espera.
    bloqueada: bloqueo.activo,
  };
  oyentes.forEach((avisar) => avisar());
}

export function estadoDeSeguridad(): EstadoDeSeguridad {
  return estado;
}

async function pedir(): Promise<{ resultado: ResultadoDeAutenticacion; capacidad: Capacidad }> {
  if (!autenticador) return { resultado: 'no_disponible', capacidad: 'ninguna' };
  const resultado = await autenticador.autenticar(t('seguridad.motivo'), t('comun.cancelar'));
  // La capacidad solo importa cuando no se ha podido autenticar.
  const capacidad = resultado === 'correcto' ? 'biometria' : await autenticador.capacidad();
  return { resultado, capacidad };
}

/** Pide la cara, la huella o el código y, si es correcto, abre la app. */
export async function desbloquear(): Promise<void> {
  if (!estado.bloqueada || estado.autenticando) return;
  pendienteDePedir = false;
  fijar({ autenticando: true, fallo: false });
  let resultado: ResultadoDeAutenticacion = 'fallido';
  let capacidad: Capacidad = 'codigo';
  try {
    ({ resultado, capacidad } = await pedir());
  } catch {
    // Un error inesperado es un no.
  }
  const decision = trasAutenticar(resultado, capacidad);
  if (decision === 'seguir_bloqueada') {
    fijar({ autenticando: false, fallo: resultado !== 'cancelado' });
    return;
  }
  // La hoja del sistema pudo dejar anotada una salida a segundo plano: ya no cuenta.
  salida = null;
  fijar({
    autenticando: false,
    bloqueada: false,
    cubierta: false,
    fallo: false,
    sinProteccion: decision === 'entrar_sin_proteccion',
  });
}

/**
 * Lo que hay que hacer cuando iOS avisa de que la app pasa a segundo plano o
 * vuelve. `ahora` entra como parámetro para poder probarlo.
 */
export function alCambiarElEstadoDeLaApp(nuevo: EstadoDeLaApp, ahora: Instante): void {
  if (nuevo === 'active') {
    const veniaDeFuera = salida !== null;
    const bloquear = tocaBloquear(estado.bloqueo, salida, ahora);
    salida = null;
    if (bloquear && !estado.bloqueada) pendienteDePedir = true;
    fijar({ cubierta: false, bloqueada: estado.bloqueada || bloquear });
    if (estado.bloqueada && (veniaDeFuera || pendienteDePedir)) void desbloquear();
    return;
  }
  if (nuevo !== 'inactive' && nuevo !== 'background') return;
  const cambios: Partial<EstadoDeSeguridad> = {
    // Con el bloqueo activo la app se cubre siempre; sin él, solo en modo privado.
    cubierta: estado.bloqueo.activo || estado.privado,
  };
  if (nuevo === 'background') {
    salida ??= ahora;
    // Sin espera, la app queda bloqueada ya al salir: lo que iOS guarde para el
    // selector de apps es la pantalla de bloqueo.
    if (estado.bloqueo.activo && estado.bloqueo.espera === 'inmediato') {
      cambios.bloqueada = true;
      cambios.fallo = false;
    }
  }
  fijar(cambios);
}

/** Si la app está delante y queda una autenticación por pedir, la pide. */
export function pedirSiHaceFalta(estadoDeLaApp: EstadoDeLaApp): void {
  if (estadoDeLaApp === 'active' && estado.bloqueada && pendienteDePedir) void desbloquear();
}

/** Con qué puede protegerse este iPhone. */
export async function capacidadDelDispositivo(): Promise<Capacidad> {
  if (!autenticador) return 'ninguna';
  try {
    return await autenticador.capacidad();
  } catch {
    return 'ninguna';
  }
}

async function guardarBloqueo(bloqueo: AjustesDeBloqueo): Promise<void> {
  fijar({ bloqueo, sinProteccion: false });
  try {
    await almacen?.guardarBloqueo(bloqueo);
  } catch {
    // Si no se puede guardar, el cambio vale hasta cerrar la app.
  }
}

/**
 * Activa o desactiva el bloqueo. En los dos sentidos pide autenticación
 * antes: al activarlo, para comprobar que la persona puede desbloquear; al
 * desactivarlo, para que no lo quite quien encuentre la app abierta.
 * Devuelve cómo acabó.
 */
export async function cambiarBloqueo(activo: boolean): Promise<ResultadoDeAutenticacion> {
  if (estado.autenticando) return 'cancelado';
  fijar({ autenticando: true });
  let resultado: ResultadoDeAutenticacion = 'fallido';
  let capacidad: Capacidad = 'codigo';
  try {
    ({ resultado, capacidad } = await pedir());
  } catch {
    // Un error inesperado es un no.
  }
  salida = null;
  fijar({ autenticando: false, cubierta: false });
  const decision = trasAutenticar(resultado, capacidad);
  // Sin código ni biometría no se puede activar; sí desactivar, porque ya no protege nada.
  if (decision === 'entrar' || (!activo && decision === 'entrar_sin_proteccion')) {
    await guardarBloqueo({ ...estado.bloqueo, activo });
    return 'correcto';
  }
  return resultado === 'correcto' ? 'fallido' : resultado;
}

/**
 * Pide autenticación antes de una acción delicada (exportar los datos a un
 * fichero). Con el bloqueo desactivado no pide nada y devuelve `true`. No
 * cambia ningún ajuste ni el estado de bloqueo de la app.
 */
export async function autenticarParaAccion(motivo: string): Promise<boolean> {
  if (!estado.bloqueo.activo) return true;
  if (estado.autenticando || !autenticador) return false;
  fijar({ autenticando: true });
  let resultado: ResultadoDeAutenticacion = 'fallido';
  let capacidad: Capacidad = 'codigo';
  try {
    resultado = await autenticador.autenticar(motivo, t('comun.cancelar'));
    capacidad = resultado === 'correcto' ? 'biometria' : await autenticador.capacidad();
  } catch {
    // Un error inesperado es un no.
  }
  // La hoja del sistema pudo dejar anotada una salida a segundo plano: ya no cuenta.
  salida = null;
  fijar({ autenticando: false, cubierta: false });
  // Si el iPhone ya no tiene código ni biometría, el bloqueo no protege nada: se deja pasar,
  // igual que al desbloquear.
  return trasAutenticar(resultado, capacidad) !== 'seguir_bloqueada';
}

/** Cambia el tiempo que la app puede pasar en segundo plano sin volver a pedir autenticación. */
export async function elegirEspera(espera: Espera): Promise<void> {
  await guardarBloqueo({ ...estado.bloqueo, espera });
}

/** Activa o desactiva el modo privado. El widget y los avisos se rehacen al cambiar. */
export async function cambiarModoPrivado(activo: boolean): Promise<void> {
  fijar({ privado: activo });
  try {
    await almacen?.guardarModoPrivado(activo);
  } catch {
    // Si no se puede guardar, el cambio vale hasta cerrar la app.
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

export function useSeguridad(): EstadoDeSeguridad {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}
