// Login de Seis Más — se muestra después de la bienvenida y antes del
// registro. Diseño según mobile/docs/GUIA_DISENO.md, con la paleta
// muestreada de la imagen de inicio (azul del logo, naranja del "Más",
// fondo índigo del cielo). Pide usuario (correo) y contraseña, y ofrece
// dos salidas secundarias: recuperar contraseña y registrarse.
//
// Conecta con POST /api/usuarios/login. "Recuperar contraseña" muestra una
// confirmación local (el endpoint de recuperación aún no existe en el
// backend; queda documentado como pendiente).
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../services/api';
import CampoTexto from '../components/form/CampoTexto';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLogin, onIrARegistro }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [avisoRecuperacion, setAvisoRecuperacion] = useState(null);

  const validar = () => {
    const nuevos = {};
    if (!REGEX_EMAIL.test(email)) nuevos.email = 'Revisa tu correo, parece incompleto';
    if (password.length === 0) nuevos.password = 'Escribe tu contraseña';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const entrar = async () => {
    setErrorGeneral(null);
    setAvisoRecuperacion(null);
    if (!validar() || enviando) return;
    setEnviando(true);
    try {
      const usuario = await api.login(email.trim(), password);
      onLogin?.(usuario);
    } catch (err) {
      setErrorGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const recuperar = () => {
    setErrorGeneral(null);
    if (!REGEX_EMAIL.test(email)) {
      setErrores({ email: 'Escribe tu correo para enviarte las instrucciones' });
      setAvisoRecuperacion(null);
      return;
    }
    setErrores({});
    // Pendiente de backend: endpoint de recuperación de contraseña.
    setAvisoRecuperacion(`Si ${email.trim()} está registrado, te enviaremos instrucciones 📬`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Encabezado de marca: mismo estilo (logo centrado) en toda la app. */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <EncabezadoMarca
            titulo="¡Hola de nuevo!"
            subtitulo="Inicia sesión para volver con tu grupo"
          />
        </Animated.View>

        <View style={styles.formulario}>
          <CampoTexto
            etiqueta="Usuario (correo electrónico)"
            placeholder="tu@correo.com"
            valor={email}
            onCambiar={(v) => {
              // Sin espacios y en minúsculas, igual que en el registro: el
              // correo guardado siempre está normalizado.
              setEmail(v.replace(/\s/g, '').toLowerCase());
              if (errores.email) setErrores((prev) => ({ ...prev, email: null }));
            }}
            error={errores.email}
            retrasoEntrada={80}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <CampoTexto
            etiqueta="Contraseña"
            placeholder="Tu contraseña"
            valor={password}
            onCambiar={(v) => {
              setPassword(v);
              if (errores.password) setErrores((prev) => ({ ...prev, password: null }));
            }}
            error={errores.password}
            retrasoEntrada={140}
            secureTextEntry
          />

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <TouchableOpacity onPress={recuperar} disabled={enviando}>
              <Text style={styles.textoNuevo}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </Animated.View>

          {avisoRecuperacion ? <Text style={styles.aviso}>{avisoRecuperacion}</Text> : null}
          {errorGeneral ? <Text style={styles.errorGeneral}>😕 {errorGeneral}</Text> : null}

          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <TouchableOpacity
              style={[styles.cta, enviando && styles.ctaDeshabilitado]}
              onPress={entrar}
              disabled={enviando}
              activeOpacity={0.85}
            >
              {enviando ? (
                <ActivityIndicator color={COLORES.blanco} />
              ) : (
                <Text style={styles.ctaTexto}>Iniciar sesión</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(320).duration(400)} style={styles.piePagina}>
            <View style={styles.divisor} />
            <Text style={styles.textoNuevo}>¿Primera vez en Seis Más?</Text>
            <TouchableOpacity
              style={[styles.cta, styles.botonRegistro]}
              onPress={onIrARegistro}
              disabled={enviando}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaTexto}>Registrarse</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  scroll: { paddingBottom: ESPACIADO.xl },
  formulario: { padding: ESPACIADO.l },
  enlaceRecuperar: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.azulClaro,
    textAlign: 'right',
    marginBottom: ESPACIADO.m,
  },
  aviso: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.exito,
    textAlign: 'center',
    marginBottom: ESPACIADO.m,
  },
  errorGeneral: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.error,
    textAlign: 'center',
    marginBottom: ESPACIADO.m,
  },
  // Mismo diseño que el CTA "¡Empezar!" de la bienvenida: rojo oficial de
  // marca (#AD191A) con texto blanco.
  cta: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORES.rojoMarca,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
  // Mismo estilo que el CTA "Iniciar sesión" (styles.cta), solo que aquí no
  // ocupa el ancho completo (piePagina lo centra) y añade padding horizontal
  // para quedar en forma de píldora.
  botonRegistro: { paddingHorizontal: 40 },
});
