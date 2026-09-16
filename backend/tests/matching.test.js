// ============================================================================
// Escenarios del algoritmo de matching (services/matching.js).
//
// Corre sin base de datos ni servidor: los dos módulos del matching son puros
// a propósito, y esta suite es la razón práctica de esa decisión.
//
//   cd backend && npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const m = require('../src/services/matching');

// --- Utilidades de fixture --------------------------------------------------

const RESPUESTAS_BASE = {
  edad: '25_31', genero_biologico: 'femenino', identidad: 'hetero',
  temperamento: 'extrovertido', localidad: 'pereira', actividades: 'sociales',
  estudios: 'profesional', estado_civil: 'soltero_feliz', planes: 'fiestas',
  decisiones: 'flexibles', ideas: 'innovadoras', plan_musical: 'crossover',
  animal_favorito: 'aire', zodiaco: 'a_veces', exploracion: 'aventurero',
  antiestres: 'amistades', relacionamiento: 'lider', informacion: 'culturales',
  disposicion: 'si', valores: 'si',
};

let contador = 0;
function perfil(over = {}) {
  contador += 1;
  return {
    id: over.id || `u${contador}`,
    nombre: over.nombre || `Usuario ${contador}`,
    // 'intereses' in over y no `||`: un [] o un null explícitos son casos que
    // las pruebas necesitan poder construir (Postgres devuelve null, no undefined).
    intereses: 'intereses' in over ? over.intereses : ['Gastronomía'],
    respuestas: { ...RESPUESTAS_BASE, ...(over.respuestas || {}) },
    // Por defecto cada perfil "espera" un minuto más que el anterior, para que
    // el orden de antigüedad sea el de creación salvo que la prueba lo fije.
    esperando_desde: over.esperando_desde || new Date(Date.UTC(2026, 0, 1, 0, contador)).toISOString(),
  };
}

// ============================================================================
// 1. Afinidad por intereses (Jaccard)
// ============================================================================

test('intereses idénticos dan 1 y disjuntos dan 0', () => {
  assert.equal(m.afinidadIntereses(['A', 'B'], ['A', 'B']), 1);
  assert.equal(m.afinidadIntereses(['A'], ['B']), 0);
});

test('sin intereses de ningún lado no rompe ni inventa afinidad', () => {
  assert.equal(m.afinidadIntereses([], []), 0);
  assert.equal(m.afinidadIntereses(null, null), 0); // Postgres manda null, no undefined
  assert.equal(m.afinidadIntereses(null, ['A']), 0);
});

test('Jaccard no premia a quien marcó todo el catálogo', () => {
  const CATALOGO = ['Música', 'Gastronomía', 'Deporte', 'Lectura', 'Bienestar', 'Tecnología'];
  const especifico = ['Gastronomía', 'Música'];
  const maximalista = CATALOGO;
  const parAfin = ['Gastronomía', 'Música'];

  // Ambos "comparten 2 intereses" con el específico, pero el maximalista no
  // debe empatarle a quien eligió exactamente lo mismo.
  assert.equal(m.afinidadIntereses(especifico, parAfin), 1);
  assert.ok(m.afinidadIntereses(especifico, maximalista) < 0.5);
});

test('la afinidad de intereses es simétrica', () => {
  const a = ['A', 'B', 'C'];
  const b = ['B', 'D'];
  assert.equal(m.afinidadIntereses(a, b), m.afinidadIntereses(b, a));
});

// ============================================================================
// 2. Afinidad por test de personalidad
// ============================================================================

test('tests idénticos dan 1 y todo distinto da 0', () => {
  assert.equal(m.afinidadRespuestas(RESPUESTAS_BASE, RESPUESTAS_BASE), 1);
  const opuesto = Object.fromEntries(
    Object.keys(m.PESOS_RESPUESTAS).map((k) => [k, `otro_${k}`])
  );
  assert.equal(m.afinidadRespuestas(RESPUESTAS_BASE, opuesto), 0);
});

test('las preguntas sensibles no influyen en el score (no se segrega por identidad)', () => {
  const a = perfil().respuestas;
  const b = {
    ...a,
    genero_biologico: 'masculino',
    identidad: 'homosexual',
    disposicion: 'no',
    valores: 'no',
  };
  assert.equal(m.afinidadRespuestas(a, b), 1, 'cambiar identidad/género no debe mover la afinidad');
});

