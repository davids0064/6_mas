// ============================================================================
// Formateo de fechas de la API (src/util/formato.js).
//
//   cd comercios-movil && npm test
//
// Esta suite existe por un fallo concreto que se vio corriendo la app: todas
// las fechas salían en blanco y ningún evento de hoy se contaba como "hoy".
//
// La causa es que PDO devuelve los timestamptz de Postgres como
// "2026-09-01 20:14:57-05", que no es ISO 8601 — espacio en vez de "T" y
// desfase de dos dígitos sin minutos. El navegador lo tolera (por eso el
// dashboard web nunca lo notó) pero Hermes, el motor de React Native, devuelve
// Invalid Date. Y el síntoma es mudo: comparar contra NaN da false sin lanzar
// nada, así que la app se veía "bien", solo que sin fechas.
// ============================================================================

import { aFecha, fechaCorta, fechaLarga, horaSola, esHoy, precio, hoyISO } from '../src/util/formato';

describe('aFecha', () => {
  test('entiende el formato que manda la API PHP', () => {
    const f = aFecha('2026-09-01 20:14:57-05');
    expect(Number.isNaN(f.getTime())).toBe(false);
    // 20:14:57 en UTC-5 son las 01:14:57 UTC del día siguiente.
    expect(f.toISOString()).toBe('2026-09-02T01:14:57.000Z');
  });

  test('acepta también ISO 8601 bien formado', () => {
    expect(aFecha('2026-09-01T20:14:57-05:00').toISOString()).toBe('2026-09-02T01:14:57.000Z');
    expect(aFecha('2026-09-02T01:14:57Z').toISOString()).toBe('2026-09-02T01:14:57.000Z');
  });

  test('acepta el desfase pegado de cuatro dígitos', () => {
    expect(aFecha('2026-09-01 20:14:57-0500').toISOString()).toBe('2026-09-02T01:14:57.000Z');
  });

  test('un Date ya construido pasa tal cual', () => {
    const original = new Date('2026-09-02T01:14:57Z');
    expect(aFecha(original)).toBe(original);
  });

  test('lo que no es fecha da Invalid Date, no una excepción', () => {
    expect(Number.isNaN(aFecha(null).getTime())).toBe(true);
    expect(Number.isNaN(aFecha(undefined).getTime())).toBe(true);
    expect(Number.isNaN(aFecha('no soy una fecha').getTime())).toBe(true);
  });
});

describe('formateo visible', () => {
  // Se construye con la zona local del entorno de pruebas para que la suite no
  // dependa de en qué huso corre.
  const local = new Date(2026, 8, 1, 20, 14); // 1 de septiembre de 2026, 20:14

  test('fechaLarga escribe el día en español, sin depender del locale del móvil', () => {
    // El día de la semana del 1 de septiembre de 2026 es martes.
    expect(fechaLarga(local)).toBe('martes 1 de septiembre, 8:14 p. m.');
  });

  test('fechaCorta abrevia el mes', () => {
    expect(fechaCorta(local)).toBe('1 sep · 8:14 p. m.');
  });

  test('el mediodía y la medianoche no se escriben como las 0', () => {
    expect(fechaCorta(new Date(2026, 8, 1, 12, 0))).toBe('1 sep · 12:00 p. m.');
    expect(fechaCorta(new Date(2026, 8, 1, 0, 30))).toBe('1 sep · 12:30 a. m.');
  });

  test('horaSola da solo la hora, para la tarjeta del bloque HOY', () => {
    expect(horaSola(local)).toBe('8:14 p. m.');
    // Construida en local a propósito: una cadena con desfase fijo ("…-05")
    // solo daría esta hora si la suite corriera en Colombia, y una prueba que
    // depende del huso de quien la ejecuta falla sola en cuanto alguien la
    // corre desde otro sitio o en CI.
    expect(horaSola(new Date(2026, 8, 1, 8, 5))).toBe('8:05 a. m.');
  });

  test('una fecha inválida no imprime "Invalid Date" en pantalla', () => {
    expect(fechaCorta('no soy una fecha')).toBe('');
    expect(fechaLarga(null)).toBe('');
    expect(horaSola('no soy una fecha')).toBe('');
  });
});

describe('esHoy', () => {
  test('un evento de esta noche cuenta como hoy aunque falten horas', () => {
    const hoy = new Date();
    const estaNoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 30);
    expect(esHoy(estaNoche)).toBe(true);
  });

  test('compara por día de calendario y no por diferencia de horas', () => {
    const hoy = new Date();
    // Mañana a las 8 a. m. puede estar a menos de 24 horas y aun así no es hoy.
    const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1, 8, 0);
    expect(esHoy(manana)).toBe(false);
  });

  test('una fecha ilegible no se cuela como si fuera hoy', () => {
    // Éste es el fallo original: sin la guarda, la comparación contra NaN daba
    // false y el evento caía en "próximos" en vez de en "hoy"; con una guarda
    // mal puesta podría caer al revés. Se fija el comportamiento.
    expect(esHoy('no soy una fecha')).toBe(false);
    expect(esHoy(null)).toBe(false);
  });
});

describe('precio', () => {
  test('separa los miles con punto, como se escribe en Colombia', () => {
    expect(precio(45000)).toBe('45.000');
    expect(precio(1250000)).toBe('1.250.000');
    expect(precio(900)).toBe('900');
  });

  test('redondea y tolera lo que llega como texto o vacío', () => {
    expect(precio('45000.4')).toBe('45.000');
    expect(precio(null)).toBe('0');
  });
});

describe('hoyISO', () => {
  test('devuelve el día local, no el que resultaría de pasar por UTC', () => {
    const hoy = new Date();
    const esperado = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0'),
    ].join('-');
    expect(hoyISO()).toBe(esperado);
  });
});
