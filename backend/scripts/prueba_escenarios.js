#!/usr/bin/env node
/**
 * Escenarios end-to-end del matching que `prueba_match.js` no cubre.
 *
 * Aquel prueba el camino feliz completo (oferta → registro → grupo → plan →
 * rescate). Este prueba los bordes, que es donde un despliegue duele:
 *
 *   A. Concurrencia: 12 tests de personalidad enviados al mismo tiempo no
 *      pueden producir grupos con la misma gente ni grupos de 5 o de 7.
 *   B. Cupo del comercio: cuando la agenda se llena, los grupos de más quedan
 *      sin plan en vez de sobrevender la franja.
 *   C. Simulación: /api/matching/simular no puede persistir nada.
 *   D. Pool: quien ya tiene grupo vivo no vuelve a entrar al pool.
 *   E. Autorización: sin token, sin clave, o con datos de otro → cerrado.
 *   F. Feedback: solo lo valora quien fue, una sola vez, con rating válido.
 *   G. Lo que ve la app: /yo/grupo y /yo/eventos.
 *
 * Uso:
 *   node backend/scripts/prueba_escenarios.js            # deja los datos
 *   node backend/scripts/prueba_escenarios.js --limpiar  # los borra al terminar
 *
 * Contra una base de pruebas (recomendado antes de desplegar):
 *   DATABASE_URL=postgres://…/seis_mas_test API_URL=http://localhost:3010 \
 *     node backend/scripts/prueba_escenarios.js --limpiar
 */

require('dotenv').config({ path: `${__dirname}/../.env` });

const API = process.env.API_URL || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;
if (!ADMIN_KEY) {
  console.error('Falta ADMIN_API_KEY en backend/.env.');
  process.exit(1);
}

const PREFIJO = 'prueba-esc-';
const MARCA = '[prueba escenarios]';
const LIMPIAR_AL_FINAL = process.argv.includes('--limpiar');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const programacion = require('../src/services/programacion');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

async function pedir(metodo, ruta, cuerpo, token, cabeceras = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : { 'X-Admin-Key': ADMIN_KEY }),
      ...cabeceras,
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  return { ok: res.ok, status: res.status, datos };
}

/** Petición cruda: sin token y sin clave de administración. */
async function pedirAnonimo(metodo, ruta, cuerpo) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: res.status, datos: await res.json().catch(() => null) };
}

const checks = [];
function verificar(condicion, descripcion) {
  checks.push({ ok: !!condicion, descripcion });
  return !!condicion;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarA(condicion, ms = 8000) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const valor = await condicion();
    if (valor) return valor;
    await esperar(200);
  }
  return null;
}

/** Espera a que no queden corridas de matching en vuelo (pool estabilizado). */
async function esperarQuietud(ms = 1500) {
  let anterior = null;
  const limite = Date.now() + 15000;
  while (Date.now() < limite) {
    const g = (await pedir('GET', '/api/grupos')).datos.length;
    if (g === anterior) return g;
    anterior = g;
    await esperar(ms);
  }
  return anterior;
}

const RESPUESTAS_BASE = {
  edad: '25_31', genero_biologico: 'femenino', identidad: 'hetero',
  temperamento: 'extrovertido', localidad: 'pereira', actividades: 'sociales',
  estudios: 'profesional', estado_civil: 'soltero_feliz', planes: 'fiestas',
  decisiones: 'flexibles', ideas: 'innovadoras', plan_musical: 'crossover',
  animal_favorito: 'aire', zodiaco: 'a_veces', exploracion: 'aventurero',
  antiestres: 'amistades', relacionamiento: 'lider', informacion: 'culturales',
  disposicion: 'si', valores: 'si',
};

let seq = 0;
/** Registra un usuario y le carga intereses; devuelve { id, token, email }. */
async function crearUsuario(intereses, idPorInteres) {
  seq += 1;
  const email = `${PREFIJO}${seq}-${Date.now()}@seismas.test`;
  const alta = await pedir('POST', '/api/usuarios', {
    email, password: 'prueba1234', nombre: `Prueba ${seq}`,
  });
  if (!alta.ok) throw new Error(`No se pudo registrar ${email}: ${JSON.stringify(alta.datos)}`);
  const usuario = { id: alta.datos.usuario.id, token: alta.datos.token, email };
  await pedir('PUT', '/api/usuarios/yo/intereses',
    { interes_ids: intereses.map((n) => idPorInteres[n]) }, usuario.token);
  return usuario;
}

