<?php
/**
 * Propuestas de bienvenida: la experiencia con la que el comercio recibe a un
 * grupo de seis.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Pg;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class PropuestaController
{
    private const CAMPOS =
        'id, titulo, descripcion, incluye, precio_persona, duracion_min,
         vigente_desde, vigente_hasta, activa, created_at, updated_at';

    /** GET /propuestas */
    public function listar(): void
    {
        $filas = Db::todos(
            'SELECT ' . self::CAMPOS . '
             FROM propuestas_bienvenida
             WHERE comercio_id = :cid AND deleted_at IS NULL
             ORDER BY activa DESC, created_at DESC',
            ['cid' => Auth::comercioId()]
        );

        Response::json(array_map([$this, 'normalizar'], $filas));
    }

    /** GET /propuestas/{id} */
    public function ver(array $params): void
    {
        $propuesta = Db::uno(
            'SELECT ' . self::CAMPOS . '
             FROM propuestas_bienvenida
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($propuesta === null) {
            Response::error('Propuesta no encontrada.', 404);
        }

        Response::json($this->normalizar($propuesta));
    }

    /** POST /propuestas */
    public function crear(): void
    {
        $propuesta = Db::uno(
            'INSERT INTO propuestas_bienvenida
                (comercio_id, titulo, descripcion, incluye, precio_persona,
                 duracion_min, vigente_desde, vigente_hasta, activa)
             VALUES (:cid, :titulo, :descripcion, :incluye, :precio, :duracion,
                     :desde, :hasta, :activa)
             RETURNING ' . self::CAMPOS,
            [
                'cid'         => Auth::comercioId(),
                'titulo'      => Request::requerido('titulo'),
                'descripcion' => Request::campo('descripcion'),
                'incluye'     => Pg::arreglo($this->incluyeValido(Request::campo('incluye', []))),
                'precio'      => $this->precioValido(Request::campo('precio_persona', 0)),
                'duracion'    => $this->duracionValida(Request::campo('duracion_min')),
                'desde'       => Request::campo('vigente_desde'),
                'hasta'       => Request::campo('vigente_hasta'),
                'activa'      => Request::campo('activa', true) ? 't' : 'f',
            ]
        );

        Response::json($this->normalizar($propuesta), 201);
    }

    /** PUT /propuestas/{id} */
    public function actualizar(array $params): void
    {
        $datos = Request::cuerpo();

        $propuesta = Db::uno(
            'UPDATE propuestas_bienvenida SET
                titulo         = COALESCE(:titulo, titulo),
                descripcion    = COALESCE(:descripcion, descripcion),
                incluye        = COALESCE(:incluye, incluye),
                precio_persona = COALESCE(:precio, precio_persona),
                duracion_min   = COALESCE(:duracion, duracion_min),
                vigente_desde  = COALESCE(:desde, vigente_desde),
                vigente_hasta  = COALESCE(:hasta, vigente_hasta),
                activa         = COALESCE(:activa, activa)
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL
             RETURNING ' . self::CAMPOS,
            [
                'titulo'      => $datos['titulo']      ?? null,
                'descripcion' => $datos['descripcion'] ?? null,
                'incluye'     => isset($datos['incluye'])
                    ? Pg::arreglo($this->incluyeValido($datos['incluye']))
                    : null,
                'precio'      => isset($datos['precio_persona'])
                    ? $this->precioValido($datos['precio_persona'])
                    : null,
                'duracion'    => isset($datos['duracion_min'])
                    ? $this->duracionValida($datos['duracion_min'])
                    : null,
                'desde'       => $datos['vigente_desde'] ?? null,
                'hasta'       => $datos['vigente_hasta'] ?? null,
                'activa'      => array_key_exists('activa', $datos)
                    ? ($datos['activa'] ? 't' : 'f')
                    : null,
                'id'          => $params['id'],
                'cid'         => Auth::comercioId(),
            ]
        );

        if ($propuesta === null) {
            Response::error('Propuesta no encontrada.', 404);
        }

        Response::json($this->normalizar($propuesta));
    }

    /** DELETE /propuestas/{id} — borrado lógico */
    public function eliminar(array $params): void
    {
        $filas = Db::ejecutar(
            'UPDATE propuestas_bienvenida SET deleted_at = now(), activa = FALSE
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($filas === 0) {
            Response::error('Propuesta no encontrada.', 404);
        }

        Response::sinContenido();
    }

    // ------------------------------------------------------------------

    /**
     * PDO devuelve NUMERIC como string y TEXT[] como literal de Postgres.
     * Se normaliza acá para que Angular reciba tipos de JSON reales y no tenga
     * que parsear nada.
     */
    private function normalizar(array $fila): array
    {
        $fila['incluye']        = Pg::aPhp($fila['incluye']);
        $fila['precio_persona'] = (float) $fila['precio_persona'];
        $fila['duracion_min']   = $fila['duracion_min'] === null ? null : (int) $fila['duracion_min'];
        return $fila;
    }

    private function incluyeValido(mixed $incluye): array
    {
        if (!is_array($incluye)) {
            Response::error("El campo 'incluye' debe ser una lista de textos.", 422);
        }
        // Se descartan entradas vacías: en el formulario es fácil dejar una
        // línea en blanco y no aporta nada guardarla.
        return array_values(array_filter(
            array_map(static fn ($v) => trim((string) $v), $incluye),
            static fn (string $v) => $v !== ''
        ));
    }

    private function precioValido(mixed $precio): float
    {
        if (!is_numeric($precio) || (float) $precio < 0) {
            Response::error('El precio por persona debe ser un número mayor o igual a cero.', 422);
        }
        return (float) $precio;
    }

    private function duracionValida(mixed $duracion): ?int
    {
        if ($duracion === null || $duracion === '') {
            return null;
        }
        if (!is_numeric($duracion) || (int) $duracion <= 0) {
            Response::error('La duración debe ser un número de minutos mayor a cero.', 422);
        }
        return (int) $duracion;
    }
}
