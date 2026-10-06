-- ============================================================================
-- 008 — La afiliación de los comercios: cupo mensual y suscripción.
--
-- Hasta ahora el tier de un comercio (bronce/plata/gold/premium) solo hacía una
-- cosa: desempatar cuando dos ofertas eran igual de afines a un grupo. Era una
-- etiqueta en `comercios.plan_id`, sin vigencia y sin nada que pagar.
--
-- El modelo de negocio necesita que haga dos cosas más: dar un CUPO de grupos
-- al mes, y caducar si no se paga.
--
-- DECISIONES, porque ninguna es obvia y todas se notan al cobrar:
--
--   * El cupo se consume por la FECHA DE LA CENA, no por cuándo el sistema la
--     asignó. "En noviembre recibes 2 grupos" significa dos cenas servidas en
--     noviembre; si contara la asignación, un comercio podría agotar su mes el
--     día 30 con cenas que ocurren en diciembre.
--
--   * El periodo va DESDE QUE PAGA, no por mes natural. Quien contrata el 20
--     tiene cupo del 20 al 20. Con mes natural, quien contrata el 28 recibiría
--     su mes entero en tres días y después nada.
--
--   * Una fila por PERIODO, no una por suscripción que se va actualizando.
--     Renovar crea una fila nueva. Así queda el histórico de qué se vendió y
--     a qué precio, y el cupo se cuenta dentro de la fila sin arrastrar nada.
--
--   * El cupo y el precio se CONGELAN en la fila al contratar, en vez de
--     leerse del tier. Si mañana bronce sube de 2 a 3 grupos, quien ya está
--     pagando no debería cambiar de condiciones sin enterarse: lo que se
--     vendió se queda como se vendió.
-- ============================================================================

BEGIN;

-- Rangos de fechas sin solaparse: es la garantía de que un comercio no tenga
-- dos periodos activos a la vez y se le cuente el cupo dos veces.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- --- El catálogo de tiers gana cupo y precio -------------------------------
--
-- Son los valores de referencia con los que se contrata. Cambiarlos afecta a
-- las suscripciones NUEVAS; las vigentes conservan lo suyo.
ALTER TABLE pa_planes_comercio
    ADD COLUMN IF NOT EXISTS grupos_mes INT NOT NULL DEFAULT 0 CHECK (grupos_mes >= 0);
ALTER TABLE pa_planes_comercio
    ADD COLUMN IF NOT EXISTS precio_mes NUMERIC(10, 2) CHECK (precio_mes IS NULL OR precio_mes >= 0);

UPDATE pa_planes_comercio SET grupos_mes = 2 WHERE nombre = 'bronce';
UPDATE pa_planes_comercio SET grupos_mes = 4 WHERE nombre = 'plata';
UPDATE pa_planes_comercio SET grupos_mes = 6 WHERE nombre = 'gold';
-- premium queda abierto: es el tier sin tope declarado todavía. Un 0 lo
-- dejaría sin recibir nada, así que se le pone un cupo alto y explícito
-- mientras se decide, en vez de un NULL que habría que interpretar en código.
UPDATE pa_planes_comercio SET grupos_mes = 12 WHERE nombre = 'premium';

COMMENT ON COLUMN pa_planes_comercio.grupos_mes IS
    'Grupos que el tier da al mes. Referencia para contratar: la suscripción congela el suyo.';

-- --- Suscripciones: una fila por periodo ------------------------------------

CREATE TABLE IF NOT EXISTS comercio_suscripciones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
    plan_id     UUID NOT NULL REFERENCES pa_planes_comercio(id) ON DELETE RESTRICT,

    -- Lo contratado, congelado. No se lee del tier a propósito (ver cabecera).
    grupos_mes  INT NOT NULL CHECK (grupos_mes >= 0),
    precio_mes  NUMERIC(10, 2) CHECK (precio_mes IS NULL OR precio_mes >= 0),

    -- El periodo que cubre esta fila. `fin` es inclusivo: el último día con
    -- cupo. Un comercio que paga el 20 de enero tiene hasta el 19 de febrero.
    inicio      DATE NOT NULL,
    fin         DATE NOT NULL,

    -- 'prueba'    → periodo de cortesía, sin pago. Da cupo igual.
    -- 'activa'    → pagada y vigente.
    -- 'vencida'   → se acabó el periodo y no se renovó.
    -- 'cancelada' → la dio de baja el comercio o nosotros, antes de tiempo.
    estado      TEXT NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('prueba', 'activa', 'vencida', 'cancelada')),

    notas        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelada_at TIMESTAMPTZ,

    CHECK (fin >= inicio),
    -- Un periodo cancelado tiene que decir cuándo se canceló, y uno que no lo
    -- está no puede tener fecha de cancelación.
    CHECK ((estado = 'cancelada') = (cancelada_at IS NOT NULL)),

    -- Dos periodos VIVOS del mismo comercio no pueden solaparse: si pasara, el
    -- cupo se contaría dos veces y el comercio recibiría el doble de grupos sin
    -- pagarlos. Los vencidos y cancelados sí pueden solapar con lo que venga
    -- después, porque ya no cuentan.
    EXCLUDE USING gist (
        comercio_id WITH =,
        daterange(inicio, fin, '[]') WITH &&
    ) WHERE (estado IN ('prueba', 'activa'))
);

