-- ============================================================================
-- Cuenta de demostración para la revisión de la App Store.
--
-- Apple exige credenciales de prueba en las notas del revisor cuando la app
-- exige cuenta (guideline 2.1). Pero un usuario recién registrado en Seis Más
-- se queda en "esperando grupo" con cinco huecos vacíos: el revisor vería una
-- app sin funcionalidad, que es exactamente el rechazo 2.1 que se intenta
-- evitar. Por eso esto no crea un usuario, crea un ESCENARIO COMPLETO:
--
--   * el revisor y cinco compañeros ya emparejados en un grupo activo,
--   * un plan futuro confirmado en un local con dirección y anfitrión,
--   * un plan pasado sin valorar, para que la pantalla de valoración también
--     se pueda revisar,
--   * el test de personalidad ya respondido (si no, la app lo manda a hacerlo).
--
-- Credenciales que van en App Store Connect:
--   usuario:    revisor.appstore@seismas.app
--   contraseña: Revisor2026!
--
-- ES IDEMPOTENTE: se puede volver a correr las veces que haga falta. Cada
-- corrida además REFRESCA las fechas de los eventos (relativas a now()) y
-- revive la cuenta si el revisor la eliminó probando "Eliminar mi cuenta" —
-- que es justo lo que se espera que pruebe. Conviene correrlo de nuevo antes
-- de cada envío a revisión, porque si no el "plan futuro" deja de ser futuro.
--
-- Cómo correrlo:
--   local:       psql -d seis_mas -f db/cuenta_demo_app_store.sql
--   producción:  railway ssh --service Postgres \
--                  "psql -U postgres -d railway -v ON_ERROR_STOP=1" \
--                  < db/cuenta_demo_app_store.sql
--
-- En producción tiene que correr como superusuario (postgres), no como
-- seis_app: siembra `comercios`, que es el lado comercial de la frontera y
-- sobre el que seis_app tiene REVOKE ALL. Ver README, "La base".
--
-- Los hashes bcrypt están precalculados a propósito: el archivo no puede
-- llevar contraseñas en texto plano dentro de la base, y psql no sabe hacer
-- bcrypt. El de los cinco acompañantes es el hash de una cadena aleatoria de
-- 32 bytes que no existe en ningún lado: son personas del grupo, no cuentas
-- con las que se pueda entrar.
--
-- Para borrar todo esto, ver db/limpiar_datos_demo.sql.
-- ============================================================================

BEGIN;

-- --- Las seis personas del grupo -------------------------------------------
--
-- Mayores de 18 en todos los casos, porque el backend rechaza el registro por
-- debajo de esa edad y una cuenta de demo que contradiga la regla que sostiene
-- la clasificación 17+ de la ficha es peor que no tener demo.

INSERT INTO usuarios (id, email, password_hash, nombre, fecha_nacimiento, genero, telefono)
VALUES
  ('ded00000-0000-4000-8000-000000000001', 'revisor.appstore@seismas.app',
   '$2b$10$4HHAv5dh/ujOwYdknAd5QOt4lQ/zwHebAMa/6VysrvuvWi7jS9dHm',
   'Alejandro Rivas', '1993-04-18', 'Masculino', '+57 310 000 0001'),
  ('ded00000-0000-4000-8000-000000000002', 'demo.mariana@seismas.app',
   '$2b$10$7rZ8MHzhNKRs6tzAtQNBHObp21XDk867GvZH3Ux3wBhU1dGE74RyW',
   'Mariana Gómez', '1994-09-02', 'Femenino', NULL),
  ('ded00000-0000-4000-8000-000000000003', 'demo.julian@seismas.app',
   '$2b$10$7rZ8MHzhNKRs6tzAtQNBHObp21XDk867GvZH3Ux3wBhU1dGE74RyW',
   'Julián Ospina', '1991-01-27', 'Masculino', NULL),
  ('ded00000-0000-4000-8000-000000000004', 'demo.daniela@seismas.app',
   '$2b$10$7rZ8MHzhNKRs6tzAtQNBHObp21XDk867GvZH3Ux3wBhU1dGE74RyW',
   'Daniela Ruiz', '1996-06-11', 'Femenino', NULL),
  ('ded00000-0000-4000-8000-000000000005', 'demo.andres@seismas.app',
   '$2b$10$7rZ8MHzhNKRs6tzAtQNBHObp21XDk867GvZH3Ux3wBhU1dGE74RyW',
   'Andrés Peláez', '1989-11-30', 'Masculino', NULL),
  ('ded00000-0000-4000-8000-000000000006', 'demo.laura@seismas.app',
   '$2b$10$7rZ8MHzhNKRs6tzAtQNBHObp21XDk867GvZH3Ux3wBhU1dGE74RyW',
   'Laura Mejía', '1995-03-08', 'Femenino', NULL)
