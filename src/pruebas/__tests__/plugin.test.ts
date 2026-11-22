/**
 * Prueba del plugin de configuración local que fija un ajuste de Xcode. Se
 * prueba con un proyecto de mentira que tiene la misma forma que entrega la
 * biblioteca `xcode`: configuraciones mezcladas con comentarios.
 */
const { quitarSandboxDeScripts } = jest.requireActual('../../../plugins/sin-sandbox-de-scripts.js');

describe('plugin sin-sandbox-de-scripts', () => {
  it('pone el ajuste en NO en todas las configuraciones y no toca los comentarios', () => {
    const seccion: Record<string, unknown> = {
      A1: {
        isa: 'XCBuildConfiguration',
        buildSettings: { ENABLE_USER_SCRIPT_SANDBOXING: 'YES' },
        name: 'Debug',
      },
      A1_comment: 'Debug',
      A2: { isa: 'XCBuildConfiguration', buildSettings: { OTRO: '1' }, name: 'Release' },
      A2_comment: 'Release',
      A3: { isa: 'XCBuildConfiguration', buildSettings: {}, name: 'Debug' },
    };
    const proyecto = { pbxXCBuildConfigurationSection: () => seccion };
    expect(quitarSandboxDeScripts(proyecto)).toBe(3);
    for (const clave of ['A1', 'A2', 'A3']) {
      const configuracion = seccion[clave] as { buildSettings: Record<string, string> };
      expect(configuracion.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING).toBe('NO');
    }
    expect((seccion.A2 as { buildSettings: Record<string, string> }).buildSettings.OTRO).toBe('1');
    expect(seccion.A1_comment).toBe('Debug');
  });

  it('aplicarlo dos veces da el mismo resultado', () => {
    const seccion = { A1: { buildSettings: {} } };
    const proyecto = { pbxXCBuildConfigurationSection: () => seccion };
    quitarSandboxDeScripts(proyecto);
    const primera = JSON.stringify(seccion);
    quitarSandboxDeScripts(proyecto);
    expect(JSON.stringify(seccion)).toBe(primera);
  });
});

describe('plugin sin-push', () => {
  const { quitarPush } = jest.requireActual('../../../plugins/sin-push.js');

  it('quita el permiso de notificaciones remotas y conserva los demás', () => {
    const entitlements = {
      'aps-environment': 'development',
      'com.apple.security.application-groups': ['group.es.juanantonio.financialcontrol'],
    };
    expect(quitarPush(entitlements)).toEqual({
      'com.apple.security.application-groups': ['group.es.juanantonio.financialcontrol'],
    });
  });

  it('sin ese permiso no cambia nada', () => {
    expect(quitarPush({})).toEqual({});
  });
});

