# Capturas para la App Store

Capturas reales de las dos apps corriendo en el simulador de iOS, no maquetas.

## Qué subir a App Store Connect

Las dos apps son **solo iPhone** (`TARGETED_DEVICE_FAMILY = 1`). El tamaño
obligatorio es **iPhone 6.9″, 1320 × 2868 px**, y cada juego va en la pestaña de
su tamaño: App Store Connect valida las dimensiones exactas contra la pestaña en
la que sueltas el archivo, no contra la app.

Este README decía que el 6.5″ no hacía falta porque Apple reescala el 6.9″. En
la práctica App Store Connect lo rechazó: al soltar las de 1320 × 2868 en la
pestaña de 6.5″ respondió *"Las dimensiones de una o más capturas de pantalla
son incorrectas… 1242 × 2688, 2688 × 1242, 1284 × 2778 o 2778 × 1284"*. Así que
hay juego de 6.5″ para las dos apps.

| App | Bundle ID | Carpeta | Tamaño | Cuántas |
| --- | --- | --- | --- | --- |
| Seis Más | `com.seismas.app` | `ios/6.9-usuarios/` | 1320 × 2868 | 10 |
| Seis Más | `com.seismas.app` | `ios/6.5-usuarios/` | 1284 × 2778 | 10 |
| Seis Más | `com.seismas.app` | `ios/13-ipad-usuarios/` | 2064 × 2752 | 3 |
| Seis Más Comercios | `com.seismas.comercios` | `ios/6.9-comercios/` | 1320 × 2868 | 12 (**el máximo son 10**) |
| Seis Más Comercios | `com.seismas.comercios` | `ios/6.5-comercios/` | 1284 × 2778 | 12 (**el máximo son 10**) |

**El juego de iPad es obligatorio desde la build 1.0 (4)**: la app de usuarios
pasó a ser universal (`TARGETED_DEVICE_FAMILY = "1,2"`), y App Store Connect
exige capturas de iPad de 13" para toda app que declare soporte de iPad. Sin
ellas no deja enviar.

### Cuáles subir de usuarios, y en qué orden

El orden cambió tras el segundo rechazo por guideline 4.2. Antes empezaba por
pantallas que se leen; ahora empieza por las que se usan, porque eso es
exactamente lo que Apple dijo dos veces que no encontraba. Las tres primeras se
ven sin que nadie deslice.

1. `01-chat` — el grupo hablando
2. `02-asistencia` — "¿Vas a ir?" y cuántos han confirmado
3. `03-grupo-afinidad` — las seis personas y qué comparte contigo cada una
4. `04-perfil` — lo que devuelve el test
5. `05-sitio` — el local, con lo que te encuentras al llegar
6. `06-carta` — su carta, con precios
7. `07-plan` — tu plan, ya resuelto
8. `08-test` — cómo se decide tu grupo
9. `09-valoracion`
10. `10-cuenta` — incluye el borrado de cuenta, que Apple busca

Quedan fuera bienvenida, login y registro: son las tres pantallas que menos
distinguen esta app de cualquier otra, y con diez huecos no sobra sitio.

## Cómo se generaron

Simulador iPhone 17 Pro Max (que es exactamente 1320 × 2868), con la barra de
estado fijada a la convención de Apple:

```sh
xcrun simctl status_bar <UDID> override \
  --time "9:41" --cellularBars 4 --wifiBars 3 \
  --batteryState discharging --batteryLevel 100
xcrun simctl io <UDID> screenshot --type png salida.png
```

El juego de 6.5″ de comercios no se recapturó: se derivó del de 6.9″, porque
volver a montar el andamiaje de fixtures para repetir doce pantallas cuesta más
que la diferencia que se ve. Reescalado proporcional al ancho (1320 → 1284, que
deja 2789 de alto) y recorte centrado a 2778. Son 11 px sobre 2789 —un 0,4%—, y
salen de los márgenes de la barra de estado y del indicador de inicio, no del
contenido. Sin deformar: la escala es la misma en los dos ejes.

