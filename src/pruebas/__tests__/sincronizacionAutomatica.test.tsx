/**
 * Regresión: sin cuenta, la app no hace nada nuevo al arrancar. Ni comprueba
 * la biblioteca de cifrado, ni abre la base para sincronizar, ni toca la red.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { cuenta } from '@/estado/cuentaDeLaApp';
import { sincronizacion, useSincronizacionAutomatica } from '@/estado/sincronizacionDeLaApp';

const mockLlavero = new Map<string, string>();
jest.mock('@/lib/almacenSeguroNativo', () => ({
  almacenSeguro: {
    leer: jest.fn(async (clave: string) => mockLlavero.get(clave) ?? null),
    guardar: jest.fn(async (clave: string, valor: string) => void mockLlavero.set(clave, valor)),
    borrar: jest.fn(async (clave: string) => void mockLlavero.delete(clave)),
  },
}));
const mockObtenerSupabase = jest.fn(() => null);
jest.mock('@/lib/supabase', () => ({ obtenerSupabase: () => mockObtenerSupabase() }));
const mockBaseDeDatos = jest.fn();
jest.mock('@/estado/Datos', () => ({
  alCambiarDatosLocales: () => () => undefined,
  baseDeDatosDeLaApp: () => mockBaseDeDatos(),
  categoriasIniciales: () => [],
  refrescarDatos: jest.fn(),
}));

describe('sincronización automática sin cuenta', () => {
  it('sin clave en el llavero no se comprueba la cuenta ni se abre nada', async () => {
    const iniciar = jest.spyOn(cuenta(), 'iniciar');
    const pedir = jest.spyOn(sincronizacion(), 'pedir');
    const { almacenSeguro } = jest.requireMock('@/lib/almacenSeguroNativo');
    await renderHook(() => useSincronizacionAutomatica());
    await waitFor(() => expect(almacenSeguro.leer).toHaveBeenCalledTimes(1));
    await new Promise((seguir) => setTimeout(seguir, 20));
    expect(iniciar).not.toHaveBeenCalled();
    expect(pedir).not.toHaveBeenCalled();
    expect(mockBaseDeDatos).not.toHaveBeenCalled();
    expect(sincronizacion().estado()).toMatchObject({ fase: 'inactiva', trabajando: false });
    // Lo único que se ha leído del llavero es si hay una clave. Nada escrito ni borrado.
    expect(almacenSeguro.guardar).not.toHaveBeenCalled();
    expect(almacenSeguro.borrar).not.toHaveBeenCalled();
  });

  it('un cambio local sin sesión no programa ninguna sincronización', async () => {
    const temporizadores = jest.spyOn(global, 'setTimeout');
    const antes = temporizadores.mock.calls.length;
    await sincronizacion().pedir('cambio');
    await sincronizacion().pedir('primer_plano');
    expect(temporizadores.mock.calls.length).toBe(antes);
    expect(mockBaseDeDatos).not.toHaveBeenCalled();
    temporizadores.mockRestore();
  });
});
