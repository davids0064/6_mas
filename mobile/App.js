// Punto de entrada de la app. Por ahora renderiza directamente la pantalla
// de bienvenida (no hay librería de navegación instalada todavía) -- cuando
// se agregue react-navigation, este componente pasa a ser el stack
// navigator con WelcomeAnimationScreen como primera ruta.
import React from 'react';
import WelcomeAnimationScreen from './src/screens/WelcomeAnimationScreen';

export default function App() {
  return <WelcomeAnimationScreen />;
}
