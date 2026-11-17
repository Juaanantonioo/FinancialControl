/**
 * Pruebas de los avisos locales: el recálculo contra un sistema de
 * notificaciones de mentira y la pantalla «Avisos». Nunca se llama al
 * sistema real: la capa que habla con expo-notifications se sustituye.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import PantallaDeAvisos from '@/app/avisos';
import PantallaDeRegla from '@/app/regla';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { instanteLocal, SIN_AVISOS, type Preferencias } from '@/dominio/avisos';
import { fechaLocal } from '@/dominio/modelo';
import { sumarDias } from '@/dominio/recurrentes';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { destinoDelAviso, recalcularAvisos } from '@/estado/avisos';
import { ProveedorDeDatos } from '@/estado/Datos';
import type { AvisoParaMostrar, EstadoDelPermiso, Notificador } from '@/lib/notificaciones';
import { interpretarPreferencias } from '@/lib/preferencias';
import { router, useLocalSearchParams } from 'expo-router';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
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

/** Sistema de notificaciones de mentira: guarda lo que se le pide en memoria. */
const mockSistema = {
  permiso: 'sin_decidir' as EstadoDelPermiso,
  alPedir: 'concedido' as EstadoDelPermiso,
  veces: 0,
  programados: new Map<string, { aviso: AvisoParaMostrar; instante: number }>(),
  mostrados: [] as AvisoParaMostrar[],
  /** Preferencias guardadas, como texto. */
  guardadas: null as string | null,
};
const mockNotificador: Notificador = {
  permiso: async () => mockSistema.permiso,
  pedirPermiso: async () => {
    mockSistema.veces++;
    mockSistema.permiso = mockSistema.alPedir;
    return mockSistema.permiso;
  },
  programados: async () => [...mockSistema.programados.keys()],
  cancelar: async (id) => {
    mockSistema.programados.delete(id);
  },
  programar: async (aviso, instante) => {
    mockSistema.programados.set(aviso.id, { aviso, instante });
  },
  mostrar: async (aviso) => {
    mockSistema.mostrados.push(aviso);
  },
};
// Los sustitutos se leen al usarse, no al cargar el módulo: para entonces ya existen.
jest.mock('@/lib/notificaciones', () => ({
  PREFIJO: 'fc:',
  get notificador() {
    return mockNotificador;
  },
}));
jest.mock('@/lib/preferencias', () => {
  const real = jest.requireActual('@/lib/preferencias');
  return {
    interpretarPreferencias: real.interpretarPreferencias,
    leerPreferencias: async () => real.interpretarPreferencias(mockSistema.guardadas),
    guardarPreferencias: async (p: unknown) => {
      mockSistema.guardadas = JSON.stringify(p);
    },
  };
});
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: {} }));

const sistema = mockSistema;
const falso = mockNotificador;

const TODOS: Preferencias = { cobros: true, presupuesto: true, capturas: true, inversion: true };
const HOY = fechaLocal();
const MES = HOY.slice(0, 7);
/** Hoy a las 8:00: antes de la hora de los avisos. */
const AHORA = instanteLocal(HOY, 8);
let repos: Repositorios;
let bancoId: string;
const cat: Record<string, string> = {};

function pintar(pantalla: ReactElement) {
  return render(
    <ProveedorDeDatos>
      <ProveedorDeAvisos>{pantalla}</ProveedorDeAvisos>
    </ProveedorDeDatos>,
  );
}
const claves = () => [...sistema.programados.keys()].sort();

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
    fechaSaldoInicial: `${MES}-01`,
  });
  bancoId = banco.id;
});

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  sistema.permiso = 'concedido';
  sistema.alPedir = 'concedido';
  sistema.veces = 0;
  sistema.programados.clear();
  sistema.mostrados.length = 0;
  sistema.guardadas = null;
});

