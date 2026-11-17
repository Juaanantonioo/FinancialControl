/**
 * Pruebas de Inicio, del detalle de cuenta y de los filtros de Movimientos
 * que llegan por la ruta, con una base de datos real en memoria.
 *
 * B3b reubicó varios bloques de Inicio: el reparto del gasto, la evolución y
 * el balance de otros meses se comprueban ahora en Análisis › Mes, y la lista
 * de cuentas, en la pestaña Cuentas. Las cifras esperadas son las mismas.
 *
 * Los datos son de ejemplo y se colocan en el mes en curso para que la
 * pantalla, que abre por defecto en el mes actual, los muestre.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import Analisis from '@/app/(tabs)/analisis';
import Cuentas from '@/app/(tabs)/cuentas';
import Inicio from '@/app/(tabs)/index';
import Movimientos from '@/app/(tabs)/movimientos';
import DetalleDeCuenta from '@/app/detalle-de-cuenta';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { mesDe, moverMes } from '@/dominio/resumen';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { ProveedorDeDatos } from '@/estado/Datos';
import { describirMes } from '@/estado/fechas';
import { crearEntornoDePrueba } from '@/pruebas/bdDePrueba';

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
  const { crearBdDePrueba } = jest.requireActual('@/pruebas/bdDePrueba');
  const bd = crearBdDePrueba();
  return { abrirBdExpo: async () => bd, bdCompartida: bd };
});

const MES = mesDe();
const ANTERIOR = moverMes(MES, -1);
let repos: Repositorios;
let principalId: string;
let carteraId: string;
let comidaId: string;

function pintar(pantalla: ReactElement) {
  return render(
    <ProveedorDeDatos>
      <ProveedorDeAvisos>{pantalla}</ProveedorDeAvisos>
    </ProveedorDeDatos>,
  );
}

/** Análisis abierto en la vista de mes, donde están ahora el balance y el reparto del gasto. */
function pintarAnalisisDelMes() {
  conParametros({ vista: 'mes' });
  return pintar(<Analisis />);
}

function conParametros(parametros: Record<string, string>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(parametros);
}

beforeAll(async () => {
  const { bdCompartida } = jest.requireMock('@/datos/bdExpo');
  repos = await prepararBaseDeDatos(bdCompartida, crearEntornoDePrueba(), [
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Casa', tipo: 'gasto' },
    { nombre: 'Xilófonos', tipo: 'gasto' },
    { nombre: 'Nómina', tipo: 'ingreso' },
  ]);
});

beforeEach(() => {
  jest.clearAllMocks();
  conParametros({});
});

describe('Inicio sin datos', () => {
  it('sin cuentas explica qué falta y ofrece crear la primera', async () => {
    const inicio = await pintar(<Inicio />);
    // El primer paso pendiente es crear una cuenta.
    expect(await screen.findByTestId('paso-cuenta')).toHaveTextContent(/Crea una cuenta/);
    expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('0,00 €');
    expect(screen.getByTestId('frase-del-mes')).toHaveTextContent(/no tiene ingresos ni gastos/);
    await fireEvent.press(screen.getByTestId('paso-cuenta'));
    expect(router.push).toHaveBeenCalledWith('/cuenta');
    await inicio.unmount();

    // La pestaña Cuentas también lo explica.
    const cuentas = await pintar(<Cuentas />);
    expect(await screen.findByText(/Todavía no hay cuentas/)).toBeTruthy();
    await cuentas.unmount();

    // Ningún bloque queda en blanco ni con un gráfico a cero.
    await pintarAnalisisDelMes();
    expect(await screen.findByTestId('gasto-vacio')).toBeTruthy();
    expect(screen.getByTestId('evolucion-vacia')).toBeTruthy();
    expect(screen.queryByTestId('grafico-anillo')).toBeNull();
    expect(screen.queryByTestId('grafico-barras')).toBeNull();
  });
});

