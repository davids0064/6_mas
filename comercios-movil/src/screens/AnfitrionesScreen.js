// Anfitriones: quién recibe al grupo cuando llega.
//
// No es un dato de contacto más. En la lista de eventos, "recibe Marcela" es lo
// único que le pone cara a la visita, y el pendiente del resumen ("Define quién
// va a recibir a los grupos") no se puede resolver desde ningún otro sitio de
// la app.
//
// Consume GET/POST/PUT/DELETE /anfitriones.
//
// El titular es exclusivo: la base tiene un índice único parcial que solo
// permite uno por comercio, y la API baja al anterior dentro de la misma
// transacción al nombrar uno nuevo. La pantalla replica ese efecto al recibir
// la respuesta, porque si no la lista mostraría dos titulares hasta la próxima
// recarga.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import EncabezadoMarca from '../components/EncabezadoMarca';
import CampoTexto from '../components/form/CampoTexto';
import { COLORES, TIPOGRAFIA, ESPACIADO, RADIOS } from '../theme/tokens';

// El mismo formato que valida la API con FILTER_VALIDATE_EMAIL. Se comprueba
// aquí solo para no gastar un viaje de red en un correo sin arroba; el veredicto
// de verdad, y el de "ya hay alguien con ese correo", lo sigue dando el servidor.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AnfitrionesScreen({ onVolver }) {
  const [anfitriones, setAnfitriones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | anfitrión

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setAnfitriones(await api.listarAnfitriones());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mismo orden que la API: el titular primero, el resto por nombre.
  const ordenar = (lista) =>
    [...lista].sort(
      (a, b) => (b.titular ? 1 : 0) - (a.titular ? 1 : 0) || a.nombre.localeCompare(b.nombre),
    );

  const guardado = (anfitrion) => {
    setAnfitriones((prev) => {
      const otros = prev.filter((a) => a.id !== anfitrion.id);
      // Si el guardado es el titular, los demás dejan de serlo: es lo que
      // acaba de hacer la API en su transacción.
      return ordenar([
        ...(anfitrion.titular ? otros.map((a) => ({ ...a, titular: false })) : otros),
        anfitrion,
      ]);
    });
    setEditando(null);
  };

  const hacerTitular = async (anfitrion) => {
    setError(null);
    try {
      guardado(await api.actualizarAnfitrion(anfitrion.id, { titular: true }));
    } catch (e) {
      setError(e.message);
    }
  };

  const eliminar = async (anfitrion) => {
    setError(null);
    try {
      await api.eliminarAnfitrion(anfitrion.id);
      setAnfitriones((prev) => prev.filter((a) => a.id !== anfitrion.id));
    } catch (e) {
      // Aquí llega el caso que solo la base conoce: un anfitrión que ya atendió
      // eventos no se puede quitar de en medio sin perder ese rastro.
      setError(e.message);
    }
  };

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo="Anfitriones" onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : (
          <>
            {anfitriones.length === 0 ? (
              <View style={styles.aviso}>
                <Text style={styles.avisoTitulo}>Todavía no dices quién recibe</Text>
                <Text style={styles.avisoTexto}>
                  El grupo llega buscando a alguien. Sin un anfitrión, la app no puede
                  decirle a quién.
                </Text>
              </View>
            ) : (
              anfitriones.map((anfitrion) =>
                editando && editando.id === anfitrion.id ? (
                  <FormularioAnfitrion
                    key={anfitrion.id}
                    anfitrion={anfitrion}
                    onCancelar={() => setEditando(null)}
                    onGuardado={guardado}
                  />
                ) : (
                  <Anfitrion
                    key={anfitrion.id}
                    anfitrion={anfitrion}
                    onEditar={() => setEditando(anfitrion)}
                    onHacerTitular={() => hacerTitular(anfitrion)}
                    onEliminar={() => eliminar(anfitrion)}
                  />
                ),
              )
            )}

            {editando === 'nuevo' ? (
              <FormularioAnfitrion
                // El primero que se crea es el titular por defecto: un comercio
                // con un solo anfitrión y ningún titular es un estado que no
                // significa nada.
                titularPorDefecto={anfitriones.length === 0}
                onCancelar={() => setEditando(null)}
                onGuardado={guardado}
              />
            ) : editando === null ? (
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setEditando('nuevo')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaTexto}>Agregar anfitrión</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Anfitrion({ anfitrion, onEditar, onHacerTitular, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaFila}>
        <Text style={styles.nombre}>{anfitrion.nombre}</Text>
        {anfitrion.titular ? <Text style={styles.insignia}>TITULAR</Text> : null}
      </View>
      <Text style={styles.dato}>{anfitrion.email}</Text>
      {anfitrion.telefono ? <Text style={styles.dato}>{anfitrion.telefono}</Text> : null}
      {anfitrion.bio ? <Text style={styles.bio}>{anfitrion.bio}</Text> : null}

      {confirmando ? (
        <View style={styles.confirmacion}>
          <Text style={styles.confirmacionTexto}>
            ¿Quitar a {anfitrion.nombre.split(' ')[0]}? Los eventos que ya atendió siguen
            mostrando su nombre.
          </Text>
          <View style={styles.confirmacionBotones}>
            <TouchableOpacity onPress={onEliminar}>
              <Text style={styles.eliminarSi}>Sí, quitar</Text>
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
          {!anfitrion.titular ? (
            <TouchableOpacity onPress={onHacerTitular}>
              <Text style={styles.accion}>Hacer titular</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setConfirmando(true)}>
            <Text style={styles.eliminar}>Quitar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FormularioAnfitrion({ anfitrion, titularPorDefecto, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(anfitrion?.nombre ?? '');
  const [email, setEmail] = useState(anfitrion?.email ?? '');
  const [telefono, setTelefono] = useState(anfitrion?.telefono ?? '');
  const [bio, setBio] = useState(anfitrion?.bio ?? '');
  const [titular, setTitular] = useState(anfitrion?.titular ?? Boolean(titularPorDefecto));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    const nuevos = {};
    if (!nombre.trim()) nuevos.nombre = 'Escribe el nombre de quien recibe';
    if (!REGEX_EMAIL.test(email.trim())) nuevos.email = 'Escribe un correo válido';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || enviando) return;

    setEnviando(true);
    setError(null);

    // Los opcionales viajan distinto según sea alta o edición, y no es un
    // capricho: la API actualiza con COALESCE, así que un null en un PUT
    // significa "no lo toques", no "bórralo". Para poder vaciar un teléfono hay
    // que mandar cadena vacía; en el alta se manda null para que la columna
    // quede NULL y no con un texto en blanco.
    const opcional = (valor) => (valor.trim() ? valor.trim() : anfitrion ? '' : null);

    const datos = {
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      telefono: opcional(telefono),
      bio: opcional(bio),
      titular,
    };

    try {
      onGuardado(
        anfitrion ? await api.actualizarAnfitrion(anfitrion.id, datos) : await api.crearAnfitrion(datos),
      );
    } catch (e) {
      // El correo repetido (409) llega por aquí: es la única regla que la app
      // no puede comprobar sola, porque depende del resto de la tabla.
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>
        {anfitrion ? 'Editar anfitrión' : 'Nuevo anfitrión'}
      </Text>

      <CampoTexto
        icono="🙋"
        etiqueta="Nombre"
        placeholder="Marcela Ríos"
        valor={nombre}
        onCambiar={setNombre}
        error={errores.nombre}
        maxLength={80}
      />
      <CampoTexto
        icono="✉️"
        etiqueta="Correo"
        placeholder="marcela@ellocal.co"
        valor={email}
        onCambiar={setEmail}
        error={errores.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={120}
      />
      <CampoTexto
        icono="📞"
        etiqueta="Teléfono (opcional)"
        placeholder="300 123 4567"
        valor={telefono}
        onCambiar={setTelefono}
        keyboardType="phone-pad"
        maxLength={30}
      />
      <CampoTexto
        icono="📝"
        etiqueta="Presentación (opcional)"
        placeholder="Lleva ocho años en la barra y se sabe la carta de memoria"
        valor={bio}
        onCambiar={setBio}
        multiline
        numberOfLines={3}
        maxLength={300}
      />

      {/* Un botón y no un switch: nombrar titular tiene efecto sobre los demás
          anfitriones, y un interruptor sugiere que se puede tener a varios
          encendidos a la vez. */}
      <TouchableOpacity
        style={[styles.titularOpcion, titular && styles.titularOpcionActiva]}
        onPress={() => setTitular(!titular)}
        activeOpacity={0.85}
      >
        <Text style={[styles.titularTexto, titular && styles.titularTextoActivo]}>
          {titular ? '✓ ' : ''}Es el anfitrión titular
        </Text>
      </TouchableOpacity>
      <Text style={styles.ayuda}>
        Solo puede haber uno. Si eliges a esta persona, quien lo fuera deja de serlo.
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
          <Text style={styles.ctaTexto}>{anfitrion ? 'Guardar cambios' : 'Guardar anfitrión'}</Text>
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
  tarjetaFila: { flexDirection: 'row', alignItems: 'center', gap: ESPACIADO.s },
  nombre: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, flexShrink: 1 },
  insignia: { ...TIPOGRAFIA.ayuda, color: COLORES.rojoMarca, fontWeight: '700', fontSize: 11 },
  dato: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  bio: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: ESPACIADO.s, lineHeight: 19 },
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
  titularOpcion: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.campo,
    paddingVertical: 12,
    paddingHorizontal: ESPACIADO.m,
    alignItems: 'center',
  },
  titularOpcionActiva: { backgroundColor: COLORES.rojoMarca, borderColor: COLORES.rojoMarca },
  titularTexto: { ...TIPOGRAFIA.etiqueta, color: COLORES.textoSuave },
  titularTextoActivo: { color: COLORES.blanco },
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
