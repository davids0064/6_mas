// ============================================================================
// Planes: la oferta del comercio, y la primera pantalla que la app le quita al
// panel web.
//
//   cd comercios-movil && npm test
//
// Se prueba lo que puede dejar al local fuera del reparto de grupos sin que se
// entere:
//
//   - el interruptor de cada plan se adelanta a la API, así que tiene que
//     revertirse al fallar; si no, el local creería que retiró un plan que
//     sigue ofreciéndose (o peor, que reactivó uno que sigue apagado);
//   - un plan sin categoría no se le ofrece a nadie, porque el matching busca
//     por interés — mandarlo sin elegir una es un plan invisible;
//   - los mensajes que solo la API puede dar (la capacidad mínima de seis) se
//     muestran tal cual, en vez de traducirlos a un "campo inválido".
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import PlanesScreen from '../src/screens/PlanesScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    listarPlanes: jest.fn(),
    listarIntereses: jest.fn(),
    crearPlan: jest.fn(),
    actualizarPlan: jest.fn(),
    eliminarPlan: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const INTERESES = [
  { id: 'gastronomia', nombre: 'Gastronomía', icono: '🍽️' },
  { id: 'musica', nombre: 'Música', icono: '🎵' },
];

const TAPAS = {
  id: 'p-1',
  interes_id: 'gastronomia',
  interes_nombre: 'Gastronomía',
  interes_icono: '🍽️',
  titulo: 'Noche de tapas',
  descripcion: 'Seis tapas y una copa',
  duracion_min: 120,
  precio: 45000,
  capacidad: 6,
  activo: true,
};

async function montar(planes = [TAPAS]) {
  api.listarPlanes.mockResolvedValue(planes);
  api.listarIntereses.mockResolvedValue(INTERESES);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<PlanesScreen onVolver={() => {}} />);
  });
  return arbol;
}

// El Switch no lleva onPress sino onValueChange.
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

test('muestra el plan con su categoría, precio, duración y capacidad', async () => {
  const texto = contenido(await montar());
  expect(texto).toContain('Noche de tapas');
  expect(texto).toContain('Gastronomía');
  // El precio se pinta con separador de miles, no como el 45000 que llega.
  expect(texto).toContain('45.000');
  expect(texto).toContain('120 min');
  expect(texto).toContain('6 personas');
});

test('avisa de que sin planes no entra en el reparto de grupos', async () => {
  const texto = contenido(await montar([]));
  expect(texto).toContain('Todavía no ofreces ningún plan');
  expect(texto).toContain('no entras en el reparto');
});

test('apagar un plan se ve al instante, sin esperar a la API', async () => {
  const arbol = await montar();
  // Una promesa que se resuelve cuando esta prueba quiera: mientras tanto es la
  // red lenta de un local, que es justo el momento que se quiere observar.
  let responder;
  api.actualizarPlan.mockReturnValue(new Promise((r) => { responder = r; }));

  // act síncrono a propósito: si se esperara la promesa, se estaría midiendo
  // la pantalla DESPUÉS de que responda la API, que es lo contrario de lo que
  // afirma la prueba.
  act(() => { interruptores(arbol)[0].props.onValueChange(false); });

  expect(interruptores(arbol)[0].props.value).toBe(false);
  // Envío parcial: mover el interruptor no reenvía precio ni capacidad, que es
  // como se pisan valores que se acaban de editar en otro sitio.
  expect(api.actualizarPlan).toHaveBeenCalledWith('p-1', { activo: false });

  await act(async () => responder({ ...TAPAS, activo: false }));
  expect(interruptores(arbol)[0].props.value).toBe(false);
});

test('si la API rechaza el cambio, el interruptor vuelve a donde estaba', async () => {
  const arbol = await montar();
  api.actualizarPlan.mockRejectedValue(new Error('No se pudo conectar'));

  await act(async () => interruptores(arbol)[0].props.onValueChange(false));

  // Lo importante: el plan sigue activo en pantalla, porque sigue activo en la
  // base. Un local que ve el switch apagado deja de contar con esos grupos.
  expect(interruptores(arbol)[0].props.value).toBe(true);
  expect(contenido(arbol)).toContain('No se pudo conectar');
});

