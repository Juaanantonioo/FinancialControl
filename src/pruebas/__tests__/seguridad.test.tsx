/**
 * Seguridad local (bloque 4a): bloqueo de la app y modo privado. El
 * autenticador y el almacén son de mentira; la base de datos es real, en
 * memoria, con datos de ejemplo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState, Text } from 'react-native';

import Ajustes from '@/app/ajustes';
import Seguridad from '@/app/seguridad';
import { PuertaDeSeguridad } from '@/componentes/seguridad/Puerta';
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { instanteLocal, type Aviso, type Preferencias } from '@/dominio/avisos';
import {
  interpretarBloqueo,
  SIN_BLOQUEO,
  type AjustesDeBloqueo,
  type Capacidad,
  type Instante,
  type ResultadoDeAutenticacion,
} from '@/dominio/bloqueo';
import { ACCION_REGISTRAR_PAGO } from '@/dominio/captura';
import { fechaLocal } from '@/dominio/modelo';
import { recalcularAvisos, textoDeAviso, textoPrivadoDeAviso } from '@/estado/avisos';
import { importarInvocaciones } from '@/estado/cola';
import {
  alCambiarElEstadoDeLaApp,
  cambiarBloqueo,
  cambiarModoPrivado,
  desbloquear,
  elegirEspera,
  estadoDeSeguridad,
  iniciarSeguridad,
  pedirSiHaceFalta,
} from '@/estado/seguridad';
import { datosParaElWidget } from '@/estado/widget';
import es from '@/i18n/es.json';
import type { Autenticador } from '@/lib/autenticacion';
import type { AvisoParaMostrar, Notificador } from '@/lib/notificaciones';
import {
  CLAVE_DE_MODO_PRIVADO,
  interpretarModoPrivado,
  type AlmacenDeSeguridad,
} from '@/lib/seguridad';
import { crearEntornoDePrueba } from '@/pruebas/bdDePrueba';

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
// En las pruebas no hay ventana nativa: el contenido que va «sobre todo» se pinta en su sitio.
jest.mock('@/componentes/seguridad/SobreTodo', () => ({
  SobreTodo: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/lib/almacenDeApariencia', () => ({
  almacenDeApariencia: { leer: () => 'automatico', guardar: jest.fn() },
}));

const RAIZ = join(__dirname, '..', '..', '..');
const leer = (...ruta: string[]) => readFileSync(join(RAIZ, ...ruta), 'utf8');

// ------------------------------------------------- almacén y autenticador falsos

type Guardado = { bloqueo: string | null; privado: unknown; fallaAlGuardar: boolean };
const guardado: Guardado = { bloqueo: null, privado: undefined, fallaAlGuardar: false };

const almacen: AlmacenDeSeguridad = {
  leerBloqueo: () => interpretarBloqueo(guardado.bloqueo),
  guardarBloqueo: async (ajustes) => {
    if (guardado.fallaAlGuardar) throw new Error('sin espacio');
    guardado.bloqueo = JSON.stringify(ajustes);
  },
  leerModoPrivado: () => interpretarModoPrivado(guardado.privado),
  guardarModoPrivado: async (activo) => {
    if (guardado.fallaAlGuardar) throw new Error('sin espacio');
    guardado.privado = activo;
  },
};

const sistema = {
  capacidad: 'biometria' as Capacidad,
  /** Respuestas de los próximos intentos; cuando se acaban, vale `porDefecto`. */
  respuestas: [] as ResultadoDeAutenticacion[],
  porDefecto: 'correcto' as ResultadoDeAutenticacion,
  intentos: 0,
};

const autenticador: Autenticador = {
  capacidad: async () => sistema.capacidad,
  autenticar: async () => {
    sistema.intentos++;
    return sistema.respuestas.shift() ?? sistema.porDefecto;
  },
};

const T0: Instante = { reloj: 1_800_000_000_000, monotono: 10_000 };
const tras = (ms: number): Instante => ({ reloj: T0.reloj + ms, monotono: T0.monotono + ms });
/** Deja que terminen las autenticaciones lanzadas sin esperar. */
const asentar = () => waitFor(() => expect(estadoDeSeguridad().autenticando).toBe(false));

function arrancar(bloqueo: AjustesDeBloqueo | string | null = null, privado: unknown = undefined) {
  guardado.bloqueo =
    bloqueo === null || typeof bloqueo === 'string' ? bloqueo : JSON.stringify(bloqueo);
  guardado.privado = privado;
  iniciarSeguridad(almacen, autenticador);
}

beforeEach(() => {
  jest.clearAllMocks();
  guardado.fallaAlGuardar = false;
  sistema.capacidad = 'biometria';
  sistema.respuestas = [];
  sistema.porDefecto = 'correcto';
  sistema.intentos = 0;
  // La app está delante, como cuando la persona la abre.
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  arrancar();
});

