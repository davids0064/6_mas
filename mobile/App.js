// Punto de entrada de la app. No hay librería de navegación instalada
// todavía, así que el flujo se resuelve con estado local:
//
//   Bienvenida → Login → (Registrarse → Registro → Test → Grupos)
//                      → (Iniciar sesión → Grupos)
//
//   Registro → Bienvenida (botón "← Regresar" del encabezado)
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

export default function App() {
  const [pantalla, setPantalla] = useState('bienvenida');

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
  if (pantalla === 'grupos') {
    return <GruposScreen />;
  }
  return <WelcomeAnimationScreen onFinish={() => setPantalla('login')} />;
}
