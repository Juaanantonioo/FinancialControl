/**
 * Pantallas de la cuenta (B4b-1): Ajustes › Cuenta, el código de
 * recuperación y su confirmación, Diagnóstico, y el bloqueo por delante.
 * Servidor de mentira y criptografía de verdad. Datos de ejemplo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';

import Ajustes from '@/app/ajustes';
import CuentaDeUsuario from '@/app/cuenta-de-usuario';
import Diagnostico from '@/app/diagnostico';
import { PuertaDeSeguridad } from '@/componentes/seguridad/Puerta';
import { gruposDelCodigo } from '@/cripto';
import { olvidarAutocomprobacion } from '@/cripto/autocomprobacion';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { crearGestorDeCuenta, type GestorDeCuenta } from '@/estado/cuenta';
import { iniciarSeguridad } from '@/estado/seguridad';
import es from '@/i18n/es.json';
import { almacenEnMemoria, servidorDeMentira } from '@/pruebas/cuentaDePrueba';

const mockPantalla = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: {
    Screen: (props: { options: unknown }) => {
      mockPantalla(props.options);
      return null;
    },
  },
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/componentes/seguridad/SobreTodo', () => ({
  SobreTodo: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/lib/almacenDeApariencia', () => ({
  almacenDeApariencia: { leer: () => 'automatico', guardar: jest.fn() },
}));
jest.mock('@/lib/supabase', () => ({
  probarConexion: async () => ({ estado: 'sin_configurar' }),
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

const CORREO = 'ana.ejemplo@example.com';
const CONTRASENA = 'correcta batería caballo grapa';
let servidor: ReturnType<typeof servidorDeMentira>;
let memoria: ReturnType<typeof almacenEnMemoria>;

function montar(opciones: { correcta?: boolean; sinCliente?: boolean } = {}) {
  servidor = servidorDeMentira();
  memoria = almacenEnMemoria();
  mockGestor = crearGestorDeCuenta({
    cliente: opciones.sinCliente ? null : servidor.cliente,
    almacen: memoria.almacen,
    autocomprobar: async () => ({
      correcta: opciones.correcta ?? true,
      milisegundosDeDerivacion: 1,
    }),
    pausaAntesDeCalcular: 0,
  });
}

const pintar = () =>
  render(
    <ProveedorDeAvisos>
      <CuentaDeUsuario />
    </ProveedorDeAvisos>,
  );

async function escribir(testID: string, texto: string) {
  await fireEvent.changeText(screen.getByTestId(testID), texto);
}

/** Rellena y envía el formulario de alta. */
async function darDeAlta(correo = CORREO, contrasena = CONTRASENA, repetida = contrasena) {
  await screen.findByTestId('cuenta-formulario');
  await escribir('correo', correo);
  await escribir('contrasena', contrasena);
  await escribir('repetir-contrasena', repetida);
  await fireEvent.press(screen.getByTestId('enviar'));
}

/** Escribe en la pantalla de confirmación los grupos que se piden. */
async function confirmarGrupos() {
  const { codigo, gruposPedidos } = mockGestor.estado();
  const grupos = gruposDelCodigo(codigo!);
  await fireEvent.press(await screen.findByTestId('codigo-guardado'));
  for (const [i, posicion] of gruposPedidos.entries())
    await escribir(`grupo-${i}`, grupos[posicion]);
  await fireEvent.press(screen.getByTestId('confirmar-codigo'));
}

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
  montar();
});

describe('Ajustes', () => {
  it('tiene la entrada «Cuenta», que abre su pantalla', async () => {
    await render(<Ajustes />);
    expect(screen.getByTestId('abrir-cuenta')).toHaveTextContent(/Cuenta/);
    await fireEvent.press(screen.getByTestId('abrir-cuenta'));
    expect(router.push).toHaveBeenCalledWith('/cuenta-de-usuario');
  });
});

