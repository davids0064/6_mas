// ============================================================================
// Perfil de personalidad: qué le devolvemos a alguien que contestó 20 preguntas.
//
// Hasta ahora la app pedía las 20 respuestas y no devolvía nada: la columna
// `resultado` de `tests_personalidad` se guardaba siempre NULL. Veinte
// preguntas a cambio de una pantalla de espera es, además de mal producto, la
// clase de vacío que se lee como "app sin funcionalidad".
//
// Este módulo es *puro*, como services/matching.js: recibe el objeto de
// respuestas y devuelve el perfil. Sin base de datos y sin Express, para
// poder probarlo entero sin levantar nada.
//
// QUÉ NO ES: no es un test psicométrico ni pretende serlo. Es una lectura de
// las respuestas con pesos declarados, escrita para que la persona entienda
// con qué criterio la vamos a sentar con otras cinco. Por eso ningún texto
// afirma nada clínico ni diagnostica nada; describen preferencias sociales,
// que es lo único que las preguntas miden.
// ============================================================================

// Cada eje declara, por pregunta, qué respuestas empujan hacia cada extremo.
// El valor del eje es (aciertos hacia el polo alto) / (preguntas respondidas
// que cuentan para el eje): un número en [0, 1] que no depende de cuántas
// contestó, así un test viejo con menos preguntas sigue dando un perfil
// legible en vez de romperse.
const EJES = [
  {
    clave: 'energia_social',
    etiqueta: 'Energía social',
    polos: ['Reservado', 'Expansivo'],
    // Cuánta gente y cuánto ruido te sienta bien, no cuánto "vales" socialmente.
    preguntas: {
      temperamento: { alto: ['extrovertido'], bajo: ['introvertido'] },
      antiestres: { alto: ['fiesta', 'amistades'], bajo: ['meditar', 'dormir', 'naturaleza'] },
      planes: { alto: ['fiestas', 'clubes_deportivos'], bajo: ['hogarenos', 'sin_planes'] },
      relacionamiento: { alto: ['lider'], bajo: ['seguidor'] },
    },
  },
  {
    clave: 'apertura',
    etiqueta: 'Apetito de novedad',
    polos: ['De lo conocido', 'De lo nuevo'],
    preguntas: {
      exploracion: { alto: ['aventurero'], bajo: ['territorial', 'tranquilo'] },
      ideas: { alto: ['innovadoras'], bajo: ['tradicionales'] },
      informacion: { alto: ['viajes', 'misticos'], bajo: ['negocios', 'politicos'] },
    },
  },
  {
    clave: 'estructura',
    etiqueta: 'Cómo decides',
    polos: ['Sobre la marcha', 'Con un plan'],
    preguntas: {
      decisiones: { alto: ['logicas'], bajo: ['impulsivas', 'influenciables'] },
      ideas: { alto: ['criticas', 'tradicionales'], bajo: ['innovadoras'] },
      exploracion: { alto: ['territorial'], bajo: ['aventurero'] },
    },
  },
];

// Las cuatro combinaciones de los dos ejes que más determinan cómo se vive una
// mesa con cinco desconocidos. El título es descriptivo, no un veredicto.
const TIPOS = [
  {
    energiaAlta: true,
    aperturaAlta: true,
    titulo: 'El que rompe el hielo',
    resumen:
      'Te mueve la gente nueva y los planes que no conocías. En una mesa de seis sueles ser quien arranca la conversación y propone lo siguiente.',
  },
  {
    energiaAlta: true,
    aperturaAlta: false,
    titulo: 'El anfitrión de casa',
    resumen:
      'Disfrutas la mesa llena, pero sobre terreno conocido. Te lo pasas mejor cuando el plan es claro y la conversación puede estirarse sin sobresaltos.',
  },
  {
    energiaAlta: false,
    aperturaAlta: true,
    titulo: 'El explorador tranquilo',
    resumen:
      'Te interesa lo que no conocías más que el ruido. Sueles escuchar primero y entrar cuando la conversación se pone concreta.',
  },
  {
    energiaAlta: false,
    aperturaAlta: false,
    titulo: 'De grupo corto y buena mesa',
    resumen:
      'Prefieres la conversación de pocos y sin prisa. Seis es tu límite cómodo, y por eso los grupos son de seis.',
  },
];

