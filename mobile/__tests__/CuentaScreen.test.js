// ============================================================================
// Pantalla de cuenta: cerrar sesión y eliminar cuenta.
//
//   cd mobile && npm test
//
// Esta suite existe por una razón concreta y no por completitud: la guideline
// 5.1.1(v) de la App Store exige que el borrado de cuenta se pueda hacer desde
// dentro de la app. Es un requisito que se cumple o no se publica, así que
// conviene que un cambio futuro que lo rompa falle aquí y no en la revisión de
// Apple, tres días después de subir la build.
//
// Se prueban las dos propiedades que importan: que el borrado esté detrás de
// una confirmación (no se dispara al primer toque) y que al confirmar llame de
// verdad al backend y saque al usuario de la sesión.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Linking, TouchableOpacity } from 'react-native';

import CuentaScreen from '../src/screens/CuentaScreen';
import { api } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  api: {
    obtenerMiPerfil: jest.fn(),
    eliminarMiCuenta: jest.fn(),
    cerrarSesion: jest.fn(),
  },
}));

// Reanimated no corre en el entorno de pruebas: se sustituye por vistas planas.
// Lo que se está probando es la lógica del flujo, no la animación de entrada.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View }, FadeInDown: { delay: () => ({ duration: () => ({}) }), duration: () => ({}) } };
});
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const PERFIL = { nombre: 'Ana Ruiz', email: 'ana@ejemplo.test' };

// Todo el texto que cuelga de un nodo, concatenado. El texto de un botón vive
// dentro de un <Text> hijo, no en las props del pulsable, así que hay que bajar
// por el árbol renderizado para encontrarlo.
function textoDe(nodo) {
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (!nodo || !nodo.children) return '';
  return nodo.children.map(textoDe).join(' ');
}

// Busca un elemento pulsable por el texto que muestra. Se apoya en lo que la
// persona ve y no en testIDs: es lo mismo que mira quien revisa la app.
//
// El filtro NO se restringe a nodos host: TouchableOpacity conserva `onPress`
// en el componente y le entrega a la View de abajo los manejadores del sistema
// de responder, así que buscar solo entre nodos host no encuentra ni un botón.
function botonConTexto(arbol, texto) {
  const boton = arbol.root
    .findAll((n) => n.props && typeof n.props.onPress === 'function')
    .find((n) => textoDe(n).includes(texto));
  if (!boton) throw new Error(`No hay ningún botón que diga "${texto}"`);
  return boton;
}

function textos(arbol) {
  return JSON.stringify(arbol.toJSON());
}

async function montar(props = {}) {
  api.obtenerMiPerfil.mockResolvedValue(PERFIL);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<CuentaScreen onVolver={() => {}} onSesionCerrada={() => {}} {...props} />);
  });
  return arbol;
}

beforeEach(() => jest.clearAllMocks());

test('muestra el perfil y ofrece las dos salidas de la cuenta', async () => {
  const arbol = await montar();
  const contenido = textos(arbol);
  expect(contenido).toContain('Ana Ruiz');
  expect(contenido).toContain('ana@ejemplo.test');
  expect(contenido).toContain('Cerrar sesión');
  expect(contenido).toContain('Eliminar mi cuenta');
});

test('el primer toque en eliminar NO borra: pide confirmación', async () => {
  const arbol = await montar();

  await act(async () => {
    botonConTexto(arbol, 'Eliminar mi cuenta').props.onPress();
  });

  // Lo importante: no se llamó al backend.
  expect(api.eliminarMiCuenta).not.toHaveBeenCalled();
  // Y se explica qué se pierde, que es lo que la guideline pide que quede claro.
  expect(textos(arbol)).toContain('No se puede deshacer');
});

test('al confirmar, borra la cuenta y saca al usuario de la sesión', async () => {
  const onSesionCerrada = jest.fn();
  api.eliminarMiCuenta.mockResolvedValue(undefined);
  const arbol = await montar({ onSesionCerrada });

  await act(async () => {
    botonConTexto(arbol, 'Eliminar mi cuenta').props.onPress();
  });
  await act(async () => {
    botonConTexto(arbol, 'Sí, eliminar mi cuenta').props.onPress();
  });

  expect(api.eliminarMiCuenta).toHaveBeenCalledTimes(1);
  expect(onSesionCerrada).toHaveBeenCalledTimes(1);
});

