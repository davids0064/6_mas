#!/usr/bin/env node
/**
 * Prueba end-to-end del matching automático contra la API real.
 *
 * Qué verifica, en orden:
 *   1. Limpia los datos de una corrida anterior.
 *   2. Siembra la OFERTA: dos restaurantes en Pereira con el mismo plan de
 *      Gastronomía y las mismas franjas, uno bronce y otro premium. Sirven
 *      para comprobar que el tier desempata.
 *   3. Siembra un tercer restaurante premium pero de Tecnología (poco afín) y
 *      uno de Gastronomía en otra ciudad: ninguno debe ganar.
 *   4. Registra 6 usuarios con intereses y test. NO llama al matching: el
 *      disparo es automático al enviar cada test. La prueba espera y observa.
 *   5. Valida el grupo creado, el plan asignado (comercio, tier, interés) y
 *      la fecha elegida (día de la semana, hora y anticipación mínima).
 *   6. Comprueba que el cupo de la franja se respeta y que un grupo completo
 *      sin oferta afín queda sin plan hasta que aparece oferta nueva.
 *
 * Uso:
 *   node backend/scripts/prueba_match.js            # deja los datos
 *   node backend/scripts/prueba_match.js --limpiar  # los borra al terminar
 */

require('dotenv').config({ path: `${__dirname}/../.env` });

const API = process.env.API_URL || 'http://localhost:3000';
const PREFIJO = 'prueba-match-';
const MARCA = '[prueba match]';
const LIMPIAR_AL_FINAL = process.argv.includes('--limpiar');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// ---------------------------------------------------------------------------
// Oferta de prueba. Los cuatro comercios existen para responder una pregunta
// cada uno:
//   - Bronce y Premium (Pereira, Gastronomía, mismas franjas): ¿el tier
//     desempata entre dos ofertas igual de afines?
//   - Premium Tech (Pereira, Tecnología): ¿un premium poco afín pierde contra
//     un bronce afín? (debe perder: el tier no pisa la afinidad)
//   - Premium Manizales (Gastronomía): ¿la ciudad filtra? (debe filtrar)
// ---------------------------------------------------------------------------
const COMERCIOS = [
  { clave: 'bronce',  nombre: `${MARCA} Fonda Bronce`,   ciudad: 'Pereira',   tier: 'bronce',  interes: 'Gastronomía', titulo: 'Cena a ciegas' },
  { clave: 'premium', nombre: `${MARCA} Bistró Premium`, ciudad: 'Pereira',   tier: 'premium', interes: 'Gastronomía', titulo: 'Mesa sorpresa' },
  { clave: 'tech',    nombre: `${MARCA} Café Tech`,      ciudad: 'Pereira',   tier: 'premium', interes: 'Tecnología',  titulo: 'Noche de gadgets' },
  { clave: 'lejos',   nombre: `${MARCA} Parrilla Lejos`, ciudad: 'Manizales', tier: 'premium', interes: 'Gastronomía', titulo: 'Asado sorpresa' },
];

// Jueves, viernes y sábado de 19:00 a 22:00, un grupo por noche.
const FRANJAS = [4, 5, 6].map((dia_semana) => ({ dia_semana, hora_inicio: '19:00', hora_fin: '22:00', grupos_max: 1 }));

