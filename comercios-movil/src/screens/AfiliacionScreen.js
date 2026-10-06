// Pantalla "Mi afiliación".
//
// El plan del local decide cuántos grupos recibe al mes, y el Resumen ya lo
// resume en una tarjeta. Esta pantalla responde la pregunta que viene después,
// que es la que de verdad importa cuando el contador llega a cero: no "cuántos
// me quedan", sino "¿en qué se me fueron?".
//
// Es solo lectura a propósito. El pago va por transferencia y lo gestiona una
// persona: un botón de "pagar" que no cobra, o un "cambiar de plan" que solo
// manda un correo, prometen algo que la app no hace.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import EncabezadoMarca from '../components/EncabezadoMarca';
import { api } from '../services/api';
import { EMAIL_CONTACTO, WHATSAPP } from '../config/env';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from '../theme/tokens';

function fecha(iso) {
  const texto = String(iso);

  // Una fecha sin hora ('2026-10-06') la interpreta JavaScript como medianoche
  // UTC, y en Colombia (UTC-5) eso cae el día ANTERIOR: el periodo del 6 de
  // octubre al 5 de noviembre se mostraba como "del 5 de oct. al 4 de nov.".
  // Añadirle la hora la convierte en una fecha local y el día deja de bailar.
  //
  // Los campos con hora (`fecha_hora` de los eventos) ya traen zona, así que
  // esos se dejan como están.
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(texto);
  const d = new Date(soloFecha ? `${texto}T00:00:00` : texto.replace(' ', 'T'));

  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function enDias(dias) {
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

export default function AfiliacionScreen({ onVolver }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.obtenerAfiliacion());
      setError(null);
    } catch (e) {
      setError(e?.message || 'No pudimos cargar tu afiliación.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const actual = datos?.actual;
  const consumo = datos?.consumo || [];
  const planes = datos?.planes || [];
  const historial = datos?.historial || [];

  const escribir = () => {
    if (WHATSAPP) Linking.openURL(`https://wa.me/${WHATSAPP}`);
    else if (EMAIL_CONTACTO) Linking.openURL(`mailto:${EMAIL_CONTACTO}`);
  };

  return (
    <View style={estilos.pantalla}>
      <EncabezadoMarca titulo="Mi afiliación" onVolver={onVolver} />

      {cargando ? (
        <ActivityIndicator color={COLORES.rojoMarca} style={estilos.centrado} />
      ) : (
        <ScrollView
          contentContainerStyle={estilos.cuerpo}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar();
              }}
              tintColor={COLORES.rojoMarca}
            />
          }
        >
          {error ? <Text style={estilos.error}>😕 {error}</Text> : null}

          {actual ? (
            <View style={estilos.tarjeta}>
              <View style={estilos.fila}>
                <Text style={estilos.etiqueta}>TU PLAN</Text>
                <Text style={estilos.plan}>{String(actual.plan).toUpperCase()}</Text>
              </View>
              <Text style={estilos.titulo}>
                {actual.grupos_disponibles === 0
                  ? 'Cupo agotado'
                  : `${actual.grupos_disponibles} de ${actual.grupos_mes} ${
                      actual.grupos_mes === 1 ? 'grupo' : 'grupos'
                    } sin usar`}
              </Text>
              <Text style={estilos.detalle}>
                Periodo del {fecha(actual.inicio)} al {fecha(actual.fin)} · renueva{' '}
                {enDias(actual.dias_restantes)}
              </Text>
            </View>
          ) : (
            <View style={[estilos.tarjeta, estilos.tarjetaAlerta]}>
              <Text style={estilos.tituloAlerta}>Tu afiliación no está vigente</Text>
              <Text style={estilos.detalle}>
                No estás recibiendo grupos nuevos. Escríbenos y la activamos.
              </Text>
            </View>
          )}

          {/* En qué se fue el cupo. Es lo que esta pantalla añade sobre la
              tarjeta del Resumen, y la razón de que exista. */}
          {actual ? (
            <View style={estilos.bloque}>
              <Text style={estilos.tituloBloque}>EN QUÉ SE FUE ESTE PERIODO</Text>
              {consumo.length === 0 ? (
                <Text style={estilos.vacio}>
                  Todavía no has recibido ningún grupo en este periodo.
                </Text>
              ) : (
                consumo.map((e) => (
                  <View key={e.id} style={estilos.consumo}>
                    <Text style={estilos.consumoFecha}>{fecha(e.fecha_hora)}</Text>
                    <View style={estilos.consumoTexto}>
                      <Text style={estilos.consumoTitulo}>{e.titulo}</Text>
                      <Text style={estilos.consumoEstado}>
                        {e.ya_ocurrio ? 'Ya ocurrió' : 'Por venir'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {/* Qué da cada plan. Sin precios: los acuerda una persona, y publicar
              una tarifa que no está cerrada es peor que no publicar ninguna. */}
          <View style={estilos.bloque}>
            <Text style={estilos.tituloBloque}>LOS PLANES</Text>
            {planes.map((p) => {
              const esElTuyo = actual && p.nombre === actual.plan;
              return (
                <View key={p.nombre} style={[estilos.plan2, esElTuyo && estilos.planActual]}>
                  <Text style={[estilos.planNombre, esElTuyo && estilos.planNombreActual]}>
                    {String(p.nombre).toUpperCase()}
                    {esElTuyo ? '  · el tuyo' : ''}
                  </Text>
                  <Text style={estilos.planGrupos}>
                    {p.grupos_mes} {p.grupos_mes === 1 ? 'grupo' : 'grupos'} al mes
                  </Text>
                </View>
              );
            })}
            <Text style={estilos.nota}>
              Los planes con más nivel tienen prioridad cuando varios locales encajan igual de
              bien con un grupo.
            </Text>
          </View>

          {/* Cómo se cambia o se renueva: hablando con una persona. Se dice tal
              cual en vez de poner un botón que no cobra. */}
          <TouchableOpacity style={estilos.boton} onPress={escribir} activeOpacity={0.85}>
            <Text style={estilos.botonTexto}>
              {actual ? 'Cambiar de plan o renovar' : 'Activar mi afiliación'}
            </Text>
          </TouchableOpacity>
          <Text style={estilos.nota}>
            El pago se hace por transferencia. Escríbenos y lo acordamos.
          </Text>

          {historial.length > 1 ? (
            <View style={estilos.bloque}>
              <Text style={estilos.tituloBloque}>PERIODOS ANTERIORES</Text>
              {historial.slice(1).map((h, i) => (
                <View key={`${h.inicio}-${i}`} style={estilos.historial}>
                  <Text style={estilos.historialTexto}>
                    {String(h.plan).toUpperCase()} · {fecha(h.inicio)} al {fecha(h.fin)}
                  </Text>
                  <Text style={estilos.historialEstado}>{h.estado}</Text>
                </View>
              ))}
            </View>
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

  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.l,
  },
  tarjetaAlerta: { borderWidth: 1, borderColor: COLORES.error, backgroundColor: COLORES.blanco },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etiqueta: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, letterSpacing: 1 },
  plan: { ...TIPOGRAFIA.ayuda, color: COLORES.rojoMarca, fontWeight: '800', letterSpacing: 1 },
  titulo: { ...TIPOGRAFIA.etiqueta, fontSize: 20, color: COLORES.texto, marginTop: 4 },
  tituloAlerta: { ...TIPOGRAFIA.etiqueta, fontSize: 20, color: COLORES.error },
  detalle: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 6 },

  bloque: { marginBottom: ESPACIADO.l },
  tituloBloque: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    letterSpacing: 1,
    marginBottom: ESPACIADO.s,
  },
  vacio: { ...TIPOGRAFIA.subtitulo, color: COLORES.textoSuave },

  consumo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ESPACIADO.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORES.borde,
  },
  consumoFecha: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.rojoMarca,
    width: 72,
  },
  consumoTexto: { flex: 1 },
  consumoTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  consumoEstado: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },

  plan2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: ESPACIADO.s,
    paddingHorizontal: ESPACIADO.m,
    borderRadius: RADIOS.campo,
    marginBottom: 6,
    backgroundColor: COLORES.superficie,
  },
  planActual: { borderWidth: 1.5, borderColor: COLORES.rojoMarca },
  planNombre: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  planNombreActual: { color: COLORES.rojoMarca },
  planGrupos: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave },
  nota: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: ESPACIADO.s },

  boton: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: ESPACIADO.s,
  },
  botonTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },

  historial: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: ESPACIADO.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORES.borde,
  },
  historialTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.texto },
  historialEstado: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue },
});
