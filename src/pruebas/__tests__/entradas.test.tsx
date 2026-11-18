/**
 * Entradas externas (bloque 4a): cada pantalla con parámetros de ruta frente
 * a valores hostiles, y los textos de las acciones de Atajos. Base de datos
 * real en memoria y datos de ejemplo.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentType, ReactElement } from 'react';

import Analisis from '@/app/(tabs)/analisis';
import Movimientos from '@/app/(tabs)/movimientos';
import Plan from '@/app/(tabs)/plan';
import Aportacion from '@/app/aportacion';
import Bandeja from '@/app/capturas';
import Cobro from '@/app/cobro';
import PantallaDeCuenta from '@/app/cuenta';
import DetalleDeCuenta from '@/app/detalle-de-cuenta';
import PantallaDeMovimiento from '@/app/movimiento';
import PantallaDeObjetivo from '@/app/objetivo';
import EditarObjetivo from '@/app/objetivo-editar';
import PantallaDePresupuesto from '@/app/presupuesto';
import PantallaDeRegla from '@/app/regla';
import PantallaDeValor from '@/app/valor-de-inversion';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import type { BaseDeDatos } from '@/datos/bd';
import { ACCION_ANADIR_GASTO, ACCION_REGISTRAR_PAGO } from '@/dominio/captura';
import { fechaLocal } from '@/dominio/modelo';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { destinoDelAviso } from '@/estado/avisos';
import { importarInvocaciones } from '@/estado/cola';
import { ProveedorDeDatos } from '@/estado/Datos';
import { crearEntornoDePrueba } from '@/pruebas/bdDePrueba';
import { HOSTILES, UUID_DE_EJEMPLO } from '@/pruebas/hostiles';

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
/** Cada pantalla con parámetros de ruta y los nombres de sus parámetros. */
const PANTALLAS: [string, ComponentType, string[]][] = [
  ['movimiento', PantallaDeMovimiento, ['id', 'capturaId']],
  ['capturas', Bandeja, ['id', 'cola']],
  ['cuenta', PantallaDeCuenta, ['id']],
  ['detalle-de-cuenta', DetalleDeCuenta, ['id', 'mes']],
  ['objetivo', PantallaDeObjetivo, ['id']],
  ['objetivo-editar', EditarObjetivo, ['id']],
  ['aportacion', Aportacion, ['objetivoId']],
  ['cobro', Cobro, ['reglaId', 'mes']],
  ['presupuesto', PantallaDePresupuesto, ['mes']],
  ['regla', PantallaDeRegla, ['id', 'clase', 'objetivoId', 'importe', 'cuentaDestinoId', 'nombre']],
  ['valor-de-inversion', PantallaDeValor, ['id', 'cuentaId']],
  ['(tabs)/plan', Plan, ['seccion', 'mes', 'peticion']],
  ['(tabs)/analisis', Analisis, ['vista', 'mes', 'anio', 'dia', 'peticion']],
  ['(tabs)/movimientos', Movimientos, ['categoriaId', 'cuentaId', 'mes', 'dia', 'peticion']],
];

let repos: Repositorios;
let bd: BaseDeDatos;
let cuentaId: string;

function pintar(pantalla: ReactElement) {
  return render(
    <ProveedorDeDatos>
      <ProveedorDeAvisos>{pantalla}</ProveedorDeAvisos>
    </ProveedorDeDatos>,
  );
}

function conParametros(parametros: Record<string, unknown>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(parametros);
}

/** Todo el contenido de la base de datos, para comprobar que abrir una pantalla no escribe nada. */
async function volcado(): Promise<string> {
  const tablas = await bd.consultar<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const partes: string[] = [];
  for (const { name } of tablas) {
    partes.push(name, JSON.stringify(await bd.consultar(`SELECT * FROM ${name} ORDER BY 1`)));
  }
  return partes.join('\n');
}