test('no deja crear un plan sin categoría: sería un plan que nadie recibe', async () => {
  const arbol = await montar([]);
  await pulsar(botonConTexto(arbol, 'Crear plan'));
  await escribir(arbol, 'Nombre del plan', 'Cata a ciegas');

  await pulsar(botonConTexto(arbol, 'Guardar plan'));

  expect(api.crearPlan).not.toHaveBeenCalled();
  expect(contenido(arbol)).toContain('Elige una categoría');
});

test('crea el plan con la categoría elegida y lo suma a la lista', async () => {
  const arbol = await montar([]);
  api.crearPlan.mockResolvedValue({ ...TAPAS, id: 'p-2', titulo: 'Cata a ciegas' });

  await pulsar(botonConTexto(arbol, 'Crear plan'));
  await pulsar(botonConTexto(arbol, 'Gastronomía'));
  await escribir(arbol, 'Nombre del plan', 'Cata a ciegas');
  await escribir(arbol, 'Precio', '60000');
  await pulsar(botonConTexto(arbol, 'Guardar plan'));

  expect(api.crearPlan).toHaveBeenCalledWith(
    expect.objectContaining({
      interes_id: 'gastronomia',
      titulo: 'Cata a ciegas',
      precio: 60000,
      capacidad: 6,
      activo: true,
    }),
  );
  expect(contenido(arbol)).toContain('Cata a ciegas');
});

test('muestra tal cual el motivo que da la API al rechazar el plan', async () => {
  const arbol = await montar([]);
  const motivo =
    'La capacidad debe ser de al menos 6 personas: los grupos de Seis Más siempre llegan completos.';
  api.crearPlan.mockRejectedValue(new Error(motivo));

  await pulsar(botonConTexto(arbol, 'Crear plan'));
  await pulsar(botonConTexto(arbol, 'Gastronomía'));
  await escribir(arbol, 'Nombre del plan', 'Mesa para cuatro');
  await escribir(arbol, 'Capacidad', '4');
  await pulsar(botonConTexto(arbol, 'Guardar plan'));

  // El mensaje explica el porqué; traducirlo a "capacidad inválida" pierde
  // justo la parte que le dice al local cómo funciona Seis Más.
  expect(contenido(arbol)).toContain(motivo);
});

test('editar un plan manda solo el PUT y reemplaza la tarjeta', async () => {
  const arbol = await montar();
  api.actualizarPlan.mockResolvedValue({ ...TAPAS, precio: 52000 });

  await pulsar(botonConTexto(arbol, 'Editar'));
  await escribir(arbol, 'Precio', '52000');
  await pulsar(botonConTexto(arbol, 'Guardar cambios'));

  expect(api.actualizarPlan).toHaveBeenCalledWith('p-1', expect.objectContaining({ precio: 52000 }));
  expect(api.crearPlan).not.toHaveBeenCalled();
  const texto = contenido(arbol);
  expect(texto).toContain('52.000');
  // Una sola tarjeta: el plan editado reemplaza al viejo, no se duplica.
  expect(texto.match(/Noche de tapas/g)).toHaveLength(1);
});

test('eliminar pide confirmación y avisa de que los eventos ya asignados no se tocan', async () => {
  const arbol = await montar();
  api.eliminarPlan.mockResolvedValue(null);

  await pulsar(botonConTexto(arbol, 'Eliminar'));
  expect(contenido(arbol)).toContain('no se tocan');
  expect(api.eliminarPlan).not.toHaveBeenCalled();

  await pulsar(botonConTexto(arbol, 'Sí, eliminar'));
  expect(api.eliminarPlan).toHaveBeenCalledWith('p-1');
  expect(contenido(arbol)).not.toContain('Noche de tapas');
});
