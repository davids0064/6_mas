// ============================================================================
// Resumen del comercio: la tarjeta de afiliación.
//
//   cd comercios-movil && npm test
//
// El tier del comercio decide cuántos grupos recibe al mes. Si deja de
// recibirlos y la app no le dice por qué, no escribe para preguntar: se va. Por
// eso la afiliación va arriba del todo, y por eso tiene pruebas.
//
// Lo que se cubre son los casos límite, que es donde este tipo de tarjeta
// miente: el cupo agotado, el singular, y la suscripción que no existe.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import ResumenScreen from '../src/screens/ResumenScreen';
import { api } from '../src/services/api';
import { contenido } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: { obtenerResumen: jest.fn() },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const BASE = {
  comercio: { nombre: 'Café Botánico', ciudad: 'Pereira' },
  contadores: {},
  proximos_eventos: [],
  pendientes: [],
};

const conAfiliacion = (afiliacion, pendientes = []) => ({ ...BASE, afiliacion, pendientes });

async function render(resumen) {
  api.obtenerResumen.mockResolvedValue(resumen);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<ResumenScreen onVerEvento={jest.fn()} onIrA={jest.fn()} />);
  });
  return contenido(arbol);
}

beforeEach(() => jest.clearAllMocks());

test('muestra el plan y cuánto cupo queda', async () => {
  const t = await render(
    conAfiliacion({
      plan: 'gold',
      estado: 'activa',
      grupos_mes: 6,
      grupos_disponibles: 5,
      dias_restantes: 12,
    })
  );
  expect(t).toContain('GOLD');
  expect(t).toContain('5 grupos disponibles');
  expect(t).toContain('1 de 6 usados');
  expect(t).toContain('en 12 días');
});

test('con un solo grupo libre lo dice en singular', async () => {
  const t = await render(
    conAfiliacion({ plan: 'bronce', estado: 'activa', grupos_mes: 2, grupos_disponibles: 1, dias_restantes: 3 })
  );
  expect(t).toContain('1 grupo disponible');
  expect(t).not.toContain('1 grupos');
});

test('el cupo agotado se explica, no se presenta como un error', async () => {
  // Agotar el cupo no es un fallo: es que el comercio ya recibió lo que compró.
  // Tratarlo como alarma castiga justamente al que mejor le va.
  const t = await render(
    conAfiliacion({ plan: 'bronce', estado: 'activa', grupos_mes: 2, grupos_disponibles: 0, dias_restantes: 9 })
  );
  expect(t).toContain('Ya recibiste todo tu cupo');
  expect(t).toContain('se renueva en 9 días');
});

test('sin suscripción avisa de que no está recibiendo grupos', async () => {
  const t = await render(conAfiliacion(null));
  expect(t).toContain('No está vigente');
  expect(t).toContain('No estás recibiendo grupos');
});

test('"hoy" y "mañana" en vez de "en 0 días"', async () => {
  const hoy = await render(
    conAfiliacion({ plan: 'plata', estado: 'activa', grupos_mes: 4, grupos_disponibles: 2, dias_restantes: 0 })
  );
  expect(hoy).toContain('renueva hoy');

  const manana = await render(
    conAfiliacion({ plan: 'plata', estado: 'activa', grupos_mes: 4, grupos_disponibles: 2, dias_restantes: 1 })
  );
  expect(manana).toContain('renueva mañana');
});

test('los avisos de afiliación no ofrecen un "Resolver" que no lleva a nada', async () => {
  // Los pendientes de perfil sí se arreglan desde una pantalla; los de la
  // afiliación se arreglan pagando. Un botón que no hace nada es peor que
  // ninguno.
  const t = await render(
    conAfiliacion(null, [
      { clave: 'afiliacion', texto: 'Tu afiliación no está vigente.' },
      { clave: 'plan', texto: 'Crea un plan.' },
    ])
  );
  expect(t).toContain('Tu afiliación no está vigente.');
  expect(t).toContain('Crea un plan.');
  // Un solo "Resolver →": el del plan.
  expect(t.match(/Resolver/g) || []).toHaveLength(1);
});
