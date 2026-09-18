# Respuesta a App Review — 18 de septiembre de 2026

Rechazo de la build 1.0 (4), submission 78c9c33e-f226-48aa-bb84-1752173f9d61,
con tres motivos. **La 4.2 desapareció**: el chat, la asistencia y el soporte de
iPad resolvieron la objeción de funcionalidad mínima. Lo que queda son tres
cosas concretas y acotadas.

## Qué pedía cada punto, y qué se hizo

| Guideline | Qué pedía | Dónde se resolvió |
| --- | --- | --- |
| 1.2 | Acuerdo de términos **antes** de registrarse o iniciar sesión | `TerminosScreen`, intercalada tras la animación de bienvenida |
| 1.2 | Bloquear debe **notificar al desarrollador** y retirar el contenido al instante | `POST /yo/bloqueos` abre un reporte con motivo `bloqueo`; los mensajes ya desaparecían en la propia consulta |
| 2.3.6 | Marcar "Yes" en User-Generated Content | **App Store Connect**, no hay código |
| 4 | Poder abrir la dirección en Apple Maps | `LocalScreen` ofrece Apple Maps y Google Maps en iOS |

Filtrado, reporte y plazo de 24 horas ya estaban desde la 1.0 (4); lo que
faltaba era la aceptación previa y el aviso al desarrollador al bloquear.

## Lo que hay que hacer a mano en App Store Connect

1. **Age Rating** → *App Information* → responder **"Yes"** a *User-Generated
   Content*. Es el punto 2.3.6 entero: no depende de ninguna build.
2. **Grabar el vídeo** que Apple pide (ver guion abajo) y adjuntarlo en las
   notas de revisión.

## Guion de la grabación

Apple lo pide **en un dispositivo físico**, no en el simulador. Con un iPhone
conectado y la build instalada, grabar la pantalla (Centro de Control →
Grabación) mostrando estas tres cosas **en este orden**, sin cortes:

1. **El acuerdo antes de entrar.** Abrir la app recién instalada. Tras la
   animación aparece "Antes de empezar", con las reglas y el botón "Acepto los
   términos y la política". Enseñar que no hay forma de saltarla. Pulsar los
   dos enlaces para que se vea que los documentos existen.
2. **Reportar.** Entrar con la cuenta del revisor, abrir "Escribir al grupo",
   mantener pulsado un mensaje ajeno, elegir "Reportar mensaje" y un motivo.
   Se ve el aviso de que se revisa en menos de 24 horas.
3. **Bloquear.** Mantener pulsado otro mensaje ajeno, elegir "Bloquear", y
   mostrar que los mensajes de esa persona **desaparecen del chat al instante**.

Dura menos de dos minutos. Guardar el vídeo en un enlace accesible y ponerlo en
*App Review Information → Notes*, como Apple pide para envíos futuros.

## Texto para responder en App Store Connect

```
Hello,

Thank you for the detailed feedback. We have submitted build 1.0 (5), which
addresses all three points. A screen recording captured on a physical device is
linked in the App Review Information notes.

GUIDELINE 1.2 — USER-GENERATED CONTENT

- Terms of use are now presented and must be accepted BEFORE registering or
  logging in. The screen appears on first launch, cannot be skipped, states on
  screen that there is no tolerance for objectionable content or abusive users,
  and links both the full terms and the privacy policy. Acceptance is recorded
  with a timestamp on the account.
- Filtering: objectionable content is detected when a message is posted and is
  never delivered to other members.
- Flagging: long-pressing any message from another person offers "Reportar
  mensaje" with a list of reasons.
- Blocking: the same menu offers "Bloquear". Blocking now also opens a report
  in our moderation queue, so we are notified of the content, and the blocked
  person's messages disappear from the chat immediately.
- We act on reports within 24 hours by removing the content and ejecting the
  account responsible, as stated in our terms:
  https://api-production-2a3c5.up.railway.app/terminos

The recording demonstrates, in order: the terms agreement shown before login,
the flagging mechanism, and the blocking mechanism.

GUIDELINE 2.3.6 — AGE RATING

We have updated the Age Rating in App Store Connect to answer "Yes" to
User-Generated Content.

GUIDELINE 4 — MAPPING

The venue address now offers Apple Maps. Tapping "Cómo llegar" presents Apple
Maps first, with Google Maps as an alternative. Previously it opened Google
Maps directly, which we understand was the issue.

Thank you for your time.
```
