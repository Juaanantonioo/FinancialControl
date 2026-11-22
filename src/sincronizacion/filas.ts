/**
 * Cifrado y descifrado de una fila para la sincronización.
 *
 * Aquí no hay criptografía propia: la fila se convierte en un texto JSON y se
 * mete en un sobre con `cifrarTexto` (`src/cripto`). Lo propio es el formato
 * del texto y los datos autenticados, que atan el sobre a su usuario, su tabla
 * y su id. Diseño: `docs/seguridad/diseno-sincronizacion.md`, apartado 3.
 */
import { cifrarTexto, descifrarTexto } from '@/cripto';

import { tablaSincronizada, type FilaLocal } from './tablas';

/** Versión del formato de la fila en claro (el JSON). No es la del sobre. */
export const VERSION_DE_FILA = 1;

/** El texto en claro se rellena hasta un múltiplo de estos bytes, para no delatar su longitud exacta. */
export const BLOQUE_DE_RELLENO = 256;

/** Por qué no se puede usar una fila remota. */
export type MotivoDeRetencion = 'ilegible' | 'no_aplicable';

export class ErrorDeFila extends Error {
  constructor(readonly motivo: MotivoDeRetencion) {
    super('La fila no se puede usar.');
    this.name = 'ErrorDeFila';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `true` si el texto es un UUID en minúsculas, que es lo que admite el servidor como id. */
export function esUuid(texto: unknown): texto is string {
  return typeof texto === 'string' && UUID.test(texto);
}

/**
 * Para qué es el sobre de una fila. Entra en los datos autenticados: el mismo
 * sobre presentado para otro usuario, otra tabla u otro id no se abre.
 */
export function usoDeFila(usuario: string, tabla: string, id: string): string {
  if (!esUuid(usuario) || !esUuid(id) || !tablaSincronizada(tabla)) {
    throw new ErrorDeFila('no_aplicable');
  }
  return `fila/${usuario}/${tabla}/${id}`;
}

/** Bytes que ocupa un texto en UTF-8, sin depender de nada nativo. */
function bytesEnUtf8(texto: string): number {
  let total = 0;
  for (const caracter of texto) {
    const punto = caracter.codePointAt(0)!;
    total += punto < 0x80 ? 1 : punto < 0x800 ? 2 : punto < 0x10000 ? 3 : 4;
  }
  return total;
}

/** El texto en claro de una fila: JSON con todas sus columnas, rellenado con espacios. */
export function textoDeFila(tabla: string, fila: FilaLocal): string {
  const catalogo = tablaSincronizada(tabla);
  if (!catalogo) throw new ErrorDeFila('no_aplicable');
  const f: FilaLocal = {};
  for (const columna of catalogo.columnas) {
    const valor = fila[columna];
    if (valor === undefined) throw new ErrorDeFila('no_aplicable');
    f[columna] = valor;
  }
  const texto = JSON.stringify({ v: VERSION_DE_FILA, f });
  const resto = bytesEnUtf8(texto) % BLOQUE_DE_RELLENO;
  return resto === 0 ? texto : texto + ' '.repeat(BLOQUE_DE_RELLENO - resto);
}

/** Lee el texto en claro de una fila y comprueba que es lo que tiene que ser. */
export function filaDeTexto(tabla: string, id: string, texto: string): FilaLocal {
  const catalogo = tablaSincronizada(tabla);
  if (!catalogo) throw new ErrorDeFila('no_aplicable');
  let leido: unknown;
  try {
    leido = JSON.parse(texto);
  } catch {
    throw new ErrorDeFila('ilegible');
  }
  if (typeof leido !== 'object' || leido === null) throw new ErrorDeFila('ilegible');
  const { v, f } = leido as { v?: unknown; f?: unknown };
  if (typeof v !== 'number') throw new ErrorDeFila('ilegible');
  // Una versión de fila posterior la entenderá una versión posterior de la app.
  if (v !== VERSION_DE_FILA) throw new ErrorDeFila('no_aplicable');
  if (typeof f !== 'object' || f === null || Array.isArray(f)) throw new ErrorDeFila('ilegible');
  const origen = f as Record<string, unknown>;
  if (origen.id !== id) throw new ErrorDeFila('ilegible');
  const nombres = Object.keys(origen);
  if (
    nombres.length !== catalogo.columnas.length ||
    !catalogo.columnas.every((columna) => columna in origen)
  ) {
    // Faltan o sobran columnas: la escribió otra versión de la app.
    throw new ErrorDeFila('no_aplicable');
  }
  const fila: FilaLocal = {};
  for (const columna of catalogo.columnas) {
    const valor = origen[columna];
    const esNumero = typeof valor === 'number' && Number.isSafeInteger(valor);
    if (valor !== null && typeof valor !== 'string' && !esNumero) throw new ErrorDeFila('ilegible');
    fila[columna] = valor as string | number | null;
  }
  return fila;
}

/** Cifra una fila local con la clave de datos. Devuelve el sobre que va al servidor. */
export async function cifrarFila(
  clave: Uint8Array,
  usuario: string,
  tabla: string,
  fila: FilaLocal,
): Promise<string> {
  const uso = usoDeFila(usuario, tabla, String(fila.id));
  return cifrarTexto(clave, textoDeFila(tabla, fila), uso);
}

/**
 * Abre el sobre de una fila remota. Falla con `ErrorDeFila`: «ilegible» si el
 * sobre no se abre o no trae una fila, «no_aplicable» si la trae pero esta
 * versión de la app no sabe aplicarla.
 */
export async function descifrarFila(
  clave: Uint8Array,
  usuario: string,
  tabla: string,
  id: string,
  sobre: string,
): Promise<FilaLocal> {
  const uso = usoDeFila(usuario, tabla, id);
  let texto: string;
  try {
    texto = await descifrarTexto(clave, sobre, uso);
  } catch {
    throw new ErrorDeFila('ilegible');
  }
  return filaDeTexto(tabla, id, texto);
}
