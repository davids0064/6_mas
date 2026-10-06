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
                    AND fecha_hora >= now() AND estado <> 'cancelado')                   AS eventos_proximos,
                (SELECT count(*) FROM comercio_planes
                  WHERE comercio_id = :cid AND deleted_at IS NULL AND activo)            AS planes_activos,
                (SELECT count(*) FROM comercio_disponibilidad
                  WHERE comercio_id = :cid AND activo)                                   AS franjas_activas",
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

        // Se consulta una vez y se usa dos: en la respuesta y para calcular los
        // pendientes. Llamarla dos veces serían dos viajes a la base para el
        // mismo dato.
        $afiliacion = $this->afiliacion($cid);

        Response::json([
            'comercio' => $comercio,
            'contadores' => array_map('intval', $contadores),
            'afiliacion' => $afiliacion,
            'proximos_eventos' => $proximos,
            // El onboarding pendiente se calcula en el servidor y no en
            // Angular: si mañana se agrega un paso obligatorio, se cambia acá
            // y el frontend lo refleja sin recompilar.
            'pendientes' => $this->pendientes($comercio, $contadores, $afiliacion),
        ]);
    }

    /** "hoy" / "mañana" / "en N días", que es como lo diría una persona. */
    private function enDias(int $dias): string
    {
        if ($dias <= 0) {
            return 'hoy';
        }
        if ($dias === 1) {
            return 'mañana';
        }
        return sprintf('en %d días', $dias);
    }

    /**
     * La afiliación: qué plan tiene, cuánto cupo le queda y hasta cuándo.
     *
     * Es lo que decide si Seis Más le manda grupos, así que tiene que estar en
     * la primera pantalla y no escondido en un ajuste. Un comercio que deja de
     * recibir grupos sin entender por qué no escribe para preguntar: se va.
     *
     * Devuelve null cuando no hay suscripción vigente, y la app lo trata como
     * el aviso más importante de la pantalla. No se inventa un estado
     * "sin plan" con cupo 0 porque son cosas distintas: una es no haber
     * contratado nunca y otra es habérsele acabado el periodo.
     *
     * @return array<string, mixed>|null
     */
    private function afiliacion(string $cid): ?array
    {
        $fila = Db::uno(
            "SELECT c.grupos_mes, c.grupos_usados, c.grupos_disponibles,
                    c.estado, c.inicio, c.fin,
                    p.nombre AS plan,
                    (c.fin - current_date) AS dias_restantes
               FROM v_cupo_comercio c
               JOIN comercio_suscripciones s ON s.id = c.suscripcion_id
               JOIN pa_planes_comercio p     ON p.id = s.plan_id
              WHERE c.comercio_id = :cid",
            ['cid' => $cid]
        );

        if (!$fila) {
            return null;
        }

        return [
            'plan'               => $fila['plan'],
            'estado'             => $fila['estado'],
            'grupos_mes'         => (int) $fila['grupos_mes'],
            'grupos_usados'      => (int) $fila['grupos_usados'],
            'grupos_disponibles' => (int) $fila['grupos_disponibles'],
            'inicio'             => $fila['inicio'],
            'fin'                => $fila['fin'],
            'dias_restantes'     => (int) $fila['dias_restantes'],
        ];
    }

    /**
     * Qué le falta al comercio para estar listo para recibir grupos.
     * @return array<int, array{clave:string, texto:string}>
     */
    private function pendientes(?array $comercio, array $contadores, ?array $afiliacion): array
    {
        $pendientes = [];

        // La afiliación va por delante de todo lo demás: sin cupo no se recibe
        // ningún grupo, por muy completo que esté el perfil. Tener la oferta
        // lista y no saber que la suscripción venció es el peor sitio donde
        // dejar a alguien.
        if ($afiliacion === null) {
            $pendientes[] = [
                'clave' => 'afiliacion',
                'texto' => 'Tu afiliación no está vigente: no estás recibiendo grupos. Escríbenos para activarla.',
            ];
        } elseif ($afiliacion['grupos_disponibles'] === 0) {
            $pendientes[] = [
                'clave' => 'cupo',
                // Singular y plural a mano: "los 1 grupos" y "en 1 días" se leen
                // como un error del sistema, y esta frase aparece justo cuando
                // el comercio ya está molesto porque dejó de recibir gente.
                'texto' => sprintf(
                    'Ya recibiste %s de tu plan %s en este periodo. Tu cupo se renueva %s.',
                    $afiliacion['grupos_mes'] === 1
                        ? 'el grupo'
                        : sprintf('los %d grupos', $afiliacion['grupos_mes']),
                    $afiliacion['plan'],
                    $this->enDias(max($afiliacion['dias_restantes'], 0))
                ),
            ];
        } elseif ($afiliacion['dias_restantes'] <= 7) {
            $pendientes[] = [
                'clave' => 'renovacion',
                'texto' => sprintf(
                    'Tu afiliación vence %s. Renuévala para seguir recibiendo grupos.',
                    $this->enDias(max($afiliacion['dias_restantes'], 0))
                ),
            ];
        }

        // La oferta va después porque es la segunda condición dura: sin un plan
        // activo y una franja activa el comercio no compite por ningún grupo,
        // por muy completo que tenga el resto del perfil. Los demás pendientes
        // mejoran la experiencia; estos determinan si existe.
        if ((int) $contadores['planes_activos'] === 0) {
            $pendientes[] = [
                'clave' => 'plan',
                'texto' => 'Crea un plan: es lo que Seis Más le ofrece a un grupo.',
            ];
        }
        if ((int) $contadores['franjas_activas'] === 0) {
            $pendientes[] = [
                'clave' => 'disponibilidad',
                'texto' => 'Di en qué horarios puedes recibir grupos.',
            ];
        }

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
