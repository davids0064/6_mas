// Pantalla "Tu grupo". Tres estados, que son los tres del matching:
//
//   1. Esperando grupo: un anillo de 6 puestos — el usuario ya ocupa uno
//      (círculo rojo de marca con su inicial) y los otros 5 pulsan vacíos.
//      Refuerza la metáfora del "6" de la marca. Microcopy motivador +
//      botón Actualizar.
//   2. Grupo formado pero todavía sin plan: el anillo lleno y un aviso de
//      que se está buscando el plan. No es un caso raro ni un error — el
//      matching deja el grupo `completo` sin plan a propósito cuando ningún
//      comercio de la ciudad tiene oferta afín, en vez de asignar uno malo
//      (ver README, etapa 2). Sin este estado ese grupo vería un hueco.
//   3. Grupo con plan: el anillo lleno más la tarjeta del plan — cuándo,
//      qué, dónde y quién recibe.
//
// Consume GET /api/usuarios/yo/grupo, /yo/perfil y /yo/eventos: las tres
// resuelven "yo" desde el token, sin ids por parámetro.
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

const TAMANO_PUESTO = 64;
const RADIO_ANILLO = 110;
const LADO_ANILLO = RADIO_ANILLO * 2 + TAMANO_PUESTO; // alto/ancho del área del anillo

// Posiciones de los 6 puestos: hexágono, arrancando arriba (-90°).
const POSICIONES = Array.from({ length: 6 }, (_, i) => {
  const angulo = ((-90 + i * 60) * Math.PI) / 180;
  return {
    left: LADO_ANILLO / 2 + RADIO_ANILLO * Math.cos(angulo) - TAMANO_PUESTO / 2,
    top: LADO_ANILLO / 2 + RADIO_ANILLO * Math.sin(angulo) - TAMANO_PUESTO / 2,
  };
});

// Un puesto vacío que "respira" (pulso de opacidad y escala), con un
// pequeño desfase por puesto para que no pulsen todos en sincronía.
function PuestoVacio({ posicion, retraso }) {
  const pulso = useSharedValue(0);

  useEffect(() => {
    pulso.value = withDelay(
      retraso,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * pulso.value,
    transform: [{ scale: 0.92 + 0.08 * pulso.value }],
  }));

  return (
    <Animated.View style={[styles.puesto, styles.puestoVacio, estilo, posicion]}>
      <Text style={styles.puestoVacioTexto}>?</Text>
    </Animated.View>
  );
}

function PuestoOcupado({ posicion, inicial }) {
  return (
    <View style={[styles.puesto, styles.puestoOcupado, posicion]}>
      <Text style={styles.puestoOcupadoTexto}>{inicial}</Text>
    </View>
  );
}

