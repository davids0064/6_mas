# Dashboard de comercios — Seis Más

Panel web donde los comercios se registran, publican sus menús y propuestas de bienvenida,
definen a su anfitrión y gestionan los eventos en los que reciben grupos.

- **`api/`** — servicios REST en PHP puro + PDO sobre la misma base PostgreSQL que usa el móvil.
- **`web/`** — SPA en Angular 21 que consume esos servicios.

> ### ⚠️ El panel web se retira: lo reemplaza una app
>
> La superficie de los comercios pasa a ser **`comercios-movil/`**, una app de React
> Native que consume esta misma API (`api/`). No conviven: la app sustituye al panel.
> La API **no** se retira — es la que usa la app, y por tanto sigue siendo el servicio
> que hay que desplegar.
>
> **El panel ya está portado entero.** La app cubre resumen, eventos (incluidos crear a
> mano y cancelar), asistentes, planes, disponibilidad, anfitriones, propuestas de
> bienvenida, menús con su editor de secciones y platos, perfil del comercio y alta y baja
> de la cuenta. Todas las rutas `/panel/**` de `web/` tienen ya su equivalente en
> `comercios-movil/` y se pueden borrar.
>
> Lo que queda en pie es la **parte pública**: `/` (la página donde un comercio conoce Seis
> Más), `/entrar` y `/registro`. Eso es un sitio web y no puede ser una pantalla de la app
> — es cómo llega alguien que todavía no la tiene instalada. Decidir qué pasa con esas tres
> rutas es lo único que separa a `web/` de desaparecer.
>
> Nada de esto afecta a `api/`: es el backend de la app y sigue siendo el servicio a
> desplegar. Ver `comercios-movil/README.md`.


---

## Arquitectura

```
┌─────────────────┐   HTTPS + JWT   ┌──────────────────┐
│  Angular (web)  │ ──────────────► │   API PHP (api)  │
│  build estático │                 │        │         │
└─────────────────┘                 │        ▼         │
                                    │   PostgreSQL     │
                                    │  (rol acotado)   │
                                    └──────────────────┘
```

### La frontera entre los dos mundos

La base contiene dos contextos con datos de sensibilidad distinta:

| Contexto comercio (dashboard) | Frontera | Contexto social (app móvil) |
|---|---|---|
| `comercios`, `anfitriones` | `eventos` | `usuarios`, `tests_personalidad` |
| `menus`, `menu_secciones`, `menu_items` | `v_evento_asistentes` | `grupos`, `grupo_miembros` |
| `propuestas_bienvenida` | `v_comercio_publico` | `usuario_intereses`, `feedback` |

La separación **no depende del código de aplicación**: la API PHP se conecta con el rol
`seis_dashboard`, que no tiene ningún permiso sobre `usuarios`. Lo único que un comercio puede
saber de las personas que va a recibir es lo que expone `v_evento_asistentes` — nombre de pila e
intereses. Una inyección SQL en el dashboard seguiría sin poder leer un correo:

```
$ psql "postgres://seis_dashboard@localhost/seis_mas" -c "SELECT email FROM usuarios"
ERROR:  permission denied for table usuarios
```

El rol `seis_app` es simétrico: la API del móvil no puede leer `comercios.password_hash`.

Esto no es una promesa del README: `backend/scripts/prueba_frontera.js` lo ejecuta. Son 92
condiciones — las dos consultas de arriba, cada tabla de cada contexto contra el rol del otro, que
ninguno de los dos roles sea superusuario, y que las tres vistas de frontera no expongan las
columnas que los GRANTs esconden.

```bash
cd backend && npm run test:frontera
```

---

## Correr en local

### 1. Base de datos

Sobre una base que ya tenga aplicado `db/schema.sql`:

```bash
psql -d seis_mas -f db/migrations/001_dashboard_comercios.sql
```

Es idempotente: se puede volver a correr sin romper nada. Crea las tablas nuevas, las dos vistas
de frontera y los roles `seis_dashboard` / `seis_app` con contraseñas de desarrollo.

### 2. API

```bash
cd dashboard/api
cp .env.example .env
php -r "echo bin2hex(random_bytes(32));"   # pega el resultado en JWT_SECRET
php -S localhost:8080 -t public public/index.php
```

El `public/index.php` final del comando es el *router script*: sin él, el servidor embebido de PHP
devuelve 404 en las rutas que no son archivos reales.

Comprobación: `curl localhost:8080/health` → `{"status":"ok"}`

### 3. Frontend

```bash
cd dashboard/web
npm install
npx ng serve
```

Abre <http://localhost:4200>.

> Angular CLI no está instalado globalmente (la instalación en `/usr/local` requiere `sudo`), por
> eso todos los comandos van con `npx`. El proyecto está en Angular **21** porque la 22 exige
> Node ≥ 24.15 y este equipo tiene 24.13.

---

## Contrato de la API

