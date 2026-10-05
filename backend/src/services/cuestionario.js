// ============================================================================
// El cuestionario del test, y el contrato que el backend necesita que cumpla.
//
// Las preguntas se mudaron del binario de la app a la base (migración 006) para
// poder reescribir un enunciado sin pasar por la revisión de la App Store. Pero
// "está en una tabla" no significa "se puede cambiar libremente": trece de las
// veinte preguntas tienen significado para el código, y ese significado no se
// mueve a una fila.
//
// EL FALLO QUE ESTO EVITA. Si alguien renombra la clave `temperamento`, o le
// quita la opción 'extrovertido', no falla nada: el perfil deja de calcular ese
// eje, el matching deja de puntuar esa pregunta, y los grupos salen algo peores
// para siempre. Nadie ve un error. Esa clase de avería no se descubre nunca
// mirando logs, así que se comprueba al arrancar y el proceso se niega a
// levantar — un fallo mudo convertido en uno ruidoso.
//
// La lista de abajo no se escribe a mano: se deriva de los dos módulos que de
// verdad dependen del cuestionario. Así, el día que alguien añada un eje nuevo
// al perfil, el contrato se amplía solo.
// ============================================================================

const db = require('../config/db');
const matching = require('./matching');
const perfil = require('./perfilPersonalidad');

/**
 * Qué tiene que seguir existiendo, y por qué. Se deriva del código, no se
 * declara: duplicar la lista sería crear un tercer sitio que se desincroniza.
 */
function contrato() {
  const exigidas = new Map(); // clave de pregunta → { motivos[], valores:Set }

  const anotar = (clave, motivo, valores = []) => {
    if (!exigidas.has(clave)) exigidas.set(clave, { motivos: [], valores: new Set() });
    const e = exigidas.get(clave);
    if (!e.motivos.includes(motivo)) e.motivos.push(motivo);
    for (const v of valores) e.valores.add(v);
  };

  // 1. La localidad parte los grupos por ciudad. Sin ella, el matching mete a
  //    todo el mundo en un solo bloque y arma grupos entre ciudades distintas.
  // Sin respaldo `|| 'localidad'` a propósito: si algún día se deja de
  // exportar, vale más que esto reviente aquí que seguir comprobando una clave
  // adivinada mientras el matching usa otra.
  anotar(matching.CLAVE_LOCALIDAD, 'el matching parte los grupos por ciudad');

  // 2. Los ejes del perfil dependen de VALORES concretos, no solo de la
  //    pregunta: 'extrovertido' empuja hacia un polo y 'introvertido' al otro.
  for (const eje of perfil.EJES) {
    for (const [clave, polos] of Object.entries(eje.preguntas)) {
      anotar(clave, `define el eje "${eje.etiqueta}" del perfil`, [...polos.alto, ...polos.bajo]);
    }
  }

  // 3. Las cuatro que se le muestran a la persona como "lo que NO usamos para
  //    agruparte". Es una garantía que aparece en pantalla, y que la App Store
  //    nos hizo escribir; si la pregunta desaparece, la garantía deja de verse.
  for (const clave of Object.keys(perfil.NO_SE_USAN)) {
    anotar(clave, 'se muestra en "lo que no usamos para agruparte"');
  }

  return exigidas;
}

/** Lee el cuestionario vigente, ya anidado y en orden. */
async function cargar() {
  const { rows } = await db.query(
    `SELECT p.clave, p.texto,
            COALESCE(json_agg(
              json_build_object('valor', o.valor, 'texto', o.texto)
              ORDER BY o.orden
            ) FILTER (WHERE o.valor IS NOT NULL), '[]') AS opciones
       FROM pa_test_preguntas p
       LEFT JOIN pa_test_opciones o
              ON o.pregunta_clave = p.clave AND o.activo
      WHERE p.activo
      GROUP BY p.clave, p.texto, p.orden
      ORDER BY p.orden`
  );
  // `id` y no `clave` en la respuesta: es el nombre que la app ya usaba cuando
  // las preguntas vivían en una constante, y cambiarlo obligaría a tocar la
  // pantalla sin ganar nada.
  return rows.map((r) => ({ id: r.clave, texto: r.texto, opciones: r.opciones }));
}

/**
 * Comprueba que el cuestionario de la base cumple lo que el código espera.
 * Devuelve la lista de problemas; vacía significa que todo está en orden.
 */
async function revisar() {
  const preguntas = await cargar();
  const porClave = new Map(preguntas.map((p) => [p.id, p]));
  const problemas = [];

  for (const [clave, { motivos, valores }] of contrato()) {
    const pregunta = porClave.get(clave);
    if (!pregunta) {
      problemas.push(`falta la pregunta "${clave}" (${motivos.join('; ')})`);
      continue;
    }
    const presentes = new Set(pregunta.opciones.map((o) => o.valor));
    const ausentes = [...valores].filter((v) => !presentes.has(v));
    if (ausentes.length) {
      problemas.push(
        `la pregunta "${clave}" ya no ofrece ${ausentes.map((v) => `"${v}"`).join(', ')} ` +
          `(${motivos.join('; ')})`
      );
    }
  }

  if (!preguntas.length) problemas.push('el cuestionario está vacío');
  return problemas;
}

/**
 * Se llama una vez al arrancar. Si el cuestionario no cumple el contrato, el
 * proceso termina en vez de servir un test roto en silencio.
 *
 * Si la base no responde NO se mata el proceso: eso es una caída de
 * infraestructura, no un cuestionario mal editado, y matar la API por un
 * arranque adelantado al de Postgres solo añade un reinicio en bucle.
 */
async function verificarAlArrancar() {
  let problemas;
  try {
    problemas = await revisar();
  } catch (err) {
    console.warn(
      '[cuestionario] no se pudo verificar contra la base (%s). La API arranca igual: ' +
        'esto es un problema de conexión, no del cuestionario.',
      err.message
    );
    return;
  }

  if (!problemas.length) return;

  console.error(
    '\n[cuestionario] El test guardado en la base no cumple lo que el código espera:\n' +
      problemas.map((p) => `  · ${p}`).join('\n') +
      '\n\nEsto rompería el perfil de personalidad o el emparejamiento sin dar ningún\n' +
      'error visible. Revisá pa_test_preguntas y pa_test_opciones (migración 006).\n'
  );
  process.exit(1);
}

module.exports = { cargar, revisar, contrato, verificarAlArrancar };
