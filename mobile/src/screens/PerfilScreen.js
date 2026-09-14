// Pantalla "Tu perfil".
//
// Existe porque la app pedía veinte preguntas y no devolvía nada: el resultado
// del test se guardaba como NULL y no había ninguna pantalla que le contara a
// la persona qué se dedujo de sus respuestas. Un cuestionario que no devuelve
// nada es un formulario, no una función.
//
// Muestra tres cosas, y la tercera es tan importante como las otras dos:
//   1. El tipo que sale de sus respuestas, con una descripción en castellano.
//   2. Los ejes, dibujados como posición entre dos polos (no como nota).
//   3. Qué preguntas NO se usan para agrupar, y por qué. Son datos sensibles
//      que la app pide —género, identidad—, y quien los da tiene derecho a
//      saber que no se usan para decidir con quién se sienta.
//
// Consume GET /api/usuarios/yo/perfil-personalidad, que devuelve 204 (→ null)
// mientras no haya test hecho.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import EncabezadoMarca from '../components/EncabezadoMarca';
import { api } from '../services/api';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from '../theme/tokens';

// Los ejes se dibujan con dos decimales del backend. Un eje sostenido por una
// sola pregunta se marca como tal en vez de presentarse como si fuera firme:
// decir "Expansivo" a alguien por una respuesta es inventar.
const MINIMO_PARA_AFIRMAR = 2;

function Eje({ eje }) {
  if (eje.valor === null) return null;
  const porcentaje = Math.round(eje.valor * 100);
  const flojo = eje.preguntas_usadas < MINIMO_PARA_AFIRMAR;

  return (
    <View style={estilos.eje}>
      <View style={estilos.ejeCabecera}>
        <Text style={estilos.ejeEtiqueta}>{eje.etiqueta}</Text>
        {flojo ? <Text style={estilos.ejeFlojo}>1 respuesta</Text> : null}
      </View>

      <View style={estilos.barra}>
        <View style={[estilos.barraRelleno, { width: `${porcentaje}%` }]} />
        {/* El punto marca dónde cae la persona; la barra no es una nota que
            se llena, es una posición entre dos extremos igual de válidos. */}
        <View style={[estilos.barraPunto, { left: `${porcentaje}%` }]} />
      </View>

      <View style={estilos.ejePolos}>
        <Text style={[estilos.polo, porcentaje < 50 && estilos.poloActivo]}>{eje.polo_bajo}</Text>
        <Text style={[estilos.polo, porcentaje >= 50 && estilos.poloActivo]}>{eje.polo_alto}</Text>
      </View>
    </View>
  );
}

export default function PerfilScreen({ onVolver, onRehacerTest }) {
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPerfil(await api.obtenerMiPerfilPersonalidad());
    } catch (e) {
      setError(e?.message || 'No pudimos cargar tu perfil.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <View style={estilos.pantalla}>
      <EncabezadoMarca titulo="Tu perfil" onVolver={onVolver} />

      {cargando ? (
        <ActivityIndicator color={COLORES.rojoMarca} style={estilos.centrado} />
      ) : (
        <ScrollView contentContainerStyle={estilos.cuerpo} showsVerticalScrollIndicator={false}>
          {error ? <Text style={estilos.error}>{error}</Text> : null}

          {!perfil && !error ? (
            // Sin test hecho no se muestra un perfil vacío: se ofrece hacerlo.
            <View style={estilos.vacio}>
              <Text style={estilos.vacioTitulo}>Todavía no tienes perfil</Text>
              <Text style={estilos.vacioTexto}>
                Son veinte preguntas y no hay respuestas correctas. Con ellas sabemos con quién
                encajas.
              </Text>
              {onRehacerTest ? (
                <TouchableOpacity style={estilos.boton} onPress={onRehacerTest} activeOpacity={0.85}>
                  <Text style={estilos.botonTexto}>Hacer el test</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {perfil ? (
            <>
              <Animated.View entering={FadeInDown.duration(400)} style={estilos.tarjetaTipo}>
                <Text style={estilos.tipoEtiqueta}>ERES</Text>
                <Text style={estilos.tipoTitulo}>{perfil.titulo}</Text>
                <Text style={estilos.tipoResumen}>{perfil.resumen}</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <Text style={estilos.seccion}>Cómo te leemos</Text>
                {perfil.ejes.map((eje) => (
                  <Eje key={eje.clave} eje={eje} />
                ))}
              </Animated.View>

              {perfil.no_se_usan?.length ? (
                <Animated.View entering={FadeInDown.delay(200).duration(400)} style={estilos.noUsadas}>
                  <Text style={estilos.seccion}>Lo que NO usamos para agruparte</Text>
                  {perfil.no_se_usan.map((n) => (
                    <Text key={n.pregunta} style={estilos.noUsada}>
                      · {n.motivo}
                    </Text>
                  ))}
                  <Text style={estilos.noUsadasPie}>
                    Te lo contamos porque son datos que te pedimos. Los grupos salen de tus
                    intereses y del resto de tus respuestas.
                  </Text>
                </Animated.View>
              ) : null}

              {onRehacerTest ? (
                <TouchableOpacity
                  style={estilos.botonSecundario}
                  onPress={onRehacerTest}
                  activeOpacity={0.85}
                >
                  <Text style={estilos.botonSecundarioTexto}>Volver a hacer el test</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  centrado: { marginTop: ESPACIADO.xl },
  cuerpo: { padding: ESPACIADO.m, paddingBottom: ESPACIADO.xl * 2 },
  error: { color: COLORES.error, textAlign: 'center', marginBottom: ESPACIADO.m },

  vacio: { alignItems: 'center', marginTop: ESPACIADO.xl, paddingHorizontal: ESPACIADO.m },
  vacioTitulo: { ...TIPOGRAFIA.titulo, color: COLORES.texto, textAlign: 'center' },
  vacioTexto: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.s,
  },

  tarjetaTipo: {
    backgroundColor: COLORES.negroMarca,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
    marginBottom: ESPACIADO.l,
  },
  tipoEtiqueta: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.blanco,
    opacity: 0.6,
    letterSpacing: 2,
    marginBottom: ESPACIADO.xs,
  },
  tipoTitulo: { ...TIPOGRAFIA.titulo, color: COLORES.blanco },
  tipoResumen: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.blanco,
    opacity: 0.85,
    marginTop: ESPACIADO.s,
    lineHeight: 22,
  },

  seccion: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoTenue,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: ESPACIADO.m,
  },

  eje: { marginBottom: ESPACIADO.l },
  ejeCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ejeEtiqueta: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  ejeFlojo: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue },
  barra: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORES.superficie,
    marginTop: ESPACIADO.s,
    justifyContent: 'center',
  },
  barraRelleno: { height: 6, borderRadius: 3, backgroundColor: COLORES.rojoMarca, opacity: 0.25 },
  barraPunto: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORES.rojoMarca,
    marginLeft: -7,
  },
  ejePolos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: ESPACIADO.s },
  polo: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue },
  poloActivo: { color: COLORES.texto, fontWeight: '700' },

  noUsadas: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginTop: ESPACIADO.s,
  },
  noUsada: { ...TIPOGRAFIA.subtitulo, color: COLORES.texto, marginBottom: ESPACIADO.xs },
  noUsadasPie: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: ESPACIADO.s },

  boton: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 14,
    paddingHorizontal: ESPACIADO.xl,
    marginTop: ESPACIADO.l,
  },
  botonTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
  botonSecundario: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.boton,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: ESPACIADO.xl,
  },
  botonSecundarioTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
});
