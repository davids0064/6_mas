// Formulario de registro de Seis Más — primer paso del flujo antes del test
// de personalidad. Diseño según la guía de mobile/docs/REGISTRO_UX.md:
// paleta azul eléctrico + naranja de la marca, un ícono por campo,
// validación visual inmediata (por campo, al perder foco y al enviar) y
// animaciones suaves de entrada en cascada.
//
// Conecta con POST /api/usuarios (email, password, nombre, fecha_nacimiento,
// genero, telefono) y guarda los intereses elegidos vía
// PUT /api/usuarios/yo/intereses.
//
// El campo de edad pedía un número de años y NO lo enviaba: el formulario
// comprobaba la mayoría de edad y luego tiraba el dato, así que
// `fecha_nacimiento` quedaba en NULL para todo el mundo. Ahora se pide la
// fecha completa, que es la que el backend guarda y con la que vuelve a
// validar la mayoría de edad — un cliente no es sitio para hacer cumplir un
// requisito de edad, porque cualquiera puede llamar a la API sin pasar por
// aquí.
//
// Los intereses y los géneros NO están hardcodeados: se cargan desde
// GET /api/intereses y GET /api/generos, que leen las tablas paramétricas
// `pa_intereses` y `pa_generos` (ver db/schema.sql). Agregar, renombrar,
// reordenar o desactivar una opción es un cambio de datos en esas tablas —
// no requiere tocar ni recompilar esta pantalla.
import React, { useState, useEffect } from 'react';
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
import SelectorDesplegable from '../components/form/SelectorDesplegable';
import SelectorDesplegableMultiple from '../components/form/SelectorDesplegableMultiple';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// usuario@dominio.tld — exige al menos un punto en el dominio y un TLD de
// 2+ letras (rechaza "a@b", "a@b.", "a@b.c").
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Fecha en DD/MM/AAAA → Date, o null si no es una fecha real. Se escribe a
// mano en vez de usar un date picker nativo para no añadir otra dependencia
// con módulo nativo al MVP; el teclado numérico y el autoformato con "/"
// hacen que escribirla sea igual de rápido.
//
// La comprobación de que los componentes vuelven a salir iguales es lo que
// descarta fechas que el constructor de Date acepta desbordando (31/02 se
// convertiría en el 2 o 3 de marzo en vez de fallar).
export function interpretarFecha(texto) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) return null;
  const [, dia, mes, anio] = partes.map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }
  return fecha > new Date() ? null : fecha;
}

function edadEnAnios(fecha) {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
  return edad;
}

