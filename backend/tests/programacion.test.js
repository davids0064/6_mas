// ============================================================================
// Escenarios de la programación de planes (services/programacion.js):
// qué experiencia recibe el grupo, en qué comercio y cuándo.
//
// El "ahora" está fijo en todas las pruebas (jueves 6/8/2026, 10:00 Colombia)
// para que la anticipación de 48h y la ventana de 21 días sean verificables y
// no dependan del día en que se corran.
//
//   cd backend && npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const p = require('../src/services/programacion');

const AHORA = new Date('2026-08-06T10:00:00-05:00'); // jueves
const DOM = 0, LUN = 1, MAR = 2, MIE = 3, JUE = 4, VIE = 5, SAB = 6;

function franja(dia_semana, hora_inicio = '19:00', hora_fin = '22:00', grupos_max = 1) {
  return { dia_semana, hora_inicio, hora_fin, grupos_max };
}

/** 'YYYY-MM-DD HH:MM' del instante, en la zona de operación (no en UTC). */
function local(date) {
  return new Date(date.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

// ============================================================================
// 1. Normalización de ciudad (el comercio escribe texto libre)
// ============================================================================

test('la ciudad del comercio se canoniza al formato del test de personalidad', () => {
  assert.equal(p.normalizarCiudad('Pereira'), 'pereira');
  assert.equal(p.normalizarCiudad('  PEREIRA '), 'pereira');
  assert.equal(p.normalizarCiudad('Santa Rosa'), 'santa_rosa');
  assert.equal(p.normalizarCiudad('Santa  Rosa de Cabal'), 'santa_rosa_de_cabal');
  assert.equal(p.normalizarCiudad('Bogotá'), 'bogota');
  assert.equal(p.normalizarCiudad('MEDELLÍN'), 'medellin');
  assert.equal(p.normalizarCiudad(null), null);
  assert.equal(p.normalizarCiudad(''), null);
});

// ============================================================================
// 2. Primer hueco disponible
// ============================================================================

test('no se programa nada dentro de las próximas 48h', () => {
  // Hoy es jueves: la franja del jueves de esta semana está a 9h y no sirve.
  const hueco = p.primerHueco([franja(JUE)], 120, [], AHORA);
  assert.equal(local(hueco), '2026-08-13 19:00', 'saltó al jueves siguiente');
  assert.ok((hueco - AHORA) / 3600000 >= 48);
});

test('elige el primer día hábil de la ventana, no el más lejano', () => {
  const hueco = p.primerHueco([franja(JUE), franja(SAB), franja(VIE)], 120, [], AHORA);
  assert.equal(local(hueco), '2026-08-08 19:00', 'sábado 8 es el primero que cumple las 48h');
});

test('dentro de un mismo día gana la franja más temprana', () => {
  const franjas = [franja(SAB, '20:00', '23:00'), franja(SAB, '12:00', '15:00')];
  const hueco = p.primerHueco(franjas, 120, [], AHORA);
  assert.equal(local(hueco), '2026-08-08 12:00');
});

test('el plan tiene que caber entero en la franja, no solo empezar dentro', () => {
  // Cena de 2h contra una franja de 1h: no entra.
  assert.equal(p.primerHueco([franja(SAB, '19:00', '20:00')], 120, [], AHORA), null);
  // Franja de exactamente la duración: entra.
  const justo = p.primerHueco([franja(SAB, '19:00', '21:00')], 120, [], AHORA);
  assert.equal(local(justo), '2026-08-08 19:00');
});

test('una franja llena por grupos_max se salta al siguiente día declarado', () => {
  const franjas = [franja(SAB, '19:00', '22:00', 1), franja(LUN, '19:00', '22:00', 1)];
  const ocupacion = [{ fecha_hora: '2026-08-08T19:00:00-05:00' }]; // sábado tomado
  const hueco = p.primerHueco(franjas, 120, ocupacion, AHORA);
  assert.equal(local(hueco), '2026-08-10 19:00', 'lunes 10');
});

test('con grupos_max 2 caben dos grupos la misma noche', () => {
  const franjas = [franja(SAB, '19:00', '22:00', 2)];
  const uno = [{ fecha_hora: '2026-08-08T19:00:00-05:00' }];
  assert.equal(local(p.primerHueco(franjas, 120, uno, AHORA)), '2026-08-08 19:00');

  const dos = [...uno, { fecha_hora: '2026-08-08T19:30:00-05:00' }];
  // Llena esa noche: se va al sábado siguiente.
  assert.equal(local(p.primerHueco(franjas, 120, dos, AHORA)), '2026-08-15 19:00');
});

test('la ocupación de otro día no consume el cupo del día buscado', () => {
  const franjas = [franja(SAB, '19:00', '22:00', 1)];
  const otroDia = [{ fecha_hora: '2026-08-15T19:00:00-05:00' }]; // el sábado siguiente
  assert.equal(local(p.primerHueco(franjas, 120, otroDia, AHORA)), '2026-08-08 19:00');
});

test('sin franjas, o sin franjas en la ventana, no hay hueco', () => {
  assert.equal(p.primerHueco([], 120, [], AHORA), null);
  // Ventana de 1 día (viernes 7) contra una franja de lunes: nada.
  assert.equal(p.primerHueco([franja(LUN)], 120, [], AHORA, { diasVentana: 1 }), null);
});

test('la ventana de 21 días acota la espera: más allá no se programa', () => {
  const franjas = [franja(SAB, '19:00', '22:00', 1)];
  // Los tres sábados de la ventana ocupados → null, el grupo espera en vez de
  // recibir fecha para dentro de un mes.
  const ocupacion = ['2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29'].map((d) => ({
    fecha_hora: `${d}T19:00:00-05:00`,
  }));
  assert.equal(p.primerHueco(franjas, 120, ocupacion, AHORA), null);
});

test('las horas mínimas y la ventana son configurables', () => {
  // Con 4h de anticipación la franja del jueves de hoy (19:00) ya sirve.
  const hueco = p.primerHueco([franja(JUE)], 120, [], AHORA, { horasMinimas: 4 });
  assert.equal(local(hueco), '2026-08-06 19:00');
});

test('la fecha se construye en la zona de operación, no en la del servidor', () => {
  const inicio = p.instante('2026-08-08', '19:00');
  assert.equal(inicio.toISOString(), '2026-08-09T00:00:00.000Z', '19:00 Colombia = 00:00 UTC del día siguiente');
  assert.equal(p.diaSemana('2026-08-08'), SAB);
});

// ============================================================================
// 3. Elección de oferta: afinidad > tier > fecha
// ============================================================================

const INTERESES_GRUPO = [
  { interes: 'Gastronomía', peso: 5 },
  { interes: 'Deporte', peso: 2 },
  { interes: 'Tecnología', peso: 1 },
];

function oferta(over = {}) {
  return {
    comercio_id: over.comercio_id,
    comercio_nombre: over.comercio_nombre || over.comercio_id,
    plan_id: `plan-${over.comercio_id}`,
    titulo: over.titulo || 'Plan',
    interes: over.interes || 'Gastronomía',
    ciudad: over.ciudad || 'Pereira',
    duracion_min: over.duracion_min || 120,
    capacidad: 6,
    precio: 80000,
    tier: over.tier || 'bronce',
    nivel_tier: over.nivel_tier ?? 1,
  };
}

/** Arma los índices que espera elegirOferta a partir de una lista de ofertas. */
function contexto(ofertas, franjasPorId = {}) {
  const franjas = new Map();
  const ocupacion = new Map();
  for (const o of ofertas) {
    franjas.set(o.comercio_id, franjasPorId[o.comercio_id] || [franja(SAB), franja(VIE), franja(JUE)]);
    ocupacion.set(o.comercio_id, []);
  }
  return { franjas, ocupacion };
}

test('entre dos ofertas igual de afines gana el tier más alto', () => {
  const ofertas = [
    oferta({ comercio_id: 'bronce', tier: 'bronce', nivel_tier: 1 }),
    oferta({ comercio_id: 'premium', tier: 'premium', nivel_tier: 4 }),
  ];
  const { franjas, ocupacion } = contexto(ofertas);
  const elegida = p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, {
    ahora: AHORA, ciudad: 'pereira',
  });
  assert.equal(elegida.oferta.comercio_id, 'premium');
  assert.equal(elegida.score, 5 / 6);
});

test('el tier NUNCA le gana a la afinidad: premium poco afín pierde con bronce afín', () => {
  const ofertas = [
    oferta({ comercio_id: 'bronce', interes: 'Gastronomía', tier: 'bronce', nivel_tier: 1 }),
    oferta({ comercio_id: 'premium_tech', interes: 'Tecnología', tier: 'premium', nivel_tier: 4 }),
  ];
  const { franjas, ocupacion } = contexto(ofertas);
  const elegida = p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, {
    ahora: AHORA, ciudad: 'pereira',
  });
  assert.equal(elegida.oferta.comercio_id, 'bronce');
});

