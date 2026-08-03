const express = require('express');
const db = require('../config/db');
const { exigirAdmin } = require('../middleware/auth');

const router = express.Router();

// Router de administración: los anfitriones son personal de los comercios y
// sus datos de contacto no son públicos. El comercio los gestiona desde el
// dashboard.
router.use(exigirAdmin);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM anfitriones WHERE deleted_at IS NULL ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { comercio_id, nombre, email, telefono } = req.body;
    if (!comercio_id || !nombre || !email) {
      return res.status(400).json({ error: 'comercio_id, nombre y email son obligatorios.' });
    }
    const { rows } = await db.query(
      `INSERT INTO anfitriones (comercio_id, nombre, email, telefono)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [comercio_id, nombre, email, telefono || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM anfitriones WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Anfitrión no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE anfitriones SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Anfitrión no encontrado.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
