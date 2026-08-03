const express = require('express');
const db = require('../config/db');
const matchingRunner = require('../services/matchingRunner');
const { exigirAdmin } = require('../middleware/auth');

const router = express.Router();

// Router de administración. Los comercios gestionan sus eventos desde el
// dashboard (API PHP, con su propio token y el comercio_id sacado de él), y la
// app consulta los suyos por GET /api/usuarios/yo/eventos.
//
// El filtro ?grupo_id= que usaba la app quedaba abierto: cambiar el id dejaba
// leer la agenda de cualquier grupo. Por eso deja de ser una ruta pública.
router.use(exigirAdmin);

// GET /api/eventos — soporta filtro opcional ?grupo_id= y ?comercio_id=
router.get('/', async (req, res, next) => {
  try {
    const { grupo_id, comercio_id } = req.query;
    const condiciones = ['deleted_at IS NULL'];
    const params = [];

    if (grupo_id) {
      params.push(grupo_id);
      condiciones.push(`grupo_id = $${params.length}`);
    }
    if (comercio_id) {
      params.push(comercio_id);
      condiciones.push(`comercio_id = $${params.length}`);
    }

    const { rows } = await db.query(
      `SELECT * FROM eventos WHERE ${condiciones.join(' AND ')} ORDER BY fecha_hora`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      comercio_id, anfitrion_id, grupo_id, titulo, descripcion,
      categoria, fecha_hora, capacidad, precio,
    } = req.body;

    if (!comercio_id || !anfitrion_id || !titulo || !fecha_hora) {
      return res.status(400).json({
        error: 'comercio_id, anfitrion_id, titulo y fecha_hora son obligatorios.',
      });
    }

    const { rows } = await db.query(
      `INSERT INTO eventos
         (comercio_id, anfitrion_id, grupo_id, titulo, descripcion, categoria, fecha_hora, capacidad, precio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 6), COALESCE($9, 0))
       RETURNING *`,
      [comercio_id, anfitrion_id, grupo_id || null, titulo, descripcion || null, categoria || null, fecha_hora, capacidad, precio]
    );
    res.status(201).json(rows[0]);

    // Oferta nueva sin grupo: puede haber un grupo completo esperando plan.
    if (!grupo_id) {
      matchingRunner.programarEnSegundoPlano(`evento publicado por el comercio ${comercio_id}`);
    }
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM eventos WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/eventos/:id — actualización general, incluye asignar grupo_id
// cuando el matching (manual por ahora) decide enlazar el evento a un grupo.
router.put('/:id', async (req, res, next) => {
  try {
    const { grupo_id, titulo, descripcion, fecha_hora, capacidad, precio, estado } = req.body;
    const { rows } = await db.query(
      `UPDATE eventos
       SET grupo_id = COALESCE($1, grupo_id),
           titulo = COALESCE($2, titulo),
           descripcion = COALESCE($3, descripcion),
           fecha_hora = COALESCE($4, fecha_hora),
           capacidad = COALESCE($5, capacidad),
           precio = COALESCE($6, precio),
           estado = COALESCE($7, estado)
       WHERE id = $8 AND deleted_at IS NULL
       RETURNING *`,
      [grupo_id, titulo, descripcion, fecha_hora, capacidad, precio, estado, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "UPDATE eventos SET deleted_at = now(), estado = 'cancelado' WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
