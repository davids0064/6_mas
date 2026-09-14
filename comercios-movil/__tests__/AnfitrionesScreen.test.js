// ============================================================================
// Anfitriones: quién recibe al grupo cuando llega.
//
//   cd comercios-movil && npm test
//
// Lo que se prueba es lo que la pantalla puede contar mal:
//
//   - el titular es exclusivo (índice único parcial en la base, y la API baja
//     al anterior en la misma transacción). Si la pantalla no replica ese
//     efecto, la lista muestra dos titulares hasta la próxima recarga;
//   - los opcionales viajan distinto en alta y en edición, porque la API
//     actualiza con COALESCE: un null en un PUT significa "no lo toques", así
//     que vaciar un teléfono exige mandar cadena vacía;
//   - el correo repetido lo detecta la base, no la app, y su mensaje tiene que
//     llegar a la pantalla.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import AnfitrionesScreen from '../src/screens/AnfitrionesScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    listarAnfitriones: jest.fn(),
    crearAnfitrion: jest.fn(),
    actualizarAnfitrion: jest.fn(),
    eliminarAnfitrion: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const MARCELA = {
  id: 'a-1',
  nombre: 'Marcela Ríos',
  email: 'marcela@ellocal.co',
  telefono: '3001234567',
  bio: 'Ocho años en la barra',
  titular: true,
};

const JULIÁN = {
  id: 'a-2',
  nombre: 'Julián Ospina',
  email: 'julian@ellocal.co',
  telefono: null,
  bio: null,
  titular: false,
};

async function montar(anfitriones = [MARCELA, JULIÁN]) {
  api.listarAnfitriones.mockResolvedValue(anfitriones);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<AnfitrionesScreen onVolver={() => {}} />);
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

test('marca quién es el titular', async () => {
  const texto = contenido(await montar());
  expect(texto).toContain('Marcela Ríos');
  expect(texto).toContain('TITULAR');
});

test('sin anfitriones explica que el grupo llega buscando a alguien', async () => {
  expect(contenido(await montar([]))).toContain('Todavía no dices quién recibe');
});

test('nombrar un titular nuevo le quita la insignia al anterior', async () => {
  const arbol = await montar();
  api.actualizarAnfitrion.mockResolvedValue({ ...JULIÁN, titular: true });

  await pulsar(botonConTexto(arbol, 'Hacer titular'));

  expect(api.actualizarAnfitrion).toHaveBeenCalledWith('a-2', { titular: true });
  // Solo una insignia en pantalla: la base no admite dos titulares, y la lista
  // tampoco debería enseñarlos.
  expect(contenido(arbol).match(/TITULAR/g)).toHaveLength(1);
  // Y el titular nuevo queda de primero, como los ordena la API.
  expect(contenido(arbol).indexOf('Julián')).toBeLessThan(contenido(arbol).indexOf('Marcela'));
});

test('el primer anfitrión se propone como titular', async () => {
  const arbol = await montar([]);
  api.crearAnfitrion.mockResolvedValue(MARCELA);

  await pulsar(botonConTexto(arbol, 'Agregar anfitrión'));
  await escribir(arbol, 'Nombre', 'Marcela Ríos');
  await escribir(arbol, 'Correo', 'marcela@ellocal.co');
  await pulsar(botonConTexto(arbol, 'Guardar anfitrión'));

  // Un comercio con un solo anfitrión y ningún titular es un estado que no
  // significa nada.
  expect(api.crearAnfitrion).toHaveBeenCalledWith(expect.objectContaining({ titular: true }));
});

test('no manda un correo sin forma de correo', async () => {
  const arbol = await montar([]);

  await pulsar(botonConTexto(arbol, 'Agregar anfitrión'));
  await escribir(arbol, 'Nombre', 'Marcela Ríos');
  await escribir(arbol, 'Correo', 'marcela-arroba-ellocal');
  await pulsar(botonConTexto(arbol, 'Guardar anfitrión'));

  expect(api.crearAnfitrion).not.toHaveBeenCalled();
  expect(contenido(arbol)).toContain('Escribe un correo válido');
});

test('en el alta los campos vacíos van como null, no como texto en blanco', async () => {
  const arbol = await montar([]);
  api.crearAnfitrion.mockResolvedValue(JULIÁN);

  await pulsar(botonConTexto(arbol, 'Agregar anfitrión'));
  await escribir(arbol, 'Nombre', 'Julián Ospina');
  await escribir(arbol, 'Correo', 'JULIAN@ELLOCAL.CO');
  await pulsar(botonConTexto(arbol, 'Guardar anfitrión'));

  expect(api.crearAnfitrion).toHaveBeenCalledWith(
    expect.objectContaining({
      // El correo se normaliza igual que en el servidor, para que lo que se ve
      // en pantalla sea lo que quedó guardado.
      email: 'julian@ellocal.co',
      telefono: null,
      bio: null,
    }),
  );
});

test('al editar, vaciar el teléfono manda cadena vacía para poder borrarlo', async () => {
  const arbol = await montar();
  api.actualizarAnfitrion.mockResolvedValue({ ...MARCELA, telefono: null });

  await pulsar(botonConTexto(arbol, 'Editar'));
  await escribir(arbol, 'Teléfono', '');
  await pulsar(botonConTexto(arbol, 'Guardar cambios'));

  // Con null la API haría COALESCE(null, telefono) y lo dejaría intacto: el
  // teléfono viejo seguiría ahí y nadie sabría por qué.
  expect(api.actualizarAnfitrion).toHaveBeenCalledWith('a-1', expect.objectContaining({ telefono: '' }));
});

test('muestra el motivo cuando el correo ya está registrado', async () => {
  const arbol = await montar([]);
  const motivo = 'Ya hay un anfitrión registrado con ese correo.';
  api.crearAnfitrion.mockRejectedValue(new Error(motivo));

  await pulsar(botonConTexto(arbol, 'Agregar anfitrión'));
  await escribir(arbol, 'Nombre', 'Otra persona');
  await escribir(arbol, 'Correo', 'marcela@ellocal.co');
  await pulsar(botonConTexto(arbol, 'Guardar anfitrión'));

  expect(contenido(arbol)).toContain(motivo);
});

test('quitar avisa de que los eventos ya atendidos conservan el nombre', async () => {
  const arbol = await montar();
  api.eliminarAnfitrion.mockResolvedValue(null);

  await pulsar(botonConTexto(arbol, 'Quitar'));
  expect(contenido(arbol)).toContain('siguen mostrando su nombre');
  expect(api.eliminarAnfitrion).not.toHaveBeenCalled();

  await pulsar(botonConTexto(arbol, 'Sí, quitar'));
  expect(api.eliminarAnfitrion).toHaveBeenCalledWith('a-1');
  expect(contenido(arbol)).not.toContain('Marcela Ríos');
});
