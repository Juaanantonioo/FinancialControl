// Pruebas automáticas. El preset de Expo sabe transformar TypeScript y los
// módulos de React Native.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Sin código nativo en Node: la misma libsodium, en WebAssembly.
    '^react-native-libsodium$': '<rootDir>/src/pruebas/sodioDePrueba.ts',
  },
  // Las pruebas contra la instancia local de Supabase van aparte: `npm run test:remoto`.
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/supabase/'],
};
