/**
 * En las pruebas, `react-native-libsodium` se sustituye por este fichero
 * (ver `jest.config.js`). No hay código nativo en Node, así que se usa la
 * misma libsodium compilada a WebAssembly, en su variante «sumo»: es la que
 * la app usará en el navegador. Las funciones y sus resultados son los mismos.
 */
import sodio from 'libsodium-wrappers-sumo';

const conCarga = Object.assign(sodio, { loadSumoVersion: () => undefined });

export default conCarga;
