// ============================================================================
// Orquestador del matching: es el único lugar que junta las piezas puras
// (services/matching.js = con quién, services/programacion.js = dónde y
// cuándo) con la base de datos.
//
// Tiene tres consumidores y por eso vive acá y no dentro de la ruta:
//   - POST /api/matching/ejecutar y /simular (disparo manual)
//   - el disparo automático al completarse un test de personalidad
//   - cualquier job programado que se agregue después
// ============================================================================

const db = require('../config/db');
const matching = require('./matching');
const programacion = require('./programacion');

// Estados de grupo que "ocupan" a un usuario: si ya pertenece a un grupo en
// alguno de ellos, no entra al pool. Los grupos finalizados o cancelados sí
// liberan a sus miembros para una nueva corrida.
const ESTADOS_OCUPADOS = ['formando', 'completo', 'activo'];

// Clave del advisory lock de Postgres que serializa las corridas. Sin esto,
// dos disparos simultáneos (dos usuarios terminando el test a la vez) leerían
// el mismo pool y armarían grupos con la misma gente. Es un lock de sesión
// dentro de la transacción, así que se libera solo al commit o al rollback.
const LOCK_MATCHING = 20260730;

/** Un usuario es candidato si está activo, tiene test vigente y no tiene grupo vivo. */
async function cargarCandidatos(cliente) {
  const { rows } = await cliente.query(
    `SELECT u.id, u.nombre, u.email,
            t.respuestas,
            t.created_at AS esperando_desde,
            COALESCE(array_agg(i.nombre ORDER BY i.nombre)
                     FILTER (WHERE i.nombre IS NOT NULL), '{}') AS intereses
     FROM usuarios u
     JOIN tests_personalidad t ON t.usuario_id = u.id AND t.vigente
     LEFT JOIN usuario_intereses ui ON ui.usuario_id = u.id
     LEFT JOIN pa_intereses i ON i.id = ui.interes_id AND i.activo
     WHERE u.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM grupo_miembros gm
         JOIN grupos g ON g.id = gm.grupo_id
         WHERE gm.usuario_id = u.id AND g.deleted_at IS NULL AND g.estado = ANY($1)
       )
     GROUP BY u.id, t.respuestas, t.created_at
     ORDER BY t.created_at`,
    [ESTADOS_OCUPADOS]
  );
  return rows;
}

/**
 * Pares que no pueden compartir mesa porque alguno bloqueó al otro.
 *
 * Devuelve un Set con las dos direcciones escritas ("a|b" y "b|a") para que
 * formarGrupos() pueda preguntar sin ordenar los ids ni pensar quién bloqueó a
 * quién: el bloqueo es unilateral al declararlo y simétrico al aplicarlo — que
 * A haya bloqueado a B basta para que no se sienten juntos, sin importar qué
 * opine B.
 */
async function cargarIncompatibles(cliente) {
  const { rows } = await cliente.query('SELECT usuario_id, bloqueado_id FROM bloqueos');
  const set = new Set();
  for (const r of rows) {
    set.add(`${r.usuario_id}|${r.bloqueado_id}`);
    set.add(`${r.bloqueado_id}|${r.usuario_id}`);
  }
  return set;
}

/**
 * Carga la oferta del lado comercio. Todo sale de vistas de frontera
 * (migración 002): la API social no tiene permiso sobre `comercios`,
 * `comercio_planes` ni `comercio_disponibilidad`, y no debe tenerlo.
 */
