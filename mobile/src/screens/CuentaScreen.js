// Pantalla "Tu cuenta". Existe por una razón concreta: la guideline 5.1.1(v)
// de la App Store exige que toda app que permita crear una cuenta permita
// borrarla desde dentro de la app misma. Enterrar el borrado en un correo de
// soporte o en una web es rechazo directo, y hasta ahora la app no ofrecía
// ninguna de las dos cosas: ni cerrar sesión ni eliminar la cuenta.
//
// El borrado va detrás de una confirmación en la propia pantalla (no un
// Alert nativo) por dos motivos: el texto explica qué se pierde, que es lo
// que Apple pide que quede claro, y un componente que se pinta se puede
// probar; un Alert del sistema no.
//
// El backend hace soft delete (DELETE /api/usuarios/yo marca `deleted_at`) y
// a partir de ahí el usuario deja de existir para login, matching y grupos.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../services/api';
import { URL_POLITICA_PRIVACIDAD, URL_TERMINOS } from '../config/env';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS, COLUMNA } from '../theme/tokens';

export default function CuentaScreen({ onVolver, onSesionCerrada }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    api
      .obtenerMiPerfil()
      .then((perfil) => vigente && setUsuario(perfil))
      // Un fallo acá no bloquea la pantalla: aunque no se pueda mostrar el
      // perfil, cerrar sesión y eliminar la cuenta tienen que seguir
      // disponibles. Son justamente las salidas que no pueden depender de que
      // el backend responda bien.
      .catch(() => {})
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  const cerrarSesion = () => {
    api.cerrarSesion();
    onSesionCerrada();
  };

  const eliminarCuenta = async () => {
    setBorrando(true);
    setError(null);
    try {
      await api.eliminarMiCuenta();
      onSesionCerrada();
    } catch (e) {
      setError(e.message);
      setBorrando(false);
    }
  };

  const abrir = (url) => Linking.openURL(url).catch(() => setError('No se pudo abrir el enlace.'));

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo="Tu cuenta" onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : (
          <Animated.View entering={FadeInDown.duration(400)}>
            {usuario ? (
              <View style={styles.tarjeta}>
                <Text style={styles.etiqueta}>NOMBRE</Text>
                <Text style={styles.dato}>{usuario.nombre}</Text>
                <View style={styles.divisor} />
                <Text style={styles.etiqueta}>CORREO</Text>
                <Text style={styles.dato}>{usuario.email}</Text>
              </View>
            ) : null}

            <View style={styles.tarjeta}>
              <TouchableOpacity onPress={() => abrir(URL_POLITICA_PRIVACIDAD)}>
                <Text style={styles.enlace}>Política de privacidad</Text>
              </TouchableOpacity>
              <View style={styles.divisor} />
              <TouchableOpacity onPress={() => abrir(URL_TERMINOS)}>
                <Text style={styles.enlace}>Términos de uso</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.botonSecundario} onPress={cerrarSesion} activeOpacity={0.85}>
              <Text style={styles.botonSecundarioTexto}>Cerrar sesión</Text>
            </TouchableOpacity>

            {/* Zona de borrado. Separada del resto y en rojo de error (no el
                rojo de marca, que aquí invitaría a tocarlo) porque es la única
                acción irreversible de la app. */}
            <View style={styles.zonaPeligro}>
              <Text style={styles.zonaPeligroTitulo}>Eliminar tu cuenta</Text>

              {confirmandoBorrado ? (
                <>
                  <Text style={styles.zonaPeligroTexto}>
                    Se borrarán tu perfil, tu test de personalidad y tus valoraciones, y saldrás
                    del grupo en el que estés. No se puede deshacer: para volver a Seis Más
                    tendrías que registrarte otra vez desde cero.
                  </Text>
                  {error ? <Text style={styles.error}>😕 {error}</Text> : null}
                  <TouchableOpacity
                    style={[styles.botonPeligro, borrando && styles.deshabilitado]}
                    onPress={eliminarCuenta}
                    disabled={borrando}
                    activeOpacity={0.85}
                  >
                    {borrando ? (
                      <ActivityIndicator color={COLORES.blanco} />
                    ) : (
                      <Text style={styles.botonPeligroTexto}>Sí, eliminar mi cuenta</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setConfirmandoBorrado(false)}
                    disabled={borrando}
                  >
                    <Text style={styles.cancelar}>Mejor no, conservar mi cuenta</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.zonaPeligroTexto}>
                    Puedes eliminar tu cuenta y todos tus datos cuando quieras, desde aquí.
                  </Text>
                  <TouchableOpacity
                    style={styles.botonPeligroSuave}
                    onPress={() => setConfirmandoBorrado(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.botonPeligroSuaveTexto}>Eliminar mi cuenta</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  cuerpo: {
    ...COLUMNA, padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
  centrado: { marginTop: ESPACIADO.xl },
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
    marginBottom: ESPACIADO.m,
  },
  etiqueta: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, letterSpacing: 1 },
  dato: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginTop: ESPACIADO.xs },
  divisor: { height: 1, backgroundColor: COLORES.borde, marginVertical: ESPACIADO.m },
  enlace: { ...TIPOGRAFIA.etiqueta, color: COLORES.azul },
  botonSecundario: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: ESPACIADO.xl,
  },
  botonSecundarioTexto: { ...TIPOGRAFIA.boton, color: COLORES.texto },
  zonaPeligro: {
    borderWidth: 1,
    borderColor: COLORES.error,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
  },
  zonaPeligroTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.error, marginBottom: ESPACIADO.s },
  zonaPeligroTexto: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginBottom: ESPACIADO.m,
    lineHeight: 19,
  },
  botonPeligro: {
    backgroundColor: COLORES.error,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botonPeligroTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
  botonPeligroSuave: {
    borderWidth: 1.5,
    borderColor: COLORES.error,
    borderRadius: RADIOS.boton,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonPeligroSuaveTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.error },
  cancelar: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.m,
  },
  deshabilitado: { opacity: 0.7 },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginBottom: ESPACIADO.m },
});
