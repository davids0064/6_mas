// Punto de entrada de la app. No hay librería de navegación instalada
// todavía, así que el flujo se resuelve con estado local:
//
//   Bienvenida → Login → (Registrarse → Registro → Test → Grupos)
//                      → (Iniciar sesión → Grupos)
//
//   Registro → Bienvenida (botón "← Regresar" del encabezado)
//   Grupos   ⇄ Valoración (al tocar "Valorar" en un plan que ya pasó)
//
// Las pantallas ya no se pasan el usuarioId entre sí: la sesión vive en
// src/services/sesion.js y el backend deriva de quién son los datos a partir
// del token. Por eso este componente solo lleva el nombre de la pantalla.
//
// Cuando se agregue react-navigation, este componente pasa a ser el stack
// navigator con estas mismas rutas.
import React, { useState } from 'react';
import WelcomeAnimationScreen from './src/screens/WelcomeAnimationScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegistroScreen from './src/screens/RegistroScreen';
import TestPersonalidadScreen from './src/screens/TestPersonalidadScreen';
import GruposScreen from './src/screens/GruposScreen';
import ValoracionScreen from './src/screens/ValoracionScreen';

export default function App() {
  const [pantalla, setPantalla] = useState('bienvenida');
  // El evento a valorar es el único dato que una pantalla le pasa a otra. No
  // se resuelve por id dentro de ValoracionScreen porque GruposScreen ya lo
  // tiene cargado: volver a pedirlo sería una consulta extra para mostrar un
  // título que ya está en memoria.
  const [eventoAValorar, setEventoAValorar] = useState(null);

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
  if (pantalla === 'grupos') {
    return (
      <GruposScreen
        onValorar={(evento) => {
          setEventoAValorar(evento);
          setPantalla('valoracion');
        }}
      />
    );
  }
  return <WelcomeAnimationScreen onFinish={() => setPantalla('login')} />;
}