// Se construye a mano y no con toISOString(): ese convierte a UTC, y una
// fecha de nacimiento creada a medianoche local puede retroceder un día al
// cruzar el meridiano. El cumpleaños de alguien no depende de husos horarios.
export function aISO(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export default function RegistroScreen({ navigation, onRegistrado, onVolver }) {
  const [datos, setDatos] = useState({
    nombre: '',
    email: '',
    telefono: '',
    fechaNacimiento: '',
    genero: null,
    intereses: [],
    password: '',
    confirmacion: '',
  });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);

  // Catálogo de intereses: viene de pa_intereses vía GET /api/intereses, no
  // de un array fijo en el código.
  const [interesesDisponibles, setInteresesDisponibles] = useState([]);
  const [cargandoIntereses, setCargandoIntereses] = useState(true);

  // Catálogo de géneros: viene de pa_generos vía GET /api/generos. usuarios.
  // genero es TEXT libre (sin FK), así que se usa el `nombre` como id de
  // selección: es el mismo valor que se envía al registrar.
  const [generosDisponibles, setGenerosDisponibles] = useState([]);
  const [cargandoGeneros, setCargandoGeneros] = useState(true);

  useEffect(() => {
    api
      .obtenerIntereses()
      .then((catalogo) =>
        setInteresesDisponibles(
          (catalogo || []).map((i) => ({ id: i.id, etiqueta: i.nombre, icono: i.icono || '✨' }))
        )
      )
      .catch(() => setInteresesDisponibles([]))
      .finally(() => setCargandoIntereses(false));

    api
      .obtenerGeneros()
      .then((catalogo) =>
        setGenerosDisponibles(
          (catalogo || []).map((g) => ({ id: g.nombre, etiqueta: g.nombre, icono: g.icono || '👤' }))
        )
      )
      .catch(() => setGenerosDisponibles([]))
      .finally(() => setCargandoGeneros(false));
  }, []);

  const cambiar = (campo) => (valor) => {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    // Feedback inmediato: si el campo tenía error, se re-valida al escribir.
    if (errores[campo]) {
      setErrores((prev) => ({ ...prev, [campo]: validarCampo(campo, valor, { ...datos, [campo]: valor }) }));
    }
  };

  // Variante numérica: descarta todo lo que no sea dígito antes de guardar.
  // keyboardType solo restringe el teclado en pantalla del dispositivo; con
  // teclado físico o pegando texto entrarían letras, así que el filtro real
  // debe vivir aquí.
  const cambiarNumerico = (campo) => (valor) => cambiar(campo)(valor.replace(/[^\d]/g, ''));

  // Variante fecha: se teclean solo dígitos y las barras las pone la pantalla
  // en las posiciones 2 y 4. Así el campo se escribe de un tirón con el
  // teclado numérico, sin buscar el "/" ni poder colocarlo donde no va, y el
  // valor guardado siempre tiene la forma DD/MM/AAAA que espera
  // interpretarFecha.
  const cambiarFecha = (valor) => {
    const digitos = valor.replace(/[^\d]/g, '').slice(0, 8);
    const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4, 8)];
    cambiar('fechaNacimiento')(partes.filter((p) => p.length > 0).join('/'));
  };

  // Variante email: los correos no llevan espacios y son insensibles a
  // mayúsculas — se sanean al teclear para que "Juan @Gmail" no llegue ni al
  // estado ni al backend.
  const cambiarEmail = (valor) => cambiar('email')(valor.replace(/\s/g, '').toLowerCase());

  // Valida un campo al salir de él (blur), para dar feedback antes del
  // submit: borde rojo + mensaje si está mal, check verde si está bien.
  const validarAlSalir = (campo) => () => {
    setErrores((prev) => ({ ...prev, [campo]: validarCampo(campo, datos[campo], datos) }));
  };

  const validarCampo = (campo, valor, todos) => {
    switch (campo) {
      case 'nombre':
        return valor.trim().length >= 3 ? null : 'Cuéntanos tu nombre completo';
      case 'email':
        return REGEX_EMAIL.test(valor) ? null : 'Revisa tu correo, parece incompleto';
      case 'telefono':
        // Solo dígitos (cambiarNumerico ya filtra); 7 fijo o 10 celular.
        return /^\d{7,10}$/.test(valor) ? null : 'Ingresa un teléfono válido (solo números)';
      case 'fechaNacimiento': {
        const fecha = interpretarFecha(valor);
        if (!fecha) return 'Escribe la fecha como DD/MM/AAAA';
        const edad = edadEnAnios(fecha);
        if (edad < 18) return 'Debes ser mayor de 18 años';
        if (edad > 99) return 'Revisa el año, parece incorrecto';
        return null;
      }
      case 'genero':
        return valor ? null : 'Elige una opción';
      case 'intereses':
        return valor.length > 0 ? null : 'Elige al menos un interés para conectar mejor';
      case 'password':
        return valor.length >= 8 ? null : 'Mínimo 8 caracteres';
      case 'confirmacion':
        return valor === todos.password ? null : 'Las contraseñas no coinciden';
      default:
        return null;
    }
  };

  const validarTodo = () => {
    const nuevos = {};
    Object.keys(datos).forEach((campo) => {
      const error = validarCampo(campo, datos[campo], datos);
      if (error) nuevos[campo] = error;
    });
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  // Best-effort: los ids en datos.intereses ya son los ids reales de
  // pa_intereses (vienen del dropdown, no de un mapeo por nombre). Si falla,
  // el registro no se bloquea por esto.
  const guardarIntereses = async () => {
    if (datos.intereses.length === 0) return;
    try {
      // No lleva usuarioId: el registro ya dejó la sesión iniciada y el
      // backend saca de quién son los intereses a partir del token.
      await api.guardarMisIntereses(datos.intereses);
    } catch {
      // El registro no se bloquea por los intereses.
    }
  };

  const volver = () => {
    if (onVolver) {
      onVolver();
      return;
    }
    navigation?.goBack();
  };

  const registrar = async () => {
    setErrorGeneral(null);
    if (!validarTodo() || enviando) return;
    setEnviando(true);
    try {
      const usuario = await api.registrarUsuario({
        nombre: datos.nombre.trim(),
        email: datos.email.trim(),
        password: datos.password,
        // ISO (AAAA-MM-DD): el formato que espera la columna `date` de
        // Postgres, sin ambigüedad de zona horaria ni de orden día/mes.
        fecha_nacimiento: aISO(interpretarFecha(datos.fechaNacimiento)),
        genero: datos.genero,
        telefono: datos.telefono.trim(),
      });
      await guardarIntereses();
      if (onRegistrado) {
        onRegistrado(usuario);
        return;
      }
      navigation?.navigate('TestPersonalidad');
    } catch (err) {
      setErrorGeneral(err.message);
    } finally {
      setEnviando(false);
    }
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
            titulo="Crea tu cuenta"
            subtitulo="¡Estás a un paso de conectar con nuevas personas!"
            onVolver={volver}
          />
        </Animated.View>

        <View style={styles.formulario}>
          <CampoTexto
            etiqueta="Nombre completo"
            placeholder="¿Cómo te llamas?"
            valor={datos.nombre}
            onCambiar={cambiar('nombre')}
            error={errores.nombre}
            retrasoEntrada={80}
            autoCapitalize="words"
          />
          <CampoTexto
            etiqueta="Correo electrónico"
            placeholder="tu@correo.com"
            valor={datos.email}
            onCambiar={cambiarEmail}
            onBlur={validarAlSalir('email')}
            error={errores.email}
            retrasoEntrada={140}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <CampoTexto
            etiqueta="Teléfono"
            placeholder="3001234567"
            valor={datos.telefono}
            onCambiar={cambiarNumerico('telefono')}
            error={errores.telefono}
            retrasoEntrada={200}
            keyboardType="number-pad"
            maxLength={10}
          />
          <CampoTexto
            etiqueta="Fecha de nacimiento"
            placeholder="DD/MM/AAAA"
            valor={datos.fechaNacimiento}
            onCambiar={cambiarFecha}
            error={errores.fechaNacimiento}
            retrasoEntrada={260}
            keyboardType="number-pad"
            maxLength={10}
          />
          <SelectorDesplegable
            etiqueta="Género"
            placeholder={cargandoGeneros ? 'Cargando…' : 'Elige tu género'}
            opciones={generosDisponibles}
            seleccion={datos.genero}
            onCambiar={cambiar('genero')}
            error={errores.genero}
            retrasoEntrada={320}
          />
          <SelectorDesplegableMultiple

            etiqueta="¿Qué te gusta? Elige tus intereses"
            placeholder={cargandoIntereses ? 'Cargando intereses…' : 'Elige uno o más intereses'}
            opciones={interesesDisponibles}
            seleccion={datos.intereses}
            onCambiar={cambiar('intereses')}
            error={errores.intereses}
            retrasoEntrada={380}
          />
          <CampoTexto
            etiqueta="Contraseña"
            placeholder="Mínimo 8 caracteres"
            valor={datos.password}
            onCambiar={cambiar('password')}
            error={errores.password}
            retrasoEntrada={440}
            secureTextEntry
          />
          <CampoTexto
            etiqueta="Confirma tu contraseña"
            placeholder="Repite tu contraseña"
            valor={datos.confirmacion}
            onCambiar={cambiar('confirmacion')}
            error={errores.confirmacion}
            retrasoEntrada={500}
            secureTextEntry
          />

          {errorGeneral ? <Text style={styles.errorGeneral}>😕 {errorGeneral}</Text> : null}
          
          <Animated.View entering={FadeInDown.delay(560).duration(400)}>
            <TouchableOpacity
              style={[styles.cta, enviando && styles.ctaDeshabilitado]}
              onPress={registrar}
              disabled={enviando}
              activeOpacity={0.85}
            >
              {enviando ? (
                <ActivityIndicator color={COLORES.blanco} />
              ) : (
                <Text style={styles.ctaTexto}>Continuar al Test de Personalidad</Text>
              )}
            </TouchableOpacity>
          <Text style={styles.notaPie}>Tu información está segura con nosotros</Text>
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
  errorGeneral: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.error,
    textAlign: 'center',
    marginBottom: ESPACIADO.m,
  },
  // Mismo diseño que el CTA "Iniciar sesión" del Login: rojo oficial de
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
  notaPie: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.m,
  },
});
