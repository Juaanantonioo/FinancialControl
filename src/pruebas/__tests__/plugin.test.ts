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