beforeAll(async () => {
  bd = jest.requireMock('@/datos/bdExpo').bdCompartida;
  repos = await prepararBaseDeDatos(bd, crearEntornoDePrueba(new Date().toISOString()), [
    { nombre: 'Comida', tipo: 'gasto' as const },
  ]);
  const cuenta = await repos.cuentas.crear({ nombre: 'Banco de ejemplo', tipo: 'banco' });
  cuentaId = cuenta.id;
  const [comida] = await repos.categorias.listar();
  await repos.movimientos.crear({
    tipo: 'gasto',
    importe: 1250,
    cuentaId,
    categoriaId: comida.id,
    fecha: HOY,
    nombre: 'Compra de ejemplo',
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  conParametros({});
});

describe('todas las pantallas pasan por la validación común', () => {
  const raiz = join(__dirname, '..', '..', 'app');
  const ficheros = (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => [f, readFileSync(join(raiz, f), 'utf8')] as const)
    .filter(([, codigo]) => codigo.includes('useLocalSearchParams'));

  it('son las catorce pantallas de la auditoría y esta prueba las cubre todas', () => {
    expect(ficheros.map(([f]) => f.replace(/\.tsx$/, '')).sort()).toEqual(
      PANTALLAS.map(([nombre]) => nombre).sort(),
    );
  });

  it.each(ficheros)('%s solo lee sus parámetros con leerParametros', (_fichero, codigo) => {
    const usos = codigo.match(/useLocalSearchParams\s*[<(]/g) ?? [];
    const validados = codigo.match(/leerParametros\(useLocalSearchParams\(\),/g) ?? [];
    expect(usos).toHaveLength(1);
    expect(validados).toHaveLength(1);
  });

  it('cada parámetro declarado en una pantalla está en la lista de esta prueba', () => {
    for (const [fichero, codigo] of ficheros) {
      const esquema = /leerParametros\(useLocalSearchParams\(\), \{([^]*?)\n? *\}\);?/.exec(codigo);
      const claves = [...(esquema?.[1] ?? '').matchAll(/(\w+): (?:'|\{)/g)].map((m) => m[1]);
      const esperadas = PANTALLAS.find(([n]) => `${n}.tsx` === fichero)?.[2] ?? [];
      expect([fichero, claves.sort()]).toEqual([fichero, [...esperadas].sort()]);
    }
  });
});

describe('valores hostiles en los parámetros de ruta', () => {
  it.each(PANTALLAS)(
    '%s: ningún valor hostil rompe la pantalla ni escribe en la base de datos',
    async (_nombre, Pantalla, parametros) => {
      const antes = await volcado();
      for (const parametro of parametros) {
        for (const [, valor] of HOSTILES) {
          conParametros({ [parametro]: valor });
          const pantalla = await pintar(<Pantalla />);
          await waitFor(() => expect(pantalla.toJSON()).not.toBeNull());
          await pantalla.unmount();
        }
      }
      // Todos los parámetros hostiles a la vez.
      conParametros(Object.fromEntries(parametros.map((p, i) => [p, HOSTILES[i % 7][1]])));
      const pantalla = await pintar(<Pantalla />);
      await waitFor(() => expect(pantalla.toJSON()).not.toBeNull());
      await pantalla.unmount();
      expect(await volcado()).toBe(antes);
      expect(router.push).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    },
    60_000,
  );
});

describe('financialcontrol://movimiento?id=…', () => {
  it('vacío: abre el alta', async () => {
    conParametros({ id: '' });
    await pintar(<PantallaDeMovimiento />);
    expect(await screen.findByTestId('importe')).toBeTruthy();
    expect(screen.queryByText('Este movimiento ya no existe.')).toBeNull();
  });

  it('un UUID que no existe: «No encontrado» y se puede volver', async () => {
    conParametros({ id: UUID_DE_EJEMPLO });
    await pintar(<PantallaDeMovimiento />);
    expect(await screen.findByText('Este movimiento ya no existe.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cancelar'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it.each(HOSTILES)(
    'malformado (%s): «No encontrado», sin consultar con ese texto',
    async (_n, valor) => {
      const obtener = jest.spyOn(bd, 'consultar');
      conParametros({ id: valor });
      await pintar(<PantallaDeMovimiento />);
      expect(await screen.findByText('Este movimiento ya no existe.')).toBeTruthy();
      expect(screen.getByTestId('cancelar')).toBeTruthy();
      // Ningún parámetro de ninguna consulta lleva el texto llegado de fuera.
      const enviados = obtener.mock.calls.flatMap(([, parametros]) => parametros ?? []);
      expect(enviados).not.toContain(valor);
      for (const enviado of enviados) {
        if (typeof enviado === 'string') expect(enviado.length).toBeLessThanOrEqual(200);
      }
      obtener.mockRestore();
    },
  );
});

describe('un identificador válido que no existe dice que no existe y deja volver', () => {
  const casos: [string, ComponentType, string, string | RegExp, string][] = [
    ['cuenta', PantallaDeCuenta, 'id', 'Esta cuenta ya no existe.', 'cancelar'],
    ['detalle-de-cuenta', DetalleDeCuenta, 'id', 'Esta cuenta ya no existe.', 'volver'],
    ['objetivo', PantallaDeObjetivo, 'id', 'Este objetivo ya no existe.', 'volver'],
    ['objetivo-editar', EditarObjetivo, 'id', 'Este objetivo ya no existe.', 'cancelar'],
    ['aportacion', Aportacion, 'objetivoId', 'Este objetivo ya no existe.', 'cancelar'],
    ['regla', PantallaDeRegla, 'id', 'Este fijo ya no existe.', 'cancelar'],
    ['valor-de-inversion', PantallaDeValor, 'id', 'Este valor ya no existe.', 'cancelar'],
  ];
  it.each(casos)('%s', async (_nombre, Pantalla, parametro, texto, salida) => {
    for (const valor of [UUID_DE_EJEMPLO, 'no-es-un-id', "x'; DROP TABLE cuenta; --"]) {
      conParametros({ [parametro]: valor });
      const pantalla = await pintar(<Pantalla />);
      expect(await screen.findByText(texto)).toBeTruthy();
      expect(screen.getByTestId(salida)).toBeTruthy();
      await pantalla.unmount();
    }
  });

  it('cobro: sin fijo válido no ofrece confirmar nada', async () => {
    conParametros({ reglaId: UUID_DE_EJEMPLO, mes: HOY.slice(0, 7) });
    await pintar(<Cobro />);
    expect(await screen.findByTestId('cobro-no-disponible')).toBeTruthy();
    expect(screen.queryByTestId('guardar')).toBeNull();
    expect(screen.getByTestId('cancelar')).toBeTruthy();
  });
});

describe('plan?seccion=…&mes=… y analisis?vista=…&anio=…', () => {
  const elegido = (id: string) => screen.getByTestId(id).props.accessibilityState?.selected;

  it('Plan: una sección válida se abre; una malformada o repetida deja la de por defecto', async () => {
    conParametros({ seccion: 'fijos', peticion: 'p1' });
    const valida = await pintar(<Plan />);
    await waitFor(() => expect(elegido('segmento-fijos')).toBe(true));
    await valida.unmount();
    for (const [, valor] of [...HOSTILES, ['repetida válida', ['fijos', 'objetivos']] as const]) {
      conParametros({ seccion: valor, mes: valor, peticion: 'p2' });
      const pantalla = await pintar(<Plan />);
      await waitFor(() => expect(elegido('segmento-presupuesto')).toBe(true));
      await pantalla.unmount();
    }
  });

  it('Análisis: una vista válida se abre; una malformada deja la de por defecto', async () => {
    conParametros({ vista: 'anio', anio: '2026', peticion: 'a1' });
    const valida = await pintar(<Analisis />);
    await waitFor(() => expect(elegido('segmento-anio')).toBe(true));
    expect(screen.getByTestId('anio-elegido')).toHaveTextContent('2026');
    await valida.unmount();
    for (const [, valor] of HOSTILES) {
      conParametros({ vista: valor, anio: valor, mes: valor, dia: valor, peticion: 'a2' });
      const pantalla = await pintar(<Analisis />);
      await waitFor(() => expect(elegido('segmento-dia')).toBe(true));
      await pantalla.unmount();
    }
  });

  it('Análisis: un año fuera de rango se ignora', async () => {
    conParametros({ vista: 'anio', anio: '9999', peticion: 'a3' });
    await pintar(<Analisis />);
    await waitFor(() => expect(elegido('segmento-anio')).toBe(true));
    expect(screen.getByTestId('anio-elegido')).toHaveTextContent(HOY.slice(0, 4));
  });
});

describe('un enlace no guarda nada: como mucho deja un formulario empezado', () => {
  it('regla: el nombre llega limpio y acotado, el importe solo si es una cantidad', async () => {
    const antes = await volcado();
    conParametros({
      nombre: `Alquiler\n\u0000\u202E${'x'.repeat(5_000)}`,
      importe: '650,00',
      clase: 'suscripcion',
    });
    const buena = await pintar(<PantallaDeRegla />);
    const nombre = (await screen.findByTestId('nombre')).props.value as string;
    expect(nombre.startsWith('Alquiler x')).toBe(true);
    expect([...nombre].length).toBeLessThanOrEqual(80);
    expect(/[\u0000-\u001F\u202E]/.test(nombre)).toBe(false);
    expect(screen.getByTestId('importe').props.value).toBe('650,00');
    await buena.unmount();

    conParametros({ nombre: ['a', 'b'], importe: '1); DELETE FROM regla; --', clase: 'root' });
    await pintar(<PantallaDeRegla />);
    expect((await screen.findByTestId('nombre')).props.value).toBe('');
    expect(screen.getByTestId('importe').props.value).toBe('');
    expect(await repos.reglas.listar()).toHaveLength(0);
    expect(await volcado()).toBe(antes);
  });
});

describe('avisos', () => {
  it('un aviso solo lleva a las pantallas de los avisos de la app', () => {
    for (const ruta of ['/movimiento', '/ajustes', '/', '//otra', '/cobro/../ajustes', 'cobro']) {
      expect(destinoDelAviso({ ruta, parametros: '{}' })).toBeNull();
    }
    expect(destinoDelAviso({ ruta: '/plan', parametros: '{"seccion":"presupuesto"}' })).toEqual({
      pathname: '/plan',
      params: { seccion: 'presupuesto' },
    });
  });

  it('el identificador de cola de un aviso se acota', () => {
    const destino = destinoDelAviso({ capturaId: 'c'.repeat(5_000) });
    expect(destino?.params.cola).toHaveLength(80);
  });
});

describe('acciones de Atajos', () => {
  const sucio = `Bar\n\tLa\u0000 Esquina\u202E ${'z'.repeat(5_000)}`;

  it('«Registrar pago» con un comercio de 5.000 caracteres y caracteres de control', async () => {
    await importarInvocaciones(
      repos,
      [
        {
          id: 'hostil-1',
          name: ACCION_REGISTRAR_PAGO,
          params: { importe: '12,34 €', comercio: sucio, tarjeta: `Visa\r\n${'9'.repeat(900)}` },
          createdAt: Date.now(),
        },
      ],
      new Date().toISOString(),
    );
    const captura = (await repos.capturas.listar(['pendiente'])).find(
      (c) => c.idDeCola === 'hostil-1',
    );
    expect(captura).toBeDefined();
    expect(captura!.comercioTexto.startsWith('Bar La Esquina z')).toBe(true);
    expect([...captura!.comercioTexto].length).toBeLessThanOrEqual(200);
    expect([...captura!.tarjetaTexto].length).toBeLessThanOrEqual(200);
    for (const texto of [captura!.comercioTexto, captura!.tarjetaTexto, captura!.importeTexto]) {
      expect(/[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E]/.test(texto)).toBe(false);
    }
    expect(captura!.importe).toBe(1234);
  });

  it('«Añadir gasto» con textos de control no rompe la importación de las demás', async () => {
    const antes = await repos.capturas.contarPendientes();
    await importarInvocaciones(
      repos,
      [
        {
          id: 'hostil-2',
          name: ACCION_ANADIR_GASTO,
          params: { importe: '\u0000', categoria: sucio, cuenta: sucio },
          createdAt: 1,
        },
        { id: 'hostil-3', name: ACCION_REGISTRAR_PAGO, params: null as never, createdAt: 2 },
        {
          id: 'hostil-4',
          name: ACCION_REGISTRAR_PAGO,
          params: { importe: '3,00 €', comercio: 'Kiosco' },
          createdAt: 3,
        },
      ],
      new Date().toISOString(),
    );
    const pendientes = await repos.capturas.listar(['pendiente']);
    expect(pendientes.some((c) => c.idDeCola === 'hostil-4')).toBe(true);
    expect(await repos.capturas.contarPendientes()).toBeGreaterThan(antes);
    for (const c of pendientes) {
      for (const texto of [c.comercioTexto, c.tarjetaTexto, c.importeTexto]) {
        expect([...texto].length).toBeLessThanOrEqual(200);
        expect(/[\u0000-\u001F\u007F-\u009F]/.test(texto)).toBe(false);
      }
    }
  });

  it('el código Swift limpia igual: control fuera y 200 caracteres como mucho', () => {
    const swift = readFileSync(
      join(__dirname, '..', '..', '..', 'app-intents', 'CapturaEnBruto.swift'),
      'utf8',
    );
    expect(swift).toContain('static let longitudMaxima = 200');
    expect(swift).toContain('CharacterSet.controlCharacters');
    expect(swift).toContain('prefix(longitudMaxima)');
    // Las dos acciones pasan todos sus textos por la limpieza.
    for (const fichero of ['RegistrarPagoIntent.swift', 'AnadirGastoIntent.swift']) {
      const codigo = readFileSync(
        join(__dirname, '..', '..', '..', 'app-intents', fichero),
        'utf8',
      );
      const textos =
        codigo.match(/var (importe|comercio|tarjeta|categoria|cuenta): String\?/g) ?? [];
      const limpiados = codigo.match(/CapturaEnBruto\.limpiar\(/g) ?? [];
      expect(limpiados.length).toBe(textos.length);
    }
  });
});
