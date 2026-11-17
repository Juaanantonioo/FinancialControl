/**
 * Plugin de configuración local: pone ENABLE_USER_SCRIPT_SANDBOXING = NO en
 * todas las configuraciones de compilación del proyecto de Xcode (el
 * proyecto y cada uno de sus targets, incluidos los que añadan otros
 * plugins, como el del widget).
 *
 * Por qué existe: con el sandboxing de scripts activado, las fases de script
 * de React Native y de Expo no pueden escribir sus ficheros y la compilación
 * falla. Antes este ajuste se hacía a mano en Xcode y se perdía cada vez que
 * se regeneraba la carpeta ios/. Aquí queda escrito en el repositorio y se
 * vuelve a aplicar en cada `npx expo prebuild`.
 *
 * No tiene dependencias propias: usa la API de plugins que ya trae Expo.
 */
const { withXcodeProject } = require('expo/config-plugins');

/** Aplica el ajuste a un proyecto de Xcode ya leído. Se exporta para poder probarlo. */
function quitarSandboxDeScripts(proyecto) {
  const configuraciones = proyecto.pbxXCBuildConfigurationSection();
  let cambiadas = 0;
  for (const clave of Object.keys(configuraciones)) {
    const configuracion = configuraciones[clave];
    // La sección mezcla las configuraciones con comentarios (claves `..._comment`).
    if (typeof configuracion !== 'object' || !configuracion.buildSettings) continue;
    configuracion.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
    cambiadas++;
  }
  return cambiadas;
}

function sinSandboxDeScripts(config) {
  return withXcodeProject(config, (configDelProyecto) => {
    quitarSandboxDeScripts(configDelProyecto.modResults);
    return configDelProyecto;
  });
}

module.exports = sinSandboxDeScripts;
module.exports.quitarSandboxDeScripts = quitarSandboxDeScripts;
