/**
 * Preferencias de seguridad: el bloqueo de la app y el modo privado. No
 * importa nada nativo: el almacén real está en `almacenDeSeguridad.ts`.
 */
import type { AjustesDeBloqueo } from '@/dominio/bloqueo';

/** Clave del bloqueo en el almacén de clave y valor de la app. */
export const CLAVE_DE_BLOQUEO = 'bloqueo';

/**
 * Clave del modo privado en las preferencias del sistema (`UserDefaults`).
 * La lee también el código Swift del aviso de captura
 * (`app-intents/CapturaEnBruto.swift`): el nombre debe ser el mismo.
 */
export const CLAVE_DE_MODO_PRIVADO = 'modoPrivado';

/** Solo un `true` guardado activa el modo privado. Cualquier otra cosa lo deja desactivado. */
export function interpretarModoPrivado(valor: unknown): boolean {
  return valor === true || valor === 1;
}

export type AlmacenDeSeguridad = {
  /** Lectura inmediata: se usa al arrancar, antes de pintar nada. */
  leerBloqueo(): AjustesDeBloqueo;
  guardarBloqueo(ajustes: AjustesDeBloqueo): Promise<void>;
  leerModoPrivado(): boolean;
  guardarModoPrivado(activo: boolean): Promise<void>;
};
