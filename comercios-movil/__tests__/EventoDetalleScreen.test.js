// ============================================================================
// Detalle del evento: quién viene y en qué estado está.
//
//   cd comercios-movil && npm test
//
// Dos cosas que importan de verdad se prueban aquí:
//
//   1. Que la pantalla NO muestre nada de las personas más allá del nombre de
//      pila y los intereses. La garantía real es de la base (el rol de la API
//      no tiene permiso sobre `usuarios`), pero si alguien añadiera un campo a
//      la vista, esta prueba es la que avisa de que la pantalla lo pintaría.
//   2. Que "sin grupo asignado" se trate como un estado normal y no como un
//      error o una lista vacía: un evento existe antes de que el matching le
//      asigne gente, y un local que ve un hueco cree que algo se rompió.
// ============================================================================

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import EventoDetalleScreen from '../src/screens/EventoDetalleScreen';
import { api } from '../src/services/api';
import { botonConTexto, contenido, pulsar } from './ayuda-render';

jest.mock('../src/services/api', () => ({
  api: {
    obtenerEvento: jest.fn(),
    obtenerAsistentes: jest.fn(),
    cambiarEstadoEvento: jest.fn(),
    cancelarEvento: jest.fn(),
  },
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const EVENTO = {
  id: 'e-1',
  titulo: 'Noche de tapas',
  descripcion: 'Mesa para seis con tabla de la casa',
  // El formato tal cual lo devuelve la API PHP, con espacio y desfase de dos
  // dígitos: si la pantalla dejara de normalizarlo, aquí saldría vacío.
  fecha_hora: '2026-09-04 20:00:00-05',
  capacidad: 6,
  precio: 45000,
  estado: 'propuesto',
  grupo_id: 'g-1',
  anfitrion_nombre: 'Marcela Ríos',
};

async function montar(
  evento = EVENTO,
  asistentes = { grupo_asignado: true, asistentes: [] },
  onVolver = () => {},
) {
  api.obtenerEvento.mockResolvedValue(evento);
  api.obtenerAsistentes.mockResolvedValue(asistentes);
  let arbol;
  await act(async () => {
    arbol = renderer.create(<EventoDetalleScreen evento={evento} onVolver={onVolver} />);
  });
  return arbol;
}

beforeEach(() => jest.clearAllMocks());

test('muestra cuándo, cuánta gente, cuánto y quién recibe', async () => {
  const arbol = await montar();
  const texto = contenido(arbol);
  expect(texto).toContain('viernes 4 de septiembre');
  expect(texto).toContain('6 personas');
  expect(texto).toContain('45.000');
  expect(texto).toContain('Marcela Ríos');
});

test('lista a los asistentes con nombre de pila e intereses', async () => {
  const arbol = await montar(EVENTO, {
    grupo_asignado: true,
    asistentes: [
      { nombre_pila: 'Ana', intereses: ['Gastronomía', 'Música'] },
      { nombre_pila: 'Luis', intereses: [] },
    ],
  });
  const texto = contenido(arbol);
  expect(texto).toContain('Ana');
  expect(texto).toContain('Gastronomía');
  expect(texto).toContain('Luis');
});

test('no pinta ningún dato de contacto de los asistentes', async () => {
  // Se le pasa a la pantalla más de lo que la API puede devolver, justamente
  // para comprobar que no lo enseñaría: la frontera de datos no depende de que
  // el cliente se porte bien, pero el cliente tampoco debe empeorarla.
  const arbol = await montar(EVENTO, {
    grupo_asignado: true,
    asistentes: [
      {
        nombre_pila: 'Ana',
        intereses: ['Música'],
        email: 'ana@ejemplo.test',
        telefono: '3001234567',
        apellido: 'Ruiz',
      },
    ],
  });
  const texto = contenido(arbol);
  expect(texto).toContain('Ana');
  expect(texto).not.toContain('ana@ejemplo.test');
  expect(texto).not.toContain('3001234567');
  expect(texto).not.toContain('Ruiz');
});

test('sin grupo asignado explica la espera en vez de mostrar una lista vacía', async () => {
  const arbol = await montar({ ...EVENTO, grupo_id: null }, {
    grupo_asignado: false,
    asistentes: [],
  });
  expect(contenido(arbol)).toContain('Todavía no hay grupo asignado');
});

describe('cambio de estado', () => {
  test('un evento sin confirmar ofrece confirmarlo', async () => {
    api.cambiarEstadoEvento.mockResolvedValue({ ...EVENTO, estado: 'confirmado' });
    const arbol = await montar();

    await pulsar(botonConTexto(arbol, 'Confirmar este grupo'));

    expect(api.cambiarEstadoEvento).toHaveBeenCalledWith('e-1', 'confirmado');
    // La pantalla se repinta con lo que devolvió la API, no con una suposición.
    expect(contenido(arbol)).toContain('Marcar que ya llegaron');
  });

  test('la cadena avanza confirmado → en curso → finalizado', async () => {
    api.cambiarEstadoEvento.mockResolvedValue({ ...EVENTO, estado: 'finalizado' });
    const arbol = await montar({ ...EVENTO, estado: 'en_curso' });

    await pulsar(botonConTexto(arbol, 'Cerrar el evento'));

    expect(api.cambiarEstadoEvento).toHaveBeenCalledWith('e-1', 'finalizado');
  });

  test('un evento finalizado no ofrece ningún cambio', async () => {
    const arbol = await montar({ ...EVENTO, estado: 'finalizado' });
    expect(contenido(arbol)).not.toContain('Confirmar este grupo');
    expect(contenido(arbol)).not.toContain('Cerrar el evento');
  });

  // Cancelar estuvo fuera de la app mientras existió el panel web: deja a seis
  // personas sin plan y no debía caber en un toque accidental mientras se
  // atiende una mesa. Al retirarse el panel, dejarla fuera no la volvía
  // imposible sino inalcanzable, así que ahora está — y lo que se prueba es
  // que el toque accidental sigue sin bastar.
  test('cancelar no llama a la API con un solo toque', async () => {
    const arbol = await montar();

    await pulsar(botonConTexto(arbol, 'Cancelar el evento'));

    expect(api.cancelarEvento).not.toHaveBeenCalled();
    // Y antes de confirmar se dice a cuántas personas afecta.
    expect(contenido(arbol)).toContain('6 personas que ya lo tienen agendado');
  });

  test('al confirmar, cancela y vuelve a la lista', async () => {
    api.cancelarEvento.mockResolvedValue(null);
    const onVolver = jest.fn();
    const arbol = await montar(EVENTO, { grupo_asignado: true, asistentes: [] }, onVolver);

    await pulsar(botonConTexto(arbol, 'Cancelar el evento'));
    await pulsar(botonConTexto(arbol, 'Sí, cancelar el evento'));

    expect(api.cancelarEvento).toHaveBeenCalledWith('e-1');
    // Quedarse en el detalle de un evento cancelado no deja nada que hacer.
    expect(onVolver).toHaveBeenCalled();
  });

  test('un evento finalizado ya no se puede cancelar', async () => {
    const arbol = await montar({ ...EVENTO, estado: 'finalizado' });
    expect(contenido(arbol)).not.toContain('Cancelar el evento');
  });

  test('si el cambio falla, lo dice y no miente sobre el estado', async () => {
    api.cambiarEstadoEvento.mockRejectedValue(new Error('Error HTTP 409'));
    const arbol = await montar();

    await pulsar(botonConTexto(arbol, 'Confirmar este grupo'));

    expect(contenido(arbol)).toContain('Error HTTP 409');
    expect(contenido(arbol)).toContain('Confirmar este grupo');
  });
});
