# Ficha de App Store — Seis Más (usuarios)

Textos para App Store Connect. Entre corchetes, los caracteres usados sobre el
límite de Apple. Todo describe lo que la app hace hoy: nada de funciones
planeadas, que es motivo de rechazo por guideline 2.3 (metadata engañosa).

## Nombre [8/30]

```
Seis Más
```

## Subtítulo [26/30]

```
Seis desconocidos, un plan
```

Alternativas: `Planes sorpresa para seis` [25] · `Tu grupo ideal, ya con mesa` [27]

## Texto promocional [169/170]

Este campo se puede cambiar sin subir una versión nueva, así que sirve para
anunciar cosas puntuales más adelante.

```
Seis desconocidos con algo en común, una mesa reservada y un plan que nadie eligió. Haz el test, formamos tu grupo y te decimos dónde y cuándo. El resto pasa en persona.
```

Alternativas:

```
No eliges el sitio ni con quién. Respondes el test, te agrupamos con cinco personas afines de tu zona y te damos lugar, fecha y hora. Tú solo tienes que llegar.
```

```
Conocer gente no debería ser deslizar el dedo mil veces. Un test, un grupo de seis, un plan sorpresa cerca de ti. Nos encargamos de todo menos de la conversación.
```

## Descripción

```
Conocer gente nueva siendo adulto es raro. Las apps te dan conversaciones que
no llegan a ninguna parte y los planes con amigos siempre se organizan entre
los mismos. Seis Más quita esa fricción de una manera simple: te sienta en una
mesa con cinco personas que no conoces y con las que tienes algo en común.

CÓMO FUNCIONA

1. Creas tu cuenta y eliges tus intereses.
2. Respondes el test de personalidad. Son veinte preguntas y no hay respuestas
   correctas: cada una afina con quién encajas.
3. Recibes tu perfil: qué tipo de compañía eres, cómo te leemos en cada eje y
   —esto importa— qué datos NO usamos para agruparte.
4. Te agrupamos con otras cinco personas afines de tu zona. Ves quiénes son y
   qué tienes en común con cada una.
5. Recibes el plan ya resuelto: local, dirección, día y hora. No lo eliges tú,
   y esa es justo la gracia.
6. Antes de ir, miras el sitio: su carta, qué te encuentras al llegar, a qué
   hora abre y cómo llegar.
7. Vas, nos cuentas qué tal estuvo, y entras al siguiente grupo.

TU PERFIL, DE VUELTA

Contestar veinte preguntas tiene que servirte a ti también. Te devolvemos cómo
te leemos, en qué eje estás y con qué criterio te sentamos con otros cinco. Y
te decimos qué preguntas no pesan nunca en esa decisión: no agrupamos por
género, orientación ni identidad.

QUÉ LO HACE DISTINTO

Nadie negocia el sitio. No hay veinte mensajes para decidir dónde quedar ni un
grupo donde todos dicen "por mí lo que sea". El plan llega decidido, en un
local de tu ciudad, y lo único que tienes que hacer es aparecer.

El grupo no es aleatorio. La afinidad sale de tus intereses y de tus respuestas
del test, y agrupamos por zona para que llegar no sea una expedición.

Es en persona. La app no es el sitio donde pasa la cosa; es lo que te lleva
hasta la mesa.

TU CUENTA, TUYA

Puedes eliminar tu cuenta y todos tus datos cuando quieras, desde la propia
app, en Cuenta > Eliminar mi cuenta. Sin escribir a nadie ni esperar respuesta.

Seis Más es para mayores de 18 años.
```

## Palabras clave [96/100]

Sin espacios después de las comas: cuentan como carácter. No repitas aquí
palabras que ya están en el nombre o el subtítulo, Apple ya las indexa.

```
conocer gente,amigos,planes,grupo,social,restaurantes,cena,salir,afinidad,bogota,nuevos,quedadas
```

## Novedades de esta versión

Primera versión: en 1.0 este campo no se muestra y App Store Connect lo deja
vacío. Para la 1.1 en adelante, describir cambios concretos.

## Campos que no son texto

| Campo | Valor | Por qué |
|---|---|---|
| Categoría principal | Estilo de vida | El plan y el encuentro son el producto |
| Categoría secundaria | Redes sociales | |
| Clasificación por edad | 17+ | Encuentros presenciales entre desconocidos |
| URL de política de privacidad | `https://api-production-2a3c5.up.railway.app/privacidad` | Tiene que ser exactamente la que enlaza la app |
| URL de soporte | pendiente | Apple la exige; hoy no hay ninguna |
| Copyright | `2026 David Salamanca` | |

