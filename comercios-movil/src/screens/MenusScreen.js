// Menús del comercio: la lista.
//
// Es la última pantalla que le quedaba al panel web, y la que más se resistía a
// un teléfono: el editor es un árbol de tres niveles (menú → secciones →
// ítems). La solución no es meter el árbol entero en una pantalla, sino
// partirlo donde ya está partido — aquí se ve la lista de menús y su estado, y
// el contenido de uno se edita en `MenuEditorScreen`. En la web eran dos rutas
// (`/panel/menus` y `/panel/menus/:id`) por la misma razón.
//
// Consume GET/POST/PUT/DELETE /menus.
//
// El estado (borrador, publicado, archivado) es lo que decide si el menú se ve
// desde fuera, así que se cambia desde la lista y no escondido dentro del
// editor: es la acción que se busca cuando ya está todo escrito.
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

// Los tres que acepta la API (MenuController::ESTADOS). Se pintan con el color
// que dice lo que significan: publicado es lo único que ve alguien de fuera.
export const ESTADOS_MENU = {
  borrador: { texto: 'Borrador', color: 'textoSuave' },
  publicado: { texto: 'Publicado', color: 'exito' },
  archivado: { texto: 'Archivado', color: 'textoTenue' },
};

export default function MenusScreen({ onAbrirMenu, onVolver }) {
  const [menus, setMenus] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | menú

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setMenus(await api.listarMenus());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardado = (menu) => {
    setMenus((prev) =>
      prev.some((m) => m.id === menu.id)
        ? // El PUT devuelve el menú sin los conteos, que son subconsultas del
          // listado. Se conservan los que ya había en vez de mostrar "0
          // secciones" en un menú que tiene seis.
          prev.map((m) => (m.id === menu.id ? { ...m, ...menu } : m))
        : [...prev, { total_secciones: 0, total_items: 0, ...menu }],
    );
    setEditando(null);
  };

  const cambiarEstado = async (menu, estado) => {
    setError(null);
    const antes = menu.estado;
    setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, estado } : m)));
    try {
      await api.actualizarMenu(menu.id, { estado });
    } catch (e) {
      setError(e.message);
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, estado: antes } : m)));
    }
  };

  const eliminar = async (menu) => {
    setError(null);
    try {
      await api.eliminarMenu(menu.id);
      setMenus((prev) => prev.filter((m) => m.id !== menu.id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo="Menús" onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : (
          <>
            {menus.length === 0 ? (
              <View style={styles.aviso}>
                <Text style={styles.avisoTitulo}>Todavía no tienes ningún menú</Text>
                <Text style={styles.avisoTexto}>
                  Es lo que el grupo mira cuando se sienta. Sin un menú publicado, llega sin
                  saber qué va a comer.
                </Text>
              </View>
            ) : (
              menus.map((menu) =>
                editando && editando.id === menu.id ? (
                  <FormularioMenu
                    key={menu.id}
                    menu={menu}
                    onCancelar={() => setEditando(null)}
                    onGuardado={guardado}
                  />
                ) : (
                  <Menu
                    key={menu.id}
                    menu={menu}
                    onAbrir={() => onAbrirMenu(menu)}
                    onEditar={() => setEditando(menu)}
                    onCambiarEstado={(estado) => cambiarEstado(menu, estado)}
                    onEliminar={() => eliminar(menu)}
                  />
                ),
              )
            )}

            {editando === 'nuevo' ? (
              <FormularioMenu onCancelar={() => setEditando(null)} onGuardado={guardado} />
            ) : editando === null ? (
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setEditando('nuevo')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaTexto}>Crear menú</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Menu({ menu, onAbrir, onEditar, onCambiarEstado, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false);
  const estado = ESTADOS_MENU[menu.estado] || ESTADOS_MENU.borrador;
  const secciones = Number(menu.total_secciones) || 0;
  const items = Number(menu.total_items) || 0;

  return (
    <View style={styles.tarjeta}>
      {/* Toda la ficha abre el editor: es lo que se quiere hacer nueve de cada
          diez veces que se toca un menú. */}
      <TouchableOpacity onPress={onAbrir} activeOpacity={0.85}>
        <View style={styles.tarjetaFila}>
          <Text style={styles.nombre}>{menu.nombre}</Text>
          <Text style={[styles.insignia, { color: COLORES[estado.color] }]}>{estado.texto}</Text>
        </View>
        {menu.descripcion ? <Text style={styles.descripcion}>{menu.descripcion}</Text> : null}
        <Text style={styles.conteo}>
          {secciones} {secciones === 1 ? 'sección' : 'secciones'} · {items}{' '}
          {items === 1 ? 'plato' : 'platos'}
        </Text>
      </TouchableOpacity>

      {confirmando ? (
        <View style={styles.confirmacion}>
          <Text style={styles.confirmacionTexto}>
            ¿Eliminar «{menu.nombre}»? Se va con todas sus secciones y platos.
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
        <>
          <View style={styles.estados}>
            {Object.entries(ESTADOS_MENU).map(([clave, valor]) => (
              <TouchableOpacity
                key={clave}
                style={[styles.estado, menu.estado === clave && styles.estadoActivo]}
                onPress={() => onCambiarEstado(clave)}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.estadoTexto, menu.estado === clave && styles.estadoTextoActivo]}
                >
                  {valor.texto}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.acciones}>
            <TouchableOpacity onPress={onAbrir}>
              <Text style={styles.accion}>Editar contenido</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onEditar}>
              <Text style={styles.accion}>Renombrar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmando(true)}>
              <Text style={styles.eliminar}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function FormularioMenu({ menu, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(menu?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(menu?.descripcion ?? '');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) {
      setErrores({ nombre: 'Ponle un nombre al menú' });
      return;
    }
    if (enviando) return;
    setErrores({});
    setEnviando(true);
    setError(null);

    // Mismo criterio que en el resto de la app: null en el alta para dejar la
    // columna vacía, cadena vacía al editar porque el UPDATE usa COALESCE y un
    // null significaría "no lo toques".
    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() ? descripcion.trim() : menu ? '' : null,
    };

    try {
      onGuardado(menu ? await api.actualizarMenu(menu.id, datos) : await api.crearMenu(datos));
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>{menu ? 'Renombrar menú' : 'Nuevo menú'}</Text>

      <CampoTexto
        icono="📋"
        etiqueta="Nombre"
        placeholder="Carta de la noche"
        valor={nombre}
        onCambiar={setNombre}
        error={errores.nombre}
        maxLength={80}
      />
      <CampoTexto
        icono="📝"
        etiqueta="Descripción (opcional)"
        placeholder="De jueves a sábado, a partir de las 7"
        valor={descripcion}
        onCambiar={setDescripcion}
        multiline
        numberOfLines={2}
        maxLength={300}
      />

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
          <Text style={styles.ctaTexto}>{menu ? 'Guardar cambios' : 'Crear menú'}</Text>
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
  tarjetaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.s,
  },
  nombre: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto, flexShrink: 1 },
  insignia: { ...TIPOGRAFIA.ayuda, fontWeight: '700', fontSize: 11 },
  descripcion: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2, lineHeight: 19 },
  conteo: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, marginTop: ESPACIADO.xs },
  estados: { flexDirection: 'row', gap: ESPACIADO.xs, marginTop: ESPACIADO.m },
  estado: {
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.chip,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  estadoActivo: { backgroundColor: COLORES.rojoMarca, borderColor: COLORES.rojoMarca },
  estadoTexto: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, fontWeight: '600' },
  estadoTextoActivo: { color: COLORES.blanco },
  acciones: { flexDirection: 'row', gap: ESPACIADO.l, marginTop: ESPACIADO.m },
  accion: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave },
  eliminar: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue },
  confirmacion: { marginTop: ESPACIADO.m },
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
