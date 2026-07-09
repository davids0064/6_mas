// Alternativa a ParticleBackground.js usando Lottie en vez de partículas
// hechas a mano con Animated.View + opacity.
//
// NO está activa por defecto. Requiere un archivo JSON real exportado con el
// plugin Bodymovin desde After Effects (ver mobile/docs/ANIMACION_BIENVENIDA.md,
// sección "Exportar a Lottie/Bodymovin") — ese JSON no se genera a mano en
// este repo porque intentar escribirlo directamente no sería fiel a una
// animación diseñada visualmente, y describir sin implementar es justamente
// lo que pide esta tarea para el camino "Lottie".
//
// Para activar esta alternativa en el futuro:
//   1. La dependencia "lottie-react-native" ya está listada en package.json.
//      Instalar con `npm install` y, en iOS, `cd ios && pod install`
//      (Lottie trae un módulo nativo, como cualquier librería con código
//      nativo en React Native CLI).
//   2. Colocar el export de Bodymovin en
//      mobile/src/assets/animations/particulas.json (crear la carpeta).
//   3. Descomentar los imports y el "return" real de abajo.
//   4. En WelcomeAnimationScreen.js, reemplazar
//      `<ParticleBackground />` por `<LottieParticles />`.
//
// Ventaja frente al enfoque hecho a mano: un diseñador puede iterar la
// animación de partículas visualmente en After Effects sin tocar código.
// Desventaja: agrega una dependencia nativa y un archivo binario/JSON pesado
// solo para un fondo que, en este MVP, no lo justifica todavía.
import React from 'react';
import { StyleSheet } from 'react-native';
// import LottieView from 'lottie-react-native';
// import particulasJSON from '../../assets/animations/particulas.json';

export default function LottieParticles() {
  // Placeholder: sin el JSON real no hay nada que reproducir, y renderizar
  // <LottieView> sin "source" rompería en tiempo de ejecución. Se deja el
  // uso real comentado para no forzar la instalación de la dependencia
  // nativa (pod install) mientras no se use esta alternativa.
  return null;

  /* Uso real una vez exista el JSON exportado de After Effects:
  return (
    <LottieView
      source={particulasJSON}
      autoPlay
      loop
      resizeMode="cover"
      style={StyleSheet.absoluteFill}
    />
  );
  */
}
