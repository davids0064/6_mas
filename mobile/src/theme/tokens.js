// Design tokens de Seis Más — fuente única de verdad para colores,
// tipografía, espaciado y radios. Documentados en mobile/docs/GUIA_DISENO.md
// (guía de estilos); en Figma/Sketch se replican como styles compartidos.
//
// La paleta está MUESTREADA de assets/home_1.png (la ilustración de las
// personas de la pantalla de bienvenida), que es la referencia visual de la
// marca: azul del logo "Seis" (#315699), naranja del "Más" (#F79547),
// cielo índigo profundo de las esquinas (#232456), resplandor dorado del
// anillo central (#F8AC64) y verde del círculo de gastronomía (#739F20).
export const COLORES = {
  // Marca (muestreados de la imagen)
  azul: '#315699', // letras "Seis" del logo
  azulClaro: '#5B84C4', // azul del logo aclarado (acentos interactivos en oscuro)
  naranja: '#F79547', // letras "Más" del logo → CTA principal
  naranjaOscuro: '#C96F26',
  // Rojo OFICIAL de marca (assets/contenidoidentidaddemarcapaletadecolores),
  // RGB 173,25,26 / CMYK 21·100·98·15. Usado en los CTA principales que
  // siguen el diseño exacto del botón "¡Empezar!" de la bienvenida.
  rojoMarca: '#AD191A',
  negroMarca: '#000000',
  dorado: '#F8AC64', // resplandor central → progreso/gamificación
  verde: '#739F20', // círculo de gastronomía → base de éxito
  verdeClaro: '#8CBE3F', // verde aclarado para contraste sobre oscuro
  azulProfundo: '#232456', // cielo de las esquinas → fondo principal
  blanco: '#FFFFFF',
  crema: '#F9E3C7', // blanco cálido del halo del logo → subtítulos destacados

  // Semánticos — tema claro: fondo blanco de marca (ver
  // assets/contenidoidentidaddemarcapaletadecolores), texto en el azul
  // profundo de la imagen para mantener el tinte de marca sin depender de
  // negro puro.
  fondo: '#FFFFFF',
  superficie: '#F4F5FA', // gris muy claro: distingue tarjetas/inputs del fondo blanco
  texto: '#232456', // azul profundo de la imagen, usado como "negro" de marca
  textoSuave: '#5B6178', // gris azulado medio (subtítulos)
  textoTenue: '#9AA0BC', // gris azulado claro (placeholders)
  borde: '#E1E3EF', // divisores sobre fondo claro
  exito: '#739F20', // verde de la imagen (sin aclarar: ya contrasta sobre blanco)
  // El rojo de error es una extensión semántica (la imagen no trae rojo
  // plano y usar naranja o el rojo de marca chocaría con los CTA). Legible
  // sobre blanco.
  error: '#D64545',
};

export const TIPOGRAFIA = {
  // Sans-serif del sistema (SF Pro/Roboto): claridad y look nativo, misma
  // familia redondeada y pesada que sugiere el lettering del logo. Si la
  // marca adopta una fuente propia, cambiarla aquí la propaga a toda la app.
  logo: { fontSize: 44, fontWeight: '800' },
  titulo: { fontSize: 26, fontWeight: '800' },
  subtitulo: { fontSize: 15, fontWeight: '400' },
  etiqueta: { fontSize: 14, fontWeight: '600' },
  input: { fontSize: 16, fontWeight: '400' },
  boton: { fontSize: 17, fontWeight: '700' },
  ayuda: { fontSize: 13, fontWeight: '400' },
};

export const ESPACIADO = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
};

export const RADIOS = {
  campo: 12,
  chip: 999,
  boton: 999,
  tarjeta: 20,
};


// Ancho máximo de la columna de contenido.
//
// Las tres revisiones de la App Store se hicieron en un iPad Air. Sin esto, en
// una pantalla ancha la app se ve como un teléfono estirado: líneas de texto de
// lado a lado, botones de 900 px y tarjetas vacías por dentro. Es exactamente
// la impresión que un revisor resume como "no se siente como una app".
//
// 560 puntos es el ancho al que una línea de texto sigue siendo cómoda de
// leer. En iPhone no cambia nada: ninguna pantalla llega a ese ancho, así que
// el límite no llega a aplicarse nunca.
export const ANCHO_MAXIMO = 560;

// Se aplica al contenedor de contenido de cada pantalla (el
// `contentContainerStyle` del ScrollView, o el `View` raíz donde no hay
// scroll). `width: '100%'` es imprescindible: sin él, `alignSelf: 'center'`
// encoge la columna al ancho de su hijo más ancho.
export const COLUMNA = {
  width: '100%',
  maxWidth: ANCHO_MAXIMO,
  alignSelf: 'center',
};
