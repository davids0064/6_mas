// Sesión del usuario en el cliente.
//
// El token y el perfil se guardan en almacenamiento nativo (AsyncStorage), no
// solo en memoria. Antes vivían únicamente en una variable de módulo: cerrar
// la app borraba la sesión y había que volver a escribir correo y contraseña
// en cada arranque. Para una app que la gente abre a mirar si ya tiene grupo,
// eso convertía el gesto de 2 segundos en un login completo.
//
// La copia en memoria (`_token`) sigue existiendo y es la que leen api.js y
// las pantallas: el disco es solo el respaldo. Así `token()` sigue siendo
// síncrono y ninguna de las dos capas tuvo que volverse async — el único
// punto que espera al disco es `restaurar()`, que App.js llama una vez al
// arrancar.
//
// Nota de seguridad: AsyncStorage no está cifrado, vive en el sandbox de la
// app. Para un JWT de sesión es el estándar en React Native y no es motivo de
// rechazo; si algún día se guardan datos de pago o de salud, esto tiene que
// pasar a Keychain (react-native-keychain), y el cambio queda contenido aquí.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_TOKEN = '@seismas/token';
const CLAVE_USUARIO = '@seismas/usuario';

let _token = null;
let _usuario = null;

export const sesion = {
  // Escribe en memoria primero y en disco después, sin esperar: quien llama
  // (api.registrarUsuario / api.login) necesita que la sesión esté disponible
  // ya, y la escritura en disco es un respaldo para el próximo arranque. Si
  // falla, la sesión sigue siendo válida durante esta ejecución.
  guardar({ token, usuario }) {
    _token = token || null;
    _usuario = usuario || null;
    AsyncStorage.multiSet([
      [CLAVE_TOKEN, _token || ''],
      [CLAVE_USUARIO, _usuario ? JSON.stringify(_usuario) : ''],
    ]).catch(() => {});
  },

  limpiar() {
    _token = null;
    _usuario = null;
    AsyncStorage.multiRemove([CLAVE_TOKEN, CLAVE_USUARIO]).catch(() => {});
  },

  // Se llama una sola vez, al arrancar. Devuelve si había una sesión guardada
  // para que App.js decida entre login y grupos. No valida el token contra el
  // backend: si venció, la primera llamada devolverá 401 y api.js limpiará la
  // sesión sola. Verificarlo aquí añadiría una consulta de red al arranque
  // para adelantar algo que el flujo normal ya resuelve.
  async restaurar() {
    try {
      const pares = await AsyncStorage.multiGet([CLAVE_TOKEN, CLAVE_USUARIO]);
      const guardado = Object.fromEntries(pares);
      _token = guardado[CLAVE_TOKEN] || null;
      const crudo = guardado[CLAVE_USUARIO];
      _usuario = crudo ? JSON.parse(crudo) : null;
    } catch {
      // Almacenamiento ilegible o JSON corrupto: se arranca sin sesión, que es
      // el estado seguro. Peor sería propagar el error y no dejar abrir la app.
      _token = null;
      _usuario = null;
    }
    return _token !== null;
  },

  token: () => _token,
  usuario: () => _usuario,
  haySesion: () => _token !== null,
};
