-- ============================================================================
-- Seis Más — Migración 001: Dashboard de comercios
--
-- Aditiva sobre db/schema.sql. Agrega lo que el dashboard web necesita y que
-- el MVP móvil no contemplaba:
--   1. Credenciales propias para que un comercio pueda autenticarse.
--   2. Menús (menú → secciones → ítems).
--   3. Propuestas de bienvenida (la experiencia que el comercio ofrece al
--      grupo que llega).
--   4. Perfil del anfitrión (la persona que recibe a los grupos).
--   5. La FRONTERA entre el mundo comercio y el mundo social: dos vistas y
--      dos roles de base de datos.
--
-- Idempotente: se puede correr varias veces sin romper nada.
--   psql -d seis_mas -f db/migrations/001_dashboard_comercios.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. COMERCIOS — credenciales y perfil público
-- ============================================================================

-- password_hash es NULLABLE a propósito: los comercios que ya existan (dados
-- de alta por el backend Node, que no pide contraseña) siguen siendo válidos
-- como registro de negocio aunque todavía no puedan entrar al dashboard. El
-- login rechaza explícitamente los que lo tengan en NULL.
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS descripcion    TEXT;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS logo_url       TEXT;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS sitio_web      TEXT;
-- Texto libre ("Lun–Vie 12:00–22:00") en vez de una estructura rígida: el
-- horario es informativo para el usuario, no se opera con él. Cuando haya que
-- calcular disponibilidad real, será una tabla aparte.
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS horario        TEXT;

-- El email es la credencial de acceso, así que ahora sí necesita ser único.
-- Parcial sobre deleted_at IS NULL por el mismo motivo que en usuarios: un
-- comercio dado de baja no debe bloquear su email para siempre. LOWER() para
-- que el login sea insensible a mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_comercios_email_activo
    ON comercios (LOWER(email)) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. ANFITRIONES — perfil de la persona que recibe a los grupos
-- ============================================================================

ALTER TABLE anfitriones ADD COLUMN IF NOT EXISTS bio      TEXT;
ALTER TABLE anfitriones ADD COLUMN IF NOT EXISTS foto_url TEXT;
-- Un comercio puede tener varios anfitriones, pero solo uno es la cara
-- visible que se le muestra al grupo en la app.
ALTER TABLE anfitriones ADD COLUMN IF NOT EXISTS titular  BOOLEAN NOT NULL DEFAULT FALSE;

-- Mismo patrón que tests_personalidad.vigente: el motor garantiza que haya
-- como máximo un titular por comercio, sin impedir tener varios anfitriones.
CREATE UNIQUE INDEX IF NOT EXISTS ux_anfitriones_titular_por_comercio
    ON anfitriones (comercio_id) WHERE titular AND deleted_at IS NULL;

-- ============================================================================
-- 3. MENÚS — menú → secciones → ítems
-- ============================================================================

CREATE TABLE IF NOT EXISTS menus (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    -- 'borrador' permite armar un menú a lo largo de varias sesiones sin que
    -- se vea en la app; solo 'publicado' es visible para los usuarios.
    estado      TEXT NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'publicado', 'archivado')),
    orden       INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_menus_comercio_id ON menus (comercio_id);

CREATE TABLE IF NOT EXISTS menu_secciones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id     UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    -- El orden lo decide el comercio (Entradas antes que Postres); no hay un
    -- criterio alfabético ni cronológico que sirva.
    orden       INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_menu_secciones_menu_id ON menu_secciones (menu_id);

