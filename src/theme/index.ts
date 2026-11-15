/**
 * Colores semánticos y medidas comunes.
 *
 * Las pantallas nunca usan un color fijo: piden "fondo", "texto" o "negativo"
 * y reciben el valor del modo claro u oscuro según el ajuste del sistema
 * (docs/03, apartado 9).
 */
import { useColorScheme } from 'react-native';

const claro = {
  fondo: '#F2F2F7',
  superficie: '#FFFFFF',
  texto: '#111111',
  textoSecundario: '#5B5F66',
  borde: '#D8D8DE',
  acento: '#0A5FD8',
  sobreAcento: '#FFFFFF',
  positivo: '#17753B',
  negativo: '#B3261E',
  aviso: '#8A5A00',
};

const oscuro: typeof claro = {
  fondo: '#0E0E10',
  superficie: '#1C1C1F',
  texto: '#F2F2F3',
  textoSecundario: '#A9ADB5',
  borde: '#34343A',
  acento: '#6CA8FF',
  sobreAcento: '#0E0E10',
  positivo: '#63D08A',
  negativo: '#FF8A80',
  aviso: '#F0B755',
};

export type Colores = typeof claro;

export function useColores(): Colores {
  return useColorScheme() === 'dark' ? oscuro : claro;
}

export const Espacio = { xs: 4, s: 8, m: 16, l: 24, xl: 32 } as const;

/** Lado mínimo de un área táctil (docs/03, apartado 8). */
export const TactilMinimo = 44;
