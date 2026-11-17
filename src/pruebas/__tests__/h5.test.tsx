/**
 * Pruebas de las pantallas de H5 (planificación) con una base de datos real
 * en memoria: pestaña Plan, presupuesto, fijos, confirmación de cobros,
 * objetivos y los bloques nuevos de Inicio.
 *
 * Los datos son de ejemplo y se colocan en fechas relativas a hoy.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import Analisis from '@/app/(tabs)/analisis';
import Cuentas from '@/app/(tabs)/cuentas';
import Inicio from '@/app/(tabs)/index';
import Plan from '@/app/(tabs)/plan';
import PantallaDeAportacion from '@/app/aportacion';
import PantallaDeCobro from '@/app/cobro';
import PantallaDeObjetivo from '@/app/objetivo';
import PantallaDeObjetivoEditar from '@/app/objetivo-editar';
import PantallaDePresupuesto from '@/app/presupuesto';
import PantallaDeRegla from '@/app/regla';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { fechaLocal } from '@/dominio/modelo';
import { estadoDeObjetivo } from '@/dominio/objetivos';
import { finDeMes } from '@/dominio/patrimonio';
import { disponibleDelMes, estadoDelPresupuesto } from '@/dominio/presupuesto';
import { previsionDeFinDeMes } from '@/dominio/prevision';
import { fijosPendientes, pendientesDelMes, sumarDias } from '@/dominio/recurrentes';
import { mesDe, moverMes } from '@/dominio/resumen';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { ProveedorDeDatos } from '@/estado/Datos';
import { describirMes } from '@/estado/fechas';
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
const MES = mesDe();
const ANTERIOR = moverMes(MES, -1);
const SIGUIENTE = moverMes(MES, 1);
const DIA_DE_HOY = Number(HOY.slice(8, 10));
/** El importe con el espacio de no separación que usa la app. */
const euros = (centimos: number) => importe(centimos, 'EUR');

let repos: Repositorios;
let bancoId: string;
let ahorroId: string;
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
async function pulsarTeclas(...teclas: string[]) {
  for (const tecla of teclas) await fireEvent.press(screen.getByTestId(`tecla-${tecla}`));
}
/** Lleva el selector de día del formulario hasta el día pedido. */
async function ponerDia(objetivo: number, actual: number) {
  for (let d = actual; d < objetivo; d++) await fireEvent.press(screen.getByTestId('dia-mas'));
  for (let d = actual; d > objetivo; d--) await fireEvent.press(screen.getByTestId('dia-menos'));
}
const gasto = (fecha: string, centimos: number, categoria: string, nombre: string) =>
  repos.movimientos.crear({
    tipo: 'gasto',
    fecha,
    importe: centimos,
    cuentaId: bancoId,
    categoriaId: cat[categoria],
    nombre,
  });

beforeAll(async () => {
  const { bdCompartida } = jest.requireMock('@/datos/bdExpo');
  // El reloj de la base de datos es el real: las pantallas usan «hoy».
  const entorno = {
    generarId: () => jest.requireActual('node:crypto').randomUUID() as string,
    ahora: () => new Date(),
  };
  repos = await prepararBaseDeDatos(bdCompartida, entorno, [
    { nombre: 'Casa', tipo: 'gasto' },
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Ocio', tipo: 'gasto' },
    { nombre: 'Nómina', tipo: 'ingreso' },
  ]);
  for (const c of await repos.categorias.listar()) cat[c.nombre] = c.id;
  avisos = jest.spyOn(console, 'warn');
  errores = jest.spyOn(console, 'error');
});

/** Fija el tamaño de letra del sistema (1 es el normal). */
function conEscalaDeLetra(fontScale: number) {
  const dimensiones = jest.requireActual('react-native').Dimensions;
  dimensiones.set({ window: { ...dimensiones.get('window'), fontScale } });
}

beforeEach(() => {
  jest.clearAllMocks();
  conParametros({});
  conEscalaDeLetra(1);
});

