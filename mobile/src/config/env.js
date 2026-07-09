// Configuración de entorno del cliente móvil. Se centraliza aquí en vez de
// usar react-native-config para no añadir una dependencia nativa extra en el
// MVP; si el proyecto crece, migrar solo requiere reemplazar este archivo.
import { Platform } from 'react-native';

// Simulador de iOS: localhost apunta a la Mac host, así que el backend en
// localhost:3000 es alcanzable directamente.
const URL_SIMULADOR_IOS = 'http://localhost:3000';

// Dispositivo físico: localhost apuntaría al propio teléfono. Reemplaza esta
// IP por la de tu Mac en la red LAN (`ipconfig getifaddr en0`). Ver
// mobile/README.md sección "Conectar la app al backend local".
const URL_DISPOSITIVO_FISICO = 'http://192.168.1.100:3000';

// __DEV__ es una global inyectada por Metro; solo distingue dev de release,
// no simulador de dispositivo físico — ese ajuste sigue siendo manual acá
// mientras no se corra en release contra un backend desplegado.
const USAR_DISPOSITIVO_FISICO = false;

export const API_BASE_URL = USAR_DISPOSITIVO_FISICO
  ? URL_DISPOSITIVO_FISICO
  : URL_SIMULADOR_IOS;

export const PLATAFORMA = Platform.OS;
