<?php
/**
 * Acceso de solo lectura a la configuración cargada desde config/config.php.
 */

declare(strict_types=1);

namespace SeisMas\Core;

use RuntimeException;

class Config
{
    private static ?array $valores = null;

    public static function cargar(array $valores): void
    {
        self::$valores = $valores;
    }

    public static function get(string $clave, mixed $porDefecto = null): mixed
    {
        if (self::$valores === null) {
            throw new RuntimeException('La configuración no fue cargada.');
        }
        return self::$valores[$clave] ?? $porDefecto;
    }
}
