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
  ImageBackground,
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
              {/* Tarjeta del tipo, según el diseño de AJUSTES DISEÑO APP 2.0
                  (página 3): fotografía de fondo, "ERES" arriba a la izquierda
                  y el título encima de la imagen, con la descripción en un
                  bloque aparte debajo.

                  El degradado oscuro no es decoración: el texto blanco sobre
                  una foto con cielo claro a media altura sería ilegible, y
                  este fondo tiene zonas naranjas y verdes. Se oscurece de
                  arriba abajo, que es donde cae el texto. */}
              <Animated.View entering={FadeInDown.duration(400)}>
                <ImageBackground
                  source={require('../../assets/perfil_fondo.jpg')}
                  style={estilos.tarjetaTipo}
                  imageStyle={estilos.tarjetaTipoImagen}
                  resizeMode="cover"
                >
                  <View style={estilos.veloTipo} />
                  <Text style={estilos.tipoEtiqueta}>ERES</Text>
                  <Text style={estilos.tipoTitulo}>
                    {perfil.icono ? `${perfil.icono}  ` : ''}
                    {perfil.titulo}
                  </Text>
                </ImageBackground>

                {/* La descripción sale de la tarjeta y va en su propio bloque,
                    como en el diseño: sobre la foto competía con el título y
                    costaba leerla. */}
                <View style={estilos.tipoResumenBloque}>
                  <Text style={estilos.tipoResumen}>{perfil.resumen}</Text>
                </View>
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
    minHeight: 190,
    borderRadius: RADIOS.tarjeta,
    paddingVertical: ESPACIADO.l,
    paddingHorizontal: ESPACIADO.l,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: COLORES.negroMarca,
  },
  // El redondeo tiene que ir también en la imagen: ImageBackground pinta el
  // bitmap por debajo del contenedor y, sin esto, las esquinas de la foto
  // sobresalen por fuera del radio.
  tarjetaTipoImagen: { borderRadius: RADIOS.tarjeta },
  veloTipo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORES.negroMarca,
    opacity: 0.45,
  },
  tipoEtiqueta: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.blanco,
    opacity: 0.8,
    letterSpacing: 2,
    marginBottom: ESPACIADO.xs,
  },
  tipoTitulo: {
    ...TIPOGRAFIA.titulo,
    fontSize: 28,
    color: COLORES.blanco,
    // Sombra suave: la foto tiene zonas claras y el blanco puro desaparece
    // encima de ellas aunque esté el velo.
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tipoResumenBloque: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.campo,
    paddingVertical: ESPACIADO.m,
    paddingHorizontal: ESPACIADO.l,
    marginTop: ESPACIADO.s,
    marginBottom: ESPACIADO.m,
  },
  tipoResumen: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
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
