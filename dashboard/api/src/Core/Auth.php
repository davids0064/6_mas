<?php
/**
 * Autenticación del comercio.
 *
 * Regla central de seguridad del dashboard: el `comercio_id` con el que se
 * opera SIEMPRE sale del token firmado, nunca del cuerpo ni de la URL. Si un
 * comercio manda el id de otro en el body, se ignora. Por eso los controladores
 * llaman a Auth::comercioId() en vez de leer un parámetro.
 */

declare(strict_types=1);

namespace SeisMas\Core;

class Auth
{
    private static ?array $payload = null;

    /**
     * Exige un token válido. Corta con 401 si falta o no verifica.
     * Devuelve el payload del token.
     */
    public static function exigir(): array
    {
        if (self::$payload !== null) {
            return self::$payload;
        }

        $cabecera = Request::cabecera('Authorization');
        if ($cabecera === null || !preg_match('/^Bearer\s+(.+)$/i', $cabecera, $m)) {
            Response::error('Falta el token de autenticación.', 401);
        }

        $payload = Jwt::verificar(trim($m[1]));
        if ($payload === null) {
            Response::error('Sesión inválida o expirada.', 401);
        }

        return self::$payload = $payload;
    }

    /** Id del comercio autenticado, tomado del token firmado. */
    public static function comercioId(): string
    {
        $payload = self::exigir();
        if (empty($payload['comercio_id'])) {
            Response::error('Sesión inválida o expirada.', 401);
        }
        return (string) $payload['comercio_id'];
    }

    /**
     * Hash de contraseña. bcrypt para ser compatible con los hashes que ya
     * genera el backend Node (bcrypt, 10 rondas).
     */
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
    }

    /**
     * Verifica una contraseña contra su hash.
     *
     * Node (librería bcrypt) genera hashes con prefijo $2b$ y PHP genera $2y$.
     * Las dos variantes son el mismo algoritmo — $2b$ solo corrigió un
     * desbordamiento con contraseñas de más de 255 bytes — pero password_verify
     * puede no reconocer el prefijo ajeno según la versión. Normalizarlo deja
     * que un comercio creado desde cualquiera de los dos backends entre en el
     * dashboard.
     */
    public static function verificarPassword(string $password, string $hash): bool
    {
        if (str_starts_with($hash, '$2b$')) {
            $hash = '$2y$' . substr($hash, 4);
        }
        return password_verify($password, $hash);
    }
}
