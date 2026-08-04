const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('../config/jwt');
const { exigirUsuario } = require('../middleware/auth');
const matchingRunner = require('../services/matchingRunner');

const router = express.Router();
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

// Columnas seguras para exponer en respuestas públicas. Nunca se debe
// devolver password_hash, aunque el SELECT interno lo necesite.
const CAMPOS_PUBLICOS = 'id, email, nombre, fecha_nacimiento, genero, telefono, created_at';

// --- Rutas públicas (las únicas dos) ---

// POST /api/usuarios — registro
router.post('/', async (req, res, next) => {
  try {
    const { email, password, nombre, fecha_nacimiento, genero, telefono } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'email, password y nombre son obligatorios.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    // El email se normaliza (trim + minúsculas) para que el login sea
    // insensible a mayúsculas sin importar desde qué cliente se registró.
    const { rows } = await db.query(
      `INSERT INTO usuarios (email, password_hash, nombre, fecha_nacimiento, genero, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CAMPOS_PUBLICOS}`,
      [email.trim().toLowerCase(), passwordHash, nombre, fecha_nacimiento || null, genero || null, telefono || null]
    );

    // Se devuelve el token junto al usuario para que el registro deje la
    // sesión iniciada: obligar a un login inmediatamente después de crear la
    // cuenta es fricción sin ninguna ganancia de seguridad.
    res.status(201).json({ token: jwt.firmar(rows[0].id), usuario: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios.' });
    }

    // LOWER en ambos lados: el email es insensible a mayúsculas aunque el
    // registro venga de un cliente viejo que no lo normalizara.
    const { rows } = await db.query(
      'SELECT id, password_hash FROM usuarios WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
      [email.trim()]
    );
    const usuario = rows[0];
    const passwordValida = usuario && (await bcrypt.compare(password, usuario.password_hash));
    if (!passwordValida) {
      // Mismo mensaje para "no existe" y "contraseña incorrecta", igual que en
      // el dashboard: distinguirlos permite enumerar qué correos están
      // registrados.
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const { rows: publico } = await db.query(
      `SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`,
      [usuario.id]
    );
    res.json({ token: jwt.firmar(usuario.id), usuario: publico[0] });
  } catch (err) {
    next(err);
  }
});

// --- Rutas del usuario autenticado ---
//
// A partir de acá todo exige token. No existe ninguna ruta /api/usuarios/:id:
// el id sale del token, así que no hay ningún parámetro que un cliente pueda
// cambiar para leer o borrar la cuenta de otra persona.
router.use(exigirUsuario);

// GET /api/usuarios/yo — perfil propio
router.get('/yo', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1 AND deleted_at IS NULL`,
      [req.usuarioId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/yo — actualización de perfil (no permite cambiar password aquí)
router.put('/yo', async (req, res, next) => {
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
      [nombre, fecha_nacimiento, genero, telefono, req.usuarioId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/usuarios/yo — soft delete de la cuenta propia
router.delete('/yo', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE usuarios SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.usuarioId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/usuarios/yo/grupo — el grupo vigente del usuario, con sus miembros.
//
// Existe porque la app no tiene forma de saber a qué grupo la asignó el
// matching: el grupo se le asigna, no lo elige. Devuelve 204 si todavía está
// en espera, que es un estado normal y no un error.
//
// Deliberadamente NO expone el email ni el teléfono de los otros miembros:
// compartir grupo no es motivo para entregar los datos de contacto de nadie.
router.get('/yo/grupo', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT g.*
         FROM grupos g
         JOIN grupo_miembros gm ON gm.grupo_id = g.id
        WHERE gm.usuario_id = $1
          AND g.deleted_at IS NULL
          AND g.estado IN ('formando', 'completo', 'activo')
        ORDER BY g.created_at DESC
        LIMIT 1`,
      [req.usuarioId]
    );
    if (!rows[0]) return res.status(204).send();

    const { rows: miembros } = await db.query(
      `SELECT u.id, u.nombre, gm.rol, gm.fecha_union
         FROM grupo_miembros gm
         JOIN usuarios u ON u.id = gm.usuario_id
        WHERE gm.grupo_id = $1
        ORDER BY gm.fecha_union`,
      [rows[0].id]
    );
    res.json({ ...rows[0], miembros });
  } catch (err) {
    next(err);
  }
});