test('la ciudad filtra: un premium de otra ciudad no compite', () => {
  const ofertas = [
    oferta({ comercio_id: 'lejos', ciudad: 'Manizales', tier: 'premium', nivel_tier: 4 }),
    oferta({ comercio_id: 'local', ciudad: 'Pereira', tier: 'bronce', nivel_tier: 1 }),
  ];
  const { franjas, ocupacion } = contexto(ofertas);
  const elegida = p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, {
    ahora: AHORA, ciudad: 'pereira',
  });
  assert.equal(elegida.oferta.comercio_id, 'local');

  // Y si la única oferta está en otra ciudad, el grupo se queda sin plan.
  const soloLejos = [ofertas[0]];
  const ctx2 = contexto(soloLejos);
  assert.equal(
    p.elegirOferta(INTERESES_GRUPO, soloLejos, ctx2.franjas, ctx2.ocupacion, { ahora: AHORA, ciudad: 'pereira' }),
    null
  );
});

test('la ciudad se compara canonizada: "Santa Rosa" del comercio = "santa_rosa" del test', () => {
  const ofertas = [oferta({ comercio_id: 'sr', ciudad: 'Santa Rosa' })];
  const { franjas, ocupacion } = contexto(ofertas);
  const elegida = p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, {
    ahora: AHORA, ciudad: 'santa_rosa',
  });
  assert.equal(elegida.oferta.comercio_id, 'sr');
});

