-- ============================================================================
-- Cuenta de demostración para la revisión de "Seis Más Comercios".
--
-- Complementa a db/cuenta_demo_app_store.sql, que siembra el lado usuarios, y
-- REUTILIZA su escenario a propósito: el local que aquí recibe credenciales es
-- el mismo "Café Botánico" al que aquel archivo asignó el grupo de seis. Así el
-- revisor de esta app no ve un local recién registrado con la lista de
-- pendientes vacía, sino un evento real con seis asistentes — y las dos
-- revisiones miran los dos lados del mismo encuentro, que es lo que el producto
-- es.
--
--   >>> Correr ANTES db/cuenta_demo_app_store.sql. Este archivo da por hecho
--       que el comercio, el anfitrión y los dos eventos ya existen.
--
-- Credenciales que van en App Store Connect:
--   usuario:    revisor.comercios@seismas.app
--   contraseña: Comercio2026!
--
-- El hash es bcrypt con coste 10, el mismo que usa Auth::hashPassword() de la
-- API PHP. Está precalculado porque psql no sabe hacer bcrypt y el archivo no
-- puede llevar la contraseña en claro dentro de la base.
--
-- ES IDEMPOTENTE y refresca lo que caduca, igual que el del lado usuarios.
--
-- Cómo correrlo:
--   local:       psql -d seis_mas -f db/cuenta_demo_comercios_app_store.sql
--   producción:  railway ssh --service Postgres \
--                  "psql -U postgres -d railway -v ON_ERROR_STOP=1" \
--                  < db/cuenta_demo_comercios_app_store.sql
-- ============================================================================

BEGIN;

-- --- Credenciales del local -------------------------------------------------
--
-- El correo cambia respecto de la siembra de usuarios (era demo.local@…) para
-- que sea evidente cuál es la cuenta que se le entrega a Apple.

UPDATE comercios SET
  email         = 'revisor.comercios@seismas.app',
  password_hash = '$2y$10$NHy5ks5iw.lWLPBLZDd/.ufsmN0qrmD9xIJH9eg.vYZToVWi/4hZ6',
  activo        = TRUE,
  -- Revive el local si el revisor probó "Dar de baja el local", que es
  -- justamente lo que se espera que pruebe.
  deleted_at    = NULL,
  plan_id       = (SELECT id FROM pa_planes_comercio WHERE nombre = 'gold')
WHERE id = 'ded00000-0000-4000-8000-000000000020';

-- Si el comercio no existe, la siembra de usuarios no se corrió. Vale más
-- fallar acá que dejar una cuenta a medias que el revisor no puede usar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comercios WHERE id = 'ded00000-0000-4000-8000-000000000020') THEN
    RAISE EXCEPTION 'Falta el comercio de demostración. Corré antes db/cuenta_demo_app_store.sql';
  END IF;
END $$;

-- --- Un segundo anfitrión ---------------------------------------------------
--
-- Con uno solo, la pantalla de Anfitriones no muestra para qué sirve la marca
-- de titular. Camila (la que sembró el otro archivo) queda de titular.

INSERT INTO anfitriones (id, comercio_id, nombre, email, telefono, titular)
VALUES ('ded00000-0000-4000-8000-000000000022', 'ded00000-0000-4000-8000-000000000020',
        'Tomás Aristizábal', 'demo.anfitrion2@seismas.app', '+57 310 000 0022', FALSE)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, deleted_at = NULL;

UPDATE anfitriones SET titular = TRUE
 WHERE id = 'ded00000-0000-4000-8000-000000000021';

-- --- La oferta del local ----------------------------------------------------
--
-- `interes_id` es FK al catálogo, no texto libre: sin un interés asociado el
-- matching no le ofrece el plan a ningún grupo, y la app lo rechaza al crearlo.

INSERT INTO comercio_planes (id, comercio_id, interes_id, titulo, descripcion,
                             duracion_min, precio, capacidad, activo)