test('un test incompleto solo puntúa las preguntas en común', () => {
  const completo = RESPUESTAS_BASE;
  const parcial = { localidad: 'pereira', planes: 'fiestas' }; // 2 preguntas, ambas iguales
  assert.equal(m.afinidadRespuestas(completo, parcial), 1);

  const parcialMitad = { localidad: 'pereira', planes: 'deportivos' }; // pesos 3 y 3
  assert.equal(m.afinidadRespuestas(completo, parcialMitad), 0.5);
});

test('sin preguntas en común el score es 0 y no NaN', () => {
  assert.equal(m.afinidadRespuestas({}, {}), 0);
  assert.equal(m.afinidadRespuestas(null, null), 0);
  assert.equal(m.afinidadRespuestas({ inventada: 'x' }, { otra: 'y' }), 0);
});

test('las preguntas pesadas mueven el score más que las decorativas', () => {
  const base = perfil().respuestas;
  const cambiaLocalidad = { ...base, localidad: 'manizales' }; // peso 3
  const cambiaZodiaco = { ...base, zodiaco: 'no' };            // peso 0.25
  assert.ok(
    m.afinidadRespuestas(base, cambiaLocalidad) < m.afinidadRespuestas(base, cambiaZodiaco)
  );
});

// ============================================================================
// 3. Afinidad global
// ============================================================================

test('la afinidad global queda siempre en [0,1] y respeta el 50/50', () => {
  const a = perfil({ intereses: ['A', 'B'] });
  const clon = perfil({ intereses: ['A', 'B'] });
  assert.equal(m.afinidad(a, clon), 1);

  const opuesto = perfil({
    intereses: ['Z'],
    respuestas: Object.fromEntries(Object.keys(m.PESOS_RESPUESTAS).map((k) => [k, `x_${k}`])),
  });
  assert.equal(m.afinidad(a, opuesto), 0);

  // Intereses idénticos + test totalmente distinto = exactamente el peso de intereses.
  const mismoInteresOtroTest = perfil({
    intereses: ['A', 'B'],
    respuestas: Object.fromEntries(Object.keys(m.PESOS_RESPUESTAS).map((k) => [k, `x_${k}`])),
  });
  assert.equal(m.afinidad(a, mismoInteresOtroTest), m.PESO_INTERESES);
});

test('explicarAfinidad muestra el porqué del score', () => {
  const a = perfil({ intereses: ['Gastronomía', 'Música'] });
  const b = perfil({ intereses: ['Gastronomía', 'Deporte'], respuestas: { planes: 'deportivos' } });
  const e = m.explicarAfinidad(a, b);
  assert.deepEqual(e.intereses_comunes, ['Gastronomía']);
  assert.ok(e.respuestas_comunes.includes('localidad'));
  assert.ok(!e.respuestas_comunes.includes('planes'), 'planes difiere, no debe listarse');
  assert.ok(!e.respuestas_comunes.includes('identidad'), 'las excluidas no entran ni en la explicación');
  assert.equal(e.score, m.afinidad(a, b));
});

test('cohesión: un grupo de clones da 1, un solo miembro da 0', () => {
  const clones = Array.from({ length: 6 }, () => perfil({ intereses: ['A'] }));
  assert.equal(m.cohesion(clones), 1);
  assert.equal(m.cohesion([perfil()]), 0);
  assert.equal(m.cohesion([]), 0);
});

// ============================================================================
// 4. Formación de grupos
// ============================================================================

test('con 5 candidatos no se forma ningún grupo: nadie queda en un grupo de 5', () => {
  const pool = Array.from({ length: 5 }, () => perfil());
  const { grupos, sobrantes } = m.formarGrupos(pool);
  assert.equal(grupos.length, 0);
  assert.equal(sobrantes.length, 5);
});

test('con exactamente 6 se forma un grupo de 6', () => {
  const pool = Array.from({ length: 6 }, () => perfil());
  const { grupos, sobrantes } = m.formarGrupos(pool);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].miembros.length, 6);
  assert.equal(sobrantes.length, 0);
});

test('con 13 se forman 2 grupos y sobra 1, sin repetir a nadie', () => {
  const pool = Array.from({ length: 13 }, () => perfil());
  const { grupos, sobrantes } = m.formarGrupos(pool);
  assert.equal(grupos.length, 2);
  assert.equal(sobrantes.length, 1);

  const ids = grupos.flatMap((g) => g.miembros.map((x) => x.id));
  assert.equal(new Set(ids).size, 12, 'ningún usuario puede estar en dos grupos');
  const todos = new Set([...ids, ...sobrantes.map((s) => s.id)]);
  assert.equal(todos.size, 13, 'nadie se pierde entre grupos y sobrantes');
});

