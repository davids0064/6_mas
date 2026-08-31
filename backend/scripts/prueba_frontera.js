/**
 * Prueba de la FRONTERA de datos entre el contexto social y el comercial.
 *
 * El README y db/DISEÑO.md afirman que el aislamiento entre los dos mundos no
 * depende del código de aplicación sino de los GRANTs de PostgreSQL: la API
 * PHP del dashboard (rol `seis_dashboard`) no puede leer un email de usuario
 * ni aunque tuviera una inyección SQL, y la API social (rol `seis_app`) no
 * puede leer el `password_hash` de un comercio. Hasta ahora esa afirmación era
 * un ejemplo de psql en un README que nadie ejecutaba. Esto la ejecuta.
 *
 *   cd backend && npm run test:frontera
 *   DATABASE_URL=postgres://…/seis_mas_test npm run test:frontera
 *
 * No necesita el servidor levantado ni datos sembrados: pregunta por permisos,
 * no por filas. Un `SELECT` sobre una tabla vacía igual pasa por el chequeo de
 * privilegios, así que la prueba corre contra una base recién migrada.
 *
 * Se conecta con el rol administrador de la base (el `DATABASE_URL` del .env)
 * y usa `SET ROLE` para hacerse pasar por cada uno de los dos roles acotados.
 * `SET ROLE` aplica exactamente los mismos chequeos de privilegio que una
 * conexión real — lo único que no ejerce es el login, y eso se cubre aparte
 * verificando `rolcanlogin`. La alternativa (abrir dos conexiones con las
 * contraseñas de cada rol) obligaría a tener esas dos contraseñas a mano para
 * correr la prueba, que es justo lo que no queremos pedirle a un CI.
 *
 * Ojo: si el DATABASE_URL del .env ya apunta a `seis_app`, este guion no puede
 * hacer `SET ROLE seis_dashboard` y lo dice en vez de fallar de forma confusa.
 */

require('dotenv').config();
const { Client } = require('pg');

// --- Lo que cada rol PUEDE y NO PUEDE tocar ---------------------------------
//
// Estas dos listas son la política de la migración 001/002 escrita como
// aserción. Si alguien agrega un GRANT amplio, acá se cae.

const SOCIAL = [
  'usuarios', 'tests_personalidad', 'usuario_intereses',
  'grupos', 'grupo_miembros', 'grupo_intereses', 'feedback',
];

const COMERCIAL = [
  'comercios', 'menus', 'menu_secciones', 'menu_items',
  'propuestas_bienvenida', 'comercio_planes', 'comercio_disponibilidad',
];

const ROLES = {
  seis_dashboard: {
    // Lo que administra el dashboard, más los catálogos y su lado de la
    // frontera. `eventos` es compartida a propósito: es la mesa donde los dos
    // mundos se encuentran.
    lee: [...COMERCIAL, 'anfitriones', 'eventos', 'pa_intereses', 'pa_generos',
      'pa_planes_comercio', 'v_evento_asistentes'],
    escribe: [...COMERCIAL, 'anfitriones', 'eventos'],
    // Ni una tabla del mundo social.
    prohibido: SOCIAL,
  },
  seis_app: {
    lee: [...SOCIAL, 'anfitriones', 'eventos', 'pa_intereses', 'pa_generos',
      'pa_planes_comercio', 'v_comercio_publico', 'v_oferta_comercio',
      'v_disponibilidad_comercio', 'v_evento_disponible'],
    escribe: [...SOCIAL, 'eventos'],
    // Ni una tabla del mundo comercio: la oferta la ve por vistas.
    prohibido: COMERCIAL,
  },
};

// Columnas que NO pueden aparecer en las vistas de frontera. La vista es lo
// único que el otro lado ve, así que si una columna sensible se cuela en el
// SELECT, el GRANT deja de proteger nada.
const VISTAS_FRONTERA = {
  // Lo que el comercio sabe de las personas que va a recibir.
  v_evento_asistentes: ['email', 'telefono', 'fecha_nacimiento', 'password_hash', 'nombre'],
  // Lo que el usuario sabe del comercio.
  v_comercio_publico: ['password_hash', 'nit', 'email'],
  v_oferta_comercio: ['password_hash', 'nit', 'email'],
};

