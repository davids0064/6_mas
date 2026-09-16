const test = require('node:test');
const assert = require('node:assert');

const moderacion = require('../src/services/moderacion');

const oculta = (t) => moderacion.revisar(t).objetable;

test('el chat normal pasa entero', () => {
  for (const frase of [
    'Nos vemos a las 7 en la puerta',
    'Llego 10 minutos tarde, no me esperen para pedir',
    '¿Alguien sabe si hay parqueadero?',
    'Yo soy el del saco azul',
    'No voy a poder ir, lo siento mucho',
  ]) {
    assert.strictEqual(oculta(frase), false, `no debería ocultarse: ${frase}`);
  }
});

test('esconde insultos y amenazas inequívocas', () => {
  assert.ok(oculta('eres un malparido'));
  assert.ok(oculta('TE VOY A MATAR'));
  assert.ok(oculta('te voy a violar'));
});

test('no cae con las variaciones triviales', () => {
  // Las tres formas con las que se esquiva un filtro ingenuo.
  assert.ok(oculta('eres un m4ric0n'), 'sustitución de caracteres');
  assert.ok(oculta('hola puuuuuta'), 'letras repetidas');
  assert.ok(oculta('te  voy   a  matar'), 'espacios de más');
});

test('las tildes no abren un hueco', () => {
  assert.strictEqual(moderacion.normalizar('MARICÓN'), 'maricon');
  assert.strictEqual(moderacion.normalizar('Múérete'), 'muerete');
});

// El falso positivo importa tanto como el negativo: esconder el mensaje de
// alguien que escribió el nombre de una amiga es una forma de romper el chat
// que además nadie reporta, porque quien lo escribió cree que se envió.
test('no castiga palabras que contienen un término dentro', () => {
  assert.strictEqual(oculta('¿Maricarmen viene?'), false);
  assert.strictEqual(oculta('Nos vemos en la Puerta del Sol'), false);
  assert.strictEqual(oculta('Trabajo en Putumayo'), false);
  // Y el contraste: la misma raíz, pero como palabra suelta, sí se esconde.
  assert.strictEqual(oculta('eres una puta'), true);
});

test('revisar dice por qué, para poder revisar el reporte después', () => {
  const r = moderacion.revisar('eres un malparido');
  assert.ok(r.motivo.startsWith('termino:'));
});
