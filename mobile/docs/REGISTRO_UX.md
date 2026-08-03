# Formulario de Registro — Guía UX/UI (Seis Más)

Pantalla: `src/screens/RegistroScreen.js` · Componentes: `src/components/form/` · Tokens: `src/theme/tokens.js`

El registro es el primer paso del flujo (Bienvenida → **Registro** → Test de Personalidad → Grupos). Su objetivo es capturar lo mínimo necesario para el matching sin fricción, transmitiendo desde el inicio el tono cálido y social de la marca.

---

## 1. Guía de estilos

Los valores viven como código en `src/theme/tokens.js` (fuente única de verdad). Para exportar a Figma/Sketch, crear estos mismos tokens como *color styles* y *text styles* compartidos.

### Colores

| Token | Hex | Uso |
|---|---|---|
| `azul` | `#1E56A8` | Inicio del gradiente del encabezado (azul del logo "Seis") |
| `azulElectrico` | `#2E6BE6` | Fin del gradiente, chips seleccionados, acentos interactivos |
| `naranja` | `#F5820D` | **CTA principal** (naranja del logo "Más") |
| `naranjaOscuro` | `#D96F00` | Sombra/presión del CTA |
| `fondo` | `#F6F8FC` | Fondo de pantalla (gris azulado muy claro, no blanco puro) |
| `superficie` | `#FFFFFF` | Fondo de inputs y chips |
| `texto` | `#1A2333` | Texto principal |
| `textoSuave` | `#5B6779` | Placeholders, notas al pie |
| `borde` | `#D9E1EE` | Bordes en reposo |
| `error` | `#E23D3D` | Bordes y mensajes de error |
| `exito` | `#1FA97C` | Borde + check ✓ de campo válido |

Regla de uso: el azul domina la jerarquía visual (identidad), el naranja se reserva **solo** para la acción principal — un único CTA naranja por pantalla garantiza que el ojo sepa a dónde ir.

### Tipografía

Fuente del sistema (SF Pro en iOS / Roboto en Android): look nativo y cero peso extra. Escala:

| Estilo | Tamaño / peso | Uso |
|---|---|---|
| `titulo` | 26 / 800 | "Crea tu cuenta" |
| `subtitulo` | 15 / 400 | Microcopy del encabezado |
| `etiqueta` | 14 / 600 | Labels de campos y chips |
| `input` | 16 / 400 | Texto ingresado (16pt evita zoom automático de iOS) |
| `boton` | 17 / 700 | CTA |
| `ayuda` | 13 / 400 | Errores y nota de seguridad |

### Íconos

Emoji nativos (sin librería de íconos → cero dependencias, render perfecto en ambas plataformas): 👤 nombre · ✉️ correo · 📱 teléfono · 🎂 edad · 👥 género · ✨ intereses · 🔒 contraseña. Los 6 intereses usan los mismos conceptos del anillo de la pantalla de bienvenida (🎵 🏋️ 🍽️ 📚 🧘 💻), reforzando continuidad visual entre pantallas.

### Forma y espaciado

- Radios: inputs 12, chips/CTA píldora (999), encabezado 20 abajo.
- Espaciado en escala de 8 (4/8/16/24/32).
- Animación de entrada: `FadeInDown` en cascada (~60ms entre campos, 400ms de duración) — presenta el formulario por bloques sin retrasar el uso.

---

## 2. Justificación UX de cada campo y su orden

Principio general: **de lo fácil a lo comprometido**. Los primeros campos son automáticos de responder (generan inercia de completado); los sensibles (contraseña) van al final, cuando el usuario ya invirtió esfuerzo.

| # | Campo | Por qué está | Por qué en esta posición |
|---|---|---|---|
| 1 | Nombre completo | Identidad dentro del grupo de 6 | El más fácil de responder: arranca la inercia |
| 2 | Correo | Credencial de acceso y canal de contacto | Aún fricción baja; hábito universal de registro |
| 3 | Teléfono | Coordinación de planes sorpresa con comercios | Después del correo, misma categoría mental ("contacto") |
| 4 | Edad | Mayoría de edad (18+) y matching por afinidad | Dato corto de 2 dígitos; validación inmediata |
| 5 | Género (chips) | Balance de grupos | Primer campo de selección: descansa del teclado |
| 6 | Intereses (chips múltiples) | **El corazón del matching** | El más divertido; a mitad del formulario renueva la motivación y conecta con la promesa de la app ("elige lo que te gusta") |
| 7-8 | Contraseña + confirmación | Seguridad de la cuenta | Al final: el usuario ya invirtió en el formulario y no abandona por este paso |

Microcopy: encabezado motivador ("¡Estás a un paso de conectar con nuevas personas! 🎉"), errores en tono cercano y accionable ("Cuéntanos tu nombre completo", "Elige al menos un interés para conectar mejor") y cierre de confianza ("🔐 Tu información está segura con nosotros").

Validación: doble momento — al perder el foco (feedback temprano campo a campo: borde rojo + mensaje, o borde verde + ✓) y al pulsar el CTA (marca todos los pendientes). Al corregir, el error desaparece con la primera tecla: castigo corto, refuerzo inmediato.

CTA: "Continuar al Test de Personalidad →" nombra el siguiente paso (expectativa clara, patrón *next-step labeling*) en naranja de marca sobre texto blanco, píldora ancha al final del scroll.

---

## 3. Implementación técnica

- **Componentes reutilizables**: `CampoTexto` (input con etiqueta/ícono/error/éxito) y `SelectorChips` (selección única o múltiple) sirven para cualquier formulario futuro de la app.
- **Mobile-first iOS/Android**: `KeyboardAvoidingView` + `ScrollView`, unidades relativas, sombras con `shadow*` (iOS) y `elevation` (Android).
- **Backend**: envía `nombre, email, password, genero, telefono` a `POST /api/usuarios`; los intereses se guardan *best-effort* contra `PUT /api/usuarios/:id/intereses` mapeando por nombre con el catálogo de `GET /api/intereses`. La edad se valida en cliente (18+); el esquema almacena `fecha_nacimiento`, que se capturará con precisión cuando el producto lo requiera.
- **Éxito**: `onRegistrado(usuario)` → App.js muestra el Test de Personalidad con el `usuarioId` real.
