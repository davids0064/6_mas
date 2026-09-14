// ============================================================================
// Lista de menús: el nivel de arriba del editor.
//
//   cd comercios-movil && npm test
//
// El estado (borrador / publicado / archivado) es lo único de esta pantalla con
// consecuencias fuera del local: publicado es lo que ve alguien de fuera. Se
// cambia desde aquí, es optimista, y por eso tiene que revertirse al fallar —
// un menú que el local cree publicado y sigue en borrador no lo ve nadie.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import MenusScreen from '../src/screens/MenusScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    listarMenus: jest.fn(),
    crearMenu: jest.fn(),
    actualizarMenu: jest.fn(),
    eliminarMenu: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const CARTA = {
  id: 'm-1',
  nombre: 'Carta de la noche',
  descripcion: 'De jueves a sábado',
  estado: 'publicado',
  total_secciones: 3,
  total_items: 14,
};

async function montar(menus = [CARTA], onAbrirMenu = () => {}) {
  api.listarMenus.mockResolvedValue(menus);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<MenusScreen onAbrirMenu={onAbrirMenu} onVolver={() => {}} />);
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

beforeEach(() => jest.clearAllMocks());

test('muestra el estado del menú y cuánto tiene dentro', async () => {
  const texto = contenido(await montar());
  expect(texto).toContain('Carta de la noche');
  expect(texto).toContain('Publicado');
  expect(texto).toContain('3 secciones');
  expect(texto).toContain('14 platos');
});

test('el singular se escribe bien', async () => {
  const texto = contenido(await montar([{ ...CARTA, total_secciones: 1, total_items: 1 }]));
  expect(texto).toContain('1 sección · 1 plato');
});

test('sin menús explica qué se está perdiendo el grupo', async () => {
  expect(contenido(await montar([]))).toContain('llega sin saber qué va a comer');
});

test('tocar el menú abre su editor', async () => {
  const abrir = jest.fn();
  const arbol = await montar([CARTA], abrir);

  await pulsar(botonConTexto(arbol, 'Carta de la noche'));

  expect(abrir).toHaveBeenCalledWith(CARTA);
});

test('publicar es inmediato y se revierte si la API falla', async () => {
  const arbol = await montar([{ ...CARTA, estado: 'borrador' }]);
  api.actualizarMenu.mockRejectedValue(new Error('Error HTTP 500'));

  await pulsar(botonConTexto(arbol, 'Publicado'));

  expect(api.actualizarMenu).toHaveBeenCalledWith('m-1', { estado: 'publicado' });
  // Un menú que el local cree publicado y sigue en borrador no lo ve nadie, así
  // que la pantalla no puede quedarse mostrando el estado que no es.
  const texto = contenido(arbol);
  expect(texto).toContain('Borrador');
  expect(texto).toContain('Error HTTP 500');
});

test('renombrar no borra los conteos que el PUT no devuelve', async () => {
  const arbol = await montar();
  // El PUT responde el menú sin total_secciones ni total_items: son
  // subconsultas que solo hace el listado.
  api.actualizarMenu.mockResolvedValue({
    id: 'm-1',
    nombre: 'Carta de temporada',
    descripcion: 'De jueves a sábado',
    estado: 'publicado',
  });

  await pulsar(botonConTexto(arbol, 'Renombrar'));
  await escribir(arbol, 'Nombre', 'Carta de temporada');
  await pulsar(botonConTexto(arbol, 'Guardar cambios'));

  const texto = contenido(arbol);
  expect(texto).toContain('Carta de temporada');
  // Sin esto, un menú con catorce platos diría "0 secciones · 0 platos".
  expect(texto).toContain('3 secciones');
  expect(texto).toContain('14 platos');
});

test('eliminar avisa de que se lleva secciones y platos', async () => {
  const arbol = await montar();
  api.eliminarMenu.mockResolvedValue(null);

  await pulsar(botonConTexto(arbol, 'Eliminar'));
  expect(contenido(arbol)).toContain('Se va con todas sus secciones y platos');
  expect(api.eliminarMenu).not.toHaveBeenCalled();

  await pulsar(botonConTexto(arbol, 'Sí, eliminar'));
  expect(api.eliminarMenu).toHaveBeenCalledWith('m-1');
  expect(contenido(arbol)).not.toContain('Carta de la noche');
});

test('el menú nuevo aparece en la lista con sus conteos en cero', async () => {
  const arbol = await montar([]);
  api.crearMenu.mockResolvedValue({
    id: 'm-2',
    nombre: 'Almuerzo ejecutivo',
    descripcion: null,
    estado: 'borrador',
  });

  await pulsar(botonConTexto(arbol, 'Crear menú'));
  await escribir(arbol, 'Nombre', 'Almuerzo ejecutivo');
  await pulsar(botonConTexto(arbol, 'Crear menú'));

  expect(api.crearMenu).toHaveBeenCalledWith({ nombre: 'Almuerzo ejecutivo', descripcion: null });
  const texto = contenido(arbol);
  expect(texto).toContain('Almuerzo ejecutivo');
  expect(texto).toContain('0 secciones');
});