describe('Cuenta sin sesión', () => {
  it('explica que los datos están solo en el dispositivo y que hoy la cuenta no sincroniza nada', async () => {
    await pintar();
    const tarjeta = await screen.findByTestId('cuenta-sin-sesion');
    expect(tarjeta).toHaveTextContent(new RegExp(es.usuario.sinSesionTexto.slice(0, 40)));
    expect(tarjeta).toHaveTextContent(/todavía no sincroniza nada/);
    expect(es.usuario.sinSesionTexto).toMatch(/solo en este dispositivo, sin cifrar/);
    // Ningún texto de la cuenta promete lo que no hay.
    for (const [clave, texto] of Object.entries(es.usuario)) {
      expect([
        clave,
        /ya sincroniza|se sincronizan|copia en la nube|a salvo en el servidor/i.test(texto),
      ]).toEqual([clave, false]);
    }
  });

  it('el alta explica que la contraseña cifra los datos y que nadie puede restablecerla', async () => {
    await pintar();
    const aviso = await screen.findByTestId('aviso-de-contrasena');
    expect(aviso).toHaveTextContent(/cifra tus datos/);
    expect(aviso).toHaveTextContent(/nadie puede restablecerla/);
    expect(aviso).toHaveTextContent(/No hay recuperación por correo/);
  });

  it('las contraseñas van ocultas y con el tipo que entiende el gestor de contraseñas', async () => {
    await pintar();
    await screen.findByTestId('cuenta-formulario');
    for (const id of ['contrasena', 'repetir-contrasena']) {
      expect(screen.getByTestId(id).props).toMatchObject({
        secureTextEntry: true,
        autoCorrect: false,
        textContentType: 'newPassword',
      });
    }
    await fireEvent.press(screen.getByTestId('cambiar-de-modo'));
    expect(screen.getByTestId('contrasena').props.textContentType).toBe('password');
    expect(screen.queryByTestId('repetir-contrasena')).toBeNull();
    expect(screen.queryByTestId('aviso-de-contrasena')).toBeNull();
  });

  it.each([
    [
      'las contraseñas no coinciden',
      CORREO,
      CONTRASENA,
      'otra distinta larga',
      es.usuario.error_no_coinciden,
    ],
    ['contraseña corta', CORREO, 'corta', 'corta', es.usuario.error_contrasena_corta],
    [
      'contraseña evidente',
      CORREO,
      'password1234',
      'password1234',
      es.usuario.error_contrasena_evidente,
    ],
    ['correo sin forma', 'ana', CONTRASENA, CONTRASENA, es.usuario.error_correo_invalido],
  ])(
    '%s: lo dice y no pide nada al servidor',
    async (_n, correo, contrasena, repetida, mensaje) => {
      await pintar();
      await darDeAlta(correo, contrasena, repetida);
      expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(`⚠ ${mensaje}`);
      expect(servidor.recibido).toEqual([]);
    },
  );

  it('sin conexión: mensaje claro, el formulario sigue ahí y no se queda esperando', async () => {
    servidor.estado.sinRed = true;
    await pintar();
    await darDeAlta();
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(
      `⚠ ${es.usuario.error_sin_conexion}`,
    );
    expect(es.usuario.error_sin_conexion).toMatch(/sigue funcionando/);
    expect(screen.getByTestId('enviar')).toBeEnabled();
    expect(screen.queryByTestId('cuenta-trabajando')).toBeNull();
  });

  it('con un correo ya registrado: mensaje que no confirma si existe', async () => {
    servidor.usuarios.set(CORREO, { id: 'u-0', email: CORREO, password: 'otra-clave' });
    await pintar();
    await darDeAlta();
    const error = await screen.findByTestId('texto-de-error');
    expect(error).toHaveTextContent(`⚠ ${es.usuario.error_alta_rechazada}`);
    expect(es.usuario.error_alta_rechazada).not.toMatch(/ya existe|ya está registrad|en uso/i);
    expect(es.usuario.error_credenciales).not.toMatch(/no existe|no está registrad/i);
  });
});

