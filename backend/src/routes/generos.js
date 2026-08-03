const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/generos — catálogo completo (para el dropdown de Género del
// registro). Solo activos, en el orden paramétrico definido en la tabla —
// agregar/reordenar/desactivar un género es un cambio de datos en
// pa_generos, no un despliegue de app ni de backend.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM pa_generos WHERE activo ORDER BY orden, nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/generos — alta de un género en el catálogo (uso administrativo)
router.post('/', async (req, res, next) => {
  try {
    const { nombre, icono, orden } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio.' });

    const { rows } = await db.query(
      'INSERT INTO pa_generos (nombre, icono, orden) VALUES ($1, $2, $3) RETURNING *',
      [nombre, icono || '👤', orden || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
