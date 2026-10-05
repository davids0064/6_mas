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
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, COLUMNA } from '../theme/tokens';

// Los ejes se dibujan con dos decimales del backend. Un eje sostenido por una
// sola pregunta se marca como tal en vez de presentarse como si fuera firme:
// decir "Expansivo" a alguien por una respuesta es inventar.
const MINIMO_PARA_AFIRMAR = 2;

function Eje({ eje, indice }) {
  if (eje.valor === null) return null;
  const porcentaje = Math.round(eje.valor * 100);
  const flojo = eje.preguntas_usadas < MINIMO_PARA_AFIRMAR;

  // Qué tan marcada está la inclinación. Sirve para no decir lo mismo de quien
  // está en el 95% que de quien está en el 55%: el segundo no está en un
  // extremo, está en medio, y presentarlo igual sería inventar.
  const distanciaDelCentro = Math.abs(porcentaje - 50);
  const enMedio = distanciaDelCentro < 15;
  const haciaAlto = porcentaje >= 50;
  const matiz = enMedio
    ? 'Te mueves entre los dos'
    : distanciaDelCentro >= 35
      ? `Muy ${(haciaAlto ? eje.polo_alto : eje.polo_bajo).toLowerCase()}`
      : `Más ${(haciaAlto ? eje.polo_alto : eje.polo_bajo).toLowerCase()}`;

  return (
    <Animated.View
      entering={FadeInDown.delay(120 + indice * 70).duration(400)}
      style={estilos.eje}
    >
      <View style={estilos.ejeCabecera}>
        <Text style={estilos.ejeEtiqueta}>{eje.etiqueta}</Text>
        {flojo ? <Text style={estilos.ejeFlojo}>1 respuesta</Text> : null}
      </View>

      <Text style={estilos.ejeMatiz}>{matiz}</Text>

      <View style={estilos.barra}>
        {/* Marca del centro: sin ella la barra parece una nota que se llena, y
            lo que mide es una posición entre dos extremos igual de válidos. */}
        <View style={estilos.barraCentro} />
        <View
          style={[
            estilos.barraTramo,
            haciaAlto
              ? { left: '50%', width: `${distanciaDelCentro}%` }
              : { right: '50%', width: `${distanciaDelCentro}%` },
          ]}
        />
        <View style={[estilos.barraPunto, { left: `${porcentaje}%` }]} />
      </View>

      <View style={estilos.ejePolos}>
        <Text style={[estilos.polo, !haciaAlto && !enMedio && estilos.poloActivo]}>
          {eje.polo_bajo}
        </Text>
        <Text style={[estilos.polo, haciaAlto && !enMedio && estilos.poloActivo]}>
          {eje.polo_alto}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function PerfilScreen({ onVolver, onHacerTest }) {
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
              {/* Este sí se queda: es quien todavía no lo ha hecho nunca. */}
              {onHacerTest ? (
                <TouchableOpacity style={estilos.boton} onPress={onHacerTest} activeOpacity={0.85}>
                  <Text style={estilos.botonTexto}>Hacer el test</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {perfil ? (
            <>
              {/* La tarjeta del tipo es lo primero y lo más grande de la
                  pantalla: es la respuesta a las veinte preguntas, y hasta
                  ahora competía en peso visual con los ejes y con la lista de
                  abajo. El icono le da algo que recordar — la gente dice "me
                  salió el del fuego" antes que el nombre completo. */}
              <Animated.View entering={FadeInDown.duration(400)} style={estilos.tarjetaTipo}>
                <Text style={estilos.tipoIcono}>{perfil.icono || '✨'}</Text>
                <Text style={estilos.tipoEtiqueta}>TU PERFIL</Text>
                <Text style={estilos.tipoTitulo}>{perfil.titulo}</Text>
                <Text style={estilos.tipoResumen}>{perfil.resumen}</Text>
              </Animated.View>

              {/* Para qué sirve. Iba sin decirse, y es justo lo que hace que
                  alguien se tome el test en serio: sin esto, el perfil parece
                  un horóscopo bonito en vez de el criterio con el que se le
                  sienta en una mesa. */}
              {perfil.proposito ? (
                <Animated.View entering={FadeInDown.delay(80).duration(400)} style={estilos.proposito}>
                  <Text style={estilos.propositoTexto}>{perfil.proposito}</Text>
                </Animated.View>
              ) : null}

              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <Text style={estilos.seccion}>¿Cómo te leemos?</Text>
                {perfil.ejes.map((eje, i) => (
                  <Eje key={eje.clave} eje={eje} indice={i} />
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

              {/* Aquí había un "Volver a hacer el test". Se quitó porque el
                  test se responde una sola vez: es el dato con el que se decide
                  con quién se sienta cada persona, y poder repetirlo convertía
                  el emparejamiento en algo que se reintenta hasta que sale un
                  grupo que guste. El backend lo rechaza con 409 aunque alguien
                  llame a la API directamente.

                  Se dice en vez de callarlo: un botón que desaparece sin
                  explicación se lee como una función rota. */}
              <Text style={estilos.unaVez}>
                Respondiste este test una sola vez, y así se queda. Es lo que hace que los grupos
                se formen por afinidad real.
              </Text>
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
  cuerpo: {
    ...COLUMNA, padding: ESPACIADO.m, paddingBottom: ESPACIADO.xl * 2 },
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
    paddingVertical: ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.l,
    marginBottom: ESPACIADO.m,
    alignItems: 'center',
  },
  tipoIcono: { fontSize: 52, marginBottom: ESPACIADO.s },
  tipoEtiqueta: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.blanco,
    opacity: 0.55,
    letterSpacing: 3,
    marginBottom: ESPACIADO.xs,
  },
  tipoTitulo: {
    ...TIPOGRAFIA.titulo,
    fontSize: 28,
    color: COLORES.blanco,
    textAlign: 'center',
  },
  tipoResumen: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.blanco,
    opacity: 0.85,
    marginTop: ESPACIADO.m,
    lineHeight: 23,
    textAlign: 'center',
  },
  proposito: {
    borderLeftWidth: 3,
    borderLeftColor: COLORES.rojoMarca,
    paddingLeft: ESPACIADO.m,
    paddingVertical: ESPACIADO.xs,
    marginBottom: ESPACIADO.xl,
  },
  propositoTexto: { ...TIPOGRAFIA.subtitulo, color: COLORES.textoSuave, lineHeight: 21 },

  seccion: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoTenue,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: ESPACIADO.m,
  },

  eje: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.campo,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.m,
  },
  ejeCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ejeEtiqueta: { ...TIPOGRAFIA.etiqueta, fontSize: 16, color: COLORES.texto },
  ejeFlojo: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue },
  ejeMatiz: { ...TIPOGRAFIA.ayuda, color: COLORES.rojoMarca, fontWeight: '700', marginTop: 2 },
  barra: {
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORES.blanco,
    marginTop: ESPACIADO.m,
    justifyContent: 'center',
  },
  // El tramo crece DESDE el centro hacia el lado que corresponde, así que de
  // un vistazo se ve hacia dónde se inclina y cuánto. Un relleno desde la
  // izquierda se leería como una nota del 0 al 100.
  barraCentro: {
    position: 'absolute',
    left: '50%',
    width: 1,
    height: 10,
    backgroundColor: COLORES.borde,
  },
  barraTramo: {
    position: 'absolute',
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORES.rojoMarca,
    opacity: 0.2,
  },
  barraPunto: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORES.rojoMarca,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: COLORES.blanco,
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
  unaVez: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.m,
    lineHeight: 19,
  },
});
