// Utilidades compartidas por las pruebas de pantalla.
//
// Vive fuera de __tests__/*.test.js a propósito: jest trataría como suite
// cualquier archivo que acabe en .test.js, y este no tiene pruebas propias.
import { act } from 'react-test-renderer';

// Todo el texto que cuelga de un nodo, concatenado. El texto de un botón vive
// dentro de un <Text> hijo, no en las props del pulsable, así que hay que bajar
// por el árbol renderizado para encontrarlo.
export function textoDe(nodo) {
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDe).join(' ');
  if (!nodo || !nodo.children) return '';
  return nodo.children.map(textoDe).join(' ');
}

// Busca un elemento pulsable por el texto que muestra. Se apoya en lo que la
// persona ve y no en testIDs: es lo mismo que mira quien revisa la app.
//
// El filtro NO se restringe a nodos host: TouchableOpacity conserva `onPress`
// en el componente y le entrega a la View de abajo los manejadores del sistema
// de responder, así que buscar solo entre nodos host no encuentra ni un botón.
export function botonConTexto(arbol, texto) {
  const boton = arbol.root
    .findAll((n) => n.props && typeof n.props.onPress === 'function')
    .find((n) => textoDe(n).includes(texto));
  if (!boton) throw new Error(`No hay ningún botón que diga "${texto}"`);
  return boton;
}

// El texto visible de toda la pantalla.
//
// Se recorre el árbol en vez de serializarlo con JSON.stringify: una pantalla
// con RefreshControl guarda un elemento React en las props, y los elementos de
// React tienen referencias circulares (`_owner`) que hacen reventar a
// stringify. Además, comparar contra el texto visible es lo que se quiere
// afirmar — que algo se ve o no se ve — y no contra la forma del árbol.
// Los espacios se normalizan: textoDe une con un espacio cada hijo, así que
// "👥 {capacidad} personas" sale con espacios dobles alrededor del número. Las
// pruebas deben poder afirmar sobre el texto tal y como se lee, no sobre cómo
// quedó troceado en nodos.
export const contenido = (arbol) => textoDe(arbol.toJSON()).replace(/\s+/g, ' ').trim();

export const pulsar = (boton) => act(async () => boton.props.onPress());