async function cargarOferta(cliente) {
  const [ofertas, franjas, ocupacion, publicados, anfitriones] = await Promise.all([
    cliente.query('SELECT * FROM v_oferta_comercio WHERE capacidad >= $1', [matching.TAMANO_GRUPO]),
    cliente.query('SELECT * FROM v_disponibilidad_comercio'),
    // Ocupación = eventos futuros vivos. Se cuentan también los que ya tienen
    // grupo: son los que consumen el cupo de la franja.
    cliente.query(
      `SELECT comercio_id, fecha_hora FROM eventos
       WHERE deleted_at IS NULL AND estado <> 'cancelado' AND fecha_hora > now()`
    ),
    cliente.query(
      `SELECT * FROM v_evento_disponible WHERE fecha_hora > now() AND capacidad >= $1`,
      [matching.TAMANO_GRUPO]
    ),
    // Un evento necesita anfitrión (NOT NULL en el esquema). Se prefiere el
    // titular; un comercio sin ningún anfitrión no puede recibir grupos.
    cliente.query(
      'SELECT id, comercio_id, titular FROM anfitriones WHERE deleted_at IS NULL ORDER BY titular DESC'
    ),
  ]);

  const anfitrionPorComercio = new Map();
  for (const a of anfitriones.rows) {
    if (!anfitrionPorComercio.has(a.comercio_id)) anfitrionPorComercio.set(a.comercio_id, a.id);
  }

  return {
    ofertas: ofertas.rows.filter((o) => anfitrionPorComercio.has(o.comercio_id)),
    franjasPorComercio: programacion.indexarPorComercio(franjas.rows),
    ocupacionPorComercio: programacion.indexarPorComercio(ocupacion.rows),
    publicados: publicados.rows,
    anfitrionPorComercio,
  };
}

/**
 * Elige el plan de un grupo entre los dos caminos posibles, con el mismo
 * criterio para ambos: afinidad primero, tier del comercio como desempate,
 * fecha más cercana al final.
 *
 *   - 'programado': el comercio declaró un plan + franjas horarias y el
 *     algoritmo materializa la fecha. Es el camino principal.
 *   - 'publicado': el comercio creó a mano un evento con fecha fija desde el
 *     dashboard. Se mantiene porque el dashboard ya funciona así y quitarlo
 *     sería una regresión, pero la afinidad se calcula con el diccionario de
 *     sinónimos de categoría, que es más frágil que el interes_id de un plan.
 */
function elegirPlan(grupo, oferta, opciones) {
  const ciudad = grupo.localidad;

  const programado = programacion.elegirOferta(
    grupo.intereses_agregados,
    oferta.ofertas,
    oferta.franjasPorComercio,
    oferta.ocupacionPorComercio,
    { ...opciones, ciudad }
  );

  const candidatosPublicados = oferta.publicados
    .filter((e) => !ciudad || programacion.normalizarCiudad(e.ciudad) === programacion.normalizarCiudad(ciudad))
    .map((e) => ({
      ...matching.puntuarEvento(grupo.intereses_agregados, e),
      evento: e,
      nivel_tier: e.nivel_tier || 0,
      fecha_hora: new Date(e.fecha_hora),
    }))
    .filter((c) => c.score >= (opciones.scoreMinimo ?? programacion.SCORE_MINIMO));

  const todos = [
    ...(programado ? [{ tipo: 'programado', ...programado }] : []),
    ...candidatosPublicados.map((c) => ({ tipo: 'publicado', ...c })),
  ];
  todos.sort((a, b) => b.score - a.score || b.nivel_tier - a.nivel_tier || a.fecha_hora - b.fecha_hora);
  return todos[0] || null;
}

/** Serialización común a simulación y ejecución. */
function serializarGrupo(grupo, plan) {
  return {
    localidad: grupo.localidad,
    cohesion: Number(grupo.cohesion.toFixed(4)),
    miembros: grupo.miembros.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      intereses: m.intereses,
      afinidad_con_grupo: Number(
        matching.afinidadConGrupo(m, grupo.miembros.filter((o) => o.id !== m.id)).toFixed(4)
      ),
    })),
    intereses_agregados: grupo.intereses_agregados,
    plan: plan
      ? {
          tipo: plan.tipo,
          titulo: plan.tipo === 'programado' ? plan.oferta.titulo : plan.evento.titulo,
          comercio: plan.tipo === 'programado' ? plan.oferta.comercio_nombre : plan.evento.comercio_nombre,
          tier: plan.tipo === 'programado' ? plan.oferta.tier : null,
          nivel_tier: plan.nivel_tier,
          interes: plan.tipo === 'programado' ? plan.oferta.interes : plan.interes,
          fecha_hora: plan.fecha_hora,
          score: Number(plan.score.toFixed(4)),
        }
      : null,
  };
}

