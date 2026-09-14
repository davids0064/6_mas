-- ============================================================================
-- 003 — Lo que una persona puede saber del local ANTES de ir.
--
-- Por qué existe: la app de usuarios recibía del plan solo el título, la fecha,
-- la dirección y el precio. Todo lo que hace que un sitio parezca un sitio —su
-- carta, qué se encuentra el grupo al llegar, a qué hora abre— ya estaba en la
-- base, publicado por el propio comercio, y no había forma de que llegara al
-- usuario: `seis_app` tiene REVOKE ALL sobre `menus`, `menu_secciones`,
-- `menu_items` y `propuestas_bienvenida` (migración 001).
--
-- Ese REVOKE no se toca. La frontera se cruza como se cruzó antes: con vistas
-- que exponen exactamente lo publicado y nada más. Un GRANT sobre las tablas
-- dejaría a la API social leer menús en borrador y propuestas dadas de baja,
-- que son datos internos del negocio.
--
-- Qué NO sale por acá, aunque viva en esas tablas: nada del comercio como
-- empresa (NIT, correo, credenciales) — para eso ya está v_comercio_publico— y
-- nada que el comercio no haya publicado a propósito.
-- ============================================================================

BEGIN;

-- --- La carta -----------------------------------------------------------
--
-- Plana (una fila por plato) y no anidada: Postgres no devuelve árboles y
-- armar el JSON en la vista obligaría a rehacerla cada vez que la app quiera
-- un campo más. El anidado lo hace la API, que es quien conoce la forma que
-- necesita la pantalla.
--
-- Tres filtros, y los tres importan:
--   * `m.estado = 'publicado'` — un borrador es trabajo a medias del comercio.
--   * `mi.disponible` — el plato que se acabó esta noche no se le enseña a
--     alguien que va mañana a pedirlo.
--   * el comercio, activo y no borrado, vía v_comercio_publico.
CREATE OR REPLACE VIEW v_menu_publico AS
SELECT
    c.id            AS comercio_id,
    m.id            AS menu_id,
    m.nombre        AS menu_nombre,
    m.descripcion   AS menu_descripcion,
    m.orden         AS menu_orden,
    ms.id           AS seccion_id,
    ms.nombre       AS seccion_nombre,
    ms.descripcion  AS seccion_descripcion,
    ms.orden        AS seccion_orden,
    mi.id           AS item_id,
    mi.nombre       AS item_nombre,
    mi.descripcion  AS item_descripcion,
    mi.precio       AS item_precio,
    mi.orden        AS item_orden
FROM menus m
JOIN v_comercio_publico c   ON c.id = m.comercio_id
LEFT JOIN menu_secciones ms ON ms.menu_id = m.id
LEFT JOIN menu_items mi     ON mi.seccion_id = ms.id AND mi.disponible
WHERE m.estado = 'publicado'
  AND m.deleted_at IS NULL;

-- --- Qué se encuentran al llegar ----------------------------------------
--
-- La vigencia se resuelve acá y no en la API: son fechas que el comercio
-- carga para no tener que acordarse de apagar una propuesta de temporada, y
-- que cada consumidor las interprete por su cuenta es pedir que alguna vez se
-- interpreten distinto.
CREATE OR REPLACE VIEW v_propuesta_publica AS
SELECT
    c.id              AS comercio_id,
    p.id,
    p.titulo,
    p.descripcion,
    p.incluye,
    p.precio_persona,
    p.duracion_min
FROM propuestas_bienvenida p
JOIN v_comercio_publico c ON c.id = p.comercio_id
WHERE p.activa
  AND p.deleted_at IS NULL
  AND (p.vigente_desde IS NULL OR p.vigente_desde <= current_date)
  AND (p.vigente_hasta IS NULL OR p.vigente_hasta >= current_date);

-- --- Permisos -----------------------------------------------------------
--
-- Solo lectura, y solo sobre las vistas. Las tablas siguen con el REVOKE de la
-- 001: se repite acá para que quede junto a lo que sí se concede.
GRANT SELECT ON v_menu_publico, v_propuesta_publica TO seis_app;

REVOKE ALL ON menus, menu_secciones, menu_items, propuestas_bienvenida
FROM seis_app;

-- El lado comercio no gana nada con estas vistas: son su propio dato, que ya
-- lee de las tablas con permisos completos.
REVOKE ALL ON v_menu_publico, v_propuesta_publica FROM seis_dashboard;

COMMIT;