describe('Inicio con datos', () => {
  beforeAll(async () => {
    const principal = await repos.cuentas.crear({
      nombre: 'Principal',
      tipo: 'banco',
      saldoInicial: 100000,
      fechaSaldoInicial: `${ANTERIOR}-01`,
    });
    const cartera = await repos.cuentas.crear({
      nombre: 'Cartera',
      tipo: 'efectivo',
      saldoInicial: 5000,
      fechaSaldoInicial: `${MES}-10`,
    });
    principalId = principal.id;
    carteraId = cartera.id;
    const categorias = await repos.categorias.listar();
    const id = (nombre: string) => categorias.find((c) => c.nombre === nombre)!.id;
    comidaId = id('Comida');
    const nuevo = (
      tipo: 'gasto' | 'ingreso' | 'transferencia',
      fecha: string,
      importe: number,
      extra: { categoriaId?: string; cuentaDestinoId?: string; cuentaId?: string; nombre?: string },
    ) => repos.movimientos.crear({ tipo, fecha, importe, cuentaId: principalId, ...extra });
    // Mes en curso: 2 000 € de ingresos y 1 600 € de gastos.
    await nuevo('ingreso', `${MES}-01`, 200000, { categoriaId: id('Nómina'), nombre: 'Sueldo' });
    await nuevo('gasto', `${MES}-02`, 100000, { categoriaId: id('Casa'), nombre: 'Alquiler' });
    await nuevo('gasto', `${MES}-03`, 50000, { categoriaId: comidaId, nombre: 'Mercado' });
    await nuevo('gasto', `${MES}-04`, 9000, { categoriaId: id('Xilófonos'), nombre: 'Baquetas' });
    await nuevo('gasto', `${MES}-11`, 1000, { cuentaId: carteraId, nombre: 'Sin clasificar' });
    await nuevo('transferencia', `${MES}-12`, 3000, { cuentaDestinoId: carteraId });
    // Anterior a la fecha del saldo inicial de Cartera: aparece, pero no cuenta en su saldo.
    await nuevo('gasto', `${MES}-05`, 700, { cuentaId: carteraId, nombre: 'Antiguo' });
    await repos.movimientos.modificar(
      (await repos.movimientos.listar({ texto: 'Antiguo' }))[0].id,
      { tipo: 'gasto', fecha: `${MES}-05`, importe: 700, cuentaId: carteraId, nombre: 'Antiguo' },
    );
    // Borrado: no cuenta en ninguna cifra.
    const borrado = await nuevo('gasto', `${MES}-06`, 77700, { nombre: 'Borrado' });
    await repos.movimientos.borrar(borrado.id);
    // Mes anterior: solo un gasto.
    await nuevo('gasto', `${ANTERIOR}-15`, 2500, { categoriaId: comidaId, nombre: 'Cena' });
  });

  it('muestra el balance del mes, ingresos, gastos y la parte guardada', async () => {
    await pintar(<Inicio />);
    await waitFor(() =>
      expect(screen.getByTestId('ingresos-del-mes')).toHaveTextContent('+2.000,00 €'),
    );
    // 1 000 + 500 + 90 + 10 + 7 = 1 607 € de gastos; el borrado no cuenta.
    expect(screen.getByTestId('gastos-del-mes')).toHaveTextContent('-1.607,00 €');
    expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('+393,00 €');
    expect(screen.getByTestId('frase-del-mes')).toHaveTextContent(/Has guardado el 20 %/);
  });

  it('muestra cada cuenta con su saldo y el cambio del mes', async () => {
    // El saldo está en la pestaña Cuentas; el cambio del mes, en el detalle de cada una.
    const cuentas = await pintar(<Cuentas />);
    await screen.findByTestId('cuenta-Principal');
    // Principal: 1 000 + 2 000 − 1 000 − 500 − 90 − 30 (transferencia) − 25 (mes anterior).
    expect(screen.getByTestId('saldo-Principal')).toHaveTextContent('1.355,00 €');
    // Cartera: 50 − 10 + 30. El gasto anterior a su saldo inicial no cuenta.
    expect(screen.getByTestId('saldo-Cartera')).toHaveTextContent('70,00 €');
    await cuentas.unmount();

    conParametros({ id: principalId });
    const principal = await pintar(<DetalleDeCuenta />);
    await waitFor(() => expect(screen.getByTestId('variacion')).toHaveTextContent('+380,00 €'));
    await principal.unmount();

    conParametros({ id: carteraId });
    await pintar(<DetalleDeCuenta />);
    await waitFor(() => expect(screen.getByTestId('variacion')).toHaveTextContent('+20,00 €'));
  });

  it('dibuja el gasto por categoría con su descripción textual', async () => {
    await pintarAnalisisDelMes();
    const anillo = await screen.findByTestId('grafico-anillo');
    expect(screen.getByTestId('gasto-total')).toHaveTextContent('1.607,00 €');
    expect(anillo.props.accessibilityLabel).toMatch(/Reparto del gasto de/);
    expect(anillo.props.accessibilityLabel).toMatch(/Casa, 62 %/);
    expect(anillo.props.accessibilityLabel).toMatch(/Sin categoría/);
    expect(screen.getByTestId('parte-Casa')).toBeTruthy();
    expect(screen.getByTestId('parte-Comida')).toBeTruthy();
    // Una categoría sin icono conocido se pinta con su inicial.
    // El distintivo es decorativo y está oculto al lector de pantalla.
    // La comparativa de Análisis pinta el mismo distintivo: se mira dentro del bloque del reparto.
    expect(
      within(screen.getByTestId('bloque-gasto')).getByText('X', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByTestId('grafico-barras')).toBeTruthy();
  });

  it('tocar una categoría abre Movimientos filtrado por esa categoría y ese mes', async () => {
    await pintarAnalisisDelMes();
    await fireEvent.press(await screen.findByTestId('parte-Comida'));
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/movimientos',
      params: { mes: MES, categoriaId: comidaId, peticion: '1' },
    });
  });

  it('tocar «Sin categoría» abre Movimientos solo con el mes', async () => {
    await pintarAnalisisDelMes();
    await fireEvent.press(await screen.findByTestId('parte-Sin categoría'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/movimientos',
      params: { mes: MES, peticion: '1' },
    });
  });

  it('tocar una cuenta abre su detalle, que empieza en el mes en curso', async () => {
    await pintar(<Cuentas />);
    await fireEvent.press(await screen.findByTestId('cuenta-Principal'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/detalle-de-cuenta',
      params: { id: principalId },
    });
  });

  it('el botón + abre el alta de movimiento', async () => {
    await pintar(<Inicio />);
    await fireEvent.press(await screen.findByTestId('boton-anadir'));
    expect(router.push).toHaveBeenCalledWith('/movimiento');
  });

  it('el mes anterior, con gastos y sin ingresos, no muestra tasa de ahorro', async () => {
    await pintarAnalisisDelMes();
    await screen.findByTestId('grafico-anillo');
    await fireEvent.press(screen.getByTestId('mes-anterior'));
    await waitFor(() =>
      expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('-25,00 €'),
    );
    expect(screen.getByTestId('frase-del-mes')).toHaveTextContent(/no hay ingresos anotados/);
    expect(screen.queryByText(/Has guardado/)).toBeNull();
    expect(screen.getByTestId('mes-elegido')).toHaveTextContent(
      new RegExp(describirMes(ANTERIOR), 'i'),
    );
    // Una sola categoría se lleva el 100 %.
    expect(screen.getByTestId('grafico-anillo').props.accessibilityLabel).toMatch(/Comida, 100 %/);
  });

  it('un mes futuro sin movimientos muestra el estado vacío, no un gráfico a cero', async () => {
    const analisis = await pintarAnalisisDelMes();
    await screen.findByTestId('grafico-anillo');
    await fireEvent.press(screen.getByTestId('mes-siguiente'));
    await waitFor(() => expect(screen.getByTestId('gasto-vacio')).toBeTruthy());
    expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('0,00 €');
    expect(screen.queryByTestId('grafico-anillo')).toBeNull();
    await analisis.unmount();

    // El saldo de las cuentas no depende del mes que se mire.
    await pintar(<Cuentas />);
    expect(await screen.findByTestId('saldo-Principal')).toHaveTextContent('1.355,00 €');
  });

  it('tocar un mes de las barras cambia el mes que se ve', async () => {
    await pintarAnalisisDelMes();
    await fireEvent.press(await screen.findByTestId(`barras-${ANTERIOR}`));
    await waitFor(() =>
      expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('-25,00 €'),
    );
  });

  it('una cuenta archivada no está entre las activas y se ve al mostrar las archivadas', async () => {
    const vieja = await repos.cuentas.crear({
      nombre: 'Vieja',
      tipo: 'banco',
      saldoInicial: 0,
      fechaSaldoInicial: `${ANTERIOR}-01`,
    });
    await repos.movimientos.crear({
      tipo: 'ingreso',
      fecha: `${ANTERIOR}-20`,
      importe: 1000,
      cuentaId: vieja.id,
    });
    await repos.cuentas.archivar(vieja.id, true);
    await pintar(<Cuentas />);
    await screen.findByTestId('cuenta-Principal');
    expect(screen.queryByTestId('cuenta-Vieja')).toBeNull();
    await fireEvent.press(screen.getByText('Mostrar las cuentas archivadas'));
    expect(await screen.findByTestId('cuenta-Vieja')).toBeTruthy();
    expect(screen.getByText('Archivadas')).toBeTruthy();
  });
});

