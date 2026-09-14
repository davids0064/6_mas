// ============================================================================
// Editor de menús: secciones y platos, el árbol de tres niveles que era la
// última cosa que solo se podía hacer en el panel web.
//
//   cd comercios-movil && npm test
//
// Lo que se prueba:
//
//   - el árbol se mantiene en memoria entre escrituras. La API devuelve la
//     sección sin sus ítems y el ítem sin su sección, así que aplicar la
//     respuesta a lo bruto vacía media pantalla;
//   - el interruptor de cada plato ("se acabó el pulpo") es optimista y tiene
//     que revertirse al fallar: un plato que el local cree agotado y sigue
//     disponible se sigue pidiendo;
//   - eliminar una sección dice cuántos platos se lleva por delante, porque en
//     la base es un DELETE real con CASCADE.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import MenuEditorScreen from '../src/screens/MenuEditorScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    obtenerMenu: jest.fn(),
    crearSeccion: jest.fn(),
    actualizarSeccion: jest.fn(),
    eliminarSeccion: jest.fn(),
    crearItem: jest.fn(),
    actualizarItem: jest.fn(),
    eliminarItem: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const MENU = { id: 'm-1', nombre: 'Carta de la noche', estado: 'publicado' };

const PULPO = {
  id: 'i-1',
  nombre: 'Pulpo a la brasa',
  descripcion: 'Con papa criolla',
  precio: 38000,
  disponible: true,
};
const TARTAR = { id: 'i-2', nombre: 'Tartar de atún', descripcion: null, precio: 32000, disponible: true };

const ARBOL = {
  ...MENU,
  secciones: [
    { id: 's-1', nombre: 'Entradas', descripcion: 'Para compartir', items: [PULPO, TARTAR] },
    { id: 's-2', nombre: 'Postres', descripcion: null, items: [] },
  ],
};

