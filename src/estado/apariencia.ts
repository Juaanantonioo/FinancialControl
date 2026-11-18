/**
 * Apariencia de la app: automática (sigue al iPhone), clara u oscura.
 *
 * La elección se aplica con la API de apariencia de React Native, que cambia
 * el estilo de toda la app a la vez: pantallas, barra de pestañas nativa,
 * hojas modales, teclado y barra de estado. `useColorScheme()` y, con él,
 * `useColores()` reciben el cambio, así que ninguna pantalla necesita saber
 * que existe este ajuste.
 */
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import type { AlmacenDeApariencia, Apariencia } from '@/lib/apariencia';

/**
 * Valor que entiende `Appearance.setColorScheme`. `'auto'` quita la
 * elección de la app y vuelve a seguir al sistema (documentación de React
 * Native 0.88, «App-level overriding»).
 */
const ESQUEMA = { automatico: 'auto', claro: 'light', oscuro: 'dark' } as const;

let elegida: Apariencia = 'automatico';
let almacen: AlmacenDeApariencia | null = null;
const oyentes = new Set<() => void>();

function fijar(apariencia: Apariencia) {
  elegida = apariencia;
  oyentes.forEach((avisar) => avisar());
}

/**
 * Lee la elección guardada y la aplica. Se llama una vez, al cargar la raíz
 * de la app y antes de pintar nada, para que no haya un destello del tema
 * contrario. Con «automático» no hace falta tocar nada: es lo que hace iOS.
 */
export function iniciarApariencia(deDondeLeer: AlmacenDeApariencia): void {
  almacen = deDondeLeer;
  const guardada = deDondeLeer.leer();
  if (guardada !== 'automatico') Appearance.setColorScheme(ESQUEMA[guardada]);
  fijar(guardada);
}

/** Cambia la apariencia al instante y la guarda para la próxima vez. */
export async function elegirApariencia(apariencia: Apariencia): Promise<void> {
  Appearance.setColorScheme(ESQUEMA[apariencia]);
  fijar(apariencia);
  try {
    await almacen?.guardar(apariencia);
  } catch {
    // Si no se puede guardar, la elección vale hasta cerrar la app.
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/** La opción elegida en Ajustes (no el tema que se ve: «automático» puede ser claro u oscuro). */
export function useApariencia(): Apariencia {
  return useSyncExternalStore(
    suscribir,
    () => elegida,
    () => elegida,
  );
}
