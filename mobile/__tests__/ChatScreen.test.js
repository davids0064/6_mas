// ============================================================================
// Chat del grupo.
//
//   cd mobile && npm test
//
// Esta suite existe por la guideline 1.2 de la App Store: una app con contenido
// generado por usuarios tiene que dejar reportar y bloquear. Las dos salidas
// están detrás de un toque largo sobre el mensaje, o sea, en un sitio que no se
// ve en pantalla — es exactamente el tipo de cosa que un refactor quita sin que
// nadie lo note hasta que Apple la rechaza.
//
// Lo demás que se prueba: que el mensaje se envíe, y que si falla el envío el
// texto vuelva al campo en vez de perderse.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';

import ChatScreen from '../src/screens/ChatScreen';
import { api } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  api: {
    obtenerMensajes: jest.fn(),
    enviarMensaje: jest.fn(),
    reportar: jest.fn(),
    bloquear: jest.fn(),
  },
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');


// `JSON.stringify(arbol.toJSON())` no sirve acá: el árbol que produce FlatList
// tiene referencias circulares (`_owner`) y revienta. Se recorren los hijos
// recogiendo solo cadenas.
function texto(nodo) {
  if (nodo === null || nodo === undefined || typeof nodo === 'boolean') return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(texto).join(' ');
  if (nodo.props) return texto(nodo.props.children);
  return '';
}

const textoDe = (arbol) => arbol.root.findAllByType(Text).map((t) => texto(t.props.children)).join(' | ');

const botonCon = (arbol, frase) =>
  arbol.root.findAllByType(TouchableOpacity).find((b) => texto(b.props.children).includes(frase));

const MENSAJES = [
  { id: 'm1', texto: '¡Hola a todos!', nombre: 'Julián', usuario_id: 'u3', es_tuyo: false, created_at: '2026-09-16T18:00:00Z' },
  { id: 'm2', texto: 'Llego 10 min tarde', nombre: 'Tú', usuario_id: 'u1', es_tuyo: true, created_at: '2026-09-16T18:05:00Z' },
];

// La pantalla reconsulta cada 15 segundos con setInterval. Con temporizadores
// reales, Jest se queda esperando ese intervalo y la suite no termina nunca:
// el proceso se cuelga sin dar un solo error. Se usan temporizadores falsos y
// se desmonta cada árbol al acabar.
let montado = null;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  api.obtenerMensajes.mockResolvedValue(MENSAJES);
});

afterEach(() => {
  if (montado) {
    act(() => montado.unmount());
    montado = null;
  }
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function render() {
  await act(async () => {
    montado = renderer.create(<ChatScreen />);
  });
  return montado;
}

test('pinta la conversación', async () => {
  const t = textoDe(await render());
  expect(t).toContain('¡Hola a todos!');
  expect(t).toContain('Llego 10 min tarde');
  expect(t).toContain('Julián');
});

test('envía el mensaje escrito', async () => {
  api.enviarMensaje.mockResolvedValue({ id: 'm3' });
  const arbol = await render();

  const campo = arbol.root.findByType(TextInput);
  await act(async () => campo.props.onChangeText('¿Hay parqueadero?'));

  await act(async () => botonCon(arbol, 'Enviar').props.onPress());

  expect(api.enviarMensaje).toHaveBeenCalledWith('¿Hay parqueadero?');
});

test('si el envío falla, el texto vuelve al campo y no se pierde', async () => {
  api.enviarMensaje.mockRejectedValue(new Error('sin conexión'));
  const arbol = await render();

  const campo = arbol.root.findByType(TextInput);
  await act(async () => campo.props.onChangeText('mensaje importante'));
  await act(async () => botonCon(arbol, 'Enviar').props.onPress());

  expect(arbol.root.findByType(TextInput).props.value).toBe('mensaje importante');
});

// --- Guideline 1.2 ---------------------------------------------------------

test('un mensaje ajeno ofrece reportar y bloquear', async () => {
  const arbol = await render();
  await act(async () => botonCon(arbol, '¡Hola a todos!').props.onLongPress());

  expect(Alert.alert).toHaveBeenCalled();
  const opciones = Alert.alert.mock.calls[0][2].map((o) => o.text);
  expect(opciones.some((o) => /Reportar/i.test(o))).toBe(true);
  expect(opciones.some((o) => /Bloquear/i.test(o))).toBe(true);
});

test('el menú no aparece sobre los mensajes propios', async () => {
  const arbol = await render();
  await act(async () => botonCon(arbol, 'Llego 10 min tarde').props.onLongPress());
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('reportar llega al backend con el mensaje y el motivo', async () => {
  api.reportar.mockResolvedValue({ id: 'r1' });
  const arbol = await render();
  await act(async () => botonCon(arbol, '¡Hola a todos!').props.onLongPress());
  // Primer botón del menú: "Reportar mensaje"
  await act(async () => Alert.alert.mock.calls[0][2][0].onPress());
  // Segundo diálogo: la lista de motivos. Se elige el primero.
  await act(async () => Alert.alert.mock.calls[1][2][0].onPress());

  expect(api.reportar).toHaveBeenCalledWith(
    expect.objectContaining({ mensajeId: 'm1', usuarioId: 'u3' })
  );
});

test('bloquear llega al backend y recarga la conversación', async () => {
  api.bloquear.mockResolvedValue(undefined);
  const arbol = await render();
  await act(async () => botonCon(arbol, '¡Hola a todos!').props.onLongPress());
  await act(async () => Alert.alert.mock.calls[0][2][1].onPress()); // "Bloquear a …"
  await act(async () => Alert.alert.mock.calls[1][2][0].onPress()); // confirmar

  expect(api.bloquear).toHaveBeenCalledWith('u3');
  // Dos cargas: la del montaje y la de después de bloquear.
  expect(api.obtenerMensajes.mock.calls.length).toBeGreaterThanOrEqual(2);
});
