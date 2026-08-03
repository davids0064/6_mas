// Test de Personalidad — quiz dinámico según la guía de
// mobile/docs/GUIA_DISENO.md: una pregunta por pantalla sobre fondo azul
// profundo, barra de progreso dorada (el resplandor de la imagen de marca), opciones
// como tarjetas con feedback visual inmediato (borde verde + check al
// elegir) y avance automático a la siguiente pregunta.
//
// Las preguntas siguen siendo contenido placeholder del producto (el
// cuestionario definitivo se definirá con el equipo); las respuestas viajan
// como jsonb al backend (POST /api/usuarios/:id/test-personalidad), igual
// que antes, para no acoplar el esquema a la forma exacta del cuestionario.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInRight, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { api } from '../services/api';
import { sesion } from '../services/sesion';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// Cuestionario oficial del producto. Las respuestas viajan como jsonb
// ({ id_pregunta: valor }), así que agregar/quitar preguntas aquí no
// requiere cambios de esquema en el backend.
const PREGUNTAS = [
  {
    id: 'edad',
    texto: '¿Cuál es tu edad?',
    opciones: [
      { valor: '18_24', texto: '18 a 24 años' },
      { valor: '25_31', texto: '25 a 31 años' },
      { valor: '32_44', texto: '32 a 44 años' },
      { valor: '45_54', texto: '45 a 54 años' },
      { valor: '55_mas', texto: 'Más de 55' },
    ],
  },
  {
    id: 'genero_biologico',
    texto: '¿Cuál es tu género biológico?',
    opciones: [
      { valor: 'masculino', texto: 'Masculino' },
      { valor: 'femenino', texto: 'Femenino' },
    ],
  },
  {
    id: 'identidad',
    texto: 'Te asumes como:',
    opciones: [
      { valor: 'hetero', texto: 'Hetero' },
      { valor: 'bisexual', texto: 'Bisexual' },
      { valor: 'diverso', texto: 'Diverso LGBTQ+' },
      { valor: 'no_binario', texto: 'No binario' },
    ],
  },
  {
    id: 'temperamento',
    texto: '¿Cuál de estas opciones te describiría mejor?',
    opciones: [
      { valor: 'introvertido', texto: 'Introvertido' },
      { valor: 'extrovertido', texto: 'Extrovertido' },
      { valor: 'ambivertido', texto: 'Ambivertido' },
      { valor: 'todas', texto: 'Todas las anteriores' },
    ],
  },
  {
    id: 'localidad',
    texto: '¿En qué localidad vives?',
    opciones: [
      { valor: 'pereira', texto: 'Pereira' },
      { valor: 'dosquebradas', texto: 'Dosquebradas' },
      { valor: 'santa_rosa', texto: 'Santa Rosa' },
      { valor: 'manizales', texto: 'Manizales' },
    ],
  },
  {
    id: 'actividades',
    texto: '¿Qué tipo de actividades te gustan más?',
    opciones: [
      { valor: 'deportivas', texto: 'Deportivas' },
      { valor: 'sociales', texto: 'Sociales' },
      { valor: 'profesionales', texto: 'Profesionales' },
    ],
  },
  {
    id: 'estudios',
    texto: '¿Cuál es tu nivel de estudios?',
    opciones: [
      { valor: 'preescolar', texto: 'Preescolar' },
      { valor: 'bachiller', texto: 'Bachiller' },
      { valor: 'profesional', texto: 'Profesional' },
      { valor: 'maestria', texto: 'Maestría' },
      { valor: 'doctorado', texto: 'Doctorado' },
    ],
  },
  {
    id: 'estado_civil',
    texto: '¿Cuál es tu estado civil?',
    opciones: [
      { valor: 'soltero_feliz', texto: 'Soltero feliz' },
      { valor: 'soltero_infeliz', texto: 'Soltero infeliz' },
      { valor: 'casado', texto: 'Casado' },
      { valor: 'divorciado', texto: 'Divorciado' },
      { valor: 'viudo', texto: 'Viudo' },
    ],
  },
  {
    id: 'planes',
    texto: '¿Tus planes están generalmente más relacionados con…?',
    opciones: [
      { valor: 'clubes_deportivos', texto: 'Clubes deportivos' },
      { valor: 'fiestas', texto: 'Fiestas' },
      { valor: 'hogarenos', texto: 'Planes hogareños' },
      { valor: 'club_lectura', texto: 'Club de lectura' },
      { valor: 'deportivos', texto: 'Planes deportivos' },
      { valor: 'sin_planes', texto: 'No tengo planes' },
    ],
  },
  {
    id: 'decisiones',
    texto: 'Tus decisiones las clasificarías como:',
    opciones: [
      { valor: 'impulsivas', texto: 'Impulsivas' },
      { valor: 'logicas', texto: 'Lógicas' },
      { valor: 'flexibles', texto: 'Flexibles' },
      { valor: 'influenciables', texto: 'Influenciables' },
    ],
  },
  {
    id: 'ideas',
    texto: 'Tus ideas, pensamientos y opiniones las clasificarías como:',
    opciones: [
      { valor: 'innovadoras', texto: 'Innovadoras' },
      { valor: 'tradicionales', texto: 'Tradicionales' },
      { valor: 'criticas', texto: 'Críticas' },
      { valor: 'irrelevantes', texto: 'Irrelevantes' },
    ],
  },
  {
    id: 'plan_musical',
    texto: '¿Cuál sería tu mejor plan musical?',
    opciones: [
      { valor: 'parranda', texto: 'Parranda' },
      { valor: 'clasica', texto: 'Clásica' },
      { valor: 'rock', texto: 'Rock' },
      { valor: 'crossover', texto: 'Crossover' },
      { valor: 'popular', texto: 'Popular' },
      { valor: 'pop', texto: 'Pop' },
      { valor: 'metal', texto: 'Metal' },
      { valor: 'regueton', texto: 'Reguetón' },
    ],
  },
  {
    id: 'animal_favorito',
    texto: 'Tu animal favorito es de:',
    opciones: [
      { valor: 'agua', texto: 'Agua' },
      { valor: 'tierra', texto: 'Tierra' },
      { valor: 'aire', texto: 'Aire' },
    ],
  },
  {
    id: 'zodiaco',
    texto: '¿Crees que influyen los signos zodiacales en la personalidad?',
    opciones: [
      { valor: 'si', texto: 'Sí' },
      { valor: 'no', texto: 'No' },
      { valor: 'a_veces', texto: 'A veces' },
      { valor: 'no_creo_astrologia', texto: 'No creo en la astrología' },
    ],
  },
  {
    id: 'exploracion',
    texto: 'En términos de exploración y experiencias te consideras:',
    opciones: [
      { valor: 'aventurero', texto: 'Aventurero e inquieto' },
      { valor: 'tranquilo', texto: 'Muy tranquilo' },
      { valor: 'territorial', texto: 'Estable territorial' },
    ],
  },
  {
    id: 'antiestres',
    texto: 'Si quisieras salirte de la rutina y liberarte del estrés, ¿cuáles serían tus métodos?',
    opciones: [
      { valor: 'fiesta', texto: 'Salir de fiesta' },
      { valor: 'amistades', texto: 'Compartir con amistades' },
      { valor: 'actividad_fisica', texto: 'Actividad física' },
      { valor: 'meditar', texto: 'Meditar' },
      { valor: 'dormir', texto: 'Dormir' },
      { valor: 'naturaleza', texto: 'Conexión natural' },
      { valor: 'psicoactivos', texto: 'Usar psicoactivos' },
    ],
  },
  {
    id: 'relacionamiento',
    texto: 'En términos de relacionamiento con otros te consideras…:',
    opciones: [
      { valor: 'seguidor', texto: 'Seguidor' },
      { valor: 'lider', texto: 'Líder' },
      { valor: 'indiferente', texto: 'Indiferente' },
    ],
  },
  {
    id: 'informacion',
    texto: '¿Qué tipo de información te gustaría conocer y recibir de otras personas?',
    opciones: [
      { valor: 'misticos', texto: 'Temas místicos' },
      { valor: 'culturales', texto: 'Culturales' },
      { valor: 'negocios', texto: 'Negocios' },
      { valor: 'viajes', texto: 'Viajes' },
      { valor: 'comidas', texto: 'Comidas' },
      { valor: 'politicos', texto: 'Políticos' },
    ],
  },
  {
    id: 'disposicion',
    texto: '¿Estarías con la disposición de participar en planes con otras personas, aún si no son absolutamente compatibles con tus gustos o inclinaciones?',
    opciones: [
      { valor: 'si', texto: 'Sí' },
      { valor: 'no', texto: 'Definitivamente no' },
    ],
  },
  {
    id: 'valores',
    texto: '¿Crees en la libertad, los derechos humanos, la democracia y el respeto por el otro, aunque no piense igual a ti?',
    opciones: [
      { valor: 'si', texto: 'Sí' },
      { valor: 'no', texto: 'Definitivamente no' },
    ],
  },
];

