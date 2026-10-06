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

// Sufijo de la corrida. El índice único sobre `comercio_pagos.referencia` es
// global, así que una referencia constante dejaría la segunda ejecución
// fallando por el residuo de la primera.
const SUF = Date.now();

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
    // Los pagos van primero: comercio_pagos referencia a las suscripciones con
    // ON DELETE RESTRICT, así que borrar el comercio en cascada choca contra
    // ellos. Y está bien que choque — un registro contable no debería
    // desaparecer porque alguien borró una fila de otra tabla— pero la limpieza
    // de las pruebas tiene que respetarlo.
    await db.query(
      `DELETE FROM comercio_pagos
        WHERE suscripcion_id IN (
          SELECT id FROM comercio_suscripciones WHERE comercio_id = ANY($1)
        )`,
      [creados.comercios]
    );
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


// ============================================================================
// Vencimiento (migración 009).
//
// La propiedad que estas pruebas protegen no es "el trabajo marca las filas",
// sino la contraria: que NO haga falta que corra. Un proceso nocturno que falle
// un día no puede dejar al sistema mandando grupos a quien ya no paga.
// ============================================================================

const estadoDe = async (suscripcionId) =>
  (await db.query('SELECT * FROM v_suscripcion_estado WHERE id = $1', [suscripcionId])).rows[0];

test('una suscripción caducada no da cupo AUNQUE nadie haya corrido el trabajo', async () => {
  // Es la garantía que sostiene todo lo demás: la corrección vive en la vista,
  // no en que algo se ejecute a las 3 de la mañana.
  const c = await comercioNuevo();
  const s = await suscribir(c, { grupos: 2, dias: 10, desde: -40 });

  const estado = await estadoDe(s);
  assert.strictEqual(estado.estado, 'activa', 'el estado guardado todavía miente');
  assert.strictEqual(estado.estado_efectivo, 'vencida', 'pero el efectivo ya es el correcto');
  assert.strictEqual(await cupoDe(c), undefined, 'y no da cupo');
});

test('el estado efectivo distingue futura, vigente y vencida', async () => {
  const casos = [
    [{ desde: 10, dias: 20 }, 'futura'],
    [{ desde: 0, dias: 20 }, 'vigente'],
    [{ desde: -40, dias: 10 }, 'vencida'],
  ];
  for (const [opciones, esperado] of casos) {
    const c = await comercioNuevo();
    const s = await suscribir(c, { grupos: 2, ...opciones });
    assert.strictEqual((await estadoDe(s)).estado_efectivo, esperado);
  }
});

test('cancelada gana sobre las fechas', async () => {
  // Darse de baja el día 3 no deja a nadie vigente hasta el 30.
  const c = await comercioNuevo();
  const s = await suscribir(c, { grupos: 2, dias: 30, estado: 'cancelada' });
  assert.strictEqual((await estadoDe(s)).estado_efectivo, 'cancelada');
});

test('el trabajo marca lo vencido y es idempotente', async () => {
  const c = await comercioNuevo();
  const s = await suscribir(c, { grupos: 2, dias: 10, desde: -40 });

  const { rows: primera } = await db.query('SELECT vencer_suscripciones() AS n');
  assert.ok(Number(primera[0].n) >= 1);
  assert.strictEqual((await estadoDe(s)).estado, 'vencida');

  const { rows: segunda } = await db.query('SELECT vencer_suscripciones() AS n');
  assert.strictEqual(Number(segunda[0].n), 0, 'la segunda corrida no toca nada');
});

test('el trabajo no pisa las canceladas', async () => {
  // Tienen un estado terminal puesto a mano y una fecha de cancelación que no
  // hay que perder.
  const c = await comercioNuevo();
  const s = await suscribir(c, { grupos: 2, dias: 10, desde: -40, estado: 'cancelada' });
  await db.query('SELECT vencer_suscripciones()');
  const fila = await estadoDe(s);
  assert.strictEqual(fila.estado, 'cancelada');
  assert.ok(fila.cancelada_at, 'conserva cuándo se canceló');
});

