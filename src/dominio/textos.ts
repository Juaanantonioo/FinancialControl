/**
 * Límites de longitud de los textos libres.
 *
 * Están para que una fila, cifrada para sincronizarse, quepa siempre con margen
 * en lo que admite el servidor (64 KiB de texto por fila). La fila con más
 * texto es un movimiento: nombre, comercio y nota al máximo, y en el peor caso
 * de codificación (6 bytes por carácter), ocupan unos 14 KiB. Una prueba cifra
 * la fila más grande posible de cada tabla y comprueba el margen.
 *
 * Las pantallas ya limitaban lo que se puede teclear (40 a 80 caracteres en los
 * nombres); estos límites son más anchos y se aplican en la capa de datos, que
 * es por donde entra todo: pantallas, capturas y sincronización.
 *
 * Un texto que ya estaba guardado y supera el límite no se trunca: se conserva
 * mientras no se cambie, y la pantalla avisa al editarlo.
 */
import { ErrorDeDominio } from './modelo';

export const LIMITE_DE_TEXTO = {
  /** Nombres: de cuenta, categoría, movimiento, objetivo y regla. */
  nombre: 200,
  /** Comercio de un movimiento. El mismo máximo que el texto de una captura. */
  comercio: 200,
  /** Notas: de movimiento, aportación y presupuesto. */
  nota: 2000,
} as const;

export type ClaseDeTexto = keyof typeof LIMITE_DE_TEXTO;

/** `true` si el texto supera el límite de su clase. Se cuentan unidades UTF-16, como `maxLength`. */
export function superaElLimite(texto: string | null | undefined, clase: ClaseDeTexto): boolean {
  return (texto ?? '').length > LIMITE_DE_TEXTO[clase];
}

/**
 * Rechaza un texto demasiado largo. Si es el mismo que ya estaba guardado
 * (`anterior`), se acepta: lo existente no se trunca ni impide guardar otros
 * cambios de la misma fila.
 */
export function exigirLongitud(
  texto: string | null | undefined,
  clase: ClaseDeTexto,
  anterior?: string | null,
): void {
  if (!superaElLimite(texto, clase)) return;
  if (anterior !== undefined && anterior !== null && texto === anterior) return;
  throw new ErrorDeDominio('texto_demasiado_largo');
}