test('se puede echar atrás desde la confirmación', async () => {
  const arbol = await montar();

  await act(async () => {
    botonConTexto(arbol, 'Eliminar mi cuenta').props.onPress();
  });
  await act(async () => {
    botonConTexto(arbol, 'Mejor no, conservar mi cuenta').props.onPress();
  });

  expect(api.eliminarMiCuenta).not.toHaveBeenCalled();
  expect(textos(arbol)).not.toContain('No se puede deshacer');
});

test('si falla el borrado, lo dice y no saca al usuario', async () => {
  const onSesionCerrada = jest.fn();
  api.eliminarMiCuenta.mockRejectedValue(new Error('Error HTTP 500'));
  const arbol = await montar({ onSesionCerrada });

  await act(async () => {
    botonConTexto(arbol, 'Eliminar mi cuenta').props.onPress();
  });
  await act(async () => {
    botonConTexto(arbol, 'Sí, eliminar mi cuenta').props.onPress();
  });

  expect(onSesionCerrada).not.toHaveBeenCalled();
  expect(textos(arbol)).toContain('Error HTTP 500');
});

test('cerrar sesión limpia la sesión sin borrar la cuenta', async () => {
  const onSesionCerrada = jest.fn();
  const arbol = await montar({ onSesionCerrada });

  await act(async () => {
    botonConTexto(arbol, 'Cerrar sesión').props.onPress();
  });

  expect(api.cerrarSesion).toHaveBeenCalledTimes(1);
  expect(api.eliminarMiCuenta).not.toHaveBeenCalled();
  expect(onSesionCerrada).toHaveBeenCalledTimes(1);
});


// --- Contacto (punto 6 de los ajustes) -------------------------------------
//
// Quien entra a esta pantalla suele venir con una duda o un problema, no a
// releer los términos. Lo que se prueba es que las vías existan y que una vía
// sin configurar NO se pinte: un enlace de WhatsApp sin número abre una
// pantalla de error de la propia app de WhatsApp, que es peor que no ofrecerlo.

test('ofrece las tres vías de contacto y las preguntas frecuentes', async () => {
  api.obtenerMiPerfil.mockResolvedValue(PERFIL);
  const t = textos(await montar());
  expect(t).toContain('WhatsApp');
  expect(t).toContain('holaseismas@pulsodigital.co');
  expect(t).toContain('somos6mas');
  expect(t).toContain('Preguntas frecuentes');
});

test('solo se pinta lo que está configurado', async () => {
  // Las vías se leen de config/env.js y se pintan solo si tienen valor: un
  // enlace de WhatsApp sin número abre una pantalla de error de la propia app
  // de WhatsApp, y es peor que no ofrecer la opción.
  //
  // Se comprueba contra la configuración real en vez de sustituir el módulo:
  // volver a requerir la pantalla con jest.resetModules() le da otra copia de
  // React y revienta con "Cannot read properties of null (reading 'useState')".
  // Así, además, la prueba sigue valiendo el día que se añada o se quite una vía.
  const env = require('../src/config/env');
  api.obtenerMiPerfil.mockResolvedValue(PERFIL);
  const t = textos(await montar());

  for (const [valor, marca] of [
    [env.WHATSAPP, 'WhatsApp'],
    [env.EMAIL_CONTACTO, env.EMAIL_CONTACTO],
    [env.INSTAGRAM, 'somos6mas'],
  ]) {
    if (valor) expect(t).toContain(marca);
    else expect(t).not.toContain(marca);
  }
});

test('los enlaces de contacto abren lo que deben', async () => {
  api.obtenerMiPerfil.mockResolvedValue(PERFIL);
  const abiertos = [];
  jest.spyOn(Linking, 'openURL').mockImplementation((u) => {
    abiertos.push(u);
    return Promise.resolve();
  });
  const arbol = await montar();

  for (const frase of ['WhatsApp', 'holaseismas@pulsodigital.co', 'somos6mas', 'Preguntas frecuentes']) {
    await act(async () => botonConTexto(arbol, frase).props.onPress());
  }

  expect(abiertos[0]).toBe('https://wa.me/573004412005');
  expect(abiertos[1]).toBe('mailto:holaseismas@pulsodigital.co');
  expect(abiertos[2]).toBe('https://www.instagram.com/somos6mas/');
  expect(abiertos[3]).toMatch(/\/soporte$/);
  Linking.openURL.mockRestore();
});
