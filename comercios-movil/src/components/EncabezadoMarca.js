// Encabezado de marca de la app de comercios: degradado negro → rojo oficial
// con el logo centrado, igual que en la app de usuarios, para que un local que
// ve las dos reconozca que son el mismo producto.
//
// `onVolver` pinta una flecha a la izquierda y `onCuenta` un acceso a la
// pantalla de cuenta a la derecha, ambos superpuestos para no descentrar el
// logo.
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

export default function EncabezadoMarca({ titulo, subtitulo, onVolver, onCuenta }) {
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
          <Text style={styles.accion}>← Regresar</Text>
        </TouchableOpacity>
      ) : null}

      {onCuenta ? (
        <TouchableOpacity
          style={styles.botonCuenta}
          onPress={onCuenta}
          accessibilityLabel="Tu cuenta"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.accion}>Cuenta</Text>
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
    paddingTop: 72,
    paddingBottom: ESPACIADO.l,
    paddingHorizontal: ESPACIADO.l,
    borderBottomLeftRadius: RADIOS.tarjeta,
    borderBottomRightRadius: RADIOS.tarjeta,
    alignItems: 'center',
  },
  botonVolver: { position: 'absolute', top: 52, left: ESPACIADO.l, zIndex: 1 },
  botonCuenta: { position: 'absolute', top: 52, right: ESPACIADO.l, zIndex: 1 },
  accion: { ...TIPOGRAFIA.etiqueta, color: COLORES.blanco },
  logo: { width: 130, height: 74 }, // relación real del logo (3343x1902)
  titulo: { ...TIPOGRAFIA.titulo, color: COLORES.blanco, marginTop: ESPACIADO.s, textAlign: 'center' },
  subtitulo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.crema,
    marginTop: ESPACIADO.xs,
    textAlign: 'center',
  },
});
