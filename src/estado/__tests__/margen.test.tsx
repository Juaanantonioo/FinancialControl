import { margenBajoElFlotante } from '@/componentes/basicos';
import { Flotante } from '@/theme';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

describe('margen inferior de las listas', () => {
  // El botón «+» ocupa desde `margen + separación` hasta `margen + separación + lado`
  // medido desde el borde inferior. La última fila debe poder quedar por encima.
  it.each([0, 20, 34, 83, 120])(
    'con un margen seguro de %i puntos la última fila queda por encima del botón',
    (margen) => {
      const bordeSuperiorDelBoton = margen + Flotante.separacion + Flotante.lado;
      expect(margenBajoElFlotante(margen)).toBeGreaterThan(bordeSuperiorDelBoton);
    },
  );
});