CREATE INDEX IF NOT EXISTS ix_suscripciones_comercio
    ON comercio_suscripciones (comercio_id, fin DESC);
CREATE INDEX IF NOT EXISTS ix_suscripciones_vigentes
    ON comercio_suscripciones (fin) WHERE estado IN ('prueba', 'activa');

DROP TRIGGER IF EXISTS trg_suscripciones_updated_at ON comercio_suscripciones;
CREATE TRIGGER trg_suscripciones_updated_at
    BEFORE UPDATE ON comercio_suscripciones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- Pagos ------------------------------------------------------------------
--
-- Separados de la suscripción porque un periodo puede cobrarse en una
-- transferencia, en dos, o no cobrarse (periodo de prueba). Al principio se
-- registran a mano; cuando haya pasarela, `referencia` guarda su id.
CREATE TABLE IF NOT EXISTS comercio_pagos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suscripcion_id UUID NOT NULL REFERENCES comercio_suscripciones(id) ON DELETE RESTRICT,
    monto          NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
    moneda         TEXT NOT NULL DEFAULT 'COP',
    metodo         TEXT NOT NULL
        CHECK (metodo IN ('transferencia', 'efectivo', 'tarjeta', 'pasarela', 'otro')),
    -- Id del cobro en la pasarela, o el número de la transferencia. Único
    -- cuando existe: evita registrar dos veces el mismo pago.
    referencia     TEXT,
    pagado_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    registrado_por TEXT,
    notas          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pagos_referencia
    ON comercio_pagos (referencia) WHERE referencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pagos_suscripcion ON comercio_pagos (suscripcion_id);

-- --- El cupo, calculado -----------------------------------------------------
--
-- Una sola fila por comercio con suscripción vigente hoy. Es lo que lee el
-- emparejamiento para saber si puede seguir mandándole grupos.
--
-- Los eventos se cuentan por `fecha_hora` dentro del periodo, que es la
-- decisión de la cabecera: el cupo es "cenas servidas", no "veces que el
-- sistema decidió". Se excluyen los cancelados: un grupo que no llegó a ir no
-- le gastó el cupo a nadie.
CREATE OR REPLACE VIEW v_cupo_comercio AS
SELECT
    s.comercio_id,
    s.id                AS suscripcion_id,
    s.estado,
    s.inicio,
    s.fin,
    s.grupos_mes,
    count(e.id)                               AS grupos_usados,
    greatest(s.grupos_mes - count(e.id), 0)   AS grupos_disponibles
FROM comercio_suscripciones s
LEFT JOIN eventos e
       ON e.comercio_id = s.comercio_id
      AND e.grupo_id IS NOT NULL
      AND e.deleted_at IS NULL
      AND e.estado <> 'cancelado'
      AND (e.fecha_hora AT TIME ZONE 'America/Bogota')::date BETWEEN s.inicio AND s.fin
WHERE s.estado IN ('prueba', 'activa')
  AND current_date BETWEEN s.inicio AND s.fin
GROUP BY s.comercio_id, s.id, s.estado, s.inicio, s.fin, s.grupos_mes;

-- --- Periodo de prueba para lo que ya existe --------------------------------
--
-- Los comercios que ya estaban no contrataron nada, y cortarles los grupos de
-- un día para otro por una decisión que no conocían sería empezar mal. Entran
-- con 30 días de prueba al cupo de su tier actual. Cuando venzan, el
-- emparejamiento deja de ofrecerles grupos — que es exactamente lo que el
-- modelo quiere, pero con aviso.
INSERT INTO comercio_suscripciones (comercio_id, plan_id, grupos_mes, inicio, fin, estado, notas)
SELECT c.id,
       c.plan_id,
       p.grupos_mes,
       current_date,
       current_date + 30,
       'prueba',
       'Alta automática con la migración 008: 30 días de cortesía.'
  FROM comercios c
  JOIN pa_planes_comercio p ON p.id = c.plan_id
 WHERE c.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM comercio_suscripciones s
      WHERE s.comercio_id = c.id AND s.estado IN ('prueba', 'activa')
   );

-- --- Permisos ---------------------------------------------------------------
--
-- El contexto comercial lo administra el dashboard PHP. La API social solo
-- necesita leer el cupo para decidir a quién le manda grupos: no tiene por qué
-- ver precios ni pagos.
GRANT SELECT, INSERT, UPDATE ON comercio_suscripciones TO seis_dashboard;
GRANT SELECT, INSERT ON comercio_pagos TO seis_dashboard;
GRANT SELECT ON v_cupo_comercio TO seis_dashboard;

GRANT SELECT ON v_cupo_comercio TO seis_app;
REVOKE ALL ON comercio_suscripciones, comercio_pagos FROM seis_app;

COMMIT;

-- --- Verificación -----------------------------------------------------------
SELECT nombre, nivel, grupos_mes FROM pa_planes_comercio ORDER BY nivel;
SELECT comercio_id, estado, inicio, fin, grupos_mes, grupos_usados, grupos_disponibles
  FROM v_cupo_comercio;
