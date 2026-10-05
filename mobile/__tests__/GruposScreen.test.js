// ============================================================================
// Pantalla "Tu grupo", en su estado de espera.
//
//   cd mobile && npm test
//
// Es la pantalla a la que se llega al terminar el test y la que ve cualquiera
// que abra la app antes de tener grupo. Dos rechazos por guideline 4.2 vinieron
// en buena parte de que aquí no había nada: un título, una frase y un botón.
//
// Lo que se prueba es el mensaje que se lee tras responder las 20 preguntas
// —redactado por el equipo, no por el código— y que siga saliendo el nombre de
// pila, que es lo que lo hace sonar a persona y no a notificación.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import GruposScreen from '../src/screens/GruposScreen';
import { api } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  api: {
    obtenerMiGrupo: jest.fn(),
    obtenerMiPerfil: jest.fn(),
    obtenerMisEventos: jest.fn(),
    obtenerMiPerfilPersonalidad: jest.fn(),
    responderAsistencia: jest.fn(),
  },
}));

// Esta pantalla usa el anillo animado del grupo (valor compartido, repetición
// y retraso), así que el mock cubre todo lo que importa de
// react-native-reanimated. Lo que se prueba es qué dice la pantalla, no cómo se
// mueve; el mock oficial de la librería no sirve porque viene sin transpilar.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const entrada = { delay: () => entrada, duration: () => entrada };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: entrada,
    FadeInRight: entrada,
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (v) => v,
    withRepeat: (v) => v,
    withDelay: (_retraso, v) => v,
    withSequence: (v) => v,
    Easing: { linear: () => {}, inOut: () => () => {}, ease: () => {}, quad: () => {} },
  };
});
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

function texto(n) {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(texto).join('');
  if (n.props) return texto(n.props.children);
  return '';
}
const textoDe = (a) =>
  a.root
    .findAllByType(Text)
    .map((t) => texto(t.props.children).replace(/\s+/g, ' ').trim())
    .join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  // Sin grupo todavía: el backend devuelve 204, que api.js normaliza a null.
  api.obtenerMiGrupo.mockResolvedValue(null);
  api.obtenerMisEventos.mockResolvedValue([]);
  api.obtenerMiPerfilPersonalidad.mockResolvedValue(null);
  api.obtenerMiPerfil.mockResolvedValue({ nombre: 'Alejandro Rivas', email: 'a@b.test' });
});

async function render(props = {}) {
  let arbol;
  await act(async () => {
    arbol = renderer.create(<GruposScreen {...props} />);
  });
  return arbol;
}

test('tras el test dice que el puesto está asegurado y qué pasa ahora', async () => {
  const t = textoDe(await render());
  expect(t).toContain('aseguraste tu puesto en la mesa');
  expect(t).toContain('otros 5 acompañantes');
  expect(t).toContain('plan, sitio, día y hora con instrucciones');
});

test('saluda por el nombre de pila, no por el completo', async () => {
  const t = textoDe(await render());
  expect(t).toContain('Alejandro, ya aseguraste');
  expect(t).not.toContain('Alejandro Rivas, ya');
});

test('sin perfil cargado el mensaje sigue siendo legible', async () => {
  // Si el perfil falla, no puede quedar "undefined, ya aseguraste..." ni una
  // coma suelta al principio de la frase.
  api.obtenerMiPerfil.mockRejectedValue(new Error('sin red'));
  const t = textoDe(await render());
  expect(t).toContain('Ya aseguraste tu puesto en la mesa');
  expect(t).not.toMatch(/undefined|^\s*,/);
});

test('quien ya vivió un plan ve que se le busca uno nuevo', async () => {
  api.obtenerMisEventos.mockResolvedValue([
    {
      id: 'e1',
      titulo: 'Primer encuentro',
      fecha_hora: '2026-01-01T00:00:00Z',
      estado: 'finalizado',
      comercio_nombre: 'Café Botánico',
      ya_valorado: true,
    },
  ]);
  const t = textoDe(await render());
  expect(t).toContain('Buscándote un grupo nuevo');
  expect(t).toContain('Lo que ya viviste');
  expect(t).toContain('Primer encuentro');
});

test('si ya hay perfil de personalidad se ofrece verlo mientras espera', async () => {
  api.obtenerMiPerfilPersonalidad.mockResolvedValue({
    titulo: 'El que rompe el hielo',
    resumen: 'Te mueve la gente nueva.',
    ejes: [],
  });
  const t = textoDe(await render({ onVerPerfil: jest.fn() }));
  expect(t).toContain('El que rompe el hielo');
});
