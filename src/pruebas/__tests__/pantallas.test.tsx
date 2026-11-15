/**
 * Pruebas de las pantallas de H2 con una base de datos real en memoria.
 *
 * Cada prueba pinta una pantalla, la maneja como lo haría una persona
 * (pulsar teclas, escribir, tocar botones) y comprueba el resultado en la
 * base de datos. Solo se sustituye lo que depende del iPhone: la navegación,
 * la región del dispositivo y el fichero de SQLite.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import Movimientos from '@/app/(tabs)/index';
import Cuentas from '@/app/(tabs)/cuentas';
import PantallaDeCategorias from '@/app/categorias';
import PantallaDeCuenta from '@/app/cuenta';
import PantallaDeMovimiento from '@/app/movimiento';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { fechaLocal } from '@/dominio/modelo';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { ProveedorDeDatos } from '@/estado/Datos';
import { crearEntornoDePrueba } from '@/pruebas/bdDePrueba';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const { createElement } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
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
// La app y la prueba comparten una misma base de datos en memoria.
jest.mock('@/datos/bdExpo', () => {
  const { crearBdDePrueba } = jest.requireActual('@/pruebas/bdDePrueba');
  const bd = crearBdDePrueba();
  return { abrirBdExpo: async () => bd, bdCompartida: bd };
});

const HOY = fechaLocal();
let repos: Repositorios;
let principalId: string;

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

async function pulsarTeclas(...teclas: string[]) {
  for (const tecla of teclas) {
    await fireEvent.press(screen.getByTestId(`tecla-${tecla}`));
  }
}

beforeAll(async () => {
  const { bdCompartida } = jest.requireMock('@/datos/bdExpo');
  repos = await prepararBaseDeDatos(bdCompartida, crearEntornoDePrueba(), [
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Casa', tipo: 'gasto' },
    { nombre: 'Ocio', tipo: 'gasto' },
    { nombre: 'Nómina', tipo: 'ingreso' },
  ]);
});

beforeEach(() => {
  jest.clearAllMocks();
  conParametros({});
});

describe('P09 · cuentas (T-022)', () => {
  it('sin cuentas, el alta de movimiento pide crear una', async () => {
    await pintar(<PantallaDeMovimiento />);
    expect(await screen.findByText('Crear una cuenta')).toBeTruthy();
  });

  it('crea una cuenta con saldo inicial y aparece en la lista con ese saldo', async () => {
    await pintar(<PantallaDeCuenta />);
    await fireEvent.changeText(await screen.findByTestId('nombre'), 'Cuenta principal');
    await fireEvent.changeText(screen.getByTestId('saldo-inicial'), '2.150,00');
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));

    const cuentas = await repos.cuentas.listar();
    expect(cuentas).toHaveLength(1);
    expect(cuentas[0]).toMatchObject({ nombre: 'Cuenta principal', saldoInicial: 215000 });
    principalId = cuentas[0].id;
  });

  it('la lista muestra la cuenta, su saldo y el patrimonio', async () => {
    await pintar(<Cuentas />);
    expect(await screen.findByText('Cuenta principal')).toBeTruthy();
    expect(screen.getByTestId('saldo-Cuenta principal')).toHaveTextContent('2.150,00 €');
    expect(screen.getByTestId('patrimonio-EUR')).toHaveTextContent('2.150,00 €');
  });

  it('rechaza un nombre vacío, un duplicado y un saldo ilegible, sin guardar nada', async () => {
    await pintar(<PantallaDeCuenta />);
    await fireEvent.press(await screen.findByTestId('guardar'));
    expect(await screen.findByText(/Escribe un nombre/)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('nombre'), ' cuenta PRINCIPAL ');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Ya existe otro elemento/)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('nombre'), 'Otra');
    await fireEvent.changeText(screen.getByTestId('saldo-inicial'), 'doce euros');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/El importe no es válido/)).toBeTruthy();

    expect(router.back).not.toHaveBeenCalled();
    expect(await repos.cuentas.listar()).toHaveLength(1);
  });
});

describe('P07 · alta de movimiento (T-023)', () => {
  it('guarda un gasto en cuatro toques más los dígitos', async () => {
    // Toque 1: el botón [+] de la lista abre esta pantalla.
    await pintar(<Movimientos />);
    await fireEvent.press(await screen.findByTestId('boton-anadir'));
    expect(router.push).toHaveBeenCalledWith('/movimiento');
    let toques = 1;
    await screen.unmount();

    await pintar(<PantallaDeMovimiento />);
    // Se abre con el tipo Gasto, la fecha de hoy y la cuenta ya propuesta.
    await screen.findByText('Cuenta principal');
    expect(screen.getByTestId('segmento-gasto')).toBeSelected();
    expect(screen.getByText('Hoy')).toBeTruthy();

    // Dígitos (no cuentan como toques del flujo).
    await pulsarTeclas('2', '3', 'decimal', '4', '0');
    expect(screen.getByTestId('importe')).toHaveTextContent('23,40 €');

    // Toque 2: categoría. Toque 3: Guardar.
    await fireEvent.press(screen.getByTestId('categoria-Comida'));
    toques++;
    await fireEvent.press(screen.getByTestId('guardar'));
    toques++;
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));

    expect(toques).toBeLessThanOrEqual(4);
    const lista = await repos.movimientos.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      tipo: 'gasto',
      importe: 2340,
      divisa: 'EUR',
      fecha: HOY,
      cuentaNombre: 'Cuenta principal',
      categoriaNombre: 'Comida',
      origen: 'manual',
    });
  });

  it('no guarda un importe cero y lo explica', async () => {
    await pintar(<PantallaDeMovimiento />);
    await screen.findByText('Cuenta principal');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/importe mayor que cero/)).toBeTruthy();
    await pulsarTeclas('0', 'decimal', '0', '0');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/importe mayor que cero/)).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await repos.movimientos.listar()).toHaveLength(1);
  });

  it('pulsar Guardar dos veces seguidas guarda un solo movimiento', async () => {
    await pintar(<PantallaDeMovimiento />);
    await screen.findByText('Cuenta principal');
    await pulsarTeclas('4', 'decimal', '5');
    await fireEvent.changeText(screen.getByTestId('nombre'), 'Café');
    // La navegación está simulada, así que la pantalla sigue abierta tras el
    // primer guardado: el segundo toque llega a la misma pantalla.
    await fireEvent.press(screen.getByTestId('guardar'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(router.back).toHaveBeenCalledTimes(1);
    const cafes = (await repos.movimientos.listar()).filter((m) => m.nombre === 'Café');
    expect(cafes).toHaveLength(1);
    expect(cafes[0].importe).toBe(450);
  });

  it('edita un movimiento existente', async () => {
    const [cafe] = await repos.movimientos.listar({ texto: 'Café' });
    conParametros({ id: cafe.id });
    await pintar(<PantallaDeMovimiento />);
    await waitFor(() => expect(screen.getByTestId('importe')).toHaveTextContent('4,50 €'));
    await pulsarTeclas('borrar', 'borrar', '9');
    await fireEvent.press(screen.getByTestId('categoria-Comida'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await repos.movimientos.obtener(cafe.id)).toMatchObject({
      importe: 490,
      nombre: 'Café',
      creadoEn: cafe.creadoEn,
    });
    expect(await repos.movimientos.listar()).toHaveLength(2);
  });
});

describe('transferencia desde P07 (T-024)', () => {
  it('50 € pasan de una cuenta a otra y no cuentan como gasto', async () => {
    const cartera = await repos.cuentas.crear({
      nombre: 'Cartera',
      tipo: 'efectivo',
      saldoInicial: 6000,
      fechaSaldoInicial: HOY,
    });
    const saldoAntes = await repos.cuentas.saldo(principalId);
    const gastosAntes = (await repos.movimientos.listar()).filter((m) => m.tipo === 'gasto').length;

    await pintar(<PantallaDeMovimiento />);
    await screen.findByText('Cuenta principal');
    await fireEvent.press(screen.getByTestId('segmento-transferencia'));
    // Sin destino no se puede guardar.
    await pulsarTeclas('5', '0');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Elige la cuenta de destino/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('selector-destino'));
    await fireEvent.press(await screen.findByText('Cartera'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    expect(await repos.cuentas.saldo(principalId)).toBe(saldoAntes - 5000);
    expect(await repos.cuentas.saldo(cartera.id)).toBe(6000 + 5000);
    const lista = await repos.movimientos.listar();
    expect(lista.filter((m) => m.tipo === 'gasto')).toHaveLength(gastosAntes);
    expect(lista.find((m) => m.tipo === 'transferencia')).toMatchObject({
      importe: 5000,
      cuentaNombre: 'Cuenta principal',
      cuentaDestinoNombre: 'Cartera',
      categoriaId: null,
    });
  });
});

describe('P06 · lista de movimientos (T-025)', () => {
  it('muestra los movimientos y la búsqueda deja solo los que contienen el texto', async () => {
    await repos.movimientos.crear({
      tipo: 'gasto',
      fecha: HOY,
      importe: 1200,
      cuentaId: principalId,
      nombre: 'Mercado Central',
    });
    await pintar(<Movimientos />);
    expect(await screen.findByText('Mercado Central')).toBeTruthy();
    expect(screen.getByText('Café')).toBeTruthy();
    expect(screen.getByText('Hoy')).toBeTruthy();
    expect(screen.getByText('-4,90 €')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('buscar'), 'MERCA');
    await waitFor(() => expect(screen.queryByText('Café')).toBeNull());
    expect(screen.getByText('Mercado Central')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('buscar'), 'nada que coincida 😀');
    expect(await screen.findByTestId('lista-vacia')).toHaveTextContent(
      /Ningún movimiento coincide/,
    );

    await fireEvent.press(screen.getByTestId('quitar-filtros'));
    expect(await screen.findByText('Café')).toBeTruthy();
  });

  it('filtra por cuenta', async () => {
    await pintar(<Movimientos />);
    await screen.findByText('Mercado Central');
    await fireEvent.press(screen.getByTestId('filtro-cuenta'));
    await fireEvent.press(await screen.findByText('Cartera'));
    // En Cartera solo está la transferencia.
    await waitFor(() => expect(screen.queryByText('Mercado Central')).toBeNull());
    expect(screen.getByText('Cuenta principal → Cartera')).toBeTruthy();
  });
});

describe('borrado con deshacer (T-028)', () => {
  it('tras borrar un movimiento, Deshacer lo recupera con los mismos datos', async () => {
    const [original] = await repos.movimientos.listar({ texto: 'Mercado Central' });
    conParametros({ id: original.id });
    await pintar(<PantallaDeMovimiento />);
    await fireEvent.press(await screen.findByTestId('borrar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await repos.movimientos.listar({ texto: 'Mercado Central' })).toHaveLength(0);

    expect(screen.getByText('Movimiento borrado')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('aviso-accion'));
    // El botón desaparece al usarlo: no se puede deshacer dos veces.
    expect(screen.queryByTestId('aviso-accion')).toBeNull();

    await waitFor(async () =>
      expect(await repos.movimientos.listar({ texto: 'Mercado Central' })).toHaveLength(1),
    );
    const recuperado = await repos.movimientos.obtener(original.id);
    expect({ ...recuperado, modificadoEn: '' }).toMatchObject({
      id: original.id,
      importe: original.importe,
      fecha: original.fecha,
      nombre: original.nombre,
      cuentaId: original.cuentaId,
      creadoEn: original.creadoEn,
      borradoEn: null,
    });
  });

  it('una cuenta con movimientos no se borra y lo explica', async () => {
    conParametros({ id: principalId });
    await pintar(<PantallaDeCuenta />);
    await fireEvent.press(await screen.findByTestId('borrar'));
    expect(await screen.findByText(/tiene movimientos y no se puede borrar/)).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect((await repos.cuentas.obtener(principalId))?.borradoEn).toBeNull();
  });
});

describe('gestión de categorías (T-027)', () => {
  it('crea, rechaza duplicados, renombra y ordena', async () => {
    await pintar(<PantallaDeCategorias />);
    await screen.findByTestId('nombre-Comida');

    await fireEvent.changeText(screen.getByTestId('categoria-nueva'), 'Mascotas');
    await fireEvent.press(screen.getByTestId('anadir-categoria'));
    await screen.findByTestId('nombre-Mascotas');

    await fireEvent.changeText(screen.getByTestId('categoria-nueva'), ' comida ');
    await fireEvent.press(screen.getByTestId('anadir-categoria'));
    expect(await screen.findByText(/Ya existe otro elemento/)).toBeTruthy();

    const campo = screen.getByTestId('nombre-Mascotas');
    await fireEvent(campo, 'focus');
    await fireEvent.changeText(campo, 'Animales');
    await fireEvent(campo, 'endEditing');
    await screen.findByTestId('nombre-Animales');

    await fireEvent.press(screen.getByTestId('bajar-Comida'));
    await waitFor(async () =>
      expect((await repos.categorias.listar({ tipo: 'gasto' })).map((c) => c.nombre)).toEqual([
        'Casa',
        'Comida',
        'Ocio',
        'Animales',
      ]),
    );
  });

  it('archivar una categoría la oculta en el alta y conserva sus movimientos', async () => {
    const usados = (await repos.movimientos.listar()).filter((m) => m.categoriaNombre === 'Comida');
    expect(usados.length).toBeGreaterThan(0);

    await pintar(<PantallaDeCategorias />);
    await fireEvent.press(await screen.findByTestId('archivar-Comida'));
    await waitFor(() => expect(screen.queryByTestId('nombre-Comida')).toBeNull());
    await screen.unmount();

    await pintar(<PantallaDeMovimiento />);
    await screen.findByTestId('categoria-Casa');
    expect(screen.queryByTestId('categoria-Comida')).toBeNull();

    const despues = (await repos.movimientos.listar()).filter(
      (m) => m.categoriaNombre === 'Comida',
    );
    expect(despues).toHaveLength(usados.length);
  });
});
