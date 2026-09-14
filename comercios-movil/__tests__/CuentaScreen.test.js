// ============================================================================
// Cuenta del comercio: cerrar sesión y dar de baja el local.
//
//   cd comercios-movil && npm test
//
// Igual que en la app de usuarios, esta suite existe por un requisito que se
// cumple o no se publica: la guideline 5.1.1(v) de la App Store exige que el
// borrado de cuenta se pueda hacer desde dentro de la app. Conviene que un
// cambio futuro que lo rompa falle aquí y no en la revisión de Apple.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import CuentaScreen from '../src/screens/CuentaScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    obtenerMiComercio: jest.fn(),
    eliminarMiComercio: jest.fn(),
    cerrarSesion: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const COMERCIO = { nombre: 'Café de la Esquina', email: 'hola@cafe.test' };

async function montar(props = {}) {
  api.obtenerMiComercio.mockResolvedValue(COMERCIO);
  let arbol;
  await act(async () => {
    arbol = renderer.create(
      <CuentaScreen onVolver={() => {}} onSesionCerrada={() => {}} {...props} />,
    );
  });
  return arbol;
}

beforeEach(() => jest.clearAllMocks());

test('muestra el local y ofrece las dos salidas de la cuenta', async () => {
  const arbol = await montar();
  expect(contenido(arbol)).toContain('Café de la Esquina');
  expect(contenido(arbol)).toContain('hola@cafe.test');
  expect(contenido(arbol)).toContain('Cerrar sesión');
  expect(contenido(arbol)).toContain('Dar de baja mi local');
});

test('el primer toque en dar de baja NO borra: pide confirmación', async () => {
  const arbol = await montar();
  await pulsar(botonConTexto(arbol, 'Dar de baja mi local'));

  expect(api.eliminarMiComercio).not.toHaveBeenCalled();
  // Y se explica qué pasa con el histórico, que es lo que un local necesita
  // saber antes de tocar el botón.
  expect(contenido(arbol)).toContain('Los eventos que ya ocurrieron se conservan');
});

test('al confirmar, da de baja el local y saca al usuario de la sesión', async () => {
  const onSesionCerrada = jest.fn();
  api.eliminarMiComercio.mockResolvedValue(undefined);
  const arbol = await montar({ onSesionCerrada });

  await pulsar(botonConTexto(arbol, 'Dar de baja mi local'));
  await pulsar(botonConTexto(arbol, 'Sí, dar de baja mi local'));

  expect(api.eliminarMiComercio).toHaveBeenCalledTimes(1);
  expect(onSesionCerrada).toHaveBeenCalledTimes(1);
});

test('se puede echar atrás desde la confirmación', async () => {
  const arbol = await montar();
  await pulsar(botonConTexto(arbol, 'Dar de baja mi local'));
  await pulsar(botonConTexto(arbol, 'Mejor no, conservar mi local'));

  expect(api.eliminarMiComercio).not.toHaveBeenCalled();
  expect(contenido(arbol)).not.toContain('Los eventos que ya ocurrieron se conservan');
});

test('si falla la baja, lo dice y no saca al usuario', async () => {
  const onSesionCerrada = jest.fn();
  api.eliminarMiComercio.mockRejectedValue(new Error('Error HTTP 500'));
  const arbol = await montar({ onSesionCerrada });

  await pulsar(botonConTexto(arbol, 'Dar de baja mi local'));
  await pulsar(botonConTexto(arbol, 'Sí, dar de baja mi local'));

  expect(onSesionCerrada).not.toHaveBeenCalled();
  expect(contenido(arbol)).toContain('Error HTTP 500');
});

test('cerrar sesión limpia la sesión sin dar de baja el local', async () => {
  const onSesionCerrada = jest.fn();
  const arbol = await montar({ onSesionCerrada });

  await pulsar(botonConTexto(arbol, 'Cerrar sesión'));

  expect(api.cerrarSesion).toHaveBeenCalledTimes(1);
  expect(api.eliminarMiComercio).not.toHaveBeenCalled();
  expect(onSesionCerrada).toHaveBeenCalledTimes(1);
});

test('las salidas siguen disponibles aunque no se pueda cargar el perfil', async () => {
  // Es justo el caso en que más falta hacen: si la API está caída, cerrar
  // sesión no puede depender de que responda.
  api.obtenerMiComercio.mockRejectedValue(new Error('Error HTTP 503'));
  let arbol;
  await act(async () => {
    arbol = renderer.create(<CuentaScreen onVolver={() => {}} onSesionCerrada={() => {}} />);
  });

  expect(contenido(arbol)).toContain('Cerrar sesión');
  expect(contenido(arbol)).toContain('Dar de baja mi local');
});
