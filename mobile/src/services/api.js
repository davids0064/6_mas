// Cliente HTTP centralizado. Usa fetch nativo (sin axios) para no añadir una
// dependencia que, en un MVP con pocos endpoints, no aporta frente al fetch
// estándar de React Native.
import { API_BASE_URL } from '../config/env';

async function solicitud(path, { method = 'GET', body, headers } = {}) {
  const respuesta = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = respuesta.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await respuesta.json() : null;

  if (!respuesta.ok) {
    const mensaje = (data && data.error) || `Error HTTP ${respuesta.status}`;
    throw new Error(mensaje);
  }
  return data;
}

export const api = {
  // Usuarios
  registrarUsuario: (datos) => solicitud('/api/usuarios', { method: 'POST', body: datos }),
  login: (email, password) =>
    solicitud('/api/usuarios/login', { method: 'POST', body: { email, password } }),
  obtenerUsuario: (id) => solicitud(`/api/usuarios/${id}`),

  // Test de personalidad
  enviarTestPersonalidad: (usuarioId, respuestas, resultado) =>
    solicitud(`/api/usuarios/${usuarioId}/test-personalidad`, {
      method: 'POST',
      body: { respuestas, resultado },
    }),

  // Intereses
  obtenerIntereses: () => solicitud('/api/intereses'),
  guardarInteresesUsuario: (usuarioId, interesIds) =>
    solicitud(`/api/usuarios/${usuarioId}/intereses`, {
      method: 'PUT',
      body: { interes_ids: interesIds },
    }),

  // Grupos
  crearGrupo: (nombre) => solicitud('/api/grupos', { method: 'POST', body: { nombre } }),
  obtenerGrupo: (id) => solicitud(`/api/grupos/${id}`),
  unirseAGrupo: (grupoId, usuarioId) =>
    solicitud(`/api/grupos/${grupoId}/miembros`, { method: 'POST', body: { usuario_id: usuarioId } }),

  // Eventos
  obtenerEventosPorGrupo: (grupoId) => solicitud(`/api/eventos?grupo_id=${grupoId}`),

  // Feedback
  enviarFeedback: (eventoId, usuarioId, rating, comentario) =>
    solicitud('/api/feedback', {
      method: 'POST',
      body: { evento_id: eventoId, usuario_id: usuarioId, rating, comentario },
    }),
};
