/**
 * Aspecto de una categoría: su color y su icono.
 *
 * La base de datos permite guardar `color` e `icono`, pero hoy ninguna
 * pantalla los edita y están vacíos. Cuando faltan se deriva aquí un valor
 * estable, en la capa de presentación: no se escribe nada en la base de datos.
 */
import { normalizarNombre, type Categoria } from '@/dominio/modelo';
import { OTRAS, SIN_CATEGORIA } from '@/dominio/resumen';
import { INDICE_NEUTRO, PALETA_DE_CATEGORIAS } from '@/theme';

type CategoriaConAspecto = Pick<Categoria, 'id' | 'nombre' | 'tipo' | 'icono' | 'color' | 'orden'>;

export type Aspecto = {
  color: string;
  /** Emoji, o la inicial del nombre si no se reconoce la categoría. */
  icono: string;
  /** `true` si el icono es una letra: se pinta sobre el color liso. */
  esLetra: boolean;
};

/** Palabras del nombre que deciden el icono. Se comparan sin acentos ni mayúsculas. */
const ICONOS: [string[], string][] = [
  [['comida', 'super', 'restaurante', 'mercado', 'alimenta'], '🍽️'],
  [['casa', 'hogar', 'alquiler', 'hipoteca', 'vivienda'], '🏠'],
  [['transporte', 'coche', 'gasolina', 'tren', 'metro', 'bus'], '🚌'],
  [['ocio', 'cine', 'viaje', 'vacaciones'], '🎬'],
  [['salud', 'farmacia', 'medic', 'gimnasio', 'deporte'], '💊'],
  [['compra', 'ropa', 'tienda'], '🛍️'],
  [['nomina', 'sueldo', 'salario', 'trabajo'], '💼'],
  [['mascota', 'animal'], '🐾'],
  [['regalo'], '🎁'],
  [['suscrip', 'telefono', 'internet'], '📱'],
  [['ahorro', 'inversion'], '🌱'],
  [['ingreso', 'venta'], '💰'],
  [['otro', 'vario'], '📦'],
];

/** Inicial en mayúscula, o un punto si el nombre no tiene letras. */
export function inicial(nombre: string): string {
  const letra = [...nombre.trim()][0];
  return letra ? letra.toLocaleUpperCase() : '·';
}

export function iconoDe(nombre: string): { icono: string; esLetra: boolean } {
  const normalizado = normalizarNombre(nombre);
  for (const [palabras, icono] of ICONOS) {
    if (palabras.some((p) => normalizado.includes(p))) return { icono, esLetra: false };
  }
  return { icono: inicial(nombre), esLetra: true };
}

/** `true` si el texto es un color "#RRGGBB". */
function esColor(texto: string | null): texto is string {
  return texto !== null && /^#[0-9a-f]{6}$/i.test(texto);
}

/**
 * Posición en la paleta de una categoría sin color propio. Sale de su orden
 * dentro de su tipo, así dos categorías vecinas nunca comparten color. Las de
 * ingreso empiezan desplazadas para no repetir los primeros colores de gasto.
 * El último color de la paleta, el neutro, no se reparte.
 */
export function indiceDeColor(categoria: Pick<Categoria, 'tipo' | 'orden'>): number {
  const desplazamiento = categoria.tipo === 'ingreso' ? 6 : 0;
  const orden = Number.isInteger(categoria.orden) && categoria.orden >= 0 ? categoria.orden : 0;
  return (orden + desplazamiento) % INDICE_NEUTRO;
}

/**
 * Color que la persona eligió para una categoría. Se guarda el color del
 * modo claro; aquí se devuelve su pareja del modo en uso, para que también
 * cumpla contraste en oscuro. Un color que no es de la paleta se respeta.
 */
export function colorGuardado(color: string | null, paleta: readonly string[]): string | null {
  if (!esColor(color)) return null;
  const indice = PALETA_DE_CATEGORIAS.claro.findIndex(
    (c) => c.toUpperCase() === color.toUpperCase(),
  );
  return indice >= 0 ? paleta[indice] : color;
}

/** Iconos que se ofrecen al elegir el de una categoría. */
export const ICONOS_DISPONIBLES = [
  '🍽️',
  '🛒',
  '🏠',
  '💡',
  '🚌',
  '🚗',
  '⛽',
  '🎬',
  '🎮',
  '✈️',
  '💊',
  '🏋️',
  '🛍️',
  '👕',
  '📱',
  '💼',
  '💰',
  '🎁',
  '🐾',
  '📚',
  '👶',
  '☕',
  '🌱',
  '📦',
] as const;

export function aspectoDeCategoria(
  categoria: CategoriaConAspecto,
  paleta: readonly string[],
): Aspecto {
  const color = colorGuardado(categoria.color, paleta) ?? paleta[indiceDeColor(categoria)];
  if (categoria.icono && categoria.icono.trim() !== '') {
    return { color, icono: categoria.icono.trim(), esLetra: false };
  }
  return { color, ...iconoDe(categoria.nombre) };
}

/**
 * Aspecto de una parte del gasto: una categoría, «Otras» o «Sin categoría».
 * Las dos últimas, y una categoría que ya no exista, usan el color neutro.
 */
export function aspectoDeParte(
  clave: string,
  categorias: CategoriaConAspecto[],
  paleta: readonly string[],
): Aspecto {
  const categoria = categorias.find((c) => c.id === clave);
  if (categoria) return aspectoDeCategoria(categoria, paleta);
  const neutro = paleta[INDICE_NEUTRO];
  if (clave === OTRAS) return { color: neutro, icono: '⋯', esLetra: true };
  if (clave === SIN_CATEGORIA) return { color: neutro, icono: '?', esLetra: true };
  return { color: neutro, icono: '·', esLetra: true };
}

/** Aspecto de la fila de un movimiento: el de su categoría o, si no tiene, el de su tipo. */
export function aspectoDeMovimiento(
  mov: { tipo: string; categoriaId: string | null },
  categorias: CategoriaConAspecto[],
  paleta: readonly string[],
): Aspecto {
  if (mov.tipo === 'transferencia') return { color: paleta[5], icono: '⇄', esLetra: true };
  if (mov.tipo === 'ajuste') return { color: paleta[INDICE_NEUTRO], icono: '±', esLetra: true };
  return aspectoDeParte(mov.categoriaId ?? SIN_CATEGORIA, categorias, paleta);
}
