<?php
/**
 * Lectura de la petición entrante: cuerpo JSON, cabeceras y parámetros.
 */

declare(strict_types=1);

namespace SeisMas\Core;

class Request
{
    private static ?array $cuerpo = null;

    /** Cuerpo JSON parseado. Se lee una sola vez: php://input no es rebobinable. */
    public static function cuerpo(): array
    {
        if (self::$cuerpo !== null) {
            return self::$cuerpo;
        }

        $crudo = file_get_contents('php://input');
        if ($crudo === false || trim($crudo) === '') {
            return self::$cuerpo = [];
        }

        $decodificado = json_decode($crudo, true);
        if (!is_array($decodificado)) {
            Response::error('El cuerpo de la petición debe ser un objeto JSON válido.', 400);
        }

        return self::$cuerpo = $decodificado;
    }

    /** Un campo del cuerpo, con valor por defecto si no viene. */
    public static function campo(string $nombre, mixed $porDefecto = null): mixed
    {
        return self::cuerpo()[$nombre] ?? $porDefecto;
    }

    /**
     * Campo de texto obligatorio. Corta la petición con 400 si falta o viene
     * vacío, para que los controladores no repitan la misma validación.
     */
    public static function requerido(string $nombre): string
    {
        $valor = self::campo($nombre);
        if (!is_scalar($valor) || trim((string) $valor) === '') {
            Response::error("El campo '$nombre' es obligatorio.", 422);
        }
        return trim((string) $valor);
    }

    public static function metodo(): string
    {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }

    /** Ruta sin querystring ni prefijo del front controller. */
    public static function ruta(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // Con `php -S` sirviendo desde public/, la ruta ya viene limpia. Detrás
        // de Apache en un subdirectorio (public_html/api) hay que quitar ese
        // prefijo para que el router vea siempre la misma ruta.
        $base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/');
        if ($base !== '' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }

        return '/' . trim($uri, '/');
    }

    public static function cabecera(string $nombre): ?string
    {
        $clave = 'HTTP_' . strtoupper(str_replace('-', '_', $nombre));
        if (isset($_SERVER[$clave])) {
            return $_SERVER[$clave];
        }

        // Algunos servidores (Apache con CGI) no pasan Authorization en
        // $_SERVER; getallheaders() sí la ve.
        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) {
                if (strcasecmp($k, $nombre) === 0) {
                    return $v;
                }
            }
        }

        return null;
    }

    /** Parámetro del querystring. */
    public static function query(string $nombre, ?string $porDefecto = null): ?string
    {
        $valor = $_GET[$nombre] ?? null;
        return $valor === null || $valor === '' ? $porDefecto : (string) $valor;
    }
}
