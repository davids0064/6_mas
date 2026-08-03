<?php
/**
 * Eventos del comercio y, cruzando la frontera, quiénes asisten.
 *
 * `eventos` es la tabla puente entre el mundo comercio y el mundo social. Es
 * el único lugar de la API donde el dashboard toca datos originados en la app,
 * y lo hace exclusivamente a través de la vista v_evento_asistentes: el rol
 * seis_dashboard no tiene permiso sobre `usuarios` ni sobre `grupo_miembros`,
 * así que aunque este código quisiera leer un email, el motor lo impediría.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class EventoController
{
    private const ESTADOS = ['propuesto', 'confirmado', 'en_curso', 'finalizado', 'cancelado'];

    private const CAMPOS =
        'e.id, e.titulo, e.descripcion, e.categoria, e.fecha_hora, e.capacidad,
         e.precio, e.estado, e.grupo_id, e.anfitrion_id, e.created_at';

    /** GET /eventos — admite ?estado= y ?desde= */
    public function listar(): void
    {
        $condiciones = ['e.comercio_id = :cid', 'e.deleted_at IS NULL'];
        $params = ['cid' => Auth::comercioId()];

        if ($estado = Request::query('estado')) {
            $condiciones[] = 'e.estado = :estado';
            $params['estado'] = $this->estadoValido($estado);
        }
        if ($desde = Request::query('desde')) {
            $condiciones[] = 'e.fecha_hora >= :desde';
            $params['desde'] = $desde;
        }

        $filas = Db::todos(
            'SELECT ' . self::CAMPOS . ', a.nombre AS anfitrion_nombre
             FROM eventos e
             LEFT JOIN anfitriones a ON a.id = e.anfitrion_id
             WHERE ' . implode(' AND ', $condiciones) . '
             ORDER BY e.fecha_hora',
            $params
        );

        Response::json(array_map([$this, 'normalizar'], $filas));
    }

    /** GET /eventos/{id} */
    public function ver(array $params): void
    {
        $evento = Db::uno(
            'SELECT ' . self::CAMPOS . ', a.nombre AS anfitrion_nombre
             FROM eventos e
             LEFT JOIN anfitriones a ON a.id = e.anfitrion_id
             WHERE e.id = :id AND e.comercio_id = :cid AND e.deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($evento === null) {
            Response::error('Evento no encontrado.', 404);
        }

        Response::json($this->normalizar($evento));
    }

    /**
     * GET /eventos/{id}/asistentes
     *
     * Lo único que el comercio puede saber de las personas que va a recibir:
     * nombre de pila e intereses, para preparar la mesa y la conversación.
     * Ni email, ni teléfono, ni edad, ni resultado del test de personalidad.
     */
    public function asistentes(array $params): void
    {
        $comercioId = Auth::comercioId();

        $evento = Db::uno(
            'SELECT id, grupo_id FROM eventos
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => $comercioId]
        );

        if ($evento === null) {
            Response::error('Evento no encontrado.', 404);
        }

        // Sin grupo asignado todavía no hay a quién mostrar: el evento se
        // publica antes de que el matching lo enlace a un grupo.
        if ($evento['grupo_id'] === null) {
            Response::json(['grupo_asignado' => false, 'asistentes' => []]);
        }

        // El filtro por comercio_id va también en la vista: defensa en
        // profundidad, aunque el evento ya se validó arriba.
        $asistentes = Db::todos(
            'SELECT nombre_pila, intereses FROM v_evento_asistentes
             WHERE evento_id = :id AND comercio_id = :cid
             ORDER BY nombre_pila',
            ['id' => $params['id'], 'cid' => $comercioId]
        );

        Response::json([
            'grupo_asignado' => true,
            'asistentes'     => array_map(static function (array $a): array {
                $a['intereses'] = \SeisMas\Core\Pg::aPhp($a['intereses']);
                return $a;
            }, $asistentes),
        ]);
    }

    /** POST /eventos */
    public function crear(): void
    {
        $comercioId  = Auth::comercioId();
        $anfitrionId = Request::requerido('anfitrion_id');

        // El anfitrión debe ser del propio comercio: sin esta comprobación se
        // podría crear un evento apuntando al anfitrión de otro negocio.
        $anfitrion = Db::uno(
            'SELECT 1 FROM anfitriones
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $anfitrionId, 'cid' => $comercioId]
        );
        if ($anfitrion === null) {
            Response::error('El anfitrión indicado no pertenece a este comercio.', 422);
        }

        $evento = Db::uno(
            'INSERT INTO eventos
                (comercio_id, anfitrion_id, titulo, descripcion, categoria,
                 fecha_hora, capacidad, precio)
             VALUES (:cid, :aid, :titulo, :descripcion, :categoria, :fecha, :capacidad, :precio)
             RETURNING id, titulo, descripcion, categoria, fecha_hora, capacidad,
                       precio, estado, grupo_id, anfitrion_id, created_at',
            [
                'cid'         => $comercioId,
                'aid'         => $anfitrionId,
                'titulo'      => Request::requerido('titulo'),
                'descripcion' => Request::campo('descripcion'),
                'categoria'   => Request::campo('categoria'),
                'fecha'       => Request::requerido('fecha_hora'),
                'capacidad'   => (int) Request::campo('capacidad', 6),
                'precio'      => $this->precioValido(Request::campo('precio', 0)),
            ]
        );

        Response::json($this->normalizar($evento), 201);
    }

    /** PUT /eventos/{id} */
    public function actualizar(array $params): void
    {
        $datos = Request::cuerpo();

        $evento = Db::uno(
            'UPDATE eventos SET
                titulo      = COALESCE(:titulo, titulo),
                descripcion = COALESCE(:descripcion, descripcion),
                categoria   = COALESCE(:categoria, categoria),
                fecha_hora  = COALESCE(:fecha, fecha_hora),
                capacidad   = COALESCE(:capacidad, capacidad),
                precio      = COALESCE(:precio, precio),
                estado      = COALESCE(:estado, estado)
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL
             RETURNING id, titulo, descripcion, categoria, fecha_hora, capacidad,
                       precio, estado, grupo_id, anfitrion_id, created_at',
            [
                'titulo'      => $datos['titulo']      ?? null,
                'descripcion' => $datos['descripcion'] ?? null,
                'categoria'   => $datos['categoria']   ?? null,
                'fecha'       => $datos['fecha_hora']  ?? null,
                'capacidad'   => isset($datos['capacidad']) ? (int) $datos['capacidad'] : null,
                'precio'      => isset($datos['precio']) ? $this->precioValido($datos['precio']) : null,
                'estado'      => isset($datos['estado']) ? $this->estadoValido($datos['estado']) : null,
                // grupo_id no se toca desde el dashboard: lo asigna el
                // matching del lado de la app. El comercio no elige a quién
                // recibe.
                'id'          => $params['id'],
                'cid'         => Auth::comercioId(),
            ]
        );

        if ($evento === null) {
            Response::error('Evento no encontrado.', 404);
        }

        Response::json($this->normalizar($evento));
    }

    /** DELETE /eventos/{id} — borrado lógico + cancelación */
    public function eliminar(array $params): void
    {
        $filas = Db::ejecutar(
            "UPDATE eventos SET deleted_at = now(), estado = 'cancelado'
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL",
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($filas === 0) {
            Response::error('Evento no encontrado.', 404);
        }

        Response::sinContenido();
    }

    // ------------------------------------------------------------------

    private function normalizar(array $fila): array
    {
        $fila['precio']    = (float) $fila['precio'];
        $fila['capacidad'] = (int) $fila['capacidad'];
        return $fila;
    }

    private function estadoValido(mixed $estado): string
    {
        $estado = (string) $estado;
        if (!in_array($estado, self::ESTADOS, true)) {
            Response::error('Estado inválido. Debe ser uno de: ' . implode(', ', self::ESTADOS) . '.', 422);
        }
        return $estado;
    }

    private function precioValido(mixed $precio): float
    {
        if (!is_numeric($precio) || (float) $precio < 0) {
            Response::error('El precio debe ser un número mayor o igual a cero.', 422);
        }
        return (float) $precio;
    }
}
