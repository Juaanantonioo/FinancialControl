/**
 * Pruebas de la navegación (bloque B3b), con una base de datos real en
 * memoria: el botón de añadir en las cinco pestañas, la pantalla Ajustes, el
 * bloque «Pendiente», «Primeros pasos», cada «Ver todos», los datos que
 * salieron de Inicio y los enlaces de entrada.
 *
 * Los datos son de ejemplo y se colocan en el mes en curso.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentType, ReactElement } from 'react';

import Analisis from '@/app/(tabs)/analisis';
import Cuentas from '@/app/(tabs)/cuentas';
import Inicio from '@/app/(tabs)/index';
import Movimientos from '@/app/(tabs)/movimientos';
import Plan from '@/app/(tabs)/plan';
import Ajustes, { ACCESOS_DE_AJUSTES } from '@/app/ajustes';
import DetalleDeCuenta from '@/app/detalle-de-cuenta';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { resumenDeInversiones } from '@/dominio/inversion';
import { fechaLocal } from '@/dominio/modelo';
import { lineaDePrevision, previsionDeFinDeMes } from '@/dominio/prevision';
import { pendientesDelMes, porConfirmar, proximosCobros } from '@/dominio/recurrentes';
import { balanceDelMes, gastoPorCategoria, mesDe, moverMes } from '@/dominio/resumen';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { destinoDelAviso } from '@/estado/avisos';
import { ProveedorDeDatos } from '@/estado/Datos';
import { conSigno, importe } from '@/estado/formato';
import {
  AVISOS_EN_PENDIENTE,
  COBROS_EN_PENDIENTE,
  OBJETIVOS_EN_INICIO,
  primerosPasos,
  PROXIMOS_EN_INICIO,
  recortar,
} from '@/estado/inicio';
import { datosParaElWidget } from '@/estado/widget';
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
// Las piezas nativas no hacen falta aquí: solo se comprueban rutas y enlaces.
jest.mock('@/lib/notificaciones', () => ({
  PREFIJO: 'fc:',
  notificador: {},
  mostrarAvisosEnPrimerPlano: jest.fn(),
  alTocarUnAviso: jest.fn(),
}));
jest.mock('@/lib/preferencias', () => ({
  leerPreferencias: jest.fn(),
  guardarPreferencias: jest.fn(),
  interpretarPreferencias: jest.fn(),
}));
jest.mock('@/widgets/Disponible', () => ({
  __esModule: true,
  default: { updateSnapshot: jest.fn() },
}));
jest.mock('@/datos/bdExpo', () => {
  const { crearBdDePrueba } = jest.requireActual('@/pruebas/bdDePrueba');
  const bd = crearBdDePrueba();
  return { abrirBdExpo: async () => bd, bdCompartida: bd };
});

const HOY = fechaLocal();
const MES = mesDe();
const ANTERIOR = moverMes(MES, -1);
const PESTANAS: [string, ComponentType][] = [
  ['Inicio', Inicio],
  ['Movimientos', Movimientos],
  ['Análisis', Analisis],
  ['Plan', Plan],
  ['Cuentas', Cuentas],
];
const CATEGORIAS_DE_GASTO = ['Comida', 'Casa', 'Ocio', 'Ropa'];

let repos: Repositorios;
let bancoId: string;
let brokerId: string;
const cat: Record<string, string> = {};

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

/** Lo que las pantallas reciben de los repositorios, para calcular lo esperado con `src/dominio`. */
async function datos() {
  const cuentas = await repos.cuentas.listar({ incluirArchivadas: true });
  const movimientos = await repos.movimientos.listar();
  const categorias = await repos.categorias.listar({ incluirArchivadas: true });
  const reglas = await repos.reglas.listar();
  const valores = await repos.valores.listar();
  return { cuentas, movimientos, categorias, reglas, valores };
}

beforeAll(async () => {
  const { bdCompartida } = jest.requireMock('@/datos/bdExpo');
  repos = await prepararBaseDeDatos(bdCompartida, crearEntornoDePrueba(new Date().toISOString()), [
    ...CATEGORIAS_DE_GASTO.map((nombre) => ({ nombre, tipo: 'gasto' as const })),
    { nombre: 'Nómina', tipo: 'ingreso' as const },
  ]);
  for (const c of await repos.categorias.listar()) cat[c.nombre] = c.id;
});

beforeEach(() => {
  jest.clearAllMocks();
  conParametros({});
});

// ------------------------------------------------------------ reglas puras

