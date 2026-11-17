/**
 * Pruebas de las pantallas de B3 (entrada rápida) con una base de datos real
 * en memoria: bandeja de capturas, guía de Apple Pay, alta abierta desde una
 * captura y accesos desde Movimientos, Inicio y Cuentas.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import Cuentas from '@/app/(tabs)/cuentas';
import Inicio from '@/app/(tabs)/index';
import Movimientos from '@/app/(tabs)/movimientos';
import GuiaDeApplePay from '@/app/apple-pay';
import Bandeja from '@/app/capturas';
import PantallaDeMovimiento from '@/app/movimiento';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { ACCION_ANADIR_GASTO, ACCION_REGISTRAR_PAGO, type Invocacion } from '@/dominio/captura';
import { fechaLocal } from '@/dominio/modelo';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { importarInvocaciones } from '@/estado/cola';
import { ProveedorDeDatos } from '@/estado/Datos';
import { importe } from '@/estado/formato';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const { createElement } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
    Link: ({ children }: { children: unknown }) => createElement(Text, null, children),
  };
});
jest.mock('expo-localization', () => ({
  getLocales: () => [{ decimalSeparator: ',', digitGroupingSeparator: '.', languageCode: 'es' }],
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual('node:crypto').randomUUID(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/datos/bdExpo', () => {
  const { crearBdDePrueba: crear } = jest.requireActual('@/pruebas/bdDePrueba');
  const bd = crear();
  return { abrirBdExpo: async () => bd, bdCompartida: bd };
});

const HOY = fechaLocal();
const euros = (centimos: number) => importe(centimos, 'EUR');
let repos: Repositorios;
let bancoId: string;
const cat: Record<string, string> = {};
let avisos: jest.SpyInstance;
let errores: jest.SpyInstance;

function pintar(pantalla: ReactElement) {
  return render(
    <ProveedorDeDatos>
      <ProveedorDeAvisos>{pantalla}</ProveedorDeAvisos>
    </ProveedorDeDatos>,
  );
}
function conParametros(parametros: Record<string, string>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(parametros);
}
const pendientes = () => repos.capturas.listar(['pendiente']);
const entrada = (id: string, params: Record<string, unknown>, hace = 0): Invocacion => ({
  id,
  name: ACCION_REGISTRAR_PAGO,
  params,
  createdAt: Date.now() - hace * 60_000,
});

beforeAll(async () => {
  const { bdCompartida } = jest.requireMock('@/datos/bdExpo');
  const entorno = {
    generarId: () => jest.requireActual('node:crypto').randomUUID() as string,
    ahora: () => new Date(),
  };
  repos = await prepararBaseDeDatos(bdCompartida, entorno, [
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Ocio', tipo: 'gasto' },
  ]);
  for (const c of await repos.categorias.listar()) cat[c.nombre] = c.id;
  const banco = await repos.cuentas.crear({
    nombre: 'Banco',
    tipo: 'banco',
    saldoInicial: 100000,
    fechaSaldoInicial: `${HOY.slice(0, 7)}-01`,
  });
  bancoId = banco.id;
  avisos = jest.spyOn(console, 'warn');
  errores = jest.spyOn(console, 'error');
});

beforeEach(() => {
  jest.clearAllMocks();
  conParametros({});
});

afterAll(() => {
  expect(avisos.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([]);
  expect(errores.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([]);
});

describe('sin capturas', () => {
  it('la bandeja explica qué falta y lleva a la guía', async () => {
    await pintar(<Bandeja />);
    expect(await screen.findByTestId('bandeja-vacia')).toHaveTextContent(
      /No hay pagos por revisar/,
    );
    expect(screen.queryByTestId('ver-otras')).toBeNull();
    await fireEvent.press(screen.getByTestId('abrir-guia'));
    expect(router.push).toHaveBeenCalledWith('/apple-pay');
  });

  it('Inicio no muestra la tarjeta de pagos por revisar y Movimientos ofrece la bandeja sin número', async () => {
    await pintar(<Inicio />);
    await screen.findByTestId('patrimonio-total');
    expect(screen.queryByTestId('bloque-capturas')).toBeNull();
    await screen.unmount();
    await pintar(<Movimientos />);
    const acceso = await screen.findByTestId('abrir-bandeja');
    expect(acceso).toHaveTextContent('Bandeja');
    await fireEvent.press(acceso);
    expect(router.push).toHaveBeenCalledWith('/capturas');
  });

  it('desde Cuentas se llega a Categorías y a la guía de Apple Pay', async () => {
    await pintar(<Cuentas />);
    await fireEvent.press(await screen.findByTestId('ajuste-apple-pay'));
    expect(router.push).toHaveBeenCalledWith('/apple-pay');
    await fireEvent.press(screen.getByTestId('ajuste-categorias'));
    expect(router.push).toHaveBeenCalledWith('/categorias');
  });
});

describe('guía de Apple Pay (P04)', () => {
  it('explica los pasos con los dos nombres del disparador y el consejo de Wallet', async () => {
    await pintar(<GuiaDeApplePay />);
    const pasos = await screen.findByTestId('pasos');
    expect(pasos).toHaveTextContent(/«Transacción»/);
    expect(pasos).toHaveTextContent(/«Wallet»/);
    expect(pasos).toHaveTextContent(/«Registrar pago»/);
    expect(screen.getByTestId('consejos')).toHaveTextContent(/Wallet tiene los datos móviles/);
    // No promete que capture todos los pagos.
    expect(screen.getByTestId('aviso-de-limites')).toHaveTextContent(/puede fallar/);
    expect(screen.getByTestId('ultima-captura')).toHaveTextContent(/Todavía no ha llegado/);
    expect(screen.getByTestId('sin-alias')).toBeTruthy();
  });

  it('«Enviar una captura de prueba» deja una captura en la bandeja', async () => {
    await pintar(<GuiaDeApplePay />);
    await fireEvent.press(await screen.findByTestId('enviar-prueba'));
    await waitFor(async () => expect(await pendientes()).toHaveLength(1));
    const [captura] = await pendientes();
    expect(captura).toMatchObject({
      origen: 'prueba',
      importeTexto: '12,34 €',
      importe: 1234,
      divisa: 'EUR',
      comercioTexto: 'Captura de prueba',
      cuentaId: bancoId,
      categoriaId: null,
    });
    // Entró por la cola: lleva su identificador.
    expect(captura.idDeCola).toMatch(/^prueba-/);
    expect(screen.getByText('Captura de prueba enviada a la bandeja')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('ultima-captura')).toHaveTextContent(/Hoy, a las \d\d:\d\d/),
    );
  });

  it('añade una tarjeta recordada y la olvida con deshacer', async () => {
    await pintar(<GuiaDeApplePay />);
    await fireEvent.changeText(await screen.findByTestId('nuevo-alias'), ' Visa ORO ');
    // Sin cuenta elegida no guarda.
    await fireEvent.press(screen.getByTestId('anadir-alias'));
    expect(await screen.findByText(/La cuenta ya no existe/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cuenta-del-alias'));
    await fireEvent.press(await screen.findByText('Banco'));
    await fireEvent.press(screen.getByTestId('anadir-alias'));
    const fila = await screen.findByTestId('alias-visa oro');
    expect(fila).toHaveTextContent(/Banco/);
    await fireEvent.press(fila);
    await waitFor(() => expect(screen.queryByTestId('alias-visa oro')).toBeNull());
    await fireEvent.press(screen.getByTestId('aviso-accion'));
    expect(await screen.findByTestId('alias-visa oro')).toBeTruthy();
    const [alias] = await repos.capturas.listarAlias();
    await repos.capturas.borrarAlias(alias.id);
  });
});

describe('bandeja de capturas (P08)', () => {
  it('una captura sin categoría se completa en el alta, con lo que ya trae puesto', async () => {
    const [captura] = await pendientes();
    await pintar(<Bandeja />);
    expect(await screen.findByTestId(`importe-${captura.id}`)).toHaveTextContent(euros(1234));
    expect(screen.getByTestId(`detalle-${captura.id}`)).toHaveTextContent(
      /Por completar: falta la categoría/,
    );
    // Incompleta: no hay «Guardar» con un toque.
    expect(screen.queryByTestId(`guardar-${captura.id}`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`completar-${captura.id}`));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/movimiento',
      params: { capturaId: captura.id },
    });
    await screen.unmount();

    conParametros({ capturaId: captura.id });
    await pintar(<PantallaDeMovimiento />);
    await waitFor(() => expect(screen.getByTestId('importe')).toHaveTextContent('12,34 €'));
    expect(screen.getByTestId('nombre').props.value).toBe('Captura de prueba');
    expect(screen.getByTestId('origen-captura')).toHaveTextContent(/Pago capturado: 12,34 €/);
    expect(screen.getByText('Banco')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('categoria-Comida'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));

    const guardada = await repos.capturas.obtener(captura.id);
    expect(guardada?.estado).toBe('guardada');
    const mov = await repos.movimientos.obtener(guardada?.movimientoId ?? '');
    expect(mov).toMatchObject({
      tipo: 'gasto',
      importe: 1234,
      cuentaId: bancoId,
      categoriaId: cat.Comida,
      nombre: 'Captura de prueba',
      origen: 'apple_pay',
      capturaId: captura.id,
    });
    expect(await repos.movimientos.listar()).toHaveLength(1);
  });

  it('una captura completa se guarda con un toque y se puede deshacer', async () => {
    // El comercio ya tiene categoría recordada: llega lista para guardar.
    await importarInvocaciones(
      repos,
      [entrada('cola-a', { importe: '5,00 €', comercio: 'Captura de prueba' })],
      new Date().toISOString(),
    );
    const [captura] = await pendientes();
    expect(captura.categoriaId).toBe(cat.Comida);
    await pintar(<Bandeja />);
    expect(await screen.findByTestId(`detalle-${captura.id}`)).toHaveTextContent('Comida · Banco');
    await fireEvent.press(screen.getByTestId(`guardar-${captura.id}`));
    await waitFor(() => expect(screen.queryByTestId(`captura-${captura.id}`)).toBeNull());
    expect(screen.getByText('Pago guardado')).toBeTruthy();
    const guardada = await repos.capturas.obtener(captura.id);
    expect(await repos.movimientos.obtener(guardada?.movimientoId ?? '')).toMatchObject({
      importe: 500,
      origen: 'apple_pay',
      capturaId: captura.id,
      fecha: HOY,
    });

    await fireEvent.press(screen.getByTestId('aviso-accion'));
    expect(await screen.findByTestId(`captura-${captura.id}`)).toBeTruthy();
    expect((await repos.capturas.obtener(captura.id))?.estado).toBe('pendiente');
    expect(await repos.movimientos.listar()).toHaveLength(1);
  });

  it('descartar la manda al apartado plegado, de donde se recupera', async () => {
    const [captura] = await pendientes();
    await pintar(<Bandeja />);
    await fireEvent.press(await screen.findByTestId(`descartar-${captura.id}`));
    await waitFor(() => expect(screen.queryByTestId(`captura-${captura.id}`)).toBeNull());
    expect((await repos.capturas.obtener(captura.id))?.estado).toBe('descartada');
    expect(screen.getByTestId('bandeja-vacia')).toBeTruthy();

    const plegado = screen.getByTestId('ver-otras');
    expect(plegado).toHaveTextContent(/Mostrar duplicadas y descartadas \(1\)/);
    await fireEvent.press(plegado);
    expect(await screen.findByTestId(`detalle-${captura.id}`)).toHaveTextContent('Descartada');
    await fireEvent.press(screen.getByTestId(`recuperar-${captura.id}`));
    await waitFor(async () =>
      expect((await repos.capturas.obtener(captura.id))?.estado).toBe('pendiente'),
    );
    expect(await screen.findByTestId(`guardar-${captura.id}`)).toBeTruthy();
  });

  it('una captura sin importe lo dice y otra en otra divisa pide revisarla', async () => {
    await importarInvocaciones(
      repos,
      [
        entrada('cola-b', { importe: '', comercio: '' }, 200),
        entrada('cola-c', { importe: '$12.50', comercio: 'Café ☕ Ñandú' }, 100),
      ],
      new Date().toISOString(),
    );
    await pintar(<Bandeja />);
    const lista = await pendientes();
    const sinImporte = lista.find((c) => c.idDeCola === 'cola-b');
    const enDolares = lista.find((c) => c.idDeCola === 'cola-c');
    expect(await screen.findByTestId(`importe-${sinImporte?.id}`)).toHaveTextContent(
      'Falta el importe',
    );
    expect(screen.getByTestId(`captura-${sinImporte?.id}`)).toHaveTextContent(/Pago sin comercio/);
    expect(screen.getByTestId(`captura-${enDolares?.id}`)).toHaveTextContent(/Está en USD/);
    expect(screen.getByTestId(`captura-${enDolares?.id}`)).toHaveTextContent(/Café ☕ Ñandú/);
  });

  it('la captura que se abre desde un aviso va la primera', async () => {
    const lista = await pendientes();
    const ultima = lista[lista.length - 1];
    conParametros({ id: ultima.id });
    await pintar(<Bandeja />);
    await screen.findByTestId(`captura-${ultima.id}`);
    const ids = screen
      .getAllByTestId(/^captura-/)
      .map((nodo) => String(nodo.props.testID).replace('captura-', ''));
    expect(ids[0]).toBe(ultima.id);
  });

  it('Inicio y Movimientos muestran cuántos pagos hay por revisar', async () => {
    const total = (await pendientes()).length;
    await pintar(<Inicio />);
    const tarjeta = await screen.findByTestId('bloque-capturas');
    expect(tarjeta).toHaveTextContent(new RegExp(`Pagos por revisar: ${total}`));
    await fireEvent.press(tarjeta);
    expect(router.push).toHaveBeenCalledWith('/capturas');
    await screen.unmount();
    await pintar(<Movimientos />);
    await waitFor(() =>
      expect(screen.getByTestId('abrir-bandeja')).toHaveTextContent(`Bandeja · ${total}`),
    );
  });
});

describe('cola de las acciones de Atajos', () => {
  it('la misma entrada leída dos veces no crea dos capturas', async () => {
    const antes = (await repos.capturas.listar()).length;
    const lote = [entrada('cola-d', { importe: '7,77 €', comercio: 'Kiosco' }, 300)];
    expect(await importarInvocaciones(repos, lote, new Date().toISOString())).toBe(1);
    expect(await importarInvocaciones(repos, lote, new Date().toISOString())).toBe(0);
    expect((await repos.capturas.listar()).length).toBe(antes + 1);
  });

  it('dos capturas iguales a 9 minutos dejan una pendiente y otra duplicada; a 11, las dos', async () => {
    const antes = (await pendientes()).length;
    await importarInvocaciones(
      repos,
      [
        entrada(
          'cola-e2',
          { importe: '31,00 €', comercio: 'Gasolinera', origen: 'notificacion' },
          491,
        ),
        entrada('cola-e1', { importe: '31,00 €', comercio: 'Gasolinera' }, 500),
        entrada('cola-e3', { importe: '31,00 €', comercio: 'Gasolinera' }, 480),
      ],
      new Date().toISOString(),
    );
    const todas = await repos.capturas.listar();
    const estadoDe = (id: string) => todas.find((c) => c.idDeCola === id)?.estado;
    // Se importan por orden de llegada aunque la cola venga desordenada.
    expect(estadoDe('cola-e1')).toBe('pendiente');
    expect(estadoDe('cola-e2')).toBe('duplicada');
    // A 11 minutos de la duplicada y 20 de la primera: es otro pago.
    expect(estadoDe('cola-e3')).toBe('pendiente');
    expect((await pendientes()).length).toBe(antes + 2);
  });

  it('una entrada estropeada o de otra acción no impide importar las demás', async () => {
    const antes = (await repos.capturas.listar()).length;
    const lote = [
      { id: 'rara', name: 'otraAccion', params: {}, createdAt: Date.now() },
      { id: 'rota', name: ACCION_REGISTRAR_PAGO, params: null as never, createdAt: Number.NaN },
      entrada('cola-f', { importe: '2,00 €', comercio: 'Panadería' }, 700),
    ];
    await importarInvocaciones(repos, lote, new Date().toISOString());
    const todas = await repos.capturas.listar();
    expect(todas.length).toBe(antes + 2);
    expect(todas.find((c) => c.idDeCola === 'rota')).toMatchObject({
      importe: null,
      importeTexto: '',
    });
    expect(todas.find((c) => c.idDeCola === 'cola-f')?.importe).toBe(200);
  });

  it('«Añadir gasto» crea el movimiento si está completo y deja una captura si no', async () => {
    const movimientosAntes = (await repos.movimientos.listar()).length;
    const pendientesAntes = (await pendientes()).length;
    const gasto = (id: string, params: Record<string, unknown>, hace: number): Invocacion => ({
      id,
      name: ACCION_ANADIR_GASTO,
      params,
      createdAt: Date.now() - hace * 60_000,
    });
    await importarInvocaciones(
      repos,
      [
        gasto('g-1', { importe: '9,99', categoria: 'ocio', cuenta: 'banco' }, 900),
        gasto('g-2', { importe: '', categoria: 'Ocio', cuenta: 'Banco' }, 800),
      ],
      new Date().toISOString(),
    );
    const lista = await repos.movimientos.listar();
    expect(lista.length).toBe(movimientosAntes + 1);
    expect(lista.find((m) => m.importe === 999)).toMatchObject({
      tipo: 'gasto',
      categoriaId: cat.Ocio,
      cuentaId: bancoId,
      origen: 'manual',
    });
    expect((await pendientes()).length).toBe(pendientesAntes + 1);
  });
});

describe('con muchas capturas', () => {
  it('con 150 pendientes la bandeja pinta las más recientes y dice cuántas hay', async () => {
    const lote = Array.from({ length: 150 }, (_, i) =>
      entrada(`masiva-${i}`, { importe: `${i + 1},00 €`, comercio: `Tienda ${i}` }, 2000 + i * 15),
    );
    await importarInvocaciones(repos, lote, new Date().toISOString());
    const total = (await pendientes()).length;
    expect(total).toBeGreaterThanOrEqual(150);
    await pintar(<Bandeja />);
    expect(await screen.findByTestId('mas-antiguas')).toHaveTextContent(
      `Se muestran las 100 más recientes de ${total}.`,
    );
    await screen.unmount();
    await pintar(<Movimientos />);
    await waitFor(() =>
      expect(screen.getByTestId('abrir-bandeja')).toHaveTextContent(`Bandeja · ${total}`),
    );
  });
});
