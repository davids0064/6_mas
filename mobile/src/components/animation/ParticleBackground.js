// Partículas brillantes de fondo, simuladas (no es un sistema de física real:
// solo puntos con opacidad oscilante en posiciones aleatorias). Es
// intencionalmente simple — el detalle visual que aporta un sistema de
// partículas real no se justifica frente a la complejidad de mantenerlo en
// una animación de splash de 10s que corre una sola vez.
import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const NUMERO_PARTICULAS = 28;

function Particula({ x, y, tamano, duracion, retraso }) {
  const opacidad = useSharedValue(0);

  React.useEffect(() => {
    // Parpadeo infinito ida-y-vuelta (reverse=true) con Easing.sin: la misma
    // curva que usan la mayoría de los "twinkle" de estrellas porque acelera
    // y desacelera suavemente en ambos extremos, sin el "salto" que se nota
    // con easing lineal en algo tan sutil como esto.
    opacidad.value = withDelay(
      retraso,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duracion, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: duracion, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estiloAnimado = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <Animated.View
      style={[
        styles.particula,
        estiloAnimado,
        { left: x, top: y, width: tamano, height: tamano, borderRadius: tamano / 2 },
      ]}
    />
  );
}

export default function ParticleBackground() {
  // useMemo: las posiciones/tiempos aleatorios se generan una sola vez al
  // montar. Si se recalcularan en cada render, las partículas "saltarían" de
  // posición cada vez que el componente padre (WelcomeAnimationScreen)
  // actualiza su estado (por ejemplo al habilitar el botón final).
  const particulas = useMemo(
    () =>
      Array.from({ length: NUMERO_PARTICULAS }).map((_, i) => ({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        tamano: 2 + Math.random() * 4,
        duracion: 1500 + Math.random() * 2500,
        retraso: Math.random() * 3000,
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particulas.map((p) => (
        <Particula key={p.id} {...p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particula: { position: 'absolute', backgroundColor: '#FFFFFF' },
});