const enviarTest = (usuario, respuestas = {}) =>
  pedir('POST', '/api/usuarios/yo/test-personalidad',
    { respuestas: { ...RESPUESTAS_BASE, ...respuestas } }, usuario.token);

// ---------------------------------------------------------------------------

async function main() {
  if (!(await pedir('GET', '/health')).ok) {
    throw new Error(`El backend no responde en ${API}. Levantalo con: cd backend && npm start`);
  }
  const { pool } = require('../src/config/db');
  await limpiar(pool);

  const idPorInteres = Object.fromEntries(
    (await pedir('GET', '/api/intereses')).datos.map((i) => [i.nombre, i.id])
  );

  // =========================================================================
  // A. Concurrencia: 12 tests al mismo tiempo
  // =========================================================================
  console.log('== A. Concurrencia: 12 tests de personalidad enviados en paralelo ==');

  // Sin oferta todavía a propósito: acá se prueba la formación de grupos, no
  // la asignación de plan. Los grupos deben quedar 'completo' sin evento.
  const doce = [];
  for (let i = 0; i < 12; i++) {
    doce.push(await crearUsuario(['Gastronomía', 'Música'], idPorInteres));
  }
  // El disparo del matching ocurre al guardar cada test: enviarlos con
  // Promise.all es exactamente el caso que el advisory lock tiene que cubrir.
  await Promise.all(doce.map((u) => enviarTest(u)));
  await esperarQuietud();

  const grupos = (await pedir('GET', '/api/grupos')).datos;
  const detalles = await Promise.all(
    grupos.map(async (g) => (await pedir('GET', `/api/grupos/${g.id}`)).datos)
  );
  const miembrosPlanos = detalles.flatMap((d) => d.miembros.map((m) => m.id));

  console.log(`  Grupos creados: ${grupos.length} — tamaños: ${detalles.map((d) => d.miembros.length).join(', ')}`);
  verificar(grupos.length === 2, '12 usuarios simultáneos produjeron exactamente 2 grupos');
  verificar(detalles.every((d) => d.miembros.length === 6), 'todos los grupos tienen exactamente 6 miembros');
  verificar(
    new Set(miembrosPlanos).size === miembrosPlanos.length,
    'ningún usuario quedó en dos grupos (el advisory lock serializó las corridas)'
  );
  verificar(
    miembrosPlanos.length === 12,
    'los 12 usuarios quedaron agrupados y ninguno se perdió'
  );
  verificar(
    detalles.every((d) => d.estado === 'completo'),
    "sin oferta cargada los grupos quedan 'completo' (sin plan), no 'activo'"
  );

  // =========================================================================
  // D. El pool no reutiliza a quien ya tiene grupo
  // =========================================================================
  console.log('\n== D. Pool de candidatos ==');
  const candidatos = (await pedir('GET', '/api/matching/candidatos')).datos;
  const idsEnEspera = new Set(candidatos.candidatos.map((c) => c.id));
  console.log(`  En espera: ${candidatos.total}`);
  verificar(
    !miembrosPlanos.some((id) => idsEnEspera.has(id)),
    'quien ya está en un grupo vivo no vuelve a aparecer como candidato'
  );

  // =========================================================================
  // C. Simular no persiste
  // =========================================================================
  console.log('\n== C. Grupo cancelado y /api/matching/simular ==');

  // Para simular hace falta un pool de al menos 6, y el matching automático no
  // deja candidatos sueltos: se cancela un grupo, que es el otro camino por el
  // que alguien vuelve al pool (ESTADOS_OCUPADOS no incluye 'cancelado').
  const grupoACancelar = detalles[0];
  await pool.query("UPDATE grupos SET estado = 'cancelado' WHERE id = $1", [grupoACancelar.id]);
  const liberados = (await pedir('GET', '/api/matching/candidatos')).datos;
  const idsLiberados = new Set(liberados.candidatos.map((c) => c.id));
  console.log(`  Tras cancelar un grupo, vuelven al pool: ${liberados.total} candidatos`);
  verificar(
    grupoACancelar.miembros.every((m) => idsLiberados.has(m.id)),
    'cancelar un grupo devuelve a sus 6 miembros al pool de candidatos'
  );

  const antes = await conteos(pool);
  const sim = await pedir('POST', '/api/matching/simular', {});
  const despues = await conteos(pool);
  console.log(`  Propuso ${sim.datos.grupos_propuestos} grupo(s); creados: ${sim.datos.grupos_creados}`);
  verificar(sim.datos.simulacion === true, 'la respuesta se marca como simulación');
  verificar(sim.datos.grupos_creados === 0, 'la simulación no crea grupos');
  verificar(
    antes.grupos === despues.grupos && antes.miembros === despues.miembros && antes.eventos === despues.eventos,
    'la base quedó idéntica después de simular (ROLLBACK real)'
  );
  verificar(sim.datos.grupos_propuestos === 1, 'la simulación propuso el grupo que el pool permite');
  verificar(
    (sim.datos.grupos || []).every((g) => g.grupo_id === undefined),
    'la simulación no devuelve ids de grupo (no existen fuera de la transacción)'
  );

  // Se restaura para que el resto de la prueba no vea a esos 6 sueltos.
  await pool.query("UPDATE grupos SET estado = 'completo' WHERE id = $1", [grupoACancelar.id]);

  // =========================================================================
  // B. Cupo del comercio: la agenda se llena y los de más quedan sin plan
  // =========================================================================
  console.log('\n== B. Cupo del comercio ==');

  // Un solo comercio, una sola franja semanal, un grupo por noche: la oferta
  // total en la ventana de 21 días es contable de antemano.
  const DIA_FRANJA = 6; // sábado
  // En Cartago y no en Pereira a propósito: así los únicos que compiten por
  // esta agenda son los grupos que forma esta sección, y no los que quedaron
  // pendientes en A — que es justo lo que haría ambiguo el conteo de cupos.
  const comercio = (await pedir('POST', '/api/comercios', {
    nombre: `${MARCA} Único`, ciudad: 'Cartago', categoria: 'Gastronomía',
  })).datos;
  await pool.query(
    "UPDATE comercios SET plan_id = (SELECT id FROM pa_planes_comercio WHERE nombre = 'oro') WHERE id = $1",
    [comercio.id]
  );
  await pedir('POST', '/api/anfitriones', {
    comercio_id: comercio.id, nombre: 'Anfitrión único', email: `anf-${Date.now()}@seismas.test`,
  });
  await pedir('POST', `/api/comercios/${comercio.id}/planes`, {
    interes_id: idPorInteres['Gastronomía'], titulo: 'Cena de cupo limitado',
    descripcion: 'Plan de prueba', duracion_min: 120, precio: 90000, capacidad: 6,
  });
  await pedir('POST', `/api/comercios/${comercio.id}/disponibilidad`, {
    dia_semana: DIA_FRANJA, hora_inicio: '19:00', hora_fin: '22:00', grupos_max: 1,
  });

  // Cuántos sábados caen dentro de la ventana (48h de anticipación, 21 días).
  const { dias } = programacion.diasDeVentana(new Date());
  const cuposDisponibles = dias.filter((d) => programacion.diaSemana(d) === DIA_FRANJA).length;
  console.log(`  ${DIAS[DIA_FRANJA]}s dentro de la ventana de 21 días: ${cuposDisponibles} → ese es el techo de grupos con plan.`);

  // Se forman más grupos que cupos: cuposDisponibles + 2.
  const gruposAFormar = cuposDisponibles + 2;
  const gruposPrevios = new Set((await pedir('GET', '/api/grupos')).datos.map((g) => g.id));
  for (let tanda = 0; tanda < gruposAFormar; tanda++) {
    const tandaUsuarios = [];
    for (let i = 0; i < 6; i++) tandaUsuarios.push(await crearUsuario(['Gastronomía'], idPorInteres));
    await Promise.all(tandaUsuarios.map((u) => enviarTest(u, { localidad: 'cartago' })));
    await esperarQuietud(800);
  }

  const nuevos = (await pedir('GET', '/api/grupos')).datos.filter((g) => !gruposPrevios.has(g.id));
  const { rows: eventosComercio } = await pool.query(
    `SELECT id, fecha_hora, grupo_id FROM eventos
      WHERE comercio_id = $1 AND deleted_at IS NULL AND estado <> 'cancelado'
      ORDER BY fecha_hora`,
    [comercio.id]
  );
  const conPlan = nuevos.filter((g) => g.estado === 'activo').length;
  const sinPlan = nuevos.filter((g) => g.estado === 'completo').length;
  console.log(`  Grupos nuevos: ${nuevos.length} (con plan: ${conPlan}, sin plan: ${sinPlan})`);
  console.log(`  Eventos en el comercio: ${eventosComercio.length} → ${eventosComercio.map((e) => fmt(e.fecha_hora)).join(' | ')}`);

  verificar(nuevos.length === gruposAFormar, `se formaron los ${gruposAFormar} grupos esperados`);
  verificar(
    eventosComercio.length <= cuposDisponibles,
    `el comercio nunca recibió más grupos que cupos (${eventosComercio.length} ≤ ${cuposDisponibles})`
  );
  verificar(sinPlan >= 1, 'los grupos que no alcanzaron cupo quedaron sin plan en vez de sobrevender la franja');
  const instantes = eventosComercio.map((e) => new Date(e.fecha_hora).getTime());
  verificar(new Set(instantes).size === instantes.length, 'no hay dos grupos en la misma franja (grupos_max = 1)');
  verificar(
    eventosComercio.every((e) => programacion.diaSemana(fechaLocalYmd(e.fecha_hora)) === DIA_FRANJA),
    `todas las fechas cayeron en la franja declarada (${DIAS[DIA_FRANJA]})`
  );
  verificar(
    eventosComercio.every((e) => (new Date(e.fecha_hora) - Date.now()) / 3600000 >= 47.9),
    'todas las fechas respetan la anticipación mínima de 48h'
  );

  // =========================================================================
  // G. Lo que ve la app móvil
  // =========================================================================
  console.log('\n== G. Lo que ve el usuario en la app ==');
  const conPlanGrupo = nuevos.find((g) => g.estado === 'activo');
  const detalleConPlan = (await pedir('GET', `/api/grupos/${conPlanGrupo.id}`)).datos;
  const unMiembroId = detalleConPlan.miembros[0].id;
  const { rows: cuenta } = await pool.query('SELECT email FROM usuarios WHERE id = $1', [unMiembroId]);
  const login = await pedir('POST', '/api/usuarios/login', { email: cuenta[0].email, password: 'prueba1234' });
  const token = login.datos.token;

  const miGrupo = await pedir('GET', '/api/usuarios/yo/grupo', null, token);
  const misEventos = await pedir('GET', '/api/usuarios/yo/eventos', null, token);
  console.log(`  /yo/grupo   → ${miGrupo.status} ${miGrupo.datos?.estado} con ${miGrupo.datos?.miembros.length} miembros`);
  console.log(`  /yo/eventos → ${misEventos.datos.length} plan(es): ${misEventos.datos[0]?.titulo} en ${misEventos.datos[0]?.comercio_nombre}`);
  verificar(miGrupo.status === 200 && miGrupo.datos.miembros.length === 6, 'el usuario ve su grupo con los 6 miembros');
  verificar(
    miGrupo.datos.miembros.every((m) => m.email === undefined && m.telefono === undefined),
    'el grupo no expone email ni teléfono de los otros miembros'
  );
  verificar(misEventos.datos.length === 1, 'el usuario ve exactamente su plan');
  verificar(!!misEventos.datos[0].comercio_nombre, 'el plan trae el comercio resuelto (dónde es)');

  // Un usuario sin grupo recibe 204, no un error.
  const enEspera = await crearUsuario(['Tecnología'], idPorInteres);
  const sinGrupo = await pedir('GET', '/api/usuarios/yo/grupo', null, enEspera.token);
  verificar(sinGrupo.status === 204, 'estar en espera devuelve 204, no un error');

  // =========================================================================
  // E. Autorización
  // =========================================================================
  console.log('\n== E. Autorización ==');
  const eventoAjeno = eventosComercio.find((e) => e.grupo_id !== conPlanGrupo.id);

  const casos = [
    ['perfil propio sin token', await pedirAnonimo('GET', '/api/usuarios/yo'), 401],
    ['grupo propio sin token', await pedirAnonimo('GET', '/api/usuarios/yo/grupo'), 401],
    ['ejecutar matching sin clave de administración', await pedirAnonimo('POST', '/api/matching/ejecutar', {}), 401],
    ['listar grupos sin clave', await pedirAnonimo('GET', '/api/grupos'), 401],
    ['listar eventos sin clave', await pedirAnonimo('GET', '/api/eventos'), 401],
    ['feedback ajeno sin clave', await pedirAnonimo('GET', '/api/feedback'), 401],
  ];
  for (const [desc, res, esperado] of casos) {
    verificar(res.status === esperado, `${desc} → ${esperado} (dio ${res.status})`);
  }

  const claveMala = await pedir('POST', '/api/matching/ejecutar', {}, null, { 'X-Admin-Key': 'clave-incorrecta' });
  verificar(claveMala.status === 401, `clave de administración incorrecta → 401 (dio ${claveMala.status})`);

  const tokenBasura = await pedir('GET', '/api/usuarios/yo', null, 'no.es.un.token');
  verificar(tokenBasura.status === 401, 'token inválido → 401');

  // El catálogo sigue siendo público (lo necesita el registro).
  const catalogoPublico = await pedirAnonimo('GET', '/api/intereses');
  verificar(catalogoPublico.status === 200, 'el catálogo de intereses sigue siendo público');

  // Login con contraseña mala: mismo mensaje que con email inexistente.
  const malaPass = await pedirAnonimo('POST', '/api/usuarios/login', { email: cuenta[0].email, password: 'incorrecta1' });
  const noExiste = await pedirAnonimo('POST', '/api/usuarios/login', { email: 'nadie@seismas.test', password: 'incorrecta1' });
  verificar(
    malaPass.status === 401 && noExiste.status === 401 && malaPass.datos.error === noExiste.datos.error,
    'login no permite enumerar correos (mismo 401 y mismo mensaje)'
  );

  // =========================================================================
  // F. Feedback
  // =========================================================================
  console.log('\n== F. Valoración del plan ==');
  const miEvento = misEventos.datos[0];

  const ajeno = eventoAjeno
    ? await pedir('POST', '/api/feedback', { evento_id: eventoAjeno.id, rating: 1 }, token)
    : null;
  if (ajeno) {
    verificar(ajeno.status === 404, 'no se puede valorar el plan de un grupo al que no se pertenece');
  }

  const fuera = await pedir('POST', '/api/feedback', { evento_id: miEvento.id, rating: 9 }, token);
  verificar(fuera.status === 400, `rating fuera de 1-5 se rechaza (dio ${fuera.status})`);

  const ok = await pedir('POST', '/api/feedback', { evento_id: miEvento.id, rating: 5, comentario: 'Excelente' }, token);
  verificar(ok.status === 201, 'un miembro del grupo puede valorar su plan');

  const repetido = await pedir('POST', '/api/feedback', { evento_id: miEvento.id, rating: 1 }, token);
  verificar(repetido.status === 409, 'no se puede valorar dos veces el mismo plan');

  const anonimo = await pedirAnonimo('POST', '/api/feedback', { evento_id: miEvento.id, rating: 5 });
  verificar(anonimo.status === 401, 'no se puede valorar sin sesión');

  // =========================================================================
  console.log('\n== Resultado ==');
  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.descripcion}`);
  const fallos = checks.filter((c) => !c.ok).length;
  console.log(`\n  ${checks.length - fallos}/${checks.length} condiciones cumplidas.`);

  if (LIMPIAR_AL_FINAL) {
    await limpiar(pool);
    console.log('  Datos de prueba borrados (--limpiar).');
  } else {
    console.log('  Datos conservados. Para borrarlos: node backend/scripts/prueba_escenarios.js --limpiar');
  }

  await pool.end();
  process.exit(fallos === 0 ? 0 : 1);
}

async function conteos(pool) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM grupos) AS grupos,
            (SELECT count(*) FROM grupo_miembros) AS miembros,
            (SELECT count(*) FROM eventos) AS eventos`
  );
  return { grupos: Number(rows[0].grupos), miembros: Number(rows[0].miembros), eventos: Number(rows[0].eventos) };
}

async function limpiar(pool) {
  await pool.query(
    `DELETE FROM grupos WHERE id IN (
       SELECT gm.grupo_id FROM grupo_miembros gm JOIN usuarios u ON u.id = gm.usuario_id
       WHERE u.email LIKE $1)`,
    [`${PREFIJO}%`]
  );
  await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`${PREFIJO}%`]);
  await pool.query('DELETE FROM comercios WHERE nombre LIKE $1', [`${MARCA}%`]);
}

/** 'YYYY-MM-DD' del instante en la zona de operación. */
function fechaLocalYmd(iso) {
  return new Date(new Date(iso).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

function fmt(iso) {
  const local = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
  return `${DIAS[local.getUTCDay()]} ${local.toISOString().slice(5, 16).replace('T', ' ')}`;
}

main().catch((err) => {
  console.error('\n✗ La prueba falló:', err.message);
  process.exit(1);
});