describe('plugin parche-libsodium', () => {
  const { createHash } = jest.requireActual('node:crypto');
  const { readFileSync, mkdtempSync, mkdirSync, writeFileSync } = jest.requireActual('node:fs');
  const { tmpdir } = jest.requireActual('node:os');
  const { dirname, join } = jest.requireActual('node:path');
  const parche = jest.requireActual('../../../plugins/parche-libsodium.js');
  const raiz = join(__dirname, '..', '..', '..');
  const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
  const sha = (texto: string) => createHash('sha256').update(texto).digest('hex');

  /** El fichero original de react-native-libsodium 1.7.0, reconstruido deshaciendo el parche. */
  function original(): string {
    let texto: string = readFileSync(join(raiz, parche.FICHERO), 'utf8');
    if (sha(texto) === parche.HUELLA_ORIGINAL) return texto;
    for (const { antes, despues } of [...parche.SUSTITUCIONES].reverse()) {
      texto = texto.replace(despues, antes);
    }
    return texto;
  }

  it('las versiones de la biblioteca criptográfica están fijadas, sin ^ ni ~', () => {
    expect(paquete.dependencies['react-native-libsodium']).toBe(parche.VERSION_DEL_PAQUETE);
    // Desde el bloque 5 es dependencia de producción: es la biblioteca de cifrado de la versión web.
    expect(paquete.dependencies['libsodium-wrappers-sumo']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(paquete.devDependencies['libsodium-wrappers-sumo']).toBeUndefined();
    const instalado = JSON.parse(
      readFileSync(join(raiz, 'node_modules', 'react-native-libsodium', 'package.json'), 'utf8'),
    );
    expect(instalado.version).toBe(parche.VERSION_DEL_PAQUETE);
  });

  it('el original tiene la huella esperada y el parche da la huella esperada', () => {
    expect(sha(original())).toBe(parche.HUELLA_ORIGINAL);
    const parcheado = parche.parchear(original());
    expect(sha(parcheado)).toBe(parche.HUELLA_PARCHEADA);
    expect(parche.HUELLA_PARCHEADA).not.toBe(parche.HUELLA_ORIGINAL);
    expect(parcheado).not.toContain('RCTCxxBridge');
    expect(parcheado).toContain('[self.bridge runtime]');
  });

  it('el paquete instalado está parcheado y verificado (lo deja así `npm ci`, por el postinstall)', () => {
    const instalado: string = readFileSync(join(raiz, parche.FICHERO), 'utf8');
    expect(sha(instalado)).toBe(parche.HUELLA_PARCHEADA);
  });

  it('aplicarlo dos veces no cambia nada', () => {
    const una = parche.parchear(original());
    expect(parche.parchear(una)).toBe(una);
    expect(parche.parchear(parche.parchear(una))).toBe(una);
  });

  it('con un fichero que no es el esperado, falla sin tocar nada', () => {
    for (const otro of [
      `${original()}\n`,
      original().replace('installing', 'instalando'),
      '',
      'x',
    ]) {
      expect(() => parche.parchear(otro)).toThrow(/no es el fichero esperado/);
    }
    // Tampoco acepta un fichero parcheado a medias.
    const { antes, despues } = parche.SUSTITUCIONES[0];
    expect(() => parche.parchear(original().replace(antes, despues))).toThrow();
  });

  it('en disco: parchea el original, no reescribe el ya parcheado y falla con otro', () => {
    const proyecto = mkdtempSync(join(tmpdir(), 'parche-'));
    const ruta = join(proyecto, parche.FICHERO);
    mkdirSync(dirname(ruta), { recursive: true });
    expect(() => parche.aplicarEn(proyecto)).toThrow(/No existe/);
    writeFileSync(ruta, original());
    expect(parche.aplicarEn(proyecto)).toBe(true);
    expect(sha(readFileSync(ruta, 'utf8'))).toBe(parche.HUELLA_PARCHEADA);
    expect(parche.aplicarEn(proyecto)).toBe(false);
    writeFileSync(ruta, 'otro contenido');
    expect(() => parche.aplicarEn(proyecto)).toThrow(/no es el fichero esperado/);
    expect(readFileSync(ruta, 'utf8')).toBe('otro contenido');
  });

  it('el parche solo toca cómo se obtiene el motor de JavaScript, nada de criptografía', () => {
    expect(parche.SUSTITUCIONES).toHaveLength(3);
    for (const { antes, despues } of parche.SUSTITUCIONES) {
      expect(`${antes}${despues}`).not.toMatch(/crypto_|sodium_|randombytes|nonce|key/i);
    }
    expect(parche.FICHERO).toBe(
      join('node_modules', 'react-native-libsodium', 'ios', 'Libsodium.mm'),
    );
  });

  it('se aplica en el prebuild y tras npm install', () => {
    const app = JSON.parse(readFileSync(join(raiz, 'app.json'), 'utf8')).expo;
    expect(app.plugins).toContain('./plugins/parche-libsodium.js');
    expect(paquete.scripts.postinstall).toBe('node plugins/parche-libsodium.js');
  });
});

describe('plugin sin-cache-de-red', () => {
  const { readFileSync } = jest.requireActual('node:fs');
  const { join } = jest.requireActual('node:path');
  const { quitarCacheDeRed, MARCA } = jest.requireActual('../../../plugins/sin-cache-de-red.js');
  const DELEGADO = [
    'public class AppDelegate: ExpoAppDelegate {',
    '  public override func application(',
    '    _ application: UIApplication,',
    '    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil',
    '  ) -> Bool {',
    '    let delegate = ReactNativeDelegate()',
    '    let factory = ExpoReactNativeFactory(delegate: delegate)',
    '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
    '  }',
    '}',
    '',
  ].join('\n');

  it('vacía la caché y la deja sin disco, antes de arrancar React Native', () => {
    const resultado: string = quitarCacheDeRed(DELEGADO);
    expect(resultado).toContain('URLCache.shared.removeAllCachedResponses()');
    expect(resultado).toMatch(
      /URLCache\.shared = URLCache\(memoryCapacity: [^,]+, diskCapacity: 0\)/,
    );
    expect(resultado.indexOf('diskCapacity: 0')).toBeLessThan(
      resultado.indexOf('let delegate = ReactNativeDelegate()'),
    );
    // No quita nada de lo que había.
    for (const linea of DELEGADO.split('\n')) expect(resultado).toContain(linea);
  });

  it('aplicarlo dos veces no cambia nada', () => {
    const una: string = quitarCacheDeRed(DELEGADO);
    expect(quitarCacheDeRed(una)).toBe(una);
    expect(una.split(MARCA)).toHaveLength(2);
  });

  it('si no reconoce el AppDelegate, falla en lugar de seguir sin la protección', () => {
    expect(() => quitarCacheDeRed('class AppDelegate {}')).toThrow(/No se reconoce AppDelegate/);
    expect(() => quitarCacheDeRed('')).toThrow();
  });

  it('está activado en app.json', () => {
    const app = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'app.json'), 'utf8'));
    expect(app.expo.plugins).toContain('./plugins/sin-cache-de-red.js');
  });
});
