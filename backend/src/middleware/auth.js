/**
 * Middlewares de autenticación.
 *
 * Regla central de seguridad del backend, la misma que ya aplica el dashboard
 * con `comercio_id`: el `usuario_id` con el que se opera SIEMPRE sale del
 * token firmado, nunca del cuerpo ni de la URL. Por eso las rutas propias del
 * usuario son `/api/usuarios/yo/...` y no `/api/usuarios/:id/...` — si no
 * existe la ruta con id, no existe la forma de pedir los datos de otro.
 */
const { timingSafeEqual } = require('crypto');
const jwt = require('../config/jwt');

/**
 * Exige un token de usuario válido y deja `req.usuarioId` disponible.
 *
 * Responde 401 tanto si falta el token como si no verifica, con el mismo
 * mensaje: distinguir "no mandaste token" de "tu token es inválido" no le
 * sirve a un cliente legítimo y sí a quien está probando tokens.
 */
function exigirUsuario(req, res, next) {
  const cabecera = req.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(cabecera);
  if (!match) {
    return res.status(401).json({ error: 'Falta el token de autenticación.' });
  }

  const payload = jwt.verificar(match[1].trim());
  if (!payload || !payload.sub) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }

  req.usuarioId = payload.sub;
  next();
}

/**
 * Exige la clave de administración para las rutas de operación: correr el
 * matching, editar los catálogos paramétricos, dar de alta comercios.
 *
 * Es una clave compartida por cabecera y no un rol dentro del JWT porque el
 * esquema no tiene todavía usuarios administradores: `usuarios` es la tabla de
 * las personas que usan la app, y meterles un flag `es_admin` para el beta
 * mezclaría dos cosas que no son la misma. Cuando exista un panel interno,
 * esto se reemplaza por un rol firmado sin tocar las rutas.
 *
 * La comparación es en tiempo constante: comparar con === filtra información
 * sobre cuántos caracteres iniciales acertó quien está probando claves.
 */
function exigirAdmin(req, res, next) {
  const esperada = process.env.ADMIN_API_KEY;
  if (!esperada) {
    // Sin clave configurada estas rutas quedan cerradas, no abiertas. Un
    // despliegue al que se le olvidó la variable debe perder la función de
    // administración, nunca exponerla a internet.
    return res.status(503).json({ error: 'Administración no configurada en este servidor.' });
  }

  const recibida = req.get('X-Admin-Key') || '';
  if (!comparacionSegura(recibida, esperada)) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

function comparacionSegura(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual exige la misma longitud, y la propia diferencia de
  // longitud ya es una filtración menor; se comparan igual para no ramificar
  // antes de tiempo.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

module.exports = { exigirUsuario, exigirAdmin };
