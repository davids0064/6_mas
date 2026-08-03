<?php
/**
 * Conversión entre arreglos de PHP y arreglos de PostgreSQL (TEXT[]).
 *
 * PDO no mapea los arreglos nativos de Postgres: al leer devuelve el literal
 * '{"a","b"}' como string, y al escribir espera ese mismo formato. Se usa en
 * `propuestas_bienvenida.incluye`.
 */

declare(strict_types=1);

namespace SeisMas\Core;

class Pg
{
    /** PHP ['a', 'b'] → literal '{"a","b"}' para pasar como parámetro. */
    public static function arreglo(array $valores): string
    {
        $escapados = array_map(static function ($v): string {
            // Se escapan backslash y comilla; el resto va entre comillas, que
            // es lo que hace seguro cualquier contenido (comas incluidas).
            $texto = str_replace(['\\', '"'], ['\\\\', '\\"'], (string) $v);
            return '"' . $texto . '"';
        }, array_values($valores));

        return '{' . implode(',', $escapados) . '}';
    }

    /** Literal '{"a","b"}' devuelto por Postgres → PHP ['a', 'b']. */
    public static function aPhp(?string $literal): array
    {
        if ($literal === null || $literal === '' || $literal === '{}') {
            return [];
        }

        $interior = substr($literal, 1, -1); // quita las llaves
        $resultado = [];
        $actual = '';
        $enComillas = false;
        $escapando = false;

        for ($i = 0, $n = strlen($interior); $i < $n; $i++) {
            $c = $interior[$i];

            if ($escapando) {
                $actual .= $c;
                $escapando = false;
                continue;
            }
            if ($c === '\\') {
                $escapando = true;
                continue;
            }
            if ($c === '"') {
                $enComillas = !$enComillas;
                continue;
            }
            if ($c === ',' && !$enComillas) {
                $resultado[] = $actual;
                $actual = '';
                continue;
            }
            $actual .= $c;
        }

        if ($actual !== '') {
            $resultado[] = $actual;
        }

        return $resultado;
    }
}