// Anillo de 6 puestos. `miembros` = array de nombres (strings); los puestos
// restantes se muestran vacíos y pulsando.
function AnilloGrupo({ miembros }) {
  const ocupados = miembros.slice(0, 6);
  return (
    <View style={styles.anillo}>
      {POSICIONES.map((posicion, i) =>
        i < ocupados.length ? (
          <PuestoOcupado key={i} posicion={posicion} inicial={(ocupados[i] || '?')[0].toUpperCase()} />
        ) : (
          <PuestoVacio key={i} posicion={posicion} retraso={i * 180} />
        ),
      )}
      <View style={styles.centroAnillo}>
        <Text style={styles.centroConteo}>
          {ocupados.length}
          <Text style={styles.centroConteoTotal}>/6</Text>
        </Text>
      </View>
    </View>
  );
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Fecha en formato humano ("jueves 14 de agosto, 7:00 p. m.").
//
// A mano y no con toLocaleDateString('es-*'): Hermes se compila sin datos de
// ICU salvo que se active explícitamente, así que los locales caen a inglés
// según el dispositivo. Doce nombres y un condicional son más baratos que un
// build especial, y garantizan que la fecha del plan se lea igual en todos.
function formatearFecha(iso) {
  const f = new Date(iso);
  const hora12 = f.getHours() % 12 || 12;
  const minutos = String(f.getMinutes()).padStart(2, '0');
  const meridiano = f.getHours() < 12 ? 'a. m.' : 'p. m.';
  return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}, ${hora12}:${minutos} ${meridiano}`;
}

// Separador de miles a mano, por lo mismo que la fecha: sin ICU,
// toLocaleString no agrupa según el locale y "120000" se lee mal de un vistazo.
function formatearPrecio(valor) {
  return String(Math.round(Number(valor))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// El plan que viene: el primero que todavía no pasó y no está cancelado.
//
// El endpoint devuelve todos los eventos del usuario ordenados por fecha,
// incluidos los de grupos anteriores; mostrar el primero de la lista sería
// mostrarle un plan del mes pasado a alguien que tiene uno la semana que viene.
function proximoPlan(eventos) {
  if (!Array.isArray(eventos)) return null;
  const ahora = Date.now();
  return (
    eventos.find((e) => e.estado !== 'cancelado' && new Date(e.fecha_hora).getTime() >= ahora) ||
    null
  );
}

// Tarjeta del plan asignado: cuándo, qué, dónde y quién recibe.
//
// La fecha va primero y en grande porque es lo que la persona viene a mirar;
// el resto es contexto. La dirección solo aparece si el backend la resolvió
// (el JOIN es LEFT: un comercio dado de baja deja el evento sin dónde, y es
// preferible una tarjeta incompleta a no mostrar el plan).
function TarjetaPlan({ evento }) {
  return (
    <View style={styles.tarjetaPlan}>
      <Text style={styles.planEtiqueta}>TU PLAN</Text>
      <Text style={styles.planFecha}>{formatearFecha(evento.fecha_hora)}</Text>
      <Text style={styles.planTitulo}>{evento.titulo}</Text>

      {evento.comercio_nombre ? (
        <View style={styles.planBloque}>
          <Text style={styles.planDato}>📍 {evento.comercio_nombre}</Text>
          {evento.comercio_direccion ? (
            <Text style={styles.planDatoSuave}>
              {evento.comercio_direccion}
              {evento.comercio_ciudad ? `, ${evento.comercio_ciudad}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {evento.anfitrion_nombre ? (
        <Text style={styles.planDato}>🤝 Te recibe {evento.anfitrion_nombre.split(' ')[0]}</Text>
      ) : null}

      {Number(evento.precio) > 0 ? (
        <Text style={styles.planDato}>💵 ${formatearPrecio(evento.precio)} por persona</Text>
      ) : null}
    </View>
  );
}

