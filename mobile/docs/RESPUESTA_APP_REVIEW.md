# Respuesta a App Review — guideline 4.2 (segunda)

Texto para responder en App Store Connect al mensaje del 16 de septiembre de
2026 (submission 78c9c33e-f226-48aa-bb84-1752173f9d61).

Se responde **junto con** la subida de la build 1.0 (4), no en vez de ella: una
4.2 rara vez se gana discutiendo, pero el mensaje de Apple invita expresamente a
responder, y pedir concreción después de haber añadido funcionalidad sustancial
es más barato que adivinar por tercera vez.

Dos cosas que este texto hace a propósito:

- **No discute el rechazo.** Enumera lo que cambió y pregunta. Discutir con App
  Review no mueve un veredicto y consume el único canal que hay.
- **No promete nada futuro.** Todo lo que menciona está en la build que
  acompaña al mensaje. Prometer funciones planeadas es guideline 2.3.

```
Hello,

Thank you for the follow-up. We have submitted build 1.0 (4), which adds
functionality beyond what was reviewed in 1.0 (3). Below is what is new, and a
question at the end.

WHAT THE APP NOW LETS PEOPLE DO

Until now the app mostly let people read: their group, their plan, the venue.
Build 4 adds the things they can do.

1. Group chat. When six people are matched, a chat opens between them. This
   was the largest gap in the product: six strangers were being seated at a
   table together with no way to say "I'll be ten minutes late" or "I can't
   make it". It is reachable from the group screen ("Escribir al grupo").

2. Attendance. Each person answers whether they are coming, and everyone sees
   how many have confirmed. On the demo account this is unanswered on purpose
   so you can use it.

3. Moderation, because the chat is user-generated content (guideline 1.2):
   - objectionable content is filtered automatically when posted and is not
     delivered to anyone;
   - long-pressing any message from another person offers "Reportar mensaje"
     and "Bloquear";
   - blocking hides that person's messages AND prevents our matching system
     from ever seating the two of them together again;
   - reported content is reviewed within 24 hours, and our terms of use state
     zero tolerance for objectionable content and abusive users:
     https://api-production-2a3c5.up.railway.app/terminos

4. iPad. The app is now universal. We noticed all three reviews were performed
   on an iPad Air, where our iPhone-only build ran scaled. Build 4 supports
   iPad natively, in both orientations.

ALSO IN THE PREVIOUS BUILD, IN CASE IT WAS NOT REACHED

The demo account below is already matched, so the app opens in its normal
state rather than the waiting state of a brand-new user:

  Usuario: revisor.appstore@seismas.app
  Contraseña: Revisor2026!

- "Tu perfil" shows what the 20-question test returns: a profile type, three
  axes, and which questions we deliberately do NOT use to group people
  (gender, orientation and identity never affect matching).
- The group screen shows the other five people and what each has in common
  with you.
- "Ver el sitio y la carta" opens the venue: its published menu with prices,
  what the group gets on arrival, opening hours and directions. That content
  is published by the restaurant itself through our companion app, so it is
  real and changing, not sample data baked into the binary.

OUR QUESTION

We have made substantial additions in good faith and we want to get this
right. If build 1.0 (4) still does not meet guideline 4.2, could you tell us
which part of the experience falls short? Knowing whether the concern is the
amount of functionality, the depth of any particular feature, or something
about the concept itself would let us address it directly instead of guessing.

We are happy to provide anything else that helps, including a walkthrough
video of the demo account.

Thank you for your time.
```