ON CONFLICT (id) DO UPDATE SET
  email         = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  nombre        = EXCLUDED.nombre,
  -- Revive la cuenta: el revisor tiene que poder probar "Eliminar mi cuenta"
  -- (está descrito en la ficha) sin que eso queme el escenario para el
  -- siguiente envío.
  deleted_at    = NULL;

-- --- Intereses --------------------------------------------------------------
--
-- Se resuelven por nombre y no por id: pa_intereses se siembra con
-- gen_random_uuid(), así que los ids son distintos en cada base.

DELETE FROM usuario_intereses
 WHERE usuario_id IN (
   'ded00000-0000-4000-8000-000000000001','ded00000-0000-4000-8000-000000000002',
   'ded00000-0000-4000-8000-000000000003','ded00000-0000-4000-8000-000000000004',
   'ded00000-0000-4000-8000-000000000005','ded00000-0000-4000-8000-000000000006');

INSERT INTO usuario_intereses (usuario_id, interes_id)
SELECT v.usuario_id, i.id
  FROM (VALUES
    ('ded00000-0000-4000-8000-000000000001'::uuid, 'Gastronomía'),
    ('ded00000-0000-4000-8000-000000000001'::uuid, 'Música'),
    ('ded00000-0000-4000-8000-000000000001'::uuid, 'Tecnología'),
    ('ded00000-0000-4000-8000-000000000002'::uuid, 'Gastronomía'),
    ('ded00000-0000-4000-8000-000000000002'::uuid, 'Lectura'),
    ('ded00000-0000-4000-8000-000000000003'::uuid, 'Música'),
    ('ded00000-0000-4000-8000-000000000003'::uuid, 'Gastronomía'),
    ('ded00000-0000-4000-8000-000000000004'::uuid, 'Bienestar'),
    ('ded00000-0000-4000-8000-000000000004'::uuid, 'Gastronomía'),
    ('ded00000-0000-4000-8000-000000000005'::uuid, 'Tecnología'),
    ('ded00000-0000-4000-8000-000000000005'::uuid, 'Deporte'),
    ('ded00000-0000-4000-8000-000000000006'::uuid, 'Música'),
    ('ded00000-0000-4000-8000-000000000006'::uuid, 'Bienestar')
  ) AS v(usuario_id, interes)
  JOIN pa_intereses i ON i.nombre = v.interes;

-- --- Test de personalidad ---------------------------------------------------
--
-- Sin un test vigente la app manda al revisor a responder veinte preguntas
-- antes de dejarle ver nada. Las respuestas son las mismas veinte claves que
-- envía mobile/src/screens/TestPersonalidadScreen.js, con `localidad` igual en
-- los seis: el matching agrupa por localidad, y un grupo repartido entre
-- ciudades no lo habría formado nunca. `resultado` va NULL porque es lo que
-- manda hoy la app.

-- Se borran y se vuelven a insertar, en vez de marcar el anterior como no
-- vigente: si no, cada corrida dejaría un test histórico más en el perfil del
-- revisor, y a los cinco envíos su historial tendría cinco tests idénticos.
DELETE FROM tests_personalidad
 WHERE usuario_id IN (
   'ded00000-0000-4000-8000-000000000001','ded00000-0000-4000-8000-000000000002',
   'ded00000-0000-4000-8000-000000000003','ded00000-0000-4000-8000-000000000004',
   'ded00000-0000-4000-8000-000000000005','ded00000-0000-4000-8000-000000000006');

