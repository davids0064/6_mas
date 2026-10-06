<?php
/**
 * La afiliación del comercio: qué plan tiene, cuánto cupo le queda y en qué se
 * le fue.
 *
 * Es solo lectura, y lo es a propósito. El cobro va por transferencia y lo
 * gestiona una persona, así que la app no tiene nada que escribir aquí: un
 * botón de "pagar" que no cobra o un "cambiar de plan" que no cambia nada
 * serían peores que no estar.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Response;

class AfiliacionController
{
    /** GET /afiliacion */
    public function ver(): void
    {
        $cid = Auth::comercioId();

        $actual = Db::uno(
            "SELECT c.suscripcion_id, c.grupos_mes, c.grupos_usados, c.grupos_disponibles,
                    c.inicio, c.fin, s.estado,
                    (c.fin - current_date) AS dias_restantes,
                    p.nombre AS plan, p.nivel AS nivel
               FROM v_cupo_comercio c
               JOIN comercio_suscripciones s ON s.id = c.suscripcion_id
               JOIN pa_planes_comercio p     ON p.id = s.plan_id
              WHERE c.comercio_id = :cid",
            ['cid' => $cid]
        );

        // En qué se fue el cupo. Es la pregunta que un comercio se hace cuando
        // ve "0 disponibles": no "cuántos", sino "cuáles". Se cuentan igual que
        // en v_cupo_comercio —por fecha de la cena, sin las canceladas— porque
        // si la lista no suma lo mismo que el contador, el contador deja de
        // creerse.
        $consumo = [];
        if ($actual) {
            $consumo = Db::todos(
                "SELECT e.id, e.titulo, e.fecha_hora, e.estado,
                        (e.fecha_hora <= now()) AS ya_ocurrio
                   FROM eventos e
                  WHERE e.comercio_id = :cid
                    AND e.grupo_id IS NOT NULL
                    AND e.deleted_at IS NULL
                    AND e.estado <> 'cancelado'
                    AND (e.fecha_hora AT TIME ZONE 'America/Bogota')::date
                        BETWEEN :inicio AND :fin
                  ORDER BY e.fecha_hora",
                ['cid' => $cid, 'inicio' => $actual['inicio'], 'fin' => $actual['fin']]
            );
        }

        // Los planes que existen, para que se vea qué da cada uno. Sin precio:
        // lo acuerda una persona, y publicar una tarifa que no está cerrada es
        // peor que no publicar ninguna.
        $planes = Db::todos(
            'SELECT nombre, nivel, grupos_mes, descripcion
               FROM pa_planes_comercio
              WHERE activo
              ORDER BY nivel'
        );

        // Los periodos anteriores: qué tuvo y hasta cuándo. Es lo que mira
        // alguien que quiere comprobar si le cuadra lo que pagó.
        $historial = Db::todos(
            "SELECT s.inicio, s.fin, s.grupos_mes, s.estado, p.nombre AS plan
               FROM comercio_suscripciones s
               JOIN pa_planes_comercio p ON p.id = s.plan_id
              WHERE s.comercio_id = :cid
              ORDER BY s.inicio DESC
              LIMIT 12",
            ['cid' => $cid]
        );

        Response::json([
            'actual' => $actual ? [
                'plan'               => $actual['plan'],
                'estado'             => $actual['estado'],
                'grupos_mes'         => (int) $actual['grupos_mes'],
                'grupos_usados'      => (int) $actual['grupos_usados'],
                'grupos_disponibles' => (int) $actual['grupos_disponibles'],
                'inicio'             => $actual['inicio'],
                'fin'                => $actual['fin'],
                'dias_restantes'     => (int) $actual['dias_restantes'],
            ] : null,
            'consumo'   => $consumo,
            'planes'    => array_map(static fn ($p) => [
                'nombre'     => $p['nombre'],
                'nivel'      => (int) $p['nivel'],
                'grupos_mes' => (int) $p['grupos_mes'],
                'descripcion' => $p['descripcion'],
            ], $planes),
            'historial' => $historial,
        ]);
    }
}
