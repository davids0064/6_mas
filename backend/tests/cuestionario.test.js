// Contrato del cuestionario. Necesita Postgres.
//
//   cd backend && npm test
//
// Desde la migración 006 las preguntas del test se editan con SQL, sin
// desplegar. Eso es cómodo y es peligroso: trece de las veinte tienen
// significado para el perfil y el matching, y romperlas no produce ningún
// error — solo grupos peores y perfiles incompletos, para siempre.
//
// Estas pruebas cubren el guardia que convierte ese fallo mudo en uno ruidoso.
const test = require('node:test');
const assert = require('node:assert');

const db = require('../src/config/db');
const cuestionario = require('../src/services/cuestionario');
const matching = require('../src/services/matching');
const perfil = require('../src/services/perfilPersonalidad');

const restaurar = () =>
  db.query('UPDATE pa_test_opciones SET activo = TRUE; UPDATE pa_test_preguntas SET activo = TRUE;');

test.beforeEach(restaurar);
test.after(async () => {
  await restaurar();
  await db.pool.end();
});

test('el cuestionario que hay en la base cumple el contrato', async () => {
  assert.deepStrictEqual(await cuestionario.revisar(), []);
});

test('trae las 20 preguntas, en orden y con sus opciones', async () => {
  const preguntas = await cuestionario.cargar();
  assert.strictEqual(preguntas.length, 20);
  assert.strictEqual(preguntas[0].id, 'edad', 'la edad va primera');
  assert.strictEqual(
    preguntas.reduce((n, p) => n + p.opciones.length, 0),
    84
  );
  for (const p of preguntas) {
    assert.ok(p.opciones.length > 0, `${p.id} se quedó sin opciones`);
    assert.ok(p.texto, `${p.id} sin enunciado`);
  }
});

test('el contrato se deriva del código, no de una lista escrita a mano', async () => {
  const c = cuestionario.contrato();
  // Si alguien añade un eje nuevo al perfil, tiene que aparecer acá solo.
  for (const eje of perfil.EJES) {
    for (const clave of Object.keys(eje.preguntas)) {
      assert.ok(c.has(clave), `${clave} define un eje y no está en el contrato`);
    }
  }
  assert.ok(c.has(matching.CLAVE_LOCALIDAD), 'la localidad tiene que estar');
  for (const clave of Object.keys(perfil.NO_SE_USAN)) {
    assert.ok(c.has(clave), `${clave} se muestra en pantalla y no está en el contrato`);
  }
});

test('quitar una pregunta acoplada se detecta, y el mensaje dice por qué importa', async () => {
  await db.query("UPDATE pa_test_preguntas SET activo = FALSE WHERE clave = 'localidad'");
  const problemas = await cuestionario.revisar();
  assert.strictEqual(problemas.length, 1);
  assert.match(problemas[0], /localidad/);
  assert.match(problemas[0], /ciudad/, 'el mensaje explica la consecuencia, no solo el síntoma');
});

test('quitar un VALOR que sostiene un eje del perfil también se detecta', async () => {
  // El caso difícil: la pregunta sigue ahí y parece intacta.
  await db.query(
    "UPDATE pa_test_opciones SET activo = FALSE WHERE pregunta_clave = 'temperamento' AND valor = 'extrovertido'"
  );
  const problemas = await cuestionario.revisar();
  assert.strictEqual(problemas.length, 1);
  assert.match(problemas[0], /extrovertido/);
  assert.match(problemas[0], /eje/);
});

test('las siete preguntas libres se pueden tocar sin que salte el guardia', async () => {
  // Es la mitad útil de todo esto: que estado_civil y compañía sean editables
  // de verdad, no editables en teoría.
  for (const clave of ['edad', 'actividades', 'estudios', 'estado_civil',
                       'plan_musical', 'animal_favorito', 'zodiaco']) {
    await restaurar();
    await db.query(
      'UPDATE pa_test_opciones SET activo = FALSE WHERE pregunta_clave = $1 AND orden = 1',
      [clave]
    );
    assert.deepStrictEqual(
      await cuestionario.revisar(),
      [],
      `${clave} debería poder editarse sin romper nada`
    );
  }
});

test('añadir una opción nueva a una pregunta libre funciona', async () => {
  await db.query(
    `INSERT INTO pa_test_opciones (pregunta_clave, valor, texto, orden)
     VALUES ('estado_civil', 'union_libre', 'Unión libre', 99)
     ON CONFLICT (pregunta_clave, valor) DO NOTHING`
  );
  try {
    assert.deepStrictEqual(await cuestionario.revisar(), []);
    const preguntas = await cuestionario.cargar();
    const estadoCivil = preguntas.find((p) => p.id === 'estado_civil');
    assert.ok(estadoCivil.opciones.some((o) => o.valor === 'union_libre'));
  } finally {
    await db.query("DELETE FROM pa_test_opciones WHERE valor = 'union_libre'");
  }
});