// ------------------------------------------------------------- arranque

describe('arranque', () => {
  it('recién instalada: sin bloqueo, sin modo privado, sin nada tapado', () => {
    expect(estadoDeSeguridad()).toEqual({
      bloqueo: SIN_BLOQUEO,
      privado: false,
      bloqueada: false,
      cubierta: false,
      autenticando: false,
      fallo: false,
      sinProteccion: false,
    });
  });

  it('con el bloqueo activo arranca bloqueada, sea cual sea la espera', () => {
    for (const espera of ['inmediato', '1min', '5min'] as const) {
      arrancar({ activo: true, espera });
      expect(estadoDeSeguridad().bloqueada).toBe(true);
    }
  });

  it.each([
    ['texto roto', '{{{'],
    ['valor desconocido', '{"activo":"quizá"}'],
    ['vacío', ''],
  ])('preferencia de bloqueo corrupta (%s): arranca bloqueada y sin espera', (_n, texto) => {
    arrancar(texto);
    expect(estadoDeSeguridad()).toMatchObject({
      bloqueada: true,
      bloqueo: { activo: true, espera: 'inmediato' },
    });
  });

  it('una preferencia corrupta no deja a nadie fuera: se entra autenticándose', async () => {
    arrancar('basura');
    await desbloquear();
    expect(estadoDeSeguridad().bloqueada).toBe(false);
  });

  it('el modo privado solo se activa con un sí guardado', () => {
    for (const valor of [undefined, null, 'true', 'si', 0, {}, [], false]) {
      expect(interpretarModoPrivado(valor)).toBe(false);
    }
    expect(interpretarModoPrivado(true)).toBe(true);
    expect(interpretarModoPrivado(1)).toBe(true);
    arrancar(null, true);
    expect(estadoDeSeguridad()).toMatchObject({ privado: true, bloqueada: false });
  });
});

// ------------------------------------------------------------ desbloqueo

describe('desbloqueo', () => {
  beforeEach(() => arrancar({ activo: true, espera: 'inmediato' }));

  it('autenticación correcta: abre', async () => {
    await desbloquear();
    expect(estadoDeSeguridad()).toMatchObject({ bloqueada: false, fallo: false });
    expect(sistema.intentos).toBe(1);
  });

  it('biometría fallida tres veces: sigue bloqueada las tres y lo dice', async () => {
    sistema.respuestas = ['fallido', 'fallido', 'fallido'];
    for (let i = 0; i < 3; i++) {
      await desbloquear();
      expect(estadoDeSeguridad()).toMatchObject({ bloqueada: true, fallo: true });
    }
    expect(sistema.intentos).toBe(3);
    // A la cuarta, con el código del iPhone, entra.
    await desbloquear();
    expect(estadoDeSeguridad()).toMatchObject({ bloqueada: false, fallo: false });
  });

  it('cancelada por la persona: sigue bloqueada, sin mensaje de error', async () => {
    sistema.respuestas = ['cancelado'];
    await desbloquear();
    expect(estadoDeSeguridad()).toMatchObject({ bloqueada: true, fallo: false });
  });

  it('biometría desactivada en el sistema pero con código: sigue bloqueada', async () => {
    sistema.respuestas = ['no_disponible'];
    sistema.capacidad = 'codigo';
    await desbloquear();
    expect(estadoDeSeguridad()).toMatchObject({ bloqueada: true, sinProteccion: false });
  });

  it('iPhone que ya no tiene código ni biometría: entra y avisa de que no hay protección', async () => {
    sistema.respuestas = ['no_disponible'];
    sistema.capacidad = 'ninguna';
    await desbloquear();
    expect(estadoDeSeguridad()).toMatchObject({ bloqueada: false, sinProteccion: true });
  });

  it('un error inesperado del sistema es un no', async () => {
    iniciarSeguridad(almacen, {
      capacidad: async () => 'biometria',
      autenticar: async () => {
        throw new Error('fallo interno');
      },
    });
    await desbloquear();
    expect(estadoDeSeguridad()).toMatchObject({ bloqueada: true, autenticando: false });
  });

  it('dos toques seguidos piden autenticación una sola vez', async () => {
    await Promise.all([desbloquear(), desbloquear()]);
    expect(sistema.intentos).toBe(1);
  });
});

// ------------------------------------------------- segundo plano y vuelta

