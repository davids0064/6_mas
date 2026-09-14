// Punto de entrada de la app de comercios de Seis Más.
//
// Igual que en la app de usuarios, no hay librería de navegación: el flujo se
// resuelve con estado local. Son trece pantallas con un solo nivel de
// profundidad, y react-navigation traería tres dependencias nativas para
// resolver algo que aquí cabe en un switch.
//
//   Login ⇄ Registro
//   Login/Registro → Resumen
//   Resumen ⇄ Eventos ⇄ Detalle de evento
//   Resumen ⇄ Planes
//   Resumen ⇄ Disponibilidad
//   Resumen ⇄ Anfitriones
//   Resumen ⇄ Bienvenida (propuestas)
//   Resumen ⇄ Menús ⇄ Editor de un menú
//   Resumen ⇄ Mi comercio
//   Resumen ⇄ Cuenta → (cerrar sesión / baja) → Login
//
// La sesión se restaura del disco al arrancar, así que un local que ya entró
// una vez abre la app directamente en su resumen.
//
// Cuando se agregue react-navigation, este componente pasa a ser el stack
// navigator con estas mismas rutas.
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import RegistroScreen from './src/screens/RegistroScreen';
import ResumenScreen from './src/screens/ResumenScreen';
import EventosScreen from './src/screens/EventosScreen';
import EventoDetalleScreen from './src/screens/EventoDetalleScreen';
import PlanesScreen from './src/screens/PlanesScreen';
import DisponibilidadScreen from './src/screens/DisponibilidadScreen';
import AnfitrionesScreen from './src/screens/AnfitrionesScreen';
import PropuestasScreen from './src/screens/PropuestasScreen';
import MenusScreen from './src/screens/MenusScreen';
import MenuEditorScreen from './src/screens/MenuEditorScreen';
import MiComercioScreen from './src/screens/MiComercioScreen';
import CuentaScreen from './src/screens/CuentaScreen';
import { sesion } from './src/services/sesion';
import { COLORES } from './src/theme/tokens';

export default function App() {
  // `null` mientras se lee el disco. A diferencia de la app de usuarios, aquí
  // sí hace falta un estado y no una ref: no hay animación de bienvenida
  // detrás de la que esconder la espera, así que la pantalla tiene que
  // esperar a saber si hay sesión antes de decidir qué pinta. Es un parpadeo
  // de milisegundos, pero mandar al login a alguien que ya tenía sesión y
  // corregirlo medio segundo después se ve mal.
  const [pantalla, setPantalla] = useState(null);

  // El evento que se está mirando en el detalle. Se pasa entero y no por id
  // porque la lista ya lo tiene cargado: volver a pedirlo sería una consulta
  // extra para pintar un título que ya está en memoria. El detalle igualmente
  // recarga en segundo plano.
  const [eventoElegido, setEventoElegido] = useState(null);

  // El menú abierto en el editor. Igual que con el evento, se pasa entero: la
  // lista ya tiene su nombre y su estado, y el editor pide aparte el árbol de
  // secciones e ítems, que es lo único que le falta.
  const [menuElegido, setMenuElegido] = useState(null);

  useEffect(() => {
    sesion.restaurar().then((haySesion) => setPantalla(haySesion ? 'resumen' : 'login'));
  }, []);

  const irAResumen = () => setPantalla('resumen');

  if (pantalla === null) {
    return (
      <View style={styles.cargando}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator color={COLORES.rojoMarca} />
      </View>
    );
  }

  if (pantalla === 'login') {
    return <LoginScreen onEntrar={irAResumen} onIrARegistro={() => setPantalla('registro')} />;
  }
  if (pantalla === 'registro') {
    return <RegistroScreen onRegistrado={irAResumen} onVolver={() => setPantalla('login')} />;
  }
  if (pantalla === 'eventos') {
    return (
      <EventosScreen
        onVerEvento={(evento) => {
          setEventoElegido(evento);
          setPantalla('evento');
        }}
        onVolver={irAResumen}
      />
    );
  }
  if (pantalla === 'evento' && eventoElegido) {
    return (
      <EventoDetalleScreen
        evento={eventoElegido}
        // Se vuelve a la lista y se limpia el evento: al volver, EventosScreen
        // se monta de nuevo y recarga, así que un cambio de estado hecho en el
        // detalle se ve reflejado sin tener que propagarlo a mano.
        onVolver={() => {
          setEventoElegido(null);
          setPantalla('eventos');
        }}
      />
    );
  }
  if (pantalla === 'planes') {
    return <PlanesScreen onVolver={irAResumen} />;
  }
  if (pantalla === 'disponibilidad') {
    return <DisponibilidadScreen onVolver={irAResumen} />;
  }
  if (pantalla === 'anfitriones') {
    return <AnfitrionesScreen onVolver={irAResumen} />;
  }
  if (pantalla === 'propuestas') {
    return <PropuestasScreen onVolver={irAResumen} />;
  }
  if (pantalla === 'menus') {
    return (
      <MenusScreen
        onAbrirMenu={(menu) => {
          setMenuElegido(menu);
          setPantalla('menu');
        }}
        onVolver={irAResumen}
      />
    );
  }
  if (pantalla === 'menu' && menuElegido) {
    return (
      <MenuEditorScreen
        menu={menuElegido}
        // Al volver, MenusScreen se monta de nuevo y recarga: los conteos de
        // secciones y platos salen actualizados sin propagar nada a mano.
        onVolver={() => {
          setMenuElegido(null);
          setPantalla('menus');
        }}
      />
    );
  }
  if (pantalla === 'mi-comercio') {
    return <MiComercioScreen onVolver={irAResumen} />;
  }
  if (pantalla === 'cuenta') {
    return (
      <CuentaScreen
        onVolver={irAResumen}
        // Cerrar sesión y dar de baja acaban en el mismo sitio: el login, con
        // la sesión ya limpia.
        onSesionCerrada={() => setPantalla('login')}
      />
    );
  }

  return (
    <ResumenScreen
      onVerEvento={(evento) => {
        setEventoElegido(evento);
        setPantalla('evento');
      }}
      onIrA={setPantalla}
      onCuenta={() => setPantalla('cuenta')}
    />
  );
}

const styles = StyleSheet.create({
  cargando: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
