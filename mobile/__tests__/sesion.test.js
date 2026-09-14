// ============================================================================
// Persistencia de la sesión (src/services/sesion.js).
//
//   cd mobile && npm test
//
// Antes el token vivía solo en memoria y cerrar la app obligaba a volver a
// iniciar sesión. Ahora se guarda en disco, y lo que hay que garantizar es lo
// que App.js da por hecho al arrancar: que `restaurar()` devuelve true cuando
// había sesión, false cuando no, y que nunca revienta — si tirara una
// excepción, la app no llegaría a pintar nada.
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sesion } from '../src/services/sesion';

const USUARIO = { id: 'u-1', nombre: 'Ana Ruiz', email: 'ana@ejemplo.test' };

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
// también el almacenamiento simulado. Comprobar cada mitad contra el disco
// real del test demuestra lo mismo sin trucos.
test('guardar deja el token y el perfil escritos en disco', async () => {
  sesion.guardar({ token: 'tok-abc', usuario: USUARIO });
  await esperarEscritura();

  expect(await AsyncStorage.getItem('@seismas/token')).toBe('tok-abc');
  expect(JSON.parse(await AsyncStorage.getItem('@seismas/usuario'))).toEqual(USUARIO);
});

test('restaurar recupera la sesión que dejó el arranque anterior', async () => {
  await AsyncStorage.setItem('@seismas/token', 'tok-abc');
  await AsyncStorage.setItem('@seismas/usuario', JSON.stringify(USUARIO));

  await expect(sesion.restaurar()).resolves.toBe(true);
  expect(sesion.token()).toBe('tok-abc');
  expect(sesion.usuario()).toEqual(USUARIO);
  expect(sesion.haySesion()).toBe(true);
});

test('limpiar borra también el disco, no solo la memoria', async () => {
  sesion.guardar({ token: 'tok-abc', usuario: USUARIO });
  await esperarEscritura();

  sesion.limpiar();
  await esperarEscritura();

  await expect(sesion.restaurar()).resolves.toBe(false);
  expect(sesion.token()).toBeNull();
});

test('un perfil corrupto en disco no impide arrancar', async () => {
  await AsyncStorage.setItem('@seismas/token', 'tok-abc');
  await AsyncStorage.setItem('@seismas/usuario', '{esto no es json');

  // Lo que importa es que no lance: la app arranca sin sesión, que es el
  // estado seguro, en vez de quedarse en negro.
  await expect(sesion.restaurar()).resolves.toBe(false);
  expect(sesion.token()).toBeNull();
});
