// ============================================================================
// Disponibilidad: las franjas en las que el local puede recibir grupos.
//
//   cd comercios-movil && npm test
//
// Lo que se prueba aquí es la acción frecuente y el riesgo que trae: el
// interruptor de cada franja actualiza la pantalla antes de que responda la
// API, porque esperar a la red para mover un switch se siente roto. Eso está
// bien mientras se revierta al fallar — si no, el local creería que cerró el
// martes y seguiría recibiendo grupos.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import DisponibilidadScreen from '../src/screens/DisponibilidadScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    listarDisponibilidad: jest.fn(),
    crearFranja: jest.fn(),
    actualizarFranja: jest.fn(),
    eliminarFranja: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const VIERNES = {
  id: 'f-1',
  dia_semana: 5,
  dia_nombre: 'viernes',
  hora_inicio: '19:00',
  hora_fin: '23:00',
  grupos_max: 2,
  activo: true,
};

async function montar(franjas = [VIERNES]) {
  api.listarDisponibilidad.mockResolvedValue(franjas);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<DisponibilidadScreen onVolver={() => {}} />);
  });
  return arbol;
}

// El Switch no lleva onPress sino onValueChange, así que se busca por su prop.
const interruptores = (arbol) =>
  arbol.root.findAll((n) => n.props && typeof n.props.onValueChange === 'function');

beforeEach(() => jest.clearAllMocks());

test('muestra la franja con su día, horas y cupo', async () => {
  const arbol = await montar();
  const texto = contenido(arbol);
  expect(texto).toContain('viernes');
  expect(texto).toContain('19:00');
  expect(texto).toContain('23:00');
  expect(texto).toContain('hasta 2 grupos');
});

test('el singular del cupo se escribe bien', async () => {
  const arbol = await montar([{ ...VIERNES, grupos_max: 1 }]);
  expect(contenido(arbol)).toContain('hasta 1 grupo');
  expect(contenido(arbol)).not.toContain('hasta 1 grupos');
});

test('sin franjas avisa de que el local no recibirá grupos', async () => {
  const arbol = await montar([]);
  expect(contenido(arbol)).toContain('Sin al menos una franja activa');
});

test('apagar una franja manda solo el campo activo', async () => {
  api.actualizarFranja.mockResolvedValue({ ...VIERNES, activo: false });
  const arbol = await montar();

  await act(async () => interruptores(arbol)[0].props.onValueChange());

  // Envío parcial: cambiar el interruptor no debe reenviar horas ni cupo, que
  // es como se pisan valores que otra persona acaba de editar.
  expect(api.actualizarFranja).toHaveBeenCalledWith('f-1', { activo: false });
});

test('si la API rechaza el cambio, el interruptor vuelve a su sitio', async () => {
  api.actualizarFranja.mockRejectedValue(new Error('Error HTTP 500'));
  const arbol = await montar();

  expect(interruptores(arbol)[0].props.value).toBe(true);
  await act(async () => interruptores(arbol)[0].props.onValueChange());

  // Lo importante: no se queda apagado dando a entender que el cambio se
  // guardó, y el error se ve.
  expect(interruptores(arbol)[0].props.value).toBe(true);
  expect(contenido(arbol)).toContain('Error HTTP 500');
});

test('eliminar una franja pide confirmación antes de llamar a la API', async () => {
  const arbol = await montar();

  await pulsar(botonConTexto(arbol, 'Eliminar'));

  expect(api.eliminarFranja).not.toHaveBeenCalled();
  expect(contenido(arbol)).toContain('¿Eliminar esta franja?');
});

test('al confirmar, la franja desaparece de la lista', async () => {
  api.eliminarFranja.mockResolvedValue(null);
  const arbol = await montar();

  await pulsar(botonConTexto(arbol, 'Eliminar'));
  await pulsar(botonConTexto(arbol, 'Sí, eliminar'));

  expect(api.eliminarFranja).toHaveBeenCalledWith('f-1');
  // La lista se queda vacía, y con ella vuelve el aviso de que sin franjas no
  // hay grupos: es la consecuencia real de haber borrado la última.
  expect(contenido(arbol)).toContain('Sin al menos una franja activa');
});
