/**
 * Catálogo de traducción.
 *
 * Todas las cadenas visibles viven en `es.json`. Las pantallas piden un texto
 * por su clave ("inicio.titulo") con la función `t`. Ninguna cadena visible se
 * escribe directamente en el código.
 *
 * Nota para quien viene de Java o Python: `typeof es` es un tipo que
 * TypeScript deduce del propio fichero JSON. Gracias a él, el compilador
 * rechaza una clave que no exista en el catálogo, igual que rechazaría una
 * constante sin declarar.
 */
import es from './es.json';

type Catalogo = typeof es;

/** Une las claves anidadas con puntos: { a: { b: "x" } } produce "a.b". */
type Claves<T, Prefijo extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefijo}${K}` : Claves<T[K], `${Prefijo}${K}.`>;
}[keyof T & string];

export type ClaveTexto = Claves<Catalogo>;

type Valores = Record<string, string | number>;

function buscar(clave: string): string | undefined {
  let nodo: unknown = es;
  for (const parte of clave.split('.')) {
    if (typeof nodo !== 'object' || nodo === null) return undefined;
    nodo = (nodo as Record<string, unknown>)[parte];
  }
  return typeof nodo === 'string' ? nodo : undefined;
}

/**
 * Devuelve el texto de una clave. Los huecos `{{nombre}}` se sustituyen por
 * los valores recibidos. Si la clave no existe devuelve la propia clave, para
 * que el fallo se vea en pantalla en lugar de quedar en blanco.
 */
export function t(clave: ClaveTexto, valores?: Valores): string {
  const texto = buscar(clave);
  if (texto === undefined) return clave;
  if (!valores) return texto;
  return texto.replace(/\{\{(\w+)\}\}/g, (hueco, nombre: string) =>
    nombre in valores ? String(valores[nombre]) : hueco,
  );
}
