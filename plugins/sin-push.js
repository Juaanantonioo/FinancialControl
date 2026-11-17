/**
 * Plugin de configuración local: quita el permiso de notificaciones remotas
 * (`aps-environment`) de los entitlements de la app.
 *
 * Por qué existe: Expo añade ese permiso por su cuenta en cuanto el proyecto
 * tiene instalada la biblioteca expo-notifications, aunque no se use su
 * plugin. Una cuenta de Apple gratuita no puede firmar una app con ese
 * permiso, y la compilación para el iPhone falla. La app solo usa
 * notificaciones locales, que no lo necesitan. Antes se quitaba a mano en
 * Xcode y volvía a aparecer cada vez que se regeneraba la carpeta ios/.
 *
 * No tiene dependencias propias: usa la API de plugins que ya trae Expo.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

/** Quita el permiso de un diccionario de entitlements. Se exporta para poder probarlo. */
function quitarPush(entitlements) {
  delete entitlements['aps-environment'];
  return entitlements;
}

function sinPush(config) {
  return withEntitlementsPlist(config, (configDeEntitlements) => {
    configDeEntitlements.modResults = quitarPush(configDeEntitlements.modResults);
    return configDeEntitlements;
  });
}

module.exports = sinPush;
module.exports.quitarPush = quitarPush;
