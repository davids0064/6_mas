-- ============================================================================
-- 006 — El cuestionario del test deja de vivir en el binario.
--
-- Las 20 preguntas y sus 84 opciones estaban en una constante de
-- `mobile/src/screens/TestPersonalidadScreen.js`. Cambiar un enunciado o
-- añadir una opción obligaba a compilar, subir a App Store Connect y esperar
-- revisión — mientras que añadir un interés era un INSERT, porque los demás
-- catálogos (`pa_intereses`, `pa_generos`, `pa_planes_comercio`) sí viven acá.
--
-- QUÉ SE PUEDE CAMBIAR DESDE AQUÍ, Y QUÉ NO
--
-- Los TEXTOS, el ORDEN y el estado ACTIVO son datos: se tocan y ya.
--
-- Las CLAVES de pregunta y los VALORES de opción NO lo son, aunque vivan en
-- una tabla. Trece de las veinte preguntas tienen significado para el backend:
--
--   * `localidad` parte los grupos por ciudad, y sus valores se cruzan con
--     `comercios.ciudad` (services/programacion.js).
--   * ocho preguntas definen los ejes del perfil, y lo hacen por el VALOR
--     concreto de cada opción: 'extrovertido' empuja hacia un polo y
--     'introvertido' hacia el otro (services/perfilPersonalidad.js).
--   * cuatro se le muestran a la persona como "lo que NO usamos para
--     agruparte", que es una promesa que la App Store nos hizo escribir.
--
-- Borrar o renombrar cualquiera de esas claves rompe el perfil o el matching
-- SIN QUE FALLE NADA: nadie ve un error, simplemente los grupos salen peor.
-- Por eso el backend comprueba al arrancar que siguen existiendo y se niega a
-- levantar si no (services/cuestionario.js). Un fallo mudo convertido en uno
-- ruidoso.
--
-- Las siete libres —edad, actividades, estudios, estado_civil, plan_musical,
-- animal_favorito, zodiaco— se comparan solo por igualdad entre dos personas,
-- así que ahí se pueden añadir y quitar opciones con libertad.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pa_test_preguntas (
    -- La clave es el identificador estable que viaja dentro del jsonb de
    -- `tests_personalidad.respuestas` y el que conoce el backend. No es un
    -- UUID a propósito: tiene que poder leerse en una respuesta guardada.
    clave      TEXT PRIMARY KEY,
    texto      TEXT NOT NULL,
    orden      INT  NOT NULL,
    activo     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pa_test_opciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pregunta_clave TEXT NOT NULL REFERENCES pa_test_preguntas(clave) ON DELETE CASCADE,
    -- Igual que la clave de la pregunta: es lo que se guarda en la respuesta,
    -- así que renombrarlo deja huérfanas las respuestas ya dadas.
    valor          TEXT NOT NULL,
    texto          TEXT NOT NULL,
    orden          INT  NOT NULL,
    -- Retirar una opción se hace con `activo = FALSE`, no con DELETE: las
    -- respuestas que ya la eligieron siguen apuntando a ese valor, y borrarlo
    -- las dejaría sin significado.
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pregunta_clave, valor)
);

CREATE INDEX IF NOT EXISTS ix_test_opciones_pregunta
    ON pa_test_opciones (pregunta_clave, orden);

DROP TRIGGER IF EXISTS trg_test_preguntas_updated_at ON pa_test_preguntas;
CREATE TRIGGER trg_test_preguntas_updated_at
    BEFORE UPDATE ON pa_test_preguntas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- El cuestionario vigente -------------------------------------------------
--
-- Generado desde la constante que había en la app, no transcrito a mano: tenía
-- que entrar idéntico para que las respuestas ya guardadas sigan valiendo.

