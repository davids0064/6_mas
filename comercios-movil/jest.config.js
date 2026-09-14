module.exports = {
  preset: 'react-native',
  // AsyncStorage es un módulo nativo: fuera del simulador no existe y cualquier
  // archivo que importe src/services/sesion.js reventaría al cargarse.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Solo los archivos *.test.js son suites. Por defecto jest trata como prueba
  // cualquier cosa dentro de __tests__, y ahí vive también ayuda-render.js, que
  // son utilidades compartidas y no tiene pruebas propias.
  testMatch: ['**/__tests__/**/*.test.js'],
};
