/**
 * Avisos del sistema en el navegador: no hay. La web no pide permiso de
 * notificaciones ni programa nada. Misma interfaz que en iOS, sin efecto.
 */
export type EstadoDelPermiso = 'concedido' | 'denegado' | 'sin_decidir';

export type AvisoParaMostrar = {
  id: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
};

export interface Notificador {
  permiso(): Promise<EstadoDelPermiso>;
  pedirPermiso(): Promise<EstadoDelPermiso>;
  programados(): Promise<string[]>;
  cancelar(id: string): Promise<void>;
  programar(aviso: AvisoParaMostrar, instante: number): Promise<void>;
  mostrar(aviso: AvisoParaMostrar): Promise<void>;
}

export const PREFIJO = 'fc:';

export const notificador: Notificador = {
  permiso: async () => 'denegado',
  pedirPermiso: async () => 'denegado',
  programados: async () => [],
  cancelar: async () => undefined,
  programar: async () => undefined,
  mostrar: async () => undefined,
};

export function mostrarAvisosEnPrimerPlano(): void {
  // Nada que hacer en la web.
}

export function alTocarUnAviso(): () => void {
  return () => undefined;
}