INSERT INTO pa_test_preguntas (clave, texto, orden) VALUES
    ('edad', '¿Cuál es tu edad?', 1),
    ('genero_biologico', '¿Cuál es tu género biológico?', 2),
    ('identidad', 'Te asumes como:', 3),
    ('temperamento', '¿Cuál de estas opciones te describiría mejor?', 4),
    ('localidad', '¿En qué localidad vives?', 5),
    ('actividades', '¿Qué tipo de actividades te gustan más?', 6),
    ('estudios', '¿Cuál es tu nivel de estudios?', 7),
    ('estado_civil', '¿Cuál es tu estado civil?', 8),
    ('planes', '¿Tus planes están generalmente más relacionados con…?', 9),
    ('decisiones', 'Tus decisiones las clasificarías como:', 10),
    ('ideas', 'Tus ideas, pensamientos y opiniones las clasificarías como:', 11),
    ('plan_musical', '¿Cuál sería tu mejor plan musical?', 12),
    ('animal_favorito', 'Tu animal favorito es de:', 13),
    ('zodiaco', '¿Crees que influyen los signos zodiacales en la personalidad?', 14),
    ('exploracion', 'En términos de exploración y experiencias te consideras:', 15),
    ('antiestres', 'Si quisieras salirte de la rutina y liberarte del estrés, ¿cuáles serían tus métodos?', 16),
    ('relacionamiento', 'En términos de relacionamiento con otros te consideras…:', 17),
    ('informacion', '¿Qué tipo de información te gustaría conocer y recibir de otras personas?', 18),
    ('disposicion', '¿Estarías con la disposición de participar en planes con otras personas, aún si no son absolutamente compatibles con tus gustos o inclinaciones?', 19),
    ('valores', '¿Crees en la libertad, los derechos humanos, la democracia y el respeto por el otro, aunque no piense igual a ti?', 20)
ON CONFLICT (clave) DO UPDATE SET texto = EXCLUDED.texto, orden = EXCLUDED.orden;

