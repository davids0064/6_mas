// Propuestas de bienvenida: con qué se recibe al grupo cuando cruza la puerta.
//
// Es lo que diferencia una reserva de seis desconocidos de una experiencia
// pensada: la copa de entrada, la mesa larga reservada, el juego con el que
// arrancan. Va aparte del plan porque el plan es lo que se contrata y esto es
// cómo se recibe.
//
// Consume GET/POST/PUT/DELETE /propuestas.
//
// Dos cosas de la API que la pantalla tiene que respetar:
//
//   - `incluye` es un TEXT[] de Postgres. Aquí se edita como una línea por
//     ítem, que en un teléfono es más rápido que una lista con botones de
//     agregar y quitar; la API descarta las líneas vacías, así que dejar una en
//     blanco no ensucia nada.
//   - la actualización usa COALESCE: mandar null en un PUT significa "no lo
//     toques". Por eso los campos que se pueden vaciar se mandan como cadena
//     vacía al editar (ver `opcional`), y por eso la vigencia, que son fechas,
//     se puede poner y cambiar pero no borrar desde aquí.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import CampoTexto from '../components/form/CampoTexto';
import { precio as formatearPrecio } from '../util/formato';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// AAAA-MM-DD, que es lo que espera la columna DATE. Vacío también vale: la
// vigencia es opcional y una propuesta sin fechas está siempre vigente.
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default function PropuestasScreen({ onVolver }) {
  const [propuestas, setPropuestas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | propuesta

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPropuestas(await api.listarPropuestas());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Igual que la API: activas primero.
  const ordenar = (lista) => [...lista].sort((a, b) => (b.activa ? 1 : 0) - (a.activa ? 1 : 0));

  // Optimista, como el resto de interruptores de la app, y con la misma razón
  // para revertirse: una propuesta que el local cree apagada y sigue activa se
  // le promete a un grupo que va a llegar esperándola.
  const alternar = async (propuesta) => {
    setError(null);
    setPropuestas((prev) =>
      prev.map((p) => (p.id === propuesta.id ? { ...p, activa: !p.activa } : p)),
    );
    try {
      await api.actualizarPropuesta(propuesta.id, { activa: !propuesta.activa });
    } catch (e) {
      setError(e.message);
      setPropuestas((prev) => prev.map((p) => (p.id === propuesta.id ? propuesta : p)));
    }
  };

  const eliminar = async (propuesta) => {
    setError(null);
    try {
      await api.eliminarPropuesta(propuesta.id);
      setPropuestas((prev) => prev.filter((p) => p.id !== propuesta.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const guardado = (propuesta) => {
    setPropuestas((prev) =>
      ordenar(
        prev.some((p) => p.id === propuesta.id)
          ? prev.map((p) => (p.id === propuesta.id ? propuesta : p))
          : [propuesta, ...prev],
      ),
    );
    setEditando(null);
  };

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo="Bienvenida" onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : (
          <>
            {propuestas.length === 0 ? (
              <View style={styles.aviso}>
                <Text style={styles.avisoTitulo}>Todavía no tienes una bienvenida</Text>
                <Text style={styles.avisoTexto}>
                  Seis personas que no se conocen entran a tu local. La propuesta de
                  bienvenida es lo que hace que eso no empiece en silencio.
                </Text>
              </View>
            ) : (
              propuestas.map((propuesta) =>
                editando && editando.id === propuesta.id ? (
                  <FormularioPropuesta
                    key={propuesta.id}
                    propuesta={propuesta}
                    onCancelar={() => setEditando(null)}
                    onGuardado={guardado}
                  />
                ) : (
                  <Propuesta
                    key={propuesta.id}
                    propuesta={propuesta}
                    onAlternar={() => alternar(propuesta)}
                    onEditar={() => setEditando(propuesta)}
                    onEliminar={() => eliminar(propuesta)}
                  />
                ),
              )
            )}

            {editando === 'nuevo' ? (
              <FormularioPropuesta onCancelar={() => setEditando(null)} onGuardado={guardado} />
            ) : editando === null ? (
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setEditando('nuevo')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaTexto}>Crear bienvenida</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Propuesta({ propuesta, onAlternar, onEditar, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false);
  const incluye = propuesta.incluye || [];
  return (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaFila}>
        <View style={styles.datos}>
          <Text style={[styles.titulo, !propuesta.activa && styles.apagado]}>
            {propuesta.titulo}
          </Text>
          <Text style={[styles.detalle, !propuesta.activa && styles.apagado]}>
            {/* El precio de la bienvenida puede ser cero, y decirlo así es
                mejor que pintar un "$0" que parece un error. */}
            {propuesta.precio_persona > 0
              ? `$${formatearPrecio(propuesta.precio_persona)} por persona`
              : 'Sin costo extra'}
            {propuesta.duracion_min ? ` · ${propuesta.duracion_min} min` : ''}
          </Text>
        </View>
        <Switch
          value={propuesta.activa}
          onValueChange={onAlternar}
          trackColor={{ true: COLORES.rojoMarca, false: COLORES.borde }}
        />
      </View>

      {propuesta.descripcion ? (
        <Text style={[styles.descripcion, !propuesta.activa && styles.apagado]}>
          {propuesta.descripcion}
        </Text>
      ) : null}

      {incluye.length > 0 ? (
        <View style={styles.incluye}>
          {incluye.map((item, i) => (
            <Text key={`${item}-${i}`} style={[styles.item, !propuesta.activa && styles.apagado]}>
              · {item}
            </Text>
          ))}
        </View>
      ) : null}

      {propuesta.vigente_desde || propuesta.vigente_hasta ? (
        <Text style={[styles.vigencia, !propuesta.activa && styles.apagado]}>
          Vigente {propuesta.vigente_desde ? `desde ${propuesta.vigente_desde}` : ''}
          {propuesta.vigente_hasta ? ` hasta ${propuesta.vigente_hasta}` : ''}
        </Text>
      ) : null}

      {confirmando ? (
        <View style={styles.confirmacion}>
          <Text style={styles.confirmacionTexto}>¿Eliminar esta bienvenida?</Text>
          <View style={styles.confirmacionBotones}>
            <TouchableOpacity onPress={onEliminar}>
              <Text style={styles.eliminarSi}>Sí, eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmando(false)}>
              <Text style={styles.eliminarNo}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.acciones}>
          <TouchableOpacity onPress={onEditar}>
            <Text style={styles.accion}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmando(true)}>
            <Text style={styles.eliminar}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FormularioPropuesta({ propuesta, onCancelar, onGuardado }) {
  const [titulo, setTitulo] = useState(propuesta?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(propuesta?.descripcion ?? '');
  // Una línea por ítem: el TEXT[] se arma al guardar.
  const [incluye, setIncluye] = useState((propuesta?.incluye || []).join('\n'));
  const [precio, setPrecio] = useState(String(Math.round(propuesta?.precio_persona ?? 0)));
  const [duracion, setDuracion] = useState(
    propuesta?.duracion_min ? String(propuesta.duracion_min) : '',
  );
  const [desde, setDesde] = useState(propuesta?.vigente_desde ?? '');
  const [hasta, setHasta] = useState(propuesta?.vigente_hasta ?? '');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    const nuevos = {};
    if (!titulo.trim()) nuevos.titulo = 'Ponle un nombre a la bienvenida';
    // Formato nada más: si la fecha es coherente con la otra lo dice la API.
    if (desde && !REGEX_FECHA.test(desde)) nuevos.desde = 'Escribe la fecha como AAAA-MM-DD';
    if (hasta && !REGEX_FECHA.test(hasta)) nuevos.hasta = 'Escribe la fecha como AAAA-MM-DD';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || enviando) return;

    setEnviando(true);
    setError(null);

    const opcional = (valor) => (valor.trim() ? valor.trim() : propuesta ? '' : null);

    const datos = {
      titulo: titulo.trim(),
      descripcion: opcional(descripcion),
      incluye: incluye
        .split('\n')
        .map((linea) => linea.trim())
        .filter(Boolean),
      precio_persona: Number(precio) || 0,
      // Cadena vacía y no null: la API la trata como "sin duración" y la
      // convierte a NULL, mientras que un null en un PUT no cambiaría nada.
      duracion_min: duracion.trim() || '',
    };
    // Las fechas solo viajan si se escribieron: mandarlas vacías en un alta
    // sería un DATE inválido, y en una edición no hay forma de borrarlas.
    if (desde.trim()) datos.vigente_desde = desde.trim();
    if (hasta.trim()) datos.vigente_hasta = hasta.trim();

    try {
      onGuardado(
        propuesta
          ? await api.actualizarPropuesta(propuesta.id, datos)
          : await api.crearPropuesta({ ...datos, activa: true }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  // AAAA-MM-DD tecleando solo dígitos, igual que las horas en disponibilidad.
  const cambiarFecha = (asignar) => (valor) => {
    const d = valor.replace(/[^\d]/g, '').slice(0, 8);
    const partes = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean);
    asignar(partes.join('-'));
  };

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>
        {propuesta ? 'Editar bienvenida' : 'Nueva bienvenida'}
      </Text>

      <CampoTexto
        icono="🥂"
        etiqueta="Nombre"
        placeholder="Brindis de entrada"
        valor={titulo}
        onCambiar={setTitulo}
        error={errores.titulo}
        maxLength={80}
      />
      <CampoTexto
        icono="📝"
        etiqueta="Descripción (opcional)"
        placeholder="Cómo se recibe al grupo cuando llega"
        valor={descripcion}
        onCambiar={setDescripcion}
        multiline
        numberOfLines={3}
        maxLength={400}
      />
      <CampoTexto
        icono="✅"
        etiqueta="Qué incluye"
        placeholder={'Una línea por cosa:\nCopa de bienvenida\nMesa larga reservada'}
        valor={incluye}
        onCambiar={setIncluye}
        multiline
        numberOfLines={4}
        maxLength={600}
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
        icono="⏱️"
        etiqueta="Duración en minutos (opcional)"
        placeholder="30"
        valor={duracion}
        onCambiar={(v) => setDuracion(v.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        maxLength={4}
      />
      <CampoTexto
        icono="📅"
        etiqueta="Vigente desde (opcional)"
        placeholder="2026-09-01"
        valor={desde}
        onCambiar={cambiarFecha(setDesde)}
        error={errores.desde}
        keyboardType="number-pad"
        maxLength={10}
      />
      <CampoTexto
        icono="📅"
        etiqueta="Vigente hasta (opcional)"
        placeholder="2026-12-31"
        valor={hasta}
        onCambiar={cambiarFecha(setHasta)}
        error={errores.hasta}
        keyboardType="number-pad"
        maxLength={10}
      />
      <Text style={styles.ayuda}>
        Sin fechas, la bienvenida está siempre vigente mientras esté encendida.
      </Text>

      {error ? <Text style={styles.error}>😕 {error}</Text> : null}

      <TouchableOpacity
        style={[styles.cta, enviando && styles.ctaDeshabilitado]}
        onPress={guardar}
        disabled={enviando}
        activeOpacity={0.85}
      >
        {enviando ? (
          <ActivityIndicator color={COLORES.blanco} />
        ) : (
          <Text style={styles.ctaTexto}>
            {propuesta ? 'Guardar cambios' : 'Guardar bienvenida'}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancelar} disabled={enviando}>
        <Text style={styles.cancelar}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  cuerpo: { padding: ESPACIADO.l, paddingBottom: ESPACIADO.xl },
  centrado: { marginTop: ESPACIADO.xl },
  error: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginBottom: ESPACIADO.m },
  aviso: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.l,
    marginBottom: ESPACIADO.m,
  },
  avisoTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  avisoTexto: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.xs,
    lineHeight: 19,
  },
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  tarjetaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datos: { flex: 1, paddingRight: ESPACIADO.s },
  titulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  detalle: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  descripcion: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.s,
    lineHeight: 19,
  },
  incluye: { marginTop: ESPACIADO.s },
  item: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, lineHeight: 20 },
  vigencia: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, marginTop: ESPACIADO.s },
  apagado: { opacity: 0.45 },
  acciones: { flexDirection: 'row', gap: ESPACIADO.l, marginTop: ESPACIADO.s },
  accion: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave },
  eliminar: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue },
  confirmacion: { marginTop: ESPACIADO.s },
  confirmacionTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.texto, lineHeight: 19 },
  confirmacionBotones: { flexDirection: 'row', gap: ESPACIADO.l, marginTop: ESPACIADO.xs },
  eliminarSi: { ...TIPOGRAFIA.etiqueta, color: COLORES.error },
  eliminarNo: { ...TIPOGRAFIA.etiqueta, color: COLORES.textoSuave },
  formulario: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginTop: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  formularioTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.m },
  ayuda: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    marginTop: ESPACIADO.xs,
    lineHeight: 18,
  },
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
