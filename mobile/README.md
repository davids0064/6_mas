# Seis Más — App móvil (React Native CLI, sin Expo Go)

Cliente móvil de Seis Más. Contiene la capa JS (pantallas, servicios,
configuración) **y** los proyectos nativos de iOS y Android, ya generados y
versionados: `ios/` compila tal cual con `pod install` + Xcode, no hay que
crear nada con el CLI.

Se eligió **React Native CLI en vez de Expo managed** porque el roadmap exige
compilar directamente en Xcode con control total sobre `Info.plist`, firma y
capacidades nativas (necesario más adelante para push notifications,
integraciones de pago con comercios, etc.) sin las restricciones del runtime
gestionado de Expo.

## 1. Instalar dependencias

```bash
cd mobile
npm install
```

## 2. Instalar CocoaPods (dependencias nativas de iOS)

React Native usa CocoaPods para las dependencias nativas de iOS. Cada vez que
se agregue una librería con módulos nativos hay que repetir este paso:

```bash
cd ios
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
open ios/SeisMas.xcworkspace
```

## 4. Configurar bundle identifier, signing team y target

Dentro de Xcode:

El bundle identifier ya está fijado en el proyecto: **`com.seismas.app`**
(y `com.seismas.app.tests` para el target de pruebas). Era
`org.reactjs.native.example.…`, el de la plantilla de React Native, con el que
no se puede crear el registro en App Store Connect.

Lo único que queda y **no se puede dejar hecho en el repo** es el equipo de
firma, porque depende de tu cuenta:

1. Selecciona el proyecto `SeisMas` → target `SeisMas`.
2. Pestaña **Signing & Capabilities**:
   - Activa "Automatically manage signing".
   - Selecciona tu `Team` (cuenta del Apple Developer Program). Sin esto Xcode
     no compila para dispositivo físico ni genera el `.ipa` de distribución.
   - Registra `com.seismas.app` como App ID en developer.apple.com si Xcode no
     lo crea solo.
3. Selecciona el esquema `SeisMas` y el destino antes de compilar (⌘R).

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
  App.js                 # rutas del flujo (bienvenida → login → registro → test → grupos)
  src/
    config/env.js        # URLs de backend por entorno + enlaces legales
    services/
      api.js             # cliente HTTP hacia el backend
      sesion.js          # token y perfil, persistidos en AsyncStorage
    screens/
      WelcomeAnimationScreen.js
      LoginScreen.js
      RegistroScreen.js
      TestPersonalidadScreen.js
      GruposScreen.js
      ValoracionScreen.js
      CuentaScreen.js    # cerrar sesión y eliminar cuenta (exigido por la App Store)
  __tests__/             # npm test
  ios/ · android/        # proyectos nativos, versionados
```

## Correr la app

Con las dependencias instaladas (pasos 1 y 2) y el backend corriendo
(`cd backend && npm run dev`):

```bash
# Metro bundler
cd mobile && npx react-native start

# en otra terminal, para iOS
npx react-native run-ios
```

O directamente ⌘R desde Xcode con el `.xcworkspace` abierto.

## Correr las pruebas

```bash
cd mobile && npm test
```

Cubren lo que no puede romperse sin que la app deje de ser publicable: el
borrado de cuenta (`__tests__/CuentaScreen.test.js`), la persistencia de la
sesión (`sesion.test.js`) y la interpretación de la fecha de nacimiento
(`fechaNacimiento.test.js`).

## Publicar en la App Store

### Lo que ya está resuelto en el repo

| | |
| --- | --- |
| Bundle identifier | `com.seismas.app` (era el de la plantilla de RN) |
| Borrado de cuenta en la app | `CuentaScreen`, accesible desde "Cuenta" en Grupos — guideline 5.1.1(v) |
| Cerrar sesión | misma pantalla |
| Pantalla de arranque | logo de marca sobre negro (era "Powered by React Native") |
| Manifiesto de privacidad | `ios/SeisMas/PrivacyInfo.xcprivacy` declara los 5 tipos de datos que la app recoge (declaraba cero) |
| Purpose string de ubicación | eliminada: estaba vacía y la app no usa ubicación |
| Orientación | solo retrato, que es para lo que está diseñado el flujo |
| Nombre bajo el icono | "Seis Más" |
| Export compliance | `ITSAppUsesNonExemptEncryption = false`, para no responderlo en cada subida |
| Sesión persistente | AsyncStorage: ya no hay que iniciar sesión en cada arranque |
| Mayoría de edad | validada en el backend, no solo en el formulario |
| Icono 1024 | presente y sin canal alfa |
| Política de privacidad y términos | publicados y enlazados desde *Cuenta*: los sirve el backend en `/privacidad` y `/terminos` (no hay sitio web; ver README raíz) |

### Lo que falta y no puede hacerse desde el repo

1. **Cuenta del Apple Developer Program** (99 USD/año) y, en Xcode,
   Signing & Capabilities → tu `Team`. Sin esto no hay `.ipa`.
2. **Registrar un dispositivo en el equipo de desarrollo.** Con firma
   automática, `xcodebuild archive` necesita un perfil de *desarrollo* (el de
   distribución se aplica al exportar el `.ipa`, no al archivar), y Apple no
   emite uno para un equipo sin ningún dispositivo registrado: falla con
   "Your team has no devices from which to generate a provisioning profile".
   Se resuelve conectando un iPhone por USB una vez, o añadiendo su UDID en
   developer.apple.com. La alternativa es pasar a firma manual con un perfil de
   App Store creado a mano, que no necesita dispositivos.
3. **Nutrition labels** en App Store Connect, que deben coincidir con
   `PrivacyInfo.xcprivacy`: correo, nombre, teléfono, otros datos de contacto y
   contenido del usuario; todo "vinculado al usuario", nada para tracking.
4. **Pegar la cuenta demo en las notas de revisión.** La cuenta ya existe y
   está sembrada en producción (`db/cuenta_demo_app_store.sql`); lo que no se
   puede hacer desde el repo es escribirla en el formulario de App Store
   Connect. Las credenciales y el texto de las notas están en
   `docs/FICHA_APP_STORE.md`. **Volver a correr la siembra antes de cada
   envío**: el plan del grupo es una fecha relativa a la corrida, y un plan que
   ya pasó deja al revisor mirando un historial en vez de un plan.
5. **Ficha de la tienda**: capturas 6.7" y 6.5", descripción, keywords,
   categoría y clasificación por edad (17+ por ser encuentros entre personas).
6. **Railway**: el plan gratuito duerme las instancias. Si la API no responde
   durante la revisión, es rechazo por 2.1.

### Lo que sigue pendiente como producto

- **No hay recuperación de contraseña.** `LoginScreen` lo dice explícitamente:
  el endpoint no existe. Necesita un proveedor de correo transaccional, así que
  es trabajo de backend, no de configuración. Es riesgo de rechazo y, con
  seguridad, soporte manual desde el primer usuario que olvide su clave.
- **No hay reportar ni bloquear a otro miembro del grupo.** Hoy los comentarios
  de las valoraciones son privados (solo los lee un admin), así que la
  guideline 1.2 de contenido generado por usuarios no aplica en sentido
  estricto. Pero una app que sienta a seis desconocidos en una mesa debería
  ofrecer una salida a quien tenga un mal encuentro, y Apple lo pregunta.