Todo bajo la raíz de la API. Salvo `/health` y `/auth/*`, cada ruta exige
`Authorization: Bearer <token>`.

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/auth/registro` | Alta de comercio → `{ token, comercio }` |
| `POST` | `/auth/login` | Inicio de sesión → `{ token, comercio }` |
| `GET` | `/resumen` | Todo el home del panel en una sola petición |
| `GET`/`PUT` | `/mi-comercio` | Perfil del comercio autenticado |
| `GET`/`POST` | `/menus` | Listar / crear menús |
| `GET`/`PUT`/`DELETE` | `/menus/{id}` | Árbol completo / editar / borrar |
| `POST` | `/menus/{id}/secciones` | Agregar sección |
| `PUT`/`DELETE` | `/secciones/{id}` | Editar / borrar sección |
| `POST` | `/secciones/{id}/items` | Agregar plato |
| `PUT`/`DELETE` | `/items/{id}` | Editar / borrar plato |
| `GET`/`POST` | `/propuestas` | Listar / crear propuestas |
| `GET`/`PUT`/`DELETE` | `/propuestas/{id}` | Ver / editar / borrar |
| `GET`/`POST` | `/anfitriones` | Listar / crear anfitriones |
| `PUT`/`DELETE` | `/anfitriones/{id}` | Editar / borrar |
| `GET`/`POST` | `/eventos` | Listar (`?estado=`, `?desde=`) / crear |
| `GET`/`PUT`/`DELETE` | `/eventos/{id}` | Ver / editar / cancelar |
| `GET` | `/eventos/{id}/asistentes` | **Frontera**: nombre de pila e intereses |

### Decisiones de seguridad

- **El `comercio_id` sale siempre del token**, nunca del cuerpo ni de la URL. No existe ninguna
  ruta `/comercios/{id}`: cambiar un id en la URL no da acceso a otro negocio.
- Secciones e ítems no guardan `comercio_id`; cada operación sube por la cadena de FKs hasta
  `menus.comercio_id` y lo compara con el token.
- Contraseñas con bcrypt. `Auth::verificarPassword()` normaliza el prefijo `$2b$` (que genera
  Node) a `$2y$` (que genera PHP) para que un comercio creado desde cualquiera de los dos
  backends pueda entrar.
- El login responde el mismo mensaje ante "no existe", "sin contraseña" y "contraseña
  incorrecta", para no permitir enumerar correos registrados.
- CORS con lista blanca explícita, nunca `*`.

---

## Despliegue

El objetivo es: **Angular estático en Hostinger, API + PostgreSQL en Railway**. Así la base nunca
se expone a internet y Hostinger no guarda ninguna credencial.

### Frontend

```bash
cd dashboard/web
npx ng build                      # usa environment.prod.ts
# sube el contenido de dist/web/browser/ a public_html/
```

Antes de compilar, pon la URL real de la API en `src/environments/environment.prod.ts`.

**Imprescindible**: un `.htaccess` en `public_html/` que reescriba todo a `index.html`, o las
rutas profundas (`/panel/menus`) darán 404 al recargar:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

### API

**Railway NO detecta esta API automáticamente**, y conviene saber por qué antes de intentarlo: el
autodetector reconoce un proyecto PHP por su `composer.json`, y esta API no tiene ninguno a
propósito — no usa dependencias, trae su propio autoloader PSR-4 de cinco líneas y se despliega
copiando la carpeta. Por eso el servicio se construye con el `Dockerfile` de `dashboard/api/`, que
además deja explícitas las dos cosas que ningún autodetector adivina: que el document root es
`public/` y no la raíz (con la raíz, `GET /.env` y `GET /src/Core/Db.php` serían archivos
estáticos descargables) y que hace falta la extensión `pdo_pgsql`.

```bash
# desde la raíz del repo: es un monorepo y `railway up` sube la raíz,
# no el directorio desde el que se lo invoca
railway up ./dashboard/api --path-as-root --service dashboard-api
```

`railway.json` fija el builder en `DOCKERFILE` y pone el healthcheck en `/health`, así que un
despliegue que arranque pero no responda no se marca como bueno.

**Ya está desplegada**, en `https://dashboard-api-production-c666.up.railway.app` (servicio
`dashboard-api` del proyecto `seis-mas`, junto a `api` y `Postgres`). Es la URL que
`comercios-movil/src/config/env.js` usa en release. Variables del servicio, que no viven en el
repo y se consultan con `railway variables --service dashboard-api --kv`:

| Variable | Valor en producción |
| --- | --- |
| `DB_HOST` | `postgres.railway.internal` — red privada del proyecto, la base no está expuesta a internet |
| `DB_NAME` | `railway` |
| `DB_USER` | `seis_dashboard`, **no** el superusuario: la frontera entre contextos la sostiene Postgres |
| `DB_SSLMODE` | `require` |
| `CORS_ORIGENES` | `ninguno` — no hay ningún origen web autorizado todavía (ver abajo) |
| `APP_DEBUG` | `false` |
| `EMAIL_CONTACTO` | la dirección que aparece en los documentos legales |

`CORS_ORIGENES` no puede quedar vacía: `config.php` sustituye el valor vacío por su valor por
defecto, que es `http://localhost:4200`, y dejar autorizado un origen de desarrollo en producción
es gratis de evitar. El valor `ninguno` no coincide con ningún `Origin` real, así que la API no
emite cabeceras CORS para nadie — que es lo correcto mientras su único cliente sea la app nativa,
que no manda `Origin`. Cuando se despliegue la web pública de registro, su dominio va ahí.

