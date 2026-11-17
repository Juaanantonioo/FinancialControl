/**
 * Preferencias de la app que no son datos financieros: hoy, qué avisos están
 * activados. Se guardan en el almacén de clave y valor de expo-sqlite, en el
 * propio dispositivo.
 */
import Storage from 'expo-sqlite/kv-store';

import { SIN_AVISOS, TIPOS_DE_AVISO, type Preferencias } from '@/dominio/avisos';

const CLAVE = 'avisos';

/** Convierte lo guardado en preferencias válidas. Lo que falte o no se entienda queda desactivado. */
export function interpretarPreferencias(texto: string | null): Preferencias {
  const preferencias = { ...SIN_AVISOS };
  if (!texto) return preferencias;
  try {
    const guardado: unknown = JSON.parse(texto);
    if (typeof guardado !== 'object' || guardado === null) return preferencias;
    for (const tipo of TIPOS_DE_AVISO) {
      preferencias[tipo] = (guardado as Record<string, unknown>)[tipo] === true;
    }
  } catch {
    // Un valor estropeado equivale a no tener nada activado.
  }
  return preferencias;
}

export async function leerPreferencias(): Promise<Preferencias> {
  return interpretarPreferencias(await Storage.getItemAsync(CLAVE));
}

export async function guardarPreferencias(preferencias: Preferencias): Promise<void> {
  await Storage.setItemAsync(CLAVE, JSON.stringify(preferencias));
}
