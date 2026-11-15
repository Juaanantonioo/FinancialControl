// Pruebas automáticas. El preset de Expo sabe transformar TypeScript y los
// módulos de React Native.
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