describe('reglas de presentación de Inicio', () => {
  it('recortar deja los primeros y cuenta los que no caben', () => {
    expect(recortar([1, 2, 3, 4, 5], 3)).toEqual({ visibles: [1, 2, 3], ocultos: 2 });
    expect(recortar([1, 2], 3)).toEqual({ visibles: [1, 2], ocultos: 0 });
    expect(recortar([], 3)).toEqual({ visibles: [], ocultos: 0 });
  });

  it('primeros pasos: cada paso se deduce de un dato y se completa con los tres', () => {
    const nada = primerosPasos({ hayCuenta: false, hayMovimiento: false, hayPresupuesto: false });
    expect(nada.pasos.map((p) => p.hecho)).toEqual([false, false, false]);
    expect(nada).toMatchObject({ hechos: 0, completos: false });
    const uno = primerosPasos({ hayCuenta: true, hayMovimiento: false, hayPresupuesto: false });
    expect(uno.pasos).toEqual([
      { paso: 'cuenta', hecho: true },
      { paso: 'movimiento', hecho: false },
      { paso: 'presupuesto', hecho: false },
    ]);
    const dos = primerosPasos({ hayCuenta: true, hayMovimiento: true, hayPresupuesto: false });
    expect(dos).toMatchObject({ hechos: 2, completos: false });
    const todo = primerosPasos({ hayCuenta: true, hayMovimiento: true, hayPresupuesto: true });
    expect(todo).toMatchObject({ hechos: 3, completos: true });
  });
});

// ---------------------------------------------- app recién instalada y pasos

