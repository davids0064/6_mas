<?php
/**
 * Perfil del comercio autenticado.
 *
 * No hay endpoints /comercios/{id}: un comercio solo puede ver y editar el
 * suyo, y ese id sale del token. Así no existe ninguna ruta donde cambiar un
 * id en la URL dé acceso a otro negocio.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class ComercioController
{
    private const CAMPOS_PUBLICOS =
        'id, nombre, nit, direccion, ciudad, categoria, telefono, email,
         descripcion, logo_url, sitio_web, horario, activo, created_at, updated_at';

    /** GET /mi-comercio */
    public function ver(): void
    {
        $comercio = Db::uno(
            'SELECT ' . self::CAMPOS_PUBLICOS . '
             FROM comercios WHERE id = :id AND deleted_at IS NULL',
            ['id' => Auth::comercioId()]
        );

        if ($comercio === null) {
            Response::error('Comercio no encontrado.', 404);
        }

        Response::json($comercio);
    }

    /** PUT /mi-comercio */
    public function actualizar(): void
    {
        $datos = Request::cuerpo();

        // COALESCE con :campo permite envíos parciales: lo que no venga en el
        // cuerpo conserva su valor actual, sin construir el SQL dinámicamente.
        $comercio = Db::uno(
            'UPDATE comercios SET
                nombre      = COALESCE(:nombre, nombre),
                nit         = COALESCE(:nit, nit),
                direccion   = COALESCE(:direccion, direccion),
                ciudad      = COALESCE(:ciudad, ciudad),
                categoria   = COALESCE(:categoria, categoria),
                telefono    = COALESCE(:telefono, telefono),
                descripcion = COALESCE(:descripcion, descripcion),
                logo_url    = COALESCE(:logo_url, logo_url),
                sitio_web   = COALESCE(:sitio_web, sitio_web),
                horario     = COALESCE(:horario, horario)
             WHERE id = :id AND deleted_at IS NULL
             RETURNING ' . self::CAMPOS_PUBLICOS,
            [
                'nombre'      => $datos['nombre']      ?? null,
                'nit'         => $datos['nit']         ?? null,
                'direccion'   => $datos['direccion']   ?? null,
                'ciudad'      => $datos['ciudad']      ?? null,
                'categoria'   => $datos['categoria']   ?? null,
                'telefono'    => $datos['telefono']    ?? null,
                'descripcion' => $datos['descripcion'] ?? null,
                'logo_url'    => $datos['logo_url']    ?? null,
                'sitio_web'   => $datos['sitio_web']   ?? null,
                'horario'     => $datos['horario']     ?? null,
                // El email no se actualiza acá: es la credencial de acceso y
                // cambiarlo necesita su propio flujo con verificación.
                'id'          => Auth::comercioId(),
            ]
        );

        if ($comercio === null) {
            Response::error('Comercio no encontrado.', 404);
        }

        Response::json($comercio);
    }

    /**
     * DELETE /mi-comercio — el comercio da de baja su propia cuenta.
     *
     * Existe porque la App Store lo exige (guideline 5.1.1(v)): toda app que
     * deje crear una cuenta tiene que dejar borrarla desde dentro, y la app de
     * comercios permite registrarse. Mandar al dueño de un local a escribir un
     * correo de soporte para darse de baja es rechazo directo.
     *
     * Es soft delete, igual que en el resto del esquema: `deleted_at` saca al
     * comercio del login (el índice único de email es parcial sobre
     * deleted_at IS NULL, así que ese correo vuelve a quedar libre) y de las
     * consultas del matching. Los eventos ya ocurridos se conservan: son parte
     * del histórico de las personas que asistieron, y borrarlos falsearía las
     * valoraciones que esas personas dejaron.
     */
    public function eliminar(): void
    {
        $comercio = Db::uno(
            'UPDATE comercios SET deleted_at = now()
             WHERE id = :id AND deleted_at IS NULL
             RETURNING id',
            ['id' => Auth::comercioId()]
        );

        if ($comercio === null) {
            Response::error('Comercio no encontrado.', 404);
        }

        Response::sinContenido();
    }
}
