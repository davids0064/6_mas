// Placeholder de la pantalla de grupo. Muestra el estado de formación del
// grupo de 6 personas del usuario. La asignación real de miembros por
// afinidad (matching) es responsabilidad del backend/algoritmo futuro; esta
// pantalla solo consume GET /api/grupos/:id.
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../services/api';

export default function GruposScreen({ route }) {
  const { grupoId } = route.params || {};
  const [grupo, setGrupo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!grupoId) {
      setCargando(false);
      return;
    }
    api
      .obtenerGrupo(grupoId)
      .then(setGrupo)
      .finally(() => setCargando(false));
  }, [grupoId]);

  if (cargando) return <ActivityIndicator style={styles.centrado} />;

  if (!grupo) {
    return (
      <View style={styles.contenedor}>
        <Text>Aún no perteneces a un grupo. El emparejamiento se asignará pronto.</Text>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Tu grupo ({grupo.estado})</Text>
      <FlatList
        data={grupo.miembros}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text style={styles.miembro}>{item.nombre}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 24 },
  centrado: { flex: 1, justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  miembro: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
