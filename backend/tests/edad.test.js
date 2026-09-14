// ============================================================================
// Cálculo de la mayoría de edad (services/edad.js).
//
// Corre sin base de datos ni servidor:
//
//   cd backend && npm test
//
// El caso que justifica la suite entera es el de la persona cuyo cumpleaños
// todavía no llegó este año: la resta ingenua de años la daría por mayor de
// edad un día antes de serlo, y ese día es exactamente el que el requisito de
// edad existe para cubrir.
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const { edadEnAnios, EDAD_MINIMA } = require('../src/services/edad');

// Referencia fija para que las pruebas no cambien de resultado con el paso del
// tiempo: sin ella, "cumple mañana" pasaría a ser "cumplió ayer" y la suite
// empezaría a fallar sola meses después.
const HOY = new Date('2026-09-01T00:00:00Z');

test('cuenta los años cumplidos', () => {
  assert.equal(edadEnAnios('2000-09-01', HOY), 26);
  assert.equal(edadEnAnios('1990-01-15', HOY), 36);
});

test('no cuenta el cumpleaños que aún no llegó', () => {
  // Cumple 18 el 2 de septiembre: el día 1 todavía tiene 17.
  assert.equal(edadEnAnios('2008-09-02', HOY), 17);
  // El mismo día del cumpleaños ya cuenta.
  assert.equal(edadEnAnios('2008-09-01', HOY), 18);
  // Y el día siguiente, obviamente.
  assert.equal(edadEnAnios('2008-08-31', HOY), 18);
});

test('un mes posterior en el año también resta', () => {
  // Cumple en diciembre: en septiembre todavía no.
  assert.equal(edadEnAnios('2008-12-31', HOY), 17);
});

test('rechaza fechas inválidas y futuras con null', () => {
  assert.equal(edadEnAnios('no soy una fecha', HOY), null);
  assert.equal(edadEnAnios('', HOY), null);
  // Futura: null y no un número negativo, para que la ruta responda "fecha
  // inválida" en vez de "eres menor de edad", que confundiría a quien se
  // equivocó tecleando el año.
  assert.equal(edadEnAnios('2030-01-01', HOY), null);
});

test('la frontera de los 18 separa a quien entra de quien no', () => {
  const justoAlLimite = edadEnAnios('2008-09-01', HOY);
  const unDiaCorto = edadEnAnios('2008-09-02', HOY);
  assert.ok(justoAlLimite >= EDAD_MINIMA, 'quien cumple hoy debe poder registrarse');
  assert.ok(unDiaCorto < EDAD_MINIMA, 'quien cumple mañana todavía no');
});