// Preguntas que el emparejamiento NO usa, y por qué. Se le devuelven a la
// persona junto al perfil a propósito: son datos sensibles que pedimos, y
// quien los da tiene derecho a saber que no se usan para agrupar. Es la misma
// lista que services/matching.js excluye de PESOS_RESPUESTAS — si una se
// agregara allá sin quitarla de acá, la prueba de perfilPersonalidad falla.
const NO_SE_USAN = {
  genero_biologico: 'No agrupamos por género.',
  identidad: 'No agrupamos por orientación ni identidad.',
  // Los dos textos son distintos a propósito: las dos preguntas se excluyen
  // por el mismo motivo de fondo, pero repetir la misma frase en pantalla se
  // lee como un error de la app, no como una explicación.
  disposicion: 'Tu disposición a ir es una condición para participar, no un rasgo tuyo.',
  valores: 'Lo que respondiste sobre respeto y convivencia es un compromiso, no un rasgo.',
};

/** Valor de un eje en [0, 1], o null si no contestó ninguna de sus preguntas. */
function valorDeEje(eje, respuestas) {
  let altos = 0;
  let contadas = 0;
  for (const [pregunta, polos] of Object.entries(eje.preguntas)) {
    const r = respuestas[pregunta];
    if (r === undefined) continue;
    if (polos.alto.includes(r)) {
      altos += 1;
      contadas += 1;
    } else if (polos.bajo.includes(r)) {
      contadas += 1;
    }
    // Una respuesta que no está en ninguno de los dos polos (p. ej.
    // 'ambivertido') no cuenta ni a favor ni en contra: es neutra de verdad,
    // y meterla al denominador la convertiría en un voto hacia el polo bajo.
  }
  // Redondeado a dos decimales: el eje se dibuja como una posición en una
  // barra, y 0.3333333333333333 no significa nada más preciso que 0.33.
  return contadas === 0 ? null : Math.round((altos / contadas) * 100) / 100;
}

/**
 * Construye el perfil a partir de las respuestas del test.
 * Devuelve null si no hay con qué: sin respuestas no se inventa un perfil.
 */
function construir(respuestas) {
  if (!respuestas || typeof respuestas !== 'object' || Object.keys(respuestas).length === 0) {
    return null;
  }

  const ejes = EJES.map((eje) => {
    const valor = valorDeEje(eje, respuestas);
    return {
      clave: eje.clave,
      etiqueta: eje.etiqueta,
      polo_bajo: eje.polos[0],
      polo_alto: eje.polos[1],
      valor,
      // Cuántas de las preguntas del eje contestó: la app lo usa para no
      // presentar como firme un eje calculado con una sola respuesta.
      preguntas_usadas: Object.keys(eje.preguntas).filter((q) => respuestas[q] !== undefined).length,
    };
  });

  const porClave = Object.fromEntries(ejes.map((e) => [e.clave, e.valor]));
  // Sin dato en un eje se toma el centro: el tipo es una lectura aproximada y
  // vale más dar una que negarse por una pregunta sin contestar.
  const energiaAlta = (porClave.energia_social ?? 0.5) >= 0.5;
  const aperturaAlta = (porClave.apertura ?? 0.5) >= 0.5;
  const tipo = TIPOS.find((t) => t.energiaAlta === energiaAlta && t.aperturaAlta === aperturaAlta);

  return {
    version: 1,
    titulo: tipo.titulo,
    resumen: tipo.resumen,
    ejes,
    no_se_usan: Object.entries(NO_SE_USAN)
      .filter(([pregunta]) => respuestas[pregunta] !== undefined)
      .map(([pregunta, motivo]) => ({ pregunta, motivo })),
  };
}

module.exports = { construir, EJES, TIPOS, NO_SE_USAN };
