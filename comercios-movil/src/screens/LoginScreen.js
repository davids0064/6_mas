// Entrada del comercio. Conecta con POST /auth/login de la API PHP.
//
// A diferencia de la app de usuarios, aquí no hay pantalla de bienvenida con
// animación: quien abre esto es el dueño de un local a las siete de la tarde
// queriendo saber cuánta gente le llega. La app arranca directamente en lo
// que sirve.
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import CampoTexto from '../components/form/CampoTexto';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export default function LoginScreen({ onEntrar, onIrARegistro }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);

  const validar = () => {
    const nuevos = {};
    if (!REGEX_EMAIL.test(email)) nuevos.email = 'Revisa el correo, parece incompleto';
    if (password.length === 0) nuevos.password = 'Escribe tu contraseña';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const entrar = async () => {
    setErrorGeneral(null);
    if (!validar() || enviando) return;
    setEnviando(true);
    try {
      await api.entrar(email.trim(), password);
      onEntrar();
    } catch (e) {
      setErrorGeneral(e.mensaje || e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <EncabezadoMarca titulo="Comercios" subtitulo="Gestiona los grupos que recibes" />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.formulario}>
          <CampoTexto
            icono="✉️"
            etiqueta="Correo"
            placeholder="correo@tulocal.com"
            valor={email}
            onCambiar={(v) => {
              setEmail(v.replace(/\s/g, '').toLowerCase());
              if (errores.email) setErrores((prev) => ({ ...prev, email: null }));
            }}
            error={errores.email}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <CampoTexto
            icono="🔒"
            etiqueta="Contraseña"
            placeholder="Tu contraseña"
            valor={password}
            onCambiar={(v) => {
              setPassword(v);
              if (errores.password) setErrores((prev) => ({ ...prev, password: null }));
            }}
            error={errores.password}
            secureTextEntry
          />

          {errorGeneral ? <Text style={styles.errorGeneral}>😕 {errorGeneral}</Text> : null}

          <TouchableOpacity
            style={[styles.cta, enviando && styles.ctaDeshabilitado]}
            onPress={entrar}
            disabled={enviando}
            activeOpacity={0.85}
          >
            {enviando ? (
              <ActivityIndicator color={COLORES.blanco} />
            ) : (
              <Text style={styles.ctaTexto}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.piePagina}>
            <View style={styles.divisor} />
            <Text style={styles.textoNuevo}>¿Tu local todavía no está en Seis Más?</Text>
            <TouchableOpacity
              style={[styles.cta, styles.botonRegistro]}
              onPress={onIrARegistro}
              disabled={enviando}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaTexto}>Registrar mi comercio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  scroll: { paddingBottom: ESPACIADO.xl },
  formulario: { padding: ESPACIADO.l },
  errorGeneral: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.error,
    textAlign: 'center',
    marginBottom: ESPACIADO.m,
  },
  cta: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDeshabilitado: { opacity: 0.7 },
  ctaTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
  piePagina: { alignItems: 'center', marginTop: ESPACIADO.l },
  divisor: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: COLORES.borde,
    marginBottom: ESPACIADO.l,
  },
  textoNuevo: { ...TIPOGRAFIA.subtitulo, color: COLORES.textoSuave, marginBottom: ESPACIADO.m },
  botonRegistro: { paddingHorizontal: 32 },
});
