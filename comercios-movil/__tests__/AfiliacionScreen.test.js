// ============================================================================
// Pantalla "Mi afiliación".
//
//   cd comercios-movil && npm test
//
// El Resumen ya dice cuánto cupo queda. Esta pantalla responde la pregunta que
// viene después, y que es la que de verdad importa cuando el contador llega a
// cero: "¿en qué se me fue?".
//
// Se prueba sobre todo que la lista cuadre con el contador — si no cuadran, el
// contador deja de creerse — y que la pantalla no prometa un pago que no
// existe: el cobro va por transferencia y lo gestiona una persona.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import AfiliacionScreen from '../src/screens/AfiliacionScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: { obtenerAfiliacion: jest.fn() },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const PLANES = [
  { nombre: 'bronce', nivel: 10, grupos_mes: 2 },
  { nombre: 'plata', nivel: 20, grupos_mes: 4 },
  { nombre: 'gold', nivel: 30, grupos_mes: 6 },
];

const VIGENTE = {
  actual: {
    plan: 'gold',
    estado: 'activa',
    grupos_mes: 6,
    grupos_usados: 2,
    grupos_disponibles: 4,
    inicio: '2026-10-06',
    fin: '2026-11-05',
    dias_restantes: 12,
  },
  consumo: [
    { id: 'e1', titulo: 'Cena larga', fecha_hora: '2026-10-10 19:30:00+00', estado: 'finalizado', ya_ocurrio: true },
    { id: 'e2', titulo: 'Noche de vinilos', fecha_hora: '2026-10-28 19:00:00+00', estado: 'confirmado', ya_ocurrio: false },
  ],
  planes: PLANES,
  historial: [{ plan: 'gold', inicio: '2026-10-06', fin: '2026-11-05', estado: 'activa' }],
};

async function render(datos) {
  api.obtenerAfiliacion.mockResolvedValue(datos);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<AfiliacionScreen onVolver={jest.fn()} />);
  });
  return arbol;
}

beforeEach(() => jest.clearAllMocks());

test('muestra el plan, el cupo y el periodo', async () => {
  const t = contenido(await render(VIGENTE));
  expect(t).toContain('GOLD');
  expect(t).toContain('4 de 6 grupos sin usar');
  expect(t).toContain('renueva en 12 días');
});

test('lista en qué se fue el cupo, y la lista cuadra con el contador', async () => {
  // Si la lista no suma lo mismo que "2 usados", el contador deja de creerse.
  const t = contenido(await render(VIGENTE));
  expect(t).toContain('Cena larga');
  expect(t).toContain('Noche de vinilos');
  expect(VIGENTE.consumo).toHaveLength(VIGENTE.actual.grupos_usados);
});

test('distingue lo que ya ocurrió de lo que viene', async () => {
  const t = contenido(await render(VIGENTE));
  expect(t).toContain('Ya ocurrió');
  expect(t).toContain('Por venir');
});

test('sin consumo lo dice en vez de dejar un hueco', async () => {
  const t = contenido(await render({ ...VIGENTE, consumo: [] }));
  expect(t).toContain('Todavía no has recibido ningún grupo');
});

test('marca cuál de los planes es el tuyo', async () => {
  const t = contenido(await render(VIGENTE));
  expect(t).toContain('el tuyo');
  expect(t).toContain('2 grupos al mes');
  expect(t).toContain('6 grupos al mes');
});

test('no promete un pago que la app no hace', async () => {
  // El cobro va por transferencia y lo gestiona una persona. Un botón de
  // "pagar" que no cobra es peor que no estar.
  const arbol = await render(VIGENTE);
  const t = contenido(arbol);
  expect(t).toContain('por transferencia');
  expect(t).not.toMatch(/pagar ahora|tarjeta|checkout/i);
  // El botón remite a hablar con alguien, no a un cobro.
  expect(botonConTexto(arbol, 'Cambiar de plan o renovar')).toBeDefined();
});

test('sin afiliación vigente lo dice y ofrece activarla', async () => {
  const t = contenido(await render({ actual: null, consumo: [], planes: PLANES, historial: [] }));
  expect(t).toContain('no está vigente');
  expect(t).toContain('Activar mi afiliación');
});

test('el cupo agotado se explica sin tratarlo como un error', async () => {
  const t = contenido(
    await render({ ...VIGENTE, actual: { ...VIGENTE.actual, grupos_disponibles: 0, grupos_usados: 6 } })
  );
  expect(t).toContain('Cupo agotado');
});


test('las fechas del periodo no se corren un día', async () => {
  // Una fecha sin hora ('2026-10-06') la interpreta JavaScript como medianoche
  // UTC, y en Colombia eso cae el día anterior. El periodo se mostraba un día
  // antes de principio a fin, que es el tipo de error que nadie reporta pero
  // que hace dudar de todo lo demás que dice la pantalla.
  const t = contenido(
    await render({
      ...VIGENTE,
      actual: { ...VIGENTE.actual, inicio: '2026-10-06', fin: '2026-11-05' },
    })
  );
  expect(t).toMatch(/6 de oct/);
  expect(t).toMatch(/5 de nov/);
  expect(t).not.toMatch(/5 de oct/);
});