describe('Movimientos abierto desde Inicio', () => {
  it('aplica la categoría y el mes pedidos, y se pueden quitar', async () => {
    conParametros({ categoriaId: comidaId, mes: MES, peticion: '1' });
    await pintar(<Movimientos />);
    expect(await screen.findByText('Mercado')).toBeTruthy();
    expect(screen.queryByText('Alquiler')).toBeNull();
    // «Cena» es de Comida, pero del mes anterior.
    expect(screen.queryByText('Cena')).toBeNull();

    expect(screen.getByTestId('filtro-categoria').props.accessibilityLabel).toBe(
      'Categoría: Comida',
    );
    expect(screen.getByTestId('filtro-mes').props.accessibilityLabel).toBe(
      `Mes: ${describirMes(MES)}`,
    );

    await fireEvent.press(screen.getByTestId('quitar-filtros'));
    // La lista solo pinta sus primeras filas: se comprueba con una de ellas.
    expect(await screen.findByText('Sin clasificar')).toBeTruthy();
    expect(screen.getByTestId('filtro-categoria').props.accessibilityLabel).toBe(
      'Categoría: Todas',
    );
    expect(screen.getByTestId('filtro-mes').props.accessibilityLabel).toBe('Mes: Todos');
  });

  it('ignora un mes mal escrito en la ruta', async () => {
    conParametros({ mes: 'ayer', peticion: '2' });
    await pintar(<Movimientos />);
    expect(await screen.findByText('Sin clasificar')).toBeTruthy();
    expect(screen.getByTestId('filtro-mes').props.accessibilityLabel).toBe('Mes: Todos');
  });

  it('un gasto normal no se pinta en rojo: lleva signo menos y el color del texto', async () => {
    const { COLORES } = jest.requireActual('@/theme');
    await pintar(<Movimientos />);
    await fireEvent.changeText(await screen.findByTestId('buscar'), 'Alquiler');
    const importe = await screen.findByText('-1.000,00 €');
    const estilo = [importe.props.style].flat(Infinity).reduce((a, b) => ({ ...a, ...b }), {});
    expect(estilo.color).toBe(COLORES.claro.texto);
    expect(estilo.color).not.toBe(COLORES.claro.negativo);
    await fireEvent.changeText(screen.getByTestId('buscar'), 'Sueldo');
    const ingreso = await screen.findByText('+2.000,00 €');
    const estiloIngreso = [ingreso.props.style]
      .flat(Infinity)
      .reduce((a, b) => ({ ...a, ...b }), {});
    expect(estiloIngreso.color).toBe(COLORES.claro.positivo);
  });
});