INSERT INTO tests_personalidad (usuario_id, respuestas, resultado, version_test, vigente)
SELECT v.usuario_id, v.respuestas::jsonb, NULL, 1, TRUE
  FROM (VALUES
    ('ded00000-0000-4000-8000-000000000001'::uuid, '{"edad":"25_31","genero_biologico":"masculino","identidad":"hetero","temperamento":"ambivertido","localidad":"pereira","actividades":"sociales","estudios":"profesional","estado_civil":"soltero_feliz","planes":"club_lectura","decisiones":"logicas","ideas":"innovadoras","plan_musical":"rock","animal_favorito":"tierra","zodiaco":"a_veces","exploracion":"aventurero","antiestres":"amistades","relacionamiento":"lider","informacion":"comidas","disposicion":"si","valores":"si"}'),
    ('ded00000-0000-4000-8000-000000000002'::uuid, '{"edad":"25_31","genero_biologico":"femenino","identidad":"hetero","temperamento":"ambivertido","localidad":"pereira","actividades":"sociales","estudios":"profesional","estado_civil":"soltero_feliz","planes":"club_lectura","decisiones":"logicas","ideas":"innovadoras","plan_musical":"pop","animal_favorito":"aire","zodiaco":"si","exploracion":"aventurero","antiestres":"amistades","relacionamiento":"seguidor","informacion":"comidas","disposicion":"si","valores":"si"}'),
    ('ded00000-0000-4000-8000-000000000003'::uuid, '{"edad":"32_44","genero_biologico":"masculino","identidad":"hetero","temperamento":"extrovertido","localidad":"pereira","actividades":"sociales","estudios":"profesional","estado_civil":"soltero_feliz","planes":"fiestas","decisiones":"flexibles","ideas":"innovadoras","plan_musical":"rock","animal_favorito":"tierra","zodiaco":"no","exploracion":"aventurero","antiestres":"fiesta","relacionamiento":"lider","informacion":"viajes","disposicion":"si","valores":"si"}'),
    ('ded00000-0000-4000-8000-000000000004'::uuid, '{"edad":"25_31","genero_biologico":"femenino","identidad":"bisexual","temperamento":"ambivertido","localidad":"pereira","actividades":"sociales","estudios":"maestria","estado_civil":"soltero_feliz","planes":"hogarenos","decisiones":"logicas","ideas":"criticas","plan_musical":"crossover","animal_favorito":"agua","zodiaco":"a_veces","exploracion":"tranquilo","antiestres":"meditar","relacionamiento":"seguidor","informacion":"culturales","disposicion":"si","valores":"si"}'),
    ('ded00000-0000-4000-8000-000000000005'::uuid, '{"edad":"32_44","genero_biologico":"masculino","identidad":"hetero","temperamento":"introvertido","localidad":"pereira","actividades":"deportivas","estudios":"profesional","estado_civil":"soltero_feliz","planes":"deportivos","decisiones":"logicas","ideas":"innovadoras","plan_musical":"rock","animal_favorito":"tierra","zodiaco":"no_creo_astrologia","exploracion":"territorial","antiestres":"actividad_fisica","relacionamiento":"indiferente","informacion":"negocios","disposicion":"si","valores":"si"}'),
    ('ded00000-0000-4000-8000-000000000006'::uuid, '{"edad":"25_31","genero_biologico":"femenino","identidad":"hetero","temperamento":"extrovertido","localidad":"pereira","actividades":"sociales","estudios":"profesional","estado_civil":"soltero_feliz","planes":"fiestas","decisiones":"flexibles","ideas":"innovadoras","plan_musical":"pop","animal_favorito":"aire","zodiaco":"si","exploracion":"aventurero","antiestres":"amistades","relacionamiento":"seguidor","informacion":"comidas","disposicion":"si","valores":"si"}')
  ) AS v(usuario_id, respuestas);

-- --- El grupo ---------------------------------------------------------------

INSERT INTO grupos (id, nombre, estado)
VALUES ('ded00000-0000-4000-8000-000000000010', 'Grupo Pereira · miércoles', 'activo')
ON CONFLICT (id) DO UPDATE SET
  nombre     = EXCLUDED.nombre,
  estado     = EXCLUDED.estado,
  deleted_at = NULL;

