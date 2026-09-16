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
5. Se abre el chat del grupo. Dices si vas, y os organizáis: a qué hora llega
   cada uno, quién reserva el parqueadero, cómo reconoceros.
6. Recibes el plan ya resuelto: local, dirección, día y hora. No lo eliges tú,
   y esa es justo la gracia.
7. Antes de ir, miras el sitio: su carta, qué te encuentras al llegar, a qué
   hora abre y cómo llegar.
8. Vas, nos cuentas qué tal estuvo, y entras al siguiente grupo.

HABLAD ANTES DE VEROS

En cuanto sois seis se abre el chat. Sirve para lo que sirve: decir que llegas
tarde, preguntar si hay dónde parquear, avisar de que al final no puedes ir.
Nadie tiene que dar su teléfono a cinco desconocidos.

Puedes reportar cualquier mensaje o bloquear a quien sea, manteniéndolo pulsado.
Si bloqueas a alguien, dejas de ver lo que escribe y no volvemos a poneros en el
mismo grupo. Revisamos todos los reportes en menos de 24 horas y no toleramos
ningún contenido ofensivo.

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

Texto para el campo *Notas*. Está reescrito para la build 1.0 (4): pone primero
lo que la app deja **hacer**, porque los dos rechazos por 4.2 vinieron de que
parecía que solo dejaba leer.

> Dos avisos para quien las pegue:
> 1. La versión de estas notas de septiembre invitaba al revisor a registrar una
>    cuenta nueva "para ver el alta desde cero", y esa ruta terminaba en la
>    pantalla de espera vacía. No volver a escribirla sin comprobar dónde acaba.
> 2. Hay que correr las dos siembras de demo justo antes de enviar. Si no, el
>    plan del grupo queda en el pasado y el escenario pierde la mitad de la
>    gracia.

```
La app requiere cuenta. Use estas credenciales:

  Usuario: revisor.appstore@seismas.app
  Contraseña: Revisor2026!

Seis Más agrupa a seis desconocidos por afinidad y les asigna un plan en un
local real. Esta cuenta ya está emparejada, para que vea la app en su estado
normal y no en el de espera de un usuario recién llegado.

QUÉ PUEDE HACER (no solo ver)

1. Escribir al grupo. Botón "Escribir al grupo" en la pantalla principal. Hay
   una conversación en curso entre las otras cinco personas. Puede escribir.

2. Reportar y bloquear. Mantenga pulsado cualquier mensaje ajeno: aparecen
   "Reportar mensaje" y "Bloquear". Bloquear esconde sus mensajes y además
   impide que nuestro sistema vuelva a sentar a esas dos personas juntas. El
   contenido objetable se filtra automáticamente al publicarse y no se entrega
   a nadie. Los reportes se revisan en menos de 24 horas.

3. Decir si va. "¿Vas a ir?" con "Sí, voy" / "No puedo". Está sin contestar a
   propósito para que pueda usarlo. Debajo se ve cuántos han confirmado.

4. Valorar el plan pasado, desde "Valorar".

5. Rehacer el test de personalidad, desde Tu perfil.

6. Eliminar su cuenta, en Cuenta. Es inmediato; si lo usa, avísenos y la
   reactivamos.

QUÉ PUEDE VER

- Tu perfil: lo que devuelven las 20 preguntas — un tipo, tres ejes, y qué
  datos NO usamos para agrupar (género, orientación e identidad no influyen
  nunca en el emparejamiento).
- Su grupo: las otras cinco personas y qué comparte con cada una. Solo se
  muestra el nombre de pila; la app no expone datos de contacto de nadie.
- El sitio: "Ver el sitio y la carta" abre el local con su carta y precios, qué
  se encuentra el grupo al llegar, horario y cómo llegar. Lo publica el propio
  restaurante desde nuestra app de comercios, así que es contenido real.

SOBRE LA RECURRENCIA

No es de un solo uso. Cuando el plan termina, el grupo se cierra y sus seis
integrantes vuelven al emparejamiento para el siguiente.

IPAD

Esta versión es universal. Las revisiones anteriores se hicieron en un iPad Air
con una build solo para iPhone, que corría escalada.

Los datos de este grupo y de este local son de demostración. La app es para
mayores de 18 años.
```
