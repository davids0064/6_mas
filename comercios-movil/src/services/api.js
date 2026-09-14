// Cliente HTTP hacia la API PHP del panel de comercios (dashboard/api/).
//
// Usa fetch nativo, sin axios: con esta cantidad de endpoints no aporta nada
// frente al fetch estándar de React Native.
import { API_BASE_URL } from '../config/env';
import { sesion } from './sesion';

async function solicitud(path, { method = 'GET', body, headers } = {}) {
  const token = sesion.token();

  const respuesta = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // El token se adjunta aquí y en ningún otro sitio: las pantallas no
      // conocen la sesión, solo llaman a api.*.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (respuesta.status === 204) return null;

  const contentType = respuesta.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await respuesta.json() : null;

  if (!respuesta.ok) {
    // Un 401 significa token vencido o inválido: se limpia la sesión para que
    // la app no siga reintentando con una credencial muerta.
    if (respuesta.status === 401) sesion.limpiar();
    // La API PHP responde los errores como {"error": "..."} (ver Core/Response).
    const mensaje = (data && data.error) || `Error HTTP ${respuesta.status}`;
    const error = new Error(mensaje);
    error.estado = respuesta.status;
    throw error;
  }
  return data;
}

export const api = {
  // --- Sesión ---
  // Registro y login devuelven { token, comercio }; se guarda la sesión aquí
  // para que ninguna pantalla tenga que acordarse de hacerlo.
  registrar: async (datos) => {
    const res = await solicitud('/auth/registro', { method: 'POST', body: datos });
    sesion.guardar(res);
    return res.comercio;
  },
  entrar: async (email, password) => {
    const res = await solicitud('/auth/login', { method: 'POST', body: { email, password } });
    sesion.guardar(res);
    return res.comercio;
  },
  cerrarSesion: () => sesion.limpiar(),

  // Borrado de cuenta. Exigido por la guideline 5.1.1(v) de la App Store en
  // cualquier app que permita crear una cuenta, y esta lo permite.
  eliminarMiComercio: async () => {
    await solicitud('/mi-comercio', { method: 'DELETE' });
    sesion.limpiar();
  },

  // --- Inicio ---
  // Una sola petición trae contadores, próximos eventos y qué falta por
  // configurar: es el patrón que mantiene el inicio rápido aunque la base esté
  // en otro servidor (ver ResumenController).
  obtenerResumen: () => solicitud('/resumen'),

  // --- Perfil del comercio ---
  // No hay /comercios/{id}: el id sale del token, así que no existe ninguna
  // ruta donde cambiar un id en la URL dé acceso a otro negocio.
  obtenerMiComercio: () => solicitud('/mi-comercio'),
  actualizarMiComercio: (datos) => solicitud('/mi-comercio', { method: 'PUT', body: datos }),

  // --- Eventos ---
  // `desde` e `estado` son los filtros que admite la API. La app pide siempre
  // desde una fecha para no arrastrar el histórico completo a un teléfono.
  //
  // El query se arma a mano y no con URLSearchParams: Hermes trae la clase
  // pero sin `set` (lanza "URLSearchParams.set is not implemented"), así que
  // en el teléfono la lista de eventos no llegaba a pedirse nunca. Es un
  // fallo que no se ve en las pruebas de Node, donde URLSearchParams sí está
  // completo.
  listarEventos: ({ desde, estado } = {}) => {
    const partes = [];
    if (desde) partes.push(`desde=${encodeURIComponent(desde)}`);
    if (estado) partes.push(`estado=${encodeURIComponent(estado)}`);
    const query = partes.join('&');
    return solicitud(`/eventos${query ? `?${query}` : ''}`);
  },
  obtenerEvento: (id) => solicitud(`/eventos/${id}`),

  // Lo único que el comercio puede saber de quienes va a recibir: nombre de
  // pila e intereses. Ni correo, ni teléfono, ni edad, ni personalidad — no es
  // una decisión de esta app, es lo único que la vista v_evento_asistentes
  // expone al rol con el que se conecta la API.
  obtenerAsistentes: (eventoId) => solicitud(`/eventos/${eventoId}/asistentes`),

  // Cambiar el estado de un evento es la acción de operación diaria: confirmar
  // el que llega, marcarlo finalizado al cerrar. `grupo_id` no se toca desde
  // aquí — a quién recibe el local lo decide el matching, no el local.
  cambiarEstadoEvento: (id, estado) =>
    solicitud(`/eventos/${id}`, { method: 'PUT', body: { estado } }),

  // Crear un evento a mano: la reserva que no viene del matching sino de una
  // llamada al local. Exige un anfitrión propio — la API rechaza el de otro
  // comercio con un 422.
  crearEvento: (datos) => solicitud('/eventos', { method: 'POST', body: datos }),

  // Cancelar deja a seis personas sin plan, así que la pantalla lo pide dos
  // veces antes de llegar aquí.
  cancelarEvento: (id) => solicitud(`/eventos/${id}`, { method: 'DELETE' }),

  // --- Planes ---
  // La oferta del comercio: qué experiencia concreta recibe un grupo de seis.
  // Es la otra mitad de la condición dura del matching (la primera es la
  // disponibilidad): sin un plan activo el algoritmo no ve al local, así que
  // esto no es configuración inicial sino operación — subir un precio o apagar
  // un plan que hoy no se puede dar son cosas de un martes cualquiera.
  listarPlanes: () => solicitud('/planes'),
  crearPlan: (datos) => solicitud('/planes', { method: 'POST', body: datos }),
  actualizarPlan: (id, datos) => solicitud(`/planes/${id}`, { method: 'PUT', body: datos }),
  // Borrado lógico del lado de la API: los eventos ya asignados siguen
  // apuntando al plan, así que desaparece de la oferta futura sin dejar sin
  // explicación a un grupo que ya tiene reserva.
  eliminarPlan: (id) => solicitud(`/planes/${id}`, { method: 'DELETE' }),

  // El catálogo de intereses con el que se etiqueta un plan. Se pide a la API
  // en vez de tenerlo escrito en la app: agregar una categoría es un INSERT, y
  // una copia en el cliente obligaría a publicar una versión nueva en las
  // tiendas para reflejarla.
  listarIntereses: () => solicitud('/intereses'),

  // --- Anfitriones ---
  // Quién recibe al grupo. El titular es exclusivo: al marcar uno, la API baja
  // al anterior dentro de la misma transacción, así que la respuesta es la
  // única fuente fiable de quién lo es ahora.
  listarAnfitriones: () => solicitud('/anfitriones'),
  crearAnfitrion: (datos) => solicitud('/anfitriones', { method: 'POST', body: datos }),
  actualizarAnfitrion: (id, datos) =>
    solicitud(`/anfitriones/${id}`, { method: 'PUT', body: datos }),
  eliminarAnfitrion: (id) => solicitud(`/anfitriones/${id}`, { method: 'DELETE' }),

  // --- Propuestas de bienvenida ---
  // Con qué se recibe al grupo. `incluye` viaja como lista de textos y la API
  // la guarda en un TEXT[]; las entradas vacías las descarta ella.
  listarPropuestas: () => solicitud('/propuestas'),
  crearPropuesta: (datos) => solicitud('/propuestas', { method: 'POST', body: datos }),
  actualizarPropuesta: (id, datos) =>
    solicitud(`/propuestas/${id}`, { method: 'PUT', body: datos }),
  eliminarPropuesta: (id) => solicitud(`/propuestas/${id}`, { method: 'DELETE' }),

  // --- Menús ---
  // Menú → secciones → ítems. El listado trae solo el resumen con los conteos;
  // `obtenerMenu` trae el árbol completo de un menú en una sola petición, que
  // es lo que pinta el editor.
  //
  // Secciones e ítems no guardan comercio_id: lo heredan por la cadena de
  // claves foráneas, y la API sube por esa cadena en cada operación. Por eso
  // sus rutas son de primer nivel (`/secciones/{id}`, `/items/{id}`) y no
  // cuelgan del menú: conocer el UUID de una sección ajena no alcanza para
  // tocarla.
  listarMenus: () => solicitud('/menus'),
  obtenerMenu: (id) => solicitud(`/menus/${id}`),
  crearMenu: (datos) => solicitud('/menus', { method: 'POST', body: datos }),
  actualizarMenu: (id, datos) => solicitud(`/menus/${id}`, { method: 'PUT', body: datos }),
  eliminarMenu: (id) => solicitud(`/menus/${id}`, { method: 'DELETE' }),

  crearSeccion: (menuId, datos) =>
    solicitud(`/menus/${menuId}/secciones`, { method: 'POST', body: datos }),
  actualizarSeccion: (id, datos) => solicitud(`/secciones/${id}`, { method: 'PUT', body: datos }),
  // Borrado real, no lógico: se lleva sus ítems por CASCADE. Un menú es
  // contenido editable, no historial — a diferencia de un plan, nada apunta a
  // una sección desde un evento ya ocurrido.
  eliminarSeccion: (id) => solicitud(`/secciones/${id}`, { method: 'DELETE' }),

  crearItem: (seccionId, datos) =>
    solicitud(`/secciones/${seccionId}/items`, { method: 'POST', body: datos }),
  actualizarItem: (id, datos) => solicitud(`/items/${id}`, { method: 'PUT', body: datos }),
  eliminarItem: (id) => solicitud(`/items/${id}`, { method: 'DELETE' }),

  // --- Disponibilidad ---
  listarDisponibilidad: () => solicitud('/disponibilidad'),
  crearFranja: (datos) => solicitud('/disponibilidad', { method: 'POST', body: datos }),
  actualizarFranja: (id, datos) =>
    solicitud(`/disponibilidad/${id}`, { method: 'PUT', body: datos }),
  eliminarFranja: (id) => solicitud(`/disponibilidad/${id}`, { method: 'DELETE' }),
};
