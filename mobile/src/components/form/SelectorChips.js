// Selector de "chips" reutilizable: sirve para selección única (género) o
// múltiple (intereses). Cada chip muestra ícono + etiqueta y cambia a la
// paleta azul de la marca al seleccionarse.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../../theme/tokens';

export default function SelectorChips({
  icono,
  etiqueta,
  opciones, // [{ id, etiqueta, icono }]
  seleccion, // string (única) o array de ids (múltiple)
  onCambiar,
  multiple = false,
  error,
  retrasoEntrada = 0,
}) {
  const estaSeleccionada = (id) => (multiple ? seleccion.includes(id) : seleccion === id);

  const alternar = (id) => {
    if (!multiple) {
      onCambiar(id);
      return;
    }
    onCambiar(
      seleccion.includes(id) ? seleccion.filter((s) => s !== id) : [...seleccion, id],
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(retrasoEntrada).duration(400)} style={styles.contenedor}>
      <Text style={styles.etiqueta}>
        {icono} {etiqueta}
      </Text>
      <View style={styles.fila}>
        {opciones.map((opcion) => {
          const activa = estaSeleccionada(opcion.id);
          return (
            <TouchableOpacity
              key={opcion.id}
              style={[styles.chip, activa && styles.chipActiva, error && !activa && styles.chipError]}
              onPress={() => alternar(opcion.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipTexto, activa && styles.chipTextoActivo]}>
                {opcion.icono} {opcion.etiqueta}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: ESPACIADO.m },
  etiqueta: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.s },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIADO.s },
  chip: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.chip,
    paddingHorizontal: ESPACIADO.m,
    paddingVertical: 10,
  },
  chipActiva: { backgroundColor: COLORES.azul, borderColor: COLORES.azulClaro },
  chipError: { borderColor: COLORES.error },
  chipTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  chipTextoActivo: { color: COLORES.blanco },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginTop: ESPACIADO.xs },
});
