// ============================================================================
// Algoritmo de matching de Seis Más.
//
// Este módulo es *puro*: no toca la base de datos ni Express. Recibe perfiles
// ya cargados y devuelve la propuesta de grupos. Está separado de
// routes/matching.js por tres razones:
//   1. Se puede probar sin levantar servidor ni Postgres.
//   2. El mismo scoring lo van a necesitar otros consumidores (un job
//      nocturno, el panel de comercios) sin pasar por HTTP.
//   3. Cuando la Fase 3 reemplace la heurística por un modelo entrenado,
//      el cambio queda contenido acá y el contrato de la API no se mueve.
//
// La heurística (no es IA todavía, y a propósito): afinidad = mezcla de
// intereses compartidos (Jaccard) y coincidencia ponderada de las respuestas
// del test de personalidad. La formación de grupos es un greedy con semilla
// por antigüedad de espera, que garantiza que nadie se quede indefinidamente
// sin grupo por tener baja afinidad con todos.
// ============================================================================

const TAMANO_GRUPO = 6;

// Peso de cada pregunta del test en el score de afinidad.
//
// El criterio: pesa alto lo que determina si el plan es *viable y disfrutable
// en conjunto* (dónde viven, qué planes les gustan, cuánta energía social
// tienen, rango de edad), y bajo lo que es color de perfil (zodiaco, animal
// favorito). Las preguntas que no aparecen acá (genero_biologico, identidad,
// disposicion, valores) se excluyen del score a propósito: son datos
// sensibles o de consentimiento, no criterios de compatibilidad, y usarlos
// para agrupar sería segregar por identidad.
const PESOS_RESPUESTAS = {
  localidad: 3,
  planes: 3,
  temperamento: 2,
  actividades: 2,
  antiestres: 2,
  edad: 2,
  exploracion: 1.5,
  informacion: 1.5,
  plan_musical: 1,
  ideas: 1,
  decisiones: 1,
  estado_civil: 0.5,
  estudios: 0.5,
  relacionamiento: 0.5,
  animal_favorito: 0.25,
  zodiaco: 0.25,
};

// Cuánto pesa el catálogo de intereses frente al test de personalidad.
// 50/50: los intereses dicen *qué plan* les sirve, el test dice *con quién*
// la van a pasar bien. Un plan de gastronomía con 6 introvertidos que no
// quieren salir falla igual que un plan perfecto con gente incompatible.
const PESO_INTERESES = 0.5;

// La localidad es requisito duro cuando se activa `agruparPorLocalidad`: los
// planes de Seis Más son presenciales, y juntar a alguien de Manizales con
// cinco de Pereira no es un match, es un viaje. Se deja configurable porque
// en ciudades con poca masa crítica conviene apagarlo para poder cerrar grupos.
//
// Nota: `localidad` además pesa 3 en PESOS_RESPUESTAS, o sea que cuenta dos
// veces. No es un descuido: con la partición activa todos los miembros de un
// bloque comparten localidad, así que ese peso es una constante que no altera
// el ranking dentro del bloque; y con la partición apagada el peso queda como
// preferencia suave, que es exactamente el comportamiento deseado ahí.
const CLAVE_LOCALIDAD = 'localidad';

/**
 * Similitud de Jaccard entre dos conjuntos de intereses (por id o nombre).
 * |A ∩ B| / |A ∪ B| → 0 cuando no comparten nada, 1 cuando son idénticos.
 * Se prefiere Jaccard sobre "cantidad de intereses en común" porque no
 * premia a quien marcó los 6 intereses del catálogo.
 */
function afinidadIntereses(a, b) {
  // Los valores llegan de Postgres, donde un usuario sin intereses o sin test
  // trae null (no undefined), así que el default de parámetro no alcanza.
  const setA = new Set(a || []);
  const setB = new Set(b || []);
  if (setA.size === 0 && setB.size === 0) return 0;
  let interseccion = 0;
  for (const x of setA) if (setB.has(x)) interseccion += 1;
  const union = setA.size + setB.size - interseccion;
  return union === 0 ? 0 : interseccion / union;
}

/**
 * Coincidencia ponderada de las respuestas del test.
 * Solo se consideran las preguntas que ambos respondieron, así un test
 * incompleto (o una versión vieja del cuestionario con menos preguntas) baja
 * la confianza pero no rompe el cálculo.
 */
function afinidadRespuestas(respuestasA, respuestasB) {
  const a = respuestasA || {};
  const b = respuestasB || {};
  let obtenido = 0;
  let total = 0;
  for (const [pregunta, peso] of Object.entries(PESOS_RESPUESTAS)) {
    if (a[pregunta] === undefined || b[pregunta] === undefined) continue;
    total += peso;
    if (a[pregunta] === b[pregunta]) obtenido += peso;
  }
  return total === 0 ? 0 : obtenido / total;
}

