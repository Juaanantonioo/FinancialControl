/**
 * Apariencia elegida en Ajustes: seguir al iPhone, siempre claro o siempre
 * oscuro. Aquí están las opciones y cómo se interpreta lo guardado; quien
 * lee y escribe en el dispositivo es `src/lib/almacenDeApariencia.ts`.
 */
export const APARIENCIAS = ['automatico', 'claro', 'oscuro'] as const;
export type Apariencia = (typeof APARIENCIAS)[number];

/** Sin nada guardado, la app sigue al sistema. */
export const APARIENCIA_POR_DEFECTO: Apariencia = 'automatico';

export const CLAVE_DE_APARIENCIA = 'apariencia';

/** Convierte lo guardado en una apariencia válida. Lo vacío o desconocido es «automático». */
export function interpretarApariencia(texto: unknown): Apariencia {
  return typeof texto === 'string' && (APARIENCIAS as readonly string[]).includes(texto)
    ? (texto as Apariencia)
    : APARIENCIA_POR_DEFECTO;
}

/** Lo que guarda y devuelve la elección. `src/estado/apariencia.ts` lo recibe al arrancar. */
export type AlmacenDeApariencia = {
  leer: () => Apariencia;
  guardar: (apariencia: Apariencia) => Promise<void>;
};