CREATE TABLE IF NOT EXISTS menu_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id  UUID NOT NULL REFERENCES menu_secciones(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    -- NUMERIC y no float: precios en pesos, sin errores de redondeo binario.
    precio      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    -- 'disponible' es el interruptor del día a día (se acabó el plato) y no
    -- debe obligar a borrar el ítem ni a perder su historial.
    disponible  BOOLEAN NOT NULL DEFAULT TRUE,
    imagen_url  TEXT,
    orden       INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_menu_items_seccion_id ON menu_items (seccion_id);

-- ============================================================================
-- 4. PROPUESTAS DE BIENVENIDA
-- La experiencia con la que el comercio recibe a un grupo de 6.
-- ============================================================================

CREATE TABLE IF NOT EXISTS propuestas_bienvenida (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id    UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
    titulo         TEXT NOT NULL,
    descripcion    TEXT,
    -- Lista de lo que incluye ("Bebida de bienvenida", "Tabla para compartir").
    -- TEXT[] y no una tabla hija: son etiquetas cortas que solo se muestran en
    -- bloque, nunca se consultan ni se agregan por separado.
    incluye        TEXT[] NOT NULL DEFAULT '{}',
    precio_persona NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_persona >= 0),
    duracion_min   INT CHECK (duracion_min IS NULL OR duracion_min > 0),
    -- Vigencia opcional: permite propuestas de temporada sin tener que
    -- acordarse de desactivarlas a mano.
    vigente_desde  DATE,
    vigente_hasta  DATE,
    activa         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ,
    CONSTRAINT ck_propuestas_vigencia
        CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE INDEX IF NOT EXISTS ix_propuestas_comercio_id ON propuestas_bienvenida (comercio_id);

-- ============================================================================
-- 5. Triggers updated_at (reutilizan set_updated_at() de schema.sql)
-- DROP + CREATE porque PostgreSQL no tiene CREATE TRIGGER IF NOT EXISTS.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_menus_updated_at ON menus;
CREATE TRIGGER trg_menus_updated_at
    BEFORE UPDATE ON menus
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_secciones_updated_at ON menu_secciones;
CREATE TRIGGER trg_menu_secciones_updated_at
    BEFORE UPDATE ON menu_secciones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON menu_items;
CREATE TRIGGER trg_menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_propuestas_updated_at ON propuestas_bienvenida;
CREATE TRIGGER trg_propuestas_updated_at
    BEFORE UPDATE ON propuestas_bienvenida
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 6. LA FRONTERA — vistas de contrato entre los dos contextos
--
-- El dashboard y la app son dos mundos con datos sensibles distintos. Estas
-- dos vistas son lo ÚNICO que cada lado ve del otro, y al ser vistas normales
-- (security_invoker por defecto en OFF) se ejecutan con los permisos de su
-- dueño: el rol del dashboard puede leerlas sin tener ningún permiso sobre la
-- tabla `usuarios`. La restricción vive en el motor, no en la disciplina del
-- código de aplicación.
-- ============================================================================

-- Lo único que un comercio puede saber de las personas que va a recibir:
-- nombre de pila e intereses. Nunca email, teléfono, fecha de nacimiento ni
-- el resultado del test de personalidad.
CREATE OR REPLACE VIEW v_evento_asistentes AS
SELECT
    e.id                            AS evento_id,
    e.comercio_id,
    gm.usuario_id,
    split_part(u.nombre, ' ', 1)    AS nombre_pila,
    COALESCE(
        array_agg(i.nombre ORDER BY i.nombre) FILTER (WHERE i.nombre IS NOT NULL),
        '{}'
    )                               AS intereses
FROM eventos e
JOIN grupo_miembros gm      ON gm.grupo_id = e.grupo_id
JOIN usuarios u             ON u.id = gm.usuario_id AND u.deleted_at IS NULL
LEFT JOIN usuario_intereses ui ON ui.usuario_id = u.id
LEFT JOIN pa_intereses i    ON i.id = ui.interes_id AND i.activo
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.comercio_id, gm.usuario_id, u.nombre;

-- Lo único que la app le muestra al usuario de un comercio: dónde es y cómo
-- se ve. Nunca NIT, credenciales, email de contacto ni menús en borrador.
CREATE OR REPLACE VIEW v_comercio_publico AS
SELECT
    c.id,
    c.nombre,
    c.descripcion,
    c.direccion,
    c.ciudad,
    c.categoria,
    c.logo_url,
    c.sitio_web,
    c.horario
FROM comercios c
WHERE c.deleted_at IS NULL AND c.activo;

COMMIT;

-- ============================================================================
-- 7. ROLES — el aislamiento real
--
-- Fuera de la transacción: CREATE ROLE con contraseña no debe quedar dentro
-- de un bloque que se pueda reintentar.
--
-- Las contraseñas de abajo son SOLO PARA DESARROLLO LOCAL. En Railway se
-- crean con contraseñas generadas y se guardan en las variables de entorno
-- del servicio, nunca en el repositorio.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'seis_dashboard') THEN
        CREATE ROLE seis_dashboard LOGIN PASSWORD 'dashboard_local_dev';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'seis_app') THEN
        CREATE ROLE seis_app LOGIN PASSWORD 'app_local_dev';
    END IF;
END
$$;

-- --- Rol del dashboard (API PHP) ---------------------------------------------
-- Dueño de su contexto: comercios, anfitriones, menús y propuestas.
GRANT USAGE ON SCHEMA public TO seis_dashboard;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    comercios, anfitriones, menus, menu_secciones, menu_items,
    propuestas_bienvenida, eventos
TO seis_dashboard;

-- Catálogos: solo lectura.
GRANT SELECT ON pa_intereses, pa_generos TO seis_dashboard;

-- La frontera: ve a los asistentes de sus eventos ÚNICAMENTE por la vista.
GRANT SELECT ON v_evento_asistentes TO seis_dashboard;

-- Y explícitamente NADA sobre los datos personales. Estos REVOKE son
-- redundantes (los permisos no se otorgaron nunca), pero dejan la intención
-- escrita: si alguien agrega un GRANT amplio en el futuro, esta línea es la
-- que le va a hacer ruido en la revisión.
REVOKE ALL ON usuarios, tests_personalidad, usuario_intereses,
              grupos, grupo_miembros, grupo_intereses, feedback
FROM seis_dashboard;

-- --- Rol de la app (API Node) ------------------------------------------------
-- Dueño del contexto social.
GRANT USAGE ON SCHEMA public TO seis_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    usuarios, tests_personalidad, usuario_intereses,
    grupos, grupo_miembros, grupo_intereses, feedback, eventos
TO seis_app;

GRANT SELECT ON pa_intereses, pa_generos TO seis_app;

-- La frontera del otro lado: ve los comercios solo por la vista pública,
-- sin credenciales ni datos fiscales.
GRANT SELECT ON v_comercio_publico, anfitriones TO seis_app;

-- La app nunca escribe sobre el contexto comercio ni lee sus credenciales.
REVOKE ALL ON comercios, menus, menu_secciones, menu_items,
              propuestas_bienvenida
FROM seis_app;
