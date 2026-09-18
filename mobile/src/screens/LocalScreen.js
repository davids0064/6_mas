// Pantalla "El sitio".
//
// De un plan, la app mostraba el título, la fecha, la dirección y el precio.
// Un local sin carta, sin horario y sin saber qué te encuentras al llegar es
// una línea de texto, no un sitio al que te apetezca ir. Todo esto ya existía
// en la base —lo publica el propio comercio desde su app— y no había forma de
// que llegara hasta acá.
//
// Consume GET /api/usuarios/yo/eventos/:id/local. El backend comprueba que el
// evento sea de un grupo tuyo antes de responder.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
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

function formatearPrecio(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

// Abrir la dirección en un mapa.
//
// Antes esto mandaba directo a Google Maps, y Apple lo rechazó por guideline 4:
// "The app's location feature is not integrated with the built-in mapping
// functionality, which limits users to a third-party maps app". En iOS tiene
// que poder abrirse en Apple Maps.
//
// La solución no es cambiar un tercero por otro, sino preguntar: en iOS se
// ofrecen las dos, con Apple Maps primero por ser la del sistema, y en Android
// —donde Apple Maps no existe— se va directo a Google Maps sin preguntar nada.
// Un diálogo con una sola opción real es una molestia, no una elección.
function consultaDe(comercio) {
  return [comercio.nombre, comercio.direccion, comercio.ciudad].filter(Boolean).join(', ');
}

const urlAppleMaps = (q) => `http://maps.apple.com/?q=${encodeURIComponent(q)}`;
const urlGoogleMaps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

function abrirEnMapas(comercio) {
  const q = consultaDe(comercio);

  if (Platform.OS !== 'ios') {
    Linking.openURL(urlGoogleMaps(q));
    return;
  }

  Alert.alert(
    'Cómo llegar',
    consultaDe(comercio),
    [
      { text: 'Abrir en Mapas', onPress: () => Linking.openURL(urlAppleMaps(q)) },
      { text: 'Abrir en Google Maps', onPress: () => Linking.openURL(urlGoogleMaps(q)) },
      { text: 'Cancelar', style: 'cancel' },
    ],
    { cancelable: true }
  );
}

function Seccion({ seccion }) {
  if (!seccion.items?.length) return null;
  return (
    <View style={estilos.seccionMenu}>
      <Text style={estilos.seccionNombre}>{seccion.nombre}</Text>
      {seccion.items.map((item) => (
        <View key={item.id} style={estilos.item}>
          <View style={estilos.itemTexto}>
            <Text style={estilos.itemNombre}>{item.nombre}</Text>
            {item.descripcion ? (
              <Text style={estilos.itemDescripcion}>{item.descripcion}</Text>
            ) : null}
          </View>
          {formatearPrecio(item.precio) ? (
            <Text style={estilos.itemPrecio}>${formatearPrecio(item.precio)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function LocalScreen({ evento, onVolver }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.obtenerLocalDelPlan(evento.id));
    } catch (e) {
      setError(e?.message || 'No pudimos cargar el sitio.');
    } finally {
      setCargando(false);
    }
  }, [evento.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const comercio = datos?.comercio;

  return (
    <View style={estilos.pantalla}>
      <EncabezadoMarca titulo="El sitio" onVolver={onVolver} />

      {cargando ? (
        <ActivityIndicator color={COLORES.rojoMarca} style={estilos.centrado} />
      ) : (
        <ScrollView contentContainerStyle={estilos.cuerpo} showsVerticalScrollIndicator={false}>
          {error ? <Text style={estilos.error}>{error}</Text> : null}

          {comercio ? (
            <Animated.View entering={FadeInDown.duration(400)} style={estilos.tarjetaLocal}>
              <Text style={estilos.localNombre}>{comercio.nombre}</Text>
              {comercio.descripcion ? (
                <Text style={estilos.localDescripcion}>{comercio.descripcion}</Text>
              ) : null}

              {comercio.direccion ? (
                <TouchableOpacity
                  style={estilos.filaDato}
                  onPress={() => abrirEnMapas(comercio)}
                  activeOpacity={0.7}
                >
                  <Text style={estilos.dato}>
                    📍 {comercio.direccion}
                    {comercio.ciudad ? `, ${comercio.ciudad}` : ''}
                  </Text>
                  <Text style={estilos.enlace}>Cómo llegar</Text>
                </TouchableOpacity>
              ) : null}

              {comercio.horario ? <Text style={estilos.dato}>🕐 {comercio.horario}</Text> : null}
              {datos.anfitrion?.nombre ? (
                <Text style={estilos.dato}>
                  🤝 Te recibe {datos.anfitrion.nombre.split(' ')[0]}
                </Text>
              ) : null}
            </Animated.View>
          ) : (
            // El comercio puede haberse dado de baja después de que se asignó
            // el plan: la vista pública deja de devolverlo. El plan sigue
            // existiendo, así que se dice lo que pasa en vez de mostrar un
            // hueco.
            !error && (
              <Text style={estilos.aviso}>
                Este local ya no está disponible en la app. Tu plan sigue en pie: revisa la
                dirección en la tarjeta del plan.
              </Text>
            )
          )}

          {datos?.propuesta ? (
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={estilos.bienvenida}>
              <Text style={estilos.etiquetaSeccion}>AL LLEGAR</Text>
              <Text style={estilos.bienvenidaTitulo}>{datos.propuesta.titulo}</Text>
              {datos.propuesta.descripcion ? (
                <Text style={estilos.bienvenidaTexto}>{datos.propuesta.descripcion}</Text>
              ) : null}
              {datos.propuesta.incluye?.map((linea) => (
                <Text key={linea} style={estilos.incluye}>
                  ✓ {linea}
                </Text>
              ))}
              {formatearPrecio(datos.propuesta.precio_persona) ? (
                <Text style={estilos.bienvenidaPrecio}>
                  ${formatearPrecio(datos.propuesta.precio_persona)} por persona
                </Text>
              ) : null}
            </Animated.View>
          ) : null}

          {datos?.menus?.length ? (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Text style={estilos.etiquetaSeccion}>LA CARTA</Text>
              {datos.menus.map((menu) => (
                <View key={menu.id}>
                  {datos.menus.length > 1 ? (
                    <Text style={estilos.menuNombre}>{menu.nombre}</Text>
                  ) : null}
                  {menu.secciones.map((seccion) => (
                    <Seccion key={seccion.id} seccion={seccion} />
                  ))}
                </View>
              ))}
              {/* Se dice de dónde salen los precios y por qué pueden no estar
                  todos los platos: el local marca como agotado lo que se le
                  acabó, y esta carta no los trae. */}
              <Text style={estilos.pieCarta}>
                La carta la publica el local. No aparecen los platos que haya marcado como
                agotados.
              </Text>
            </Animated.View>
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
  aviso: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.l,
  },

  tarjetaLocal: {
    backgroundColor: COLORES.negroMarca,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
    marginBottom: ESPACIADO.l,
  },
  localNombre: { ...TIPOGRAFIA.titulo, color: COLORES.blanco },
  localDescripcion: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.blanco,
    opacity: 0.8,
    marginTop: ESPACIADO.s,
    marginBottom: ESPACIADO.m,
    lineHeight: 22,
  },
  filaDato: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dato: { ...TIPOGRAFIA.subtitulo, color: COLORES.blanco, opacity: 0.9, marginTop: ESPACIADO.xs },
  enlace: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.blanco,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: ESPACIADO.xs,
  },

  etiquetaSeccion: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoTenue,
    letterSpacing: 2,
    marginBottom: ESPACIADO.s,
    marginTop: ESPACIADO.s,
  },

  bienvenida: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.l,
  },
  bienvenidaTitulo: { ...TIPOGRAFIA.etiqueta, fontSize: 18, color: COLORES.texto },
  bienvenidaTexto: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.xs,
    marginBottom: ESPACIADO.s,
  },
  incluye: { ...TIPOGRAFIA.subtitulo, color: COLORES.texto, marginBottom: 2 },
  bienvenidaPrecio: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.rojoMarca,
    marginTop: ESPACIADO.s,
  },

  menuNombre: {
    ...TIPOGRAFIA.etiqueta,
    fontSize: 17,
    color: COLORES.texto,
    marginTop: ESPACIADO.m,
  },
  seccionMenu: { marginBottom: ESPACIADO.m },
  seccionNombre: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.rojoMarca,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: ESPACIADO.s,
    marginTop: ESPACIADO.s,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: ESPACIADO.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORES.borde,
  },
  itemTexto: { flex: 1, paddingRight: ESPACIADO.m },
  itemNombre: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  itemDescripcion: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  itemPrecio: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  pieCarta: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, marginTop: ESPACIADO.s },
});