test('por debajo del score mínimo el grupo queda sin plan en vez de recibir uno malo', () => {
  // Tecnología la comparte 1 de 6 = 0.166, muy por debajo de 0.5.
  const ofertas = [oferta({ comercio_id: 'tech', interes: 'Tecnología' })];
  const { franjas, ocupacion } = contexto(ofertas);
  assert.equal(
    p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, { ahora: AHORA, ciudad: 'pereira' }),
    null
  );
});

test('el umbral es exactamente "la mitad del grupo": 3 de 6 entra, 2 de 6 no', () => {
  const ofertas = [oferta({ comercio_id: 'c', interes: 'Deporte' })];
  const { franjas, ocupacion } = contexto(ofertas);
  const opts = { ahora: AHORA, ciudad: 'pereira' };

  const mitad = [{ interes: 'Deporte', peso: 3 }];
  assert.ok(p.elegirOferta(mitad, ofertas, franjas, ocupacion, opts), '3 de 6 = 0.5, entra');

  const bajoMitad = [{ interes: 'Deporte', peso: 2 }];
  assert.equal(p.elegirOferta(bajoMitad, ofertas, franjas, ocupacion, opts), null);
});

test('una oferta afín pero sin cupo en la ventana cede ante una afín con cupo', () => {
  const ofertas = [
    oferta({ comercio_id: 'premium_lleno', tier: 'premium', nivel_tier: 4 }),
    oferta({ comercio_id: 'bronce_libre', tier: 'bronce', nivel_tier: 1 }),
  ];
  const { franjas, ocupacion } = contexto(ofertas, {
    premium_lleno: [franja(SAB, '19:00', '22:00', 1)],
    bronce_libre: [franja(SAB, '19:00', '22:00', 1)],
  });
  // Los cuatro sábados que caen dentro de la ventana de 21 días.
  ocupacion.set('premium_lleno', ['2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29'].map((d) => ({
    fecha_hora: `${d}T19:00:00-05:00`,
  })));

  const elegida = p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, {
    ahora: AHORA, ciudad: 'pereira',
  });
  assert.equal(elegida.oferta.comercio_id, 'bronce_libre');
});

test('a igual afinidad y tier, gana la fecha más cercana', () => {
  const ofertas = [
    oferta({ comercio_id: 'tarde', nivel_tier: 2 }),
    oferta({ comercio_id: 'pronto', nivel_tier: 2 }),
  ];
  const { franjas, ocupacion } = contexto(ofertas, {
    tarde: [franja(MIE)],   // miércoles 12
    pronto: [franja(SAB)],  // sábado 8
  });
  const elegida = p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, {
    ahora: AHORA, ciudad: 'pereira',
  });
  assert.equal(elegida.oferta.comercio_id, 'pronto');
  assert.equal(local(elegida.fecha_hora), '2026-08-08 19:00');
});

test('un premium con cupo lejano le gana a un bronce con cupo cercano (la política, explícita)', () => {
  // Documenta el trade-off que el README advierte: el tier compra prioridad
  // aunque el grupo espere más, siempre dentro de la ventana.
  const ofertas = [
    oferta({ comercio_id: 'premium_tarde', tier: 'premium', nivel_tier: 4 }),
    oferta({ comercio_id: 'bronce_pronto', tier: 'bronce', nivel_tier: 1 }),
  ];
  const { franjas, ocupacion } = contexto(ofertas, {
    premium_tarde: [franja(MIE)],
    bronce_pronto: [franja(SAB)],
  });
  const elegida = p.elegirOferta(INTERESES_GRUPO, ofertas, franjas, ocupacion, {
    ahora: AHORA, ciudad: 'pereira',
  });
  assert.equal(elegida.oferta.comercio_id, 'premium_tarde');
  assert.equal(local(elegida.fecha_hora), '2026-08-12 19:00');
});

test('sin oferta no hay plan (nunca se inventa un match)', () => {
  assert.equal(p.elegirOferta(INTERESES_GRUPO, [], new Map(), new Map(), { ahora: AHORA }), null);
});

test('indexarPorComercio agrupa las filas por comercio', () => {
  const mapa = p.indexarPorComercio([
    { comercio_id: 'a', x: 1 }, { comercio_id: 'b', x: 2 }, { comercio_id: 'a', x: 3 },
  ]);
  assert.equal(mapa.get('a').length, 2);
  assert.equal(mapa.get('b').length, 1);
  assert.equal(mapa.get('c'), undefined);
});