#### El MPM de Apache

El `Dockerfile` borra `mpm_event` de `mods-enabled` **en el `CMD`**, justo antes de arrancar
Apache, y no solo en una capa del build. No es un adorno: la imagen `php:8.3-apache` trae
habilitados `mpm_prefork` y `mpm_event` a la vez, y Apache se niega a arrancar con los dos
(`AH00534: Configuration error: More than one MPM loaded`). El primer despliegue construyó bien y
se quedó en bucle de reinicios por eso.

Quitarlo durante el build no bastó, y el motivo está medido: el contenedor arrancaba con
`mpm_event` de vuelta y con la fecha original de la imagen base, mientras los enlaces que sí había
escrito el build llevaban la fecha del build. El `/etc/apache2` sobre el que corren las capas no es
el que ve el contenedor. Hacerlo en el arranque no depende de capas ni de caché.

Para probar la imagen antes de subirla:

```bash
docker build -t seis-mas-dashboard-api dashboard/api
docker run --rm -p 8080:8080 --env-file dashboard/api/.env seis-mas-dashboard-api
```

El `.env` se pasa por `--env-file` y **no** entra en la imagen (`.dockerignore`): en Railway las
variables vienen del entorno del servicio, y una imagen con credenciales dentro es una credencial
que viaja a un registro y queda en el historial de capas.

Variables a definir en el servicio:

| Variable | Valor |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | los del PostgreSQL de Railway (red privada) |
| `DB_USER`, `DB_PASSWORD` | `seis_dashboard` y su contraseña de producción |
| `DB_SSLMODE` | `require` |
| `JWT_SECRET` | 64 caracteres aleatorios, distinto al de desarrollo |
| `CORS_ORIGENES` | `https://tudominio.com` |
| `APP_DEBUG` | `false` |

`PORT` la inyecta Railway y Apache la lee del entorno al arrancar; no hay que definirla.

Antes de producción, cambia las contraseñas de desarrollo de los roles:

```sql
ALTER ROLE seis_dashboard PASSWORD '…';
ALTER ROLE seis_app PASSWORD '…';
```

### Sobre mover Railway a un VPS

El código no tiene nada específico de Railway: toda la configuración son variables de entorno y
la base se migra con `pg_dump`/`pg_restore`. Un VPS además da IP fija, lo que permitiría cerrar
PostgreSQL a una sola dirección en vez de depender del proxy público. El costo real del traslado
no es la migración sino volverse responsable de parches, TLS, backups y monitoreo.

---

## Diseño

El sistema está construido sobre la **paleta oficial de la marca**
(`mobile/assets/contenidoidentidaddemarcapaletadecolores`, lámina "Concepto cromático & paleta
de colores"), que son tres colores y nada más:

| Color | HEX | RGB | CMYK |
|---|---|---|---|
| Negro | `#000000` | 0, 0, 0 | C91 M79 Y62 K97 |
| Rojo | `#AD191A` | 173, 25, 26 | C21 M100 Y98 K15 |
| Blanco | `#FFFFFF` | 255, 255, 255 | C0 M0 Y0 K0 |

Los grises (`--gris-100` … `--gris-900`) son tonos del negro, no colores nuevos: jerarquizan sin
ensuciar la paleta. Blanco sobre `#AD191A` da un contraste de **7.2:1**, que pasa WCAG AA y AAA.

### Cómo se reparten

- **Rojo**: menú lateral, el único CTA por pantalla, errores y el acento activo. Es el color de la
  identidad y pierde fuerza si se reparte de más.
- **Negro**: tipografía, botones secundarios de acción, estados consolidados (publicado, activo,
  grupo asignado) y el fondo de la portada pública.
- **Blanco**: fondo de trabajo y tipografía sobre rojo o negro.

Dos decisiones que vale la pena explicar:

- **No hay verde de éxito.** La paleta no lo contempla. Un campo válido se marca con borde negro
  y ✓; un estado consolidado es un chip negro relleno.
- **El rojo de marca es también el color de error.** No se inventa un segundo rojo. Se distinguen
  por la forma: los errores son texto y borde, los CTA son botones rellenos, y lo destructivo es
  rojo de contorno para que no invite a pulsarse por costumbre.

Se conservan de `mobile/docs/GUIA_DISENO.md` la escala de espaciado de 8, los radios (campos 12,
tarjetas 20, botones píldora), la tipografía del sistema, la validación en dos momentos y el
microcopy en tono cercano ("Cuéntale a los grupos de qué se trata tu lugar", no "Campo requerido").

> **Divergencia pendiente con el móvil**: `mobile/src/theme/tokens.js` usa colores *muestreados de
> la ilustración* `home_1.png` (azul `#315699`, naranja `#F79547`, índigo `#232456`), que son de
> esa pieza gráfica y no de la identidad corporativa. El dashboard ya está corregido; el móvil
> sigue con la paleta anterior. Habría que decidir si se alinea.