const PERFILES = [
  {
    nombre: 'Ana Restrepo', genero: 'Femenino',
    intereses: ['Música', 'Gastronomía', 'Bienestar'],
    respuestas: {
      edad: '25_31', genero_biologico: 'femenino', identidad: 'hetero',
      temperamento: 'extrovertido', localidad: 'pereira', actividades: 'sociales',
      estudios: 'profesional', estado_civil: 'soltero_feliz', planes: 'fiestas',
      decisiones: 'flexibles', ideas: 'innovadoras', plan_musical: 'crossover',
      animal_favorito: 'aire', zodiaco: 'a_veces', exploracion: 'aventurero',
      antiestres: 'amistades', relacionamiento: 'lider', informacion: 'culturales',
      disposicion: 'si', valores: 'si',
    },
  },
  {
    nombre: 'Bruno Salazar', genero: 'Masculino',
    intereses: ['Música', 'Gastronomía', 'Deporte'],
    respuestas: {
      edad: '25_31', genero_biologico: 'masculino', identidad: 'hetero',
      temperamento: 'extrovertido', localidad: 'pereira', actividades: 'sociales',
      estudios: 'profesional', estado_civil: 'soltero_feliz', planes: 'fiestas',
      decisiones: 'flexibles', ideas: 'innovadoras', plan_musical: 'rock',
      animal_favorito: 'tierra', zodiaco: 'no', exploracion: 'aventurero',
      antiestres: 'actividad_fisica', relacionamiento: 'lider', informacion: 'viajes',
      disposicion: 'si', valores: 'si',
    },
  },
  {
    nombre: 'Carla Ossa', genero: 'Femenino',
    intereses: ['Gastronomía', 'Bienestar', 'Lectura'],
    respuestas: {
      edad: '25_31', genero_biologico: 'femenino', identidad: 'bisexual',
      temperamento: 'ambivertido', localidad: 'pereira', actividades: 'sociales',
      estudios: 'maestria', estado_civil: 'soltero_feliz', planes: 'club_lectura',
      decisiones: 'logicas', ideas: 'innovadoras', plan_musical: 'pop',
      animal_favorito: 'agua', zodiaco: 'a_veces', exploracion: 'aventurero',
      antiestres: 'meditar', relacionamiento: 'seguidor', informacion: 'culturales',
      disposicion: 'si', valores: 'si',
    },
  },
  {
    nombre: 'Diego Marín', genero: 'Masculino',
    intereses: ['Deporte', 'Gastronomía', 'Tecnología'],
    respuestas: {
      edad: '32_44', genero_biologico: 'masculino', identidad: 'hetero',
      temperamento: 'ambivertido', localidad: 'pereira', actividades: 'deportivas',
      estudios: 'profesional', estado_civil: 'casado', planes: 'deportivos',
      decisiones: 'logicas', ideas: 'criticas', plan_musical: 'rock',
      animal_favorito: 'tierra', zodiaco: 'no_creo_astrologia', exploracion: 'tranquilo',
      antiestres: 'actividad_fisica', relacionamiento: 'indiferente', informacion: 'negocios',
      disposicion: 'si', valores: 'si',
    },
  },
  {
    nombre: 'Elena Cardona', genero: 'Femenino',
    intereses: ['Música', 'Gastronomía', 'Lectura'],
    respuestas: {
      edad: '25_31', genero_biologico: 'femenino', identidad: 'hetero',
      temperamento: 'ambivertido', localidad: 'pereira', actividades: 'sociales',
      estudios: 'maestria', estado_civil: 'soltero_feliz', planes: 'fiestas',
      decisiones: 'logicas', ideas: 'innovadoras', plan_musical: 'pop',
      animal_favorito: 'aire', zodiaco: 'no', exploracion: 'aventurero',
      antiestres: 'amistades', relacionamiento: 'seguidor', informacion: 'culturales',
      disposicion: 'si', valores: 'si',
    },
  },
  {
    // Casi el clon de Ana en gustos y personalidad, pero en otra ciudad: su
    // afinidad es altísima y aun así no debe entrar al grupo de Pereira.
    nombre: 'Felipe Grisales', genero: 'Masculino',
    intereses: ['Gastronomía', 'Música'],
    respuestas: {
      edad: '25_31', genero_biologico: 'masculino', identidad: 'hetero',
      temperamento: 'extrovertido', localidad: 'manizales', actividades: 'sociales',
      estudios: 'profesional', estado_civil: 'soltero_feliz', planes: 'fiestas',
      decisiones: 'flexibles', ideas: 'innovadoras', plan_musical: 'crossover',
      animal_favorito: 'aire', zodiaco: 'a_veces', exploracion: 'aventurero',
      antiestres: 'amistades', relacionamiento: 'lider', informacion: 'culturales',
      disposicion: 'si', valores: 'si',
    },
  },
];

async function pedir(metodo, ruta, cuerpo) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  return { ok: res.ok, status: res.status, datos };
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
function verificar(condicion, descripcion) {
  checks.push({ ok: !!condicion, descripcion });
  return !!condicion;
}

/** Espera a que el matching automático (segundo plano) produzca su efecto. */
async function esperarA(condicion, ms = 6000) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const valor = await condicion();
    if (valor) return valor;
    await esperar(250);
  }
  return null;
}

