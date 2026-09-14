// Los eventos que el local recibe. Consume GET /eventos con el filtro `desde`,
// que es lo que evita arrastrar todo el histórico a un teléfono.
//
// Por defecto muestra de hoy en adelante, que es lo que un local mira. El
// filtro "Pasados" existe para el caso de "¿cuánta gente vino la semana
// pasada?", y es el único que pide el histórico.
//
// Desde aquí también se crea un evento a mano (POST /eventos). Casi todos los
// eventos los propone el matching, pero el local necesita poder abrir uno por
// su cuenta —la llamada de un cliente, una fecha especial— y esa era la última
// cosa que solo se podía hacer desde el panel web.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import CampoTexto from '../components/form/CampoTexto';
import { fechaCorta, estadoLegible, hoyISO, aFecha } from '../util/formato';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

const FILTROS = [
  { clave: 'proximos', texto: 'Próximos' },
  { clave: 'sin_confirmar', texto: 'Sin confirmar' },
  { clave: 'pasados', texto: 'Pasados' },
];

// AAAA-MM-DD y HH:MM por separado. En la web era un `datetime-local`; aquí son
// dos campos numéricos con autoformato, que es más rápido de teclear que
// cualquier selector y no añade una dependencia nativa.
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function EventosScreen({ onVerEvento, onVolver }) {
  const [filtro, setFiltro] = useState('proximos');
  const [creando, setCreando] = useState(false);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (cual, esRefresco = false) => {
    if (!esRefresco) setCargando(true);
    setError(null);
    try {
      // "Pasados" es el único que no filtra por fecha: la API ordena por
      // fecha_hora ascendente siempre, así que aquí se invierte para que lo más
      // reciente quede arriba, que es como se mira el pasado.
      const desde = cual === 'pasados' ? undefined : hoyISO();
      const estado = cual === 'sin_confirmar' ? 'propuesto' : undefined;
      const filas = await api.listarEventos({ desde, estado });
      const ahora = Date.now();
      setEventos(
        cual === 'pasados'
          ? filas.filter((e) => aFecha(e.fecha_hora).getTime() < ahora).reverse()
          : filas,
      );
    } catch (e) {
      setError(e.message);
      setEventos([]);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargar(filtro);
  }, [cargar, filtro]);

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo="Eventos" onVolver={onVolver} />

      <View style={styles.filtros}>
        {FILTROS.map((f) => (
          <TouchableOpacity
            key={f.clave}
            style={[styles.filtro, filtro === f.clave && styles.filtroActivo]}
            onPress={() => setFiltro(f.clave)}
            activeOpacity={0.85}
          >
            <Text style={[styles.filtroTexto, filtro === f.clave && styles.filtroTextoActivo]}>
              {f.texto}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
      ) : (
        <FlatList
          data={eventos}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar(filtro, true);
              }}
              tintColor={COLORES.rojoMarca}
            />
          }
          ListEmptyComponent={
            <Text style={styles.vacio}>
              {error ? `😕 ${error}` : 'No hay eventos en este filtro.'}
            </Text>
          }
          renderItem={({ item }) => <Fila evento={item} onPress={() => onVerEvento(item)} />}
          ListFooterComponent={
            creando ? (
              <FormularioEvento
                onCancelar={() => setCreando(false)}
                onCreado={() => {
                  setCreando(false);
                  // Se recarga en vez de insertar la fila a mano: el evento
                  // recién creado puede caer fuera del filtro activo (uno para
                  // el mes que viene mirando "Sin confirmar"), y meterlo a la
                  // fuerza mostraría algo que ese filtro no debería listar.
                  cargar(filtro);
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setCreando(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaTexto}>Crear evento</Text>
              </TouchableOpacity>
            )
          }
        />
      )}
    </View>
  );
}

