/**
 * Ajustes › Exportar mis datos: aviso de que no va cifrado, autenticación si el
 * bloqueo está activo, y un mensaje para cada resultado. Exportador de verdad,
 * con la base en memoria y una hoja de compartir de mentira.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Ajustes from '@/app/ajustes';
import Exportar from '@/app/exportar';
import { FORMATO_ES } from '@/dominio/dinero';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { autenticarParaAccion, estadoDeSeguridad, iniciarSeguridad } from '@/estado/seguridad';
import { crearExportador, type Exportador } from '@/exportacion/exportador';
import { leerExportacion } from '@/exportacion/exportacion';
import es from '@/i18n/es.json';
import { prepararPrueba } from '@/pruebas/bdDePrueba';
import { INICIALES, sembrarTodo, type Dispositivo } from '@/pruebas/sincronizacionDePrueba';
import type { ResultadoDeCompartir } from '@/lib/compartirFichero';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/lib/almacenDeApariencia', () => ({
  almacenDeApariencia: { leer: () => 'automatico', guardar: jest.fn() },
}));
let mockExportador: Exportador;
jest.mock('@/estado/exportacionDeLaApp', () => ({ exportacion: () => mockExportador }));

let entregados: { nombre: string; contenido: string }[];
let respuestaDeLaHoja: ResultadoDeCompartir;
const autenticar = jest.fn();

async function montar(bloqueo: boolean, respuesta: 'correcto' | 'cancelado' = 'correcto') {
  autenticar.mockReset().mockResolvedValue(respuesta);
  iniciarSeguridad(
    {
      leerBloqueo: () => ({ activo: bloqueo, espera: 'inmediato' }),
      guardarBloqueo: async () => undefined,
      leerModoPrivado: () => false,
      guardarModoPrivado: async () => undefined,
    },
    { capacidad: async () => 'biometria', autenticar },
  );
  const d = await prepararPrueba(INICIALES);
  await sembrarTodo(d as unknown as Dispositivo);
  entregados = [];
  respuestaDeLaHoja = 'compartido';
  mockExportador = crearExportador({
    bd: async () => d.bd,
    compartir: async (nombre, contenido) => {
      entregados.push({ nombre, contenido });
      return respuestaDeLaHoja;
    },
    autenticar: () => autenticarParaAccion(es.exportar.motivo),
    ahora: () => new Date(2026, 10, 22, 19, 30),
    textosDelCsv: () => ({
      columnas: {
        fecha: es.exportar.csvFecha,
        tipo: es.exportar.csvTipo,
        importe: es.exportar.csvImporte,
        divisa: es.exportar.csvDivisa,
        cuenta: es.exportar.csvCuenta,
        cuentaDestino: es.exportar.csvCuentaDestino,
        categoria: es.exportar.csvCategoria,
        nombre: es.exportar.csvNombre,
        comercio: es.exportar.csvComercio,
        nota: es.exportar.csvNota,
      },
      tipos: es.tipoDeMovimiento,
    }),
    formato: () => FORMATO_ES,
  });
  await render(
    <ProveedorDeAvisos>
      <Exportar />
    </ProveedorDeAvisos>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('Ajustes', () => {
  it('tiene la entrada «Exportar mis datos», que abre su pantalla', async () => {
    iniciarSeguridad(
      {
        leerBloqueo: () => ({ activo: false, espera: 'inmediato' }),
        guardarBloqueo: async () => undefined,
        leerModoPrivado: () => false,
        guardarModoPrivado: async () => undefined,
      },
      { capacidad: async () => 'biometria', autenticar },
    );
    await render(<Ajustes />);
    expect(screen.getByTestId('abrir-exportar')).toHaveTextContent(/Exportar mis datos/);
    await fireEvent.press(screen.getByTestId('abrir-exportar'));
    expect(router.push).toHaveBeenCalledWith('/exportar');
  });
});

describe('Exportar mis datos', () => {
  it('avisa de que el fichero no va cifrado antes de exportar nada', async () => {
    await montar(false);
    const aviso = screen.getByTestId('aviso-sin-cifrar');
    expect(aviso).toHaveTextContent(/El fichero no va cifrado/);
    expect(aviso).toHaveTextContent(/Cualquiera que lo abra puede leer/);
    expect(screen.getByTestId('exportar-explicacion')).toHaveTextContent(/con cuenta y sin ella/);
    expect(entregados).toEqual([]);
  });

  it('sin bloqueo exporta sin pedir nada: el JSON con todo y el CSV de movimientos', async () => {
    await montar(false);
    await fireEvent.press(screen.getByTestId('exportar-todo'));
    expect(await screen.findByText(es.exportar.hecho)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('exportar-movimientos'));
    await waitFor(() => expect(entregados).toHaveLength(2));
    expect(autenticar).not.toHaveBeenCalled();
    expect(entregados[0].nombre).toBe('financialcontrol-2026-11-22.json');
    expect(Object.keys(leerExportacion(entregados[0].contenido).tablas)).toHaveLength(13);
    expect(entregados[1].nombre).toBe('financialcontrol-movimientos-2026-11-22.csv');
    expect(entregados[1].contenido).toContain('-23,40;EUR');
  });

  it('con el bloqueo activo pide autenticación antes, con su motivo', async () => {
    await montar(true);
    await fireEvent.press(screen.getByTestId('exportar-todo'));
    await waitFor(() => expect(entregados).toHaveLength(1));
    expect(autenticar).toHaveBeenCalledWith(es.exportar.motivo, es.comun.cancelar);
    // Autenticarse para exportar no cambia el bloqueo ni lo desactiva.
    expect(estadoDeSeguridad().bloqueo.activo).toBe(true);
  });

  it('si la autenticación no pasa, no se exporta nada y se dice por qué', async () => {
    await montar(true, 'cancelado');
    await fireEvent.press(screen.getByTestId('exportar-todo'));
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(
      `⚠ ${es.exportar.noAutenticado}`,
    );
    await fireEvent.press(screen.getByTestId('exportar-movimientos'));
    await waitFor(() => expect(autenticar).toHaveBeenCalledTimes(2));
    expect(entregados).toEqual([]);
  });

  it('si la persona cierra la hoja sin guardar, se le dice que no hay fichero', async () => {
    await montar(false);
    respuestaDeLaHoja = 'descartado';
    await fireEvent.press(screen.getByTestId('exportar-todo'));
    expect(await screen.findByText(es.exportar.descartado)).toBeTruthy();
    respuestaDeLaHoja = 'no_disponible';
    await fireEvent.press(screen.getByTestId('exportar-todo'));
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(
      `⚠ ${es.exportar.noDisponible}`,
    );
  });
});