export default function GruposScreen() {
  const [grupo, setGrupo] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [evento, setEvento] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Ya no recibe ids por params. Antes esperaba un `grupoId` que App.js nunca
  // le pasaba, así que la pantalla no llegaba a cargar nada; ahora el backend
  // resuelve "mi grupo" desde el token.
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // En paralelo: son consultas independientes y la pantalla necesita las
      // tres para pintarse.
      const [miGrupo, miPerfil, misEventos] = await Promise.all([
        api.obtenerMiGrupo(),
        api.obtenerMiPerfil(),
        api.obtenerMisEventos(),
      ]);
      // obtenerMiGrupo devuelve null (204) mientras el matching todavía no
      // completó los 6: es el estado de espera, no un error.
      setGrupo(miGrupo);
      setUsuario(miPerfil);
      setEvento(proximoPlan(misEventos));
    } catch {
      // Sin datos no se bloquea la pantalla: se muestra el estado de espera.
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const miembros = grupo?.miembros?.map((m) => m.nombre) || (usuario ? [usuario.nombre] : ['Tú']);

  return (
    <View style={styles.pantalla}>
      {/* Encabezado de marca: mismo estilo (logo centrado) en toda la app. */}
      <EncabezadoMarca titulo="Tu grupo" />

      {cargando ? (
        <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
      ) : (
        <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <AnilloGrupo miembros={miembros} />
          </Animated.View>

          {grupo ? (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.bloqueTexto}>
              {evento ? (
                <>
                  <Text style={styles.titulo}>¡Ya tienes plan! 🎉</Text>
                  <TarjetaPlan evento={evento} />
                </>
              ) : (
                <>
                  {/* Grupo completo sin plan: el matching prefiere dejarlo en
                      espera antes que mandarlo a algo que no le interesa, y lo
                      resuelve solo en cuanto un comercio de la ciudad publique
                      oferta afín. Se dice tal cual para que la espera no se
                      lea como que algo se rompió. */}
                  <Text style={styles.titulo}>¡Tu grupo está completo! 🎉</Text>
                  <Text style={styles.subtitulo}>
                    Estamos buscándoles el plan indicado. Te avisamos apenas esté: preferimos
                    esperar a mandarlos a algo que no les guste.
                  </Text>
                </>
              )}

              <Text style={styles.tituloMiembros}>Tu grupo</Text>
              {grupo.miembros?.map((m) => (
                <Text key={m.id} style={styles.miembro}>
                  {m.nombre}
                </Text>
              ))}

              <TouchableOpacity style={styles.botonActualizar} onPress={cargar} activeOpacity={0.8}>
                <Text style={styles.botonActualizarTexto}>Actualizar ↻</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.bloqueTexto}>
              <Text style={styles.titulo}>Estamos formando tu grupo ideal ✨</Text>
              <Text style={styles.subtitulo}>
                {usuario ? `${usuario.nombre.split(' ')[0]}, ya` : 'Ya'} ocupas tu puesto. Cuando los
                6 estén listos te avisaremos para el plan sorpresa.
              </Text>

              <TouchableOpacity style={styles.botonActualizar} onPress={cargar} activeOpacity={0.8}>
                <Text style={styles.botonActualizarTexto}>Actualizar ↻</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  centrado: { flex: 1, justifyContent: 'center' },
  cuerpo: { alignItems: 'center', padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
  anillo: {
    width: LADO_ANILLO,
    height: LADO_ANILLO,
    marginTop: ESPACIADO.l,
  },
  puesto: {
    position: 'absolute',
    width: TAMANO_PUESTO,
    height: TAMANO_PUESTO,
    borderRadius: TAMANO_PUESTO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puestoOcupado: {
    backgroundColor: COLORES.rojoMarca,
    shadowColor: COLORES.rojoMarca,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  puestoOcupadoTexto: { ...TIPOGRAFIA.titulo, fontSize: 24, color: COLORES.blanco },
  puestoVacio: {
    backgroundColor: COLORES.superficie,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORES.borde,
  },
  puestoVacioTexto: { ...TIPOGRAFIA.titulo, fontSize: 20, color: COLORES.textoTenue },
  centroAnillo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centroConteo: { ...TIPOGRAFIA.titulo, fontSize: 34, color: COLORES.rojoMarca },
  centroConteoTotal: { fontSize: 20, color: COLORES.textoTenue },
  bloqueTexto: { alignItems: 'center', marginTop: ESPACIADO.xl, paddingHorizontal: ESPACIADO.m },
  titulo: { ...TIPOGRAFIA.titulo, fontSize: 22, color: COLORES.texto, textAlign: 'center' },
  subtitulo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.m,
    lineHeight: 22,
  },
  miembro: {
    ...TIPOGRAFIA.input,
    color: COLORES.texto,
    marginTop: ESPACIADO.s,
  },
  tituloMiembros: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.xl,
  },

  // Tarjeta del plan. Es la única superficie elevada de la pantalla: el anillo
  // es la metáfora, pero el plan es la información accionable, y tiene que
  // ganarle visualmente a la lista de nombres que va debajo.
  tarjetaPlan: {
    alignSelf: 'stretch',
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
    marginTop: ESPACIADO.l,
  },
  planEtiqueta: {
    ...TIPOGRAFIA.ayuda,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORES.rojoMarca,
  },
  planFecha: {
    ...TIPOGRAFIA.titulo,
    fontSize: 20,
    color: COLORES.texto,
    marginTop: ESPACIADO.s,
  },
  planTitulo: {
    ...TIPOGRAFIA.input,
    fontWeight: '600',
    color: COLORES.texto,
    marginTop: ESPACIADO.xs,
  },
  planBloque: { marginTop: ESPACIADO.m },
  planDato: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
    marginTop: ESPACIADO.s,
  },
  planDatoSuave: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.xs,
    marginLeft: 22, // alinea con el texto del 📍, no con el emoji
  },
  botonActualizar: {
    marginTop: ESPACIADO.xl,
    borderWidth: 1.5,
    borderColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingHorizontal: 36,
    paddingVertical: 12,
  },
  botonActualizarTexto: { ...TIPOGRAFIA.boton, color: COLORES.rojoMarca },
});
