<?php
/**
 * Registro y login del comercio.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Jwt;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class AuthController
{
    /** Columnas que se pueden devolver: nunca password_hash. */
    private const CAMPOS_PUBLICOS =
        'id, nombre, nit, direccion, ciudad, categoria, telefono, email,
         descripcion, logo_url, sitio_web, horario, activo, created_at';

    /** POST /auth/registro */
    public function registro(): void
    {
        $nombre   = Request::requerido('nombre');
        $email    = strtolower(Request::requerido('email'));
        $password = Request::requerido('password');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('El correo no tiene un formato válido.', 422);
        }
        // 8 caracteres es el mínimo razonable; la fortaleza real se comunica en
        // el formulario de Angular, aquí solo se rechaza lo indefendible.
        if (strlen($password) < 8) {
            Response::error('La contraseña debe tener al menos 8 caracteres.', 422);
        }

        // Se consulta antes para poder dar un mensaje claro. La garantía real
        // sigue siendo el índice único ux_comercios_email_activo: entre esta
        // consulta y el INSERT podría colarse otro registro, y ahí el motor es
        // quien manda (ver el catch de abajo).
        $existente = Db::uno(
            'SELECT id FROM comercios WHERE LOWER(email) = :email AND deleted_at IS NULL',
            ['email' => $email]
        );
        if ($existente !== null) {
            Response::error('Ya existe un comercio registrado con ese correo.', 409);
        }

        try {
            $comercio = Db::uno(
                'INSERT INTO comercios (nombre, email, password_hash, nit, direccion, ciudad, categoria, telefono)
                 VALUES (:nombre, :email, :password_hash, :nit, :direccion, :ciudad, :categoria, :telefono)
                 RETURNING ' . self::CAMPOS_PUBLICOS,
                [
                    'nombre'        => $nombre,
                    'email'         => $email,
                    'password_hash' => Auth::hashPassword($password),
                    'nit'           => Request::campo('nit'),
                    'direccion'     => Request::campo('direccion'),
                    'ciudad'        => Request::campo('ciudad'),
                    'categoria'     => Request::campo('categoria'),
                    'telefono'      => Request::campo('telefono'),
                ]
            );
        } catch (\PDOException $e) {
            if ($e->getCode() === '23505') { // unique_violation
                Response::error('Ya existe un comercio registrado con ese correo.', 409);
            }
            throw $e;
        }

        // Se devuelve el token junto al alta para que Angular pueda entrar
        // directo al dashboard sin pedir login otra vez.
        Response::json([
            'token'    => Jwt::firmar(['comercio_id' => $comercio['id'], 'email' => $comercio['email']]),
            'comercio' => $comercio,
        ], 201);
    }

    /** POST /auth/login */
    public function login(): void
    {
        $email    = strtolower(Request::requerido('email'));
        $password = Request::requerido('password');

        $fila = Db::uno(
            'SELECT id, email, password_hash FROM comercios
             WHERE LOWER(email) = :email AND deleted_at IS NULL',
            ['email' => $email]
        );

        // Un solo mensaje para "no existe", "sin contraseña" y "contraseña
        // incorrecta": distinguirlos permitiría enumerar qué correos están
        // registrados.
        $valida = $fila !== null
            && !empty($fila['password_hash'])
            && Auth::verificarPassword($password, $fila['password_hash']);

        if (!$valida) {
            Response::error('Correo o contraseña incorrectos.', 401);
        }

        $comercio = Db::uno(
            'SELECT ' . self::CAMPOS_PUBLICOS . ' FROM comercios WHERE id = :id',
            ['id' => $fila['id']]
        );

        Response::json([
            'token'    => Jwt::firmar(['comercio_id' => $fila['id'], 'email' => $fila['email']]),
            'comercio' => $comercio,
        ]);
    }
}
