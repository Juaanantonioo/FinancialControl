/**
 * Pruebas de las pantallas de H3 con una base de datos real en memoria:
 * patrimonio en Inicio, cuenta de inversión, valor de inversión, resumen de
 * inversiones, Patrimonio, Análisis y elección de icono y color.
 *
 * Los datos son de ejemplo y se colocan en fechas relativas a hoy.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import Analisis from '@/app/(tabs)/analisis';
import Cuentas from '@/app/(tabs)/cuentas';
import Inicio from '@/app/(tabs)/index';
import Movimientos from '@/app/(tabs)/movimientos';
import PantallaDeCategorias from '@/app/categorias';
import DetalleDeCuenta from '@/app/detalle-de-cuenta';
import PantallaDeInversiones from '@/app/inversiones';
import PantallaDePatrimonio from '@/app/patrimonio';
import PantallaDeValor from '@/app/valor-de-inversion';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { fechaLocal } from '@/dominio/modelo';
import { mesDe, moverMes } from '@/dominio/resumen';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { ProveedorDeDatos } from '@/estado/Datos';
import { moverDias } from '@/estado/fechas';
import { crearBdDePrueba } from '@/pruebas/bdDePrueba';

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
const MES = mesDe();
const ANTERIOR = moverMes(MES, -1);
const ANIO = Number(HOY.slice(0, 4));
/** Un día del mes anterior, siempre válido. */
const dia = (numero: number) => `${ANTERIOR}-${String(numero).padStart(2, '0')}`;

let repos: Repositorios;
let bancoId: string;
let brokerId: string;
let comidaId: string;
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
async function pulsarTeclas(...teclas: string[]) {
  for (const tecla of teclas) await fireEvent.press(screen.getByTestId(`tecla-${tecla}`));
}

beforeAll(async () => {
  const { bdCompartida } = jest.requireMock('@/datos/bdExpo');
  // El reloj de la base de datos es el real: las reglas de fecha usan «hoy».
  const entorno = {
    generarId: () => jest.requireActual('node:crypto').randomUUID() as string,
    ahora: () => new Date(),
  };
  repos = await prepararBaseDeDatos(bdCompartida, entorno, [
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Casa', tipo: 'gasto' },
    { nombre: 'Nómina', tipo: 'ingreso' },
  ]);
  avisos = jest.spyOn(console, 'warn');
  errores = jest.spyOn(console, 'error');
});

beforeEach(() => {
  jest.clearAllMocks();
  conParametros({});
});

