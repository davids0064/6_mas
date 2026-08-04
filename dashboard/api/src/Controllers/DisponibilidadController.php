<?php
/**
 * Disponibilidad del comercio: las franjas recurrentes por día de la semana en
 * las que puede recibir grupos, y cuántos caben en cada una.
 *
 * Es la otra mitad de la oferta que consume la etapa 2 del matching. La franja
 * es recurrente ("los jueves de 19:00 a 22:00") y el evento es la reserva
 * concreta: el algoritmo materializa la fecha y cuenta el cupo consumido sobre
 * `eventos`. Una tabla de reservas aparte sería un segundo lugar donde la
 * verdad se puede desincronizar.
 *
 * Para que una franja sirva de algo tiene que caber un plan entero dentro: el
 * matching descarta la franja si el plan no termina antes de hora_fin.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

use SeisMas\Core\Auth;
use SeisMas\Core\Db;
use SeisMas\Core\Request;
use SeisMas\Core\Response;

class DisponibilidadController
{
    private const CAMPOS =
        'id, dia_semana, hora_inicio, hora_fin, grupos_max, activo, created_at, updated_at';

    /** Coincide con EXTRACT(DOW) de Postgres: 0 = domingo. */
    private const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    /** GET /disponibilidad */
    public function listar(): void
    {
        $filas = Db::todos(
            'SELECT ' . self::CAMPOS . '
             FROM comercio_disponibilidad
             WHERE comercio_id = :cid
             ORDER BY dia_semana, hora_inicio',
            ['cid' => Auth::comercioId()]
        );

        Response::json(array_map([$this, 'normalizar'], $filas));
    }

    /** POST /disponibilidad */
    public function crear(): void
    {
        $dia    = $this->diaValido(Request::campo('dia_semana'));
        $inicio = $this->horaValida(Request::requerido('hora_inicio'), 'hora_inicio');
        $fin    = $this->horaValida(Request::requerido('hora_fin'), 'hora_fin');

        $this->validarRango($inicio, $fin);
        $this->validarSinSolape($dia, $inicio, $fin, null);

        $franja = Db::uno(
            'INSERT INTO comercio_disponibilidad
                (comercio_id, dia_semana, hora_inicio, hora_fin, grupos_max, activo)
             VALUES (:cid, :dia, :inicio, :fin, :max, :activo)
             RETURNING ' . self::CAMPOS,
            [
                'cid'    => Auth::comercioId(),
                'dia'    => $dia,
                'inicio' => $inicio,
                'fin'    => $fin,
                'max'    => $this->gruposMaxValido(Request::campo('grupos_max', 1)),
                'activo' => Request::campo('activo', true) ? 't' : 'f',
            ]
        );

        Response::json($this->normalizar($franja), 201);
    }

    /** PUT /disponibilidad/{id} */
    public function actualizar(array $params): void
    {
        $actual = Db::uno(
            'SELECT ' . self::CAMPOS . '
             FROM comercio_disponibilidad
             WHERE id = :id AND comercio_id = :cid',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($actual === null) {
            Response::error('Franja no encontrada.', 404);
        }

        $datos = Request::cuerpo();

        // Se resuelven los tres valores contra el estado actual antes de
        // validar: cambiar solo la hora de fin tiene que comprobarse contra el
        // día y la hora de inicio que ya tenía, no contra nada.
        $dia    = array_key_exists('dia_semana', $datos)
            ? $this->diaValido($datos['dia_semana'])
            : (int) $actual['dia_semana'];
        $inicio = isset($datos['hora_inicio'])
            ? $this->horaValida($datos['hora_inicio'], 'hora_inicio')
            : substr($actual['hora_inicio'], 0, 5);
        $fin    = isset($datos['hora_fin'])
            ? $this->horaValida($datos['hora_fin'], 'hora_fin')
            : substr($actual['hora_fin'], 0, 5);

        $this->validarRango($inicio, $fin);
        $this->validarSinSolape($dia, $inicio, $fin, $params['id']);

        $franja = Db::uno(
            'UPDATE comercio_disponibilidad SET
                dia_semana  = :dia,
                hora_inicio = :inicio,
                hora_fin    = :fin,
                grupos_max  = COALESCE(:max, grupos_max),
                activo      = COALESCE(:activo, activo),
                updated_at  = now()
             WHERE id = :id AND comercio_id = :cid
             RETURNING ' . self::CAMPOS,
            [
                'dia'    => $dia,
                'inicio' => $inicio,
                'fin'    => $fin,
                'max'    => isset($datos['grupos_max'])
                    ? $this->gruposMaxValido($datos['grupos_max'])
                    : null,
                'activo' => array_key_exists('activo', $datos)
                    ? ($datos['activo'] ? 't' : 'f')
                    : null,
                'id'     => $params['id'],
                'cid'    => Auth::comercioId(),
            ]
        );

        Response::json($this->normalizar($franja));
    }

    /**
     * DELETE /disponibilidad/{id} — borrado real.
     *
     * A diferencia de los planes, acá sí se borra la fila: los eventos ya
     * reservados guardan su propia fecha y hora, así que no dependen de que la
     * franja siga existiendo. Quitar el jueves no cancela lo que ya se agendó
     * para el jueves.
     */
    public function eliminar(array $params): void
    {
        $filas = Db::ejecutar(
            'DELETE FROM comercio_disponibilidad WHERE id = :id AND comercio_id = :cid',
            ['id' => $params['id'], 'cid' => Auth::comercioId()]
        );

        if ($filas === 0) {
            Response::error('Franja no encontrada.', 404);
        }

        Response::sinContenido();
    }

    // ------------------------------------------------------------------

    /** Postgres devuelve TIME como 'HH:MM:SS'; al formulario le basta 'HH:MM'. */
    private function normalizar(array $fila): array
    {
        $fila['dia_semana']  = (int) $fila['dia_semana'];
        $fila['grupos_max']  = (int) $fila['grupos_max'];
        $fila['hora_inicio'] = substr($fila['hora_inicio'], 0, 5);
        $fila['hora_fin']    = substr($fila['hora_fin'], 0, 5);
        $fila['dia_nombre']  = self::DIAS[$fila['dia_semana']];
        return $fila;
    }

    private function diaValido(mixed $dia): int
    {
        if (!is_numeric($dia) || (int) $dia < 0 || (int) $dia > 6) {
            Response::error('El día de la semana debe estar entre 0 (domingo) y 6 (sábado).', 422);
        }
        return (int) $dia;
    }

    private function horaValida(string $hora, string $campo): string
    {
        if (preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $hora) !== 1) {
            Response::error("El campo '$campo' debe tener el formato HH:MM.", 422);
        }
        return $hora;
    }

    private function validarRango(string $inicio, string $fin): void
    {
        // La base tiene el CHECK (hora_fin > hora_inicio), pero llegar hasta
        // allá devuelve un 500 con el nombre de la constraint. Acá el comercio
        // lee por qué no se guardó.
        if ($fin <= $inicio) {
            Response::error('La hora de cierre debe ser posterior a la de apertura.', 422);
        }
    }

    /**
     * Dos franjas del mismo día no pueden solaparse.
     *
     * La base solo impide repetir la hora de inicio exacta
     * (UNIQUE comercio_id, dia_semana, hora_inicio), así que "jueves 19-22" y
     * "jueves 20-23" pasarían. El problema no es estético: el matching cuenta
     * el cupo por franja, y con dos franjas solapadas el mismo comercio podría
     * recibir dos grupos a las 20:30 creyendo que cada uno ocupa un lugar
     * distinto. El cupo dejaría de significar lo que dice.
     */
    private function validarSinSolape(int $dia, string $inicio, string $fin, ?string $excluirId): void
    {
        $sql =
            'SELECT hora_inicio, hora_fin
             FROM comercio_disponibilidad
             WHERE comercio_id = :cid
               AND dia_semana = :dia
               AND hora_inicio < CAST(:fin AS time)
               AND hora_fin    > CAST(:inicio AS time)';

        $params = [
            'cid'    => Auth::comercioId(),
            'dia'    => $dia,
            'inicio' => $inicio,
            'fin'    => $fin,
        ];

        // Al editar, la propia franja siempre se solapa consigo misma.
        if ($excluirId !== null) {
            $sql .= ' AND id <> :excluir';
            $params['excluir'] = $excluirId;
        }

        $choque = Db::uno($sql, $params);

        if ($choque !== null) {
            Response::error(sprintf(
                'Ya tienes una franja el %s de %s a %s y se cruza con esta.',
                self::DIAS[$dia],
                substr($choque['hora_inicio'], 0, 5),
                substr($choque['hora_fin'], 0, 5)
            ), 409);
        }
    }

    private function gruposMaxValido(mixed $max): int
    {
        if (!is_numeric($max) || (int) $max < 1) {
            Response::error('Debes poder recibir al menos un grupo en la franja.', 422);
        }
        return (int) $max;
    }
}
