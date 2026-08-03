-- ============================================================================
-- Seis Más — Esquema PostgreSQL (MVP Fase 2)
-- Ver db/DISEÑO.md para la justificación completa de cada decisión.
-- Compatible con PostgreSQL 13+.
-- ============================================================================

-- pgcrypto provee gen_random_uuid(); es más liviano que uuid-ossp y ya viene
-- disponible en la mayoría de proveedores gestionados (RDS, Supabase, etc.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Función utilitaria: mantiene updated_at sin depender de que cada UPDATE
-- del backend recuerde setearlo a mano.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USUARIOS
-- ============================================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL,
    -- Solo el hash bcrypt vive aquí. El backend nunca debe recibir ni loguear
    -- la contraseña en texto plano.
    password_hash   TEXT NOT NULL,
    nombre          TEXT NOT NULL,
    fecha_nacimiento DATE,
    genero          TEXT,
    telefono        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- Índice único parcial: permite reutilizar el email si la cuenta original fue
-- borrada lógicamente (deleted_at no nulo), evitando bloquear un email real
-- por una cuenta que ya no existe para el usuario.
CREATE UNIQUE INDEX ux_usuarios_email_activo ON usuarios (email) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuarios_deleted_at ON usuarios (deleted_at);

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TESTS_PERSONALIDAD (historial 1:N, con un registro "vigente" por usuario)
-- ============================================================================
CREATE TABLE tests_personalidad (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    -- jsonb porque el cuestionario/modelo de resultado evolucionará más rápido
    -- que el esquema relacional (ver DISEÑO.md).
    respuestas      JSONB NOT NULL,
    resultado       JSONB,
    version_test    INT NOT NULL DEFAULT 1,
    vigente         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantiza a nivel de motor que solo exista un test vigente por usuario,
-- sin impedir guardar el historial de intentos anteriores.
CREATE UNIQUE INDEX ux_tests_personalidad_vigente
    ON tests_personalidad (usuario_id) WHERE vigente;

CREATE INDEX ix_tests_personalidad_usuario_id ON tests_personalidad (usuario_id);

-- ============================================================================
-- PA_INTERESES (tabla paramétrica: catálogo de intereses editable sin
-- desplegar app ni backend — agregar un interés nuevo es un INSERT acá) +
-- USUARIO_INTERESES (N:M)
-- ============================================================================
CREATE TABLE pa_intereses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT NOT NULL UNIQUE,
    -- Emoji mostrado en los chips/dropdown del mobile (ver
    -- mobile/src/screens/RegistroScreen.js). Al ser dato y no código, un
    -- interés nuevo con su ícono se agrega con un INSERT, sin recompilar.
    icono       TEXT NOT NULL DEFAULT '✨',
    categoria   TEXT,
    orden       INT NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catálogo inicial (los mismos 6 intereses que ya usaba el mobile a mano).
INSERT INTO pa_intereses (nombre, icono, orden) VALUES
    ('Música',       '🎵', 1),
    ('Deporte',       '🏋️', 2),
    ('Gastronomía',   '🍽️', 3),
    ('Lectura',       '📚', 4),
    ('Bienestar',     '🧘', 5),
    ('Tecnología',    '💻', 6);

CREATE TABLE usuario_intereses (
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    interes_id  UUID NOT NULL REFERENCES pa_intereses(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, interes_id)
);

CREATE INDEX ix_usuario_intereses_interes_id ON usuario_intereses (interes_id);

-- ============================================================================
-- PA_GENEROS (tabla paramétrica: catálogo de géneros editable sin desplegar
-- app ni backend). usuarios.genero sigue siendo TEXT libre (no FK) — guarda
-- el `nombre` elegido acá, así no hay que migrar datos existentes si el
-- catálogo cambia.
-- ============================================================================
CREATE TABLE pa_generos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT NOT NULL UNIQUE,
    -- Emoji mostrado en el dropdown del mobile (ver
    -- mobile/src/screens/RegistroScreen.js). Un género nuevo con su ícono se
    -- agrega con un INSERT, sin recompilar.
    icono       TEXT NOT NULL DEFAULT '👤',
    orden       INT NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catálogo inicial (los mismos 3 géneros que ya usaba el mobile a mano).
INSERT INTO pa_generos (nombre, icono, orden) VALUES
    ('Femenino',  '👩', 1),
    ('Masculino', '👨', 2),
    ('Otro',      '🌈', 3);

-- ============================================================================
-- GRUPOS + GRUPO_MIEMBROS (N:M, tamaño máximo 6 forzado por trigger)
-- ============================================================================
CREATE TABLE grupos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT,
    estado      TEXT NOT NULL DEFAULT 'formando'
        CHECK (estado IN ('formando', 'completo', 'activo', 'finalizado', 'cancelado')),
    tamano_max  INT NOT NULL DEFAULT 6 CHECK (tamano_max = 6),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER trg_grupos_updated_at
    BEFORE UPDATE ON grupos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE grupo_miembros (
    grupo_id    UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol         TEXT NOT NULL DEFAULT 'miembro' CHECK (rol IN ('miembro', 'creador')),
    fecha_union TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (grupo_id, usuario_id)
);

CREATE INDEX ix_grupo_miembros_usuario_id ON grupo_miembros (usuario_id);

-- Un CHECK normal no puede contar filas de otra tabla; se necesita un trigger
-- para impedir que un grupo supere los 6 miembros definidos por el negocio.
CREATE OR REPLACE FUNCTION enforce_grupo_max_6()
RETURNS TRIGGER AS $$
DECLARE
    total INT;
BEGIN
    SELECT count(*) INTO total FROM grupo_miembros WHERE grupo_id = NEW.grupo_id;
    IF total >= 6 THEN
        RAISE EXCEPTION 'El grupo % ya tiene el máximo de 6 miembros', NEW.grupo_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_grupo_miembros_max_6
    BEFORE INSERT ON grupo_miembros
    FOR EACH ROW EXECUTE FUNCTION enforce_grupo_max_6();

-- ============================================================================
-- GRUPO_INTERESES (agregación de intereses del grupo, soporte para matching)
-- ============================================================================
CREATE TABLE grupo_intereses (
    grupo_id    UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    interes_id  UUID NOT NULL REFERENCES pa_intereses(id) ON DELETE CASCADE,
    -- peso = cuántos miembros del grupo comparten este interés; útil para el
    -- futuro algoritmo de matching sin recalcular sobre usuario_intereses.
    peso        INT NOT NULL DEFAULT 1 CHECK (peso >= 1),
    PRIMARY KEY (grupo_id, interes_id)
);

-- ============================================================================
-- COMERCIOS
-- ============================================================================
CREATE TABLE comercios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT NOT NULL,
    nit         TEXT,
    direccion   TEXT,
    ciudad      TEXT,
    categoria   TEXT,
    telefono    TEXT,
    email       TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX ix_comercios_ciudad ON comercios (ciudad);
CREATE TRIGGER trg_comercios_updated_at
    BEFORE UPDATE ON comercios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- ANFITRIONES (personal del comercio que gestiona eventos)
-- ============================================================================
CREATE TABLE anfitriones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    email       TEXT NOT NULL,
    telefono    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX ux_anfitriones_email_activo ON anfitriones (email) WHERE deleted_at IS NULL;
CREATE INDEX ix_anfitriones_comercio_id ON anfitriones (comercio_id);
CREATE TRIGGER trg_anfitriones_updated_at
    BEFORE UPDATE ON anfitriones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- EVENTOS
-- ============================================================================
CREATE TABLE eventos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id  UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
    anfitrion_id UUID NOT NULL REFERENCES anfitriones(id) ON DELETE RESTRICT,
    -- Nullable a propósito: un evento puede publicarse antes de tener grupo
    -- asignado; el matching lo enlaza después (ver DISEÑO.md).
    grupo_id     UUID REFERENCES grupos(id) ON DELETE SET NULL,
    titulo       TEXT NOT NULL,
    descripcion  TEXT,
    categoria    TEXT,
    fecha_hora   TIMESTAMPTZ NOT NULL,
    capacidad    INT NOT NULL DEFAULT 6 CHECK (capacidad > 0),
    precio       NUMERIC(10, 2) DEFAULT 0 CHECK (precio >= 0),
    estado       TEXT NOT NULL DEFAULT 'propuesto'
        CHECK (estado IN ('propuesto', 'confirmado', 'en_curso', 'finalizado', 'cancelado')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX ix_eventos_comercio_id ON eventos (comercio_id);
CREATE INDEX ix_eventos_anfitrion_id ON eventos (anfitrion_id);
CREATE INDEX ix_eventos_grupo_id ON eventos (grupo_id);
CREATE INDEX ix_eventos_fecha_hora ON eventos (fecha_hora);
CREATE TRIGGER trg_eventos_updated_at
    BEFORE UPDATE ON eventos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- FEEDBACK (sin soft-delete: es registro de auditoría/reputación)
-- ============================================================================
CREATE TABLE feedback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id   UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comentario  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (evento_id, usuario_id)
);

CREATE INDEX ix_feedback_evento_id ON feedback (evento_id);
CREATE INDEX ix_feedback_usuario_id ON feedback (usuario_id);
