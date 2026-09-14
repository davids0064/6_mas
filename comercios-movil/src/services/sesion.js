// Sesión del comercio.
//
// Mismo diseño que en la app de usuarios: copia en memoria (la que leen api.js
// y las pantallas, de forma síncrona) respaldada en AsyncStorage para que
// cerrar la app no obligue a volver a entrar. Un local abre esto varias veces
// al día, muchas veces con las manos ocupadas; pedirle la contraseña cada vez
// sería una forma segura de que deje de abrirlo.
//
// Las claves llevan prefijo propio (`@seismas-comercios/`) y no se comparten
// con la app de usuarios: son apps distintas, con sandboxes distintos y tokens
// que ni siquiera firma el mismo servicio.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_TOKEN = '@seismas-comercios/token';
const CLAVE_COMERCIO = '@seismas-comercios/comercio';

let _token = null;
let _comercio = null;

export const sesion = {
  // Escribe en memoria primero y en disco después sin esperar: quien llama
  // necesita la sesión disponible ya, y el disco es el respaldo para el
  // próximo arranque.
  guardar({ token, comercio }) {
    _token = token || null;
    _comercio = comercio || null;
    AsyncStorage.multiSet([
      [CLAVE_TOKEN, _token || ''],
      [CLAVE_COMERCIO, _comercio ? JSON.stringify(_comercio) : ''],
    ]).catch(() => {});
  },

  limpiar() {
    _token = null;
    _comercio = null;
    AsyncStorage.multiRemove([CLAVE_TOKEN, CLAVE_COMERCIO]).catch(() => {});
  },

  // Se llama una vez, al arrancar. No valida el token contra la API: si venció,
  // la primera petición devolverá 401 y api.js limpiará la sesión sola.
  async restaurar() {
    try {
      const guardado = Object.fromEntries(
        await AsyncStorage.multiGet([CLAVE_TOKEN, CLAVE_COMERCIO]),
      );
      _token = guardado[CLAVE_TOKEN] || null;
      const crudo = guardado[CLAVE_COMERCIO];
      _comercio = crudo ? JSON.parse(crudo) : null;
    } catch {
      // Almacenamiento ilegible o JSON corrupto: se arranca sin sesión, que es
      // el estado seguro. Peor sería no dejar abrir la app.
      _token = null;
      _comercio = null;
    }
    return _token !== null;
  },

  token: () => _token,
  comercio: () => _comercio,
  haySesion: () => _token !== null,
};
