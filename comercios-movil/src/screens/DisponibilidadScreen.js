// Franjas horarias en las que el local puede recibir grupos.
//
// Es la mitad de la condición dura para existir en Seis Más: sin al menos una
// franja activa, el matching no le asigna ningún grupo al comercio por muy
// bueno que sea su plan. Por eso está en esta app y no solo en la web — es lo
// que un local necesita poder apagar desde el teléfono un martes que cierra
// por inventario.
//
// Consume GET/POST/PUT/DELETE /disponibilidad. La API valida el rango (fin
// después de inicio) y el solape con otras franjas del mismo día; aquí se
// muestran esos errores tal cual llegan en vez de duplicar las reglas, que es
// como las dos copias acaban discrepando.
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
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// Coincide con EXTRACT(DOW) de Postgres: 0 = domingo. El mismo orden que usa
// DisponibilidadController, para que el índice sea el valor que viaja.
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// HH:MM en 24 horas, que es lo que valida la API.
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function DisponibilidadScreen({ onVolver }) {
  const [franjas, setFranjas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setFranjas(await api.listarDisponibilidad());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El interruptor de cada franja es la acción frecuente: cerrar hoy sin
  // perder el horario configurado. Se manda solo `activo`, que la API acepta
  // como envío parcial.
  const alternar = async (franja) => {
    setError(null);
    // Optimista: el interruptor responde al instante y se revierte si la API
    // falla. Esperar la red para mover un switch se siente roto.
    setFranjas((prev) =>
      prev.map((f) => (f.id === franja.id ? { ...f, activo: !f.activo } : f)),
    );
    try {
      await api.actualizarFranja(franja.id, { activo: !franja.activo });
    } catch (e) {
      setError(e.message);
      setFranjas((prev) => prev.map((f) => (f.id === franja.id ? franja : f)));
    }
  };

  const eliminar = async (franja) => {
    setError(null);
    try {
      await api.eliminarFranja(franja.id);
      setFranjas((prev) => prev.filter((f) => f.id !== franja.id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo="Disponibilidad" onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : (
          <>
            {franjas.length === 0 ? (
              <View style={styles.aviso}>
                <Text style={styles.avisoTitulo}>Todavía no dices cuándo puedes recibir</Text>
                <Text style={styles.avisoTexto}>
                  Sin al menos una franja activa, Seis Más no te asigna grupos.
                </Text>
              </View>
            ) : (
              franjas.map((franja) => (
                <Franja
                  key={franja.id}
                  franja={franja}
                  onAlternar={() => alternar(franja)}
                  onEliminar={() => eliminar(franja)}
                />
              ))
            )}

            {creando ? (
              <FormularioFranja
                onCancelar={() => setCreando(false)}
                onCreada={(nueva) => {
                  // Se reordena igual que la API (día, luego hora) para que la
                  // franja recién creada aparezca donde le toca y no al final.
                  setFranjas((prev) =>
                    [...prev, nueva].sort(
                      (a, b) =>
                        a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio),
                    ),
                  );
                  setCreando(false);
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setCreando(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaTexto}>Agregar franja</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Franja({ franja, onAlternar, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <View style={styles.franja}>
      <View style={styles.franjaFila}>
        <View style={styles.franjaDatos}>
          <Text style={[styles.franjaDia, !franja.activo && styles.apagado]}>
            {/* dia_nombre lo calcula la API; se usa el suyo para no tener dos
                listas de días que puedan desalinearse. */}
            {franja.dia_nombre}
          </Text>
          <Text style={[styles.franjaHoras, !franja.activo && styles.apagado]}>
            {franja.hora_inicio} – {franja.hora_fin} · hasta {franja.grupos_max}{' '}
            {franja.grupos_max === 1 ? 'grupo' : 'grupos'}
          </Text>
        </View>
        <Switch
          value={franja.activo}
          onValueChange={onAlternar}
          trackColor={{ true: COLORES.rojoMarca, false: COLORES.borde }}
        />
      </View>

      {confirmando ? (
        <View style={styles.confirmacion}>
          <Text style={styles.confirmacionTexto}>¿Eliminar esta franja?</Text>
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
        <TouchableOpacity onPress={() => setConfirmando(true)}>
          <Text style={styles.eliminar}>Eliminar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FormularioFranja({ onCancelar, onCreada }) {
  const [dia, setDia] = useState(5); // viernes: el día más probable de un plan
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [gruposMax, setGruposMax] = useState('1');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const crear = async () => {
    const nuevos = {};
    if (!REGEX_HORA.test(inicio)) nuevos.inicio = 'Escribe la hora como HH:MM (24 horas)';
    if (!REGEX_HORA.test(fin)) nuevos.fin = 'Escribe la hora como HH:MM (24 horas)';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || enviando) return;

    setEnviando(true);
    setError(null);
    try {
      onCreada(
        await api.crearFranja({
          dia_semana: dia,
          hora_inicio: inicio,
          hora_fin: fin,
          grupos_max: Number(gruposMax) || 1,
          activo: true,
        }),
      );
    } catch (e) {
      // Aquí llegan los errores que solo la API puede saber: que la franja se
      // solapa con otra del mismo día, o que el rango está al revés.
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  // Autoformato de HH:MM: se teclean dígitos y los dos puntos los pone la
  // pantalla, para poder usar el teclado numérico.
  const cambiarHora = (asignar) => (valor) => {
    const digitos = valor.replace(/[^\d]/g, '').slice(0, 4);
    asignar(digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos);
  };

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>Nueva franja</Text>

      <Text style={styles.etiqueta}>Día</Text>
      <View style={styles.dias}>
        {DIAS.map((nombre, indice) => (
          <TouchableOpacity
            key={nombre}
            style={[styles.dia, dia === indice && styles.diaActivo]}
            onPress={() => setDia(indice)}
            activeOpacity={0.85}
          >
            <Text style={[styles.diaTexto, dia === indice && styles.diaTextoActivo]}>
              {nombre.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <CampoTexto
        icono="🕐"
        etiqueta="Desde"
        placeholder="19:00"
        valor={inicio}
        onCambiar={cambiarHora(setInicio)}
        error={errores.inicio}
        keyboardType="number-pad"
        maxLength={5}
      />
      <CampoTexto
        icono="🕐"
        etiqueta="Hasta"
        placeholder="23:00"
        valor={fin}
        onCambiar={cambiarHora(setFin)}
        error={errores.fin}
        keyboardType="number-pad"
        maxLength={5}
      />
      <CampoTexto
        icono="👥"
        etiqueta="Grupos a la vez"
        placeholder="1"
        valor={gruposMax}
        onCambiar={(v) => setGruposMax(v.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
      />

      {error ? <Text style={styles.error}>😕 {error}</Text> : null}

      <TouchableOpacity
        style={[styles.cta, enviando && styles.ctaDeshabilitado]}
        onPress={crear}
        disabled={enviando}
        activeOpacity={0.85}
      >
        {enviando ? (
          <ActivityIndicator color={COLORES.blanco} />
        ) : (
          <Text style={styles.ctaTexto}>Guardar franja</Text>
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
  franja: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  franjaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  franjaDatos: { flex: 1 },
  franjaDia: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, textTransform: 'capitalize' },
  franjaHoras: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  apagado: { opacity: 0.45 },
  eliminar: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, marginTop: ESPACIADO.s },
  confirmacion: { marginTop: ESPACIADO.s },
  confirmacionTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.texto },
  confirmacionBotones: { flexDirection: 'row', gap: ESPACIADO.l, marginTop: ESPACIADO.xs },
  eliminarSi: { ...TIPOGRAFIA.etiqueta, color: COLORES.error },
  eliminarNo: { ...TIPOGRAFIA.etiqueta, color: COLORES.textoSuave },
  formulario: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginTop: ESPACIADO.m,
  },
  formularioTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.m },
  etiqueta: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.s },
  dias: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIADO.xs, marginBottom: ESPACIADO.m },
  dia: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.chip,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  diaActivo: { backgroundColor: COLORES.rojoMarca, borderColor: COLORES.rojoMarca },
  diaTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, fontWeight: '600' },
  diaTextoActivo: { color: COLORES.blanco },
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
