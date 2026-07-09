const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/intereses — catálogo completo (para pantalla de selección de intereses)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM intereses ORDER BY categoria, nombre');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/intereses — alta de un interés en el catálogo (uso administrativo)
router.post('/', async (req, res, next) => {
  try {
    const { nombre, categoria } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio.' });

    const { rows } = await db.query(
      'INSERT INTO intereses (nombre, categoria) VALUES ($1, $2) RETURNING *',
      [nombre, categoria || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
