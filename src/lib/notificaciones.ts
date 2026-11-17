/**
 * Capa fina sobre expo-notifications. Solo notificaciones LOCALES: se
 * programan en el propio iPhone y no necesitan servidor ni permiso de push.
 *
 * Todo lo que decide qué avisar y cuándo está en `src/dominio/avisos.ts`.
 * Aquí solo se traduce a llamadas del sistema, detrás de la interfaz
 * `Notificador`, que las pruebas sustituyen por una de mentira.
 */
import * as Notifications from 'expo-notifications';

export type EstadoDelPermiso = 'concedido' | 'denegado' | 'sin_decidir';

export type AvisoParaMostrar = {
  /** Identificador propio del aviso. */
  id: string;
  titulo: string;
  cuerpo: string;
  /** Datos que vuelven a la app cuando se toca el aviso. */
  datos: Record<string, string>;
};

export interface Notificador {
  permiso(): Promise<EstadoDelPermiso>;
  /** Muestra el diálogo del sistema. Solo se llama cuando la persona activa un aviso. */
  pedirPermiso(): Promise<EstadoDelPermiso>;
  /** Identificadores de los avisos de la app que están programados. */
  programados(): Promise<string[]>;
  cancelar(id: string): Promise<void>;
  /** Deja un aviso programado para un instante (milisegundos desde 1970). */
  programar(aviso: AvisoParaMostrar, instante: number): Promise<void>;
  /** Muestra un aviso ahora mismo. */
  mostrar(aviso: AvisoParaMostrar): Promise<void>;
}

/** Prefijo de los avisos que programa la app, para no tocar los de la acción de Atajos. */
export const PREFIJO = 'fc:';

function estado(respuesta: Notifications.NotificationPermissionsStatus): EstadoDelPermiso {
  if (respuesta.granted) return 'concedido';
  return respuesta.canAskAgain ? 'sin_decidir' : 'denegado';
}

function contenido(aviso: AvisoParaMostrar): Notifications.NotificationContentInput {
  return { title: aviso.titulo, body: aviso.cuerpo, data: aviso.datos };
}

export const notificador: Notificador = {
  async permiso() {
    return estado(await Notifications.getPermissionsAsync());
  },
  async pedirPermiso() {
    return estado(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      }),
    );
  },
  async programados() {
    const todos = await Notifications.getAllScheduledNotificationsAsync();
    return todos.map((n) => n.identifier).filter((id) => id.startsWith(PREFIJO));
  },
  async cancelar(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async programar(aviso, instante) {
    await Notifications.scheduleNotificationAsync({
      identifier: aviso.id,
      content: contenido(aviso),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(instante) },
    });
  },
  async mostrar(aviso) {
    // Sin disparador el aviso se entrega de inmediato.
    await Notifications.scheduleNotificationAsync({
      identifier: aviso.id,
      content: contenido(aviso),
      trigger: null,
    });
  },
};

/**
 * Hace que los avisos se vean también con la app abierta. Sin esto, iOS no
 * enseña un aviso que llega mientras la app está en primer plano, y el de
 * presupuesto se dispara justo al anotar un gasto.
 */
export function mostrarAvisosEnPrimerPlano(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Avisa cuando la persona toca un aviso, también si con ese toque se abrió
 * la app. Entrega los datos del aviso. Devuelve cómo dejar de escuchar.
 */
export function alTocarUnAviso(recibir: (datos: Record<string, unknown>) => void): () => void {
  const entregar = (respuesta: Notifications.NotificationResponse | null) => {
    const datos = respuesta?.notification.request.content.data;
    if (datos && typeof datos === 'object') recibir(datos as Record<string, unknown>);
  };
  entregar(Notifications.getLastNotificationResponse());
  const suscripcion = Notifications.addNotificationResponseReceivedListener(entregar);
  return () => suscripcion.remove();
}
