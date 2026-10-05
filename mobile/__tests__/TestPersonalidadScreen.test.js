// ============================================================================
// Test de personalidad: el cuestionario viene del servidor.
//
//   cd mobile && npm test
//
// Desde la migración 006 las preguntas se editan con SQL en vez de recompilar.
// La app las pide y conserva una copia en el binario como respaldo.
//
// Lo que se prueba es el comportamiento sin red, que es el que de verdad puede
// arruinar el producto: el test es lo primero que hace alguien tras
// registrarse, y una pantalla en blanco ahí es una cuenta perdida.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

import TestPersonalidadScreen from '../src/screens/TestPersonalidadScreen';
import { api } from '../src/services/api';
import { sesion } from '../src/services/sesion';

jest.mock('../src/services/api', () => ({
  api: { obtenerPreguntasTest: jest.fn(), enviarTestPersonalidad: jest.fn() },
}));
jest.mock('../src/services/sesion', () => ({ sesion: { haySesion: jest.fn(() => true) } }));
// Esta pantalla usa más de Reanimated que las demás: además de las entradas
// animadas, un valor compartido y un estilo derivado. El mock oficial de la
// librería (react-native-reanimated/mock) no sirve acá — viene sin transpilar y
// Jest lo rechaza con "Cannot use import statement outside a module"—, así que
// se sustituye lo justo. Lo que se prueba es de dónde salen las preguntas, no
// la animación.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const entrada = { delay: () => entrada, duration: () => entrada, springify: () => entrada };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: entrada,
    FadeInRight: entrada,
    useSharedValue: (inicial) => ({ value: inicial }),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (v) => v,
  };
});
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

function texto(n) {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(texto).join(' ');
  if (n.props) return texto(n.props.children);
  return '';
}
// Se colapsan los espacios: React parte "Pregunta {n} de {total}" en varios
// hijos, y al unirlos quedan dobles. Es un artefacto del árbol de pruebas, no
// de lo que ve la persona.
const textoDe = (a) =>
  a.root
    .findAllByType(Text)
    .map((t) => texto(t.props.children).replace(/\s+/g, ' ').trim())
    .join(' | ');
const botonCon = (a, frase) =>
  a.root.findAllByType(TouchableOpacity).find((b) => texto(b.props.children).includes(frase));

const DEL_SERVIDOR = {
  version: 2,
  preguntas: [
    {
      id: 'edad',
      texto: 'Pregunta editada desde la base',
      opciones: [
        { valor: '18_24', texto: 'Opción nueva A' },
        { valor: '25_31', texto: 'Opción nueva B' },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  sesion.haySesion.mockReturnValue(true);
});

// La pantalla arranca en la advertencia de "solo se puede hacer una vez", así
// que para llegar a las preguntas hay que pasarla. Se hace en un ayudante para
// que las pruebas de contenido no se llenen de ese paso.
async function render(props = {}) {
  let arbol;
  await act(async () => {
    arbol = renderer.create(<TestPersonalidadScreen {...props} />);
  });
  return arbol;
}

async function renderYEmpezar(props = {}) {
  const arbol = await render(props);
  await act(async () => botonCon(arbol, 'Entendido').props.onPress());
  return arbol;
}

test('avisa de que el test se hace una sola vez, antes de la primera pregunta', async () => {
  // Es lo que el producto promete y lo que el backend hace cumplir con un 409.
  // Si esta advertencia desapareciera, la regla seguiría existiendo pero la
  // gente la descubriría al chocar con ella.
  api.obtenerPreguntasTest.mockResolvedValue(DEL_SERVIDOR);
  const t = textoDe(await render());
  expect(t).toMatch(/una sola vez/i);
  expect(t).toMatch(/no se puede repetir/i);
  expect(t).not.toContain('Pregunta 1 de');
});

test('no se llega a las preguntas sin pasar por la advertencia', async () => {
  api.obtenerPreguntasTest.mockResolvedValue(DEL_SERVIDOR);
  const arbol = await render();
  expect(botonCon(arbol, 'Opción nueva A')).toBeUndefined();

  await act(async () => botonCon(arbol, 'Entendido').props.onPress());
  expect(botonCon(arbol, 'Opción nueva A')).toBeDefined();
});

test('usa el cuestionario del servidor cuando responde', async () => {
  api.obtenerPreguntasTest.mockResolvedValue(DEL_SERVIDOR);
  const t = textoDe(await renderYEmpezar());
  expect(t).toContain('Pregunta editada desde la base');
  expect(t).toContain('Opción nueva A');
  expect(t).toContain('Pregunta 1 de 1');
});

test('sin red sigue funcionando con el cuestionario del binario', async () => {
  // El caso que importa: el servidor no contesta y la pantalla NO se queda en
  // blanco ni muestra un error.
  api.obtenerPreguntasTest.mockRejectedValue(new Error('sin conexión'));
  const t = textoDe(await renderYEmpezar());
  expect(t).toContain('¿Cuál es tu edad?');
  expect(t).toContain('Pregunta 1 de 20');
});

test('una respuesta vacía del servidor no deja la pantalla sin preguntas', async () => {
  api.obtenerPreguntasTest.mockResolvedValue({ version: 1, preguntas: [] });
  const t = textoDe(await renderYEmpezar());
  expect(t).toContain('¿Cuál es tu edad?');
});

test('la versión del cuestionario viaja con las respuestas', async () => {
  // Sin esto, un test contestado hoy no se distingue de uno contestado tras
  // reescribir las preguntas, y dejan de ser comparables sin que nadie lo note.
  api.obtenerPreguntasTest.mockResolvedValue(DEL_SERVIDOR);
  api.enviarTestPersonalidad.mockResolvedValue({});
  const onTerminado = jest.fn();
  const arbol = await renderYEmpezar({ onTerminado });

  jest.useFakeTimers();
  await act(async () => botonCon(arbol, 'Opción nueva A').props.onPress());
  await act(async () => jest.runAllTimers());
  jest.useRealTimers();

  expect(api.enviarTestPersonalidad).toHaveBeenCalledWith({ edad: '18_24' }, 2);
});