-- Sin ON CONFLICT a propósito. El trigger enforce_grupo_max_6 corre BEFORE
-- INSERT, o sea ANTES de que Postgres detecte el conflicto: con
-- `ON CONFLICT DO NOTHING` la segunda corrida abortaría con "el grupo ya tiene
-- el máximo de 6 miembros". Filtrando con NOT EXISTS no se inserta nada y el
-- trigger ni se dispara.
INSERT INTO grupo_miembros (grupo_id, usuario_id, rol, fecha_union)
SELECT v.grupo_id, v.usuario_id, v.rol, now() - v.antiguedad
  FROM (VALUES
    ('ded00000-0000-4000-8000-000000000010'::uuid, 'ded00000-0000-4000-8000-000000000003'::uuid, 'creador', interval '21 days'),
    ('ded00000-0000-4000-8000-000000000010'::uuid, 'ded00000-0000-4000-8000-000000000002'::uuid, 'miembro', interval '19 days'),
    ('ded00000-0000-4000-8000-000000000010'::uuid, 'ded00000-0000-4000-8000-000000000005'::uuid, 'miembro', interval '17 days'),
    ('ded00000-0000-4000-8000-000000000010'::uuid, 'ded00000-0000-4000-8000-000000000001'::uuid, 'miembro', interval '15 days'),
    ('ded00000-0000-4000-8000-000000000010'::uuid, 'ded00000-0000-4000-8000-000000000006'::uuid, 'miembro', interval '13 days'),
    ('ded00000-0000-4000-8000-000000000010'::uuid, 'ded00000-0000-4000-8000-000000000004'::uuid, 'miembro', interval '11 days')
  ) AS v(grupo_id, usuario_id, rol, antiguedad)
 WHERE NOT EXISTS (
   SELECT 1 FROM grupo_miembros gm
    WHERE gm.grupo_id = v.grupo_id AND gm.usuario_id = v.usuario_id);

DELETE FROM grupo_intereses WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010';

INSERT INTO grupo_intereses (grupo_id, interes_id, peso)
SELECT 'ded00000-0000-4000-8000-000000000010', i.id, v.peso
  FROM (VALUES ('Gastronomía', 4), ('Música', 3), ('Bienestar', 2), ('Tecnología', 2))
       AS v(interes, peso)
  JOIN pa_intereses i ON i.nombre = v.interes;

-- --- El local y su anfitrión ------------------------------------------------
--
-- Un comercio real de demostración: la app muestra nombre, dirección y ciudad
-- del plan, y sin ellos la tarjeta se ve rota. Marcado `activo` porque
-- v_comercio_publico —lo único que la API social puede leer de comercios—
-- filtra por esa columna.

INSERT INTO comercios (id, nombre, nit, direccion, ciudad, categoria, telefono, email,
                       descripcion, horario, activo)
VALUES ('ded00000-0000-4000-8000-000000000020', 'Café Botánico',
        '901000000-1', 'Cra. 14 #4-32, Barrio Álamos', 'Pereira', 'Restaurante',
        '+57 606 000 0000', 'demo.local@seismas.app',
        'Cocina de mercado y mesa larga para grupos. Carta corta que cambia cada semana.',
        'Mar a sáb, 5:00 p. m. a 11:00 p. m.', TRUE)
ON CONFLICT (id) DO UPDATE SET
  nombre      = EXCLUDED.nombre,
  direccion   = EXCLUDED.direccion,
  ciudad      = EXCLUDED.ciudad,
  -- La descripción se refresca también: es el texto que sale en la pantalla
  -- del sitio, y por tanto en las capturas de la App Store.
  descripcion = EXCLUDED.descripcion,
  horario     = EXCLUDED.horario,
  activo      = TRUE,
  deleted_at  = NULL;

INSERT INTO anfitriones (id, comercio_id, nombre, email, telefono)
VALUES ('ded00000-0000-4000-8000-000000000021', 'ded00000-0000-4000-8000-000000000020',
        'Camila Restrepo', 'demo.anfitriona@seismas.app', '+57 310 000 0020')
