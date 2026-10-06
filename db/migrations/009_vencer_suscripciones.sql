-- ============================================================================
-- 009 — Vencer las suscripciones sin depender de que algo se ejecute.
--
-- EL PROBLEMA. `comercio_suscripciones.estado` se queda en 'activa' para
-- siempre: nada lo mueve a 'vencida' cuando pasa la fecha. Funcionalmente el
-- corte ya ocurre, porque v_cupo_comercio filtra por
-- `current_date BETWEEN inicio AND fin`. Pero quien mire la tabla en vez de la
-- vista se lleva una idea equivocada de quién está pagando, y esa tabla es la
-- que uno consulta cuando cuadra cuentas.
--
-- LA TENTACIÓN sería montar un proceso programado y dar por hecho que corre.
-- No se hace así: un trabajo nocturno que falle un día dejaría al sistema
-- mandando grupos a comercios que ya no pagan, y nadie se enteraría hasta
-- facturar. Aquí el reparto es:
--
--   * La VERDAD se calcula. `v_suscripcion_estado` deriva el estado efectivo
--     de las fechas, así que no puede desincronizarse de nada. Es lo que leen
--     el emparejamiento y la app.
--   * El trabajo programado solo ORDENA. Marca 'vencida' lo que ya estaba
--     vencido de hecho. Si no corre en una semana, nada se rompe: solo queda
--     una tabla desordenada que la siguiente corrida arregla.
--
-- Dicho de otro modo: si el cron desaparece, el negocio sigue siendo correcto.
-- ============================================================================

BEGIN;

-- --- El estado efectivo, calculado ------------------------------------------
--
-- 'cancelada' gana sobre las fechas: una suscripción que se dio de baja el día
-- 3 no está vigente el 4 aunque su periodo llegue al 30.
CREATE OR REPLACE VIEW v_suscripcion_estado AS
SELECT
    s.*,
    CASE
        WHEN s.estado = 'cancelada'    THEN 'cancelada'
        WHEN current_date < s.inicio   THEN 'futura'
        WHEN current_date > s.fin      THEN 'vencida'
        ELSE 'vigente'
    END AS estado_efectivo,
    -- Negativo cuando ya venció: así una consulta puede ordenar por "cuánto
    -- hace que caducó" sin volver a restar fechas.
    (s.fin - current_date) AS dias_restantes,
    -- Lo que el proceso de orden tiene pendiente: filas cuyo estado guardado
    -- no coincide con la realidad.
    (s.estado IN ('prueba', 'activa') AND current_date > s.fin) AS pendiente_de_vencer
FROM comercio_suscripciones s;

-- --- El trabajo de orden ----------------------------------------------------
--
-- Idempotente y sin parámetros: se puede llamar cien veces al día. Devuelve
-- cuántas marcó, para que quien la invoque pueda registrarlo.
--
-- No toca las canceladas: ésas ya tienen un estado terminal puesto a mano y
-- una fecha de cancelación que no hay que pisar.
CREATE OR REPLACE FUNCTION vencer_suscripciones()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    marcadas integer;
BEGIN
    UPDATE comercio_suscripciones
       SET estado = 'vencida'
     WHERE estado IN ('prueba', 'activa')
       AND current_date > fin;
    GET DIAGNOSTICS marcadas = ROW_COUNT;
    RETURN marcadas;
END;
$$;

COMMENT ON FUNCTION vencer_suscripciones() IS
    'Marca como vencidas las suscripciones cuyo periodo ya pasó. Es orden, no '
    'corrección: v_cupo_comercio ya ignora los periodos fuera de fecha, así que '
    'si esto no corre nadie recibe grupos de más.';

-- --- Permisos ---------------------------------------------------------------
--
-- El contexto comercial es del dashboard. La API social puede LEER el estado
-- (lo necesita para explicar por qué un comercio dejó de recibir grupos), pero
-- no ejecuta el trabajo ni escribe nada.
GRANT SELECT ON v_suscripcion_estado TO seis_dashboard;
GRANT EXECUTE ON FUNCTION vencer_suscripciones() TO seis_dashboard;

GRANT SELECT ON v_suscripcion_estado TO seis_app;
REVOKE EXECUTE ON FUNCTION vencer_suscripciones() FROM seis_app;

COMMIT;

-- --- Verificación -----------------------------------------------------------
SELECT estado, estado_efectivo, pendiente_de_vencer, dias_restantes
  FROM v_suscripcion_estado ORDER BY fin;
