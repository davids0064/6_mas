# Ficha de App Store — Seis Más Comercios

Textos para App Store Connect. Entre corchetes, los caracteres usados sobre el
límite de Apple. Todo describe lo que la app hace hoy: nada de funciones
planeadas, que es motivo de rechazo por guideline 2.3 (metadata engañosa).

Es una **segunda app**, con su propio registro en App Store Connect y su propio
bundle id (`com.seismas.comercios`). No es una versión de la app de usuarios.

## Nombre [18/30]

```
Seis Más Comercios
```

## Subtítulo [26/30]

```
Los grupos que hoy recibes
```

Alternativas: `Tu local, lleno de a seis` [25] · `Gestiona los grupos que vienen` [30]

## Texto promocional [168/170]

```
Seis desconocidos con algo en común llegan a tu mesa. Aquí ves quiénes vienen y cuándo, dices en qué horarios puedes recibirlos y publicas lo que ofreces. Sin llamadas.
```

## Descripción

```
Seis Más forma grupos de seis personas por afinidad y les asigna un plan en un
local. Esta es la app del local.

QUÉ RESUELVE

Un grupo llega decidido: seis personas que ya tienen tu dirección, el día y la
hora. No hay que negociar nada por teléfono ni confirmar por chat. Tu trabajo
es decir cuándo puedes recibirlos y qué les vas a dar.

QUÉ HACES DESDE AQUÍ

- Resumen: qué llega hoy, qué falta para poder recibir grupos y qué viene
  después.
- Eventos: los grupos que recibes, próximos y pasados. De cada uno ves quiénes
  vienen y puedes confirmarlo, abrirlo o cerrarlo.
- Disponibilidad: las franjas horarias en las que puedes recibir, y cuántos
  grupos te caben en cada una.
- Planes: la oferta con la que entras al emparejamiento, con su precio y su
  duración.
- Bienvenida: qué se encuentra el grupo al llegar.
- Menús: la carta, con secciones y platos, y el interruptor para agotar un
  plato en mitad del servicio.
- Anfitriones: quién recibe al grupo, y cuál de ellos es el titular.
- Mi comercio: los datos del negocio que ven las personas que van.

QUÉ VES DE LAS PERSONAS QUE VIENEN

Su nombre de pila y sus intereses. Nada más: ni correo, ni teléfono, ni edad.
No es una preferencia de la app, es lo único que el sistema le permite
consultar.

Necesitas una cuenta de comercio para usarla.
```

## Palabras clave [89/100]

Sin espacios después de las comas: cuentan como carácter.

```
restaurante,bar,cafe,reservas,grupos,local,negocio,gestion,mesas,anfitrion,eventos,agenda
```

## Campos que no son texto

| Campo | Valor | Por qué |
|---|---|---|
| Categoría principal | Negocios | La usa un local para trabajar, no un consumidor |
| Categoría secundaria | Comida y bebida | |
| Clasificación por edad | 4+ | No hay contenido generado por usuarios ni encuentros dentro de la app |
| URL de política de privacidad | `https://dashboard-api-production-c666.up.railway.app/privacidad` | Tiene que ser exactamente la que enlaza la app |
| URL de soporte | pendiente | Apple la exige; hoy no hay ninguna |
| Copyright | `2026 David Salamanca` | |

Ojo: son URLs **distintas** de las de la app de usuarios. Cada app declara la
política de su propio backend, porque tratan datos distintos con permisos
distintos.

## Información de inicio de sesión (para la revisión)

En *Versión → Información para la revisión*, marcando **"Se requiere inicio de
sesión"**.

| Campo | Valor |
|---|---|
| Usuario | `revisor.comercios@seismas.app` |
| Contraseña | `Comercio2026!` |

La cuenta está sembrada en producción por
`db/cuenta_demo_comercios_app_store.sql`, que **reutiliza a propósito** el
escenario de `db/cuenta_demo_app_store.sql`: el local del revisor es el mismo
"Café Botánico" al que aquel archivo le asignó un grupo de seis. Así las dos
revisiones ven los dos lados del mismo encuentro. Un local recién registrado
solo vería la lista de pendientes vacía, que es lo que se lee como app sin
funcionalidad (guideline 2.1).

Trae: dos eventos con grupo asignado (uno futuro confirmado y uno pasado), seis
asistentes visibles en cada uno, tres planes (uno apagado), cuatro franjas de
disponibilidad (una apagada), dos anfitriones con titular marcado, una propuesta
de bienvenida vigente y dos menús —uno publicado y uno en borrador— con un plato
marcado como agotado.

**Correr las dos siembras otra vez antes de cada envío**, en este orden: las
fechas de los eventos y la vigencia de la propuesta son relativas a la corrida.

```bash
railway ssh --service Postgres "psql -U postgres -d railway -v ON_ERROR_STOP=1" \
  < db/cuenta_demo_app_store.sql
railway ssh --service Postgres "psql -U postgres -d railway -v ON_ERROR_STOP=1" \
  < db/cuenta_demo_comercios_app_store.sql
```

## Notas para el revisor

```
La app requiere cuenta de comercio. Use estas credenciales:

  Usuario: revisor.comercios@seismas.app
  Contraseña: Comercio2026!

Es la app con la que un restaurante gestiona los grupos que recibe. No es la
app del consumidor: esa es "Seis Más", que se envía por separado.

La cuenta ya tiene actividad, para que no vea un local recién registrado:

- Eventos: dos grupos asignados, uno para dentro de unos días y uno pasado.
  Al abrir uno verá quiénes vienen.
- De cada asistente se muestran solo su nombre de pila y sus intereses. La app
  no puede consultar su correo, teléfono ni edad: el usuario de base de datos
  con el que trabaja no tiene permiso de lectura sobre esa tabla.
- Disponibilidad, Planes, Bienvenida, Menús y Anfitriones ya tienen contenido,
  incluidos un plan apagado, una franja apagada, un menú en borrador y un plato
  agotado, para que se vean los dos estados de cada interruptor.

En Cuenta puede probar la baja del local (Cuenta > Dar de baja el local), la
política de privacidad y los términos. La baja es inmediata; si la usa, la
cuenta de prueba deja de funcionar y le pedimos que nos avise para reactivarla.

Puede registrar un comercio nuevo desde la propia app si quiere ver el alta
desde cero. Un local recién registrado no tiene eventos hasta que el sistema
le asigna un grupo, que es el comportamiento normal.

Los datos de este local, sus anfitriones y sus grupos son de demostración.
```

## Lo que todavía falta para enviar

- **URL de soporte.** Es obligatoria y no existe, igual que en la app de
  usuarios. Lo más barato es una ruta `/soporte` junto a `/privacidad` y
  `/terminos`.
- **Capturas** de 6.7" y 6.5".
- **Nutrition labels** en App Store Connect, coincidiendo con
  `ios/ComerciosSeisMas/PrivacyInfo.xcprivacy`: correo, nombre, teléfono y otros
  datos de contacto; todo "vinculado al usuario", nada para tracking.
- **Cuenta del Apple Developer Program** y el `Team` en Signing & Capabilities.
