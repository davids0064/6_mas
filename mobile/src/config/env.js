// Configuración de entorno del cliente móvil. Se centraliza aquí en vez de
// usar react-native-config para no añadir una dependencia nativa extra en el
// MVP; si el proyecto crece, migrar solo requiere reemplazar este archivo.
import { Platform } from 'react-native';

// --- Producción --------------------------------------------------------------
//
// El backend desplegado en Railway. Es HTTPS, así que no necesita ninguna
// excepción de App Transport Security: la build de release sale sin permisos
// de HTTP en claro, que es como tiene que salir.
const URL_PRODUCCION = 'https://api-production-2a3c5.up.railway.app';

// --- Desarrollo --------------------------------------------------------------
//
// Simulador de iOS: localhost apunta a la Mac host, así que el backend en
// localhost:3000 es alcanzable directamente.
const URL_SIMULADOR_IOS = 'http://localhost:3000';

// Emulador de Android: 10.0.2.2 es el alias que el emulador da al host. Con
// localhost apuntaría a la propia máquina virtual y no habría backend ahí.
const URL_EMULADOR_ANDROID = 'http://10.0.2.2:3000';

// Dispositivo físico: localhost apuntaría al propio teléfono. Reemplaza esta
// IP por la de tu Mac en la red LAN (`ipconfig getifaddr en0`). Ver
// mobile/README.md sección "Conectar la app al backend local".
const URL_DISPOSITIVO_FISICO = 'http://192.168.1.100:3000';

// __DEV__ es una global inyectada por Metro: es `false` en cualquier build de
// release (Xcode en configuración Release, `assembleRelease`, TestFlight) y
// `true` corriendo contra el bundler. Es el único interruptor que decide entre
// producción y local, y no lo pone una persona: antes, un release compilado
// sin acordarse de cambiar una constante salía apuntando a `localhost`, es
// decir, a una app que no podía hablar con nada.
export const ES_PRODUCCION = !__DEV__;

// Este sí sigue siendo manual, porque Metro no distingue simulador de
// dispositivo físico: los dos son desarrollo. Solo afecta a builds de debug —
// en release manda la URL de producción pase lo que pase con esta bandera.
const USAR_DISPOSITIVO_FISICO = false;

function urlDeDesarrollo() {
  if (USAR_DISPOSITIVO_FISICO) return URL_DISPOSITIVO_FISICO;
  return Platform.OS === 'android' ? URL_EMULADOR_ANDROID : URL_SIMULADOR_IOS;
}

export const API_BASE_URL = ES_PRODUCCION ? URL_PRODUCCION : urlDeDesarrollo();

export const PLATAFORMA = Platform.OS;

// Apuntar una build de debug al backend desplegado (para probar contra datos
// reales sin compilar en release) es cambiar esta línea por
// `export const API_BASE_URL = URL_PRODUCCION;` — a sabiendas de que entonces
// el registro y el matching se hacen contra la base de producción.
