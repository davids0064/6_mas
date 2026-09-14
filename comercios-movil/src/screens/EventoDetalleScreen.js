// Detalle de un evento: cuándo, qué, quién viene y en qué estado está.
//
// Es la pantalla por la que existe esta app. Un local que va a recibir a seis
// desconocidos necesita dos cosas cinco minutos antes de que lleguen: los
// nombres y de qué les gusta hablar. Eso es exactamente — y solamente — lo que
// devuelve GET /eventos/{id}/asistentes.
//
// Lo que NO se muestra no es una decisión de diseño de esta pantalla: la vista
// v_evento_asistentes solo expone nombre de pila e intereses, y el rol de
// PostgreSQL con el que se conecta la API no tiene permiso sobre la tabla
// `usuarios`. Aunque esta pantalla quisiera pintar un correo, no habría de
// dónde sacarlo (ver dashboard/README.md, "La frontera entre los dos mundos").
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import { fechaLarga, precio, estadoLegible } from '../util/formato';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// Las transiciones que un local hace desde el teléfono. Van en un botón grande
// porque son la operación del día: confirmar, abrir, cerrar.
//
// Cancelar es distinto y está aparte, abajo del todo: deja a seis personas sin
// plan. Estuvo fuera de la app mientras existió el panel web, con el argumento
// de que no debía caber en un toque accidental mientras se atiende una mesa.
// Al retirarse el panel, dejarla fuera no la volvía imposible sino
// inalcanzable, así que está — pero con el peso puesto en la confirmación y no
// en el botón.
const SIGUIENTE_ESTADO = {
  propuesto: { estado: 'confirmado', texto: 'Confirmar este grupo' },
  confirmado: { estado: 'en_curso', texto: 'Marcar que ya llegaron' },
  en_curso: { estado: 'finalizado', texto: 'Cerrar el evento' },
};