describe('recálculo de los avisos', () => {
  let reglaId: string;

  it('sin datos, sin avisos activados o sin permiso no programa nada', async () => {
    expect(await recalcularAvisos(repos, falso, TODOS, AHORA)).toBe(0);
    const regla = await repos.reglas.crear({
      nombre: 'Gimnasio',
      clase: 'fijo',
      importe: 3500,
      cuentaId: bancoId,
      categoriaId: cat.Ocio,
      periodicidad: 'mensual',
      diaDelMes: Number(HOY.slice(8, 10)),
      fechaInicio: `${MES}-01`,
    });
    reglaId = regla.id;
    expect(await recalcularAvisos(repos, falso, SIN_AVISOS, AHORA)).toBe(0);
    sistema.permiso = 'denegado';
    expect(await recalcularAvisos(repos, falso, TODOS, AHORA)).toBe(0);
    sistema.permiso = 'sin_decidir';
    expect(await recalcularAvisos(repos, falso, TODOS, AHORA)).toBe(0);
    expect(claves()).toEqual([]);
    // Recalcular nunca pide el permiso por su cuenta.
    expect(sistema.veces).toBe(0);
  });

  it('programa el aviso del cobro de hoy a las 9:00, con su texto y su destino', async () => {
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    const programado = sistema.programados.get(`fc:cobro:${reglaId}:${MES}`);
    expect(programado?.instante).toBe(instanteLocal(HOY, 9));
    expect(programado?.aviso).toMatchObject({
      titulo: 'Gimnasio',
      datos: { ruta: '/cobro', parametros: JSON.stringify({ reglaId, mes: MES }) },
    });
    expect(programado?.aviso.cuerpo).toMatch(/^Hoy se cobra: 35,00/);
    // Los de los meses siguientes dicen el día.
    const otros = [...sistema.programados.values()].filter(
      (p) => p.instante > instanteLocal(HOY, 9),
    );
    expect(otros.length).toBeGreaterThan(0);
    expect(otros[0].aviso.cuerpo).toMatch(/^Se cobra el \d+ de \w+: 35,00/);
  });

  it('recalcular dos veces deja los mismos avisos: cancela los propios y los vuelve a poner', async () => {
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    const primera = claves();
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(claves()).toEqual(primera);
    expect(primera.every((id) => id.startsWith('fc:'))).toBe(true);
  });

  it('un cobro confirmado antes de la hora del aviso lo cancela; si se borra, vuelve', async () => {
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(claves()).toContain(`fc:cobro:${reglaId}:${MES}`);
    const mov = await repos.reglas.confirmar(reglaId, MES);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(claves()).not.toContain(`fc:cobro:${reglaId}:${MES}`);
    await repos.movimientos.borrar(mov.id);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(claves()).toContain(`fc:cobro:${reglaId}:${MES}`);
  });

  it('después de las 9:00 el aviso de hoy ya no se programa', async () => {
    await recalcularAvisos(repos, falso, TODOS, instanteLocal(HOY, 10));
    expect(claves()).not.toContain(`fc:cobro:${reglaId}:${MES}`);
  });

  it('desactivar un tipo quita sus avisos y deja los demás', async () => {
    const captura = await repos.capturas.registrar({
      origen: 'prueba',
      recibidaEn: new Date(AHORA - 3_600_000).toISOString(),
      importeTexto: '5,00 €',
      comercioTexto: 'Kiosco',
    });
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(claves()).toContain(`fc:capturas:${captura.id}`);
    // 23 horas después de ahora se cumplen las 24 desde que llegó.
    expect(sistema.programados.get(`fc:capturas:${captura.id}`)?.instante).toBe(
      AHORA + 23 * 3_600_000,
    );
    await recalcularAvisos(repos, falso, { ...TODOS, capturas: false }, AHORA);
    expect(claves()).not.toContain(`fc:capturas:${captura.id}`);
    expect(claves()).toContain(`fc:cobro:${reglaId}:${MES}`);
    // Resuelta la captura, tampoco avisa con el tipo activado.
    await repos.capturas.descartar(captura.id);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(claves().some((id) => id.startsWith('fc:capturas:'))).toBe(false);
  });

  it('el aviso de presupuesto se muestra una sola vez por categoría, mes y nivel', async () => {
    await repos.presupuestos.guardar(MES, [{ categoriaId: cat.Comida, importe: 10000 }]);
    const gasto = (importe: number) =>
      repos.movimientos.crear({
        tipo: 'gasto',
        fecha: HOY,
        importe,
        cuentaId: bancoId,
        categoriaId: cat.Comida,
      });
    const primero = await gasto(8500);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(sistema.mostrados).toHaveLength(1);
    expect(sistema.mostrados[0]).toMatchObject({
      id: `fc:presupuesto:${MES}:${cat.Comida}:80`,
      titulo: 'Presupuesto de Comida',
      cuerpo: 'Llevas el 85 % de lo previsto este mes.',
    });
    // Recalcular otra vez no lo repite.
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(sistema.mostrados).toHaveLength(1);
    // Baja del 80 % y vuelve a pasar: sigue siendo un solo aviso.
    await repos.movimientos.borrar(primero.id);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    await repos.movimientos.restaurar(primero.id);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(sistema.mostrados).toHaveLength(1);
    // Al excederse llega el segundo aviso, también una sola vez.
    await gasto(3000);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(sistema.mostrados.map((a) => a.id)).toEqual([
      `fc:presupuesto:${MES}:${cat.Comida}:80`,
      `fc:presupuesto:${MES}:${cat.Comida}:100`,
    ]);
    expect(sistema.mostrados[1].cuerpo).toMatch(/^Te has pasado 15,00/);
  });

  it('con el aviso de presupuesto desactivado no se muestra ni se da por emitido', async () => {
    await repos.presupuestos.guardar(MES, [
      { categoriaId: cat.Comida, importe: 10000 },
      { categoriaId: cat.Ocio, importe: 1000 },
    ]);
    await repos.movimientos.crear({
      tipo: 'gasto',
      fecha: HOY,
      importe: 900,
      cuentaId: bancoId,
      categoriaId: cat.Ocio,
    });
    await recalcularAvisos(repos, falso, { ...TODOS, presupuesto: false }, AHORA);
    expect(sistema.mostrados).toEqual([]);
    // Al activarlo después, llega.
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    expect(sistema.mostrados.map((a) => a.id)).toEqual([`fc:presupuesto:${MES}:${cat.Ocio}:80`]);
  });

  it('avisa del valor de una inversión cuando cumple 30 días', async () => {
    const broker = await repos.cuentas.crear({
      nombre: 'Bróker',
      tipo: 'inversion',
      saldoInicial: 0,
      fechaSaldoInicial: sumarDias(HOY, -60),
    });
    await repos.valores.registrar({
      cuentaId: broker.id,
      fecha: sumarDias(HOY, -10),
      valor: 50000,
    });
    await recalcularAvisos(repos, falso, TODOS, AHORA);
    const id = `fc:inversion:${broker.id}:${sumarDias(HOY, -10)}`;
    expect(sistema.programados.get(id)?.instante).toBe(instanteLocal(sumarDias(HOY, 20), 9));
    expect(sistema.programados.get(id)?.aviso).toMatchObject({
      titulo: 'Bróker',
      datos: { ruta: '/detalle-de-cuenta' },
    });
  });

  it('con más de 40 candidatos nunca deja más de 40 programados', async () => {
    for (let i = 0; i < 20; i++) {
      await repos.reglas.crear({
        nombre: `Fijo ${i}`,
        clase: 'fijo',
        importe: 100 + i,
        cuentaId: bancoId,
        categoriaId: cat.Ocio,
        periodicidad: 'mensual',
        diaDelMes: (i % 28) + 1,
        fechaInicio: `${MES}-01`,
      });
    }
    expect(await recalcularAvisos(repos, falso, TODOS, AHORA)).toBe(40);
    expect(sistema.programados.size).toBe(40);
  });
});

