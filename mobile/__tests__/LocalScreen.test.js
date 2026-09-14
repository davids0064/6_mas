// ============================================================================
// Pantalla "El sitio".
//
//   cd mobile && npm test
//
// Es el contenido que más pesa contra la guideline 4.2: la carta del local, qué
// se encuentra el grupo al llegar, el horario y cómo llegar. Todo eso lo
// publica el comercio desde su propia app, así que lo que se prueba acá es que
// esta pantalla aguante lo que un local real le va a mandar:
//
//   * un menú con secciones y platos, anidado por la API;
//   * una sección vacía (el comercio la creó y todavía no le puso platos);
//   * un local sin propuesta de bienvenida y sin carta — perfectamente normal
//     recién registrado — sin romperse ni dejar huecos;
//   * un comercio dado de baja después de que se asignó el plan, que es el
//     único caso en que la vista pública no devuelve nada.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import LocalScreen from '../src/screens/LocalScreen';
import { api } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  api: { obtenerLocalDelPlan: jest.fn() },
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

const EVENTO = { id: 'evt-1', titulo: 'Cena larga' };

const COMPLETO = {
  comercio: {
    nombre: 'Café Botánico',
    descripcion: 'Cocina de mercado y mesa larga.',
    direccion: 'Cra. 14 #4-32',
    ciudad: 'Pereira',
    horario: 'Mar a sáb, 5 p. m. a 11 p. m.',
  },
  anfitrion: { nombre: 'Camila Restrepo' },
  propuesta: {
    titulo: 'Mesa larga de bienvenida',
    incluye: ['Bebida de bienvenida', 'Tabla para compartir'],
    precio_persona: '18000.00',
  },
  menus: [
    {
      id: 'm1',
      nombre: 'Carta de la noche',
      secciones: [
        { id: 's1', nombre: 'Para empezar', items: [{ id: 'i1', nombre: 'Tabla de la casa', precio: '38000.00' }] },
        { id: 's2', nombre: 'Sección recién creada', items: [] },
      ],
    },
  ],
};

const textos = (arbol) => JSON.stringify(arbol.toJSON());

async function render(datos) {
  api.obtenerLocalDelPlan.mockResolvedValue(datos);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<LocalScreen evento={EVENTO} />);
  });
  return arbol;
}

test('muestra el local, su anfitrión y su horario', async () => {
  const t = textos(await render(COMPLETO));
  expect(t).toContain('Café Botánico');
  expect(t).toContain('Cra. 14 #4-32');
  expect(t).toContain('Mar a sáb, 5 p. m. a 11 p. m.');
  // Solo el primer nombre del anfitrión, como en la tarjeta del plan. Se
  // comprueban por separado porque React parte el texto en dos hijos
  // ("🤝 Te recibe " y "Camila") y en el árbol serializado no forman una sola
  // cadena.
  expect(t).toContain('Te recibe ');
  expect(t).toContain('Camila');
  expect(t).not.toContain('Restrepo');
});

test('muestra la carta con sus secciones y precios', async () => {
  const t = textos(await render(COMPLETO));
  expect(t).toContain('Para empezar');
  expect(t).toContain('Tabla de la casa');
  expect(t).toContain('38.000');
});

test('una sección sin platos no deja un encabezado suelto', async () => {
  expect(textos(await render(COMPLETO))).not.toContain('Sección recién creada');
});

test('muestra qué se encuentran al llegar', async () => {
  const t = textos(await render(COMPLETO));
  expect(t).toContain('Mesa larga de bienvenida');
  expect(t).toContain('Bebida de bienvenida');
  expect(t).toContain('18.000');
});

test('un local sin carta ni propuesta se pinta igual, sin huecos', async () => {
  const t = textos(await render({
    comercio: { nombre: 'Local Nuevo', direccion: 'Calle 1' },
    anfitrion: null,
    propuesta: null,
    menus: [],
  }));
  expect(t).toContain('Local Nuevo');
  expect(t).not.toContain('LA CARTA');
  expect(t).not.toContain('AL LLEGAR');
});

test('un comercio dado de baja lo dice, y no deja la pantalla muda', async () => {
  // v_comercio_publico filtra por `activo`: si el local se da de baja después
  // de que el matching asignó el plan, deja de devolverse. El plan sigue en pie.
  const t = textos(await render({ comercio: null, anfitrion: null, propuesta: null, menus: [] }));
  expect(t).toContain('ya no está disponible');
  expect(t).toContain('Tu plan sigue en pie');
});