export default function EventoDetalleScreen({ evento: eventoInicial, onVolver }) {
  // Se parte del evento que traía la lista para pintar algo de inmediato, y se
  // recarga en segundo plano: la pantalla nunca aparece en blanco.
  const [evento, setEvento] = useState(eventoInicial);
  const [asistentes, setAsistentes] = useState(null);
  const [grupoAsignado, setGrupoAsignado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(
    async (esRefresco = false) => {
      if (!esRefresco) setCargando(true);
      setError(null);
      try {
        const [detalle, lista] = await Promise.all([
          api.obtenerEvento(eventoInicial.id),
          api.obtenerAsistentes(eventoInicial.id),
        ]);
        setEvento(detalle);
        setGrupoAsignado(lista.grupo_asignado);
        setAsistentes(lista.asistentes);
      } catch (e) {
        setError(e.message);
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [eventoInicial.id],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const avanzar = async () => {
    const siguiente = SIGUIENTE_ESTADO[evento.estado];
    if (!siguiente || cambiandoEstado) return;
    setCambiandoEstado(true);
    setError(null);
    try {
      setEvento(await api.cambiarEstadoEvento(evento.id, siguiente.estado));
    } catch (e) {
      setError(e.message);
    } finally {
      setCambiandoEstado(false);
    }
  };

  const cancelar = async () => {
    if (cancelando) return;
    setCancelando(true);
    setError(null);
    try {
      await api.cancelarEvento(evento.id);
      // Se vuelve a la lista: quedarse en el detalle de un evento cancelado no
      // deja nada que hacer, y la lista se recarga al montarse.
      onVolver();
    } catch (e) {
      setError(e.message);
      setCancelando(false);
    }
  };

  const estado = estadoLegible(evento.estado);
  const siguiente = SIGUIENTE_ESTADO[evento.estado];
  // Un evento cerrado o ya cancelado no se cancela: no hay nada que deshacer.
  const sePuedeCancelar = evento.estado === 'propuesto' || evento.estado === 'confirmado';

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo={evento.titulo} onVolver={onVolver} />

      <ScrollView
        contentContainerStyle={styles.cuerpo}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              cargar(true);
            }}
            tintColor={COLORES.rojoMarca}
          />
        }
      >
        <View style={styles.tarjeta}>
          <Text style={[styles.insignia, { color: COLORES[estado.color] }]}>{estado.texto}</Text>
          <Text style={styles.fecha}>{fechaLarga(evento.fecha_hora)}</Text>
          {evento.descripcion ? <Text style={styles.descripcion}>{evento.descripcion}</Text> : null}
          <View style={styles.divisor} />
          <Text style={styles.dato}>👥 {evento.capacidad} personas</Text>
          {Number(evento.precio) > 0 ? (
            <Text style={styles.dato}>💵 ${precio(evento.precio)} por persona</Text>
          ) : null}
          {evento.anfitrion_nombre ? (
            <Text style={styles.dato}>🤝 Recibe {evento.anfitrion_nombre}</Text>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {siguiente ? (
          <TouchableOpacity
            style={[styles.cta, cambiandoEstado && styles.ctaDeshabilitado]}
            onPress={avanzar}
            disabled={cambiandoEstado}
            activeOpacity={0.85}
          >
            {cambiandoEstado ? (
              <ActivityIndicator color={COLORES.blanco} />
            ) : (
              <Text style={styles.ctaTexto}>{siguiente.texto}</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <Text style={styles.tituloBloque}>QUIÉNES VIENEN</Text>

        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : grupoAsignado === false ? (
          // No es un error ni una lista vacía: el evento se publica antes de
          // que el matching lo enlace a un grupo, y esa espera es parte normal
          // del ciclo.
          <View style={styles.aviso}>
            <Text style={styles.avisoTitulo}>Todavía no hay grupo asignado</Text>
            <Text style={styles.avisoTexto}>
              Seis Más te avisará aquí en cuanto se complete un grupo de seis para este plan.
            </Text>
          </View>
        ) : (
          <>
            {(asistentes || []).map((persona, i) => (
              <View key={`${persona.nombre_pila}-${i}`} style={styles.persona}>
                <View style={styles.inicial}>
                  <Text style={styles.inicialTexto}>
                    {(persona.nombre_pila || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.personaDatos}>
                  <Text style={styles.personaNombre}>{persona.nombre_pila}</Text>
                  {persona.intereses?.length > 0 ? (
                    <Text style={styles.personaIntereses}>{persona.intereses.join(' · ')}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            <Text style={styles.notaPrivacidad}>
              Nombre de pila e intereses es todo lo que Seis Más comparte contigo sobre las
              personas que recibes.
            </Text>
          </>
        )}

        {/* Cancelar va al final, después de haber visto a quién afecta. No es
            un descuido de jerarquía: es el orden en el que conviene tomar esta
            decisión. */}
        {sePuedeCancelar ? (
          <View style={styles.zonaCancelar}>
            {confirmandoCancelar ? (
              <>
                <Text style={styles.cancelarAviso}>
                  {grupoAsignado
                    ? `Se cancela para las ${evento.capacidad} personas que ya lo tienen agendado. Seis Más les avisa, y no se puede deshacer.`
                    : 'El evento deja de existir y no volverá a recibir un grupo. No se puede deshacer.'}
                </Text>
                <View style={styles.cancelarBotones}>
                  <TouchableOpacity onPress={cancelar} disabled={cancelando}>
                    {cancelando ? (
                      <ActivityIndicator color={COLORES.error} />
                    ) : (
                      <Text style={styles.cancelarSi}>Sí, cancelar el evento</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setConfirmandoCancelar(false)}
                    disabled={cancelando}
                  >
                    <Text style={styles.cancelarNo}>Mejor no</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity onPress={() => setConfirmandoCancelar(true)}>
                <Text style={styles.cancelarEnlace}>Cancelar el evento</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  zonaCancelar: {
    marginTop: ESPACIADO.xl,
    paddingTop: ESPACIADO.m,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  cancelarEnlace: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, textAlign: 'center' },
  cancelarAviso: { ...TIPOGRAFIA.ayuda, color: COLORES.texto, lineHeight: 19 },
  cancelarBotones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: ESPACIADO.m,
  },
  cancelarSi: { ...TIPOGRAFIA.etiqueta, color: COLORES.error },
  cancelarNo: { ...TIPOGRAFIA.etiqueta, color: COLORES.textoSuave },
  cuerpo: { padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
  },
  insignia: { ...TIPOGRAFIA.ayuda, fontWeight: '700', marginBottom: ESPACIADO.xs },
  fecha: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  descripcion: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.s,
    lineHeight: 19,
  },
  divisor: { height: 1, backgroundColor: COLORES.borde, marginVertical: ESPACIADO.m },
  dato: { ...TIPOGRAFIA.ayuda, color: COLORES.texto, marginBottom: ESPACIADO.xs },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginTop: ESPACIADO.m },
  cta: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: ESPACIADO.m,
  },
  ctaDeshabilitado: { opacity: 0.7 },
  ctaTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
  tituloBloque: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    letterSpacing: 1,
    marginTop: ESPACIADO.xl,
    marginBottom: ESPACIADO.m,
  },
  centrado: { marginTop: ESPACIADO.m },
  aviso: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
  },
  avisoTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  avisoTexto: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.xs,
    lineHeight: 19,
  },
  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  inicial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORES.rojoMarca,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicialTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.blanco },
  personaDatos: { marginLeft: ESPACIADO.m, flex: 1 },
  personaNombre: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  personaIntereses: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  notaPrivacidad: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    marginTop: ESPACIADO.s,
    lineHeight: 18,
  },
});