SELECT v.id, 'ded00000-0000-4000-8000-000000000020', i.id, v.titulo, v.descripcion,
       v.duracion, v.precio, 6, v.activo
  FROM (VALUES
    ('ded00000-0000-4000-8000-000000000040'::uuid, 'Gastronomía', 'Cena larga de tres tiempos',
     'Mesa para seis, menú de tres tiempos y sobremesa sin prisa.', 150, 68000::numeric, TRUE),
    ('ded00000-0000-4000-8000-000000000041'::uuid, 'Música', 'Noche de vinilos',
     'Cena informal con selección de vinilos y una carta corta para compartir.', 120, 52000::numeric, TRUE),
    ('ded00000-0000-4000-8000-000000000042'::uuid, 'Lectura', 'Desayuno de club de lectura',
     'Desayuno largo con mesa reservada. Fuera de temporada: apagado.', 90, 34000::numeric, FALSE)
  ) AS v(id, interes, titulo, descripcion, duracion, precio, activo)
  JOIN pa_intereses i ON i.nombre = v.interes
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo, precio = EXCLUDED.precio,
  activo = EXCLUDED.activo, deleted_at = NULL;

-- --- Disponibilidad ---------------------------------------------------------
--
-- dia_semana sigue la convención de EXTRACT(DOW): 0 = domingo … 6 = sábado.

INSERT INTO comercio_disponibilidad (id, comercio_id, dia_semana, hora_inicio, hora_fin, grupos_max, activo)
VALUES
  ('ded00000-0000-4000-8000-000000000050', 'ded00000-0000-4000-8000-000000000020', 3, '19:00', '22:30', 2, TRUE),
  ('ded00000-0000-4000-8000-000000000051', 'ded00000-0000-4000-8000-000000000020', 4, '19:00', '22:30', 2, TRUE),
  ('ded00000-0000-4000-8000-000000000052', 'ded00000-0000-4000-8000-000000000020', 5, '18:30', '23:00', 3, TRUE),
  ('ded00000-0000-4000-8000-000000000053', 'ded00000-0000-4000-8000-000000000020', 6, '12:30', '16:00', 1, FALSE)
ON CONFLICT (id) DO UPDATE SET
  hora_inicio = EXCLUDED.hora_inicio, hora_fin = EXCLUDED.hora_fin,
  grupos_max  = EXCLUDED.grupos_max,  activo   = EXCLUDED.activo;

-- --- Propuesta de bienvenida ------------------------------------------------
--
-- vigente_hasta se recalcula en cada corrida: con una fecha fija, la propuesta
-- aparecería vencida en la pantalla justo cuando el revisor la abre.

INSERT INTO propuestas_bienvenida (id, comercio_id, titulo, descripcion, incluye,
                                   precio_persona, duracion_min, vigente_desde, vigente_hasta, activa)
VALUES
  ('ded00000-0000-4000-8000-000000000060', 'ded00000-0000-4000-8000-000000000020',
   'Mesa larga de bienvenida',
   'Con lo que el grupo encuentra al llegar, antes de pedir nada.',
   ARRAY['Bebida de bienvenida', 'Tabla para compartir', 'Mesa reservada 30 min antes'],
   18000, 30, current_date - 30, current_date + 90, TRUE)
ON CONFLICT (id) DO UPDATE SET
  titulo         = EXCLUDED.titulo,
  incluye        = EXCLUDED.incluye,
  precio_persona = EXCLUDED.precio_persona,
  vigente_desde  = EXCLUDED.vigente_desde,
  vigente_hasta  = EXCLUDED.vigente_hasta,
  activa         = TRUE,
  deleted_at     = NULL;

-- --- Un menú publicado y uno en borrador ------------------------------------
--
-- Dos estados, porque la pantalla de Menús trata de eso: lo publicado se ve en
-- la app de usuarios y el borrador no.