describe('detalle de cuenta', () => {
  it('muestra el saldo actual y el resumen del mes de esa cuenta', async () => {
    conParametros({ id: principalId, mes: MES });
    await pintar(<DetalleDeCuenta />);
    await waitFor(() =>
      expect(screen.getByTestId('titulo-de-cuenta')).toHaveTextContent('Principal'),
    );
    expect(screen.getByTestId('saldo-actual')).toHaveTextContent('1.355,00 €');
    expect(screen.getByTestId('entradas')).toHaveTextContent('+2.000,00 €');
    expect(screen.getByTestId('salidas')).toHaveTextContent('-1.620,00 €');
    expect(screen.getByTestId('variacion')).toHaveTextContent('+380,00 €');
    expect(screen.getByText('Alquiler')).toBeTruthy();
    // Solo los movimientos de esta cuenta, y no el borrado.
    expect(screen.queryByText('Sin clasificar')).toBeNull();
    expect(screen.queryByText('Borrado')).toBeNull();
  });

  it('la edición de la cuenta sigue accesible y se puede volver', async () => {
    conParametros({ id: principalId });
    await pintar(<DetalleDeCuenta />);
    await fireEvent.press(await screen.findByTestId('editar-cuenta'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cuenta', params: { id: principalId } });
    await fireEvent.press(screen.getByTestId('volver'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('cambia de mes y explica cuando no hay movimientos', async () => {
    conParametros({ id: carteraId, mes: MES });
    await pintar(<DetalleDeCuenta />);
    await screen.findByTestId('saldo-actual');
    await fireEvent.press(screen.getByTestId('mes-anterior'));
    expect(await screen.findByTestId('cuenta-sin-movimientos')).toHaveTextContent(
      /no tiene movimientos en/,
    );
    expect(screen.getByTestId('variacion')).toHaveTextContent('0,00 €');
    // El saldo es el actual, no el de aquel mes.
    expect(screen.getByTestId('saldo-actual')).toHaveTextContent('70,00 €');
  });

  it('avisa de que un movimiento anterior al saldo inicial no cuenta', async () => {
    conParametros({ id: carteraId, mes: MES });
    await pintar(<DetalleDeCuenta />);
    expect(await screen.findByTestId('nota-anteriores')).toHaveTextContent(/no cuentan/);
    expect(screen.getByText('Antiguo')).toBeTruthy();
    expect(screen.getByTestId('salidas')).toHaveTextContent('-10,00 €');
    expect(screen.getByTestId('entradas')).toHaveTextContent('+30,00 €');
  });

  it('una cuenta que no existe lo dice en lugar de quedar en blanco', async () => {
    conParametros({ id: 'no-existe' });
    await pintar(<DetalleDeCuenta />);
    expect(await screen.findByTestId('cuenta-no-encontrada')).toBeTruthy();
    expect(screen.queryByTestId('editar-cuenta')).toBeNull();
  });
});
