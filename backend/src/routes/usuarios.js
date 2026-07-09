const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const router = express.Router();
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

// Columnas seguras para exponer en respuestas públicas. Nunca se debe
// devolver password_hash, aunque el SELECT interno lo necesite.
const CAMPOS_PUBLICOS = 'id, email, nombre, fecha_nacimiento, genero, telefono, created_at';

// POST /api/usuarios — registro
router.post('/', async (req, res, next) => {
  try {
    const { email, password, nombre, fecha_nacimiento, genero, telefono } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'email, password y nombre son obligatorios.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await db.query(
      `INSERT INTO usuarios (email, password_hash, nombre, fecha_nacimiento, genero, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CAMPOS_PUBLICOS}`,
      [email, passwordHash, nombre, fecha_nacimiento || null, genero || null, telefono || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios/login — login simple (sin JWT/sesión todavía).
// NOTA: para el MVP se devuelve el usuario autenticado; añadir JWT o cookies
// de sesión es un cambio de esta capa únicamente, no del esquema de datos.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios.' });
    }

    const { rows } = await db.query(
      'SELECT id, password_hash FROM usuarios WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    const usuario = rows[0];
    const passwordValida = usuario && (await bcrypt.compare(password, usuario.password_hash));
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const { rows: publico } = await db.query(
      `SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`,
      [usuario.id]
    );
    res.json(publico[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/usuarios/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/:id — actualización de perfil (no permite cambiar password aquí)
router.put('/:id', async (req, res, next) => {
  try {
    const { nombre, fecha_nacimiento, genero, telefono } = req.body;
    const { rows } = await db.query(
      `UPDATE usuarios
       SET nombre = COALESCE($1, nombre),
           fecha_nacimiento = COALESCE($2, fecha_nacimiento),
           genero = COALESCE($3, genero),
           telefono = COALESCE($4, telefono)
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING ${CAMPOS_PUBLICOS}`,
      [nombre, fecha_nacimiento, genero, telefono, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/usuarios/:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE usuarios SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Test de personalidad del usuario ---

// POST /api/usuarios/:id/test-personalidad — registra un nuevo test como vigente
router.post('/:id/test-personalidad', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { respuestas, resultado, version_test } = req.body;
    if (!respuestas) {
      return res.status(400).json({ error: 'respuestas es obligatorio.' });
    }

    await client.query('BEGIN');
    // El test anterior deja de ser vigente para respetar el índice único
    // parcial (usuario_id) WHERE vigente definido en el esquema.
    await client.query(
      'UPDATE tests_personalidad SET vigente = FALSE WHERE usuario_id = $1 AND vigente',
      [req.params.id]
    );
    const { rows } = await client.query(
      `INSERT INTO tests_personalidad (usuario_id, respuestas, resultado, version_test, vigente)
       VALUES ($1, $2, $3, COALESCE($4, 1), TRUE)
       RETURNING *`,
      [req.params.id, respuestas, resultado || null, version_test]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/usuarios/:id/test-personalidad — historial completo
router.get('/:id/test-personalidad', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM tests_personalidad WHERE usuario_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// --- Intereses del usuario ---

// PUT /api/usuarios/:id/intereses — reemplaza el set de intereses del usuario
router.put('/:id/intereses', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { interes_ids } = req.body; // array de UUIDs
    if (!Array.isArray(interes_ids)) {
      return res.status(400).json({ error: 'interes_ids debe ser un arreglo.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM usuario_intereses WHERE usuario_id = $1', [req.params.id]);
    for (const interesId of interes_ids) {
      await client.query(
        'INSERT INTO usuario_intereses (usuario_id, interes_id) VALUES ($1, $2)',
        [req.params.id, interesId]
      );
    }
    await client.query('COMMIT');

    const { rows } = await db.query(
      `SELECT i.* FROM intereses i
       JOIN usuario_intereses ui ON ui.interes_id = i.id
       WHERE ui.usuario_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
