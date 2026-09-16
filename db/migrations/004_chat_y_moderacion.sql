-- ============================================================================
-- 004 — Que la gente del grupo pueda hablar, decir si va, y protegerse.
--
-- Por qué: la app dejaba leer (tu perfil, tu grupo, la carta del local) y no
-- dejaba HACER nada. Seis desconocidos quedan a cenar y no tenían forma de
-- decir "llego diez minutos tarde" ni "no voy a poder ir". Todo el valor
-- ocurría fuera de la app. Es un agujero de producto antes que un problema de
-- revisión.
--
-- Abrir un chat trae obligaciones que NO son opcionales (guideline 1.2 de la
-- App Store, contenido generado por usuarios): filtrar contenido objetable,
-- poder reportar, poder bloquear, y actuar sobre los reportes. Las tres tablas
-- de abajo existen por eso, y se crean en la MISMA migración que el chat a
-- propósito: un chat sin ellas es un rechazo distinto, no un avance.
-- ============================================================================

BEGIN;

-- --- Mensajes ---------------------------------------------------------------
--
-- Atados al grupo, no al evento: la conversación empieza cuando se forma el
-- grupo y sigue viva mientras el grupo lo esté, que puede abarcar más de un
-- plan.
--
-- `deleted_at` en vez de DELETE: un mensaje retirado por moderación tiene que
-- poder revisarse después, y borrarlo de verdad dejaría el reporte apuntando
-- a nada.
CREATE TABLE IF NOT EXISTS mensajes_grupo (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id    UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto       TEXT NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 1000),
    -- Lo marca el filtro automático al publicarse. El mensaje se guarda igual
    -- (hace falta para revisar el reporte) pero no se entrega a nadie más.
    oculto      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_mensajes_grupo_grupo
    ON mensajes_grupo (grupo_id, created_at DESC);

-- --- Asistencia -------------------------------------------------------------
--
-- Va en grupo_miembros y no en una tabla aparte: es un atributo de la
-- pertenencia, y separarlo obligaría a un LEFT JOIN para responder la pregunta
-- más frecuente de la pantalla ("¿quién viene?").
--
-- 'pendiente' es el valor de partida y significa exactamente eso: todavía no
-- ha dicho nada. No es lo mismo que "no viene", y confundirlos haría que un
-- grupo recién formado apareciera como si nadie fuera a ir.
ALTER TABLE grupo_miembros
    ADD COLUMN IF NOT EXISTS asistencia TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (asistencia IN ('pendiente', 'confirmada', 'declinada'));

ALTER TABLE grupo_miembros
    ADD COLUMN IF NOT EXISTS asistencia_actualizada TIMESTAMPTZ;

-- --- Bloqueos ---------------------------------------------------------------
--
-- Apple exige poder bloquear a otro usuario. Acá tiene una consecuencia
-- concreta además de esconder mensajes: el matching no debe volver a sentar a
-- dos personas en la misma mesa si una bloqueó a la otra. Un bloqueo que solo
-- silencia el chat y luego te sienta enfrente no sirve de nada.
CREATE TABLE IF NOT EXISTS bloqueos (
    usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    bloqueado_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, bloqueado_id),
    CHECK (usuario_id <> bloqueado_id)
);

CREATE INDEX IF NOT EXISTS ix_bloqueos_bloqueado ON bloqueos (bloqueado_id);

-- --- Reportes ---------------------------------------------------------------
--
-- Un reporte puede ser sobre un mensaje o sobre una persona (por lo que pasó
-- en la mesa, que es donde de verdad puede ir mal). Por eso las dos
-- referencias son opcionales y el CHECK exige al menos una: un reporte que no
-- apunta a nada no se puede atender.
CREATE TABLE IF NOT EXISTS reportes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reportante_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mensaje_id    UUID REFERENCES mensajes_grupo(id) ON DELETE SET NULL,
    reportado_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo        TEXT NOT NULL,
    detalle       TEXT,
    -- Apple pide actuar sobre los reportes en 24 horas. El estado es lo que
    -- permite saber cuáles quedan sin mirar.
    estado        TEXT NOT NULL DEFAULT 'abierto'
        CHECK (estado IN ('abierto', 'revisado', 'descartado')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelto_at   TIMESTAMPTZ,
    CHECK (mensaje_id IS NOT NULL OR reportado_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_reportes_abiertos
    ON reportes (created_at) WHERE estado = 'abierto';

-- --- Permisos ---------------------------------------------------------------
--
-- Todo esto es contexto social: lo escribe y lo lee la API de Node.
GRANT SELECT, INSERT, UPDATE, DELETE ON
    mensajes_grupo, bloqueos, reportes
TO seis_app;

-- El lado comercio no tiene nada que hacer acá. Un restaurante no lee la
-- conversación de las seis personas que va a recibir.
REVOKE ALL ON mensajes_grupo, bloqueos, reportes FROM seis_dashboard;

COMMIT;
