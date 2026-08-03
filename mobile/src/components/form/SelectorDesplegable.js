// Dropdown reutilizable: un campo con la misma apariencia de CampoTexto que,
// al tocarlo, abre un modal con la lista de opciones (selección única). React
// Native no trae un <select> nativo multiplataforma, así que se arma con
// Modal + FlatList en vez de agregar una dependencia externa.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../../theme/tokens';

export default function SelectorDesplegable({
  icono,
  etiqueta,
  opciones, // [{ id, etiqueta, icono }]
  seleccion, // id seleccionado o null
  onCambiar,
  error,
  placeholder = 'Selecciona una opción',
  retrasoEntrada = 0,
}) {
  const [abierto, setAbierto] = useState(false);
  const opcionActual = opciones.find((o) => o.id === seleccion);

  const elegir = (id) => {
    onCambiar(id);
    setAbierto(false);
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
        <Text style={opcionActual ? styles.valorTexto : styles.placeholderTexto}>
          {opcionActual ? `${opcionActual.icono} ${opcionActual.etiqueta}` : placeholder}
        </Text>
        <Text style={styles.flecha}>▾</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <TouchableOpacity style={styles.fondoModal} activeOpacity={1} onPress={() => setAbierto(false)}>
          <View style={styles.hoja}>
            <Text style={styles.hojaTitulo}>{etiqueta}</Text>
            <FlatList
              data={opciones}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => {
                const activa = item.id === seleccion;
                return (
                  <TouchableOpacity
                    style={[styles.opcion, activa && styles.opcionActiva]}
                    onPress={() => elegir(item.id)}
                  >
                    <Text style={styles.opcionTexto}>
                      {item.icono} {item.etiqueta}
                    </Text>
                    {activa && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
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
  valorTexto: { ...TIPOGRAFIA.input, color: COLORES.texto },
  placeholderTexto: { ...TIPOGRAFIA.input, color: COLORES.textoTenue },
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
    maxHeight: '60%',
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
  opcionActiva: {},
  opcionTexto: { ...TIPOGRAFIA.input, color: COLORES.texto },
  check: { color: COLORES.rojoMarca, fontSize: 18, fontWeight: '800' },
});