```sh
cp -R screenshots/ios/6.9-comercios screenshots/ios/6.5-comercios
for f in screenshots/ios/6.5-comercios/*.png; do
  sips --resampleWidth 1284 "$f"   # proporcional: 1284 × 2789
  sips -c 2778 1284 "$f"           # recorte centrado al alto exacto
done
```

**Las de usuarios ya no usan fixtures.** Se rehicieron el 14 de septiembre de
2026 contra el backend desplegado, entrando con la cuenta del revisor
(`revisor.appstore@seismas.app`), que está sembrada en producción con grupo,
plan, local y carta. Es más fiel que cualquier fixture: lo que sale en la
captura es exactamente lo que el revisor va a ver con esas credenciales, y
desaparece el riesgo de que las capturas prometan una pantalla que la app no
pinta. Las de comercios siguen siendo las de fixtures.

La build es de **Release contra el simulador**, no de debug: en release
`__DEV__` es `false` y `env.js` apunta solo a producción, así que no hay que
tocar ninguna constante ni acordarse de revertirla.

```sh
xcodebuild -workspace SeisMas.xcworkspace -scheme SeisMas -configuration Release \
  -sdk iphonesimulator -derivedDataPath build/sim \
  -destination 'id=<UDID>' CODE_SIGNING_ALLOWED=NO build
xcrun simctl install <UDID> build/sim/Build/Products/Release-iphonesimulator/SeisMas.app
```

La navegación se automatizó con `cliclick`. Tres cosas que cuestan una sesión
entera si no se saben:

* **El origen de la ventana no es una constante.** El simulador se mueve solo;
  hay que leer su posición antes de cada toque y sumarle el bisel (27 px a los
  lados, 70 arriba con la barra de título). Con un origen viejo los toques caen
  en otra aplicación y la sesión se desvía sin dar ningún error.
* **El primer clic sobre una ventana recién activada se lo come macOS.** Si otra
  ventana tapa al simulador, hay que activarlo y gastar un clic en un punto
  inocuo antes del bueno.
* **`cliclick` no escribe la arroba.** Manda la tecla cruda y el simulador la
  mapea con otra distribución: `@` sale como `œ`. Hay que enviarla como
  `kd:shift t:2 ku:shift`, y el teclado físico tiene que estar conectado
  (`defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool true`
  y reiniciar el simulador).

### El juego de iPad

Simulador **iPad Pro 13-inch (M5)**, que da exactamente 2064 × 2752. Misma app
de Release que en iPhone: al ser universal, el mismo binario corre nativo en los
dos.

Una trampa propia del iPad: **el simulador no lo dibuja a escala 1:1**. Un iPad
Pro 13" son 1032 × 1376 puntos metidos en una ventana de 770 × 1053, o sea un
factor de ~0,694. Sin aplicarlo, los toques automatizados caen a dos tercios de
donde deberían y la sesión se desvía. Las capturas en sí salen a resolución
nativa porque las toma `simctl`, no la ventana.

Conviene además apagar el simulador de iPhone antes: con los dos abiertos, las
ventanas se solapan en la misma posición y `position of first window` devuelve
la que no es.

## Antes de enviar a revisión

Las capturas están listas, pero el envío todavía depende de dos cosas que no
son capturas:

- **Usuarios: resuelto.** `mobile/src/config/env.js` ya apunta a la API
  desplegada (`api-production-2a3c5.up.railway.app`) y los enlaces legales
  salen de ahí; `/privacidad` y `/terminos` responden 200.
- **Comercios: resuelto.** La API PHP está desplegada
  (`dashboard-api-production-c666.up.railway.app`), `env.js` apunta ahí y los
  enlaces legales salen de la propia API; `/privacidad` y `/terminos` responden
  200.
- Apple exige la política de privacidad como URL en App Store Connect, además de
  dentro de la app. Para usuarios, esa URL es
  `https://api-production-2a3c5.up.railway.app/privacidad`.
