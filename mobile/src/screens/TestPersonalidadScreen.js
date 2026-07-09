// Placeholder del cuestionario de personalidad. El cuestionario real
// (preguntas, escalas, lógica de puntuación) es contenido de producto que se
// definirá con el equipo; aquí solo se deja el flujo de envío al backend.
// Las respuestas viajan como jsonb (ver db/DISEÑO.md) para no acoplar el
// esquema de base de datos a la forma exacta del cuestionario.
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { api } from '../services/api';

// Cuestionario de ejemplo; reemplazar por el definitivo del producto.
const PREGUNTAS_EJEMPLO = [
  { id: 'extroversion', texto: '¿Disfrutas conocer gente nueva en planes grupales?' },
  { id: 'aventura', texto: '¿Prefieres planes sorpresa antes que planificados?' },
];

export default function TestPersonalidadScreen({ route, navigation }) {
  const { usuarioId } = route.params;
  const [respuestas, setRespuestas] = useState({});

  const responder = (preguntaId, valor) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  };

  const enviar = async () => {
    await api.enviarTestPersonalidad(usuarioId, respuestas, null);
    navigation.navigate('Grupos', { usuarioId });
  };

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Test de personalidad</Text>
      {PREGUNTAS_EJEMPLO.map((pregunta) => (
        <View key={pregunta.id} style={styles.pregunta}>
          <Text>{pregunta.texto}</Text>
          <View style={styles.opciones}>
            <Button title="Sí" onPress={() => responder(pregunta.id, true)} />
            <Button title="No" onPress={() => responder(pregunta.id, false)} />
          </View>
        </View>
      ))}
      <Button title="Continuar" onPress={enviar} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  pregunta: { marginBottom: 16 },
  opciones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
