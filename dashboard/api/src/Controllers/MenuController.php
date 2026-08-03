<?php
/**
 * Menús del comercio: menú → secciones → ítems.
 *
 * Nota sobre pertenencia: secciones e ítems no guardan comercio_id, lo heredan
 * por la cadena de FKs. Cada operación sobre ellos sube por esa cadena hasta
 * menus.comercio_id y lo compara contra el token, de modo que conocer el UUID
 * de una sección ajena no alcanza para tocarla.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class MenuController
{
    private const ESTADOS = ['borrador', 'publicado', 'archivado'];

    /** GET /menus */
    public function listar(): void
    {
        // Los conteos salen en subconsultas escalares en vez de traer el árbol
        // completo: el listado solo necesita el resumen, y así una petición
        // basta para pintar toda la pantalla.
        Response::json(Db::todos(
            "SELECT m.id, m.nombre, m.descripcion, m.estado, m.orden, m.created_at, m.updated_at,
                    (SELECT count(*) FROM menu_secciones s WHERE s.menu_id = m.id) AS total_secciones,
                    (SELECT count(*) FROM menu_secciones s
                      JOIN menu_items i ON i.seccion_id = s.id
                     WHERE s.menu_id = m.id) AS total_items
             FROM menus m
             WHERE m.comercio_id = :cid AND m.deleted_at IS NULL
             ORDER BY m.orden, m.created_at",
            ['cid' => Auth::comercioId()]
        ));
    }

    /** GET /menus/{id} — el árbol completo del menú */
    public function ver(array $params): void
    {
        $menu = Db::uno(
            'SELECT id, nombre, descripcion, estado, orden, created_at, updated_at
             FROM menus WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($menu === null) {
            Response::error('Menú no encontrado.', 404);
        }

        $secciones = Db::todos(
            'SELECT id, nombre, descripcion, orden FROM menu_secciones
             WHERE menu_id = :mid ORDER BY orden, nombre',
            ['mid' => $menu['id']]
        );

        // Todos los ítems del menú en una sola consulta y luego se agrupan en
        // PHP: evita una consulta por sección (N+1), que con la base en otro
        // servidor sería una ida y vuelta de red por cada una.
        $items = Db::todos(
            'SELECT i.id, i.seccion_id, i.nombre, i.descripcion, i.precio, i.disponible,
                    i.imagen_url, i.orden
             FROM menu_items i
             JOIN menu_secciones s ON s.id = i.seccion_id
             WHERE s.menu_id = :mid
             ORDER BY i.orden, i.nombre',
            ['mid' => $menu['id']]
        );

        $porSeccion = [];
        foreach ($items as $item) {
            $seccionId = $item['seccion_id'];
            unset($item['seccion_id']);
            $item['precio'] = (float) $item['precio'];
            $porSeccion[$seccionId][] = $item;
        }

        foreach ($secciones as &$seccion) {
            $seccion['items'] = $porSeccion[$seccion['id']] ?? [];
        }
        unset($seccion);

        $menu['secciones'] = $secciones;
        Response::json($menu);
    }

    /** POST /menus */
    public function crear(): void
    {
        $menu = Db::uno(
            'INSERT INTO menus (comercio_id, nombre, descripcion, estado, orden)
             VALUES (:cid, :nombre, :descripcion, :estado, :orden)
             RETURNING id, nombre, descripcion, estado, orden, created_at',
            [
                'cid'         => Auth::comercioId(),
                'nombre'      => Request::requerido('nombre'),
                'descripcion' => Request::campo('descripcion'),
                'estado'      => $this->estadoValido(Request::campo('estado', 'borrador')),
                'orden'       => (int) Request::campo('orden', 0),
            ]
        );

        Response::json($menu, 201);
    }

    /** PUT /menus/{id} */
    public function actualizar(array $params): void
    {
        $datos = Request::cuerpo();

        $menu = Db::uno(
            'UPDATE menus SET
                nombre      = COALESCE(:nombre, nombre),
                descripcion = COALESCE(:descripcion, descripcion),
                estado      = COALESCE(:estado, estado),
                orden       = COALESCE(:orden, orden)
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL
             RETURNING id, nombre, descripcion, estado, orden, updated_at',
            [
                'nombre'      => $datos['nombre']      ?? null,
                'descripcion' => $datos['descripcion'] ?? null,
                'estado'      => isset($datos['estado']) ? $this->estadoValido($datos['estado']) : null,
                'orden'       => isset($datos['orden']) ? (int) $datos['orden'] : null,
                'id'          => $params['id'],
                'cid'         => Auth::comercioId(),
            ]
        );

        if ($menu === null) {
            Response::error('Menú no encontrado.', 404);
        }

        Response::json($menu);
    }

    /** DELETE /menus/{id} — borrado lógico */
    public function eliminar(array $params): void
    {
        $filas = Db::ejecutar(
            'UPDATE menus SET deleted_at = now()
             WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($filas === 0) {
            Response::error('Menú no encontrado.', 404);
        }

        Response::sinContenido();
    }

    // ------------------------------------------------------------------
    // Secciones
    // ------------------------------------------------------------------

    /** POST /menus/{id}/secciones */
    public function crearSeccion(array $params): void
    {
        $this->exigirMenuPropio($params['id']);

        Response::json(Db::uno(
            'INSERT INTO menu_secciones (menu_id, nombre, descripcion, orden)
             VALUES (:mid, :nombre, :descripcion, :orden)
             RETURNING id, nombre, descripcion, orden',
            [
                'mid'         => $params['id'],
                'nombre'      => Request::requerido('nombre'),
                'descripcion' => Request::campo('descripcion'),
                'orden'       => (int) Request::campo('orden', 0),
            ]
        ), 201);
    }

    /** PUT /secciones/{id} */
    public function actualizarSeccion(array $params): void
    {
        $this->exigirSeccionPropia($params['id']);
        $datos = Request::cuerpo();

        Response::json(Db::uno(
            'UPDATE menu_secciones SET
                nombre      = COALESCE(:nombre, nombre),
                descripcion = COALESCE(:descripcion, descripcion),
                orden       = COALESCE(:orden, orden)
             WHERE id = :id
             RETURNING id, nombre, descripcion, orden',
            [
                'nombre'      => $datos['nombre']      ?? null,
                'descripcion' => $datos['descripcion'] ?? null,
                'orden'       => isset($datos['orden']) ? (int) $datos['orden'] : null,
                'id'          => $params['id'],
            ]
        ));
    }

    /** DELETE /secciones/{id} — borrado real: arrastra sus ítems por CASCADE */
    public function eliminarSeccion(array $params): void
    {
        $this->exigirSeccionPropia($params['id']);
        Db::ejecutar('DELETE FROM menu_secciones WHERE id = :id', ['id' => $params['id']]);
        Response::sinContenido();
    }

    // ------------------------------------------------------------------
    // Ítems
    // ------------------------------------------------------------------

    /** POST /secciones/{id}/items */
    public function crearItem(array $params): void
    {
        $this->exigirSeccionPropia($params['id']);

        $item = Db::uno(
            'INSERT INTO menu_items (seccion_id, nombre, descripcion, precio, disponible, imagen_url, orden)
             VALUES (:sid, :nombre, :descripcion, :precio, :disponible, :imagen_url, :orden)
             RETURNING id, nombre, descripcion, precio, disponible, imagen_url, orden',
            [
                'sid'         => $params['id'],
                'nombre'      => Request::requerido('nombre'),
                'descripcion' => Request::campo('descripcion'),
                'precio'      => $this->precioValido(Request::campo('precio', 0)),
                'disponible'  => Request::campo('disponible', true) ? 't' : 'f',
                'imagen_url'  => Request::campo('imagen_url'),
                'orden'       => (int) Request::campo('orden', 0),
            ]
        );

        $item['precio'] = (float) $item['precio'];
        Response::json($item, 201);
    }

    /** PUT /items/{id} */
    public function actualizarItem(array $params): void
    {
        $this->exigirItemPropio($params['id']);
        $datos = Request::cuerpo();

        $item = Db::uno(
            'UPDATE menu_items SET
                nombre      = COALESCE(:nombre, nombre),
                descripcion = COALESCE(:descripcion, descripcion),
                precio      = COALESCE(:precio, precio),
                disponible  = COALESCE(:disponible, disponible),
                imagen_url  = COALESCE(:imagen_url, imagen_url),
                orden       = COALESCE(:orden, orden)
             WHERE id = :id
             RETURNING id, nombre, descripcion, precio, disponible, imagen_url, orden',
            [
                'nombre'      => $datos['nombre']      ?? null,
                'descripcion' => $datos['descripcion'] ?? null,
                'precio'      => isset($datos['precio']) ? $this->precioValido($datos['precio']) : null,
                'disponible'  => array_key_exists('disponible', $datos)
                    ? ($datos['disponible'] ? 't' : 'f')
                    : null,
                'imagen_url'  => $datos['imagen_url'] ?? null,
                'orden'       => isset($datos['orden']) ? (int) $datos['orden'] : null,
                'id'          => $params['id'],
            ]
        );

        $item['precio'] = (float) $item['precio'];
        Response::json($item);
    }

    /** DELETE /items/{id} */
    public function eliminarItem(array $params): void
    {
        $this->exigirItemPropio($params['id']);
        Db::ejecutar('DELETE FROM menu_items WHERE id = :id', ['id' => $params['id']]);
        Response::sinContenido();
    }

    // ------------------------------------------------------------------
    // Verificación de pertenencia
    // ------------------------------------------------------------------

    private function exigirMenuPropio(string $menuId): void
    {
        $existe = Db::uno(
            'SELECT 1 FROM menus WHERE id = :id AND comercio_id = :cid AND deleted_at IS NULL',
            ['id' => $menuId, 'cid' => Auth::comercioId()]
        );
        if ($existe === null) {
            Response::error('Menú no encontrado.', 404);
        }
    }

    private function exigirSeccionPropia(string $seccionId): void
    {
        $existe = Db::uno(
            'SELECT 1 FROM menu_secciones s
              JOIN menus m ON m.id = s.menu_id
             WHERE s.id = :id AND m.comercio_id = :cid AND m.deleted_at IS NULL',
            ['id' => $seccionId, 'cid' => Auth::comercioId()]
        );
        if ($existe === null) {
            Response::error('Sección no encontrada.', 404);
        }
    }

    private function exigirItemPropio(string $itemId): void
    {
        $existe = Db::uno(
            'SELECT 1 FROM menu_items i
              JOIN menu_secciones s ON s.id = i.seccion_id
              JOIN menus m ON m.id = s.menu_id
             WHERE i.id = :id AND m.comercio_id = :cid AND m.deleted_at IS NULL',
            ['id' => $itemId, 'cid' => Auth::comercioId()]
        );
        if ($existe === null) {
            Response::error('Ítem no encontrado.', 404);
        }
    }

    /** Se valida en la API además del CHECK del motor, para dar un 422 claro. */
    private function estadoValido(mixed $estado): string
    {
        $estado = (string) $estado;
        if (!in_array($estado, self::ESTADOS, true)) {
            Response::error("Estado inválido. Debe ser uno de: " . implode(', ', self::ESTADOS) . '.', 422);
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
