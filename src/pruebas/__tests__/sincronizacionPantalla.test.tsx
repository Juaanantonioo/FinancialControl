/**
 * Cuenta con sincronización (B4b-2): estado, «Sincronizar ahora», mensajes de
 * error y la pregunta de entrada. Motor y sincronizador de verdad, sobre un
 * servidor de filas de mentira; cuenta de verdad sobre su servidor de mentira.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { randomUUID } from 'node:crypto';

import CuentaDeUsuario from '@/app/cuenta-de-usuario';
import { gruposDelCodigo } from '@/cripto';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { crearGestorDeCuenta, type GestorDeCuenta } from '@/estado/cuenta';
import { iniciarSeguridad } from '@/estado/seguridad';
import es from '@/i18n/es.json';
import { almacenEnMemoria, servidorDeMentira } from '@/pruebas/cuentaDePrueba';
import { nubeDeMentira, type NubeDeMentira } from '@/pruebas/nubeDeMentira';
import { crearDispositivo, sembrarTodo, type Dispositivo } from '@/pruebas/sincronizacionDePrueba';
import { crearSincronizador, type Sincronizador } from '@/sincronizacion/sincronizador';

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

let mockGestor: GestorDeCuenta;
jest.mock('@/estado/cuentaDeLaApp', () => {
  const { useEffect, useSyncExternalStore } = jest.requireActual('react');
  return {
    cuenta: () => mockGestor,
    useCuenta: () => {
      useEffect(() => {
        void mockGestor.iniciar();
      }, []);
      return useSyncExternalStore(mockGestor.suscribir, mockGestor.estado, mockGestor.estado);
    },
  };
});
let mockSinc: Sincronizador;
jest.mock('@/estado/sincronizacionDeLaApp', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    sincronizacion: () => mockSinc,
    useSincronizacion: () =>
      useSyncExternalStore(mockSinc.suscribir, mockSinc.estado, mockSinc.estado),
  };
});
const mockExportarTodo = jest.fn();
jest.mock('@/estado/exportacionDeLaApp', () => ({
  exportacion: () => ({ todo: mockExportarTodo, movimientos: jest.fn() }),
}));

const CORREO = 'ana.ejemplo@example.com';
const CONTRASENA = 'correcta batería caballo grapa';
let nube: NubeDeMentira;
let usuario: string;
let d: Dispositivo;

/** Una cuenta abierta en un dispositivo con datos, y su sincronizador. */
async function montar() {
  const servidor = servidorDeMentira();
  mockGestor = crearGestorDeCuenta({
    cliente: servidor.cliente,
    almacen: almacenEnMemoria().almacen,
    autocomprobar: async () => ({ correcta: true, milisegundosDeDerivacion: 1 }),
    pausaAntesDeCalcular: 0,
  });
  expect(await mockGestor.crearCuenta(CORREO, CONTRASENA)).toEqual({ ok: true });
  const { codigo, gruposPedidos } = mockGestor.estado();
  const grupos = gruposDelCodigo(codigo!);
  expect(await mockGestor.confirmarCodigo(gruposPedidos.map((p) => grupos[p]))).toEqual({
    ok: true,
  });
  const clave = (await mockGestor.leerClaveDeDatos())!;
  nube = nubeDeMentira();
  usuario = randomUUID();
  d = await crearDispositivo({ servidor: nube.servidorDe(() => usuario), clave });
  await sembrarTodo(d);
  mockSinc = crearSincronizador({
    motor: async () => d.motor,
    haySesion: () => mockGestor.estado().fase === 'con_sesion',
    // Sin relojes de verdad: las pruebas piden cada ciclo a mano.
    temporizador: { poner: () => 0, quitar: () => undefined },
  });
  return { clave };
}

const pintar = () =>
  render(
    <ProveedorDeAvisos>
      <CuentaDeUsuario />
    </ProveedorDeAvisos>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  iniciarSeguridad(
    {
      leerBloqueo: () => ({ activo: false, espera: 'inmediato' }),
      guardarBloqueo: async () => undefined,
      leerModoPrivado: () => false,
      guardarModoPrivado: async () => undefined,
    },
    { capacidad: async () => 'biometria', autenticar: async () => 'cancelado' },
  );
});

