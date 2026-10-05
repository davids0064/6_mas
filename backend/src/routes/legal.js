const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();

const DIR = path.join(__dirname, '..', 'legal');

// Fecha de la última revisión del TEXTO, no de la última vez que se sirvió la
// página. Se toca a mano al editar los HTML: un documento legal que dice
// "actualizado hoy" cada día que alguien lo abre no informa de nada.
const FECHA_ACTUALIZACION = '3 de septiembre de 2026';

// Apple exige una vía de contacto en la política de privacidad. Va por variable
// de entorno y no escrita en el repo para poder cambiar la dirección sin
// desplegar código, y para no dejar un correo personal fijado en el historial
// de git.
const EMAIL_CONTACTO = (process.env.EMAIL_CONTACTO || '').trim();

// WhatsApp e Instagram son las dos vías por las que la gente escribe de verdad,
// y las dos van por variable de entorno como el correo: cambian sin desplegar,
// y un número de teléfono personal no tiene por qué quedar en el historial de
// git. Si falta alguna, su bloque no se pinta — mejor una vía menos que un
// enlace que no lleva a ningún sitio.
//
// El número se guarda en formato internacional sin signos (573001234567), que
// es lo que wa.me espera.
const WHATSAPP = (process.env.WHATSAPP_CONTACTO || '').replace(/[^0-9]/g, '');
const INSTAGRAM = (process.env.INSTAGRAM_URL || 'https://www.instagram.com/somos6mas/').trim();

if (!EMAIL_CONTACTO) {
  console.warn(
    'EMAIL_CONTACTO no está definida: /privacidad y /terminos se sirven sin dirección ' +
      'de contacto. Apple exige una en la política de privacidad antes de enviar a revisión.'
  );
}
if (!WHATSAPP) {
  console.warn(
    'WHATSAPP_CONTACTO no está definida: /soporte se sirve sin la vía por la que más ' +
      'escribe la gente. Formato esperado: 573001234567 (internacional, sin signos).'
  );
}

/** Teléfono legible: 573001234567 → +57 300 123 4567 */
function telefonoLegible(numero) {
  const m = numero.match(/^(\d{1,3})(\d{3})(\d{3})(\d{4})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${numero}`;
}

function render(archivo) {
  const html = fs.readFileSync(path.join(DIR, archivo), 'utf8');
  return html
    .replace(/__FECHA__/g, FECHA_ACTUALIZACION)
    // Sin variable configurada no se inventa una dirección: se sustituye el
    // enlace por texto plano que remite al canal que sí existe. Un mailto vacío
    // o un dominio que no resuelve es peor que no ofrecer el enlace.
    .replace(
      /<a href="mailto:__EMAIL__">__EMAIL__<\/a>/g,
      EMAIL_CONTACTO
        ? `<a href="mailto:${EMAIL_CONTACTO}">${EMAIL_CONTACTO}</a>`
        : 'el canal de soporte de la aplicación'
    )
    .replace(/__EMAIL__/g, EMAIL_CONTACTO || 'el canal de soporte de la aplicación')
    // wa.me abre la conversación en la app de WhatsApp si está instalada, y en
    // web.whatsapp.com si no. Sin número configurado se dice que esa vía no
    // está disponible en vez de dejar un enlace roto.
    .replace(
      /__WHATSAPP__/g,
      WHATSAPP
        ? `<a href="https://wa.me/${WHATSAPP}" rel="noopener">${telefonoLegible(WHATSAPP)}</a>`
        : 'No disponible por ahora. Escríbenos por correo o por Instagram.'
    )
    .replace(/__INSTAGRAM__/g, INSTAGRAM)
    // El texto del enlace es el @usuario, no la URL entera: es como la gente
    // reconoce una cuenta.
    .replace(/__INSTAGRAM_TEXTO__/g, '@' + (INSTAGRAM.replace(/\/+$/, '').split('/').pop() || 'somos6mas'));
}

// Se leen y sustituyen una vez al arrancar. Son dos documentos estáticos: leer
// del disco en cada petición solo añade E/S para devolver siempre lo mismo.
const PAGINAS = {
  '/privacidad': render('privacidad.html'),
  '/terminos': render('terminos.html'),
  // Apple exige una URL de soporte para publicar, y hasta ahora no existía
  // ninguna. Es además la respuesta a "¿dónde escribo si tengo una duda?",
  // que es la pregunta de cualquiera que no encuentra algo en la app.
  '/soporte': render('soporte.html'),
};

const CSS = fs.readFileSync(path.join(DIR, '_estilos.css'), 'utf8');

// helmet desactiva la CSP globalmente porque el resto de la API solo devuelve
// JSON. Estas dos rutas sí son HTML, así que llevan la suya, y es la más
// restrictiva que admite el documento: sin scripts, sin recursos externos, sin
// poder ser embebido en un iframe ajeno.
function cabecerasDeDocumento(res) {
  res.set(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'self'; img-src 'self' data:; " +
      "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );
  res.set('Cache-Control', 'public, max-age=3600');
}

for (const [ruta, html] of Object.entries(PAGINAS)) {
  router.get(ruta, (req, res) => {
    cabecerasDeDocumento(res);
    res.type('html').send(html);
  });
}

router.get('/legal/estilos.css', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('css').send(CSS);
});

module.exports = router;