test('la localidad es filtro duro: 5+5 de dos ciudades no forman grupo', () => {
  const pool = [
    ...Array.from({ length: 5 }, () => perfil({ respuestas: { localidad: 'pereira' } })),
    ...Array.from({ length: 5 }, () => perfil({ respuestas: { localidad: 'manizales' } })),
  ];
  const { grupos, sobrantes } = m.formarGrupos(pool);
  assert.equal(grupos.length, 0, '10 candidatos pero ninguna ciudad junta 6');
  assert.equal(sobrantes.length, 10);
});

test('un clon de otra ciudad no entra al grupo pese a su afinidad altísima', () => {
  const pereiranos = Array.from({ length: 5 }, () => perfil({ intereses: ['Gastronomía'] }));
  const clonLejos = perfil({
    nombre: 'Clon Manizales',
    intereses: ['Gastronomía'],
    respuestas: { localidad: 'manizales' },
  });
  const sexto = perfil({ intereses: ['Deporte'], respuestas: { planes: 'deportivos', temperamento: 'introvertido' } });

  const { grupos } = m.formarGrupos([...pereiranos, clonLejos, sexto]);
  assert.equal(grupos.length, 1);
  const nombres = grupos[0].miembros.map((x) => x.nombre);
  assert.ok(!nombres.includes('Clon Manizales'), 'la ciudad manda sobre la afinidad');
  assert.ok(nombres.includes(sexto.nombre), 'entra el menos afín pero de la misma ciudad');
});

test('con agruparPorLocalidad:false las ciudades se mezclan (perilla para poca masa crítica)', () => {
  const pool = [
    ...Array.from({ length: 3 }, () => perfil({ respuestas: { localidad: 'pereira' } })),
    ...Array.from({ length: 3 }, () => perfil({ respuestas: { localidad: 'manizales' } })),
  ];
  assert.equal(m.formarGrupos(pool).grupos.length, 0);
  const { grupos } = m.formarGrupos(pool, { agruparPorLocalidad: false });
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].localidad, null);
});

test('los usuarios sin localidad quedan en su propio bloque y no contaminan una ciudad', () => {
  const pool = [
    ...Array.from({ length: 4 }, () => perfil({ respuestas: { localidad: 'pereira' } })),
    ...Array.from({ length: 2 }, () => perfil({ respuestas: { localidad: undefined } })),
  ];
  const { grupos, sobrantes } = m.formarGrupos(pool);
  assert.equal(grupos.length, 0, '4 de Pereira + 2 sin ciudad no son 6 de Pereira');
  assert.equal(sobrantes.length, 6);
});

test('el que más esperó es la semilla, aunque sea el menos afín de todos', () => {
  const raro = perfil({
    nombre: 'El raro',
    intereses: ['Tecnología'],
    respuestas: {
      planes: 'deportivos', temperamento: 'introvertido', actividades: 'deportivas',
      antiestres: 'meditar', edad: '45_mas', exploracion: 'tranquilo',
    },
    esperando_desde: '2025-01-01T00:00:00.000Z', // el más viejo del pool
  });
  const afines = Array.from({ length: 8 }, () =>
    perfil({ intereses: ['Gastronomía', 'Música'], esperando_desde: '2026-06-01T00:00:00.000Z' })
  );

  const { grupos } = m.formarGrupos([...afines, raro]);
  assert.equal(grupos.length, 1);
  const nombres = grupos[0].miembros.map((x) => x.nombre);
  assert.ok(
    nombres.includes('El raro'),
    'sin semilla por antigüedad, el perfil atípico nunca entraría a un grupo'
  );
});

test('nadie espera para siempre: en corridas sucesivas el sobrante pasa a semilla', () => {
  // 7 candidatos, uno queda afuera; en la corrida siguiente ese sobrante es el
  // más antiguo del pool y por lo tanto la semilla del grupo nuevo.
  let pool = Array.from({ length: 7 }, (_, i) =>
    perfil({ esperando_desde: new Date(Date.UTC(2026, 0, 1, i)).toISOString() })
  );
  const primera = m.formarGrupos(pool);
  assert.equal(primera.grupos.length, 1);
  const quedoAfuera = primera.sobrantes[0];

  // Llegan 5 nuevos, más recientes que él.
  const nuevos = Array.from({ length: 5 }, (_, i) =>
    perfil({ esperando_desde: new Date(Date.UTC(2026, 5, 1, i)).toISOString() })
  );
  const segunda = m.formarGrupos([quedoAfuera, ...nuevos]);
  assert.equal(segunda.grupos.length, 1);
  assert.ok(segunda.grupos[0].miembros.some((x) => x.id === quedoAfuera.id));
});

