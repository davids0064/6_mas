/**
 * Entorno de producción.
 *
 * Reemplaza a environment.ts en el build de producción (ver fileReplacements
 * en angular.json). Apuntar a la URL pública de la API en Railway; el mismo
 * valor debe estar en CORS_ORIGENES del lado de la API, pero al revés: allá
 * va el dominio donde vive este frontend.
 */
export const environment = {
  produccion: true,
  apiUrl: 'https://TU-API.up.railway.app',
};
