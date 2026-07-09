// Handler centralizado para no repetir try/catch de formateo en cada ruta.
// Los controladores hacen `next(err)` y este middleware decide el status.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  // Violación de constraint UNIQUE de Postgres (ej. email duplicado).
  if (err.code === '23505') {
    return res.status(409).json({ error: 'El recurso ya existe (violación de unicidad).' });
  }

  // Violación de FK (ej. crear un evento con un comercio_id inexistente).
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia inválida a otro recurso.' });
  }

  // Violación de CHECK (ej. rating fuera de 1-5, grupo con 7 miembros).
  if (err.code === '23514') {
    return res.status(400).json({ error: 'El dato no cumple una regla de negocio.' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Error interno del servidor.' });
}

module.exports = errorHandler;