INSERT INTO pa_test_opciones (pregunta_clave, valor, texto, orden) VALUES
    ('edad', '18_24', '18 a 24 años', 1),
    ('edad', '25_31', '25 a 31 años', 2),
    ('edad', '32_44', '32 a 44 años', 3),
    ('edad', '45_54', '45 a 54 años', 4),
    ('edad', '55_mas', 'Más de 55', 5),
    ('genero_biologico', 'masculino', 'Masculino', 1),
    ('genero_biologico', 'femenino', 'Femenino', 2),
    ('identidad', 'hetero', 'Hetero', 1),
    ('identidad', 'bisexual', 'Bisexual', 2),
    ('identidad', 'diverso', 'Diverso LGBTQ+', 3),
    ('identidad', 'no_binario', 'No binario', 4),
    ('temperamento', 'introvertido', 'Introvertido', 1),
    ('temperamento', 'extrovertido', 'Extrovertido', 2),
    ('temperamento', 'ambivertido', 'Ambivertido', 3),
    ('temperamento', 'todas', 'Todas las anteriores', 4),
    ('localidad', 'pereira', 'Pereira', 1),
    ('localidad', 'dosquebradas', 'Dosquebradas', 2),
    ('localidad', 'santa_rosa', 'Santa Rosa', 3),
    ('localidad', 'manizales', 'Manizales', 4),
    ('actividades', 'deportivas', 'Deportivas', 1),
    ('actividades', 'sociales', 'Sociales', 2),
    ('actividades', 'profesionales', 'Profesionales', 3),
    ('estudios', 'preescolar', 'Preescolar', 1),
    ('estudios', 'bachiller', 'Bachiller', 2),
    ('estudios', 'profesional', 'Profesional', 3),
    ('estudios', 'maestria', 'Maestría', 4),
    ('estudios', 'doctorado', 'Doctorado', 5),
    ('estado_civil', 'soltero_feliz', 'Soltero feliz', 1),
    ('estado_civil', 'soltero_infeliz', 'Soltero infeliz', 2),
    ('estado_civil', 'casado', 'Casado', 3),
    ('estado_civil', 'divorciado', 'Divorciado', 4),
    ('estado_civil', 'viudo', 'Viudo', 5),
    ('planes', 'clubes_deportivos', 'Clubes deportivos', 1),
    ('planes', 'fiestas', 'Fiestas', 2),
    ('planes', 'hogarenos', 'Planes hogareños', 3),
    ('planes', 'club_lectura', 'Club de lectura', 4),
    ('planes', 'deportivos', 'Planes deportivos', 5),
    ('planes', 'sin_planes', 'No tengo planes', 6),
    ('decisiones', 'impulsivas', 'Impulsivas', 1),
    ('decisiones', 'logicas', 'Lógicas', 2),
    ('decisiones', 'flexibles', 'Flexibles', 3),
    ('decisiones', 'influenciables', 'Influenciables', 4),
    ('ideas', 'innovadoras', 'Innovadoras', 1),
    ('ideas', 'tradicionales', 'Tradicionales', 2),
    ('ideas', 'criticas', 'Críticas', 3),
    ('ideas', 'irrelevantes', 'Irrelevantes', 4),
    ('plan_musical', 'parranda', 'Parranda', 1),
    ('plan_musical', 'clasica', 'Clásica', 2),
    ('plan_musical', 'rock', 'Rock', 3),
    ('plan_musical', 'crossover', 'Crossover', 4),
    ('plan_musical', 'popular', 'Popular', 5),
    ('plan_musical', 'pop', 'Pop', 6),
    ('plan_musical', 'metal', 'Metal', 7),
    ('plan_musical', 'regueton', 'Reguetón', 8),
    ('animal_favorito', 'agua', 'Agua', 1),
    ('animal_favorito', 'tierra', 'Tierra', 2),
    ('animal_favorito', 'aire', 'Aire', 3),
    ('zodiaco', 'si', 'Sí', 1),
    ('zodiaco', 'no', 'No', 2),
    ('zodiaco', 'a_veces', 'A veces', 3),
    ('zodiaco', 'no_creo_astrologia', 'No creo en la astrología', 4),
    ('exploracion', 'aventurero', 'Aventurero e inquieto', 1),
    ('exploracion', 'tranquilo', 'Muy tranquilo', 2),
    ('exploracion', 'territorial', 'Estable territorial', 3),
    ('antiestres', 'fiesta', 'Salir de fiesta', 1),
    ('antiestres', 'amistades', 'Compartir con amistades', 2),
    ('antiestres', 'actividad_fisica', 'Actividad física', 3),
    ('antiestres', 'meditar', 'Meditar', 4),
    ('antiestres', 'dormir', 'Dormir', 5),
    ('antiestres', 'naturaleza', 'Conexión natural', 6),
    ('antiestres', 'psicoactivos', 'Usar psicoactivos', 7),
    ('relacionamiento', 'seguidor', 'Seguidor', 1),
    ('relacionamiento', 'lider', 'Líder', 2),
    ('relacionamiento', 'indiferente', 'Indiferente', 3),
    ('informacion', 'misticos', 'Temas místicos', 1),
    ('informacion', 'culturales', 'Culturales', 2),
    ('informacion', 'negocios', 'Negocios', 3),
    ('informacion', 'viajes', 'Viajes', 4),
    ('informacion', 'comidas', 'Comidas', 5),
    ('informacion', 'politicos', 'Políticos', 6),
    ('disposicion', 'si', 'Sí', 1),
    ('disposicion', 'no', 'Definitivamente no', 2),
    ('valores', 'si', 'Sí', 1),
    ('valores', 'no', 'Definitivamente no', 2)
ON CONFLICT (pregunta_clave, valor) DO UPDATE SET texto = EXCLUDED.texto, orden = EXCLUDED.orden;
-- --- Permisos ---------------------------------------------------------------
-- Solo lectura: el cuestionario se administra con SQL, no desde la API.
GRANT SELECT ON pa_test_preguntas, pa_test_opciones TO seis_app;
REVOKE ALL ON pa_test_preguntas, pa_test_opciones FROM seis_dashboard;

COMMIT;

-- --- Verificación -----------------------------------------------------------
SELECT (SELECT count(*) FROM pa_test_preguntas) AS preguntas,
       (SELECT count(*) FROM pa_test_opciones)  AS opciones;