// GET /api/usuarios/yo/eventos — los planes asignados a los grupos del usuario.
//
// La app pedía antes /api/eventos?grupo_id=X, que dejaba leer la agenda de
// cualquier grupo con solo cambiar el id. Acá el filtro no es un parámetro:
// sale de a qué grupos pertenece quien pregunta.
//
// Devuelve el evento con el comercio resuelto porque "tu plan" sin el dónde no
// es un plan: la fila de `eventos` trae qué y cuándo, pero la dirección vive en
// `comercios`, y este rol (seis_app) no la puede leer — la ve por
// `v_comercio_publico`, que es exactamente la frontera que la migración 001
// dejó escrita.
//
// Los JOIN son LEFT a propósito. `v_comercio_publico` filtra por `activo`: si
// un comercio se da de baja después de que el matching asignó el plan, un JOIN
// normal haría DESAPARECER el evento de la app del usuario. Degradado (sin
// dirección) es mucho mejor que invisible — la fila de `eventos` guarda el
// título, la fecha y el precio del momento de la asignación, así que el plan se
// sigue pudiendo mostrar.
router.get('/yo/eventos', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*,
              c.nombre    AS comercio_nombre,
              c.direccion AS comercio_direccion,
              c.ciudad    AS comercio_ciudad,
              c.logo_url  AS comercio_logo_url,
              a.nombre    AS anfitrion_nombre,
              (f.id IS NOT NULL) AS ya_valorado
         FROM eventos e
         JOIN grupo_miembros gm ON gm.grupo_id = e.grupo_id
         LEFT JOIN v_comercio_publico c ON c.id = e.comercio_id
         LEFT JOIN anfitriones a        ON a.id = e.anfitrion_id
                                       AND a.deleted_at IS NULL
         -- Atado al usuario que pregunta, no al evento: 'ya_valorado' responde
         -- "¿lo valoré YO?", y con la valoración de otro miembro del grupo se
         -- le escondería el formulario a quien todavía no opinó.
         LEFT JOIN feedback f ON f.evento_id = e.id AND f.usuario_id = $1
        WHERE gm.usuario_id = $1
          AND e.deleted_at IS NULL
        ORDER BY e.fecha_hora`,
      [req.usuarioId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// --- Test de personalidad ---

// POST /api/usuarios/yo/test-personalidad — registra un nuevo test como vigente
router.post('/yo/test-personalidad', async (req, res, next) => {
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
      [req.usuarioId]
    );
    const { rows } = await client.query(
      `INSERT INTO tests_personalidad (usuario_id, respuestas, resultado, version_test, vigente)
       VALUES ($1, $2, $3, COALESCE($4, 1), TRUE)
       RETURNING *`,
      [req.usuarioId, respuestas, resultado || null, version_test]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);

    // Terminar el test es el momento en que el usuario entra al pool: es acá,
    // y no en el registro, donde recién hay datos con qué puntuarlo. Se
    // dispara después de responder y en segundo plano, porque el matching lee
    // todo el pool y no debe hacer esperar a quien acaba de contestar 20
    // preguntas. Si no hay 6 compatibles todavía, la corrida no hace nada y
    // el usuario queda esperando al siguiente que complete el test.
    matchingRunner.dispararEnSegundoPlano(`test de ${req.usuarioId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/usuarios/yo/test-personalidad — historial propio
router.get('/yo/test-personalidad', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM tests_personalidad WHERE usuario_id = $1 ORDER BY created_at DESC',
      [req.usuarioId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// --- Intereses ---

// PUT /api/usuarios/yo/intereses — reemplaza el set de intereses propio
router.put('/yo/intereses', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { interes_ids } = req.body; // array de UUIDs
    if (!Array.isArray(interes_ids)) {
      return res.status(400).json({ error: 'interes_ids debe ser un arreglo.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM usuario_intereses WHERE usuario_id = $1', [req.usuarioId]);
    for (const interesId of interes_ids) {
      await client.query(
        'INSERT INTO usuario_intereses (usuario_id, interes_id) VALUES ($1, $2)',
        [req.usuarioId, interesId]
      );
    }
    await client.query('COMMIT');

    const { rows } = await db.query(
      `SELECT i.* FROM pa_intereses i
       JOIN usuario_intereses ui ON ui.interes_id = i.id
       WHERE ui.usuario_id = $1`,
      [req.usuarioId]
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
