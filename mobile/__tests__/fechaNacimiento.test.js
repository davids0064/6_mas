// ============================================================================
// Interpretación de la fecha de nacimiento del formulario de registro.
//
//   cd mobile && npm test
//
// El campo se teclea a mano en DD/MM/AAAA, así que estas dos funciones son la
// frontera entre lo que la persona escribe y la fecha que se guarda para
// siempre en su perfil. Un fallo aquí no se ve: se traduce en una fecha de
// nacimiento silenciosamente equivocada, y con ella en una validación de
// mayoría de edad que deja pasar a quien no debe.
// ============================================================================

import { interpretarFecha, aISO } from '../src/screens/RegistroScreen';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View }, FadeInDown: { delay: () => ({ duration: () => ({}) }), duration: () => ({}) } };
});
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

test('interpreta una fecha bien escrita', () => {
  const fecha = interpretarFecha('20/03/1995');
  expect(fecha).not.toBeNull();
  expect(fecha.getFullYear()).toBe(1995);
  expect(fecha.getMonth()).toBe(2); // marzo, base 0
  expect(fecha.getDate()).toBe(20);
});

test('rechaza lo que no tiene la forma DD/MM/AAAA', () => {
  expect(interpretarFecha('')).toBeNull();
  expect(interpretarFecha('1995-03-20')).toBeNull();
  expect(interpretarFecha('20/3/1995')).toBeNull();
  expect(interpretarFecha('ayer')).toBeNull();
});

test('rechaza días que no existen en vez de desbordarlos', () => {
  // El caso que justifica comparar los componentes de vuelta: new Date(1995, 1, 31)
  // no falla, se convierte en el 3 de marzo. Aceptarlo guardaría una fecha de
  // nacimiento que la persona nunca escribió.
  expect(interpretarFecha('31/02/1995')).toBeNull();
  expect(interpretarFecha('31/04/1995')).toBeNull();
  expect(interpretarFecha('32/01/1995')).toBeNull();
  expect(interpretarFecha('01/13/1995')).toBeNull();
  // 2024 sí fue bisiesto; 1995 no.
  expect(interpretarFecha('29/02/2024')).not.toBeNull();
  expect(interpretarFecha('29/02/1995')).toBeNull();
});

test('rechaza fechas futuras', () => {
  expect(interpretarFecha('01/01/2999')).toBeNull();
});

test('aISO no corre la fecha un día al pasar por UTC', () => {
  // toISOString() sobre una fecha local de medianoche resta horas y puede
  // devolver el día anterior. El cumpleaños de alguien no depende del huso.
  expect(aISO(new Date(1995, 2, 20))).toBe('1995-03-20');
  expect(aISO(new Date(2000, 0, 1))).toBe('2000-01-01');
  expect(aISO(new Date(1988, 11, 31))).toBe('1988-12-31');
});
