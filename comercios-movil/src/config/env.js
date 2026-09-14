// Configuración de entorno de la app de comercios.
//
// Ojo con una diferencia importante frente a la app de usuarios: esta app NO
// habla con el backend de Node (`backend/`), sino con la API PHP del panel de
// comercios (`dashboard/api/`). Son dos servicios distintos contra la misma
// base, y se conectan con roles de PostgreSQL distintos — `seis_dashboard` no
// tiene ningún permiso sobre `usuarios`. Esa frontera es la razón de que esto
// sea una segunda app y no una pantalla más dentro de la de usuarios: un solo
// binario hablando con las dos APIs volvería a juntar en el cliente lo que la
// base separa a propósito (ver dashboard/README.md).
import { Platform } from 'react-native';

// --- Producción --------------------------------------------------------------
//
// La API PHP desplegada en Railway (servicio `dashboard-api`, distinto del
// servicio `api` con el que habla la app de usuarios: son dos backends contra
// la misma base con roles de PostgreSQL distintos).
//
// Es HTTPS, así que no necesita ninguna excepción de App Transport Security: la
// build de release sale sin permiso para HTTP en claro, que es como tiene que
// salir.
//
// No hace falta añadir nada a CORS_ORIGENES por esta app: una app nativa no
// manda cabecera Origin, y la API solo responde cabeceras CORS cuando el origen
// está en la lista blanca. En producción esa lista está vacía a propósito (vale
// `ninguno`); el día que se despliegue la web pública de registro, su dominio va
// ahí.
const URL_PRODUCCION = 'https://dashboard-api-production-c666.up.railway.app';

// --- Desarrollo --------------------------------------------------------------
//
// La API PHP se levanta con:
//   php -S localhost:8080 -t dashboard/api/public dashboard/api/public/index.php
const URL_SIMULADOR_IOS = 'http://localhost:8080';

// El emulador de Android llama 10.0.2.2 a la máquina host; con localhost
// apuntaría a la propia máquina virtual, donde no hay ninguna API.
const URL_EMULADOR_ANDROID = 'http://10.0.2.2:8080';

// Dispositivo físico: reemplaza por la IP LAN de tu Mac (`ipconfig getifaddr en0`).
const URL_DISPOSITIVO_FISICO = 'http://192.168.1.100:8080';

// __DEV__ es una global que inyecta Metro: `false` en cualquier build de
// release. Es el único interruptor entre producción y local, y no lo pone una
// persona — así ninguna build de release puede salir apuntando a localhost por
// haberse olvidado de cambiar una constante.
export const ES_PRODUCCION = !__DEV__;

// Este sí es manual: Metro no distingue simulador de dispositivo físico, los
// dos son desarrollo. Solo afecta a builds de debug.
const USAR_DISPOSITIVO_FISICO = false;

function urlDeDesarrollo() {
  if (USAR_DISPOSITIVO_FISICO) return URL_DISPOSITIVO_FISICO;
  return Platform.OS === 'android' ? URL_EMULADOR_ANDROID : URL_SIMULADOR_IOS;
}

export const API_BASE_URL = ES_PRODUCCION ? URL_PRODUCCION : urlDeDesarrollo();

// --- Enlaces legales ---------------------------------------------------------
//
// Los sirve la propia API PHP (`dashboard/api/src/Controllers/LegalController`),
// no un sitio web: no hay ninguno, el producto son dos apps. La API ya es un
// origen HTTPS con certificado válido, que es lo que Apple pide.
//
// Son documentos distintos de los que sirve el backend de Node para la app de
// usuarios: aquellos hablan de los datos de quien asiste a un plan, y estos de
// los del comercio.
//
// Se derivan de URL_PRODUCCION y no de API_BASE_URL a propósito: son las mismas
// dos páginas públicas en cualquier build. Una build de debug que enlazara a
// `localhost/privacidad` mostraría un enlace roto en el simulador.
export const URL_POLITICA_PRIVACIDAD = `${URL_PRODUCCION}/privacidad`;
export const URL_TERMINOS = `${URL_PRODUCCION}/terminos`;
