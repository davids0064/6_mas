<?php
/**
 * Política de privacidad y términos de uso de la app de comercios.
 *
 * Apple exige una política de privacidad accesible por URL pública, y la vuelve
 * a pedir en App Store Connect, donde tiene que ser exactamente la misma que
 * enlaza la app. Las sirve esta API y no un sitio web porque no hay ninguno: el
 * producto son dos apps, y esta API ya es un origen HTTPS desplegado con
 * certificado válido, que es justo lo que Apple pide.
 *
 * Son documentos propios y no los mismos que sirve el backend de Node. Aquel
 * describe qué se hace con los datos de las personas que asisten a un plan;
 * este, qué se hace con los del comercio. Compartirlos sería mentir en los dos
 * sentidos a la vez.
 *
 * Es el único controlador que devuelve HTML en vez de JSON.
 */

declare(strict_types=1);

namespace SeisMas\Controllers;

class LegalController
{
    private const DIR = __DIR__ . '/../legal';

    /**
     * Fecha de la última revisión del TEXTO, no de la última vez que se sirvió
     * la página. Se toca a mano al editar los HTML: un documento legal que dice
     * "actualizado hoy" cada día que alguien lo abre no informa de nada.
     */
    private const FECHA_ACTUALIZACION = '9 de septiembre de 2026';

    public function privacidad(): void
    {
        $this->servirHtml('privacidad.html');
    }

    public function terminos(): void
    {
        $this->servirHtml('terminos.html');
    }

    public function estilos(): void
    {
        header('Content-Type: text/css; charset=utf-8');
        header('Cache-Control: public, max-age=3600');
        echo file_get_contents(self::DIR . '/_estilos.css');
        exit;
    }

    private function servirHtml(string $archivo): void
    {
        // Estas dos rutas son las únicas de la API que devuelven HTML, así que
        // llevan su propia CSP, y es la más restrictiva que el documento
        // admite: sin scripts, sin recursos externos, y sin poder ser embebido
        // en un iframe ajeno.
        header('Content-Type: text/html; charset=utf-8');
        header(
            "Content-Security-Policy: default-src 'none'; style-src 'self'; "
            . "img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        );
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: public, max-age=3600');
        echo $this->render($archivo);
        exit;
    }

    private function render(string $archivo): string
    {
        $html = file_get_contents(self::DIR . '/' . $archivo);

        // La dirección de contacto va por variable de entorno y no escrita en
        // el repo: así se puede cambiar sin desplegar código y no queda un
        // correo personal fijado en el historial de git.
        $email = trim((string) getenv('EMAIL_CONTACTO'));

        $html = str_replace('__FECHA__', self::FECHA_ACTUALIZACION, $html);

        // Sin variable configurada no se inventa una dirección: se sustituye el
        // enlace por texto plano que remite al canal que sí existe. Un mailto
        // vacío o un dominio que no resuelve es peor que no ofrecer enlace.
        if ($email === '') {
            $html = str_replace(
                '<a href="mailto:__EMAIL__">__EMAIL__</a>',
                'el canal de soporte de la aplicación',
                $html
            );
            return str_replace('__EMAIL__', 'el canal de soporte de la aplicación', $html);
        }

        $escapado = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
        return str_replace('__EMAIL__', $escapado, $html);
    }
}
