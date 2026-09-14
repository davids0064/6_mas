const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('../config/jwt');
const { exigirUsuario } = require('../middleware/auth');
const matchingRunner = require('../services/matchingRunner');
const matching = require('../services/matching');
const { edadEnAnios, EDAD_MINIMA } = require('../services/edad');
const perfilPersonalidad = require('../services/perfilPersonalidad');

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
    // La mayoría de edad se validaba SOLO en el formulario de la app, es decir,
    // en el lado que cualquiera puede saltarse llamando a la API directamente.
    // Para un producto que sienta a seis desconocidos en una mesa, la edad no
    // es un campo de formulario más: es el requisito que sostiene la
    // clasificación por edad de la ficha de la App Store y la responsabilidad
    // legal de quien organiza el encuentro. Se comprueba aquí, que es donde no
    // se puede eludir.
    if (!fecha_nacimiento) {
      return res.status(400).json({ error: 'La fecha de nacimiento es obligatoria.' });
    }
    const edad = edadEnAnios(fecha_nacimiento);
    if (edad === null) {
      return res.status(400).json({ error: 'La fecha de nacimiento no es válida.' });
    }
    if (edad < EDAD_MINIMA) {
      return res
        .status(400)
        .json({ error: `Debes ser mayor de ${EDAD_MINIMA} años para usar Seis Más.` });
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

    // Se piden también los intereses y las respuestas del test de cada miembro
    // para poder decir QUÉ tienen en común, no solo quiénes son. Antes esta
    // ruta devolvía cuatro columnas —id, nombre, rol y fecha— y la pantalla
    // pintaba seis nombres sueltos: el grupo se presentaba como una lista de
    // desconocidos, que es exactamente lo que la app debería estar deshaciendo.
    //
    // Las respuestas NO salen de acá: se usan para calcular la afinidad y se
    // descartan antes de responder. Compartir mesa no da derecho a leer el test
    // de nadie.
    const { rows: miembros } = await db.query(
      `SELECT u.id, u.nombre, gm.rol, gm.fecha_union,
              t.respuestas,
              COALESCE(array_agg(i.nombre ORDER BY i.nombre)
                       FILTER (WHERE i.nombre IS NOT NULL), '{}') AS intereses
         FROM grupo_miembros gm
         JOIN usuarios u ON u.id = gm.usuario_id
         LEFT JOIN tests_personalidad t ON t.usuario_id = u.id AND t.vigente
         LEFT JOIN usuario_intereses ui ON ui.usuario_id = u.id
         LEFT JOIN pa_intereses i ON i.id = ui.interes_id AND i.activo
        WHERE gm.grupo_id = $1
        GROUP BY u.id, u.nombre, gm.rol, gm.fecha_union, t.respuestas
        ORDER BY gm.fecha_union`,
      [rows[0].id]
    );

    const yo = miembros.find((m) => m.id === req.usuarioId);

    const publicos = miembros.map((m) => {
      const { respuestas, ...resto } = m;
      const esUnoMismo = m.id === req.usuarioId;

      // Solo el primer nombre de los demás. El nombre completo de cinco
      // desconocidos es un dato de contacto disfrazado de cortesía.
      const nombre = esUnoMismo ? m.nombre : String(m.nombre || '').trim().split(/\s+/)[0];

      if (esUnoMismo || !yo) return { ...resto, nombre, es_tu_perfil: esUnoMismo };

      const comun = matching.explicarAfinidad(
        { intereses: yo.intereses, respuestas: yo.respuestas },
        { intereses: m.intereses, respuestas: m.respuestas }
      );
      return {
        ...resto,
        nombre,
        es_tu_perfil: false,
        // Lo que tienen en común, que es lo único que hace falta para romper
        // el hielo. El score se redondea a dos decimales: presentarle a alguien
        // un 0.7382417 de afinidad con otra persona es ruido con aire de dato.
        intereses_comunes: comun.intereses_comunes,
        afinidad: Math.round(comun.score * 100) / 100,
      };
    });

    // Qué comparte el grupo, que es lo que explica por qué se formó.
    //
    // El criterio es "al menos la mitad", no "los seis". Con la intersección
    // estricta el resultado es casi siempre vacío —basta una persona que no
    // marcó Gastronomía para borrarla— y la pantalla quedaría en blanco
    // justamente en el grupo que sí se formó por gastronomía. La mitad es
    // además el mismo umbral con el que services/programacion.js decide si un
    // plan le sirve al grupo, así que lo que se muestra coincide con lo que el
    // sistema usó para elegir el local.
    const cuenta = new Map();
    for (const m of miembros) {
      for (const interes of m.intereses || []) {
        cuenta.set(interes, (cuenta.get(interes) || 0) + 1);
      }
    }
    const minimo = Math.ceil(miembros.length / 2);
    const interesesDelGrupo = [...cuenta.entries()]
      .filter(([, n]) => n >= minimo)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([nombre, n]) => ({ nombre, cuantos: n }));

    res.json({
      ...rows[0],
      miembros: publicos,
      intereses_del_grupo: interesesDelGrupo,
      faltan: Math.max(0, rows[0].tamano_max - miembros.length),
    });
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

