// Pantalla "Tu grupo · chat".
//
// Es lo primero que la app deja HACER, y no un adorno: seis desconocidos
// quedan a cenar y hasta ahora no tenían forma de decir "llego diez minutos
// tarde" ni "no voy a poder ir". Todo el valor del producto ocurría fuera de
// la app.
//
// Abrir un chat obliga a lo que la guideline 1.2 de la App Store exige para
// contenido generado por usuarios, y las cuatro cosas están:
//
//   * filtrar     → el backend esconde el mensaje objetable al publicarse
//   * reportar    → toque largo sobre cualquier mensaje ajeno
//   * bloquear    → desde el mismo menú; deja de verse y deja de coincidir
//   * atender     → los reportes quedan en `reportes` con estado 'abierto'
//
// Reportar y bloquear están sobre el mensaje, no escondidos en un ajuste: una
// salida que hay que ir a buscar cuando algo va mal es una salida que no
// existe.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import EncabezadoMarca from '../components/EncabezadoMarca';
import { api } from '../services/api';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, COLUMNA } from '../theme/tokens';

const MOTIVOS = [
  'Contenido ofensivo',
  'Acoso o amenazas',
  'Spam o publicidad',
  'Suplantación de identidad',
  'Otro',
];

function hora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

function Burbuja({ mensaje, onReportar, onBloquear }) {
  const mio = mensaje.es_tuyo;

  // El menú solo aparece sobre mensajes ajenos: reportarse a uno mismo no
  // significa nada, y ofrecerlo hace dudar de para qué sirve el menú.
  const abrirOpciones = () => {
    if (mio) return;
    Alert.alert(
      mensaje.nombre,
      '¿Qué quieres hacer?',
      [
        { text: 'Reportar mensaje', style: 'destructive', onPress: () => onReportar(mensaje) },
        { text: `Bloquear a ${mensaje.nombre}`, style: 'destructive', onPress: () => onBloquear(mensaje) },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={mio ? 1 : 0.7}
      onLongPress={abrirOpciones}
      delayLongPress={350}
      style={[estilos.fila, mio ? estilos.filaMia : estilos.filaAjena]}
    >
      <View style={[estilos.burbuja, mio ? estilos.burbujaMia : estilos.burbujaAjena]}>
        {mio ? null : <Text style={estilos.autor}>{mensaje.nombre}</Text>}
        <Text style={[estilos.texto, mio && estilos.textoMio]}>{mensaje.texto}</Text>
        <Text style={[estilos.hora, mio && estilos.horaMia]}>{hora(mensaje.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen({ onVolver }) {
  const [mensajes, setMensajes] = useState([]);
  const [borrador, setBorrador] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const lista = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setMensajes(await api.obtenerMensajes());
      setError(null);
    } catch (e) {
      setError(e?.message || 'No pudimos cargar la conversación.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    // Sin websockets en el MVP: se relee cada 15 segundos. Es suficiente para
    // una conversación de seis personas que quedan a cenar, y no obliga a
    // montar infraestructura de tiempo real para la primera versión.
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  const enviar = async () => {
    const texto = borrador.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    // Se limpia el campo antes de la respuesta: si falla, se devuelve el texto
    // en el catch. Al revés —limpiar al confirmar— la sensación es de teclado
    // pegado, y la gente escribe el mensaje dos veces.
    setBorrador('');
    try {
      await api.enviarMensaje(texto);
      await cargar();
      lista.current?.scrollToEnd({ animated: true });
    } catch (e) {
      setBorrador(texto);
      setError(e?.message || 'No se pudo enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const reportar = (mensaje) => {
    Alert.alert(
      'Reportar mensaje',
      '¿Por qué lo reportas?',
      [
        ...MOTIVOS.map((motivo) => ({
          text: motivo,
          onPress: async () => {
            try {
              await api.reportar({ mensajeId: mensaje.id, usuarioId: mensaje.usuario_id, motivo });
              Alert.alert('Gracias', 'Lo revisamos en menos de 24 horas.');
            } catch {
              Alert.alert('No se pudo enviar el reporte', 'Inténtalo de nuevo.');
            }
          },
        })),
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const bloquear = (mensaje) => {
    Alert.alert(
      `Bloquear a ${mensaje.nombre}`,
      'No volverás a ver sus mensajes y no os volveremos a poner en el mismo grupo.',
      [
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.bloquear(mensaje.usuario_id);
              await cargar();
            } catch {
              Alert.alert('No se pudo bloquear', 'Inténtalo de nuevo.');
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={estilos.pantalla}>
      <EncabezadoMarca titulo="Tu grupo" onVolver={onVolver} />

      <KeyboardAvoidingView
        style={estilos.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={estilos.centrado} />
        ) : (
          <FlatList
            ref={lista}
            data={mensajes}
            keyExtractor={(m) => m.id}
            contentContainerStyle={estilos.listaCuerpo}
            renderItem={({ item }) => (
              <Burbuja mensaje={item} onReportar={reportar} onBloquear={bloquear} />
            )}
            ListHeaderComponent={
              <Text style={estilos.aviso}>
                Mantén pulsado un mensaje para reportarlo o bloquear a quien lo escribió.
              </Text>
            }
            ListEmptyComponent={
              <Text style={estilos.vacio}>
                Todavía no ha escrito nadie. Empieza tú: decir a qué hora llegas ya ayuda.
              </Text>
            }
            onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
          />
        )}

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <View style={estilos.barra}>
          <TextInput
            style={estilos.campo}
            value={borrador}
            onChangeText={setBorrador}
            placeholder="Escribe al grupo…"
            placeholderTextColor={COLORES.textoTenue}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[estilos.enviar, !borrador.trim() && estilos.enviarApagado]}
            onPress={enviar}
            disabled={!borrador.trim() || enviando}
            activeOpacity={0.85}
          >
            <Text style={estilos.enviarTexto}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  flex: { flex: 1 },
  centrado: { marginTop: ESPACIADO.xl },
  listaCuerpo: {
    ...COLUMNA, padding: ESPACIADO.m, paddingBottom: ESPACIADO.m },
  aviso: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    textAlign: 'center',
    marginBottom: ESPACIADO.m,
  },
  vacio: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.l,
  },
  error: { color: COLORES.error, textAlign: 'center', paddingBottom: ESPACIADO.s },

  fila: { marginBottom: ESPACIADO.s, maxWidth: '82%' },
  filaMia: { alignSelf: 'flex-end' },
  filaAjena: { alignSelf: 'flex-start' },
  burbuja: { borderRadius: RADIOS.tarjeta, paddingVertical: 10, paddingHorizontal: ESPACIADO.m },
  burbujaMia: { backgroundColor: COLORES.rojoMarca, borderBottomRightRadius: 6 },
  burbujaAjena: { backgroundColor: COLORES.superficie, borderBottomLeftRadius: 6 },
  autor: { ...TIPOGRAFIA.ayuda, fontWeight: '700', color: COLORES.rojoMarca, marginBottom: 2 },
  texto: { ...TIPOGRAFIA.subtitulo, color: COLORES.texto, lineHeight: 21 },
  textoMio: { color: COLORES.blanco },
  hora: { ...TIPOGRAFIA.ayuda, fontSize: 11, color: COLORES.textoTenue, marginTop: 4, alignSelf: 'flex-end' },
  horaMia: { color: COLORES.blanco, opacity: 0.7 },

  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: ESPACIADO.s,
    paddingBottom: ESPACIADO.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORES.borde,
  },
  campo: {
    flex: 1,
    ...TIPOGRAFIA.input,
    color: COLORES.texto,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.campo,
    paddingHorizontal: ESPACIADO.m,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  enviar: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 12,
    paddingHorizontal: ESPACIADO.m,
    marginLeft: ESPACIADO.s,
  },
  enviarApagado: { opacity: 0.4 },
  enviarTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.blanco },
});
