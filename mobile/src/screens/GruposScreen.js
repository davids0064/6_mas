// Pantalla "Tu grupo". Dos estados:
//
//   1. Esperando emparejamiento (sin grupo): un anillo de 6 puestos — el
//      usuario ya ocupa uno (círculo rojo de marca con su inicial) y los
//      otros 5 pulsan vacíos esperando el matching. Refuerza la metáfora
//      del "6" de la marca. Microcopy motivador + botón Actualizar.
//   2. Grupo asignado: el mismo anillo con los puestos llenos (inicial de
//      cada miembro) y la lista de nombres debajo.
//
// La asignación real de miembros por afinidad (matching) es responsabilidad
// del backend/algoritmo futuro; esta pantalla consume GET /api/grupos/:id y
// GET /api/usuarios/:id (para la inicial y el saludo del estado de espera).
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

const TAMANO_PUESTO = 64;
const RADIO_ANILLO = 110;
const LADO_ANILLO = RADIO_ANILLO * 2 + TAMANO_PUESTO; // alto/ancho del área del anillo

// Posiciones de los 6 puestos: hexágono, arrancando arriba (-90°).
const POSICIONES = Array.from({ length: 6 }, (_, i) => {
  const angulo = ((-90 + i * 60) * Math.PI) / 180;
  return {
    left: LADO_ANILLO / 2 + RADIO_ANILLO * Math.cos(angulo) - TAMANO_PUESTO / 2,
    top: LADO_ANILLO / 2 + RADIO_ANILLO * Math.sin(angulo) - TAMANO_PUESTO / 2,
  };
});

// Un puesto vacío que "respira" (pulso de opacidad y escala), con un
// pequeño desfase por puesto para que no pulsen todos en sincronía.
function PuestoVacio({ posicion, retraso }) {
  const pulso = useSharedValue(0);

  useEffect(() => {
    pulso.value = withDelay(
      retraso,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * pulso.value,
    transform: [{ scale: 0.92 + 0.08 * pulso.value }],
  }));

  return (
    <Animated.View style={[styles.puesto, styles.puestoVacio, estilo, posicion]}>
      <Text style={styles.puestoVacioTexto}>?</Text>
    </Animated.View>
  );
}

function PuestoOcupado({ posicion, inicial }) {
  return (
    <View style={[styles.puesto, styles.puestoOcupado, posicion]}>
      <Text style={styles.puestoOcupadoTexto}>{inicial}</Text>
    </View>
  );
}

// Anillo de 6 puestos. `miembros` = array de nombres (strings); los puestos
// restantes se muestran vacíos y pulsando.
function AnilloGrupo({ miembros }) {
  const ocupados = miembros.slice(0, 6);
  return (
    <View style={styles.anillo}>
      {POSICIONES.map((posicion, i) =>
        i < ocupados.length ? (
          <PuestoOcupado key={i} posicion={posicion} inicial={(ocupados[i] || '?')[0].toUpperCase()} />
        ) : (
          <PuestoVacio key={i} posicion={posicion} retraso={i * 180} />
        ),
      )}
      <View style={styles.centroAnillo}>
        <Text style={styles.centroConteo}>
          {ocupados.length}
          <Text style={styles.centroConteoTotal}>/6</Text>
        </Text>
      </View>
    </View>
  );
}

export default function GruposScreen({ route }) {
  const { grupoId, usuarioId } = route?.params || {};
  const [grupo, setGrupo] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      if (grupoId) setGrupo(await api.obtenerGrupo(grupoId));
      if (usuarioId) setUsuario(await api.obtenerUsuario(usuarioId));
    } catch {
      // Sin datos no se bloquea la pantalla: se muestra el estado de espera.
    } finally {
      setCargando(false);
    }
  }, [grupoId, usuarioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const miembros = grupo?.miembros?.map((m) => m.nombre) || (usuario ? [usuario.nombre] : ['Tú']);

  return (
    <View style={styles.pantalla}>
      {/* Encabezado de marca: mismo estilo (logo centrado) en toda la app. */}
      <EncabezadoMarca titulo="Tu grupo" />

      {cargando ? (
        <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
      ) : (
        <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <AnilloGrupo miembros={miembros} />
          </Animated.View>

          {grupo ? (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.bloqueTexto}>
              <Text style={styles.titulo}>¡Tu grupo está en marcha! 🎉</Text>
              <Text style={styles.subtitulo}>Estado: {grupo.estado}</Text>
              {grupo.miembros?.map((m) => (
                <Text key={m.id} style={styles.miembro}>
                  {m.nombre}
                </Text>
              ))}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.bloqueTexto}>
              <Text style={styles.titulo}>Estamos formando tu grupo ideal ✨</Text>
              <Text style={styles.subtitulo}>
                {usuario ? `${usuario.nombre.split(' ')[0]}, ya` : 'Ya'} ocupas tu puesto. Cuando los
                6 estén listos te avisaremos para el plan sorpresa.
              </Text>

              <TouchableOpacity style={styles.botonActualizar} onPress={cargar} activeOpacity={0.8}>
                <Text style={styles.botonActualizarTexto}>Actualizar ↻</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  centrado: { flex: 1, justifyContent: 'center' },
  cuerpo: { alignItems: 'center', padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
  anillo: {
    width: LADO_ANILLO,
    height: LADO_ANILLO,
    marginTop: ESPACIADO.l,
  },
  puesto: {
    position: 'absolute',
    width: TAMANO_PUESTO,
    height: TAMANO_PUESTO,
    borderRadius: TAMANO_PUESTO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puestoOcupado: {
    backgroundColor: COLORES.rojoMarca,
    shadowColor: COLORES.rojoMarca,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  puestoOcupadoTexto: { ...TIPOGRAFIA.titulo, fontSize: 24, color: COLORES.blanco },
  puestoVacio: {
    backgroundColor: COLORES.superficie,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORES.borde,
  },
  puestoVacioTexto: { ...TIPOGRAFIA.titulo, fontSize: 20, color: COLORES.textoTenue },
  centroAnillo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centroConteo: { ...TIPOGRAFIA.titulo, fontSize: 34, color: COLORES.rojoMarca },
  centroConteoTotal: { fontSize: 20, color: COLORES.textoTenue },
  bloqueTexto: { alignItems: 'center', marginTop: ESPACIADO.xl, paddingHorizontal: ESPACIADO.m },
  titulo: { ...TIPOGRAFIA.titulo, fontSize: 22, color: COLORES.texto, textAlign: 'center' },
  subtitulo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.m,
    lineHeight: 22,
  },
  miembro: {
    ...TIPOGRAFIA.input,
    color: COLORES.texto,
    marginTop: ESPACIADO.s,
  },
  botonActualizar: {
    marginTop: ESPACIADO.xl,
    borderWidth: 1.5,
    borderColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingHorizontal: 36,
    paddingVertical: 12,
  },
  botonActualizarTexto: { ...TIPOGRAFIA.boton, color: COLORES.rojoMarca },
});
