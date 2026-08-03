const express = require('express');
const db = require('../config/db');
const matchingRunner = require('../services/matchingRunner');
const { exigirAdmin } = require('../middleware/auth');

const router = express.Router();

// Router de administración. El canal por el que un comercio gestiona lo suyo
// es el dashboard (dashboard/api), donde el comercio_id sale de su token y no
// de la URL. Estas rutas son el acceso interno equivalente, y exponen datos de
// negocio —qué comercios hay, qué planes tienen— que no son públicos.
router.use(exigirAdmin);

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

// ---------------------------------------------------------------------------
// Oferta del comercio: qué experiencias ofrece (planes) y cuándo puede
// recibir grupos (disponibilidad). Es lo que alimenta al matching automático.
//
// Cada alta dispara la programación de los grupos que están completos y sin
// plan: es lo que hace verdadera la promesa del dashboard ("publica tu
// disponibilidad y Seis Más te asigna un grupo") también para los grupos que
// ya existían antes de que este comercio entrara.
// ---------------------------------------------------------------------------

// GET /api/comercios/:id/planes
router.get('/:id/planes', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT cp.*, i.nombre AS interes
       FROM comercio_planes cp
       JOIN pa_intereses i ON i.id = cp.interes_id
       WHERE cp.comercio_id = $1 AND cp.deleted_at IS NULL
       ORDER BY cp.created_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/comercios/:id/planes
router.post('/:id/planes', async (req, res, next) => {
  try {
    const { interes_id, titulo, descripcion, duracion_min, precio, capacidad } = req.body;
    if (!interes_id || !titulo) {
      return res.status(400).json({ error: 'interes_id y titulo son obligatorios.' });
    }
    const { rows } = await db.query(
      `INSERT INTO comercio_planes
         (comercio_id, interes_id, titulo, descripcion, duracion_min, precio, capacidad)
       VALUES ($1, $2, $3, $4, COALESCE($5, 120), COALESCE($6, 0), COALESCE($7, 6))
       RETURNING *`,
      [req.params.id, interes_id, titulo, descripcion || null, duracion_min, precio, capacidad]
    );
    res.status(201).json(rows[0]);
    matchingRunner.programarEnSegundoPlano(`plan nuevo del comercio ${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/comercios/:id/planes/:planId — soft delete
router.delete('/:id/planes/:planId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE comercio_planes SET deleted_at = now()
       WHERE id = $1 AND comercio_id = $2 AND deleted_at IS NULL RETURNING id`,
      [req.params.planId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/comercios/:id/disponibilidad
router.get('/:id/disponibilidad', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM comercio_disponibilidad WHERE comercio_id = $1
       ORDER BY dia_semana, hora_inicio`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/comercios/:id/disponibilidad
// dia_semana sigue la convención de EXTRACT(DOW): 0 = domingo … 6 = sábado.
router.post('/:id/disponibilidad', async (req, res, next) => {
  try {
    const { dia_semana, hora_inicio, hora_fin, grupos_max } = req.body;
    if (dia_semana === undefined || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'dia_semana, hora_inicio y hora_fin son obligatorios.' });
    }
    const { rows } = await db.query(
      `INSERT INTO comercio_disponibilidad (comercio_id, dia_semana, hora_inicio, hora_fin, grupos_max)
       VALUES ($1, $2, $3, $4, COALESCE($5, 1))
       ON CONFLICT (comercio_id, dia_semana, hora_inicio)
         DO UPDATE SET hora_fin = EXCLUDED.hora_fin,
                       grupos_max = EXCLUDED.grupos_max,
                       activo = TRUE
       RETURNING *`,
      [req.params.id, dia_semana, hora_inicio, hora_fin, grupos_max]
    );
    res.status(201).json(rows[0]);
    matchingRunner.programarEnSegundoPlano(`disponibilidad nueva del comercio ${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/comercios/:id/disponibilidad/:franjaId
router.delete('/:id/disponibilidad/:franjaId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM comercio_disponibilidad WHERE id = $1 AND comercio_id = $2 RETURNING id',
      [req.params.franjaId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Franja no encontrada.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
