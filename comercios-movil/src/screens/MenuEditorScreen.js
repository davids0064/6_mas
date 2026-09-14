// Editor de un menú: secciones y platos.
//
// Es el segundo nivel de lo que en la web era `/panel/menus/:id`, y el trozo
// que más se resistía a un teléfono. Lo que lo hace viable no es achicar la
// tabla de Angular, sino dos decisiones:
//
//   - las secciones vienen plegadas y se abren de una en una. En una pantalla
//     de seis pulgadas un menú entero desplegado no se puede leer, y de todas
//     formas se edita una sección a la vez.
//   - el interruptor de cada plato está siempre visible, sin abrir nada. Es la
//     acción del día ("se acabó el pulpo"), y es lo único de este editor que
//     de verdad se usa desde el salón; el resto se escribe una vez.
//
// Consume GET /menus/{id} para el árbol completo y luego las rutas de primer
// nivel de secciones e ítems. La pertenencia no viaja en la URL: secciones e
// ítems heredan `comercio_id` por la cadena de claves foráneas y la API la
// comprueba subiendo por ella en cada operación.
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

export default function MenuEditorScreen({ menu, onVolver }) {
  // El menú de la lista sirve para pintar el título sin esperar a la red; el
  // árbol (secciones e ítems) solo lo trae GET /menus/{id}.
  const [arbol, setArbol] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null); // id de la sección desplegada
  const [creandoSeccion, setCreandoSeccion] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const completo = await api.obtenerMenu(menu.id);
      setArbol(completo);
      // Con una sola sección no tiene sentido obligar a un toque extra para
      // ver lo único que hay.
      if (completo.secciones.length === 1) setAbierta(completo.secciones[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [menu.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Todas las escrituras terminan aplicando un cambio sobre el árbol en
  // memoria en vez de recargarlo entero: recargar por cada plato editado sería
  // una petición por pulsación, y encima haría saltar el scroll.
  const cambiarSecciones = (fn) => setArbol((prev) => ({ ...prev, secciones: fn(prev.secciones) }));

  const enSeccion = (seccionId, fn) =>
    cambiarSecciones((secciones) => secciones.map((s) => (s.id === seccionId ? fn(s) : s)));

  const agregarSeccion = (seccion) => {
    cambiarSecciones((secciones) => [...secciones, { ...seccion, items: [] }]);
    setAbierta(seccion.id);
    setCreandoSeccion(false);
  };

  const renombrarSeccion = (seccion) =>
    // La API devuelve la sección sin sus ítems: se conservan los que ya tenía.
    enSeccion(seccion.id, (s) => ({ ...s, ...seccion, items: s.items }));

  const borrarSeccion = async (seccion) => {
    setError(null);
    try {
      await api.eliminarSeccion(seccion.id);
      cambiarSecciones((secciones) => secciones.filter((s) => s.id !== seccion.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const agregarItem = (seccionId, item) =>
    enSeccion(seccionId, (s) => ({ ...s, items: [...s.items, item] }));

  const reemplazarItem = (seccionId, item) =>
    enSeccion(seccionId, (s) => ({
      ...s,
      items: s.items.map((i) => (i.id === item.id ? item : i)),
    }));

  const borrarItem = async (seccionId, item) => {
    setError(null);
    try {
      await api.eliminarItem(item.id);
      enSeccion(seccionId, (s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
    } catch (e) {
      setError(e.message);
    }
  };

  // Optimista, como el resto de interruptores de la app: agotar un plato en
  // mitad del servicio no puede esperar a la red. Se revierte si falla, porque
  // un plato que el local cree agotado y sigue disponible se sigue pidiendo.
  const alternarItem = async (seccionId, item) => {
    setError(null);
    reemplazarItem(seccionId, { ...item, disponible: !item.disponible });
    try {
      await api.actualizarItem(item.id, { disponible: !item.disponible });
    } catch (e) {
      setError(e.message);
      reemplazarItem(seccionId, item);
    }
  };

  const secciones = arbol?.secciones || [];
  const platos = secciones.reduce((total, s) => total + s.items.length, 0);

  return (
    <View style={styles.pantalla}>
      <EncabezadoMarca titulo={menu.nombre} onVolver={onVolver} />

      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>😕 {error}</Text> : null}

        {cargando ? (
          <ActivityIndicator color={COLORES.rojoMarca} style={styles.centrado} />
        ) : (
          <>
            {secciones.length === 0 ? (
              <View style={styles.aviso}>
                <Text style={styles.avisoTitulo}>Este menú todavía está vacío</Text>
                <Text style={styles.avisoTexto}>
                  Empieza por una sección —entradas, fuertes, postres— y dentro van los
                  platos.
                </Text>
              </View>
            ) : (
              <Text style={styles.resumen}>
                {secciones.length} {secciones.length === 1 ? 'sección' : 'secciones'} · {platos}{' '}
                {platos === 1 ? 'plato' : 'platos'}
              </Text>
            )}

            {secciones.map((seccion) => (
              <Seccion
                key={seccion.id}
                seccion={seccion}
                abierta={abierta === seccion.id}
                onAlternarAbierta={() => setAbierta(abierta === seccion.id ? null : seccion.id)}
                onRenombrada={renombrarSeccion}
                onBorrar={() => borrarSeccion(seccion)}
                onItemCreado={(item) => agregarItem(seccion.id, item)}
                onItemGuardado={(item) => reemplazarItem(seccion.id, item)}
                onItemBorrar={(item) => borrarItem(seccion.id, item)}
                onItemAlternar={(item) => alternarItem(seccion.id, item)}
              />
            ))}

            {creandoSeccion ? (
              <FormularioSeccion
                menuId={menu.id}
                onCancelar={() => setCreandoSeccion(false)}
                onGuardada={agregarSeccion}
              />
            ) : (
              <TouchableOpacity
                style={styles.cta}
                onPress={() => setCreandoSeccion(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaTexto}>Agregar sección</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Seccion({
  seccion,
  abierta,
  onAlternarAbierta,
  onRenombrada,
  onBorrar,
  onItemCreado,
  onItemGuardado,
  onItemBorrar,
  onItemAlternar,
}) {
  const [renombrando, setRenombrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [creandoItem, setCreandoItem] = useState(false);
  const agotados = seccion.items.filter((i) => !i.disponible).length;

  if (renombrando) {
    return (
      <FormularioSeccion
        seccion={seccion}
        onCancelar={() => setRenombrando(false)}
        onGuardada={(actualizada) => {
          onRenombrada(actualizada);
          setRenombrando(false);
        }}
      />
    );
  }

  return (
    <View style={styles.seccion}>
      <TouchableOpacity style={styles.seccionCabecera} onPress={onAlternarAbierta} activeOpacity={0.85}>
        <View style={styles.seccionDatos}>
          <Text style={styles.seccionNombre}>{seccion.nombre}</Text>
          <Text style={styles.seccionConteo}>
            {seccion.items.length} {seccion.items.length === 1 ? 'plato' : 'platos'}
            {/* Los agotados se cuentan en la cabecera para que se vean sin
                desplegar: es lo que se quiere saber de un vistazo. */}
            {agotados > 0 ? ` · ${agotados} agotado${agotados === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        <Text style={styles.flecha}>{abierta ? '⌄' : '›'}</Text>
      </TouchableOpacity>

      {abierta ? (
        <View style={styles.seccionCuerpo}>
          {seccion.descripcion ? (
            <Text style={styles.seccionDescripcion}>{seccion.descripcion}</Text>
          ) : null}

          {seccion.items.map((item) => (
            <Item
              key={item.id}
              item={item}
              onGuardado={onItemGuardado}
              onBorrar={() => onItemBorrar(item)}
              onAlternar={() => onItemAlternar(item)}
            />
          ))}

          {creandoItem ? (
            <FormularioItem
              seccionId={seccion.id}
              onCancelar={() => setCreandoItem(false)}
              onGuardado={(item) => {
                onItemCreado(item);
                setCreandoItem(false);
              }}
            />
          ) : (
            <TouchableOpacity onPress={() => setCreandoItem(true)}>
              <Text style={styles.agregar}>+ Agregar plato</Text>
            </TouchableOpacity>
          )}

          {confirmando ? (
            <View style={styles.confirmacion}>
              <Text style={styles.confirmacionTexto}>
                ¿Eliminar «{seccion.nombre}»? Se lleva sus {seccion.items.length}{' '}
                {seccion.items.length === 1 ? 'plato' : 'platos'}.
              </Text>
              <View style={styles.confirmacionBotones}>
                <TouchableOpacity onPress={onBorrar}>
                  <Text style={styles.eliminarSi}>Sí, eliminar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmando(false)}>
                  <Text style={styles.eliminarNo}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.acciones}>
              <TouchableOpacity onPress={() => setRenombrando(true)}>
                <Text style={styles.accion}>Renombrar sección</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmando(true)}>
                <Text style={styles.eliminar}>Eliminar sección</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Item({ item, onGuardado, onBorrar, onAlternar }) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  if (editando) {
    return (
      <FormularioItem
        item={item}
        onCancelar={() => setEditando(false)}
        onGuardado={(actualizado) => {
          onGuardado(actualizado);
          setEditando(false);
        }}
      />
    );
  }

  return (
    <View style={styles.item}>
      <View style={styles.itemFila}>
        <View style={styles.itemDatos}>
          <Text style={[styles.itemNombre, !item.disponible && styles.apagado]}>{item.nombre}</Text>
          <Text style={[styles.itemPrecio, !item.disponible && styles.apagado]}>
            ${formatearPrecio(item.precio)}
            {!item.disponible ? ' · agotado' : ''}
          </Text>
          {item.descripcion ? (
            <Text style={[styles.itemDescripcion, !item.disponible && styles.apagado]}>
              {item.descripcion}
            </Text>
          ) : null}
        </View>
        <Switch
          value={item.disponible}
          onValueChange={onAlternar}
          trackColor={{ true: COLORES.rojoMarca, false: COLORES.borde }}
        />
      </View>

      {confirmando ? (
        <View style={styles.confirmacion}>
          <Text style={styles.confirmacionTexto}>¿Quitar «{item.nombre}» del menú?</Text>
          <View style={styles.confirmacionBotones}>
            <TouchableOpacity onPress={onBorrar}>
              <Text style={styles.eliminarSi}>Sí, quitar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmando(false)}>
              <Text style={styles.eliminarNo}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.acciones}>
          <TouchableOpacity onPress={() => setEditando(true)}>
            <Text style={styles.accion}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmando(true)}>
            <Text style={styles.eliminar}>Quitar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FormularioSeccion({ menuId, seccion, onCancelar, onGuardada }) {
  const [nombre, setNombre] = useState(seccion?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(seccion?.descripcion ?? '');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) {
      setErrores({ nombre: 'Ponle un nombre a la sección' });
      return;
    }
    if (enviando) return;
    setErrores({});
    setEnviando(true);
    setError(null);

    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() ? descripcion.trim() : seccion ? '' : null,
    };

    try {
      onGuardada(
        seccion
          ? await api.actualizarSeccion(seccion.id, datos)
          : await api.crearSeccion(menuId, datos),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>{seccion ? 'Renombrar sección' : 'Nueva sección'}</Text>
      <CampoTexto
        icono="🗂️"
        etiqueta="Nombre"
        placeholder="Entradas"
        valor={nombre}
        onCambiar={setNombre}
        error={errores.nombre}
        maxLength={60}
      />
      <CampoTexto
        icono="📝"
        etiqueta="Descripción (opcional)"
        placeholder="Para compartir en la mitad de la mesa"
        valor={descripcion}
        onCambiar={setDescripcion}
        multiline
        numberOfLines={2}
        maxLength={200}
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
          <Text style={styles.ctaTexto}>{seccion ? 'Guardar cambios' : 'Crear sección'}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancelar} disabled={enviando}>
        <Text style={styles.cancelar}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

function FormularioItem({ seccionId, item, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(item?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? '');
  const [precio, setPrecio] = useState(String(Math.round(item?.precio ?? 0)));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) {
      setErrores({ nombre: 'Ponle un nombre al plato' });
      return;
    }
    if (enviando) return;
    setErrores({});
    setEnviando(true);
    setError(null);

    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() ? descripcion.trim() : item ? '' : null,
      precio: Number(precio) || 0,
    };

    try {
      onGuardado(
        item
          ? await api.actualizarItem(item.id, datos)
          : await api.crearItem(seccionId, { ...datos, disponible: true }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>{item ? 'Editar plato' : 'Nuevo plato'}</Text>
      <CampoTexto
        icono="🍽️"
        etiqueta="Nombre"
        placeholder="Pulpo a la brasa"
        valor={nombre}
        onCambiar={setNombre}
        error={errores.nombre}
        maxLength={80}
      />
      <CampoTexto
        icono="📝"
        etiqueta="Descripción (opcional)"
        placeholder="Con papa criolla y alioli de ajo negro"
        valor={descripcion}
        onCambiar={setDescripcion}
        multiline
        numberOfLines={2}
        maxLength={300}
      />
      <CampoTexto
        icono="💵"
        etiqueta="Precio"
        placeholder="38000"
        valor={precio}
        onCambiar={(v) => setPrecio(v.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        maxLength={9}
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
          <Text style={styles.ctaTexto}>{item ? 'Guardar cambios' : 'Agregar plato'}</Text>
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
  resumen: { ...TIPOGRAFIA.ayuda, color: COLORES.textoTenue, marginBottom: ESPACIADO.s },
  seccion: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.tarjeta,
    marginBottom: ESPACIADO.s,
    overflow: 'hidden',
  },
  seccionCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: ESPACIADO.m,
  },
  seccionDatos: { flex: 1 },
  seccionNombre: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  seccionConteo: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  flecha: { ...TIPOGRAFIA.etiqueta, color: COLORES.textoTenue, fontSize: 20 },
  seccionCuerpo: {
    paddingHorizontal: ESPACIADO.m,
    paddingBottom: ESPACIADO.m,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    paddingTop: ESPACIADO.s,
  },
  seccionDescripcion: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    marginBottom: ESPACIADO.s,
    lineHeight: 19,
  },
  item: {
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.campo,
    padding: ESPACIADO.m,
    marginBottom: ESPACIADO.s,
  },
  itemFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemDatos: { flex: 1, paddingRight: ESPACIADO.s },
  itemNombre: { ...TIPOGRAFIA.etiqueta, color: COLORES.texto },
  itemPrecio: { ...TIPOGRAFIA.ayuda, color: COLORES.textoSuave, marginTop: 2 },
  itemDescripcion: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoTenue,
    marginTop: 2,
    lineHeight: 18,
  },
  apagado: { opacity: 0.45 },
  agregar: { ...TIPOGRAFIA.etiqueta, color: COLORES.rojoMarca, marginTop: ESPACIADO.xs },
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
    marginTop: ESPACIADO.s,
    marginBottom: ESPACIADO.s,
    backgroundColor: COLORES.fondo,
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