afterAll(() => {
  // Ninguna pantalla debe dejar avisos ni errores en la consola.
  expect(avisos.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([]);
  expect(errores.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([]);
});

describe('base de datos vacía', () => {
  it('Plan muestra el estado vacío de sus tres secciones, con su acceso', async () => {
    await pintar(<Plan />);
    const vacio = await screen.findByTestId('presupuesto-vacio');
    expect(vacio).toHaveTextContent(new RegExp(`Crea tu presupuesto de ${describirMes(MES)}`));
    await fireEvent.press(screen.getByTestId('crear-presupuesto'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/presupuesto', params: { mes: MES } });

    await fireEvent.press(screen.getByTestId('segmento-fijos'));
    expect(await screen.findByTestId('fijos-vacio')).toHaveTextContent(/no tienes gastos fijos/);
    await fireEvent.press(screen.getByTestId('crear-fijo'));
    expect(router.push).toHaveBeenCalledWith('/regla');

    await fireEvent.press(screen.getByTestId('segmento-objetivos'));
    expect(await screen.findByTestId('objetivos-vacio')).toHaveTextContent(/no tienes objetivos/);
    await fireEvent.press(screen.getByTestId('crear-objetivo'));
    expect(router.push).toHaveBeenCalledWith('/objetivo-editar');
  });

  it('Inicio muestra el estado vacío de cada bloque nuevo, nunca un cero engañoso', async () => {
    const inicio = await pintar(<Inicio />);
    expect(await screen.findByTestId('disponible-vacio')).toHaveTextContent(/Crea tu presupuesto/);
    expect(screen.getByTestId('proximos-sin-fijos')).toHaveTextContent(/Añade tus gastos fijos/);
    expect(screen.getByTestId('objetivos-vacio')).toHaveTextContent(/Crea un objetivo/);
    expect(screen.queryByTestId('disponible')).toBeNull();
    expect(screen.queryByTestId('bloque-por-confirmar')).toBeNull();
    expect(screen.queryByTestId('aviso-de-presupuesto')).toBeNull();
    // Sin cuentas no se ofrece añadir un fijo: primero hace falta una cuenta.
    expect(screen.queryByTestId('anadir-fijo')).toBeNull();
    await inicio.unmount();

    // B3b: el fin de mes previsto pasa a Plan › Presupuesto.
    await pintar(<Plan />);
    expect(await screen.findByTestId('fin-de-mes-vacio')).toHaveTextContent(
      /cuenta de banco o efectivo/,
    );
    expect(screen.queryByTestId('fin-de-mes-previsto')).toBeNull();
  });

  it('el alta de un fijo sin cuentas explica que hace falta una', async () => {
    await pintar(<PantallaDeRegla />);
    expect(await screen.findByTestId('regla-sin-cuentas')).toHaveTextContent(
      /hace falta al menos una cuenta/,
    );
    expect(screen.getByTestId('guardar')).toBeDisabled();
  });
});

describe('presupuesto (P11 y P12)', () => {
  beforeAll(async () => {
    const inicio = `${moverMes(MES, -3)}-01`;
    const banco = await repos.cuentas.crear({
      nombre: 'Banco',
      tipo: 'banco',
      saldoInicial: 500000,
      fechaSaldoInicial: inicio,
    });
    const ahorro = await repos.cuentas.crear({
      nombre: 'Ahorro',
      tipo: 'banco',
      saldoInicial: 0,
      fechaSaldoInicial: inicio,
    });
    bancoId = banco.id;
    ahorroId = ahorro.id;
    // Tres meses de historia: Comida 300, 330 y 360 €; Casa 620 € cada mes; Ocio 90 € un mes.
    for (const [atras, comida] of [
      [3, 30000],
      [2, 33000],
      [1, 36000],
    ] as const) {
      const mes = moverMes(MES, -atras);
      await gasto(`${mes}-05`, comida, 'Comida', `Súper de hace ${atras}`);
      await gasto(`${mes}-01`, 62000, 'Casa', `Alquiler de hace ${atras}`);
    }
    await gasto(`${ANTERIOR}-10`, 9000, 'Ocio', 'Concierto');
  });

  it('con tres meses de datos, P12 propone la media por categoría y la guarda', async () => {
    conParametros({ mes: MES });
    await pintar(<PantallaDePresupuesto />);
    await waitFor(() => expect(screen.getByTestId('importe-Comida').props.value).toBe('330,00'));
    expect(screen.getByTestId('importe-Casa').props.value).toBe('620,00');
    expect(screen.getByTestId('importe-Ocio').props.value).toBe('30,00');
    expect(screen.getByTestId('total-presupuestado')).toHaveTextContent(euros(98000));
    expect(screen.getByTestId('nota-de-propuesta')).toHaveTextContent(/Te proponemos la media/);
    // No hay presupuesto del mes anterior: copiar está desactivado y lo explica.
    expect(screen.getByTestId('copiar-mes-anterior')).toBeDisabled();
    expect(screen.getByTestId('sin-mes-anterior')).toHaveTextContent(/No hay presupuesto de/);

    // Un importe ilegible no guarda nada.
    await fireEvent.changeText(screen.getByTestId('importe-Ocio'), 'treinta');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Ocio: El importe no es válido/)).toBeTruthy();
    expect(await repos.presupuestos.delMes(MES)).toBeNull();

    // Ocio se deja vacío: queda sin presupuestar.
    await fireEvent.changeText(screen.getByTestId('importe-Ocio'), '');
    expect(screen.getByTestId('total-presupuestado')).toHaveTextContent(euros(95000));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const guardado = await repos.presupuestos.delMes(MES);
    expect(guardado?.lineas.map((l) => [l.categoriaId, l.importe])).toEqual([
      [cat.Casa, 62000],
      [cat.Comida, 33000],
    ]);
  });

  it('al editar un presupuesto existente muestra sus importes, no la propuesta', async () => {
    conParametros({ mes: MES });
    await pintar(<PantallaDePresupuesto />);
    await waitFor(() => expect(screen.getByTestId('importe-Casa').props.value).toBe('620,00'));
    expect(screen.getByTestId('importe-Ocio').props.value).toBe('');
    expect(screen.queryByTestId('nota-de-propuesta')).toBeNull();
    expect(screen.getByTestId('borrar')).toBeTruthy();
  });

  it('«Copiar» reproduce el presupuesto del mes anterior', async () => {
    conParametros({ mes: SIGUIENTE });
    await pintar(<PantallaDePresupuesto />);
    await waitFor(() => expect(screen.getByTestId('copiar-mes-anterior')).not.toBeDisabled());
    expect(screen.queryByTestId('sin-mes-anterior')).toBeNull();
    await fireEvent.press(screen.getByTestId('copiar-mes-anterior'));
    expect(screen.getByTestId('importe-Comida').props.value).toBe('330,00');
    expect(screen.getByTestId('importe-Casa').props.value).toBe('620,00');
    expect(screen.getByTestId('importe-Ocio').props.value).toBe('');
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const copiado = await repos.presupuestos.delMes(SIGUIENTE);
    expect(copiado?.lineas.map((l) => l.importe)).toEqual([62000, 33000]);
  });

  it('P11 muestra previsto frente a real y distingue cada estado con icono y texto', async () => {
    // Comida 400 € de 330 (excedida), Casa 500 € de 620 (81 %, cerca) y Ocio 20 € sin línea.
    await gasto(`${MES}-01`, 40000, 'Comida', 'Compra grande');
    await gasto(`${MES}-01`, 50000, 'Casa', 'Alquiler');
    await gasto(`${MES}-01`, 2000, 'Ocio', 'Cine');
    await pintar(<Plan />);
    await waitFor(() =>
      expect(screen.getByTestId('presupuesto-presupuestado')).toHaveTextContent(euros(95000)),
    );
    expect(screen.getByTestId('presupuesto-gastado')).toHaveTextContent(euros(92000));
    expect(screen.getByTestId('presupuesto-queda')).toHaveTextContent(euros(3000));

    expect(screen.getByTestId('estado-Comida')).toHaveTextContent('✕ Excedida');
    expect(screen.getByTestId('resultado-Comida')).toHaveTextContent(
      `Te has pasado ${euros(7000)}`,
    );
    expect(screen.getByTestId('estado-Casa')).toHaveTextContent('⚠ Cerca del límite');
    expect(screen.getByTestId('resultado-Casa')).toHaveTextContent(`Te quedan ${euros(12000)}`);
    expect(screen.getByTestId('linea-Comida').props.accessibilityLabel).toMatch(/Excedida/);
    expect(screen.getByTestId('sin-presupuestar')).toHaveTextContent(euros(2000));
    // En el mes en curso cada barra lleva la raya del día.
    expect(
      screen.getAllByTestId('marca-del-dia', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId('linea-Comida'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/movimientos',
      params: { mes: MES, categoriaId: cat.Comida, peticion: 'presupuesto-1' },
    });
    await fireEvent.press(screen.getByTestId('editar-presupuesto'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/presupuesto', params: { mes: MES } });
  });

  it('en un mes futuro o pasado no hay raya del día, y un gasto dentro va con su texto', async () => {
    await pintar(<Plan />);
    await screen.findByTestId('estado-Comida');
    await fireEvent.press(screen.getByTestId('mes-siguiente'));
    await waitFor(() => expect(screen.getByTestId('estado-Comida')).toHaveTextContent('✓ Dentro'));
    expect(screen.queryAllByTestId('marca-del-dia', { includeHiddenElements: true })).toEqual([]);
    expect(screen.getByTestId('presupuesto-gastado')).toHaveTextContent(euros(0));
    // El mes anterior no tiene presupuesto: invita a crearlo.
    await fireEvent.press(screen.getByTestId('mes-anterior'));
    await fireEvent.press(screen.getByTestId('mes-anterior'));
    expect(await screen.findByTestId('presupuesto-vacio')).toHaveTextContent(
      new RegExp(describirMes(ANTERIOR)),
    );
  });

  it('borrar un presupuesto con deshacer lo recupera con sus líneas', async () => {
    conParametros({ mes: SIGUIENTE });
    await pintar(<PantallaDePresupuesto />);
    await fireEvent.press(await screen.findByTestId('borrar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await repos.presupuestos.delMes(SIGUIENTE)).toBeNull();
    expect(screen.getByText('Presupuesto borrado')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('aviso-accion'));
    await waitFor(async () =>
      expect((await repos.presupuestos.delMes(SIGUIENTE))?.lineas).toHaveLength(2),
    );
  });
});

describe('gastos fijos (P13 y P14)', () => {
  it('da de alta un fijo con el formulario', async () => {
    await pintar(<PantallaDeRegla />);
    await screen.findByTestId('nombre');
    // Sin nombre y sin categoría no guarda y lo explica.
    await fireEvent.changeText(screen.getByTestId('importe'), '35');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Escribe un nombre/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('nombre'), 'Gimnasio');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Elige una categoría/)).toBeTruthy();
    expect(await repos.reglas.listar()).toEqual([]);

    await fireEvent.press(screen.getByTestId('selector-categoria'));
    await fireEvent.press(await screen.findByText('Ocio'));
    expect(screen.getByTestId('dia')).toHaveTextContent(`Día ${DIA_DE_HOY}`);
    await ponerDia(18, DIA_DE_HOY);
    expect(screen.getByTestId('dia')).toHaveTextContent('Día 18');
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));

    const [regla] = await repos.reglas.listar();
    expect(regla).toMatchObject({
      nombre: 'Gimnasio',
      clase: 'fijo',
      tipoMovimiento: 'gasto',
      importe: 3500,
      cuentaId: bancoId,
      categoriaId: cat.Ocio,
      periodicidad: 'mensual',
      diaDelMes: 18,
      fechaInicio: HOY,
      fechaFin: null,
      activa: true,
    });
  });

  it('rechaza un nombre duplicado que solo cambia en mayúsculas o acentos', async () => {
    await pintar(<PantallaDeRegla />);
    await fireEvent.changeText(await screen.findByTestId('nombre'), ' GIMNÁSIO ');
    await fireEvent.changeText(screen.getByTestId('importe'), '10');
    await fireEvent.press(screen.getByTestId('selector-categoria'));
    await fireEvent.press(await screen.findByText('Ocio'));
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Ya existe otro elemento/)).toBeTruthy();
    expect(await repos.reglas.listar()).toHaveLength(1);
  });

  it('edita un fijo: fecha de fin, periodicidad anual y desactivarlo', async () => {
    const [regla] = await repos.reglas.listar();
    conParametros({ id: regla.id });
    await pintar(<PantallaDeRegla />);
    await waitFor(() => expect(screen.getByTestId('nombre').props.value).toBe('Gimnasio'));
    expect(screen.getByTestId('importe').props.value).toBe('35,00');
    await fireEvent.press(screen.getByTestId('poner-fin'));
    await fireEvent(screen.getByTestId('activa'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(await repos.reglas.obtener(regla.id)).toMatchObject({
      activa: false,
      fechaFin: finDeMes(MES),
      fechaInicio: HOY,
    });
    // Se deja como estaba para las pruebas siguientes, con inicio en el mes anterior.
    await repos.reglas.modificar(regla.id, {
      nombre: 'Gimnasio',
      clase: 'fijo',
      importe: 3500,
      cuentaId: bancoId,
      categoriaId: cat.Ocio,
      periodicidad: 'mensual',
      diaDelMes: 18,
      fechaInicio: `${ANTERIOR}-01`,
      fechaFin: null,
      activa: true,
    });
  });

  it('un fijo del día 18 aparece el 18 en el calendario, con su total mensual', async () => {
    conParametros({ seccion: 'fijos' });
    await pintar(<Plan />);
    const dia18 = await screen.findByTestId(`dia-${MES}-18`);
    expect(dia18.props.accessibilityLabel).toMatch(/Gimnasio/);
    expect(dia18).toHaveTextContent(/35/);
    expect(screen.getByTestId(`dia-${MES}-17`).props.accessibilityLabel).toMatch(/sin cobros/);
    expect(screen.getByTestId('del-mes-Gimnasio')).toHaveTextContent(/18/);
    expect(screen.getByTestId('total-mensual')).toHaveTextContent(euros(3500));
    expect(screen.getByTestId('grupo-fijo')).toHaveTextContent(/Día 18 de cada mes/);

    await fireEvent.press(screen.getByTestId('regla-Gimnasio'));
    const [regla] = await repos.reglas.listar();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/regla', params: { id: regla.id } });
  });

  it('las reglas anuales van en un grupo aparte y no suman al total mensual', async () => {
    await repos.reglas.crear({
      nombre: 'Seguro del hogar',
      clase: 'fijo',
      importe: 24000,
      cuentaId: bancoId,
      categoriaId: cat.Casa,
      periodicidad: 'anual',
      diaDelMes: 31,
      fechaInicio: `${moverMes(MES, -2)}-01`,
    });
    conParametros({ seccion: 'fijos' });
    await pintar(<Plan />);
    expect(await screen.findByTestId('grupo-anuales')).toHaveTextContent(/Seguro del hogar/);
    expect(screen.getByTestId('grupo-anuales')).toHaveTextContent(/cada año/);
    expect(screen.getByTestId('total-mensual')).toHaveTextContent(euros(3500));
    // Este mes no es el suyo: no aparece en el calendario.
    expect(screen.queryByTestId('del-mes-Seguro del hogar')).toBeNull();
  });

  it('con la letra del sistema muy grande el calendario pasa a lista del mes', async () => {
    conEscalaDeLetra(2);
    conParametros({ seccion: 'fijos' });
    await pintar(<Plan />);
    expect(await screen.findByTestId('del-mes-Gimnasio')).toBeTruthy();
    expect(screen.queryByTestId('calendario')).toBeNull();
  });
});

describe('confirmación de cobros (T-066)', () => {
  let luzId: string;

  beforeAll(async () => {
    const luz = await repos.reglas.crear({
      nombre: 'Luz',
      clase: 'fijo',
      importe: 6000,
      cuentaId: bancoId,
      categoriaId: cat.Casa,
      periodicidad: 'mensual',
      diaDelMes: 1,
      fechaInicio: `${ANTERIOR}-01`,
    });
    luzId = luz.id;
  });

  it('un cobro vencido se confirma con un toque y crea un solo movimiento recurrente', async () => {
    conParametros({ seccion: 'fijos' });
    await pintar(<Plan />);
    const boton = await screen.findByTestId(`confirmar-Luz-${MES}-01`);
    // El del mes anterior también sigue por confirmar.
    expect(screen.getByTestId(`confirmar-Luz-${ANTERIOR}-01`)).toBeTruthy();
    // Dos toques seguidos no crean dos movimientos.
    await fireEvent.press(boton);
    await fireEvent.press(boton);
    await waitFor(() => expect(screen.queryByTestId(`confirmar-Luz-${MES}-01`)).toBeNull());

    const delMes = (await repos.movimientos.listar({ mes: MES })).filter(
      (m) => m.reglaRecurrenteId === luzId,
    );
    expect(delMes).toHaveLength(1);
    expect(delMes[0]).toMatchObject({
      tipo: 'gasto',
      importe: 6000,
      fecha: `${MES}-01`,
      origen: 'recurrente',
      categoriaId: cat.Casa,
      nombre: 'Luz',
    });
    expect(screen.getByText('Luz confirmado')).toBeTruthy();
    expect(screen.getByTestId('del-mes-Luz')).toHaveTextContent(/✓ Confirmado/);

    // Deshacer borra el movimiento y el cobro vuelve a estar por confirmar.
    await fireEvent.press(screen.getByTestId('aviso-accion'));
    expect(await screen.findByTestId(`confirmar-Luz-${MES}-01`)).toBeTruthy();
    expect(
      (await repos.movimientos.listar({ mes: MES })).filter((m) => m.reglaRecurrenteId === luzId),
    ).toEqual([]);
  });

  it('se puede cambiar el importe y el día antes de confirmar', async () => {
    conParametros({ reglaId: luzId, mes: ANTERIOR });
    await pintar(<PantallaDeCobro />);
    expect(await screen.findByTestId('nombre-del-cobro')).toHaveTextContent(/Luz/);
    expect(screen.getByTestId('importe')).toHaveTextContent('60 €');
    await pulsarTeclas('6', '3', 'decimal', '5');
    expect(screen.getByTestId('importe')).toHaveTextContent('63,5 €');
    await fireEvent.press(screen.getByTestId('dia-mas'));
    await fireEvent.press(screen.getByTestId('dia-mas'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const delMes = (await repos.movimientos.listar({ mes: ANTERIOR })).filter(
      (m) => m.reglaRecurrenteId === luzId,
    );
    expect(delMes).toHaveLength(1);
    expect(delMes[0]).toMatchObject({
      importe: 6350,
      fecha: `${ANTERIOR}-03`,
      origen: 'recurrente',
    });
  });

  it('un cobro ya confirmado lo dice y no deja confirmarlo otra vez', async () => {
    conParametros({ reglaId: luzId, mes: ANTERIOR });
    await pintar(<PantallaDeCobro />);
    expect(await screen.findByTestId('cobro-no-disponible')).toHaveTextContent(
      /ya está confirmado/,
    );
    expect(screen.queryByTestId('guardar')).toBeNull();
  });

  it('«Ya lo anoté» enlaza un movimiento existente y no crea ninguno', async () => {
    const manual = await gasto(`${MES}-01`, 5900, 'Casa', 'Factura de la luz');
    const antes = (await repos.movimientos.listar()).length;
    conParametros({ reglaId: luzId, mes: MES });
    await pintar(<PantallaDeCobro />);
    const candidato = await screen.findByTestId(`candidato-${manual.id}`);
    expect(screen.getByTestId('ya-lo-anote')).toHaveTextContent(/Factura de la luz/);
    await fireEvent.press(candidato);
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(await repos.movimientos.obtener(manual.id)).toMatchObject({
      reglaRecurrenteId: luzId,
      origen: 'manual',
      importe: 5900,
    });
    expect((await repos.movimientos.listar()).length).toBe(antes);
  });

  it('una regla o un mes que no existen lo dicen en lugar de quedar en blanco', async () => {
    conParametros({ reglaId: 'no-existe', mes: MES });
    await pintar(<PantallaDeCobro />);
    expect(await screen.findByTestId('cobro-no-disponible')).toHaveTextContent(
      /ya no está pendiente/,
    );
  });
});

describe('objetivos (P15 y P16)', () => {
  let viajeId: string;
  const limite = finDeMes(moverMes(MES, 6));

  it('crea un objetivo con el formulario', async () => {
    await pintar(<PantallaDeObjetivoEditar />);
    await fireEvent.press(await screen.findByTestId('guardar'));
    expect(await screen.findByText(/Escribe una meta mayor que cero/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('meta'), '1.500');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Escribe un nombre/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('nombre'), 'Viaje');
    await fireEvent.changeText(screen.getByTestId('meta'), '0');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/Escribe una meta mayor que cero/)).toBeTruthy();
    expect(await repos.objetivos.listar()).toEqual([]);

    await fireEvent.changeText(screen.getByTestId('meta'), '1.500');
    await fireEvent.press(screen.getByTestId('poner-fecha'));
    expect(screen.getByTestId('fecha-limite')).toHaveTextContent(/Hasta el/);
    await fireEvent.press(screen.getByTestId('selector-cuenta'));
    // «Ahorro» es también el nombre de un tipo de objetivo: la cuenta es la opción de la lista.
    await waitFor(() => expect(screen.getAllByText('Ahorro').length).toBeGreaterThan(1));
    const opciones = screen.getAllByText('Ahorro');
    await fireEvent.press(opciones[opciones.length - 1]);
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const [viaje] = await repos.objetivos.listar();
    expect(viaje).toMatchObject({
      nombre: 'Viaje',
      tipo: 'ahorro',
      meta: 150000,
      fechaLimite: limite,
      cuentaId: ahorroId,
    });
    viajeId = viaje.id;
  });

  it('el detalle muestra el avance y lo que hace falta al mes', async () => {
    conParametros({ id: viajeId });
    await pintar(<PantallaDeObjetivo />);
    await waitFor(() =>
      expect(screen.getByTestId('titulo-de-objetivo')).toHaveTextContent('Viaje'),
    );
    expect(screen.getByTestId('aportado')).toHaveTextContent(euros(0));
    // 1 500 € en 6 meses: 250 € al mes.
    expect(screen.getByTestId('ritmo')).toHaveTextContent(
      `Necesitas ${euros(25000)} al mes durante 6 meses`,
    );
    expect(screen.getByTestId('sin-aportaciones')).toBeTruthy();
    expect(screen.getByTestId('falta')).toHaveTextContent(euros(150000));

    await fireEvent.press(screen.getByTestId('aportar'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/aportacion',
      params: { objetivoId: viajeId },
    });
    await fireEvent.press(screen.getByTestId('editar-objetivo'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/objetivo-editar',
      params: { id: viajeId },
    });
  });

  it('«Aportar» anota una aportación sin movimiento y el ritmo se recalcula', async () => {
    const movimientosAntes = (await repos.movimientos.listar()).length;
    conParametros({ objetivoId: viajeId });
    await pintar(<PantallaDeAportacion />);
    await screen.findByText(/Aportar a Viaje/);
    // Desde B3 «Aportar» ofrece dos caminos; este es «Solo anotar».
    await fireEvent.press(await screen.findByTestId('segmento-anotar'));
    // Sin importe no guarda.
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/importe mayor que cero/)).toBeTruthy();
    await pulsarTeclas('5', '0', '0');
    await fireEvent.press(screen.getByTestId('guardar'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const aportaciones = await repos.objetivos.listarAportaciones(viajeId);
    expect(aportaciones).toHaveLength(1);
    expect(aportaciones[0]).toMatchObject({ importe: 50000, fecha: HOY, movimientoId: null });
    expect((await repos.movimientos.listar()).length).toBe(movimientosAntes);
    await screen.unmount();

    conParametros({ id: viajeId });
    await pintar(<PantallaDeObjetivo />);
    await waitFor(() => expect(screen.getByTestId('aportado')).toHaveTextContent(euros(50000)));
    // Faltan 1 000 € en 6 meses: 166,67 € al mes, redondeado hacia arriba.
    expect(screen.getByTestId('ritmo')).toHaveTextContent(
      `Necesitas ${euros(16667)} al mes durante 6 meses`,
    );
  });

  it('borrar una aportación con deshacer la recupera', async () => {
    conParametros({ id: viajeId });
    await pintar(<PantallaDeObjetivo />);
    await fireEvent.press(await screen.findByTestId(`aportacion-${HOY}-50000`));
    await waitFor(() => expect(screen.getByTestId('aportado')).toHaveTextContent(euros(0)));
    expect(screen.getByText('Aportación borrada')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('aviso-accion'));
    await waitFor(() => expect(screen.getByTestId('aportado')).toHaveTextContent(euros(50000)));
  });

  it('«Crear aportación mensual» abre el alta de regla con la clase y el objetivo puestos', async () => {
    conParametros({ id: viajeId });
    await pintar(<PantallaDeObjetivo />);
    await fireEvent.press(await screen.findByTestId('crear-aportacion-mensual'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/regla',
      params: {
        clase: 'aportacion',
        objetivoId: viajeId,
        nombre: 'Ahorro para Viaje',
        importe: '166,67',
        cuentaDestinoId: ahorroId,
      },
    });
  });

  it('el alta de la aportación mensual guarda la regla enlazada al objetivo', async () => {
    conParametros({
      clase: 'aportacion',
      objetivoId: viajeId,
      nombre: 'Ahorro para Viaje',
      importe: '166,67',
      cuentaDestinoId: ahorroId,
    });
    await pintar(<PantallaDeRegla />);
    expect(await screen.findByTestId('objetivo-de-la-regla')).toHaveTextContent(
      'Suma al objetivo Viaje',
    );
    expect(screen.getByTestId('segmento-aportacion')).toBeSelected();
    expect(screen.getByTestId('nombre').props.value).toBe('Ahorro para Viaje');
    // Una aportación no lleva categoría: lleva cuenta de destino.
    expect(screen.queryByTestId('selector-categoria')).toBeNull();
    expect(screen.getByTestId('selector-destino').props.accessibilityLabel).toMatch(/Ahorro/);
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const regla = (await repos.reglas.listar()).find((r) => r.clase === 'aportacion');
    expect(regla).toMatchObject({
      tipoMovimiento: 'transferencia',
      importe: 16667,
      cuentaId: bancoId,
      cuentaDestinoId: ahorroId,
      categoriaId: null,
      objetivoId: viajeId,
      diaDelMes: DIA_DE_HOY,
      fechaInicio: HOY,
    });
  });

  it('confirmar la aportación mensual crea la transferencia y suma al objetivo', async () => {
    // La regla empieza hoy y es del día de hoy: ya está por confirmar.
    await pintar(<Inicio />);
    await fireEvent.press(await screen.findByTestId(`confirmar-Ahorro para Viaje-${HOY}`));
    await waitFor(async () =>
      expect(await repos.objetivos.listarAportaciones(viajeId)).toHaveLength(2),
    );
    const [nueva] = (await repos.objetivos.listarAportaciones(viajeId)).filter(
      (a) => a.movimientoId !== null,
    );
    const mov = await repos.movimientos.obtener(nueva.movimientoId ?? '');
    expect(mov).toMatchObject({
      tipo: 'transferencia',
      importe: 16667,
      cuentaId: bancoId,
      cuentaDestinoId: ahorroId,
      origen: 'recurrente',
      objetivoId: viajeId,
    });
    expect(await repos.cuentas.saldo(ahorroId)).toBe(16667);
    const viaje = await repos.objetivos.exigir(viajeId);
    const estado = estadoDeObjetivo(viaje, await repos.objetivos.listarAportaciones(), HOY);
    expect(estado.aportado).toBe(66667);
    await screen.unmount();

    // Borrar esa transferencia quita su aportación; el detalle avisa de cómo quitarla.
    conParametros({ id: viajeId });
    await pintar(<PantallaDeObjetivo />);
    await waitFor(() => expect(screen.getByTestId('aportado')).toHaveTextContent(euros(66667)));
    await fireEvent.press(screen.getByTestId(`aportacion-${HOY}-16667`));
    expect(await screen.findByText(/borra ese movimiento/)).toBeTruthy();
    expect(screen.getByTestId('aportado')).toHaveTextContent(euros(66667));
    expect(screen.getByTestId('aportacion-mensual-Ahorro para Viaje')).toBeTruthy();
  });

  it('la lista de objetivos muestra el anillo, lo aportado y el ritmo; los archivados se ocultan', async () => {
    const meta = await repos.objetivos.crear({
      nombre: 'Colchón',
      tipo: 'ahorro',
      meta: 123456789,
    });
    await repos.objetivos.aportar({ objetivoId: meta.id, fecha: HOY, importe: 1 });
    const hecho = await repos.objetivos.crear({ nombre: 'Bici', tipo: 'ahorro', meta: 10000 });
    await repos.objetivos.aportar({ objetivoId: hecho.id, fecha: HOY, importe: 12000 });
    const vencido = await repos.objetivos.crear({
      nombre: 'Portátil',
      tipo: 'inversion',
      meta: 90000,
      fechaLimite: sumarDias(HOY, -1),
    });
    const viejo = await repos.objetivos.crear({ nombre: 'Antiguo', tipo: 'ahorro', meta: 5000 });
    await repos.objetivos.archivar(viejo.id, true);

    conParametros({ seccion: 'objetivos' });
    await pintar(<Plan />);
    const viaje = await screen.findByTestId('objetivo-Viaje');
    expect(viaje).toHaveTextContent(`${euros(66667)} de ${euros(150000)}`, { exact: false });
    expect(viaje).toHaveTextContent(/Necesitas/);
    // Meta de más de un millón con un céntimo aportado, sin fecha.
    expect(screen.getByTestId('objetivo-Colchón')).toHaveTextContent(
      `${euros(1)} de ${euros(123456789)}`,
      { exact: false },
    );
    expect(screen.getByTestId('objetivo-Colchón')).toHaveTextContent(/Sin fecha límite/);
    // Aportado mayor que la meta: conseguido y con tope del 100 %.
    expect(screen.getByTestId('objetivo-Bici')).toHaveTextContent(/Conseguido/);
    expect(screen.getByTestId('objetivo-Bici')).toHaveTextContent(/100/);
    expect(screen.getByTestId('objetivo-Portátil')).toHaveTextContent(/Plazo vencido/);
    expect(screen.queryByTestId('objetivo-Antiguo')).toBeNull();
    await fireEvent.press(screen.getByTestId('ver-objetivos-archivados'));
    expect(await screen.findByTestId('objetivo-Antiguo')).toHaveTextContent(/Archivado/);

    await fireEvent.press(viaje);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/objetivo', params: { id: viajeId } });
    viajeId = (await repos.objetivos.exigir(viajeId)).id;
    expect(vencido.fechaLimite).not.toBeNull();
  });

  it('un objetivo que no existe lo dice en lugar de quedar en blanco', async () => {
    conParametros({ id: 'no-existe' });
    await pintar(<PantallaDeObjetivo />);
    expect(await screen.findByTestId('objetivo-no-encontrado')).toBeTruthy();
  });
});

describe('Inicio con planificación', () => {
  /** Las cifras esperadas salen de las mismas funciones de dominio, con los datos reales. */
  async function esperado() {
    const movimientos = await repos.movimientos.listar();
    const categorias = await repos.categorias.listar({ incluirArchivadas: true });
    const cuentas = await repos.cuentas.listar({ incluirArchivadas: true });
    const reglas = await repos.reglas.listar();
    const presupuesto = await repos.presupuestos.delMes(MES);
    const estado = estadoDelPresupuesto(
      presupuesto?.lineas ?? [],
      movimientos,
      categorias,
      MES,
      HOY,
    );
    const pendientes = pendientesDelMes(reglas, movimientos, MES, HOY);
    return {
      estado,
      d1: disponibleDelMes(
        estado.presupuestado,
        estado.gastado,
        fijosPendientes(pendientes),
        MES,
        HOY,
      ),
      prevision: previsionDeFinDeMes(cuentas, movimientos, pendientes, HOY),
    };
  }

  it('muestra el disponible del mes (D1) con su importe por día', async () => {
    const { d1, estado } = await esperado();
    // Presupuesto de 950 €: el gasto del mes ya lo ha superado.
    expect(estado.presupuestado).toBe(95000);
    expect(d1.exceso).toBeGreaterThan(0);
    await pintar(<Inicio />);
    await waitFor(() => expect(screen.getByTestId('disponible')).toHaveTextContent(euros(0)));
    expect(screen.getByTestId('disponible-por-dia')).toHaveTextContent(
      `Te has pasado ${euros(d1.exceso)}`,
    );
    expect(screen.queryByTestId('disponible-vacio')).toBeNull();
  });

  it('con margen en el presupuesto muestra lo disponible y lo que toca por día', async () => {
    const lineas = (await repos.presupuestos.delMes(MES))?.lineas ?? [];
    await repos.presupuestos.guardar(MES, [
      ...lineas.map((l) => ({ categoriaId: l.categoriaId, importe: l.importe })),
      { categoriaId: cat.Ocio, importe: 200000 },
    ]);
    const { d1 } = await esperado();
    expect(d1.disponible).toBeGreaterThan(0);
    await pintar(<Inicio />);
    await waitFor(() =>
      expect(screen.getByTestId('disponible')).toHaveTextContent(euros(d1.disponible)),
    );
    expect(screen.getByTestId('disponible-por-dia')).toHaveTextContent(
      d1.diasQueQuedan === 1
        ? `${euros(d1.porDia)} hoy`
        : `${euros(d1.porDia)} al día · quedan ${d1.diasQueQuedan} días`,
      { exact: false },
    );
    expect(d1.porDia * d1.diasQueQuedan).toBeLessThanOrEqual(d1.disponible);
  });

  it('avisa en pantalla de las líneas que pasan del 80 %, sin guardar nada', async () => {
    await pintar(<Inicio />);
    const aviso = await screen.findByTestId('aviso-de-presupuesto');
    expect(aviso).toHaveTextContent(/Comida: te has pasado/);
    expect(aviso).toHaveTextContent(/Casa: llevas el \d+ %/);
    await fireEvent.press(screen.getByTestId('ver-presupuesto'));
    // B3b: el salto lleva una marca de petición para poder repetirse.
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/plan',
      params: { seccion: 'presupuesto', mes: MES, peticion: expect.any(String) },
    });
  });

  it('muestra los próximos cobros (D9) de los próximos 14 días', async () => {
    const proxima = sumarDias(HOY, 3);
    await repos.reglas.crear({
      nombre: 'Música',
      clase: 'suscripcion',
      importe: 999,
      cuentaId: bancoId,
      categoriaId: cat.Ocio,
      periodicidad: 'mensual',
      diaDelMes: Number(proxima.slice(8, 10)),
      fechaInicio: `${ANTERIOR}-01`,
    });
    await pintar(<Inicio />);
    await screen.findByTestId('bloque-proximos');
    const delDia = (await repos.reglas.listar()).find((r) => r.nombre === 'Música');
    // Si el mes siguiente es más corto, el día cae en su último día.
    const fecha =
      proxima.slice(0, 7) === MES || Number(proxima.slice(8, 10)) === delDia?.diaDelMes
        ? proxima
        : finDeMes(proxima.slice(0, 7));
    const cobro = await screen.findByTestId(`cobro-Música-${fecha}`);
    expect(cobro).toHaveTextContent(/-9,99/);
    // Un cobro próximo no se confirma con un toque: aún no ha llegado su día.
    expect(screen.queryByTestId(`confirmar-Música-${fecha}`)).toBeNull();
    await fireEvent.press(cobro);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/cobro',
      params: { reglaId: delDia?.id, mes: fecha.slice(0, 7) },
    });
  });

  // B3b: en Inicio caben dos objetivos (D-f), no tres.
  it('muestra hasta dos objetivos (D8) y el acceso al resto', async () => {
    await pintar(<Inicio />);
    const bloque = await screen.findByTestId('bloque-objetivos');
    expect(screen.getByTestId('objetivo-Viaje')).toHaveTextContent(/Necesitas/);
    // Hay cuatro objetivos activos: caben dos y el resto queda tras «Ver todos».
    // Los tres de la prueba anterior se crearon en el mismo instante, así que
    // no se comprueba cuáles de ellos salen, solo cuántos.
    const visibles = ['Viaje', 'Colchón', 'Bici', 'Portátil'].filter(
      (nombre) => screen.queryByTestId(`objetivo-${nombre}`) !== null,
    );
    expect(visibles).toHaveLength(2);
    expect(bloque).toHaveTextContent(/Ver todos/);
    // El archivado no aparece nunca.
    expect(screen.queryByTestId('objetivo-Antiguo')).toBeNull();
    await fireEvent.press(screen.getByTestId('ver-objetivos'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/plan',
      params: { seccion: 'objetivos', peticion: expect.any(String) },
    });
  });

  it('muestra el fin de mes previsto (D4) con su línea y su descripción', async () => {
    const { prevision } = await esperado();
    // B3b: el bloque está en Plan › Presupuesto, con la misma cifra.
    await pintar(<Plan />);
    await waitFor(() =>
      expect(screen.getByTestId('fin-de-mes-previsto')).toHaveTextContent(
        euros(prevision.previsto),
      ),
    );
    await fireEvent(screen.getByTestId('lienzo-de-linea'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 110, x: 0, y: 0 } },
    });
    expect(screen.getByTestId('grafico-linea').props.accessibilityLabel).toMatch(
      /previstos a fin de mes/,
    );
    expect(screen.getByTestId('bloque-fin-de-mes')).toHaveTextContent(/Previsto/);
  });

  // B3b: lo que Inicio mostraba sigue existiendo, repartido entre Inicio y su pestaña.
  it('conserva todo lo que Inicio ya mostraba, en Inicio o en su pestaña', async () => {
    const inicio = await pintar(<Inicio />);
    await screen.findByTestId('patrimonio-total');
    for (const id of ['bloque-balance', 'balance-del-mes', 'gasto-de-hoy']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    // El patrimonio sigue siendo la primera cifra de la pantalla.
    expect(screen.getAllByText(/€/)[0].props.testID).toBe('patrimonio-total');
    await inicio.unmount();

    conParametros({ vista: 'mes' });
    const delMes = await pintar(<Analisis />);
    await screen.findByTestId('bloque-gasto');
    for (const id of ['bloque-balance', 'bloque-evolucion']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    await delMes.unmount();

    conParametros({ vista: 'dia' });
    const delDia = await pintar(<Analisis />);
    expect(await screen.findByTestId('analisis-gasto-de-hoy')).toBeTruthy();
    await delDia.unmount();

    conParametros({});
    await pintar(<Cuentas />);
    expect(await screen.findByTestId('cuenta-Banco')).toBeTruthy();
  });
});

