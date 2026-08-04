<?php
/**
 * Catálogos paramétricos que el dashboard necesita leer.
 *
 * Por ahora solo intereses, que es lo que alimenta el selector de categoría al
 * crear un plan. El rol seis_dashboard tiene SELECT sobre pa_intereses (ver
 * db/migrations/001_dashboard_comercios.sql) precisamente para esto.
 *
 * Se sirve desde la API y no se copia en el frontend porque la lista es dato,
 * no código: agregar una categoría nueva es un INSERT, y el panel la muestra
 * sin recompilar ni desplegar.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Db;
use SeisMas\Core\Response;

class CatalogoController
{
    /** GET /intereses */
    public function intereses(): void
    {
        $filas = Db::todos(
            'SELECT id, nombre, icono FROM pa_intereses WHERE activo ORDER BY orden, nombre'
        );

        Response::json($filas);
    }
}
