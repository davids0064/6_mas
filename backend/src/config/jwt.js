/**
 * Firma y verificación de los tokens de sesión del usuario.
 *
 * Es el equivalente en Node de `dashboard/api/src/Core/Jwt.php`, y usa
 * deliberadamente el mismo algoritmo (HS256) y los mismos nombres de claim.
 * Los dos backends comparten la base de datos pero NO el secreto: un token de
 * usuario no debe abrir el dashboard de un comercio ni al revés, así que cada
 * uno firma con su propio JWT_SECRET.
 *
 * Acá se usa la librería `jsonwebtoken` en vez de implementarlo a mano como en
 * PHP (donde evitarlo ahorraba arrastrar Composer): en Node la dependencia ya
 * es parte del ecosistema y una implementación propia de HS256 es superficie
 * de error innecesaria.
 */
const jwt = require('jsonwebtoken');

const ALGORITMO = 'HS256';

const EMISOR = process.env.JWT_ISSUER || 'seis-mas-app';
const DURACION_S = Number(process.env.JWT_TTL_SEGUNDOS || 60 * 60 * 24 * 30);

/**
 * Devuelve el secreto o lanza. Se resuelve en cada llamada (y no al cargar el
 * módulo) para que los tests puedan inyectarlo, pero la validación de arranque
 * en server.js garantiza que en producción nunca llegue vacío hasta acá.
 *
 * Preferimos caernos antes que firmar con un secreto vacío o adivinable: eso
 * permitiría a cualquiera fabricar tokens válidos y hacerse pasar por
 * cualquier usuario.
 */
function secreto() {
  const valor = process.env.JWT_SECRET;
  if (!valor) {
    throw new Error('JWT_SECRET no está configurado.');
  }
  return valor;
}

/**
 * Firma un token para un usuario. El `sub` (subject) es el id del usuario:
 * es el único dato del que depende la autorización, y va firmado para que el
 * cliente no pueda cambiarlo.
 */
function firmar(usuarioId) {
  return jwt.sign({}, secreto(), {
    algorithm: ALGORITMO,
    subject: String(usuarioId),
    issuer: EMISOR,
    expiresIn: DURACION_S,
  });
}

/**
 * Verifica firma, emisor y expiración. Devuelve el payload o null si el token
 * es inválido por cualquier motivo — el llamador no necesita distinguir la
 * causa, y no conviene decírsela al cliente.
 *
 * `algorithms` se fija explícitamente: aceptar el `alg` que declara el propio
 * token es la vulnerabilidad clásica de JWT ("alg: none"), donde un atacante
 * manda un token sin firma y la librería lo da por bueno.
 */
function verificar(token) {
  try {
    return jwt.verify(token, secreto(), {
      algorithms: [ALGORITMO],
      issuer: EMISOR,
    });
  } catch {
    return null;
  }
}

module.exports = { firmar, verificar, DURACION_S };