describe('aviso tocado', () => {
  it('abre la pantalla que le corresponde, con sus parámetros', () => {
    expect(
      destinoDelAviso({
        ruta: '/cobro',
        parametros: JSON.stringify({ reglaId: 'r1', mes: '2026-11' }),
      }),
    ).toEqual({ pathname: '/cobro', params: { reglaId: 'r1', mes: '2026-11' } });
    expect(destinoDelAviso({ ruta: '/capturas', parametros: '{}' })).toEqual({
      pathname: '/capturas',
      params: {},
    });
  });

  it('el aviso de la acción de Atajos abre la bandeja en esa captura', () => {
    expect(destinoDelAviso({ capturaId: 'cola-9' })).toEqual({
      pathname: '/capturas',
      params: { cola: 'cola-9' },
    });
  });

  it('ignora lo que no es una ruta de la app o trae datos estropeados', () => {
    expect(destinoDelAviso({})).toBeNull();
    expect(destinoDelAviso({ ruta: 'https://ejemplo.invalid' })).toBeNull();
    expect(destinoDelAviso({ ruta: 12 })).toBeNull();
    expect(destinoDelAviso({ ruta: '/plan', parametros: 'no es json' })).toEqual({
      pathname: '/plan',
      params: {},
    });
    expect(
      destinoDelAviso({ ruta: '/plan', parametros: JSON.stringify({ a: 1, b: 'x' }) }),
    ).toEqual({
      pathname: '/plan',
      params: { b: 'x' },
    });
  });
});

describe('preferencias de avisos', () => {
  it('lo que falta o no se entiende queda desactivado', () => {
    expect(interpretarPreferencias(null)).toEqual(SIN_AVISOS);
    expect(interpretarPreferencias('no es json')).toEqual(SIN_AVISOS);
    expect(interpretarPreferencias('[]')).toEqual(SIN_AVISOS);
    expect(
      interpretarPreferencias(JSON.stringify({ cobros: true, capturas: 'sí', otro: true })),
    ).toEqual({
      ...SIN_AVISOS,
      cobros: true,
    });
  });
});