/**
 * Corre el algoritmo completo.
 *
 * @param {object} opciones
 * @param {boolean} opciones.simular  si es true, hace ROLLBACK al final y no
 *                                    persiste nada (dry-run real: se ejecuta
 *                                    contra la misma transacción, así que
 *                                    refleja exactamente lo que pasaría).
 */
// Horas de gracia antes de cerrar un grupo cuyo plan ya pasó. Sin margen, un
// grupo que cena a las 19:30 volvería al pool esa misma noche, con la gente
// todavía en la mesa.
const HORAS_GRACIA_CIERRE = 12;

/**
 * Cierra los grupos cuyo plan ya ocurrió y devuelve a sus miembros al pool.
 *
 * Existe porque no existía: `grupos.estado` se escribía para pasar a
 * 'completo' y a 'activo', y nunca a 'finalizado'. Como cargarCandidatos()
 * excluye a quien pertenezca a un grupo vivo, el efecto era que una persona
 * recibía un plan y no volvía a entrar al emparejamiento NUNCA. La app servía
 * una vez y después no hacía nada más, sin fallar ni avisar.
 *
 * Se cierra también el grupo al que le cancelaron su único plan: esos seis
 * quedaban igual de atrapados, y encima sin haber salido.
 *
 * Va en su propia transacción, y a propósito. ejecutar() hace ROLLBACK cuando
 * no junta seis candidatos —que es el caso normal en una ciudad con poca
 * gente—, así que cerrar dentro de esa transacción desharía el cierre justo en
 * las corridas que más lo necesitan.
 *
 * Cerrar un grupo NO borra su historial: la pertenencia (`grupo_miembros`)
 * queda, así que /yo/eventos sigue devolviendo el plan pasado y la valoración
 * sigue disponible. Lo único que cambia es que deja de ser "tu grupo actual".
 */
