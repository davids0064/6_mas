// ============================================================================
// Programación de planes: dado un grupo ya formado, elige QUÉ experiencia
// recibe, EN QUÉ comercio y CUÁNDO.
//
// Separado de services/matching.js a propósito: ese módulo responde "quiénes
// van juntos" (afinidad entre personas) y este responde "a dónde y cuándo van"
// (oferta, disponibilidad y tier comercial). Son dos problemas con datos y
// dueños distintos — el primero lo alimenta el usuario, el segundo el
// comercio — y mezclarlos haría que un cambio de política comercial toque el
// código que decide con quién se junta la gente.
//
// Como matching.js, es puro: recibe filas ya leídas y no toca la BD.
// ============================================================================

// Colombia no tiene horario de verano, así que un offset fijo alcanza y es
// preferible a depender de la zona horaria del servidor (en Railway es UTC,
// en la Mac del dev es America/Bogota; construir fechas "locales" daría
// resultados distintos en cada entorno).
const OFFSET_ZONA = process.env.ZONA_HORARIA_OFFSET || '-05:00';

// Ventana de búsqueda por defecto: no se programa nada para dentro de menos
// de 48h (la gente necesita poder organizarse) ni para dentro de más de 3
// semanas (a esa distancia la mitad cancela).
const HORAS_MINIMAS_ANTICIPACION = 48;
const DIAS_VENTANA = 21;

// Un plan se considera afín si al menos la mitad del grupo comparte su
// interés. Por debajo de eso, mejor dejar al grupo sin plan que mandarlo a
// algo que a 4 de 6 no les interesa.
const SCORE_MINIMO = 0.5;

/**
 * Normaliza un nombre de ciudad al formato que usa el test de personalidad
 * (`localidad`: 'pereira', 'santa_rosa', …). `comercios.ciudad` es texto libre
 * escrito por el comercio ("Pereira", "Santa Rosa"), así que hay que
 * canonizar antes de comparar. Se hace en JS y no en SQL para no depender de
 * la extensión `unaccent`, que no está garantizada en todos los proveedores.
 */
