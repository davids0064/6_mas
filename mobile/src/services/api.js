// Cliente HTTP centralizado. Usa fetch nativo (sin axios) para no añadir una
// dependencia que, en un MVP con pocos endpoints, no aporta frente al fetch
// estándar de React Native.
import { API_BASE_URL } from '../config/env';
import { sesion } from './sesion';

async function solicitud(path, { method = 'GET', body, headers } = {}) {
  const token = sesion.token();

  const respuesta = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // El token se adjunta acá y en ningún otro lado: las pantallas no
      // conocen la sesión, solo llaman a api.*.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 (sin contenido) es una respuesta normal, no un vacío raro: lo devuelve
  // /usuarios/yo/grupo cuando el usuario todavía está en espera de grupo.
  if (respuesta.status === 204) return null;

  const contentType = respuesta.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await respuesta.json() : null;

  if (!respuesta.ok) {
    // Un 401 significa que el token venció o no vale: se limpia la sesión para
    // que la app no siga reintentando con una credencial muerta.
    if (respuesta.status === 401) sesion.limpiar();
    const mensaje = (data && data.error) || `Error HTTP ${respuesta.status}`;
    const error = new Error(mensaje);
    // El código viaja con el error porque hay respuestas que no son fallos que
    // convenga reintentar sino estados que la pantalla debe tratar distinto:
    // un 409 al valorar significa "ya lo valoraste", y mostrarlo como error
    // rojo invitaría a reintentar algo que nunca va a pasar.
    error.estado = respuesta.status;
    throw error;
  }
  return data;
}

export const api = {
  // --- Sesión ---
  // Registro y login devuelven { token, usuario }; se guarda la sesión acá
  // para que ninguna pantalla tenga que acordarse de hacerlo.
  registrarUsuario: async (datos) => {
    const res = await solicitud('/api/usuarios', { method: 'POST', body: datos });
    sesion.guardar(res);
    return res.usuario;
  },
  login: async (email, password) => {
    const res = await solicitud('/api/usuarios/login', {
      method: 'POST',
      body: { email, password },
    });
    sesion.guardar(res);
    return res.usuario;
  },
  cerrarSesion: () => sesion.limpiar(),

  // --- Usuario autenticado ---
  // No hay obtenerUsuario(id): el backend ya no expone /api/usuarios/:id, así
  // que no existe forma de pedir el perfil de otra persona.
  obtenerMiPerfil: () => solicitud('/api/usuarios/yo'),
  actualizarMiPerfil: (datos) => solicitud('/api/usuarios/yo', { method: 'PUT', body: datos }),

  // Devuelve null si todavía no hay grupo asignado (204), que es el estado
  // normal mientras el matching espera a completar los 6.
  obtenerMiGrupo: () => solicitud('/api/usuarios/yo/grupo'),
  obtenerMisEventos: () => solicitud('/api/usuarios/yo/eventos'),

  // --- Test de personalidad ---
  enviarTestPersonalidad: (respuestas, resultado) =>
    solicitud('/api/usuarios/yo/test-personalidad', {
      method: 'POST',
      body: { respuestas, resultado },
    }),

  // --- Catálogos (públicos: los pide el formulario de registro, antes de que
  // exista sesión) ---
  obtenerIntereses: () => solicitud('/api/intereses'),
  obtenerGeneros: () => solicitud('/api/generos'),

  guardarMisIntereses: (interesIds) =>
    solicitud('/api/usuarios/yo/intereses', {
      method: 'PUT',
      body: { interes_ids: interesIds },
    }),

  // --- Feedback ---
  // El usuario_id ya no viaja en el cuerpo: el backend lo saca del token.
  enviarFeedback: (eventoId, rating, comentario) =>
    solicitud('/api/feedback', {
      method: 'POST',
      body: { evento_id: eventoId, rating, comentario },
    }),
};
