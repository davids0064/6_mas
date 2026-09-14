// Alta de un comercio. Conecta con POST /auth/registro.
//
// Solo pide lo que la API exige (nombre, correo, contraseña) más los datos sin
// los cuales el local no puede recibir a nadie: ciudad y dirección, que son lo
// que el matching usa para decidir qué grupos le corresponden y lo que la app
// de usuarios muestra en la tarjeta del plan. Todo lo demás — descripción,
// horario, categoría, NIT — se completa después desde "Mi comercio", y el
// resumen lo va recordando en la lista de pendientes.
//
// Registrarse no es lo mismo que estar listo para recibir grupos: para eso
// hacen falta un plan y una franja de disponibilidad activos. El resumen lo
// dice en cuanto se entra.
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

export default function RegistroScreen({ onRegistrado, onVolver }) {
  const [datos, setDatos] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmacion: '',
    ciudad: '',
    direccion: '',
    telefono: '',
  });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);

  const cambiar = (campo) => (valor) => {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: null }));
  };

  const validarCampo = (campo, valor, todos) => {
    switch (campo) {
      case 'nombre':
        return valor.trim().length >= 3 ? null : 'Escribe el nombre de tu local';
      case 'email':
        return REGEX_EMAIL.test(valor) ? null : 'Revisa el correo, parece incompleto';
      case 'password':
        // El mismo mínimo que exige la API (AuthController): que el mensaje
        // salga aquí evita un viaje de red para decir algo que ya se sabe.
        return valor.length >= 8 ? null : 'Mínimo 8 caracteres';
      case 'confirmacion':
        return valor === todos.password ? null : 'Las contraseñas no coinciden';
      case 'ciudad':
        return valor.trim().length >= 3 ? null : 'La ciudad decide qué grupos te llegan';
      case 'direccion':
        return valor.trim().length >= 5 ? null : 'Los grupos necesitan saber dónde encontrarte';
      default:
        return null;
    }
  };

  const validarAlSalir = (campo) => () =>
    setErrores((prev) => ({ ...prev, [campo]: validarCampo(campo, datos[campo], datos) }));

  const registrar = async () => {
    setErrorGeneral(null);
    const nuevos = {};
    Object.keys(datos).forEach((campo) => {
      const error = validarCampo(campo, datos[campo], datos);
      if (error) nuevos[campo] = error;
    });
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || enviando) return;

    setEnviando(true);
    try {
      await api.registrar({
        nombre: datos.nombre.trim(),
        email: datos.email.trim(),
        password: datos.password,
        ciudad: datos.ciudad.trim(),
        direccion: datos.direccion.trim(),
        telefono: datos.telefono.trim() || null,
      });
      onRegistrado();
    } catch (e) {
      setErrorGeneral(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <EncabezadoMarca titulo="Registra tu local" onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.formulario}>
          <CampoTexto
            icono="🏠"
            etiqueta="Nombre del local"
            placeholder="Café de la Esquina"
            valor={datos.nombre}
            onCambiar={cambiar('nombre')}
            onBlur={validarAlSalir('nombre')}
            error={errores.nombre}
          />
          <CampoTexto
            icono="✉️"
            etiqueta="Correo"
            placeholder="correo@tulocal.com"
            valor={datos.email}
            onCambiar={(v) => cambiar('email')(v.replace(/\s/g, '').toLowerCase())}
            onBlur={validarAlSalir('email')}
            error={errores.email}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <CampoTexto
            icono="📍"
            etiqueta="Ciudad"
            placeholder="Pereira"
            valor={datos.ciudad}
            onCambiar={cambiar('ciudad')}
            onBlur={validarAlSalir('ciudad')}
            error={errores.ciudad}
          />
          <CampoTexto
            icono="🗺️"
            etiqueta="Dirección"
            placeholder="Cra. 14 #12-34"
            valor={datos.direccion}
            onCambiar={cambiar('direccion')}
            onBlur={validarAlSalir('direccion')}
            error={errores.direccion}
          />
          <CampoTexto
            icono="📞"
            etiqueta="Teléfono (opcional)"
            placeholder="3001234567"
            valor={datos.telefono}
            onCambiar={(v) => cambiar('telefono')(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            maxLength={10}
          />
          <CampoTexto
            icono="🔒"
            etiqueta="Contraseña"
            placeholder="Mínimo 8 caracteres"
            valor={datos.password}
            onCambiar={cambiar('password')}
            onBlur={validarAlSalir('password')}
            error={errores.password}
            secureTextEntry
          />
          <CampoTexto
            icono="🔒"
            etiqueta="Repite la contraseña"
            placeholder="La misma de arriba"
            valor={datos.confirmacion}
            onCambiar={cambiar('confirmacion')}
            onBlur={validarAlSalir('confirmacion')}
            error={errores.confirmacion}
            secureTextEntry
          />

          {errorGeneral ? <Text style={styles.errorGeneral}>😕 {errorGeneral}</Text> : null}

          <TouchableOpacity
            style={[styles.cta, enviando && styles.ctaDeshabilitado]}
            onPress={registrar}
            disabled={enviando}
            activeOpacity={0.85}
          >
            {enviando ? (
              <ActivityIndicator color={COLORES.blanco} />
            ) : (
              <Text style={styles.ctaTexto}>Crear cuenta</Text>
            )}
          </TouchableOpacity>
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
});
