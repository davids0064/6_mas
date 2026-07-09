const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/feedback?evento_id=... — historial de un evento (reputación del comercio)
router.get('/', async (req, res, next) => {
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

// POST /api/feedback — un usuario califica un evento (1 vez por evento, ver
// constraint UNIQUE(evento_id, usuario_id) en el esquema).
router.post('/', async (req, res, next) => {
  try {
    const { evento_id, usuario_id, rating, comentario } = req.body;
    if (!evento_id || !usuario_id || rating === undefined) {
      return res.status(400).json({ error: 'evento_id, usuario_id y rating son obligatorios.' });
    }

    const { rows } = await db.query(
      `INSERT INTO feedback (evento_id, usuario_id, rating, comentario)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [evento_id, usuario_id, rating, comentario || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
