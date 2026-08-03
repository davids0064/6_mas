// Pantalla de bienvenida (splash/onboarding). Fondo: `assets/home.png` (las
// seis siluetas celebrando al atardecer, logo "6 Más" y lema "Conectando
// Personas" — la imagen de marca oficial), a pantalla completa. Fade-in de
// la escena y, tras una pausa, aparece el botón "¡Empezar!" con la paleta
// oficial de marca (fondo #AD191A, texto blanco). Al tocarlo, la escena se
// desvanece y se pasa al login.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { TIPOGRAFIA, RADIOS } from '../theme/tokens';

const { width: ANCHO_PANTALLA, height: ALTO_PANTALLA } = Dimensions.get('window');

// Relación de aspecto real de home.png (1024x1536). El marco que envuelve
// la imagen respeta esta proporción y usa Math.max (en vez de min) para
// que "cubra" toda la pantalla como resizeMode="cover" -- el exceso se
// recorta con overflow:hidden en `contenedor`, así no quedan franjas
// vacías arriba/abajo ni a los costados, sea cual sea el dispositivo.
const RATIO_IMAGEN = 1024 / 1536;
const ALTO_MARCO = Math.max(ALTO_PANTALLA, ANCHO_PANTALLA / RATIO_IMAGEN);
const ANCHO_MARCO = ALTO_MARCO * RATIO_IMAGEN;

const DURACION_FADE_IN_MS = 1000;
const RETRASO_BOTON_MS = 1400; // el botón aparece justo después del fade-in
const DURACION_SALIDA_MS = 400;

// Paleta oficial de marca (ver assets/contenidoidentidaddemarcapaletadecolores).
const ROJO_MARCA = '#AD191A';
const BLANCO_MARCA = '#FFFFFF';

export default function WelcomeAnimationScreen({ navigation, onFinish }) {
  const [saliendo, setSaliendo] = useState(false);

  const escenaOpacidad = useSharedValue(0);
  const botonOpacidad = useSharedValue(0);
  const botonEscala = useSharedValue(0.6);

  useEffect(() => {
    escenaOpacidad.value = withTiming(1, { duration: DURACION_FADE_IN_MS, easing: Easing.out(Easing.cubic) });
    botonOpacidad.value = withDelay(
      RETRASO_BOTON_MS,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.5)) }),
    );
    botonEscala.value = withDelay(
      RETRASO_BOTON_MS,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.5)) }),
    );
  }, [botonEscala, botonOpacidad, escenaOpacidad]);

  const continuar = () => {
    if (onFinish) {
      onFinish();
      return;
    }
    navigation?.navigate('Login');
  };

  const empezar = () => {
    if (saliendo) return;
    setSaliendo(true);
    escenaOpacidad.value = withTiming(0, { duration: DURACION_SALIDA_MS, easing: Easing.in(Easing.cubic) });
    botonOpacidad.value = withTiming(
      0,
      { duration: DURACION_SALIDA_MS, easing: Easing.in(Easing.cubic) },
      (terminado) => {
        if (terminado) runOnJS(continuar)();
      },
    );
  };

  const estiloEscena = useAnimatedStyle(() => ({ opacity: escenaOpacidad.value }));
  const estiloBoton = useAnimatedStyle(() => ({
    opacity: botonOpacidad.value,
    transform: [{ scale: botonEscala.value }],
  }));

  return (
    <View style={styles.contenedor}>
      <Animated.View style={[styles.marco, estiloEscena, { width: ANCHO_MARCO, height: ALTO_MARCO }]}>
        <Image source={require('../../assets/home.png')} style={styles.imagen} resizeMode="cover" />
      </Animated.View>

      <View style={styles.pieDePagina} pointerEvents="box-none">
        <Animated.View style={estiloBoton}>
          <TouchableOpacity
            style={[styles.boton, saliendo && styles.botonDeshabilitado]}
            onPress={empezar}
            disabled={saliendo}
          >
            <Text style={styles.botonTexto}>¡Empezar!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  marco: { alignSelf: 'center' },
  imagen: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  pieDePagina: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 48,
  },
  // CTA con la paleta oficial de marca: fondo #AD191A, texto blanco.
  boton: {
    backgroundColor: ROJO_MARCA,
    borderRadius: RADIOS.boton,
    paddingHorizontal: 48,
    paddingVertical: 15,
    shadowColor: ROJO_MARCA,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonTexto: { ...TIPOGRAFIA.boton, color: BLANCO_MARCA },
});
