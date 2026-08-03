<?php
/**
 * JWT HS256 implementado a mano.
 *
 * Son ~60 líneas y evitan arrastrar Composer a un proyecto que se despliega
 * copiando una carpeta. Lo único delicado es comparar la firma en tiempo
 * constante (hash_equals) y validar SIEMPRE el algoritmo declarado en la
 * cabecera: aceptar el `alg` del token sin verificarlo es la vulnerabilidad
 * clásica de JWT ("alg: none").
 */

declare(strict_types=1);

namespace SeisMas\Core;

use RuntimeException;

class Jwt
{
    private const ALGORITMO = 'HS256';

    public static function firmar(array $payload): string
    {
        $cfg = Config::get('jwt');
        $ahora = time();

        $payload = array_merge($payload, [
            'iss' => $cfg['emisor'],
            'iat' => $ahora,
            'exp' => $ahora + $cfg['duracion_s'],
        ]);

        $cabecera = self::base64UrlEncode(json_encode(['alg' => self::ALGORITMO, 'typ' => 'JWT']));
        $cuerpo   = self::base64UrlEncode(json_encode($payload, JSON_UNESCAPED_UNICODE));
        $firma    = self::base64UrlEncode(self::hmac("$cabecera.$cuerpo"));

        return "$cabecera.$cuerpo.$firma";
    }

    /**
     * Verifica firma y expiración. Devuelve el payload, o null si el token es
     * inválido por cualquier motivo — el llamador no necesita distinguir la
     * causa, y no conviene decírsela al cliente.
     */
    public static function verificar(string $token): ?array
    {
        $partes = explode('.', $token);
        if (count($partes) !== 3) {
            return null;
        }
        [$cabecera64, $cuerpo64, $firma64] = $partes;

        $cabecera = json_decode(self::base64UrlDecode($cabecera64), true);
        // Se exige HS256 explícitamente: nunca se confía en el `alg` del token
        // para elegir cómo verificarlo.
        if (!is_array($cabecera) || ($cabecera['alg'] ?? null) !== self::ALGORITMO) {
            return null;
        }

        $esperada = self::hmac("$cabecera64.$cuerpo64");
        if (!hash_equals($esperada, self::base64UrlDecode($firma64))) {
            return null;
        }

        $payload = json_decode(self::base64UrlDecode($cuerpo64), true);
        if (!is_array($payload)) {
            return null;
        }

        if (!isset($payload['exp']) || time() >= (int) $payload['exp']) {
            return null;
        }

        return $payload;
    }

    private static function hmac(string $mensaje): string
    {
        $secreto = Config::get('jwt')['secreto'] ?? null;
        if ($secreto === null || $secreto === '') {
            // Preferimos caerse a arrancar firmando con un secreto vacío o
            // adivinable: eso permitiría a cualquiera fabricar tokens válidos.
            throw new RuntimeException('JWT_SECRET no está configurado.');
        }
        return hash_hmac('sha256', $mensaje, $secreto, true);
    }

    private static function base64UrlEncode(string $datos): string
    {
        return rtrim(strtr(base64_encode($datos), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $datos): string
    {
        return base64_decode(strtr($datos, '-_', '+/')) ?: '';
    }
}
