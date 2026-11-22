/**
 * Preferencias de avisos en el navegador: ninguna. La web no programa avisos
 * del sistema, así que no hay nada que activar ni que guardar.
 */
import { SIN_AVISOS, TIPOS_DE_AVISO, type Preferencias } from '@/dominio/avisos';

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
  return { ...SIN_AVISOS };
}

export async function guardarPreferencias(): Promise<void> {
  // Nada que guardar en la web.
}
