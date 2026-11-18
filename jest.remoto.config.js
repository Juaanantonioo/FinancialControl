// Pruebas contra la instancia LOCAL de Supabase (Docker). No forman parte de
// `npm run check`: se lanzan con `npm run test:remoto`, que lee la dirección y
// la clave pública de la instancia local y las pasa por el entorno, sin
// escribirlas en ningún fichero.
module.exports = {
  // Sin el preset de Expo: aquí hace falta la red de verdad de Node, no la simulada de React Native.
  testEnvironment: 'node',
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  transformIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/supabase/pruebas/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-libsodium$': '<rootDir>/src/pruebas/sodioDePrueba.ts',
  },
  testTimeout: 30000,
  maxWorkers: 1,
};