describe('segundo plano', () => {
  async function entrar(espera: AjustesDeBloqueo['espera']) {
    arrancar({ activo: true, espera });
    await desbloquear();
    sistema.intentos = 0;
  }

  it('volver a los 30 segundos con cada uno de los tres tiempos', async () => {
    const esperado = { inmediato: true, '1min': false, '5min': false } as const;
    for (const espera of ['inmediato', '1min', '5min'] as const) {
      await entrar(espera);
      sistema.porDefecto = 'cancelado';
      alCambiarElEstadoDeLaApp('inactive', tras(0));
      alCambiarElEstadoDeLaApp('background', tras(0));
      alCambiarElEstadoDeLaApp('active', tras(30_000));
      await asentar();
      expect([espera, estadoDeSeguridad().bloqueada]).toEqual([espera, esperado[espera]]);
      expect(estadoDeSeguridad().cubierta).toBe(false);
      sistema.porDefecto = 'correcto';
    }
  });

  it('1 y 5 minutos: bloquea al superarlos', async () => {
    for (const [espera, ms] of [
      ['1min', 61_000],
      ['5min', 301_000],
    ] as const) {
      await entrar(espera);
      sistema.porDefecto = 'cancelado';
      alCambiarElEstadoDeLaApp('background', tras(0));
      expect(estadoDeSeguridad().bloqueada).toBe(false);
      alCambiarElEstadoDeLaApp('active', tras(ms));
      await asentar();
      expect(estadoDeSeguridad().bloqueada).toBe(true);
      sistema.porDefecto = 'correcto';
    }
  });

  it('sin espera, la app queda bloqueada en cuanto sale, antes de volver', async () => {
    await entrar('inmediato');
    alCambiarElEstadoDeLaApp('background', tras(0));
    expect(estadoDeSeguridad()).toMatchObject({ bloqueada: true, cubierta: true });
  });

  it('cambio de hora hacia atrás en segundo plano: no se salta el bloqueo', async () => {
    await entrar('5min');
    sistema.porDefecto = 'cancelado';
    alCambiarElEstadoDeLaApp('background', tras(0));
    alCambiarElEstadoDeLaApp('active', {
      reloj: T0.reloj - 3_600_000,
      monotono: T0.monotono + 20_000,
    });
    await asentar();
    expect(estadoDeSeguridad().bloqueada).toBe(true);
  });

  it('con el bloqueo activo la app se cubre siempre al dejar de estar delante', async () => {
    await entrar('5min');
    alCambiarElEstadoDeLaApp('inactive', tras(0));
    expect(estadoDeSeguridad()).toMatchObject({ cubierta: true, bloqueada: false });
    alCambiarElEstadoDeLaApp('active', tras(500));
    expect(estadoDeSeguridad()).toMatchObject({ cubierta: false, bloqueada: false });
  });

  it('solo modo privado: se cubre, pero nunca se bloquea', () => {
    arrancar(null, true);
    alCambiarElEstadoDeLaApp('inactive', tras(0));
    alCambiarElEstadoDeLaApp('background', tras(0));
    expect(estadoDeSeguridad()).toMatchObject({ cubierta: true, bloqueada: false });
    alCambiarElEstadoDeLaApp('active', tras(3_600_000));
    expect(estadoDeSeguridad()).toMatchObject({ cubierta: false, bloqueada: false });
    expect(sistema.intentos).toBe(0);
  });

  it('sin bloqueo ni modo privado no cambia nada: ni se cubre ni se bloquea', () => {
    const antes = estadoDeSeguridad();
    alCambiarElEstadoDeLaApp('inactive', tras(0));
    alCambiarElEstadoDeLaApp('background', tras(0));
    expect(estadoDeSeguridad()).toEqual(antes);
    alCambiarElEstadoDeLaApp('active', tras(3_600_000));
    expect(estadoDeSeguridad()).toEqual(antes);
    expect(sistema.intentos).toBe(0);
  });

  it('al volver bloqueada pide autenticación sola una vez; si se cancela, no insiste', async () => {
    await entrar('inmediato');
    sistema.respuestas = ['cancelado'];
    alCambiarElEstadoDeLaApp('background', tras(0));
    alCambiarElEstadoDeLaApp('active', tras(5_000));
    await asentar();
    expect(sistema.intentos).toBe(1);
    // La hoja de Face ID al cerrarse devuelve la app a primer plano: no debe volver a pedir.
    alCambiarElEstadoDeLaApp('inactive', tras(6_000));
    alCambiarElEstadoDeLaApp('active', tras(7_000));
    await asentar();
    expect(sistema.intentos).toBe(1);
    expect(estadoDeSeguridad().bloqueada).toBe(true);
    // El botón sí vuelve a pedir.
    await desbloquear();
    expect(estadoDeSeguridad().bloqueada).toBe(false);
  });

  it('abierta en segundo plano por una acción de Atajos: no pide hasta estar delante', async () => {
    arrancar({ activo: true, espera: 'inmediato' });
    pedirSiHaceFalta('background');
    expect(sistema.intentos).toBe(0);
    alCambiarElEstadoDeLaApp('active', tras(1_000));
    await asentar();
    expect(sistema.intentos).toBe(1);
    expect(estadoDeSeguridad().bloqueada).toBe(false);
  });
});

