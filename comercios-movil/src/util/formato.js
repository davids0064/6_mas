// Formateo compartido entre pantallas. Vive aparte porque el resumen, la lista
// de eventos y el detalle muestran las mismas fechas y los mismos estados, y
// tres copias del mismo `toLocaleDateString` es como acaban divergiendo.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// "jueves 4 de septiembre, 8:30 p. m.". Se construye a mano en vez de con
// toLocaleString porque el formato de fecha larga en español depende de que el
// dispositivo tenga ese locale instalado, y un local colombiano con el teléfono
// en inglés vería "Thursday" en medio de una pantalla en español.
// Fecha a partir de lo que devuelve la API PHP.
//
// No se puede hacer `new Date(valor)` a secas. PDO devuelve los timestamptz de
// Postgres tal cual los serializa el motor:
//
//     2026-09-01 20:14:57-05
//
// que NO es ISO 8601: lleva espacio en vez de "T" y el desfase horario en dos
// dígitos en vez de "-05:00". El motor de JavaScript de React Native (Hermes)
// devuelve Invalid Date con ese formato, y el síntoma es silencioso — todas
// las fechas de la app salían vacías y ningún evento se contaba como "hoy",
// porque una comparación contra NaN simplemente da false.
//
// Se normaliza aquí, en un solo sitio, en vez de arreglar la API: el formato
// que manda Postgres es correcto y lo consume también el dashboard web, donde
// el motor del navegador sí lo tolera. Cambiar la serialización del servidor
// para acomodar a un cliente rompería al otro.
export function aFecha(valor) {
  if (valor instanceof Date) return valor;
  if (typeof valor !== 'string') return new Date(NaN);

  const normalizado = valor
    // "2026-09-01 20:14:57" → "2026-09-01T20:14:57"
    .replace(' ', 'T')
    // "…-05" → "…-05:00"; "…-0500" → "…-05:00". El primer grupo evita tocar
    // un desfase que ya venga bien escrito.
    .replace(/([+-])(\d{2})(?::?(\d{2}))?$/, (_, signo, horas, minutos) =>
      `${signo}${horas}:${minutos || '00'}`,
    );

  return new Date(normalizado);
}

export function fechaLarga(iso) {
  const f = aFecha(iso);
  if (Number.isNaN(f.getTime())) return '';
  return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}, ${hora(f)}`;
}

// "4 sep · 8:30 p. m." — la versión corta, para listas.
export function fechaCorta(iso) {
  const f = aFecha(iso);
  if (Number.isNaN(f.getTime())) return '';
  return `${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)} · ${hora(f)}`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Solo la hora: "8:14 p. m.". Para la tarjeta del bloque HOY, donde repetir
// "martes 1 de septiembre" es ruido — la cabecera de la sección ya dice que es
// hoy — y además obligaba a la fecha a partirse en dos líneas.
export function horaSola(iso) {
  const f = aFecha(iso);
  return Number.isNaN(f.getTime()) ? '' : hora(f);
}

function hora(f) {
  const h24 = f.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minutos = String(f.getMinutes()).padStart(2, '0');
  return `${h12}:${minutos} ${h24 < 12 ? 'a. m.' : 'p. m.'}`;
}

// True si la fecha cae hoy. Se compara por día calendario local y no por
// diferencia de horas: un evento a las 11 p. m. sigue siendo "hoy" a las 11:30,
// y uno a las 8 a. m. de mañana no lo es aunque falten diez horas.
export function esHoy(iso) {
  const f = aFecha(iso);
  if (Number.isNaN(f.getTime())) return false;
  const hoy = new Date();
  return (
    f.getFullYear() === hoy.getFullYear() &&
    f.getMonth() === hoy.getMonth() &&
    f.getDate() === hoy.getDate()
  );
}

// Precio en pesos con separador de miles: 45000 → "45.000".
export function precio(valor) {
  return Math.round(Number(valor) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Los cinco estados que maneja EventoController, con el color con el que se
// pintan. `propuesto` usa el gris de texto suave y no un color de alerta: que
// un evento esté sin confirmar es lo normal recién creado, no un problema.
export const ESTADOS = {
  propuesto: { texto: 'Sin confirmar', color: 'textoSuave' },
  confirmado: { texto: 'Confirmado', color: 'exito' },
  en_curso: { texto: 'En curso', color: 'rojoMarca' },
  finalizado: { texto: 'Finalizado', color: 'textoTenue' },
  cancelado: { texto: 'Cancelado', color: 'error' },
};

export function estadoLegible(estado) {
  return ESTADOS[estado] || { texto: estado, color: 'textoSuave' };
}

// Fecha de hoy a medianoche en ISO corto (AAAA-MM-DD), que es lo que espera el
// filtro `desde` de GET /eventos. Se construye a mano y no con toISOString()
// porque ese convierte a UTC: en Colombia (UTC-5) la medianoche local es la
// misma fecha, pero a las 7 p. m. toISOString() ya devuelve el día siguiente y
// la lista se saltaría los eventos de esta noche.
export function hoyISO() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}