ON CONFLICT (id) DO UPDATE SET
  nombre     = EXCLUDED.nombre,
  deleted_at = NULL;

-- --- Los dos planes ---------------------------------------------------------
--
-- Las fechas son relativas a now() y se recalculan en cada corrida: un plan
-- "futuro" con fecha fija deja de serlo solo, y la app lo mandaría al historial
-- justo cuando el revisor abre la app. Volver a correr este archivo antes de
-- cada envío es lo que mantiene el escenario vivo.
--
-- La hora se fija en horario de Bogotá (America/Bogota, el mismo huso que
-- Pereira) y no en el del servidor, que en Railway es UTC: un evento "a las
-- 7:30 p. m." definido en UTC se le mostraría al revisor a las 2:30 p. m.

INSERT INTO eventos (id, comercio_id, anfitrion_id, grupo_id, titulo, descripcion,
                     categoria, fecha_hora, capacidad, precio, estado)
VALUES
  ('ded00000-0000-4000-8000-000000000030',
   'ded00000-0000-4000-8000-000000000020', 'ded00000-0000-4000-8000-000000000021',
   'ded00000-0000-4000-8000-000000000010',
   'Cena larga en Café Botánico',
   'Mesa reservada para seis. Menú de tres tiempos y sobremesa. Llega diez minutos antes y pregunta por Camila.',
   'Gastronomía',
   ((date_trunc('day', now() AT TIME ZONE 'America/Bogota') + interval '6 days 19 hours 30 minutes') AT TIME ZONE 'America/Bogota'),
   6, 68000, 'confirmado'),
  ('ded00000-0000-4000-8000-000000000031',
   'ded00000-0000-4000-8000-000000000020', 'ded00000-0000-4000-8000-000000000021',
   'ded00000-0000-4000-8000-000000000010',
   'Primer encuentro del grupo',
   'El plan con el que arrancó el grupo. Ya pasó: queda pendiente valorarlo.',
   'Gastronomía',
   ((date_trunc('day', now() AT TIME ZONE 'America/Bogota') - interval '4 days' + interval '19 hours 30 minutes') AT TIME ZONE 'America/Bogota'),
   6, 55000, 'finalizado')
ON CONFLICT (id) DO UPDATE SET
  titulo      = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  fecha_hora  = EXCLUDED.fecha_hora,
  precio      = EXCLUDED.precio,
  estado      = EXCLUDED.estado,
  deleted_at  = NULL;

-- El plan pasado tiene que quedar SIN valorar para que la pantalla de
-- valoración esté a la vista. Si el revisor de un envío anterior lo valoró, la
-- valoración se borra: el escenario vuelve a su estado inicial.
DELETE FROM feedback
 WHERE usuario_id = 'ded00000-0000-4000-8000-000000000001';

-- --- La conversación del grupo -----------------------------------------------
--
-- El chat no puede estar vacío cuando el revisor lo abre: una pantalla de chat
-- sin mensajes se lee igual que una función que no existe. Se siembra una
-- conversación corta y verosímil, escrita por los cinco acompañantes.
--
-- Se borra y se vuelve a insertar en cada corrida para que el revisor anterior
-- no le deje mensajes al siguiente, y para limpiar lo que se haya probado.
DELETE FROM mensajes_grupo WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010';

INSERT INTO mensajes_grupo (grupo_id, usuario_id, texto, created_at)
SELECT 'ded00000-0000-4000-8000-000000000010', v.usuario_id, v.texto, now() - v.hace
  FROM (VALUES
    ('ded00000-0000-4000-8000-000000000003'::uuid, '¡Hola a todos! Qué nervios y qué ganas 😄', interval '30 hours'),
    ('ded00000-0000-4000-8000-000000000002'::uuid, 'Igual. ¿Alguien ha ido antes al Botánico?', interval '29 hours'),
    ('ded00000-0000-4000-8000-000000000006'::uuid, 'Yo pasé por fuera, se ve lindo. Dicen que la trucha es buenísima', interval '28 hours'),
    ('ded00000-0000-4000-8000-000000000005'::uuid, 'Pregunta boba: ¿hay dónde parquear cerca?', interval '26 hours'),
    ('ded00000-0000-4000-8000-000000000003'::uuid, 'Hay un parqueadero a media cuadra, sobre la 14', interval '25 hours'),
    ('ded00000-0000-4000-8000-000000000004'::uuid, 'Perfecto. Yo llego derecho del trabajo, quizá 10 minutos tarde', interval '9 hours'),
    ('ded00000-0000-4000-8000-000000000002'::uuid, 'Tranquila, te guardamos puesto 🙌', interval '8 hours')
  ) AS v(usuario_id, texto, hace);

