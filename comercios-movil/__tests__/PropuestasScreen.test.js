// ============================================================================
// Propuestas de bienvenida: con qué se recibe al grupo cuando cruza la puerta.
//
//   cd comercios-movil && npm test
//
// Lo que se prueba:
//
//   - `incluye` es un TEXT[] en la base y aquí se edita como texto con una
//     línea por ítem: la conversión de ida y vuelta es donde se pierden cosas;
//   - el interruptor optimista, que tiene que revertirse al fallar — una
//     bienvenida que el local cree apagada y sigue activa se le promete a un
//     grupo que va a llegar esperándola;
//   - una duración vacía tiene que llegar como cadena vacía y no como null,
//     porque la API actualiza con COALESCE y un null significa "no lo toques".
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import PropuestasScreen from '../src/screens/PropuestasScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    listarPropuestas: jest.fn(),
    crearPropuesta: jest.fn(),
    actualizarPropuesta: jest.fn(),
    eliminarPropuesta: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const BRINDIS = {
  id: 'pr-1',
  titulo: 'Brindis de entrada',
  descripcion: 'Se recibe al grupo en la mesa larga',
  incluye: ['Copa de bienvenida', 'Mesa larga reservada'],
  precio_persona: 12000,
  duracion_min: 30,
  vigente_desde: null,
  vigente_hasta: null,
  activa: true,
};

async function montar(propuestas = [BRINDIS]) {
  api.listarPropuestas.mockResolvedValue(propuestas);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<PropuestasScreen onVolver={() => {}} />);
  });
  return arbol;
}

const interruptores = (arbol) =>
  arbol.root.findAll((n) => n.props && typeof n.props.onValueChange === 'function');

const escribir = (arbol, etiqueta, valor) => {
  const campo = arbol.root
    .findAll((n) => n.props && typeof n.props.onCambiar === 'function')
    .find((n) => (n.props.etiqueta || '').includes(etiqueta));
  if (!campo) throw new Error(`No hay ningún campo "${etiqueta}"`);
  return act(async () => campo.props.onCambiar(valor));
};

beforeEach(() => jest.clearAllMocks());

test('lista lo que incluye la bienvenida, ítem por ítem', async () => {
  const texto = contenido(await montar());
  expect(texto).toContain('Brindis de entrada');
  expect(texto).toContain('Copa de bienvenida');
  expect(texto).toContain('Mesa larga reservada');
  expect(texto).toContain('12.000 por persona');
  expect(texto).toContain('30 min');
});

test('una bienvenida gratis lo dice, en vez de mostrar un $0', async () => {
  const texto = contenido(await montar([{ ...BRINDIS, precio_persona: 0 }]));
  expect(texto).toContain('Sin costo extra');
  expect(texto).not.toContain('$0');
});

test('sin propuestas explica para qué sirve tener una', async () => {
  expect(contenido(await montar([]))).toContain('no empiece en silencio');
});

test('apagarla se ve al instante y se revierte si la API falla', async () => {
  const arbol = await montar();
  api.actualizarPropuesta.mockRejectedValue(new Error('Error HTTP 500'));

  await act(async () => interruptores(arbol)[0].props.onValueChange(false));

  expect(api.actualizarPropuesta).toHaveBeenCalledWith('pr-1', { activa: false });
  // Sigue encendida en pantalla porque sigue encendida en la base.
  expect(interruptores(arbol)[0].props.value).toBe(true);
  expect(contenido(arbol)).toContain('Error HTTP 500');
});

test('cada línea de "qué incluye" se manda como un ítem de la lista', async () => {
  const arbol = await montar([]);
  api.crearPropuesta.mockResolvedValue(BRINDIS);

  await pulsar(botonConTexto(arbol, 'Crear bienvenida'));
  await escribir(arbol, 'Nombre', 'Brindis de entrada');
  // Con una línea en blanco en medio, que es lo que pasa al teclear en un
  // teléfono: no debe convertirse en un ítem vacío.
  await escribir(arbol, 'Qué incluye', 'Copa de bienvenida\n\n  Mesa larga reservada  \n');
  await pulsar(botonConTexto(arbol, 'Guardar bienvenida'));

  expect(api.crearPropuesta).toHaveBeenCalledWith(
    expect.objectContaining({
      incluye: ['Copa de bienvenida', 'Mesa larga reservada'],
      activa: true,
    }),
  );
});

test('al editar carga los ítems existentes y conserva los que no se tocan', async () => {
  const arbol = await montar();
  api.actualizarPropuesta.mockResolvedValue({ ...BRINDIS, precio_persona: 15000 });

  await pulsar(botonConTexto(arbol, 'Editar'));
  await escribir(arbol, 'Precio', '15000');
  await pulsar(botonConTexto(arbol, 'Guardar cambios'));

  expect(api.actualizarPropuesta).toHaveBeenCalledWith(
    'pr-1',
    expect.objectContaining({
      precio_persona: 15000,
      // Los ítems vienen del texto precargado: editar el precio no puede
      // vaciar la lista de lo que incluye.
      incluye: ['Copa de bienvenida', 'Mesa larga reservada'],
    }),
  );
  expect(contenido(arbol)).toContain('15.000');
});

test('una duración vacía se manda como cadena vacía, no como null', async () => {
  const arbol = await montar();
  api.actualizarPropuesta.mockResolvedValue({ ...BRINDIS, duracion_min: null });

  await pulsar(botonConTexto(arbol, 'Editar'));
  await escribir(arbol, 'Duración', '');
  await pulsar(botonConTexto(arbol, 'Guardar cambios'));

  // Con null, COALESCE(null, duracion_min) dejaría los 30 minutos intactos.
  expect(api.actualizarPropuesta).toHaveBeenCalledWith(
    'pr-1',
    expect.objectContaining({ duracion_min: '' }),
  );
});

test('no manda una fecha de vigencia a medio escribir', async () => {
  const arbol = await montar([]);

  await pulsar(botonConTexto(arbol, 'Crear bienvenida'));
  await escribir(arbol, 'Nombre', 'Temporada de fin de año');
  await escribir(arbol, 'Vigente desde', '2026-12');
  await pulsar(botonConTexto(arbol, 'Guardar bienvenida'));

  expect(api.crearPropuesta).not.toHaveBeenCalled();
  expect(contenido(arbol)).toContain('AAAA-MM-DD');
});

test('sin fechas escritas, la vigencia no viaja en el cuerpo', async () => {
  const arbol = await montar([]);
  api.crearPropuesta.mockResolvedValue(BRINDIS);

  await pulsar(botonConTexto(arbol, 'Crear bienvenida'));
  await escribir(arbol, 'Nombre', 'Brindis de entrada');
  await pulsar(botonConTexto(arbol, 'Guardar bienvenida'));

  // Mandarlas vacías sería un DATE inválido; omitirlas deja la propuesta
  // siempre vigente, que es lo que dice la ayuda del formulario.
  const cuerpo = api.crearPropuesta.mock.calls[0][0];
  expect(cuerpo).not.toHaveProperty('vigente_desde');
  expect(cuerpo).not.toHaveProperty('vigente_hasta');
});