## Lo que todavía falta para enviar

- **URL de soporte.** Es obligatoria y no existe. Lo más barato es añadir una
  ruta `/soporte` al backend, al lado de `/privacidad` y `/terminos`.
- **Nutrition labels**, que deben coincidir con `ios/SeisMas/PrivacyInfo.xcprivacy`.

## Información de inicio de sesión (para la revisión)

App Store Connect lo pide en *Versión → Información para la revisión*, marcando
**"Se requiere inicio de sesión"**. Sin esto la revisión termina en rechazo por
guideline 2.1 antes de mirar nada más.

| Campo | Valor |
|---|---|
| Usuario | `revisor.appstore@seismas.app` |
| Contraseña | `Revisor2026!` |

La cuenta no es un usuario vacío: está sembrada en la base de producción por
`db/cuenta_demo_app_store.sql` con un grupo de seis ya formado, un plan futuro
confirmado en un local con dirección y anfitrión, y un plan pasado sin valorar.
Un usuario recién registrado se quedaría en "esperando grupo" con cinco huecos
vacíos, que es exactamente lo que un revisor lee como app sin funcionalidad.

**Correr la siembra otra vez antes de cada envío.** Las fechas de los planes son
relativas al momento de la corrida: si pasan más de seis días, el "plan futuro"
deja de serlo y el revisor ve un historial vacío de futuro. Es idempotente, y
además revive la cuenta si un revisor anterior la eliminó probando *Cuenta →
Eliminar mi cuenta*:

```bash
railway ssh --service Postgres "psql -U postgres -d railway -v ON_ERROR_STOP=1" \
  < db/cuenta_demo_app_store.sql
```

## Notas para el revisor

Texto para el campo *Notas* de la misma pantalla.

> Aviso para quien las pegue: la versión anterior de estas notas invitaba al
> revisor a registrar una cuenta nueva "si quiere ver el alta desde cero". Esa
> ruta terminaba en la pantalla de espera con cinco asientos vacíos, y la
> revisión del 13 de septiembre de 2026 acabó en rechazo por guideline 4.2. La
> invitación sigue, pero ahora esa ruta desemboca en el perfil de personalidad,
> que es contenido de verdad. No volver a escribirla sin comprobar dónde acaba.

```
La app requiere cuenta. Use estas credenciales:

  Usuario: revisor.appstore@seismas.app
  Contraseña: Revisor2026!

Seis Más agrupa a seis desconocidos por afinidad y les asigna un plan en un
local real. La cuenta de prueba ya está emparejada, para que vea el estado
normal de la app y no el de un usuario recién llegado.

QUÉ PUEDE HACER CON ESTA CUENTA

1. Su perfil. El test de 20 preguntas devuelve un perfil: qué tipo de compañía
   es, su posición en tres ejes, y qué preguntas NO se usan para agrupar
   (género, orientación e identidad no pesan nunca). Accesible desde "Tu
   perfil" y rehacible cuando quiera.

2. Su grupo. Las otras cinco personas, con lo que comparte con cada una y los
   intereses que sostienen al grupo entero. De cada persona solo se muestra el
   nombre de pila: la app no expone datos de contacto de nadie.

3. El sitio. Desde el plan, "Ver el sitio y la carta" abre el local: su carta
   publicada con precios, qué se encuentra el grupo al llegar, el horario y un
   enlace para abrirlo en mapas. Esa información la publica el propio
   restaurante desde nuestra app de comercios (Seis Más Comercios), así que es
   contenido real y cambiante, no datos de ejemplo incrustados.

4. Valorar. Hay un plan pasado pendiente de valorar, que abre esa pantalla.

5. Su historial y el borrado de cuenta, en Cuenta.

SOBRE LA RECURRENCIA

No es de un solo uso. Cuando el plan de un grupo termina, el grupo se cierra y
sus seis integrantes vuelven al emparejamiento para el siguiente. Un usuario
participa tantas veces como quiera.

SI QUIERE EMPEZAR DE CERO

Puede registrarse con cualquier correo; no enviamos verificación. Al terminar
el test verá su perfil de inmediato. El grupo, en cambio, se forma cuando hay
seis personas afines en la misma ciudad, así que una cuenta nueva queda en
espera hasta entonces: es el comportamiento normal del producto, no un error, y
por eso le damos arriba una cuenta que ya tiene grupo.

La app es para mayores de 18 años. Los datos de este grupo y de este local son
de demostración.
```
