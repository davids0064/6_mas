/**
 * Entorno de desarrollo local.
 *
 * La API corre con `php -S localhost:8080 -t dashboard/api/public dashboard/api/public/index.php`.
 * En producción angular.json reemplaza este archivo por environment.prod.ts,
 * así que mover la API a Railway o a un VPS es cambiar una URL y recompilar.
 */
export const environment = {
  produccion: false,
  apiUrl: 'http://localhost:8080',
};
