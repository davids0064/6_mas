<?php
/**
 * Acceso a PostgreSQL con PDO.
 *
 * Sin ORM, igual que el backend Node: las consultas del dashboard son simples
 * y una capa de abstracción no se justifica todavía. Lo que sí es innegociable
 * son las sentencias preparadas — nunca se concatena entrada del usuario en
 * SQL.
 */

declare(strict_types=1);

namespace SeisMas\Core;

use PDO;
use PDOException;
use RuntimeException;

class Db
{
    private static ?PDO $conexion = null;

    /**
     * Conexión perezosa y única por request. PHP cierra el proceso al final de
     * cada petición, así que no hay pool que mantener; abrir una sola vez por
     * request es lo correcto.
     */
    public static function conexion(): PDO
    {
        if (self::$conexion !== null) {
            return self::$conexion;
        }

        $cfg = Config::get('db');

        $dsn = sprintf(
            'pgsql:host=%s;port=%s;dbname=%s;sslmode=%s',
            $cfg['host'],
            $cfg['puerto'],
            $cfg['nombre'],
            $cfg['sslmode']
        );

        try {
            self::$conexion = new PDO($dsn, $cfg['usuario'], $cfg['password'], [
                // Los errores de SQL deben ser excepciones, no valores de
                // retorno que se puedan ignorar por accidente.
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // Sentencias preparadas reales del servidor, no emuladas: con
                // emulación PDO interpola los parámetros en el cliente, que es
                // justo lo que queremos evitar.
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            // El mensaje de PDO incluye host y usuario; no debe salir al
            // cliente. Se registra y se responde genérico.
            error_log('Fallo de conexión a PostgreSQL: ' . $e->getMessage());
            throw new RuntimeException('No se pudo conectar a la base de datos.');
        }

        return self::$conexion;
    }

    /** Ejecuta una consulta preparada y devuelve todas las filas. */
    public static function todos(string $sql, array $params = []): array
    {
        $stmt = self::conexion()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Ejecuta una consulta preparada y devuelve la primera fila o null. */
    public static function uno(string $sql, array $params = []): ?array
    {
        $stmt = self::conexion()->prepare($sql);
        $stmt->execute($params);
        $fila = $stmt->fetch();
        return $fila === false ? null : $fila;
    }

    /** Ejecuta una sentencia de escritura y devuelve las filas afectadas. */
    public static function ejecutar(string $sql, array $params = []): int
    {
        $stmt = self::conexion()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /** Envuelve un callable en una transacción, con rollback ante cualquier error. */
    public static function enTransaccion(callable $fn): mixed
    {
        $pdo = self::conexion();
        $pdo->beginTransaction();
        try {
            $resultado = $fn($pdo);
            $pdo->commit();
            return $resultado;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