describe('Primeros pasos, desde la app recién instalada', () => {
  it('sin datos: los tres pasos pendientes, estados vacíos con texto y nada pendiente', async () => {
    await pintar(<Inicio />);
    const tarjeta = await screen.findByTestId('bloque-primeros-pasos');
    expect(tarjeta).toHaveTextContent(/Primeros pasos/);
    expect(screen.getByTestId('pasos-hechos')).toHaveTextContent('0 de 3 hechos');
    for (const paso of ['cuenta', 'movimiento', 'presupuesto']) {
      expect(screen.getByTestId(`paso-${paso}`)).toHaveTextContent(/Pendiente/);
      expect(screen.getByTestId(`paso-${paso}`)).not.toBeDisabled();
    }
    // Nada pendiente: el bloque no existe.
    expect(screen.queryByTestId('bloque-pendiente')).toBeNull();
    // Cada bloque vacío dice qué falta; ninguno queda en blanco.
    expect(screen.getByTestId('patrimonio-total')).toHaveTextContent('0,00 €');
    expect(screen.getByTestId('disponible-vacio')).toHaveTextContent(/Crea tu presupuesto/);
    expect(screen.getByTestId('proximos-sin-fijos')).toHaveTextContent(/gastos fijos/);
    expect(screen.getByTestId('frase-del-mes')).toHaveTextContent(/no tiene ingresos ni gastos/);
    expect(screen.getByTestId('objetivos-vacio')).toHaveTextContent(/objetivo/);

    await fireEvent.press(screen.getByTestId('paso-cuenta'));
    expect(router.push).toHaveBeenLastCalledWith('/cuenta');
    await fireEvent.press(screen.getByTestId('paso-movimiento'));
    expect(router.push).toHaveBeenLastCalledWith('/movimiento');
    await fireEvent.press(screen.getByTestId('paso-presupuesto'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/presupuesto',
      params: { mes: MES },
    });
  });

  it('Inicio tiene siete bloques como mucho, en el orden acordado', async () => {
    await pintar(<Inicio />);
    await screen.findByTestId('bloque-primeros-pasos');
    const orden = [
      'patrimonio',
      'bloque-disponible',
      'bloque-pendiente',
      'bloque-proximos',
      'bloque-balance',
      'bloque-objetivos',
      'bloque-primeros-pasos',
    ];
    const pintados = screen
      .getAllByTestId(/^(patrimonio$|bloque-)/)
      .map((nodo) => nodo.props.testID as string);
    const sinRepetir = [...new Set(pintados)];
    expect(sinRepetir.length).toBeLessThanOrEqual(7);
    expect(sinRepetir).toEqual(orden.filter((id) => sinRepetir.includes(id)));
    // Los bloques que salieron de Inicio ya no están.
    for (const id of ['bloque-cuentas', 'bloque-gasto', 'bloque-evolucion', 'bloque-fin-de-mes']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('con cuenta y sin movimientos marca el primer paso', async () => {
    const banco = await repos.cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      saldoInicial: 300000,
      fechaSaldoInicial: `${ANTERIOR}-01`,
    });
    bancoId = banco.id;
    await pintar(<Inicio />);
    await waitFor(() =>
      expect(screen.getByTestId('pasos-hechos')).toHaveTextContent('1 de 3 hechos'),
    );
    expect(screen.getByTestId('paso-cuenta')).toHaveTextContent(/Hecho/);
    expect(screen.getByTestId('paso-cuenta')).toBeDisabled();
    expect(screen.getByTestId('paso-movimiento')).toHaveTextContent(/Pendiente/);
  });

  it('con movimientos y sin presupuesto marca los dos primeros', async () => {
    await repos.movimientos.crear({
      tipo: 'ingreso',
      fecha: `${MES}-01`,
      importe: 200000,
      cuentaId: bancoId,
      categoriaId: cat['Nómina'],
      nombre: 'Sueldo',
    });
    await pintar(<Inicio />);
    await waitFor(() =>
      expect(screen.getByTestId('pasos-hechos')).toHaveTextContent('2 de 3 hechos'),
    );
    expect(screen.getByTestId('paso-movimiento')).toHaveTextContent(/Hecho/);
    expect(screen.getByTestId('paso-presupuesto')).toHaveTextContent(/Pendiente/);
  });

  it('con los tres hechos la tarjeta desaparece, aunque el presupuesto sea de otro mes', async () => {
    expect(await repos.presupuestos.hayAlguno()).toBe(false);
    await repos.presupuestos.guardar(ANTERIOR, [{ categoriaId: cat.Comida, importe: 10000 }]);
    expect(await repos.presupuestos.hayAlguno()).toBe(true);
    await pintar(<Inicio />);
    await screen.findByTestId('bloque-objetivos');
    await waitFor(() => expect(screen.queryByTestId('bloque-primeros-pasos')).toBeNull());
    // Con cuenta, movimiento y presupuesto, y nada vencido, «Pendiente» sigue sin aparecer.
    expect(screen.queryByTestId('bloque-pendiente')).toBeNull();
  });

  it('un presupuesto borrado deja de contar', async () => {
    await repos.presupuestos.borrar(ANTERIOR);
    expect(await repos.presupuestos.hayAlguno()).toBe(false);
  });
});

// ------------------------------------------------- acción global de añadir

describe('añadir un movimiento es igual en las cinco pestañas', () => {
  it.each(PESTANAS)('%s: un solo «+», abajo, que abre el alta con un toque', async (_, Pestana) => {
    await pintar(<Pestana />);
    const boton = await screen.findByTestId('boton-anadir');
    expect(boton.props.accessibilityLabel).toBe('Añadir movimiento');
    expect(boton.props.accessibilityRole).toBe('button');
    // El «+» a solas no significa otra cosa en la pantalla.
    expect(screen.getAllByText('+')).toHaveLength(1);
    expect(within(boton).getByText('+')).toBeTruthy();
    // Va fijo abajo a la derecha y mide más de 44 puntos.
    const estilo = Object.assign({}, ...[boton.props.style].flat(3));
    expect(estilo.position).toBe('absolute');
    expect(estilo.bottom).toBeGreaterThan(0);
    expect(estilo.right).toBeGreaterThan(0);
    expect(estilo.width).toBeGreaterThanOrEqual(44);
    expect(estilo.height).toBeGreaterThanOrEqual(44);

    await fireEvent.press(boton);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/movimiento');
  });

  it('Plan no tiene otro «+» en ninguna de sus secciones', async () => {
    await pintar(<Plan />);
    for (const seccion of ['presupuesto', 'fijos', 'objetivos']) {
      await fireEvent.press(await screen.findByTestId(`segmento-${seccion}`));
      expect(screen.getAllByText('+')).toHaveLength(1);
    }
  });

  it('las demás altas usan un botón con texto dentro de su sección', async () => {
    const cuentas = await pintar(<Cuentas />);
    const nuevaCuenta = await screen.findByTestId('nueva-cuenta');
    expect(nuevaCuenta).toHaveTextContent('Nueva cuenta');
    await fireEvent.press(nuevaCuenta);
    expect(router.push).toHaveBeenLastCalledWith('/cuenta');
    await cuentas.unmount();

    await repos.reglas.crear({
      nombre: 'Gimnasio',
      clase: 'suscripcion',
      importe: 3000,
      cuentaId: bancoId,
      categoriaId: cat.Ocio,
      periodicidad: 'mensual',
      diaDelMes: 1,
      fechaInicio: `${ANTERIOR}-01`,
    });
    await repos.objetivos.crear({ nombre: 'Viaje', tipo: 'ahorro', meta: 100000 });
    await pintar(<Plan />);
    await fireEvent.press(await screen.findByTestId('segmento-fijos'));
    const nuevoFijo = await screen.findByTestId('nuevo-fijo');
    expect(nuevoFijo).toHaveTextContent('Nuevo gasto fijo');
    await fireEvent.press(nuevoFijo);
    expect(router.push).toHaveBeenLastCalledWith('/regla');

    await fireEvent.press(screen.getByTestId('segmento-objetivos'));
    const nuevoObjetivo = await screen.findByTestId('nuevo-objetivo');
    expect(nuevoObjetivo).toHaveTextContent('Nuevo objetivo');
    await fireEvent.press(nuevoObjetivo);
    expect(router.push).toHaveBeenLastCalledWith('/objetivo-editar');
  });
});

// ------------------------------------------------------------------ Ajustes

describe('Ajustes', () => {
  it('se abre con el engranaje de Inicio, que tiene etiqueta y 44 puntos', async () => {
    await pintar(<Inicio />);
    const engranaje = await screen.findByTestId('boton-ajustes');
    expect(engranaje.props.accessibilityLabel).toBe('Ajustes');
    const estilo = Object.assign({}, ...[engranaje.props.style].flat(3));
    expect(estilo.width).toBeGreaterThanOrEqual(44);
    expect(estilo.height).toBeGreaterThanOrEqual(44);
    await fireEvent.press(engranaje);
    expect(router.push).toHaveBeenCalledWith('/ajustes');
  });

  it('reúne sus cuatro accesos, cada uno con su ruta, y se puede volver', async () => {
    await pintar(<Ajustes />);
    expect(screen.getByTestId('titulo-de-pantalla')).toHaveTextContent('Ajustes');
    const esperados = [
      ['ajuste-categorias', 'Categorías', '/categorias'],
      ['ajuste-apple-pay', 'Apple Pay y tarjetas', '/apple-pay'],
      ['ajuste-avisos', 'Avisos', '/avisos'],
      ['ajuste-diagnostico', 'Diagnóstico', '/diagnostico'],
    ];
    expect(ACCESOS_DE_AJUSTES.map((a) => a.testID)).toEqual(esperados.map((e) => e[0]));
    for (const [testID, texto, ruta] of esperados) {
      const fila = screen.getByTestId(testID);
      expect(fila).toHaveTextContent(new RegExp(texto));
      expect(fila.props.accessibilityLabel).toMatch(new RegExp(`^${texto}\\. `));
      await fireEvent.press(fila);
      expect(router.push).toHaveBeenLastCalledWith(ruta);
    }
    await fireEvent.press(screen.getByTestId('volver'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('esos accesos ya no están al pie de Cuentas', async () => {
    await pintar(<Cuentas />);
    await screen.findByTestId('cuenta-Banco');
    for (const acceso of ACCESOS_DE_AJUSTES) {
      expect(screen.queryByTestId(acceso.testID)).toBeNull();
    }
    expect(screen.queryByText('Ajustes')).toBeNull();
  });
});

// ------------------------------------- Inicio con mucho pendiente y Ver todos

describe('Inicio con datos', () => {
  beforeAll(async () => {
    const broker = await repos.cuentas.crear({
      nombre: 'Bróker',
      tipo: 'inversion',
      saldoInicial: 0,
      fechaSaldoInicial: `${ANTERIOR}-01`,
    });
    brokerId = broker.id;
    await repos.movimientos.crear({
      tipo: 'transferencia',
      fecha: `${MES}-01`,
      importe: 100000,
      cuentaId: bancoId,
      cuentaDestinoId: brokerId,
    });
    await repos.valores.registrar({ cuentaId: brokerId, fecha: HOY, valor: 112000 });
    // Un gasto por categoría, todos por encima de lo presupuestado.
    for (const [i, nombre] of CATEGORIAS_DE_GASTO.entries()) {
      await repos.movimientos.crear({
        tipo: 'gasto',
        fecha: `${MES}-01`,
        importe: 10000 + i * 1000,
        cuentaId: bancoId,
        categoriaId: cat[nombre],
        nombre: `Compra de ${nombre}`,
      });
    }
    await repos.presupuestos.guardar(
      MES,
      CATEGORIAS_DE_GASTO.map((nombre) => ({ categoriaId: cat[nombre], importe: 5000 })),
    );
    // Cinco gastos fijos con el día ya vencido (con «Gimnasio», creado antes).
    for (const nombre of ['Luz', 'Agua', 'Fibra', 'Seguro']) {
      await repos.reglas.crear({
        nombre,
        clase: 'suscripcion',
        importe: 2500,
        cuentaId: bancoId,
        categoriaId: cat.Casa,
        periodicidad: 'mensual',
        diaDelMes: 1,
        fechaInicio: `${MES}-01`,
      });
    }
    // Doce pagos capturados sin revisar, con importes distintos para que no sean duplicados.
    for (let i = 1; i <= 12; i++) {
      await repos.capturas.registrar({
        origen: 'transaccion',
        importeTexto: `${i},50 €`,
        comercioTexto: `Tienda ${i}`,
      });
    }
    for (const nombre of ['Colchón', 'Bici']) {
      await repos.objetivos.crear({ nombre, tipo: 'ahorro', meta: 50000 });
    }
  });

  it('«Pendiente» reúne cobros, pagos y avisos, sin crecer sin límite', async () => {
    const { movimientos, reglas } = await datos();
    const vencidos = porConfirmar(reglas, movimientos, HOY);
    expect(vencidos.length).toBeGreaterThanOrEqual(5);
    const porRevisar = await repos.capturas.contarPendientes();
    expect(porRevisar).toBe(12);

    await pintar(<Inicio />);
    const bloque = await screen.findByTestId('bloque-pendiente');
    expect(bloque).toHaveTextContent(/Pendiente/);

    // Cobros: tres como mucho y el resto tras «Ver todos».
    const cobros = within(screen.getByTestId('bloque-por-confirmar'));
    expect(cobros.getAllByTestId(/^cobro-/)).toHaveLength(COBROS_EN_PENDIENTE);
    expect(cobros.getAllByTestId(/^confirmar-/)).toHaveLength(COBROS_EN_PENDIENTE);
    expect(screen.getByTestId('ver-por-confirmar')).toHaveTextContent(
      `Ver todos (${vencidos.length - COBROS_EN_PENDIENTE} más)`,
    );

    // Pagos: una sola fila con el total, sean los que sean.
    expect(screen.getByTestId('bloque-capturas')).toHaveTextContent(/Pagos por revisar: 12/);

    // Avisos de presupuesto: tres como mucho y cuántos quedan.
    const avisos = screen.getByTestId('aviso-de-presupuesto');
    expect(within(avisos).getAllByText(/te has pasado/)).toHaveLength(AVISOS_EN_PENDIENTE);
    expect(screen.getByTestId('ver-presupuesto')).toHaveTextContent('Ver presupuesto (1 más)');
  });

  it('cada parte de «Pendiente» conserva su acción directa', async () => {
    const { movimientos, reglas } = await datos();
    const primero = porConfirmar(reglas, movimientos, HOY)[0];
    await pintar(<Inicio />);
    await screen.findByTestId('bloque-pendiente');

    await fireEvent.press(screen.getByTestId('bloque-capturas'));
    expect(router.push).toHaveBeenLastCalledWith('/capturas');

    await fireEvent.press(screen.getByTestId('ver-presupuesto'));
    expect(router.navigate).toHaveBeenLastCalledWith({
      pathname: '/plan',
      params: { seccion: 'presupuesto', mes: MES, peticion: expect.any(String) },
    });

    await fireEvent.press(screen.getByTestId('ver-por-confirmar'));
    expect(router.navigate).toHaveBeenLastCalledWith({
      pathname: '/plan',
      params: { seccion: 'fijos', mes: MES, peticion: expect.any(String) },
    });

    await fireEvent.press(screen.getByTestId(`cobro-${primero.regla.nombre}-${primero.fecha}`));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/cobro',
      params: { reglaId: primero.regla.id, mes: primero.mes },
    });

    // Confirmar con un toque crea el movimiento y el cobro deja de estar pendiente.
    const antes = (await repos.movimientos.listar()).length;
    await fireEvent.press(screen.getByTestId(`confirmar-${primero.regla.nombre}-${primero.fecha}`));
    await waitFor(async () => expect((await repos.movimientos.listar()).length).toBe(antes + 1));
    await waitFor(() =>
      expect(screen.queryByTestId(`confirmar-${primero.regla.nombre}-${primero.fecha}`)).toBeNull(),
    );
  });

  it('próximos cobros: tres como mucho y «Ver todos» lleva a Plan › Fijos', async () => {
    for (const [i, nombre] of ['Música', 'Series', 'Nube', 'Prensa'].entries()) {
      const fecha = moverDiasDe(HOY, i + 1);
      await repos.reglas.crear({
        nombre,
        clase: 'suscripcion',
        importe: 999,
        cuentaId: bancoId,
        categoriaId: cat.Ocio,
        periodicidad: 'mensual',
        diaDelMes: Number(fecha.slice(8, 10)),
        fechaInicio: fecha,
      });
    }
    const { movimientos, reglas } = await datos();
    const proximos = proximosCobros(reglas, movimientos, HOY);
    expect(proximos.length).toBeGreaterThan(PROXIMOS_EN_INICIO);

    await pintar(<Inicio />);
    const bloque = within(await screen.findByTestId('bloque-proximos'));
    await waitFor(() => expect(bloque.getAllByTestId(/^cobro-/)).toHaveLength(PROXIMOS_EN_INICIO));
    expect(screen.getByTestId('ver-proximos')).toHaveTextContent(
      `Ver todos (${proximos.length - PROXIMOS_EN_INICIO} más)`,
    );
    await fireEvent.press(screen.getByTestId('ver-proximos'));
    expect(router.navigate).toHaveBeenLastCalledWith({
      pathname: '/plan',
      params: { seccion: 'fijos', mes: MES, peticion: expect.any(String) },
    });
  });

  it('objetivos: dos como mucho y «Ver todos» lleva a Plan › Objetivos', async () => {
    await pintar(<Inicio />);
    const bloque = within(await screen.findByTestId('bloque-objetivos'));
    expect(bloque.getAllByTestId(/^objetivo-/)).toHaveLength(OBJETIVOS_EN_INICIO);
    expect(screen.getByTestId('ver-objetivos')).toHaveTextContent('Ver todos (1 más)');
    await fireEvent.press(screen.getByTestId('ver-objetivos'));
    expect(router.navigate).toHaveBeenLastCalledWith({
      pathname: '/plan',
      params: { seccion: 'objetivos', peticion: expect.any(String) },
    });
  });

  it('«Este mes» lleva a Análisis › Mes y cada salto lleva una petición distinta', async () => {
    await pintar(<Inicio />);
    await fireEvent.press(await screen.findByTestId('ver-analisis'));
    await fireEvent.press(screen.getByTestId('ver-analisis'));
    const llamadas = (router.navigate as jest.Mock).mock.calls.map((c) => c[0]);
    expect(llamadas).toHaveLength(2);
    for (const llamada of llamadas) {
      expect(llamada).toEqual({
        pathname: '/analisis',
        params: { vista: 'mes', mes: MES, peticion: expect.any(String) },
      });
    }
    expect(llamadas[0].params.peticion).not.toBe(llamadas[1].params.peticion);
  });

  // ---------------------------------------- datos que salieron de Inicio

  it('«Este mes» de Inicio y el balance de Análisis › Mes dan la misma cifra', async () => {
    const { movimientos } = await datos();
    const balance = balanceDelMes(movimientos, MES);
    const inicio = await pintar(<Inicio />);
    await waitFor(() =>
      expect(screen.getByTestId('balance-del-mes')).toHaveTextContent(
        conSigno(balance.balance, 'EUR'),
      ),
    );
    expect(screen.getByTestId('ingresos-del-mes')).toHaveTextContent(
      conSigno(balance.ingresos, 'EUR'),
    );
    expect(screen.getByTestId('gastos-del-mes')).toHaveTextContent(
      conSigno(-balance.gastos, 'EUR'),
    );
    await inicio.unmount();

    conParametros({ vista: 'mes' });
    await pintar(<Analisis />);
    await waitFor(() =>
      expect(screen.getByTestId('balance-del-mes')).toHaveTextContent(
        conSigno(balance.balance, 'EUR'),
      ),
    );
    expect(screen.getByTestId('gastos-del-mes')).toHaveTextContent(
      conSigno(-balance.gastos, 'EUR'),
    );
  });

  it('el gasto por categoría está en Análisis › Mes con el total del dominio', async () => {
    const { movimientos, categorias } = await datos();
    const gasto = gastoPorCategoria(movimientos, categorias, MES);
    conParametros({ vista: 'mes' });
    await pintar(<Analisis />);
    await waitFor(() =>
      expect(screen.getByTestId('gasto-total')).toHaveTextContent(importe(gasto.total, 'EUR')),
    );
    for (const nombre of CATEGORIAS_DE_GASTO) {
      expect(screen.getByTestId(`parte-${nombre}`)).toBeTruthy();
    }
    // La evolución de seis meses sigue en la misma vista.
    expect(screen.getByTestId('bloque-evolucion')).toBeTruthy();
    expect(screen.getByTestId('grafico-barras')).toBeTruthy();
  });

  it('el fin de mes previsto está en Plan › Presupuesto con la cifra del dominio', async () => {
    const { cuentas, movimientos, reglas } = await datos();
    const pendientes = pendientesDelMes(reglas, movimientos, MES, HOY);
    const prevision = previsionDeFinDeMes(cuentas, movimientos, pendientes, HOY);
    expect(lineaDePrevision(cuentas, movimientos, prevision.previsto, HOY).real.length).toBe(
      Number(HOY.slice(8, 10)),
    );
    await pintar(<Plan />);
    await waitFor(() =>
      expect(screen.getByTestId('fin-de-mes-previsto')).toHaveTextContent(
        importe(prevision.previsto, 'EUR'),
      ),
    );
    // Habla de hoy: al mirar otro mes deja de mostrarse.
    await fireEvent.press(screen.getByTestId('mes-anterior'));
    await waitFor(() => expect(screen.queryByTestId('bloque-fin-de-mes')).toBeNull());
  });

  it('Cuentas reúne el total, las cuentas y las inversiones con su ganancia', async () => {
    const { cuentas, movimientos, valores } = await datos();
    const total = resumenDeInversiones(
      cuentas.filter((x) => x.tipo === 'inversion'),
      movimientos,
      valores,
      HOY,
    );
    await pintar(<Cuentas />);
    const seccion = within(await screen.findByTestId('seccion-inversiones'));
    expect(seccion.getByTestId('inversiones-aportado')).toHaveTextContent(
      importe(total.aportado, 'EUR'),
    );
    expect(seccion.getByTestId('inversiones-valor')).toHaveTextContent(importe(total.valor, 'EUR'));
    expect(seccion.getByTestId('inversiones-ganancia')).toHaveTextContent(/Ganas 120,00 €/);
    expect(seccion.getByTestId('saldo-Bróker')).toHaveTextContent('1.120,00 €');
    // La inversión no se repite entre las cuentas de banco.
    expect(screen.getAllByTestId('cuenta-Bróker')).toHaveLength(1);

    await fireEvent.press(seccion.getByTestId('abrir-inversiones'));
    expect(router.push).toHaveBeenLastCalledWith('/inversiones');
    await fireEvent.press(screen.getByTestId('abrir-patrimonio'));
    expect(router.push).toHaveBeenLastCalledWith('/patrimonio');
    expect(screen.getByTestId('ver-evolucion')).toHaveTextContent(/Ver evolución/);
  });
});

// --------------------------------------------------------- enlaces de entrada

describe('enlaces de entrada', () => {
  const existe = (ruta: string) =>
    existsSync(join(__dirname, '../../app', `${ruta}.tsx`)) ||
    existsSync(join(__dirname, '../../app/(tabs)', `${ruta === '/' ? '/index' : ruta}.tsx`));

  it('las rutas de siempre siguen existiendo', () => {
    for (const ruta of [
      '/',
      '/movimientos',
      '/analisis',
      '/plan',
      '/cuentas',
      '/movimiento',
      '/inversiones',
      '/patrimonio',
      '/capturas',
      '/avisos',
      '/apple-pay',
      '/categorias',
      '/diagnostico',
      '/detalle-de-cuenta',
      '/ajustes',
    ]) {
      expect([ruta, existe(ruta)]).toEqual([ruta, true]);
    }
  });

  it('las pestañas son la base de la pila: un enlace con la app cerrada se abre sobre ellas', () => {
    // Importar la raíz arrastra los módulos nativos; basta con comprobar lo que declara.
    const raiz = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');
    expect(raiz).toMatch(/export const unstable_settings = \{ anchor: '\(tabs\)' \};/);
    expect(raiz).toMatch(/name="movimiento" options=\{\{ presentation: 'modal'/);
  });

  it('el widget sigue abriendo Inicio y el alta de movimiento', async () => {
    const paraElWidget = JSON.stringify(await datosParaElWidget(repos, HOY));
    expect(paraElWidget).toContain('financialcontrol://movimiento');
    expect(paraElWidget).toContain('"financialcontrol://"');
  });

  it('cada tipo de aviso abre una pantalla que existe', () => {
    const destinos = [
      destinoDelAviso({
        ruta: '/plan',
        parametros: JSON.stringify({ seccion: 'fijos', mes: MES }),
      }),
      destinoDelAviso({
        ruta: '/plan',
        parametros: JSON.stringify({ seccion: 'presupuesto', mes: MES }),
      }),
      destinoDelAviso({ ruta: '/capturas' }),
      destinoDelAviso({ capturaId: 'cola-1' }),
      destinoDelAviso({ ruta: '/detalle-de-cuenta', parametros: JSON.stringify({ id: 'x' }) }),
    ];
    expect(destinos.map((d) => d?.pathname)).toEqual([
      '/plan',
      '/plan',
      '/capturas',
      '/capturas',
      '/detalle-de-cuenta',
    ]);
    for (const destino of destinos) expect(existe(destino!.pathname)).toBe(true);
    expect(destinos[0]?.params).toEqual({ seccion: 'fijos', mes: MES });
  });

  it('Plan abre la sección y el mes pedidos, y repite la misma petición si cambia su marca', async () => {
    conParametros({ seccion: 'fijos', mes: MES });
    const plan = await pintar(<Plan />);
    expect(await screen.findByTestId('total-de-fijos')).toBeTruthy();
    // La persona cambia de sección a mano…
    await fireEvent.press(screen.getByTestId('segmento-objetivos'));
    expect(await screen.findByTestId('lista-de-objetivos')).toBeTruthy();
    // …y un «Ver todos» vuelve a pedir Fijos, con otra marca.
    conParametros({ seccion: 'fijos', mes: MES, peticion: 'ir-99' });
    await plan.rerender(
      <ProveedorDeDatos>
        <ProveedorDeAvisos>
          <Plan />
        </ProveedorDeAvisos>
      </ProveedorDeDatos>,
    );
    expect(await screen.findByTestId('total-de-fijos')).toBeTruthy();
  });

  it('Plan con seccion=presupuesto y un mes abre ese mes', async () => {
    conParametros({ seccion: 'presupuesto', mes: ANTERIOR });
    await pintar(<Plan />);
    expect(await screen.findByTestId('presupuesto-vacio')).toBeTruthy();
    expect(screen.getByTestId('mes-elegido')).toBeTruthy();
  });

  it.each(['dia', 'mes', 'anio'])('Análisis abre la vista «%s» pedida', async (vista) => {
    conParametros({ vista });
    await pintar(<Analisis />);
    const marca = { dia: 'resumen-diario', mes: 'comparativa', anio: 'tabla-del-anio' }[vista]!;
    expect(await screen.findByTestId(marca)).toBeTruthy();
  });
});

// ------------------------------------------------------------ tabla de toques

describe('toques desde Inicio hasta cada tarea frecuente', () => {
  let toques = 0;
  let pantalla: Awaited<ReturnType<typeof render>> | undefined;

  /** Cambiar de pestaña o abrir una pantalla cuenta como un toque en el recorrido real. */
  async function abrir(elemento: ReactElement, cuenta: 0 | 1) {
    if (pantalla) await pantalla.unmount();
    toques += cuenta;
    pantalla = await pintar(elemento);
  }

  async function tocar(testID: string | RegExp) {
    toques += 1;
    await fireEvent.press(await screen.findByTestId(testID));
  }

  beforeEach(() => {
    toques = 0;
    pantalla = undefined;
  });

  it.each(PESTANAS)('anotar un gasto desde %s: 1 toque', async (_, Pestana) => {
    await abrir(<Pestana />, 0);
    await tocar('boton-anadir');
    expect(router.push).toHaveBeenLastCalledWith('/movimiento');
    expect(toques).toBe(1);
  });

  it('abrir la bandeja con pagos por revisar: 1 toque', async () => {
    await abrir(<Inicio />, 0);
    await tocar('bloque-capturas');
    expect(router.push).toHaveBeenLastCalledWith('/capturas');
    expect(toques).toBe(1);
  });

  it('abrir la bandeja por el camino fijo (Movimientos): 2 toques', async () => {
    await abrir(<Movimientos />, 1);
    await tocar('abrir-bandeja');
    expect(router.push).toHaveBeenLastCalledWith('/capturas');
    expect(toques).toBe(2);
  });

  it('confirmar un cobro pendiente: 1 toque', async () => {
    const antes = (await repos.movimientos.listar()).length;
    await abrir(<Inicio />, 0);
    await screen.findByTestId('bloque-por-confirmar');
    toques += 1;
    await fireEvent.press(screen.getAllByTestId(/^confirmar-/)[0]);
    await waitFor(async () => expect((await repos.movimientos.listar()).length).toBe(antes + 1));
    expect(toques).toBe(1);
  });

  it('abrir Ajustes › Avisos: 2 toques', async () => {
    await abrir(<Inicio />, 0);
    await tocar('boton-ajustes');
    expect(router.push).toHaveBeenLastCalledWith('/ajustes');
    await abrir(<Ajustes />, 0);
    await tocar('ajuste-avisos');
    expect(router.push).toHaveBeenLastCalledWith('/avisos');
    expect(toques).toBe(2);
  });

  it('actualizar el valor de una inversión: 3 toques hasta el formulario', async () => {
    await abrir(<Cuentas />, 1);
    await tocar('cuenta-Bróker');
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/detalle-de-cuenta',
      params: { id: brokerId },
    });
    conParametros({ id: brokerId });
    await abrir(<DetalleDeCuenta />, 0);
    await tocar('actualizar-valor');
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/valor-de-inversion',
      params: { cuentaId: brokerId },
    });
    expect(toques).toBe(3);
  });

  it('ver el presupuesto del mes: 1 toque', async () => {
    await abrir(<Plan />, 1);
    expect(await screen.findByTestId('resumen-de-presupuesto')).toBeTruthy();
    expect(toques).toBe(1);
  });

  it('ver la evolución del patrimonio: 1 toque desde Inicio y 2 desde Cuentas', async () => {
    await abrir(<Inicio />, 0);
    await tocar('patrimonio');
    expect(router.push).toHaveBeenLastCalledWith('/patrimonio');
    expect(toques).toBe(1);

    toques = 0;
    await abrir(<Cuentas />, 1);
    await tocar('abrir-patrimonio');
    expect(router.push).toHaveBeenLastCalledWith('/patrimonio');
    expect(toques).toBe(2);
  });
});

/** Día `dias` después de `fecha`, sin pasar por la hora local. */
function moverDiasDe(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d + dias));
  return dia.toISOString().slice(0, 10);
}
