/**
 * Plugin de configuración local: parche TEMPORAL de una línea de enlace de
 * `react-native-libsodium` 1.7.0 para que compile en iOS con React Native 0.88.
 *
 * POR QUÉ EXISTE
 *   El paquete obtiene el motor de JavaScript a través de `RCTCxxBridge`, una
 *   clase del puente antiguo que React Native 0.88 ha eliminado. Sin este
 *   parche la compilación para iOS falla con «unknown type name 'RCTCxxBridge'».
 *
 * DE DÓNDE SALE
 *   Es, literalmente, el cambio propuesto en el repositorio del paquete:
 *   https://github.com/serenity-kit/react-native-libsodium/pull/109
 *   (abierto el 17/10/2026, sin revisar ni fusionar a 18/11/2026). La
 *   incidencia que describe el fallo es la #110.
 *
 * QUÉ CAMBIA
 *   Un solo fichero, `ios/Libsodium.mm`: tres sustituciones, escritas más abajo
 *   en `SUSTITUCIONES`. En lugar de convertir el puente a `RCTCxxBridge` y leer
 *   su propiedad `runtime`, se le pide `runtime` al objeto que React Native 0.88
 *   pone en su lugar (`RCTBridgeProxy`), que ya tiene ese método aunque no lo
 *   declare en una cabecera pública.
 *
 * QUÉ NO CAMBIA
 *   Nada de criptografía. No se toca libsodium (que va compilada dentro del
 *   paquete), ni el código C++ que la llama (`cpp/`), ni el JavaScript. Solo
 *   cambia cómo se entrega el motor de JavaScript a ese código.
 *
 * CÓMO SE PROTEGE
 *   - Antes de tocar nada se calcula la huella SHA-256 del fichero. Solo se
 *     parchea si es exactamente la del original de la versión 1.7.0.
 *   - Tras parchear se comprueba la huella del resultado.
 *   - Si el fichero ya está parcheado no se hace nada: aplicarlo dos veces no
 *     cambia nada.
 *   - Con cualquier otra huella (otra versión del paquete, un fichero alterado)
 *     se lanza un error y la compilación se detiene. No se intenta adivinar.
 *   - Además, la app comprueba al arrancar las funciones de cuenta que la
 *     biblioteca nativa da los resultados conocidos (`src/cripto/autocomprobacion.ts`).
 *
 * CUÁNDO RETIRARLO
 *   Cuando `react-native-libsodium` publique una versión que compile con
 *   React Native 0.88. Entonces: actualizar el paquete, borrar este fichero,
 *   quitarlo de `app.json` y de `postinstall` en `package.json`, y volver a
 *   pasar las pruebas y la autocomprobación. Mientras el paquete siga en la
 *   1.7.0 exacta (fijada en `package.json`), este parche es necesario.
 *
 * Se ejecuta en dos momentos: tras `npm install` (script `postinstall`) y en
 * cada `npx expo prebuild`. No tiene dependencias propias.
 */
const { createHash } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const VERSION_DEL_PAQUETE = '1.7.0';
const FICHERO = join('node_modules', 'react-native-libsodium', 'ios', 'Libsodium.mm');

/** Huella SHA-256 de `ios/Libsodium.mm` tal como viene en react-native-libsodium 1.7.0. */
const HUELLA_ORIGINAL = '5dde95ec788c636dc8486b27d7e3f698f1a41949a6d63f063d21b2374140e7af';
/** Huella SHA-256 del mismo fichero con las tres sustituciones aplicadas. */
const HUELLA_PARCHEADA = '0701f35405d7539233c04a2846b8e957c3ed0194f9136eb8a7522cdf3dd45569';

/** El parche, entero. Cada texto de `antes` aparece una sola vez en el original. */
const SUSTITUCIONES = [
  {
    // Declara el método que el objeto del puente ya tiene. No añade código.
    antes: '#import "react-native-libsodium.h"\n\n@implementation Libsodium\n',
    despues:
      '#import "react-native-libsodium.h"\n\n' +
      '@interface RCTBridge (LibsodiumRuntime)\n- (void *)runtime;\n@end\n\n' +
      '@implementation Libsodium\n',
  },
  {
    // Pide el motor al puente, sin convertirlo a la clase eliminada.
    antes:
      '  RCTCxxBridge *cxxBridge = (RCTCxxBridge *)self.bridge;\n  if (!cxxBridge.runtime) {\n',
    despues: '  void *runtime = [self.bridge runtime];\n  if (!runtime) {\n',
  },
  {
    // Entrega ese mismo motor a la misma función de instalación de siempre.
    antes: '(facebook::jsi::Runtime *)cxxBridge.runtime);',
    despues: '(facebook::jsi::Runtime *)runtime);',
  },
];

function huellaDe(contenido) {
  return createHash('sha256').update(contenido).digest('hex');
}

/**
 * Devuelve el contenido que debe quedar en el fichero. Lanza un error si el
 * contenido recibido no es ni el original esperado ni el ya parcheado.
 * Es una función pura, para poder probarla.
 */
function parchear(contenido) {
  const huella = huellaDe(contenido);
  if (huella === HUELLA_PARCHEADA) return contenido;
  if (huella !== HUELLA_ORIGINAL) {
    throw new Error(
      `[parche-libsodium] ${FICHERO} no es el fichero esperado de react-native-libsodium ` +
        `${VERSION_DEL_PAQUETE} (huella ${huella}). No se parchea. Si has cambiado la versión ` +
        'del paquete, comprueba si ya compila con React Native 0.88 y, en ese caso, retira ' +
        'plugins/parche-libsodium.js siguiendo las instrucciones de su cabecera.',
    );
  }
  let resultado = contenido;
  for (const { antes, despues } of SUSTITUCIONES) {
    if (resultado.split(antes).length !== 2) {
      throw new Error('[parche-libsodium] Una sustitución no encaja exactamente una vez.');
    }
    resultado = resultado.replace(antes, despues);
  }
  if (huellaDe(resultado) !== HUELLA_PARCHEADA) {
    throw new Error('[parche-libsodium] El resultado del parche no tiene la huella esperada.');
  }
  return resultado;
}

/** Aplica el parche al fichero del proyecto. Devuelve `true` si lo ha modificado. */
function aplicarEn(raizDelProyecto) {
  const ruta = join(raizDelProyecto, FICHERO);
  if (!existsSync(ruta)) {
    throw new Error(`[parche-libsodium] No existe ${FICHERO}. Ejecuta npm install.`);
  }
  const contenido = readFileSync(ruta, 'utf8');
  const resultado = parchear(contenido);
  if (resultado === contenido) return false;
  writeFileSync(ruta, resultado);
  return true;
}

function parcheLibsodium(config) {
  const { withDangerousMod } = require('expo/config-plugins');
  return withDangerousMod(config, [
    'ios',
    (configDeIos) => {
      aplicarEn(configDeIos.modRequest.projectRoot);
      return configDeIos;
    },
  ]);
}

module.exports = parcheLibsodium;
Object.assign(module.exports, {
  aplicarEn,
  parchear,
  huellaDe,
  FICHERO,
  HUELLA_ORIGINAL,
  HUELLA_PARCHEADA,
  SUSTITUCIONES,
  VERSION_DEL_PAQUETE,
});

// Ejecutado directamente (script `postinstall`): parchea el proyecto en curso.
if (require.main === module) {
  aplicarEn(process.cwd());
}