function normalizarCiudad(ciudad) {
  if (!ciudad) return null;
  return ciudad
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita las tildes que NFD dejó sueltas
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** 'HH:MM[:SS]' → minutos desde medianoche. */
function minutosDeHora(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Date → 'YYYY-MM-DD' en la zona de operación (no en UTC ni en la del server). */
function fechaISO(date) {
  const conOffset = new Date(date.getTime() + offsetEnMs());
  return conOffset.toISOString().slice(0, 10);
}

function offsetEnMs() {
  const signo = OFFSET_ZONA.startsWith('-') ? -1 : 1;
  const [h, m] = OFFSET_ZONA.slice(1).split(':').map(Number);
  return signo * (h * 60 + m) * 60 * 1000;
}

/** Día de la semana (0=domingo, convención de EXTRACT(DOW)) en la zona local. */
function diaSemana(fechaYmd) {
  return new Date(`${fechaYmd}T12:00:00${OFFSET_ZONA}`).getUTCDay();
}

/** Construye el instante exacto de inicio de una franja en un día dado. */
function instante(fechaYmd, hora) {
  const hhmmss = String(hora).length === 5 ? `${hora}:00` : String(hora);
  return new Date(`${fechaYmd}T${hhmmss}${OFFSET_ZONA}`);
}

/**
 * Lista los días (YYYY-MM-DD) de la ventana de búsqueda, en orden.
 * `desde` es "ahora"; el primer día candidato es el que cumple la
 * anticipación mínima.
 */
function diasDeVentana(desde, opciones = {}) {
  const anticipacion = opciones.horasMinimas ?? HORAS_MINIMAS_ANTICIPACION;
  const ventana = opciones.diasVentana ?? DIAS_VENTANA;
  const inicio = new Date(desde.getTime() + anticipacion * 3600 * 1000);
  const dias = [];
  for (let i = 0; i <= ventana; i++) {
    dias.push(fechaISO(new Date(inicio.getTime() + i * 24 * 3600 * 1000)));
  }
  return { dias, inicio };
}

/**
 * Primer hueco disponible de un comercio para un plan de `duracionMin`.
 *
 * Un hueco sirve si: hay franja ese día de la semana, el plan entra completo
 * dentro de la franja (no solo empieza dentro), el instante de inicio respeta
 * la anticipación mínima, y la franja no llegó a su cupo de grupos ese día.
 *
 * @param {Array} franjas filas de v_disponibilidad_comercio del comercio
 * @param {Array} ocupacion eventos ya programados [{ fecha_hora }]
 * @returns {Date|null}
 */
function primerHueco(franjas, duracionMin, ocupacion, ahora = new Date(), opciones = {}) {
  const { dias, inicio } = diasDeVentana(ahora, opciones);

  for (const dia of dias) {
    const dow = diaSemana(dia);
    const delDia = franjas
      .filter((f) => f.dia_semana === dow)
      .sort((a, b) => minutosDeHora(a.hora_inicio) - minutosDeHora(b.hora_inicio));

    for (const franja of delDia) {
      // El plan tiene que caber entero: una cena de 2h no entra en una franja
      // de 19:00 a 20:00 aunque "empiece dentro".
      const largoFranja = minutosDeHora(franja.hora_fin) - minutosDeHora(franja.hora_inicio);
      if (largoFranja < duracionMin) continue;

      const arranque = instante(dia, franja.hora_inicio);
      if (arranque < inicio) continue;

      const fin = instante(dia, franja.hora_fin);
      const ocupados = ocupacion.filter((e) => {
        const f = new Date(e.fecha_hora);
        return f >= arranque && f < fin;
      }).length;
      if (ocupados >= franja.grupos_max) continue;

      return arranque;
    }
  }
  return null;
}

/**
 * Puntúa qué tan afín es una oferta al grupo: fracción de miembros que
 * comparten el interés del plan. 5 de 6 amantes de la gastronomía → 0.83.
 */
function puntuarOferta(interesesAgregados, oferta, tamano = 6) {
  const encontrado = interesesAgregados.find((i) => i.interes === oferta.interes);
  return encontrado ? encontrado.peso / tamano : 0;
}

/**
 * Elige la mejor oferta programable para un grupo.
 *
 * Orden de decisión, y este orden es la política del producto:
 *   1. AFINIDAD. Filtro duro: por debajo de `scoreMinimo` la oferta ni compite.
 *   2. TIER del comercio. Solo desempata entre ofertas igual de afines: es lo
 *      que el comercio compra con su plan. No puede pisar la afinidad.
 *   3. FECHA más cercana.
 *
 * Consecuencia a tener presente: si un premium y un gold empatan en afinidad
 * pero el premium recién tiene cupo en tres semanas, gana el premium y el
 * grupo espera. Se acota con `diasVentana`, que es la perilla para decidir
 * cuánta espera vale la prioridad comercial.
 *
 * @returns {{ oferta, fecha_hora, score, nivel_tier }|null}
 */
function elegirOferta(interesesAgregados, ofertas, franjasPorComercio, ocupacionPorComercio, opciones = {}) {
  const scoreMinimo = opciones.scoreMinimo ?? SCORE_MINIMO;
  const ahora = opciones.ahora || new Date();
  const ciudad = opciones.ciudad ? normalizarCiudad(opciones.ciudad) : null;

  const candidatas = [];
  for (const oferta of ofertas) {
    // Los planes son presenciales: el comercio tiene que estar en la ciudad
    // del grupo. Un comercio sin ciudad cargada no compite (mejor perder una
    // oferta que mandar a seis personas a otra ciudad).
    if (ciudad && normalizarCiudad(oferta.ciudad) !== ciudad) continue;

    const score = puntuarOferta(interesesAgregados, oferta, opciones.tamano);
    if (score < scoreMinimo) continue;

    const fecha = primerHueco(
      franjasPorComercio.get(oferta.comercio_id) || [],
      oferta.duracion_min,
      ocupacionPorComercio.get(oferta.comercio_id) || [],
      ahora,
      opciones
    );
    if (!fecha) continue; // afín pero sin cupo en la ventana

    candidatas.push({ oferta, fecha_hora: fecha, score, nivel_tier: oferta.nivel_tier || 0 });
  }

  candidatas.sort(
    (a, b) => b.score - a.score || b.nivel_tier - a.nivel_tier || a.fecha_hora - b.fecha_hora
  );
  return candidatas[0] || null;
}

/** Agrupa filas por comercio_id en un Map, para no hacer O(n²) de filtros. */
function indexarPorComercio(filas) {
  const mapa = new Map();
  for (const fila of filas) {
    if (!mapa.has(fila.comercio_id)) mapa.set(fila.comercio_id, []);
    mapa.get(fila.comercio_id).push(fila);
  }
  return mapa;
}

module.exports = {
  OFFSET_ZONA,
  HORAS_MINIMAS_ANTICIPACION,
  DIAS_VENTANA,
  SCORE_MINIMO,
  normalizarCiudad,
  primerHueco,
  puntuarOferta,
  elegirOferta,
  indexarPorComercio,
  diasDeVentana,
  diaSemana,
  instante,
};
