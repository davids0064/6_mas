// Pantalla de aceptación de los términos.
//
// Se muestra ANTES del login y del registro, y no se puede saltar. Es lo que
// Apple pidió textualmente al rechazar la 1.0 (4) por guideline 1.2: "The EULA
// or terms of use agreement presented to users before registering or logging
// in". Un enlace dentro de Cuenta no cumple, porque para verlo ya hay que estar
// dentro.
//
// Además del requisito, el contenido importa: la guideline exige que los
// términos dejen claro que no hay tolerancia con el contenido objetable ni con
// los usuarios abusivos, así que eso se dice aquí en pantalla —resumido y en
// castellano llano— y no solo en el documento enlazado. Un revisor tiene que
// poder verlo sin abrir un navegador.
import React, { useRef } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import EncabezadoMarca from '../components/EncabezadoMarca';
import { terminos } from '../services/terminos';
import { URL_POLITICA_PRIVACIDAD, URL_TERMINOS } from '../config/env';
import { COLORES, COLUMNA, ESPACIADO, RADIOS, TIPOGRAFIA } from '../theme/tokens';

const REGLAS = [
  'No se tolera ningún contenido ofensivo ni ningún comportamiento abusivo: insultos, acoso, amenazas, contenido sexual no solicitado, discurso de odio o spam.',
  'Puedes reportar cualquier mensaje o a cualquier persona, y bloquear a quien quieras, manteniendo pulsado el mensaje en el chat del grupo.',
  'Revisamos todo reporte en menos de 24 horas, retiramos el contenido y expulsamos a la cuenta responsable.',
  'Seis Más es solo para mayores de 18 años.',
];

export default function TerminosScreen({ onAceptar }) {
  // El guardia contra el doble toque va en una ref y no en estado. Con estado
  // no funciona: React agrupa las actualizaciones, así que dos toques seguidos
  // dentro del mismo ciclo leen los dos `false` y la navegación se dispara dos
  // veces. Una ref se actualiza en el acto.
  const aceptando = useRef(false);

  const aceptar = () => {
    if (aceptando.current) return;
    aceptando.current = true;
    terminos.aceptar();
    onAceptar();
  };

  return (
    <View style={estilos.pantalla}>
      <EncabezadoMarca titulo="Antes de empezar" />

      <ScrollView contentContainerStyle={estilos.cuerpo} showsVerticalScrollIndicator={false}>
        <Text style={estilos.intro}>
          Seis Más te sienta a la mesa con cinco desconocidos. Para que eso funcione, hay unas
          reglas que se aceptan antes de entrar.
        </Text>

        {REGLAS.map((regla) => (
          <View key={regla} style={estilos.regla}>
            <Text style={estilos.vineta}>•</Text>
            <Text style={estilos.reglaTexto}>{regla}</Text>
          </View>
        ))}

        <View style={estilos.enlaces}>
          <TouchableOpacity onPress={() => Linking.openURL(URL_TERMINOS)} activeOpacity={0.7}>
            <Text style={estilos.enlace}>Leer los términos de uso completos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(URL_POLITICA_PRIVACIDAD)}
            activeOpacity={0.7}
          >
            <Text style={estilos.enlace}>Leer la política de privacidad</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={estilos.boton}
          onPress={aceptar}
          activeOpacity={0.85}
          disabled={aceptando.current}
        >
          <Text style={estilos.botonTexto}>Acepto los términos y la política</Text>
        </TouchableOpacity>

        <Text style={estilos.pie}>
          Al continuar aceptas los términos de uso y la política de privacidad de Seis Más.
        </Text>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  cuerpo: {
    ...COLUMNA,
    padding: ESPACIADO.m,
    paddingBottom: ESPACIADO.xl * 2,
  },
  intro: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
    lineHeight: 22,
    marginBottom: ESPACIADO.l,
  },
  regla: { flexDirection: 'row', marginBottom: ESPACIADO.m, paddingRight: ESPACIADO.s },
  vineta: { ...TIPOGRAFIA.subtitulo, color: COLORES.rojoMarca, marginRight: ESPACIADO.s },
  reglaTexto: { ...TIPOGRAFIA.subtitulo, color: COLORES.texto, flex: 1, lineHeight: 21 },
  enlaces: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORES.borde,
    paddingTop: ESPACIADO.m,
    marginTop: ESPACIADO.s,
  },
  enlace: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.rojoMarca,
    textDecorationLine: 'underline',
    marginBottom: ESPACIADO.s,
  },
  boton: {
    backgroundColor: COLORES.rojoMarca,
    borderRadius: RADIOS.boton,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: ESPACIADO.l,
  },
  botonTexto: { ...TIPOGRAFIA.boton, color: COLORES.blanco },
  pie: {
    ...TIPOGRAFIA.ayuda,
    color: COLORES.textoSuave,
    textAlign: 'center',
    marginTop: ESPACIADO.m,
  },
});
