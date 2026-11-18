/**
 * Pruebas del apartado «Apariencia» de Ajustes y de cómo se aplica la
 * elección: al instante, guardada para la próxima vez y leída al arrancar.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Appearance, Text } from 'react-native';

import Ajustes, { ACCESOS_DE_AJUSTES } from '@/app/ajustes';
import { elegirApariencia, iniciarApariencia, useApariencia } from '@/estado/apariencia';
import type { AlmacenDeApariencia, Apariencia } from '@/lib/apariencia';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

/** Almacén en memoria, con lo que haría el de verdad. */
function almacenCon(inicial: Apariencia): AlmacenDeApariencia & { guardado: Apariencia } {
  const almacen = {
    guardado: inicial,
    leer: () => almacen.guardado,
    guardar: jest.fn(async (apariencia: Apariencia) => {
      almacen.guardado = apariencia;
    }),
  };
  return almacen;
}

let aplicar: jest.SpyInstance;

beforeEach(() => {
  aplicar = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  iniciarApariencia(almacenCon('automatico'));
  aplicar.mockClear();
});

afterEach(() => {
  aplicar.mockRestore();
});

const elegido = (valor: Apariencia) =>
  screen.getByTestId(`segmento-${valor}`).props.accessibilityState?.selected === true;

describe('apartado Apariencia de Ajustes', () => {
  it('es el primero de la pantalla y ofrece Automático, Claro y Oscuro', async () => {
    await render(<Ajustes />);
    const apartado = screen.getByTestId('ajuste-apariencia');
    expect(apartado).toHaveTextContent(/Apariencia/);
    expect(screen.getByTestId('segmento-automatico')).toHaveTextContent('Automático');
    expect(screen.getByTestId('segmento-claro')).toHaveTextContent('Claro');
    expect(screen.getByTestId('segmento-oscuro')).toHaveTextContent('Oscuro');
    // Va antes que cualquier otro acceso de la pantalla.
    const orden = screen.getAllByTestId(/^ajuste-/).map((nodo) => nodo.props.testID as string);
    expect(orden[0]).toBe('ajuste-apariencia');
    expect(orden.slice(1)).toEqual(ACCESOS_DE_AJUSTES.map((a) => a.testID));
  });

  it('sin nada guardado, «Automático» está elegido y lo dice el lector de pantalla', async () => {
    await render(<Ajustes />);
    for (const valor of ['automatico', 'claro', 'oscuro'] as const) {
      const segmento = screen.getByTestId(`segmento-${valor}`);
      expect(segmento.props.accessibilityRole).toBe('tab');
      expect(segmento.props.accessibilityState).toEqual({ selected: valor === 'automatico' });
    }
    expect(screen.getByTestId('ayuda-de-apariencia')).toHaveTextContent(/Sigue al modo/);
  });

  it.each([
    ['oscuro', 'dark', /Siempre en modo oscuro/],
    ['claro', 'light', /Siempre en modo claro/],
  ] as const)(
    'elegir «%s» cambia la app al instante y lo guarda',
    async (valor, esquema, ayuda) => {
      const almacen = almacenCon('automatico');
      iniciarApariencia(almacen);
      await render(<Ajustes />);
      await fireEvent.press(screen.getByTestId(`segmento-${valor}`));
      expect(aplicar).toHaveBeenCalledTimes(1);
      expect(aplicar).toHaveBeenCalledWith(esquema);
      await waitFor(() => expect(elegido(valor)).toBe(true));
      expect(elegido('automatico')).toBe(false);
      expect(screen.getByTestId('ayuda-de-apariencia')).toHaveTextContent(ayuda);
      expect(almacen.guardar).toHaveBeenCalledWith(valor);
      expect(almacen.guardado).toBe(valor);
    },
  );

  it('«Automático» se puede recuperar: quita la elección y vuelve a seguir al sistema', async () => {
    const almacen = almacenCon('oscuro');
    iniciarApariencia(almacen);
    aplicar.mockClear();
    await render(<Ajustes />);
    expect(elegido('oscuro')).toBe(true);
    await fireEvent.press(screen.getByTestId('segmento-automatico'));
    // 'auto' es el valor que React Native 0.88 documenta para quitar la elección de la app.
    expect(aplicar).toHaveBeenCalledWith('auto');
    await waitFor(() => expect(elegido('automatico')).toBe(true));
    expect(almacen.guardado).toBe('automatico');
  });

  it('si no se puede guardar, la elección se aplica igual y no falla', async () => {
    iniciarApariencia({
      leer: () => 'automatico',
      guardar: async () => {
        throw new Error('disco lleno');
      },
    });
    await render(<Ajustes />);
    await fireEvent.press(screen.getByTestId('segmento-oscuro'));
    expect(aplicar).toHaveBeenCalledWith('dark');
    await waitFor(() => expect(elegido('oscuro')).toBe(true));
  });
});

describe('al arrancar la app', () => {
  it.each([
    ['oscuro', 'dark'],
    ['claro', 'light'],
  ] as const)('con «%s» guardado lo aplica antes de pintar nada', (guardada, esquema) => {
    iniciarApariencia(almacenCon(guardada));
    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(aplicar).toHaveBeenCalledWith(esquema);
  });

  it('con «Automático» no toca nada: la app ya sigue al sistema', () => {
    iniciarApariencia(almacenCon('automatico'));
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('la elección sobrevive a cerrar y abrir: lo que se eligió es lo que se lee al volver', async () => {
    const almacen = almacenCon('automatico');
    iniciarApariencia(almacen);
    await elegirApariencia('oscuro');
    // «Abrir de nuevo»: mismo almacén, estado en memoria desde cero.
    aplicar.mockClear();
    iniciarApariencia(almacen);
    expect(aplicar).toHaveBeenCalledWith('dark');
    function Elegida() {
      return <Text testID="elegida">{useApariencia()}</Text>;
    }
    await render(<Elegida />);
    expect(screen.getByTestId('elegida')).toHaveTextContent('oscuro');
  });
});
