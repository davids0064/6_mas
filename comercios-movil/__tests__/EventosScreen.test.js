// ============================================================================
// Lista de eventos y creación de uno a mano.
//
//   cd comercios-movil && npm test
//
// Crear un evento era lo último que solo se podía hacer desde el panel web.
// Casi todos los eventos los propone el matching; este es el que abre el local
// por su cuenta, y depende de algo que puede no existir todavía: un anfitrión
// propio. La API rechaza con un 422 el anfitrión de otro comercio, así que la
// pantalla tiene que elegir de la lista real y no dejar mandar nada sin ella.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import EventosScreen from '../src/screens/EventosScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    listarEventos: jest.fn(),
    listarAnfitriones: jest.fn(),
    crearEvento: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const MARCELA = { id: 'a-1', nombre: 'Marcela Ríos', titular: true };
const JULIÁN = { id: 'a-2', nombre: 'Julián Ospina', titular: false };

async function montar({ eventos = [], anfitriones = [MARCELA, JULIÁN] } = {}) {
  api.listarEventos.mockResolvedValue(eventos);
  api.listarAnfitriones.mockResolvedValue(anfitriones);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<EventosScreen onVerEvento={() => {}} onVolver={() => {}} />);
  });
  return arbol;
}

const escribir = (arbol, etiqueta, valor) => {
  const campo = arbol.root
    .findAll((n) => n.props && typeof n.props.onCambiar === 'function')
    .find((n) => (n.props.etiqueta || '').includes(etiqueta));
  if (!campo) throw new Error(`No hay ningún campo "${etiqueta}"`);
  return act(async () => campo.props.onCambiar(valor));
};

// Abre el formulario y espera a que cargue la lista de anfitriones.
async function abrirFormulario(arbol) {
  await pulsar(botonConTexto(arbol, 'Crear evento'));
  await act(async () => {});
}

beforeEach(() => jest.clearAllMocks());

test('propone al anfitrión titular, que es quien recibe por defecto', async () => {
  const arbol = await montar();
  api.crearEvento.mockResolvedValue({ id: 'e-9' });

  await abrirFormulario(arbol);
  await escribir(arbol, 'Nombre del evento', 'Cena larga de jueves');
  await escribir(arbol, 'Fecha', '2026-09-18');
  await escribir(arbol, 'Hora', '20:00');
  await pulsar(botonConTexto(arbol, 'Crear evento'));

  expect(api.crearEvento).toHaveBeenCalledWith(
    expect.objectContaining({
      anfitrion_id: 'a-1',
      titulo: 'Cena larga de jueves',
      // Sin zona horaria, igual que mandaba el datetime-local de la web:
      // Postgres lo interpreta en la zona del servidor.
      fecha_hora: '2026-09-18 20:00',
      capacidad: 6,
    }),
  );
});

test('se puede elegir otro anfitrión distinto del titular', async () => {
  const arbol = await montar();
  api.crearEvento.mockResolvedValue({ id: 'e-9' });

  await abrirFormulario(arbol);
  await pulsar(botonConTexto(arbol, 'Julián Ospina'));
  await escribir(arbol, 'Nombre del evento', 'Almuerzo de domingo');
  await escribir(arbol, 'Fecha', '2026-09-20');
  await escribir(arbol, 'Hora', '13:00');
  await pulsar(botonConTexto(arbol, 'Crear evento'));

  expect(api.crearEvento).toHaveBeenCalledWith(
    expect.objectContaining({ anfitrion_id: 'a-2' }),
  );
});

test('sin anfitriones dice qué falta en vez de un selector vacío', async () => {
  const arbol = await montar({ anfitriones: [] });

  await abrirFormulario(arbol);

  // La API rechazaría el POST de todas formas; decirlo antes ahorra el viaje y
  // explica qué hay que hacer.
  expect(contenido(arbol)).toContain('Primero define un anfitrión');
});

test('no manda una fecha ni una hora a medio escribir', async () => {
  const arbol = await montar();

  await abrirFormulario(arbol);
  await escribir(arbol, 'Nombre del evento', 'Cena larga de jueves');
  await escribir(arbol, 'Fecha', '2026-09');
  await escribir(arbol, 'Hora', '20');
  await pulsar(botonConTexto(arbol, 'Crear evento'));

  expect(api.crearEvento).not.toHaveBeenCalled();
  const texto = contenido(arbol);
  expect(texto).toContain('AAAA-MM-DD');
  expect(texto).toContain('HH:MM');
});

test('al crearlo se recarga la lista en vez de insertar la fila a mano', async () => {
  const arbol = await montar();
  api.crearEvento.mockResolvedValue({ id: 'e-9' });

  await abrirFormulario(arbol);
  await escribir(arbol, 'Nombre del evento', 'Cena larga de jueves');
  await escribir(arbol, 'Fecha', '2026-09-18');
  await escribir(arbol, 'Hora', '20:00');
  await pulsar(botonConTexto(arbol, 'Crear evento'));

  // Un evento del mes que viene creado mirando "Sin confirmar" no debería
  // aparecer en ese filtro; se deja decidir a la API.
  expect(api.listarEventos).toHaveBeenCalledTimes(2);
});

test('muestra el motivo si la API rechaza el evento', async () => {
  const arbol = await montar();
  const motivo = 'El anfitrión indicado no pertenece a este comercio.';
  api.crearEvento.mockRejectedValue(new Error(motivo));

  await abrirFormulario(arbol);
  await escribir(arbol, 'Nombre del evento', 'Cena larga de jueves');
  await escribir(arbol, 'Fecha', '2026-09-18');
  await escribir(arbol, 'Hora', '20:00');
  await pulsar(botonConTexto(arbol, 'Crear evento'));

  expect(contenido(arbol)).toContain(motivo);
});
