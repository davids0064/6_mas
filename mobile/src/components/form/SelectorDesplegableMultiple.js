// Dropdown de selección múltiple: mismo patrón que SelectorDesplegable
// (campo + modal inferior con la lista), pero cada opción es un checkbox
// independiente y el campo cerrado muestra un resumen ("3 seleccionados").
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../../theme/tokens';

export default function SelectorDesplegableMultiple({
  icono,
  etiqueta,
  opciones, // [{ id, etiqueta, icono }]
  seleccion, // array de ids
  onCambiar,
  error,
  placeholder = 'Selecciona una o más opciones',
  retrasoEntrada = 0,
}) {
  const [abierto, setAbierto] = useState(false);

  const alternar = (id) => {
    onCambiar(seleccion.includes(id) ? seleccion.filter((s) => s !== id) : [...seleccion, id]);
  };

  const resumen = () => {
    if (seleccion.length === 0) return placeholder;
    if (seleccion.length <= 2) {
      return seleccion
        .map((id) => opciones.find((o) => o.id === id))
        .filter(Boolean)
        .map((o) => `${o.icono} ${o.etiqueta}`)
        .join(', ');
    }
    return `${seleccion.length} intereses seleccionados`;
  };

  return (
    <Animated.View entering={FadeInDown.delay(retrasoEntrada).duration(400)} style={styles.contenedor}>
      <Text style={styles.etiqueta}>
        {icono} {etiqueta}
      </Text>
      <TouchableOpacity
        style={[styles.campo, error && styles.campoError]}
        onPress={() => setAbierto(true)}
        activeOpacity={0.7}
      >
        <Text
          style={seleccion.length > 0 ? styles.valorTexto : styles.placeholderTexto}
          numberOfLines={1}
        >
          {resumen()}
        </Text>
        <Text style={styles.flecha}>▾</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <TouchableOpacity style={styles.fondoModal} activeOpacity={1} onPress={() => setAbierto(false)}>
          <View style={styles.hoja} onStartShouldSetResponder={() => true}>
            <Text style={styles.hojaTitulo}>{etiqueta}</Text>
            <FlatList
              data={opciones}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => {
                const activa = seleccion.includes(item.id);
                return (
                  <TouchableOpacity style={styles.opcion} onPress={() => alternar(item.id)}>
                    <Text style={styles.opcionTexto}>
                      {item.icono} {item.etiqueta}
                    </Text>
                    <View style={[styles.casilla, activa && styles.casillaActiva]}>
                      {activa && <Text style={styles.check}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.botonListo} onPress={() => setAbierto(false)} activeOpacity={0.85}>
              <Text style={styles.botonListoTexto}>Listo</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: ESPACIADO.m },
  etiqueta: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.s },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORES.superficie,
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.campo,
    paddingHorizontal: ESPACIADO.m,
    paddingVertical: 14,
  },
  campoError: { borderColor: COLORES.error },
  valorTexto: { ...TIPOGRAFIA.input, color: COLORES.texto, flex: 1, marginRight: ESPACIADO.s },
  placeholderTexto: { ...TIPOGRAFIA.input, color: COLORES.textoTenue, flex: 1, marginRight: ESPACIADO.s },
  flecha: { ...TIPOGRAFIA.etiqueta, color: COLORES.textoSuave },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginTop: ESPACIADO.xs },
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: COLORES.fondo,
    borderTopLeftRadius: RADIOS.tarjeta,
    borderTopRightRadius: RADIOS.tarjeta,
    paddingHorizontal: ESPACIADO.l,
    paddingTop: ESPACIADO.l,
    paddingBottom: ESPACIADO.xl,
    maxHeight: '70%',
  },
  hojaTitulo: { ...TIPOGRAFIA.titulo, fontSize: 20, color: COLORES.texto, marginBottom: ESPACIADO.m },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  opcionTexto: { ...TIPOGRAFIA.input, color: COLORES.texto },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaActiva: { backgroundColor: COLORES.rojoMarca, borderColor: COLORES.rojoMarca },
  check: { color: COLORES.blanco, fontSize: 14, fontWeight: '800' },
  botonListo: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: ESPACIADO.m,
  },
  botonListoTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
});
