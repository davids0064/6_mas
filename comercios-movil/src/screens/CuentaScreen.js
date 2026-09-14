// Cuenta del comercio: cerrar sesión, enlaces legales y dar de baja el local.
//
// Misma razón que en la app de usuarios: la guideline 5.1.1(v) de la App Store
// exige que toda app que permita crear una cuenta permita borrarla desde
// dentro. Esta app permite registrar un comercio, así que la baja tiene que
// estar aquí. El endpoint DELETE /mi-comercio se agregó a la API PHP para esto.
//
// El texto de la confirmación dice algo que en la app de usuarios no aplicaba:
// que los eventos ya ocurridos se conservan. No es letra pequeña — es lo que
// hace el soft delete, y un local tiene derecho a saber que su histórico no
// desaparece de las valoraciones de la gente que estuvo allí.
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
import { api } from '../services/api';
import { URL_POLITICA_PRIVACIDAD, URL_TERMINOS } from '../config/env';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

export default function CuentaScreen({ onVolver, onSesionCerrada }) {
  const [comercio, setComercio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [dandoDeBaja, setDandoDeBaja] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    api
      .obtenerMiComercio()
      .then((datos) => vigente && setComercio(datos))
      // Un fallo aquí no bloquea la pantalla: aunque no se pueda mostrar el
      // perfil, cerrar sesión y darse de baja tienen que seguir disponibles.
      // Son justo las salidas que no pueden depender de que la API responda.
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

  const darDeBaja = async () => {
    setDandoDeBaja(true);
    setError(null);
    try {
      await api.eliminarMiComercio();
      onSesionCerrada();
    } catch (e) {
      setError(e.message);
      setDandoDeBaja(false);
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
          <>
            {comercio ? (
              <View style={styles.tarjeta}>
                <Text style={styles.etiqueta}>LOCAL</Text>
                <Text style={styles.dato}>{comercio.nombre}</Text>
                <View style={styles.divisor} />
                <Text style={styles.etiqueta}>CORREO</Text>
                <Text style={styles.dato}>{comercio.email}</Text>
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

            <TouchableOpacity
              style={styles.botonSecundario}
              onPress={cerrarSesion}
              activeOpacity={0.85}
            >
              <Text style={styles.botonSecundarioTexto}>Cerrar sesión</Text>
            </TouchableOpacity>

            <View style={styles.zonaPeligro}>
              <Text style={styles.zonaPeligroTitulo}>Dar de baja el local</Text>

              {confirmandoBaja ? (
                <>
                  <Text style={styles.zonaPeligroTexto}>
                    Tu local dejará de recibir grupos y de aparecer en Seis Más, y no podrás volver
                    a entrar con este correo. Los eventos que ya ocurrieron se conservan, porque
                    forman parte del historial de las personas que asistieron.
                  </Text>
                  {error ? <Text style={styles.error}>😕 {error}</Text> : null}
                  <TouchableOpacity
                    style={[styles.botonPeligro, dandoDeBaja && styles.deshabilitado]}
                    onPress={darDeBaja}
                    disabled={dandoDeBaja}
                    activeOpacity={0.85}
                  >
                    {dandoDeBaja ? (
                      <ActivityIndicator color={COLORES.blanco} />
                    ) : (
                      <Text style={styles.botonPeligroTexto}>Sí, dar de baja mi local</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setConfirmandoBaja(false)}
                    disabled={dandoDeBaja}
                  >
                    <Text style={styles.cancelar}>Mejor no, conservar mi local</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.zonaPeligroTexto}>
                    Puedes dar de baja tu local y tu cuenta cuando quieras, desde aquí.
                  </Text>
                  <TouchableOpacity
                    style={styles.botonPeligroSuave}
                    onPress={() => setConfirmandoBaja(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.botonPeligroSuaveTexto}>Dar de baja mi local</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  cuerpo: { padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
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