INSERT INTO menus (id, comercio_id, nombre, descripcion, estado, orden)
VALUES
  ('ded00000-0000-4000-8000-000000000070', 'ded00000-0000-4000-8000-000000000020',
   'Carta de la noche', 'Lo que se sirve de miércoles a sábado.', 'publicado', 1),
  ('ded00000-0000-4000-8000-000000000071', 'ded00000-0000-4000-8000-000000000020',
   'Carta de temporada (en preparación)', 'Todavía en borrador: no se ve en la app.', 'borrador', 2)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre, estado = EXCLUDED.estado, deleted_at = NULL;

INSERT INTO menu_secciones (id, menu_id, nombre, descripcion, orden)
VALUES
  ('ded00000-0000-4000-8000-000000000080', 'ded00000-0000-4000-8000-000000000070', 'Para empezar', 'Para el centro de la mesa.', 1),
  ('ded00000-0000-4000-8000-000000000081', 'ded00000-0000-4000-8000-000000000070', 'Fuertes', NULL, 2),
  ('ded00000-0000-4000-8000-000000000082', 'ded00000-0000-4000-8000-000000000070', 'Postres', NULL, 3)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden;

INSERT INTO menu_items (id, seccion_id, nombre, descripcion, precio, disponible, orden)
VALUES
  ('ded00000-0000-4000-8000-000000000090', 'ded00000-0000-4000-8000-000000000080', 'Tabla de la casa', 'Quesos, encurtidos y pan de masa madre.', 38000, TRUE, 1),
  ('ded00000-0000-4000-8000-000000000091', 'ded00000-0000-4000-8000-000000000080', 'Sopa del día', NULL, 16000, TRUE, 2),
  ('ded00000-0000-4000-8000-000000000092', 'ded00000-0000-4000-8000-000000000081', 'Trucha al carbón', 'Con papas criollas y limón asado.', 42000, TRUE, 1),
  ('ded00000-0000-4000-8000-000000000093', 'ded00000-0000-4000-8000-000000000081', 'Risotto de hongos', NULL, 36000, FALSE, 2),
  ('ded00000-0000-4000-8000-000000000094', 'ded00000-0000-4000-8000-000000000082', 'Postre de la casa', NULL, 14000, TRUE, 1)
ON CONFLICT (id) DO UPDATE SET
  nombre     = EXCLUDED.nombre,
  precio     = EXCLUDED.precio,
  -- El risotto queda agotado a propósito: es el interruptor "se acabó el plato"
  -- del editor de menús, y sin un ítem así no se ve para qué sirve.
  disponible = EXCLUDED.disponible;

COMMIT;

-- --- Verificación -----------------------------------------------------------

SELECT
  (SELECT count(*) FROM comercios
    WHERE id = 'ded00000-0000-4000-8000-000000000020'
      AND password_hash IS NOT NULL AND deleted_at IS NULL AND activo)   AS local_con_acceso,
  (SELECT count(*) FROM anfitriones
    WHERE comercio_id = 'ded00000-0000-4000-8000-000000000020'
      AND deleted_at IS NULL)                                            AS anfitriones,
  (SELECT count(*) FROM comercio_planes
    WHERE comercio_id = 'ded00000-0000-4000-8000-000000000020'
      AND deleted_at IS NULL)                                            AS planes,
  (SELECT count(*) FROM comercio_disponibilidad
    WHERE comercio_id = 'ded00000-0000-4000-8000-000000000020')          AS franjas,
  (SELECT count(*) FROM eventos
    WHERE comercio_id = 'ded00000-0000-4000-8000-000000000020'
      AND grupo_id IS NOT NULL AND deleted_at IS NULL)                   AS eventos_con_grupo,
  (SELECT count(*) FROM menu_items mi
     JOIN menu_secciones ms ON ms.id = mi.seccion_id
    WHERE ms.menu_id = 'ded00000-0000-4000-8000-000000000070')           AS platos;
