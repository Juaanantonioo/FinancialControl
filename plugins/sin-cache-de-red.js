/**
 * Plugin de configuración local: la caché de red de iOS no escribe en disco.
 *
 * Por qué existe: iOS guarda por su cuenta las respuestas HTTP en un fichero
 * (`Library/Caches/<app>/Cache.db`). Con cuentas de usuario, ahí quedaban en
 * claro, fuera del llavero, la respuesta del inicio de sesión (con los tokens
 * de la sesión) y la de las claves de la cuenta. Se vio en el simulador el
 * 22/11/2026. Ni React Native ni Expo permiten evitarlo desde JavaScript.
 *
 * Qué hace: al arrancar la app, antes de cualquier petición, vacía la caché
 * que hubiera y la sustituye por una que solo vive en memoria (capacidad de
 * disco cero). La app no descarga imágenes ni nada que gane con esa caché.
 *
 * Añade dos líneas a `AppDelegate.swift` en cada `npx expo prebuild`. Si no
 * encuentra dónde ponerlas, el prebuild falla: no se sigue sin la protección.
 * No tiene dependencias propias.
 */
const { withAppDelegate } = require('expo/config-plugins');

const MARCA = '// [sin-cache-de-red]';
const ANCLA = '    let delegate = ReactNativeDelegate()\n';
const LINEAS =
  `    ${MARCA} La caché de red no escribe en disco: nada de la sesión queda fuera del llavero.\n` +
  '    URLCache.shared.removeAllCachedResponses()\n' +
  '    URLCache.shared = URLCache(memoryCapacity: 4 * 1024 * 1024, diskCapacity: 0)\n\n';

/** Devuelve el AppDelegate con las líneas añadidas. Es pura, para poder probarla. */
function quitarCacheDeRed(contenido) {
  if (contenido.includes(MARCA)) return contenido;
  if (contenido.split(ANCLA).length !== 2) {
    throw new Error(
      '[sin-cache-de-red] No se reconoce AppDelegate.swift: no se puede desactivar la caché ' +
        'de red en disco. Revisa plugins/sin-cache-de-red.js.',
    );
  }
  return contenido.replace(ANCLA, LINEAS + ANCLA);
}

function sinCacheDeRed(config) {
  return withAppDelegate(config, (configDelDelegado) => {
    if (configDelDelegado.modResults.language !== 'swift') {
      throw new Error('[sin-cache-de-red] Se esperaba un AppDelegate en Swift.');
    }
    configDelDelegado.modResults.contents = quitarCacheDeRed(configDelDelegado.modResults.contents);
    return configDelDelegado;
  });
}

module.exports = sinCacheDeRed;
module.exports.quitarCacheDeRed = quitarCacheDeRed;
module.exports.MARCA = MARCA;
