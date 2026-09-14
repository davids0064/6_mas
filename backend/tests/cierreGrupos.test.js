// Prueba de integración del cierre de grupos: necesita Postgres.
//
// Existe por un fallo que no daba ningún síntoma: nada ponía nunca un grupo en
// 'finalizado', así que quien recibía un plan quedaba excluido del pool de
// emparejamiento para siempre. La app no fallaba — simplemente no volvía a
// pasar nada nunca más. Un fallo mudo necesita una prueba que hable.
const test = require('node:test');
const assert = require('node:assert');

const db = require('../src/config/db');
const runner = require('../src/services/matchingRunner');

const SUF = Date.now();
const ids = {};

async function sembrar({ fechaEvento, estadoEvento = 'finalizado' }) {
  const { rows: u } = await db.query(
    `INSERT INTO usuarios (email, password_hash, nombre, fecha_nacimiento)
     VALUES ($1, 'x', 'Prueba Cierre', '1990-01-01') RETURNING id`,
    [`cierre.${SUF}.${Math.random()}@ejemplo.invalid`]
  );
  const usuarioId = u[0].id;
  await db.query(
    `INSERT INTO tests_personalidad (usuario_id, respuestas, vigente)
     VALUES ($1, '{"localidad":"pereira"}'::jsonb, TRUE)`,
    [usuarioId]
  );
  const { rows: g } = await db.query(
    "INSERT INTO grupos (nombre, estado) VALUES ('Grupo de prueba', 'activo') RETURNING id"
  );
  const grupoId = g[0].id;
  await db.query('INSERT INTO grupo_miembros (grupo_id, usuario_id) VALUES ($1, $2)', [grupoId, usuarioId]);

  if (fechaEvento) {
    // `fechaEvento` se interpola y no va como parámetro: es una EXPRESIÓN SQL
    // ("now() - interval '3 days'"), y como bind parameter Postgres la recibe
    // como el texto literal y falla al convertirlo a timestamp. Los valores son
    // constantes de este archivo, no entrada de nadie.
    await db.query(
      `INSERT INTO eventos (comercio_id, anfitrion_id, grupo_id, titulo, fecha_hora, estado)
       VALUES ('ded00000-0000-4000-8000-000000000020',
               'ded00000-0000-4000-8000-000000000021',
               $1, 'Evento de prueba', ${fechaEvento}, $2)`,
      [grupoId, estadoEvento]
    );
  }
  return { usuarioId, grupoId };
}

const estadoDe = async (grupoId) =>
  (await db.query('SELECT estado FROM grupos WHERE id = $1', [grupoId])).rows[0].estado;

const esCandidato = async (usuarioId) => {
  const cliente = await db.pool.connect();
  try {
    const candidatos = await runner.cargarCandidatos(cliente);
    return candidatos.some((c) => c.id === usuarioId);
  } finally {
    cliente.release();
  }
};

test('el grupo cuyo plan ya pasó se cierra y su gente vuelve al pool', async () => {
  const { usuarioId, grupoId } = await sembrar({ fechaEvento: "now() - interval '3 days'" });
  ids.a = grupoId;

  assert.strictEqual(await esCandidato(usuarioId), false, 'con grupo activo NO es candidato');
  await runner.cerrarGruposTerminados();
  assert.strictEqual(await estadoDe(grupoId), 'finalizado');
  assert.strictEqual(await esCandidato(usuarioId), true, 'tras cerrarse, vuelve a serlo');
});

test('un plan futuro no cierra el grupo', async () => {
  const { usuarioId, grupoId } = await sembrar({ fechaEvento: "now() + interval '5 days'", estadoEvento: 'confirmado' });
  ids.b = grupoId;
  await runner.cerrarGruposTerminados();
  assert.strictEqual(await estadoDe(grupoId), 'activo');
  assert.strictEqual(await esCandidato(usuarioId), false);
});

test('dentro de las horas de gracia todavía no se cierra', async () => {
  // El plan fue hace 2 horas: la gente puede seguir en la mesa.
  const { grupoId } = await sembrar({ fechaEvento: "now() - interval '2 hours'" });
  ids.c = grupoId;
  await runner.cerrarGruposTerminados();
  assert.strictEqual(await estadoDe(grupoId), 'activo');
});

test('el grupo al que le cancelaron su único plan también se libera', async () => {
  // Si no, esos seis quedan atrapados sin haber salido siquiera.
  const { usuarioId, grupoId } = await sembrar({
    fechaEvento: "now() + interval '5 days'",
    estadoEvento: 'cancelado',
  });
  ids.d = grupoId;
  await runner.cerrarGruposTerminados();
  assert.strictEqual(await estadoDe(grupoId), 'finalizado');
  assert.strictEqual(await esCandidato(usuarioId), true);
});

test('un grupo activo sin ningún evento no se toca', async () => {
  const { grupoId } = await sembrar({ fechaEvento: null });
  ids.e = grupoId;
  await runner.cerrarGruposTerminados();
  assert.strictEqual(await estadoDe(grupoId), 'activo', 'cerrarlo a ciegas perdería el grupo');
});

test('cerrar no borra el historial: el plan pasado se sigue viendo', async () => {
  const { usuarioId, grupoId } = await sembrar({ fechaEvento: "now() - interval '3 days'" });
  ids.f = grupoId;
  await runner.cerrarGruposTerminados();
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM eventos e
       JOIN grupo_miembros gm ON gm.grupo_id = e.grupo_id
      WHERE gm.usuario_id = $1`,
    [usuarioId]
  );
  assert.strictEqual(rows[0].n, 1, 'la pertenencia al grupo sobrevive al cierre');
});

test.after(async () => {
  await db.query('DELETE FROM grupos WHERE id = ANY($1)', [Object.values(ids)]);
  await db.query("DELETE FROM usuarios WHERE nombre = 'Prueba Cierre'");
  await db.pool.end();
});
