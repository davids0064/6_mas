const test = require('node:test');
const assert = require('node:assert');

const perfil = require('../src/services/perfilPersonalidad');
const matching = require('../src/services/matching');

// Un set de respuestas completo, para no repetirlo en cada caso.
const BASE = {
  edad: '25_31',
  genero_biologico: 'femenino',
  identidad: 'hetero',
  temperamento: 'introvertido',
  localidad: 'pereira',
  actividades: 'sociales',
  estudios: 'profesional',
  estado_civil: 'soltero_feliz',
  planes: 'hogarenos',
  decisiones: 'logicas',
  ideas: 'tradicionales',
  plan_musical: 'pop',
  animal_favorito: 'agua',
  zodiaco: 'no',
  exploracion: 'territorial',
  antiestres: 'meditar',
  relacionamiento: 'seguidor',
  informacion: 'negocios',
  disposicion: 'si',
  valores: 'si',
};

test('sin respuestas no se inventa un perfil', () => {
  assert.strictEqual(perfil.construir(null), null);
  assert.strictEqual(perfil.construir({}), null);
  assert.strictEqual(perfil.construir('cualquier cosa'), null);
});

test('los extremos caen en el tipo que les corresponde', () => {
  const reservado = perfil.construir(BASE);
  assert.strictEqual(reservado.titulo, 'De grupo corto y buena mesa');

  const expansivo = perfil.construir({
    ...BASE,
    temperamento: 'extrovertido',
    antiestres: 'fiesta',
    planes: 'fiestas',
    relacionamiento: 'lider',
    exploracion: 'aventurero',
    ideas: 'innovadoras',
    informacion: 'viajes',
  });
  assert.strictEqual(expansivo.titulo, 'El que rompe el hielo');
});

test('una respuesta neutra no empuja hacia ningún polo', () => {
  // 'ambivertido' no está en ningún polo de energia_social: el eje tiene que
  // calcularse con las otras tres preguntas, no contarla como "reservado".
  const conNeutra = perfil.construir({ ...BASE, temperamento: 'ambivertido' });
  const eje = conNeutra.ejes.find((e) => e.clave === 'energia_social');
  assert.strictEqual(eje.valor, 0, 'las otras tres siguen siendo del polo bajo');
  assert.strictEqual(eje.preguntas_usadas, 4, 'la neutra sí se contó como contestada');
});

test('un test incompleto da perfil igual, marcando cuántas preguntas lo sostienen', () => {
  const parcial = perfil.construir({ temperamento: 'extrovertido' });
  assert.ok(parcial.titulo, 'hay tipo');
  const energia = parcial.ejes.find((e) => e.clave === 'energia_social');
  assert.strictEqual(energia.valor, 1);
  assert.strictEqual(energia.preguntas_usadas, 1);
  const apertura = parcial.ejes.find((e) => e.clave === 'apertura');
  assert.strictEqual(apertura.valor, null, 'sin respuestas del eje, el valor es null y no 0');
});

test('todo eje declara un valor en [0,1] o null', () => {
  for (const eje of perfil.construir(BASE).ejes) {
    if (eje.valor === null) continue;
    assert.ok(eje.valor >= 0 && eje.valor <= 1, `${eje.clave} fuera de rango: ${eje.valor}`);
  }
});

// La prueba que importa a futuro: "lo que no usamos para agrupar" es una
// promesa que se le hace al usuario en pantalla. Si alguien le diera peso a
// una de esas preguntas en el matching, la promesa sería mentira y nadie se
// enteraría. Acá se entera.
test('lo que el perfil declara que no se usa, el matching no lo usa', () => {
  for (const pregunta of Object.keys(perfil.NO_SE_USAN)) {
    assert.ok(
      matching.PESOS_RESPUESTAS[pregunta] === undefined,
      `${pregunta} se le muestra al usuario como no usada, pero pesa en el matching`
    );
  }
});

test('las preguntas que mueven un eje existen en el cuestionario', () => {
  const DEL_CUESTIONARIO = new Set(Object.keys(BASE));
  for (const eje of perfil.EJES) {
    for (const pregunta of Object.keys(eje.preguntas)) {
      assert.ok(DEL_CUESTIONARIO.has(pregunta), `${pregunta} no existe en el test`);
    }
  }
});
