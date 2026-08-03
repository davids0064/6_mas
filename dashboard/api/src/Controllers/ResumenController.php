<?php
/**
 * Resumen de la pantalla de inicio del dashboard.
 *
 * Devuelve en UNA petición todo lo que necesita el home: contadores, próximos
 * eventos y qué falta por completar del perfil. Es el patrón que mantiene el
 * dashboard rápido aunque la base esté en otro servidor — una ida y vuelta de
 * red en lugar de seis.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Response;

class ResumenController
{
    /** GET /resumen */
    public function ver(): void
    {
        $cid = Auth::comercioId();

        // Un solo viaje a la base para los cuatro contadores: cada subconsulta
        // es un índice sobre comercio_id, así que sale barato.
        $contadores = Db::uno(
            "SELECT
                (SELECT count(*) FROM menus
                  WHERE comercio_id = :cid AND deleted_at IS NULL)                       AS menus_total,
                (SELECT count(*) FROM menus
                  WHERE comercio_id = :cid AND deleted_at IS NULL
                    AND estado = 'publicado')                                            AS menus_publicados,
                (SELECT count(*) FROM propuestas_bienvenida
                  WHERE comercio_id = :cid AND deleted_at IS NULL AND activa)            AS propuestas_activas,
                (SELECT count(*) FROM anfitriones
                  WHERE comercio_id = :cid AND deleted_at IS NULL)                       AS anfitriones_total,
                (SELECT count(*) FROM eventos
                  WHERE comercio_id = :cid AND deleted_at IS NULL
                    AND fecha_hora >= now() AND estado <> 'cancelado')                   AS eventos_proximos",
            ['cid' => $cid]
        );

        $proximos = Db::todos(
            "SELECT e.id, e.titulo, e.fecha_hora, e.estado, e.capacidad,
                    e.grupo_id IS NOT NULL AS tiene_grupo,
                    a.nombre AS anfitrion_nombre
             FROM eventos e
             LEFT JOIN anfitriones a ON a.id = e.anfitrion_id
             WHERE e.comercio_id = :cid AND e.deleted_at IS NULL
               AND e.fecha_hora >= now() AND e.estado <> 'cancelado'
             ORDER BY e.fecha_hora
             LIMIT 5",
            ['cid' => $cid]
        );

        $comercio = Db::uno(
            'SELECT nombre, direccion, ciudad, descripcion, logo_url, horario
             FROM comercios WHERE id = :cid AND deleted_at IS NULL',
            ['cid' => $cid]
        );

        Response::json([
            'comercio' => $comercio,
            'contadores' => array_map('intval', $contadores),
            'proximos_eventos' => $proximos,
            // El onboarding pendiente se calcula en el servidor y no en
            // Angular: si mañana se agrega un paso obligatorio, se cambia acá
            // y el frontend lo refleja sin recompilar.
            'pendientes' => $this->pendientes($comercio, $contadores),
        ]);
    }

    /**
     * Qué le falta al comercio para estar listo para recibir grupos.
     * @return array<int, array{clave:string, texto:string}>
     */
    private function pendientes(?array $comercio, array $contadores): array
    {
        $pendientes = [];

        if (empty($comercio['direccion']) || empty($comercio['ciudad'])) {
            $pendientes[] = [
                'clave' => 'direccion',
                'texto' => 'Agrega la dirección de tu comercio para que los grupos sepan dónde encontrarte.',
            ];
        }
        if (empty($comercio['descripcion'])) {
            $pendientes[] = [
                'clave' => 'descripcion',
                'texto' => 'Cuéntale a los grupos de qué se trata tu lugar.',
            ];
        }
        if ((int) $contadores['anfitriones_total'] === 0) {
            $pendientes[] = [
                'clave' => 'anfitrion',
                'texto' => 'Define quién va a recibir a los grupos.',
            ];
        }
        if ((int) $contadores['menus_publicados'] === 0) {
            $pendientes[] = [
                'clave' => 'menu',
                'texto' => 'Publica al menos un menú.',
            ];
        }
        if ((int) $contadores['propuestas_activas'] === 0) {
            $pendientes[] = [
                'clave' => 'propuesta',
                'texto' => 'Crea tu propuesta de bienvenida.',
            ];
        }

        return $pendientes;
    }
}