describe('correcciones de B3 sobre la planificación', () => {
  it('Inicio llama «En cuentas» a lo que hay en banco y efectivo, y conserva «Disponible este mes»', async () => {
    await pintar(<Inicio />);
    await screen.findByTestId('patrimonio-disponible');
    expect(screen.getByText('En cuentas')).toBeTruthy();
    expect(screen.queryByText('Disponible')).toBeNull();
    expect(screen.getByText('Disponible este mes')).toBeTruthy();
  });

  it('«Mover dinero» crea la transferencia con el objetivo y su aportación enlazada', async () => {
    const [viaje] = (await repos.objetivos.listar()).filter((o) => o.nombre === 'Viaje');
    const antes = await repos.objetivos.listarAportaciones(viaje.id);
    const saldoAntes = await repos.cuentas.saldo(ahorroId);
    conParametros({ objetivoId: viaje.id });
    await pintar(<PantallaDeAportacion />);
    // Es el camino por defecto y propone como destino la cuenta del objetivo.
    expect(await screen.findByTestId('segmento-mover')).toBeSelected();
    expect(screen.getByTestId('selector-destino').props.accessibilityLabel).toBe('Hacia: Ahorro');
    expect(screen.getByTestId('selector-origen').props.accessibilityLabel).toBe('Desde: Banco');
    await pulsarTeclas('8', '0');
    await fireEvent.press(screen.getByTestId('guardar'));
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));

    const despues = await repos.objetivos.listarAportaciones(viaje.id);
    expect(despues).toHaveLength(antes.length + 1);
    const nueva = despues.find((a) => !antes.some((x) => x.id === a.id));
    expect(nueva).toMatchObject({ importe: 8000, fecha: HOY });
    expect(await repos.movimientos.obtener(nueva?.movimientoId ?? '')).toMatchObject({
      tipo: 'transferencia',
      importe: 8000,
      cuentaId: bancoId,
      cuentaDestinoId: ahorroId,
      objetivoId: viaje.id,
      origen: 'manual',
    });
    expect(await repos.cuentas.saldo(ahorroId)).toBe(saldoAntes + 8000);
    // Borrar esa transferencia quita su aportación.
    await repos.movimientos.borrar(nueva?.movimientoId ?? '');
    expect(await repos.objetivos.listarAportaciones(viaje.id)).toHaveLength(antes.length);
  });

  it('«Mover dinero» con la misma cuenta de origen y destino se rechaza y no guarda nada', async () => {
    const [viaje] = (await repos.objetivos.listar()).filter((o) => o.nombre === 'Viaje');
    const antes = (await repos.movimientos.listar()).length;
    conParametros({ objetivoId: viaje.id });
    await pintar(<PantallaDeAportacion />);
    await fireEvent.press(await screen.findByTestId('selector-origen'));
    await waitFor(() => expect(screen.getAllByText('Ahorro').length).toBeGreaterThan(1));
    // La hoja del selector va antes en la pantalla que el campo «Hacia», que también dice Ahorro.
    await fireEvent.press(screen.getAllByText('Ahorro')[0]);
    expect(screen.getByTestId('selector-origen').props.accessibilityLabel).toBe('Desde: Ahorro');
    await pulsarTeclas('5');
    await fireEvent.press(screen.getByTestId('guardar'));
    expect(await screen.findByText(/deben ser distintas/)).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect((await repos.movimientos.listar()).length).toBe(antes);
  });

  it('borrar un objetivo borra sus reglas de aportación, y deshacer recupera todo', async () => {
    const objetivo = await repos.objetivos.crear({ nombre: 'Coche', tipo: 'ahorro', meta: 500000 });
    const nueva = (nombre: string, dia: number) =>
      repos.reglas.crear({
        nombre,
        clase: 'aportacion',
        importe: 10000,
        cuentaId: bancoId,
        cuentaDestinoId: ahorroId,
        periodicidad: 'mensual',
        diaDelMes: dia,
        objetivoId: objetivo.id,
      });
    const primera = await nueva('Coche, primera', 5);
    const segunda = await nueva('Coche, segunda', 20);
    // Una regla que la persona ya había borrado a mano no vuelve al deshacer.
    const antigua = await nueva('Coche, antigua', 10);
    await repos.reglas.borrar(antigua.id);
    const ajenas = (await repos.reglas.listar()).filter((r) => r.objetivoId !== objetivo.id);

    conParametros({ id: objetivo.id });
    await pintar(<PantallaDeObjetivoEditar />);
    await fireEvent.press(await screen.findByTestId('borrar'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const trasBorrar = await repos.reglas.listar();
    expect(trasBorrar.map((r) => r.id).sort()).toEqual(ajenas.map((r) => r.id).sort());

    await fireEvent.press(screen.getByTestId('aviso-accion'));
    await waitFor(async () =>
      expect((await repos.objetivos.obtener(objetivo.id))?.borradoEn).toBeNull(),
    );
    const recuperadas = (await repos.reglas.listar()).filter((r) => r.objetivoId === objetivo.id);
    expect(recuperadas.map((r) => r.id).sort()).toEqual([primera.id, segunda.id].sort());
    expect((await repos.reglas.obtener(antigua.id))?.borradoEn).not.toBeNull();
    await repos.objetivos.borrar(objetivo.id);
  });

  it('el calendario de fijos no redondea: 9,99 € se ve como 9,99 y lo que no cabe, solo con su marca', async () => {
    const { importeExactoCorto } = jest.requireActual('@/estado/formato');
    expect(importeExactoCorto(999)).toBe('9,99');
    expect(importeExactoCorto(62000)).toBe('620');
    expect(importeExactoCorto(3500)).toBe('35');
    expect(importeExactoCorto(123456)).toBe('');
    expect(importeExactoCorto(123400)).toBe('1.234');
    expect(importeExactoCorto(123456789)).toBe('');
    expect(importeExactoCorto(1)).toBe('0,01');

    conParametros({ seccion: 'fijos' });
    await pintar(<Plan />);
    const musica = (await repos.reglas.listar()).find((r) => r.nombre === 'Música');
    const dia = String(musica?.diaDelMes).padStart(2, '0');
    const casilla = await screen.findByTestId(`dia-${MES}-${dia}`);
    expect(casilla).toHaveTextContent(/9,99/);
    expect(casilla).not.toHaveTextContent(/10$/);
    expect(casilla.props.accessibilityLabel).toMatch(/Música -9,99/);
  });
});
