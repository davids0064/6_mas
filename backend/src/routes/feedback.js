const express = require('express');
const db = require('../config/db');
const { exigirUsuario, exigirAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/feedback?evento_id=&usuario_id= — historial para reputación del
// comercio y diagnóstico. Es administrativo: los comentarios de una persona
// sobre sus planes no son públicos, y el filtro por usuario_id permitiría leer
// la actividad de cualquiera con solo cambiar el parámetro.
router.get('/', exigirAdmin, async (req, res, next) => {
  try {
    const { evento_id, usuario_id } = req.query;
    const condiciones = [];
    const params = [];

    if (evento_id) {
      params.push(evento_id);
      condiciones.push(`evento_id = $${params.length}`);
    }
    if (usuario_id) {
      params.push(usuario_id);
      condiciones.push(`usuario_id = $${params.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT * FROM feedback ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/feedback — un usuario califica un evento al que asistió (1 vez por
// evento, ver constraint UNIQUE(evento_id, usuario_id) en el esquema).
//
// El usuario_id sale del token: antes venía en el cuerpo, lo que permitía
// firmar una reseña a nombre de otra persona. Y se exige haber pertenecido al
// grupo del evento, porque si no cualquiera con una cuenta podría hundir o
// inflar la reputación de un comercio en el que nunca estuvo.
router.post('/', exigirUsuario, async (req, res, next) => {
  try {
    const { evento_id, rating, comentario } = req.body;
    if (!evento_id || rating === undefined) {
      return res.status(400).json({ error: 'evento_id y rating son obligatorios.' });
    }

    const { rows: asistio } = await db.query(
      `SELECT 1
         FROM eventos e
         JOIN grupo_miembros gm ON gm.grupo_id = e.grupo_id
        WHERE e.id = $1 AND gm.usuario_id = $2 AND e.deleted_at IS NULL`,
      [evento_id, req.usuarioId]
    );
    if (!asistio[0]) {
      // 404 y no 403: que un id de evento exista o no tampoco es asunto de
      // quien no participó en él.
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }

    const { rows } = await db.query(
      `INSERT INTO feedback (evento_id, usuario_id, rating, comentario)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [evento_id, req.usuarioId, rating, comentario || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // La constraint UNIQUE(evento_id, usuario_id) es la que garantiza una sola
    // calificación por persona y evento; acá solo se traduce a HTTP.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya calificaste este plan.' });
    }
    next(err);
  }
});

module.exports = router;