describe('código de recuperación', () => {
  it('se muestra tras el alta, en 14 grupos numerados, y no hay forma de salir sin confirmarlo', async () => {
    await pintar();
    expect(mockPantalla).toHaveBeenLastCalledWith({ gestureEnabled: true });
    await darDeAlta();
    const codigo = await screen.findByTestId('codigo-de-recuperacion');
    const grupos = gruposDelCodigo(mockGestor.estado().codigo!);
    expect(grupos).toHaveLength(14);
    for (const grupo of grupos) expect(codigo).toHaveTextContent(new RegExp(grupo));
    // Sin botón de volver y sin gesto de volver.
    expect(screen.queryByTestId('volver')).toBeNull();
    expect(mockPantalla).toHaveBeenLastCalledWith({ gestureEnabled: false });
    // La contraseña ya no está en la pantalla.
    expect(screen.queryByTestId('contrasena')).toBeNull();
    // Todavía no hay cuenta completa: nada guardado.
    expect(servidor.claves.size).toBe(0);
    expect(memoria.datos.size).toBe(0);
  });

  it('se puede guardar o imprimir con la hoja de compartir del sistema', async () => {
    const compartir = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await pintar();
    await darDeAlta();
    await fireEvent.press(await screen.findByTestId('guardar-codigo'));
    const codigo = mockGestor.estado().codigo!;
    expect(compartir).toHaveBeenCalledTimes(1);
    expect(compartir.mock.calls[0][0]).toEqual({
      message: expect.stringContaining(codigo),
    });
    compartir.mockRestore();
  });

  it('la confirmación pide dos grupos; con grupos equivocados no se continúa', async () => {
    await pintar();
    await darDeAlta();
    await fireEvent.press(await screen.findByTestId('codigo-guardado'));
    const { gruposPedidos } = mockGestor.estado();
    expect(gruposPedidos).toHaveLength(2);
    for (const posicion of gruposPedidos) {
      expect(screen.getByText(`Grupo ${posicion + 1}`)).toBeTruthy();
    }
    // En la confirmación el código ya no está a la vista.
    expect(screen.queryByTestId('codigo-de-recuperacion')).toBeNull();
    expect(screen.getByTestId('confirmar-codigo')).toBeDisabled();
    await escribir('grupo-0', 'ZZZZ');
    await escribir('grupo-1', 'ZZZZ');
    await fireEvent.press(screen.getByTestId('confirmar-codigo'));
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(
      `⚠ ${es.usuario.error_codigo_no_coincide}`,
    );
    expect(mockGestor.estado().fase).toBe('pendiente_de_codigo');
    expect(screen.queryByTestId('volver')).toBeNull();
    // Se puede volver a mirar el código.
    await fireEvent.press(screen.getByTestId('volver-al-codigo'));
    expect(await screen.findByTestId('codigo-de-recuperacion')).toBeTruthy();
  });

  it('con los grupos correctos la cuenta queda creada y la sesión iniciada', async () => {
    await pintar();
    await darDeAlta();
    await confirmarGrupos();
    const tarjeta = await screen.findByTestId('cuenta-con-sesion');
    expect(tarjeta).toHaveTextContent(new RegExp(CORREO));
    expect(tarjeta).toHaveTextContent(/todavía no sincroniza nada/);
    expect(screen.getByTestId('volver')).toBeTruthy();
    expect(mockPantalla).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(servidor.claves.size).toBe(1);
    // El código ya no está en ningún sitio de la pantalla ni del estado.
    expect(mockGestor.estado().codigo).toBeNull();
    expect(screen.queryByTestId('codigo-de-recuperacion')).toBeNull();
  });

  it('cancelar el alta vuelve al principio sin dejar nada en el dispositivo', async () => {
    await pintar();
    await darDeAlta();
    await fireEvent.press(await screen.findByTestId('cancelar-alta'));
    expect(await screen.findByTestId('cuenta-sin-sesion')).toBeTruthy();
    expect(memoria.datos.size).toBe(0);
  });
});

