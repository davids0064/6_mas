// ============================================================================
// Aceptación de los términos.
//
//   cd mobile && npm test
//
// Existe por el rechazo de la guideline 1.2 de la build 1.0 (4). Apple lo pidió
// con estas palabras: el acuerdo tiene que presentarse "antes de registrarse o
// iniciar sesión". Lo que había era un enlace dentro de Cuenta, que para verlo
// exige estar ya dentro.
//
// Lo que se prueba es lo que un refactor puede romper sin que se note: que la
// pantalla diga en pantalla —no solo en el documento enlazado— que no hay
// tolerancia con el contenido objetable, que ofrezca los dos documentos, y que
// aceptar deje constancia y avance.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

import TerminosScreen from '../src/screens/TerminosScreen';
import { terminos } from '../src/services/terminos';

jest.mock('../src/services/terminos', () => ({
  terminos: { aceptar: jest.fn(), aceptados: jest.fn(), restaurar: jest.fn() },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

function texto(nodo) {
  if (nodo === null || nodo === undefined || typeof nodo === 'boolean') return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(texto).join(' ');
  if (nodo.props) return texto(nodo.props.children);
  return '';
}
const textoDe = (a) => a.root.findAllByType(Text).map((t) => texto(t.props.children)).join(' | ');
const botonCon = (a, frase) =>
  a.root.findAllByType(TouchableOpacity).find((b) => texto(b.props.children).includes(frase));

beforeEach(() => jest.clearAllMocks());

async function render(props = {}) {
  let arbol;
  await act(async () => {
    arbol = renderer.create(<TerminosScreen onAceptar={jest.fn()} {...props} />);
  });
  return arbol;
}

test('dice en pantalla que no hay tolerancia con el contenido objetable', async () => {
  // Apple exige que los términos lo dejen claro. Enlazar el documento no basta
  // para que un revisor lo vea sin salir de la app.
  const t = textoDe(await render());
  expect(t).toMatch(/no se tolera/i);
  expect(t).toMatch(/acoso|amenaza/i);
});

test('explica que se puede reportar y bloquear, y el plazo de revisión', async () => {
  const t = textoDe(await render());
  expect(t).toMatch(/reportar/i);
  expect(t).toMatch(/bloquear/i);
  expect(t).toMatch(/24 horas/i);
});

test('ofrece los dos documentos completos', async () => {
  const t = textoDe(await render());
  expect(t).toMatch(/términos de uso/i);
  expect(t).toMatch(/política de privacidad/i);
});

test('aceptar deja constancia y avanza', async () => {
  const onAceptar = jest.fn();
  const arbol = await render({ onAceptar });

  await act(async () => botonCon(arbol, 'Acepto').props.onPress());

  expect(terminos.aceptar).toHaveBeenCalled();
  expect(onAceptar).toHaveBeenCalled();
});

test('un doble toque no avanza dos veces', async () => {
  const onAceptar = jest.fn();
  const arbol = await render({ onAceptar });
  const boton = botonCon(arbol, 'Acepto');

  await act(async () => {
    boton.props.onPress();
    boton.props.onPress();
  });

  expect(onAceptar).toHaveBeenCalledTimes(1);
});

test('no hay ninguna forma de saltarse la pantalla', async () => {
  // Si algún día aparece un "Ahora no" o un "Saltar", esto falla. Sería un
  // rechazo por 1.2, y de los que se descubren tres días después de enviar.
  const t = textoDe(await render());
  expect(t).not.toMatch(/saltar|ahora no|más tarde|omitir/i);
});
