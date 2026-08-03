// Encabezado de marca reutilizable: el mismo estilo del header de
// Bienvenida/Login (degradado negroMarca → rojoMarca, logo "6 Más"
// centrado) replicado en cada pantalla del flujo para que la identidad sea
// consistente. `onVolver` es opcional: si se pasa, muestra una flecha "←"
// en la esquina superior izquierda sin descentrar el logo (posición
// absoluta, superpuesta).
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

export default function EncabezadoMarca({ titulo, subtitulo, onVolver }) {
  return (
    <LinearGradient
      colors={[COLORES.negroMarca, COLORES.rojoMarca]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.encabezado}
    >
      {onVolver ? (
        <TouchableOpacity
          style={styles.botonVolver}
          onPress={onVolver}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.botonVolverTexto}>← Regresar</Text>
        </TouchableOpacity>
      ) : null}

      <Image
        source={require('../../assets/icons/logo_blanco.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      {titulo ? <Text style={styles.titulo}>{titulo}</Text> : null}
      {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    paddingTop: 80,
    paddingBottom: ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.l,
    borderBottomLeftRadius: RADIOS.tarjeta,
    borderBottomRightRadius: RADIOS.tarjeta,
    alignItems: 'center',
  },
  botonVolver: { position: 'absolute', top: 56, left: ESPACIADO.l, zIndex: 1 },
  botonVolverTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.blanco },
  logo: { width: 170, height: 96 }, // relación real del logo (3343x1902)
  titulo: { ...TIPOGRAFIA.titulo, color: COLORES.blanco, marginTop: ESPACIADO.m, textAlign: 'center' },
  subtitulo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.crema,
    marginTop: ESPACIADO.s,
    textAlign: 'center',
  },
});
