<?php
/**
 * Front controller de la API del dashboard.
 *
 * Todas las peticiones entran por aquí (ver .htaccess). Local se levanta con:
 *   php -S localhost:8080 -t dashboard/api/public
 */

declare(strict_types=1);

use SeisMas\Controllers\AnfitrionController;
use SeisMas\Controllers\AuthController;
use SeisMas\Controllers\CatalogoController;
use SeisMas\Controllers\ComercioController;
use SeisMas\Controllers\DisponibilidadController;
use SeisMas\Controllers\EventoController;
use SeisMas\Controllers\LegalController;
use SeisMas\Controllers\MenuController;
use SeisMas\Controllers\PlanController;
use SeisMas\Controllers\PropuestaController;
use SeisMas\Controllers\ResumenController;
use SeisMas\Core\Auth;
use SeisMas\Core\Config;
use SeisMas\Core\Request;
use SeisMas\Core\Response;
use SeisMas\Core\Router;

$raiz = dirname(__DIR__);

/**
 * Autoloader PSR-4 sobre src/. Son cinco líneas y evitan Composer, que es lo
 * que permite desplegar la API copiando la carpeta.
 */
spl_autoload_register(static function (string $clase) use ($raiz): void {
    $prefijo = 'SeisMas\\';
    if (!str_starts_with($clase, $prefijo)) {
        return;
    }
    $ruta = $raiz . '/src/' . str_replace('\\', '/', substr($clase, strlen($prefijo))) . '.php';
    if (is_file($ruta)) {
        require $ruta;
    }
});

Config::cargar(require $raiz . '/config/config.php');

// ---------------------------------------------------------------------------
// Errores: nunca deben salir como HTML ni filtrar rutas del servidor.
// ---------------------------------------------------------------------------
set_error_handler(static function (int $nivel, string $mensaje, string $archivo, int $linea): bool {
    // Convierte warnings/notices en excepciones para que no pasen inadvertidos
    // y no se mezclen con el JSON de la respuesta.
    if ((error_reporting() & $nivel) === 0) {
        return false;
    }
    throw new ErrorException($mensaje, 0, $nivel, $archivo, $linea);
});

set_exception_handler(static function (Throwable $e): void {
    error_log(sprintf('[dashboard-api] %s: %s en %s:%d', $e::class, $e->getMessage(), $e->getFile(), $e->getLine()));
    $debug = Config::get('debug', false);
    Response::error(
        $debug ? $e->getMessage() : 'Ocurrió un error en el servidor.',
        500,
        $debug ? ['tipo' => $e::class] : []
    );
});

// ---------------------------------------------------------------------------
// CORS. El origen se compara contra la lista blanca y se refleja tal cual;
// nunca se responde '*' porque la API sirve datos de negocio autenticados.
// ---------------------------------------------------------------------------
$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origen !== '' && in_array($origen, Config::get('cors_origenes', []), true)) {
    header("Access-Control-Allow-Origin: $origen");
    // Le dice a las cachés intermedias que la respuesta depende del origen.
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    // El navegador cachea el preflight 24h: sin esto, cada petición con
    // Authorization pagaría un viaje extra a Railway.
    header('Access-Control-Max-Age: 86400');
}

