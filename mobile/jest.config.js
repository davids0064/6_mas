module.exports = {
  preset: 'react-native',
  // AsyncStorage es un módulo nativo: fuera del simulador no existe y cualquier
  // archivo que importe src/services/sesion.js reventaría al cargarse. La
  // librería trae su propio mock en memoria, que es exactamente el
  // comportamiento que las pruebas necesitan.
  setupFiles: ['<rootDir>/jest.setup.js'],
};
