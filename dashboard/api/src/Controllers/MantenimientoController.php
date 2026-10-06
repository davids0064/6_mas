<?php
/**
 * Tareas de mantenimiento del sistema. No pertenecen a ningún comercio, así
 * que van detrás de la clave de administración y no del token de sesión.
 *
 * Están pensadas para que las llame un programador de tareas (el cron de
 * Railway, un servicio externo, o una persona desde la terminal). Todas son
 * idempotentes: llamarlas de más no hace daño, y dejar de llamarlas tampoco
 * rompe nada — ver la cabecera de la migración 009.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Response;

class MantenimientoController
{
    /**
     * POST /admin/vencer-suscripciones
     *
     * Marca como vencidas las suscripciones cuyo periodo ya pasó. Es orden, no
     * corrección: v_cupo_comercio ya ignora los periodos fuera de fecha, así
     * que un comercio con la suscripción caducada deja de recibir grupos
     * aunque esto no se ejecute nunca.
     *
     * Devuelve también cuántas quedan por vencer según las fechas, que debería
     * ser 0 justo después. Si no lo es, algo está escribiendo estados a mano.
     */
    public function vencerSuscripciones(): void
    {
        Auth::exigirAdmin();

        $fila = Db::uno('SELECT vencer_suscripciones() AS marcadas');

        $pendientes = Db::uno(
            'SELECT count(*) AS n FROM v_suscripcion_estado WHERE pendiente_de_vencer'
        );

        Response::json([
            'marcadas'   => (int) $fila['marcadas'],
            'pendientes' => (int) $pendientes['n'],
            'ejecutado'  => date('c'),
        ]);
    }

    /**
     * GET /admin/suscripciones
     *
     * Qué comercios están pagando, cuáles están a punto de vencer y cuáles ya
     * vencieron. Es lo que hay que mirar para saber a quién llamar.
     */
    public function suscripciones(): void
    {
        Auth::exigirAdmin();

        Response::json(Db::todos(
            "SELECT s.comercio_id, c.nombre AS comercio, p.nombre AS plan,
                    s.estado, s.estado_efectivo, s.inicio, s.fin,
                    s.dias_restantes, s.grupos_mes
               FROM v_suscripcion_estado s
               JOIN comercios c             ON c.id = s.comercio_id
               JOIN pa_planes_comercio p    ON p.id = s.plan_id
              WHERE c.deleted_at IS NULL
                AND s.estado_efectivo IN ('vigente', 'futura')
              ORDER BY s.dias_restantes"
        ));
    }
}
