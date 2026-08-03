# Guía de Diseño UI — Seis Más

Fuente de verdad en código: `src/theme/tokens.js`. Pantallas: `src/screens/`. Componentes de formulario: `src/components/form/`. Mockups: `docs/mockups/`.

Para exportar a Figma/Sketch: crear los tokens de este documento como *color styles* y *text styles* compartidos; cada pantalla descrita abajo corresponde a un frame mobile (390×844).

---

## 1. Guía de estilos

### 1.1 Paleta corporativa

La paleta está **muestreada de `assets/home_1.png`** (la ilustración de las personas de la bienvenida), que es la referencia visual de la marca — así todas las pantallas se sienten parte del mismo universo que la imagen:

| Color | Hex | Origen en la imagen | Rol |
|---|---|---|---|
| Azul | `#315699` | Letras "Seis" del logo | Botones primarios, chips activos, encabezados |
| Azul claro | `#5B84C4` | Azul del logo aclarado | Acentos interactivos sobre fondo oscuro |
| Naranja | `#F79547` | Letras "Más" del logo | **CTA principal** ("¡Empezar!", "Continuar al Test") — un solo CTA naranja por pantalla |
| Dorado | `#F8AC64` | Resplandor del anillo central | Barra de progreso del test, gamificación |
| Verde | `#739F20` / `#8CBE3F` | Círculo de gastronomía (y su versión aclarada) | Estados de éxito: checkmarks de validación y opción elegida |
| Azul profundo | `#232456` | Cielo índigo de las esquinas | Fondo principal (tema oscuro) |
| Blanco | `#FFFFFF` | Tipografía del banner | Tipografía principal sobre fondos oscuros |
| Crema | `#F9E3C7` | Halo cálido del logo | Subtítulos destacados |

Tokens semánticos derivados (documentados para mantener consistencia):

| Token | Hex | Derivación / uso |
|---|---|---|
| `superficie` | `#2F3168` | Índigo "elevado": inputs, tarjetas de opción |
| `borde` | `#45477E` | Divisores y bordes en reposo sobre fondo oscuro |
| `textoSuave` | `#E4E2F2` | Subtítulos, texto secundario |
| `textoTenue` | `#9FA3CE` | Placeholders (índigo aclarado) |
| `error` | `#FF6B6B` | **Extensión semántica**: la imagen no trae rojo plano y usar naranja para errores competiría con el CTA; rojo suave legible sobre índigo |

### 1.2 Tipografía

Sans-serif del sistema (SF Pro en iOS, Roboto en Android): claridad, cero peso extra y look nativo.

| Estilo | Tamaño/peso | Uso |
|---|---|---|
| `logo` | 44 / 800 | Logotipo "Seis Más" en bienvenida |
| `titulo` | 26 / 800 | Títulos de pantalla y preguntas del quiz |
| `subtitulo` | 15 / 400 | Microcopy bajo títulos |
| `etiqueta` | 14 / 600 | Labels de campos, contador de progreso |
| `input` | 16 / 400 | Texto de inputs y opciones (16pt evita el zoom automático de iOS) |
| `boton` | 17 / 700 | CTAs |
| `ayuda` | 13 / 400 | Errores, notas al pie |

### 1.3 Íconos

- **Intereses**: los 6 sprites circulares de `assets/icons/` (bienestar, fitness, gastronomía, tecnología, música, lectura) — mismos en bienvenida y registro para continuidad.
- **Campos y quiz**: emoji nativos minimalistas (👤 ✉️ 📱 🎂 👥 ✨ 🔒 / 🤩 🎲 🎤 ⚡…) — sin librería de íconos, render idéntico en ambas plataformas.

### 1.4 Forma y movimiento

- Radios: inputs y tarjetas 12, chips/CTA píldora (999), encabezados 20.
- Espaciado en escala de 8 (4/8/16/24/32).
- Animaciones con Reanimated: entradas `FadeInDown`/`FadeInRight` de 350–400ms, cascadas de ~60–140ms entre elementos, `Easing.back` para "pops" de CTA. Nada supera 800ms: el movimiento orienta, no estorba.

---

## 2. Pantallas y justificación UX

### 2.1 Bienvenida (`WelcomeAnimationScreen`)

