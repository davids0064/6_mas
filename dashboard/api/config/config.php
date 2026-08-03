<?php
/**
 * Configuración de la API del dashboard.
 *
 * Todo sale de variables de entorno para que el mismo código corra local, en
 * Railway y —el día que se mueva— en un VPS, cambiando solo valores. En local
 * las variables se leen de un archivo .env; en Railway y en cualquier PaaS
 * vienen inyectadas en el entorno del proceso, y ahí el .env no existe.
 */

declare(strict_types=1);

/**
 * Lector mínimo de .env. No usa Dotenv de Composer porque la API no tiene
 * dependencias a propósito: se despliega copiando la carpeta.
 */
function cargarEnv(string $ruta): void
{
    if (!is_readable($ruta)) {
        return; // En producción las variables ya vienen del entorno.
    }

    foreach (file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
        $linea = trim($linea);
        if ($linea === '' || str_starts_with($linea, '#')) {
            continue;
        }
        if (!str_contains($linea, '=')) {
            continue;
        }

        [$clave, $valor] = explode('=', $linea, 2);
        $clave = trim($clave);
        $valor = trim($valor);

        // Quita comillas envolventes si las hay: PASS="con espacios"
        if (strlen($valor) >= 2) {
            $primero = $valor[0];
            if (($primero === '"' || $primero === "'") && str_ends_with($valor, $primero)) {
                $valor = substr($valor, 1, -1);
            }
        }

        // El entorno real siempre gana sobre el .env: así un despliegue puede
        // sobrescribir un valor sin editar archivos.
        if (getenv($clave) === false) {
            putenv("$clave=$valor");
            $_ENV[$clave] = $valor;
        }
    }
}

function env(string $clave, ?string $porDefecto = null): ?string
{
    $valor = getenv($clave);
    return $valor === false || $valor === '' ? $porDefecto : $valor;
}

cargarEnv(dirname(__DIR__) . '/.env');

return [
    'db' => [
        'host'     => env('DB_HOST', '127.0.0.1'),
        'puerto'   => env('DB_PORT', '5432'),
        'nombre'   => env('DB_NAME', 'seis_mas'),
        'usuario'  => env('DB_USER', 'seis_dashboard'),
        'password' => env('DB_PASSWORD', ''),
        // Railway y los Postgres gestionados exigen TLS. En local no hay
        // certificado, por eso el valor por defecto es 'prefer': intenta
        // cifrar y si no puede sigue igual.
        'sslmode'  => env('DB_SSLMODE', 'prefer'),
    ],

    'jwt' => [
        // Sin valor por defecto a propósito: si falta, la API debe negarse a
        // arrancar en vez de firmar tokens con un secreto conocido.
        'secreto'    => env('JWT_SECRET'),
        // 8 horas: una jornada de trabajo del comercio sin volver a entrar.
        'duracion_s' => (int) env('JWT_TTL_SEGUNDOS', '28800'),
        'emisor'     => env('JWT_ISSUER', 'seis-mas-dashboard'),
    ],

    // Orígenes autorizados para CORS, separados por coma. Nunca '*': el
    // dashboard maneja datos de negocio y credenciales.
    'cors_origenes' => array_filter(array_map(
        'trim',
        explode(',', env('CORS_ORIGENES', 'http://localhost:4200'))
    )),

    // Con debug en true los errores del servidor incluyen el mensaje real.
    // En producción se responde genérico y el detalle va al log.
    'debug' => env('APP_DEBUG', 'false') === 'true',
];
