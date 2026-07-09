// Placeholder de la pantalla de registro. Conecta con POST /api/usuarios.
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { api } from '../services/api';

export default function RegistroScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const registrar = async () => {
    setError(null);
    try {
      const usuario = await api.registrarUsuario({ nombre, email, password });
      // Siguiente paso del flujo del MVP: test de personalidad.
      navigation.navigate('TestPersonalidad', { usuarioId: usuario.id });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Crea tu cuenta</Text>
      <TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Registrarme" onPress={registrar} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  error: { color: 'red', marginBottom: 12 },
});