afterAll(() => {
  // Ninguna pantalla debe dejar avisos ni errores en la consola.
  expect(avisos.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([]);
  expect(errores.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([]);
});

describe('sin cuentas de inversión', () => {
  beforeAll(async () => {
    const banco = await repos.cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      saldoInicial: 500000,
      fechaSaldoInicial: dia(1),
    });
    bancoId = banco.id;
    const categorias = await repos.categorias.listar();
    comidaId = categorias.find((c) => c.nombre === 'Comida')!.id;
    const casaId = categorias.find((c) => c.nombre === 'Casa')!.id;
    const gasto = (fecha: string, importe: number, categoriaId: string, nombre: string) =>
      repos.movimientos.crear({
        tipo: 'gasto',
        fecha,
        importe,
        cuentaId: bancoId,
        categoriaId,
        nombre,
      });
    await gasto(dia(3), 40000, comidaId, 'Mercado de octubre');
    await gasto(dia(3), 62000, casaId, 'Alquiler anterior');
    await gasto(`${MES}-01`, 36000, comidaId, 'Mercado');
    await gasto(`${MES}-01`, 500, comidaId, 'Pan');
    await repos.movimientos.crear({
      tipo: 'ingreso',
      fecha: `${MES}-01`,
      importe: 200000,
      cuentaId: bancoId,
      nombre: 'Sueldo',
    });
  });

  it('Inicio muestra el patrimonio antes que cualquier otro dato y no hay bloque de inversiones', async () => {
    await pintar(<Inicio />);
    // 5 000 − 400 − 620 − 360 − 5 + 2 000 = 5 615 €.
    await waitFor(() =>
      expect(screen.getByTestId('patrimonio-total')).toHaveTextContent('5.615,00 €'),
    );
    expect(screen.getByTestId('patrimonio-disponible')).toHaveTextContent('5.615,00 €');
    expect(screen.queryByTestId('patrimonio-invertido')).toBeNull();
    expect(screen.queryByTestId('bloque-inversiones')).toBeNull();
    // El patrimonio es el primer texto con cifra de la pantalla.
    const cifras = screen.getAllByText(/€/).map((nodo) => nodo.props.testID);
    expect(cifras[0]).toBe('patrimonio-total');
    // Cambió +1 635 € desde el cierre del mes anterior, que era de 3 980 €.
    expect(screen.getByTestId('patrimonio-variacion')).toHaveTextContent(
      /\+1\.635,00 € \(\+41,1 %\)/,
    );
  });

  it('el selector de mes no cambia el patrimonio, solo los bloques del mes', async () => {
    await pintar(<Inicio />);
    await waitFor(() =>
      expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('+1.635,00 €'),
    );
    await fireEvent.press(screen.getByTestId('mes-anterior'));
    await waitFor(() =>
      expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('-1.020,00 €'),
    );
    expect(screen.getByTestId('patrimonio-total')).toHaveTextContent('5.615,00 €');
  });

  it('tocar el patrimonio abre su evolución y el + abre el alta', async () => {
    await pintar(<Inicio />);
    await fireEvent.press(await screen.findByTestId('patrimonio'));
    expect(router.push).toHaveBeenCalledWith('/patrimonio');
    await fireEvent.press(screen.getByTestId('boton-anadir'));
    expect(router.push).toHaveBeenCalledWith('/movimiento');
  });

  it('Inicio se abre en el mes pedido por la ruta', async () => {
    conParametros({ mes: ANTERIOR, peticion: 'anio-1' });
    await pintar(<Inicio />);
    await waitFor(() =>
      expect(screen.getByTestId('balance-del-mes')).toHaveTextContent('-1.020,00 €'),
    );
  });

  it('el bloque Hoy muestra el gasto de hoy y la media diaria del mes', async () => {
    await pintar(<Inicio />);
    await screen.findByTestId('bloque-hoy');
    const hoyEsDiaUno = HOY.endsWith('-01');
    await waitFor(() =>
      expect(screen.getByTestId('gasto-de-hoy')).toHaveTextContent(
        hoyEsDiaUno ? '365,00 €' : '0,00 €',
      ),
    );
    expect(screen.getByTestId('media-diaria')).toHaveTextContent(/€/);
  });

  it('la pantalla de inversiones, sin cuentas de inversión, explica qué hacer', async () => {
    await pintar(<PantallaDeInversiones />);
    expect(await screen.findByTestId('inversiones-vacio')).toHaveTextContent(
      /No tienes cuentas de inversión/,
    );
    expect(screen.queryByTestId('grafico-anillo')).toBeNull();
  });

  it('el detalle de una cuenta de banco no muestra nada de inversión', async () => {
    conParametros({ id: bancoId });
    await pintar(<DetalleDeCuenta />);
    await screen.findByTestId('saldo-actual');
    expect(screen.queryByTestId('bloque-inversion')).toBeNull();
    expect(screen.queryByTestId('actualizar-valor')).toBeNull();
  });
});