-- --- Quién viene ------------------------------------------------------------
--
-- Tres estados distintos a propósito: confirmados, alguien que no puede ir, y
-- el revisor sin contestar todavía, para que al abrir la app tenga el botón de
-- "voy" esperándole y pueda probarlo.
UPDATE grupo_miembros SET asistencia = 'confirmada', asistencia_actualizada = now() - interval '1 day'
 WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010'
   AND usuario_id IN ('ded00000-0000-4000-8000-000000000002',
                      'ded00000-0000-4000-8000-000000000003',
                      'ded00000-0000-4000-8000-000000000006');

UPDATE grupo_miembros SET asistencia = 'declinada', asistencia_actualizada = now() - interval '5 hours'
 WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010'
   AND usuario_id = 'ded00000-0000-4000-8000-000000000005';

UPDATE grupo_miembros SET asistencia = 'pendiente', asistencia_actualizada = NULL
 WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010'
   AND usuario_id IN ('ded00000-0000-4000-8000-000000000001',
                      'ded00000-0000-4000-8000-000000000004');

-- --- Moderación: la cuenta del revisor vuelve limpia -------------------------
--
-- Si probó a bloquear o a reportar —y se espera que lo pruebe—, la siguiente
-- corrida lo deshace. Un bloqueo heredado escondería mensajes del chat sembrado
-- y el siguiente revisor vería una conversación con huecos.
DELETE FROM bloqueos WHERE usuario_id IN (
  'ded00000-0000-4000-8000-000000000001','ded00000-0000-4000-8000-000000000002',
  'ded00000-0000-4000-8000-000000000003','ded00000-0000-4000-8000-000000000004',
  'ded00000-0000-4000-8000-000000000005','ded00000-0000-4000-8000-000000000006')
   OR bloqueado_id IN (
  'ded00000-0000-4000-8000-000000000001','ded00000-0000-4000-8000-000000000002',
  'ded00000-0000-4000-8000-000000000003','ded00000-0000-4000-8000-000000000004',
  'ded00000-0000-4000-8000-000000000005','ded00000-0000-4000-8000-000000000006');

DELETE FROM reportes WHERE reportante_id = 'ded00000-0000-4000-8000-000000000001';

COMMIT;

-- --- Verificación -----------------------------------------------------------
--
-- Lo que debe imprimir: 6 miembros, 1 plan futuro, 1 plan por valorar.

SELECT
  (SELECT count(*) FROM grupo_miembros
    WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010')          AS miembros,
  (SELECT count(*) FROM eventos
    WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010'
      AND fecha_hora > now() AND deleted_at IS NULL)                  AS planes_futuros,
  (SELECT count(*) FROM eventos e
    WHERE e.grupo_id = 'ded00000-0000-4000-8000-000000000010'
      AND e.fecha_hora < now() AND e.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM feedback f
                       WHERE f.evento_id = e.id
                         AND f.usuario_id = 'ded00000-0000-4000-8000-000000000001')) AS por_valorar,
  (SELECT count(*) FROM tests_personalidad
    WHERE usuario_id = 'ded00000-0000-4000-8000-000000000001' AND vigente) AS test_vigente,
  (SELECT count(*) FROM mensajes_grupo
    WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010' AND NOT oculto) AS mensajes,
  (SELECT count(*) FROM grupo_miembros
    WHERE grupo_id = 'ded00000-0000-4000-8000-000000000010'
      AND asistencia = 'confirmada')                                        AS confirmados;