let ok = 0;
const fallos = [];

function verificar(condicion, descripcion) {
  if (condicion) {
    ok += 1;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallos.push(descripcion);
    console.log(`  ✗ ${descripcion}`);
  }
}

/**
 * Corre una consulta haciéndose pasar por `rol` y responde si el motor la
 * dejó pasar. Cada intento va en su propia transacción con ROLLBACK: así los
 * INSERT de prueba no dejan basura y un permiso denegado (que aborta la
 * transacción) no contamina el intento siguiente.
 */
async function comoRol(cliente, rol, sql, valores = []) {
  await cliente.query('BEGIN');
  try {
    await cliente.query(`SET LOCAL ROLE ${rol}`);
    await cliente.query(sql, valores);
    return { permitido: true };
  } catch (err) {
    // 42501 = insufficient_privilege. Cualquier otro código es un error real
    // de la prueba (tabla inexistente, sintaxis), no la frontera funcionando,
    // y hay que distinguirlos o una tabla mal escrita pasaría por "protegida".
    return { permitido: false, denegado: err.code === '42501', error: err };
  } finally {
    await cliente.query('ROLLBACK');
  }
}

async function main() {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();

  const { rows: [{ current_user: usuario, super: esSuper }] } = await cliente.query(
    'SELECT current_user, rolsuper AS super FROM pg_roles WHERE rolname = current_user'
  );
  console.log(`\nFrontera de datos — base conectada como '${usuario}'\n`);

  if (usuario === 'seis_app' || usuario === 'seis_dashboard') {
    console.error(
      `Esta prueba necesita el rol administrador de la base para poder hacerse\n` +
      `pasar por los dos roles acotados, y DATABASE_URL apunta a '${usuario}'.\n` +
      `Corre con el DATABASE_URL del dueño de la base (el mismo con el que se\n` +
      `aplicaron las migraciones).`
    );
    await cliente.end();
    process.exit(2);
  }

  // --- 1. Los roles existen y son roles acotados, no superusuarios ----------
  console.log('== 1. Los dos roles ==');
  for (const rol of Object.keys(ROLES)) {
    const { rows } = await cliente.query(
      'SELECT rolcanlogin, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
      [rol]
    );
    verificar(rows.length === 1, `el rol ${rol} existe`);
    if (rows.length !== 1) continue;
    verificar(rows[0].rolcanlogin, `${rol} puede iniciar sesión (una API se conecta con él)`);
    // Un superusuario ignora TODOS los GRANTs: desplegar con uno anularía la
    // frontera entera sin cambiar una línea de SQL. Es el error de despliegue
    // más fácil de cometer y el más caro.
    verificar(!rows[0].rolsuper, `${rol} NO es superusuario (un superusuario ignora los GRANTs)`);
    verificar(!rows[0].rolbypassrls, `${rol} no puede saltarse las políticas de fila`);
  }
  if (esSuper === false) {
    console.log('  (nota: el rol de esta conexión no es superusuario; SET ROLE puede fallar)');
  }

  // --- 2. Cada rol ve lo suyo ----------------------------------------------
  for (const [rol, politica] of Object.entries(ROLES)) {
    console.log(`\n== 2. Lo que ${rol} SÍ puede hacer ==`);
    for (const tabla of politica.lee) {
      const r = await comoRol(cliente, rol, `SELECT * FROM ${tabla} LIMIT 1`);
      verificar(r.permitido, `${rol} lee ${tabla}`);
      if (!r.permitido && !r.denegado) console.log(`      ${r.error.message}`);
    }
    for (const tabla of politica.escribe) {
      // DELETE con un WHERE imposible: ejerce el chequeo de privilegio de
      // escritura sin depender de que haya filas ni de las columnas de la
      // tabla, y el ROLLBACK lo deshace igual.
      const r = await comoRol(cliente, rol, `DELETE FROM ${tabla} WHERE false`);
      verificar(r.permitido, `${rol} escribe en ${tabla}`);
    }
  }

  // --- 3. Y nada del otro lado ---------------------------------------------
  for (const [rol, politica] of Object.entries(ROLES)) {
    console.log(`\n== 3. Lo que ${rol} NO puede hacer ==`);
    for (const tabla of politica.prohibido) {
      const lectura = await comoRol(cliente, rol, `SELECT * FROM ${tabla} LIMIT 1`);
      verificar(lectura.denegado, `${rol} NO puede leer ${tabla}`);
      if (lectura.permitido) console.log(`      ¡La frontera está abierta en ${tabla}!`);

      const escritura = await comoRol(cliente, rol, `DELETE FROM ${tabla} WHERE false`);
      verificar(escritura.denegado, `${rol} NO puede escribir en ${tabla}`);
    }
  }

  // --- 4. Las dos consultas del README -------------------------------------
  //
  // Textuales, porque son las que el documento le promete a quien lo lee.
  console.log('\n== 4. Las consultas que el README promete que fallan ==');
  const email = await comoRol(cliente, 'seis_dashboard', 'SELECT email FROM usuarios');
  verificar(email.denegado, 'seis_dashboard: SELECT email FROM usuarios → permission denied');

  const hash = await comoRol(cliente, 'seis_app', 'SELECT password_hash FROM comercios');
  verificar(hash.denegado, 'seis_app: SELECT password_hash FROM comercios → permission denied');

  // El catálogo es de lectura para los dos: quien escribe intereses nuevos es
  // la administración de la API social, no un comercio.
  const catalogo = await comoRol(
    cliente, 'seis_dashboard',
    `INSERT INTO pa_intereses (nombre) VALUES ('frontera_test')`
  );
  verificar(catalogo.denegado, 'seis_dashboard no puede escribir el catálogo de intereses');

  // --- 5. Las vistas de frontera no filtran por la puerta de atrás ----------
  //
  // El GRANT protege la tabla; la vista es el hueco autorizado. Si mañana
  // alguien agrega `u.email` al SELECT de v_evento_asistentes, todos los
  // REVOKE de arriba siguen pasando y el email se filtra igual.
  console.log('\n== 5. Las vistas de frontera no exponen lo que las tablas esconden ==');
  for (const [vista, prohibidas] of Object.entries(VISTAS_FRONTERA)) {
    const { rows } = await cliente.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [vista]
    );
    verificar(rows.length > 0, `la vista ${vista} existe`);
    const columnas = rows.map((r) => r.column_name);
    const filtradas = prohibidas.filter((c) => columnas.includes(c));
    verificar(
      filtradas.length === 0,
      `${vista} no expone ${prohibidas.join(', ')}` +
        (filtradas.length ? ` — ¡expone ${filtradas.join(', ')}!` : '')
    );
  }
  // El nombre completo tampoco: el comercio recibe el nombre de pila.
  const { rows: asistentes } = await cliente.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'v_evento_asistentes'`
  );
  verificar(
    asistentes.some((r) => r.column_name === 'nombre_pila'),
    'v_evento_asistentes entrega nombre_pila, no el nombre completo'
  );

  await cliente.end();

  // --- Resultado -----------------------------------------------------------
  console.log(`\n== Resultado ==`);
  if (fallos.length === 0) {
    console.log(`  ${ok}/${ok} condiciones cumplidas. La frontera está cerrada.\n`);
    return;
  }
  console.log(`  ${ok} cumplidas, ${fallos.length} FALLIDAS:`);
  for (const f of fallos) console.log(`    ✗ ${f}`);
  console.log('');
  process.exit(1);
}

main().catch((err) => {
  console.error('\nLa prueba no pudo correr:', err.message);
  if (err.code === '3D000') {
    console.error('La base de DATABASE_URL no existe. Créala y aplica db/schema.sql + db/migrations/.');
  }
  process.exit(2);
});