describe('cuenta de inversión', () => {
  beforeAll(async () => {
    const broker = await repos.cuentas.crear({
      nombre: 'Bróker',
      tipo: 'inversion',
      saldoInicial: 0,
      fechaSaldoInicial: dia(1),
    });
    brokerId = broker.id;
    for (const [fecha, importe] of [
      [dia(2), 100000],
      [dia(4), 50000],
      [dia(6), 50000],
    ] as const) {
      await repos.movimientos.crear({
        tipo: 'transferencia',
        fecha,
        importe,
        cuentaId: bancoId,
        cuentaDestinoId: brokerId,
      });
    }
  });

  it('sin valores anotados muestra lo aportado y un estado vacío que explica para qué sirve', async () => {
    conParametros({ id: brokerId });
    await pintar(<DetalleDeCuenta />);
    await waitFor(() => expect(screen.getByTestId('valor-actual')).toHaveTextContent('2.000,00 €'));
    expect(screen.getByTestId('aportado')).toHaveTextContent('2.000,00 €');
    expect(screen.getByTestId('ganancia')).toHaveTextContent('Ni ganas ni pierdes');
    expect(screen.getByTestId('origen-del-valor')).toHaveTextContent(/Todavía no has anotado/);
    expect(screen.getByTestId('inversion-sin-valores')).toHaveTextContent(/Anota cuánto vale hoy/);
    expect(screen.queryByTestId('historial-de-valores')).toBeNull();
    expect(screen.queryByTestId('saldo-actual')).toBeNull();

    await fireEvent.press(screen.getByTestId('actualizar-valor'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/valor-de-inversion',
      params: { cuentaId: brokerId },
    });
  });

  it('anota un valor con el teclado de importe', async () => {
    conParametros({ cuentaId: brokerId });
    await pintar(<PantallaDeValor />);
    expect(await screen.findByTestId('cuenta-del-valor')).toHaveTextContent('Bróker');
    await pulsarTeclas('2', '1', '5', '0');
    expect(screen.getByTestId('importe')).toHaveTextContent('2.150 €');
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const valores = await repos.valores.listarPorCuenta(brokerId);
    expect(valores).toHaveLength(1);
    expect(valores[0]).toMatchObject({ fecha: HOY, valor: 215000 });
  });

  it('con un valor muestra aportado, valor, ganancia y porcentaje: 150 € y 7,5 %', async () => {
    conParametros({ id: brokerId });
    await pintar(<DetalleDeCuenta />);
    await waitFor(() => expect(screen.getByTestId('valor-actual')).toHaveTextContent('2.150,00 €'));
    expect(screen.getByTestId('aportado')).toHaveTextContent('2.000,00 €');
    expect(screen.getByTestId('ganancia')).toHaveTextContent('Ganas 150,00 € (+7,5 %)');
    expect(screen.getByTestId('origen-del-valor')).toHaveTextContent(/Valor anotado el/);
    expect(screen.getByTestId('historial-de-valores')).toBeTruthy();
    expect(screen.queryByTestId('inversion-sin-valores')).toBeNull();
    await fireEvent(screen.getByTestId('lienzo-de-linea'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 140, x: 0, y: 0 } },
    });
    expect(screen.queryByTestId('aviso-valor-antiguo')).toBeNull();
    // La limitación del ingreso directo se explica en pantalla.
    expect(screen.getByText(/cuenta como dinero que has puesto/)).toBeTruthy();
  });

  it('anotar otro valor el mismo día sustituye al anterior y dos toques no duplican', async () => {
    conParametros({ cuentaId: brokerId });
    await pintar(<PantallaDeValor />);
    await screen.findByTestId('cuenta-del-valor');
    await pulsarTeclas('2', '2', '0', '0');
    await fireEvent.press(screen.getByTestId('guardar'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(router.back).toHaveBeenCalledTimes(1);
    const valores = await repos.valores.listarPorCuenta(brokerId);
    expect(valores.map((v) => v.valor)).toEqual([220000]);
  });

  it('edita un valor y rechaza una fecha anterior a la cuenta', async () => {
    const [valor] = await repos.valores.listarPorCuenta(brokerId);
    conParametros({ id: valor.id });
    await pintar(<PantallaDeValor />);
    await waitFor(() => expect(screen.getByTestId('importe')).toHaveTextContent('2.200 €'));
    await pulsarTeclas('borrar', 'borrar', '5', '0');
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect((await repos.valores.obtener(valor.id))?.valor).toBe(225000);
    // La fecha no puede ser futura: el botón de día siguiente está desactivado.
    expect(screen.getByTestId('fecha-siguiente')).toBeDisabled();
  });

  it('un valor de hace más de 30 días invita a actualizarlo, sin notificaciones', async () => {
    const [valor] = await repos.valores.listarPorCuenta(brokerId);
    // Solo es posible si el mes anterior empezó hace más de 30 días.
    const antigua = dia(1);
    await repos.valores.modificar(valor.id, { fecha: antigua, valor: 225000 });
    conParametros({ id: brokerId });
    await pintar(<DetalleDeCuenta />);
    await screen.findByTestId('valor-actual');
    const dias = Math.round(
      (new Date(`${HOY}T12:00:00`).getTime() - new Date(`${antigua}T12:00:00`).getTime()) / 864e5,
    );
    if (dias > 30) {
      expect(screen.getByTestId('aviso-valor-antiguo')).toHaveTextContent(
        new RegExp(`hace ${dias} días`),
      );
    } else {
      expect(screen.queryByTestId('aviso-valor-antiguo')).toBeNull();
    }
    // Las aportaciones posteriores al valor se suman: 2 250 + 1 000 + 500 + 500.
    expect(screen.getByTestId('valor-actual')).toHaveTextContent('4.250,00 €');
    expect(screen.getByTestId('origen-del-valor')).toHaveTextContent(/más lo que has puesto/);
    await repos.valores.modificar(valor.id, { fecha: HOY, valor: 215000 });
  });

  it('borrar un valor con deshacer lo recupera y los cálculos vuelven', async () => {
    const [valor] = await repos.valores.listarPorCuenta(brokerId);
    conParametros({ id: valor.id });
    await pintar(<PantallaDeValor />);
    await fireEvent.press(await screen.findByTestId('borrar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await repos.valores.listarPorCuenta(brokerId)).toEqual([]);
    expect(screen.getByText('Valor borrado')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('aviso-accion'));
    await waitFor(async () =>
      expect(await repos.valores.listarPorCuenta(brokerId)).toHaveLength(1),
    );
    expect((await repos.valores.obtener(valor.id))?.valor).toBe(215000);
  });

  it('un valor que no existe lo dice en lugar de quedar en blanco', async () => {
    conParametros({ id: 'no-existe' });
    await pintar(<PantallaDeValor />);
    expect(await screen.findByText('Este valor ya no existe.')).toBeTruthy();
    expect(screen.getByTestId('guardar')).toBeDisabled();
  });

  it('Inicio suma el valor de la inversión al patrimonio y muestra el bloque de inversiones', async () => {
    await pintar(<Inicio />);
    // Disponible: 5 615 − 2 000 = 3 615 €. Invertido: 2 150 €.
    await waitFor(() =>
      expect(screen.getByTestId('patrimonio-total')).toHaveTextContent('5.765,00 €'),
    );
    expect(screen.getByTestId('patrimonio-disponible')).toHaveTextContent('3.615,00 €');
    expect(screen.getByTestId('patrimonio-invertido')).toHaveTextContent('2.150,00 €');
    expect(screen.getByTestId('inversiones-aportado')).toHaveTextContent('2.000,00 €');
    expect(screen.getByTestId('inversiones-valor')).toHaveTextContent('2.150,00 €');
    expect(screen.getByTestId('inversiones-ganancia')).toHaveTextContent('+150,00 € (+7,5 %)');
    // En la lista de cuentas la inversión aparece por lo que vale.
    expect(screen.getByTestId('inicio-saldo-Bróker')).toHaveTextContent('2.150,00 €');
    await fireEvent.press(screen.getByTestId('bloque-inversiones'));
    expect(router.push).toHaveBeenCalledWith('/inversiones');
  });

  it('la pestaña Cuentas muestra el mismo patrimonio que Inicio', async () => {
    await pintar(<Cuentas />);
    await waitFor(() =>
      expect(screen.getByTestId('patrimonio-EUR')).toHaveTextContent('5.765,00 €'),
    );
    expect(screen.getByTestId('saldo-Bróker')).toHaveTextContent('2.150,00 €');
    await fireEvent.press(screen.getByTestId('abrir-patrimonio'));
    expect(router.push).toHaveBeenCalledWith('/patrimonio');
  });

  it('el resumen de inversiones da los totales, el reparto y la nota fija', async () => {
    await pintar(<PantallaDeInversiones />);
    await waitFor(() =>
      expect(screen.getByTestId('inversiones-valor')).toHaveTextContent('2.150,00 €'),
    );
    expect(screen.getByTestId('inversiones-aportado')).toHaveTextContent('2.000,00 €');
    expect(screen.getByTestId('inversiones-ganancia')).toHaveTextContent('Ganas 150,00 € (+7,5 %)');
    expect(screen.getByTestId('grafico-anillo').props.accessibilityLabel).toMatch(/Bróker, 100 %/);
    expect(screen.getByTestId('nota-inversiones')).toHaveTextContent(
      /no consulta precios ni da consejos/,
    );
    await fireEvent.press(screen.getByTestId('inversion-Bróker'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/detalle-de-cuenta',
      params: { id: brokerId },
    });
  });

  it('un valor por debajo de lo aportado se muestra como pérdida, con palabra y signo', async () => {
    const [valor] = await repos.valores.listarPorCuenta(brokerId);
    await repos.valores.modificar(valor.id, { fecha: HOY, valor: 180000 });
    await pintar(<PantallaDeInversiones />);
    await waitFor(() =>
      expect(screen.getByTestId('inversiones-ganancia')).toHaveTextContent(
        'Pierdes 200,00 € (-10 %)',
      ),
    );
    await repos.valores.modificar(valor.id, { fecha: HOY, valor: 215000 });
  });
});

describe('Patrimonio', () => {
  it('muestra la cifra, el reparto por tipo y el peso de cada cuenta', async () => {
    await pintar(<PantallaDePatrimonio />);
    await waitFor(() =>
      expect(screen.getByTestId('patrimonio-total')).toHaveTextContent('5.765,00 €'),
    );
    expect(screen.getByTestId('tipo-banco')).toHaveTextContent('3.615,00 €');
    expect(screen.getByTestId('tipo-inversion')).toHaveTextContent('2.150,00 €');
    // No hay cuentas de efectivo: ese tipo no aparece.
    expect(screen.queryByTestId('tipo-efectivo')).toBeNull();
    expect(screen.getByTestId('peso-Banco')).toHaveTextContent('63 %');
    expect(screen.getByTestId('peso-Bróker')).toHaveTextContent('37 %');
    expect(screen.getByText(/último valor que anotaste/)).toBeTruthy();
    // Dos meses de historia: la línea tiene dos puntos y no inventa los anteriores.
    const linea = screen.getByTestId('grafico-linea');
    // Al conocer su ancho, la línea se dibuja sin avisos.
    await fireEvent(screen.getByTestId('lienzo-de-linea'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 140, x: 0, y: 0 } },
    });
    expect(linea.props.accessibilityLabel.split(';')).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('patrimonio-cuenta-Bróker'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/detalle-de-cuenta',
      params: { id: brokerId },
    });
  });
});