/**
 * Afinidad global entre dos perfiles, en [0, 1].
 * perfil = { id, intereses: string[], respuestas: object }
 */
function afinidad(p1, p2) {
  return (
    PESO_INTERESES * afinidadIntereses(p1.intereses, p2.intereses) +
    (1 - PESO_INTERESES) * afinidadRespuestas(p1.respuestas, p2.respuestas)
  );
}

/** Desglose explicable de un par: sirve para depurar y para mostrar "por qué". */
function explicarAfinidad(p1, p2) {
  const comunes = (p1.intereses || []).filter((i) => (p2.intereses || []).includes(i));
  const respuestasComunes = Object.keys(PESOS_RESPUESTAS).filter(
    (q) => p1.respuestas?.[q] !== undefined && p1.respuestas[q] === p2.respuestas?.[q]
  );
  return {
    score: afinidad(p1, p2),
    score_intereses: afinidadIntereses(p1.intereses, p2.intereses),
    score_test: afinidadRespuestas(p1.respuestas, p2.respuestas),
    intereses_comunes: comunes,
    respuestas_comunes: respuestasComunes,
  };
}

/** Afinidad media de un perfil contra todos los miembros de un grupo parcial. */
function afinidadConGrupo(perfil, miembros) {
  if (miembros.length === 0) return 0;
  return miembros.reduce((acc, m) => acc + afinidad(perfil, m), 0) / miembros.length;
}

/** Cohesión = afinidad media de todos los pares del grupo. */
function cohesion(miembros) {
  const pares = [];
  for (let i = 0; i < miembros.length; i++) {
    for (let j = i + 1; j < miembros.length; j++) {
      pares.push(afinidad(miembros[i], miembros[j]));
    }
  }
  return pares.length === 0 ? 0 : pares.reduce((a, b) => a + b, 0) / pares.length;
}

/**
 * Forma grupos de `tamano` a partir de un pool de perfiles.
 *
 * Estrategia (greedy con semilla por antigüedad):
 *   1. Se elige como semilla al perfil que lleva más tiempo esperando grupo.
 *      Esto es deliberado: un greedy que arranca por el par más afín deja a
 *      los perfiles "raros" sin grupo para siempre. Anclando en el que más
 *      esperó, la espera máxima queda acotada aunque baje la cohesión media.
 *   2. Se agregan de a uno los candidatos que maximizan la afinidad media
 *      con los ya elegidos, hasta completar el grupo.
 *   3. Se repite mientras queden al menos `tamano` perfiles disponibles.
 *
 * Los que sobran (menos de `tamano`) NO se agrupan: un grupo de 4 no es el
 * producto. Quedan en espera para la siguiente corrida, con su antigüedad
 * acumulada, que es justo lo que los pone primeros como semilla.
 *
 * @param {Array} perfiles pool de candidatos
 * @param {object} opciones { tamano, agruparPorLocalidad }
 * @returns {{ grupos: Array, sobrantes: Array }}
 */
function formarGrupos(perfiles, opciones = {}) {
  const tamano = opciones.tamano || TAMANO_GRUPO;
  const agruparPorLocalidad = opciones.agruparPorLocalidad !== false;

  // Partición por localidad: cada bloque se resuelve por separado, así el
  // greedy nunca puede mezclar ciudades aunque la afinidad diera alta.
  const bloques = new Map();
  for (const p of perfiles) {
    const clave = agruparPorLocalidad ? p.respuestas?.[CLAVE_LOCALIDAD] ?? 'sin_localidad' : 'todos';
    if (!bloques.has(clave)) bloques.set(clave, []);
    bloques.get(clave).push(p);
  }

  const grupos = [];
  const sobrantes = [];

  for (const [localidad, bloque] of bloques) {
    // Más antiguo primero; `esperando_desde` es un ISO string o Date.
    const disponibles = [...bloque].sort(
      (a, b) => new Date(a.esperando_desde || 0) - new Date(b.esperando_desde || 0)
    );

    while (disponibles.length >= tamano) {
      const miembros = [disponibles.shift()];

      while (miembros.length < tamano) {
        let mejorIdx = 0;
        let mejorScore = -1;
        disponibles.forEach((candidato, idx) => {
          const score = afinidadConGrupo(candidato, miembros);
          // Empate → gana el que lleva más esperando, porque `disponibles` ya
          // viene ordenado por antigüedad y solo se reemplaza con `>`.
          if (score > mejorScore) {
            mejorScore = score;
            mejorIdx = idx;
          }
        });
        miembros.push(disponibles.splice(mejorIdx, 1)[0]);
      }

      grupos.push({
        localidad: agruparPorLocalidad ? localidad : null,
        miembros,
        cohesion: cohesion(miembros),
        intereses_agregados: agregarIntereses(miembros),
      });
    }

    sobrantes.push(...disponibles);
  }

  // Grupos más cohesionados primero: si la corrida se aplica parcialmente,
  // se materializan antes los mejores.
  grupos.sort((a, b) => b.cohesion - a.cohesion);
  return { grupos, sobrantes };
}