describe('estado de la sincronización en Cuenta', () => {
  it('antes de sincronizar lo dice; «Sincronizar ahora» sube y deja el estado al día', async () => {
    await montar();
    await pintar();
    const tarjeta = await screen.findByTestId('cuenta-sincronizacion');
    expect(tarjeta).toHaveTextContent(new RegExp(es.sinc.inactiva));
    expect(screen.getByTestId('ultima-sincronizacion')).toHaveTextContent(es.sinc.nunca);

    await fireEvent.press(screen.getByTestId('sincronizar-ahora'));
    await waitFor(() =>
      expect(screen.getByTestId('estado-de-sincronizacion')).toHaveTextContent(es.sinc.alDia),
    );
    expect(screen.getByTestId('ultima-sincronizacion')).toHaveTextContent(
      /Última sincronización: .*\d{2}:\d{2}/,
    );
    expect(screen.getByTestId('cambios-pendientes')).toHaveTextContent(es.sinc.sinPendientes);
    expect(screen.queryByTestId('filas-ilegibles')).toBeNull();
    expect(nube.de(usuario).length).toBeGreaterThan(12);
  });

  it('sin conexión: mensaje comprensible y cuántos cambios esperan', async () => {
    await montar();
    await pintar();
    await act(() => mockSinc.pedir('sesion'));
    nube.estado.sinRed = true;
    await d.categorias.crear({ nombre: 'Uno', tipo: 'gasto' });
    await act(() => mockSinc.pedir('primer_plano'));
    expect(screen.getByTestId('estado-de-sincronizacion')).toHaveTextContent(
      `⚠ ${es.sinc.sinConexion}`,
    );
    expect(screen.getByTestId('cambios-pendientes')).toHaveTextContent(es.sinc.unPendiente);
    await d.categorias.crear({ nombre: 'Dos', tipo: 'gasto' });
    await act(() => mockSinc.pedir('primer_plano'));
    expect(screen.getByTestId('cambios-pendientes')).toHaveTextContent(
      '2 cambios pendientes de subir.',
    );
    // La app no se queda esperando: el botón vuelve a estar disponible.
    expect(screen.getByTestId('sincronizar-ahora')).toBeEnabled();
  });

  it('sesión caducada, error del servidor y filas ilegibles: cada cosa con su texto, sin detalles internos', async () => {
    await montar();
    await pintar();
    await act(() => mockSinc.pedir('sesion'));
    const estado = () => screen.getByTestId('estado-de-sincronizacion');

    nube.estado.averiado = true;
    await act(() => mockSinc.pedir('primer_plano'));
    expect(estado()).toHaveTextContent(`⚠ ${es.sinc.error}`);
    nube.estado.averiado = false;

    const sesion = usuario;
    usuario = null as unknown as string;
    await act(() => mockSinc.pedir('primer_plano'));
    expect(estado()).toHaveTextContent(`⚠ ${es.sinc.sesionCaducada}`);
    usuario = sesion;

    const [fila] = nube.de(usuario);
    fila.contenido = `${fila.contenido.slice(0, 40)}${fila.contenido[40] === 'A' ? 'B' : 'A'}${fila.contenido.slice(41)}`;
    fila.actualizada_en = nube.marca();
    await act(() => mockSinc.pedir('manual'));
    expect(estado()).toHaveTextContent(es.sinc.alDia);
    expect(screen.getByTestId('filas-ilegibles')).toHaveTextContent(
      /no se han podido descifrar: 1/,
    );
    // Nada de lo que se ve menciona tablas, códigos ni mensajes del servidor.
    const visible = JSON.stringify(screen.toJSON());
    expect(visible).not.toMatch(/fila_cifrada|PGRST|permission|Error:|undefined|\[object/);
  });
});

describe('entrada en una cuenta con datos en la nube y en el dispositivo', () => {
  async function conPregunta() {
    const { clave } = await montar();
    const otro = await crearDispositivo({ servidor: nube.servidorDe(() => usuario), clave });
    await sembrarTodo(otro);
    await otro.motor.evaluarEntrada();
    await otro.motor.ciclo();
    await pintar();
    await act(() => mockSinc.pedir('sesion'));
    return { otro, local: await d.volcar(), remotas: JSON.stringify([...nube.filas.values()]) };
  }

  it('pregunta, y avisa de que la copia no va cifrada', async () => {
    await conPregunta();
    const tarjeta = screen.getByTestId('cuenta-pregunta');
    expect(tarjeta).toHaveTextContent(new RegExp(es.sinc.preguntaTitulo));
    expect(tarjeta).toHaveTextContent(/No se pueden mezclar/);
    expect(tarjeta).toHaveTextContent(/La copia no va cifrada/);
    expect(screen.getByTestId('usar-la-nube')).toHaveTextContent(es.sinc.usarLaNube);
    // Mientras se pregunta no hay nada más que hacer en la pantalla.
    expect(screen.queryByTestId('sincronizar-ahora')).toBeNull();
    expect(screen.queryByTestId('cuenta-borrar')).toBeNull();
  });

  it('«Cancelar» cierra la sesión y no cambia nada, ni aquí ni en la nube', async () => {
    const { local, remotas } = await conPregunta();
    await fireEvent.press(screen.getByTestId('cancelar-entrada'));
    await screen.findByTestId('cuenta-sin-sesion');
    expect(mockGestor.estado().fase).toBe('sin_sesion');
    expect(await d.volcar()).toEqual(local);
    expect(JSON.stringify([...nube.filas.values()])).toBe(remotas);
    expect(mockExportarTodo).not.toHaveBeenCalled();
  });

  it('«Usar los datos de la nube» exporta antes; si no se guarda la copia, no cambia nada', async () => {
    const { local, remotas } = await conPregunta();
    mockExportarTodo.mockResolvedValue('descartado');
    await fireEvent.press(screen.getByTestId('usar-la-nube'));
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(`⚠ ${es.sinc.sinCopia}`);
    expect(mockExportarTodo).toHaveBeenCalledWith('-copia-local');
    expect(await d.volcar()).toEqual(local);
    expect(JSON.stringify([...nube.filas.values()])).toBe(remotas);
    expect(screen.getByTestId('cuenta-pregunta')).toBeTruthy();
  });

  it('con la copia guardada, los datos locales pasan a ser los de la nube y lo local no sube', async () => {
    const { otro, local, remotas } = await conPregunta();
    let alExportar: unknown = null;
    mockExportarTodo.mockImplementation(async () => {
      alExportar = await d.volcar();
      return 'compartido';
    });
    await fireEvent.press(screen.getByTestId('usar-la-nube'));
    await screen.findByTestId('cuenta-sincronizacion');
    await waitFor(() =>
      expect(screen.getByTestId('estado-de-sincronizacion')).toHaveTextContent(es.sinc.alDia),
    );
    // La copia se hizo con lo local todavía entero.
    expect(alExportar).toEqual(local);
    expect(await d.volcar()).toEqual(await otro.volcar());
    expect(JSON.stringify([...nube.filas.values()])).toBe(remotas);
  });
});