if (Request::metodo() === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
$router = new Router();

$auth      = new AuthController();
$comercio  = new ComercioController();
$menu      = new MenuController();
$propuesta = new PropuestaController();
$anfitrion = new AnfitrionController();
$evento    = new EventoController();
$resumen   = new ResumenController();
$plan      = new PlanController();
$franja    = new DisponibilidadController();
$catalogo  = new CatalogoController();
$legal     = new LegalController();

// Sondeo de salud: sin autenticación, para que el hosting o Railway puedan
// verificar que el proceso responde.
$router->get('/health', static fn () => Response::json(['status' => 'ok']));

// --- Públicas ---
$router->post('/auth/registro', static fn () => $auth->registro());
$router->post('/auth/login',    static fn () => $auth->login());

// Documentos legales. Públicos y sin token a propósito: Apple los abre desde
// App Store Connect, sin sesión y sin haber instalado la app. Devuelven HTML,
// no JSON, y son los únicos de esta API que lo hacen.
$router->get('/privacidad',        static fn () => $legal->privacidad());
$router->get('/terminos',          static fn () => $legal->terminos());
$router->get('/legal/estilos.css', static fn () => $legal->estilos());

// --- Protegidas ---
// Auth::exigir() corta con 401 antes de tocar la base. Se llama en cada
// manejador en vez de un middleware global para que las rutas públicas de
// arriba no dependan de una lista de excepciones que se pueda desincronizar.
$protegida = static fn (callable $accion): callable
    => static function (array $params) use ($accion) {
        Auth::exigir();
        return $accion($params);
    };

$router->get('/resumen',     $protegida(static fn () => $resumen->ver()));
$router->get('/mi-comercio', $protegida(static fn () => $comercio->ver()));
$router->put('/mi-comercio', $protegida(static fn () => $comercio->actualizar()));
// Baja de la cuenta del propio comercio. Exigida por la App Store para poder
// publicar la app de comercios (guideline 5.1.1(v)).
$router->delete('/mi-comercio', $protegida(static fn () => $comercio->eliminar()));

$router->get('/menus',         $protegida(static fn () => $menu->listar()));
$router->post('/menus',        $protegida(static fn () => $menu->crear()));
$router->get('/menus/{id}',    $protegida(static fn (array $p) => $menu->ver($p)));
$router->put('/menus/{id}',    $protegida(static fn (array $p) => $menu->actualizar($p)));
$router->delete('/menus/{id}', $protegida(static fn (array $p) => $menu->eliminar($p)));

$router->post('/menus/{id}/secciones', $protegida(static fn (array $p) => $menu->crearSeccion($p)));
$router->put('/secciones/{id}',        $protegida(static fn (array $p) => $menu->actualizarSeccion($p)));
$router->delete('/secciones/{id}',     $protegida(static fn (array $p) => $menu->eliminarSeccion($p)));

$router->post('/secciones/{id}/items', $protegida(static fn (array $p) => $menu->crearItem($p)));
$router->put('/items/{id}',            $protegida(static fn (array $p) => $menu->actualizarItem($p)));
$router->delete('/items/{id}',         $protegida(static fn (array $p) => $menu->eliminarItem($p)));

$router->get('/propuestas',         $protegida(static fn () => $propuesta->listar()));
$router->post('/propuestas',        $protegida(static fn () => $propuesta->crear()));
$router->get('/propuestas/{id}',    $protegida(static fn (array $p) => $propuesta->ver($p)));
$router->put('/propuestas/{id}',    $protegida(static fn (array $p) => $propuesta->actualizar($p)));
$router->delete('/propuestas/{id}', $protegida(static fn (array $p) => $propuesta->eliminar($p)));

$router->get('/anfitriones',         $protegida(static fn () => $anfitrion->listar()));
$router->post('/anfitriones',        $protegida(static fn () => $anfitrion->crear()));
$router->put('/anfitriones/{id}',    $protegida(static fn (array $p) => $anfitrion->actualizar($p)));
$router->delete('/anfitriones/{id}', $protegida(static fn (array $p) => $anfitrion->eliminar($p)));

// --- Oferta: lo que hace competir al comercio por un grupo ---
// Los planes dicen QUÉ ofrece y la disponibilidad CUÁNDO. El matching necesita
// las dos cosas: con planes pero sin franjas (o al revés) el comercio sigue
// siendo invisible para el algoritmo.
$router->get('/intereses', $protegida(static fn () => $catalogo->intereses()));

$router->get('/planes',         $protegida(static fn () => $plan->listar()));
$router->post('/planes',        $protegida(static fn () => $plan->crear()));
$router->put('/planes/{id}',    $protegida(static fn (array $p) => $plan->actualizar($p)));
$router->delete('/planes/{id}', $protegida(static fn (array $p) => $plan->eliminar($p)));

$router->get('/disponibilidad',         $protegida(static fn () => $franja->listar()));
$router->post('/disponibilidad',        $protegida(static fn () => $franja->crear()));
$router->put('/disponibilidad/{id}',    $protegida(static fn (array $p) => $franja->actualizar($p)));
$router->delete('/disponibilidad/{id}', $protegida(static fn (array $p) => $franja->eliminar($p)));

$router->get('/eventos',                  $protegida(static fn () => $evento->listar()));
$router->post('/eventos',                 $protegida(static fn () => $evento->crear()));
$router->get('/eventos/{id}',             $protegida(static fn (array $p) => $evento->ver($p)));
$router->put('/eventos/{id}',             $protegida(static fn (array $p) => $evento->actualizar($p)));
$router->delete('/eventos/{id}',          $protegida(static fn (array $p) => $evento->eliminar($p)));
$router->get('/eventos/{id}/asistentes',  $protegida(static fn (array $p) => $evento->asistentes($p)));

$router->despachar(Request::metodo(), Request::ruta());