describe('sesión iniciada', () => {
  async function conSesion() {
    await pintar();
    await darDeAlta();
    await confirmarGrupos();
    await screen.findByTestId('cuenta-con-sesion');
  }

  it('cerrar sesión vuelve a «Sin cuenta» y lo dice', async () => {
    await conSesion();
    await fireEvent.press(screen.getByTestId('cerrar-sesion'));
    expect(await screen.findByTestId('cuenta-sin-sesion')).toBeTruthy();
    expect(await screen.findByText(es.usuario.sesionCerrada)).toBeTruthy();
    expect(es.usuario.sesionCerrada).toMatch(/Tus datos siguen en este dispositivo/);
    expect(memoria.datos.size).toBe(0);
    expect(servidor.usuarios.size).toBe(1);
  });

  it('iniciar sesión de nuevo entra directamente, sin enseñar ningún código', async () => {
    await conSesion();
    await fireEvent.press(screen.getByTestId('cerrar-sesion'));
    await screen.findByTestId('cuenta-sin-sesion');
    await fireEvent.press(screen.getByTestId('cambiar-de-modo'));
    await escribir('correo', CORREO);
    await escribir('contrasena', CONTRASENA);
    await fireEvent.press(screen.getByTestId('enviar'));
    expect(await screen.findByTestId('cuenta-con-sesion')).toBeTruthy();
    expect(screen.queryByTestId('codigo-de-recuperacion')).toBeNull();
  });

  it('contraseña equivocada al iniciar sesión: un mensaje que no dice qué falló', async () => {
    await conSesion();
    await fireEvent.press(screen.getByTestId('cerrar-sesion'));
    await screen.findByTestId('cuenta-sin-sesion');
    await fireEvent.press(screen.getByTestId('cambiar-de-modo'));
    await escribir('correo', CORREO);
    await escribir('contrasena', 'no es la contraseña');
    await fireEvent.press(screen.getByTestId('enviar'));
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(
      `⚠ ${es.usuario.error_credenciales}`,
    );
  });

  it('borrar la cuenta exige dos pasos: abrir la confirmación y escribir la palabra', async () => {
    await conSesion();
    expect(screen.queryByTestId('borrar-definitivamente')).toBeNull();
    expect(screen.getByTestId('cuenta-borrar')).toHaveTextContent(
      /Los datos financieros de este dispositivo se conservan/,
    );
    await fireEvent.press(screen.getByTestId('borrar-cuenta'));
    const definitivo = await screen.findByTestId('borrar-definitivamente');
    expect(definitivo).toBeDisabled();
    await escribir('palabra-de-borrado', 'borra');
    expect(screen.getByTestId('borrar-definitivamente')).toBeDisabled();
    // Cancelar no borra nada.
    await fireEvent.press(screen.getByTestId('cancelar-borrado'));
    expect(screen.queryByTestId('borrar-definitivamente')).toBeNull();
    expect(servidor.usuarios.size).toBe(1);

    await fireEvent.press(screen.getByTestId('borrar-cuenta'));
    await escribir('palabra-de-borrado', ' borrar ');
    await waitFor(() => expect(screen.getByTestId('borrar-definitivamente')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('borrar-definitivamente'));
    expect(await screen.findByTestId('cuenta-sin-sesion')).toBeTruthy();
    expect(await screen.findByText(es.usuario.cuentaBorrada)).toBeTruthy();
    expect(servidor.usuarios.size).toBe(0);
    expect(servidor.claves.size).toBe(0);
    expect(memoria.datos.size).toBe(0);
  });

  it('borrar sin conexión: lo dice y la cuenta sigue como estaba', async () => {
    await conSesion();
    await fireEvent.press(screen.getByTestId('borrar-cuenta'));
    await escribir('palabra-de-borrado', 'BORRAR');
    servidor.estado.sinRed = true;
    await fireEvent.press(screen.getByTestId('borrar-definitivamente'));
    expect(await screen.findByTestId('texto-de-error')).toHaveTextContent(
      `⚠ ${es.usuario.error_sin_conexion}`,
    );
    expect(mockGestor.estado().fase).toBe('con_sesion');
    expect(servidor.usuarios.size).toBe(1);
  });
});

describe('cuenta no disponible', () => {
  it('si la biblioteca de cifrado no pasa su comprobación, la cuenta se desactiva con su explicación', async () => {
    montar({ correcta: false });
    await pintar();
    const aviso = await screen.findByTestId('cuenta-no-disponible');
    expect(aviso).toHaveTextContent(`⚠ ${es.usuario.criptoNoFiable}`);
    expect(es.usuario.criptoNoFiable).toMatch(/El resto de la app funciona con normalidad/);
    expect(screen.queryByTestId('cuenta-formulario')).toBeNull();
    expect(screen.queryByTestId('enviar')).toBeNull();
    // Se puede volver a Ajustes: la app sigue.
    expect(screen.getByTestId('volver')).toBeTruthy();
    expect(servidor.recibido).toEqual([]);
  });

  it('sin configuración del servidor, lo dice y no ofrece nada', async () => {
    montar({ sinCliente: true });
    await pintar();
    expect(await screen.findByTestId('cuenta-no-disponible')).toHaveTextContent(
      `⚠ ${es.usuario.sinConfigurar}`,
    );
    expect(screen.queryByTestId('enviar')).toBeNull();
  });
});

describe('con el bloqueo de la app activo', () => {
  it('la pantalla de cuenta queda detrás del bloqueo, como el resto', async () => {
    iniciarSeguridad(
      {
        leerBloqueo: () => ({ activo: true, espera: 'inmediato' }),
        guardarBloqueo: async () => undefined,
        leerModoPrivado: () => false,
        guardarModoPrivado: async () => undefined,
      },
      { capacidad: async () => 'biometria', autenticar: async () => 'cancelado' },
    );
    await render(
      <ProveedorDeAvisos>
        <PuertaDeSeguridad>
          <CuentaDeUsuario />
        </PuertaDeSeguridad>
      </ProveedorDeAvisos>,
    );
    expect(await screen.findByTestId('pantalla-de-bloqueo')).toBeTruthy();
    expect(screen.queryByTestId('cuenta-sin-sesion')).toBeNull();
    expect(screen.queryByTestId('correo')).toBeNull();
    expect(
      screen.getByTestId('contenido-de-la-app', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true);
  });
});

describe('Diagnóstico', () => {
  beforeEach(() => olvidarAutocomprobacion());

  it('dice si la biblioteca de cifrado da los resultados esperados', async () => {
    await render(<Diagnostico />);
    expect(await screen.findByText(`✓ ${es.diagnostico.criptoCorrecta}`)).toBeTruthy();
  });

  it('mide el tiempo de derivación y muestra solo milisegundos, ninguna clave', async () => {
    await render(<Diagnostico />);
    expect(screen.getByTestId('resultado-derivacion')).toHaveTextContent(
      es.diagnostico.derivacionSinMedir,
    );
    await fireEvent.press(screen.getByTestId('medir-derivacion'));
    await waitFor(
      () => expect(screen.getByTestId('resultado-derivacion')).toHaveTextContent(/^\d+ ms$/),
      { timeout: 10_000 },
    );
    // Ni la clave maestra del vector ni nada con forma de clave aparece en la pantalla.
    const vectores = jest.requireActual('@/cripto/vectores.json');
    const pantalla = JSON.stringify(screen.toJSON());
    for (const valor of Object.values(vectores.salida) as string[]) {
      expect(pantalla.includes(valor)).toBe(false);
    }
    expect(pantalla).not.toMatch(/[0-9a-f]{32,}|[A-Za-z0-9_-]{40,}/);
  });
});

describe('Diagnóstico: conexión con el servidor', () => {
  const { probarConexion } = jest.requireActual('@/lib/supabase');
  const lib = jest.requireMock('@/lib/supabase');

  it('sin configuración lo dice, sin intentar ninguna conexión', async () => {
    await expect(probarConexion()).resolves.toEqual({ estado: 'sin_configurar' });
  });

  it.each([
    ['conectado', es.diagnostico.supabaseConectado],
    ['sin_esquema', es.diagnostico.supabaseSinEsquema],
    ['sin_conexion', es.diagnostico.supabaseSinConexion],
    ['error', es.diagnostico.supabaseError],
  ])('estado %s: lo explica con un texto propio, sin detalles internos', async (estado, texto) => {
    lib.probarConexion = async () => ({ estado });
    await render(<Diagnostico />);
    await waitFor(() =>
      expect(screen.getByTestId('resultado-supabase')).toHaveTextContent(
        new RegExp(texto.slice(0, 30)),
      ),
    );
    expect(screen.getByTestId('resultado-supabase')).not.toHaveTextContent(
      /schema cache|public\.|PGRST|relation|permission denied|\{\{/,
    );
    lib.probarConexion = async () => ({ estado: 'sin_configurar' });
  });

  it('ningún texto de Diagnóstico lleva el mensaje del servidor', () => {
    expect(JSON.stringify(es.diagnostico)).not.toContain('{{mensaje}}');
  });
});