test('tras correr el trabajo no queda nada pendiente de vencer', async () => {
  const c = await comercioNuevo();
  await suscribir(c, { grupos: 2, dias: 10, desde: -40 });
  await db.query('SELECT vencer_suscripciones()');
  const { rows } = await db.query(
    'SELECT count(*)::int AS n FROM v_suscripcion_estado WHERE pendiente_de_vencer'
  );
  assert.strictEqual(rows[0].n, 0);
});


// ============================================================================
// Alta y renovación (migración 010).
//
// Las referencias llevan el sufijo de la corrida: el índice único sobre
// `referencia` es global, así que una constante dejaría la segunda ejecución
// fallando por el residuo de la primera.
//
// El cobro va por transferencia y lo registra una persona. Si esa persona tiene
// que escribir el INSERT a mano, antes o después se equivoca en el cupo o en
// las fechas, y el comercio recibe de más o de menos sin que nadie lo note.
// ============================================================================

const activar = async (comercioId, plan, meses = 1, monto = null, ref = null) =>
  (
    await db.query('SELECT * FROM activar_suscripcion($1, $2, $3, $4, $5, $6)', [
      comercioId, plan, meses, monto, ref, 'prueba',
    ])
  ).rows[0];

test('activar congela el cupo del tier y calcula el periodo', async () => {
  const c = await comercioNuevo();
  const r = await activar(c, 'plata', 1);
  assert.strictEqual(r.cupo, 4, 'plata son 4 grupos');
  // `fin` es inclusivo: un mes desde hoy llega a la víspera, no al mismo día.
  const dias = Math.round((new Date(r.hasta) - new Date(r.desde)) / 86400000);
  assert.ok(dias >= 27 && dias <= 30, `el periodo dura ${dias} días`);
});

test('renovar encadena sin huecos ni solapes', async () => {
  const c = await comercioNuevo();
  const primera = await activar(c, 'bronce', 1);
  const segunda = await activar(c, 'gold', 2);

  const siguiente = new Date(primera.hasta);
  siguiente.setDate(siguiente.getDate() + 1);
  assert.strictEqual(
    new Date(segunda.desde).toISOString().slice(0, 10),
    siguiente.toISOString().slice(0, 10),
    'el periodo nuevo empieza al día siguiente del anterior'
  );
  assert.strictEqual(segunda.cupo, 6, 'y con el cupo del plan nuevo');
});

test('el pago queda registrado en la misma transacción', async () => {
  const c = await comercioNuevo();
  const r = await activar(c, 'bronce', 1, 150000, `TRF-${SUF}-1`);
  const { rows } = await db.query('SELECT * FROM comercio_pagos WHERE suscripcion_id = $1', [
    r.id_suscripcion,
  ]);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(Number(rows[0].monto), 150000);
  assert.strictEqual(rows[0].metodo, 'transferencia');
});

test('sin monto no se inventa un pago', async () => {
  // Activar de cortesía no puede dejar un cobro fantasma en la contabilidad.
  const c = await comercioNuevo();
  const r = await activar(c, 'bronce', 1);
  const { rows } = await db.query(
    'SELECT count(*)::int AS n FROM comercio_pagos WHERE suscripcion_id = $1',
    [r.id_suscripcion]
  );
  assert.strictEqual(rows[0].n, 0);
});

test('un plan que no existe falla diciendo cuáles hay', async () => {
  const c = await comercioNuevo();
  await assert.rejects(() => activar(c, 'diamante', 1), /No existe el plan.*bronce/s);
});

test('no se puede activar un comercio que no existe', async () => {
  await assert.rejects(
    () => activar('00000000-0000-4000-8000-000000000000', 'bronce', 1),
    /No existe el comercio/
  );
});

test('la misma referencia de transferencia no se registra dos veces', async () => {
  // Protege del error más caro al registrar a mano: cobrar dos veces el mismo
  // pago porque alguien dudó de si ya lo había metido.
  const c = await comercioNuevo();
  await activar(c, 'bronce', 1, 150000, `TRF-${SUF}-rep`);
  const otro = await comercioNuevo();
  await assert.rejects(
    () => activar(otro, 'bronce', 1, 150000, `TRF-${SUF}-rep`),
    /duplicate key/i
  );
});
