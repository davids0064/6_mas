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
}
