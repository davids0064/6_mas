<?php
/**
 * Router mínimo.
 *
 * Soporta rutas con parámetros nombrados: '/menus/{id}/secciones'. Se recorre
 * la tabla de rutas en orden; con la treintena de rutas que tiene el dashboard
 * eso es irrelevante en rendimiento y mantiene el código legible.
 */

declare(strict_types=1);

namespace SeisMas\Core;

class Router
{
    /** @var array<int, array{metodo:string, patron:string, manejador:callable}> */
    private array $rutas = [];

    public function get(string $patron, callable $manejador): void
    {
        $this->agregar('GET', $patron, $manejador);
    }

    public function post(string $patron, callable $manejador): void
    {
        $this->agregar('POST', $patron, $manejador);
    }

    public function put(string $patron, callable $manejador): void
    {
        $this->agregar('PUT', $patron, $manejador);
    }

    public function delete(string $patron, callable $manejador): void
    {
        $this->agregar('DELETE', $patron, $manejador);
    }

    private function agregar(string $metodo, string $patron, callable $manejador): void
    {
        $this->rutas[] = compact('metodo', 'patron', 'manejador');
    }

    public function despachar(string $metodo, string $ruta): void
    {
        // Se distingue "ruta inexistente" (404) de "ruta existe pero con otro
        // método" (405), que es información útil para depurar el cliente.
        $rutaExiste = false;

        foreach ($this->rutas as $r) {
            $params = $this->coincide($r['patron'], $ruta);
            if ($params === null) {
                continue;
            }

            $rutaExiste = true;
            if ($r['metodo'] !== $metodo) {
                continue;
            }

            ($r['manejador'])($params);
            return;
        }

        if ($rutaExiste) {
            Response::error("Método $metodo no permitido para $ruta.", 405);
        }
        Response::error('Ruta no encontrada.', 404);
    }

    /**
     * Devuelve los parámetros capturados, o null si el patrón no coincide.
     * Un array vacío es coincidencia sin parámetros — de ahí que se distinga
     * explícitamente de null.
     */
    private function coincide(string $patron, string $ruta): ?array
    {
        $segPatron = explode('/', trim($patron, '/'));
        $segRuta   = explode('/', trim($ruta, '/'));

        if (count($segPatron) !== count($segRuta)) {
            return null;
        }

        $params = [];
        foreach ($segPatron as $i => $seg) {
            if (str_starts_with($seg, '{') && str_ends_with($seg, '}')) {
                $params[trim($seg, '{}')] = urldecode($segRuta[$i]);
                continue;
            }
            if ($seg !== $segRuta[$i]) {
                return null;
            }
        }

        return $params;
    }
}
