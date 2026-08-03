-- ============================================================================
-- Seis Más — Migración 002: matching automático y oferta programable
--
-- Aditiva sobre schema.sql + migración 001. Agrega lo que el matching
-- automático necesita y que no existía:
--   1. pa_planes_comercio: los tiers comerciales (bronce → premium).
--      Son de los RESTAURANTES, no de los usuarios: no segmentan con quién se
--      agrupa la gente, solo desempatan qué comercio recibe al grupo.
--   2. comercio_planes: el catálogo de experiencias que un comercio ofrece
--      ("Cena a ciegas", "Cata de café"), cada una atada a un interés del
--      catálogo. Es la plantilla; el evento con fecha lo genera el matching.
--   3. comercio_disponibilidad: franjas horarias recurrentes por día de la
--      semana, con cupo de grupos. Reemplaza al TEXT informativo
--      `comercios.horario` como fuente de verdad operativa (el TEXT queda,
--      sigue siendo lo que se le muestra al usuario).
--   4. Dos vistas de frontera para que la API social lea la oferta sin tener
--      permiso sobre las tablas del contexto comercio.
--
-- Idempotente: se puede correr varias veces.
--   psql -d seis_mas -f db/migrations/002_matching_automatico.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PA_PLANES_COMERCIO — tiers comerciales
--
-- Tabla paramétrica, como pa_intereses y pa_generos: cambiar el nombre de un
-- tier o agregar uno nuevo es un INSERT, no un despliegue.
--
-- `nivel` es lo único que el algoritmo mira: a mayor nivel, gana el desempate.
-- Se deja como INT con huecos (10, 20, 30, 40) para poder intercalar un tier
-- intermedio a futuro sin renumerar los existentes ni migrar datos.
--
-- Lo que un tier NO hace, deliberadamente: no le gana nunca a la afinidad.
-- Un comercio premium cuya oferta no le interesa al grupo no recibe al grupo.
-- Lo que compra el plan es ganar cuando compite de igual a igual, no comprar
-- audiencia desinteresada — si los grupos salen a planes que no les gustan,
-- se cae el lado del producto que sostiene todo el negocio.
-- ============================================================================
CREATE TABLE IF NOT EXISTS pa_planes_comercio (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT NOT NULL UNIQUE,
    nivel       INT  NOT NULL UNIQUE CHECK (nivel > 0),
    descripcion TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estructura propuesta. Los beneficios descritos acá son los que el algoritmo
-- implementa hoy (prioridad de desempate); precio y condiciones comerciales
-- se cargan con un UPDATE cuando estén definidos.
INSERT INTO pa_planes_comercio (nombre, nivel, descripcion) VALUES
    ('bronce',  10, 'Plan base. Recibe grupos cuando no compite con un tier superior por la misma afinidad.'),
    ('plata',   20, 'Prioridad sobre bronce al desempatar entre ofertas igual de afines.'),
    ('gold',    30, 'Prioridad sobre plata y bronce al desempatar.'),
    ('premium', 40, 'Máxima prioridad de desempate entre ofertas igual de afines al grupo.')
ON CONFLICT (nombre) DO NOTHING;

-- Todo comercio tiene un plan; los que ya existían entran como bronce.
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES pa_planes_comercio(id);
UPDATE comercios
   SET plan_id = (SELECT id FROM pa_planes_comercio WHERE nombre = 'bronce')
 WHERE plan_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_comercios_plan_id ON comercios (plan_id);

-- ============================================================================
-- 2. COMERCIO_PLANES — el catálogo de experiencias que ofrece el comercio
--
-- `interes_id` es FK al catálogo, no texto libre. Es el cambio importante:
-- hoy el matching tiene que adivinar a qué interés corresponde la categoría
-- de un evento con un diccionario de sinónimos en código
-- (SINONIMOS_CATEGORIA en backend/src/services/matching.js), que se pudre en
-- cuanto entran comercios con categorías nuevas. Acá el comercio elige del
-- mismo catálogo que el usuario, y el emparejamiento es un JOIN exacto.
-- ============================================================================
CREATE TABLE IF NOT EXISTS comercio_planes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id  UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
    interes_id   UUID NOT NULL REFERENCES pa_intereses(id) ON DELETE RESTRICT,
    titulo       TEXT NOT NULL,
    descripcion  TEXT,
    -- Cuánto dura la experiencia. El matching la usa para verificar que quepa
    -- entera dentro de la franja horaria, no solo que empiece dentro.
    duracion_min INT NOT NULL DEFAULT 120 CHECK (duracion_min > 0),
    precio       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    -- Un grupo son 6 personas: un plan que no recibe 6 no es candidato.
    capacidad    INT NOT NULL DEFAULT 6 CHECK (capacidad >= 6),
    activo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_comercio_planes_comercio ON comercio_planes (comercio_id);
CREATE INDEX IF NOT EXISTS ix_comercio_planes_interes  ON comercio_planes (interes_id);

-- ============================================================================
-- 3. COMERCIO_DISPONIBILIDAD — franjas recurrentes con cupo
--
-- Recurrente por día de la semana en vez de fechas concretas: un restaurante
-- no publica "el 15 de agosto", declara "jueves a sábado de 19 a 22, me caben
-- 2 grupos por noche". El algoritmo materializa la fecha concreta cuando hay
-- un grupo que ubicar.
--
-- `dia_semana` usa la convención de EXTRACT(DOW): 0 = domingo … 6 = sábado.
-- No se inventa una numeración propia para poder comparar directo contra
-- fechas en SQL sin traducir.
--
-- No hay tabla de reservas: la ocupación de una franja se cuenta sobre
-- `eventos` (los eventos ya asignados a esa franja ese día). Una tabla aparte
-- sería un segundo lugar donde la verdad puede desincronizarse.
-- ============================================================================
CREATE TABLE IF NOT EXISTS comercio_disponibilidad (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
    dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    -- Cuántos grupos distintos puede recibir el comercio en esa franja.
    grupos_max  INT NOT NULL DEFAULT 1 CHECK (grupos_max > 0),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (hora_fin > hora_inicio),
    UNIQUE (comercio_id, dia_semana, hora_inicio)
);

CREATE INDEX IF NOT EXISTS ix_comercio_disponibilidad_comercio
    ON comercio_disponibilidad (comercio_id);

DROP TRIGGER IF EXISTS trg_comercio_planes_updated_at ON comercio_planes;
CREATE TRIGGER trg_comercio_planes_updated_at
    BEFORE UPDATE ON comercio_planes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_comercio_disponibilidad_updated_at ON comercio_disponibilidad;
CREATE TRIGGER trg_comercio_disponibilidad_updated_at
    BEFORE UPDATE ON comercio_disponibilidad
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. Trazabilidad: de dónde salió un evento
--
-- Un evento puede venir de dos caminos: publicado a mano por el comercio
-- desde el dashboard, o generado por el matching a partir de un plan + una
-- franja. Guardar cuál permite medir qué camino funciona mejor y, sobre todo,
-- no pisar con el matching un evento que una persona creó a mano.
-- ============================================================================
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'comercio'
    CHECK (origen IN ('comercio', 'matching'));
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS comercio_plan_id UUID
    REFERENCES comercio_planes(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. LA FRONTERA — la oferta vista desde el mundo social
--
-- Mismo criterio que v_comercio_publico en la migración 001: la API social
-- (rol seis_app) no tiene ni debe tener permiso sobre `comercios`,
-- `comercio_planes` ni `comercio_disponibilidad`. Lee la oferta por estas dos
-- vistas, que exponen solo lo que el matching necesita para decidir — nunca
-- credenciales, NIT ni email del comercio.
-- ============================================================================
CREATE OR REPLACE VIEW v_oferta_comercio AS
SELECT
    cp.id               AS plan_id,
    cp.comercio_id,
    c.nombre            AS comercio_nombre,
    c.ciudad,
    p.nombre            AS tier,
    p.nivel             AS nivel_tier,
    cp.interes_id,
    i.nombre            AS interes,
    cp.titulo,
    cp.descripcion,
    cp.duracion_min,
    cp.precio,
    cp.capacidad
FROM comercio_planes cp
JOIN comercios c        ON c.id = cp.comercio_id
JOIN pa_intereses i     ON i.id = cp.interes_id
LEFT JOIN pa_planes_comercio p ON p.id = c.plan_id
WHERE cp.activo
  AND cp.deleted_at IS NULL
  AND c.activo
  AND c.deleted_at IS NULL;

-- Eventos que el comercio publicó a mano con fecha fija (el camino que ya
-- existía en el dashboard) y que todavía no tienen grupo. El matching los
-- sigue considerando junto a los planes programables, y necesita el mismo
-- `nivel_tier` para que un premium que publica a mano no pierda su prioridad.
-- El tier va acá y no en v_comercio_publico a propósito: v_comercio_publico
-- es lo que ve el USUARIO en la app, y qué plan comercial paga un restaurante
-- no es asunto suyo.
CREATE OR REPLACE VIEW v_evento_disponible AS
SELECT
    e.id,
    e.comercio_id,
    e.anfitrion_id,
    e.titulo,
    e.categoria,
    e.fecha_hora,
    e.capacidad,
    e.precio,
    c.nombre  AS comercio_nombre,
    c.ciudad,
    c.categoria AS comercio_categoria,
    COALESCE(p.nivel, 0) AS nivel_tier
FROM eventos e
JOIN comercios c ON c.id = e.comercio_id
LEFT JOIN pa_planes_comercio p ON p.id = c.plan_id
WHERE e.deleted_at IS NULL
  AND e.grupo_id IS NULL
  AND e.estado = 'propuesto'
  AND c.activo
  AND c.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_disponibilidad_comercio AS
SELECT
    d.comercio_id,
    d.dia_semana,
    d.hora_inicio,
    d.hora_fin,
    d.grupos_max
FROM comercio_disponibilidad d
JOIN comercios c ON c.id = d.comercio_id
WHERE d.activo AND c.activo AND c.deleted_at IS NULL;

COMMIT;

-- ============================================================================
-- 6. ROLES — permisos sobre lo nuevo
-- ============================================================================

-- El comercio administra su propia oferta desde el dashboard.
GRANT SELECT, INSERT, UPDATE, DELETE ON comercio_planes, comercio_disponibilidad
    TO seis_dashboard;
GRANT SELECT ON pa_planes_comercio TO seis_dashboard;

-- La app social solo LEE la oferta, y solo por las vistas. Sigue sin tener
-- ningún permiso sobre comercios/comercio_planes/comercio_disponibilidad.
GRANT SELECT ON v_oferta_comercio, v_disponibilidad_comercio, v_evento_disponible,
    pa_planes_comercio TO seis_app;
REVOKE ALL ON comercio_planes, comercio_disponibilidad FROM seis_app;