function fmtFecha(iso) {
  const d = new Date(iso);
  // Se muestra en la zona de operación, no en la del proceso.
  const local = new Date(d.getTime() - 5 * 3600 * 1000);
  return `${DIAS[local.getUTCDay()]} ${local.toISOString().slice(0, 16).replace('T', ' ')}`;
}

async function main() {
  if (!(await pedir('GET', '/health')).ok) {
    throw new Error(`El backend no responde en ${API}. Levantalo con: cd backend && npm start`);
  }
  const { pool } = require('../src/config/db');

  // --- 0. Limpieza ---------------------------------------------------------
  await pool.query(
    `DELETE FROM grupos WHERE id IN (
       SELECT gm.grupo_id FROM grupo_miembros gm JOIN usuarios u ON u.id = gm.usuario_id
       WHERE u.email LIKE $1)`,
    [`${PREFIJO}%`]
  );
  await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`${PREFIJO}%`]);
  await pool.query('DELETE FROM comercios WHERE nombre LIKE $1', [`${MARCA}%`]);

  // --- 1. Oferta -----------------------------------------------------------
  console.log('== 1. Oferta sembrada ==');
  const cat = await pedir('GET', '/api/intereses');
  const idPorInteres = Object.fromEntries(cat.datos.map((i) => [i.nombre, i.id]));
  const comercios = {};

  for (const c of COMERCIOS) {
    const comercio = (await pedir('POST', '/api/comercios', {
      nombre: c.nombre, ciudad: c.ciudad, categoria: c.interes,
    })).datos;
    // El tier se asigna por SQL: es dato comercial, no lo expone la API social.
    await pool.query(
      'UPDATE comercios SET plan_id = (SELECT id FROM pa_planes_comercio WHERE nombre = $1) WHERE id = $2',
      [c.tier, comercio.id]
    );
    await pedir('POST', '/api/anfitriones', {
      comercio_id: comercio.id, nombre: `Anfitrión ${c.clave}`,
      email: `anfitrion-${c.clave}-${Date.now()}@seismas.test`,
    });
    const plan = (await pedir('POST', `/api/comercios/${comercio.id}/planes`, {
      interes_id: idPorInteres[c.interes], titulo: c.titulo,
      descripcion: 'Plan de prueba', duracion_min: 120, precio: 80000, capacidad: 6,
    })).datos;
    for (const f of FRANJAS) {
      await pedir('POST', `/api/comercios/${comercio.id}/disponibilidad`, f);
    }
    comercios[c.clave] = { ...c, id: comercio.id, plan_id: plan.id };
    console.log(`  ✓ ${c.nombre.padEnd(28)} ${c.tier.padEnd(8)} ${c.ciudad.padEnd(10)} ${c.interes}`);
  }
  console.log(`  franjas por comercio: ${FRANJAS.map((f) => DIAS[f.dia_semana]).join(', ')} 19:00–22:00, 1 grupo/noche`);

  // --- 2. Registro: el matching se dispara solo ----------------------------
  console.log('\n== 2. Registro de 6 usuarios (sin llamar al matching) ==');
  const gruposIniciales = (await pedir('GET', '/api/grupos')).datos.length;
  const usuarios = [];
  let grupoAuto = null;
  let usuarioQueCerroElGrupo = null;

  for (const [i, perfil] of PERFILES.entries()) {
    const email = `${PREFIJO}${i + 1}@seismas.test`;
    const alta = (await pedir('POST', '/api/usuarios', {
      email, password: 'prueba1234', nombre: perfil.nombre, genero: perfil.genero,
    })).datos;
    await pedir('PUT', `/api/usuarios/${alta.id}/intereses`, {
      interes_ids: perfil.intereses.map((n) => idPorInteres[n]),
    });
    await pedir('POST', `/api/usuarios/${alta.id}/test-personalidad`, { respuestas: perfil.respuestas });
    usuarios.push({ ...perfil, id: alta.id, email });

    // Tras cada test, el backend dispara el matching en segundo plano.
    if (!grupoAuto) {
      const nuevos = await esperarA(async () => {
        const gs = (await pedir('GET', '/api/grupos')).datos;
        return gs.length > gruposIniciales ? gs : null;
      }, 3000);
      if (nuevos) {
        grupoAuto = nuevos[0];
        usuarioQueCerroElGrupo = perfil.nombre;
      }
    }
    console.log(`  ✓ ${perfil.nombre.padEnd(16)} ${perfil.respuestas.localidad.padEnd(11)} ${perfil.intereses.join(', ')}`);
  }

  verificar(!!grupoAuto, 'se creó un grupo automáticamente, sin llamar a /api/matching/ejecutar');
  if (!grupoAuto) throw new Error('El matching automático no produjo ningún grupo.');
  console.log(`\n  → El grupo se cerró solo al completar el test ${usuarioQueCerroElGrupo}.`);
  console.log(`    (el pool ya tenía usuarios de la base, por eso pudo cerrarse antes del sexto sembrado)`);

  // --- 3. El grupo y su plan ----------------------------------------------
  const detalle = (await pedir('GET', `/api/grupos/${grupoAuto.id}`)).datos;
  const eventos = (await pedir('GET', `/api/eventos?grupo_id=${grupoAuto.id}`)).datos;
  const evento = eventos[0];

  console.log('\n== 3. Grupo y plan asignados ==');
  console.log(`  ${detalle.nombre} — estado ${detalle.estado}, ${detalle.miembros.length} miembros`);
  for (const m of detalle.miembros) console.log(`    · ${m.nombre}`);
  if (evento) {
    const { rows: info } = await pool.query(
      `SELECT c.nombre AS comercio, c.ciudad, p.nombre AS tier, e.origen, e.categoria
       FROM eventos e JOIN comercios c ON c.id = e.comercio_id
       LEFT JOIN pa_planes_comercio p ON p.id = c.plan_id WHERE e.id = $1`,
      [evento.id]
    );
    console.log(`  Plan  : ${evento.titulo} — ${info[0].comercio} (${info[0].tier}, ${info[0].ciudad})`);
    console.log(`  Fecha : ${fmtFecha(evento.fecha_hora)}  ·  interés: ${info[0].categoria}  ·  origen: ${info[0].origen}`);

    const horas = (new Date(evento.fecha_hora) - Date.now()) / 3600000;
    const local = new Date(new Date(evento.fecha_hora).getTime() - 5 * 3600 * 1000);
    verificar(info[0].comercio === COMERCIOS.find((c) => c.clave === 'premium').nombre,
      'entre dos ofertas igual de afines ganó el comercio premium (el tier desempata)');
    verificar(info[0].categoria === 'Gastronomía',
      'el premium de Tecnología NO ganó: el tier no le gana a la afinidad');
    verificar(info[0].ciudad === 'Pereira', 'el comercio de Manizales quedó filtrado por ciudad');
    verificar(info[0].origen === 'matching', 'el evento lo generó el matching a partir del plan y la franja');
    verificar([4, 5, 6].includes(local.getUTCDay()), `la fecha cayó en una franja declarada (${DIAS[local.getUTCDay()]})`);
    verificar(local.getUTCHours() === 19, 'la hora es la de inicio de la franja (19:00)');
    verificar(horas >= 47.9, `se respetó la anticipación mínima de 48h (faltan ${horas.toFixed(1)}h)`);
  }
  verificar(!!evento, 'el grupo recibió un plan');
  verificar(detalle.miembros.length === 6, 'el grupo tiene exactamente 6 miembros');
  verificar(detalle.estado === 'activo', `el grupo quedó 'activo' (con plan), no solo 'completo'`);
  verificar(
    !detalle.miembros.some((m) => m.nombre === 'Felipe Grisales'),
    'Felipe (Manizales) quedó fuera del grupo de Pereira pese a su alta afinidad'
  );

  // --- 4. Cupo de la franja ------------------------------------------------
  console.log('\n== 4. Cupo de la franja ==');
  const oferta = await pedir('GET', '/api/matching/oferta');
  const franjasPremium = oferta.datos.planes.find((p) => p.comercio === comercios.premium.nombre)?.franjas || [];
  console.log(`  El premium declara ${franjasPremium.length} franjas de 1 grupo/noche.`);
  const { rows: ocupadas } = await pool.query(
    `SELECT count(*)::int AS n FROM eventos WHERE comercio_id = $1 AND deleted_at IS NULL
     AND estado <> 'cancelado' AND fecha_hora > now()`,
    [comercios.premium.id]
  );
  console.log(`  Eventos futuros ya ocupando cupo en el premium: ${ocupadas[0].n}`);
  verificar(ocupadas[0].n === 1, 'el plan asignado ocupa exactamente un cupo');

  // --- 5. Grupo completo sin oferta afín ----------------------------------
  // Se apaga la oferta de Gastronomía de Pereira y se fuerza un grupo nuevo:
  // debe quedar 'completo' sin plan, y recibirlo recién cuando vuelva la oferta.
  console.log('\n== 5. Grupo sin oferta afín, y su rescate ==');
  await pool.query('UPDATE comercio_planes SET activo = FALSE WHERE comercio_id = ANY($1::uuid[])',
    [[comercios.bronce.id, comercios.premium.id]]);

  // Los grupos que ya existían en la base (incluido cualquier grupo viejo en
  // estado 'completo') no son de esta prueba: se anotan para no confundirlos
  // con el que estamos por formar.
  const gruposPrevios = new Set((await pedir('GET', '/api/grupos')).datos.map((g) => g.id));
  const sobrantes = (await pedir('GET', '/api/matching/candidatos')).datos;
  console.log(`  Candidatos en espera: ${sobrantes.total}`);
  const faltan = 6 - sobrantes.candidatos.filter((c) => c.localidad === 'pereira').length;
  for (let i = 0; i < Math.max(faltan, 0); i++) {
    const email = `${PREFIJO}relleno${i}@seismas.test`;
    const alta = (await pedir('POST', '/api/usuarios', {
      email, password: 'prueba1234', nombre: `Relleno ${i + 1}`,
    })).datos;
    await pedir('PUT', `/api/usuarios/${alta.id}/intereses`, { interes_ids: [idPorInteres['Gastronomía']] });
    await pedir('POST', `/api/usuarios/${alta.id}/test-personalidad`, {
      respuestas: { ...PERFILES[0].respuestas, localidad: 'pereira' },
    });
  }
  const segundo = await esperarA(async () => {
    const gs = (await pedir('GET', '/api/grupos')).datos
      .filter((g) => !gruposPrevios.has(g.id) && g.estado === 'completo');
    return gs[0] || null;
  }, 6000);

  if (segundo) {
    console.log(`  Segundo grupo formado: ${segundo.nombre} — estado ${segundo.estado} (sin plan)`);
    verificar(segundo.estado === 'completo', 'sin oferta afín el grupo queda completo pero sin plan');

    // Vuelve la oferta: el alta dispara la programación de los pendientes.
    await pool.query('UPDATE comercio_planes SET activo = TRUE WHERE comercio_id = $1', [comercios.bronce.id]);
    await pedir('POST', `/api/comercios/${comercios.bronce.id}/disponibilidad`,
      { dia_semana: 3, hora_inicio: '19:00', hora_fin: '22:00', grupos_max: 2 });

    const rescatado = await esperarA(async () => {
      const g = (await pedir('GET', `/api/grupos/${segundo.id}`)).datos;
      return g.estado === 'activo' ? g : null;
    }, 6000);
    console.log(`  Tras publicar disponibilidad nueva: estado ${rescatado?.estado || segundo.estado}`);
    verificar(!!rescatado, 'al aparecer oferta nueva, el grupo pendiente recibió plan automáticamente');
  } else {
    console.log('  (no se juntaron 6 candidatos nuevos en Pereira; se omite esta parte)');
  }

  // --- Resumen -------------------------------------------------------------
  console.log('\n== Resultado ==');
  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.descripcion}`);
  const todoOk = checks.every((c) => c.ok);

  if (LIMPIAR_AL_FINAL) {
    await pool.query(
      `DELETE FROM grupos WHERE id IN (
         SELECT gm.grupo_id FROM grupo_miembros gm JOIN usuarios u ON u.id = gm.usuario_id
         WHERE u.email LIKE $1)`,
      [`${PREFIJO}%`]
    );
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`${PREFIJO}%`]);
    await pool.query('DELETE FROM comercios WHERE nombre LIKE $1', [`${MARCA}%`]);
    console.log('\n  Datos de prueba borrados (--limpiar).');
  } else {
    console.log(`\n  Datos conservados. Grupo: ${grupoAuto.id}`);
    console.log('  Para borrarlos: node backend/scripts/prueba_match.js --limpiar');
  }

  await pool.end();
  process.exit(todoOk ? 0 : 1);
}

main().catch((err) => {
  console.error('\n✗ La prueba falló:', err.message);
  process.exit(1);
});
