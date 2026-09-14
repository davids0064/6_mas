// ============================================================================
// Pantalla "Tu perfil".
//
//   cd mobile && npm test
//
// Existe por la guideline 4.2: la app pedía veinte preguntas y no devolvía
// nada. Esta pantalla es lo que devuelve, así que lo que se prueba es que de
// verdad muestre algo y no vuelva a quedarse en blanco:
//
//   * que pinte el tipo y los ejes que manda el backend;
//   * que un eje sostenido por una sola respuesta se marque como tal en vez de
//     presentarse como si fuera firme;
//   * que la lista de "esto NO lo usamos para agruparte" aparezca. Es una
//     promesa sobre datos sensibles que la app pide, y si dejara de verse,
//     nadie se enteraría;
//   * que sin test hecho ofrezca hacerlo en vez de pintar un perfil vacío.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import PerfilScreen from '../src/screens/PerfilScreen';
import { api } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  api: { obtenerMiPerfilPersonalidad: jest.fn() },
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    FadeInDown: { delay: () => ({ duration: () => ({}) }), duration: () => ({}) },
  };
});
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const PERFIL = {
  titulo: 'El explorador tranquilo',
  resumen: 'Te interesa lo que no conocías más que el ruido.',
  ejes: [
    {
      clave: 'energia_social',
      etiqueta: 'Energía social',
      polo_bajo: 'Reservado',
      polo_alto: 'Expansivo',
      valor: 0.25,
      preguntas_usadas: 4,
    },
    {
      clave: 'apertura',
      etiqueta: 'Apetito de novedad',
      polo_bajo: 'De lo conocido',
      polo_alto: 'De lo nuevo',
      valor: 1,
      preguntas_usadas: 1,
    },
    // Un eje sin ninguna respuesta no se dibuja: una barra en cero diría
    // "estás en el extremo bajo", que es distinto de "no lo sabemos".
    {
      clave: 'estructura',
      etiqueta: 'Cómo decides',
      polo_bajo: 'Sobre la marcha',
      polo_alto: 'Con un plan',
      valor: null,
      preguntas_usadas: 0,
    },
  ],
  no_se_usan: [
    { pregunta: 'identidad', motivo: 'No agrupamos por orientación ni identidad.' },
  ],
};

const textos = (arbol) => JSON.stringify(arbol.toJSON());

async function render(props = {}) {
  let arbol;
  await act(async () => {
    arbol = renderer.create(<PerfilScreen {...props} />);
  });
  return arbol;
}

test('muestra el tipo y su descripción', async () => {
  api.obtenerMiPerfilPersonalidad.mockResolvedValue(PERFIL);
  const arbol = await render();
  const t = textos(arbol);
  expect(t).toContain('El explorador tranquilo');
  expect(t).toContain('Te interesa lo que no conocías más que el ruido.');
});

test('dibuja los ejes con dato y omite el que no tiene', async () => {
  api.obtenerMiPerfilPersonalidad.mockResolvedValue(PERFIL);
  const t = textos(await render());
  expect(t).toContain('Energía social');
  expect(t).toContain('Apetito de novedad');
  expect(t).not.toContain('Cómo decides');
});

test('marca el eje que se apoya en una sola respuesta', async () => {
  api.obtenerMiPerfilPersonalidad.mockResolvedValue(PERFIL);
  expect(textos(await render())).toContain('1 respuesta');
});

test('dice qué datos NO se usan para agrupar', async () => {
  api.obtenerMiPerfilPersonalidad.mockResolvedValue(PERFIL);
  const t = textos(await render());
  expect(t).toContain('No agrupamos por orientación ni identidad.');
  expect(t).toContain('Lo que NO usamos para agruparte');
});

test('sin test hecho ofrece hacerlo en vez de un perfil vacío', async () => {
  // El backend responde 204 → null.
  api.obtenerMiPerfilPersonalidad.mockResolvedValue(null);
  const t = textos(await render({ onRehacerTest: jest.fn() }));
  expect(t).toContain('Todavía no tienes perfil');
  expect(t).toContain('Hacer el test');
});

test('si el backend falla lo dice y no deja la pantalla en blanco', async () => {
  api.obtenerMiPerfilPersonalidad.mockRejectedValue(new Error('sin conexión'));
  expect(textos(await render())).toContain('sin conexión');
});