describe('Análisis', () => {
  /** Fija el tamaño de letra del sistema (1 es el normal) y devuelve cómo restaurarlo. */
  function conEscalaDeLetra(fontScale: number) {
    const dimensiones = jest.requireActual('react-native').Dimensions;
    const original = dimensiones.get('window');
    dimensiones.set({ window: { ...original, fontScale } });
    return () => dimensiones.set({ window: original });
  }
  let restaurar: () => void;
  beforeEach(() => {
    restaurar = conEscalaDeLetra(1);
  });
  afterEach(() => restaurar());

  it('la vista Día muestra el calendario con la cifra de cada día y abre sus movimientos', async () => {
    await pintar(<Analisis />);
    const primero = await screen.findByTestId(`dia-${MES}-01`);
    expect(screen.getByTestId('calendario')).toBeTruthy();
    // La cifra acompaña a la intensidad: 360 + 5 = 365 €.
    expect(primero).toHaveTextContent(/365/);
    expect(primero.props.accessibilityLabel).toMatch(/gastado 365,00.€, ingresado 2\.000,00.€/);
    expect(screen.getByTestId('analisis-mayor-gasto')).toHaveTextContent('365,00 € el día 1');
    expect(screen.getByTestId('analisis-media-diaria')).toHaveTextContent(/€/);
    expect(screen.queryByTestId('movimientos-del-dia')).toBeNull();

    await fireEvent.press(primero);
    expect(await screen.findByText('Mercado')).toBeTruthy();
    expect(screen.getByText('Pan')).toBeTruthy();
    expect(screen.getByTestId('totales-del-dia')).toHaveTextContent(
      /Gastado: 365,00 € · Ingresado: 2\.000,00 €/,
    );
    await fireEvent.press(screen.getByTestId('abrir-dia-en-movimientos'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/movimientos',
      params: { dia: `${MES}-01`, peticion: `dia-${MES}-01` },
    });
  });

  it('un mes sin movimientos explica el vacío en lugar de pintar un calendario a cero', async () => {
    await pintar(<Analisis />);
    await screen.findByTestId('calendario');
    await fireEvent.press(screen.getByTestId('mes-siguiente'));
    expect(await screen.findByTestId('dia-vacio')).toBeTruthy();
    expect(screen.queryByTestId('calendario')).toBeNull();
    expect(screen.getByTestId('analisis-media-diaria')).toHaveTextContent('—');
  });

  it('con la letra del sistema muy grande el calendario pasa a lista de días', async () => {
    conEscalaDeLetra(2);
    await pintar(<Analisis />);
    expect(await screen.findByTestId('lista-de-dias')).toBeTruthy();
    expect(screen.queryByTestId('calendario')).toBeNull();
    expect(screen.getByTestId(`dia-${MES}-01`)).toHaveTextContent(/-365,00 €/);
  });

  it('la vista Mes compara cada categoría con el mes anterior y abre Movimientos filtrado', async () => {
    conParametros({ vista: 'mes' });
    await pintar(<Analisis />);
    const comida = await screen.findByTestId('comparativa-Comida');
    // Comida: 365 € frente a 400 €. Casa: 0 € frente a 620 €.
    expect(comida).toHaveTextContent(/365,00 €/);
    expect(comida).toHaveTextContent(/35,00 € menos \(-9 %\)/);
    expect(screen.getByTestId('comparativa-Casa')).toHaveTextContent(/620,00 € menos \(-100 %\)/);
    expect(screen.getByTestId('comparativa-total')).toHaveTextContent('365,00 €');
    expect(screen.getByTestId('grafico-barras')).toBeTruthy();

    await fireEvent.press(comida);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/movimientos',
      params: { mes: MES, categoriaId: comidaId, peticion: 'analisis-1' },
    });
  });

  it('en la vista Mes, una categoría sin gasto el mes anterior se marca como nueva', async () => {
    conParametros({ vista: 'mes', mes: ANTERIOR });
    await pintar(<Analisis />);
    expect(await screen.findByTestId('comparativa-Casa')).toHaveTextContent(/Nuevo/);
  });

  it('la vista Año muestra totales, tabla de doce meses, categorías y patrimonio', async () => {
    conParametros({ vista: 'anio', anio: String(ANIO) });
    await pintar(<Analisis />);
    await screen.findByTestId('totales-del-anio');
    const delAnio = (await repos.movimientos.listar()).filter(
      (m) => m.fecha.startsWith(String(ANIO)) && m.tipo === 'gasto',
    );
    const gastos = delAnio.reduce((s, m) => s + m.importe, 0);
    expect(screen.getByTestId('gastos-del-anio')).toHaveTextContent(
      gastos === 138500 ? '-1.385,00 €' : '-365,00 €',
    );
    expect(screen.getByTestId('ingresos-del-anio')).toHaveTextContent('+2.000,00 €');
    expect(screen.getByTestId('tabla-del-anio')).toBeTruthy();
    for (let numero = 1; numero <= 12; numero++) {
      expect(screen.getByTestId(`fila-${ANIO}-${String(numero).padStart(2, '0')}`)).toBeTruthy();
    }
    expect(screen.getByTestId('gasto-del-anio')).toHaveTextContent(/Comida/);
    expect(screen.getByTestId('patrimonio-del-anio-cifra')).toHaveTextContent(/€/);

    await fireEvent.press(screen.getByTestId(`fila-${MES}`));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/',
      params: { mes: MES, peticion: 'anio-1' },
    });
  });

  it('un año sin movimientos y un año futuro explican el vacío', async () => {
    conParametros({ vista: 'anio', anio: String(ANIO + 3) });
    await pintar(<Analisis />);
    expect(await screen.findByTestId('anio-vacio')).toHaveTextContent(
      new RegExp(`${ANIO + 3} no tiene gastos ni ingresos`),
    );
    expect(screen.getByTestId('patrimonio-del-anio-vacio')).toBeTruthy();
    expect(screen.queryByTestId('tabla-del-anio')).toBeNull();
    await fireEvent.press(screen.getByTestId('anio-anterior'));
    expect(screen.getByTestId('anio-elegido')).toHaveTextContent(String(ANIO + 2));
  });

  it('el selector cambia entre las tres vistas', async () => {
    await pintar(<Analisis />);
    await screen.findByTestId('resumen-diario');
    await fireEvent.press(screen.getByTestId('segmento-mes'));
    expect(await screen.findByTestId('comparativa')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('segmento-anio'));
    expect(await screen.findByTestId('anio-elegido')).toHaveTextContent(String(ANIO));
  });
});

