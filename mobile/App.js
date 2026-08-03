// Punto de entrada de la app. No hay librería de navegación instalada
// todavía, así que el flujo se resuelve con estado local:
//
//   Bienvenida → Login → (Registrarse → Registro → Test → Grupos)
//                      → (Iniciar sesión → Grupos)
//
//   Registro → Bienvenida (botón "← Regresar" del encabezado)
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
  const [pantalla, setPantalla] = useState({ nombre: 'bienvenida' });

  if (pantalla.nombre === 'login') {
    return (
      <LoginScreen
        onLogin={(usuario) => setPantalla({ nombre: 'grupos', usuarioId: usuario.id })}
        onIrARegistro={() => setPantalla({ nombre: 'registro' })}
      />
    );
  }
  if (pantalla.nombre === 'registro') {
    return (
      <RegistroScreen
        onRegistrado={(usuario) => setPantalla({ nombre: 'test', usuarioId: usuario.id })}
        onVolver={() => setPantalla({ nombre: 'bienvenida' })}
      />
    );
  }
  if (pantalla.nombre === 'test') {
    return (
      <TestPersonalidadScreen
        route={{ params: { usuarioId: pantalla.usuarioId } }}
        onTerminado={() => setPantalla({ nombre: 'grupos', usuarioId: pantalla.usuarioId })}
      />
    );
  }
  if (pantalla.nombre === 'grupos') {
    return <GruposScreen route={{ params: { usuarioId: pantalla.usuarioId } }} />;
  }
  return <WelcomeAnimationScreen onFinish={() => setPantalla({ nombre: 'login' })} />;
}