**Composición**: la ilustración original de la marca (`home_1.png`) a pantalla completa — el logo, el lema "Conectando Personas", las seis personas sentadas en círculo y los 6 círculos de intereses alrededor. Técnicamente el fondo es `home_1_clean.png` (la misma imagen con los íconos removidos por inpainting) y los íconos son sprites recortados de la imagen original superpuestos en sus posiciones exactas: en reposo la escena es indistinguible del arte original.

**Animación**:
1. 0–2s: fade-in de toda la escena.
2. 8–10s: aparece el CTA naranja "¡Empezar!" con pop.
3. Al tocar: los 6 íconos **orbitan alrededor de las personas** durante 5s (2 vueltas, cada uno sobre la circunferencia en la que ya está dibujado, con aceleración/desaceleración suave) y al terminar se pasa al registro.

**Justificación**: la ilustración ES la identidad de la marca — no se recrea con componentes, se anima el arte real. La órbita al tocar "¡Empezar!" pone en movimiento la metáfora del producto (intereses girando en torno a un grupo de personas) y convierte el tap en parte de la narrativa. El CTA naranja (muestreado del "Más" del logo) es el único elemento de UI sobre la imagen.

### 2.2 Registro (`RegistroScreen`)

**Composición**: encabezado con gradiente azul del logo → azul profundo, título "Crea tu cuenta" y microcopy "¡Estás a un paso de conectar con nuevas personas! 🎉"; formulario sobre azul profundo con inputs en superficie elevada; CTA naranja "Continuar al Test de Personalidad →" y nota de confianza al pie.

**Orden de campos** (de lo fácil a lo comprometido, para construir inercia de completado):

| # | Campo | Justificación |
|---|---|---|
| 1 | Nombre | El más automático de responder |
| 2 | Correo | Hábito universal de registro |
| 3 | Teléfono | Misma categoría mental ("contacto") |
| 4 | Edad | 2 dígitos; valida mayoría de edad (18+) |
| 5 | Género (chips) | Primera selección: descansa del teclado |
| 6 | Intereses (chips, multi) | El corazón del matching y lo más divertido — a mitad del formulario renueva la motivación donde suele caer el abandono |
| 7–8 | Contraseña ×2 | Al final: el usuario ya invirtió esfuerzo |

**Validación**: doble momento — al perder foco (borde rojo + mensaje, o borde verde + ✓) y al enviar (marca todo lo pendiente); al corregir, el error desaparece con la primera tecla. Mensajes en tono cercano ("Cuéntanos tu nombre completo", "Elige al menos un interés para conectar mejor").

### 2.3 Test de Personalidad (`TestPersonalidadScreen`)

**Composición**: contador "Pregunta X de N" + **barra de progreso dorado** + microcopy "Cada respuesta afina tu grupo ideal ✨"; una pregunta por pantalla (título 26pt) con 3 opciones-tarjeta (emoji + texto).

**Interacción**: al elegir, la tarjeta se marca al instante (borde verde + ✓ + fondo verdoso), la barra dorada avanza animada y ~450ms después entra la siguiente pregunta deslizándose (`FadeInRight`). Sin botón "siguiente".

**Justificación**: una pregunta por pantalla elimina la sensación de examen y maximiza foco; el avance automático con feedback de éxito convierte cada respuesta en una micro-recompensa (patrón quiz/juego); la barra dorada — único elemento dorado de la app — hace visible el fin del compromiso ("me faltan 2") y reduce abandono. Las respuestas viajan como jsonb, así que el cuestionario placeholder puede reemplazarse por el definitivo sin tocar backend.

---

## 3. Notas técnicas

- Mobile-first React Native (iOS/Android), unidades relativas y sombras duales (`shadow*`/`elevation`).
- Componentes reutilizables: `CampoTexto`, `SelectorChips`, `BarraProgreso` — cualquier pantalla nueva se arma con ellos + tokens.
- Flujo conectado: Bienvenida → Registro (`POST /api/usuarios` + intereses best-effort) → Test (`POST .../test-personalidad`) → Grupos.
- `docs/REGISTRO_UX.md` queda superseded por este documento en lo relativo a colores (la justificación de campos sigue vigente y se replica arriba).
