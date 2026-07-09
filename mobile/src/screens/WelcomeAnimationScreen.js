// Pantalla de bienvenida animada (splash/onboarding). Usa el archivo real
// `assets/home_1.png` tal cual, sin alterar un solo píxel: ni el fondo, ni
// el logo, ni la ilustración de personas, ni la silueta de ciudad se
// recrean con formas propias.
//
// Lo único "animado" son los 6 círculos de intereses, y se logra sin tocar
// el diseño de la imagen original: cada ícono se recortó de la MISMA
// imagen (ver mobile/assets/icons/sprite_*.png, píxeles reales, con máscara
// circular) y se superpone exactamente sobre su posición original en la
// imagen base. En reposo (rotación 0°) el sprite es indistinguible del
// ícono horneado en la imagen; al girar sobre su propio eje (como una
// moneda) nunca descubre el fondo, porque su silueta circular siempre
// tapa el mismo círculo. Por eso no hace falta "limpiar" ni retocar la
// imagen original en ningún punto.
//
// Duración total: 10s exactos, repartidos en 3 fases (ver también
// mobile/docs/ANIMACION_BIENVENIDA.md):
//
//   FASE 1 — Aparición (0s → 2s): fade-in de toda la escena (imagen real +
//     los 6 iconos superpuestos, que a rotación 0 son pixel-idénticos a la
//     imagen).
//   FASE 2 — Giro (2s → 8s): cada icono gira sobre su propio eje (2 o 3
//     vueltas completas, con pequeños desfases de tiempo entre ellos para
//     que no giren todos en perfecta sincronía). Las vueltas son SIEMPRE
//     un número entero -- si fueran 1.5 o 2.5 vueltas el icono terminaría
//     rotado 180° respecto al diseño original, y la instrucción es
//     mantener el diseño estrictamente igual al reposo final.
//   FASE 3 — Cierre (8s → 10s): con los iconos ya de vuelta en su
//     orientación original, aparece el botón "¡Empezar!".
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: ANCHO_PANTALLA, height: ALTO_PANTALLA } = Dimensions.get('window');

// Relación de aspecto real de home_1.png (1024x1536). El marco que envuelve
// la imagen y los iconos siempre respeta esta proporción -- así las
// posiciones porcentuales de cada icono coinciden exactamente con su lugar
// en la imagen original, sea cual sea el tamaño de pantalla.
const RATIO_IMAGEN = 1024 / 1536;
const ALTO_MARCO = Math.min(ALTO_PANTALLA, ANCHO_PANTALLA / RATIO_IMAGEN);
const ANCHO_MARCO = ALTO_MARCO * RATIO_IMAGEN;

// Centro (centroX/centroY, en % del marco) y tamaño (anchoPct/altoPct, en %
// del ancho/alto del marco) de cada icono, medidos directamente sobre
// home_1.png a 1024x1536. vueltas: SIEMPRE entero (ver nota arriba).
// retraso: para que no giren todos sincronizados.
//
// OJO: a diferencia de CSS web, en React Native `left`/`top` posicionan la
// esquina superior-izquierda del box, no el centro, y no existe
// `transform: translate(-50%,-50%)` con porcentajes para compensarlo. Por
// eso `left`/`top` se calculan restando la mitad del ancho/alto al centro
// medido, en vez de usar el centro directamente (si no, cada icono queda
// corrido en diagonal, tapando solo la mitad del icono horneado en la
// imagen y dejando ver "doble" icono).
const ICONOS_BASE = [
  { id: 'bienestar', fuente: require('../../assets/icons/sprite_bienestar.png'), centroX: 29.3, centroY: 16.8, anchoPct: 19.5, altoPct: 13.0, vueltas: 2, retraso: 0 },
  { id: 'fitness', fuente: require('../../assets/icons/sprite_fitness.png'), centroX: 78.1, centroY: 19.4, anchoPct: 20.5, altoPct: 13.7, vueltas: 3, retraso: 150 },
  { id: 'gastronomia', fuente: require('../../assets/icons/sprite_gastronomia.png'), centroX: 11.7, centroY: 35.2, anchoPct: 20.5, altoPct: 13.7, vueltas: 2, retraso: 300 },
  { id: 'tecnologia', fuente: require('../../assets/icons/sprite_tecnologia.png'), centroX: 89.4, centroY: 35.8, anchoPct: 20.5, altoPct: 13.7, vueltas: 3, retraso: 450 },
  { id: 'musica', fuente: require('../../assets/icons/sprite_musica.png'), centroX: 17.1, centroY: 53.1, anchoPct: 20.5, altoPct: 13.7, vueltas: 2, retraso: 600 },
  { id: 'lectura', fuente: require('../../assets/icons/sprite_lectura.png'), centroX: 82.5, centroY: 53.7, anchoPct: 20.5, altoPct: 13.7, vueltas: 3, retraso: 750 },
];