test('el algoritmo es determinista: misma entrada, misma salida', () => {
  const pool = Array.from({ length: 12 }, (_, i) =>
    perfil({ intereses: i % 2 ? ['Gastronomía'] : ['Deporte'] })
  );
  const a = m.formarGrupos(pool);
  const b = m.formarGrupos(pool);
  assert.deepEqual(
    a.grupos.map((g) => g.miembros.map((x) => x.id)),
    b.grupos.map((g) => g.miembros.map((x) => x.id))
  );
});

test('formarGrupos no muta el pool que recibe', () => {
  const pool = Array.from({ length: 7 }, () => perfil());
  const copia = [...pool];
  m.formarGrupos(pool);
  assert.deepEqual(pool, copia);
});

test('los grupos salen ordenados por cohesión descendente', () => {
  const cohesionado = Array.from({ length: 6 }, () => perfil({ intereses: ['Gastronomía'] }));
  const disperso = Array.from({ length: 6 }, (_, i) =>
    perfil({
      intereses: [`Interes${i}`],
      respuestas: { planes: `plan${i}`, temperamento: `t${i}`, actividades: `a${i}`, edad: `e${i}` },
    })
  );
  const { grupos } = m.formarGrupos([...disperso, ...cohesionado]);
  assert.equal(grupos.length, 2);
  assert.ok(grupos[0].cohesion >= grupos[1].cohesion);
});

test('la afinidad del grupo formado supera a la de un grupo armado al azar', () => {
  // Dos "tribus" de 6 mezcladas: el algoritmo debe separarlas, no repartirlas.
  const tribuA = Array.from({ length: 6 }, () =>
    perfil({ intereses: ['Gastronomía', 'Música'], respuestas: { planes: 'fiestas' } })
  );
  const tribuB = Array.from({ length: 6 }, () =>
    perfil({
      intereses: ['Deporte', 'Tecnología'],
      respuestas: { planes: 'deportivos', actividades: 'deportivas', temperamento: 'introvertido' },
    })
  );
  const mezclado = [];
  for (let i = 0; i < 6; i++) mezclado.push(tribuA[i], tribuB[i]);

  const { grupos } = m.formarGrupos(mezclado);
  assert.equal(grupos.length, 2);
  for (const g of grupos) {
    const deA = g.miembros.filter((x) => tribuA.includes(x)).length;
    assert.ok(deA === 0 || deA === 6, `el grupo mezcló tribus (${deA} de A)`);
    assert.equal(g.cohesion, 1);
  }
});

// ============================================================================
// 5. Intereses agregados del grupo
// ============================================================================

test('los intereses del grupo se agregan con su peso y orden estable', () => {
  const miembros = [
    perfil({ intereses: ['Gastronomía', 'Música'] }),
    perfil({ intereses: ['Gastronomía', 'Deporte'] }),
    perfil({ intereses: ['Gastronomía'] }),
    perfil({ intereses: ['Música'] }),
    perfil({ intereses: null }), // usuario sin intereses cargados
    perfil({ intereses: [] }),
  ];
  const agregados = m.agregarIntereses(miembros);
  assert.deepEqual(agregados, [
    { interes: 'Gastronomía', peso: 3 },
    { interes: 'Música', peso: 2 },
    { interes: 'Deporte', peso: 1 },
  ]);
});

// ============================================================================
// 6. Puntuación de eventos publicados (categoría por sinónimos)
// ============================================================================

test('la categoría del evento mapea al interés del catálogo, con y sin tilde', () => {
  const agregados = [{ interes: 'Gastronomía', peso: 6 }];
  assert.equal(m.puntuarEvento(agregados, { categoria: 'restaurante' }).score, 1);
  assert.equal(m.puntuarEvento(agregados, { categoria: 'Gastronomia' }).score, 1);
  assert.equal(m.puntuarEvento(agregados, { categoria: '  CAFÉ  ' }).score, 1);
});

test('si el evento no trae categoría se usa la del comercio', () => {
  const agregados = [{ interes: 'Música', peso: 3 }];
  const p = m.puntuarEvento(agregados, { categoria: null, comercio_categoria: 'karaoke' });
  assert.equal(p.interes, 'Música');
  assert.equal(p.score, 0.5);
});

