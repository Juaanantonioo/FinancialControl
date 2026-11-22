/**
 * Marcas de tiempo del servidor (`actualizada_en`).
 *
 * Llegan como texto con microsegundos («2026-11-22T10:15:30.123456+00:00») y
 * así se guardan y se reenvían: una fecha de JavaScript solo tiene
 * milisegundos, y redondear una marca haría que dos filas distintas
 * parecieran simultáneas o que el cursor se saltara una.
 */

const FORMA =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

type Partes = { segundos: number; micros: number };

function partes(marca: string): Partes | null {
  const m = FORMA.exec(marca);
  if (!m) return null;
  let zona = m[4];
  if (zona !== 'Z') {
    const digitos = zona.slice(1).replace(':', '');
    zona = `${zona[0]}${digitos.slice(0, 2)}:${digitos.slice(2, 4) || '00'}`;
  }
  const milisegundos = Date.parse(`${m[1]}T${m[2]}${zona}`);
  if (Number.isNaN(milisegundos)) return null;
  return { segundos: milisegundos / 1000, micros: Number((m[3] ?? '').padEnd(6, '0')) };
}

/** `true` si el texto tiene la forma de una marca de tiempo del servidor. */
export function esMarca(texto: unknown): texto is string {
  return typeof texto === 'string' && partes(texto) !== null;
}

/**
 * Compara dos marcas: negativo si `a` es anterior, cero si son el mismo
 * instante, positivo si es posterior. Una marca que no se entiende va antes
 * que cualquier otra.
 */
export function compararMarcas(a: string, b: string): number {
  const x = partes(a);
  const y = partes(b);
  if (!x || !y) return (x ? 1 : 0) - (y ? 1 : 0);
  return x.segundos !== y.segundos ? x.segundos - y.segundos : x.micros - y.micros;
}

/** La mayor de dos marcas; `null` cuenta como «ninguna». */
export function marcaMayor(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return compararMarcas(a, b) >= 0 ? a : b;
}

/**
 * El instante `milisegundos` antes de una marca, para pedir con solape. Se
 * redondea hacia atrás al milisegundo: solo agranda la ventana.
 */
export function restarAMarca(marca: string, milisegundos: number): string | null {
  const p = partes(marca);
  if (!p) return null;
  return new Date(p.segundos * 1000 + Math.floor(p.micros / 1000) - milisegundos).toISOString();
}
