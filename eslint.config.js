// Análisis estático (T-006). Parte de la configuración oficial de Expo.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*', 'node_modules/*'] },
]);