const RETRASO_AVANCE_MS = 450; // tiempo para "saborear" el feedback verde

function BarraProgreso({ progreso }) {
  const estilo = useAnimatedStyle(() => ({ width: `${progreso.value * 100}%` }));
  return (
    <View style={styles.progresoFondo}>
      <Animated.View style={[styles.progresoRelleno, estilo]} />
    </View>
  );
}

export default function TestPersonalidadScreen({ navigation, onTerminado }) {
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState({});
  const [seleccion, setSeleccion] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const progreso = useSharedValue(0);

  const pregunta = PREGUNTAS[indice];
  const esUltima = indice === PREGUNTAS.length - 1;

  const responder = (valor) => {
    if (seleccion) return; // evita doble tap durante el feedback
    setSeleccion(valor);
    const nuevas = { ...respuestas, [pregunta.id]: valor };
    setRespuestas(nuevas);
    progreso.value = withTiming((indice + 1) / PREGUNTAS.length, { duration: 350 });

    setTimeout(() => {
      if (esUltima) {
        enviar(nuevas);
      } else {
        setIndice(indice + 1);
        setSeleccion(null);
      }
    }, RETRASO_AVANCE_MS);
  };

  const enviar = async (todas) => {
    setEnviando(true);
    setError(null);
    try {
      // Sin sesión (p.ej. abriendo esta pantalla directo en desarrollo, sin
      // pasar por el registro) no se llama al backend: respondería 401. Se
      // continúa el flujo sin persistir.
      if (sesion.haySesion()) {
        await api.enviarTestPersonalidad(todas, null);
      } else {
        console.warn('[TestPersonalidad] sin sesión: respuestas no persistidas');
      }
      if (onTerminado) {
        onTerminado();
        return;
      }
      navigation?.navigate('Grupos');
    } catch (err) {
      setError(err.message);
      setSeleccion(null);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.pantalla}>
      {/* Encabezado de marca: mismo estilo (logo centrado) en toda la app. */}
      <EncabezadoMarca titulo="Test de Personalidad" />

      {/* Contador + barra de progreso dorada. */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.encabezado}>
        <Text style={styles.contador}>
          Pregunta {indice + 1} de {PREGUNTAS.length}
        </Text>
        <BarraProgreso progreso={progreso} />
        <Text style={styles.motivacion}>Cada respuesta afina tu grupo ideal ✨</Text>
      </Animated.View>

      {/* key={pregunta.id} remonta el bloque en cada pregunta para que la
          animación de entrada se repita (transición tipo quiz). El ScrollView
          permite ver todas las opciones en preguntas largas (6-8 opciones). */}
      <Animated.View key={pregunta.id} entering={FadeInRight.duration(350)} style={styles.cuerpo}>
        <ScrollView contentContainerStyle={styles.cuerpoScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.pregunta}>{pregunta.texto}</Text>

          {pregunta.opciones.map((opcion) => {
            const elegida = seleccion === opcion.valor;
            return (
              <TouchableOpacity
                key={opcion.valor}
                style={[styles.opcion, elegida && styles.opcionElegida]}
                onPress={() => responder(opcion.valor)}
                activeOpacity={0.8}
                disabled={enviando}
              >
                {opcion.icono ? <Text style={styles.opcionIcono}>{opcion.icono}</Text> : null}
                <Text style={[styles.opcionTexto, elegida && styles.opcionTextoElegido]}>
                  {opcion.texto}
                </Text>
                {elegida && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          {enviando && <ActivityIndicator color={COLORES.dorado} style={{ marginTop: ESPACIADO.l }} />}
          {error ? <Text style={styles.error}>😕 {error}</Text> : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  encabezado: { paddingTop: ESPACIADO.l, paddingHorizontal: ESPACIADO.l },
  contador: { ...TIPOGRAFIA.etiqueta, color: COLORES.textoSuave, marginBottom: ESPACIADO.s },
  progresoFondo: {
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORES.superficie,
    overflow: 'hidden',
  },
  progresoRelleno: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: COLORES.dorado,
  },
  motivacion: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, marginTop: ESPACIADO.s },
  cuerpo: { flex: 1 },
  cuerpoScroll: { padding: ESPACIADO.l, paddingTop: ESPACIADO.xl, paddingBottom: ESPACIADO.xl },
  pregunta: { ...TIPOGRAFIA.titulo, color: COLORES.texto, marginBottom: ESPACIADO.l },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.superficie,
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.campo,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.m,
  },
  opcionElegida: { borderColor: COLORES.exito, backgroundColor: '#EEF6E1' },
  opcionIcono: { fontSize: 24, marginRight: ESPACIADO.m },
  opcionTexto: { ...TIPOGRAFIA.input, color: COLORES.texto, flex: 1 },
  opcionTextoElegido: { fontWeight: '600' },
  check: { color: COLORES.exito, fontSize: 20, fontWeight: '800' },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, textAlign: 'center', marginTop: ESPACIADO.m },
});
