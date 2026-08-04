<?php
/**
 * Planes del comercio: la experiencia concreta que se le puede asignar a un
 * grupo de seis, atada a un interés del catálogo.
 *
 * Es la mitad de la oferta que consume la etapa 2 del matching
 * (backend/src/services/programacion.js). La otra mitad es la disponibilidad.
 * Sin planes cargados, un comercio no compite por ningún grupo: no es que
 * reciba menos, es que el algoritmo no lo ve.
 *
 * El `interes_id` es lo que hace competir al plan: el matching exige que al
 * menos la mitad del grupo comparta ese interés antes de mirar el tier. Por eso
 * se valida contra pa_intereses y no se acepta texto libre — un plan con un
 * interés inventado nunca se asignaría a nadie.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class PlanController
{
    private const CAMPOS =
        'p.id, p.interes_id, p.titulo, p.descripcion, p.duracion_min,
         p.precio, p.capacidad, p.activo, p.created_at, p.updated_at';

    /** Un grupo son seis personas: un plan que no recibe seis no es candidato. */
    private const CAPACIDAD_MINIMA = 6;

    /** GET /planes */
    public function listar(): void
    {
        $filas = Db::todos(
            'SELECT ' . self::CAMPOS . ', i.nombre AS interes_nombre, i.icono AS interes_icono
             FROM comercio_planes p
             JOIN pa_intereses i ON i.id = p.interes_id
             WHERE p.comercio_id = :cid AND p.deleted_at IS NULL
             ORDER BY p.activo DESC, p.created_at DESC',
            ['cid' => Auth::comercioId()]
        );

        Response::json(array_map([$this, 'normalizar'], $filas));
    }

    /** POST /planes */
    public function crear(): void
    {
        $plan = Db::uno(
            'INSERT INTO comercio_planes
                (comercio_id, interes_id, titulo, descripcion, duracion_min, precio, capacidad, activo)
             VALUES (:cid, :interes, :titulo, :descripcion, :duracion, :precio, :capacidad, :activo)
             RETURNING id',
            [
                'cid'         => Auth::comercioId(),
                'interes'     => $this->interesValido(Request::requerido('interes_id')),
                'titulo'      => Request::requerido('titulo'),
                'descripcion' => Request::campo('descripcion'),
                'duracion'    => $this->duracionValida(Request::campo('duracion_min', 120)),
                'precio'      => $this->precioValido(Request::campo('precio', 0)),
                'capacidad'   => $this->capacidadValida(Request::campo('capacidad', 6)),
                'activo'      => Request::campo('activo', true) ? 't' : 'f',
            ]
        );

        Response::json($this->verPorId($plan['id']), 201);
    }

    /** PUT /planes/{id} */
    public function actualizar(array $params): void
    {
        $datos = Request::cuerpo();

        $filas = Db::ejecutar(
            'UPDATE comercio_planes SET
                interes_id   = COALESCE(:interes, interes_id),
                titulo       = COALESCE(:titulo, titulo),
                descripcion  = COALESCE(:descripcion, descripcion),
                duracion_min = COALESCE(:duracion, duracion_min),
                precio       = COALESCE(:precio, precio),
                capacidad    = COALESCE(:capacidad, capacidad),
                activo       = COALESCE(:activo, activo),
                updated_at   = now()
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            [
                'interes'     => isset($datos['interes_id'])
                    ? $this->interesValido($datos['interes_id'])
                    : null,
                'titulo'      => $datos['titulo']      ?? null,
                'descripcion' => $datos['descripcion'] ?? null,
                'duracion'    => isset($datos['duracion_min'])
                    ? $this->duracionValida($datos['duracion_min'])
                    : null,
                'precio'      => isset($datos['precio'])
                    ? $this->precioValido($datos['precio'])
                    : null,
                'capacidad'   => isset($datos['capacidad'])
                    ? $this->capacidadValida($datos['capacidad'])
                    : null,
                'activo'      => array_key_exists('activo', $datos)
                    ? ($datos['activo'] ? 't' : 'f')
                    : null,
                'id'          => $params['id'],
                'cid'         => Auth::comercioId(),
            ]
        );

        if ($filas === 0) {
            Response::error('Plan no encontrado.', 404);
        }

        Response::json($this->verPorId($params['id']));
    }

    /**
     * DELETE /planes/{id} — borrado lógico.
     *
     * No se borra de verdad porque los eventos ya asignados apuntan a este
     * plan: perder la fila dejaría sin explicación a los grupos que ya tienen
     * reserva. Marcarlo borrado lo saca de la oferta futura sin tocar el
     * historial.
     */
    public function eliminar(array $params): void
    {
        $filas = Db::ejecutar(
            'UPDATE comercio_planes SET deleted_at = now(), activo = FALSE, updated_at = now()
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($filas === 0) {
            Response::error('Plan no encontrado.', 404);
        }

        Response::sinContenido();
    }

    // ------------------------------------------------------------------

    /**
     * Relee el plan con el nombre del interés incluido. La escritura devuelve
     * solo el id porque el RETURNING de un INSERT no puede traer el JOIN, y el
     * cliente necesita el nombre para pintarlo sin una segunda petición.
     */
    private function verPorId(string $id): array
    {
        $plan = Db::uno(
            'SELECT ' . self::CAMPOS . ', i.nombre AS interes_nombre, i.icono AS interes_icono
             FROM comercio_planes p
             JOIN pa_intereses i ON i.id = p.interes_id
             WHERE p.id = :id AND p.comercio_id = :cid AND p.deleted_at IS NULL',
            ['id' => $id, 'cid' => Auth::comercioId()]
        );

        if ($plan === null) {
            Response::error('Plan no encontrado.', 404);
        }

        return $this->normalizar($plan);
    }

    /** PDO devuelve NUMERIC e INT como string; Angular recibe números reales. */
    private function normalizar(array $fila): array
    {
        $fila['precio']       = (float) $fila['precio'];
        $fila['duracion_min'] = (int) $fila['duracion_min'];
        $fila['capacidad']    = (int) $fila['capacidad'];
        return $fila;
    }

    /**
     * El interés debe existir y estar activo en el catálogo.
     *
     * Se comprueba acá y no solo con la FK porque el mensaje importa: un 500
     * por violación de clave foránea no le dice al comercio que eligió una
     * categoría que ya no se ofrece.
     */
    private function interesValido(mixed $id): string
    {
        $existe = Db::uno(
            'SELECT 1 FROM pa_intereses WHERE id = :id AND activo',
            ['id' => (string) $id]
        );

        if ($existe === null) {
            Response::error('La categoría elegida no existe o ya no está disponible.', 422);
        }

        return (string) $id;
    }

    private function duracionValida(mixed $duracion): int
    {
        if (!is_numeric($duracion) || (int) $duracion <= 0) {
            Response::error('La duración debe ser un número de minutos mayor a cero.', 422);
        }
        return (int) $duracion;
    }

    private function precioValido(mixed $precio): float
    {
        if (!is_numeric($precio) || (float) $precio < 0) {
            Response::error('El precio debe ser un número mayor o igual a cero.', 422);
        }
        return (float) $precio;
    }

    private function capacidadValida(mixed $capacidad): int
    {
        if (!is_numeric($capacidad) || (int) $capacidad < self::CAPACIDAD_MINIMA) {
            Response::error(
                'La capacidad debe ser de al menos ' . self::CAPACIDAD_MINIMA .
                ' personas: los grupos de Seis Más siempre llegan completos.',
                422
            );
        }
        return (int) $capacidad;
    }
}
