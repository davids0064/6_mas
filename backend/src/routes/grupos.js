const express = require('express');
const db = require('../config/db');
const { exigirAdmin } = require('../middleware/auth');

const router = express.Router();

// Todo este router es de administración. Un usuario no crea grupos ni se une a
// uno: el matching se lo asigna. Lo que la app necesita —cuál es mi grupo y
// quiénes lo componen— lo sirve GET /api/usuarios/yo/grupo, que deriva el
// grupo del token en vez de aceptar un id por la URL.
//
// Estas rutas quedan para operación y diagnóstico: listar el estado del
// sistema, deshacer una asignación mala, cerrar un grupo a mano.
router.use(exigirAdmin);

// GET /api/grupos — lista grupos activos (no borrados)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM grupos WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/grupos — crea un grupo vacío (estado 'formando')
router.post('/', async (req, res, next) => {
  try {
    const { nombre } = req.body;
    const { rows } = await db.query(
      "INSERT INTO grupos (nombre, estado) VALUES ($1, 'formando') RETURNING *",
      [nombre || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/grupos/:id — detalle con miembros
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM grupos WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Grupo no encontrado.' });

    const { rows: miembros } = await db.query(
      `SELECT u.id, u.nombre, u.email, gm.rol, gm.fecha_union
       FROM grupo_miembros gm
       JOIN usuarios u ON u.id = gm.usuario_id
       WHERE gm.grupo_id = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], miembros });
  } catch (err) {
    next(err);
  }
});

// POST /api/grupos/:id/miembros — añade un miembro al grupo
// El trigger enforce_grupo_max_6 en la base de datos rechaza el insert si el
// grupo ya tiene 6 miembros; aquí solo se traduce ese error a HTTP 400.
router.post('/:id/miembros', async (req, res, next) => {
  try {
    const { usuario_id, rol } = req.body;
    if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio.' });

    const { rows } = await db.query(
      `INSERT INTO grupo_miembros (grupo_id, usuario_id, rol)
       VALUES ($1, $2, COALESCE($3, 'miembro'))
       RETURNING *`,
      [req.params.id, usuario_id, rol]
    );

    // Si con este miembro el grupo llega a 6, se marca automáticamente como completo.
    const { rows: conteo } = await db.query(
      'SELECT count(*)::int AS total FROM grupo_miembros WHERE grupo_id = $1',
      [req.params.id]
    );
    if (conteo[0].total === 6) {
      await db.query("UPDATE grupos SET estado = 'completo' WHERE id = $1", [req.params.id]);
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('ya tiene el máximo de 6 miembros')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/grupos/:id/miembros/:usuarioId
router.delete('/:id/miembros/:usuarioId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.params.usuarioId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'El usuario no pertenece a este grupo.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /api/grupos/:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE grupos SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Grupo no encontrado.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
