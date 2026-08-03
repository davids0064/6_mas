// Campo de texto reutilizable del sistema de formularios de Seis Más:
// etiqueta + ícono + input + feedback visual inmediato (borde/mensaje rojo
// si hay error, borde y check verde cuando el valor ya es válido).
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../../theme/tokens';

export default function CampoTexto({
  icono,
  etiqueta,
  valor,
  onCambiar,
  error,
  placeholder,
  retrasoEntrada = 0,
  onBlur,
  ...propsInput
}) {
  const [tocado, setTocado] = useState(false);
  const valido = tocado && !error && valor.length > 0;

  const colorBorde = error ? COLORES.error : valido ? COLORES.exito : COLORES.borde;

  return (
    <Animated.View entering={FadeInDown.delay(retrasoEntrada).duration(400)} style={styles.contenedor}>
      <Text style={styles.etiqueta}>
        {icono} {etiqueta}
      </Text>
      <View style={[styles.cajaInput, { borderColor: colorBorde }]}>
        <TextInput
          style={styles.input}
          value={valor}
          onChangeText={onCambiar}
          placeholder={placeholder}
          placeholderTextColor={COLORES.textoTenue}
          onBlur={(e) => {
            setTocado(true);
            // Permite a la pantalla validar el campo al salir de él.
            onBlur?.(e);
          }}
          {...propsInput}
        />
        {valido && <Text style={styles.check}>✓</Text>}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: ESPACIADO.m },
  etiqueta: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.s },
  cajaInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.superficie,
    borderWidth: 1.5,
    borderRadius: RADIOS.campo,
    paddingHorizontal: ESPACIADO.m,
  },
  input: { ...TIPOGRAFIA.input, color: COLORES.texto, flex: 1, paddingVertical: 14 },
  check: { color: COLORES.exito, fontSize: 18, fontWeight: '700' },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginTop: ESPACIADO.xs },
});