// ------------------------------------------------------ activar y desactivar

describe('activar y desactivar el bloqueo', () => {
  it('activarlo pide autenticación y lo guarda', async () => {
    expect(await cambiarBloqueo(true)).toBe('correcto');
    expect(sistema.intentos).toBe(1);
    expect(estadoDeSeguridad().bloqueo.activo).toBe(true);
    expect(JSON.parse(guardado.bloqueo!)).toEqual({ activo: true, espera: 'inmediato' });
    // No bloquea en el acto: la persona acaba de autenticarse.
    expect(estadoDeSeguridad().bloqueada).toBe(false);
  });

  it('si la autenticación falla o se cancela, no se activa', async () => {
    for (const respuesta of ['fallido', 'cancelado'] as const) {
      sistema.respuestas = [respuesta];
      expect(await cambiarBloqueo(true)).toBe(respuesta);
      expect(estadoDeSeguridad().bloqueo.activo).toBe(false);
      expect(guardado.bloqueo).toBeNull();
    }
  });

  it('dispositivo sin código ni biometría: no se puede activar', async () => {
    sistema.capacidad = 'ninguna';
    sistema.respuestas = ['no_disponible'];
    expect(await cambiarBloqueo(true)).toBe('no_disponible');
    expect(estadoDeSeguridad().bloqueo.activo).toBe(false);
  });

  it('desactivarlo también pide autenticación', async () => {
    arrancar({ activo: true, espera: '1min' });
    await desbloquear();
    sistema.respuestas = ['fallido'];
    expect(await cambiarBloqueo(false)).toBe('fallido');
    expect(estadoDeSeguridad().bloqueo.activo).toBe(true);
    expect(await cambiarBloqueo(false)).toBe('correcto');
    expect(estadoDeSeguridad().bloqueo).toEqual({ activo: false, espera: '1min' });
  });

  it('la espera elegida se guarda', async () => {
    await cambiarBloqueo(true);
    await elegirEspera('5min');
    expect(JSON.parse(guardado.bloqueo!)).toEqual({ activo: true, espera: '5min' });
  });

  it('si no se puede guardar, el cambio vale hasta cerrar la app', async () => {
    guardado.fallaAlGuardar = true;
    expect(await cambiarBloqueo(true)).toBe('correcto');
    expect(estadoDeSeguridad().bloqueo.activo).toBe(true);
    await cambiarModoPrivado(true);
    expect(estadoDeSeguridad().privado).toBe(true);
  });
});

// ------------------------------------------------------------ la puerta