async function montar(arbol = ARBOL) {
  api.obtenerMenu.mockResolvedValue(arbol);
  let vista;
  await act(async () => {
    vista = renderer.create(<MenuEditorScreen menu={MENU} onVolver={() => {}} />);
  });
  return vista;
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

test('las secciones vienen plegadas: en un teléfono no cabe el menú entero', async () => {
  const arbol = await montar();
  const texto = contenido(arbol);

  expect(texto).toContain('Entradas');
  expect(texto).toContain('2 platos');
  // El contenido de la sección no se ve hasta abrirla.
  expect(texto).not.toContain('Pulpo a la brasa');
});

test('con una sola sección se abre sola, sin pedir un toque de más', async () => {
  const arbol = await montar({ ...ARBOL, secciones: [ARBOL.secciones[0]] });
  expect(contenido(arbol)).toContain('Pulpo a la brasa');
});

test('abrir una sección muestra sus platos con precio', async () => {
  const arbol = await montar();

  await pulsar(botonConTexto(arbol, 'Entradas'));

  const texto = contenido(arbol);
  expect(texto).toContain('Pulpo a la brasa');
  expect(texto).toContain('38.000');
  expect(texto).toContain('Tartar de atún');
});

test('agotar un plato se ve al instante y se revierte si la API falla', async () => {
  const arbol = await montar();
  await pulsar(botonConTexto(arbol, 'Entradas'));
  api.actualizarItem.mockRejectedValue(new Error('Error HTTP 500'));

  await act(async () => interruptores(arbol)[0].props.onValueChange(false));

  expect(api.actualizarItem).toHaveBeenCalledWith('i-1', { disponible: false });
  // Sigue disponible en pantalla porque sigue disponible en la base.
  expect(interruptores(arbol)[0].props.value).toBe(true);
  expect(contenido(arbol)).toContain('Error HTTP 500');
});

test('un plato agotado se marca sin desaparecer de la carta', async () => {
  const arbol = await montar({
    ...ARBOL,
    secciones: [{ ...ARBOL.secciones[0], items: [{ ...PULPO, disponible: false }] }],
  });
  const texto = contenido(arbol);
  expect(texto).toContain('Pulpo a la brasa');
  expect(texto).toContain('agotado');
});

test('la cabecera cuenta los agotados sin tener que desplegar la sección', async () => {
  const arbol = await montar({
    ...ARBOL,
    secciones: [{ ...ARBOL.secciones[0], items: [{ ...PULPO, disponible: false }, TARTAR] }, ARBOL.secciones[1]],
  });
  expect(contenido(arbol)).toContain('1 agotado');
});

test('agregar un plato lo suma a su sección sin recargar el menú', async () => {
  const arbol = await montar();
  const nuevo = { id: 'i-3', nombre: 'Croquetas', descripcion: null, precio: 22000, disponible: true };
  api.crearItem.mockResolvedValue(nuevo);

  await pulsar(botonConTexto(arbol, 'Entradas'));
  await pulsar(botonConTexto(arbol, 'Agregar plato'));
  await escribir(arbol, 'Nombre', 'Croquetas');
  await escribir(arbol, 'Precio', '22000');
  await pulsar(botonConTexto(arbol, 'Agregar plato'));

  expect(api.crearItem).toHaveBeenCalledWith(
    's-1',
    expect.objectContaining({ nombre: 'Croquetas', precio: 22000, disponible: true }),
  );
  // Una sola petición: recargar el árbol entero por cada plato haría saltar el
  // scroll y costaría una ida y vuelta de red por pulsación.
  expect(api.obtenerMenu).toHaveBeenCalledTimes(1);
  const texto = contenido(arbol);
  expect(texto).toContain('Croquetas');
  expect(texto).toContain('Pulpo a la brasa');
});

test('renombrar una sección no le vacía los platos', async () => {
  const arbol = await montar();
  // La API responde la sección sin sus ítems: es su forma de responder, y la
  // pantalla tiene que conservar los que ya tenía.
  api.actualizarSeccion.mockResolvedValue({
    id: 's-1',
    nombre: 'Para empezar',
    descripcion: 'Para compartir',
  });

  await pulsar(botonConTexto(arbol, 'Entradas'));
  await pulsar(botonConTexto(arbol, 'Renombrar sección'));
  await escribir(arbol, 'Nombre', 'Para empezar');
  await pulsar(botonConTexto(arbol, 'Guardar cambios'));

  const texto = contenido(arbol);
  expect(texto).toContain('Para empezar');
  expect(texto).toContain('2 platos');
});

test('eliminar una sección avisa de cuántos platos se lleva', async () => {
  const arbol = await montar();
  api.eliminarSeccion.mockResolvedValue(null);

  await pulsar(botonConTexto(arbol, 'Entradas'));
  await pulsar(botonConTexto(arbol, 'Eliminar sección'));

  // En la base es un DELETE real con CASCADE: los platos se van con ella.
  expect(contenido(arbol)).toContain('Se lleva sus 2 platos');
  expect(api.eliminarSeccion).not.toHaveBeenCalled();

  await pulsar(botonConTexto(arbol, 'Sí, eliminar'));
  expect(api.eliminarSeccion).toHaveBeenCalledWith('s-1');
  expect(contenido(arbol)).not.toContain('Entradas');
});

test('la sección nueva queda abierta para poder llenarla', async () => {
  const arbol = await montar();
  api.crearSeccion.mockResolvedValue({ id: 's-3', nombre: 'Fuertes', descripcion: null });

  await pulsar(botonConTexto(arbol, 'Agregar sección'));
  await escribir(arbol, 'Nombre', 'Fuertes');
  await pulsar(botonConTexto(arbol, 'Crear sección'));

  expect(api.crearSeccion).toHaveBeenCalledWith('m-1', expect.objectContaining({ nombre: 'Fuertes' }));
  // Recién creada está vacía, así que lo siguiente es agregarle un plato: se
  // deja abierta para que ese sea el paso obvio.
  expect(contenido(arbol)).toContain('Agregar plato');
});
