/**
 * Tipos que reflejan el contrato de la API PHP.
 *
 * Se mantienen a mano (y no generados) porque son pocos y así el compilador
 * avisa si la API cambia un campo: un error de build es mejor que un undefined
 * en pantalla.
 */

export interface Comercio {
  id: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  categoria: string | null;
  telefono: string | null;
  email: string;
  descripcion: string | null;
  logo_url: string | null;
  sitio_web: string | null;
  horario: string | null;
  activo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface RespuestaSesion {
  token: string;
  comercio: Comercio;
}

export type EstadoMenu = 'borrador' | 'publicado' | 'archivado';

export interface MenuResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoMenu;
  orden: number;
  total_secciones: number;
  total_items: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  imagen_url: string | null;
  orden: number;
}

export interface MenuSeccion {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  items: MenuItem[];
}

export interface MenuCompleto {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoMenu;
  orden: number;
  secciones: MenuSeccion[];
  created_at: string;
  updated_at: string;
}

export interface Propuesta {
  id: string;
  titulo: string;
  descripcion: string | null;
  incluye: string[];
  precio_persona: number;
  duracion_min: number | null;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

/** Categoría del catálogo paramétrico (pa_intereses). */
export interface Interes {
  id: string;
  nombre: string;
  icono: string;
}

/**
 * Un plan: la experiencia concreta que se le puede asignar a un grupo, atada a
 * un interés del catálogo.
 *
 * El `interes_id` no es decorativo: el matching exige que al menos la mitad del
 * grupo comparta ese interés antes de mirar el tier del comercio.
 */
export interface Plan {
  id: string;
  interes_id: string;
  interes_nombre: string;
  interes_icono: string;
  titulo: string;
  descripcion: string | null;
  duracion_min: number;
  precio: number;
  capacidad: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Una franja recurrente de disponibilidad. `dia_semana` sigue la convención de
 * EXTRACT(DOW) de Postgres: 0 = domingo.
 */
export interface Franja {
  id: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  grupos_max: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Anfitrion {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  bio: string | null;
  foto_url: string | null;
  titular: boolean;
  created_at: string;
}

export type EstadoEvento = 'propuesto' | 'confirmado' | 'en_curso' | 'finalizado' | 'cancelado';

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  fecha_hora: string;
  capacidad: number;
  precio: number;
  estado: EstadoEvento;
  grupo_id: string | null;
  anfitrion_id: string;
  anfitrion_nombre?: string | null;
  created_at: string;
}

/**
 * Lo único que el comercio puede saber de quienes va a recibir. El backend lo
 * garantiza a nivel de permisos de base de datos: no hay más campos que pedir.
 */
export interface Asistente {
  nombre_pila: string;
  intereses: string[];
}

export interface RespuestaAsistentes {
  grupo_asignado: boolean;
  asistentes: Asistente[];
}

export interface Resumen {
  comercio: Pick<Comercio, 'nombre' | 'direccion' | 'ciudad' | 'descripcion' | 'logo_url' | 'horario'>;
  contadores: {
    menus_total: number;
    menus_publicados: number;
    propuestas_activas: number;
    anfitriones_total: number;
    eventos_proximos: number;
    planes_activos: number;
    franjas_activas: number;
  };
  proximos_eventos: Array<{
    id: string;
    titulo: string;
    fecha_hora: string;
    estado: EstadoEvento;
    capacidad: number;
    tiene_grupo: boolean;
    anfitrion_nombre: string | null;
  }>;
  pendientes: Array<{ clave: string; texto: string }>;
}