test('una categoría desconocida puntúa 0 en vez de adivinar', () => {
  const p = m.puntuarEvento([{ interes: 'Gastronomía', peso: 6 }], { categoria: 'astrología' });
  assert.equal(p.score, 0);
  assert.equal(p.interes, null);
});

test('elegirEvento respeta el mínimo y desempata por fecha más cercana', () => {
  const agregados = [{ interes: 'Gastronomía', peso: 4 }, { interes: 'Deporte', peso: 2 }];
  const eventos = [
    { id: 'lejano', categoria: 'restaurante', fecha_hora: '2026-09-20T19:00:00-05:00' },
    { id: 'cercano', categoria: 'comida', fecha_hora: '2026-09-10T19:00:00-05:00' },
    { id: 'poco_afin', categoria: 'gimnasio', fecha_hora: '2026-09-01T19:00:00-05:00' },
  ];
  const elegido = m.elegirEvento(agregados, eventos, { scoreMinimo: 0.5 });
  assert.equal(elegido.evento.id, 'cercano');

  // Con el mínimo por encima de lo disponible: sin plan, no un plan malo.
  assert.equal(m.elegirEvento(agregados, [eventos[2]], { scoreMinimo: 0.5 }), null);
  assert.equal(m.elegirEvento(agregados, [], { scoreMinimo: 0 }), null);
});

// ============================================================================
// Bloqueos: quién NO puede compartir mesa con quién.
//
// Apple exige poder bloquear a otro usuario (guideline 1.2). Si el bloqueo solo
// escondiera los mensajes y el sistema volviera a sentar a esas dos personas
// enfrente la semana siguiente, sería un adorno. Estas pruebas son las que
// impiden que el bloqueo se quede en el chat.
// ============================================================================

const perfilDePrueba = (id) => ({
  id,
  nombre: id,
  intereses: ['Gastronomía'],
  respuestas: { localidad: 'pereira' },
  esperando_desde: '2026-01-01',
});

const bloqueoEntre = (a, b) => new Set([`${a}|${b}`, `${b}|${a}`]);

test('dos personas que se bloquearon no terminan en el mismo grupo', () => {
  const siete = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(perfilDePrueba);
  const { grupos } = m.formarGrupos(siete, { incompatibles: bloqueoEntre('a', 'b') });

  assert.strictEqual(grupos.length, 1, 'con siete candidatos todavía sale un grupo');
  const ids = grupos[0].miembros.map((m) => m.id);
  assert.ok(!(ids.includes('a') && ids.includes('b')), `a y b juntos: ${ids.join(',')}`);
});

test('el bloqueo aplica aunque sea unilateral', () => {
  // Solo A bloqueó a B. Que B no haya bloqueado a nadie no lo hace elegible
  // para la mesa de A: el bloqueo lo declara uno y lo sufren los dos.
  const siete = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(perfilDePrueba);
  const soloUnSentido = new Set(['a|b', 'b|a']); // así lo arma cargarIncompatibles
  const { grupos } = m.formarGrupos(siete, { incompatibles: soloUnSentido });
  const ids = grupos[0].miembros.map((m) => m.id);
  assert.ok(!(ids.includes('a') && ids.includes('b')));
});

test('si el bloqueo impide cerrar el grupo, nadie se queda sin volver al pool', () => {
  // Seis candidatos justos y dos que no pueden coincidir: no hay grupo posible.
  // Lo que NO puede pasar es que alguien desaparezca: un grupo a medias que se
  // abandona sin devolver a su gente los dejaría fuera del emparejamiento sin
  // que nadie se entere.
  const seis = ['a', 'b', 'c', 'd', 'e', 'f'].map(perfilDePrueba);
  const { grupos, sobrantes } = m.formarGrupos(seis, { incompatibles: bloqueoEntre('a', 'b') });

  assert.strictEqual(grupos.length, 0);
  assert.strictEqual(sobrantes.length, 6, 'los seis vuelven al pool');
  assert.deepStrictEqual(
    sobrantes.map((s) => s.id).sort(),
    ['a', 'b', 'c', 'd', 'e', 'f'],
    'y son exactamente los mismos seis'
  );
});

test('sin bloqueos el resultado no cambia', () => {
  const seis = ['a', 'b', 'c', 'd', 'e', 'f'].map(perfilDePrueba);
  assert.strictEqual(m.formarGrupos(seis).grupos.length, 1);
  assert.strictEqual(m.formarGrupos(seis, { incompatibles: new Set() }).grupos.length, 1);
});
