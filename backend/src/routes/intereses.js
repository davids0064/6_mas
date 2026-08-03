const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/intereses — catálogo completo (para pantalla de selección de
// intereses). Solo activos, en el orden paramétrico definido en la tabla —
// agregar/reordenar/desactivar un interés es un cambio de datos en
// pa_intereses, no un despliegue de app ni de backend.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM pa_intereses WHERE activo ORDER BY orden, nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/intereses — alta de un interés en el catálogo (uso administrativo)
router.post('/', async (req, res, next) => {
  try {
    const { nombre, icono, categoria, orden } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio.' });

    const { rows } = await db.query(
      'INSERT INTO pa_intereses (nombre, icono, categoria, orden) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, icono || '✨', categoria || null, orden || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
