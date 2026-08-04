// Valoración de un plan al que el grupo ya fue.
//
// Cierra el ciclo del producto: el feedback alimenta la reputación del
// comercio, que es lo que permite que el matching mejore con el tiempo. Hasta
// ahora `api.enviarFeedback` existía sin ninguna pantalla que la llamara.
//
// Solo se llega acá desde un plan que ya pasó y que este usuario todavía no
// valoró (`ya_valorado`, que devuelve GET /api/usuarios/yo/eventos). La tabla
// tiene UNIQUE(evento_id, usuario_id): sin ese dato la app no sabría a quién
// ofrecerle el formulario y reintentar chocaría contra un 409 a ciegas.
//
// El comentario es opcional a propósito. Pedir texto obligatorio hunde la tasa
// de respuesta, y para la reputación del comercio la estrella es el dato que
// sirve; el texto es el que ayuda a entender por qué.
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// Una etiqueta por estrella: el número solo no dice qué significa un 3, y la
// palabra hace que la escala se entienda igual entre personas distintas.
const ETIQUETAS = ['', 'Muy mal', 'Mal', 'Bien', 'Muy bien', '¡Increíble!'];

const MAX_COMENTARIO = 500;

function Estrellas({ valor, onCambiar }) {
  return (
    <View style={styles.estrellas}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => onCambiar(n)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          // Sin esto el lector de pantalla anuncia cinco veces "estrella":
          // el número y el estado son lo que hace usable la escala.
          accessibilityRole="radio"
          accessibilityState={{ selected: valor === n }}
          accessibilityLabel={`${n} de 5: ${ETIQUETAS[n]}`}
        >
          <Text style={[styles.estrella, n <= valor && styles.estrellaActiva]}>
            {n <= valor ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ValoracionScreen({ evento, onListo, onVolver }) {
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async () => {
    if (rating === 0) {
      setError('Elige de 1 a 5 estrellas para enviar tu valoración.');
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await api.enviarFeedback(evento.id, rating, comentario.trim() || null);
      onListo();
    } catch (e) {
      // El 409 tiene su propio texto: significa que ya valoró (desde otro
      // dispositivo, o con la pantalla abierta de antes). No es un fallo que
      // deba reintentar, así que se cierra en vez de dejarlo dando vueltas.
      if (e?.estado === 409) {
        onListo();
        return;
      }
      setError(e?.message || 'No pudimos enviar tu valoración. Inténtalo de nuevo.');
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <EncabezadoMarca titulo="¿Cómo estuvo?" onVolver={onVolver} />

        <View style={styles.cuerpo}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={styles.plan}>{evento.titulo}</Text>
            {evento.comercio_nombre ? (
              <Text style={styles.comercio}>en {evento.comercio_nombre}</Text>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <Estrellas valor={rating} onCambiar={setRating} />
            {/* Espacio reservado siempre: si la etiqueta apareciera al tocar,
                empujaría el comentario y el botón hacia abajo justo cuando el
                dedo va en camino. */}
            <Text style={styles.etiquetaRating}>{ETIQUETAS[rating] || ' '}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text style={styles.etiqueta}>💬 ¿Nos cuentas algo más? (opcional)</Text>
            <TextInput
              style={styles.comentario}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Lo que más te gustó, lo que mejorarías…"
              placeholderTextColor={COLORES.textoTenue}
              multiline
              numberOfLines={4}
              maxLength={MAX_COMENTARIO}
              textAlignVertical="top"
            />
            <Text style={styles.contador}>
              {comentario.length}/{MAX_COMENTARIO}
            </Text>
          </Animated.View>

          {error ? <Text style={styles.error}>😕 {error}</Text> : null}

          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <TouchableOpacity
              style={[styles.boton, (enviando || rating === 0) && styles.botonInactivo]}
              onPress={enviar}
              disabled={enviando || rating === 0}
              activeOpacity={0.85}
            >
              {enviando ? (
                <ActivityIndicator color={COLORES.blanco} />
              ) : (
                <Text style={styles.botonTexto}>Enviar valoración</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  scroll: { flexGrow: 1, paddingBottom: ESPACIADO.xl },
  cuerpo: { padding: ESPACIADO.l },
  plan: { ...TIPOGRAFIA.titulo, fontSize: 22, color: COLORES.texto, textAlign: 'center' },
  comercio: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.xs,
  },
  estrellas: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: ESPACIADO.xl,
  },
  estrella: {
    fontSize: 44,
    color: COLORES.borde,
    paddingHorizontal: ESPACIADO.xs,
  },
  estrellaActiva: { color: COLORES.rojoMarca },
  etiquetaRating: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.rojoMarca,
    textAlign: 'center',
    marginTop: ESPACIADO.s,
    minHeight: 20,
  },
  etiqueta: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.texto,
    marginTop: ESPACIADO.xl,
    marginBottom: ESPACIADO.s,
  },
  comentario: {
    ...TIPOGRAFIA.input,
    color: COLORES.texto,
    backgroundColor: COLORES.superficie,
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.campo,
    padding: ESPACIADO.m,
    minHeight: 110,
  },
  contador: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    textAlign: 'right',
    marginTop: ESPACIADO.xs,
  },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginTop: ESPACIADO.m, textAlign: 'center' },
  boton: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: ESPACIADO.xl,
  },
  botonInactivo: { opacity: 0.5 },
  botonTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
});
