// Punto de entrada de la app. No hay librería de navegación instalada
// todavía, así que el flujo se resuelve con estado local:
//
//   Bienvenida → Login → (Registrarse → Registro → Test → Grupos)
//                      → (Iniciar sesión → Grupos)
//
//   Registro → Bienvenida (botón "← Regresar" del encabezado)
//   Grupos   ⇄ Valoración (al tocar "Valorar" en un plan que ya pasó)
//   Grupos   ⇄ Cuenta     (botón "Cuenta" del encabezado)
//
// Cuenta es la salida del flujo: cerrar sesión y eliminar cuenta devuelven al
// login con la sesión limpia. La App Store exige (guideline 5.1.1(v)) que el
// borrado de cuenta se pueda hacer dentro de la app, así que esta ruta no es
// opcional.
//
// Las pantallas ya no se pasan el usuarioId entre sí: la sesión vive en
// src/services/sesion.js y el backend deriva de quién son los datos a partir
// del token. Por eso este componente solo lleva el nombre de la pantalla.
//
// La sesión ahora persiste en disco, así que la bienvenida tiene dos salidas:
// si al arrancar había un token guardado se va directo a Grupos, y si no, al
// login. La lectura del disco ocurre mientras la animación corre, que dura de
// sobra: cuando termina, la respuesta ya está.
//
// Cuando se agregue react-navigation, este componente pasa a ser el stack
// navigator con estas mismas rutas.
import React, { useEffect, useRef, useState } from 'react';
import WelcomeAnimationScreen from './src/screens/WelcomeAnimationScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegistroScreen from './src/screens/RegistroScreen';
import TestPersonalidadScreen from './src/screens/TestPersonalidadScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import LocalScreen from './src/screens/LocalScreen';
import ChatScreen from './src/screens/ChatScreen';
import GruposScreen from './src/screens/GruposScreen';
import ValoracionScreen from './src/screens/ValoracionScreen';
import CuentaScreen from './src/screens/CuentaScreen';
import { sesion } from './src/services/sesion';

export default function App() {
  const [pantalla, setPantalla] = useState('bienvenida');
  // El evento a valorar es el único dato que una pantalla le pasa a otra. No
  // se resuelve por id dentro de ValoracionScreen porque GruposScreen ya lo
  // tiene cargado: volver a pedirlo sería una consulta extra para mostrar un
  // título que ya está en memoria.
  const [eventoAValorar, setEventoAValorar] = useState(null);

  // El evento cuyo local se está mirando. Se guarda entero y no solo el id
  // porque LocalScreen lo recibe ya cargado desde Grupos; pedirlo otra vez
  // sería una consulta de más para datos que ya están en memoria.
  const [eventoDelLocal, setEventoDelLocal] = useState(null);

  // Va en una ref y no en estado a propósito: nadie se pinta distinto según
  // este valor, solo lo consulta `onFinish` de la animación en el instante en
  // que se dispara. Con estado, provocaría un render de más sin cambiar nada
  // en pantalla.
  const haySesion = useRef(false);

  useEffect(() => {
    sesion.restaurar().then((existe) => {
      haySesion.current = existe;
    });
  }, []);

  if (pantalla === 'login') {
    return (
      <LoginScreen
        onLogin={() => setPantalla('grupos')}
        onIrARegistro={() => setPantalla('registro')}
      />
    );
  }
  if (pantalla === 'registro') {
    return (
      <RegistroScreen
        onRegistrado={() => setPantalla('test')}
        onVolver={() => setPantalla('bienvenida')}
      />
    );
  }
  if (pantalla === 'test') {
    return <TestPersonalidadScreen onTerminado={() => setPantalla('grupos')} />;
  }
  if (pantalla === 'valoracion' && eventoAValorar) {
    return (
      <ValoracionScreen
        evento={eventoAValorar}
        // Las dos salidas vuelven a Grupos y limpian el evento: al volver,
        // GruposScreen se monta de nuevo y recarga, así que el aviso de
        // "valorar" desaparece solo si la valoración se envió.
        onListo={() => {
          setEventoAValorar(null);
          setPantalla('grupos');
        }}
        onVolver={() => {
          setEventoAValorar(null);
          setPantalla('grupos');
        }}
      />
    );
  }
  if (pantalla === 'cuenta') {
    return (
      <CuentaScreen
        onVolver={() => setPantalla('grupos')}
        // Cerrar sesión y eliminar cuenta acaban en el mismo sitio: el login
        // con la sesión ya limpia. No se vuelve a la bienvenida porque su
        // animación es una presentación de la marca, y quien acaba de salir
        // de su cuenta no necesita que se la vuelvan a presentar.
        onSesionCerrada={() => setPantalla('login')}
      />
    );
  }
  if (pantalla === 'perfil') {
    return (
      <PerfilScreen
        onVolver={() => setPantalla('grupos')}
        // Rehacer el test manda a la misma pantalla del registro: al terminar,
        // el backend marca el anterior como no vigente y calcula el perfil
        // nuevo, así que volver a Grupos ya muestra el resultado actualizado.
        onRehacerTest={() => setPantalla('test')}
      />
    );
  }
  if (pantalla === 'local' && eventoDelLocal) {
    return (
      <LocalScreen
        evento={eventoDelLocal}
        onVolver={() => {
          setEventoDelLocal(null);
          setPantalla('grupos');
        }}
      />
    );
  }
  if (pantalla === 'chat') {
    return <ChatScreen onVolver={() => setPantalla('grupos')} />;
  }
  if (pantalla === 'grupos') {
    return (
      <GruposScreen
        onValorar={(evento) => {
          setEventoAValorar(evento);
          setPantalla('valoracion');
        }}
        onCuenta={() => setPantalla('cuenta')}
        onVerPerfil={() => setPantalla('perfil')}
        onAbrirChat={() => setPantalla('chat')}
        onVerLocal={(evento) => {
          setEventoDelLocal(evento);
          setPantalla('local');
        }}
      />
    );
  }
  // La animación no espera a que se lea el disco: si por lo que sea todavía no
  // terminó cuando acaba, se va al login. Entrar de más es un login extra;
  // quedarse esperando en la bienvenida sería la app colgada.
  return (
    <WelcomeAnimationScreen
      onFinish={() => setPantalla(haySesion.current ? 'grupos' : 'login')}
    />
  );
}
