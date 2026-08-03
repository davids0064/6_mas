// Sesión del usuario en el cliente.
//
// El token vive SOLO en memoria: al cerrar la app se pierde y hay que volver a
// entrar. Persistirlo requiere almacenamiento nativo
// (@react-native-async-storage/async-storage y un `pod install`), y para el
// beta se prefirió no meter una dependencia nativa más antes de tener el
// backend desplegado.
//
// Cuando se agregue, el cambio queda contenido en este archivo: `guardar` y
// `limpiar` pasan a ser async y escriben en AsyncStorage, y App.js consulta
// `token()` al arrancar para saltarse el login. Nada de esto toca a api.js ni
// a las pantallas.
let _token = null;
let _usuario = null;

export const sesion = {
  guardar({ token, usuario }) {
    _token = token || null;
    _usuario = usuario || null;
  },
  limpiar() {
    _token = null;
    _usuario = null;
  },
  token: () => _token,
  usuario: () => _usuario,
  haySesion: () => _token !== null,
};
