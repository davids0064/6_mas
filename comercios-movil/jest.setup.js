// Mock del almacenamiento nativo para las pruebas. Es el que publica la propia
// librería: guarda en memoria y respeta la misma API asíncrona, así que
// src/services/sesion.js se prueba tal cual, sin condicionales de entorno
// dentro del código de producción.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