/**
 * Intereses del grupo con su peso = cuántos miembros lo comparten.
 * Es exactamente lo que se persiste en la tabla grupo_intereses y lo que se
 * usa después para elegir el evento del grupo.
 */
function agregarIntereses(miembros) {
  const conteo = new Map();
  for (const m of miembros) {
    for (const i of m.intereses || []) {
      conteo.set(i, (conteo.get(i) || 0) + 1);
    }
  }
  return [...conteo.entries()]
    .map(([interes, peso]) => ({ interes, peso }))
    .sort((a, b) => b.peso - a.peso || a.interes.localeCompare(b.interes));
}

/**
 * Puntúa qué tan bien le cae un evento a un grupo, en [0, 1].
 *
 * La categoría del evento (o, si viene vacía, la del comercio) se compara
 * contra los intereses del grupo vía SINONIMOS_CATEGORIA. Es un mapeo en
 * código y no en la BD porque las categorías de comercio son texto libre hoy;
 * cuando se normalicen a tabla paramétrica, esto se reemplaza por un join.
 */
const SINONIMOS_CATEGORIA = {
  música: 'Música', musica: 'Música', concierto: 'Música', bar: 'Música', karaoke: 'Música',
  deporte: 'Deporte', deportivo: 'Deporte', gimnasio: 'Deporte', outdoor: 'Deporte',
  gastronomía: 'Gastronomía', gastronomia: 'Gastronomía', restaurante: 'Gastronomía',
  café: 'Gastronomía', cafe: 'Gastronomía', comida: 'Gastronomía', cocina: 'Gastronomía',
  lectura: 'Lectura', libros: 'Lectura', librería: 'Lectura', libreria: 'Lectura',
  cultura: 'Lectura', cultural: 'Lectura',
  bienestar: 'Bienestar', spa: 'Bienestar', yoga: 'Bienestar', meditación: 'Bienestar',
  salud: 'Bienestar', naturaleza: 'Bienestar',
  tecnología: 'Tecnología', tecnologia: 'Tecnología', tech: 'Tecnología',
  gaming: 'Tecnología', videojuegos: 'Tecnología',
};

function interesDeCategoria(categoria) {
  if (!categoria) return null;
  return SINONIMOS_CATEGORIA[categoria.trim().toLowerCase()] || null;
}

/**
 * @param {Array} interesesAgregados salida de agregarIntereses()
 * @param {object} evento { categoria, comercio_categoria }
 * @returns {{ score:number, interes:string|null }} score = fracción del grupo
 *          que comparte el interés al que mapea el evento (peso/6).
 */
function puntuarEvento(interesesAgregados, evento, tamano = TAMANO_GRUPO) {
  const interes = interesDeCategoria(evento.categoria) || interesDeCategoria(evento.comercio_categoria);
  if (!interes) return { score: 0, interes: null };
  const encontrado = interesesAgregados.find((i) => i.interes === interes);
  return { score: encontrado ? encontrado.peso / tamano : 0, interes };
}

/**
 * Elige el mejor evento disponible para un grupo.
 * Desempate: mayor score → fecha más cercana. Devuelve null si no hay eventos
 * (nunca inventa un match: un grupo sin plan afín es mejor que un plan malo,
 * porque el feedback de un plan malo cuesta más que la espera).
 */
function elegirEvento(interesesAgregados, eventos, opciones = {}) {
  const minimo = opciones.scoreMinimo ?? 0;
  const puntuados = eventos
    .map((e) => ({ evento: e, ...puntuarEvento(interesesAgregados, e) }))
    .filter((p) => p.score >= minimo)
    .sort((a, b) => b.score - a.score || new Date(a.evento.fecha_hora) - new Date(b.evento.fecha_hora));
  return puntuados[0] || null;
}

module.exports = {
  TAMANO_GRUPO,
  PESOS_RESPUESTAS,
  PESO_INTERESES,
  afinidad,
  afinidadIntereses,
  afinidadRespuestas,
  afinidadConGrupo,
  explicarAfinidad,
  cohesion,
  formarGrupos,
  agregarIntereses,
  puntuarEvento,
  elegirEvento,
};