// GET /api/usuarios/yo/eventos/:id/local — el sitio al que vas.
//
// La app mostraba del plan el título, la fecha, la dirección y el precio, y
// nada más: un local sin carta, sin horario y sin saber qué te encuentras al
// llegar es una línea de texto, no un sitio. Todo eso ya existía —lo publica el
// propio comercio desde su app— y no había forma de que llegara acá.
//
// El id del evento SÍ es un parámetro, a diferencia del resto de este router,
// así que la autorización se comprueba a mano: se exige que quien pregunta
// pertenezca al grupo de ese evento. Sin esa condición, cambiar el id en la
// URL sería un recorrido por la carta de cualquier local con evento asignado.
// Responde 404 y no 403 cuando no te toca: distinguirlos confirmaría que el
// evento existe.
router.get('/yo/eventos/:id/local', async (req, res, next) => {
  try {
    const { rows: evento } = await db.query(
      `SELECT e.id, e.comercio_id, e.anfitrion_id, e.fecha_hora, e.titulo
         FROM eventos e
         JOIN grupo_miembros gm ON gm.grupo_id = e.grupo_id
        WHERE e.id = $1 AND gm.usuario_id = $2 AND e.deleted_at IS NULL`,
      [req.params.id, req.usuarioId]
    );
    if (!evento[0]) return res.status(404).json({ error: 'Evento no encontrado.' });

    const comercioId = evento[0].comercio_id;

    const [comercio, anfitrion, propuesta, filas] = await Promise.all([
      db.query('SELECT * FROM v_comercio_publico WHERE id = $1', [comercioId]),
      db.query(
        'SELECT nombre, bio, foto_url FROM anfitriones WHERE id = $1 AND deleted_at IS NULL',
        [evento[0].anfitrion_id]
      ),
      db.query('SELECT * FROM v_propuesta_publica WHERE comercio_id = $1 LIMIT 1', [comercioId]),
      db.query(
        `SELECT * FROM v_menu_publico WHERE comercio_id = $1
          ORDER BY menu_orden, seccion_orden, item_orden`,
        [comercioId]
      ),
    ]);

    // La vista viene plana (una fila por plato) porque Postgres no devuelve
    // árboles; el anidado se arma acá, que es quien sabe qué forma necesita la
    // pantalla. Las filas sin sección o sin ítem existen —el LEFT JOIN deja
    // pasar un menú publicado todavía vacío— y se descartan al anidar en vez
    // de filtrarlas en SQL, para que un menú sin platos no desaparezca sino
    // que aparezca vacío.
    const menus = [];
    const porMenu = new Map();
    const porSeccion = new Map();
    for (const f of filas.rows) {
      let menu = porMenu.get(f.menu_id);
      if (!menu) {
        menu = { id: f.menu_id, nombre: f.menu_nombre, descripcion: f.menu_descripcion, secciones: [] };
        porMenu.set(f.menu_id, menu);
        menus.push(menu);
      }
      if (!f.seccion_id) continue;
      let seccion = porSeccion.get(f.seccion_id);
      if (!seccion) {
        seccion = { id: f.seccion_id, nombre: f.seccion_nombre, descripcion: f.seccion_descripcion, items: [] };
        porSeccion.set(f.seccion_id, seccion);
        menu.secciones.push(seccion);
      }
      if (!f.item_id) continue;
      seccion.items.push({
        id: f.item_id,
        nombre: f.item_nombre,
        descripcion: f.item_descripcion,
        precio: f.item_precio,
      });
    }

    res.json({
      evento: { id: evento[0].id, titulo: evento[0].titulo, fecha_hora: evento[0].fecha_hora },
      comercio: comercio.rows[0] || null,
      anfitrion: anfitrion.rows[0] || null,
      propuesta: propuesta.rows[0] || null,
      menus,
    });
  } catch (err) {
    next(err);
  }
});

// --- Test de personalidad ---

// POST /api/usuarios/yo/test-personalidad — registra un nuevo test como vigente
router.post('/yo/test-personalidad', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { respuestas, version_test } = req.body;
    if (!respuestas) {
      return res.status(400).json({ error: 'respuestas es obligatorio.' });
    }

    // El resultado se calcula acá y no se acepta del cliente, aunque el cuerpo
    // traiga uno. Es lo que se le muestra a la persona como su perfil y lo que
    // explica con qué criterio se la agrupa: si lo mandara el cliente, sería un
    // campo que cualquiera puede escribir llamando a la API, y dejaría de
    // significar nada. La app, de hecho, venía mandando `null`.
    const resultado = perfilPersonalidad.construir(respuestas);

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
      [req.usuarioId, respuestas, resultado, version_test]
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

// GET /api/usuarios/yo/perfil-personalidad — el perfil vigente.
//
// Existe porque la app pedía 20 preguntas y no devolvía nada a cambio: la
// columna `resultado` se guardaba siempre NULL y no había ninguna pantalla que
// le contara a la persona qué se dedujo de sus respuestas. Devuelve 204 si
// todavía no hizo el test, que es un estado normal y no un error.
//
// Recalcula el perfil al vuelo cuando la fila guardada no lo tiene: los tests
// contestados antes de que esto existiera se quedaron con `resultado` NULL, y
// obligar a esas personas a repetir 20 preguntas para ver su perfil sería
// cobrarles el haber llegado temprano.
router.get('/yo/perfil-personalidad', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT respuestas, resultado, created_at
         FROM tests_personalidad
        WHERE usuario_id = $1 AND vigente`,
      [req.usuarioId]
    );
    if (!rows[0]) return res.status(204).send();

    const fila = rows[0];
    const perfil = fila.resultado || perfilPersonalidad.construir(fila.respuestas);
    if (!perfil) return res.status(204).send();

    res.json({ ...perfil, respondido_el: fila.created_at });
  } catch (err) {
    next(err);
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
