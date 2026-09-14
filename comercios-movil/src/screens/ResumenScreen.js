// Inicio de la app de comercios. Consume GET /resumen, que trae en una sola
// petición los contadores, los próximos eventos y qué le falta al local para
// poder recibir grupos.
//
// El orden de la pantalla es el orden de urgencia real de un local:
//
//   1. Lo que pasa hoy — si llega un grupo esta noche, es lo único que importa.
//   2. Lo que falta para existir — sin plan ni disponibilidad activos el local
//      no compite por ningún grupo, por muy completo que tenga el perfil. La
//      API ya distingue eso y manda la lista calculada en el servidor.
//   3. Los próximos días.
//   4. Los contadores, que son contexto y no acción.
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
import { fechaCorta, horaSola, esHoy, estadoLegible } from '../util/formato';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

export default function ResumenScreen({ onVerEvento, onIrA, onCuenta }) {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (esRefresco = false) => {
    if (!esRefresco) setCargando(true);
    setError(null);
    try {
      setResumen(await api.obtenerResumen());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const refrescar = () => {
    setRefrescando(true);
    cargar(true);
  };

  const proximos = resumen?.proximos_eventos || [];
  const deHoy = proximos.filter((e) => esHoy(e.fecha_hora));
  const masAdelante = proximos.filter((e) => !esHoy(e.fecha_hora));
  const pendientes = resumen?.pendientes || [];

  if (cargando) {
    return (
      <View style={styles.pantalla}>
        <EncabezadoMarca titulo="Tu local" onCuenta={onCuenta} />
        <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca
        titulo={resumen?.comercio?.nombre || 'Tu local'}
        subtitulo={resumen?.comercio?.ciudad || undefined}
        onCuenta={onCuenta}
      />

      <ScrollView
        contentContainerStyle={styles.cuerpo}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={COLORES.rojoMarca} />
        }
      >
        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {/* Hoy. Solo aparece si hay algo: una tarjeta vacía que diga "nada hoy"
            ocuparía el sitio más valioso de la pantalla para no decir nada. */}
        {deHoy.length > 0 ? (
          <View style={styles.bloque}>
            <Text style={styles.tituloBloque}>HOY</Text>
            {deHoy.map((evento) => (
              <TarjetaEvento key={evento.id} evento={evento} destacado onPress={() => onVerEvento(evento)} />
            ))}
          </View>
        ) : null}

        {/* Lo que falta para recibir grupos. La API calcula la lista y la
            ordena: el plan y la disponibilidad van primero porque son la
            condición dura, el resto solo mejora la experiencia. */}
        {pendientes.length > 0 ? (
          <View style={styles.bloque}>
            <Text style={styles.tituloBloque}>PARA RECIBIR GRUPOS TE FALTA</Text>
            {pendientes.map((p) => (
              <View key={p.clave} style={styles.pendiente}>
                <Text style={styles.pendienteTexto}>{p.texto}</Text>
                {/* Ya no hay pendientes sin pantalla: todo lo que la API puede
                    pedir se resuelve dentro de la app. */}
                <TouchableOpacity onPress={() => onIrA(DESTINO_PENDIENTE[p.clave])}>
                  <Text style={styles.pendienteAccion}>Resolver →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {masAdelante.length > 0 ? (
          <View style={styles.bloque}>
            <Text style={styles.tituloBloque}>PRÓXIMOS</Text>
            {masAdelante.map((evento) => (
              <TarjetaEvento key={evento.id} evento={evento} onPress={() => onVerEvento(evento)} />
            ))}
          </View>
        ) : null}

        {proximos.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>Todavía no tienes grupos asignados</Text>
            <Text style={styles.vacioTexto}>
              {pendientes.length > 0
                ? 'Completa lo de arriba y Seis Más empezará a mandarte grupos.'
                : 'Tu local ya está listo. En cuanto se forme un grupo afín, aparecerá aquí.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.accesos}>
          <Acceso texto="Eventos" onPress={() => onIrA('eventos')} />
          <Acceso texto="Planes" onPress={() => onIrA('planes')} />
          <Acceso texto="Disponibilidad" onPress={() => onIrA('disponibilidad')} />
          <Acceso texto="Anfitriones" onPress={() => onIrA('anfitriones')} />
          <Acceso texto="Bienvenida" onPress={() => onIrA('propuestas')} />
          <Acceso texto="Menús" onPress={() => onIrA('menus')} />
          <Acceso texto="Mi comercio" onPress={() => onIrA('mi-comercio')} />
        </View>

        {resumen?.contadores ? <Contadores contadores={resumen.contadores} /> : null}
      </ScrollView>
    </View>
  );
}

// Qué pantalla resuelve cada pendiente que manda la API. Están los seis que
// puede mandar ResumenController: ya no queda ninguno que haya que ir a
// resolver a otra parte.
const DESTINO_PENDIENTE = {
  plan: 'planes',
  disponibilidad: 'disponibilidad',
  direccion: 'mi-comercio',
  descripcion: 'mi-comercio',
  anfitrion: 'anfitriones',
  propuesta: 'propuestas',
  menu: 'menus',
};

function TarjetaEvento({ evento, destacado, onPress }) {
  const estado = estadoLegible(evento.estado);
  return (
    <TouchableOpacity
      style={[styles.tarjeta, destacado && styles.tarjetaDestacada]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.tarjetaFila}>
        <Text style={[styles.tarjetaFecha, destacado && styles.tarjetaFechaDestacada]}>
          {destacado ? horaSola(evento.fecha_hora) : fechaCorta(evento.fecha_hora)}
        </Text>
        <Text style={[styles.insignia, { color: COLORES[estado.color] }]}>{estado.texto}</Text>
      </View>
      <Text style={styles.tarjetaTitulo}>{evento.titulo}</Text>
      <Text style={styles.tarjetaDato}>
        {/* `tiene_grupo` viene del servidor como booleano: un evento existe
            antes de que el matching le asigne un grupo, y esa espera es normal,
            no un error. */}
        {evento.tiene_grupo ? `${evento.capacidad} personas` : 'Esperando grupo'}
        {evento.anfitrion_nombre ? ` · recibe ${evento.anfitrion_nombre.split(' ')[0]}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

function Acceso({ texto, onPress }) {
  return (
    <TouchableOpacity style={styles.acceso} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.accesoTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

function Contadores({ contadores }) {
  const filas = [
    ['Planes activos', contadores.planes_activos],
    ['Franjas activas', contadores.franjas_activas],
    ['Menús publicados', contadores.menus_publicados],
    ['Anfitriones', contadores.anfitriones_total],
  ];
  return (
    <View style={styles.contadores}>
      {filas.map(([etiqueta, valor]) => (
        <View key={etiqueta} style={styles.contador}>
          <Text style={styles.contadorValor}>{valor}</Text>
          <Text style={styles.contadorEtiqueta}>{etiqueta}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  cuerpo: { padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
  centrado: { marginTop: ESPACIADO.xl },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginBottom: ESPACIADO.m },
  bloque: { marginBottom: ESPACIADO.l },
  tituloBloque: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    letterSpacing: 1,
    marginBottom: ESPACIADO.s,
  },
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  tarjetaDestacada: { borderWidth: 1.5, borderColor: COLORES.rojoMarca },
  tarjetaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  // La fecha se encoge y la insignia no: con la fecha larga de la tarjeta
  // destacada ("martes 1 de septiembre, 8:14 p. m.") las dos llegaban a
  // tocarse, porque space-between reparte el hueco sobrante y no lo inventa
  // cuando no hay. El margen garantiza la separación aunque no sobre nada.
  tarjetaFecha: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, flexShrink: 1, marginRight: ESPACIADO.s },
  tarjetaFechaDestacada: { ...TIPOGRAFIA.etiqueta, color: COLORES.rojoMarca },
  insignia: { ...TIPOGRAFIA.ayuda, fontWeight: '700', flexShrink: 0 },
  tarjetaTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginTop: ESPACIADO.xs },
  tarjetaDato: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: ESPACIADO.xs },
  pendiente: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.campo,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  pendienteTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.texto, lineHeight: 19 },
  pendienteAccion: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.rojoMarca,
    marginTop: ESPACIADO.s,
  },
  vacio: { paddingVertical: ESPACIADO.xl, alignItems: 'center' },
  vacioTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, textAlign: 'center' },
  vacioTexto: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.s,
    lineHeight: 19,
  },
  accesos: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIADO.s, marginBottom: ESPACIADO.l },
  acceso: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.boton,
    paddingVertical: 12,
    paddingHorizontal: ESPACIADO.m,
  },
  accesoTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  contadores: { flexDirection: 'row', flexWrap: 'wrap' },
  contador: { width: '50%', paddingVertical: ESPACIADO.s },
  contadorValor: { ...TIPOGRAFIA.titulo, color: COLORES.texto },
  contadorEtiqueta: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave },
});