describe('pantalla Avisos', () => {
  it('arranca con todo desactivado y sin pedir el permiso', async () => {
    sistema.permiso = 'sin_decidir';
    await pintar(<PantallaDeAvisos />);
    expect(await screen.findByTestId('permiso-sin-decidir')).toBeTruthy();
    for (const tipo of ['cobros', 'presupuesto', 'capturas', 'inversion']) {
      expect(screen.getByTestId(`aviso-${tipo}`).props.value).toBe(false);
    }
    expect(sistema.veces).toBe(0);
    expect(screen.queryByTestId('permiso-denegado')).toBeNull();
  });

  it('al activar el primero pide el permiso y, concedido, programa los avisos', async () => {
    sistema.permiso = 'sin_decidir';
    await pintar(<PantallaDeAvisos />);
    await fireEvent(await screen.findByTestId('aviso-cobros'), 'valueChange', true);
    await waitFor(() => expect(screen.getByTestId('aviso-cobros').props.value).toBe(true));
    expect(sistema.veces).toBe(1);
    expect(interpretarPreferencias(sistema.guardadas)).toEqual({ ...SIN_AVISOS, cobros: true });
    await waitFor(() =>
      expect(screen.getByTestId('avisos-programados')).toHaveTextContent(
        /Avisos programados ahora: \d+/,
      ),
    );
    expect(sistema.programados.size).toBeGreaterThan(0);
    // Con el permiso ya concedido, activar otro no vuelve a pedirlo.
    await fireEvent(screen.getByTestId('aviso-capturas'), 'valueChange', true);
    await waitFor(() => expect(screen.getByTestId('aviso-capturas').props.value).toBe(true));
    expect(sistema.veces).toBe(1);
    // Desactivar el de cobros quita sus avisos.
    await fireEvent(screen.getByTestId('aviso-cobros'), 'valueChange', false);
    await waitFor(() => expect(sistema.programados.size).toBe(0));
  });

  it('si la persona rechaza el permiso, el interruptor no se activa y lo explica', async () => {
    sistema.permiso = 'sin_decidir';
    sistema.alPedir = 'denegado';
    await pintar(<PantallaDeAvisos />);
    await fireEvent(await screen.findByTestId('aviso-cobros'), 'valueChange', true);
    expect(await screen.findByTestId('mensaje-de-avisos')).toHaveTextContent(/No has dado permiso/);
    expect(screen.getByTestId('aviso-cobros').props.value).toBe(false);
    expect(sistema.guardadas).toBeNull();
    expect(screen.getByTestId('permiso-denegado')).toHaveTextContent(/Ajustes del iPhone/);
    expect(screen.getByTestId('abrir-ajustes')).toBeTruthy();
  });

  it('con el permiso denegado, y concedido después desde Ajustes, vuelve a funcionar', async () => {
    sistema.guardadas = JSON.stringify({ ...SIN_AVISOS, cobros: true });
    sistema.permiso = 'denegado';
    await pintar(<PantallaDeAvisos />);
    expect(await screen.findByTestId('permiso-denegado')).toBeTruthy();
    // Lo que la persona eligió se conserva aunque ahora no lleguen avisos.
    expect(screen.getByTestId('aviso-cobros').props.value).toBe(true);
    expect(
      await recalcularAvisos(repos, falso, interpretarPreferencias(sistema.guardadas), AHORA),
    ).toBe(0);
    await screen.unmount();

    sistema.permiso = 'concedido';
    await pintar(<PantallaDeAvisos />);
    await waitFor(() => expect(screen.getByTestId('aviso-cobros').props.value).toBe(true));
    expect(screen.queryByTestId('permiso-denegado')).toBeNull();
    expect(
      await recalcularAvisos(repos, falso, interpretarPreferencias(sistema.guardadas), AHORA),
    ).toBeGreaterThan(0);
  });
});

describe('aviso previo de un fijo', () => {
  it('el formulario guarda cuántos días antes avisar', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await pintar(<PantallaDeRegla />);
    await fireEvent.changeText(await screen.findByTestId('nombre'), 'Seguro');
    await fireEvent.changeText(screen.getByTestId('importe'), '20');
    await fireEvent.press(screen.getByTestId('selector-categoria'));
    await fireEvent.press(await screen.findByText('Ocio'));
    expect(screen.getByTestId('aviso-dias')).toHaveTextContent('El mismo día');
    await fireEvent.press(screen.getByTestId('aviso-dias-mas'));
    expect(screen.getByTestId('aviso-dias')).toHaveTextContent('1 día antes');
    await fireEvent.press(screen.getByTestId('aviso-dias-mas'));
    await fireEvent.press(screen.getByTestId('aviso-dias-mas'));
    expect(screen.getByTestId('aviso-dias')).toHaveTextContent('3 días antes');
    await fireEvent.press(screen.getByTestId('guardar'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const regla = (await repos.reglas.listar()).find((r) => r.nombre === 'Seguro');
    expect(regla?.avisoDiasAntes).toBe(3);
  });
});
