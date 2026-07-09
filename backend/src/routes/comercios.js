const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM comercios WHERE deleted_at IS NULL ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { nombre, nit, direccion, ciudad, categoria, telefono, email } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio.' });

    const { rows } = await db.query(
      `INSERT INTO comercios (nombre, nit, direccion, ciudad, categoria, telefono, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, nit || null, direccion || null, ciudad || null, categoria || null, telefono || null, email || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM comercios WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comercio no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nombre, direccion, ciudad, categoria, telefono, email, activo } = req.body;
    const { rows } = await db.query(
      `UPDATE comercios
       SET nombre = COALESCE($1, nombre),
           direccion = COALESCE($2, direccion),
           ciudad = COALESCE($3, ciudad),
           categoria = COALESCE($4, categoria),
           telefono = COALESCE($5, telefono),
           email = COALESCE($6, email),
           activo = COALESCE($7, activo)
       WHERE id = $8 AND deleted_at IS NULL
       RETURNING *`,
      [nombre, direccion, ciudad, categoria, telefono, email, activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comercio no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE comercios SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comercio no encontrado.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
