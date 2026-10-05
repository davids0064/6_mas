// El test de personalidad se responde UNA sola vez. Necesita Postgres.
//
//   cd backend && npm test
//
// La app lo advierte antes de empezar y no ofrece repetirlo, pero eso es la
// interfaz. La regla vive acá: es el dato con el que se decide con quién se
// sienta cada persona, y si se pudiera rehacer bastaría con reintentarlo hasta
// caer en un grupo que guste — el emparejamiento dejaría de medir afinidad para
// medir insistencia.
const test = require('node:test');
const assert = require('node:assert');

const db = require('../src/config/db');

const SUF = `una-vez-${Date.now()}`;
const creados = [];

async function usuarioNuevo() {
  const { rows } = await db.query(
    `INSERT INTO usuarios (email, password_hash, nombre, fecha_nacimiento)
     VALUES ($1, 'x', 'Prueba Una Vez', '1990-01-01') RETURNING id`,
    [`${SUF}.${Math.random()}@ejemplo.invalid`]
  );
  creados.push(rows[0].id);
  return rows[0].id;
}

// Replica lo que hace la ruta: mira si ya hay test vigente y, si lo hay, no
// inserta. Se prueba contra la base y no por HTTP para no levantar el servidor.
async function intentarResponder(usuarioId, respuestas) {
  const cliente = await db.pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: previos } = await cliente.query(
      'SELECT id FROM tests_personalidad WHERE usuario_id = $1 AND vigente FOR UPDATE',
      [usuarioId]
    );
    if (previos[0]) {
      await cliente.query('ROLLBACK');
      return { ok: false, estado: 409 };
    }
    await cliente.query(
      `INSERT INTO tests_personalidad (usuario_id, respuestas, vigente)
       VALUES ($1, $2::jsonb, TRUE)`,
      [usuarioId, JSON.stringify(respuestas)]
    );
    await cliente.query('COMMIT');
    return { ok: true, estado: 201 };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

test.after(async () => {
  if (creados.length) await db.query('DELETE FROM usuarios WHERE id = ANY($1)', [creados]);
  await db.pool.end();
});

test('el primer envío se acepta', async () => {
  const id = await usuarioNuevo();
  assert.strictEqual((await intentarResponder(id, { localidad: 'pereira' })).estado, 201);
});

test('el segundo se rechaza con 409', async () => {
  const id = await usuarioNuevo();
  await intentarResponder(id, { localidad: 'pereira' });
  assert.strictEqual((await intentarResponder(id, { localidad: 'manizales' })).estado, 409);
});

test('el rechazo no pisa las respuestas que ya estaban', async () => {
  // Lo que no puede pasar: que un segundo intento falle PERO deje el test a
  // medias o con las respuestas nuevas. La persona se quedaría con un perfil
  // que no es el suyo.
  const id = await usuarioNuevo();
  await intentarResponder(id, { localidad: 'pereira', temperamento: 'introvertido' });
  await intentarResponder(id, { localidad: 'manizales', temperamento: 'extrovertido' });

  const { rows } = await db.query(
    'SELECT respuestas FROM tests_personalidad WHERE usuario_id = $1 AND vigente',
    [id]
  );
  assert.strictEqual(rows.length, 1, 'sigue habiendo exactamente un test vigente');
  assert.strictEqual(rows[0].respuestas.localidad, 'pereira');
  assert.strictEqual(rows[0].respuestas.temperamento, 'introvertido');
});

test('dos envíos simultáneos no crean dos tests', async () => {
  // Un doble toque con la red lenta. Sin el FOR UPDATE los dos leerían que no
  // hay test previo; con él, el segundo espera y encuentra el del primero.
  const id = await usuarioNuevo();
  const resultados = await Promise.all([
    intentarResponder(id, { localidad: 'pereira' }),
    intentarResponder(id, { localidad: 'pereira' }),
  ]);

  assert.strictEqual(resultados.filter((r) => r.ok).length, 1, 'solo uno entra');
  const { rows } = await db.query(
    'SELECT count(*)::int AS n FROM tests_personalidad WHERE usuario_id = $1',
    [id]
  );
  assert.strictEqual(rows[0].n, 1);
});

test('cada persona puede hacer el suyo', async () => {
  // El bloqueo es por usuario, no global: que alguien esté respondiendo no
  // puede impedir que otro responda.
  const a = await usuarioNuevo();
  const b = await usuarioNuevo();
  const [ra, rb] = await Promise.all([
    intentarResponder(a, { localidad: 'pereira' }),
    intentarResponder(b, { localidad: 'pereira' }),
  ]);
  assert.ok(ra.ok && rb.ok);
});
