// Aceptación de los términos de uso.
//
// Existe por el rechazo de la guideline 1.2 de la 1.0 (4): Apple exige que el
// acuerdo se presente "antes de registrarse o iniciar sesión". Lo que había era
// un enlace en la pantalla de Cuenta —o sea, después de entrar—, que informa
// pero no es aceptar nada.
//
// Se guarda por dispositivo y no por cuenta a propósito: la pantalla aparece
// ANTES de que exista una cuenta con la que asociarla. En el registro, el
// backend deja además constancia con fecha en `usuarios.terminos_aceptados_at`,
// que es la que sirve para sostener una expulsión.
//
// La versión va en la clave: el día que cambien los términos de forma
// significativa, subirla vuelve a pedir la aceptación a todo el mundo, sin
// tener que migrar nada.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const VERSION_TERMINOS = 1;
const CLAVE = `@seismas/terminos-aceptados-v${VERSION_TERMINOS}`;

let _aceptados = false;

export const terminos = {
  /** Lee el disco una vez al arrancar. App.js lo llama junto a sesion.restaurar(). */
  async restaurar() {
    try {
      _aceptados = (await AsyncStorage.getItem(CLAVE)) === 'si';
    } catch {
      // Si el disco falla se asume que NO aceptó: volver a preguntar es
      // molesto, dar por aceptado algo que no consta es peor.
      _aceptados = false;
    }
    return _aceptados;
  },

  aceptados() {
    return _aceptados;
  },

  aceptar() {
    _aceptados = true;
    AsyncStorage.setItem(CLAVE, 'si').catch(() => {});
  },
};
