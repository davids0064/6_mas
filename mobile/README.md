# Seis Más — App móvil (React Native CLI, sin Expo Go)

Este directorio contiene la capa JS de la app (servicios, pantallas placeholder,
configuración). Los archivos nativos de iOS/Android **no se generan a mano**:
los crea el CLI de React Native. Esta guía documenta cómo generarlos y
conectarlos con lo que ya vive aquí.

Se eligió **React Native CLI en vez de Expo managed** porque el roadmap exige
compilar directamente en Xcode con control total sobre `Info.plist`, firma y
capacidades nativas (necesario más adelante para push notifications,
integraciones de pago con comercios, etc.) sin las restricciones del runtime
gestionado de Expo.

## 1. Generar el proyecto nativo

Desde `mobile/`, o desde donde quieras crear el proyecto (luego se copian los
archivos JS de este directorio dentro):

```bash
npx @react-native-community/cli init SeisMas --directory app-nativa
```

Esto crea `app-nativa/ios` y `app-nativa/android` con los proyectos nativos
reales. Copia (o enlaza) el contenido de `mobile/src` dentro de
`app-nativa/src`, y `mobile/index.js`/`App.js` como punto de entrada si
decides fusionar ambos árboles en uno solo. La razón de mantenerlos separados
en este repo es no versionar los artefactos generados por el CLI (que son
voluminosos y regenerables) junto con el código fuente propio.

## 2. Instalar CocoaPods (dependencias nativas de iOS)

React Native usa CocoaPods para las dependencias nativas de iOS. Cada vez que
se agregue una librería con módulos nativos hay que repetir este paso:

```bash
cd app-nativa/ios
pod install
```

Si es la primera vez en la máquina, instala CocoaPods primero:

```bash
sudo gem install cocoapods
```

## 3. Abrir el proyecto en Xcode

**Importante:** abre `SeisMas.xcworkspace`, **no** `SeisMas.xcodeproj`. Una vez
que existe el `.xcworkspace` (generado por `pod install`), es el único archivo
que refleja correctamente las dependencias de CocoaPods; abrir el `.xcodeproj`
directo compila sin los pods y falla en tiempo de enlace.

```bash
open app-nativa/ios/SeisMas.xcworkspace
```

## 4. Configurar bundle identifier, signing team y target

Dentro de Xcode:

1. Selecciona el proyecto `SeisMas` en el navegador izquierdo → target `SeisMas`.
2. Pestaña **General**:
   - `Bundle Identifier`: usa notación inversa de dominio, ej.
     `com.seismas.app` (ajusta al dominio real cuando exista).
   - `Deployment Target`: la versión mínima de iOS que soportarás (ej. iOS 15).
3. Pestaña **Signing & Capabilities**:
   - Activa "Automatically manage signing".
   - Selecciona tu `Team` (cuenta de Apple Developer, personal o de la
     organización). Sin esto, Xcode no puede compilar para dispositivo físico
     ni generar el `.ipa` de distribución.
4. Selecciona el esquema `SeisMas` y el destino (simulador o dispositivo
   físico conectado) en la barra superior antes de compilar (⌘R).

## 5. Conectar la app al backend

`src/config/env.js` resuelve la URL sola a partir de `__DEV__`, la global que
inyecta Metro:

| Build | A dónde apunta |
| --- | --- |
| Release (Xcode en Release, `assembleRelease`, TestFlight) | `https://api-production-2a3c5.up.railway.app` |
| Debug, simulador de iOS | `http://localhost:3000` |
| Debug, emulador de Android | `http://10.0.2.2:3000` |
| Debug, dispositivo físico | la IP LAN de tu Mac (`USAR_DISPOSITIVO_FISICO = true`) |

No hay ninguna constante que haya que acordarse de cambiar antes de compilar
para producción: una build de release apunta a Railway aunque la bandera de
dispositivo físico haya quedado encendida. Al revés sí es manual —
`USAR_DISPOSITIVO_FISICO` distingue lo que Metro no puede distinguir, porque
simulador y teléfono son los dos "desarrollo".

### Contra el backend local

El backend corre en `http://localhost:3000` (ver `backend/`). Desde el
**simulador de iOS**, `localhost` apunta a la Mac host, así que funciona
directo. Desde un **dispositivo físico**, `localhost` apuntaría al propio
teléfono — hay que usar la IP de tu Mac en la red LAN:

```bash
# obtener la IP LAN de tu Mac
ipconfig getifaddr en0
```

y configurar esa IP en `src/config/env.js` (ver más abajo).

### App Transport Security (ATS)

iOS bloquea por defecto las conexiones HTTP no cifradas. En desarrollo, contra
un backend local sin HTTPS, hay dos opciones:

- **Recomendado para desarrollo**: permitir HTTP solo hacia tu IP local en
  `Info.plist`, agregando una excepción de ATS acotada (no deshabilitar ATS
  globalmente):

  ```xml
  <key>NSAppTransportSecurity</key>
  <dict>
      <key>NSExceptionDomains</key>
      <dict>
          <key>localhost</key>
          <dict>
              <key>NSExceptionAllowsInsecureHTTPLoads</key>
              <true/>
          </dict>
          <!-- Sustituye por la IP LAN real de tu Mac al probar en dispositivo físico -->
          <key>192.168.1.100</key>
          <dict>
              <key>NSExceptionAllowsInsecureHTTPLoads</key>
              <true/>
          </dict>
      </dict>
  </dict>
  ```

- **Para producción**: no hace falta ninguna excepción. La API de Railway sirve
  HTTPS con certificado válido, así que la build de release pasa ATS tal cual y
  las excepciones de arriba se quedan donde tienen que quedarse: en desarrollo.

## 6. Variables de entorno del cliente RN

Se recomienda `react-native-config` para no hardcodear URLs, pero para
mantener el MVP simple sin dependencias nativas adicionales, `src/config/env.js`
centraliza la configuración en un solo archivo JS (ver contenido en ese
archivo). Si el proyecto crece, migrar a `react-native-config` es un cambio
aislado a esa capa.

## Estructura de este directorio

```
mobile/
  README.md
  src/
    config/
      env.js            # URLs de backend por entorno (release → Railway; debug → local)
    services/
      api.js             # Cliente HTTP centralizado hacia el backend
    screens/
      RegistroScreen.js          # placeholder: formulario de registro
      TestPersonalidadScreen.js  # placeholder: cuestionario de personalidad
      GruposScreen.js            # placeholder: estado del grupo de 6
```

## Correr la app

Una vez generado el proyecto nativo (paso 1) y con el backend corriendo
(`cd backend && npm run dev`):

```bash
# Metro bundler
cd app-nativa && npx react-native start

# en otra terminal, para iOS
npx react-native run-ios
```

O directamente ⌘R desde Xcode con el `.xcworkspace` abierto.