const ICONOS = ICONOS_BASE.map((ic) => ({
  ...ic,
  left: `${ic.centroX - ic.anchoPct / 2}%`,
  top: `${ic.centroY - ic.altoPct / 2}%`,
  ancho: `${ic.anchoPct}%`,
  alto: `${ic.altoPct}%`,
}));

const FASE_1_MS = 2000;
const FASE_2_MS = 6000;
const FASE_3_MS = 2000;
const DURACION_TOTAL_MS = FASE_1_MS + FASE_2_MS + FASE_3_MS; // 10000

function IconoGiratorio({ icono, marcoOpacidad }) {
  const rotacion = useSharedValue(0);

  useEffect(() => {
    rotacion.value = withDelay(
      FASE_1_MS + icono.retraso,
      withTiming(360 * icono.vueltas, {
        duration: FASE_2_MS - icono.retraso,
        easing: Easing.inOut(Easing.cubic),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({
    opacity: marcoOpacidad.value,
    transform: [{ rotate: `${rotacion.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.icono,
        estilo,
        { left: icono.left, top: icono.top, width: icono.ancho, height: icono.alto },
      ]}
    >
      <Image source={icono.fuente} style={styles.iconoImagen} />
    </Animated.View>
  );
}

export default function WelcomeAnimationScreen({ navigation, onFinish }) {
  const [botonListo, setBotonListo] = useState(false);

  const marcoOpacidad = useSharedValue(0);
  const botonOpacidad = useSharedValue(0);
  const botonEscala = useSharedValue(0.6);

  useEffect(() => {
    // FASE 1: fade-in de la escena completa (imagen + iconos superpuestos).
    marcoOpacidad.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });

    // FASE 3: boton "Empezar" con un ligero "pop" (Easing.back).
    botonOpacidad.value = withDelay(
      FASE_1_MS + FASE_2_MS + 300,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.5)) }),
    );
    botonEscala.value = withDelay(
      FASE_1_MS + FASE_2_MS + 300,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.5)) }),
    );

    const temporizador = setTimeout(() => runOnJS(setBotonListo)(true), DURACION_TOTAL_MS);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avanzar = () => {
    if (!botonListo) return;
    if (onFinish) {
      onFinish();
      return;
    }
    navigation?.navigate('Registro');
  };

  const estiloMarco = useAnimatedStyle(() => ({ opacity: marcoOpacidad.value }));
  const estiloBoton = useAnimatedStyle(() => ({
    opacity: botonOpacidad.value,
    transform: [{ scale: botonEscala.value }],
  }));

  return (
    <View style={styles.contenedor}>
      <Animated.View style={[styles.marco, estiloMarco, { width: ANCHO_MARCO, height: ALTO_MARCO }]}>
        <Image source={require('../../assets/home_1.png')} style={styles.imagen} resizeMode="cover" />
        {ICONOS.map((icono) => (
          <IconoGiratorio key={icono.id} icono={icono} marcoOpacidad={marcoOpacidad} />
        ))}
      </Animated.View>

      <View style={styles.pieDePagina} pointerEvents="box-none">
        <Animated.View style={estiloBoton}>
          <TouchableOpacity
            style={[styles.boton, !botonListo && styles.botonDeshabilitado]}
            onPress={avanzar}
            disabled={!botonListo}
          >
            <Text style={styles.botonTexto}>¡Empezar!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#1B3B7A', alignItems: 'center', justifyContent: 'center' },
  marco: { position: 'absolute', top: 0, alignSelf: 'center' },
  imagen: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  icono: { position: 'absolute' },
  iconoImagen: { width: '100%', height: '100%' },
  pieDePagina: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 48,
  },
  boton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 999,
  },
  botonDeshabilitado: { opacity: 0.4 },
  botonTexto: { color: '#1B3B7A', fontWeight: 'bold', fontSize: 16 },
});
