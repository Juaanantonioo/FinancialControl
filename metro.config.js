// Configuración de Metro. Solo cambia dos cosas respecto a la de Expo, y las
// dos son para la versión web (bloque 5):
//
// 1. Los ficheros .wasm cuentan como recursos: expo-sqlite en el navegador es
//    SQLite compilado a WebAssembly.
// 2. El servidor de DESARROLLO envía las cabeceras de aislamiento que
//    expo-sqlite necesita en web (SharedArrayBuffer). En el sitio publicado
//    esas cabeceras las pone el alojamiento: ver `public/_headers`.
//
// No afecta a la compilación de iOS.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
