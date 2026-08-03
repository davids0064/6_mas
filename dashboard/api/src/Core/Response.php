<?php
/**
 * Respuestas JSON. Toda la API responde JSON, incluidos los errores: así el
 * cliente Angular tiene un solo formato que interpretar.
 */

declare(strict_types=1);

namespace SeisMas\Core;

class Response
{
    public static function json(mixed $datos, int $estado = 200): void
    {
        http_response_code($estado);
        header('Content-Type: application/json; charset=utf-8');
        // UNESCAPED_UNICODE para que los acentos y emojis del catálogo de
        // intereses viajen legibles en vez de como \uXXXX.
        echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $mensaje, int $estado = 400, array $extra = []): void
    {
        self::json(array_merge(['error' => $mensaje], $extra), $estado);
    }

    public static function sinContenido(): void
    {
        http_response_code(204);
        exit;
    }
}
