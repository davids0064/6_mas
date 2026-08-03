<?php
/**
 * Anfitriones: la persona que recibe a los grupos en el comercio.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class AnfitrionController
{
    /** GET /anfitriones */
    public function listar(): void
    {
        Response::json(Db::todos(
            'SELECT id, nombre, email, telefono, bio, foto_url, titular, created_at
             FROM anfitriones
             WHERE comercio_id = :cid AND deleted_at IS NULL
             ORDER BY titular DESC, nombre',
            ['cid' => Auth::comercioId()]
        ));
    }

    /** POST /anfitriones */
    public function crear(): void
    {
        $comercioId = Auth::comercioId();
        $nombre = Request::requerido('nombre');
        $email  = strtolower(Request::requerido('email'));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('El correo del anfitrión no tiene un formato válido.', 422);
        }

        $titular = (bool) Request::campo('titular', false);

        try {
            $anfitrion = Db::enTransaccion(function () use ($comercioId, $nombre, $email, $titular) {
                // Solo puede haber un titular por comercio (índice único
                // parcial): si este lo va a ser, se baja el anterior primero.
                if ($titular) {
                    Db::ejecutar(
                        'UPDATE anfitriones SET titular = FALSE
                         WHERE comercio_id = :cid AND titular AND deleted_at IS NULL',
                        ['cid' => $comercioId]
                    );
                }

                return Db::uno(
                    'INSERT INTO anfitriones (comercio_id, nombre, email, telefono, bio, foto_url, titular)
                     VALUES (:cid, :nombre, :email, :telefono, :bio, :foto_url, :titular)
                     RETURNING id, nombre, email, telefono, bio, foto_url, titular, created_at',
                    [
                        'cid'      => $comercioId,
                        'nombre'   => $nombre,
                        'email'    => $email,
                        'telefono' => Request::campo('telefono'),
                        'bio'      => Request::campo('bio'),
                        'foto_url' => Request::campo('foto_url'),
                        'titular'  => $titular ? 't' : 'f',
                    ]
                );
            });
        } catch (\PDOException $e) {
            if ($e->getCode() === '23505') {
                Response::error('Ya hay un anfitrión registrado con ese correo.', 409);
            }
            throw $e;
        }

        Response::json($anfitrion, 201);
    }

    /** PUT /anfitriones/{id} */
    public function actualizar(array $params): void
    {
        $comercioId = Auth::comercioId();
        $datos = Request::cuerpo();
        $titular = array_key_exists('titular', $datos) ? (bool) $datos['titular'] : null;

        $anfitrion = Db::enTransaccion(function () use ($comercioId, $params, $datos, $titular) {
            if ($titular === true) {
                Db::ejecutar(
                    'UPDATE anfitriones SET titular = FALSE
                     WHERE comercio_id = :cid AND titular AND id <> :id AND deleted_at IS NULL',
                    ['cid' => $comercioId, 'id' => $params['id']]
                );
            }

            // El AND comercio_id = :cid es lo que impide editar el anfitrión
            // de otro negocio pasando su id en la URL.
            return Db::uno(
                'UPDATE anfitriones SET
                    nombre   = COALESCE(:nombre, nombre),
                    email    = COALESCE(:email, email),
                    telefono = COALESCE(:telefono, telefono),
                    bio      = COALESCE(:bio, bio),
                    foto_url = COALESCE(:foto_url, foto_url),
                    titular  = COALESCE(:titular, titular)
                 WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL
                 RETURNING id, nombre, email, telefono, bio, foto_url, titular, created_at',
                [
                    'nombre'   => $datos['nombre']   ?? null,
                    'email'    => isset($datos['email']) ? strtolower((string) $datos['email']) : null,
                    'telefono' => $datos['telefono'] ?? null,
                    'bio'      => $datos['bio']      ?? null,
                    'foto_url' => $datos['foto_url'] ?? null,
                    'titular'  => $titular === null ? null : ($titular ? 't' : 'f'),
                    'id'       => $params['id'],
                    'cid'      => $comercioId,
                ]
            );
        });

        if ($anfitrion === null) {
            Response::error('Anfitrión no encontrado.', 404);
        }

        Response::json($anfitrion);
    }

    /** DELETE /anfitriones/{id} — borrado lógico */
    public function eliminar(array $params): void
    {
        // eventos.anfitrion_id es ON DELETE RESTRICT justamente para no perder
        // el rastro de quién atendió un evento; el borrado lógico respeta eso.
        $filas = Db::ejecutar(
            'UPDATE anfitriones SET deleted_at = now(), titular = FALSE
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($filas === 0) {
            Response::error('Anfitrión no encontrado.', 404);
        }

        Response::sinContenido();
    }
}