async function cerrarGruposTerminados() {
  const cliente = await db.pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock($1)', [LOCK_MATCHING]);

    const { rows } = await cliente.query(
      `UPDATE grupos g
          SET estado = 'finalizado'
        WHERE g.estado = 'activo'
          AND g.deleted_at IS NULL
          -- Tiene al menos un evento: un grupo activo sin ninguno es un estado
          -- inconsistente que no se arregla cerrándolo a ciegas.
          AND EXISTS (
            SELECT 1 FROM eventos e
             WHERE e.grupo_id = g.id AND e.deleted_at IS NULL
          )
          -- Y ninguno pendiente: ni futuro, ni dentro de la ventana de gracia.
          AND NOT EXISTS (
            SELECT 1 FROM eventos e
             WHERE e.grupo_id = g.id
               AND e.deleted_at IS NULL
               AND e.estado <> 'cancelado'
               AND e.fecha_hora > now() - ($1::text || ' hours')::interval
          )
        RETURNING g.id`,
      [HORAS_GRACIA_CIERRE]
    );

    await cliente.query('COMMIT');
    return { grupos_cerrados: rows.length, ids: rows.map((r) => r.id) };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

async function ejecutar(opciones = {}) {
  // Antes de leer el pool: quien ya vivió su plan vuelve a estar disponible.
  // Si no se hiciera acá, esa gente no volvería a aparecer como candidata
  // nunca, y el pool se iría vaciando con cada grupo formado.
  const cerrados = await cerrarGruposTerminados();

  const cliente = await db.pool.connect();
  try {
    await cliente.query('BEGIN');
    // Serializa las corridas. Si otra está en curso, esta espera su turno y
    // vuelve a leer el pool ya sin los usuarios que aquella tomó.
    await cliente.query('SELECT pg_advisory_xact_lock($1)', [LOCK_MATCHING]);

    const candidatos = await cargarCandidatos(cliente);
    if (candidatos.length < matching.TAMANO_GRUPO) {
      await cliente.query('ROLLBACK');
      return {
        ejecutado: false,
        motivo: `Se necesitan al menos ${matching.TAMANO_GRUPO} candidatos y hay ${candidatos.length}.`,
        grupos_cerrados: cerrados.grupos_cerrados,
        candidatos: candidatos.length,
        grupos_creados: 0,
        grupos: [],
        en_espera: candidatos.map((c) => ({ id: c.id, nombre: c.nombre, esperando_desde: c.esperando_desde })),
      };
    }

    const oferta = await cargarOferta(cliente);
    const incompatibles = await cargarIncompatibles(cliente);
    const { grupos, sobrantes } = matching.formarGrupos(candidatos, { ...opciones, incompatibles });
    const resultado = [];

    for (const grupo of grupos) {
      const plan = elegirPlan(grupo, oferta, opciones);
      const ids = grupo.miembros.map((m) => m.id);

      // Cerrojo por si acaso: el advisory lock ya serializa las corridas del
      // matching, pero un usuario puede haber sido agregado a un grupo a mano
      // desde /api/grupos/:id/miembros mientras tanto.
      await cliente.query('SELECT id FROM usuarios WHERE id = ANY($1::uuid[]) FOR UPDATE', [ids]);
      const { rows: ocupados } = await cliente.query(
        `SELECT gm.usuario_id FROM grupo_miembros gm
         JOIN grupos g ON g.id = gm.grupo_id
         WHERE gm.usuario_id = ANY($1::uuid[]) AND g.deleted_at IS NULL AND g.estado = ANY($2)`,
        [ids, ESTADOS_OCUPADOS]
      );
      if (ocupados.length > 0) {
        throw new Error('Un candidato fue agregado a otro grupo durante la corrida; reintentá.');
      }

      const nombreGrupo = grupo.intereses_agregados[0]
        ? `Grupo ${grupo.intereses_agregados[0].interes}`
        : 'Grupo Seis Más';
      const { rows: filaGrupo } = await cliente.query(
        `INSERT INTO grupos (nombre, estado) VALUES ($1, 'completo') RETURNING id`,
        [nombreGrupo]
      );
      const grupoId = filaGrupo[0].id;

      for (const [i, miembro] of grupo.miembros.entries()) {
        await cliente.query(
          'INSERT INTO grupo_miembros (grupo_id, usuario_id, rol) VALUES ($1, $2, $3)',
          [grupoId, miembro.id, i === 0 ? 'creador' : 'miembro']
        );
      }

      await cliente.query(
        `INSERT INTO grupo_intereses (grupo_id, interes_id, peso)
         SELECT $1, ui.interes_id, count(*)::int
         FROM usuario_intereses ui
         WHERE ui.usuario_id = ANY($2::uuid[])
         GROUP BY ui.interes_id
         ON CONFLICT (grupo_id, interes_id) DO UPDATE SET peso = EXCLUDED.peso`,
        [grupoId, ids]
      );

      const eventoAsignado = await materializarPlan(cliente, grupoId, plan, oferta);
      if (eventoAsignado) {
        await cliente.query("UPDATE grupos SET estado = 'activo' WHERE id = $1", [grupoId]);
        // El cupo recién consumido tiene que verse en la elección del
        // siguiente grupo de esta misma corrida, o dos grupos caerían en la
        // misma franja de un comercio con grupos_max = 1.
        const lista = oferta.ocupacionPorComercio.get(eventoAsignado.comercio_id) || [];
        lista.push({ comercio_id: eventoAsignado.comercio_id, fecha_hora: eventoAsignado.fecha_hora });
        oferta.ocupacionPorComercio.set(eventoAsignado.comercio_id, lista);
        if (plan.tipo === 'publicado') {
          oferta.publicados = oferta.publicados.filter((e) => e.id !== plan.evento.id);
        }
      }

      resultado.push({
        grupo_id: grupoId,
        nombre: nombreGrupo,
        estado: eventoAsignado ? 'activo' : 'completo',
        ...serializarGrupo(grupo, plan),
        evento: eventoAsignado,
      });
    }

    if (opciones.simular) {
      await cliente.query('ROLLBACK');
    } else {
      await cliente.query('COMMIT');
    }

    return {
      ejecutado: !opciones.simular,
      simulacion: !!opciones.simular,
      grupos_cerrados: cerrados.grupos_cerrados,
      candidatos: candidatos.length,
      grupos_creados: opciones.simular ? 0 : resultado.length,
      grupos_propuestos: resultado.length,
      sin_grupo: sobrantes.length,
      // En simulación los ids se generaron dentro de la transacción que acaba
      // de hacer ROLLBACK: no existen en la base. Se quitan para que nadie
      // los guarde ni los use como referencia.
      grupos: opciones.simular
        ? resultado.map(({ grupo_id, evento, ...resto }) => resto)
        : resultado,
      en_espera: sobrantes.map((s) => ({ id: s.id, nombre: s.nombre, esperando_desde: s.esperando_desde })),
    };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

/** Crea (o enlaza) el evento del grupo según el tipo de plan elegido. */
async function materializarPlan(cliente, grupoId, plan, oferta) {
  if (!plan) return null;

  if (plan.tipo === 'publicado') {
    const { rows } = await cliente.query(
      `UPDATE eventos SET grupo_id = $1, estado = 'confirmado'
       WHERE id = $2 AND grupo_id IS NULL AND deleted_at IS NULL
       RETURNING id, comercio_id, titulo, fecha_hora, estado`,
      [grupoId, plan.evento.id]
    );
    return rows[0] ? { ...rows[0], origen: 'comercio', interes: plan.interes, score: plan.score } : null;
  }

  // 'programado': el evento no existía; lo crea el matching a partir del plan
  // del comercio y la franja elegida.
  const anfitrionId = oferta.anfitrionPorComercio.get(plan.oferta.comercio_id);
  if (!anfitrionId) return null;

  const { rows } = await cliente.query(
    `INSERT INTO eventos
       (comercio_id, anfitrion_id, grupo_id, titulo, descripcion, categoria,
        fecha_hora, capacidad, precio, estado, origen, comercio_plan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmado', 'matching', $10)
     RETURNING id, comercio_id, titulo, fecha_hora, estado`,
    [
      plan.oferta.comercio_id,
      anfitrionId,
      grupoId,
      plan.oferta.titulo,
      plan.oferta.descripcion,
      plan.oferta.interes,
      plan.fecha_hora,
      plan.oferta.capacidad,
      plan.oferta.precio,
      plan.oferta.plan_id,
    ]
  );
  return { ...rows[0], origen: 'matching', interes: plan.oferta.interes, score: plan.score, tier: plan.oferta.tier };
}

/**
 * Segunda mitad del ciclo: grupos que ya están completos pero se quedaron sin
 * plan porque cuando se formaron no había oferta afín en su ciudad.
 *
 * Sin esto, la promesa que el dashboard le hace al comercio ("publica tu
 * disponibilidad y Seis Más te asigna un grupo") sería falsa para todo grupo
 * formado antes de que ese comercio entrara. Se dispara cuando aparece oferta
 * nueva: un plan, una franja o un evento publicado.
 */
async function programarPendientes(opciones = {}) {
  const cliente = await db.pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock($1)', [LOCK_MATCHING]);

    // Dos condiciones que parecen obvias y no lo son:
    //
    //  - `HAVING count(*) = TAMANO_GRUPO`: un grupo puede estar en estado
    //    'completo' sin tener 6 miembros (lo dejó así una carga manual, o se
    //    eliminó un miembro después). Sin esto se le asignaría un plan de 6
    //    personas a un grupo de 2.
    //  - localidad NOT NULL: si ningún miembro tiene test vigente no hay
    //    ciudad, y más abajo un `ciudad` nulo desactiva el filtro geográfico
    //    y haría competir a comercios de cualquier ciudad. Preferimos no
    //    programar antes que programar en la ciudad equivocada.
    const { rows: pendientes } = await cliente.query(
      `SELECT g.id, g.nombre,
              (SELECT mode() WITHIN GROUP (ORDER BY t.respuestas->>'localidad')
                 FROM grupo_miembros gm2
                 JOIN tests_personalidad t ON t.usuario_id = gm2.usuario_id AND t.vigente
                WHERE gm2.grupo_id = g.id) AS localidad
       FROM grupos g
       JOIN grupo_miembros gm ON gm.grupo_id = g.id
       WHERE g.deleted_at IS NULL
         AND g.estado = 'completo'
         AND NOT EXISTS (
           SELECT 1 FROM eventos e
           WHERE e.grupo_id = g.id AND e.deleted_at IS NULL AND e.estado <> 'cancelado'
         )
       GROUP BY g.id, g.nombre, g.created_at
       HAVING count(gm.usuario_id) = $1
       ORDER BY g.created_at`,
      [matching.TAMANO_GRUPO]
    );

    if (pendientes.length === 0) {
      await cliente.query('ROLLBACK');
      return { grupos_pendientes: 0, programados: 0, grupos: [] };
    }

    const oferta = await cargarOferta(cliente);
    const programados = [];

    for (const pendiente of pendientes) {
      if (!pendiente.localidad) continue; // ver nota arriba: sin ciudad no se programa

      const { rows: intereses } = await cliente.query(
        `SELECT i.nombre AS interes, gi.peso
         FROM grupo_intereses gi JOIN pa_intereses i ON i.id = gi.interes_id
         WHERE gi.grupo_id = $1 ORDER BY gi.peso DESC`,
        [pendiente.id]
      );

      const grupo = { localidad: pendiente.localidad, intereses_agregados: intereses };
      const plan = elegirPlan(grupo, oferta, opciones);
      if (!plan) continue;

      const evento = await materializarPlan(cliente, pendiente.id, plan, oferta);
      if (!evento) continue;

      await cliente.query("UPDATE grupos SET estado = 'activo' WHERE id = $1", [pendiente.id]);
      const lista = oferta.ocupacionPorComercio.get(evento.comercio_id) || [];
      lista.push({ comercio_id: evento.comercio_id, fecha_hora: evento.fecha_hora });
      oferta.ocupacionPorComercio.set(evento.comercio_id, lista);
      if (plan.tipo === 'publicado') {
        oferta.publicados = oferta.publicados.filter((e) => e.id !== plan.evento.id);
      }

      programados.push({ grupo_id: pendiente.id, nombre: pendiente.nombre, evento });
    }

    if (opciones.simular) await cliente.query('ROLLBACK');
    else await cliente.query('COMMIT');

    return {
      grupos_pendientes: pendientes.length,
      programados: programados.length,
      grupos: opciones.simular ? programados.map(({ evento, ...r }) => r) : programados,
    };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

/**
 * Disparo automático, pensado para llamarse después de responder al cliente.
 *
 * Nunca lanza: si el matching falla, el usuario ya guardó su test y su
 * request fue exitoso; el error se loguea y la siguiente corrida lo reintenta
 * sola. Que un fallo del matching devuelva un 500 en el POST del test sería
 * confundir dos cosas distintas para el usuario.
 */
function dispararEnSegundoPlano(motivo, opciones = {}) {
  setImmediate(async () => {
    try {
      const r = await ejecutar(opciones);
      if (r.grupos_creados > 0) {
        console.log(`[matching] ${motivo}: ${r.grupos_creados} grupo(s) creado(s), ${r.sin_grupo} en espera.`);
      } else {
        console.log(`[matching] ${motivo}: sin grupos nuevos (${r.motivo || `${r.candidatos} candidatos`}).`);
      }
    } catch (err) {
      console.error(`[matching] ${motivo}: falló la corrida —`, err.message);
    }
  });
}

/** Igual que el anterior, pero para el ciclo de "grupos completos sin plan". */
function programarEnSegundoPlano(motivo, opciones = {}) {
  setImmediate(async () => {
    try {
      const r = await programarPendientes(opciones);
      if (r.programados > 0) {
        console.log(`[matching] ${motivo}: ${r.programados} grupo(s) recibieron plan.`);
      }
    } catch (err) {
      console.error(`[matching] ${motivo}: falló la programación —`, err.message);
    }
  });
}

module.exports = {
  ESTADOS_OCUPADOS,
  cargarCandidatos,
  cargarIncompatibles,
  cerrarGruposTerminados,
  HORAS_GRACIA_CIERRE,
  cargarOferta,
  elegirPlan,
  ejecutar,
  programarPendientes,
  dispararEnSegundoPlano,
  programarEnSegundoPlano,
};