// Crear un evento exige un anfitrión del propio comercio: la API rechaza con un
// 422 el de otro negocio, y sin ninguno cargado no hay nada que elegir. Por eso
// la lista de anfitriones se pide al abrir el formulario y, si viene vacía, se
// dice qué falta en vez de mostrar un selector sin opciones.
function FormularioEvento({ onCancelar, onCreado }) {
  const [anfitriones, setAnfitriones] = useState(null);
  const [anfitrionId, setAnfitrionId] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [capacidad, setCapacidad] = useState('6');
  const [precio, setPrecio] = useState('0');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .listarAnfitriones()
      .then((lista) => {
        if (!vivo) return;
        setAnfitriones(lista);
        // Con un solo anfitrión no hay nada que elegir; con varios se propone
        // el titular, que es quien recibe por defecto.
        const sugerido = lista.find((a) => a.titular) || lista[0];
        if (sugerido) setAnfitrionId(sugerido.id);
      })
      .catch((e) => {
        if (vivo) {
          setAnfitriones([]);
          setError(e.message);
        }
      });
    return () => {
      vivo = false;
    };
  }, []);

  const crear = async () => {
    const nuevos = {};
    if (!titulo.trim()) nuevos.titulo = 'Ponle un nombre al evento';
    if (!REGEX_FECHA.test(fecha)) nuevos.fecha = 'Escribe la fecha como AAAA-MM-DD';
    if (!REGEX_HORA.test(hora)) nuevos.hora = 'Escribe la hora como HH:MM (24 horas)';
    if (!anfitrionId) nuevos.anfitrion = 'Elige quién recibe';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || enviando) return;

    setEnviando(true);
    setError(null);
    try {
      await api.crearEvento({
        titulo: titulo.trim(),
        anfitrion_id: anfitrionId,
        // Sin zona horaria, igual que mandaba el datetime-local de la web:
        // Postgres lo interpreta en la zona del servidor, que es la del local.
        fecha_hora: `${fecha} ${hora}`,
        descripcion: descripcion.trim() || null,
        capacidad: Number(capacidad) || 6,
        precio: Number(precio) || 0,
      });
      onCreado();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const cambiarFecha = (valor) => {
    const d = valor.replace(/[^\d]/g, '').slice(0, 8);
    setFecha([d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-'));
  };

  const cambiarHora = (valor) => {
    const d = valor.replace(/[^\d]/g, '').slice(0, 4);
    setHora(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
  };

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>Nuevo evento</Text>

      {anfitriones === null ? (
        <ActivityIndicator color={COLORES.rojoMarca} />
      ) : anfitriones.length === 0 ? (
        <Text style={styles.ayuda}>
          Primero define un anfitrión: un evento necesita a alguien que reciba al grupo.
        </Text>
      ) : (
        <>
          <Text style={styles.etiqueta}>Recibe</Text>
          <View style={styles.anfitriones}>
            {anfitriones.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.anfitrion, anfitrionId === a.id && styles.anfitrionActivo]}
                onPress={() => setAnfitrionId(a.id)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.anfitrionTexto,
                    anfitrionId === a.id && styles.anfitrionTextoActivo,
                  ]}
                >
                  {a.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errores.anfitrion ? <Text style={styles.errorCampo}>{errores.anfitrion}</Text> : null}
        </>
      )}

      <CampoTexto
        icono="🎉"
        etiqueta="Nombre del evento"
        placeholder="Cena larga de jueves"
        valor={titulo}
        onCambiar={setTitulo}
        error={errores.titulo}
        maxLength={80}
      />
      <CampoTexto
        icono="📅"
        etiqueta="Fecha"
        placeholder="2026-09-18"
        valor={fecha}
        onCambiar={cambiarFecha}
        error={errores.fecha}
        keyboardType="number-pad"
        maxLength={10}
      />
      <CampoTexto
        icono="🕐"
        etiqueta="Hora"
        placeholder="20:00"
        valor={hora}
        onCambiar={cambiarHora}
        error={errores.hora}
        keyboardType="number-pad"
        maxLength={5}
      />
      <CampoTexto
        icono="👥"
        etiqueta="Capacidad"
        placeholder="6"
        valor={capacidad}
        onCambiar={(v) => setCapacidad(v.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
      />
      <CampoTexto
        icono="💵"
        etiqueta="Precio por persona"
        placeholder="0"
        valor={precio}
        onCambiar={(v) => setPrecio(v.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        maxLength={9}
      />
      <CampoTexto
        icono="📝"
        etiqueta="Descripción (opcional)"
        placeholder="Qué va a pasar esa noche"
        valor={descripcion}
        onCambiar={setDescripcion}
        multiline
        numberOfLines={3}
        maxLength={400}
      />

      {error ? <Text style={styles.errorCampo}>😕 {error}</Text> : null}

      <TouchableOpacity
        style={[styles.cta, enviando && styles.ctaDeshabilitado]}
        onPress={crear}
        disabled={enviando}
        activeOpacity={0.85}
      >
        {enviando ? (
          <ActivityIndicator color={COLORES.blanco} />
        ) : (
          <Text style={styles.ctaTexto}>Crear evento</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancelar} disabled={enviando}>
        <Text style={styles.cancelar}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

function Fila({ evento, onPress }) {
  const estado = estadoLegible(evento.estado);
  return (
    <TouchableOpacity style={styles.fila} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.filaCabecera}>
        <Text style={styles.filaFecha}>{fechaCorta(evento.fecha_hora)}</Text>
        <Text style={[styles.insignia, { color: COLORES[estado.color] }]}>{estado.texto}</Text>
      </View>
      <Text style={styles.filaTitulo}>{evento.titulo}</Text>
      <Text style={styles.filaDato}>
        {evento.grupo_id ? `${evento.capacidad} personas` : 'Esperando grupo'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  filtros: {
    flexDirection: 'row',
    gap: ESPACIADO.s,
    paddingHorizontal: ESPACIADO.l,
    paddingTop: ESPACIADO.m,
  },
  filtro: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.chip,
    paddingVertical: 8,
    paddingHorizontal: ESPACIADO.m,
  },
  filtroActivo: { backgroundColor: COLORES.rojoMarca, borderColor: COLORES.rojoMarca },
  filtroTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, fontWeight: '600' },
  filtroTextoActivo: { color: COLORES.blanco },
  centrado: { marginTop: ESPACIADO.xl },
  lista: { padding: ESPACIADO.l },
  fila: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  filaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filaFecha: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, flexShrink: 1, marginRight: ESPACIADO.s },
  insignia: { ...TIPOGRAFIA.ayuda, fontWeight: '700', flexShrink: 0 },
  filaTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginTop: ESPACIADO.xs },
  filaDato: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: ESPACIADO.xs },
  vacio: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, textAlign: 'center', marginTop: ESPACIADO.xl },
  formulario: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginTop: ESPACIADO.m,
  },
  formularioTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.m },
  etiqueta: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.s },
  anfitriones: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIADO.xs, marginBottom: ESPACIADO.m },
  anfitrion: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.chip,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  anfitrionActivo: { backgroundColor: COLORES.rojoMarca, borderColor: COLORES.rojoMarca },
  anfitrionTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, fontWeight: '600' },
  anfitrionTextoActivo: { color: COLORES.blanco },
  ayuda: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, lineHeight: 18 },
  errorCampo: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginBottom: ESPACIADO.m },
  cta: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: ESPACIADO.m,
  },
  ctaDeshabilitado: { opacity: 0.7 },
  ctaTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
  cancelar: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.m,
  },
});
