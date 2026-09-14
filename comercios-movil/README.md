# Seis Más — App de comercios (React Native CLI, sin Expo)

App con la que un local gestiona los grupos que recibe: qué le llega hoy,
quiénes vienen, en qué horarios puede recibir y los datos de su negocio.

Sustituye al panel web (`dashboard/web/`): todo lo que había en `/panel/**` está
ya aquí —menús, planes, anfitriones, propuestas de bienvenida, disponibilidad,
eventos y perfil—, así que el panel se puede borrar. Lo único que sigue siendo
web es la parte pública (la página de inicio y el registro), porque es cómo un
comercio llega a la app antes de tenerla. Ver
[Estado de la migración desde el panel web](#estado-de-la-migración-desde-el-panel-web).

## Por qué es una app aparte y no una pantalla de la app de usuarios

Porque los datos están deliberadamente separados y meterlos en un mismo binario
volvería a juntarlos.

`mobile/` habla con el backend de Node (`backend/`), que se conecta a PostgreSQL
con el rol `seis_app`. Esta app habla con la API PHP (`dashboard/api/`), que se
conecta con el rol `seis_dashboard`. Ninguno de los dos roles puede leer las
tablas del otro: `seis_dashboard` no tiene permiso sobre `usuarios`, y una
inyección SQL en él seguiría sin poder sacar un correo. Eso no es una promesa
del README — lo comprueba `backend/scripts/prueba_frontera.js` con 92
condiciones (`cd backend && npm run test:frontera`).

Un solo binario con las dos sesiones y las dos URLs sería el único punto del
sistema donde los dos contextos vuelven a tocarse. Además son dos productos
distintos para dos personas distintas: quien busca plan y quien lo sirve.

Lo único que esta app sabe de las personas que van a un evento es su nombre de
pila y sus intereses, que es lo que expone la vista `v_evento_asistentes`.

## Qué hace

| Pantalla | Qué resuelve |
| --- | --- |
| **Resumen** | Qué llega hoy, qué falta para poder recibir grupos, qué viene después |
| **Eventos** | Los grupos que recibe el local: próximos, sin confirmar y pasados, y crear uno a mano |
| **Detalle del evento** | Quiénes vienen (nombre de pila e intereses), confirmar / abrir / cerrar, y cancelar |
| **Planes** | La oferta del local: crear, editar precio y duración, apagar un plan, borrarlo |
| **Disponibilidad** | Franjas horarias: crearlas, apagarlas un día suelto, borrarlas |
| **Anfitriones** | Quién recibe al grupo, y cuál de ellos es el titular |
| **Bienvenida** | Propuestas de bienvenida: qué incluye, precio, duración y vigencia |
| **Menús** | La lista, con su estado (borrador / publicado / archivado) |
| **Editor de un menú** | Secciones y platos, y agotar un plato en mitad del servicio |
| **Mi comercio** | Nombre, dirección, ciudad, horario, descripción, contacto |
| **Cuenta** | Cerrar sesión y dar de baja el local |

Cancelar un evento estuvo fuera de la app mientras existió el panel: deja a seis
personas sin plan y no debía caber en un toque accidental mientras se atiende una
mesa. Al retirarse el panel, dejarlo fuera no lo volvía imposible sino
inalcanzable, así que está — al final del detalle, después de haber visto a quién
afecta, y detrás de una confirmación que dice cuántas personas lo tienen
agendado.

## Correr en local

```bash
# 1. Dependencias
cd comercios-movil
npm install
cd ios && pod install && cd ..

# 2. La API PHP del dashboard, en otra terminal
cd ../dashboard/api
php -S localhost:8080 -t public public/index.php

# 3. Metro y la app
npm start
npm run ios
```

`src/config/env.js` resuelve la URL sola a partir de `__DEV__`:

| Build | A dónde apunta |
| --- | --- |
| Release | `https://dashboard-api-production-c666.up.railway.app` (servicio `dashboard-api` en Railway) |
| Debug, simulador de iOS | `http://localhost:8080` |
| Debug, emulador de Android | `http://10.0.2.2:8080` |
| Debug, dispositivo físico | la IP LAN de tu Mac (`USAR_DISPOSITIVO_FISICO = true`) |

## Pruebas

```bash
npm test
```

Cubren lo que no puede romperse sin que la app deje de funcionar o de ser
publicable:

- `formato.test.js` — el parseo de las fechas que devuelve la API. Existe por un
  fallo real: PDO serializa los `timestamptz` de Postgres como
  `2026-09-01 20:14:57-05`, que **no** es ISO 8601, y Hermes (el motor de React
  Native) devuelve `Invalid Date`. El navegador sí lo tolera, así que el
  dashboard web nunca lo notó. El síntoma era mudo: todas las fechas en blanco y
  ningún evento contado como "hoy", sin un solo error en consola.
- `CuentaScreen.test.js` — el borrado de cuenta, que la App Store exige.
- `EventoDetalleScreen.test.js` — que no se pinte ningún dato de contacto de los
  asistentes, y que "sin grupo asignado" se trate como espera y no como error.
- `DisponibilidadScreen.test.js` — que el interruptor optimista se revierta si
  la API rechaza el cambio.
- `PlanesScreen.test.js` — lo mismo para el interruptor de cada plan, que un
  plan no se pueda crear sin categoría (sin interés, el matching no se lo ofrece
  a nadie) y que el motivo que da la API se muestre tal cual.
- `AnfitrionesScreen.test.js` — que no queden dos titulares en pantalla (la base
  solo admite uno) y que los opcionales viajen como `null` en el alta y como
  cadena vacía al editar, que es la única forma de borrarlos contra un `UPDATE`
  con `COALESCE`.
- `PropuestasScreen.test.js` — la ida y vuelta entre el `TEXT[]` de `incluye` y
  el texto de una línea por ítem, y que editar el precio no vacíe esa lista.
- `MenusScreen.test.js` — que cambiar el estado se revierta si falla (un menú
  que el local cree publicado y sigue en borrador no lo ve nadie) y que
  renombrar no borre los conteos que el `PUT` no devuelve.
- `MenuEditorScreen.test.js` — que el árbol se mantenga en memoria entre
  escrituras: la API responde la sección sin sus ítems, así que aplicar la
  respuesta a lo bruto vaciaría media pantalla.
- `EventosScreen.test.js` — la creación de un evento a mano: que proponga al
  anfitrión titular y que no mande una fecha a medio escribir.
- `sesion.test.js` — la persistencia del token.

### Si Metro falla con `EMFILE: too many open files`

Metro necesita `fsevents` para vigilar los archivos con un solo descriptor; sin
él cae a un watcher que abre uno por carpeta y revienta. `fsevents` es una
dependencia opcional transitiva y npm la instala sola, salvo que el caché local
esté corrupto. Si pasa:

```bash
npm ls fsevents                           # si sale "(empty)", no está
sudo chown -R $(id -u):$(id -g) ~/.npm    # el caché de npm con dueño equivocado
npm install
```

## Publicar en la App Store

### Resuelto en el repo

| | |
| --- | --- |
| Bundle identifier | `com.seismas.comercios` (`.tests` para el target de pruebas) |
| Icono | generado en los 9 tamaños, sin canal alfa: logo blanco sobre negro, el inverso del de la app de usuarios para distinguirlas en la pantalla de inicio |
| Pantalla de arranque | logo de marca sobre negro (no la plantilla de React Native) |
| Borrado de cuenta | `CuentaScreen` → `DELETE /mi-comercio`, endpoint añadido a la API PHP |
| Manifiesto de privacidad | declara los 4 tipos de datos que la app recoge del comercio |
| Orientación | solo retrato |
| Nombre bajo el icono | "Seis Más Comercios" |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` |
| Sesión persistente | AsyncStorage, con prefijo propio que no choca con el de la app de usuarios |

### Resuelto después, ya en producción

| | |
| --- | --- |
| API PHP desplegada | servicio `dashboard-api` en Railway, en `https://dashboard-api-production-c666.up.railway.app`. Se conecta con el rol `seis_dashboard` por la red privada del proyecto |
| `URL_PRODUCCION` | apunta ahí; ya no es un placeholder |
| Política de privacidad y términos | los sirve la propia API en `/privacidad` y `/terminos`, con documentos propios del lado comercio (`src/legal/`) |
| Cuenta demo para el revisor | `db/cuenta_demo_comercios_app_store.sql`, sobre el mismo local al que la siembra de usuarios le asignó un grupo |
| Ficha de la tienda | `docs/FICHA_APP_STORE.md` |

CORS no hace falta tocarlo por esta app: una app nativa no manda cabecera
`Origin`, y la API solo responde cabeceras CORS a orígenes de su lista blanca.
En producción esa lista está vacía a propósito (`CORS_ORIGENES=ninguno`); el día
que se despliegue la web pública de registro, su dominio va ahí.

### Falta, y no se puede hacer desde el repo

1. **Cuenta del Apple Developer Program** y, en Xcode, Signing & Capabilities →
   tu `Team`.
2. **URL de soporte**, que Apple exige y hoy no existe (le pasa igual a la app
   de usuarios).
3. **Nutrition labels** en App Store Connect, coincidiendo con
   `ios/ComerciosSeisMas/PrivacyInfo.xcprivacy`.
4. **Capturas** de 6.7" y 6.5", y pegar los textos de `docs/FICHA_APP_STORE.md`
   en App Store Connect.
5. **Volver a correr las dos siembras de demo antes de cada envío**: las fechas
   del escenario son relativas a la corrida, y un plan que ya pasó deja al
   revisor mirando un historial.

## Estado de la migración desde el panel web

Está portado todo: planes, anfitriones, propuestas de bienvenida, menús con su
editor de secciones y platos, y las dos acciones de eventos que faltaban (crear a
mano y cancelar). Ningún pendiente del resumen manda ya al panel.

Lo que **no** puede vivir en la app es la parte pública de `dashboard/web/`: la
página de inicio donde un comercio conoce Seis Más y se registra. Es un sitio
web, no una pantalla — sirve para que alguien que todavía no tiene la app llegue
a ella. Antes de borrar `web/` hay que decidir qué pasa con esas tres rutas
(`/`, `/entrar`, `/registro`); el panel (`/panel/**`) sí se puede quitar entero.

Nada de esto toca `dashboard/api/`, que es el backend de esta app y ya está
desplegado como el servicio `dashboard-api` de Railway.
