// ============================================================================
// Moderación del chat de grupo.
//
// La guideline 1.2 de la App Store exige cuatro cosas para publicar contenido
// generado por usuarios, y este módulo es la primera:
//
//   1. un método para filtrar material objetable        ← esto
//   2. poder reportar                                    (tabla `reportes`)
//   3. poder bloquear a otro usuario                     (tabla `bloqueos`)
//   4. actuar sobre los reportes                         (proceso, no código)
//
// QUÉ ES Y QUÉ NO ES. Es un filtro léxico: reconoce un puñado de insultos y
// amenazas inequívocas y esconde el mensaje. No "entiende" nada, no detecta
// acoso escrito con buenos modales, y se salta con cualquier variación que no
// esté contemplada. No se presenta como más de lo que es, porque creer que un
// filtro de palabras resuelve la moderación es cómo se acaba sin las otras
// tres. Lo que de verdad sostiene la seguridad acá es que una persona pueda
// reportar y bloquear, y que alguien mire los reportes.
//
// Por eso el mensaje filtrado se GUARDA (marcado `oculto`) en vez de
// rechazarse: quien lo escribió no aprende qué palabra esquivar, y queda
// evidencia para revisar la cuenta. Un filtro que responde "mensaje rechazado"
// es un campo de pruebas para encontrar el hueco.
// ============================================================================

// Se normaliza antes de comparar: minúsculas, sin tildes y con las
// sustituciones de caracteres más comunes (4→a, 3→e, 0→o, 1→i, @→a). No cubre
// todo — nada lo cubre — pero evita que el filtro caiga con la primera
// variación trivial.
function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[4@]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/5/g, 's')
    // Repeticiones para estirar la palabra ("puuuuta"): se colapsan.
    .replace(/(.)\1{2,}/g, '$1');
}

// Términos que no admiten lectura benigna en un chat entre seis personas que
// van a cenar: insultos degradantes, amenazas explícitas y expresiones de odio.
// La lista es corta a propósito y está pensada para crecer con lo que los
// reportes reales enseñen, no para adivinar de antemano.
//
// Se comparan como palabra completa (\b) para no castigar falsos positivos:
// sin eso, "marica" dentro de "Maricarmen" escondería un mensaje inocente.
const TERMINOS = [
  'hijueputa', 'malparido', 'gonorrea', 'perra', 'puta', 'puto',
  'maricon', 'marica', 'negro de mierda', 'indio de mierda',
  'te voy a matar', 'te mato', 'te voy a violar', 'violala', 'violalo',
  'mataros', 'muerete', 'matate',
];

const PATRONES = TERMINOS.map(
  (t) => new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i')
);

/**
 * ¿Este texto se esconde?
 * Devuelve { objetable: boolean, motivo: string|null }.
 */
function revisar(texto) {
  const limpio = normalizar(texto);
  for (let i = 0; i < PATRONES.length; i += 1) {
    if (PATRONES[i].test(limpio)) {
      return { objetable: true, motivo: `termino:${TERMINOS[i]}` };
    }
  }
  return { objetable: false, motivo: null };
}

module.exports = { revisar, normalizar, TERMINOS };
