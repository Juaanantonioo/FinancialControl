/**
 * Sistema visual: colores, radios, sombras, tamaños de texto y medidas.
 *
 * Las pantallas nunca usan un color fijo: piden "fondo", "texto" o "negativo"
 * y reciben el valor del modo claro u oscuro según el ajuste del sistema
 * (docs/03, apartados 9 y 11). Todo valor hexadecimal de la app vive en este
 * fichero; `src/theme/__tests__/contraste.test.ts` calcula el contraste de
 * cada pareja que se usa.
 */
import { useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

const claro = {
  /** Fondo de pantalla: claro con un tinte lavanda, no gris plano. */
  fondo: '#F4F3FF',
  /** Tarjetas y filas. */
  superficie: '#FFFFFF',
  /** Relleno suave para pistas, píldoras y teclas pulsadas. */
  superficieSuave: '#ECEAFB',
  texto: '#16152B',
  textoSecundario: '#5A5870',
  borde: '#DDDAF0',
  /** Color de marca. */
  acento: '#4F46E5',
  /** Fondo tenue del color de marca, para elementos elegidos. */
  acentoSuave: '#E7E5FD',
  sobreAcento: '#FFFFFF',
  /** Ingresos y balances a favor. Siempre con signo o etiqueta. */
  positivo: '#0F7553',
  positivoSuave: '#DDF5EA',
  /** Solo balances negativos y errores. No es el color de un gasto normal. */
  negativo: '#C92A2A',
  negativoSuave: '#FCE4E4',
  aviso: '#8A5A00',
  /** Degradado de la cabecera de Inicio. */
  degradadoInicio: '#4F46E5',
  degradadoFin: '#7C3AED',
  sobreDegradado: '#FFFFFF',
  sobreDegradadoSecundario: '#EDEBFF',
  /** Velo translúcido sobre el degradado, para botones y píldoras. */
  veloSobreDegradado: 'rgba(255, 255, 255, 0.18)',
  sombra: '#2B2466',
  transparente: 'transparent',
};

const oscuro: typeof claro = {
  fondo: '#100F1A',
  superficie: '#1C1B29',
  superficieSuave: '#2A2839',
  texto: '#F3F2FA',
  textoSecundario: '#AAA8BF',
  borde: '#383649',
  acento: '#A5B4FC',
  acentoSuave: '#2E2C52',
  sobreAcento: '#100F1A',
  positivo: '#6EE7B7',
  positivoSuave: '#173A30',
  negativo: '#FF9A91',
  negativoSuave: '#47201F',
  aviso: '#F0B755',
  degradadoInicio: '#312E81',
  degradadoFin: '#5B21B6',
  sobreDegradado: '#FFFFFF',
  sobreDegradadoSecundario: '#DDD8FB',
  veloSobreDegradado: 'rgba(255, 255, 255, 0.14)',
  sombra: '#000000',
  transparente: 'transparent',
};

export type Colores = typeof claro;

/**
 * Paleta de categorías: doce colores, con una variante por modo. Cada color
 * cumple contraste 3:1 sobre la superficie de su modo (elemento gráfico,
 * WCAG 1.4.11). El primero coincide con el color de marca.
 */
export const PALETA_DE_CATEGORIAS = {
  claro: [
    '#4F46E5',
    '#0E9F8E',
    '#E8590C',
    '#D6336C',
    '#7C3AED',
    '#1C7ED6',
    '#2F9E44',
    '#C2850C',
    '#E03131',
    '#0C8599',
    '#AE3EC9',
    '#6B7A90',
  ],
  oscuro: [
    '#8B85FF',
    '#2CC5B3',
    '#FF8A4C',
    '#F06595',
    '#A78BFA',
    '#4DABF7',
    '#51CF66',
    '#E0A82E',
    '#FF6B6B',
    '#22B8CF',
    '#CC5DE8',
    '#94A3B8',
  ],
} as const;

/** Posición en la paleta del color neutro, reservado para «Otras» y «Sin categoría». */
export const INDICE_NEUTRO = 11;

export const COLORES = { claro, oscuro };

export type Modo = 'claro' | 'oscuro';

export function useModo(): Modo {
  return useColorScheme() === 'dark' ? 'oscuro' : 'claro';
}

export function useColores(): Colores {
  return COLORES[useModo()];
}

/** Paleta de categorías del modo en uso. */
export function usePaleta(): readonly string[] {
  return PALETA_DE_CATEGORIAS[useModo()];
}

export const Espacio = { xs: 4, s: 8, m: 16, l: 24, xl: 32 } as const;

/** Radios de las esquinas. Las tarjetas usan el grande. */
export const Radio = { s: 10, m: 14, l: 22, circulo: 999 } as const;

/** Tamaños de texto. El sistema los escala con el ajuste de tamaño de letra. */
export const Letra = {
  /** La cifra que importa de la pantalla. */
  cifraGrande: 40,
  /** La cifra principal de una tarjeta. */
  cifra: 28,
  titulo: 30,
  subtitulo: 19,
  cuerpo: 17,
  secundario: 15,
  pequeno: 13,
} as const;

/** Lado mínimo de un área táctil (docs/03, apartado 8). */
export const TactilMinimo = 44;

/** Medidas del botón flotante «+». */
export const Flotante = { lado: 60, separacion: 64 } as const;

/** Cifras de ancho fijo: las columnas de importes quedan alineadas. */
export const cifrasTabulares: TextStyle = { fontVariant: ['tabular-nums'] };

/** Sombra muy suave de las tarjetas. */
export function sombraDeTarjeta(c: Colores): ViewStyle {
  return {
    shadowColor: c.sombra,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };
}

/** Sombra del botón flotante, algo más marcada para que se despegue del fondo. */
export function sombraFlotante(c: Colores): ViewStyle {
  return {
    shadowColor: c.sombra,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  };
}

/** Degradado de la cabecera de Inicio, como estilo de fondo de React Native. */
export function degradado(c: Colores): ViewStyle {
  return {
    backgroundColor: c.degradadoInicio,
    backgroundImage: `linear-gradient(135deg, ${c.degradadoInicio}, ${c.degradadoFin})`,
  };
}
