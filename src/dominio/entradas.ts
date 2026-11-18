/**
 * Validación de lo que entra en la app desde fuera: parámetros de ruta
 * (enlaces `financialcontrol://`, avisos, widget) y textos de las acciones
 * de Atajos.
 *
 * Regla general: lo que no tiene la forma esperada se ignora y la pantalla
 * abre su estado por defecto. Nada de aquí lanza errores ni toca datos.
 */
import { esFechaValida } from './modelo';
import { esMesValido } from './resumen';

/** Longitud máxima de un parámetro de ruta. Lo más largo que se espera es un UUID (36). */
export const LONGITUD_MAXIMA_DE_PARAMETRO = 200;

/**
 * Identificador con forma válida que no corresponde a ningún dato. Sustituye
 * a un identificador malformado, para que la pantalla muestre su «No
 * encontrado» sin llevar a la base de datos un texto llegado de fuera.
 */
export const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Identificador de una entrada de la cola de Atajos: un UUID, o «prueba-» y un UUID. */
const ID_DE_COLA = /^[A-Za-z0-9-]{1,80}$/;
const MARCA = /^[A-Za-z0-9-]{1,40}$/;
const NUMERO_ESCRITO = /^[0-9][0-9.,\s]{0,19}$/;

/**
 * Caracteres de control (C0, DEL y C1), separadores de línea y de párrafo, y
 * marcas invisibles de dirección del texto, que permiten disfrazar lo escrito.
 */
const DE_CONTROL =
  /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Deja un texto de fuera listo para guardarse o mostrarse: sin caracteres de
 * control (cada uno pasa a ser un espacio), sin espacios repetidos ni en los
 * extremos, y recortado a `maximo` caracteres sin partir un emoji.
 */
export function limpiarTextoExterno(valor: unknown, maximo: number): string {
  if (typeof valor !== 'string') return '';
  // Se acota antes de limpiar para no recorrer un texto desmesurado.
  const acotado = valor.slice(0, maximo * 8);
  const limpio = acotado.replace(DE_CONTROL, ' ').replace(/\s+/g, ' ').trim();
  return [...limpio].slice(0, Math.max(0, maximo)).join('').trim();
}

/**
 * El valor de un parámetro de ruta como texto, o `null` si falta, está
 * vacío, es demasiado largo o viene repetido en la URL (entonces llega como
 * lista y no se sabe cuál de los dos valores se quería).
 */
export function textoDeParametro(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  if (valor.length === 0 || valor.length > LONGITUD_MAXIMA_DE_PARAMETRO) return null;
  return valor;
}

/** `true` si el texto tiene forma de identificador de la app (UUID). */
export function esId(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor);
}

/**
 * Clases de parámetro:
 * - `id`: identificador de lo que la pantalla abre. Si falta o está vacío,
 *   `null`. Si está malformado, `ID_INEXISTENTE`: la pantalla dirá que no
 *   existe, en lugar de abrir otra cosa.
 * - `idOpcional`: identificador que solo ajusta la pantalla (un filtro, un
 *   valor que viene elegido). Malformado se ignora: `null`.
 * - `cola`: identificador de una entrada de la cola de Atajos.
 * - `mes` «AAAA-MM», `dia` «AAAA-MM-DD», `anio` entre 2000 y 2100 (número).
 * - `marca`: marca de petición; solo sirve para distinguir dos peticiones.
 * - `numero`: una cantidad escrita, como «12,50».
 * - `{ lista }`: uno de los valores de la lista.
 * - `{ texto }`: texto libre limpio, de esa longitud como mucho.
 */
export type ReglaDeParametro =
  | 'id'
  | 'idOpcional'
  | 'cola'
  | 'mes'
  | 'dia'
  | 'anio'
  | 'marca'
  | 'numero'
  | { lista: readonly string[] }
  | { texto: number };

type ValorDe<R> = R extends { lista: readonly (infer V)[] }
  ? V | null
  : R extends 'anio'
    ? number | null
    : string | null;

export type ParametrosLeidos<E> = { [K in keyof E]: ValorDe<E[K]> };

function leerUno(valor: unknown, regla: ReglaDeParametro): string | number | null {
  if (typeof regla === 'object' && 'texto' in regla) {
    // El texto libre se acota al limpiarlo; un valor repetido se ignora igualmente.
    return typeof valor === 'string' ? limpiarTextoExterno(valor, regla.texto) || null : null;
  }
  const texto = textoDeParametro(valor);
  if (typeof regla === 'object')
    return texto !== null && regla.lista.includes(texto) ? texto : null;
  switch (regla) {
    case 'id':
      // Un valor repetido o desmesurado también es un identificador malformado.
      if (valor === undefined || valor === null || valor === '') return null;
      return esId(texto) ? texto : ID_INEXISTENTE;
    case 'idOpcional':
      return esId(texto) ? texto : null;
    case 'cola':
      return texto !== null && ID_DE_COLA.test(texto) ? texto : null;
    case 'mes':
      return texto !== null && esMesValido(texto) ? texto : null;
    case 'dia':
      return texto !== null && esFechaValida(texto) ? texto : null;
    case 'anio': {
      if (texto === null || !/^\d{4}$/.test(texto)) return null;
      const anio = Number(texto);
      return anio >= 2000 && anio <= 2100 ? anio : null;
    }
    case 'marca':
      return texto !== null && MARCA.test(texto) ? texto : null;
    case 'numero':
      return texto !== null && NUMERO_ESCRITO.test(texto) ? texto : null;
  }
}

/**
 * Lee los parámetros de ruta de una pantalla según su esquema. Devuelve una
 * clave por cada una del esquema, siempre: el valor validado o `null`. Lo
 * que no esté en el esquema no se devuelve.
 */
export function leerParametros<const E extends Record<string, ReglaDeParametro>>(
  pedido: unknown,
  esquema: E,
): ParametrosLeidos<E> {
  const origen =
    typeof pedido === 'object' && pedido !== null ? (pedido as Record<string, unknown>) : {};
  const leidos: Record<string, string | number | null> = {};
  for (const clave of Object.keys(esquema)) {
    // Solo propiedades propias: `constructor` o `__proto__` no son parámetros.
    const valor = Object.prototype.hasOwnProperty.call(origen, clave) ? origen[clave] : undefined;
    leidos[clave] = leerUno(valor, esquema[clave]);
  }
  return leidos as ParametrosLeidos<E>;
}

/** Rutas a las que puede llevar un aviso de la app al tocarlo. */
export const RUTAS_DE_AVISO = ['/cobro', '/plan', '/capturas', '/detalle-de-cuenta'] as const;

export function esRutaDeAviso(ruta: unknown): ruta is (typeof RUTAS_DE_AVISO)[number] {
  return typeof ruta === 'string' && (RUTAS_DE_AVISO as readonly string[]).includes(ruta);
}
