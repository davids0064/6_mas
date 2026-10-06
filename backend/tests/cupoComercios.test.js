// Cupo de la afiliación de comercios. Necesita Postgres.
//
//   cd backend && npm test
//
// Un comercio paga un tier y eso le da N grupos al mes. Si el cupo no se
// respeta, el modelo de negocio no existe: todos reciben lo mismo pague quien
// pague. Y si se respeta mal —cobrando de más, o cortando a quien sí pagó— el
// daño es peor que no tenerlo.
const test = require('node:test');
const assert = require('node:assert');

const db = require('../src/config/db');

const creados = { comercios: [], suscripciones: [], eventos: [] };

async function comercioNuevo(tier = 'bronce') {
  const { rows } = await db.query(
    `INSERT INTO comercios (nombre, email, ciudad, activo, plan_id)
     VALUES ('Prueba Cupo', $1, 'Pereira', TRUE,
             (SELECT id FROM pa_planes_comercio WHERE nombre = $2))
     RETURNING id`,
    [`cupo.${Math.random()}@ejemplo.invalid`, tier]
  );
  creados.comercios.push(rows[0].id);
  return rows[0].id;
}

async function suscribir(comercioId, { grupos, dias = 30, estado = 'activa', desde = 0 } = {}) {
  const { rows } = await db.query(
    `INSERT INTO comercio_suscripciones
       (comercio_id, plan_id, grupos_mes, inicio, fin, estado, cancelada_at)
     VALUES ($1, (SELECT id FROM pa_planes_comercio WHERE nombre = 'bronce'), $2,
             -- Los días van casteados: sin el ::int, Postgres no sabe de qué
             -- tipo es el parámetro y falla con "operator is not unique".
             current_date + $3::int, current_date + $3::int + $4::int, $5,
             CASE WHEN $5 = 'cancelada' THEN now() END)
     RETURNING id`,
    [comercioId, grupos, desde, dias, estado]
  );
  creados.suscripciones.push(rows[0].id);
  return rows[0].id;
}

/** Un evento con grupo asignado, en `dias` días desde hoy. */
async function cenaAsignada(comercioId, dias, estado = 'confirmado') {
  const { rows: g } = await db.query("INSERT INTO grupos (estado) VALUES ('activo') RETURNING id");
  const { rows: a } = await db.query(
    `INSERT INTO anfitriones (comercio_id, nombre, email)
     VALUES ($1, 'Anfitrión', $2) RETURNING id`,
    [comercioId, `anf.${Math.random()}@ejemplo.invalid`]
  );
  const { rows } = await db.query(
    `INSERT INTO eventos (comercio_id, anfitrion_id, grupo_id, titulo, fecha_hora, estado)
     VALUES ($1, $2, $3, 'Cena de prueba', now() + ($4 || ' days')::interval, $5)
     RETURNING id`,
    [comercioId, a[0].id, g[0].id, String(dias), estado]
  );
  creados.eventos.push(rows[0].id);
  return rows[0].id;
}

const cupoDe = async (comercioId) =>
  (await db.query('SELECT * FROM v_cupo_comercio WHERE comercio_id = $1', [comercioId])).rows[0];

test.after(async () => {
  if (creados.comercios.length) {
    await db.query('DELETE FROM comercios WHERE id = ANY($1)', [creados.comercios]);
  }
  await db.query("DELETE FROM grupos WHERE nombre IS NULL AND estado = 'activo' AND NOT EXISTS (SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = grupos.id)");
  await db.pool.end();
});

test('una suscripción activa da su cupo completo', async () => {
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2 });
  const cupo = await cupoDe(c);
  assert.strictEqual(cupo.grupos_mes, 2);
  assert.strictEqual(Number(cupo.grupos_usados), 0);
  assert.strictEqual(Number(cupo.grupos_disponibles), 2);
});

test('cada cena asignada consume cupo', async () => {
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2 });
  await cenaAsignada(c, 5);
  assert.strictEqual(Number((await cupoDe(c)).grupos_disponibles), 1);
  await cenaAsignada(c, 7);
  assert.strictEqual(Number((await cupoDe(c)).grupos_disponibles), 0);
});

test('una cena cancelada no gasta cupo', async () => {
  // Un grupo que no llegó a ir no le consumió nada al comercio.
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2 });
  await cenaAsignada(c, 5, 'cancelado');
  assert.strictEqual(Number((await cupoDe(c)).grupos_disponibles), 2);
});

test('una cena FUERA del periodo no gasta cupo', async () => {
  // El cupo cuenta por la fecha de la cena: una del mes que viene pertenece al
  // periodo que viene, aunque el sistema la haya asignado hoy.
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2, dias: 10 });
  await cenaAsignada(c, 40);
  assert.strictEqual(Number((await cupoDe(c)).grupos_disponibles), 2);
});

test('un comercio sin suscripción no aparece con cupo', async () => {
  const c = await comercioNuevo();
  assert.strictEqual(await cupoDe(c), undefined, 'sin suscripción no hay fila de cupo');
});

test('una suscripción vencida o cancelada no da cupo', async () => {
  for (const estado of ['vencida', 'cancelada']) {
    const c = await comercioNuevo();
    await suscribir(c, { grupos: 2, estado });
    assert.strictEqual(await cupoDe(c), undefined, `estado ${estado} no debería dar cupo`);
  }
});

test('una suscripción futura todavía no da cupo', async () => {
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2, desde: 10 });
  assert.strictEqual(await cupoDe(c), undefined);
});

test('el cupo contratado no cambia si cambia el del tier', async () => {
  // Lo que se vendió se queda como se vendió: subir bronce de 2 a 3 no puede
  // regalarle un grupo a quien ya está pagando por 2, ni quitárselo.
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2 });
  await db.query("UPDATE pa_planes_comercio SET grupos_mes = 99 WHERE nombre = 'bronce'");
  try {
    assert.strictEqual((await cupoDe(c)).grupos_mes, 2);
  } finally {
    await db.query("UPDATE pa_planes_comercio SET grupos_mes = 2 WHERE nombre = 'bronce'");
  }
});

test('no se pueden solapar dos periodos vivos del mismo comercio', async () => {
  // Es la garantía de que el cupo no se cuente dos veces.
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2, dias: 30 });
  await assert.rejects(
    () => suscribir(c, { grupos: 4, dias: 30, desde: 5 }),
    /exclusion constraint/i
  );
});

test('sí se puede dejar contratado el periodo siguiente', async () => {
  // Renovar por adelantado tiene que funcionar: es una fila nueva que empieza
  // cuando acaba la anterior.
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2, dias: 30 });
  await assert.doesNotReject(() => suscribir(c, { grupos: 4, dias: 30, desde: 31 }));
});
