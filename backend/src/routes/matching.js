const express = require('express');
const db = require('../config/db');
const matching = require('../services/matching');
const programacion = require('../services/programacion');
const runner = require('../services/matchingRunner');

const router = express.Router();

/** Lee las opciones del body/query y las normaliza. */
function leerOpciones(req) {
  const fuente = { ...req.query, ...req.body };
  const noFalse = (v) => v !== false && v !== 'false';
  return {
    agruparPorLocalidad: noFalse(fuente.agrupar_por_localidad),
    // Umbral de afinidad para que una oferta compita: por defecto la mitad
    // del grupo tiene que compartir el interés del plan.
    scoreMinimo: fuente.score_minimo !== undefined ? Number(fuente.score_minimo) : undefined,
    diasVentana: fuente.dias_ventana !== undefined ? Number(fuente.dias_ventana) : undefined,
    horasMinimas: fuente.horas_minimas !== undefined ? Number(fuente.horas_minimas) : undefined,
  };
}

// GET /api/matching — descriptor del algoritmo y estado del pool.
router.get('/', async (req, res, next) => {
  try {
    const candidatos = await runner.cargarCandidatos(db);
    const [ofertas, publicados] = await Promise.all([
      db.query('SELECT count(*)::int AS n FROM v_oferta_comercio'),
      db.query("SELECT count(*)::int AS n FROM v_evento_disponible WHERE fecha_hora > now()"),
    ]);

    res.json({
      algoritmo: 'heuristico_v1',
      descripcion:
        'Dos etapas. (1) Con quién: afinidad = 50% intereses (Jaccard) + 50% coincidencia ' +
        'ponderada del test, agrupando de a 6 por ciudad con un greedy anclado en quien más ' +
        'esperó. (2) Dónde y cuándo: entre los planes de comercios de esa ciudad afines al ' +
        'grupo, gana el de mayor afinidad; el tier comercial solo desempata y la fecha se ' +
        'materializa sobre la primera franja libre del comercio.',
      tamano_grupo: matching.TAMANO_GRUPO,
      pesos_respuestas: matching.PESOS_RESPUESTAS,
      peso_intereses: matching.PESO_INTERESES,
      programacion: {
        score_minimo: programacion.SCORE_MINIMO,
        horas_minimas_anticipacion: programacion.HORAS_MINIMAS_ANTICIPACION,
        dias_ventana: programacion.DIAS_VENTANA,
        zona_horaria: programacion.OFFSET_ZONA,
      },
      disparo_automatico: 'al enviar el test de personalidad (POST /api/usuarios/:id/test-personalidad)',
      candidatos_en_espera: candidatos.length,
      grupos_posibles: Math.floor(candidatos.length / matching.TAMANO_GRUPO),
      planes_de_comercios: ofertas.rows[0].n,
      eventos_publicados_sin_grupo: publicados.rows[0].n,
      endpoints: {
        'GET /api/matching/candidatos': 'pool de usuarios en espera de grupo',
        'GET /api/matching/afinidad?a=<uuid>&b=<uuid>': 'desglose explicable de un par',
        'GET /api/matching/oferta': 'planes y franjas que el algoritmo puede asignar',
        'POST /api/matching/simular': 'corre el algoritmo y hace rollback (dry-run)',
        'POST /api/matching/ejecutar': 'corre el algoritmo y persiste grupos + eventos',
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/matching/candidatos — pool actual.
router.get('/candidatos', async (req, res, next) => {
  try {
    const candidatos = await runner.cargarCandidatos(db);
    res.json({
      total: candidatos.length,
      candidatos: candidatos.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        intereses: c.intereses,
        localidad: c.respuestas?.localidad ?? null,
        esperando_desde: c.esperando_desde,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/matching/oferta — qué puede asignar hoy el algoritmo.
// Sirve para diagnosticar el caso más común de "no me asigna plan": no es que
// el algoritmo falle, es que no hay oferta afín en esa ciudad.
router.get('/oferta', async (req, res, next) => {
  try {
    const oferta = await runner.cargarOferta(db);
    res.json({
      planes: oferta.ofertas.map((o) => ({
        plan_id: o.plan_id,
        comercio: o.comercio_nombre,
        ciudad: o.ciudad,
        tier: o.tier,
        interes: o.interes,
        titulo: o.titulo,
        duracion_min: o.duracion_min,
        precio: o.precio,
        franjas: (oferta.franjasPorComercio.get(o.comercio_id) || []).map((f) => ({
          dia_semana: f.dia_semana,
          hora_inicio: f.hora_inicio,
          hora_fin: f.hora_fin,
          grupos_max: f.grupos_max,
        })),
      })),
      eventos_publicados: oferta.publicados.map((e) => ({
        id: e.id, titulo: e.titulo, comercio: e.comercio_nombre,
        ciudad: e.ciudad, categoria: e.categoria, fecha_hora: e.fecha_hora, tier_nivel: e.nivel_tier,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/matching/afinidad?a=<uuid>&b=<uuid> — explicabilidad de un par.
router.get('/afinidad', async (req, res, next) => {
  try {
    const { a, b } = req.query;
    if (!a || !b) return res.status(400).json({ error: 'Se requieren los parámetros a y b (uuid de usuario).' });

    const { rows } = await db.query(
      `SELECT u.id, u.nombre, t.respuestas,
              COALESCE(array_agg(i.nombre) FILTER (WHERE i.nombre IS NOT NULL), '{}') AS intereses
       FROM usuarios u
       LEFT JOIN tests_personalidad t ON t.usuario_id = u.id AND t.vigente
       LEFT JOIN usuario_intereses ui ON ui.usuario_id = u.id
       LEFT JOIN pa_intereses i ON i.id = ui.interes_id
       WHERE u.id = ANY($1::uuid[]) AND u.deleted_at IS NULL
       GROUP BY u.id, t.respuestas`,
      [[a, b]]
    );
    if (rows.length < 2) return res.status(404).json({ error: 'Alguno de los dos usuarios no existe.' });

    const p1 = rows.find((r) => r.id === a);
    const p2 = rows.find((r) => r.id === b);
    res.json({
      a: { id: p1.id, nombre: p1.nombre },
      b: { id: p2.id, nombre: p2.nombre },
      ...matching.explicarAfinidad(p1, p2),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/matching/simular — corre todo y hace ROLLBACK.
router.post('/simular', async (req, res, next) => {
  try {
    res.json(await runner.ejecutar({ ...leerOpciones(req), simular: true }));
  } catch (err) {
    next(err);
  }
});

// POST /api/matching/programar — busca plan para los grupos que ya están
// completos pero se quedaron sin evento (no había oferta afín cuando se
// formaron). Se dispara solo cuando un comercio publica oferta nueva; el
// endpoint existe para poder forzarlo y para diagnosticar.
router.post('/programar', async (req, res, next) => {
  try {
    const opciones = leerOpciones(req);
    const fuente = { ...req.query, ...req.body };
    res.json(await runner.programarPendientes({ ...opciones, simular: fuente.simular === true }));
  } catch (err) {
    next(err);
  }
});

// POST /api/matching/ejecutar — corre y persiste.
router.post('/ejecutar', async (req, res, next) => {
  try {
    const resultado = await runner.ejecutar(leerOpciones(req));
    res.status(resultado.grupos_creados > 0 ? 201 : 200).json(resultado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
