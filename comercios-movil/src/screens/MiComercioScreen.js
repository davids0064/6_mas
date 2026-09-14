// Perfil del local. Consume GET y PUT /mi-comercio.
//
// La API acepta envíos parciales (COALESCE por campo), así que solo se manda
// lo que cambió. El correo no está: es la credencial de acceso y cambiarlo
// necesita su propio flujo con verificación, que no existe todavía.
//
// La dirección y la ciudad se muestran primero porque son los dos campos que
// tienen consecuencias fuera de esta pantalla: la ciudad decide qué grupos
// compiten por el local y la dirección es lo que la app de usuarios enseña en
// la tarjeta del plan.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import CampoTexto from '../components/form/CampoTexto';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// Los campos editables, en el orden en que se pintan. Tenerlos como datos y no
// como JSX repetido siete veces mantiene la pantalla legible y hace que agregar
// un campo sea una línea.
const CAMPOS = [
  { clave: 'nombre', icono: '🏠', etiqueta: 'Nombre del local' },
  { clave: 'ciudad', icono: '📍', etiqueta: 'Ciudad' },
  { clave: 'direccion', icono: '🗺️', etiqueta: 'Dirección' },
  { clave: 'telefono', icono: '📞', etiqueta: 'Teléfono', keyboardType: 'phone-pad' },
  { clave: 'categoria', icono: '🏷️', etiqueta: 'Categoría', placeholder: 'Café, bar, restaurante…' },
  { clave: 'horario', icono: '🕐', etiqueta: 'Horario', placeholder: 'Lun a sáb, 4 p. m. a 11 p. m.' },
  { clave: 'nit', icono: '🧾', etiqueta: 'NIT' },
  { clave: 'sitio_web', icono: '🌐', etiqueta: 'Sitio web', autoCapitalize: 'none' },
  {
    clave: 'descripcion',
    icono: '✏️',
    etiqueta: 'Descripción',
    placeholder: 'De qué se trata tu lugar',
    multiline: true,
  },
];

export default function MiComercioScreen({ onVolver }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const comercio = await api.obtenerMiComercio();
      // Los nulos de la base se vuelven cadena vacía: un TextInput con value
      // null pasa a no controlado y React avisa por consola en cada pulsación.
      setDatos(
        Object.fromEntries(CAMPOS.map(({ clave }) => [clave, comercio[clave] ?? ''])),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (clave) => (valor) => {
    setDatos((prev) => ({ ...prev, [clave]: valor }));
    setGuardado(false);
  };

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await api.actualizarMiComercio(datos);
      setGuardado(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <EncabezadoMarca titulo="Mi comercio" onVolver={onVolver} />

      {cargando ? (
        <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
      ) : (
        <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
          {CAMPOS.map((campo) => (
            <CampoTexto
              key={campo.clave}
              icono={campo.icono}
              etiqueta={campo.etiqueta}
              placeholder={campo.placeholder}
              valor={datos?.[campo.clave] ?? ''}
              onCambiar={cambiar(campo.clave)}
              keyboardType={campo.keyboardType}
              autoCapitalize={campo.autoCapitalize}
              multiline={campo.multiline}
            />
          ))}

          {error ? <Text style={styles.error}>😕 {error}</Text> : null}
          {guardado ? <Text style={styles.guardado}>✓ Guardado</Text> : null}

          <TouchableOpacity
            style={[styles.cta, guardando && styles.ctaDeshabilitado]}
            onPress={guardar}
            disabled={guardando}
            activeOpacity={0.85}
          >
            {guardando ? (
              <ActivityIndicator color={COLORES.blanco} />
            ) : (
              <Text style={styles.ctaTexto}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  cuerpo: { padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
  centrado: { marginTop: ESPACIADO.xl },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginBottom: ESPACIADO.m },
  guardado: { ...TIPOGRAFIA.ayuda, color: COLORES.exito, marginBottom: ESPACIADO.m },
  cta: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDeshabilitado: { opacity: 0.7 },
  ctaTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
});