describe('Movimientos filtrado por día', () => {
  it('aplica el día pedido por la ruta y se puede quitar', async () => {
    conParametros({ dia: `${MES}-01`, peticion: 'dia-1' });
    await pintar(<Movimientos />);
    expect(await screen.findByText('Pan')).toBeTruthy();
    expect(screen.queryByText('Mercado de octubre')).toBeNull();
    await fireEvent.press(screen.getByTestId('filtro-dia'));
    await waitFor(() => expect(screen.queryByTestId('filtro-dia')).toBeNull());
  });

  it('ignora un día mal escrito', async () => {
    conParametros({ dia: '2026-02-31', peticion: 'dia-2' });
    await pintar(<Movimientos />);
    await screen.findByText('Sueldo');
    expect(screen.queryByTestId('filtro-dia')).toBeNull();
  });
});

describe('icono y color de una categoría', () => {
  it('se eligen de la paleta, se guardan y Automático vuelve al valor derivado', async () => {
    await pintar(<PantallaDeCategorias />);
    await fireEvent.press(await screen.findByTestId('aspecto-Comida'));
    await fireEvent.press(await screen.findByTestId('icono-☕'));
    await waitFor(async () => expect((await repos.categorias.obtener(comidaId))?.icono).toBe('☕'));
    await fireEvent.press(screen.getByTestId('color-3'));
    await waitFor(async () =>
      expect((await repos.categorias.obtener(comidaId))?.color).toBe('#E8590C'),
    );
    // Elegir el color no pierde el icono.
    expect((await repos.categorias.obtener(comidaId))?.icono).toBe('☕');
    expect(screen.getByTestId('color-3')).toBeSelected();

    await fireEvent.press(screen.getByTestId('icono-automatico'));
    await fireEvent.press(screen.getByTestId('color-automatico'));
    await waitFor(async () =>
      expect(await repos.categorias.obtener(comidaId)).toMatchObject({ icono: null, color: null }),
    );
  });
});

// `moverDias` y `crearBdDePrueba` se usan para comprobar que las utilidades siguen disponibles.
test('las utilidades de fechas y de base de datos de prueba existen', () => {
  expect(moverDias(HOY, 0)).toBe(HOY);
  expect(typeof crearBdDePrueba).toBe('function');
});