describe('pantalla de bloqueo', () => {
  const visible = (texto: string) => screen.queryByText(texto, { includeHiddenElements: false });

  it('con la app bloqueada no se alcanza nada del contenido hasta autenticarse', async () => {
    arrancar({ activo: true, espera: 'inmediato' });
    sistema.respuestas = ['cancelado'];
    await render(
      <PuertaDeSeguridad>
        <Text>Saldo de ejemplo: 1.234,56 €</Text>
      </PuertaDeSeguridad>,
    );
    await asentar();
    expect(screen.getByTestId('pantalla-de-bloqueo')).toBeTruthy();
    expect(visible('Saldo de ejemplo: 1.234,56 €')).toBeNull();
    expect(
      screen.getByTestId('contenido-de-la-app', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    // La pantalla de bloqueo no lleva ningún dato: solo el nombre de la app y cómo entrar.
    expect(within(screen.getByTestId('pantalla-de-bloqueo')).queryAllByText(/\d|€/)).toHaveLength(
      0,
    );
    await fireEvent.press(screen.getByTestId('desbloquear'));
    await waitFor(() => expect(screen.queryByTestId('pantalla-de-bloqueo')).toBeNull());
    expect(visible('Saldo de ejemplo: 1.234,56 €')).toBeTruthy();
  });

  it('al arrancar bloqueada y delante, pide autenticación sin tocar nada', async () => {
    arrancar({ activo: true, espera: 'inmediato' });
    await render(
      <PuertaDeSeguridad>
        <Text>contenido</Text>
      </PuertaDeSeguridad>,
    );
    await waitFor(() => expect(sistema.intentos).toBe(1));
    await waitFor(() => expect(screen.queryByTestId('pantalla-de-bloqueo')).toBeNull());
  });

  it('un intento fallido se dice con texto y deja reintentar', async () => {
    arrancar({ activo: true, espera: 'inmediato' });
    sistema.respuestas = ['fallido'];
    await render(
      <PuertaDeSeguridad>
        <Text>contenido</Text>
      </PuertaDeSeguridad>,
    );
    expect(await screen.findByTestId('fallo-al-desbloquear')).toHaveTextContent(
      es.seguridad.falloAlDesbloquear,
    );
    expect(screen.getByTestId('desbloquear')).toBeEnabled();
  });

  it('abrir por enlace, aviso o widget con la app bloqueada: el destino solo se ve tras autenticarse', async () => {
    arrancar({ activo: true, espera: 'inmediato' });
    sistema.respuestas = ['cancelado'];
    // La pantalla de destino se monta debajo, como hace la navegación.
    const { rerender } = await render(
      <PuertaDeSeguridad>
        <Text>Inicio</Text>
      </PuertaDeSeguridad>,
    );
    await asentar();
    await rerender(
      <PuertaDeSeguridad>
        <Text>Destino del enlace</Text>
      </PuertaDeSeguridad>,
    );
    expect(visible('Destino del enlace')).toBeNull();
    expect(screen.getByTestId('pantalla-de-bloqueo')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('desbloquear'));
    await waitFor(() => expect(visible('Destino del enlace')).toBeTruthy());
  });

  it('en segundo plano con modo privado se ve la cubierta, sin botón ni datos', async () => {
    arrancar(null, true);
    await render(
      <PuertaDeSeguridad>
        <Text>Saldo de ejemplo</Text>
      </PuertaDeSeguridad>,
    );
    expect(screen.queryByTestId('cubierta')).toBeNull();
    alCambiarElEstadoDeLaApp('inactive', tras(0));
    expect(await screen.findByTestId('cubierta')).toBeTruthy();
    expect(screen.queryByTestId('desbloquear')).toBeNull();
    expect(visible('Saldo de ejemplo')).toBeNull();
    alCambiarElEstadoDeLaApp('active', tras(100));
    await waitFor(() => expect(screen.queryByTestId('cubierta')).toBeNull());
    expect(visible('Saldo de ejemplo')).toBeTruthy();
  });

  it('sin bloqueo ni modo privado la puerta no pinta nada propio', async () => {
    await render(
      <PuertaDeSeguridad>
        <Text>contenido</Text>
      </PuertaDeSeguridad>,
    );
    alCambiarElEstadoDeLaApp('inactive', tras(0));
    alCambiarElEstadoDeLaApp('background', tras(0));
    expect(screen.queryByTestId('cubierta')).toBeNull();
    expect(screen.queryByTestId('pantalla-de-bloqueo')).toBeNull();
    expect(visible('contenido')).toBeTruthy();
  });

  it('la pantalla de bloqueo va por encima de las hojas modales y de toda la app', () => {
    const codigo = leer('src', 'componentes', 'seguridad', 'SobreTodo.tsx');
    expect(codigo).toContain('<FullWindowOverlay>');
    const raiz = leer('src', 'app', '_layout.tsx');
    // La puerta envuelve la pila entera; los avisos y la cola de Atajos quedan fuera de ella.
    expect(raiz).toMatch(/<PuertaDeSeguridad>\s*<Stack/);
    expect(raiz).toMatch(/<AvisosDelSistema \/>\s*\{children\}/);
    // Se decide antes del primer pintado, al cargar el fichero.
    expect(raiz).toMatch(/^iniciarSeguridad\(almacenDeSeguridad, autenticador\);$/m);
  });
});

// ------------------------------------------------- Ajustes › Seguridad

describe('Ajustes › Seguridad', () => {
  it('Ajustes abre Seguridad', async () => {
    await render(<Ajustes />);
    await fireEvent.press(screen.getByTestId('abrir-seguridad'));
    expect(router.push).toHaveBeenCalledWith('/seguridad');
  });

  it('todo viene desactivado', async () => {
    await render(<Seguridad />);
    await waitFor(() => expect(screen.getByTestId('interruptor-bloqueo')).toBeEnabled());
    expect(screen.getByTestId('interruptor-bloqueo').props.value).toBe(false);
    expect(screen.getByTestId('interruptor-privado').props.value).toBe(false);
    expect(screen.queryByTestId('seguridad-espera')).toBeNull();
  });

  it('dispositivo sin código ni biometría: el bloqueo aparece desactivado con su explicación', async () => {
    sistema.capacidad = 'ninguna';
    await render(<Seguridad />);
    expect(await screen.findByTestId('bloqueo-no-disponible')).toHaveTextContent(
      es.seguridad.bloqueoNoDisponible,
    );
    expect(screen.getByTestId('interruptor-bloqueo')).toBeDisabled();
    // El modo privado no depende de eso.
    expect(screen.getByTestId('interruptor-privado')).toBeEnabled();
  });

  it('activar el bloqueo pide autenticación y enseña los tres tiempos, con «al instante» elegido', async () => {
    await render(<Seguridad />);
    await waitFor(() => expect(screen.getByTestId('interruptor-bloqueo')).toBeEnabled());
    await fireEvent(screen.getByTestId('interruptor-bloqueo'), 'valueChange', true);
    await waitFor(() => expect(screen.getByTestId('interruptor-bloqueo').props.value).toBe(true));
    expect(sistema.intentos).toBe(1);
    expect(screen.getByTestId('segmento-inmediato').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('segmento-5min'));
    await waitFor(() =>
      expect(screen.getByTestId('segmento-5min').props.accessibilityState.selected).toBe(true),
    );
    expect(JSON.parse(guardado.bloqueo!)).toEqual({ activo: true, espera: '5min' });
  });

  it('si la autenticación falla al activarlo, lo dice y no cambia nada', async () => {
    sistema.respuestas = ['fallido'];
    await render(<Seguridad />);
    await waitFor(() => expect(screen.getByTestId('interruptor-bloqueo')).toBeEnabled());
    await fireEvent(screen.getByTestId('interruptor-bloqueo'), 'valueChange', true);
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(
      `⚠ ${es.seguridad.bloqueoNoCambiado}`,
    );
    expect(screen.getByTestId('interruptor-bloqueo').props.value).toBe(false);
  });

  it('el modo privado se activa y se guarda sin pedir autenticación', async () => {
    await render(<Seguridad />);
    await fireEvent(screen.getByTestId('interruptor-privado'), 'valueChange', true);
    await waitFor(() => expect(screen.getByTestId('interruptor-privado').props.value).toBe(true));
    expect(guardado.privado).toBe(true);
    expect(sistema.intentos).toBe(0);
  });

  it('ningún texto presenta el bloqueo como cifrado', () => {
    expect(es.seguridad.bloqueoAyuda).toContain('no cifra tus datos');
    const otros = Object.entries(es.seguridad).filter(([clave]) => clave !== 'bloqueoAyuda');
    for (const [clave, texto] of otros) {
      expect([clave, /cifra[dr]|cifra tus|encript|blindad/i.test(texto)]).toEqual([clave, false]);
    }
  });
});

// ------------------------------------------------------------ modo privado

describe('modo privado', () => {
  const HOY = fechaLocal();
  const MES = HOY.slice(0, 7);
  const AHORA = instanteLocal(HOY, 8);
  const TODOS: Preferencias = { cobros: true, presupuesto: true, capturas: true, inversion: true };
  const destino = { ruta: '/plan', parametros: {} };
  const AVISOS: Aviso[] = [
    {
      clave: 'a',
      tipo: 'cobros',
      destino,
      contenido: {
        clase: 'cobro',
        nombre: 'Gimnasio Ejemplo',
        importe: 3500,
        divisa: 'EUR',
        fecha: HOY,
        tipo: 'gasto',
      },
    },
    {
      clave: 'b',
      tipo: 'cobros',
      destino,
      contenido: {
        clase: 'cobro',
        nombre: 'Nómina Ejemplo',
        importe: 150000,
        divisa: 'EUR',
        fecha: `${MES}-28`,
        tipo: 'ingreso',
      },
    },
    {
      clave: 'c',
      tipo: 'presupuesto',
      destino,
      contenido: { clase: 'presupuesto_cerca', categoriaId: 'x', porcentaje: 85 },
    },
    {
      clave: 'd',
      tipo: 'presupuesto',
      destino,
      contenido: { clase: 'presupuesto_excedido', categoriaId: 'x', exceso: 1250 },
    },
    { clave: 'e', tipo: 'capturas', destino, contenido: { clase: 'capturas', pendientes: 3 } },
    {
      clave: 'f',
      tipo: 'inversion',
      destino,
      contenido: { clase: 'inversion', nombre: 'Bróker Ejemplo', dias: 45 },
    },
  ];
  /** Nada que delate un importe, un nombre propio de los datos o una cantidad. */
  const SENSIBLE = /\d|€|Gimnasio|Nómina|Bróker|Restaurantes|Ejemplo/;
  const nombreDeCategoria = () => 'Restaurantes';

  it.each(AVISOS.map((a) => [a.contenido.clase, a] as const))(
    'aviso de %s: sin importes ni nombres',
    (_clase, aviso) => {
      const normal = textoDeAviso(aviso, nombreDeCategoria, HOY);
      const privado = textoDeAviso(aviso, nombreDeCategoria, HOY, true);
      expect(privado).toEqual(textoPrivadoDeAviso(aviso));
      expect(privado.titulo).toBe('FinancialControl');
      expect(privado.cuerpo.length).toBeGreaterThan(10);
      expect(`${privado.titulo} ${privado.cuerpo}`).not.toMatch(SENSIBLE);
      // Sin modo privado el texto es el de siempre.
      expect(normal).not.toEqual(privado);
    },
  );

  it('los textos pedidos: pago por revisar y cobro pendiente', () => {
    expect(textoPrivadoDeAviso(AVISOS[4]).cuerpo).toBe('Tienes un pago por revisar.');
    expect(textoPrivadoDeAviso(AVISOS[0]).cuerpo).toBe('Tienes un cobro pendiente.');
    expect(textoPrivadoDeAviso(AVISOS[1]).cuerpo).toBe('Tienes un ingreso pendiente.');
  });

  describe('con datos', () => {
    let repos: Repositorios;
    const programados = new Map<string, AvisoParaMostrar>();
    const mostrados: AvisoParaMostrar[] = [];
    const notificador: Notificador = {
      permiso: async () => 'concedido',
      pedirPermiso: async () => 'concedido',
      programados: async () => [...programados.keys()],
      cancelar: async (id) => {
        programados.delete(id);
      },
      programar: async (aviso) => {
        programados.set(aviso.id, aviso);
      },
      mostrar: async (aviso) => {
        mostrados.push(aviso);
      },
    };
    const textos = () =>
      [...programados.values(), ...mostrados].map((a) => `${a.titulo} | ${a.cuerpo}`);

    beforeAll(async () => {
      const { crearBdDePrueba } = jest.requireActual('@/pruebas/bdDePrueba');
      repos = await prepararBaseDeDatos(
        crearBdDePrueba(),
        crearEntornoDePrueba(new Date().toISOString()),
        [{ nombre: 'Restaurantes', tipo: 'gasto' as const }],
      );
      const [categoria] = await repos.categorias.listar();
      const banco = await repos.cuentas.crear({
        nombre: 'Banco Ejemplo',
        tipo: 'banco',
        saldoInicial: 100000,
        fechaSaldoInicial: `${MES}-01`,
      });
      await repos.reglas.crear({
        nombre: 'Gimnasio Ejemplo',
        clase: 'fijo',
        importe: 3500,
        cuentaId: banco.id,
        categoriaId: categoria.id,
        periodicidad: 'mensual',
        diaDelMes: Number(HOY.slice(8, 10)),
        fechaInicio: `${MES}-01`,
      });
      await repos.presupuestos.guardar(MES, [{ categoriaId: categoria.id, importe: 1000 }]);
      await repos.movimientos.crear({
        tipo: 'gasto',
        importe: 2500,
        cuentaId: banco.id,
        categoriaId: categoria.id,
        fecha: HOY,
        nombre: 'Cena de ejemplo',
      });
    });

    beforeEach(() => {
      programados.clear();
      mostrados.length = 0;
    });

    it('el aviso de presupuesto superado, que se da al momento, tampoco lleva cifras', async () => {
      await recalcularAvisos(repos, notificador, TODOS, AHORA, true);
      expect(mostrados.length).toBeGreaterThan(0);
      for (const aviso of mostrados) {
        expect(`${aviso.titulo} ${aviso.cuerpo}`).not.toMatch(SENSIBLE);
      }
    });

    it('activarlo con avisos ya programados los rehace sin importes ni nombres', async () => {
      const cuantos = await recalcularAvisos(repos, notificador, TODOS, AHORA);
      expect(cuantos).toBeGreaterThan(0);
      expect(textos().some((x) => /Gimnasio Ejemplo/.test(x) && /35,00/.test(x))).toBe(true);
      const ids = [...programados.keys()].sort();
      mostrados.length = 0;

      expect(await recalcularAvisos(repos, notificador, TODOS, AHORA, true)).toBe(cuantos);
      // Los mismos avisos, a la misma hora y con el mismo destino; solo cambia el texto.
      expect([...programados.keys()].sort()).toEqual(ids);
      expect(textos().length).toBeGreaterThan(0);
      for (const texto of textos()) expect(texto).not.toMatch(SENSIBLE);
      for (const aviso of programados.values()) expect(aviso.datos.ruta).toBe('/cobro');

      // Al desactivarlo vuelven los textos completos.
      await recalcularAvisos(repos, notificador, TODOS, AHORA);
      expect(textos().some((x) => /Gimnasio Ejemplo/.test(x))).toBe(true);
    });

    it('el widget recibe «•••» y ninguna cifra', async () => {
      const normal = await datosParaElWidget(repos, HOY);
      expect(normal.cifra).toMatch(/\d/);
      const privado = await datosParaElWidget(repos, HOY, true);
      expect(privado.cifra).toBe('•••');
      expect(privado.detalle).toBe('Importes ocultos');
      expect(privado.excedido).toBe(false);
      // Ni la cifra ni el detalle llevan números; lo demás es lo de siempre.
      expect(`${privado.cifra} ${privado.detalle}`).not.toMatch(/\d|€/);
      expect({ ...privado, cifra: '', detalle: '', excedido: false }).toEqual({
        ...normal,
        cifra: '',
        detalle: '',
        excedido: false,
      });
    });

    it('acción de Atajos con la app bloqueada: la captura se guarda igual', async () => {
      arrancar({ activo: true, espera: 'inmediato' });
      expect(estadoDeSeguridad().bloqueada).toBe(true);
      const nuevas = await importarInvocaciones(
        repos,
        [
          {
            id: 'con-bloqueo-1',
            name: ACCION_REGISTRAR_PAGO,
            params: { importe: '9,90 €', comercio: 'Kiosco de ejemplo', tarjeta: '' },
            createdAt: Date.now(),
          },
        ],
        new Date().toISOString(),
      );
      expect(nuevas).toBe(1);
      expect(estadoDeSeguridad().bloqueada).toBe(true);
    });
  });

  it('Swift lee el mismo ajuste que la app, con la misma clave', () => {
    const swift = leer('app-intents', 'CapturaEnBruto.swift');
    expect(CLAVE_DE_MODO_PRIVADO).toBe('modoPrivado');
    expect(swift).toContain(`static let clave = "${CLAVE_DE_MODO_PRIVADO}"`);
    expect(swift).toContain('UserDefaults.standard.bool(forKey: clave)');
    // En modo privado el aviso de captura usa textos fijos, sin comercio, importe ni tarjeta.
    const rama = (/if ModoPrivado\.activo \{([^]*?)\} else \{/.exec(swift)?.[1] ?? '')
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('//'))
      .join('\n');
    expect(rama).toContain('TextosDeCaptura.pagoPrivadoTitulo');
    expect(rama).toContain('TextosDeCaptura.pagoPrivadoCuerpo');
    expect(rama).not.toMatch(/comercio|importe|tarjeta|\\\(/);
    expect(swift).toContain('static let pagoPrivadoCuerpo = "Tienes un pago por revisar."');
  });

  it('el almacén guarda el modo privado donde Swift lo lee y el bloqueo fuera del llavero', () => {
    const codigo = leer('src', 'lib', 'almacenDeSeguridad.ts');
    expect(codigo).toContain('Settings.set({ [CLAVE_DE_MODO_PRIVADO]: activo })');
    expect(codigo).toContain('Storage.getItemSync(CLAVE_DE_BLOQUEO)');
    for (const fichero of ['almacenDeSeguridad.ts', 'autenticacion.ts', 'seguridad.ts']) {
      expect(leer('src', 'lib', fichero)).not.toMatch(/expo-secure-store|SecureStore|Keychain/);
    }
  });
});

// ------------------------------------------------------------ configuración

describe('configuración nativa', () => {
  const app = JSON.parse(leer('app.json')).expo;
  const paquete = JSON.parse(leer('package.json'));

  it('el texto de uso de Face ID va en el plugin de expo-local-authentication', () => {
    const plugin = app.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === 'expo-local-authentication',
    );
    expect(plugin?.[1].faceIDPermission).toMatch(/Face ID/);
    expect(paquete.dependencies['expo-local-authentication']).toBeDefined();
  });

  it('no cambian el identificador, el esquema ni la ausencia de push', () => {
    expect(app.ios.bundleIdentifier).toBe('es.juanantonio.financialcontrol');
    expect(app.scheme).toBe('financialcontrol');
    const nombres = app.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p));
    expect(nombres).not.toContain('expo-notifications');
    expect(nombres).toContain('./plugins/sin-push.js');
  });

  // B4b-1 añade react-native-libsodium y expo-secure-store, las dos permitidas por su encargo.
  it('las dependencias de la app son las autorizadas, y ninguna más', () => {
    expect(Object.keys(paquete.dependencies).sort()).toEqual(
      [
        '@expo/ui',
        '@supabase/supabase-js',
        'expo',
        'expo-app-intents',
        'expo-constants',
        'expo-crypto',
        'expo-linking',
        'expo-local-authentication',
        'expo-localization',
        'expo-notifications',
        'expo-router',
        'expo-secure-store',
        'expo-splash-screen',
        'expo-sqlite',
        'expo-status-bar',
        'expo-system-ui',
        'expo-widgets',
        'react',
        'react-dom',
        'react-native',
        'react-native-libsodium',
        'react-native-safe-area-context',
        'react-native-screens',
        'react-native-svg',
      ].sort(),
    );
  });
});
