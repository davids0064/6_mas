// ============================================================================
// Persistencia de la sesión del comercio (src/services/sesion.js).
//
//   cd comercios-movil && npm test
//
// Lo que hay que garantizar es lo que App.js da por hecho al arrancar: que
// `restaurar()` devuelve true cuando había sesión, false cuando no, y que
// nunca lanza — si tirara una excepción, la app se quedaría en el indicador de
// carga sin llegar a pintar nada.
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sesion } from '../src/services/sesion';

const COMERCIO = { id: 'c-1', nombre: 'Café de la Esquina', email: 'hola@cafe.test' };

// `guardar` y `limpiar` no esperan a que termine la escritura a propósito (la
// sesión tiene que estar disponible ya, en memoria). Las pruebas sí necesitan
// esperarla antes de leer el disco.
const esperarEscritura = () => new Promise((resolver) => setImmediate(resolver));

beforeEach(async () => {
  await AsyncStorage.clear();
  sesion.limpiar();
});

test('sin nada guardado, no hay sesión que restaurar', async () => {
  await expect(sesion.restaurar()).resolves.toBe(false);
  expect(sesion.haySesion()).toBe(false);
  expect(sesion.token()).toBeNull();
});

// El viaje de ida y el de vuelta se prueban por separado y no simulando un
// "reinicio": la copia en memoria vive en el módulo, y la única forma honesta
// de vaciarla sin tocar el disco sería recargar el módulo, lo que recargaría
// también el almacenamiento simulado.
test('guardar deja el token y el comercio escritos en disco', async () => {
  sesion.guardar({ token: 'tok-abc', comercio: COMERCIO });
  await esperarEscritura();

  expect(await AsyncStorage.getItem('@seismas-comercios/token')).toBe('tok-abc');
  expect(JSON.parse(await AsyncStorage.getItem('@seismas-comercios/comercio'))).toEqual(COMERCIO);
});

test('restaurar recupera la sesión que dejó el arranque anterior', async () => {
  await AsyncStorage.setItem('@seismas-comercios/token', 'tok-abc');
  await AsyncStorage.setItem('@seismas-comercios/comercio', JSON.stringify(COMERCIO));

  await expect(sesion.restaurar()).resolves.toBe(true);
  expect(sesion.token()).toBe('tok-abc');
  expect(sesion.comercio()).toEqual(COMERCIO);
  expect(sesion.haySesion()).toBe(true);
});

test('las claves no chocan con las de la app de usuarios', async () => {
  // Son apps distintas, con tokens que ni siquiera firma el mismo servicio.
  // Compartir prefijo sería inofensivo hoy (sandboxes separados) y un problema
  // el día que alguien pruebe las dos en el mismo contexto.
  sesion.guardar({ token: 'tok-abc', comercio: COMERCIO });
  await esperarEscritura();

  const claves = await AsyncStorage.getAllKeys();
  expect(claves.every((k) => k.startsWith('@seismas-comercios/'))).toBe(true);
});

test('limpiar borra también el disco, no solo la memoria', async () => {
  sesion.guardar({ token: 'tok-abc', comercio: COMERCIO });
  await esperarEscritura();

  sesion.limpiar();
  await esperarEscritura();

  await expect(sesion.restaurar()).resolves.toBe(false);
  expect(sesion.token()).toBeNull();
});

test('un comercio corrupto en disco no impide arrancar', async () => {
  await AsyncStorage.setItem('@seismas-comercios/token', 'tok-abc');
  await AsyncStorage.setItem('@seismas-comercios/comercio', '{esto no es json');

  await expect(sesion.restaurar()).resolves.toBe(false);
  expect(sesion.token()).toBeNull();
});
