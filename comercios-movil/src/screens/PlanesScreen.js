// Planes del comercio: la experiencia concreta que se le ofrece a un grupo de
// seis.
//
// Es la otra mitad de la condición dura para existir en Seis Más. La
// disponibilidad dice CUÁNDO puede recibir el local; el plan dice QUÉ ofrece, y
// sobre todo A QUIÉN: el `interes_id` es lo que hace competir al plan, porque
// el matching exige que al menos la mitad del grupo comparta ese interés antes
// de mirar nada más. Sin un plan activo el comercio no recibe menos grupos —
// no lo ve el algoritmo.
//
// Por eso esta pantalla está en la app y no solo en la web: cambiar el precio
// o apagar el plan que hoy no se puede dar es operación de un martes
// cualquiera, no configuración inicial.
//
// Consume GET/POST/PUT/DELETE /planes y GET /intereses. Las reglas duras
// (capacidad mínima de seis, duración positiva, interés que exista en el
// catálogo) las valida la API y sus mensajes se muestran tal cual: duplicarlas
// aquí es como las dos copias acaban discrepando.
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

export default function PlanesScreen({ onVolver }) {
  const [planes, setPlanes] = useState([]);
  const [intereses, setIntereses] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // `null` = no hay formulario abierto; `'nuevo'` = alta; un plan = edición.
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // En paralelo: son dos peticiones independientes y encadenarlas solo
      // haría esperar el doble en la conexión de un local.
      const [lista, catalogo] = await Promise.all([api.listarPlanes(), api.listarIntereses()]);
      setPlanes(lista);
      setIntereses(catalogo);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Apagar y encender es la acción frecuente: el plan sigue configurado, solo
  // deja de ofrecerse. Optimista igual que en disponibilidad — esperar a la red
  // para mover un switch se siente roto — y se revierte si la API falla, que si
  // no el local creería que retiró un plan que sigue vivo.
  const alternar = async (plan) => {
    setError(null);
    setPlanes((prev) => prev.map((p) => (p.id === plan.id ? { ...p, activo: !p.activo } : p)));
    try {
      await api.actualizarPlan(plan.id, { activo: !plan.activo });
    } catch (e) {
      setError(e.message);
      setPlanes((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
    }
  };

  const eliminar = async (plan) => {
    setError(null);
    try {
      await api.eliminarPlan(plan.id);
      setPlanes((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (e) {
      setError(e.message);
    }
  };

  // La API ordena activos primero y luego por fecha de creación descendente.
  // Se replica al guardar para que un plan recién creado o reactivado aparezca
  // donde le toca sin tener que recargar la lista entera.
  const ordenar = (lista) =>
    [...lista].sort((a, b) => (b.activo ? 1 : 0) - (a.activo ? 1 : 0));

  const guardado = (plan) => {
    setPlanes((prev) =>
      ordenar(prev.some((p) => p.id === plan.id)
        ? prev.map((p) => (p.id === plan.id ? plan : p))
        : [plan, ...prev]),
    );
    setEditando(null);
  };

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo="Planes" onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : (
          <>
            {planes.length === 0 ? (
              <View style={styles.aviso}>
                <Text style={styles.avisoTitulo}>Todavía no ofreces ningún plan</Text>
                <Text style={styles.avisoTexto}>
                  Un plan es lo que Seis Más le propone a un grupo. Sin ninguno activo, no
                  entras en el reparto de grupos.
                </Text>
              </View>
            ) : (
              planes.map((plan) =>
                // El plan que se está editando cede su sitio al formulario, en
                // vez de abrirlo debajo: así no hay dos títulos iguales en
                // pantalla ni duda sobre cuál se está tocando.
                editando && editando.id === plan.id ? (
                  <FormularioPlan
                    key={plan.id}
                    plan={plan}
                    intereses={intereses}
                    onCancelar={() => setEditando(null)}
                    onGuardado={guardado}
                  />
                ) : (
                  <Plan
                    key={plan.id}
                    plan={plan}
                    onAlternar={() => alternar(plan)}
                    onEditar={() => setEditando(plan)}
                    onEliminar={() => eliminar(plan)}
                  />
                ),
              )
            )}

            {editando === 'nuevo' ? (
              <FormularioPlan
                intereses={intereses}
                onCancelar={() => setEditando(null)}
                onGuardado={guardado}
              />
            ) : editando === null ? (
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setEditando('nuevo')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaTexto}>Crear plan</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Plan({ plan, onAlternar, onEditar, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <View style={styles.plan}>
      <View style={styles.planFila}>
        <View style={styles.planDatos}>
          <Text style={[styles.planCategoria, !plan.activo && styles.apagado]}>
            {/* Nombre e ícono del interés los manda la API con el plan, para no
                tener que cruzar el catálogo en el cliente. */}
            {plan.interes_icono ? `${plan.interes_icono} ` : ''}
            {plan.interes_nombre}
          </Text>
          <Text style={[styles.planTitulo, !plan.activo && styles.apagado]}>{plan.titulo}</Text>
          <Text style={[styles.planDetalle, !plan.activo && styles.apagado]}>
            ${formatearPrecio(plan.precio)} · {plan.duracion_min} min · {plan.capacidad} personas
          </Text>
        </View>
        <Switch
          value={plan.activo}
          onValueChange={onAlternar}
          trackColor={{ true: COLORES.rojoMarca, false: COLORES.borde }}
        />
      </View>

      {plan.descripcion ? (
        <Text style={[styles.planDescripcion, !plan.activo && styles.apagado]}>
          {plan.descripcion}
        </Text>
      ) : null}

      {confirmando ? (
        <View style={styles.confirmacion}>
          <Text style={styles.confirmacionTexto}>
            ¿Eliminar este plan? Los eventos que ya lo tengan asignado no se tocan.
          </Text>
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
            <Text style={styles.editar}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmando(true)}>
            <Text style={styles.eliminar}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Alta y edición son el mismo formulario: los campos son los mismos y la única
// diferencia es si hay un plan de partida y a qué endpoint se manda.
function FormularioPlan({ plan, intereses, onCancelar, onGuardado }) {
  const [interesId, setInteresId] = useState(plan?.interes_id ?? null);
  const [titulo, setTitulo] = useState(plan?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(plan?.descripcion ?? '');
  const [duracion, setDuracion] = useState(String(plan?.duracion_min ?? 120));
  // El precio se teclea en pesos enteros: la API acepta decimales, pero no hay
  // carta en Colombia con centavos y un separador en el teclado numérico es una
  // fuente de errores gratis.
  const [precio, setPrecio] = useState(String(Math.round(plan?.precio ?? 0)));
  const [capacidad, setCapacidad] = useState(String(plan?.capacidad ?? 6));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    // Solo se valida aquí lo que la app puede saber sin preguntar: que hay
    // título y categoría. Los mínimos (capacidad de seis, duración mayor que
    // cero) los decide la API, y sus mensajes explican el porqué mejor que un
    // "campo inválido".
    const nuevos = {};
    if (!titulo.trim()) nuevos.titulo = 'Ponle un nombre al plan';
    if (!interesId) nuevos.interes = 'Elige una categoría';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || enviando) return;

    setEnviando(true);
    setError(null);
    const datos = {
      interes_id: interesId,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      duracion_min: Number(duracion) || 0,
      precio: Number(precio) || 0,
      capacidad: Number(capacidad) || 0,
    };
    try {
      onGuardado(
        plan ? await api.actualizarPlan(plan.id, datos) : await api.crearPlan({ ...datos, activo: true }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const soloDigitos = (asignar) => (valor) => asignar(valor.replace(/[^\d]/g, ''));

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>{plan ? 'Editar plan' : 'Nuevo plan'}</Text>

      <Text style={styles.etiqueta}>Categoría</Text>
      {/* La categoría no es una etiqueta decorativa: es lo que decide a qué
          grupos se le ofrece el plan. Por eso va primero y en chips, no
          escondida en un desplegable al final del formulario. */}
      <View style={styles.categorias}>
        {intereses.map((interes) => (
          <TouchableOpacity
            key={interes.id}
            style={[styles.categoria, interesId === interes.id && styles.categoriaActiva]}
            onPress={() => setInteresId(interes.id)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.categoriaTexto,
                interesId === interes.id && styles.categoriaTextoActiva,
              ]}
            >
              {interes.icono ? `${interes.icono} ` : ''}
              {interes.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errores.interes ? <Text style={styles.errorCampo}>{errores.interes}</Text> : null}

      <CampoTexto
        icono="🍽️"
        etiqueta="Nombre del plan"
        placeholder="Noche de tapas para seis"
        valor={titulo}
        onCambiar={setTitulo}
        error={errores.titulo}
        maxLength={80}
      />
      <CampoTexto
        icono="📝"
        etiqueta="Descripción (opcional)"
        placeholder="Qué incluye y cómo transcurre"
        valor={descripcion}
        onCambiar={setDescripcion}
        multiline
        numberOfLines={3}
        maxLength={400}
      />
      <CampoTexto
        icono="💵"
        etiqueta="Precio por persona"
        placeholder="45000"
        valor={precio}
        onCambiar={soloDigitos(setPrecio)}
        keyboardType="number-pad"
        maxLength={9}
      />
      <CampoTexto
        icono="⏱️"
        etiqueta="Duración (minutos)"
        placeholder="120"
        valor={duracion}
        onCambiar={soloDigitos(setDuracion)}
        keyboardType="number-pad"
        maxLength={4}
      />
      <CampoTexto
        icono="👥"
        etiqueta="Capacidad"
        placeholder="6"
        valor={capacidad}
        onCambiar={soloDigitos(setCapacidad)}
        keyboardType="number-pad"
        maxLength={3}
      />
      <Text style={styles.ayuda}>
        Los grupos de Seis Más siempre llegan completos: seis personas es el mínimo.
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
          <Text style={styles.ctaTexto}>{plan ? 'Guardar cambios' : 'Guardar plan'}</Text>
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
  errorCampo: { ...TIPOGRAFIA.ayuda, color: COLORES.error, marginBottom: ESPACIADO.m },
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
  plan: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  planFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planDatos: { flex: 1, paddingRight: ESPACIADO.s },
  planCategoria: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave },
  planTitulo: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginTop: 2 },
  planDetalle: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  planDescripcion: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginTop: ESPACIADO.s,
    lineHeight: 19,
  },
  apagado: { opacity: 0.45 },
  acciones: { flexDirection: 'row', gap: ESPACIADO.l, marginTop: ESPACIADO.s },
  editar: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave },
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
  etiqueta: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, marginBottom: ESPACIADO.s },
  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ESPACIADO.xs,
    marginBottom: ESPACIADO.m,
  },
  categoria: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.chip,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoriaActiva: { backgroundColor: COLORES.rojoMarca, borderColor: COLORES.rojoMarca },
  categoriaTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, fontWeight: '600' },
  categoriaTextoActiva: { color: COLORES.blanco },
  ayuda: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, lineHeight: 18 },
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
